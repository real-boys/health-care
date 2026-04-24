const tf = require('@tensorflow/tfjs-node');
const { RandomForestRegression, RandomForestClassification } = require('ml-random-forest');
const { LinearRegression, LogisticRegression } = require('ml-regression');
const fs = require('fs').promises;
const path = require('path');
const FeatureEngineer = require('../features/featureEngineer');
const ML_CONFIG = require('../config');

class ModelTrainer {
  constructor() {
    this.featureEngineer = new FeatureEngineer();
    this.models = new Map();
    this.trainingHistory = new Map();
    this.metrics = new Map();
  }

  async trainModel(modelName, config = {}) {
    console.log(`Starting training for model: ${modelName}`);
    
    try {
      const modelConfig = ML_CONFIG.models[modelName];
      if (!modelConfig) {
        throw new Error(`Model configuration not found for: ${modelName}`);
      }

      const { features, targets } = await this.prepareTrainingData(modelName, modelConfig);
      
      const { trainFeatures, trainTargets, valFeatures, valTargets, testFeatures, testTargets } = 
        this.splitData(features, targets);

      let model;
      switch (modelConfig.type) {
        case 'random_forest':
          model = await this.trainRandomForest(trainFeatures, trainTargets, modelConfig);
          break;
        case 'logistic_regression':
          model = await this.trainLogisticRegression(trainFeatures, trainTargets, modelConfig);
          break;
        case 'linear_regression':
          model = await this.trainLinearRegression(trainFeatures, trainTargets, modelConfig);
          break;
        case 'neural_network':
          model = await this.trainNeuralNetwork(trainFeatures, trainTargets, modelConfig);
          break;
        case 'gradient_boosting':
          model = await this.trainGradientBoosting(trainFeatures, trainTargets, modelConfig);
          break;
        default:
          throw new Error(`Unsupported model type: ${modelConfig.type}`);
      }

      const metrics = await this.evaluateModel(model, valFeatures, valTargets, testFeatures, testTargets, modelConfig);
      
      await this.saveModel(modelName, model, metrics, modelConfig);
      
      this.models.set(modelName, model);
      this.metrics.set(modelName, metrics);
      
      console.log(`Model ${modelName} trained successfully. Metrics:`, metrics);
      return { model, metrics };

    } catch (error) {
      console.error(`Error training model ${modelName}:`, error);
      throw error;
    }
  }

  async prepareTrainingData(modelName, modelConfig) {
    let features = [];
    let targets = [];

    switch (modelName) {
      case 'claimFraudDetection':
        const claimFeatures = await this.featureEngineer.extractFeatures('claims');
        features = claimFeatures.map(f => this.extractFeatureVector(f, modelConfig.features));
        targets = claimFeatures.map(f => f.isFraud);
        break;

      case 'claimApprovalPrediction':
        const approvalFeatures = await this.featureEngineer.extractFeatures('claims');
        features = approvalFeatures.map(f => this.extractFeatureVector(f, modelConfig.features));
        targets = approvalFeatures.map(f => f.willApprove);
        break;

      case 'premiumOptimization':
        const premiumFeatures = await this.featureEngineer.extractFeatures('premiums');
        features = premiumFeatures.map(f => this.extractFeatureVector(f, modelConfig.features));
        targets = premiumFeatures.map(f => f.optimalPremium);
        break;

      case 'customerChurnPrediction':
        const customerFeatures = await this.featureEngineer.extractFeatures('customers');
        features = customerFeatures.map(f => this.extractFeatureVector(f, modelConfig.features));
        targets = customerFeatures.map(f => f.willChurn);
        break;

      default:
        throw new Error(`Unknown model: ${modelName}`);
    }

    const cleanedData = this.cleanData(features, targets);
    
    return {
      features: cleanedData.features,
      targets: cleanedData.targets
    };
  }

  extractFeatureVector(feature, featureNames) {
    return featureNames.map(name => feature[name] || 0);
  }

  cleanData(features, targets) {
    const cleanedFeatures = [];
    const cleanedTargets = [];

    features.forEach((feature, index) => {
      const hasInvalid = feature.some(val => 
        val === null || val === undefined || !isFinite(val)
      );
      
      if (!hasInvalid && isFinite(targets[index])) {
        cleanedFeatures.push(feature);
        cleanedTargets.push(targets[index]);
      }
    });

    return { features: cleanedFeatures, targets: cleanedTargets };
  }

  splitData(features, targets) {
    const totalSize = features.length;
    const trainSize = Math.floor(totalSize * (1 - ML_CONFIG.training.validationSplit - ML_CONFIG.training.testSplit));
    const valSize = Math.floor(totalSize * ML_CONFIG.training.validationSplit);

    const indices = Array.from({ length: totalSize }, (_, i) => i);
    this.shuffle(indices, ML_CONFIG.training.randomSeed);

    const trainIndices = indices.slice(0, trainSize);
    const valIndices = indices.slice(trainSize, trainSize + valSize);
    const testIndices = indices.slice(trainSize + valSize);

    return {
      trainFeatures: trainIndices.map(i => features[i]),
      trainTargets: trainIndices.map(i => targets[i]),
      valFeatures: valIndices.map(i => features[i]),
      valTargets: valIndices.map(i => targets[i]),
      testFeatures: testIndices.map(i => features[i]),
      testTargets: testIndices.map(i => targets[i])
    };
  }

  isClassificationTask(targets) {
    const uniqueTargets = [...new Set(targets)];
    return uniqueTargets.length <= 10 && uniqueTargets.every(t => Number.isInteger(t));
  }

  shuffle(array, seed) {
    let currentIndex = array.length;
    let temporaryValue, randomIndex;

    let random = seed ? this.seededRandom(seed) : Math.random;

    while (0 !== currentIndex) {
      randomIndex = Math.floor(random() * currentIndex);
      currentIndex -= 1;
      temporaryValue = array[currentIndex];
      array[currentIndex] = array[randomIndex];
      array[randomIndex] = temporaryValue;
    }

    return array;
  }

  seededRandom(seed) {
    let m = 0x80000000;
    let a = 1103515245;
    let c = 12345;
    let state = seed ? seed : Math.floor(Math.random() * (m - 1));
    return function() {
      state = (a * state + c) % m;
      return state / (m - 1);
    };
  }

  generateVersion() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 9);
    return `v1-${timestamp}-${random}`;
  }
}

module.exports = ModelTrainer;
