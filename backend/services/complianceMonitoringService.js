const winston = require('winston');
const crypto = require('crypto');
const schedule = require('node-schedule');
const { EventEmitter } = require('events');
const fs = require('fs').promises;
const path = require('path');

class ComplianceMonitoringService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.config = {
      rulesDirectory: options.rulesDirectory || './compliance-rules',
      monitoringInterval: options.monitoringInterval || '*/5 * * * *', // Every 5 minutes
      reportInterval: options.reportInterval || '0 0 * * *', // Daily at midnight
      alertThresholds: {
        critical: 1,
        high: 5,
        medium: 20,
        low: 50
      },
      retentionPeriod: options.retentionPeriod || 365, // days
      ...options
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/compliance.log' }),
        new winston.transports.Console()
      ]
    });

    this.rules = new Map();
    this.violations = [];
    this.auditTrail = [];
    this.complianceReports = [];
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.loadComplianceRules();
      await this.setupScheduledTasks();
      this.isInitialized = true;
      this.logger.info('Compliance Monitoring Service initialized');
    } catch (error) {
      this.logger.error('Failed to initialize Compliance Monitoring Service:', error);
      throw error;
    }
  }

  async loadComplianceRules() {
    try {
      await this.ensureRulesDirectory();
      
      // Load built-in compliance rules
      await this.loadBuiltinRules();
      
      // Load custom rules from files
      await this.loadCustomRules();
      
      this.logger.info(`Loaded ${this.rules.size} compliance rules`);
    } catch (error) {
      this.logger.error('Failed to load compliance rules:', error);
      throw error;
    }
  }

  async ensureRulesDirectory() {
    try {
      await fs.access(this.config.rulesDirectory);
    } catch (error) {
      await fs.mkdir(this.config.rulesDirectory, { recursive: true });
    }
  }

  async loadBuiltinRules() {
    // HIPAA Compliance Rules
    this.addRule({
      id: 'hipaa_001',
      name: 'HIPAA - PHI Access Logging',
      category: 'HIPAA',
      severity: 'critical',
      description: 'All access to Protected Health Information (PHI) must be logged',
      regulation: 'HIPAA Security Rule § 164.312(b)',
      enabled: true,
      conditions: [
        {
          field: 'eventType',
          operator: 'in',
          values: ['phi_access', 'patient_record_view', 'medical_data_access']
        }
      ],
      actions: [
        {
          type: 'log',
          level: 'audit'
        },
        {
          type: 'alert',
          severity: 'high'
        }
      ]
    });

    this.addRule({
      id: 'hipaa_002',
      name: 'HIPAA - Data Encryption',
      category: 'HIPAA',
      severity: 'high',
      description: 'PHI must be encrypted at rest and in transit',
      regulation: 'HIPAA Security Rule § 164.312(a)(2)(iv)',
      enabled: true,
      conditions: [
        {
          field: 'dataType',
          operator: 'equals',
          value: 'phi'
        },
        {
          field: 'encryption',
          operator: 'equals',
          value: false
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'critical'
        },
        {
          type: 'block',
          reason: 'unencrypted_phi'
        }
      ]
    });

    // GDPR Compliance Rules
    this.addRule({
      id: 'gdpr_001',
      name: 'GDPR - Data Subject Rights',
      category: 'GDPR',
      severity: 'high',
      description: 'Data subject requests must be processed within 30 days',
      regulation: 'GDPR Article 12',
      enabled: true,
      conditions: [
        {
          field: 'eventType',
          operator: 'equals',
          value: 'data_subject_request'
        },
        {
          field: 'responseTime',
          operator: 'greater_than',
          value: 30 * 24 * 60 * 60 * 1000 // 30 days in milliseconds
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'high'
        },
        {
          type: 'escalate'
        }
      ]
    });

    this.addRule({
      id: 'gdpr_002',
      name: 'GDPR - Consent Management',
      category: 'GDPR',
      severity: 'medium',
      description: 'Valid consent must be obtained before processing personal data',
      regulation: 'GDPR Article 6',
      enabled: true,
      conditions: [
        {
          field: 'eventType',
          operator: 'in',
          values: ['data_processing', 'marketing_communication']
        },
        {
          field: 'consent',
          operator: 'equals',
          value: false
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'medium'
        },
        {
          type: 'block',
          reason: 'no_consent'
        }
      ]
    });

    // PCI DSS Compliance Rules
    this.addRule({
      id: 'pci_001',
      name: 'PCI DSS - Card Data Protection',
      category: 'PCI-DSS',
      severity: 'critical',
      description: 'Cardholder data must be protected with strong encryption',
      regulation: 'PCI DSS Requirement 3',
      enabled: true,
      conditions: [
        {
          field: 'eventType',
          operator: 'in',
          values: ['payment_processing', 'card_data_access']
        },
        {
          field: 'cardDataEncrypted',
          operator: 'equals',
          value: false
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'critical'
        },
        {
          type: 'block',
          reason: 'unencrypted_card_data'
        }
      ]
    });

    // SOX Compliance Rules
    this.addRule({
      id: 'sox_001',
      name: 'SOX - Financial Data Integrity',
      category: 'SOX',
      severity: 'high',
      description: 'Financial data modifications must be authorized and audited',
      regulation: 'SOX Section 404',
      enabled: true,
      conditions: [
        {
          field: 'eventType',
          operator: 'in',
          values: ['financial_data_modify', 'transaction_approve']
        },
        {
          field: 'authorized',
          operator: 'equals',
          value: false
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'high'
        },
        {
          type: 'escalate'
        }
      ]
    });

    // Data Retention Rules
    this.addRule({
      id: 'retention_001',
      name: 'Data Retention Policy',
      category: 'RETENTION',
      severity: 'medium',
      description: 'Data must be retained according to regulatory requirements',
      regulation: 'Various',
      enabled: true,
      conditions: [
        {
          field: 'eventType',
          operator: 'equals',
          value: 'data_deletion'
        },
        {
          field: 'retentionPeriod',
          operator: 'less_than',
          value: this.config.retentionPeriod * 24 * 60 * 60 * 1000
        }
      ],
      actions: [
        {
          type: 'alert',
          severity: 'medium'
        },
        {
          type: 'block',
          reason: 'premature_deletion'
        }
      ]
    });
  }

  async loadCustomRules() {
    try {
      const ruleFiles = await fs.readdir(this.config.rulesDirectory);
      
      for (const file of ruleFiles) {
        if (file.endsWith('.json')) {
          const rulePath = path.join(this.config.rulesDirectory, file);
          const ruleData = JSON.parse(await fs.readFile(rulePath, 'utf8'));
          
          if (ruleData.enabled !== false) {
            this.addRule(ruleData);
          }
        }
      }
    } catch (error) {
      this.logger.warn('Failed to load custom rules:', error);
    }
  }

  addRule(rule) {
    // Validate rule structure
    if (!rule.id || !rule.name || !rule.category || !rule.conditions) {
      throw new Error('Invalid rule structure');
    }

    rule.createdAt = rule.createdAt || new Date();
    rule.updatedAt = new Date();
    rule.version = rule.version || '1.0';

    this.rules.set(rule.id, rule);
    this.logger.info(`Added compliance rule: ${rule.id} - ${rule.name}`);
  }

  async setupScheduledTasks() {
    // Continuous monitoring
    if (this.config.monitoringInterval) {
      schedule.scheduleJob(this.config.monitoringInterval, async () => {
        try {
          await this.performComplianceCheck();
        } catch (error) {
          this.logger.error('Compliance check failed:', error);
        }
      });
    }

    // Generate compliance reports
    if (this.config.reportInterval) {
      schedule.scheduleJob(this.config.reportInterval, async () => {
        try {
          await this.generateComplianceReport();
        } catch (error) {
          this.logger.error('Compliance report generation failed:', error);
        }
      });
    }

    // Rule updates
    schedule.scheduleJob('0 */6 * * *', async () => {
      try {
        await this.checkRuleUpdates();
      } catch (error) {
        this.logger.error('Rule update check failed:', error);
      }
    });
  }

  async performComplianceCheck() {
    const checkId = crypto.randomUUID();
    const startTime = new Date();
    
    this.logger.info(`Starting compliance check: ${checkId}`);

    try {
      const violations = [];
      
      // Check all enabled rules
      for (const [ruleId, rule] of this.rules) {
        if (rule.enabled) {
          const ruleViolations = await this.evaluateRule(rule);
          violations.push(...ruleViolations);
        }
      }

      const checkResult = {
        checkId,
        timestamp: startTime,
        duration: Date.now() - startTime.getTime(),
        rulesChecked: Array.from(this.rules.keys()).filter(id => this.rules.get(id).enabled).length,
        violationsFound: violations.length,
        violations,
        status: violations.length > 0 ? 'non_compliant' : 'compliant'
      };

      // Process violations
      if (violations.length > 0) {
        await this.processViolations(violations);
      }

      // Add to audit trail
      this.auditTrail.push({
        type: 'compliance_check',
        checkId,
        timestamp: startTime,
        result: checkResult
      });

      this.emit('complianceCheck', checkResult);
      this.logger.info(`Compliance check completed: ${checkId}`, checkResult);

      return checkResult;

    } catch (error) {
      this.logger.error(`Compliance check failed: ${checkId}`, error);
      throw error;
    }
  }

  async evaluateRule(rule) {
    const violations = [];
    
    try {
      // Get relevant data for rule evaluation
      const relevantEvents = await this.getRelevantEvents(rule);
      
      for (const event of relevantEvents) {
        if (this.evaluateConditions(rule.conditions, event)) {
          const violation = {
            id: crypto.randomUUID(),
            ruleId: rule.id,
            ruleName: rule.name,
            category: rule.category,
            severity: rule.severity,
            regulation: rule.regulation,
            timestamp: new Date(),
            event: event,
            description: rule.description,
            status: 'open',
            actions: rule.actions || [],
            metadata: {
              detectedBy: 'automated_monitoring',
              checkId: this.currentCheckId
            }
          };

          violations.push(violation);
        }
      }

    } catch (error) {
      this.logger.error(`Rule evaluation failed for ${rule.id}:`, error);
    }

    return violations;
  }

  async getRelevantEvents(rule) {
    // This would query your database or event store for relevant events
    // For now, return placeholder data
    return [];
  }

  evaluateConditions(conditions, event) {
    if (!conditions || conditions.length === 0) {
      return false;
    }

    // All conditions must be met (AND logic)
    return conditions.every(condition => {
      const fieldValue = event[condition.field];
      
      switch (condition.operator) {
        case 'equals':
          return fieldValue === condition.value;
        case 'not_equals':
          return fieldValue !== condition.value;
        case 'in':
          return condition.values.includes(fieldValue);
        case 'not_in':
          return !condition.values.includes(fieldValue);
        case 'greater_than':
          return fieldValue > condition.value;
        case 'less_than':
          return fieldValue < condition.value;
        case 'contains':
          return fieldValue && fieldValue.includes(condition.value);
        case 'regex':
          return new RegExp(condition.pattern).test(fieldValue);
        default:
          return false;
      }
    });
  }

  async processViolations(violations) {
    for (const violation of violations) {
      // Add to violations list
      this.violations.push(violation);

      // Execute rule actions
      await this.executeActions(violation);

      // Send alerts
      await this.sendViolationAlert(violation);

      // Emit violation event
      this.emit('violation', violation);
    }
  }

  async executeActions(violation) {
    const actions = violation.actions || [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'alert':
            // Alert is handled by sendViolationAlert
            break;
          case 'block':
            await this.blockAction(violation, action.reason);
            break;
          case 'escalate':
            await this.escalateViolation(violation);
            break;
          case 'log':
            await this.logViolation(violation, action.level);
            break;
          case 'notify':
            await this.notifyStakeholders(violation);
            break;
        }
      } catch (error) {
        this.logger.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  async blockAction(violation, reason) {
    this.logger.warn(`Action blocked due to compliance violation: ${reason}`, {
      violationId: violation.id,
      ruleId: violation.ruleId
    });

    this.emit('actionBlocked', {
      violation,
      reason,
      timestamp: new Date()
    });
  }

  async escalateViolation(violation) {
    this.logger.error(`Compliance violation escalated: ${violation.ruleName}`, {
      violationId: violation.id,
      severity: violation.severity
    });

    this.emit('violationEscalated', {
      violation,
      escalatedAt: new Date()
    });
  }

  async logViolation(violation, level = 'audit') {
    const logEntry = {
      timestamp: new Date(),
      level,
      type: 'compliance_violation',
      violationId: violation.id,
      ruleId: violation.ruleId,
      ruleName: violation.ruleName,
      category: violation.category,
      severity: violation.severity,
      description: violation.description,
      event: violation.event
    };

    this.logger[level]('Compliance violation logged', logEntry);
  }

  async sendViolationAlert(violation) {
    const alert = {
      type: 'compliance_violation',
      severity: violation.severity,
      title: `Compliance Violation: ${violation.ruleName}`,
      description: violation.description,
      category: violation.category,
      regulation: violation.regulation,
      violationId: violation.id,
      timestamp: violation.timestamp,
      actions: ['review', 'investigate', 'remediate']
    };

    this.emit('complianceAlert', alert);
  }

  async notifyStakeholders(violation) {
    // Implementation would depend on your notification system
    this.logger.info(`Stakeholders notified for violation: ${violation.id}`);
  }

  async generateComplianceReport() {
    const reportId = crypto.randomUUID();
    const timestamp = new Date();
    
    try {
      const report = {
        reportId,
        generatedAt: timestamp,
        period: 'last_24_hours',
        summary: {
          totalRules: this.rules.size,
          enabledRules: Array.from(this.rules.values()).filter(rule => rule.enabled).length,
          totalViolations: this.violations.length,
          openViolations: this.violations.filter(v => v.status === 'open').length,
          resolvedViolations: this.violations.filter(v => v.status === 'resolved').length,
          complianceScore: this.calculateComplianceScore()
        },
        violationsByCategory: this.groupViolationsByCategory(),
        violationsBySeverity: this.groupViolationsBySeverity(),
        topViolations: this.getTopViolations(),
        complianceTrends: this.calculateComplianceTrends(),
        recommendations: this.generateComplianceRecommendations(),
        auditTrail: this.getRecentAuditTrail(),
        rulesStatus: this.getRulesStatus()
      };

      this.complianceReports.push(report);
      this.emit('complianceReport', report);

      this.logger.info(`Compliance report generated: ${reportId}`);
      return report;

    } catch (error) {
      this.logger.error('Compliance report generation failed:', error);
      throw error;
    }
  }

  calculateComplianceScore() {
    const totalChecks = this.auditTrail.filter(entry => entry.type === 'compliance_check').length;
    const compliantChecks = this.auditTrail.filter(entry => 
      entry.type === 'compliance_check' && entry.result.status === 'compliant'
    ).length;

    if (totalChecks === 0) return 100;
    return Math.round((compliantChecks / totalChecks) * 100);
  }

  groupViolationsByCategory() {
    const categories = {};
    
    this.violations.forEach(violation => {
      categories[violation.category] = (categories[violation.category] || 0) + 1;
    });

    return categories;
  }

  groupViolationsBySeverity() {
    const severity = { critical: 0, high: 0, medium: 0, low: 0 };
    
    this.violations.forEach(violation => {
      severity[violation.severity] = (severity[violation.severity] || 0) + 1;
    });

    return severity;
  }

  getTopViolations() {
    const ruleCounts = {};
    
    this.violations.forEach(violation => {
      ruleCounts[violation.ruleId] = (ruleCounts[violation.ruleId] || 0) + 1;
    });

    return Object.entries(ruleCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([ruleId, count]) => {
        const rule = this.rules.get(ruleId);
        return {
          ruleId,
          ruleName: rule ? rule.name : 'Unknown',
          category: rule ? rule.category : 'Unknown',
          count
        };
      });
  }

  calculateComplianceTrends() {
    const last30Days = [];
    const now = Date.now();
    
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split('T')[0];
      
      const dayViolations = this.violations.filter(v => 
        new Date(v.timestamp).toISOString().split('T')[0] === dateStr
      );
      
      last30Days.push({
        date: dateStr,
        violations: dayViolations.length,
        critical: dayViolations.filter(v => v.severity === 'critical').length,
        high: dayViolations.filter(v => v.severity === 'high').length
      });
    }

    return last30Days;
  }

  generateComplianceRecommendations() {
    const recommendations = [];

    // Analyze violation patterns
    const topViolations = this.getTopViolations();
    if (topViolations.length > 0) {
      const topViolation = topViolations[0];
      recommendations.push({
        priority: 'high',
        category: 'violation_prevention',
        title: `Address recurring violations: ${topViolation.ruleName}`,
        description: `This rule has been violated ${topViolation.count} times. Consider reviewing and improving controls.`,
        actionItems: [
          'Review current processes',
          'Strengthen controls',
          'Provide additional training'
        ]
      });
    }

    // Check compliance score
    const score = this.calculateComplianceScore();
    if (score < 90) {
      recommendations.push({
        priority: 'medium',
        category: 'compliance_improvement',
        title: 'Improve overall compliance',
        description: `Current compliance score is ${score}%. Target is 95% or higher.`,
        actionItems: [
          'Review all compliance rules',
          'Strengthen monitoring',
          'Implement automated remediation'
        ]
      });
    }

    // Check for critical violations
    const criticalViolations = this.violations.filter(v => v.severity === 'critical' && v.status === 'open');
    if (criticalViolations.length > 0) {
      recommendations.push({
        priority: 'critical',
        category: 'immediate_action',
        title: 'Critical violations require immediate attention',
        description: `${criticalViolations.length} critical violations are currently open.`,
        actionItems: [
          'Immediate investigation required',
          'Implement temporary controls',
          'Escalate to management'
        ]
      });
    }

    return recommendations;
  }

  getRecentAuditTrail() {
    return this.auditTrail
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 50);
  }

  getRulesStatus() {
    return Array.from(this.rules.values()).map(rule => ({
      id: rule.id,
      name: rule.name,
      category: rule.category,
      enabled: rule.enabled,
      lastUpdated: rule.updatedAt,
      version: rule.version,
      violationCount: this.violations.filter(v => v.ruleId === rule.id).length
    }));
  }

  async checkRuleUpdates() {
    this.logger.info('Checking for rule updates');
    
    // This would check for rule updates from a central repository
    // For now, just reload custom rules
    await this.loadCustomRules();
  }

  async updateRule(ruleId, updates) {
    try {
      const rule = this.rules.get(ruleId);
      
      if (!rule) {
        throw new Error('Rule not found');
      }

      const updatedRule = {
        ...rule,
        ...updates,
        updatedAt: new Date(),
        version: this.incrementVersion(rule.version)
      };

      this.rules.set(ruleId, updatedRule);

      // Save to file if it's a custom rule
      if (ruleId.startsWith('custom_')) {
        await this.saveCustomRule(updatedRule);
      }

      this.logger.info(`Rule updated: ${ruleId}`);
      this.emit('ruleUpdated', updatedRule);

      return updatedRule;

    } catch (error) {
      this.logger.error(`Failed to update rule ${ruleId}:`, error);
      throw error;
    }
  }

  async saveCustomRule(rule) {
    const rulePath = path.join(this.config.rulesDirectory, `${rule.id}.json`);
    await fs.writeFile(rulePath, JSON.stringify(rule, null, 2));
  }

  incrementVersion(version) {
    const parts = version.split('.');
    parts[parts.length - 1] = (parseInt(parts[parts.length - 1]) + 1).toString();
    return parts.join('.');
  }

  async resolveViolation(violationId, resolution) {
    try {
      const violation = this.violations.find(v => v.id === violationId);
      
      if (!violation) {
        throw new Error('Violation not found');
      }

      violation.status = 'resolved';
      violation.resolvedAt = new Date();
      violation.resolution = resolution;
      violation.resolvedBy = resolution.userId;

      this.logger.info(`Violation resolved: ${violationId}`);
      this.emit('violationResolved', violation);

      return violation;

    } catch (error) {
      this.logger.error(`Failed to resolve violation ${violationId}:`, error);
      throw error;
    }
  }

  getComplianceStatus() {
    const score = this.calculateComplianceScore();
    const openViolations = this.violations.filter(v => v.status === 'open');
    const criticalViolations = openViolations.filter(v => v.severity === 'critical');

    return {
      score,
      status: score >= 95 ? 'compliant' : score >= 80 ? 'at_risk' : 'non_compliant',
      openViolations: openViolations.length,
      criticalViolations: criticalViolations.length,
      lastCheck: this.auditTrail
        .filter(entry => entry.type === 'compliance_check')
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))[0]?.timestamp,
      nextCheck: this.getNextScheduledCheck()
    };
  }

  getNextScheduledCheck() {
    // This would calculate the next scheduled check time
    // For now, return a placeholder
    return new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
  }

  getViolations(options = {}) {
    const {
      status,
      category,
      severity,
      limit = 50,
      offset = 0
    } = options;

    let violations = this.violations;

    // Apply filters
    if (status) {
      violations = violations.filter(v => v.status === status);
    }

    if (category) {
      violations = violations.filter(v => v.category === category);
    }

    if (severity) {
      violations = violations.filter(v => v.severity === severity);
    }

    // Sort by timestamp (newest first)
    violations.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

    // Apply pagination
    return violations.slice(offset, offset + limit);
  }

  getRules() {
    return Array.from(this.rules.values());
  }
}

module.exports = ComplianceMonitoringService;
