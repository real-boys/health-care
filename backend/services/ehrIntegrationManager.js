const { EpicAdapter } = require('./ehrAdapters/epicAdapter');
const { CernerAdapter } = require('./ehrAdapters/cernerAdapter');

/**
 * EHR Integration Manager
 * Manages connections to multiple EHR systems (Epic, Cerner, etc.)
 */
class EHRIntegrationManager {
  constructor() {
    this.adapters = new Map();
    this.initializeAdapters();
  }

  /**
   * Initialize EHR adapters based on configuration
   */
  initializeAdapters() {
    // Initialize Epic if configured
    if (process.env.EPIC_FHIR_BASE_URL) {
      const epicAdapter = new EpicAdapter({
        baseUrl: process.env.EPIC_FHIR_BASE_URL,
        clientId: process.env.EPIC_CLIENT_ID,
        clientSecret: process.env.EPIC_CLIENT_SECRET
      });
      this.adapters.set('epic', epicAdapter);
    }

    // Initialize Cerner if configured
    if (process.env.CERNER_FHIR_BASE_URL) {
      const cernerAdapter = new CernerAdapter({
        baseUrl: process.env.CERNER_FHIR_BASE_URL,
        clientId: process.env.CERNER_CLIENT_ID,
        clientSecret: process.env.CERNER_CLIENT_SECRET
      });
      this.adapters.set('cerner', cernerAdapter);
    }
  }

  /**
   * Get adapter by name
   */
  getAdapter(adapterName) {
    const adapter = this.adapters.get(adapterName.toLowerCase());
    if (!adapter) {
      throw new Error(`Adapter ${adapterName} not found`);
    }
    return adapter;
  }

  /**
   * Register a new adapter
   */
  registerAdapter(name, adapter) {
    this.adapters.set(name.toLowerCase(), adapter);
  }

  /**
   * Get all available adapters
   */
  getAvailableAdapters() {
    return Array.from(this.adapters.keys());
  }

  /**
   * Search for patient across all connected EHR systems
   */
  async searchPatientAcrossSystems(searchParams) {
    const results = [];

    for (const [name, adapter] of this.adapters) {
      try {
        const systemResults = await adapter.searchPatients(searchParams);
        results.push({
          system: name,
          total: systemResults.total,
          patients: systemResults.patients.map(patient => ({
            ...patient,
            sourceSystem: name
          }))
        });
      } catch (error) {
        console.error(`Error searching ${name}:`, error.message);
        results.push({
          system: name,
          error: error.message,
          patients: []
        });
      }
    }

    return results;
  }

