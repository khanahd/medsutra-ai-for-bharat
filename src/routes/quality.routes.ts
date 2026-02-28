import { Router, Response } from 'express';
import { QualityMonitor } from '../services/quality';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const qualityMonitor = new QualityMonitor();

/**
 * GET /api/quality/reports
 * Get quality reports (quality_officer and admin only)
 */
router.get(
  '/reports',
  authenticate(),
  authorize(['quality_officer', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, year, month } = req.query;

      let report;

      if (year && month) {
        // Generate monthly report
        report = await qualityMonitor.generateMonthlyReport(
          parseInt(year as string),
          parseInt(month as string)
        );
      } else if (startDate && endDate) {
        // Generate custom date range report
        report = await qualityMonitor.generateReport(
          new Date(startDate as string),
          new Date(endDate as string)
        );
      } else {
        // Default to current month
        const now = new Date();
        report = await qualityMonitor.generateMonthlyReport(now.getFullYear(), now.getMonth() + 1);
      }

      res.json(report);
    } catch (error: any) {
      logger.error('Get quality report error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate quality report'
      });
    }
  }
);

/**
 * GET /api/quality/flagged-cases
 * Get flagged cases for review (quality_officer and admin only)
 */
router.get(
  '/flagged-cases',
  authenticate(),
  authorize(['quality_officer', 'admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { startDate, endDate, limit = '50' } = req.query;

      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const cases = await qualityMonitor.getFlaggedCasesForReview(
        parsedStartDate,
        parsedEndDate,
        parseInt(limit as string)
      );

      res.json({
        cases,
        total: cases.length
      });
    } catch (error: any) {
      logger.error('Get flagged cases error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get flagged cases'
      });
    }
  }
);

/**
 * POST /api/quality/track-time-savings
 * Track time savings for a document (authenticated users)
 */
router.post(
  '/track-time-savings',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentType, timeSavedMinutes, metadata } = req.body;

      if (!documentType || timeSavedMinutes === undefined) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: documentType, timeSavedMinutes'
        });
      }

      if (!req.userId) {
        return res.status(401).json({
          error: 'Unauthorized',
          message: 'User not authenticated'
        });
      }

      await qualityMonitor.trackTimeSavings(
        documentType,
        timeSavedMinutes,
        req.userId,
        metadata
      );

      res.json({
        message: 'Time savings tracked successfully'
      });
    } catch (error: any) {
      logger.error('Track time savings error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to track time savings'
      });
    }
  }
);

export default router;
