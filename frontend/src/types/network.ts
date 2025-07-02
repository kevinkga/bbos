// Network Node Types based on the schema
export interface NetworkNode {
  id: string;
  networkId: string;
  userId: string;
  name: string;
  description?: string;
  nodeType: 'sbc' | 'workstation' | 'server' | 'appliance' | 'iot' | 'router' | 'switch' | 'nas' | 'gateway';
  deviceCategory: 'armbian_supported' | 'generic_linux' | 'proprietary' | 'embedded' | 'virtual';
  
  location?: {
    room?: string;
    rack?: string;
    position?: string;
    coordinates?: {
      x: number;
      y: number;
      z: number;
    };
    building?: string;
    floor?: string;
  };
  
  hardware?: {
    manufacturer?: string;
    model?: string;
    serial?: string;
    macAddress?: string[];
    specs?: {
      cpu?: string;
      memory?: string;
      storage?: string;
      networkPorts?: number;
      usbPorts?: number;
      gpioAvailable?: boolean;
      powerConsumption?: string;
    };
    expansionCards?: Array<{
      slot?: string;
      type?: string;
      description?: string;
    }>;
  };
  
  networkConfig?: {
    primaryIp?: string;
    fqdn?: string;
    interfaces?: NetworkInterface[];
    routing?: {
      defaultGateway?: string;
      staticRoutes?: Array<{
        destination: string;
        gateway: string;
        interface?: string;
        metric?: number;
      }>;
    };
    dns?: {
      servers?: string[];
      searchDomains?: string[];
    };
  };
  
  services?: {
    role?: 'compute' | 'storage' | 'network' | 'monitoring' | 'development' | 'production' | 'staging' | 'testing';
    applications?: Application[];
    containers?: Container[];
  };
  
  monitoring?: {
    enabled?: boolean;
    agents?: string[];
    metrics?: {
      system?: boolean;
      network?: boolean;
      storage?: boolean;
      applications?: boolean;
    };
    alerting?: {
      enabled?: boolean;
      thresholds?: {
        cpuUsage?: number;
        memoryUsage?: number;
        diskUsage?: number;
        networkLatency?: number;
      };
      contacts?: Array<{
        type: 'email' | 'sms' | 'webhook' | 'slack';
        address: string;
      }>;
    };
  };
  
  deployment?: {
    status?: 'planned' | 'building' | 'deploying' | 'deployed' | 'error' | 'maintenance' | 'decommissioned';
    lastSeen?: string;
    uptime?: number;
    buildHistory?: Array<{
      buildId?: string;
      version?: string;
      timestamp?: string;
      status?: 'success' | 'failed' | 'pending';
      deploymentMethod?: 'webusb' | 'ssh' | 'physical' | 'pxe' | 'sd_card';
    }>;
    maintenanceWindows?: Array<{
      start: string;
      end: string;
      description?: string;
      recurring?: boolean;
    }>;
  };
  
  security?: {
    accessLevel?: 'public' | 'internal' | 'restricted' | 'confidential';
    compliance?: string[];
    certificates?: Array<{
      type: 'ssl' | 'ssh' | 'vpn' | 'client';
      issuer?: string;
      subject: string;
      expiryDate?: string;
      fingerprint?: string;
    }>;
    vulnerabilities?: {
      lastScan?: string;
      critical?: number;
      high?: number;
      medium?: number;
      low?: number;
    };
  };
  
  dependencies?: {
    upstream?: string[];
    downstream?: string[];
    criticalPath?: boolean;
  };
  
