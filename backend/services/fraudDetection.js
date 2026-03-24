/**
 * Fraud Detection Service using Machine Learning
 * Implements various ML techniques to detect potentially fraudulent claims
 */

const axios = require('axios');

class FraudDetectionService {
  constructor() {
    this.modelConfig = {
      threshold: 0.7,
      features: [
        'amount_anomaly',
        'frequency_anomaly',
        'provider_anomaly',
        'diagnosis_anomaly',
        'temporal_anomaly',
        'geographic_anomaly'
      ]
    };
    this.initializeModel();
  }

  /**
   * Initialize the fraud detection model
   */
  initializeModel() {
    // In a real implementation, this would load a trained ML model
    // For now, we'll implement rule-based fraud detection
    this.fraudRules = {
      highAmountThreshold: 50000,
      frequentClaimThreshold: 10,
      unusualDiagnosisCombinations: [
        ['Z00.00', 'Z01.00'], // Routine checkup with special exam
        ['R07.8', 'R06.02']   // Chest pain with shortness of breath
      ]
    };
  }

  /**
   * Analyze a claim for fraud indicators
   */
  async analyzeClaim(claim, patientHistory = []) {
    const features = await this.extractFeatures(claim, patientHistory);
    const riskScore = await this.calculateRiskScore(features);
    const fraudIndicators = await this.identifyFraudIndicators(features);
    
    return {
      claimId: claim.id || claim.claimNumber,
      riskScore,
      riskLevel: this.determineRiskLevel(riskScore),
      indicators: fraudIndicators,
      features,
      analyzedAt: new Date().toISOString(),
      requiresReview: riskScore >= this.modelConfig.threshold
    };
  }

  /**
   * Extract features from claim and patient history
   */
  async extractFeatures(claim, patientHistory) {
    const features = {};

    // Amount anomaly detection
    features.amount_anomaly = await this.detectAmountAnomaly(claim, patientHistory);

    // Frequency anomaly detection
    features.frequency_anomaly = await this.detectFrequencyAnomaly(claim, patientHistory);

    // Provider anomaly detection
    features.provider_anomaly = await this.detectProviderAnomaly(claim, patientHistory);

    // Diagnosis anomaly detection
    features.diagnosis_anomaly = await this.detectDiagnosisAnomaly(claim);

    // Temporal anomaly detection
    features.temporal_anomaly = await this.detectTemporalAnomaly(claim, patientHistory);

    // Geographic anomaly detection
    features.geographic_anomaly = await this.detectGeographicAnomaly(claim, patientHistory);

    return features;
  }

  /**
   * Detect amount-based anomalies
   */
  async detectAmountAnomaly(claim, patientHistory) {
    const amount = parseFloat(claim.totalAmount) || 0;
    
    // Check for unusually high amounts
    if (amount > this.fraudRules.highAmountThreshold) {
      return {
        score: 0.8,
        reason: `Claim amount ($${amount}) exceeds high threshold ($${this.fraudRules.highAmountThreshold})`
      };
    }

    // Check against patient's historical average
    if (patientHistory.length > 0) {
      const historicalAmounts = patientHistory
        .map(c => parseFloat(c.total_amount) || 0)
        .filter(a => a > 0);
      
      if (historicalAmounts.length > 0) {
        const avgAmount = historicalAmounts.reduce((a, b) => a + b, 0) / historicalAmounts.length;
        const stdDev = this.calculateStandardDeviation(historicalAmounts, avgAmount);
        
        if (amount > avgAmount + (3 * stdDev)) {
          return {
            score: 0.6,
            reason: `Claim amount is significantly higher than patient's historical average`
          };
        }
      }
    }

    return { score: 0.1, reason: 'Amount appears normal' };
  }

  /**
   * Detect frequency-based anomalies
   */
  async detectFrequencyAnomaly(claim, patientHistory) {
    const recentClaims = patientHistory.filter(c => {
      const claimDate = new Date(c.service_date || c.submission_date);
      const threeMonthsAgo = new Date();
      threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
      return claimDate >= threeMonthsAgo;
    });

    if (recentClaims.length >= this.fraudRules.frequentClaimThreshold) {
      return {
        score: 0.7,
        reason: `Patient has submitted ${recentClaims.length} claims in the last 3 months`
      };
    }

    // Check for multiple claims on the same day
    const sameDayClaims = recentClaims.filter(c => {
      const claimDate = new Date(c.service_date || c.submission_date);
      const currentClaimDate = new Date(claim.serviceDate);
      return claimDate.toDateString() === currentClaimDate.toDateString();
    });

    if (sameDayClaims.length > 2) {
      return {
        score: 0.5,
        reason: `Multiple claims submitted for the same service date`
      };
    }

    return { score: 0.1, reason: 'Claim frequency appears normal' };
  }

