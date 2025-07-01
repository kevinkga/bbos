import React, { useState, useEffect, useCallback } from 'react'
import { 
  Tree, 
  Typography, 
  Button, 
  Space, 
  Dropdown, 
  Modal, 
  Input, 
  App,
  Upload, 
  Card,
  Tooltip,
  Badge,
  Divider,
  Empty,
  Tag
} from 'antd'
import { 
  FolderOutlined, 
  FolderOpenOutlined, 
  FileTextOutlined, 
  PlusOutlined, 
  DeleteOutlined, 
  EditOutlined, 
  ImportOutlined, 
  ExportOutlined, 
  CopyOutlined, 
  DownloadOutlined,
  UploadOutlined,
  MoreOutlined,
  ReloadOutlined,
  SearchOutlined,
  SettingOutlined,
  BuildOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  ClockCircleOutlined,
  FileImageOutlined,
  FileZipOutlined,
  FilePdfOutlined,
  CodeOutlined,
  PlayCircleOutlined,
  PauseCircleOutlined
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { MenuProps } from 'antd'
import { ArmbianConfiguration, BuildJob, BuildArtifact } from '@/types'
import { useAppStore, useBuildJobsByConfiguration } from '@/stores/app'
import { colors, components, spacing } from '@/styles/design-tokens'

const { Title, Text } = Typography
const { TextArea } = Input
const { confirm } = Modal

interface FileNode extends DataNode {
  id: string
  type: 'folder' | 'config' | 'template' | 'script' | 'build' | 'artifact'
  content?: ArmbianConfiguration | BuildJob | BuildArtifact | string
  size?: number
  lastModified?: Date
  description?: string
  tags?: string[]
  parentId?: string
  buildJob?: BuildJob
  artifactType?: 'image' | 'log' | 'config' | 'checksum' | 'packages'
  downloadUrl?: string
}

interface FileExplorerPanelProps {
  onFileSelect?: (file: FileNode) => void
  onFileCreate?: (file: FileNode) => void
  onFileUpdate?: (file: FileNode) => void
  onFileDelete?: (fileId: string) => void
  selectedFileId?: string
  onConfigSelect?: (config: ArmbianConfiguration) => void
  onBuildSelect?: (build: BuildJob) => void
  onArtifactDownload?: (buildId: string, artifactName: string) => void
}

export const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({
  onFileSelect,
  onFileCreate,
  onFileUpdate,
  onFileDelete,
  selectedFileId,
  onConfigSelect,
  onBuildSelect,
  onArtifactDownload
}) => {
  const { message } = App.useApp()
  const [treeData, setTreeData] = useState<FileNode[]>([])
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>(['configs', 'templates', 'scripts'])
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([])
  const [searchValue, setSearchValue] = useState('')
  const [contextMenuVisible, setContextMenuVisible] = useState(false)
  const [contextMenuPosition, setContextMenuPosition] = useState({ x: 0, y: 0 })
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null)
  
  // Modal states
  const [createModalVisible, setCreateModalVisible] = useState(false)
  const [renameModalVisible, setRenameModalVisible] = useState(false)
  const [createFileType, setCreateFileType] = useState<'folder' | 'config' | 'template' | 'script'>('config')
  const [newFileName, setNewFileName] = useState('')
  const [newFileDescription, setNewFileDescription] = useState('')

  // Store integration
  const { configurations, buildJobs, addConfiguration, updateConfiguration, deleteConfiguration } = useAppStore()

  // Helper function to get icon for build status
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

  // Helper function to get icon for artifact type
  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <FileImageOutlined style={{ color: colors.accent[600] }} />
      case 'log':
        return <FileTextOutlined style={{ color: colors.text.secondary }} />
      case 'config':
        return <SettingOutlined style={{ color: colors.text.primary }} />
      case 'checksum':
        return <FilePdfOutlined style={{ color: colors.text.tertiary }} />
      case 'packages':
        return <FileZipOutlined style={{ color: colors.text.secondary }} />
      default:
        return <FileTextOutlined />
    }
  }

  // Helper function to format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  // Helper function to get build status color
  const getBuildStatusColor = (status: string): string => {
    switch (status) {
      case 'completed':
        return 'success'
      case 'failed':
      case 'cancelled':
        return 'error'
      case 'queued':
        return 'default'
      default:
        return 'processing'
    }
  }

  // Initialize tree data
  useEffect(() => {
    const initializeTreeData = () => {
      // Create base folder structure
      const baseStructure: FileNode[] = [
        {
          id: 'configs',
          key: 'configs',
          title: (
            <Space>
              <span>Configurations</span>
              <Badge count={configurations.length} size="small" />
            </Space>
          ),
          type: 'folder',
          icon: <FolderOutlined />,
          children: []
        },
        {
          id: 'templates',
          key: 'templates', 
          title: 'Templates',
          type: 'folder',
          icon: <FolderOutlined />,
          children: []
        },
        {
          id: 'scripts',
          key: 'scripts',
          title: 'Scripts',
          type: 'folder', 
          icon: <FolderOutlined />,
          children: []
        }
      ]

      // Add configurations from store with nested builds
      const configNodes: FileNode[] = configurations.map((config) => {
        // Get builds for this configuration
        const configBuilds = buildJobs.filter(job => job.configurationId === config.id)
        
        // Create build nodes with nested artifacts
        const buildNodes: FileNode[] = configBuilds
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .map((build) => {
            // Create artifact nodes
            const artifactNodes: FileNode[] = (build.artifacts || []).map((artifact) => ({
              id: `${build.id}-${artifact.name}`,
              key: `${build.id}-${artifact.name}`,
              title: (
                <Space>
                  <span>{artifact.name}</span>
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {formatFileSize(artifact.size)}
                  </Text>
                </Space>
              ),
              type: 'artifact',
              icon: getArtifactIcon(artifact.type),
              content: artifact,
              size: artifact.size,
              description: `${artifact.type} artifact`,
              parentId: build.id,
              artifactType: artifact.type,
              downloadUrl: artifact.url,
              isLeaf: true
            }))

            const buildDate = new Date(build.createdAt).toLocaleString()
            const buildTitle = (
              <Space>
                <span>Build {buildDate}</span>
                <Tag color={getBuildStatusColor(build.status)}>
                  {build.status}
                </Tag>
                {build.status === 'building' && build.progress && (
                  <Text type="secondary" style={{ fontSize: '11px' }}>
                    {build.progress.percentage}%
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
              lastModified: new Date(build.updatedAt || build.createdAt),
              description: `Build ${build.status} - ${build.error?.message || 'Armbian build'}`,
              parentId: config.id,
              children: artifactNodes,
              isLeaf: artifactNodes.length === 0
            }
          })

        const configTitle = (
          <Space>
            <span>{config.name || 'Untitled Configuration'}</span>
            {buildNodes.length > 0 && (
              <Badge count={buildNodes.length} size="small" />
            )}
          </Space>
        )

        return {
          id: config.id,
          key: config.id,
          title: configTitle,
          type: 'config',
          icon: <FileTextOutlined />,
          content: config,
          lastModified: new Date(config.updatedAt || config.createdAt || Date.now()),
          description: config.description || 'Armbian configuration',
          parentId: 'configs',
          children: buildNodes,
          isLeaf: buildNodes.length === 0
        }
      })

      // Add template configurations
      const templateNodes: FileNode[] = [
        {
          id: 'template-minimal',
          key: 'template-minimal',
          title: 'Minimal Server',
          type: 'template',
          icon: <FileTextOutlined />,
          description: 'Basic server configuration without desktop',
          tags: ['server', 'minimal'],
          parentId: 'templates',
          isLeaf: true
        },
        {
          id: 'template-desktop',
          key: 'template-desktop',
          title: 'Desktop Environment',
          type: 'template',
          icon: <FileTextOutlined />,
          description: 'Full desktop environment with common applications',
          tags: ['desktop', 'gui'],
          parentId: 'templates',
          isLeaf: true
        },
        {
          id: 'template-iot',
          key: 'template-iot',
          title: 'IoT Gateway',
          type: 'template',
          icon: <FileTextOutlined />,
          description: 'Optimized for IoT applications and edge computing',
          tags: ['iot', 'edge'],
          parentId: 'templates',
          isLeaf: true
        }
      ]

      // Add script files
      const scriptNodes: FileNode[] = [
        {
          id: 'script-setup',
          key: 'script-setup',
          title: 'setup.sh',
          type: 'script',
          icon: <CodeOutlined />,
          content: '#!/bin/bash\n# Initial setup script\necho "Setting up Armbian system..."',
          description: 'System setup script',
          parentId: 'scripts',
          isLeaf: true
        }
      ]

      // Update tree structure
      const updatedTree = baseStructure.map(folder => {
        if (folder.id === 'configs') {
          return { ...folder, children: configNodes }
        } else if (folder.id === 'templates') {
          return { ...folder, children: templateNodes }
        } else if (folder.id === 'scripts') {
          return { ...folder, children: scriptNodes }
        }
        return folder
      })

      setTreeData(updatedTree)
    }

    initializeTreeData()
  }, [configurations, buildJobs])

  // Handle tree node selection
  const handleSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
    const node = info.node as unknown as FileNode
    setSelectedKeys(selectedKeys)
    
    // Call appropriate callback based on node type
    if (node.type === 'config' && node.content && onConfigSelect) {
      onConfigSelect(node.content as ArmbianConfiguration)
    } else if (node.type === 'build' && node.buildJob && onBuildSelect) {
      onBuildSelect(node.buildJob)
    }
    
    // Always call the general file select callback
    onFileSelect?.(node)
  }

  // Handle tree expansion
  const handleExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setExpandedKeys(expandedKeys)
  }

  // Get context menu items based on node type
  const getContextMenuItems = (node: FileNode): MenuProps['items'] => {
    const baseItems = [
      {
        key: 'refresh',
        label: 'Refresh',
        icon: <ReloadOutlined />
      }
    ]

    switch (node.type) {
      case 'folder':
        return [
          {
            key: 'create',
            label: 'New Configuration',
            icon: <PlusOutlined />
          },
          {
            key: 'import',
            label: 'Import',
            icon: <ImportOutlined />
          },
          ...baseItems
        ]

      case 'config':
        return [
          {
            key: 'open',
            label: 'Open',
            icon: <EditOutlined />
          },
          {
            key: 'build',
            label: 'Start Build',
            icon: <PlayCircleOutlined />
          },
          {
            key: 'duplicate',
            label: 'Duplicate',
            icon: <CopyOutlined />
          },
          {
            key: 'export',
            label: 'Export',
            icon: <ExportOutlined />
          },
          {
            key: 'rename',
            label: 'Rename',
            icon: <EditOutlined />
          },
          {
            key: 'delete',
            label: 'Delete',
            icon: <DeleteOutlined />
          },
          ...baseItems
        ]

      case 'build':
        const build = node.buildJob
        const canCancel = build && ['queued', 'initializing', 'downloading', 'building', 'packaging'].includes(build.status)
        
        return [
          {
            key: 'view-logs',
            label: 'View Logs',
            icon: <FileTextOutlined />
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
          ...baseItems
        ]

      case 'artifact':
        return [
          {
            key: 'download',
            label: 'Download',
            icon: <DownloadOutlined />
          },
          {
            key: 'copy-url',
            label: 'Copy Download URL',
            icon: <CopyOutlined />
          },
          ...baseItems
        ]

      default:
        return baseItems
    }
  }

  // Handle context menu clicks
  const handleContextMenuClick = (key: string, node: FileNode) => {
    switch (key) {
      case 'open':
        if (node.type === 'config' && node.content) {
          onConfigSelect?.(node.content as ArmbianConfiguration)
        }
        break

      case 'build':
        if (node.type === 'config' && node.content) {
          // Trigger build for this configuration
          message.info(`Starting build for ${(node.content as ArmbianConfiguration).name}`)
        }
        break

      case 'download':
        if (node.type === 'artifact' && node.downloadUrl) {
          const buildId = node.parentId!
          const artifactName = node.title as string
          onArtifactDownload?.(buildId, artifactName)
        }
        break

      case 'view-logs':
        if (node.type === 'build' && node.buildJob) {
          message.info(`Viewing logs for build ${node.buildJob.id}`)
        }
        break

      case 'cancel':
        if (node.type === 'build' && node.buildJob) {
          confirm({
            title: 'Cancel Build',
            content: 'Are you sure you want to cancel this build?',
            onOk() {
              message.info(`Cancelling build ${node.buildJob!.id}`)
            }
          })
        }
        break

      case 'duplicate':
        if (node.type === 'config' && node.content) {
          const config = node.content as ArmbianConfiguration
          handleDuplicateFile(node)
        }
        break

      case 'delete':
        handleDeleteFile(node)
        break

      case 'refresh':
        message.info('Refreshing...')
        break

      default:
        console.log('Context menu action:', key, node)
    }
  }

  // Handle create file
  const handleCreateFile = () => {
    if (!newFileName.trim()) {
      message.error('Please enter a file name')
      return
    }

    const newConfig: ArmbianConfiguration = {
      id: crypto.randomUUID(),
      userId: 'current-user',
      name: newFileName,
      description: newFileDescription,
      board: {
        family: 'rockchip64',
        name: 'rock-5b',
        architecture: 'arm64'
      },
      distribution: {
        release: 'bookworm',
        type: 'minimal'
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1
    }

    addConfiguration(newConfig)
    setCreateModalVisible(false)
    setNewFileName('')
    setNewFileDescription('')
    message.success('Configuration created successfully')
  }

  // Handle duplicate file
  const handleDuplicateFile = (node: FileNode) => {
    if (node.type === 'config' && node.content) {
      const original = node.content as ArmbianConfiguration
      const duplicatedName = `${original.name} (Copy)`
      
      const duplicatedConfig: ArmbianConfiguration = {
        ...original,
        id: crypto.randomUUID(),
        name: duplicatedName,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }

      addConfiguration(duplicatedConfig)
      message.success(`Configuration duplicated as "${duplicatedName}"`)
    }
  }

  // Handle export file
  const handleExportFile = (node: FileNode) => {
    if (node.type === 'config' && node.content) {
      const config = node.content as ArmbianConfiguration
      const dataStr = JSON.stringify(config, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${config.name || 'configuration'}.json`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)
      message.success('Configuration exported successfully')
    }
  }

  // Handle delete file
  const handleDeleteFile = (node: FileNode) => {
    confirm({
      title: `Delete ${node.type}`,
      content: `Are you sure you want to delete "${node.title}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      onOk() {
        if (node.type === 'config') {
          deleteConfiguration(node.id)
          message.success('Configuration deleted successfully')
        }
        onFileDelete?.(node.id)
      }
    })
  }

  // Filter tree data based on search
  const getFilteredTreeData = () => {
    if (!searchValue) return treeData

    const filterNode = (node: FileNode): FileNode | null => {
      const matchesSearch = node.title?.toString().toLowerCase().includes(searchValue.toLowerCase()) ||
                           node.description?.toLowerCase().includes(searchValue.toLowerCase())
      
      const filteredChildren = node.children
        ?.map(child => filterNode(child as FileNode))
        .filter(Boolean) as FileNode[]

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
      .filter(Boolean) as FileNode[]
  }

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
            File Explorer
          </Title>
          <Space>
            <Button
              type="text"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
              size="small"
            />
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={() => message.info('Refreshing...')}
              size="small"
            />
          </Space>
        </Space>

        {/* Search */}
        <Input
          placeholder="Search files..."
          prefix={<SearchOutlined />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          size="small"
          style={{ marginTop: spacing.sm }}
        />
      </div>

      {/* Tree Content */}
      <div style={{ padding: spacing.sm, height: 'calc(100% - 120px)', overflow: 'auto' }}>
        {treeData.length > 0 ? (
          <Tree
            treeData={getFilteredTreeData()}
            onSelect={handleSelect}
            onExpand={handleExpand}
            selectedKeys={selectedKeys}
            expandedKeys={expandedKeys}
            showIcon
            blockNode
            onRightClick={({ event, node }) => {
              setSelectedNode(node as FileNode)
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
            description="No configurations found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          >
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => setCreateModalVisible(true)}
            >
              Create Configuration
            </Button>
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

      {/* Create Configuration Modal */}
      <Modal
        title="Create New Configuration"
        open={createModalVisible}
        onOk={handleCreateFile}
        onCancel={() => {
          setCreateModalVisible(false)
          setNewFileName('')
          setNewFileDescription('')
        }}
        okText="Create"
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <div>
            <Text strong>Name</Text>
            <Input
              placeholder="Enter configuration name"
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              style={{ marginTop: spacing.xs }}
            />
          </div>
          <div>
            <Text strong>Description</Text>
            <TextArea
              placeholder="Enter description (optional)"
              value={newFileDescription}
              onChange={(e) => setNewFileDescription(e.target.value)}
              rows={3}
              style={{ marginTop: spacing.xs }}
            />
          </div>
        </Space>
      </Modal>
    </div>
  )
}

export default FileExplorerPanel 