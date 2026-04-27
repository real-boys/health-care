const express = require('express');
const { authenticateToken, requireMFAForSensitiveActions } = require('../middleware/auth');
const { requireMFAVerification } = require('../middleware/mfa');
const securityMonitoringService = require('../services/securityMonitoringService');

const router = express.Router();

/**
 * Get security dashboard data
 */
router.get('/dashboard', 
  authenticateToken, 
  requireMFAVerification,
  requireMFAForSensitiveActions,
  async (req, res, next) => {
    try {
      const { timeframe = '24h' } = req.query;
      const dashboard = await securityMonitoringService.getSecurityDashboard(timeframe);
      
      res.json({
        message: 'Security dashboard data retrieved successfully',
        dashboard
      });
      
    } catch (error) {
      console.error('Security dashboard error:', error);
      next(error);
    }
  }
);

/**
 * Get user security events
 */
router.get('/events/user/:userId', 
  authenticateToken, 
  requireMFAVerification,
  async (req, res, next) => {
    try {
      const { userId } = req.params;
      const { limit = 50, offset = 0, severity, eventType } = req.query;
      
      // Users can only view their own security events unless they're admin
      if (req.user.role !== 'admin' && req.user.id !== parseInt(userId)) {
        return res.status(403).json({
          error: 'Access denied',
          message: 'You can only view your own security events'
        });
      }
      
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
      
      const db = new sqlite3.Database(DB_PATH);
      
      let query = `
        SELECT 
          id,
          event_type,
          event_description,
          ip_address,
          user_agent,
          severity,
          created_at,
          metadata
        FROM security_events
        WHERE user_id = ?
      `;
      const params = [userId];
      
      if (severity) {
        query += ` AND severity = ?`;
        params.push(severity);
      }
      
      if (eventType) {
        query += ` AND event_type = ?`;
        params.push(eventType);
      }
      
      query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      db.all(query, params, (err, events) => {
        if (err) {
          console.error('Database error:', err);
          return next(err);
        }
        
        // Parse metadata for each event
        const eventsWithMetadata = events.map(event => ({
          ...event,
          metadata: event.metadata ? JSON.parse(event.metadata) : null
        }));
        
        res.json({
          message: 'Security events retrieved successfully',
          events: eventsWithMetadata,
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: eventsWithMetadata.length
          }
        });
        
        db.close();
      });
      
    } catch (error) {
      console.error('Security events error:', error);
      next(error);
    }
  }
);

/**
 * Get system-wide security events (admin only)
 */
