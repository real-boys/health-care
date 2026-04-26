const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class JWTService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.accessTokenSecret = process.env.JWT_ACCESS_SECRET || crypto.randomBytes(64).toString('hex');
    this.refreshTokenSecret = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(64).toString('hex');
    this.accessTokenExpiry = process.env.JWT_ACCESS_EXPIRY || '15m';
    this.refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRY || '7d';
    this.issuer = process.env.JWT_ISSUER || 'healthcare-platform';
    this.audience = process.env.JWT_AUDIENCE || 'healthcare-users';
    
    // Blacklist for revoked tokens (in production, use Redis)
    this.blacklistedTokens = new Set();
    
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ JWT Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize JWT Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for JWT service');
          resolve();
        }
      });
    });
  }

  /**
   * Generate access and refresh tokens for user
   * @param {object} user - User object
   * @param {object} deviceInfo - Device information
   * @param {object} sessionInfo - Session information
   */
  async generateTokenPair(user, deviceInfo = {}, sessionInfo = {}) {
    try {
      // Get user permissions and roles
      const userPermissions = await this.getUserPermissions(user.id);
      const userRoles = await this.getUserRoles(user.id);

      // Create JWT payload
      const payload = {
        sub: user.id.toString(),
        email: user.email,
        username: user.username,
        firstName: user.first_name,
        lastName: user.last_name,
        roles: userRoles,
        permissions: userPermissions,
        mfaEnabled: user.mfa_enabled,
        isVerified: user.is_verified,
        isActive: user.is_active
      };

      // Generate access token
      const accessToken = jwt.sign(payload, this.accessTokenSecret, {
        expiresIn: this.accessTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
        jwtid: crypto.randomUUID()
      });

      // Generate refresh token
      const refreshToken = jwt.sign({
        sub: user.id.toString(),
        type: 'refresh',
        sessionId: crypto.randomUUID()
      }, this.refreshTokenSecret, {
        expiresIn: this.refreshTokenExpiry,
        issuer: this.issuer,
        audience: this.audience,
        algorithm: 'HS256',
        jwtid: crypto.randomUUID()
      });

      // Store session in database
      const session = await this.createSession(user.id, accessToken, refreshToken, deviceInfo, sessionInfo);

      return {
        accessToken,
        refreshToken,
        tokenType: 'Bearer',
        expiresIn: this.parseExpiry(this.accessTokenExpiry),
        sessionId: session.id
      };
    } catch (error) {
      console.error('Error generating token pair:', error);
      throw error;
    }
  }

  /**
   * Verify and decode access token
   * @param {string} token - Access token
   */
  async verifyAccessToken(token) {
    try {
      // Check if token is blacklisted
      if (this.isTokenBlacklisted(token)) {
        throw new Error('Token has been revoked');
      }

      const decoded = jwt.verify(token, this.accessTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      // Check if session is still active
      const session = await this.getSessionByToken(token);
      if (!session || !session.is_active) {
        throw new Error('Session is not active');
      }

      // Update last activity
      await this.updateSessionActivity(session.id);

      return decoded;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid token');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Token expired');
      } else {
        throw error;
      }
    }
  }

  /**
   * Verify refresh token and generate new token pair
   * @param {string} refreshToken - Refresh token
   * @param {object} deviceInfo - Device information
   */
  async refreshToken(refreshToken, deviceInfo = {}) {
    try {
      // Verify refresh token
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['HS256']
      });

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      // Get user and session
      const user = await this.getUserById(decoded.sub);
      if (!user || !user.is_active) {
        throw new Error('User not found or inactive');
      }

      const session = await this.getSessionByRefreshToken(refreshToken);
      if (!session || !session.is_active) {
        throw new Error('Session not found or inactive');
      }

      // Blacklist old tokens
      await this.blacklistToken(session.session_token);
      await this.blacklistToken(session.refresh_token);

      // Generate new token pair
      const newTokens = await this.generateTokenPair(user, deviceInfo, {
        sessionId: decoded.sessionId
      });

      // Delete old session
      await this.deleteSession(session.id);

      // Log token refresh
      await this.logAuthEvent(user.id, 'token_refresh', true, {
        sessionId: session.id,
        deviceInfo
      });

      return newTokens;
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        throw new Error('Invalid refresh token');
      } else if (error.name === 'TokenExpiredError') {
        throw new Error('Refresh token expired');
      } else {
        throw error;
      }
    }
  }

  /**
   * Revoke token (add to blacklist)
   * @param {string} token - Token to revoke
   */
  async revokeToken(token) {
    try {
      // Decode token to get session info
      const decoded = jwt.decode(token);
      
      if (!decoded) {
        throw new Error('Invalid token');
      }

      // Add to blacklist
      this.blacklistedTokens.add(token);

      // Update session if it exists
      const session = await this.getSessionByToken(token);
      if (session) {
        await this.updateSessionStatus(session.id, false);
      }

      // Log token revocation
      await this.logAuthEvent(decoded.sub, 'token_revoked', true, {
        tokenId: decoded.jti
      });

      return { success: true };
    } catch (error) {
      console.error('Error revoking token:', error);
      throw error;
    }
  }

  /**
   * Revoke all user tokens
   * @param {number} userId - User ID
   */
  async revokeAllUserTokens(userId) {
    try {
      // Deactivate all user sessions
      await this.deactivateAllUserSessions(userId);

      // Log mass token revocation
      await this.logAuthEvent(userId, 'all_tokens_revoked', true);

      return { success: true };
    } catch (error) {
      console.error('Error revoking all user tokens:', error);
      throw error;
    }
  }

  /**
   * Create session in database
   * @param {number} userId - User ID
   * @param {string} accessToken - Access token
   * @param {string} refreshToken - Refresh token
   * @param {object} deviceInfo - Device information
   * @param {object} sessionInfo - Session information
   */
  async createSession(userId, accessToken, refreshToken, deviceInfo = {}, sessionInfo = {}) {
    const decodedAccess = jwt.decode(accessToken);
    const decodedRefresh = jwt.decode(refreshToken);
    
    const expiresAt = new Date(decodedAccess.exp * 1000);

    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_sessions 
        (user_id, session_token, refresh_token, device_info, user_agent, ip_address, 
         location, expires_at, is_active, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, datetime('now'))
      `;
      
      this.db.run(query, [
        userId,
        accessToken,
        refreshToken,
        JSON.stringify(deviceInfo),
        sessionInfo.userAgent || '',
        sessionInfo.ipAddress || '',
        JSON.stringify(sessionInfo.location || {}),
        expiresAt.toISOString()
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID, token: accessToken });
        }
      });
    });
  }

  /**
   * Get session by access token
   * @param {string} token - Access token
   */
  async getSessionByToken(token) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.email, u.username, u.first_name, u.last_name
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.is_active = true
      `;
      
      this.db.get(query, [token], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get session by refresh token
   * @param {string} refreshToken - Refresh token
   */
  async getSessionByRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.email, u.username, u.first_name, u.last_name
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.refresh_token = ? AND s.is_active = true
      `;
      
      this.db.get(query, [refreshToken], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Update session activity timestamp
   * @param {number} sessionId - Session ID
   */
  async updateSessionActivity(sessionId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET last_activity_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Update session status
   * @param {number} sessionId - Session ID
   * @param {boolean} isActive - Active status
   */
  async updateSessionStatus(sessionId, isActive) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET is_active = ?, last_activity_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [isActive, sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Delete session
   * @param {number} sessionId - Session ID
   */
  async deleteSession(sessionId) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM user_sessions WHERE id = ?';
      
      this.db.run(query, [sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Deactivate all user sessions
   * @param {number} userId - User ID
   */
  async deactivateAllUserSessions(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET is_active = false, last_activity_at = datetime('now')
        WHERE user_id = ? AND is_active = true
      `;
      
      this.db.run(query, [userId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get user permissions
   * @param {number} userId - User ID
   */
  async getUserPermissions(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT DISTINCT p.name, p.display_name, p.resource, p.action
        FROM permissions p
        JOIN role_permissions rp ON p.id = rp.permission_id
        JOIN roles r ON rp.role_id = r.id
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = true AND r.is_active = true AND p.is_active = true
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get user roles
   * @param {number} userId - User ID
   */
  async getUserRoles(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT r.name, r.display_name, r.level
        FROM roles r
        JOIN user_roles ur ON r.id = ur.role_id
        WHERE ur.user_id = ? AND ur.is_active = true AND r.is_active = true
        ORDER BY r.level DESC
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get user by ID
   * @param {number} userId - User ID
   */
  async getUserById(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, email, username, first_name, last_name, is_active, is_verified, mfa_enabled
        FROM users 
        WHERE id = ?
      `;
      
      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get active sessions for user
   * @param {number} userId - User ID
   */
  async getUserActiveSessions(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, device_info, ip_address, location, created_at, last_activity_at, expires_at
        FROM user_sessions
        WHERE user_id = ? AND is_active = true
        ORDER BY last_activity_at DESC
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM user_sessions 
        WHERE expires_at < datetime('now') OR 
              (is_active = false AND last_activity_at < datetime('now', '-7 days'))
      `;
      
      this.db.run(query, [], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Check if token is blacklisted
   * @param {string} token - Token to check
   */
  isTokenBlacklisted(token) {
    return this.blacklistedTokens.has(token);
  }

  /**
   * Add token to blacklist
   * @param {string} token - Token to blacklist
   */
  blacklistToken(token) {
    this.blacklistedTokens.add(token);
    
    // Clean up old tokens periodically (in production, use Redis with TTL)
    if (this.blacklistedTokens.size > 10000) {
      // Simple cleanup - remove old tokens (in production, use proper TTL)
      const tokensArray = Array.from(this.blacklistedTokens);
      this.blacklistedTokens.clear();
      
      // Keep only recent tokens (last 5000)
      tokensArray.slice(-5000).forEach(token => {
        this.blacklistedTokens.add(token);
      });
    }
  }

  /**
   * Parse expiry string to seconds
   * @param {string} expiry - Expiry string (e.g., '15m', '7d', '1h')
   */
  parseExpiry(expiry) {
    const units = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400
    };

    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return 3600; // Default to 1 hour
    }

    const [, amount, unit] = match;
    return parseInt(amount) * units[unit];
  }

  /**
   * Generate API key for service authentication
   * @param {string} name - API key name
   * @param {array} permissions - Array of permissions
   * @param {object} options - Additional options
   */
  async generateApiKey(name, permissions = [], options = {}) {
    try {
      const keyId = crypto.randomBytes(8).toString('hex');
      const keySecret = crypto.randomBytes(32).toString('hex');
      const apiKey = `hk_${keyId}_${keySecret}`;
      
      // Hash the key for storage
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
      const keyPrefix = apiKey.substring(0, 12);

      const expiresAt = options.expiresAt ? new Date(options.expiresAt).toISOString() : null;

      // Store in database
      const result = await this.storeApiKey(name, keyHash, keyPrefix, permissions, options, expiresAt);

      // Log API key creation
      await this.logAuthEvent(options.createdBy, 'api_key_created', true, {
        keyId: result.id,
        keyName: name,
        permissions
      });

      return {
        id: result.id,
        apiKey, // Return full key only once
        keyPrefix,
        permissions,
        expiresAt,
        createdAt: new Date()
      };
    } catch (error) {
      console.error('Error generating API key:', error);
      throw error;
    }
  }

  /**
   * Store API key in database
   */
  async storeApiKey(name, keyHash, keyPrefix, permissions, options, expiresAt) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO api_keys 
        (name, key_hash, key_prefix, permissions, rate_limit_per_minute, rate_limit_per_hour, 
         is_active, expires_at, created_by, created_at)
        VALUES (?, ?, ?, ?, ?, ?, true, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        name,
        keyHash,
        keyPrefix,
        JSON.stringify(permissions),
        options.rateLimitPerMinute || 100,
        options.rateLimitPerHour || 1000,
        expiresAt,
        options.createdBy
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: this.lastID });
        }
      });
    });
  }

  /**
   * Verify API key
   * @param {string} apiKey - API key to verify
   */
  async verifyApiKey(apiKey) {
    try {
      if (!apiKey || !apiKey.startsWith('hk_')) {
        throw new Error('Invalid API key format');
      }

      // Hash the provided key
      const keyHash = crypto.createHash('sha256').update(apiKey).digest('hex');

      // Look up in database
      const keyRecord = await this.getApiKeyByHash(keyHash);
      
      if (!keyRecord || !keyRecord.is_active) {
        throw new Error('API key not found or inactive');
      }

      // Check expiration
      if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
        throw new Error('API key expired');
      }

      // Update last used timestamp
      await this.updateApiKeyLastUsed(keyRecord.id);

      // Return key info
      return {
        id: keyRecord.id,
        name: keyRecord.name,
        permissions: JSON.parse(keyRecord.permissions || '[]'),
        rateLimitPerMinute: keyRecord.rate_limit_per_minute,
        rateLimitPerHour: keyRecord.rate_limit_per_hour
      };
    } catch (error) {
      console.error('Error verifying API key:', error);
      throw error;
    }
  }

  /**
   * Get API key by hash
   * @param {string} keyHash - Hashed API key
   */
  async getApiKeyByHash(keyHash) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT * FROM api_keys WHERE key_hash = ?';
      
      this.db.get(query, [keyHash], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Update API key last used timestamp
   * @param {number} keyId - API key ID
   */
  async updateApiKeyLastUsed(keyId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE api_keys SET last_used_at = datetime(\'now\') WHERE id = ?';
      
      this.db.run(query, [keyId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Revoke API key
   * @param {number} keyId - API key ID
   */
  async revokeApiKey(keyId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE api_keys SET is_active = false WHERE id = ?';
      
      this.db.run(query, [keyId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Log authentication event
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {boolean} success - Success status
   * @param {object} details - Additional details
   */
  async logAuthEvent(userId, action, success, details = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO auth_audit_log 
        (user_id, action, success, details, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [userId, action, success, JSON.stringify(details)], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Get token information without verification
   * @param {string} token - JWT token
   */
  decodeToken(token) {
    try {
      return jwt.decode(token, { complete: true });
    } catch (error) {
      throw new Error('Invalid token format');
    }
  }

  /**
   * Check if token will expire soon
   * @param {string} token - JWT token
   * @param {number} bufferMinutes - Buffer time in minutes
   */
  async willExpireSoon(token, bufferMinutes = 5) {
    try {
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.exp) {
        return false;
      }

      const expirationTime = decoded.exp * 1000;
      const bufferTime = bufferMinutes * 60 * 1000;
      const currentTime = Date.now();

      return (expirationTime - currentTime) <= bufferTime;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get token remaining time in seconds
   * @param {string} token - JWT token
   */
  getTokenRemainingTime(token) {
    try {
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.exp) {
        return 0;
      }

      const expirationTime = decoded.exp * 1000;
      const currentTime = Date.now();
      const remainingTime = Math.max(0, expirationTime - currentTime);

      return Math.floor(remainingTime / 1000);
    } catch (error) {
      return 0;
    }
  }

  /**
   * Validate token payload structure
   * @param {object} payload - JWT payload
   */
  validateTokenPayload(payload) {
    const required = ['sub', 'email', 'roles', 'permissions'];
    
    for (const field of required) {
      if (!payload[field]) {
        throw new Error(`Missing required field in token payload: ${field}`);
      }
    }

    if (!Array.isArray(payload.roles)) {
      throw new Error('Roles must be an array');
    }

    if (!Array.isArray(payload.permissions)) {
      throw new Error('Permissions must be an array');
    }

    return true;
  }

  /**
   * Create password reset token
   * @param {number} userId - User ID
   * @param {object} requestInfo - Request information
   */
  async createPasswordResetToken(userId, requestInfo = {}) {
    try {
      const token = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

      await this.storePasswordResetToken(userId, token, expiresAt, requestInfo);

      // Log password reset request
      await this.logAuthEvent(userId, 'password_reset_requested', true, requestInfo);

      return {
        token,
        expiresAt
      };
    } catch (error) {
      console.error('Error creating password reset token:', error);
      throw error;
    }
  }

  /**
   * Store password reset token
   */
  async storePasswordResetToken(userId, token, expiresAt, requestInfo) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO password_reset_tokens 
        (user_id, token, expires_at, ip_address, user_agent, created_at)
        VALUES (?, ?, ?, ?, ?, datetime('now'))
      `;
      
      this.db.run(query, [
        userId,
        token,
        expiresAt.toISOString(),
        requestInfo.ipAddress,
        requestInfo.userAgent
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  /**
   * Verify password reset token
   * @param {string} token - Reset token
   */
  async verifyPasswordResetToken(token) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT prt.*, u.email, u.username
        FROM password_reset_tokens prt
        JOIN users u ON prt.user_id = u.id
        WHERE prt.token = ? AND prt.used_at IS NULL AND prt.expires_at > datetime('now')
      `;
      
      this.db.get(query, [token], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Mark password reset token as used
   * @param {string} token - Reset token
   */
  async markPasswordResetTokenUsed(token) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE password_reset_tokens SET used_at = datetime(\'now\') WHERE token = ?';
      
      this.db.run(query, [token], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get JWT configuration
   */
  getJWTConfig() {
    return {
      accessTokenExpiry: this.accessTokenExpiry,
      refreshTokenExpiry: this.refreshTokenExpiry,
      issuer: this.issuer,
      audience: this.audience,
      algorithm: 'HS256'
    };
  }

  /**
   * Update JWT configuration
   * @param {object} config - New configuration
   */
  updateJWTConfig(config) {
    if (config.accessTokenExpiry) this.accessTokenExpiry = config.accessTokenExpiry;
    if (config.refreshTokenExpiry) this.refreshTokenExpiry = config.refreshTokenExpiry;
    if (config.issuer) this.issuer = config.issuer;
    if (config.audience) this.audience = config.audience;
    
    console.log('JWT configuration updated');
  }
}

module.exports = new JWTService();
