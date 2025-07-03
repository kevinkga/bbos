import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Server, Wifi, Router, HardDrive, Monitor, Smartphone, Shield, AlertTriangle, CheckCircle, Clock, Plus, Play, Pause, Square, Settings, Download, Zap, RefreshCw, Cpu, Activity } from 'lucide-react';
import { NetworkTopologyViewProps, NetworkNode } from '../types/network';
import { DeviceConfigurationModal } from './DeviceConfigurationModal';

interface NodePosition {
  x: number;
  y: number;
}

interface DragState {
  isDragging: boolean;
  nodeId: string | null;
  offset: { x: number; y: number };
}

interface NodeStatus {
  total: number;
  configured: number;
  building: number;
  deployed: number;
  ready: number;
  failed: number;
}

interface WorkflowProgress {
  [nodeId: string]: {
    status: 'planning' | 'building' | 'ready-to-flash' | 'flashing' | 'deployed' | 'failed';
    progress: number;
    workflowId: string;
    buildId?: string;
    templateName?: string;
    error?: string;
  };
}

export const NetworkTopologyView: React.FC<NetworkTopologyViewProps> = ({
  nodes,
  onAddNode,
  onUpdateNode,
  onDeleteNode,
  onNodeSelect,
  onNodeBuild,
  onNodeFlash,
  className = ''
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodePositions, setNodePositions] = useState<Record<string, NodePosition>>({});
  const [dragState, setDragState] = useState<DragState>({ isDragging: false, nodeId: null, offset: { x: 0, y: 0 } });
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [showAddNodeModal, setShowAddNodeModal] = useState(false);
  const [selectedNode, setSelectedNode] = useState<NetworkNode | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [workflowProgress, setWorkflowProgress] = useState<WorkflowProgress>({});
  const [isDeploying, setIsDeploying] = useState(false);
  const [deploymentProgress, setDeploymentProgress] = useState(0);

  // Initialize node positions based on their coordinates or auto-layout
  useEffect(() => {
    const positions: Record<string, NodePosition> = {};
    const svgWidth = 800;
    const svgHeight = 600;
    
    nodes.forEach((node, index) => {
      if (node.location?.coordinates) {
        // Use existing coordinates if available
        positions[node.id] = {
          x: Math.max(50, Math.min(svgWidth - 50, node.location.coordinates.x)),
          y: Math.max(50, Math.min(svgHeight - 50, node.location.coordinates.y))
        };
      } else {
        // Auto-layout in a grid pattern
        const cols = Math.ceil(Math.sqrt(nodes.length));
        const row = Math.floor(index / cols);
        const col = index % cols;
        const spacing = 150;
        const offsetX = (svgWidth - (cols - 1) * spacing) / 2;
        const offsetY = (svgHeight - (Math.ceil(nodes.length / cols) - 1) * spacing) / 2;
        
        positions[node.id] = {
          x: offsetX + col * spacing,
          y: offsetY + row * spacing
        };
      }
    });
    
    setNodePositions(positions);
  }, [nodes]);

  // Monitor workflow progress from build-flash integration service
  useEffect(() => {
    // Initialize workflow progress tracking
    // For now, we'll simulate workflow progress
    // TODO: Uncomment when buildFlashIntegrationService is available
    
    /*
    const handleWorkflowUpdate = (workflow: any) => {
      setWorkflowProgress(prev => ({
        ...prev,
        [workflow.networkNodeId]: {
          status: workflow.status,
          progress: workflow.buildProgress + workflow.flashProgress,
          workflowId: workflow.id,
          buildId: workflow.buildId,
          templateName: workflow.templateName,
          error: workflow.error
        }
      }));
    };

    buildFlashIntegrationService.addEventListener('workflow:updated', handleWorkflowUpdate);
    
    return () => {
      buildFlashIntegrationService.removeEventListener('workflow:updated', handleWorkflowUpdate);
    };
    */

    console.log('🔌 NetworkTopologyView: Workflow monitoring initialized');
  }, []);

  const getNodeIcon = (nodeType: string, size = 24) => {
    const iconProps = { size, className: "text-current" };
    
    switch (nodeType) {
      case 'sbc': return <Server {...iconProps} />;
      case 'server': return <Monitor {...iconProps} />;
      case 'router': return <Router {...iconProps} />;
      case 'switch': return <Wifi {...iconProps} />;
      case 'nas': return <HardDrive {...iconProps} />;
      case 'iot': return <Smartphone {...iconProps} />;
      case 'appliance': return <Shield {...iconProps} />;
      default: return <Server {...iconProps} />;
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'deployed': return { bg: 'bg-green-500', text: 'text-green-700', border: 'border-green-300' };
      case 'building': return { bg: 'bg-blue-500', text: 'text-blue-700', border: 'border-blue-300' };
      case 'error': return { bg: 'bg-red-500', text: 'text-red-700', border: 'border-red-300' };
      case 'maintenance': return { bg: 'bg-yellow-500', text: 'text-yellow-700', border: 'border-yellow-300' };
      default: return { bg: 'bg-gray-500', text: 'text-gray-700', border: 'border-gray-300' };
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'deployed': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'building': return <Clock className="w-4 h-4 text-blue-600" />;
      case 'error': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      case 'maintenance': return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      default: return <AlertTriangle className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleMouseDown = useCallback((event: React.MouseEvent, nodeId: string) => {
    event.preventDefault();
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const nodePos = nodePositions[nodeId];
    if (!nodePos) return;
    
    const clientX = event.clientX;
    const clientY = event.clientY;
    
    setDragState({
      isDragging: true,
      nodeId,
      offset: {
        x: clientX - rect.left - nodePos.x * zoomLevel - panOffset.x,
        y: clientY - rect.top - nodePos.y * zoomLevel - panOffset.y
      }
    });
  }, [nodePositions, zoomLevel, panOffset]);

  const handleMouseMove = useCallback((event: React.MouseEvent) => {
    if (!dragState.isDragging || !dragState.nodeId) return;
    
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const newX = (event.clientX - rect.left - dragState.offset.x - panOffset.x) / zoomLevel;
    const newY = (event.clientY - rect.top - dragState.offset.y - panOffset.y) / zoomLevel;
    
    setNodePositions(prev => ({
      ...prev,
      [dragState.nodeId!]: { x: newX, y: newY }
    }));
  }, [dragState, zoomLevel, panOffset]);

  const handleMouseUp = useCallback(() => {
    if (dragState.nodeId && nodePositions[dragState.nodeId]) {
      const node = nodes.find(n => n.id === dragState.nodeId);
      if (node) {
        onUpdateNode(dragState.nodeId, {
          location: {
            ...node.location,
            coordinates: {
              x: nodePositions[dragState.nodeId].x,
              y: nodePositions[dragState.nodeId].y,
              z: node.location?.coordinates?.z || 0
            }
          }
        });
      }
    }
    setDragState({ isDragging: false, nodeId: null, offset: { x: 0, y: 0 } });
  }, [dragState.nodeId, nodePositions, nodes, onUpdateNode]);

  const handleNodeClick = useCallback((node: NetworkNode) => {
    setSelectedNodeId(node.id);
    onNodeSelect?.(node);
  }, [onNodeSelect]);

  const handleZoom = useCallback((delta: number) => {
    setZoomLevel(prev => Math.max(0.5, Math.min(2, prev + delta)));
  }, []);

  const handleAddNode = useCallback(() => {
    setSelectedNode(null);
    setShowAddNodeModal(true);
  }, []);

  const handleEditNode = useCallback((node: NetworkNode) => {
    setSelectedNode(node);
    setShowEditModal(true);
  }, []);

  const handleSaveNode = useCallback((nodeConfig: Partial<NetworkNode>) => {
    if (selectedNode) {
      // Update existing node
      onUpdateNode(selectedNode.id, nodeConfig);
    } else {
      // Add new node
      const nodeId = crypto.randomUUID();
      const newNode: Partial<NetworkNode> = {
        ...nodeConfig,
        id: nodeId,
        networkId: 'default',
        userId: 'current-user',
        deviceCategory: 'armbian_supported',
        createdAt: new Date().toISOString(),
        version: 1
      };
      onAddNode(newNode);
    }
    
    setShowAddNodeModal(false);
    setShowEditModal(false);
    setSelectedNode(null);
  }, [selectedNode, onAddNode, onUpdateNode]);

  const handleDeployAll = useCallback(async () => {
    const configuredNodes = nodes.filter(node => 
      node.armbianConfig && 
      node.name && 
      node.nodeType &&
      !workflowProgress[node.id] // Only deploy nodes not already in progress
    );

    if (configuredNodes.length === 0) {
      alert('No configured nodes ready for deployment. Please configure at least one device first.');
      return;
    }

    const shouldProceed = confirm(
      `Deploy ${configuredNodes.length} device(s)?\n\n` +
      `This will start building Armbian images for:\n` +
      configuredNodes.map(node => `• ${node.name} (${node.nodeType})`).join('\n') +
      `\n\nBuilds will be available for hardware flashing once completed.`
    );

    if (!shouldProceed) return;

    setIsDeploying(true);
    setDeploymentProgress(0);

    try {
      console.log('🚀 Starting multi-device deployment workflow');
      
      // For now, we'll simulate the deployment process
      // TODO: Uncomment when services are available
      /*
      const workflowIds = await buildFlashIntegrationService.startMultiDeviceWorkflow(configuredNodes);
      
      console.log(`✅ Started ${workflowIds.length} workflows:`, workflowIds);
      
      // Update progress for each node
      configuredNodes.forEach((node, index) => {
        setWorkflowProgress(prev => ({
          ...prev,
          [node.id]: {
            status: 'building',
            progress: 5,
            workflowId: workflowIds[index] || `workflow-${node.id}`,
            templateName: node.templateName
          }
        }));
      });
      */

      // Simulate deployment progress
      for (let i = 0; i <= 100; i += 10) {
        await new Promise(resolve => setTimeout(resolve, 200));
        setDeploymentProgress(i);
        
        // Simulate updating individual node progress
        configuredNodes.forEach((node, index) => {
          const nodeProgress = Math.min(100, i + (index * 5));
          setWorkflowProgress(prev => ({
            ...prev,
            [node.id]: {
              status: nodeProgress < 100 ? 'building' : 'ready-to-flash',
              progress: nodeProgress,
              workflowId: `workflow-${node.id}`,
              templateName: node.templateName || 'Custom Configuration'
            }
          }));
        });
      }

      console.log('✅ Multi-device deployment initiated successfully');
      
    } catch (error) {
      console.error('❌ Multi-device deployment failed:', error);
      alert(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Mark failed nodes
      configuredNodes.forEach(node => {
        setWorkflowProgress(prev => ({
          ...prev,
          [node.id]: {
            status: 'failed',
            progress: 0,
            workflowId: `workflow-${node.id}`,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        }));
      });
    } finally {
      setIsDeploying(false);
      setDeploymentProgress(0);
    }
  }, [nodes, workflowProgress]);

  // Calculate connections between nodes (based on subnet/network relationships)
  const connections = nodes.flatMap(sourceNode => {
    const sourceSubnet = sourceNode.networkConfig?.primaryIp?.split('.').slice(0, 3).join('.');
    return nodes
      .filter(targetNode => {
        const targetSubnet = targetNode.networkConfig?.primaryIp?.split('.').slice(0, 3).join('.');
        return targetNode.id !== sourceNode.id && 
               sourceSubnet === targetSubnet && 
               sourceSubnet; // Both nodes must have IPs in same subnet
      })
      .map(targetNode => ({ from: sourceNode.id, to: targetNode.id }));
  });

  const renderConnections = () => {
    return connections.map(({ from, to }, index) => {
      const fromPos = nodePositions[from];
      const toPos = nodePositions[to];
      
      if (!fromPos || !toPos) return null;
      
      return (
        <line
          key={`${from}-${to}-${index}`}
          x1={fromPos.x}
          y1={fromPos.y}
          x2={toPos.x}
          y2={toPos.y}
          stroke="#e5e7eb"
          strokeWidth="2"
          strokeDasharray="5,5"
          opacity="0.6"
        />
      );
    });
  };

  const renderNodes = () => {
    return nodes.map(node => {
      const position = nodePositions[node.id];
      if (!position) return null;
      
      const statusColors = getStatusColor(node.deployment?.status);
      const isSelected = selectedNodeId === node.id;
      
      return (
        <g
          key={node.id}
          transform={`translate(${position.x}, ${position.y})`}
          className="cursor-pointer"
          onMouseDown={(e) => handleMouseDown(e, node.id)}
          onClick={() => handleNodeClick(node)}
        >
          {/* Node background circle */}
          <circle
            r="35"
            fill="white"
            stroke={isSelected ? '#3b82f6' : statusColors.border.replace('border-', '#')}
            strokeWidth={isSelected ? "3" : "2"}
            className="transition-all duration-200 hover:stroke-blue-400"
          />
          
          {/* Node icon */}
          <foreignObject x="-12" y="-12" width="24" height="24">
            <div className={`flex items-center justify-center ${statusColors.text}`}>
              {getNodeIcon(node.nodeType)}
            </div>
          </foreignObject>
          
          {/* Status indicator */}
          <circle
            cx="25"
            cy="-25"
            r="8"
            fill="white"
            stroke={statusColors.border.replace('border-', '#')}
            strokeWidth="2"
          />
          <foreignObject x="21" y="-29" width="8" height="8">
            {getStatusIcon(node.deployment?.status)}
          </foreignObject>
          
          {/* Node label */}
          <text
            y="50"
            textAnchor="middle"
            className="text-sm font-medium fill-gray-900"
            style={{ fontSize: '12px' }}
          >
            {node.name}
          </text>
          
          {/* IP address */}
          <text
            y="65"
            textAnchor="middle"
            className="text-xs fill-gray-600"
            style={{ fontSize: '10px' }}
          >
            {node.networkConfig?.primaryIp || 'No IP'}
          </text>
          
          {/* Additional info on hover/selection */}
          {isSelected && (
            <g>
              <rect
                x="-60"
                y="-85"
                width="120"
                height="40"
                fill="white"
                stroke="#e5e7eb"
                strokeWidth="1"
                rx="4"
                className="drop-shadow-lg"
              />
              <text
                y="-70"
                textAnchor="middle"
                className="text-xs font-semibold fill-gray-900"
                style={{ fontSize: '11px' }}
              >
                {node.hardware?.manufacturer} {node.hardware?.model}
              </text>
              <text
                y="-55"
                textAnchor="middle"
                className="text-xs fill-gray-600"
                style={{ fontSize: '10px' }}
              >
                {node.hardware?.specs?.cpu} | {node.hardware?.specs?.memory}
              </text>
            </g>
          )}
        </g>
      );
    });
  };

  // Get counts for different node statuses
  const nodeCounts = {
    total: nodes.length,
    configured: nodes.filter(n => n.armbianConfig).length,
    building: nodes.filter(n => n.deployment?.status === 'building').length,
    deployed: nodes.filter(n => n.deployment?.status === 'deployed').length,
    ready: nodes.filter(n => n.armbianConfig && n.deployment?.status !== 'building' && n.deployment?.status !== 'deploying').length
  };

  // Calculate node statistics
  const nodeStatus = useCallback((): NodeStatus => {
    const configured = nodes.filter(node => 
      node.armbianConfig && 
      node.name && 
      node.nodeType
    ).length;

    const building = Object.values(workflowProgress).filter(w => 
      w.status === 'building'
    ).length;

    const deployed = Object.values(workflowProgress).filter(w => 
      w.status === 'deployed'
    ).length;

    const failed = Object.values(workflowProgress).filter(w => 
      w.status === 'failed'
    ).length;

    const ready = configured - building - deployed - failed;

    return {
      total: nodes.length,
      configured,
      building,
      deployed,
      ready,
      failed
    };
  }, [nodes, workflowProgress]);

  const status = nodeStatus();

  return (
    <div className="h-full bg-white relative">
      {/* Enhanced Toolbar */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
        <button
          onClick={handleAddNode}
          className="flex items-center gap-1 px-3 py-1 text-sm bg-blue-500 text-white hover:bg-blue-600 rounded"
        >
          <Plus className="w-4 h-4" />
          Add Node
        </button>
        <div className="w-px h-4 bg-gray-300"></div>
        <button
          onClick={() => handleZoom(0.1)}
          className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          +
        </button>
        <span className="text-sm text-gray-600">{Math.round(zoomLevel * 100)}%</span>
        <button
          onClick={() => handleZoom(-0.1)}
          className="px-2 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded"
        >
          -
        </button>
        <div className="w-px h-4 bg-gray-300"></div>
        <span className="text-sm text-gray-600">{nodeCounts.total} nodes</span>
        <span className="text-sm text-gray-600">|</span>
        <span className="text-sm text-green-600">{nodeCounts.configured} configured</span>
      </div>

      {/* Deploy All Button */}
      <div className="absolute top-4 right-4 z-10 flex items-center gap-2 bg-white rounded-lg shadow-md p-2">
        <div className="text-sm text-gray-600">
          {nodeCounts.ready} ready • {nodeCounts.building} building
        </div>
        <button
          onClick={handleDeployAll}
          disabled={isDeploying || status.ready === 0}
          className={`flex items-center gap-1 px-3 py-1 text-sm rounded ${
            isDeploying || status.ready === 0
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-green-500 text-white hover:bg-green-600'
          }`}
        >
          {isDeploying ? (
            <>
              <RefreshCw className="w-4 h-4 animate-spin" />
              Deploying... {deploymentProgress}%
            </>
          ) : (
            <>
              <Play className="w-4 h-4" />
              Deploy All ({status.ready})
            </>
          )}
        </button>
      </div>

      {/* Legend */}
      <div className="absolute top-4 right-4 z-10 bg-white rounded-lg shadow-md p-3">
        <h4 className="text-sm font-medium text-gray-900 mb-2">Status</h4>
        <div className="space-y-1">
          {[
            { status: 'deployed', label: 'Online', icon: <CheckCircle className="w-3 h-3" /> },
            { status: 'building', label: 'Building', icon: <Clock className="w-3 h-3" /> },
            { status: 'error', label: 'Error', icon: <AlertTriangle className="w-3 h-3" /> },
            { status: 'maintenance', label: 'Maintenance', icon: <AlertTriangle className="w-3 h-3" /> }
          ].map(({ status, label, icon }) => {
            const colors = getStatusColor(status);
            return (
              <div key={status} className="flex items-center gap-2 text-xs">
                <div className={`${colors.text}`}>{icon}</div>
                <span className="text-gray-700">{label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main SVG Canvas */}
      <svg
        ref={svgRef}
        width="100%"
        height="100%"
        viewBox={`${-panOffset.x / zoomLevel} ${-panOffset.y / zoomLevel} ${800 / zoomLevel} ${600 / zoomLevel}`}
        className="cursor-grab active:cursor-grabbing"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Grid background */}
        <defs>
          <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
            <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#f3f4f6" strokeWidth="1"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#grid)" />
        
        {/* Network connections */}
        <g className="connections">
          {renderConnections()}
        </g>
        
        {/* Network nodes */}
        <g className="nodes">
          {renderNodes()}
        </g>
      </svg>

      {/* Node context menu (when node is selected) */}
      {selectedNodeId && (
        <div className="absolute bottom-4 left-4 z-10 bg-white rounded-lg shadow-lg p-3 min-w-48">
          <div className="flex items-center gap-2 mb-3">
            <div className="text-blue-600">
              {getNodeIcon(nodes.find(n => n.id === selectedNodeId)?.nodeType || 'sbc', 16)}
            </div>
            <span className="font-medium text-gray-900">
              {nodes.find(n => n.id === selectedNodeId)?.name}
            </span>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => onNodeBuild?.(selectedNodeId)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
            >
              Build
            </button>
            <button
              onClick={() => onNodeFlash?.(selectedNodeId)}
              className="px-3 py-1 text-xs bg-green-100 text-green-700 rounded hover:bg-green-200"
            >
              Flash
            </button>
            <button
              onClick={() => setSelectedNodeId(null)}
              className="px-3 py-1 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Add Node Modal */}
      {(showAddNodeModal || showEditModal) && (
        <DeviceConfigurationModal
          isOpen={true}
          onClose={() => {
            setShowAddNodeModal(false);
            setShowEditModal(false);
            setSelectedNode(null);
          }}
          onSave={handleSaveNode}
          existingNode={selectedNode || undefined}
        />
      )}
    </div>
  );
}; 