const NotificationService = require('./notificationService');
const EnhancedNotificationAnalyticsService = require('./enhancedNotificationAnalyticsService');
const NotificationTemplateManager = require('./notificationTemplateManager');
const WebSocketNotificationService = require('./websocketNotificationService');
const NotificationDeliveryTracker = require('./notificationDeliveryTracker');
const UserPreferenceService = require('./userPreferenceService');

class NotificationIntegration {
  constructor(io) {
    this.io = io;
    this.services = {};
    this.isInitialized = false;
  }

  async initialize() {
    try {
      console.log('Initializing comprehensive notification system...');

      // Initialize core services
      this.services.notificationService = new NotificationService(this.io);
      this.services.analyticsService = new EnhancedNotificationAnalyticsService();
      this.services.templateManager = new NotificationTemplateManager();
      this.services.websocketService = new WebSocketNotificationService(this.io);
      this.services.deliveryTracker = new NotificationDeliveryTracker();
      this.services.preferenceService = new UserPreferenceService();

      // Initialize all services
      await Promise.all([
        this.services.notificationService.initialize(),
        this.services.analyticsService.initialize(),
        this.services.templateManager.initialize(),
        this.services.deliveryTracker.initialize(),
        this.services.preferenceService.initialize()
      ]);

      // Start background processes
      this.services.deliveryTracker.startRetryProcessor();

      // Setup service integrations
      this.setupServiceIntegrations();

      this.isInitialized = true;
      console.log('Comprehensive notification system initialized successfully');

      return true;
    } catch (error) {
      console.error('Failed to initialize notification system:', error);
      throw error;
    }
  }

  setupServiceIntegrations() {
    // Enhance notification service with tracking
    const originalCreateNotification = this.services.notificationService.createNotification.bind(this.services.notificationService);
    
    this.services.notificationService.createNotification = async (userId, type, templateName, data, priority = 'medium') => {
      try {
        // Create notification
        const result = await originalCreateNotification(userId, type, templateName, data, priority);
        
        // Track delivery attempts for each method
        for (const method of result.deliveryMethods) {
          await this.services.deliveryTracker.trackDeliveryAttempt(
            result.notificationId,
            userId,
            method,
            priority,
            {
              templateName,
              processingTimeMs: Date.now() // Will be updated with actual time
            }
          );
        }

        // Render template for analytics
        const renderResult = await this.services.templateManager.renderTemplate(
          templateName,
          type,
          'in_app', // Default channel for rendering
          data
        );

        // Track template usage
        await this.services.templateManager.trackTemplateUsage(
          renderResult.templateId,
          result.notificationId,
          userId,
          renderResult
        );

        return result;
      } catch (error) {
        console.error('Error in enhanced createNotification:', error);
        throw error;
      }
    };

    // Enhance delivery service with tracking
    const originalDeliverNotification = this.services.notificationService.deliverNotification.bind(this.services.notificationService);
    
    this.services.notificationService.deliverNotification = async (notification, deliveryMethod) => {
      const startTime = Date.now();
      
      try {
        // Get tracking info
        const trackingRecords = await this.getTrackingRecords(notification.id, deliveryMethod);
        
        // Original delivery
        const result = await originalDeliverNotification(notification, deliveryMethod);
        
        const deliveryTime = Date.now() - startTime;

        // Update tracking based on result
        for (const tracking of trackingRecords) {
          if (result.success) {
            await this.services.deliveryTracker.markAsDelivered(tracking.id, deliveryTime);
            await this.services.analyticsService.updateNotificationStatus(
              notification.id,
              deliveryMethod,
              'delivered',
              {
                deliveredAt: new Date().toISOString(),
                deliveryTimeMs: deliveryTime
              }
            );
          } else {
            await this.services.deliveryTracker.updateDeliveryStatus(tracking.id, 'failed', {
              failedReason: result.error,
              deliveryTimeMs: deliveryTime
            });
            
            // Schedule retry if applicable
            if (deliveryMethod !== 'in_app') { // Don't retry in-app notifications
              await this.services.deliveryTracker.scheduleRetry(tracking.id);
            }
            
            await this.services.analyticsService.updateNotificationStatus(
              notification.id,
              deliveryMethod,
              'failed',
              {
                failedReason: result.error,
                deliveryTimeMs: deliveryTime
              }
            );
          }
        }

        return result;
      } catch (error) {
        console.error('Error in enhanced deliverNotification:', error);
        
        // Update tracking with error
        const trackingRecords = await this.getTrackingRecords(notification.id, deliveryMethod);
        for (const tracking of trackingRecords) {
          await this.services.deliveryTracker.updateDeliveryStatus(tracking.id, 'failed', {
            failedReason: error.message
          });
        }
        
        throw error;
      }
    };
  }

