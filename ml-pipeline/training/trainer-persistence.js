const fs = require('fs').promises;
const path = require('path');
const tf = require('@tensorflow/tfjs-node');
const ML_CONFIG = require('../config');

class ModelPersistence {
  static async saveModel(modelName, model, metrics, config, featureEngineer) {
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    await fs.mkdir(modelDir, { recursive: true });

    try {
      await this.saveModelFiles(model, modelDir, config);
      await this.saveMetadata(modelName, modelDir, config, metrics);
      await this.saveFeatureStats(modelDir, featureEngineer);
      
      console.log(`Model ${modelName} saved successfully to ${modelDir}`);
    } catch (error) {
      console.error(`Error saving model ${modelName}:`, error);
      throw error;
    }
  }

  static async saveModelFiles(model, modelDir, config) {
    const modelPath = path.join(modelDir, 'model.json');
    
    if (model.save) {
      await model.save(`file://${modelPath}`);
    } else if (model.model) {
      await fs.writeFile(modelPath, JSON.stringify(model.model));
    } else {
      await fs.writeFile(modelPath, JSON.stringify(model));
    }

    if (config.hyperparameters) {
      const hyperparamsPath = path.join(modelDir, 'hyperparameters.json');
      await fs.writeFile(hyperparamsPath, JSON.stringify(config.hyperparameters, null, 2));
    }
  }

  static async saveMetadata(modelName, modelDir, config, metrics) {
    const metadata = {
      modelName,
      type: config.type,
      features: config.features,
      target: config.target,
      hyperparameters: config.hyperparameters,
      metrics,
      timestamp: new Date().toISOString(),
      version: this.generateVersion(),
      framework: this.detectFramework(config.type),
      modelSize: await this.calculateModelSize(modelDir),
      environment: process.env.NODE_ENV || 'development'
    };

    const metadataPath = path.join(modelDir, 'metadata.json');
    await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
  }

  static async saveFeatureStats(modelDir, featureEngineer) {
    const statsPath = path.join(modelDir, 'feature_stats.json');
    await featureEngineer.saveFeatureStats(statsPath);
  }

