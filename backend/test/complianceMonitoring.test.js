/**
 * Compliance Monitoring Service Tests
 */

const ComplianceMonitoringService = require('../services/complianceMonitoringService');
const RegulatoryRuleEngine = require('../services/regulatoryRuleEngine');
const ComplianceAlertService = require('../services/complianceAlertService');
const ComplianceReportingService = require('../services/complianceReportingService');
const ComplianceRuleManagementService = require('../services/complianceRuleManagementService');
const ComplianceAnalyticsService = require('../services/complianceAnalyticsService');

describe('Compliance Monitoring System', () => {
  let mockDb;
  let mockIo;
  let mockNotificationService;
  let complianceService;
  let ruleEngine;
  let alertService;
  let reportingService;
  let ruleManagementService;
  let analyticsService;

  beforeEach(() => {
    // Mock database
    mockDb = {
      run: jest.fn((query, params, callback) => callback && callback(null)),
      all: jest.fn((query, params, callback) => callback && callback(null, [])),
      get: jest.fn((query, params, callback) => callback && callback(null, null)),
      prepare: jest.fn(() => ({
        run: jest.fn(),
        finalize: jest.fn()
      }))
    };

    // Mock Socket.IO
    mockIo = {
      emit: jest.fn(),
      on: jest.fn()
    };

    // Mock notification service
    mockNotificationService = {
      sendAlert: jest.fn(),
      sendEmail: jest.fn(),
      sendSMS: jest.fn(),
      sendNotification: jest.fn()
    };

    // Initialize services
    ruleEngine = new RegulatoryRuleEngine();
    complianceService = new ComplianceMonitoringService(mockIo, mockNotificationService);
    alertService = new ComplianceAlertService(mockIo, mockNotificationService);
    reportingService = new ComplianceReportingService(mockDb, mockNotificationService);
    ruleManagementService = new ComplianceRuleManagementService(mockDb, ruleEngine, mockNotificationService);
    analyticsService = new ComplianceAnalyticsService(mockDb);

    // Mock database connection
    complianceService.db = mockDb;
  });

  describe('Regulatory Rule Engine', () => {
    test('should initialize with default regulatory frameworks', () => {
      expect(ruleEngine.regulatoryFrameworks.has('HIPAA')).toBe(true);
      expect(ruleEngine.regulatoryFrameworks.has('GDPR')).toBe(true);
      expect(ruleEngine.regulatoryFrameworks.has('HITECH')).toBe(true);
      expect(ruleEngine.regulatoryFrameworks.has('PCI_DSS')).toBe(true);
    });

    test('should add regulatory compliance rule', () => {
      const ruleId = 'test_rule';
      const rule = {
        name: 'Test Rule',
        description: 'Test compliance rule',
        regulatoryFramework: 'HIPAA',
        category: 'privacy',
        condition: (entity) => entity.test === true,
        action: (entity) => ({ compliant: true, message: 'Test passed' }),
        severity: 'medium'
      };

      const addedRule = ruleEngine.addRegulatoryRule(ruleId, rule);
      
      expect(addedRule.ruleId).toBe(ruleId);
      expect(addedRule.regulatoryFramework).toBe('HIPAA');
      expect(addedRule.category).toBe('privacy');
      expect(ruleEngine.rules.has(ruleId)).toBe(true);
    });

    test('should evaluate entity compliance', async () => {
      const testEntity = {
        id: 'test_1',
        type: 'patient',
        accessLevel: 'authorized',
        encrypted: true,
        consentStatus: 'valid',
        consentExpiry: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      };

      const result = await ruleEngine.evaluateRegulatoryCompliance(testEntity);
      
      expect(result.entityId).toBe('test_1');
      expect(result.entityType).toBe('patient');
      expect(result.totalRules).toBeGreaterThan(0);
      expect(result.evaluatedAt).toBeDefined();
    });

    test('should create rule from template', () => {
      const ruleId = 'template_rule';
      const parameters = {
        requiredRole: 'admin',
        entityType: 'patient',
        actionType: 'read'
      };

      const rule = ruleEngine.createRuleFromTemplate('access_control', ruleId, parameters);
      
      expect(rule.ruleId).toBe(ruleId);
      expect(rule.templateId).toBe('access_control');
      expect(rule.parameters).toEqual(parameters);
    });

    test('should validate regulatory rule', () => {
      const validRule = {
        condition: (entity) => true,
        action: (entity) => ({ compliant: true }),
        regulatoryFramework: 'HIPAA',
        category: 'privacy'
      };

      expect(() => ruleEngine.validateRegulatoryRule(validRule)).not.toThrow();

      const invalidRule = {
        condition: 'invalid function',
        action: (entity) => ({ compliant: true }),
        regulatoryFramework: 'UNKNOWN',
        category: 'privacy'
      };

      expect(() => ruleEngine.validateRegulatoryRule(invalidRule)).toThrow();
    });

    test('should get compliance summary by framework', () => {
      const summary = ruleEngine.getComplianceSummaryByFramework();
      
      expect(summary.HIPAA).toBeDefined();
      expect(summary.HIPAA.name).toBe('Health Insurance Portability and Accountability Act');
      expect(summary.GDPR).toBeDefined();
    });

    test('should get compliance summary by category', () => {
      const summary = ruleEngine.getComplianceSummaryByCategory();
      
      expect(summary.privacy).toBeDefined();
      expect(summary.security).toBeDefined();
      expect(summary.audit).toBeDefined();
    });
  });

  describe('Compliance Monitoring Service', () => {
    test('should initialize compliance monitoring service', () => {
      expect(complianceService.io).toBe(mockIo);
      expect(complianceService.notificationService).toBe(mockNotificationService);
      expect(complianceService.complianceRules.size).toBeGreaterThan(0);
    });

    test('should add compliance rule', () => {
      const ruleId = 'test_compliance_rule';
      const rule = {
        name: 'Test Compliance Rule',
        category: 'HIPAA',
        description: 'Test rule for compliance',
        regulation: 'HIPAA-164.312',
        condition: (entity) => entity.test === true,
        action: (entity) => ({ compliant: true, message: 'Test passed' }),
        severity: 'medium'
      };

      complianceService.addComplianceRule(ruleId, rule);
      
      expect(complianceService.complianceRules.has(ruleId)).toBe(true);
      expect(mockDb.run).toHaveBeenCalled();
    });

    test('should check entity compliance', async () => {
      const testEntity = {
        id: 'test_entity',
        type: 'patient',
        accessLevel: 'authorized',
        encrypted: true
      };

      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { id: 'test_entity', ...testEntity });
      });

      const result = await complianceService.checkEntityCompliance(testEntity);
      
      expect(result.entityType).toBe('patient');
      expect(result.entityId).toBe('test_entity');
      expect(result.violations).toBeDefined();
      expect(result.passedRules).toBeDefined();
      expect(result.complianceScore).toBeDefined();
    });

    test('should record violation', async () => {
      const violation = {
        violationId: 'test_violation',
        ruleId: 'test_rule',
        entityType: 'patient',
        entityId: 'test_patient',
        severity: 'high',
        description: 'Test violation',
        detectedAt: new Date(),
        status: 'open'
      };

      await complianceService.recordViolation(violation);
      
      expect(complianceService.violations.has('test_violation')).toBe(true);
      expect(mockDb.prepare).toHaveBeenCalled();
    });

    test('should trigger compliance alert', async () => {
      const violation = {
        violationId: 'test_violation',
        ruleId: 'test_rule',
        entityType: 'patient',
        entityId: 'test_patient',
        severity: 'high',
        description: 'High severity violation',
        detectedAt: new Date()
      };

      await complianceService.triggerComplianceAlert(violation);
      
      expect(mockNotificationService.sendAlert).toHaveBeenCalled();
      expect(mockIo.emit).toHaveBeenCalledWith('compliance:alert', expect.any(Object));
    });

    test('should resolve violation', async () => {
      const violationId = 'test_violation';
      const resolvedBy = 'test_user';
      const notes = 'Test resolution';

      // Mock violation exists
      complianceService.violations.set(violationId, {
        violationId,
        status: 'open'
      });

      await complianceService.resolveViolation(violationId, resolvedBy, notes);
      
      const violation = complianceService.violations.get(violationId);
      expect(violation.status).toBe('resolved');
      expect(violation.resolvedBy).toBe(resolvedBy);
      expect(violation.resolutionNotes).toBe(notes);
    });

    test('should generate compliance report', async () => {
      // Mock database responses
      mockDb.all.mockImplementation((query, params, callback) => {
        if (query.includes('compliance_violations')) {
          callback(null, []);
        } else if (query.includes('compliance_audit_trail')) {
          callback(null, []);
        }
      });

      const report = await complianceService.generateComplianceReport('daily');
      
      expect(report.reportId).toBeDefined();
      expect(report.reportType).toBe('daily');
      expect(report.summary).toBeDefined();
      expect(report.violations).toBeDefined();
      expect(report.trends).toBeDefined();
      expect(report.recommendations).toBeDefined();
      expect(report.generatedAt).toBeDefined();
    });

    test('should get compliance metrics', () => {
      const metrics = complianceService.getComplianceMetrics();
      
      expect(metrics.totalChecks).toBeDefined();
      expect(metrics.violations).toBeDefined();
      expect(metrics.activeRules).toBeDefined();
      expect(metrics.openViolations).toBeDefined();
      expect(metrics.lastUpdated).toBeDefined();
    });
  });

  describe('Compliance Alert Service', () => {
    test('should initialize alert service', () => {
      expect(alertService.alertChannels.size).toBeGreaterThan(0);
      expect(alertService.alertRules.size).toBeGreaterThan(0);
    });

    test('should process violation and create alert', async () => {
      const violation = {
        violationId: 'test_violation',
        ruleId: 'test_rule',
        entityType: 'patient',
        entityId: 'test_patient',
        severity: 'high',
        description: 'Test violation',
        detectedAt: new Date()
      };

      const alert = await alertService.processViolation(violation);
      
      expect(alert).toBeDefined();
      expect(alert.alertId).toBeDefined();
      expect(alert.violation).toBe(violation);
      expect(alert.channels).toBeDefined();
      expect(alert.priority).toBeDefined();
    });

    test('should check alert suppression', () => {
      const violation = {
        violationId: 'test_violation',
        ruleId: 'test_rule',
        severity: 'medium'
      };

      // Add suppression rule
      alertService.addSuppressionRule('test_suppression', {
        ruleIds: ['test_rule'],
        timeWindow: 3600000, // 1 hour
        maxAlerts: 1
      });

      // First alert should not be suppressed
      expect(alertService.isAlertSuppressed(violation)).toBe(false);

      // Add to alert history
      alertService.alertHistory.push({
        violationId: 'test_violation',
        processedAt: new Date()
      });

      // Second alert should be suppressed
      expect(alertService.isAlertSuppressed(violation)).toBe(true);
    });

    test('should send alert to channels', async () => {
      const alert = {
        alertId: 'test_alert',
        channels: ['websocket', 'email'],
        violation: {
          violationId: 'test_violation',
          severity: 'high'
        },
        title: 'Test Alert',
        message: 'Test message',
        createdAt: new Date()
      };

      const results = await alertService.sendAlert(alert);
      
      expect(results).toHaveLength(2);
      expect(mockIo.emit).toHaveBeenCalled();
      expect(mockNotificationService.sendEmail).toHaveBeenCalled();
    });

    test('should get alert statistics', () => {
      // Add some alert history
      alertService.alertHistory = [
        {
          severity: 'high',
          status: 'resolved',
          processedAt: new Date(),
          results: [{ channel: 'websocket', success: true }]
        },
        {
          severity: 'medium',
          status: 'pending',
          processedAt: new Date(),
          results: [{ channel: 'email', success: true }]
        }
      ];

      const stats = alertService.getAlertStatistics();
      
      expect(stats.total).toBe(2);
      expect(stats.bySeverity.high).toBe(1);
      expect(stats.bySeverity.medium).toBe(1);
      expect(stats.byChannel.websocket).toBe(1);
      expect(stats.byChannel.email).toBe(1);
    });
  });

  describe('Compliance Reporting Service', () => {
    test('should initialize reporting service', () => {
      expect(reportingService.reportTemplates.size).toBeGreaterThan(0);
      expect(reportingService.reportTemplates.has('daily_summary')).toBe(true);
      expect(reportingService.reportTemplates.has('weekly_report')).toBe(true);
      expect(reportingService.reportTemplates.has('monthly_regulatory')).toBe(true);
    });

    test('should generate daily summary report', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 100 });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const report = await reportingService.generateReport('daily_summary');
      
      expect(report.reportId).toBeDefined();
      expect(report.templateId).toBe('daily_summary');
      expect(report.templateName).toBe('Daily Compliance Summary');
      expect(report.content).toBeDefined();
      expect(report.metadata).toBeDefined();
    });

    test('should gather report data', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('COUNT(*)')) {
          callback(null, { count: 50 });
        }
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const template = reportingService.reportTemplates.get('daily_summary');
      const data = await reportingService.gatherReportData(template, {});
      
      expect(data.overview).toBeDefined();
      expect(data.violations).toBeDefined();
      expect(data.auditTrail).toBeDefined();
      expect(data.metrics).toBeDefined();
      expect(data.trends).toBeDefined();
      expect(data.frameworks).toBeDefined();
      expect(data.recommendations).toBeDefined();
    });

    test('should generate HTML report content', () => {
      const template = {
        format: 'html',
        sections: ['overview', 'violations'],
        name: 'Test Report'
      };

      const data = {
        overview: {
          totalChecks: 100,
          totalViolations: 5,
          resolvedViolations: 3,
          complianceScore: '95.00',
          period: {
            start: new Date(),
            end: new Date()
          }
        },
        violations: []
      };

      const content = reportingService.generateHTMLReport(template, data);
      
      expect(content).toContain('<!DOCTYPE html>');
      expect(content).toContain(template.name);
      expect(content).toContain('Compliance Overview');
      expect(content).toContain('100');
      expect(content).toContain('95.00');
    });

    test('should generate CSV report content', () => {
      const template = {
        templateId: 'audit_trail',
        format: 'csv'
      };

      const data = {
        auditTrail: [
          {
            audit_id: 'audit_1',
            action: 'compliance_check',
            entity_type: 'patient',
            entity_id: 'patient_1',
            result: 'compliant',
            timestamp: '2023-01-01T00:00:00Z',
            user_id: 'system'
          }
        ]
      };

      const content = reportingService.generateCSVReport(template, data);
      
      expect(content).toContain('Audit ID,Action,Entity Type');
      expect(content).toContain('audit_1,compliance_check,patient');
    });

    test('should get report templates', () => {
      const templates = reportingService.getReportTemplates();
      
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      expect(templates[0]).toHaveProperty('id');
      expect(templates[0]).toHaveProperty('name');
      expect(templates[0]).toHaveProperty('description');
    });
  });

  describe('Compliance Rule Management Service', () => {
    test('should initialize rule management service', () => {
      expect(ruleManagementService.db).toBe(mockDb);
      expect(ruleManagementService.ruleEngine).toBe(ruleEngine);
      expect(ruleManagementService.notificationService).toBe(mockNotificationService);
    });

    test('should create rule update', async () => {
      const ruleId = 'test_rule';
      const updateData = {
        name: 'Updated Rule',
        description: 'Updated description',
        condition: (entity) => entity.updated === true,
        action: (entity) => ({ compliant: true, message: 'Updated rule passed' }),
        severity: 'high'
      };

      // Mock validation
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 0 });
      });

      const update = await ruleManagementService.createRuleUpdate(ruleId, updateData);
      
      expect(update.updateId).toBeDefined();
      expect(update.ruleId).toBe(ruleId);
      expect(update.currentVersion).toBeDefined();
      expect(update.newVersion).toBeDefined();
      expect(update.status).toBe('pending');
    });

    test('should validate rule update', async () => {
      const validUpdate = {
        condition: (entity) => entity.test === true,
        action: (entity) => ({ compliant: true }),
        regulatoryFramework: 'HIPAA',
        category: 'privacy'
      };

      const result = await ruleManagementService.validateRuleUpdate('test_rule', validUpdate);
      
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    test('should test rule with sample data', async () => {
      const ruleData = {
        condition: (entity) => entity.test === true,
        action: (entity) => ({ compliant: true })
      };

      const result = await ruleManagementService.testRuleWithSampleData(ruleData);
      
      expect(result.passed).toBe(true);
    });

    test('should deploy rule update', async () => {
      const update = {
        updateId: 'test_update',
        ruleId: 'test_rule',
        updateData: {
          name: 'Updated Rule',
          condition: (entity) => true,
          action: (entity) => ({ compliant: true })
        },
        newVersion: '1.1',
        requestedBy: 'test_user',
        rollbackData: {
          ruleId: 'test_rule',
          version: '1.0',
          ruleData: { name: 'Original Rule' }
        }
      };

      // Mock database operations
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        finalize: jest.fn()
      });

      const deployment = await ruleManagementService.deployRuleUpdate(update);
      
      expect(deployment.deploymentId).toBeDefined();
      expect(deployment.status).toBe('completed');
      expect(deployment.ruleId).toBe('test_rule');
    });

    test('should rollback deployment', async () => {
      const deploymentId = 'test_deployment';
      const rollbackData = {
        ruleId: 'test_rule',
        version: '1.0',
        ruleData: {
          name: 'Original Rule',
          condition: (entity) => true,
          action: (entity) => ({ compliant: true })
        }
      };

      ruleManagementService.rollbackStack.set(deploymentId, rollbackData);

      // Mock database operations
      mockDb.prepare.mockReturnValue({
        run: jest.fn(),
        finalize: jest.fn()
      });

      await ruleManagementService.rollbackDeployment(deploymentId);
      
      expect(ruleManagementService.rollbackStack.has(deploymentId)).toBe(false);
    });

    test('should get pending updates', () => {
      const update1 = {
        updateId: 'update_1',
        ruleId: 'rule_1',
        status: 'pending',
        createdAt: new Date()
      };

      const update2 = {
        updateId: 'update_2',
        ruleId: 'rule_2',
        status: 'pending',
        createdAt: new Date()
      };

      ruleManagementService.pendingUpdates.set('update_1', update1);
      ruleManagementService.pendingUpdates.set('update_2', update2);

      const pending = ruleManagementService.getPendingUpdates();
      
      expect(pending).toHaveLength(2);
      expect(pending[0].updateId).toBe('update_1');
      expect(pending[1].updateId).toBe('update_2');
    });

    test('should cancel update', () => {
      const updateId = 'test_update';
      const update = {
        updateId,
        status: 'pending'
      };

      ruleManagementService.pendingUpdates.set(updateId, update);
      ruleManagementService.updateQueue.push(updateId);

      const result = ruleManagementService.cancelUpdate(updateId);
      
      expect(result).toBe(true);
      expect(ruleManagementService.pendingUpdates.has(updateId)).toBe(false);
      expect(ruleManagementService.updateQueue.includes(updateId)).toBe(false);
    });
  });

  describe('Compliance Analytics Service', () => {
    test('should initialize analytics service', () => {
      expect(analyticsService.db).toBe(mockDb);
      expect(analyticsService.cache).toBeDefined();
    });

    test('should get compliance analytics', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('COUNT(*)')) {
          callback(null, { count: 100 });
        }
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      const analytics = await analyticsService.getComplianceAnalytics({ period: '30d' });
      
      expect(analytics.overview).toBeDefined();
      expect(analytics.trends).toBeDefined();
      expect(analytics.violations).toBeDefined();
      expect(analytics.compliance).toBeDefined();
      expect(analytics.risk).toBeDefined();
      expect(analytics.performance).toBeDefined();
      expect(analytics.predictions).toBeDefined();
      expect(analytics.benchmarks).toBeDefined();
      expect(analytics.generatedAt).toBeDefined();
      expect(analytics.period).toBe('30d');
    });

    test('should get overview analytics', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 50 });
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const overview = await analyticsService.getOverviewAnalytics(periodRange);
      
      expect(overview.totalChecks).toBe(50);
      expect(overview.totalViolations).toBe(50);
      expect(overview.resolvedViolations).toBe(50);
      expect(overview.openViolations).toBe(50);
      expect(overview.complianceScore).toBe('0.00');
      expect(overview.violationRate).toBe('100.00');
    });

    test('should get trend analytics', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 10 });
      });

      const periodRange = {
        start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const trends = await analyticsService.getTrendAnalytics(periodRange);
      
      expect(trends.daily).toBeDefined();
      expect(trends.analysis).toBeDefined();
      expect(trends.movingAverages).toBeDefined();
      expect(trends.daily.length).toBe(8); // 7 days + 1
    });

    test('should analyze trends', () => {
      const trends = [
        { date: '2023-01-01', complianceScore: '95.00' },
        { date: '2023-01-02', complianceScore: '96.00' },
        { date: '2023-01-03', complianceScore: '97.00' },
        { date: '2023-01-04', complianceScore: '98.00' },
        { date: '2023-01-05', complianceScore: '99.00' },
        { date: '2023-01-06', complianceScore: '100.00' },
        { date: '2023-01-07', complianceScore: '100.00' },
        { date: '2023-01-08', complianceScore: '99.00' },
        { date: '2023-01-09', complianceScore: '98.00' },
        { date: '2023-01-10', complianceScore: '97.00' },
        { date: '2023-01-11', complianceScore: '96.00' },
        { date: '2023-01-12', complianceScore: '95.00' },
        { date: '2023-01-13', complianceScore: '94.00' },
        { date: '2023-01-14', complianceScore: '93.00' }
      ];

      const analysis = analyticsService.analyzeTrends(trends);
      
      expect(analysis.direction).toBe('declining');
      expect(parseFloat(analysis.change)).toBeLessThan(0);
    });

    test('should calculate moving averages', () => {
      const trends = [
        { date: '2023-01-01', complianceScore: '95.00' },
        { date: '2023-01-02', complianceScore: '96.00' },
        { date: '2023-01-03', complianceScore: '97.00' },
        { date: '2023-01-04', complianceScore: '98.00' },
        { date: '2023-01-05', complianceScore: '99.00' },
        { date: '2023-01-06', complianceScore: '100.00' },
        { date: '2023-01-07', complianceScore: '100.00' },
        { date: '2023-01-08', complianceScore: '99.00' },
        { date: '2023-01-09', complianceScore: '98.00' },
        { date: '2023-01-10', complianceScore: '97.00' }
      ];

      const movingAverages = analyticsService.calculateMovingAverages(trends, 3);
      
      expect(movingAverages).toHaveLength(8); // 10 - 3 + 1
      expect(movingAverages[0].movingAverage).toBeDefined();
    });

    test('should get violation analytics', async () => {
      // Mock database responses
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { severity: 'high', count: 5 },
          { severity: 'medium', count: 3 },
          { severity: 'low', count: 2 }
        ]);
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const violations = await analyticsService.getViolationAnalytics(periodRange);
      
      expect(violations.bySeverity).toBeDefined();
      expect(violations.byCategory).toBeDefined();
      expect(violations.byEntityType).toBeDefined();
      expect(violations.byRule).toBeDefined();
      expect(violations.topEntities).toBeDefined();
    });

    test('should get compliance score analytics', async () => {
      // Mock database responses
      mockDb.all.mockImplementation((query, params, callback) => {
        if (query.includes('regulation')) {
          callback(null, [
            { regulation: 'HIPAA', violations: 2, total_rules: 10 },
            { regulation: 'GDPR', violations: 1, total_rules: 8 }
          ]);
        } else if (query.includes('category')) {
          callback(null, [
            { category: 'privacy', violations: 2, total_rules: 5 },
            { category: 'security', violations: 1, total_rules: 7 }
          ]);
        }
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const compliance = await analyticsService.getComplianceScoreAnalytics(periodRange);
      
      expect(compliance.byFramework).toBeDefined();
      expect(compliance.byCategory).toBeDefined();
      expect(compliance.overallScore).toBeDefined();
      expect(compliance.byFramework.HIPAA.complianceScore).toBe('80.00');
    });

    test('should get risk analytics', async () => {
      // Mock database responses
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { rule_id: 'test_rule', entity_type: 'patient', count: 5 }
        ]);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 10 });
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const risk = await analyticsService.getRiskAnalytics(periodRange);
      
      expect(risk.highRiskViolations).toBeDefined();
      expect(risk.riskFactors).toBeDefined();
      expect(risk.overallRiskScore).toBeDefined();
      expect(risk.riskLevel).toBeDefined();
      expect(risk.recommendations).toBeDefined();
    });

    test('should get performance analytics', async () => {
      // Mock database responses
      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, [
          { date: '2023-01-01', checks: 100, compliance_rate: 95.0 }
        ]);
      });

      mockDb.get.mockImplementation((query, params, callback) => {
        if (query.includes('COUNT(*)')) {
          callback(null, { count: 100 });
        } else if (query.includes('AVG')) {
          callback(null, { avg_minutes: 120 });
        }
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const performance = await analyticsService.getPerformanceAnalytics(periodRange);
      
      expect(performance.checkPerformance).toBeDefined();
      expect(performance.resolutionPerformance).toBeDefined();
      expect(performance.efficiency).toBeDefined();
    });

    test('should get predictive analytics', async () => {
      // Mock database responses for trend data
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 10 });
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const predictions = await analyticsService.getPredictiveAnalytics(periodRange);
      
      expect(predictions.nextPeriodScore).toBeDefined();
      expect(predictions.confidence).toBeDefined();
      expect(predictions.violationTrend).toBeDefined();
      expect(predictions.recommendations).toBeDefined();
    });

    test('should get benchmark analytics', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 100 });
      });

      const periodRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      const benchmarks = await analyticsService.getBenchmarkAnalytics(periodRange);
      
      expect(benchmarks.industry).toBeDefined();
      expect(benchmarks.current).toBeDefined();
      expect(benchmarks.comparison).toBeDefined();
      expect(benchmarks.industry.averageComplianceScore).toBe(95.5);
    });

    test('should parse period correctly', () => {
      const period7d = analyticsService.parsePeriod('7d');
      const period30d = analyticsService.parsePeriod('30d');
      const period90d = analyticsService.parsePeriod('90d');

      expect(period7d.start).toBeInstanceOf(Date);
      expect(period7d.end).toBeInstanceOf(Date);
      expect(period30d.start).toBeInstanceOf(Date);
      expect(period30d.end).toBeInstanceOf(Date);
      expect(period90d.start).toBeInstanceOf(Date);
      expect(period90d.end).toBeInstanceOf(Date);

      const expected30dStart = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      expect(period30d.start.getTime()).toBeCloseTo(expected30dStart.getTime(), -1000);
    });

    test('should get compliance status', () => {
      expect(analyticsService.getComplianceStatus(96)).toBe('excellent');
      expect(analyticsService.getComplianceStatus(92)).toBe('good');
      expect(analyticsService.getComplianceStatus(85)).toBe('fair');
      expect(analyticsService.getComplianceStatus(75)).toBe('poor');
      expect(analyticsService.getComplianceStatus(65)).toBe('critical');
    });

    test('should get risk level', () => {
      expect(analyticsService.getRiskLevel(85)).toBe('high');
      expect(analyticsService.getRiskLevel(65)).toBe('medium');
      expect(analyticsService.getRiskLevel(45)).toBe('low');
      expect(analyticsService.getRiskLevel(25)).toBe('minimal');
    });

    test('should cache results', () => {
      const cacheKey = 'test_key';
      const testData = { test: 'data' };

      analyticsService.setCache(cacheKey, testData);
      const cached = analyticsService.getFromCache(cacheKey);

      expect(cached).toEqual(testData);
    });

    test('should clear cache', () => {
      analyticsService.setCache('test_key', { test: 'data' });
      analyticsService.clearCache();

      expect(analyticsService.getFromCache('test_key')).toBeNull();
    });
  });

  describe('Integration Tests', () => {
    test('should integrate compliance monitoring with alerting', async () => {
      const testEntity = {
        id: 'integration_test',
        type: 'patient',
        accessLevel: 'unauthorized', // This should trigger a violation
        encrypted: false
      };

      // Mock database to return the test entity
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, testEntity);
      });

      // Check entity compliance
      const complianceResult = await complianceService.checkEntityCompliance(testEntity);
      
      expect(complianceResult.violations.length).toBeGreaterThan(0);

      // Process violation through alert service
      if (complianceResult.violations.length > 0) {
        const alert = await alertService.processViolation(complianceResult.violations[0]);
        
        expect(alert).toBeDefined();
        expect(alert.alertId).toBeDefined();
        expect(alert.channels).toContain('websocket');
      }
    });

    test('should integrate rule management with compliance monitoring', async () => {
      const ruleId = 'integration_rule';
      const updateData = {
        name: 'Integration Test Rule',
        condition: (entity) => entity.integration_test === true,
        action: (entity) => ({ compliant: true, message: 'Integration test passed' }),
        severity: 'medium'
      };

      // Create rule update
      const update = await ruleManagementService.createRuleUpdate(ruleId, updateData);
      
      expect(update.updateId).toBeDefined();
      expect(update.status).toBe('pending');

      // Add rule to compliance service
      complianceService.addComplianceRule(ruleId, {
        name: updateData.name,
        category: 'test',
        description: 'Integration test rule',
        regulation: 'TEST-001',
        condition: updateData.condition,
        action: updateData.action,
        severity: updateData.severity
      });

      // Test entity with new rule
      const testEntity = {
        id: 'test_entity',
        type: 'patient',
        integration_test: true
      };

      const result = await complianceService.checkEntityCompliance(testEntity);
      
      expect(result.passedRules).toContain(ruleId);
    });

    test('should integrate analytics with reporting', async () => {
      // Mock database responses
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, { count: 100 });
      });

      mockDb.all.mockImplementation((query, params, callback) => {
        callback(null, []);
      });

      // Get analytics data
      const analytics = await analyticsService.getComplianceAnalytics({ period: '7d' });
      
      expect(analytics.overview).toBeDefined();

      // Generate report using analytics data
      const report = await reportingService.generateReport('daily_summary');
      
      expect(report.reportId).toBeDefined();
      expect(report.content.overview.totalChecks).toBeDefined();
    });
  });
});
