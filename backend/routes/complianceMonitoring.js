const express = require('express');
const router = express.Router();
const ComplianceMonitoringService = require('../services/complianceMonitoringService');
const RegulatoryRuleEngine = require('../services/regulatoryRuleEngine');

// Initialize services (will be injected from server.js)
let complianceService = null;
let ruleEngine = null;

// Middleware to initialize services if not already done
const initializeServices = (req, res, next) => {
  if (!complianceService && req.app.locals.complianceService) {
    complianceService = req.app.locals.complianceService;
  }
  if (!ruleEngine && req.app.locals.ruleEngine) {
    ruleEngine = req.app.locals.ruleEngine;
  }
  next();
};

router.use(initializeServices);

/**
 * GET /api/compliance/status
 * Get current compliance monitoring status
 */
router.get('/status', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const status = {
      monitoring: complianceService.monitoringInterval ? 'active' : 'inactive',
      metrics: complianceService.getComplianceMetrics(),
      lastCheck: complianceService.metrics.lastCheck,
      activeRules: ruleEngine ? ruleEngine.getRuleMetrics() : null
    };

    res.json(status);
  } catch (error) {
    console.error('[Compliance] Error getting status:', error);
    res.status(500).json({ error: 'Failed to get compliance status' });
  }
});

/**
 * POST /api/compliance/monitoring/start
 * Start continuous compliance monitoring
 */
router.post('/monitoring/start', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { intervalMs = 60000 } = req.body;
    complianceService.startMonitoring(intervalMs);

    res.json({ 
      message: 'Compliance monitoring started',
      intervalMs,
      status: 'active'
    });
  } catch (error) {
    console.error('[Compliance] Error starting monitoring:', error);
    res.status(500).json({ error: 'Failed to start compliance monitoring' });
  }
});

/**
 * POST /api/compliance/monitoring/stop
 * Stop continuous compliance monitoring
 */
router.post('/monitoring/stop', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    complianceService.stopMonitoring();

    res.json({ 
      message: 'Compliance monitoring stopped',
      status: 'inactive'
    });
  } catch (error) {
    console.error('[Compliance] Error stopping monitoring:', error);
    res.status(500).json({ error: 'Failed to stop compliance monitoring' });
  }
});

/**
 * POST /api/compliance/check
 * Perform manual compliance check
 */
router.post('/check', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { entityType, entityId } = req.body;

    let results;
    if (entityType && entityId) {
      // Check specific entity
      const entity = await getEntityById(entityType, entityId);
      if (!entity) {
        return res.status(404).json({ error: 'Entity not found' });
      }
      results = await complianceService.checkEntityCompliance(entity);
    } else {
      // Check all entities
      results = await complianceService.performComplianceCheck();
    }

    res.json(results);
  } catch (error) {
    console.error('[Compliance] Error performing check:', error);
    res.status(500).json({ error: 'Failed to perform compliance check' });
  }
});

/**
 * GET /api/compliance/violations
 * Get compliance violations
 */
