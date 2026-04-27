const cron = require('node-cron');
const ModelTrainer = require('../training/trainer');
const ModelMonitor = require('../monitoring/modelMonitor');
const winston = require('winston');
const ML_CONFIG = require('../config');

class MLScheduler {
  constructor() {
    this.trainer = new ModelTrainer();
    this.monitor = new ModelMonitor();
    this.scheduledTasks = new Map();
    this.taskHistory = [];
    
    this.setupLogging();
    this.setupScheduledTasks();
  }

  setupLogging() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/ml-scheduler.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  setupScheduledTasks() {
    // Model retraining schedule
    if (ML_CONFIG.scheduling.retraining.enabled) {
      this.scheduleTask(
        'model_retraining',
        ML_CONFIG.scheduling.retraining.cron,
        this.performModelRetraining.bind(this),
        'Automated model retraining'
      );
    }

    // Model monitoring schedule
    if (ML_CONFIG.scheduling.monitoring.enabled) {
      this.scheduleTask(
        'model_monitoring',
        ML_CONFIG.scheduling.monitoring.cron,
        this.performModelMonitoring.bind(this),
        'Automated model monitoring'
      );
    }

    // Cleanup schedule
    if (ML_CONFIG.scheduling.cleanup.enabled) {
      this.scheduleTask(
        'cleanup',
        ML_CONFIG.scheduling.cleanup.cron,
        this.performCleanup.bind(this),
        'Automated cleanup of old data and models'
      );
    }

    // Data freshness check (daily)
    this.scheduleTask(
      'data_freshness_check',
      '0 6 * * *', // Daily at 6 AM
      this.performDataFreshnessCheck.bind(this),
      'Check data freshness for training'
    );

    // Model performance report (weekly)
    this.scheduleTask(
      'performance_report',
      '0 9 * * 1', // Weekly on Monday at 9 AM
      this.generatePerformanceReport.bind(this),
      'Generate weekly performance report'
    );
  }

