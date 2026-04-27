const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Policy = require('../models/Policy');
const Claim = require('../models/Claim');
const Payment = require('../models/Payment');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { protect, authorize, permit } = require('../middleware/auth');
const ExcelJS = require('excel4node');
const PDFDocument = require('pdfkit');

const router = express.Router();

// Helper function to calculate date ranges
const getDateRange = (period) => {
  const now = new Date();
  let startDate, endDate;

  switch (period) {
    case 'today':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
      break;
    case 'week':
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);
      endDate = now;
      break;
    case 'month':
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
      endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      break;
    case 'quarter':
      const quarter = Math.floor(now.getMonth() / 3);
      startDate = new Date(now.getFullYear(), quarter * 3, 1);
      endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
      break;
    case 'year':
      startDate = new Date(now.getFullYear(), 0, 1);
      endDate = new Date(now.getFullYear(), 11, 31);
      break;
    default:
      startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 30);
      endDate = now;
  }

  return { startDate, endDate };
};

// @route   GET /api/reports/dashboard
// @desc    Get dashboard statistics
// @access  Private
router.get('/dashboard', protect, permit('report:read'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Get user-specific data based on role
    let matchCondition = { createdAt: { $gte: startDate, $lte: endDate } };
    
    if (req.user.role !== 'admin') {
      matchCondition.provider = req.user._id;
    }

    // Parallel data aggregation
    const [
      policyStats,
      claimStats,
      paymentStats,
      userStats
    ] = await Promise.all([
      // Policy statistics
      Policy.aggregate([
        { $match: matchCondition },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalPremium: { $sum: '$premium.amount' }
          }
        }
      ]),
      
      // Claim statistics
      Claim.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        ...(req.user.role !== 'admin' ? [{
          $lookup: {
            from: 'policies',
            localField: 'policy',
            foreignField: '_id',
            as: 'policyInfo'
          }
        }, {
          $match: { 'policyInfo.provider': req.user._id }
        }] : []),
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalEstimated: { $sum: '$estimatedAmount' },
            totalApproved: { $sum: '$approvedAmount' }
          }
        }
      ]),
      
      // Payment statistics
      Payment.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            totalAmount: { $sum: '$amount' }
          }
        }
      ]),
      
      // User statistics (admin only)
      req.user.role === 'admin' ? User.aggregate([
        { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
        {
          $group: {
            _id: '$role',
            count: { $sum: 1 }
          }
        }
      ]) : []
    ]);

    // Calculate totals
    const totalPolicies = policyStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalClaims = claimStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalPayments = paymentStats.reduce((sum, stat) => sum + stat.count, 0);
    const totalPremium = policyStats.reduce((sum, stat) => sum + stat.totalPremium, 0);
    const totalClaimValue = claimStats.reduce((sum, stat) => sum + stat.totalApproved, 0);

    res.json({
      success: true,
      period,
      dateRange: { startDate, endDate },
      summary: {
        totalPolicies,
        totalClaims,
        totalPayments,
        totalPremium,
        totalClaimValue,
        claimApprovalRate: totalClaims > 0 ? (claimStats.find(s => s._id === 'approved')?.count || 0) / totalClaims * 100 : 0
      },
      policyStats,
      claimStats,
      paymentStats,
      userStats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating dashboard statistics'
    });
  }
});

