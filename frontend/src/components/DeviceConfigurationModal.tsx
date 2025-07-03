import React, { useState, ChangeEvent } from 'react';
import { X, Server, Wifi, Router, HardDrive, Monitor, Smartphone, Shield, CheckCircle, AlertTriangle, Package, Download, Star } from 'lucide-react';
import { NetworkNode } from '../types/network';
// import { templateMarketplaceService, MarketplaceTemplate } from '../services/template-marketplace-service';

interface DeviceConfigurationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (nodeConfig: Partial<NetworkNode>) => void;
  existingNode?: NetworkNode;
}

interface ArmbianBuildConfig {
  // Platform configuration
  board: string;
  branch: 'legacy' | 'current' | 'edge';
  release: 'jammy' | 'bookworm' | 'trixie';
  buildType: 'minimal' | 'cli' | 'desktop';
  desktopEnvironment?: 'xfce' | 'gnome' | 'kde' | 'cinnamon';
  
  // System configuration
  hostname: string;
  username: string;
  timezone: string;
  locale: string;
  
  // Network configuration
  enableWifi: boolean;
  wifiSSID?: string;
  wifiPassword?: string;
  staticIP?: string;
  
  // Services
  enableSSH: boolean;
  sshPort: number;
  enableDocker: boolean;
  
  // Hardware
  enableGPIO: boolean;
  enableI2C: boolean;
  enableSPI: boolean;
  
  // Additional packages
  packages: string[];
}

const DEFAULT_CONFIG: ArmbianBuildConfig = {
  board: 'rock-5b',
  branch: 'current',
  release: 'bookworm',
  buildType: 'minimal',
  hostname: 'homenet-device',
  username: 'homenet',
  timezone: 'UTC',
  locale: 'en_US.UTF-8',
  enableWifi: false,
  enableSSH: true,
  sshPort: 22,
  enableDocker: false,
  enableGPIO: false,
  enableI2C: false,
  enableSPI: false,
  packages: []
};

const SUPPORTED_BOARDS = [
  { id: 'rock-5b', name: 'Rock 5B', manufacturer: 'Radxa', cpu: 'RK3588', memory: '4GB-16GB' },
  { id: 'rock-5a', name: 'Rock 5A', manufacturer: 'Radxa', cpu: 'RK3588S', memory: '4GB-16GB' },
  { id: 'rock-4se', name: 'Rock 4SE', manufacturer: 'Radxa', cpu: 'RK3399-T', memory: '4GB' },
  { id: 'nanopi-r5s', name: 'NanoPi R5S', manufacturer: 'FriendlyElec', cpu: 'RK3568', memory: '2GB-4GB' },
  { id: 'nanopi-r4s', name: 'NanoPi R4S', manufacturer: 'FriendlyElec', cpu: 'RK3399', memory: '1GB-4GB' },
  { id: 'orangepi-5', name: 'Orange Pi 5', manufacturer: 'Orange Pi', cpu: 'RK3588S', memory: '4GB-16GB' }
];

const NODE_TYPES = [
  { id: 'sbc', name: 'Single Board Computer', icon: Server, description: 'General purpose SBC' },
  { id: 'server', name: 'Server', icon: Monitor, description: 'Dedicated server role' },
  { id: 'router', name: 'Router', icon: Router, description: 'Network routing device' },
  { id: 'nas', name: 'NAS', icon: HardDrive, description: 'Network attached storage' },
  { id: 'iot', name: 'IoT Device', icon: Smartphone, description: 'Internet of Things device' },
  { id: 'appliance', name: 'Appliance', icon: Shield, description: 'Specialized appliance' }
];

