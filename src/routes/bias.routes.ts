import { Router, Response } from 'express';
import { DemographicMonitor } from '../services/bias';
import { authenticate, authorize, AuthRequest } from '../middleware/auth';
import logger from '../utils/logger';

const router = Router();
const demographicMonitor = new DemographicMonitor();

/**
 * GET /api/bias/report
 * Generate bias report for a model (admin and quality_officer only)
 */
router.get(
  '/report',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { modelName = 'RadiologyAnalyzer', modelVersion = '1.0.0', startDate, endDate } = req.query;

      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const report = await demographicMonitor.generateBiasReport(
        modelName as string,
        modelVersion as string,
        parsedStartDate,
        parsedEndDate
      );

      res.json(report);
    } catch (error: any) {
      logger.error('Generate bias report error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to generate bias report'
      });
    }
  }
);

/**
 * GET /api/bias/demographics
 * Get demographic composition (admin and quality_officer only)
 */
router.get(
  '/demographics',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { modelName = 'RadiologyAnalyzer' } = req.query;

      const composition = await demographicMonitor.generateDemographicComposition(
        modelName as string
      );

      res.json({
        modelName,
        composition,
        total: composition.reduce((sum, c) => sum + c.count, 0)
      });
    } catch (error: any) {
      logger.error('Get demographic composition error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get demographic composition'
      });
    }
  }
);

/**
 * GET /api/bias/disparities
 * Detect disparities between demographic groups (admin and quality_officer only)
 */
router.get(
  '/disparities',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { modelName = 'RadiologyAnalyzer', startDate, endDate } = req.query;

      const parsedStartDate = startDate ? new Date(startDate as string) : undefined;
      const parsedEndDate = endDate ? new Date(endDate as string) : undefined;

      const disparities = await demographicMonitor.detectDisparities(
        modelName as string,
        parsedStartDate,
        parsedEndDate
      );

      res.json({
        modelName,
        disparities,
        count: disparities.length,
        threshold: demographicMonitor.getDisparityThreshold()
      });
    } catch (error: any) {
      logger.error('Detect disparities error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to detect disparities'
      });
    }
  }
);

/**
 * GET /api/bias/model-metadata
 * Get model metadata (admin and quality_officer only)
 */
router.get(
  '/model-metadata',
  authenticate(),
  authorize(['admin', 'quality_officer']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { modelName = 'RadiologyAnalyzer' } = req.query;

      const metadata = await demographicMonitor.getModelMetadata(modelName as string);

      if (!metadata) {
        return res.status(404).json({
          error: 'Not Found',
          message: 'Model metadata not found'
        });
      }

      res.json(metadata);
    } catch (error: any) {
      logger.error('Get model metadata error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to get model metadata'
      });
    }
  }
);

/**
 * POST /api/bias/track-prediction
 * Track prediction accuracy for demographic monitoring (authenticated users)
 */
router.post(
  '/track-prediction',
  authenticate(),
  async (req: AuthRequest, res: Response) => {
    try {
      const { patientId, prediction, actualOutcome, modelName = 'RadiologyAnalyzer' } = req.body;

      if (!patientId || !prediction || !actualOutcome) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Missing required fields: patientId, prediction, actualOutcome'
        });
      }

      await demographicMonitor.trackPredictionAccuracy(
        patientId,
        prediction,
        actualOutcome,
        modelName
      );

      res.json({
        message: 'Prediction tracked successfully'
      });
    } catch (error: any) {
      logger.error('Track prediction error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to track prediction'
      });
    }
  }
);

/**
 * PUT /api/bias/threshold
 * Set disparity threshold (admin only)
 */
router.put(
  '/threshold',
  authenticate(),
  authorize(['admin']),
  async (req: AuthRequest, res: Response) => {
    try {
      const { threshold } = req.body;

      if (threshold === undefined || threshold < 0 || threshold > 1) {
        return res.status(400).json({
          error: 'Bad Request',
          message: 'Threshold must be between 0 and 1'
        });
      }

      demographicMonitor.setDisparityThreshold(threshold);

      res.json({
        message: 'Disparity threshold updated successfully',
        threshold
      });
    } catch (error: any) {
      logger.error('Set threshold error:', error);
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Failed to set disparity threshold'
      });
    }
  }
);

export default router;
