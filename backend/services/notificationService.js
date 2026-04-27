const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const NotificationQueue = require('./notificationQueue');
const NotificationTemplateEngine = require('./notificationTemplateEngine');
const NotificationDeliveryService = require('./notificationDeliveryService');
const UserPreferenceService = require('./userPreferenceService');

class NotificationService {
  constructor(io) {
    this.io = io;
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    
    this.queue = new NotificationQueue();
    this.templateEngine = new NotificationTemplateEngine();
    this.deliveryService = new NotificationDeliveryService();
    this.preferenceService = new UserPreferenceService();
    
    this.isProcessing = false;
    this.processingInterval = null;
  }

  async initialize() {
    try {
      // Initialize database connection
      await this.initializeDatabase();
      
      // Initialize services
      await this.queue.connect();
      await this.preferenceService.initialize();
      
      // Test external services
      await this.deliveryService.testEmailService();
      await this.deliveryService.testSMSService();
      
      // Start processing notifications
      this.startProcessing();
      
      console.log('Notification Service initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Notification Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
          return;
        }
        
        // Create enhanced notifications table if not exists
        const createEnhancedNotificationsTable = `
          CREATE TABLE IF NOT EXISTS notifications_enhanced (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            notification_id TEXT UNIQUE NOT NULL,
            title TEXT NOT NULL,
            message TEXT NOT NULL,
            type TEXT CHECK (type IN ('claim', 'payment', 'appointment', 'system', 'medical_record')),
            priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
            status TEXT CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'read')) DEFAULT 'pending',
            delivery_methods TEXT, -- JSON array of attempted delivery methods
            template_name TEXT,
            template_data TEXT, -- JSON object
            email_sent BOOLEAN DEFAULT FALSE,
            sms_sent BOOLEAN DEFAULT FALSE,
            push_sent BOOLEAN DEFAULT FALSE,
            in_app_sent BOOLEAN DEFAULT FALSE,
            sent_at DATETIME,
            read_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
          )
        `;

        this.db.run(createEnhancedNotificationsTable, (err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
      });
    });
  }

  async createNotification(userId, type, templateName, data, priority = 'medium') {
    try {
      // Generate notification content
      const title = this.templateEngine.render(templateName, data, 'title');
      const message = this.templateEngine.render(templateName, data, 'message');
      
      // Save to database
      const notificationId = await this.saveNotification(userId, {
        title,
        message,
        type,
        priority,
        templateName,
        templateData: data
      });

      // Get user preferences
      const preferences = await this.preferenceService.getUserPreferences(userId);
      const typePreferences = preferences[type];

      // Determine delivery methods based on preferences
      const deliveryMethods = [];
      
      if (await this.preferenceService.shouldSendNotification(userId, type, 'email')) {
        deliveryMethods.push('email');
      }
      
      if (await this.preferenceService.shouldSendNotification(userId, type, 'sms')) {
        deliveryMethods.push('sms');
      }
      
      if (await this.preferenceService.shouldSendNotification(userId, type, 'push')) {
        deliveryMethods.push('push');
      }
      
      if (await this.preferenceService.shouldSendNotification(userId, type, 'in_app')) {
        deliveryMethods.push('in_app');
      }

      // Add to queue for each delivery method
      for (const method of deliveryMethods) {
        await this.queue.addToQueue({
          id: notificationId,
          userId,
          type: method,
          notificationType: type,
          templateName,
          data,
          priority,
          deliveryMethods: deliveryMethods
        }, priority);
      }

      console.log(`Notification ${notificationId} created and queued for user ${userId}`);
      
      return {
        success: true,
        notificationId,
        deliveryMethods
      };
    } catch (error) {
      console.error('Error creating notification:', error);
      throw error;
    }
  }

  async saveNotification(userId, notificationData) {
    return new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notifications_enhanced 
        (user_id, notification_id, title, message, type, priority, 
         template_name, template_data, delivery_methods, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `;

      const { v4: uuidv4 } = require('uuid');
      const notificationId = uuidv4();

      const params = [
        userId,
        notificationId,
        notificationData.title,
        notificationData.message,
        notificationData.type,
        notificationData.priority,
        notificationData.templateName,
        JSON.stringify(notificationData.templateData),
        JSON.stringify(notificationData.deliveryMethods || [])
      ];

      this.db.run(query, params, function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve(notificationId);
      });
    });
  }

  startProcessing() {
    if (this.isProcessing) {
      return;
    }

    this.isProcessing = true;
    
    // Process notifications every 5 seconds
    this.processingInterval = setInterval(async () => {
      await this.processNotifications();
    }, 5000);

    console.log('Notification processing started');
  }

  async processNotifications() {
    const queues = ['email', 'sms', 'push', 'in_app'];
    
    for (const queueType of queues) {
      try {
        const notification = await this.queue.getNextFromQueue(`notifications:${queueType}`);
        
        if (notification) {
          await this.deliverNotification(notification, queueType);
        }
      } catch (error) {
        console.error(`Error processing ${queueType} queue:`, error);
      }
    }
  }

  async deliverNotification(notification, deliveryMethod) {
    try {
      // Get user information
      const user = await this.getUserInfo(notification.userId);
      if (!user) {
        console.error(`User ${notification.userId} not found`);
        return;
      }

      let result = { success: false };

      switch (deliveryMethod) {
        case 'email':
          result = await this.deliverEmail(user, notification);
          break;
        case 'sms':
          result = await this.deliverSMS(user, notification);
          break;
        case 'push':
          result = await this.deliverPush(user, notification);
          break;
        case 'in_app':
          result = await this.deliverInApp(notification);
          break;
      }

      // Update notification status
      await this.updateNotificationStatus(notification.id, deliveryMethod, result);

      if (!result.success) {
        // Requeue for retry
        await this.queue.requeueFailedNotification(notification);
      }
    } catch (error) {
      console.error(`Error delivering ${deliveryMethod} notification:`, error);
      await this.queue.requeueFailedNotification(notification);
    }
  }

  async deliverEmail(user, notification) {
    const subject = this.templateEngine.render(notification.templateName, notification.data, 'email.subject');
    const body = this.templateEngine.render(notification.templateName, notification.data, 'email.body');
    
    return await this.deliveryService.sendEmail(user.email, subject, body);
  }

  async deliverSMS(user, notification) {
    if (!user.phone) {
      return { success: false, error: 'User phone number not available' };
    }

    const message = this.templateEngine.render(notification.templateName, notification.data, 'sms');
    return await this.deliveryService.sendSMS(user.phone, message);
  }

  async deliverPush(user, notification) {
    const deviceTokens = await this.preferenceService.getUserDeviceTokens(user.id);
    if (deviceTokens.length === 0) {
      return { success: false, error: 'No device tokens found' };
    }

    const tokens = deviceTokens.map(dt => dt.device_token);
    const title = this.templateEngine.render(notification.templateName, notification.data, 'title');
    const message = this.templateEngine.render(notification.templateName, notification.data, 'message');
    
    return await this.deliveryService.sendPushNotification(tokens, title, message, notification.data);
  }

  async deliverInApp(notification) {
    try {
      // Send real-time notification via WebSocket
      this.io.to(`patient-${notification.userId}`).emit('notification', {
        id: notification.id,
        title: notification.data.title || notification.templateName,
        message: notification.data.message || 'New notification',
        type: notification.notificationType,
        priority: notification.priority,
        timestamp: new Date().toISOString()
      });

      return { success: true, method: 'websocket' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateNotificationStatus(notificationId, deliveryMethod, result) {
    return new Promise((resolve, reject) => {
      const updateField = `${deliveryMethod}_sent`;
      const query = `
        UPDATE notifications_enhanced 
        SET ${updateField} = ?, status = ?, updated_at = CURRENT_TIMESTAMP
        WHERE notification_id = ?
      `;

      const status = result.success ? 'sent' : 'failed';
      
      this.db.run(query, [result.success ? 1 : 0, status, notificationId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ updated: true, changes: this.changes });
      });
    });
  }

  async getUserInfo(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT u.*, p.phone, p.insurance_provider
        FROM users u
        LEFT JOIN patients p ON u.id = p.user_id
        WHERE u.id = ?
      `;
      
      this.db.get(query, [userId], (err, row) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(row);
      });
    });
  }

  async getUserNotifications(userId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notifications_enhanced 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(query, [userId, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  async markNotificationAsRead(notificationId, userId) {
    return new Promise((resolve, reject) => {
      const query = `
        UPDATE notifications_enhanced 
        SET status = 'read', read_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE notification_id = ? AND user_id = ?
      `;
      
      this.db.run(query, [notificationId, userId], function(err) {
        if (err) {
          reject(err);
          return;
        }
        resolve({ updated: true, changes: this.changes });
      });
    });
  }

  async getNotificationStats(userId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read,
          COUNT(CASE WHEN status != 'read' THEN 1 END) as unread,
          COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high,
          type,
          COUNT(*) as type_count
        FROM notifications_enhanced 
        WHERE user_id = ?
        GROUP BY type
      `;
      
      this.db.all(query, [userId], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        
        const stats = {
          total: 0,
          read: 0,
          unread: 0,
          urgent: 0,
          high: 0,
          byType: {}
        };

        rows.forEach(row => {
          stats.total += row.type_count;
          stats.read += row.read;
          stats.unread += row.unread;
          stats.urgent += row.urgent;
          stats.high += row.high;
          stats.byType[row.type] = row.type_count;
        });

        resolve(stats);
      });
    });
  }

  async stop() {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
    
    this.isProcessing = false;
    await this.queue.disconnect();
    this.preferenceService.close();
    
    if (this.db) {
      this.db.close();
    }
    
    console.log('Notification Service stopped');
  }
}

module.exports = NotificationService;
