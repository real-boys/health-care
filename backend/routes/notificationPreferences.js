const express = require('express');
const { body, validationResult } = require('express-validator');
const UserPreferenceService = require('../services/userPreferenceService');
const auth = require('../middleware/auth');

const router = express.Router();
const preferenceService = new UserPreferenceService();

// Get user notification preferences
router.get('/user/:userId', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only access their own preferences
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const preferences = await preferenceService.getUserPreferences(userId);
    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    res.status(500).json({ error: 'Failed to fetch preferences' });
  }
});

// Update user notification preferences
router.put('/user/:userId', [
  auth,
  body('preferences').isObject().withMessage('Preferences must be an object'),
  body('preferences.email').optional().isBoolean().withMessage('Email preference must be boolean'),
  body('preferences.sms').optional().isBoolean().withMessage('SMS preference must be boolean'),
  body('preferences.push').optional().isBoolean().withMessage('Push preference must be boolean'),
  body('preferences.in_app').optional().isBoolean().withMessage('In-app preference must be boolean')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { preferences } = req.body;
    
    // Ensure user can only update their own preferences
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await preferenceService.updateUserPreferences(userId, preferences);
    
    res.json({
      success: true,
      message: 'Preferences updated successfully',
      preferences: result
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Update notification type preferences
router.put('/user/:userId/type/:notificationType', [
  auth,
  body('enabled').isBoolean().withMessage('Enabled must be boolean'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  body('channels.*').isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid channel')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId, notificationType } = req.params;
    const { enabled, channels } = req.body;
    
    // Ensure user can only update their own preferences
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await preferenceService.updateNotificationTypePreferences(
      userId, 
      notificationType, 
      { enabled, channels }
    );
    
    res.json({
      success: true,
      message: `${notificationType} preferences updated successfully`,
      preferences: result
    });
  } catch (error) {
    console.error('Error updating notification type preferences:', error);
    res.status(500).json({ error: 'Failed to update preferences' });
  }
});

// Get user device tokens for push notifications
router.get('/user/:userId/devices', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only access their own devices
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const devices = await preferenceService.getUserDeviceTokens(userId);
    res.json({
      success: true,
      devices
    });
  } catch (error) {
    console.error('Error fetching device tokens:', error);
    res.status(500).json({ error: 'Failed to fetch devices' });
  }
});

// Add device token for push notifications
router.post('/user/:userId/devices', [
  auth,
  body('deviceToken').notEmpty().withMessage('Device token is required'),
  body('deviceType').isIn(['android', 'ios', 'web']).withMessage('Invalid device type'),
  body('deviceId').optional().isString().withMessage('Device ID must be string')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { deviceToken, deviceType, deviceId } = req.body;
    
    // Ensure user can only add their own devices
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await preferenceService.addDeviceToken(userId, {
      device_token: deviceToken,
      device_type: deviceType,
      device_id: deviceId,
      user_agent: req.get('User-Agent'),
      ip_address: req.ip
    });
    
    res.status(201).json({
      success: true,
      message: 'Device token added successfully',
      device: result
    });
  } catch (error) {
    console.error('Error adding device token:', error);
    res.status(500).json({ error: 'Failed to add device token' });
  }
});

// Remove device token
router.delete('/user/:userId/devices/:deviceId', auth, async (req, res) => {
  try {
    const { userId, deviceId } = req.params;
    
    // Ensure user can only remove their own devices
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await preferenceService.removeDeviceToken(userId, deviceId);
    
    if (result) {
      res.json({
        success: true,
        message: 'Device token removed successfully'
      });
    } else {
      res.status(404).json({
        success: false,
        error: 'Device token not found'
      });
    }
  } catch (error) {
    console.error('Error removing device token:', error);
    res.status(500).json({ error: 'Failed to remove device token' });
  }
});

// Get notification frequency preferences
router.get('/user/:userId/frequency', auth, async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Ensure user can only access their own preferences
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const frequency = await preferenceService.getFrequencyPreferences(userId);
    res.json({
      success: true,
      frequency
    });
  } catch (error) {
    console.error('Error fetching frequency preferences:', error);
    res.status(500).json({ error: 'Failed to fetch frequency preferences' });
  }
});

// Update notification frequency preferences
router.put('/user/:userId/frequency', [
  auth,
  body('dailyDigest').optional().isBoolean().withMessage('Daily digest must be boolean'),
  body('weeklyDigest').optional().isBoolean().withMessage('Weekly digest must be boolean'),
  body('quietHours').optional().isObject().withMessage('Quiet hours must be an object'),
  body('quietHours.enabled').optional().isBoolean().withMessage('Quiet hours enabled must be boolean'),
  body('quietHours.start').optional().isTime().withMessage('Quiet hours start must be a valid time'),
  body('quietHours.end').optional().isTime().withMessage('Quiet hours end must be a valid time'),
  body('maxPerDay').optional().isInt({ min: 1, max: 100 }).withMessage('Max per day must be between 1 and 100')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const frequencyData = req.body;
    
    // Ensure user can only update their own preferences
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const result = await preferenceService.updateFrequencyPreferences(userId, frequencyData);
    
    res.json({
      success: true,
      message: 'Frequency preferences updated successfully',
      frequency: result
    });
  } catch (error) {
    console.error('Error updating frequency preferences:', error);
    res.status(500).json({ error: 'Failed to update frequency preferences' });
  }
});

// Get default preferences for new users
router.get('/defaults', auth, async (req, res) => {
  try {
    const defaults = await preferenceService.getDefaultPreferences();
    res.json({
      success: true,
      defaults
    });
  } catch (error) {
    console.error('Error fetching default preferences:', error);
    res.status(500).json({ error: 'Failed to fetch default preferences' });
  }
});

// Test notification preferences
router.post('/user/:userId/test', [
  auth,
  body('type').isIn(['claim', 'payment', 'appointment', 'system', 'medical_record']).withMessage('Invalid notification type'),
  body('channels').optional().isArray().withMessage('Channels must be an array'),
  body('channels.*').isIn(['email', 'sms', 'push', 'in_app']).withMessage('Invalid channel')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { userId } = req.params;
    const { type, channels } = req.body;
    
    // Ensure user can only test their own notifications
    if (req.user.id !== parseInt(userId) && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const NotificationService = require('../services/notificationService');
    const notificationService = new NotificationService(req.io);
    
    const result = await notificationService.createNotification(
      userId,
      type,
      'test_notification',
      {
        title: 'Test Notification',
        message: 'This is a test notification to verify your preferences are working correctly.',
        test: true
      },
      'low'
    );
    
    res.json({
      success: true,
      message: 'Test notification sent successfully',
      notificationId: result.notificationId,
      deliveryMethods: result.deliveryMethods
    });
  } catch (error) {
    console.error('Error sending test notification:', error);
    res.status(500).json({ error: 'Failed to send test notification' });
  }
});

module.exports = router;
