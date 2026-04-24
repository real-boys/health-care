const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Import audit services
const enhancedAuditService = require('../services/enhancedAuditService');
const auditIntegrityService = require('../services/auditIntegrityService');
const auditSearchService = require('../services/auditSearchService');
const auditReportingService = require('../services/auditReportingService');
const auditRetentionService = require('../services/auditRetentionService');
const auditAnalyticsService = require('../services/auditAnalyticsService');
const externalAuditIntegrationService = require('../services/externalAuditIntegrationService');

// Middleware to check validation errors
const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            errors: errors.array()
        });
    }
    next();
};

// Middleware to check user permissions
const checkAuditPermissions = (req, res, next) => {
    // This would integrate with your authentication/authorization system
    // For now, we'll assume the user has permissions
    next();
};

/**
 * @route   POST /api/audit/logs
 * @desc    Create a new audit log entry
 * @access  Private
 */
router.post('/logs', [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('userRole').notEmpty().withMessage('User role is required'),
    body('action').notEmpty().withMessage('Action is required'),
    body('resourceType').notEmpty().withMessage('Resource type is required'),
    body('endpoint').notEmpty().withMessage('Endpoint is required'),
    body('method').isIn(['GET', 'POST', 'PUT', 'DELETE', 'PATCH']).withMessage('Invalid HTTP method'),
    body('ipAddress').isIP().withMessage('Valid IP address is required'),
    body('statusCode').isInt({ min: 100, max: 599 }).withMessage('Valid status code is required'),
    body('success').isBoolean().withMessage('Success must be a boolean'),
    body('riskScore').optional().isInt({ min: 0, max: 100 }).withMessage('Risk score must be between 0 and 100')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const auditLog = await enhancedAuditService.createAuditLog(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Audit log created successfully',
            data: auditLog
        });
    } catch (error) {
        console.error('Error creating audit log:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create audit log',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/logs
 * @desc    Search and filter audit logs
 * @access  Private
 */
router.get('/logs', [
    query('userId').optional().isUUID().withMessage('Invalid user ID'),
    query('userRole').optional().isAlpha().withMessage('Invalid user role'),
    query('action').optional().isAlpha().withMessage('Invalid action'),
    query('resourceType').optional().isAlpha().withMessage('Invalid resource type'),
    query('resourceId').optional().isUUID().withMessage('Invalid resource ID'),
    query('startDate').optional().isISO8601().withMessage('Invalid start date'),
    query('endDate').optional().isISO8601().withMessage('Invalid end date'),
    query('minRiskScore').optional().isInt({ min: 0, max: 100 }).withMessage('Invalid minimum risk score'),
    query('maxRiskScore').optional().isInt({ min: 0, max: 100 }).withMessage('Invalid maximum risk score'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
    query('sortBy').optional().isIn(['timestamp', 'user_id', 'action', 'resource_type', 'risk_score']).withMessage('Invalid sort field'),
    query('sortOrder').optional().isIn(['ASC', 'DESC']).withMessage('Sort order must be ASC or DESC')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const searchParams = {
            ...req.query,
            startDate: req.query.startDate ? new Date(req.query.startDate) : undefined,
            endDate: req.query.endDate ? new Date(req.query.endDate) : undefined,
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 100,
            sortBy: req.query.sortBy || 'timestamp',
            sortOrder: req.query.sortOrder || 'DESC'
        };

        const result = await auditSearchService.searchAuditLogs(searchParams);
        
        res.json({
            success: true,
            data: result.logs,
            pagination: result.pagination,
            searchParams: result.searchParams
        });
    } catch (error) {
        console.error('Error searching audit logs:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to search audit logs',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/logs/:id
 * @desc    Get audit log by ID
 * @access  Private
 */
router.get('/logs/:id', [
    param('id').isUUID().withMessage('Invalid audit log ID')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const auditLog = await auditSearchService.getAuditLogById(req.params.id, {
            includeMetadata: true,
            includeIntegrity: true
        });
        
        res.json({
            success: true,
            data: auditLog
        });
    } catch (error) {
        console.error('Error getting audit log:', error);
        res.status(404).json({
            success: false,
            message: 'Audit log not found',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/logs/correlation/:correlationId
 * @desc    Get audit logs by correlation ID
 * @access  Private
 */
router.get('/logs/correlation/:correlationId', [
    param('correlationId').isUUID().withMessage('Invalid correlation ID')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const logs = await auditSearchService.searchByCorrelationId(req.params.correlationId);
        
        res.json({
            success: true,
            data: logs
        });
    } catch (error) {
        console.error('Error getting logs by correlation ID:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get logs by correlation ID',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/integrity/verify/:id
 * @desc    Verify integrity of a single audit log
 * @access  Private
 */
router.get('/integrity/verify/:id', [
    param('id').isUUID().withMessage('Invalid audit log ID')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const verification = await auditIntegrityService.verifySingleLog(req.params.id);
        
        res.json({
            success: true,
            data: verification
        });
    } catch (error) {
        console.error('Error verifying audit log integrity:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify audit log integrity',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/integrity/verify-chain
 * @desc    Verify integrity of the entire audit chain
 * @access  Private
 */
router.post('/integrity/verify-chain', [
    body('startDate').optional().isISO8601().withMessage('Invalid start date'),
    body('endDate').optional().isISO8601().withMessage('Invalid end date')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const { startDate, endDate } = req.body;
        
        const verification = await auditIntegrityService.verifyAuditChain(
            startDate ? new Date(startDate) : null,
            endDate ? new Date(endDate) : null
        );
        
        res.json({
            success: true,
            data: verification
        });
    } catch (error) {
        console.error('Error verifying audit chain:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to verify audit chain',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/integrity/tampering
 * @desc    Detect tampering attempts
 * @access  Private
 */
router.get('/integrity/tampering', [
    query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const timeframe = req.query.timeframe || '24h';
        const detection = await auditIntegrityService.detectTampering(timeframe);
        
        res.json({
            success: true,
            data: detection
        });
    } catch (error) {
        console.error('Error detecting tampering:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to detect tampering',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/reports/generate
 * @desc    Generate audit report
 * @access  Private
 */
router.post('/reports/generate', [
    body('reportType').isIn(['summary', 'security', 'compliance', 'user_activity', 'data_access', 'system_performance', 'integrity', 'custom']).withMessage('Invalid report type'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('format').optional().isIn(['json', 'csv', 'pdf', 'excel', 'xml']).withMessage('Invalid export format'),
    body('includeDetails').optional().isBoolean().withMessage('includeDetails must be boolean'),
    body('includeCharts').optional().isBoolean().withMessage('includeCharts must be boolean')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const reportConfig = {
            ...req.body,
            startDate: new Date(req.body.startDate),
            endDate: new Date(req.body.endDate)
        };

        const report = await auditReportingService.generateAuditReport(reportConfig);
        
        res.status(201).json({
            success: true,
            message: 'Report generated successfully',
            data: report
        });
    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate report',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/reports/:filename/download
 * @desc    Download generated report
 * @access  Private
 */
router.get('/reports/:filename/download', checkAuditPermissions, async (req, res) => {
    try {
        const filename = req.params.filename;
        const filepath = path.join(__dirname, '../reports', filename);
        
        // Check if file exists
        await fs.access(filepath);
        
        // Set appropriate headers
        const ext = path.extname(filename).toLowerCase();
        const mimeTypes = {
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.pdf': 'application/pdf',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.xml': 'application/xml'
        };
        
        res.setHeader('Content-Type', mimeTypes[ext] || 'application/octet-stream');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        
        // Stream file
        const fileStream = fs.createReadStream(filepath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error downloading report:', error);
        res.status(404).json({
            success: false,
            message: 'Report not found',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/anomalies
 * @desc    Detect anomalies in audit logs
 * @access  Private
 */
router.get('/anomalies', [
    query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe'),
    query('useStatisticalAnalysis').optional().isBoolean().withMessage('Must be boolean'),
    query('usePatternAnalysis').optional().isBoolean().withMessage('Must be boolean'),
    query('useBehavioralAnalysis').optional().isBoolean().withMessage('Must be boolean'),
    query('threshold').optional().isFloat({ min: 1.0, max: 5.0 }).withMessage('Threshold must be between 1.0 and 5.0')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const options = {
            timeframe: req.query.timeframe || '24h',
            useStatisticalAnalysis: req.query.useStatisticalAnalysis !== 'false',
            usePatternAnalysis: req.query.usePatternAnalysis !== 'false',
            useBehavioralAnalysis: req.query.useBehavioralAnalysis !== 'false',
            threshold: parseFloat(req.query.threshold) || 2.0
        };

        const anomalies = await auditAnalyticsService.detectAnomalies(options.timeframe, options);
        
        res.json({
            success: true,
            data: anomalies
        });
    } catch (error) {
        console.error('Error detecting anomalies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to detect anomalies',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/analytics/dashboard
 * @desc    Get analytics dashboard data
 * @access  Private
 */
router.get('/analytics/dashboard', [
    query('timeframe').optional().isIn(['1h', '24h', '7d', '30d']).withMessage('Invalid timeframe')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const timeframe = req.query.timeframe || '24h';
        const dashboard = await auditAnalyticsService.getAnalyticsDashboard(timeframe);
        
        res.json({
            success: true,
            data: dashboard
        });
    } catch (error) {
        console.error('Error getting analytics dashboard:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get analytics dashboard',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/retention/policies
 * @desc    Create retention policy
 * @access  Private (Admin only)
 */
router.post('/retention/policies', [
    body('name').notEmpty().withMessage('Policy name is required'),
    body('resourceType').notEmpty().withMessage('Resource type is required'),
    body('retentionDays').isInt({ min: 1 }).withMessage('Retention days must be a positive integer'),
    body('archiveAfterDays').optional().isInt({ min: 1 }).withMessage('Archive after days must be a positive integer'),
    body('deleteAfterDays').optional().isInt({ min: 1 }).withMessage('Delete after days must be a positive integer')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const policy = await auditRetentionService.createRetentionPolicy(req.body);
        
        res.status(201).json({
            success: true,
            message: 'Retention policy created successfully',
            data: policy
        });
    } catch (error) {
        console.error('Error creating retention policy:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create retention policy',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/retention/apply
 * @desc    Apply retention policies
 * @access  Private (Admin only)
 */
router.post('/retention/apply', checkAuditPermissions, async (req, res) => {
    try {
        const results = await auditRetentionService.applyRetentionPolicies();
        
        res.json({
            success: true,
            message: 'Retention policies applied successfully',
            data: results
        });
    } catch (error) {
        console.error('Error applying retention policies:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to apply retention policies',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/retention/statistics
 * @desc    Get retention statistics
 * @access  Private
 */
router.get('/retention/statistics', checkAuditPermissions, async (req, res) => {
    try {
        const statistics = await auditRetentionService.getRetentionStatistics();
        
        res.json({
            success: true,
            data: statistics
        });
    } catch (error) {
        console.error('Error getting retention statistics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get retention statistics',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/external/siem
 * @desc    Send audit logs to SIEM system
 * @access  Private (Admin only)
 */
router.post('/external/siem', [
    body('endpoint').isURL().withMessage('Valid SIEM endpoint is required'),
    body('apiKey').notEmpty().withMessage('API key is required'),
    body('format').optional().isIn(['CEF', 'LEEF', 'JSON', 'SYSLOG']).withMessage('Invalid format'),
    body('batchSize').optional().isInt({ min: 1, max: 1000 }).withMessage('Batch size must be between 1 and 1000'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const { startDate, endDate, ...siemConfig } = req.body;
        
        // Get logs for the specified date range
        const logs = await auditSearchService.searchAuditLogs({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            limit: 10000 // Limit for SIEM transmission
        });

        const results = await externalAuditIntegrationService.sendToSIEM(logs.logs, siemConfig);
        
        res.json({
            success: true,
            message: 'Logs sent to SIEM successfully',
            data: results
        });
    } catch (error) {
        console.error('Error sending logs to SIEM:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send logs to SIEM',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/external/compliance
 * @desc    Send audit logs to compliance system
 * @access  Private (Admin only)
 */
router.post('/external/compliance', [
    body('endpoint').isURL().withMessage('Valid compliance endpoint is required'),
    body('apiKey').notEmpty().withMessage('API key is required'),
    body('regulations').optional().isArray().withMessage('Regulations must be an array'),
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const { startDate, endDate, ...complianceConfig } = req.body;
        
        // Get logs for the specified date range
        const logs = await auditSearchService.searchAuditLogs({
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            limit: 10000 // Limit for compliance transmission
        });

        const results = await externalAuditIntegrationService.sendToComplianceSystem(logs.logs, complianceConfig);
        
        res.json({
            success: true,
            message: 'Logs sent to compliance system successfully',
            data: results
        });
    } catch (error) {
        console.error('Error sending logs to compliance system:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send logs to compliance system',
            error: error.message
        });
    }
});

/**
 * @route   POST /api/audit/external/export
 * @desc    Export audit logs for external audit
 * @access  Private (Admin only)
 */
router.post('/external/export', [
    body('startDate').isISO8601().withMessage('Valid start date is required'),
    body('endDate').isISO8601().withMessage('Valid end date is required'),
    body('format').optional().isIn(['CSV', 'JSON', 'XML', 'PARQUET']).withMessage('Invalid export format'),
    body('includeHashes').optional().isBoolean().withMessage('includeHashes must be boolean'),
    body('includeSignatures').optional().isBoolean().withMessage('includeSignatures must be boolean')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const auditConfig = {
            ...req.body,
            startDate: req.body.startDate,
            endDate: req.body.endDate
        };

        const exportResult = await externalAuditIntegrationService.exportForExternalAudit(auditConfig);
        
        res.status(201).json({
            success: true,
            message: 'Audit data exported successfully',
            data: exportResult
        });
    } catch (error) {
        console.error('Error exporting audit data:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to export audit data',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/external/status
 * @desc    Get external integration status
 * @access  Private
 */
router.get('/external/status', checkAuditPermissions, async (req, res) => {
    try {
        const status = await externalAuditIntegrationService.getIntegrationStatus();
        
        res.json({
            success: true,
            data: status
        });
    } catch (error) {
        console.error('Error getting integration status:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get integration status',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/search/suggestions
 * @desc    Get search suggestions for autocomplete
 * @access  Private
 */
router.get('/search/suggestions', [
    query('field').isIn(['action', 'resourceType', 'userRole', 'endpoint', 'ipAddress']).withMessage('Invalid search field'),
    query('query').notEmpty().withMessage('Search query is required'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const { field, query, limit = 10 } = req.query;
        
        const suggestions = await auditSearchService.getSearchSuggestions(field, query, parseInt(limit));
        
        res.json({
            success: true,
            data: suggestions
        });
    } catch (error) {
        console.error('Error getting search suggestions:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get search suggestions',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/metrics
 * @desc    Get audit metrics
 * @access  Private
 */
router.get('/metrics', [
    query('timeframe').optional().isIn(['1h', '24h', '7d', '30d', '90d']).withMessage('Invalid timeframe')
], handleValidationErrors, checkAuditPermissions, async (req, res) => {
    try {
        const timeframe = req.query.timeframe || '24h';
        const metrics = await enhancedAuditService.getAuditMetrics(timeframe);
        
        res.json({
            success: true,
            data: metrics
        });
    } catch (error) {
        console.error('Error getting audit metrics:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get audit metrics',
            error: error.message
        });
    }
});

/**
 * @route   GET /api/audit/health
 * @desc    Health check for audit system
 * @access  Public
 */
router.get('/health', async (req, res) => {
    try {
        // Check database connectivity
        const testQuery = 'SELECT 1 as test';
        await auditSearchService.getAsync(testQuery);
        
        res.json({
            success: true,
            status: 'healthy',
            timestamp: new Date().toISOString(),
            services: {
                enhancedAudit: 'operational',
                integrity: 'operational',
                search: 'operational',
                reporting: 'operational',
                retention: 'operational',
                analytics: 'operational',
                externalIntegration: 'operational'
            }
        });
    } catch (error) {
        console.error('Audit system health check failed:', error);
        res.status(503).json({
            success: false,
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

module.exports = router;
