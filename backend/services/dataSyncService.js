const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

class DataSyncService {
  constructor() {
    this.syncIntervals = {
      patients: 6 * 60 * 60 * 1000, // 6 hours
      providers: 12 * 60 * 60 * 1000, // 12 hours
      insurance: 24 * 60 * 60 * 1000, // 24 hours
      lab_results: 4 * 60 * 60 * 1000, // 4 hours
      medications: 8 * 60 * 60 * 1000 // 8 hours
    };
    
    this.syncStatus = new Map();
    this.backupPath = process.env.BACKUP_PATH || path.join(__dirname, '../backups');
    this.initialize();
  }

  async initialize() {
    // Ensure backup directory exists
    try {
      await fs.mkdir(this.backupPath, { recursive: true });
      console.log('✅ Data Sync Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Data Sync Service:', error);
    }
  }

  /**
   * Sync patient data from various sources
   * @param {string} patientId - Patient ID
   * @param {array} sources - Data sources to sync
   */
  async syncPatient(patientId, sources = ['ehr', 'insurance', 'lab_results']) {
    const syncId = crypto.randomUUID();
    this.syncStatus.set(syncId, { type: 'patient', status: 'running', startTime: new Date() });

    try {
      console.log(`🔄 Starting patient sync for ${patientId} from sources: ${sources.join(', ')}`);
      
      const syncData = {
        patientId,
        syncId,
        sources: {},
        timestamp: new Date(),
        changes: []
      };

      for (const source of sources) {
        try {
          const sourceData = await this.syncFromSource(source, 'patient', patientId);
          syncData.sources[source] = sourceData;
          
          // Process changes
          const changes = await this.processPatientChanges(patientId, sourceData, source);
          syncData.changes.push(...changes);
          
          console.log(`✅ Synced patient ${patientId} from ${source}`);
        } catch (error) {
          console.error(`❌ Failed to sync patient ${patientId} from ${source}:`, error);
          syncData.sources[source] = { error: error.message };
        }
      }

      // Update patient last sync timestamp
      await this.updatePatientSyncTimestamp(patientId);
      
      // Log sync completion
      await this.logSyncCompletion(syncData);
      
      this.syncStatus.set(syncId, { ...this.syncStatus.get(syncId), status: 'completed', endTime: new Date() });
      
      return {
        success: true,
        syncId,
        data: syncData
      };
    } catch (error) {
      this.syncStatus.set(syncId, { ...this.syncStatus.get(syncId), status: 'failed', error, endTime: new Date() });
      throw error;
    }
  }

  /**
   * Sync provider data
   * @param {string} providerId - Provider ID
   * @param {array} sources - Data sources to sync
   */
  async syncProvider(providerId, sources = ['directory', 'schedule', 'credentials']) {
    const syncId = crypto.randomUUID();
    this.syncStatus.set(syncId, { type: 'provider', status: 'running', startTime: new Date() });

    try {
      console.log(`🔄 Starting provider sync for ${providerId} from sources: ${sources.join(', ')}`);
      
      const syncData = {
        providerId,
        syncId,
        sources: {},
        timestamp: new Date(),
        changes: []
      };

      for (const source of sources) {
        try {
          const sourceData = await this.syncFromSource(source, 'provider', providerId);
          syncData.sources[source] = sourceData;
          
          const changes = await this.processProviderChanges(providerId, sourceData, source);
          syncData.changes.push(...changes);
          
          console.log(`✅ Synced provider ${providerId} from ${source}`);
        } catch (error) {
          console.error(`❌ Failed to sync provider ${providerId} from ${source}:`, error);
          syncData.sources[source] = { error: error.message };
        }
      }

      await this.updateProviderSyncTimestamp(providerId);
      await this.logSyncCompletion(syncData);
      
      this.syncStatus.set(syncId, { ...this.syncStatus.get(syncId), status: 'completed', endTime: new Date() });
      
      return {
        success: true,
        syncId,
        data: syncData
      };
    } catch (error) {
      this.syncStatus.set(syncId, { ...this.syncStatus.get(syncId), status: 'failed', error, endTime: new Date() });
      throw error;
    }
  }

  /**
   * Sync insurance data
   * @param {string} insuranceId - Insurance ID
   * @param {array} sources - Data sources to sync
   */
  async syncInsurance(insuranceId, sources = ['policies', 'claims', 'coverage']) {
    const syncId = crypto.randomUUID();
    this.syncStatus.set(syncId, { type: 'insurance', status: 'running', startTime: new Date() });

    try {
      console.log(`🔄 Starting insurance sync for ${insuranceId} from sources: ${sources.join(', ')}`);
      
      const syncData = {
        insuranceId,
        syncId,
        sources: {},
        timestamp: new Date(),
        changes: []
      };

      for (const source of sources) {
        try {
          const sourceData = await this.syncFromSource(source, 'insurance', insuranceId);
          syncData.sources[source] = sourceData;
          
          const changes = await this.processInsuranceChanges(insuranceId, sourceData, source);
          syncData.changes.push(...changes);
          
          console.log(`✅ Synced insurance ${insuranceId} from ${source}`);
        } catch (error) {
          console.error(`❌ Failed to sync insurance ${insuranceId} from ${source}:`, error);
          syncData.sources[source] = { error: error.message };
        }
      }

      await this.updateInsuranceSyncTimestamp(insuranceId);
      await this.logSyncCompletion(syncData);
      
      this.syncStatus.set(syncId, { ...this.syncStatus.get(syncId), status: 'completed', endTime: new Date() });
      
      return {
        success: true,
        syncId,
        data: syncData
      };
    } catch (error) {
      this.syncStatus.set(syncId, { ...this.syncStatus.get(syncId), status: 'failed', error, endTime: new Date() });
      throw error;
    }
  }

