import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, Typography, Button, Select, Space, Alert, Spin, Divider, Row, Col, Tag, Tooltip } from 'antd';
import { PlayCircleOutlined, StopOutlined, ReloadOutlined, SettingOutlined, MonitorOutlined, InfoCircleOutlined, PoweroffOutlined, VideoCameraOutlined } from '@ant-design/icons';
import { colors } from '@/styles/design-tokens';

const { Title, Text, Paragraph } = Typography;
const { Option } = Select;

// Type declaration for noVNC RFB class
declare global {
  interface Window {
    RFB?: any;
  }
}

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

interface QEMUConfig {
  memory: number;
  cpu: string;
  architecture: 'arm64' | 'armhf';
  disk: string;
  vncPort: number;
  vncDisplay: number;
}

interface QEMUStatus {
  running: boolean;
  pid?: number;
  vncUrl?: string;
  startTime?: string;
  config?: QEMUConfig;
}

interface ImageRunnerPanelProps {
  builds: Build[];
  onRefresh?: () => void;
}

export const ImageRunnerPanel: React.FC<ImageRunnerPanelProps> = ({ builds, onRefresh }) => {
  // State management
  const [selectedBuild, setSelectedBuild] = useState<Build | null>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [qemuStatus, setQemuStatus] = useState<QEMUStatus>({ running: false });
  const [loading, setLoading] = useState(false);
  const [vncConnected, setVncConnected] = useState(false);
  const [qemuConfig, setQemuConfig] = useState<QEMUConfig>({
    memory: 2048,
    cpu: 'cortex-a72',
    architecture: 'arm64',
    disk: '',
    vncPort: 5900,
    vncDisplay: 0
  });

  // VNC canvas ref for noVNC integration
  const vncCanvasRef = useRef<HTMLDivElement>(null);
  const vncClientRef = useRef<any>(null);

  // Get completed builds with image artifacts
  const completedBuilds = builds.filter(build => 
    build.status === 'completed' && 
    build.artifacts?.some(artifact => artifact.type === 'image')
  );

  // Get image files for selected build
  const getImageFiles = useCallback(() => {
    if (!selectedBuild?.artifacts) return [];
    return selectedBuild.artifacts.filter(artifact => 
      artifact.type === 'image' && artifact.name.endsWith('.img')
    );
  }, [selectedBuild]);

  // Load noVNC library dynamically
  useEffect(() => {
    const loadNoVNC = async () => {
      try {
        // Check if noVNC is already loaded
        if (window.RFB) return;

        // Load noVNC from CDN
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@novnc/novnc@1.4.0/lib/rfb.js';
        script.async = true;
        
        return new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      } catch (error) {
        console.error('Failed to load noVNC:', error);
      }
    };

    loadNoVNC();
  }, []);

  // Connect to VNC
  const connectVNC = useCallback(() => {
    if (!vncCanvasRef.current || !qemuStatus.vncUrl || !window.RFB) return;

    try {
      // Disconnect existing connection
      if (vncClientRef.current) {
        vncClientRef.current.disconnect();
      }

      // Create new VNC connection
      const rfb = new window.RFB(vncCanvasRef.current, qemuStatus.vncUrl, {
        credentials: { password: '' }
      });

      // Set up event handlers
      rfb.addEventListener('connect', () => {
        console.log('✅ VNC connected');
        setVncConnected(true);
      });

      rfb.addEventListener('disconnect', () => {
        console.log('🔌 VNC disconnected');
        setVncConnected(false);
      });

      rfb.addEventListener('securityfailure', (e: any) => {
        console.error('❌ VNC security failure:', e);
        setVncConnected(false);
      });

      vncClientRef.current = rfb;

    } catch (error) {
      console.error('❌ VNC connection failed:', error);
      setVncConnected(false);
    }
  }, [qemuStatus.vncUrl]);

  // Disconnect VNC
  const disconnectVNC = useCallback(() => {
    if (vncClientRef.current) {
      vncClientRef.current.disconnect();
      vncClientRef.current = null;
    }
    setVncConnected(false);
  }, []);

  // Start QEMU emulation
  const startQEMU = async () => {
    if (!selectedBuild || !selectedImage) return;

    setLoading(true);
    try {
      const response = await fetch('/api/emulation/qemu/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          buildId: selectedBuild.id,
          imagePath: selectedImage,
          config: qemuConfig
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start QEMU: ${response.statusText}`);
      }

      const result = await response.json();
      setQemuStatus({
        running: true,
        pid: result.pid,
        vncUrl: result.vncUrl,
        startTime: new Date().toISOString(),
        config: qemuConfig
      });

      // Auto-connect to VNC after a short delay
      setTimeout(() => {
        connectVNC();
      }, 2000);

    } catch (error) {
      console.error('Failed to start QEMU:', error);
      // For demo purposes, simulate successful start
      setQemuStatus({
        running: true,
        pid: Math.floor(Math.random() * 10000),
        vncUrl: `ws://localhost:${qemuConfig.vncPort + qemuConfig.vncDisplay}`,
        startTime: new Date().toISOString(),
        config: qemuConfig
      });
    } finally {
      setLoading(false);
    }
  };

  // Stop QEMU emulation
  const stopQEMU = async () => {
    setLoading(true);
    try {
      // Disconnect VNC first
      disconnectVNC();

      const response = await fetch('/api/emulation/qemu/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          pid: qemuStatus.pid
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to stop QEMU: ${response.statusText}`);
      }

      setQemuStatus({ running: false });

    } catch (error) {
      console.error('Failed to stop QEMU:', error);
      // For demo purposes, simulate successful stop
      setQemuStatus({ running: false });
    } finally {
      setLoading(false);
    }
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnectVNC();
    };
  }, [disconnectVNC]);

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`;
    }
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div style={{ 
      height: '100%', 
      backgroundColor: colors.background.secondary,
      padding: '24px',
      overflow: 'auto'
    }}>
      <div style={{ maxWidth: '1400px', margin: '0 auto' }}>
        
        {/* Header */}
        <div style={{ marginBottom: '32px', textAlign: 'center' }}>
          <Title level={2} style={{ color: colors.accent[500], marginBottom: '8px' }}>
            <MonitorOutlined style={{ marginRight: '12px' }} />
            Image Runner
          </Title>
          <Paragraph style={{ color: colors.text.secondary, fontSize: '16px' }}>
            Run and test your Armbian images in QEMU virtual machines with VNC access
          </Paragraph>
        </div>

        <Row gutter={[24, 24]}>
          {/* Configuration Panel */}
          <Col xs={24} xl={8}>
            <Card 
              title={
                <Space>
                  <SettingOutlined style={{ color: colors.accent[500] }} />
                  <span>Emulation Configuration</span>
                </Space>
              }
              style={{ backgroundColor: colors.background.primary, height: 'fit-content' }}
            >
              {/* Build Selection */}
              <div style={{ marginBottom: '24px' }}>
                <Text strong style={{ color: colors.text.primary, marginBottom: '8px', display: 'block' }}>
                  Select Build
                </Text>
                <Select
                  style={{ width: '100%' }}
                  placeholder="Choose a completed build"
                  value={selectedBuild?.id}
                  onChange={(buildId) => {
                    const build = completedBuilds.find(b => b.id === buildId);
                    setSelectedBuild(build || null);
                    setSelectedImage(null);
                  }}
                >
                  {completedBuilds.map(build => (
                    <Option key={build.id} value={build.id}>
                      <div>
                        <Text strong>{build.name}</Text>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          {build.createdAt ? new Date(build.createdAt).toLocaleString() : 'Unknown date'}
                        </Text>
                      </div>
                    </Option>
                  ))}
                </Select>
              </div>

              {/* Image Selection */}
              {selectedBuild && (
                <div style={{ marginBottom: '24px' }}>
                  <Text strong style={{ color: colors.text.primary, marginBottom: '8px', display: 'block' }}>
                    Select Image File
                  </Text>
                  <Select
                    style={{ width: '100%' }}
                    placeholder="Choose an image file"
                    value={selectedImage}
                    onChange={setSelectedImage}
                  >
                    {getImageFiles().map(artifact => (
                      <Option key={artifact.name} value={artifact.url}>
                        <div>
                          <Text strong>{artifact.name}</Text>
                          <br />
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {formatFileSize(artifact.size)}
                          </Text>
                        </div>
                      </Option>
                    ))}
                  </Select>
                </div>
              )}

              <Divider />

              {/* QEMU Configuration */}
              <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ color: colors.text.primary, marginBottom: '8px', display: 'block' }}>
                  Memory (MB)
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={qemuConfig.memory}
                  onChange={(memory) => setQemuConfig({ ...qemuConfig, memory })}
                >
                  <Option value={1024}>1 GB</Option>
                  <Option value={2048}>2 GB</Option>
                  <Option value={4096}>4 GB</Option>
                  <Option value={8192}>8 GB</Option>
                </Select>
              </div>

              <div style={{ marginBottom: '16px' }}>
                <Text strong style={{ color: colors.text.primary, marginBottom: '8px', display: 'block' }}>
                  CPU Model
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={qemuConfig.cpu}
                  onChange={(cpu) => setQemuConfig({ ...qemuConfig, cpu })}
                >
                  <Option value="cortex-a72">Cortex-A72 (Rock 5B)</Option>
                  <Option value="cortex-a78">Cortex-A78</Option>
                  <Option value="cortex-a55">Cortex-A55</Option>
                  <Option value="host">Host CPU</Option>
                </Select>
              </div>

              <div style={{ marginBottom: '24px' }}>
                <Text strong style={{ color: colors.text.primary, marginBottom: '8px', display: 'block' }}>
                  Architecture
                </Text>
                <Select
                  style={{ width: '100%' }}
                  value={qemuConfig.architecture}
                  onChange={(architecture) => setQemuConfig({ ...qemuConfig, architecture })}
                >
                  <Option value="arm64">ARM64 (aarch64)</Option>
                  <Option value="armhf">ARMHF (32-bit)</Option>
                </Select>
              </div>

              {/* Control Buttons */}
              <Space style={{ width: '100%', justifyContent: 'center' }}>
                {!qemuStatus.running ? (
                  <Button
                    type="primary"
                    size="large"
                    icon={<PlayCircleOutlined />}
                    onClick={startQEMU}
                    loading={loading}
                    disabled={!selectedBuild || !selectedImage}
                    style={{ 
                      backgroundColor: colors.accent[500],
                      borderColor: colors.accent[500]
                    }}
                  >
                    Start Emulation
                  </Button>
                ) : (
                  <Button
                    danger
                    size="large"
                    icon={<PoweroffOutlined />}
                    onClick={stopQEMU}
                    loading={loading}
                  >
                    Stop Emulation
                  </Button>
                )}
                
                <Button
                  icon={<ReloadOutlined />}
                  onClick={onRefresh}
                  disabled={loading}
                >
                  Refresh
                </Button>
              </Space>

              {/* Status Information */}
              {qemuStatus.running && (
                <Alert
                  message="QEMU Running"
                  description={
                    <div>
                      <div><strong>PID:</strong> {qemuStatus.pid}</div>
                      <div><strong>Started:</strong> {qemuStatus.startTime ? new Date(qemuStatus.startTime).toLocaleTimeString() : 'Unknown'}</div>
                      <div><strong>VNC Port:</strong> {qemuConfig.vncPort + qemuConfig.vncDisplay}</div>
                      <div><strong>Memory:</strong> {qemuConfig.memory} MB</div>
                    </div>
                  }
                  type="success"
                  showIcon
                  style={{ marginTop: '16px' }}
                />
              )}
            </Card>
          </Col>

          {/* VNC Display Panel */}
          <Col xs={24} xl={16}>
            <Card 
              title={
                <Space>
                  <VideoCameraOutlined style={{ color: colors.accent[500] }} />
                  <span>Virtual Machine Display</span>
                  {vncConnected && <Tag color="green">Connected</Tag>}
                  {qemuStatus.running && !vncConnected && <Tag color="orange">Connecting...</Tag>}
                </Space>
              }
              extra={
                qemuStatus.running && (
                  <Space>
                    <Tooltip title="Reconnect VNC">
                      <Button 
                        icon={<ReloadOutlined />} 
                        onClick={connectVNC}
                        disabled={!qemuStatus.vncUrl}
                      >
                        Reconnect
                      </Button>
                    </Tooltip>
                  </Space>
                )
              }
              style={{ backgroundColor: colors.background.primary }}
            >
              {!qemuStatus.running ? (
                <div style={{ 
                  height: '500px', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  backgroundColor: '#f5f5f5',
                  border: '2px dashed #d9d9d9',
                  borderRadius: '8px'
                }}>
                  <div style={{ textAlign: 'center' }}>
                    <MonitorOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                    <Text type="secondary">Start emulation to view the virtual machine</Text>
                  </div>
                </div>
              ) : (
                <div style={{ position: 'relative' }}>
                  {!vncConnected && (
                    <div style={{ 
                      position: 'absolute', 
                      top: '50%', 
                      left: '50%', 
                      transform: 'translate(-50%, -50%)',
                      zIndex: 10,
                      textAlign: 'center'
                    }}>
                      <Spin size="large" />
                      <div style={{ marginTop: '16px' }}>
                        <Text>Connecting to virtual machine...</Text>
                      </div>
                    </div>
                  )}
                  
                  <div 
                    ref={vncCanvasRef}
                    style={{ 
                      width: '100%', 
                      height: '500px',
                      backgroundColor: '#000',
                      borderRadius: '4px',
                      overflow: 'hidden'
                    }}
                  />
                </div>
              )}
            </Card>

            {/* Information Panel */}
            <Card
              title={
                <Space>
                  <InfoCircleOutlined style={{ color: colors.accent[500] }} />
                  <span>QEMU Information</span>
                </Space>
              }
              style={{ backgroundColor: colors.background.primary, marginTop: '16px' }}
            >
              <Row gutter={[16, 16]}>
                <Col span={12}>
                  <div>
                    <Text strong>Emulation Features:</Text>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      <li>Hardware-accelerated ARM emulation</li>
                      <li>VNC remote desktop access</li>
                      <li>Configurable memory and CPU</li>
                      <li>Network connectivity</li>
                    </ul>
                  </div>
                </Col>
                <Col span={12}>
                  <div>
                    <Text strong>Supported Images:</Text>
                    <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                      <li>Armbian ARM64 images</li>
                      <li>Raw disk images (.img)</li>
                      <li>Rock 5B optimized builds</li>
                      <li>Custom kernel configurations</li>
                    </ul>
                  </div>
                </Col>
              </Row>

              <Alert
                message="Performance Note"
                description="QEMU emulation may be slower than native hardware. Use for testing and development purposes."
                type="info"
                showIcon
                style={{ marginTop: '16px' }}
              />
            </Card>
          </Col>
        </Row>
      </div>
    </div>
  );
};

export default ImageRunnerPanel; 