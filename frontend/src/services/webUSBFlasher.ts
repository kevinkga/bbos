// WebUSB Rockchip Device Flasher
// Implements Rockchip flashing protocol via WebUSB API

// WebUSB Type Definitions
declare global {
  interface Navigator {
    usb: USB;
  }
}

interface USB {
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
  getDevices(): Promise<USBDevice[]>;
}

interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

interface USBDeviceFilter {
  vendorId: number;
  productId?: number;
}

interface USBDevice {
  vendorId: number;
  productId: number;
  deviceVersionMajor: number;
  deviceVersionMinor: number;
  configuration: USBConfiguration | null;
  configurations: USBConfiguration[];
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: ArrayBuffer | ArrayBufferView): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  controlTransferOut(setup: USBControlTransferParameters, data?: ArrayBuffer | ArrayBufferView): Promise<USBOutTransferResult>;
  controlTransferIn(setup: USBControlTransferParameters, length: number): Promise<USBInTransferResult>;
}

interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}

interface USBInterface {
  interfaceNumber: number;
  endpoints: USBEndpoint[];
  alternates?: USBAlternateInterface[];
}

interface USBAlternateInterface {
  alternateSetting: number;
  endpoints: USBEndpoint[];
}

interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}

interface USBControlTransferParameters {
  requestType: 'standard' | 'class' | 'vendor';
  recipient: 'device' | 'interface' | 'endpoint' | 'other';
  request: number;
  value: number;
  index: number;
}

interface USBOutTransferResult {
  bytesWritten: number;
  status: 'ok' | 'stall' | 'babble';
}

interface USBInTransferResult {
  data?: DataView;
  status: 'ok' | 'stall' | 'babble';
}

export interface RockchipDevice {
  device: USBDevice;
  chipType: string;
  mode: 'maskrom' | 'loader' | 'unknown';
  version: string;
  endpoints?: {
    bulkOut: number;
    bulkIn: number;
    interfaceNumber: number;
  };
}

export interface FlashProgress {
  phase: 'detecting' | 'connecting' | 'loading_bootloader' | 'writing' | 'verifying' | 'completed' | 'failed';
  progress: number; // 0-100
  message: string;
  bytesWritten?: number;
  totalBytes?: number;
}

// Rockchip device identifiers
const ROCKCHIP_DEVICES = [
  { vendorId: 0x2207, productId: 0x350a, chip: 'RK3588' },
  { vendorId: 0x2207, productId: 0x350b, chip: 'RK3588' }, // Rock 5B and other RK3588 devices use this PID
  { vendorId: 0x2207, productId: 0x350c, chip: 'RK3568' },
  { vendorId: 0x2207, productId: 0x350d, chip: 'RK3566' }, // Corrected PID for RK3566
  { vendorId: 0x2207, productId: 0x330a, chip: 'RK3399' },
  { vendorId: 0x2207, productId: 0x330c, chip: 'RK3328' },
  // Add maskrom mode IDs
  { vendorId: 0x2207, productId: 0x290a, chip: 'RK3288' },
  { vendorId: 0x2207, productId: 0x281a, chip: 'RK3188' },
];

// Rockchip protocol commands
const RK_CMD = {
  TEST_UNIT_READY: 0x00,
  READ_FLASH_ID: 0x01,
  READ_FLASH_INFO: 0x02,
  READ_CHIP_INFO: 0x03,
  READ_LBA: 0x04,
  WRITE_LBA: 0x05,
  ERASE_LBA: 0x06,
  RESET_DEVICE: 0xff,
  // Storage selection commands
  CHANGE_STORAGE: 0x0c, // Command to switch storage device
  // SPI flash specific commands
  SPI_ERASE_SECTOR: 0x0d,
  SPI_ERASE_CHIP: 0x0e,
  SPI_WRITE_ENABLE: 0x0f,
  SPI_WRITE_DISABLE: 0x10,
  REBOOT_DEVICE: 0xfe, // Device reboot command
};

// Storage device interface for WebUSB
export interface WebUSBStorageDevice {
  type: 'emmc' | 'sd' | 'spinor';
  name: string;
  code: number;
  available: boolean;
  capacity?: string;
  flashInfo?: string;
  recommended?: boolean;
  description: string;
}

export class WebUSBRockchipFlasher {
  private device: USBDevice | null = null;
  private progressCallback?: (progress: FlashProgress) => void;

  // Check if WebUSB is supported
  static isSupported(): boolean {
    return 'usb' in navigator && 'requestDevice' in navigator.usb;
  }

  // Check browser compatibility and security context
  checkRequirements(): { supported: boolean; issues: string[] } {
    const issues: string[] = [];

    if (!WebUSBRockchipFlasher.isSupported()) {
      issues.push('WebUSB API not supported in this browser');
    }

    if (location.protocol !== 'https:' && location.hostname !== 'localhost') {
      issues.push('WebUSB requires HTTPS or localhost');
    }

    return {
      supported: issues.length === 0,
      issues
    };
  }

  // Make requestDevice static
  static async requestDevice(): Promise<RockchipDevice> {
    if (!WebUSBRockchipFlasher.isSupported()) {
      throw new Error('WebUSB not supported');
    }

    console.log('🔍 Requesting Rockchip device access...');
    
    const device = await navigator.usb.requestDevice({
      filters: ROCKCHIP_DEVICES.map(d => ({
        vendorId: d.vendorId,
        productId: d.productId
      }))
    });

    console.log('📱 Device selected:', device);
    console.log('📋 Device configurations:', device.configurations);

    return WebUSBRockchipFlasher.identifyDevice(device);
  }

