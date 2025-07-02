import { ComponentType } from 'react'

// FlexLayout Panel Types
export interface PanelComponent {
  id: string
  title: string
  component: ComponentType<any>
  icon?: ComponentType<any>
  closeable?: boolean
  enableDrag?: boolean
}

export interface PanelConfig {
  type: 'tab' | 'border' | 'row' | 'tabset'
  location?: 'top' | 'bottom' | 'left' | 'right' | 'center'
  children?: PanelConfig[]
  id?: string
  name?: string
  component?: string
  config?: Record<string, any>
  weight?: number
  width?: number
  height?: number
  minWidth?: number
  minHeight?: number
  maxWidth?: number
  maxHeight?: number
}

// User Types
export interface User {
  id: string
  email: string
  name: string
  avatar?: string
  provider: 'google' | 'github' | 'discord' | 'microsoft'
  providerId: string
  preferences: UserPreferences
  subscription: UserSubscription
  createdAt: string
  lastLoginAt?: string
  isActive: boolean
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'auto'
  layout?: any // FlexLayout JSON
  defaultBoard?: string
}

export interface UserSubscription {
  tier: 'free' | 'pro' | 'enterprise'
  buildsPerMonth: number
  maxConcurrentBuilds: number
}

// Armbian Configuration Types
export interface Board {
  family: string
  name: string
  architecture: 'arm64' | 'armhf' | 'x86'
}

export interface Distribution {
  release: 'bookworm' | 'bullseye' | 'jammy' | 'noble'
  type: 'minimal' | 'desktop' | 'server'
  desktop?: 'gnome' | 'kde' | 'xfce' | 'cinnamon' | 'mate'
}

export interface ArmbianConfiguration {
  id: string
  userId: string
  name: string
  description?: string
  board: Board
  distribution: Distribution
  bootEnvironment?: {
    bootloader?: 'u-boot' | 'uefi'
    bootArgs?: string[]
    overlays?: string[]
  }
  storage?: {
    filesystem?: 'ext4' | 'btrfs' | 'zfs'
    encryption?: boolean
    swapSize?: number
    partitioning?: {
      scheme?: 'gpt' | 'mbr'
      customPartitions?: Array<{
        mountPoint: string
        size: string
        filesystem?: string
      }>
    }
  }
  network?: {
    hostname?: string
    wifi?: {
      enabled: boolean
      ssid?: string
      psk?: string
      country?: string
    }
    ethernet?: {
      dhcp?: boolean
      staticIp?: string
      gateway?: string
      dns?: string[]
    }
  }
  users?: Array<{
    username: string
    password?: string
    sshKeys?: string[]
    sudo?: boolean
    shell?: '/bin/bash' | '/bin/zsh' | '/bin/sh'
  }>
  ssh?: {
    enabled?: boolean
    port?: number
    passwordAuth?: boolean
    rootLogin?: boolean
    keyTypes?: Array<'rsa' | 'ecdsa' | 'ed25519'>
  }
  packages?: {
    install?: string[]
    remove?: string[]
    sources?: Array<{
      name: string
      url: string
      key?: string
    }>
  }
  scripts?: {
    firstBoot?: string
    preBuild?: string
    postBuild?: string
  }
  advanced?: {
    kernelConfig?: Record<string, any>
    ubootConfig?: Record<string, any>
    firmwareFiles?: Array<{
      source: string
      destination: string
    }>
  }
  config?: Record<string, any>
  createdAt: string
  updatedAt: string
  version: number
}

// Build Job Types
export type BuildStatus = 
  | 'queued'
  | 'initializing'
  | 'downloading'
  | 'building'
  | 'packaging'
  | 'uploading'
  | 'completed'
  | 'failed'
  | 'cancelled'

export interface BuildProgress {
  percentage: number
  currentStage: string
  estimatedTimeRemaining?: number
}

export interface BuildServer {
  serverId: string
  region: string
  specs?: {
    cpu: string
    memory: string
    storage: string
  }
}

export interface BuildTiming {
  queuedAt: string
  startedAt?: string
  completedAt?: string
  duration?: number
}

export interface BuildLog {
  timestamp: string
  level: 'debug' | 'info' | 'warning' | 'error'
  message: string
  component?: string
}

