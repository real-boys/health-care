const winston = require('winston');
const ML_CONFIG = require('../config');

class ModelExplainer {
  constructor() {
    this.explanations = new Map();
    this.featureImportance = new Map();
    
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
          filename: 'logs/model-explainability.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  async explainPrediction(modelName, model, features, featureNames, methods = ['shap']) {
    const explanation = {
      modelName,
      timestamp: new Date().toISOString(),
      features: features,
      featureNames: featureNames,
      methods: {}
    };

    for (const method of methods) {
      try {
        switch (method) {
          case 'shap':
            explanation.methods.shap = await this.calculateSHAP(model, features, featureNames);
            break;
          case 'lime':
            explanation.methods.lime = await this.calculateLIME(model, features, featureNames);
            break;
          case 'permutation_importance':
            explanation.methods.permutation_importance = await this.calculatePermutationImportance(model, features, featureNames);
            break;
          case 'feature_importance':
            explanation.methods.feature_importance = await this.calculateFeatureImportance(model, featureNames);
            break;
          default:
            this.logger.warn(`Unknown explanation method: ${method}`);
        }
      } catch (error) {
        this.logger.error(`Error calculating ${method} explanation:`, error);
        explanation.methods[method] = { error: error.message };
      }
    }

    // Store explanation
    const explanationId = `${modelName}_${Date.now()}`;
    this.explanations.set(explanationId, explanation);

    this.logger.info(`Generated explanation for ${modelName}`, { 
      explanationId, 
      methods: Object.keys(explanation.methods) 
    });

    return { explanationId, explanation };
  }

  async calculateSHAP(model, features, featureNames) {
    // Simplified SHAP implementation (Kernel SHAP)
    const backgroundData = this.generateBackgroundData(features);
    const shapValues = [];

    for (let i = 0; i < features.length; i++) {
      const instance = features[i];
      const instanceSHAP = await this.kernelSHAP(model, instance, backgroundData, featureNames);
      shapValues.push(instanceSHAP);
    }

    return {
      values: shapValues,
      method: 'kernel_shap',
      backgroundSize: backgroundData.length,
      explanation: 'SHAP values show the contribution of each feature to the prediction'
    };
  }

  async kernelSHAP(model, instance, backgroundData, featureNames) {
    const numFeatures = instance.length;
    const shapValues = new Array(numFeatures).fill(0);
    const numSamples = ML_CONFIG.explainability.sampleSize || 100;

    for (let sample = 0; sample < numSamples; sample++) {
      // Generate coalition (subset of features)
      const coalition = this.generateCoalition(numFeatures);
      const complementaryCoalition = this.generateComplementaryCoalition(coalition, numFeatures);

      // Create perturbed instances
      const xWithFeatures = this.createPerturbedInstance(instance, backgroundData[0], coalition);
      const xWithoutFeatures = this.createPerturbedInstance(instance, backgroundData[0], complementaryCoalition);

      // Get model predictions
      const predWith = this.getPrediction(model, xWithFeatures);
      const predWithout = this.getPrediction(model, xWithoutFeatures);

      // Calculate SHAP weight
      const weight = this.calculateSHAPWeight(coalition, numFeatures);

      // Update SHAP values
      for (const featureIndex of coalition) {
        shapValues[featureIndex] += weight * (predWith - predWithout);
      }
    }

    // Normalize SHAP values
    const sumAbsolute = shapValues.reduce((sum, val) => sum + Math.abs(val), 0);
    if (sumAbsolute > 0) {
      for (let i = 0; i < numFeatures; i++) {
        shapValues[i] /= sumAbsolute;
      }
    }

    // Create feature-wise explanation
    const featureExplanation = {};
    for (let i = 0; i < numFeatures; i++) {
      featureExplanation[featureNames[i]] = {
        value: shapValues[i],
        featureValue: instance[i],
        contribution: shapValues[i] > 0 ? 'positive' : 'negative'
      };
    }

    return featureExplanation;
  }

  generateBackgroundData(features, numSamples = 50) {
    // Use mean of features as background
    const numFeatures = features[0].length;
    const background = [];

    for (let i = 0; i < numSamples; i++) {
      const instance = [];
      for (let j = 0; j < numFeatures; j++) {
        const values = features.map(f => f[j]);
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const std = Math.sqrt(values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length);
        instance.push(mean + (Math.random() - 0.5) * 2 * std);
      }
      background.push(instance);
    }

    return background;
  }

