import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, Button, Typography, Space, Divider, message, Modal, Tabs, Steps, Progress, Row, Col, Alert } from 'antd'
import { SaveOutlined, SettingOutlined, InfoCircleOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, FormOutlined } from '@ant-design/icons'
import Form from '@rjsf/antd'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema, ErrorSchema, UiSchema } from '@rjsf/utils'
import { ArmbianConfiguration } from '@/types'
import { colors, components, spacing } from '@/styles/design-tokens'

const { Title, Text } = Typography
const { TabPane } = Tabs

interface ArmbianConfigEditorProps {
  onSave?: (config: ArmbianConfiguration) => void
  onValidationChange?: (isValid: boolean, errors: any[]) => void
  initialConfig?: Partial<ArmbianConfiguration>
  readonly?: boolean
  onDelete?: (configId: string) => void
}

// Wizard step definitions
interface WizardStep {
  key: string
  title: string
  description: string
  icon: React.ReactNode
  schema: any
  uiSchema: UiSchema
  requiredFields?: string[]
}

const ArmbianConfigEditor: React.FC<ArmbianConfigEditorProps> = ({
  onSave,
  onValidationChange,
  initialConfig,
  readonly = false,
  onDelete
}) => {
  const [activeTab, setActiveTab] = useState<string>('form')
  const [currentStep, setCurrentStep] = useState(0)
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
  const [stepValidation, setStepValidation] = useState<boolean[]>([])

  // Update form data when initialConfig changes (when a different configuration is selected)
  useEffect(() => {
    if (initialConfig) {
      setFormData(initialConfig)
      setErrors({})
      setIsValid(true)
      console.log('Configuration updated in editor:', initialConfig)
    }
  }, [initialConfig])

  // Wizard steps configuration
  const wizardSteps: WizardStep[] = useMemo(() => [
    {
      key: 'basic',
      title: 'Basic Information',
      description: 'Configure name and description',
      icon: <FormOutlined />,
      schema: {
        type: 'object',
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
          }
        },
        required: ['name']
      },
      uiSchema: {
        name: {
          'ui:placeholder': 'Enter a descriptive name for your configuration',
          'ui:help': 'This name will help you identify the configuration later'
        },
        description: {
          'ui:widget': 'textarea',
          'ui:placeholder': 'Describe what this configuration is used for...',
          'ui:options': { rows: 4 }
        }
      },
      requiredFields: ['name']
    },
    {
      key: 'hardware',
      title: 'Hardware Platform',
      description: 'Select your target hardware',
      icon: <SettingOutlined />,
      schema: {
        type: 'object',
        properties: {
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
          }
        },
        required: ['board']
      },
      uiSchema: {
        board: {
          'ui:title': '🔧 Hardware Configuration',
          'ui:description': 'Select your target hardware platform carefully - this affects all other options',
          name: {
            'ui:placeholder': 'e.g., rock-5b, orangepi5, nanopi-m4',
            'ui:help': 'Check Armbian documentation for supported board names'
          }
        }
      },
      requiredFields: ['board.family', 'board.name', 'board.architecture']
    },
    {
      key: 'system',
      title: 'System Configuration',
      description: 'Choose OS and image type',
      icon: <SettingOutlined />,
      schema: {
        type: 'object',
        properties: {
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
          }
        },
        required: ['distribution']
      },
      uiSchema: {
        distribution: {
          'ui:title': '💿 Distribution Settings',
          'ui:description': 'Choose your operating system and image type',
          desktop: {
            'ui:help': 'Only shown when Desktop type is selected'
          }
        }
      },
      requiredFields: ['distribution.release', 'distribution.type']
    },
    {
      key: 'network',
      title: 'Network Setup',
      description: 'Configure network settings',
      icon: <SettingOutlined />,
      schema: {
        type: 'object',
        properties: {
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
          }
        }
      },
      uiSchema: {
        network: {
          'ui:title': '🌐 Network Configuration',
          'ui:description': 'Configure network settings for your device',
          hostname: {
            'ui:placeholder': 'my-armbian-device',
            'ui:help': 'Use lowercase letters, numbers, and hyphens only'
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
        }
      }
    },
    {
      key: 'users',
      title: 'Users & Security',
      description: 'Setup user accounts and SSH',
      icon: <SettingOutlined />,
      schema: {
        type: 'object',
        properties: {
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
          }
        }
      },
      uiSchema: {
        users: {
          'ui:title': '👥 User Accounts',
          'ui:description': 'Create user accounts for your system',
          items: {
            username: {
              'ui:placeholder': 'username',
              'ui:help': 'Lowercase letters, numbers, underscores, and hyphens only'
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
        }
      }
    },
    {
      key: 'packages',
      title: 'Package Management',
      description: 'Customize installed software',
      icon: <SettingOutlined />,
      schema: {
        type: 'object',
        properties: {
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
        }
      },
      uiSchema: {
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
      }
    }
  ], [])

  // Armbian Configuration Schema (for traditional form view)
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

  // UI Schema for better presentation (traditional form)
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

  // Calculate wizard progress
  const progress = useMemo(() => {
    return Math.round(((currentStep + 1) / wizardSteps.length) * 100)
  }, [currentStep, wizardSteps.length])

  // Validate current step
  const validateCurrentStep = useCallback((stepData: any, stepSchema: any): boolean => {
    try {
      return validator.isValid(stepSchema, stepData, stepSchema)
    } catch (error) {
      console.error('Validation error:', error)
      return false
    }
  }, [])

  const handleChange = useCallback((e: any) => {
    setFormData(e.formData)
    setErrors(e.errors || {})
    const hasErrors = Object.keys(e.errors || {}).length > 0
    setIsValid(!hasErrors)
    // Convert ErrorSchema to array format for callback
    const errorArray = Object.values(e.errors || {}).flat()
    onValidationChange?.(!hasErrors, errorArray)
  }, [onValidationChange])

  const handleWizardChange = useCallback((e: any) => {
    const newFormData = { ...formData, ...e.formData }
    setFormData(newFormData)
    
    // Validate current step
    const currentStepConfig = wizardSteps[currentStep]
    const isStepValid = validateCurrentStep(e.formData, currentStepConfig.schema)
    
    // Update step validation
    const newStepValidation = [...stepValidation]
    newStepValidation[currentStep] = isStepValid
    setStepValidation(newStepValidation)
  }, [formData, currentStep, wizardSteps, validateCurrentStep, stepValidation])

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
    setCurrentStep(0)
    setStepValidation([])
    message.info('Form reset to initial values')
  }, [initialConfig])

  const handleDelete = useCallback(() => {
    if (!initialConfig?.id) {
      message.error('Cannot delete: No configuration ID found')
      return
    }

    Modal.confirm({
      title: 'Delete Configuration',
      content: `Are you sure you want to delete "${initialConfig.name || 'this configuration'}"? This action cannot be undone.`,
      okText: 'Delete',
      okType: 'danger',
      cancelText: 'Cancel',
      onOk() {
        onDelete?.(initialConfig.id!)
        message.success('Configuration deleted successfully')
      }
    })
  }, [initialConfig, onDelete])

  const nextStep = useCallback(() => {
    if (currentStep < wizardSteps.length - 1) {
      setCurrentStep(currentStep + 1)
    }
  }, [currentStep, wizardSteps.length])

  const prevStep = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }, [currentStep])

  const canProceed = useCallback(() => {
    const currentStepConfig = wizardSteps[currentStep]
    const stepData = formData
    return validateCurrentStep(stepData, currentStepConfig.schema)
  }, [currentStep, wizardSteps, formData, validateCurrentStep])

  // Render wizard content
  const renderWizardContent = () => {
    const currentStepConfig = wizardSteps[currentStep]
    
    return (
      <div className="h-full flex flex-col">
        {/* Progress and Steps */}
        <div style={{ 
          backgroundColor: colors.background.primary,
          padding: spacing.xl,
          borderBottom: `1px solid ${colors.border.light}`
        }}>
          <Row gutter={[24, 16]} align="middle">
            <Col span={16}>
              <Progress 
                percent={progress} 
                strokeColor={colors.accent[500]}
                showInfo={false}
                style={{ marginBottom: spacing.sm }}
              />
              <Steps 
                current={currentStep} 
                size="small"
                style={{ marginTop: spacing.sm }}
              >
                {wizardSteps.map((step, index) => (
                  <Steps.Step 
                    key={step.key}
                    title={step.title}
                    icon={step.icon}
                    status={
                      index < currentStep ? 'finish' :
                      index === currentStep ? 'process' : 'wait'
                    }
                  />
                ))}
              </Steps>
            </Col>
            <Col span={8} style={{ textAlign: 'right' }}>
              <Text style={{ color: colors.text.secondary, fontSize: '14px' }}>
                Step {currentStep + 1} of {wizardSteps.length}
              </Text>
              <br />
              <Text style={{ color: colors.text.tertiary, fontSize: '12px' }}>
                {progress}% Complete
              </Text>
            </Col>
          </Row>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-auto" style={{ padding: spacing.xl }}>
          <Row gutter={24}>
            <Col span={16}>
              <Card
                style={{
                  backgroundColor: colors.background.primary,
                  border: `1px solid ${colors.border.light}`,
                  borderRadius: '8px',
                  height: 'fit-content'
                }}
                bodyStyle={{ padding: spacing.xl }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <Title level={3} style={{ 
                      margin: 0, 
                      marginBottom: spacing.xs,
                      color: colors.text.primary 
                    }}>
                      {currentStepConfig.title}
                    </Title>
                    <Text style={{ color: colors.text.secondary }}>
                      {currentStepConfig.description}
                    </Text>
                  </div>

                  <Form
                    schema={currentStepConfig.schema}
                    uiSchema={currentStepConfig.uiSchema}
                    formData={formData}
                    validator={validator}
                    onChange={handleWizardChange}
                    disabled={readonly}
                    showErrorList={false}
                    liveValidate={true}
                    className="bbos-wizard-form"
                  >
                    <div style={{ display: 'none' }}>
                      <button type="submit">Submit</button>
                    </div>
                  </Form>
                </Space>
              </Card>
            </Col>
            
            <Col span={8}>
              {/* Step info sidebar */}
              <Card
                style={{
                  backgroundColor: colors.background.tertiary,
                  border: `1px solid ${colors.border.light}`,
                  borderRadius: '8px'
                }}
                bodyStyle={{ padding: spacing.lg }}
              >
                <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                  <div>
                    <Title level={5} style={{ 
                      margin: 0,
                      marginBottom: spacing.xs,
                      color: colors.text.primary 
                    }}>
                      Configuration Progress
                    </Title>
                    <Text style={{ color: colors.text.secondary, fontSize: '13px' }}>
                      Complete each step to build your Armbian configuration
                    </Text>
                  </div>

                  <div>
                    {stepValidation[currentStep] !== undefined && (
                      <Alert
                        message={stepValidation[currentStep] ? "Step Valid" : "Missing Required Fields"}
                        type={stepValidation[currentStep] ? "success" : "warning"}
                        showIcon
                      />
                    )}
                  </div>

                  <Divider style={{ margin: `${spacing.sm} 0` }} />

                  <div>
                    <Text style={{ 
                      color: colors.text.secondary,
                      fontSize: '12px',
                      fontWeight: 500
                    }}>
                      NEXT STEPS
                    </Text>
                    {currentStep < wizardSteps.length - 1 && (
                      <div style={{ marginTop: spacing.xs }}>
                        <Text style={{ fontSize: '13px', color: colors.text.primary }}>
                          {wizardSteps[currentStep + 1].title}
                        </Text>
                        <br />
                        <Text style={{ fontSize: '12px', color: colors.text.tertiary }}>
                          {wizardSteps[currentStep + 1].description}
                        </Text>
                      </div>
                    )}
                    {currentStep === wizardSteps.length - 1 && (
                      <div style={{ marginTop: spacing.xs }}>
                        <Text style={{ fontSize: '13px', color: colors.success[600] }}>
                          Review and save your configuration
                        </Text>
                      </div>
                    )}
                  </div>
                </Space>
              </Card>
            </Col>
          </Row>
        </div>

        {/* Navigation */}
        <div style={{
          backgroundColor: colors.background.secondary,
          padding: spacing.xl,
          borderTop: `1px solid ${colors.border.light}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={prevStep}
            disabled={currentStep === 0 || readonly}
            style={{
              borderColor: colors.border.default,
              color: colors.text.secondary
            }}
          >
            Previous
          </Button>

          <Text style={{ color: colors.text.tertiary, fontSize: '12px' }}>
            Use the wizard to guide you through configuration setup
          </Text>

          {currentStep < wizardSteps.length - 1 ? (
            <Button
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={nextStep}
              disabled={!canProceed() || readonly}
              style={{
                backgroundColor: colors.accent[500],
                borderColor: colors.accent[500]
              }}
            >
              Next Step
            </Button>
          ) : (
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={() => handleSubmit({ formData })}
              disabled={!isValid || readonly}
              style={{
                backgroundColor: colors.success[500],
                borderColor: colors.success[500]
              }}
            >
              Complete Configuration
            </Button>
          )}
        </div>
      </div>
    )
  }

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

      {/* Tabs Content */}
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
          <Tabs 
            activeKey={activeTab} 
            onChange={setActiveTab}
            style={{ height: '100%' }}
            tabBarStyle={{
              margin: 0,
              padding: `0 ${spacing.xl}`,
              borderBottom: `1px solid ${colors.border.light}`,
              backgroundColor: colors.background.secondary
            }}
          >
            <TabPane 
              tab={
                <span>
                  <FormOutlined style={{ marginRight: spacing.xs }} />
                  Traditional Form
                </span>
              } 
              key="form"
            >
              {/* Traditional Form View */}
              <div 
                style={{
                  height: 'calc(100vh - 300px)',
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
                  backgroundColor: colors.background.tertiary
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
                  {initialConfig?.id && onDelete && (
                    <Button 
                      icon={<DeleteOutlined />}
                      onClick={handleDelete}
                      disabled={readonly}
                      danger
                      style={{
                        borderColor: colors.error[500],
                        color: colors.error[500]
                      }}
                    >
                      Delete
                    </Button>
                  )}
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
            </TabPane>

            <TabPane 
              tab={
                <span>
                  <SettingOutlined style={{ marginRight: spacing.xs }} />
                  Setup Wizard
                </span>
              } 
              key="wizard"
            >
              {renderWizardContent()}
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}

export default ArmbianConfigEditor 