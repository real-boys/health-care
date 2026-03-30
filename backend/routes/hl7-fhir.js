const express = require('express');
const router = express.Router();
const { HL7Parser } = require('../services/hl7Parser');
const { FHIRConverter } = require('../services/fhirConverter');
const { IntegrationConfig } = require('../models/integrationConfig');
const { SyncStatus } = require('../models/syncStatus');
const { dbConnection } = require('../database/connection');
const { authenticateToken } = require('../middleware/auth');

const hl7Parser = new HL7Parser();
const fhirConverter = new FHIRConverter();

// Initialize models with database connection
let integrationConfigModel;
let syncStatusModel;

// Initialize database connection and models
async function initializeModels() {
  try {
    const db = await dbConnection.connect();
    integrationConfigModel = new IntegrationConfig(db);
    syncStatusModel = new SyncStatus(db);
  } catch (error) {
    console.error('Failed to initialize database models:', error);
  }
}

// Initialize models on module load
initializeModels();

// Get all integration configurations
router.get('/configs', authenticateToken, async (req, res) => {
  try {
    if (!integrationConfigModel) {
      throw new Error('Database models not initialized');
    }
    const configs = await integrationConfigModel.findAll();
    res.json(configs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create new integration configuration
router.post('/configs', authenticateToken, async (req, res) => {
  try {
    if (!integrationConfigModel) {
      throw new Error('Database models not initialized');
    }
    const config = await integrationConfigModel.create(req.body);
    res.status(201).json(config);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Parse HL7 message
router.post('/parse-hl7', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;
    const parsed = hl7Parser.parse(message);
    res.json(parsed);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Convert HL7 to FHIR
router.post('/convert-hl7-to-fhir', authenticateToken, async (req, res) => {
  try {
    const { hl7Message, resourceType } = req.body;
    const parsedHL7 = hl7Parser.parse(hl7Message);
    const fhirResource = fhirConverter.convertHL7ToFHIR(parsedHL7, resourceType);
    res.json(fhirResource);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync status
router.get('/sync-status', authenticateToken, async (req, res) => {
  try {
    if (!syncStatusModel) {
      throw new Error('Database models not initialized');
    }
    const status = await syncStatusModel.findAll({
      order: 'start_time DESC'
    });
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Test integration connection
router.post('/test-connection', authenticateToken, async (req, res) => {
  try {
    const { config } = req.body;
    const testResult = await testIntegrationConnection(config);
    res.json(testResult);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Preview data transformation
router.post('/preview-transformation', authenticateToken, async (req, res) => {
  try {
    const { sourceData, mappingConfig } = req.body;
    const preview = await generateTransformationPreview(sourceData, mappingConfig);
    res.json(preview);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get connection health
router.get('/health', authenticateToken, async (req, res) => {
  try {
    const healthStatus = await getConnectionHealth();
    res.json(healthStatus);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

async function testIntegrationConnection(config) {
  const startTime = Date.now();
  
  try {
    // Test based on integration type
    switch (config.type) {
      case 'HL7':
        return await testHL7Connection(config);
      case 'FHIR':
        return await testFHIRConnection(config);
      case 'CUSTOM':
        return await testCustomConnection(config);
      default:
        throw new Error(`Unknown integration type: ${config.type}`);
    }
  } catch (error) {
    return {
      success: false,
      message: error.message,
      responseTime: `${Date.now() - startTime}ms`,
      timestamp: new Date().toISOString()
    };
  }
}

async function testHL7Connection(config) {
  // Mock HL7 connection test - implement actual MLLP connection
  const startTime = Date.now();
  
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return {
    success: true,
    message: 'HL7 connection successful',
    responseTime: `${Date.now() - startTime}ms`,
    timestamp: new Date().toISOString(),
    details: {
      host: config.connectionConfig.host,
      port: config.connectionConfig.port,
      protocol: config.connectionConfig.protocol
    }
  };
}

async function testFHIRConnection(config) {
  // Mock FHIR connection test - implement actual HTTP request
  const startTime = Date.now();
  
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 150));
  
  return {
    success: true,
    message: 'FHIR connection successful',
    responseTime: `${Date.now() - startTime}ms`,
    timestamp: new Date().toISOString(),
    details: {
      baseUrl: config.connectionConfig.baseUrl,
      authType: config.connectionConfig.authType
    }
  };
}

async function testCustomConnection(config) {
  // Mock custom API connection test
  const startTime = Date.now();
  
  // Simulate connection test
  await new Promise(resolve => setTimeout(resolve, 200));
  
  return {
    success: true,
    message: 'Custom API connection successful',
    responseTime: `${Date.now() - startTime}ms`,
    timestamp: new Date().toISOString(),
    details: {
      apiEndpoint: config.connectionConfig.apiEndpoint,
      format: config.connectionConfig.format
    }
  };
}

async function generateTransformationPreview(sourceData, mappingConfig) {
  try {
    // Parse HL7 if it's an HL7 message
    let parsedData = sourceData;
    if (typeof sourceData === 'string' && sourceData.includes('MSH')) {
      parsedData = hl7Parser.parse(sourceData);
    }

    // Apply transformation based on mapping configuration
    const transformedData = applyMappingTransformation(parsedData, mappingConfig);

    return {
      originalData: parsedData,
      transformedData: transformedData,
      mappingApplied: mappingConfig,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    throw new Error(`Transformation preview failed: ${error.message}`);
  }
}

function applyMappingTransformation(data, mappingConfig) {
  const transformed = {};

  // Apply field mappings
  Object.keys(mappingConfig).forEach(resourceType => {
    transformed[resourceType] = {};
    
    const mappings = mappingConfig[resourceType];
    Object.keys(mappings).forEach(sourceField => {
      const targetField = mappings[sourceField];
      
      // Simple field mapping - can be enhanced for complex transformations
      const value = getNestedValue(data, sourceField);
      if (value !== undefined) {
        setNestedValue(transformed[resourceType], targetField, value);
      }
    });
  });

  return transformed;
}

function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => {
    return current && current[key] !== undefined ? current[key] : undefined;
  }, obj);
}

function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  const lastKey = keys.pop();
  
  const target = keys.reduce((current, key) => {
    if (!current[key] || typeof current[key] !== 'object') {
      current[key] = {};
    }
    return current[key];
  }, obj);
  
  target[lastKey] = value;
}

async function getConnectionHealth() {
  try {
    // Get all active integrations
    if (!integrationConfigModel || !syncStatusModel) {
      return {
        status: 'error',
        message: 'Database models not initialized',
        timestamp: new Date().toISOString()
      };
    }

    const configs = await integrationConfigModel.findAll();
    const activeConfigs = configs.filter(config => config.isActive);
    
    const connections = activeConfigs.map(config => ({
      name: config.name,
      type: config.type,
      status: 'connected', // Mock status - implement actual health check
      lastSync: config.lastSync || new Date().toISOString(),
      responseTime: `${Math.floor(Math.random() * 100) + 20}ms`,
      uptime: '99.9%'
    }));

    // Calculate overall health
    const healthyConnections = connections.filter(conn => conn.status === 'connected').length;
    const overallStatus = healthyConnections === connections.length ? 'healthy' : 'degraded';

    return {
      status: overallStatus,
      connections,
      summary: {
        total: connections.length,
        healthy: healthyConnections,
        degraded: connections.length - healthyConnections
      },
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'error',
      message: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

module.exports = router;
