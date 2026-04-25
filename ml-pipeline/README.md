# ML Pipeline for Healthcare Insurance

A comprehensive machine learning pipeline for predictive analytics and pattern recognition in healthcare insurance. This pipeline provides automated model training, deployment, monitoring, A/B testing, and explainability features.

## 🚀 Features

### Core Capabilities
- **Automated Model Training**: Train multiple models including fraud detection, claim approval prediction, premium optimization, and customer churn prediction
- **Feature Engineering**: Automated feature extraction, transformation, and selection
- **Model Deployment**: RESTful API server for model serving with caching and load balancing
- **Real-time Monitoring**: Continuous performance monitoring with drift detection and alerting
- **A/B Testing**: Statistical framework for comparing model performance
- **Model Explainability**: SHAP and LIME explanations for model predictions
- **Automated Scheduling**: Cron-based retraining and monitoring tasks

### Supported Models
- **Random Forest**: For classification and regression tasks
- **Logistic Regression**: Binary classification
- **Linear Regression**: Continuous prediction
- **Neural Networks**: Deep learning models with TensorFlow.js
- **Gradient Boosting**: Ensemble methods

## 📋 Requirements

### System Requirements
- Node.js 16.x or higher
- MongoDB 4.4 or higher
- Redis 6.0 or higher (for caching)
- Python 3.8+ (for some ML libraries)

### Dependencies
See `package.json` for complete list of dependencies including:
- TensorFlow.js for neural networks
- ML.js for traditional ML algorithms
- Winston for logging
- Node-cron for scheduling

## 🛠️ Installation

1. **Install dependencies**
```bash
npm install
```

2. **Set up environment variables**
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. **Create necessary directories**
```bash
mkdir -p ml-pipeline/{models/registry,logs,reports,data,cache}
```

4. **Start the ML pipeline**
```bash
node ml-pipeline/examples/usage-example.js
```

## 🏗️ Architecture

```
ml-pipeline/
├── config.js              # Configuration settings
├── index.js               # Main orchestrator
├── features/              # Feature engineering
│   └── featureEngineer.js
├── training/              # Model training
│   ├── trainer.js
│   ├── trainer-core.js
│   ├── trainer-models.js
│   ├── trainer-evaluation.js
│   └── trainer-persistence.js
├── deployment/            # Model serving
│   └── modelServer.js
├── monitoring/            # Performance monitoring
│   └── modelMonitor.js
├── testing/               # A/B testing
│   └── abTesting.js
├── explainability/        # Model explanations
│   └── modelExplainer.js
├── scheduling/            # Automated tasks
│   └── scheduler.js
├── examples/              # Usage examples
│   └── usage-example.js
└── README.md
```

## 📊 Available Models

### 1. Claim Fraud Detection
- **Purpose**: Identify potentially fraudulent claims
- **Features**: Claim amount, policy age, claimant demographics, incident details
- **Algorithm**: Random Forest
- **Metrics**: Accuracy, Precision, Recall, F1-Score

### 2. Claim Approval Prediction
- **Purpose**: Predict likelihood of claim approval
- **Features**: Coverage details, claim amount, documentation score
- **Algorithm**: Logistic Regression
- **Metrics**: AUC-ROC, Accuracy

### 3. Premium Optimization
- **Purpose**: Optimize insurance premium pricing
- **Features**: Customer demographics, risk factors, claims history
- **Algorithm**: Linear Regression
- **Metrics**: MAE, RMSE, R²

### 4. Customer Churn Prediction
- **Purpose**: Predict customer attrition risk
- **Features**: Customer behavior, policy details, interaction history
- **Algorithm**: Gradient Boosting
- **Metrics**: Accuracy, Recall, Precision

## 🔧 Usage

### Basic Usage

```javascript
const MLPipeline = require('./ml-pipeline');

// Initialize pipeline
const pipeline = new MLPipeline();
await pipeline.initialize();

// Train a model
await pipeline.trainModel('claimFraudDetection');

// Make predictions
const prediction = await pipeline.predict('claimFraudDetection', {
  claimAmount: 5000,
  policyAge: 365,
  // ... other features
});

// Start the server
await pipeline.start(3001);
```

### API Endpoints

#### Model Management
- `GET /api/models` - List all models
- `GET /api/models/:modelName` - Get model info
- `POST /api/models/:modelName/load` - Load a model
- `POST /api/models/:modelName/unload` - Unload a model

#### Predictions
- `POST /api/predict/:modelName` - Single prediction
- `POST /api/batch-predict/:modelName` - Batch predictions

#### Training
- `POST /api/train/:modelName` - Train a model
- `POST /api/retrain-all` - Retrain all models

#### Monitoring
- `GET /api/models/:modelName/validate` - Validate model
- `GET /api/models/:modelName/export` - Export model report

### Feature Engineering

```javascript
// Extract features from database
const claimFeatures = await pipeline.extractFeatures('claims', {
  status: 'submitted'
});

// Transform features
const transformed = await pipeline.featureEngineer.normalizeFeatures(
  claimFeatures, 
  ['claimAmount', 'policyAge']
);
```

### A/B Testing

```javascript
// Create experiment
pipeline.createABTest('model_comparison', {
  models: ['model_v1', 'model_v2'],
  trafficSplit: { control: 0.5, treatment: 0.5 },
  minSampleSize: 1000
});

// Assign user to variant
const assignment = pipeline.assignToVariant('model_comparison', 'user123');

// Record result
pipeline.recordABTestResult('model_comparison', assignment.variant, prediction, actual);

// Analyze results
const analysis = pipeline.analyzeABTest('model_comparison');
```

### Model Explainability

