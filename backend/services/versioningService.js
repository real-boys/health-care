const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const ipfsService = require('./ipfsService');
const encryptionService = require('./encryptionService');

class VersioningService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.maxVersions = 10; // Maximum versions to keep per resource
    this.autoBackup = true;
    this.backupInterval = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
  }

  getDatabase() {
    return new sqlite3.Database(this.dbPath);
  }

  // Initialize versioning database tables
  async initializeTables() {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS file_versions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            version_number INTEGER NOT NULL,
            ipfs_cid TEXT NOT NULL,
            content_hash TEXT NOT NULL,
            file_size INTEGER NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            change_description TEXT,
            is_current BOOLEAN DEFAULT FALSE,
            backup_cid TEXT,
            metadata TEXT,
            UNIQUE(resource_type, resource_id, version_number),
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS backup_schedules (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            backup_frequency TEXT NOT NULL,
            last_backup TIMESTAMP,
            next_backup TIMESTAMP,
            is_active BOOLEAN DEFAULT TRUE,
            retention_days INTEGER DEFAULT 30,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS restore_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            restore_point_name TEXT NOT NULL,
            ipfs_cid TEXT NOT NULL,
            created_by INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            description TEXT,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create indexes
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_file_versions_resource 
          ON file_versions(resource_type, resource_id)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_file_versions_current 
          ON file_versions(resource_type, resource_id, is_current)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_backup_schedules_next 
          ON backup_schedules(next_backup)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    } catch (error) {
      console.error('Error initializing versioning tables:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Create new version of a resource
  async createVersion(resourceType, resourceId, data, userId, changeDescription = null, encryptionKey = null) {
    const db = this.getDatabase();
    
    try {
      // Get current version number
      const currentVersion = await this.getCurrentVersion(resourceType, resourceId);
      const newVersionNumber = currentVersion ? currentVersion.version_number + 1 : 1;

      // Calculate content hash
      const contentHash = crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');

      // Upload to IPFS
      const ipfsResult = await ipfsService.addEncryptedFile(data, encryptionKey, {
        contentType: 'application/json',
        version: newVersionNumber,
        pin: true
      });

      // Create backup if auto-backup is enabled
      let backupCid = null;
      if (this.autoBackup && newVersionNumber > 1) {
        backupCid = await this.createBackup(data, encryptionKey, `${resourceType}-${resourceId}-v${newVersionNumber}-backup`);
      }

      // Insert new version
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO file_versions 
           (resource_type, resource_id, version_number, ipfs_cid, content_hash, 
            file_size, created_by, change_description, is_current, backup_cid, metadata)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            resourceType,
            resourceId,
            newVersionNumber,
            ipfsResult.cid,
            contentHash,
            ipfsResult.size,
            userId,
            changeDescription,
            true, // New version is current
            backupCid,
            JSON.stringify({
              isNew: ipfsResult.isNew,
              contentHash: ipfsResult.contentHash
            })
          ],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID, version: newVersionNumber });
          }
        );
      });

      // Update previous version to not be current
      if (currentVersion) {
        await new Promise((resolve, reject) => {
          db.run(
            'UPDATE file_versions SET is_current = FALSE WHERE resource_type = ? AND resource_id = ? AND version_number = ?',
            [resourceType, resourceId, currentVersion.version_number],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      // Clean up old versions if exceeding max versions
      await this.cleanupOldVersions(resourceType, resourceId);

      return {
        versionId: result.id,
        versionNumber: newVersionNumber,
        ipfsCid: ipfsResult.cid,
        contentHash,
        backupCid,
        isNew: ipfsResult.isNew
      };

    } catch (error) {
      console.error('Error creating version:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Get current version of a resource
  async getCurrentVersion(resourceType, resourceId) {
    const db = this.getDatabase();
    
    try {
      const version = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM file_versions WHERE resource_type = ? AND resource_id = ? AND is_current = TRUE',
          [resourceType, resourceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (version && version.metadata) {
        version.metadata = JSON.parse(version.metadata);
      }

      return version;
    } catch (error) {
      console.error('Error getting current version:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Get specific version of a resource
  async getVersion(resourceType, resourceId, versionNumber) {
    const db = this.getDatabase();
    
    try {
      const version = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM file_versions WHERE resource_type = ? AND resource_id = ? AND version_number = ?',
          [resourceType, resourceId, versionNumber],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (version && version.metadata) {
        version.metadata = JSON.parse(version.metadata);
      }

      return version;
    } catch (error) {
      console.error('Error getting version:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Get all versions of a resource
  async getAllVersions(resourceType, resourceId) {
    const db = this.getDatabase();
    
    try {
      const versions = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM file_versions WHERE resource_type = ? AND resource_id = ? ORDER BY version_number DESC',
          [resourceType, resourceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      return versions.map(version => {
        if (version.metadata) {
          version.metadata = JSON.parse(version.metadata);
        }
        return version;
      });
    } catch (error) {
      console.error('Error getting all versions:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Restore to specific version
  async restoreVersion(resourceType, resourceId, versionNumber, userId) {
    const db = this.getDatabase();
    
    try {
      // Get the version to restore
      const versionToRestore = await this.getVersion(resourceType, resourceId, versionNumber);
      if (!versionToRestore) {
        throw new Error('Version not found');
      }

      // Get the data from IPFS
      const encryptionKey = await this.getResourceEncryptionKey(resourceType, resourceId);
      const { data } = await ipfsService.getEncryptedFile(versionToRestore.ipfs_cid, encryptionKey);

      // Create new version with restored data
      const result = await this.createVersion(
        resourceType,
        resourceId,
        data,
        userId,
        `Restored from version ${versionNumber}`,
        encryptionKey
      );

      return result;
    } catch (error) {
      console.error('Error restoring version:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Create backup
  async createBackup(data, encryptionKey, backupName) {
    try {
      const backupData = {
        ...data,
        backupMetadata: {
          backupName,
          backupDate: new Date().toISOString(),
          backupType: 'automatic'
        }
      };

      const result = await ipfsService.addEncryptedFile(backupData, encryptionKey, {
        contentType: 'application/json',
        pin: true
      });

      return result.cid;
    } catch (error) {
      console.error('Error creating backup:', error);
      return null;
    }
  }

  // Create restore point
  async createRestorePoint(resourceType, resourceId, restorePointName, userId, description = null) {
    const db = this.getDatabase();
    
    try {
      // Get current version
      const currentVersion = await this.getCurrentVersion(resourceType, resourceId);
      if (!currentVersion) {
        throw new Error('No current version found');
      }

      // Create restore point
      const result = await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO restore_points (resource_type, resource_id, restore_point_name, ipfs_cid, created_by, description) VALUES (?, ?, ?, ?, ?, ?)',
          [resourceType, resourceId, restorePointName, currentVersion.ipfs_cid, userId, description],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      return {
        restorePointId: result.id,
        restorePointName,
        ipfsCid: currentVersion.ipfs_cid,
        versionNumber: currentVersion.version_number
      };
    } catch (error) {
      console.error('Error creating restore point:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Get restore points for a resource
  async getRestorePoints(resourceType, resourceId) {
    const db = this.getDatabase();
    
    try {
      const restorePoints = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM restore_points WHERE resource_type = ? AND resource_id = ? ORDER BY created_at DESC',
          [resourceType, resourceId],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      return restorePoints;
    } catch (error) {
      console.error('Error getting restore points:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Restore from restore point
  async restoreFromRestorePoint(restorePointId, userId) {
    const db = this.getDatabase();
    
    try {
      // Get restore point
      const restorePoint = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM restore_points WHERE id = ?',
          [restorePointId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!restorePoint) {
        throw new Error('Restore point not found');
      }

      // Get the data from IPFS
      const encryptionKey = await this.getResourceEncryptionKey(restorePoint.resource_type, restorePoint.resource_id);
      const { data } = await ipfsService.getEncryptedFile(restorePoint.ipfs_cid, encryptionKey);

      // Create new version with restored data
      const result = await this.createVersion(
        restorePoint.resource_type,
        restorePoint.resource_id,
        data,
        userId,
        `Restored from restore point: ${restorePoint.restore_point_name}`,
        encryptionKey
      );

      return result;
    } catch (error) {
      console.error('Error restoring from restore point:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Clean up old versions
  async cleanupOldVersions(resourceType, resourceId) {
    const db = this.getDatabase();
    
    try {
      // Get all versions sorted by version number (descending)
      const versions = await this.getAllVersions(resourceType, resourceId);
      
      if (versions.length <= this.maxVersions) {
        return; // No cleanup needed
      }

      // Keep only the most recent versions
      const versionsToDelete = versions.slice(this.maxVersions);
      
      for (const version of versionsToDelete) {
        // Unpin from IPFS if not current
        if (!version.is_current) {
          await ipfsService.unpinFile(version.ipfs_cid);
        }

        // Delete from database
        await new Promise((resolve, reject) => {
          db.run(
            'DELETE FROM file_versions WHERE id = ?',
            [version.id],
            function(err) {
              if (err) reject(err);
              else resolve();
            }
          );
        });
      }

      return versionsToDelete.length;
    } catch (error) {
      console.error('Error cleaning up old versions:', error);
      return 0;
    } finally {
      db.close();
    }
  }

  // Get version history with diff information
  async getVersionHistory(resourceType, resourceId) {
    const db = this.getDatabase();
    
    try {
      const versions = await this.getAllVersions(resourceType, resourceId);
      const history = [];

      for (let i = 0; i < versions.length; i++) {
        const version = versions[i];
        const encryptionKey = await this.getResourceEncryptionKey(resourceType, resourceId);
        
        try {
          const { data } = await ipfsService.getEncryptedFile(version.ipfs_cid, encryptionKey);
          
          history.push({
            ...version,
            data,
            changes: i > 0 ? this.calculateChanges(versions[i - 1], version) : null
          });
        } catch (error) {
          console.error('Error getting version data:', error);
          history.push({
            ...version,
            data: null,
            error: 'Failed to retrieve data'
          });
        }
      }

      return history;
    } catch (error) {
      console.error('Error getting version history:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Calculate changes between versions
  calculateChanges(previousVersion, currentVersion) {
    // This is a simplified change detection
    // In a real implementation, you might use a more sophisticated diff algorithm
    return {
      versionChange: currentVersion.version_number - previousVersion.version_number,
      timeDifference: new Date(currentVersion.created_at) - new Date(previousVersion.created_at),
      sizeDifference: currentVersion.file_size - previousVersion.file_size,
      contentChanged: previousVersion.content_hash !== currentVersion.content_hash
    };
  }

  // Get resource encryption key (this would be implemented based on your key management system)
  async getResourceEncryptionKey(resourceType, resourceId) {
    // This is a placeholder - implement based on your key management strategy
    // You might store encryption keys in a secure vault or derive them from user keys
    return process.env.DEFAULT_ENCRYPTION_KEY || 'default-key-placeholder';
  }

  // Get version statistics
  async getVersionStats(resourceType = null, resourceId = null) {
    const db = this.getDatabase();
    
    try {
      let query = `
        SELECT 
          resource_type,
          resource_id,
          COUNT(*) as total_versions,
          MAX(version_number) as latest_version,
          SUM(file_size) as total_size,
          AVG(file_size) as avg_size
        FROM file_versions
      `;
      let params = [];

      if (resourceType && resourceId) {
        query += ' WHERE resource_type = ? AND resource_id = ?';
        params = [resourceType, resourceId];
      } else if (resourceType) {
        query += ' WHERE resource_type = ?';
        params = [resourceType];
      }

      query += ' GROUP BY resource_type, resource_id';

      const stats = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      return stats;
    } catch (error) {
      console.error('Error getting version stats:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Delete a version (with safety checks)
  async deleteVersion(resourceType, resourceId, versionNumber, userId) {
    const db = this.getDatabase();
    
    try {
      // Don't allow deletion of current version
      const version = await this.getVersion(resourceType, resourceId, versionNumber);
      if (!version) {
        throw new Error('Version not found');
      }

      if (version.is_current) {
        throw new Error('Cannot delete current version');
      }

      // Unpin from IPFS
      await ipfsService.unpinFile(version.ipfs_cid);

      // Delete from database
      await new Promise((resolve, reject) => {
        db.run(
          'DELETE FROM file_versions WHERE resource_type = ? AND resource_id = ? AND version_number = ?',
          [resourceType, resourceId, versionNumber],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      return true;
    } catch (error) {
      console.error('Error deleting version:', error);
      throw error;
    } finally {
      db.close();
    }
  }
}

module.exports = new VersioningService();
