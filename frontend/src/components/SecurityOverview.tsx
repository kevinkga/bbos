import React, { useState, useMemo } from 'react';
import { Shield, AlertTriangle, CheckCircle, Eye, Lock, Unlock, Globe, Server, Users, Activity, Clock, TrendingUp } from 'lucide-react';
import { SecurityOverviewProps, NetworkNode } from '../types/network';

interface SecurityZone {
  id: string;
  name: string;
  level: 'public' | 'internal' | 'restricted' | 'confidential';
  nodes: NetworkNode[];
  description: string;
  color: string;
}

interface VulnerabilityAlert {
  id: string;
  nodeId: string;
  nodeName: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  description: string;
  discovered: string;
  status: 'open' | 'investigating' | 'resolved';
}

export const SecurityOverview: React.FC<SecurityOverviewProps> = ({ nodes }) => {
  const [selectedZone, setSelectedZone] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'overview' | 'vulnerabilities' | 'compliance' | 'zones'>('overview');

  // Mock vulnerability data - in real app, this would come from security scanning services
  const vulnerabilities: VulnerabilityAlert[] = [
    {
      id: '1',
      nodeId: '1',
      nodeName: 'rock5b-main',
      severity: 'high',
      type: 'Outdated Package',
      description: 'OpenSSL version 1.1.1 has known vulnerabilities',
      discovered: '2024-01-15',
      status: 'open'
    },
    {
      id: '2',
      nodeId: '2',
      nodeName: 'rpi5-nas',
      severity: 'medium',
      type: 'Configuration',
      description: 'SSH allows password authentication',
      discovered: '2024-01-14',
      status: 'investigating'
    },
    {
      id: '3',
      nodeId: '1',
      nodeName: 'rock5b-main',
      severity: 'low',
      type: 'Network',
      description: 'Unnecessary service running on port 8080',
      discovered: '2024-01-13',
      status: 'resolved'
    }
  ];

  // Define security zones based on node access levels and purposes
  const securityZones: SecurityZone[] = useMemo(() => {
    const publicNodes = nodes.filter(n => n.security?.accessLevel === 'public');
    const internalNodes = nodes.filter(n => !n.security?.accessLevel || n.security?.accessLevel === 'internal');
    const restrictedNodes = nodes.filter(n => n.security?.accessLevel === 'restricted');
    const confidentialNodes = nodes.filter(n => n.security?.accessLevel === 'confidential');

    return [
      {
        id: 'public',
        name: 'Public Zone (DMZ)',
        level: 'public' as const,
        nodes: publicNodes,
        description: 'Internet-facing services with high exposure',
        color: 'bg-red-500'
      },
      {
        id: 'internal',
        name: 'Internal Network',
        level: 'internal' as const,
        nodes: internalNodes,
        description: 'Private network resources for internal use',
        color: 'bg-blue-500'
      },
      {
        id: 'restricted',
        name: 'Restricted Zone',
        level: 'restricted' as const,
        nodes: restrictedNodes,
        description: 'Sensitive systems with limited access',
        color: 'bg-yellow-500'
      },
      {
        id: 'confidential',
        name: 'Confidential Zone',
        level: 'confidential' as const,
        nodes: confidentialNodes,
        description: 'Highly sensitive systems requiring special clearance',
        color: 'bg-purple-500'
      }
    ].filter(zone => zone.nodes.length > 0);
  }, [nodes]);

  // Calculate security metrics
  const securityMetrics = useMemo(() => {
    const totalNodes = nodes.length;
    const onlineNodes = nodes.filter(n => n.deployment?.status === 'deployed').length;
    const nodesWithVulns = new Set(vulnerabilities.map(v => v.nodeId)).size;
    const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
    const highVulns = vulnerabilities.filter(v => v.severity === 'high').length;
    const openVulns = vulnerabilities.filter(v => v.status === 'open').length;
    
    // Calculate security compliance score
    const sslCertNodes = nodes.filter(n => 
      n.security?.certificates?.some(cert => cert.type === 'ssl')
    ).length;
    const accessControlNodes = nodes.filter(n => 
      n.security?.accessLevel && n.security.accessLevel !== 'public'
    ).length;
    
    const complianceScore = totalNodes > 0 ? 
      Math.round(((sslCertNodes + accessControlNodes) / (totalNodes * 2)) * 100) : 0;

    return {
      totalNodes,
      onlineNodes,
      nodesWithVulns,
      criticalVulns,
      highVulns,
      openVulns,
      complianceScore,
      sslCertNodes,
      accessControlNodes
    };
  }, [nodes, vulnerabilities]);

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500 text-white';
      case 'high': return 'bg-orange-500 text-white';
      case 'medium': return 'bg-yellow-500 text-white';
      case 'low': return 'bg-green-500 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'bg-red-100 text-red-800';
      case 'investigating': return 'bg-yellow-100 text-yellow-800';
      case 'resolved': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getZoneLevelIcon = (level: string) => {
    switch (level) {
      case 'public': return <Globe className="w-4 h-4" />;
      case 'internal': return <Users className="w-4 h-4" />;
      case 'restricted': return <Lock className="w-4 h-4" />;
      case 'confidential': return <Shield className="w-4 h-4" />;
      default: return <Server className="w-4 h-4" />;
    }
  };

  const renderOverview = () => (
    <div className="space-y-6">
      {/* Security Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="w-5 h-5 text-green-600" />
            <span className="text-sm font-medium text-gray-700">Security Score</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{securityMetrics.complianceScore}%</div>
          <div className="text-xs text-gray-600">Overall compliance</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <span className="text-sm font-medium text-gray-700">Open Vulnerabilities</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{securityMetrics.openVulns}</div>
          <div className="text-xs text-gray-600">{securityMetrics.criticalVulns} critical, {securityMetrics.highVulns} high</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <Eye className="w-5 h-5 text-blue-600" />
            <span className="text-sm font-medium text-gray-700">Nodes at Risk</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{securityMetrics.nodesWithVulns}</div>
          <div className="text-xs text-gray-600">of {securityMetrics.totalNodes} total nodes</div>
        </div>
        
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-5 h-5 text-purple-600" />
            <span className="text-sm font-medium text-gray-700">Protected Nodes</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">{securityMetrics.accessControlNodes}</div>
          <div className="text-xs text-gray-600">with access controls</div>
        </div>
      </div>

      {/* Security Zones Overview */}
      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Security Zones</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {securityZones.map(zone => (
            <div
              key={zone.id}
              className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => setSelectedZone(zone.id)}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className={`p-2 rounded-lg ${zone.color} text-white`}>
                  {getZoneLevelIcon(zone.level)}
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{zone.name}</h4>
                  <p className="text-xs text-gray-600">{zone.nodes.length} nodes</p>
                </div>
              </div>
              <p className="text-sm text-gray-600">{zone.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Vulnerabilities */}
      <div className="bg-white rounded-lg border p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Security Alerts</h3>
          <button
            onClick={() => setViewMode('vulnerabilities')}
            className="text-blue-600 hover:text-blue-800 text-sm font-medium"
          >
            View All
          </button>
        </div>
        <div className="space-y-3">
          {vulnerabilities.slice(0, 3).map(vuln => (
            <div key={vuln.id} className="flex items-start justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-start gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(vuln.severity)}`}>
                  {vuln.severity.toUpperCase()}
                </span>
                <div>
                  <h4 className="font-medium text-gray-900">{vuln.type}</h4>
                  <p className="text-sm text-gray-600">{vuln.description}</p>
                  <p className="text-xs text-gray-500">Node: {vuln.nodeName} • {vuln.discovered}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(vuln.status)}`}>
                {vuln.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderVulnerabilities = () => (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Vulnerability Management</h3>
        <div className="flex gap-2">
          {['all', 'critical', 'high', 'medium', 'low'].map(severity => (
            <button
              key={severity}
              className={`px-3 py-1 text-xs rounded-full ${
                severity === 'all' ? 'bg-gray-500 text-white' : getSeverityColor(severity)
              }`}
            >
              {severity === 'all' ? 'All' : severity.charAt(0).toUpperCase() + severity.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {vulnerabilities.map(vuln => (
          <div key={vuln.id} className="bg-white rounded-lg border p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3">
                <span className={`px-2 py-1 rounded text-xs font-medium ${getSeverityColor(vuln.severity)}`}>
                  {vuln.severity.toUpperCase()}
                </span>
                <div>
                  <h4 className="font-medium text-gray-900">{vuln.type}</h4>
                  <p className="text-sm text-gray-600 mt-1">{vuln.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
                    <span>Node: {vuln.nodeName}</span>
                    <span>Discovered: {vuln.discovered}</span>
                    <span className={`px-2 py-1 rounded-full font-medium ${getStatusColor(vuln.status)}`}>
                      {vuln.status}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex gap-1">
                <button className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200">
                  Investigate
                </button>
                <button className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200">
                  Resolve
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCompliance = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Compliance Dashboard</h3>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-medium text-gray-900 mb-4">SSL/TLS Certificates</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Valid Certificates</span>
              <span className="font-medium">{securityMetrics.sslCertNodes}/{securityMetrics.totalNodes}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full" 
                style={{ width: `${(securityMetrics.sslCertNodes / securityMetrics.totalNodes) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-medium text-gray-900 mb-4">Access Controls</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Protected Nodes</span>
              <span className="font-medium">{securityMetrics.accessControlNodes}/{securityMetrics.totalNodes}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-blue-500 h-2 rounded-full" 
                style={{ width: `${(securityMetrics.accessControlNodes / securityMetrics.totalNodes) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-6">
          <h4 className="font-medium text-gray-900 mb-4">Security Monitoring</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-gray-600">Monitored Nodes</span>
              <span className="font-medium">{securityMetrics.onlineNodes}/{securityMetrics.totalNodes}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div 
                className="bg-purple-500 h-2 rounded-full" 
                style={{ width: `${(securityMetrics.onlineNodes / securityMetrics.totalNodes) * 100}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Compliance Standards */}
      <div className="bg-white rounded-lg border p-6">
        <h4 className="font-medium text-gray-900 mb-4">Compliance Standards</h4>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { name: 'SOC 2 Type II', status: 'compliant', score: 95 },
            { name: 'ISO 27001', status: 'partial', score: 78 },
            { name: 'PCI DSS', status: 'non-compliant', score: 45 },
            { name: 'NIST Cybersecurity Framework', status: 'compliant', score: 88 }
          ].map(standard => (
            <div key={standard.name} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <h5 className="font-medium text-gray-900">{standard.name}</h5>
                <p className="text-sm text-gray-600">Score: {standard.score}%</p>
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                standard.status === 'compliant' ? 'bg-green-100 text-green-800' :
                standard.status === 'partial' ? 'bg-yellow-100 text-yellow-800' :
                'bg-red-100 text-red-800'
              }`}>
                {standard.status}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderZones = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Security Zones</h3>
      
      <div className="space-y-4">
        {securityZones.map(zone => (
          <div key={zone.id} className="bg-white rounded-lg border p-6">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-3">
                <div className={`p-3 rounded-lg ${zone.color} text-white`}>
                  {getZoneLevelIcon(zone.level)}
                </div>
                <div>
                  <h4 className="text-lg font-semibold text-gray-900">{zone.name}</h4>
                  <p className="text-gray-600">{zone.description}</p>
                  <p className="text-sm text-gray-500 mt-1">{zone.nodes.length} nodes in this zone</p>
                </div>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-medium ${zone.color} text-white`}>
                {zone.level.toUpperCase()}
              </span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {zone.nodes.map(node => (
                <div key={node.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <Server className="w-4 h-4 text-gray-600" />
                  <div>
                    <span className="text-sm font-medium text-gray-900">{node.name}</span>
                    <p className="text-xs text-gray-600">{node.networkConfig?.primaryIp}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-4 border-b pb-4">
        {[
          { id: 'overview', label: 'Overview', icon: <Activity className="w-4 h-4" /> },
          { id: 'vulnerabilities', label: 'Vulnerabilities', icon: <AlertTriangle className="w-4 h-4" /> },
          { id: 'compliance', label: 'Compliance', icon: <CheckCircle className="w-4 h-4" /> },
          { id: 'zones', label: 'Security Zones', icon: <Shield className="w-4 h-4" /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setViewMode(tab.id as any)}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              viewMode === tab.id
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {viewMode === 'overview' && renderOverview()}
      {viewMode === 'vulnerabilities' && renderVulnerabilities()}
      {viewMode === 'compliance' && renderCompliance()}
      {viewMode === 'zones' && renderZones()}
    </div>
  );
}; 