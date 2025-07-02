# Browser-Based Hardware Flashing

This document explains how BBOS enables direct hardware flashing from the browser using modern web APIs, eliminating the need for backend dependencies in certain scenarios.

## Overview

BBOS supports two hardware flashing approaches:

1. **Backend Method** (Production): Uses `rkdeveloptool` on the server
2. **Browser Method** (Experimental): Direct browser-to-device communication

## Web Serial API Implementation

### Browser Support

The Web Serial API is supported in:
- Chrome/Chromium 89+
- Edge 89+
- Opera 75+

**Requirements:**
- HTTPS connection (or localhost for development)
- User gesture (button click) to request device access
- Compatible serial device

### Basic Usage

```typescript
import { WebSerialFlasher } from '../services/webSerialFlasher';

const flasher = new WebSerialFlasher();

// Check support
if (flasher.isSupported()) {
  // Request device from user
  const device = await flasher.requestDevice();
  
  if (device) {
    // Connect and flash
    await flasher.connect();
    await flasher.flashImage(imageFile, (progress) => {
      console.log(`${progress.phase}: ${progress.progress}%`);
    });
    await flasher.disconnect();
  }
}
```

### Device Detection

The Web Serial API can detect devices with specific vendor/product IDs:

```typescript
// Request Rockchip devices specifically
const port = await navigator.serial.requestPort({
  filters: [
    { usbVendorId: 0x2207 }, // Rockchip vendor ID
    { usbVendorId: 0x1d6b }, // Generic USB
  ]
});
```

### Protocol Implementation

#### Rockchip Download Protocol

The Rockchip download protocol typically involves:

1. **Device Detection**: Enumerate available serial ports
2. **Mode Switch**: Enter maskrom/download mode
3. **Bootloader**: Upload SPL/bootloader (if needed)
4. **Image Transfer**: Stream image data in chunks
5. **Verification**: Verify successful flash

#### Example Protocol Commands

```typescript
// Enter download mode
const enterDownloadCmd = new Uint8Array([0xFC, 0x00, 0x00, 0x00]);
await writer.write(enterDownloadCmd);

// Write image chunk with header
const writeChunkCmd = new Uint8Array([
  0xFB,                    // Write command
  (address >> 0) & 0xFF,   // Address bytes
  (address >> 8) & 0xFF,
  (address >> 16) & 0xFF,
  (address >> 24) & 0xFF,
  (size >> 0) & 0xFF,      // Size bytes
  (size >> 8) & 0xFF,
  (size >> 16) & 0xFF,
  (size >> 24) & 0xFF,
  ...imageChunk            // Image data
]);
```

## WebUSB Alternative

For devices that support WebUSB (requires device manufacturer support):

### Implementation

```typescript
class WebUSBFlasher {
  async requestDevice() {
    const device = await navigator.usb.requestDevice({
      filters: [{ vendorId: 0x2207 }] // Rockchip
    });
    return device;
  }

  async flashImage(device: USBDevice, imageData: ArrayBuffer) {
    await device.open();
    await device.selectConfiguration(1);
    await device.claimInterface(0);

    // Use bulk transfer endpoints for data
    const result = await device.transferOut(1, imageData);
    console.log('Transferred:', result.bytesWritten);

    await device.close();
  }
}
```

### Advantages of WebUSB
- More control over USB communication
- Better performance for bulk data transfer
- Access to multiple endpoints/interfaces

### Limitations
- Requires device manufacturer WebUSB support
- More complex protocol implementation
- Limited device compatibility

## Integration with BBOS

### Frontend Panel

The `HardwareFlashPanel` component provides:

- **Method Selection**: Toggle between backend/browser approaches
- **Device Detection**: List available devices for each method
- **Build Selection**: Choose from completed builds
- **Progress Monitoring**: Real-time flash progress
- **Error Handling**: User-friendly error messages

### API Integration

Browser flashing integrates with existing BBOS APIs:

