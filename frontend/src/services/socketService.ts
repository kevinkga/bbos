import { io, Socket } from 'socket.io-client';
import {
  BuildProgress,
  Device,
  FlashProgressEvent,
  FlashCompletedEvent,
  FlashFailedEvent,
  SPIProgressEvent,
  SPICompletedEvent,
  SPIErrorEvent,
  DeviceProgressEvent,
  DeviceCompletedEvent,
  DeviceErrorEvent
} from '../types/index.js';

export interface BuildStatus {
  id: string;
  status: string;
  progress: number;
  message: string;
  timestamp: string;
  startTime?: string;
  endTime?: string;
  configurationId?: string;
  configuration?: any;
}

type SocketEventCallback = (...args: any[]) => void;

class SocketService {
  private socket: Socket | null = null;
  private eventCallbacks: Map<string, Set<SocketEventCallback>> = new Map();
  private connected = false;
  private connecting = false;

  constructor() {
    this.connect();
  }

  private connect() {
    if (this.socket?.connected || this.connecting) return;
    
    this.connecting = true;
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      retries: 3,
      autoConnect: true
    });

    this.socket.on('connect', () => {
      console.log('✅ SocketService: Connected to backend');
      this.connected = true;
      this.connecting = false;
      this.emit('connection:status', { connected: true });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ SocketService: Disconnected:', reason);
      this.connected = false;
      this.connecting = false;
      this.emit('connection:status', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('🔌 SocketService: Connection error:', error);
      this.connected = false;
      this.connecting = false;
      this.emit('connection:error', { error: error.message });
    });

    // Build events
    this.socket.on('build:update', (data: BuildStatus) => {
      console.log('🏗️ SocketService: Build update received:', data);
      this.emit('build:update', data);
    });

    this.socket.on('build:completed', (data: BuildStatus) => {
      console.log('✅ SocketService: Build completed received:', data);
      this.emit('build:completed', data);
      this.emit('build:update', data); // Also trigger update handler for compatibility
    });

    this.socket.on('build:failed', (data: BuildStatus) => {
      console.log('❌ SocketService: Build failed received:', data);
      this.emit('build:failed', data);
      this.emit('build:update', data); // Also trigger update handler for compatibility
    });

    this.socket.on('build:cancelled', (data: BuildStatus) => {
      console.log('🛑 SocketService: Build cancelled received:', data);
      this.emit('build:cancelled', data);
      this.emit('build:update', data); // Also trigger update handler for compatibility
    });

    this.socket.on('build:created', (data: BuildStatus) => {
      console.log('🆕 SocketService: Build created received:', data);
      this.emit('build:created', data);
    });

    this.socket.on('build:error', (data: any) => {
      console.log('🚨 SocketService: Build error received:', data);
      this.emit('build:error', data);
    });

    this.socket.on('build:status', (data: BuildStatus) => {
      console.log('🏗️ SocketService: Legacy build status received:', data);
      this.emit('build:status', data);
    });

    // Build progress events
    this.socket.on('build:progress', (data: BuildProgress) => {
      console.log('🏗️ SocketService: Build progress received:', data);
      this.emit('build:progress', data);
    });

    // Flash progress events
    this.socket.on('flash:progress', (data: FlashProgressEvent) => {
      console.log('💡 SocketService: Flash progress received:', data);
      this.emit('flash:progress', data);
    });

    // Device events
    this.socket.on('hardware:devices', (data: { devices: Device[], force: boolean, timestamp: string }) => {
      console.log('🖥️ SocketService: Hardware devices received:', data);
      this.emit('hardware:devices', data);
    });

    this.socket.on('hardware:error', (data: { error: string, timestamp: string }) => {
      console.error('🚨 SocketService: Hardware error received:', data);
      this.emit('hardware:error', data);
    });

    this.socket.on('hardware:detection-changed', (data: { enabled: boolean, message: string, timestamp: string }) => {
      console.log('🔍 SocketService: Hardware detection changed:', data);
      this.emit('hardware:detection-changed', data);
    });

    // SPI operation events
    this.socket.on('spi:progress', (data: SPIProgressEvent) => {
      console.log('🔄 SocketService: SPI progress received:', data);
      this.emit('spi:progress', data);
    });

    this.socket.on('spi:completed', (data: SPICompletedEvent) => {
      console.log('✅ SocketService: SPI completed received:', data);
      this.emit('spi:completed', data);
    });

    this.socket.on('spi:error', (data: SPIErrorEvent) => {
      console.error('🚨 SocketService: SPI error received:', data);
      this.emit('spi:error', data);
    });

    // Device operation events
    this.socket.on('device:progress', (data: DeviceProgressEvent) => {
      console.log('🖥️ SocketService: Device progress received:', data);
      this.emit('device:progress', data);
    });

    this.socket.on('device:completed', (data: DeviceCompletedEvent) => {
      console.log('✅ SocketService: Device completed received:', data);
      this.emit('device:completed', data);
    });

    this.socket.on('device:error', (data: DeviceErrorEvent) => {
      console.error('🚨 SocketService: Device error received:', data);
      this.emit('device:error', data);
    });
  }

  // Event subscription
  public on(event: string, callback: SocketEventCallback): () => void {
    if (!this.eventCallbacks.has(event)) {
      this.eventCallbacks.set(event, new Set());
    }
    this.eventCallbacks.get(event)!.add(callback);

    // Return unsubscribe function
    return () => {
      const callbacks = this.eventCallbacks.get(event);
      if (callbacks) {
        callbacks.delete(callback);
        if (callbacks.size === 0) {
          this.eventCallbacks.delete(event);
        }
      }
    };
  }

  // Event emission to local listeners
  private emit(event: string, data: any) {
    const callbacks = this.eventCallbacks.get(event);
    if (callbacks) {
      callbacks.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in socket event callback for ${event}:`, error);
        }
      });
    }
  }

  // Send events to backend
  public send(event: string, data?: any): boolean {
    if (this.socket?.connected) {
      this.socket.emit(event, data);
      return true;
    } else {
      console.warn('⚠️ SocketService: Cannot send event - not connected:', event);
      return false;
    }
  }

  public isConnected(): boolean {
    return this.connected;
  }

  public disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.connected = false;
      this.connecting = false;
    }
  }
}

// Singleton instance
export const socketService = new SocketService();

// React hook for using the socket service
export const useSocketService = () => {
  return {
    on: socketService.on.bind(socketService),
    send: socketService.send.bind(socketService),
    isConnected: socketService.isConnected.bind(socketService),
    connected: socketService.isConnected()
  };
}; 