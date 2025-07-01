import React, { useState } from 'react'
import { Card, Descriptions, Tag, Tabs, Space, Button, Typography, List, Divider, Progress, Timeline, Alert } from 'antd'
import { DownloadOutlined, EyeOutlined, FileTextOutlined, SettingOutlined, FolderOpenOutlined, ClockCircleOutlined } from '@ant-design/icons'
import { BuildJob, BuildArtifact } from '../types'
import { colors, spacing } from '../styles/design-tokens'

const { Title, Text, Paragraph } = Typography

interface BuildViewerProps {
  build: BuildJob
  onDownloadArtifact?: (buildId: string, artifactName: string) => void
  onViewArtifact?: (buildId: string, artifactName: string) => void
}

export const BuildViewer: React.FC<BuildViewerProps> = ({
  build,
  onDownloadArtifact,
  onViewArtifact
}) => {
  const [activeTab, setActiveTab] = useState('overview')

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'success'
      case 'failed': return 'error'
      case 'cancelled': return 'default'
      case 'queued': return 'warning'
      default: return 'processing'
    }
  }

  const getArtifactIcon = (type: string) => {
    switch (type) {
      case 'image': return <FolderOpenOutlined style={{ color: colors.accent[500] }} />
      case 'log': return <FileTextOutlined style={{ color: colors.primary[500] }} />
      case 'config': return <SettingOutlined style={{ color: colors.warning[500] }} />
      default: return <FileTextOutlined style={{ color: colors.text.secondary }} />
    }
  }

  const formatFileSize = (bytes: number) => {
    const sizes = ['B', 'KB', 'MB', 'GB']
    let i = 0
    while (bytes >= 1024 && i < sizes.length - 1) {
      bytes /= 1024
      i++
    }
    return `${bytes.toFixed(1)} ${sizes[i]}`
  }

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}m ${secs}s`
  }

  const getTimelineStatus = () => {
    if (build.status === 'completed') return 'finish'
    if (build.status === 'failed') return 'error'
    if (['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(build.status)) return 'process'
    return 'wait'
  }

  const buildProgress = () => {
    const statusOrder = ['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading', 'completed']
    const currentIndex = statusOrder.indexOf(build.status)
    const totalSteps = statusOrder.length - 1
    return Math.max(0, (currentIndex / totalSteps) * 100)
  }

  const tabItems = [
    {
      key: 'overview',
      label: (
        <Space>
          <EyeOutlined />
          Overview
        </Space>
      ),
      children: (
        <div style={{ padding: spacing.md }}>
          {/* Status Alert */}
          {build.status === 'failed' && build.error && (
            <Alert
              message="Build Failed"
              description={build.error.message}
              type="error"
              showIcon
              style={{ marginBottom: spacing.lg }}
            />
          )}

          {/* Build Progress */}
          {['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(build.status) && (
            <Card style={{ marginBottom: spacing.lg }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>Build Progress</Text>
                <Progress
                  percent={buildProgress()}
                  status={build.status === 'failed' ? 'exception' : 'active'}
                  strokeColor={{
                    '0%': colors.accent[500],
                    '100%': colors.success[500],
                  }}
                />
                <Text type="secondary">Current Status: {build.status}</Text>
              </Space>
            </Card>
          )}

          {/* Build Info */}
          <Card title="Build Information" style={{ marginBottom: spacing.lg }}>
            <Descriptions column={2} size="small">
              <Descriptions.Item label="Build ID" span={2}>
                <Text code>{build.id}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Status">
                <Tag color={getStatusColor(build.status)}>{build.status.toUpperCase()}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Configuration">
                {build.configurationSnapshot?.name || 'Unknown'}
              </Descriptions.Item>
              <Descriptions.Item label="Started">
                {build.timing?.startedAt ? new Date(build.timing.startedAt).toLocaleString() : 'N/A'}
              </Descriptions.Item>
              <Descriptions.Item label="Duration">
                {build.timing?.duration ? formatDuration(build.timing.duration) : 'In progress...'}
              </Descriptions.Item>
              <Descriptions.Item label="Board" span={2}>
                {build.configurationSnapshot?.board?.name || 'Unknown'} ({build.configurationSnapshot?.board?.architecture})
              </Descriptions.Item>
              <Descriptions.Item label="Distribution" span={2}>
                {build.configurationSnapshot?.distribution?.release} ({build.configurationSnapshot?.distribution?.type})
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Timeline */}
          <Card title="Build Timeline">
            <Timeline
              mode="left"
              pending={['queued', 'initializing', 'downloading', 'building', 'packaging', 'uploading'].includes(build.status)}
              items={[
                {
                  label: build.timing?.startedAt ? new Date(build.timing.startedAt).toLocaleString() : undefined,
                  children: 'Build started',
                  dot: <ClockCircleOutlined style={{ fontSize: '16px' }} />,
                },
                ...build.logs.map((log, index) => ({
                  children: log.message,
                  color: build.status === 'failed' && index === build.logs.length - 1 ? 'red' : 'blue'
                })),
                ...(build.status === 'completed' ? [{
                  label: build.timing?.completedAt ? new Date(build.timing.completedAt).toLocaleString() : undefined,
                  children: 'Build completed successfully',
                  color: 'green'
                }] : []),
                ...(build.status === 'failed' ? [{
                  children: `Build failed: ${build.error?.message || 'Unknown error'}`,
                  color: 'red'
                }] : [])
              ]}
            />
          </Card>
        </div>
      )
    },
    {
      key: 'configuration',
      label: (
        <Space>
          <SettingOutlined />
          Configuration
        </Space>
      ),
      children: (
        <div style={{ padding: spacing.md }}>
          <Card title="Armbian Configuration">
            {build.configurationSnapshot ? (
              <div>
                <Descriptions column={1} size="small" bordered>
                  <Descriptions.Item label="Name">
                    {build.configurationSnapshot.name}
                  </Descriptions.Item>
                  <Descriptions.Item label="Description">
                    {build.configurationSnapshot.description || 'No description'}
                  </Descriptions.Item>
                  <Descriptions.Item label="Board">
                    {build.configurationSnapshot.board?.family} / {build.configurationSnapshot.board?.name} ({build.configurationSnapshot.board?.architecture})
                  </Descriptions.Item>
                  <Descriptions.Item label="Distribution">
                    {build.configurationSnapshot.distribution?.release} - {build.configurationSnapshot.distribution?.type}
                  </Descriptions.Item>
                  {build.configurationSnapshot.network?.hostname && (
                    <Descriptions.Item label="Hostname">
                      {build.configurationSnapshot.network.hostname}
                    </Descriptions.Item>
                  )}
                  {build.configurationSnapshot.users && build.configurationSnapshot.users.length > 0 && (
                    <Descriptions.Item label="Users">
                      {build.configurationSnapshot.users.map(user => user.username).join(', ')}
                    </Descriptions.Item>
                  )}
                  {build.configurationSnapshot.ssh && (
                    <Descriptions.Item label="SSH">
                      Enabled: {build.configurationSnapshot.ssh.enabled ? 'Yes' : 'No'}, 
                      Port: {build.configurationSnapshot.ssh.port || 22}
                    </Descriptions.Item>
                  )}
                </Descriptions>

                <Divider />
                
                <Title level={5}>Raw Configuration</Title>
                <Paragraph>
                  <pre style={{ 
                    backgroundColor: colors.background.secondary, 
                    padding: spacing.md, 
                    borderRadius: '4px',
                    fontSize: '12px',
                    overflow: 'auto',
                    maxHeight: '300px'
                  }}>
                    {JSON.stringify(build.configurationSnapshot, null, 2)}
                  </pre>
                </Paragraph>
              </div>
            ) : (
              <Text type="secondary">No configuration data available</Text>
            )}
          </Card>
        </div>
      )
    },
    {
      key: 'artifacts',
      label: (
        <Space>
          <FolderOpenOutlined />
          Artifacts ({build.artifacts?.length || 0})
        </Space>
      ),
      children: (
        <div style={{ padding: spacing.md }}>
          <Card title="Build Artifacts">
            {build.artifacts && build.artifacts.length > 0 ? (
              <List
                itemLayout="horizontal"
                dataSource={build.artifacts}
                renderItem={(artifact: BuildArtifact) => (
                  <List.Item
                    actions={[
                      <Button
                        key="download"
                        type="primary"
                        size="small"
                        icon={<DownloadOutlined />}
                        onClick={() => onDownloadArtifact?.(build.id, artifact.name)}
                      >
                        Download
                      </Button>,
                      <Button
                        key="view"
                        size="small"
                        icon={<EyeOutlined />}
                        onClick={() => onViewArtifact?.(build.id, artifact.name)}
                      >
                        View
                      </Button>
                    ]}
                  >
                    <List.Item.Meta
                      avatar={getArtifactIcon(artifact.type)}
                      title={artifact.name}
                      description={
                        <Space direction="vertical" size="small">
                          <Text type="secondary">
                            Type: {artifact.type} • Size: {formatFileSize(artifact.size)}
                          </Text>
                          {artifact.checksum && (
                            <Text code style={{ fontSize: '11px' }}>
                              SHA256: {artifact.checksum.algorithm}: {artifact.checksum.value}
                            </Text>
                          )}
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <Text type="secondary">No artifacts available</Text>
            )}
          </Card>
        </div>
      )
    },
    {
      key: 'logs',
      label: (
        <Space>
          <FileTextOutlined />
          Logs
        </Space>
      ),
      children: (
        <div style={{ padding: spacing.md }}>
          <Card title="Build Logs">
            {build.logs && build.logs.length > 0 ? (
              <div style={{
                backgroundColor: colors.background.secondary,
                padding: spacing.md,
                borderRadius: '4px',
                fontFamily: 'Monaco, Menlo, "Ubuntu Mono", monospace',
                fontSize: '12px',
                overflow: 'auto',
                maxHeight: '500px',
                whiteSpace: 'pre-wrap'
              }}>
                {build.logs.map(log => `[${log.timestamp}] ${log.level.toUpperCase()}: ${log.message}`).join('\n')}
              </div>
            ) : (
              <Text type="secondary">No logs available</Text>
            )}
          </Card>
        </div>
      )
    }
  ]

  return (
    <div style={{ 
      height: '100%',
      backgroundColor: colors.background.primary,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{
        padding: spacing.lg,
        borderBottom: `1px solid ${colors.border.light}`,
        backgroundColor: colors.background.secondary
      }}>
        <Space align="center" style={{ width: '100%', justifyContent: 'space-between' }}>
          <div>
            <Title level={4} style={{ margin: 0, color: colors.text.primary }}>
              Build Details
            </Title>
            <Text type="secondary">
              {build.configurationSnapshot?.name || 'Unknown Configuration'} • {build.id}
            </Text>
          </div>
          <Tag color={getStatusColor(build.status)} style={{ fontSize: '14px', padding: '4px 12px' }}>
            {build.status.toUpperCase()}
          </Tag>
        </Space>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          items={tabItems}
          style={{ height: '100%' }}
          tabBarStyle={{ 
            margin: 0, 
            padding: `0 ${spacing.lg}`,
            backgroundColor: colors.background.primary
          }}
        />
      </div>
    </div>
  )
}

export default BuildViewer 