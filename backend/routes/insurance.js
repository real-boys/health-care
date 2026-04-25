const express = require('express');
const { insuranceIntegrationService } = require('../services/insuranceIntegrationService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/insurance/providers
 * @desc    Get all available insurance providers
 * @access  Private
 */
router.get('/providers', authenticateToken, (req, res) => {
  try {
    const providers = insuranceIntegrationService.getAvailableProviders();
    res.json({
      success: true,
      providers,
      count: providers.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/insurance/health
 * @desc    Get health status of all insurance integrations
 * @access  Private
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await insuranceIntegrationService.getIntegrationHealth();
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/insurance/:providerId/eligibility
 * @desc    Verify patient eligibility and coverage
 * @access  Private
 */
router.post('/:providerId/eligibility', authenticateToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    const { patientInfo, serviceDate } = req.body;

    if (!patientInfo || !serviceDate) {
      return res.status(400).json({
        success: false,
        error: 'Patient info and service date required'
      });
    }

    const result = await insuranceIntegrationService.verifyEligibility(providerId, patientInfo, serviceDate);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/insurance/:providerId/claim
 * @desc    Submit insurance claim
 * @access  Private
 */
router.post('/:providerId/claim', authenticateToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    const claimData = req.body;

    // Validate required claim fields
    const requiredFields = ['memberId', 'providerNPI', 'totalAmount'];
    const missingFields = requiredFields.filter(field => !claimData[field]);

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missingFields.join(', ')}`
      });
    }

    const result = await insuranceIntegrationService.submitClaim(providerId, claimData);
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/insurance/:providerId/claim/:claimId
 * @desc    Get claim status
 * @access  Private
 */
router.get('/:providerId/claim/:claimId', authenticateToken, async (req, res) => {
  try {
    const { providerId, claimId } = req.params;
    
    const result = await insuranceIntegrationService.getClaimStatus(providerId, claimId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/insurance/:providerId/eob/:claimId
 * @desc    Get Explanation of Benefits (EOB)
 * @access  Private
 */
router.get('/:providerId/eob/:claimId', authenticateToken, async (req, res) => {
  try {
    const { providerId, claimId } = req.params;
    
    const result = await insuranceIntegrationService.getExplanationOfBenefits(providerId, claimId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/insurance/:providerId/coverage/:patientId
 * @desc    Get patient coverage information
 * @access  Private
 */
router.get('/:providerId/coverage/:patientId', authenticateToken, async (req, res) => {
  try {
    const { providerId, patientId } = req.params;
    
    const result = await insuranceIntegrationService.getCoverage(providerId, patientId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/insurance/:providerId/test-connection
 * @desc    Test connection to insurance provider
 * @access  Private
 */
router.get('/:providerId/test-connection', authenticateToken, async (req, res) => {
  try {
    const { providerId } = req.params;
    
    const result = await insuranceIntegrationService.testProviderConnection(providerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
