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
  Modal,
  Checkbox
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
  ClockCircleOutlined,
  WarningOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import { WebSerialFlasher, SerialDevice, FlashProgressWeb, webSerialSupported } from '../services/webSerialFlasher';
import { WebUSBRockchipFlasher, RockchipDevice, WebUSBStorageDevice } from '../services/webUSBFlasher';
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
  
  // SPI and reboot functionality state
  const [spiOperationMode, setSpiOperationMode] = useState<'normal' | 'spi-clear' | 'spi-bootloader'>('normal');
  const [rebootAfterFlash, setRebootAfterFlash] = useState(false);
  const [isSpiOperation, setIsSpiOperation] = useState(false);
  
  // Use useRef to maintain stable instance across renders
  const webSerialFlasher = useRef(new WebSerialFlasher()).current;
  const completedBuilds = builds.filter(build => build.status === 'completed');
  
  // Remove socket integration - using frontend WebUSB operations instead

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
    if (!WebUSBRockchipFlasher.isSupported()) return;
    
    try {
      const devices = await WebUSBRockchipFlasher.getAvailableDevices();
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
      const devices = await WebUSBRockchipFlasher.detectStorageDevices(rkDevice);
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
    if (!selectedDevice || !('port' in selectedDevice)) {
      message.error('Please select a valid serial device');
      return;
    }

    try {
      const artifact = selectedBuild?.artifacts?.find(a => a.name === selectedImageFile);
      if (!artifact) {
        throw new Error('Selected image file not found');
      }

      const response = await fetch(artifact.url);
      const blob = await response.blob();
      const file = new File([blob], selectedImageFile, { type: 'application/octet-stream' });

      await webSerialFlasher.flashImage(
        file,
        (progress) => setFlashProgress(progress)
      );
      message.success('Flash completed successfully');
    } catch (error) {
      console.error('Browser flash failed:', error);
      throw error;
    }
  };

  // WebUSB flash implementation with compression
  const handleWebUSBFlash = async () => {
    if (!selectedDevice || !('chipType' in selectedDevice)) {
      message.error('Please select a valid Rockchip device');
      return;
    }

    if (!selectedBuild) {
      message.error('Please select a build');
      return;
    }

    const rkDevice = selectedDevice as RockchipDevice;
    
    try {
      // Get selected storage device
      const storage = webUSBStorageDevices.find(d => d.type === selectedStorage);
      if (!storage) {
        throw new Error('Selected storage device not found');
      }

      // Fetch image data
      const artifact = selectedBuild.artifacts?.find(a => a.name === selectedImageFile);
      if (!artifact) {
        throw new Error('Selected image file not found');
      }

      // Download and decompress image
      const response = await fetch(artifact.url);
      const compressedData = await response.arrayBuffer();
      
      setCompressionProgress({ progress: 0, decompressedBytes: 0, speed: 0 });
      const imageData = await compressionService.downloadImage(
        selectedBuild.id,
        selectedImageFile,
        (progress) => setCompressionProgress(progress)
      );

      // Flash image using WebUSB
      await WebUSBRockchipFlasher.flashImage(
        rkDevice,
        imageData.buffer,
        (progress) => {
          // Map WebUSB flash progress to web flash progress format
          const webProgress: FlashProgressWeb = {
            phase: progress.phase === 'detecting' ? 'connecting' :
                   progress.phase === 'loading_bootloader' ? 'preparing' :
                   progress.phase === 'writing' ? 'flashing' :
                   progress.phase,
            progress: progress.progress,
            message: progress.message,
            bytesTransferred: progress.bytesWritten,
            totalBytes: progress.totalBytes
          };
          setFlashProgress(webProgress);
        },
        storage
      );

      // Reboot device if requested
      if (rebootAfterFlash) {
        await handleDeviceReboot();
      }

      message.success('Flash completed successfully');
    } catch (error) {
      console.error('WebUSB flash failed:', error);
      throw error;
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
    setSpiOperationMode('normal');
    setRebootAfterFlash(false);
    setIsSpiOperation(false);
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
    ...(flashMethod === 'webusb' ? [{
      title: 'Operation Mode',
      description: 'Choose operation type',
      icon: <InfoCircleOutlined />
    }] : []),
    {
      title: 'Select Device',
      description: flashMethod === 'webusb' ? 'Choose Rockchip device in maskrom mode' : 'Choose device with serial interface',
      icon: flashMethod === 'webusb' ? <UsbOutlined /> : <GlobalOutlined />
    },
    ...(flashMethod === 'webusb' && webUSBStorageDevices.length > 0 && spiOperationMode === 'normal' ? [{
      title: 'Select Storage',
      description: 'Choose target storage device',
      icon: <InfoCircleOutlined />
    }] : []),
    {
      title: spiOperationMode === 'spi-clear' ? 'Clear SPI' : 
             spiOperationMode === 'spi-bootloader' ? 'Write Bootloader' : 'Flash Image',
      description: spiOperationMode === 'spi-clear' ? 'Clear SPI flash chip' :
                   spiOperationMode === 'spi-bootloader' ? 'Write bootloader to SPI' : 'Start the flashing process',
      icon: <CheckCircleOutlined />
    }
  ];

  // Handle SPI clear operation using backend API (more reliable than WebUSB)
  const handleSPIClear = async () => {
    if (!selectedDevice || !('chipType' in selectedDevice)) {
      message.error('Please select a valid Rockchip device');
      return;
    }

    const rkDevice = selectedDevice as RockchipDevice;
    setIsSpiOperation(true);

    try {
      await WebUSBRockchipFlasher.clearSPIFlash(
        rkDevice,
        (progress) => {
          // Map WebUSB flash progress to web flash progress format
          const webProgress: FlashProgressWeb = {
            phase: progress.phase === 'detecting' ? 'connecting' :
                   progress.phase === 'loading_bootloader' ? 'preparing' :
                   progress.phase === 'writing' ? 'flashing' :
                   progress.phase,
            progress: progress.progress,
            message: progress.message,
            bytesTransferred: progress.bytesWritten,
            totalBytes: progress.totalBytes
          };
          setFlashProgress(webProgress);
        }
      );
      message.success('SPI flash cleared successfully');
    } catch (error) {
      console.error('SPI clear failed:', error);
      message.error('Failed to clear SPI flash');
    } finally {
      setIsSpiOperation(false);
    }
  };

  // Handle SPI bootloader write
  const handleSPIBootloaderWrite = async () => {
    if (!selectedDevice || !('chipType' in selectedDevice)) {
      message.error('Please select a valid Rockchip device');
      return;
    }

    const rkDevice = selectedDevice as RockchipDevice;
    setIsSpiOperation(true);

    try {
      await WebUSBRockchipFlasher.writeSPIBootloaderAuto(
        rkDevice,
        (progress) => {
          // Map WebUSB flash progress to web flash progress format
          const webProgress: FlashProgressWeb = {
            phase: progress.phase === 'detecting' ? 'connecting' :
                   progress.phase === 'loading_bootloader' ? 'preparing' :
                   progress.phase === 'writing' ? 'flashing' :
                   progress.phase,
            progress: progress.progress,
            message: progress.message,
            bytesTransferred: progress.bytesWritten,
            totalBytes: progress.totalBytes
          };
          setFlashProgress(webProgress);
        }
      );
      message.success('SPI bootloader written successfully');
    } catch (error) {
      console.error('SPI bootloader write failed:', error);
      message.error('Failed to write SPI bootloader');
    } finally {
      setIsSpiOperation(false);
    }
  };

  // Handle device reboot
  const handleDeviceReboot = async () => {
    if (!selectedDevice || flashMethod !== 'webusb' || !('chipType' in selectedDevice)) {
      message.error('Device reboot requires a WebUSB Rockchip device');
      return;
    }

    try {
      message.info('Rebooting device...');
      await WebUSBRockchipFlasher.rebootDevice(selectedDevice as RockchipDevice);
      message.success('Device reboot command sent successfully');
      
      // Clear device selection since device will disconnect
      setTimeout(() => {
        setSelectedDevice(null);
        setRockchipDevices([]);
        setSerialDevices([]);
        message.info('Device disconnected after reboot. Reconnect if needed.');
      }, 2000);
    } catch (error) {
      console.error('Device reboot failed:', error);
      message.error(`Device reboot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

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
                      disabled={!WebUSBRockchipFlasher.isSupported()}
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
                          WebUSB Maskrom Method {!WebUSBRockchipFlasher.isSupported() && '(Not Supported)'}
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

            {/* Step 3.5: Operation Mode Selection (WebUSB only) */}
            {currentStep === 3 && flashMethod === 'webusb' && (
              <Card 
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: colors.accent[500] }} />
                    <span>Step 3.5: Choose Operation Mode</span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                <Alert
                  message="Operation Mode"
                  description="Choose what type of operation you want to perform with your Rockchip device."
                  type="info"
                  showIcon
                  style={{ marginBottom: '16px' }}
                />
                
                <Radio.Group 
                  value={spiOperationMode} 
                  onChange={(e) => {
                    setSpiOperationMode(e.target.value);
                    setCurrentStep(currentStep + 1);
                  }}
                  style={{ width: '100%' }}
                >
                  <div style={{ display: 'grid', gap: '12px' }}>
                    <Radio.Button 
                      value="normal"
                      style={{ 
                        height: 'auto', 
                        padding: '12px',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                          <ThunderboltOutlined style={{ marginRight: '8px' }} />
                          Normal Image Flashing
                        </div>
                        <div style={{ color: colors.text.secondary }}>
                          Flash full OS image to eMMC, SD card, or NVMe storage
                        </div>
                      </div>
                    </Radio.Button>
                    
                    <Radio.Button 
                      value="spi-clear"
                      style={{ 
                        height: 'auto', 
                        padding: '12px',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                          <ExclamationCircleOutlined style={{ marginRight: '8px' }} />
                          Clear SPI Flash
                        </div>
                        <div style={{ color: colors.text.secondary }}>
                          Completely erase SPI NOR flash (useful for removing old bootloaders)
                        </div>
                      </div>
                    </Radio.Button>
                    
                    <Radio.Button 
                      value="spi-bootloader"
                      style={{ 
                        height: 'auto', 
                        padding: '12px',
                        textAlign: 'left'
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '4px' }}>
                          <DesktopOutlined style={{ marginRight: '8px' }} />
                          Write SPI Bootloader
                        </div>
                        <div style={{ color: colors.text.secondary }}>
                          Write bootloader to SPI flash for NVMe boot support
                        </div>
                      </div>
                    </Radio.Button>
                  </div>
                </Radio.Group>
              </Card>
            )}

            {/* Step 4: Device Selection */}
            {currentStep === (flashMethod === 'webusb' ? 4 : 3) && (
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
                              await WebUSBRockchipFlasher.requestDevice();
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
            {currentStep === (flashMethod === 'webusb' ? 5 : 4) && (flashMethod === 'webusb' && webUSBStorageDevices.length > 0) && spiOperationMode === 'normal' && (
              <Card 
                title={
                  <Space>
                    <InfoCircleOutlined style={{ color: colors.accent[500] }} />
                    <span>Step {flashMethod === 'webusb' ? '6' : '5'}: Select Target Storage Device</span>
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
            {((flashMethod === 'webusb' && currentStep >= 5) || (flashMethod === 'browser' && currentStep >= 4)) && 
             (!(flashMethod === 'webusb' && webUSBStorageDevices.length > 0 && spiOperationMode === 'normal') || selectedStorage || spiOperationMode !== 'normal') && (
              <Card 
                title={
                  <Space>
                    <CheckCircleOutlined style={{ color: colors.accent[500] }} />
                    <span>
                      {spiOperationMode === 'spi-clear' ? 'Clear SPI Flash' : 
                       spiOperationMode === 'spi-bootloader' ? 'Write SPI Bootloader' : 
                       'Flash to Device'}
                    </span>
                  </Space>
                }
                style={{ backgroundColor: colors.background.primary }}
              >
                {!isFlashing ? (
                  <div>
                    {spiOperationMode === 'normal' && (
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
                    )}

                    {spiOperationMode === 'spi-clear' && (
                      <Alert
                        message="Ready to Clear SPI Flash"
                        description={
                          <div>
                            <div><strong>Operation:</strong> Clear entire SPI NOR flash</div>
                            <div><strong>Device:</strong> {
                              selectedDevice && 'chipType' in selectedDevice ? `${selectedDevice.chipType} v${selectedDevice.version}` :
                              'No device selected'
                            }</div>
                            <div style={{ marginTop: '8px', color: '#ff4d4f' }}>
                              <ExclamationCircleOutlined style={{ marginRight: '4px' }} />
                              <strong>Warning:</strong> This will completely erase the SPI flash chip!
                            </div>
                          </div>
                        }
                        type="warning"
                        showIcon
                        style={{ marginBottom: '16px' }}
                      />
                    )}

                    {spiOperationMode === 'spi-bootloader' && (
                      <Alert
                        message="Ready to Write SPI Bootloader"
                        description={
                          <div>
                            <div><strong>Operation:</strong> Write bootloader to SPI NOR flash</div>
                            <div><strong>Bootloader Files:</strong> Auto-detected Rock 5B bootloader components</div>
                            <div style={{ marginLeft: '20px', fontSize: '12px', color: colors.text.secondary }}>
                              • rock5b_idbloader.img (~500KB)<br/>
                              • rock5b_u-boot.itb (~500KB)
                            </div>
                            <div><strong>Device:</strong> {
                              selectedDevice && 'chipType' in selectedDevice ? `${selectedDevice.chipType} v${selectedDevice.version}` :
                              'No device selected'
                            }</div>
                            <div style={{ marginTop: '8px', color: '#1890ff' }}>
                              <InfoCircleOutlined style={{ marginRight: '4px' }} />
                              This will enable NVMe boot support on your device.
                            </div>
                          </div>
                        }
                        type="info"
                        showIcon
                        style={{ marginBottom: '16px' }}
                      />
                    )}

                    {/* Reboot option for WebUSB */}
                    {flashMethod === 'webusb' && (
                      <div style={{ marginBottom: '16px' }}>
                        <Space>
                          <input
                            type="checkbox"
                            id="reboot-after-flash"
                            checked={rebootAfterFlash}
                            onChange={(e) => setRebootAfterFlash(e.target.checked)}
                            style={{ marginRight: '8px' }}
                          />
                          <label htmlFor="reboot-after-flash" style={{ cursor: 'pointer' }}>
                            Reboot device after operation completes
                          </label>
                          <Tooltip title="Automatically reboot the device after flashing/operation is complete">
                            <InfoCircleOutlined style={{ color: colors.text.secondary }} />
                          </Tooltip>
                        </Space>
                      </div>
                    )}
                    
                    <div style={{ textAlign: 'center' }}>
                      {spiOperationMode === 'normal' && (
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
                      )}

                      {spiOperationMode === 'spi-clear' && (
                        <Button 
                          type="primary" 
                          size="large"
                          danger
                          icon={<ExclamationCircleOutlined />}
                          onClick={handleSPIClear}
                          style={{ 
                            height: '48px', 
                            fontSize: '16px'
                          }}
                        >
                          Clear SPI Flash
                        </Button>
                      )}

                      {spiOperationMode === 'spi-bootloader' && (
                        <Button 
                          type="primary" 
                          size="large"
                          icon={<DesktopOutlined />}
                          onClick={handleSPIBootloaderWrite}
                          style={{ 
                            height: '48px', 
                            fontSize: '16px',
                            backgroundColor: colors.accent[500],
                            borderColor: colors.accent[500]
                          }}
                        >
                          Write SPI Bootloader
                        </Button>
                      )}

                      {/* Manual reboot button */}
                      {flashMethod === 'webusb' && selectedDevice && 'chipType' in selectedDevice && (
                        <Button 
                          style={{ marginLeft: '16px' }}
                          icon={<ReloadOutlined />}
                          onClick={handleDeviceReboot}
                          disabled={isFlashing}
                        >
                          Reboot Device
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    {flashProgress && (
                      <div>
                        <div style={{ marginBottom: '16px', textAlign: 'center' }}>
                          <Title level={4} style={{ color: colors.text.primary }}>
                            {flashProgress.phase === 'completed' ? 
                              (spiOperationMode === 'spi-clear' ? 'SPI Clear Completed!' :
                               spiOperationMode === 'spi-bootloader' ? 'SPI Bootloader Written!' : 'Flash Completed!') : 
                             flashProgress.phase === 'failed' ? 
                              (spiOperationMode === 'spi-clear' ? 'SPI Clear Failed' :
                               spiOperationMode === 'spi-bootloader' ? 'SPI Bootloader Failed' : 'Flash Failed') : 
                              (spiOperationMode === 'spi-clear' ? 'Clearing SPI Flash...' :
                               spiOperationMode === 'spi-bootloader' ? 'Writing SPI Bootloader...' : 'Flashing in Progress...')}
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
                          size="default"
                          showInfo={true}
                        />
                        
                        <div style={{ 
                          backgroundColor: colors.background.secondary, 
                          padding: '12px', 
                          borderRadius: '6px', 
                          marginBottom: '16px' 
                        }}>
                          <Text style={{ color: colors.text.primary, fontWeight: 'bold' }}>
                            Current Step: 
                          </Text>
                          <br />
                          <Text style={{ color: colors.text.secondary }}>
                            {flashProgress.message}
                          </Text>
                        </div>
                        
                        {flashProgress.bytesTransferred && flashProgress.totalBytes && (
                          <div style={{ marginBottom: '16px' }}>
                            <Row justify="space-between">
                              <Col>
                                <Text type="secondary">
                                  Data transferred: {formatFileSize(flashProgress.bytesTransferred)} / {formatFileSize(flashProgress.totalBytes)}
                                </Text>
                              </Col>
                              <Col>
                                <Text type="secondary">
                                  {Math.round((flashProgress.bytesTransferred / flashProgress.totalBytes) * 100)}% complete
                                </Text>
                              </Col>
                            </Row>
                          </div>
                        )}

                        {(flashProgress.phase === 'completed' || flashProgress.phase === 'failed') && (
                          <div style={{ textAlign: 'center', marginTop: '24px' }}>
                            <Button onClick={handleReset} type="primary">
                              {spiOperationMode === 'spi-clear' ? 'Perform Another Operation' :
                               spiOperationMode === 'spi-bootloader' ? 'Flash Another Bootloader' : 'Flash Another Image'}
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
                    {WebUSBRockchipFlasher.isSupported() && (
                      <Button 
                        size="small" 
                        icon={<UsbOutlined />} 
                        onClick={async () => {
                          try {
                            await WebUSBRockchipFlasher.requestDevice();
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
                  {!WebUSBRockchipFlasher.isSupported() ? (
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

            {/* SPI Operations Info */}
            {flashMethod === 'webusb' && (
              <Card 
                title="SPI Flash Operations" 
                style={{ 
                  marginBottom: '16px',
                  backgroundColor: colors.background.primary 
                }}
              >
                <div style={{ fontSize: '14px' }}>
                  <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: colors.accent[500] }}>Normal Flash:</Text>
                    <br />
                    <Text type="secondary">Flash full OS images to eMMC, SD, or NVMe storage.</Text>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: '#ff7875' }}>SPI Clear:</Text>
                    <br />
                    <Text type="secondary">Completely erase SPI flash to remove old bootloaders.</Text>
                  </div>
                  
                  <div style={{ marginBottom: '12px' }}>
                    <Text strong style={{ color: '#52c41a' }}>SPI Bootloader:</Text>
                    <br />
                    <Text type="secondary">Write bootloader to SPI flash for NVMe boot support.</Text>
                  </div>

                  <Alert
                    message="Why SPI Flash?"
                    description="SPI flash stores the bootloader that enables your device to boot from NVMe storage. Update it when switching storage types or fixing boot issues."
                    type="info"
                    showIcon
                  />
                </div>
              </Card>
            )}

            {/* Debug Information */}
            <SerialDebugInfo />
            
          </Col>
        </Row>
      </div>
    </div>
  );
}; 