  static async loadModel(modelName, featureEngineer) {
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    const modelPath = path.join(modelDir, 'model.json');
    const metadataPath = path.join(modelDir, 'metadata.json');

    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      let model;
      if (metadata.framework === 'tensorflow') {
        model = await tf.loadLayersModel(`file://${modelPath}`);
      } else {
        const modelData = JSON.parse(await fs.readFile(modelPath, 'utf8'));
        model = modelData;
      }

      const statsPath = path.join(modelDir, 'feature_stats.json');
      await featureEngineer.loadFeatureStats(statsPath);
      
      return { model, metadata };
    } catch (error) {
      console.error(`Error loading model ${modelName}:`, error);
      throw error;
    }
  }

  static async listModels() {
    const registryPath = ML_CONFIG.deployment.modelRegistry;
    
    try {
      const modelDirs = await fs.readdir(registryPath);
      const models = [];

      for (const dir of modelDirs) {
        const modelPath = path.join(registryPath, dir);
        const stat = await fs.stat(modelPath);
        
        if (stat.isDirectory()) {
          try {
            const metadataPath = path.join(modelPath, 'metadata.json');
            const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
            
            models.push({
              name: dir,
              type: metadata.type,
              version: metadata.version,
              timestamp: metadata.timestamp,
              metrics: metadata.metrics,
              framework: metadata.framework,
              modelSize: metadata.modelSize
            });
          } catch (error) {
            console.warn(`Could not read metadata for model ${dir}:`, error.message);
          }
        }
      }

      return models.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    } catch (error) {
      console.error('Error listing models:', error);
      return [];
    }
  }

  static async deleteModel(modelName) {
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    
    try {
      const files = await fs.readdir(modelDir);
      await Promise.all(files.map(file => fs.unlink(path.join(modelDir, file))));
      await fs.rmdir(modelDir);
      console.log(`Model ${modelName} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting model ${modelName}:`, error);
      throw error;
    }
  }

  static async backupModel(modelName, backupPath) {
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    const backupDir = path.join(backupPath, modelName);
    
    await fs.mkdir(backupDir, { recursive: true });
    
    const files = await fs.readdir(modelDir);
    await Promise.all(files.map(async (file) => {
      const srcPath = path.join(modelDir, file);
      const destPath = path.join(backupDir, file);
      const content = await fs.readFile(srcPath);
      await fs.writeFile(destPath, content);
    }));
    
    console.log(`Model ${modelName} backed up to ${backupDir}`);
  }

  static async restoreModel(backupPath, modelName) {
    const backupDir = path.join(backupPath, modelName);
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    
    await fs.mkdir(modelDir, { recursive: true });
    
    const files = await fs.readdir(backupDir);
    await Promise.all(files.map(async (file) => {
      const srcPath = path.join(backupDir, file);
      const destPath = path.join(modelDir, file);
      const content = await fs.readFile(srcPath);
      await fs.writeFile(destPath, content);
    }));
    
    console.log(`Model ${modelName} restored from ${backupDir}`);
  }

  static async calculateModelSize(modelDir) {
    try {
      const files = await fs.readdir(modelDir);
      let totalSize = 0;
      
      for (const file of files) {
        const filePath = path.join(modelDir, file);
        const stat = await fs.stat(filePath);
        totalSize += stat.size;
      }
      
      return {
        bytes: totalSize,
        kb: Math.round(totalSize / 1024),
        mb: Math.round(totalSize / (1024 * 1024) * 100) / 100
      };
    } catch (error) {
      return { bytes: 0, kb: 0, mb: 0 };
    }
  }

  static detectFramework(modelType) {
    if (modelType === 'neural_network') {
      return 'tensorflow';
    } else if (['random_forest', 'logistic_regression', 'linear_regression', 'gradient_boosting'].includes(modelType)) {
      return 'mljs';
    }
    return 'unknown';
  }

  static generateVersion() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const random = Math.random().toString(36).substr(2, 9);
    return `v1-${timestamp}-${random}`;
  }

  static async validateModel(modelName) {
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    const requiredFiles = ['model.json', 'metadata.json'];
    
    try {
      const files = await fs.readdir(modelDir);
      const missingFiles = requiredFiles.filter(file => !files.includes(file));
      
      if (missingFiles.length > 0) {
        throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
      }

      const metadataPath = path.join(modelDir, 'metadata.json');
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: []
      };

      if (!metadata.modelName || metadata.modelName !== modelName) {
        validation.errors.push('Model name mismatch in metadata');
      }

      if (!metadata.type) {
        validation.errors.push('Model type not specified in metadata');
      }

      if (!metadata.metrics) {
        validation.warnings.push('No metrics found in metadata');
      }

      if (metadata.modelSize && metadata.modelSize.mb > 100) {
        validation.warnings.push('Model size exceeds 100MB');
      }

      const modelAge = Date.now() - new Date(metadata.timestamp).getTime();
      const daysOld = modelAge / (1000 * 60 * 60 * 24);
      
      if (daysOld > 30) {
        validation.warnings.push(`Model is ${Math.round(daysOld)} days old, consider retraining`);
      }

      validation.isValid = validation.errors.length === 0;
      return validation;
    } catch (error) {
      return {
        isValid: false,
        errors: [error.message],
        warnings: []
      };
    }
  }

  static async getModelInfo(modelName) {
    const modelDir = path.join(ML_CONFIG.deployment.modelRegistry, modelName);
    const metadataPath = path.join(modelDir, 'metadata.json');
    
    try {
      const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
      const modelSize = await this.calculateModelSize(modelDir);
      const validation = await this.validateModel(modelName);
      
      return {
        ...metadata,
        modelSize,
        validation,
        directory: modelDir
      };
    } catch (error) {
      throw new Error(`Could not get model info for ${modelName}: ${error.message}`);
    }
  }
}

module.exports = ModelPersistence;
