import express from 'express';
import dotenv from 'dotenv';
import { logger } from './utils/logger';
import { initializeDatabase, closeDatabase } from './utils/database-init';
import { createSecureServer, validateTLSConfig } from './config/tls';
import { apiGateway } from './middleware/apiGateway';
import { rateLimiter } from './middleware/rateLimiter';
import { authenticate } from './middleware/auth';
import { auditLog } from './middleware/audit';
import {
  globalErrorHandler,
  notFoundHandler,
  setupUnhandledRejectionHandler,
  setupUncaughtExceptionHandler
} from './middleware/errorHandler';
import authRoutes from './routes/auth.routes';
import auditRoutes from './routes/audit.routes';
import qualityRoutes from './routes/quality.routes';
import patientsRoutes from './routes/patients.routes';
import performanceRoutes from './routes/performance.routes';
import biasRoutes from './routes/bias.routes';
import errorRoutes from './routes/error.routes';
import llmRoutes from './routes/llm.routes';
import ragRoutes from './routes/rag.routes';
import explainabilityRoutes from './routes/explainability.routes';
import guardrailsRoutes from './routes/guardrails.routes';
import clinicalRoutes from './routes/clinical.routes';
import radiologyRoutes from './routes/radiology.routes';
import documentationRoutes from './routes/documentation.routes';
import visionRoutes from './routes/vision.routes';
import workflowRoutes from './routes/workflow.routes';
import gatewayRoutes from './routes/gateway.routes';
import emrRoutes from './routes/emr.routes';

// Load environment variables
dotenv.config();

// Setup global error handlers
setupUnhandledRejectionHandler();
setupUncaughtExceptionHandler();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());

// API Gateway middleware
app.use(apiGateway.requestIdMiddleware());
app.use(apiGateway.requestLogger());
app.use(apiGateway.responseTimeMiddleware());
app.use(apiGateway.corsMiddleware());
app.use(apiGateway.loadBalancingMiddleware());

// Rate limiting
app.use(rateLimiter.middleware());

// Authentication and audit logging (optional - can be disabled in development)
if (process.env.AUTH_ENABLED !== 'false') {
  app.use(authenticate());
  app.use(auditLog());
}

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// API Routes (public - no auth required)
app.use('/api/auth', authRoutes);

// API Routes (authenticated)
app.use('/api/gateway', gatewayRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/quality', qualityRoutes);
app.use('/api/patients', patientsRoutes);
app.use('/api/data', patientsRoutes); // For /api/data/anonymize
app.use('/api/performance', performanceRoutes);
app.use('/api/bias', biasRoutes);
app.use('/api/errors', errorRoutes);
app.use('/api/llm', llmRoutes);
app.use('/api/rag', ragRoutes);
app.use('/api/explainability', explainabilityRoutes);
app.use('/api/guardrails', guardrailsRoutes);
app.use('/api/clinical', clinicalRoutes);
app.use('/api/radiology', radiologyRoutes);
app.use('/api/documents', documentationRoutes);
app.use('/api/vision', visionRoutes);
app.use('/api/workflow', workflowRoutes);
app.use('/api/emr', emrRoutes);

// Error handling middleware (must be last)
app.use(notFoundHandler);
app.use(globalErrorHandler);

// Initialize and start server
async function startServer() {
  try {
    // Validate TLS configuration
    validateTLSConfig();

    // Initialize database
    await initializeDatabase();

    // Create server (HTTPS if TLS enabled, HTTP otherwise)
    const secureServer = createSecureServer(app);
    
    if (secureServer) {
      secureServer.listen(PORT, () => {
        logger.info(`MedSutra AI HTTPS server started on port ${PORT}`);
        logger.info(`Deployment mode: ${process.env.DEPLOYMENT_MODE || 'ON_PREM'}`);
        logger.info('TLS 1.3 encryption enabled');
      });
    } else {
      app.listen(PORT, () => {
        logger.info(`MedSutra AI HTTP server started on port ${PORT}`);
        logger.info(`Deployment mode: ${process.env.DEPLOYMENT_MODE || 'ON_PREM'}`);
        logger.warn('TLS is disabled - use only in development!');
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  await closeDatabase();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT signal received: closing HTTP server');
  await closeDatabase();
  process.exit(0);
});

startServer();

export default app;
