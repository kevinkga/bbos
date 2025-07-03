import { NetworkNode } from '../types/network';

interface BuildConfiguration {
  name?: string;
  project: {
    name: string;
    description?: string;
    version?: string;
    author?: string;
    tags?: string[];
  };
  system: {
    hostname: string;
    locale: string;
    timezone: string;
    keyboard?: string;
  };
  platform: {
    target_arch: 'arm64' | 'amd64' | 'x86_64';
    board_type: string;
    base_image: string;
    kernel_version?: 'latest' | 'lts' | 'vendor' | 'mainline' | 'legacy' | 'current';
    bootloader?: 'u-boot' | 'grub' | 'systemd-boot' | 'extlinux';
  };
  users: Array<{
    username: string;
    password?: string | null;
    ssh_keys: string[];
    sudo: boolean;
    shell: string;
    groups: string[];
  }>;
  network: {
    ethernet?: {
      interface: string;
      dhcp: boolean;
      ip?: string;
      netmask?: string;
      gateway?: string;
      dns?: string[];
    };
    wifi?: {
      enabled: boolean;
      interface?: string;
      ssid?: string;
      password?: string;
      security?: 'WPA2' | 'WPA3' | 'WPA2/WPA3' | 'WEP' | 'Open';
    };
    ssh?: {
      enabled: boolean;
      port: number;
      password_authentication: boolean;
      root_login: boolean;
      key_authentication?: boolean;
    };
    firewall?: {
      enabled: boolean;
      default_policy: 'ACCEPT' | 'DROP' | 'REJECT';
    };
  };
  storage: {
    disk_layout: 'single' | 'lvm' | 'raid1' | 'raid5' | 'zfs' | 'custom';
    filesystem_type: 'ext4' | 'btrfs' | 'xfs' | 'zfs' | 'f2fs';
    encryption: boolean;
    swap_size?: string;
    expand_root: boolean;
  };
  packages: {
    update_cache: boolean;
    upgrade_system: boolean;
    install: string[];
    remove?: string[];
  };
  services: {
    enable: string[];
    disable?: string[];
  };
  hardware?: {
    gpio?: {
      enabled: boolean;
    };
    i2c?: {
      enabled: boolean;
    };
    spi?: {
      enabled: boolean;
    };
  };
  templateMetadata?: {
    id: string;
    name: string;
    version: string;
  };
  networkNodeId?: string;
  buildType: string;
}

interface BuildJob {
  id: string;
  nodeId: string;
  nodeName: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  stage?: string;
  message?: string;
  startTime?: Date;
  endTime?: Date;
  error?: string;
  buildId?: string;
}

interface BuildOrchestrationEvent {
  type: 'job:started' | 'job:progress' | 'job:completed' | 'job:failed' | 'orchestration:completed';
  jobId?: string;
  nodeId?: string;
  progress?: number;
  message?: string;
  data?: any;
}

export interface BuildStatus {
  id: string;
  status: 'preparing' | 'running' | 'completed' | 'failed';
  progress: number;
  startTime: number;
  endTime?: number;
  error?: string;
  currentStage?: string;
  lastUpdate?: number;
  batchId?: string;
  batchIndex?: number;
}

export interface BuildArtifact {
  id: string;
  name: string;
  type: 'image' | 'bootloader' | 'checksum' | 'documentation';
  path: string;
  size: number;
  checksum?: string;
  downloadUrl: string;
  flashCompatible: boolean;
  metadata?: Record<string, any>;
}

export interface BuildRequest {
  name: string;
  systemConfig: BuildConfiguration;
  networkNode?: NetworkNode;
  templateId?: string;
  templateName?: string;
  templateVersion?: string;
  batchId?: string;
}

export interface BatchBuildRequest {
  builds: BuildRequest[];
  name?: string;
  description?: string;
}

export interface BatchBuildResult {
  batchId: string;
  results: Array<{
    index: number;
    buildId: string | null;
    status: 'started' | 'failed';
    error?: string;
    config: BuildRequest;
  }>;
  summary: {
    total: number;
    started: number;
    failed: number;
  };
}

export class BuildOrchestrationService {
  private activeJobs = new Map<string, BuildJob>();
  private eventListeners: Array<(event: BuildOrchestrationEvent) => void> = [];
  private apiBaseUrl: string;
  private builds = new Map<string, BuildConfiguration>();
  private buildStatus = new Map<string, BuildStatus>();
  private activeBatches = new Map<string, BatchBuildResult>();

  constructor(apiBaseUrl: string = 'http://localhost:3001/api') {
    this.apiBaseUrl = apiBaseUrl;
    this.initializeWebSocket();
  }

