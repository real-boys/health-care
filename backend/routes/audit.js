const express = require('express');
const { body, query, validationResult } = require('express-validator');
const auditService = require('../services/auditService');
const { authenticateToken, requireRole } = require('../middleware/auth');

const router = express.Router();

// Middleware to check for audit-specific permissions
const requireAuditPermission = (req, res, next) => {
    const user = req.user;
    
    // Admin and compliance officers can access all audit features
    if (['admin', 'compliance_officer'].includes(user.role)) {
        return next();
    }
    
    // Users can only view their own audit logs
    if (req.path.includes('/my-logs')) {
        return next();
    }
    
    // Read-only access for auditors
    if (user.role === 'auditor' && req.method === 'GET') {
        return next();
    }
    
    return res.status(403).json({ 
        error: 'Insufficient permissions for audit operations' 
    });
};

// Get audit logs with advanced filtering
router.get('/logs', 
    authenticateToken,
    requireAuditPermission,
    [
        query('user_id').optional().isUUID(),
        query('action').optional().isIn(['CREATE', 'READ', 'UPDATE', 'DELETE', 'EXPORT', 'LOGIN', 'LOGOUT', 'ADMIN']),
        query('resource_type').optional().isString(),
        query('resource_id').optional().isUUID(),
        query('start_date').optional().isISO8601(),
        query('end_date').optional().isISO8601(),
        query('min_risk_score').optional().isInt({ min: 0, max: 100 }),
        query('max_risk_score').optional().isInt({ min: 0, max: 100 }),
        query('success').optional().isBoolean(),
        query('ip_address').optional().isIP(),
        query('correlation_id').optional().isUUID(),
        query('limit').optional().isInt({ min: 1, max: 1000 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const filters = {
                ...req.query,
                success: req.query.success === 'true' ? true : req.query.success === 'false' ? false : undefined
            };

            const logs = await auditService.getAuditLogs(filters);
            
            res.json({
                success: true,
                data: logs,
                total: logs.length,
                filters: filters
            });
        } catch (error) {
            console.error('Error fetching audit logs:', error);
            res.status(500).json({ 
                error: 'Failed to fetch audit logs',
                message: error.message
            });
        }
    }
);

// Get current user's audit logs
router.get('/my-logs',
    authenticateToken,
    [
        query('start_date').optional().isISO8601(),
        query('end_date').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 100 }),
        query('offset').optional().isInt({ min: 0 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const filters = {
                user_id: req.user.id,
                ...req.query
            };

            const logs = await auditService.getAuditLogs(filters);
            
            res.json({
                success: true,
                data: logs,
                total: logs.length
            });
        } catch (error) {
            console.error('Error fetching user audit logs:', error);
            res.status(500).json({ 
                error: 'Failed to fetch audit logs',
                message: error.message
            });
        }
    }
);

// Get audit metrics for dashboard
router.get('/metrics',
    authenticateToken,
    requireAuditPermission,
    [
        query('timeframe').optional().isIn(['1h', '24h', '7d', '30d', '90d'])
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const timeframe = req.query.timeframe || '24h';
            
            const [metrics, operationsBreakdown, userActivity] = await Promise.all([
                auditService.getAuditMetrics(timeframe),
                auditService.getOperationsBreakdown(timeframe),
                auditService.getUserActivitySummary(timeframe, 10)
            ]);

            res.json({
                success: true,
                data: {
                    metrics,
                    operations_breakdown: operationsBreakdown,
                    top_users: userActivity,
                    timeframe
                }
            });
        } catch (error) {
            console.error('Error fetching audit metrics:', error);
            res.status(500).json({ 
                error: 'Failed to fetch audit metrics',
                message: error.message
            });
        }
    }
);

// Get compliance violations
router.get('/violations',
    authenticateToken,
    requireAuditPermission,
    [
        query('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        query('resolved').optional().isBoolean(),
        query('start_date').optional().isISO8601(),
        query('end_date').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 1000 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const filters = {
                ...req.query,
                resolved: req.query.resolved === 'true' ? true : req.query.resolved === 'false' ? false : undefined
            };

            const violations = await auditService.getComplianceViolations(filters);
            
            res.json({
                success: true,
                data: violations,
                total: violations.length
            });
        } catch (error) {
            console.error('Error fetching compliance violations:', error);
            res.status(500).json({ 
                error: 'Failed to fetch compliance violations',
                message: error.message
            });
        }
    }
);

