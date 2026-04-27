const complianceService = require('../services/complianceService');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/compliance-middleware.log' }),
    new winston.transports.Console()
  ]
});

const complianceMonitor = async (req, res, next) => {
  try {
    // Skip compliance monitoring for health checks and static assets
    if (req.path === '/health' || req.path.startsWith('/static')) {
      return next();
    }

    // Build compliance context
    const context = {
      action: mapHttpMethodToAction(req.method),
      resourceType: getResourceTypeFromPath(req.path),
      resourceId: req.params.id || req.body.id || null,
      userId: req.user ? req.user.id : null,
      userRole: req.user ? req.user.role : 'anonymous',
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID,
      timestamp: new Date(),
      location: req.user ? req.user.location : null,
      compliance: {
        piiAccessed: checkPIIAccess(req),
        phiAccessed: checkPHIAccess(req),
        financialAccessed: checkFinancialAccess(req)
      }
    };

    // Perform compliance check
    const violations = await complianceService.checkCompliance(context);

    // Handle violations
    if (violations.length > 0) {
      const criticalViolations = violations.filter(v => v.severity === 'critical');
      const blockingViolations = violations.filter(v => 
        v.alert.triggered && v.alert.alertMethod.includes('block')
      );

      // Log violations
      logger.warn(`Compliance violations detected: ${violations.length}`, {
        violations: violations.map(v => ({
          violationId: v.violationId,
          ruleId: v.ruleId,
          severity: v.severity,
          action: v.context.action
        }))
      });

      // Block request if there are critical violations or blocking rules
      if (criticalViolations.length > 0 || blockingViolations.length > 0) {
        return res.status(403).json({
          error: 'Access denied due to compliance violations',
          violations: violations.map(v => ({
            violationId: v.violationId,
            severity: v.severity,
            description: v.details.description
          }))
        });
      }

      // Add violation headers for monitoring
      res.set('X-Compliance-Violations', violations.length);
      res.set('X-Compliance-Checked', 'true');
    }

    next();
  } catch (error) {
    logger.error('Compliance monitoring error:', error);
    // Don't block the request on compliance monitoring errors
    next();
  }
};

function mapHttpMethodToAction(method) {
  const actionMap = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };
  return actionMap[method] || 'unknown';
}

function getResourceTypeFromPath(path) {
  const pathSegments = path.split('/').filter(segment => segment);
  const resourceMap = {
    'auth': 'user',
    'policies': 'policy',
    'claims': 'claim',
    'payments': 'payment',
    'reports': 'report',
    'documents': 'document',
    'users': 'user',
    'audit': 'system'
  };
  
  const firstSegment = pathSegments[0];
  return resourceMap[firstSegment] || 'system';
}

function checkPIIAccess(req) {
  // Check if request involves PII data
  const piiFields = ['ssn', 'socialSecurityNumber', 'driverLicense', 'passport', 'idNumber'];
  const requestBody = JSON.stringify(req.body || {}).toLowerCase();
  const requestParams = JSON.stringify(req.params || {}).toLowerCase();
  const requestQuery = JSON.stringify(req.query || {}).toLowerCase();
  
  return piiFields.some(field => 
    requestBody.includes(field) || 
    requestParams.includes(field) || 
    requestQuery.includes(field)
  );
}

function checkPHIAccess(req) {
  // Check if request involves PHI data
  const phiFields = ['medical', 'health', 'patient', 'diagnosis', 'treatment', 'prescription', 'doctor'];
  const requestBody = JSON.stringify(req.body || {}).toLowerCase();
  const requestParams = JSON.stringify(req.params || {}).toLowerCase();
  const requestQuery = JSON.stringify(req.query || {}).toLowerCase();
  
  return phiFields.some(field => 
    requestBody.includes(field) || 
    requestParams.includes(field) || 
    requestQuery.includes(field)
  );
}

function checkFinancialAccess(req) {
  // Check if request involves financial data
  const financialFields = ['payment', 'bank', 'account', 'credit', 'card', 'invoice', 'billing'];
  const requestBody = JSON.stringify(req.body || {}).toLowerCase();
  const requestParams = JSON.stringify(req.params || {}).toLowerCase();
  const requestQuery = JSON.stringify(req.query || {}).toLowerCase();
  
  return financialFields.some(field => 
    requestBody.includes(field) || 
    requestParams.includes(field) || 
    requestQuery.includes(field)
  );
}

module.exports = complianceMonitor;
