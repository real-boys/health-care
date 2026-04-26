// Query Result Caching Layer using Redis
const redis = require('redis');
const { promisify } = require('util');
const crypto = require('crypto');

class CacheManager {
  constructor(options = {}) {
    this.redisUrl = options.redisUrl || 'redis://localhost:6379';
    this.client = null;
    this.ttl = options.ttl || 3600; // 1 hour default
    this.cacheMetrics = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      evictions: 0
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize() {
    try {
      this.client = redis.createClient({
        url: this.redisUrl,
        socket: {
          reconnectStrategy: (retries) => {
            if (retries > 10) {
              console.error('Max Redis reconnection attempts reached');
              return new Error('Max retries reached');
            }
            return retries * 100;
          }
        }
      });

      this.client.on('error', (err) => console.error('Redis error:', err));
      this.client.on('connect', () => console.log('Redis connected'));

      await this.client.connect();
      console.log('Cache manager initialized');
    } catch (error) {
      console.error('Error initializing cache manager:', error);
      throw error;
    }
  }

  /**
   * Generate cache key
   */
  generateKey(prefix, query, options = {}) {
    const data = JSON.stringify({ query, options });
    const hash = crypto.createHash('md5').update(data).digest('hex');
    return `${prefix}:${hash}`;
  }

  /**
   * Get from cache
   */
  async get(key) {
    try {
      if (!this.client) {
        return null;
      }

      const value = await this.client.get(key);
      
      if (value) {
        this.cacheMetrics.hits++;
        return JSON.parse(value);
      }

      this.cacheMetrics.misses++;
      return null;
    } catch (error) {
      console.error('Error getting from cache:', error);
      return null; // Fail gracefully
    }
  }

  /**
   * Set cache value
   */
  async set(key, value, ttl = null) {
    try {
      if (!this.client) {
        return false;
      }

      const expiryTime = ttl || this.ttl;
      await this.client.setEx(key, expiryTime, JSON.stringify(value));
      this.cacheMetrics.sets++;
      return true;
    } catch (error) {
      console.error('Error setting cache:', error);
      return false; // Fail gracefully
    }
  }

  /**
   * Delete from cache
   */
  async delete(key) {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.del(key);
      this.cacheMetrics.deletes++;
      return true;
    } catch (error) {
      console.error('Error deleting from cache:', error);
      return false;
    }
  }

  /**
   * Delete by pattern
   */
  async deletePattern(pattern) {
    try {
      if (!this.client) {
        return 0;
      }

      const keys = await this.client.keys(pattern);
      if (keys.length > 0) {
        await this.client.del(keys);
        this.cacheMetrics.deletes += keys.length;
      }
      return keys.length;
    } catch (error) {
      console.error('Error deleting by pattern:', error);
      return 0;
    }
  }

  /**
   * Cache query result
   */
  async cacheQuery(collection, query, result, options = {}) {
    try {
      const key = this.generateKey(`${collection}:query`, query, options);
      const ttl = options.ttl || this.ttl;
      await this.set(key, result, ttl);
      return key;
    } catch (error) {
      console.error('Error caching query:', error);
      throw error;
    }
  }

  /**
   * Get cached query result
   */
  async getCachedQuery(collection, query, options = {}) {
    try {
      const key = this.generateKey(`${collection}:query`, query, options);
      return await this.get(key);
    } catch (error) {
      console.error('Error getting cached query:', error);
      return null;
    }
  }

  /**
   * Invalidate collection cache
   */
  async invalidateCollection(collection) {
    try {
      const deleted = await this.deletePattern(`${collection}:*`);
      console.log(`Invalidated ${deleted} cache entries for ${collection}`);
      return deleted;
    } catch (error) {
      console.error('Error invalidating collection cache:', error);
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  async getStats() {
    try {
      if (!this.client) {
        return null;
      }

      const info = await this.client.info('stats');
      const memoryInfo = await this.client.info('memory');

      return {
        ...this.cacheMetrics,
        hitRate: this.cacheMetrics.hits / (this.cacheMetrics.hits + this.cacheMetrics.misses) || 0,
        memory: this.parseInfo(memoryInfo),
        stats: this.parseInfo(info)
      };
    } catch (error) {
      console.error('Error getting cache stats:', error);
      return null;
    }
  }

  /**
   * Parse Redis info response
   */
  parseInfo(info) {
    const result = {};
    info.split('\r\n').forEach(line => {
      const [key, value] = line.split(':');
      if (key && value) {
        result[key] = value;
      }
    });
    return result;
  }

  /**
   * Clear all cache
   */
  async clearAll() {
    try {
      if (!this.client) {
        return false;
      }

      await this.client.flushDb();
      this.cacheMetrics.evictions += this.cacheMetrics.sets;
      return true;
    } catch (error) {
      console.error('Error clearing cache:', error);
      return false;
    }
  }

  /**
   * Close connection
   */
  async close() {
    try {
      if (this.client) {
        await this.client.quit();
        console.log('Cache manager closed');
      }
    } catch (error) {
      console.error('Error closing cache manager:', error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.cacheMetrics;
  }
}

module.exports = CacheManager;
