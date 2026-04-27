/**
 * Advanced Machine Learning Service for Fraud Detection
 * Supplements the base rule engine with ML simulations
 */

class FraudDetectionMLService {
  constructor() {
    this.feedbackStore = []; // In-memory store for false positive feedback
    
    // Base knowledge for synthesizing pattern graph
    this.knownClusters = [
      { id: 'C1', type: 'upcoding_ring', suspicion: 0.85 },
      { id: 'C2', type: 'phantom_billing', suspicion: 0.92 }
    ];
  }

  /**
   * Simulate an Isolation Forest anomaly detection algorithm over a sliding window
   * In a real system, this would call a Python microservice or use a local ML library ONNX/TensorFlow.js
   */
  async calculateIsolationForestScore(claim, patientHistory) {
    // Simulated logic:
    // If the claim has a high amount AND very few similar claims exist in history,
    // isolation forest would isolate it faster (higher anomaly score).
    
    let score = 0.1; // Base low risk
    const amount = parseFloat(claim.totalAmount) || 0;
    
    if (amount > 10000) score += 0.3;
    if (amount > 50000) score += 0.3;
    
    if (patientHistory.length < 2) score += 0.1;
    if (claim.diagnosisCodes && claim.diagnosisCodes.split(',').length > 5) score += 0.2;
    
    // Add jitter
    score += (Math.random() * 0.1);

    return Math.min(score, 1.0);
  }

  /**
   * Generate Pattern Network data for visualization
   * Analyzes claims to identify clusters of suspicious activity
   */
  async getPatternNetwork(recentClaims) {
    const nodes = [];
    const links = [];
    
    // Create base generic nodes if no claims provided for demo purposes
    nodes.push({ id: 'Center', group: 0, label: 'High Risk Hub', size: 20 });
    
    const providers = new Set();
    const patients = new Set();

    if (recentClaims && recentClaims.length > 0) {
      recentClaims.forEach(claim => {
        if (claim.providerName) providers.add(claim.providerName);
        if (claim.patientId) patients.add(claim.patientId);
      });
      
      // Build nodes for providers
      Array.from(providers).forEach((provider, i) => {
        nodes.push({ id: `Prov_${i}`, group: 1, label: provider, size: 15 });
        // Link providers to the central suspicious hub randomly for visualization
        if (Math.random() > 0.5) {
          links.push({ source: `Prov_${i}`, target: 'Center', value: Math.random() * 10 });
        }
      });
      
      // Build nodes for patients
      Array.from(patients).forEach((patient, i) => {
        nodes.push({ id: `Pat_${i}`, group: 2, label: `Patient ${patient.substring(0,4)}`, size: 10 });
        // Link patients to random providers
        if (providers.size > 0) {
          const provIndex = Math.floor(Math.random() * providers.size);
          links.push({ source: `Pat_${i}`, target: `Prov_${provIndex}`, value: Math.random() * 5 });
        }
      });
    } else {
      // Mock data for dashboard empty state
      for(let i=0; i<5; i++) {
        nodes.push({ id: `Prov_${i}`, group: 1, label: `Suspicious Clinic ${i+1}`, size: 15 });
        links.push({ source: `Prov_${i}`, target: 'Center', value: Math.random() * 10 });
        for(let j=0; j<3; j++) {
           nodes.push({ id: `Pat_${i}_${j}`, group: 2, label: `Ident ${i}${j}`, size: 10 });
           links.push({ source: `Pat_${i}_${j}`, target: `Prov_${i}`, value: 2 });
        }
      }
    }

    return { nodes, links };
  }

  /**
   * Generates a Temporal Heatmap matrix (Hour of day x Day of week)
   * High values indicate unusual billing activity times (e.g., 3am on Sunday)
   */
  async getTemporalHeatmap(recentClaims) {
    const hours = 24;
    const days = 7; // 0 = Sunday, 6 = Saturday
    const matrix = Array(days).fill().map(() => Array(hours).fill(0));
    
    // Seed with normal baseline activity pattern (weekday 8-5 is highest)
    for(let d=1; d<=5; d++) {
      for(let h=8; h<=17; h++) {
        matrix[d][h] = Math.floor(Math.random() * 50) + 100;
      }
    }
    
    // Add real data if provided
    if (recentClaims && recentClaims.length > 0) {
      recentClaims.forEach(claim => {
        const date = new Date(claim.submissionDate || claim.serviceDate || Date.now());
        const day = date.getDay();
        const hour = date.getHours();
        matrix[day][hour] += 10; // Boost value for actual claims
      });
    }

    // Add suspicious clusters for anomaly detection visualization showcase
    // e.g. Sunday at 2am
    matrix[0][2] += 250; 
    matrix[0][3] += 200;
    
    return matrix;
  }

  /**
   * Retrieve False Positive records
   */
  async getFalsePositives() {
    return this.feedbackStore;
  }

  /**
   * Record Feedback from an Investigator
   * Used to retrain/tune the parameters later
   */
  async recordFeedback(claimId, isFraud, reason, investigatorId) {
    const feedbackRecord = {
      id: `fb_${Date.now()}_${Math.random().toString(36).substring(2,7)}`,
      claimId,
      isFraud, // true if actually fraud, false if false-positive
      reason,
      investigatorId,
      timestamp: new Date().toISOString()
    };
    
    this.feedbackStore.push(feedbackRecord);
    return feedbackRecord;
  }

  /**
   * Get simulated model performance statistics
   * Realistically this would be calculated from a test set
   */
  async getModelStats() {
    const falsePositives = this.feedbackStore.filter(f => f.isFraud === false).length;
    const truePositives = this.feedbackStore.filter(f => f.isFraud === true).length;
    const totalFeedback = this.feedbackStore.length;
    
    // Base stats
    let precision = 0.85;
    let recall = 0.92;
    let f1 = 0.88;
    let auc = 0.94;
    
    // Adjust slightly based on recorded feedback
    if (totalFeedback > 0) {
      // Very naive adjustment
      const fpRatio = falsePositives / totalFeedback;
      precision = Math.max(0.5, 0.95 - (fpRatio * 0.5));
    }
    
    return {
      precision,
      recall,
      f1Score: f1,
      aucRoc: auc,
      lastTrainedAt: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
      falsePositivesRecorded: falsePositives,
      totalFeedbackProcessed: totalFeedback
    };
  }
}

module.exports = FraudDetectionMLService;
