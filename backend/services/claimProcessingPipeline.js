/**
 * Automated Claim Processing Pipeline
 * Orchestrates the entire claim validation and processing workflow
 */

const RuleEngine = require('./ruleEngine');
const FraudDetectionService = require('./fraudDetection');
const OCRService = require('./ocrService');
const VerificationService = require('./verificationService');
const MonitoringService = require('./monitoringService');

class ClaimProcessingPipeline {
  constructor(database) {
    this.db = database;
    this.ruleEngine = new RuleEngine();
    this.fraudDetection = new FraudDetectionService();
    this.ocrService = new OCRService();
    this.verificationService = new VerificationService();
    this.monitoring = new MonitoringService();
    
    this.pipelineStages = [
      'initial_validation',
      'document_processing',
      'rule_evaluation',
      'fraud_detection',
      'external_verification',
      'final_decision',
      'notification'
    ];
  }

  /**
   * Process a claim through the complete pipeline
   */
  async processClaim(claimId, options = {}) {
    const startTime = Date.now();
    const pipelineId = this.generatePipelineId();
    
    try {
      // Initialize pipeline tracking
      await this.initializePipeline(pipelineId, claimId, options);
      
      // Get claim details
      const claim = await this.getClaim(claimId);
      if (!claim) {
        throw new Error(`Claim ${claimId} not found`);
      }

      // Get patient history for context
      const patientHistory = await this.getPatientHistory(claim.patient_id);
      
      const pipelineResult = {
        pipelineId,
        claimId,
        patientId: claim.patient_id,
        startTime: new Date().toISOString(),
        stages: {},
        finalDecision: null,
        errors: []
      };

      // Execute pipeline stages
      for (const stage of this.pipelineStages) {
        const stageResult = await this.executeStage(stage, claim, patientHistory, options);
        pipelineResult.stages[stage] = stageResult;
        
        // Log stage completion
        await this.monitoring.logStageCompletion(pipelineId, stage, stageResult);
        
        // Check if pipeline should stop due to critical failure
        if (stageResult.stopPipeline) {
          break;
        }
      }

      // Make final decision
      pipelineResult.finalDecision = await this.makeFinalDecision(pipelineResult);
      
      // Update claim status
      await this.updateClaimStatus(claimId, pipelineResult.finalDecision);
      
      // Send notifications
      await this.sendNotifications(claimId, pipelineResult);
      
      const endTime = Date.now();
      pipelineResult.endTime = new Date().toISOString();
      pipelineResult.duration = endTime - startTime;
      
      // Log pipeline completion
      await this.monitoring.logPipelineCompletion(pipelineResult);
      
      return pipelineResult;
      
    } catch (error) {
      await this.monitoring.logPipelineError(pipelineId, error);
      throw error;
    }
  }

