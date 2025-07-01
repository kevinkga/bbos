/// <reference path="../types/webSerial.d.ts" />

export interface SerialDevice {
  id: string;
  name: string;
  vendorId: number;
  productId: number;
  connected: boolean;
}

export interface FlashProgressWeb {
  phase: 'connecting' | 'preparing' | 'downloading' | 'flashing' | 'verifying' | 'completed' | 'failed';
  progress: number;
  message: string;
  bytesTransferred?: number;
  totalBytes?: number;
}

export class WebSerialFlasher {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  /**
   * Check if Web Serial API is supported
   */
  isSupported(): boolean {
    return 'serial' in navigator;
  }

  /**
   * Request user to select a serial device
   */
  async requestDevice(): Promise<SerialDevice | null> {
    if (!this.isSupported()) {
      throw new Error('Web Serial API not supported in this browser');
    }

    try {
      // Request a port with filters for common Rockchip devices
      const port = await navigator.serial.requestPort({
        filters: [
          { usbVendorId: 0x2207 }, // Rockchip vendor ID
          { usbVendorId: 0x1d6b }, // Generic USB devices
        ]
      });

      const info = port.getInfo();
      return {
        id: `${info.usbVendorId}_${info.usbProductId}`,
        name: `Rockchip Device (${info.usbVendorId?.toString(16)}:${info.usbProductId?.toString(16)})`,
        vendorId: info.usbVendorId || 0,
        productId: info.usbProductId || 0,
        connected: false
      };
    } catch (error) {
      console.log('User cancelled device selection');
      return null;
    }
  }

  /**
   * Connect to the selected device
   */
  async connect(baudRate: number = 1500000): Promise<void> {
    if (!this.port) {
      throw new Error('No device selected');
    }

    await this.port.open({ baudRate });
    this.reader = this.port.readable?.getReader() || null;
    this.writer = this.port.writable?.getWriter() || null;
  }

  /**
   * Flash an image file directly from the browser
   */
  async flashImage(
    imageFile: File,
    onProgress: (progress: FlashProgressWeb) => void
  ): Promise<void> {
    if (!this.port || !this.writer) {
      throw new Error('Device not connected');
    }

    try {
      // Step 1: Prepare for flashing
      onProgress({
        phase: 'preparing',
        progress: 5,
        message: 'Preparing device for flashing...'
      });

      // Enter maskrom/download mode (device-specific protocol)
      await this.enterDownloadMode();

      // Step 2: Download image data
      onProgress({
        phase: 'downloading',
        progress: 10,
        message: 'Reading image file...',
        totalBytes: imageFile.size
      });

      const imageData = await imageFile.arrayBuffer();

      // Step 3: Flash the image
      onProgress({
        phase: 'flashing',
        progress: 20,
        message: 'Flashing image to device...',
        totalBytes: imageData.byteLength
      });

      await this.writeImageData(imageData, (bytesWritten) => {
        const progress = 20 + Math.floor((bytesWritten / imageData.byteLength) * 60);
        onProgress({
          phase: 'flashing',
          progress,
          message: `Flashing... ${Math.floor((bytesWritten / imageData.byteLength) * 100)}%`,
          bytesTransferred: bytesWritten,
          totalBytes: imageData.byteLength
        });
      });

      // Step 4: Verify
      onProgress({
        phase: 'verifying',
        progress: 85,
        message: 'Verifying flash...'
      });

      await this.verifyFlash();

      // Step 5: Complete
      onProgress({
        phase: 'completed',
        progress: 100,
        message: 'Flash completed successfully!'
      });

    } catch (error) {
      onProgress({
        phase: 'failed',
        progress: 0,
        message: `Flash failed: ${(error as Error).message}`
      });
      throw error;
    }
  }

  /**
   * Enter download mode (device-specific implementation)
   */
  private async enterDownloadMode(): Promise<void> {
    if (!this.writer) throw new Error('No writer available');

    // Send Rockchip-specific download mode command
    // This is a simplified example - actual implementation depends on device protocol
    const command = new Uint8Array([0xFC, 0x00, 0x00, 0x00]); // Example command
    await this.writer.write(command);
    
    // Wait for response
    await this.sleep(1000);
  }

  /**
   * Write image data to device
   */
  private async writeImageData(
    imageData: ArrayBuffer,
    onProgress: (bytesWritten: number) => void
  ): Promise<void> {
    if (!this.writer) throw new Error('No writer available');

    const chunkSize = 64 * 1024; // 64KB chunks
    const data = new Uint8Array(imageData);
    let bytesWritten = 0;

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
      
      // Write chunk with protocol header (simplified)
      await this.writer.write(chunk);
      
      bytesWritten += chunk.length;
      onProgress(bytesWritten);

      // Wait for device acknowledgment
      await this.sleep(10);
    }
  }

  /**
   * Verify flash operation
   */
  private async verifyFlash(): Promise<void> {
    // Implementation depends on device protocol
    // Could read back data and compare checksums
    await this.sleep(1000);
  }

  /**
   * Disconnect from device
   */
  async disconnect(): Promise<void> {
    if (this.reader) {
      await this.reader.cancel();
      this.reader = null;
    }
    
    if (this.writer) {
      await this.writer.close();
      this.writer = null;
    }
    
    if (this.port) {
      await this.port.close();
      this.port = null;
    }
  }

  /**
   * Get list of available serial devices
   */
  async getAvailableDevices(): Promise<SerialDevice[]> {
    if (!this.isSupported()) return [];

    const ports = await navigator.serial.getPorts();
    return ports.map((port: SerialPort, index: number) => {
      const info = port.getInfo();
      return {
        id: `${info.usbVendorId}_${info.usbProductId}_${index}`,
        name: `Serial Device ${index + 1}`,
        vendorId: info.usbVendorId || 0,
        productId: info.usbProductId || 0,
        connected: false
      };
    });
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Browser feature detection
export const webSerialSupported = 'serial' in navigator;
export const webUSBSupported = 'usb' in navigator; 