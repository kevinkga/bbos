import React from 'react';
import { NetworkTopologyViewProps } from '../types/network';

export const NetworkTopologyView: React.FC<NetworkTopologyViewProps> = ({
  nodes,
  onNodeSelect,
  onNodeUpdate,
  onNodeBuild,
  onNodeFlash
}) => {
  return (
    <div className="p-4">
      <div className="bg-white rounded-lg border p-6 text-center">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">Network Topology View</h3>
        <p className="text-gray-600 mb-4">Interactive network topology visualization coming soon...</p>
        <div className="text-sm text-gray-500">
          {nodes.length} nodes detected
        </div>
      </div>
    </div>
  );
}; 