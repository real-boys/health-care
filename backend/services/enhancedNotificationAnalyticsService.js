const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');

class EnhancedNotificationAnalyticsService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
  }

  async initialize() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          console.error('Error opening database for enhanced analytics:', err);
          reject(err);
          return;
        }
        console.log('Connected to SQLite database for enhanced notification analytics');
        this.createEnhancedAnalyticsTables().then(resolve).catch(reject);
      });
    });
  }

  async createEnhancedAnalyticsTables() {
    return new Promise((resolve, reject) => {
      const createEnhancedAnalyticsTable = `
        CREATE TABLE IF NOT EXISTS notification_analytics_enhanced (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          notification_id TEXT NOT NULL,
          user_id INTEGER NOT NULL,
          notification_type TEXT NOT NULL,
          delivery_method TEXT NOT NULL,
          status TEXT NOT NULL,
          priority TEXT NOT NULL,
          sent_at DATETIME,
          delivered_at DATETIME,
          read_at DATETIME,
          failed_reason TEXT,
          retry_count INTEGER DEFAULT 0,
          template_name TEXT,
          device_type TEXT,
          user_agent TEXT,
          ip_address TEXT,
          geolocation TEXT,
          delivery_time_ms INTEGER,
          processing_time_ms INTEGER,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id),
          INDEX idx_enhanced_notification_id (notification_id),
          INDEX idx_enhanced_user_id (user_id),
          INDEX idx_enhanced_type (notification_type),
          INDEX idx_enhanced_method (delivery_method),
          INDEX idx_enhanced_status (status),
          INDEX idx_enhanced_priority (priority),
          INDEX idx_enhanced_created (created_at)
        )
      `;

      const createHourlyStatsTable = `
        CREATE TABLE IF NOT EXISTS notification_hourly_stats (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          hour_timestamp DATETIME NOT NULL,
          notification_type TEXT NOT NULL,
          delivery_method TEXT NOT NULL,
          priority TEXT NOT NULL,
          total_sent INTEGER DEFAULT 0,
          total_delivered INTEGER DEFAULT 0,
          total_read INTEGER DEFAULT 0,
          total_failed INTEGER DEFAULT 0,
          delivery_rate DECIMAL(5,4) DEFAULT 0,
          read_rate DECIMAL(5,4) DEFAULT 0,
          avg_delivery_time_ms INTEGER DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(hour_timestamp, notification_type, delivery_method, priority)
        )
      `;

      const createUserEngagementTable = `
        CREATE TABLE IF NOT EXISTS user_notification_engagement (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          date DATE NOT NULL,
          total_received INTEGER DEFAULT 0,
          total_read INTEGER DEFAULT 0,
          total_clicked INTEGER DEFAULT 0,
          avg_read_time_ms INTEGER DEFAULT 0,
          last_activity_at DATETIME,
          most_active_hour INTEGER,
          preferred_channel TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, date),
          FOREIGN KEY (user_id) REFERENCES users (id)
        )
      `;

      const createPerformanceMetricsTable = `
        CREATE TABLE IF NOT EXISTS notification_performance_metrics (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          metric_date DATE NOT NULL,
          total_notifications INTEGER DEFAULT 0,
          unique_users INTEGER DEFAULT 0,
          avg_notifications_per_user DECIMAL(10,2) DEFAULT 0,
          peak_hour INTEGER,
          lowest_hour INTEGER,
          best_performing_type TEXT,
          worst_performing_type TEXT,
          best_performing_channel TEXT,
          worst_performing_channel TEXT,
          overall_delivery_rate DECIMAL(5,4) DEFAULT 0,
          overall_read_rate DECIMAL(5,4) DEFAULT 0,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(metric_date)
        )
      `;

      this.db.run(createEnhancedAnalyticsTable, (err) => {
        if (err) {
          reject(err);
          return;
        }

        this.db.run(createHourlyStatsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }

          this.db.run(createUserEngagementTable, (err) => {
            if (err) {
              reject(err);
              return;
            }

            this.db.run(createPerformanceMetricsTable, (err) => {
              if (err) {
                reject(err);
                return;
              }
              resolve();
            });
          });
        });
      });
    });
  }

  async trackNotificationDelivery(notificationId, userId, notificationType, deliveryMethod, status, metadata = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_analytics_enhanced 
        (notification_id, user_id, notification_type, delivery_method, status, priority,
         sent_at, delivered_at, read_at, failed_reason, retry_count, template_name,
         device_type, user_agent, ip_address, geolocation, delivery_time_ms, processing_time_ms)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      const params = [
        notificationId,
        userId,
        notificationType,
        deliveryMethod,
        status,
        metadata.priority || 'medium',
        metadata.sentAt || null,
        metadata.deliveredAt || null,
        metadata.readAt || null,
        metadata.failedReason || null,
        metadata.retryCount || 0,
        metadata.templateName || null,
        metadata.deviceType || null,
        metadata.userAgent || null,
        metadata.ipAddress || null,
        metadata.geolocation || null,
        metadata.deliveryTimeMs || null,
        metadata.processingTimeMs || null
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        
        // Update hourly stats asynchronously
        setImmediate(() => {
          this.updateHourlyStats(notificationType, deliveryMethod, metadata.priority || 'medium', status);
        });
        
        resolve({ id: this.lastID, tracked: true });
      });
    });
  }

  async updateHourlyStats(notificationType, deliveryMethod, priority, status) {
    const currentHour = moment().startOf('hour').format('YYYY-MM-DD HH:00:00');
    
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notification_hourly_stats 
        (hour_timestamp, notification_type, delivery_method, priority, total_sent, total_delivered, total_read, total_failed)
        VALUES (?, ?, ?, ?, 1, ?, ?, ?)
        ON CONFLICT(hour_timestamp, notification_type, delivery_method, priority)
        DO UPDATE SET
          total_sent = total_sent + 1,
          total_delivered = total_delivered + ?,
          total_read = total_read + ?,
          total_failed = total_failed + ?,
          delivery_rate = CAST(total_delivered AS REAL) / total_sent,
          read_rate = CAST(total_read AS REAL) / total_sent,
          updated_at = CURRENT_TIMESTAMP
      `;

      const isDelivered = status === 'delivered' ? 1 : 0;
      const isRead = status === 'read' ? 1 : 0;
      const isFailed = status === 'failed' ? 1 : 0;

      this.db.run(query, [
        currentHour, notificationType, deliveryMethod, priority,
        isDelivered, isRead, isFailed,
        isDelivered, isRead, isFailed
      ], (err) => {
        if (err) {
          console.error('Error updating hourly stats:', err);
        }
        resolve();
      });
    });
  }

  async getComprehensiveAnalytics(startDate = null, endDate = null, filters = {}) {
    const start = startDate || moment().subtract(30, 'days').format('YYYY-MM-DD');
    const end = endDate || moment().format('YYYY-MM-DD');

    return new Promise(async (resolve, reject) => {
      try {
        const overview = await this.getOverviewStats(start, end, filters);
        const trends = await this.getTrends(start, end, filters);
        const performance = await this.getPerformanceMetrics(start, end);
        const engagement = await this.getUserEngagementStats(start, end, filters);
        const delivery = await this.getDeliveryAnalysis(start, end, filters);

        resolve({
          overview,
          trends,
          performance,
          engagement,
          delivery,
          period: { start, end }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  async getOverviewStats(startDate, endDate, filters = {}) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT 
          COUNT(*) as total_notifications,
          COUNT(DISTINCT user_id) as unique_users,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_delivered,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as total_read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as total_failed,
          ROUND(CAST(COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as delivery_rate,
          ROUND(CAST(COUNT(CASE WHEN status = 'read' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as read_rate,
          AVG(delivery_time_ms) as avg_delivery_time,
          notification_type,
          delivery_method,
          priority
        FROM notification_analytics_enhanced
        WHERE DATE(created_at) BETWEEN ? AND ?
      `;

      const params = [startDate, endDate];

      if (filters.notificationType) {
        query += ` AND notification_type = ?`;
        params.push(filters.notificationType);
      }
      if (filters.deliveryMethod) {
        query += ` AND delivery_method = ?`;
        params.push(filters.deliveryMethod);
      }
      if (filters.priority) {
        query += ` AND priority = ?`;
        params.push(filters.priority);
      }

      query += ` GROUP BY notification_type, delivery_method, priority`;

      this.db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const totals = rows.reduce((acc, row) => {
          acc.total_notifications += row.total_notifications;
          acc.unique_users = Math.max(acc.unique_users, row.unique_users);
          acc.total_delivered += row.total_delivered;
          acc.total_read += row.total_read;
          acc.total_failed += row.total_failed;
          return acc;
        }, {
          total_notifications: 0,
          unique_users: 0,
          total_delivered: 0,
          total_read: 0,
          total_failed: 0
        });

        totals.delivery_rate = totals.total_notifications > 0 ? 
          Math.round((totals.total_delivered / totals.total_notifications) * 100 * 100) / 100 : 0;
        totals.read_rate = totals.total_notifications > 0 ? 
          Math.round((totals.total_read / totals.total_notifications) * 100 * 100) / 100 : 0;

        resolve({
          totals,
          byType: this.groupByField(rows, 'notification_type'),
          byMethod: this.groupByField(rows, 'delivery_method'),
          byPriority: this.groupByField(rows, 'priority'),
          details: rows
        });
      });
    });
  }

  async getTrends(startDate, endDate, filters = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          ROUND(CAST(COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as delivery_rate,
          ROUND(CAST(COUNT(CASE WHEN status = 'read' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as read_rate
        FROM notification_analytics_enhanced
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `;

      this.db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async getPerformanceMetrics(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          notification_type,
          delivery_method,
          COUNT(*) as total_sent,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as delivered,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
          ROUND(AVG(delivery_time_ms)) as avg_delivery_time,
          ROUND(AVG(processing_time_ms)) as avg_processing_time,
          ROUND(CAST(COUNT(CASE WHEN status = 'delivered' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as delivery_rate,
          ROUND(CAST(COUNT(CASE WHEN status = 'read' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as read_rate
        FROM notification_analytics_enhanced
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY notification_type, delivery_method
        ORDER BY delivery_rate DESC, read_rate DESC
      `;

      this.db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const bestPerforming = rows.reduce((best, current) => 
          (current.delivery_rate > best.delivery_rate) ? current : best, rows[0] || {});
        const worstPerforming = rows.reduce((worst, current) => 
          (current.delivery_rate < worst.delivery_rate) ? current : worst, rows[0] || {});

        resolve({
          byTypeAndMethod: rows,
          bestPerforming,
          worstPerforming,
          avgDeliveryTime: rows.reduce((sum, r) => sum + (r.avg_delivery_time || 0), 0) / rows.length || 0,
          avgProcessingTime: rows.reduce((sum, r) => sum + (r.avg_processing_time || 0), 0) / rows.length || 0
        });
      });
    });
  }

  async getUserEngagementStats(startDate, endDate, filters = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          user_id,
          COUNT(*) as total_received,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as total_read,
          COUNT(CASE WHEN status = 'delivered' THEN 1 END) as total_delivered,
          ROUND(CAST(COUNT(CASE WHEN status = 'read' THEN 1 END) AS REAL) / COUNT(*) * 100, 2) as engagement_rate,
          AVG(CASE WHEN read_at IS NOT NULL AND delivered_at IS NOT NULL 
            THEN (julianday(read_at) - julianday(delivered_at)) * 24 * 60 * 60 * 1000 
            END) as avg_read_time_ms,
          MAX(created_at) as last_activity
        FROM notification_analytics_enhanced
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY user_id
        ORDER BY total_received DESC
        LIMIT 100
      `;

      this.db.all(query, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const avgEngagementRate = rows.reduce((sum, r) => sum + r.engagement_rate, 0) / rows.length || 0;
        const avgReadTime = rows.reduce((sum, r) => sum + (r.avg_read_time_ms || 0), 0) / rows.length || 0;

        resolve({
          topUsers: rows.slice(0, 20),
          avgEngagementRate: Math.round(avgEngagementRate * 100) / 100,
          avgReadTime: Math.round(avgReadTime),
          totalActiveUsers: rows.length
        });
      });
    });
  }

  async getDeliveryAnalysis(startDate, endDate, filters = {}) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          delivery_method,
          priority,
          status,
          COUNT(*) as count,
          ROUND(CAST(COUNT(*) AS REAL) / (SELECT COUNT(*) FROM notification_analytics_enhanced WHERE DATE(created_at) BETWEEN ? AND ?) * 100, 2) as percentage
        FROM notification_analytics_enhanced
        WHERE DATE(created_at) BETWEEN ? AND ?
        GROUP BY delivery_method, priority, status
        ORDER BY delivery_method, priority, status
      `;

      this.db.all(query, [startDate, endDate, startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const analysis = {};
        rows.forEach(row => {
          if (!analysis[row.delivery_method]) {
            analysis[row.delivery_method] = {};
          }
          if (!analysis[row.delivery_method][row.priority]) {
            analysis[row.delivery_method][row.priority] = {};
          }
          analysis[row.delivery_method][row.priority][row.status] = row;
        });

        resolve({
          byMethodAndPriority: analysis,
          raw: rows
        });
      });
    });
  }

  async getRealTimeMetrics() {
    const lastHour = moment().subtract(1, 'hour').format('YYYY-MM-DD HH:mm:ss');

    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          delivery_method,
          status,
          COUNT(*) as count,
          AVG(delivery_time_ms) as avg_delivery_time
        FROM notification_analytics_enhanced
        WHERE created_at >= ?
        GROUP BY delivery_method, status
        ORDER BY count DESC
      `;

      this.db.all(query, [lastHour], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        const metrics = {
          totalLastHour: rows.reduce((sum, r) => sum + r.count, 0),
          byMethod: {},
          statusBreakdown: {}
        };

        rows.forEach(row => {
          if (!metrics.byMethod[row.delivery_method]) {
            metrics.byMethod[row.delivery_method] = { total: 0, avgDeliveryTime: 0 };
          }
          metrics.byMethod[row.delivery_method].total += row.count;
          metrics.byMethod[row.delivery_method].avgDeliveryTime = row.avg_delivery_time || 0;

          if (!metrics.statusBreakdown[row.status]) {
            metrics.statusBreakdown[row.status] = 0;
          }
          metrics.statusBreakdown[row.status] += row.count;
        });

        resolve(metrics);
      });
    });
  }

  groupByField(rows, field) {
    return rows.reduce((acc, row) => {
      if (!acc[row[field]]) {
        acc[row[field]] = {
          total_notifications: 0,
          total_delivered: 0,
          total_read: 0,
          total_failed: 0
        };
      }
      acc[row[field]].total_notifications += row.total_notifications;
      acc[row[field]].total_delivered += row.total_delivered;
      acc[row[field]].total_read += row.total_read;
      acc[row[field]].total_failed += row.total_failed;
      return acc;
    }, {});
  }

  async close() {
    if (this.db) {
      this.db.close();
    }
  }
}

module.exports = EnhancedNotificationAnalyticsService;
