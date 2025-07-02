# Implementation Guide: Key Technical Components

This guide shows how the proposed npm API components work together to provide real-time metrics and efficient buffer management.

## 1. Core Architecture Implementation

### MetricsCollector Implementation

```typescript
// Real-time metrics collection with efficient data structures
export class MetricsCollector {
  private currentSnapshot: MetricsSnapshot;
  private history: MetricsSnapshot[] = [];
  private listeners: Set<(metrics: MetricsSnapshot) => void> = new Set();
  private collectInterval: number | null = null;
  private startTime: number = 0;
  
  constructor(private operation: BaseOperation) {
    this.initializeSnapshot();
  }
  
  startCollection(): void {
    this.startTime = Date.now();
    this.collectInterval = window.setInterval(() => {
      this.collectMetrics();
      this.notifyListeners();
    }, 100); // 10Hz update rate
  }
  
  stopCollection(): void {
    if (this.collectInterval) {
      clearInterval(this.collectInterval);
      this.collectInterval = null;
    }
  }
  
  private collectMetrics(): void {
    const now = Date.now();
    const elapsed = now - this.startTime;
    
    // Collect operation metrics
    const operationMetrics = this.operation.getOperationMetrics();
    
    // Collect buffer metrics from buffer manager
    const bufferMetrics = this.operation.getBufferManager().getAllMetrics();
    
    // Collect system metrics (memory, CPU usage)
    const systemMetrics = this.getSystemMetrics();
    
    // Calculate performance metrics
    const performanceMetrics = this.calculatePerformanceMetrics(
      operationMetrics, 
      elapsed
    );
    
    this.currentSnapshot = {
      timestamp: now,
      operation: operationMetrics,
      performance: performanceMetrics,
      buffers: bufferMetrics,
      system: systemMetrics
    };
    
    // Store in circular buffer (last 1000 samples = ~100 seconds at 10Hz)
    this.history.push(this.currentSnapshot);
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }
  
  private calculatePerformanceMetrics(
    operation: OperationMetrics, 
    elapsed: number
  ): PerformanceMetrics {
    const timeInSeconds = elapsed / 1000;
    
    return {
      writeSpeed: operation.bytesProcessed / timeInSeconds,
      readSpeed: this.calculateReadSpeed(),
      compressionSpeed: this.calculateCompressionSpeed(),
      decompressionSpeed: this.calculateDecompressionSpeed(),
      usbTransferRate: this.calculateUSBTransferRate(),
      errorRate: operation.errorCount / timeInSeconds
    };
  }
  
  subscribe(callback: (metrics: MetricsSnapshot) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }
  
  getBottlenecks(): PerformanceBottleneck[] {
    const bottlenecks: PerformanceBottleneck[] = [];
    
    // Analyze buffer utilization
    Object.entries(this.currentSnapshot.buffers).forEach(([name, buffer]) => {
      if (buffer.utilizationPercentage > 90) {
        bottlenecks.push({
          type: 'buffer_congestion',
          component: name,
          severity: 'high',
          impact: `${name} buffer at ${buffer.utilizationPercentage}% capacity`
        });
      }
    });
    
    // Analyze transfer speeds
    if (this.currentSnapshot.performance.writeSpeed < 1024 * 1024) { // < 1 MB/s
      bottlenecks.push({
        type: 'slow_transfer',
        component: 'usb',
        severity: 'medium',
        impact: `Write speed below optimal: ${this.formatSpeed(this.currentSnapshot.performance.writeSpeed)}`
      });
    }
    
    return bottlenecks;
  }
}
```

### Advanced Buffer Management

