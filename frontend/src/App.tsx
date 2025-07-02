import React, { useState, useEffect, useCallback } from 'react'
import { Layout as FlexLayout, Model, TabNode } from 'flexlayout-react'
import { ConfigProvider, App as AntdApp, Button, Dropdown, Typography, Tooltip, notification } from 'antd'
import { StyleProvider } from '@ant-design/cssinjs'
import { 
  SettingOutlined, 
  LayoutOutlined, 
  BugOutlined,
  MenuOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined
} from '@ant-design/icons'
import { FlexLayoutFactory } from '@/layouts/FlexLayoutFactory'
import { useAppStore } from '@/stores/app'
import { ArmbianConfiguration, BuildJob } from '@/types'
import { colors } from '@/styles/design-tokens'
import { useSocketService, BuildStatus } from '@/services/socketService'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ConnectionStatusCompact } from '@/components/ConnectionStatus'
import WelcomePanel from '@/panels/WelcomePanel'
import ArmbianConfigEditor from '@/panels/ArmbianConfigEditor'
import BuildStatusPanel from '@/panels/BuildStatusPanel'
import FileExplorerPanel from '@/panels/FileExplorerPanel'
import BuildsPanel from '@/panels/BuildsPanel'
import BuildViewer from '@/panels/BuildViewer'
import { HardwareFlashPanel } from '@/panels/HardwareFlashPanel'
import { ImageRunnerPanel } from '@/panels/ImageRunnerPanel'
import 'flexlayout-react/style/light.css'
import './App.css'

const { Title } = Typography

interface AppProps {
  theme?: 'light' | 'dark'
}

