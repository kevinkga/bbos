import { exec, spawn } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import * as zlib from 'zlib';

const execAsync = promisify(exec);

export interface RockchipDevice {
  id: string;
  type: 'maskrom' | 'loader' | 'fastboot';
  chipInfo?: string;
  flashInfo?: string;
}

export interface FlashProgress {
  phase: 'detecting' | 'preparing' | 'downloading_boot' | 'compressing' | 'erasing' | 'writing' | 'verifying' | 'resetting' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  timestamp: string;
  deviceId?: string;
  transferSpeed?: string; // MB/s
  eta?: string; // estimated time remaining
}

export interface FlashJob {
  id: string;
  buildId: string;
  deviceId: string;
  imagePath: string;
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: FlashProgress[];
  startTime?: string;
  endTime?: string;
  error?: string;
}

export interface StorageDevice {
  type: 'emmc' | 'sd' | 'spinor';
  name: string;
  code: number;
  available: boolean;
  capacity?: string;
  flashInfo?: string;
  recommended?: boolean;
  description: string;
}

export class HardwareFlasher {
  private rkdeveloptoolPath: string;
  private loaderPath: string;
  private activeFlashJobs: Map<string, FlashJob> = new Map();
  private deviceDetectionEnabled: boolean = true;
  private lastDeviceCheck: number = 0;
  private deviceCheckCooldown: number = 5000; // 5 seconds minimum between device checks

  constructor() {
    // Initialize paths for rkdeveloptool and loader
    this.rkdeveloptoolPath = process.env.RKDEVELOPTOOL_PATH || 
      path.join(process.env.HOME!, 'rkdeveloptool', 'rkdeveloptool');
    this.loaderPath = process.env.RK_LOADER_PATH || 
      path.join(process.env.HOME!, 'rkdeveloptool', 'rk3588_spl_loader_v1.15.113.bin');
    
    console.log('🔧 HardwareFlasher initialized');
    console.log(`📍 rkdeveloptool: ${this.rkdeveloptoolPath}`);
    console.log(`📍 Loader: ${this.loaderPath}`);
  }

