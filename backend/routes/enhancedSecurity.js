/**
 * Enhanced Security Monitoring API Routes
 * Provides endpoints for security monitoring, threat detection, and incident response
 */

const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const EnhancedSecurityMonitoringService = require('../services/enhancedSecurityMonitoringService');
const auth = require('../middleware/auth');

const router = express.Router();
const securityService = new EnhancedSecurityMonitoringService();

/**
 * GET /api/enhanced-security/status
 * Get current security status and metrics
 */
router.get('/status', auth, async (req, res) => {
  try {
    const status = await securityService.getHealthStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Error fetching security status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security status'
    });
  }
});

/**
 * GET /api/enhanced-security/incidents
 * Get security incidents
 */
router.get('/incidents', auth, [
  query('status').optional().isIn(['open', 'resolved', 'closed']).withMessage('Invalid status'),
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
  query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
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
    const filters = {};
    if (req.query.status) filters.status = req.query.status;
    if (req.query.severity) filters.severity = req.query.severity;
    if (req.query.dateFrom) filters.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) filters.dateTo = req.query.dateTo;

    const incidents = await securityService.getSecurityIncidents(filters);
    
    res.json({
      success: true,
      data: incidents
    });
  } catch (error) {
    console.error('Error fetching security incidents:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security incidents'
    });
  }
});

/**
 * POST /api/enhanced-security/incidents/:incidentId/resolve
 * Resolve a security incident
 */
router.post('/incidents/:incidentId/resolve', auth, [
  param('incidentId').notEmpty().withMessage('Incident ID is required'),
  body('containmentActions').optional().isArray().withMessage('Containment actions must be an array'),
  body('rootCause').optional().isString().withMessage('Root cause must be a string'),
  body('lessonsLearned').optional().isString().withMessage('Lessons learned must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { incidentId } = req.params;
    const resolvedBy = req.user.id;
    const resolutionData = req.body;

    const incident = await securityService.resolveSecurityIncident(incidentId, resolvedBy, resolutionData);
    
    res.json({
      success: true,
      data: incident,
      message: 'Security incident resolved successfully'
    });
  } catch (error) {
    console.error('Error resolving security incident:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to resolve security incident'
    });
  }
});

/**
 * GET /api/enhanced-security/threats
 * Get threat intelligence data
 */
router.get('/threats', auth, [
  query('threatType').optional().isString().withMessage('Threat type must be a string'),
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
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
    const filters = {};
    if (req.query.threatType) filters.threatType = req.query.threatType;
    if (req.query.severity) filters.severity = req.query.severity;

    const threats = await securityService.getThreatIntelligence(filters);
    
    res.json({
      success: true,
      data: threats
    });
  } catch (error) {
    console.error('Error fetching threat intelligence:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threat intelligence'
    });
  }
});

/**
 * POST /api/enhanced-security/threats
 * Add threat intelligence indicator
 */
router.post('/threats', auth, [
  body('threatType').notEmpty().withMessage('Threat type is required'),
  body('indicator').notEmpty().withMessage('Indicator is required'),
  body('indicatorType').isIn(['ip', 'domain', 'url', 'hash', 'email']).withMessage('Invalid indicator type'),
  body('severity').isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  body('source').notEmpty().withMessage('Source is required'),
  body('confidence').optional().isFloat({ min: 0, max: 1 }).withMessage('Confidence must be between 0 and 1')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Only allow security team to add threats
    if (req.user.role !== 'admin' && req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        error: 'Security access required'
      });
    }

    await securityService.addThreatIndicator(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Threat indicator added successfully'
    });
  } catch (error) {
    console.error('Error adding threat indicator:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add threat indicator'
    });
  }
});

/**
 * GET /api/enhanced-security/vulnerabilities
 * Get vulnerability scan results
 */
router.get('/vulnerabilities', auth, [
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
    const limit = req.query.limit ? parseInt(req.query.limit) : 50;
    const vulnerabilities = await securityService.getVulnerabilityScans(limit);
    
    res.json({
      success: true,
      data: vulnerabilities
    });
  } catch (error) {
    console.error('Error fetching vulnerability scans:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch vulnerability scans'
    });
  }
});

/**
 * POST /api/enhanced-security/vulnerabilities/scan
 * Trigger vulnerability scan
 */
router.post('/vulnerabilities/scan', auth, [
  body('target').optional().isString().withMessage('Target must be a string'),
  body('scanType').optional().isIn(['full', 'quick', 'targeted']).withMessage('Invalid scan type')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Only allow security team to trigger scans
    if (req.user.role !== 'admin' && req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        error: 'Security access required'
      });
    }

    await securityService.runVulnerabilityScan();
    
    res.json({
      success: true,
      message: 'Vulnerability scan initiated'
    });
  } catch (error) {
    console.error('Error triggering vulnerability scan:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger vulnerability scan'
    });
  }
});

/**
 * GET /api/enhanced-security/analytics
 * Get security analytics and trends
 */
router.get('/analytics', auth, [
  query('period').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid period')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const period = req.query.period || '30d';
    const analytics = await securityService.getSecurityAnalytics(period);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching security analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch security analytics'
    });
  }
});

/**
 * POST /api/enhanced-security/events
 * Record a security event
 */
