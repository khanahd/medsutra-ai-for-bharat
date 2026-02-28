import { Request, Response, NextFunction } from 'express';
import { errorHandler } from '../services/error';
import { AppError, getStatusCode } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Global error handling middleware
 * Must be registered last in middleware chain
 */
export function globalErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Handle error
  errorHandler.handleError(error, {
    method: req.method,
    path: req.path,
    query: req.query,
    body: req.body,
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Get status code
  const statusCode = getStatusCode(error);

  // Create error response
  const errorResponse = errorHandler.createErrorResponse(error);

  // Send response
  res.status(statusCode).json(errorResponse);
}

/**
 * Async error wrapper
 * Wraps async route handlers to catch errors
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
export function notFoundHandler(req: Request, res: Response, next: NextFunction): void {
  const error = new AppError(
    `Route not found: ${req.method} ${req.path}`,
    'RESOURCE_NOT_FOUND' as any,
    404
  );
  next(error);
}

/**
 * Unhandled rejection handler
 */
export function setupUnhandledRejectionHandler(): void {
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    errorHandler.handleError(
      reason instanceof Error ? reason : new Error(String(reason)),
      { type: 'unhandledRejection' }
    );
  });
}

/**
 * Uncaught exception handler
 */
export function setupUncaughtExceptionHandler(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('Uncaught Exception:', error);
    errorHandler.handleError(error, { type: 'uncaughtException' });

    // Exit process for uncaught exceptions (non-operational errors)
    if (!(error instanceof AppError) || !error.isOperational) {
      logger.error('Non-operational error detected. Shutting down...');
      process.exit(1);
    }
  });
}
