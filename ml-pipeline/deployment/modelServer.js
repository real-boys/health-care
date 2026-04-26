const express = require('express');
const ModelTrainer = require('../training/trainer');
const FeatureEngineer = require('../features/featureEngineer');
const ML_CONFIG = require('../config');
const winston = require('winston');

class ModelServer {
  constructor() {
    this.app = express();
    this.trainer = new ModelTrainer();
    this.featureEngineer = new FeatureEngineer();
    this.predictionCache = new Map();
    this.modelLoadStatus = new Map();
    
    this.setupMiddleware();
    this.setupRoutes();
    this.setupLogging();
  }

  setupMiddleware() {
    this.app.use(express.json({ limit: '50mb' }));
    this.app.use(express.urlencoded({ extended: true }));
    
    // CORS
    this.app.use((req, res, next) => {
      res.header('Access-Control-Allow-Origin', '*');
      res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
      next();
    });

    // Request logging
    this.app.use((req, res, next) => {
      this.logger.info(`${req.method} ${req.path}`, {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date().toISOString()
      });
      next();
    });
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
          filename: 'logs/model-server.log',
          maxsize: 10485760, // 10MB
          maxFiles: 5
        })
      ]
    });
  }

  setupRoutes() {
    // Health check
    this.app.get('/health', (req, res) => {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        models: Array.from(this.modelLoadStatus.keys()),
        cacheSize: this.predictionCache.size
      });
    });

    // Model management endpoints
    this.app.get('/api/models', this.listModels.bind(this));
    this.app.get('/api/models/:modelName', this.getModelInfo.bind(this));
    this.app.post('/api/models/:modelName/load', this.loadModel.bind(this));
    this.app.post('/api/models/:modelName/unload', this.unloadModel.bind(this));
    this.app.delete('/api/models/:modelName', this.deleteModel.bind(this));

    // Prediction endpoints
    this.app.post('/api/predict/:modelName', this.predict.bind(this));
    this.app.post('/api/batch-predict/:modelName', this.batchPredict.bind(this));
    
    // Training endpoints
    this.app.post('/api/train/:modelName', this.trainModel.bind(this));
    this.app.post('/api/retrain-all', this.retrainAllModels.bind(this));

    // Model comparison
    this.app.post('/api/compare-models', this.compareModels.bind(this));

    // Feature engineering
    this.app.post('/api/features/extract', this.extractFeatures.bind(this));
    this.app.post('/api/features/transform', this.transformFeatures.bind(this));

    // Model validation
    this.app.get('/api/models/:modelName/validate', this.validateModel.bind(this));

    // Model export
    this.app.get('/api/models/:modelName/export', this.exportModel.bind(this));

    // Cache management
    this.app.delete('/api/cache', this.clearCache.bind(this));
    this.app.get('/api/cache/stats', this.getCacheStats.bind(this));

    // Error handling
    this.app.use(this.errorHandler.bind(this));
  }

  async listModels(req, res) {
    try {
      const models = await this.trainer.listModels();
      const loadedModels = Array.from(this.modelLoadStatus.keys());
      
      const modelList = models.map(model => ({
        ...model,
        loaded: loadedModels.includes(model.name),
        loadStatus: this.modelLoadStatus.get(model.name)
      }));

      res.json({
        success: true,
        models: modelList,
        total: modelList.length,
        loaded: loadedModels.length
      });
    } catch (error) {
      this.logger.error('Error listing models:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async getModelInfo(req, res) {
    try {
      const { modelName } = req.params;
      const modelInfo = await this.trainer.getModelInfo(modelName);
      const isLoaded = this.modelLoadStatus.has(modelName);

      res.json({
        success: true,
        model: {
          ...modelInfo,
          loaded: isLoaded,
          loadStatus: this.modelLoadStatus.get(modelName)
        }
      });
    } catch (error) {
      this.logger.error(`Error getting model info for ${req.params.modelName}:`, error);
      res.status(404).json({
        success: false,
        error: error.message
      });
    }
  }

  async loadModel(req, res) {
    try {
      const { modelName } = req.params;
      const { force = false } = req.body;

      if (!force && this.modelLoadStatus.has(modelName)) {
        return res.json({
          success: true,
          message: 'Model already loaded',
          loadStatus: this.modelLoadStatus.get(modelName)
        });
      }

      this.logger.info(`Loading model: ${modelName}`);
      this.modelLoadStatus.set(modelName, 'loading');

      const startTime = Date.now();
      const { model, metadata } = await this.trainer.loadModel(modelName);
      const loadTime = Date.now() - startTime;

      this.modelLoadStatus.set(modelName, 'loaded');
      this.logger.info(`Model ${modelName} loaded successfully in ${loadTime}ms`);

      res.json({
        success: true,
        message: 'Model loaded successfully',
        modelName,
        loadTime,
        metadata
      });
    } catch (error) {
      this.modelLoadStatus.set(req.params.modelName, 'error');
      this.logger.error(`Error loading model ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async unloadModel(req, res) {
    try {
      const { modelName } = req.params;
      
      if (!this.modelLoadStatus.has(modelName)) {
        return res.json({
          success: true,
          message: 'Model was not loaded'
        });
      }

      this.modelLoadStatus.delete(modelName);
      this.trainer.models.delete(modelName);
      
      // Clear cache for this model
      for (const [key, value] of this.predictionCache.entries()) {
        if (key.startsWith(`${modelName}:`)) {
          this.predictionCache.delete(key);
        }
      }

      this.logger.info(`Model ${modelName} unloaded`);

      res.json({
        success: true,
        message: 'Model unloaded successfully'
      });
    } catch (error) {
      this.logger.error(`Error unloading model ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async deleteModel(req, res) {
    try {
      const { modelName } = req.params;
      
      await this.trainer.deleteModel(modelName);
      this.modelLoadStatus.delete(modelName);
      this.trainer.models.delete(modelName);

      this.logger.info(`Model ${modelName} deleted`);

      res.json({
        success: true,
        message: 'Model deleted successfully'
      });
    } catch (error) {
      this.logger.error(`Error deleting model ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async predict(req, res) {
    try {
      const { modelName } = req.params;
      const { data, useCache = true } = req.body;

      if (!this.modelLoadStatus.has(modelName)) {
        return res.status(400).json({
          success: false,
          error: 'Model not loaded. Please load the model first.'
        });
      }

      // Check cache
      const cacheKey = `${modelName}:${JSON.stringify(data)}`;
      if (useCache && this.predictionCache.has(cacheKey)) {
        const cached = this.predictionCache.get(cacheKey);
        return res.json({
          success: true,
          prediction: cached.prediction,
          cached: true,
          timestamp: cached.timestamp
        });
      }

      const startTime = Date.now();
      const model = this.trainer.models.get(modelName);
      
      // Extract features if needed
      let features;
      if (typeof data === 'object' && !Array.isArray(data)) {
        const modelConfig = ML_CONFIG.models[modelName];
        features = [this.featureEngineer.extractFeatureVector(data, modelConfig.features)];
      } else {
        features = data;
      }

      const prediction = this.trainer.predict(model, features);
      const inferenceTime = Date.now() - startTime;

      // Cache result
      if (useCache && ML_CONFIG.deployment.cacheEnabled) {
        this.predictionCache.set(cacheKey, {
          prediction: Array.isArray(prediction) ? prediction[0] : prediction,
          timestamp: new Date().toISOString()
        });

        // Limit cache size
        if (this.predictionCache.size > ML_CONFIG.deployment.cacheSize) {
          const firstKey = this.predictionCache.keys().next().value;
          this.predictionCache.delete(firstKey);
        }
      }

      this.logger.info(`Prediction for ${modelName}`, {
        inferenceTime,
        cacheHit: false,
        featuresCount: features.length
      });

      res.json({
        success: true,
        prediction: Array.isArray(prediction) ? prediction[0] : prediction,
        inferenceTime,
        cached: false,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error(`Error making prediction for ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async batchPredict(req, res) {
    try {
      const { modelName } = req.params;
      const { data, useCache = true } = req.body;

      if (!this.modelLoadStatus.has(modelName)) {
        return res.status(400).json({
          success: false,
          error: 'Model not loaded. Please load the model first.'
        });
      }

      const model = this.trainer.models.get(modelName);
      const predictions = [];
      const cacheHits = [];
      const inferenceTimes = [];

      for (let i = 0; i < data.length; i++) {
        const item = data[i];
        const cacheKey = `${modelName}:${JSON.stringify(item)}`;

        if (useCache && this.predictionCache.has(cacheKey)) {
          const cached = this.predictionCache.get(cacheKey);
          predictions.push(cached.prediction);
          cacheHits.push(true);
          inferenceTimes.push(0);
        } else {
          const startTime = Date.now();
          
          let features;
          if (typeof item === 'object' && !Array.isArray(item)) {
            const modelConfig = ML_CONFIG.models[modelName];
            features = this.featureEngineer.extractFeatureVector(item, modelConfig.features);
          } else {
            features = item;
          }

          const prediction = this.trainer.predict(model, [features]);
          const inferenceTime = Date.now() - startTime;
          
          predictions.push(Array.isArray(prediction) ? prediction[0] : prediction);
          cacheHits.push(false);
          inferenceTimes.push(inferenceTime);

          // Cache result
          if (useCache && ML_CONFIG.deployment.cacheEnabled) {
            this.predictionCache.set(cacheKey, {
              prediction: Array.isArray(prediction) ? prediction[0] : prediction,
              timestamp: new Date().toISOString()
            });
          }
        }
      }

      this.logger.info(`Batch prediction for ${modelName}`, {
        batchSize: data.length,
        cacheHits: cacheHits.filter(hit => hit).length,
        avgInferenceTime: inferenceTimes.reduce((a, b) => a + b, 0) / inferenceTimes.length
      });

      res.json({
        success: true,
        predictions,
        cacheHits,
        inferenceTimes,
        batchSize: data.length,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error(`Error making batch prediction for ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async trainModel(req, res) {
    try {
      const { modelName } = req.params;
      const { config } = req.body;

      this.logger.info(`Starting training for model: ${modelName}`);
      
      const startTime = Date.now();
      const result = await this.trainer.trainModel(modelName, config);
      const trainingTime = Date.now() - startTime;

      this.logger.info(`Model ${modelName} trained successfully in ${trainingTime}ms`);

      res.json({
        success: true,
        message: 'Model trained successfully',
        modelName,
        trainingTime,
        metrics: result.metrics
      });

    } catch (error) {
      this.logger.error(`Error training model ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async retrainAllModels(req, res) {
    try {
      this.logger.info('Starting retraining for all models');
      
      const startTime = Date.now();
      const results = await this.trainer.retrainAllModels();
      const totalTime = Date.now() - startTime;

      const successful = Object.values(results).filter(r => r.success).length;
      const failed = Object.values(results).filter(r => !r.success).length;

      this.logger.info(`Retraining completed: ${successful} successful, ${failed} failed`);

      res.json({
        success: true,
        message: 'Retraining completed',
        totalTime,
        results,
        summary: {
          total: Object.keys(results).length,
          successful,
          failed
        }
      });

    } catch (error) {
      this.logger.error('Error retraining all models:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async compareModels(req, res) {
    try {
      const { modelNames, testData } = req.body;

      if (!modelNames || !Array.isArray(modelNames)) {
        return res.status(400).json({
          success: false,
          error: 'modelNames array is required'
        });
      }

      const comparison = await this.trainer.compareModels(modelNames, testData);

      res.json({
        success: true,
        comparison,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      this.logger.error('Error comparing models:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async extractFeatures(req, res) {
    try {
      const { dataType, filters } = req.body;

      const features = await this.featureEngineer.extractFeatures(dataType, filters);

      res.json({
        success: true,
        features,
        count: features.length,
        dataType
      });

    } catch (error) {
      this.logger.error('Error extracting features:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async transformFeatures(req, res) {
    try {
      const { features, operations } = req.body;

      let transformed = features;

      for (const operation of operations) {
        switch (operation.type) {
          case 'normalize':
            transformed = this.featureEngineer.normalizeFeatures(transformed, operation.columns);
            break;
          case 'create_interactions':
            transformed = this.featureEngineer.createInteractionFeatures(transformed, operation.interactions);
            break;
          case 'create_polynomial':
            transformed = this.featureEngineer.createPolynomialFeatures(transformed, operation.columns, operation.degree);
            break;
          default:
            throw new Error(`Unknown operation: ${operation.type}`);
        }
      }

      res.json({
        success: true,
        transformedFeatures: transformed,
        operations: operations.length
      });

    } catch (error) {
      this.logger.error('Error transforming features:', error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async validateModel(req, res) {
    try {
      const { modelName } = req.params;
      const validation = await this.trainer.validateModel(modelName);

      res.json({
        success: true,
        validation,
        modelName
      });

    } catch (error) {
      this.logger.error(`Error validating model ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async exportModel(req, res) {
    try {
      const { modelName } = req.params;
      const { format = 'json' } = req.query;

      const report = await this.trainer.exportModelReport(modelName, format);

      if (format === 'html') {
        res.setHeader('Content-Type', 'text/html');
      } else {
        res.setHeader('Content-Type', 'application/json');
      }

      res.send(report);

    } catch (error) {
      this.logger.error(`Error exporting model ${req.params.modelName}:`, error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async clearCache(req, res) {
    this.predictionCache.clear();
    
    this.logger.info('Prediction cache cleared');

    res.json({
      success: true,
      message: 'Cache cleared successfully'
    });
  }

  async getCacheStats(req, res) {
    const stats = {
      size: this.predictionCache.size,
      maxSize: ML_CONFIG.deployment.cacheSize,
      usage: this.predictionCache.size / ML_CONFIG.deployment.cacheSize
    };

    res.json({
      success: true,
      cache: stats
    });
  }

  errorHandler(error, req, res, next) {
    this.logger.error('Unhandled error:', error);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      requestId: req.id || 'unknown'
    });
  }

  start(port = 3001) {
    this.server = this.app.listen(port, () => {
      this.logger.info(`Model server started on port ${port}`);
    });

    return this.server;
  }

  stop() {
    if (this.server) {
      this.server.close(() => {
        this.logger.info('Model server stopped');
      });
    }
  }
}

module.exports = ModelServer;