  /**
   * Execute individual pipeline stage
   */
  async executeStage(stage, claim, patientHistory, options) {
    const startTime = Date.now();
    
    try {
      let result;
      
      switch (stage) {
        case 'initial_validation':
          result = await this.performInitialValidation(claim);
          break;
          
        case 'document_processing':
          result = await this.performDocumentProcessing(claim, options);
          break;
          
        case 'rule_evaluation':
          result = await this.performRuleEvaluation(claim);
          break;
          
        case 'fraud_detection':
          result = await this.performFraudDetection(claim, patientHistory);
          break;
          
        case 'external_verification':
          result = await this.performExternalVerification(claim, options);
          break;
          
        case 'final_decision':
          result = await this.performFinalDecision(claim);
          break;
          
        case 'notification':
          result = await this.performNotification(claim);
          break;
          
        default:
          throw new Error(`Unknown pipeline stage: ${stage}`);
      }
      
      result.duration = Date.now() - startTime;
      result.timestamp = new Date().toISOString();
      result.success = true;
      
      return result;
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
        stopPipeline: this.shouldStopPipeline(stage, error)
      };
    }
  }

  /**
   * Initial validation stage
   */
  async performInitialValidation(claim) {
    const validationResults = {
      dataIntegrity: await this.validateDataIntegrity(claim),
      requiredFields: await this.validateRequiredFields(claim),
      businessRules: await this.validateBasicBusinessRules(claim)
    };
    
    const overallValid = Object.values(validationResults).every(result => result.valid);
    
    return {
      stage: 'initial_validation',
      valid: overallValid,
      results: validationResults,
      stopPipeline: !overallValid
    };
  }

  /**
   * Document processing stage
   */
  async performDocumentProcessing(claim, options) {
    if (!options.documents || options.documents.length === 0) {
      return {
        stage: 'document_processing',
        valid: true,
        message: 'No documents to process',
        extractedData: {}
      };
    }
    
    const extractedData = {};
    const processingResults = [];
    
    for (const document of options.documents) {
      try {
        const ocrResult = await this.ocrService.processDocument(document);
        extractedData[document.id] = ocrResult;
        processingResults.push({
          documentId: document.id,
          success: true,
          data: ocrResult
        });
      } catch (error) {
        processingResults.push({
          documentId: document.id,
          success: false,
          error: error.message
        });
      }
    }
    
    const successRate = processingResults.filter(r => r.success).length / processingResults.length;
    
    return {
      stage: 'document_processing',
      valid: successRate >= 0.5,
      extractedData,
      processingResults,
      successRate
    };
  }

  /**
   * Rule evaluation stage
   */
  async performRuleEvaluation(claim) {
    const ruleResults = await this.ruleEngine.evaluateClaim(claim);
    
    return {
      stage: 'rule_evaluation',
      valid: ruleResults.valid,
      severity: ruleResults.severity,
      ruleResults: ruleResults.results,
      stopPipeline: ruleResults.severity === 'high' && !ruleResults.valid
    };
  }

  /**
   * Fraud detection stage
   */
  async performFraudDetection(claim, patientHistory) {
    const fraudAnalysis = await this.fraudDetection.analyzeClaim(claim, patientHistory);
    
    return {
      stage: 'fraud_detection',
      valid: fraudAnalysis.riskScore < 0.8,
      riskScore: fraudAnalysis.riskScore,
      riskLevel: fraudAnalysis.riskLevel,
      indicators: fraudAnalysis.indicators,
      requiresReview: fraudAnalysis.requiresReview,
      stopPipeline: fraudAnalysis.riskScore >= 0.9
    };
  }

  /**
   * External verification stage
   */
  async performExternalVerification(claim, options) {
    const verificationResults = {
      eligibility: await this.verificationService.verifyEligibility(claim),
      provider: await this.verificationService.verifyProvider(claim),
      authorization: await this.verificationService.verifyAuthorization(claim)
    };
    
    const overallValid = Object.values(verificationResults).every(result => result.valid);
    
    return {
      stage: 'external_verification',
      valid: overallValid,
      results: verificationResults,
      stopPipeline: !overallValid
    };
  }

  /**
   * Final decision stage
   */
  async performFinalDecision(claim) {
    // This stage is handled by makeFinalDecision method
    return {
      stage: 'final_decision',
      valid: true,
      message: 'Final decision will be made based on all previous stages'
    };
  }

  /**
   * Notification stage
   */
  async performNotification(claim) {
    // This stage is handled by sendNotifications method
    return {
      stage: 'notification',
      valid: true,
      message: 'Notifications will be sent based on final decision'
    };
  }

  /**
   * Make final decision based on all pipeline results
   */
  async makeFinalDecision(pipelineResult) {
    const stages = pipelineResult.stages;
    
    // Check for critical failures
    const criticalFailures = Object.entries(stages).filter(([stage, result]) => 
      !result.valid && result.stopPipeline
    );
    
    if (criticalFailures.length > 0) {
      return {
        status: 'denied',
        reason: `Critical failure in stages: ${criticalFailures.map(([stage]) => stage).join(', ')}`,
        confidence: 1.0
      };
    }
    
    // Check for high fraud risk
    const fraudStage = stages.fraud_detection;
    if (fraudStage && fraudStage.riskScore >= 0.8) {
      return {
        status: fraudStage.riskScore >= 0.9 ? 'denied' : 'manual_review',
        reason: `High fraud risk detected (score: ${fraudStage.riskScore})`,
        confidence: fraudStage.riskScore
      };
    }
    
    // Check for rule violations
    const ruleStage = stages.rule_evaluation;
    if (ruleStage && !ruleStage.valid) {
      if (ruleStage.severity === 'high') {
        return {
          status: 'denied',
          reason: 'Critical rule violations detected',
          confidence: 0.9
        };
      } else {
        return {
          status: 'manual_review',
          reason: 'Rule violations require manual review',
          confidence: 0.7
        };
      }
    }
    
    // Check for verification failures
    const verificationStage = stages.external_verification;
    if (verificationStage && !verificationStage.valid) {
      return {
        status: 'denied',
        reason: 'External verification failed',
        confidence: 0.8
      };
    }
    
    // If all stages passed, approve the claim
    return {
      status: 'approved',
      reason: 'Claim passed all validation checks',
      confidence: 0.95
    };
  }

  /**
   * Validate data integrity
   */
  async validateDataIntegrity(claim) {
    const checks = [
      { field: 'totalAmount', type: 'number', required: true },
      { field: 'serviceDate', type: 'date', required: true },
      { field: 'patientId', type: 'string', required: true },
      { field: 'providerName', type: 'string', required: true }
    ];
    
    const errors = [];
    
    for (const check of checks) {
      const value = claim[check.field];
      
      if (check.required && (!value || value === '')) {
        errors.push(`${check.field} is required`);
        continue;
      }
      
      if (value && check.type === 'number' && isNaN(parseFloat(value))) {
        errors.push(`${check.field} must be a valid number`);
      }
      
      if (value && check.type === 'date' && isNaN(Date.parse(value))) {
        errors.push(`${check.field} must be a valid date`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate required fields
   */
  async validateRequiredFields(claim) {
    const requiredFields = [
      'patientId',
      'providerName',
      'serviceDate',
      'totalAmount',
      'diagnosisCodes',
      'procedureCodes'
    ];
    
    const missingFields = requiredFields.filter(field => 
      !claim[field] || claim[field].toString().trim() === ''
    );
    
    return {
      valid: missingFields.length === 0,
      missingFields
    };
  }

  /**
   * Validate basic business rules
   */
  async validateBasicBusinessRules(claim) {
    const rules = [];
    
    // Service date cannot be in the future
    const serviceDate = new Date(claim.serviceDate);
    if (serviceDate > new Date()) {
      rules.push('Service date cannot be in the future');
    }
    
    // Service date cannot be too old
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (serviceDate < oneYearAgo) {
      rules.push('Service date is too old (older than 1 year)');
    }
    
    // Amount must be positive
    const amount = parseFloat(claim.totalAmount);
    if (isNaN(amount) || amount <= 0) {
      rules.push('Total amount must be a positive number');
    }
    
    return {
      valid: rules.length === 0,
      rules
    };
  }

  /**
   * Helper methods
   */
  generatePipelineId() {
    return `pipeline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  async getClaim(claimId) {
    return new Promise((resolve, reject) => {
      this.db.get('SELECT * FROM insurance_claims WHERE id = ?', [claimId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async getPatientHistory(patientId) {
    return new Promise((resolve, reject) => {
      this.db.all(
        'SELECT * FROM insurance_claims WHERE patient_id = ? ORDER BY service_date DESC',
        [patientId],
        (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        }
      );
    });
  }

  async updateClaimStatus(claimId, decision) {
    return new Promise((resolve, reject) => {
      this.db.run(
        'UPDATE insurance_claims SET status = ?, processing_date = ?, denial_reason = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
        [decision.status, new Date().toISOString(), decision.reason, claimId],
        (err) => {
          if (err) reject(err);
          else resolve();
        }
      );
    });
  }

  async sendNotifications(claimId, pipelineResult) {
    // Implementation would depend on notification system
    console.log(`Notification sent for claim ${claimId}: ${pipelineResult.finalDecision.status}`);
  }

  async initializePipeline(pipelineId, claimId, options) {
    await this.monitoring.initializePipeline(pipelineId, claimId, options);
  }

  shouldStopPipeline(stage, error) {
    const criticalStages = ['initial_validation', 'rule_evaluation'];
    return criticalStages.includes(stage);
  }

  /**
   * Batch process multiple claims
   */
  async batchProcessClaims(claimIds, options = {}) {
    const results = [];
    
    for (const claimId of claimIds) {
      try {
        const result = await this.processClaim(claimId, options);
        results.push(result);
      } catch (error) {
        results.push({
          claimId,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Get pipeline statistics
   */
  async getPipelineStatistics() {
    return this.monitoring.getPipelineStatistics();
  }
}

module.exports = ClaimProcessingPipeline;
