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
import { ArmbianBuilder, ArmbianConfiguration } from './services/armbianBuilder.js';
import { BuildTracker, BuildJob } from './services/buildTracker.js';

// Load environment variables
dotenv.config();

const PORT = parseInt(process.env.PORT || '3001', 10);
const NODE_ENV = process.env.NODE_ENV || 'development';
const HOST = process.env.HOST || 'localhost';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3000';
const CORS_ORIGINS = process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000', 'http://localhost:3002'];

// Initialize services
const buildTracker = new BuildTracker(process.env.BUILD_DIR || '/tmp/bbos-builds');
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
  const queueStatus = buildTracker.getQueueStatus();
  
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: NODE_ENV,
    version: '1.0.0',
    buildSystem: {
      demoMode: process.env.DEMO_MODE ? 
        process.env.DEMO_MODE.toLowerCase() === 'true' : 
        NODE_ENV === 'development',
      buildDir: process.env.BUILD_DIR || '/tmp/bbos-builds',
      downloadCache: process.env.DOWNLOAD_CACHE || '/tmp/bbos-cache'
    },
    buildQueue: queueStatus
  });
});

// API routes
app.get('/api/status', (req: express.Request, res: express.Response) => {
  const queueStatus = buildTracker.getQueueStatus();
  
  res.json({ 
    message: 'BBOS Backend API is running',
    version: '1.0.0',
    environment: NODE_ENV,
    buildSystem: {
      available: true,
      activeBuilds: queueStatus.activeJobs,
      queuedBuilds: queueStatus.queuedJobs
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

    console.log('🚀 Build start requested from frontend:', {
      config: configuration
    });

    // Create build job using BuildTracker
    const buildJob = buildTracker.createBuild(configuration, userId);

    // Start processing if no active jobs
    if (!buildTracker.hasActiveBuilds()) {
      setTimeout(processNextBuild, 1000);
    }

    res.status(201).json({
      message: 'Build job created successfully',
      buildId: buildJob.id,
      status: buildJob.status,
      estimatedWaitTime: buildTracker.getQueueStatus().queuedJobs * 10 // 10 minutes per job estimate
    });

  } catch (error) {
    console.error('❌ Failed to create build job:', error);
    res.status(500).json({ error: 'Failed to create build job' });
  }
});

app.get('/api/builds', (req: express.Request, res: express.Response) => {
  const { userId = 'default-user', status, limit = 50, offset = 0 } = req.query;
  
  const result = buildTracker.getBuildsForUser(userId as string, {
    status: status as string,
    limit: parseInt(limit as string),
    offset: parseInt(offset as string)
  });

  res.json({
    builds: result.builds.map(job => ({
      id: job.id,
      configurationId: job.configurationId,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      lastUpdated: job.lastUpdated,
      buildPhase: job.buildPhase,
      artifacts: job.artifacts
    })),
    total: result.total
  });
});

app.get('/api/builds/:buildId', (req: express.Request, res: express.Response) => {
  const { buildId } = req.params;
  const job = buildTracker.getBuild(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  res.json(job);
});

app.delete('/api/builds/:buildId', (req: express.Request, res: express.Response) => {
  const { buildId } = req.params;
  const job = buildTracker.getBuild(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  const cancelled = buildTracker.cancelBuild(buildId);
  
  if (cancelled) {
    res.json({ message: 'Build cancelled successfully' });
  } else {
    res.status(400).json({ error: 'Cannot cancel build in current status' });
  }
});

app.get('/api/builds/:buildId/logs', (req: express.Request, res: express.Response) => {
  const { buildId } = req.params;
  const job = buildTracker.getBuild(buildId);
  
  if (!job) {
    return res.status(404).json({ error: 'Build job not found' });
  }
  
  res.json({
    logs: job.logs,
    lastUpdated: job.lastUpdated
  });
});

app.get('/api/builds/:buildId/artifacts/:filename', async (req: express.Request, res: express.Response) => {
  const { buildId, filename } = req.params;
  const job = buildTracker.getBuild(buildId);
  
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

    // Set appropriate headers for download
    res.setHeader('Content-Type', getContentType(artifact.type));
    res.setHeader('Content-Disposition', `attachment; filename="${artifact.name}"`);
    res.setHeader('Content-Length', artifact.size.toString());
    
    // Stream the file
    const fs = await import('fs');
    const fileStream = fs.createReadStream(artifact.path);
    
    fileStream.on('error', (err) => {
      console.error(`Error streaming artifact ${filename}:`, err);
      res.status(500).json({ error: 'Failed to stream artifact' });
    });
    
    fileStream.pipe(res);
    
  } catch (error) {
    console.error(`❌ Failed to serve artifact ${filename}:`, error);
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
  const nextBuildId = buildTracker.getNextQueuedBuild();
  if (!nextBuildId || buildTracker.hasActiveBuilds()) {
    return; // No jobs to process or already processing
  }
  
  const job = buildTracker.startBuild(nextBuildId);
  if (!job) return;

  await executeBuildProcess(job);
}

async function executeBuildProcess(job: BuildJob) {
  try {
    console.log(`🚀 Starting build process for job ${job.id}`);
    
    // Generate build configuration
    buildTracker.updateBuildProgress(job.id, {
      phase: 'initializing',
      progress: 5,
      message: 'Generating build configuration...',
      timestamp: new Date().toISOString()
    });

    const configDir = await armbianBuilder.generateBuildConfig(job.configuration as ArmbianConfiguration, job.id);
    
    buildTracker.updateBuildProgress(job.id, {
      phase: 'initializing',
      progress: 10,
      message: `Build configuration generated at ${configDir}`,
      timestamp: new Date().toISOString()
    });

    // Execute the build with progress tracking
    const onProgress = (progress: any) => {
      buildTracker.updateBuildProgress(job.id, progress);
    };

    // Execute the build
    const artifacts = await armbianBuilder.executeBuild(configDir, job.id, onProgress);
    
    // Complete the build
    buildTracker.completeBuild(job.id, artifacts);
    
  } catch (error) {
    // Handle build failure
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    buildTracker.failBuild(job.id, errorMessage);
    
    console.error(`❌ Build ${job.id} failed:`, error);
  } finally {
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
      
      const buildJob = buildTracker.createBuild(configuration, userId);

      // Respond to submitter
      socket.emit('build:submitted', {
        buildId: buildJob.id,
        status: buildJob.status,
        queuePosition: buildTracker.getQueueStatus().queuedJobs,
        estimatedWaitTime: buildTracker.getQueueStatus().queuedJobs * 10
      });

      // Start processing if no active jobs
      if (!buildTracker.hasActiveBuilds()) {
        setTimeout(processNextBuild, 1000);
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
    
    const cancelled = buildTracker.cancelBuild(buildId);
    
    if (cancelled) {
      socket.emit('build:cancelled', {
        buildId: buildId,
        message: 'Build cancelled successfully',
        timestamp: new Date().toISOString()
      });
    } else {
      socket.emit('build:error', {
        error: 'Cannot cancel build in current status',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('disconnect', () => {
    console.log(`🔌 Client disconnected: ${socket.id}`);
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
process.on('SIGTERM', async () => {
  console.log('🛑 SIGTERM signal received: closing HTTP server');
  await buildTracker.cleanup();
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  console.log('🛑 SIGINT signal received: closing HTTP server');
  await buildTracker.cleanup();
  httpServer.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize BuildTracker with Socket.IO
    await buildTracker.initialize(io);
    
    httpServer.listen(PORT, () => {
      console.log(`🚀 BBOS Backend running on port ${PORT}`);
      console.log(`📡 Environment: ${NODE_ENV}`);
      console.log(`🔗 CORS origins: ${CORS_ORIGINS.join(', ')}`);
      console.log(`💾 Build tracking: ENABLED with persistence`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app; 