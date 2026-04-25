const express = require('express');
const router = express.Router();
const ComplianceRule = require('../models/ComplianceRule');
const ComplianceViolation = require('../models/ComplianceViolation');
const complianceService = require('../services/complianceService');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Get compliance dashboard
router.get('/dashboard', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const report = await complianceService.getComplianceReport(start, end);
    const openViolations = await ComplianceViolation.getOpenViolations();
    const trendingViolations = await ComplianceViolation.getTrendingViolations(30);
    
    res.json({
      success: true,
      data: {
        report,
        openViolations,
        trendingViolations,
        summary: {
          totalRules: report.rules.length,
          activeViolations: openViolations.length,
          criticalViolations: openViolations.filter(v => v.severity === 'critical').length,
          highViolations: openViolations.filter(v => v.severity === 'high').length
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get compliance rules
router.get('/rules', auth, async (req, res) => {
  try {
    const { category, ruleType, severity, isActive } = req.query;
    
    const filters = {};
    if (category) filters.category = category;
    if (ruleType) filters.ruleType = ruleType;
    if (severity) filters.severity = severity;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const rules = await ComplianceRule.getActiveRules(filters);
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create compliance rule
router.post('/rules', auth, [
  body('ruleId').notEmpty().withMessage('Rule ID is required'),
  body('name').notEmpty().withMessage('Rule name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('category').isIn(['hipaa', 'gdpr', 'sox', 'pci-dss', 'custom']).withMessage('Invalid category'),
  body('ruleType').isIn(['data-access', 'data-retention', 'authentication', 'authorization', 'audit', 'encryption', 'custom']).withMessage('Invalid rule type'),
  body('severity').isIn(['low', 'medium', 'high', 'critical']).withMessage('Invalid severity'),
  body('ruleExpression').notEmpty().withMessage('Rule expression is required'),
  body('enforcementAction').isIn(['alert', 'block', 'log-only', 'escalate']).withMessage('Invalid enforcement action')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const ruleData = {
      ...req.body,
      updatedBy: req.user.id
    };

    const rule = await ComplianceRule.create(ruleData);
    
    res.status(201).json({
      success: true,
      data: rule
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: 'Rule ID already exists' });
    }
    res.status(500).json({ error: error.message });
  }
});

// Update compliance rule
router.put('/rules/:ruleId', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.findOne({ ruleId: req.params.ruleId });
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    // Generate new version
    const currentVersion = rule.version.split('.');
    const newVersion = `${currentVersion[0]}.${parseInt(currentVersion[1]) + 1}.0`;

    const updatedRule = await ComplianceRule.findOneAndUpdate(
      { ruleId: req.params.ruleId },
      {
        ...req.body,
        version: newVersion,
        lastUpdated: new Date(),
        updatedBy: req.user.id
      },
      { new: true }
    );

    res.json({
      success: true,
      data: updatedRule
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate compliance rule
router.delete('/rules/:ruleId', auth, async (req, res) => {
  try {
    const rule = await ComplianceRule.findOne({ ruleId: req.params.ruleId });
    if (!rule) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    await rule.deactivate();
    
    res.json({
      success: true,
      message: 'Rule deactivated successfully'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get violations
router.get('/violations', auth, async (req, res) => {
  try {
    const { status, severity, category, userId, startDate, endDate, page = 1, limit = 20 } = req.query;
    
    const filters = {};
    if (status) filters.status = status;
    if (severity) filters.severity = severity;
    if (category) filters.category = category;
    if (userId) filters.userId = userId;
    
    const violations = await ComplianceViolation.getOpenViolations(filters);
    
    // Apply pagination
    const startIndex = (page - 1) * limit;
    const paginatedViolations = violations.slice(startIndex, startIndex + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        violations: paginatedViolations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: violations.length,
          pages: Math.ceil(violations.length / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get violation details
router.get('/violations/:violationId', auth, async (req, res) => {
  try {
    const violation = await ComplianceViolation.findOne({ violationId: req.params.violationId })
      .populate('context.userId', 'username email role')
      .populate('ruleId', 'name description category')
      .populate('relatedViolations')
      .populate('auditLogs');
    
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }
    
    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Resolve violation
router.post('/violations/:violationId/resolve', auth, [
  body('resolutionNotes').notEmpty().withMessage('Resolution notes are required'),
  body('correctiveActions').isArray().withMessage('Corrective actions must be an array'),
  body('preventiveActions').isArray().withMessage('Preventive actions must be an array')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const violation = await ComplianceViolation.findOne({ violationId: req.params.violationId });
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    await violation.resolve(req.user.id, req.body.resolutionNotes);
    
    if (req.body.correctiveActions) {
      violation.resolution.correctiveActions = req.body.correctiveActions;
    }
    if (req.body.preventiveActions) {
      violation.resolution.preventiveActions = req.body.preventiveActions;
    }
    
    await violation.save();
    
    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Escalate violation
router.post('/violations/:violationId/escalate', auth, [
  body('level').isInt({ min: 1 }).withMessage('Escalation level must be a positive integer'),
  body('escalatedTo').isArray().withMessage('Escalated to must be an array'),
  body('escalationReason').notEmpty().withMessage('Escalation reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const violation = await ComplianceViolation.findOne({ violationId: req.params.violationId });
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    await violation.escalate(
      req.body.level,
      req.body.escalatedTo,
      req.body.escalationReason
    );
    
    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mark violation as false positive
router.post('/violations/:violationId/false-positive', auth, [
  body('reason').notEmpty().withMessage('Reason is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const violation = await ComplianceViolation.findOne({ violationId: req.params.violationId });
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    await violation.markAsFalsePositive(req.user.id, req.body.reason);
    
    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Acknowledge alert
router.post('/violations/:violationId/acknowledge', auth, async (req, res) => {
  try {
    const violation = await ComplianceViolation.findOne({ violationId: req.params.violationId });
    if (!violation) {
      return res.status(404).json({ error: 'Violation not found' });
    }

    await violation.acknowledgeAlert(req.user.id);
    
    res.json({
      success: true,
      data: violation
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get compliance statistics
router.get('/stats', auth, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const violationStats = await ComplianceViolation.getViolationStats(start, end);
    const trendingViolations = await ComplianceViolation.getTrendingViolations(30);
    
    // Get rule statistics
    const rules = await ComplianceRule.find({ isActive: true });
    const ruleStats = {
      totalRules: rules.length,
      rulesByCategory: {},
      rulesBySeverity: {},
      rulesByType: {}
    };
    
    rules.forEach(rule => {
      ruleStats.rulesByCategory[rule.category] = (ruleStats.rulesByCategory[rule.category] || 0) + 1;
      ruleStats.rulesBySeverity[rule.severity] = (ruleStats.rulesBySeverity[rule.severity] || 0) + 1;
      ruleStats.rulesByType[rule.ruleType] = (ruleStats.rulesByType[rule.ruleType] || 0) + 1;
    });
    
    res.json({
      success: true,
      data: {
        violationStats,
        trendingViolations,
        ruleStats,
        period: { startDate: start, endDate: end }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate compliance report
router.get('/report', auth, async (req, res) => {
  try {
    const { startDate, endDate, format = 'json' } = req.query;
    
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const end = endDate ? new Date(endDate) : new Date();
    
    const report = await complianceService.getComplianceReport(start, end);
    
    if (format === 'pdf') {
      // Generate PDF report (would need a PDF library like pdfkit)
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="compliance-report-${start.toISOString().split('T')[0]}.pdf"`);
      // PDF generation logic here
      res.json({ message: 'PDF generation not implemented yet' });
    } else {
      res.json({
        success: true,
        data: report
      });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Manual compliance check
router.post('/check', auth, [
  body('action').notEmpty().withMessage('Action is required'),
  body('resourceType').notEmpty().withMessage('Resource type is required'),
  body('resourceId').notEmpty().withMessage('Resource ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const context = {
      ...req.body,
      userId: req.user.id,
      userRole: req.user.role,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID,
      timestamp: new Date(),
      location: req.user.location || null,
      compliance: req.body.compliance || {}
    };

    const violations = await complianceService.checkCompliance(context);
    
    res.json({
      success: true,
      data: {
        violations,
        totalViolations: violations.length,
        criticalViolations: violations.filter(v => v.severity === 'critical').length,
        highViolations: violations.filter(v => v.severity === 'high').length
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
