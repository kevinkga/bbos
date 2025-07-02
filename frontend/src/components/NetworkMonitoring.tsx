import React from 'react';
import { NetworkMonitoringProps } from '../types/network';

export const NetworkMonitoring: React.FC<NetworkMonitoringProps> = ({
  nodes
}) => {
  return (
    <div>
      <p className="text-gray-600 mb-4">Network monitoring interface coming soon...</p>
      <div className="text-sm text-gray-500">
        Monitoring {nodes.length} nodes
      </div>
    </div>
  );
}; 