// @route   GET /api/reports/claims
// @desc    Get detailed claims report
// @access  Private
router.get('/claims', protect, permit('report:read'), [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('status').optional().isIn(['submitted', 'under_review', 'investigation', 'approved', 'rejected', 'paid', 'closed']),
  query('claimType').optional().isIn(['medical', 'property', 'liability', 'death', 'disability']),
  query('format').optional().isIn(['json', 'excel', 'pdf'])
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

    const { startDate, endDate, status, claimType, format = 'json' } = req.query;
    
    // Build match condition
    let matchCondition = {};
    
    if (startDate || endDate) {
      matchCondition.createdAt = {};
      if (startDate) matchCondition.createdAt.$gte = new Date(startDate);
      if (endDate) matchCondition.createdAt.$lte = new Date(endDate);
    }
    
    if (status) matchCondition.status = status;
    if (claimType) matchCondition.claimType = claimType;

    // Add provider filter for non-admin users
    if (req.user.role !== 'admin') {
      const providerPolicies = await Policy.find({ provider: req.user._id }).select('_id');
      matchCondition.policy = { $in: providerPolicies.map(p => p._id) };
    }

    // Aggregate claim data
    const claims = await Claim.aggregate([
      { $match: matchCondition },
      {
        $lookup: {
          from: 'policies',
          localField: 'policy',
          foreignField: '_id',
          as: 'policyInfo'
        }
      },
      { $unwind: '$policyInfo' },
      {
        $lookup: {
          from: 'users',
          localField: 'policyInfo.provider',
          foreignField: '_id',
          as: 'providerInfo'
        }
      },
      { $unwind: '$providerInfo' },
      {
        $project: {
          claimNumber: 1,
          claimant: 1,
          incident: 1,
          claimType: 1,
          estimatedAmount: 1,
          approvedAmount: 1,
          deductible: 1,
          status: 1,
          priority: 1,
          createdAt: 1,
          updatedAt: 1,
          ageInDays: 1,
          netPayableAmount: 1,
          'policyInfo.policyNumber': 1,
          'policyInfo.policyType': 1,
          'providerInfo.username': 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    if (format === 'json') {
      res.json({
        success: true,
        count: claims.length,
        claims
      });
    } else if (format === 'excel') {
      await generateExcelReport(res, claims, 'claims-report');
    } else if (format === 'pdf') {
      await generatePDFReport(res, claims, 'claims-report');
    }
  } catch (error) {
    console.error('Claims report error:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating claims report'
    });
  }
});

// @route   GET /api/reports/payments
// @desc    Get detailed payments report
// @access  Private
router.get('/payments', protect, permit('report:read'), [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('status').optional().isIn(['pending', 'processing', 'completed', 'failed', 'cancelled', 'refunded']),
  query('type').optional().isIn(['premium', 'claim', 'refund', 'fee']),
  query('method').optional().isIn(['stripe', 'paypal', 'bank_transfer', 'check', 'cash'])
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

    const { startDate, endDate, status, type, method } = req.query;
    
    // Build match condition
    let matchCondition = {};
    
    if (startDate || endDate) {
      matchCondition.createdAt = {};
      if (startDate) matchCondition.createdAt.$gte = new Date(startDate);
      if (endDate) matchCondition.createdAt.$lte = new Date(endDate);
    }
    
    if (status) matchCondition.status = status;
    if (type) matchCondition.type = type;
    if (method) matchCondition.method = method;

    // Aggregate payment data
    const payments = await Payment.aggregate([
      { $match: matchCondition },
      {
        $lookup: {
          from: 'users',
          localField: 'processedBy',
          foreignField: '_id',
          as: 'processorInfo'
        }
      },
      { $unwind: { path: '$processorInfo', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          paymentId: 1,
          type: 1,
          amount: 1,
          currency: 1,
          status: 1,
          method: 1,
          payer: 1,
          relatedEntity: 1,
          processing: 1,
          createdAt: 1,
          processedAt: 1,
          'processorInfo.username': 1
        }
      },
      { $sort: { createdAt: -1 } }
    ]);

    // Calculate summary statistics
    const totalAmount = payments.reduce((sum, payment) => sum + payment.amount, 0);
    const completedPayments = payments.filter(p => p.status === 'completed');
    const completedAmount = completedPayments.reduce((sum, payment) => sum + payment.amount, 0);

    res.json({
      success: true,
      count: payments.length,
      summary: {
        totalAmount,
        completedAmount,
        completionRate: payments.length > 0 ? (completedPayments.length / payments.length) * 100 : 0
      },
      payments
    });
  } catch (error) {
    console.error('Payments report error:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating payments report'
    });
  }
});

