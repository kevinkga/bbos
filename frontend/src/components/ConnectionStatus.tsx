import React from 'react';
import { useSocket } from '../hooks/useSocket';

interface ConnectionStatusProps {
  className?: string;
  showLabel?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
}

export const ConnectionStatus: React.FC<ConnectionStatusProps> = ({
  className = '',
  showLabel = true,
  position = 'top-right'
}) => {
  const { connected, connecting, error } = useSocket({ autoConnect: false });

  const getStatusConfig = () => {
    if (connecting) {
      return {
        color: 'bg-yellow-500',
        text: 'Connecting...',
        icon: (
          <div className="animate-spin rounded-full h-3 w-3 border-2 border-white border-t-transparent" />
        )
      };
    }
    
    if (connected) {
      return {
        color: 'bg-green-500',
        text: 'Connected',
        icon: (
          <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
          </svg>
        )
      };
    }
    
    return {
      color: 'bg-red-500',
      text: error ? `Error: ${error}` : 'Disconnected',
      icon: (
        <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      )
    };
  };

  const status = getStatusConfig();

  const positionClasses = {
    'top-right': 'fixed top-4 right-4 z-50',
    'top-left': 'fixed top-4 left-4 z-50',
    'bottom-right': 'fixed bottom-4 right-4 z-50',
    'bottom-left': 'fixed bottom-4 left-4 z-50',
    'inline': 'relative'
  };

  const baseClasses = `
    flex items-center gap-2 px-3 py-2 rounded-full shadow-lg backdrop-blur-sm
    ${status.color} text-white text-sm font-medium
    transition-all duration-300 hover:shadow-xl
    ${positionClasses[position]}
    ${className}
  `;

  return (
    <div className={baseClasses} title={status.text}>
      <div className="flex items-center justify-center">
        {status.icon}
      </div>
      
      {showLabel && (
        <span className="text-xs font-medium whitespace-nowrap">
          {status.text}
        </span>
      )}
      
      {/* Pulsing animation for connecting state */}
      {connecting && (
        <div className="absolute inset-0 rounded-full bg-yellow-400 opacity-30 animate-ping" />
      )}
    </div>
  );
};

// Compact version for toolbar use
export const ConnectionStatusCompact: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { connected, connecting, error } = useSocket({ autoConnect: false });

  const getStatusColor = () => {
    if (connecting) return 'bg-yellow-500';
    if (connected) return 'bg-green-500';
    return 'bg-red-500';
  };

  const getTooltip = () => {
    if (connecting) return 'Connecting to backend...';
    if (connected) return 'Connected to backend';
    return error ? `Connection error: ${error}` : 'Disconnected from backend';
  };

  return (
    <div 
      className={`relative flex items-center ${className}`}
      title={getTooltip()}
    >
      <div className={`
        w-2 h-2 rounded-full ${getStatusColor()}
        ${connecting ? 'animate-pulse' : ''}
        transition-colors duration-300
      `} />
      
      {connecting && (
        <div className="absolute inset-0 w-2 h-2 rounded-full bg-yellow-400 opacity-30 animate-ping" />
      )}
    </div>
  );
}; 