import React from 'react';
import { Alert, Space, Typography } from 'antd';
import { ThunderboltOutlined, FileImageOutlined, DoubleRightOutlined } from '@ant-design/icons';

const { Text } = Typography;

export const FlashInstructions: React.FC = () => {
  return (
    <Alert
      message="Hardware Flashing Quick Start"
      description={
        <Space direction="vertical" size="small" style={{ width: '100%' }}>
          <Space align="start">
            <FileImageOutlined style={{ color: '#1890ff', marginTop: 4 }} />
            <div>
              <Text strong>Find your completed build:</Text>
              <br />
              <Text type="secondary">Look for builds with "completed" status in the builds panel</Text>
            </div>
          </Space>
          
          <Space align="start">
            <DoubleRightOutlined style={{ color: '#52c41a', marginTop: 4 }} />
            <div>
              <Text strong>Double-click the image file:</Text>
              <br />
              <Text type="secondary">Image files with </Text>
              <ThunderboltOutlined style={{ fontSize: '12px', color: '#1890ff' }} />
              <Text type="secondary"> icon can be flashed directly</Text>
            </div>
          </Space>
          
          <Space align="start">
            <ThunderboltOutlined style={{ color: '#faad14', marginTop: 4 }} />
            <div>
              <Text strong>Choose your flash method:</Text>
              <br />
              <Text type="secondary">Backend (reliable) or Browser (experimental Web Serial API)</Text>
            </div>
          </Space>
          
          <div style={{ marginTop: 8, padding: 8, backgroundColor: '#f0f2f5', borderRadius: 4 }}>
            <Text type="secondary" style={{ fontSize: '12px' }}>
              💡 <strong>Pro tip:</strong> Right-click on image files for more options including "Flash to Hardware"
            </Text>
          </div>
        </Space>
      }
      type="info"
      showIcon
      style={{ marginBottom: 16 }}
    />
  );
}; 