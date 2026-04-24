const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const winston = require('winston');
const schedule = require('node-schedule');
const mongoose = require('mongoose');

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

class BackupService {
  constructor(options = {}) {
    this.config = {
      backupDir: options.backupDir || './backups',
      encryptionKey: options.encryptionKey || process.env.BACKUP_ENCRYPTION_KEY,
      retentionDays: options.retentionDays || 30,
      compressionLevel: options.compressionLevel || 6,
      scheduleInterval: options.scheduleInterval || '0 2 * * *', // Daily at 2 AM
      maxBackupSize: options.maxBackupSize || 1024 * 1024 * 1024, // 1GB
      verificationEnabled: options.verificationEnabled !== false,
      ...options
    };

    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/backup.log' }),
        new winston.transports.Console()
      ]
    });

    this.backupJobs = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    try {
      await this.ensureBackupDirectory();
      await this.setupScheduledBackups();
      this.isInitialized = true;
      this.logger.info('Backup service initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize backup service:', error);
      throw error;
    }
  }

  async ensureBackupDirectory() {
    try {
      await fs.access(this.config.backupDir);
    } catch (error) {
      await fs.mkdir(this.config.backupDir, { recursive: true });
    }
  }

  async setupScheduledBackups() {
    if (this.config.scheduleInterval) {
      schedule.scheduleJob(this.config.scheduleInterval, async () => {
        try {
          await this.performAutomatedBackup();
        } catch (error) {
          this.logger.error('Scheduled backup failed:', error);
        }
      });
      this.logger.info(`Scheduled backups configured: ${this.config.scheduleInterval}`);
    }
  }

  async performAutomatedBackup() {
    const backupId = this.generateBackupId();
    this.logger.info(`Starting automated backup: ${backupId}`);

    try {
      const result = await this.createBackup({
        id: backupId,
        type: 'automated',
        description: 'Scheduled automated backup'
      });

      this.logger.info(`Automated backup completed: ${backupId}`, result);
      
      // Clean up old backups
      await this.cleanupOldBackups();
      
      return result;
    } catch (error) {
      this.logger.error(`Automated backup failed: ${backupId}`, error);
      throw error;
    }
  }

  async createBackup(options = {}) {
    const {
      id = this.generateBackupId(),
      type = 'manual',
      description = '',
      collections = null,
      pointInTime = new Date()
    } = options;

    const backupPath = path.join(this.config.backupDir, `${id}.backup`);
    const metadataPath = path.join(this.config.backupDir, `${id}.meta`);

    try {
      this.backupJobs.set(id, {
        status: 'in_progress',
        startTime: new Date(),
        type,
        description
      });

      const backupData = {
        id,
        type,
        description,
        createdAt: new Date(),
        pointInTime,
        collections: collections || await this.getDatabaseCollections(),
        metadata: {
          version: '1.0',
          compressionLevel: this.config.compressionLevel,
          encrypted: true
        }
      };

      // Backup database collections
      const dbData = await this.backupDatabase(collections, pointInTime);
      backupData.data = dbData;

      // Compress backup data
      const compressedData = await gzipAsync(JSON.stringify(backupData), {
        level: this.config.compressionLevel
      });

      // Encrypt backup data
      const encryptedData = await this.encryptData(compressedData);

      // Write backup files
      await fs.writeFile(backupPath, encryptedData);
      await fs.writeFile(metadataPath, JSON.stringify(backupData.metadata, null, 2));

      // Verify backup integrity
      if (this.config.verificationEnabled) {
        await this.verifyBackup(backupPath, backupData.metadata);
      }

      const backupInfo = {
        id,
        type,
        description,
        createdAt: backupData.createdAt,
        pointInTime,
        size: encryptedData.length,
        collections: backupData.collections,
        status: 'completed',
        backupPath,
        metadataPath
      };

      this.backupJobs.set(id, {
        ...this.backupJobs.get(id),
        ...backupInfo,
        status: 'completed',
        endTime: new Date()
      });

      this.logger.info(`Backup created successfully: ${id}`, backupInfo);
      return backupInfo;

    } catch (error) {
      this.backupJobs.set(id, {
        ...this.backupJobs.get(id),
        status: 'failed',
        error: error.message,
        endTime: new Date()
      });

      this.logger.error(`Backup creation failed: ${id}`, error);
      
      // Clean up partial backup files
      try {
        await fs.unlink(backupPath);
        await fs.unlink(metadataPath);
      } catch (cleanupError) {
        this.logger.error('Failed to cleanup partial backup files:', cleanupError);
      }

      throw error;
    }
  }

  async backupDatabase(collections, pointInTime) {
    const db = mongoose.connection.db;
    const backupData = {};

    if (!collections) {
      collections = await this.getDatabaseCollections();
    }

    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName);
        
        // Query for documents as of point-in-time
        const query = pointInTime ? {
          $or: [
            { createdAt: { $lte: pointInTime } },
            { updatedAt: { $lte: pointInTime } }
          ]
        } : {};

        const documents = await collection.find(query).toArray();
        
        backupData[collectionName] = {
          documents,
          count: documents.length,
          backupTimestamp: new Date()
        };

        this.logger.info(`Backed up collection ${collectionName}: ${documents.length} documents`);
      } catch (error) {
        this.logger.error(`Failed to backup collection ${collectionName}:`, error);
        throw error;
      }
    }

    return backupData;
  }

  async getDatabaseCollections() {
    const db = mongoose.connection.db;
    try {
      const collections = await db.listCollections().toArray();
      return collections.map(col => col.name);
    } catch (error) {
      this.logger.error('Failed to get database collections:', error);
      throw error;
    }
  }

  async restoreFromBackup(backupId, options = {}) {
    const {
      targetCollections = null,
      dropExisting = false,
      validateBeforeRestore = true
    } = options;

    const backupPath = path.join(this.config.backupDir, `${backupId}.backup`);
    const metadataPath = path.join(this.config.backupDir, `${backupId}.meta`);

    try {
      this.logger.info(`Starting restore from backup: ${backupId}`);

      // Verify backup exists
      await fs.access(backupPath);
      await fs.access(metadataPath);

      // Read and decrypt backup
      const encryptedData = await fs.readFile(backupPath);
      const compressedData = await this.decryptData(encryptedData);
      const backupDataJson = await gunzipAsync(compressedData);
      const backupData = JSON.parse(backupDataJson);

      // Validate backup integrity
      if (validateBeforeRestore) {
        await this.validateBackupData(backupData);
      }

      // Restore collections
      const db = mongoose.connection.db;
      const restoreResults = {};

      const collectionsToRestore = targetCollections || Object.keys(backupData.data);

      for (const collectionName of collectionsToRestore) {
        if (!backupData.data[collectionName]) {
          this.logger.warn(`Collection ${collectionName} not found in backup`);
          continue;
        }

        try {
          const collection = db.collection(collectionName);
          const documents = backupData.data[collectionName].documents;

          if (dropExisting) {
            await collection.deleteMany({});
          }

          if (documents.length > 0) {
            await collection.insertMany(documents, { ordered: false });
          }

          restoreResults[collectionName] = {
            documentsRestored: documents.length,
            status: 'success'
          };

          this.logger.info(`Restored collection ${collectionName}: ${documents.length} documents`);
        } catch (error) {
          restoreResults[collectionName] = {
            documentsRestored: 0,
            status: 'failed',
            error: error.message
          };

          this.logger.error(`Failed to restore collection ${collectionName}:`, error);
        }
      }

      const restoreInfo = {
        backupId,
        restoredAt: new Date(),
        collections: restoreResults,
        totalDocuments: Object.values(restoreResults).reduce((sum, result) => sum + result.documentsRestored, 0)
      };

      this.logger.info(`Restore completed: ${backupId}`, restoreInfo);
      return restoreInfo;

    } catch (error) {
      this.logger.error(`Restore failed: ${backupId}`, error);
      throw error;
    }
  }

  async pointInTimeRestore(targetDate, options = {}) {
    // Find the closest backup to the target date
    const backups = await this.listBackups();
    const closestBackup = backups
      .filter(backup => backup.pointInTime <= targetDate)
      .sort((a, b) => b.pointInTime - a.pointInTime)[0];

    if (!closestBackup) {
      throw new Error(`No backup found before ${targetDate}`);
    }

    this.logger.info(`Performing point-in-time restore to ${targetDate} using backup ${closestBackup.id}`);
    
    return await this.restoreFromBackup(closestBackup.id, {
      ...options,
      pointInTime: targetDate
    });
  }

  async verifyBackup(backupPath, metadata) {
    try {
      const encryptedData = await fs.readFile(backupPath);
      const compressedData = await this.decryptData(encryptedData);
      const backupDataJson = await gunzipAsync(compressedData);
      const backupData = JSON.parse(backupDataJson);

      // Verify checksum
      const calculatedChecksum = crypto.createHash('sha256').update(backupDataJson).digest('hex');
      const storedChecksum = metadata.checksum;

      if (storedChecksum && calculatedChecksum !== storedChecksum) {
        throw new Error('Backup checksum verification failed');
      }

      // Verify data structure
      if (!backupData.id || !backupData.data || !backupData.createdAt) {
        throw new Error('Invalid backup data structure');
      }

      this.logger.info(`Backup verification passed: ${backupPath}`);
      return true;
    } catch (error) {
      this.logger.error(`Backup verification failed: ${backupPath}`, error);
      throw error;
    }
  }

  async validateBackupData(backupData) {
    if (!backupData.id || !backupData.data || !backupData.createdAt) {
      throw new Error('Invalid backup data structure');
    }

    // Validate each collection's data
    for (const [collectionName, collectionData] of Object.entries(backupData.data)) {
      if (!collectionData.documents || !Array.isArray(collectionData.documents)) {
        throw new Error(`Invalid data structure for collection ${collectionName}`);
      }
    }

    return true;
  }

  async listBackups() {
    try {
      const files = await fs.readdir(this.config.backupDir);
      const backupFiles = files.filter(file => file.endsWith('.backup'));
      
      const backups = [];
      
      for (const file of backupFiles) {
        const backupId = path.basename(file, '.backup');
        const metadataPath = path.join(this.config.backupDir, `${backupId}.meta`);
        
        try {
          const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));
          const stats = await fs.stat(path.join(this.config.backupDir, file));
          
          backups.push({
            id: backupId,
            createdAt: new Date(stats.birthtime),
            size: stats.size,
            metadata,
            status: this.backupJobs.get(backupId)?.status || 'completed'
          });
        } catch (error) {
          this.logger.warn(`Failed to read metadata for backup ${backupId}:`, error);
        }
      }

      return backups.sort((a, b) => b.createdAt - a.createdAt);
    } catch (error) {
      this.logger.error('Failed to list backups:', error);
      throw error;
    }
  }

  async cleanupOldBackups() {
    try {
      const backups = await this.listBackups();
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - this.config.retentionDays);

      const oldBackups = backups.filter(backup => backup.createdAt < cutoffDate);
      
      for (const backup of oldBackups) {
        await this.deleteBackup(backup.id);
      }

      this.logger.info(`Cleaned up ${oldBackups.length} old backups`);
    } catch (error) {
      this.logger.error('Failed to cleanup old backups:', error);
    }
  }

  async deleteBackup(backupId) {
    try {
      const backupPath = path.join(this.config.backupDir, `${backupId}.backup`);
      const metadataPath = path.join(this.config.backupDir, `${backupId}.meta`);

      await fs.unlink(backupPath);
      await fs.unlink(metadataPath);
      
      this.backupJobs.delete(backupId);
      
      this.logger.info(`Deleted backup: ${backupId}`);
    } catch (error) {
      this.logger.error(`Failed to delete backup ${backupId}:`, error);
      throw error;
    }
  }

  async getBackupAnalytics() {
    try {
      const backups = await this.listBackups();
      const jobs = Array.from(this.backupJobs.entries());

      const analytics = {
        totalBackups: backups.length,
        totalSize: backups.reduce((sum, backup) => sum + backup.size, 0),
        averageSize: backups.length > 0 ? backups.reduce((sum, backup) => sum + backup.size, 0) / backups.length : 0,
        oldestBackup: backups.length > 0 ? backups[backups.length - 1].createdAt : null,
        newestBackup: backups.length > 0 ? backups[0].createdAt : null,
        backupTypes: {},
        successRate: 0,
        recentActivity: jobs
          .filter(([_, job]) => job.endTime && job.endTime > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
          .map(([id, job]) => ({ id, ...job }))
      };

      // Calculate backup types distribution
      backups.forEach(backup => {
        const type = backup.metadata.type || 'manual';
        analytics.backupTypes[type] = (analytics.backupTypes[type] || 0) + 1;
      });

      // Calculate success rate
      const completedJobs = jobs.filter(([_, job]) => job.status === 'completed').length;
      const totalJobs = jobs.length;
      analytics.successRate = totalJobs > 0 ? (completedJobs / totalJobs) * 100 : 0;

      return analytics;
    } catch (error) {
      this.logger.error('Failed to generate backup analytics:', error);
      throw error;
    }
  }

  async encryptData(data) {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(algorithm, key, iv);
    
    let encrypted = cipher.update(data);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    
    const authTag = cipher.getAuthTag();
    
    return Buffer.concat([iv, authTag, encrypted]);
  }

  async decryptData(encryptedData) {
    if (!this.config.encryptionKey) {
      throw new Error('Encryption key not configured');
    }

    const algorithm = 'aes-256-gcm';
    const key = crypto.scryptSync(this.config.encryptionKey, 'salt', 32);
    
    const iv = encryptedData.slice(0, 16);
    const authTag = encryptedData.slice(16, 32);
    const encrypted = encryptedData.slice(32);
    
    const decipher = crypto.createDecipher(algorithm, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    
    return decrypted;
  }

  generateBackupId() {
    return `backup_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  }

  getBackupStatus(backupId) {
    return this.backupJobs.get(backupId) || null;
  }
}

module.exports = BackupService;
