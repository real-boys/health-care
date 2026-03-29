const express = require('express');
const { body, validationResult, query } = require('express-validator');
const rateLimitService = require('../services/rateLimitService');
const tierManagementService = require('../services/tierManagementService');
const { authenticateToken } = require('../middleware/auth');
const { adminRateLimit } = require('../middleware/rateLimit');

const router = express.Router();

// Get current user's quota information
router.get('/quota', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const quotaInfo = await rateLimitService.getUserQuotaInfo(userId);
    const subscription = await tierManagementService.getUserSubscription(userId);

    res.json({
      success: true,
      data: {
        quotas: quotaInfo,
        subscription: subscription,
        tier: subscription?.tier_name || 'free'
      }
    });
  } catch (error) {
    console.error('Error getting quota info:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve quota information'
    });
  }
});

// Get current API usage statistics
router.get('/usage', authenticateToken, [
  query('period').optional().isIn(['minute', 'hour', 'day', 'month']).withMessage('Invalid period'),
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('endpoint').optional().isString().withMessage('Invalid endpoint'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { period = 'day', start_date, end_date, endpoint, limit = 100 } = req.query;

    // Build query based on filters
    let query = `
      SELECT 
        endpoint,
        method,
        window_type,
        SUM(request_count) as total_requests,
        AVG(request_count) as avg_requests,
        MAX(request_count) as max_requests,
        MIN(window_start) as first_request,
        MAX(window_start) as last_request
      FROM api_usage_logs
      WHERE user_id = ?
    `;
    
    const params = [userId];

    if (period) {
      query += ` AND window_type = ?`;
      params.push(period);
    }

    if (start_date) {
      query += ` AND window_start >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND window_start <= ?`;
      params.push(end_date);
    }

    if (endpoint) {
      query += ` AND endpoint LIKE ?`;
      params.push(`%${endpoint}%`);
    }

    query += `
      GROUP BY endpoint, method, window_type
      ORDER BY total_requests DESC
      LIMIT ?
    `;
    params.push(limit);

    const db = await require('../database/connection').getDatabase();
    const usageStats = await db.all(query, params);

    res.json({
      success: true,
      data: {
        usage: usageStats,
        filters: { period, start_date, end_date, endpoint, limit }
      }
    });
  } catch (error) {
    console.error('Error getting usage stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve usage statistics'
    });
  }
});