export interface BuildArtifact {
  name: string
  type: 'image' | 'checksum' | 'log' | 'config'
  size: number
  url: string
  checksum?: {
    algorithm: 'md5' | 'sha256' | 'sha512'
    value: string
  }
  expiresAt?: string
}

export interface BuildError {
  code: string
  message: string
  details?: any
  stage?: string
}

export interface BuildJob {
  id: string
  userId: string
  configurationId: string
  configurationSnapshot: ArmbianConfiguration
  status: BuildStatus
  progress?: BuildProgress
  buildServer?: BuildServer
  timing: BuildTiming
  logs: BuildLog[]
  artifacts: BuildArtifact[]
  error?: BuildError
  metadata?: {
    armbianVersion?: string
    kernelVersion?: string
    buildEnvironment?: any
    buildOptions?: any
  }
  priority: number
  retryCount: number
  maxRetries: number
  tags?: string[]
  createdAt: string
  updatedAt: string
}

// API Response Types
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: {
    code: string
    message: string
    details?: any
  }
  timestamp: string
}

export interface PaginatedResponse<T = any> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasNext: boolean
    hasPrev: boolean
  }
}

// WebSocket Event Types
export interface WebSocketEvent {
  type: string
  payload: any
  timestamp: string
}

export interface BuildUpdateEvent extends WebSocketEvent {
  type: 'build:update'
  payload: {
    buildId: string
    status: BuildStatus
    progress?: BuildProgress
    logs?: BuildLog[]
    artifacts?: BuildArtifact[]
    error?: BuildError
  }
}

// Form Types
export interface FormField {
  name: string
  label: string
  type: 'text' | 'number' | 'boolean' | 'select' | 'textarea' | 'file'
  placeholder?: string
  required?: boolean
  validation?: any
  options?: Array<{ label: string; value: any }>
  description?: string
  helpText?: string
}

// Store Types
export interface AppState {
  user: User | null
  configurations: ArmbianConfiguration[]
  buildJobs: BuildJob[]
  activePanel: string | null
  layout: any
  theme: 'light' | 'dark' | 'auto'
  isLoading: boolean
  error: string | null
}

// Component Props Types
export interface BaseComponentProps {
  className?: string
  children?: React.ReactNode
}

export interface PanelComponentProps extends BaseComponentProps {
  panelId: string
  isActive: boolean
  onClose?: () => void
}

// Hardware Device Types
export interface Device {
  id: string
  name: string
  type: 'maskrom' | 'loader' | 'normal'
  chipType?: string
  connected: boolean
  capabilities?: string[]
}

// Flash Progress and Event Types
export interface FlashProgressEvent {
  flashJobId: string
  buildId: string
  deviceId: string
  storageTarget?: string
  phase: 'connecting' | 'writing' | 'verifying' | 'completed' | 'failed'
  progress: number
  message: string
  timestamp: string
}

export interface FlashCompletedEvent {
  flashJobId: string
  buildId: string
  deviceId: string
  storageTarget?: string
  timestamp: string
}

export interface FlashFailedEvent {
  flashJobId: string
  buildId: string
  deviceId: string
  storageTarget?: string
  error: string
  timestamp: string
}

// SPI Operation Event Types
export interface SPIProgressEvent {
  operationId: string
  operation: 'clear' | 'write-bootloader'
  deviceId: string
  method?: string
  phase: 'connecting' | 'writing' | 'verifying' | 'completed' | 'failed'
  progress: number
  message: string
  timestamp: string
}

export interface SPICompletedEvent {
  operationId: string
  operation: 'clear' | 'write-bootloader'
  deviceId: string
  method?: string
  timestamp: string
}

export interface SPIErrorEvent {
  operationId: string
  operation: 'clear' | 'write-bootloader'
  deviceId: string
  method?: string
  error: string
  timestamp: string
}

// Device Operation Event Types
export interface DeviceProgressEvent {
  operationId: string
  operation: 'reboot'
  deviceId: string
  phase: 'connecting' | 'rebooting' | 'completed' | 'failed'
  progress: number
  message: string
  timestamp: string
}

export interface DeviceCompletedEvent {
  operationId: string
  operation: 'reboot'
  deviceId: string
  timestamp: string
}

export interface DeviceErrorEvent {
  operationId: string
  operation: 'reboot'
  deviceId: string
  error: string
  timestamp: string
}

// Export all types
export * from './flexlayout'
export * from './rjsf' 