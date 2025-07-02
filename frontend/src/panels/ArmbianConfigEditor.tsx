import React, { useState, useCallback, useMemo, useEffect } from 'react'
import { Card, Button, Typography, Space, Divider, message, Modal, Tabs, Steps, Progress, Row, Col, Alert } from 'antd'
import { SaveOutlined, SettingOutlined, InfoCircleOutlined, ReloadOutlined, DeleteOutlined, ArrowLeftOutlined, ArrowRightOutlined, CheckCircleOutlined, FormOutlined, ExclamationCircleOutlined, ClockCircleOutlined, CompassOutlined } from '@ant-design/icons'
import Form from '@rjsf/antd'
import validator from '@rjsf/validator-ajv8'
import { RJSFSchema, ErrorSchema, UiSchema } from '@rjsf/utils'
import { ArmbianConfiguration } from '@/types'
import { colors, components, spacing } from '@/styles/design-tokens'
import { useSocketService } from '@/services/socketService'

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
  const socketService = useSocketService();
  const [buildModalOpen, setBuildModalOpen] = useState(false)
  const [buildLog, setBuildLog] = useState('')
  const [buildProgress, setBuildProgress] = useState(0)
  const [buildStatus, setBuildStatus] = useState<'pending'|'building'|'completed'|'failed'>('pending')
  const [currentBuildId, setCurrentBuildId] = useState<string | null>(null)

  // Helper function to reset build state
  const resetBuildState = useCallback(() => {
    setBuildProgress(0)
    setBuildStatus('pending')
    setBuildLog('')
    setCurrentBuildId(null)
  }, [])

  // Socket event handlers for build updates
  useEffect(() => {
    const handleBuildSubmitted = (response: any) => {
      console.log('Build submitted successfully:', response);
      setCurrentBuildId(response.buildId);
      
      const timestamp = new Date().toLocaleTimeString();
      setBuildLog((prev) => {
        const queueInfo = response.queuePosition > 0 
          ? `\n[${timestamp}] ⏳ Build queued (position: ${response.queuePosition}, estimated wait: ${response.estimatedWaitTime} min)`
          : `\n[${timestamp}] 🚀 Build started immediately`;
        return `${prev}${queueInfo}`;
      });
      
      setBuildStatus('pending');
      message.success('Build submitted successfully!');
    };

    const handleBuildUpdate = (build: any) => {
      console.log('Build update received:', build);
      
      // If this is the first build event (no current build ID), use this build's ID
      if (!currentBuildId) {
        console.log('Setting build ID from backend:', build.id);
        setCurrentBuildId(build.id);
      }
      // Only process events for the current build
      else if (build.id !== currentBuildId) {
        console.log('Ignoring build event for different build:', build.id, 'current:', currentBuildId);
        return;
      }
      
      // Add new log entry (don't accumulate from previous logs)
      const timestamp = new Date(build.timestamp || Date.now()).toLocaleTimeString();
      setBuildLog((prev) => {
        const newEntry = `[${timestamp}] ${build.message}`;
        return prev ? `${prev}\n${newEntry}` : newEntry;
      });
      
      setBuildProgress(build.progress || 0)
      
      // Map backend status to frontend status
      const statusMap: Record<string, 'pending' | 'building' | 'completed' | 'failed'> = {
        'queued': 'pending',
        'initializing': 'building',
        'downloading': 'building',
        'configuring': 'building',
        'building': 'building', 
        'packaging': 'building',
        'uploading': 'building',
        'completed': 'completed',
        'failed': 'failed',
        'cancelled': 'failed'
      };
      
      const newStatus = statusMap[build.status] || 'building';
      setBuildStatus(newStatus);
      
      // Handle completion or failure
      if (build.status === 'completed') {
        setBuildLog((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] ✅ Build completed successfully!`)
        setTimeout(() => {
          setBuildModalOpen(false)
          // Reset build state
          resetBuildState()
        }, 2000)
      } else if (build.status === 'failed' || build.status === 'cancelled') {
        setBuildLog((prev) => `${prev}\n[${new Date().toLocaleTimeString()}] ❌ Build ${build.status}: ${build.message}`)
        setTimeout(() => {
          setBuildModalOpen(false)
          // Reset build state
          resetBuildState()
        }, 3000)
      }
    };

    const handleBuildError = (error: any) => {
      console.error('Build error received:', error);
      const timestamp = new Date().toLocaleTimeString();
      setBuildLog((prev) => `${prev}\n[${timestamp}] ❌ Error: ${error.error}`);
      setBuildStatus('failed');
      message.error(error.error || 'Build submission failed');
    };

    // Subscribe to socket events
    const unsubscribeSubmitted = socketService.on('build:submitted', handleBuildSubmitted);
    const unsubscribeUpdate = socketService.on('build:update', handleBuildUpdate);
    const unsubscribeCompleted = socketService.on('build:completed', handleBuildUpdate);
    const unsubscribeFailed = socketService.on('build:failed', handleBuildUpdate);
    const unsubscribeCancelled = socketService.on('build:cancelled', handleBuildUpdate);
    const unsubscribeError = socketService.on('build:error', handleBuildError);

    // Cleanup subscriptions
    return () => {
      unsubscribeSubmitted();
      unsubscribeUpdate();
      unsubscribeCompleted();
      unsubscribeFailed();
      unsubscribeCancelled();
      unsubscribeError();
    };
  }, [currentBuildId, resetBuildState, socketService])

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
                description: 'Specific board model (e.g., rock-5b, rock-5b-plus, orangepi5)'
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
            'ui:placeholder': 'e.g., rock-5b, rock-5b-plus, orangepi5, nanopi-m4',
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
            description: 'Specific board model (e.g., rock-5b, rock-5b-plus, orangepi5)'
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
                    'ui:placeholder': 'e.g., rock-5b, rock-5b-plus, orangepi5, nanopi-m4'
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

  const jumpToStep = useCallback((targetStep: number) => {
    // Allow jumping to any step - remove validation restrictions for better UX
    if (targetStep >= 0 && targetStep < wizardSteps.length) {
      setCurrentStep(targetStep)
    }
  }, [wizardSteps.length])

  const canProceed = useCallback(() => {
    const currentStepConfig = wizardSteps[currentStep]
    const stepData = formData
    return validateCurrentStep(stepData, currentStepConfig.schema)
  }, [currentStep, wizardSteps, formData, validateCurrentStep])

  const getStepStatus = useCallback((stepIndex: number) => {
    if (stepIndex < currentStep) {
      return stepValidation[stepIndex] !== false ? 'finish' : 'error'
    } else if (stepIndex === currentStep) {
      return 'process'
    } else {
      return 'wait'
    }
  }, [currentStep, stepValidation])

  // Build handler
  const handleBuild = useCallback(() => {
    // Reset build state completely for new build
    resetBuildState()
    setBuildModalOpen(true)
    
    setBuildLog(`[${new Date().toLocaleTimeString()}] 🚀 Starting new build...`)
    setBuildStatus('pending')
    
    socketService.send('build:submit', { configuration: formData, userId: 'default-user' });
    message.loading('Build started...');
  }, [socketService, formData, resetBuildState]);

  // Render wizard content
  const renderWizardContent = () => {
    const currentStepConfig = wizardSteps[currentStep]
    
    return (
      <div className="h-full flex flex-col">
        {/* Simplified Progress Header */}
        <div style={{ 
          backgroundColor: colors.background.primary,
          padding: `${spacing.md} ${spacing.xl}`,
          borderBottom: `1px solid ${colors.border.light}`
        }}>
          <Row align="middle">
            <Col span={12}>
              <div style={{ display: 'flex', alignItems: 'center', gap: spacing.lg }}>
                <Progress 
                  type="circle"
                  percent={progress} 
                  strokeColor={colors.accent[500]}
                  size={36}
                  format={() => `${currentStep + 1}/${wizardSteps.length}`}
                  strokeWidth={8}
                />
                <div>
                  <Text style={{ 
                    color: colors.text.primary, 
                    fontSize: '16px',
                    fontWeight: 600,
                    display: 'block'
                  }}>
                    {wizardSteps[currentStep].title}
                  </Text>
                  <Text style={{ 
                    color: colors.text.secondary, 
                    fontSize: '13px',
                    display: 'block'
                  }}>
                    {wizardSteps[currentStep].description}
                  </Text>
                </div>
              </div>
            </Col>
            <Col span={12} style={{ textAlign: 'right' }}>
              <Space direction="vertical" size={2} style={{ width: '100%' }}>
                <Text style={{ 
                  color: colors.text.secondary, 
                  fontSize: '12px',
                  fontWeight: 500 
                }}>
                  Configuration Setup Progress
                </Text>
                <Text style={{ 
                  color: colors.text.tertiary, 
                  fontSize: '11px' 
                }}>
                  Use Quick Navigation panel to jump between steps
                </Text>
              </Space>
            </Col>
          </Row>
        </div>

        {/* Navigation */}
        <div style={{
          backgroundColor: colors.background.secondary,
          padding: spacing.lg,
          borderBottom: `1px solid ${colors.border.light}`,
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

          <Space>
            {currentStep < wizardSteps.length - 1 && (
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
            )}
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleBuild}
              disabled={!isValid || readonly}
              style={{
                backgroundColor: colors.success[500],
                borderColor: colors.success[500]
              }}
            >
              Build
            </Button>
          </Space>
        </div>

        {/* Step Content */}
        <div className="flex-1 overflow-auto" style={{ padding: spacing.lg }}>
          <Row gutter={[20, 16]}>
            <Col span={19}>
              <Card
                style={{
                  backgroundColor: colors.background.primary,
                  border: `1px solid ${colors.border.light}`,
                  borderRadius: '8px',
                  height: 'fit-content'
                }}
                bodyStyle={{ padding: `${spacing.xl} ${spacing.xl} ${spacing.lg}` }}
              >
                <Space direction="vertical" size="large" style={{ width: '100%' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.md, marginBottom: spacing.sm }}>
                      <div style={{
                        backgroundColor: colors.accent[50],
                        padding: spacing.sm,
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}>
                        {currentStepConfig.icon}
                      </div>
                      <Title level={4} style={{ 
                        margin: 0,
                        color: colors.text.primary,
                        fontWeight: 600
                      }}>
                        {currentStepConfig.title}
                      </Title>
                    </div>
                    <Text style={{ 
                      color: colors.text.secondary,
                      fontSize: '14px',
                      display: 'block',
                      marginBottom: spacing.lg
                    }}>
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
            
            <Col span={5}>
              {/* Compact Step Info Sidebar */}
              <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                {/* Current Step Status */}
                <Alert
                  message={
                    stepValidation[currentStep] === true ? "Step Complete" :
                    stepValidation[currentStep] === false ? "Required fields missing" :
                    "Fill out the form to proceed"
                  }
                  type={
                    stepValidation[currentStep] === true ? "success" :
                    stepValidation[currentStep] === false ? "warning" : "info"
                  }
                  showIcon
                  style={{ marginBottom: spacing.sm }}
                />

                {/* Enhanced Quick Navigation */}
                <Card
                  size="small"
                  style={{
                    backgroundColor: colors.background.tertiary,
                    border: `1px solid ${colors.border.light}`,
                    borderRadius: '6px'
                  }}
                  bodyStyle={{ padding: spacing.md }}
                >
                  <Space direction="vertical" size="small" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: spacing.xs, marginBottom: spacing.xs }}>
                      <span style={{ fontSize: '16px' }}>🧭</span>
                      <Text style={{ 
                        color: colors.text.primary,
                        fontSize: '14px',
                        fontWeight: 600,
                        display: 'block'
                      }}>
                        Navigation
                      </Text>
                    </div>
                    <Text style={{ 
                      color: colors.text.tertiary,
                      fontSize: '11px',
                      marginBottom: spacing.sm,
                      display: 'block'
                    }}>
                      Click any step to navigate instantly
                    </Text>
                    
                    {wizardSteps.map((step, index) => {
                      const isCompleted = stepValidation[index] === true
                      const isCurrent = index === currentStep
                      const hasValidationError = stepValidation[index] === false
                      
                      return (
                        <div 
                          key={step.key}
                          onClick={() => jumpToStep(index)}
                          style={{
                            padding: `${spacing.sm} ${spacing.sm}`,
                            borderRadius: '6px',
                            backgroundColor: isCurrent ? colors.accent[50] : 'transparent',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            border: isCurrent ? `1px solid ${colors.accent[500]}` : '1px solid transparent'
                          }}
                          onMouseEnter={(e) => {
                            if (!isCurrent) {
                              e.currentTarget.style.backgroundColor = colors.background.secondary
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isCurrent) {
                              e.currentTarget.style.backgroundColor = 'transparent'
                            }
                          }}
                        >
                          <Space size="small" style={{ width: '100%' }}>
                            <div style={{
                              minWidth: '18px',
                              height: '18px',
                              borderRadius: '50%',
                              backgroundColor: isCompleted ? colors.success[500] : 
                                             hasValidationError ? colors.error[500] :
                                             isCurrent ? colors.accent[500] : colors.border.default,
                              color: (isCompleted || hasValidationError || isCurrent) ? colors.text.inverse : colors.text.tertiary,
                              fontSize: '10px',
                              fontWeight: 600,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              {isCompleted ? '✓' : hasValidationError ? '!' : index + 1}
                            </div>
                            <div style={{ flex: 1 }}>
                              <Text style={{
                                fontSize: '12px',
                                color: isCurrent ? colors.accent[700] : colors.text.primary,
                                fontWeight: isCurrent ? 600 : 500,
                                display: 'block',
                                lineHeight: '1.2'
                              }}>
                                {step.title}
                              </Text>
                              {isCurrent && (
                                <Text style={{
                                  fontSize: '10px',
                                  color: colors.text.tertiary,
                                  display: 'block',
                                  marginTop: '2px'
                                }}>
                                  Current step
                                </Text>
                              )}
                            </div>
                          </Space>
                        </div>
                      )
                    })}
                  </Space>
                </Card>

                {/* Next Step Preview */}
                {currentStep < wizardSteps.length - 1 && (
                  <Card
                    size="small"
                    style={{
                      backgroundColor: colors.background.secondary,
                      border: `1px solid ${colors.border.light}`,
                      borderRadius: '6px'
                    }}
                    bodyStyle={{ padding: spacing.md }}
                  >
                    <Space direction="vertical" size="small" style={{ width: '100%' }}>
                      <Text style={{ 
                        color: colors.text.secondary,
                        fontSize: '11px',
                        fontWeight: 500,
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px'
                      }}>
                        Next Step
                      </Text>
                      <Text style={{ 
                        fontSize: '13px', 
                        color: colors.text.primary,
                        fontWeight: 500,
                        display: 'block'
                      }}>
                        {wizardSteps[currentStep + 1].title}
                      </Text>
                      <Text style={{ 
                        fontSize: '12px', 
                        color: colors.text.tertiary,
                        lineHeight: '1.4'
                      }}>
                        {wizardSteps[currentStep + 1].description}
                      </Text>
                    </Space>
                  </Card>
                )}

                {/* Final Step */}
                {currentStep === wizardSteps.length - 1 && (
                  <Card
                    size="small"
                    style={{
                      backgroundColor: colors.success[50],
                      border: `1px solid ${colors.success[500]}`,
                      borderRadius: '6px'
                    }}
                    bodyStyle={{ padding: spacing.md }}
                  >
                    <Space direction="vertical" size="small">
                      <Text style={{ 
                        fontSize: '13px', 
                        color: colors.success[700],
                        fontWeight: 600
                      }}>
                        🎉 Ready to Build!
                      </Text>
                      <Text style={{ 
                        fontSize: '12px', 
                        color: colors.success[600]
                      }}>
                        Your configuration is complete and ready for building.
                      </Text>
                    </Space>
                  </Card>
                )}
              </Space>
            </Col>
          </Row>
        </div>
      </div>
    )
  }

  return (
    <div 
      style={{ 
        backgroundColor: colors.background.tertiary,
        padding: spacing.lg,
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
                  <Button
                    type="primary"
                    icon={<CheckCircleOutlined />}
                    onClick={handleBuild}
                    disabled={readonly || !isValid}
                    style={{
                      backgroundColor: colors.success[500],
                      borderColor: colors.success[500],
                      marginLeft: spacing.md
                    }}
                  >
                    Build
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

      {/* Build Modal */}
      <Modal
        open={buildModalOpen}
        onCancel={() => {
          setBuildModalOpen(false)
          resetBuildState()
        }}
        footer={null}
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {buildStatus === 'completed' ? (
              <CheckCircleOutlined style={{ color: colors.success[500] }} />
            ) : buildStatus === 'failed' ? (
              <ExclamationCircleOutlined style={{ color: colors.error[500] }} />
            ) : (
              <ClockCircleOutlined style={{ color: colors.accent[500] }} />
            )}
            <span>Remote Build Progress</span>
            {buildStatus === 'completed' && (
              <Text style={{ color: colors.success[600], fontSize: '14px', fontWeight: 'normal' }}>
                - Completed Successfully!
              </Text>
            )}
            {buildStatus === 'failed' && (
              <Text style={{ color: colors.error[600], fontSize: '14px', fontWeight: 'normal' }}>
                - Build Failed
              </Text>
            )}
          </div>
        }
        width={700}
        bodyStyle={{ background: colors.background.secondary }}
        destroyOnClose
      >
        <div style={{ fontFamily: 'JetBrains Mono, monospace', background: colors.background.tertiary, borderRadius: 6, padding: 16, minHeight: 240, maxHeight: 400, overflowY: 'auto', fontSize: 14, color: colors.text.primary }}>
          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
            {buildLog || 'Waiting for build output...'}
          </pre>
        </div>
        <div style={{ marginTop: 16 }}>
          <Progress 
            percent={buildProgress} 
            status={buildStatus === 'failed' ? 'exception' : buildStatus === 'completed' ? 'success' : 'active'} 
            strokeColor={
              buildStatus === 'completed' ? colors.success[500] :
              buildStatus === 'failed' ? colors.error[500] :
              colors.accent[500]
            }
          />
          <div style={{ 
            marginTop: 8, 
            color: buildStatus === 'failed' ? colors.error[600] : buildStatus === 'completed' ? colors.success[600] : colors.text.secondary,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span>
              {buildStatus === 'failed' ? 'Build failed.' : 
               buildStatus === 'completed' ? 'Build completed successfully!' : 
               'Building...'}
            </span>
            {buildStatus === 'completed' && (
              <Text style={{ color: colors.text.tertiary, fontSize: '12px' }}>
                Modal will close automatically in 2 seconds
              </Text>
            )}
            {buildStatus === 'failed' && (
              <Text style={{ color: colors.text.tertiary, fontSize: '12px' }}>
                Modal will close automatically in 3 seconds
              </Text>
            )}
          </div>
        </div>
      </Modal>
    </div>
  )
}

export default ArmbianConfigEditor 