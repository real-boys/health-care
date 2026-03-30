const express = require('express');
const { ehrIntegrationManager } = require('../services/ehrIntegrationManager');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/ehr-integration/systems
 * @desc    Get all available EHR systems
 * @access  Private
 */
router.get('/systems', authenticateToken, (req, res) => {
  try {
    const availableSystems = ehrIntegrationManager.getAvailableAdapters();
    res.json({
      success: true,
      systems: availableSystems,
      count: availableSystems.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/health
 * @desc    Get health status of all EHR integrations
 * @access  Private
 */
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const health = await ehrIntegrationManager.getIntegrationHealth();
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
 * @route   POST /api/ehr-integration/patient/search
 * @desc    Search for patient across all EHR systems
 * @access  Private
 */
router.post('/patient/search', authenticateToken, async (req, res) => {
  try {
    const { searchParams } = req.body;
    
    if (!searchParams) {
      return res.status(400).json({
        success: false,
        error: 'Search parameters required'
      });
    }

    const results = await ehrIntegrationManager.searchPatientAcrossSystems(searchParams);
    res.json({
      success: true,
      totalSystems: results.length,
      results
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/:system/patient/:patientId
 * @desc    Get comprehensive patient data from specific EHR system
 * @access  Private
 */
router.get('/:system/patient/:patientId', authenticateToken, async (req, res) => {
  try {
    const { system, patientId } = req.params;
    
    const result = await ehrIntegrationManager.getComprehensivePatientData(system, patientId);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/:system/patient/:patientId/medications
 * @desc    Get patient medications from specific EHR system
 * @access  Private
 */
router.get('/:system/patient/:patientId/medications', authenticateToken, async (req, res) => {
  try {
    const { system, patientId } = req.params;
    const adapter = ehrIntegrationManager.getAdapter(system);
    
    const medications = await adapter.getMedications(patientId);
    res.json({
      success: true,
      system,
      ...medications
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/:system/patient/:patientId/allergies
 * @desc    Get patient allergies from specific EHR system
 * @access  Private
 */
router.get('/:system/patient/:patientId/allergies', authenticateToken, async (req, res) => {
  try {
    const { system, patientId } = req.params;
    const adapter = ehrIntegrationManager.getAdapter(system);
    
    const allergies = await adapter.getAllergies(patientId);
    res.json({
      success: true,
      system,
      ...allergies
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/:system/patient/:patientId/observations
 * @desc    Get patient observations from specific EHR system
 * @access  Private
 */
router.get('/:system/patient/:patientId/observations', authenticateToken, async (req, res) => {
  try {
    const { system, patientId } = req.params;
    const { code, category, dateRange } = req.query;
    
    const adapter = ehrIntegrationManager.getAdapter(system);
    const params = {};
    
    if (code) params.code = code;
    if (category) params.category = category;
    
    const observations = await adapter.getObservations(patientId, params);
    res.json({
      success: true,
      system,
      ...observations
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/:system/patient/:patientId/conditions
 * @desc    Get patient conditions from specific EHR system
 * @access  Private
 */
router.get('/:system/patient/:patientId/conditions', authenticateToken, async (req, res) => {
  try {
    const { system, patientId } = req.params;
    const adapter = ehrIntegrationManager.getAdapter(system);
    
    const conditions = await adapter.getConditions(patientId);
    res.json({
      success: true,
      system,
      ...conditions
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ehr-integration/:system/sync/:patientId
 * @desc    Sync patient data from EHR to local database
 * @access  Private
 */
router.post('/:system/sync/:patientId', authenticateToken, async (req, res) => {
  try {
    const { system, patientId } = req.params;
    const options = req.body.options || {};
    
    const result = await ehrIntegrationManager.syncPatientData(system, patientId, options);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/ehr-integration/:system/batch-import
 * @desc    Batch import multiple patients from EHR
 * @access  Private
 */
router.post('/:system/batch-import', authenticateToken, async (req, res) => {
  try {
    const { system } = req.params;
    const { patientIds, options } = req.body;
    
    if (!patientIds || !Array.isArray(patientIds)) {
      return res.status(400).json({
        success: false,
        error: 'patientIds array is required'
      });
    }

    const result = await ehrIntegrationManager.batchImportPatients(system, patientIds, options);
    
    if (!result.success) {
      return res.status(400).json(result);
    }

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/ehr-integration/:system/test-connection
 * @desc    Test connection to specific EHR system
 * @access  Private
 */
router.get('/:system/test-connection', authenticateToken, async (req, res) => {
  try {
    const { system } = req.params;
    const adapter = ehrIntegrationManager.getAdapter(system);
    
    const result = await adapter.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
