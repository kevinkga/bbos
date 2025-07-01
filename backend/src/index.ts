import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs/promises';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = process.env.HOST || 'localhost';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3002'];

// Build job interfaces
interface BuildJob {
  id: string;
  configurationId: string;
  userId: string;
  status: 'queued' | 'initializing' | 'downloading' | 'building' | 'packaging' | 'uploading' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  message: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  artifacts?: Array<{
    id: string;
    name: string;
    type: 'image' | 'log' | 'config' | 'checksum';
    size: number;
    url: string;
  }>;
  logs: string[];
  configuration: any;
}

interface BuildQueue {
  jobs: Map<string, BuildJob>;
  activeJobs: Set<string>;
  queuedJobs: string[];
}

// Initialize build queue
const buildQueue: BuildQueue = {
  jobs: new Map(),
  activeJobs: new Set(),
  queuedJobs: []
};

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", "ws:", "wss:"],
    },
  },
}));

// CORS
app.use(cors({
  origin: CORS_ORIGINS,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api/', limiter);

// Compression and logging
app.use(compression());
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', (req: express.Request, res: express.Response) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
    buildQueue: {
      totalJobs: buildQueue.jobs.size,
      activeJobs: buildQueue.activeJobs.size,
      queuedJobs: buildQueue.queuedJobs.length
    }
  });
});

// API routes
app.get('/api/status', (req: express.Request, res: express.Response) => {
  res.json({ 
    message: 'BBOS Backend API is running',
    version: '1.0.0',
    environment: NODE_ENV,
    buildSystem: {
      available: true,
      activeBuilds: buildQueue.activeJobs.size,
      queuedBuilds: buildQueue.queuedJobs.length
    }
  });
});

// Build job API endpoints
app.post('/api/builds', async (req: express.Request, res: express.Response) => {
  try {
    const { configuration, userId = 'default-user' } = req.body;
    
    if (!configuration) {
      return res.status(400).json({ error: 'Configuration is required' });
    }

    const buildJob: BuildJob = {
      id: uuidv4(),
      configurationId: configuration.id || uuidv4(),
      userId,
      status: 'queued',
      progress: 0,
      message: 'Build job queued',
      createdAt: new Date().toISOString(),
      logs: [],
      configuration
    };

    // Add to queue
    buildQueue.jobs.set(buildJob.id, buildJob);
    buildQueue.queuedJobs.push(buildJob.id);

    // Emit to all clients
    io.emit('build:created', {
      id: buildJob.id,
      status: buildJob.status,
      message: buildJob.message,
      timestamp: buildJob.createdAt
    });

    // Start processing if no active jobs
    if (buildQueue.activeJobs.size === 0) {
      processNextBuild();
    }

    res.status(201).json({
      message: 'Build job created successfully',
      buildId: buildJob.id,
      status: buildJob.status,
      estimatedWaitTime: buildQueue.queuedJobs.length * 10 // 10 minutes per job estimate
    });

  } catch (error) {
    console.error('❌ Failed to create build job:', error);
    res.status(500).json({ error: 'Failed to create build job' });
  }
});

app.get('/api/builds', (req: express.Request, res: express.Response) => {
  const { userId = 'default-user', status, limit = 50 } = req.query;
  
  let jobs = Array.from(buildQueue.jobs.values())
    .filter(job => job.userId === userId);
  
  if (status) {
    jobs = jobs.filter(job => job.status === status);
  }
  
  jobs = jobs
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, parseInt(limit as string));

  res.json({
    builds: jobs.map(job => ({
      id: job.id,
      configurationId: job.configurationId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      artifacts: job.artifacts
    })),
    total: buildQueue.jobs.size
  });
});

