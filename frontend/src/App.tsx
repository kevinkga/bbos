import React, { useState, useEffect, useCallback } from 'react'
import { Layout as FlexLayout, Model, TabNode } from 'flexlayout-react'
import { ConfigProvider, theme, Button, Dropdown, Typography, Tooltip, notification } from 'antd'
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
import { useSocket, BuildStatus } from '@/hooks/useSocket'
import { ErrorBoundary } from '@/components/ErrorBoundary'
import { ConnectionStatusCompact } from '@/components/ConnectionStatus'
import WelcomePanel from '@/panels/WelcomePanel'
import ArmbianConfigEditor from '@/panels/ArmbianConfigEditor'
import BuildStatusPanel from '@/panels/BuildStatusPanel'
import 'flexlayout-react/style/light.css'
import './App.css'

const { Title } = Typography

interface AppProps {
  theme?: 'light' | 'dark'
}

const App: React.FC<AppProps> = ({ theme: appTheme = 'light' }) => {
  const [model, setModel] = useState<Model | null>(null)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [buildStatuses, setBuildStatuses] = useState<BuildStatus[]>([])
  
  // Zustand store
  const { 
    setLayout,
    saveLayout,
    loadLayout,
    configurations
  } = useAppStore()

  // Get current configuration (first one for now)
  const currentConfig = configurations.length > 0 ? configurations[0] : null

  // Socket.io integration for real-time communication
  const { emit } = useSocket({
    autoConnect: true,
    onBuildUpdate: useCallback((build: BuildStatus) => {
      console.log('🏗️ Build update received:', build);
      
      setBuildStatuses(prev => {
        const existingIndex = prev.findIndex(b => b.id === build.id);
        if (existingIndex >= 0) {
          // Update existing build
          const updated = [...prev];
          updated[existingIndex] = build;
          return updated;
        } else {
          // Add new build
          return [...prev, build];
        }
      });

      // Show notifications for important build status changes
      if (build.status === 'completed') {
        notification.success({
          message: 'Build Completed',
          description: `Build ${build.id} completed successfully`,
          placement: 'topRight'
        });
      } else if (build.status === 'failed') {
        notification.error({
          message: 'Build Failed',
          description: `Build ${build.id} failed: ${build.message}`,
          placement: 'topRight'
        });
      }
    }, []),
    onStatusChange: useCallback((status: 'connected' | 'disconnected' | 'error', errorMsg?: string) => {
      console.log('🔌 Connection status changed:', status, errorMsg);
      
      if (status === 'connected') {
        notification.success({
          message: 'Connected to Backend',
          description: 'Real-time communication established',
          placement: 'topRight',
          duration: 3
        });
      } else if (status === 'error') {
        notification.error({
          message: 'Connection Error',
          description: errorMsg || 'Failed to connect to backend',
          placement: 'topRight'
        });
      }
    }, [])
  })

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

  // Component factory for rendering panels
  const factory = useCallback((node: TabNode) => {
    const component = node.getComponent()

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
              // TODO: Implement save logic
            }}
            onValidationChange={(isValid, errors) => {
              console.log('Validation:', { isValid, errors })
            }}
          />
        )
      
      case 'BuildStatusPanel':
        return (
          <BuildStatusPanel
            builds={buildStatuses}
            onViewLogs={(buildId) => {
              console.log('View logs for:', buildId)
              // Emit request for build logs
              emit('build:getLogs', { buildId })
            }}
            onDownloadArtifact={(buildId, artifactId) => {
              console.log('Download artifact:', { buildId, artifactId })
              // Emit request for artifact download
              emit('build:downloadArtifact', { buildId, artifactId })
            }}
            onCancelBuild={(buildId) => {
              console.log('Cancel build:', buildId)
              // Emit build cancellation request
              emit('build:cancel', { buildId })
            }}
            onRefresh={() => {
              console.log('Refreshing build status...')
              // Emit request for latest build status
              emit('build:refresh')
            }}
          />
        )
      
      // Placeholder panels for other components
      case 'FileExplorerPanel':
        return <div className="p-4">File Explorer Panel - Coming Soon</div>
      
      case 'SearchPanel':
        return <div className="p-4">Search Panel - Coming Soon</div>
      
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

      default:
        return <div className="p-4">Unknown Panel: {component}</div>
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
      <ConfigProvider
        theme={{
          algorithm: appTheme === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
          token: {
            colorPrimary: '#1890ff',
            borderRadius: 4,
          }
        }}
      >
        <div className="h-screen flex flex-col bg-gray-50">
        {/* Top toolbar */}
        <div className="flex-shrink-0 h-12 bg-white border-b border-gray-200 flex items-center justify-between px-4">
          <div className="flex items-center space-x-4">
            <Title level={4} className="mb-0 text-blue-600">
              BBOS
            </Title>
            <span className="text-sm text-gray-500">
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
    </ConfigProvider>
    </ErrorBoundary>
  )
}

export default App 