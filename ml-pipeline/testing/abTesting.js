const crypto = require('crypto');
const winston = require('winston');
const ML_CONFIG = require('../config');

class ABTestingFramework {
  constructor() {
    this.experiments = new Map();
    this.assignments = new Map();
    this.results = new Map();
    
    this.setupLogging();
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
          filename: 'logs/ab-testing.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  createExperiment(name, config) {
    const experiment = {
      name,
      description: config.description || '',
      models: config.models || [],
      trafficSplit: config.trafficSplit || { control: 0.5, treatment: 0.5 },
      minSampleSize: config.minSampleSize || ML_CONFIG.abTesting.minSampleSize,
      significanceLevel: config.significanceLevel || ML_CONFIG.abTesting.significanceLevel,
      testDurationDays: config.testDurationDays || ML_CONFIG.abTesting.testDurationDays,
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + config.testDurationDays * 24 * 60 * 60 * 1000).toISOString(),
      status: 'active',
      metrics: config.metrics || ['accuracy', 'precision', 'recall', 'response_time'],
      metadata: config.metadata || {}
    };

    // Validate traffic split
    const totalSplit = Object.values(experiment.trafficSplit).reduce((sum, val) => sum + val, 0);
    if (Math.abs(totalSplit - 1.0) > 0.01) {
      throw new Error('Traffic split must sum to 1.0');
    }

    this.experiments.set(name, experiment);
    this.results.set(name, {
      control: { predictions: [], actuals: [], metrics: {} },
      treatment: { predictions: [], actuals: [], metrics: {} }
    });

    this.logger.info(`A/B test experiment created: ${name}`, { experiment });

