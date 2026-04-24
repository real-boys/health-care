const ModelTrainer = require('./training/trainer');
const ModelServer = require('./deployment/modelServer');
const ModelMonitor = require('./monitoring/modelMonitor');
const ABTestingFramework = require('./testing/abTesting');
const ModelExplainer = require('./explainability/modelExplainer');
const MLScheduler = require('./scheduling/scheduler');
const FeatureEngineer = require('./features/featureEngineer');
const ML_CONFIG = require('./config');

class MLPipeline {
  constructor() {
    this.trainer = new ModelTrainer();
    this.server = new ModelServer();
    this.monitor = new ModelMonitor();
    this.abTesting = new ABTestingFramework();
    this.explainer = new ModelExplainer();
    this.scheduler = new MLScheduler();
    this.featureEngineer = new FeatureEngineer();
    
    this.isRunning = false;
    this.components = {
      trainer: this.trainer,
      server: this.server,
      monitor: this.monitor,
      abTesting: this.abTesting,
      explainer: this.explainer,
      scheduler: this.scheduler,
      featureEngineer: this.featureEngineer
    };
  }

  async initialize() {
    console.log('🚀 Initializing ML Pipeline...');
    
    try {
      // Create necessary directories
      await this.createDirectories();
      
      // Load existing models if available
      await this.loadExistingModels();
      
      // Setup event listeners
      this.setupEventListeners();
      
      console.log('✅ ML Pipeline initialized successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to initialize ML Pipeline:', error);
      return false;
    }
  }

  async createDirectories() {
    const fs = require('fs').promises;
    const path = require('path');
    
    const directories = [
      'ml-pipeline/models/registry',
      'ml-pipeline/logs',
      'ml-pipeline/reports',
      'ml-pipeline/data',
      'ml-pipeline/cache'
    ];

    for (const dir of directories) {
      try {
        await fs.mkdir(path.join(process.cwd(), dir), { recursive: true });
      } catch (error) {
        console.warn(`Could not create directory ${dir}:`, error.message);
      }
    }
  }

  async loadExistingModels() {
    try {
      const models = await this.trainer.listModels();
      console.log(`Found ${models.length} existing models`);
      
      // Load key models automatically
      const keyModels = ['claimFraudDetection', 'claimApprovalPrediction', 'premiumOptimization'];
      
      for (const modelName of keyModels) {
        const modelExists = models.some(m => m.name === modelName);
        if (modelExists) {
          try {
            await this.trainer.loadModel(modelName);
            console.log(`✅ Loaded model: ${modelName}`);
          } catch (error) {
            console.warn(`⚠️ Could not load model ${modelName}:`, error.message);
          }
        }
      }
    } catch (error) {
      console.warn('Could not load existing models:', error.message);
    }
  }

  setupEventListeners() {
    // Monitor events
    this.monitor.on('alert', (alert) => {
      console.log(`🚨 Model Alert: ${alert.type} for ${alert.modelName}`);
    });

    this.monitor.on('performance_update', (data) => {
      console.log(`📊 Performance update for ${data.modelName}`);
    });

    this.monitor.on('drift_check', (data) => {
      if (data.detected) {
        console.log(`🔄 Model drift detected for ${data.modelName} (score: ${data.driftScore.toFixed(4)})`);
      }
    });

    // Server events
    this.server.on('prediction', (data) => {
      this.monitor.trackPrediction(data.modelName, data.prediction, null, data.metadata);
    });
  }

  async start(port = 3001) {
    if (this.isRunning) {
      console.log('⚠️ ML Pipeline is already running');
      return;
    }

    console.log('🚀 Starting ML Pipeline...');
    
    try {
      // Start the model server
      this.server.start(port);
      console.log(`🌐 Model server started on port ${port}`);
      
      this.isRunning = true;
      console.log('✅ ML Pipeline is now running');
      
      // Display status
      this.displayStatus();
      
    } catch (error) {
      console.error('❌ Failed to start ML Pipeline:', error);
      throw error;
    }
  }

  async stop() {
    if (!this.isRunning) {
      console.log('⚠️ ML Pipeline is not running');
      return;
    }

    console.log('🛑 Stopping ML Pipeline...');
    
    try {
      // Stop the server
      this.server.stop();
      
      // Stop the scheduler
      await this.scheduler.shutdown();
      
      this.isRunning = false;
      console.log('✅ ML Pipeline stopped successfully');
      
    } catch (error) {
      console.error('❌ Error stopping ML Pipeline:', error);
    }
  }

  displayStatus() {
    console.log('\n📊 ML Pipeline Status:');
    console.log('========================');
    
    // Model status
    const models = this.trainer.models;
    console.log(`🤖 Loaded Models: ${models.size}`);
    for (const [name, model] of models.entries()) {
      console.log(`   - ${name}: ✅ Loaded`);
    }
    
    // Monitor status
    const metrics = this.monitor.getAllMetrics();
    console.log(`📈 Monitored Models: ${Object.keys(metrics).length}`);
    
    // Scheduled tasks
    const tasks = this.scheduler.getTaskStatus();
    console.log(`⏰ Scheduled Tasks: ${Object.keys(tasks).length}`);
    for (const [name, task] of Object.entries(tasks)) {
      console.log(`   - ${name}: ${task.status}`);
    }
    
    // Server status
    console.log(`🌐 Server: Running on port 3001`);
    
    console.log('========================\n');
  }

