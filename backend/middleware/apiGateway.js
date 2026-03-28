/**
 * API Gateway Middleware for Healthcare Platform
 * Provides rate limiting, circuit breaker, request transformation, 
 * authentication, caching, and security features
 */

const crypto = require('crypto');
const { LRUCache } = require('lru-cache');

// ============================================
// Circuit Breaker Pattern
// ============================================
class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 30000; // 30 seconds
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    
    this.states = new Map(); // service -> state
  }

  getState(serviceName) {
    if (!this.states.has(serviceName)) {
      this.states.set(serviceName, {
        status: 'CLOSED',
        failureCount: 0,
        lastFailureTime: null,
        halfOpenCalls: 0,
        successCount: 0
      });
    }
    return this.states.get(serviceName);
  }

  canRequest(serviceName) {
    const state = this.getState(serviceName);
    
    switch (state.status) {
      case 'CLOSED':
        return true;
      case 'OPEN':
        // Check if reset timeout has passed
        if (Date.now() - state.lastFailureTime >= this.resetTimeout) {
          state.status = 'HALF_OPEN';
          state.halfOpenCalls = 0;
          state.successCount = 0;
          return true;
        }
        return false;
      case 'HALF_OPEN':
        return state.halfOpenCalls < this.halfOpenMaxCalls;
      default:
        return false;
    }
  }

  recordSuccess(serviceName) {
    const state = this.getState(serviceName);
    
    if (state.status === 'HALF_OPEN') {
      state.successCount++;
      state.halfOpenCalls++;
      
      if (state.successCount >= this.halfOpenMaxCalls) {
        state.status = 'CLOSED';
        state.failureCount = 0;
        state.successCount = 0;
      }
    } else if (state.status === 'CLOSED') {
      state.failureCount = 0;
    }
  }

  recordFailure(serviceName) {
    const state = this.getState(serviceName);
    state.failureCount++;
    state.lastFailureTime = Date.now();
    
    if (state.status === 'HALF_OPEN') {
      state.halfOpenCalls++;
      state.status = 'OPEN';
    } else if (state.failureCount >= this.failureThreshold) {
      state.status = 'OPEN';
    }
  }

  middleware() {
    return (req, res, next) => {
      const serviceName = this.getServiceName(req);
      const state = this.getState(serviceName);
      
      if (!this.canRequest(serviceName)) {
        return res.status(503).json({
          error: 'Service temporarily unavailable',
          code: 'CIRCUIT_BREAKER_OPEN',
          retryAfter: Math.ceil((this.resetTimeout - (Date.now() - state.lastFailureTime)) / 1000)
        });
      }
      
      // Track response
      const originalEnd = res.end;
      res.end = (...args) => {
        if (res.statusCode >= 500) {
          this.recordFailure(serviceName);
        } else {
          this.recordSuccess(serviceName);
        }
        return originalEnd.apply(res, args);
      };
      
      next();
    };
  }

  getServiceName(req) {
    // Extract service name from route
    const pathParts = req.path.split('/');
    return pathParts[2] || 'default';
  }
}

