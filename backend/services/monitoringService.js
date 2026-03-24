/**
 * Performance Monitoring and Alerting Service
 * Monitors claim processing performance and sends alerts for issues
 */

const EventEmitter = require('events');
const nodemailer = require('nodemailer');

class MonitoringService extends EventEmitter {
  constructor() {
    super();
    
    this.config = {
      // Performance thresholds
      thresholds: {
        processingTime: 30000, // 30 seconds
        errorRate: 0.05, // 5%
        queueSize: 1000,
        memoryUsage: 0.8, // 80%
        cpuUsage: 0.85 // 85%
      },
      
      // Alert configuration
      alerts: {
        email: {
          enabled: true,
          smtp: {
            host: process.env.SMTP_HOST,
            port: process.env.SMTP_PORT || 587,
            secure: false,
            auth: {
              user: process.env.SMTP_USER,
              pass: process.env.SMTP_PASS
            }
          },
          recipients: process.env.ALERT_RECIPIENTS ? process.env.ALERT_RECIPIENTS.split(',') : []
        },
        webhook: {
          enabled: false,
          url: process.env.WEBHOOK_URL,
          timeout: 5000
        },
        slack: {
          enabled: false,
          webhookUrl: process.env.SLACK_WEBHOOK_URL,
          channel: '#alerts'
        }
      },
      
      // Monitoring intervals
      intervals: {
        metrics: 60000, // 1 minute
        healthCheck: 300000, // 5 minutes
        cleanup: 3600000 // 1 hour
      }
    };
    
    this.metrics = {
      pipelines: new Map(),
      stages: new Map(),
      errors: [],
      performance: {
        totalProcessed: 0,
        totalErrors: 0,
        averageProcessingTime: 0,
        currentQueueSize: 0
      },
      system: {
        memoryUsage: 0,
        cpuUsage: 0,
        uptime: 0
      }
    };
    
    this.alerts = [];
    this.timers = new Map();
    
    this.initializeMonitoring();
  }

  /**
   * Initialize monitoring service
   */
  initializeMonitoring() {
    // Start periodic monitoring
    this.startMetricsCollection();
    this.startHealthChecks();
    this.startCleanup();
    
    // Initialize email transporter if enabled
    if (this.config.alerts.email.enabled) {
      this.emailTransporter = nodemailer.createTransporter(this.config.alerts.email.smtp);
    }
    
    // Handle process signals
    process.on('SIGTERM', () => this.shutdown());
    process.on('SIGINT', () => this.shutdown());
    
    console.log('Monitoring service initialized');
  }

  /**
   * Initialize pipeline tracking
   */
  async initializePipeline(pipelineId, claimId, options) {
    const pipeline = {
      id: pipelineId,
      claimId,
      startTime: Date.now(),
      endTime: null,
      duration: null,
      status: 'running',
      stages: {},
      errors: [],
      options
    };
    
    this.metrics.pipelines.set(pipelineId, pipeline);
    
    // Set timeout alert
    this.setPipelineTimeout(pipelineId, this.config.thresholds.processingTime);
    
    this.emit('pipeline:started', pipeline);
  }

  /**
   * Log stage completion
   */
  async logStageCompletion(pipelineId, stageName, result) {
    const pipeline = this.metrics.pipelines.get(pipelineId);
    if (!pipeline) return;
    
    const stage = {
      name: stageName,
      startTime: Date.now(),
      endTime: Date.now(),
      duration: result.duration || 0,
      success: result.success || false,
      error: result.error || null
    };
    
    pipeline.stages[stageName] = stage;
    
    // Track stage metrics
    const stageKey = `${stageName}`;
    if (!this.metrics.stages.has(stageKey)) {
      this.metrics.stages.set(stageKey, {
        totalExecutions: 0,
        totalDuration: 0,
        errors: 0
      });
    }
    
    const stageMetrics = this.metrics.stages.get(stageKey);
    stageMetrics.totalExecutions++;
    stageMetrics.totalDuration += stage.duration;
    if (!stage.success) {
      stageMetrics.errors++;
    }
    
    this.emit('stage:completed', { pipelineId, stageName, result });
  }