  generateCoalition(numFeatures) {
    const coalition = [];
    const coalitionSize = Math.floor(Math.random() * numFeatures) + 1;
    
    while (coalition.length < coalitionSize) {
      const featureIndex = Math.floor(Math.random() * numFeatures);
      if (!coalition.includes(featureIndex)) {
        coalition.push(featureIndex);
      }
    }
    
    return coalition;
  }

  generateComplementaryCoalition(coalition, numFeatures) {
    const complementary = [];
    for (let i = 0; i < numFeatures; i++) {
      if (!coalition.includes(i)) {
        complementary.push(i);
      }
    }
    return complementary;
  }

  createPerturbedInstance(instance, background, coalition) {
    const perturbed = [...background];
    for (const featureIndex of coalition) {
      perturbed[featureIndex] = instance[featureIndex];
    }
    return perturbed;
  }

  calculateSHAPWeight(coalition, numFeatures) {
    const coalitionSize = coalition.length;
    const totalCoalitions = Math.pow(2, numFeatures);
    return 1 / (coalitionSize * (numFeatures - coalitionSize + 1) * totalCoalitions);
  }

  async calculateLIME(model, features, featureNames) {
    // Simplified LIME implementation
    const explanations = [];

    for (let i = 0; i < features.length; i++) {
      const instance = features[i];
      const limeExplanation = await this.localLinearApproximation(model, instance, featureNames);
      explanations.push(limeExplanation);
    }

    return {
      explanations,
      method: 'lime',
      explanation: 'LIME creates local linear approximations to explain individual predictions'
    };
  }

  async localLinearApproximation(model, instance, featureNames) {
    const numSamples = ML_CONFIG.explainability.sampleSize || 100;
    const perturbedData = [];
    const predictions = [];

    // Generate perturbed samples around the instance
    for (let i = 0; i < numSamples; i++) {
      const perturbed = this.perturbInstance(instance);
      perturbedData.push(perturbed);
      predictions.push(this.getPrediction(model, perturbed));
    }

    // Calculate similarity weights
    const weights = perturbedData.map(perturbed => 
      this.calculateSimilarity(instance, perturbed)
    );

    // Fit linear model locally
    const coefficients = this.fitLinearModel(perturbedData, predictions, weights);

    // Create feature explanation
    const featureExplanation = {};
    for (let i = 0; i < instance.length; i++) {
      featureExplanation[featureNames[i]] = {
        coefficient: coefficients[i],
        featureValue: instance[i],
        contribution: coefficients[i] * instance[i],
        importance: Math.abs(coefficients[i])
      };
    }

    return {
      intercept: coefficients[instance.length],
      coefficients: featureExplanation,
      r_squared: this.calculateRSquared(perturbedData, predictions, coefficients)
    };
  }

  perturbInstance(instance) {
    const perturbed = [...instance];
    const numFeaturesToChange = Math.floor(Math.random() * instance.length) + 1;
    
    for (let i = 0; i < numFeaturesToChange; i++) {
      const featureIndex = Math.floor(Math.random() * instance.length);
      const noise = (Math.random() - 0.5) * 0.2; // 10% noise
      perturbed[featureIndex] = instance[featureIndex] * (1 + noise);
    }
    
    return perturbed;
  }

  calculateSimilarity(instance1, instance2) {
    // Exponential kernel based on Euclidean distance
    const distance = Math.sqrt(
      instance1.reduce((sum, val, i) => sum + Math.pow(val - instance2[i], 2), 0)
    );
    return Math.exp(-distance * distance / (2 * 0.25 * 0.25)); // kernel width = 0.25
  }

