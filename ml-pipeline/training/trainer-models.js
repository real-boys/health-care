const tf = require('@tensorflow/tfjs-node');
const { RandomForestRegression, RandomForestClassification } = require('ml-random-forest');
const { LinearRegression, LogisticRegression } = require('ml-regression');
const ML_CONFIG = require('../config');

class ModelTrainingMethods {
  static async trainRandomForest(features, targets, config) {
    const isClassification = this.isClassificationTask(targets);
    
    const model = isClassification ? 
      new RandomForestClassification({
        nEstimators: config.hyperparameters.n_estimators,
        maxDepth: config.hyperparameters.max_depth,
        minSamplesSplit: config.hyperparameters.min_samples_split,
        minSamplesLeaf: config.hyperparameters.min_samples_leaf,
        seed: ML_CONFIG.training.randomSeed
      }) :
      new RandomForestRegression({
        nEstimators: config.hyperparameters.n_estimators,
        maxDepth: config.hyperparameters.max_depth,
        minSamplesSplit: config.hyperparameters.min_samples_split,
        minSamplesLeaf: config.hyperparameters.min_samples_leaf,
        seed: ML_CONFIG.training.randomSeed
      });

    model.train(features, targets);
    return model;
  }

  static async trainLogisticRegression(features, targets, config) {
    const model = new LogisticRegression({
      learningRate: config.hyperparameters.learning_rate,
      iterations: config.hyperparameters.iterations,
      regularization: config.hyperparameters.regularization
    });

    model.train(features, targets);
    return model;
  }

  static async trainLinearRegression(features, targets, config) {
    const model = new LinearRegression({
      learningRate: config.hyperparameters.learning_rate,
      iterations: config.hyperparameters.iterations,
      regularization: config.hyperparameters.regularization
    });

    model.train(features, targets);
    return model;
  }

  static async trainNeuralNetwork(features, targets, config) {
    const inputSize = features[0].length;
    const isClassification = this.isClassificationTask(targets);
    
    const X = tf.tensor2d(features);
    const y = isClassification ? 
      tf.oneHot(tf.tensor1d(targets, 'int32'), 2) : 
      tf.tensor2d(targets, [targets.length, 1]);

    const model = tf.sequential();
    model.add(tf.layers.dense({
      inputShape: [inputSize],
      units: 64,
      activation: 'relu'
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({
      units: 32,
      activation: 'relu'
    }));
    model.add(tf.layers.dropout({ rate: 0.2 }));
    model.add(tf.layers.dense({
      units: isClassification ? 2 : 1,
      activation: isClassification ? 'softmax' : 'linear'
    }));

    model.compile({
      optimizer: tf.train.adam(config.hyperparameters.learning_rate || 0.001),
      loss: isClassification ? 'categoricalCrossentropy' : 'meanSquaredError',
      metrics: isClassification ? ['accuracy'] : ['mae']
    });

    const history = await model.fit(X, y, {
      epochs: config.hyperparameters.epochs || 100,
      batchSize: ML_CONFIG.training.batchSize,
      validationSplit: ML_CONFIG.training.validationSplit,
      callbacks: [
        tf.callbacks.earlyStopping({
          patience: ML_CONFIG.training.earlyStoppingPatience,
          monitor: 'val_loss'
        })
      ]
    });

    X.dispose();
    y.dispose();

    return { model, history };
  }

  static async trainGradientBoosting(features, targets, config) {
    const model = new RandomForestRegression({
      nEstimators: config.hyperparameters.n_estimators,
      maxDepth: config.hyperparameters.max_depth,
      learningRate: config.hyperparameters.learning_rate,
      seed: ML_CONFIG.training.randomSeed
    });

    model.train(features, targets);
    return model;
  }

  static isClassificationTask(targets) {
    const uniqueTargets = [...new Set(targets)];
    return uniqueTargets.length <= 10 && uniqueTargets.every(t => Number.isInteger(t));
  }

  static predict(model, features) {
    if (model.predict) {
      const predictions = model.predict(tf.tensor2d(features));
      const result = Array.from(predictions.dataSync());
      predictions.dispose();
      return result;
    } else if (model.predict instanceof Function) {
      return model.predict(features);
    } else {
      throw new Error('Model does not have a predict method');
    }
  }
}

module.exports = ModelTrainingMethods;
