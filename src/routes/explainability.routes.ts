import { Router, Request, Response } from 'express';
import { explainabilityEngine } from '../services/explainability';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/explainability/explain
 * Generate explanation for a suggestion
 */
router.post('/explain', async (req: Request, res: Response) => {
  try {
    const { suggestionId, suggestionType, reasoning, evidence } = req.body;

    if (!suggestionId || !suggestionType || !reasoning) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const explanation = await explainabilityEngine.explainSuggestion(
      suggestionId,
      suggestionType,
      reasoning,
      evidence || []
    );

    res.json(explanation);
  } catch (error) {
    logger.error('Failed to generate explanation', error);
    res.status(500).json({ error: 'Failed to generate explanation' });
  }
});

/**
 * POST /api/explainability/cite
 * Get citations for a statement
 */
router.post('/cite', async (req: Request, res: Response) => {
  try {
    const { statement } = req.body;

    if (!statement) {
      return res.status(400).json({ error: 'Statement is required' });
    }

    const citations = await explainabilityEngine.citeSources(statement);

    res.json({ statement, citations, count: citations.length });
  } catch (error) {
    logger.error('Failed to cite sources', error);
    res.status(500).json({ error: 'Failed to cite sources' });
  }
});

/**
 * POST /api/explainability/risk
 * Explain cancer risk flag
 */
router.post('/risk', async (req: Request, res: Response) => {
  try {
    const { riskLevel, findings } = req.body;

    if (!riskLevel || !findings) {
      return res.status(400).json({ error: 'Risk level and findings are required' });
    }

    if (!['LOW', 'MEDIUM', 'HIGH'].includes(riskLevel)) {
      return res.status(400).json({ error: 'Invalid risk level' });
    }

    const explanation = await explainabilityEngine.explainRiskFlag(riskLevel, findings);

    res.json(explanation);
  } catch (error) {
    logger.error('Failed to explain risk flag', error);
    res.status(500).json({ error: 'Failed to explain risk flag' });
  }
});

/**
 * POST /api/explainability/detailed
 * Get detailed reasoning for a suggestion
 */
router.post('/detailed', async (req: Request, res: Response) => {
  try {
    const { suggestionId, suggestionType, context } = req.body;

    if (!suggestionId || !suggestionType) {
      return res.status(400).json({ error: 'Suggestion ID and type are required' });
    }

    const reasoning = await explainabilityEngine.provideDetailedReasoning(
      suggestionId,
      suggestionType,
      context || {}
    );

    res.json(reasoning);
  } catch (error) {
    logger.error('Failed to provide detailed reasoning', error);
    res.status(500).json({ error: 'Failed to provide detailed reasoning' });
  }
});

/**
 * POST /api/explainability/summary
 * Generate explanation summary
 */
router.post('/summary', async (req: Request, res: Response) => {
  try {
    const { suggestionId, suggestionType, reasoning, evidence } = req.body;

    const explanation = await explainabilityEngine.explainSuggestion(
      suggestionId,
      suggestionType,
      reasoning,
      evidence || []
    );

    const summary = explainabilityEngine.generateSummary(explanation);

    res.type('text/plain').send(summary);
  } catch (error) {
    logger.error('Failed to generate summary', error);
    res.status(500).json({ error: 'Failed to generate summary' });
  }
});

export default router;
