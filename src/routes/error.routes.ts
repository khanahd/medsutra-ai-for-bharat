import { Router, Response } from 'express';
import { errorHandler } from '../services/error';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();

/**
 * GET /api/errors/alerts
 * Get recent error alerts (admin only)
 */
router.get(
  '/alerts',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { limit = '10' } = req.query;
      const alerts = errorHandler.getRecentAlerts(parseInt(limit as string));

      res.json({
        alerts: alerts.map((alert) => ({
          severity: alert.severity,
          message: alert.error.message,
          code: (alert.error as any).code,
          context: alert.context,
          timestamp: alert.timestamp
        })),
        count: alerts.length
      });
    } catch (error: any) {
      logger.error('Get error alerts error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get error alerts'
      });
    }
  }
);

/**
 * DELETE /api/errors/alerts
 * Clear error alerts (admin only)
 */
router.delete(
  '/alerts',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      errorHandler.clearAlerts();

      res.json({
        message: 'Error alerts cleared successfully'
      });
    } catch (error: any) {
      logger.error('Clear error alerts error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to clear error alerts'
      });
    }
  }
);

export default router;
