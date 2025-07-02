import React, { useState } from 'react';
import { X, Network, Wifi, Globe, Shield, Router, Settings } from 'lucide-react';
import { NetworkConfigurationModalProps } from '../types/network';

interface NetworkConfig {
  general: {
    networkName: string;
    description: string;
    domain: string;
    timezone: string;
  };
  infrastructure: {
    internetProvider: string;
    connectionType: 'fiber' | 'cable' | 'dsl' | 'satellite' | 'cellular';
    staticIp: boolean;
    ipv6Enabled: boolean;
    bandwidth: {
      download: string;
      upload: string;
    };
  };
  routing: {
    primaryRouter: {
      ip: string;
      make: string;
      model: string;
      managementInterface: string;
    };
    defaultGateway: string;
    staticRoutes: Array<{
      destination: string;
      gateway: string;
      interface: string;
      metric: number;
    }>;
  };
  dns: {
    primaryDns: string;
    secondaryDns: string;
    searchDomains: string[];
    localResolver: boolean;
  };
  security: {
    firewall: {
      enabled: boolean;
      defaultPolicy: 'allow' | 'deny';
      rules: Array<{
        name: string;
        action: 'allow' | 'deny';
        protocol: 'tcp' | 'udp' | 'icmp' | 'any';
        source: string;
        destination: string;
        port: string;
      }>;
    };
    vpn: {
      enabled: boolean;
      type: 'wireguard' | 'openvpn' | 'ipsec';
      serverEndpoint: string;
      allowedIps: string;
    };
    monitoring: {
      enabled: boolean;
      logLevel: 'debug' | 'info' | 'warn' | 'error';
      retentionDays: number;
    };
  };
  wifi: {
    enabled: boolean;
    networks: Array<{
      ssid: string;
      security: 'open' | 'wpa2' | 'wpa3' | 'enterprise';
      password?: string;
      vlan?: number;
      hidden: boolean;
    }>;
  };
}

