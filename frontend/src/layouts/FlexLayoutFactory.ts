import { 
  FlexLayoutConfig, 
  FlexLayoutNodeConfig, 
  FlexLayoutBorderConfig,
  VSCodePanel
} from '@/types/flexlayout'

export class FlexLayoutFactory {
  static createDefaultLayout(): FlexLayoutConfig {
    return {
      global: {
        tabEnableClose: true,
        tabEnableRename: false,
        tabEnableDrag: true,
        tabEnableFloat: true,
        tabSetEnableClose: false,
        tabSetEnableDrop: true,
        tabSetEnableDrag: true,
        tabSetTabLocation: 'top',
        tabClassName: 'bbos-tab',
        tabClassNameSelected: 'bbos-tab-selected',
        borderBarSize: 30,
        borderEnableDrop: true,
        borderClassName: 'bbos-border',
        splitterSize: 8,
        splitterExtra: 4,
        enableEdgeDock: true,
        rootOrientationVertical: false,
      },
      layout: {
        type: 'row',
        id: 'root',
        children: [
          {
            type: 'row',
            weight: 100,
            children: [
              {
                type: 'tabset',
                id: 'main-editor',
                weight: 70,
                children: [
                  {
                    type: 'tab',
                    id: 'welcome',
                    name: 'Welcome',
                    component: 'WelcomePanel',
                    enableClose: false,
                  },
                  {
                    type: 'tab',
                    id: 'armbian-config',
                    name: 'Armbian Configuration',
                    component: 'ArmbianConfigEditor',
                    enableClose: true,
                    icon: 'settings',
                  },
                  {
                    type: 'tab',
                    id: 'image-runner',
                    name: 'Image Runner',
                    component: 'ImageRunnerPanel',
                    enableClose: true,
                    icon: 'monitor',
                  },
                ],
              },
              {
                type: 'tabset',
                id: 'right-sidebar',
                weight: 30,
                children: [
                  {
                    type: 'tab',
                    id: 'configuration-form',
                    name: 'Configuration',
                    component: 'ConfigurationFormPanel',
                  },
                ],
              },
            ],
          },
        ],
      },
      borders: [
        {
          type: 'border',
          location: 'left',
          size: 250,
          children: [
            {
              type: 'tab',
              id: 'explorer',
              name: 'Explorer',
              component: 'ExplorerPanel',
              enableClose: false,
            },
            {
              type: 'tab',
              id: 'configurations',
              name: 'Configurations',
              component: 'ConfigurationsPanel',
              enableClose: false,
            },
          ],
        },
        {
          type: 'border',
          location: 'bottom',
          size: 300,
          children: [
            {
              type: 'tab',
              id: 'build-logs',
              name: 'Build Logs',
              component: 'BuildLogsPanel',
            },
            {
              type: 'tab',
              id: 'build-status',
              name: 'Build Status',
              component: 'BuildStatusPanel',
            },
            {
              type: 'tab',
              id: 'terminal',
              name: 'Terminal',
              component: 'TerminalPanel',
            },
          ],
        },
        {
          type: 'border',
          location: 'right',
          size: 300,
          children: [
            {
              type: 'tab',
              id: 'build-queue',
              name: 'Build Queue',
              component: 'BuildQueuePanel',
            },
            {
              type: 'tab',
              id: 'artifacts',
              name: 'Artifacts',
              component: 'ArtifactsPanel',
            },
          ],
        },
      ],
    }
  }

