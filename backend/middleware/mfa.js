const jwt = require('jsonwebtoken');
const mfaService = require('../services/mfaService');

const JWT_SECRET = process.env.JWT_SECRET || 'fallback-secret-key';

/**
 * Middleware to check if MFA is required for the user
 */
const requireMFA = async (req, res, next) => {
  try {
    const user = req.user; // User should be set by authenticateToken middleware
    
    if (!user) {
      return res.status(401).json({ 
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }
    
    const mfaStatus = await mfaService.getUserMFAStatus(user.id);
    
    if (!mfaStatus || !mfaStatus.mfa_enabled) {
      // MFA not enabled, proceed normally
      return next();
    }
    
    // Check if user has recent MFA verification (within 30 minutes)
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);
    if (mfaStatus.last_mfa_verification && new Date(mfaStatus.last_mfa_verification) > thirtyMinutesAgo) {
      // Recent MFA verification, proceed
      return next();
    }
    
    // MFA required but not recently verified
    return res.status(403).json({
      error: 'MFA required',
      message: 'Multi-factor authentication is required for this action',
      mfaRequired: true,
      userId: user.id
    });
    
  } catch (error) {
    console.error('MFA check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify MFA status'
    });
  }
};

/**
 * Middleware to validate MFA session token
 */
const validateMFASession = async (req, res, next) => {
  try {
    const { mfaToken } = req.headers;
    
    if (!mfaToken) {
      return res.status(401).json({
        error: 'MFA token required',
        message: 'Please provide MFA session token'
      });
    }
    
    // Verify the MFA session token (this would be the session_token after MFA verification)
    const db = require('sqlite3').verbose();
    const path = require('path');
    const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    
    const database = new db.Database(DB_PATH);
    
    database.get(`
      SELECT ms.*, u.email, u.role, u.first_name, u.last_name
      FROM mfa_sessions ms
      JOIN users u ON ms.user_id = u.id
      WHERE ms.session_token = ? AND ms.mfa_verified = TRUE AND ms.expires_at > CURRENT_TIMESTAMP
    `, [mfaToken], (err, session) => {
      if (err) {
        console.error('Database error:', err);
        return res.status(500).json({
          error: 'Internal server error',
          message: 'Failed to validate MFA session'
        });
      }
      
      if (!session) {
        return res.status(401).json({
          error: 'Invalid or expired MFA session',
          message: 'Please complete MFA verification again'
        });
      }
      
      // Set user in request for downstream middleware
      req.user = {
        id: session.user_id,
        email: session.email,
        role: session.role,
        firstName: session.first_name,
        lastName: session.last_name
      };
      
      req.mfaVerified = true;
      
      database.close();
      next();
    });
    
  } catch (error) {
    console.error('MFA session validation error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to validate MFA session'
    });
  }
};

/**
 * Middleware for routes that require MFA verification
 */
const requireMFAVerification = async (req, res, next) => {
  // First check if user is authenticated
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ 
      error: 'Access token required',
      message: 'Please provide a valid JWT token'
    });
  }
  
  try {
    // Verify JWT token
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    
    // Then check MFA status
    const mfaStatus = await mfaService.getUserMFAStatus(decoded.id);
    
    if (!mfaStatus || !mfaStatus.mfa_enabled) {
      // MFA not enabled for this user
      return next();
    }
    
    // Check if account is locked
    if (mfaStatus.is_currently_locked) {
      return res.status(423).json({
        error: 'Account locked',
        message: 'Account is temporarily locked due to multiple failed MFA attempts',
        lockedUntil: mfaStatus.locked_until
      });
    }
    
    // Create MFA session for verification
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('User-Agent');
    
    const mfaSession = await mfaService.createMFASession(decoded.id, ipAddress, userAgent);
    
    return res.status(403).json({
      error: 'MFA verification required',
      message: 'Please complete multi-factor authentication',
      mfaRequired: true,
      mfaSession: {
        tempToken: mfaSession.tempToken,
        expiresAt: mfaSession.expiresAt
      },
      availableMethods: ['totp', 'backup_code']
    });
    
  } catch (jwtError) {
    return res.status(403).json({ 
      error: 'Invalid token',
      message: 'Your token has expired or is invalid'
    });
  } catch (error) {
    console.error('MFA verification error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to process MFA requirement'
    });
  }
};

