import React from 'react';
import { X } from 'lucide-react';
import { NetworkConfigurationModalProps } from '../types/network';

export const NetworkConfigurationModal: React.FC<NetworkConfigurationModalProps> = ({
  onClose,
  onSave
}) => {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Network Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <p className="text-gray-600 mb-4">Network configuration interface coming soon...</p>
        
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={() => onSave({})} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save
          </button>
        </div>
      </div>
    </div>
  );
}; 