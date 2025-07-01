import { ArmbianConfiguration } from '@/types'
import { notification } from 'antd'

export interface ConfigurationTemplate {
  id: string
  name: string
  description: string
  category: 'server' | 'desktop' | 'iot' | 'development'
  tags: string[]
  configuration: Partial<ArmbianConfiguration>
  createdAt: string
  author?: string
  difficulty: 'beginner' | 'intermediate' | 'advanced'
}

export interface ConfigurationHistory {
  id: string
  configurationId: string
  version: number
  changes: string[]
  createdAt: string
  snapshot: ArmbianConfiguration
}

export interface ExportOptions {
  format: 'json' | 'yaml' | 'shell'
  includeMetadata: boolean
  includeComments: boolean
  compress: boolean
}

export interface ImportResult {
  success: boolean
  configuration?: ArmbianConfiguration
  errors?: string[]
  warnings?: string[]
}

class ConfigurationService {
  private readonly STORAGE_PREFIX = 'bbos-config'
  private readonly TEMPLATES_KEY = `${this.STORAGE_PREFIX}-templates`
  private readonly HISTORY_KEY = `${this.STORAGE_PREFIX}-history`
  private readonly DRAFTS_KEY = `${this.STORAGE_PREFIX}-drafts`

  // Built-in templates
  private builtInTemplates: ConfigurationTemplate[] = [
    {
      id: 'minimal-server',
      name: 'Minimal Server',
      description: 'Lightweight server configuration for headless deployments',
      category: 'server',
      tags: ['minimal', 'server', 'headless', 'ssh'],
      difficulty: 'beginner',
      author: 'BBOS Team',
      createdAt: new Date().toISOString(),
      configuration: {
        name: 'Minimal Server Configuration',
        description: 'Lightweight server setup optimized for minimal resource usage',
        board: {
          family: 'rockchip',
          name: 'rock-5b',
          architecture: 'arm64'
        },
        distribution: {
          release: 'bookworm',
          type: 'server'
        },
        ssh: {
          enabled: true,
          port: 22,
          passwordAuth: false,
          rootLogin: false,
          keyTypes: ['ed25519', 'ecdsa']
        },
        packages: {
          install: ['wget', 'curl', 'nano', 'htop', 'fail2ban', 'ufw']
        },
        network: {
          hostname: 'armbian-server',
          ethernet: {
            dhcp: true
          }
        },
        storage: {
          filesystem: 'ext4',
          swapSize: 512
        }
      }
    },
    {
      id: 'desktop-workstation',
      name: 'Desktop Workstation',
      description: 'Full-featured desktop environment for productivity',
      category: 'desktop',
      tags: ['desktop', 'gui', 'productivity', 'multimedia'],
      difficulty: 'intermediate',
      author: 'BBOS Team',
      createdAt: new Date().toISOString(),
      configuration: {
        name: 'Desktop Workstation Configuration',
        description: 'Complete desktop environment with development tools and multimedia support',
        board: {
          family: 'rockchip',
          name: 'rock-5b',
          architecture: 'arm64'
        },
        distribution: {
          release: 'bookworm',
          type: 'desktop',
          desktop: 'xfce'
        },
        ssh: {
          enabled: true,
          port: 22,
          passwordAuth: false,
          rootLogin: false
        },
        packages: {
          install: [
            'firefox-esr', 'libreoffice', 'gimp', 'vlc', 'code',
            'git', 'nodejs', 'python3', 'build-essential',
            'thunderbird', 'chromium', 'audacity'
          ]
        },
        network: {
          hostname: 'armbian-desktop',
          wifi: {
            enabled: true
          },
          ethernet: {
            dhcp: true
          }
        },
        storage: {
          filesystem: 'ext4',
          swapSize: 2048
        }
      }
    },
    {
      id: 'iot-gateway',
      name: 'IoT Gateway',
      description: 'Edge computing platform for IoT device management',
      category: 'iot',
      tags: ['iot', 'edge', 'docker', 'mqtt', 'sensors'],
      difficulty: 'advanced',
      author: 'BBOS Team',
      createdAt: new Date().toISOString(),
      configuration: {
        name: 'IoT Gateway Configuration',
        description: 'Edge computing platform optimized for IoT applications',
        board: {
          family: 'rockchip',
          name: 'rock-5b',
          architecture: 'arm64'
        },
        distribution: {
          release: 'bookworm',
          type: 'server'
        },
        ssh: {
          enabled: true,
          port: 22,
          passwordAuth: false,
          rootLogin: false
        },
        packages: {
          install: [
            'docker.io', 'docker-compose', 'mosquitto', 'mosquitto-clients',
            'influxdb', 'grafana', 'node-red', 'python3-pip',
            'wireless-tools', 'bluetooth', 'i2c-tools'
          ]
        },
        network: {
          hostname: 'iot-gateway',
          wifi: {
            enabled: true
          },
          ethernet: {
            dhcp: true
          }
        },
        storage: {
          filesystem: 'ext4',
          swapSize: 1024
        },
        scripts: {
          firstBoot: `#!/bin/bash
# IoT Gateway initial setup
systemctl enable docker
systemctl start docker
usermod -aG docker armbian

# Install Node-RED globally
npm install -g --unsafe-perm node-red

# Configure InfluxDB
systemctl enable influxdb
systemctl start influxdb

# Setup MQTT broker
systemctl enable mosquitto
systemctl start mosquitto

echo "IoT Gateway setup completed"
`,
          postBuild: `#!/bin/bash
# Enable I2C and SPI for sensor connectivity
echo "dtparam=i2c_arm=on" >> /boot/config.txt
echo "dtparam=spi=on" >> /boot/config.txt
`
        }
      }
    },
    {
      id: 'development-env',
      name: 'Development Environment',
      description: 'Complete development setup with tools and IDEs',
      category: 'development',
      tags: ['development', 'coding', 'tools', 'compiler'],
      difficulty: 'intermediate',
      author: 'BBOS Team',
      createdAt: new Date().toISOString(),
      configuration: {
        name: 'Development Environment Configuration',
        description: 'Full development stack for ARM-based coding',
        board: {
          family: 'rockchip',
          name: 'rock-5b',
          architecture: 'arm64'
        },
        distribution: {
          release: 'bookworm',
          type: 'desktop',
          desktop: 'xfce'
        },
        ssh: {
          enabled: true,
          port: 22,
          passwordAuth: false,
          rootLogin: false
        },
        packages: {
          install: [
            'build-essential', 'cmake', 'ninja-build', 'gdb',
            'git', 'nodejs', 'npm', 'python3', 'python3-pip',
            'golang', 'rustc', 'cargo', 'openjdk-17-jdk',
            'code', 'vim', 'emacs', 'tmux', 'screen',
            'docker.io', 'qemu-user-static'
          ]
        },
        network: {
          hostname: 'dev-workstation',
          ethernet: {
            dhcp: true
          }
        },
        storage: {
          filesystem: 'ext4',
          swapSize: 4096
        }
      }
    }
  ]

