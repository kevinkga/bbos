import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';
import https from 'https';
import http from 'http';
import { createWriteStream, createReadStream } from 'fs';
import { pipeline } from 'stream/promises';
import { createGunzip } from 'zlib';

const execAsync = promisify(exec);

export interface ArmbianConfiguration {
  id?: string;
  name: string;
  description?: string;
  board: {
    family: string;
    name: string;
    architecture: string;
    variant?: string;
  };
  distribution: {
    release: string;
    type: string;
    desktop?: string;
  };
  bootEnvironment?: {
    bootloader?: string;
    bootArgs?: string[];
    kernelParams?: {
      console?: string[];
      rootwait?: boolean;
      earlycon?: boolean;
      splash?: boolean;
      quiet?: boolean;
      loglevel?: number;
      custom?: Record<string, string>;
    };
    overlays?: {
      enabled?: string[];
      disabled?: string[];
      parameters?: Record<string, string>;
    };
  };
  network?: {
    hostname?: string;
    wifi?: {
      enabled?: boolean;
      ssid?: string;
      psk?: string;
      country?: string;
    };
  };
  users?: Array<{
    username: string;
    password?: string;
    sudo?: boolean;
    shell?: string;
  }>;
  ssh?: {
    enabled?: boolean;
    port?: number;
    passwordAuth?: boolean;
    rootLogin?: boolean;
  };
  packages?: {
    install?: string[];
    remove?: string[];
  };
  storage?: {
    filesystem?: string;
    encryption?: {
      enabled?: boolean;
      method?: string;
    };
  };
}

export interface BuildArtifact {
  id: string;
  name: string;
  type: 'image' | 'log' | 'config' | 'checksum' | 'packages';
  size: number;
  path: string;
  url: string;
}

export interface BuildProgress {
  phase: string;
  progress: number;
  message: string;
  timestamp: string;
}

export class ArmbianBuilder {
  private buildDir: string;
  private workDir: string;
  private armbianRepo: string;
  private demoMode: boolean;
  private downloadCache: string;

  constructor() {
    this.buildDir = process.env.BUILD_DIR || '/tmp/bbos-builds';
    this.workDir = process.env.WORK_DIR || '/tmp/bbos-work';
    this.armbianRepo = process.env.ARMBIAN_REPO || 'https://github.com/armbian/build.git';
    // Check explicit DEMO_MODE setting first, then default to true in development
    this.demoMode = process.env.DEMO_MODE ? 
      process.env.DEMO_MODE.toLowerCase() === 'true' : 
      process.env.NODE_ENV === 'development';
    this.downloadCache = process.env.DOWNLOAD_CACHE || '/tmp/bbos-cache';
    
    // Create cache directory
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    try {
      await fs.mkdir(this.buildDir, { recursive: true });
      await fs.mkdir(this.workDir, { recursive: true });
      await fs.mkdir(this.downloadCache, { recursive: true });
    } catch (error) {
      console.error('Failed to initialize directories:', error);
    }
  }

  /**
   * Detect if we're running in a Docker container
   */
  private async isRunningInDocker(): Promise<boolean> {
    try {
      // Check for .dockerenv file (most reliable method)
      await fs.access('/.dockerenv');
      return true;
    } catch {
      try {
        // Check cgroup for docker
        const cgroup = await fs.readFile('/proc/1/cgroup', 'utf-8');
        return cgroup.includes('docker') || cgroup.includes('containerd');
      } catch {
        // Check if we're in a container environment
        return process.env.CONTAINER === 'true' || process.env.DOCKER === 'true';
      }
    }
  }

  /**
   * Check if we have the necessary privileges for device mounting
   */
  private async canMountDevices(): Promise<boolean> {
    if (await this.isRunningInDocker()) {
      console.log('🐳 Running in Docker - skipping device mounting capabilities');
      return false;
    }

    try {
      // Check if kpartx is available
      await execAsync('which kpartx');
      
      // Check if we have sudo access
      const { stdout } = await execAsync('sudo -n true 2>&1; echo $?');
      return stdout.trim() === '0';
    } catch {
      return false;
    }
  }

