import React from 'react';
import { Progress, Typography, Space, Row, Col } from 'antd';
import { FileZipOutlined, ThunderboltOutlined } from '@ant-design/icons';
import { colors } from '../styles/design-tokens';

const { Text } = Typography;

export interface CompressionProgressBarProps {
  progress: number; // 0-100
  decompressedBytes: number;
  speed: number; // bytes per second
  totalCompressedSize?: number;
  estimatedUncompressedSize?: number;
  fileName?: string;
}

export const CompressionProgressBar: React.FC<CompressionProgressBarProps> = ({
  progress,
  decompressedBytes,
  speed,
  totalCompressedSize,
  estimatedUncompressedSize,
  fileName
}) => {
  // Format file size
  const formatBytes = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return mb >= 1 ? `${mb.toFixed(1)} MB` : `${(bytes / 1024).toFixed(1)} KB`;
  };

  // Format speed
  const formatSpeed = (bytesPerSecond: number): string => {
    const mbps = bytesPerSecond / (1024 * 1024);
    return mbps >= 1 ? `${mbps.toFixed(1)} MB/s` : `${(bytesPerSecond / 1024).toFixed(1)} KB/s`;
  };

  return (
    <div style={{
      backgroundColor: colors.background.secondary,
      border: `1px solid ${colors.border.light}`,
      borderRadius: '8px',
      padding: '16px',
      marginBottom: '16px'
    }}>
      {/* Header */}
      <div style={{ marginBottom: '12px', textAlign: 'center' }}>
        <Space>
          <FileZipOutlined style={{ 
            fontSize: '20px', 
            color: colors.accent[500] 
          }} />
          <Text strong style={{ fontSize: '16px', color: colors.text.primary }}>
            Decompressing Image{fileName ? `: ${fileName}` : ''}
          </Text>
        </Space>
      </div>

      {/* Progress Bar */}
      <Progress
        percent={Math.round(progress)}
        status="active"
        strokeColor={{
          '0%': '#722ed1',
          '100%': colors.accent[500]
        }}
        style={{ marginBottom: '12px' }}
        size="default"
        showInfo={true}
      />

      {/* Stats */}
      <Row gutter={[16, 8]} style={{ fontSize: '13px' }}>
        <Col xs={12} sm={8}>
          <Space direction="vertical" size={2}>
            <Text type="secondary">Decompressed</Text>
            <Text style={{ fontWeight: 'bold', color: colors.text.primary }}>
              {formatBytes(decompressedBytes)}
            </Text>
          </Space>
        </Col>
        
        <Col xs={12} sm={8}>
          <Space direction="vertical" size={2}>
            <Text type="secondary">Speed</Text>
            <Text style={{ fontWeight: 'bold', color: colors.accent[500] }}>
              <ThunderboltOutlined style={{ marginRight: '4px' }} />
              {speed > 0 ? formatSpeed(speed) : 'Calculating...'}
            </Text>
          </Space>
        </Col>

        <Col xs={24} sm={8}>
          <Space direction="vertical" size={2}>
            <Text type="secondary">Progress</Text>
            <Text style={{ fontWeight: 'bold', color: colors.text.primary }}>
              {Math.round(progress)}% Complete
            </Text>
          </Space>
        </Col>
      </Row>

      {/* Additional Info */}
      {(totalCompressedSize || estimatedUncompressedSize) && (
        <div style={{ 
          marginTop: '8px', 
          paddingTop: '8px', 
          borderTop: `1px solid ${colors.border.light}`,
          fontSize: '12px'
        }}>
          <Row gutter={16}>
            {totalCompressedSize && (
              <Col>
                <Text type="secondary">
                  Compressed Size: {formatBytes(totalCompressedSize)}
                </Text>
              </Col>
            )}
            {estimatedUncompressedSize && (
              <Col>
                <Text type="secondary">
                  Estimated Size: {formatBytes(estimatedUncompressedSize)}
                </Text>
              </Col>
            )}
          </Row>
        </div>
      )}
    </div>
  );
}; 