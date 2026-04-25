/**
 * Compliance Alert Service
 * Handles violation detection, alerting, and notification management
 */

class ComplianceAlertService {
  constructor(io, notificationService) {
    this.io = io;
    this.notificationService = notificationService;
    this.alertChannels = new Map();
    this.alertRules = new Map();
    this.alertHistory = [];
    this.suppressionRules = new Map();
    
    this.initializeAlertChannels();
    this.initializeAlertRules();
  }

  /**
   * Initialize alert channels
   */
  initializeAlertChannels() {
    this.alertChannels.set('websocket', {
      name: 'Real-time WebSocket',
      enabled: true,
      priority: 'high',
      description: 'Real-time alerts via WebSocket connections'
    });

    this.alertChannels.set('email', {
      name: 'Email Notifications',
      enabled: true,
      priority: 'medium',
      description: 'Email alerts for compliance violations'
    });

    this.alertChannels.set('dashboard', {
      name: 'Dashboard Notifications',
      enabled: true,
      priority: 'medium',
      description: 'In-dashboard notification banners'
    });

    this.alertChannels.set('webhook', {
      name: 'Webhook Notifications',
      enabled: false,
      priority: 'low',
      description: 'External webhook integrations'
    });

    this.alertChannels.set('sms', {
      name: 'SMS Alerts',
      enabled: false,
      priority: 'high',
      description: 'Critical alerts via SMS'
    });
  }

  /**
   * Initialize alert rules
   */
  initializeAlertRules() {
    // High severity violations trigger immediate alerts
    this.alertRules.set('high_severity_immediate', {
      name: 'High Severity Immediate Alert',
      condition: (violation) => violation.severity === 'high',
      channels: ['websocket', 'email', 'dashboard'],
      delay: 0,
      escalation: {
        enabled: true,
        delay: 300000, // 5 minutes
        channels: ['sms']
      }
    });

    // Critical violations trigger all channels
    this.alertRules.set('critical_severity_all', {
      name: 'Critical Severity All Channels',
      condition: (violation) => violation.severity === 'critical',
      channels: ['websocket', 'email', 'dashboard', 'sms'],
      delay: 0,
      escalation: {
        enabled: false
      }
    });

    // Multiple violations from same rule
    this.alertRules.set('repeated_violations', {
      name: 'Repeated Violations Alert',
      condition: (violation, context) => {
        const recentViolations = context.recentViolations || [];
        const sameRuleViolations = recentViolations.filter(v => 
          v.ruleId === violation.ruleId && 
          v.entityType === violation.entityType &&
          new Date(v.detectedAt) > new Date(Date.now() - 3600000) // Last hour
        );
        return sameRuleViolations.length >= 3;
      },
      channels: ['websocket', 'email'],
      delay: 0,
      escalation: {
        enabled: true,
        delay: 600000, // 10 minutes
        channels: ['dashboard', 'sms']
      }
    });

    // Compliance score drop
    this.alertRules.set('compliance_score_drop', {
      name: 'Compliance Score Drop',
      condition: (violation, context) => {
        const previousScore = context.previousComplianceScore || 100;
        const currentScore = context.currentComplianceScore || 100;
        return (previousScore - currentScore) >= 10; // 10% drop
      },
      channels: ['websocket', 'dashboard'],
      delay: 0,
      escalation: {
        enabled: false
      }
    });
  }

  /**
   * Process violation and determine alert strategy
   */
  async processViolation(violation, context = {}) {
    try {
      // Check if alert should be suppressed
      if (this.isAlertSuppressed(violation)) {
        console.log(`[Alert] Alert suppressed for violation ${violation.violationId}`);
        return null;
      }

      // Determine applicable alert rules
      const applicableRules = this.getApplicableAlertRules(violation, context);
      
      if (applicableRules.length === 0) {
        console.log(`[Alert] No alert rules match violation ${violation.violationId}`);
        return null;
      }

      // Create alert
      const alert = this.createAlert(violation, applicableRules, context);
      
      // Process alert through channels
      const alertResults = await this.sendAlert(alert);
      
      // Store in history
      this.alertHistory.push({
        ...alert,
        results: alertResults,
        processedAt: new Date()
      });

      // Schedule escalation if needed
      this.scheduleEscalation(alert, alertResults);

      return alert;

    } catch (error) {
      console.error('[Alert] Error processing violation:', error);
      throw error;
    }
  }

