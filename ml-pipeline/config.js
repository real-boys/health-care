const path = require('path');

const ML_CONFIG = {
  // Model configurations
  models: {
    claimFraudDetection: {
      type: 'random_forest',
      features: [
        'claimAmount', 'policyAge', 'claimantAge', 'incidentType',
        'delayDays', 'previousClaims', 'policyType', 'location'
      ],
      target: 'isFraud',
      hyperparameters: {
        n_estimators: 100,
        max_depth: 10,
        min_samples_split: 5,
        min_samples_leaf: 2
      }
    },
    claimApprovalPrediction: {
      type: 'logistic_regression',
      features: [
        'claimAmount', 'coverageAmount', 'deductible', 'policyType',
        'incidentSeverity', 'documentationScore', 'claimHistory'
      ],
      target: 'willApprove',
      hyperparameters: {
        learning_rate: 0.01,
        iterations: 1000,
        regularization: 'l2'
      }
    },
    premiumOptimization: {
      type: 'linear_regression',
      features: [
        'age', 'healthScore', 'location', 'coverageLevel',
        'claimHistory', 'lifestyleFactors', 'occupationRisk'
      ],
      target: 'optimalPremium',
      hyperparameters: {
        learning_rate: 0.001,
        iterations: 5000,
        regularization: 'l1'
      }
    },
    customerChurnPrediction: {
      type: 'gradient_boosting',
      features: [
        'customerAge', 'policyDuration', 'premiumAmount', 'claimCount',
        'satisfactionScore', 'interactionCount', 'paymentHistory'
      ],
      target: 'willChurn',
      hyperparameters: {
        n_estimators: 150,
        learning_rate: 0.1,
        max_depth: 6
      }
    }
  },

  // Training configurations
  training: {
    batchSize: 32,
    validationSplit: 0.2,
    testSplit: 0.2,
    crossValidationFolds: 5,
    randomSeed: 42,
    maxRetries: 3,
    earlyStoppingPatience: 10
  },

  // Feature engineering configurations
  features: {
    scaling: {
      numerical: ['standard'], // standard, minmax, robust
      categorical: ['onehot'] // onehot, label, target
    },
    featureSelection: {
      method: 'mutual_info', // mutual_info, chi2, f_classif
      kBest: 20
    },
    dimensionalityReduction: {
      enabled: false,
      method: 'pca', // pca, tsne, umap
      components: 10
    }
  },

  // Deployment configurations
  deployment: {
    modelRegistry: './ml-pipeline/models/registry',
    apiVersion: 'v1',
    maxModelSize: '100MB',
    predictionTimeout: 5000, // ms
    cacheEnabled: true,
    cacheSize: 1000,
    cacheTTL: 3600000 // 1 hour
  },

  // Monitoring configurations
  monitoring: {
    metrics: [
      'accuracy', 'precision', 'recall', 'f1_score',
      'auc_roc', 'confusion_matrix', 'drift_detection'
    ],
    alerting: {
      performanceThreshold: 0.8,
      driftThreshold: 0.1,
      dataQualityThreshold: 0.95
    },
    logging: {
      level: 'info',
      format: 'json',
      retentionDays: 30
    }
  },

  // A/B testing configurations
  abTesting: {
    enabled: true,
    trafficSplit: {
      control: 0.5,
      treatment: 0.5
    },
    minSampleSize: 1000,
    significanceLevel: 0.05,
    testDurationDays: 14
  },

  // Explainability configurations
  explainability: {
    methods: ['shap', 'lime', 'permutation_importance'],
    sampleSize: 100,
    visualizationEnabled: true,
    exportFormat: ['json', 'html']
  },

  // Scheduling configurations
  scheduling: {
    retraining: {
      enabled: true,
      cron: '0 2 * * 0', // Every Sunday at 2 AM
      dataFreshnessDays: 7
    },
    monitoring: {
      enabled: true,
      cron: '0 */6 * * *' // Every 6 hours
    },
    cleanup: {
      enabled: true,
      cron: '0 3 * * 0', // Every Sunday at 3 AM
      retentionDays: 90
    }
  },

  // Data configurations
  data: {
    sources: {
      claims: 'Claim',
      policies: 'Policy',
      payments: 'Payment',
      users: 'User'
    },
    preprocessing: {
      missingValueStrategy: 'impute', // drop, impute, flag
      outlierDetection: 'iqr', // iqr, zscore, isolation_forest
      categoricalEncoding: 'auto' // auto, manual
    }
  },

  // Security configurations
  security: {
    encryptionEnabled: true,
    accessControl: true,
    auditLogging: true,
    dataAnonymization: true
  }
};

module.exports = ML_CONFIG;
