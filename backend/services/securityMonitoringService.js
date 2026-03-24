const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

class SecurityMonitoringService {
  constructor() {
    this.suspiciousActivityThresholds = {
      failedMFAAttempts: 5,
      failedLogins: 10,
      unusualLocation: true, // Flag if login from new location
      rapidAttempts: 20, // Attempts within 5 minutes
      accountLockouts: 3 // Account lockouts per hour
    };
    
    this.alertThresholds = {
      criticalEvents: 1, // Any critical event
      highSeverityEvents: 5, // High severity events per hour
      mediumSeverityEvents: 20, // Medium severity events per hour
      mfaFailureRate: 0.5 // 50% MFA failure rate
    };
  }

  /**
   * Start security monitoring service
   */
  start() {
    // Run security checks every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.performSecurityChecks().catch(console.error);
    });
    
    // Generate daily security report
    cron.schedule('0 0 * * *', () => {
      this.generateDailySecurityReport().catch(console.error);
    });
    
    // Cleanup old data weekly
    cron.schedule('0 0 * * 0', () => {
      this.cleanupOldData().catch(console.error);
    });
    
    console.log('Security monitoring service started');
  }

  /**
   * Perform comprehensive security checks
   */
  async performSecurityChecks() {
    const db = new sqlite3.Database(DB_PATH);
    
    try {
      const checks = await Promise.all([
        this.checkSuspiciousActivity(db),
        this.checkAccountLockouts(db),
        this.checkMFALockoutPatterns(db),
        this.checkUnusualLoginPatterns(db),
        this.checkBruteForceAttempts(db),
        this.checkSecurityEventTrends(db)
      ]);
      
      const alerts = checks.filter(check => check.alerts && check.alerts.length > 0);
      
      if (alerts.length > 0) {
        await this.processSecurityAlerts(alerts);
      }
      
      return {
        timestamp: new Date().toISOString(),
        checksPerformed: checks.length,
        alertsGenerated: alerts.reduce((sum, alert) => sum + alert.alerts.length, 0)
      };
      
    } finally {
      db.close();
    }
  }

  /**
   * Check for suspicious activity patterns
   */
  async checkSuspiciousActivity(db) {
    return new Promise((resolve, reject) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      // Check for users with high failure rates
      db.all(`
        SELECT 
          u.id,
          u.email,
          COUNT(CASE WHEN se.event_type = 'mfa_failed' THEN 1 END) as mfa_failures,
          COUNT(CASE WHEN se.event_type = 'login_failure' THEN 1 END) as login_failures,
          COUNT(CASE WHEN se.event_type = 'mfa_verified' THEN 1 END) as mfa_success,
          COUNT(CASE WHEN se.event_type = 'login_success' THEN 1 END) as login_success
        FROM users u
        LEFT JOIN security_events se ON u.id = se.user_id 
          AND se.created_at >= ?
        GROUP BY u.id, u.email
        HAVING (mfa_failures >= ? OR login_failures >= ?)
      `, [oneHourAgo.toISOString(), this.suspiciousActivityThresholds.failedMFAAttempts, this.suspiciousActivityThresholds.failedLogins], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const alerts = rows.map(row => ({
          type: 'suspicious_activity',
          severity: 'high',
          userId: row.id,
          email: row.email,
          details: {
            mfaFailures: row.mfa_failures,
            loginFailures: row.login_failures,
            mfaSuccess: row.mfa_success,
            loginSuccess: row.login_success
          },
          message: `Suspicious activity detected for user ${row.email}: ${row.mfa_failures} MFA failures, ${row.login_failures} login failures`
        }));
        
        resolve({ alerts });
      });
    });
  }

  /**
   * Check for account lockouts
   */
  async checkAccountLockouts(db) {
    return new Promise((resolve, reject) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      db.all(`
        SELECT 
          u.id,
          u.email,
          u.account_locked,
          u.locked_until,
          COUNT(se.id) as lockout_events
        FROM users u
        LEFT JOIN security_events se ON u.id = se.user_id 
          AND se.event_type = 'account_locked' 
          AND se.created_at >= ?
        WHERE u.account_locked = TRUE
        GROUP BY u.id, u.email
        HAVING lockout_events >= ?
      `, [oneHourAgo.toISOString(), this.suspiciousActivityThresholds.accountLockouts], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const alerts = rows.map(row => ({
          type: 'account_lockout',
          severity: row.lockout_events >= 5 ? 'critical' : 'high',
          userId: row.id,
          email: row.email,
          details: {
            lockoutEvents: row.lockout_events,
            lockedUntil: row.locked_until
          },
          message: `Account ${row.email} locked ${row.lockout_events} times in the last hour`
        }));
        
        resolve({ alerts });
      });
    });
  }

  /**
   * Check for MFA lockout patterns
   */
  async checkMFALockoutPatterns(db) {
    return new Promise((resolve, reject) => {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
      
      db.all(`
        SELECT 
          ma.user_id,
          u.email,
          COUNT(*) as rapid_attempts,
          GROUP_CONCAT(DISTINCT ma.ip_address) as ip_addresses
        FROM mfa_attempts ma
        JOIN users u ON ma.user_id = u.id
        WHERE ma.attempted_at >= ? AND ma.success = FALSE
        GROUP BY ma.user_id, u.email
        HAVING rapid_attempts >= ?
      `, [fiveMinutesAgo.toISOString(), this.suspiciousActivityThresholds.rapidAttempts], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const alerts = rows.map(row => ({
          type: 'rapid_mfa_attempts',
          severity: 'critical',
          userId: row.user_id,
          email: row.email,
          details: {
            rapidAttempts: row.rapid_attempts,
            ipAddresses: row.ip_addresses.split(','),
            timeWindow: '5 minutes'
          },
          message: `Rapid MFA attempts detected for user ${row.email}: ${row.rapid_attempts} failed attempts in 5 minutes`
        }));
        
        resolve({ alerts });
      });
    });
  }

  /**
   * Check for unusual login patterns
   */
  async checkUnusualLoginPatterns(db) {
    return new Promise((resolve, reject) => {
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      db.all(`
        WITH recent_logins AS (
          SELECT 
            user_id,
            ip_address,
            COUNT(*) as recent_count
          FROM security_events
          WHERE event_type = 'login_success' 
            AND created_at >= ?
          GROUP BY user_id, ip_address
        ),
        historical_logins AS (
          SELECT 
            user_id,
            ip_address,
            COUNT(*) as historical_count
          FROM security_events
          WHERE event_type = 'login_success' 
            AND created_at >= ? 
            AND created_at < ?
          GROUP BY user_id, ip_address
        )
        SELECT 
          rl.user_id,
          u.email,
          rl.ip_address,
          rl.recent_count,
          COALESCE(hl.historical_count, 0) as historical_count
        FROM recent_logins rl
        JOIN users u ON rl.user_id = u.id
        LEFT JOIN historical_logins hl ON rl.user_id = hl.user_id AND rl.ip_address = hl.ip_address
        WHERE hl.historical_count = 0 OR rl.recent_count > hl.historical_count * 2
      `, [twentyFourHoursAgo.toISOString(), sevenDaysAgo.toISOString(), twentyFourHoursAgo.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const alerts = rows.map(row => ({
          type: 'unusual_location',
          severity: row.historical_count === 0 ? 'high' : 'medium',
          userId: row.user_id,
          email: row.email,
          details: {
            ipAddress: row.ip_address,
            recentCount: row.recent_count,
            historicalCount: row.historical_count,
            isNewLocation: row.historical_count === 0
          },
          message: row.historical_count === 0 
            ? `New login location detected for user ${row.email}: ${row.ip_address}`
            : `Unusual login activity for user ${row.email}: ${row.recent_count} logins from ${row.ip_address} (normally ${row.historical_count})`
        }));
        
        resolve({ alerts });
      });
    });
  }

  /**
   * Check for brute force attempts
   */
  async checkBruteForceAttempts(db) {
    return new Promise((resolve, reject) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      db.all(`
        SELECT 
          ip_address,
          COUNT(*) as total_attempts,
          COUNT(DISTINCT user_id) as targeted_users,
          GROUP_CONCAT(DISTINCT user_id) as user_ids
        FROM security_events
        WHERE event_type IN ('login_failure', 'mfa_failed') 
          AND created_at >= ?
        GROUP BY ip_address
        HAVING total_attempts >= 50 AND targeted_users >= 3
      `, [oneHourAgo.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const alerts = rows.map(row => ({
          type: 'brute_force',
          severity: 'critical',
          details: {
            ipAddress: row.ip_address,
            totalAttempts: row.total_attempts,
            targetedUsers: row.targeted_users,
            userIds: row.user_ids.split(',').map(id => parseInt(id))
          },
          message: `Brute force attack detected from ${row.ip_address}: ${row.total_attempts} attempts against ${row.targeted_users} users`
        }));
        
        resolve({ alerts });
      });
    });
  }

  /**
   * Check security event trends
   */
  async checkSecurityEventTrends(db) {
    return new Promise((resolve, reject) => {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      
      db.all(`
        SELECT 
          event_type,
          severity,
          COUNT(*) as event_count,
          COUNT(DISTINCT user_id) as affected_users
        FROM security_events
        WHERE created_at >= ?
        GROUP BY event_type, severity
        HAVING (severity = 'critical' AND event_count >= ?) 
           OR (severity = 'high' AND event_count >= ?)
           OR (severity = 'medium' AND event_count >= ?)
      `, [oneHourAgo.toISOString(), 
          this.alertThresholds.criticalEvents,
          this.alertThresholds.highSeverityEvents,
          this.alertThresholds.mediumSeverityEvents], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const alerts = rows.map(row => ({
          type: 'security_trend',
          severity: row.severity,
          details: {
            eventType: row.event_type,
            eventCount: row.event_count,
            affectedUsers: row.affected_users,
            timeWindow: '1 hour'
          },
          message: `Security trend alert: ${row.event_count} ${row.event_type} events affecting ${row.affected_users} users in the last hour`
        }));
        
        resolve({ alerts });
      });
    });
  }

  /**
   * Process security alerts
   */
  async processSecurityAlerts(alerts) {
    for (const alertGroup of alerts) {
      for (const alert of alertGroup.alerts) {
        await this.handleSecurityAlert(alert);
      }
    }
  }

  /**
   * Handle individual security alert
   */
  async handleSecurityAlert(alert) {
    // Log the alert
    await this.logSecurityAlert(alert);
    
    // Take automated actions based on alert type and severity
    switch (alert.type) {
      case 'brute_force':
        await this.handleBruteForceAlert(alert);
        break;
      case 'rapid_mfa_attempts':
        await this.handleRapidAttemptsAlert(alert);
        break;
      case 'account_lockout':
        await this.handleAccountLockoutAlert(alert);
        break;
      case 'suspicious_activity':
        await this.handleSuspiciousActivityAlert(alert);
        break;
      case 'unusual_location':
        await this.handleUnusualLocationAlert(alert);
        break;
      case 'security_trend':
        await this.handleSecurityTrendAlert(alert);
        break;
    }
    
    // Send notifications for critical alerts
    if (alert.severity === 'critical') {
      await this.sendCriticalAlert(alert);
    }
  }

  /**
   * Handle brute force alerts
   */
  async handleBruteForceAlert(alert) {
    const db = new sqlite3.Database(DB_PATH);
    
    // Block the IP address temporarily
    await this.blockIPAddress(alert.details.ipAddress, 24 * 60 * 60 * 1000); // 24 hours
    
    // Lock affected accounts temporarily
    for (const userId of alert.details.userIds) {
      await this.lockUserAccount(userId, 2 * 60 * 60 * 1000); // 2 hours
    }
    
    db.close();
  }

  /**
   * Handle rapid MFA attempts
   */
  async handleRapidAttemptsAlert(alert) {
    // Lock the user account immediately
    await this.lockUserAccount(alert.userId, 4 * 60 * 60 * 1000); // 4 hours
    
    // Block the IP addresses
    for (const ipAddress of alert.details.ipAddresses) {
      await this.blockIPAddress(ipAddress, 12 * 60 * 60 * 1000); // 12 hours
    }
  }

  /**
   * Handle suspicious activity alerts
   */
  async handleSuspiciousActivityAlert(alert) {
    // Require MFA for next login if not already required
    await this.requireMFAForUser(alert.userId);
    
    // Send security notification to user
    await this.sendUserSecurityNotification(alert.userId, 'suspicious_activity', alert.details);
  }

  /**
   * Handle unusual location alerts
   */
  async handleUnusualLocationAlert(alert) {
    // Send notification to user about new location
    await this.sendUserSecurityNotification(alert.userId, 'new_location', alert.details);
    
    // If it's a completely new location, require MFA verification
    if (alert.details.isNewLocation) {
      await this.requireMFAForUser(alert.userId);
    }
  }

  /**
   * Handle security trend alerts
   */
  async handleSecurityTrendAlert(alert) {
    // Log for security team review
    console.warn(`Security trend alert: ${alert.message}`);
    
    // If it's a critical trend, consider temporary measures
    if (alert.severity === 'critical') {
      // Could implement global rate limiting or other measures
      await this.logSecurityEvent(null, 'critical_trend_detected', alert.message, {
        alert: alert,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Block IP address
   */
  async blockIPAddress(ipAddress, duration) {
    // This would integrate with firewall or load balancer
    // For now, just log the action
    console.log(`Blocking IP address ${ipAddress} for ${duration}ms`);
    
    await this.logSecurityEvent(null, 'ip_blocked', `IP address ${ipAddress} blocked due to suspicious activity`, {
      ipAddress: ipAddress,
      duration: duration,
      blockedAt: new Date().toISOString()
    });
  }

  /**
   * Lock user account
   */
  async lockUserAccount(userId, duration) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      const lockedUntil = new Date(Date.now() + duration);
      
      db.run(`
        UPDATE users 
        SET account_locked = TRUE, locked_until = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [lockedUntil.toISOString(), userId], (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`User account ${userId} locked until ${lockedUntil.toISOString()}`);
          resolve();
        }
      });
      
      db.close();
    });
  }

  /**
   * Require MFA for user
   */
  async requireMFAForUser(userId) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.run(`
        UPDATE users 
        SET mfa_required = TRUE, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `, [userId], (err) => {
        if (err) {
          reject(err);
        } else {
          console.log(`MFA requirement enabled for user ${userId}`);
          resolve();
        }
      });
      
      db.close();
    });
  }

  /**
   * Send user security notification
   */
  async sendUserSecurityNotification(userId, notificationType, details) {
    // This would integrate with email/SMS notification system
    // For now, just log the notification
    console.log(`Security notification sent to user ${userId}: ${notificationType}`, details);
    
    await this.logSecurityEvent(userId, 'security_notification_sent', `Security notification: ${notificationType}`, details);
  }

  /**
   * Send critical alert to security team
   */
  async sendCriticalAlert(alert) {
    // This would integrate with alerting system (email, Slack, PagerDuty, etc.)
    console.error('CRITICAL SECURITY ALERT:', alert);
    
    // Could also implement webhook calls or other notification methods
  }

  /**
   * Log security alert
   */
  async logSecurityAlert(alert) {
    await this.logSecurityEvent(alert.userId, 'security_alert', alert.message, alert);
  }

  /**
   * Log security event
   */
  async logSecurityEvent(userId, eventType, description, metadata = {}) {
    const db = new sqlite3.Database(DB_PATH);
    
    return new Promise((resolve, reject) => {
      db.run(`
        INSERT INTO security_events (user_id, event_type, event_description, ip_address, user_agent, session_id, metadata, severity)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        userId,
        eventType,
        description,
        metadata.ipAddress || null,
        metadata.userAgent || null,
        metadata.sessionId || null,
        JSON.stringify(metadata),
        metadata.severity || 'medium'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
      
      db.close();
    });
  }

  /**
   * Generate daily security report
   */
  async generateDailySecurityReport() {
    const db = new sqlite3.Database(DB_PATH);
    
    try {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const startOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      const endOfDay = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate() + 1);
      
      const report = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            event_type,
            severity,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as affected_users
          FROM security_events
          WHERE created_at >= ? AND created_at < ?
          GROUP BY event_type, severity
          ORDER BY severity DESC, event_count DESC
        `, [startOfDay.toISOString(), endOfDay.toISOString()], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              date: yesterday.toISOString().split('T')[0],
              generatedAt: new Date().toISOString(),
              events: rows,
              summary: {
                totalEvents: rows.reduce((sum, row) => sum + row.event_count, 0),
                criticalEvents: rows.filter(row => row.severity === 'critical').reduce((sum, row) => sum + row.event_count, 0),
                highEvents: rows.filter(row => row.severity === 'high').reduce((sum, row) => sum + row.event_count, 0),
                affectedUsers: rows.reduce((sum, row) => sum + row.affected_users, 0)
              }
            });
          }
        });
      });
      
      console.log('Daily security report generated:', JSON.stringify(report, null, 2));
      
      // Store the report or send it to security team
      await this.storeSecurityReport(report);
      
      return report;
      
    } finally {
      db.close();
    }
  }

  /**
   * Store security report
   */
  async storeSecurityReport(report) {
    // This could store reports in a separate table or file system
    // For now, just log it
    console.log(`Security report for ${report.date} stored with ${report.summary.totalEvents} events`);
  }

  /**
   * Clean up old data
   */
  async cleanupOldData() {
    const db = new sqlite3.Database(DB_PATH);
    
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      // Clean up old MFA attempts
      await new Promise((resolve, reject) => {
        db.run(`
          DELETE FROM mfa_attempts WHERE attempted_at < ?
        `, [thirtyDaysAgo.toISOString()], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Clean up old MFA sessions
      await new Promise((resolve, reject) => {
        db.run(`
          DELETE FROM mfa_sessions WHERE created_at < ?
        `, [thirtyDaysAgo.toISOString()], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      // Archive old security events (keep them but move to archive table)
      // For now, just delete events older than 90 days
      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
      
      await new Promise((resolve, reject) => {
        db.run(`
          DELETE FROM security_events WHERE created_at < ?
        `, [ninetyDaysAgo.toISOString()], (err) => {
          if (err) reject(err);
          else resolve();
        });
      });
      
      console.log('Security data cleanup completed');
      
    } finally {
      db.close();
    }
  }

  /**
   * Get security dashboard data
   */
  async getSecurityDashboard(timeframe = '24h') {
    const db = new sqlite3.Database(DB_PATH);
    
    try {
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
      
      const dashboard = await new Promise((resolve, reject) => {
        db.all(`
          SELECT 
            event_type,
            severity,
            COUNT(*) as event_count,
            COUNT(DISTINCT user_id) as affected_users,
            DATE(created_at) as event_date
          FROM security_events
          WHERE created_at >= ?
          GROUP BY DATE(created_at), event_type, severity
          ORDER BY event_date DESC, event_count DESC
        `, [timeFilter.toISOString()], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              timeframe,
              generatedAt: new Date().toISOString(),
              events: rows,
              summary: {
                totalEvents: rows.reduce((sum, row) => sum + row.event_count, 0),
                criticalEvents: rows.filter(row => row.severity === 'critical').reduce((sum, row) => sum + row.event_count, 0),
                highEvents: rows.filter(row => row.severity === 'high').reduce((sum, row) => sum + row.event_count, 0),
                mediumEvents: rows.filter(row => row.severity === 'medium').reduce((sum, row) => sum + row.event_count, 0),
                lowEvents: rows.filter(row => row.severity === 'low').reduce((sum, row) => sum + row.event_count, 0),
                affectedUsers: rows.reduce((sum, row) => sum + row.affected_users, 0)
              }
            });
          }
        });
      });
      
      return dashboard;
      
    } finally {
      db.close();
    }
  }
}

module.exports = new SecurityMonitoringService();
