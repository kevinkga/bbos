import { promises as fs } from 'fs';
import path from 'path';
import { Server as SocketIOServer } from 'socket.io';
import { BuildProgress } from './armbianBuilder.js';

export interface BuildJob {
  id: string;
  configurationId: string;
  userId: string;
  status: 'queued' | 'initializing' | 'downloading' | 'building' | 'packaging' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  lastUpdated: string;
  artifacts?: Array<{
    id: string;
    name: string;
    type: 'image' | 'log' | 'config' | 'checksum' | 'packages';
    size: number;
    path: string;
    url: string;
  }>;
  logs: string[];
  configuration: any;
  buildPhase?: string;
  errorDetails?: string;
}

export interface BuildQueue {
  jobs: Map<string, BuildJob>;
  activeJobs: Set<string>;
  queuedJobs: string[];
  completedJobs: Set<string>;
  failedJobs: Set<string>;
}

export class BuildTracker {
  private buildDir: string;
  private stateFile: string;
  private buildQueue: BuildQueue;
  private io?: SocketIOServer;
  private saveTimer?: NodeJS.Timeout;

  constructor(buildDir: string = '/tmp/bbos-builds') {
    this.buildDir = buildDir;
    this.stateFile = path.join(buildDir, 'build-state.json');
    this.buildQueue = {
      jobs: new Map(),
      activeJobs: new Set(),
      queuedJobs: [],
      completedJobs: new Set(),
      failedJobs: new Set()
    };
  }

