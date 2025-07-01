import React from 'react'
import { Card, Button, Typography, Space, Divider } from 'antd'
import { SaveOutlined, SettingOutlined, InfoCircleOutlined } from '@ant-design/icons'
import { ArmbianConfiguration } from '@/types'
import { colors, components, spacing } from '@/styles/design-tokens'

const { Title, Text } = Typography

interface ArmbianConfigEditorProps {
  onSave?: (config: ArmbianConfiguration) => void
  onValidationChange?: (isValid: boolean, errors: any[]) => void
  initialConfig?: Partial<ArmbianConfiguration>
  readonly?: boolean
}

const ArmbianConfigEditor: React.FC<ArmbianConfigEditorProps> = () => {
  console.log('ArmbianConfigEditor rendering...')
  
  return (
    <div 
      className="h-full flex flex-col"
      style={{ 
        backgroundColor: colors.background.secondary,
        padding: spacing.lg
      }}
    >
      {/* Header Section */}
      <div 
        style={{ 
          backgroundColor: colors.background.primary,
          border: `1px solid ${colors.border.light}`,
          borderRadius: '8px',
          padding: spacing.xl,
          marginBottom: spacing.lg,
          boxShadow: components.panel.shadow
        }}
      >
        <Space align="start" size="middle">
          <div 
            style={{
              backgroundColor: colors.accent[50],
              padding: spacing.md,
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <SettingOutlined 
              style={{ 
                fontSize: '20px', 
                color: colors.accent[600] 
              }} 
            />
          </div>
          <div>
            <Title 
              level={3} 
              style={{ 
                margin: 0,
                marginBottom: spacing.xs,
                color: colors.text.primary,
                fontWeight: 600
              }}
            >
              Armbian Configuration Editor
            </Title>
            <Text 
              style={{ 
                color: colors.text.secondary,
                fontSize: '14px'
              }}
            >
              Configure your Armbian image settings using an intuitive form interface
            </Text>
          </div>
        </Space>
      </div>

      {/* Content Area */}
      <div className="flex-1">
        <Card
          style={{
            backgroundColor: colors.background.primary,
            border: `1px solid ${colors.border.light}`,
            borderRadius: '8px',
            height: '100%',
            boxShadow: components.panel.shadow
          }}
          bodyStyle={{
            padding: spacing.xl,
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* Status Info */}
          <div 
            style={{
              backgroundColor: colors.accent[50],
              border: `1px solid ${colors.accent[200]}`,
              borderRadius: '6px',
              padding: spacing.lg,
              marginBottom: spacing.xl,
              display: 'flex',
              alignItems: 'center',
              gap: spacing.md
            }}
          >
            <InfoCircleOutlined 
              style={{ 
                color: colors.accent[600],
                fontSize: '16px'
              }} 
            />
            <div>
              <Text 
                strong 
                style={{ 
                  color: colors.accent[800],
                  display: 'block',
                  marginBottom: '2px'
                }}
              >
                Editor Status: Ready
              </Text>
              <Text 
                style={{ 
                  color: colors.accent[600],
                  fontSize: '13px'
                }}
              >
                The sophisticated JSON Schema form will be implemented here. Component is rendering successfully with proper styling.
              </Text>
            </div>
          </div>

          {/* Form Placeholder */}
          <div 
            className="flex-1 flex items-center justify-center"
            style={{
              backgroundColor: colors.background.tertiary,
              border: `2px dashed ${colors.border.default}`,
              borderRadius: '8px',
              minHeight: '200px'
            }}
          >
            <div style={{ textAlign: 'center' }}>
              <SettingOutlined 
                style={{ 
                  fontSize: '48px', 
                  color: colors.text.muted,
                  marginBottom: spacing.lg
                }} 
              />
              <Title 
                level={4} 
                style={{ 
                  color: colors.text.secondary,
                  fontWeight: 500,
                  marginBottom: spacing.sm
                }}
              >
                Configuration Form Coming Soon
              </Title>
              <Text 
                style={{ 
                  color: colors.text.tertiary,
                  fontSize: '14px'
                }}
              >
                React JSON Schema Form (RJSF) with Armbian configuration schema
              </Text>
            </div>
          </div>

          <Divider style={{ borderColor: colors.border.light }} />

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: spacing.md }}>
            <Button 
              type="default"
              style={{
                borderColor: colors.border.default,
                color: colors.text.secondary
              }}
            >
              Reset
            </Button>
            <Button 
              type="primary" 
              icon={<SaveOutlined />}
              style={{
                backgroundColor: colors.accent[500],
                borderColor: colors.accent[500],
                color: colors.text.inverse
              }}
            >
              Save Configuration
            </Button>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ArmbianConfigEditor 