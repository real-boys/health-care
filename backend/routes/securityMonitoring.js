const express = require('express');
const router = express.Router();
const EnhancedSecurityMonitoringService = require('../services/enhancedSecurityMonitoringService');
const auth = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');

// Initialize enhanced security monitoring service
const securityService = new EnhancedSecurityMonitoringService({
  siemEndpoint: process.env.SIEM_ENDPOINT,
  siemApiKey: process.env.SIEM_API_KEY,
  threatIntelApiKey: process.env.THREAT_INTEL_API_KEY,
  autoBlockIPs: process.env.AUTO_BLOCK_IPS === 'true',
  autoLockAccounts: process.env.AUTO_LOCK_ACCOUNTS === 'true',
  notifyAdmins: process.env.NOTIFY_ADMINS !== 'false'
});

// Initialize security service on startup
securityService.initialize().catch(console.error);

// Middleware to check security monitoring permissions
const checkSecurityPermission = (req, res, next) => {
  const userRole = req.user?.role;
  const allowedRoles = ['admin', 'system_admin', 'security_analyst'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for security monitoring operations'
    });
  }
  
  next();
};

// Process security event
router.post('/events', [
  auth,
  checkSecurityPermission,
  body('eventType').isString().isIn(['login_failure', 'login_success', 'mfa_failed', 'mfa_verified', 'account_locked', 'suspicious_activity', 'data_access', 'privilege_escalation']),
  body('userId').optional().isUUID(),
  body('ipAddress').isIP(),
  body('userAgent').optional().isString(),
  body('url').optional().isURL(),
  body('method').optional().isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']),
  body('headers').optional().isObject(),
  body('body').optional().isString(),
  body('query').optional().isObject()
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

    const event = await securityService.processSecurityEvent(req.body);
    
    res.json({
      success: true,
      message: 'Security event processed successfully',
      data: event
    });
  } catch (error) {
    console.error('Security event processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process security event',
      error: error.message
    });
  }
});

// Get security incidents
router.get('/incidents', [
  auth,
  checkSecurityPermission,
  query('status').optional().isIn(['open', 'resolved', 'closed']),
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const { status, severity, limit = 50, offset = 0 } = req.query;
    
    let incidents = securityService.incidents;
    
    // Apply filters
    if (status) {
      incidents = incidents.filter(incident => incident.status === status);
    }
    
    if (severity) {
      incidents = incidents.filter(incident => incident.severity === severity);
    }
    
    // Sort by timestamp (newest first)
    incidents.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply pagination
    const paginatedIncidents = incidents.slice(parseInt(offset), parseInt(offset) + parseInt(limit));
    
    res.json({
      success: true,
      data: {
        incidents: paginatedIncidents,
        total: incidents.length,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Get incidents error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve incidents',
      error: error.message
    });
  }
});

// Get incident details
router.get('/incidents/:incidentId', [
  auth,
  checkSecurityPermission
], async (req, res) => {
  try {
    const { incidentId } = req.params;
    
    const incident = securityService.incidents.find(i => i.id === incidentId);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    res.json({
      success: true,
      data: incident
    });
  } catch (error) {
    console.error('Get incident error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve incident',
      error: error.message
    });
  }
});

// Update incident status
router.patch('/incidents/:incidentId/status', [
  auth,
  checkSecurityPermission,
  body('status').isIn(['open', 'resolved', 'closed']),
  body('notes').optional().isString(),
  body('assignedTo').optional().isEmail()
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

    const { incidentId } = req.params;
    const { status, notes, assignedTo } = req.body;
    
    const incident = securityService.incidents.find(i => i.id === incidentId);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    // Update incident
    incident.status = status;
    if (status === 'resolved' || status === 'closed') {
      incident.metadata.resolvedAt = new Date();
    }
    
    if (notes) {
      incident.notes = notes;
    }
    
    if (assignedTo) {
      incident.metadata.assignedTo = assignedTo;
    }

    res.json({
      success: true,
      message: 'Incident updated successfully',
      data: incident
    });
  } catch (error) {
    console.error('Update incident error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update incident',
      error: error.message
    });
  }
});

// Get security analytics
router.get('/analytics', [
  auth,
  checkSecurityPermission
], async (req, res) => {
  try {
    const analytics = await securityService.generateSecurityAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Security analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate security analytics',
      error: error.message
    });
  }
});

// Get security metrics
router.get('/metrics', [
  auth,
  checkSecurityPermission
], async (req, res) => {
  try {
    const metrics = securityService.getSecurityMetrics();
    
    res.json({
      success: true,
      data: metrics
    });
  } catch (error) {
    console.error('Security metrics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security metrics',
      error: error.message
    });
  }
});

