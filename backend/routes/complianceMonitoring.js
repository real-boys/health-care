const express = require('express');
const router = express.Router();
const ComplianceMonitoringService = require('../services/complianceMonitoringService');
const auth = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');

// Initialize compliance monitoring service
const complianceService = new ComplianceMonitoringService({
  rulesDirectory: process.env.COMPLIANCE_RULES_DIR || './compliance-rules',
  monitoringInterval: process.env.COMPLIANCE_MONITORING_INTERVAL || '*/5 * * * *',
  reportInterval: process.env.COMPLIANCE_REPORT_INTERVAL || '0 0 * * *',
  retentionPeriod: parseInt(process.env.COMPLIANCE_RETENTION_PERIOD) || 365
});

// Initialize compliance service on startup
complianceService.initialize().catch(console.error);

// Middleware to check compliance permissions
const checkCompliancePermission = (req, res, next) => {
  const userRole = req.user?.role;
  const allowedRoles = ['admin', 'system_admin', 'compliance_officer', 'auditor'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for compliance operations'
    });
  }
  
  next();
};

// Get compliance status
router.get('/status', [
  auth,
  checkCompliancePermission
], async (req, res) => {
  try {
    const status = complianceService.getComplianceStatus();
    
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get compliance status error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get compliance status',
      error: error.message
    });
  }
});

// Perform manual compliance check
router.post('/check', [
  auth,
  checkCompliancePermission
], async (req, res) => {
  try {
    const checkResult = await complianceService.performComplianceCheck();
    
    res.json({
      success: true,
      message: 'Compliance check completed',
      data: checkResult
    });
  } catch (error) {
    console.error('Compliance check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform compliance check',
      error: error.message
    });
  }
});

// Get violations
router.get('/violations', [
  auth,
  checkCompliancePermission,
  query('status').optional().isIn(['open', 'resolved', 'closed']),
  query('category').optional().isString(),
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const {
      status,
      category,
      severity,
      limit = 50,
      offset = 0
    } = req.query;

    const violations = complianceService.getViolations({
      status,
      category,
      severity,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const totalViolations = complianceService.violations.filter(v => {
      if (status && v.status !== status) return false;
      if (category && v.category !== category) return false;
      if (severity && v.severity !== severity) return false;
      return true;
    }).length;

    res.json({
      success: true,
      data: {
        violations,
        total: totalViolations,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get violations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve violations',
      error: error.message
    });
  }
});

// Get violation details
router.get('/violations/:violationId', [
  auth,
  checkCompliancePermission
], async (req, res) => {
  try {
    const { violationId } = req.params;
    
    const violation = complianceService.violations.find(v => v.id === violationId);
    
    if (!violation) {
      return res.status(404).json({
        success: false,
        message: 'Violation not found'
      });
    }

    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    console.error('Get violation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve violation',
      error: error.message
    });
  }
});

// Resolve violation
router.patch('/violations/:violationId/resolve', [
  auth,
  checkCompliancePermission,
  body('resolution').isObject(),
  body('resolution.notes').isString().isLength({ min: 10, max: 1000 }),
  body('resolution.actionTaken').isString(),
  body('resolution.preventiveMeasures').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { violationId } = req.params;
    const resolution = {
      ...req.body.resolution,
      userId: req.user.id,
      userEmail: req.user.email,
      resolvedAt: new Date()
    };

    const resolvedViolation = await complianceService.resolveViolation(violationId, resolution);

    res.json({
      success: true,
      message: 'Violation resolved successfully',
      data: resolvedViolation
    });
  } catch (error) {
    console.error('Resolve violation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to resolve violation',
      error: error.message
    });
  }
});

// Get compliance rules
router.get('/rules', [
  auth,
  checkCompliancePermission,
  query('category').optional().isString(),
  query('enabled').optional().isBoolean()
], async (req, res) => {
  try {
    const { category, enabled } = req.query;
    
    let rules = complianceService.getRules();
    
    // Apply filters
    if (category) {
      rules = rules.filter(rule => rule.category === category);
    }
    
    if (enabled !== undefined) {
      rules = rules.filter(rule => rule.enabled === (enabled === 'true'));
    }

    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Get rules error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve compliance rules',
      error: error.message
    });
  }
});

// Get rule details
router.get('/rules/:ruleId', [
  auth,
  checkCompliancePermission
], async (req, res) => {
  try {
    const { ruleId } = req.params;
    
    const rule = complianceService.rules.get(ruleId);
    
    if (!rule) {
      return res.status(404).json({
        success: false,
        message: 'Rule not found'
      });
    }

    res.json({
      success: true,
      data: rule
    });
  } catch (error) {
    console.error('Get rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve rule',
      error: error.message
    });
  }
});

// Update rule
router.patch('/rules/:ruleId', [
  auth,
  checkCompliancePermission,
  body('name').optional().isString().isLength({ min: 3, max: 100 }),
  body('description').optional().isString().isLength({ min: 10, max: 500 }),
  body('enabled').optional().isBoolean(),
  body('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
  body('conditions').optional().isArray(),
  body('actions').optional().isArray()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { ruleId } = req.params;
    const updates = req.body;

    const updatedRule = await complianceService.updateRule(ruleId, updates);

    res.json({
      success: true,
      message: 'Rule updated successfully',
      data: updatedRule
    });
  } catch (error) {
    console.error('Update rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update rule',
      error: error.message
    });
  }
});

