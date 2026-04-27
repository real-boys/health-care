const AuditLog = require('../models/AuditLog');
const jwt = require('jsonwebtoken');

// Helper function to extract user information
const extractUserInfo = (req) => {
  let userId = null;
  let userRole = 'anonymous';
  
  if (req.user) {
    userId = req.user._id;
    userRole = req.user.role;
  } else if (req.headers.authorization) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      userId = decoded.userId;
      userRole = decoded.role;
    } catch (error) {
      // Invalid token, continue as anonymous
    }
  }
  
  return { userId, userRole };
};

// Helper function to determine resource type and ID from URL
const extractResourceInfo = (req) => {
  const url = req.originalUrl || req.url;
  const method = req.method;
  
  let resourceType = 'system';
  let resourceId = null;
  let action = 'unknown';
  
  // Map HTTP methods to actions
  const actionMap = {
    'GET': 'read',
    'POST': 'create',
    'PUT': 'update',
    'PATCH': 'update',
    'DELETE': 'delete'
  };
  
  action = actionMap[method] || 'unknown';
  
  // Extract resource type from URL
  if (url.includes('/api/auth/login')) {
    action = 'login';
    resourceType = 'user';
  } else if (url.includes('/api/auth/logout')) {
    action = 'logout';
    resourceType = 'user';
  } else if (url.includes('/api/policies')) {
    resourceType = 'policy';
    if (req.params.id) resourceId = req.params.id;
  } else if (url.includes('/api/claims')) {
    resourceType = 'claim';
    if (req.params.id) resourceId = req.params.id;
  } else if (url.includes('/api/payments')) {
    resourceType = 'payment';
    if (req.params.id) resourceId = req.params.id;
  } else if (url.includes('/api/reports')) {
    resourceType = 'report';
    action = 'export';
  } else if (url.includes('/api/users')) {
    resourceType = 'user';
    if (req.params.id) resourceId = req.params.id;
  } else if (url.includes('/api/audit')) {
    resourceType = 'audit';
  }
  
  return { resourceType, resourceId, action };
};

// Helper function to determine risk level
const determineRiskLevel = (action, resourceType, userRole, outcome) => {
  // High-risk actions
  const highRiskActions = ['delete', 'approve', 'reject', 'process', 'payment', 'refund'];
  const highRiskResources = ['user', 'payment', 'claim'];
  
  if (highRiskActions.includes(action) && highRiskResources.includes(resourceType)) {
    return 'high';
  }
  
  // Critical risk for admin actions on users
  if (userRole === 'admin' && resourceType === 'user' && action === 'delete') {
    return 'critical';
  }
  
  // Medium risk for financial operations
  if (resourceType === 'payment' || resourceType === 'claim') {
    return 'medium';
  }
  
  // Low risk for read operations
  if (action === 'read') {
    return 'low';
  }
  
  return 'medium';
};

// Helper function to check for PII/PHI/Financial data access
const checkDataAccess = (resourceType, action, req) => {
  const piiAccessed = false;
  const phiAccessed = resourceType === 'policy' || resourceType === 'claim';
  const financialAccessed = resourceType === 'payment' || resourceType === 'policy';
  
  return { piiAccessed, phiAccessed, financialAccessed };
};

// Main audit logging middleware
const auditLogger = async (req, res, next) => {
  // Don't log health checks and static assets
  if (req.originalUrl === '/health' || req.originalUrl.startsWith('/static')) {
    return next();
  }
  
  // Store original res.end to capture response
  const originalEnd = res.end;
  let responseData = '';
  
  res.end = function(chunk, encoding) {
    if (chunk) {
      responseData = chunk.toString();
    }
    originalEnd.call(this, chunk, encoding);
  };
  
  // Continue with the request
  res.on('finish', async () => {
    try {
      const { userId, userRole } = extractUserInfo(req);
      const { resourceType, resourceId, action } = extractResourceInfo(req);
      
      // Skip logging for anonymous users on read operations
      if (!userId && action === 'read') {
        return;
      }
      
      const outcome = res.statusCode >= 200 && res.statusCode < 400 ? 'success' : 'failure';
      const riskLevel = determineRiskLevel(action, resourceType, userRole, outcome);
      const { piiAccessed, phiAccessed, financialAccessed } = checkDataAccess(resourceType, action, req);
      
      // Prepare log data
      const logData = {
        action,
        resourceType,
        resourceId: resourceId || new mongoose.Types.ObjectId(), // Use dummy ID for system logs
        userId: userId || new mongoose.Types.ObjectId(), // Use dummy ID for anonymous
        userRole,
        details: {
          description: `${action.toUpperCase()} ${resourceType.toUpperCase()} - ${req.method} ${req.originalUrl}`,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.get('User-Agent'),
          sessionId: req.sessionID,
          requestId: req.id,
          timestamp: new Date()
        },
        outcome,
        riskLevel,
        compliance: {
          dataAccessed: Object.keys(req.body || {}),
          piiAccessed,
          phiAccessed,
          financialAccessed,
          requiresReview: riskLevel === 'critical' || (riskLevel === 'high' && outcome === 'failure')
        },
        location: {
          // Would need to implement IP geolocation here
          country: req.get('CF-IPCountry') || 'Unknown'
        },
        system: {
          service: 'insurance-portal',
          version: process.env.npm_package_version || '1.0.0',
          environment: process.env.NODE_ENV || 'development',
          hostname: req.hostname
        },
        tags: []
      };
      
      // Add tags based on action and outcome
      if (outcome === 'failure') {
        logData.tags.push('failure');
      }
      if (riskLevel === 'critical' || riskLevel === 'high') {
        logData.tags.push('high_risk');
      }
      if (phiAccessed) {
        logData.tags.push('phi_access');
      }
      if (financialAccessed) {
        logData.tags.push('financial_access');
      }
      
      // Create audit log entry
      await AuditLog.createLog(logData);
      
    } catch (error) {
      console.error('Audit logging error:', error);
      // Don't block the request if audit logging fails
    }
  });
  
  next();
};

module.exports = auditLogger;
