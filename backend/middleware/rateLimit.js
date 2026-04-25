const rateLimitService = require('../services/rateLimitService');

/**
 * User-specific rate limiting middleware
 * Applies tiered rate limits based on user subscription
 */
function userRateLimit(options = {}) {
  return async (req, res, next) => {
    try {
      // Skip rate limiting for health check and static routes
      if (req.path === '/api/health' || req.path.startsWith('/static')) {
        return next();
      }

      // Get user ID from authenticated request
      const userId = req.user?.id;
      
      if (!userId) {
        // For unauthenticated requests, apply basic IP-based rate limiting
        return basicRateLimit(req, res, next);
      }

      const endpoint = req.path;
      const method = req.method;

      // Check rate limits
      const result = await rateLimitService.checkRateLimit(userId, endpoint, method);

      if (!result.allowed) {
        // Log the violation
        await rateLimitService.logRateLimitViolation(
          userId, 
          endpoint, 
          method, 
          { type: result.window, limit: result.limit }, 
          result
        );

        // Set rate limit headers
        res.set({
          'X-RateLimit-Limit': result.limit,
          'X-RateLimit-Remaining': 0,
          'X-RateLimit-Reset': new Date(result.resetTime).getTime() / 1000,
          'X-RateLimit-RetryAfter': result.retryAfter,
          'X-RateLimit-Window': result.window
        });

        return res.status(429).json({
          error: 'Rate limit exceeded',
          message: `Too many requests. Limit: ${result.limit} per ${result.window}.`,
          retryAfter: result.retryAfter,
          window: result.window,
          limit: result.limit,
          resetTime: result.resetTime
        });
      }

      // Log successful API usage
      res.on('finish', async () => {
        await rateLimitService.logApiUsage(
          userId, 
          endpoint, 
          method, 
          res.statusCode, 
          req.ip, 
          req.get('User-Agent')
        );
      });

      // Set rate limit headers for successful requests
      if (result.limits && result.limits.length > 0) {
        const minuteLimit = result.limits.find(l => l.window === 'minute');
        if (minuteLimit) {
          res.set({
            'X-RateLimit-Limit': minuteLimit.limit,
            'X-RateLimit-Remaining': minuteLimit.remaining,
            'X-RateLimit-Window': 'minute'
          });
        }
      }

      // Attach rate limit info to request for use in other middleware
      req.rateLimit = result;
      
      next();
    } catch (error) {
      console.error('Rate limiting error:', error);
      // Fail open - allow request if rate limiting fails
      next();
    }
  };
}

/**
 * Basic IP-based rate limiting for unauthenticated requests
 */
function basicRateLimit(req, res, next) {
  const rateLimit = require('express-rate-limit');
  
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => req.ip,
    skip: (req) => {
      // Skip for health checks
      return req.path === '/api/health';
    }
  });

  return limiter(req, res, next);
}

/**
 * Rate limiting middleware for specific endpoints with custom limits
 */
function customRateLimit(endpointLimits) {
  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return basicRateLimit(req, res, next);
      }

      const endpoint = req.path;
      const method = req.method;
      
      // Check if this endpoint has custom limits
      const customLimit = endpointLimits[endpoint] || endpointLimits[`${endpoint}:${method}`];
      
      if (customLimit) {
        // Apply custom rate limit logic here
        const result = await rateLimitService.checkRateLimit(userId, endpoint, method);
        
        if (!result.allowed) {
          return res.status(429).json({
            error: 'Rate limit exceeded',
            message: customLimit.message || 'Too many requests for this endpoint.',
            customLimit: true,
            ...result
          });
        }
      }
      
      // Apply standard rate limiting
      return userRateLimit()(req, res, next);
    } catch (error) {
      console.error('Custom rate limiting error:', error);
      next();
    }
  };
}

/**
 * Rate limiting middleware for premium features
 */
function premiumRateLimit(options = {}) {
  const defaultLimits = {
    minute: 10,
    hour: 200,
    day: 1000,
    month: 10000
  };
  
  const limits = { ...defaultLimits, ...options };

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'This feature requires authentication'
        });
      }

      // Check if user has premium tier
      const userTier = await rateLimitService.getUserTier(userId);
      
      if (!userTier || userTier.name === 'free') {
        return res.status(403).json({
          error: 'Premium feature',
          message: 'This feature requires a premium subscription'
        });
      }

      const endpoint = req.path;
      const method = req.method;

      // Apply premium rate limits
      const result = await rateLimitService.checkRateLimit(userId, endpoint, method);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Premium rate limit exceeded',
          message: 'Premium rate limit exceeded. Please upgrade your plan for higher limits.',
          isPremium: true,
          ...result
        });
      }

      req.rateLimit = result;
      next();
    } catch (error) {
      console.error('Premium rate limiting error:', error);
      next();
    }
  };
}

/**
 * Rate limiting middleware for admin endpoints
 */
function adminRateLimit(options = {}) {
  const defaultLimits = {
    minute: 30,
    hour: 500,
    day: 5000,
    month: 50000
  };
  
  const limits = { ...defaultLimits, ...options };

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      const userRole = req.user?.role;
      
      if (!userId || userRole !== 'admin') {
        return res.status(403).json({
          error: 'Admin access required',
          message: 'This endpoint requires admin privileges'
        });
      }

      const endpoint = req.path;
      const method = req.method;

      // Apply admin rate limits (more lenient)
      const result = await rateLimitService.checkRateLimit(userId, endpoint, method);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Admin rate limit exceeded',
          message: 'Admin rate limit exceeded.',
          isAdmin: true,
          ...result
        });
      }

      req.rateLimit = result;
      next();
    } catch (error) {
      console.error('Admin rate limiting error:', error);
      next();
    }
  };
}

/**
 * Rate limiting middleware for webhook endpoints
 */
function webhookRateLimit(options = {}) {
  const defaultLimits = {
    minute: 60,
    hour: 1000,
    day: 10000
  };
  
  const limits = { ...defaultLimits, ...options };

  return async (req, res, next) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({
          error: 'Authentication required',
          message: 'Webhook access requires authentication'
        });
      }

      // Check if user has webhook access
      const userTier = await rateLimitService.getUserTier(userId);
      
      if (!userTier || !userTier.features?.includes('webhooks')) {
        return res.status(403).json({
          error: 'Webhook access required',
          message: 'Webhook access requires a premium or enterprise subscription'
        });
      }

      const endpoint = req.path;
      const method = req.method;

      // Apply webhook rate limits
      const result = await rateLimitService.checkRateLimit(userId, endpoint, method);

      if (!result.allowed) {
        return res.status(429).json({
          error: 'Webhook rate limit exceeded',
          message: 'Webhook rate limit exceeded.',
          isWebhook: true,
          ...result
        });
      }

      req.rateLimit = result;
      next();
    } catch (error) {
      console.error('Webhook rate limiting error:', error);
      next();
    }
  };
}

module.exports = {
  userRateLimit,
  customRateLimit,
  premiumRateLimit,
  adminRateLimit,
  webhookRateLimit,
  basicRateLimit
};
