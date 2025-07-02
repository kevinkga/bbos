# Rockchip WebUSB Flasher API - npm Package Proposal

## Overview

A comprehensive, metrics-driven npm package for Rockchip device flashing via WebUSB, inspired by the official rkdeveloptool architecture but designed for modern web applications with real-time performance monitoring.

## Package Structure

```
@rockchip/webusb-flasher/
├── src/
│   ├── core/
│   │   ├── RockchipDevice.ts          # Device abstraction
│   │   ├── USBCommunication.ts        # Low-level USB layer
│   │   ├── ProtocolManager.ts         # Official protocol implementation
│   │   └── StateManager.ts            # Device state transitions
│   ├── operations/
│   │   ├── FlashOperation.ts          # Flash writing operations
│   │   ├── ReadOperation.ts           # Data reading operations
│   │   ├── BootloaderOperation.ts     # Bootloader management
│   │   └── StorageOperation.ts        # Storage device switching
│   ├── metrics/
│   │   ├── MetricsCollector.ts        # Real-time metrics collection
│   │   ├── BufferMonitor.ts           # Buffer usage monitoring
│   │   ├── PerformanceTracker.ts      # Speed and throughput tracking
│   │   └── MetricsReporter.ts         # React-friendly metrics interface
│   ├── buffers/
│   │   ├── WriteBuffer.ts             # Write buffer management
│   │   ├── ReadBuffer.ts              # Read buffer management
│   │   ├── CompressionBuffer.ts       # Compression handling
│   │   └── BufferPool.ts              # Buffer pool management
│   ├── hooks/
│   │   ├── useRockchipDevice.ts       # React device hook
│   │   ├── useFlashOperation.ts       # React flash operation hook
│   │   ├── useMetrics.ts              # React metrics hook
│   │   └── useBufferStatus.ts         # React buffer monitoring hook
│   ├── types/
│   │   ├── Device.ts                  # Device type definitions
│   │   ├── Operations.ts              # Operation type definitions
│   │   ├── Metrics.ts                 # Metrics type definitions
│   │   └── Protocol.ts                # Protocol type definitions
│   └── utils/
│       ├── ChipIdentification.ts      # Chip type detection
│       ├── ProtocolValidation.ts      # Protocol compliance checking
│       └── ErrorRecovery.ts           # Error handling and recovery
├── examples/
│   ├── basic-flash.ts                 # Basic flashing example
│   ├── react-integration.tsx          # React component example
│   ├── metrics-dashboard.tsx          # Metrics visualization example
│   └── advanced-operations.ts        # Advanced operations example
├── tests/
├── docs/
└── package.json
```

## Core API Design

### 1. Device Management

```typescript
// Core device interface following rkdeveloptool patterns
export interface RockchipDevice {
  readonly id: string;
  readonly chipType: ChipType;
  readonly mode: DeviceMode;
  readonly capabilities: DeviceCapabilities;
  readonly connection: USBConnection;
  readonly metrics: DeviceMetrics;
}

// Device factory with automatic detection
export class RockchipDeviceFactory {
  static async requestDevice(): Promise<RockchipDevice>;
  static async getAvailableDevices(): Promise<RockchipDevice[]>;
  static async createFromUSBDevice(device: USBDevice): Promise<RockchipDevice>;
}

// Device manager with state tracking
export class RockchipDeviceManager {
  async connect(device: RockchipDevice): Promise<void>;
  async disconnect(device: RockchipDevice): Promise<void>;
  async refreshConnection(device: RockchipDevice): Promise<void>;
  getConnectionState(device: RockchipDevice): ConnectionState;
  
  // Event emission for React integration
  on(event: 'connect' | 'disconnect' | 'error', callback: Function): void;
  off(event: string, callback: Function): void;
}
```

### 2. Operations API

```typescript
// Base operation interface with metrics integration
export abstract class BaseOperation<T = any> {
  protected device: RockchipDevice;
  protected metrics: MetricsCollector;
  protected buffers: BufferManager;
  
  abstract execute(): Promise<T>;
  abstract cancel(): Promise<void>;
  
  // Real-time metrics access
  get progress(): OperationProgress;
  get performance(): PerformanceMetrics;
  get bufferStatus(): BufferMetrics;
  
  // Event emission for progress tracking
  on(event: 'progress' | 'complete' | 'error', callback: Function): void;
}

// Flash operation with comprehensive metrics
export class FlashOperation extends BaseOperation<FlashResult> {
  constructor(
    device: RockchipDevice,
    imageData: ArrayBuffer,
    options: FlashOptions
  );
  
  async execute(): Promise<FlashResult>;
  async pause(): Promise<void>;
  async resume(): Promise<void>;
  
  // Real-time metrics specific to flashing
  get writeSpeed(): number; // bytes/second
  get compressionRatio(): number;
  get estimatedTimeRemaining(): number;
  get writeBufferUtilization(): number;
}

// Read operation with buffer optimization
export class ReadOperation extends BaseOperation<ArrayBuffer> {
  constructor(
    device: RockchipDevice,
    readParams: ReadParameters
  );
  
  get readSpeed(): number;
  get readBufferUtilization(): number;
  get decompression(): DecompressionMetrics;
}
```

