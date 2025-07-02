// Test the protocol compliance diagnostic
async function testProtocolCompliance() {
  console.log('🔍 Testing Protocol Compliance Diagnostic...');
  
  // Simulate getting the device (since we can see one is detected)
  const devices = await window.webUSBFlasher?.getAvailableDevices();
  if (devices && devices.length > 0) {
    const device = devices[0];
    console.log('📱 Testing with device:', device);
    
    const flasher = new window.WebUSBRockchipFlasher();
    await flasher.connect(device);
    
    const diagnostic = await flasher.diagnoseProtocolCompliance(device);
    console.log('📊 Diagnostic Results:', diagnostic);
    
    return diagnostic;
  } else {
    console.log('❌ No devices available for testing');
    return null;
  }
}

testProtocolCompliance().catch(console.error);
