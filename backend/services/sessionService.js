const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const geoip = require('geoip-lite');

class SessionService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.sessionCache = new Map(); // In production, use Redis
    this.maxConcurrentSessions = parseInt(process.env.MAX_CONCURRENT_SESSIONS) || 5;
    this.sessionTimeout = parseInt(process.env.SESSION_TIMEOUT) || 24 * 60 * 60 * 1000; // 24 hours
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.cleanupExpiredSessions();
      console.log('✅ Session Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Session Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for session service');
          resolve();
        }
      });
    });
  }

  /**
   * Create new session for user
   * @param {number} userId - User ID
   * @param {object} deviceInfo - Device information
   * @param {object} requestInfo - Request information
   */
  async createSession(userId, deviceInfo = {}, requestInfo = {}) {
    try {
      // Check if user can create more sessions
      await this.checkSessionLimit(userId);

      // Generate session tokens
      const sessionToken = this.generateSecureToken();
      const refreshToken = this.generateSecureToken();
      const sessionId = crypto.randomUUID();

      // Parse device and location info
      const parsedDeviceInfo = this.parseDeviceInfo(requestInfo.userAgent || '');
      const location = this.getLocationFromIP(requestInfo.ipAddress);

      // Calculate session expiration
      const expiresAt = new Date(Date.now() + this.sessionTimeout);

      // Store session in database
      const session = await this.storeSession({
        userId,
        sessionId,
        sessionToken,
        refreshToken,
        deviceInfo: { ...parsedDeviceInfo, ...deviceInfo },
        userAgent: requestInfo.userAgent || '',
        ipAddress: requestInfo.ipAddress || '',
        location,
        expiresAt,
        isMfaVerified: false
      });

      // Cache session for quick access
      this.cacheSession(session.session_token, session);

      // Log session creation
      await this.logSessionEvent(userId, 'session_created', true, {
        sessionId: session.id,
        deviceInfo: parsedDeviceInfo,
        location,
        ipAddress: requestInfo.ipAddress
      });

      return {
        sessionId: session.id,
        sessionToken: session.session_token,
        refreshToken: session.refresh_token,
        expiresAt: session.expires_at,
        deviceInfo: parsedDeviceInfo,
        location
      };
    } catch (error) {
      console.error('Error creating session:', error);
      throw error;
    }
  }

  /**
   * Store session in database
   * @param {object} sessionData - Session data
   */
  async storeSession(sessionData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO user_sessions 
        (user_id, session_token, refresh_token, device_info, user_agent, ip_address, 
         location, expires_at, is_active, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, true, datetime('now'), ?)
      `;
      
      this.db.run(query, [
        sessionData.userId,
        sessionData.sessionToken,
        sessionData.refreshToken,
        JSON.stringify(sessionData.deviceInfo),
        sessionData.userAgent,
        sessionData.ipAddress,
        JSON.stringify(sessionData.location),
        sessionData.expiresAt.toISOString(),
        sessionData.userId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            id: this.lastID,
            ...sessionData,
            expires_at: sessionData.expiresAt.toISOString()
          });
        }
      });
    });
  }

  /**
   * Get session by token
   * @param {string} sessionToken - Session token
   */
  async getSession(sessionToken) {
    try {
      // Check cache first
      const cachedSession = this.getCachedSession(sessionToken);
      if (cachedSession) {
        return cachedSession;
      }

      // Get from database
      const session = await this.getSessionFromDB(sessionToken);
      
      if (session && session.is_active && new Date(session.expires_at) > new Date()) {
        // Cache the session
        this.cacheSession(sessionToken, session);
        return session;
      }

      return null;
    } catch (error) {
      console.error('Error getting session:', error);
      return null;
    }
  }

  /**
   * Get session from database
   * @param {string} sessionToken - Session token
   */
  async getSessionFromDB(sessionToken) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.username, u.email, u.first_name, u.last_name, u.mfa_enabled
        FROM user_sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_token = ? AND s.is_active = true
      `;
      
      this.db.get(query, [sessionToken], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Update session activity
   * @param {string} sessionToken - Session token
   * @param {object} requestInfo - Request information
   */
  async updateSessionActivity(sessionToken, requestInfo = {}) {
    try {
      const session = await this.getSession(sessionToken);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Check for suspicious activity
      const suspiciousActivity = await this.detectSuspiciousActivity(session, requestInfo);
      
      if (suspiciousActivity) {
        await this.handleSuspiciousActivity(session, suspiciousActivity);
        throw new Error('Suspicious activity detected');
      }

      // Update last activity
      await this.updateSessionLastActivity(session.id, requestInfo.ipAddress);

      // Update cache
      session.last_activity_at = new Date().toISOString();
      this.cacheSession(sessionToken, session);

      return { success: true };
    } catch (error) {
      console.error('Error updating session activity:', error);
      throw error;
    }
  }

  /**
   * Update session last activity timestamp
   * @param {number} sessionId - Session ID
   * @param {string} ipAddress - IP address
   */
  async updateSessionLastActivity(sessionId, ipAddress) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET last_activity_at = datetime('now'), ip_address = COALESCE(?, ip_address)
        WHERE id = ?
      `;
      
      this.db.run(query, [ipAddress, sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Detect suspicious activity
   * @param {object} session - Session data
   * @param {object} requestInfo - Current request info
   */
  async detectSuspiciousActivity(session, requestInfo) {
    const suspicious = [];

    // Check IP address change
    if (requestInfo.ipAddress && session.ip_address !== requestInfo.ipAddress) {
      const oldLocation = this.getLocationFromIP(session.ip_address);
      const newLocation = this.getLocationFromIP(requestInfo.ipAddress);
      
      if (oldLocation.country !== newLocation.country) {
        suspicious.push({
          type: 'country_change',
          details: {
            old: oldLocation,
            new: newLocation
          }
        });
      }
    }

    // Check user agent change
    if (requestInfo.userAgent && session.user_agent !== requestInfo.userAgent) {
      const oldDevice = this.parseDeviceInfo(session.user_agent);
      const newDevice = this.parseDeviceInfo(requestInfo.userAgent);
      
      if (oldDevice.os !== newDevice.os || oldDevice.browser !== newDevice.browser) {
        suspicious.push({
          type: 'device_change',
          details: {
            old: oldDevice,
            new: newDevice
          }
        });
      }
    }

    // Check rapid requests (potential bot)
    const now = new Date();
    const lastActivity = new Date(session.last_activity_at);
    const timeDiff = now - lastActivity;
    
    if (timeDiff < 1000) { // Less than 1 second
      suspicious.push({
        type: 'rapid_requests',
        details: { timeDiff }
      });
    }

    return suspicious.length > 0 ? suspicious : null;
  }

  /**
   * Handle suspicious activity
   * @param {object} session - Session data
   * @param {array} suspiciousActivity - Detected suspicious activities
   */
  async handleSuspiciousActivity(session, suspiciousActivity) {
    try {
      // Log suspicious activity
      await this.logSessionEvent(session.user_id, 'suspicious_activity', true, {
        sessionId: session.id,
        activities: suspiciousActivity
      });

      // Depending on severity, might lock session or require MFA
      const severity = this.calculateSuspicionSeverity(suspiciousActivity);
      
      if (severity >= 3) {
        // Lock session
        await this.lockSession(session.id);
        await this.logSessionEvent(session.user_id, 'session_locked', true, {
          sessionId: session.id,
          reason: 'suspicious_activity',
          severity
        });
      }
    } catch (error) {
      console.error('Error handling suspicious activity:', error);
    }
  }

  /**
   * Calculate suspicion severity
   * @param {array} activities - Suspicious activities
   */
  calculateSuspicionSeverity(activities) {
    let severity = 0;
    
    activities.forEach(activity => {
      switch (activity.type) {
        case 'country_change':
          severity += 2;
          break;
        case 'device_change':
          severity += 1;
          break;
        case 'rapid_requests':
          severity += 3;
          break;
      }
    });

    return severity;
  }

  /**
   * Lock session
   * @param {number} sessionId - Session ID
   */
  async lockSession(sessionId) {
    return new Promise((resolve, reject) => {
      const query = 'UPDATE user_sessions SET is_active = false WHERE id = ?';
      
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
   * Validate session
   * @param {string} sessionToken - Session token
   * @param {object} requestInfo - Request information
   */
  async validateSession(sessionToken, requestInfo = {}) {
    try {
      const session = await this.getSession(sessionToken);
      
      if (!session) {
        return { valid: false, reason: 'Session not found' };
      }

      // Check if session is expired
      if (new Date(session.expires_at) < new Date()) {
        await this.invalidateSession(sessionToken);
        return { valid: false, reason: 'Session expired' };
      }

      // Check if session is active
      if (!session.is_active) {
        return { valid: false, reason: 'Session inactive' };
      }

      // Check MFA requirement
      if (session.mfa_enabled && !session.is_mfa_verified) {
        return { 
          valid: false, 
          reason: 'MFA verification required',
          requiresMFA: true,
          userId: session.user_id
        };
      }

      // Update activity
      await this.updateSessionActivity(sessionToken, requestInfo);

      return { 
        valid: true, 
        session: {
          id: session.id,
          userId: session.user_id,
          username: session.username,
          email: session.email,
          firstName: session.first_name,
          lastName: session.last_name,
          mfaEnabled: session.mfa_enabled
        }
      };
    } catch (error) {
      console.error('Error validating session:', error);
      return { valid: false, reason: 'Validation error' };
    }
  }

  /**
   * Invalidate session
   * @param {string} sessionToken - Session token
   */
  async invalidateSession(sessionToken) {
    try {
      const session = await this.getSession(sessionToken);
      
      if (session) {
        await this.lockSession(session.id);
        this.removeCachedSession(sessionToken);
        
        await this.logSessionEvent(session.user_id, 'session_invalidated', true, {
          sessionId: session.id
        });
      }

      return { success: true };
    } catch (error) {
      console.error('Error invalidating session:', error);
      throw error;
    }
  }

  /**
   * Invalidate all user sessions
   * @param {number} userId - User ID
   * @param {string} excludeSessionToken - Session to exclude (optional)
   */
  async invalidateAllUserSessions(userId, excludeSessionToken = null) {
    try {
      const sessions = await this.getUserSessions(userId);
      let invalidatedCount = 0;

      for (const session of sessions) {
        if (session.session_token !== excludeSessionToken) {
          await this.lockSession(session.id);
          this.removeCachedSession(session.session_token);
          invalidatedCount++;
        }
      }

      await this.logSessionEvent(userId, 'all_sessions_invalidated', true, {
        count: invalidatedCount,
        excludedSession: !!excludeSessionToken
      });

      return { success: true, invalidatedCount };
    } catch (error) {
      console.error('Error invalidating all user sessions:', error);
      throw error;
    }
  }

  /**
   * Get user sessions
   * @param {number} userId - User ID
   */
  async getUserSessions(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, session_token, device_info, ip_address, location, 
               created_at, last_activity_at, expires_at, is_active
        FROM user_sessions
        WHERE user_id = ? 
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
   * Get active user sessions
   * @param {number} userId - User ID
   */
  async getActiveUserSessions(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT id, session_token, device_info, ip_address, location, 
               created_at, last_activity_at, expires_at
        FROM user_sessions
        WHERE user_id = ? AND is_active = true AND expires_at > datetime('now')
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
   * Check session limit for user
   * @param {number} userId - User ID
   */
  async checkSessionLimit(userId) {
    try {
      const activeSessions = await this.getActiveUserSessions(userId);
      
      if (activeSessions.length >= this.maxConcurrentSessions) {
        // Remove oldest session
        const oldestSession = activeSessions[activeSessions.length - 1];
        await this.invalidateSession(oldestSession.session_token);
        
        await this.logSessionEvent(userId, 'session_limit_reached', true, {
          limit: this.maxConcurrentSessions,
          removedSession: oldestSession.id
        });
      }
    } catch (error) {
      console.error('Error checking session limit:', error);
      throw error;
    }
  }

  /**
   * Extend session expiration
   * @param {string} sessionToken - Session token
   * @param {number} hours - Hours to extend
   */
  async extendSession(sessionToken, hours = 24) {
    try {
      const session = await this.getSession(sessionToken);
      
      if (!session) {
        throw new Error('Session not found');
      }

      const newExpiresAt = new Date(Date.now() + hours * 60 * 60 * 1000);

      await this.updateSessionExpiration(session.id, newExpiresAt);

      // Update cache
      session.expires_at = newExpiresAt.toISOString();
      this.cacheSession(sessionToken, session);

      await this.logSessionEvent(session.user_id, 'session_extended', true, {
        sessionId: session.id,
        newExpiresAt: newExpiresAt,
        hours
      });

      return { success: true, newExpiresAt };
    } catch (error) {
      console.error('Error extending session:', error);
      throw error;
    }
  }

  /**
   * Update session expiration
   * @param {number} sessionId - Session ID
   * @param {Date} expiresAt - New expiration time
   */
  async updateSessionExpiration(sessionId, expiresAt) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET expires_at = ?, last_activity_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [expiresAt.toISOString(), sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Mark session as MFA verified
   * @param {string} sessionToken - Session token
   */
  async markSessionMFAVerified(sessionToken) {
    try {
      const session = await this.getSession(sessionToken);
      
      if (!session) {
        throw new Error('Session not found');
      }

      await this.updateSessionMFAStatus(session.id, true);

      // Update cache
      session.is_mfa_verified = true;
      session.mfa_verified_at = new Date().toISOString();
      this.cacheSession(sessionToken, session);

      await this.logSessionEvent(session.user_id, 'mfa_verified', true, {
        sessionId: session.id
      });

      return { success: true };
    } catch (error) {
      console.error('Error marking MFA verified:', error);
      throw error;
    }
  }

  /**
   * Update session MFA status
   * @param {number} sessionId - Session ID
   * @param {boolean} verified - MFA verification status
   */
  async updateSessionMFAStatus(sessionId, verified) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET is_mfa_verified = ?, mfa_verified_at = CASE WHEN ? THEN datetime('now') ELSE mfa_verified_at END
        WHERE id = ?
      `;
      
      this.db.run(query, [verified, verified, sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Clean up expired sessions
   */
  async cleanupExpiredSessions() {
    try {
      const result = await this.deleteExpiredSessions();
      console.log(`Cleaned up ${result} expired sessions`);
      return result;
    } catch (error) {
      console.error('Error cleaning up expired sessions:', error);
      throw error;
    }
  }

  /**
   * Delete expired sessions from database
   */
  async deleteExpiredSessions() {
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
   * Get session statistics
   */
  async getSessionStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = true AND expires_at > datetime('now') THEN 1 ELSE 0 END) as active_sessions,
          SUM(CASE WHEN is_mfa_verified = true THEN 1 ELSE 0 END) as mfa_verified_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          AVG(CASE WHEN last_activity_at IS NOT NULL 
            THEN (julianday('now') - julianday(last_activity_at)) * 24
            ELSE NULL END) as avg_hours_since_activity
        FROM user_sessions
        WHERE created_at > datetime('now', '-7 days')
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get session analytics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getSessionAnalytics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as sessions_created,
          SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_sessions,
          COUNT(DISTINCT user_id) as unique_users
        FROM user_sessions
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at)
        ORDER BY date
      `;
      
      this.db.all(query, [startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Generate secure token
   */
  generateSecureToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Parse device information from user agent
   * @param {string} userAgent - User agent string
   */
  parseDeviceInfo(userAgent) {
    const info = {
      browser: 'Unknown',
      browserVersion: 'Unknown',
      os: 'Unknown',
      osVersion: 'Unknown',
      device: 'Unknown',
      isMobile: false,
      isTablet: false
    };

    if (!userAgent) {
      return info;
    }

    // Parse browser
    const browserMatch = userAgent.match(/(chrome|firefox|safari|edge|opera|msie|trident)\/?([\d.]+)/i);
    if (browserMatch) {
      info.browser = browserMatch[1];
      info.browserVersion = browserMatch[2];
    }

    // Parse OS
    const osMatch = userAgent.match(/(windows|mac|linux|ubuntu|android|ios|iphone|ipad)\/?([\d._]+)/i);
    if (osMatch) {
      info.os = osMatch[1];
      info.osVersion = osMatch[2].replace(/_/g, '.');
    }

    // Detect mobile/tablet
    info.isMobile = /mobile|android|iphone|ipod/i.test(userAgent);
    info.isTablet = /ipad|tablet/i.test(userAgent);
    info.device = info.isTablet ? 'Tablet' : (info.isMobile ? 'Mobile' : 'Desktop');

    return info;
  }

  /**
   * Get location from IP address
   * @param {string} ipAddress - IP address
   */
  getLocationFromIP(ipAddress) {
    if (!ipAddress || ipAddress === '127.0.0.1' || ipAddress === '::1') {
      return {
        country: 'Local',
        region: 'Local',
        city: 'Local',
        latitude: 0,
        longitude: 0
      };
    }

    const geo = geoip.lookup(ipAddress);
    
    if (geo) {
      return {
        country: geo.country,
        region: geo.region,
        city: geo.city,
        latitude: geo.ll[0],
        longitude: geo.ll[1],
        timezone: geo.timezone
      };
    }

    return {
      country: 'Unknown',
      region: 'Unknown',
      city: 'Unknown',
      latitude: 0,
      longitude: 0
    };
  }

  /**
   * Cache session for quick access
   * @param {string} sessionToken - Session token
   * @param {object} session - Session data
   */
  cacheSession(sessionToken, session) {
    // In production, use Redis with TTL
    this.sessionCache.set(sessionToken, session);
    
    // Set automatic cleanup
    setTimeout(() => {
      this.sessionCache.delete(sessionToken);
    }, this.sessionTimeout);
  }

  /**
   * Get cached session
   * @param {string} sessionToken - Session token
   */
  getCachedSession(sessionToken) {
    return this.sessionCache.get(sessionToken);
  }

  /**
   * Remove cached session
   * @param {string} sessionToken - Session token
   */
  removeCachedSession(sessionToken) {
    this.sessionCache.delete(sessionToken);
  }

  /**
   * Log session event
   * @param {number} userId - User ID
   * @param {string} action - Action performed
   * @param {boolean} success - Success status
   * @param {object} details - Additional details
   */
  async logSessionEvent(userId, action, success, details = {}) {
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
   * Get session by refresh token
   * @param {string} refreshToken - Refresh token
   */
  async getSessionByRefreshToken(refreshToken) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT s.*, u.username, u.email, u.first_name, u.last_name, u.mfa_enabled
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
   * Rotate session tokens
   * @param {string} sessionToken - Current session token
   */
  async rotateSessionTokens(sessionToken) {
    try {
      const session = await this.getSession(sessionToken);
      
      if (!session) {
        throw new Error('Session not found');
      }

      // Generate new tokens
      const newSessionToken = this.generateSecureToken();
      const newRefreshToken = this.generateSecureToken();

      // Update database
      await this.updateSessionTokens(session.id, newSessionToken, newRefreshToken);

      // Remove old from cache
      this.removeCachedSession(sessionToken);

      // Cache new session
      session.session_token = newSessionToken;
      session.refresh_token = newRefreshToken;
      this.cacheSession(newSessionToken, session);

      await this.logSessionEvent(session.user_id, 'session_tokens_rotated', true, {
        sessionId: session.id
      });

      return {
        newSessionToken,
        newRefreshToken
      };
    } catch (error) {
      console.error('Error rotating session tokens:', error);
      throw error;
    }
  }

  /**
   * Update session tokens
   * @param {number} sessionId - Session ID
   * @param {string} sessionToken - New session token
   * @param {string} refreshToken - New refresh token
   */
  async updateSessionTokens(sessionId, sessionToken, refreshToken) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE user_sessions 
        SET session_token = ?, refresh_token = ?, last_activity_at = datetime('now')
        WHERE id = ?
      `;
      
      this.db.run(query, [sessionToken, refreshToken, sessionId], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Get concurrent session limit for user
   * @param {number} userId - User ID
   */
  async getConcurrentSessionLimit(userId) {
    try {
      // Get user roles to determine session limit
      const rbacService = require('./rbacService');
      const userRoles = await rbacService.getUserRoles(userId);
      
      // Admin users can have more sessions
      for (const role of userRoles) {
        if (role.name === 'super_admin' || role.name === 'admin') {
          return this.maxConcurrentSessions * 2; // Double limit for admins
        }
      }

      return this.maxConcurrentSessions;
    } catch (error) {
      console.error('Error getting session limit:', error);
      return this.maxConcurrentSessions;
    }
  }
}

module.exports = new SessionService();
