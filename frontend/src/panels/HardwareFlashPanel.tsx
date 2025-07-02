import React, { useState, useEffect, useRef } from 'react';
import { 
  Card, 
  Steps, 
  Button, 
  Select, 
  Alert, 
  Progress, 
  Typography, 
  Space, 
  Divider,
  Row,
  Col,
  Tag,
  Radio,
  Tooltip,
  Empty,
  Spin,
  message,
  Modal
} from 'antd';
import { 
  UsbOutlined, 
  ThunderboltOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ReloadOutlined,
  DesktopOutlined,
  GlobalOutlined,
  InfoCircleOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { WebSerialFlasher, SerialDevice, FlashProgressWeb, webSerialSupported } from '../services/webSerialFlasher';
import { webUSBRockchipFlasher, RockchipDevice, isWebUSBSupported, WebUSBStorageDevice } from '../services/webUSBFlasher';
import { compressionService, CompressionProgress } from '../services/compressionService';
import { FlashInstructions } from '../components/FlashInstructions';
import { SerialDebugInfo } from '../components/SerialDebugInfo';
import { colors } from '../styles/design-tokens';

const { Title, Text, Paragraph } = Typography;
const { Step } = Steps;
const { Option } = Select;

interface Build {
  id: string;
  name: string;
  status: string;
  outputPath?: string;
  size?: number;
  createdAt?: string;
  artifacts?: Array<{
    name: string;
    type: string;
    size: number;
    url: string;
  }>;
}

interface BackendDevice {
  id: string;
  type: string;
  chipInfo?: string;
  status?: string;
}

interface StorageDevice {
  type: 'emmc' | 'sd' | 'spinor';
  name: string;
  code: number;
  available: boolean;
  capacity?: string;
  flashInfo?: string;
  recommended?: boolean;
  description: string;
}

interface HardwareFlashPanelProps {
  builds: Build[];
  onRefresh?: () => void;
}

export const HardwareFlashPanel: React.FC<HardwareFlashPanelProps> = ({ builds, onRefresh }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<string>('');
  const [serialDevices, setSerialDevices] = useState<SerialDevice[]>([]);
  const [rockchipDevices, setRockchipDevices] = useState<RockchipDevice[]>([]);
  const [flashMethod, setFlashMethod] = useState<'browser' | 'webusb'>('webusb');
  const [selectedDevice, setSelectedDevice] = useState<SerialDevice | RockchipDevice | null>(null);
  const [webUSBStorageDevices, setWebUSBStorageDevices] = useState<WebUSBStorageDevice[]>([]);
  const [selectedStorage, setSelectedStorage] = useState<'emmc' | 'sd' | 'spinor' | ''>('');
  const [loadingStorage, setLoadingStorage] = useState(false);
  const [isFlashing, setIsFlashing] = useState(false);
  const [flashProgress, setFlashProgress] = useState<FlashProgressWeb | null>(null);
  const [compressionProgress, setCompressionProgress] = useState<CompressionProgress | null>(null);
  const [loadingDevices, setLoadingDevices] = useState(false);
  
  // Use useRef to maintain stable instance across renders
  const webSerialFlasher = useRef(new WebSerialFlasher()).current;
  const completedBuilds = builds.filter(build => build.status === 'completed');

  // Fetch serial devices (browser)
  const fetchSerialDevices = async () => {
    if (!webSerialSupported()) return;
    
    try {
      const devices = await webSerialFlasher.getAvailableDevices();
      setSerialDevices(devices);
    } catch (error) {
      console.error('Failed to fetch serial devices:', error);
    }
  };

  // Fetch Rockchip USB devices (WebUSB)
  const fetchRockchipDevices = async () => {
    if (!isWebUSBSupported()) return;
    
    try {
      const devices = await webUSBRockchipFlasher.getAvailableDevices();
      setRockchipDevices(devices);
    } catch (error) {
      console.error('Failed to fetch Rockchip devices:', error);
    }
  };

  // Fetch WebUSB storage devices for selected Rockchip device
  const fetchWebUSBStorageDevices = async (rkDevice: RockchipDevice) => {
    setLoadingStorage(true);
    try {
      console.log('🔍 Detecting WebUSB storage devices...');
      const devices = await webUSBRockchipFlasher.detectStorageDevices(rkDevice);
      setWebUSBStorageDevices(devices);
      
      // Auto-select recommended storage
      const recommended = devices.find(d => d.recommended && d.available);
      if (recommended) {
        setSelectedStorage(recommended.type);
      } else {
        const available = devices.find(d => d.available);
        if (available) {
          setSelectedStorage(available.type);
        }
      }
      
      message.success(`Detected ${devices.filter(d => d.available).length} storage device(s)`);
    } catch (error) {
      console.error('Failed to fetch WebUSB storage devices:', error);
      message.error('Failed to detect WebUSB storage devices');
      setWebUSBStorageDevices([]);
    } finally {
      setLoadingStorage(false);
    }
  };

  useEffect(() => {
    fetchSerialDevices();
    fetchRockchipDevices();
  }, []);

  const handleBuildSelect = (buildId: string) => {
    const build = builds.find(b => b.id === buildId);
    setSelectedBuild(build || null);
    setCurrentStep(1);
  };

  const handleImageSelect = (imageName: string) => {
    setSelectedImageFile(imageName);
    if (selectedBuild) {
      setCurrentStep(2);
    } else {
      setCurrentStep(2);
    }
  };

  // Handle storage selection
  const handleStorageSelect = (storageType: 'emmc' | 'sd' | 'spinor') => {
    setSelectedStorage(storageType);
    setCurrentStep(currentStep + 1);
  };

  // Handle device selection
  const handleDeviceSelect = async (device: SerialDevice | RockchipDevice) => {
    setSelectedDevice(device);
    
    // If WebUSB device, fetch storage devices
    if (flashMethod === 'webusb' && 'chipType' in device) {
      await fetchWebUSBStorageDevices(device as RockchipDevice);
    }
    
    // Move to next step (storage selection or flash)
    setCurrentStep(currentStep + 1);
  };

  // Handle method selection
  const handleMethodSelect = (method: 'browser' | 'webusb') => {
    console.log(`📱 Method selected: ${method}`);
    setFlashMethod(method);
    setCurrentStep(currentStep + 1);
    console.log(`✅ Method selection complete: ${method}`);
    
    // Fetch devices with timeout to prevent hanging
    if (method === 'webusb') {
      console.log('🔍 Fetching WebUSB devices with timeout...');
      Promise.race([
        fetchRockchipDevices(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]).catch(error => {
        console.error('❌ WebUSB device fetch failed or timed out:', error);
        message.warning('WebUSB device detection timed out, you can manually add devices in Step 4.');
      });
    } else if (method === 'browser') {
      console.log('🔍 Fetching Serial devices with timeout...');
      Promise.race([
        fetchSerialDevices(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 5000))
      ]).catch(error => {
        console.error('❌ Serial device fetch failed or timed out:', error);
        message.warning('Serial device detection timed out, you can manually add devices in Step 4.');
      });
    }
  };

  // Start flashing process
  const handleStartFlash = async () => {
    if (!selectedBuild || !selectedImageFile || !selectedDevice) return;

    setIsFlashing(true);
    // Keep current step for flash progress display

    try {
      if (flashMethod === 'webusb') {
        await handleWebUSBFlash();
      } else {
        await handleBrowserFlash();
      }
    } catch (error) {
      console.error('Flash failed:', error);
      setFlashProgress({
        phase: 'failed',
        progress: 0,
        message: `Flash failed: ${(error as Error).message}`
      });
    }
  };

  // Browser flash implementation
  const handleBrowserFlash = async () => {
    const device = await webSerialFlasher.requestDevice();
    if (!device) {
      setIsFlashing(false);
      return;
    }

    // Download the specific image file using the artifacts endpoint
    const imageUrl = `http://localhost:3001/api/builds/${selectedBuild?.id}/artifacts/${encodeURIComponent(selectedImageFile)}`;
    
    const buildResponse = await fetch(imageUrl);
    if (!buildResponse.ok) {
      throw new Error(`Failed to download image file: ${selectedImageFile}`);
    }

    const blob = await buildResponse.blob();
    const file = new File([blob], selectedImageFile, { type: 'application/octet-stream' });

    await webSerialFlasher.connect();
    await webSerialFlasher.flashImage(file, setFlashProgress);
    await webSerialFlasher.disconnect();
  };

  // WebUSB flash implementation with compression
  const handleWebUSBFlash = async () => {
    try {
      message.info('Requesting device access...');
      const device = await webUSBRockchipFlasher.requestDevice();
      if (!device) {
        setIsFlashing(false);
        return;
      }

      message.success(`Device selected: ${device.chipType} v${device.version}`);
      console.log('📱 Selected device:', device);

      // Show compression capabilities
      const capabilities = compressionService.getCapabilities();
      console.log(`🔧 Using ${capabilities.recommended} decompression for optimal performance`);
      
      // Download image using optimal compression strategy
      message.info(`Downloading image (${capabilities.recommendation})...`);
      
      const decompressedData = await compressionService.downloadImage(
        selectedBuild!.id,
        selectedImageFile,
        (progress) => {
          setCompressionProgress(progress);
          // Update flash progress to show download progress
          setFlashProgress({
            phase: 'downloading',
            progress: progress.progress,
            message: `Downloading... ${progress.speed.toFixed(1)} MB/s`,
            bytesTransferred: progress.decompressedBytes,
            totalBytes: progress.totalBytes
          });
        }
      );

      message.success(`Image decompressed: ${(decompressedData.length / (1024 * 1024)).toFixed(1)} MB`);
      console.log(`📦 Decompression complete: ${(decompressedData.length / (1024 * 1024)).toFixed(1)} MB`);
      
      // Get selected storage device for WebUSB
      const selectedStorageDevice = webUSBStorageDevices.find(d => d.type === selectedStorage);
      if (selectedStorage && !selectedStorageDevice) {
        throw new Error(`Selected storage device (${selectedStorage}) not found or not available`);
      }
      
      // Start flashing with progress updates and storage selection
      await webUSBRockchipFlasher.flashImage(device, decompressedData.buffer, (progress) => {
        console.log('📊 Flash progress:', progress);
        setFlashProgress({
          phase: progress.phase as any,
          progress: progress.progress,
          message: progress.message,
          bytesTransferred: progress.bytesWritten,
          totalBytes: progress.totalBytes
        });
        
        // Show progress messages in UI
        if (progress.phase === 'connecting' && progress.progress === 15) {
          message.info('Testing device communication...');
        } else if (progress.phase === 'loading_bootloader') {
          message.success('Device communication established!');
        } else if (progress.phase === 'completed') {
          message.success('Flash completed successfully!');
        } else if (progress.phase === 'failed') {
          message.error(`Flash failed: ${progress.message}`);
        }
      }, selectedStorageDevice);
      
    } catch (error) {
      console.error('❌ WebUSB Flash error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Provide more helpful error messages
      if (errorMessage.includes('Device communication test failed')) {
        message.error('Device communication test failed. Check console for detailed logs.');
        
        // Add debug info modal or better error display
        Modal.error({
          title: 'Device Communication Failed',
          content: (
            <div>
              <p>The device communication test failed. This could be due to:</p>
              <ul>
                <li>Device not in the correct mode (try putting it in maskrom/download mode)</li>
                <li>Wrong USB endpoints detected</li>
                <li>Device driver issues</li>
                <li>USB communication protocol mismatch</li>
              </ul>
              <p>Check the browser console for detailed logs.</p>
              <p><strong>Debug info:</strong> Open browser DevTools and look for messages starting with 🧪, 📋, or ❌</p>
            </div>
          ),
          width: 600
        });
      } else {
        message.error(errorMessage);
      }
      
      setFlashProgress({
        phase: 'failed',
        progress: 0,
        message: errorMessage
      });
    } finally {
      setIsFlashing(false);
    }
  };

  // Request additional serial device
  const handleRequestSerialDevice = async () => {
    if (!webSerialSupported()) {
      message.error('Web Serial not supported in this browser');
      return;
    }

    try {
      await webSerialFlasher.requestDevice();
             if (webSerialSupported()) {
         await fetchSerialDevices();
       }
    } catch (error) {
      console.error('Failed to request device:', error);
    }
  };

  // Reset the wizard
  const handleReset = () => {
    setCurrentStep(0);
    setSelectedBuild(null);
    setSelectedImageFile('');
    setSelectedDevice(null);
    setSelectedStorage('');
    setWebUSBStorageDevices([]);
    setIsFlashing(false);
    setFlashProgress(null);
    setCompressionProgress(null);
  };

  // Get image files from selected build
  const getImageFiles = () => {
    if (!selectedBuild?.artifacts) return [];
    return selectedBuild.artifacts.filter(artifact => 
      artifact.type === 'image' && artifact.name.endsWith('.img')
    );
  };

  // Format file size
  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  };

  const steps = [
    {
      title: 'Select Build',
      description: 'Choose a completed build',
      icon: <DesktopOutlined />
    },
    {
      title: 'Select Image',
      description: 'Pick the image file to flash',
      icon: <ThunderboltOutlined />
    },
    {
      title: 'Flash Method',
      description: 'Choose how to flash',
      icon: <UsbOutlined />
    },
    {
      title: 'Select Device',
      description: flashMethod === 'webusb' ? 'Choose Rockchip device in maskrom mode' : 'Choose device with serial interface',
      icon: flashMethod === 'webusb' ? <UsbOutlined /> : <GlobalOutlined />
    },
    ...(flashMethod === 'webusb' && webUSBStorageDevices.length > 0 ? [{
      title: 'Select Storage',
      description: 'Choose target storage device',
      icon: <InfoCircleOutlined />
    }] : []),
    {
      title: 'Flash Image',
      description: 'Start the flashing process',
      icon: <CheckCircleOutlined />
    }
  ];

  return (
    <div style={{ 
      height: '100%', 
      backgroundColor: colors.background.secondary,
      padding: '24px',
      overflow: 'auto'
    }}>
      <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <Title level={2} style={{ color: colors.accent[500], marginBottom: '8px' }}>
            <ThunderboltOutlined style={{ marginRight: '12px' }} />
            Hardware Flash Center
          </Title>
          <Paragraph style={{ color: colors.text.secondary, fontSize: '16px' }}>
            Flash your Armbian images directly to hardware with our intuitive step-by-step process
          </Paragraph>
        </div>

        {/* Progress Steps */}
        <Card style={{ marginBottom: '24px', backgroundColor: colors.background.primary }}>
          <Steps 
            current={currentStep} 
            items={steps}
            style={{ marginBottom: '16px' }}
          />
          
          {currentStep > 0 && !isFlashing && (
            <div style={{ textAlign: 'center', marginTop: '16px' }}>
              <Button onClick={handleReset} icon={<ReloadOutlined />}>
                Start Over
              </Button>
            </div>
          )}
        </Card>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={16}>
            
            {/* Step 1: Build Selection */}
            {currentStep === 0 && (
              <Card 
                title={
                  <Space>
                    <DesktopOutlined style={{ color: colors.accent[500] }} />
                    <span>Step 1: Select a Completed Build</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                {completedBuilds.length === 0 ? (
                  <Empty 
                    description="No completed builds available"
                    image={Empty.PRESENTED_IMAGE_SIMPLE}
                  />
                ) : (
                  <div style={{ display: 'grid', gap: '12px' }}>
                    {completedBuilds.map(build => (
                      <Card
                        key={build.id}
                        size="small"
                        hoverable
                        onClick={() => handleBuildSelect(build.id)}
                        style={{ 
                          cursor: 'pointer',
                          border: selectedBuild?.id === build.id ? 
                            `2px solid ${colors.accent[500]}` : 
                            `1px solid ${colors.border.light}`
                        }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Text strong style={{ color: colors.text.primary }}>
                              {build.name}
                            </Text>
                            <br />
                            <Text type="secondary">
                              <ClockCircleOutlined style={{ marginRight: '4px' }} />
                              {build.createdAt ? new Date(build.createdAt).toLocaleString() : 'Unknown date'}
                            </Text>
                          </Col>
                          <Col>
                            <Tag color="success">Completed</Tag>
                            {build.size && (
                              <Tag>{formatFileSize(build.size)}</Tag>
                            )}
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Step 2: Image Selection */}
            {currentStep === 1 && selectedBuild && (
              <Card 
                title={
                  <Space>
                    <ThunderboltOutlined style={{ color: colors.accent[500] }} />
                    <span>Step 2: Select Image File</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                <Alert
                  message="Selected Build"
                  description={selectedBuild.name}
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                
                {getImageFiles().map(artifact => (
                  <Card
                    key={artifact.name}
                    size="small"
                    hoverable
                    onClick={() => handleImageSelect(artifact.name)}
                    style={{ 
                      marginBottom: '8px',
                      cursor: 'pointer',
                      border: selectedImageFile === artifact.name ? 
                        `2px solid ${colors.accent[500]}` : 
                        `1px solid ${colors.border.light}`
                    }}
                  >
                    <Row justify="space-between" align="middle">
                      <Col>
                        <Space>
                          <ThunderboltOutlined style={{ color: colors.accent[500] }} />
                          <Text strong>{artifact.name}</Text>
                        </Space>
                      </Col>
                      <Col>
                        <Tag>{formatFileSize(artifact.size)}</Tag>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Card>
            )}



            {/* Step 3: Method Selection */}
            {currentStep === 2 && (
              <Card 
                title={
                  <Space>
                    <UsbOutlined style={{ color: colors.accent[500] }} />
                    <span>Step 3: Choose Flash Method</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                <Radio.Group 
                  value={flashMethod} 
                  onChange={(e) => handleMethodSelect(e.target.value)}
                  style={{ width: '100%' }}
                >
                  <div style={{ display: 'grid', gap: '16px' }}>
                    <Radio.Button 
                      value="browser" 
                      disabled={!webSerialSupported()}
                      onClick={() => handleMethodSelect('browser')}
                      style={{ 
                        height: 'auto', 
                        padding: '16px',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                          <GlobalOutlined style={{ marginRight: '8px' }} />
                          Browser Serial Method {!webSerialSupported() && '(Not Supported)'}
                        </div>
                        <div style={{ color: colors.text.secondary }}>
                          For devices with serial consoles. Does NOT use maskrom mode.
                        </div>
                      </div>
                    </Radio.Button>
                    
                    <Radio.Button 
                      value="webusb" 
                      disabled={!isWebUSBSupported()}
                      onClick={() => handleMethodSelect('webusb')}
                      style={{ 
                        height: 'auto', 
                        padding: '16px',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                          <UsbOutlined style={{ marginRight: '8px' }} />
                          WebUSB Maskrom Method {!isWebUSBSupported() && '(Not Supported)'}
                        </div>
                        <div style={{ color: colors.text.secondary }}>
                          Direct Rockchip maskrom flashing via WebUSB. Recommended for NVME.
                        </div>
                      </div>
                    </Radio.Button>
                  </div>
                </Radio.Group>
              </Card>
            )}

            {/* Step 4: Device Selection */}
            {currentStep === 3 && (
              <Card 
                title={
                  <Space>
                    {flashMethod === 'webusb' ? <UsbOutlined style={{ color: colors.accent[500] }} /> : <GlobalOutlined style={{ color: colors.accent[500] }} />}
                    <span>Step 4: Select {flashMethod === 'webusb' ? 'Maskrom' : 'Serial'} Device</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                <Alert
                  message="Device Detection"
                  description={flashMethod === 'webusb' ? 
                    'Connect your Rockchip device in maskrom mode and select it below. WebUSB will communicate directly with the device to flash your NVME/eMMC.' :
                    'Connect a device with serial console access. This method does NOT require maskrom mode.'
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                
                <Spin spinning={loadingDevices}>
                  {flashMethod === 'webusb' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <Text strong>Available WebUSB Devices</Text>
                        <Button 
                          size="small" 
                          icon={<UsbOutlined />} 
                          onClick={async () => {
                            try {
                              await webUSBRockchipFlasher.requestDevice();
                              await fetchRockchipDevices();
                            } catch (error) {
                              console.error('Failed to request Rockchip device:', error);
                            }
                          }}
                        >
                          Add Device
                        </Button>
                      </div>
                      {rockchipDevices.length === 0 ? (
                        <Empty 
                          description="No WebUSB devices detected. Click 'Add Device' to grant permission to your Rockchip device."
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ) : (
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {rockchipDevices.map((device, index) => (
                            <Card
                              key={index}
                              size="small"
                              hoverable
                              onClick={() => handleDeviceSelect(device)}
                              style={{ 
                                cursor: 'pointer',
                                border: selectedDevice && 'chipType' in selectedDevice && selectedDevice.chipType === device.chipType ? 
                                  `2px solid ${colors.accent[500]}` : 
                                  `1px solid ${colors.border.light}`
                              }}
                            >
                              <Row justify="space-between" align="middle">
                                <Col>
                                  <Space>
                                    <UsbOutlined style={{ color: colors.accent[500] }} />
                                    <div>
                                      <Text strong>{device.chipType}</Text>
                                      <br />
                                      <Text type="secondary">Version {device.version}</Text>
                                    </div>
                                  </Space>
                                </Col>
                                <Col>
                                  <Tag color="orange">{device.mode}</Tag>
                                </Col>
                              </Row>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {flashMethod === 'browser' && (
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <Text strong>Available Serial Devices</Text>
                        <Button 
                          size="small" 
                          icon={<UsbOutlined />} 
                          onClick={handleRequestSerialDevice}
                        >
                          Add Device
                        </Button>
                      </div>
                      {serialDevices.length === 0 ? (
                        <Empty 
                          description="No serial devices detected. Click 'Add Device' to connect via Web Serial."
                          image={Empty.PRESENTED_IMAGE_SIMPLE}
                        />
                      ) : (
                        <div style={{ display: 'grid', gap: '8px' }}>
                          {serialDevices.map(device => (
                            <Card
                              key={device.id}
                              size="small"
                              hoverable
                              onClick={() => handleDeviceSelect(device)}
                              style={{ 
                                cursor: 'pointer',
                                border: selectedDevice && 'id' in selectedDevice && selectedDevice.id === device.id ? 
                                  `2px solid ${colors.accent[500]}` : 
                                  `1px solid ${colors.border.light}`
                              }}
                            >
                              <Row justify="space-between" align="middle">
                                <Col>
                                  <Space>
                                    <GlobalOutlined style={{ color: colors.accent[500] }} />
                                    <div>
                                      <Text strong>{device.name}</Text>
                                      <br />
                                      <Text type="secondary">Serial Device</Text>
                                    </div>
                                  </Space>
                                </Col>
                                <Col>
                                  <Tag color="green">Serial</Tag>
                                </Col>
                              </Row>
                            </Card>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </Spin>
              </Card>
            )}

            {/* Storage Selection Step (WebUSB only) */}
            {currentStep === 4 && (flashMethod === 'webusb' && webUSBStorageDevices.length > 0) && (
              <Card 
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: colors.accent[500] }} />
                    <span>Step 5: Select Target Storage Device</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                <Alert
                  message="Storage Device Selection"
                  description="The following storage devices were detected on your RK device via WebUSB. Choose where to flash the image."
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />

                {flashMethod === 'webusb' && webUSBStorageDevices.length > 0 && (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {webUSBStorageDevices.map(device => (
                      <Card
                        key={device.type}
                        size="small"
                        hoverable
                        onClick={() => handleStorageSelect(device.type)}
                        style={{ 
                          cursor: device.available ? 'pointer' : 'not-allowed',
                          opacity: device.available ? 1 : 0.5,
                          border: selectedStorage === device.type ? 
                            `2px solid ${colors.accent[500]}` : 
                            `1px solid ${colors.border.light}`
                        }}
                      >
                        <Row justify="space-between" align="middle">
                          <Col>
                            <Space>
                              <InfoCircleOutlined style={{ color: colors.accent[500] }} />
                              <div>
                                <Text strong>{device.name}</Text>
                                <br />
                                <Text type="secondary">{device.description}</Text>
                                {device.capacity && (
                                  <>
                                    <br />
                                    <Text type="secondary">Capacity: {device.capacity}</Text>
                                  </>
                                )}
                              </div>
                            </Space>
                          </Col>
                          <Col>
                            <div style={{ textAlign: 'right' }}>
                              <Tag color={device.available ? 'green' : 'red'}>
                                {device.available ? 'Available' : 'Unavailable'}
                              </Tag>
                              {device.recommended && (
                                <Tag color="gold">Recommended</Tag>
                              )}
                            </div>
                          </Col>
                        </Row>
                      </Card>
                    ))}
                  </div>
                )}
              </Card>
            )}

            {/* Final Flash Step */}
            {currentStep >= 4 && (!(flashMethod === 'webusb' && webUSBStorageDevices.length > 0) || selectedStorage) && (
              <Card 
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: colors.accent[500] }} />
                    <span>Flash to Device</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                {!isFlashing ? (
                  <div>
                    <Alert
                      message="Ready to Flash"
                      description={
                        <div>
                          <div><strong>Build:</strong> {selectedBuild?.name}</div>
                          <div><strong>Image:</strong> {selectedImageFile}</div>
                          <div><strong>Method:</strong> {
                            flashMethod === 'webusb' ? 'WebUSB (Rockchip Direct)' : 
                            'Browser (Web Serial)'
                          }</div>
                          <div><strong>Device:</strong> {
                            selectedDevice && 'id' in selectedDevice && 'chipInfo' in selectedDevice ? `Device ${selectedDevice.id} (${selectedDevice.chipInfo})` :
                            selectedDevice && 'chipType' in selectedDevice ? `${selectedDevice.chipType} v${selectedDevice.version}` :
                            selectedDevice && 'name' in selectedDevice ? selectedDevice.name :
                            'No device selected'
                          }</div>
                          {selectedStorage && (
                            <div><strong>Storage:</strong> {selectedStorage.toUpperCase()}</div>
                          )}
                        </div>
                      }
                      type="success"
                      showIcon
                      style={{ marginBottom: '16px' }}
                    />
                    
                    <div style={{ textAlign: 'center' }}>
                      <Button 
                        type="primary" 
                        size="large"
                        icon={<ThunderboltOutlined />}
                        onClick={handleStartFlash}
                        style={{ 
                          height: '48px', 
                          fontSize: '16px',
                          backgroundColor: colors.accent[500],
                          borderColor: colors.accent[500]
                        }}
                      >
                        Start Flashing
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div>
                    {flashProgress && (
                      <div>
                        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                          <Title level={4} style={{ color: colors.text.primary }}>
                            {flashProgress.phase === 'completed' ? 'Flash Completed!' : 
                             flashProgress.phase === 'failed' ? 'Flash Failed' : 'Flashing in Progress...'}
                          </Title>
                        </div>
                        
                        <Progress 
                          percent={flashProgress.progress} 
                          status={
                            flashProgress.phase === 'completed' ? 'success' :
                            flashProgress.phase === 'failed' ? 'exception' : 'active'
                          }
                          strokeColor={colors.accent[500]}
                          style={{ marginBottom: '16px' }}
                        />
                        
                        <Text style={{ color: colors.text.secondary }}>
                          {flashProgress.message}
                        </Text>
                        
                        {flashProgress.bytesTransferred && flashProgress.totalBytes && (
                          <div style={{ marginTop: '8px' }}>
                            <Text type="secondary">
                              {formatFileSize(flashProgress.bytesTransferred)} / {formatFileSize(flashProgress.totalBytes)}
                            </Text>
                          </div>
                        )}

                        {(flashProgress.phase === 'completed' || flashProgress.phase === 'failed') && (
                          <div style={{ textAlign: 'center', marginTop: '24px' }}>
                            <Button onClick={handleReset} type="primary">
                              Flash Another Image
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            )}
          </Col>

          <Col xs={24} lg={8}>
            
            {/* Device Status */}
            <Card 
              title="Device Status" 
              style={{ 
                marginBottom: '16px',
                backgroundColor: colors.background.primary 
              }}
            >
              <Spin spinning={loadingDevices}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Text strong>Serial Devices</Text>
                    {webSerialSupported() && (
                      <Button 
                        size="small" 
                        icon={<UsbOutlined />} 
                        onClick={handleRequestSerialDevice}
                      >
                        Add Device
                      </Button>
                    )}
                  </div>
                  {!webSerialSupported() ? (
                                         <Alert 
                       message="Web Serial not supported in this browser" 
                       type="warning"
                     />
                  ) : serialDevices.length === 0 ? (
                    <Text type="secondary">No devices connected</Text>
                  ) : (
                    serialDevices.map(device => (
                      <Tag key={device.id} color="green" style={{ marginBottom: '4px' }}>
                        {device.name}
                      </Tag>
                    ))
                  )}
                </div>

                <Divider style={{ margin: '16px 0' }} />

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <Text strong>Rockchip Devices</Text>
                    {isWebUSBSupported() && (
                      <Button 
                        size="small" 
                        icon={<UsbOutlined />} 
                        onClick={async () => {
                          try {
                            await webUSBRockchipFlasher.requestDevice();
                            await fetchRockchipDevices();
                          } catch (error) {
                            console.error('Failed to request Rockchip device:', error);
                          }
                        }}
                      >
                        Add Device
                      </Button>
                    )}
                  </div>
                  {!isWebUSBSupported() ? (
                    <Alert 
                      message="WebUSB not supported in this browser" 
                      type="warning"
                    />
                  ) : rockchipDevices.length === 0 ? (
                    <Text type="secondary">No devices connected</Text>
                  ) : (
                    rockchipDevices.map((device, index) => (
                      <Tag key={index} color="orange" style={{ marginBottom: '4px' }}>
                        {device.chipType} ({device.mode})
                      </Tag>
                    ))
                  )}
                </div>
              </Spin>
            </Card>

            {/* Instructions */}
            <FlashInstructions />

            {/* Debug Information */}
            <SerialDebugInfo />
            
          </Col>
        </Row>
      </div>
    </div>
  );
}; 