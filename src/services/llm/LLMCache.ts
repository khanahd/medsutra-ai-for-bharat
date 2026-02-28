import crypto from 'crypto';
import { logger } from '../../utils/logger';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hits: number;
}

/**
 * LLM Response Cache
 * Caches LLM responses to reduce API calls and improve performance
 */
export class LLMCache<T = any> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private maxSize: number;
  private ttlMs: number;

  constructor(maxSize: number = 1000, ttlMinutes: number = 60) {
    this.maxSize = maxSize;
    this.ttlMs = ttlMinutes * 60 * 1000;

    // Periodic cleanup
    setInterval(() => this.cleanup(), 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Generate cache key from prompt and context
   */
  private generateKey(prompt: string, context?: any): string {
    const data = JSON.stringify({ prompt, context });
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  /**
   * Get cached value
   */
  get(prompt: string, context?: any): T | null {
    const key = this.generateKey(prompt, context);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttlMs) {
      this.cache.delete(key);
      return null;
    }

    // Update hit count
    entry.hits++;

    logger.debug('Cache hit', { key: key.substring(0, 8), hits: entry.hits });

    return entry.value;
  }

  /**
   * Set cached value
   */
  set(prompt: string, value: T, context?: any): void {
    const key = this.generateKey(prompt, context);

    // Evict oldest entry if cache is full
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hits: 0,
    });

    logger.debug('Cache set', { key: key.substring(0, 8), size: this.cache.size });
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    maxSize: number;
    hitRate: number;
    totalHits: number;
  } {
    let totalHits = 0;
    for (const entry of this.cache.values()) {
      totalHits += entry.hits;
    }

    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.cache.size > 0 ? totalHits / this.cache.size : 0,
      totalHits,
    };
  }

  /**
   * Cleanup expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup', { removed, remaining: this.cache.size });
    }
  }

  /**
   * Evict oldest entry
   */
  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
      logger.debug('Cache eviction', { key: oldestKey.substring(0, 8) });
    }
  }
}

// Singleton instances for different cache types
export const textGenerationCache = new LLMCache<string>(1000, 60);
export const embeddingCache = new LLMCache(5000, 120);
export const classificationCache = new LLMCache(500, 30);
