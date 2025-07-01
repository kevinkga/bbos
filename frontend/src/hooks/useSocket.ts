import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export interface SocketState {
  socket: Socket | null;
  connected: boolean;
  connecting: boolean;
  error: string | null;
}

export interface BuildStatus {
  id: string;
  status: 'pending' | 'building' | 'completed' | 'failed';
  progress: number;
  message: string;
  startTime?: string;
  endTime?: string;
}

interface UseSocketOptions {
  autoConnect?: boolean;
  onBuildUpdate?: (build: BuildStatus) => void;
  onStatusChange?: (status: 'connected' | 'disconnected' | 'error', error?: string) => void;
}

export const useSocket = (options: UseSocketOptions = {}) => {
  const { autoConnect = true } = options;
  
  const [state, setState] = useState<SocketState>({
    socket: null,
    connected: false,
    connecting: false,
    error: null
  });
  
  const socketRef = useRef<Socket | null>(null);
  const optionsRef = useRef(options);
  
  // Update options ref when they change
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const connect = () => {
    if (socketRef.current?.connected) return;
    
    setState(prev => ({ ...prev, connecting: true, error: null }));
    
    const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
    
    const socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      timeout: 5000,
      retries: 3,
      autoConnect: true
    });
    
    socket.on('connect', () => {
      console.log('✅ Socket.io connected to backend');
      setState(prev => ({
        ...prev,
        socket,
        connected: true,
        connecting: false,
        error: null
      }));
      options.onStatusChange?.('connected');
    });
    
    socket.on('disconnect', (reason) => {
      console.log('❌ Socket.io disconnected:', reason);
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: null
      }));
      options.onStatusChange?.('disconnected');
    });
    
    socket.on('connect_error', (error) => {
      console.error('🔌 Socket.io connection error:', error);
      setState(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: error.message || 'Connection failed'
      }));
      options.onStatusChange?.('error', error.message);
    });
    
    // Build status updates
    socket.on('build:status', (buildData: BuildStatus) => {
      console.log('🏗️ Build update received:', buildData);
      options.onBuildUpdate?.(buildData);
    });
    
    // System status updates
    socket.on('system:status', (data) => {
      console.log('💻 System status:', data);
    });
    
    socketRef.current = socket;
  };
  
  const disconnect = () => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
      setState(prev => ({
        ...prev,
        socket: null,
        connected: false,
        connecting: false,
        error: null
      }));
    }
  };
  
  const emit = <T>(event: string, data?: T) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('⚠️ Cannot emit event - socket not connected:', event);
    }
  };
  
  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect]);
  
  return {
    ...state,
    connect,
    disconnect,
    emit
  };
}; 