  /**
   * Add event listener for build orchestration events
   */
  addEventListener(listener: (event: BuildOrchestrationEvent) => void): void {
    this.eventListeners.push(listener);
  }

  /**
   * Remove event listener
   */
  removeEventListener(listener: (event: BuildOrchestrationEvent) => void): void {
    const index = this.eventListeners.indexOf(listener);
    if (index > -1) {
      this.eventListeners.splice(index, 1);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: BuildOrchestrationEvent): void {
    this.eventListeners.forEach(listener => listener(event));
  }

  /**
   * Convert NetworkNode to BuildConfiguration
   */
  private convertNodeToBuildConfig(node: NetworkNode): BuildConfiguration {
    const armbianConfig = node.armbianConfig || {};
    
    return {
      name: node.name,
      project: {
        name: node.name || 'homenet-device',
        description: node.description || `Armbian build for ${node.name}`,
        version: '1.0.0',
        author: 'HomeNet Builder',
        tags: node.tags || []
      },
      system: {
        hostname: armbianConfig.hostname || node.name?.toLowerCase().replace(/\s+/g, '-') || 'homenet-device',
        locale: armbianConfig.locale || 'en_US.UTF-8',
        timezone: armbianConfig.timezone || 'UTC',
        keyboard: 'us'
      },
      platform: {
        target_arch: 'arm64',
        board_type: armbianConfig.board || 'rock-5b',
        base_image: this.getBuildTypeImage(armbianConfig.buildType || 'minimal'),
        kernel_version: this.mapKernelBranch(armbianConfig.branch || 'current'),
        bootloader: 'u-boot'
      },
      users: [{
        username: armbianConfig.username || 'homenet',
        password: null,
        ssh_keys: [],
        sudo: true,
        shell: '/bin/bash',
        groups: ['sudo', 'users']
      }],
      network: {
        ethernet: {
          interface: 'eth0',
          dhcp: !armbianConfig.staticIP,
          ip: armbianConfig.staticIP?.split('/')[0],
          netmask: armbianConfig.staticIP?.includes('/') ? this.cidrToNetmask(armbianConfig.staticIP.split('/')[1]) : undefined
        },
        wifi: armbianConfig.enableWifi ? {
          enabled: true,
          interface: 'wlan0',
          ssid: armbianConfig.wifiSSID,
          password: armbianConfig.wifiPassword,
          security: 'WPA2'
        } : {
          enabled: false
        },
        ssh: {
          enabled: armbianConfig.enableSSH !== false,
          port: armbianConfig.sshPort || 22,
          password_authentication: false,
          root_login: false,
          key_authentication: true
        },
        firewall: {
          enabled: true,
          default_policy: 'DROP'
        }
      },
      storage: {
        disk_layout: 'single',
        filesystem_type: 'ext4',
        encryption: false,
        expand_root: true,
        swap_size: '1G'
      },
      packages: {
        update_cache: true,
        upgrade_system: true,
        install: [
          'curl',
          'wget',
          'git',
          'htop',
          'nano',
          ...(armbianConfig.enableDocker ? ['docker.io', 'docker-compose'] : []),
          ...(armbianConfig.packages || [])
        ],
        remove: []
      },
      services: {
        enable: [
          'ssh',
          ...(armbianConfig.enableDocker ? ['docker'] : [])
        ],
        disable: []
      },
      hardware: {
        gpio: {
          enabled: armbianConfig.enableGPIO || false
        },
        i2c: {
          enabled: armbianConfig.enableI2C || false
        },
        spi: {
          enabled: armbianConfig.enableSPI || false
        }
      },
      templateMetadata: armbianConfig.templateId ? {
        id: armbianConfig.templateId,
        name: armbianConfig.templateName || '',
        version: armbianConfig.templateVersion || ''
      } : undefined,
      networkNodeId: node.id,
      buildType: armbianConfig.buildType || 'minimal'
    };
  }

  /**
   * Map build type to base image
   */
  private getBuildTypeImage(buildType: string): string {
    switch (buildType) {
      case 'desktop': return 'armbian-desktop';
      case 'cli': return 'armbian-cli';
      case 'minimal': 
      default: return 'armbian-minimal';
    }
  }

  /**
   * Map kernel branch to version
   */
  private mapKernelBranch(branch: string): 'latest' | 'lts' | 'vendor' | 'mainline' | 'legacy' | 'current' {
    switch (branch) {
      case 'edge': return 'latest';
      case 'current': return 'mainline';
      case 'legacy': return 'legacy';
      default: return 'current';
    }
  }

  /**
   * Convert CIDR to netmask
   */
  private cidrToNetmask(cidr: string): string {
    const cidrNum = parseInt(cidr);
    const mask = (0xFFFFFFFF << (32 - cidrNum)) >>> 0;
    return [
      (mask >>> 24) & 0xFF,
      (mask >>> 16) & 0xFF,
      (mask >>> 8) & 0xFF,
      mask & 0xFF
    ].join('.');
  }

  /**
   * Start build for a single node
   */
  async startNodeBuild(node: NetworkNode): Promise<string> {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const job: BuildJob = {
      id: jobId,
      nodeId: node.id,
      nodeName: node.name || 'Unknown Device',
      status: 'pending',
      progress: 0,
      startTime: new Date()
    };

    this.activeJobs.set(jobId, job);

    try {
      // Convert node to build configuration
      const buildConfig = this.convertNodeToBuildConfig(node);
      
      // Start build via API
      const response = await fetch(`${this.apiBaseUrl}/builds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          nodeId: node.id,
          buildConfiguration: buildConfig
        })
      });

      if (!response.ok) {
        throw new Error(`Build API error: ${response.statusText}`);
      }

      const result = await response.json();
      
      // Update job with build ID
      job.buildId = result.buildId;
      job.status = 'running';
      job.progress = 5;
      job.message = 'Build started';

      this.emit({
        type: 'job:started',
        jobId,
        nodeId: node.id,
        message: `Build started for ${node.name}`
      });

      // Start polling for progress
      this.pollBuildProgress(jobId);

      return jobId;

    } catch (error) {
      job.status = 'failed';
      job.error = error instanceof Error ? error.message : String(error);
      job.endTime = new Date();

      this.emit({
        type: 'job:failed',
        jobId,
        nodeId: node.id,
        message: `Build failed: ${job.error}`
      });

      throw error;
    }
  }

  /**
   * Start builds for multiple nodes
   */
  async startMultiNodeBuild(nodes: NetworkNode[]): Promise<string[]> {
    const jobIds: string[] = [];
    
    console.log(`🚀 Starting multi-node build for ${nodes.length} devices`);
    
    for (const node of nodes) {
      try {
        const jobId = await this.startNodeBuild(node);
        jobIds.push(jobId);
        console.log(`✅ Started build job ${jobId} for ${node.name}`);
        
        // Small delay between builds to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Failed to start build for ${node.name}:`, error);
        // Continue with other nodes even if one fails
      }
    }

    // Emit orchestration started event
    this.emit({
      type: 'orchestration:completed',
      message: `Started ${jobIds.length} builds out of ${nodes.length} nodes`,
      data: { 
        totalNodes: nodes.length, 
        startedJobs: jobIds.length,
        jobIds 
      }
    });

    return jobIds;
  }