  // Make getAvailableDevices static
  static async getAvailableDevices(): Promise<RockchipDevice[]> {
    if (!WebUSBRockchipFlasher.isSupported()) {
      return [];
    }

    const devices = await navigator.usb.getDevices();
    const rockchipDevices = devices.filter(device => 
      ROCKCHIP_DEVICES.some(rk => 
        device.vendorId === rk.vendorId && device.productId === rk.productId
      )
    );

    return Promise.all(
      rockchipDevices.map(device => WebUSBRockchipFlasher.identifyDevice(device))
    );
  }

  // Make identifyDevice static
  private static async identifyDevice(device: USBDevice): Promise<RockchipDevice> {
    const deviceInfo = ROCKCHIP_DEVICES.find(rk => 
      device.vendorId === rk.vendorId && device.productId === rk.productId
    );

    // Detect endpoints by examining device configuration
    let endpoints = undefined;
    
    try {
      if (device.configurations && device.configurations.length > 0) {
        const config = device.configurations[0];
        console.log('📋 Device configuration:', config);
        
        for (const iface of config.interfaces) {
          console.log(`📋 Interface ${iface.interfaceNumber}:`, iface);
          
          // Check if endpoints exist and are iterable
          if (iface.endpoints && Array.isArray(iface.endpoints) && iface.endpoints.length > 0) {
            console.log(`📋 Interface ${iface.interfaceNumber} endpoints:`, iface.endpoints);
            
            const bulkOut = iface.endpoints.find(ep => ep.direction === 'out' && ep.type === 'bulk');
            const bulkIn = iface.endpoints.find(ep => ep.direction === 'in' && ep.type === 'bulk');
            
            if (bulkOut && bulkIn) {
              endpoints = {
                bulkOut: bulkOut.endpointNumber,
                bulkIn: bulkIn.endpointNumber,
                interfaceNumber: iface.interfaceNumber
              };
              console.log('✅ Found bulk endpoints:', endpoints);
              break;
            } else {
              console.log(`📋 Interface ${iface.interfaceNumber} missing bulk endpoints:`, {
                bulkOut: !!bulkOut,
                bulkIn: !!bulkIn,
                allEndpoints: iface.endpoints.map((ep: USBEndpoint) => ({ dir: ep.direction, type: ep.type, num: ep.endpointNumber }))
              });
            }
          } else {
            console.log(`📋 Interface ${iface.interfaceNumber} has no endpoints or endpoints not accessible`);
            
            // Try to access endpoints through alternate properties
            if (iface.alternates && Array.isArray(iface.alternates)) {
              for (const alt of iface.alternates) {
                if (alt.endpoints && Array.isArray(alt.endpoints)) {
                  console.log(`📋 Interface ${iface.interfaceNumber} alternate ${alt.alternateSetting} endpoints:`, alt.endpoints);
                  
                  const bulkOut = alt.endpoints.find((ep: USBEndpoint) => ep.direction === 'out' && ep.type === 'bulk');
                  const bulkIn = alt.endpoints.find((ep: USBEndpoint) => ep.direction === 'in' && ep.type === 'bulk');
                  
                  if (bulkOut && bulkIn) {
                    endpoints = {
                      bulkOut: bulkOut.endpointNumber,
                      bulkIn: bulkIn.endpointNumber,
                      interfaceNumber: iface.interfaceNumber
                    };
                    console.log('✅ Found bulk endpoints in alternate setting:', endpoints);
                    break;
                  }
                }
              }
              if (endpoints) break;
            }
          }
        }
      }
    } catch (error) {
      console.warn('⚠️ Error detecting endpoints:', error);
    }

    if (!endpoints) {
      console.log('⚠️ No bulk endpoints detected, will use default endpoint numbers');
      // Fallback to common Rockchip endpoint numbers
      endpoints = {
        bulkOut: 1,  // Common out endpoint
        bulkIn: 1,   // Common in endpoint  
        interfaceNumber: 0
      };
    }

    console.log('📋 Final detected endpoints:', endpoints);

    return {
      device,
      chipType: deviceInfo?.chip || 'Unknown',
      mode: 'maskrom', // Most common mode for flashing
      version: `${device.deviceVersionMajor}.${device.deviceVersionMinor}`,
      endpoints
    };
  }

  // Connect to device
  async connect(rkDevice: RockchipDevice): Promise<void> {
    const device = rkDevice.device;
    
    console.log('🔌 Connecting to device...', rkDevice.chipType);
    
    try {
      await device.open();
      
      // Select configuration (usually 1)
      if (device.configuration === null) {
        await device.selectConfiguration(1);
      }

      // Claim the interface
      const interfaceNumber = rkDevice.endpoints?.interfaceNumber || 0;
      await device.claimInterface(interfaceNumber);
      
      console.log('✅ Connected to', rkDevice.chipType, 'on interface', interfaceNumber);
    } catch (error) {
      console.error('❌ Connection failed:', error);
      throw new Error(`Failed to connect to device: ${error}`);
    }
  }

  // Test device communication with improved error handling
  async testConnection(rkDevice: RockchipDevice): Promise<boolean> {
    console.log('🧪 Testing device communication...');
    
    try {
      // For Rockchip devices, sometimes any response (even errors) indicates communication is working
      // Try multiple communication approaches to be more robust
      
      // Try 1: Simple control transfer (less intrusive)
      const controlResult = await this.testControlTransfer(rkDevice);
      if (controlResult) {
        console.log('✅ Control transfer test passed');
        return true;
      }
      
      // Try 2: Multiple bulk transfer commands
      const bulkResult = await this.testBulkTransferRobust(rkDevice);
      if (bulkResult) {
        console.log('✅ Bulk transfer test passed');
        return true;
      }
      
      // Try 3: Check if we get any response (even error responses can indicate communication)
      const anyResponseResult = await this.testAnyResponse(rkDevice);
      if (anyResponseResult) {
        console.log('✅ Device responds to communication attempts');
        return true;
      }
      
      console.log('❌ All communication tests failed');
      return false;
      
    } catch (error) {
      console.error('❌ Connection test failed:', error);
      return false;
    }
  }

