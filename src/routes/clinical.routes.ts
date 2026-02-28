import { Router, Request, Response } from 'express';
import { ClinicalSummarizer, ClinicalDocument } from '../services/clinical';
import { ClinicalLLM } from '../services/llm';
import { MedicalOntology } from '../services/ontology';
import { GuardrailSystem } from '../services/guardrails';
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
const guardrails = new GuardrailSystem(ragSystem);
const clinicalSummarizer = new ClinicalSummarizer(llm, ontology, guardrails);

/**
 * POST /api/clinical/summarize
 * Generate patient snapshot from clinical documents
 */
router.post('/summarize', async (req: Request, res: Response) => {
  try {
    const { patientId, documents } = req.body;

    if (!patientId || !documents || !Array.isArray(documents)) {
      return res.status(400).json({
        error: 'Missing required fields: patientId and documents array'
      });
    }

    // Validate document structure
    for (const doc of documents) {
      if (!doc.id || !doc.type || !doc.content) {
        return res.status(400).json({
          error: 'Each document must have id, type, and content fields'
        });
      }
    }

    const snapshot = await clinicalSummarizer.generateSummary(
      patientId,
      documents as ClinicalDocument[]
    );

    res.json({
      success: true,
      snapshot
    });
  } catch (error) {
    logger.error('Error in /clinical/summarize:', error);
    res.status(500).json({
      error: 'Failed to generate patient snapshot',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/clinical/extract-entities
 * Extract medical entities from text
 */
router.post('/extract-entities', async (req: Request, res: Response) => {
  try {
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({
        error: 'Missing required field: text'
      });
    }

    const entities = await clinicalSummarizer.extractEntities(text);

    res.json({
      success: true,
      entities,
      count: entities.length
    });
  } catch (error) {
    logger.error('Error in /clinical/extract-entities:', error);
    res.status(500).json({
      error: 'Failed to extract entities',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/clinical/normalize-entity
 * Normalize a medical entity to ontology codes
 */
router.post('/normalize-entity', async (req: Request, res: Response) => {
  try {
    const { entity } = req.body;

    if (!entity || !entity.text || !entity.type) {
      return res.status(400).json({
        error: 'Missing required fields: entity with text and type'
      });
    }

    const normalized = await clinicalSummarizer.normalizeEntity(entity);

    res.json({
      success: true,
      normalized
    });
  } catch (error) {
    logger.error('Error in /clinical/normalize-entity:', error);
    res.status(500).json({
      error: 'Failed to normalize entity',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/clinical/ambiguous-term
 * Handle ambiguous medical term with multiple interpretations
 */
router.post('/ambiguous-term', async (req: Request, res: Response) => {
  try {
    const { term, context } = req.body;

    if (!term || !context) {
      return res.status(400).json({
        error: 'Missing required fields: term and context'
      });
    }

    const interpretations = await clinicalSummarizer.handleAmbiguousTerm(
      term,
      context
    );

    res.json({
      success: true,
      term,
      interpretations
    });
  } catch (error) {
    logger.error('Error in /clinical/ambiguous-term:', error);
    res.status(500).json({
      error: 'Failed to handle ambiguous term',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
