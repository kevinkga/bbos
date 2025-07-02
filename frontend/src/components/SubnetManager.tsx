import React from 'react';
import { SubnetManagerProps } from '../types/network';

export const SubnetManager: React.FC<SubnetManagerProps> = ({
  nodes,
  onNodeUpdate
}) => {
  return (
    <div className="bg-white rounded-lg border p-6">
      <h2 className="text-lg font-semibold mb-4">Subnet Management</h2>
      <p className="text-gray-600 mb-4">Subnet management interface coming soon...</p>
      <div className="text-sm text-gray-500">
        Managing {nodes.length} nodes across subnets
      </div>
    </div>
  );
}; 