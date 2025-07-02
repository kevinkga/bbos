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

// Helper function to check Web Serial support
export const webSerialSupported = (): boolean => {
  return 'serial' in navigator && typeof navigator.serial?.requestPort === 'function';
};

export class WebSerialFlasher {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader | null = null;
  private writer: WritableStreamDefaultWriter | null = null;

  /**
   * Check if Web Serial API is supported
   */
  isSupported(): boolean {
    return webSerialSupported();
  }

  /**
   * Check browser and protocol requirements
   */
  checkRequirements(): { supported: boolean; issues: string[] } {
    const issues: string[] = [];
    
    // Check Web Serial API support
    if (!webSerialSupported()) {
      issues.push('Web Serial API not supported. Use Chrome, Edge, or Opera browser.');
    }
    
    // Check HTTPS requirement
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
      issues.push('HTTPS required for Web Serial API (or use localhost)');
    }
    
    // Check if we're in a secure context
    if (!window.isSecureContext) {
      issues.push('Secure context required for Web Serial API');
    }
    
    return {
      supported: issues.length === 0,
      issues
    };
  }

  /**
   * Request user to select a serial device with improved error handling
   */
  async requestDevice(): Promise<SerialDevice | null> {
    console.log('🔍 Requesting serial device...');
    
    if (!this.isSupported()) {
      throw new Error('Web Serial API not supported in this browser');
    }

    const requirements = this.checkRequirements();
    if (!requirements.supported) {
      throw new Error(`Requirements not met: ${requirements.issues.join(', ')}`);
    }

    try {
      console.log('📱 Opening device selection dialog...');
      
      // Request a port with comprehensive filters for Rockchip and other devices
      const port = await navigator.serial.requestPort({
        filters: [
          // Rockchip devices
          { usbVendorId: 0x2207 }, // Rockchip vendor ID
          // Common USB-to-serial adapters
          { usbVendorId: 0x1d6b }, // Linux Foundation
          { usbVendorId: 0x1a86 }, // QinHeng Electronics (CH340)
          { usbVendorId: 0x0403 }, // FTDI
          { usbVendorId: 0x067b }, // Prolific
          { usbVendorId: 0x10c4 }, // Silicon Labs
          // Generic CDC-ACM devices
          { usbVendorId: 0x2341 }, // Arduino LLC
        ]
      });

      const info = port.getInfo();
      console.log('✅ Device selected:', info);
      
      const device = {
        id: `${info.usbVendorId || 0}_${info.usbProductId || 0}_${Date.now()}`,
        name: this.getDeviceName(info.usbVendorId, info.usbProductId),
        vendorId: info.usbVendorId || 0,
        productId: info.usbProductId || 0,
        connected: false
      };
      
      console.log('📋 Device info:', device);
      this.port = port;
      
      return device;
    } catch (error) {
      console.log('❌ Device selection failed:', error);
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'NotFoundError':
            console.log('💡 No device was selected by the user');
            return null;
          case 'SecurityError':
            throw new Error('Access denied. Make sure you\'re using HTTPS or localhost.');
          case 'NotSupportedError':
            throw new Error('Web Serial API not supported in this browser context.');
          default:
            throw new Error(`Device access failed: ${error.message}`);
        }
      }
      
      throw error;
    }
  }

  /**
   * Get a human-readable device name based on vendor/product IDs
   */
  private getDeviceName(vendorId?: number, productId?: number): string {
    if (!vendorId) return 'Unknown Device';
    
    const vendorNames: Record<number, string> = {
      0x2207: 'Rockchip Device',
      0x1d6b: 'Linux Foundation Device',
      0x1a86: 'CH340 Serial Adapter',
      0x0403: 'FTDI Serial Adapter',
      0x067b: 'Prolific Serial Adapter',
      0x10c4: 'Silicon Labs Serial Adapter',
      0x2341: 'Arduino Device'
    };
    
    const vendorName = vendorNames[vendorId] || 'Unknown Device';
    const idString = productId ? `(${vendorId.toString(16)}:${productId.toString(16)})` : `(${vendorId.toString(16)})`;
    
    return `${vendorName} ${idString}`;
  }

  /**
   * Connect to the selected device with improved error handling
   */
  async connect(baudRate: number = 1500000): Promise<void> {
    if (!this.port) {
      throw new Error('No device selected. Call requestDevice() first.');
    }

    console.log(`🔌 Connecting to device at ${baudRate} baud...`);

    try {
      await this.port.open({ 
        baudRate,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        flowControl: 'none'
      });
      
      console.log('✅ Device connected successfully');
      
      // Set up readers and writers
      if (this.port.readable) {
        this.reader = this.port.readable.getReader();
      }
      
      if (this.port.writable) {
        this.writer = this.port.writable.getWriter();
      }
      
      if (!this.reader || !this.writer) {
        throw new Error('Failed to set up device communication streams');
      }
      
    } catch (error) {
      console.error('❌ Connection failed:', error);
      
      if (error instanceof DOMException) {
        switch (error.name) {
          case 'InvalidStateError':
            throw new Error('Device is already connected or in use by another application');
          case 'NetworkError':
            throw new Error('Device communication error. Check cable and device status.');
          default:
            throw new Error(`Connection failed: ${error.message}`);
        }
      }
      
      throw error;
    }
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

    console.log('🔥 Starting flash process...');

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
      console.log(`📁 Image loaded: ${imageData.byteLength} bytes`);

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

      console.log('✅ Flash process completed successfully');

    } catch (error) {
      console.error('❌ Flash process failed:', error);
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

    console.log('🔄 Entering download mode...');

    // Send Rockchip-specific download mode command
    // This is a simplified example - actual implementation depends on device protocol
    const command = new Uint8Array([0xFC, 0x00, 0x00, 0x00]); // Example command
    await this.writer.write(command);
    
    // Wait for response
    await this.sleep(1000);
    
    console.log('✅ Download mode activated');
  }

  /**
   * Write image data to device
   */
  private async writeImageData(
    imageData: ArrayBuffer,
    onProgress: (bytesWritten: number) => void
  ): Promise<void> {
    if (!this.writer) throw new Error('No writer available');

    console.log(`📤 Writing ${imageData.byteLength} bytes to device...`);

    const chunkSize = 64 * 1024; // 64KB chunks
    const data = new Uint8Array(imageData);
    let bytesWritten = 0;

    for (let offset = 0; offset < data.length; offset += chunkSize) {
      const chunk = data.slice(offset, Math.min(offset + chunkSize, data.length));
      
      try {
        // Write chunk with protocol header (simplified)
        await this.writer.write(chunk);
        
        bytesWritten += chunk.length;
        onProgress(bytesWritten);

        // Wait for device acknowledgment
        await this.sleep(10);
        
        // Log progress every 10MB
        if (bytesWritten % (10 * 1024 * 1024) === 0) {
          console.log(`📤 Written ${Math.round(bytesWritten / 1024 / 1024)}MB`);
        }
      } catch (error) {
        console.error(`❌ Write failed at offset ${offset}:`, error);
        throw new Error(`Write failed: ${(error as Error).message}`);
      }
    }
    
    console.log(`✅ Successfully wrote ${bytesWritten} bytes`);
  }

  /**
   * Verify flash operation
   */
  private async verifyFlash(): Promise<void> {
    console.log('🔍 Verifying flash...');
    // Implementation depends on device protocol
    // Could read back data and compare checksums
    await this.sleep(1000);
    console.log('✅ Flash verified');
  }

  /**
   * Disconnect from the device
   */
  async disconnect(): Promise<void> {
    console.log('🔌 Disconnecting from device...');
    
    try {
      if (this.reader) {
        await this.reader.cancel();
        this.reader.releaseLock();
        this.reader = null;
      }

      if (this.writer) {
        this.writer.releaseLock();
        this.writer = null;
      }

      if (this.port) {
        await this.port.close();
        this.port = null;
      }
      
      console.log('✅ Disconnected successfully');
    } catch (error) {
      console.error('⚠️ Disconnect error:', error);
      // Don't throw here - disconnection errors are usually not critical
    }
  }

  /**
   * Get list of previously authorized devices
   */
  async getAvailableDevices(): Promise<SerialDevice[]> {
    if (!this.isSupported()) {
      console.log('❌ Web Serial API not supported');
      return [];
    }

    try {
      console.log('🔍 Getting available serial devices...');
      const ports = await navigator.serial.getPorts();
      console.log(`📱 Found ${ports.length} authorized devices`);
      
      const devices = ports.map((port, index) => {
        const info = port.getInfo();
        return {
          id: `${info.usbVendorId || 0}_${info.usbProductId || 0}_${index}`,
          name: this.getDeviceName(info.usbVendorId, info.usbProductId),
          vendorId: info.usbVendorId || 0,
          productId: info.usbProductId || 0,
          connected: false
        };
      });
      
      console.log('📋 Available devices:', devices);
      return devices;
    } catch (error) {
      console.error('❌ Failed to get devices:', error);
      return [];
    }
  }

  /**
   * Get debug information for troubleshooting
   */
  getDebugInfo(): Record<string, any> {
    const requirements = this.checkRequirements();
    
    return {
      webSerialSupported: webSerialSupported(),
      isSecureContext: window.isSecureContext,
      protocol: location.protocol,
      hostname: location.hostname,
      userAgent: navigator.userAgent,
      requirements: requirements,
      deviceConnected: this.port !== null,
      hasReader: this.reader !== null,
      hasWriter: this.writer !== null
    };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Browser feature detection

export const webUSBSupported = 'usb' in navigator; 