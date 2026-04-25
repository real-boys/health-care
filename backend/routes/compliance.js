/**
 * Compliance Monitoring API Routes
 * Provides endpoints for compliance management, monitoring, and reporting
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const ComplianceMonitoringService = require('../services/complianceMonitoringService');
const auth = require('../middleware/auth');

const router = express.Router();
const complianceService = new ComplianceMonitoringService();

/**
 * GET /api/compliance/status
 * Get current compliance status and metrics
 */
router.get('/status', auth, async (req, res) => {
  try {
    const status = await complianceService.getComplianceStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching compliance status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch compliance status'
    });
  }
});

/**
 * GET /api/compliance/violations
 * Get list of compliance violations
 */
router.get('/violations', auth, [
  query('status').optional().isIn(['open', 'resolved', 'all']).withMessage('Invalid status'),
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { status = 'open', severity, limit = 50, offset = 0 } = req.query;
    
    let violations = Array.from(complianceService.activeViolations.values());
    
    // Filter by status
    if (status !== 'all') {
      violations = violations.filter(v => v.status === status);
    }
    
    // Filter by severity
    if (severity) {
      violations = violations.filter(v => v.severity === severity);
    }
    
    // Sort by detection date (newest first)
    violations.sort((a, b) => new Date(b.detectedAt) - new Date(a.detectedAt));
    
    // Apply pagination
    const paginatedViolations = violations.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        violations: paginatedViolations,
        total: violations.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching violations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch violations'
    });
  }
});

/**
 * POST /api/compliance/violations/:violationId/resolve
 * Resolve a compliance violation
 */
router.post('/violations/:violationId/resolve', auth, [
  param('violationId').notEmpty().withMessage('Violation ID is required'),
  body('notes').optional().isString().withMessage('Notes must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { violationId } = req.params;
    const { notes } = req.body;
    const resolvedBy = req.user.id;

    const violation = await complianceService.resolveViolation(violationId, resolvedBy, notes);
    
    res.json({
      success: true,
      data: violation,
      message: 'Violation resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving violation:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resolve violation'
    });
  }
});

/**
 * GET /api/compliance/rules
 * Get list of regulatory rules
 */
router.get('/rules', auth, async (req, res) => {
  try {
    const rules = Array.from(complianceService.regulatoryRules.values());
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch rules'
    });
  }
});

/**
 * POST /api/compliance/rules
 * Add a new regulatory rule
 */
router.post('/rules', auth, [
  body('name').notEmpty().withMessage('Rule name is required'),
  body('category').notEmpty().withMessage('Rule category is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('severity').isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  body('ruleDefinition').notEmpty().withMessage('Rule definition is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const ruleData = req.body;

    complianceService.addRegulatoryRule(ruleId, ruleData);
    
    res.status(201).json({
      success: true,
      data: { id: ruleId, ...ruleData },
      message: 'Regulatory rule added successfully'
    });
  } catch (error) {
    console.error('Error adding rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add rule'
    });
  }
});

/**
 * PUT /api/compliance/rules/:ruleId
 * Update a regulatory rule
 */
router.put('/rules/:ruleId', auth, [
  param('ruleId').notEmpty().withMessage('Rule ID is required'),
  body('name').optional().isString().withMessage('Rule name must be a string'),
  body('category').optional().isString().withMessage('Rule category must be a string'),
  body('description').optional().isString().withMessage('Description must be a string'),
  body('severity').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  body('isActive').optional().isBoolean().withMessage('isActive must be a boolean')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { ruleId } = req.params;
    const updates = req.body;

    const updatedRule = await complianceService.updateRegulatoryRule(ruleId, updates);
    
    res.json({
      success: true,
      data: updatedRule,
      message: 'Regulatory rule updated successfully'
    });
  } catch (error) {
    console.error('Error updating rule:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to update rule'
    });
  }
});

/**
 * GET /api/compliance/reports
 * Get compliance reports
 */
router.get('/reports', auth, [
  query('type').optional().isIn(['daily', 'weekly', 'monthly']).withMessage('Invalid report type'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { type, limit = 50 } = req.query;
    
    const reports = await complianceService.getComplianceReports(type, parseInt(limit));
    
    res.json({
      success: true,
      data: reports
    });
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch reports'
    });
  }
});

/**
 * POST /api/compliance/reports/generate
 * Generate a new compliance report
 */
