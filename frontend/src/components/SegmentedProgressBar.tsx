import React from 'react';
import { Progress, Typography, Space } from 'antd';
import { 
  UsbOutlined, 
  DownloadOutlined, 
  SearchOutlined, 
  FileOutlined, 
  ThunderboltOutlined, 
  CheckCircleOutlined, 
  SafetyCertificateOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { colors } from '../styles/design-tokens';

const { Text } = Typography;

export interface FlashSegment {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  color: string;
  weight: number; // Relative weight of this segment (1-10)
}

export interface SegmentedProgressBarProps {
  currentPhase: string;
  progress: number; // 0-100
  message?: string;
  error?: boolean;
  segments?: FlashSegment[];
  variant?: 'webusb' | 'serial' | 'spi';
}

// Default segments for different flash types
const DEFAULT_WEBUSB_SEGMENTS: FlashSegment[] = [
  {
    id: 'detecting',
    label: 'Detect',
    description: 'Detecting and connecting to device',
    icon: <SearchOutlined />,
    color: '#1890ff',
    weight: 2
  },
  {
    id: 'connecting',
    label: 'Connect',
    description: 'Establishing USB connection',
    icon: <UsbOutlined />,
    color: '#52c41a',
    weight: 2
  },
  {
    id: 'loading_bootloader',
    label: 'Bootloader',
    description: 'Loading bootloader files',
    icon: <DownloadOutlined />,
    color: '#722ed1',
    weight: 3
  },
  {
    id: 'preparing',
    label: 'Prepare',
    description: 'Preparing image data',
    icon: <FileOutlined />,
    color: '#fa8c16',
    weight: 2
  },
  {
    id: 'writing',
    label: 'Write',
    description: 'Writing data to storage',
    icon: <ThunderboltOutlined />,
    color: '#eb2f96',
    weight: 7
  },
  {
    id: 'verifying',
    label: 'Verify',
    description: 'Verifying written data',
    icon: <SafetyCertificateOutlined />,
    color: '#13c2c2',
    weight: 2
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Flash completed successfully',
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    weight: 1
  }
];

const DEFAULT_SPI_SEGMENTS: FlashSegment[] = [
  {
    id: 'detecting',
    label: 'Detect',
    description: 'Detecting SPI device',
    icon: <SearchOutlined />,
    color: '#1890ff',
    weight: 2
  },
  {
    id: 'connecting',
    label: 'Connect',
    description: 'Connecting to device',
    icon: <UsbOutlined />,
    color: '#52c41a',
    weight: 2
  },
  {
    id: 'loading_bootloader',
    label: 'Init',
    description: 'Initializing device',
    icon: <DownloadOutlined />,
    color: '#722ed1',
    weight: 3
  },
  {
    id: 'preparing',
    label: 'Setup',
    description: 'Setting up SPI operations',
    icon: <FileOutlined />,
    color: '#fa8c16',
    weight: 2
  },
  {
    id: 'writing',
    label: 'Write SPI',
    description: 'Writing to SPI flash',
    icon: <ThunderboltOutlined />,
    color: '#eb2f96',
    weight: 8
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'SPI operation completed',
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    weight: 1
  }
];

const DEFAULT_SERIAL_SEGMENTS: FlashSegment[] = [
  {
    id: 'connecting',
    label: 'Connect',
    description: 'Connecting to serial device',
    icon: <UsbOutlined />,
    color: '#1890ff',
    weight: 2
  },
  {
    id: 'preparing',
    label: 'Prepare',
    description: 'Preparing flash process',
    icon: <FileOutlined />,
    color: '#fa8c16',
    weight: 2
  },
  {
    id: 'flashing',
    label: 'Flash',
    description: 'Flashing image via serial',
    icon: <ThunderboltOutlined />,
    color: '#eb2f96',
    weight: 8
  },
  {
    id: 'completed',
    label: 'Complete',
    description: 'Flash completed',
    icon: <CheckCircleOutlined />,
    color: '#52c41a',
    weight: 1
  }
];

export const SegmentedProgressBar: React.FC<SegmentedProgressBarProps> = ({
  currentPhase,
  progress,
  message,
  error = false,
  segments,
  variant = 'webusb'
}) => {
  // Select default segments based on variant
  const defaultSegments = variant === 'spi' ? DEFAULT_SPI_SEGMENTS :
                          variant === 'serial' ? DEFAULT_SERIAL_SEGMENTS :
                          DEFAULT_WEBUSB_SEGMENTS;
  
  const activeSegments = segments || defaultSegments;
  
  // Calculate total weight
  const totalWeight = activeSegments.reduce((sum, segment) => sum + segment.weight, 0);
  
  // Calculate segment positions and widths
  let currentPosition = 0;
  const segmentPositions = activeSegments.map(segment => {
    const width = (segment.weight / totalWeight) * 100;
    const position = currentPosition;
    currentPosition += width;
    return {
      ...segment,
      startPosition: position,
      width: width
    };
  });

  // Find current active segment
  const currentSegmentIndex = activeSegments.findIndex(segment => segment.id === currentPhase);
  const currentSegment = currentSegmentIndex >= 0 ? activeSegments[currentSegmentIndex] : null;

  // Calculate progress within the current segment
  const getSegmentProgress = (segmentIndex: number) => {
    if (error) return 0;
    
    if (segmentIndex < currentSegmentIndex) {
      return 100; // Completed segments
    } else if (segmentIndex === currentSegmentIndex) {
      // Current segment - map global progress to segment progress
      const segmentStart = segmentPositions[segmentIndex].startPosition;
      const segmentWidth = segmentPositions[segmentIndex].width;
      const segmentProgress = ((progress - segmentStart) / segmentWidth) * 100;
      return Math.max(0, Math.min(100, segmentProgress));
    } else {
      return 0; // Future segments
    }
  };

  return (
    <div style={{ width: '100%' }}>
      {/* Segment Labels */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        marginBottom: '12px',
        flexWrap: 'wrap',
        gap: '8px'
      }}>
        {activeSegments.map((segment, index) => {
          const isActive = segment.id === currentPhase;
          const isCompleted = index < currentSegmentIndex;
          const isFailed = error && isActive;
          
          return (
            <div
              key={segment.id}
              style={{
                flex: `0 1 ${segment.weight * 2}%`,
                minWidth: '80px',
                textAlign: 'center',
                opacity: isActive || isCompleted ? 1 : 0.6,
                transition: 'opacity 0.3s ease'
              }}
            >
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '4px'
              }}>
                <div style={{
                  fontSize: '20px',
                  color: isFailed ? '#ff4d4f' : 
                         isCompleted ? '#52c41a' :
                         isActive ? segment.color : colors.text.secondary,
                  transition: 'color 0.3s ease'
                }}>
                  {isFailed ? <ExclamationCircleOutlined /> : segment.icon}
                </div>
                <Text 
                  style={{ 
                    fontSize: '12px',
                    fontWeight: isActive ? 'bold' : 'normal',
                    color: isFailed ? '#ff4d4f' :
                           isActive ? colors.text.primary : colors.text.secondary
                  }}
                >
                  {segment.label}
                </Text>
              </div>
            </div>
          );
        })}
      </div>

      {/* Segmented Progress Bar */}
      <div style={{ 
        position: 'relative',
        height: '12px',
        backgroundColor: colors.background.secondary,
        borderRadius: '6px',
        overflow: 'hidden',
        marginBottom: '12px'
      }}>
        {segmentPositions.map((segment, index) => {
          const segmentProgress = getSegmentProgress(index);
          const isActive = segment.id === currentPhase;
          const isCompleted = index < currentSegmentIndex;
          
          return (
            <div
              key={segment.id}
              style={{
                position: 'absolute',
                left: `${segment.startPosition}%`,
                width: `${segment.width}%`,
                height: '100%',
                backgroundColor: colors.border.light,
                borderRight: index < segmentPositions.length - 1 ? 
                  `1px solid ${colors.background.primary}` : 'none'
              }}
            >
              <div
                style={{
                  width: `${segmentProgress}%`,
                  height: '100%',
                  backgroundColor: error && isActive ? '#ff4d4f' : segment.color,
                  transition: 'width 0.3s ease, background-color 0.3s ease',
                  opacity: isCompleted ? 0.8 : 1
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Overall Progress Percentage */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '8px'
      }}>
        <Text strong style={{ 
          fontSize: '16px',
          color: error ? '#ff4d4f' : colors.text.primary 
        }}>
          {error ? 'Failed' : `${Math.round(progress)}%`}
        </Text>
        {currentSegment && (
          <Text style={{ 
            fontSize: '14px',
            color: colors.text.secondary 
          }}>
            {currentSegment.description}
          </Text>
        )}
      </div>

      {/* Current Message */}
      {message && (
        <div style={{
          backgroundColor: error ? '#fff2f0' : colors.background.secondary,
          border: error ? '1px solid #ffccc7' : `1px solid ${colors.border.light}`,
          borderRadius: '6px',
          padding: '12px',
          marginTop: '8px'
        }}>
          <Text style={{ 
            color: error ? '#ff4d4f' : colors.text.primary,
            fontSize: '14px'
          }}>
            {message}
          </Text>
        </div>
      )}
    </div>
  );
}; 