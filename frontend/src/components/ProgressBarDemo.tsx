import React, { useState, useEffect } from 'react';
import { Card, Select, Button, Space, Typography, Row, Col } from 'antd';
import { PlayCircleOutlined, PauseCircleOutlined, ReloadOutlined } from '@ant-design/icons';
import { SegmentedProgressBar, FlashSegment } from './SegmentedProgressBar';
import { colors } from '../styles/design-tokens';

const { Title, Paragraph, Text } = Typography;
const { Option } = Select;

interface DemoState {
  isRunning: boolean;
  currentPhase: string;
  progress: number;
  variant: 'webusb' | 'serial' | 'spi';
}

export const ProgressBarDemo: React.FC = () => {
  const [demoState, setDemoState] = useState<DemoState>({
    isRunning: false,
    currentPhase: 'detecting',
    progress: 0,
    variant: 'webusb'
  });

  // Demo phases for each variant
  const phases = {
    webusb: ['detecting', 'connecting', 'loading_bootloader', 'preparing', 'writing', 'verifying', 'completed'],
    serial: ['connecting', 'preparing', 'flashing', 'completed'],
    spi: ['detecting', 'connecting', 'loading_bootloader', 'preparing', 'writing', 'completed']
  };

  const messages = {
    detecting: 'Scanning for devices...',
    connecting: 'Establishing connection...',
    loading_bootloader: 'Loading bootloader files...',
    preparing: 'Preparing data for transfer...',
    writing: 'Writing data to storage...',
    flashing: 'Flashing image data...',
    verifying: 'Verifying written data...',
    completed: 'Operation completed successfully!'
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (demoState.isRunning) {
      interval = setInterval(() => {
        setDemoState(prev => {
          const currentPhases = phases[prev.variant];
          const currentIndex = currentPhases.indexOf(prev.currentPhase);
          const isLastPhase = currentIndex === currentPhases.length - 1;
          
          if (isLastPhase && prev.progress >= 100) {
            return { ...prev, isRunning: false };
          }
          
          let newProgress = prev.progress + Math.random() * 8 + 2; // 2-10% increment
          let newPhase = prev.currentPhase;
          
          // Calculate expected progress for current phase
          const segmentSize = 100 / currentPhases.length;
          const expectedProgress = (currentIndex + 1) * segmentSize;
          
          // Move to next phase if we've exceeded expected progress
          if (newProgress >= expectedProgress && currentIndex < currentPhases.length - 1) {
            newPhase = currentPhases[currentIndex + 1];
            newProgress = Math.max(newProgress, expectedProgress);
          }
          
          newProgress = Math.min(newProgress, 100);
          
          return {
            ...prev,
            progress: newProgress,
            currentPhase: newPhase
          };
        });
      }, 200);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [demoState.isRunning, demoState.variant]);

  const handleStart = () => {
    setDemoState(prev => ({ ...prev, isRunning: true }));
  };

  const handlePause = () => {
    setDemoState(prev => ({ ...prev, isRunning: false }));
  };

  const handleReset = () => {
    setDemoState(prev => ({
      ...prev,
      isRunning: false,
      currentPhase: phases[prev.variant][0],
      progress: 0
    }));
  };

  const handleVariantChange = (variant: 'webusb' | 'serial' | 'spi') => {
    setDemoState({
      isRunning: false,
      currentPhase: phases[variant][0],
      progress: 0,
      variant
    });
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', padding: '24px' }}>
      <Card style={{ backgroundColor: colors.background.primary }}>
        <Title level={3} style={{ textAlign: 'center', marginBottom: '16px' }}>
          Segmented Progress Bar Demo
        </Title>
        
        <Paragraph style={{ textAlign: 'center', marginBottom: '24px' }}>
          Interactive demonstration of the segmented progress bar used in flash operations.
          Each segment represents a different phase of the flashing process.
        </Paragraph>

        {/* Controls */}
        <Row justify="center" style={{ marginBottom: '32px' }}>
          <Col>
            <Space size="large">
              <Select
                value={demoState.variant}
                onChange={handleVariantChange}
                style={{ width: 120 }}
                disabled={demoState.isRunning}
              >
                <Option value="webusb">WebUSB</Option>
                <Option value="serial">Serial</Option>
                <Option value="spi">SPI</Option>
              </Select>
              
              <Space>
                {!demoState.isRunning ? (
                  <Button type="primary" icon={<PlayCircleOutlined />} onClick={handleStart}>
                    Start Demo
                  </Button>
                ) : (
                  <Button icon={<PauseCircleOutlined />} onClick={handlePause}>
                    Pause
                  </Button>
                )}
                
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  Reset
                </Button>
              </Space>
            </Space>
          </Col>
        </Row>

        {/* Progress Bar Demo */}
        <Card 
          size="small" 
          style={{ 
            backgroundColor: colors.background.secondary,
            marginBottom: '24px'
          }}
        >
          <SegmentedProgressBar
            currentPhase={demoState.currentPhase}
            progress={demoState.progress}
            message={messages[demoState.currentPhase as keyof typeof messages] || 'Processing...'}
            error={false}
            variant={demoState.variant}
          />
        </Card>

        {/* Info */}
        <Row gutter={16}>
          <Col xs={24} md={12}>
            <Card size="small" title="Current State">
              <div style={{ fontSize: '14px' }}>
                <div><strong>Variant:</strong> {demoState.variant.toUpperCase()}</div>
                <div><strong>Phase:</strong> {demoState.currentPhase}</div>
                <div><strong>Progress:</strong> {Math.round(demoState.progress)}%</div>
                <div><strong>Status:</strong> {demoState.isRunning ? 'Running' : 'Stopped'}</div>
              </div>
            </Card>
          </Col>
          
          <Col xs={24} md={12}>
            <Card size="small" title="Phases">
              <div style={{ fontSize: '12px' }}>
                {phases[demoState.variant].map((phase, index) => (
                  <div 
                    key={phase}
                    style={{
                      padding: '2px 0',
                      fontWeight: phase === demoState.currentPhase ? 'bold' : 'normal',
                      color: phase === demoState.currentPhase ? colors.accent[500] : colors.text.secondary
                    }}
                  >
                    {index + 1}. {phase.replace('_', ' ')}
                  </div>
                ))}
              </div>
            </Card>
          </Col>
        </Row>

        {/* Usage Info */}
        <Card size="small" title="Usage" style={{ marginTop: '16px' }}>
          <Paragraph style={{ fontSize: '13px', marginBottom: '8px' }}>
            <Text code>SegmentedProgressBar</Text> provides visual feedback for multi-phase operations:
          </Paragraph>
          <ul style={{ fontSize: '12px', marginLeft: '16px' }}>
            <li><strong>WebUSB:</strong> Complete device flashing with bootloader loading and verification</li>
            <li><strong>Serial:</strong> Simple serial-based flashing operations</li>
            <li><strong>SPI:</strong> SPI flash operations including chip clear and bootloader writes</li>
          </ul>
        </Card>
      </Card>
    </div>
  );
}; 