  /**
   * Log pipeline completion
   */
  async logPipelineCompletion(pipelineResult) {
    const pipeline = this.metrics.pipelines.get(pipelineResult.pipelineId);
    if (!pipeline) return;
    
    pipeline.endTime = Date.now();
    pipeline.duration = pipeline.endTime - pipeline.startTime;
    pipeline.status = pipelineResult.finalDecision?.status || 'completed';
    pipeline.finalDecision = pipelineResult.finalDecision;
    
    // Update performance metrics
    this.updatePerformanceMetrics(pipeline);
    
    // Check for performance alerts
    this.checkPerformanceAlerts(pipeline);
    
    this.emit('pipeline:completed', pipeline);
  }

  /**
   * Log pipeline error
   */
  async logPipelineError(pipelineId, error) {
    const pipeline = this.metrics.pipelines.get(pipelineId);
    if (!pipeline) return;
    
    pipeline.errors.push({
      timestamp: Date.now(),
      message: error.message,
      stack: error.stack
    });
    
    pipeline.status = 'error';
    
    // Update error metrics
    this.metrics.performance.totalErrors++;
    this.metrics.errors.push({
      pipelineId,
      timestamp: Date.now(),
      error: error.message
    });
    
    // Send alert for critical errors
    if (this.isCriticalError(error)) {
      this.sendAlert('critical', 'Pipeline Error', {
        pipelineId,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
    
    this.emit('pipeline:error', { pipelineId, error });
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(pipeline) {
    const perf = this.metrics.performance;
    
    perf.totalProcessed++;
    if (pipeline.status === 'error') {
      perf.totalErrors++;
    }
    
    // Update average processing time
    const totalDuration = Array.from(this.metrics.pipelines.values())
      .filter(p => p.duration)
      .reduce((sum, p) => sum + p.duration, 0);
    
    const completedPipelines = Array.from(this.metrics.pipelines.values())
      .filter(p => p.duration).length;
    
    perf.averageProcessingTime = completedPipelines > 0 ? totalDuration / completedPipelines : 0;
  }

  /**
   * Check for performance alerts
   */
  checkPerformanceAlerts(pipeline) {
    // Check processing time
    if (pipeline.duration > this.config.thresholds.processingTime) {
      this.sendAlert('warning', 'Slow Pipeline Processing', {
        pipelineId: pipeline.id,
        duration: pipeline.duration,
        threshold: this.config.thresholds.processingTime
      });
    }
    
    // Check error rate
    const errorRate = this.metrics.performance.totalErrors / this.metrics.performance.totalProcessed;
    if (errorRate > this.config.thresholds.errorRate) {
      this.sendAlert('critical', 'High Error Rate', {
        errorRate: (errorRate * 100).toFixed(2) + '%',
        threshold: (this.config.thresholds.errorRate * 100).toFixed(2) + '%',
        totalErrors: this.metrics.performance.totalErrors,
        totalProcessed: this.metrics.performance.totalProcessed
      });
    }
  }

  /**
   * Check for system alerts
   */
  checkSystemAlerts() {
    const system = this.metrics.system;
    
    // Check memory usage
    if (system.memoryUsage > this.config.thresholds.memoryUsage) {
      this.sendAlert('warning', 'High Memory Usage', {
        usage: (system.memoryUsage * 100).toFixed(2) + '%',
        threshold: (this.config.thresholds.memoryUsage * 100).toFixed(2) + '%'
      });
    }
    
    // Check CPU usage
    if (system.cpuUsage > this.config.thresholds.cpuUsage) {
      this.sendAlert('critical', 'High CPU Usage', {
        usage: (system.cpuUsage * 100).toFixed(2) + '%',
        threshold: (this.config.thresholds.cpuUsage * 100).toFixed(2) + '%'
      });
    }
    
    // Check queue size
    if (this.metrics.performance.currentQueueSize > this.config.thresholds.queueSize) {
      this.sendAlert('warning', 'Large Queue Size', {
        size: this.metrics.performance.currentQueueSize,
        threshold: this.config.thresholds.queueSize
      });
    }
  }

  /**
   * Send alert through configured channels
   */
  async sendAlert(severity, title, data) {
    const alert = {
      id: this.generateAlertId(),
      severity,
      title,
      data,
      timestamp: new Date().toISOString()
    };
    
    this.alerts.push(alert);
    
    // Send email alert
    if (this.config.alerts.email.enabled && this.emailTransporter) {
      await this.sendEmailAlert(alert);
    }
    
    // Send webhook alert
    if (this.config.alerts.webhook.enabled) {
      await this.sendWebhookAlert(alert);
    }
    
    // Send Slack alert
    if (this.config.alerts.slack.enabled) {
      await this.sendSlackAlert(alert);
    }
    
    this.emit('alert:sent', alert);
  }

  /**
   * Send email alert
   */
  async sendEmailAlert(alert) {
    try {
      const subject = `[${alert.severity.toUpperCase()}] ${alert.title}`;
      const html = this.generateEmailTemplate(alert);
      
      await this.emailTransporter.sendMail({
        from: process.env.SMTP_FROM || 'alerts@healthcare.com',
        to: this.config.alerts.email.recipients.join(','),
        subject,
        html
      });
      
    } catch (error) {
      console.error('Failed to send email alert:', error);
    }
  }

  /**
   * Send webhook alert
   */
  async sendWebhookAlert(alert) {
    try {
      await axios.post(this.config.alerts.webhook.url, alert, {
        timeout: this.config.alerts.webhook.timeout
      });
    } catch (error) {
      console.error('Failed to send webhook alert:', error);
    }
  }

  /**
   * Send Slack alert
   */
  async sendSlackAlert(alert) {
    try {
      const payload = {
        channel: this.config.alerts.slack.channel,
        username: 'HealthCare Monitor',
        text: `${alert.severity.toUpperCase()}: ${alert.title}`,
        attachments: [{
          color: this.getSlackColor(alert.severity),
          fields: Object.entries(alert.data).map(([key, value]) => ({
            title: key,
            value: JSON.stringify(value),
            short: true
          })),
          timestamp: Math.floor(new Date(alert.timestamp).getTime() / 1000)
        }]
      };
      
      await axios.post(this.config.alerts.slack.webhookUrl, payload);
    } catch (error) {
      console.error('Failed to send Slack alert:', error);
    }
  }

  /**
   * Set pipeline timeout
   */
  setPipelineTimeout(pipelineId, timeout) {
    const timer = setTimeout(() => {
      const pipeline = this.metrics.pipelines.get(pipelineId);
      if (pipeline && pipeline.status === 'running') {
        this.sendAlert('warning', 'Pipeline Timeout', {
          pipelineId,
          timeout,
          runningTime: Date.now() - pipeline.startTime
        });
      }
    }, timeout);
    
    this.timers.set(pipelineId, timer);
  }

  /**
   * Start metrics collection
   */
  startMetricsCollection() {
    setInterval(() => {
      this.collectSystemMetrics();
    }, this.config.intervals.metrics);
  }

  /**
   * Start health checks
   */
  startHealthChecks() {
    setInterval(() => {
      this.performHealthChecks();
    }, this.config.intervals.healthCheck);
  }

  /**
   * Start cleanup process
   */
  startCleanup() {
    setInterval(() => {
      this.cleanup();
    }, this.config.intervals.cleanup);
  }

  /**
   * Collect system metrics
   */
  collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    const totalMem = memUsage.heapTotal + memUsage.external;
    const usedMem = memUsage.heapUsed + memUsage.external;
    
    this.metrics.system.memoryUsage = usedMem / totalMem;
    this.metrics.system.uptime = process.uptime();
    
    // CPU usage would require additional monitoring
    // For now, we'll use a placeholder
    this.metrics.system.cpuUsage = Math.random() * 0.5; // Placeholder
    
    this.checkSystemAlerts();
  }

  /**
   * Perform health checks
   */
  async performHealthChecks() {
    const health = {
      status: 'healthy',
      checks: {
        memory: this.metrics.system.memoryUsage < this.config.thresholds.memoryUsage,
        errorRate: (this.metrics.performance.totalErrors / Math.max(1, this.metrics.performance.totalProcessed)) < this.config.thresholds.errorRate,
        processingTime: this.metrics.performance.averageProcessingTime < this.config.thresholds.processingTime
      },
      timestamp: new Date().toISOString()
    };
    
    const allHealthy = Object.values(health.checks).every(check => check);
    health.status = allHealthy ? 'healthy' : 'degraded';
    
    if (!allHealthy) {
      this.sendAlert('warning', 'Health Check Failed', health);
    }
    
    this.emit('health:check', health);
  }

  /**
   * Cleanup old data
   */
  cleanup() {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    
    // Clean up old pipelines
    for (const [id, pipeline] of this.metrics.pipelines.entries()) {
      if (now - pipeline.endTime > maxAge) {
        this.metrics.pipelines.delete(id);
      }
    }
    
    // Clean up old errors
    this.metrics.errors = this.metrics.errors.filter(error => 
      now - error.timestamp < maxAge
    );
    
    // Clean up old alerts
    this.alerts = this.alerts.filter(alert => 
      now - new Date(alert.timestamp).getTime() < maxAge
    );
    
    // Clean up timers
    for (const [id, timer] of this.timers.entries()) {
      if (!this.metrics.pipelines.has(id)) {
        clearTimeout(timer);
        this.timers.delete(id);
      }
    }
  }

  /**
   * Get pipeline statistics
   */
  getPipelineStatistics() {
    const pipelines = Array.from(this.metrics.pipelines.values());
    
    const statusCounts = pipelines.reduce((counts, pipeline) => {
      counts[pipeline.status] = (counts[pipeline.status] || 0) + 1;
      return counts;
    }, {});
    
    const stageStats = {};
    for (const [stageName, metrics] of this.metrics.stages.entries()) {
      stageStats[stageName] = {
        totalExecutions: metrics.totalExecutions,
        averageDuration: metrics.totalDuration / Math.max(1, metrics.totalExecutions),
        errorRate: metrics.errors / Math.max(1, metrics.totalExecutions)
      };
    }
    
    return {
      totalPipelines: pipelines.length,
      statusCounts,
      stageStats,
      performance: this.metrics.performance,
      system: this.metrics.system,
      recentAlerts: this.alerts.slice(-10),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Helper methods
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isCriticalError(error) {
    const criticalPatterns = [
      /database.*connection/i,
      /out of memory/i,
      /timeout/i,
      /authentication.*failed/i
    ];
    
    return criticalPatterns.some(pattern => pattern.test(error.message));
  }

  generateEmailTemplate(alert) {
    return `
      <h2>${alert.title}</h2>
      <p><strong>Severity:</strong> ${alert.severity.toUpperCase()}</p>
      <p><strong>Time:</strong> ${alert.timestamp}</p>
      
      <h3>Details:</h3>
      <pre>${JSON.stringify(alert.data, null, 2)}</pre>
      
      <hr>
      <p><small>This alert was generated by the Healthcare Claim Processing System</small></p>
    `;
  }

  getSlackColor(severity) {
    const colors = {
      info: '#36a64f',
      warning: '#ff9500',
      critical: '#ff0000'
    };
    
    return colors[severity] || '#36a64f';
  }

  /**
   * Shutdown monitoring service
   */
  shutdown() {
    // Clear all timers
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    
    this.emit('shutdown');
    console.log('Monitoring service shutdown complete');
  }
}

module.exports = MonitoringService;
