import React from 'react';
import { SecurityOverviewProps } from '../types/network';

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({
  nodes
}) => {
  return (
    <div>
      <p className="text-gray-600 mb-4">Security zone management interface coming soon...</p>
      <div className="text-sm text-gray-500">
        Monitoring security for {nodes.length} nodes
      </div>
    </div>
  );
}; 