  /**
   * Enable or disable automatic device detection
   */
  setDeviceDetectionEnabled(enabled: boolean): void {
    this.deviceDetectionEnabled = enabled;
    console.log(`🔧 Device detection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if we can perform device detection (respects cooldown)
   */
  private canCheckDevices(): boolean {
    if (!this.deviceDetectionEnabled) return false;
    const now = Date.now();
    return (now - this.lastDeviceCheck) >= this.deviceCheckCooldown;
  }

  /**
   * Detect connected Rockchip devices with rate limiting
   */
  async detectDevices(force: boolean = false): Promise<RockchipDevice[]> {
    // Rate limiting to prevent device lock conflicts
    if (!force && !this.canCheckDevices()) {
      console.log(`⏳ Device check rate limited (last check ${Math.round((Date.now() - this.lastDeviceCheck) / 1000)}s ago)`);
      return [];
    }

    if (!this.deviceDetectionEnabled) {
      console.log(`🚫 Device detection disabled (possibly to prevent Web Serial conflicts)`);
      return [];
    }

    this.lastDeviceCheck = Date.now();

    try {
      console.log(`🔍 Checking for Rockchip devices...`);
      
      // Quick device list check with timeout
      const { stdout } = await this.execWithTimeout(`${this.rkdeveloptoolPath} ld`, 3000);
      
      if (stdout.includes('not found any devices')) {
        console.log(`📱 No devices detected`);
        return [];
      }

      // Parse device list output
      const devices: RockchipDevice[] = [];
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (line.includes('DevNo=')) {
          // Example: "DevNo=1	Vid=0x2207,Pid=0x350a,LocationID=14100000	Maskrom"
          const devMatch = line.match(/DevNo=(\d+).*?(Maskrom|Loader|Fastboot)/i);
          const pidMatch = line.match(/Pid=0x([0-9a-fA-F]+)/i);
          
          if (devMatch) {
            const device: RockchipDevice = {
              id: devMatch[1],
              type: devMatch[2].toLowerCase() as 'maskrom' | 'loader' | 'fastboot'
            };

            // Map USB Product ID to chip type
            let chipType = 'Unknown';
            if (pidMatch) {
              const pid = pidMatch[1].toLowerCase();
              switch (pid) {
                case '350a':
                case '350b':
                  chipType = 'RK3588'; // Rock 5B and other RK3588 devices
                  break;
                case '350c':
                  chipType = 'RK3568';
                  break;
                case '350d':
                  chipType = 'RK3566';
                  break;
                case '330a':
                  chipType = 'RK3399';
                  break;
                case '330c':
                  chipType = 'RK3328';
                  break;
                case '290a':
                  chipType = 'RK3288';
                  break;
                case '281a':
                  chipType = 'RK3188';
                  break;
              }
            }

            device.chipInfo = `${chipType} (${device.type})`;
            devices.push(device);
          }
        }
      }

      console.log(`📱 Detected ${devices.length} Rockchip device(s)`);
      return devices;

    } catch (error) {
      console.log(`📱 Device detection failed: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Execute command with timeout to prevent hanging
   */
  private async execWithTimeout(command: string, timeoutMs: number): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Command timeout after ${timeoutMs}ms: ${command}`));
      }, timeoutMs);

      execAsync(command)
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }

  /**
   * Flash an image to a connected device using grab-use-release pattern
   */
  async flashImage(
    buildId: string, 
    imagePath: string, 
    deviceId: string,
    onProgress: (progress: FlashProgress) => void,
    storageTarget: 'emmc' | 'sd' | 'spinor' = 'emmc'
  ): Promise<string> {
    const flashJobId = `flash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Temporarily disable device detection to prevent conflicts
    const wasDetectionEnabled = this.deviceDetectionEnabled;
    this.setDeviceDetectionEnabled(false);
    
    const flashJob: FlashJob = {
      id: flashJobId,
      buildId,
      deviceId,
      imagePath,
      status: 'running',
      progress: [],
      startTime: new Date().toISOString()
    };

    this.activeFlashJobs.set(flashJobId, flashJob);

    const updateProgress = (progress: FlashProgress) => {
      progress.timestamp = new Date().toISOString();
      flashJob.progress.push(progress);
      onProgress(progress);
    };

    try {
      // Verify image exists
      await fs.access(imagePath);
      const stats = await fs.stat(imagePath);
      console.log(`🔥 Starting flash: ${path.basename(imagePath)} (${this.formatBytes(stats.size)}) → Device ${deviceId}`);

      // Step 1: Quick device detection (forced, bypassing rate limit)
      updateProgress({
        phase: 'detecting',
        progress: 5,
        message: `Detecting device ${deviceId}...`,
        timestamp: '',
        deviceId
      });

      const devices = await this.detectDevices(true); // Force detection
      const targetDevice = devices.find(d => d.id === deviceId);
      
      if (!targetDevice) {
        throw new Error(`Device ${deviceId} not found. Ensure board is in maskrom mode.`);
      }

      console.log(`🎯 Target device: ${targetDevice.type} mode`);

      // Step 2: Download bootloader (if in maskrom mode)
      if (targetDevice.type === 'maskrom') {
        updateProgress({
          phase: 'downloading_boot',
          progress: 15,
          message: 'Loading bootloader to device...',
          timestamp: '',
          deviceId
        });

        console.log(`📥 Loading bootloader: ${this.loaderPath}`);
        await this.execWithTimeout(`${this.rkdeveloptoolPath} db ${this.loaderPath}`, 10000);
        console.log(`✅ Bootloader loaded to device ${deviceId}`);
        
        // Wait for device to switch to loader mode
        console.log(`⏳ Waiting for device mode switch...`);
        await this.sleep(2000);
      }

      // Step 3: Write image
      updateProgress({
        phase: 'writing',
        progress: 25,
        message: 'Writing image to flash...',
        timestamp: '',
        deviceId
      });

      // Write image starting at sector 0 (full disk write)
      await this.writeImageWithProgress(imagePath, deviceId, updateProgress, storageTarget);

      // Step 4: Reset device
      updateProgress({
        phase: 'resetting',
        progress: 95,
        message: 'Resetting device...',
        timestamp: '',
        deviceId
      });

      try {
        await this.execWithTimeout(`${this.rkdeveloptoolPath} rd`, 5000);
        console.log(`🔄 Device reset command sent`);
      } catch (error) {
        console.log(`⚠️ Reset command failed (device may have disconnected): ${error}`);
      }

      // Step 5: Complete
      updateProgress({
        phase: 'completed',
        progress: 100,
        message: 'Flash completed successfully!',
        timestamp: '',
        deviceId
      });

      flashJob.status = 'completed';
      flashJob.endTime = new Date().toISOString();

      console.log(`✅ Flash completed: ${flashJobId}`);
      return flashJobId;

    } catch (error) {
      const errorMessage = (error as Error).message;
      console.error(`❌ Flash failed: ${errorMessage}`);

      updateProgress({
        phase: 'failed',
        progress: 0,
        message: `Flash failed: ${errorMessage}`,
        timestamp: '',
        deviceId
      });

      flashJob.status = 'failed';
      flashJob.error = errorMessage;
      flashJob.endTime = new Date().toISOString();

      throw error;
      
    } finally {
      // Always re-enable device detection after flashing
      this.setDeviceDetectionEnabled(wasDetectionEnabled);
      console.log(`🔧 Device detection restored to: ${wasDetectionEnabled ? 'enabled' : 'disabled'}`);
    }
  }

  /**
   * Detect available storage devices with detailed information
   */
  async detectStorageDevices(deviceId: string): Promise<StorageDevice[]> {
    try {
      console.log(`🔍 Detecting storage devices on ${deviceId}...`);
      
      const devices: StorageDevice[] = [
        {
          type: 'emmc',
          name: 'eMMC',
          code: 1,
          available: false,
          recommended: true,
          description: 'High-speed onboard flash storage (recommended for OS)'
        },
        {
          type: 'sd',
          name: 'SD Card',
          code: 2,
          available: false,
          recommended: false,
          description: 'Removable microSD card storage'
        },
        {
          type: 'spinor',
          name: 'SPI NOR Flash',
          code: 9,
          available: false,
          recommended: false,
          description: 'Small SPI flash for bootloader only (typically 16-32MB)'
        }
      ];

      // Test each storage device
      for (const device of devices) {
        try {
          console.log(`🔍 Testing ${device.name}...`);
          
          // Switch to storage device
          await this.execWithTimeout(`${this.rkdeveloptoolPath} cs ${device.code}`, 5000);
          
          // Get flash info
          const flashResult = await this.execWithTimeout(`${this.rkdeveloptoolPath} rfi`, 5000);
          
          device.available = true;
          device.flashInfo = flashResult.stdout.trim();
          
          // Parse capacity from flash info if available
          const flashLines = flashResult.stdout.split('\n');
          for (const line of flashLines) {
            if (line.includes('capacity') || line.includes('size')) {
              const match = line.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB)/i);
              if (match) {
                device.capacity = `${match[1]} ${match[2].toUpperCase()}`;
              }
              break;
            }
          }
          
          console.log(`✅ ${device.name} detected: ${device.capacity || 'Unknown size'}`);
          
        } catch (error) {
          console.log(`❌ ${device.name} not available: ${error}`);
          device.available = false;
        }
      }

      const availableDevices = devices.filter(d => d.available);
      console.log(`📊 Storage detection complete: ${availableDevices.length} device(s) available`);
      
      return devices;

    } catch (error) {
      console.error(`❌ Storage device detection failed: ${error}`);
      throw new Error(`Failed to detect storage devices: ${(error as Error).message}`);
    }
  }

  /**
   * Legacy storage detection method (for backward compatibility)
   */
  async detectStorage(deviceId: string): Promise<{
    emmc: boolean;
    sd: boolean;
    spinor: boolean;
    available: string[];
  }> {
    const devices = await this.detectStorageDevices(deviceId);
    
    return {
      emmc: devices.find(d => d.type === 'emmc')?.available || false,
      sd: devices.find(d => d.type === 'sd')?.available || false,
      spinor: devices.find(d => d.type === 'spinor')?.available || false,
      available: devices.filter(d => d.available).map(d => d.name)
    };
  }

  /**
   * Compress image file for faster transfer
   */
  private async compressImage(
    imagePath: string,
    onProgress: (progress: FlashProgress) => void,
    deviceId: string
  ): Promise<string> {
    const compressedPath = imagePath + '.gz';
    
    try {
      // Check if compressed version already exists and is newer
      try {
        const [originalStat, compressedStat] = await Promise.all([
          fs.stat(imagePath),
          fs.stat(compressedPath)
        ]);
        
        if (compressedStat.mtime > originalStat.mtime) {
          console.log(`📦 Using existing compressed image: ${compressedPath}`);
          return compressedPath;
        }
      } catch {
        // Compressed file doesn't exist, continue with compression
      }

      console.log(`📦 Compressing image for faster transfer: ${imagePath}`);
      
      onProgress({
        phase: 'compressing',
        progress: 5,
        message: 'Compressing image for faster transfer...',
        timestamp: '',
        deviceId
      });

      const originalSize = (await fs.stat(imagePath)).size;
      let compressedSize = 0;
      
      return new Promise<string>((resolve, reject) => {
        const readStream = require('fs').createReadStream(imagePath);
        const writeStream = require('fs').createWriteStream(compressedPath);
        const gzip = zlib.createGzip({ level: 6 }); // Good compression/speed balance
        
        const startTime = Date.now();
        
        writeStream.on('finish', () => {
          const duration = Math.round((Date.now() - startTime) / 1000);
          const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
          console.log(`✅ Compression complete in ${duration}s (${compressionRatio}% size reduction)`);
          resolve(compressedPath);
        });

        writeStream.on('error', reject);
        gzip.on('error', reject);
        readStream.on('error', reject);

        // Track compression progress
        let lastProgress = 5;
        readStream.on('data', (chunk: Buffer) => {
          compressedSize += chunk.length;
          const progress = Math.min(15, 5 + (compressedSize / originalSize) * 10);
          
          if (progress - lastProgress >= 1) {
            onProgress({
              phase: 'compressing',
              progress: Math.round(progress),
              message: `Compressing... ${this.formatBytes(compressedSize)}/${this.formatBytes(originalSize)}`,
              timestamp: '',
              deviceId
            });
            lastProgress = progress;
          }
        });

        readStream.pipe(gzip).pipe(writeStream);
      });

    } catch (error) {
      console.warn(`⚠️ Compression failed, using original image: ${error}`);
      return imagePath; // Fall back to original if compression fails
    }
  }

  /**
   * Write image with optimizations: compression + chunked progress
   */
  private async writeImageWithProgress(
    imagePath: string, 
    deviceId: string, 
    onProgress: (progress: FlashProgress) => void,
    targetStorage: 'emmc' | 'sd' | 'spinor' = 'emmc'
  ): Promise<void> {
    try {
      console.log(`📤 Writing image: ${imagePath} to ${targetStorage.toUpperCase()}`);
      
      // Step 1: Detect available storage
      onProgress({
        phase: 'writing',
        progress: 20,
        message: 'Detecting available storage...',
        timestamp: '',
        deviceId
      });

      const storage = await this.detectStorage(deviceId);
      
      if (storage.available.length === 0) {
        throw new Error('No storage devices detected! Please insert an SD card or ensure eMMC is available.');
      }

      console.log(`📋 Available storage: ${storage.available.join(', ')}`);

      // Step 2: Select target storage
      let storageCode: number;
      let storageName: string;

      switch (targetStorage) {
        case 'emmc':
          if (!storage.emmc) {
            throw new Error('eMMC not available. Please select a different storage option or insert an SD card.');
          }
          storageCode = 1;
          storageName = 'eMMC';
          break;
        case 'sd':
          if (!storage.sd) {
            throw new Error('SD Card not detected. Please insert an SD card or select a different storage option.');
          }
          storageCode = 2;
          storageName = 'SD Card';
          break;
        case 'spinor':
          if (!storage.spinor) {
            throw new Error('SPI NOR Flash not available. Please select a different storage option.');
          }
          storageCode = 9;
          storageName = 'SPI NOR Flash';
          break;
        default:
          throw new Error(`Invalid storage type: ${targetStorage}`);
      }

      // Step 3: Switch to target storage
      onProgress({
        phase: 'writing',
        progress: 22,
        message: `Switching to ${storageName}...`,
        timestamp: '',
        deviceId
      });

      await this.execWithTimeout(`${this.rkdeveloptoolPath} cs ${storageCode}`, 5000);
      console.log(`🔄 Switched to ${storageName} (code: ${storageCode})`);

      // Step 4: Compression optimization (if image is large)
      const imageStats = await fs.stat(imagePath);
      const imageSizeMB = imageStats.size / (1024 * 1024);
      let finalImagePath = imagePath;
      
      if (imageSizeMB > 100) { // Only compress large images
        console.log(`📦 Large image detected (${imageSizeMB.toFixed(1)} MB), enabling compression...`);
        finalImagePath = await this.compressImage(imagePath, onProgress, deviceId);
      }

      // Step 5: Optimized write with progress tracking
      await this.writeImageOptimized(finalImagePath, storageName, onProgress, deviceId);

      // Clean up compressed file if we created one
      if (finalImagePath !== imagePath && finalImagePath.endsWith('.gz')) {
        try {
          await fs.unlink(finalImagePath);
          console.log(`🧹 Cleaned up temporary compressed file`);
        } catch (error) {
          console.warn(`⚠️ Failed to clean up compressed file: ${error}`);
        }
      }

    } catch (error) {
      console.error(`❌ Image write failed: ${error}`);
      throw new Error(`Failed to write image: ${(error as Error).message}`);
    }
  }

  /**
   * Optimized image writing with real-time progress and speed tracking
   */
  private async writeImageOptimized(
    imagePath: string,
    storageName: string,
    onProgress: (progress: FlashProgress) => void,
    deviceId: string
  ): Promise<void> {
    console.log(`⚡ Starting optimized write to ${storageName}`);
    
    const startTime = Date.now();
    const imageSize = (await fs.stat(imagePath)).size;
    
    // Check if we're using compressed image
    const isCompressed = imagePath.endsWith('.gz');
    const transferMode = isCompressed ? 'compressed' : 'direct';
    
    onProgress({
      phase: 'writing',
      progress: 25,
      message: `Writing ${transferMode} image to ${storageName}...`,
      timestamp: '',
      deviceId,
      transferSpeed: '0 MB/s'
    });

    try {
      // For compressed images, we need to decompress on-the-fly during write
      if (isCompressed) {
        await this.writeCompressedImage(imagePath, storageName, onProgress, deviceId);
      } else {
        await this.writeDirectImage(imagePath, storageName, onProgress, deviceId);
      }
      
      const duration = Math.round((Date.now() - startTime) / 1000);
      const speed = (imageSize / (1024 * 1024) / duration).toFixed(1);
      
      onProgress({
        phase: 'writing',
        progress: 80,
        message: `Image successfully written to ${storageName}`,
        timestamp: '',
        deviceId,
        transferSpeed: `${speed} MB/s avg`
      });

      console.log(`✅ Image written to ${storageName} successfully in ${duration}s (${speed} MB/s)`);
      
    } catch (error) {
      console.error(`❌ Optimized write failed: ${error}`);
      throw error;
    }
  }

  /**
   * Write compressed image with on-the-fly decompression
   */
  private async writeCompressedImage(
    compressedPath: string,
    storageName: string,
    onProgress: (progress: FlashProgress) => void,
    deviceId: string
  ): Promise<void> {
    console.log(`📤 Writing compressed image with streaming decompression`);
    
    // Create temporary uncompressed file for writing
    const tempPath = compressedPath.replace('.gz', '.tmp');
    
    try {
      // Decompress to temporary file
      await new Promise<void>((resolve, reject) => {
        const readStream = require('fs').createReadStream(compressedPath);
        const writeStream = require('fs').createWriteStream(tempPath);
        const gunzip = zlib.createGunzip();
        
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
        gunzip.on('error', reject);
        readStream.on('error', reject);

        readStream.pipe(gunzip).pipe(writeStream);
      });

      // Write decompressed file
      await this.writeDirectImage(tempPath, storageName, onProgress, deviceId);
      
    } finally {
      // Clean up temporary file
      try {
        await fs.unlink(tempPath);
      } catch (error) {
        console.warn(`⚠️ Failed to clean up temp file: ${error}`);
      }
    }
  }

  /**
   * Direct image write (uncompressed)
   */
  private async writeDirectImage(
    imagePath: string,
    storageName: string,
    onProgress: (progress: FlashProgress) => void,
    deviceId: string
  ): Promise<void> {
    console.log(`📤 Direct write to ${storageName}: ${imagePath}`);
    
    const startTime = Date.now();
    
    // Enhanced timeout for large images (up to 10 minutes)
    const timeout = 600000; // 10 minutes
    
    await this.execWithTimeout(`${this.rkdeveloptoolPath} wl 0 "${imagePath}"`, timeout);
    
    const duration = Math.round((Date.now() - startTime) / 1000);
    console.log(`✅ Direct write completed in ${duration}s`);
  }

  /**
   * Get flash job status
   */
  getFlashJob(flashJobId: string): FlashJob | undefined {
    return this.activeFlashJobs.get(flashJobId);
  }

  /**
   * Get all flash jobs
   */
  getAllFlashJobs(): FlashJob[] {
    return Array.from(this.activeFlashJobs.values());
  }

  /**
   * Check if rkdeveloptool is available
   */
  async isAvailable(): Promise<boolean> {
    try {
      await fs.access(this.rkdeveloptoolPath);
      await fs.access(this.loaderPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get hardware flashing capabilities
   */
  async getCapabilities(): Promise<{
    available: boolean;
    toolPath: string;
    supportedChips: string[];
    connectedDevices: RockchipDevice[];
  }> {
    const available = await this.isAvailable();
    const connectedDevices = available ? await this.detectDevices() : [];

    return {
      available,
      toolPath: this.rkdeveloptoolPath,
      supportedChips: ['RK3588', 'RK3566', 'RK3568', 'RK3399'], // Common Rockchip chips
      connectedDevices
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private formatBytes(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
} 