  async getTrackingRecords(notificationId, deliveryMethod) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM notification_delivery_tracking 
        WHERE notification_id = ? AND delivery_method = ?
        ORDER BY id DESC
      `;

      this.services.deliveryTracker.db.all(query, [notificationId, deliveryMethod], (err, rows) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(rows);
      });
    });
  }

  // Public API methods
  async sendNotification(userId, type, templateName, data, priority = 'medium', options = {}) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    try {
      // Check user preferences
      const preferences = await this.services.preferenceService.getUserPreferences(userId);
      const typePreferences = preferences[type] || {};

      // Override with options if provided
      const channels = options.channels || typePreferences.channels || ['in_app'];

      // Create notification
      const result = await this.services.notificationService.createNotification(
        userId,
        type,
        templateName,
        data,
        priority
      );

      // Send real-time notification if user is online
      if (channels.includes('in_app')) {
        await this.services.websocketService.sendNotificationToUser(userId, {
          id: result.notificationId,
          title: data.title || templateName,
          message: data.message || 'New notification',
          type,
          priority,
          data
        });
      }

      return result;
    } catch (error) {
      console.error('Error sending notification:', error);
      throw error;
    }
  }

  async sendBulkNotifications(recipients, type, templateName, data, priority = 'medium', options = {}) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    const results = [];
    const startTime = Date.now();

    for (const recipient of recipients) {
      try {
        const result = await this.sendNotification(
          recipient.userId,
          type,
          templateName,
          { ...data, ...recipient.customData },
          priority,
          options
        );
        
        results.push({
          userId: recipient.userId,
          success: true,
          notificationId: result.notificationId
        });
      } catch (error) {
        results.push({
          userId: recipient.userId,
          success: false,
          error: error.message
        });
      }
    }

    const processingTime = Date.now() - startTime;
    const successful = results.filter(r => r.success).length;

    return {
      summary: {
        total: recipients.length,
        successful,
        failed: recipients.length - successful,
        processingTime: `${processingTime}ms`
      },
      results
    };
  }

  async sendSystemNotification(title, message, priority = 'medium', data = {}) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.websocketService.sendSystemNotification({
      title,
      message,
      priority,
      data
    });
  }

  async getUserNotifications(userId, filters = {}) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.notificationService.getUserNotifications(
      userId,
      filters.limit || 50,
      filters.offset || 0
    );
  }

  async markNotificationAsRead(notificationId, userId) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    const result = await this.services.notificationService.markNotificationAsRead(notificationId, userId);
    
    // Update analytics
    await this.services.analyticsService.updateNotificationStatus(
      notificationId,
      'in_app',
      'read',
      {
        readAt: new Date().toISOString()
      }
    );

    return result;
  }

  async getAnalytics(startDate, endDate, filters = {}) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    const [analytics, realTimeMetrics, reliabilityMetrics, slaReport] = await Promise.all([
      this.services.analyticsService.getComprehensiveAnalytics(startDate, endDate, filters),
      this.services.analyticsService.getRealTimeMetrics(),
      this.services.deliveryTracker.getReliabilityMetrics(startDate, endDate),
      this.services.deliveryTracker.getSLAReport(startDate, endDate)
    ]);

    return {
      analytics,
      realTimeMetrics,
      reliabilityMetrics,
      slaReport
    };
  }

  async createTemplate(templateData, createdBy) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    // Validate template
    const validationErrors = await this.services.templateManager.validateTemplate(templateData);
    if (validationErrors.length > 0) {
      throw new Error(`Template validation failed: ${validationErrors.join(', ')}`);
    }

    return await this.services.templateManager.createTemplate(templateData, createdBy);
  }

  async updateTemplate(templateId, templateData, updatedBy, changeDescription) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    // Validate template
    const validationErrors = await this.services.templateManager.validateTemplate(templateData);
    if (validationErrors.length > 0) {
      throw new Error(`Template validation failed: ${validationErrors.join(', ')}`);
    }

    return await this.services.templateManager.updateTemplate(
      templateId,
      templateData,
      updatedBy,
      changeDescription
    );
  }

  async getTemplates(filters = {}) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.templateManager.listTemplates(filters);
  }

  async renderTemplate(templateName, type, channel, data, language = 'en') {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.templateManager.renderTemplate(templateName, type, channel, data, language);
  }

  async updateUserPreferences(userId, preferences) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.preferenceService.updateUserPreferences(userId, preferences);
  }

  async getUserPreferences(userId) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.preferenceService.getUserPreferences(userId);
  }

  async addDeviceToken(userId, deviceInfo) {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return await this.services.preferenceService.addDeviceToken(userId, deviceInfo);
  }

  getWebSocketStats() {
    if (!this.isInitialized) {
      throw new Error('Notification system not initialized');
    }

    return this.services.websocketService.getStats();
  }

  async getHealthStatus() {
    if (!this.isInitialized) {
      return {
        status: 'unhealthy',
        message: 'Notification system not initialized'
      };
    }

    try {
      const websocketStats = this.services.websocketService.getStats();
      const pendingRetries = await this.services.deliveryTracker.getPendingRetries();

      return {
        status: 'healthy',
        services: {
          notificationService: 'running',
          analyticsService: 'running',
          templateManager: 'running',
          websocketService: 'running',
          deliveryTracker: 'running',
          preferenceService: 'running'
        },
        stats: {
          activeUsers: websocketStats.activeUsers,
          totalConnections: websocketStats.totalConnections,
          queuedNotifications: websocketStats.queuedNotifications,
          pendingRetries: pendingRetries.length
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  }

  async shutdown() {
    console.log('Shutting down notification system...');

    try {
      // Shutdown services
      await Promise.all([
        this.services.notificationService.stop(),
        this.services.analyticsService.close(),
        this.services.templateManager.close(),
        this.services.deliveryTracker.close(),
        this.services.preferenceService.close()
      ]);

      // Shutdown WebSocket service
      this.services.websocketService.shutdown();

      this.isInitialized = false;
      console.log('Notification system shutdown complete');
    } catch (error) {
      console.error('Error during notification system shutdown:', error);
    }
  }
}

module.exports = NotificationIntegration;