router.get('/violations', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { 
      status = 'open', 
      severity, 
      entityType, 
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT * FROM compliance_violations 
      WHERE status = ?
    `;
    const params = [status];

    if (severity) {
      query += ' AND severity = ?';
      params.push(severity);
    }

    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }

    query += ' ORDER BY detected_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const violations = await new Promise((resolve, reject) => {
      complianceService.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      violations,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: violations.length
      }
    });
  } catch (error) {
    console.error('[Compliance] Error getting violations:', error);
    res.status(500).json({ error: 'Failed to get violations' });
  }
});

/**
 * POST /api/compliance/violations/:violationId/resolve
 * Resolve a compliance violation
 */
router.post('/violations/:violationId/resolve', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { violationId } = req.params;
    const { resolvedBy, notes } = req.body;

    if (!resolvedBy) {
      return res.status(400).json({ error: 'resolvedBy is required' });
    }

    await complianceService.resolveViolation(violationId, resolvedBy, notes);

    res.json({
      message: 'Violation resolved successfully',
      violationId,
      resolvedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Compliance] Error resolving violation:', error);
    res.status(500).json({ error: 'Failed to resolve violation' });
  }
});

/**
 * GET /api/compliance/rules
 * Get compliance rules
 */
router.get('/rules', async (req, res) => {
  try {
    if (!ruleEngine) {
      return res.status(503).json({ error: 'Rule engine not initialized' });
    }

    const { framework, category, enabled } = req.query;

    let rules = Array.from(ruleEngine.rules.values());

    // Filter by framework
    if (framework) {
      rules = rules.filter(rule => rule.regulatoryFramework === framework);
    }

    // Filter by category
    if (category) {
      rules = rules.filter(rule => rule.category === category);
    }

    // Filter by enabled status
    if (enabled !== undefined) {
      const isEnabled = enabled === 'true';
      rules = rules.filter(rule => rule.enabled === isEnabled);
    }

    res.json({
      rules: rules.map(rule => ({
        ruleId: rule.ruleId || rule.id,
        name: rule.name,
        description: rule.description,
        framework: rule.regulatoryFramework,
        category: rule.category,
        severity: rule.severity,
        enabled: rule.enabled,
        lastUpdated: rule.lastUpdated
      })),
      total: rules.length
    });
  } catch (error) {
    console.error('[Compliance] Error getting rules:', error);
    res.status(500).json({ error: 'Failed to get rules' });
  }
});

/**
 * POST /api/compliance/rules
 * Add new compliance rule
 */
router.post('/rules', async (req, res) => {
  try {
    if (!ruleEngine) {
      return res.status(503).json({ error: 'Rule engine not initialized' });
    }

    const { ruleId, name, description, framework, category, condition, action, severity } = req.body;

    if (!ruleId || !name || !condition || !action) {
      return res.status(400).json({ error: 'Missing required fields: ruleId, name, condition, action' });
    }

    // Convert string functions to actual functions
    const conditionFn = typeof condition === 'string' ? eval(`(${condition})`) : condition;
    const actionFn = typeof action === 'string' ? eval(`(${action})`) : action;

    const rule = ruleEngine.addRegulatoryRule(ruleId, {
      name,
      description,
      regulatoryFramework: framework,
      category,
      condition: conditionFn,
      action: actionFn,
      severity: severity || 'medium'
    });

    res.status(201).json({
      message: 'Rule added successfully',
      rule: {
        ruleId: rule.ruleId,
        name: rule.name,
        framework: rule.regulatoryFramework,
        category: rule.category,
        enabled: rule.enabled
      }
    });
  } catch (error) {
    console.error('[Compliance] Error adding rule:', error);
    res.status(500).json({ error: 'Failed to add rule' });
  }
});

/**
 * PUT /api/compliance/rules/:ruleId
 * Update compliance rule
 */
router.put('/rules/:ruleId', async (req, res) => {
  try {
    if (!ruleEngine) {
      return res.status(503).json({ error: 'Rule engine not initialized' });
    }

    const { ruleId } = req.params;
    const updates = req.body;

    const updatedRule = await ruleEngine.updateRule(ruleId, updates);

    res.json({
      message: 'Rule updated successfully',
      rule: {
        ruleId: updatedRule.ruleId,
        name: updatedRule.name,
        version: updatedRule.version,
        lastUpdated: updatedRule.lastUpdated
      }
    });
  } catch (error) {
    console.error('[Compliance] Error updating rule:', error);
    res.status(500).json({ error: 'Failed to update rule' });
  }
});

/**
 * POST /api/compliance/rules/:ruleId/toggle
 * Enable/disable rule
 */
router.post('/rules/:ruleId/toggle', async (req, res) => {
  try {
    if (!ruleEngine) {
      return res.status(503).json({ error: 'Rule engine not initialized' });
    }

    const { ruleId } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      return res.status(400).json({ error: 'enabled is required' });
    }

    const rule = ruleEngine.toggleRule(ruleId, enabled);

    res.json({
      message: `Rule ${enabled ? 'enabled' : 'disabled'} successfully`,
      rule: {
        ruleId: rule.ruleId,
        enabled: rule.enabled,
        lastUpdated: rule.lastUpdated
      }
    });
  } catch (error) {
    console.error('[Compliance] Error toggling rule:', error);
    res.status(500).json({ error: 'Failed to toggle rule' });
  }
});

/**
 * GET /api/compliance/reports
 * Get compliance reports
 */
router.get('/reports', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { type, startDate, endDate, limit = 10 } = req.query;

    let query = `
      SELECT * FROM compliance_reports 
      WHERE 1=1
    `;
    const params = [];

    if (type) {
      query += ' AND report_type = ?';
      params.push(type);
    }

    if (startDate) {
      query += ' AND period_start >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND period_end <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY generated_at DESC LIMIT ?';
    params.push(parseInt(limit));

    const reports = await new Promise((resolve, reject) => {
      complianceService.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    // Parse JSON details for each report
    const reportsWithDetails = reports.map(report => ({
      ...report,
      details: JSON.parse(report.details || '{}')
    }));

    res.json({
      reports: reportsWithDetails,
      total: reportsWithDetails.length
    });
  } catch (error) {
    console.error('[Compliance] Error getting reports:', error);
    res.status(500).json({ error: 'Failed to get reports' });
  }
});

/**
 * POST /api/compliance/reports/generate
 * Generate compliance report
 */
router.post('/reports/generate', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { type = 'daily', startDate, endDate } = req.body;

    const report = await complianceService.generateComplianceReport(type, startDate, endDate);

    res.status(201).json({
      message: 'Report generated successfully',
      report
    });
  } catch (error) {
    console.error('[Compliance] Error generating report:', error);
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

/**
 * GET /api/compliance/audit
 * Get audit trail
 */
router.get('/audit', async (req, res) => {
  try {
    if (!complianceService) {
      return res.status(503).json({ error: 'Compliance service not initialized' });
    }

    const { 
      action, 
      entityType, 
      startDate, 
      endDate, 
      limit = 100, 
      offset = 0 
    } = req.query;

    let query = `
      SELECT * FROM compliance_audit_trail 
      WHERE 1=1
    `;
    const params = [];

    if (action) {
      query += ' AND action = ?';
      params.push(action);
    }

    if (entityType) {
      query += ' AND entity_type = ?';
      params.push(entityType);
    }

    if (startDate) {
      query += ' AND timestamp >= ?';
      params.push(startDate);
    }

    if (endDate) {
      query += ' AND timestamp <= ?';
      params.push(endDate);
    }

    query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const auditEntries = await new Promise((resolve, reject) => {
      complianceService.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });

    res.json({
      auditEntries,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: auditEntries.length
      }
    });
  } catch (error) {
    console.error('[Compliance] Error getting audit trail:', error);
    res.status(500).json({ error: 'Failed to get audit trail' });
  }
});

/**
 * GET /api/compliance/frameworks
 * Get supported regulatory frameworks
 */
router.get('/frameworks', async (req, res) => {
  try {
    if (!ruleEngine) {
      return res.status(503).json({ error: 'Rule engine not initialized' });
    }

    const frameworks = ruleEngine.getComplianceSummaryByFramework();
    res.json(frameworks);
  } catch (error) {
    console.error('[Compliance] Error getting frameworks:', error);
    res.status(500).json({ error: 'Failed to get frameworks' });
  }
});

/**
 * GET /api/compliance/categories
 * Get compliance categories
 */
router.get('/categories', async (req, res) => {
  try {
    if (!ruleEngine) {
      return res.status(503).json({ error: 'Rule engine not initialized' });
    }

    const categories = ruleEngine.getComplianceSummaryByCategory();
    res.json(categories);
  } catch (error) {
    console.error('[Compliance] Error getting categories:', error);
    res.status(500).json({ error: 'Failed to get categories' });
  }
});

/**
 * GET /api/compliance/metrics
 * Get detailed compliance metrics
 */
router.get('/metrics', async (req, res) => {
  try {
    if (!complianceService || !ruleEngine) {
      return res.status(503).json({ error: 'Services not initialized' });
    }

    const complianceMetrics = complianceService.getComplianceMetrics();
    const ruleMetrics = ruleEngine.getRuleMetrics();
    const frameworkSummary = ruleEngine.getComplianceSummaryByFramework();
    const categorySummary = ruleEngine.getComplianceSummaryByCategory();

    res.json({
      compliance: complianceMetrics,
      rules: ruleMetrics,
      frameworks: frameworkSummary,
      categories: categorySummary,
      generatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Compliance] Error getting metrics:', error);
    res.status(500).json({ error: 'Failed to get metrics' });
  }
});

/**
 * Helper function to get entity by ID
 */
async function getEntityById(entityType, entityId) {
  if (!complianceService) return null;

  const tableName = entityType === 'patient' ? 'patients' : 
                   entityType === 'provider' ? 'providers' : 
                   entityType === 'claim' ? 'claims' : null;

  if (!tableName) return null;

  return new Promise((resolve, reject) => {
    complianceService.db.get(
      `SELECT * FROM ${tableName} WHERE id = ?`,
      [entityId],
      (err, row) => {
        if (err) reject(err);
        else resolve(row ? { ...row, type: entityType } : null);
      }
    );
  });
}

module.exports = router;