  scheduleTask(taskName, cronExpression, taskFunction, description) {
    if (this.scheduledTasks.has(taskName)) {
      this.logger.warn(`Task ${taskName} is already scheduled`);
      return;
    }

    try {
      const task = cron.schedule(cronExpression, async () => {
        await this.executeTask(taskName, taskFunction);
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      this.scheduledTasks.set(taskName, {
        task,
        cronExpression,
        description,
        lastRun: null,
        nextRun: null,
        status: 'scheduled'
      });

      task.start();
      
      this.logger.info(`Task scheduled: ${taskName}`, {
        cronExpression,
        description
      });

    } catch (error) {
      this.logger.error(`Failed to schedule task ${taskName}:`, error);
    }
  }

  async executeTask(taskName, taskFunction) {
    const startTime = Date.now();
    const taskInfo = this.scheduledTasks.get(taskName);
    
    this.logger.info(`Executing task: ${taskName}`);
    
    try {
      taskInfo.status = 'running';
      taskInfo.lastRun = new Date().toISOString();

      const result = await taskFunction();
      const duration = Date.now() - startTime;

      taskInfo.status = 'completed';
      taskInfo.lastResult = result;
      taskInfo.lastDuration = duration;

      this.taskHistory.push({
        taskName,
        status: 'success',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        result
      });

      this.logger.info(`Task completed successfully: ${taskName}`, {
        duration,
        result
      });

    } catch (error) {
      const duration = Date.now() - startTime;
      
      taskInfo.status = 'failed';
      taskInfo.lastError = error.message;

      this.taskHistory.push({
        taskName,
        status: 'error',
        startTime: new Date(startTime).toISOString(),
        endTime: new Date().toISOString(),
        duration,
        error: error.message
      });

      this.logger.error(`Task failed: ${taskName}`, {
        duration,
        error: error.message
      });

    } finally {
      // Keep only last 100 task executions
      if (this.taskHistory.length > 100) {
        this.taskHistory = this.taskHistory.slice(-100);
      }
    }
  }

  async performModelRetraining() {
    this.logger.info('Starting automated model retraining');
    
    const results = await this.trainer.retrainAllModels();
    const successful = Object.values(results).filter(r => r.success).length;
    const failed = Object.values(results).filter(r => !r.success).length;

    // Send notification if there are failures
    if (failed > 0) {
      await this.sendNotification('model_retraining_failure', {
        message: `${failed} models failed to retrain during scheduled training`,
        results
      });
    }

    return {
      total: Object.keys(results).length,
      successful,
      failed,
      results
    };
  }

  async performModelMonitoring() {
    this.logger.info('Starting automated model monitoring');
    
    await this.monitor.performHealthCheck();
    
    const metrics = this.monitor.getAllMetrics();
    const alerts = this.monitor.getAlerts();
    const activeAlerts = alerts.filter(a => !a.acknowledged);

    // Send notification for critical alerts
    const criticalAlerts = activeAlerts.filter(a => a.severity === 'high');
    if (criticalAlerts.length > 0) {
      await this.sendNotification('critical_alerts', {
        message: `${criticalAlerts.length} critical alerts detected`,
        alerts: criticalAlerts
      });
    }

    return {
      modelsMonitored: Object.keys(metrics).length,
      totalAlerts: alerts.length,
      activeAlerts: activeAlerts.length,
      criticalAlerts: criticalAlerts.length
    };
  }

  async performCleanup() {
    this.logger.info('Starting automated cleanup');
    
    const retentionDays = ML_CONFIG.scheduling.cleanup.retentionDays;
    const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
    
    let cleanedItems = 0;

    // Clean up old task history
    const initialHistoryLength = this.taskHistory.length;
    this.taskHistory = this.taskHistory.filter(task => 
      new Date(task.endTime) > cutoffDate
    );
    cleanedItems += initialHistoryLength - this.taskHistory.length;

    // Clean up old monitoring data
    const metrics = this.monitor.getAllMetrics();
    for (const [modelName, modelMetrics] of Object.entries(metrics)) {
      if (modelMetrics.performanceHistory) {
        const initialHistoryLength = modelMetrics.performanceHistory.length;
        modelMetrics.performanceHistory = modelMetrics.performanceHistory.filter(h => 
          new Date(h.timestamp) > cutoffDate
        );
        cleanedItems += initialHistoryLength - modelMetrics.performanceHistory.length;
      }
    }

    // Clean up old explanations
    const explanations = this.monitor.getAllExplanations ? this.monitor.getAllExplanations() : [];
    if (Array.isArray(explanations)) {
      const initialExplanationsLength = explanations.length;
      const filteredExplanations = explanations.filter(exp => 
        new Date(exp.timestamp) > cutoffDate
      );
      cleanedItems += initialExplanationsLength - filteredExplanations.length;
    }

    return {
      retentionDays,
      cutoffDate: cutoffDate.toISOString(),
      itemsCleaned: cleanedItems
    };
  }

  async performDataFreshnessCheck() {
    this.logger.info('Starting data freshness check');
    
    const freshnessThreshold = ML_CONFIG.scheduling.retraining.dataFreshnessDays;
    const cutoffDate = new Date(Date.now() - freshnessThreshold * 24 * 60 * 60 * 1000);
    
    const dataSources = ['claims', 'policies', 'customers', 'payments'];
    const freshnessReport = {};

    for (const source of dataSources) {
      try {
        // Get latest data timestamp for each source
        const latestTimestamp = await this.getLatestDataTimestamp(source);
        const isFresh = latestTimestamp && new Date(latestTimestamp) > cutoffDate;
        
        freshnessReport[source] = {
          latestTimestamp,
          isFresh,
          daysOld: latestTimestamp ? 
            Math.floor((Date.now() - new Date(latestTimestamp).getTime()) / (1000 * 60 * 60 * 24)) : 
            null
        };

        if (!isFresh) {
          await this.sendNotification('data_stale', {
            message: `Data source ${source} has stale data`,
            source,
            latestTimestamp,
            daysOld: freshnessReport[source].daysOld
          });
        }

      } catch (error) {
        this.logger.error(`Error checking freshness for ${source}:`, error);
        freshnessReport[source] = {
          error: error.message,
          isFresh: false
        };
      }
    }

    return {
      freshnessThreshold,
      cutoffDate: cutoffDate.toISOString(),
      sources: freshnessReport
    };
  }

  async generatePerformanceReport() {
    this.logger.info('Generating performance report');
    
    const report = {
      timestamp: new Date().toISOString(),
      period: 'weekly',
      models: {},
      summary: {
        totalModels: 0,
        modelsWithAlerts: 0,
        totalAlerts: 0,
        criticalAlerts: 0
      }
    };

    const metrics = this.monitor.getAllMetrics();
    const alerts = this.monitor.getAlerts();

    for (const [modelName, modelMetrics] of Object.entries(metrics)) {
      const modelAlerts = alerts.filter(a => a.modelName === modelName);
      const criticalAlerts = modelAlerts.filter(a => a.severity === 'high');

      report.models[modelName] = {
        performance: modelMetrics.performance,
        drift: modelMetrics.drift,
        predictionCount: modelMetrics.predictions.length,
        alerts: {
          total: modelAlerts.length,
          critical: criticalAlerts.length,
          recent: modelAlerts.filter(a => 
            new Date(a.timestamp) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
          ).length
        }
      };

      report.summary.totalModels++;
      if (modelAlerts.length > 0) {
        report.summary.modelsWithAlerts++;
      }
      report.summary.totalAlerts += modelAlerts.length;
      report.summary.criticalAlerts += criticalAlerts.length;
    }

    // Save report
    await this.savePerformanceReport(report);

    // Send notification if there are critical issues
    if (report.summary.criticalAlerts > 0) {
      await this.sendNotification('weekly_report_critical', {
        message: `Weekly performance report shows ${report.summary.criticalAlerts} critical alerts`,
        summary: report.summary
      });
    }

    return report;
  }

  async getLatestDataTimestamp(dataSource) {
    // This would typically query your database
    // For now, return a mock timestamp
    const now = new Date();
    const daysAgo = Math.floor(Math.random() * 30);
    return new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000).toISOString();
  }

  async savePerformanceReport(report) {
    const fs = require('fs').promises;
    const path = require('path');
    
    try {
      const reportsDir = path.join(process.cwd(), 'reports');
      await fs.mkdir(reportsDir, { recursive: true });
      
      const filename = `performance-report-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(reportsDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      this.logger.info(`Performance report saved to ${filepath}`);
    } catch (error) {
      this.logger.error('Error saving performance report:', error);
    }
  }

  async sendNotification(type, data) {
    // This would integrate with your notification system
    // For now, just log the notification
    this.logger.warn(`Notification: ${type}`, data);
    
    // You could integrate with:
    // - Email notifications
    // - Slack/webhook notifications
    // - SMS notifications
    // - In-app notifications
  }

  // Manual task execution
  async runTaskManually(taskName) {
    const taskInfo = this.scheduledTasks.get(taskName);
    if (!taskInfo) {
      throw new Error(`Task ${taskName} not found`);
    }

    this.logger.info(`Manually running task: ${taskName}`);
    await this.executeTask(taskName, taskInfo.task.callback);
  }

  // Task management
  pauseTask(taskName) {
    const taskInfo = this.scheduledTasks.get(taskName);
    if (!taskInfo) {
      throw new Error(`Task ${taskName} not found`);
    }

    taskInfo.task.stop();
    taskInfo.status = 'paused';
    this.logger.info(`Task paused: ${taskName}`);
  }

  resumeTask(taskName) {
    const taskInfo = this.scheduledTasks.get(taskName);
    if (!taskInfo) {
      throw new Error(`Task ${taskName} not found`);
    }

    taskInfo.task.start();
    taskInfo.status = 'scheduled';
    this.logger.info(`Task resumed: ${taskName}`);
  }

  removeTask(taskName) {
    const taskInfo = this.scheduledTasks.get(taskName);
    if (!taskInfo) {
      throw new Error(`Task ${taskName} not found`);
    }

    taskInfo.task.stop();
    this.scheduledTasks.delete(taskName);
    this.logger.info(`Task removed: ${taskName}`);
  }

  // Status and reporting
  getTaskStatus(taskName = null) {
    if (taskName) {
      return this.scheduledTasks.get(taskName) || null;
    }
    
    return Object.fromEntries(this.scheduledTasks);
  }

  getTaskHistory(limit = 50) {
    return this.taskHistory.slice(-limit);
  }

  getNextRuns() {
    const nextRuns = {};
    
    for (const [taskName, taskInfo] of this.scheduledTasks.entries()) {
      // This is a simplified calculation
      // In practice, you'd use a cron parser to get the exact next run time
      nextRuns[taskName] = {
        nextRun: 'Calculated based on cron schedule',
        status: taskInfo.status,
        lastRun: taskInfo.lastRun
      };
    }
    
    return nextRuns;
  }

  async shutdown() {
    this.logger.info('Shutting down ML scheduler');
    
    // Stop all scheduled tasks
    for (const [taskName, taskInfo] of this.scheduledTasks.entries()) {
      taskInfo.task.stop();
    }
    
    this.logger.info('All scheduled tasks stopped');
  }
}

module.exports = MLScheduler;
