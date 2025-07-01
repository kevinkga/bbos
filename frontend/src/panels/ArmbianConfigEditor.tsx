import React, { useState, useEffect, useCallback } from 'react'
import { Card, Button, Space, Typography, Alert, Spin, Tabs, Switch, notification, Tooltip, Badge, Modal } from 'antd'
import { 
  SaveOutlined, 
  ReloadOutlined, 
  ExportOutlined, 
  ImportOutlined,
  EyeOutlined,
  CodeOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  PlayCircleOutlined,
  BuildOutlined
} from '@ant-design/icons'
import Form from '@rjsf/antd'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema, UiSchema } from '@rjsf/utils'
import { IChangeEvent } from '@rjsf/core'
import { ArmbianConfiguration } from '@/types'
import { useSocket } from '@/hooks/useSocket'

const { Title, Text } = Typography

interface ArmbianConfigEditorProps {
  onSave?: (config: ArmbianConfiguration) => void
  onValidationChange?: (isValid: boolean, errors: any[]) => void
  initialConfig?: Partial<ArmbianConfiguration>
  readonly?: boolean
}

const ArmbianConfigEditor: React.FC<ArmbianConfigEditorProps> = ({
  onSave,
  onValidationChange,
  initialConfig,
  readonly = false
}) => {
  const [schema, setSchema] = useState<RJSFSchema | null>(null)
  const [uiSchema, setUiSchema] = useState<UiSchema>({})
  const [formData, setFormData] = useState<ArmbianConfiguration | null>(null)
  const [isValid, setIsValid] = useState(true)
  const [errors, setErrors] = useState<any[]>([])
  const [warnings, setWarnings] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)
  const [activeTab, setActiveTab] = useState('form')
  const [lastSaved, setLastSaved] = useState<Date | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [isBuilding, setIsBuilding] = useState(false)

  // Socket.io for build submission
  const { emit } = useSocket({
    autoConnect: true,
    onBuildUpdate: (build) => {
      console.log('🏗️ Build update in config editor:', build);
      if (isBuilding && build.status === 'completed') {
        setIsBuilding(false);
        notification.success({
          message: 'Build Completed',
          description: `Image build completed successfully! Check the Build Status panel for download links.`,
          placement: 'topRight',
          duration: 6
        });
      } else if (isBuilding && build.status === 'failed') {
        setIsBuilding(false);
        notification.error({
          message: 'Build Failed', 
          description: `Image build failed: ${build.message}`,
          placement: 'topRight'
        });
      }
    }
  })

  // Load Armbian schema from our schemas directory
  useEffect(() => {
    const loadSchema = async () => {
      try {
        setLoading(true)
        const response = await fetch('/schemas/armbian-configuration.schema.json')
        const schemaData = await response.json()
        setSchema(schemaData)
        
        // Set initial form data
        setFormData(initialConfig as ArmbianConfiguration || {
          board: '',
          distribution: 'bookworm',
          branch: 'current',
          bootEnvironment: {
            consoleInterface: 'serial',
            enableSsh: true,
            defaultCredentials: {
              username: 'armbian',
              password: ''
            }
          },
          storage: {
            filesystem: 'ext4',
            swapSize: 0
          },
          packages: {
            essential: [],
            additional: []
          },
          advanced: {
            compressionType: 'gz'
          }
        })
        
        // Configure UI schema for better form rendering
        setUiSchema({
          board: {
            'ui:title': 'Target Board',
            'ui:description': 'Select the target board for your Armbian image',
            'ui:widget': 'select'
          },
          distribution: {
            'ui:title': 'Distribution',
            'ui:description': 'Choose the base Linux distribution'
          },
          branch: {
            'ui:title': 'Kernel Branch',
            'ui:description': 'Select kernel branch (current, edge, legacy)'
          },
          bootEnvironment: {
            'ui:title': 'Boot Configuration',
            'ui:description': 'Configure boot and initial system settings',
            consoleInterface: {
              'ui:widget': 'radio'
            },
            enableSsh: {
              'ui:title': 'Enable SSH daemon',
              'ui:description': 'Allow remote SSH connections'
            },
            defaultCredentials: {
              'ui:title': 'Default User Account',
              password: {
                'ui:widget': 'password'
              }
            }
          },
          network: {
            'ui:title': 'Network Configuration',
            wifi: {
              'ui:title': 'WiFi Settings',
              networks: {
                'ui:title': 'Preconfigured Networks',
                items: {
                  password: {
                    'ui:widget': 'password'
                  }
                }
              }
            }
          },
          storage: {
            'ui:title': 'Storage Configuration',
            partitionLayout: {
              'ui:widget': 'radio'
            }
          },
          packages: {
            'ui:title': 'Package Selection',
            essential: {
              'ui:title': 'Essential Packages',
              'ui:description': 'Core packages required for basic functionality',
              'ui:widget': 'checkboxes'
            },
            additional: {
              'ui:title': 'Additional Packages',
              'ui:description': 'Optional packages to install',
              'ui:widget': 'textarea'
            }
          },
          customization: {
            'ui:title': 'System Customization',
            scripts: {
              'ui:title': 'Custom Scripts',
              firstBoot: {
                'ui:widget': 'textarea',
                'ui:options': {
                  rows: 10
                }
              },
              firstLogin: {
                'ui:widget': 'textarea',
                'ui:options': {
                  rows: 10
                }
              }
            }
          },
          advanced: {
            'ui:title': 'Advanced Options',
            'ui:collapsible': true,
            deviceTreeOverlays: {
              'ui:title': 'Device Tree Overlays',
              'ui:description': 'Enable hardware-specific features'
            }
          }
        })
      } catch (error) {
        console.error('Failed to load schema:', error)
      } finally {
        setLoading(false)
      }
    }

    loadSchema()
  }, [initialConfig])

  // Custom validation logic
  const validateConfiguration = useCallback((data: ArmbianConfiguration | null) => {
    const newWarnings: string[] = []
    
    if (data) {
      // Check for common configuration issues
      if (!data.board || !data.board.name) {
        newWarnings.push('No target board selected - this will prevent image generation')
      }
      
      // Check for weak user passwords
      if (data.users && data.users.length > 0) {
        const hasWeakPassword = data.users.some(user => 
          !user.password || user.password.length < 8
        )
        if (hasWeakPassword) {
          newWarnings.push('Weak or empty passwords are not recommended for security')
        }
      }
      
      // Check large package count
      if (data.packages?.install && data.packages.install.length > 50) {
        newWarnings.push('Large package count may significantly increase build time')
      }
      
      // Check swap size
      if (data.storage?.swapSize && data.storage.swapSize > 2048) {
        newWarnings.push('Large swap size may reduce image performance on low-memory devices')
      }
      
      // Check WiFi configuration
      if (data.network?.wifi?.enabled && (!data.network.wifi.ssid || !data.network.wifi.psk)) {
        newWarnings.push('WiFi is enabled but missing SSID or PSK credentials')
      }
      
      // Check SSH configuration
      if (data.ssh?.enabled && data.ssh.passwordAuth && data.ssh.rootLogin) {
        newWarnings.push('Root login with password authentication is a security risk')
      }
      
      // Check for missing essential configuration
      if (!data.distribution) {
        newWarnings.push('No distribution selected - this is required for image generation')
      }
    }
    
    return newWarnings
  }, [])

  const handleFormChange = useCallback((event: IChangeEvent<ArmbianConfiguration>) => {
    const newFormData = event.formData || null
    setFormData(newFormData)
    setErrors(event.errors || [])
    setHasUnsavedChanges(true)
    
    // Run custom validation
    const customWarnings = validateConfiguration(newFormData)
    setWarnings(customWarnings)
    
    const valid = !event.errors || event.errors.length === 0
    setIsValid(valid)
    onValidationChange?.(valid, event.errors || [])
  }, [onValidationChange, validateConfiguration])

  const handleSave = useCallback(async () => {
    if (!formData || !isValid) {
      notification.error({
        message: 'Save Failed',
        description: 'Cannot save invalid configuration. Please fix all errors first.',
        duration: 4
      })
      return
    }

    setSaving(true)
    try {
      // Ensure configuration has required metadata
      const configToSave: ArmbianConfiguration = {
        ...formData,
        id: formData.id || crypto.randomUUID(),
        userId: formData.userId || 'current-user',
        name: formData.name || `Configuration ${new Date().toISOString()}`,
        updatedAt: new Date().toISOString(),
        version: (formData.version || 0) + 1
      }

      // If this is a new configuration, set creation time
      if (!formData.createdAt) {
        configToSave.createdAt = new Date().toISOString()
      }

      // Update form data with the enhanced config
      setFormData(configToSave)

      await onSave?.(configToSave)
      setLastSaved(new Date())
      setHasUnsavedChanges(false)
      
      notification.success({
        message: 'Configuration Saved',
        description: `"${configToSave.name}" saved successfully (v${configToSave.version})`,
        duration: 3
      })
      
      // Show warnings if any
      if (warnings.length > 0) {
        notification.warning({
          message: 'Configuration Warnings',
          description: `Saved with ${warnings.length} warning(s). Review configuration before building.`,
          duration: 5
        })
      }
    } catch (error) {
      notification.error({
        message: 'Save Failed',
        description: 'Failed to save configuration. Please try again.',
        duration: 4
      })
      console.error('Save error:', error)
    } finally {
      setSaving(false)
    }
  }, [formData, isValid, onSave, warnings])

  // Auto-save functionality
  useEffect(() => {
    if (hasUnsavedChanges && formData && isValid) {
      const autoSaveTimer = setTimeout(() => {
        console.log('Auto-saving configuration...')
        // Save as draft in localStorage
        const draftKey = `bbos-draft-${formData.id || 'new'}`
        localStorage.setItem(draftKey, JSON.stringify({
          ...formData,
          savedAt: new Date().toISOString(),
          isDraft: true
        }))
      }, 30000) // Auto-save after 30 seconds of inactivity

      return () => clearTimeout(autoSaveTimer)
    }
  }, [hasUnsavedChanges, formData, isValid])

  const handleExport = useCallback(() => {
    if (formData) {
      const dataStr = JSON.stringify(formData, null, 2)
      const dataBlob = new Blob([dataStr], { type: 'application/json' })
      const url = URL.createObjectURL(dataBlob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'armbian-config.json'
      link.click()
      URL.revokeObjectURL(url)
    }
  }, [formData])

  const handleImport = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (file) {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const config = JSON.parse(e.target?.result as string)
            setFormData(config)
          } catch (error) {
            console.error('Failed to parse config file:', error)
          }
        }
        reader.readAsText(file)
      }
    }
    input.click()
  }, [])

  // Build submission function
  const handleBuildSubmission = useCallback(() => {
    if (!formData || !isValid) {
      notification.warning({
        message: 'Configuration Invalid',
        description: 'Please fix all validation errors before starting a build.',
        placement: 'topRight'
      });
      return;
    }

    if (!formData.board?.name || !formData.distribution?.release) {
      notification.warning({
        message: 'Missing Required Fields',
        description: 'Please select a target board and distribution before building.',
        placement: 'topRight'
      });
      return;
    }

    // Show confirmation modal
    Modal.confirm({
      title: 'Start Armbian Build',
      content: (
        <div>
          <p>This will start building an Armbian image with the following configuration:</p>
          <ul>
            <li><strong>Board:</strong> {formData.board.name}</li>
            <li><strong>Distribution:</strong> {formData.distribution.release}</li>
            <li><strong>Type:</strong> {formData.distribution.type}</li>
            {formData.distribution.desktop && (
              <li><strong>Desktop:</strong> {formData.distribution.desktop}</li>
            )}
          </ul>
          <p>The build process may take 10-30 minutes depending on complexity.</p>
        </div>
      ),
      okText: 'Start Build',
      cancelText: 'Cancel',
      onOk() {
        setIsBuilding(true);
        
        // Submit build job via Socket.io
        emit('build:submit', {
          configuration: formData,
          userId: 'current-user' // TODO: Get from auth context
        });

        notification.info({
          message: 'Build Started',
          description: 'Your Armbian image build has been queued. You can monitor progress in the Build Status panel.',
          placement: 'topRight',
          duration: 4
        });
      }
    });
  }, [formData, isValid, emit])

  const formProps = {
    schema: schema || {},
    uiSchema,
    formData: formData || {},
    validator,
    onChange: handleFormChange,
    disabled: readonly || previewMode,
    showErrorList: "top" as const,
    liveValidate: true,
    autoComplete: 'off'
  }

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Spin size="large" />
      </div>
    )
  }

  if (!schema) {
    return (
      <div className="h-full p-4">
        <Alert
          message="Schema Loading Error"
          description="Failed to load the Armbian configuration schema. Please refresh the page."
          type="error"
          showIcon
        />
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex-shrink-0 p-4 border-b bg-white">
        <div className="flex items-center justify-between">
          <div>
            <Title level={4} className="mb-1">
              Armbian Configuration Editor
            </Title>
            <Space>
              {/* Validation Status */}
              <Space direction="vertical" size={0}>
                <Text type="secondary">
                  {isValid ? (
                    <><CheckCircleOutlined className="text-green-500 mr-1" />Valid Configuration</>
                  ) : (
                    <><ExclamationCircleOutlined className="text-red-500 mr-1" />{errors.length} Error(s)</>
                  )}
                </Text>
                {warnings.length > 0 && (
                  <Tooltip title={warnings.join('; ')}>
                    <Text type="warning" className="text-xs">
                      <WarningOutlined className="mr-1" />
                      {warnings.length} Warning(s)
                    </Text>
                  </Tooltip>
                )}
              </Space>
              
              {/* Save Status */}
              {lastSaved && (
                <Tooltip title={`Last saved: ${lastSaved.toLocaleString()}`}>
                  <Text type="secondary" className="text-xs">
                    <InfoCircleOutlined className="mr-1" />
                    {hasUnsavedChanges ? 'Unsaved changes' : 'Saved'}
                  </Text>
                </Tooltip>
              )}
              
              {/* Preview Mode Toggle */}
              <Space>
                <Switch
                  checkedChildren={<EyeOutlined />}
                  unCheckedChildren={<CodeOutlined />}
                  checked={previewMode}
                  onChange={setPreviewMode}
                  disabled={readonly}
                />
                <Text type="secondary">Preview Mode</Text>
              </Space>
            </Space>
          </div>
          <Space>
            <Button 
              icon={<ImportOutlined />} 
              onClick={handleImport}
              disabled={readonly}
            >
              Import
            </Button>
            <Button 
              icon={<ExportOutlined />} 
              onClick={handleExport}
              disabled={!formData}
            >
              Export
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => window.location.reload()}
            >
              Reset
            </Button>
            <Badge count={warnings.length} size="small" color="orange">
              <Button 
                type="primary" 
                icon={<SaveOutlined />} 
                onClick={handleSave}
                loading={saving}
                disabled={!isValid || readonly || saving}
              >
                {saving ? 'Saving...' : 'Save Configuration'}
              </Button>
            </Badge>
            <Button 
              type="primary"
              danger
              icon={<BuildOutlined />} 
              onClick={handleBuildSubmission}
              loading={isBuilding}
              disabled={!isValid || readonly || isBuilding || !formData?.board?.name || !formData?.distribution?.release}
            >
              {isBuilding ? 'Building...' : 'Build Image'}
            </Button>
          </Space>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          className="h-full"
          items={[
            {
              key: 'form',
              label: 'Visual Editor',
              children: (
                <div className="h-full overflow-auto p-4">
                  <Card>
                    <Form {...formProps} />
                  </Card>
                </div>
              )
            },
            {
              key: 'json',
              label: 'JSON View',
              children: (
                <div className="h-full overflow-auto p-4">
                  <Card>
                    <pre className="bg-gray-50 p-4 rounded text-sm overflow-auto">
                      {JSON.stringify(formData, null, 2)}
                    </pre>
                  </Card>
                </div>
              )
            },
            {
              key: 'validation',
              label: `Validation ${!isValid ? `(${errors.length})` : ''}`,
              children: (
                <div className="h-full overflow-auto p-4">
                  <Card>
                    {isValid ? (
                      <Alert
                        message="Configuration Valid"
                        description="Your configuration passes all validation checks."
                        type="success"
                        showIcon
                      />
                    ) : (
                      <div>
                        <Alert
                          message="Validation Errors"
                          description={`Found ${errors.length} validation error(s). Please review and fix them.`}
                          type="error"
                          showIcon
                          className="mb-4"
                        />
                        {errors.map((error, index) => (
                          <Alert
                            key={index}
                            message={error.message}
                            description={`Path: ${error.schemaPath || error.instancePath || 'root'}`}
                            type="warning"
                            className="mb-2"
                          />
                        ))}
                      </div>
                    )}
                  </Card>
                </div>
              )
            }
          ]}
        />
      </div>
    </div>
  )
}

export default ArmbianConfigEditor 