```typescript
// Download build from backend
const response = await fetch(`/api/builds/${buildId}/download`);
const blob = await response.blob();
const file = new File([blob], `build-${buildId}.img`);

// Flash via browser
await webSerialFlasher.flashImage(file, onProgress);
```

## Security Considerations

### Browser Permissions

- **User Gesture Required**: Device access requires explicit user action
- **Per-Origin**: Permissions are scoped to the current origin
- **Secure Context**: HTTPS required for production use

### Device Safety

- **Verification**: Always verify data integrity before/after flash
- **Error Recovery**: Implement proper error handling and recovery
- **Bricking Prevention**: Validate image compatibility before flashing

## Comparison: Backend vs Browser

### Backend Method (rkdeveloptool)

**Pros:**
- ✅ Proven reliability with extensive device support
- ✅ Complete protocol implementation
- ✅ Server-side validation and error handling
- ✅ Works with all browsers
- ✅ No additional permissions required

**Cons:**
- ❌ Requires server-side hardware access
- ❌ Backend dependencies
- ❌ Server must be on same machine as device

### Browser Method (Web APIs)

**Pros:**
- ✅ Direct hardware access from browser
- ✅ No backend dependencies for flashing
- ✅ Modern web platform capabilities
- ✅ Potential for offline operation
- ✅ Enhanced user experience

**Cons:**
- ❌ Limited browser support
- ❌ Requires HTTPS/localhost
- ❌ Complex protocol implementation
- ❌ Device compatibility varies
- ❌ Experimental/evolving standards

## Supported Devices

### Current Implementation
- **Rockchip RK3588** (Rock-5B, Orange Pi 5)
- **Rockchip RK3399** (Rock Pi 4, etc.)
- **Rockchip RK3566/RK3568**

### Adding Device Support

To add support for new devices:

1. **Identify Protocol**: Research device-specific flash protocol
2. **Add Vendor ID**: Update device filters in `requestDevice()`
3. **Implement Commands**: Add device-specific command sequences
4. **Test Thoroughly**: Verify with actual hardware

## Future Enhancements

### WebCodecs Integration
- Hardware-accelerated image decompression
- Support for compressed image formats
- Better performance for large images

### Web Workers
- Offload heavy processing to background threads
- Non-blocking UI during flash operations
- Parallel image processing

### Progressive Web App
- Offline flash capability
- Device driver caching
- Enhanced mobile experience

## Usage Examples

### Complete Flash Workflow

```typescript
import { WebSerialFlasher } from './services/webSerialFlasher';

async function flashDevice() {
  const flasher = new WebSerialFlasher();
  
  try {
    // 1. Check browser support
    if (!flasher.isSupported()) {
      throw new Error('Web Serial API not supported');
    }
    
    // 2. Request device from user
    const device = await flasher.requestDevice();
    if (!device) return; // User cancelled
    
    // 3. Get image file
    const response = await fetch('/api/builds/latest/download');
    const blob = await response.blob();
    const imageFile = new File([blob], 'armbian.img');
    
    // 4. Connect and flash
    await flasher.connect();
    
    await flasher.flashImage(imageFile, (progress) => {
      updateUI(progress);
    });
    
    console.log('Flash completed successfully!');
    
  } catch (error) {
    console.error('Flash failed:', error);
  } finally {
    await flasher.disconnect();
  }
}
```

### Error Handling

```typescript
function handleFlashError(error: Error) {
  if (error.message.includes('No device selected')) {
    showMessage('Please connect your device and try again');
  } else if (error.message.includes('not supported')) {
    showMessage('Your browser does not support Web Serial API');
  } else {
    showMessage(`Flash failed: ${error.message}`);
  }
}
```

## Conclusion

Browser-based hardware flashing represents an exciting advancement in web platform capabilities. While still experimental, it offers significant benefits for IoT development workflows by enabling direct hardware interaction from web applications.

The BBOS implementation provides both traditional backend-based flashing and cutting-edge browser-based approaches, allowing users to choose the method that best fits their environment and requirements. 