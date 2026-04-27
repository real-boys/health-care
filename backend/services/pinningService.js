const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const ipfsService = require('./ipfsService');
const { EventEmitter } = require('events');

class PinningService extends EventEmitter {
  constructor() {
    super();
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.pinningQueue = [];
    this.isProcessing = false;
    this.maxRetries = 3;
    this.retryDelay = 5000; // 5 seconds
    this.healthCheckInterval = 60000; // 1 minute
    this.priorities = {
      CRITICAL: 1,
      HIGH: 2,
      MEDIUM: 3,
      LOW: 4
    };
    
    // Start health monitoring
    this.startHealthMonitoring();
  }

  getDatabase() {
    return new sqlite3.Database(this.dbPath);
  }

  // Initialize pinning database tables
  async initializeTables() {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS pinned_records (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            ipfs_cid TEXT NOT NULL UNIQUE,
            priority TEXT DEFAULT 'MEDIUM',
            pin_status TEXT DEFAULT 'PENDING',
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            pinned_at TIMESTAMP,
            last_verified TIMESTAMP,
            verification_status TEXT DEFAULT 'UNKNOWN',
            retry_count INTEGER DEFAULT 0,
            max_retries INTEGER DEFAULT 3,
            metadata TEXT,
            created_by INTEGER NOT NULL,
            FOREIGN KEY (created_by) REFERENCES users(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS pinning_policies (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            auto_pin BOOLEAN DEFAULT TRUE,
            priority TEXT DEFAULT 'MEDIUM',
            retention_days INTEGER DEFAULT 365,
            conditions TEXT,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS pinning_audit_log (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            cid TEXT NOT NULL,
            action TEXT NOT NULL,
            status TEXT NOT NULL,
            error_message TEXT,
            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            user_id INTEGER,
            FOREIGN KEY (user_id) REFERENCES users(id)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      // Create indexes
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pinned_records_cid 
          ON pinned_records(ipfs_cid)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pinned_records_status 
          ON pinned_records(pin_status)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_pinned_records_priority 
          ON pinned_records(priority)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    } catch (error) {
      console.error('Error initializing pinning tables:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Auto-pin record based on policy
  async autoPin(resourceType, resourceId, ipfsCid, userId, priority = null) {
    try {
      // Check if auto-pin is enabled for this resource type
      const policy = await this.getPinningPolicy(resourceType);
      if (!policy || !policy.auto_pin) {
        return { autoPinned: false, reason: 'Auto-pin disabled for this resource type' };
      }

      // Determine priority
      const finalPriority = priority || policy.priority || this.priorities.MEDIUM;
      
      // Add to pinning queue
      return await this.addToQueue(resourceType, resourceId, ipfsCid, finalPriority, userId, {
        autoPinned: true,
        policyId: policy.id
      });
    } catch (error) {
      console.error('Error in auto-pin:', error);
      throw error;
    }
  }

  // Add record to pinning queue
  async addToQueue(resourceType, resourceId, ipfsCid, priority, userId, metadata = null) {
    const db = this.getDatabase();
    
    try {
      // Check if already pinned
      const existing = await this.getPinnedRecord(ipfsCid);
      if (existing) {
        return { 
          alreadyPinned: true, 
          status: existing.pin_status,
          cid: ipfsCid 
        };
      }

      // Insert into pinned_records table
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO pinned_records 
           (resource_type, resource_id, ipfs_cid, priority, pin_status, metadata, created_by)
           VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`,
          [resourceType, resourceId, ipfsCid, priority, JSON.stringify(metadata), userId],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Add to processing queue
      this.pinningQueue.push({
        id: result.id,
        resourceType,
        resourceId,
        ipfsCid,
        priority,
        userId,
        metadata,
        addedAt: new Date()
      });

      // Sort queue by priority
      this.pinningQueue.sort((a, b) => {
        const priorityOrder = [this.priorities.CRITICAL, this.priorities.HIGH, this.priorities.MEDIUM, this.priorities.LOW];
        return priorityOrder.indexOf(a.priority) - priorityOrder.indexOf(b.priority);
      });

      // Start processing if not already running
      if (!this.isProcessing) {
        this.processQueue();
      }

      return {
        queued: true,
        queueId: result.id,
        cid: ipfsCid,
        priority
      };
    } catch (error) {
      console.error('Error adding to pinning queue:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Process pinning queue
  async processQueue() {
    if (this.isProcessing || this.pinningQueue.length === 0) {
      return;
    }

    this.isProcessing = true;
    console.log('Starting pinning queue processing...');

    while (this.pinningQueue.length > 0) {
      const item = this.pinningQueue.shift();
      
      try {
        await this.pinRecord(item);
      } catch (error) {
        console.error(`Error pinning record ${item.ipfsCid}:`, error);
        
        // Retry logic
        if (item.retryCount < this.maxRetries) {
          item.retryCount++;
          console.log(`Retrying pin for ${item.ipfsCid} (attempt ${item.retryCount})`);
          
          // Add delay before retry
          await new Promise(resolve => setTimeout(resolve, this.retryDelay));
          this.pinningQueue.push(item);
        } else {
          // Mark as failed
          await this.updatePinningStatus(item.id, 'FAILED', error.message);
          this.emit('pinningFailed', { cid: item.ipfsCid, error: error.message });
        }
      }
    }

    this.isProcessing = false;
    console.log('Pinning queue processing completed');
  }

  // Pin individual record
  async pinRecord(item) {
    const db = this.getDatabase();
    
    try {
      // Update status to pinning
      await this.updatePinningStatus(item.id, 'PINNING');
      
      // Pin to IPFS
      await ipfsService.pinFile(item.ipfsCid);
      
      // Update status to pinned
      await this.updatePinningStatus(item.id, 'PINNED');
      
      // Log success
      await this.logPinningAction(item.ipfsCid, 'PIN', 'SUCCESS', null, item.userId);
      
      // Emit success event
      this.emit('recordPinned', {
        cid: item.ipfsCid,
        resourceType: item.resourceType,
        resourceId: item.resourceId,
        priority: item.priority
      });
      
      console.log(`Successfully pinned: ${item.ipfsCid}`);
      
    } catch (error) {
      // Update status to failed
      await this.updatePinningStatus(item.id, 'FAILED', error.message);
      
      // Log failure
      await this.logPinningAction(item.ipfsCid, 'PIN', 'FAILED', error.message, item.userId);
      
      throw error;
    } finally {
      db.close();
    }
  }

  // Update pinning status
  async updatePinningStatus(recordId, status, errorMessage = null) {
    const db = this.getDatabase();
    
    try {
      const updates = ['pin_status = ?'];
      const params = [status];
      
      if (status === 'PINNED') {
        updates.push('pinned_at = CURRENT_TIMESTAMP');
      }
      
      if (errorMessage) {
        updates.push('error_message = ?');
        params.push(errorMessage);
      }
      
      params.push(recordId);
      
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE pinned_records SET ${updates.join(', ')} WHERE id = ?`,
          params,
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      console.error('Error updating pinning status:', error);
    } finally {
      db.close();
    }
  }

  // Unpin record
  async unpinRecord(ipfsCid, userId) {
    const db = this.getDatabase();
    
    try {
      // Get record info
      const record = await this.getPinnedRecord(ipfsCid);
      if (!record) {
        throw new Error('Record not found in pinning database');
      }

      // Unpin from IPFS
      await ipfsService.unpinFile(ipfsCid);
      
      // Update status
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE pinned_records SET pin_status = ? WHERE ipfs_cid = ?',
          ['UNPINNED', ipfsCid],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
      
      // Log action
      await this.logPinningAction(ipfsCid, 'UNPIN', 'SUCCESS', null, userId);
      
      // Emit event
      this.emit('recordUnpinned', {
        cid: ipfsCid,
        resourceType: record.resource_type,
        resourceId: record.resource_id
      });
      
      return true;
    } catch (error) {
      console.error('Error unpinning record:', error);
      
      // Log failure
      await this.logPinningAction(ipfsCid, 'UNPIN', 'FAILED', error.message, userId);
      
      throw error;
    } finally {
      db.close();
    }
  }

  // Get pinned record
  async getPinnedRecord(ipfsCid) {
    const db = this.getDatabase();
    
    try {
      const record = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM pinned_records WHERE ipfs_cid = ?',
          [ipfsCid],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (record && record.metadata) {
        record.metadata = JSON.parse(record.metadata);
      }

      return record;
    } catch (error) {
      console.error('Error getting pinned record:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Get all pinned records
  async getPinnedRecords(status = null, priority = null, resourceType = null) {
    const db = this.getDatabase();
    
    try {
      let query = 'SELECT * FROM pinned_records WHERE 1=1';
      const params = [];
      
      if (status) {
        query += ' AND pin_status = ?';
        params.push(status);
      }
      
      if (priority) {
        query += ' AND priority = ?';
        params.push(priority);
      }
      
      if (resourceType) {
        query += ' AND resource_type = ?';
        params.push(resourceType);
      }
      
      query += ' ORDER BY created_at DESC';
      
      const records = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      return records.map(record => {
        if (record.metadata) {
          record.metadata = JSON.parse(record.metadata);
        }
        return record;
      });
    } catch (error) {
      console.error('Error getting pinned records:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Verify pinned records
  async verifyPinnedRecords() {
    const db = this.getDatabase();
    
    try {
      const records = await this.getPinnedRecords('PINNED');
      const results = {
        verified: 0,
        failed: 0,
        missing: 0
      };
      
      for (const record of records) {
        try {
          // Verify the record exists on IPFS
          await ipfsService.verifyFileIntegrity(record.ipfs_cid, record.content_hash);
          
          // Update verification status
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE pinned_records SET verification_status = ?, last_verified = CURRENT_TIMESTAMP WHERE id = ?',
              ['VERIFIED', record.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          
          results.verified++;
        } catch (error) {
          console.error(`Verification failed for ${record.ipfsCid}:`, error);
          
          // Update verification status
          await new Promise((resolve, reject) => {
            db.run(
              'UPDATE pinned_records SET verification_status = ? WHERE id = ?',
              ['FAILED', record.id],
              function(err) {
                if (err) reject(err);
                else resolve();
              }
            );
          });
          
          results.failed++;
        }
      }
      
      this.emit('verificationCompleted', results);
      return results;
    } catch (error) {
      console.error('Error verifying pinned records:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Get pinning policy
  async getPinningPolicy(resourceType) {
    const db = this.getDatabase();
    
    try {
      const policy = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM pinning_policies WHERE resource_type = ?',
          [resourceType],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (policy && policy.conditions) {
        policy.conditions = JSON.parse(policy.conditions);
      }

      return policy;
    } catch (error) {
      console.error('Error getting pinning policy:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Create pinning policy
  async createPinningPolicy(resourceType, autoPin, priority, retentionDays, conditions = null) {
    const db = this.getDatabase();
    
    try {
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO pinning_policies 
           (resource_type, auto_pin, priority, retention_days, conditions)
           VALUES (?, ?, ?, ?, ?)`,
          [resourceType, autoPin, priority, retentionDays, JSON.stringify(conditions)],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      return result;
    } catch (error) {
      console.error('Error creating pinning policy:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Log pinning action
  async logPinningAction(cid, action, status, errorMessage, userId) {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'INSERT INTO pinning_audit_log (cid, action, status, error_message, user_id) VALUES (?, ?, ?, ?, ?)',
          [cid, action, status, errorMessage, userId],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });
    } catch (error) {
      console.error('Error logging pinning action:', error);
    } finally {
      db.close();
    }
  }

  // Get pinning statistics
  async getPinningStats() {
    const db = this.getDatabase();
    
    try {
      const stats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(*) as total_records,
            COUNT(CASE WHEN pin_status = 'PINNED' THEN 1 END) as pinned_count,
            COUNT(CASE WHEN pin_status = 'PENDING' THEN 1 END) as pending_count,
            COUNT(CASE WHEN pin_status = 'FAILED' THEN 1 END) as failed_count,
            COUNT(CASE WHEN verification_status = 'VERIFIED' THEN 1 END) as verified_count,
            COUNT(CASE WHEN priority = 'CRITICAL' THEN 1 END) as critical_count,
            COUNT(CASE WHEN priority = 'HIGH' THEN 1 END) as high_count
          FROM pinned_records
        `, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return stats;
    } catch (error) {
      console.error('Error getting pinning stats:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Start health monitoring
  startHealthMonitoring() {
    setInterval(async () => {
      try {
        await this.verifyPinnedRecords();
      } catch (error) {
        console.error('Health monitoring error:', error);
      }
    }, this.healthCheckInterval);
  }

  // Cleanup old unpinned records
  async cleanupOldRecords(daysOld = 30) {
    const db = this.getDatabase();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await new Promise((resolve, reject) => {
        db.run(
          `DELETE FROM pinned_records 
           WHERE pin_status IN ('UNPINNED', 'FAILED') 
           AND created_at < ?`,
          [cutoffDate.toISOString()],
          function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
          }
        );
      });

      console.log(`Cleaned up ${result.deleted} old pinning records`);
      return result;
    } catch (error) {
      console.error('Error cleaning up old records:', error);
      return { deleted: 0 };
    } finally {
      db.close();
    }
  }

  // Get queue status
  getQueueStatus() {
    return {
      queueLength: this.pinningQueue.length,
      isProcessing: this.isProcessing,
      maxRetries: this.maxRetries,
      retryDelay: this.retryDelay
    };
  }
}

module.exports = new PinningService();