### 3. Metrics System

```typescript
// Comprehensive metrics interface
export interface MetricsSnapshot {
  timestamp: number;
  operation: {
    type: OperationType;
    phase: OperationPhase;
    progress: number; // 0-100
    bytesProcessed: number;
    totalBytes: number;
  };
  performance: {
    writeSpeed: number;           // bytes/second
    readSpeed: number;            // bytes/second
    compressionSpeed: number;     // bytes/second
    decompressionSpeed: number;   // bytes/second
    usbTransferRate: number;      // bytes/second
    errorRate: number;            // errors per second
  };
  buffers: {
    writeBuffer: BufferMetrics;
    readBuffer: BufferMetrics;
    compressionBuffer: BufferMetrics;
    decompressionBuffer: BufferMetrics;
  };
  system: {
    cpuUsage: number;           // percentage
    memoryUsage: number;        // bytes
    usbBandwidthUtilization: number; // percentage
  };
}

// Real-time metrics collector
export class MetricsCollector {
  private listeners: Set<MetricsListener> = new Set();
  private currentSnapshot: MetricsSnapshot;
  
  startCollection(operation: BaseOperation): void;
  stopCollection(): void;
  getSnapshot(): MetricsSnapshot;
  getHistoricalData(timeRange: TimeRange): MetricsSnapshot[];
  
  // React-friendly subscription
  subscribe(callback: (metrics: MetricsSnapshot) => void): () => void;
  
  // Performance analysis
  getAverageSpeed(operation: OperationType, timeRange: TimeRange): number;
  getBottlenecks(): PerformanceBottleneck[];
}

// Buffer monitoring system
export interface BufferMetrics {
  capacity: number;         // total buffer size
  used: number;            // currently used bytes
  available: number;       // available bytes
  utilizationPercentage: number;
  throughput: number;      // bytes/second
  queueLength: number;     // pending operations
  overflowCount: number;   // buffer overflow events
  underflowCount: number;  // buffer underflow events
}

export class BufferMonitor {
  getWriteBufferMetrics(): BufferMetrics;
  getReadBufferMetrics(): BufferMetrics;
  getCompressionBufferMetrics(): BufferMetrics;
  getOverallBufferHealth(): BufferHealth;
  
  // Adaptive buffer sizing
  optimizeBufferSizes(metrics: MetricsSnapshot[]): BufferConfiguration;
}
```

### 4. React Hooks

