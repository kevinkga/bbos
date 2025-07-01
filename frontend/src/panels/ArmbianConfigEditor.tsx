import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, Button, Typography, Space, Divider, message } from 'antd'
import { SaveOutlined, SettingOutlined, InfoCircleOutlined, ReloadOutlined } from '@ant-design/icons'
import Form from '@rjsf/antd'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema, ErrorSchema } from '@rjsf/utils'
import { ArmbianConfiguration } from '@/types'
import { colors, components, spacing } from '@/styles/design-tokens'

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
  const [formData, setFormData] = useState<any>(initialConfig || {
    name: 'New Configuration',
    board: {
      family: 'rockchip64',
      name: 'rock-5b',
      architecture: 'arm64'
    },
    distribution: {
      release: 'bookworm',
      type: 'minimal'
    }
  })
  const [isValid, setIsValid] = useState(true)
  const [errors, setErrors] = useState<ErrorSchema>({})

  // Update form data when initialConfig changes (when a different configuration is selected)
  useEffect(() => {
    if (initialConfig) {
      setFormData(initialConfig)
      setErrors({})
      setIsValid(true)
      console.log('Configuration updated in editor:', initialConfig)
    }
  }, [initialConfig])

  // Armbian Configuration Schema
  const schema: RJSFSchema = useMemo(() => ({
    type: 'object',
    title: 'Armbian Configuration',
    properties: {
      name: {
        type: 'string',
        title: 'Configuration Name',
        description: 'A descriptive name for this configuration',
        minLength: 1,
        maxLength: 100
      },
      description: {
        type: 'string',
        title: 'Description',
        description: 'Optional description of what this configuration is for',
        maxLength: 500
      },
      board: {
        type: 'object',
        title: 'Board Configuration',
        properties: {
          family: {
            type: 'string',
            title: 'Board Family',
            enum: ['rockchip64', 'sunxi', 'meson64', 'rk35xx', 'bcm2711', 'odroidxu4'],
            enumNames: ['Rockchip 64-bit', 'Allwinner (Sunxi)', 'Amlogic 64-bit', 'Rockchip RK35xx', 'Broadcom BCM2711', 'Odroid XU4']
          },
          name: {
            type: 'string',
            title: 'Board Name',
            description: 'Specific board model (e.g., rock-5b, orangepi5)'
          },
          architecture: {
            type: 'string',
            title: 'Architecture',
            enum: ['arm64', 'armhf', 'x86'],
            enumNames: ['ARM 64-bit', 'ARM 32-bit', 'x86']
          }
        },
        required: ['family', 'name', 'architecture']
      },
      distribution: {
        type: 'object',
        title: 'Distribution Settings',
        properties: {
          release: {
            type: 'string',
            title: 'OS Release',
            enum: ['bookworm', 'bullseye', 'jammy', 'noble'],
            enumNames: ['Debian Bookworm', 'Debian Bullseye', 'Ubuntu Jammy', 'Ubuntu Noble']
          },
          type: {
            type: 'string',
            title: 'Image Type',
            enum: ['minimal', 'desktop', 'server'],
            enumNames: ['Minimal', 'Desktop', 'Server']
          },
          desktop: {
            type: 'string',
            title: 'Desktop Environment',
            enum: ['gnome', 'kde', 'xfce', 'cinnamon', 'mate'],
            enumNames: ['GNOME', 'KDE Plasma', 'XFCE', 'Cinnamon', 'MATE']
          }
        },
        required: ['release', 'type']
      },
      network: {
        type: 'object',
        title: 'Network Configuration',
        properties: {
          hostname: {
            type: 'string',
            title: 'Hostname',
            description: 'System hostname',
            pattern: '^[a-zA-Z0-9][a-zA-Z0-9-]{0,61}[a-zA-Z0-9]$'
          },
          wifi: {
            type: 'object',
            title: 'Wi-Fi Settings',
            properties: {
              enabled: {
                type: 'boolean',
                title: 'Enable Wi-Fi',
                default: false
              },
              ssid: {
                type: 'string',
                title: 'Network Name (SSID)'
              },
              psk: {
                type: 'string',
                title: 'Password'
              },
              country: {
                type: 'string',
                title: 'Country Code',
                pattern: '^[A-Z]{2}$',
                description: 'Two-letter country code (e.g., US, GB, DE)'
              }
            }
          }
        }
      },
      users: {
        type: 'array',
        title: 'User Accounts',
        items: {
          type: 'object',
          properties: {
            username: {
              type: 'string',
              title: 'Username',
              pattern: '^[a-z_][a-z0-9_-]*[$]?$'
            },
            password: {
              type: 'string',
              title: 'Password'
            },
            sudo: {
              type: 'boolean',
              title: 'Sudo Access',
              default: false
            },
            shell: {
              type: 'string',
              title: 'Default Shell',
              enum: ['/bin/bash', '/bin/zsh', '/bin/sh'],
              default: '/bin/bash'
            }
          },
          required: ['username']
        }
      },
      ssh: {
        type: 'object',
        title: 'SSH Configuration',
        properties: {
          enabled: {
            type: 'boolean',
            title: 'Enable SSH',
            default: true
          },
          port: {
            type: 'integer',
            title: 'SSH Port',
            minimum: 1,
            maximum: 65535,
            default: 22
          },
          passwordAuth: {
            type: 'boolean',
            title: 'Allow Password Authentication',
            default: false
          },
          rootLogin: {
            type: 'boolean',
            title: 'Allow Root Login',
            default: false
          }
        }
      },
      packages: {
        type: 'object',
        title: 'Package Management',
        properties: {
          install: {
            type: 'array',
            title: 'Packages to Install',
            items: {
              type: 'string'
            },
            description: 'List of package names to install'
          },
          remove: {
            type: 'array',
            title: 'Packages to Remove',
            items: {
              type: 'string'
            },
            description: 'List of package names to remove'
          }
        }
      }
    },
    required: ['name', 'board', 'distribution']
  }), [])

  // UI Schema for better presentation
  const uiSchema = useMemo(() => ({
    name: {
      'ui:placeholder': 'Enter a descriptive name for your configuration'
    },
    description: {
      'ui:widget': 'textarea',
      'ui:placeholder': 'Describe what this configuration is used for...',
      'ui:options': {
        rows: 3
      }
    },
    board: {
      'ui:title': '🔧 Board Configuration',
      'ui:description': 'Select your target hardware platform',
      name: {
        'ui:placeholder': 'e.g., rock-5b, orangepi5, nanopi-m4'
      }
    },
    distribution: {
      'ui:title': '💿 Distribution Settings',
      'ui:description': 'Choose your operating system and image type',
      desktop: {
        'ui:help': 'Only shown when Desktop type is selected'
      }
    },
    network: {
      'ui:title': '🌐 Network Configuration',
      'ui:description': 'Configure network settings for your device',
      hostname: {
        'ui:placeholder': 'my-armbian-device'
      },
      wifi: {
        ssid: {
          'ui:placeholder': 'My WiFi Network'
        },
        psk: {
          'ui:widget': 'password',
          'ui:placeholder': 'WiFi password'
        },
        country: {
          'ui:placeholder': 'US'
        }
      }
    },
    users: {
      'ui:title': '👥 User Accounts',
      'ui:description': 'Create user accounts for your system',
      items: {
        username: {
          'ui:placeholder': 'username'
        },
        password: {
          'ui:widget': 'password',
          'ui:placeholder': 'secure password'
        }
      }
    },
    ssh: {
      'ui:title': '🔐 SSH Configuration',
      'ui:description': 'Configure SSH access to your device'
    },
    packages: {
      'ui:title': '📦 Package Management',
      'ui:description': 'Customize which packages are installed',
      install: {
        items: {
          'ui:placeholder': 'package-name'
        }
      },
      remove: {
        items: {
          'ui:placeholder': 'package-name'
        }
      }
    }
  }), [])

  const handleChange = useCallback((e: any) => {
    setFormData(e.formData)
    setErrors(e.errors || {})
    const hasErrors = Object.keys(e.errors || {}).length > 0
    setIsValid(!hasErrors)
    // Convert ErrorSchema to array format for callback
    const errorArray = Object.values(e.errors || {}).flat()
    onValidationChange?.(!hasErrors, errorArray)
  }, [onValidationChange])

  const handleSubmit = useCallback((e: any) => {
    if (isValid) {
      const config: ArmbianConfiguration = {
        ...e.formData,
        id: initialConfig?.id || crypto.randomUUID(),
        userId: initialConfig?.userId || 'current-user',
        createdAt: initialConfig?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        version: (initialConfig?.version || 0) + 1
      }
      onSave?.(config)
      message.success('Configuration saved successfully!')
    }
  }, [isValid, onSave, initialConfig])

  const handleReset = useCallback(() => {
    setFormData(initialConfig || {})
    setErrors({})
    setIsValid(true)
    message.info('Form reset to initial values')
  }, [initialConfig])

  return (
    <div 
      className="h-full flex flex-col bbos-config-editor-wrapper"
      style={{ 
        backgroundColor: colors.background.secondary,
        padding: spacing.lg,
        // Override any inherited styles that might cause color conflicts
        color: colors.text.primary,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
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

        {/* Validation Status */}
        <div 
          style={{
            marginTop: spacing.lg,
            display: 'flex',
            alignItems: 'center',
            gap: spacing.sm
          }}
        >
          <InfoCircleOutlined 
            style={{ 
              color: isValid ? colors.success[500] : colors.error[500],
              fontSize: '16px'
            }} 
          />
          <Text 
            style={{ 
              color: isValid ? colors.success[600] : colors.error[600],
              fontSize: '13px',
              fontWeight: 500
            }}
          >
            {isValid ? 'Configuration is valid' : 'Please fix validation errors'}
          </Text>
        </div>
      </div>

      {/* Form Content */}
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
            padding: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column'
          }}
        >
          {/* RJSF Form */}
          <div 
            style={{
              flex: 1,
              overflow: 'auto',
              padding: spacing.xl
            }}
          >
            <Form
              schema={schema}
              uiSchema={uiSchema}
              formData={formData}
              validator={validator}
              onChange={handleChange}
              onSubmit={handleSubmit}
              disabled={readonly}
              showErrorList="top"
              liveValidate={true}
              formContext={{
                descriptionLocation: 'tooltip',
                readonlyAsDisabled: false
              }}
              className="bbos-rjsf-form"
            >
              {/* Custom submit button - hidden since we have our own */}
              <div style={{ display: 'none' }}>
                <button type="submit">Submit</button>
              </div>
            </Form>
          </div>

          <Divider style={{ borderColor: colors.border.light, margin: 0 }} />

          {/* Actions */}
          <div 
            style={{ 
              display: 'flex', 
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: spacing.xl,
              backgroundColor: colors.background.secondary
            }}
          >
            <Text 
              style={{ 
                color: colors.text.tertiary,
                fontSize: '12px'
              }}
            >
              Changes are automatically validated as you type
            </Text>
            
            <Space>
              <Button 
                icon={<ReloadOutlined />}
                onClick={handleReset}
                disabled={readonly}
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
                onClick={() => handleSubmit({ formData })}
                disabled={readonly || !isValid}
                style={{
                  backgroundColor: colors.accent[500],
                  borderColor: colors.accent[500],
                  color: colors.text.inverse
                }}
              >
                Save Configuration
              </Button>
            </Space>
          </div>
        </Card>
      </div>
    </div>
  )
}

export default ArmbianConfigEditor 