  /**
   * Poll build progress from the backend
   */
  private async pollBuildProgress(jobId: string): Promise<void> {
    const job = this.activeJobs.get(jobId);
    if (!job || job.status === 'completed' || job.status === 'failed') {
      return;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/builds/${job.buildId}/status`);
      
      if (response.ok) {
        const buildStatus = await response.json();
        
        // Update job with latest status
        job.progress = buildStatus.progress || job.progress;
        job.stage = buildStatus.stage;
        job.message = buildStatus.message || job.message;
        
        if (buildStatus.status === 'completed') {
          job.status = 'completed';
          job.endTime = new Date();
          job.progress = 100;
          
          this.emit({
            type: 'job:completed',
            jobId,
            nodeId: job.nodeId,
            progress: 100,
            message: `Build completed for ${job.nodeName}`
          });
          
        } else if (buildStatus.status === 'failed') {
          job.status = 'failed';
          job.error = buildStatus.error;
          job.endTime = new Date();
          
          this.emit({
            type: 'job:failed',
            jobId,
            nodeId: job.nodeId,
            message: `Build failed for ${job.nodeName}: ${job.error}`
          });
          
        } else {
          // Still in progress, emit progress update
          this.emit({
            type: 'job:progress',
            jobId,
            nodeId: job.nodeId,
            progress: job.progress,
            message: job.message
          });
          
          // Continue polling after delay
          setTimeout(() => this.pollBuildProgress(jobId), 2000);
        }
      } else {
        console.warn(`Failed to get build status for job ${jobId}: ${response.statusText}`);
        // Continue polling
        setTimeout(() => this.pollBuildProgress(jobId), 5000);
      }
      
    } catch (error) {
      console.error(`Error polling build progress for job ${jobId}:`, error);
      // Continue polling with longer delay
      setTimeout(() => this.pollBuildProgress(jobId), 10000);
    }
  }

  /**
   * Get all active jobs
   */
  getActiveJobs(): BuildJob[] {
    return Array.from(this.activeJobs.values());
  }

  /**
   * Get job by ID
   */
  getJob(jobId: string): BuildJob | undefined {
    return this.activeJobs.get(jobId);
  }

  /**
   * Cancel a build job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const job = this.activeJobs.get(jobId);
    if (!job || !job.buildId) {
      return false;
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/builds/${job.buildId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        job.status = 'cancelled';
        job.endTime = new Date();
        return true;
      }
      
      return false;
    } catch (error) {
      console.error(`Failed to cancel job ${jobId}:`, error);
      return false;
    }
  }

  /**
   * Clean up completed jobs
   */
  cleanup(): void {
    const cutoff = new Date();
    cutoff.setHours(cutoff.getHours() - 1); // Remove jobs older than 1 hour
    
    for (const [jobId, job] of this.activeJobs.entries()) {
      if (job.endTime && job.endTime < cutoff) {
        this.activeJobs.delete(jobId);
      }
    }
  }

  /**
   * Start a single build with template support
   */
  async startBuild(request: BuildRequest): Promise<string> {
    try {
      console.log('🚀 Starting build with template support:', {
        name: request.name,
        templateId: request.templateId,
        templateName: request.templateName,
        nodeId: request.networkNode?.id
      });

      // Enhanced configuration with template metadata
      const enhancedConfig: BuildConfiguration = {
        ...request.systemConfig,
        name: request.name,
        templateMetadata: request.templateId && request.templateName && request.templateVersion ? {
          id: request.templateId,
          name: request.templateName,
          version: request.templateVersion
        } : undefined,
        networkNodeId: request.networkNode?.id,
        buildType: 'template-enhanced'
      };

      // Store build configuration
      const buildId = crypto.randomUUID();
      this.builds.set(buildId, enhancedConfig);
      this.buildStatus.set(buildId, {
        id: buildId,
        status: 'preparing',
        progress: 0,
        startTime: Date.now()
      });

      // Call backend API
      const response = await fetch('/api/builds', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.templateId && { 'X-Template-ID': request.templateId })
        },
        body: JSON.stringify(enhancedConfig)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Build start failed');
      }

      const actualBuildId = result.data.buildId;
      
      // Update with actual build ID from backend
      this.builds.delete(buildId);
      this.buildStatus.delete(buildId);
      this.builds.set(actualBuildId, enhancedConfig);
      this.buildStatus.set(actualBuildId, {
        id: actualBuildId,
        status: 'running',
        progress: 5,
        startTime: Date.now()
      });

      // Emit build started event
      this.emit({
        type: 'job:started',
        jobId: actualBuildId,
        nodeId: request.networkNode?.id,
        message: `Build started: ${request.name}`,
        data: {
          buildId: actualBuildId,
          config: enhancedConfig,
          templateId: request.templateId,
          templateName: request.templateName
        }
      });

      console.log('✅ Build started successfully:', actualBuildId);
      return actualBuildId;

    } catch (error) {
      console.error('❌ Build start failed:', error);
      
      // Emit build failed event
      this.emit({
        type: 'job:failed',
        nodeId: request.networkNode?.id,
        message: `Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        data: {
          error: error instanceof Error ? error.message : 'Unknown error',
          config: request.systemConfig
        }
      });

