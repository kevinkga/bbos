import React from 'react';
import { X } from 'lucide-react';
import { DeviceTemplateSelectorProps } from '../types/network';

export const DeviceTemplateSelector: React.FC<DeviceTemplateSelectorProps> = ({
  onSelect,
  onClose
}) => {
  const templates = [
    { id: 'rk3588_rock5b', name: 'Radxa Rock 5B (RK3588)', description: 'High-performance SBC' },
    { id: 'rk3566_rock3w', name: 'Radxa Rock 3W (RK3566)', description: 'Compact WiFi 6 SBC' },
    { id: 'bcm2712_rpi5', name: 'Raspberry Pi 5', description: 'Latest Pi with PCIe' },
    { id: 'bcm2711_rpi_cm4', name: 'Pi Compute Module 4', description: 'Industrial Pi module' }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Select Device Template</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        <div className="grid gap-4">
          {templates.map(template => (
            <div key={template.id} className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer"
                 onClick={() => onSelect(template.id, {})}>
              <h3 className="font-semibold">{template.name}</h3>
              <p className="text-gray-600 text-sm">{template.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}; 