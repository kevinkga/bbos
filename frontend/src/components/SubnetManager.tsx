import React, { useState, useMemo, useCallback } from 'react';
import { Network, Plus, Edit, Trash2, Globe, Wifi, Shield, Settings, Users, Activity } from 'lucide-react';
import { SubnetManagerProps, NetworkNode, Subnet } from '../types/network';

interface SubnetFormData {
  name: string;
  cidr: string;
  gateway: string;
  vlan?: number;
  purpose: 'management' | 'production' | 'dmz' | 'guest' | 'iot' | 'storage' | 'backup';
  security: 'isolated' | 'controlled' | 'open';
  dhcp: {
    enabled: boolean;
    start: string;
    end: string;
  };
}

export const SubnetManager: React.FC<SubnetManagerProps> = ({
  nodes,
  onNodeUpdate
}) => {
  const [subnets, setSubnets] = useState<Subnet[]>([
    {
      id: '1',
      name: 'Management Network',
      cidr: '192.168.1.0/24',
      gateway: '192.168.1.1',
      vlan: 100,
      purpose: 'management',
      security: 'controlled',
      dhcp: {
        enabled: true,
        range: {
          start: '192.168.1.100',
          end: '192.168.1.200'
        }
      }
    },
    {
      id: '2',
      name: 'Production Network',
      cidr: '192.168.10.0/24',
      gateway: '192.168.10.1',
      vlan: 10,
      purpose: 'production',
      security: 'controlled',
      dhcp: {
        enabled: false
      }
    },
    {
      id: '3',
      name: 'Guest Network',
      cidr: '192.168.100.0/24',
      gateway: '192.168.100.1',
      vlan: 200,
      purpose: 'guest',
      security: 'isolated',
      dhcp: {
        enabled: true,
        range: {
          start: '192.168.100.50',
          end: '192.168.100.100'
        }
      }
    }
  ]);

  const [showAddSubnet, setShowAddSubnet] = useState(false);
  const [editingSubnet, setEditingSubnet] = useState<Subnet | null>(null);
  const [selectedSubnet, setSelectedSubnet] = useState<string | null>(null);

  // Calculate subnet utilization
  const subnetStats = useMemo(() => {
    return subnets.map(subnet => {
      const subnetNodes = nodes.filter(node => {
        const nodeIp = node.networkConfig?.primaryIp;
        if (!nodeIp) return false;
        
        // Simple subnet membership check - could be more sophisticated
        const [subnetBase] = subnet.cidr.split('/');
        const subnetPrefix = subnetBase.split('.').slice(0, 3).join('.');
        const nodePrefix = nodeIp.split('.').slice(0, 3).join('.');
        
        return subnetPrefix === nodePrefix;
      });

      const subnetMask = parseInt(subnet.cidr.split('/')[1]);
      const totalHosts = Math.pow(2, 32 - subnetMask) - 2; // Subtract network and broadcast
      const usedHosts = subnetNodes.length;
      const utilization = (usedHosts / totalHosts) * 100;

      return {
        ...subnet,
        nodes: subnetNodes,
        totalHosts,
        usedHosts,
        utilization: Math.round(utilization * 100) / 100
      };
    });
  }, [subnets, nodes]);

  const getPurposeIcon = (purpose: string) => {
    switch (purpose) {
      case 'management': return <Settings className="w-4 h-4" />;
      case 'production': return <Activity className="w-4 h-4" />;
      case 'dmz': return <Globe className="w-4 h-4" />;
      case 'guest': return <Users className="w-4 h-4" />;
      case 'iot': return <Wifi className="w-4 h-4" />;
      case 'storage': return <Network className="w-4 h-4" />;
      default: return <Network className="w-4 h-4" />;
    }
  };

  const getSecurityColor = (security: string) => {
    switch (security) {
      case 'isolated': return 'bg-red-100 text-red-800 border-red-200';
      case 'controlled': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'open': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getPurposeColor = (purpose: string) => {
    switch (purpose) {
      case 'management': return 'bg-blue-100 text-blue-800';
      case 'production': return 'bg-green-100 text-green-800';
      case 'dmz': return 'bg-orange-100 text-orange-800';
      case 'guest': return 'bg-purple-100 text-purple-800';
      case 'iot': return 'bg-indigo-100 text-indigo-800';
      case 'storage': return 'bg-cyan-100 text-cyan-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const handleAddSubnet = useCallback((formData: SubnetFormData) => {
    const newSubnet: Subnet = {
      id: Date.now().toString(),
      name: formData.name,
      cidr: formData.cidr,
      gateway: formData.gateway,
      vlan: formData.vlan,
      purpose: formData.purpose,
      security: formData.security,
      dhcp: {
        enabled: formData.dhcp.enabled,
        range: formData.dhcp.enabled ? {
          start: formData.dhcp.start,
          end: formData.dhcp.end
        } : undefined
      }
    };

    setSubnets(prev => [...prev, newSubnet]);
    setShowAddSubnet(false);
  }, []);

  const handleEditSubnet = useCallback((subnet: Subnet, formData: SubnetFormData) => {
    setSubnets(prev => prev.map(s => 
      s.id === subnet.id 
        ? {
            ...s,
            name: formData.name,
            cidr: formData.cidr,
            gateway: formData.gateway,
            vlan: formData.vlan,
            purpose: formData.purpose,
            security: formData.security,
            dhcp: {
              enabled: formData.dhcp.enabled,
              range: formData.dhcp.enabled ? {
                start: formData.dhcp.start,
                end: formData.dhcp.end
              } : undefined
            }
          }
        : s
    ));
    setEditingSubnet(null);
  }, []);

  const handleDeleteSubnet = useCallback((subnetId: string) => {
    setSubnets(prev => prev.filter(s => s.id !== subnetId));
  }, []);

  const SubnetForm: React.FC<{
    subnet?: Subnet;
    onSave: (formData: SubnetFormData) => void;
    onCancel: () => void;
  }> = ({ subnet, onSave, onCancel }) => {
    const [formData, setFormData] = useState<SubnetFormData>({
      name: subnet?.name || '',
      cidr: subnet?.cidr || '',
      gateway: subnet?.gateway || '',
      vlan: subnet?.vlan,
      purpose: subnet?.purpose || 'production',
      security: subnet?.security || 'controlled',
      dhcp: {
        enabled: subnet?.dhcp?.enabled || false,
        start: subnet?.dhcp?.range?.start || '',
        end: subnet?.dhcp?.range?.end || ''
      }
    });

    const handleSubmit = (e: React.FormEvent) => {
      e.preventDefault();
      onSave(formData);
    };

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h3 className="text-lg font-semibold mb-4">
            {subnet ? 'Edit Subnet' : 'Add New Subnet'}
          </h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Subnet Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  CIDR
                </label>
                <input
                  type="text"
                  value={formData.cidr}
                  onChange={(e) => setFormData(prev => ({ ...prev, cidr: e.target.value }))}
                  placeholder="192.168.1.0/24"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Gateway
                </label>
                <input
                  type="text"
                  value={formData.gateway}
                  onChange={(e) => setFormData(prev => ({ ...prev, gateway: e.target.value }))}
                  placeholder="192.168.1.1"
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  VLAN (optional)
                </label>
                <input
                  type="number"
                  value={formData.vlan || ''}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    vlan: e.target.value ? parseInt(e.target.value) : undefined 
                  }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Purpose
                </label>
                <select
                  value={formData.purpose}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    purpose: e.target.value as SubnetFormData['purpose']
                  }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="management">Management</option>
                  <option value="production">Production</option>
                  <option value="dmz">DMZ</option>
                  <option value="guest">Guest</option>
                  <option value="iot">IoT</option>
                  <option value="storage">Storage</option>
                  <option value="backup">Backup</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Security
                </label>
                <select
                  value={formData.security}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    security: e.target.value as SubnetFormData['security']
                  }))}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="isolated">Isolated</option>
                  <option value="controlled">Controlled</option>
                  <option value="open">Open</option>
                </select>
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={formData.dhcp.enabled}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    dhcp: { ...prev.dhcp, enabled: e.target.checked }
                  }))}
                  className="rounded"
                />
                <span className="text-sm font-medium text-gray-700">Enable DHCP</span>
              </label>
            </div>

            {formData.dhcp.enabled && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DHCP Start
                  </label>
                  <input
                    type="text"
                    value={formData.dhcp.start}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      dhcp: { ...prev.dhcp, start: e.target.value }
                    }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={formData.dhcp.enabled}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    DHCP End
                  </label>
                  <input
                    type="text"
                    value={formData.dhcp.end}
                    onChange={(e) => setFormData(prev => ({ 
                      ...prev, 
                      dhcp: { ...prev.dhcp, end: e.target.value }
                    }))}
                    className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required={formData.dhcp.enabled}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-2 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                {subnet ? 'Update' : 'Create'} Subnet
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Subnet Management</h2>
          <p className="text-gray-600">Manage network subnets, VLANs, and DHCP configuration</p>
        </div>
        <button
          onClick={() => setShowAddSubnet(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Subnet
        </button>
      </div>

      {/* Network Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Network className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Total Subnets</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{subnets.length}</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Total Nodes</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{nodes.length}</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">DHCP Enabled</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {subnets.filter(s => s.dhcp?.enabled).length}
          </div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-gray-700">Isolated Subnets</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {subnets.filter(s => s.security === 'isolated').length}
          </div>
        </div>
      </div>

      {/* Subnet List */}
      <div className="space-y-4">
        {subnetStats.map(subnet => (
          <div
            key={subnet.id}
            className={`bg-white rounded-lg border p-6 transition-all hover:shadow-md ${
              selectedSubnet === subnet.id ? 'ring-2 ring-blue-500' : ''
            }`}
            onClick={() => setSelectedSubnet(selectedSubnet === subnet.id ? null : subnet.id)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <div className="text-blue-600">
                  {getPurposeIcon(subnet.purpose || 'production')}
                </div>
                
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{subnet.name}</h3>
                  <div className="flex items-center gap-4 mt-1">
                    <span className="text-sm text-gray-600">{subnet.cidr}</span>
                    <span className="text-sm text-gray-600">Gateway: {subnet.gateway}</span>
                    {subnet.vlan && (
                      <span className="text-sm text-gray-600">VLAN: {subnet.vlan}</span>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPurposeColor(subnet.purpose || 'production')}`}>
                      {subnet.purpose}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getSecurityColor(subnet.security || 'controlled')}`}>
                      {subnet.security}
                    </span>
                    {subnet.dhcp?.enabled && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        DHCP
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <div className="text-right">
                  <div className="text-sm font-medium text-gray-900">
                    {subnet.usedHosts} / {subnet.totalHosts} hosts
                  </div>
                  <div className="text-xs text-gray-600">
                    {subnet.utilization}% utilization
                  </div>
                </div>
                
                <div className="flex items-center gap-1 ml-4">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingSubnet(subnet);
                    }}
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSubnet(subnet.id);
                    }}
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Utilization bar */}
            <div className="mt-4">
              <div className="flex justify-between text-xs text-gray-600 mb-1">
                <span>Host Utilization</span>
                <span>{subnet.utilization}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full ${
                    subnet.utilization > 80 ? 'bg-red-500' :
                    subnet.utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
                  }`}
                  style={{ width: `${Math.min(subnet.utilization, 100)}%` }}
                ></div>
              </div>
            </div>

            {/* Expanded details */}
            {selectedSubnet === subnet.id && (
              <div className="mt-6 pt-4 border-t">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Network Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-600">Network Address:</span>
                        <span className="font-mono">{subnet.cidr.split('/')[0]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Subnet Mask:</span>
                        <span className="font-mono">/{subnet.cidr.split('/')[1]}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-600">Gateway:</span>
                        <span className="font-mono">{subnet.gateway}</span>
                      </div>
                      {subnet.dhcp?.enabled && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-gray-600">DHCP Range:</span>
                            <span className="font-mono">
                              {subnet.dhcp.range?.start} - {subnet.dhcp.range?.end}
                            </span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Connected Nodes ({subnet.nodes.length})</h4>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {subnet.nodes.map(node => (
                        <div key={node.id} className="flex items-center justify-between text-sm">
                          <span className="text-gray-900">{node.name}</span>
                          <span className="font-mono text-gray-600">{node.networkConfig?.primaryIp}</span>
                        </div>
                      ))}
                      {subnet.nodes.length === 0 && (
                        <p className="text-sm text-gray-500 italic">No nodes connected to this subnet</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Modals */}
      {showAddSubnet && (
        <SubnetForm
          onSave={handleAddSubnet}
          onCancel={() => setShowAddSubnet(false)}
        />
      )}

      {editingSubnet && (
        <SubnetForm
          subnet={editingSubnet}
          onSave={(formData) => handleEditSubnet(editingSubnet, formData)}
          onCancel={() => setEditingSubnet(null)}
        />
      )}
    </div>
  );
}; 