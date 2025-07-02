import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Select, 
  Alert, 
  Typography, 
  Space, 
  Divider,
  Row,
  Col,
  Tag,
  Tooltip,
  Empty,
  Spin,
  App,
  notification,
  Steps,
  Modal
} from 'antd';
import { 
  UsbOutlined, 
  ThunderboltOutlined, 
  CheckCircleOutlined, 
  ExclamationCircleOutlined,
  ReloadOutlined,
  ClearOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  WarningOutlined,
  RocketOutlined
} from '@ant-design/icons';
import { WebUSBRockchipFlasher, RockchipDevice, FlashProgress } from '../services/webUSBFlasher';
import { SegmentedProgressBar } from '../components/SegmentedProgressBar';
import { colors } from '../styles/design-tokens';

const { Title, Text, Paragraph } = Typography;

interface FlashProgressWeb {
  phase: 'detecting' | 'connecting' | 'loading_bootloader' | 'writing' | 'verifying' | 'completed' | 'failed';
  progress: number;
  message: string;
  bytesTransferred?: number;
  totalBytes?: number;
}

export const HardwareUtilitiesPanel: React.FC = () => {
  const { message: messageApi } = App.useApp();
  const [rockchipDevices, setRockchipDevices] = useState<RockchipDevice[]>([]);
  const [selectedDevice, setSelectedDevice] = useState<RockchipDevice | null>(null);
  const [flashProgress, setFlashProgress] = useState<FlashProgressWeb | null>(null);
  const [isOperationRunning, setIsOperationRunning] = useState(false);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Fetch Rockchip USB devices (WebUSB)
  const fetchRockchipDevices = async () => {
    if (!WebUSBRockchipFlasher.isSupported()) return;
    
    setLoadingDevices(true);
    try {
      const devices = await WebUSBRockchipFlasher.getAvailableDevices();
      setRockchipDevices(devices);
      console.log('🔍 Found Rockchip devices:', devices);
    } catch (error) {
      console.error('Failed to fetch Rockchip devices:', error);
      messageApi.error('Failed to fetch Rockchip devices');
    } finally {
      setLoadingDevices(false);
    }
  };

  // Request new device access
  const requestNewDevice = async () => {
    try {
      const device = await WebUSBRockchipFlasher.requestDevice();
      await fetchRockchipDevices();
      setSelectedDevice(device);
      messageApi.success('Device connected successfully');
    } catch (error) {
      console.error('Failed to request device:', error);
      if (error instanceof Error && error.name === 'NotFoundError') {
        messageApi.warning('No device selected');
      } else {
        messageApi.error('Failed to connect to device');
      }
    }
  };

  useEffect(() => {
    fetchRockchipDevices();
  }, []);

  // Handle SPI clear operation
  const handleSPIClear = async () => {
    if (!selectedDevice) {
      messageApi.error('Please select a Rockchip device');
      return;
    }

    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: 'Clear SPI Flash',
        content: (
          <div>
            <p><strong>This will completely erase your SPI flash chip!</strong></p>
            <p>This action will:</p>
            <ul>
              <li>Remove all bootloader data from SPI flash</li>
              <li>Make the device unable to boot from SPI</li>
              <li>Require reinstalling a bootloader before normal use</li>
            </ul>
            <p>Are you sure you want to continue?</p>
          </div>
        ),
        icon: <WarningOutlined style={{ color: 'red' }} />,
        okText: 'Yes, Clear SPI Flash',
        okType: 'danger',
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false)
      });
    });

    if (!confirmed) return;

    setIsOperationRunning(true);

    try {
      await WebUSBRockchipFlasher.clearSPIFlash(
        selectedDevice,
        (progress) => {
          const webProgress: FlashProgressWeb = {
            phase: progress.phase,
            progress: progress.progress,
            message: progress.message,
            bytesTransferred: progress.bytesWritten,
            totalBytes: progress.totalBytes
          };
          setFlashProgress(webProgress);
        }
      );
      
      // Show comprehensive success message for SPI clear
      messageApi.success({
        content: 'SPI flash cleared successfully! The device is ready for new bootloader installation.',
        duration: 6,
        style: { fontWeight: 'bold' }
      });
      
      // Show detailed success notification
      notification.success({
        message: 'SPI Flash Cleared',
        description: 'The SPI flash chip has been completely erased. You can now write a new bootloader or perform other operations.',
        duration: 8,
        placement: 'topRight'
      });
    } catch (error) {
      console.error('SPI clear failed:', error);
      messageApi.error(`Failed to clear SPI flash: ${error instanceof Error ? error.message : String(error)}`);
      
      setFlashProgress({
        phase: 'failed',
        progress: 0,
        message: `SPI clear failed: ${error instanceof Error ? error.message : String(error)}`
      });
    } finally {
      setIsOperationRunning(false);
    }
  };

  // Handle SPI bootloader write
  const handleSPIBootloaderWrite = async () => {
    if (!selectedDevice) {
      messageApi.error('Please select a Rockchip device');
      return;
    }

    setIsOperationRunning(true);
    let operationSucceeded = false;

    try {
      console.log('🚀 Starting SPI bootloader write operation...');
      
      await WebUSBRockchipFlasher.writeSPIBootloaderAuto(
        selectedDevice,
        (progress) => {
          console.log('📊 SPI Bootloader Progress:', progress);
          const webProgress: FlashProgressWeb = {
            phase: progress.phase,
            progress: progress.progress,
            message: progress.message,
            bytesTransferred: progress.bytesWritten,
            totalBytes: progress.totalBytes
          };
          setFlashProgress(webProgress);
          
          // Check if operation completed successfully
          if (progress.phase === 'completed' && progress.progress === 100) {
            operationSucceeded = true;
          }
        }
      );
      
      // Show success message and notification
      operationSucceeded = true;
      messageApi.success({
        content: 'SPI bootloader written successfully! Your device is now ready to boot.',
        duration: 6,
        style: { fontWeight: 'bold' }
      });
      
      // Show a more prominent success notification
      notification.success({
        message: 'Bootloader Write Successful',
        description: 'The SPI bootloader has been successfully written to your device. You can now disconnect and boot your device normally.',
        duration: 8,
        placement: 'topRight'
      });
      
    } catch (error) {
      console.error('SPI bootloader write failed:', error);
      
      // Enhanced error message for bootloader setup
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('too small') || errorMessage.includes('not found')) {
        Modal.error({
          title: 'Bootloader Files Missing',
          content: (
            <div>
              <p><strong>Real bootloader files are required for SPI operations.</strong></p>
              <p>The system detected placeholder or missing bootloader files.</p>
              <br />
              <p><strong>To fix this:</strong></p>
              <ol>
                <li>Build Armbian for your device to generate bootloader files</li>
                <li>Or extract bootloader files from an existing Armbian image</li>
                <li>Place files in: <code>backend/data/bootloader/rk3588/</code></li>
              </ol>
              <br />
              <p><strong>Required files:</strong></p>
              <ul>
                <li><code>rock5b_idbloader.img</code> (should be &gt;200KB)</li>
                <li><code>rock5b_u-boot.itb</code> (should be &gt;400KB)</li>
              </ul>
              <br />
              <p><strong>Error:</strong> {errorMessage}</p>
            </div>
          ),
          width: 600
        });
      } else {
        messageApi.error(`SPI bootloader write failed: ${errorMessage}`);
      }
      
      setFlashProgress({
        phase: 'failed',
        progress: 0,
        message: `SPI bootloader write failed: ${errorMessage}`
      });
    } finally {
      setIsOperationRunning(false);
      
      // If operation succeeded but there was some other issue, still show partial success
      if (operationSucceeded && flashProgress?.phase === 'completed') {
        messageApi.info('Bootloader operation completed. Please check the detailed status above.');
      }
    }
  };

  // Handle device reboot
  const handleDeviceReboot = async () => {
    if (!selectedDevice) {
      messageApi.error('Device reboot requires a WebUSB Rockchip device');
      return;
    }

    try {
      messageApi.info('Sending reboot command to device...');
      await WebUSBRockchipFlasher.rebootDevice(selectedDevice);
      
      // Show comprehensive success message
      messageApi.success({
        content: 'Device reboot command sent successfully!',
        duration: 5,
        style: { fontWeight: 'bold' }
      });
      
      // Show detailed success notification
      notification.success({
        message: 'Device Reboot Initiated',
        description: 'The reboot command has been sent to your device. It should start normally with the new bootloader or image.',
        duration: 8,
        placement: 'topRight'
      });
      
      // Clear device selection since device will disconnect
      setTimeout(() => {
        setSelectedDevice(null);
        setRockchipDevices([]);
        messageApi.info('Device disconnected after reboot. Reconnect if needed for further operations.');
      }, 2000);
    } catch (error) {
      console.error('Device reboot failed:', error);
      messageApi.error(`Device reboot failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  const hasWebUSBSupport = WebUSBRockchipFlasher.isSupported();

  return (
    <div style={{ 
      height: '100%', 
      backgroundColor: colors.background.secondary,
      padding: '24px',
      overflow: 'auto'
    }}>
      <div style={{ maxWidth: '800px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <Title level={2} style={{ color: colors.accent[500], marginBottom: '8px' }}>
            <SettingOutlined style={{ marginRight: '12px' }} />
            Hardware Utilities
          </Title>
          <Paragraph style={{ color: colors.text.secondary, fontSize: '16px' }}>
            Standalone SPI flash operations for Rockchip devices - no build required
          </Paragraph>
        </div>

        {/* WebUSB Support Check */}
        {!hasWebUSBSupport && (
          <Alert
            message="WebUSB Not Supported"
            description="Your browser doesn't support WebUSB or you're not on a secure connection (HTTPS/localhost required)."
            type="error"
            showIcon
            style={{ marginBottom: '24px' }}
          />
        )}

        {/* Device Selection */}
        <Card 
          title={
            <Space>
              <UsbOutlined style={{ color: colors.accent[500] }} />
              <span>Device Selection</span>
            </Space>
          }
          style={{ marginBottom: '24px', backgroundColor: colors.background.primary }}
          extra={
            <Space>
              <Button 
                icon={<ReloadOutlined />} 
                onClick={fetchRockchipDevices}
                loading={loadingDevices}
                size="small"
              >
                Refresh
              </Button>
              <Button 
                type="primary" 
                icon={<UsbOutlined />}
                onClick={requestNewDevice}
                disabled={!hasWebUSBSupport}
              >
                Connect Device
              </Button>
            </Space>
          }
        >
          {rockchipDevices.length === 0 ? (
            <Empty 
              description={
                hasWebUSBSupport 
                  ? "No Rockchip devices found. Connect your device in maskrom mode and click 'Connect Device'."
                  : "WebUSB not supported in this browser"
              }
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            />
          ) : (
            <div style={{ display: 'grid', gap: '12px' }}>
              {rockchipDevices.map((device, index) => (
                <Card
                  key={index}
                  size="small"
                  hoverable
                  onClick={() => setSelectedDevice(device)}
                  style={{ 
                    cursor: 'pointer',
                    border: selectedDevice === device ? 
                      `2px solid ${colors.accent[500]}` : 
                      `1px solid ${colors.border.light}`
                  }}
                >
                  <Row justify="space-between" align="middle">
                    <Col>
                      <Text strong style={{ color: colors.text.primary }}>
                        {device.chipType} Device
                      </Text>
                      <br />
                      <Text type="secondary">
                        Mode: {device.mode} • Version: {device.version}
                      </Text>
                    </Col>
                    <Col>
                      <Tag color={device.mode === 'maskrom' ? 'orange' : 'blue'}>
                        {device.mode}
                      </Tag>
                      {selectedDevice === device && (
                        <Tag color="green">Selected</Tag>
                      )}
                    </Col>
                  </Row>
                </Card>
              ))}
            </div>
          )}
        </Card>

        {/* Operations */}
        <Card 
          title={
            <Space>
              <SettingOutlined style={{ color: colors.accent[500] }} />
              <span>SPI Flash Operations</span>
            </Space>
          }
          style={{ marginBottom: '24px', backgroundColor: colors.background.primary }}
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Card size="small" style={{ height: '100%' }}>
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <ClearOutlined style={{ fontSize: '32px', color: colors.accent[500], marginBottom: '12px' }} />
                  <Title level={4}>Clear SPI Flash</Title>
                  <Paragraph type="secondary" style={{ fontSize: '14px', marginBottom: '16px' }}>
                    Completely erase the SPI flash chip. Use this to remove old bootloaders or prepare for fresh installation.
                  </Paragraph>
                  <Button 
                    type="primary" 
                    danger
                    block
                    icon={<ClearOutlined />}
                    onClick={handleSPIClear}
                    disabled={!selectedDevice || isOperationRunning}
                    loading={isOperationRunning && flashProgress?.phase !== 'completed'}
                  >
                    Clear SPI Flash
                  </Button>
                </div>
              </Card>
            </Col>

            <Col xs={24} md={12}>
              <Card size="small" style={{ height: '100%' }}>
                <div style={{ textAlign: 'center', padding: '16px' }}>
                  <RocketOutlined style={{ fontSize: '32px', color: colors.accent[500], marginBottom: '12px' }} />
                  <Title level={4}>Write SPI Bootloader</Title>
                  <Paragraph type="secondary" style={{ fontSize: '14px', marginBottom: '16px' }}>
                    Install the appropriate bootloader for your device to SPI flash. This enables booting from eMMC/SD.
                  </Paragraph>
                  <Button 
                    type="primary"
                    block
                    icon={<RocketOutlined />}
                    onClick={handleSPIBootloaderWrite}
                    disabled={!selectedDevice || isOperationRunning}
                    loading={isOperationRunning && flashProgress?.phase !== 'completed'}
                  >
                    Write Bootloader
                  </Button>
                </div>
              </Card>
            </Col>
          </Row>

          <Divider />

          <Row>
            <Col span={24}>
              <div style={{ textAlign: 'center' }}>
                <Title level={4}>Device Controls</Title>
                <Space>
                  <Button 
                    icon={<ReloadOutlined />}
                    onClick={handleDeviceReboot}
                    disabled={!selectedDevice || isOperationRunning}
                  >
                    Reboot Device
                  </Button>
                  <Tooltip title="Refresh device list">
                    <Button 
                      icon={<ReloadOutlined />}
                      onClick={fetchRockchipDevices}
                      loading={loadingDevices}
                    >
                      Refresh Devices
                    </Button>
                  </Tooltip>
                </Space>
              </div>
            </Col>
          </Row>
        </Card>

                 {/* Progress Display */}
         {flashProgress && (
           <Card 
             title="Operation Progress"
             style={{ backgroundColor: colors.background.primary }}
           >
             <SegmentedProgressBar 
               currentPhase={flashProgress.phase}
               progress={flashProgress.progress}
               message={flashProgress.message}
               error={flashProgress.phase === 'failed'}
               variant="spi"
             />
           </Card>
         )}

        {/* Instructions */}
        <Card 
          title={
            <Space>
              <InfoCircleOutlined style={{ color: colors.accent[500] }} />
              <span>Instructions</span>
            </Space>
          }
          style={{ backgroundColor: colors.background.primary }}
        >
          <div style={{ fontSize: '14px' }}>
            <Title level={5}>Before You Start:</Title>
            <ol style={{ paddingLeft: '20px', marginBottom: '16px' }}>
              <li>Put your Rockchip device in <strong>maskrom mode</strong></li>
              <li>Connect the device to your computer via USB</li>
              <li>Click "Connect Device" to grant browser access</li>
              <li>Select your device from the list</li>
            </ol>

            <Title level={5}>SPI Operations:</Title>
            <ul style={{ paddingLeft: '20px', marginBottom: '16px' }}>
              <li><strong>Clear SPI Flash:</strong> Completely erases the SPI flash chip</li>
              <li><strong>Write Bootloader:</strong> Installs bootloader files to enable normal booting</li>
              <li><strong>Reboot Device:</strong> Restarts the device after operations</li>
            </ul>

            <Alert 
              type="warning" 
              message="Important Note"
              description="These operations directly modify your device's boot flash. Ensure you have proper bootloader files available before writing to SPI."
              showIcon
              style={{ marginTop: '16px' }}
            />
          </div>
        </Card>
      </div>
    </div>
  );
}; 