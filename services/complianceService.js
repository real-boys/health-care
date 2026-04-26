const ComplianceRule = require('../models/ComplianceRule');
const ComplianceViolation = require('../models/ComplianceViolation');
const AuditLog = require('../models/AuditLog');
const notificationService = require('./notificationService');
const winston = require('winston');

class ComplianceService {
  constructor() {
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
    
    this.ruleCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes
    this.init();
  }

  async init() {
    await this.loadRules();
    // Refresh rules cache periodically
    setInterval(() => this.loadRules(), this.cacheTimeout);
  }

  async loadRules() {
    try {
      const rules = await ComplianceRule.getActiveRules();
      this.ruleCache.clear();
      rules.forEach(rule => {
        this.ruleCache.set(rule.ruleId, rule);
      });
      this.logger.info(`Loaded ${rules.length} compliance rules`);
    } catch (error) {
      this.logger.error('Failed to load compliance rules:', error);
    }
  }

  async checkCompliance(context) {
    const violations = [];
    const relevantRules = await this.getRelevantRules(context);

    for (const rule of relevantRules) {
      try {
        const result = await this.evaluateRule(rule, context);
        if (result.isViolation) {
          const violation = await this.createViolation(rule, context, result);
          violations.push(violation);
          
          // Update rule statistics
          await rule.incrementStats(true, result.shouldAlert);
          
          // Trigger alerts if needed
          if (result.shouldAlert) {
            await this.triggerAlerts(violation);
          }
        } else {
          // Update rule statistics for successful checks
          await rule.incrementStats(false, false);
        }
      } catch (error) {
        this.logger.error(`Error evaluating rule ${rule.ruleId}:`, error);
      }
    }

    return violations;
  }

  async getRelevantRules(context) {
    const relevantRules = [];
    
    for (const rule of this.ruleCache.values()) {
      if (this.isRuleRelevant(rule, context)) {
        relevantRules.push(rule);
      }
    }
    
    return relevantRules;
  }

  isRuleRelevant(rule, context) {
    // Check resource type
    if (rule.conditions.resourceTypes.length > 0 && 
        !rule.conditions.resourceTypes.includes(context.resourceType)) {
      return false;
    }

    // Check action
    if (rule.conditions.actions.length > 0 && 
        !rule.conditions.actions.includes(context.action)) {
      return false;
    }

    // Check user role
    if (rule.conditions.userRoles.length > 0 && 
        !rule.conditions.userRoles.includes(context.userRole)) {
      return false;
    }

    // Check time restrictions
    if (rule.conditions.timeRestrictions) {
      const now = new Date();
      const timeRestriction = rule.conditions.timeRestrictions;
      
      if (timeRestriction.startHour !== undefined && timeRestriction.endHour !== undefined) {
        const currentHour = now.getHours();
        if (currentHour < timeRestriction.startHour || currentHour > timeRestriction.endHour) {
          return false;
        }
      }
      
      if (timeRestriction.daysOfWeek && timeRestriction.daysOfWeek.length > 0) {
        const currentDay = now.getDay();
        if (!timeRestriction.daysOfWeek.includes(currentDay)) {
          return false;
        }
      }
    }

    // Check location restrictions
    if (rule.conditions.locationRestrictions && rule.conditions.locationRestrictions.length > 0) {
      const userLocation = context.location;
      if (!userLocation) return false;
      
      const locationMatch = rule.conditions.locationRestrictions.some(restriction => {
        if (restriction.country && userLocation.country !== restriction.country) {
          return false;
        }
        if (restriction.region && userLocation.region !== restriction.region) {
          return false;
        }
        return true;
      });
      
      if (!locationMatch) return false;
    }

    return true;
  }

  async evaluateRule(rule, context) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (rule.logic) {
        case 'simple':
          result = this.evaluateSimpleRule(rule, context);
          break;
        case 'complex':
          result = this.evaluateComplexRule(rule, context);
          break;
        case 'script':
          result = await this.evaluateScriptRule(rule, context);
          break;
        default:
          throw new Error(`Unknown rule logic type: ${rule.logic}`);
      }

