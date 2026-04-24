const express = require('express');
const { body, validationResult, query } = require('express-validator');
const NotificationService = require('../services/notificationService');
const EnhancedNotificationAnalyticsService = require('../services/enhancedNotificationAnalyticsService');
const NotificationTemplateManager = require('../services/notificationTemplateManager');
const WebSocketNotificationService = require('../services/websocketNotificationService');
const auth = require('../middleware/auth');

const router = express.Router();

// Initialize services
let notificationService;
let analyticsService;
let templateManager;
let websocketService;

// Initialize services with io instance
const initializeServices = (io) => {
  if (!notificationService) {
    notificationService = new NotificationService(io);
    analyticsService = new EnhancedNotificationAnalyticsService();
    templateManager = new NotificationTemplateManager();
    websocketService = new WebSocketNotificationService(io);
    
    // Initialize async services
    Promise.all([
      notificationService.initialize(),
      analyticsService.initialize(),
      templateManager.initialize()
    ]).catch(error => {
      console.error('Error initializing notification services:', error);
    });
  }
};

// Send notification to user
router.post('/send', [
  auth,
  body('userId').isInt().withMessage('User ID must be an integer'),
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']).withMessage('Invalid notification type'),
  body('templateName').notEmpty().withMessage('Template name is required'),
  body('data').isObject().withMessage('Data must be an object'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  body('channels.*').isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid channel')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, type, templateName, data, priority = 'medium', channels } = req.body;
    
    // Check if user can send notifications to this user (admin or self)
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const result = await notificationService.createNotification(userId, type, templateName, data, priority);
    
    // Track analytics
    await analyticsService.trackNotificationDelivery(
      result.notificationId,
      userId,
      type,
      'multiple',
      'pending',
      {
        priority,
        templateName,
        channels: result.deliveryMethods,
        sentAt: new Date().toISOString()
      }
    );
    
    res.status(201).json({
      success: true,
      message: 'Notification sent successfully',
      notificationId: result.notificationId,
      deliveryMethods: result.deliveryMethods
    });
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// Send bulk notifications
router.post('/bulk', [
  auth,
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('recipients.*.userId').isInt().withMessage('User ID must be an integer'),
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']).withMessage('Invalid notification type'),
  body('templateName').notEmpty().withMessage('Template name is required'),
  body('data').isObject().withMessage('Data must be an object'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { recipients, type, templateName, data, priority = 'medium' } = req.body;
    
    // Only admins can send bulk notifications
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const results = [];
    const startTime = Date.now();
    
    for (const recipient of recipients) {
      try {
        const result = await notificationService.createNotification(
          recipient.userId,
          type,
          templateName,
          { ...data, ...recipient.customData },
          priority
        );
        
        results.push({
          userId: recipient.userId,
          success: true,
          notificationId: result.notificationId,
          deliveryMethods: result.deliveryMethods
        });
        
        // Track analytics
        await analyticsService.trackNotificationDelivery(
          result.notificationId,
          recipient.userId,
          type,
          'multiple',
          'pending',
          {
            priority,
            templateName,
            channels: result.deliveryMethods,
            sentAt: new Date().toISOString()
          }
        );
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
    
    res.status(201).json({
      success: true,
      message: `Bulk notification processing complete`,
      summary: {
        total: recipients.length,
        successful,
        failed: recipients.length - successful,
        processingTime: `${processingTime}ms`
      },
      results
    });
  } catch (error) {
    console.error('Error sending bulk notifications:', error);
    res.status(500).json({ error: 'Failed to send bulk notifications' });
  }
});

// Get user notifications
router.get('/user/:userId', [
  auth,
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative'),
  query('type').optional().isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']).withMessage('Invalid type'),
  query('status').optional().isIn(['pending', 'sent', 'delivered', 'failed', 'read']).withMessage('Invalid status'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { limit = 50, offset = 0, type, status, priority } = req.query;
    
    // Ensure user can only access their own notifications
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const notifications = await notificationService.getUserNotifications(userId, limit, offset);
    
    // Apply filters
    let filteredNotifications = notifications;
    if (type) {
      filteredNotifications = filteredNotifications.filter(n => n.type === type);
    }
    if (status) {
      filteredNotifications = filteredNotifications.filter(n => n.status === status);
    }
    if (priority) {
      filteredNotifications = filteredNotifications.filter(n => n.priority === priority);
    }
    
    res.json({
      success: true,
      notifications: filteredNotifications,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: filteredNotifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching user notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Mark notification as read
router.put('/:notificationId/read', [
  auth,
  body('userId').isInt().withMessage('User ID must be an integer')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notificationId } = req.params;
    const { userId } = req.body;
    
    // Ensure user can only mark their own notifications as read
    if (req.user.id !== userId && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const result = await notificationService.markNotificationAsRead(notificationId, userId);
    
    if (result.updated > 0) {
      // Update analytics
      await analyticsService.updateNotificationStatus(notificationId, 'in_app', 'read', {
        readAt: new Date().toISOString()
      });
      
      res.json({
        success: true,
        message: 'Notification marked as read'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Notification not found or already read'
      });
    }
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Get notification analytics
router.get('/analytics', [
  auth,
  query('startDate').optional().isISO8601().withMessage('Start date must be a valid date'),
  query('endDate').optional().isISO8601().withMessage('End date must be a valid date'),
  query('type').optional().isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']).withMessage('Invalid type'),
  query('deliveryMethod').optional().isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid delivery method'),
  query('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { startDate, endDate, type, deliveryMethod, priority } = req.query;
    
    // Only admins can access analytics
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const filters = {};
    if (type) filters.notificationType = type;
    if (deliveryMethod) filters.deliveryMethod = deliveryMethod;
    if (priority) filters.priority = priority;
    
    const analytics = await analyticsService.getComprehensiveAnalytics(startDate, endDate, filters);
    const realTimeMetrics = await analyticsService.getRealTimeMetrics();
    
    res.json({
      success: true,
      analytics,
      realTimeMetrics
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get notification templates
router.get('/templates', [
  auth,
  query('type').optional().isIn(['claim', 'payment', 'appointment', 'system', 'medical_record', 'marketing']).withMessage('Invalid type'),
  query('channel').optional().isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid channel'),
  query('language').optional().isAlpha().withMessage('Language must be alphabetic'),
  query('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { type, channel, language, isActive } = req.query;
    
    // Only admins can access templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const filters = {};
    if (type) filters.type = type;
    if (channel) filters.channel = channel;
    if (language) filters.language = language;
    if (isActive !== undefined) filters.isActive = isActive === 'true';
    
    const templates = await templateManager.listTemplates(filters);
    
    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

// Create notification template
router.post('/templates', [
  auth,
  body('name').notEmpty().withMessage('Template name is required'),
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record', 'marketing']).withMessage('Invalid type'),
  body('channel').isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid channel'),
  body('language').optional().isAlpha().withMessage('Language must be alphabetic'),
  body('subjectTemplate').optional().isString().withMessage('Subject template must be a string'),
  body('titleTemplate').optional().isString().withMessage('Title template must be a string'),
  body('bodyTemplate').notEmpty().withMessage('Body template is required'),
  body('variables').optional().isArray().withMessage('Variables must be an array'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only admins can create templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const templateData = {
      name: req.body.name,
      type: req.body.type,
      channel: req.body.channel,
      language: req.body.language || 'en',
      subjectTemplate: req.body.subjectTemplate,
      titleTemplate: req.body.titleTemplate,
      bodyTemplate: req.body.bodyTemplate,
      variables: req.body.variables || [],
      isActive: req.body.isActive !== undefined ? req.body.isActive : true
    };
    
    // Validate template
    const validationErrors = await templateManager.validateTemplate(templateData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }
    
    const result = await templateManager.createTemplate(templateData, req.user.id);
    
    res.status(201).json({
      success: true,
      message: 'Template created successfully',
      templateId: result.id
    });
  } catch (error) {
    console.error('Error creating template:', error);
    res.status(500).json({ error: 'Failed to create template' });
  }
});

// Update notification template
router.put('/templates/:templateId', [
  auth,
  body('subjectTemplate').optional().isString().withMessage('Subject template must be a string'),
  body('titleTemplate').optional().isString().withMessage('Title template must be a string'),
  body('bodyTemplate').optional().isString().withMessage('Body template must be a string'),
  body('variables').optional().isArray().withMessage('Variables must be an array'),
  body('isActive').optional().isBoolean().withMessage('isActive must be boolean'),
  body('changeDescription').optional().isString().withMessage('Change description must be a string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { templateId } = req.params;
    
    // Only admins can update templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const templateData = {
      subjectTemplate: req.body.subjectTemplate,
      titleTemplate: req.body.titleTemplate,
      bodyTemplate: req.body.bodyTemplate,
      variables: req.body.variables,
      isActive: req.body.isActive
    };
    
    // Remove undefined values
    Object.keys(templateData).forEach(key => {
      if (templateData[key] === undefined) {
        delete templateData[key];
      }
    });
    
    // Validate template
    const validationErrors = await templateManager.validateTemplate(templateData);
    if (validationErrors.length > 0) {
      return res.status(400).json({ errors: validationErrors });
    }
    
    const result = await templateManager.updateTemplate(
      templateId,
      templateData,
      req.user.id,
      req.body.changeDescription || 'Template updated'
    );
    
    res.json({
      success: true,
      message: 'Template updated successfully',
      version: result.version
    });
  } catch (error) {
    console.error('Error updating template:', error);
    res.status(500).json({ error: 'Failed to update template' });
  }
});

// Get template versions
router.get('/templates/:templateId/versions', auth, async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Only admins can access template versions
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const versions = await templateManager.getTemplateVersions(templateId);
    
    res.json({
      success: true,
      versions
    });
  } catch (error) {
    console.error('Error fetching template versions:', error);
    res.status(500).json({ error: 'Failed to fetch template versions' });
  }
});

// Delete template
router.delete('/templates/:templateId', auth, async (req, res) => {
  try {
    const { templateId } = req.params;
    
    // Only admins can delete templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const result = await templateManager.deleteTemplate(templateId);
    
    if (result.deleted) {
      res.json({
        success: true,
        message: 'Template deleted successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: result.message
      });
    }
  } catch (error) {
    console.error('Error deleting template:', error);
    res.status(500).json({ error: 'Failed to delete template' });
  }
});

// Get WebSocket stats
router.get('/websocket/stats', auth, async (req, res) => {
  try {
    // Only admins can access WebSocket stats
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const stats = websocketService.getStats();
    
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching WebSocket stats:', error);
    res.status(500).json({ error: 'Failed to fetch WebSocket stats' });
  }
});

// Send system notification
router.post('/system', [
  auth,
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']).withMessage('Invalid priority'),
  body('data').optional().isObject().withMessage('Data must be an object')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only admins can send system notifications
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const { title, message, priority = 'medium', data } = req.body;
    
    const result = await websocketService.sendSystemNotification({
      title,
      message,
      priority,
      data
    });
    
    res.json({
      success: true,
      message: 'System notification sent successfully',
      recipients: result.recipients
    });
  } catch (error) {
    console.error('Error sending system notification:', error);
    res.status(500).json({ error: 'Failed to send system notification' });
  }
});

// Test notification rendering
router.post('/test-render', [
  auth,
  body('templateName').notEmpty().withMessage('Template name is required'),
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']).withMessage('Invalid type'),
  body('channel').isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid channel'),
  body('data').isObject().withMessage('Data must be an object'),
  body('language').optional().isAlpha().withMessage('Language must be alphabetic')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only admins can test templates
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    initializeServices(req.io);
    
    const { templateName, type, channel, data, language = 'en' } = req.body;
    
    const result = await templateManager.renderTemplate(templateName, type, channel, data, language);
    
    res.json({
      success: true,
      rendered: result
    });
  } catch (error) {
    console.error('Error testing template render:', error);
    res.status(500).json({ error: 'Failed to render template' });
  }
});

module.exports = router;