// Perform vulnerability scan
router.post('/vulnerability-scan', [
  auth,
  checkSecurityPermission
], async (req, res) => {
  try {
    const scanResults = await securityService.performVulnerabilityScan();
    
    res.json({
      success: true,
      message: 'Vulnerability scan completed',
      data: scanResults
    });
  } catch (error) {
    console.error('Vulnerability scan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform vulnerability scan',
      error: error.message
    });
  }
});

// Get vulnerability scan results
router.get('/vulnerabilities', [
  auth,
  checkSecurityPermission,
  query('severity').optional().isIn(['critical', 'high', 'medium', 'low']),
  query('limit').optional().isInt({ min: 1, max: 100 })
], async (req, res) => {
  try {
    const { severity, limit = 50 } = req.query;
    
    let vulnerabilities = securityService.vulnerabilities;
    
    // Filter by severity if specified
    if (severity) {
      vulnerabilities = vulnerabilities.filter(scan => 
        scan.vulnerabilities.some(vuln => vuln.severity === severity)
      );
    }
    
    // Sort by timestamp (newest first)
    vulnerabilities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Apply limit
    const limitedVulnerabilities = vulnerabilities.slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: {
        scans: limitedVulnerabilities,
        total: vulnerabilities.length
      }
    });
  } catch (error) {
    console.error('Get vulnerabilities error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve vulnerability scan results',
      error: error.message
    });
  }
});

// Generate security report
router.get('/reports', [
  auth,
  checkSecurityPermission,
  query('format').optional().isIn(['json', 'pdf']),
  query('period').optional().isIn(['last_24_hours', 'last_7_days', 'last_30_days'])
], async (req, res) => {
  try {
    const { format = 'json', period = 'last_7_days' } = req.query;
    
    const report = await securityService.generateSecurityReport(format);
    
    if (format === 'pdf') {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', 'attachment; filename="security-report.pdf"');
      return res.send(report);
    }
    
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Security report generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate security report',
      error: error.message
    });
  }
});

// Manual incident response actions
router.post('/incidents/:incidentId/respond', [
  auth,
  checkSecurityPermission,
  body('action').isIn(['block_ip', 'lock_account', 'notify_admins', 'escalate']),
  body('target').optional().isString(),
  body('notes').optional().isString()
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

    const { incidentId } = req.params;
    const { action, target, notes } = req.body;
    
    const incident = securityService.incidents.find(i => i.id === incidentId);
    
    if (!incident) {
      return res.status(404).json({
        success: false,
        message: 'Incident not found'
      });
    }

    let responseResult;
    
    switch (action) {
      case 'block_ip':
        responseResult = await securityService.blockIP(target || incident.event.ipAddress);
        break;
      case 'lock_account':
        responseResult = await securityService.lockAccount(target || incident.event.userId);
        break;
      case 'notify_admins':
        responseResult = await securityService.notifyAdministrators(incident);
        break;
      case 'escalate':
        // Escalate incident logic
        incident.severity = 'critical';
        responseResult = { escalated: true };
        break;
      default:
        return res.status(400).json({
          success: false,
          message: 'Invalid action'
        });
    }

    // Add manual response to incident
    incident.response.manual.push({
      action,
      target,
      notes,
      timestamp: new Date(),
      performedBy: req.user.email
    });

    res.json({
      success: true,
      message: `Incident response action '${action}' completed successfully`,
      data: responseResult
    });
  } catch (error) {
    console.error('Incident response error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform incident response action',
      error: error.message
    });
  }
});

// Get threat intelligence
router.get('/threat-intelligence', [
  auth,
  checkSecurityPermission
], async (req, res) => {
  try {
    const threatIntelligence = {
      threatDatabase: Array.from(securityService.threatDatabase.entries()).map(([type, config]) => ({
        type,
        severity: config.severity,
        description: config.description
      })),
      lastUpdated: new Date(),
      updateScheduled: 'Every 6 hours'
    };
    
    res.json({
      success: true,
      data: threatIntelligence
    });
  } catch (error) {
    console.error('Threat intelligence error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve threat intelligence',
      error: error.message
    });
  }
});

// Security dashboard data
router.get('/dashboard', [
  auth,
  checkSecurityPermission
], async (req, res) => {
  try {
    const metrics = securityService.getSecurityMetrics();
    const analytics = await securityService.generateSecurityAnalytics();
    
    const dashboard = {
      overview: metrics,
      analytics: analytics,
      recentIncidents: securityService.incidents
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 10),
      criticalAlerts: securityService.incidents
        .filter(i => i.severity === 'critical' && i.status === 'open')
        .slice(0, 5),
      recentVulnerabilities: securityService.vulnerabilities
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(0, 3)
    };
    
    res.json({
      success: true,
      data: dashboard
    });
  } catch (error) {
    console.error('Security dashboard error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve security dashboard data',
      error: error.message
    });
  }
});

module.exports = router;
