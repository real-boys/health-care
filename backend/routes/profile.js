const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const profileService = require('../services/profileService');

/**
 * Get user profile with settings
 * GET /api/profile
 */
router.get('/', auth, async (req, res) => {
  try {
    const profile = await profileService.getUserProfile(req.user.id);
    res.json({
      success: true,
      data: profile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get user profile only (without settings)
 * GET /api/profile/basic
 */
router.get('/basic', auth, async (req, res) => {
  try {
    const User = require('../models/User');
    const user = await User.findById(req.user.id).select('-password -mfaSecret');
    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update user profile
 * PUT /api/profile
 */
router.put('/', auth, async (req, res) => {
  try {
    const updatedProfile = await profileService.updateProfile(req.user.id, {
      ...req.body,
      originalEmail: req.user.email,
      originalPhone: req.user.phone,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });

    res.json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Verify email address
 * POST /api/profile/verify-email
 */
router.post('/verify-email', auth, async (req, res) => {
  try {
    const { verificationToken } = req.body;

    if (!verificationToken) {
      return res.status(400).json({
        success: false,
        error: 'Verification token is required',
      });
    }

    const result = await profileService.verifyEmail(
      req.user.id,
      verificationToken
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Change password
 * POST /api/profile/change-password
 */
router.post('/change-password', auth, async (req, res) => {
  try {
    const { oldPassword, newPassword, confirmPassword } = req.body;

    if (!oldPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All password fields are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'New passwords do not match',
      });
    }

    const result = await profileService.changePassword(
      req.user.id,
      oldPassword,
      newPassword,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Validate password strength
 * POST /api/profile/validate-password
 */
router.post('/validate-password', (req, res) => {
  try {
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required',
      });
    }

    const strength = profileService.validatePasswordStrength(password);

    res.json({
      success: true,
      data: strength,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Request password reset
 * POST /api/profile/request-reset
 */
router.post('/request-reset', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required',
      });
    }

    const result = await profileService.requestPasswordReset(
      email,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Complete password reset
 * POST /api/profile/complete-reset
 */
router.post('/complete-reset', async (req, res) => {
  try {
    const { resetToken, newPassword, confirmPassword } = req.body;

    if (!resetToken || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'All fields are required',
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match',
      });
    }

    const result = await profileService.completePasswordReset(
      resetToken,
      newPassword,
      req.ip,
      req.get('user-agent')
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get user settings
 * GET /api/profile/settings
 */
router.get('/settings', auth, async (req, res) => {
  try {
    const settings = await profileService.getOrCreateSettings(req.user.id);
    res.json({
      success: true,
      data: settings,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Update user settings
 * PUT /api/profile/settings
 */
router.put('/settings', auth, async (req, res) => {
  try {
    const settings = await profileService.updateSettings(
      req.user.id,
      req.body
    );

    res.json({
      success: true,
      message: 'Settings updated successfully',
      data: settings,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Reset settings to defaults
 * POST /api/profile/settings/reset
 */
router.post('/settings/reset', auth, async (req, res) => {
  try {
    const settings = await profileService.getOrCreateSettings(req.user.id);
    const reset = await settings.resetToDefaults();

    res.json({
      success: true,
      message: 'Settings reset to defaults',
      data: reset,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get security activity / audit log
 * GET /api/profile/security/activity
 */
router.get('/security/activity', auth, async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;

    const activity = await profileService.getSecurityActivity(
      req.user.id,
      parseInt(limit),
      parseInt(offset)
    );

    res.json({
      success: true,
      data: activity.logs,
      pagination: activity.pagination,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get login history
 * GET /api/profile/security/login-history
 */
router.get('/security/login-history', auth, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const history = await profileService.getLoginHistory(
      req.user.id,
      parseInt(limit)
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get suspicious activity status
 * GET /api/profile/security/suspicious-activity
 */
router.get('/security/suspicious-activity', auth, async (req, res) => {
  try {
    const activity = await profileService.checkSuspiciousActivity(req.user.id);

    res.json({
      success: true,
      data: activity,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Get trusted devices
 * GET /api/profile/security/devices
 */
router.get('/security/devices', auth, async (req, res) => {
  try {
    const devices = await profileService.getTrustedDevices(req.user.id);

    res.json({
      success: true,
      data: devices,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Add trusted device
 * POST /api/profile/security/devices
 */
router.post('/security/devices', auth, async (req, res) => {
  try {
    const { deviceId, deviceName } = req.body;

    if (!deviceId || !deviceName) {
      return res.status(400).json({
        success: false,
        error: 'Device ID and name are required',
      });
    }

    const settings = await profileService.addTrustedDevice(
      req.user.id,
      deviceId,
      deviceName
    );

    res.json({
      success: true,
      message: 'Device added to trusted list',
      data: settings.getTrustedDevices(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Remove trusted device
 * DELETE /api/profile/security/devices/:deviceId
 */
router.delete('/security/devices/:deviceId', auth, async (req, res) => {
  try {
    const { deviceId } = req.params;

    const settings = await profileService.removeTrustedDevice(
      req.user.id,
      deviceId
    );

    res.json({
      success: true,
      message: 'Device removed from trusted list',
      data: settings.getTrustedDevices(),
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Export user data (GDPR)
 * GET /api/profile/export
 */
router.get('/export', auth, async (req, res) => {
  try {
    const userData = await profileService.exportUserData(req.user.id);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="user-data.json"'
    );

    res.json(userData);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * Delete account with verification
 * POST /api/profile/delete
 */
router.post('/delete', auth, async (req, res) => {
  try {
    const { password, reason } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        error: 'Password is required for account deletion',
      });
    }

    const result = await profileService.deleteAccount(
      req.user.id,
      password,
      reason || 'User initiated account deletion'
    );

    res.json({
      success: true,
      message: result.message,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;
