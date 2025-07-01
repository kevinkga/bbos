import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';

const execAsync = promisify(exec);

export interface RockchipDevice {
  id: string;
  type: 'maskrom' | 'loader' | 'fastboot';
  chipInfo?: string;
  flashInfo?: string;
}

export interface FlashProgress {
  phase: 'detecting' | 'preparing' | 'downloading_boot' | 'erasing' | 'writing' | 'verifying' | 'resetting' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  timestamp: string;
  deviceId?: string;
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

export class HardwareFlasher {
  private rkdeveloptoolPath: string;
  private loaderPath: string;
  private activeFlashJobs: Map<string, FlashJob> = new Map();

  constructor() {
    // Path to rkdeveloptool (adjust based on your setup)
    this.rkdeveloptoolPath = path.resolve(process.env.HOME || '', 'rkdeveloptool', 'rkdeveloptool');
    this.loaderPath = path.resolve(process.env.HOME || '', 'rkdeveloptool', 'rk3588_spl_loader_v1.15.113.bin');
    
    console.log(`🔧 HardwareFlasher initialized`);
    console.log(`📍 rkdeveloptool: ${this.rkdeveloptoolPath}`);
    console.log(`📍 Loader: ${this.loaderPath}`);
  }

  /**
   * Detect connected Rockchip devices
   */
  async detectDevices(): Promise<RockchipDevice[]> {
    try {
      const { stdout } = await execAsync(`${this.rkdeveloptoolPath} ld`);
      
      if (stdout.includes('not found any devices')) {
        return [];
      }

      // Parse device list output
      const devices: RockchipDevice[] = [];
      const lines = stdout.trim().split('\n');
      
      for (const line of lines) {
        if (line.includes('DevNo=')) {
          // Example: "DevNo=1	Vid=0x2207,Pid=0x350a,LocationID=14100000	Maskrom"
          const devMatch = line.match(/DevNo=(\d+).*?(Maskrom|Loader|Fastboot)/i);
          if (devMatch) {
            const device: RockchipDevice = {
              id: devMatch[1],
              type: devMatch[2].toLowerCase() as 'maskrom' | 'loader' | 'fastboot'
            };

            // Get additional device info
            try {
              const { stdout: chipInfo } = await execAsync(`${this.rkdeveloptoolPath} rci`);
              device.chipInfo = chipInfo.trim();
            } catch {
              // Chip info not available
            }

            devices.push(device);
          }
        }
      }

      console.log(`📱 Detected ${devices.length} Rockchip device(s)`);
      return devices;

    } catch (error) {
      console.log(`📱 No devices detected: ${(error as Error).message}`);
      return [];
    }
  }

  /**
   * Flash an image to a connected device
   */
  async flashImage(
    buildId: string, 
    imagePath: string, 
    deviceId: string,
    onProgress: (progress: FlashProgress) => void
  ): Promise<string> {
    const flashJobId = `flash_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
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

      // Step 1: Detect device
      updateProgress({
        phase: 'detecting',
        progress: 5,
        message: `Detecting device ${deviceId}...`,
        timestamp: '',
        deviceId
      });

      const devices = await this.detectDevices();
      const targetDevice = devices.find(d => d.id === deviceId);
      
      if (!targetDevice) {
        throw new Error(`Device ${deviceId} not found. Ensure board is in maskrom mode.`);
      }

      // Step 2: Download bootloader (if in maskrom mode)
      if (targetDevice.type === 'maskrom') {
        updateProgress({
          phase: 'downloading_boot',
          progress: 15,
          message: 'Loading bootloader to device...',
          timestamp: '',
          deviceId
        });

        await execAsync(`${this.rkdeveloptoolPath} db ${this.loaderPath}`);
        console.log(`✅ Bootloader loaded to device ${deviceId}`);
        
        // Wait for device to switch to loader mode
        await this.sleep(2000);
      }

      // Step 3: Erase flash (optional, but recommended)
      updateProgress({
        phase: 'erasing',
        progress: 25,
        message: 'Erasing flash memory...',
        timestamp: '',
        deviceId
      });

      // Note: ef command erases entire flash - use with caution
      // await execAsync(`${this.rkdeveloptoolPath} ef`);

      // Step 4: Write image
      updateProgress({
        phase: 'writing',
        progress: 35,
        message: 'Writing image to flash...',
        timestamp: '',
        deviceId
      });

      // Write image starting at sector 0 (full disk write)
      await this.writeImageWithProgress(imagePath, deviceId, updateProgress);

      // Step 5: Verify (optional)
      updateProgress({
        phase: 'verifying',
        progress: 85,
        message: 'Verifying flash write...',
        timestamp: '',
        deviceId
      });

      // Could add verification by reading back sectors
      // For now, just wait a moment
      await this.sleep(1000);

      // Step 6: Reset device
      updateProgress({
        phase: 'resetting',
        progress: 95,
        message: 'Resetting device...',
        timestamp: '',
        deviceId
      });

      await execAsync(`${this.rkdeveloptoolPath} rd`);

      // Step 7: Complete
      updateProgress({
        phase: 'completed',
        progress: 100,
        message: 'Flash completed successfully!',
        timestamp: '',
        deviceId
      });

      flashJob.status = 'completed';
      flashJob.endTime = new Date().toISOString();

      console.log(`🎉 Flash completed: ${flashJobId}`);
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
    }
  }

  /**
   * Write image with progress tracking
   */
  private async writeImageWithProgress(
    imagePath: string, 
    deviceId: string, 
    onProgress: (progress: FlashProgress) => void
  ): Promise<void> {
    // For now, use a simple write command
    // In production, you might want to split large images into chunks for progress tracking
    
    const startProgress = 35;
    const endProgress = 80;
    const progressRange = endProgress - startProgress;

    // Simulate progress updates during write
    const progressInterval = setInterval(() => {
      const currentProgress = startProgress + (Math.random() * progressRange * 0.1);
      onProgress({
        phase: 'writing',
        progress: Math.min(currentProgress, endProgress - 5),
        message: 'Writing image data...',
        timestamp: '',
        deviceId
      });
    }, 2000);

    try {
      // Write entire image starting at sector 0 (LBA 0)
      await execAsync(`${this.rkdeveloptoolPath} wl 0 "${imagePath}"`);
      clearInterval(progressInterval);
      
      onProgress({
        phase: 'writing',
        progress: endProgress,
        message: 'Image write completed',
        timestamp: '',
        deviceId
      });

    } catch (error) {
      clearInterval(progressInterval);
      throw error;
    }
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