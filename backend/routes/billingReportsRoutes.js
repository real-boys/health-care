const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();
const path = require('path');

// Import services
const billingReportsService = require('../services/billingReportsService');

// Middleware for validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation errors',
      errors: errors.array()
    });
  }
  next();
};

/**
 * @route   POST /api/billing-reports/generate
 * @desc    Generate billing report
 * @access  Private
 */
router.post('/generate', [
  body('reportType').isIn(['summary', 'detailed', 'aging', 'tax', 'provider', 'payment']).withMessage('Invalid report type'),
  body('dateRangeStart').isISO8601().withMessage('Date range start is required'),
  body('dateRangeEnd').isISO8601().withMessage('Date range end is required'),
  body('format').optional().isIn(['pdf', 'excel', 'csv']).withMessage('Invalid format'),
  body('filters').optional().isObject().withMessage('Filters must be an object'),
  body('includeCharts').optional().isBoolean().withMessage('Include charts must be a boolean'),
  body('includeDetails').optional().isBoolean().withMessage('Include details must be a boolean')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      reportType,
      dateRangeStart,
      dateRangeEnd,
      format = 'pdf',
      filters = {},
      includeCharts = true,
      includeDetails = true
    } = req.body;

    // Validate date range
    const startDate = new Date(dateRangeStart);
    const endDate = new Date(dateRangeEnd);
    
    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date must be before end date'
      });
    }

    // Generate report
    const reportResult = await billingReportsService.generateBillingReport({
      reportType,
      dateRangeStart: startDate,
      dateRangeEnd: endDate,
      format,
      filters,
      includeCharts,
      includeDetails,
      userId: req.user?.id || null
    });

    res.status(201).json({
      success: true,
      message: 'Report generated successfully',
      data: reportResult
    });
  } catch (error) {
    console.error('Error generating billing report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate billing report',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports
 * @desc    Get billing reports history
 * @access  Private
 */
router.get('/', [
  query('reportType').optional().isIn(['summary', 'detailed', 'aging', 'tax', 'provider', 'payment']).withMessage('Invalid report type'),
  query('status').optional().isIn(['generating', 'completed', 'failed']).withMessage('Invalid status'),
  query('userId').optional().isInt().withMessage('User ID must be an integer'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      reportType,
      status,
      userId,
      limit = 20,
      page = 1
    } = req.query;

    const filters = {
      reportType,
      status,
      userId: userId ? parseInt(userId) : null,
      limit: parseInt(limit),
      page: parseInt(page)
    };

    const reports = await billingReportsService.getReportHistory(filters);

    res.json({
      success: true,
      data: reports,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: reports.length
      }
    });
  } catch (error) {
    console.error('Error fetching billing reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing reports',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/:id
 * @desc    Get billing report by ID
 * @access  Private
 */
router.get('/:id', [
  param('id').isInt().withMessage('Report ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    const report = await billingReportsService.getReportById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('Error fetching billing report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch billing report',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/:id/download
 * @desc    Download billing report file
 * @access  Private
 */
router.get('/:id/download', [
  param('id').isInt().withMessage('Report ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    const report = await billingReportsService.getReportById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    if (report.status !== 'completed') {
      return res.status(400).json({
        success: false,
        message: 'Report is not ready for download'
      });
    }

    if (!report.file_path) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found'
      });
    }

    // Increment download count
    await billingReportsService.incrementDownloadCount(reportId);

    // Send file
    const fileName = path.basename(report.file_path);
    res.download(report.file_path, fileName, (err) => {
      if (err) {
        console.error('Error downloading report:', err);
        res.status(500).json({
          success: false,
          message: 'Failed to download report'
        });
      }
    });
  } catch (error) {
    console.error('Error downloading billing report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download billing report',
      error: error.message
    });
  }
});

/**
 * @route   DELETE /api/billing-reports/:id
 * @desc    Delete billing report
 * @access  Private
 */
router.delete('/:id', [
  param('id').isInt().withMessage('Report ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const reportId = parseInt(req.params.id);

    const report = await billingReportsService.getReportById(reportId);

    if (!report) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }

    await billingReportsService.deleteReport(reportId);

    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting billing report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete billing report',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/types
 * @desc    Get available report types
 * @access  Private
 */
router.get('/types', async (req, res) => {
  try {
    const reportTypes = billingReportsService.getAvailableReportTypes();

    res.json({
      success: true,
      data: reportTypes
    });
  } catch (error) {
    console.error('Error fetching report types:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report types',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/stats/overview
 * @desc    Get billing overview statistics
 * @access  Private
 */
router.get('/stats/overview', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('providerId').optional().isInt().withMessage('Provider ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      providerId
    } = req.query;

    const filters = {};
    if (dateFrom) filters.startDate = new Date(dateFrom);
    if (dateTo) filters.endDate = new Date(dateTo);
    if (providerId) filters.providerId = parseInt(providerId);

    const overviewStats = await billingReportsService.getOverviewStats(
      filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      filters.endDate || new Date(),
      filters
    );

    res.json({
      success: true,
      data: overviewStats
    });
  } catch (error) {
    console.error('Error fetching overview statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch overview statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/stats/revenue
 * @desc    Get revenue statistics
 * @access  Private
 */
router.get('/stats/revenue', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('groupBy').optional().isIn(['day', 'week', 'month']).withMessage('Invalid group by option')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      groupBy = 'day'
    } = req.query;

    const startDate = dateFrom ? new Date(dateFrom) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const endDate = dateTo ? new Date(dateTo) : new Date();

    const revenueStats = await billingReportsService.getRevenueStats(startDate, endDate, { groupBy });

    res.json({
      success: true,
      data: revenueStats
    });
  } catch (error) {
    console.error('Error fetching revenue statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch revenue statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/stats/aging
 * @desc    Get aging statistics
 * @access  Private
 */
router.get('/stats/aging', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('providerId').optional().isInt().withMessage('Provider ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      providerId
    } = req.query;

    const filters = {};
    if (dateFrom) filters.startDate = new Date(dateFrom);
    if (dateTo) filters.endDate = new Date(dateTo);
    if (providerId) filters.providerId = parseInt(providerId);

    const agingStats = await billingReportsService.getAgingStats(
      filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      filters.endDate || new Date(),
      filters
    );

    res.json({
      success: true,
      data: agingStats
    });
  } catch (error) {
    console.error('Error fetching aging statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch aging statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/stats/payments
 * @desc    Get payment statistics
 * @access  Private
 */
router.get('/stats/payments', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('paymentMethod').optional().isString().withMessage('Payment method must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      paymentMethod
    } = req.query;

    const filters = {};
    if (dateFrom) filters.startDate = new Date(dateFrom);
    if (dateTo) filters.endDate = new Date(dateTo);
    if (paymentMethod) filters.paymentMethod = paymentMethod;

    const paymentStats = await billingReportsService.getPaymentStats(
      filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      filters.endDate || new Date(),
      filters
    );

    res.json({
      success: true,
      data: paymentStats
    });
  } catch (error) {
    console.error('Error fetching payment statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch payment statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/stats/providers
 * @desc    Get provider statistics
 * @access  Private
 */
router.get('/stats/providers', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('providerId').optional().isInt().withMessage('Provider ID must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      providerId
    } = req.query;

    const filters = {};
    if (dateFrom) filters.startDate = new Date(dateFrom);
    if (dateTo) filters.endDate = new Date(dateTo);
    if (providerId) filters.providerId = parseInt(providerId);

    const providerStats = await billingReportsService.getProviderStats(
      filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      filters.endDate || new Date(),
      filters
    );

    res.json({
      success: true,
      data: providerStats
    });
  } catch (error) {
    console.error('Error fetching provider statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch provider statistics',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/stats/tax
 * @desc    Get tax statistics
 * @access  Private
 */
router.get('/stats/tax', [
  query('dateFrom').optional().isISO8601().withMessage('Date from must be a valid date'),
  query('dateTo').optional().isISO8601().withMessage('Date to must be a valid date'),
  query('jurisdictionCode').optional().isString().withMessage('Jurisdiction code must be a string')
], handleValidationErrors, async (req, res) => {
  try {
    const {
      dateFrom,
      dateTo,
      jurisdictionCode
    } = req.query;

    const filters = {};
    if (dateFrom) filters.startDate = new Date(dateFrom);
    if (dateTo) filters.endDate = new Date(dateTo);
    if (jurisdictionCode) filters.jurisdictionCode = jurisdictionCode;

    const taxStats = await billingReportsService.getTaxStats(
      filters.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      filters.endDate || new Date(),
      filters
    );

    res.json({
      success: true,
      data: taxStats
    });
  } catch (error) {
    console.error('Error fetching tax statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tax statistics',
      error: error.message
    });
  }
});

/**
 * @route   POST /api/billing-reports/batch-generate
 * @desc    Generate multiple reports in batch
 * @access  Private
 */
router.post('/batch-generate', [
  body('reports').isArray({ min: 1, max: 10 }).withMessage('Reports array must have 1-10 items'),
  body('reports.*.reportType').isIn(['summary', 'detailed', 'aging', 'tax', 'provider', 'payment']).withMessage('Invalid report type'),
  body('reports.*.dateRangeStart').isISO8601().withMessage('Date range start is required'),
  body('reports.*.dateRangeEnd').isISO8601().withMessage('Date range end is required'),
  body('reports.*.format').optional().isIn(['pdf', 'excel', 'csv']).withMessage('Invalid format'),
  body('reports.*.filters').optional().isObject().withMessage('Filters must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const { reports } = req.body;
    const results = [];

    for (const reportConfig of reports) {
      try {
        const result = await billingReportsService.generateBillingReport({
          ...reportConfig,
          dateRangeStart: new Date(reportConfig.dateRangeStart),
          dateRangeEnd: new Date(reportConfig.dateRangeEnd),
          userId: req.user?.id || null
        });
        
        results.push({
          reportType: reportConfig.reportType,
          success: true,
          data: result
        });
      } catch (error) {
        results.push({
          reportType: reportConfig.reportType,
          success: false,
          error: error.message
        });
      }
    }

    res.json({
      success: true,
      message: 'Batch report generation completed',
      data: results
    });
  } catch (error) {
    console.error('Error in batch report generation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to complete batch report generation',
      error: error.message
    });
  }
});

/**
 * @route   GET /api/billing-reports/export/:reportType
 * @desc    Export report data directly without saving
 * @access  Private
 */
router.get('/export/:reportType', [
  param('reportType').isIn(['summary', 'detailed', 'aging', 'tax', 'provider', 'payment']).withMessage('Invalid report type'),
  query('dateFrom').isISO8601().withMessage('Date from is required'),
  query('dateTo').isISO8601().withMessage('Date to is required'),
  query('format').isIn(['json', 'csv']).withMessage('Format must be json or csv')
], handleValidationErrors, async (req, res) => {
  try {
    const { reportType } = req.params;
    const { dateFrom, dateTo, format } = req.query;

    const startDate = new Date(dateFrom);
    const endDate = new Date(dateTo);

    // Get report data
    const reportData = await billingReportsService.getReportData(reportType, startDate, endDate, {});

    if (format === 'json') {
      res.json({
        success: true,
        data: reportData
      });
    } else if (format === 'csv') {
      const csvContent = await billingReportsService.generateCSVReport(reportData, 'export.csv', { reportType });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
      res.send(csvContent);
    }
  } catch (error) {
    console.error('Error exporting report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to export report',
      error: error.message
    });
  }
});

module.exports = router;
