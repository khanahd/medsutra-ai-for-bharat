import { Router, Request, Response } from 'express';
import { ragSystem, documentLoader } from '../services/rag';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/rag/query
 * Query RAG system for relevant documents
 */
router.post('/query', async (req: Request, res: Response) => {
  try {
    const { query, topK = 5, filters } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }

    const result = await ragSystem.query({ query, topK, filters });

    res.json(result);
  } catch (error) {
    logger.error('RAG query failed', error);
    res.status(500).json({ error: 'Failed to query RAG system' });
  }
});

/**
 * POST /api/rag/validate
 * Validate a medical statement
 */
router.post('/validate', async (req: Request, res: Response) => {
  try {
    const { statement } = req.body;

    if (!statement) {
      return res.status(400).json({ error: 'Statement is required' });
    }

    const validation = await ragSystem.validateStatement(statement);

    res.json(validation);
  } catch (error) {
    logger.error('Statement validation failed', error);
    res.status(500).json({ error: 'Failed to validate statement' });
  }
});

/**
 * GET /api/rag/documents
 * Get all documents or filter by source
 */
router.get('/documents', (req: Request, res: Response) => {
  try {
    const { source } = req.query;

    const documents = source
      ? ragSystem.getDocumentsBySource(source as any)
      : ragSystem.getAllDocuments();

    res.json({ documents, count: documents.length });
  } catch (error) {
    logger.error('Failed to get documents', error);
    res.status(500).json({ error: 'Failed to retrieve documents' });
  }
});

/**
 * GET /api/rag/documents/:id
 * Get document by ID
 */
router.get('/documents/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const document = ragSystem.getDocument(id);

    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json(document);
  } catch (error) {
    logger.error('Failed to get document', error);
    res.status(500).json({ error: 'Failed to retrieve document' });
  }
});

/**
 * POST /api/rag/documents
 * Add a new document
 */
router.post('/documents', async (req: Request, res: Response) => {
  try {
    const document = req.body;

    await ragSystem.addDocument(document);

    res.status(201).json({ message: 'Document added successfully', id: document.id });
  } catch (error) {
    logger.error('Failed to add document', error);
    res.status(500).json({ error: 'Failed to add document' });
  }
});

/**
 * DELETE /api/rag/documents/:id
 * Remove a document
 */
router.delete('/documents/:id', (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const removed = ragSystem.removeDocument(id);

    if (!removed) {
      return res.status(404).json({ error: 'Document not found' });
    }

    res.json({ message: 'Document removed successfully' });
  } catch (error) {
    logger.error('Failed to remove document', error);
    res.status(500).json({ error: 'Failed to remove document' });
  }
});

/**
 * GET /api/rag/stats
 * Get RAG system statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = ragSystem.getStats();
    res.json(stats);
  } catch (error) {
    logger.error('Failed to get RAG stats', error);
    res.status(500).json({ error: 'Failed to retrieve statistics' });
  }
});

/**
 * POST /api/rag/initialize
 * Initialize RAG system with sample documents
 */
router.post('/initialize', async (req: Request, res: Response) => {
  try {
    const documents = await documentLoader.loadSampleGuidelines();
    await ragSystem.initialize(documents);

    res.json({ message: 'RAG system initialized', documentCount: documents.length });
  } catch (error) {
    logger.error('Failed to initialize RAG system', error);
    res.status(500).json({ error: 'Failed to initialize RAG system' });
  }
});

export default router;
