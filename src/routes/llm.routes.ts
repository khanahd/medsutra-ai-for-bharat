import { Router, Request, Response } from 'express';
import { clinicalLLM, llmMonitor, textGenerationCache } from '../services/llm';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/llm/health
 * Check LLM service health
 */
router.get('/health', async (req: Request, res: Response) => {
  try {
    const isHealthy = await clinicalLLM.healthCheck();
    
    res.status(isHealthy ? 200 : 503).json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('LLM health check failed', error);
    res.status(503).json({
      status: 'unhealthy',
      error: 'Health check failed',
      timestamp: new Date().toISOString(),
    });
  }
});

/**
 * GET /api/llm/metrics
 * Get LLM performance metrics
 */
router.get('/metrics', (req: Request, res: Response) => {
  try {
    const metrics = llmMonitor.getMetrics();
    const cacheStats = textGenerationCache.getStats();
    const performanceSummary = llmMonitor.getPerformanceSummary(60);

    res.json({
      metrics,
      cache: cacheStats,
      performanceSummary,
      isDegraded: llmMonitor.isPerformanceDegraded(),
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error('Failed to get LLM metrics', error);
    res.status(500).json({ error: 'Failed to retrieve metrics' });
  }
});

/**
 * GET /api/llm/report
 * Get detailed performance report
 */
router.get('/report', (req: Request, res: Response) => {
  try {
    const report = llmMonitor.generateReport();
    
    res.type('text/plain').send(report);
  } catch (error) {
    logger.error('Failed to generate LLM report', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/llm/metadata
 * Get model metadata
 */
router.get('/metadata', (req: Request, res: Response) => {
  try {
    const metadata = clinicalLLM.getMetadata();
    
    res.json(metadata);
  } catch (error) {
    logger.error('Failed to get model metadata', error);
    res.status(500).json({ error: 'Failed to retrieve metadata' });
  }
});

/**
 * POST /api/llm/cache/clear
 * Clear LLM cache
 */
router.post('/cache/clear', (req: Request, res: Response) => {
  try {
    textGenerationCache.clear();
    
    logger.info('LLM cache cleared');
    res.json({ message: 'Cache cleared successfully' });
  } catch (error) {
    logger.error('Failed to clear cache', error);
    res.status(500).json({ error: 'Failed to clear cache' });
  }
});

/**
 * POST /api/llm/metrics/reset
 * Reset LLM metrics
 */
router.post('/metrics/reset', (req: Request, res: Response) => {
  try {
    llmMonitor.reset();
    
    logger.info('LLM metrics reset');
    res.json({ message: 'Metrics reset successfully' });
  } catch (error) {
    logger.error('Failed to reset metrics', error);
    res.status(500).json({ error: 'Failed to reset metrics' });
  }
});

export default router;
