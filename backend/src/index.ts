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
import * as fsSync from 'fs';
import * as zlib from 'zlib';
import { ArmbianBuilder, ArmbianConfiguration } from './services/armbianBuilder.js';
import { BuildTracker, BuildJob } from './services/buildTracker.js';
import { HardwareFlasher, FlashProgress } from './services/hardwareFlasher.js';

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
const hardwareFlasher = new HardwareFlasher();

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
app.use(compression({
  // Use compression level 6 for good balance of speed/compression
  level: 6,
  // Only compress files larger than 1KB
  threshold: 1024,
  // Allow disabling compression with header
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  }
}));
app.use(morgan(NODE_ENV === 'production' ? 'combined' : 'dev'));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check endpoint
app.get('/health', async (req: express.Request, res: express.Response) => {
  const queueStatus = buildTracker.getQueueStatus();
  const hardwareAvailable = await hardwareFlasher.isAvailable();
  
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
    buildQueue: queueStatus,
    hardwareFlashing: {
      available: hardwareAvailable,
      toolPath: hardwareAvailable ? `${process.env.HOME}/rkdeveloptool/rkdeveloptool` : null
    }
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

// Hardware flashing API endpoints
app.get('/api/hardware/capabilities', async (req: express.Request, res: express.Response) => {
  try {
    const capabilities = await hardwareFlasher.getCapabilities();
    res.json(capabilities);
  } catch (error) {
    console.error('❌ Failed to get hardware capabilities:', error);
    res.status(500).json({ error: 'Failed to get hardware capabilities' });
  }
});

// Device detection control endpoint
app.put('/api/hardware/device-detection', (req: express.Request, res: express.Response) => {
  try {
    const { enabled } = req.body;
    
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ error: 'enabled must be a boolean value' });
    }
    
    hardwareFlasher.setDeviceDetectionEnabled(enabled);
    
    res.json({ 
      message: `Device detection ${enabled ? 'enabled' : 'disabled'}`,
      enabled,
      reason: enabled ? 'Backend device detection active' : 'Disabled to prevent Web Serial conflicts'
    });
  } catch (error) {
    console.error('❌ Failed to control device detection:', error);
    res.status(500).json({ error: 'Failed to control device detection' });
  }
});