      result.detectionTime = Date.now() - startTime;
      return result;
    } catch (error) {
      this.logger.error(`Rule evaluation error for ${rule.ruleId}:`, error);
      return {
        isViolation: false,
        shouldAlert: false,
        error: error.message,
        detectionTime: Date.now() - startTime
      };
    }
  }

  evaluateSimpleRule(rule, context) {
    // Simple rule evaluation based on predefined conditions
    const expression = rule.ruleExpression.toLowerCase();
    
    // Check for data access violations
    if (expression.includes('pii_access') && context.compliance && context.compliance.piiAccessed) {
      return {
        isViolation: true,
        shouldAlert: rule.enforcementAction !== 'log-only',
        reason: 'PII data accessed without proper authorization'
      };
    }

    // Check for time-based violations
    if (expression.includes('after_hours')) {
      const hour = new Date().getHours();
      if (hour < 9 || hour > 17) {
        return {
          isViolation: true,
          shouldAlert: rule.enforcementAction !== 'log-only',
          reason: 'Access attempted outside business hours'
        };
      }
    }

    // Check for privilege escalation
    if (expression.includes('privilege_escalation') && context.userRole === 'admin') {
      return {
        isViolation: true,
        shouldAlert: rule.enforcementAction !== 'log-only',
        reason: 'Privilege escalation detected'
      };
    }

    // Check for data retention violations
    if (expression.includes('data_retention') && context.action === 'delete') {
      return {
        isViolation: true,
        shouldAlert: rule.enforcementAction !== 'log-only',
        reason: 'Data deletion violates retention policy'
      };
    }

    return {
      isViolation: false,
      shouldAlert: false
    };
  }

  evaluateComplexRule(rule, context) {
    // Complex rule evaluation with multiple conditions
    const conditions = rule.ruleExpression.split(' AND ');
    let violations = [];

    for (const condition of conditions) {
      const trimmedCondition = condition.trim();
      
      if (trimmedCondition.includes('high_risk_action')) {
        const highRiskActions = ['delete', 'approve', 'reject', 'process'];
        if (highRiskActions.includes(context.action)) {
          violations.push('High risk action detected');
        }
      }

      if (trimmedCondition.includes('sensitive_data')) {
        if (context.compliance && (context.compliance.piiAccessed || context.compliance.phiAccessed)) {
          violations.push('Sensitive data accessed');
        }
      }

      if (trimmedCondition.includes('unusual_location')) {
        if (context.location && context.location.country !== 'US') {
          violations.push('Access from unusual location');
        }
      }

      if (trimmedCondition.includes('multiple_failures')) {
        // This would need to check recent audit logs for failures
        // For now, we'll skip this complex check
      }
    }

    const isViolation = violations.length > 0;
    return {
      isViolation,
      shouldAlert: isViolation && rule.enforcementAction !== 'log-only',
      reason: violations.join('; ')
    };
  }

  async evaluateScriptRule(rule, context) {
    // Custom script evaluation (would need sandboxing in production)
    try {
      // This is a simplified version - in production, you'd want proper sandboxing
      const scriptFunction = new Function('context', rule.customScript);
      const result = scriptFunction(context);
      
      return {
        isViolation: result.isViolation || false,
        shouldAlert: result.shouldAlert || false,
        reason: result.reason || 'Custom rule violation'
      };
    } catch (error) {
      this.logger.error(`Script rule execution error for ${rule.ruleId}:`, error);
      return {
        isViolation: false,
        shouldAlert: false,
        error: error.message
      };
    }
  }

  async createViolation(rule, context, evaluationResult) {
    const violationData = {
      ruleId: rule.ruleId,
      severity: rule.severity,
      category: rule.category,
      context: {
        action: context.action,
        resourceType: context.resourceType,
        resourceId: context.resourceId,
        userId: context.userId,
        userRole: context.userRole,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        sessionId: context.sessionId
      },
      details: {
        description: evaluationResult.reason || `Violation of rule: ${rule.name}`,
        ruleDescription: rule.description,
        violationReason: evaluationResult.reason,
        timestamp: context.timestamp || new Date()
      },
      alert: {
        triggered: rule.enforcementAction !== 'log-only',
        alertMethod: this.determineAlertMethods(rule.severity),
        alertSentAt: rule.enforcementAction !== 'log-only' ? new Date() : null
      },
      metrics: {
        detectionTime: evaluationResult.detectionTime
      },
      impact: this.assessImpact(context, evaluationResult)
    };

    return await ComplianceViolation.createViolation(violationData);
  }

  determineAlertMethods(severity) {
    switch (severity) {
      case 'critical':
        return ['email', 'sms', 'slack', 'dashboard', 'webhook'];
      case 'high':
        return ['email', 'slack', 'dashboard'];
      case 'medium':
        return ['email', 'dashboard'];
      case 'low':
        return ['dashboard'];
      default:
        return ['dashboard'];
    }
  }

  assessImpact(context, evaluationResult) {
    const impact = {
      dataBreach: false,
      recordsAffected: 0,
      usersAffected: 0,
      financialImpact: { estimated: 0, actual: 0 },
      regulatoryImpact: 'none'
    };

    // Assess data breach risk
    if (context.compliance && (context.compliance.piiAccessed || context.compliance.phiAccessed)) {
      impact.dataBreach = true;
      impact.regulatoryImpact = 'moderate';
    }

    // Assess records affected (simplified)
    if (context.resourceType === 'claim' || context.resourceType === 'payment') {
      impact.recordsAffected = 1;
    }

    // Assess users affected
    if (context.action === 'delete' || context.action === 'update') {
      impact.usersAffected = 1;
    }

    return impact;
  }

  async triggerAlerts(violation) {
    try {
      // Get alert recipients based on severity
      const recipients = await this.getAlertRecipients(violation.severity);
      
      // Send notifications through different channels
      for (const method of violation.alert.alertMethod) {
        switch (method) {
          case 'email':
            await this.sendEmailAlert(violation, recipients);
            break;
          case 'sms':
            await this.sendSMSAlert(violation, recipients);
            break;
          case 'slack':
            await this.sendSlackAlert(violation);
            break;
          case 'dashboard':
            await this.updateDashboardAlert(violation);
            break;
          case 'webhook':
            await this.sendWebhookAlert(violation);
            break;
        }
      }

      this.logger.info(`Alerts triggered for violation ${violation.violationId}`);
    } catch (error) {
      this.logger.error(`Failed to trigger alerts for violation ${violation.violationId}:`, error);
    }
  }

  async getAlertRecipients(severity) {
    // This would typically query user roles and preferences
    // For now, return a default list
    return [
      { email: 'compliance@company.com', role: 'compliance-officer' },
      { email: 'security@company.com', role: 'security-admin' }
    ];
  }

  async sendEmailAlert(violation, recipients) {
    const subject = `Compliance Violation Alert: ${violation.severity.toUpperCase()} - ${violation.violationId}`;
    const message = this.formatEmailMessage(violation);
    
    for (const recipient of recipients) {
      await notificationService.sendEmail(recipient.email, subject, message);
    }
  }

  async sendSMSAlert(violation, recipients) {
    const message = `URGENT: Compliance violation ${violation.violationId} detected. Severity: ${violation.severity}`;
    
    for (const recipient of recipients) {
      if (recipient.phone) {
        await notificationService.sendSMS(recipient.phone, message);
      }
    }
  }

  async sendSlackAlert(violation) {
    const message = {
      text: `Compliance Violation Alert`,
      attachments: [{
        color: this.getSeverityColor(violation.severity),
        fields: [
          { title: 'Violation ID', value: violation.violationId, short: true },
          { title: 'Severity', value: violation.severity.toUpperCase(), short: true },
          { title: 'Rule', value: violation.ruleId, short: true },
          { title: 'Description', value: violation.details.description, short: false }
        ]
      }]
    };
    
    await notificationService.sendSlackMessage(message);
  }

  async updateDashboardAlert(violation) {
    // Update dashboard with new violation
    // This would typically use WebSocket or similar real-time communication
    this.logger.info(`Dashboard updated with violation ${violation.violationId}`);
  }

  async sendWebhookAlert(violation) {
    // Send webhook to external monitoring system
    const webhookUrl = process.env.COMPLIANCE_WEBHOOK_URL;
    if (webhookUrl) {
      const payload = {
        violationId: violation.violationId,
        severity: violation.severity,
        category: violation.category,
        timestamp: violation.details.timestamp,
        details: violation.details
      };
      
      await notificationService.sendWebhook(webhookUrl, payload);
    }
  }

  formatEmailMessage(violation) {
    return `
Compliance Violation Alert

Violation ID: ${violation.violationId}
Severity: ${violation.severity.toUpperCase()}
Category: ${violation.category}
Rule: ${violation.ruleId}

Description: ${violation.details.description}

Context:
- Action: ${violation.context.action}
- Resource Type: ${violation.context.resourceType}
- User Role: ${violation.context.userRole}
- Timestamp: ${violation.details.timestamp}

Impact:
- Data Breach: ${violation.impact.dataBreach ? 'Yes' : 'No'}
- Records Affected: ${violation.impact.recordsAffected}
- Regulatory Impact: ${violation.impact.regulatoryImpact}

Please review this violation and take appropriate action.
    `.trim();
  }

  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return 'danger';
      case 'high': return 'warning';
      case 'medium': return 'good';
      case 'low': return '#36a64f';
      default: return 'good';
    }
  }

  async getComplianceReport(startDate, endDate) {
    try {
      const violations = await ComplianceViolation.getViolationStats(startDate, endDate);
      const rules = await ComplianceRule.find({ isActive: true });
      
      return {
        period: { startDate, endDate },
        summary: {
          totalViolations: violations.reduce((sum, v) => sum + v.count, 0),
          totalRules: rules.length,
          criticalViolations: violations.filter(v => v.severity === 'critical').reduce((sum, v) => sum + v.count, 0),
          highViolations: violations.filter(v => v.severity === 'high').reduce((sum, v) => sum + v.count, 0),
          openViolations: await ComplianceViolation.countDocuments({ status: { $in: ['open', 'investigating'] } })
        },
        violations: violations,
        rules: rules.map(rule => ({
          ruleId: rule.ruleId,
          name: rule.name,
          category: rule.category,
          severity: rule.severity,
          stats: rule.stats
        }))
      };
    } catch (error) {
      this.logger.error('Failed to generate compliance report:', error);
      throw error;
    }
  }
}

module.exports = new ComplianceService();
