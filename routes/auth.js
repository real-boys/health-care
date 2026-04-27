const express = require('express');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect } = require('../middleware/auth');

const router = express.Router();

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRE
  });
};

// @route   POST /api/auth/register
// @desc    Register a new user
// @access  Public
router.post('/register', [
  body('username').isLength({ min: 3 }).withMessage('Username must be at least 3 characters'),
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('role').isIn(['admin', 'provider', 'agent', 'processor']).withMessage('Invalid role'),
  body('profile.firstName').notEmpty().withMessage('First name is required'),
  body('profile.lastName').notEmpty().withMessage('Last name is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { username, email, password, role, profile } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User already exists'
      });
    }

    // Get role permissions
    const permissions = User.getRolePermissions(role);

    // Create user
    const user = await User.create({
      username,
      email,
      password,
      role,
      profile,
      permissions
    });

    // Generate token
    const token = generateToken(user._id);

    // Log registration
    await AuditLog.createLog({
      action: 'create',
      resourceType: 'user',
      resourceId: user._id,
      userId: user._id,
      userRole: user.role,
      details: {
        description: `User ${username} registered with role ${role}`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: role === 'admin' ? 'high' : 'medium'
    });

    res.status(201).json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        profile: user.profile
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during registration'
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', [
  body('email').isEmail().withMessage('Please provide a valid email'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      await AuditLog.createLog({
        action: 'login',
        resourceType: 'user',
        resourceId: new mongoose.Types.ObjectId(),
        userId: new mongoose.Types.ObjectId(),
        userRole: 'anonymous',
        details: {
          description: `Failed login attempt for email: ${email}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        },
        outcome: 'failure',
        riskLevel: 'medium'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Check if account is locked
    if (user.isLocked) {
      await AuditLog.createLog({
        action: 'login',
        resourceType: 'user',
        resourceId: user._id,
        userId: user._id,
        userRole: user.role,
        details: {
          description: `Login attempt on locked account: ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date()
        },
        outcome: 'failure',
        riskLevel: 'high'
      });

      return res.status(423).json({
        success: false,
        error: 'Account is temporarily locked'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Account is deactivated'
      });
    }

    // Check password
    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      // Increment login attempts
      await user.incLoginAttempts();

      await AuditLog.createLog({
        action: 'login',
        resourceType: 'user',
        resourceId: user._id,
        userId: user._id,
        userRole: user.role,
        details: {
          description: `Failed login attempt for user: ${user.username}`,
          ipAddress: req.ip,
          userAgent: req.get('User-Agent'),
          timestamp: new Date(),
          loginAttempts: user.loginAttempts + 1
        },
        outcome: 'failure',
        riskLevel: user.loginAttempts >= 4 ? 'high' : 'medium'
      });

      return res.status(401).json({
        success: false,
        error: 'Invalid credentials'
      });
    }

    // Reset login attempts on successful login
    await user.resetLoginAttempts();

    // Generate token
    const token = generateToken(user._id);

    // Log successful login
    await AuditLog.createLog({
      action: 'login',
      resourceType: 'user',
      resourceId: user._id,
      userId: user._id,
      userRole: user.role,
      details: {
        description: `User ${user.username} logged in successfully`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: 'low'
    });

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        profile: user.profile,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during login'
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    res.json({
      success: true,
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        permissions: user.permissions,
        profile: user.profile,
        isActive: user.isActive,
        lastLogin: user.lastLogin
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user
// @access  Private
router.post('/logout', protect, async (req, res) => {
  try {
    // Log logout
    await AuditLog.createLog({
      action: 'logout',
      resourceType: 'user',
      resourceId: req.user._id,
      userId: req.user._id,
      userRole: req.user.role,
      details: {
        description: `User ${req.user.username} logged out`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date()
      },
      outcome: 'success',
      riskLevel: 'low'
    });

    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error during logout'
    });
  }
});

// @route   PUT /api/auth/change-password
// @desc    Change user password
// @access  Private
router.put('/change-password', protect, [
  body('currentPassword').notEmpty().withMessage('Current password is required'),
  body('newPassword').isLength({ min: 6 }).withMessage('New password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: errors.array()
      });
    }

    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user._id).select('+password');

    // Check current password
    const isMatch = await user.comparePassword(currentPassword);

    if (!isMatch) {
      return res.status(400).json({
        success: false,
        error: 'Current password is incorrect'
      });
    }

    // Update password
    user.password = newPassword;
    await user.save();

    // Log password change
    await AuditLog.createLog({
      action: 'update',
      resourceType: 'user',
      resourceId: user._id,
      userId: user._id,
      userRole: user.role,
      details: {
        description: `User ${user.username} changed password`,
        ipAddress: req.ip,
        userAgent: req.get('User-Agent'),
        timestamp: new Date(),
        fieldsChanged: ['password']
      },
      outcome: 'success',
      riskLevel: 'medium'
    });

    res.json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({
      success: false,
      error: 'Server error'
    });
  }
});

module.exports = router;