    return experiment;
  }

  assignToVariant(experimentName, userId = null, context = {}) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    if (experiment.status !== 'active') {
      throw new Error(`Experiment ${experimentName} is not active`);
    }

    // Check if user is already assigned
    const assignmentKey = userId ? `${experimentName}:${userId}` : `${experimentName}:${JSON.stringify(context)}`;
    
    if (this.assignments.has(assignmentKey)) {
      return this.assignments.get(assignmentKey);
    }

    // Determine variant based on traffic split
    const random = this.generateRandomValue(userId, context);
    const variant = this.selectVariant(random, experiment.trafficSplit);

    const assignment = {
      experimentName,
      variant,
      userId,
      context,
      timestamp: new Date().toISOString(),
      randomValue: random
    };

    this.assignments.set(assignmentKey, assignment);
    
    this.logger.debug(`User assigned to variant`, { assignment });

    return assignment;
  }

  generateRandomValue(userId, context) {
    let seed;
    
    if (userId) {
      seed = userId;
    } else if (context && Object.keys(context).length > 0) {
      seed = JSON.stringify(context);
    } else {
      return Math.random();
    }

    // Generate deterministic random value for consistent assignment
    const hash = crypto.createHash('md5').update(seed).digest('hex');
    return parseInt(hash.substring(0, 8), 16) / 0xffffffff;
  }

  selectVariant(random, trafficSplit) {
    let cumulative = 0;
    
    for (const [variant, split] of Object.entries(trafficSplit)) {
      cumulative += split;
      if (random <= cumulative) {
        return variant;
      }
    }
    
    // Fallback to first variant
    return Object.keys(trafficSplit)[0];
  }

  recordPrediction(experimentName, variant, prediction, actual = null, metadata = {}) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    const result = this.results.get(experimentName);
    if (!result || !result[variant]) {
      throw new Error(`Invalid variant ${variant} for experiment ${experimentName}`);
    }

    const record = {
      prediction,
      actual,
      metadata,
      timestamp: new Date().toISOString()
    };

    result[variant].predictions.push(prediction);
    if (actual !== null) {
      result[variant].actuals.push(actual);
    }

    // Calculate metrics if we have actual values
    if (actual !== null && result[variant].actuals.length > 0) {
      this.calculateVariantMetrics(experimentName, variant);
    }

    this.logger.debug(`Prediction recorded for ${experimentName}`, {
      variant,
      prediction,
      actual,
      sampleSize: result[variant].predictions.length
    });

    return record;
  }

  calculateVariantMetrics(experimentName, variant) {
    const result = this.results.get(experimentName);
    const variantData = result[variant];
    
    if (variantData.actuals.length === 0) {
      return;
    }

    const predictions = variantData.predictions.slice(0, variantData.actuals.length);
    const actuals = variantData.actuals;

    // Calculate basic metrics
    const metrics = {};

    // Accuracy (for classification)
    if (this.isClassificationTask(actuals)) {
      const threshold = 0.5;
      const binaryPredictions = predictions.map(p => p > threshold ? 1 : 0);
      
      let correct = 0;
      for (let i = 0; i < actuals.length; i++) {
        if (actuals[i] === binaryPredictions[i]) {
          correct++;
        }
      }
      
      metrics.accuracy = correct / actuals.length;
      
      // Precision and Recall
      let tp = 0, fp = 0, fn = 0;
      for (let i = 0; i < actuals.length; i++) {
        if (actuals[i] === 1 && binaryPredictions[i] === 1) tp++;
        else if (actuals[i] === 0 && binaryPredictions[i] === 1) fp++;
        else if (actuals[i] === 1 && binaryPredictions[i] === 0) fn++;
      }
      
      metrics.precision = tp / (tp + fp) || 0;
      metrics.recall = tp / (tp + fn) || 0;
      metrics.f1Score = 2 * (metrics.precision * metrics.recall) / (metrics.precision + metrics.recall) || 0;
    } else {
      // Regression metrics
      const n = actuals.length;
      const residuals = actuals.map((a, i) => a - predictions[i]);
      
      const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
      metrics.mse = mse;
      metrics.rmse = Math.sqrt(mse);
      metrics.mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / n;
      
      const actualMean = actuals.reduce((sum, a) => sum + a, 0) / n;
      const ssTotal = actuals.reduce((sum, a) => sum + Math.pow(a - actualMean, 2), 0);
      const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
      metrics.r2 = 1 - (ssResidual / ssTotal);
    }

    // Sample size
    metrics.sampleSize = actuals.length;

    variantData.metrics = metrics;
  }

  analyzeExperiment(experimentName) {
    const experiment = this.experiments.get(experimentName);
    const results = this.results.get(experimentName);
    
    if (!experiment || !results) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    const analysis = {
      experimentName,
      status: experiment.status,
      sampleSizes: {},
      metrics: {},
      statisticalTests: {},
      recommendation: '',
      timestamp: new Date().toISOString()
    };

    // Calculate sample sizes
    for (const [variant, data] of Object.entries(results)) {
      analysis.sampleSizes[variant] = {
        predictions: data.predictions.length,
        actuals: data.actuals.length
      };
    }

    // Check if minimum sample size is met
    const minSampleSize = Math.min(
      ...Object.values(analysis.sampleSizes).map(s => s.actuals)
    );

    if (minSampleSize < experiment.minSampleSize) {
      analysis.status = 'insufficient_sample_size';
      analysis.recommendation = `Continue collecting data. Minimum sample size: ${experiment.minSampleSize}, Current: ${minSampleSize}`;
      return analysis;
    }

    // Compare variants
    const variants = Object.keys(results);
    if (variants.length === 2) {
      const [control, treatment] = variants;
      
      // Perform statistical tests
      analysis.statisticalTests = this.performStatisticalTests(
        results[control], 
        results[treatment], 
        experiment.significanceLevel
      );

      // Generate recommendation
      analysis.recommendation = this.generateRecommendation(
        analysis.statisticalTests,
        control,
        treatment
      );
    }

    // Compile metrics comparison
    for (const metric of experiment.metrics) {
      analysis.metrics[metric] = {};
      for (const [variant, data] of Object.entries(results)) {
        if (data.metrics && data.metrics[metric] !== undefined) {
          analysis.metrics[metric][variant] = data.metrics[metric];
        }
      }
    }

    return analysis;
  }

  performStatisticalTests(control, treatment, significanceLevel) {
    const tests = {};

    // T-test for continuous metrics
    if (control.actuals.length > 0 && treatment.actuals.length > 0) {
      const controlErrors = this.calculateErrors(control.predictions.slice(0, control.actuals.length), control.actuals);
      const treatmentErrors = this.calculateErrors(treatment.predictions.slice(0, treatment.actuals.length), treatment.actuals);

      tests.tTest = this.performTTest(controlErrors, treatmentErrors, significanceLevel);
    }

    // Chi-square test for categorical outcomes
    if (this.isClassificationTask(control.actuals)) {
      tests.chiSquare = this.performChiSquareTest(control, treatment, significanceLevel);
    }

    // Confidence intervals
    tests.confidenceIntervals = {
      control: this.calculateConfidenceInterval(control.metrics, control.actuals.length, significanceLevel),
      treatment: this.calculateConfidenceInterval(treatment.metrics, treatment.actuals.length, significanceLevel)
    };

    return tests;
  }

  calculateErrors(predictions, actuals) {
    return predictions.map((p, i) => Math.abs(p - actuals[i]));
  }

  performTTest(controlErrors, treatmentErrors, significanceLevel) {
    const n1 = controlErrors.length;
    const n2 = treatmentErrors.length;
    
    const mean1 = controlErrors.reduce((sum, e) => sum + e, 0) / n1;
    const mean2 = treatmentErrors.reduce((sum, e) => sum + e, 0) / n2;
    
    const var1 = controlErrors.reduce((sum, e) => sum + Math.pow(e - mean1, 2), 0) / (n1 - 1);
    const var2 = treatmentErrors.reduce((sum, e) => sum + Math.pow(e - mean2, 2), 0) / (n2 - 1);
    
    const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
    const standardError = pooledStd * Math.sqrt(1/n1 + 1/n2);
    
    const tStatistic = (mean1 - mean2) / standardError;
    const degreesOfFreedom = n1 + n2 - 2;
    
    // Simplified p-value calculation (in practice, use a proper statistical library)
    const pValue = this.calculatePValue(tStatistic, degreesOfFreedom);
    
    return {
      tStatistic,
      degreesOfFreedom,
      pValue,
      significant: pValue < significanceLevel,
      meanDifference: mean1 - mean2,
      confidenceInterval: this.calculateMeanDifferenceCI(mean1, mean2, standardError, significanceLevel)
    };
  }

  performChiSquareTest(control, treatment, significanceLevel) {
    // Simplified chi-square test for binary classification
    const threshold = 0.5;
    
    const controlPredicted = control.predictions.slice(0, control.actuals.length).map(p => p > threshold ? 1 : 0);
    const treatmentPredicted = treatment.predictions.slice(0, treatment.actuals.length).map(p => p > threshold ? 1 : 0);
    
    // Create contingency table
    const table = {
      controlCorrect: controlPredicted.filter((p, i) => p === control.actuals[i]).length,
      controlIncorrect: controlPredicted.filter((p, i) => p !== control.actuals[i]).length,
      treatmentCorrect: treatmentPredicted.filter((p, i) => p === treatment.actuals[i]).length,
      treatmentIncorrect: treatmentPredicted.filter((p, i) => p !== treatment.actuals[i]).length
    };

    // Calculate chi-square statistic
    const total = table.controlCorrect + table.controlIncorrect + table.treatmentCorrect + table.treatmentIncorrect;
    const rowTotals = [
      table.controlCorrect + table.controlIncorrect,
      table.treatmentCorrect + table.treatmentIncorrect
    ];
    const colTotals = [
      table.controlCorrect + table.treatmentCorrect,
      table.controlIncorrect + table.treatmentIncorrect
    ];

    let chiSquare = 0;
    const observed = [table.controlCorrect, table.controlIncorrect, table.treatmentCorrect, table.treatmentIncorrect];
    const expected = [
      (rowTotals[0] * colTotals[0]) / total,
      (rowTotals[0] * colTotals[1]) / total,
      (rowTotals[1] * colTotals[0]) / total,
      (rowTotals[1] * colTotals[1]) / total
    ];

    for (let i = 0; i < 4; i++) {
      chiSquare += Math.pow(observed[i] - expected[i], 2) / expected[i];
    }

    const pValue = this.calculateChiSquarePValue(chiSquare, 1); // 1 degree of freedom

    return {
      chiSquare,
      pValue,
      significant: pValue < significanceLevel,
      contingencyTable: table
    };
  }

  calculateConfidenceInterval(metrics, sampleSize, significanceLevel) {
    const confidence = 1 - significanceLevel;
    const zScore = this.getZScore(confidence);
    
    const intervals = {};
    
    for (const [metric, value] of Object.entries(metrics)) {
      if (typeof value === 'number' && metric !== 'sampleSize') {
        // Standard error estimation (simplified)
        const standardError = Math.sqrt(value * (1 - value) / sampleSize) if (value <= 1 && value >= 0) : 
                            Math.abs(value) / Math.sqrt(sampleSize);
        
        const margin = zScore * standardError;
        
        intervals[metric] = {
          lower: value - margin,
          upper: value + margin,
          margin
        };
      }
    }
    
    return intervals;
  }

  calculateMeanDifferenceCI(mean1, mean2, standardError, significanceLevel) {
    const confidence = 1 - significanceLevel;
    const zScore = this.getZScore(confidence);
    const margin = zScore * standardError;
    
    return {
      lower: (mean1 - mean2) - margin,
      upper: (mean1 - mean2) + margin
    };
  }

  generateRecommendation(tests, control, treatment) {
    if (tests.tTest && tests.tTest.significant) {
      if (tests.tTest.meanDifference < 0) {
        return `Treatment (${treatment}) shows statistically significant improvement over control (${control}). Consider implementing treatment model.`;
      } else {
        return `Control (${control}) performs significantly better than treatment (${treatment}). Keep control model.`;
      }
    }
    
    if (tests.chiSquare && tests.chiSquare.significant) {
      return `Significant difference detected between variants. Review detailed metrics for final decision.`;
    }
    
    return `No statistically significant difference detected. Consider extending the test or implementing based on other factors.`;
  }

  // Simplified statistical functions (in practice, use a proper statistical library)
  calculatePValue(tStatistic, degreesOfFreedom) {
    // This is a simplified approximation
    const absT = Math.abs(tStatistic);
    return Math.max(0.001, 2 * (1 - this.normalCDF(absT)));
  }

  calculateChiSquarePValue(chiSquare, degreesOfFreedom) {
    // Simplified approximation
    return Math.max(0.001, 1 - this.chiSquareCDF(chiSquare, degreesOfFreedom));
  }

  normalCDF(x) {
    return 0.5 * (1 + this.erf(x / Math.sqrt(2)));
  }

  chiSquareCDF(x, df) {
    // Simplified approximation
    return Math.min(1, x / (df + 2));
  }

  erf(x) {
    // Approximation of error function
    const a1 =  0.254829592;
    const a2 = -0.284496736;
    const a3 =  1.421413741;
    const a4 = -1.453152027;
    const a5 =  1.061405429;
    const p  =  0.3275911;

    const sign = x >= 0 ? 1 : -1;
    x = Math.abs(x);

    const t = 1.0 / (1.0 + p * x);
    const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

    return sign * y;
  }

  getZScore(confidence) {
    const zScores = {
      0.90: 1.645,
      0.95: 1.96,
      0.99: 2.576
    };
    return zScores[confidence] || 1.96;
  }

  concludeExperiment(experimentName, winner = null) {
    const experiment = this.experiments.get(experimentName);
    if (!experiment) {
      throw new Error(`Experiment ${experimentName} not found`);
    }

    experiment.status = 'concluded';
    experiment.endDate = new Date().toISOString();
    experiment.winner = winner;

    this.logger.info(`Experiment ${experimentName} concluded`, { winner });

    return experiment;
  }

  getExperiment(experimentName) {
    return this.experiments.get(experimentName);
  }

  getAllExperiments() {
    return Array.from(this.experiments.values());
  }

  getExperimentResults(experimentName) {
    return this.results.get(experimentName);
  }

  isClassificationTask(targets) {
    const uniqueTargets = [...new Set(targets)];
    return uniqueTargets.length <= 10 && uniqueTargets.every(t => Number.isInteger(t));
  }
}

module.exports = ABTestingFramework;