```typescript
// Device management hook
export function useRockchipDevice() {
  const [device, setDevice] = useState<RockchipDevice | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<Error | null>(null);
  
  const requestDevice = useCallback(async () => {
    // Device selection logic
  }, []);
  
  const connect = useCallback(async (device: RockchipDevice) => {
    // Connection logic with error handling
  }, []);
  
  const disconnect = useCallback(async () => {
    // Disconnection logic
  }, []);
  
  return {
    device,
    connectionState,
    error,
    requestDevice,
    connect,
    disconnect,
    isConnected: connectionState === 'connected'
  };
}

// Flash operation hook with comprehensive metrics
export function useFlashOperation(device: RockchipDevice | null) {
  const [operation, setOperation] = useState<FlashOperation | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [status, setStatus] = useState<OperationStatus>('idle');
  
  const startFlash = useCallback(async (
    imageData: ArrayBuffer,
    options: FlashOptions
  ) => {
    if (!device) throw new Error('No device connected');
    
    const flashOp = new FlashOperation(device, imageData, options);
    
    // Subscribe to metrics updates
    const unsubscribe = flashOp.on('progress', (snapshot: MetricsSnapshot) => {
      setMetrics(snapshot);
    });
    
    setOperation(flashOp);
    setStatus('running');
    
    try {
      const result = await flashOp.execute();
      setStatus('completed');
      return result;
    } catch (error) {
      setStatus('error');
      throw error;
    } finally {
      unsubscribe();
    }
  }, [device]);
  
  const cancelFlash = useCallback(async () => {
    if (operation) {
      await operation.cancel();
      setStatus('cancelled');
    }
  }, [operation]);
  
  return {
    startFlash,
    cancelFlash,
    pauseFlash: operation?.pause,
    resumeFlash: operation?.resume,
    status,
    metrics,
    progress: metrics?.operation.progress ?? 0,
    writeSpeed: metrics?.performance.writeSpeed ?? 0,
    bufferUtilization: metrics?.buffers.writeBuffer.utilizationPercentage ?? 0,
    estimatedTimeRemaining: operation?.estimatedTimeRemaining ?? 0
  };
}

// Real-time metrics hook
export function useMetrics(operation: BaseOperation | null) {
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [history, setHistory] = useState<MetricsSnapshot[]>([]);
  
  useEffect(() => {
    if (!operation) return;
    
    const unsubscribe = operation.on('progress', (snapshot: MetricsSnapshot) => {
      setMetrics(snapshot);
      setHistory(prev => [...prev.slice(-100), snapshot]); // Keep last 100 samples
    });
    
    return unsubscribe;
  }, [operation]);
  
  const getAverageSpeed = useCallback((timeRange: number = 5000) => {
    const cutoff = Date.now() - timeRange;
    const recentMetrics = history.filter(m => m.timestamp > cutoff);
    
    if (recentMetrics.length === 0) return 0;
    
    return recentMetrics.reduce((sum, m) => sum + m.performance.writeSpeed, 0) / recentMetrics.length;
  }, [history]);
  
  return {
    current: metrics,
    history,
    averageWriteSpeed: getAverageSpeed(),
    peakWriteSpeed: Math.max(...history.map(m => m.performance.writeSpeed)),
    bufferHealth: metrics?.buffers,
    systemHealth: metrics?.system
  };
}

// Buffer status monitoring hook
export function useBufferStatus(bufferMonitor: BufferMonitor | null) {
  const [bufferMetrics, setBufferMetrics] = useState<{
    write: BufferMetrics;
    read: BufferMetrics;
    compression: BufferMetrics;
  } | null>(null);
  
  const [bufferHealth, setBufferHealth] = useState<BufferHealth>('healthy');
  
  useEffect(() => {
    if (!bufferMonitor) return;
    
    const interval = setInterval(() => {
      setBufferMetrics({
        write: bufferMonitor.getWriteBufferMetrics(),
        read: bufferMonitor.getReadBufferMetrics(),
        compression: bufferMonitor.getCompressionBufferMetrics()
      });
      
      setBufferHealth(bufferMonitor.getOverallBufferHealth());
    }, 100); // Update every 100ms
    
    return () => clearInterval(interval);
  }, [bufferMonitor]);
  
  return {
    metrics: bufferMetrics,
    health: bufferHealth,
    isHealthy: bufferHealth === 'healthy',
    hasOverflows: bufferMetrics && Object.values(bufferMetrics).some(m => m.overflowCount > 0),
    hasUnderflows: bufferMetrics && Object.values(bufferMetrics).some(m => m.underflowCount > 0)
  };
}
```

### 5. Protocol Implementation

```typescript
// Official rkdeveloptool protocol implementation
export class ProtocolManager {
  private device: RockchipDevice;
  private communicator: USBCommunication;
  
  // Core protocol commands matching rkdeveloptool
  async downloadBoot(bootloader: ArrayBuffer): Promise<void>;
  async writeLBA(startSector: number, data: ArrayBuffer): Promise<void>;
  async readLBA(startSector: number, sectorCount: number): Promise<ArrayBuffer>;
  async readFlashID(): Promise<FlashInfo>;
  async testDevice(): Promise<boolean>;
  async resetDevice(): Promise<void>;
  
  // Storage device management
  async switchStorage(storageType: StorageType): Promise<boolean>;
  async detectStorageDevices(): Promise<StorageDevice[]>;
  
  // Advanced operations
  async uploadLoader(loader: ArrayBuffer): Promise<void>;
  async writeGPT(gptData: ArrayBuffer): Promise<void>;
  async eraseFlash(): Promise<void>;
}

// USB communication layer following libusb patterns
export class USBCommunication {
  private device: USBDevice;
  private endpoints: USBEndpoints;
  
  async sendCommand(command: ProtocolCommand): Promise<CommandResponse>;
  async transferData(data: ArrayBuffer, direction: TransferDirection): Promise<TransferResult>;
  async bulkTransfer(endpoint: number, data: ArrayBuffer): Promise<USBTransferResult>;
  
  // Error handling and recovery
  async recoverFromError(error: USBError): Promise<boolean>;
  async reinitializeConnection(): Promise<void>;
}
```