  fitLinearModel(X, y, weights) {
    const numFeatures = X[0].length;
    const numSamples = X.length;

    // Weighted least squares (simplified)
    const weightedX = X.map((row, i) => row.map(val => val * Math.sqrt(weights[i])));
    const weightedY = y.map((val, i) => val * Math.sqrt(weights[i]));

    // Normal equation: (X^T * X)^(-1) * X^T * y
    const coefficients = new Array(numFeatures + 1).fill(0); // +1 for intercept

    // Simplified linear regression (in practice, use proper numerical methods)
    for (let j = 0; j < numFeatures; j++) {
      let numerator = 0;
      let denominator = 0;
      
      for (let i = 0; i < numSamples; i++) {
        numerator += weightedX[i][j] * weightedY[i];
        denominator += weightedX[i][j] * weightedX[i][j];
      }
      
      coefficients[j] = denominator !== 0 ? numerator / denominator : 0;
    }

    // Calculate intercept
    let intercept = 0;
    for (let i = 0; i < numSamples; i++) {
      let prediction = 0;
      for (let j = 0; j < numFeatures; j++) {
        prediction += coefficients[j] * X[i][j];
      }
      intercept += weightedY[i] - prediction;
    }
    coefficients[numFeatures] = intercept / numSamples;

    return coefficients;
  }

  calculateRSquared(X, y, coefficients) {
    const numSamples = X.length;
    const predictions = X.map(row => {
      let prediction = coefficients[row.length]; // intercept
      for (let i = 0; i < row.length; i++) {
        prediction += coefficients[i] * row[i];
      }
      return prediction;
    });

    const yMean = y.reduce((sum, val) => sum + val, 0) / numSamples;
    const ssTotal = y.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0);
    const ssResidual = y.reduce((sum, val, i) => sum + Math.pow(val - predictions[i], 2), 0);