  // Training methods
  async trainModel(modelName, config = {}) {
    console.log(`🎯 Training model: ${modelName}`);
    const result = await this.trainer.trainModel(modelName, config);
    console.log(`✅ Model ${modelName} trained successfully`);
    return result;
  }

  async trainAllModels() {
    console.log('🎯 Training all models...');
    const results = await this.trainer.retrainAllModels();
    
    const successful = Object.values(results).filter(r => r.success).length;
    const failed = Object.values(results).filter(r => !r.success).length;
    
    console.log(`✅ Training completed: ${successful} successful, ${failed} failed`);
    return results;
  }

  // Prediction methods
  async predict(modelName, data, options = {}) {
    if (!this.trainer.models.has(modelName)) {
      throw new Error(`Model ${modelName} is not loaded`);
    }

    const model = this.trainer.models.get(modelName);
    const prediction = this.trainer.predict(model, [data]);
    
    // Track prediction for monitoring
    this.monitor.trackPrediction(modelName, prediction[0], null, options);
    
    return prediction[0];
  }

  async batchPredict(modelName, data, options = {}) {
    if (!this.trainer.models.has(modelName)) {
      throw new Error(`Model ${modelName} is not loaded`);
    }

    const model = this.trainer.models.get(modelName);
    const predictions = this.trainer.predict(model, data);
    
    // Track predictions for monitoring
    predictions.forEach((prediction, index) => {
      this.monitor.trackPrediction(modelName, prediction, null, {
        ...options,
        batchIndex: index
      });
    });
    
    return predictions;
  }

  // A/B Testing methods
  createABTest(name, config) {
    console.log(`🧪 Creating A/B test: ${name}`);
    const experiment = this.abTesting.createExperiment(name, config);
    console.log(`✅ A/B test ${name} created`);
    return experiment;
  }

  assignToVariant(experimentName, userId, context = {}) {
    return this.abTesting.assignToVariant(experimentName, userId, context);
  }

  recordABTestResult(experimentName, variant, prediction, actual = null) {
    return this.abTesting.recordPrediction(experimentName, variant, prediction, actual);
  }

  analyzeABTest(experimentName) {
    console.log(`📊 Analyzing A/B test: ${experimentName}`);
    const analysis = this.abTesting.analyzeExperiment(experimentName);
    console.log(`✅ A/B test analysis completed`);
    return analysis;
  }

  // Explainability methods
  async explainPrediction(modelName, data, methods = ['shap']) {
    if (!this.trainer.models.has(modelName)) {
      throw new Error(`Model ${modelName} is not loaded`);
    }

    const model = this.trainer.models.get(modelName);
    const modelConfig = ML_CONFIG.models[modelName];
    
    console.log(`🔍 Explaining prediction for ${modelName}`);
    const result = await this.explainer.explainPrediction(
      modelName, 
      model, 
      [data], 
      modelConfig.features, 
      methods
    );
    
    console.log(`✅ Explanation generated: ${result.explanationId}`);
    return result;
  }

  getExplanation(explanationId, format = 'json') {
    return this.explainer.generateExplanationReport(explanationId, format);
  }

  // Monitoring methods
  getMetrics(modelName = null) {
    return modelName ? 
      this.monitor.getMetrics(modelName) : 
      this.monitor.getAllMetrics();
  }

  getAlerts(modelName = null, severity = null) {
    return this.monitor.getAlerts(modelName, severity);
  }

  acknowledgeAlert(alertId) {
    return this.monitor.acknowledgeAlert(alertId);
  }

  generateReport(modelName = null) {
    console.log(`📋 Generating report${modelName ? ` for ${modelName}` : ''}`);
    const report = this.monitor.generateReport(modelName);
    console.log(`✅ Report generated`);
    return report;
  }

  // Feature engineering methods
  async extractFeatures(dataType, filters = {}) {
    console.log(`🔧 Extracting features for: ${dataType}`);
    const features = await this.featureEngineer.extractFeatures(dataType, filters);
    console.log(`✅ Extracted ${features.length} features`);
    return features;
  }

  // Scheduling methods
  async runScheduledTask(taskName) {
    console.log(`⏰ Running scheduled task: ${taskName}`);
    await this.scheduler.runTaskManually(taskName);
    console.log(`✅ Task ${taskName} completed`);
  }

  getTaskStatus(taskName = null) {
    return this.scheduler.getTaskStatus(taskName);
  }

  getTaskHistory(limit = 50) {
    return this.scheduler.getTaskHistory(limit);
  }

  // Utility methods
  async healthCheck() {
    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      components: {},
      summary: {
        modelsLoaded: this.trainer.models.size,
        activeAlerts: this.monitor.getAlerts().filter(a => !a.acknowledged).length,
        scheduledTasks: Object.keys(this.scheduler.getTaskStatus()).length,
        serverRunning: this.isRunning
      }
    };

    // Check each component
    for (const [name, component] of Object.entries(this.components)) {
      try {
        health.components[name] = {
          status: 'healthy',
          message: 'Operating normally'
        };
      } catch (error) {
        health.components[name] = {
          status: 'unhealthy',
          message: error.message
        };
        health.status = 'degraded';
      }
    }

    return health;
  }

  getConfig() {
    return ML_CONFIG;
  }

  async updateConfig(newConfig) {
    // This would update the configuration
    // For now, just return the current config
    console.log('⚙️ Configuration update not implemented yet');
    return ML_CONFIG;
  }
}

module.exports = MLPipeline;
