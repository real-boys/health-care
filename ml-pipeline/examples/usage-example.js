const MLPipeline = require('../index');

async function demonstrateMLPipeline() {
  console.log('🚀 ML Pipeline Demonstration');
  console.log('================================\n');

  // Initialize the ML Pipeline
  const pipeline = new MLPipeline();
  await pipeline.initialize();

  try {
    // 1. Train models
    console.log('1️⃣ Training Models');
    console.log('-------------------');
    
    // Train a single model
    const fraudModelResult = await pipeline.trainModel('claimFraudDetection');
    console.log('Fraud detection model trained:', fraudModelResult.metrics.test);
    
    // Train all models
    const allModelsResult = await pipeline.trainAllModels();
    console.log('All models training completed');
    
    // 2. Make predictions
    console.log('\n2️⃣ Making Predictions');
    console.log('------------------------');
    
    // Sample claim data for prediction
    const sampleClaim = {
      claimAmount: 5000,
      policyAge: 365,
      claimantAge: 35,
      incidentType: 1, // Encoded
      delayDays: 7,
      previousClaims: 2,
      policyType: 1, // Encoded
      location: 1 // Encoded
    };
    
    const fraudPrediction = await pipeline.predict('claimFraudDetection', sampleClaim);
    console.log('Fraud prediction:', fraudPrediction);
    
    // Batch prediction
    const batchClaims = [sampleClaim, { ...sampleClaim, claimAmount: 15000 }];
    const batchPredictions = await pipeline.batchPredict('claimFraudDetection', batchClaims);
    console.log('Batch predictions:', batchPredictions);
    
    // 3. A/B Testing
    console.log('\n3️⃣ A/B Testing');
    console.log('---------------');
    
    // Create an A/B test
    const abTest = pipeline.createABTest('fraud_model_comparison', {
      description: 'Compare new fraud detection model with current model',
      models: ['claimFraudDetection_v1', 'claimFraudDetection_v2'],
      trafficSplit: { control: 0.5, treatment: 0.5 },
      minSampleSize: 100,
      testDurationDays: 14
    });
    
    // Assign users to variants
    const assignment1 = pipeline.assignToVariant('fraud_model_comparison', 'user123');
    const assignment2 = pipeline.assignToVariant('fraud_model_comparison', 'user456');
    console.log('User assignments:', { user123: assignment1, user456: assignment2 });
    
    // Record test results
    pipeline.recordABTestResult('fraud_model_comparison', 'control', 0.1, 0); // No fraud
    pipeline.recordABTestResult('fraud_model_comparison', 'treatment', 0.8, 1); // Fraud
    
    // Analyze test (when enough data is collected)
    // const analysis = pipeline.analyzeABTest('fraud_model_comparison');
    // console.log('A/B test analysis:', analysis);
    
    // 4. Model Explainability
    console.log('\n4️⃣ Model Explainability');
    console.log('------------------------');
    
    // Explain a prediction
    const explanation = await pipeline.explainPrediction('claimFraudDetection', sampleClaim, ['shap', 'lime']);
    console.log('Explanation ID:', explanation.explanationId);
    
    // Get detailed explanation
    const explanationReport = pipeline.getExplanation(explanation.explanationId, 'json');
    console.log('Explanation report generated');
    
    // 5. Monitoring
    console.log('\n5️⃣ Model Monitoring');
    console.log('---------------------');
    
    // Get metrics
    const metrics = pipeline.getMetrics('claimFraudDetection');
    console.log('Model metrics:', metrics);
    
    // Get alerts
    const alerts = pipeline.getAlerts();
    console.log('Active alerts:', alerts.length);
    
    // Generate report
    const report = pipeline.generateReport();
    console.log('Report generated with', Object.keys(report.models).length, 'models');
    
    // 6. Feature Engineering
    console.log('\n6️⃣ Feature Engineering');
    console.log('-----------------------');
    
    // Extract features from database
    const claimFeatures = await pipeline.extractFeatures('claims', { status: 'submitted' });
    console.log('Extracted', claimFeatures.length, 'claim features');
    
    const policyFeatures = await pipeline.extractFeatures('policies', { status: 'active' });
    console.log('Extracted', policyFeatures.length, 'policy features');
    
    // 7. Scheduling and Automation
    console.log('\n7️⃣ Scheduling and Automation');
    console.log('------------------------------');
    
    // Get task status
    const taskStatus = pipeline.getTaskStatus();
    console.log('Scheduled tasks:', Object.keys(taskStatus));
    
    // Get task history
    const taskHistory = pipeline.getTaskHistory(5);
    console.log('Recent task executions:', taskHistory.length);
    
    // 8. Health Check
    console.log('\n8️⃣ Health Check');
    console.log('---------------');
    
    const health = await pipeline.healthCheck();
    console.log('Pipeline health:', health.status);
    console.log('Summary:', health.summary);
    
    // 9. Start the server for API access
    console.log('\n9️⃣ Starting Model Server');
    console.log('-------------------------');
    
    await pipeline.start(3001);
    console.log('Model server is running on http://localhost:3001');
    console.log('\nAPI Endpoints available:');
    console.log('- GET  /health');
    console.log('- GET  /api/models');
    console.log('- POST /api/predict/:modelName');
    console.log('- POST /api/train/:modelName');
    console.log('- GET  /api/models/:modelName/export');
    
    // Keep the server running
    console.log('\n🎉 ML Pipeline is fully operational!');
    console.log('Visit http://localhost:3001/health to check server status');
    
  } catch (error) {
    console.error('❌ Error in demonstration:', error);
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateMLPipeline().catch(console.error);
}

module.exports = demonstrateMLPipeline;
