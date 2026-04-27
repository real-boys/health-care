const EventEmitter = require('events');
const winston = require('winston');
const cron = require('node-cron');
const ML_CONFIG = require('../config');

class ModelMonitor extends EventEmitter {
  constructor() {
    super();
    this.metrics = new Map();
    this.alerts = [];
    this.driftDetectors = new Map();
    this.performanceHistory = new Map();
    
    this.setupLogging();
    this.setupScheduledTasks();
  }

  setupLogging() {
    this.logger = winston.createLogger({
      level: ML_CONFIG.monitoring.logging.level,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ 
          filename: 'logs/model-monitoring.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  setupScheduledTasks() {
    if (ML_CONFIG.scheduling.monitoring.enabled) {
      cron.schedule(ML_CONFIG.scheduling.monitoring.cron, () => {
        this.performHealthCheck();
      });
    }
  }

  async trackPrediction(modelName, prediction, actual = null, metadata = {}) {
    const timestamp = new Date().toISOString();
    const predictionRecord = {
      modelName,
      prediction,
      actual,
      timestamp,
      metadata,
      inferenceTime: metadata.inferenceTime || 0,
      cacheHit: metadata.cacheHit || false
    };

    // Store prediction record
    if (!this.metrics.has(modelName)) {
      this.metrics.set(modelName, {
        predictions: [],
        performance: {},
        drift: {},
        alerts: []
      });
    }

    const modelMetrics = this.metrics.get(modelName);
    modelMetrics.predictions.push(predictionRecord);

    // Keep only recent predictions (last 1000)
    if (modelMetrics.predictions.length > 1000) {
      modelMetrics.predictions = modelMetrics.predictions.slice(-1000);
    }

    // Calculate performance metrics if actual value is available
    if (actual !== null) {
      this.updatePerformanceMetrics(modelName);
    }

    // Check for model drift
    await this.checkModelDrift(modelName);

    // Emit event for real-time monitoring
    this.emit('prediction', predictionRecord);

    this.logger.debug(`Prediction tracked for ${modelName}`, {
      prediction,
      actual,
      timestamp
    });
  }

  updatePerformanceMetrics(modelName) {
    const modelMetrics = this.metrics.get(modelName);
    const predictions = modelMetrics.predictions.filter(p => p.actual !== null);

    if (predictions.length === 0) return;

    const recent = predictions.slice(-100); // Last 100 predictions with actual values
    const actuals = recent.map(p => p.actual);
    const preds = recent.map(p => p.prediction);

    // Calculate metrics based on model type
    const isClassification = this.isClassificationTask(actuals);
    let metrics;

    if (isClassification) {
      metrics = this.calculateClassificationMetrics(actuals, preds);
    } else {
      metrics = this.calculateRegressionMetrics(actuals, preds);
    }

    // Add additional metrics
    metrics.avgInferenceTime = recent.reduce((sum, p) => sum + p.inferenceTime, 0) / recent.length;
    metrics.cacheHitRate = recent.filter(p => p.cacheHit).length / recent.length;
    metrics.predictionCount = recent.length;
    metrics.timestamp = new Date().toISOString();

    modelMetrics.performance = metrics;

    // Store in performance history
    if (!this.performanceHistory.has(modelName)) {
      this.performanceHistory.set(modelName, []);
    }

    const history = this.performanceHistory.get(modelName);
    history.push(metrics);

    // Keep only last 30 days of history
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    modelMetrics.performanceHistory = history.filter(h => 
      new Date(h.timestamp) > thirtyDaysAgo
    );

    // Check for performance alerts
    this.checkPerformanceAlerts(modelName, metrics);

    this.emit('performance_update', { modelName, metrics });
  }

  calculateClassificationMetrics(actual, predicted) {
    const threshold = 0.5;
    const binaryPredicted = predicted.map(p => p > threshold ? 1 : 0);
    
    let tp = 0, tn = 0, fp = 0, fn = 0;
    
    for (let i = 0; i < actual.length; i++) {
      if (actual[i] === 1 && binaryPredicted[i] === 1) tp++;
      else if (actual[i] === 0 && binaryPredicted[i] === 0) tn++;
      else if (actual[i] === 0 && binaryPredicted[i] === 1) fp++;
      else if (actual[i] === 1 && binaryPredicted[i] === 0) fn++;
    }

    const accuracy = (tp + tn) / (tp + tn + fp + fn);
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    const f1Score = 2 * (precision * recall) / (precision + recall) || 0;

    return {
      accuracy,
      precision,
      recall,
      f1Score,
      truePositives: tp,
      trueNegatives: tn,
      falsePositives: fp,
      falseNegatives: fn
    };
  }

  calculateRegressionMetrics(actual, predicted) {
    const n = actual.length;
    const residuals = actual.map((a, i) => a - predicted[i]);
    
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const rmse = Math.sqrt(mse);
    const mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / n;
    
    const actualMean = actual.reduce((sum, a) => sum + a, 0) / n;
    const ssTotal = actual.reduce((sum, a) => sum + Math.pow(a - actualMean, 2), 0);
    const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
    const r2 = 1 - (ssResidual / ssTotal);

    return {
      mse,
      rmse,
      mae,
      r2,
      meanActual: actualMean,
      meanPredicted: predicted.reduce((sum, p) => sum + p, 0) / n
    };
  }

  async checkModelDrift(modelName) {
    const modelMetrics = this.metrics.get(modelName);
    const predictions = modelMetrics.predictions;

    if (predictions.length < 100) {
      return; // Not enough data for drift detection
    }

    const recent = predictions.slice(-50);
    const historical = predictions.slice(-200, -50);

    if (historical.length < 50) {
      return; // Not enough historical data
    }

    // Statistical drift detection
    const recentPredictions = recent.map(p => p.prediction);
    const historicalPredictions = historical.map(p => p.prediction);

    const driftScore = this.calculateDriftScore(recentPredictions, historicalPredictions);

    modelMetrics.drift = {
      score: driftScore,
      threshold: ML_CONFIG.monitoring.alerting.driftThreshold,
      detected: driftScore > ML_CONFIG.monitoring.alerting.driftThreshold,
      timestamp: new Date().toISOString()
    };

    if (modelMetrics.drift.detected) {
      this.createAlert('model_drift', modelName, `Model drift detected with score: ${driftScore.toFixed(4)}`, {
        driftScore,
        threshold: ML_CONFIG.monitoring.alerting.driftThreshold
      });
    }

    this.emit('drift_check', { modelName, driftScore, detected: modelMetrics.drift.detected });
  }

  calculateDriftScore(recent, historical) {
    // Kolmogorov-Smirnov test for distribution drift
    const recentSorted = [...recent].sort((a, b) => a - b);
    const historicalSorted = [...historical].sort((a, b) => a - b);

    const n1 = recent.length;
    const n2 = historical.length;
    const combined = [...recentSorted, ...historicalSorted].sort((a, b) => a - b);

    let maxDiff = 0;
    let i1 = 0, i2 = 0;

    for (const value of combined) {
      while (i1 < n1 && recentSorted[i1] <= value) i1++;
      while (i2 < n2 && historicalSorted[i2] <= value) i2++;

      const cdf1 = i1 / n1;
      const cdf2 = i2 / n2;
      const diff = Math.abs(cdf1 - cdf2);
      maxDiff = Math.max(maxDiff, diff);
    }

    return maxDiff;
  }

  checkPerformanceAlerts(modelName, metrics) {
    const thresholds = ML_CONFIG.monitoring.alerting;

    // Check performance threshold
    if (metrics.accuracy && metrics.accuracy < thresholds.performanceThreshold) {
      this.createAlert('performance_degradation', modelName, 
        `Accuracy dropped to ${metrics.accuracy.toFixed(4)} below threshold ${thresholds.performanceThreshold}`,
        { accuracy: metrics.accuracy, threshold: thresholds.performanceThreshold }
      );
    }

    // Check inference time
    if (metrics.avgInferenceTime > ML_CONFIG.deployment.predictionTimeout) {
      this.createAlert('slow_inference', modelName,
        `Average inference time ${metrics.avgInferenceTime}ms exceeds timeout ${ML_CONFIG.deployment.predictionTimeout}ms`,
        { avgInferenceTime: metrics.avgInferenceTime }
      );
    }

    // Check cache hit rate
    if (metrics.cacheHitRate < 0.5 && ML_CONFIG.deployment.cacheEnabled) {
      this.createAlert('low_cache_hit_rate', modelName,
        `Cache hit rate ${(metrics.cacheHitRate * 100).toFixed(2)}% is below optimal`,
        { cacheHitRate: metrics.cacheHitRate }
      );
    }
  }

  createAlert(type, modelName, message, data = {}) {
    const alert = {
      id: Date.now().toString(),
      type,
      modelName,
      message,
      data,
      timestamp: new Date().toISOString(),
      severity: this.getAlertSeverity(type),
      acknowledged: false
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    this.logger.warn(`Alert created: ${type} for ${modelName}`, { alert });

    this.emit('alert', alert);
  }

  getAlertSeverity(type) {
    const severityMap = {
      'model_drift': 'high',
      'performance_degradation': 'medium',
      'slow_inference': 'medium',
      'low_cache_hit_rate': 'low',
      'data_quality_issue': 'high'
    };

    return severityMap[type] || 'medium';
  }

  async performHealthCheck() {
    this.logger.info('Performing model health check');

    for (const [modelName, modelMetrics] of this.metrics.entries()) {
      try {
        // Check if model has recent predictions
        const lastPrediction = modelMetrics.predictions[modelMetrics.predictions.length - 1];
        if (lastPrediction) {
          const timeSinceLastPrediction = Date.now() - new Date(lastPrediction.timestamp).getTime();
          const hoursSinceLastPrediction = timeSinceLastPrediction / (1000 * 60 * 60);

          if (hoursSinceLastPrediction > 24) {
            this.createAlert('no_recent_predictions', modelName,
              `No predictions in the last ${Math.round(hoursSinceLastPrediction)} hours`,
              { hoursSinceLastPrediction }
            );
          }
        }

        // Check performance trends
        if (modelMetrics.performance && this.performanceHistory.has(modelName)) {
          const history = this.performanceHistory.get(modelName);
          if (history.length >= 2) {
            const recent = history[history.length - 1];
            const previous = history[history.length - 2];

            if (recent.accuracy && previous.accuracy) {
              const accuracyDrop = previous.accuracy - recent.accuracy;
              if (accuracyDrop > 0.1) { // 10% drop
                this.createAlert('accuracy_drop', modelName,
                  `Accuracy dropped by ${(accuracyDrop * 100).toFixed(2)}%`,
                  { previousAccuracy: previous.accuracy, currentAccuracy: recent.accuracy }
                );
              }
            }
          }
        }

      } catch (error) {
        this.logger.error(`Health check failed for ${modelName}:`, error);
      }
    }

    this.emit('health_check_completed', { timestamp: new Date().toISOString() });
  }

  getMetrics(modelName) {
    return this.metrics.get(modelName) || null;
  }

  getAllMetrics() {
    return Object.fromEntries(this.metrics);
  }

  getAlerts(modelName = null, severity = null) {
    let alerts = this.alerts;

    if (modelName) {
      alerts = alerts.filter(alert => alert.modelName === modelName);
    }

    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }

    return alerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  acknowledgeAlert(alertId) {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = new Date().toISOString();
      this.logger.info(`Alert ${alertId} acknowledged`);
      return true;
    }
    return false;
  }

  clearAlerts(modelName = null) {
    if (modelName) {
      this.alerts = this.alerts.filter(alert => alert.modelName !== modelName);
    } else {
      this.alerts = [];
    }
    this.logger.info(`Alerts cleared${modelName ? ` for ${modelName}` : ''}`);
  }

  generateReport(modelName = null) {
    const report = {
      timestamp: new Date().toISOString(),
      models: {},
      summary: {
        totalModels: this.metrics.size,
        totalAlerts: this.alerts.length,
        activeAlerts: this.alerts.filter(a => !a.acknowledged).length
      }
    };

    const modelsToReport = modelName ? [modelName] : Array.from(this.metrics.keys());

    for (const name of modelsToReport) {
      const modelMetrics = this.metrics.get(name);
      if (modelMetrics) {
        report.models[name] = {
          performance: modelMetrics.performance,
          drift: modelMetrics.drift,
          predictionCount: modelMetrics.predictions.length,
          recentPredictions: modelMetrics.predictions.slice(-10),
          alerts: this.alerts.filter(a => a.modelName === name)
        };
      }
    }

    return report;
  }

  resetMetrics(modelName = null) {
    if (modelName) {
      this.metrics.delete(modelName);
      this.performanceHistory.delete(modelName);
      this.logger.info(`Metrics reset for ${modelName}`);
    } else {
      this.metrics.clear();
      this.performanceHistory.clear();
      this.logger.info('All metrics reset');
    }
  }

  isClassificationTask(targets) {
    const uniqueTargets = [...new Set(targets)];
    return uniqueTargets.length <= 10 && uniqueTargets.every(t => Number.isInteger(t));
  }
}

module.exports = ModelMonitor;