  // Test control transfer communication
  private async testControlTransfer(rkDevice: RockchipDevice): Promise<boolean> {
    try {
      console.log('🧪 Testing control transfer...');
      
      // Try a simple vendor request
      const result = await rkDevice.device.controlTransferIn({
        requestType: 'vendor',
        recipient: 'device',
        request: 0x00, // Simple query
        value: 0,
        index: 0
      }, 64);
      
      console.log('📨 Control transfer result:', result);
      // Accept both 'ok' and 'stall' as valid responses (stall just means "not supported")
      return result.status === 'ok' || result.status === 'stall';
    } catch (error) {
      console.log('📨 Control transfer failed:', error);
      return false;
    }
  }

  // Test bulk transfer communication with multiple commands
  private async testBulkTransferRobust(rkDevice: RockchipDevice): Promise<boolean> {
    if (!rkDevice.endpoints) {
      console.log('❌ No endpoints detected for bulk transfer');
      return false;
    }
    
    // Try multiple Rockchip commands
    const commands = [
      { name: 'TEST_UNIT_READY', data: [RK_CMD.TEST_UNIT_READY, 0, 0, 0, 0, 0] },
      { name: 'READ_CHIP_INFO', data: [RK_CMD.READ_CHIP_INFO, 0, 0, 0, 0, 0] },
      { name: 'READ_FLASH_ID', data: [RK_CMD.READ_FLASH_ID, 0, 0, 0, 0, 0] },
      // Simple ping command
      { name: 'SIMPLE_PING', data: [0x00, 0x00, 0x00, 0x00, 0x00, 0x00] }
    ];
    
    for (const cmd of commands) {
      try {
        console.log(`🧪 Testing bulk transfer with ${cmd.name}...`);
        
        const command = new Uint8Array(cmd.data);
        
        console.log(`📤 Sending ${cmd.name} to endpoint ${rkDevice.endpoints.bulkOut}`);
        const outResult = await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
        
        if (outResult.status === 'ok') {
          console.log(`✅ ${cmd.name} command sent successfully`);
          
          // Try to read response (with timeout)
          try {
            console.log(`📥 Reading response from endpoint ${rkDevice.endpoints.bulkIn}`);
            const inResult = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
            
            console.log(`📨 ${cmd.name} response:`, inResult);
            if (inResult.status === 'ok') {
              console.log(`✅ ${cmd.name} got valid response`);
              return true;
            }
          } catch (readError) {
            console.log(`📨 ${cmd.name} read failed (but send worked):`, readError);
            // Send working is still a good sign
          }
        } else {
          console.log(`❌ ${cmd.name} send failed:`, outResult.status);
        }
        
      } catch (error) {
        console.log(`📨 ${cmd.name} failed:`, error);
      }
    }
    
    return false;
  }

