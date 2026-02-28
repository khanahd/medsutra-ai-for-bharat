import { AppDataSource } from '../../config/database';
import logger from '../../utils/logger';

export interface PerformanceMetrics {
  timestamp: Date;
  activeConnections: number;
  databasePoolSize: number;
  cacheHitRate: number;
  avgResponseTime: number;
  requestsPerSecond: number;
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
    rss: number;
  };
  cpuUsage: {
    user: number;
    system: number;
  };
}

export interface LoadTestResult {
  concurrentUsers: number;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  requestsPerSecond: number;
  errors: string[];
}

export class PerformanceOptimizer {
  private metricsHistory: PerformanceMetrics[] = [];
  private maxHistorySize = 1000;
  private requestTimes: number[] = [];
  private requestCount = 0;
  private startTime = Date.now();

  constructor() {
    // Start metrics collection
    this.startMetricsCollection();
  }

  /**
   * Start collecting performance metrics
   */
  private startMetricsCollection(): void {
    // Collect metrics every 10 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 10000);
  }

  /**
   * Collect current performance metrics
   */
  private collectMetrics(): void {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    const metrics: PerformanceMetrics = {
      timestamp: new Date(),
      activeConnections: this.getActiveConnections(),
      databasePoolSize: this.getDatabasePoolSize(),
      cacheHitRate: this.getCacheHitRate(),
      avgResponseTime: this.getAvgResponseTime(),
      requestsPerSecond: this.getRequestsPerSecond(),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };

    this.metricsHistory.push(metrics);

    // Keep only last maxHistorySize metrics
    if (this.metricsHistory.length > this.maxHistorySize) {
      this.metricsHistory.shift();
    }

    // Log if performance is degraded
    if (metrics.avgResponseTime > 5000) {
      logger.warn(`High average response time: ${metrics.avgResponseTime}ms`);
    }

    if (metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal > 0.9) {
      logger.warn('High memory usage detected');
    }
  }

