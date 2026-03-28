const express = require('express');
const { body, query, validationResult } = require('express-validator');
const router = express.Router();

// Get user notifications
router.get('/', [
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('type').optional().isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']),
  query('status').optional().isIn(['pending', 'sent', 'delivered', 'failed', 'read'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const type = req.query.type;
    const status = req.query.status;

    let notifications;
    if (req.notificationService) {
      notifications = await req.notificationService.getUserNotifications(userId, limit, offset);
      
      // Filter by type and status if provided
      if (type) {
        notifications = notifications.filter(n => n.type === type);
      }
      if (status) {
        notifications = notifications.filter(n => n.status === status);
      }
    } else {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    res.json({
      success: true,
      notifications,
      pagination: {
        limit,
        offset,
        total: notifications.length
      }
    });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// Get notification statistics
router.get('/stats', async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const stats = await req.notificationService.getNotificationStats(userId);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching notification stats:', error);
    res.status(500).json({ error: 'Failed to fetch notification statistics' });
  }
});

// Mark notification as read
router.patch('/:notificationId/read', async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { notificationId } = req.params;
    const userId = req.user.id;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const result = await req.notificationService.markNotificationAsRead(notificationId, userId);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ error: 'Failed to mark notification as read' });
  }
});

// Mark multiple notifications as read
router.patch('/mark-all-read', async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    // Get all unread notifications for the user
    const notifications = await req.notificationService.getUserNotifications(userId, 1000, 0);
    const unreadNotifications = notifications.filter(n => n.status !== 'read');

    // Mark each as read
    const updatePromises = unreadNotifications.map(notification =>
      req.notificationService.markNotificationAsRead(notification.notification_id, userId)
    );

    await Promise.all(updatePromises);

    res.json({
      success: true,
      message: `Marked ${unreadNotifications.length} notifications as read`
    });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ error: 'Failed to mark notifications as read' });
  }
});

// Get user notification preferences
router.get('/preferences', async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const preferences = await req.notificationService.preferenceService.getUserPreferences(userId);

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch notification preferences' });
  }
});

// Update user notification preferences
router.put('/preferences', [
  body('preferences').isObject().withMessage('Preferences must be an object'),
  body('preferences.*.email_enabled').optional().isBoolean(),
  body('preferences.*.sms_enabled').optional().isBoolean(),
  body('preferences.*.push_enabled').optional().isBoolean(),
  body('preferences.*.in_app_enabled').optional().isBoolean(),
  body('preferences.*.frequency').optional().isIn(['immediate', 'daily', 'weekly', 'never']),
  body('preferences.*.quiet_hours_start').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('preferences.*.quiet_hours_end').optional().matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { preferences } = req.body;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const results = await req.notificationService.preferenceService.updateUserPreferences(userId, preferences);

    res.json({
      success: true,
      message: 'Notification preferences updated',
      results
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
});

// Register device token for push notifications
router.post('/register-device', [
  body('deviceToken').notEmpty().withMessage('Device token is required'),
  body('deviceType').optional().isIn(['ios', 'android', 'web']),
  body('deviceName').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { deviceToken, deviceType = 'web', deviceName } = req.body;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const result = await req.notificationService.preferenceService.addDeviceToken(
      userId,
      deviceToken,
      deviceType,
      deviceName
    );

    res.json({
      success: true,
      message: 'Device registered successfully',
      result
    });
  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ error: 'Failed to register device' });
  }
});

// Remove device token
router.delete('/unregister-device', [
  body('deviceToken').notEmpty().withMessage('Device token is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { deviceToken } = req.body;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const result = await req.notificationService.preferenceService.removeDeviceToken(userId, deviceToken);

    res.json({
      success: true,
      message: 'Device unregistered successfully',
      result
    });
  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({ error: 'Failed to unregister device' });
  }
});

