import { Router, Request, Response } from 'express';
import { DocumentationAssistant, DocumentType } from '../services/documentation';
import { ClinicalLLM } from '../services/llm';
import { GuardrailSystem } from '../services/guardrails';
import { RAGSystem } from '../services/rag';
import { PatientSnapshot } from '../services/clinical';
import logger from '../utils/logger';

const router = Router();

// Initialize services
const llm = new ClinicalLLM(
  process.env.OPENAI_API_KEY || '',
  process.env.OPENAI_BASE_URL
);
const ragSystem = new RAGSystem(llm);
const guardrails = new GuardrailSystem(ragSystem);
const documentationAssistant = new DocumentationAssistant(llm, guardrails);

/**
 * POST /api/documents/draft
 * Generate a document draft
 */
router.post('/draft', async (req: Request, res: Response) => {
  try {
    const { patientId, type, snapshot, generatedBy } = req.body;

    if (!patientId || !type || !snapshot || !generatedBy) {
      return res.status(400).json({
        error: 'Missing required fields: patientId, type, snapshot, generatedBy'
      });
    }

    const validTypes: DocumentType[] = ['OPD_NOTE', 'DISCHARGE_SUMMARY', 'REFERRAL_LETTER', 'INSURANCE_DOC'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid document type. Must be one of: ${validTypes.join(', ')}`
      });
    }

    const draft = await documentationAssistant.draftDocument(
      patientId,
      type as DocumentType,
      snapshot as PatientSnapshot,
      generatedBy
    );

    res.json({
      success: true,
      draft
    });
  } catch (error) {
    logger.error('Error in /documents/draft:', error);
    res.status(500).json({
      error: 'Failed to generate document draft',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/documents/:id
 * Get a document draft by ID
 */
router.get('/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const draft = documentationAssistant.getDraft(id);
    if (!draft) {
      return res.status(404).json({
        error: 'Draft not found'
      });
    }

    res.json({
      success: true,
      draft
    });
  } catch (error) {
    logger.error('Error in /documents/:id:', error);
    res.status(500).json({
      error: 'Failed to retrieve draft',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * PUT /api/documents/:id/edit
 * Edit a section of a document draft
 */
router.put('/:id/edit', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sectionName, newContent, editedBy } = req.body;

    if (!sectionName || !newContent || !editedBy) {
      return res.status(400).json({
        error: 'Missing required fields: sectionName, newContent, editedBy'
      });
    }

    const draft = await documentationAssistant.editSection(
      id,
      sectionName,
      newContent,
      editedBy
    );

    res.json({
      success: true,
      draft
    });
  } catch (error) {
    logger.error('Error in /documents/:id/edit:', error);
    res.status(500).json({
      error: 'Failed to edit document section',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documents/:id/review
 * Submit a document for review
 */
router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewerId } = req.body;

    if (!reviewerId) {
      return res.status(400).json({
        error: 'Missing required field: reviewerId'
      });
    }

    const workflow = await documentationAssistant.submitForReview(id, reviewerId);

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    logger.error('Error in /documents/:id/review:', error);
    res.status(500).json({
      error: 'Failed to submit document for review',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documents/:id/approve
 * Approve a document draft
 */
router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { approvedBy, comments } = req.body;

    if (!approvedBy) {
      return res.status(400).json({
        error: 'Missing required field: approvedBy'
      });
    }

    const draft = await documentationAssistant.approveDocument(
      id,
      approvedBy,
      comments
    );

    res.json({
      success: true,
      draft
    });
  } catch (error) {
    logger.error('Error in /documents/:id/approve:', error);
    res.status(500).json({
      error: 'Failed to approve document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/documents/:id/reject
 * Reject a document draft
 */
router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewerId, reason } = req.body;

    if (!reviewerId || !reason) {
      return res.status(400).json({
        error: 'Missing required fields: reviewerId, reason'
      });
    }

    const workflow = await documentationAssistant.rejectDocument(
      id,
      reviewerId,
      reason
    );

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    logger.error('Error in /documents/:id/reject:', error);
    res.status(500).json({
      error: 'Failed to reject document',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/documents/:id/workflow
 * Get workflow status for a document
 */
router.get('/:id/workflow', (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const workflow = documentationAssistant.getWorkflow(id);
    if (!workflow) {
      return res.status(404).json({
        error: 'Workflow not found'
      });
    }

    res.json({
      success: true,
      workflow
    });
  } catch (error) {
    logger.error('Error in /documents/:id/workflow:', error);
    res.status(500).json({
      error: 'Failed to retrieve workflow',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/documents/patient/:patientId
 * Get all drafts for a patient
 */
router.get('/patient/:patientId', (req: Request, res: Response) => {
  try {
    const { patientId } = req.params;

    const drafts = documentationAssistant.getAllDrafts(patientId);

    res.json({
      success: true,
      drafts,
      count: drafts.length
    });
  } catch (error) {
    logger.error('Error in /documents/patient/:patientId:', error);
    res.status(500).json({
      error: 'Failed to retrieve patient drafts',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/documents/templates
 * Get available document templates
 */
router.get('/templates', (req: Request, res: Response) => {
  try {
    const templates = {
      OPD_NOTE: documentationAssistant.getTemplate('OPD_NOTE'),
      DISCHARGE_SUMMARY: documentationAssistant.getTemplate('DISCHARGE_SUMMARY'),
      REFERRAL_LETTER: documentationAssistant.getTemplate('REFERRAL_LETTER'),
      INSURANCE_DOC: documentationAssistant.getTemplate('INSURANCE_DOC')
    };

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    logger.error('Error in /documents/templates:', error);
    res.status(500).json({
      error: 'Failed to retrieve templates',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/documents/statistics
 * Get documentation statistics
 */
router.get('/statistics', (req: Request, res: Response) => {
  try {
    const stats = documentationAssistant.getStatistics();

    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    logger.error('Error in /documents/statistics:', error);
    res.status(500).json({
      error: 'Failed to retrieve statistics',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
