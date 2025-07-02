import React, { useState } from 'react';
import { Layout, Card, Typography, Space, Button, message } from 'antd';
import { ThunderboltOutlined, BuildOutlined, EyeOutlined } from '@ant-design/icons';
import { BuildsPanel } from '../panels/BuildsPanel';
import { BuildViewer } from '../panels/BuildViewer';
import { BuildJob } from '../types';

const { Sider, Content } = Layout;
const { Title, Text } = Typography;

// Mock builds data for demo - simplified types for demonstration
const mockBuilds = [
  {
    id: 'build-1',
    status: 'completed',
    createdAt: new Date().toISOString(),
    configurationId: 'config-1',
    configurationSnapshot: {
      name: 'Rock-5B Production Setup',
      description: 'Production setup for Rock-5B',
      id: 'config-1',
      userId: 'demo-user',
      version: 1,
      updatedAt: new Date().toISOString(),
      board: { name: 'rock-5b', family: 'rockchip64', architecture: 'arm64' },
      distribution: { release: 'jammy', type: 'minimal' }
    } as any,
    artifacts: [
      {
        name: 'Armbian_23.8.1_Rock-5b_jammy_current_6.1.47.img',
        type: 'image' as const,
        size: 1024 * 1024 * 512, // 512MB
        url: '/downloads/armbian-rock5b.img'
      },
      {
        name: 'build.log',
        type: 'log' as const,
        size: 1024 * 256, // 256KB
        url: '/downloads/build-1.log'
      }
    ],
    logs: [
      { message: 'Build started', timestamp: new Date().toISOString() },
      { message: 'Downloading base image', timestamp: new Date().toISOString() },
      { message: 'Configuring system', timestamp: new Date().toISOString() },
      { message: 'Build completed', timestamp: new Date().toISOString() }
    ] as any,
    timing: {
      queuedAt: new Date(Date.now() - 1000000).toISOString(),
      startedAt: new Date(Date.now() - 900000).toISOString(), // 15 min ago
      completedAt: new Date().toISOString(),
      duration: 900
    }
  },
  {
    id: 'build-2', 
    status: 'building',
    createdAt: new Date(Date.now() - 300000).toISOString(), // 5 min ago
    configurationId: 'config-2',
    configurationSnapshot: {
      name: 'Orange Pi 5 Dev Environment',
      description: 'Development environment for Orange Pi 5',
      id: 'config-2',
      userId: 'demo-user',
      version: 1,
      updatedAt: new Date().toISOString(),
      board: { name: 'orangepi5', family: 'rockchip64', architecture: 'arm64' },
      distribution: { release: 'bookworm', type: 'desktop' }
    } as any,
    artifacts: [],
    logs: [
      { message: 'Build started', timestamp: new Date().toISOString() },
      { message: 'Downloading base image', timestamp: new Date().toISOString() },
      { message: 'Applying configurations...', timestamp: new Date().toISOString() }
    ] as any,
    progress: 65
  }
] as BuildJob[];

export const IntegratedFlashingDemo: React.FC = () => {
  const [selectedBuild, setSelectedBuild] = useState<BuildJob | null>(null);
  const [builds] = useState<BuildJob[]>(mockBuilds);

  const handleBuildSelect = (build: BuildJob) => {
    setSelectedBuild(build);
  };

  const handleBuildDoubleClick = (build: BuildJob) => {
    message.info(`Opening build details: ${build.configurationSnapshot?.name}`);
    setSelectedBuild(build);
  };

  const handleArtifactDownload = (buildId: string, artifactName: string) => {
    message.success(`Downloading ${artifactName} from build ${buildId}`);
    // Implement download logic
  };

  const handleImageFlash = (buildId: string, imageName: string) => {
    message.info(`Flash interface opened for ${imageName}`);
    // Flash drawer will open automatically from BuildsPanel
  };

  const handleViewLogs = (buildId: string) => {
    const build = builds.find(b => b.id === buildId);
    if (build) {
      setSelectedBuild(build);
      message.info('Viewing build logs');
    }
  };

  const handleCancelBuild = (buildId: string) => {
    message.warning(`Cancelled build ${buildId}`);
    // Implement build cancellation
  };

  return (
    <div style={{ height: '100vh', padding: '16px' }}>
      <Card style={{ height: '100%' }}>
        <Space direction="vertical" size="large" style={{ width: '100%', height: '100%' }}>
          {/* Header */}
          <div>
            <Title level={2}>
              <Space>
                <BuildOutlined />
                BBOS Hardware Flashing Demo
              </Space>
            </Title>
            <Text type="secondary">
              Experience intuitive image flashing with double-click functionality
            </Text>
          </div>

          {/* Instructions */}
          <Card size="small" style={{ backgroundColor: '#f6ffed', border: '1px solid #b7eb8f' }}>
            <Space direction="vertical" size="small">
              <Text strong>🎯 Try the new flashing experience:</Text>
              <Text>1. Look for completed builds in the left panel</Text>
              <Text>2. Find image files with the <ThunderboltOutlined style={{ color: '#1890ff' }} /> icon</Text>
              <Text>3. Double-click any image file to open the flash interface</Text>
              <Text>4. Choose between backend or browser flashing methods</Text>
            </Space>
          </Card>

          {/* Main Layout */}
          <Layout style={{ height: '500px', backgroundColor: 'transparent' }}>
                         <Sider width={400} style={{ backgroundColor: '#fafafa', borderRadius: '6px' }}>
               {/* Note: In real application, BuildsPanel gets data from useAppStore() */}
               <div style={{ padding: '16px' }}>
                 <Text strong>Demo: Builds Panel Integration</Text>
                 <div style={{ marginTop: '16px' }}>
                   <Text>The BuildsPanel component now includes:</Text>
                   <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                     <li>Double-click on image files to flash</li>
                     <li>Visual indicators (⚡ icon) for flashable images</li>
                     <li>Context menu with "Flash to Hardware" option</li>
                     <li>Tooltips showing flash instructions</li>
                   </ul>
                 </div>
               </div>
             </Sider>
            
            <Content style={{ marginLeft: '16px', backgroundColor: '#fafafa', borderRadius: '6px' }}>
              {selectedBuild ? (
                <BuildViewer
                  build={selectedBuild}
                  onDownloadArtifact={handleArtifactDownload}
                  onViewArtifact={(buildId, artifactName) => {
                    message.info(`Viewing artifact: ${artifactName}`);
                  }}
                />
              ) : (
                <div style={{ 
                  height: '100%', 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  flexDirection: 'column'
                }}>
                  <EyeOutlined style={{ fontSize: '48px', color: '#d9d9d9', marginBottom: '16px' }} />
                  <Text type="secondary">Select a build to view details</Text>
                </div>
              )}
            </Content>
          </Layout>

          {/* Feature Highlights */}
          <Card size="small" title="✨ New Features">
            <Space direction="vertical" size="small">
              <Text>
                <ThunderboltOutlined style={{ color: '#faad14' }} /> 
                <strong> Double-Click Flashing:</strong> Click any image file twice to start flashing
              </Text>
              <Text>
                🎯 <strong>Visual Indicators:</strong> Flash-ready images are highlighted with icons and tooltips
              </Text>
              <Text>
                🖱️ <strong>Context Menu:</strong> Right-click images for additional flashing options
              </Text>
              <Text>
                🌐 <strong>Dual Methods:</strong> Choose between reliable backend or experimental browser flashing
              </Text>
            </Space>
          </Card>
        </Space>
      </Card>
    </div>
  );
}; 