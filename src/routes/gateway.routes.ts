import { Router, Request, Response } from 'express';
import { apiGateway } from '../middleware/apiGateway';
import { rateLimiter } from '../middleware/rateLimiter';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/gateway/health
 * Health check endpoint
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

/**
 * GET /api/gateway/status
 * Get gateway status and load information
 */
router.get('/status', (req: Request, res: Response) => {
  const loadStats = apiGateway.getLoadStatistics();
  const rateLimitStats = rateLimiter.getStatistics();

  res.json({
    success: true,
    gateway: {
      load: loadStats,
      rateLimit: rateLimitStats,
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/gateway/metrics
 * Get detailed gateway metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  const loadStats = apiGateway.getLoadStatistics();

  res.json({
    success: true,
    metrics: {
      requests: {
        active: loadStats.activeRequests,
        queued: loadStats.queuedRequests,
        maxConcurrent: loadStats.maxConcurrentRequests
      },
      capacity: {
        used: loadStats.capacityUsed,
        available: 100 - loadStats.capacityUsed,
        isOverCapacity: loadStats.isOverCapacity
      },
      system: {
        uptime: process.uptime(),
        memory: {
          used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
          total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024),
          unit: 'MB'
        },
        cpu: process.cpuUsage()
      },
      timestamp: new Date().toISOString()
    }
  });
});

/**
 * GET /api/gateway/routes
 * List all available API routes
 */
router.get('/routes', (req: Request, res: Response) => {
  res.json({
    success: true,
    routes: {
      clinical: {
        base: '/api/clinical',
        endpoints: [
          'POST /summarize - Generate patient snapshot',
          'POST /extract-entities - Extract medical entities',
          'POST /normalize-entity - Normalize entity to ontology',
          'POST /ambiguous-term - Handle ambiguous terms'
        ]
      },
      radiology: {
        base: '/api/radiology',
        endpoints: [
          'POST /analyze - Analyze radiology report',
          'POST /no-findings - Handle no-findings report',
          'GET /risk-levels - Get risk levels',
          'GET /organs - Get supported organs'
        ]
      },
      vision: {
        base: '/api/vision',
        endpoints: [
          'GET /status - Check if enabled',
          'POST /analyze - Analyze medical image',
          'POST /validate-coordinates - Validate coordinates',
          'POST /multimodal-fusion - Fuse image and text analysis',
          'POST /handle-corrupted - Handle corrupted image'
        ]
      },
      documentation: {
        base: '/api/documents',
        endpoints: [
          'POST /draft - Generate document draft',
          'GET /:id - Get draft by ID',
          'PUT /:id/edit - Edit draft section',
          'POST /:id/review - Submit for review',
          'POST /:id/approve - Approve document',
          'POST /:id/reject - Reject document',
          'GET /:id/workflow - Get workflow status',
          'GET /patient/:patientId - Get patient drafts',
          'GET /templates - Get templates',
          'GET /statistics - Get statistics'
        ]
      },
      workflow: {
        base: '/api/workflow',
        endpoints: [
          'POST /suggestions - Generate workflow suggestions',
          'GET /suggestions/:id - Get suggestion by ID',
          'POST /suggestions/:id/respond - Respond to suggestion',
          'GET /suggestions/patient/:patientId - Get patient suggestions',
          'POST /patient-summary - Generate patient summary',
          'POST /translate-jargon - Translate medical jargon',
          'POST /evaluate-referral - Evaluate referral need',
          'GET /statistics - Get statistics',
          'GET /languages - Get supported languages'
        ]
      },
      llm: {
        base: '/api/llm',
        endpoints: [
          'POST /generate - Generate text',
          'POST /embed - Generate embeddings',
          'POST /classify - Classify text',
          'GET /models - List models',
          'GET /cache/stats - Cache statistics',
          'DELETE /cache/clear - Clear cache',
          'GET /monitor/stats - Monitor statistics'
        ]
      },
      rag: {
        base: '/api/rag',
        endpoints: [
          'POST /query - Query documents',
          'POST /validate - Validate statement',
          'POST /documents - Add document',
          'GET /documents/:id - Get document',
          'PUT /documents/:id - Update document',
          'DELETE /documents/:id - Delete document',
          'GET /stats - Get statistics',
          'POST /initialize - Initialize with guidelines'
        ]
      },
      explainability: {
        base: '/api/explainability',
        endpoints: [
          'POST /explain - Explain suggestion',
          'POST /cite - Cite sources',
          'POST /risk - Explain risk flag',
          'POST /detailed - Get detailed reasoning',
          'POST /summary - Get summary explanation'
        ]
      },
      guardrails: {
        base: '/api/guardrails',
        endpoints: [
          'POST /validate - Validate statement',
          'POST /validate-document - Validate document',
          'POST /contradictions - Detect contradictions',
          'GET /flagged - Get flagged statements',
          'POST /review - Review flagged statement',
          'GET /disclaimer - Get AI disclaimer',
          'GET /stats - Get statistics'
        ]
      },
      gateway: {
        base: '/api/gateway',
        endpoints: [
          'GET /health - Health check',
          'GET /status - Gateway status',
          'GET /metrics - Gateway metrics',
          'GET /routes - List all routes'
        ]
      }
    }
  });
});

export default router;