router.post('/events', auth, [
  body('eventType').notEmpty().withMessage('Event type is required'),
  body('severity').isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  body('action').notEmpty().withMessage('Action is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('sourceIp').optional().isIP().withMessage('Invalid IP address'),
  body('userId').optional().isString().withMessage('User ID must be a string'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const eventData = {
      eventType: req.body.eventType,
      severity: req.body.severity,
      action: req.body.action,
      description: req.body.description,
      sourceIp: req.body.sourceIp,
      userId: req.body.userId,
      metadata: req.body.metadata || {}
    };

    await securityService.recordSecurityEvent(eventData);
    
    res.status(201).json({
      success: true,
      message: 'Security event recorded successfully'
    });
  } catch (error) {
    console.error('Error recording security event:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to record security event'
    });
  }
});

/**
 * GET /api/enhanced-security/rules
 * Get threat detection rules
 */
router.get('/rules', auth, async (req, res) => {
  try {
    const rules = Array.from(securityService.threatDetectionRules.values());
    
    res.json({
      success: true,
      data: rules
    });
  } catch (error) {
    console.error('Error fetching threat detection rules:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch threat detection rules'
    });
  }
});

/**
 * POST /api/enhanced-security/rules
 * Add a new threat detection rule
 */
router.post('/rules', auth, [
  body('name').notEmpty().withMessage('Rule name is required'),
  body('description').notEmpty().withMessage('Description is required'),
  body('severity').isIn(['critical', 'high', 'medium', 'low']).withMessage('Invalid severity'),
  body('condition').notEmpty().withMessage('Condition is required'),
  body('actions').isArray({ min: 1 }).withMessage('Actions must be a non-empty array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Only allow security team to add rules
    if (req.user.role !== 'admin' && req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        error: 'Security access required'
      });
    }

    const ruleId = `rule_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    securityService.addThreatRule(ruleId, req.body);
    
    res.status(201).json({
      success: true,
      data: { id: ruleId, ...req.body },
      message: 'Threat detection rule added successfully'
    });
  } catch (error) {
    console.error('Error adding threat detection rule:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add threat detection rule'
    });
  }
});

/**
 * POST /api/enhanced-security/block-ip
 * Block an IP address
 */
router.post('/block-ip', auth, [
  body('ipAddress').isIP().withMessage('Valid IP address is required'),
  body('reason').optional().isString().withMessage('Reason must be a string'),
  body('duration').optional().isInt({ min: 1, max: 86400 }).withMessage('Duration must be between 1 and 86400 seconds')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Only allow security team to block IPs
    if (req.user.role !== 'admin' && req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        error: 'Security access required'
      });
    }

    const { ipAddress, reason, duration } = req.body;
    await securityService.blockIP(ipAddress);
    
    // Log the action
    await securityService.recordSecurityEvent({
      eventType: 'ip_blocked',
      severity: 'high',
      action: 'block_ip',
      description: `IP ${ipAddress} blocked by ${req.user.id}. Reason: ${reason || 'Security threat'}`,
      sourceIp: ipAddress,
      userId: req.user.id,
      metadata: { reason, duration }
    });
    
    res.json({
      success: true,
      message: 'IP address blocked successfully'
    });
  } catch (error) {
    console.error('Error blocking IP address:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to block IP address'
    });
  }
});

/**
 * GET /api/enhanced-security/siem-logs
 * Get SIEM integration logs (admin only)
 */
router.get('/siem-logs', auth, [
  query('status').optional().isIn(['pending', 'success', 'error']).withMessage('Invalid status'),
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
    // Only allow admins to view SIEM logs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    let query = 'SELECT * FROM siem_logs';
    const params = [];

    if (req.query.status) {
      query += ' WHERE status = ?';
      params.push(req.query.status);
    }

    query += ' ORDER BY timestamp DESC';

    if (req.query.limit) {
      query += ' LIMIT ?';
      params.push(parseInt(req.query.limit));
    }

    securityService.db.all(query, params, (err, rows) => {
      if (err) {
        console.error('Error fetching SIEM logs:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch SIEM logs'
        });
      } else {
        res.json({
          success: true,
          data: rows.map(row => ({
            ...row,
            eventData: JSON.parse(row.event_data || '{}'),
            responseData: row.response_data ? JSON.parse(row.response_data) : null
          }))
        });
      }
    });
  } catch (error) {
    console.error('Error fetching SIEM logs:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch SIEM logs'
    });
  }
});

/**
 * POST /api/enhanced-security/emergency
 * Trigger emergency security response
 */
router.post('/emergency', auth, [
  body('emergencyType').isIn(['lockdown', 'breach_detected', 'system_compromise']).withMessage('Invalid emergency type'),
  body('description').notEmpty().withMessage('Description is required'),
  body('affectedSystems').optional().isArray().withMessage('Affected systems must be an array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Only allow security team to trigger emergency response
    if (req.user.role !== 'admin' && req.user.role !== 'security') {
      return res.status(403).json({
        success: false,
        error: 'Security access required'
      });
    }

    const { emergencyType, description, affectedSystems } = req.body;
    
    // Create high-priority incident
    await securityService.createSecurityIncident({
      name: 'Emergency Response',
      description: `Emergency: ${emergencyType} - ${description}`,
      severity: 'critical'
    }, {
      id: `emergency_${Date.now()}`,
      description: description,
      sourceIp: req.ip,
      userId: req.user.id
    });

    // Log emergency event
    await securityService.recordSecurityEvent({
      eventType: 'emergency_response',
      severity: 'critical',
      action: emergencyType,
      description: `Emergency response triggered: ${emergencyType} - ${description}`,
      sourceIp: req.ip,
      userId: req.user.id,
      metadata: { emergencyType, affectedSystems }
    });
    
    res.json({
      success: true,
      message: 'Emergency response triggered successfully'
    });
  } catch (error) {
    console.error('Error triggering emergency response:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to trigger emergency response'
    });
  }
});

module.exports = router;
