const ModelTrainingMethods = require('./trainer-models');

class ModelEvaluation {
  static async evaluateModel(model, valFeatures, valTargets, testFeatures, testTargets, config) {
    const metrics = {};

    const valPredictions = ModelTrainingMethods.predict(model, valFeatures);
    metrics.validation = this.calculateMetrics(valTargets, valPredictions, config);

    const testPredictions = ModelTrainingMethods.predict(model, testFeatures);
    metrics.test = this.calculateMetrics(testTargets, testPredictions, config);

    if (ML_CONFIG.training.crossValidationFolds > 1) {
      const cvScores = await this.crossValidate(model, testFeatures, testTargets, config);
      metrics.crossValidation = cvScores;
    }

    return metrics;
  }

  static calculateMetrics(actual, predicted, config) {
    const isClassification = this.isClassificationTask(actual);
    
    if (isClassification) {
      return this.calculateClassificationMetrics(actual, predicted);
    } else {
      return this.calculateRegressionMetrics(actual, predicted);
    }
  }

  static calculateClassificationMetrics(actual, predicted) {
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
      falseNegatives: fn,
      confusionMatrix: {
        tp, tn, fp, fn
      }
    };
  }

  static calculateRegressionMetrics(actual, predicted) {
    const n = actual.length;
    const residuals = actual.map((a, i) => a - predicted[i]);
    
    const mse = residuals.reduce((sum, r) => sum + r * r, 0) / n;
    const rmse = Math.sqrt(mse);
    const mae = residuals.reduce((sum, r) => sum + Math.abs(r), 0) / n;
    
    const actualMean = actual.reduce((sum, a) => sum + a, 0) / n;
    const ssTotal = actual.reduce((sum, a) => sum + Math.pow(a - actualMean, 2), 0);
    const ssResidual = residuals.reduce((sum, r) => sum + r * r, 0);
    const r2 = 1 - (ssResidual / ssTotal);

    const mape = actual.reduce((sum, a, i) => {
      return sum + Math.abs((a - predicted[i]) / a);
    }, 0) / n * 100;

    return {
      mse,
      rmse,
      mae,
      r2,
      mape,
      meanActual: actualMean,
      meanPredicted: predicted.reduce((sum, p) => sum + p, 0) / n,
      residualStats: {
        mean: residuals.reduce((sum, r) => sum + r, 0) / n,
        std: Math.sqrt(residuals.reduce((sum, r) => sum + Math.pow(r - residuals.reduce((s, r) => s + r, 0) / n, 2), 0) / n)
      }
    };
  }

  static async crossValidate(model, features, targets, config) {
    const folds = ML_CONFIG.training.crossValidationFolds;
    const scores = [];

    const foldSize = Math.floor(features.length / folds);
    
    for (let i = 0; i < folds; i++) {
      const startIdx = i * foldSize;
      const endIdx = (i === folds - 1) ? features.length : (i + 1) * foldSize;
      
      const testFeatures = features.slice(startIdx, endIdx);
      const testTargets = targets.slice(startIdx, endIdx);
      const trainFeatures = [...features.slice(0, startIdx), ...features.slice(endIdx)];
      const trainTargets = [...targets.slice(0, startIdx), ...targets.slice(endIdx)];
      
      const foldModel = await this.trainModelFold(trainFeatures, trainTargets, config);
      
      const predictions = ModelTrainingMethods.predict(foldModel, testFeatures);
      const metrics = this.calculateMetrics(testTargets, predictions, config);
      scores.push(metrics);
    }

    const avgScores = {};
    const stdScores = {};
    
    if (scores.length > 0) {
      Object.keys(scores[0]).forEach(key => {
        if (typeof scores[0][key] === 'number') {
          const values = scores.map(score => score[key]);
          avgScores[key] = values.reduce((sum, val) => sum + val, 0) / values.length;
          const mean = avgScores[key];
          stdScores[key] = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
        }
      });
    }

    return {
      mean: avgScores,
      std: stdScores,
      foldScores: scores
    };
  }

  static async trainModelFold(features, targets, config) {
    switch (config.type) {
      case 'random_forest':
        return await ModelTrainingMethods.trainRandomForest(features, targets, config);
      case 'logistic_regression':
        return await ModelTrainingMethods.trainLogisticRegression(features, targets, config);
      case 'linear_regression':
        return await ModelTrainingMethods.trainLinearRegression(features, targets, config);
      default:
        throw new Error(`Cross-validation not supported for model type: ${config.type}`);
    }
  }

  static isClassificationTask(targets) {
    const uniqueTargets = [...new Set(targets)];
    return uniqueTargets.length <= 10 && uniqueTargets.every(t => Number.isInteger(t));
  }

  static generateClassificationReport(actual, predicted, classNames = ['Class 0', 'Class 1']) {
    const threshold = 0.5;
    const binaryPredicted = predicted.map(p => p > threshold ? 1 : 0);
    
    const report = {
      accuracy: 0,
      precision: {},
      recall: {},
      f1Score: {},
      support: {}
    };

    const uniqueClasses = [...new Set(actual)];
    
    uniqueClasses.forEach(className => {
      const classIndex = className;
      const tp = binaryPredicted.filter((p, i) => p === classIndex && actual[i] === classIndex).length;
      const fp = binaryPredicted.filter((p, i) => p === classIndex && actual[i] !== classIndex).length;
      const fn = binaryPredicted.filter((p, i) => p !== classIndex && actual[i] === classIndex).length;
      const tn = binaryPredicted.filter((p, i) => p !== classIndex && actual[i] !== classIndex).length;

      const precision = tp / (tp + fp) || 0;
      const recall = tp / (tp + fn) || 0;
      const f1 = 2 * (precision * recall) / (precision + recall) || 0;
      const support = actual.filter(a => a === classIndex).length;

      const classNameStr = classNames[classIndex] || `Class ${classIndex}`;
      report.precision[classNameStr] = precision;
      report.recall[classNameStr] = recall;
      report.f1Score[classNameStr] = f1;
      report.support[classNameStr] = support;
    });

    report.accuracy = binaryPredicted.filter((p, i) => p === actual[i]).length / actual.length;

    return report;
  }

  static calculateROCCurve(actual, predicted) {
    const thresholds = [];
    for (let i = 0; i <= 100; i++) {
      thresholds.push(i / 100);
    }

    const rocCurve = thresholds.map(threshold => {
      const binaryPredicted = predicted.map(p => p > threshold ? 1 : 0);
      
      let tp = 0, fp = 0, fn = 0, tn = 0;
      
      for (let i = 0; i < actual.length; i++) {
        if (actual[i] === 1 && binaryPredicted[i] === 1) tp++;
        else if (actual[i] === 0 && binaryPredicted[i] === 0) tn++;
        else if (actual[i] === 0 && binaryPredicted[i] === 1) fp++;
        else if (actual[i] === 1 && binaryPredicted[i] === 0) fn++;
      }

      const tpr = tp / (tp + fn) || 0;
      const fpr = fp / (fp + tn) || 0;

      return { threshold, tpr, fpr };
    });

    const auc = this.calculateAUC(rocCurve);

    return { rocCurve, auc };
  }

  static calculateAUC(rocCurve) {
    let auc = 0;
    for (let i = 1; i < rocCurve.length; i++) {
      const x1 = rocCurve[i - 1].fpr;
      const y1 = rocCurve[i - 1].tpr;
      const x2 = rocCurve[i].fpr;
      const y2 = rocCurve[i].tpr;
      auc += (x2 - x1) * (y1 + y2) / 2;
    }
    return auc;
  }
}

module.exports = ModelEvaluation;