// ============================================
// Enhanced Rate Limiter
// ============================================
class EnhancedRateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60000; // 1 minute default
    this.maxRequests = options.maxRequests || 100;
    this.skipFailedRequests = options.skipFailedRequests || false;
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    this.onLimitReached = options.onLimitReached || null;
    this.store = new Map();
    this.slowDown = options.slowDown || { enabled: false };
    
    // Cleanup interval
    this.cleanupInterval = setInterval(() => {
      this.cleanup();
    }, this.windowMs);
  }

  defaultKeyGenerator(req) {
    return req.ip || req.connection.remoteAddress;
  }

  cleanup() {
    const now = Date.now();
    for (const [key, value] of this.store) {
      if (now - value.startTime >= this.windowMs) {
        this.store.delete(key);
      }
    }
  }

  middleware(options = {}) {
    const {
      windowMs = this.windowMs,
      maxRequests = this.maxRequests,
      keyGenerator = this.keyGenerator,
      skipCondition = null,
      handler = null,
      skipFailedRequests = this.skipFailedRequests
    } = options;

    return (req, res, next) => {
      // Check skip condition
      if (skipCondition && skipCondition(req)) {
        return next();
      }

      const key = keyGenerator(req);
      const now = Date.now();

      if (!this.store.has(key)) {
        this.store.set(key, {
          count: 0,
          startTime: now,
          firstRequestTime: now
        });
      }

      const record = this.store.get(key);

      // Reset if window expired
      if (now - record.startTime >= windowMs) {
        record.count = 0;
        record.startTime = now;
      }

      record.count++;

      // Add rate limit headers
      const remaining = Math.max(0, maxRequests - record.count);
      const resetTime = Math.ceil((record.startTime + windowMs - now) / 1000);

      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', remaining);
      res.setHeader('X-RateLimit-Reset', resetTime);

      // Check if over limit
      if (record.count > maxRequests) {
        res.setHeader('Retry-After', resetTime);
        
        if (handler) {
          return handler(req, res, next);
        }

        if (this.onLimitReached) {
          this.onLimitReached(req, key);
        }

        return res.status(429).json({
          error: 'Too many requests',
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: resetTime,
          limit: maxRequests,
          windowMs
        });
      }

      // Slow down if approaching limit
      if (this.slowDown.enabled && remaining < this.slowDown.threshold) {
        const delay = this.slowDown.delayMs || 100;
        return setTimeout(next, delay);
      }

      // Track failed requests
      if (skipFailedRequests) {
        const originalEnd = res.end;
        res.end = (...args) => {
          if (res.statusCode < 400) {
            // Don't count failed requests
          } else {
            record.count--;
          }
          return originalEnd.apply(res, args);
        };
      }

      next();
    };
  }

  // Create rate limit tiers
  createTier(tier, config) {
    return this.middleware({
      windowMs: config.windowMs,
      maxRequests: config.maxRequests,
      keyGenerator: (req) => `${tier}:${this.defaultKeyGenerator(req)}`
    });
  }
}

// ============================================
// Request Cache
// ============================================
class RequestCache {
  constructor(options = {}) {
    this.cache = new LRUCache({
      max: options.maxSize || 500,
      ttl: options.ttl || 60000, // 1 minute default
      ...options
    });
    
    this.enabled = options.enabled !== false;
    this.keyGenerator = options.keyGenerator || this.defaultKeyGenerator;
    this.shouldCache = options.shouldCache || this.defaultShouldCache;
    this.ttlByPath = options.ttlByPath || {};
  }

  defaultKeyGenerator(req) {
    return crypto
      .createHash('md5')
      .update(`${req.method}:${req.originalUrl}:${JSON.stringify(req.body)}`)
      .digest('hex');
  }

  defaultShouldCache(req) {
    // Only cache GET requests
    return req.method === 'GET';
  }