// Mock template data for demonstration
const SAMPLE_TEMPLATES = [
  {
    id: 'home-server-v1',
    name: 'Home Server Pro',
    version: '2.1.0',
    author: 'HomeNetDev',
    description: 'Complete home server with Docker, Samba, and media services',
    rating: 4.8,
    downloads: 2547,
    config: {
      board: 'rock-5b',
      branch: 'current',
      release: 'bookworm',
      buildType: 'cli',
      hostname: 'home-server',
      username: 'admin',
      enableDocker: true,
      enableSSH: true,
      packages: ['docker-compose', 'samba', 'jellyfin', 'nginx', 'fail2ban']
    }
  },
  {
    id: 'iot-gateway-v1',
    name: 'IoT Gateway Essential',
    version: '1.3.2',
    author: 'SmartHomeLab',
    description: 'MQTT broker, Node-RED, and Home Assistant ready',
    rating: 4.6,
    downloads: 1823,
    config: {
      board: 'nanopi-r5s',
      branch: 'current',
      release: 'bookworm',
      buildType: 'cli',
      hostname: 'iot-gateway',
      username: 'iot',
      enableDocker: true,
      enableSSH: true,
      enableI2C: true,
      enableGPIO: true,
      packages: ['mosquitto', 'nodejs', 'python3-pip', 'homeassistant']
    }
  },
  {
    id: 'nas-storage-v1',
    name: 'Personal NAS',
    version: '3.0.1',
    author: 'DataVault',
    description: 'Network storage with RAID support and web interface',
    rating: 4.9,
    downloads: 3421,
    config: {
      board: 'rock-5b',
      branch: 'current',
      release: 'bookworm',
      buildType: 'cli',
      hostname: 'nas-storage',
      username: 'nas',
      enableSSH: true,
      packages: ['mdadm', 'samba', 'nfs-kernel-server', 'cockpit', 'smartmontools']
    }
  }
];

