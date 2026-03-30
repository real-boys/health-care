const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class NotificationAnalyticsService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database for analytics:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database for notification analytics');
        this.createAnalyticsTables().then(resolve).catch(reject);
      });
    });
  }

  async createAnalyticsTables() {
    return new Promise((resolve, reject) => {
      const createNotificationAnalyticsTable = `
        CREATE TABLE IF NOT EXISTS notification_analytics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          notification_type TEXT NOT NULL,
          delivery_method TEXT NOT NULL,
          status TEXT NOT NULL,
          sent_at DATETIME,
          delivered_at DATETIME,
          read_at DATETIME,
          failed_reason TEXT,
          retry_count INTEGER DEFAULT 0,
          template_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          INDEX idx_notification_analytics_notification_id (notification_id),
          INDEX idx_notification_analytics_user_id (user_id),
          INDEX idx_notification_analytics_type (notification_type),
          INDEX idx_notification_analytics_method (delivery_method),
          INDEX idx_notification_analytics_status (status),
          INDEX idx_notification_analytics_created (created_at)
        )
      `;

      const createDailyStatsTable = `
        CREATE TABLE IF NOT EXISTS notification_daily_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          date DATE NOT NULL,
          notification_type TEXT NOT NULL,
          delivery_method TEXT NOT NULL,
          total_sent INTEGER DEFAULT 0,
          total_delivered INTEGER DEFAULT 0,
          total_read INTEGER DEFAULT 0,
          total_failed INTEGER DEFAULT 0,
          delivery_rate DECIMAL(5,4) DEFAULT 0,
          read_rate DECIMAL(5,4) DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(date, notification_type, delivery_method)
        )
      `;

      this.db.run(createNotificationAnalyticsTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createDailyStatsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  async trackNotificationDelivery(notificationId, userId, notificationType, deliveryMethod, status, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_analytics 
        (notification_id, user_id, notification_type, delivery_method, status, 
         sent_at, delivered_at, read_at, failed_reason, retry_count, template_name)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        notificationId,
        userId,
        notificationType,
        deliveryMethod,
        status,
        metadata.sentAt || null,
        metadata.deliveredAt || null,
        metadata.readAt || null,
        metadata.failedReason || null,
        metadata.retryCount || 0,
        metadata.templateName || null
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ id: this.lastID, tracked: true });
      });
    });
  }

  async updateNotificationStatus(notificationId, deliveryMethod, newStatus, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notification_analytics 
        SET status = ?, delivered_at = ?, read_at = ?, failed_reason = ?, retry_count = ?
        WHERE notification_id = ? AND delivery_method = ?
      `;

      const params = [
        newStatus,
        metadata.deliveredAt || null,
        metadata.readAt || null,
        metadata.failedReason || null,
        metadata.retryCount || 0,
        notificationId,
        deliveryMethod
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ updated: true, changes: this.changes });
      });
    });
  }

  async getNotificationStats(userId, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          notification_type,
          delivery_method,
          status,
          COUNT(*) as count,
          AVG(retry_count) as avg_retry_count
        FROM notification_analytics 
        WHERE user_id = ?
      `;
      const params = [userId];

      if (startDate) {
        query += ` AND DATE(created_at) >= DATE(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(created_at) <= DATE(?)`;
        params.push(endDate);
      }

      query += ` GROUP BY notification_type, delivery_method, status`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const stats = this.processNotificationStats(rows);
        resolve(stats);
      });
    });
  }

  processNotificationStats(rows) {
    const stats = {
      total: 0,
      byType: {},
      byMethod: {},
      byStatus: {},
      deliveryRates: {},
      readRates: {}
    };

    rows.forEach(row => {
      stats.total += row.count;

      // By type
      if (!stats.byType[row.notification_type]) {
        stats.byType[row.notification_type] = { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
      }
      stats.byType[row.notification_type][row.status] = (stats.byType[row.notification_type][row.status] || 0) + row.count;
      stats.byType[row.notification_type].total += row.count;

      // By method
      if (!stats.byMethod[row.delivery_method]) {
        stats.byMethod[row.delivery_method] = { total: 0, sent: 0, delivered: 0, read: 0, failed: 0 };
      }
      stats.byMethod[row.delivery_method][row.status] = (stats.byMethod[row.delivery_method][row.status] || 0) + row.count;
      stats.byMethod[row.delivery_method].total += row.count;

      // By status
      stats.byStatus[row.status] = (stats.byStatus[row.status] || 0) + row.count;
    });

    // Calculate rates
    Object.keys(stats.byType).forEach(type => {
      const typeStats = stats.byType[type];
      stats.deliveryRates[type] = typeStats.total > 0 ? (typeStats.delivered / typeStats.total) * 100 : 0;
      stats.readRates[type] = typeStats.total > 0 ? (typeStats.read / typeStats.total) * 100 : 0;
    });

    Object.keys(stats.byMethod).forEach(method => {
      const methodStats = stats.byMethod[method];
      stats.deliveryRates[method] = methodStats.total > 0 ? (methodStats.delivered / methodStats.total) * 100 : 0;
      stats.readRates[method] = methodStats.total > 0 ? (methodStats.read / methodStats.total) * 100 : 0;
    });

    return stats;
  }

  async getSystemWideStats(startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          DATE(created_at) as date,
          notification_type,
          delivery_method,
          status,
          COUNT(*) as count
        FROM notification_analytics 
      `;
      const params = [];

      if (startDate) {
        query += ` WHERE DATE(created_at) >= DATE(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += startDate ? ` AND DATE(created_at) <= DATE(?)` : ` WHERE DATE(created_at) <= DATE(?)`;
        params.push(endDate);
      }

      query += ` GROUP BY DATE(created_at), notification_type, delivery_method, status ORDER BY date DESC`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const stats = this.processSystemStats(rows);
        resolve(stats);
      });
    });
  }

  processSystemStats(rows) {
    const stats = {
      dailyStats: {},
      overall: {
        total: 0,
        byType: {},
        byMethod: {},
        byStatus: {}
      },
      trends: {}
    };

    rows.forEach(row => {
      // Daily stats
      if (!stats.dailyStats[row.date]) {
        stats.dailyStats[row.date] = {
          total: 0,
          byType: {},
          byMethod: {},
          byStatus: {}
        };
      }

      const dayStats = stats.dailyStats[row.date];
      dayStats.total += row.count;

      // Daily by type
      if (!dayStats.byType[row.notification_type]) {
        dayStats.byType[row.notification_type] = 0;
      }
      dayStats.byType[row.notification_type] += row.count;

      // Daily by method
      if (!dayStats.byMethod[row.delivery_method]) {
        dayStats.byMethod[row.delivery_method] = 0;
      }
      dayStats.byMethod[row.delivery_method] += row.count;

      // Daily by status
      if (!dayStats.byStatus[row.status]) {
        dayStats.byStatus[row.status] = 0;
      }
      dayStats.byStatus[row.status] += row.count;

      // Overall stats
      stats.overall.total += row.count;

      if (!stats.overall.byType[row.notification_type]) {
        stats.overall.byType[row.notification_type] = 0;
      }
      stats.overall.byType[row.notification_type] += row.count;

      if (!stats.overall.byMethod[row.delivery_method]) {
        stats.overall.byMethod[row.delivery_method] = 0;
      }
      stats.overall.byMethod[row.delivery_method] += row.count;

      if (!stats.overall.byStatus[row.status]) {
        stats.overall.byStatus[row.status] = 0;
      }
      stats.overall.byStatus[row.status] += row.count;
    });

    return stats;
  }

  async generateDailyStats(date = null) {
    const targetDate = date || new Date().toISOString().split('T')[0];
    
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          notification_type,
          delivery_method,
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as total_read,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as total_failed
        FROM notification_analytics 
        WHERE DATE(created_at) = DATE(?)
        GROUP BY notification_type, delivery_method
      `;

      this.db.all(query, [targetDate], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const insertPromises = rows.map(row => {
          return new Promise((resolveInsert, rejectInsert) => {
            const deliveryRate = row.total_sent > 0 ? (row.total_delivered / row.total_sent) : 0;
            const readRate = row.total_sent > 0 ? (row.total_read / row.total_sent) : 0;

            const insertQuery = `
              INSERT OR REPLACE INTO notification_daily_stats 
              (date, notification_type, delivery_method, total_sent, total_delivered, 
               total_read, total_failed, delivery_rate, read_rate, updated_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            const params = [
              targetDate,
              row.notification_type,
              row.delivery_method,
              row.total_sent,
              row.total_delivered,
              row.total_read,
              row.total_failed,
              deliveryRate,
              readRate
            ];

            this.db.run(insertQuery, params, function(err) {
              if (err) {
                rejectInsert(err);
                return;
              }
              resolveInsert({ id: this.lastID });
            });
          });
        });

        Promise.all(insertPromises)
          .then(results => resolve({ date: targetDate, recordsCreated: results.length }))
          .catch(reject);
      });
    });
  }

  async getDailyStats(startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          date,
          notification_type,
          delivery_method,
          total_sent,
          total_delivered,
          total_read,
          total_failed,
          delivery_rate,
          read_rate
        FROM notification_daily_stats
      `;
      const params = [];

      if (startDate) {
        query += ` WHERE date >= DATE(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += startDate ? ` AND date <= DATE(?)` : ` WHERE date <= DATE(?)`;
        params.push(endDate);
      }

      query += ` ORDER BY date DESC, notification_type, delivery_method`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getTopPerformingTemplates(limit = 10, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          template_name,
          notification_type,
          COUNT(*) as total_sent,
          SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) as total_delivered,
          SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) as total_read,
          (CAST(SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)) * 100 as delivery_rate,
          (CAST(SUM(CASE WHEN status = 'read' THEN 1 ELSE 0 END) AS FLOAT) / COUNT(*)) * 100 as read_rate
        FROM notification_analytics 
        WHERE template_name IS NOT NULL
      `;
      const params = [];

      if (startDate) {
        query += ` AND DATE(created_at) >= DATE(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(created_at) <= DATE(?)`;
        params.push(endDate);
      }

      query += `
        GROUP BY template_name, notification_type 
        ORDER BY delivery_rate DESC, read_rate DESC 
        LIMIT ?
      `;
      params.push(limit);

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getFailedNotifications(limit = 50, startDate = null, endDate = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          na.*,
          u.email,
          u.first_name,
          u.last_name
        FROM notification_analytics na
        JOIN users u ON na.user_id = u.id
        WHERE na.status = 'failed'
      `;
      const params = [];

      if (startDate) {
        query += ` AND DATE(na.created_at) >= DATE(?)`;
        params.push(startDate);
      }

      if (endDate) {
        query += ` AND DATE(na.created_at) <= DATE(?)`;
        params.push(endDate);
      }

      query += ` ORDER BY na.created_at DESC LIMIT ?`;
      params.push(limit);

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('Error closing analytics database:', err);
        } else {
          console.log('Analytics database connection closed');
        }
      });
    }
  }
}

module.exports = NotificationAnalyticsService;
