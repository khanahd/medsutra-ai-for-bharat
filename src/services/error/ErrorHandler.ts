import logger from '../../utils/logger';
import { AppError, isOperationalError, getUserFriendlyMessage, getStatusCode } from '../../utils/errors';

export interface RetryOptions {
  maxAttempts: number;
  delayMs: number;
  exponentialBackoff: boolean;
  retryableErrors?: string[];
}

export interface ErrorAlert {
  severity: 'low' | 'medium' | 'high' | 'critical';
  error: Error;
  context: any;
  timestamp: Date;
}

export class ErrorHandler {
  private static instance: ErrorHandler;
  private errorAlerts: ErrorAlert[] = [];
  private maxAlertsStored = 100;

  private constructor() {}

  static getInstance(): ErrorHandler {
    if (!ErrorHandler.instance) {
      ErrorHandler.instance = new ErrorHandler();
    }
    return ErrorHandler.instance;
  }

  /**
   * Handle error with logging and alerting
   */
  handleError(error: Error, context?: any): void {
    // Log error
    this.logError(error, context);

    // Determine severity
    const severity = this.determineSeverity(error);

    // Store alert if critical
    if (severity === 'critical' || severity === 'high') {
      this.storeAlert(error, context, severity);
    }

    // Send alert if critical
    if (severity === 'critical') {
      this.sendCriticalAlert(error, context);
    }
  }

  /**
   * Log error with structured format
   */
  private logError(error: Error, context?: any): void {
    const errorLog = {
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
      statusCode: getStatusCode(error),
      isOperational: isOperationalError(error),
      timestamp: new Date().toISOString(),
      context
    };

    if (isOperationalError(error)) {
      logger.warn('Operational error:', errorLog);
    } else {
      logger.error('Programming error:', errorLog);
    }
  }

  /**
   * Determine error severity
   */
  private determineSeverity(error: Error): ErrorAlert['severity'] {
    if (!isOperationalError(error)) {
      return 'critical'; // Programming errors are critical
    }

    const statusCode = getStatusCode(error);

    if (statusCode >= 500) {
      return 'high';
    } else if (statusCode >= 400) {
      return 'medium';
    }

    return 'low';
  }

  /**
   * Store error alert
   */
  private storeAlert(error: Error, context: any, severity: ErrorAlert['severity']): void {
    const alert: ErrorAlert = {
      severity,
      error,
      context,
      timestamp: new Date()
    };

    this.errorAlerts.push(alert);

    // Keep only last N alerts
    if (this.errorAlerts.length > this.maxAlertsStored) {
      this.errorAlerts.shift();
    }
  }

  /**
   * Send critical alert
   */
  private sendCriticalAlert(error: Error, context: any): void {
    // TODO: Implement actual alerting mechanism (email, SMS, Slack, etc.)
    logger.error('CRITICAL ERROR ALERT:', {
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit: number = 10): ErrorAlert[] {
    return this.errorAlerts.slice(-limit);
  }

  /**
   * Clear alerts
   */
  clearAlerts(): void {
    this.errorAlerts = [];
  }

  /**
   * Retry function with exponential backoff
   */
  async retry<T>(
    fn: () => Promise<T>,
    options: RetryOptions,
    context?: string
  ): Promise<T> {
    const { maxAttempts, delayMs, exponentialBackoff, retryableErrors } = options;

    let lastError: Error;
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        attempt++;
        logger.debug(`Attempt ${attempt}/${maxAttempts} for ${context || 'operation'}`);
        return await fn();
      } catch (error: any) {
        lastError = error;

        // Check if error is retryable
        if (retryableErrors && !this.isRetryableError(error, retryableErrors)) {
          logger.warn(`Non-retryable error encountered: ${error.message}`);
          throw error;
        }

        // Don't retry on last attempt
        if (attempt >= maxAttempts) {
          break;
        }

        // Calculate delay
        const delay = exponentialBackoff ? delayMs * Math.pow(2, attempt - 1) : delayMs;

        logger.warn(
          `Attempt ${attempt} failed for ${context || 'operation'}: ${error.message}. Retrying in ${delay}ms...`
        );

        // Wait before retry
        await this.sleep(delay);
      }
    }

    // All attempts failed
    logger.error(`All ${maxAttempts} attempts failed for ${context || 'operation'}`);
    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error, retryableErrors: string[]): boolean {
    const errorCode = (error as any).code;
    if (errorCode && retryableErrors.includes(errorCode)) {
      return true;
    }

    // Check error message
    return retryableErrors.some((retryable) =>
      error.message.toLowerCase().includes(retryable.toLowerCase())
    );
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Wrap async function with error handling
   */
  wrapAsync<T>(
    fn: (...args: any[]) => Promise<T>,
    context?: string
  ): (...args: any[]) => Promise<T> {
    return async (...args: any[]): Promise<T> => {
      try {
        return await fn(...args);
      } catch (error: any) {
        this.handleError(error, { context, args });
        throw error;
      }
    };
  }

  /**
   * Create user-friendly error response
   */
  createErrorResponse(error: Error): {
    error: string;
    message: string;
    code?: string;
    details?: any;
    timestamp: string;
  } {
    const statusCode = getStatusCode(error);
    const userMessage = getUserFriendlyMessage(error);

    const response: any = {
      error: this.getErrorName(statusCode),
      message: userMessage,
      timestamp: new Date().toISOString()
    };

    // Add code and details for operational errors
    if (error instanceof AppError) {
      response.code = error.code;
      if (error.details && process.env.NODE_ENV !== 'production') {
        response.details = error.details;
      }
    }

    // Add stack trace in development
    if (process.env.NODE_ENV === 'development') {
      response.stack = error.stack;
    }

    return response;
  }

  /**
   * Get error name from status code
   */
  private getErrorName(statusCode: number): string {
    const errorNames: Record<number, string> = {
      400: 'Bad Request',
      401: 'Unauthorized',
      403: 'Forbidden',
      404: 'Not Found',
      422: 'Unprocessable Entity',
      429: 'Too Many Requests',
      500: 'Internal Server Error',
      503: 'Service Unavailable'
    };

    return errorNames[statusCode] || 'Error';
  }

  /**
   * Graceful degradation - return fallback value on error
   */
  async withFallback<T>(
    fn: () => Promise<T>,
    fallback: T,
    context?: string
  ): Promise<T> {
    try {
      return await fn();
    } catch (error: any) {
      logger.warn(`Operation failed, using fallback for ${context || 'operation'}:`, error.message);
      this.handleError(error, { context, fallback: true });
      return fallback;
    }
  }

  /**
   * Execute with timeout
   */
  async withTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    context?: string
  ): Promise<T> {
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timed out after ${timeoutMs}ms: ${context || 'operation'}`)),
          timeoutMs
        )
      )
    ]);
  }
}

// Export singleton instance
export const errorHandler = ErrorHandler.getInstance();