  middleware() {
    return (req, res, next) => {
      if (!this.enabled || !this.shouldCache(req)) {
        return next();
      }

      const key = this.keyGenerator(req);
      const cached = this.cache.get(key);

      if (cached) {
        res.setHeader('X-Cache', 'HIT');
        res.setHeader('X-Cache-Key', key);
        return res.json(cached);
      }

      // Intercept response
      const originalJson = res.json;
      res.json = (body) => {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const ttl = this.ttlByPath[req.path] || undefined;
          this.cache.set(key, body, { ttl });
          res.setHeader('X-Cache', 'MISS');
        }
        return originalJson.call(res, body);
      };

      next();
    };
  }

  invalidate(pattern) {
    if (pattern === '*') {
      this.cache.clear();
      return;
    }

    // Clear matching keys
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// ============================================
// API Versioning
// ============================================
class ApiVersioning {
  constructor(options = {}) {
    this.currentVersion = options.currentVersion || 'v1';
    this.supportedVersions = options.supportedVersions || ['v1'];
    this.deprecatedVersions = options.deprecatedVersions || [];
    this.sunsetDates = options.sunsetDates || {};
    this.headerName = options.headerName || 'X-API-Version';
    this.versionPrefix = options.versionPrefix !== false;
  }

  middleware() {
    return (req, res, next) => {
      // Get version from header or path
      let version = req.headers[this.headerName.toLowerCase()];
      
      if (!version && this.versionPrefix) {
        const match = req.path.match(/^\/(v\d+)\//);
        if (match) {
          version = match[1];
        }
      }

      // Default to current version
      version = version || this.currentVersion;

      // Check if version is supported
      if (!this.supportedVersions.includes(version)) {
        return res.status(400).json({
          error: 'Unsupported API version',
          code: 'INVALID_API_VERSION',
          supportedVersions: this.supportedVersions,
          currentVersion: this.currentVersion
        });
      }

      // Add deprecation warning
      if (this.deprecatedVersions.includes(version)) {
        const sunsetDate = this.sunsetDates[version];
        res.setHeader('Deprecation', 'true');
        res.setHeader('Sunset', sunsetDate || 'TBD');
        res.setHeader('Link', `<${req.protocol}://${req.get('host')}/api/${this.currentVersion}/>; rel="successor-version"`);
      }

      req.apiVersion = version;
      res.setHeader(this.headerName, version);
      next();
    };
  }

  // Route wrapper for versioned routes
  version(version, middleware) {
    return (req, res, next) => {
      if (req.apiVersion === version) {
        return middleware(req, res, next);
      }
      next();
    };
  }
}

// ============================================
// Request Transformer
// ============================================
class RequestTransformer {
  constructor(options = {}) {
    this.transformers = [];
  }

  addTransformer(transformer) {
    this.transformers.push(transformer);
    return this;
  }

  middleware() {
    return (req, res, next) => {
      for (const transformer of this.transformers) {
        try {
          transformer(req);
        } catch (error) {
          console.error('Request transformer error:', error);
        }
      }
      next();
    };
  }

  // Common transformers
  static addHeaders(headers) {
    return (req) => {
      Object.assign(req.headers, headers);
    };
  }

  static removeHeaders(headers) {
    return (req) => {
      headers.forEach(h => delete req.headers[h.toLowerCase()]);
    };
  }

  static addRequestId() {
    return (req) => {
      req.headers['x-request-id'] = req.headers['x-request-id'] || 
        crypto.randomUUID();
    };
  }

  static normalizePaths() {
    return (req) => {
      req.url = req.url.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
    };
  }
}

// ============================================
// Response Transformer
// ============================================
class ResponseTransformer {
  constructor(options = {}) {
    this.transformers = [];
    this.wrapResponse = options.wrapResponse || false;
    this.includeMetadata = options.includeMetadata !== false;
  }

  addTransformer(transformer) {
    this.transformers.push(transformer);
    return this;
  }

  middleware() {
    return (req, res, next) => {
      const originalJson = res.json;
      const originalSend = res.send;

      res.json = (body) => {
        let transformed = body;

        // Apply transformers
        for (const transformer of this.transformers) {
          try {
            transformed = transformer(transformed, req, res);
          } catch (error) {
            console.error('Response transformer error:', error);
          }
        }

        // Wrap response if enabled
        if (this.wrapResponse && transformed) {
          transformed = this.wrap(transformed, req);
        }

        return originalJson.call(res, transformed);
      };

      next();
    };
  }

  wrap(data, req) {
    return {
      success: true,
      data,
      metadata: this.includeMetadata ? {
        timestamp: new Date().toISOString(),
        requestId: req.headers['x-request-id'],
        apiVersion: req.apiVersion
      } : undefined
    };
  }

  // Common transformers
  static addHeaders(headers) {
    return (req, res) => {
      Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
    };
  }

  static removeFields(fields) {
    return (data) => {
      if (typeof data !== 'object' || data === null) return data;
      
      const result = { ...data };
      fields.forEach(f => delete result[f]);
      return result;
    };
  }
}

// ============================================
// Security Headers Middleware
// ============================================
class SecurityHeaders {
  constructor(options = {}) {
    this.options = {
      contentSecurityPolicy: options.contentSecurityPolicy !== false,
      crossOriginEmbedderPolicy: options.crossOriginEmbedderPolicy !== false,
      crossOriginOpenerPolicy: options.crossOriginOpenerPolicy !== false,
      crossOriginResourcePolicy: options.crossOriginResourcePolicy !== false,
      dnsPrefetchControl: options.dnsPrefetchControl !== false,
      frameguard: options.frameguard || { action: 'deny' },
      hidePoweredBy: options.hidePoweredBy !== false,
      hsts: options.hsts || { maxAge: 31536000, includeSubDomains: true },
      ieNoOpen: options.ieNoOpen !== false,
      noSniff: options.noSniff !== false,
      originAgentCluster: options.originAgentCluster !== false,
      permittedCrossDomainPolicies: options.permittedCrossDomainPolicies || true,
      referrerPolicy: options.referrerPolicy || { policy: 'strict-origin-when-cross-origin' },
      xssFilter: options.xssFilter !== false,
      ...options
    };
  }

  middleware() {
    return (req, res, next) => {
      // Remove X-Powered-By header
      if (this.options.hidePoweredBy) {
        res.removeHeader('X-Powered-By');
      }

      // X-Content-Type-Options
      if (this.options.noSniff) {
        res.setHeader('X-Content-Type-Options', 'nosniff');
      }

      // X-Frame-Options
      if (this.options.frameguard) {
        res.setHeader('X-Frame-Options', this.options.frameguard.action.toUpperCase());
      }

      // Strict-Transport-Security
      if (this.options.hsts) {
        let hstsValue = `max-age=${this.options.hsts.maxAge}`;
        if (this.options.hsts.includeSubDomains) {
          hstsValue += '; includeSubDomains';
        }
        if (this.options.hsts.preload) {
          hstsValue += '; preload';
        }
        res.setHeader('Strict-Transport-Security', hstsValue);
      }

      // X-XSS-Protection
      if (this.options.xssFilter) {
        res.setHeader('X-XSS-Protection', '0');
      }

      // Referrer-Policy
      if (this.options.referrerPolicy) {
        res.setHeader('Referrer-Policy', this.options.referrerPolicy.policy);
      }

      // X-DNS-Prefetch-Control
      if (this.options.dnsPrefetchControl) {
        res.setHeader('X-DNS-Prefetch-Control', 'off');
      }

      // X-Permitted-Cross-Domain-Policies
      if (this.options.permittedCrossDomainPolicies) {
        res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
      }

      // Cross-Origin headers
      if (this.options.crossOriginEmbedderPolicy) {
        res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
      }

      if (this.options.crossOriginOpenerPolicy) {
        res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
      }

      if (this.options.crossOriginResourcePolicy) {
        res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      }

      // Origin-Agent-Cluster
      if (this.options.originAgentCluster) {
        res.setHeader('Origin-Agent-Cluster', '?1');
      }

      next();
    };
  }
}

// ============================================
// API Gateway Main Class
// ============================================
class APIGateway {
  constructor(options = {}) {
    this.circuitBreaker = new CircuitBreaker(options.circuitBreaker);
    this.rateLimiter = new EnhancedRateLimiter(options.rateLimiter);
    this.cache = new RequestCache(options.cache);
    this.versioning = new ApiVersioning(options.versioning);
    this.requestTransformer = new RequestTransformer(options.requestTransformer);
    this.responseTransformer = new ResponseTransformer(options.responseTransformer);
    this.securityHeaders = new SecurityHeaders(options.securityHeaders);
    
    this.options = options;
  }

  // Full gateway middleware stack
  middleware() {
    const stack = [
      // Security headers
      this.securityHeaders.middleware(),
      
      // Request ID
      RequestTransformer.addRequestId(),
      
      // API Versioning
      this.versioning.middleware(),
      
      // Circuit Breaker
      this.circuitBreaker.middleware(),
      
      // Rate Limiting
      this.rateLimiter.middleware(),
      
      // Request transformation
      this.requestTransformer.middleware(),
      
      // Response transformation
      this.responseTransformer.middleware(),
      
      // Caching
      this.cache.middleware()
    ];

    return stack;
  }

  // Individual middleware access
  getCircuitBreaker() {
    return this.circuitBreaker;
  }

  getRateLimiter() {
    return this.rateLimiter;
  }

  getCache() {
    return this.cache;
  }

  getVersioning() {
    return this.versioning;
  }

  getRequestTransformer() {
    return this.requestTransformer;
  }

  getResponseTransformer() {
    return this.responseTransformer;
  }

  getSecurityHeaders() {
    return this.securityHeaders;
  }
}

// ============================================
// Exports
// ============================================
module.exports = {
  APIGateway,
  CircuitBreaker,
  EnhancedRateLimiter,
  RequestCache,
  ApiVersioning,
  RequestTransformer,
  ResponseTransformer,
  SecurityHeaders
};