  /**
   * Initialize the build tracker and load existing state
   */
  async initialize(io?: SocketIOServer): Promise<void> {
    this.io = io;
    await this.ensureBuildDirectory();
    await this.loadState();
    await this.recoverActiveBuilds();
    
    // Auto-save state every 30 seconds
    this.saveTimer = setInterval(() => {
      this.saveState().catch(console.error);
    }, 30000);

    console.log('🔄 BuildTracker initialized');
    console.log(`📊 Loaded ${this.buildQueue.jobs.size} builds from state`);
    console.log(`🚀 Active builds: ${this.buildQueue.activeJobs.size}`);
    console.log(`⏳ Queued builds: ${this.buildQueue.queuedJobs.length}`);
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.saveTimer) {
      clearInterval(this.saveTimer);
    }
    await this.saveState();
    console.log('💾 BuildTracker state saved and cleaned up');
  }

  /**
   * Create a new build job
   */
  createBuild(configuration: any, userId: string = 'default-user'): BuildJob {
    const buildJob: BuildJob = {
      id: this.generateBuildId(),
      configurationId: configuration.id || this.generateBuildId(),
      userId,
      status: 'queued',
      progress: 0,
      message: 'Build job queued',
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      logs: [],
      configuration
    };

    // Add to tracking
    this.buildQueue.jobs.set(buildJob.id, buildJob);
    this.buildQueue.queuedJobs.push(buildJob.id);

    // Log the creation
    this.addBuildLog(buildJob.id, `Build job created for ${configuration.name || 'Unknown'}`);
    
    // Emit real-time update
    this.emitBuildUpdate(buildJob, 'build:created');

    // Save state immediately
    this.saveState();

    console.log(`✅ Created build job: ${buildJob.id} for user: ${userId}`);
    return buildJob;
  }

  /**
   * Start processing a build
   */
  startBuild(buildId: string): BuildJob | null {
    const job = this.buildQueue.jobs.get(buildId);
    if (!job) return null;

    // Remove from queue and add to active
    const queueIndex = this.buildQueue.queuedJobs.indexOf(buildId);
    if (queueIndex > -1) {
      this.buildQueue.queuedJobs.splice(queueIndex, 1);
    }
    this.buildQueue.activeJobs.add(buildId);

    // Update job status
    job.status = 'initializing';
    job.startedAt = new Date().toISOString();
    job.lastUpdated = new Date().toISOString();
    job.message = 'Build started - initializing...';
    job.buildPhase = 'initializing';

    this.addBuildLog(buildId, 'Build process started');
    this.emitBuildUpdate(job, 'build:started');
    this.saveState();

    console.log(`🚀 Started build: ${buildId}`);
    return job;
  }

  /**
   * Update build progress
   */
  updateBuildProgress(buildId: string, progress: BuildProgress): void {
    const job = this.buildQueue.jobs.get(buildId);
    if (!job) return;

    // Map build phases to job status
    const statusMap: Record<string, BuildJob['status']> = {
      'initializing': 'initializing',
      'downloading': 'downloading', 
      'building': 'building',
      'packaging': 'packaging',
      'uploading': 'uploading',
      'completed': 'completed'
    };

    const oldStatus = job.status;
    const newStatus = statusMap[progress.phase] || 'building';

    job.status = newStatus;
    job.progress = Math.round(progress.progress * 100) / 100; // Round to 2 decimal places
    job.message = progress.message;
    job.buildPhase = progress.phase;
    job.lastUpdated = new Date().toISOString();

    // Add detailed log entry
    this.addBuildLog(buildId, `${progress.phase}: ${progress.message} (${job.progress}%)`);

    // Emit update if status changed or significant progress
    if (oldStatus !== newStatus || this.isSignificantProgress(job.progress)) {
      this.emitBuildUpdate(job, 'build:progress');
    }

    // Save state periodically (every 5% progress or status change)
    if (oldStatus !== newStatus || job.progress % 5 < 1) {
      this.saveState();
    }
  }

  /**
   * Complete a build successfully
   */
  completeBuild(buildId: string, artifacts: any[]): void {
    const job = this.buildQueue.jobs.get(buildId);
    if (!job) return;

    job.status = 'completed';
    job.progress = 100;
    job.message = 'Build completed successfully';
    job.completedAt = new Date().toISOString();
    job.lastUpdated = new Date().toISOString();
    job.artifacts = artifacts;
    job.buildPhase = 'completed';

    // Move from active to completed
    this.buildQueue.activeJobs.delete(buildId);
    this.buildQueue.completedJobs.add(buildId);

    this.addBuildLog(buildId, `Build completed successfully with ${artifacts.length} artifacts`);
    this.emitBuildUpdate(job, 'build:completed');
    this.saveState();

    console.log(`✅ Completed build: ${buildId} with ${artifacts.length} artifacts`);
  }

  /**
   * Fail a build
   */
  failBuild(buildId: string, error: string): void {
    const job = this.buildQueue.jobs.get(buildId);
    if (!job) return;

    job.status = 'failed';
    job.message = `Build failed: ${error}`;
    job.completedAt = new Date().toISOString();
    job.lastUpdated = new Date().toISOString();
    job.errorDetails = error;
    job.buildPhase = 'failed';

    // Move from active to failed
    this.buildQueue.activeJobs.delete(buildId);
    this.buildQueue.failedJobs.add(buildId);

    this.addBuildLog(buildId, `Build failed: ${error}`);
    this.emitBuildUpdate(job, 'build:failed');
    this.saveState();

    console.error(`❌ Failed build: ${buildId} - ${error}`);
  }

  /**
   * Cancel a build
   */
  cancelBuild(buildId: string): boolean {
    const job = this.buildQueue.jobs.get(buildId);
    if (!job) return false;

    if (!['queued', 'initializing', 'downloading', 'building'].includes(job.status)) {
      return false; // Cannot cancel completed/failed builds
    }

    job.status = 'cancelled';
    job.message = 'Build cancelled by user';
    job.completedAt = new Date().toISOString();
    job.lastUpdated = new Date().toISOString();
    job.buildPhase = 'cancelled';

    // Remove from queues and active jobs
    const queueIndex = this.buildQueue.queuedJobs.indexOf(buildId);
    if (queueIndex > -1) {
      this.buildQueue.queuedJobs.splice(queueIndex, 1);
    }
    this.buildQueue.activeJobs.delete(buildId);

    this.addBuildLog(buildId, 'Build cancelled by user');
    this.emitBuildUpdate(job, 'build:cancelled');
    this.saveState();

    console.log(`🛑 Cancelled build: ${buildId}`);
    return true;
  }

  /**
   * Get build job by ID
   */
  getBuild(buildId: string): BuildJob | undefined {
    return this.buildQueue.jobs.get(buildId);
  }

  /**
   * Get builds for a user
   */
  getBuildsForUser(userId: string, options: {
    status?: string;
    limit?: number;
    offset?: number;
  } = {}): { builds: BuildJob[]; total: number } {
    let jobs = Array.from(this.buildQueue.jobs.values())
      .filter(job => job.userId === userId);

    if (options.status) {
      jobs = jobs.filter(job => job.status === options.status);
    }

    jobs = jobs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    const total = jobs.length;
    const offset = options.offset || 0;
    const limit = options.limit || 50;
    
    jobs = jobs.slice(offset, offset + limit);

    return { builds: jobs, total };
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      totalJobs: this.buildQueue.jobs.size,
      activeJobs: this.buildQueue.activeJobs.size,
      queuedJobs: this.buildQueue.queuedJobs.length,
      completedJobs: this.buildQueue.completedJobs.size,
      failedJobs: this.buildQueue.failedJobs.size
    };
  }

  /**
   * Get next queued build
   */
  getNextQueuedBuild(): string | null {
    return this.buildQueue.queuedJobs.length > 0 ? this.buildQueue.queuedJobs[0] : null;
  }

  /**
   * Check if there are active builds
   */
  hasActiveBuilds(): boolean {
    return this.buildQueue.activeJobs.size > 0;
  }

  // Private methods

  private generateBuildId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private addBuildLog(buildId: string, message: string): void {
    const job = this.buildQueue.jobs.get(buildId);
    if (!job) return;

    const logEntry = `[${new Date().toISOString()}] ${message}`;
    job.logs.push(logEntry);

    // Keep only last 1000 log entries to prevent memory issues
    if (job.logs.length > 1000) {
      job.logs = job.logs.slice(-1000);
    }
  }

  private emitBuildUpdate(job: BuildJob, eventType: string): void {
    if (!this.io) return;

    const updateData = {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      buildPhase: job.buildPhase,
      timestamp: job.lastUpdated,
      artifacts: job.artifacts
    };

    this.io.emit(eventType, updateData);
    this.io.emit('build:update', updateData);
  }

  private isSignificantProgress(progress: number): boolean {
    return progress % 10 < 1; // Emit updates every 10%
  }

  private async ensureBuildDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.buildDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create build directory:', error);
    }
  }

  private async saveState(): Promise<void> {
    try {
      const state = {
        jobs: Array.from(this.buildQueue.jobs.entries()),
        activeJobs: Array.from(this.buildQueue.activeJobs),
        queuedJobs: this.buildQueue.queuedJobs,
        completedJobs: Array.from(this.buildQueue.completedJobs),
        failedJobs: Array.from(this.buildQueue.failedJobs),
        lastSaved: new Date().toISOString()
      };

      await fs.writeFile(this.stateFile, JSON.stringify(state, null, 2));
    } catch (error) {
      console.error('Failed to save build state:', error);
    }
  }

  private async loadState(): Promise<void> {
    try {
      const stateData = await fs.readFile(this.stateFile, 'utf-8');
      const state = JSON.parse(stateData);

      // Restore jobs
      this.buildQueue.jobs = new Map(state.jobs || []);
      this.buildQueue.activeJobs = new Set(state.activeJobs || []);
      this.buildQueue.queuedJobs = state.queuedJobs || [];
      this.buildQueue.completedJobs = new Set(state.completedJobs || []);
      this.buildQueue.failedJobs = new Set(state.failedJobs || []);

      console.log(`📂 Loaded build state from ${state.lastSaved || 'unknown time'}`);
    } catch (error) {
      if ((error as any)?.code !== 'ENOENT') {
        console.error('Failed to load build state:', error);
      }
      // File doesn't exist yet, start with empty state
    }
  }

  private async recoverActiveBuilds(): Promise<void> {
    // Mark any active builds as failed if they were interrupted
    for (const buildId of this.buildQueue.activeJobs) {
      const job = this.buildQueue.jobs.get(buildId);
      if (job && job.status !== 'completed' && job.status !== 'failed' && job.status !== 'cancelled') {
        this.failBuild(buildId, 'Build interrupted due to server restart');
      }
    }

    // Clear active jobs since we're starting fresh
    this.buildQueue.activeJobs.clear();
  }
} 