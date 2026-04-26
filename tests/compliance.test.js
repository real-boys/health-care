const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const ComplianceRule = require('../models/ComplianceRule');
const ComplianceViolation = require('../models/ComplianceViolation');
const User = require('../models/User');

describe('Compliance Monitoring System', () => {
  let authToken;
  let testUser;
  let testRule;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/insurance_portal_test');
    
    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });
    await testUser.save();
    
    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
    
    // Create test compliance rule
    testRule = new ComplianceRule({
      ruleId: 'TEST-001',
      name: 'Test PII Access Rule',
      description: 'Test rule for monitoring PII data access',
      category: 'hipaa',
      ruleType: 'data-access',
      severity: 'high',
      conditions: {
        resourceTypes: ['user'],
        actions: ['read'],
        userRoles: ['admin', 'provider']
      },
      logic: 'simple',
      ruleExpression: 'pii_access',
      enforcementAction: 'alert'
    });
    await testRule.save();
  });

  afterAll(async () => {
    // Clean up test data
    await ComplianceRule.deleteMany({});
    await ComplianceViolation.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('GET /api/compliance/dashboard', () => {
    it('should return compliance dashboard data', async () => {
      const response = await request(app)
        .get('/api/compliance/dashboard')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('report');
      expect(response.body.data).toHaveProperty('openViolations');
      expect(response.body.data).toHaveProperty('trendingViolations');
      expect(response.body.data).toHaveProperty('summary');
    });

    it('should require authentication', async () => {
      await request(app)
        .get('/api/compliance/dashboard')
        .expect(401);
    });
  });

  describe('GET /api/compliance/rules', () => {
    it('should return compliance rules', async () => {
      const response = await request(app)
        .get('/api/compliance/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should filter rules by category', async () => {
      const response = await request(app)
        .get('/api/compliance/rules?category=hipaa')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(rule => rule.category === 'hipaa')).toBe(true);
    });
  });

  describe('POST /api/compliance/rules', () => {
    it('should create a new compliance rule', async () => {
      const ruleData = {
        ruleId: 'TEST-002',
        name: 'Test Data Retention Rule',
        description: 'Test rule for data retention compliance',
        category: 'gdpr',
        ruleType: 'data-retention',
        severity: 'medium',
        conditions: {
          resourceTypes: ['document'],
          actions: ['delete']
        },
        logic: 'simple',
        ruleExpression: 'data_retention',
        enforcementAction: 'block'
      };

      const response = await request(app)
        .post('/api/compliance/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ruleData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data.ruleId).toBe(ruleData.ruleId);
      expect(response.body.data.name).toBe(ruleData.name);
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/compliance/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    it('should prevent duplicate rule IDs', async () => {
      const ruleData = {
        ruleId: 'TEST-001', // Duplicate ID
        name: 'Duplicate Rule',
        description: 'This should fail',
        category: 'hipaa',
        ruleType: 'data-access',
        severity: 'low',
        logic: 'simple',
        ruleExpression: 'test',
        enforcementAction: 'alert'
      };

      await request(app)
        .post('/api/compliance/rules')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ruleData)
        .expect(400);
    });
  });

  describe('PUT /api/compliance/rules/:ruleId', () => {
    it('should update a compliance rule', async () => {
      const updateData = {
        name: 'Updated Test Rule',
        description: 'Updated description'
      };

      const response = await request(app)
        .put(`/api/compliance/rules/${testRule.ruleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.name).toBe(updateData.name);
      expect(response.body.data.version).not.toBe(testRule.version);
    });

    it('should return 404 for non-existent rule', async () => {
      await request(app)
        .put('/api/compliance/rules/NON-EXISTENT')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ name: 'Updated' })
        .expect(404);
    });
  });

  describe('DELETE /api/compliance/rules/:ruleId', () => {
    it('should deactivate a compliance rule', async () => {
      const response = await request(app)
        .delete(`/api/compliance/rules/${testRule.ruleId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Rule deactivated successfully');
    });
  });

  describe('GET /api/compliance/violations', () => {
    it('should return violations list', async () => {
      // Create a test violation first
      const violation = new ComplianceViolation({
        violationId: 'TEST-V-001',
        ruleId: testRule.ruleId,
        severity: 'high',
        context: {
          action: 'read',
          resourceType: 'user',
          resourceId: testUser._id,
          userId: testUser._id,
          userRole: 'admin'
        },
        details: {
          description: 'Test violation',
          timestamp: new Date()
        }
      });
      await violation.save();

      const response = await request(app)
        .get('/api/compliance/violations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('violations');
      expect(response.body.data).toHaveProperty('pagination');
    });
  });

  describe('POST /api/compliance/check', () => {
    it('should perform manual compliance check', async () => {
      const checkData = {
        action: 'read',
        resourceType: 'user',
        resourceId: testUser._id,
        compliance: {
          piiAccessed: true
        }
      };

      const response = await request(app)
        .post('/api/compliance/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send(checkData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('violations');
      expect(response.body.data).toHaveProperty('totalViolations');
    });

    it('should validate required fields', async () => {
      await request(app)
        .post('/api/compliance/check')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/compliance/stats', () => {
    it('should return compliance statistics', async () => {
      const response = await request(app)
        .get('/api/compliance/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('violationStats');
      expect(response.body.data).toHaveProperty('trendingViolations');
      expect(response.body.data).toHaveProperty('ruleStats');
    });
  });

  describe('POST /api/compliance/violations/:violationId/resolve', () => {
    it('should resolve a violation', async () => {
      // Create a test violation
      const violation = new ComplianceViolation({
        violationId: 'TEST-V-002',
        ruleId: testRule.ruleId,
        severity: 'medium',
        context: {
          action: 'create',
          resourceType: 'document',
          resourceId: new mongoose.Types.ObjectId(),
          userId: testUser._id,
          userRole: 'admin'
        },
        details: {
          description: 'Test violation to resolve',
          timestamp: new Date()
        }
      });
      await violation.save();

      const resolveData = {
        resolutionNotes: 'Test resolution',
        correctiveActions: ['Action 1'],
        preventiveActions: ['Prevention 1']
      };

      const response = await request(app)
        .post(`/api/compliance/violations/${violation.violationId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(resolveData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe('resolved');
    });
  });
});
