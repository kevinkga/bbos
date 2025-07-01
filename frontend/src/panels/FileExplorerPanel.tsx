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
  Empty
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
  SettingOutlined
} from '@ant-design/icons'
import type { DataNode, TreeProps } from 'antd/es/tree'
import type { MenuProps } from 'antd'
import { ArmbianConfiguration } from '@/types'
import { useAppStore } from '@/stores/app'
import { colors, components, spacing } from '@/styles/design-tokens'

const { Title, Text } = Typography
const { TextArea } = Input
const { confirm } = Modal

interface FileNode extends DataNode {
  id: string
  type: 'folder' | 'config' | 'template' | 'script'
  content?: ArmbianConfiguration | string
  size?: number
  lastModified?: Date
  description?: string
  tags?: string[]
  parentId?: string
}

interface FileExplorerPanelProps {
  onFileSelect?: (file: FileNode) => void
  onFileCreate?: (file: FileNode) => void
  onFileUpdate?: (file: FileNode) => void
  onFileDelete?: (fileId: string) => void
  selectedFileId?: string
}

export const FileExplorerPanel: React.FC<FileExplorerPanelProps> = ({
  onFileSelect,
  onFileCreate,
  onFileUpdate,
  onFileDelete,
  selectedFileId
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
  const { configurations, addConfiguration, updateConfiguration, deleteConfiguration } = useAppStore()

  // Initialize tree data
  useEffect(() => {
    const initializeTreeData = () => {
      // Create base folder structure
      const baseStructure: FileNode[] = [
        {
          id: 'configs',
          key: 'configs',
          title: 'Configurations',
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

      // Add configurations from store
      const configNodes: FileNode[] = configurations.map((config) => ({
        id: config.id,
        key: config.id,
        title: config.name || 'Untitled Configuration',
        type: 'config',
        icon: <FileTextOutlined />,
        content: config,
        lastModified: new Date(config.updatedAt || config.createdAt || Date.now()),
        description: config.description || 'Armbian configuration',
        parentId: 'configs'
      }))

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
          parentId: 'templates'
        },
        {
          id: 'template-desktop',
          key: 'template-desktop',
          title: 'Desktop Environment',
          type: 'template',
          icon: <FileTextOutlined />,
          description: 'Full desktop environment with common applications',
          tags: ['desktop', 'gui'],
          parentId: 'templates'
        },
        {
          id: 'template-iot',
          key: 'template-iot',
          title: 'IoT Gateway',
          type: 'template',
          icon: <FileTextOutlined />,
          description: 'Optimized for IoT applications and edge computing',
          tags: ['iot', 'edge'],
          parentId: 'templates'
        }
      ]

      // Add script files
      const scriptNodes: FileNode[] = [
        {
          id: 'script-setup',
          key: 'script-setup',
          title: 'setup.sh',
          type: 'script',
          icon: <FileTextOutlined />,
          content: '#!/bin/bash\n# Initial setup script\necho "Setting up Armbian system..."',
          description: 'System setup script',
          parentId: 'scripts'
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
  }, [configurations])

  // Handle tree node selection
  const handleSelect: TreeProps['onSelect'] = (selectedKeys, info) => {
    setSelectedKeys(selectedKeys)
    if (info.node && onFileSelect) {
      onFileSelect(info.node as unknown as FileNode)
    }
  }

  // Handle tree node expansion
  const handleExpand: TreeProps['onExpand'] = (expandedKeys) => {
    setExpandedKeys(expandedKeys)
  }

  // Context menu items
  const getContextMenuItems = (node: FileNode): MenuProps['items'] => {
    const baseItems: MenuProps['items'] = [
      {
        key: 'open',
        label: 'Open',
        icon: <EditOutlined />,
        disabled: node.type === 'folder'
      },
      {
        key: 'rename',
        label: 'Rename',
        icon: <EditOutlined />
      },
      {
        type: 'divider'
      }
    ]

    if (node.type === 'folder') {
      return [
        {
          key: 'create-config',
          label: 'New Configuration',
          icon: <PlusOutlined />
        },
        {
          key: 'create-folder',
          label: 'New Folder',
          icon: <FolderOutlined />
        },
        {
          key: 'import',
          label: 'Import Files',
          icon: <ImportOutlined />
        },
        {
          type: 'divider'
        },
        ...baseItems.slice(-2) // Just rename and divider
      ]
    }

    return [
      ...baseItems,
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
        type: 'divider'
      },
      {
        key: 'delete',
        label: 'Delete',
        icon: <DeleteOutlined />,
        danger: true
      }
    ]
  }

  // Handle context menu actions
  const handleContextMenuClick = (key: string, node: FileNode) => {
    switch (key) {
      case 'open':
        if (onFileSelect) onFileSelect(node)
        break
      case 'create-config':
        setCreateFileType('config')
        setCreateModalVisible(true)
        setSelectedNode(node)
        break
      case 'create-folder':
        setCreateFileType('folder')
        setCreateModalVisible(true)
        setSelectedNode(node)
        break
      case 'rename':
        setNewFileName(node.title as string)
        setRenameModalVisible(true)
        setSelectedNode(node)
        break
      case 'duplicate':
        handleDuplicateFile(node)
        break
      case 'export':
        handleExportFile(node)
        break
      case 'delete':
        handleDeleteFile(node)
        break
      case 'import':
        // TODO: Implement file import
        message.info('Import functionality coming soon')
        break
    }
    setContextMenuVisible(false)
  }

  // File operations
  const handleCreateFile = () => {
    if (!newFileName.trim()) {
      message.error('Please enter a file name')
      return
    }

    let newFile: FileNode
    
    if (createFileType === 'config') {
      // Create new Armbian configuration with proper UUID
      const configId = crypto.randomUUID()
      const newConfig: ArmbianConfiguration = {
        id: configId,
        userId: 'current-user', // TODO: Get from auth
        name: newFileName,
        description: newFileDescription,
        board: { family: '', name: '', architecture: 'arm64' },
        distribution: { release: 'bookworm', type: 'server' },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: 1
      }
      
      newFile = {
        id: configId,
        key: configId,
        title: newFileName,
        type: createFileType,
        icon: <FileTextOutlined />,
        description: newFileDescription,
        lastModified: new Date(),
        parentId: selectedNode?.id || 'configs',
        content: newConfig
      }
      
      addConfiguration(newConfig)
    } else {
      // For other file types (folder, template, script)
      newFile = {
        id: `${createFileType}-${Date.now()}`,
        key: `${createFileType}-${Date.now()}`,
        title: newFileName,
        type: createFileType,
        icon: createFileType === 'folder' ? <FolderOutlined /> : <FileTextOutlined />,
        description: newFileDescription,
        lastModified: new Date(),
        parentId: selectedNode?.id || 'configs'
      }
    }

    if (onFileCreate) onFileCreate(newFile)
    message.success(`${createFileType} created successfully`)
    
    // Reset modal state
    setCreateModalVisible(false)
    setNewFileName('')
    setNewFileDescription('')
  }

  const handleDuplicateFile = (node: FileNode) => {
    if (node.type === 'config' && node.content) {
      const duplicatedConfig = {
        ...(node.content as ArmbianConfiguration),
        id: crypto.randomUUID(),
        name: `${node.title} (Copy)`,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      addConfiguration(duplicatedConfig)
      message.success('Configuration duplicated successfully')
    }
  }

  const handleExportFile = (node: FileNode) => {
    if (node.content) {
      const dataStr = JSON.stringify(node.content, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${node.title}.json`
      link.click()
      URL.revokeObjectURL(url)
      message.success('File exported successfully')
    }
  }

  const handleDeleteFile = (node: FileNode) => {
    confirm({
      title: `Delete ${node.type}`,
      content: `Are you sure you want to delete "${node.title}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
                 if (node.type === 'config') {
           // Remove from configurations store
           deleteConfiguration(node.id)
         }
        if (onFileDelete) onFileDelete(node.id)
        message.success(`${node.type} deleted successfully`)
      }
    })
  }

  // Filter tree data based on search
  const getFilteredTreeData = () => {
    if (!searchValue) return treeData

    const filterNode = (node: FileNode): FileNode | null => {
      const matchesSearch = (node.title as string).toLowerCase().includes(searchValue.toLowerCase()) ||
                           (node.description && node.description.toLowerCase().includes(searchValue.toLowerCase()))
      
      if (node.children) {
        const filteredChildren = node.children
          .map(child => filterNode(child as FileNode))
          .filter(Boolean) as FileNode[]
        
        if (filteredChildren.length > 0 || matchesSearch) {
          return { ...node, children: filteredChildren }
        }
      }
      
      return matchesSearch ? node : null
    }

    return treeData.map(node => filterNode(node)).filter(Boolean) as FileNode[]
  }

  return (
    <div 
      className="bbos-file-explorer h-full flex flex-col"
      style={{ 
        backgroundColor: components.panel.background,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header */}
      <div 
        className="bbos-file-explorer-header"
        style={{
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.border.light}`,
          backgroundColor: components.sidebar.background
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <Title 
            level={5} 
            className="m-0"
            style={{ 
              color: colors.text.primary,
              fontWeight: 600,
              fontSize: '1rem'
            }}
          >
            Explorer
          </Title>
          <Space size="small">
            <Tooltip title="Refresh">
              <Button 
                size="small" 
                type="text"
                icon={<ReloadOutlined />}
                style={{ 
                  color: colors.text.secondary,
                  border: 'none'
                }}
              />
            </Tooltip>
            <Tooltip title="Settings">
              <Button 
                size="small" 
                type="text"
                icon={<SettingOutlined />}
                style={{ 
                  color: colors.text.secondary,
                  border: 'none'
                }}
              />
            </Tooltip>
          </Space>
        </div>
        
        {/* Search */}
        <Input
          size="small"
          placeholder="Search files..."
          prefix={<SearchOutlined style={{ color: colors.text.muted }} />}
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          allowClear
          style={{
            borderRadius: '6px',
            borderColor: colors.border.default
          }}
        />
      </div>

      {/* Action Buttons */}
      <div 
        style={{
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.border.light}`,
          backgroundColor: colors.background.primary
        }}
      >
        <Space wrap size="small">
          <Button 
            size="small" 
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              setCreateFileType('config')
              setCreateModalVisible(true)
              setSelectedNode(treeData.find(n => n.id === 'configs') || null)
            }}
            style={{
              background: `linear-gradient(135deg, ${colors.accent[500]}, ${colors.accent[600]})`,
              borderColor: colors.accent[500],
              borderRadius: '6px',
              fontWeight: 500
            }}
          >
            New Config
          </Button>
          <Button 
            size="small" 
            icon={<ImportOutlined />}
            onClick={() => message.info('Import functionality coming soon')}
            style={{
              borderColor: colors.border.default,
              color: colors.text.primary,
              borderRadius: '6px'
            }}
          >
            Import
          </Button>
        </Space>
      </div>

      {/* File Tree */}
      <div 
        className="bbos-file-explorer-content flex-1 overflow-auto"
        style={{ 
          padding: spacing.sm,
          backgroundColor: colors.background.primary
        }}
      >
        {getFilteredTreeData().length > 0 ? (
                     <Tree
             treeData={getFilteredTreeData()}
             selectedKeys={selectedKeys}
             expandedKeys={expandedKeys}
             onSelect={handleSelect}
             onExpand={handleExpand}
             showIcon
             onRightClick={({ event, node }) => {
               event.preventDefault()
               setSelectedNode(node as unknown as FileNode)
               setContextMenuPosition({ x: event.clientX, y: event.clientY })
               setContextMenuVisible(true)
             }}
           />
        ) : (
          <Empty 
            description="No files found"
            image={Empty.PRESENTED_IMAGE_SIMPLE}
          />
        )}
      </div>

      {/* Context Menu */}
      {contextMenuVisible && selectedNode && (
        <div
          style={{
            position: 'fixed',
            left: contextMenuPosition.x,
            top: contextMenuPosition.y,
            zIndex: 1000
          }}
        >
          <Dropdown
            menu={{
              items: getContextMenuItems(selectedNode),
              onClick: ({ key }) => handleContextMenuClick(key, selectedNode)
            }}
            open={contextMenuVisible}
            onOpenChange={(open) => !open && setContextMenuVisible(false)}
          >
            <div />
          </Dropdown>
        </div>
      )}

      {/* Create File Modal */}
      <Modal
        title={`Create New ${createFileType}`}
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
            <Text>Name *</Text>
            <Input
              value={newFileName}
              onChange={(e) => setNewFileName(e.target.value)}
              placeholder={`Enter ${createFileType} name`}
              onPressEnter={handleCreateFile}
            />
          </div>
          <div>
            <Text>Description</Text>
            <TextArea
              value={newFileDescription}
              onChange={(e) => setNewFileDescription(e.target.value)}
              placeholder="Optional description"
              rows={3}
            />
          </div>
        </Space>
      </Modal>

      {/* Rename Modal */}
      <Modal
        title="Rename"
        open={renameModalVisible}
        onOk={() => {
          if (selectedNode && newFileName.trim()) {
            // TODO: Implement rename functionality
            message.success('Rename functionality coming soon')
            setRenameModalVisible(false)
            setNewFileName('')
          }
        }}
        onCancel={() => {
          setRenameModalVisible(false)
          setNewFileName('')
        }}
        okText="Rename"
      >
        <Input
          value={newFileName}
          onChange={(e) => setNewFileName(e.target.value)}
          placeholder="Enter new name"
          onPressEnter={() => {
            if (newFileName.trim()) {
              message.success('Rename functionality coming soon')
              setRenameModalVisible(false)
              setNewFileName('')
            }
          }}
        />
      </Modal>
    </div>
  )
}

export default FileExplorerPanel 