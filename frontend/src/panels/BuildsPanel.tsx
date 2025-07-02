import React, { useState, useEffect, useMemo } from 'react'
import { 
  Tree, 
  Typography, 
  Button, 
  Space, 
  Dropdown, 
  Modal, 
  Input, 
  App,
  Card,
  Tooltip,
  Badge,
  Tag,
  Empty,
  Progress,
  List,
  Divider,
  Drawer
} from 'antd'
import { 
  BuildOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FilePdfOutlined,
  CodeOutlined,
  FileTextOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined,
  SearchOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined,
  FolderOutlined,
  SettingOutlined,
  CalendarOutlined,
  CloudDownloadOutlined,
  DeleteOutlined,
  ThunderboltOutlined
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { MenuProps } from 'antd'
import { BuildJob, BuildArtifact, ArmbianConfiguration } from '@/types'
import { useAppStore } from '@/stores/app'
import { colors, components, spacing } from '@/styles/design-tokens'
import { HardwareFlashPanel } from './HardwareFlashPanel'

const { Title, Text } = Typography
const { confirm } = Modal

interface BuildNode extends DataNode {
  id: string
  type: 'build' | 'artifact' | 'config' | 'logs' | 'folder'
  content?: BuildJob | BuildArtifact | ArmbianConfiguration | string
  buildJob?: BuildJob
  artifactType?: 'image' | 'log' | 'config' | 'checksum' | 'packages'
  downloadUrl?: string
  size?: number
  parentBuildId?: string
}

interface BuildsPanelProps {
  onBuildSelect?: (build: BuildJob) => void
  onBuildDoubleClick?: (build: BuildJob) => void
  onArtifactDownload?: (buildId: string, artifactName: string) => void
  onViewLogs?: (buildId: string) => void
  onCancelBuild?: (buildId: string) => void
  onImageFlash?: (buildId: string, imageName: string) => void
  selectedBuildId?: string
}

export const BuildsPanel: React.FC<BuildsPanelProps> = ({
  onBuildSelect,
  onBuildDoubleClick,
  onArtifactDownload,
  onViewLogs,
  onCancelBuild,
  onImageFlash,
  selectedBuildId
}) => {
  const { message } = App.useApp()
  const [treeData, setTreeData] = useState<BuildNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([])
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<BuildNode | null>(null)
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [flashDrawerVisible, setFlashDrawerVisible] = useState(false)
  const [flashBuildId, setFlashBuildId] = useState<string>('')

  // Store integration
  const { buildJobs, configurations } = useAppStore()

  // Helper functions
  const getBuildIcon = (status: string) => {
    switch (status) {
      case 'queued':
        return <ClockCircleOutlined style={{ color: colors.text.tertiary }} />
      case 'initializing':
      case 'downloading':
      case 'building':
      case 'packaging':
      case 'uploading':
        return <SyncOutlined spin style={{ color: colors.accent[500] }} />
      case 'completed':
        return <CheckCircleOutlined style={{ color: colors.success[500] }} />
      case 'failed':
      case 'cancelled':
        return <CloseCircleOutlined style={{ color: colors.error[500] }} />
      default:
        return <BuildOutlined />
    }
  }

  const getBuildStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'default'
      case 'initializing': return 'processing'
      case 'downloading': return 'processing'
      case 'building': return 'processing'
      case 'packaging': return 'processing'
      case 'uploading': return 'processing'
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'cancelled': return 'warning'
      default: return 'default'
    }
  }

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <FileImageOutlined style={{ color: colors.accent[500] }} />
      case 'log':
        return <FileTextOutlined style={{ color: colors.text.secondary }} />
      case 'config':
        return <SettingOutlined style={{ color: colors.primary[500] }} />
      case 'checksum':
        return <CodeOutlined style={{ color: colors.text.tertiary }} />
      case 'packages':
        return <FileZipOutlined style={{ color: colors.warning[500] }} />
      default:
        return <FilePdfOutlined />
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = seconds % 60
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`
    } else if (minutes > 0) {
      return `${minutes}m ${secs}s`
    } else {
      return `${secs}s`
    }
  }

  // Generate tree data from builds
  useEffect(() => {
    const generateTreeData = () => {
      try {
        // Group builds by date
        const buildsByDate: { [date: string]: BuildJob[] } = {}
        
        const sortedBuilds = [...buildJobs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        
        sortedBuilds.forEach(build => {
          const date = new Date(build.createdAt).toDateString()
          if (!buildsByDate[date]) {
            buildsByDate[date] = []
          }
          buildsByDate[date].push(build)
        })

                 const dateNodes: BuildNode[] = Object.entries(buildsByDate).map(([date, builds]) => {
           const buildNodes: BuildNode[] = builds.map(build => {
            
            // Get configuration for this build
            const config = configurations.find(c => c.id === build.configurationId)
            
            // Create artifact nodes
            const artifactNodes: BuildNode[] = (build.artifacts || []).map(artifact => {
              const isImageArtifact = artifact.type === 'image'
              const isFromCompletedBuild = build.status === 'completed'
              const canFlash = isImageArtifact && isFromCompletedBuild
              
              return {
                id: `${build.id}-artifact-${artifact.name}`,
                key: `${build.id}-artifact-${artifact.name}`,
                title: (
                  <Tooltip 
                    title={canFlash ? "Double-click to flash to hardware" : artifact.name}
                    placement="right"
                  >
                    <Space style={{ 
                      cursor: canFlash ? 'pointer' : 'default',
                      color: canFlash ? colors.accent[400] : 'inherit'
                    }}>
                      <span>{artifact.name}</span>
                      {canFlash && <ThunderboltOutlined style={{ fontSize: '10px', color: colors.accent[500] }} />}
                      <Text type="secondary" style={{ fontSize: '11px' }}>
                        {formatFileSize(artifact.size)}
                      </Text>
                    </Space>
                  </Tooltip>
                ),
                type: 'artifact',
                icon: getArtifactIcon(artifact.type),
                content: artifact,
                size: artifact.size,
                parentBuildId: build.id,
                artifactType: artifact.type,
                downloadUrl: artifact.url,
                isLeaf: true
              }
            })

            // Add configuration node if available
            const configNode: BuildNode[] = config ? [{
              id: `${build.id}-config`,
              key: `${build.id}-config`,
              title: (
                <Space>
                  <SettingOutlined />
                  <span>Configuration</span>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {config.name}
                  </Text>
                </Space>
              ),
              type: 'config',
              icon: <SettingOutlined style={{ color: colors.primary[500] }} />,
              content: config,
              parentBuildId: build.id,
              isLeaf: true
            }] : []

                                    // Add logs node - handle both string[] and BuildLog[] formats
              const logsContent = build.logs?.length > 0 
                ? (typeof build.logs[0] === 'string' 
                    ? (build.logs as any[]).join('\n') 
                    : (build.logs as any[]).map(log => log.message || log).join('\n'))
                : 'No logs available'

              const logsNode: BuildNode[] = [{
                id: `${build.id}-logs`,
                key: `${build.id}-logs`,
                title: (
                  <Space>
                    <FileTextOutlined />
                    <span>Build Logs</span>
                  </Space>
                ),
                type: 'logs',
                icon: <FileTextOutlined style={{ color: colors.text.secondary }} />,
                content: logsContent,
                parentBuildId: build.id,
                isLeaf: true
              }]

              const buildTime = new Date(build.createdAt).toLocaleTimeString()
              
                             // Handle different duration calculation approaches
               let duration = 0
               if (build.timing?.completedAt) {
                 duration = Math.floor((new Date(build.timing.completedAt).getTime() - new Date(build.createdAt).getTime()) / 1000)
               } else if ((build as any).completedAt) {
                 duration = Math.floor((new Date((build as any).completedAt).getTime() - new Date(build.createdAt).getTime()) / 1000)
               }

            const buildTitle = (
              <Space>
                <span>Build {buildTime}</span>
                             <Tag color={getBuildStatusColor(build.status)}>
                 {build.status}
               </Tag>
                {config && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {config.name}
                  </Text>
                )}
                                 {build.status === 'building' && build.progress && (
                   <Text type="secondary" style={{ fontSize: '11px' }}>
                     {typeof build.progress === 'number' ? build.progress : build.progress.percentage}%
                   </Text>
                 )}
                {duration > 0 && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {formatDuration(duration)}
                  </Text>
                )}
              </Space>
            )

            return {
              id: build.id,
              key: build.id,
              title: buildTitle,
              type: 'build',
              icon: getBuildIcon(build.status),
              content: build,
              buildJob: build,
              children: [...configNode, ...artifactNodes, ...logsNode],
              isLeaf: false
            }
          })

          const completedBuilds = builds.filter(b => b.status === 'completed').length
          const failedBuilds = builds.filter(b => b.status === 'failed').length
          const runningBuilds = builds.filter(b => ['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(b.status)).length

          return {
            id: `date-${date}`,
            key: `date-${date}`,
            title: (
              <Space>
                <CalendarOutlined />
                <span>{date}</span>
                <Badge count={builds.length} size="small" />
                               {completedBuilds > 0 && <Tag color="success">{completedBuilds} completed</Tag>}
                 {failedBuilds > 0 && <Tag color="error">{failedBuilds} failed</Tag>}
                 {runningBuilds > 0 && <Tag color="processing">{runningBuilds} running</Tag>}
              </Space>
            ),
            type: 'folder',
            icon: <FolderOutlined />,
            children: buildNodes,
            isLeaf: buildNodes.length === 0
          }
        })

                 setTreeData(dateNodes)
         
         // Auto-expand today's builds and running builds
         const today = new Date().toDateString()
         const newExpandedKeys = [`date-${today}`]
         
         // Auto-expand running builds
         buildJobs.forEach(build => {
           if (['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(build.status)) {
             newExpandedKeys.push(build.id)
           }
         })
         
         setExpandedKeys(newExpandedKeys)
       } catch (error) {
         console.error('BuildsPanel: Error generating tree data:', error)
       }
    }

    generateTreeData()
  }, [buildJobs, configurations])

  // Auto-refresh for active builds
  useEffect(() => {
    if (!autoRefresh) return

    const hasActiveBuilds = buildJobs.some(build => 
      ['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(build.status)
    )

    if (hasActiveBuilds) {
      const interval = setInterval(() => {
        // TODO: Implement build refresh functionality
        console.log('Auto-refreshing builds...')
      }, 5000) // Refresh every 5 seconds

      return () => clearInterval(interval)
    }
  }, [buildJobs, autoRefresh])

  // Handle tree selection
  const handleSelect: TreeProps['onSelect'] = (selectedKeysValue, info) => {
    setSelectedKeys(selectedKeysValue)
    const node = info.node as unknown as BuildNode
    
    if (node.type === 'build' && node.buildJob) {
      onBuildSelect?.(node.buildJob)
    }
  }

  // Handle tree expansion
  const handleExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue)
  }

  // Context menu items
  const getContextMenuItems = (node: BuildNode): MenuProps['items'] => {
    const baseItems = [
      {
        key: 'refresh',
        label: 'Refresh',
        icon: <ReloadOutlined />
      }
    ]

    switch (node.type) {
      case 'build':
        const build = node.buildJob
        const canCancel = build && ['queued', 'initializing', 'downloading', 'building', 'packaging'].includes(build.status)
        
        return [
          {
            key: 'view-logs',
            label: 'View Logs',
            icon: <EyeOutlined />
          },
          ...(canCancel ? [{
            key: 'cancel',
            label: 'Cancel Build',
            icon: <PauseCircleOutlined />
          }] : []),
          {
            key: 'download-all',
            label: 'Download All Artifacts',
            icon: <DownloadOutlined />
          },
          {
            key: 'delete',
            label: 'Delete Build',
            icon: <DeleteOutlined />
          },
          ...baseItems
        ]

      case 'artifact':
        const isImageArtifact = node.artifactType === 'image'
        const isFromCompletedBuild = node.parentBuildId && buildJobs.find(b => b.id === node.parentBuildId)?.status === 'completed'
        
        return [
          {
            key: 'download',
            label: 'Download',
            icon: <DownloadOutlined />
          },
          ...(isImageArtifact && isFromCompletedBuild ? [{
            key: 'flash-hardware',
            label: 'Flash to Hardware',
            icon: <ThunderboltOutlined />
          }] : []),
          ...baseItems
        ]

      case 'config':
        return [
          {
            key: 'view-config',
            label: 'View Configuration',
            icon: <EyeOutlined />
          },
          ...baseItems
        ]

      case 'logs':
        return [
          {
            key: 'view-logs',
            label: 'View Logs',
            icon: <EyeOutlined />
          },
          ...baseItems
        ]

      default:
        return baseItems
    }
  }

  // Handle context menu actions
  const handleContextMenuClick = (key: string, node: BuildNode) => {
    setContextMenuVisible(false)
    
    switch (key) {
      case 'view-logs':
        if (node.type === 'build' && node.buildJob) {
          onViewLogs?.(node.buildJob.id)
        } else if (node.type === 'logs' && node.parentBuildId) {
          onViewLogs?.(node.parentBuildId)
        }
        break
        
      case 'cancel':
        if (node.type === 'build' && node.buildJob) {
          onCancelBuild?.(node.buildJob.id)
        }
        break
        
      case 'download':
        if (node.type === 'artifact' && node.parentBuildId && node.content) {
          const artifact = node.content as BuildArtifact
          onArtifactDownload?.(node.parentBuildId, artifact.name)
        }
        break
        
      case 'flash-hardware':
        if (node.type === 'artifact' && node.parentBuildId && node.content && node.artifactType === 'image') {
          setFlashBuildId(node.parentBuildId)
          setFlashDrawerVisible(true)
        }
        break
        
      case 'download-all':
        if (node.type === 'build' && node.buildJob) {
          node.buildJob.artifacts?.forEach(artifact => {
            onArtifactDownload?.(node.buildJob!.id, artifact.name)
          })
        }
        break
        
      case 'delete':
        if (node.type === 'build' && node.buildJob) {
          confirm({
            title: 'Delete Build',
            content: `Are you sure you want to delete this build? This action cannot be undone.`,
            okText: 'Delete',
            okType: 'danger',
            onOk() {
              // TODO: Implement build deletion
              message.success('Build deleted successfully')
            }
          })
        }
        break
        
      case 'view-config':
        if (node.type === 'config' && node.content) {
          // TODO: Show configuration in modal or panel
          message.info('Configuration viewer coming soon')
        }
        break
        
             case 'refresh':
         console.log('Refresh builds...')
         message.success('Builds refreshed')
         break
    }
  }

  // Filter tree data based on search
  const getFilteredTreeData = () => {
    if (!searchValue) return treeData

    const filterNode = (node: BuildNode): BuildNode | null => {
      const matchesSearch = node.title?.toString().toLowerCase().includes(searchValue.toLowerCase())
      
      const filteredChildren = node.children
        ?.map(child => filterNode(child as BuildNode))
        .filter(Boolean) as BuildNode[]

      if (matchesSearch || (filteredChildren && filteredChildren.length > 0)) {
        return {
          ...node,
          children: filteredChildren
        }
      }

      return null
    }

    return treeData
      .map(node => filterNode(node))
      .filter(Boolean) as BuildNode[]
  }

  // Calculate build statistics
  const buildStats = useMemo(() => {
    const total = buildJobs.length
    const completed = buildJobs.filter(b => b.status === 'completed').length
    const failed = buildJobs.filter(b => b.status === 'failed').length
    const running = buildJobs.filter(b => ['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(b.status)).length
    
    return { total, completed, failed, running }
  }, [buildJobs])

  return (
    <div 
      style={{ 
        height: '100%',
        backgroundColor: colors.background.primary,
        border: `1px solid ${colors.border.light}`,
        borderRadius: '8px'
      }}
    >
      {/* Header */}
      <div 
        style={{
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.border.light}`,
          backgroundColor: colors.background.secondary
        }}
      >
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <Title level={5} style={{ margin: 0, color: colors.text.primary }}>
            Builds
          </Title>
          <Space>
            <Tooltip title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}>
              <Button
                type={autoRefresh ? 'primary' : 'text'}
                icon={<SyncOutlined />}
                onClick={() => setAutoRefresh(!autoRefresh)}
                size="small"
              />
            </Tooltip>
                         <Button
               type="text"
               icon={<ReloadOutlined />}
               onClick={() => console.log('Manual refresh builds...')}
               size="small"
             />
          </Space>
        </Space>

        {/* Build Statistics */}
        <div style={{ marginTop: spacing.sm }}>
          <Space wrap>
            <Tag color="default">Total: {buildStats.total}</Tag>
            {buildStats.running > 0 && <Tag color="processing">Running: {buildStats.running}</Tag>}
            {buildStats.completed > 0 && <Tag color="success">Completed: {buildStats.completed}</Tag>}
            {buildStats.failed > 0 && <Tag color="error">Failed: {buildStats.failed}</Tag>}
          </Space>
        </div>

        {/* Search */}
        <Input
          placeholder="Search builds..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          size="small"
          style={{ marginTop: spacing.sm }}
        />
      </div>

      {/* Tree Content */}
      <div style={{ padding: spacing.sm, height: 'calc(100% - 180px)', overflow: 'auto' }}>
        {treeData.length > 0 ? (
          <Tree
            treeData={getFilteredTreeData()}
            onSelect={handleSelect}
            onExpand={handleExpand}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            showIcon
            blockNode
            onDoubleClick={(e, node) => {
              const buildNode = node as BuildNode
              if (buildNode.type === 'build' && buildNode.buildJob && onBuildDoubleClick) {
                onBuildDoubleClick(buildNode.buildJob)
              } else if (buildNode.type === 'artifact' && buildNode.artifactType === 'image' && buildNode.parentBuildId) {
                // Double-click on image artifact opens flash interface
                const build = buildJobs.find(b => b.id === buildNode.parentBuildId)
                if (build?.status === 'completed') {
                  setFlashBuildId(buildNode.parentBuildId)
                  setFlashDrawerVisible(true)
                } else {
                  message.warning('Image can only be flashed from completed builds')
                }
              }
            }}
            onRightClick={({ event, node }) => {
              setSelectedNode(node as BuildNode)
              setContextMenuPosition({ x: event.pageX, y: event.pageY })
              setContextMenuVisible(true)
            }}
            style={{
              backgroundColor: 'transparent',
              color: colors.text.primary
            }}
          />
        ) : (
          <Empty
            description="No builds found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Text type="secondary">
              Builds will appear here once you start building configurations
            </Text>
          </Empty>
        )}
      </div>

      {/* Context Menu */}
      {contextMenuVisible && selectedNode && (
        <Dropdown
          open={contextMenuVisible}
          onOpenChange={setContextMenuVisible}
          menu={{
            items: getContextMenuItems(selectedNode),
            onClick: ({ key }) => handleContextMenuClick(key, selectedNode)
          }}
          trigger={['contextMenu']}
        >
          <div
            style={{
              position: 'fixed',
              left: contextMenuPosition.x,
              top: contextMenuPosition.y,
              width: 1,
              height: 1,
              pointerEvents: 'none'
            }}
          />
        </Dropdown>
      )}

      {/* Hardware Flash Drawer */}
      <Drawer
        title={
          <Space>
            <ThunderboltOutlined />
            Flash Image to Hardware
          </Space>
        }
        placement="right"
        size="large"
        open={flashDrawerVisible}
        onClose={() => setFlashDrawerVisible(false)}
        destroyOnClose
        styles={{
          body: { padding: 0 }
        }}
      >
        {flashBuildId && (
          <HardwareFlashPanel
            builds={buildJobs
              .filter(b => b.id === flashBuildId)
              .map(buildJob => ({
                id: buildJob.id,
                name: buildJob.configurationSnapshot?.name || `Build ${new Date(buildJob.createdAt).toLocaleTimeString()}`,
                status: buildJob.status,
                outputPath: buildJob.artifacts?.find(a => a.type === 'image')?.url,
                size: buildJob.artifacts?.find(a => a.type === 'image')?.size
              }))
            }
            onRefresh={() => {
              // TODO: Refresh builds data
              console.log('Refreshing build data...')
            }}
          />
        )}
      </Drawer>
    </div>
  )
}

export default BuildsPanel 