  /**
   * Check if alert should be suppressed
   */
  isAlertSuppressed(violation) {
    for (const [ruleId, suppression] of this.suppressionRules) {
      if (this.matchesSuppressionRule(violation, suppression)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Check if violation matches suppression rule
   */
  matchesSuppressionRule(violation, suppression) {
    // Check time-based suppression
    if (suppression.timeWindow) {
      const now = new Date();
      const windowStart = new Date(now.getTime() - suppression.timeWindow);
      
      const recentAlerts = this.alertHistory.filter(alert => 
        alert.violationId === violation.violationId &&
        alert.processedAt > windowStart
      );
      
      if (recentAlerts.length >= suppression.maxAlerts) {
        return true;
      }
    }

    // Check rule-based suppression
    if (suppression.ruleIds && suppression.ruleIds.includes(violation.ruleId)) {
      return true;
    }

    // Check severity-based suppression
    if (suppression.severities && suppression.severities.includes(violation.severity)) {
      return true;
    }

    return false;
  }

  /**
   * Get applicable alert rules
   */
  getApplicableAlertRules(violation, context) {
    const applicableRules = [];

    for (const [ruleId, rule] of this.alertRules) {
      try {
        if (rule.condition(violation, context)) {
          applicableRules.push({
            ruleId,
            ...rule
          });
        }
      } catch (error) {
        console.error(`[Alert] Error evaluating alert rule ${ruleId}:`, error);
      }
    }

    return applicableRules;
  }

  /**
   * Create alert object
   */
  createAlert(violation, applicableRules, context) {
    const alertId = `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Determine highest priority channels
    const channels = new Set();
    for (const rule of applicableRules) {
      rule.channels.forEach(channel => channels.add(channel));
    }

    // Calculate alert priority
    const priority = this.calculateAlertPriority(violation, applicableRules);

    return {
      alertId,
      violation,
      applicableRules: applicableRules.map(r => r.ruleId),
      channels: Array.from(channels),
      priority,
      severity: violation.severity,
      title: this.generateAlertTitle(violation, applicableRules),
      message: this.generateAlertMessage(violation, applicableRules),
      context,
      createdAt: new Date(),
      status: 'pending'
    };
  }

  /**
   * Calculate alert priority
   */
  calculateAlertPriority(violation, applicableRules) {
    let priority = 1;

    // Base priority from severity
    const severityPriority = { low: 1, medium: 2, high: 3, critical: 4 };
    priority = severityPriority[violation.severity] || 1;

    // Boost priority for multiple rules
    if (applicableRules.length > 1) {
      priority += 1;
    }

    // Boost priority for critical entities
    if (violation.entityType === 'patient' && violation.entityId) {
      priority += 1;
    }

    return Math.min(priority, 5); // Cap at 5
  }

  /**
   * Generate alert title
   */
  generateAlertTitle(violation, applicableRules) {
    const ruleNames = applicableRules.map(r => r.name).join(', ');
    return `Compliance Violation: ${violation.ruleId} - ${ruleNames}`;
  }

  /**
   * Generate alert message
   */
  generateAlertMessage(violation, applicableRules) {
    let message = violation.description;
    
    if (applicableRules.length > 1) {
      message += ` (Multiple alert conditions triggered)`;
    }

    message += `\n\nEntity: ${violation.entityType}:${violation.entityId}`;
    message += `\nSeverity: ${violation.severity}`;
    message += `\nDetected: ${new Date(violation.detectedAt).toLocaleString()}`;

    return message;
  }

  /**
   * Send alert through channels
   */
  async sendAlert(alert) {
    const results = [];

    for (const channelName of alert.channels) {
      const channel = this.alertChannels.get(channelName);
      
      if (!channel || !channel.enabled) {
        results.push({
          channel: channelName,
          success: false,
          reason: 'Channel not available or disabled'
        });
        continue;
      }

      try {
        const result = await this.sendToChannel(channelName, alert);
        results.push({
          channel: channelName,
          success: true,
          result
        });

        console.log(`[Alert] Alert sent via ${channelName}: ${alert.alertId}`);
      } catch (error) {
        console.error(`[Alert] Failed to send via ${channelName}:`, error);
        results.push({
          channel: channelName,
          success: false,
          error: error.message
        });
      }
    }

    return results;
  }

  /**
   * Send alert to specific channel
   */
  async sendToChannel(channelName, alert) {
    switch (channelName) {
      case 'websocket':
        return this.sendWebSocketAlert(alert);
      
      case 'email':
        return this.sendEmailAlert(alert);
      
      case 'dashboard':
        return this.sendDashboardAlert(alert);
      
      case 'webhook':
        return this.sendWebhookAlert(alert);
      
      case 'sms':
        return this.sendSMSAlert(alert);
      
      default:
        throw new Error(`Unknown channel: ${channelName}`);
    }
  }

  /**
   * Send WebSocket alert
   */
  sendWebSocketAlert(alert) {
    return new Promise((resolve) => {
      this.io.emit('compliance:alert', {
        type: 'violation',
        alert: {
          id: alert.alertId,
          title: alert.title,
          message: alert.message,
          severity: alert.severity,
          priority: alert.priority,
          entityId: alert.violation.entityId,
          entityType: alert.violation.entityType,
          timestamp: alert.createdAt,
          requiresAction: true
        }
      });

      resolve({ sent: true, recipients: 'all_connected_clients' });
    });
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    if (!this.notificationService) {
      throw new Error('Notification service not available');
    }

    const emailData = {
      to: ['compliance-team@healthcare.com'],
      subject: alert.title,
      template: 'compliance_violation',
      data: {
        alert,
        violation: alert.violation,
        timestamp: alert.createdAt
      }
    };

    return await this.notificationService.sendEmail(emailData);
  }

  /**
   * Send dashboard alert
   */
  sendDashboardAlert(alert) {
    return new Promise((resolve) => {
      // Store in database for dashboard display
      this.io.emit('dashboard:notification', {
        type: 'compliance',
        level: alert.severity,
        title: alert.title,
        message: alert.message,
        timestamp: alert.createdAt,
        persistent: alert.severity === 'high' || alert.severity === 'critical',
        actions: [
          {
            label: 'View Details',
            action: 'navigate',
            target: `/compliance/violations/${alert.violation.violationId}`
          },
          {
            label: 'Resolve',
            action: 'resolve',
            target: alert.violation.violationId
          }
        ]
      });

      resolve({ displayed: true });
    });
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    // Implementation would depend on webhook configuration
    console.log(`[Alert] Webhook alert for ${alert.alertId} - not implemented`);
    return { skipped: true, reason: 'Webhook not configured' };
  }

  /**
   * Send SMS alert
   */
  async sendSMSAlert(alert) {
    if (!this.notificationService) {
      throw new Error('Notification service not available');
    }

    const smsData = {
      to: ['+1234567890'], // Would be configurable
      message: `URGENT: ${alert.title} - ${alert.violation.entityType}:${alert.violation.entityId}`
    };

    return await this.notificationService.sendSMS(smsData);
  }

  /**
   * Schedule alert escalation
   */
  scheduleEscalation(alert, initialResults) {
    // Find rules that require escalation
    const escalationRules = alert.applicableRules.map(ruleId => 
      this.alertRules.get(ruleId)
    ).filter(rule => rule && rule.escalation && rule.escalation.enabled);

    if (escalationRules.length === 0) {
      return;
    }

    // Use shortest escalation delay
    const escalationDelay = Math.min(...escalationRules.map(rule => rule.escalation.delay));
    
    setTimeout(async () => {
      await this.escalateAlert(alert, escalationRules, initialResults);
    }, escalationDelay);
  }

  /**
   * Escalate alert
   */
  async escalateAlert(alert, escalationRules, initialResults) {
    try {
      // Check if alert has been resolved
      if (alert.status === 'resolved') {
        console.log(`[Alert] Alert ${alert.alertId} already resolved, skipping escalation`);
        return;
      }

      // Determine escalation channels
      const escalationChannels = new Set();
      for (const rule of escalationRules) {
        rule.escalation.channels.forEach(channel => escalationChannels.add(channel));
      }

      // Create escalated alert
      const escalatedAlert = {
        ...alert,
        alertId: `${alert.alertId}_escalated`,
        channels: Array.from(escalationChannels),
        escalatedFrom: alert.alertId,
        escalatedAt: new Date(),
        priority: Math.min(alert.priority + 1, 5)
      };

      // Send escalated alert
      const escalationResults = await this.sendAlert(escalatedAlert);

      // Update original alert
      alert.status = 'escalated';
      alert.escalatedAt = new Date();
      alert.escalationResults = escalationResults;

      console.log(`[Alert] Alert ${alert.alertId} escalated to ${Array.from(escalationChannels).join(', ')}`);

    } catch (error) {
      console.error(`[Alert] Error escalating alert ${alert.alertId}:`, error);
    }
  }

  /**
   * Add alert suppression rule
   */
  addSuppressionRule(ruleId, rule) {
    this.suppressionRules.set(ruleId, {
      ...rule,
      createdAt: new Date(),
      enabled: true
    });
  }

  /**
   * Remove alert suppression rule
   */
  removeSuppressionRule(ruleId) {
    return this.suppressionRules.delete(ruleId);
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(timeWindow = 24 * 60 * 60 * 1000) { // Default 24 hours
    const now = new Date();
    const windowStart = new Date(now.getTime() - timeWindow);

    const recentAlerts = this.alertHistory.filter(alert => 
      alert.processedAt > windowStart
    );

    const stats = {
      total: recentAlerts.length,
      bySeverity: { low: 0, medium: 0, high: 0, critical: 0 },
      byChannel: {},
      byStatus: { pending: 0, resolved: 0, escalated: 0 },
      averageResolutionTime: 0
    };

    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const alert of recentAlerts) {
      // Count by severity
      stats.bySeverity[alert.severity] = (stats.bySeverity[alert.severity] || 0) + 1;

      // Count by status
      stats.byStatus[alert.status] = (stats.byStatus[alert.status] || 0) + 1;

      // Count by channel
      for (const result of alert.results || []) {
        if (result.success) {
          stats.byChannel[result.channel] = (stats.byChannel[result.channel] || 0) + 1;
        }
      }

      // Calculate resolution time
      if (alert.status === 'resolved' && alert.resolvedAt) {
        const resolutionTime = alert.resolvedAt - alert.processedAt;
        totalResolutionTime += resolutionTime;
        resolvedCount++;
      }
    }

    if (resolvedCount > 0) {
      stats.averageResolutionTime = totalResolutionTime / resolvedCount;
    }

    return stats;
  }

  /**
   * Get alert history
   */
  getAlertHistory(options = {}) {
    const { limit = 100, offset = 0, severity, status, channel } = options;

    let filtered = this.alertHistory;

    // Apply filters
    if (severity) {
      filtered = filtered.filter(alert => alert.severity === severity);
    }

    if (status) {
      filtered = filtered.filter(alert => alert.status === status);
    }

    if (channel) {
      filtered = filtered.filter(alert => 
        alert.results.some(result => result.channel === channel && result.success)
      );
    }

    // Sort by creation time (newest first)
    filtered.sort((a, b) => b.createdAt - a.createdAt);

    // Apply pagination
    return {
      alerts: filtered.slice(offset, offset + limit),
      total: filtered.length,
      limit,
      offset
    };
  }
}

module.exports = ComplianceAlertService;