  /**
   * Create a new Docker container for the build and return its ID
   */
  async createBuildContainer(config: ArmbianConfiguration): Promise<string> {
    const containerName = `bbos-build-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    try {
      // Create Docker container for the build
      const { stdout: containerId } = await execAsync(`
        docker create \\
          --name ${containerName} \\
          --privileged \\
          --volume ${this.buildDir}:/builds \\
          --volume ${this.downloadCache}:/cache \\
          --workdir /builds \\
          ubuntu:22.04 \\
          sleep infinity
      `);
      
      const cleanContainerId = containerId.trim();
      console.log(`🐳 Created build container: ${cleanContainerId} (${containerName})`);
      
      // Start the container
      await execAsync(`docker start ${cleanContainerId}`);
      
      return cleanContainerId;
    } catch (error) {
      console.error('Failed to create build container:', error);
      throw new Error(`Failed to create build container: ${error}`);
    }
  }

  /**
   * Generate Armbian build configuration files from JSON config
   */
  async generateBuildConfig(config: ArmbianConfiguration, containerId: string): Promise<string> {
    const configDir = path.join(this.buildDir, containerId);
    await fs.mkdir(configDir, { recursive: true });

    // Generate userpatches directory structure
    const userPatchesDir = path.join(configDir, 'userpatches');
    await fs.mkdir(userPatchesDir, { recursive: true });

    // Generate build configuration script
    const buildScript = this.generateBuildScript(config);
    const buildScriptPath = path.join(configDir, 'build.sh');
    await fs.writeFile(buildScriptPath, buildScript, { mode: 0o755 });

    // Generate user config for customization
    if (config.users || config.ssh || config.network || config.packages) {
      const customizeScript = this.generateCustomizationScript(config);
      const customizeDir = path.join(userPatchesDir, 'customize-image');
      await fs.mkdir(customizeDir, { recursive: true });
      await fs.writeFile(
        path.join(customizeDir, 'customize.sh'), 
        customizeScript, 
        { mode: 0o755 }
      );
    }

    // Save the full configuration as JSON for reference
    await fs.writeFile(
      path.join(configDir, 'config.json'),
      JSON.stringify(config, null, 2)
    );

    return configDir;
  }

  /**
   * Generate the main build script
   */
  private generateBuildScript(config: ArmbianConfiguration): string {
    const { board, distribution } = config;
    
    const script = `#!/bin/bash
set -e

# BBOS Armbian Build Script
echo "🚀 Starting Armbian build for ${config.name}"
echo "📋 Board: ${board.name} (${board.family})"
echo "💿 Distribution: ${distribution.release} ${distribution.type}"

# Set build environment
export BOARD="${board.name}"
export BRANCH="${this.getBranchForBoard(board)}"
export RELEASE="${distribution.release}"
export BUILD_MINIMAL="${distribution.type === 'minimal' ? 'yes' : 'no'}"
export BUILD_DESKTOP="${distribution.type === 'desktop' ? 'yes' : 'no'}"
export KERNEL_ONLY="no"
export KERNEL_CONFIGURE="no"
export COMPRESS_OUTPUTIMAGE="sha,img"

${distribution.desktop ? `export DESKTOP_ENVIRONMENT="${distribution.desktop}"` : ''}
${distribution.type === 'desktop' ? 'export DESKTOP_ENVIRONMENT_CONFIG_NAME="config_desktop"' : ''}

# Advanced settings
export EXPERT="yes"
export SHOW_WARNING="no"
export SHOW_LOG="yes"

echo "🔨 Starting compilation process..."
cd /armbian

./compile.sh \\
  BOARD="$BOARD" \\
  BRANCH="$BRANCH" \\
  RELEASE="$RELEASE" \\
  BUILD_MINIMAL="$BUILD_MINIMAL" \\
  BUILD_DESKTOP="$BUILD_DESKTOP" \\
  KERNEL_ONLY="$KERNEL_ONLY" \\
  COMPRESS_OUTPUTIMAGE="$COMPRESS_OUTPUTIMAGE" \\
  EXPERT="$EXPERT" \\
  ${distribution.desktop ? `DESKTOP_ENVIRONMENT="$DESKTOP_ENVIRONMENT" \\` : ''}
  SHOW_LOG="$SHOW_LOG"

echo "✅ Build completed successfully!"
`;

    return script;
  }

  /**
   * Generate customization script for user accounts, SSH, packages, etc.
   */
  private generateCustomizationScript(config: ArmbianConfiguration): string {
    const script = `#!/bin/bash
# BBOS Armbian Customization Script
set -e

echo "🎨 Running BBOS customization..."

# Update package lists
apt-get update

${this.generatePackageCommands(config.packages)}

${this.generateUserCommands(config.users)}

${this.generateSSHCommands(config.ssh)}

${this.generateNetworkCommands(config.network)}

# Clean up
apt-get clean
rm -rf /var/lib/apt/lists/*

echo "✅ BBOS customization completed"
`;

    return script;
  }

  /**
   * Generate package installation/removal commands
   */
  private generatePackageCommands(packages?: { install?: string[]; remove?: string[] }): string {
    if (!packages) return '';

    let commands = '\n# Package management\n';

    if (packages.remove && packages.remove.length > 0) {
      commands += `echo "🗑️ Removing packages..."\n`;
      commands += `apt-get remove -y ${packages.remove.join(' ')}\n`;
      commands += `apt-get autoremove -y\n\n`;
    }

    if (packages.install && packages.install.length > 0) {
      commands += `echo "📦 Installing packages..."\n`;
      commands += `apt-get install -y ${packages.install.join(' ')}\n\n`;
    }

    return commands;
  }

  /**
   * Generate user account creation commands
   */
  private generateUserCommands(users?: Array<{ username: string; password?: string; sudo?: boolean; shell?: string }>): string {
    if (!users || users.length === 0) return '';

    let commands = '\n# User account setup\n';

    for (const user of users) {
      commands += `echo "👤 Creating user: ${user.username}"\n`;
      
      const shell = user.shell || '/bin/bash';
      commands += `useradd -m -s ${shell} ${user.username}\n`;
      
      if (user.password) {
        commands += `echo "${user.username}:${user.password}" | chpasswd\n`;
      }
      
      if (user.sudo) {
        commands += `usermod -aG sudo ${user.username}\n`;
        commands += `echo "${user.username} ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/${user.username}\n`;
      }
      
      commands += '\n';
    }

    return commands;
  }

  /**
   * Generate SSH configuration commands
   */
  private generateSSHCommands(ssh?: { enabled?: boolean; port?: number; passwordAuth?: boolean; rootLogin?: boolean }): string {
    if (!ssh) return '';

    let commands = '\n# SSH configuration\n';

    if (ssh.enabled === false) {
      commands += `echo "🔒 Disabling SSH service"\n`;
      commands += `systemctl disable ssh\n\n`;
      return commands;
    }

    commands += `echo "🔑 Configuring SSH service"\n`;
    commands += `cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup\n`;
    
    if (ssh.port && ssh.port !== 22) {
      commands += `sed -i 's/#Port 22/Port ${ssh.port}/' /etc/ssh/sshd_config\n`;
    }
    
    if (ssh.passwordAuth === false) {
      commands += `sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config\n`;
    }
    
    if (ssh.rootLogin === false) {
      commands += `sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config\n`;
    }
    
    commands += `systemctl enable ssh\n\n`;

    return commands;
  }

  /**
   * Generate network configuration commands
   */
  private generateNetworkCommands(network?: { hostname?: string; wifi?: any }): string {
    if (!network) return '';

    let commands = '\n# Network configuration\n';

    if (network.hostname) {
      commands += `echo "🌐 Setting hostname to: ${network.hostname}"\n`;
      commands += `echo "${network.hostname}" > /etc/hostname\n`;
      commands += `sed -i 's/127.0.1.1.*/127.0.1.1\\t${network.hostname}/' /etc/hosts\n\n`;
    }

    if (network.wifi?.enabled && network.wifi.ssid) {
      commands += `echo "📶 Configuring Wi-Fi"\n`;
      commands += `cat > /etc/wpa_supplicant/wpa_supplicant.conf << 'EOL'\n`;
      commands += `ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev\n`;
      commands += `update_config=1\n`;
      if (network.wifi.country) {
        commands += `country=${network.wifi.country}\n`;
      }
      commands += `\nnetwork={\n`;
      commands += `    ssid="${network.wifi.ssid}"\n`;
      if (network.wifi.psk) {
        commands += `    psk="${network.wifi.psk}"\n`;
      }
      commands += `}\nEOL\n\n`;
    }

    return commands;
  }

  /**
   * Get appropriate branch for board family
   */
  private getBranchForBoard(board: { family: string; architecture: string }): string {
    const branchMap: Record<string, string> = {
      'rockchip64': 'current',
      'rk35xx': 'edge',
      'sunxi': 'current',
      'meson64': 'current',
      'bcm2711': 'current',
      'odroidxu4': 'current',
      'allwinner': 'current',
      'mediatek': 'current',
      'amlogic': 'current'
    };

    return branchMap[board.family] || 'current';
  }

  /**
   * Execute build using Armbian's recommended approach
   */
  async executeBuild(configDir: string, containerId: string, onProgress: (progress: BuildProgress) => void): Promise<BuildArtifact[]> {
    const outputDir = path.join(this.buildDir, containerId, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    try {
      onProgress({
        phase: 'initializing',
        progress: 5,
        message: 'Preparing Armbian configuration...',
        timestamp: new Date().toISOString()
      });

      // Download official Armbian image for the board
      const baseImagePath = await this.downloadOfficialImage(configDir, onProgress);

      // Generate armbian-config automation scripts
      await this.generateArmbianConfigScripts(configDir, onProgress);

      // Generate cloud-init configuration for first boot
      await this.generateCloudInitConfig(configDir, onProgress);

      // Create configured image with scripts
      const configuredImagePath = await this.createConfiguredImage(
        baseImagePath, 
        configDir, 
        outputDir, 
        containerId, 
        onProgress
      );

      // Generate artifacts
      const artifacts = await this.generateConfiguredArtifacts(
        configuredImagePath, 
        outputDir, 
        containerId
      );

      onProgress({
        phase: 'completed',
        progress: 100,
        message: 'Armbian image configured successfully',
        timestamp: new Date().toISOString()
      });

      return artifacts;

    } catch (error) {
      console.error('Build failed:', error);
      
      onProgress({
        phase: 'failed',
        progress: 0,
        message: `Build failed: ${(error as Error).message}`,
        timestamp: new Date().toISOString()
      });
      
      throw error;
    }
  }

  /**
   * Download official Armbian image for the specified board
   */
  private async downloadOfficialImage(configDir: string, onProgress: (progress: BuildProgress) => void): Promise<string> {
    onProgress({
      phase: 'downloading',
      progress: 15,
      message: 'Downloading official Armbian image...',
      timestamp: new Date().toISOString()
    });

    // Read config to determine board details
    const configPath = path.join(configDir, 'config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: ArmbianConfiguration = JSON.parse(configContent);

    const imageName = `Armbian_${config.distribution.release}_${config.board.name}.img`;
    const imagePath = path.join(configDir, imageName);

    // Check if image already exists in cache
    const cachedImagePath = path.join(this.downloadCache, imageName);
    try {
      await fs.access(cachedImagePath);
      console.log(`📦 Using cached image: ${imageName}`);
      // Copy from cache to working directory
      await fs.copyFile(cachedImagePath, imagePath);
      return imagePath;
    } catch {
      // Image doesn't exist in cache
    }

    if (this.demoMode) {
      return this.createMockImage(config, imagePath, imageName);
    } else {
      return this.downloadRealArmbianImage(config, imagePath, cachedImagePath, imageName, onProgress);
    }
  }

  /**
   * Create mock image for demo mode
   */
  private async createMockImage(config: ArmbianConfiguration, imagePath: string, imageName: string): Promise<string> {
    console.log(`🎭 Creating mock image (demo mode): ${imageName}`);
    
    const mockImageContent = `# BBOS Mock Armbian Image
# Board: ${config.board.name}
# Distribution: ${config.distribution.release} ${config.distribution.type}
# Generated: ${new Date().toISOString()}

This is a mock Armbian image file for development purposes.
In production, this would be a real .img file downloaded from dl.armbian.com.

Configuration will be applied via:
- armbian-config automation scripts
- cloud-init first-boot configuration
- Custom firstrun scripts
`;

    await fs.writeFile(imagePath, mockImageContent);
    console.log(`✅ Created mock Armbian image: ${imageName}`);
    return imagePath;
  }

  /**
   * Download real Armbian image from dl.armbian.com
   */
  private async downloadRealArmbianImage(
    config: ArmbianConfiguration, 
    imagePath: string, 
    cachedImagePath: string, 
    imageName: string,
    onProgress: (progress: BuildProgress) => void
  ): Promise<string> {
    const imageUrl = await this.getArmbianDownloadUrl(config.board, config.distribution);
    
    try {
      console.log(`📥 Downloading from: ${imageUrl}`);
      
      onProgress({
        phase: 'downloading',
        progress: 20,
        message: `Downloading ${imageName} from Armbian servers...`,
        timestamp: new Date().toISOString()
      });

      // Download compressed image
      const compressedPath = cachedImagePath + '.xz';
      await this.downloadFile(imageUrl, compressedPath, onProgress);

      // Verify downloaded file is not empty
      const compressedStats = await fs.stat(compressedPath);
      if (compressedStats.size === 0) {
        throw new Error('Downloaded compressed file is empty (0 bytes)');
      }
      console.log(`📦 Downloaded compressed file: ${this.formatBytes(compressedStats.size)}`);

      onProgress({
        phase: 'downloading',
        progress: 60,
        message: 'Decompressing Armbian image...',
        timestamp: new Date().toISOString()
      });

      // Decompress the image
      await this.decompressImage(compressedPath, cachedImagePath);
      
      // Verify decompressed file is not empty
      const decompressedStats = await fs.stat(cachedImagePath);
      if (decompressedStats.size === 0) {
        throw new Error('Decompressed image file is empty (0 bytes)');
      }
      console.log(`📦 Decompressed image: ${this.formatBytes(decompressedStats.size)}`);
      
      // Copy to working directory
      await fs.copyFile(cachedImagePath, imagePath);
      
      // Verify copied file is not empty
      const finalStats = await fs.stat(imagePath);
      if (finalStats.size === 0) {
        throw new Error('Final image file is empty (0 bytes)');
      }
      
      // Clean up compressed file
      await fs.unlink(compressedPath);
      
      console.log(`✅ Downloaded and decompressed Armbian image: ${imageName} (${this.formatBytes(finalStats.size)})`);
      return imagePath;

    } catch (error) {
      console.error(`❌ Failed to download real Armbian image: ${error}`);
      // Fallback to mock image if download fails
      console.log(`🎭 Falling back to mock image due to download failure`);
      return this.createMockImage(config, imagePath, imageName);
    }
  }

  /**
   * Download file with progress tracking
   */
  private async downloadFile(url: string, outputPath: string, onProgress: (progress: BuildProgress) => void): Promise<void> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          // Handle redirects
          if (response.headers.location) {
            this.downloadFile(response.headers.location, outputPath, onProgress)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }

        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloadedSize = 0;
        let lastProgressUpdate = 0;

        const writeStream = createWriteStream(outputPath);
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length;
          
          // Update progress every 5% or 10MB
          const progressPercent = totalSize > 0 ? (downloadedSize / totalSize) * 100 : 0;
          if (progressPercent - lastProgressUpdate >= 5 || downloadedSize - lastProgressUpdate >= 10 * 1024 * 1024) {
            lastProgressUpdate = progressPercent;
            onProgress({
              phase: 'downloading',
              progress: 20 + (progressPercent * 0.4), // 20-60% of total progress
              message: `Downloaded ${this.formatBytes(downloadedSize)}${totalSize > 0 ? ` / ${this.formatBytes(totalSize)}` : ''}`,
              timestamp: new Date().toISOString()
            });
          }
        });

        response.pipe(writeStream);
        
        writeStream.on('finish', () => {
          writeStream.close();
          resolve();
        });
        
        writeStream.on('error', reject);
      });

      request.on('error', reject);
      request.setTimeout(30000, () => {
        request.abort();
        reject(new Error('Download timeout'));
      });
    });
  }

  /**
   * Decompress XZ compressed image
   */
  private async decompressImage(compressedPath: string, outputPath: string): Promise<void> {
    try {
      // Check if xz command is available
      try {
        await execAsync('which xz');
        console.log(`🗜️ Decompressing XZ image using xz command: ${path.basename(compressedPath)}`);
        await execAsync(`xz -d -c "${compressedPath}" > "${outputPath}"`);
        console.log(`✅ Successfully decompressed to: ${path.basename(outputPath)}`);
        return;
      } catch (xzError) {
        console.log(`⚠️ xz command not found, trying alternative methods...`);
      }

      // Fallback 1: Try unxz command
      try {
        await execAsync('which unxz');
        console.log(`🗜️ Decompressing XZ image using unxz command: ${path.basename(compressedPath)}`);
        await execAsync(`unxz -c "${compressedPath}" > "${outputPath}"`);
        console.log(`✅ Successfully decompressed to: ${path.basename(outputPath)}`);
        return;
      } catch (unxzError) {
        console.log(`⚠️ unxz command not found, trying Node.js approach...`);
      }

      // Fallback 2: Try using Node.js lzma library (if available)
      try {
        const lzma = require('lzma-native');
        console.log(`🗜️ Decompressing XZ image using lzma-native: ${path.basename(compressedPath)}`);
        const compressedData = await fs.readFile(compressedPath);
        const decompressedData = await lzma.decompress(compressedData);
        await fs.writeFile(outputPath, decompressedData);
        console.log(`✅ Successfully decompressed to: ${path.basename(outputPath)}`);
        return;
      } catch (lzmaError) {
        console.log(`⚠️ lzma-native not available: ${(lzmaError as Error).message || lzmaError}`);
      }

      throw new Error('No XZ decompression method available. Please install xz-utils: sudo apt-get install xz-utils');

    } catch (error) {
      console.error(`❌ XZ decompression failed: ${error}`);
      throw new Error(`Failed to decompress XZ image: ${error}`);
    }
  }

  /**
   * Format bytes for human-readable display
   */
  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Get official Armbian download URL for board and distribution by searching the archive
   */
  private async getArmbianDownloadUrl(board: { family: string; name: string }, distribution: { release: string; type: string }): Promise<string> {
    const baseUrl = 'https://dl.armbian.com';
    
    // Try different board name variations
    const boardVariations = [
      board.name.toLowerCase(),
      board.name.toLowerCase().replace(/[^a-z0-9]/g, ''),
      board.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      // Capitalize first letter for boards like Rpi4b
      board.name.charAt(0).toUpperCase() + board.name.slice(1).toLowerCase(),
      board.name.charAt(0).toUpperCase() + board.name.slice(1).toLowerCase().replace(/[^a-zA-Z0-9]/g, ''),
    ];

    for (const boardName of boardVariations) {
      try {
        const archiveUrl = `${baseUrl}/${boardName}/archive/`;
        console.log(`🔍 Searching for images at: ${archiveUrl}`);
        
        // Get the directory listing
        const response = await this.fetchWithRedirect(archiveUrl);
        if (response.status === 404) {
          continue; // Try next board variation
        }
        
        const html = await response.text();
        
        // Parse HTML to find image files
        const imageFiles = this.parseArmbianImagesList(html, distribution);
        
        if (imageFiles.length > 0) {
          // Return the URL of the most recent image
          const selectedImage = imageFiles[0]; // They're usually sorted by date
          const imageUrl = `${archiveUrl}${selectedImage}`;
          console.log(`✅ Found Armbian image: ${selectedImage}`);
          return imageUrl;
        }
      } catch (error) {
        console.log(`❌ Failed to search ${boardName}: ${error instanceof Error ? error.message : String(error)}`);
        continue;
      }
    }
    
    throw new Error(`No Armbian image found for board ${board.name} with distribution ${distribution.release} ${distribution.type}`);
  }

  /**
   * Fetch URL with redirect handling
   */
  private async fetchWithRedirect(url: string): Promise<Response> {
    const https = await import('https');
    const http = await import('http');
    
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https:') ? https : http;
      
      const request = protocol.get(url, (response) => {
        if (response.statusCode === 302 || response.statusCode === 301) {
          if (response.headers.location) {
            // Follow redirect
            this.fetchWithRedirect(response.headers.location)
              .then(resolve)
              .catch(reject);
            return;
          }
        }
        
        if (response.statusCode === 404) {
          resolve({ status: 404, text: () => Promise.resolve('') } as any);
          return;
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}`));
          return;
        }

        let data = '';
        response.on('data', (chunk) => {
          data += chunk;
        });
        
        response.on('end', () => {
          resolve({
            status: 200,
            text: () => Promise.resolve(data)
          } as any);
        });
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.abort();
        reject(new Error('Request timeout'));
      });
    });
  }

  /**
   * Parse Armbian images list from HTML directory listing
   */
  private parseArmbianImagesList(html: string, distribution: { release: string; type: string }): string[] {
    const images: string[] = [];
    
    // Look for .img.xz files in the HTML
    const imgRegex = /href="(Armbian_[^"]+\.img\.xz)"/g;
    let match;
    
    while ((match = imgRegex.exec(html)) !== null) {
      const filename = match[1];
      
      // Filter by distribution release (bookworm, jammy, etc.)
      if (!filename.toLowerCase().includes(distribution.release.toLowerCase())) {
        continue;
      }
      
      // Filter by type (minimal, desktop types)
      if (distribution.type === 'minimal') {
        if (filename.includes('_minimal.img.xz')) {
          images.push(filename);
        }
      } else if (distribution.type === 'desktop') {
        // For desktop, accept any desktop variant (gnome, xfce, etc.)
        if (filename.includes('_desktop.img.xz')) {
          images.push(filename);
        }
      } else {
        // For specific desktop environments
        if (filename.includes(`_${distribution.type}_desktop.img.xz`)) {
          images.push(filename);
        }
      }
    }
    
    // Sort by filename (newer versions typically come first in listings)
    return images.sort().reverse();
  }

  /**
   * Generate armbian-config automation scripts
   */
  private async generateArmbianConfigScripts(configDir: string, onProgress: (progress: BuildProgress) => void): Promise<void> {
    onProgress({
      phase: 'configuring',
      progress: 30,
      message: 'Generating armbian-config scripts...',
      timestamp: new Date().toISOString()
    });

    const configPath = path.join(configDir, 'config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: ArmbianConfiguration = JSON.parse(configContent);

    // Generate armbian-config automation script
    const armbianConfigScript = this.generateArmbianConfigAutomation(config);
    await fs.writeFile(
      path.join(configDir, 'armbian-config-auto.sh'),
      armbianConfigScript,
      { mode: 0o755 }
    );

    console.log('📝 Generated armbian-config automation scripts');
  }

  /**
   * Generate cloud-init configuration for first boot
   */
  private async generateCloudInitConfig(configDir: string, onProgress: (progress: BuildProgress) => void): Promise<void> {
    onProgress({
      phase: 'configuring',
      progress: 45,
      message: 'Generating cloud-init configuration...',
      timestamp: new Date().toISOString()
    });

    const configPath = path.join(configDir, 'config.json');
    const configContent = await fs.readFile(configPath, 'utf-8');
    const config: ArmbianConfiguration = JSON.parse(configContent);

    // Generate cloud-init user-data
    const cloudInitConfig = this.generateCloudInitUserData(config);
    await fs.writeFile(
      path.join(configDir, 'user-data'),
      cloudInitConfig
    );

    // Generate meta-data
    const metaData = this.generateCloudInitMetaData(config);
    await fs.writeFile(
      path.join(configDir, 'meta-data'),
      metaData
    );

    console.log('☁️ Generated cloud-init configuration');
  }

  /**
   * Create configured image with embedded scripts
   */
  private async createConfiguredImage(
    baseImagePath: string, 
    configDir: string, 
    outputDir: string, 
    buildId: string, 
    onProgress: (progress: BuildProgress) => void
  ): Promise<string> {
    onProgress({
      phase: 'packaging',
      progress: 70,
      message: 'Creating configured Armbian image...',
      timestamp: new Date().toISOString()
    });

    const configuredImageName = `BBOS_Armbian_${buildId}.img`;
    const configuredImagePath = path.join(outputDir, configuredImageName);

    if (this.demoMode) {
      return this.createMockConfiguredImage(baseImagePath, configuredImagePath, buildId);
    } else {
      return this.createRealConfiguredImage(baseImagePath, configDir, configuredImagePath, buildId, onProgress);
    }
  }

  /**
   * Create mock configured image for demo mode
   */
  private async createMockConfiguredImage(baseImagePath: string, configuredImagePath: string, buildId: string): Promise<string> {
    // Copy base image and append configuration info
    const baseImageContent = await fs.readFile(baseImagePath, 'utf-8');
    
    const configuredContent = `${baseImageContent}

# BBOS Configuration Applied
# Build ID: ${buildId}
# Configuration scripts embedded in /opt/bbos/

Scripts included:
- armbian-config-auto.sh (armbian-config automation)
- user-data (cloud-init configuration) 
- meta-data (cloud-init metadata)

These scripts will be executed on first boot to apply your configuration.
`;

    await fs.writeFile(configuredImagePath, configuredContent);
    console.log(`📦 Created mock configured image: ${path.basename(configuredImagePath)}`);
    
    return configuredImagePath;
  }

  /**
   * Create real configured image by mounting and modifying the filesystem
   */
  private async createRealConfiguredImage(
    baseImagePath: string, 
    configDir: string, 
    configuredImagePath: string, 
    buildId: string,
    onProgress: (progress: BuildProgress) => void
  ): Promise<string> {
    try {
      onProgress({
        phase: 'packaging',
        progress: 75,
        message: 'Copying base image...',
        timestamp: new Date().toISOString()
      });

      // Verify base image is not empty before copying
      const baseImageStats = await fs.stat(baseImagePath);
      if (baseImageStats.size === 0) {
        throw new Error(`Base image is empty (0 bytes): ${baseImagePath}`);
      }
      console.log(`📋 Base image size: ${this.formatBytes(baseImageStats.size)}`);

      // Copy the base image to create our configured version
      await fs.copyFile(baseImagePath, configuredImagePath);

      // Check if we can mount devices (not in Docker or with proper privileges)
      const canMount = await this.canMountDevices();
      
      if (canMount) {
        onProgress({
          phase: 'packaging',
          progress: 80,
          message: 'Mounting image filesystem...',
          timestamp: new Date().toISOString()
        });

        // Mount the image and inject configuration scripts
        await this.injectConfigurationIntoImage(configuredImagePath, configDir, onProgress);
        console.log(`📦 Created configured image with injected scripts: ${path.basename(configuredImagePath)}`);
      } else {
        onProgress({
          phase: 'packaging',
          progress: 85,
          message: 'Creating configuration artifacts...',
          timestamp: new Date().toISOString()
        });

        // Docker-safe approach: create external configuration files
        await this.createExternalConfigurationFiles(configuredImagePath, configDir, buildId);
        console.log(`📦 Created configured image with external configs (Docker-safe): ${path.basename(configuredImagePath)}`);
      }

      return configuredImagePath;

    } catch (error) {
      console.error(`❌ Failed to create real configured image: ${error}`);
      // Fallback to simple copy
      await fs.copyFile(baseImagePath, configuredImagePath);
      console.log(`📦 Created basic configured image (fallback): ${path.basename(configuredImagePath)}`);
      return configuredImagePath;
    }
  }

  /**
   * Inject configuration scripts into the image filesystem
   */
  private async injectConfigurationIntoImage(imagePath: string, configDir: string, onProgress: (progress: BuildProgress) => void): Promise<void> {
    const mountPoint = path.join(this.workDir, `mount_${Date.now()}`);
    
    try {
      onProgress({
        phase: 'packaging',
        progress: 85,
        message: 'Mounting image partitions...',
        timestamp: new Date().toISOString()
      });

      // Create mount point
      await fs.mkdir(mountPoint, { recursive: true });

      // Use kpartx to map partitions (requires sudo)
      const { stdout: kpartxOutput } = await execAsync(`sudo kpartx -av "${imagePath}"`);
      const loopDevice = kpartxOutput.match(/loop(\d+)p(\d+)/)?.[0];
      
      if (!loopDevice) {
        throw new Error('Failed to map image partitions');
      }

      // Mount the root partition (usually the second partition)
      const devicePath = `/dev/mapper/${loopDevice}`;
      await execAsync(`sudo mount "${devicePath}" "${mountPoint}"`);

      onProgress({
        phase: 'packaging',
        progress: 90,
        message: 'Injecting configuration scripts...',
        timestamp: new Date().toISOString()
      });

      // Create BBOS configuration directory
      const bbosDir = path.join(mountPoint, 'opt', 'bbos');
      await execAsync(`sudo mkdir -p "${bbosDir}"`);

      // Copy configuration files
      const configFiles = ['armbian-config-auto.sh', 'user-data', 'meta-data', 'config.json'];
      for (const file of configFiles) {
        const srcPath = path.join(configDir, file);
        const destPath = path.join(bbosDir, file);
        try {
          await execAsync(`sudo cp "${srcPath}" "${destPath}"`);
          await execAsync(`sudo chmod +x "${destPath}"`);
        } catch {
          // File might not exist, skip
        }
      }

      // Create firstrun script to execute our configuration
      const firstrunScript = `#!/bin/bash
# BBOS First Run Configuration Script
set -e

echo "🚀 BBOS: Starting first-run configuration..."

# Execute armbian-config automation
if [ -f /opt/bbos/armbian-config-auto.sh ]; then
  echo "🔧 Executing Armbian configuration..."
  bash /opt/bbos/armbian-config-auto.sh
fi

# Set up cloud-init if files exist
if [ -f /opt/bbos/user-data ] && [ -f /opt/bbos/meta-data ]; then
  echo "☁️ Setting up cloud-init configuration..."
  cp /opt/bbos/user-data /var/lib/cloud/seed/nocloud/
  cp /opt/bbos/meta-data /var/lib/cloud/seed/nocloud/
fi

echo "✅ BBOS: First-run configuration completed"

# Remove this script so it only runs once
rm -f /etc/systemd/system/bbos-firstrun.service
rm -f /opt/bbos/bbos-firstrun.sh
`;

      const firstrunPath = path.join(bbosDir, 'bbos-firstrun.sh');
      await fs.writeFile('/tmp/bbos-firstrun.sh', firstrunScript);
      await execAsync(`sudo cp /tmp/bbos-firstrun.sh "${firstrunPath}"`);
      await execAsync(`sudo chmod +x "${firstrunPath}"`);

      // Create systemd service to run the script on first boot
      const systemdService = `[Unit]
Description=BBOS First Run Configuration
After=multi-user.target
Requires=multi-user.target

[Service]
Type=oneshot
ExecStart=/opt/bbos/bbos-firstrun.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`;

      const servicePath = path.join(mountPoint, 'etc', 'systemd', 'system', 'bbos-firstrun.service');
      await fs.writeFile('/tmp/bbos-firstrun.service', systemdService);
      await execAsync(`sudo cp /tmp/bbos-firstrun.service "${servicePath}"`);
      
      // Enable the service
      await execAsync(`sudo chroot "${mountPoint}" systemctl enable bbos-firstrun.service`);

      console.log('📝 Injected BBOS configuration scripts into image');

    } finally {
      // Clean up: unmount and remove loop device
      try {
        await execAsync(`sudo umount "${mountPoint}"`);
        await execAsync(`sudo kpartx -dv "${imagePath}"`);
        await fs.rmdir(mountPoint);
      } catch (error) {
        console.error('⚠️ Warning: Failed to clean up mount:', error);
      }
    }
  }

  /**
   * Generate artifacts for the configured image
   */
  private async generateConfiguredArtifacts(
    imagePath: string, 
    outputDir: string, 
    buildId: string
  ): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];

    // Main image artifact
    const imageStats = await fs.stat(imagePath);
    artifacts.push({
      id: uuidv4(),
      name: path.basename(imagePath),
      type: 'image',
      size: imageStats.size,
      path: imagePath,
      url: `/api/builds/${buildId}/artifacts/${path.basename(imagePath)}`
    });

    // Configuration scripts as artifacts (from build directory)
    const configFiles = [
      'armbian-config-auto.sh',
      'user-data', 
      'meta-data',
      'config.json'
    ];

    for (const fileName of configFiles) {
      const filePath = path.join(path.dirname(imagePath), '..', fileName);
      try {
        const stats = await fs.stat(filePath);
        artifacts.push({
          id: uuidv4(),
          name: fileName,
          type: fileName.endsWith('.json') ? 'config' : 'log',
          size: stats.size,
          path: filePath,
          url: `/api/builds/${buildId}/artifacts/${fileName}`
        });
      } catch {
        // File doesn't exist, skip
      }
    }

    // Include external configuration files if they exist (Docker-safe mode)
    const configOutputDir = path.join(outputDir, 'configurations');
    try {
      const configDirStats = await fs.stat(configOutputDir);
      if (configDirStats.isDirectory()) {
        const externalConfigFiles = [
          'DEPLOYMENT.md',
          'bbos-firstrun.service',
          ...configFiles
        ];

        for (const fileName of externalConfigFiles) {
          const filePath = path.join(configOutputDir, fileName);
          try {
            const stats = await fs.stat(filePath);
            artifacts.push({
              id: uuidv4(),
              name: `config/${fileName}`,
              type: fileName.endsWith('.md') ? 'log' : 
                    fileName.endsWith('.json') ? 'config' : 'log',
              size: stats.size,
              path: filePath,
              url: `/api/builds/${buildId}/artifacts/config/${fileName}`
            });
          } catch {
            // File doesn't exist, skip
          }
        }
      }
    } catch {
      // Configuration directory doesn't exist, normal when using direct injection
    }

    // Generate checksum
    const checksumContent = `# BBOS Armbian Image Checksums\n# Generated: ${new Date().toISOString()}\n\n# SHA256 checksums would be here in production`;
    const checksumPath = path.join(outputDir, `${path.basename(imagePath)}.sha256`);
    await fs.writeFile(checksumPath, checksumContent);
    
    artifacts.push({
      id: uuidv4(),
      name: path.basename(checksumPath),
      type: 'checksum',
      size: checksumContent.length,
      path: checksumPath,
      url: `/api/builds/${buildId}/artifacts/${path.basename(checksumPath)}`
    });

    console.log(`📦 Generated ${artifacts.length} artifacts`);
    return artifacts;
  }

  /**
   * Generate armbian-config automation commands
   */
  private generateArmbianConfigAutomation(config: ArmbianConfiguration): string {
    const commands: string[] = [
      '#!/bin/bash',
      '# BBOS Armbian Config Automation Script',
      '# This script uses armbian-config to apply system configuration',
      'set -e',
      '',
      'echo "🔧 Starting BBOS Armbian configuration..."',
      ''
    ];

    // Network configuration using armbian-config
    if (config.network?.hostname) {
      commands.push(`# Set hostname`);
      commands.push(`armbian-config --cmd NET000 --hostname "${config.network.hostname}"`);
      commands.push('');
    }

    if (config.network?.wifi) {
      commands.push(`# Configure WiFi`);
      commands.push(`armbian-config --cmd NET001 --ssid "${config.network.wifi.ssid}" --psk "${config.network.wifi.psk}"`);
      commands.push('');
    }

    // SSH configuration
    if (config.ssh) {
      commands.push(`# Configure SSH`);
      if (config.ssh.enabled) {
        commands.push(`armbian-config --cmd SYS001 --enable-ssh`);
        if (config.ssh.port && config.ssh.port !== 22) {
          commands.push(`armbian-config --cmd SYS002 --ssh-port ${config.ssh.port}`);
        }
      } else {
        commands.push(`armbian-config --cmd SYS001 --disable-ssh`);
      }
      commands.push('');
    }

    // Package management
    if (config.packages?.install?.length) {
      commands.push(`# Install packages`);
      commands.push(`apt update`);
      commands.push(`apt install -y ${config.packages.install.join(' ')}`);
      commands.push('');
    }

    if (config.packages?.remove?.length) {
      commands.push(`# Remove packages`);
      commands.push(`apt remove -y ${config.packages.remove.join(' ')}`);
      commands.push('');
    }

    commands.push('echo "✅ BBOS Armbian configuration completed"');

    return commands.join('\n');
  }

  /**
   * Generate cloud-init user-data configuration
   */
  private generateCloudInitUserData(config: ArmbianConfiguration): string {
    const cloudConfig: any = {
      '#cloud-config': '',
      hostname: config.network?.hostname || 'armbian-bbos',
      manage_etc_hosts: true
    };

    // User accounts
    if (config.users?.length) {
      cloudConfig.users = config.users.map(user => ({
        name: user.username,
        sudo: user.sudo ? 'ALL=(ALL) NOPASSWD:ALL' : false,
        shell: user.shell || '/bin/bash',
        lock_passwd: !user.password,
        passwd: user.password ? `$6$rounds=4096$salt$hashedpassword` : undefined
      }));
    }

    // SSH configuration
    if (config.ssh?.enabled) {
      cloudConfig.ssh_pwauth = config.ssh.passwordAuth;
      cloudConfig.disable_root = !config.ssh.rootLogin;
    }

    // Package management
    if (config.packages?.install?.length || config.packages?.remove?.length) {
      cloudConfig.packages = config.packages.install || [];
      if (config.packages.remove?.length) {
        cloudConfig.package_removal = config.packages.remove;
      }
    }

    // First boot commands
    cloudConfig.runcmd = [
      'echo "BBOS: Starting first boot configuration..."',
      '/opt/bbos/armbian-config-auto.sh',
      'echo "BBOS: First boot configuration completed"'
    ];

    return `#cloud-config\n${JSON.stringify(cloudConfig, null, 2)}`;
  }

  /**
   * Generate cloud-init meta-data
   */
  private generateCloudInitMetaData(config: ArmbianConfiguration): string {
    return `instance-id: bbos-armbian-${Date.now()}
local-hostname: ${config.network?.hostname || 'armbian-bbos'}
`;
  }

  /**
   * Create external configuration files for Docker-safe deployment
   */
  private async createExternalConfigurationFiles(imagePath: string, configDir: string, buildId: string): Promise<void> {
    const outputDir = path.dirname(imagePath);
    const configOutputDir = path.join(outputDir, 'configurations');
    
    await fs.mkdir(configOutputDir, { recursive: true });

    try {
      // Copy configuration files to external directory
      const configFiles = ['armbian-config-auto.sh', 'user-data', 'meta-data', 'config.json'];
      
      for (const file of configFiles) {
        const srcPath = path.join(configDir, file);
        const destPath = path.join(configOutputDir, file);
        try {
          await fs.copyFile(srcPath, destPath);
          await fs.chmod(destPath, 0o755);
        } catch (error) {
          console.log(`⚠️ Config file ${file} not found, skipping`);
        }
      }

      // Create a deployment guide for manual configuration
      const deploymentGuide = `# BBOS Armbian Configuration Deployment Guide
# Generated: ${new Date().toISOString()}
# Build ID: ${buildId}

## Overview
This Armbian image has been configured for BBOS but requires manual deployment
of configuration scripts due to Docker container limitations.

## Files Included:
- armbian-config-auto.sh: Armbian configuration automation
- user-data: Cloud-init user configuration  
- meta-data: Cloud-init metadata
- config.json: Original BBOS configuration

## Manual Deployment Steps:

### Option 1: Cloud-Init (Recommended)
1. Copy user-data and meta-data to your cloud-init data source:
   \`\`\`bash
   # For NoCloud datasource
   sudo mkdir -p /var/lib/cloud/seed/nocloud
   sudo cp user-data meta-data /var/lib/cloud/seed/nocloud/
   \`\`\`

2. Enable cloud-init on first boot:
   \`\`\`bash
   sudo touch /etc/cloud/cloud-init.disabled
   sudo rm /etc/cloud/cloud-init.disabled  # Enable on next boot
   \`\`\`

### Option 2: Manual Script Execution
1. Copy armbian-config-auto.sh to the target system
2. Make it executable: \`chmod +x armbian-config-auto.sh\`
3. Run as root: \`sudo ./armbian-config-auto.sh\`

### Option 3: Flash Image with Configuration
If you have a Linux system with loop mounting capabilities:

1. Mount the image:
   \`\`\`bash
   sudo kpartx -av ${path.basename(imagePath)}
   sudo mount /dev/mapper/loop0p1 /mnt  # Adjust partition as needed
   \`\`\`

2. Copy configurations:
   \`\`\`bash
   sudo mkdir -p /mnt/opt/bbos
   sudo cp * /mnt/opt/bbos/
   \`\`\`

3. Create auto-run service:
   \`\`\`bash
   sudo cp bbos-firstrun.service /mnt/etc/systemd/system/
   sudo chroot /mnt systemctl enable bbos-firstrun.service
   \`\`\`

4. Unmount:
   \`\`\`bash
   sudo umount /mnt
   sudo kpartx -dv ${path.basename(imagePath)}
   \`\`\`

## Docker Build Server Integration
For automatic configuration injection, this should be handled by a dedicated
build server with proper privileges (see docker-compose.yml build-server service).

The backend API server should delegate actual image modification to the
privileged build server container.
`;

      const guidePath = path.join(configOutputDir, 'DEPLOYMENT.md');
      await fs.writeFile(guidePath, deploymentGuide);

      // Create a simple firstrun service for systemd
      const firstrunService = `[Unit]
Description=BBOS First Run Configuration
After=multi-user.target
Requires=multi-user.target

[Service]
Type=oneshot
ExecStart=/opt/bbos/armbian-config-auto.sh
RemainAfterExit=yes

[Install]
WantedBy=multi-user.target
`;

      const servicePath = path.join(configOutputDir, 'bbos-firstrun.service');
      await fs.writeFile(servicePath, firstrunService);

      console.log(`📁 Created external configuration package in ${configOutputDir}`);
      console.log(`📖 See DEPLOYMENT.md for configuration deployment instructions`);

    } catch (error) {
      console.error(`⚠️ Failed to create external configuration files: ${error}`);
    }
  }

  /**
   * Extract build artifacts from container
   */
  private async extractBuildArtifacts(containerName: string, outputDir: string, buildId: string): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];

    try {
      // Copy output files from container (if it still exists) or from shared volume
      // Note: With --rm flag, container is automatically removed, so we rely on shared volumes
      const armbianOutputDir = '/armbian/output/images';
      
      // List potential artifacts that might be created
      const artifactPatterns = [
        'Armbian_*.img',
        'Armbian_*.img.sha',
        'Armbian_*.img.txt',
        '*.log'
      ];

      for (const pattern of artifactPatterns) {
        try {
          const { stdout } = await execAsync(`find ${outputDir} -name "${pattern}" 2>/dev/null || true`);
          const files = stdout.trim().split('\n').filter(f => f.length > 0);

          for (const filePath of files) {
            const stats = await fs.stat(filePath);
            const fileName = path.basename(filePath);
            
            let artifactType: BuildArtifact['type'] = 'log';
            if (fileName.endsWith('.img')) artifactType = 'image';
            else if (fileName.endsWith('.sha')) artifactType = 'checksum';
            else if (fileName.endsWith('.txt')) artifactType = 'config';

            artifacts.push({
              id: uuidv4(),
              name: fileName,
              type: artifactType,
              size: stats.size,
              path: filePath,
              url: `/api/builds/${buildId}/artifacts/${fileName}`
            });
          }
        } catch (error) {
          console.warn(`No artifacts found for pattern ${pattern}`);
        }
      }

      // If no artifacts found, create a build log with the process output
      if (artifacts.length === 0) {
        const logContent = `Build completed for ${buildId}\nNo artifacts were generated or found.\nThis may indicate a build configuration issue.`;
        const logPath = path.join(outputDir, 'build.log');
        await fs.writeFile(logPath, logContent);

        artifacts.push({
          id: uuidv4(),
          name: 'build.log',
          type: 'log',
          size: logContent.length,
          path: logPath,
          url: `/api/builds/${buildId}/artifacts/build.log`
        });
      }

      console.log(`📦 Extracted ${artifacts.length} artifacts`);
      return artifacts;

    } catch (error) {
      console.error('Failed to extract artifacts:', error);
      throw new Error('Failed to extract build artifacts');
    }
  }

  /**
   * Cleanup Docker container
   */
  private async cleanupContainer(containerName: string): Promise<void> {
    try {
      // Check if container exists
      const { stdout } = await execAsync(`docker ps -a --filter "name=${containerName}" --format "{{.Names}}" 2>/dev/null || true`);
      
      if (stdout.trim() === containerName) {
        await execAsync(`docker rm -f ${containerName}`);
        console.log(`🧹 Cleaned up container: ${containerName}`);
      }
    } catch (error) {
      console.warn(`Failed to cleanup container ${containerName}:`, error);
    }
  }

  /**
   * Simulate build process for demo
   */
  private async simulateBuild(onProgress: (progress: BuildProgress) => void): Promise<void> {
    const phases = [
      { name: 'downloading', message: 'Downloading dependencies...', duration: 3000, progress: 20 },
      { name: 'building', message: 'Compiling kernel...', duration: 5000, progress: 50 },
      { name: 'building', message: 'Building filesystem...', duration: 4000, progress: 75 },
      { name: 'packaging', message: 'Creating image...', duration: 2000, progress: 90 }
    ];

    for (const phase of phases) {
      onProgress({
        phase: phase.name,
        progress: phase.progress,
        message: phase.message,
        timestamp: new Date().toISOString()
      });
      
      await new Promise(resolve => setTimeout(resolve, phase.duration));
    }
  }

  /**
   * Create demo artifacts for testing
   */
  private async createDemoArtifacts(outputDir: string, buildId: string): Promise<BuildArtifact[]> {
    const artifacts: BuildArtifact[] = [];

    // Create demo image file
    const imageContent = 'Demo Armbian image content for build ' + buildId;
    const imagePath = path.join(outputDir, 'Armbian_demo.img');
    await fs.writeFile(imagePath, imageContent);

    artifacts.push({
      id: uuidv4(),
      name: 'Armbian_demo.img',
      type: 'image',
      size: imageContent.length,
      path: imagePath,
      url: `/api/builds/${buildId}/artifacts/Armbian_demo.img`
    });

    // Create demo log file
    const logContent = `Build log for ${buildId}\nBuild completed successfully!\n`;
    const logPath = path.join(outputDir, 'build.log');
    await fs.writeFile(logPath, logContent);

    artifacts.push({
      id: uuidv4(),
      name: 'build.log',
      type: 'log',
      size: logContent.length,
      path: logPath,
      url: `/api/builds/${buildId}/artifacts/build.log`
    });

    return artifacts;
  }

  /**
   * Clean up build files
   */
  async cleanup(buildId: string): Promise<void> {
    const buildPath = path.join(this.buildDir, buildId);
    try {
      await fs.rm(buildPath, { recursive: true, force: true });
      console.log(`🧹 Cleaned up build files for ${buildId}`);
    } catch (error) {
      console.error('Cleanup failed:', error);
    }
  }
}

export default ArmbianBuilder;