  /**
   * Track request response time
   */
  trackRequest(responseTimeMs: number): void {
    this.requestTimes.push(responseTimeMs);
    this.requestCount++;

    // Keep only last 1000 request times
    if (this.requestTimes.length > 1000) {
      this.requestTimes.shift();
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceMetrics {
    const memUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage();

    return {
      timestamp: new Date(),
      activeConnections: this.getActiveConnections(),
      databasePoolSize: this.getDatabasePoolSize(),
      cacheHitRate: this.getCacheHitRate(),
      avgResponseTime: this.getAvgResponseTime(),
      requestsPerSecond: this.getRequestsPerSecond(),
      memoryUsage: {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      },
      cpuUsage: {
        user: cpuUsage.user,
        system: cpuUsage.system
      }
    };
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit: number = 100): PerformanceMetrics[] {
    return this.metricsHistory.slice(-limit);
  }

  /**
   * Get active database connections
   */
  private getActiveConnections(): number {
    try {
      if (AppDataSource.isInitialized) {
        // TypeORM doesn't expose active connections directly
        // This is an approximation
        return 0; // Would need to query pg_stat_activity
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get database connection pool size
   */
  private getDatabasePoolSize(): number {
    try {
      if (AppDataSource.isInitialized && AppDataSource.driver) {
        // Get pool size from options
        const options = AppDataSource.options as any;
        return options.extra?.max || 10;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get cache hit rate
   */
  private getCacheHitRate(): number {
    // TODO: Implement actual cache hit rate calculation
    // This would track cache hits vs misses
    return 0;
  }

  /**
   * Get average response time
   */
  private getAvgResponseTime(): number {
    if (this.requestTimes.length === 0) {
      return 0;
    }

    const sum = this.requestTimes.reduce((a, b) => a + b, 0);
    return sum / this.requestTimes.length;
  }

  /**
   * Get requests per second
   */
  private getRequestsPerSecond(): number {
    const elapsedSeconds = (Date.now() - this.startTime) / 1000;
    if (elapsedSeconds === 0) {
      return 0;
    }
    return this.requestCount / elapsedSeconds;
  }

  /**
   * Optimize database connection pool
   */
  async optimizeDatabasePool(): Promise<{
    success: boolean;
    oldSize: number;
    newSize: number;
    message: string;
  }> {
    logger.info('Optimizing database connection pool...');

    const currentSize = this.getDatabasePoolSize();
    const activeConnections = this.getActiveConnections();

    // Calculate optimal pool size based on concurrent users
    const maxConcurrentUsers = parseInt(process.env.MAX_CONCURRENT_USERS || '100');
    const optimalPoolSize = Math.min(Math.ceil(maxConcurrentUsers * 0.2), 50);

    logger.info(
      `Current pool size: ${currentSize}, Active connections: ${activeConnections}, Optimal: ${optimalPoolSize}`
    );

    // Note: Actual pool size change would require restarting the connection
    // This is a recommendation

    return {
      success: true,
      oldSize: currentSize,
      newSize: optimalPoolSize,
      message: `Recommended pool size: ${optimalPoolSize} (requires restart to apply)`
    };
  }

  /**
   * Enable response compression
   */
  isCompressionEnabled(): boolean {
    // Check if compression middleware is enabled
    return process.env.COMPRESSION_ENABLED === 'true';
  }

  /**
   * Simulate load test
   */
  async runLoadTest(
    concurrentUsers: number,
    requestsPerUser: number,
    endpoint: string
  ): Promise<LoadTestResult> {
    logger.info(`Running load test: ${concurrentUsers} users, ${requestsPerUser} requests each`);

    const totalRequests = concurrentUsers * requestsPerUser;
    const responseTimes: number[] = [];
    const errors: string[] = [];
    let successfulRequests = 0;
    let failedRequests = 0;

    const startTime = Date.now();

    // Simulate concurrent requests
    const promises: Promise<void>[] = [];

    for (let user = 0; user < concurrentUsers; user++) {
      for (let req = 0; req < requestsPerUser; req++) {
        const promise = this.simulateRequest(endpoint)
          .then((responseTime) => {
            responseTimes.push(responseTime);
            successfulRequests++;
          })
          .catch((error) => {
            errors.push(error.message);
            failedRequests++;
          });

        promises.push(promise);
      }
    }

    await Promise.all(promises);

    const endTime = Date.now();
    const duration = (endTime - startTime) / 1000; // seconds

    const avgResponseTime =
      responseTimes.length > 0
        ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
        : 0;

    const minResponseTime = responseTimes.length > 0 ? Math.min(...responseTimes) : 0;
    const maxResponseTime = responseTimes.length > 0 ? Math.max(...responseTimes) : 0;

    const result: LoadTestResult = {
      concurrentUsers,
      totalRequests,
      successfulRequests,
      failedRequests,
      avgResponseTime,
      minResponseTime,
      maxResponseTime,
      requestsPerSecond: totalRequests / duration,
      errors: errors.slice(0, 10) // Return first 10 errors
    };

    logger.info('Load test complete:', result);

    return result;
  }

  /**
   * Simulate a single request
   */
  private async simulateRequest(endpoint: string): Promise<number> {
    const startTime = Date.now();

    // Simulate request processing time
    await new Promise((resolve) => setTimeout(resolve, Math.random() * 1000 + 500));

    const responseTime = Date.now() - startTime;

    // Simulate occasional failures
    if (Math.random() < 0.05) {
      // 5% failure rate
      throw new Error('Simulated request failure');
    }

    return responseTime;
  }

  /**
   * Get performance recommendations
   */
  getPerformanceRecommendations(): string[] {
    const recommendations: string[] = [];
    const metrics = this.getCurrentMetrics();

    // Check response time
    if (metrics.avgResponseTime > 5000) {
      recommendations.push('Average response time is high (>5s). Consider optimizing queries or adding caching.');
    }

    // Check memory usage
    const memoryUsagePercent = metrics.memoryUsage.heapUsed / metrics.memoryUsage.heapTotal;
    if (memoryUsagePercent > 0.8) {
      recommendations.push('Memory usage is high (>80%). Consider increasing heap size or optimizing memory usage.');
    }

    // Check database pool
    const poolSize = metrics.databasePoolSize;
    const maxConcurrentUsers = parseInt(process.env.MAX_CONCURRENT_USERS || '100');
    const recommendedPoolSize = Math.ceil(maxConcurrentUsers * 0.2);

    if (poolSize < recommendedPoolSize) {
      recommendations.push(
        `Database pool size (${poolSize}) is smaller than recommended (${recommendedPoolSize}). Increase pool size.`
      );
    }

    // Check compression
    if (!this.isCompressionEnabled()) {
      recommendations.push('Response compression is disabled. Enable compression to reduce bandwidth usage.');
    }

    // Check caching
    if (metrics.cacheHitRate < 0.5) {
      recommendations.push('Cache hit rate is low (<50%). Consider adding more caching layers.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Performance is optimal. No recommendations at this time.');
    }

    return recommendations;
  }
}
