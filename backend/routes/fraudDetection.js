const express = require('express');
const router = express.Router();
const FraudDetectionService = require('../services/fraudDetection');

const fraudService = new FraudDetectionService();

// Mock database of claims for batch testing, demo, and dashboard initialization
const MOCK_CLAIMS = [
  { id: 'C001', claimNumber: 'CLM-9901', providerName: 'Dr. Smith', patientId: 'P001', serviceDate: '2024-01-15', submissionDate: '2024-01-16', totalAmount: 75000, diagnosisCodes: 'Z00.00' },
  { id: 'C002', claimNumber: 'CLM-9902', providerName: 'City Hospital', patientId: 'P002', serviceDate: '2024-01-14', submissionDate: '2024-01-14', totalAmount: 4500, diagnosisCodes: 'J01.90' },
  { id: 'C003', claimNumber: 'CLM-9903', providerName: 'Dr. Jones', patientId: 'P003', serviceDate: '2024-01-10', submissionDate: '2024-02-15', totalAmount: 18000, diagnosisCodes: 'R07.8,R06.02' },
  { id: 'C004', claimNumber: 'CLM-9904', providerName: 'Suspicious Clinic', patientId: 'P004', serviceDate: '2024-01-12', submissionDate: '2024-01-12', totalAmount: 95000, diagnosisCodes: 'M54.5,Z01.00,R07.8,R06.02,E11.9,I10,J45.909,K21.9' },
  { id: 'C005', claimNumber: 'CLM-9905', providerName: 'QuickCare', patientId: 'P005', serviceDate: '2024-01-21', submissionDate: '2024-01-21', totalAmount: 150, diagnosisCodes: 'J00' }
];

const MOCK_CASES = [
  { id: 'CASE-001', claimId: 'C003', riskLevel: 'high', status: 'investigating', assignee: 'Investigator A', createdAt: '2024-02-16T10:00:00Z', notes: 'Delayed submission and unusual diagnosis combo' },
  { id: 'CASE-002', claimId: 'C004', riskLevel: 'very_high', status: 'open', assignee: 'Unassigned', createdAt: '2024-01-13T08:30:00Z', notes: 'Upcoding suspected' },
  { id: 'CASE-003', claimId: 'C001', riskLevel: 'high', status: 'resolved', assignee: 'Investigator B', createdAt: '2024-01-17T09:15:00Z', notes: 'Valid high cost surgery. False positive.' }
];

/**
 * @route POST /api/fraud/analyze
 * @desc Analyze a single claim for fraud indicators
 */
router.post('/analyze', async (req, res) => {
  try {
    const { claim, patientHistory = [] } = req.body;
    
    if (!claim) {
      return res.status(400).json({ error: 'Claim data is required' });
    }

    // Step 1: Base rule engine analysis
    const baseAnalysis = await fraudService.analyzeClaim(claim, patientHistory);
    
    // Step 2: ML Ensemble scoring override
    const ensembleScore = await fraudService.calculateEnsembleScore(claim, patientHistory, baseAnalysis.riskScore);
    baseAnalysis.riskScore = ensembleScore;
    baseAnalysis.riskLevel = fraudService.determineRiskLevel(ensembleScore);
    baseAnalysis.requiresReview = ensembleScore >= fraudService.modelConfig.threshold;

    res.json(baseAnalysis);
  } catch (error) {
    console.error('Error analyzing claim:', error);
    res.status(500).json({ error: 'Failed to analyze claim' });
  }
});

/**
 * @route POST /api/fraud/batch
 * @desc Analyze multiple claims
 */
router.post('/batch', async (req, res) => {
  try {
    const { claimsWithHistory = [] } = req.body;
    // In a real app we'd map this and call ensemble scoring for each, 
    // but the service has a batchAnalyze we will supplement here
    const results = await fraudService.batchAnalyze(claimsWithHistory);
    
    // Apply ensemble processing over the results
    for (let i = 0; i < results.length; i++) {
        if (!results[i].error) {
           const ensembleScore = await fraudService.calculateEnsembleScore(claimsWithHistory[i].claim, claimsWithHistory[i].patientHistory, results[i].riskScore);
           results[i].riskScore = ensembleScore;
           results[i].riskLevel = fraudService.determineRiskLevel(ensembleScore);
           results[i].requiresReview = ensembleScore >= fraudService.modelConfig.threshold;
        }
    }

    res.json(results);
  } catch (error) {
    console.error('Error batch analyzing claims:', error);
    res.status(500).json({ error: 'Failed to batch analyze claims' });
  }
});

/**
 * @route GET /api/fraud/dashboard
 * @desc Get KPI summary for the fraud dashboard
 */
