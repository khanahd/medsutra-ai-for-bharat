import { Router, Request, Response } from 'express';
import { WorkflowEngine, Language, ClinicianAction } from '../services/workflow';
import { ClinicalLLM } from '../services/llm';
import { RAGSystem } from '../services/rag';
import { ExplainabilityEngine } from '../services/explainability';
import { PatientSnapshot } from '../services/clinical';
import { RadiologyAnalysis } from '../services/radiology';
import logger from '../utils/logger';

const router = Router();

// Initialize services
const llm = new ClinicalLLM(
  process.env.OPENAI_API_KEY || '',
  process.env.OPENAI_BASE_URL
);
const ragSystem = new RAGSystem(llm);
const explainability = new ExplainabilityEngine(llm, ragSystem);
const workflowEngine = new WorkflowEngine(llm, explainability);

/**
 * POST /api/workflow/suggestions
 * Generate workflow suggestions for a patient
 */
router.post('/suggestions', async (req: Request, res: Response) => {
  try {
    const { patientId, snapshot, radiologyAnalysis } = req.body;

    if (!patientId || !snapshot) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, snapshot'
      });
    }

    const suggestions = await workflowEngine.suggestNextSteps(
      patientId,
      snapshot as PatientSnapshot,
      radiologyAnalysis as RadiologyAnalysis | undefined
    );

    res.json({
      success: true,
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    logger.error('Error in /workflow/suggestions:', error);
    res.status(500).json({
      error: 'Failed to generate workflow suggestions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/workflow/suggestions/:id
 * Get a specific workflow suggestion
 */
router.get('/suggestions/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const suggestion = workflowEngine.getSuggestion(id);
    if (!suggestion) {
      return res.status(404).json({
        error: 'Suggestion not found'
      });
    }

    res.json({
      success: true,
      suggestion
    });
  } catch (error) {
    logger.error('Error in /workflow/suggestions/:id:', error);
    res.status(500).json({
      error: 'Failed to retrieve suggestion',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/workflow/suggestions/:id/respond
 * Respond to a workflow suggestion (accept/modify/reject)
 */
router.post('/suggestions/:id/respond', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { action, respondedBy, modificationNotes } = req.body;

    if (!action || !respondedBy) {
      return res.status(400).json({
        error: 'Missing required fields: action, respondedBy'
      });
    }

    const validActions: ClinicianAction[] = ['ACCEPT', 'MODIFY', 'REJECT'];
    if (!validActions.includes(action)) {
      return res.status(400).json({
        error: `Invalid action. Must be one of: ${validActions.join(', ')}`
      });
    }

    const suggestion = await workflowEngine.respondToSuggestion(
      id,
      action as ClinicianAction,
      respondedBy,
      modificationNotes
    );

    res.json({
      success: true,
      suggestion
    });
  } catch (error) {
    logger.error('Error in /workflow/suggestions/:id/respond:', error);
    res.status(500).json({
      error: 'Failed to respond to suggestion',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/workflow/suggestions/patient/:patientId
 * Get all suggestions for a patient
 */
router.get('/suggestions/patient/:patientId', (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const suggestions = workflowEngine.getAllSuggestions(patientId);

    res.json({
      success: true,
      suggestions,
      count: suggestions.length
    });
  } catch (error) {
    logger.error('Error in /workflow/suggestions/patient/:patientId:', error);
    res.status(500).json({
      error: 'Failed to retrieve patient suggestions',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/workflow/patient-summary
 * Generate patient-friendly summary in specified language
 */
router.post('/patient-summary', async (req: Request, res: Response) => {
  try {
    const { patientId, snapshot, language } = req.body;

    if (!patientId || !snapshot) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, snapshot'
      });
    }

    const validLanguages: Language[] = ['ENGLISH', 'HINDI', 'TAMIL', 'TELUGU', 'KANNADA', 'MALAYALAM'];
    const selectedLanguage = language || 'ENGLISH';

    if (!validLanguages.includes(selectedLanguage)) {
      return res.status(400).json({
        error: `Invalid language. Must be one of: ${validLanguages.join(', ')}`
      });
    }

    const summary = await workflowEngine.generatePatientSummary(
      patientId,
      snapshot as PatientSnapshot,
      selectedLanguage as Language
    );

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    logger.error('Error in /workflow/patient-summary:', error);
    res.status(500).json({
      error: 'Failed to generate patient summary',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/workflow/translate-jargon
 * Translate medical jargon to patient-friendly language
 */
router.post('/translate-jargon', async (req: Request, res: Response) => {
  try {
    const { medicalText, language } = req.body;

    if (!medicalText) {
      return res.status(400).json({
        error: 'Missing required field: medicalText'
      });
    }

    const selectedLanguage = language || 'ENGLISH';
    const validLanguages: Language[] = ['ENGLISH', 'HINDI', 'TAMIL', 'TELUGU', 'KANNADA', 'MALAYALAM'];

    if (!validLanguages.includes(selectedLanguage)) {
      return res.status(400).json({
        error: `Invalid language. Must be one of: ${validLanguages.join(', ')}`
      });
    }

    const translation = await workflowEngine.translateToLayman(
      medicalText,
      selectedLanguage as Language
    );

    res.json({
      success: true,
      original: medicalText,
      translation,
      language: selectedLanguage
    });
  } catch (error) {
    logger.error('Error in /workflow/translate-jargon:', error);
    res.status(500).json({
      error: 'Failed to translate medical jargon',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/workflow/evaluate-referral
 * Evaluate if specialist referral is needed
 */
router.post('/evaluate-referral', async (req: Request, res: Response) => {
  try {
    const { findings, specialty } = req.body;

    if (!findings || !Array.isArray(findings)) {
      return res.status(400).json({
        error: 'Missing required field: findings (array)'
      });
    }

    const referralSuggestion = await workflowEngine.evaluateReferralNeed(
      findings,
      specialty
    );

    if (!referralSuggestion) {
      return res.json({
        success: true,
        referralNeeded: false,
        message: 'No specialist referral needed based on current findings'
      });
    }

    res.json({
      success: true,
      referralNeeded: true,
      referral: referralSuggestion
    });
  } catch (error) {
    logger.error('Error in /workflow/evaluate-referral:', error);
    res.status(500).json({
      error: 'Failed to evaluate referral need',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/workflow/statistics
 * Get workflow engine statistics
 */
router.get('/statistics', (req: Request, res: Response) => {
  try {
    const stats = workflowEngine.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error('Error in /workflow/statistics:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/workflow/languages
 * Get supported languages
 */
router.get('/languages', (req: Request, res: Response) => {
  res.json({
    success: true,
    languages: [
      { code: 'ENGLISH', name: 'English', native: 'English' },
      { code: 'HINDI', name: 'Hindi', native: 'हिन्दी' },
      { code: 'TAMIL', name: 'Tamil', native: 'தமிழ்' },
      { code: 'TELUGU', name: 'Telugu', native: 'తెలుగు' },
      { code: 'KANNADA', name: 'Kannada', native: 'ಕನ್ನಡ' },
      { code: 'MALAYALAM', name: 'Malayalam', native: 'മലയാളം' }
    ]
  });
});

export default router;
