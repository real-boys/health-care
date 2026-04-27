const fs = require('fs').promises;
const path = require('path');
const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const { dbConnection } = require('../database/connection');

class AuditReportingService {
    constructor() {
        this.db = null;
        this.reportsPath = path.join(__dirname, '../reports');
        this.initializeDatabase();
        this.ensureReportsDirectory();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize audit reporting service:', error);
        }
    }

    async ensureReportsDirectory() {
        try {
            await fs.mkdir(this.reportsPath, { recursive: true });
        } catch (error) {
            console.error('Failed to create reports directory:', error);
        }
    }

    // Query helpers
    queryAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    }

    getAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    }

    /**
     * Generate comprehensive audit report
     */
    async generateAuditReport(reportConfig) {
        const {
            reportType,
            startDate,
            endDate,
            filters = {},
            format = 'json',
            includeDetails = false,
            includeCharts = false,
            customFields = []
        } = reportConfig;

        let reportData;

        switch (reportType) {
            case 'summary':
                reportData = await this.generateSummaryReport(startDate, endDate, filters);
                break;
            case 'security':
                reportData = await this.generateSecurityReport(startDate, endDate, filters);
                break;
            case 'compliance':
                reportData = await this.generateComplianceReport(startDate, endDate, filters);
                break;
            case 'user_activity':
                reportData = await this.generateUserActivityReport(startDate, endDate, filters);
                break;
            case 'data_access':
                reportData = await this.generateDataAccessReport(startDate, endDate, filters);
                break;
            case 'system_performance':
                reportData = await this.generateSystemPerformanceReport(startDate, endDate, filters);
                break;
            case 'integrity':
                reportData = await this.generateIntegrityReport(startDate, endDate, filters);
                break;
            case 'custom':
                reportData = await this.generateCustomReport(startDate, endDate, filters, customFields);
                break;
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }

        const report = {
            id: require('uuid').v4(),
            reportType,
            dateRange: { start: startDate, end: endDate },
            generatedAt: new Date(),
            generatedBy: filters.userId || 'system',
            format,
            data: reportData,
            metadata: {
                filters,
                includeDetails,
                includeCharts,
                customFields
            }
        };

        // Export to requested format
        const exportedReport = await this.exportReport(report, format);

        // Save report metadata
        await this.saveReportMetadata(report, exportedReport);

        return exportedReport;
    }

    /**
     * Generate summary report
     */
    async generateSummaryReport(startDate, endDate, filters) {
        const [overview, topUsers, topResources, recentActivity] = await Promise.all([
            this.getOverviewStats(startDate, endDate, filters),
            this.getTopUsers(startDate, endDate, 10, filters),
            this.getTopResources(startDate, endDate, 10, filters),
            this.getRecentActivity(startDate, endDate, 20, filters)
        ]);

        return {
            overview,
            topUsers,
            topResources,
            recentActivity,
            recommendations: this.generateSummaryRecommendations(overview)
        };
    }

    /**
     * Generate security report
     */
    async generateSecurityReport(startDate, endDate, filters) {
        const [securityEvents, failedLogins, highRiskActivity, suspiciousIPs] = await Promise.all([
            this.getSecurityEvents(startDate, endDate, filters),
            this.getFailedLogins(startDate, endDate, filters),
            this.getHighRiskActivity(startDate, endDate, filters),
            this.getSuspiciousIPs(startDate, endDate, filters)
        ]);

        return {
            securityEvents,
            failedLogins,
            highRiskActivity,
            suspiciousIPs,
            securityMetrics: this.calculateSecurityMetrics(securityEvents, failedLogins, highRiskActivity),
            recommendations: this.generateSecurityRecommendations(securityEvents, failedLogins, highRiskActivity)
        };
    }

    /**
     * Generate compliance report
     */
    async generateComplianceReport(startDate, endDate, filters) {
        const [complianceData, violations, metrics] = await Promise.all([
            this.getComplianceData(startDate, endDate, filters),
            this.getComplianceViolations(startDate, endDate, filters),
            this.getComplianceMetrics(startDate, endDate, filters)
        ]);

        return {
            complianceData,
            violations,
            metrics,
            overallComplianceRate: this.calculateComplianceRate(metrics),
            recommendations: this.generateComplianceRecommendations(violations, metrics)
        };
    }

    /**
     * Generate user activity report
     */
    async generateUserActivityReport(startDate, endDate, filters) {
        const { userId } = filters;
        
        if (userId) {
            const [userActivity, userTimeline, userStats] = await Promise.all([
                this.getUserActivity(userId, startDate, endDate),
                this.getUserTimeline(userId, startDate, endDate),
                this.getUserStatistics(userId, startDate, endDate)
            ]);
            
            return {
                userId,
                activity: userActivity,
                timeline: userTimeline,
                statistics: userStats,
                recommendations: this.generateUserRecommendations(userStats)
            };
        } else {
            const [topUsers, userMetrics, activityPatterns] = await Promise.all([
                this.getTopUsers(startDate, endDate, 50, filters),
                this.getUserMetrics(startDate, endDate, filters),
                this.getActivityPatterns(startDate, endDate, filters)
            ]);
            
            return {
                topUsers,
                userMetrics,
                activityPatterns,
                recommendations: this.generateActivityRecommendations(userMetrics, activityPatterns)
            };
        }
    }

    /**
     * Generate data access report
     */
    async generateDataAccessReport(startDate, endDate, filters) {
        const [dataAccess, accessPatterns, sensitiveDataAccess] = await Promise.all([
            this.getDataAccessLogs(startDate, endDate, filters),
            this.getAccessPatterns(startDate, endDate, filters),
            this.getSensitiveDataAccess(startDate, endDate, filters)
        ]);

        return {
            dataAccess,
            accessPatterns,
            sensitiveDataAccess,
            metrics: this.calculateDataAccessMetrics(dataAccess),
            recommendations: this.generateDataAccessRecommendations(dataAccess, sensitiveDataAccess)
        };
    }

    /**
     * Generate system performance report
     */
    async generateSystemPerformanceReport(startDate, endDate, filters) {
        const [performanceMetrics, responseTimes, errorRates, systemLoad] = await Promise.all([
            this.getPerformanceMetrics(startDate, endDate, filters),
            this.getResponseTimes(startDate, endDate, filters),
            this.getErrorRates(startDate, endDate, filters),
            this.getSystemLoad(startDate, endDate, filters)
        ]);

        return {
            performanceMetrics,
            responseTimes,
            errorRates,
            systemLoad,
            recommendations: this.generatePerformanceRecommendations(performanceMetrics, errorRates)
        };
    }

    /**
     * Generate integrity report
     */
    async generateIntegrityReport(startDate, endDate, filters) {
        const auditIntegrityService = require('./auditIntegrityService');
        
        const [chainVerification, tamperingDetection, verificationHistory] = await Promise.all([
            auditIntegrityService.verifyAuditChain(startDate, endDate),
            auditIntegrityService.detectTampering('7d'),
            auditIntegrityService.getVerificationHistory(20)
        ]);

        return {
            chainVerification,
            tamperingDetection,
            verificationHistory,
            integrityScore: this.calculateIntegrityScore(chainVerification, tamperingDetection),
            recommendations: auditIntegrityService.generateIntegrityRecommendations(chainVerification, tamperingDetection)
        };
    }

    /**
     * Export report to different formats
     */
    async exportReport(report, format) {
        switch (format.toLowerCase()) {
            case 'json':
                return await this.exportToJSON(report);
            case 'csv':
                return await this.exportToCSV(report);
            case 'pdf':
                return await this.exportToPDF(report);
            case 'excel':
                return await this.exportToExcel(report);
            case 'xml':
                return await this.exportToXML(report);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }

    /**
     * Export to JSON
     */
    async exportToJSON(report) {
        const filename = `${report.reportType}_${report.id}.json`;
        const filepath = path.join(this.reportsPath, filename);
        
        await fs.writeFile(filepath, JSON.stringify(report, null, 2));
        
        return {
            format: 'json',
            filename,
            filepath,
            size: (await fs.stat(filepath)).size,
            downloadUrl: `/api/audit/reports/download/${filename}`
        };
    }

    /**
     * Export to CSV
     */
    async exportToCSV(report) {
        const filename = `${report.reportType}_${report.id}.csv`;
        const filepath = path.join(this.reportsPath, filename);
        
        let csvContent = '';
        
        // Flatten report data for CSV
        const flattenData = (data, prefix = '') => {
            let result = {};
            for (const [key, value] of Object.entries(data)) {
                const newKey = prefix ? `${prefix}.${key}` : key;
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    result = { ...result, ...flattenData(value, newKey) };
                } else if (Array.isArray(value)) {
                    result[newKey] = JSON.stringify(value);
                } else {
                    result[newKey] = value;
                }
            }
            return result;
        };
        
        const flattened = flattenData(report);
        
        // CSV header
        csvContent += Object.keys(flattened).join(',') + '\n';
        
        // CSV data
        csvContent += Object.values(flattened).map(value => {
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
                return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
        }).join(',') + '\n';
        
        await fs.writeFile(filepath, csvContent);
        
        return {
            format: 'csv',
            filename,
            filepath,
            size: (await fs.stat(filepath)).size,
            downloadUrl: `/api/audit/reports/download/${filename}`
        };
    }

    /**
     * Export to PDF
     */
    async exportToPDF(report) {
        return new Promise((resolve, reject) => {
            const filename = `${report.reportType}_${report.id}.pdf`;
            const filepath = path.join(this.reportsPath, filename);
            
            const doc = new PDFDocument();
            const stream = require('fs').createWriteStream(filepath);
            
            doc.pipe(stream);
            
            // Add content to PDF
            doc.fontSize(20).text(`${report.reportType.toUpperCase()} REPORT`, { align: 'center' });
            doc.moveDown();
            
            doc.fontSize(12).text(`Report ID: ${report.id}`);
            doc.text(`Generated: ${report.generatedAt.toISOString()}`);
            doc.text(`Period: ${report.dateRange.start} to ${report.dateRange.end}`);
            doc.moveDown();
            
            // Add report data
            this.addReportDataToPDF(doc, report.data);
            
            doc.end();
            
            stream.on('finish', async () => {
                resolve({
                    format: 'pdf',
                    filename,
                    filepath,
                    size: (await fs.stat(filepath)).size,
                    downloadUrl: `/api/audit/reports/download/${filename}`
                });
            });
            
            stream.on('error', reject);
        });
    }

    /**
     * Add report data to PDF document
     */
    addReportDataToPDF(doc, data, level = 0) {
        const indent = '  '.repeat(level);
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                doc.fontSize(10).text(`${indent}${key}:`);
                this.addReportDataToPDF(doc, value, level + 1);
            } else if (Array.isArray(value)) {
                doc.fontSize(10).text(`${indent}${key}: [${value.length} items]`);
                value.forEach((item, index) => {
                    if (typeof item === 'object') {
                        doc.fontSize(10).text(`${indent}  Item ${index + 1}:`);
                        this.addReportDataToPDF(doc, item, level + 2);
                    } else {
                        doc.fontSize(10).text(`${indent}  ${item}`);
                    }
                });
            } else {
                doc.fontSize(10).text(`${indent}${key}: ${value}`);
            }
        }
    }

    /**
     * Export to Excel
     */
    async exportToExcel(report) {
        const filename = `${report.reportType}_${report.id}.xlsx`;
        const filepath = path.join(this.reportsPath, filename);
        
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Audit Report');
        
        // Add headers
        worksheet.addRow(['Report Type', report.reportType]);
        worksheet.addRow(['Report ID', report.id]);
        worksheet.addRow(['Generated At', report.generatedAt.toISOString()]);
        worksheet.addRow(['Start Date', report.dateRange.start]);
        worksheet.addRow(['End Date', report.dateRange.end]);
        worksheet.addRow([]);
        
        // Add data
        this.addReportDataToWorksheet(worksheet, report.data);
        
        await workbook.xlsx.writeFile(filepath);
        
        return {
            format: 'excel',
            filename,
            filepath,
            size: (await fs.stat(filepath)).size,
            downloadUrl: `/api/audit/reports/download/${filename}`
        };
    }

    /**
     * Add report data to Excel worksheet
     */
    addReportDataToWorksheet(worksheet, data, prefix = '') {
        for (const [key, value] of Object.entries(data)) {
            const fullKey = prefix ? `${prefix}.${key}` : key;
            
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                this.addReportDataToWorksheet(worksheet, value, fullKey);
            } else if (Array.isArray(value)) {
                worksheet.addRow([fullKey, JSON.stringify(value)]);
            } else {
                worksheet.addRow([fullKey, value]);
            }
        }
    }

    /**
     * Export to XML
     */
    async exportToXML(report) {
        const filename = `${report.reportType}_${report.id}.xml`;
        const filepath = path.join(this.reportsPath, filename);
        
        const xmlContent = this.convertToXML(report);
        await fs.writeFile(filepath, xmlContent);
        
        return {
            format: 'xml',
            filename,
            filepath,
            size: (await fs.stat(filepath)).size,
            downloadUrl: `/api/audit/reports/download/${filename}`
        };
    }

    /**
     * Convert data to XML
     */
    convertToXML(data, rootName = 'report') {
        let xml = `<?xml version="1.0" encoding="UTF-8"?>\n<${rootName}>\n`;
        
        const addObjectToXML = (obj, indent = 1) => {
            const spaces = '  '.repeat(indent);
            
            for (const [key, value] of Object.entries(obj)) {
                const cleanKey = key.replace(/[^a-zA-Z0-9_]/g, '_');
                
                if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                    xml += `${spaces}<${cleanKey}>\n`;
                    addObjectToXML(value, indent + 1);
                    xml += `${spaces}</${cleanKey}>\n`;
                } else if (Array.isArray(value)) {
                    xml += `${spaces}<${cleanKey}>\n`;
                    value.forEach(item => {
                        if (typeof item === 'object') {
                            xml += `${spaces}  <item>\n`;
                            addObjectToXML(item, indent + 2);
                            xml += `${spaces}  </item>\n`;
                        } else {
                            xml += `${spaces}  <item>${this.escapeXML(String(item))}</item>\n`;
                        }
                    });
                    xml += `${spaces}</${cleanKey}>\n`;
                } else {
                    xml += `${spaces}<${cleanKey}>${this.escapeXML(String(value))}</${cleanKey}>\n`;
                }
            }
        };
        
        addObjectToXML(data);
        xml += `</${rootName}>\n`;
        
        return xml;
    }

    /**
     * Escape XML special characters
     */
    escapeXML(str) {
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Save report metadata to database
     */
    async saveReportMetadata(report, exportedReport) {
        const sql = `
            INSERT INTO audit_reports (
                id, report_type, start_date, end_date, generated_by, format,
                filename, filepath, file_size, metadata, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            report.id,
            report.reportType,
            report.dateRange.start,
            report.dateRange.end,
            report.generatedBy,
            exportedReport.format,
            exportedReport.filename,
            exportedReport.filepath,
            exportedReport.size,
            JSON.stringify(report.metadata),
            new Date().toISOString()
        ]);
    }

    /**
     * Helper method for running SQL
     */
    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Get overview statistics
     */
    async getOverviewStats(startDate, endDate, filters) {
        let sql = `
            SELECT 
                COUNT(*) as total_operations,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT resource_type) as unique_resource_types,
                COUNT(DISTINCT action) as unique_actions,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(CASE WHEN success = 1 THEN 1 END) as successful_operations,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations
            FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
        `;
        const params = [startDate, endDate];

        if (filters.userId) {
            sql += ' AND user_id = ?';
            params.push(filters.userId);
        }

        return await this.getAsync(sql, params);
    }

    /**
     * Get top users by activity
     */
    async getTopUsers(startDate, endDate, limit = 10, filters) {
        let sql = `
            SELECT 
                al.user_id,
                u.username,
                u.email,
                COUNT(*) as activity_count,
                COUNT(DISTINCT al.action) as unique_actions,
                AVG(al.risk_score) as avg_risk_score
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.timestamp >= ? AND al.timestamp <= ?
        `;
        const params = [startDate, endDate];

        if (filters.action) {
            sql += ' AND al.action = ?';
            params.push(filters.action);
        }

        sql += `
            GROUP BY al.user_id, u.username, u.email
            ORDER BY activity_count DESC
            LIMIT ?
        `;
        params.push(limit);

        return await this.queryAsync(sql, params);
    }

    /**
     * Get top resources by access
     */
    async getTopResources(startDate, endDate, limit = 10, filters) {
        let sql = `
            SELECT 
                resource_type,
                resource_id,
                resource_name,
                COUNT(*) as access_count,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(risk_score) as avg_risk_score
            FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
            AND resource_id IS NOT NULL
        `;
        const params = [startDate, endDate];

        if (filters.action) {
            sql += ' AND action = ?';
            params.push(filters.action);
        }

        sql += `
            GROUP BY resource_type, resource_id, resource_name
            ORDER BY access_count DESC
            LIMIT ?
        `;
        params.push(limit);

        return await this.queryAsync(sql, params);
    }

    /**
     * Get recent activity
     */
    async getRecentActivity(startDate, endDate, limit = 20, filters) {
        let sql = `
            SELECT 
                al.*,
                u.username,
                u.email
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            WHERE al.timestamp >= ? AND al.timestamp <= ?
        `;
        const params = [startDate, endDate];

        if (filters.userId) {
            sql += ' AND al.user_id = ?';
            params.push(filters.userId);
        }

        sql += `
            ORDER BY al.timestamp DESC
            LIMIT ?
        `;
        params.push(limit);

        return await this.queryAsync(sql, params);
    }

    /**
     * Generate summary recommendations
     */
    generateSummaryRecommendations(overview) {
        const recommendations = [];
        
        if (overview.failed_operations > overview.total_operations * 0.1) {
            recommendations.push({
                priority: 'HIGH',
                title: 'High Failure Rate',
                description: `Failure rate is ${((overview.failed_operations / overview.total_operations) * 100).toFixed(2)}%`,
                action: 'Investigate common failure patterns and improve error handling'
            });
        }

        if (overview.avg_risk_score > 50) {
            recommendations.push({
                priority: 'MEDIUM',
                title: 'Elevated Risk Score',
                description: `Average risk score is ${overview.avg_risk_score.toFixed(2)}`,
                action: 'Review high-risk operations and implement additional controls'
            });
        }

        return recommendations;
    }

    // Additional helper methods for other report types would be implemented here
    // For brevity, I'm including the main structure and key methods
}

module.exports = new AuditReportingService();
