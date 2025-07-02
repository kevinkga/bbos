/**
 * @deprecated This service has been deprecated in favor of frontend WebUSB operations.
 * SPI flash operations are now handled directly in the WebUSB flasher service
 * to prioritize frontend operations over backend ones.
 * 
 * This file will be removed in a future update.
 */

import { SPIProgressEvent, SPICompletedEvent, SPIErrorEvent, DeviceProgressEvent, DeviceCompletedEvent, DeviceErrorEvent } from '../types/index.js';

const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export interface SPICapabilities {
  available: boolean;
  supportedOperations: string[];
  supportedMethods: {
    'write-bootloader': string[];
  };
  requiredFiles: {
    loader: string;
    spiImage?: string;
    components: string[];
  };
  documentation: {
    clearSPI: string;
    writeBootloader: string;
    rebootDevice: string;
  };
}

export interface SPIOperationResponse {
  message: string;
  operationId: string;
  deviceId: string;
  method?: string;
}

export interface DeviceOperationResponse {
  message: string;
  operationId: string;
  deviceId: string;
}

class SPIFlashService {
  /**
   * Get SPI operation capabilities
   */
  async getCapabilities(): Promise<SPICapabilities> {
    const response = await fetch(`${API_BASE}/api/hardware/spi/capabilities`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to get SPI capabilities' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Clear SPI flash completely (removes old bootloaders)
   */
  async clearSPIFlash(deviceId: string): Promise<SPIOperationResponse> {
    const response = await fetch(`${API_BASE}/api/hardware/spi/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to clear SPI flash' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Write SPI bootloader for NVME boot support
   */
  async writeSPIBootloader(
    deviceId: string, 
    method: 'complete' | 'components' = 'complete'
  ): Promise<SPIOperationResponse> {
    const response = await fetch(`${API_BASE}/api/hardware/spi/write-bootloader`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId, method }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to write SPI bootloader' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Reboot connected device
   */
  async rebootDevice(deviceId: string): Promise<DeviceOperationResponse> {
    const response = await fetch(`${API_BASE}/api/hardware/device/reboot`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Failed to reboot device' }));
      throw new Error(error.error || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Check if device supports SPI operations
   */
  async checkDeviceCompatibility(deviceId: string): Promise<{ 
    compatible: boolean; 
    chipType?: string; 
    supportedOperations: string[]; 
    warnings?: string[] 
  }> {
    try {
      const capabilities = await this.getCapabilities();
      
      // For now, assume Rock 5B devices (RK3588) are compatible
      // In the future, this could check the actual device type
      return {
        compatible: capabilities.available,
        chipType: 'RK3588', // This would be determined from the actual device
        supportedOperations: capabilities.supportedOperations,
        warnings: capabilities.available ? [] : ['rkdeveloptool not available on backend']
      };
    } catch (error) {
      return {
        compatible: false,
        supportedOperations: [],
        warnings: [`Failed to check compatibility: ${(error as Error).message}`]
      };
    }
  }
}

// Export singleton instance
export const spiFlashService = new SPIFlashService();
export default spiFlashService; 