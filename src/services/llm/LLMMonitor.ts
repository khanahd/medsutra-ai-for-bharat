import { logger } from '../../utils/logger';

export interface LLMMetrics {
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  totalLatencyMs: number;
  averageLatencyMs: number;
  totalTokensUsed: number;
  errorRate: number;
  requestsPerMinute: number;
}

export interface LLMPerformanceLog {
  timestamp: Date;
  operation: 'generate' | 'embed' | 'classify' | 'extract';
  latencyMs: number;
  success: boolean;
  tokensUsed?: number;
  error?: string;
}

/**
 * LLM Performance Monitor
 * Tracks LLM usage, performance, and errors
 */
export class LLMMonitor {
  private metrics: LLMMetrics;
  private performanceLogs: LLMPerformanceLog[] = [];
  private maxLogs: number = 10000;
  private startTime: Date;

  constructor() {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      totalTokensUsed: 0,
      errorRate: 0,
      requestsPerMinute: 0,
    };
    this.startTime = new Date();
  }

  /**
   * Log LLM operation
   */
  logOperation(log: LLMPerformanceLog): void {
    this.performanceLogs.push(log);

    // Keep only recent logs
    if (this.performanceLogs.length > this.maxLogs) {
      this.performanceLogs.shift();
    }

    // Update metrics
    this.metrics.totalRequests++;
    this.metrics.totalLatencyMs += log.latencyMs;

    if (log.success) {
      this.metrics.successfulRequests++;
    } else {
      this.metrics.failedRequests++;
    }

    if (log.tokensUsed) {
      this.metrics.totalTokensUsed += log.tokensUsed;
    }

    // Recalculate derived metrics
    this.updateDerivedMetrics();

    // Log warnings for slow operations
    if (log.latencyMs > 10000) {
      logger.warn('Slow LLM operation detected', {
        operation: log.operation,
        latencyMs: log.latencyMs,
      });
    }

    // Log errors
    if (!log.success && log.error) {
      logger.error('LLM operation failed', {
        operation: log.operation,
        error: log.error,
      });
    }
  }

  /**
   * Update derived metrics
   */
  private updateDerivedMetrics(): void {
    this.metrics.averageLatencyMs =
      this.metrics.totalRequests > 0
        ? this.metrics.totalLatencyMs / this.metrics.totalRequests
        : 0;

    this.metrics.errorRate =
      this.metrics.totalRequests > 0
        ? this.metrics.failedRequests / this.metrics.totalRequests
        : 0;

    const uptimeMinutes = (Date.now() - this.startTime.getTime()) / (1000 * 60);
    this.metrics.requestsPerMinute =
      uptimeMinutes > 0 ? this.metrics.totalRequests / uptimeMinutes : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): LLMMetrics {
    return { ...this.metrics };
  }

  /**
   * Get recent performance logs
   */
  getRecentLogs(count: number = 100): LLMPerformanceLog[] {
    return this.performanceLogs.slice(-count);
  }

  /**
   * Get performance summary for a time window
   */
  getPerformanceSummary(windowMinutes: number = 60): {
    requests: number;
    avgLatency: number;
    errorRate: number;
    tokensUsed: number;
  } {
    const cutoffTime = Date.now() - windowMinutes * 60 * 1000;
    const recentLogs = this.performanceLogs.filter(
      (log) => log.timestamp.getTime() > cutoffTime
    );

    if (recentLogs.length === 0) {
      return {
        requests: 0,
        avgLatency: 0,
        errorRate: 0,
        tokensUsed: 0,
      };
    }

    const totalLatency = recentLogs.reduce((sum, log) => sum + log.latencyMs, 0);
    const failures = recentLogs.filter((log) => !log.success).length;
    const tokensUsed = recentLogs.reduce((sum, log) => sum + (log.tokensUsed || 0), 0);

    return {
      requests: recentLogs.length,
      avgLatency: totalLatency / recentLogs.length,
      errorRate: failures / recentLogs.length,
      tokensUsed,
    };
  }

  /**
   * Check if LLM performance is degraded
   */
  isPerformanceDegraded(): boolean {
    const summary = this.getPerformanceSummary(5); // Last 5 minutes

    // Performance is degraded if:
    // - Error rate > 10%
    // - Average latency > 15 seconds
    return summary.errorRate > 0.1 || summary.avgLatency > 15000;
  }

  /**
   * Reset metrics
   */
  reset(): void {
    this.metrics = {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      totalLatencyMs: 0,
      averageLatencyMs: 0,
      totalTokensUsed: 0,
      errorRate: 0,
      requestsPerMinute: 0,
    };
    this.performanceLogs = [];
    this.startTime = new Date();
    logger.info('LLM monitor metrics reset');
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const summary5min = this.getPerformanceSummary(5);
    const summary60min = this.getPerformanceSummary(60);

    return `
LLM Performance Report
=====================

Overall Metrics:
- Total Requests: ${metrics.totalRequests}
- Success Rate: ${((metrics.successfulRequests / metrics.totalRequests) * 100).toFixed(2)}%
- Error Rate: ${(metrics.errorRate * 100).toFixed(2)}%
- Average Latency: ${metrics.averageLatencyMs.toFixed(0)}ms
- Total Tokens Used: ${metrics.totalTokensUsed}
- Requests/Minute: ${metrics.requestsPerMinute.toFixed(2)}

Last 5 Minutes:
- Requests: ${summary5min.requests}
- Avg Latency: ${summary5min.avgLatency.toFixed(0)}ms
- Error Rate: ${(summary5min.errorRate * 100).toFixed(2)}%
- Tokens Used: ${summary5min.tokensUsed}

Last 60 Minutes:
- Requests: ${summary60min.requests}
- Avg Latency: ${summary60min.avgLatency.toFixed(0)}ms
- Error Rate: ${(summary60min.errorRate * 100).toFixed(2)}%
- Tokens Used: ${summary60min.tokensUsed}

Performance Status: ${this.isPerformanceDegraded() ? '⚠️  DEGRADED' : '✓ HEALTHY'}
    `.trim();
  }
}

// Singleton instance
export const llmMonitor = new LLMMonitor();