  /**
   * Sync data from external source
   * @param {string} source - Source name
   * @param {string} entityType - Entity type (patient, provider, insurance)
   * @param {string} entityId - Entity ID
   */
  async syncFromSource(source, entityType, entityId) {
    const sourceConfigs = {
      ehr: {
        url: process.env.EHR_API_URL,
        headers: { 'Authorization': `Bearer ${process.env.EHR_API_KEY}` }
      },
      insurance: {
        url: process.env.INSURANCE_API_URL,
        headers: { 'Authorization': `Bearer ${process.env.INSURANCE_API_KEY}` }
      },
      lab_results: {
        url: process.env.LAB_API_URL,
        headers: { 'Authorization': `Bearer ${process.env.LAB_API_KEY}` }
      },
      directory: {
        url: process.env.DIRECTORY_API_URL,
        headers: { 'Authorization': `Bearer ${process.env.DIRECTORY_API_KEY}` }
      }
    };

    const config = sourceConfigs[source];
    if (!config) {
      throw new Error(`Unknown source: ${source}`);
    }

    const endpoint = `${config.url}/${entityType}s/${entityId}`;
    
    try {
      const response = await axios.get(endpoint, {
        headers: config.headers,
        timeout: 30000
      });
      
      return {
        data: response.data,
        source,
        timestamp: new Date(),
        status: 'success'
      };
    } catch (error) {
      throw new Error(`Failed to sync from ${source}: ${error.message}`);
    }
  }

  /**
   * Process patient data changes
   * @param {string} patientId - Patient ID
   * @param {object} sourceData - Source data
   * @param {string} source - Source name
   */
  async processPatientChanges(patientId, sourceData, source) {
    const changes = [];
    
    // This would typically compare with existing data and identify changes
    // For now, we'll just log the sync
    changes.push({
      type: 'data_sync',
      entity: 'patient',
      entityId: patientId,
      source,
      timestamp: new Date(),
      change: `Synced patient data from ${source}`
    });

    return changes;
  }

  /**
   * Process provider data changes
   * @param {string} providerId - Provider ID
   * @param {object} sourceData - Source data
   * @param {string} source - Source name
   */
  async processProviderChanges(providerId, sourceData, source) {
    const changes = [];
    
    changes.push({
      type: 'data_sync',
      entity: 'provider',
      entityId: providerId,
      source,
      timestamp: new Date(),
      change: `Synced provider data from ${source}`
    });

    return changes;
  }

  /**
   * Process insurance data changes
   * @param {string} insuranceId - Insurance ID
   * @param {object} sourceData - Source data
   * @param {string} source - Source name
   */
  async processInsuranceChanges(insuranceId, sourceData, source) {
    const changes = [];
    
    changes.push({
      type: 'data_sync',
      entity: 'insurance',
      entityId: insuranceId,
      source,
      timestamp: new Date(),
      change: `Synced insurance data from ${source}`
    });

    return changes;
  }

  /**
   * Create backup
   * @param {object} backupConfig - Backup configuration
   */
  async createBackup(backupConfig) {
    const { type, include, compression, encryption } = backupConfig;
    const backupId = `${type}_${Date.now()}`;
    const backupFile = path.join(this.backupPath, `${backupId}.json`);

    try {
      console.log(`🔄 Creating ${type} backup...`);
      
      const backupData = {
        backupId,
        type,
        timestamp: new Date(),
        include,
        data: {}
      };

      // Collect data for each included entity type
      for (const entity of include) {
        backupData.data[entity] = await this.getEntityData(entity);
      }

      // Apply compression if requested
      let finalData = JSON.stringify(backupData, null, 2);
      if (compression) {
        const zlib = require('zlib');
        finalData = zlib.gzipSync(finalData);
        backupFile += '.gz';
      }

      // Write backup file
      await fs.writeFile(backupFile, finalData);

      // Apply encryption if requested
      if (encryption) {
        await this.encryptBackup(backupFile);
      }

      console.log(`✅ Backup created: ${backupFile}`);
      
      return {
        success: true,
        backupId,
        file: backupFile,
        size: (await fs.stat(backupFile)).size
      };
    } catch (error) {
      console.error('❌ Backup creation failed:', error);
      throw error;
    }
  }

