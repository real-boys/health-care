const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

class NotificationDeliveryTracker {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.retryAttempts = new Map(); // notificationId -> retry count
    this.deliveryCallbacks = new Map(); // notificationId -> callback functions
    this.maxRetries = 3;
    this.retryDelays = [5000, 15000, 30000]; // 5s, 15s, 30s
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database for delivery tracker:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database for notification delivery tracker');
        this.createTrackingTables().then(resolve).catch(reject);
      });
    });
  }

  async createTrackingTables() {
    return new Promise((resolve, reject) => {
      const createDeliveryTrackingTable = `
        CREATE TABLE IF NOT EXISTS notification_delivery_tracking (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          delivery_method TEXT NOT NULL,
          status TEXT NOT NULL CHECK (status IN ('pending', 'processing', 'sent', 'delivered', 'failed', 'bounced', 'rejected')),
          priority TEXT NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
          attempt_count INTEGER DEFAULT 0,
          max_attempts INTEGER DEFAULT 3,
          next_retry_at DATETIME,
          last_attempt_at DATETIME,
          delivered_at DATETIME,
          failed_reason TEXT,
          error_code TEXT,
          provider_response TEXT, -- JSON response from provider
          delivery_time_ms INTEGER,
          processing_time_ms INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          INDEX idx_tracking_notification_id (notification_id),
          INDEX idx_tracking_user_id (user_id),
          INDEX idx_tracking_status (status),
          INDEX idx_tracking_delivery_method (delivery_method),
          INDEX idx_tracking_next_retry (next_retry_at),
          INDEX idx_tracking_created (created_at)
        )
      `;

      const createDeliveryEventsTable = `
        CREATE TABLE IF NOT EXISTS notification_delivery_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tracking_id INTEGER NOT NULL,
          event_type TEXT NOT NULL CHECK (event_type IN ('queued', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
          event_timestamp DATETIME NOT NULL,
          provider_event_id TEXT,
          event_data TEXT, -- JSON object with event details
          ip_address TEXT,
          user_agent TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (tracking_id) REFERENCES notification_delivery_tracking (id) ON DELETE CASCADE,
          INDEX idx_events_tracking_id (tracking_id),
          INDEX idx_events_type (event_type),
          INDEX idx_events_timestamp (event_timestamp)
        )
      `;

      const createDeliverySLATable = `
        CREATE TABLE IF NOT EXISTS notification_delivery_sla (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATE NOT NULL,
          delivery_method TEXT NOT NULL,
          priority TEXT NOT NULL,
          total_notifications INTEGER DEFAULT 0,
          delivered_within_sla INTEGER DEFAULT 0,
          delivered_after_sla INTEGER DEFAULT 0,
          failed INTEGER DEFAULT 0,
          avg_delivery_time_ms INTEGER DEFAULT 0,
          sla_compliance_rate DECIMAL(5,4) DEFAULT 0,
          sla_target_ms INTEGER DEFAULT 30000, -- 30 seconds default SLA
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, delivery_method, priority)
        )
      `;

      this.db.run(createDeliveryTrackingTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createDeliveryEventsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.run(createDeliverySLATable, (err) => {
            if (err) {
              reject(err);
              return;
            }
            resolve();
          });
        });
      });
    });
  }

  async trackDeliveryAttempt(notificationId, userId, deliveryMethod, priority, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_delivery_tracking 
        (notification_id, user_id, delivery_method, status, priority, 
         attempt_count, max_attempts, last_attempt_at, processing_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        notificationId,
        userId,
        deliveryMethod,
        'pending',
        priority,
        0,
        this.maxRetries,
        new Date().toISOString(),
        metadata.processingTimeMs || null
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }

        const trackingId = this.lastID;
        
        // Log initial event
        setImmediate(() => {
          this.logDeliveryEvent(trackingId, 'queued', {
            notificationId,
            userId,
            deliveryMethod,
            priority
          });
        });

        resolve({ trackingId, tracked: true });
      });
    });
  }

  async updateDeliveryStatus(trackingId, status, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notification_delivery_tracking 
        SET status = ?, attempt_count = attempt_count + 1, last_attempt_at = ?, 
            failed_reason = ?, error_code = ?, provider_response = ?, 
            delivery_time_ms = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      const params = [
        status,
        new Date().toISOString(),
        metadata.failedReason || null,
        metadata.errorCode || null,
        metadata.providerResponse ? JSON.stringify(metadata.providerResponse) : null,
        metadata.deliveryTimeMs || null,
        trackingId
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }

        // Log delivery event
        setImmediate(() => {
          this.logDeliveryEvent(trackingId, status, {
            failedReason: metadata.failedReason,
            errorCode: metadata.errorCode,
            deliveryTimeMs: metadata.deliveryTimeMs
          });
        });

        // Update SLA metrics for successful deliveries
        if (status === 'delivered') {
          setImmediate(() => {
            this.updateSLAMetrics(trackingId, metadata.deliveryTimeMs);
          });
        }

        resolve({ updated: true, changes: this.changes });
      });
    });
  }

  async markAsDelivered(trackingId, deliveryTimeMs = null) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notification_delivery_tracking 
        SET status = 'delivered', delivered_at = ?, delivery_time_ms = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `;

      this.db.run(query, [new Date().toISOString(), deliveryTimeMs, trackingId], function(err) {
        if (err) {
          reject(err);
          return;
        }

        // Log delivery event
        setImmediate(() => {
          this.logDeliveryEvent(trackingId, 'delivered', {
            deliveryTimeMs
          });
        });

        // Update SLA metrics
        setImmediate(() => {
          this.updateSLAMetrics(trackingId, deliveryTimeMs);
        });

        resolve({ updated: true, changes: this.changes });
      });
    });
  }

  async scheduleRetry(trackingId, retryDelay = null) {
    return new Promise((resolve, reject) => {
      // Get current tracking info
      this.getTrackingById(trackingId).then(tracking => {
        if (tracking.attempt_count >= tracking.max_attempts) {
          // Max retries reached, mark as failed
          this.updateDeliveryStatus(trackingId, 'failed', {
            failedReason: 'Maximum retry attempts exceeded'
          }).then(resolve).catch(reject);
          return;
        }

        const delay = retryDelay || this.retryDelays[tracking.attempt_count] || 30000;
        const nextRetryAt = new Date(Date.now() + delay);

        const query = `
          UPDATE notification_delivery_tracking 
          SET status = 'pending', next_retry_at = ?, updated_at = CURRENT_TIMESTAMP
          WHERE id = ?
        `;

        this.db.run(query, [nextRetryAt.toISOString(), trackingId], function(err) {
          if (err) {
            reject(err);
            return;
          }

          // Schedule retry
          setTimeout(() => {
            this.processRetry(trackingId);
          }, delay);

          resolve({ scheduled: true, nextRetryAt });
        });
      }).catch(reject);
    });
  }

  async processRetry(trackingId) {
    try {
      const tracking = await this.getTrackingById(trackingId);
      
      if (tracking.status !== 'pending' || tracking.attempt_count >= tracking.max_attempts) {
        return;
      }

      // Update status to processing
      await this.updateDeliveryStatus(trackingId, 'processing');

      // Get notification details for retry
      const notification = await this.getNotificationDetails(tracking.notification_id);
      
      if (!notification) {
        await this.updateDeliveryStatus(trackingId, 'failed', {
          failedReason: 'Notification not found for retry'
        });
        return;
      }

      // Trigger retry through notification service
      const NotificationService = require('./notificationService');
      const notificationService = new NotificationService();
      
      // This would be implemented in the notification service
      console.log(`Retrying notification ${tracking.notification_id} via ${tracking.delivery_method}`);
      
    } catch (error) {
      console.error('Error processing retry:', error);
      await this.updateDeliveryStatus(trackingId, 'failed', {
        failedReason: `Retry processing error: ${error.message}`
      });
    }
  }

  async logDeliveryEvent(trackingId, eventType, eventData = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_delivery_events 
        (tracking_id, event_type, event_timestamp, event_data)
        VALUES (?, ?, ?, ?)
      `;

      const params = [
        trackingId,
        eventType,
        new Date().toISOString(),
        JSON.stringify(eventData)
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, logged: true });
      });
    });
  }

  async updateSLAMetrics(trackingId, deliveryTimeMs) {
    try {
      const tracking = await this.getTrackingById(trackingId);
      const today = moment().format('YYYY-MM-DD');
      const slaTargetMs = this.getSLATarget(tracking.priority);

      const query = `
        INSERT INTO notification_delivery_sla 
        (date, delivery_method, priority, total_notifications, delivered_within_sla, 
         delivered_after_sla, avg_delivery_time_ms, sla_target_ms)
        VALUES (?, ?, ?, 1, ?, ?, ?, ?)
        ON CONFLICT(date, delivery_method, priority)
        DO UPDATE SET
          total_notifications = total_notifications + 1,
          delivered_within_sla = delivered_within_sla + ?,
          delivered_after_sla = delivered_after_sla + ?,
          avg_delivery_time_ms = (avg_delivery_time_ms * (total_notifications - 1) + ?) / total_notifications,
          sla_compliance_rate = CAST(delivered_within_sla AS REAL) / total_notifications,
          updated_at = CURRENT_TIMESTAMP
      `;

      const withinSLA = deliveryTimeMs && deliveryTimeMs <= slaTargetMs ? 1 : 0;
      const afterSLA = deliveryTimeMs && deliveryTimeMs > slaTargetMs ? 1 : 0;

      this.db.run(query, [
        today, tracking.delivery_method, tracking.priority,
        withinSLA, afterSLA, deliveryTimeMs || 0, slaTargetMs,
        withinSLA, afterSLA, deliveryTimeMs || 0
      ]);
    } catch (error) {
      console.error('Error updating SLA metrics:', error);
    }
  }

  getSLATarget(priority) {
    const slaTargets = {
      urgent: 5000,   // 5 seconds
      high: 10000,    // 10 seconds
      medium: 30000,  // 30 seconds
      low: 60000      // 60 seconds
    };
    return slaTargets[priority] || 30000;
  }

  async getTrackingById(trackingId) {
    return new Promise((resolve, reject) => {
      const query = `SELECT * FROM notification_delivery_tracking WHERE id = ?`;

      this.db.get(query, [trackingId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async getNotificationDetails(notificationId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notifications_enhanced 
        WHERE notification_id = ?
      `;

      this.db.get(query, [notificationId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async getPendingRetries() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notification_delivery_tracking 
        WHERE status = 'pending' 
        AND next_retry_at <= ?
        AND attempt_count < max_attempts
        ORDER BY next_retry_at ASC
      `;

      this.db.all(query, [new Date().toISOString()], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getDeliveryStats(startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          delivery_method,
          priority,
          status,
          COUNT(*) as count,
          AVG(delivery_time_ms) as avg_delivery_time,
          AVG(processing_time_ms) as avg_processing_time,
          DATE(created_at) as date
        FROM notification_delivery_tracking
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        query += ` AND DATE(created_at) >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND DATE(created_at) <= ?`;
        params.push(endDate);
      }

      query += ` GROUP BY delivery_method, priority, status, DATE(created_at) ORDER BY date DESC`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getSLAReport(startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          date,
          delivery_method,
          priority,
          total_notifications,
          delivered_within_sla,
          delivered_after_sla,
          failed,
          avg_delivery_time_ms,
          sla_compliance_rate,
          sla_target_ms
        FROM notification_delivery_sla
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        query += ` AND date >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND date <= ?`;
        params.push(endDate);
      }

      query += ` ORDER BY date DESC, delivery_method, priority`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getDeliveryEvents(trackingId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notification_delivery_events 
        WHERE tracking_id = ?
        ORDER BY event_timestamp ASC
      `;

      this.db.all(query, [trackingId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async cleanupOldRecords(daysToKeep = 90) {
    const cutoffDate = moment().subtract(daysToKeep, 'days').format('YYYY-MM-DD');
    
    return new Promise((resolve, reject) => {
      const query = `
        DELETE FROM notification_delivery_tracking 
        WHERE created_at < ? AND status IN ('delivered', 'failed', 'bounced')
      `;

      this.db.run(query, [cutoffDate], function(err) {
        if (err) {
          reject(err);
          return;
        }
        console.log(`Cleaned up ${this.changes} old delivery tracking records`);
        resolve({ deleted: this.changes });
      });
    });
  }

  // Start retry processor
  startRetryProcessor() {
    // Process retries every 30 seconds
    setInterval(async () => {
      try {
        const pendingRetries = await this.getPendingRetries();
        
        for (const retry of pendingRetries) {
          await this.processRetry(retry.id);
        }
        
        if (pendingRetries.length > 0) {
          console.log(`Processed ${pendingRetries.length} pending retries`);
        }
      } catch (error) {
        console.error('Error in retry processor:', error);
      }
    }, 30000);

    console.log('Delivery retry processor started');
  }

  // Get reliability metrics
  async getReliabilityMetrics(startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          delivery_method,
          COUNT(*) as total_attempts,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as successful_deliveries,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_deliveries,
          COUNT(CASE WHEN status = 'bounced' THEN 1 END) as bounced,
          COUNT(CASE WHEN attempt_count > 1 THEN 1 END) as retries_required,
          AVG(CASE WHEN status = 'delivered' THEN delivery_time_ms END) as avg_delivery_time,
          MAX(CASE WHEN status = 'delivered' THEN delivery_time_ms END) as max_delivery_time,
          MIN(CASE WHEN status = 'delivered' THEN delivery_time_ms END) as min_delivery_time,
          ROUND(CAST(COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as success_rate,
          ROUND(CAST(COUNT(CASE WHEN attempt_count > 1 THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as retry_rate
        FROM notification_delivery_tracking
        WHERE 1=1
      `;
      const params = [];

      if (startDate) {
        query += ` AND DATE(created_at) >= ?`;
        params.push(startDate);
      }
      if (endDate) {
        query += ` AND DATE(created_at) <= ?`;
        params.push(endDate);
      }

      query += ` GROUP BY delivery_method ORDER BY success_rate DESC`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = NotificationDeliveryTracker;