/**
 * Enhanced rate limiting for MFA endpoints
 */
const mfaRateLimit = (maxAttempts = 5, windowMs = 15 * 60 * 1000) => {
  const attempts = new Map();
  
  return (req, res, next) => {
    const key = req.ip || req.connection.remoteAddress;
    const now = Date.now();
    const windowStart = now - windowMs;
    
    // Clean up old entries
    if (attempts.has(key)) {
      const userAttempts = attempts.get(key).filter(timestamp => timestamp > windowStart);
      attempts.set(key, userAttempts);
    }
    
    const userAttempts = attempts.get(key) || [];
    
    if (userAttempts.length >= maxAttempts) {
      return res.status(429).json({
        error: 'Too many MFA attempts',
        message: `Please try again after ${Math.ceil(windowMs / 60000)} minutes`,
        retryAfter: Math.ceil(windowMs / 1000)
      });
    }
    
    // Add current attempt
    userAttempts.push(now);
    attempts.set(key, userAttempts);
    
    next();
  };
};

/**
 * Middleware to log security events
 */
const logSecurityEvent = (eventType, description) => {
  return async (req, res, next) => {
    try {
      if (req.user) {
        await mfaService.logSecurityEvent(req.user.id, eventType, description, {
          ip_address: req.ip || req.connection.remoteAddress,
          user_agent: req.get('User-Agent'),
          session_id: req.session?.id,
          endpoint: req.path,
          method: req.method
        });
      }
    } catch (error) {
      console.error('Failed to log security event:', error);
      // Don't block the request for logging errors
    }
    
    next();
  };
};

/**
 * Middleware to check account lock status
 */
const checkAccountLock = async (req, res, next) => {
  try {
    if (!req.user) {
      return next(); // No user to check
    }
    
    const mfaStatus = await mfaService.getUserMFAStatus(req.user.id);
    
    if (mfaStatus && mfaStatus.is_currently_locked) {
      return res.status(423).json({
        error: 'Account locked',
        message: 'Account is temporarily locked due to multiple failed authentication attempts',
        lockedUntil: mfaStatus.locked_until
      });
    }
    
    next();
  } catch (error) {
    console.error('Account lock check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify account status'
    });
  }
};

/**
 * Middleware to enforce MFA for sensitive operations
 */
const requireMFAForSensitiveActions = async (req, res, next) => {
  try {
    const user = req.user;
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Please authenticate first'
      });
    }
    
    const mfaStatus = await mfaService.getUserMFAStatus(user.id);
    
    // Always require MFA for admin users
    if (user.role === 'admin') {
      if (!mfaStatus || !mfaStatus.mfa_enabled) {
        return res.status(403).json({
          error: 'MFA required for admin users',
          message: 'Administrators must enable multi-factor authentication'
        });
      }
    }
    
    // Check if MFA verification is recent (within 5 minutes for sensitive actions)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    if (mfaStatus && mfaStatus.mfa_enabled && 
        (!mfaStatus.last_mfa_verification || 
         new Date(mfaStatus.last_mfa_verification) < fiveMinutesAgo)) {
      return res.status(403).json({
        error: 'Fresh MFA verification required',
        message: 'Please complete multi-factor authentication for this sensitive action',
        mfaRequired: true,
        reason: 'sensitive_action'
      });
    }
    
    next();
  } catch (error) {
    console.error('Sensitive action MFA check error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Failed to verify security requirements'
    });
  }
};

module.exports = {
  requireMFA,
  validateMFASession,
  requireMFAVerification,
  mfaRateLimit,
  logSecurityEvent,
  checkAccountLock,
  requireMFAForSensitiveActions
};
