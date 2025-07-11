import React, { useState, useEffect } from 'react'
import { Card, Progress, Badge, Typography, List, Space, Button, Tag, Timeline, Empty, Spin } from 'antd'
import { 
  PlayCircleOutlined, 
  StopOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  ClockCircleOutlined,
  DownloadOutlined,
  EyeOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { BuildStatus } from '@/hooks/useSocket'
const { Text } = Typography

// Local interfaces for this component
interface LocalBuildJob {
  id: string
  userId: string
  configurationId: string
  status: 'queued' | 'running' | 'completed' | 'failed' | 'cancelled'
  progress: number
  stage: string
  message: string
  error?: string
  createdAt: Date
  updatedAt: Date
  logs: any[]
  artifacts?: {
    id: string
    name: string
    type: string
    size: number
    url: string
    checksums: {
      md5: string
      sha256: string
    }
  }[]
  estimatedDuration?: number
  actualDuration?: number
}

interface BuildStatusPanelProps {
  builds?: BuildStatus[] // External builds from Socket.io
  onViewLogs?: (buildId: string) => void
  onDownloadArtifact?: (buildId: string, artifactId: string) => void
  onCancelBuild?: (buildId: string) => void
  onRefresh?: () => void
}

interface BuildProgress {
  stage: string
  progress: number
  message: string
  timestamp: Date
}

// Mapper function to convert Socket.io BuildStatus to LocalBuildJob
const mapBuildStatusToLocalBuild = (build: BuildStatus): LocalBuildJob => {
  // Map Socket.io status to LocalBuildJob status
  const statusMap: Record<BuildStatus['status'], LocalBuildJob['status']> = {
    'pending': 'queued',
    'building': 'running',
    'completed': 'completed', 
    'failed': 'failed'
  }
  
  return {
    id: build.id,
    userId: 'socket-user', // Default for Socket.io builds
    configurationId: `config-${build.id}`,
    status: statusMap[build.status],
    progress: build.progress,
    stage: build.message || 'Processing...',
    message: build.message,
    createdAt: build.startTime ? new Date(build.startTime) : new Date(),
    updatedAt: new Date(),
    logs: [],
    artifacts: build.status === 'completed' ? [
      {
        id: `artifact-${build.id}`,
        name: `Armbian_Build_${build.id}.img.xz`,
        type: 'image',
        size: 1024 * 1024 * 500, // 500MB default
        url: `/artifacts/${build.id}/image.img.xz`,
        checksums: {
          md5: 'calculated...',
          sha256: 'calculated...'
        }
      }
    ] : [],
    estimatedDuration: 3600, // 1 hour default
    actualDuration: build.startTime && build.endTime 
      ? Math.floor((new Date(build.endTime).getTime() - new Date(build.startTime).getTime()) / 1000)
      : undefined
  }
}

const BuildStatusPanel: React.FC<BuildStatusPanelProps> = ({
  builds: externalBuilds,
  onViewLogs,
  onDownloadArtifact,
  onCancelBuild,
  onRefresh
}) => {
  const [currentBuild, setCurrentBuild] = useState<LocalBuildJob | null>(null)
  const [buildHistory, setBuildHistory] = useState<LocalBuildJob[]>([])
  const [buildProgress, setBuildProgress] = useState<BuildProgress[]>([])
  const [loading, setLoading] = useState(false)
  const [refreshing, setRefreshing] = useState(false)

  // Mock build stages for demonstration
  const buildStages = [
    'Initializing Environment',
    'Downloading Sources',
    'Configuring Kernel',
    'Compiling Kernel',
    'Building Root Filesystem',
    'Installing Packages',
    'Applying Customizations',
    'Creating Image',
    'Compressing Output',
    'Uploading Artifacts'
  ]

  // Handle external builds from Socket.io or use mock data
  useEffect(() => {
    setLoading(true)
    
    if (externalBuilds && externalBuilds.length > 0) {
      // Use real builds from Socket.io
      const mappedBuilds = externalBuilds.map(mapBuildStatusToLocalBuild)
      
      // Find current running build or most recent build
      const runningBuild = mappedBuilds.find(build => build.status === 'running')
      const currentBuild = runningBuild || mappedBuilds[0]
      
      setCurrentBuild(currentBuild || null)
      setBuildHistory(mappedBuilds.filter(build => build.status !== 'running'))
      
      // Update progress history for running builds
      if (runningBuild) {
        setBuildProgress(prev => [
          ...prev.slice(-10), // Keep last 10 entries
          {
            stage: runningBuild.stage,
            progress: runningBuild.progress,
            message: runningBuild.message,
            timestamp: new Date()
          }
        ])
      }
      
      setLoading(false)
      return // Exit early, don't use mock data
    }

    // Fall back to mock data when no external builds provided
    const mockCurrentBuild: LocalBuildJob = {
      id: 'build-001',
      userId: 'user-123',
      configurationId: 'config-456',
      status: 'running',
      progress: 45,
      stage: 'Compiling Kernel',
      message: 'Building kernel modules...',
      createdAt: new Date(Date.now() - 1800000), // 30 minutes ago
      updatedAt: new Date(),
      logs: [],
      artifacts: [],
      estimatedDuration: 3600, // 1 hour
      actualDuration: 1800 // 30 minutes so far
    }

    setCurrentBuild(mockCurrentBuild)

    // Simulate progress updates
    const progressInterval = setInterval(() => {
      setCurrentBuild(prev => {
        if (!prev || prev.status !== 'running') return prev
        
        const newProgress = Math.min(prev.progress + Math.random() * 5, 100)
        const stageIndex = Math.floor((newProgress / 100) * buildStages.length)
        const currentStage = buildStages[stageIndex] || buildStages[buildStages.length - 1]
        
        const newBuild = {
          ...prev,
          progress: newProgress,
          stage: currentStage,
          message: `${currentStage}... ${Math.floor(newProgress)}% complete`,
          updatedAt: new Date(),
                     actualDuration: (prev.actualDuration || 0) + 5
        }

        // Add to progress history
        setBuildProgress(prevProgress => [
          ...prevProgress.slice(-10), // Keep last 10 entries
          {
            stage: currentStage,
            progress: newProgress,
            message: newBuild.message,
            timestamp: new Date()
          }
        ])



        // Complete build at 100%
        if (newProgress >= 100) {
          newBuild.status = 'completed'
          newBuild.progress = 100
          newBuild.stage = 'Completed'
          newBuild.message = 'Build completed successfully'
          newBuild.artifacts = [
            {
              id: 'img-001',
              name: 'Armbian_22.11.0_Orangepizero2w_jammy_current_5.15.74.img.xz',
              type: 'image',
              size: 1024 * 1024 * 512, // 512MB
              url: '/artifacts/build-001/image.img.xz',
              checksums: {
                md5: 'abc123...',
                sha256: 'def456...'
              }
            }
          ]
        }

        return newBuild
      })
    }, 5000) // Update every 5 seconds

    // Mock build history
    const mockHistory: LocalBuildJob[] = [
      {
        id: 'build-002',
        userId: 'user-123',
        configurationId: 'config-789',
        status: 'completed',
        progress: 100,
        stage: 'Completed',
        message: 'Build completed successfully',
        createdAt: new Date(Date.now() - 7200000), // 2 hours ago
        updatedAt: new Date(Date.now() - 5400000), // 1.5 hours ago
        logs: [],
        artifacts: [
          {
            id: 'img-002',
            name: 'Armbian_22.11.0_Rpi4b_jammy_current_5.15.74.img.xz',
            type: 'image',
            size: 1024 * 1024 * 768, // 768MB
            url: '/artifacts/build-002/image.img.xz',
            checksums: {
              md5: 'ghi789...',
              sha256: 'jkl012...'
            }
          }
        ],
        estimatedDuration: 3600,
        actualDuration: 3240
      },
      {
        id: 'build-003',
        userId: 'user-123',
        configurationId: 'config-101',
        status: 'failed',
        progress: 67,
        stage: 'Building Root Filesystem',
        message: 'Package installation failed: unable to locate package xyz',
        error: 'Package not found in repository',
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
        updatedAt: new Date(Date.now() - 86100000),
        logs: [],
        artifacts: [],
        estimatedDuration: 3600,
        actualDuration: 2400
      }
    ]

    setBuildHistory(mockHistory)
    setLoading(false)

    return () => clearInterval(progressInterval)
  }, [externalBuilds])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await onRefresh?.()
    } catch (error) {
      console.error('Refresh error:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const getStatusBadge = (status: LocalBuildJob['status']) => {
    const statusConfig: Record<LocalBuildJob['status'], { color: string; icon: React.ReactElement }> = {
      queued: { color: 'blue', icon: <ClockCircleOutlined /> },
      running: { color: 'processing', icon: <PlayCircleOutlined /> },
      completed: { color: 'success', icon: <CheckCircleOutlined /> },
      failed: { color: 'error', icon: <ExclamationCircleOutlined /> },
      cancelled: { color: 'default', icon: <StopOutlined /> }
    }

    const config = statusConfig[status]
    return (
      <Badge 
        status={config.color as any}
        text={
          <Space>
            {config.icon}
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </Space>
        }
      />
    )
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

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 B'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" tip="Loading build status..." />
      </div>
    )
  }

  // Show empty state when no builds available
  const hasAnyBuilds = currentBuild || buildHistory.length > 0
  if (!hasAnyBuilds && !externalBuilds) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <Empty
          description="No builds found"
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        >
          <Button type="primary">Start Your First Build</Button>
        </Empty>
      </div>
    )
  }

  return (
    <div className="h-full overflow-auto p-4 space-y-4">
      {/* Current Build */}
      {currentBuild && (
        <Card 
          title={
            <Space>
              <span>Current Build</span>
              {getStatusBadge(currentBuild.status)}
            </Space>
          }
          extra={
            currentBuild.status === 'running' && (
              <Button 
                danger 
                size="small" 
                icon={<StopOutlined />}
                onClick={() => onCancelBuild?.(currentBuild.id)}
                loading={refreshing}
              >
                Cancel
              </Button>
            )
          }
        >
          <div className="space-y-4">
            {/* Progress */}
            <div>
              <div className="flex justify-between items-center mb-2">
                <Text strong>Progress</Text>
                <Text type="secondary">{Math.floor(currentBuild.progress)}%</Text>
              </div>
              <Progress 
                percent={Math.floor(currentBuild.progress)}
                status={currentBuild.status === 'failed' ? 'exception' : 'active'}
                strokeColor={
                  currentBuild.status === 'completed' ? '#52c41a' :
                  currentBuild.status === 'failed' ? '#ff4d4f' :
                  '#1890ff'
                }
              />
            </div>

            {/* Current Stage */}
            <div>
              <Text strong>Current Stage: </Text>
              <Tag color="blue">{currentBuild.stage}</Tag>
            </div>

            {/* Message */}
            <div>
              <Text strong>Status: </Text>
              <Text>{currentBuild.message}</Text>
            </div>

            {currentBuild.error && (
              <div>
                <Text strong>Error: </Text>
                <Text type="danger">{currentBuild.error}</Text>
              </div>
            )}

            {/* Timing */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Text strong>Elapsed: </Text>
                <Text>{formatDuration(currentBuild.actualDuration || 0)}</Text>
              </div>
              <div>
                <Text strong>Estimated: </Text>
                <Text>{formatDuration(currentBuild.estimatedDuration || 0)}</Text>
              </div>
            </div>

            {/* Artifacts */}
            {currentBuild.artifacts && currentBuild.artifacts.length > 0 && (
              <div>
                <Text strong>Artifacts:</Text>
                <List
                  dataSource={currentBuild.artifacts}
                  renderItem={(artifact: any) => (
                    <List.Item
                      actions={[
                        <Button 
                          type="link" 
                          icon={<DownloadOutlined />}
                          onClick={() => onDownloadArtifact?.(currentBuild.id, artifact.id)}
                        >
                          Download
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={artifact.name}
                        description={`${artifact.type} • ${formatFileSize(artifact.size)}`}
                      />
                    </List.Item>
                  )}
                />
              </div>
            )}

            {/* Actions */}
            <div className="flex justify-end">
              <Button 
                icon={<EyeOutlined />}
                onClick={() => onViewLogs?.(currentBuild.id)}
              >
                View Logs
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Build Progress Timeline */}
      {buildProgress.length > 0 && (
        <Card title="Build Progress Timeline">
          <Timeline>
            {buildProgress.slice(-5).map((progress, index) => (
              <Timeline.Item
                key={index}
                color={progress.progress === 100 ? 'green' : 'blue'}
              >
                <div>
                  <Text strong>{progress.stage}</Text>
                  <br />
                  <Text type="secondary">{progress.message}</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    {progress.timestamp.toLocaleTimeString()}
                  </Text>
                </div>
              </Timeline.Item>
            ))}
          </Timeline>
        </Card>
      )}

      {/* Build History */}
      <Card 
        title="Recent Builds"
        extra={
          onRefresh && (
            <Button 
              size="small"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={refreshing}
            >
              Refresh
            </Button>
          )
        }
      >
        <List
          dataSource={buildHistory}
          renderItem={(build: LocalBuildJob) => (
            <List.Item
              actions={[
                build.artifacts && build.artifacts.length > 0 && (
                  <Button 
                    type="link" 
                    icon={<DownloadOutlined />}
                    onClick={() => onDownloadArtifact?.(build.id, build.artifacts![0].id)}
                  >
                    Download
                  </Button>
                ),
                <Button 
                  type="link" 
                  icon={<EyeOutlined />}
                  onClick={() => onViewLogs?.(build.id)}
                >
                  Logs
                </Button>
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={
                  <Space>
                    <span>Build {build.id}</span>
                    {getStatusBadge(build.status)}
                  </Space>
                }
                description={
                  <div>
                    <div>{build.message}</div>
                    <Space className="text-xs text-gray-500">
                      <span>Started: {build.createdAt.toLocaleString()}</span>
                      <span>Duration: {formatDuration(build.actualDuration || 0)}</span>
                    </Space>
                  </div>
                }
              />
              {build.status === 'running' && (
                <div className="mt-2">
                  <Progress 
                    percent={Math.floor(build.progress)} 
                    size="small"
                    status="active"
                  />
                </div>
              )}
            </List.Item>
          )}
        />
      </Card>
    </div>
  )
}

export default BuildStatusPanel 