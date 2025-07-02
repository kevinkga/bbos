import React from 'react';
import { Server, Wifi, Activity, Settings, Play, Download, Trash2 } from 'lucide-react';
import { NodeCardProps } from '../types/network';

export const NodeCard: React.FC<NodeCardProps> = ({
  node,
  onUpdate,
  onBuild,
  onFlash,
  onDelete,
  expanded = false
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'deployed': return 'text-green-600 bg-green-100';
      case 'building': return 'text-blue-600 bg-blue-100';
      case 'error': return 'text-red-600 bg-red-100';
      case 'maintenance': return 'text-yellow-600 bg-yellow-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getNodeIcon = (nodeType: string) => {
    switch (nodeType) {
      case 'sbc': return <Server className="w-5 h-5" />;
      case 'router': case 'switch': return <Wifi className="w-5 h-5" />;
      default: return <Server className="w-5 h-5" />;
    }
  };

  return (
    <div className={`bg-white rounded-lg border p-4 hover:shadow-md transition-shadow ${expanded ? 'shadow-lg' : ''}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <div className="text-blue-600">
            {getNodeIcon(node.nodeType)}
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">{node.name}</h3>
            <p className="text-sm text-gray-600">{node.description}</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(node.deployment?.status || 'unknown')}`}>
                {node.deployment?.status || 'unknown'}
              </span>
              <span className="text-xs text-gray-500">{node.hardware?.manufacturer} {node.hardware?.model}</span>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-1">
          <button
            onClick={onBuild}
            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
            title="Build Image"
          >
            <Play className="w-4 h-4" />
          </button>
          <button
            onClick={onFlash}
            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
            title="Flash Device"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            onClick={() => {/* TODO: Edit node */}}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-50 rounded-lg transition-colors"
            title="Edit Node"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
            title="Delete Node"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {expanded && (
        <div className="mt-4 pt-4 border-t">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Network</h4>
              <p className="text-gray-600">IP: {node.networkConfig?.primaryIp || 'N/A'}</p>
              <p className="text-gray-600">FQDN: {node.networkConfig?.fqdn || 'N/A'}</p>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Hardware</h4>
              <p className="text-gray-600">CPU: {node.hardware?.specs?.cpu || 'N/A'}</p>
              <p className="text-gray-600">Memory: {node.hardware?.specs?.memory || 'N/A'}</p>
            </div>
          </div>
          
          {node.services?.applications && node.services.applications.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Services</h4>
              <div className="flex flex-wrap gap-2">
                {node.services.applications.map((app, index) => (
                  <span
                    key={index}
                    className={`px-2 py-1 rounded text-xs ${
                      app.status === 'running' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {app.name}:{app.port}
                  </span>
                ))}
              </div>
            </div>
          )}
          
          {node.tags && node.tags.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-900 mb-2">Tags</h4>
              <div className="flex flex-wrap gap-2">
                {node.tags.map((tag) => (
                  <span key={tag} className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}; 