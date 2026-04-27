const ModelTrainerCore = require('./trainer-core');
const ModelTrainingMethods = require('./trainer-models');
const ModelEvaluation = require('./trainer-evaluation');
const ModelPersistence = require('./trainer-persistence');

class ModelTrainer extends ModelTrainerCore {
  constructor() {
    super();
    this.trainingMethods = ModelTrainingMethods;
    this.evaluation = ModelEvaluation;
    this.persistence = ModelPersistence;
  }

  async trainRandomForest(features, targets, config) {
    return await this.trainingMethods.trainRandomForest(features, targets, config);
  }

  async trainLogisticRegression(features, targets, config) {
    return await this.trainingMethods.trainLogisticRegression(features, targets, config);
  }

  async trainLinearRegression(features, targets, config) {
    return await this.trainingMethods.trainLinearRegression(features, targets, config);
  }

  async trainNeuralNetwork(features, targets, config) {
    const result = await this.trainingMethods.trainNeuralNetwork(features, targets, config);
    this.trainingHistory.set('neural_network', result.history);
    return result.model;
  }

  async trainGradientBoosting(features, targets, config) {
    return await this.trainingMethods.trainGradientBoosting(features, targets, config);
  }

  async evaluateModel(model, valFeatures, valTargets, testFeatures, testTargets, config) {
    return await this.evaluation.evaluateModel(model, valFeatures, valTargets, testFeatures, testTargets, config);
  }

  calculateMetrics(actual, predicted, config) {
    return this.evaluation.calculateMetrics(actual, predicted, config);
  }

  predict(model, features) {
    return this.trainingMethods.predict(model, features);
  }

  async saveModel(modelName, model, metrics, config) {
    return await this.persistence.saveModel(modelName, model, metrics, config, this.featureEngineer);
  }

  async loadModel(modelName) {
    return await this.persistence.loadModel(modelName, this.featureEngineer);
  }

  async listModels() {
    return await this.persistence.listModels();
  }

  async deleteModel(modelName) {
    return await this.persistence.deleteModel(modelName);
  }

  async backupModel(modelName, backupPath) {
    return await this.persistence.backupModel(modelName, backupPath);
  }

  async restoreModel(backupPath, modelName) {
    return await this.persistence.restoreModel(backupPath, modelName);
  }

  async validateModel(modelName) {
    return await this.persistence.validateModel(modelName);
  }

  async getModelInfo(modelName) {
    return await this.persistence.getModelInfo(modelName);
  }

  async retrainAllModels() {
    const modelNames = Object.keys(require('../config').models);
    const results = {};

    for (const modelName of modelNames) {
      try {
        console.log(`Retraining model: ${modelName}`);
        const result = await this.trainModel(modelName);
        results[modelName] = { success: true, metrics: result.metrics };
      } catch (error) {
        console.error(`Failed to retrain model ${modelName}:`, error);
        results[modelName] = { success: false, error: error.message };
      }
    }

    return results;
  }

  async compareModels(modelNames, testFeatures, testTargets) {
    const comparison = {};

    for (const modelName of modelNames) {
      try {
        const { model } = await this.loadModel(modelName);
        const predictions = this.predict(model, testFeatures);
        const metrics = this.calculateMetrics(testTargets, predictions, require('../config').models[modelName]);
        
        comparison[modelName] = {
          metrics,
          predictions: predictions.slice(0, 10), // Sample predictions
          loaded: true
        };
      } catch (error) {
        comparison[modelName] = {
          error: error.message,
          loaded: false
        };
      }
    }

    return comparison;
  }

  async getTrainingHistory(modelName) {
    return this.trainingHistory.get(modelName) || null;
  }

  async exportModelReport(modelName, format = 'json') {
    const modelInfo = await this.getModelInfo(modelName);
    const history = await this.getTrainingHistory(modelName);
    
    const report = {
      modelInfo,
      trainingHistory: history ? {
        epochs: history.epoch.length,
        finalLoss: history.loss[history.loss.length - 1],
        finalValLoss: history.valLoss ? history.valLoss[history.valLoss.length - 1] : null
      } : null,
      generatedAt: new Date().toISOString()
    };

    if (format === 'json') {
      return JSON.stringify(report, null, 2);
    } else if (format === 'html') {
      return this.generateHTMLReport(report);
    } else {
      throw new Error(`Unsupported export format: ${format}`);
    }
  }

  generateHTMLReport(report) {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Model Report - ${report.modelInfo.modelName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; }
        .section { margin: 20px 0; }
        .metrics { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; }
        .metric { background: #f9f9f9; padding: 10px; border-radius: 3px; }
        .error { color: red; }
        .warning { color: orange; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Model Report: ${report.modelInfo.modelName}</h1>
        <p>Generated: ${new Date(report.generatedAt).toLocaleString()}</p>
    </div>
    
    <div class="section">
        <h2>Model Information</h2>
        <p><strong>Type:</strong> ${report.modelInfo.type}</p>
        <p><strong>Version:</strong> ${report.modelInfo.version}</p>
        <p><strong>Framework:</strong> ${report.modelInfo.framework}</p>
        <p><strong>Size:</strong> ${report.modelInfo.modelSize.mb} MB</p>
    </div>

    <div class="section">
        <h2>Performance Metrics</h2>
        <div class="metrics">
            ${Object.entries(report.modelInfo.metrics.test || {}).map(([key, value]) => 
                `<div class="metric"><strong>${key}:</strong> ${typeof value === 'number' ? value.toFixed(4) : JSON.stringify(value)}</div>`
            ).join('')}
        </div>
    </div>

    ${report.trainingHistory ? `
    <div class="section">
        <h2>Training History</h2>
        <p><strong>Epochs:</strong> ${report.trainingHistory.epochs}</p>
        <p><strong>Final Loss:</strong> ${report.trainingHistory.finalLoss?.toFixed(4) || 'N/A'}</p>
        <p><strong>Final Validation Loss:</strong> ${report.trainingHistory.finalValLoss?.toFixed(4) || 'N/A'}</p>
    </div>
    ` : ''}

    <div class="section">
        <h2>Validation</h2>
        ${report.modelInfo.validation.isValid ? 
            '<p class="success">✓ Model is valid</p>' : 
            `<p class="error">✗ Model validation failed</p>
             <ul>${report.modelInfo.validation.errors.map(e => `<li class="error">${e}</li>`).join('')}</ul>`
        }
        ${report.modelInfo.validation.warnings.length > 0 ? 
            `<ul>${report.modelInfo.validation.warnings.map(w => `<li class="warning">⚠ ${w}</li>`).join('')}</ul>` : 
            ''
        }
    </div>
</body>
</html>`;
  }
}

module.exports = ModelTrainer;
