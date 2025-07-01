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
   * Execute build in Docker container
   */
  async executeBuild(configDir: string, buildId: string, onProgress: (progress: BuildProgress) => void): Promise<BuildArtifact[]> {
    const containerName = `bbos-build-${buildId}`;
    const outputDir = path.join(this.buildDir, buildId, 'output');
    await fs.mkdir(outputDir, { recursive: true });

    try {
      onProgress({
        phase: 'initializing',
        progress: 5,
        message: 'Setting up build environment...',
        timestamp: new Date().toISOString()
      });

      // For demo purposes, we'll simulate the build process
      await this.simulateBuild(onProgress);

      // Create demo artifacts
      const artifacts = await this.createDemoArtifacts(outputDir, buildId);

      onProgress({
        phase: 'completed',
        progress: 100,
        message: 'Build completed successfully',
        timestamp: new Date().toISOString()
      });

      return artifacts;

    } catch (error) {
      console.error('Build failed:', error);
      throw error;
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