app.get('/api/hardware/devices', async (req: express.Request, res: express.Response) => {
  try {
    const force = req.query.force === 'true';
    const devices = await hardwareFlasher.detectDevices(force);
    res.json({ 
      devices,
      force,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('❌ Failed to detect devices:', error);
    res.status(500).json({ error: 'Failed to detect devices' });
  }
});

app.get('/api/hardware/devices/:deviceId/storage', async (req: express.Request, res: express.Response) => {
  try {
    const { deviceId } = req.params;
    
    // First ensure the device exists
    const devices = await hardwareFlasher.detectDevices();
    const device = devices.find(d => d.id === deviceId);
    
    if (!device) {
      return res.status(404).json({ error: 'Device not found or not in proper mode for storage detection' });
    }

    if (device.type === 'maskrom') {
      return res.status(400).json({ 
        error: 'Device is in maskrom mode. Load bootloader first to detect storage.',
        suggestion: 'Use rkdeveloptool db <loader.bin> to load bootloader, then retry storage detection.'
      });
    }

    // Detect available storage with detailed information
    const storageDevices = await hardwareFlasher.detectStorageDevices(deviceId);
    const availableDevices = storageDevices.filter(d => d.available);
    const recommended = storageDevices.find(d => d.recommended && d.available);
    
    res.json({
      deviceId,
      devices: storageDevices,
      timestamp: new Date().toISOString(),
      recommendations: {
        primary: recommended?.type || (availableDevices.length > 0 ? availableDevices[0].type : null),
        warning: availableDevices.length === 0 ? 'No storage detected! Please insert SD card or check eMMC connection.' : null
      }
    });
    
  } catch (error) {
    console.error('❌ Failed to detect storage:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

// Stream compressed images endpoint
app.get('/api/builds/:buildId/artifacts/:artifactName/compressed', async (req: express.Request, res: express.Response) => {
  try {
    const { buildId, artifactName } = req.params;
    
    // Get the build job
    const buildJob = buildTracker.getBuild(buildId);
    if (!buildJob) {
      return res.status(404).json({ error: 'Build job not found' });
    }

    // Find the requested artifact
    const artifact = buildJob.artifacts?.find(a => a.name === artifactName);
    if (!artifact) {
      return res.status(404).json({ error: 'Artifact not found' });
    }

    const artifactPath = artifact.path;
    
    // Check if the artifact file exists
    try {
      await fs.access(artifactPath);
    } catch (error) {
      return res.status(404).json({ error: 'Artifact file not found on disk' });
    }

    // Set appropriate headers for streaming compressed content
    res.setHeader('Content-Type', 'application/gzip');
    // Note: Don't set Content-Encoding: gzip as it causes browser auto-decompression
    res.setHeader('Content-Disposition', `attachment; filename="${artifactName}.gz"`);
    res.setHeader('Transfer-Encoding', 'chunked');
    
    // Stream the file through gzip compression
    const readStream = fsSync.createReadStream(artifactPath);
    const gzip = zlib.createGzip({ level: 6 }); // Good compression/speed balance
    
    // Track progress for large files
    const stats = await fs.stat(artifactPath);
    let bytesRead = 0;
    
    readStream.on('data', (chunk: Buffer) => {
      bytesRead += chunk.length;
      // Emit progress updates via Socket.IO if needed
      const progress = (bytesRead / stats.size) * 100;
      io.emit('compression:progress', {
        buildId,
        artifactName,
        progress: Math.round(progress),
        bytesRead,
        totalBytes: stats.size
      });
    });

    // Handle errors
    readStream.on('error', (error: Error) => {
      console.error(`❌ Error reading artifact ${artifactName}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to read artifact file' });
      }
    });

    gzip.on('error', (error: Error) => {
      console.error(`❌ Error compressing artifact ${artifactName}:`, error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to compress artifact' });
      }
    });

    // Pipe the file through gzip to the response
    readStream.pipe(gzip).pipe(res);
    
    console.log(`📦 Streaming compressed artifact: ${artifactName} (${(stats.size / 1024 / 1024).toFixed(1)} MB)`);
    
  } catch (error) {
    console.error('❌ Failed to stream compressed artifact:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: (error as Error).message });
    }
  }
});

app.post('/api/hardware/flash', async (req: express.Request, res: express.Response) => {
  try {
    const { buildId, deviceId, storageTarget = 'emmc' } = req.body;
    
    if (!buildId || !deviceId) {
      return res.status(400).json({ error: 'buildId and deviceId are required' });
    }

    if (!['emmc', 'sd', 'spinor'].includes(storageTarget)) {
      return res.status(400).json({ error: 'storageTarget must be one of: emmc, sd, spinor' });
    }

    // Get the build job to find the image path
    const buildJob = buildTracker.getBuild(buildId);
    if (!buildJob) {
      return res.status(404).json({ error: 'Build job not found' });
    }

    // Find the main image artifact
    const imageArtifact = buildJob.artifacts?.find(a => a.type === 'image' && a.name.includes('BBOS_Armbian'));
    if (!imageArtifact) {
      return res.status(404).json({ error: 'No image artifact found for this build' });
    }

    console.log(`🔥 Flash request: Build ${buildId} → Device ${deviceId} (${storageTarget.toUpperCase()})`);

    // Start flashing process
    const flashJobId = await hardwareFlasher.flashImage(
      buildId,
      imageArtifact.path,
      deviceId,
      (progress: FlashProgress) => {
        // Emit real-time progress via Socket.IO
        io.emit('flash:progress', {
          flashJobId,
          buildId,
          deviceId,
          storageTarget,
          ...progress
        });
      },
      storageTarget as 'emmc' | 'sd' | 'spinor'
    );

    res.status(201).json({
      message: 'Flash process started',
      flashJobId,
      buildId,
      deviceId,
      imagePath: imageArtifact.path,
      storageTarget
    });

  } catch (error) {
    console.error('❌ Failed to start flash process:', error);
    res.status(500).json({ error: (error as Error).message });
  }
});

app.get('/api/hardware/flash/:flashJobId', (req: express.Request, res: express.Response) => {
  const { flashJobId } = req.params;
  const flashJob = hardwareFlasher.getFlashJob(flashJobId);
  
  if (!flashJob) {
    return res.status(404).json({ error: 'Flash job not found' });
  }
  
  res.json(flashJob);
});

app.get('/api/hardware/flash', (req: express.Request, res: express.Response) => {
  const flashJobs = hardwareFlasher.getAllFlashJobs();
  res.json({ flashJobs });
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

  // Hardware flashing event handlers
  socket.on('hardware:detect', async (data: { force?: boolean } = {}) => {
    try {
      const force = data.force || false;
      const devices = await hardwareFlasher.detectDevices(force);
      socket.emit('hardware:devices', {
        devices,
        force,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('hardware:error', {
        error: 'Failed to detect devices',
        timestamp: new Date().toISOString()
      });
    }
  });

  // Device detection control via WebSocket
  socket.on('hardware:set-detection', (data: { enabled: boolean }) => {
    try {
      const { enabled } = data;
      hardwareFlasher.setDeviceDetectionEnabled(enabled);
      socket.emit('hardware:detection-changed', {
        enabled,
        message: `Device detection ${enabled ? 'enabled' : 'disabled'}`,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('hardware:error', {
        error: 'Failed to control device detection',
        timestamp: new Date().toISOString()
      });
    }
  });

  socket.on('hardware:flash', async (data) => {
    console.log('🔥 Hardware flash request:', data);
    
    try {
      const { buildId, deviceId } = data;
      
      // Get the build job to find the image path
      const buildJob = buildTracker.getBuild(buildId);
      if (!buildJob) {
        socket.emit('hardware:error', {
          error: 'Build job not found',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Find the main image artifact
      const imageArtifact = buildJob.artifacts?.find(a => a.type === 'image' && a.name.includes('BBOS_Armbian'));
      if (!imageArtifact) {
        socket.emit('hardware:error', {
          error: 'No image artifact found for this build',
          timestamp: new Date().toISOString()
        });
        return;
      }

      // Start flashing process
      const flashJobId = await hardwareFlasher.flashImage(
        buildId,
        imageArtifact.path,
        deviceId,
        (progress: FlashProgress) => {
          // Emit real-time progress to all connected clients
          io.emit('flash:progress', {
            flashJobId,
            buildId,
            deviceId,
            ...progress
          });
        }
      );

      socket.emit('hardware:flash:started', {
        flashJobId,
        buildId,
        deviceId,
        message: 'Flash process started successfully',
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      console.error('❌ Hardware flash failed:', error);
      socket.emit('hardware:error', {
        error: (error as Error).message,
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