### 6. Type Definitions

```typescript
// Comprehensive type system
export type ChipType = 'RK3588' | 'RK3566' | 'RK3568' | 'RK3399' | 'RK3328';
export type DeviceMode = 'maskrom' | 'loader' | 'msc' | 'unknown';
export type OperationType = 'flash' | 'read' | 'erase' | 'bootloader';
export type OperationPhase = 'initializing' | 'transferring' | 'verifying' | 'completed';
export type BufferHealth = 'healthy' | 'warning' | 'critical';
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface FlashOptions {
  targetStorage?: StorageType;
  verifyAfterWrite?: boolean;
  compressionEnabled?: boolean;
  chunkSize?: number;
  retryCount?: number;
  progressCallback?: (progress: OperationProgress) => void;
}

export interface PerformanceMetrics {
  writeSpeed: number;
  readSpeed: number;
  compressionRatio: number;
  errorRate: number;
  usbUtilization: number;
}

export interface StorageDevice {
  type: StorageType;
  name: string;
  capacity: number;
  available: boolean;
  recommended: boolean;
}
```

### 7. Usage Examples

```typescript
// Basic usage example
import { 
  RockchipDeviceFactory, 
  FlashOperation, 
  useRockchipDevice, 
  useFlashOperation 
} from '@rockchip/webusb-flasher';

// React component example
function FlashingComponent() {
  const { device, requestDevice, connect, disconnect } = useRockchipDevice();
  const { startFlash, metrics, progress, writeSpeed } = useFlashOperation(device);
  
  const handleFlash = async (imageFile: File) => {
    const imageData = await imageFile.arrayBuffer();
    
    await startFlash(imageData, {
      targetStorage: 'emmc',
      verifyAfterWrite: true,
      compressionEnabled: true
    });
  };
  
  return (
    <div>
      <button onClick={requestDevice}>Select Device</button>
      <button onClick={() => connect(device)} disabled={!device}>Connect</button>
      
      {metrics && (
        <div>
          <div>Progress: {progress}%</div>
          <div>Write Speed: {(writeSpeed / 1024 / 1024).toFixed(2)} MB/s</div>
          <div>Buffer Usage: {metrics.buffers.writeBuffer.utilizationPercentage}%</div>
        </div>
      )}
    </div>
  );
}

// Advanced metrics monitoring
function MetricsDashboard() {
  const { current, history, averageWriteSpeed, bufferHealth } = useMetrics(operation);
  const { metrics: bufferMetrics, health, hasOverflows } = useBufferStatus(bufferMonitor);
  
  return (
    <div>
      <div>Average Speed: {(averageWriteSpeed / 1024 / 1024).toFixed(2)} MB/s</div>
      <div>Buffer Health: {health}</div>
      {hasOverflows && <div>Warning: Buffer overflows detected</div>}
      
      {/* Real-time charts would go here */}
      <MetricsChart data={history} />
      <BufferUtilizationChart data={bufferMetrics} />
    </div>
  );
}
```

## Key Features

### 1. Real-time Metrics
- Write/read speeds with historical tracking
- Buffer utilization monitoring
- USB transfer rate analysis
- Error rate tracking
- Performance bottleneck detection

### 2. Buffer Management
- Adaptive buffer sizing based on performance
- Overflow/underflow detection and mitigation
- Compression/decompression buffer optimization
- Memory usage monitoring

### 3. React Integration
- Custom hooks for all major operations
- Event-driven updates for real-time UI
- TypeScript support throughout
- Zero UI dependencies (hooks only)

### 4. Protocol Compliance
- Full rkdeveloptool command compatibility
- Proper USB Bulk-Only Transport implementation
- Device state management following official patterns
- Error recovery mechanisms

### 5. Performance Optimization
- Chunked transfers with optimal sizing
- Background compression/decompression
- Adaptive retry mechanisms
- Connection pooling and reuse

## Installation & Usage

```bash
npm install @rockchip/webusb-flasher
```

```typescript
import { useRockchipDevice, useFlashOperation } from '@rockchip/webusb-flasher';
```

This API design provides comprehensive metrics, follows React patterns, maintains compatibility with the official rkdeveloptool protocol, and offers extensive customization while remaining UI-agnostic. 