      throw error;
    }
  }

  /**
   * Start multiple builds as a batch
   */
  async startBatchBuild(request: BatchBuildRequest): Promise<string> {
    try {
      console.log('🚀 Starting batch build:', {
        name: request.name,
        buildCount: request.builds.length
      });

      const response = await fetch('/api/builds/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          builds: request.builds.map(build => ({
            ...build.systemConfig,
            name: build.name,
            templateMetadata: build.templateId ? {
              id: build.templateId,
              name: build.templateName,
              version: build.templateVersion
            } : undefined,
            networkNodeId: build.networkNode?.id
          }))
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Batch build start failed');
      }

      const batchResult: BatchBuildResult = result.data;
      this.activeBatches.set(batchResult.batchId, batchResult);

      // Emit batch started event
      this.emit({
        type: 'orchestration:completed',
        message: `Started batch build: ${request.name}`,
        data: {
          batchId: batchResult.batchId,
          summary: batchResult.summary,
          builds: request.builds
        }
      });

      // Track individual builds
      batchResult.results.forEach((buildResult, index) => {
        if (buildResult.buildId) {
          this.buildStatus.set(buildResult.buildId, {
            id: buildResult.buildId,
            status: 'running',
            progress: 5,
            startTime: Date.now(),
            batchId: batchResult.batchId,
            batchIndex: index
          });

          // Emit individual build started events
          this.emit({
            type: 'job:started',
            jobId: buildResult.buildId,
            message: `Batch build started`,
            data: {
              buildId: buildResult.buildId,
              config: buildResult.config,
              batchId: batchResult.batchId,
              batchIndex: index
            }
          });
        }
      });

      console.log('✅ Batch build started successfully:', batchResult.batchId);
      return batchResult.batchId;

    } catch (error) {
      console.error('❌ Batch build start failed:', error);
      throw error;
    }
  }

  /**
   * Get build artifacts for a completed build
   */
  async getBuildArtifacts(buildId: string): Promise<BuildArtifact[]> {
    try {
      const response = await fetch(`/api/builds/${buildId}/artifacts`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error?.message || 'Failed to get build artifacts');
      }

      return result.data || [];
    } catch (error) {
      console.error('Failed to get build artifacts:', error);
      throw error;
    }
  }

  /**
   * Get batch build status
   */
  getBatchBuild(batchId: string): BatchBuildResult | undefined {
    return this.activeBatches.get(batchId);
  }

  /**
   * Get all active batches
   */
  getActiveBatches(): BatchBuildResult[] {
    return Array.from(this.activeBatches.values());
  }

  // WebSocket event handling for real-time updates
  private initializeWebSocket(): void {
    // Connect to existing WebSocket infrastructure
    if (typeof window !== 'undefined' && window.location) {
      const wsUrl = `ws://${window.location.host}/ws`;
      
      try {
        const ws = new WebSocket(wsUrl);
        
        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            this.handleWebSocketMessage(message);
          } catch (error) {
            console.warn('Failed to parse WebSocket message:', error);
          }
        };
        
        ws.onopen = () => {
          console.log('🔌 Build orchestration WebSocket connected');
        };
        
        ws.onclose = () => {
          console.log('🔌 Build orchestration WebSocket disconnected');
          // Attempt to reconnect after 5 seconds
          setTimeout(() => this.initializeWebSocket(), 5000);
        };
        
      } catch (error) {
        console.warn('Failed to initialize WebSocket:', error);
      }
    }
  }

  private handleWebSocketMessage(message: any): void {
    if (message.type === 'build:progress' && message.payload) {
      const { buildId, progress, status, stage, message: logMessage } = message.payload;
      
      // Update build status
      const buildStatus = this.buildStatus.get(buildId);
      if (buildStatus) {
        buildStatus.progress = progress;
        buildStatus.status = this.mapBuildStatus(status);
        buildStatus.currentStage = stage;
        buildStatus.lastUpdate = Date.now();
      }

      // Emit progress event
      this.emit({
        type: 'job:progress',
        jobId: buildId,
        progress,
        message: logMessage,
        data: { status, stage }
      });

    } else if (message.type === 'build:completed' && message.payload) {
      const { buildId } = message.payload;
      
      // Update build status
      const buildStatus = this.buildStatus.get(buildId);
      if (buildStatus) {
        buildStatus.status = 'completed';
        buildStatus.progress = 100;
        buildStatus.endTime = Date.now();
      }

      // Emit completion event
      this.emit({
        type: 'job:completed',
        jobId: buildId,
        progress: 100,
        message: 'Build completed successfully',
        data: { endTime: Date.now() }
      });

    } else if (message.type === 'build:error' && message.payload) {
      const { buildId, error } = message.payload;
      
      // Update build status
      const buildStatus = this.buildStatus.get(buildId);
      if (buildStatus) {
        buildStatus.status = 'failed';
        buildStatus.error = error;
        buildStatus.endTime = Date.now();
      }

      // Emit error event
      this.emit({
        type: 'job:failed',
        jobId: buildId,
        message: `Build failed: ${error}`,
        data: { error, endTime: Date.now() }
      });
    }
  }

  private mapBuildStatus(status: string): BuildStatus['status'] {
    switch (status) {
      case 'queued':
      case 'pending':
        return 'preparing';
      case 'running':
      case 'in-progress':
        return 'running';
      case 'completed':
      case 'success':
        return 'completed';
      case 'failed':
      case 'error':
        return 'failed';
      default:
        return 'preparing';
    }
  }
}

// Export singleton instance
export const buildOrchestrationService = new BuildOrchestrationService(); 