  /**
   * Get all available templates
   */
  getTemplates(): ConfigurationTemplate[] {
    const savedTemplates = this.getSavedTemplates()
    return [...this.builtInTemplates, ...savedTemplates]
  }

  /**
   * Get templates by category
   */
  getTemplatesByCategory(category: ConfigurationTemplate['category']): ConfigurationTemplate[] {
    return this.getTemplates().filter(template => template.category === category)
  }

  /**
   * Get template by ID
   */
  getTemplate(id: string): ConfigurationTemplate | null {
    return this.getTemplates().find(template => template.id === id) || null
  }

  /**
   * Create configuration from template
   */
  createFromTemplate(templateId: string, overrides?: Partial<ArmbianConfiguration>): ArmbianConfiguration | null {
    const template = this.getTemplate(templateId)
    if (!template) return null

    // Ensure all required fields are present
    const baseConfig: ArmbianConfiguration = {
      id: overrides?.id || crypto.randomUUID(),
      userId: overrides?.userId || 'current-user',
      name: overrides?.name || template.configuration.name || template.name,
      description: overrides?.description || template.configuration.description || template.description,
      createdAt: overrides?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: overrides?.version || 1,
      // Merge template configuration with overrides
      board: {
        name: template.configuration.board?.name || '',
        family: template.configuration.board?.family || '',
        architecture: template.configuration.board?.architecture || 'arm64',
        ...overrides?.board
      },
      distribution: {
        release: template.configuration.distribution?.release || 'bookworm',
        type: template.configuration.distribution?.type || 'minimal',
        ...template.configuration.distribution,
        ...overrides?.distribution
      },
      ssh: { ...template.configuration.ssh, ...overrides?.ssh },
      network: { ...template.configuration.network, ...overrides?.network },
      storage: { ...template.configuration.storage, ...overrides?.storage },
      packages: { ...template.configuration.packages, ...overrides?.packages },
      scripts: { ...template.configuration.scripts, ...overrides?.scripts },
      ...overrides
    }

    return baseConfig
  }