// Get rate limit violations for current user
router.get('/violations', authenticateToken, [
  query('start_date').optional().isISO8601().withMessage('Invalid start date'),
  query('end_date').optional().isISO8601().withMessage('Invalid end date'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { start_date, end_date, limit = 50 } = req.query;

    let query = `
      SELECT 
        endpoint,
        method,
        window_type,
        limit_value,
        actual_count,
        ip_address,
        user_agent,
        blocked_until,
        created_at
      FROM rate_limit_violations
      WHERE user_id = ?
    `;
    
    const params = [userId];

    if (start_date) {
      query += ` AND created_at >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND created_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    const db = await require('../database/connection').getDatabase();
    const violations = await db.all(query, params);

    res.json({
      success: true,
      data: {
        violations,
        total: violations.length
      }
    });
  } catch (error) {
    console.error('Error getting violations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve rate limit violations'
    });
  }
});

// Get available tiers
router.get('/tiers', async (req, res) => {
  try {
    const tiers = await tierManagementService.getAllTiers();

    res.json({
      success: true,
      data: {
        tiers: tiers.map(tier => ({
          ...tier,
          features: JSON.parse(tier.features || '[]')
        }))
      }
    });
  } catch (error) {
    console.error('Error getting tiers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve available tiers'
    });
  }
});

// Subscribe to a tier
router.post('/subscribe', authenticateToken, [
  body('tier_id').isInt({ min: 1 }).withMessage('Valid tier ID is required'),
  body('payment_method').optional().isString().withMessage('Payment method must be a string'),
  body('auto_renew').optional().isBoolean().withMessage('Auto renew must be boolean'),
  body('subscription_id').optional().isString().withMessage('Subscription ID must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { tier_id, payment_method, auto_renew, subscription_id } = req.body;

    // Validate tier exists
    const tier = await tierManagementService.getTierById(tier_id);
    if (!tier) {
      return res.status(404).json({
        success: false,
        error: 'Tier not found',
        message: 'The specified tier does not exist'
      });
    }

    const subscription = await tierManagementService.subscribeUser(userId, tier_id, {
      payment_method,
      auto_renew,
      subscription_id
    });

    res.status(201).json({
      success: true,
      message: 'Subscription created successfully',
      data: {
        subscription,
        tier: {
          id: tier.id,
          name: tier.name,
          display_name: tier.display_name,
          features: JSON.parse(tier.features || '[]'),
          limits: {
            monthly: tier.monthly_api_calls,
            daily: tier.daily_api_calls,
            hourly: tier.hourly_api_calls,
            minute: tier.minute_api_calls
          }
        }
      }
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create subscription'
    });
  }
});

// Upgrade subscription
router.post('/upgrade', authenticateToken, [
  body('tier_id').isInt({ min: 1 }).withMessage('Valid tier ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { tier_id } = req.body;

    const result = await tierManagementService.upgradeUser(userId, tier_id);

    res.json({
      success: true,
      message: result.message,
      data: {
        oldTier: result.oldTier,
        newTier: result.newTier
      }
    });
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error.message || 'Failed to upgrade subscription'
    });
  }
});

// Downgrade subscription
router.post('/downgrade', authenticateToken, [
  body('tier_id').isInt({ min: 1 }).withMessage('Valid tier ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { tier_id } = req.body;

    const result = await tierManagementService.downgradeUser(userId, tier_id);

    res.json({
      success: true,
      message: result.message,
      data: {
        oldTier: result.oldTier,
        newTier: result.newTier
      }
    });
  } catch (error) {
    console.error('Error downgrading subscription:', error);
    res.status(400).json({
      success: false,
      error: 'Bad request',
      message: error.message || 'Failed to downgrade subscription'
    });
  }
});

// Cancel subscription
router.post('/cancel', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await tierManagementService.cancelUserSubscription(userId);

    res.json({
      success: true,
      message: result.message
    });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to cancel subscription'
    });
  }
});

// Get subscription history
router.get('/subscription/history', authenticateToken, [
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const userId = req.user.id;
    const { limit = 20 } = req.query;

    const history = await tierManagementService.getSubscriptionHistory(userId, limit);

    res.json({
      success: true,
      data: {
        history,
        total: history.length
      }
    });
  } catch (error) {
    console.error('Error getting subscription history:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve subscription history'
    });
  }
});

// Reset user quota (admin only)
router.post('/admin/reset-quota/:userId', authenticateToken, adminRateLimit(), [
  body('quota_type').isIn(['minute', 'hour', 'day', 'month']).withMessage('Invalid quota type')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'This endpoint requires admin privileges'
      });
    }

    const { userId } = req.params;
    const { quota_type } = req.body;

    await rateLimitService.resetUserQuota(parseInt(userId), quota_type);

    res.json({
      success: true,
      message: `User ${userId} ${quota_type} quota reset successfully`
    });
  } catch (error) {
    console.error('Error resetting user quota:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to reset user quota'
    });
  }
});

// Create rate limit override (admin only)
router.post('/admin/override/:userId', authenticateToken, adminRateLimit(), [
  body('endpoint').optional().isString().withMessage('Endpoint must be a string'),
  body('multiplier').optional().isFloat({ min: 0.1, max: 10 }).withMessage('Multiplier must be between 0.1 and 10'),
  body('custom_limits').optional().isJSON().withMessage('Custom limits must be valid JSON'),
  body('expires_at').optional().isISO8601().withMessage('Expiry date must be valid ISO8601')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'This endpoint requires admin privileges'
      });
    }

    const { userId } = req.params;
    const { endpoint, multiplier, custom_limits, expires_at } = req.body;

    const db = await require('../database/connection').getDatabase();
    const query = `
      INSERT INTO rate_limit_overrides 
      (user_id, endpoint, multiplier, custom_limits, expires_at, created_by)
      VALUES (?, ?, ?, ?, ?, ?)
    `;

    await db.run(query, [
      parseInt(userId),
      endpoint || null,
      multiplier || 1.0,
      custom_limits || null,
      expires_at || null,
      req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Rate limit override created successfully',
      data: {
        user_id: parseInt(userId),
        endpoint,
        multiplier,
        custom_limits,
        expires_at
      }
    });
  } catch (error) {
    console.error('Error creating rate limit override:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to create rate limit override'
    });
  }
});

// Get system-wide rate limiting stats (admin only)
router.get('/admin/stats', authenticateToken, adminRateLimit(), async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required',
        message: 'This endpoint requires admin privileges'
      });
    }

    const db = await require('../database/connection').getDatabase();

    // Get overall usage stats
    const usageStats = await db.get(`
      SELECT 
        COUNT(DISTINCT user_id) as active_users,
        SUM(request_count) as total_requests,
        AVG(request_count) as avg_requests_per_user,
        MAX(request_count) as max_requests
      FROM api_usage_logs
      WHERE window_start >= datetime('now', '-24 hours')
    `);

    // Get tier distribution
    const tierDistribution = await db.all(`
      SELECT 
        ut.name as tier_name,
        ut.display_name,
        COUNT(us.user_id) as user_count,
        SUM(ut.price) as monthly_revenue
      FROM user_tiers ut
      LEFT JOIN user_subscriptions us ON ut.id = us.tier_id 
        AND us.is_active = 1 
        AND (us.end_date IS NULL OR us.end_date > datetime('now'))
      GROUP BY ut.id
      ORDER BY ut.price ASC
    `);

    // Get recent violations
    const recentViolations = await db.all(`
      SELECT 
        COUNT(*) as total_violations,
        COUNT(DISTINCT user_id) as unique_users_affected,
        window_type,
        AVG(actual_count - limit_value) as avg_excess
      FROM rate_limit_violations
      WHERE created_at >= datetime('now', '-24 hours')
      GROUP BY window_type
    `);

    res.json({
      success: true,
      data: {
        usage_stats: usageStats,
        tier_distribution: tierDistribution,
        recent_violations: recentViolations,
        generated_at: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error getting admin stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: 'Failed to retrieve admin statistics'
    });
  }
});

module.exports = router;
