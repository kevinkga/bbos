import React from 'react'
import { Card, Button, Space, Typography, List, Divider } from 'antd'
import { 
  RocketOutlined, 
  FileTextOutlined, 
  HistoryOutlined, 
  SettingOutlined,
  GithubOutlined,
  BookOutlined,
  BuildOutlined
} from '@ant-design/icons'

const { Title, Paragraph, Text } = Typography

interface WelcomePanelProps {
  onCreateNewConfig?: () => void
  onOpenConfig?: () => void
  onViewDocs?: () => void
}

const WelcomePanel: React.FC<WelcomePanelProps> = ({
  onCreateNewConfig,
  onOpenConfig,
  onViewDocs
}) => {
  const quickActions = [
    {
      title: 'Create New Configuration',
      description: 'Start building a new Armbian image configuration',
      icon: <RocketOutlined />,
      action: onCreateNewConfig,
      color: '#1890ff'
    },
    {
      title: 'Open Configuration',
      description: 'Load an existing configuration file',
      icon: <FileTextOutlined />,
      action: onOpenConfig,
      color: '#52c41a'
    },
    {
      title: 'View Documentation',
      description: 'Learn about Armbian configuration options',
      icon: <BookOutlined />,
      action: onViewDocs,
      color: '#722ed1'
    }
  ]

  const recentConfigs: { name: string; modified: string; board: string }[] = [
    { name: 'OrangePi Zero 2W Config', modified: '2 hours ago', board: 'orangepizero2w' },
    { name: 'Raspberry Pi 4B Setup', modified: '1 day ago', board: 'rpi4b' },
    { name: 'BeagleBone Black Config', modified: '3 days ago', board: 'beagleboneblack' }
  ]

  const features: string[] = [
    'Visual configuration builder with live validation',
    'Real-time build monitoring and logs',
    'Comprehensive Armbian board support',
    'Cloud-based build execution',
    'Configuration version control',
    'Export to multiple formats'
  ]

  return (
    <div className="h-full overflow-auto p-6 bg-gray-50">
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center mb-8">
          <Title level={1} className="mb-2">
            <BuildOutlined className="mr-3 text-blue-600" />
            Welcome to BBOS
          </Title>
          <Paragraph className="text-lg text-gray-600">
            Cloud-based IoT Platform for Armbian Image Configuration
          </Paragraph>
        </div>

        {/* Quick Actions */}
        <Card title="Quick Actions" className="mb-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {quickActions.map((action, index) => (
              <Card
                key={index}
                hoverable
                className="text-center transition-all duration-200 hover:shadow-lg"
                onClick={action.action}
                style={{ borderColor: action.color }}
              >
                <div className="py-4">
                  <div 
                    className="text-4xl mb-3"
                    style={{ color: action.color }}
                  >
                    {action.icon}
                  </div>
                  <Title level={4} className="mb-2">
                    {action.title}
                  </Title>
                  <Paragraph className="text-gray-600 mb-0">
                    {action.description}
                  </Paragraph>
                </div>
              </Card>
            ))}
          </div>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Configurations */}
          <Card title="Recent Configurations" extra={<Button type="link">View All</Button>}>
            <List
              dataSource={recentConfigs}
              renderItem={(config: { name: string; modified: string; board: string }) => (
                <List.Item className="hover:bg-gray-50 px-2 rounded cursor-pointer">
                  <List.Item.Meta
                    avatar={<SettingOutlined className="text-blue-500" />}
                    title={<Text strong>{config.name}</Text>}
                    description={
                      <Space>
                        <Text type="secondary">{config.board}</Text>
                        <Divider type="vertical" />
                        <Text type="secondary">{config.modified}</Text>
                      </Space>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          {/* Features */}
          <Card title="Platform Features">
            <List
              dataSource={features}
              renderItem={(feature: string) => (
                <List.Item className="py-2">
                  <List.Item.Meta
                    avatar={<RocketOutlined className="text-green-500" />}
                    description={feature}
                  />
                </List.Item>
              )}
            />
          </Card>
        </div>

        {/* Getting Started */}
        <Card title="Getting Started">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Title level={4}>
                <FileTextOutlined className="mr-2" />
                For Beginners
              </Title>
              <Paragraph>
                New to Armbian? Start with our guided configuration wizard that will 
                walk you through creating your first image configuration step by step.
              </Paragraph>
              <Button type="primary" icon={<RocketOutlined />}>
                Start Guided Setup
              </Button>
            </div>
            <div>
              <Title level={4}>
                <HistoryOutlined className="mr-2" />
                For Advanced Users
              </Title>
              <Paragraph>
                Import existing configurations, use advanced features like custom scripts,
                device tree overlays, and build automation workflows.
              </Paragraph>
              <Button icon={<SettingOutlined />}>
                Advanced Configuration
              </Button>
            </div>
          </div>
        </Card>

        {/* Resources */}
        <Card title="Resources & Documentation">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <BookOutlined className="text-3xl text-blue-500 mb-2" />
              <Title level={5}>Documentation</Title>
              <Paragraph>
                Comprehensive guides and API reference
              </Paragraph>
              <Button type="link">View Docs</Button>
            </div>
            <div className="text-center">
              <GithubOutlined className="text-3xl text-gray-800 mb-2" />
              <Title level={5}>Source Code</Title>
              <Paragraph>
                Open source project on GitHub
              </Paragraph>
              <Button type="link">View Repository</Button>
            </div>
            <div className="text-center">
              <BuildOutlined className="text-3xl text-green-500 mb-2" />
              <Title level={5}>Examples</Title>
              <Paragraph>
                Sample configurations and templates
              </Paragraph>
              <Button type="link">Browse Examples</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default WelcomePanel 