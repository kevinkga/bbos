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
import ArmbianBuilder, { ArmbianConfiguration, BuildArtifact, BuildProgress } from './services/armbianBuilder.js';

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
    type: 'image' | 'log' | 'config' | 'checksum' | 'packages';
    size: number;
    path: string;
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

// Initialize Armbian builder
const armbianBuilder = new ArmbianBuilder();

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

app.get('/api/builds/:buildId/artifacts/:filename', async (req: express.Request, res: express.Response) => {
  const { buildId, filename } = req.params;
  const job = buildQueue.jobs.get(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  const artifact = job.artifacts?.find(a => a.name === filename);
  if (!artifact) {
    return res.status(404).json({ error: 'Artifact not found' });
  }
  
  try {
    // Check if the artifact has a file path
    if (!artifact.path) {
      return res.json({
        message: 'Artifact metadata (no file to download)',
        artifact: artifact
      });
    }

    // Check if file exists
    try {
      await fs.access(artifact.path);
    } catch {
      return res.status(404).json({ error: 'Artifact file not found on disk' });
    }
    
    // Set appropriate headers
    res.setHeader('Content-Type', getContentType(artifact.type));
    res.setHeader('Content-Length', artifact.size);
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.name}"`);
    
    // Stream the file
    const fileStream = require('fs').createReadStream(artifact.path);
    fileStream.pipe(res);
    
    fileStream.on('error', (error: Error) => {
      console.error('Error streaming file:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Error serving file' });
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to serve artifact:', error);
    res.status(500).json({ error: 'Failed to serve artifact' });
  }
});

// Helper function to get content type
function getContentType(artifactType: string): string {
  switch (artifactType) {
    case 'image': return 'application/octet-stream';
    case 'log': return 'text/plain';
    case 'config': return 'application/json';
    case 'checksum': return 'text/plain';
    case 'packages': return 'text/plain';
    default: return 'application/octet-stream';
  }
}

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
  await executeBuildProcess(job);
}

async function executeBuildProcess(job: BuildJob) {
  try {
    console.log(`🚀 Starting build process for job ${job.id}`);
    job.startedAt = new Date().toISOString();
    
    // Generate build configuration
    job.status = 'initializing';
    job.message = 'Generating build configuration...';
    job.logs.push(`[${new Date().toISOString()}] ${job.message}`);
    
    io.emit('build:update', {
      id: job.id,
      status: job.status,
      progress: 5,
      message: job.message,
      timestamp: new Date().toISOString()
    });

    const configDir = await armbianBuilder.generateBuildConfig(job.configuration as ArmbianConfiguration, job.id);
    job.logs.push(`[${new Date().toISOString()}] Build configuration generated at ${configDir}`);

    // Execute the build
    const onProgress = (progress: BuildProgress) => {
      // Map build phases to job status
      const statusMap: Record<string, BuildJob['status']> = {
        'initializing': 'initializing',
        'downloading': 'downloading', 
        'building': 'building',
        'packaging': 'packaging',
        'uploading': 'uploading',
        'completed': 'completed'
      };

      job.status = statusMap[progress.phase] || 'building';
      job.progress = progress.progress;
      job.message = progress.message;
      job.logs.push(`[${progress.timestamp}] ${progress.message}`);

      // Emit real-time updates
      io.emit('build:update', {
        id: job.id,
        status: job.status,
        progress: job.progress,
        message: job.message,
        timestamp: progress.timestamp
      });
    };

    // Execute the build
    const artifacts = await armbianBuilder.executeBuild(configDir, job.id, onProgress);
    
    // Complete the build
    job.status = 'completed';
    job.progress = 100;
    job.message = 'Build completed successfully';
    job.completedAt = new Date().toISOString();
    job.artifacts = artifacts;
    
    job.logs.push(`[${new Date().toISOString()}] Build completed successfully`);
    job.logs.push(`[${new Date().toISOString()}] Generated ${artifacts.length} artifacts`);
    
    // Emit completion
    io.emit('build:update', {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      timestamp: job.completedAt
    });
    
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
    
    console.error(`❌ Build ${job.id} failed:`, error);
    
    io.emit('build:update', {
      id: job.id,
      status: job.status,
      progress: job.progress,
      message: job.message,
      timestamp: job.completedAt
    });
    
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

  // Handle build start requests from frontend
  socket.on('build:start', async (data) => {
    console.log('🚀 Build start requested from frontend:', data);
    
    try {
      const { config, userId = 'default-user' } = data;
      
      if (!config) {
        socket.emit('build:error', {
          error: 'Configuration is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const buildJob: BuildJob = {
        id: uuidv4(),
        configurationId: config.id || uuidv4(),
        userId,
        status: 'queued',
        progress: 0,
        message: 'Build job queued',
        createdAt: new Date().toISOString(),
        logs: [`[${new Date().toISOString()}] Build job created for configuration: ${config.name || 'Unknown'}`],
        configuration: config
      };

      buildQueue.jobs.set(buildJob.id, buildJob);
      buildQueue.queuedJobs.push(buildJob.id);

      // Respond to submitter with build ID
      socket.emit('build:update', {
        id: buildJob.id,
        status: buildJob.status,
        progress: buildJob.progress,
        message: buildJob.message,
        timestamp: buildJob.createdAt
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
      console.error('❌ Build start failed:', error);
      socket.emit('build:error', {
        error: 'Failed to start build job',
        timestamp: new Date().toISOString()
      });
    }
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