export const DeviceConfigurationModal: React.FC<DeviceConfigurationModalProps> = ({
  isOpen,
  onClose,
  onSave,
  existingNode
}) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);
  const [nodeConfig, setNodeConfig] = useState<Partial<NetworkNode>>({
    name: existingNode?.name || '',
    description: existingNode?.description || '',
    nodeType: existingNode?.nodeType || 'sbc',
    networkConfig: existingNode?.networkConfig || {},
    hardware: existingNode?.hardware || {},
    armbianConfig: existingNode?.armbianConfig || DEFAULT_CONFIG,
    templateId: existingNode?.templateId,
    templateName: existingNode?.templateName,
    templateVersion: existingNode?.templateVersion,
    templateAuthor: existingNode?.templateAuthor
  });

  const [armbianConfig, setArmbianConfig] = useState<ArmbianBuildConfig>(
    existingNode?.armbianConfig || DEFAULT_CONFIG
  );

  const [packageInput, setPackageInput] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  if (!isOpen) return null;

  const handleInputChange = (field: string, value: any) => {
    setNodeConfig(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArmbianConfigChange = (field: keyof ArmbianBuildConfig, value: any) => {
    const updatedConfig = {
      ...armbianConfig,
      [field]: value
    };
    setArmbianConfig(updatedConfig);
    setNodeConfig(prev => ({
      ...prev,
      armbianConfig: updatedConfig
    }));
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    
    // Apply template configuration
    const templateConfig = { ...DEFAULT_CONFIG, ...template.config };
    setArmbianConfig(templateConfig);
    setNodeConfig(prev => ({
      ...prev,
      name: prev.name || template.name,
      description: prev.description || template.description,
      armbianConfig: templateConfig,
      templateId: template.id,
      templateName: template.name,
      templateVersion: template.version,
      templateAuthor: template.author
    }));
    
    setShowTemplateSelector(false);
    alert(`Template "${template.name}" applied successfully!`);
  };

  const handleAddPackage = () => {
    if (packageInput.trim() && !armbianConfig.packages.includes(packageInput.trim())) {
      const newPackages = [...armbianConfig.packages, packageInput.trim()];
      handleArmbianConfigChange('packages', newPackages);
      setPackageInput('');
    }
  };

  const handleRemovePackage = (packageName: string) => {
    const newPackages = armbianConfig.packages.filter(p => p !== packageName);
    handleArmbianConfigChange('packages', newPackages);
  };

  const validateConfiguration = (): boolean => {
    const errors: string[] = [];
    
    if (!nodeConfig.name?.trim()) {
      errors.push('Device name is required');
    }
    
    if (!armbianConfig.hostname.trim()) {
      errors.push('Hostname is required');
    }
    
    if (!armbianConfig.username.trim()) {
      errors.push('Username is required');
    }
    
    if (armbianConfig.enableWifi && !armbianConfig.wifiSSID?.trim()) {
      errors.push('WiFi SSID is required when WiFi is enabled');
    }
    
    setValidationErrors(errors);
    return errors.length === 0;
  };

  const handleSave = () => {
    if (!validateConfiguration()) {
      return;
    }

    // Create comprehensive node configuration
    const finalNodeConfig: Partial<NetworkNode> = {
      ...nodeConfig,
      armbianConfig,
      hardware: {
        ...nodeConfig.hardware,
        ...SUPPORTED_BOARDS.find(b => b.id === armbianConfig.board)
      },
      deployment: {
        status: 'planned'
      },
      tags: [
        armbianConfig.board,
        armbianConfig.buildType,
        armbianConfig.branch,
        ...(armbianConfig.enableDocker ? ['docker'] : []),
        ...(armbianConfig.enableWifi ? ['wifi'] : []),
        ...(selectedTemplate ? [`template:${selectedTemplate.id}`] : [])
      ]
    };

    onSave(finalNodeConfig);
    onClose();
  };

  const selectedBoard = SUPPORTED_BOARDS.find(b => b.id === armbianConfig.board);
  const selectedNodeType = NODE_TYPES.find(t => t.id === nodeConfig.nodeType);

  const renderTemplateSelector = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Select Template</h3>
          <button
            onClick={() => setShowTemplateSelector(false)}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {SAMPLE_TEMPLATES.map(template => (
              <div
                key={template.id}
                onClick={() => handleTemplateSelect(template)}
                className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:bg-blue-50 cursor-pointer transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-gray-900">{template.name}</h4>
                  <div className="flex items-center text-xs text-yellow-600">
                    <Star className="w-3 h-3 mr-1" />
                    {template.rating}
                  </div>
                </div>
                
                <p className="text-sm text-gray-600 mb-3">{template.description}</p>
                
                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>v{template.version}</span>
                  <span>{template.downloads} downloads</span>
                </div>
                
                <div className="mt-2 text-xs text-gray-500">
                  by {template.author}
                </div>
                
                <div className="mt-3 flex flex-wrap gap-1">
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    {template.config.board}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                    {template.config.buildType}
                  </span>
                  {template.config.enableDocker && (
                    <span className="px-2 py-1 bg-blue-100 text-blue-600 rounded text-xs">
                      Docker
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep1 = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Basic Information</h4>
        
        {/* Template Selection */}
        <div className="mb-6 p-4 border border-blue-200 rounded-lg bg-blue-50">
          <div className="flex items-center justify-between mb-2">
            <h5 className="font-medium text-blue-900">Start with Template</h5>
            <button
              onClick={() => setShowTemplateSelector(true)}
              className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              <Package className="w-4 h-4" />
              Browse Templates
            </button>
          </div>
          
          {selectedTemplate ? (
            <div className="bg-white rounded p-3 border">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{selectedTemplate.name}</div>
                  <div className="text-sm text-gray-600">v{selectedTemplate.version} by {selectedTemplate.author}</div>
                </div>
                <button
                  onClick={() => {
                    setSelectedTemplate(null);
                    setArmbianConfig(DEFAULT_CONFIG);
                    setNodeConfig(prev => ({
                      ...prev,
                      templateId: undefined,
                      templateName: undefined,
                      templateVersion: undefined,
                      templateAuthor: undefined
                    }));
                  }}
                  className="text-red-500 hover:text-red-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-blue-700">
              Choose a pre-configured template to get started quickly, or configure manually below.
            </p>
          )}
        </div>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Device Name *
            </label>
            <input
              type="text"
              value={nodeConfig.name || ''}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Home Server, IoT Gateway"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              value={nodeConfig.description || ''}
              onChange={(e) => handleInputChange('description', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              placeholder="Brief description of the device role and purpose"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Node Type
            </label>
            <div className="grid grid-cols-2 gap-2">
              {NODE_TYPES.map(type => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.id}
                    onClick={() => handleInputChange('nodeType', type.id)}
                    className={`p-3 border rounded-md text-left transition-colors ${
                      nodeConfig.nodeType === type.id
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="w-4 h-4" />
                      <span className="font-medium text-sm">{type.name}</span>
                    </div>
                    <p className="text-xs text-gray-600">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep2 = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Hardware & Build Configuration</h4>
        
        <div className="grid grid-cols-1 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Board Type *
            </label>
            <select
              value={armbianConfig.board}
              onChange={(e) => handleArmbianConfigChange('board', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {SUPPORTED_BOARDS.map(board => (
                <option key={board.id} value={board.id}>
                  {board.name} ({board.manufacturer}) - {board.cpu}
                </option>
              ))}
            </select>
            {selectedBoard && (
              <p className="text-sm text-gray-600 mt-1">
                CPU: {selectedBoard.cpu} • Memory: {selectedBoard.memory}
              </p>
            )}
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Kernel Branch
              </label>
              <select
                value={armbianConfig.branch}
                onChange={(e) => handleArmbianConfigChange('branch', e.target.value as 'legacy' | 'current' | 'edge')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="legacy">Legacy (Stable)</option>
                <option value="current">Current (Recommended)</option>
                <option value="edge">Edge (Latest)</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                OS Release
              </label>
              <select
                value={armbianConfig.release}
                onChange={(e) => handleArmbianConfigChange('release', e.target.value as 'jammy' | 'bookworm' | 'trixie')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="bookworm">Debian Bookworm (12)</option>
                <option value="jammy">Ubuntu Jammy (22.04)</option>
                <option value="trixie">Debian Trixie (13)</option>
              </select>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Build Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'minimal', name: 'Minimal', desc: 'Basic CLI only' },
                { id: 'cli', name: 'CLI', desc: 'Command line tools' },
                { id: 'desktop', name: 'Desktop', desc: 'Full GUI environment' }
              ].map(type => (
                <button
                  key={type.id}
                  onClick={() => handleArmbianConfigChange('buildType', type.id)}
                  className={`p-3 border rounded-md text-center transition-colors ${
                    armbianConfig.buildType === type.id
                      ? 'border-blue-500 bg-blue-50 text-blue-700'
                      : 'border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium text-sm">{type.name}</div>
                  <div className="text-xs text-gray-600">{type.desc}</div>
                </button>
              ))}
            </div>
          </div>
          
          {armbianConfig.buildType === 'desktop' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Desktop Environment
              </label>
              <select
                value={armbianConfig.desktopEnvironment || 'xfce'}
                onChange={(e) => handleArmbianConfigChange('desktopEnvironment', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="xfce">XFCE (Lightweight)</option>
                <option value="gnome">GNOME (Modern)</option>
                <option value="kde">KDE Plasma (Feature-rich)</option>
                <option value="cinnamon">Cinnamon (Traditional)</option>
              </select>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const renderStep3 = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">System Configuration</h4>
        
        <div className="grid grid-cols-1 gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Hostname *
              </label>
              <input
                type="text"
                value={armbianConfig.hostname}
                onChange={(e) => handleArmbianConfigChange('hostname', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="homenet-device"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Username *
              </label>
              <input
                type="text"
                value={armbianConfig.username}
                onChange={(e) => handleArmbianConfigChange('username', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="homenet"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Timezone
              </label>
              <select
                value={armbianConfig.timezone}
                onChange={(e) => handleArmbianConfigChange('timezone', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="UTC">UTC</option>
                <option value="America/New_York">America/New_York</option>
                <option value="America/Chicago">America/Chicago</option>
                <option value="America/Denver">America/Denver</option>
                <option value="America/Los_Angeles">America/Los_Angeles</option>
                <option value="Europe/London">Europe/London</option>
                <option value="Europe/Paris">Europe/Paris</option>
                <option value="Asia/Tokyo">Asia/Tokyo</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Locale
              </label>
              <select
                value={armbianConfig.locale}
                onChange={(e) => handleArmbianConfigChange('locale', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="en_US.UTF-8">English US</option>
                <option value="en_GB.UTF-8">English UK</option>
                <option value="de_DE.UTF-8">German</option>
                <option value="fr_FR.UTF-8">French</option>
                <option value="es_ES.UTF-8">Spanish</option>
              </select>
            </div>
          </div>
        </div>
      </div>
      
      <div>
        <h5 className="text-md font-medium text-gray-900 mb-3">Network Configuration</h5>
        
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="enableWifi"
              checked={armbianConfig.enableWifi}
              onChange={(e) => handleArmbianConfigChange('enableWifi', e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="enableWifi" className="text-sm font-medium text-gray-700">
              Enable WiFi
            </label>
          </div>
          
          {armbianConfig.enableWifi && (
            <div className="grid grid-cols-2 gap-4 ml-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WiFi SSID *
                </label>
                <input
                  type="text"
                  value={armbianConfig.wifiSSID || ''}
                  onChange={(e) => handleArmbianConfigChange('wifiSSID', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="WiFi Network Name"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  WiFi Password
                </label>
                <input
                  type="password"
                  value={armbianConfig.wifiPassword || ''}
                  onChange={(e) => handleArmbianConfigChange('wifiPassword', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="WiFi Password"
                />
              </div>
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Static IP (optional)
            </label>
            <input
              type="text"
              value={armbianConfig.staticIP || ''}
              onChange={(e) => handleArmbianConfigChange('staticIP', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="192.168.1.100/24"
            />
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep4 = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Services & Hardware</h4>
        
        <div className="space-y-4">
          <div>
            <h5 className="text-md font-medium text-gray-900 mb-3">Services</h5>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium text-sm">SSH Access</div>
                  <div className="text-xs text-gray-600">Remote terminal access</div>
                </div>
                <div className="flex items-center gap-2">
                  {armbianConfig.enableSSH && (
                    <input
                      type="number"
                      value={armbianConfig.sshPort}
                      onChange={(e) => handleArmbianConfigChange('sshPort', parseInt(e.target.value))}
                      className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                      min="1"
                      max="65535"
                    />
                  )}
                  <input
                    type="checkbox"
                    checked={armbianConfig.enableSSH}
                    onChange={(e) => handleArmbianConfigChange('enableSSH', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-md">
                <div>
                  <div className="font-medium text-sm">Docker</div>
                  <div className="text-xs text-gray-600">Container runtime</div>
                </div>
                <input
                  type="checkbox"
                  checked={armbianConfig.enableDocker}
                  onChange={(e) => handleArmbianConfigChange('enableDocker', e.target.checked)}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
          
          <div>
            <h5 className="text-md font-medium text-gray-900 mb-3">Hardware Interfaces</h5>
            <div className="grid grid-cols-3 gap-2">
              {[
                { key: 'enableGPIO', name: 'GPIO', desc: 'General Purpose I/O' },
                { key: 'enableI2C', name: 'I2C', desc: 'Inter-Integrated Circuit' },
                { key: 'enableSPI', name: 'SPI', desc: 'Serial Peripheral Interface' }
              ].map(hw => (
                <div key={hw.key} className="p-3 border rounded-md text-center">
                  <div className="font-medium text-sm mb-1">{hw.name}</div>
                  <div className="text-xs text-gray-600 mb-2">{hw.desc}</div>
                  <input
                    type="checkbox"
                    checked={armbianConfig[hw.key as keyof ArmbianBuildConfig] as boolean}
                    onChange={(e) => handleArmbianConfigChange(hw.key as keyof ArmbianBuildConfig, e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                </div>
              ))}
            </div>
          </div>
          
          <div>
            <h5 className="text-md font-medium text-gray-900 mb-3">Additional Packages</h5>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={packageInput}
                  onChange={(e) => setPackageInput(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Package name (e.g., htop, git, curl)"
                  onKeyPress={(e) => e.key === 'Enter' && handleAddPackage()}
                />
                <button
                  onClick={handleAddPackage}
                  className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                >
                  Add
                </button>
              </div>
              
              {armbianConfig.packages.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {armbianConfig.packages.map(pkg => (
                    <span
                      key={pkg}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-700 rounded text-sm"
                    >
                      {pkg}
                      <button
                        onClick={() => handleRemovePackage(pkg)}
                        className="text-gray-500 hover:text-red-500"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderStep5 = () => (
    <div className="space-y-6">
      <div>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Configuration Summary</h4>
        
        <div className="bg-gray-50 rounded-lg p-4 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Device Information</h5>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-600">Name:</span> {nodeConfig.name}</div>
                <div><span className="text-gray-600">Type:</span> {selectedNodeType?.name}</div>
                <div><span className="text-gray-600">Board:</span> {selectedBoard?.name}</div>
                <div><span className="text-gray-600">Hostname:</span> {armbianConfig.hostname}</div>
              </div>
            </div>
            
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Build Configuration</h5>
              <div className="space-y-1 text-sm">
                <div><span className="text-gray-600">OS:</span> {armbianConfig.release} ({armbianConfig.branch})</div>
                <div><span className="text-gray-600">Type:</span> {armbianConfig.buildType}</div>
                <div><span className="text-gray-600">WiFi:</span> {armbianConfig.enableWifi ? '✓' : '✗'}</div>
                <div><span className="text-gray-600">SSH:</span> {armbianConfig.enableSSH ? `Port ${armbianConfig.sshPort}` : '✗'}</div>
              </div>
            </div>
          </div>
          
          {armbianConfig.packages.length > 0 && (
            <div>
              <h5 className="font-medium text-gray-900 mb-2">Additional Packages</h5>
              <div className="text-sm text-gray-600">
                {armbianConfig.packages.join(', ')}
              </div>
            </div>
          )}
          
          {validationErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-md p-3">
              <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
                <AlertTriangle className="w-4 h-4" />
                Configuration Errors
              </div>
              <ul className="text-sm text-red-600 space-y-1">
                {validationErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  const steps = [
    { id: 1, name: 'Basic Info', component: renderStep1 },
    { id: 2, name: 'Hardware', component: renderStep2 },
    { id: 3, name: 'System', component: renderStep3 },
    { id: 4, name: 'Services', component: renderStep4 },
    { id: 5, name: 'Summary', component: renderStep5 }
  ];

  return (
    <>
      {showTemplateSelector && renderTemplateSelector()}
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                {existingNode ? 'Edit Device Configuration' : 'Add New Device'}
                {selectedTemplate && (
                  <span className="ml-2 text-sm font-normal text-blue-600">
                    (using {selectedTemplate.name})
                  </span>
                )}
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Configure Armbian build settings for your device
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

        {/* Step Navigation */}
        <div className="px-6 py-4 border-b bg-gray-50">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.id}>
                <div className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    currentStep === step.id 
                      ? 'bg-blue-500 text-white' 
                      : currentStep > step.id
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {currentStep > step.id ? <CheckCircle className="w-4 h-4" /> : step.id}
                  </div>
                  <span className={`ml-2 text-sm font-medium ${
                    currentStep === step.id ? 'text-blue-600' : 'text-gray-500'
                  }`}>
                    {step.name}
                  </span>
                </div>
                {index < steps.length - 1 && (
                  <div className={`flex-1 h-px mx-4 ${
                    currentStep > step.id ? 'bg-green-500' : 'bg-gray-200'
                  }`} />
                )}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          {steps.find(s => s.id === currentStep)?.component()}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t bg-gray-50">
          <button
            onClick={() => setCurrentStep(Math.max(1, currentStep - 1))}
            disabled={currentStep === 1}
            className={`px-4 py-2 rounded-md ${
              currentStep === 1
                ? 'text-gray-400 cursor-not-allowed'
                : 'text-gray-700 hover:bg-gray-200'
            }`}
          >
            Previous
          </button>
          
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
            >
              Cancel
            </button>
            
            {currentStep < steps.length ? (
              <button
                onClick={() => setCurrentStep(currentStep + 1)}
                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
              >
                Save Device
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}; 