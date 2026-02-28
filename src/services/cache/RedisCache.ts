import { createClient, RedisClientType } from 'redis';
import logger from '../../utils/logger';

export class RedisCache {
  private client: RedisClientType | null = null;
  private connected = false;
  private enabled = false;

  constructor() {
    this.enabled = process.env.REDIS_ENABLED === 'true';

    if (this.enabled) {
      this.initialize();
    } else {
      logger.info('Redis cache is disabled');
    }
  }

  /**
   * Initialize Redis connection
   */
  private async initialize(): Promise<void> {
    try {
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

      this.client = createClient({
        url: redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              logger.error('Redis reconnection failed after 10 attempts');
              return new Error('Redis reconnection failed');
            }
            return Math.min(retries * 100, 3000);
          }
        }
      });

      this.client.on('error', (err) => {
        logger.error('Redis client error:', err);
        this.connected = false;
      });

      this.client.on('connect', () => {
        logger.info('Redis client connected');
        this.connected = true;
      });

      this.client.on('disconnect', () => {
        logger.warn('Redis client disconnected');
        this.connected = false;
      });

      await this.client.connect();
      logger.info('Redis cache initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Redis cache:', error);
      this.enabled = false;
    }
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    if (!this.enabled || !this.connected || !this.client) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      if (value) {
        return JSON.parse(value) as T;
      }
      return null;
    } catch (error) {
      logger.error(`Redis get error for key ${key}:`, error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, ttlSeconds: number = 3600): Promise<boolean> {
    if (!this.enabled || !this.connected || !this.client) {
      return false;
    }

    try {
      await this.client.setEx(key, ttlSeconds, JSON.stringify(value));
      return true;
    } catch (error) {
      logger.error(`Redis set error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string): Promise<boolean> {
    if (!this.enabled || !this.connected || !this.client) {
      return false;
    }

    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      logger.error(`Redis delete error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Check if key exists
   */
  async exists(key: string): Promise<boolean> {
    if (!this.enabled || !this.connected || !this.client) {
      return false;
    }

    try {
      const result = await this.client.exists(key);
      return result === 1;
    } catch (error) {
      logger.error(`Redis exists error for key ${key}:`, error);
      return false;
    }
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<boolean> {
    if (!this.enabled || !this.connected || !this.client) {
      return false;
    }

    try {
      await this.client.flushDb();
      logger.info('Redis cache cleared');
      return true;
    } catch (error) {
      logger.error('Redis clear error:', error);
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    enabled: boolean;
    connected: boolean;
    keys: number;
    memoryUsed: string;
  }> {
    if (!this.enabled || !this.connected || !this.client) {
      return {
        enabled: this.enabled,
        connected: false,
        keys: 0,
        memoryUsed: '0'
      };
    }

    try {
      const dbSize = await this.client.dbSize();
      const info = await this.client.info('memory');

      // Parse memory usage from info string
      const memoryMatch = info.match(/used_memory_human:([^\r\n]+)/);
      const memoryUsed = memoryMatch ? memoryMatch[1] : '0';

      return {
        enabled: this.enabled,
        connected: this.connected,
        keys: dbSize,
        memoryUsed
      };
    } catch (error) {
      logger.error('Redis stats error:', error);
      return {
        enabled: this.enabled,
        connected: this.connected,
        keys: 0,
        memoryUsed: '0'
      };
    }
  }

  /**
   * Close Redis connection
   */
  async close(): Promise<void> {
    if (this.client && this.connected) {
      await this.client.quit();
      logger.info('Redis connection closed');
    }
  }

  /**
   * Check if cache is enabled and connected
   */
  isAvailable(): boolean {
    return this.enabled && this.connected;
  }
}

// Export singleton instance
export const redisCache = new RedisCache();
