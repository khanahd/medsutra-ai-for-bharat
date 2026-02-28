import { Router, Request, Response } from 'express';
import { VisionAnalyzer, MedicalImage } from '../services/vision';
import { ClinicalLLM } from '../services/llm';
import logger from '../utils/logger';

const router = Router();

// Initialize services
const llm = new ClinicalLLM(
  process.env.OPENAI_API_KEY || '',
  process.env.OPENAI_BASE_URL
);

// Vision Analyzer is optional - check if enabled via environment variable
const visionEnabled = process.env.VISION_ANALYZER_ENABLED === 'true';
const visionAnalyzer = new VisionAnalyzer(llm, visionEnabled);

/**
 * GET /api/vision/status
 * Check if Vision Analyzer is enabled
 */
router.get('/status', (req: Request, res: Response) => {
  const info = visionAnalyzer.getModelInfo();
  res.json({
    success: true,
    enabled: info.enabled,
    modelVersion: info.version,
    message: info.enabled 
      ? 'Vision Analyzer is enabled and ready' 
      : 'Vision Analyzer is disabled. Set VISION_ANALYZER_ENABLED=true to enable.'
  });
});

/**
 * POST /api/vision/analyze
 * Analyze medical image for suspicious regions
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    if (!visionAnalyzer.isEnabled()) {
      return res.status(503).json({
        error: 'Vision Analyzer is not enabled',
        message: 'This is an optional module. Set VISION_ANALYZER_ENABLED=true to enable.'
      });
    }

    const { id, patientId, type, imageUrl, metadata, timestamp } = req.body;

    if (!id || !patientId || !type || !metadata) {
      return res.status(400).json({
        error: 'Missing required fields: id, patientId, type, metadata'
      });
    }

    const validTypes = ['CT', 'MRI', 'XRAY', 'ULTRASOUND'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid image type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const image: MedicalImage = {
      id,
      patientId,
      type,
      imageUrl,
      metadata,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const analysis = await visionAnalyzer.analyzeImage(image);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error in /vision/analyze:', error);
    res.status(500).json({
      error: 'Failed to analyze medical image',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/vision/validate-coordinates
 * Validate bounding box coordinates
 */
router.post('/validate-coordinates', (req: Request, res: Response) => {
  try {
    const { region, imageWidth, imageHeight } = req.body;

    if (!region || !imageWidth || !imageHeight) {
      return res.status(400).json({
        error: 'Missing required fields: region, imageWidth, imageHeight'
      });
    }

    const isValid = visionAnalyzer.validateCoordinates(
      region,
      imageWidth,
      imageHeight
    );

    res.json({
      success: true,
      valid: isValid,
      region
    });
  } catch (error) {
    logger.error('Error in /vision/validate-coordinates:', error);
    res.status(500).json({
      error: 'Failed to validate coordinates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/vision/multimodal-fusion
 * Fuse image and text analysis for comprehensive assessment
 */
router.post('/multimodal-fusion', async (req: Request, res: Response) => {
  try {
    if (!visionAnalyzer.isEnabled()) {
      return res.status(503).json({
        error: 'Vision Analyzer is not enabled',
        message: 'This is an optional module. Set VISION_ANALYZER_ENABLED=true to enable.'
      });
    }

    const { imageAnalysis, textAnalysis } = req.body;

    if (!imageAnalysis || !textAnalysis) {
      return res.status(400).json({
        error: 'Missing required fields: imageAnalysis, textAnalysis'
      });
    }

    const fusedAssessment = await visionAnalyzer.fuseMultimodal(
      imageAnalysis,
      textAnalysis
    );

    res.json({
      success: true,
      assessment: fusedAssessment
    });
  } catch (error) {
    logger.error('Error in /vision/multimodal-fusion:', error);
    res.status(500).json({
      error: 'Failed to fuse multimodal analysis',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/vision/handle-corrupted
 * Handle corrupted or invalid image
 */
router.post('/handle-corrupted', async (req: Request, res: Response) => {
  try {
    if (!visionAnalyzer.isEnabled()) {
      return res.status(503).json({
        error: 'Vision Analyzer is not enabled',
        message: 'This is an optional module. Set VISION_ANALYZER_ENABLED=true to enable.'
      });
    }

    const { id, patientId, type, metadata, timestamp } = req.body;

    if (!id || !patientId || !type || !metadata) {
      return res.status(400).json({
        error: 'Missing required fields: id, patientId, type, metadata'
      });
    }

    const image: MedicalImage = {
      id,
      patientId,
      type,
      metadata,
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const analysis = await visionAnalyzer.handleCorruptedImage(image);

    res.json({
      success: true,
      analysis,
      message: 'Corrupted image handled gracefully'
    });
  } catch (error) {
    logger.error('Error in /vision/handle-corrupted:', error);
    res.status(500).json({
      error: 'Failed to handle corrupted image',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