// @route   GET /api/reports/performance
// @desc    Get performance metrics report
// @access  Private
router.get('/performance', protect, permit('report:read'), async (req, res) => {
  try {
    const { period = 'month' } = req.query;
    const { startDate, endDate } = getDateRange(period);

    // Claim processing metrics
    const claimMetrics = await Claim.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      ...(req.user.role !== 'admin' ? [{
        $lookup: {
          from: 'policies',
          localField: 'policy',
          foreignField: '_id',
          as: 'policyInfo'
        }
      }, {
        $match: { 'policyInfo.provider': req.user._id }
      }] : []),
      {
        $group: {
          _id: null,
          totalClaims: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $ne: ['$processedAt', null] },
                { $subtract: ['$processedAt', '$createdAt'] },
                null
              ]
            }
          },
          avgAgeInDays: { $avg: '$ageInDays' },
          approvedClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] }
          },
          rejectedClaims: {
            $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] }
          }
        }
      }
    ]);

    // Payment processing metrics
    const paymentMetrics = await Payment.aggregate([
      { $match: { createdAt: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$method',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' },
          avgAmount: { $avg: '$amount' },
          successRate: {
            $avg: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    // User activity metrics
    const userActivity = await AuditLog.aggregate([
      { $match: { timestamp: { $gte: startDate, $lte: endDate } } },
      {
        $group: {
          _id: '$userId',
          actionCount: { $sum: 1 },
          uniqueActions: { $addToSet: '$action' },
          lastActivity: { $max: '$timestamp' }
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
          uniqueActionCount: { $size: '$uniqueActions' },
          lastActivity: 1
        }
      },
      { $sort: { actionCount: -1 } }
    ]);

    res.json({
      success: true,
      period,
      dateRange: { startDate, endDate },
      claimMetrics: claimMetrics[0] || {},
      paymentMetrics,
      userActivity
    });
  } catch (error) {
    console.error('Performance report error:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating performance report'
    });
  }
});

// @route   GET /api/reports/compliance
// @desc    Get compliance and audit report
// @access  Private (Admin only)
router.get('/compliance', protect, authorize('admin'), [
  query('startDate').optional().isISO8601().withMessage('Invalid start date'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date'),
  query('riskLevel').optional().isIn(['low', 'medium', 'high', 'critical'])
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
    
    // Get compliance report
    const complianceData = await AuditLog.getComplianceReport(
      startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate ? new Date(endDate) : new Date()
    );

    // Get high-risk activities
    const highRiskActivities = await AuditLog.findHighRiskActivities({
      startDate: startDate ? new Date(startDate) : new Date(Date.now() - 24 * 60 * 60 * 1000),
      endDate: endDate ? new Date(endDate) : new Date(),
      riskLevel
    });

    // Get access patterns
    const accessPatterns = await AuditLog.aggregate([
      {
        $match: {
          timestamp: {
            $gte: startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            $lte: endDate ? new Date(endDate) : new Date()
          }
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            resourceType: '$resourceType'
          },
          accessCount: { $sum: 1 },
          uniqueUsers: { $addToSet: '$userId' }
        }
      },
      {
        $project: {
          date: '$_id.date',
          resourceType: '$_id.resourceType',
          accessCount: 1,
          uniqueUserCount: { $size: '$uniqueUsers' },
          _id: 0
        }
      },
      { $sort: { date: -1, accessCount: -1 } }
    ]);

    res.json({
      success: true,
      complianceData,
      highRiskActivities,
      accessPatterns
    });
  } catch (error) {
    console.error('Compliance report error:', error);
    res.status(500).json({
      success: false,
      error: 'Error generating compliance report'
    });
  }
});

// Helper function to generate Excel report
const generateExcelReport = async (res, data, filename) => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Report');

  // Add headers
  const headers = Object.keys(data[0] || {});
  ws.addRow(headers);

  // Add data
  data.forEach(item => {
    const row = headers.map(header => {
      const value = item[header];
      return typeof value === 'object' ? JSON.stringify(value) : value;
    });
    ws.addRow(row);
  });

  // Set response headers
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.xlsx`);

  // Write to response
  await wb.xlsx.write(res);
  res.end();
};

// Helper function to generate PDF report
const generatePDFReport = async (res, data, filename) => {
  const doc = new PDFDocument();

  // Set response headers
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}.pdf`);

  // Pipe PDF to response
  doc.pipe(res);

  // Add content
  doc.fontSize(20).text('Insurance Provider Portal Report', { align: 'center' });
  doc.moveDown();
  
  doc.fontSize(14).text(`Generated on: ${new Date().toLocaleDateString()}`);
  doc.moveDown();

  // Add table headers
  const headers = Object.keys(data[0] || {});
  let y = 150;
  
  headers.forEach((header, index) => {
    doc.fontSize(10).text(header, 50 + index * 100, y, { width: 90 });
  });
  
  y += 20;

  // Add data rows
  data.slice(0, 20).forEach(item => { // Limit to 20 rows for PDF
    headers.forEach((header, index) => {
      const value = item[header];
      const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
      doc.fontSize(8).text(text.substring(0, 15), 50 + index * 100, y, { width: 90 });
    });
    y += 15;
  });

  doc.end();
};

module.exports = router;
