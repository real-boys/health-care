const redis = require('redis');
const { getDatabase } = require('../database/connection');

class RateLimitService {
  constructor() {
    this.redisClient = null;
    this.db = null;
    this.initRedis();
    this.initDatabase();
  }

  async initRedis() {
    try {
      this.redisClient = redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        retry_strategy: (options) => {
          if (options.error && options.error.code === 'ECONNREFUSED') {
            console.error('Redis server connection refused');
            return new Error('Redis server connection refused');
          }
          if (options.total_retry_time > 1000 * 60 * 60) {
            console.error('Redis retry time exhausted');
            return new Error('Retry time exhausted');
          }
          if (options.attempt > 10) {
            console.error('Redis retry attempts exhausted');
            return undefined;
          }
          return Math.min(options.attempt * 100, 3000);
        }
      });

      this.redisClient.on('error', (err) => {
        console.error('Redis Client Error:', err);
      });

      this.redisClient.on('connect', () => {
        console.log('Redis Client Connected');
      });

      await this.redisClient.connect();
    } catch (error) {
      console.error('Failed to initialize Redis:', error);
      // Fallback to in-memory cache if Redis fails
      this.memoryCache = new Map();
    }
  }

  async initDatabase() {
    this.db = await getDatabase();
  }

  async getUserTier(userId) {
    try {
      const query = `
        SELECT ut.*, us.is_active, us.end_date
        FROM user_subscriptions us
        JOIN user_tiers ut ON us.tier_id = ut.id
        WHERE us.user_id = ? AND us.is_active = 1 
        AND (us.end_date IS NULL OR us.end_date > datetime('now'))
        ORDER BY us.created_at DESC
        LIMIT 1
      `;
      
      const result = await this.db.get(query, [userId]);
      
      // If no active subscription, return free tier
      if (!result) {
        const freeTierQuery = `SELECT * FROM user_tiers WHERE name = 'free'`;
        return await this.db.get(freeTierQuery);
      }
      
      return result;
    } catch (error) {
      console.error('Error getting user tier:', error);
      // Return free tier as fallback
      return { name: 'free', minute_api_calls: 5, hourly_api_calls: 20, daily_api_calls: 100, monthly_api_calls: 1000 };
    }
  }

  async getUserRateLimitOverride(userId, endpoint) {
    try {
      const query = `
        SELECT * FROM rate_limit_overrides 
        WHERE user_id = ? AND is_active = 1 
        AND (expires_at IS NULL OR expires_at > datetime('now'))
        AND (endpoint = ? OR endpoint IS NULL)
        ORDER BY endpoint DESC, created_at DESC
        LIMIT 1
      `;
      
      return await this.db.get(query, [userId, endpoint]);
    } catch (error) {
      console.error('Error getting rate limit override:', error);
      return null;
    }
  }

  async applyRateLimitOverride(tier, override) {
    if (!override) return tier;
    
    const modifiedTier = { ...tier };
    
    if (override.custom_limits) {
      try {
        const customLimits = JSON.parse(override.custom_limits);
        Object.assign(modifiedTier, customLimits);
      } catch (error) {
        console.error('Error parsing custom limits:', error);
      }
    }
    
    if (override.multiplier && override.multiplier !== 1.0) {
      modifiedTier.minute_api_calls = Math.floor(tier.minute_api_calls * override.multiplier);
      modifiedTier.hourly_api_calls = Math.floor(tier.hourly_api_calls * override.multiplier);
      modifiedTier.daily_api_calls = Math.floor(tier.daily_api_calls * override.multiplier);
      modifiedTier.monthly_api_calls = Math.floor(tier.monthly_api_calls * override.multiplier);
    }
    
    return modifiedTier;
  }

  async checkRateLimit(userId, endpoint, method = 'GET') {
    try {
      // Get user tier and apply any overrides
      const userTier = await this.getUserTier(userId);
      const override = await this.getUserRateLimitOverride(userId, endpoint);
      const effectiveTier = await this.applyRateLimitOverride(userTier, override);

      const now = new Date();
      const windows = [
        { type: 'minute', limit: effectiveTier.minute_api_calls, windowMs: 60 * 1000 },
        { type: 'hour', limit: effectiveTier.hourly_api_calls, windowMs: 60 * 60 * 1000 },
        { type: 'day', limit: effectiveTier.daily_api_calls, windowMs: 24 * 60 * 60 * 1000 },
        { type: 'month', limit: effectiveTier.monthly_api_calls, windowMs: 30 * 24 * 60 * 60 * 1000 }
      ];

      const results = [];

      for (const window of windows) {
        const result = await this.checkWindowLimit(userId, endpoint, method, window, now);
        results.push(result);
        
        if (!result.allowed) {
          // Log rate limit violation
          await this.logRateLimitViolation(userId, endpoint, method, window, result);
          return {
            allowed: false,
            window: window.type,
            limit: window.limit,
            current: result.current,
            resetTime: result.resetTime,
            retryAfter: result.retryAfter
          };
        }
      }

      return {
        allowed: true,
        limits: results.map(r => ({
          window: r.window,
          limit: r.limit,
          current: r.current,
          remaining: r.remaining
        }))
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Fail open - allow request if rate limiting fails
      return { allowed: true, error: error.message };
    }
  }

  async checkWindowLimit(userId, endpoint, method, window, now) {
    const key = `rate_limit:${userId}:${endpoint}:${method}:${window.type}`;
    const windowStart = new Date(now.getTime() - window.windowMs);
    
    try {
      if (this.redisClient) {
        return await this.checkRedisLimit(key, window, windowStart, now);
      } else {
        return await this.checkMemoryLimit(key, window, windowStart, now);
      }
    } catch (error) {
      console.error(`Error checking ${window.type} limit:`, error);
      return { allowed: true, current: 0, limit: window.limit };
    }
  }

  async checkRedisLimit(key, window, windowStart, now) {
    const pipeline = this.redisClient.multi();
    
    // Remove old entries
    pipeline.zRemRangeByScore(key, 0, windowStart.getTime());
    
    // Count current requests
    pipeline.zCard(key);
    
    // Add current request
    pipeline.zAdd(key, { score: now.getTime(), value: `${now.getTime()}-${Math.random()}` });
    
    // Set expiration
    pipeline.expire(key, Math.ceil(window.windowMs / 1000) + 60);
    
    const results = await pipeline.exec();
    const current = results[1].response;
    
    return {
      allowed: current < window.limit,
      current,
      limit: window.limit,
      remaining: Math.max(0, window.limit - current - 1),
      resetTime: new Date(now.getTime() + window.windowMs),
      retryAfter: current >= window.limit ? Math.ceil(window.windowMs / 1000) : 0
    };
  }

  async checkMemoryLimit(key, window, windowStart, now) {
    if (!this.memoryCache) {
      this.memoryCache = new Map();
    }
    
    let requests = this.memoryCache.get(key) || [];
    
    // Remove old requests
    requests = requests.filter(timestamp => timestamp > windowStart.getTime());
    
    const current = requests.length;
    
    if (current < window.limit) {
      requests.push(now.getTime());
      this.memoryCache.set(key, requests);
    }
    
    return {
      allowed: current < window.limit,
      current,
      limit: window.limit,
      remaining: Math.max(0, window.limit - current - 1),
      resetTime: new Date(now.getTime() + window.windowMs),
      retryAfter: current >= window.limit ? Math.ceil(window.windowMs / 1000) : 0
    };
  }

  async logRateLimitViolation(userId, endpoint, method, window, result) {
    try {
      const query = `
        INSERT INTO rate_limit_violations 
        (user_id, endpoint, method, window_type, limit_value, actual_count, ip_address, user_agent, blocked_until)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      const blockedUntil = new Date(Date.now() + (result.retryAfter * 1000));
      
      await this.db.run(query, [
        userId,
        endpoint,
        method,
        window.type,
        window.limit,
        result.current,
        null, // IP address would be set from request context
        null, // User agent would be set from request context
        blockedUntil.toISOString()
      ]);
    } catch (error) {
      console.error('Error logging rate limit violation:', error);
    }
  }

  async logApiUsage(userId, endpoint, method, responseStatus, ipAddress, userAgent) {
    try {
      const now = new Date();
      const windows = ['minute', 'hour', 'day', 'month'];
      
      for (const windowType of windows) {
        const windowStart = this.getWindowStart(now, windowType);
        
        const query = `
          INSERT OR REPLACE INTO api_usage_logs 
          (user_id, endpoint, method, request_count, window_start, window_type, ip_address, user_agent, response_status)
          VALUES (?, ?, ?, 
            COALESCE((SELECT request_count FROM api_usage_logs 
                     WHERE user_id = ? AND endpoint = ? AND method = ? 
                     AND window_start = ? AND window_type = ?), 0) + 1,
            ?, ?, ?, ?, ?)
        `;
        
        await this.db.run(query, [
          userId, endpoint, method, 1,
          userId, endpoint, method, windowStart, windowType,
          userId, endpoint, method, windowStart, windowType,
          ipAddress, userAgent, responseStatus
        ]);
      }
    } catch (error) {
      console.error('Error logging API usage:', error);
    }
  }

  getWindowStart(now, windowType) {
    const date = new Date(now);
    
    switch (windowType) {
      case 'minute':
        date.setSeconds(0, 0);
        break;
      case 'hour':
        date.setMinutes(0, 0, 0);
        break;
      case 'day':
        date.setHours(0, 0, 0, 0);
        break;
      case 'month':
        date.setDate(1);
        date.setHours(0, 0, 0, 0);
        break;
    }
    
    return date;
  }

  async getUserQuotaInfo(userId) {
    try {
      const query = `
        SELECT uq.*, ut.name as tier_name, ut.display_name as tier_display_name
        FROM user_quotas uq
        JOIN users u ON uq.user_id = u.id
        LEFT JOIN user_subscriptions us ON u.id = us.user_id AND us.is_active = 1
        LEFT JOIN user_tiers ut ON us.tier_id = ut.id
        WHERE uq.user_id = ?
        ORDER BY uq.quota_type
      `;
      
      const quotas = await this.db.all(query, [userId]);
      
      // If no quotas found, initialize from tier
      if (quotas.length === 0) {
        await this.initializeUserQuotas(userId);
        return await this.getUserQuotaInfo(userId);
      }
      
      return quotas;
    } catch (error) {
      console.error('Error getting user quota info:', error);
      return [];
    }
  }

  async initializeUserQuotas(userId) {
    try {
      const tier = await this.getUserTier(userId);
      const now = new Date();
      
      const quotas = [
        { type: 'minute', limit: tier.minute_api_calls, resetDate: this.getWindowStart(now, 'minute') },
        { type: 'hour', limit: tier.hourly_api_calls, resetDate: this.getWindowStart(now, 'hour') },
        { type: 'day', limit: tier.daily_api_calls, resetDate: this.getWindowStart(now, 'day') },
        { type: 'month', limit: tier.monthly_api_calls, resetDate: this.getWindowStart(now, 'month') }
      ];
      
      for (const quota of quotas) {
        const query = `
          INSERT OR REPLACE INTO user_quotas 
          (user_id, quota_type, current_usage, max_allowed, reset_date)
          VALUES (?, ?, 0, ?, ?)
        `;
        
        await this.db.run(query, [userId, quota.type, quota.limit, quota.resetDate.toISOString()]);
      }
    } catch (error) {
      console.error('Error initializing user quotas:', error);
    }
  }

  async resetUserQuota(userId, quotaType) {
    try {
      const now = new Date();
      const resetDate = this.getWindowStart(now, quotaType);
      
      const query = `
        UPDATE user_quotas 
        SET current_usage = 0, reset_date = ?, last_updated = ?
        WHERE user_id = ? AND quota_type = ?
      `;
      
      await this.db.run(query, [resetDate.toISOString(), now.toISOString(), userId, quotaType]);
    } catch (error) {
      console.error('Error resetting user quota:', error);
    }
  }
}

// Singleton instance
const rateLimitService = new RateLimitService();

module.exports = rateLimitService;
