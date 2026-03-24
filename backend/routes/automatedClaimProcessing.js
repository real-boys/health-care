/**
 * Automated Claim Processing API Routes
 * Provides endpoints for automated claim processing
 */

const express = require('express');
const ClaimProcessingPipeline = require('../services/claimProcessingPipeline');
const RuleEngine = require('../services/ruleEngine');
const FraudDetectionService = require('../services/fraudDetection');
const OCRService = require('../services/ocrService');
const VerificationService = require('../services/verificationService');
const MonitoringService = require('../services/monitoringService');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf|tiff|bmp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);
    
    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

// Initialize services (these would typically be injected)
const db = require('../database/connection');
const pipeline = new ClaimProcessingPipeline(db);
const ruleEngine = new RuleEngine();
const fraudDetection = new FraudDetectionService();
const ocrService = new OCRService();
const verificationService = new VerificationService();
const monitoringService = new MonitoringService();

/**
 * Process a single claim through the automated pipeline
 */
router.post('/process', [
  body('claimId').notEmpty().withMessage('Claim ID is required'),
  body('options').optional().isObject().withMessage('Options must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { claimId, options = {} } = req.body;
    
    // Process the claim
    const result = await pipeline.processClaim(claimId, options);
    
    res.json({
      success: true,
      data: result,
      message: 'Claim processed successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Process multiple claims in batch
 */
router.post('/batch-process', [
  body('claimIds').isArray().withMessage('Claim IDs must be an array'),
  body('claimIds.*').notEmpty().withMessage('Each claim ID is required'),
  body('options').optional().isObject().withMessage('Options must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { claimIds, options = {} } = req.body;
    
    // Process claims in batch
    const results = await pipeline.batchProcessClaims(claimIds, options);
    
    res.json({
      success: true,
      data: results,
      message: `Processed ${results.length} claims`
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Validate a claim using the rule engine
 */
router.post('/validate', [
  body('claim').isObject().withMessage('Claim data is required'),
  body('claim.patientId').notEmpty().withMessage('Patient ID is required'),
  body('claim.providerName').notEmpty().withMessage('Provider name is required'),
  body('claim.serviceDate').notEmpty().withMessage('Service date is required'),
  body('claim.totalAmount').isNumeric().withMessage('Total amount must be numeric'),
  body('claim.diagnosisCodes').notEmpty().withMessage('Diagnosis codes are required'),
  body('claim.procedureCodes').notEmpty().withMessage('Procedure codes are required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { claim } = req.body;
    
    // Validate claim using rule engine
    const result = await ruleEngine.evaluateClaim(claim);
    
    res.json({
      success: true,
      data: result,
      message: 'Claim validation completed'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Analyze a claim for fraud
 */
router.post('/fraud-analysis', [
  body('claim').isObject().withMessage('Claim data is required'),
  body('patientHistory').optional().isArray().withMessage('Patient history must be an array')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { claim, patientHistory = [] } = req.body;
    
    // Analyze claim for fraud
    const result = await fraudDetection.analyzeClaim(claim, patientHistory);
    
    res.json({
      success: true,
      data: result,
      message: 'Fraud analysis completed'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Process documents using OCR
 */
router.post('/ocr-process', upload.array('documents', 10), [
  body('documentType').notEmpty().withMessage('Document type is required'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentType, metadata = {} } = req.body;
    const files = req.files;
    
    if (!files || files.length === 0) {
      return res.status(400).json({ error: 'No documents uploaded' });
    }
    
    // Process documents with OCR
    const documents = files.map((file, index) => ({
      id: `doc_${index}`,
      filePath: file.path,
      type: documentType,
      metadata
    }));
    
    const results = await ocrService.batchProcessDocuments(documents);
    
    res.json({
      success: true,
      data: results,
      message: `Processed ${results.length} documents`
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Verify external information
 */
router.post('/verify', [
  body('claim').isObject().withMessage('Claim data is required'),
  body('verificationTypes').isArray().withMessage('Verification types must be an array'),
  body('verificationTypes.*').isIn(['eligibility', 'provider', 'authorization']).withMessage('Invalid verification type')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { claim, verificationTypes } = req.body;
    
    const results = {};
    
    // Perform requested verifications
    if (verificationTypes.includes('eligibility')) {
      results.eligibility = await verificationService.verifyEligibility(claim);
    }
    
    if (verificationTypes.includes('provider')) {
      results.provider = await verificationService.verifyProvider(claim);
    }
    
    if (verificationTypes.includes('authorization')) {
      results.authorization = await verificationService.verifyAuthorization(claim);
    }
    
    res.json({
      success: true,
      data: results,
      message: 'Verification completed'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Get pipeline statistics and metrics
 */
router.get('/statistics', async (req, res, next) => {
  try {
    const [pipelineStats, ruleStats, fraudStats, ocrStats, verificationStats, monitoringStats] = await Promise.all([
      pipeline.getPipelineStatistics(),
      Promise.resolve(ruleEngine.getRuleStatistics()),
      Promise.resolve(fraudDetection.getModelStatistics()),
      Promise.resolve(ocrService.getStatistics()),
      Promise.resolve(verificationService.getStatistics()),
      monitoringService.getPipelineStatistics()
    ]);
    
    res.json({
      success: true,
      data: {
        pipeline: pipelineStats,
        ruleEngine: ruleStats,
        fraudDetection: fraudStats,
        ocr: ocrStats,
        verification: verificationStats,
        monitoring: monitoringStats
      },
      message: 'Statistics retrieved successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Get health status of all services
 */
router.get('/health', async (req, res, next) => {
  try {
    const [verificationHealth, monitoringHealth] = await Promise.all([
      verificationService.healthCheck(),
      Promise.resolve({ status: 'healthy' }) // Placeholder for other services
    ]);
    
    const overallHealth = {
      status: 'healthy',
      services: {
        verification: verificationHealth,
        monitoring: monitoringHealth,
        ruleEngine: { status: 'healthy' },
        fraudDetection: { status: 'healthy' },
        ocr: { status: 'healthy' },
        pipeline: { status: 'healthy' }
      },
      timestamp: new Date().toISOString()
    };
    
    // Determine overall health
    const serviceStatuses = Object.values(overallHealth.services).map(s => s.status);
    if (serviceStatuses.includes('unhealthy')) {
      overallHealth.status = 'unhealthy';
    } else if (serviceStatuses.includes('degraded')) {
      overallHealth.status = 'degraded';
    }
    
    res.json({
      success: true,
      data: overallHealth,
      message: 'Health check completed'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Get recent alerts
 */
router.get('/alerts', async (req, res, next) => {
  try {
    const { limit = 50, severity } = req.query;
    
    let alerts = monitoringService.alerts;
    
    // Filter by severity if specified
    if (severity) {
      alerts = alerts.filter(alert => alert.severity === severity);
    }
    
    // Sort by timestamp (newest first) and limit
    alerts = alerts
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, parseInt(limit));
    
    res.json({
      success: true,
      data: alerts,
      message: 'Alerts retrieved successfully'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Add custom rule to rule engine
 */
router.post('/rules', [
  body('name').notEmpty().withMessage('Rule name is required'),
  body('rule').isObject().withMessage('Rule definition is required'),
  body('rule.condition').isFunction().withMessage('Rule condition must be a function'),
  body('rule.action').isFunction().withMessage('Rule action must be a function')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { name, rule } = req.body;
    
    // Validate rule
    ruleEngine.validateRule(rule);
    
    // Add rule to engine
    ruleEngine.addRule(name, rule);
    
    res.json({
      success: true,
      message: `Rule '${name}' added successfully`
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Remove rule from rule engine
 */
router.delete('/rules/:name', async (req, res, next) => {
  try {
    const { name } = req.params;
    
    // Remove rule from engine
    ruleEngine.removeRule(name);
    
    res.json({
      success: true,
      message: `Rule '${name}' removed successfully`
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Update fraud detection model configuration
 */
router.put('/fraud-detection/config', [
  body('config').isObject().withMessage('Configuration must be an object')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { config } = req.body;
    
    // Update fraud detection configuration
    fraudDetection.updateModelConfig(config);
    
    res.json({
      success: true,
      message: 'Fraud detection configuration updated'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Test OCR processing
 */
router.post('/test-ocr', upload.single('document'), [
  body('documentType').notEmpty().withMessage('Document type is required')
], async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { documentType } = req.body;
    const file = req.file;
    
    if (!file) {
      return res.status(400).json({ error: 'No document uploaded' });
    }
    
    // Process document with OCR
    const document = {
      id: 'test_doc',
      filePath: file.path,
      type: documentType
    };
    
    const result = await ocrService.processDocument(document);
    
    res.json({
      success: true,
      data: result,
      message: 'OCR test completed'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Get processing queue status
 */
router.get('/queue', async (req, res, next) => {
  try {
    // This would typically interface with a queue system like Redis or RabbitMQ
    // For now, return mock data
    const queueStatus = {
      size: monitoringService.metrics.performance.currentQueueSize,
      processing: Array.from(monitoringService.metrics.pipelines.values())
        .filter(p => p.status === 'running').length,
      completed: Array.from(monitoringService.metrics.pipelines.values())
        .filter(p => p.status !== 'running').length,
      averageWaitTime: monitoringService.metrics.performance.averageProcessingTime,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      data: queueStatus,
      message: 'Queue status retrieved'
    });
    
  } catch (error) {
    next(error);
  }
});

/**
 * Export processing metrics
 */
router.get('/export/metrics', async (req, res, next) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    
    // Get metrics within date range
    const metrics = monitoringService.getPipelineStatistics();
    
    // Filter by date range if provided
    if (startDate || endDate) {
      // Implementation would filter metrics by date range
    }
    
    // Export in requested format
    switch (format.toLowerCase()) {
      case 'csv':
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=metrics.csv');
        // Convert to CSV format
        res.send('CSV export not implemented yet');
        break;
        
      case 'json':
      default:
        res.json({
          success: true,
          data: metrics,
          message: 'Metrics exported successfully'
        });
        break;
    }
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
