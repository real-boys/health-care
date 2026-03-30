const express = require('express');
const { query, validationResult } = require('express-validator');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, permit } = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/audit/logs
// @desc    Get audit logs (filtered by permissions)
// @access  Private
router.get('/logs', protect, permit('audit:read'), [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('action').optional().isString(),
  query('resourceType').optional().isIn(['user', 'policy', 'claim', 'payment', 'report', 'document', 'system']),
  query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical']),
  query('userId').optional().isMongoId(),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 })
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

    const {
      startDate,
      endDate,
      action,
      resourceType,
      riskLevel,
      userId,
      page = 1,
      limit = 50
    } = req.query;

    // Build query
    let query = {};
    
    if (startDate || endDate) {
      query['details.timestamp'] = {};
      if (startDate) query['details.timestamp'].$gte = new Date(startDate);
      if (endDate) query['details.timestamp'].$lte = new Date(endDate);
    }
    
    if (action) query.action = action;
    if (resourceType) query.resourceType = resourceType;
    if (riskLevel) query.riskLevel = riskLevel;
    if (userId) query.userId = userId;

    // Non-admin users can only see their own logs
    if (req.user.role !== 'admin') {
      query.userId = req.user._id;
    }

    // Execute query with pagination
    const logs = await AuditLog.find(query)
      .populate('userId', 'username email role')
      .populate('reviewed.reviewedBy', 'username')
      .sort({ 'details.timestamp': -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await AuditLog.countDocuments(query);

    res.json({
      success: true,
      count: total,
      page: parseInt(page),
      pages: Math.ceil(total / limit),
      logs
    });
  } catch (error) {
    console.error('Audit logs fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching audit logs'
    });
  }
});

// @route   GET /api/audit/user/:userId
// @desc    Get audit logs for specific user
// @access  Private (Admin only or own logs)
router.get('/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;
    const { startDate, endDate, limit = 100 } = req.query;

    // Check permissions
    if (req.user.role !== 'admin' && userId !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view these logs'
      });
    }

    const options = {
      limit: parseInt(limit),
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined
    };

    const logs = await AuditLog.findByUser(userId, options);

    res.json({
      success: true,
      count: logs.length,
      logs
    });
  } catch (error) {
    console.error('User audit logs fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching user audit logs'
    });
  }
});

// @route   GET /api/audit/high-risk
// @desc    Get high-risk activities
// @access  Private (Admin only)
router.get('/high-risk', protect, authorize('admin'), [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('riskLevel').optional().isIn(['high', 'critical'])
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

    const { startDate, endDate, riskLevel } = req.query;

    const activities = await AuditLog.findHighRiskActivities({
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      riskLevel
    });

    res.json({
      success: true,
      count: activities.length,
      activities
    });
  } catch (error) {
    console.error('High-risk activities fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching high-risk activities'
    });
  }
});

// @route   GET /api/audit/compliance
// @desc    Get compliance report
// @access  Private (Admin only)
router.get('/compliance', protect, authorize('admin'), [
  query('startDate').isISO8601().withMessage('Valid start date is required'),
  query('endDate').isISO8601().withMessage('Valid end date is required')
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

    const { startDate, endDate } = req.query;

    const complianceData = await AuditLog.getComplianceReport(
      new Date(startDate),
      new Date(endDate)
    );

    res.json({
      success: true,
      period: { startDate, endDate },
      complianceData
    });
  } catch (error) {
    console.error('Compliance report fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching compliance report'
    });
  }
});