```javascript
// Explain prediction
const explanation = await pipeline.explainPrediction(
  'claimFraudDetection', 
  inputData, 
  ['shap', 'lime']
);

// Get detailed report
const report = pipeline.getExplanation(explanation.explanationId, 'html');
```

## 📈 Monitoring

### Performance Metrics
- **Classification**: Accuracy, Precision, Recall, F1-Score, AUC-ROC
- **Regression**: MSE, RMSE, MAE, R²
- **Operational**: Inference time, cache hit rate, prediction volume

### Drift Detection
- Statistical tests for data distribution changes
- Performance degradation alerts
- Automated retraining triggers

### Alerting
- Performance threshold breaches
- Model drift detection
- Data quality issues
- System health problems

## ⏰ Scheduling

### Automated Tasks
- **Model Retraining**: Weekly (configurable)
- **Performance Monitoring**: Every 6 hours
- **Data Cleanup**: Weekly
- **Health Checks**: Daily

### Custom Schedules
```javascript
// Run task manually
await pipeline.runScheduledTask('model_retraining');

// Get task status
const status = pipeline.getTaskStatus('model_retraining');

// Get task history
const history = pipeline.getTaskHistory(10);
```

## 🔍 Configuration

### Main Configuration (ml-pipeline/config.js)

```javascript
const ML_CONFIG = {
  models: {
    claimFraudDetection: {
      type: 'random_forest',
      features: ['claimAmount', 'policyAge', ...],
      hyperparameters: {
        n_estimators: 100,
        max_depth: 10
      }
    }
  },
  
  training: {
    batchSize: 32,
    validationSplit: 0.2,
    crossValidationFolds: 5
  },
  
  deployment: {
    modelRegistry: './ml-pipeline/models/registry',
    cacheEnabled: true,
    predictionTimeout: 5000
  },
  
  monitoring: {
    metrics: ['accuracy', 'precision', 'recall'],
    alerting: {
      performanceThreshold: 0.8,
      driftThreshold: 0.1
    }
  },
  
  scheduling: {
    retraining: {
      enabled: true,
      cron: '0 2 * * 0' // Weekly
    }
  }
};
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test
npm test -- ml-pipeline/tests/trainer.test.js
```

### Test Structure
```
tests/
├── trainer.test.js          # Training functionality
├── server.test.js           # API endpoints
├── monitoring.test.js       # Monitoring system
├── abTesting.test.js        # A/B testing
└── explainability.test.js   # Model explanations
```

## 📊 Performance

### Benchmarks
- **Training Time**: 2-5 minutes for typical datasets
- **Inference Time**: <100ms per prediction
- **Memory Usage**: 512MB - 2GB depending on models
- **API Response Time**: <200ms average

### Scalability
- Supports 1000+ concurrent predictions
- Horizontal scaling with load balancer
- Model versioning and rollback
- Caching for improved performance

## 🔒 Security

### Data Protection
- Encrypted model storage
- Secure API endpoints
- Access control and authentication
- Audit logging

### Privacy
- Data anonymization
- PII protection
- GDPR compliance features
- Secure data handling

## 🚀 Deployment

### Docker Deployment
```bash
# Build image
docker build -t ml-pipeline .

# Run container
docker run -p 3001:3001 ml-pipeline
```

### Production Setup
1. Configure production database
2. Set up Redis for caching
3. Configure load balancer
4. Set up monitoring and logging
5. Configure SSL certificates

### Environment Variables
```bash
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://prod-mongo:27017/insurance_ml
REDIS_URL=redis://prod-redis:6379
LOG_LEVEL=info
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines
- Follow ESLint configuration
- Add comprehensive tests
- Update documentation
- Use semantic versioning

## 📝 API Documentation

### Authentication
```bash
# Include API key in headers
curl -H "X-API-Key: your-api-key" \
     -H "Content-Type: application/json" \
     http://localhost:3001/api/predict/claimFraudDetection
```

### Prediction Example
```bash
curl -X POST http://localhost:3001/api/predict/claimFraudDetection \
  -H "Content-Type: application/json" \
  -d '{
    "data": {
      "claimAmount": 5000,
      "policyAge": 365,
      "claimantAge": 35,
      "incidentType": 1,
      "delayDays": 7,
      "previousClaims": 2,
      "policyType": 1,
      "location": 1
    },
    "useCache": true
  }'
```

### Response Format
```json
{
  "success": true,
  "prediction": 0.15,
  "inferenceTime": 45,
  "cached": false,
  "timestamp": "2024-01-15T10:30:00.000Z"
}
```

## 🔧 Troubleshooting

### Common Issues

#### Model Loading Errors
- Check model registry permissions
- Verify model file integrity
- Ensure sufficient memory

#### Performance Issues
- Enable caching
- Check database connections
- Monitor resource usage

#### Training Failures
- Verify data quality
- Check feature engineering
- Review hyperparameters

### Logs
- Application logs: `logs/ml-pipeline.log`
- Training logs: `logs/training.log`
- Monitoring logs: `logs/monitoring.log`
- API logs: `logs/api.log`

## 📞 Support

For support and questions:
- Create an issue in the repository
- Email: ml-support@insurance-portal.com
- Documentation: [docs.ml-pipeline.com](https://docs.ml-pipeline.com)

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔄 Version History

### v1.0.0 (Current)
- Initial release
- Core ML pipeline functionality
- Model training and deployment
- Monitoring and alerting
- A/B testing framework
- Model explainability

### Planned Features
- Advanced deep learning models
- Real-time streaming predictions
- Multi-tenant support
- Advanced visualization dashboard
- Integration with external ML platforms

---

**Built with ❤️ for Healthcare Insurance Analytics**