  static createVSCodeLayout(): FlexLayoutConfig {
    return {
      global: {
        tabEnableClose: true,
        tabEnableRename: false,
        tabEnableDrag: true,
        tabEnableFloat: false,
        tabSetEnableClose: false,
        tabSetEnableDrop: true,
        tabSetEnableDrag: false,
        tabSetTabLocation: 'top',
        tabClassName: 'vscode-tab',
        tabClassNameSelected: 'vscode-tab-selected',
        borderBarSize: 35,
        borderEnableDrop: true,
        borderClassName: 'vscode-border',
        borderClassNameSelected: 'vscode-border-selected',
        splitterSize: 4,
        splitterExtra: 2,
        enableEdgeDock: true,
        rootOrientationVertical: false,
      },
      layout: {
        type: 'row',
        id: 'root',
        children: [
          {
            type: 'tabset',
            id: 'editor-group',
            weight: 100,
            children: [
              {
                type: 'tab',
                id: 'armbian-config',
                name: 'Armbian Configuration',
                component: 'ArmbianConfigEditor',
                enableClose: true,
                icon: 'settings',
              },
              {
                type: 'tab',
                id: 'image-runner',
                name: 'Image Runner',
                component: 'ImageRunnerPanel',
                enableClose: true,
                icon: 'monitor',
              },
            ],
          },
        ],
      },
      borders: [
        {
          type: 'border',
          location: 'left',
          size: 300,
          selected: 0,
          show: true,
          children: [
            {
              type: 'tab',
              id: 'file-explorer',
              name: 'Explorer',
              component: 'FileExplorerPanel',
              enableClose: false,
              icon: 'folder',
            },
            {
              type: 'tab',
              id: 'builds',
              name: 'Builds',
              component: 'BuildsPanel',
              enableClose: false,
              icon: 'build',
            },
            {
              type: 'tab',
              id: 'image-runner-sidebar',
              name: 'Image Runner',
              component: 'ImageRunnerPanel',
              enableClose: false,
              icon: 'monitor',
            },
            {
              type: 'tab',
              id: 'source-control',
              name: 'Source Control',
              component: 'SourceControlPanel',
              enableClose: false,
              icon: 'git-branch',
            },
            {
              type: 'tab',
              id: 'network',
              name: 'Network',
              component: 'NetworkPanel',
              enableClose: false,
              icon: 'network',
            },
          ],
        },
        {
          type: 'border',
          location: 'bottom',
          size: 350,
          selected: 0,
          show: true,
          children: [
            {
              type: 'tab',
              id: 'hardware-flash',
              name: 'Flash Image to Hardware',
              component: 'HardwareFlashPanel',
              enableClose: false,
              icon: 'thunderbolt',
            },
            {
              type: 'tab',
              id: 'hardware-utilities',
              name: 'Hardware Utilities',
              component: 'HardwareUtilitiesPanel',
              enableClose: false,
              icon: 'tool',
            },
            {
              type: 'tab',
              id: 'terminal',
              name: 'Terminal',
              component: 'TerminalPanel',
              enableClose: false,
              icon: 'terminal',
            },
            {
              type: 'tab',
              id: 'problems',
              name: 'Problems',
              component: 'ProblemsPanel',
              enableClose: false,
              icon: 'alert-circle',
            },
            {
              type: 'tab',
              id: 'output',
              name: 'Output',
              component: 'OutputPanel',
              enableClose: false,
              icon: 'list',
            },
            {
              type: 'tab',
              id: 'debug-console',
              name: 'Debug Console',
              component: 'DebugConsolePanel',
              enableClose: false,
              icon: 'bug',
            },
          ],
        },
        {
          type: 'border',
          location: 'right',
          size: 300,
          selected: -1,
          show: false,
          children: [
            {
              type: 'tab',
              id: 'outline',
              name: 'Outline',
              component: 'OutlinePanel',
              enableClose: false,
              icon: 'list-tree',
            },
            {
              type: 'tab',
              id: 'timeline',
              name: 'Timeline',
              component: 'TimelinePanel',
              enableClose: false,
              icon: 'history',
            },
          ],
        },
      ],
    }
  }

  static createMinimalLayout(): FlexLayoutConfig {
    return {
      global: {
        tabEnableClose: true,
        tabEnableRename: false,
        tabEnableDrag: true,
        tabEnableFloat: true,
        tabSetEnableClose: false,
        tabSetEnableDrop: true,
        tabSetEnableDrag: true,
        borderBarSize: 25,
        borderEnableDrop: true,
        splitterSize: 6,
        enableEdgeDock: true,
      },
      layout: {
        type: 'row',
        id: 'root',
        children: [
          {
            type: 'tabset',
            id: 'main',
            weight: 100,
            children: [
              {
                type: 'tab',
                id: 'config-editor',
                name: 'Configuration Editor',
                component: 'ConfigurationEditor',
                enableClose: false,
              },
            ],
          },
        ],
      },
      borders: [],
    }
  }