router.post('/reports/generate', auth, [
  body('reportType').isIn(['daily', 'weekly', 'monthly', 'custom']).withMessage('Invalid report type'),
  body('periodStart').optional().isISO8601().withMessage('Invalid period start date'),
  body('periodEnd').optional().isISO8601().withMessage('Invalid period end date')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { reportType, periodStart, periodEnd } = req.body;
    
    let reportId;
    if (reportType === 'daily') {
      await complianceService.generateDailyReport();
      reportId = `daily_${Date.now()}`;
    } else if (reportType === 'weekly') {
      await complianceService.generateWeeklyReport();
      reportId = `weekly_${Date.now()}`;
    } else {
      // For custom reports, implement custom generation logic
      return res.status(501).json({
        success: false,
        error: 'Custom report generation not yet implemented'
      });
    }
    
    res.json({
      success: true,
      data: { reportId, reportType },
      message: 'Report generation initiated'
    });
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate report'
    });
  }
});

/**
 * GET /api/compliance/analytics
 * Get compliance analytics and trends
 */
router.get('/analytics', auth, [
  query('period').optional().isIn(['7d', '30d', '90d', '1y']).withMessage('Invalid period')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { period = '30d' } = req.query;
    
    // Calculate period start date
    const periodEnd = new Date();
    const periodStart = new Date();
    
    switch (period) {
      case '7d':
        periodStart.setDate(periodStart.getDate() - 7);
        break;
      case '30d':
        periodStart.setDate(periodStart.getDate() - 30);
        break;
      case '90d':
        periodStart.setDate(periodStart.getDate() - 90);
        break;
      case '1y':
        periodStart.setFullYear(periodStart.getFullYear() - 1);
        break;
    }
    
    const reportData = await complianceService.compileReportData(periodStart, periodEnd);
    const complianceScore = complianceService.calculateComplianceScore(reportData);
    
    const analytics = {
      period,
      complianceScore,
      totalViolations: reportData.violations.length,
      violationsBySeverity: reportData.periodStats?.bySeverity || {},
      violationsByCategory: reportData.periodStats?.byCategory || {},
      violationsByType: reportData.periodStats?.byType || {},
      resolvedVsOpen: {
        resolved: reportData.periodStats?.resolved || 0,
        open: reportData.periodStats?.open || 0
      },
      trends: await this.calculateTrends(periodStart, periodEnd)
    };
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch analytics'
    });
  }
});

/**
 * POST /api/compliance/audit
 * Trigger manual compliance audit
 */
router.post('/audit', auth, [
  body('scope').optional().isArray().withMessage('Scope must be an array'),
  body('rules').optional().isArray().withMessage('Rules must be an array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { scope, rules } = req.body;
    
    // Run compliance checks
    await complianceService.runComplianceChecks();
    
    res.json({
      success: true,
      message: 'Compliance audit initiated'
    });
  } catch (error) {
    console.error('Error running audit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to run audit'
    });
  }
});

/**
 * GET /api/compliance/audit-trail
 * Get compliance audit trail
 */
router.get('/audit-trail', auth, [
  query('entityType').optional().isString().withMessage('Entity type must be a string'),
  query('entityId').optional().isString().withMessage('Entity ID must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { entityType, entityId, limit = 50, offset = 0 } = req.query;
    
    // Query audit trail from database
    let query = 'SELECT * FROM compliance_audit_trail';
    const params = [];
    const conditions = [];

    if (entityType) {
      conditions.push('entity_type = ?');
      params.push(entityType);
    }

    if (entityId) {
      conditions.push('entity_id = ?');
      params.push(entityId);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    complianceService.db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching audit trail:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch audit trail'
        });
      } else {
        res.json({
          success: true,
          data: rows.map(row => ({
            ...row,
            new_values: row.new_values ? JSON.parse(row.new_values) : null,
            old_values: row.old_values ? JSON.parse(row.old_values) : null
          }))
        });
      }
    });
  } catch (error) {
    console.error('Error fetching audit trail:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch audit trail'
    });
  }
});

/**
 * Calculate compliance trends
 */
async function calculateTrends(periodStart, periodEnd) {
  // This would typically query historical data to calculate trends
  // For now, return placeholder data
  return {
    violationsTrend: 'decreasing', // 'increasing', 'decreasing', 'stable'
    complianceScoreTrend: 'improving', // 'improving', 'declining', 'stable'
    resolvedRateTrend: 'improving'
  };
}

module.exports = router;
