import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface APIRequest extends Request {
  requestId?: string;
  startTime?: number;
  userId?: string;
  userRole?: string;
}

export class APIGateway {
  private requestQueue: Array<{
    req: Request;
    res: Response;
    next: NextFunction;
    timestamp: number;
  }> = [];
  private activeRequests = 0;
  private maxConcurrentRequests: number;
  private queueThreshold: number;

  constructor(maxConcurrentRequests: number = 100) {
    this.maxConcurrentRequests = maxConcurrentRequests;
    this.queueThreshold = Math.floor(maxConcurrentRequests * 0.8); // 80% capacity
  }

  /**
   * Request ID middleware - assigns unique ID to each request
   */
  requestIdMiddleware() {
    return (req: APIRequest, res: Response, next: NextFunction) => {
      req.requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      req.startTime = Date.now();
      next();
    };
  }

  /**
   * Request logging middleware
   */
  requestLogger() {
    return (req: APIRequest, res: Response, next: NextFunction) => {
      logger.info(`[${req.requestId}] ${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('user-agent')
      });
      next();
    };
  }

  /**
   * Response time middleware
   */
  responseTimeMiddleware() {
    return (req: APIRequest, res: Response, next: NextFunction) => {
      res.on('finish', () => {
        const duration = Date.now() - (req.startTime || Date.now());
        logger.info(`[${req.requestId}] Completed in ${duration}ms - Status: ${res.statusCode}`);
      });
      next();
    };
  }

  /**
   * Load balancing and queueing middleware
   */
  loadBalancingMiddleware() {
    return async (req: Request, res: Response, next: NextFunction) => {
      this.activeRequests++;

      // Check if we're over capacity
      if (this.activeRequests > this.queueThreshold) {
        logger.warn(`High load: ${this.activeRequests}/${this.maxConcurrentRequests} requests active`);

        // If over max capacity, queue the request
        if (this.activeRequests > this.maxConcurrentRequests) {
          const waitTime = this.estimateWaitTime();
          logger.info(`Queueing request - Estimated wait: ${waitTime}ms`);

          this.requestQueue.push({
            req,
            res,
            next,
            timestamp: Date.now()
          });

          res.status(503).json({
            error: 'Service temporarily unavailable',
            message: 'Server is at capacity. Your request has been queued.',
            estimatedWaitTime: waitTime,
            queuePosition: this.requestQueue.length
          });

          this.activeRequests--;
          return;
        }
      }

      // Process request
      res.on('finish', () => {
        this.activeRequests--;
        this.processQueue();
      });

      next();
    };
  }

  /**
   * Process queued requests
   */
  private processQueue() {
    if (this.requestQueue.length > 0 && this.activeRequests < this.maxConcurrentRequests) {
      const queued = this.requestQueue.shift();
      if (queued) {
        this.activeRequests++;
        queued.next();
      }
    }
  }

  /**
   * Estimate wait time for queued requests
   */
  private estimateWaitTime(): number {
    // Estimate based on average request duration (assume 2 seconds per request)
    const avgRequestDuration = 2000;
    const queuePosition = this.requestQueue.length + 1;
    const availableSlots = this.maxConcurrentRequests - this.activeRequests;
    const waitTime = Math.max(0, (queuePosition - availableSlots) * avgRequestDuration);
    return waitTime;
  }

  /**
   * Get current load statistics
   */
  getLoadStatistics() {
    return {
      activeRequests: this.activeRequests,
      maxConcurrentRequests: this.maxConcurrentRequests,
      queuedRequests: this.requestQueue.length,
      capacityUsed: (this.activeRequests / this.maxConcurrentRequests) * 100,
      isOverCapacity: this.activeRequests > this.queueThreshold
    };
  }

  /**
   * CORS middleware
   */
  corsMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');

      if (req.method === 'OPTIONS') {
        res.sendStatus(200);
      } else {
        next();
      }
    };
  }

  /**
   * Error handling middleware
   */
  errorHandler() {
    return (err: Error, req: APIRequest, res: Response, next: NextFunction) => {
      logger.error(`[${req.requestId}] Error:`, err);

      res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'An error occurred',
        requestId: req.requestId
      });
    };
  }

  /**
   * Not found middleware
   */
  notFoundHandler() {
    return (req: APIRequest, res: Response) => {
      res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
        requestId: req.requestId
      });
    };
  }
}

export const apiGateway = new APIGateway(
  parseInt(process.env.MAX_CONCURRENT_USERS || '100')
);