router.get('/dashboard', async (req, res) => {
  try {
    const stats = await fraudService.getModelStatistics();
    
    // Mock standard KPI values
    res.json({
      kpis: {
        totalAnalyzed: 15420,
        highRisk: 423,
        underInvestigation: 85,
        resolved: 312,
        estimatedSavings: 1250000
      },
      modelPerformance: stats.performanceMetrics,
      // Trend over the last 7 days (Mocked)
      riskTrend: [
        { date: '2024-03-21', averageScore: 0.12, highRiskCount: 45 },
        { date: '2024-03-22', averageScore: 0.14, highRiskCount: 52 },
        { date: '2024-03-23', averageScore: 0.11, highRiskCount: 38 },
        { date: '2024-03-24', averageScore: 0.10, highRiskCount: 22 },
        { date: '2024-03-25', averageScore: 0.15, highRiskCount: 61 },
        { date: '2024-03-26', averageScore: 0.18, highRiskCount: 89 },
        { date: '2024-03-27', averageScore: 0.16, highRiskCount: 74 }
      ],
      // Distribution for pie chart
      riskDistribution: [
         { name: 'Very High', value: 89 },
         { name: 'High', value: 334 },
         { name: 'Medium', value: 1250 },
         { name: 'Low/Very Low', value: 13747 }
      ]
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch dashboard data' });
  }
});

/**
 * @route GET /api/fraud/alerts
 * @desc Get paginated high-risk alerts
 */
router.get('/alerts', async (req, res) => {
  try {
     // Generate some live alerts by running the mock claims
     const alerts = [];
     for(const claim of MOCK_CLAIMS) {
         const analysis = await fraudService.analyzeClaim(claim, []);
         const score = await fraudService.calculateEnsembleScore(claim, [], analysis.riskScore);
         if (score >= fraudService.modelConfig.threshold) {
             alerts.push({
                 id: `ALT-${claim.id}`,
                 claimId: claim.id,
                 providerName: claim.providerName,
                 riskLevel: fraudService.determineRiskLevel(score),
                 score: parseFloat(score.toFixed(2)),
                 indicators: analysis.indicators,
                 timestamp: new Date().toISOString()
             });
         }
     }
     
     // Add a couple of synthetic ones for volume
     alerts.push({
         id: 'ALT-999', claimId: 'SYNC-999', providerName: 'Dr. Jekyll', riskLevel: 'high', score: 0.78, timestamp: new Date(Date.now() - 3600000).toISOString(),
         indicators: [{type: 'frequency_anomaly', description: 'Unusually high volume', severity: 'high'}]
     });

     res.json(alerts.sort((a,b) => b.score - a.score));
  } catch(error) {
     res.status(500).json({ error: 'Failed to get alerts' });
  }
});

/**
 * @route GET /api/fraud/cases
 * @desc Get case management queue
 */
router.get('/cases', (req, res) => {
   res.json(MOCK_CASES);
});

/**
 * @route PATCH /api/fraud/cases/:id
 * @desc Update case status
 */
router.patch('/cases/:id', (req, res) => {
   const caseId = req.params.id;
   const update = req.body;
   const caseIndex = MOCK_CASES.findIndex(c => c.id === caseId);
   
   if (caseIndex === -1) {
       return res.status(404).json({ error: 'Case not found' });
   }
   
   MOCK_CASES[caseIndex] = { ...MOCK_CASES[caseIndex], ...update };
   res.json(MOCK_CASES[caseIndex]);
});

/**
 * @route GET /api/fraud/patterns
 * @desc Get pattern network and heatmap data
 */
router.get('/patterns', async (req, res) => {
   try {
       const network = await fraudService.getNetworkGraphData(MOCK_CLAIMS);
       const heatmap = await fraudService.getHeatmapData(MOCK_CLAIMS);
       
       res.json({
           network,
           heatmap
       });
   } catch(error) {
       console.error(error);
       res.status(500).json({ error: 'Failed to generate pattern data' });
   }
});

/**
 * @route GET /api/fraud/model-stats
 * @desc Get model performance metrics
 */
router.get('/model-stats', async (req, res) => {
   try {
       const stats = await fraudService.getModelStatistics();
       
       // Add extra charting data for frontend
       stats.accuracyTrend = [
           { day: '-30d', accuracy: 0.89 },
           { day: '-20d', accuracy: 0.90 },
           { day: '-10d', accuracy: 0.92 },
           { day: 'Now', accuracy: 0.94 }
       ];
       
       res.json(stats);
   } catch(error) {
       res.status(500).json({ error: 'Failed to get stats' });
   }
});

/**
 * @route POST /api/fraud/feedback
 * @desc Submit false-positive feedback
 */
router.post('/feedback', async (req, res) => {
   try {
       const { claimId, reason, investigatorId = 'System_User' } = req.body;
       if (!claimId || !reason) {
           return res.status(400).json({ error: 'ClaimId and reason required' });
       }
       
       const feedback = await fraudService.recordFalsePositiveFeedback(claimId, reason, investigatorId);
       
       // If giving feedback triggers resolution of case, update the mock case
       const caseIndex = MOCK_CASES.findIndex(c => c.claimId === claimId);
       if (caseIndex !== -1) {
          MOCK_CASES[caseIndex].status = 'resolved';
          MOCK_CASES[caseIndex].notes += ` [Feedback: ${reason}]`;
       }

       res.status(201).json({ success: true, feedback });
   } catch(error) {
       res.status(500).json({ error: 'Failed to record feedback' });
   }
});

module.exports = router;