  /**
   * Get comprehensive patient data from specific EHR system
   */
  async getComprehensivePatientData(systemName, patientId) {
    try {
      const adapter = this.getAdapter(systemName);
      
      // Fetch all patient data in parallel
      const [
        patient,
        observations,
        conditions,
        medications,
        allergies,
        immunizations,
        encounters
      ] = await Promise.all([
        adapter.getPatient(patientId),
        adapter.getObservations(patientId),
        adapter.getConditions(patientId),
        adapter.getMedications(patientId),
        adapter.getAllergies(patientId),
        adapter.getImmunizations(patientId),
        adapter.getEncounters(patientId)
      ]);

      return {
        success: true,
        system: systemName,
        patient,
        clinicalData: {
          observations,
          conditions,
          medications,
          allergies,
          immunizations,
          encounters
        },
        summary: {
          totalObservations: observations.total,
          totalConditions: conditions.total,
          totalMedications: medications.total,
          totalAllergies: allergies.total,
          totalImmunizations: immunizations.total,
          totalEncounters: encounters.total
        },
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        system: systemName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Get patient medications from all systems
   */
  async getAllPatientMedications(patientId) {
    const results = [];

    for (const [name, adapter] of this.adapters) {
      try {
        const medications = await adapter.getMedications(patientId);
        results.push({
          system: name,
          total: medications.total,
          medications: medications.medications.map(med => ({
            ...med,
            sourceSystem: name
          }))
        });
      } catch (error) {
        results.push({
          system: name,
          error: error.message,
          medications: []
        });
      }
    }

    return results;
  }

  /**
   * Get patient allergies from all systems
   */
  async getAllPatientAllergies(patientId) {
    const results = [];

    for (const [name, adapter] of this.adapters) {
      try {
        const allergies = await adapter.getAllergies(patientId);
        results.push({
          system: name,
          total: allergies.total,
          allergies: allergies.allergies.map(allergy => ({
            ...allergy,
            sourceSystem: name
          }))
        });
      } catch (error) {
        results.push({
          system: name,
          error: error.message,
          allergies: []
        });
      }
    }

    return results;
  }

  /**
   * Test all EHR connections
   */
  async testAllConnections() {
    const results = [];

    for (const [name, adapter] of this.adapters) {
      try {
        const connectionTest = await adapter.testConnection();
        results.push(connectionTest);
      } catch (error) {
        results.push({
          system: name,
          success: false,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  /**
   * Get health status of all EHR integrations
   */
  async getIntegrationHealth() {
    const connections = await this.testAllConnections();
    
    const healthyCount = connections.filter(c => c.success).length;
    const totalCount = connections.length;

    return {
      status: healthyCount === totalCount ? 'healthy' : 
              healthyCount > 0 ? 'degraded' : 'unhealthy',
      totalIntegrations: totalCount,
      healthyIntegrations: healthyCount,
      connections,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Sync patient data from EHR to local database
   */
  async syncPatientData(systemName, patientId, options = {}) {
    try {
      const adapter = this.getAdapter(systemName);
      
      // Determine what data to sync
      const syncTasks = [];
      
      if (options.syncDemographics !== false) {
        syncTasks.push(['demographics', adapter.getPatient(patientId)]);
      }
      
      if (options.syncObservations !== false) {
        syncTasks.push(['observations', adapter.getObservations(patientId, options.observationsParams)]);
      }
      
      if (options.syncConditions !== false) {
        syncTasks.push(['conditions', adapter.getConditions(patientId)]);
      }
      
      if (options.syncMedications !== false) {
        syncTasks.push(['medications', adapter.getMedications(patientId)]);
      }
      
      if (options.syncAllergies !== false) {
        syncTasks.push(['allergies', adapter.getAllergies(patientId)]);
      }

      // Execute all sync tasks in parallel
      const results = await Promise.all(syncTasks.map(([key, promise]) => 
        promise.then(data => ({ key, data })).catch(error => ({ key, error: error.message }))
      ));

      // Transform results
      const syncResult = {
        success: true,
        system: systemName,
        patientId,
        syncedData: {},
        errors: [],
        timestamp: new Date().toISOString()
      };

      results.forEach(({ key, data, error }) => {
        if (error) {
          syncResult.errors.push({ key, error });
        } else {
          syncResult.syncedData[key] = data;
        }
      });

      return syncResult;
    } catch (error) {
      return {
        success: false,
        system: systemName,
        patientId,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Batch import multiple patients from EHR
   */
  async batchImportPatients(systemName, patientIds, options = {}) {
    try {
      const adapter = this.getAdapter(systemName);
      
      const importResults = await Promise.all(
        patientIds.map(async (patientId) => {
          try {
            const result = await this.syncPatientData(systemName, patientId, options);
            return {
              patientId,
              success: result.success,
              data: result.syncedData || null,
              error: result.error || null
            };
          } catch (error) {
            return {
              patientId,
              success: false,
              error: error.message
            };
          }
        })
      );

      return {
        success: true,
        system: systemName,
        totalRequested: patientIds.length,
        successfulImports: importResults.filter(r => r.success).length,
        failedImports: importResults.filter(r => !r.success).length,
        results: importResults,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        system: systemName,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const ehrIntegrationManager = new EHRIntegrationManager();
module.exports = { EHRIntegrationManager, ehrIntegrationManager };