  static createPanel(panel: VSCodePanel): FlexLayoutNodeConfig {
    return {
      type: 'tab',
      id: panel.id,
      name: panel.title,
      component: panel.component.name,
      enableClose: panel.closeable ?? true,
      icon: panel.icon,
      config: {
        location: panel.location,
        group: panel.group,
        weight: panel.weight,
        defaultSize: panel.defaultSize,
        minSize: panel.minSize,
        maxSize: panel.maxSize,
        resizable: panel.resizable,
      },
    }
  }

  static createTabset(panels: VSCodePanel[]): FlexLayoutNodeConfig {
    return {
      type: 'tabset',
      id: `tabset-${Math.random().toString(36).substr(2, 9)}`,
      children: panels.map(panel => this.createPanel(panel)),
    }
  }

  static createBorder(
    location: 'top' | 'bottom' | 'left' | 'right',
    panels: VSCodePanel[]
  ): FlexLayoutBorderConfig {
    return {
      type: 'border',
      location,
      size: panels[0]?.defaultSize ?? 250,
      children: panels.map(panel => this.createPanel(panel)),
      selected: 0,
      show: panels.some(p => p.visible !== false),
    }
  }

  static addPanelToLayout(
    layout: FlexLayoutConfig,
    panel: VSCodePanel
  ): FlexLayoutConfig {
    const newLayout = JSON.parse(JSON.stringify(layout)) // Deep clone
    const panelConfig = this.createPanel(panel)

    if (panel.location === 'editor') {
      // Add to main editor area
      const editorTabset = this.findNodeById(newLayout.layout!, 'editor-group') ||
                          this.findFirstTabset(newLayout.layout!)
      if (editorTabset && editorTabset.children) {
        editorTabset.children.push(panelConfig)
      }
    } else {
      // Add to border
      const borderLocation = panel.location === 'sidebar' ? 'left' : 
                            panel.location === 'panel' ? 'bottom' : 'right'
      
      let border = newLayout.borders?.find((b: FlexLayoutBorderConfig) => b.location === borderLocation)
      if (!border) {
        border = this.createBorder(borderLocation, [panel])
        newLayout.borders = newLayout.borders || []
        newLayout.borders.push(border)
      } else {
        border.children = border.children || []
        border.children.push(panelConfig)
      }
    }

    return newLayout
  }

  static removePanelFromLayout(layout: FlexLayoutConfig, panelId: string): FlexLayoutConfig {
    const newLayout = JSON.parse(JSON.stringify(layout)) // Deep clone
    
    // Remove from main layout
    this.removeNodeFromChildren(newLayout.layout!, panelId)
    
    // Remove from borders
    newLayout.borders?.forEach((border: FlexLayoutBorderConfig) => {
      if (border.children) {
        border.children = border.children.filter((child: FlexLayoutNodeConfig) => child.id !== panelId)
      }
    })

    return newLayout
  }

  private static findNodeById(node: FlexLayoutNodeConfig, id: string): FlexLayoutNodeConfig | null {
    if (node.id === id) return node
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findNodeById(child, id)
        if (found) return found
      }
    }
    
    return null
  }

  private static findFirstTabset(node: FlexLayoutNodeConfig): FlexLayoutNodeConfig | null {
    if (node.type === 'tabset') return node
    
    if (node.children) {
      for (const child of node.children) {
        const found = this.findFirstTabset(child)
        if (found) return found
      }
    }
    
    return null
  }

  private static removeNodeFromChildren(node: FlexLayoutNodeConfig, targetId: string): boolean {
    if (node.children) {
      const index = node.children.findIndex(child => child.id === targetId)
      if (index !== -1) {
        node.children.splice(index, 1)
        return true
      }
      
      for (const child of node.children) {
        if (this.removeNodeFromChildren(child, targetId)) {
          return true
        }
      }
    }
    
    return false
  }

  static getLayoutPresets(): Record<string, FlexLayoutConfig> {
    return {
      default: this.createDefaultLayout(),
      vscode: this.createVSCodeLayout(),
      minimal: this.createMinimalLayout(),
    }
  }
} 