const App: React.FC<AppProps> = ({ theme = 'light' }) => {
  const [model, setModel] = useState<Model | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<ArmbianConfiguration | null>(null)
  
  // Zustand store
  const { 
    setLayout,
    saveLayout,
    loadLayout,
    configurations,
    buildJobs,
    setBuildJobs,
    handleBuildCreated, 
    handleBuildUpdate, 
    handleBuildCompleted, 
    handleBuildFailed
  } = useAppStore()

  // Get current configuration - use selected config or fall back to first one
  const currentConfig = selectedConfig || (configurations.length > 0 ? configurations[0] : null)

  // Socket.io integration for real-time communication
  const socketService = useSocketService()

  // Initial data loading
  useEffect(() => {
    const loadInitialData = async () => {
      try {
        // Fetch existing builds from backend
        const response = await fetch('/api/builds')
        if (response.ok) {
          const data = await response.json()
          if (data.builds && Array.isArray(data.builds)) {
            console.log('📂 Loaded', data.builds.length, 'existing builds from backend')
            
            // Convert backend build format to frontend BuildJob format
            const buildJobs: BuildJob[] = data.builds.map((build: any) => ({
              id: build.id,
              userId: build.userId || 'default-user',
              configurationId: build.configurationId || 'unknown',
              configurationSnapshot: build.configurationSnapshot || {},
              status: build.status,
              progress: {
                percentage: build.progress || 0,
                currentStage: build.message || build.buildPhase || 'Unknown'
              },
              timing: {
                queuedAt: build.createdAt,
                startedAt: build.startedAt,
                completedAt: build.completedAt
              },
              logs: build.logs || [],
              artifacts: build.artifacts || [],
              priority: 1,
              retryCount: 0,
              maxRetries: 3,
              createdAt: build.createdAt,
              updatedAt: build.lastUpdated || build.updatedAt
            }))
            
            // Update store with existing builds
            setBuildJobs(buildJobs)
          }
        } else {
          console.warn('Failed to fetch builds:', response.statusText)
        }
      } catch (error) {
        console.error('Error loading initial builds:', error)
      }
    }

    loadInitialData()
  }, [setBuildJobs])

  // Setup socket event handlers for build events to route to store
  useEffect(() => {
    const handleBuildEvent = (build: BuildStatus) => {
      console.log('🔌 App: Socket build event received:', build)
      
      // Route different socket events to appropriate store handlers
      if (build.status === 'queued' && build.progress === 0) {
        // This is likely a new build
        handleBuildCreated({
          id: build.id,
          status: build.status,
          message: build.message,
          timestamp: build.timestamp,
          configurationId: build.configurationId,
          configuration: build.configuration
        })
      } else if (build.status === 'completed') {
        // Build completed
        handleBuildCompleted({
          id: build.id,
          status: build.status,
          progress: build.progress,
          message: build.message,
          timestamp: build.timestamp,
          artifacts: (build as any).artifacts // Type assertion for artifacts
        })
      } else if (build.status === 'failed' || build.status === 'cancelled') {
        // Build failed
        handleBuildFailed({
          id: build.id,
          status: build.status,
          message: build.message,
          timestamp: build.timestamp
        })
      } else {
        // Regular build update
        handleBuildUpdate({
          id: build.id,
          status: build.status,
          progress: build.progress,
          message: build.message,
          timestamp: build.timestamp
        })
      }
    }

    const handleStatusChange = (data: { connected: boolean; reason?: string }) => {
      console.log('🔌 App: Socket status changed:', data)
    }

    // Subscribe to socket events
    const unsubscribeCreated = socketService.on('build:created', handleBuildEvent)
    const unsubscribeUpdate = socketService.on('build:update', handleBuildEvent)
    const unsubscribeCompleted = socketService.on('build:completed', handleBuildEvent)
    const unsubscribeFailed = socketService.on('build:failed', handleBuildEvent)
    const unsubscribeStatus = socketService.on('connection:status', handleStatusChange)

    // Cleanup subscriptions
    return () => {
      unsubscribeCreated()
      unsubscribeUpdate()
      unsubscribeCompleted()
      unsubscribeFailed()
      unsubscribeStatus()
    }
  }, [socketService, handleBuildCreated, handleBuildUpdate, handleBuildCompleted, handleBuildFailed])

  // Initialize FlexLayout model
  useEffect(() => {
    const savedLayout = loadLayout('default')
    const layoutConfig = savedLayout || FlexLayoutFactory.createVSCodeLayout()
    
    // Cast to any to bypass type checking for now
    const flexModel = Model.fromJson(layoutConfig as any)
    setModel(flexModel)
    setLayout(layoutConfig)
  }, [loadLayout, setLayout])

  // Save layout changes
  const handleModelChange = useCallback((newModel: Model) => {
    const newLayout = newModel.toJson()
    setLayout(newLayout as any)
    saveLayout('default', newLayout as any)
  }, [setLayout, saveLayout])

  // Function to add a build viewer tab
  const openBuildViewer = useCallback((build: BuildJob) => {
    if (!model) return

    const tabId = `build-viewer-${build.id}`
    const tabName = `Build ${build.id.slice(0, 8)}`
    
    // Check if tab already exists
    const existingNode = model.getNodeById(tabId)
    if (existingNode) {
      // Tab already exists, just select it
      model.doAction({
        type: 'FlexLayout_SelectTab',
        data: { node: tabId }
      } as any)
      return
    }

    // Create new tab in the main editor group
    const editorGroup = model.getNodeById('editor-group')
    if (editorGroup) {
      model.doAction({
        type: 'FlexLayout_AddNode',
        data: {
          json: {
            id: tabId,
            type: 'tab',
            name: tabName,
            component: 'BuildViewer',
            config: { buildId: build.id },
            enableClose: true
          },
          toNode: 'editor-group'
        }
      } as any)
    }
  }, [model])

  // Component factory for rendering panels
  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent()

    try {
      switch (component) {
      case 'WelcomePanel':
        return (
          <WelcomePanel
            onCreateNewConfig={() => {
              console.log('Create new configuration')
              // TODO: Open new configuration panel
            }}
            onOpenConfig={() => {
              console.log('Open configuration')
            }}
            onViewDocs={() => {
              window.open('https://docs.armbian.com/', '_blank')
            }}
          />
        )
      
      case 'ArmbianConfigEditor':
        return (
          <ArmbianConfigEditor
            initialConfig={currentConfig || undefined}
            onSave={(config) => {
              console.log('Saving configuration:', config)
              
              // Check if this is an existing configuration or a new one
              const existingIndex = configurations.findIndex(c => c.id === config.id)
              
              if (existingIndex >= 0) {
                // Update existing configuration
                const { updateConfiguration } = useAppStore.getState()
                updateConfiguration(config.id, config)
                
                notification.success({
                  message: 'Configuration Updated',
                  description: `"${config.name}" has been updated successfully`,
                  placement: 'topRight'
                })
              } else {
                // Add new configuration
                const { addConfiguration } = useAppStore.getState()
                addConfiguration(config)
                
                notification.success({
                  message: 'Configuration Created',
                  description: `"${config.name}" has been created successfully`,
                  placement: 'topRight'
                })
              }
            }}
            onDelete={(configId) => {
              console.log('Deleting configuration:', configId)
              const { deleteConfiguration } = useAppStore.getState()
              deleteConfiguration(configId)
              
              // Clear the selected config if it was the one being deleted
              if (selectedConfig?.id === configId) {
                setSelectedConfig(null)
              }
              
              notification.success({
                message: 'Configuration Deleted',
                description: 'Configuration has been deleted successfully',
                placement: 'topRight'
              })
            }}
            onValidationChange={(isValid, errors) => {
              console.log('Validation:', { isValid, errors })
            }}
          />
        )
      
      case 'BuildStatusPanel':
        return (
          <BuildStatusPanel
            builds={buildJobs.map(job => ({
              id: job.id,
              status: job.status,
              progress: job.progress?.percentage || 0,
              message: job.progress?.currentStage || job.status,
              timestamp: job.updatedAt || job.createdAt,
              startTime: job.timing.startedAt,
              endTime: job.timing.completedAt
            }))}
            onViewLogs={(buildId) => {
              console.log('View logs for:', buildId)
              // Send request for build logs
              socketService.send('build:getLogs', { buildId })
            }}
            onDownloadArtifact={(buildId, artifactId) => {
              console.log('Download artifact:', { buildId, artifactId })
              // Send request for artifact download
              socketService.send('build:downloadArtifact', { buildId, artifactId })
            }}
            onCancelBuild={(buildId) => {
              console.log('Cancel build:', buildId)
              // Send build cancellation request
              socketService.send('build:cancel', { buildId })
            }}
            onRefresh={() => {
              console.log('Refreshing build status...')
              // Send request for latest build status
              socketService.send('build:refresh')
            }}
          />
        )
      
      case 'FileExplorerPanel':
        return (
          <FileExplorerPanel
            onFileSelect={(file) => {
              console.log('File selected:', file)
            }}
            onFileCreate={(file) => {
              console.log('File created:', file)
              
              notification.success({
                message: 'File Created',
                description: `"${file.title}" has been created successfully`,
                placement: 'topRight'
              })
            }}
            onFileUpdate={(file) => {
              console.log('File updated:', file)
              
              notification.info({
                message: 'File Updated',
                description: `"${file.title}" has been updated`,
                placement: 'topRight'
              })
            }}
            onFileDelete={(fileId) => {
              console.log('File deleted:', fileId)
              
              notification.success({
                message: 'File Deleted',
                description: 'File has been deleted successfully',
                placement: 'topRight'
              })
            }}
            onConfigSelect={(config) => {
              console.log('Configuration selected:', config)
              setSelectedConfig(config)
              
              notification.info({
                message: 'Configuration Selected',
                description: `Selected configuration: ${config.name}`,
                placement: 'topRight'
              })
            }}
            onBuildSelect={(build) => {
              console.log('Build selected:', build)
              
              notification.info({
                message: 'Build Selected',
                description: `Selected build ${build.id} (${build.status})`,
                placement: 'topRight'
              })
            }}
            onArtifactDownload={(buildId, artifactName) => {
              console.log('Download artifact:', { buildId, artifactName })
              
              // Create download URL and trigger download
              const downloadUrl = `/api/builds/${buildId}/artifacts/${encodeURIComponent(artifactName)}`
              const link = document.createElement('a')
              link.href = downloadUrl
              link.download = artifactName
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              
              notification.success({
                message: 'Download Started',
                description: `Downloading ${artifactName}`,
                placement: 'topRight'
              })
            }}
          />
        )
      
      case 'BuildsPanel':
        return (
          <BuildsPanel
            onBuildSelect={(build: BuildJob) => {
              console.log('Build selected:', build.id)
              openBuildViewer(build)
            }}
            onBuildDoubleClick={(build: BuildJob) => {
              console.log('Build double-clicked:', build.id)
              openBuildViewer(build)
            }}
            onArtifactDownload={(buildId: string, artifactName: string) => {
              console.log('Download artifact:', { buildId, artifactName })
              
              // Create download URL and trigger download
              const downloadUrl = `/api/builds/${buildId}/artifacts/${encodeURIComponent(artifactName)}`
              const link = document.createElement('a')
              link.href = downloadUrl
              link.download = artifactName
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              
              notification.success({
                message: 'Download Started',
                description: `Downloading ${artifactName}`,
                placement: 'topRight'
              })
            }}
            onViewLogs={(buildId: string) => {
              console.log('View logs for build:', buildId)
              // TODO: Open logs panel or modal
            }}
            onCancelBuild={(buildId: string) => {
              console.log('Cancel build:', buildId)
              // TODO: Implement build cancellation
            }}
          />
        )
      
      case 'SourceControlPanel':
        return <div className="p-4">Source Control Panel - Coming Soon</div>
      
      case 'TerminalPanel':
        return <div className="p-4">Terminal Panel - Coming Soon</div>
      
      case 'ProblemsPanel':
        return <div className="p-4">Problems Panel - Coming Soon</div>
      
      case 'OutputPanel':
        return <div className="p-4">Output Panel - Coming Soon</div>
      
      case 'DebugConsolePanel':
        return <div className="p-4">Debug Console Panel - Coming Soon</div>
      
      case 'OutlinePanel':
        return <div className="p-4">Outline Panel - Coming Soon</div>
      
      case 'TimelinePanel':
        return <div className="p-4">Timeline Panel - Coming Soon</div>
      
      case 'ConfigurationFormPanel':
        return <div className="p-4">Configuration Form Panel - Coming Soon</div>
      
      case 'ExplorerPanel':
        return <div className="p-4">Explorer Panel - Coming Soon</div>
      
      case 'ConfigurationsPanel':
        return <div className="p-4">Configurations Panel - Coming Soon</div>
      
      case 'BuildLogsPanel':
        return <div className="p-4">Build Logs Panel - Coming Soon</div>
      
      case 'BuildQueuePanel':
        return <div className="p-4">Build Queue Panel - Coming Soon</div>
      
      case 'ArtifactsPanel':
        return <div className="p-4">Artifacts Panel - Coming Soon</div>

      case 'BuildViewer':
        const buildId = node.getConfig()?.buildId
        if (!buildId) {
          return <div className="p-4">Error: No build ID provided</div>
        }
        
        // Find the build from buildJobs
        const build = buildJobs.find(b => b.id === buildId)
        if (!build) {
          return <div className="p-4">Build not found: {buildId}</div>
        }
        
        return (
          <BuildViewer
            build={build}
            onDownloadArtifact={(buildId: string, artifactName: string) => {
              console.log('Download artifact:', { buildId, artifactName })
              
              // Create download URL and trigger download
              const downloadUrl = `/api/builds/${buildId}/artifacts/${encodeURIComponent(artifactName)}`
              const link = document.createElement('a')
              link.href = downloadUrl
              link.download = artifactName
              document.body.appendChild(link)
              link.click()
              document.body.removeChild(link)
              
              notification.success({
                message: 'Download Started',
                description: `Downloading ${artifactName}`,
                placement: 'topRight'
              })
            }}
            onViewArtifact={(buildId: string, artifactName: string) => {
              console.log('View artifact:', { buildId, artifactName })
              // TODO: Implement artifact viewer
            }}
          />
        )

      case 'HardwareFlashPanel':
        return (
          <HardwareFlashPanel
            builds={buildJobs.map(job => {
              const imageArtifact = job.artifacts.find(a => a.type === 'image');
              return {
                id: job.id,
                name: `Build ${new Date(job.createdAt).toLocaleTimeString().slice(0, 8)}`,
                status: job.status,
                outputPath: imageArtifact ? `/api/builds/${job.id}/artifacts/${encodeURIComponent(imageArtifact.name)}` : undefined,
                size: imageArtifact?.size,
                createdAt: job.createdAt,
                artifacts: job.artifacts.map(artifact => ({
                  name: artifact.name,
                  type: artifact.type,
                  size: artifact.size,
                  url: `/api/builds/${job.id}/artifacts/${encodeURIComponent(artifact.name)}`
                }))
              };
            })}
            onRefresh={() => {
              console.log('Refreshing builds for hardware flashing...')
              // Send request for latest builds
              socketService.send('build:refresh')
            }}
          />
        )

      case 'ImageRunnerPanel':
        return (
          <ImageRunnerPanel
            builds={buildJobs.map(job => {
              const imageArtifact = job.artifacts.find(a => a.type === 'image');
              return {
                id: job.id,
                name: `Build ${new Date(job.createdAt).toLocaleTimeString().slice(0, 8)}`,
                status: job.status,
                outputPath: imageArtifact ? `/api/builds/${job.id}/artifacts/${encodeURIComponent(imageArtifact.name)}` : undefined,
                size: imageArtifact?.size,
                createdAt: job.createdAt,
                artifacts: job.artifacts.map(artifact => ({
                  name: artifact.name,
                  type: artifact.type,
                  size: artifact.size,
                  url: `/api/builds/${job.id}/artifacts/${encodeURIComponent(artifact.name)}`
                }))
              };
            })}
            onRefresh={() => {
              console.log('Refreshing builds for image runner...')
              // Send request for latest builds
              socketService.send('build:refresh')
            }}
          />
        )

      default:
        return <div className="p-4">Unknown Panel: {component}</div>
    }
    } catch (error) {
      console.error('Error rendering component:', component, error)
      return (
        <div className="p-4">
          <div className="text-red-600 font-bold">Error rendering component: {component}</div>
          <div className="text-sm text-gray-600 mt-2">
            {error instanceof Error ? error.message : String(error)}
          </div>
          <div className="text-xs text-gray-500 mt-2">
            {error instanceof Error && error.stack ? error.stack.split('\n').slice(0, 3).join('\n') : ''}
          </div>
        </div>
      )
    }
  }, [currentConfig])

  // Layout preset options
  const layoutPresets = [
    { key: 'vscode', label: 'VS Code Style', icon: <LayoutOutlined /> },
    { key: 'default', label: 'Default Layout', icon: <MenuOutlined /> },
    { key: 'minimal', label: 'Minimal', icon: <SettingOutlined /> }
  ]

  const handleLayoutPresetChange = useCallback((preset: string) => {
    try {
      const presets = FlexLayoutFactory.getLayoutPresets()
      const newLayout = presets[preset] || presets.vscode
      
      const newModel = Model.fromJson(newLayout as any)
      setModel(newModel)
      setLayout(newLayout)
      saveLayout('default', newLayout)
    } catch (error) {
      console.error('Error changing layout preset:', error)
    }
  }, [setLayout, saveLayout])

  // Fullscreen toggle
  const toggleFullscreen = useCallback(() => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.()
      setIsFullscreen(true)
    } else {
      document.exitFullscreen?.()
      setIsFullscreen(false)
    }
  }, [isFullscreen])

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  if (!model) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <Title level={3}>Loading BBOS...</Title>
        </div>
      </div>
    )
  }

  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        console.error('🚨 App Error:', error, errorInfo);
        // Could send to error reporting service here
      }}
    >
      <StyleProvider>
        <ConfigProvider
          theme={{
            token: {
              colorPrimary: colors.accent[500],
              colorSuccess: colors.success[500],
              colorWarning: colors.warning[500],
              colorError: colors.error[500],
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
              borderRadius: 6,
              colorBgContainer: colors.background.primary,
              colorBgLayout: colors.background.secondary,
              colorBorder: colors.border.light,
              colorText: colors.text.primary,
              colorTextSecondary: colors.text.secondary
            }
          }}
        >
          <AntdApp>
          <div className="h-screen flex flex-col" style={{ backgroundColor: colors.background.secondary }}>
        {/* Top toolbar */}
        <div 
          className="flex-shrink-0 h-12 flex items-center justify-between px-4"
          style={{ 
            backgroundColor: colors.background.primary,
            borderBottom: `1px solid ${colors.border.light}`,
            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
          }}
        >
          <div className="flex items-center space-x-4">
            <Title 
              level={4} 
              className="mb-0" 
              style={{ 
                color: colors.accent[600],
                fontWeight: 600,
                letterSpacing: '-0.025em'
              }}
            >
              BBOS
            </Title>
            <span 
              className="text-sm"
              style={{ color: colors.text.secondary }}
            >
              Cloud-based IoT Platform for Armbian Image Configuration
            </span>
          </div>
          
          <div className="flex items-center space-x-2">
            <ConnectionStatusCompact className="mr-3" />
            
            <Dropdown
              menu={{
                items: layoutPresets.map(preset => ({
                  key: preset.key,
                  label: preset.label,
                  icon: preset.icon,
                  onClick: () => handleLayoutPresetChange(preset.key)
                }))
              }}
              trigger={['click']}
            >
              <Button icon={<LayoutOutlined />} type="text">
                Layout
              </Button>
            </Dropdown>
            
            <Tooltip title="Debug Mode">
              <Button icon={<BugOutlined />} type="text" />
            </Tooltip>
            
            <Tooltip title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}>
              <Button 
                icon={isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                type="text"
                onClick={toggleFullscreen}
              />
            </Tooltip>
            
            <Dropdown
              menu={{
                items: [
                  { key: 'settings', label: 'Settings', icon: <SettingOutlined /> },
                  { key: 'about', label: 'About BBOS' }
                ]
              }}
              trigger={['click']}
            >
              <Button icon={<SettingOutlined />} type="text" />
            </Dropdown>
          </div>
        </div>

        {/* Main FlexLayout area */}
        <div className="flex-1 overflow-hidden">
          <FlexLayout
            model={model}
            factory={factory}
            onModelChange={handleModelChange}
          />
        </div>
        </div>
          </AntdApp>
        </ConfigProvider>
      </StyleProvider>
    </ErrorBoundary>
  )
}

export default App 