router.get('/events/system', 
  authenticateToken, 
  requireMFAVerification,
  requireMFAForSensitiveActions,
  async (req, res, next) => {
    try {
      // Admin only
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
      
      const { limit = 100, offset = 0, severity, eventType, timeframe = '24h' } = req.query;
      
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
      
      const db = new sqlite3.Database(DB_PATH);
      
      let timeFilter;
      switch (timeframe) {
        case '1h':
          timeFilter = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case '24h':
          timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          timeFilter = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      
      let query = `
        SELECT 
          se.id,
          se.event_type,
          se.event_description,
          se.ip_address,
          se.user_agent,
          se.severity,
          se.created_at,
          se.metadata,
          u.email as user_email,
          u.role as user_role
        FROM security_events se
        LEFT JOIN users u ON se.user_id = u.id
        WHERE se.created_at >= ?
      `;
      const params = [timeFilter.toISOString()];
      
      if (severity) {
        query += ` AND se.severity = ?`;
        params.push(severity);
      }
      
      if (eventType) {
        query += ` AND se.event_type = ?`;
        params.push(eventType);
      }
      
      query += ` ORDER BY se.created_at DESC LIMIT ? OFFSET ?`;
      params.push(limit, offset);
      
      db.all(query, params, (err, events) => {
        if (err) {
          console.error('Database error:', err);
          return next(err);
        }
        
        // Parse metadata for each event
        const eventsWithMetadata = events.map(event => ({
          ...event,
          metadata: event.metadata ? JSON.parse(event.metadata) : null
        }));
        
        res.json({
          message: 'System security events retrieved successfully',
          events: eventsWithMetadata,
          filters: {
            timeframe,
            severity,
            eventType
          },
          pagination: {
            limit: parseInt(limit),
            offset: parseInt(offset),
            total: eventsWithMetadata.length
          }
        });
        
        db.close();
      });
      
    } catch (error) {
      console.error('System security events error:', error);
      next(error);
    }
  }
);

/**
 * Get MFA statistics
 */
router.get('/mfa/stats', 
  authenticateToken, 
  requireMFAVerification,
  requireMFAForSensitiveActions,
  async (req, res, next) => {
    try {
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
      
      const db = new sqlite3.Database(DB_PATH);
      
      // Get MFA adoption rates
      const mfaStats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            role,
            COUNT(*) as total_users,
            COUNT(CASE WHEN mfa_enabled = TRUE THEN 1 END) as mfa_enabled_users,
            ROUND(COUNT(CASE WHEN mfa_enabled = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as adoption_rate
          FROM users
          GROUP BY role
        `, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Get MFA verification success rates
      const verificationStats = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            DATE(created_at) as date,
            COUNT(*) as total_attempts,
            COUNT(CASE WHEN success = TRUE THEN 1 END) as successful_attempts,
            COUNT(CASE WHEN success = FALSE THEN 1 END) as failed_attempts,
            ROUND(COUNT(CASE WHEN success = TRUE THEN 1 END) * 100.0 / COUNT(*), 2) as success_rate
          FROM mfa_attempts
          WHERE created_at >= DATE('now', '-7 days')
          GROUP BY DATE(created_at)
          ORDER BY date DESC
        `, [], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      // Get backup code usage
      const backupCodeStats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(*) as total_users_with_backup_codes,
            AVG(CASE 
              WHEN backup_codes IS NOT NULL 
              THEN json_array_length(backup_codes) 
              ELSE 0 
            END) as avg_backup_codes_per_user
          FROM mfa_settings
          WHERE backup_codes IS NOT NULL
        `, [], (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });
      
      res.json({
        message: 'MFA statistics retrieved successfully',
        stats: {
          adoption: mfaStats,
          verification: verificationStats,
          backupCodes: backupCodeStats,
          generatedAt: new Date().toISOString()
        }
      });
      
      db.close();
      
    } catch (error) {
      console.error('MFA stats error:', error);
      next(error);
    }
  }
);

/**
 * Get failed login attempts by IP
 */
router.get('/failed-attempts/ip', 
  authenticateToken, 
  requireMFAVerification,
  requireMFAForSensitiveActions,
  async (req, res, next) => {
    try {
      // Admin only
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
      
      const { timeframe = '24h', limit = 50 } = req.query;
      
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
      
      const db = new sqlite3.Database(DB_PATH);
      
      let timeFilter;
      switch (timeframe) {
        case '1h':
          timeFilter = new Date(Date.now() - 60 * 60 * 1000);
          break;
        case '24h':
          timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          timeFilter = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
          break;
        default:
          timeFilter = new Date(Date.now() - 24 * 60 * 60 * 1000);
      }
      
      const failedAttempts = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            ip_address,
            COUNT(*) as total_failures,
            COUNT(DISTINCT user_id) as unique_users_affected,
            GROUP_CONCAT(DISTINCT u.email) as affected_emails,
            MAX(created_at) as last_attempt
          FROM security_events
          LEFT JOIN users u ON security_events.user_id = u.id
          WHERE event_type IN ('login_failure', 'mfa_failed') 
            AND created_at >= ?
          GROUP BY ip_address
          HAVING total_failures >= 5
          ORDER BY total_failures DESC, last_attempt DESC
          LIMIT ?
        `, [timeFilter.toISOString(), limit], (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      res.json({
        message: 'Failed attempts by IP retrieved successfully',
        timeframe,
        data: failedAttempts.map(row => ({
          ...row,
          affectedEmails: row.affected_emails ? row.affected_emails.split(',') : []
        })),
        generatedAt: new Date().toISOString()
      });
      
      db.close();
      
    } catch (error) {
      console.error('Failed attempts by IP error:', error);
      next(error);
    }
  }
);

/**
 * Get account lockout status
 */
router.get('/lockouts', 
  authenticateToken, 
  requireMFAVerification,
  requireMFAForSensitiveActions,
  async (req, res, next) => {
    try {
      // Admin only
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
      
      const { active = 'true', limit = 50 } = req.query;
      
      const sqlite3 = require('sqlite3').verbose();
      const path = require('path');
      const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
      
      const db = new sqlite3.Database(DB_PATH);
      
      let query = `
        SELECT 
          u.id,
          u.email,
          u.role,
          u.account_locked,
          u.locked_until,
          u.failed_mfa_attempts,
          u.last_mfa_verification,
          COUNT(se.id) as lockout_events
        FROM users u
        LEFT JOIN security_events se ON u.id = se.user_id 
          AND se.event_type = 'account_locked'
          AND se.created_at >= DATE('now', '-7 days')
      `;
      
      const params = [];
      
      if (active === 'true') {
        query += ` WHERE u.account_locked = TRUE AND u.locked_until > CURRENT_TIMESTAMP`;
      } else if (active === 'false') {
        query += ` WHERE u.account_locked = FALSE`;
      }
      
      query += ` GROUP BY u.id, u.email, u.role ORDER BY u.locked_until DESC LIMIT ?`;
      params.push(limit);
      
      const lockouts = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });
      
      res.json({
        message: 'Account lockout status retrieved successfully',
        filter: { active },
        data: lockouts,
        generatedAt: new Date().toISOString()
      });
      
      db.close();
      
    } catch (error) {
      console.error('Account lockout status error:', error);
      next(error);
    }
  }
);

/**
 * Trigger manual security check (admin only)
 */
router.post('/check', 
  authenticateToken, 
  requireMFAVerification,
  requireMFAForSensitiveActions,
  async (req, res, next) => {
    try {
      // Admin only
      if (req.user.role !== 'admin') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Admin access required'
        });
      }
      
      const result = await securityMonitoringService.performSecurityChecks();
      
      res.json({
        message: 'Security check completed',
        result
      });
      
    } catch (error) {
      console.error('Manual security check error:', error);
      next(error);
    }
  }
);

module.exports = router;
