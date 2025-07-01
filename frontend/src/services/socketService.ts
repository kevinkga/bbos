import { io, Socket } from 'socket.io-client';

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