// @route   GET /api/audit/statistics
// @desc    Get audit statistics
// @access  Private
router.get('/statistics', protect, permit('audit:read'), [
  query('period').optional().isIn(['today', 'week', 'month', 'quarter', 'year']),
  query('startDate').optional().isISO8601(),
  query('endDate').optional().isISO8601()
], async (req, res) => {
  try {
    const { period = 'month', startDate, endDate } = req.query;
    
    // Calculate date range
    const now = new Date();
    let dateStart, dateEnd;

    if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
    } else {
      switch (period) {
        case 'today':
          dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          dateEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
          break;
        case 'week':
          dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
          dateEnd = now;
          break;
        case 'month':
          dateStart = new Date(now.getFullYear(), now.getMonth(), 1);
          dateEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
          break;
        case 'quarter':
          const quarter = Math.floor(now.getMonth() / 3);
          dateStart = new Date(now.getFullYear(), quarter * 3, 1);
          dateEnd = new Date(now.getFullYear(), quarter * 3 + 3, 0);
          break;
        case 'year':
          dateStart = new Date(now.getFullYear(), 0, 1);
          dateEnd = new Date(now.getFullYear(), 11, 31);
          break;
        default:
          dateStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
          dateEnd = now;
      }
    }

    // Build base query
    let baseQuery = {
      'details.timestamp': { $gte: dateStart, $lte: dateEnd }
    };

    // Non-admin users can only see their own statistics
    if (req.user.role !== 'admin') {
      baseQuery.userId = req.user._id;
    }

    // Aggregate statistics
    const [
      actionStats,
      resourceStats,
      riskStats,
      outcomeStats,
      userStats
    ] = await Promise.all([
      // Action breakdown
      AuditLog.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$action',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Resource type breakdown
      AuditLog.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$resourceType',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Risk level breakdown
      AuditLog.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$riskLevel',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // Outcome breakdown
      AuditLog.aggregate([
        { $match: baseQuery },
        {
          $group: {
            _id: '$outcome',
            count: { $sum: 1 }
          }
        },
        { $sort: { count: -1 } }
      ]),
      
      // User activity (admin only)
      req.user.role === 'admin' ? AuditLog.aggregate([
        { $match: { 'details.timestamp': { $gte: dateStart, $lte: dateEnd } } },
        {
          $group: {
            _id: '$userId',
            actionCount: { $sum: 1 },
            lastActivity: { $max: '$details.timestamp' }
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: '_id',
            foreignField: '_id',
            as: 'userInfo'
          }
        },
        { $unwind: '$userInfo' },
        {
          $project: {
            username: '$userInfo.username',
            role: '$userInfo.role',
            actionCount: 1,
            lastActivity: 1
          }
        },
        { $sort: { actionCount: -1 } },
        { $limit: 10 }
      ]) : []
    ]);

    // Get compliance metrics
    const complianceMetrics = await AuditLog.aggregate([
      { $match: baseQuery },
      {
        $group: {
          _id: null,
          totalLogs: { $sum: 1 },
          highRiskCount: {
            $sum: {
              $cond: [{ $eq: ['$riskLevel', 'high'] }, 1, 0]
            }
          },
          criticalRiskCount: {
            $sum: {
              $cond: [{ $eq: ['$riskLevel', 'critical'] }, 1, 0]
            }
          },
          piiAccessedCount: {
            $sum: {
              $cond: ['$compliance.piiAccessed', 1, 0]
            }
          },
          phiAccessedCount: {
            $sum: {
              $cond: ['$compliance.phiAccessed', 1, 0]
            }
          },
          financialAccessedCount: {
            $sum: {
              $cond: ['$compliance.financialAccessed', 1, 0]
            }
          },
          requiresReviewCount: {
            $sum: {
              $cond: ['$compliance.requiresReview', 1, 0]
            }
          }
        }
      }
    ]);

    const totalLogs = complianceMetrics[0]?.totalLogs || 0;

    res.json({
      success: true,
      period: period || 'custom',
      dateRange: { startDate: dateStart, endDate: dateEnd },
      summary: {
        totalLogs,
        highRiskPercentage: totalLogs > 0 ? ((complianceMetrics[0]?.highRiskCount || 0) / totalLogs * 100).toFixed(2) : 0,
        criticalRiskPercentage: totalLogs > 0 ? ((complianceMetrics[0]?.criticalRiskCount || 0) / totalLogs * 100).toFixed(2) : 0,
        complianceScore: totalLogs > 0 ? Math.max(0, 100 - ((complianceMetrics[0]?.highRiskCount || 0) + (complianceMetrics[0]?.criticalRiskCount || 0)) / totalLogs * 100).toFixed(2) : 100
      },
      actionStats,
      resourceStats,
      riskStats,
      outcomeStats,
      userStats,
      complianceMetrics: complianceMetrics[0] || {}
    });
  } catch (error) {
    console.error('Audit statistics error:', error);
    res.status(500).json({
      success: false,
      error: 'Error fetching audit statistics'
    });
  }
});

// @route   POST /api/audit/:logId/review
// @desc    Review audit log
// @access  Private (Admin only)
router.post('/:logId/review', protect, authorize('admin'), [
  query('reviewNotes').optional().isString()
], async (req, res) => {
  try {
    const { logId } = req.params;
    const { reviewNotes } = req.body;

    const log = await AuditLog.findById(logId);

    if (!log) {
      return res.status(404).json({
        success: false,
        error: 'Audit log not found'
      });
    }

    await log.review(req.user._id, reviewNotes);

    res.json({
      success: true,
      message: 'Audit log reviewed successfully'
    });
  } catch (error) {
    console.error('Audit log review error:', error);
    res.status(500).json({
      success: false,
      error: 'Error reviewing audit log'
    });
  }
});

// @route   GET /api/audit/export
// @desc    Export audit logs
// @access  Private (Admin only)
router.get('/export', protect, authorize('admin'), [
  query('startDate').isISO8601().withMessage('Valid start date is required'),
  query('endDate').isISO8601().withMessage('Valid end date is required'),
  query('format').optional().isIn(['json', 'csv', 'excel'])
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

    const { startDate, endDate, format = 'json' } = req.query;

    const logs = await AuditLog.find({
      'details.timestamp': { $gte: new Date(startDate), $lte: new Date(endDate) }
    })
    .populate('userId', 'username email role')
    .sort({ 'details.timestamp': -1 });

    if (format === 'json') {
      res.json({
        success: true,
        count: logs.length,
        logs
      });
    } else {
      // For CSV/Excel, would need to implement file generation
      res.status(400).json({
        success: false,
        error: 'Export format not yet implemented'
      });
    }
  } catch (error) {
    console.error('Audit export error:', error);
    res.status(500).json({
      success: false,
      error: 'Error exporting audit logs'
    });
  }
});

module.exports = router;