// Create custom rule
router.post('/rules', [
  auth,
  checkCompliancePermission,
  body('id').isString().isLength({ min: 3, max: 50 }).matches(/^custom_/),
  body('name').isString().isLength({ min: 3, max: 100 }),
  body('category').isString().isLength({ min: 2, max: 50 }),
  body('description').isString().isLength({ min: 10, max: 500 }),
  body('severity').isIn(['critical', 'high', 'medium', 'low']),
  body('conditions').isArray({ min: 1 }),
  body('actions').isArray(),
  body('enabled').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const ruleData = {
      ...req.body,
      enabled: req.body.enabled !== false,
      createdAt: new Date(),
      updatedAt: new Date(),
      version: '1.0'
    };

    complianceService.addRule(ruleData);

    res.json({
      success: true,
      message: 'Custom rule created successfully',
      data: ruleData
    });
  } catch (error) {
    console.error('Create rule error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create rule',
      error: error.message
    });
  }
});

// Generate compliance report
router.get('/reports', [
  auth,
  checkCompliancePermission,
  query('period').optional().isIn(['last_24_hours', 'last_7_days', 'last_30_days']),
  query('format').optional().isIn(['json', 'pdf'])
], async (req, res) => {
  try {
    const { period = 'last_24_hours', format = 'json' } = req.query;
    
    const report = await complianceService.generateComplianceReport();
    
    if (format === 'pdf') {
      // This would generate a PDF report
      // For now, return JSON
      return res.json({
        success: true,
        message: 'PDF format not yet implemented',
        data: report
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Generate compliance report error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate compliance report',
      error: error.message
    });
  }
});

// Get compliance analytics
router.get('/analytics', [
  auth,
  checkCompliancePermission,
  query('period').optional().isIn(['last_7_days', 'last_30_days', 'last_90_days'])
], async (req, res) => {
  try {
    const { period = 'last_30_days' } = req.query;
    
    const report = await complianceService.generateComplianceReport();
    
    const analytics = {
      period,
      complianceScore: report.summary.complianceScore,
      totalViolations: report.summary.totalViolations,
      openViolations: report.summary.openViolations,
      violationsByCategory: report.violationsByCategory,
      violationsBySeverity: report.violationsBySeverity,
      complianceTrends: report.complianceTrends,
      recommendations: report.recommendations,
      topViolations: report.topViolations
    };

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Get compliance analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get compliance analytics',
      error: error.message
    });
  }
});

// Get audit trail
router.get('/audit-trail', [
  auth,
  checkCompliancePermission,
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isString()
], async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    
    let auditTrail = complianceService.auditTrail;
    
    if (type) {
      auditTrail = auditTrail.filter(entry => entry.type === type);
    }
    
    // Sort by timestamp (newest first)
    auditTrail.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const paginatedTrail = auditTrail.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: {
        auditTrail: paginatedTrail,
        total: auditTrail.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get audit trail error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve audit trail',
      error: error.message
    });
  }
});

// Compliance dashboard
router.get('/dashboard', [
  auth,
  checkCompliancePermission
], async (req, res) => {
  try {
    const status = complianceService.getComplianceStatus();
    const report = await complianceService.generateComplianceReport();
    
    const dashboard = {
      overview: status,
      summary: report.summary,
      recentViolations: complianceService.violations
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10),
      criticalAlerts: complianceService.violations
        .filter(v => v.severity === 'critical' && v.status === 'open')
        .slice(0, 5),
      complianceTrend: report.complianceTrends.slice(-7), // Last 7 days
      recommendations: report.recommendations.slice(0, 5), // Top 5 recommendations
      rulesStatus: report.rulesStatus
    };

    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Compliance dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve compliance dashboard',
      error: error.message
    });
  }
});

// Process compliance event (for integration with other services)
router.post('/events', [
  auth,
  body('eventType').isString(),
  body('userId').optional().isString(),
  body('resource').optional().isString(),
  body('data').optional().isObject(),
  body('metadata').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const event = {
      ...req.body,
      timestamp: new Date(),
      source: 'api',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent')
    };

    // This would trigger a compliance check for the specific event
    // For now, just acknowledge receipt
    res.json({
      success: true,
      message: 'Compliance event processed',
      data: { eventId: event.id, timestamp: event.timestamp }
    });
  } catch (error) {
    console.error('Process compliance event error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process compliance event',
      error: error.message
    });
  }
});

// Health check for compliance service
router.get('/health', async (req, res) => {
  try {
    const status = complianceService.getComplianceStatus();
    
    res.json({
      success: true,
      message: 'Compliance service is healthy',
      data: {
        initialized: complianceService.isInitialized,
        rulesLoaded: complianceService.rules.size,
        violationsCount: complianceService.violations.length,
        complianceScore: status.score,
        lastCheck: status.lastCheck,
        nextCheck: status.nextCheck
      }
    });
  } catch (error) {
    console.error('Compliance service health check error:', error);
    res.status(500).json({
      success: false,
      message: 'Compliance service health check failed',
      error: error.message
    });
  }
});

module.exports = router;
