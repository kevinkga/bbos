import { ComponentType } from 'react'

// FlexLayout Model Types
export interface FlexLayoutModel {
  toJson(): any
  fromJson(json: any): void
  doAction(action: any): void
  getNodeById(id: string): FlexLayoutNode | undefined
  getRoot(): FlexLayoutNode
  getActiveTabset(): FlexLayoutNode | undefined
  setActiveTabset(tabset: FlexLayoutNode): void
  visitNodes(fn: (node: FlexLayoutNode) => void): void
}

export interface FlexLayoutNode {
  getId(): string
  getType(): string
  getComponent(): string | undefined
  getName(): string
  getConfig(): any
  getParent(): FlexLayoutNode | undefined
  getChildren(): FlexLayoutNode[]
  getRect(): FlexLayoutRect
  isVisible(): boolean
  isEnabled(): boolean
  isMaximized(): boolean
  isMinimized(): boolean
  canMaximize(): boolean
  canMinimize(): boolean
  canClose(): boolean
  canRename(): boolean
}

export interface FlexLayoutRect {
  x: number
  y: number
  width: number
  height: number
}

export interface FlexLayoutAction {
  type: string
  data?: any
}

// FlexLayout Configuration Types
export interface FlexLayoutConfig {
  global?: {
    tabEnableClose?: boolean
    tabEnableRename?: boolean
    tabEnableDrag?: boolean
    tabEnableFloat?: boolean
    tabSetEnableClose?: boolean
    tabSetEnableDrop?: boolean
    tabSetEnableDrag?: boolean
    tabSetEnableRename?: boolean
    tabSetClassNameTabStrip?: string
    tabSetClassNameHeader?: string
    tabSetTabLocation?: 'top' | 'bottom'
    tabClassName?: string
    tabClassNameSelected?: string
    tabIcon?: string
    tabDragSpeed?: number
    borderBarSize?: number
    borderEnableDrop?: boolean
    borderClassName?: string
    borderClassNameSelected?: string
    splitterSize?: number
    splitterExtra?: number
    enableEdgeDock?: boolean
    rootOrientationVertical?: boolean
  }
  layout?: FlexLayoutNodeConfig
  borders?: FlexLayoutBorderConfig[]
}

export interface FlexLayoutNodeConfig {
  type: 'row' | 'tabset' | 'tab' | 'border'
  id?: string
  weight?: number
  width?: number
  height?: number
  children?: FlexLayoutNodeConfig[]
  name?: string
  component?: string
  config?: Record<string, any>
  enableClose?: boolean
  enableDrag?: boolean
  enableRename?: boolean
  enableFloat?: boolean
  className?: string
  icon?: string
  helpText?: string
}

export interface FlexLayoutBorderConfig {
  type: 'border'
  location: 'top' | 'bottom' | 'left' | 'right'
  children?: FlexLayoutNodeConfig[]
  size?: number
  className?: string
  selected?: number
  show?: boolean
}

// Panel Registration Types
export interface PanelRegistration {
  id: string
  name: string
  component: ComponentType<any>
  icon?: ComponentType<any>
  category?: string
  description?: string
  defaultConfig?: Record<string, any>
}

// Layout Management Types
export interface LayoutManager {
  saveLayout(name: string, layout: any): void
  loadLayout(name: string): any | null
  getAvailableLayouts(): string[]
  deleteLayout(name: string): void
  resetToDefault(): void
}

// Panel Context Types
export interface PanelContext {
  nodeId: string
  isActive: boolean
  isMaximized: boolean
  isFloating: boolean
  config: Record<string, any>
  model: FlexLayoutModel
  onConfigChange: (config: Record<string, any>) => void
  onClose: () => void
  onMaximize: () => void
  onMinimize: () => void
  onFloat: () => void
}

// VS Code Style Panel Types
export interface VSCodePanel {
  id: string
  title: string
  icon?: string
  component: ComponentType<PanelContext>
  location: 'sidebar' | 'panel' | 'editor' | 'auxiliary'
  group?: string
  weight?: number
  defaultSize?: number
  minSize?: number
  maxSize?: number
  closeable?: boolean
  resizable?: boolean
  visible?: boolean
}

export interface VSCodeLayout {
  sidebar: {
    left: VSCodePanel[]
    right: VSCodePanel[]
  }
  panel: {
    bottom: VSCodePanel[]
  }
  editor: {
    center: VSCodePanel[]
  }
  auxiliary: VSCodePanel[]
}

// FlexLayout Factory Types
export interface FlexLayoutFactory {
  createDefaultLayout(): FlexLayoutConfig
  createVSCodeLayout(): FlexLayoutConfig
  createPanel(panel: VSCodePanel): FlexLayoutNodeConfig
  createTabset(panels: VSCodePanel[]): FlexLayoutNodeConfig
  createBorder(location: 'top' | 'bottom' | 'left' | 'right', panels: VSCodePanel[]): FlexLayoutBorderConfig
}

// Event Types
export interface FlexLayoutEvent {
  type: 'action' | 'modelChange' | 'resize'
  data: any
}

export interface PanelEvent {
  type: 'open' | 'close' | 'focus' | 'blur' | 'resize' | 'move'
  panelId: string
  data?: any
}

// Drag & Drop Types
export interface DragDropInfo {
  node: FlexLayoutNode
  location: 'center' | 'top' | 'bottom' | 'left' | 'right'
  cursor: { x: number; y: number }
  dataTransfer?: DataTransfer
}

export interface DropInfo {
  targetNode: FlexLayoutNode
  location: 'center' | 'top' | 'bottom' | 'left' | 'right'
  dragNode: FlexLayoutNode
  index?: number
} 