export const NetworkConfigurationModal: React.FC<NetworkConfigurationModalProps> = ({
  onClose,
  onSave
}) => {
  const [activeTab, setActiveTab] = useState<'general' | 'infrastructure' | 'routing' | 'dns' | 'security' | 'wifi'>('general');
  
  const [config, setConfig] = useState<NetworkConfig>({
    general: {
      networkName: 'Home Lab Network',
      description: 'Development and testing network infrastructure',
      domain: 'lab.local',
      timezone: 'UTC'
    },
    infrastructure: {
      internetProvider: '',
      connectionType: 'fiber',
      staticIp: false,
      ipv6Enabled: true,
      bandwidth: {
        download: '1000',
        upload: '100'
      }
    },
    routing: {
      primaryRouter: {
        ip: '192.168.1.1',
        make: '',
        model: '',
        managementInterface: 'http://192.168.1.1'
      },
      defaultGateway: '192.168.1.1',
      staticRoutes: []
    },
    dns: {
      primaryDns: '8.8.8.8',
      secondaryDns: '8.8.4.4',
      searchDomains: ['lab.local'],
      localResolver: true
    },
    security: {
      firewall: {
        enabled: true,
        defaultPolicy: 'deny',
        rules: [
          {
            name: 'Allow SSH',
            action: 'allow',
            protocol: 'tcp',
            source: '192.168.1.0/24',
            destination: 'any',
            port: '22'
          }
        ]
      },
      vpn: {
        enabled: false,
        type: 'wireguard',
        serverEndpoint: '',
        allowedIps: '192.168.100.0/24'
      },
      monitoring: {
        enabled: true,
        logLevel: 'info',
        retentionDays: 30
      }
    },
    wifi: {
      enabled: true,
      networks: [
        {
          ssid: 'Lab-Main',
          security: 'wpa3',
          password: '',
          vlan: 100,
          hidden: false
        }
      ]
    }
  });

  const handleSave = () => {
    onSave(config);
  };

  const addStaticRoute = () => {
    setConfig(prev => ({
      ...prev,
      routing: {
        ...prev.routing,
        staticRoutes: [
          ...prev.routing.staticRoutes,
          {
            destination: '',
            gateway: '',
            interface: 'eth0',
            metric: 100
          }
        ]
      }
    }));
  };

  const addFirewallRule = () => {
    setConfig(prev => ({
      ...prev,
      security: {
        ...prev.security,
        firewall: {
          ...prev.security.firewall,
          rules: [
            ...prev.security.firewall.rules,
            {
              name: '',
              action: 'allow',
              protocol: 'tcp',
              source: '',
              destination: '',
              port: ''
            }
          ]
        }
      }
    }));
  };

  const addWifiNetwork = () => {
    setConfig(prev => ({
      ...prev,
      wifi: {
        ...prev.wifi,
        networks: [
          ...prev.wifi.networks,
          {
            ssid: '',
            security: 'wpa3',
            password: '',
            hidden: false
          }
        ]
      }
    }));
  };

  const tabs = [
    { id: 'general', label: 'General', icon: <Settings className="w-4 h-4" /> },
    { id: 'infrastructure', label: 'Infrastructure', icon: <Network className="w-4 h-4" /> },
    { id: 'routing', label: 'Routing', icon: <Router className="w-4 h-4" /> },
    { id: 'dns', label: 'DNS', icon: <Globe className="w-4 h-4" /> },
    { id: 'security', label: 'Security', icon: <Shield className="w-4 h-4" /> },
    { id: 'wifi', label: 'Wi-Fi', icon: <Wifi className="w-4 h-4" /> }
  ];

  const renderGeneralTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Network Name
          </label>
          <input
            type="text"
            value={config.general.networkName}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              general: { ...prev.general, networkName: e.target.value }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Domain
          </label>
          <input
            type="text"
            value={config.general.domain}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              general: { ...prev.general, domain: e.target.value }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Description
        </label>
        <textarea
          value={config.general.description}
          onChange={(e) => setConfig(prev => ({
            ...prev,
            general: { ...prev.general, description: e.target.value }
          }))}
          rows={3}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Timezone
        </label>
        <select
          value={config.general.timezone}
          onChange={(e) => setConfig(prev => ({
            ...prev,
            general: { ...prev.general, timezone: e.target.value }
          }))}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="UTC">UTC</option>
          <option value="America/New_York">Eastern Time</option>
          <option value="America/Chicago">Central Time</option>
          <option value="America/Denver">Mountain Time</option>
          <option value="America/Los_Angeles">Pacific Time</option>
          <option value="Europe/London">GMT</option>
          <option value="Europe/Paris">CET</option>
        </select>
      </div>
    </div>
  );

  const renderInfrastructureTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Internet Provider
          </label>
          <input
            type="text"
            value={config.infrastructure.internetProvider}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              infrastructure: { ...prev.infrastructure, internetProvider: e.target.value }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Connection Type
          </label>
          <select
            value={config.infrastructure.connectionType}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              infrastructure: { ...prev.infrastructure, connectionType: e.target.value as NetworkConfig['infrastructure']['connectionType'] }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="fiber">Fiber</option>
            <option value="cable">Cable</option>
            <option value="dsl">DSL</option>
            <option value="satellite">Satellite</option>
            <option value="cellular">Cellular</option>
          </select>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Download Speed (Mbps)
          </label>
          <input
            type="number"
            value={config.infrastructure.bandwidth.download}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              infrastructure: { 
                ...prev.infrastructure, 
                bandwidth: { ...prev.infrastructure.bandwidth, download: e.target.value }
              }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Upload Speed (Mbps)
          </label>
          <input
            type="number"
            value={config.infrastructure.bandwidth.upload}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              infrastructure: { 
                ...prev.infrastructure, 
                bandwidth: { ...prev.infrastructure.bandwidth, upload: e.target.value }
              }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="flex gap-4">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.infrastructure.staticIp}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              infrastructure: { ...prev.infrastructure, staticIp: e.target.checked }
            }))}
            className="rounded"
          />
          <span className="text-sm text-gray-700">Static IP Address</span>
        </label>
        
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={config.infrastructure.ipv6Enabled}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              infrastructure: { ...prev.infrastructure, ipv6Enabled: e.target.checked }
            }))}
            className="rounded"
          />
          <span className="text-sm text-gray-700">IPv6 Enabled</span>
        </label>
      </div>
    </div>
  );

  const renderRoutingTab = () => (
    <div className="space-y-6">
      <div>
        <h4 className="font-medium text-gray-900 mb-3">Primary Router</h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Router IP
            </label>
            <input
              type="text"
              value={config.routing.primaryRouter.ip}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                routing: { 
                  ...prev.routing, 
                  primaryRouter: { ...prev.routing.primaryRouter, ip: e.target.value }
                }
              }))}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Management Interface
            </label>
            <input
              type="text"
              value={config.routing.primaryRouter.managementInterface}
              onChange={(e) => setConfig(prev => ({
                ...prev,
                routing: { 
                  ...prev.routing, 
                  primaryRouter: { ...prev.routing.primaryRouter, managementInterface: e.target.value }
                }
              }))}
              className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
      
      <div>
        <div className="flex items-center justify-between mb-3">
          <h4 className="font-medium text-gray-900">Static Routes</h4>
          <button
            onClick={addStaticRoute}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Add Route
          </button>
        </div>
        
        <div className="space-y-3">
          {config.routing.staticRoutes.map((route, index) => (
            <div key={index} className="grid grid-cols-4 gap-2 p-3 border rounded-lg">
              <input
                type="text"
                placeholder="Destination"
                value={route.destination}
                onChange={(e) => {
                  const newRoutes = [...config.routing.staticRoutes];
                  newRoutes[index].destination = e.target.value;
                  setConfig(prev => ({
                    ...prev,
                    routing: { ...prev.routing, staticRoutes: newRoutes }
                  }));
                }}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="Gateway"
                value={route.gateway}
                onChange={(e) => {
                  const newRoutes = [...config.routing.staticRoutes];
                  newRoutes[index].gateway = e.target.value;
                  setConfig(prev => ({
                    ...prev,
                    routing: { ...prev.routing, staticRoutes: newRoutes }
                  }));
                }}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="text"
                placeholder="Interface"
                value={route.interface}
                onChange={(e) => {
                  const newRoutes = [...config.routing.staticRoutes];
                  newRoutes[index].interface = e.target.value;
                  setConfig(prev => ({
                    ...prev,
                    routing: { ...prev.routing, staticRoutes: newRoutes }
                  }));
                }}
                className="border rounded px-2 py-1 text-sm"
              />
              <input
                type="number"
                placeholder="Metric"
                value={route.metric}
                onChange={(e) => {
                  const newRoutes = [...config.routing.staticRoutes];
                  newRoutes[index].metric = parseInt(e.target.value);
                  setConfig(prev => ({
                    ...prev,
                    routing: { ...prev.routing, staticRoutes: newRoutes }
                  }));
                }}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderDNSTab = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Primary DNS
          </label>
          <input
            type="text"
            value={config.dns.primaryDns}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              dns: { ...prev.dns, primaryDns: e.target.value }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Secondary DNS
          </label>
          <input
            type="text"
            value={config.dns.secondaryDns}
            onChange={(e) => setConfig(prev => ({
              ...prev,
              dns: { ...prev.dns, secondaryDns: e.target.value }
            }))}
            className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Search Domains (comma-separated)
        </label>
        <input
          type="text"
          value={config.dns.searchDomains.join(', ')}
          onChange={(e) => setConfig(prev => ({
            ...prev,
            dns: { 
              ...prev.dns, 
              searchDomains: e.target.value.split(',').map(d => d.trim()).filter(d => d) 
            }
          }))}
          className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={config.dns.localResolver}
          onChange={(e) => setConfig(prev => ({
            ...prev,
            dns: { ...prev.dns, localResolver: e.target.checked }
          }))}
          className="rounded"
        />
        <span className="text-sm text-gray-700">Enable Local DNS Resolver</span>
      </label>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-4xl h-[80vh] mx-4 flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold">Network Configuration</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>
        
        {/* Tab Navigation */}
        <div className="flex border-b">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
        
        {/* Tab Content */}
        <div className="flex-1 overflow-auto p-6">
          {activeTab === 'general' && renderGeneralTab()}
          {activeTab === 'infrastructure' && renderInfrastructureTab()}
          {activeTab === 'routing' && renderRoutingTab()}
          {activeTab === 'dns' && renderDNSTab()}
          {activeTab === 'security' && (
            <div className="text-center text-gray-500 py-8">
              Security configuration panel coming soon...
            </div>
          )}
          {activeTab === 'wifi' && (
            <div className="text-center text-gray-500 py-8">
              Wi-Fi configuration panel coming soon...
            </div>
          )}
        </div>
        
        {/* Footer */}
        <div className="flex justify-end gap-2 p-6 border-t">
          <button onClick={onClose} className="px-4 py-2 text-gray-600 border rounded-lg hover:bg-gray-50">
            Cancel
          </button>
          <button onClick={handleSave} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
            Save Configuration
          </button>
        </div>
      </div>
    </div>
  );
}; 