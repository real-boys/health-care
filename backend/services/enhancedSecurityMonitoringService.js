const winston = require('winston');
const crypto = require('crypto');
const axios = require('axios');
const schedule = require('node-schedule');
const fs = require('fs').promises;
const path = require('path');
const { EventEmitter } = require('events');

class EnhancedSecurityMonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      siemEndpoint: options.siemEndpoint || process.env.SIEM_ENDPOINT,
      siemApiKey: options.siemApiKey || process.env.SIEM_API_KEY,
      threatIntelApiKey: options.threatIntelApiKey || process.env.THREAT_INTEL_API_KEY,
      vulnerabilityScanInterval: options.vulnerabilityScanInterval || '0 3 * * *', // Daily at 3 AM
      alertThresholds: {
        critical: 1,
        high: 5,
        medium: 20,
        low: 50
      },
      incidentResponse: {
        autoBlockIPs: options.autoBlockIPs !== false,
        autoLockAccounts: options.autoLockAccounts !== false,
        notifyAdmins: options.notifyAdmins !== false
      },
      ...options
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/security.log' }),
        new winston.transports.Console()
      ]
    });

    this.threatDatabase = new Map();
    this.securityEvents = [];
    this.incidents = [];
    this.vulnerabilities = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.setupThreatDatabase();
      await this.setupScheduledTasks();
      this.isInitialized = true;
      this.logger.info('Enhanced Security Monitoring Service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Enhanced Security Monitoring Service:', error);
      throw error;
    }
  }

  async setupThreatDatabase() {
    // Initialize with known threat patterns
    this.threatDatabase.set('sql_injection', {
      patterns: [/[';#]|(--)|(\/\*.*\*\/)/i, /(\b(union|select|insert|update|delete|drop|create|alter|exec|execute)\b)/i],
      severity: 'critical',
      description: 'SQL Injection attempt detected'
    });

    this.threatDatabase.set('xss', {
      patterns: [/(<script|<iframe|<object|<embed|javascript:|vbscript:|onload=|onerror=)/i],
      severity: 'high',
      description: 'Cross-site scripting attempt detected'
    });

    this.threatDatabase.set('path_traversal', {
      patterns: [/(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e%5c)/i],
      severity: 'high',
      description: 'Path traversal attempt detected'
    });

    this.threatDatabase.set('command_injection', {
      patterns: [/(;|\||&|`|\$\(|\$\{)/i],
      severity: 'critical',
      description: 'Command injection attempt detected'
    });

    this.threatDatabase.set('brute_force', {
      patterns: [],
      severity: 'medium',
      description: 'Brute force attack pattern',
      detectionLogic: this.detectBruteForce.bind(this)
    });
  }

  async setupScheduledTasks() {
    // Vulnerability scanning
    if (this.config.vulnerabilityScanInterval) {
      schedule.scheduleJob(this.config.vulnerabilityScanInterval, async () => {
        try {
          await this.performVulnerabilityScan();
        } catch (error) {
          this.logger.error('Vulnerability scan failed:', error);
        }
      });
    }

    // Security analytics
    schedule.scheduleJob('*/30 * * * *', async () => {
      try {
        await this.generateSecurityAnalytics();
      } catch (error) {
        this.logger.error('Security analytics generation failed:', error);
      }
    });

    // Threat intelligence update
    schedule.scheduleJob('0 */6 * * *', async () => {
      try {
        await this.updateThreatIntelligence();
      } catch (error) {
        this.logger.error('Threat intelligence update failed:', error);
      }
    });
  }

  async processSecurityEvent(event) {
    try {
      const enrichedEvent = await this.enrichEvent(event);
      const threats = await this.detectThreats(enrichedEvent);
      
      if (threats.length > 0) {
        await this.handleThreats(enrichedEvent, threats);
      }

      // Send to SIEM
      if (this.config.siemEndpoint) {
        await this.sendToSIEM(enrichedEvent);
      }

      this.securityEvents.push(enrichedEvent);
      this.emit('securityEvent', enrichedEvent);

      return enrichedEvent;
    } catch (error) {
      this.logger.error('Failed to process security event:', error);
      throw error;
    }
  }

  async enrichEvent(event) {
    const enriched = {
      ...event,
      id: crypto.randomUUID(),
      timestamp: new Date(),
      processed: true,
      geoLocation: await this.getGeoLocation(event.ipAddress),
      deviceFingerprint: this.generateDeviceFingerprint(event.userAgent),
      riskScore: this.calculateRiskScore(event)
    };

    return enriched;
  }

  async detectThreats(event) {
    const threats = [];

    for (const [threatType, threatConfig] of this.threatDatabase) {
      if (threatConfig.patterns) {
        for (const pattern of threatConfig.patterns) {
          if (this.matchesPattern(event, pattern)) {
            threats.push({
              type: threatType,
              severity: threatConfig.severity,
              description: threatConfig.description,
              confidence: this.calculateConfidence(event, pattern)
            });
          }
        }
      }

      if (threatConfig.detectionLogic) {
        const detected = await threatConfig.detectionLogic(event);
        if (detected) {
          threats.push({
            type: threatType,
            severity: threatConfig.severity,
            description: threatConfig.description,
            confidence: detected.confidence || 0.8
          });
        }
      }
    }

    return threats;
  }

  matchesPattern(event, pattern) {
    const content = [
      event.url,
      event.method,
      event.headers,
      event.body,
      event.query,
      event.userAgent
    ].join(' ').toLowerCase();

    return pattern.test(content);
  }

  async detectBruteForce(event) {
    const recentEvents = this.securityEvents.filter(e => 
      e.ipAddress === event.ipAddress &&
      e.eventType === 'login_failure' &&
      (Date.now() - new Date(e.timestamp).getTime()) < 15 * 60 * 1000 // 15 minutes
    );

    if (recentEvents.length >= 10) {
      return {
        confidence: Math.min(recentEvents.length / 20, 1),
        attempts: recentEvents.length
      };
    }

    return null;
  }

  async handleThreats(event, threats) {
    const incident = await this.createIncident(event, threats);
    
    // Automated incident response
    if (this.config.incidentResponse) {
      await this.automatedIncidentResponse(incident);
    }

    // Send alerts
    await this.sendSecurityAlerts(incident);

    this.incidents.push(incident);
    this.emit('incident', incident);
  }

  async createIncident(event, threats) {
    const incident = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      status: 'open',
      severity: this.calculateIncidentSeverity(threats),
      event: event,
      threats: threats,
      response: {
        automated: [],
        manual: []
      },
      metadata: {
        source: 'automated_detection',
        assignedTo: null,
        resolvedAt: null
      }
    };

    return incident;
  }

  calculateIncidentSeverity(threats) {
    const severityLevels = { critical: 4, high: 3, medium: 2, low: 1 };
    const maxSeverity = Math.max(...threats.map(t => severityLevels[t.severity] || 0));
    
    if (maxSeverity >= 4) return 'critical';
    if (maxSeverity >= 3) return 'high';
    if (maxSeverity >= 2) return 'medium';
    return 'low';
  }

  async automatedIncidentResponse(incident) {
    const responses = [];

    // Auto-block malicious IPs
    if (this.config.incidentResponse.autoBlockIPs && incident.event.ipAddress) {
      await this.blockIP(incident.event.ipAddress);
      responses.push({
        action: 'ip_blocked',
        target: incident.event.ipAddress,
        timestamp: new Date()
      });
    }

    // Auto-lock accounts for critical incidents
    if (this.config.incidentResponse.autoLockAccounts && 
        incident.severity === 'critical' && 
        incident.event.userId) {
      await this.lockAccount(incident.event.userId);
      responses.push({
        action: 'account_locked',
        target: incident.event.userId,
        timestamp: new Date()
      });
    }

    // Notify administrators
    if (this.config.incidentResponse.notifyAdmins) {
      await this.notifyAdministrators(incident);
      responses.push({
        action: 'admins_notified',
        timestamp: new Date()
      });
    }

    incident.response.automated = responses;
  }

  async blockIP(ipAddress) {
    // Implementation would depend on your firewall/proxy setup
    this.logger.warn(`IP blocked: ${ipAddress}`);
    
    // Store blocked IP in database
    const blockedIP = {
      ip: ipAddress,
      blockedAt: new Date(),
      reason: 'automated_security_response',
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    };

    // Store in database (implementation depends on your DB)
    this.emit('ipBlocked', blockedIP);
  }

  async lockAccount(userId) {
    // Implementation would depend on your user management system
    this.logger.warn(`Account locked: ${userId}`);
    
    const lockedAccount = {
      userId: userId,
      lockedAt: new Date(),
      reason: 'automated_security_response',
      lockedBy: 'security_monitoring_service'
    };

    this.emit('accountLocked', lockedAccount);
  }

  async notifyAdministrators(incident) {
    const alert = {
      type: 'security_incident',
      severity: incident.severity,
      title: `Security Incident: ${incident.threats.map(t => t.type).join(', ')}`,
      description: `Automated security incident detected. Severity: ${incident.severity}`,
      incidentId: incident.id,
      timestamp: incident.timestamp
    };

    // Send notification through your notification system
    this.emit('adminAlert', alert);
  }

  async sendToSIEM(event) {
    if (!this.config.siemEndpoint || !this.config.siemApiKey) {
      return;
    }

    try {
      const siemEvent = {
        timestamp: event.timestamp,
        source: 'healthcare_app',
        event_type: event.eventType,
        severity: event.riskScore > 0.8 ? 'high' : event.riskScore > 0.5 ? 'medium' : 'low',
        details: {
          user_id: event.userId,
          ip_address: event.ipAddress,
          user_agent: event.userAgent,
          url: event.url,
          method: event.method,
          geo_location: event.geoLocation,
          device_fingerprint: event.deviceFingerprint
        }
      };

      await axios.post(this.config.siemEndpoint, siemEvent, {
        headers: {
          'Authorization': `Bearer ${this.config.siemApiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 5000
      });

      this.logger.debug('Event sent to SIEM:', event.id);
    } catch (error) {
      this.logger.error('Failed to send event to SIEM:', error);
    }
  }

  async performVulnerabilityScan() {
    this.logger.info('Starting vulnerability scan');
    
    const scanResults = {
      scanId: crypto.randomUUID(),
      timestamp: new Date(),
      vulnerabilities: [],
      summary: {
        total: 0,
        critical: 0,
        high: 0,
        medium: 0,
        low: 0
      }
    };

    try {
      // Check for common vulnerabilities
      const checks = [
        this.checkOutdatedDependencies(),
        this.checkSecurityHeaders(),
        this.checkAuthenticationFlaws(),
        this.checkDataExposure(),
        this.checkAccessControlIssues()
      ];

      const results = await Promise.allSettled(checks);
      
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          scanResults.vulnerabilities.push(...result.value);
        }
      });

      // Categorize vulnerabilities
      scanResults.vulnerabilities.forEach(vuln => {
        scanResults.summary.total++;
        scanResults.summary[vuln.severity]++;
      });

      this.vulnerabilities.push(scanResults);
      this.emit('vulnerabilityScan', scanResults);

      this.logger.info(`Vulnerability scan completed: ${scanResults.summary.total} vulnerabilities found`);
      return scanResults;

    } catch (error) {
      this.logger.error('Vulnerability scan failed:', error);
      throw error;
    }
  }

  async checkOutdatedDependencies() {
    const vulnerabilities = [];
    
    try {
      const packagePath = path.join(__dirname, '../package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf8'));
      
      // Check for known vulnerable packages (simplified)
      const vulnerablePackages = {
        'lodash': '<4.17.21',
        'express': '<4.17.0',
        'axios': '<0.21.1'
      };

      for (const [pkg, version] of Object.entries(vulnerablePackages)) {
        if (packageJson.dependencies[pkg]) {
          vulnerabilities.push({
            type: 'outdated_dependency',
            severity: 'high',
            package: pkg,
            currentVersion: packageJson.dependencies[pkg],
            safeVersion: version,
            description: `Package ${pkg} has known vulnerabilities`,
            recommendation: `Update ${pkg} to ${version} or later`
          });
        }
      }
    } catch (error) {
      this.logger.error('Failed to check dependencies:', error);
    }

    return vulnerabilities;
  }

  async checkSecurityHeaders() {
    const vulnerabilities = [];
    
    // This would make HTTP requests to check headers
    // For now, return placeholder checks
    const requiredHeaders = [
      'x-frame-options',
      'x-content-type-options',
      'x-xss-protection',
      'strict-transport-security'
    ];

    requiredHeaders.forEach(header => {
      vulnerabilities.push({
        type: 'missing_security_header',
        severity: 'medium',
        header: header,
        description: `Missing security header: ${header}`,
        recommendation: `Add ${header} header to responses`
      });
    });

    return vulnerabilities;
  }

  async checkAuthenticationFlaws() {
    const vulnerabilities = [];
    
    // Check for common authentication issues
    vulnerabilities.push({
      type: 'authentication_flaw',
      severity: 'medium',
      description: 'Review authentication mechanisms for potential flaws',
      recommendation: 'Implement multi-factor authentication and strong password policies'
    });

    return vulnerabilities;
  }

  async checkDataExposure() {
    const vulnerabilities = [];
    
    // Check for potential data exposure
    vulnerabilities.push({
      type: 'data_exposure',
      severity: 'high',
      description: 'Potential sensitive data exposure detected',
      recommendation: 'Review data access controls and encryption mechanisms'
    });

    return vulnerabilities;
  }

  async checkAccessControlIssues() {
    const vulnerabilities = [];
    
    // Check for access control issues
    vulnerabilities.push({
      type: 'access_control',
      severity: 'medium',
      description: 'Review access control mechanisms',
      recommendation: 'Implement proper role-based access control'
    });

    return vulnerabilities;
  }

  async generateSecurityAnalytics() {
    const analytics = {
      timestamp: new Date(),
      period: 'last_24_hours',
      metrics: {
        totalEvents: this.securityEvents.length,
        incidents: this.incidents.filter(i => 
          (Date.now() - new Date(i.timestamp).getTime()) < 24 * 60 * 60 * 1000
        ).length,
        blockedIPs: 0, // Would be calculated from blocked IPs
        lockedAccounts: 0, // Would be calculated from locked accounts
        vulnerabilities: this.vulnerabilities.length
      },
      trends: {
        eventsByHour: this.calculateEventsByHour(),
        incidentsBySeverity: this.calculateIncidentsBySeverity(),
        topThreatTypes: this.calculateTopThreatTypes(),
        riskScore: this.calculateOverallRiskScore()
      },
      recommendations: this.generateSecurityRecommendations()
    };

    this.emit('securityAnalytics', analytics);
    return analytics;
  }

  calculateEventsByHour() {
    const hours = {};
    const now = Date.now();
    
    this.securityEvents.forEach(event => {
      const hour = Math.floor((now - new Date(event.timestamp).getTime()) / (60 * 60 * 1000));
      hours[hour] = (hours[hour] || 0) + 1;
    });

    return hours;
  }

  calculateIncidentsBySeverity() {
    const severity = { critical: 0, high: 0, medium: 0, low: 0 };
    
    this.incidents.forEach(incident => {
      severity[incident.severity] = (severity[incident.severity] || 0) + 1;
    });

    return severity;
  }

  calculateTopThreatTypes() {
    const types = {};
    
    this.incidents.forEach(incident => {
      incident.threats.forEach(threat => {
        types[threat.type] = (types[threat.type] || 0) + 1;
      });
    });

    return Object.entries(types)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([type, count]) => ({ type, count }));
  }

  calculateOverallRiskScore() {
    if (this.securityEvents.length === 0) return 0;

    const totalRisk = this.securityEvents.reduce((sum, event) => sum + (event.riskScore || 0), 0);
    return Math.min(totalRisk / this.securityEvents.length, 1);
  }

  generateSecurityRecommendations() {
    const recommendations = [];

    if (this.incidents.filter(i => i.severity === 'critical').length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'incident_response',
        description: 'Critical incidents detected - immediate investigation required'
      });
    }

    if (this.vulnerabilities.filter(v => v.severity === 'critical').length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'vulnerability_management',
        description: 'Critical vulnerabilities found - immediate patching required'
      });
    }

    const riskScore = this.calculateOverallRiskScore();
    if (riskScore > 0.7) {
      recommendations.push({
        priority: 'medium',
        category: 'security_posture',
        description: 'High risk score detected - review security controls'
      });
    }

    return recommendations;
  }

  async generateSecurityReport(format = 'json') {
    const report = {
      reportId: crypto.randomUUID(),
      generatedAt: new Date(),
      period: 'last_7_days',
      summary: {
        totalEvents: this.securityEvents.length,
        totalIncidents: this.incidents.length,
        totalVulnerabilities: this.vulnerabilities.length,
        riskScore: this.calculateOverallRiskScore()
      },
      incidents: this.incidents.slice(-50), // Last 50 incidents
      vulnerabilities: this.vulnerabilities.slice(-10), // Last 10 vulnerability scans
      analytics: await this.generateSecurityAnalytics(),
      recommendations: this.generateSecurityRecommendations()
    };

    if (format === 'pdf') {
      return this.generatePDFReport(report);
    }

    return report;
  }

  async updateThreatIntelligence() {
    if (!this.config.threatIntelApiKey) {
      return;
    }

    try {
      // This would integrate with threat intelligence feeds
      // For now, log the action
      this.logger.info('Threat intelligence update completed');
    } catch (error) {
      this.logger.error('Threat intelligence update failed:', error);
    }
  }

  // Helper methods
  calculateRiskScore(event) {
    let score = 0;

    // Base score from event type
    const eventTypeScores = {
      'login_failure': 0.3,
      'mfa_failed': 0.5,
      'account_locked': 0.7,
      'suspicious_activity': 0.8,
      'data_access': 0.4,
      'privilege_escalation': 0.9
    };

    score += eventTypeScores[event.eventType] || 0.1;

    // Adjust based on IP reputation (placeholder)
    if (event.ipAddress) {
      score += this.getIPReputationScore(event.ipAddress);
    }

    // Adjust based on user behavior anomalies
    if (event.userId) {
      score += this.getUserBehaviorScore(event.userId);
    }

    return Math.min(score, 1);
  }

  getIPReputationScore(ip) {
    // Placeholder - would integrate with IP reputation service
    return 0.1;
  }

  getUserBehaviorScore(userId) {
    // Placeholder - would analyze user behavior patterns
    return 0.1;
  }

  calculateConfidence(event, pattern) {
    // Simple confidence calculation based on pattern match strength
    return 0.8;
  }

  async getGeoLocation(ip) {
    // Placeholder - would integrate with geo IP service
    return {
      country: 'Unknown',
      city: 'Unknown',
      coordinates: [0, 0]
    };
  }

  generateDeviceFingerprint(userAgent) {
    return crypto.createHash('md5').update(userAgent || '').digest('hex');
  }

  getSecurityMetrics() {
    return {
      totalEvents: this.securityEvents.length,
      openIncidents: this.incidents.filter(i => i.status === 'open').length,
      resolvedIncidents: this.incidents.filter(i => i.status === 'resolved').length,
      vulnerabilities: this.vulnerabilities.length,
      riskScore: this.calculateOverallRiskScore()
    };
  }
}

module.exports = EnhancedSecurityMonitoringService;