    return 1 - (ssResidual / ssTotal);
  }

  async calculatePermutationImportance(model, features, featureNames) {
    const baselinePrediction = this.getPrediction(model, features[0]);
    const importance = {};

    for (let i = 0; i < features[0].length; i++) {
      const perturbedFeatures = features.map(feature => {
        const perturbed = [...feature];
        // Shuffle feature i across all samples
        const values = features.map(f => f[i]);
        this.shuffle(values);
        perturbed[i] = values[Math.floor(Math.random() * values.length)];
        return perturbed;
      });

      const perturbedPrediction = this.getPrediction(model, perturbedFeatures[0]);
      const importanceScore = Math.abs(baselinePrediction - perturbedPrediction);

      importance[featureNames[i]] = importanceScore;
    }

    // Normalize importance scores
    const totalImportance = Object.values(importance).reduce((sum, val) => sum + val, 0);
    for (const feature in importance) {
      importance[feature] /= totalImportance;
    }

    return {
      importance,
      method: 'permutation_importance',
      explanation: 'Permutation importance measures the decrease in model performance when a feature is randomly shuffled'
    };
  }

  async calculateFeatureImportance(model, featureNames) {
    const importance = {};

    // Check if model has built-in feature importance
    if (model.featureImportances) {
      for (let i = 0; i < featureNames.length; i++) {
        importance[featureNames[i]] = model.featureImportances[i] || 0;
      }
    } else if (model.coefficients) {
      // Linear models
      for (let i = 0; i < featureNames.length; i++) {
        importance[featureNames[i]] = Math.abs(model.coefficients[i] || 0);
      }
    } else {
      // Default: equal importance
      for (const feature of featureNames) {
        importance[feature] = 1 / featureNames.length;
      }
    }

    // Normalize
    const totalImportance = Object.values(importance).reduce((sum, val) => sum + val, 0);
    for (const feature in importance) {
      importance[feature] /= totalImportance;
    }

    return {
      importance,
      method: 'feature_importance',
      explanation: 'Built-in feature importance from the model'
    };
  }

  getPrediction(model, features) {
    if (model.predict) {
      const prediction = model.predict([features]);
      return Array.isArray(prediction) ? prediction[0] : prediction;
    } else if (model.predict instanceof Function) {
      return model.predict([features])[0];
    } else {
      throw new Error('Model does not have a predict method');
    }
  }

  shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  generateExplanationReport(explanationId, format = 'json') {
    const explanation = this.explanations.get(explanationId);
    if (!explanation) {
      throw new Error(`Explanation ${explanationId} not found`);
    }

    if (format === 'json') {
      return JSON.stringify(explanation, null, 2);
    } else if (format === 'html') {
      return this.generateHTMLReport(explanation);
    } else {
      throw new Error(`Unsupported format: ${format}`);
    }
  }

  generateHTMLReport(explanation) {
    const methods = Object.keys(explanation.methods);
    
    let html = `
<!DOCTYPE html>
<html>
<head>
    <title>Model Explanation Report - ${explanation.modelName}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f4f4f4; padding: 20px; border-radius: 5px; margin-bottom: 20px; }
        .method { margin: 20px 0; padding: 15px; border: 1px solid #ddd; border-radius: 5px; }
        .feature-importance { display: flex; align-items: center; margin: 5px 0; }
        .importance-bar { height: 20px; background: #007bff; margin-left: 10px; border-radius: 3px; }
        .positive { background: #28a745; }
        .negative { background: #dc3545; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Model Explanation Report</h1>
        <p><strong>Model:</strong> ${explanation.modelName}</p>
        <p><strong>Generated:</strong> ${new Date(explanation.timestamp).toLocaleString()}</p>
        <p><strong>Methods:</strong> ${methods.join(', ')}</p>
    </div>
`;

    for (const method of methods) {
      const methodData = explanation.methods[method];
      
      html += `<div class="method">
        <h2>${method.charAt(0).toUpperCase() + method.slice(1).replace('_', ' ')} Explanation</h2>
        <p>${methodData.explanation || 'No description available'}</p>
`;

      if (method === 'shap' && methodData.values) {
        html += '<h3>SHAP Values</h3>';
        methodData.values.forEach((instance, idx) => {
          html += `<h4>Instance ${idx + 1}</h4>`;
          html += '<table><tr><th>Feature</th><th>Value</th><th>SHAP Value</th><th>Contribution</th></tr>';
          
          Object.entries(instance).forEach(([feature, data]) => {
            const contributionClass = data.contribution === 'positive' ? 'positive' : 'negative';
            html += `<tr>
              <td>${feature}</td>
              <td>${data.featureValue.toFixed(4)}</td>
              <td>${data.value.toFixed(4)}</td>
              <td class="${contributionClass}">${data.contribution}</td>
            </tr>`;
          });
          
          html += '</table>';
        });
      }

      if (method === 'lime' && methodData.explanations) {
        html += '<h3>LIME Explanations</h3>';
        methodData.explanations.forEach((instance, idx) => {
          html += `<h4>Instance ${idx + 1}</h4>`;
          html += `<p>R-squared: ${instance.r_squared.toFixed(4)}</p>`;
          html += '<table><tr><th>Feature</th><th>Coefficient</th><th>Contribution</th><th>Importance</th></tr>';
          
          Object.entries(instance.coefficients).forEach(([feature, data]) => {
            html += `<tr>
              <td>${feature}</td>
              <td>${data.coefficient.toFixed(4)}</td>
              <td>${data.contribution.toFixed(4)}</td>
              <td>${data.importance.toFixed(4)}</td>
            </tr>`;
          });
          
          html += '</table>';
        });
      }

      if ((method === 'permutation_importance' || method === 'feature_importance') && methodData.importance) {
        html += '<h3>Feature Importance</h3>';
        html += '<table><tr><th>Feature</th><th>Importance</th><th>Visual</th></tr>';
        
        Object.entries(methodData.importance)
          .sort((a, b) => b[1] - a[1])
          .forEach(([feature, importance]) => {
            const barWidth = importance * 200; // Max width 200px
            html += `<tr>
              <td>${feature}</td>
              <td>${importance.toFixed(4)}</td>
              <td><div class="importance-bar" style="width: ${barWidth}px;"></div></td>
            </tr>`;
          });
        
        html += '</table>';
      }

      html += '</div>';
    }

    html += `</body></html>`;
    return html;
  }

  getExplanation(explanationId) {
    return this.explanations.get(explanationId);
  }

  getAllExplanations() {
    return Array.from(this.explanations.values());
  }

  clearExplanations(modelName = null) {
    if (modelName) {
      for (const [id, explanation] of this.explanations.entries()) {
        if (explanation.modelName === modelName) {
          this.explanations.delete(id);
        }
      }
    } else {
      this.explanations.clear();
    }
  }
}

module.exports = ModelExplainer;
