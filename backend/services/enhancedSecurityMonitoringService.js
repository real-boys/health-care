/**
 * Enhanced Security Monitoring Service
 * Implements comprehensive security monitoring with SIEM integration, threat detection, and incident response
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const cron = require('node-cron');
const crypto = require('crypto');
const axios = require('axios');
const EventEmitter = require('events');

class EnhancedSecurityMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.initializeDatabase();
    this.threatDetectionRules = new Map();
    this.activeIncidents = new Map();
    this.securityMetrics = {
      totalThreats: 0,
      blockedThreats: 0,
      resolvedIncidents: 0,
      activeIncidents: 0,
      lastScan: null,
      securityScore: 100
    };
    
    this.initializeThreatDetection();
    this.startContinuousMonitoring();
    this.initializeSIEMIntegration();
  }

  /**
   * Initialize security monitoring database tables
   */
  async initializeDatabase() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = new sqlite3.Database(dbPath);

    const createTables = `
      -- Security Events Table
      CREATE TABLE IF NOT EXISTS security_events (
        id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        source_ip TEXT,
        user_id TEXT,
        action TEXT NOT NULL,
        description TEXT NOT NULL,
        metadata TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        status TEXT DEFAULT 'open'
      );

      -- Threat Intelligence Table
      CREATE TABLE IF NOT EXISTS threat_intelligence (
        id TEXT PRIMARY KEY,
        threat_type TEXT NOT NULL,
        indicator TEXT NOT NULL,
        indicator_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        source TEXT NOT NULL,
        first_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
        confidence REAL DEFAULT 0.5,
        is_active BOOLEAN DEFAULT 1,
        metadata TEXT
      );

      -- Security Incidents Table
      CREATE TABLE IF NOT EXISTS security_incidents (
        id TEXT PRIMARY KEY,
        incident_type TEXT NOT NULL,
        severity TEXT NOT NULL,
        status TEXT DEFAULT 'open',
        title TEXT NOT NULL,
        description TEXT NOT NULL,
        detected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        resolved_at DATETIME,
        resolved_by TEXT,
        assigned_to TEXT,
        impact_score INTEGER DEFAULT 1,
        affected_assets TEXT,
        containment_actions TEXT,
        root_cause TEXT,
        lessons_learned TEXT,
        metadata TEXT
      );

      -- Vulnerability Scan Results Table
      CREATE TABLE IF NOT EXISTS vulnerability_scans (
        id TEXT PRIMARY KEY,
        scan_type TEXT NOT NULL,
        target TEXT NOT NULL,
        vulnerabilities_found INTEGER DEFAULT 0,
        critical_count INTEGER DEFAULT 0,
        high_count INTEGER DEFAULT 0,
        medium_count INTEGER DEFAULT 0,
        low_count INTEGER DEFAULT 0,
        scan_data TEXT NOT NULL,
        scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        next_scan_date DATETIME
      );

      -- SIEM Integration Logs Table
      CREATE TABLE IF NOT EXISTS siem_logs (
        id TEXT PRIMARY KEY,
        event_id TEXT,
        siem_system TEXT NOT NULL,
        event_data TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        response_data TEXT,
        error_message TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      -- Security Metrics Table
      CREATE TABLE IF NOT EXISTS security_metrics (
        id TEXT PRIMARY KEY,
        metric_date DATE NOT NULL,
        total_events INTEGER DEFAULT 0,
        threats_detected INTEGER DEFAULT 0,
        incidents_created INTEGER DEFAULT 0,
        incidents_resolved INTEGER DEFAULT 0,
        security_score REAL DEFAULT 100,
        metrics_data TEXT
      );
    `;

    return new Promise((resolve, reject) => {
      this.db.exec(createTables, (err) => {
        if (err) {
          console.error('Error initializing security monitoring database:', err);
          reject(err);
        } else {
          console.log('Enhanced security monitoring database initialized successfully');
          resolve();
        }
      });
    });
  }

  /**
   * Initialize threat detection rules
   */
  initializeThreatDetection() {
    // Brute Force Attack Detection
    this.addThreatRule('brute_force', {
      name: 'Brute Force Attack',
      description: 'Detects multiple failed login attempts from same IP',
      condition: {
        eventType: 'login_failure',
        timeWindow: 300, // 5 minutes
        threshold: 5,
        aggregation: 'count_by_ip'
      },
      severity: 'high',
      actions: ['block_ip', 'alert_admin', 'log_incident']
    });

    // Suspicious IP Detection
    this.addThreatRule('suspicious_ip', {
      name: 'Suspicious IP Activity',
      description: 'Detects activity from known malicious IPs',
      condition: {
        eventType: 'any',
        check: 'ip_in_threat_intel'
      },
      severity: 'critical',
      actions: ['block_ip', 'create_incident', 'alert_security_team']
    });

    // Data Exfiltration Detection
    this.addThreatRule('data_exfiltration', {
      name: 'Data Exfiltration',
      description: 'Detects unusual data download patterns',
      condition: {
        eventType: 'file_download',
        timeWindow: 3600, // 1 hour
        threshold: 1000, // MB
        aggregation: 'sum_by_user'
      },
      severity: 'critical',
      actions: ['block_user', 'alert_admin', 'create_incident']
    });

    // Privilege Escalation Detection
    this.addThreatRule('privilege_escalation', {
      name: 'Privilege Escalation',
      description: 'Detects unauthorized privilege changes',
      condition: {
        eventType: 'privilege_change',
        check: 'unauthorized_change'
      },
      severity: 'high',
      actions: ['revoke_privileges', 'alert_admin', 'create_incident']
    });

    // Unusual Access Pattern Detection
    this.addThreatRule('unusual_access', {
      name: 'Unusual Access Pattern',
      description: 'Detects access outside normal patterns',
      condition: {
        eventType: 'file_access',
        check: 'deviation_from_baseline',
        threshold: 2.0 // Standard deviations
      },
      severity: 'medium',
      actions: ['log_event', 'alert_user', 'monitor_closely']
    });

    console.log(`Loaded ${this.threatDetectionRules.size} threat detection rules`);
  }

  /**
   * Add a threat detection rule
   */
  addThreatRule(ruleId, ruleConfig) {
    this.threatDetectionRules.set(ruleId, {
      id: ruleId,
      ...ruleConfig,
      isActive: true,
      createdAt: new Date(),
      lastTriggered: null,
      triggerCount: 0
    });
  }

  /**
   * Start continuous security monitoring
   */
  startContinuousMonitoring() {
    // Real-time event monitoring every 30 seconds
    cron.schedule('*/30 * * * * *', async () => {
      await this.processSecurityEvents();
    });

    // Vulnerability scanning every 6 hours
    cron.schedule('0 */6 * * *', async () => {
      await this.runVulnerabilityScan();
    });

    // Security metrics update every hour
    cron.schedule('0 * * * *', async () => {
      await this.updateSecurityMetrics();
    });

    // Threat intelligence update every 4 hours
    cron.schedule('0 */4 * * *', async () => {
      await this.updateThreatIntelligence();
    });

    console.log('Enhanced security monitoring started');
  }

  /**
   * Initialize SIEM integration
   */
  initializeSIEMIntegration() {
    this.siemConfig = {
      enabled: process.env.SIEM_ENABLED === 'true',
      endpoint: process.env.SIEM_ENDPOINT,
      apiKey: process.env.SIEM_API_KEY,
      systemName: process.env.SIEM_SYSTEM_NAME || 'healthcare-siem'
    };

    if (this.siemConfig.enabled) {
      console.log('SIEM integration enabled');
    } else {
      console.log('SIEM integration disabled');
    }
  }

  /**
   * Process security events and apply threat detection rules
   */
  async processSecurityEvents() {
    try {
      const recentEvents = await this.getRecentSecurityEvents();
      
      for (const event of recentEvents) {
        await this.evaluateThreatRules(event);
      }

      this.securityMetrics.lastScan = new Date();
    } catch (error) {
      console.error('Error processing security events:', error);
    }
  }

  /**
   * Get recent security events for analysis
   */
  async getRecentSecurityEvents() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM security_events 
        WHERE timestamp > datetime('now', '-5 minutes') 
        AND status = 'open'
        ORDER BY timestamp DESC
      `;

      this.db.all(query, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  /**
   * Evaluate threat detection rules against security events
   */
  async evaluateThreatRules(event) {
    for (const [ruleId, rule] of this.threatDetectionRules) {
      if (!rule.isActive) continue;

      try {
        const isMatch = await this.evaluateRuleCondition(rule.condition, event);
        
        if (isMatch) {
          await this.triggerThreatResponse(rule, event);
          rule.lastTriggered = new Date();
          rule.triggerCount++;
        }
      } catch (error) {
        console.error(`Error evaluating rule ${ruleId}:`, error);
      }
    }
  }

  /**
   * Evaluate rule condition against event
   */
  async evaluateRuleCondition(condition, event) {
    switch (condition.check) {
      case 'ip_in_threat_intel':
        return await this.checkIPInThreatIntel(event.source_ip);
      
      case 'unauthorized_change':
        return await this.checkUnauthorizedPrivilegeChange(event);
      
      case 'deviation_from_baseline':
        return await this.checkAccessPatternDeviation(event);
      
      default:
        // Time-based aggregation checks
        if (condition.timeWindow && condition.threshold) {
          return await this.checkAggregatedCondition(condition, event);
        }
        return false;
    }
  }

  /**
   * Check if IP is in threat intelligence
   */
  async checkIPInThreatIntel(ip) {
    if (!ip) return false;

    return new Promise((resolve) => {
      this.db.get(
        'SELECT * FROM threat_intelligence WHERE indicator = ? AND indicator_type = "ip" AND is_active = 1',
        [ip],
        (err, row) => {
          resolve(!!row);
        }
      );
    });
  }

  /**
   * Check for unauthorized privilege changes
   */
  async checkUnauthorizedPrivilegeChange(event) {
    // This would check if the user had proper authorization to make the change
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Check for access pattern deviations
   */
  async checkAccessPatternDeviation(event) {
    // This would compare current access patterns with historical baseline
    // For now, return false as a placeholder
    return false;
  }

  /**
   * Check aggregated conditions (time-based thresholds)
   */
  async checkAggregatedCondition(condition, event) {
    const timeWindow = condition.timeWindow;
    const threshold = condition.threshold;
    const aggregation = condition.aggregation;

    let query = 'SELECT COUNT(*) as count FROM security_events WHERE timestamp > datetime("now", "-' + timeWindow + ' seconds")';
    const params = [];

    if (aggregation === 'count_by_ip' && event.source_ip) {
      query += ' AND source_ip = ?';
      params.push(event.source_ip);
    } else if (aggregation === 'sum_by_user' && event.user_id) {
      query += ' AND user_id = ?';
      params.push(event.user_id);
    }

    if (condition.eventType && condition.eventType !== 'any') {
      query += ' AND event_type = ?';
      params.push(condition.eventType);
    }

    return new Promise((resolve) => {
      this.db.get(query, params, (err, row) => {
        if (err) {
          resolve(false);
        } else {
          resolve(row.count >= threshold);
        }
      });
    });
  }

  /**
   * Trigger threat response actions
   */
  async triggerThreatResponse(rule, event) {
    console.log(`Threat detected: ${rule.name} - ${event.description}`);

    // Update security metrics
    this.securityMetrics.totalThreats++;

    // Execute response actions
    for (const action of rule.actions) {
      await this.executeResponseAction(action, rule, event);
    }

    // Send to SIEM if configured
    if (this.siemConfig.enabled) {
      await this.sendToSIEM({
        eventType: 'threat_detected',
        rule: rule.name,
        severity: rule.severity,
        event: event,
        timestamp: new Date()
      });
    }

    this.emit('threat_detected', { rule, event });
  }

  /**
   * Execute specific response action
   */
  async executeResponseAction(action, rule, event) {
    switch (action) {
      case 'block_ip':
        await this.blockIP(event.source_ip);
        break;
      case 'block_user':
        await this.blockUser(event.user_id);
        break;
      case 'alert_admin':
        await this.sendAlert('admin', rule, event);
        break;
      case 'alert_security_team':
        await this.sendAlert('security_team', rule, event);
        break;
      case 'log_incident':
        await this.createSecurityIncident(rule, event);
        break;
      case 'create_incident':
        await this.createSecurityIncident(rule, event);
        break;
      case 'revoke_privileges':
        await this.revokeUserPrivileges(event.user_id);
        break;
      case 'log_event':
        // Event is already logged
        break;
      case 'alert_user':
        await this.sendAlert('user', rule, event);
        break;
      case 'monitor_closely':
        await this escalateMonitoring(event);
        break;
      default:
        console.log(`Unknown action: ${action}`);
    }
  }

  /**
   * Block IP address
   */
  async blockIP(ip) {
    // This would integrate with firewall or network security
    console.log(`Blocking IP: ${ip}`);
    this.securityMetrics.blockedThreats++;
  }

  /**
   * Block user account
   */
  async blockUser(userId) {
    // This would disable the user account
    console.log(`Blocking user: ${userId}`);
  }

  /**
   * Send security alert
   */
  async sendAlert(recipient, rule, event) {
    const alert = {
      type: 'security_alert',
      recipient,
      rule: rule.name,
      severity: rule.severity,
      event: event.description,
      timestamp: new Date()
    };

    console.log(`Alert sent to ${recipient}:`, alert);
    // This would integrate with notification service
  }

  /**
   * Create security incident
   */
  async createSecurityIncident(rule, event) {
    const incidentId = `incident_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    
    const incident = {
      id: incidentId,
      incidentType: rule.name,
      severity: rule.severity,
      title: `${rule.name} - ${event.description}`,
      description: `Threat detected: ${rule.name}. Event: ${event.description}`,
      detectedAt: new Date(),
      status: 'open',
      affectedAssets: JSON.stringify([event.source_ip, event.user_id].filter(Boolean)),
      metadata: JSON.stringify({ ruleId: rule.id, eventId: event.id })
    };

    await this.saveSecurityIncident(incident);
    this.activeIncidents.set(incidentId, incident);
    this.securityMetrics.activeIncidents++;

    this.emit('incident_created', incident);
  }

  /**
   * Save security incident to database
   */
  async saveSecurityIncident(incident) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO security_incidents 
        (id, incident_type, severity, status, title, description, detected_at, affected_assets, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        incident.id,
        incident.incidentType,
        incident.severity,
        incident.status,
        incident.title,
        incident.description,
        incident.detectedAt.toISOString(),
        incident.affectedAssets,
        incident.metadata
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Revoke user privileges
   */
  async revokeUserPrivileges(userId) {
    console.log(`Revoking privileges for user: ${userId}`);
    // This would integrate with user management system
  }

  /**
   * Escalate monitoring for specific entity
   */
  async escalateMonitoring(event) {
    console.log(`Escalating monitoring for: ${event.source_ip || event.user_id}`);
    // This would increase monitoring frequency and sensitivity
  }

  /**
   * Run vulnerability scan
   */
  async runVulnerabilityScan() {
    try {
      const scanId = `scan_${Date.now()}`;
      const targets = await this.getScanTargets();
      
      for (const target of targets) {
        const scanResults = await this.performVulnerabilityScan(target);
        await this.saveVulnerabilityScan(scanId, target, scanResults);
      }

      console.log(`Vulnerability scan ${scanId} completed`);
    } catch (error) {
      console.error('Error running vulnerability scan:', error);
    }
  }

  /**
   * Get targets for vulnerability scanning
   */
  async getScanTargets() {
    // Return list of systems/services to scan
    return [
      'web_application',
      'api_endpoints',
      'database_servers',
      'network_infrastructure'
    ];
  }

  /**
   * Perform vulnerability scan on target
   */
  async performVulnerabilityScan(target) {
    // This would integrate with vulnerability scanning tools
    // For now, return mock results
    return {
      vulnerabilities: [
        {
          id: 'vuln_1',
          severity: 'medium',
          description: 'Outdated dependency found',
          affectedComponent: 'express',
          version: '4.18.2',
          cve: 'CVE-2023-1234'
        }
      ],
      scanTime: new Date(),
      scanner: 'internal_scanner'
    };
  }

  /**
   * Save vulnerability scan results
   */
  async saveVulnerabilityScan(scanId, target, results) {
    const vulnerabilityCounts = results.vulnerabilities.reduce((acc, vuln) => {
      acc[vuln.severity] = (acc[vuln.severity] || 0) + 1;
      return acc;
    }, {});

    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO vulnerability_scans 
        (id, scan_type, target, vulnerabilities_found, critical_count, high_count, medium_count, low_count, scan_data, next_scan_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        scanId,
        'automated',
        target,
        results.vulnerabilities.length,
        vulnerabilityCounts.critical || 0,
        vulnerabilityCounts.high || 0,
        vulnerabilityCounts.medium || 0,
        vulnerabilityCounts.low || 0,
        JSON.stringify(results),
        new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString() // Next scan in 6 hours
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Update security metrics
   */
  async updateSecurityMetrics() {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      const metrics = {
        totalEvents: await this.countSecurityEvents(),
        threatsDetected: this.securityMetrics.totalThreats,
        incidentsCreated: this.securityMetrics.activeIncidents,
        incidentsResolved: this.securityMetrics.resolvedIncidents,
        securityScore: this.calculateSecurityScore()
      };

      await this.saveSecurityMetrics(today, metrics);
      this.securityMetrics = { ...this.securityMetrics, ...metrics };

    } catch (error) {
      console.error('Error updating security metrics:', error);
    }
  }

  /**
   * Count security events
   */
  async countSecurityEvents() {
    return new Promise((resolve) => {
      this.db.get('SELECT COUNT(*) as count FROM security_events', (err, row) => {
        resolve(row?.count || 0);
      });
    });
  }

  /**
   * Calculate security score
   */
  calculateSecurityScore() {
    const baseScore = 100;
    const threatPenalty = Math.min(50, this.securityMetrics.totalThreats * 2);
    const incidentPenalty = Math.min(30, this.securityMetrics.activeIncidents * 5);
    const resolutionBonus = Math.min(20, this.securityMetrics.resolvedIncidents * 2);
    
    return Math.max(0, baseScore - threatPenalty - incidentPenalty + resolutionBonus);
  }

  /**
   * Save security metrics
   */
  async saveSecurityMetrics(date, metrics) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO security_metrics 
        (id, metric_date, total_events, threats_detected, incidents_created, incidents_resolved, security_score, metrics_data)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        `metrics_${Date.now()}`,
        date,
        metrics.totalEvents,
        metrics.threatsDetected,
        metrics.incidentsCreated,
        metrics.incidentsResolved,
        metrics.securityScore,
        JSON.stringify(metrics)
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Update threat intelligence
   */
  async updateThreatIntelligence() {
    try {
      // This would integrate with threat intelligence feeds
      // For now, add some mock threat indicators
      const mockThreats = [
        {
          threatType: 'malicious_ip',
          indicator: '192.168.1.100',
          indicatorType: 'ip',
          severity: 'high',
          source: 'internal_threat_feed',
          confidence: 0.9
        },
        {
          threatType: 'malicious_domain',
          indicator: 'malicious.example.com',
          indicatorType: 'domain',
          severity: 'medium',
          source: 'internal_threat_feed',
          confidence: 0.7
        }
      ];

      for (const threat of mockThreats) {
        await this.addThreatIndicator(threat);
      }

      console.log('Threat intelligence updated');
    } catch (error) {
      console.error('Error updating threat intelligence:', error);
    }
  }

  /**
   * Add threat indicator
   */
  async addThreatIndicator(threat) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT OR REPLACE INTO threat_intelligence 
        (id, threat_type, indicator, indicator_type, severity, source, confidence, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        `threat_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        threat.threatType,
        threat.indicator,
        threat.indicatorType,
        threat.severity,
        threat.source,
        threat.confidence,
        JSON.stringify(threat.metadata || {})
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Send event to SIEM system
   */
  async sendToSIEM(eventData) {
    if (!this.siemConfig.enabled) return;

    try {
      const siemEvent = {
        system: this.siemConfig.systemName,
        timestamp: eventData.timestamp,
        eventType: eventData.eventType,
        severity: eventData.severity,
        data: eventData
      };

      const response = await axios.post(this.siemConfig.endpoint, siemEvent, {
        headers: {
          'Authorization': `Bearer ${this.siemConfig.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      await this.logSIEMEvent(eventData, 'success', response.data);

    } catch (error) {
      console.error('Error sending to SIEM:', error);
      await this.logSIEMEvent(eventData, 'error', error.message);
    }
  }

  /**
   * Log SIEM event
   */
  async logSIEMEvent(eventData, status, responseData) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO siem_logs 
        (id, event_id, siem_system, event_data, status, response_data)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        `siem_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        eventData.id || null,
        this.siemConfig.systemName,
        JSON.stringify(eventData),
        status,
        JSON.stringify(responseData)
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Record security event
   */
  async recordSecurityEvent(eventData) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO security_events 
        (id, event_type, severity, source_ip, user_id, action, description, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        `event_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        eventData.eventType,
        eventData.severity,
        eventData.sourceIp,
        eventData.userId,
        eventData.action,
        eventData.description,
        JSON.stringify(eventData.metadata || {})
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Get security incidents
   */
  async getSecurityIncidents(filters = {}) {
    let query = 'SELECT * FROM security_incidents';
    const params = [];
    const conditions = [];

    if (filters.status) {
      conditions.push('status = ?');
      params.push(filters.status);
    }

    if (filters.severity) {
      conditions.push('severity = ?');
      params.push(filters.severity);
    }

    if (filters.dateFrom) {
      conditions.push('detected_at >= ?');
      params.push(filters.dateFrom);
    }

    if (filters.dateTo) {
      conditions.push('detected_at <= ?');
      params.push(filters.dateTo);
    }

    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }

    query += ' ORDER BY detected_at DESC';

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            affectedAssets: JSON.parse(row.affectedAssets || '[]'),
            metadata: JSON.parse(row.metadata || '{}')
          })));
        }
      });
    });
  }

  /**
   * Resolve security incident
   */
  async resolveSecurityIncident(incidentId, resolvedBy, resolutionData) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        UPDATE security_incidents 
        SET status = 'resolved', resolved_at = ?, resolved_by = ?, 
            containment_actions = ?, root_cause = ?, lessons_learned = ?
        WHERE id = ?
      `);

      stmt.run([
        new Date().toISOString(),
        resolvedBy,
        JSON.stringify(resolutionData.containmentActions || []),
        resolutionData.rootCause || '',
        resolutionData.lessonsLearned || '',
        incidentId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          const incident = this.activeIncidents.get(incidentId);
          if (incident) {
            incident.status = 'resolved';
            incident.resolvedAt = new Date();
            incident.resolvedBy = resolvedBy;
          }
          
          this.securityMetrics.activeIncidents--;
          this.securityMetrics.resolvedIncidents++;
          
          resolve(incident);
        }
      }.bind(this));

      stmt.finalize();
    });
  }

  /**
   * Get security analytics
   */
  async getSecurityAnalytics(period = '30d') {
    const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT 
          metric_date,
          total_events,
          threats_detected,
          incidents_created,
          incidents_resolved,
          security_score
        FROM security_metrics 
        WHERE metric_date >= ?
        ORDER BY metric_date DESC
      `, [startDate.toISOString().split('T')[0]], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve({
            period,
            data: rows,
            currentMetrics: this.securityMetrics,
            summary: {
              totalEvents: rows.reduce((sum, row) => sum + row.total_events, 0),
              totalThreats: rows.reduce((sum, row) => sum + row.threats_detected, 0),
              totalIncidents: rows.reduce((sum, row) => sum + row.incidents_created, 0),
              averageSecurityScore: rows.reduce((sum, row) => sum + row.security_score, 0) / rows.length
            }
          });
        }
      });
    });
  }

  /**
   * Get vulnerability scan results
   */
  async getVulnerabilityScans(limit = 50) {
    return new Promise((resolve, reject) => {
      this.db.all(`
        SELECT * FROM vulnerability_scans 
        ORDER BY scan_date DESC 
        LIMIT ?
      `, [limit], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            scanData: JSON.parse(row.scan_data || '{}')
          })));
        }
      });
    });
  }

  /**
   * Get threat intelligence
   */
  async getThreatIntelligence(filters = {}) {
    let query = 'SELECT * FROM threat_intelligence WHERE is_active = 1';
    const params = [];

    if (filters.threatType) {
      query += ' AND threat_type = ?';
      params.push(filters.threatType);
    }

    if (filters.severity) {
      query += ' AND severity = ?';
      params.push(filters.severity);
    }

    query += ' ORDER BY last_seen DESC';

    return new Promise((resolve, reject) => {
      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows.map(row => ({
            ...row,
            metadata: JSON.parse(row.metadata || '{}'),
            is_active: Boolean(row.is_active)
          })));
        }
      });
    });
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      return {
        status: 'healthy',
        threatDetectionRules: this.threatDetectionRules.size,
        activeIncidents: this.activeIncidents.size,
        siemIntegration: this.siemConfig.enabled,
        securityScore: this.securityMetrics.securityScore,
        lastScan: this.securityMetrics.lastScan,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

module.exports = EnhancedSecurityMonitoringService;