  /**
   * Get entity data for backup
   * @param {string} entity - Entity type
   */
  async getEntityData(entity) {
    // This would typically query your database
    // For now, return mock data
    const mockData = {
      patients: [
        { id: 1, name: 'John Doe', email: 'john@example.com' },
        { id: 2, name: 'Jane Smith', email: 'jane@example.com' }
      ],
      providers: [
        { id: 1, name: 'Dr. Sarah Chen', specialty: 'Cardiology' },
        { id: 2, name: 'Dr. Michael Ross', specialty: 'Neurology' }
      ],
      payments: [
        { id: 1, amount: 500, status: 'completed' },
        { id: 2, amount: 750, status: 'pending' }
      ],
      claims: [
        { id: 1, patientId: 1, amount: 1000, status: 'approved' },
        { id: 2, patientId: 2, amount: 500, status: 'pending' }
      ],
      appointments: [
        { id: 1, patientId: 1, providerId: 1, date: '2024-01-15' },
        { id: 2, patientId: 2, providerId: 2, date: '2024-01-16' }
      ]
    };

    return mockData[entity] || [];
  }

  /**
   * Encrypt backup file
   * @param {string} filePath - File path
   */
  async encryptBackup(filePath) {
    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(process.env.BACKUP_ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    const input = await fs.readFile(filePath);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    const encryptedData = Buffer.concat([iv, authTag, encrypted]);
    
    await fs.writeFile(filePath, encryptedData);
  }

  /**
   * Get patients needing sync
   */
  async getPatientsNeedingSync() {
    // This would typically query your database for patients with stale sync timestamps
    // For now, return mock data
    return [
      { id: 1, lastSync: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      { id: 2, lastSync: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
    ];
  }

  /**
   * Update patient sync timestamp
   * @param {string} patientId - Patient ID
   */
  async updatePatientSyncTimestamp(patientId) {
    // This would typically update your database
    console.log(`Updated sync timestamp for patient ${patientId}`);
  }

  /**
   * Update provider sync timestamp
   * @param {string} providerId - Provider ID
   */
  async updateProviderSyncTimestamp(providerId) {
    console.log(`Updated sync timestamp for provider ${providerId}`);
  }

  /**
   * Update insurance sync timestamp
   * @param {string} insuranceId - Insurance ID
   */
  async updateInsuranceSyncTimestamp(insuranceId) {
    console.log(`Updated sync timestamp for insurance ${insuranceId}`);
  }

  /**
   * Log sync completion
   * @param {object} syncData - Sync data
   */
  async logSyncCompletion(syncData) {
    const logFile = path.join(this.backupPath, 'sync_logs.json');
    
    try {
      let logs = [];
      try {
        const existingLogs = await fs.readFile(logFile, 'utf8');
        logs = JSON.parse(existingLogs);
      } catch (error) {
        // File doesn't exist or is empty
      }
      
      logs.push({
        ...syncData,
        completedAt: new Date()
      });
      
      // Keep only last 1000 logs
      if (logs.length > 1000) {
        logs = logs.slice(-1000);
      }
      
      await fs.writeFile(logFile, JSON.stringify(logs, null, 2));
    } catch (error) {
      console.error('Failed to log sync completion:', error);
    }
  }

  /**
   * Cleanup old logs
   * @param {Date} cutoffDate - Cutoff date
   */
  async cleanupLogs(cutoffDate) {
    const logFile = path.join(this.backupPath, 'sync_logs.json');
    
    try {
      const logs = JSON.parse(await fs.readFile(logFile, 'utf8'));
      const filteredLogs = logs.filter(log => new Date(log.timestamp) > cutoffDate);
      
      await fs.writeFile(logFile, JSON.stringify(filteredLogs, null, 2));
      console.log(`Cleaned up ${logs.length - filteredLogs.length} old log entries`);
    } catch (error) {
      console.error('Failed to cleanup logs:', error);
    }
  }

  /**
   * Cleanup expired sessions
   * @param {Date} cutoffDate - Cutoff date
   */
  async cleanupSessions(cutoffDate) {
    // This would typically clean up expired sessions from your database
    console.log(`Cleaned up sessions older than ${cutoffDate}`);
  }

  /**
   * Cleanup temporary files
   * @param {Date} cutoffDate - Cutoff date
   */
  async cleanupTempFiles(cutoffDate) {
    try {
      const files = await fs.readdir(this.backupPath);
      let cleanedCount = 0;
      
      for (const file of files) {
        if (file.startsWith('temp_')) {
          const filePath = path.join(this.backupPath, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            cleanedCount++;
          }
        }
      }
      
      console.log(`Cleaned up ${cleanedCount} temporary files`);
    } catch (error) {
      console.error('Failed to cleanup temp files:', error);
    }
  }

  /**
   * Get sync status
   * @param {string} syncId - Sync ID
   */
  getSyncStatus(syncId) {
    return this.syncStatus.get(syncId);
  }

  /**
   * Get all sync statuses
   */
  getAllSyncStatuses() {
    return Array.from(this.syncStatus.entries()).map(([id, status]) => ({ id, ...status }));
  }
}

module.exports = new DataSyncService();