// Get user's registered devices
router.get('/devices', async (req, res) => {
  try {
    const userId = req.user.id;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const devices = await req.notificationService.preferenceService.getUserDeviceTokens(userId);

    res.json({
      success: true,
      devices
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Test notification (for development/testing)
router.post('/test', [
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']),
  body('template').notEmpty().withMessage('Template name is required'),
  body('data').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    // Only allow in development environment
    if (process.env.NODE_ENV === 'production') {
      return res.status(403).json({ error: 'Test notifications not allowed in production' });
    }

    const userId = req.user.id;
    const { type, template, data = {}, priority = 'medium' } = req.body;

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const result = await req.notificationService.createNotification(userId, type, template, data, priority);

    res.json({
      success: true,
      message: 'Test notification created',
      result
    });
  } catch (error) {
    console.error('Error creating test notification:', error);
    res.status(500).json({ error: 'Failed to create test notification' });
  }
});

// Get queue statistics (admin only)
router.get('/queue-stats', async (req, res) => {
  try {
    // Check if user is admin
    if (req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!req.notificationService) {
      return res.status(503).json({ error: 'Notification service not available' });
    }

    const stats = await req.notificationService.queue.getQueueStats();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching queue stats:', error);
    res.status(500).json({ error: 'Failed to fetch queue statistics' });
  }
});

// ============================================
// ENHANCED NOTIFICATION MANAGEMENT ENDPOINTS
// ============================================

// Get notification history with advanced filtering
router.get('/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      page = 1,
      limit = 20,
      type,
      status,
      priority,
      startDate,
      endDate,
      search
    } = req.query;

    const db = req.app.get('db') || require('sqlite3').Database;
    const DB_PATH = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const sqlite3 = require('sqlite3').verbose();
    const dbConn = new sqlite3.Database(DB_PATH);
    
    const offset = (page - 1) * limit;
    let whereConditions = ['user_id = ?'];
    const params = [userId];

    if (type) {
      whereConditions.push('type = ?');
      params.push(type);
    }

    if (status) {
      whereConditions.push('status = ?');
      params.push(status);
    }

    if (priority) {
      whereConditions.push('priority = ?');
      params.push(priority);
    }

    if (startDate) {
      whereConditions.push('created_at >= ?');
      params.push(startDate);
    }

    if (endDate) {
      whereConditions.push('created_at <= ?');
      params.push(endDate);
    }

    if (search) {
      whereConditions.push('(title LIKE ? OR message LIKE ?)');
      const searchParam = `%${search}%`;
      params.push(searchParam, searchParam);
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(*) as total FROM notifications_enhanced WHERE ${whereClause}`;
    const totalResult = await new Promise((resolve, reject) => {
      dbConn.get(countQuery, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Get paginated notifications
    const dataQuery = `
      SELECT * FROM notifications_enhanced 
      WHERE ${whereClause}
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const notifications = await new Promise((resolve, reject) => {
      dbConn.all(dataQuery, [...params, parseInt(limit), offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    dbConn.close();

    res.json({
      success: true,
      notifications,
      pagination: {
        total: totalResult.total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(totalResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Error fetching notification history:', error);
    res.status(500).json({ error: 'Failed to fetch notification history' });
  }
});

// Get notification analytics
router.get('/analytics', async (req, res) => {
  try {
    const userId = req.user.id;
    const { period = 'month' } = req.query;

    const sqlite3 = require('sqlite3').verbose();
    const DB_PATH = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const db = new sqlite3.Database(DB_PATH);

    let dateCondition = '';
    switch (period) {
      case 'today':
        dateCondition = "AND DATE(created_at) = DATE('now')";
        break;
      case 'week':
        dateCondition = "AND created_at >= DATE('now', '-7 days')";
        break;
      case 'month':
        dateCondition = "AND created_at >= DATE('now', 'start of month')";
        break;
      case 'year':
        dateCondition = "AND created_at >= DATE('now', 'start of year')";
        break;
      default:
        dateCondition = "AND created_at >= DATE('now', '-30 days')";
    }

    // Overall statistics
    const overallStats = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count,
          COUNT(CASE WHEN status != 'read' THEN 1 END) as unread_count,
          COUNT(CASE WHEN priority = 'urgent' THEN 1 END) as urgent_count,
          COUNT(CASE WHEN priority = 'high' THEN 1 END) as high_count
        FROM notifications_enhanced
        WHERE user_id = ? ${dateCondition}
      `;
      db.get(query, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    // Type breakdown
    const typeBreakdown = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          type,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count
        FROM notifications_enhanced
        WHERE user_id = ? ${dateCondition}
        GROUP BY type
        ORDER BY count DESC
      `;
      db.all(query, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Daily trends
    const dailyTrends = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as count,
          COUNT(CASE WHEN status = 'read' THEN 1 END) as read_count
        FROM notifications_enhanced
        WHERE user_id = ? ${dateCondition}
        GROUP BY DATE(created_at)
        ORDER BY date DESC
        LIMIT 30
      `;
      db.all(query, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Priority distribution
    const priorityDistribution = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          priority,
          COUNT(*) as count
        FROM notifications_enhanced
        WHERE user_id = ? ${dateCondition}
        GROUP BY priority
      `;
      db.all(query, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Delivery method stats
    const deliveryStats = await new Promise((resolve, reject) => {
      const query = `
        SELECT 
          delivery_methods,
          COUNT(*) as count
        FROM notifications_enhanced
        WHERE user_id = ? ${dateCondition}
        GROUP BY delivery_methods
      `;
      db.all(query, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    db.close();

    res.json({
      success: true,
      period,
      overview: overallStats,
      typeBreakdown,
      dailyTrends,
      priorityDistribution,
      deliveryStats
    });
  } catch (error) {
    console.error('Error fetching notification analytics:', error);
    res.status(500).json({ error: 'Failed to fetch notification analytics' });
  }
});

// Delete notification
router.delete('/:notificationId', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const sqlite3 = require('sqlite3').verbose();
    const DB_PATH = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const db = new sqlite3.Database(DB_PATH);

    const result = await new Promise((resolve, reject) => {
      db.run(
        'DELETE FROM notifications_enhanced WHERE notification_id = ? AND user_id = ?',
        [notificationId, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Delete multiple notifications
router.post('/bulk-delete', async (req, res) => {
  try {
    const { notificationIds } = req.body;
    const userId = req.user.id;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return res.status(400).json({ error: 'Notification IDs are required' });
    }

    const sqlite3 = require('sqlite3').verbose();
    const DB_PATH = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const db = new sqlite3.Database(DB_PATH);

    const placeholders = notificationIds.map(() => '?').join(',');
    const result = await new Promise((resolve, reject) => {
      db.run(
        `DELETE FROM notifications_enhanced WHERE notification_id IN (${placeholders}) AND user_id = ?`,
        [...notificationIds, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    db.close();

    res.json({
      success: true,
      message: `${result.changes} notifications deleted`
    });
  } catch (error) {
    console.error('Error deleting notifications:', error);
    res.status(500).json({ error: 'Failed to delete notifications' });
  }
});

// Archive notification
router.patch('/:notificationId/archive', async (req, res) => {
  try {
    const { notificationId } = req.params;
    const userId = req.user.id;

    const sqlite3 = require('sqlite3').verbose();
    const DB_PATH = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const db = new sqlite3.Database(DB_PATH);

    const result = await new Promise((resolve, reject) => {
      db.run(
        'UPDATE notifications_enhanced SET status = ?, archived_at = CURRENT_TIMESTAMP WHERE notification_id = ? AND user_id = ?',
        ['archived', notificationId, userId],
        function(err) {
          if (err) reject(err);
          else resolve({ changes: this.changes });
        }
      );
    });

    db.close();

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json({
      success: true,
      message: 'Notification archived'
    });
  } catch (error) {
    console.error('Error archiving notification:', error);
    res.status(500).json({ error: 'Failed to archive notification' });
  }
});

// Create custom notification (for testing)
router.post('/create', [
  body('title').notEmpty().withMessage('Title is required'),
  body('message').notEmpty().withMessage('Message is required'),
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const userId = req.user.id;
    const { title, message, type, priority = 'medium', data = {} } = req.body;

    const sqlite3 = require('sqlite3').verbose();
    const DB_PATH = process.env.DB_PATH || require('path').join(__dirname, '../database/healthcare.db');
    const db = new sqlite3.Database(DB_PATH);
    const { v4: uuidv4 } = require('uuid');
    const notificationId = uuidv4();

    await new Promise((resolve, reject) => {
      const query = `
        INSERT INTO notifications_enhanced 
        (user_id, notification_id, title, message, type, priority, status, template_data, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, CURRENT_TIMESTAMP)
      `;
      db.run(query, [userId, notificationId, title, message, type, priority, JSON.stringify(data)], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    db.close();

    // Emit via socket if available
    const io = req.app.get('io');
    if (io) {
      io.to(`user-${userId}`).emit('notification', {
        notification_id: notificationId,
        title,
        message,
        type,
        priority,
        created_at: new Date().toISOString()
      });
    }

    res.json({
      success: true,
      notificationId,
      message: 'Notification created'
    });
  } catch (error) {
    console.error('Error creating notification:', error);
    res.status(500).json({ error: 'Failed to create notification' });
  }
});

// Get notification templates
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'claim-update',
        name: 'Claim Update',
        description: 'Notifies about claim status changes',
        variables: ['claimantName', 'claimNumber', 'status', 'approvedAmount', 'policyNumber'],
        defaultTitle: 'Claim Status Update',
        defaultBody: 'Your claim {{claimNumber}} has been {{status}}.'
      },
      {
        id: 'payment-confirmation',
        name: 'Payment Confirmation',
        description: 'Confirms successful payment processing',
        variables: ['payerName', 'paymentId', 'amount', 'paymentDate', 'method'],
        defaultTitle: 'Payment Received',
        defaultBody: 'Your payment of ${{amount}} has been processed successfully.'
      },
      {
        id: 'policy-reminder',
        name: 'Premium Payment Reminder',
        description: 'Reminds about upcoming premium payments',
        variables: ['policyHolderName', 'policyNumber', 'dueDate', 'amount', 'gracePeriodDays'],
        defaultTitle: 'Premium Payment Due',
        defaultBody: 'Your premium payment of ${{amount}} is due on {{dueDate}}.'
      },
      {
        id: 'appointment-reminder',
        name: 'Appointment Reminder',
        description: 'Reminds about upcoming appointments',
        variables: ['patientName', 'providerName', 'appointmentDate', 'appointmentTime', 'location'],
        defaultTitle: 'Upcoming Appointment',
        defaultBody: 'You have an appointment with {{providerName}} on {{appointmentDate}} at {{appointmentTime}}.'
      },
      {
        id: 'account-activity',
        name: 'Account Activity Alert',
        description: 'Notifies about important account activities',
        variables: ['userName', 'activity', 'timestamp', 'ipAddress'],
        defaultTitle: 'Account Activity',
        defaultBody: 'New {{activity}} detected on your account.'
      },
      {
        id: 'medical-record-update',
        name: 'Medical Record Update',
        description: 'Notifies about updates to medical records',
        variables: ['patientName', 'recordType', 'providerName', 'updateDate'],
        defaultTitle: 'Medical Record Updated',
        defaultBody: 'Your {{recordType}} has been updated by {{providerName}}.'
      }
    ];

    res.json({
      success: true,
      templates
    });
  } catch (error) {
    console.error('Error fetching templates:', error);
    res.status(500).json({ error: 'Failed to fetch templates' });
  }
});

module.exports = router;