  /**
   * Save custom template
   */
  saveTemplate(template: Omit<ConfigurationTemplate, 'id' | 'createdAt'>): string {
    const newTemplate: ConfigurationTemplate = {
      ...template,
      id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }

    const savedTemplates = this.getSavedTemplates()
    savedTemplates.push(newTemplate)
    localStorage.setItem(this.TEMPLATES_KEY, JSON.stringify(savedTemplates))

    return newTemplate.id
  }

  /**
   * Export configuration
   */
  async exportConfiguration(
    config: ArmbianConfiguration, 
    options: ExportOptions = {
      format: 'json',
      includeMetadata: true,
      includeComments: false,
      compress: false
    }
  ): Promise<void> {
    try {
      let content: string
      let filename: string
      let mimeType: string

      const exportData = options.includeMetadata ? config : this.stripMetadata(config)

      switch (options.format) {
        case 'json':
          content = JSON.stringify(exportData, null, options.compress ? 0 : 2)
          filename = `${config.name || 'armbian-config'}.json`
          mimeType = 'application/json'
          break

        case 'yaml':
          content = this.toYaml(exportData, options.includeComments)
          filename = `${config.name || 'armbian-config'}.yaml`
          mimeType = 'text/yaml'
          break

        case 'shell':
          content = this.toShellScript(exportData)
          filename = `${config.name || 'armbian-config'}.sh`
          mimeType = 'text/plain'
          break

        default:
          throw new Error(`Unsupported export format: ${options.format}`)
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      link.click()
      URL.revokeObjectURL(url)

      notification.success({
        message: 'Export Successful',
        description: `Configuration exported as ${filename}`,
        placement: 'topRight'
      })

    } catch (error) {
      console.error('Export failed:', error)
      notification.error({
        message: 'Export Failed',
        description: error instanceof Error ? error.message : 'Unknown export error',
        placement: 'topRight'
      })
    }
  }

  /**
   * Import configuration from file
   */
  async importConfiguration(file: File): Promise<ImportResult> {
    return new Promise((resolve) => {
      const reader = new FileReader()
      
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string
          const config = this.parseConfiguration(content, file.name)
          
          if (config) {
            // Validate and sanitize the configuration
            const validatedConfig = this.validateAndSanitize(config)
            
            resolve({
              success: true,
              configuration: validatedConfig,
              warnings: this.getImportWarnings(validatedConfig)
            })
          } else {
            resolve({
              success: false,
              errors: ['Invalid configuration format']
            })
          }
        } catch (error) {
          resolve({
            success: false,
            errors: [error instanceof Error ? error.message : 'Import failed']
          })
        }
      }

      reader.onerror = () => {
        resolve({
          success: false,
          errors: ['Failed to read file']
        })
      }

      reader.readAsText(file)
    })
  }

  /**
   * Save configuration history
   */
  saveToHistory(config: ArmbianConfiguration, changes: string[]): void {
    const historyEntry: ConfigurationHistory = {
      id: crypto.randomUUID(),
      configurationId: config.id,
      version: config.version || 1,
      changes,
      createdAt: new Date().toISOString(),
      snapshot: { ...config }
    }

    const history = this.getHistory(config.id)
    history.push(historyEntry)
    
    // Keep only last 10 versions
    const trimmedHistory = history.slice(-10)
    
    const allHistory = this.getAllHistory()
    allHistory[config.id] = trimmedHistory
    localStorage.setItem(this.HISTORY_KEY, JSON.stringify(allHistory))
  }

  /**
   * Get configuration history
   */
  getHistory(configurationId: string): ConfigurationHistory[] {
    const allHistory = this.getAllHistory()
    return allHistory[configurationId] || []
  }

  /**
   * Save draft configuration
   */
  saveDraft(config: Partial<ArmbianConfiguration>): void {
    const draftKey = `${this.DRAFTS_KEY}-${config.id || 'new'}`
    const draft = {
      ...config,
      savedAt: new Date().toISOString(),
      isDraft: true
    }
    localStorage.setItem(draftKey, JSON.stringify(draft))
  }

  /**
   * Get draft configurations
   */
  getDrafts(): Array<Partial<ArmbianConfiguration> & { savedAt: string; isDraft: boolean }> {
    const drafts: Array<Partial<ArmbianConfiguration> & { savedAt: string; isDraft: boolean }> = []
    
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith(this.DRAFTS_KEY)) {
        try {
          const draft = JSON.parse(localStorage.getItem(key) || '{}')
          if (draft.isDraft) {
            drafts.push(draft)
          }
        } catch (e) {
          console.warn('Failed to parse draft:', key)
        }
      }
    }
    
    return drafts.sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime())
  }

  /**
   * Delete draft
   */
  deleteDraft(configId: string): void {
    const draftKey = `${this.DRAFTS_KEY}-${configId}`
    localStorage.removeItem(draftKey)
  }

  // Private helper methods

  private getSavedTemplates(): ConfigurationTemplate[] {
    try {
      const saved = localStorage.getItem(this.TEMPLATES_KEY)
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  }

  private getAllHistory(): Record<string, ConfigurationHistory[]> {
    try {
      const history = localStorage.getItem(this.HISTORY_KEY)
      return history ? JSON.parse(history) : {}
    } catch {
      return {}
    }
  }

  private stripMetadata(config: ArmbianConfiguration): Partial<ArmbianConfiguration> {
    const { id, userId, createdAt, updatedAt, version, ...cleanConfig } = config
    return cleanConfig
  }

  private parseConfiguration(content: string, filename: string): ArmbianConfiguration | null {
    try {
      if (filename.endsWith('.json')) {
        return JSON.parse(content)
      } else if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
        // For now, we'll handle YAML as JSON (in a real app, you'd use a YAML parser)
        return JSON.parse(content)
      }
      return null
    } catch {
      return null
    }
  }

  private validateAndSanitize(config: any): ArmbianConfiguration {
    // Ensure required fields exist
    const sanitized: ArmbianConfiguration = {
      id: config.id || crypto.randomUUID(),
      userId: config.userId || 'current-user',
      name: config.name || 'Imported Configuration',
      description: config.description || '',
      createdAt: config.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      version: 1,
      ...config
    }

    return sanitized
  }

  private getImportWarnings(config: ArmbianConfiguration): string[] {
    const warnings: string[] = []
    
    if (!config.board?.name) {
      warnings.push('No target board specified')
    }
    
    if (!config.distribution?.release) {
      warnings.push('No distribution release specified')
    }
    
    return warnings
  }

  private toYaml(data: any, includeComments: boolean): string {
    // Simple YAML conversion (in a real app, use a proper YAML library)
    let yaml = JSON.stringify(data, null, 2)
      .replace(/^(\s*)"([^"]+)":/gm, '$1$2:')
      .replace(/"/g, '')
    
    if (includeComments) {
      yaml = `# Armbian Configuration\n# Generated by BBOS\n\n${yaml}`
    }
    
    return yaml
  }

  private toShellScript(config: ArmbianConfiguration | Partial<ArmbianConfiguration>): string {
    return `#!/bin/bash
# Armbian Configuration Script
# Generated by BBOS

echo "Applying Armbian configuration: ${config.name}"

# Board: ${config.board?.name || 'Not specified'}
# Distribution: ${config.distribution?.release || 'Not specified'}

${config.packages?.install ? `
# Install packages
apt-get update
apt-get install -y ${config.packages.install.join(' ')}
` : ''}

${config.ssh?.enabled ? `
# Configure SSH
systemctl enable ssh
systemctl start ssh
` : ''}

${config.network?.hostname ? `
# Set hostname
hostnamectl set-hostname ${config.network.hostname}
` : ''}

echo "Configuration applied successfully"
`
  }
}

export const configurationService = new ConfigurationService()
export default configurationService 