```typescript
// Sophisticated buffer management with adaptive sizing
export class BufferManager {
  private writeBuffer: CircularBuffer;
  private readBuffer: CircularBuffer;
  private compressionBuffer: CircularBuffer;
  private decompressionBuffer: CircularBuffer;
  
  private metrics: Map<string, BufferMetrics> = new Map();
  private adaptiveConfig: AdaptiveBufferConfig;
  
  constructor(initialConfig: BufferConfiguration) {
    this.initializeBuffers(initialConfig);
    this.adaptiveConfig = new AdaptiveBufferConfig();
    this.startMetricsCollection();
  }
  
  private initializeBuffers(config: BufferConfiguration): void {
    this.writeBuffer = new CircularBuffer(config.writeBufferSize, 'write');
    this.readBuffer = new CircularBuffer(config.readBufferSize, 'read');
    this.compressionBuffer = new CircularBuffer(config.compressionBufferSize, 'compression');
    this.decompressionBuffer = new CircularBuffer(config.decompressionBufferSize, 'decompression');
  }
  
  // Adaptive buffer sizing based on performance metrics
  optimizeBufferSizes(performanceHistory: MetricsSnapshot[]): BufferConfiguration {
    const analysis = this.adaptiveConfig.analyzePerformance(performanceHistory);
    
    return {
      writeBufferSize: this.calculateOptimalSize('write', analysis),
      readBufferSize: this.calculateOptimalSize('read', analysis),
      compressionBufferSize: this.calculateOptimalSize('compression', analysis),
      decompressionBufferSize: this.calculateOptimalSize('decompression', analysis)
    };
  }
  
  private calculateOptimalSize(bufferType: string, analysis: PerformanceAnalysis): number {
    const currentMetrics = this.metrics.get(bufferType);
    if (!currentMetrics) return this.getDefaultSize(bufferType);
    
    // If buffer is frequently overflowing, increase size
    if (currentMetrics.overflowCount > 0) {
      return Math.min(currentMetrics.capacity * 1.5, this.getMaxSize(bufferType));
    }
    
    // If buffer is underutilized, decrease size to save memory
    if (currentMetrics.utilizationPercentage < 30) {
      return Math.max(currentMetrics.capacity * 0.8, this.getMinSize(bufferType));
    }
    
    return currentMetrics.capacity; // Keep current size
  }
  
  // High-performance write operation with flow control
  async writeChunk(data: ArrayBuffer, priority: Priority = 'normal'): Promise<void> {
    const startTime = performance.now();
    
    // Check buffer capacity before writing
    if (!this.writeBuffer.hasCapacity(data.byteLength)) {
      // Implement backpressure
      await this.waitForCapacity(this.writeBuffer, data.byteLength);
    }
    
    try {
      await this.writeBuffer.write(data, priority);
      this.updateMetrics('write', data.byteLength, performance.now() - startTime);
    } catch (error) {
      this.handleBufferError('write', error);
      throw error;
    }
  }
  
  // Efficient compression with streaming
  async compressStream(source: ReadableStream<Uint8Array>): Promise<ReadableStream<Uint8Array>> {
    const compressionWorker = new CompressionWorker();
    
    return new ReadableStream({
      async start(controller) {
        const reader = source.getReader();
        
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            // Check compression buffer capacity
            if (!this.compressionBuffer.hasCapacity(value.length)) {
              await this.waitForCapacity(this.compressionBuffer, value.length);
            }
            
            const compressed = await compressionWorker.compress(value);
            controller.enqueue(compressed);
            
            this.updateCompressionMetrics(value.length, compressed.length);
          }
        } finally {
          reader.releaseLock();
          controller.close();
        }
      }
    });
  }
  
  getAllMetrics(): { [key: string]: BufferMetrics } {
    return {
      writeBuffer: this.getBufferMetrics('write'),
      readBuffer: this.getBufferMetrics('read'),
      compressionBuffer: this.getBufferMetrics('compression'),
      decompressionBuffer: this.getBufferMetrics('decompression')
    };
  }
}

// High-performance circular buffer implementation
class CircularBuffer {
  private buffer: ArrayBuffer;
  private view: Uint8Array;
  private readPosition: number = 0;
  private writePosition: number = 0;
  private size: number = 0;
  private capacity: number;
  private overflowCount: number = 0;
  private underflowCount: number = 0;
  private throughput: ThroughputCalculator;
  
  constructor(capacity: number, private name: string) {
    this.capacity = capacity;
    this.buffer = new ArrayBuffer(capacity);
    this.view = new Uint8Array(this.buffer);
    this.throughput = new ThroughputCalculator();
  }
  
  async write(data: ArrayBuffer, priority: Priority = 'normal'): Promise<void> {
    const dataView = new Uint8Array(data);
    const writeSize = dataView.length;
    
    if (writeSize > this.getAvailableSpace()) {
      this.overflowCount++;
      if (priority === 'low') {
        throw new Error(`Buffer overflow: cannot write ${writeSize} bytes`);
      }
      // For high priority, wait for space
      await this.waitForSpace(writeSize);
    }
    
    // Handle wrap-around writes efficiently
    if (this.writePosition + writeSize <= this.capacity) {
      // Simple case: no wrap-around
      this.view.set(dataView, this.writePosition);
    } else {
      // Split write at buffer boundary
      const firstChunk = this.capacity - this.writePosition;
      const secondChunk = writeSize - firstChunk;
      
      this.view.set(dataView.subarray(0, firstChunk), this.writePosition);
      this.view.set(dataView.subarray(firstChunk), 0);
    }
    
    this.writePosition = (this.writePosition + writeSize) % this.capacity;
    this.size += writeSize;
    this.throughput.recordWrite(writeSize);
  }
  
  hasCapacity(requiredSize: number): boolean {
    return this.getAvailableSpace() >= requiredSize;
  }
  
  getMetrics(): BufferMetrics {
    return {
      capacity: this.capacity,
      used: this.size,
      available: this.getAvailableSpace(),
      utilizationPercentage: (this.size / this.capacity) * 100,
      throughput: this.throughput.getCurrentThroughput(),
      queueLength: this.getPendingOperations(),
      overflowCount: this.overflowCount,
      underflowCount: this.underflowCount
    };
  }
}
```

