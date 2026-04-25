const request = require('supertest');
const { app } = require('../server');
const { getDatabase } = require('../database/connection');
const rateLimitService = require('../services/rateLimitService');
const tierManagementService = require('../services/tierManagementService');

describe('Rate Limiting API', () => {
  let db;
  let testUser;
  let authToken;
  let testTier;

  beforeAll(async () => {
    // Initialize test database
    db = await getDatabase();
    
    // Create test tier
    testTier = await tierManagementService.createTier({
      name: 'test',
      display_name: 'Test Tier',
      description: 'Tier for testing',
      monthly_api_calls: 100,
      daily_api_calls: 50,
      hourly_api_calls: 10,
      minute_api_calls: 2,
      priority_support: false,
      concurrent_requests: 1,
      features: ['test_feature'],
      price: 0.00
    });

    // Create test user
    const userResult = await db.run(
      `INSERT INTO users (email, password, role, first_name, last_name) 
       VALUES (?, ?, ?, ?, ?)`,
      ['test@example.com', 'hashedpassword', 'patient', 'Test', 'User']
    );
    testUser = { id: userResult.lastID, email: 'test@example.com' };

    // Subscribe user to test tier
    await tierManagementService.subscribeUser(testUser.id, testTier.id);

    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.data.accessToken;
  });

  afterAll(async () => {
    // Clean up test data
    await db.run('DELETE FROM user_subscriptions WHERE user_id = ?', [testUser.id]);
    await db.run('DELETE FROM rate_limit_overrides WHERE user_id = ?', [testUser.id]);
    await db.run('DELETE FROM api_usage_logs WHERE user_id = ?', [testUser.id]);
    await db.run('DELETE FROM rate_limit_violations WHERE user_id = ?', [testUser.id]);
    await db.run('DELETE FROM user_quotas WHERE user_id = ?', [testUser.id]);
    await db.run('DELETE FROM users WHERE id = ?', [testUser.id]);
    await db.run('DELETE FROM user_tiers WHERE name = ?', ['test']);
  });

  describe('GET /api/rate-limiting/quota', () => {
    it('should return user quota information', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/quota')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('quotas');
      expect(response.body.data).toHaveProperty('subscription');
      expect(response.body.data).toHaveProperty('tier');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/rate-limiting/quota')
        .expect(401);
    });
  });

  describe('GET /api/rate-limiting/usage', () => {
    it('should return usage statistics', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/usage')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('usage');
      expect(response.body.data).toHaveProperty('filters');
    });

    it('should validate query parameters', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/usage?period=invalid')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/rate-limiting/tiers', () => {
    it('should return available tiers', async () => {
      const response = await request(app)
        .get('/api/rate-limiting/tiers')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('tiers');
      expect(Array.isArray(response.body.data.tiers)).toBe(true);
    });
  });

  describe('POST /api/rate-limiting/subscribe', () => {
    it('should create subscription', async () => {
      // First cancel existing subscription
      await tierManagementService.cancelUserSubscription(testUser.id);

      const response = await request(app)
        .post('/api/rate-limiting/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tier_id: testTier.id,
          auto_renew: false
        })
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('subscription');
      expect(response.body.data).toHaveProperty('tier');
    });

    it('should validate subscription data', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tier_id: 'invalid'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Validation failed');
    });

    it('should require valid tier', async () => {
      const response = await request(app)
        .post('/api/rate-limiting/subscribe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          tier_id: 99999
        })
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Tier not found');
    });
  });

  describe('Rate Limiting Behavior', () => {
    it('should allow requests within limits', async () => {
      // Make requests within the minute limit (2 for test tier)
      const promises = [];
      for (let i = 0; i < 2; i++) {
        promises.push(
          request(app)
            .get('/api/health')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });
    });

    it('should rate limit requests exceeding limits', async () => {
      // Make requests exceeding the minute limit (2 for test tier)
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          request(app)
            .get('/api/health')
            .set('Authorization', `Bearer ${authToken}`)
        );
      }

      const responses = await Promise.all(promises);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      rateLimitedResponses.forEach(response => {
        expect(response.body.error).toBe('Rate limit exceeded');
        expect(response.headers['x-ratelimit-limit']).toBeDefined();
        expect(response.headers['x-ratelimit-remaining']).toBeDefined();
        expect(response.headers['x-ratelimit-retryafter']).toBeDefined();
      });
    });

    it('should include rate limit headers', async () => {
      const response = await request(app)
        .get('/api/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.headers['x-ratelimit-limit']).toBeDefined();
      expect(response.headers['x-ratelimit-remaining']).toBeDefined();
      expect(response.headers['x-ratelimit-window']).toBeDefined();
    });
  });

  describe('Admin Endpoints', () => {
    let adminUser;
    let adminToken;

    beforeAll(async () => {
      // Create admin user
      const adminResult = await db.run(
        `INSERT INTO users (email, password, role, first_name, last_name) 
         VALUES (?, ?, ?, ?, ?)`,
        ['admin@example.com', 'hashedpassword', 'admin', 'Admin', 'User']
      );
      adminUser = { id: adminResult.lastID };

      // Get admin token
      const adminLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'admin@example.com',
          password: 'password123'
        });
      
      adminToken = adminLoginResponse.body.data.accessToken;
    });

    afterAll(async () => {
      // Clean up admin user
      await db.run('DELETE FROM users WHERE id = ?', [adminUser.id]);
    });

    describe('POST /api/rate-limiting/admin/reset-quota/:userId', () => {
      it('should reset user quota', async () => {
        const response = await request(app)
          .post(`/api/rate-limiting/admin/reset-quota/${testUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            quota_type: 'minute'
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('quota reset successfully');
      });

      it('should require admin privileges', async () => {
        const response = await request(app)
          .post(`/api/rate-limiting/admin/reset-quota/${testUser.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            quota_type: 'minute'
          })
          .expect(403);

        expect(response.body.error).toBe('Admin access required');
      });

      it('should validate quota type', async () => {
        const response = await request(app)
          .post(`/api/rate-limiting/admin/reset-quota/${testUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            quota_type: 'invalid'
          })
          .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.error).toBe('Validation failed');
      });
    });

    describe('POST /api/rate-limiting/admin/override/:userId', () => {
      it('should create rate limit override', async () => {
        const response = await request(app)
          .post(`/api/rate-limiting/admin/override/${testUser.id}`)
          .set('Authorization', `Bearer ${adminToken}`)
          .send({
            multiplier: 2.0,
            endpoint: '/api/test'
          })
          .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toBe('Rate limit override created successfully');
        expect(response.body.data.multiplier).toBe(2.0);
      });

      it('should require admin privileges', async () => {
        const response = await request(app)
          .post(`/api/rate-limiting/admin/override/${testUser.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            multiplier: 2.0
          })
          .expect(403);

        expect(response.body.error).toBe('Admin access required');
      });
    });

    describe('GET /api/rate-limiting/admin/stats', () => {
      it('should return admin statistics', async () => {
        const response = await request(app)
          .get('/api/rate-limiting/admin/stats')
          .set('Authorization', `Bearer ${adminToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('usage_stats');
        expect(response.body.data).toHaveProperty('tier_distribution');
        expect(response.body.data).toHaveProperty('recent_violations');
        expect(response.body.data).toHaveProperty('generated_at');
      });

      it('should require admin privileges', async () => {
        const response = await request(app)
          .get('/api/rate-limiting/admin/stats')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(403);

        expect(response.body.error).toBe('Admin access required');
      });
    });
  });

  describe('Tier Management', () => {
    describe('POST /api/rate-limiting/upgrade', () => {
      it('should upgrade user tier', async () => {
        // Create premium tier
        const premiumTier = await tierManagementService.createTier({
          name: 'premium_test',
          display_name: 'Premium Test',
          description: 'Premium tier for testing',
          monthly_api_calls: 1000,
          daily_api_calls: 500,
          hourly_api_calls: 100,
          minute_api_calls: 20,
          priority_support: true,
          concurrent_requests: 5,
          features: ['premium_feature'],
          price: 29.99
        });

        const response = await request(app)
          .post('/api/rate-limiting/upgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            tier_id: premiumTier.id
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('upgraded successfully');
        expect(response.body.data.newTier).toBe('premium_test');

        // Clean up
        await db.run('DELETE FROM user_tiers WHERE id = ?', [premiumTier.id]);
      });
    });

    describe('POST /api/rate-limiting/downgrade', () => {
      it('should downgrade user tier', async () => {
        // Create basic tier
        const basicTier = await tierManagementService.createTier({
          name: 'basic_test',
          display_name: 'Basic Test',
          description: 'Basic tier for testing',
          monthly_api_calls: 500,
          daily_api_calls: 250,
          hourly_api_calls: 50,
          minute_api_calls: 10,
          priority_support: false,
          concurrent_requests: 2,
          features: ['basic_feature'],
          price: 9.99
        });

        const response = await request(app)
          .post('/api/rate-limiting/downgrade')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            tier_id: basicTier.id
          })
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('downgraded successfully');
        expect(response.body.data.newTier).toBe('basic_test');

        // Clean up
        await db.run('DELETE FROM user_tiers WHERE id = ?', [basicTier.id]);
      });
    });

    describe('POST /api/rate-limiting/cancel', () => {
      it('should cancel subscription', async () => {
        const response = await request(app)
          .post('/api/rate-limiting/cancel')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.message).toContain('cancelled successfully');
      });
    });

    describe('GET /api/rate-limiting/subscription/history', () => {
      it('should return subscription history', async () => {
        const response = await request(app)
          .get('/api/rate-limiting/subscription/history')
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.data).toHaveProperty('history');
        expect(response.body.data).toHaveProperty('total');
        expect(Array.isArray(response.body.data.history)).toBe(true);
      });
    });
  });
});

describe('Rate Limiting Service', () => {
  let db;
  let testUser;
  let testTier;

  beforeAll(async () => {
    db = await getDatabase();
    
    // Create test user and tier for service tests
    const userResult = await db.run(
      `INSERT INTO users (email, password, role, first_name, last_name) 
       VALUES (?, ?, ?, ?, ?)`,
      ['service@example.com', 'hashedpassword', 'patient', 'Service', 'Test']
    );
    testUser = { id: userResult.lastID };

    testTier = await tierManagementService.createTier({
      name: 'service_test',
      display_name: 'Service Test Tier',
      description: 'Tier for service testing',
      monthly_api_calls: 1000,
      daily_api_calls: 100,
      hourly_api_calls: 10,
      minute_api_calls: 2,
      priority_support: false,
      concurrent_requests: 1,
      features: [],
      price: 0.00
    });

    await tierManagementService.subscribeUser(testUser.id, testTier.id);
  });

  afterAll(async () => {
    // Clean up
    await db.run('DELETE FROM user_subscriptions WHERE user_id = ?', [testUser.id]);
    await db.run('DELETE FROM users WHERE id = ?', [testUser.id]);
    await db.run('DELETE FROM user_tiers WHERE name = ?', ['service_test']);
  });

  describe('getUserTier', () => {
    it('should return user tier', async () => {
      const tier = await rateLimitService.getUserTier(testUser.id);
      expect(tier).toBeDefined();
      expect(tier.name).toBe('service_test');
    });

    it('should return free tier for user without subscription', async () => {
      const tempUser = await db.run(
        `INSERT INTO users (email, password, role, first_name, last_name) 
         VALUES (?, ?, ?, ?, ?)`,
        ['temp@example.com', 'hashedpassword', 'patient', 'Temp', 'User']
      );

      const tier = await rateLimitService.getUserTier(tempUser.lastID);
      expect(tier.name).toBe('free');

      await db.run('DELETE FROM users WHERE id = ?', [tempUser.lastID]);
    });
  });

  describe('checkRateLimit', () => {
    it('should allow requests within limits', async () => {
      const result = await rateLimitService.checkRateLimit(testUser.id, '/api/test', 'GET');
      expect(result.allowed).toBe(true);
      expect(result.limits).toBeDefined();
    });

    it('should handle rate limit violations', async () => {
      // Make multiple requests to exceed limit
      for (let i = 0; i < 5; i++) {
        await rateLimitService.checkRateLimit(testUser.id, '/api/test', 'GET');
      }

      const result = await rateLimitService.checkRateLimit(testUser.id, '/api/test', 'GET');
      expect(result.allowed).toBe(false);
      expect(result.window).toBeDefined();
      expect(result.limit).toBeDefined();
      expect(result.retryAfter).toBeDefined();
    });
  });

  describe('getUserQuotaInfo', () => {
    it('should return user quota information', async () => {
      const quotas = await rateLimitService.getUserQuotaInfo(testUser.id);
      expect(Array.isArray(quotas)).toBe(true);
      expect(quotas.length).toBeGreaterThan(0);
      
      quotas.forEach(quota => {
        expect(quota).toHaveProperty('quota_type');
        expect(quota).toHaveProperty('current_usage');
        expect(quota).toHaveProperty('max_allowed');
      });
    });
  });

  describe('resetUserQuota', () => {
    it('should reset user quota', async () => {
      await rateLimitService.resetUserQuota(testUser.id, 'minute');
      
      const quotas = await rateLimitService.getUserQuotaInfo(testUser.id);
      const minuteQuota = quotas.find(q => q.quota_type === 'minute');
      expect(minuteQuota.current_usage).toBe(0);
    });
  });
});
