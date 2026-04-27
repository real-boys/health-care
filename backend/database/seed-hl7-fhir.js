const { dbConnection } = require('./connection');
const { IntegrationConfig } = require('../models/integrationConfig');
const { SyncStatus } = require('../models/syncStatus');

async function seedHL7FHIRData() {
  try {
    console.log('Seeding HL7/FHIR integration data...');
    
    const db = await dbConnection.connect();
    const integrationConfigModel = new IntegrationConfig(db);
    const syncStatusModel = new SyncStatus(db);

    // Sample integration configurations
    const sampleConfigs = [
      {
        name: 'Epic Systems HL7 Interface',
        type: 'HL7',
        description: 'Primary HL7 interface for Epic EMR system',
        connectionConfig: {
          host: 'epic.hospital.local',
          port: 2575,
          protocol: 'MLLP',
          timeout: 30000,
          encoding: 'UTF-8'
        },
        mappingConfig: {
          patient: {
            'PID.5': 'name',
            'PID.7': 'birthDate',
            'PID.8': 'gender',
            'PID.11': 'address'
          }
        },
        isActive: true,
        syncFrequency: 'REAL_TIME'
      },
      {
        name: 'FHIR Server Integration',
        type: 'FHIR',
        description: 'FHIR R4 server for clinical data exchange',
        connectionConfig: {
          baseUrl: 'https://fhir.hospital.local/r4',
          authType: 'Bearer',
          token: 'sample-api-token',
          timeout: 15000
        },
        mappingConfig: {
          patient: {
            'identifier': 'id',
            'name': 'name',
            'birthDate': 'birthDate'
          }
        },
        isActive: true,
        syncFrequency: 'HOURLY'
      },
      {
        name: 'Lab System Interface',
        type: 'CUSTOM',
        description: 'Custom interface for laboratory information system',
        connectionConfig: {
          apiEndpoint: 'https://lab.hospital.local/api',
          apiKey: 'sample-api-key',
          format: 'JSON',
          headers: {
            'Content-Type': 'application/json'
          }
        },
        mappingConfig: {
          observation: {
            'testCode': 'code',
            'result': 'value',
            'units': 'unit'
          }
        },
        isActive: true,
        syncFrequency: 'DAILY'
      }
    ];

    // Insert sample configurations
    for (const config of sampleConfigs) {
      try {
        const existing = await integrationConfigModel.findAll();
        const exists = existing.some(c => c.name === config.name);
        
        if (!exists) {
          await integrationConfigModel.create(config);
          console.log(`Created integration config: ${config.name}`);
        } else {
          console.log(`Integration config already exists: ${config.name}`);
        }
      } catch (error) {
        console.error(`Error creating config ${config.name}:`, error.message);
      }
    }

    // Get the created configs to add sample sync status
    const configs = await integrationConfigModel.findAll();
    
    // Sample sync status data
    const sampleSyncStatus = [
      {
        integrationId: configs[0]?.id || 1,
        status: 'COMPLETED',
        messageType: 'ADT^A01',
        sourceSystem: 'Epic EMR',
        targetSystem: 'Healthcare Platform',
        recordCount: 150,
        processedCount: 150,
        errorCount: 0,
        startTime: new Date(Date.now() - 3600000).toISOString(), // 1 hour ago
        endTime: new Date(Date.now() - 3000000).toISOString(), // 50 minutes ago
        duration: 300000, // 5 minutes in ms
        metadata: {
          version: '2.5',
          facility: 'Main Hospital'
        }
      },
      {
        integrationId: configs[1]?.id || 2,
        status: 'IN_PROGRESS',
        messageType: 'Patient',
        sourceSystem: 'FHIR Server',
        targetSystem: 'Healthcare Platform',
        recordCount: 75,
        processedCount: 45,
        errorCount: 0,
        startTime: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
        endTime: null,
        duration: null,
        metadata: {
          resourceType: 'Patient',
          pageSize: 25
        }
      },
      {
        integrationId: configs[2]?.id || 3,
        status: 'FAILED',
        messageType: 'Observation',
        sourceSystem: 'Lab System',
        targetSystem: 'Healthcare Platform',
        recordCount: 200,
        processedCount: 120,
        errorCount: 80,
        errorMessage: 'Connection timeout during batch processing',
        startTime: new Date(Date.now() - 1800000).toISOString(), // 30 minutes ago
        endTime: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
        duration: 900000, // 15 minutes in ms
        metadata: {
          batchId: 'LAB-2024-001',
          errorType: 'TIMEOUT'
        }
      }
    ];

    // Insert sample sync status
    for (const status of sampleSyncStatus) {
      try {
        await syncStatusModel.create(status);
        console.log(`Created sync status for ${status.messageType}`);
      } catch (error) {
        console.error(`Error creating sync status:`, error.message);
      }
    }

    console.log('HL7/FHIR integration data seeded successfully!');
    
  } catch (error) {
    console.error('Error seeding HL7/FHIR data:', error);
  } finally {
    await dbConnection.close();
  }
}

// Run if called directly
if (require.main === module) {
  seedHL7FHIRData();
}

module.exports = { seedHL7FHIRData };
