import React, { useState, useCallback, useMemo } from 'react';
import { Plus, Network, Server, Wifi, Shield, Monitor, Settings, Map, Filter, Search } from 'lucide-react';
import { NetworkNode } from '../types/network';
import { NetworkTopologyView } from '../components/NetworkTopologyView';
import { NodeCard } from '../components/NodeCard';
import { DeviceTemplateSelector } from '../components/DeviceTemplateSelector';
import { NetworkConfigurationModal } from '../components/NetworkConfigurationModal';
import { SubnetManager } from '../components/SubnetManager';
import { SecurityOverview } from '../components/SecurityOverview';
import { NetworkMonitoring } from '../components/NetworkMonitoring';

interface NetworkPanelProps {
  onAddDevice: (deviceTemplate: string, configuration: any) => void;
  onUpdateNode: (nodeId: string, updates: Partial<NetworkNode>) => void;
  onDeleteNode: (nodeId: string) => void;
  onBuildNode: (nodeId: string) => void;
  onFlashNode: (nodeId: string) => void;
}

type ViewMode = 'topology' | 'list' | 'zones' | 'subnets';
type FilterType = 'all' | 'sbc' | 'server' | 'network' | 'offline' | 'maintenance';

export const NetworkPanel: React.FC<NetworkPanelProps> = ({
  onAddDevice,
  onUpdateNode,
  onDeleteNode,
  onBuildNode,
  onFlashNode
}) => {
  // Mock data - replace with real data from your state management
  const [nodes, setNodes] = useState<NetworkNode[]>([
    {
      id: '1',
      networkId: 'home-lab-1',
      userId: 'user-1',
      name: 'rock5b-main',
      description: 'Main compute node - Rock 5B',
      nodeType: 'sbc',
      deviceCategory: 'armbian_supported',
      location: { room: 'Home Office', coordinates: { x: 100, y: 200, z: 0 } },
      hardware: {
        manufacturer: 'Radxa',
        model: 'Rock 5B',
        specs: {
          cpu: 'RK3588',
          memory: '16GB',
          storage: 'NVMe + eMMC',
          networkPorts: 1,
          gpioAvailable: true
        }
      },
      networkConfig: {
        primaryIp: '192.168.1.100',
        fqdn: 'rock5b-main.lab.local',
        interfaces: [
          {
            name: 'eth0',
            type: 'ethernet',
            ip: '192.168.1.100',
            status: 'up',
            speed: '1Gbps'
          }
        ]
      },
      services: {
        role: 'compute',
        applications: [
          { name: 'docker', port: 2376, status: 'running' },
          { name: 'ssh', port: 22, status: 'running' }
        ]
      },
      deployment: {
        status: 'deployed',
        lastSeen: new Date().toISOString(),
        uptime: 86400
      },
      tags: ['production', 'docker-host'],
      createdAt: new Date().toISOString(),
      version: 1
    },
    {
      id: '2',
      networkId: 'home-lab-1',
      userId: 'user-1',
      name: 'rpi5-nas',
      description: 'Raspberry Pi 5 NAS server',
      nodeType: 'nas',
      deviceCategory: 'armbian_supported',
      location: { room: 'Server Closet', coordinates: { x: 200, y: 100, z: 0 } },
      hardware: {
        manufacturer: 'Raspberry Pi Foundation',
        model: 'Raspberry Pi 5',
        specs: {
          cpu: 'BCM2712',
          memory: '8GB',
          storage: 'NVMe via HAT',
          networkPorts: 1,
          gpioAvailable: true
        }
      },
      networkConfig: {
        primaryIp: '192.168.1.150',
        fqdn: 'nas.lab.local',
        interfaces: [
          {
            name: 'eth0',
            type: 'ethernet',
            ip: '192.168.1.150',
            status: 'up',
            speed: '1Gbps'
          }
        ]
      },
      services: {
        role: 'storage',
        applications: [
          { name: 'samba', port: 445, status: 'running' },
          { name: 'nfs', port: 2049, status: 'running' }
        ]
      },
      deployment: {
        status: 'deployed',
        lastSeen: new Date().toISOString(),
        uptime: 172800
      },
      tags: ['storage', 'backup'],
      createdAt: new Date().toISOString(),
      version: 1
    }
  ]);

  const [viewMode, setViewMode] = useState<ViewMode>('topology');
  const [filter, setFilter] = useState<FilterType>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddDevice, setShowAddDevice] = useState(false);
  const [showNetworkConfig, setShowNetworkConfig] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);

  // Network overview stats
  const networkStats = useMemo(() => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.deployment.status === 'deployed').length;
    const sbcNodes = nodes.filter(n => n.nodeType === 'sbc').length;
    const serverNodes = nodes.filter(n => n.nodeType === 'server' || n.nodeType === 'nas').length;
    
    return { totalNodes, onlineNodes, sbcNodes, serverNodes };
  }, [nodes]);

  // Filter nodes based on current filter and search
  const filteredNodes = useMemo(() => {
    let filtered = nodes;

    // Apply type filter
    if (filter !== 'all') {
      switch (filter) {
        case 'sbc':
          filtered = filtered.filter(n => n.nodeType === 'sbc');
          break;
        case 'server':
          filtered = filtered.filter(n => ['server', 'nas', 'gateway'].includes(n.nodeType));
          break;
        case 'network':
          filtered = filtered.filter(n => ['router', 'switch', 'appliance'].includes(n.nodeType));
          break;
        case 'offline':
          filtered = filtered.filter(n => n.deployment.status !== 'deployed');
          break;
        case 'maintenance':
          filtered = filtered.filter(n => n.deployment.status === 'maintenance');
          break;
      }
    }

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(n =>
        n.name.toLowerCase().includes(term) ||
        n.description?.toLowerCase().includes(term) ||
        n.tags?.some((tag: string) => tag.toLowerCase().includes(term)) ||
        n.hardware?.manufacturer?.toLowerCase().includes(term) ||
        n.hardware?.model?.toLowerCase().includes(term)
      );
    }

    return filtered;
  }, [nodes, filter, searchTerm]);

  const handleAddFromTemplate = useCallback((templateId: string, configuration: any) => {
    onAddDevice(templateId, configuration);
    setShowAddDevice(false);
  }, [onAddDevice]);

  const handleNodeUpdate = useCallback((nodeId: string, updates: Partial<NetworkNode>) => {
    setNodes(prev => prev.map(node => 
      node.id === nodeId ? { ...node, ...updates } : node
    ));
    onUpdateNode(nodeId, updates);
  }, [onUpdateNode]);

  const renderToolbar = () => (
    <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-gray-50 border-b">
      <div className="flex items-center gap-4">
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <Network className="w-5 h-5 text-blue-600" />
          Network Infrastructure
        </h1>
        
        {/* Network stats */}
        <div className="flex items-center gap-4 text-sm text-gray-600">
          <span className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            {networkStats.onlineNodes}/{networkStats.totalNodes} Online
          </span>
          <span>{networkStats.sbcNodes} SBCs</span>
          <span>{networkStats.serverNodes} Servers</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search nodes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-2 border rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Filter */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as FilterType)}
          className="px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Devices</option>
          <option value="sbc">SBC Devices</option>
          <option value="server">Servers</option>
          <option value="network">Network Equipment</option>
          <option value="offline">Offline</option>
          <option value="maintenance">Maintenance</option>
        </select>

        {/* View mode selector */}
        <div className="flex border rounded-lg overflow-hidden">
          {(['topology', 'list', 'zones', 'subnets'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-2 text-sm capitalize ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 hover:bg-gray-50'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <button
          onClick={() => setShowNetworkConfig(true)}
          className="px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center gap-2"
        >
          <Settings className="w-4 h-4" />
          Network Config
        </button>

        <button
          onClick={() => setShowAddDevice(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Device
        </button>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (viewMode) {
      case 'topology':
        return (
          <NetworkTopologyView
            nodes={filteredNodes}
            onNodeSelect={setSelectedNode}
            onNodeUpdate={handleNodeUpdate}
            onNodeBuild={onBuildNode}
            onNodeFlash={onFlashNode}
          />
        );

      case 'list':
        return (
          <div className="p-4">
            <div className="grid gap-4">
              {filteredNodes.map(node => (
                <NodeCard
                  key={node.id}
                  node={node}
                  onUpdate={(updates: Partial<NetworkNode>) => handleNodeUpdate(node.id, updates)}
                  onBuild={() => onBuildNode(node.id)}
                  onFlash={() => onFlashNode(node.id)}
                  onDelete={() => onDeleteNode(node.id)}
                />
              ))}
            </div>
          </div>
        );

      case 'zones':
        return (
          <div className="p-4">
            <div className="bg-white rounded-lg border p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Shield className="w-5 h-5 text-green-600" />
                Security Zones
              </h2>
              <SecurityOverview nodes={filteredNodes} />
            </div>
          </div>
        );

      case 'subnets':
        return (
          <div className="p-4">
            <SubnetManager nodes={filteredNodes} onNodeUpdate={handleNodeUpdate} />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50">
      {renderToolbar()}
      
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>

      {/* Modals */}
      {showAddDevice && (
        <DeviceTemplateSelector
          onSelect={handleAddFromTemplate}
          onClose={() => setShowAddDevice(false)}
        />
      )}

      {showNetworkConfig && (
        <NetworkConfigurationModal
          onClose={() => setShowNetworkConfig(false)}
          onSave={(config: any) => {
            // Handle network configuration save
            console.log('Network config:', config);
            setShowNetworkConfig(false);
          }}
        />
      )}

      {/* Side panel for selected node details */}
      {selectedNode && (
        <div className="fixed right-0 top-0 h-full w-96 bg-white border-l shadow-lg z-50">
          <div className="p-4 border-b">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{selectedNode.name}</h3>
              <button
                onClick={() => setSelectedNode(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ×
              </button>
            </div>
          </div>
          <div className="p-4 overflow-auto">
            <NodeCard
              node={selectedNode}
              onUpdate={(updates: Partial<NetworkNode>) => handleNodeUpdate(selectedNode.id, updates)}
              onBuild={() => onBuildNode(selectedNode.id)}
              onFlash={() => onFlashNode(selectedNode.id)}
              onDelete={() => onDeleteNode(selectedNode.id)}
              expanded={true}
            />
          </div>
        </div>
      )}
    </div>
  );
}; 