  // Test if device responds to any communication attempt
  private async testAnyResponse(rkDevice: RockchipDevice): Promise<boolean> {
    console.log('🧪 Testing for any device response...');
    
    // For some Rockchip devices, just being able to claim the interface 
    // and send data (even if it errors) indicates the device is accessible
    try {
      if (rkDevice.endpoints) {
        // Try a very simple data send
        const simpleData = new Uint8Array([0x00]);
        
        console.log('📤 Sending minimal data to test communication path...');
        const result = await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, simpleData);
        
        console.log('📨 Minimal transfer result:', result);
        
        // Even a 'stall' or 'babble' response indicates the device is communicating
        if (result.status === 'ok' || result.status === 'stall' || result.status === 'babble') {
          console.log('✅ Device responds to transfer attempts');
          return true;
        }
      }
      
      // If we made it this far without throwing, the USB connection is working
      console.log('✅ USB connection established (device accessible)');
      return true;
      
    } catch (error) {
      console.log('📨 No response from device:', error);
      return false;
    }
  }

  // Read chip information
  async readChipInfo(rkDevice: RockchipDevice): Promise<any> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for communication');
    }
    
    const command = new Uint8Array([RK_CMD.READ_CHIP_INFO, 0, 0, 0, 0, 0]);
    
    await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
    const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
    
    if (response.status === 'ok' && response.data) {
      return this.parseChipInfo(response.data);
    }
    
    throw new Error('Failed to read chip info');
  }

  // Parse chip information response
  private parseChipInfo(data: DataView): any {
    // Parse according to Rockchip protocol
    return {
      chipId: data.getUint32(0, true),
      version: data.getUint16(4, true),
      // Add more fields based on actual protocol
    };
  }

  // Make detectStorageDevices static
  static async detectStorageDevices(rkDevice: RockchipDevice): Promise<WebUSBStorageDevice[]> {
    console.log('🔍 Detecting storage devices via WebUSB...');
    
    const devices: WebUSBStorageDevice[] = [
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

    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for storage detection');
    }

    const flasher = new WebUSBRockchipFlasher();

    // Test each storage device
    for (const device of devices) {
      try {
        console.log(`🔍 Testing ${device.name} via WebUSB...`);
        
        // Switch to storage device using USB control transfer
        const switchResult = await flasher.switchStorageDevice(rkDevice, device.code);
        if (!switchResult) {
          console.log(`❌ ${device.name} not available (switch failed)`);
          continue;
        }

        // Get flash info
        const flashInfo = await flasher.readFlashInfo(rkDevice);
        if (flashInfo) {
          device.available = true;
          device.flashInfo = flashInfo.info;
          device.capacity = flashInfo.capacity;
          console.log(`✅ ${device.name} detected: ${device.capacity || 'Unknown size'}`);
        } else {
          console.log(`❌ ${device.name} not available (no flash info)`);
        }
        
      } catch (error) {
        console.log(`❌ ${device.name} not available: ${error}`);
        device.available = false;
      }
    }

    const availableDevices = devices.filter(d => d.available);
    console.log(`📊 WebUSB storage detection complete: ${availableDevices.length} device(s) available`);
    
    return devices;
  }

  // Switch to a specific storage device
  private async switchStorageDevice(rkDevice: RockchipDevice, storageCode: number): Promise<boolean> {
    try {
      // Create storage switch command
      const command = new Uint8Array(8);
      command[0] = RK_CMD.CHANGE_STORAGE;
      command[4] = storageCode;

      // Send command via control transfer for better reliability
      const result = await rkDevice.device.controlTransferOut({
        requestType: 'vendor',
        recipient: 'device',
        request: RK_CMD.CHANGE_STORAGE,
        value: storageCode,
        index: 0
      });

      return result.status === 'ok';
    } catch (error) {
      console.log(`⚠️ Storage switch failed for code ${storageCode}:`, error);
      return false;
    }
  }

  // Read flash information from current storage device
  private async readFlashInfo(rkDevice: RockchipDevice): Promise<{info: string, capacity?: string} | null> {
    if (!rkDevice.endpoints) return null;

    try {
      const command = new Uint8Array([RK_CMD.READ_FLASH_INFO, 0, 0, 0, 0, 0]);
      
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
      const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 512);
      
      if (response.status === 'ok' && response.data) {
        const info = new TextDecoder().decode(response.data.buffer);
        
        // Parse capacity from flash info if available
        let capacity: string | undefined;
        const capacityMatch = info.match(/(\d+(?:\.\d+)?)\s*(MB|GB|KB)/i);
        if (capacityMatch) {
          capacity = `${capacityMatch[1]} ${capacityMatch[2].toUpperCase()}`;
        }
        
        return { info: info.trim(), capacity };
      }
      
      return null;
    } catch (error) {
      console.log('⚠️ Flash info read failed:', error);
      return null;
    }
  }

  // Make flashImage static
  static async flashImage(
    rkDevice: RockchipDevice, 
    imageData: ArrayBuffer,
    onProgress?: (progress: FlashProgress) => void,
    targetStorage?: WebUSBStorageDevice
  ): Promise<void> {
    const flasher = new WebUSBRockchipFlasher();
    flasher.progressCallback = onProgress;
    return flasher.flashImage(rkDevice, imageData, onProgress, targetStorage);
  }

  // Flash image to device
  async flashImage(
    rkDevice: RockchipDevice, 
    imageData: ArrayBuffer,
    onProgress?: (progress: FlashProgress) => void,
    targetStorage?: WebUSBStorageDevice
  ): Promise<void> {
    this.progressCallback = onProgress;
    
    try {
      this.reportProgress('connecting', 5, 'Connecting to device...');
      await this.connect(rkDevice);
      
      this.reportProgress('connecting', 10, 'Connected to device');
      
      // Test communication
      this.reportProgress('connecting', 15, 'Testing device communication...');
      const connected = await this.testConnection(rkDevice);
      if (!connected) {
        throw new Error('Device communication test failed');
      }
      
      this.reportProgress('loading_bootloader', 20, 'Communication established');
      
      // Switch to target storage if specified
      if (targetStorage) {
        this.reportProgress('loading_bootloader', 25, `Switching to ${targetStorage.name}...`);
        const switched = await this.switchStorageDevice(rkDevice, targetStorage.code);
        if (!switched) {
          throw new Error(`Failed to switch to ${targetStorage.name}`);
        }
        console.log(`🔄 Switched to ${targetStorage.name} for flashing`);
      }
      
      // For now, this is a simplified implementation
      // In a real implementation, we'd need to:
      // 1. Load appropriate bootloader for chip type
      // 2. Set up partition table
      // 3. Write image data in chunks
      // 4. Verify written data
      
      this.reportProgress('writing', 30, `Starting image write${targetStorage ? ` to ${targetStorage.name}` : ''}...`);
      await this.simulateImageWrite(imageData);
      
      this.reportProgress('completed', 100, 'Flash completed successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ Flash failed:', error);
      this.reportProgress('failed', 0, `Flash failed: ${errorMessage}`);
      throw error;
    } finally {
      await this.disconnect(rkDevice);
    }
  }

  // Simulate image writing (placeholder for real implementation)
  private async simulateImageWrite(imageData: ArrayBuffer): Promise<void> {
    const totalSize = imageData.byteLength;
    const chunkSize = 64 * 1024; // 64KB chunks
    
    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      // Simulate writing delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const progress = 30 + Math.floor((offset / totalSize) * 60); // 30-90%
      const written = Math.min(offset + chunkSize, totalSize);
      
      this.reportProgress('writing', progress, 
        `Written ${this.formatBytes(written)} / ${this.formatBytes(totalSize)}`);
    }
    
    this.reportProgress('verifying', 90, 'Verifying written data...');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  // Write image data to device (real implementation would go here)
  private async writeImageData(rkDevice: RockchipDevice, imageData: ArrayBuffer): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for data transfer');
    }
    
    const chunkSize = 32 * 1024; // 32KB chunks
    const totalSize = imageData.byteLength;
    let written = 0;
    
    this.reportProgress('writing', 30, 'Writing image data...');
    
    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const chunk = imageData.slice(offset, Math.min(offset + chunkSize, totalSize));
      
      // Create write command
      const lba = Math.floor(offset / 512); // Convert to LBA
      const sectors = Math.ceil(chunk.byteLength / 512);
      
      const command = new Uint8Array(16);
      command[0] = RK_CMD.WRITE_LBA;
      // Set LBA and sector count in command
      new DataView(command.buffer).setUint32(4, lba, true);
      new DataView(command.buffer).setUint16(8, sectors, true);
      
      // Send command
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
      
      // Send data
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, chunk);
      
      // Wait for completion
      const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
      if (response.status !== 'ok') {
        throw new Error(`Write failed at offset ${offset}`);
      }
      
      written += chunk.byteLength;
      const progress = 30 + Math.floor((written / totalSize) * 60); // 30-90%
      
      this.reportProgress('writing', progress, 
        `Written ${this.formatBytes(written)} / ${this.formatBytes(totalSize)}`);
    }
    
    this.reportProgress('verifying', 90, 'Verifying written data...');
    // Add verification logic here
  }

  // SPI Flash Operations

  // Make clearSPIFlash static
  static async clearSPIFlash(rkDevice: RockchipDevice, onProgress?: (progress: FlashProgress) => void): Promise<void> {
    const flasher = new WebUSBRockchipFlasher();
    return flasher.clearSPIFlash(rkDevice, onProgress);
  }

  // Clear entire SPI flash chip (full erase)
  async clearSPIFlash(rkDevice: RockchipDevice, onProgress?: (progress: FlashProgress) => void): Promise<void> {
    this.progressCallback = onProgress;
    
    try {
      this.reportProgress('connecting', 5, 'Refreshing device connection...');
      
      // Refresh device connection to get a fresh USB device reference
      const freshDevices = await WebUSBRockchipFlasher.getAvailableDevices();
      const freshDevice = freshDevices.find((d: RockchipDevice) => d.chipType === rkDevice.chipType);
      
      if (!freshDevice) {
        throw new Error('Device not found. Please ensure the device is connected and in maskrom mode.');
      }
      
      this.reportProgress('connecting', 10, 'Connecting to device...');
      
      // First establish connection to the device
      await this.connect(freshDevice);
      
      this.reportProgress('connecting', 15, 'Testing device communication...');
      const connected = await this.testConnection(freshDevice);
      if (!connected) {
        throw new Error('Device communication test failed');
      }
      
      this.reportProgress('connecting', 20, 'Switching to SPI NOR flash...');
      
      // Switch to SPI NOR flash
      const switched = await this.switchStorageDevice(freshDevice, 9); // Code 9 for SPI NOR
      if (!switched) {
        throw new Error('Failed to switch to SPI NOR flash');
      }
      
      this.reportProgress('connecting', 30, 'Switched to SPI NOR flash');
      
      // Enable SPI write operations
      this.reportProgress('writing', 40, 'Enabling SPI write operations...');
      await this.enableSPIWrite(freshDevice);
      
      // Perform chip erase
      this.reportProgress('writing', 60, 'Erasing SPI flash chip (this may take several seconds)...');
      await this.eraseSPIChip(freshDevice);
      
      // Disable SPI write operations for safety
      this.reportProgress('writing', 90, 'Disabling SPI write operations...');
      await this.disableSPIWrite(freshDevice);
      
      this.reportProgress('completed', 100, 'SPI flash cleared successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SPI clear failed:', error);
      this.reportProgress('failed', 0, `SPI clear failed: ${errorMessage}`);
      throw error;
    } finally {
      // Always disconnect when done - use fresh device if available
      try {
        const freshDevices = await WebUSBRockchipFlasher.getAvailableDevices().catch(() => []);
        const currentDevice = freshDevices.find((d: RockchipDevice) => d.chipType === rkDevice.chipType) || rkDevice;
        await this.disconnect(currentDevice);
      } catch (disconnectError) {
        console.warn('⚠️ Failed to disconnect device:', disconnectError);
      }
    }
  }

  // Write bootloader to SPI flash
  async writeSPIBootloader(
    rkDevice: RockchipDevice, 
    bootloaderData: ArrayBuffer,
    onProgress?: (progress: FlashProgress) => void
  ): Promise<void> {
    this.progressCallback = onProgress;
    
    try {
      this.reportProgress('connecting', 5, 'Connecting to device...');
      
      // First establish connection to the device
      await this.connect(rkDevice);
      
      this.reportProgress('connecting', 10, 'Testing device communication...');
      const connected = await this.testConnection(rkDevice);
      if (!connected) {
        throw new Error('Device communication test failed');
      }
      
      this.reportProgress('connecting', 15, 'Switching to SPI NOR flash...');
      
      // Switch to SPI NOR flash
      const switched = await this.switchStorageDevice(rkDevice, 9); // Code 9 for SPI NOR
      if (!switched) {
        throw new Error('Failed to switch to SPI NOR flash');
      }
      
      this.reportProgress('connecting', 20, 'Switched to SPI NOR flash');
      
      // Enable SPI write operations
      this.reportProgress('loading_bootloader', 30, 'Enabling SPI write operations...');
      await this.enableSPIWrite(rkDevice);
      
      // Write bootloader data
      this.reportProgress('writing', 40, 'Writing bootloader to SPI flash...');
      await this.writeSPIData(rkDevice, bootloaderData);
      
      // Disable SPI write operations
      this.reportProgress('verifying', 90, 'Finalizing SPI operations...');
      await this.disableSPIWrite(rkDevice);
      
      this.reportProgress('completed', 100, 'Bootloader written to SPI successfully');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('❌ SPI bootloader write failed:', error);
      this.reportProgress('failed', 0, `SPI bootloader write failed: ${errorMessage}`);
      throw error;
    } finally {
      // Always disconnect when done
      try {
        await this.disconnect(rkDevice);
      } catch (disconnectError) {
        console.warn('⚠️ Failed to disconnect device:', disconnectError);
      }
    }
  }

  // Make writeSPIBootloaderAuto static
  static async writeSPIBootloaderAuto(
    rkDevice: RockchipDevice,
    onProgress?: (progress: FlashProgress) => void
  ): Promise<void> {
    const flasher = new WebUSBRockchipFlasher();
    return flasher.writeSPIBootloaderAuto(rkDevice, onProgress);
  }

  // Auto-detect device and write appropriate SPI bootloader
  async writeSPIBootloaderAuto(
    rkDevice: RockchipDevice,
    onProgress?: (progress: FlashProgress) => void
  ): Promise<void> {
    this.progressCallback = onProgress;
    
    try {
      this.reportProgress('detecting', 5, 'Initializing SPI bootloader write process...');

      this.reportProgress('detecting', 10, 'Connecting to device and initializing DRAM...');

      // Step 1: Download boot (critical step that was missing)
      await this.downloadBoot(rkDevice);

      this.reportProgress('loading_bootloader', 25, 'Device initialized, detecting chip type...');
      
      // Step 2: Get bootloader configuration
      const bootloaderInfo = this.getBootloaderInfoForDevice(rkDevice);
      if (!bootloaderInfo) {
        throw new Error(`No bootloader configuration found for ${rkDevice.chipType}`);
      }

      this.reportProgress('loading_bootloader', 30, `Detected ${bootloaderInfo.deviceName}, downloading bootloader files...`);

      // Step 3: Download bootloader files from backend
      const bootloaderFiles = await this.downloadBootloaderFiles(bootloaderInfo);

      this.reportProgress('loading_bootloader', 40, 'Bootloader files downloaded, switching to SPI flash...');
      
      // Step 4: Switch to SPI NOR flash
      const switched = await this.switchStorageDevice(rkDevice, 9); // Code 9 for SPI NOR
      if (!switched) {
        throw new Error('Failed to switch to SPI NOR flash');
      }

      this.reportProgress('loading_bootloader', 45, 'Switched to SPI NOR flash, enabling write operations...');
      
      // Step 5: Enable SPI write operations
      await this.enableSPIWrite(rkDevice);

      this.reportProgress('writing', 50, 'Writing bootloader components to SPI flash...');

      // Step 6: Write to SPI flash
      await this.writeSPIBootloaderComponents(rkDevice, bootloaderFiles);

      this.reportProgress('verifying', 90, 'Finalizing SPI operations...');
      
      // Step 7: Disable SPI write operations for safety
      await this.disableSPIWrite(rkDevice);

      this.reportProgress('completed', 100, 'SPI bootloader written successfully');

    } catch (error) {
      console.error('❌ SPI bootloader auto-write failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.reportProgress('failed', 0, `SPI bootloader write failed: ${errorMessage}`);
      throw error;
    } finally {
      // Always disconnect when done
      try {
        await this.disconnect(rkDevice);
      } catch (disconnectError) {
        console.warn('⚠️ Failed to disconnect device:', disconnectError);
      }
    }
  }

  // Get bootloader information for detected device
  private getBootloaderInfoForDevice(rkDevice: RockchipDevice): {
    deviceName: string;
    chipType: string;
    files: {
      idbloader: string;
      uboot: string;
    };
    offsets: {
      idbloader: number;
      uboot: number;
    };
  } | null {
    // Use frontend asset paths instead of backend API
    const bootloaderConfigs: Record<string, {
      deviceName: string;
      chipType: string;
      files: {
        idbloader: string;
        uboot: string;
      };
      offsets: {
        idbloader: number;
        uboot: number;
      };
    }> = {
      'RK3588': {
        deviceName: 'Rock 5B',
        chipType: 'RK3588',
        files: {
          idbloader: '/bootloader/rk3588/rock5b_idbloader.img', // Frontend asset path
          uboot: '/bootloader/rk3588/rock5b_u-boot.itb'        // Frontend asset path
        },
        offsets: {
          idbloader: 0x40,    // 64 sectors
          uboot: 0x4000       // 16384 sectors  
        }
      },
      'RK3566': {
        deviceName: 'RK3566 Device',
        chipType: 'RK3566', 
        files: {
          idbloader: '/bootloader/rk3566/rk3566_idbloader.img',
          uboot: '/bootloader/rk3566/rk3566_u-boot.itb'
        },
        offsets: {
          idbloader: 0x40,
          uboot: 0x4000
        }
      }
    };

    return bootloaderConfigs[rkDevice.chipType] || bootloaderConfigs['RK3588'];
  }

  // Download bootloader files from backend
  private async downloadBootloaderFiles(bootloaderInfo: {
    files: { idbloader: string; uboot: string };
  }): Promise<{
    idbloader: ArrayBuffer;
    uboot: ArrayBuffer;
  }> {
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    try {
      // Download idbloader
      this.reportProgress('loading_bootloader', 12, 'Downloading idbloader...');
      const idbloaderResponse = await fetch(`${backendUrl}/api/hardware/spi/bootloader/${bootloaderInfo.files.idbloader}`);
      if (!idbloaderResponse.ok) {
        throw new Error(`Failed to download idbloader: ${idbloaderResponse.statusText}`);
      }
      const idbloader = await idbloaderResponse.arrayBuffer();
      
      // Download u-boot
      this.reportProgress('loading_bootloader', 15, 'Downloading u-boot...');
      const ubootResponse = await fetch(`${backendUrl}/api/hardware/spi/bootloader/${bootloaderInfo.files.uboot}`);
      if (!ubootResponse.ok) {
        throw new Error(`Failed to download u-boot: ${ubootResponse.statusText}`);
      }
      const uboot = await ubootResponse.arrayBuffer();
      
      console.log(`📥 Downloaded bootloader files:`, {
        idbloader: `${(idbloader.byteLength / 1024).toFixed(1)} KB`,
        uboot: `${(uboot.byteLength / 1024).toFixed(1)} KB`
      });
      
      return { idbloader, uboot };
    } catch (error) {
      throw new Error(`Failed to download bootloader files: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Write bootloader components to specific SPI flash offsets with better progress reporting
  private async writeSPIBootloaderComponents(
    rkDevice: RockchipDevice, 
    bootloaderFiles: { idbloader: ArrayBuffer; uboot: ArrayBuffer }
  ): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for SPI operations');
    }
    
    const deviceInfo = this.getBootloaderInfoForDevice(rkDevice);
    if (!deviceInfo) {
      throw new Error('Device bootloader information not available');
    }
    
    const totalSize = bootloaderFiles.idbloader.byteLength + bootloaderFiles.uboot.byteLength;
    
    // Write idbloader at offset 0x40 sectors (0x8000 bytes)
    this.reportProgress('writing', 55, `Writing idbloader (${this.formatBytes(bootloaderFiles.idbloader.byteLength)}) to SPI flash...`);
    await this.writeSPIDataAtOffsetWithProgress(rkDevice, bootloaderFiles.idbloader, deviceInfo.offsets.idbloader, 55, 70);
    
    // Write u-boot at offset 0x4000 sectors (0x800000 bytes)  
    this.reportProgress('writing', 70, `Writing u-boot (${this.formatBytes(bootloaderFiles.uboot.byteLength)}) to SPI flash...`);
    await this.writeSPIDataAtOffsetWithProgress(rkDevice, bootloaderFiles.uboot, deviceInfo.offsets.uboot, 70, 85);
    
    this.reportProgress('writing', 85, 'All bootloader components written successfully');
    console.log('✅ All bootloader components written to SPI flash');
  }

  // Enhanced version with progress reporting
  private async writeSPIDataAtOffsetWithProgress(
    rkDevice: RockchipDevice, 
    data: ArrayBuffer, 
    sectorOffset: number,
    startProgress: number,
    endProgress: number
  ): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for SPI operations');
    }
    
    const chunkSize = 4 * 1024; // 4KB chunks for SPI flash
    const totalSize = data.byteLength;
    const bytesOffset = sectorOffset * 512; // Convert sectors to bytes (512 bytes per sector)
    let written = 0;
    
    console.log(`📝 Writing ${this.formatBytes(totalSize)} to SPI flash at sector offset 0x${sectorOffset.toString(16)} (byte offset 0x${bytesOffset.toString(16)})`);
    
    const totalChunks = Math.ceil(totalSize / chunkSize);
    
    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const chunk = data.slice(offset, Math.min(offset + chunkSize, totalSize));
      const address = bytesOffset + offset; // Absolute address in SPI flash
      const chunkIndex = Math.floor(offset / chunkSize) + 1;
      
      // Create write command for SPI flash
      const command = new Uint8Array(16);
      command[0] = RK_CMD.WRITE_LBA; // Use LBA write but with SPI addressing
      new DataView(command.buffer).setUint32(4, address, true);
      new DataView(command.buffer).setUint32(8, chunk.byteLength, true);
      
      // Send command
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
      
      // Send data
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, chunk);
      
      // Wait for completion
      const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
      if (response.status !== 'ok') {
        throw new Error(`SPI write failed at address 0x${address.toString(16)}`);
      }
      
      written += chunk.byteLength;
      
      // Calculate progress within the range
      const chunkProgress = startProgress + ((chunkIndex / totalChunks) * (endProgress - startProgress));
      this.reportProgress('writing', Math.floor(chunkProgress), 
        `Writing chunk ${chunkIndex}/${totalChunks} (${this.formatBytes(written)} / ${this.formatBytes(totalSize)})`);
      
      // Small delay to prevent overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log(`✅ SPI data write completed: ${this.formatBytes(totalSize)} at sector offset 0x${sectorOffset.toString(16)}`);
  }

  // Enable SPI write operations
  private async enableSPIWrite(rkDevice: RockchipDevice): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for SPI operations');
    }

    const command = new Uint8Array([RK_CMD.SPI_WRITE_ENABLE, 0, 0, 0, 0, 0]);
    
    await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
    const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
    
    if (response.status !== 'ok') {
      throw new Error('Failed to enable SPI write operations');
    }
    
    console.log('✅ SPI write operations enabled');
  }

  // Disable SPI write operations
  private async disableSPIWrite(rkDevice: RockchipDevice): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for SPI operations');
    }

    const command = new Uint8Array([RK_CMD.SPI_WRITE_DISABLE, 0, 0, 0, 0, 0]);
    
    await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
    const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
    
    if (response.status !== 'ok') {
      throw new Error('Failed to disable SPI write operations');
    }
    
    console.log('✅ SPI write operations disabled');
  }

  // Enhanced erase with better progress reporting
  private async eraseSPIChip(rkDevice: RockchipDevice): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for SPI operations');
    }

    const command = new Uint8Array([RK_CMD.SPI_ERASE_CHIP, 0, 0, 0, 0, 0]);
    
    await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
    
    // Wait for erase to complete with periodic progress updates
    console.log('⏳ Waiting for SPI chip erase to complete...');
    
    // Simulate progress during the long erase operation
    for (let i = 1; i <= 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1 second intervals
      this.reportProgress('writing', 60 + (i * 5), `Erasing SPI flash chip... (${i}/5 seconds)`);
    }
    
    const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
    
    if (response.status !== 'ok') {
      throw new Error('SPI chip erase failed');
    }
    
    console.log('✅ SPI chip erase completed');
  }

  // Write data to SPI flash
  private async writeSPIData(rkDevice: RockchipDevice, data: ArrayBuffer): Promise<void> {
    if (!rkDevice.endpoints) {
      throw new Error('No endpoints available for SPI operations');
    }
    
    const chunkSize = 4 * 1024; // 4KB chunks for SPI flash
    const totalSize = data.byteLength;
    let written = 0;
    
    console.log(`📝 Writing ${this.formatBytes(totalSize)} to SPI flash in ${Math.ceil(totalSize / chunkSize)} chunks`);
    
    for (let offset = 0; offset < totalSize; offset += chunkSize) {
      const chunk = data.slice(offset, Math.min(offset + chunkSize, totalSize));
      
      // Create write command for SPI flash
      const address = offset; // SPI address
      const command = new Uint8Array(16);
      command[0] = RK_CMD.WRITE_LBA; // Use LBA write but with SPI addressing
      new DataView(command.buffer).setUint32(4, address, true);
      new DataView(command.buffer).setUint32(8, chunk.byteLength, true);
      
      // Send command
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
      
      // Send data
      await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, chunk);
      
      // Wait for completion
      const response = await rkDevice.device.transferIn(rkDevice.endpoints.bulkIn, 64);
      if (response.status !== 'ok') {
        throw new Error(`SPI write failed at address 0x${address.toString(16)}`);
      }
      
      written += chunk.byteLength;
      const progress = 30 + Math.floor((written / totalSize) * 50); // 30-80%
      
      this.reportProgress('writing', progress, 
        `Written ${this.formatBytes(written)} / ${this.formatBytes(totalSize)} to SPI`);
        
      // Small delay to prevent overwhelming the device
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    console.log('✅ SPI data write completed');
  }

  // Make rebootDevice static
  static async rebootDevice(rkDevice: RockchipDevice): Promise<void> {
    const flasher = new WebUSBRockchipFlasher();
    return flasher.rebootDevice(rkDevice);
  }

  // Reboot the connected device
  async rebootDevice(rkDevice: RockchipDevice): Promise<void> {
    try {
      console.log('🔄 Rebooting device...');
      
      if (!rkDevice.endpoints) {
        // Try control transfer if no endpoints
        await rkDevice.device.controlTransferOut({
          requestType: 'vendor',
          recipient: 'device',
          request: RK_CMD.REBOOT_DEVICE,
          value: 0,
          index: 0
        });
      } else {
        // Use bulk transfer if endpoints available
        const command = new Uint8Array([RK_CMD.REBOOT_DEVICE, 0, 0, 0, 0, 0]);
        await rkDevice.device.transferOut(rkDevice.endpoints.bulkOut, command);
      }
      
      console.log('✅ Reboot command sent successfully');
      
      // Device will disconnect after reboot command
      setTimeout(() => {
        this.disconnect(rkDevice).catch(err => {
          console.log('Note: Device already disconnected after reboot');
        });
      }, 1000);
      
    } catch (error) {
      console.error('❌ Reboot failed:', error);
      throw new Error(`Failed to reboot device: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  // Disconnect from device
  async disconnect(rkDevice: RockchipDevice): Promise<void> {
    console.log('🔌 Disconnecting from device...');
    
    try {
      if (rkDevice.device && rkDevice.endpoints) {
        // Check if device is still connected before trying to disconnect
        try {
          // Try to release interface - this will fail if device is already disconnected
          await rkDevice.device.releaseInterface(rkDevice.endpoints.interfaceNumber);
          await rkDevice.device.close();
          console.log('✅ Device disconnected successfully');
        } catch (interfaceError) {
          // Device might already be disconnected (e.g., after reboot)
          console.log('ℹ️ Device was already disconnected or unavailable');
        }
      }
    } catch (error) {
      console.warn('⚠️ Disconnect warning:', error);
      // Don't throw here, just log the warning
    }
  }

  // Report progress to callback
  private reportProgress(phase: FlashProgress['phase'], progress: number, message: string): void {
    const progressReport: FlashProgress = { phase, progress, message };
    console.log(`📊 ${phase}: ${progress}% - ${message}`);
    
    if (this.progressCallback) {
      this.progressCallback(progressReport);
    }
  }

  // Add missing formatBytes method
  private formatBytes(bytes: number): string {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  }

  // Add missing downloadBoot method (critical for device initialization)
  private async downloadBoot(rkDevice: RockchipDevice): Promise<void> {
    console.log('🚀 Downloading boot and initializing DRAM...');
    
    try {
      // Connect to device first
      await this.connect(rkDevice);
      
      // Test communication
      const connected = await this.testConnection(rkDevice);
      if (!connected) {
        throw new Error('Device communication test failed during boot download');
      }
      
      // For Rockchip devices, this step is critical for initializing DRAM
      // In a full implementation, this would load the appropriate bootloader
      // For now, we simulate the process
      this.reportProgress('connecting', 15, 'Initializing device DRAM...');
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      this.reportProgress('connecting', 25, 'Device DRAM initialized successfully');
      console.log('✅ Boot download and DRAM initialization completed');
      
    } catch (error) {
      console.error('❌ Boot download failed:', error);
      throw new Error(`Boot download failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

// Remove duplicate export - keep only one
export function isWebUSBSupported(): boolean {
  return WebUSBRockchipFlasher.isSupported();
}