### React Integration Example

```typescript
// Advanced React hook with performance optimization
export function useFlashOperation(device: RockchipDevice | null) {
  const [operation, setOperation] = useState<FlashOperation | null>(null);
  const [metrics, setMetrics] = useState<MetricsSnapshot | null>(null);
  const [status, setStatus] = useState<OperationStatus>('idle');
  const [bufferHealth, setBufferHealth] = useState<BufferHealth>('healthy');
  
  // Memoized metrics processor to avoid unnecessary re-renders
  const processedMetrics = useMemo(() => {
    if (!metrics) return null;
    
    return {
      progress: metrics.operation.progress,
      speed: metrics.performance.writeSpeed,
      eta: estimateTimeRemaining(metrics),
      bufferStatus: processBufferMetrics(metrics.buffers),
      bottlenecks: identifyBottlenecks(metrics)
    };
  }, [metrics]);
  
  // Debounced metrics updates to reduce React re-renders
  const debouncedMetricsUpdate = useMemo(
    () => debounce((snapshot: MetricsSnapshot) => {
      setMetrics(snapshot);
      setBufferHealth(analyzeBufferHealth(snapshot.buffers));
    }, 100),
    []
  );
  
  const startFlash = useCallback(async (
    imageData: ArrayBuffer,
    options: FlashOptions
  ) => {
    if (!device) throw new Error('No device connected');
    
    // Create operation with adaptive buffer configuration
    const bufferConfig = await optimizeBuffersForDevice(device);
    const flashOp = new FlashOperation(device, imageData, {
      ...options,
      bufferConfiguration: bufferConfig
    });
    
    // Set up metrics subscription with throttling
    const metricsCollector = flashOp.getMetricsCollector();
    const unsubscribe = metricsCollector.subscribe(debouncedMetricsUpdate);
    
    // Set up buffer monitoring
    const bufferMonitor = flashOp.getBufferManager();
    const bufferUnsubscribe = bufferMonitor.onHealthChange((health: BufferHealth) => {
      setBufferHealth(health);
      
      // Auto-adjust if buffer health is poor
      if (health === 'critical') {
        flashOp.adjustBufferSizes(bufferMonitor.getOptimalConfiguration());
      }
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
      bufferUnsubscribe();
    }
  }, [device, debouncedMetricsUpdate]);
  
  // Auto-pause on buffer critical state
  useEffect(() => {
    if (bufferHealth === 'critical' && operation && status === 'running') {
      operation.pause().then(() => {
        console.warn('Operation paused due to critical buffer state');
        // Auto-resume after buffer recovery
        setTimeout(() => {
          if (bufferHealth !== 'critical') {
            operation.resume();
          }
        }, 1000);
      });
    }
  }, [bufferHealth, operation, status]);
  
  return {
    startFlash,
    cancelFlash: operation?.cancel,
    pauseFlash: operation?.pause,
    resumeFlash: operation?.resume,
    status,
    metrics: processedMetrics,
    bufferHealth,
    // Real-time computed properties
    isStalled: processedMetrics?.speed === 0 && status === 'running',
    hasBottlenecks: processedMetrics?.bottlenecks.length > 0,
    // Performance indicators
    efficiency: processedMetrics ? calculateEfficiency(processedMetrics) : 0,
    qualityScore: processedMetrics ? calculateQualityScore(processedMetrics) : 0
  };
}

// Advanced metrics dashboard hook
export function useMetricsDashboard(operation: BaseOperation | null) {
  const [aggregatedMetrics, setAggregatedMetrics] = useState<AggregatedMetrics | null>(null);
  const [performanceTrends, setPerformanceTrends] = useState<PerformanceTrend[]>([]);
  
  useEffect(() => {
    if (!operation) return;
    
    const collector = operation.getMetricsCollector();
    
    const unsubscribe = collector.subscribe((snapshot: MetricsSnapshot) => {
      // Update aggregated metrics
      setAggregatedMetrics(prev => aggregateMetrics(prev, snapshot));
      
      // Update performance trends
      setPerformanceTrends(prev => {
        const newTrend = calculateTrend(snapshot);
        return [...prev.slice(-50), newTrend]; // Keep last 50 trend points
      });
    });
    
    return unsubscribe;
  }, [operation]);
  
  return {
    aggregated: aggregatedMetrics,
    trends: performanceTrends,
    summary: aggregatedMetrics ? generatePerformanceSummary(aggregatedMetrics) : null,
    recommendations: aggregatedMetrics ? generateOptimizationRecommendations(aggregatedMetrics) : []
  };
}
```