  armbianConfig?: any; // Reference to full Armbian configuration
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface NetworkInterface {
  name: string;
  type: 'ethernet' | 'wifi' | 'bluetooth' | 'usb' | 'bridge' | 'bond' | 'vlan';
  ip?: string;
  ipv6?: string;
  subnet?: string;
  vlan?: number;
  macAddress?: string;
  status?: 'up' | 'down' | 'unknown';
  speed?: string;
  duplex?: 'full' | 'half' | 'unknown';
  mtu?: number;
}

export interface Application {
  name: string;
  version?: string;
  port: number;
  protocol?: 'tcp' | 'udp' | 'both';
  status?: 'running' | 'stopped' | 'error' | 'unknown';
  autoStart?: boolean;
  healthCheck?: {
    enabled?: boolean;
    url?: string;
    interval?: number;
    timeout?: number;
  };
}

export interface Container {
  name: string;
  image: string;
  ports?: string[];
  volumes?: string[];
  environment?: Record<string, string>;
  restart?: 'no' | 'always' | 'on-failure' | 'unless-stopped';
}

export interface NetworkInfrastructure {
  id: string;
  name: string;
  description?: string;
  type: 'home' | 'enterprise' | 'datacenter' | 'development' | 'production' | 'hybrid';
  owner: {
    userId: string;
    organization?: string;
    contact?: {
      email?: string;
      phone?: string;
    };
  };
  topology?: {
    layout?: 'star' | 'mesh' | 'tree' | 'hybrid' | 'ring';
    subnets?: Subnet[];
    zones?: SecurityZone[];
  };
  infrastructure?: {
    internetConnection?: {
      provider?: string;
      type?: 'fiber' | 'cable' | 'dsl' | 'satellite' | 'cellular' | 'other';
      bandwidth?: {
        download?: string;
        upload?: string;
      };
      staticIp?: boolean;
      ipv6?: boolean;
    };
    primaryRouter?: {
      nodeId?: string;
      make?: string;
      model?: string;
      firmwareVersion?: string;
      managementInterface?: string;
    };
    switches?: Array<{
      nodeId: string;
      ports: number;
      managed?: boolean;
      poe?: boolean;
      stackable?: boolean;
    }>;
    accessPoints?: Array<{
      nodeId: string;
      ssids?: Array<{
        name: string;
        security: 'open' | 'wpa2' | 'wpa3' | 'enterprise';
        vlan?: number;
        hidden?: boolean;
      }>;
      standards?: string[];
    }>;
  };
  nodes: NetworkNode[];
  tags?: string[];
  metadata?: Record<string, any>;
  createdAt: string;
  updatedAt?: string;
  version: number;
}

export interface Subnet {
  id: string;
  name: string;
  cidr: string;
  gateway: string;
  vlan?: number;
  purpose?: 'management' | 'production' | 'dmz' | 'guest' | 'iot' | 'storage' | 'backup';
  security?: 'isolated' | 'controlled' | 'open';
  dhcp?: {
    enabled?: boolean;
    range?: {
      start: string;
      end: string;
    };
    reservations?: Array<{
      ip: string;
      mac: string;
      hostname?: string;
    }>;
  };
}

export interface SecurityZone {
  id: string;
  name: string;
  description?: string;
  securityLevel?: 'public' | 'internal' | 'restricted' | 'confidential';
  nodes?: string[];
}

// Device template types
export interface DeviceTemplate {
  id: string;
  title: string;
  description: string;
  nodeType: NetworkNode['nodeType'];
  deviceCategory: NetworkNode['deviceCategory'];
  hardware: {
    manufacturer: string;
    model: string;
    specs?: {
      cpu?: string;
      memory?: string;
      storage?: string;
      networkPorts?: number;
      usbPorts?: number;
      gpioAvailable?: boolean;
      powerConsumption?: string;
    };
  };
  armbianConfig?: any;
  recommendedUse?: string[];
  knownIssues?: string[];
}

// Component prop types
export interface NodeCardProps {
  node: NetworkNode;
  onUpdate: (updates: Partial<NetworkNode>) => void;
  onBuild: () => void;
  onFlash: () => void;
  onDelete: () => void;
  expanded?: boolean;
}

export interface NetworkTopologyViewProps {
  nodes: NetworkNode[];
  onNodeSelect: (node: NetworkNode | null) => void;
  onNodeUpdate: (nodeId: string, updates: Partial<NetworkNode>) => void;
  onNodeBuild: (nodeId: string) => void;
  onNodeFlash: (nodeId: string) => void;
}

export interface DeviceTemplateSelectorProps {
  onSelect: (templateId: string, configuration: any) => void;
  onClose: () => void;
}

export interface NetworkConfigurationModalProps {
  onClose: () => void;
  onSave: (config: any) => void;
}

export interface SubnetManagerProps {
  nodes: NetworkNode[];
  onNodeUpdate: (nodeId: string, updates: Partial<NetworkNode>) => void;
}

export interface SecurityOverviewProps {
  nodes: NetworkNode[];
}

export interface NetworkMonitoringProps {
  nodes: NetworkNode[];
} 