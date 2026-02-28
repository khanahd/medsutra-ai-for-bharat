import { Router, Request, Response } from 'express';
import { RadiologyAnalyzer, RadiologyReport } from '../services/radiology';
import { ClinicalLLM } from '../services/llm';
import { MedicalOntology } from '../services/ontology';
import { RAGSystem } from '../services/rag';
import { ExplainabilityEngine } from '../services/explainability';
import logger from '../utils/logger';

const router = Router();

// Initialize services
const llm = new ClinicalLLM(
  process.env.OPENAI_API_KEY || '',
  process.env.OPENAI_BASE_URL
);
const ontology = new MedicalOntology();
const ragSystem = new RAGSystem(llm);
const explainability = new ExplainabilityEngine(llm, ragSystem);
const radiologyAnalyzer = new RadiologyAnalyzer(llm, ontology, explainability);

/**
 * POST /api/radiology/analyze
 * Analyze radiology report for cancer risk
 */
router.post('/analyze', async (req: Request, res: Response) => {
  try {
    const { id, patientId, reportText, modality, bodyPart, timestamp } = req.body;

    if (!id || !patientId || !reportText) {
      return res.status(400).json({
        error: 'Missing required fields: id, patientId, reportText'
      });
    }

    const report: RadiologyReport = {
      id,
      patientId,
      reportText,
      modality: modality || 'UNKNOWN',
      bodyPart: bodyPart || 'UNKNOWN',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const analysis = await radiologyAnalyzer.analyzeReport(report);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error in /radiology/analyze:', error);
    res.status(500).json({
      error: 'Failed to analyze radiology report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/radiology/no-findings
 * Handle report with no suspicious findings
 */
router.post('/no-findings', async (req: Request, res: Response) => {
  try {
    const { id, patientId, reportText, modality, bodyPart, timestamp } = req.body;

    if (!id || !patientId || !reportText) {
      return res.status(400).json({
        error: 'Missing required fields: id, patientId, reportText'
      });
    }

    const report: RadiologyReport = {
      id,
      patientId,
      reportText,
      modality: modality || 'UNKNOWN',
      bodyPart: bodyPart || 'UNKNOWN',
      timestamp: timestamp ? new Date(timestamp) : new Date()
    };

    const analysis = await radiologyAnalyzer.handleNoFindings(report);

    res.json({
      success: true,
      analysis
    });
  } catch (error) {
    logger.error('Error in /radiology/no-findings:', error);
    res.status(500).json({
      error: 'Failed to process no-findings report',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/radiology/risk-levels
 * Get available cancer risk levels
 */
router.get('/risk-levels', (req: Request, res: Response) => {
  res.json({
    success: true,
    riskLevels: ['Low', 'Medium', 'High'],
    descriptions: {
      Low: 'No significant suspicious findings detected',
      Medium: 'Some suspicious findings requiring follow-up',
      High: 'Highly suspicious findings requiring urgent attention'
    }
  });
});

/**
 * GET /api/radiology/organs
 * Get supported organ types
 */
router.get('/organs', (req: Request, res: Response) => {
  res.json({
    success: true,
    organs: ['LUNG', 'BREAST', 'LIVER', 'OTHER'],
    scoringSystems: {
      BREAST: 'BI-RADS (1-6)',
      LIVER: 'LI-RADS (LR-1 to LR-5, LR-M, LR-TIV)',
      LUNG: 'Nodule characteristics analysis'
    }
  });
});

export default router;
