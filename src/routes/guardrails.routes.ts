import { Router, Request, Response } from 'express';
import { guardrailSystem } from '../services/guardrails';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/guardrails/validate
 * Validate a medical statement
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { statement, module = 'unknown' } = req.body;

    if (!statement) {
      return res.status(400).json({ error: 'Statement is required' });
    }

    const validation = await guardrailSystem.validateStatement(statement, module);

    res.json(validation);
  } catch (error) {
    logger.error('Statement validation failed', error);
    res.status(500).json({ error: 'Failed to validate statement' });
  }
});

/**
 * POST /api/guardrails/validate-document
 * Validate an entire document
 */
router.post('/validate-document', async (req: Request, res: Response) => {
  try {
    const { content, module = 'unknown' } = req.body;

    if (!content) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const validation = await guardrailSystem.validateDocument(content, module);

    res.json(validation);
  } catch (error) {
    logger.error('Document validation failed', error);
    res.status(500).json({ error: 'Failed to validate document' });
  }
});

/**
 * POST /api/guardrails/contradictions
 * Detect contradictions in statements
 */
router.post('/contradictions', async (req: Request, res: Response) => {
  try {
    const { statements } = req.body;

    if (!Array.isArray(statements) || statements.length === 0) {
      return res.status(400).json({ error: 'Statements array is required' });
    }

    const contradictions = await guardrailSystem.detectContradictions(statements);

    res.json({ contradictions, count: contradictions.length });
  } catch (error) {
    logger.error('Contradiction detection failed', error);
    res.status(500).json({ error: 'Failed to detect contradictions' });
  }
});

/**
 * GET /api/guardrails/flagged
 * Get flagged statements
 */
router.get('/flagged', async (req: Request, res: Response) => {
  try {
    const { reviewed } = req.query;
    const reviewedOnly = reviewed === 'true';

    const flagged = await guardrailSystem.getFlaggedStatements(reviewedOnly);

    res.json({ flagged, count: flagged.length });
  } catch (error) {
    logger.error('Failed to get flagged statements', error);
    res.status(500).json({ error: 'Failed to retrieve flagged statements' });
  }
});

/**
 * POST /api/guardrails/flagged/:id/review
 * Mark flagged statement as reviewed
 */
router.post('/flagged/:id/review', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { reviewNotes } = req.body;

    if (!reviewNotes) {
      return res.status(400).json({ error: 'Review notes are required' });
    }

    await guardrailSystem.markAsReviewed(id, reviewNotes);

    res.json({ message: 'Statement marked as reviewed' });
  } catch (error) {
    logger.error('Failed to mark as reviewed', error);
    res.status(500).json({ error: 'Failed to update review status' });
  }
});

/**
 * POST /api/guardrails/disclaimer
 * Add AI disclaimer to text
 */
router.post('/disclaimer', (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const withDisclaimer = guardrailSystem.addDisclaimer(text);

    res.json({ original: text, withDisclaimer });
  } catch (error) {
    logger.error('Failed to add disclaimer', error);
    res.status(500).json({ error: 'Failed to add disclaimer' });
  }
});

/**
 * GET /api/guardrails/stats
 * Get guardrail statistics
 */
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await guardrailSystem.getStats();

    res.json(stats);
  } catch (error) {
    logger.error('Failed to get guardrail stats', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

export default router;
