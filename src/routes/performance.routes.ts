import { Router, Response } from 'express';
import { PerformanceOptimizer } from '../services/performance';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const performanceOptimizer = new PerformanceOptimizer();

/**
 * GET /api/performance/metrics
 * Get current performance metrics (admin only)
 */
router.get(
  '/metrics',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const metrics = performanceOptimizer.getCurrentMetrics();
      res.json(metrics);
    } catch (error: any) {
      logger.error('Get performance metrics error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get performance metrics'
      });
    }
  }
);

/**
 * GET /api/performance/metrics/history
 * Get performance metrics history (admin only)
 */
router.get(
  '/metrics/history',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { limit = '100' } = req.query;
      const history = performanceOptimizer.getMetricsHistory(parseInt(limit as string));
      res.json({
        metrics: history,
        count: history.length
      });
    } catch (error: any) {
      logger.error('Get metrics history error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get metrics history'
      });
    }
  }
);

/**
 * POST /api/performance/optimize/database
 * Optimize database connection pool (admin only)
 */
router.post(
  '/optimize/database',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const result = await performanceOptimizer.optimizeDatabasePool();
      res.json(result);
    } catch (error: any) {
      logger.error('Optimize database error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to optimize database pool'
      });
    }
  }
);

/**
 * GET /api/performance/recommendations
 * Get performance recommendations (admin only)
 */
router.get(
  '/recommendations',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const recommendations = performanceOptimizer.getPerformanceRecommendations();
      res.json({
        recommendations,
        count: recommendations.length
      });
    } catch (error: any) {
      logger.error('Get recommendations error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get performance recommendations'
      });
    }
  }
);

/**
 * POST /api/performance/load-test
 * Run load test (admin only)
 */
router.post(
  '/load-test',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { concurrentUsers = 10, requestsPerUser = 10, endpoint = '/health' } = req.body;

      if (concurrentUsers > 100) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Concurrent users cannot exceed 100'
        });
      }

      const result = await performanceOptimizer.runLoadTest(
        concurrentUsers,
        requestsPerUser,
        endpoint
      );

      res.json(result);
    } catch (error: any) {
      logger.error('Load test error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to run load test'
      });
    }
  }
);

export default router;
