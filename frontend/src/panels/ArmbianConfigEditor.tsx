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
        
        // Set initial form data with schema-aligned defaults
        setFormData(initialConfig as ArmbianConfiguration || {
          name: "My Armbian Configuration",
          description: "",
          board: {
            name: "",
            family: "",
            architecture: "arm64"
          },
          distribution: {
            release: "bookworm",
            type: "minimal"
          },
          branch: "current",
          bootEnvironment: {
            bootloader: "u-boot",
            consoleInterface: "serial",
            enableSsh: true,
            defaultCredentials: {
              username: "armbian",
              password: ""
            },
            bootArgs: [],
            overlays: []
          },
          storage: {
            filesystem: "ext4",
            encryption: false,
            swapSize: 0,
            partitionLayout: "single",
            rootSize: "100%"
          },
          network: {
            hostname: "armbian",
            wifi: {
              enabled: false,
              networks: [],
              country: "US"
            },
            ethernet: {
              dhcp: true
            }
          },
          users: [],
          ssh: {
            enabled: true,
            port: 22,
            passwordAuth: true,
            rootLogin: false,
            keyTypes: ["ed25519", "ecdsa"]
          },
          packages: {
            essential: [],
            additional: [],
            remove: [],
            sources: []
          },
          customization: {
            scripts: {},
            files: []
          },
          advanced: {
            compressionType: "gz",
            deviceTreeOverlays: []
          }
        })
        
        // Configure enhanced UI schema for better form rendering
        setUiSchema({
          'ui:order': ['name', 'description', 'board', 'distribution', 'branch', 'bootEnvironment', 'storage', 'network', 'users', 'ssh', 'packages', 'customization', 'advanced', 'meta'],
          name: {
            'ui:title': 'Configuration Name',
            'ui:description': 'Give your configuration a descriptive name',
            'ui:placeholder': 'My Armbian Configuration'
          },
          description: {
            'ui:title': 'Description',
            'ui:description': 'Optional description of this configuration',
            'ui:widget': 'textarea',
            'ui:options': {
              rows: 2
            }
          },
          board: {
            'ui:title': 'Target Board',
            'ui:description': 'Configure your target hardware',
            'ui:order': ['family', 'name', 'architecture'],
            family: {
              'ui:title': 'Board Family',
              'ui:description': 'Select the board family/chipset',
              'ui:widget': 'select',
              'ui:placeholder': 'Choose board family...'
            },
            name: {
              'ui:title': 'Board Name',
              'ui:description': 'Specific board model (e.g., rock-5b, orangepi5)',
              'ui:placeholder': 'Enter board name...'
            },
            architecture: {
              'ui:title': 'Architecture',
              'ui:description': 'Target CPU architecture',
              'ui:widget': 'radio'
            }
          },
          distribution: {
            'ui:title': 'Distribution',
            'ui:description': 'Choose the base Linux distribution and image type',
            'ui:order': ['release', 'type', 'desktop'],
            release: {
              'ui:title': 'Release',
              'ui:description': 'Linux distribution release',
              'ui:widget': 'select'
            },
            type: {
              'ui:title': 'Image Type',
              'ui:description': 'Select image variant',
              'ui:widget': 'radio'
            },
            desktop: {
              'ui:title': 'Desktop Environment',
              'ui:description': 'Choose desktop environment (for desktop images)',
              'ui:widget': 'select'
            }
          },
          branch: {
            'ui:title': 'Kernel Branch',
            'ui:description': 'Select kernel branch: current (stable), edge (latest), legacy (LTS)',
            'ui:widget': 'radio'
          },
          bootEnvironment: {
            'ui:title': 'Boot & System Configuration',
            'ui:description': 'Configure boot settings and initial system setup',
            'ui:order': ['bootloader', 'consoleInterface', 'enableSsh', 'defaultCredentials', 'bootArgs', 'overlays'],
            bootloader: {
              'ui:title': 'Bootloader',
              'ui:widget': 'radio'
            },
            consoleInterface: {
              'ui:title': 'Console Interface',
              'ui:description': 'Where to display console output',
              'ui:widget': 'radio'
            },
            enableSsh: {
              'ui:title': 'Enable SSH',
              'ui:description': 'Allow remote SSH connections on first boot'
            },
            defaultCredentials: {
              'ui:title': 'Default User Account',
              'ui:description': 'Create default user account',
              username: {
                'ui:title': 'Username',
                'ui:placeholder': 'armbian'
              },
              password: {
                'ui:title': 'Password',
                'ui:description': 'Leave empty to require setup on first login',
                'ui:widget': 'password',
                'ui:placeholder': 'Optional password...'
              }
            },
            bootArgs: {
              'ui:title': 'Boot Arguments',
              'ui:description': 'Additional kernel boot parameters',
              'ui:options': {
                addable: true,
                removable: true
              }
            },
            overlays: {
              'ui:title': 'Device Tree Overlays',
              'ui:description': 'Hardware feature overlays to enable',
              'ui:options': {
                addable: true,
                removable: true
              }
            }
          },
          storage: {
            'ui:title': 'Storage Configuration',
            'ui:description': 'Configure filesystem and storage options',
            'ui:order': ['filesystem', 'partitionLayout', 'rootSize', 'swapSize', 'encryption'],
            filesystem: {
              'ui:title': 'Root Filesystem',
              'ui:description': 'Choose root partition filesystem type',
              'ui:widget': 'radio'
            },
            partitionLayout: {
              'ui:title': 'Partition Layout',
              'ui:description': 'Choose partition scheme',
              'ui:widget': 'radio'
            },
            rootSize: {
              'ui:title': 'Root Partition Size',
              'ui:description': 'Size for root partition (e.g., 8GB, 50%, 100%)',
              'ui:placeholder': '100%'
            },
            swapSize: {
              'ui:title': 'Swap Size (MB)',
              'ui:description': 'Swap file size in megabytes (0 to disable)'
            },
            encryption: {
              'ui:title': 'Enable Encryption',
              'ui:description': 'Encrypt the root filesystem (LUKS)'
            }
          },
          network: {
            'ui:title': 'Network Configuration',
            'ui:description': 'Configure networking and connectivity',
            hostname: {
              'ui:title': 'Hostname',
              'ui:description': 'System hostname',
              'ui:placeholder': 'armbian'
            },
            wifi: {
              'ui:title': 'WiFi Configuration',
              enabled: {
                'ui:title': 'Enable WiFi',
                'ui:description': 'Configure WiFi on first boot'
              },
              country: {
                'ui:title': 'WiFi Country Code',
                'ui:description': 'Two-letter country code (e.g., US, GB, DE)',
                'ui:placeholder': 'US'
              },
              networks: {
                'ui:title': 'WiFi Networks',
                'ui:description': 'Pre-configure WiFi networks',
                'ui:options': {
                  addable: true,
                  removable: true
                },
                items: {
                  ssid: {
                    'ui:title': 'Network Name (SSID)',
                    'ui:placeholder': 'MyWiFiNetwork'
                  },
                  password: {
                    'ui:title': 'Password',
                    'ui:widget': 'password',
                    'ui:placeholder': 'WiFi password...'
                  },
                  priority: {
                    'ui:title': 'Priority',
                    'ui:description': 'Connection priority (0-999, higher = preferred)'
                  }
                }
              }
            },
            ethernet: {
              'ui:title': 'Ethernet Configuration',
              dhcp: {
                'ui:title': 'Use DHCP',
                'ui:description': 'Automatically obtain IP address'
              },
              staticConfig: {
                'ui:title': 'Static IP Configuration',
                'ui:description': 'Manual network configuration (when DHCP is disabled)',
                ip: {
                  'ui:title': 'IP Address',
                  'ui:placeholder': '192.168.1.100'
                },
                netmask: {
                  'ui:title': 'Netmask',
                  'ui:placeholder': '255.255.255.0'
                },
                gateway: {
                  'ui:title': 'Gateway',
                  'ui:placeholder': '192.168.1.1'
                },
                dns: {
                  'ui:title': 'DNS Servers',
                  'ui:description': 'DNS server IP addresses',
                  'ui:options': {
                    addable: true,
                    removable: true
                  }
                }
              }
            }
          },
          users: {
            'ui:title': 'Additional Users',
            'ui:description': 'Create additional user accounts',
            'ui:options': {
              addable: true,
              removable: true
            },
            items: {
              username: {
                'ui:title': 'Username',
                'ui:placeholder': 'newuser'
              },
              password: {
                'ui:title': 'Password',
                'ui:widget': 'password'
              },
              sudo: {
                'ui:title': 'Sudo Access',
                'ui:description': 'Grant administrator privileges'
              },
              shell: {
                'ui:title': 'Default Shell',
                'ui:widget': 'select'
              },
              sshKeys: {
                'ui:title': 'SSH Public Keys',
                'ui:options': {
                  addable: true,
                  removable: true
                }
              },
              groups: {
                'ui:title': 'Additional Groups',
                'ui:options': {
                  addable: true,
                  removable: true
                }
              }
            }
          },
          ssh: {
            'ui:title': 'SSH Configuration',
            'ui:description': 'Configure SSH daemon settings',
            enabled: {
              'ui:title': 'Enable SSH',
              'ui:description': 'Run SSH daemon on boot'
            },
            port: {
              'ui:title': 'SSH Port',
              'ui:description': 'SSH daemon port number'
            },
            passwordAuth: {
              'ui:title': 'Password Authentication',
              'ui:description': 'Allow login with passwords'
            },
            rootLogin: {
              'ui:title': 'Root Login',
              'ui:description': 'Allow direct root login via SSH'
            },
            keyTypes: {
              'ui:title': 'Key Types',
              'ui:description': 'SSH key types to generate',
              'ui:widget': 'checkboxes'
            }
          },
          packages: {
            'ui:title': 'Package Management',
            'ui:description': 'Configure software packages to install or remove',
            essential: {
              'ui:title': 'Essential Packages',
              'ui:description': 'Common utility packages',
              'ui:widget': 'checkboxes'
            },
            additional: {
              'ui:title': 'Additional Packages',
              'ui:description': 'Custom packages to install (one per line)',
              'ui:widget': 'textarea',
              'ui:options': {
                rows: 4
              }
            },
            remove: {
              'ui:title': 'Packages to Remove',
              'ui:description': 'Packages to remove from base image',
              'ui:options': {
                addable: true,
                removable: true
              }
            },
            sources: {
              'ui:title': 'Additional Repositories',
              'ui:description': 'Add custom package repositories',
              'ui:options': {
                addable: true,
                removable: true
              },
              items: {
                name: {
                  'ui:title': 'Repository Name',
                  'ui:placeholder': 'custom-repo'
                },
                url: {
                  'ui:title': 'Repository URL',
                  'ui:placeholder': 'https://repo.example.com/ubuntu'
                },
                key: {
                  'ui:title': 'GPG Key',
                  'ui:description': 'Public key for repository verification'
                },
                components: {
                  'ui:title': 'Components',
                  'ui:placeholder': 'main'
                }
              }
            }
          },
          customization: {
            'ui:title': 'System Customization',
            'ui:description': 'Custom scripts and files',
            scripts: {
              'ui:title': 'Custom Scripts',
              'ui:description': 'Scripts to run at various stages',
              firstBoot: {
                'ui:title': 'First Boot Script',
                'ui:description': 'Bash script to run on first system boot',
                'ui:widget': 'textarea',
                'ui:options': {
                  rows: 8
                }
              },
              firstLogin: {
                'ui:title': 'First Login Script',
                'ui:description': 'Script to run on first user login',
                'ui:widget': 'textarea',
                'ui:options': {
                  rows: 6
                }
              },
              preBuild: {
                'ui:title': 'Pre-Build Script',
                'ui:description': 'Script to run during image build (before)',
                'ui:widget': 'textarea',
                'ui:options': {
                  rows: 6
                }
              },
              postBuild: {
                'ui:title': 'Post-Build Script',
                'ui:description': 'Script to run during image build (after)',
                'ui:widget': 'textarea',
                'ui:options': {
                  rows: 6
                }
              }
            },
            files: {
              'ui:title': 'Custom Files',
              'ui:description': 'Additional files to include in the image',
              'ui:options': {
                addable: true,
                removable: true
              },
              items: {
                source: {
                  'ui:title': 'Source Path',
                  'ui:description': 'Local file path or URL'
                },
                destination: {
                  'ui:title': 'Destination Path',
                  'ui:description': 'Target path in the image'
                },
                permissions: {
                  'ui:title': 'Permissions',
                  'ui:description': 'File permissions (e.g., 755, 644)',
                  'ui:placeholder': '644'
                },
                owner: {
                  'ui:title': 'Owner',
                  'ui:description': 'File owner (user:group)',
                  'ui:placeholder': 'root:root'
                }
              }
            }
          },
          advanced: {
            'ui:title': 'Advanced Options',
            'ui:description': 'Advanced configuration options',
            compressionType: {
              'ui:title': 'Image Compression',
              'ui:description': 'Compression format for final image',
              'ui:widget': 'radio'
            },
            deviceTreeOverlays: {
              'ui:title': 'Device Tree Overlays',
              'ui:description': 'Additional hardware overlays to enable',
              'ui:options': {
                addable: true,
                removable: true
              }
            },
            kernelConfig: {
              'ui:title': 'Kernel Configuration',
              'ui:description': 'Custom kernel config options (CONFIG_ prefix will be added)',
              'ui:widget': 'textarea',
              'ui:options': {
                rows: 6
              }
            },
            ubootConfig: {
              'ui:title': 'U-Boot Configuration',
              'ui:description': 'Custom U-Boot configuration options',
              'ui:widget': 'textarea',
              'ui:options': {
                rows: 4
              }
            },
            firmwareFiles: {
              'ui:title': 'Firmware Files',
              'ui:description': 'Custom firmware files to include',
              'ui:options': {
                addable: true,
                removable: true
              },
              items: {
                source: {
                  'ui:title': 'Source Path'
                },
                destination: {
                  'ui:title': 'Destination Path'
                }
              }
            }
          },
          meta: {
            'ui:title': 'Metadata',
            'ui:description': 'Configuration metadata and version info',
            id: {
              'ui:title': 'Configuration ID',
              'ui:description': 'Unique identifier (auto-generated if empty)',
              'ui:readonly': true
            },
            version: {
              'ui:title': 'Schema Version',
              'ui:readonly': true
            },
            tags: {
              'ui:title': 'Tags',
              'ui:description': 'Tags for organizing configurations',
              'ui:options': {
                addable: true,
                removable: true
              }
            },
            createdAt: {
              'ui:title': 'Created',
              'ui:readonly': true,
              'ui:widget': 'datetime'
            },
            updatedAt: {
              'ui:title': 'Last Modified',
              'ui:readonly': true,
              'ui:widget': 'datetime'
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
    <div 
      className="h-full flex flex-col"
      style={{ 
        backgroundColor: components.panel.background,
        fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header */}
      <div 
        className="flex-shrink-0 border-b"
        style={{
          padding: spacing.xl,
          backgroundColor: colors.background.primary,
          borderBottomColor: colors.border.light,
          boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
        }}
      >
        <div className="flex items-center justify-between">
          <div>
            <Title 
              level={4} 
              className="mb-1"
              style={{
                color: colors.text.primary,
                fontWeight: 600,
                fontSize: '1.25rem',
                letterSpacing: '-0.025em'
              }}
            >
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
          <Space size="middle">
            <Button 
              icon={<ImportOutlined />} 
              onClick={handleImport}
              disabled={readonly}
              style={{
                borderColor: colors.border.default,
                color: colors.text.primary,
                borderRadius: '6px',
                fontWeight: 500
              }}
            >
              Import
            </Button>
            <Button 
              icon={<ExportOutlined />} 
              onClick={handleExport}
              disabled={!formData}
              style={{
                borderColor: colors.border.default,
                color: colors.text.primary,
                borderRadius: '6px',
                fontWeight: 500
              }}
            >
              Export
            </Button>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={() => window.location.reload()}
              style={{
                borderColor: colors.border.default,
                color: colors.text.primary,
                borderRadius: '6px',
                fontWeight: 500
              }}
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
                style={{
                  background: `linear-gradient(135deg, ${colors.accent[500]}, ${colors.accent[600]})`,
                  borderColor: colors.accent[500],
                  borderRadius: '6px',
                  fontWeight: 500,
                  boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                }}
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
              style={{
                background: `linear-gradient(135deg, ${colors.error[500]}, #dc2626)`,
                borderColor: colors.error[500],
                borderRadius: '6px',
                fontWeight: 500,
                boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
              }}
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