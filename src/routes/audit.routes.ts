import { Router, Response } from 'express';
import { AuditService } from '../services/audit';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const auditService = new AuditService();

/**
 * GET /api/audit/logs
 * Query audit logs (admin and quality_officer only)
 */
router.get(
  '/logs',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        userId,
        patientId,
        eventType,
        startDate,
        endDate,
        limit = '50',
        offset = '0'
      } = req.query;

      // Parse dates
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      // Query logs
      const result = await auditService.queryAuditLogs({
        userId: userId as string,
        patientId: patientId as string,
        eventType: eventType as any,
        startDate: parsedStartDate,
        endDate: parsedEndDate,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });

      res.json({
        logs: result.logs,
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error: any) {
      logger.error('Query audit logs error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to query audit logs'
      });
    }
  }
);

/**
 * GET /api/audit/access-logs
 * Query access logs (admin and quality_officer only)
 */
router.get(
  '/access-logs',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, patientId, startDate, endDate, limit = '50', offset = '0' } = req.query;

      // Parse dates
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      // Query logs
      const result = await auditService.queryAccessLogs(
        userId as string,
        patientId as string,
        parsedStartDate,
        parsedEndDate,
        parseInt(limit as string),
        parseInt(offset as string)
      );

      res.json({
        logs: result.logs,
        total: result.total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      });
    } catch (error: any) {
      logger.error('Query access logs error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to query access logs'
      });
    }
  }
);

/**
 * GET /api/audit/statistics
 * Get audit statistics (admin and quality_officer only)
 */
router.get(
  '/statistics',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate } = req.query;

      // Parse dates
      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      // Get statistics
      const stats = await auditService.getAuditStatistics(parsedStartDate, parsedEndDate);

      res.json(stats);
    } catch (error: any) {
      logger.error('Get audit statistics error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get audit statistics'
      });
    }
  }
);

/**
 * POST /api/audit/cleanup
 * Clean up old audit logs (admin only)
 */
router.post(
  '/cleanup',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const deletedCount = await auditService.cleanupOldLogs();

      res.json({
        message: 'Old audit logs cleaned up successfully',
        deletedCount
      });
    } catch (error: any) {
      logger.error('Cleanup audit logs error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to cleanup audit logs'
      });
    }
  }
);

export default router;