// Get detected anomalies
router.get('/anomalies',
    authenticateToken,
    requireAuditPermission,
    [
        query('severity').optional().isIn(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
        query('investigated').optional().isBoolean(),
        query('false_positive').optional().isBoolean(),
        query('start_date').optional().isISO8601(),
        query('end_date').optional().isISO8601(),
        query('limit').optional().isInt({ min: 1, max: 1000 })
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            // For now, trigger anomaly detection and get results
            await auditService.detectAnomalies();
            
            // Query detected anomalies
            let sql = `
                SELECT da.*, ap.name as pattern_name, ap.description as pattern_description
                FROM detected_anomalies da
                JOIN anomaly_patterns ap ON da.pattern_id = ap.id
                WHERE 1=1
            `;
            const params = [];

            if (req.query.severity) {
                sql += ' AND da.severity = ?';
                params.push(req.query.severity);
            }

            if (req.query.investigated !== undefined) {
                sql += ' AND da.investigated = ?';
                params.push(req.query.investigated === 'true' ? 1 : 0);
            }

            if (req.query.false_positive !== undefined) {
                sql += ' AND da.false_positive = ?';
                params.push(req.query.false_positive === 'true' ? 1 : 0);
            }

            if (req.query.start_date) {
                sql += ' AND da.created_at >= ?';
                params.push(req.query.start_date);
            }

            if (req.query.end_date) {
                sql += ' AND da.created_at <= ?';
                params.push(req.query.end_date);
            }

            sql += ' ORDER BY da.created_at DESC';

            if (req.query.limit) {
                sql += ' LIMIT ?';
                params.push(parseInt(req.query.limit));
            }

            const anomalies = await auditService.queryAsync(sql, params);
            
            res.json({
                success: true,
                data: anomalies,
                total: anomalies.length
            });
        } catch (error) {
            console.error('Error fetching anomalies:', error);
            res.status(500).json({ 
                error: 'Failed to fetch anomalies',
                message: error.message
            });
        }
    }
);

