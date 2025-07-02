import React, { useState } from 'react';
import { Card, Button, Typography, Alert, Descriptions, Space, Collapse } from 'antd';
import { BugOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { WebSerialFlasher, webSerialSupported } from '../services/webSerialFlasher';
import { colors } from '../styles/design-tokens';

const { Text, Paragraph } = Typography;
const { Panel } = Collapse;

export const SerialDebugInfo: React.FC = () => {
  const [debugInfo, setDebugInfo] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const flasher = new WebSerialFlasher();

  const handleGetDebugInfo = async () => {
    setIsLoading(true);
    try {
      const info = flasher.getDebugInfo();
      setDebugInfo(info);
    } catch (error) {
      console.error('Failed to get debug info:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const copyDebugInfo = () => {
    if (debugInfo) {
      navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2));
    }
  };

  return (
    <Collapse
      items={[
        {
          key: 'debug',
          label: (
            <Space>
              <BugOutlined />
              <Text>Troubleshooting & Debug Info</Text>
            </Space>
          ),
          children: (
            <div>
              <Paragraph type="secondary" style={{ marginBottom: '16px' }}>
                If serial devices aren't appearing, use this to diagnose the issue:
              </Paragraph>

              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                {/* Quick Status Check */}
                <Alert
                  message="Web Serial Status"
                  description={
                    webSerialSupported() 
                      ? "✅ Web Serial API is supported in this browser"
                      : "❌ Web Serial API is not supported - use Chrome, Edge, or Opera"
                  }
                  type={webSerialSupported() ? "success" : "error"}
                  showIcon
                />

                {/* Protocol Check */}
                <Alert
                  message="Security Requirements"
                  description={
                    window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1'
                      ? "✅ HTTPS or localhost - Web Serial should work"
                      : "❌ HTTPS required for Web Serial API"
                  }
                  type={
                    window.location.protocol === 'https:' || 
                    window.location.hostname === 'localhost' ||
                    window.location.hostname === '127.0.0.1'
                      ? "success" : "warning"
                  }
                  showIcon
                />

                {/* Debug Info Section */}
                <div>
                  <Space style={{ marginBottom: '12px' }}>
                    <Button 
                      icon={<InfoCircleOutlined />} 
                      onClick={handleGetDebugInfo}
                      loading={isLoading}
                    >
                      Get Debug Info
                    </Button>
                    {debugInfo && (
                      <Button onClick={copyDebugInfo} size="small">
                        Copy to Clipboard
                      </Button>
                    )}
                  </Space>

                  {debugInfo && (
                    <Card size="small" style={{ backgroundColor: colors.background.secondary }}>
                      <Descriptions 
                        column={1} 
                        size="small"
                        labelStyle={{ color: colors.text.secondary }}
                        contentStyle={{ color: colors.text.primary }}
                      >
                        <Descriptions.Item label="Web Serial Supported">
                          {debugInfo.webSerialSupported ? '✅ Yes' : '❌ No'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Secure Context">
                          {debugInfo.isSecureContext ? '✅ Yes' : '❌ No'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Protocol">
                          {debugInfo.protocol}
                        </Descriptions.Item>
                        <Descriptions.Item label="Hostname">
                          {debugInfo.hostname}
                        </Descriptions.Item>
                        <Descriptions.Item label="Browser">
                          {debugInfo.userAgent}
                        </Descriptions.Item>
                        <Descriptions.Item label="Device Connected">
                          {debugInfo.deviceConnected ? '✅ Yes' : '❌ No'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Has Reader">
                          {debugInfo.hasReader ? '✅ Yes' : '❌ No'}
                        </Descriptions.Item>
                        <Descriptions.Item label="Has Writer">
                          {debugInfo.hasWriter ? '✅ Yes' : '❌ No'}
                        </Descriptions.Item>
                      </Descriptions>

                      {debugInfo.requirements && !debugInfo.requirements.supported && (
                        <div style={{ marginTop: '12px' }}>
                          <Alert
                            message="Issues Found"
                            description={
                              <ul style={{ margin: 0, paddingLeft: '20px' }}>
                                {debugInfo.requirements.issues.map((issue: string, index: number) => (
                                  <li key={index}>{issue}</li>
                                ))}
                              </ul>
                            }
                            type="error"
                            showIcon
                          />
                        </div>
                      )}
                    </Card>
                  )}
                </div>

                {/* Common Solutions */}
                <Card 
                  title="Common Solutions" 
                  size="small"
                  style={{ backgroundColor: colors.background.secondary }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <Text strong>🔌 No devices showing up?</Text>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: colors.text.secondary }}>
                      <li>Make sure your device is connected via USB-C</li>
                      <li>Put Rockchip device in maskrom mode (hold recovery + power)</li>
                      <li>Try a different USB cable or port</li>
                      <li>Close other applications that might be using the device</li>
                    </ul>

                    <Text strong>🌐 Browser compatibility:</Text>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: colors.text.secondary }}>
                      <li>Use Chrome, Edge, or Opera (latest versions)</li>
                      <li>Firefox does not support Web Serial API</li>
                      <li>Safari does not support Web Serial API</li>
                    </ul>

                    <Text strong>🔒 Security requirements:</Text>
                    <ul style={{ margin: 0, paddingLeft: '20px', color: colors.text.secondary }}>
                      <li>HTTPS is required (or localhost for development)</li>
                      <li>Make sure you're not in an incognito/private window</li>
                    </ul>
                  </Space>
                </Card>
              </Space>
            </div>
          )
        }
      ]}
    />
  );
}; 