app.get('/api/builds/:buildId', (req: express.Request, res: express.Response) => {
  const { buildId } = req.params;
  const job = buildQueue.jobs.get(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  res.json(job);
});

app.delete('/api/builds/:buildId', (req: express.Request, res: express.Response) => {
  const { buildId } = req.params;
  const job = buildQueue.jobs.get(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  // Cancel the job
  if (['queued', 'initializing', 'downloading', 'building'].includes(job.status)) {
    const wasQueued = job.status === 'queued';
    
    job.status = 'cancelled';
    job.message = 'Build cancelled by user';
    job.completedAt = new Date().toISOString();
    
    // Remove from queue if not started
    if (wasQueued) {
      const queueIndex = buildQueue.queuedJobs.indexOf(buildId);
      if (queueIndex > -1) {
        buildQueue.queuedJobs.splice(queueIndex, 1);
      }
    }
    
    // Remove from active jobs
    buildQueue.activeJobs.delete(buildId);
    
    // Emit update
    io.emit('build:cancelled', {
      id: buildId,
      status: job.status,
      message: job.message,
      timestamp: job.completedAt
    });
    
    res.json({ message: 'Build cancelled successfully' });
  } else {
    res.status(400).json({ error: 'Cannot cancel build in current status' });
  }
});

app.get('/api/builds/:buildId/logs', (req: express.Request, res: express.Response) => {
  const { buildId } = req.params;
  const job = buildQueue.jobs.get(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  res.json({
    logs: job.logs,
    lastUpdated: new Date().toISOString()
  });
});

app.get('/api/builds/:buildId/artifacts/:artifactId', async (req: express.Request, res: express.Response) => {
  const { buildId, artifactId } = req.params;
  const job = buildQueue.jobs.get(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  const artifact = job.artifacts?.find(a => a.id === artifactId);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  
  try {
    // In a real implementation, this would serve the actual file
    // For demo purposes, we'll return metadata
    res.json({
      message: 'Artifact download would start here',
      artifact: artifact,
      downloadUrl: `/download/${buildId}/${artifactId}`
    });
  } catch (error) {
    console.error('❌ Failed to serve artifact:', error);
    res.status(500).json({ error: 'Failed to serve artifact' });
  }
});

// Build processing functions
async function processNextBuild() {
  if (buildQueue.queuedJobs.length === 0 || buildQueue.activeJobs.size >= 3) {
    return; // No jobs to process or too many active
  }
  
  const buildId = buildQueue.queuedJobs.shift();
  if (!buildId) return;
  
  const job = buildQueue.jobs.get(buildId);
  if (!job) return;
  
  buildQueue.activeJobs.add(buildId);
  await simulateBuildProcess(job);
}

async function simulateBuildProcess(job: BuildJob) {
  const buildSteps = [
    { status: 'initializing' as const, message: 'Initializing build environment...', duration: 2000 },
    { status: 'downloading' as const, message: 'Downloading base images and packages...', duration: 5000 },
    { status: 'building' as const, message: 'Building Armbian image...', duration: 10000 },
    { status: 'packaging' as const, message: 'Packaging and compressing image...', duration: 3000 },
    { status: 'uploading' as const, message: 'Uploading artifacts...', duration: 2000 }
  ];

  try {
    job.startedAt = new Date().toISOString();
    
    for (let i = 0; i < buildSteps.length; i++) {
      const step = buildSteps[i];
      
      // Check if job was cancelled
      if (job.status === 'cancelled') {
        return;
      }
      
      // Update job status
      job.status = step.status;
      job.message = step.message;
      job.progress = Math.round(((i + 1) / (buildSteps.length + 1)) * 100);
      
      // Add log entry
      job.logs.push(`[${new Date().toISOString()}] ${step.message}`);
      
      // Emit progress update
      io.emit('build:progress', {
        id: job.id,
        status: job.status,
        progress: job.progress,
        message: job.message,
        timestamp: new Date().toISOString()
      });
      
      // Simulate work
      await new Promise(resolve => setTimeout(resolve, step.duration));
    }
    
    // Complete the build
    job.status = 'completed';
    job.progress = 100;
    job.message = 'Build completed successfully';
    job.completedAt = new Date().toISOString();
    
    // Add artifacts
    job.artifacts = [
      {
        id: uuidv4(),
        name: `armbian-${job.configuration.board?.name || 'unknown'}-${job.configuration.distribution?.release || 'bookworm'}.img`,
        type: 'image',
        size: 1024 * 1024 * 1024 * 2.5, // 2.5GB
        url: `/api/builds/${job.id}/artifacts/image`
      },
      {
        id: uuidv4(),
        name: 'build.log',
        type: 'log',
        size: 1024 * 256, // 256KB
        url: `/api/builds/${job.id}/artifacts/log`
      },
      {
        id: uuidv4(),
        name: 'armbian-config.json',
        type: 'config',
        size: 1024 * 4, // 4KB
        url: `/api/builds/${job.id}/artifacts/config`
      }
    ];
    
    job.logs.push(`[${new Date().toISOString()}] Build completed successfully`);
    job.logs.push(`[${new Date().toISOString()}] Generated ${job.artifacts.length} artifacts`);
    
    // Emit completion
    io.emit('build:completed', {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      artifacts: job.artifacts,
      timestamp: job.completedAt
    });
    
  } catch (error) {
    // Handle build failure
    job.status = 'failed';
    job.message = `Build failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
    job.completedAt = new Date().toISOString();
    job.logs.push(`[${new Date().toISOString()}] Build failed: ${job.message}`);
    
    io.emit('build:failed', {
      id: job.id,
      status: job.status,
      message: job.message,
      timestamp: job.completedAt
    });
  } finally {
    // Remove from active jobs
    buildQueue.activeJobs.delete(job.id);
    
    // Process next job in queue
    setTimeout(processNextBuild, 1000);
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);
  
  // Send welcome message
  socket.emit('welcome', {
    message: 'Connected to BBOS Backend',
    timestamp: new Date().toISOString()
  });

  // Handle build requests
  socket.on('build:submit', async (data) => {
    console.log('🚀 Build submission received:', data);
    
    try {
      const { configuration, userId = 'default-user' } = data;
      
      const buildJob: BuildJob = {
        id: uuidv4(),
        configurationId: configuration.id || uuidv4(),
        userId,
        status: 'queued',
        progress: 0,
        message: 'Build job queued',
        createdAt: new Date().toISOString(),
        logs: [],
        configuration
      };

      buildQueue.jobs.set(buildJob.id, buildJob);
      buildQueue.queuedJobs.push(buildJob.id);

      // Respond to submitter
      socket.emit('build:submitted', {
        buildId: buildJob.id,
        status: buildJob.status,
        queuePosition: buildQueue.queuedJobs.length,
        estimatedWaitTime: buildQueue.queuedJobs.length * 10
      });

      // Broadcast to all clients
      io.emit('build:created', {
        id: buildJob.id,
        status: buildJob.status,
        message: buildJob.message,
        timestamp: buildJob.createdAt
      });

      // Start processing if no active jobs
      if (buildQueue.activeJobs.size === 0) {
        processNextBuild();
      }

    } catch (error) {
      console.error('❌ Build submission failed:', error);
      socket.emit('build:error', {
        error: 'Failed to submit build job',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('build:cancel', (data) => {
    console.log('🛑 Build cancellation requested:', data);
    const { buildId } = data;
    const job = buildQueue.jobs.get(buildId);
    
    if (job && ['queued', 'initializing', 'downloading', 'building'].includes(job.status)) {
      job.status = 'cancelled';
      job.message = 'Build cancelled by user';
      job.completedAt = new Date().toISOString();
      
      // Remove from queue and active jobs
      const queueIndex = buildQueue.queuedJobs.indexOf(buildId);
      if (queueIndex > -1) {
        buildQueue.queuedJobs.splice(queueIndex, 1);
      }
      buildQueue.activeJobs.delete(buildId);
      
      io.emit('build:cancelled', {
        id: buildId,
        status: job.status,
        message: job.message,
        timestamp: job.completedAt
      });
    }
  });

  socket.on('build:getLogs', (data) => {
    console.log('📋 Build logs requested:', data);
    const { buildId } = data;
    const job = buildQueue.jobs.get(buildId);
    
    if (job) {
      socket.emit('build:logs', {
        buildId,
        logs: job.logs,
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('build:refresh', () => {
    console.log('🔄 Build status refresh requested');
    const builds = Array.from(buildQueue.jobs.values())
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
    
    socket.emit('build:list', {
      builds: builds.map(job => ({
        id: job.id,
        configurationId: job.configurationId,
        status: job.status,
        progress: job.progress,
        message: job.message,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
        artifacts: job.artifacts
      })),
      timestamp: new Date().toISOString()
    });
  });

  // Legacy event handlers for backward compatibility
  socket.on('build:start', (data) => {
    console.log('🚀 Legacy build start event:', data);
    socket.emit('build:status', {
      type: 'started',
      timestamp: new Date().toISOString(),
      ...data
    });
  });

  socket.on('build:progress', (data) => {
    console.log('⏳ Legacy build progress event:', data);
    io.emit('build:status', {
      type: 'progress',
      timestamp: new Date().toISOString(),
      ...data
    });
  });

  socket.on('build:complete', (data) => {
    console.log('✅ Legacy build complete event:', data);
    io.emit('build:status', {
      type: 'completed',
      timestamp: new Date().toISOString(),
      ...data
    });
  });

  socket.on('build:error', (data) => {
    console.log('❌ Legacy build error event:', data);
    io.emit('build:status', {
      type: 'error',
      timestamp: new Date().toISOString(),
      ...data
    });
  });

  // Handle armbian config updates
  socket.on('config:update', (data) => {
    console.log('⚙️ Config updated:', data);
    socket.broadcast.emit('config:changed', {
      timestamp: new Date().toISOString(),
      ...data
    });
  });

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Client disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// Error handling middleware
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('❌ Unhandled error:', err);
  res.status(500).json({
    error: NODE_ENV === 'production' ? 'Internal server error' : err.message,
    timestamp: new Date().toISOString()
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl,
    timestamp: new Date().toISOString()
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully');
  httpServer.close(() => {
    console.log('✅ HTTP server closed');
    process.exit(0);
  });
});

// Start server
httpServer.listen(PORT, () => {
  console.log('🚀 BBOS Backend Server started');
  console.log(`📡 Server running on http://localhost:${PORT}`);
  console.log(`🌐 Environment: ${NODE_ENV}`);
  console.log(`🔌 Socket.io enabled for real-time communication`);
  console.log(`🏗️ Build server ready for job processing`);
  
  if (NODE_ENV === 'development') {
    console.log('🔥 Hot Module Reload enabled via tsx watch');
  }
});

export default app; 