// Generate compliance reports
router.post('/reports',
    authenticateToken,
    requireAuditPermission,
    [
        body('report_type').isIn(['HIPAA', 'GDPR', 'SECURITY', 'USER_ACTIVITY']),
        body('start_date').isISO8601(),
        body('end_date').isISO8601(),
        body('format').optional().isIn(['JSON', 'CSV', 'PDF'])
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const { report_type, start_date, end_date, format = 'JSON' } = req.body;

            const report = await auditService.generateComplianceReport(report_type, start_date, end_date);

            if (format === 'CSV') {
                // Convert to CSV format
                const csv = convertReportToCSV(report);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="${report_type}_report_${start_date}_to_${end_date}.csv"`);
                res.send(csv);
            } else {
                res.json({
                    success: true,
                    data: report
                });
            }
        } catch (error) {
            console.error('Error generating compliance report:', error);
            res.status(500).json({ 
                error: 'Failed to generate compliance report',
                message: error.message
            });
        }
    }
);

// Export audit logs for auditors
router.post('/export',
    authenticateToken,
    requireRole(['admin', 'compliance_officer']),
    [
        body('start_date').isISO8601(),
        body('end_date').isISO8601(),
        body('format').isIn(['JSON', 'CSV', 'PDF']),
        body('filters').optional().isObject(),
        body('include_sensitive').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const { start_date, end_date, format, filters = {}, include_sensitive = false } = req.body;

            // Add date range to filters
            filters.start_date = start_date;
            filters.end_date = end_date;

            // Remove sensitive data if not authorized
            if (!include_sensitive && req.user.role !== 'admin') {
                filters.min_risk_score = 0;
                filters.max_risk_score = 69; // Exclude high-risk operations
            }

            const logs = await auditService.getAuditLogs(filters);

            // Log this export operation
            const exportData = {
                exported_by: req.user.id,
                export_time: new Date().toISOString(),
                record_count: logs.length,
                date_range: { start: start_date, end: end_date },
                format: format,
                filters: filters
            };

            if (format === 'CSV') {
                const csv = convertLogsToCSV(logs);
                res.setHeader('Content-Type', 'text/csv');
                res.setHeader('Content-Disposition', `attachment; filename="audit_export_${start_date}_to_${end_date}.csv"`);
                res.send(csv);
            } else if (format === 'PDF') {
                // For PDF, we'd need a PDF generation library
                // For now, return JSON
                res.json({
                    success: true,
                    data: {
                        export_metadata: exportData,
                        logs: logs
                    }
                });
            } else {
                res.json({
                    success: true,
                    data: {
                        export_metadata: exportData,
                        logs: logs
                    }
                });
            }
        } catch (error) {
            console.error('Error exporting audit logs:', error);
            res.status(500).json({ 
                error: 'Failed to export audit logs',
                message: error.message
            });
        }
    }
);

// Update anomaly investigation status
router.put('/anomalies/:id/investigate',
    authenticateToken,
    requireAuditPermission,
    [
        body('investigated').isBoolean(),
        body('investigation_notes').optional().isString(),
        body('false_positive').optional().isBoolean()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const { id } = req.params;
            const { investigated, investigation_notes, false_positive } = req.body;

            const sql = `
                UPDATE detected_anomalies 
                SET investigated = ?, investigated_by = ?, investigated_at = ?, investigation_notes = ?, false_positive = ?
                WHERE id = ?
            `;

            await auditService.runAsync(sql, [
                investigated ? 1 : 0,
                req.user.id,
                new Date().toISOString(),
                investigation_notes || null,
                false_positive ? 1 : 0,
                id
            ]);

            res.json({
                success: true,
                message: 'Anomaly investigation status updated'
            });
        } catch (error) {
            console.error('Error updating anomaly investigation:', error);
            res.status(500).json({ 
                error: 'Failed to update anomaly investigation',
                message: error.message
            });
        }
    }
);

// Update compliance violation resolution
router.put('/violations/:id/resolve',
    authenticateToken,
    requireAuditPermission,
    [
        body('resolved').isBoolean(),
        body('resolution_notes').optional().isString()
    ],
    async (req, res) => {
        try {
            const errors = validationResult(req);
            if (!errors.isEmpty()) {
                return res.status(400).json({ 
                    error: 'Validation failed', 
                    details: errors.array() 
                });
            }

            const { id } = req.params;
            const { resolved, resolution_notes } = req.body;

            const sql = `
                UPDATE compliance_violations 
                SET resolved = ?, resolved_by = ?, resolved_at = ?, resolution_notes = ?
                WHERE id = ?
            `;

            await auditService.runAsync(sql, [
                resolved ? 1 : 0,
                req.user.id,
                new Date().toISOString(),
                resolution_notes || null,
                id
            ]);

            res.json({
                success: true,
                message: 'Compliance violation resolution status updated'
            });
        } catch (error) {
            console.error('Error updating compliance violation:', error);
            res.status(500).json({ 
                error: 'Failed to update compliance violation',
                message: error.message
            });
        }
    }
);

// Get audit trail integrity verification
router.get('/integrity',
    authenticateToken,
    requireRole(['admin', 'compliance_officer']),
    async (req, res) => {
        try {
            const sql = `
                SELECT 
                    COUNT(*) as total_logs,
                    COUNT(CASE WHEN hash IS NULL OR hash = '' THEN 1 END) as missing_hashes,
                    COUNT(CASE WHEN previous_hash != (
                        SELECT hash FROM audit_logs al2 WHERE al2.created_at < audit_logs.created_at 
                        ORDER BY al2.created_at DESC LIMIT 1
                    ) THEN 1 END) as hash_mismatches
                FROM audit_logs
            `;

            const integrity = await auditService.getAsync(sql);

            res.json({
                success: true,
                data: {
                    total_records: integrity.total_logs,
                    missing_hashes: integrity.missing_hashes,
                    hash_mismatches: integrity.hash_mismatches,
                    integrity_score: integrity.total_logs > 0 ? 
                        ((integrity.total_logs - integrity.missing_hashes - integrity.hash_mismatches) / integrity.total_logs * 100).toFixed(2) : 100
                }
            });
        } catch (error) {
            console.error('Error checking audit integrity:', error);
            res.status(500).json({ 
                error: 'Failed to check audit integrity',
                message: error.message
            });
        }
    }
);

// Helper functions for format conversion
function convertLogsToCSV(logs) {
    if (logs.length === 0) return 'No audit logs found';

    const headers = [
        'ID', 'Timestamp', 'User ID', 'User Role', 'Action', 'Resource Type',
        'Resource ID', 'Resource Name', 'Endpoint', 'Method', 'IP Address',
        'Status Code', 'Success', 'Risk Score', 'Correlation ID'
    ];

    const csvRows = [headers.join(',')];

    logs.forEach(log => {
        const row = [
            log.id,
            log.timestamp,
            log.user_id,
            log.user_role,
            log.action,
            log.resource_type,
            log.resource_id || '',
            log.resource_name || '',
            log.endpoint,
            log.method,
            log.ip_address,
            log.status_code,
            log.success,
            log.risk_score,
            log.correlation_id
        ];

        csvRows.push(row.map(field => `"${field}"`).join(','));
    });

    return csvRows.join('\n');
}

function convertReportToCSV(report) {
    let csv = `Report Type: ${report.report_type}\n`;
    csv += `Period: ${report.period.start} to ${report.period.end}\n`;
    csv += `Generated: ${report.generated_at}\n\n`;

    if (report.summary) {
        csv += 'Summary,\n';
        Object.entries(report.summary).forEach(([key, value]) => {
            csv += `${key},${value}\n`;
        });
        csv += '\n';
    }

    if (report.violations && report.violations.length > 0) {
        csv += 'Violations,\n';
        csv += 'ID,Severity,Description,RULE,Regulation,Created\n';
        report.violations.forEach(violation => {
            csv += `${violation.id},${violation.severity},"${violation.description}",${violation.rule_name},${violation.regulation},${violation.created_at}\n`;
        });
    }

    if (report.recommendations) {
        csv += '\nRecommendations,\n';
        report.recommendations.forEach((rec, index) => {
            csv += `${index + 1},"${rec}"\n`;
        });
    }

    return csv;
}

module.exports = router;