  /**
   * Detect provider-based anomalies
   */
  async detectProviderAnomaly(claim, patientHistory) {
    const providerClaims = patientHistory.filter(c => 
      c.provider_name === claim.providerName
    );

    // Check for provider shopping
    const uniqueProviders = new Set(patientHistory.map(c => c.provider_name));
    if (uniqueProviders.size > 5 && patientHistory.length > 10) {
      return {
        score: 0.4,
        reason: 'Patient has used many different providers'
      };
    }

    // Check for high concentration with one provider
    if (providerClaims.length > patientHistory.length * 0.8 && patientHistory.length > 5) {
      return {
        score: 0.3,
        reason: 'High concentration of claims with single provider'
      };
    }

    return { score: 0.1, reason: 'Provider pattern appears normal' };
  }

  /**
   * Detect diagnosis-based anomalies
   */
  async detectDiagnosisAnomaly(claim) {
    if (!claim.diagnosisCodes) {
      return { score: 0.1, reason: 'No diagnosis codes to analyze' };
    }

    const diagnoses = claim.diagnosisCodes.split(',').map(d => d.trim());
    
    // Check for unusual diagnosis combinations
    for (const unusualCombo of this.fraudRules.unusualDiagnosisCombinations) {
      if (unusualCombo.every(diag => diagnoses.includes(diag))) {
        return {
          score: 0.6,
          reason: `Unusual diagnosis combination detected: ${unusualCombo.join(', ')}`
        };
      }
    }

    // Check for V-codes (supplementary classification) as primary diagnosis
    const vCodes = diagnoses.filter(d => d.startsWith('V'));
    if (vCodes.length > 0 && diagnoses.length === 1) {
      return {
        score: 0.3,
        reason: 'V-code used as sole diagnosis'
      };
    }

    return { score: 0.1, reason: 'Diagnosis codes appear normal' };
  }

  /**
   * Detect temporal-based anomalies
   */
  async detectTemporalAnomaly(claim, patientHistory) {
    const serviceDate = new Date(claim.serviceDate);
    
    // Check for weekend claims (unusual for most medical services)
    if (serviceDate.getDay() === 0 || serviceDate.getDay() === 6) {
      return {
        score: 0.2,
        reason: 'Service date falls on weekend'
      };
    }

    // Check for claims submitted long after service date
    const submissionDate = new Date(claim.submissionDate || Date.now());
    const daysDifference = (submissionDate - serviceDate) / (1000 * 60 * 60 * 24);
    
    if (daysDifference > 90) {
      return {
        score: 0.4,
        reason: `Claim submitted ${Math.round(daysDifference)} days after service date`
      };
    }

    return { score: 0.1, reason: 'Temporal pattern appears normal' };
  }

  /**
   * Detect geographic-based anomalies
   */
  async detectGeographicAnomaly(claim, patientHistory) {
    // This would typically involve geographic analysis
    // For now, return a placeholder
    return { score: 0.1, reason: 'Geographic analysis not implemented' };
  }

  /**
   * Calculate overall risk score from features
   */
  async calculateRiskScore(features) {
    const weights = {
      amount_anomaly: 0.25,
      frequency_anomaly: 0.20,
      provider_anomaly: 0.15,
      diagnosis_anomaly: 0.20,
      temporal_anomaly: 0.10,
      geographic_anomaly: 0.10
    };

    let weightedScore = 0;
    for (const [feature, data] of Object.entries(features)) {
      weightedScore += (data.score || 0) * (weights[feature] || 0);
    }

    return Math.min(weightedScore, 1.0);
  }

  /**
   * Identify specific fraud indicators
   */
  async identifyFraudIndicators(features) {
    const indicators = [];

    for (const [featureName, featureData] of Object.entries(features)) {
      if (featureData.score > 0.5) {
        indicators.push({
          type: featureName,
          severity: featureData.score > 0.7 ? 'high' : 'medium',
          description: featureData.reason
        });
      }
    }

    return indicators;
  }

  /**
   * Determine risk level based on score
   */
  determineRiskLevel(score) {
    if (score >= 0.8) return 'very_high';
    if (score >= 0.6) return 'high';
    if (score >= 0.4) return 'medium';
    if (score >= 0.2) return 'low';
    return 'very_low';
  }

  /**
   * Calculate standard deviation
   */
  calculateStandardDeviation(values, mean) {
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    const avgSquaredDiff = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
    return Math.sqrt(avgSquaredDiff);
  }

  /**
   * Batch analyze multiple claims
   */
  async batchAnalyze(claimsWithHistory) {
    const results = [];
    
    for (const { claim, patientHistory } of claimsWithHistory) {
      try {
        const analysis = await this.analyzeClaim(claim, patientHistory);
        results.push(analysis);
      } catch (error) {
        results.push({
          claimId: claim.id || claim.claimNumber,
          error: error.message,
          analyzedAt: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Update model configuration
   */
  updateModelConfig(newConfig) {
    this.modelConfig = { ...this.modelConfig, ...newConfig };
  }

  /**
   * Get model statistics
   */
  getModelStatistics() {
    return {
      config: this.modelConfig,
      fraudRules: this.fraudRules,
      version: '1.0.0'
    };
  }
}

module.exports = FraudDetectionService;
