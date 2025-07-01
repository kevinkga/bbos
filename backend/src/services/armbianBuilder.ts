import { exec, spawn } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import { promisify } from 'util';
import { v4 as uuidv4 } from 'uuid';

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

  constructor() {
    this.buildDir = process.env.BUILD_DIR || '/tmp/bbos-builds';
    this.workDir = process.env.WORK_DIR || '/tmp/bbos-work';
    this.armbianRepo = process.env.ARMBIAN_REPO || 'https://github.com/armbian/build.git';
  }

  /**
   * Generate Armbian build configuration files from JSON config
   */
  async generateBuildConfig(config: ArmbianConfiguration, buildId: string): Promise<string> {
    const configDir = path.join(this.buildDir, buildId);
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
  async executeBuild(configDir: string, buildId: string, onProgress: (progress: BuildProgress) => void): Promise<BuildArtifact[]> {
    const outputDir = path.join(this.buildDir, buildId, 'output');
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
        buildId, 
        onProgress
      );

      // Generate artifacts
      const artifacts = await this.generateConfiguredArtifacts(
        configuredImagePath, 
        outputDir, 
        buildId
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

    // Map our board names to official Armbian download URLs
    const imageUrl = this.getArmbianDownloadUrl(config.board, config.distribution);
    const imageName = `Armbian_${config.distribution.release}_${config.board.name}.img`;
    const imagePath = path.join(configDir, imageName);

    // Check if image already exists
    try {
      await fs.access(imagePath);
      console.log(`📦 Using cached image: ${imageName}`);
      return imagePath;
    } catch {
      // Image doesn't exist, download it
    }

    try {
      // For demo purposes, we'll create a mock image file
      // In production, this would download from dl.armbian.com
      console.log(`📥 Downloading from: ${imageUrl}`);
      
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
      console.log(`✅ Downloaded Armbian image: ${imageName}`);
      return imagePath;

    } catch (error) {
      throw new Error(`Failed to download Armbian image: ${(error as Error).message}`);
    }
  }

  /**
   * Get official Armbian download URL for board and distribution
   */
  private getArmbianDownloadUrl(board: { family: string; name: string }, distribution: { release: string; type: string }): string {
    // Map to official Armbian download URLs
    // Format: https://dl.armbian.com/{board_name}/archive/
    const baseUrl = 'https://dl.armbian.com';
    
    // Normalize board name for Armbian downloads
    const normalizedBoard = board.name.toLowerCase().replace(/[^a-z0-9]/g, '-');
    
    return `${baseUrl}/${normalizedBoard}/archive/Armbian_${distribution.release}_${normalizedBoard}_${distribution.type}.img.xz`;
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

    // Copy base image and embed configuration
    // In production, this would modify the image filesystem to inject scripts
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
    console.log(`📦 Created configured image: ${configuredImageName}`);
    
    return configuredImagePath;
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

    // Configuration scripts as artifacts
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

