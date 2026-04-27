const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');

class AuditLogService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.logRetentionDays = parseInt(process.env.AUDIT_LOG_RETENTION_DAYS) || 365;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      await this.cleanupOldLogs();
      console.log('✅ Audit Log Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Audit Log Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for audit logging');
          resolve();
        }
      });
    });
  }

  /**
   * Log authentication event
   * @param {object} eventData - Event data
   */
  async logAuthEvent(eventData) {
    try {
      const {
        userId,
        action,
        success,
        ipAddress,
        userAgent,
        deviceInfo,
        details = {},
        timestamp = new Date()
      } = eventData;

      const logEntry = {
        user_id: userId,
        action: action,
        resource_type: 'auth',
        resource_id: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: JSON.stringify(deviceInfo || {}),
        success: success,
        failure_reason: success ? null : (details.reason || 'Unknown'),
        details: JSON.stringify(details),
        created_at: timestamp.toISOString()
      };

      return await this.insertLogEntry(logEntry);
    } catch (error) {
      console.error('Error logging auth event:', error);
      throw error;
    }
  }

  /**
   * Log authorization event
   * @param {object} eventData - Event data
   */
  async logAuthzEvent(eventData) {
    try {
      const {
        userId,
        action,
        resourceType,
        resourceId,
        success,
        ipAddress,
        userAgent,
        details = {},
        timestamp = new Date()
      } = eventData;

      const logEntry = {
        user_id: userId,
        action: action,
        resource_type: resourceType,
        resource_id: resourceId,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: '{}',
        success: success,
        failure_reason: success ? null : (details.reason || 'Access denied'),
        details: JSON.stringify(details),
        created_at: timestamp.toISOString()
      };

      return await this.insertLogEntry(logEntry);
    } catch (error) {
      console.error('Error logging authz event:', error);
      throw error;
    }
  }

  /**
   * Log data access event
   * @param {object} eventData - Event data
   */
  async logDataAccessEvent(eventData) {
    try {
      const {
        userId,
        action, // 'read', 'write', 'delete', 'export', etc.
        resourceType,
        resourceId,
        recordIds = [],
        success,
        ipAddress,
        userAgent,
        details = {},
        timestamp = new Date()
      } = eventData;

      const enrichedDetails = {
        ...details,
        recordIds,
        recordCount: recordIds.length
      };

      const logEntry = {
        user_id: userId,
        action: `data_${action}`,
        resource_type: resourceType,
        resource_id: resourceId,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: '{}',
        success: success,
        failure_reason: success ? null : (details.reason || 'Data access failed'),
        details: JSON.stringify(enrichedDetails),
        created_at: timestamp.toISOString()
      };

      return await this.insertLogEntry(logEntry);
    } catch (error) {
      console.error('Error logging data access event:', error);
      throw error;
    }
  }

  /**
   * Log system event
   * @param {object} eventData - Event data
   */
  async logSystemEvent(eventData) {
    try {
      const {
        action,
        category, // 'security', 'performance', 'error', 'maintenance', etc.
        severity, // 'low', 'medium', 'high', 'critical'
        success = true,
        details = {},
        ipAddress,
        userAgent,
        timestamp = new Date()
      } = eventData;

      const logEntry = {
        user_id: null,
        action: `system_${action}`,
        resource_type: 'system',
        resource_id: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: '{}',
        success: success,
        failure_reason: success ? null : (details.reason || 'System event failed'),
        details: JSON.stringify({ ...details, category, severity }),
        created_at: timestamp.toISOString()
      };

      return await this.insertLogEntry(logEntry);
    } catch (error) {
      console.error('Error logging system event:', error);
      throw error;
    }
  }

  /**
   * Log compliance event
   * @param {object} eventData - Event data
   */
  async logComplianceEvent(eventData) {
    try {
      const {
        userId,
        action,
        regulation, // 'HIPAA', 'GDPR', 'SOX', etc.
        requirement, // Specific regulation requirement
        success,
        details = {},
        ipAddress,
        userAgent,
        timestamp = new Date()
      } = eventData;

      const enrichedDetails = {
        ...details,
        regulation,
        requirement
      };

      const logEntry = {
        user_id: userId,
        action: `compliance_${action}`,
        resource_type: 'compliance',
        resource_id: null,
        ip_address: ipAddress,
        user_agent: userAgent,
        device_info: '{}',
        success: success,
        failure_reason: success ? null : (details.reason || 'Compliance check failed'),
        details: JSON.stringify(enrichedDetails),
        created_at: timestamp.toISOString()
      };

      return await this.insertLogEntry(logEntry);
    } catch (error) {
      console.error('Error logging compliance event:', error);
      throw error;
    }
  }

  /**
   * Insert log entry into database
   * @param {object} logEntry - Log entry data
   */
  async insertLogEntry(logEntry) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO auth_audit_log 
        (user_id, action, resource_type, resource_id, ip_address, user_agent, 
         device_info, success, failure_reason, details, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(query, [
        logEntry.user_id,
        logEntry.action,
        logEntry.resource_type,
        logEntry.resource_id,
        logEntry.ip_address,
        logEntry.user_agent,
        logEntry.device_info,
        logEntry.success,
        logEntry.failure_reason,
        logEntry.details,
        logEntry.created_at
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
   * Query audit logs
   * @param {object} filters - Query filters
   * @param {object} pagination - Pagination options
   */
  async queryLogs(filters = {}, pagination = {}) {
    try {
      const {
        userId,
        action,
        resourceType,
        success,
        ipAddress,
        dateFrom,
        dateTo,
        search
      } = filters;

      const {
        page = 1,
        limit = 100,
        sortBy = 'created_at',
        sortOrder = 'DESC'
      } = pagination;

      let query = `
        SELECT al.*, u.username, u.email, u.first_name, u.last_name
        FROM auth_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE 1=1
      `;
      
      const params = [];

      // Apply filters
      if (userId) {
        query += ' AND al.user_id = ?';
        params.push(userId);
      }

      if (action) {
        query += ' AND al.action LIKE ?';
        params.push(`%${action}%`);
      }

      if (resourceType) {
        query += ' AND al.resource_type = ?';
        params.push(resourceType);
      }

      if (success !== undefined) {
        query += ' AND al.success = ?';
        params.push(success);
      }

      if (ipAddress) {
        query += ' AND al.ip_address LIKE ?';
        params.push(`%${ipAddress}%`);
      }

      if (dateFrom) {
        query += ' AND al.created_at >= ?';
        params.push(dateFrom.toISOString());
      }

      if (dateTo) {
        query += ' AND al.created_at <= ?';
        params.push(dateTo.toISOString());
      }

      if (search) {
        query += ' AND (al.action LIKE ? OR al.failure_reason LIKE ? OR u.username LIKE ? OR u.email LIKE ?)';
        const searchTerm = `%${search}%`;
        params.push(searchTerm, searchTerm, searchTerm, searchTerm);
      }

      // Add sorting
      const validSortFields = ['created_at', 'action', 'resource_type', 'success', 'ip_address'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'created_at';
      const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      
      query += ` ORDER BY al.${sortField} ${sortDirection}`;

      // Add pagination
      const offset = (page - 1) * limit;
      query += ' LIMIT ? OFFSET ?';
      params.push(limit, offset);

      // Get total count
      const countQuery = query.replace(/SELECT.*?FROM/, 'SELECT COUNT(*) as total FROM').replace(/ORDER BY.*$/, '');
      
      const [logs, countResult] = await Promise.all([
        this.queryLogsDB(query, params),
        this.queryCountDB(countQuery, params.slice(0, -2)) // Remove limit and offset for count
      ]);

      return {
        logs,
        pagination: {
          page,
          limit,
          total: countResult.total,
          pages: Math.ceil(countResult.total / limit)
        }
      };
    } catch (error) {
      console.error('Error querying logs:', error);
      throw error;
    }
  }

  /**
   * Execute logs query
   * @param {string} query - SQL query
   * @param {array} params - Query parameters
   */
  async queryLogsDB(query, params) {
    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Execute count query
   * @param {string} query - SQL query
   * @param {array} params - Query parameters
   */
  async queryCountDB(query, params) {
    return new Promise((resolve, reject) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || { total: 0 });
        }
      });
    });
  }

  /**
   * Get log by ID
   * @param {number} logId - Log ID
   */
  async getLogById(logId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT al.*, u.username, u.email, u.first_name, u.last_name
        FROM auth_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.id = ?
      `;
      
      this.db.get(query, [logId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get authentication statistics
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getAuthStatistics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          action,
          COUNT(*) as total_events,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_events,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_events,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT ip_address) as unique_ips
        FROM auth_audit_log
        WHERE created_at >= ? AND created_at <= ?
          AND resource_type = 'auth'
        GROUP BY action
        ORDER BY total_events DESC
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
   * Get security events
   * @param {object} filters - Event filters
   */
  async getSecurityEvents(filters = {}) {
    try {
      const {
        severity = 'high',
        limit = 100,
        dateFrom = new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
        dateTo = new Date()
      } = filters;

      const securityActions = [
        'login_failed', 'password_changed', 'mfa_enabled', 'mfa_disabled',
        'session_created', 'session_invalidated', 'role_assigned', 'role_removed',
        'permission_granted', 'permission_revoked', 'account_locked', 'account_unlocked',
        'suspicious_activity', 'data_access_denied', 'compliance_violation'
      ];

      const query = `
        SELECT al.*, u.username, u.email, u.first_name, u.last_name
        FROM auth_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action IN (${securityActions.map(() => '?').join(',')})
          AND al.created_at >= ? AND al.created_at <= ?
          AND al.success = false
        ORDER BY al.created_at DESC
        LIMIT ?
      `;

      const params = [
        ...securityActions,
        dateFrom.toISOString(),
        dateTo.toISOString(),
        limit
      ];

      return new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    } catch (error) {
      console.error('Error getting security events:', error);
      throw error;
    }
  }

  /**
   * Get user activity timeline
   * @param {number} userId - User ID
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   */
  async getUserActivityTimeline(userId, startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE(created_at) as date,
          action,
          resource_type,
          success,
          COUNT(*) as event_count,
          GROUP_CONCAT(DISTINCT ip_address) as ip_addresses,
          MIN(created_at) as first_event,
          MAX(created_at) as last_event
        FROM auth_audit_log
        WHERE user_id = ? AND created_at >= ? AND created_at <= ?
        GROUP BY DATE(created_at), action, resource_type, success
        ORDER BY date DESC, first_event DESC
      `;
      
      this.db.all(query, [userId, startDate.toISOString(), endDate.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get data access logs
   * @param {object} filters - Data access filters
   */
  async getDataAccessLogs(filters = {}) {
    try {
      const {
        resourceType,
        userId,
        dateFrom = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
        dateTo = new Date(),
        limit = 1000
      } = filters;

      let query = `
        SELECT al.*, u.username, u.email, u.first_name, u.last_name
        FROM auth_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action LIKE 'data_%'
          AND al.created_at >= ? AND al.created_at <= ?
      `;
      
      const params = [dateFrom.toISOString(), dateTo.toISOString()];

      if (resourceType) {
        query += ' AND al.resource_type = ?';
        params.push(resourceType);
      }

      if (userId) {
        query += ' AND al.user_id = ?';
        params.push(userId);
      }

      query += ' ORDER BY al.created_at DESC LIMIT ?';
      params.push(limit);

      return new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    } catch (error) {
      console.error('Error getting data access logs:', error);
      throw error;
    }
  }

  /**
   * Get compliance report
   * @param {object} filters - Compliance filters
   */
  async getComplianceReport(filters = {}) {
    try {
      const {
        regulation,
        dateFrom = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        dateTo = new Date()
      } = filters;

      let query = `
        SELECT 
          JSON_EXTRACT(details, '$.regulation') as regulation,
          JSON_EXTRACT(details, '$.requirement') as requirement,
          action,
          COUNT(*) as total_events,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as compliant_events,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as non_compliant_events,
          COUNT(DISTINCT user_id) as affected_users,
          MIN(created_at) as first_occurrence,
          MAX(created_at) as last_occurrence
        FROM auth_audit_log
        WHERE action LIKE 'compliance_%'
          AND created_at >= ? AND created_at <= ?
      `;
      
      const params = [dateFrom.toISOString(), dateTo.toISOString()];

      if (regulation) {
        query += ' AND JSON_EXTRACT(details, "$.regulation") = ?';
        params.push(regulation);
      }

      query += ' GROUP BY JSON_EXTRACT(details, "$.regulation"), JSON_EXTRACT(details, "$.requirement"), action';

      return new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    } catch (error) {
      console.error('Error getting compliance report:', error);
      throw error;
    }
  }

  /**
   * Detect anomalous activity
   * @param {object} options - Detection options
   */
  async detectAnomalousActivity(options = {}) {
    try {
      const {
        timeWindow = 60 * 60 * 1000, // 1 hour
        threshold = 10, // Max events per time window
        lookback = 24 * 60 * 60 * 1000 // Lookback period
      } = options;

      const now = new Date();
      const windowStart = new Date(now.getTime() - timeWindow);
      const lookbackStart = new Date(now.getTime() - lookback);

      const query = `
        SELECT 
          user_id,
          action,
          COUNT(*) as event_count,
          COUNT(DISTINCT ip_address) as unique_ips,
          GROUP_CONCAT(DISTINCT ip_address) as ip_addresses,
          MIN(created_at) as first_event,
          MAX(created_at) as last_event
        FROM auth_audit_log
        WHERE created_at >= ? AND created_at <= ?
        GROUP BY user_id, action
        HAVING event_count > ?
        ORDER BY event_count DESC
      `;

      return new Promise((resolve, reject) => {
        this.db.all(query, [windowStart.toISOString(), now.toISOString(), threshold], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    } catch (error) {
      console.error('Error detecting anomalous activity:', error);
      throw error;
    }
  }

  /**
   * Generate audit report
   * @param {object} reportConfig - Report configuration
   */
  async generateAuditReport(reportConfig) {
    try {
      const {
        reportType,
        dateFrom,
        dateTo,
        filters = {},
        format = 'json'
      } = reportConfig;

      let reportData;

      switch (reportType) {
        case 'summary':
          reportData = await this.generateSummaryReport(dateFrom, dateTo, filters);
          break;
        case 'security':
          reportData = await this.generateSecurityReport(dateFrom, dateTo, filters);
          break;
        case 'compliance':
          reportData = await this.generateComplianceReport(dateFrom, dateTo, filters);
          break;
        case 'user_activity':
          reportData = await this.generateUserActivityReport(dateFrom, dateTo, filters);
          break;
        case 'data_access':
          reportData = await this.generateDataAccessReport(dateFrom, dateTo, filters);
          break;
        default:
          throw new Error(`Unknown report type: ${reportType}`);
      }

      return {
        reportType,
        dateRange: { from: dateFrom, to: dateTo },
        generatedAt: new Date(),
        data: reportData
      };
    } catch (error) {
      console.error('Error generating audit report:', error);
      throw error;
    }
  }

  /**
   * Generate summary report
   */
  async generateSummaryReport(dateFrom, dateTo, filters) {
    const [authStats, securityEvents, totalEvents, uniqueUsers] = await Promise.all([
      this.getAuthStatistics(dateFrom, dateTo),
      this.getSecurityEvents({ dateFrom, dateTo, limit: 50 }),
      this.getTotalEventCount(dateFrom, dateTo),
      this.getUniqueUserCount(dateFrom, dateTo)
    ]);

    return {
      overview: {
        totalEvents,
        uniqueUsers,
        securityEvents: securityEvents.length,
        timeframe: { from: dateFrom, to: dateTo }
      },
      authentication: authStats,
      securityEvents: securityEvents.slice(0, 10) // Top 10 security events
    };
  }

  /**
   * Generate security report
   */
  async generateSecurityReport(dateFrom, dateTo, filters) {
    const [securityEvents, failedLogins, suspiciousActivity, anomalousActivity] = await Promise.all([
      this.getSecurityEvents({ dateFrom, dateTo, limit: 500 }),
      this.getFailedLogins(dateFrom, dateTo),
      this.getSuspiciousActivity(dateFrom, dateTo),
      this.detectAnomalousActivity()
    ]);

    return {
      securityEvents,
      failedLogins,
      suspiciousActivity,
      anomalousActivity,
      recommendations: this.generateSecurityRecommendations({
        securityEvents,
        failedLogins,
        suspiciousActivity,
        anomalousActivity
      })
    };
  }

  /**
   * Generate compliance report
   */
  async generateComplianceReport(dateFrom, dateTo, filters) {
    const complianceData = await this.getComplianceReport({ dateFrom, dateTo, ...filters });
    
    return {
      complianceData,
      overallComplianceRate: this.calculateComplianceRate(complianceData),
      violations: complianceData.filter(item => item.non_compliant_events > 0),
      recommendations: this.generateComplianceRecommendations(complianceData)
    };
  }

  /**
   * Generate user activity report
   */
  async generateUserActivityReport(dateFrom, dateTo, filters) {
    const { userId } = filters;
    
    if (userId) {
      const timeline = await this.getUserActivityTimeline(userId, dateFrom, dateTo);
      const userStats = await this.getUserStatistics(userId, dateFrom, dateTo);
      
      return {
        userId,
        timeline,
        statistics: userStats
      };
    } else {
      const topUsers = await this.getTopActiveUsers(dateFrom, dateTo);
      return {
        topUsers
      };
    }
  }

  /**
   * Generate data access report
   */
  async generateDataAccessReport(dateFrom, dateTo, filters) {
    const dataAccessLogs = await this.getDataAccessLogs({ dateFrom, dateTo, ...filters });
    
    return {
      dataAccessLogs,
      summary: this.summarizeDataAccess(dataAccessLogs),
      topResources: this.getTopAccessedResources(dataAccessLogs),
      topUsers: this.getTopDataAccessUsers(dataAccessLogs)
    };
  }

  /**
   * Get total event count
   */
  async getTotalEventCount(dateFrom, dateTo) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(*) as count FROM auth_audit_log WHERE created_at >= ? AND created_at <= ?';
      
      this.db.get(query, [dateFrom.toISOString(), dateTo.toISOString()], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  /**
   * Get unique user count
   */
  async getUniqueUserCount(dateFrom, dateTo) {
    return new Promise((resolve, reject) => {
      const query = 'SELECT COUNT(DISTINCT user_id) as count FROM auth_audit_log WHERE created_at >= ? AND created_at <= ?';
      
      this.db.get(query, [dateFrom.toISOString(), dateTo.toISOString()], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.count || 0);
        }
      });
    });
  }

  /**
   * Get failed logins
   */
  async getFailedLogins(dateFrom, dateTo) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT al.*, u.username, u.email
        FROM auth_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action = 'login_failed' 
          AND al.created_at >= ? AND al.created_at <= ?
        ORDER BY al.created_at DESC
        LIMIT 100
      `;
      
      this.db.all(query, [dateFrom.toISOString(), dateTo.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get suspicious activity
   */
  async getSuspiciousActivity(dateFrom, dateTo) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT al.*, u.username, u.email
        FROM auth_audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        WHERE al.action = 'suspicious_activity' 
          AND al.created_at >= ? AND al.created_at <= ?
        ORDER BY al.created_at DESC
        LIMIT 50
      `;
      
      this.db.all(query, [dateFrom.toISOString(), dateTo.toISOString()], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(userId, dateFrom, dateTo) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_events,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_events,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_events,
          COUNT(DISTINCT action) as unique_actions,
          COUNT(DISTINCT ip_address) as unique_ips,
          MIN(created_at) as first_activity,
          MAX(created_at) as last_activity
        FROM auth_audit_log
        WHERE user_id = ? AND created_at >= ? AND created_at <= ?
      `;
      
      this.db.get(query, [userId, dateFrom.toISOString(), dateTo.toISOString()], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }

  /**
   * Get top active users
   */
  async getTopActiveUsers(dateFrom, dateTo, limit = 20) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          al.user_id,
          u.username,
          u.email,
          COUNT(*) as activity_count,
          COUNT(DISTINCT al.action) as unique_actions,
          COUNT(DISTINCT al.ip_address) as unique_ips
        FROM auth_audit_log al
        JOIN users u ON al.user_id = u.id
        WHERE al.created_at >= ? AND al.created_at <= ?
        GROUP BY al.user_id, u.username, u.email
        ORDER BY activity_count DESC
        LIMIT ?
      `;
      
      this.db.all(query, [dateFrom.toISOString(), dateTo.toISOString(), limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Calculate compliance rate
   */
  calculateComplianceRate(complianceData) {
    const totalEvents = complianceData.reduce((sum, item) => sum + item.total_events, 0);
    const compliantEvents = complianceData.reduce((sum, item) => sum + item.compliant_events, 0);
    
    return totalEvents > 0 ? (compliantEvents / totalEvents) * 100 : 100;
  }

  /**
   * Generate security recommendations
   */
  generateSecurityRecommendations(data) {
    const recommendations = [];
    
    if (data.failedLogins.length > 100) {
      recommendations.push({
        type: 'high_failed_logins',
        message: 'High number of failed login attempts detected',
        priority: 'high',
        action: 'Consider implementing account lockout policies'
      });
    }

    if (data.suspiciousActivity.length > 10) {
      recommendations.push({
        type: 'suspicious_activity',
        message: 'Multiple suspicious activities detected',
        priority: 'high',
        action: 'Review user sessions and implement additional security measures'
      });
    }

    if (data.anomalousActivity.length > 5) {
      recommendations.push({
        type: 'anomalous_patterns',
        message: 'Anomalous user activity patterns detected',
        priority: 'medium',
        action: 'Investigate unusual activity patterns and consider behavioral analysis'
      });
    }

    return recommendations;
  }

  /**
   * Generate compliance recommendations
   */
  generateComplianceRecommendations(complianceData) {
    const recommendations = [];
    const violations = complianceData.filter(item => item.non_compliant_events > 0);
    
    if (violations.length > 0) {
      recommendations.push({
        type: 'compliance_violations',
        message: `${violations.length} compliance violations detected`,
        priority: 'high',
        action: 'Review and address compliance violations immediately'
      });
    }

    return recommendations;
  }

  /**
   * Summarize data access
   */
  summarizeDataAccess(dataAccessLogs) {
    const summary = {
      totalAccess: dataAccessLogs.length,
      successfulAccess: dataAccessLogs.filter(log => log.success).length,
      failedAccess: dataAccessLogs.filter(log => !log.success).length,
      uniqueUsers: new Set(dataAccessLogs.map(log => log.user_id)).size,
      uniqueResources: new Set(dataAccessLogs.map(log => log.resource_id)).size
    };

    return summary;
  }

  /**
   * Get top accessed resources
   */
  getTopAccessedResources(dataAccessLogs) {
    const resourceCounts = {};
    
    dataAccessLogs.forEach(log => {
      const key = `${log.resource_type}:${log.resource_id}`;
      resourceCounts[key] = (resourceCounts[key] || 0) + 1;
    });

    return Object.entries(resourceCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([resource, count]) => ({ resource, count }));
  }

  /**
   * Get top data access users
   */
  getTopDataAccessUsers(dataAccessLogs) {
    const userCounts = {};
    
    dataAccessLogs.forEach(log => {
      if (log.user_id) {
        userCounts[log.user_id] = (userCounts[log.user_id] || 0) + 1;
      }
    });

    return Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId: parseInt(userId), count }));
  }

  /**
   * Clean up old audit logs
   */
  async cleanupOldLogs() {
    try {
      const cutoffDate = new Date(Date.now() - this.logRetentionDays * 24 * 60 * 60 * 1000);
      
      const result = await this.deleteOldLogs(cutoffDate);
      console.log(`Cleaned up ${result} old audit logs (older than ${this.logRetentionDays} days)`);
      
      return result;
    } catch (error) {
      console.error('Error cleaning up old logs:', error);
      throw error;
    }
  }

  /**
   * Delete old logs from database
   * @param {Date} cutoffDate - Cutoff date for deletion
   */
  async deleteOldLogs(cutoffDate) {
    return new Promise((resolve, reject) => {
      const query = 'DELETE FROM auth_audit_log WHERE created_at < ?';
      
      this.db.run(query, [cutoffDate.toISOString()], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  /**
   * Export audit logs
   * @param {object} exportConfig - Export configuration
   */
  async exportLogs(exportConfig) {
    try {
      const {
        dateFrom,
        dateTo,
        filters = {},
        format = 'csv',
        includeDetails = true
      } = exportConfig;

      const logs = await this.queryLogs({
        ...filters,
        dateFrom,
        dateTo
      }, { limit: 10000 }); // Export limit

      if (format === 'csv') {
        return this.convertToCSV(logs.logs, includeDetails);
      } else if (format === 'json') {
        return logs;
      } else {
        throw new Error(`Unsupported export format: ${format}`);
      }
    } catch (error) {
      console.error('Error exporting logs:', error);
      throw error;
    }
  }

  /**
   * Convert logs to CSV format
   * @param {array} logs - Log entries
   * @param {boolean} includeDetails - Include detailed information
   */
  convertToCSV(logs, includeDetails = true) {
    const headers = [
      'ID', 'User ID', 'Username', 'Email', 'Action', 'Resource Type',
      'Resource ID', 'IP Address', 'User Agent', 'Success', 'Failure Reason',
      'Created At'
    ];

    if (includeDetails) {
      headers.push('Details');
    }

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
      const row = [
        log.id,
        log.user_id || '',
        log.username || '',
        log.email || '',
        log.action,
        log.resource_type || '',
        log.resource_id || '',
        log.ip_address || '',
        `"${(log.user_agent || '').replace(/"/g, '""')}"`,
        log.success,
        `"${(log.failure_reason || '').replace(/"/g, '""')}"`,
        log.created_at
      ];

      if (includeDetails) {
        row.push(`"${(log.details || '{}').replace(/"/g, '""')}"`);
      }

      csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
  }

  /**
   * Archive logs to external storage
   * @param {object} archiveConfig - Archive configuration
   */
  async archiveLogs(archiveConfig) {
    try {
      const {
        dateFrom,
        dateTo,
        destination,
        format = 'json'
      } = archiveConfig;

      const logs = await this.queryLogs({ dateFrom, dateTo }, { limit: 50000 });
      
      // This would integrate with external storage (S3, Azure Blob, etc.)
      console.log(`Archived ${logs.logs.length} logs to ${destination}`);
      
      // After successful archive, optionally delete from database
      if (archiveConfig.deleteAfterArchive) {
        // Implementation would go here
        console.log('Logs deleted from database after successful archive');
      }

      return { success: true, archivedCount: logs.logs.length };
    } catch (error) {
      console.error('Error archiving logs:', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getAuditLogStatistics() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total_logs,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(DISTINCT action) as unique_actions,
          COUNT(DISTINCT resource_type) as unique_resources,
          COUNT(DISTINCT ip_address) as unique_ips,
          SUM(CASE WHEN success = true THEN 1 ELSE 0 END) as successful_events,
          SUM(CASE WHEN success = false THEN 1 ELSE 0 END) as failed_events,
          MIN(created_at) as earliest_event,
          MAX(created_at) as latest_event
        FROM auth_audit_log
      `;
      
      this.db.get(query, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row || {});
        }
      });
    });
  }
}

module.exports = new AuditLogService();