### Performance Optimization Techniques

```typescript
// Web Worker for background compression
class CompressionWorker {
  private worker: Worker;
  private taskQueue: Map<number, CompressTask> = new Map();
  private taskId: number = 0;
  
  constructor() {
    this.worker = new Worker('/compression-worker.js');
    this.worker.onmessage = this.handleWorkerMessage.bind(this);
  }
  
  async compress(data: Uint8Array): Promise<Uint8Array> {
    return new Promise((resolve, reject) => {
      const taskId = ++this.taskId;
      
      this.taskQueue.set(taskId, { resolve, reject });
      
      this.worker.postMessage({
        id: taskId,
        command: 'compress',
        data: data.buffer
      }, [data.buffer]); // Transfer ownership for performance
    });
  }
  
  private handleWorkerMessage(event: MessageEvent): void {
    const { id, result, error } = event.data;
    const task = this.taskQueue.get(id);
    
    if (task) {
      this.taskQueue.delete(id);
      if (error) {
        task.reject(new Error(error));
      } else {
        task.resolve(new Uint8Array(result));
      }
    }
  }
}

// Adaptive performance tuning
class PerformanceTuner {
  private history: PerformanceMetrics[] = [];
  private currentConfig: PerformanceConfiguration;
  
  tune(metrics: MetricsSnapshot): PerformanceConfiguration {
    this.history.push(metrics.performance);
    
    // Analyze recent performance
    const recentMetrics = this.history.slice(-10);
    const avgSpeed = recentMetrics.reduce((sum, m) => sum + m.writeSpeed, 0) / recentMetrics.length;
    
    // Adjust chunk size based on throughput
    if (avgSpeed < this.getTargetSpeed() * 0.8) {
      this.currentConfig.chunkSize = Math.min(
        this.currentConfig.chunkSize * 1.2,
        this.getMaxChunkSize()
      );
    } else if (avgSpeed > this.getTargetSpeed() * 1.2) {
      this.currentConfig.chunkSize = Math.max(
        this.currentConfig.chunkSize * 0.9,
        this.getMinChunkSize()
      );
    }
    
    // Adjust buffer sizes based on utilization
    Object.entries(metrics.buffers).forEach(([name, buffer]) => {
      if (buffer.utilizationPercentage > 85) {
        this.increaseBufferSize(name);
      } else if (buffer.utilizationPercentage < 40) {
        this.decreaseBufferSize(name);
      }
    });
    
    return this.currentConfig;
  }
}
```

## Key Implementation Benefits

### 1. **Real-time Performance Monitoring**
- 10Hz metrics collection for responsive UI updates
- Circular buffer storage for efficient memory usage
- Automatic bottleneck detection and reporting

### 2. **Adaptive Buffer Management**
- Dynamic buffer sizing based on performance patterns
- Flow control and backpressure handling
- Overflow/underflow prevention with intelligent queuing

### 3. **React-Optimized Integration**
- Debounced updates to prevent excessive re-renders
- Memoized computed properties for performance
- Automatic state management with cleanup

### 4. **Background Processing**
- Web Worker-based compression/decompression
- Non-blocking buffer operations
- Transferable objects for zero-copy operations

### 5. **Intelligent Error Recovery**
- Automatic pause/resume on buffer critical states
- Progressive retry mechanisms
- Connection recovery with state preservation

This implementation provides enterprise-grade performance monitoring and buffer management while maintaining a clean, React-friendly API that can be easily integrated into modern web applications. 