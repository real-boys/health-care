const { v4: uuidv4 } = require('uuid');
const { dbConnection } = require('../database/connection');

class AuditService {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize audit service:', error);
        }
    }

    // Query helper for promises
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

    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    // Get audit logs with advanced filtering
    async getAuditLogs(filters = {}) {
        if (!this.db) throw new Error('Database not initialized');

        let sql = `
            SELECT 
                al.*,
                GROUP_CONCAT(ac.name) as categories
            FROM audit_logs al
            LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
            LEFT JOIN audit_categories ac ON alc.category_id = ac.id
            WHERE 1=1
        `;
        const params = [];

        // Apply filters
        if (filters.user_id) {
            sql += ' AND al.user_id = ?';
            params.push(filters.user_id);
        }

        if (filters.action) {
            sql += ' AND al.action = ?';
            params.push(filters.action);
        }

        if (filters.resource_type) {
            sql += ' AND al.resource_type = ?';
            params.push(filters.resource_type);
        }

        if (filters.resource_id) {
            sql += ' AND al.resource_id = ?';
            params.push(filters.resource_id);
        }

        if (filters.start_date) {
            sql += ' AND al.timestamp >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            sql += ' AND al.timestamp <= ?';
            params.push(filters.end_date);
        }

        if (filters.min_risk_score) {
            sql += ' AND al.risk_score >= ?';
            params.push(filters.min_risk_score);
        }

        if (filters.max_risk_score) {
            sql += ' AND al.risk_score <= ?';
            params.push(filters.max_risk_score);
        }

        if (filters.success !== undefined) {
            sql += ' AND al.success = ?';
            params.push(filters.success ? 1 : 0);
        }

        if (filters.ip_address) {
            sql += ' AND al.ip_address = ?';
            params.push(filters.ip_address);
        }

        if (filters.correlation_id) {
            sql += ' AND al.correlation_id = ?';
            params.push(filters.correlation_id);
        }

        // Group by and order
        sql += ' GROUP BY al.id ORDER BY al.timestamp DESC';

        // Pagination
        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
            
            if (filters.offset) {
                sql += ' OFFSET ?';
                params.push(filters.offset);
            }
        }

        const rows = await this.queryAsync(sql, params);
        
        // Parse JSON fields and categories
        return rows.map(row => ({
            ...row,
            compliance_flags: row.compliance_flags ? JSON.parse(row.compliance_flags) : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            categories: row.categories ? row.categories.split(',') : []
        }));
    }

    // Get audit metrics for dashboard
    async getAuditMetrics(timeframe = '24h') {
        if (!this.db) throw new Error('Database not initialized');

        const timeConditions = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-1 day')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')",
            '90d': "datetime('now', '-90 days')"
        };

        const timeCondition = timeConditions[timeframe] || timeConditions['24h'];

        const sql = `
            SELECT 
                COUNT(*) as total_operations,
                COUNT(CASE WHEN success = 1 THEN 1 END) as successful_operations,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT resource_id) as unique_resources,
                AVG(CASE WHEN success = 1 THEN 
                    JSON_EXTRACT(metadata, '$.duration') 
                END) as avg_response_time,
                COUNT(CASE WHEN risk_score >= 70 THEN 1 END) as high_risk_operations,
                COUNT(CASE WHEN risk_score >= 90 THEN 1 END) as critical_operations,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
        `;

        return await this.getAsync(sql);
    }

    // Get operations breakdown by type
    async getOperationsBreakdown(timeframe = '24h') {
        if (!this.db) throw new Error('Database not initialized');

        const timeConditions = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-1 day')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')"
        };

        const timeCondition = timeConditions[timeframe] || timeConditions['24h'];

        const sql = `
            SELECT 
                action,
                resource_type,
                COUNT(*) as count,
                AVG(risk_score) as avg_risk_score,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failures
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY action, resource_type
            ORDER BY count DESC
        `;

        return await this.queryAsync(sql);
    }

    // Get user activity summary
    async getUserActivitySummary(timeframe = '24h', limit = 10) {
        if (!this.db) throw new Error('Database not initialized');

        const timeConditions = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-1 day')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')"
        };

        const timeCondition = timeConditions[timeframe] || timeConditions['24h'];

        const sql = `
            SELECT 
                user_id,
                user_role,
                COUNT(*) as total_operations,
                COUNT(DISTINCT resource_type) as resource_types_accessed,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations,
                COUNT(CASE WHEN risk_score >= 70 THEN 1 END) as high_risk_operations,
                GROUP_CONCAT(DISTINCT ip_address) as ip_addresses
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id, user_role
            ORDER BY total_operations DESC
            LIMIT ?
        `;

        const rows = await this.queryAsync(sql, [limit]);
        
        return rows.map(row => ({
            ...row,
            ip_addresses: row.ip_addresses ? row.ip_addresses.split(',') : []
        }));
    }

    // Detect anomalies based on patterns
    async detectAnomalies() {
        if (!this.db) throw new Error('Database not initialized');

        const anomalies = [];

        // Get active anomaly patterns
        const patterns = await this.queryAsync(`
            SELECT * FROM anomaly_patterns WHERE is_active = 1
        `);

        for (const pattern of patterns) {
            const detectedAnomalies = await this.checkPattern(pattern);
            anomalies.push(...detectedAnomalies);
        }

        return anomalies;
    }

    async checkPattern(pattern) {
        const conditions = JSON.parse(pattern.conditions);
        const anomalies = [];

        try {
            switch (pattern.pattern_type) {
                case 'FREQUENCY':
                    anomalies.push(...await this.checkFrequencyPattern(pattern, conditions));
                    break;
                case 'TIME':
                    anomalies.push(...await this.checkTimePattern(pattern, conditions));
                    break;
                case 'DATA_VOLUME':
                    anomalies.push(...await this.checkDataVolumePattern(pattern, conditions));
                    break;
                case 'ACCESS_PATTERN':
                    anomalies.push(...await this.checkAccessPattern(pattern, conditions));
                    break;
            }
        } catch (error) {
            console.error(`Error checking pattern ${pattern.name}:`, error);
        }

        return anomalies;
    }

    async checkFrequencyPattern(pattern, conditions) {
        const { resource_type, timeframe, max_normal, success } = conditions;
        
        let sql = `
            SELECT user_id, COUNT(*) as count, GROUP_CONCAT(id) as audit_log_ids
            FROM audit_logs 
            WHERE resource_type = ? 
            AND timestamp >= datetime('now', '-${timeframe}')
        `;
        
        const params = [resource_type];

        if (success !== undefined) {
            sql += ' AND success = ?';
            params.push(success ? 1 : 0);
        }

        sql += ' GROUP BY user_id HAVING count > ?';
        params.push(max_normal);

        const results = await this.queryAsync(sql, params);
        const anomalies = [];

        for (const result of results) {
            const anomaly = {
                id: uuidv4(),
                pattern_id: pattern.id,
                audit_log_ids: result.audit_log_ids,
                severity: result.count > pattern.threshold_value * 2 ? 'HIGH' : 'MEDIUM',
                description: `User ${result.user_id} performed ${result.count} ${resource_type} operations in ${timeframe} (threshold: ${max_normal})`,
                confidence_score: Math.min(result.count / pattern.threshold_value, 1.0),
                created_at: new Date().toISOString()
            };

            await this.createAnomaly(anomaly);
            anomalies.push(anomaly);
        }

        return anomalies;
    }

    async checkTimePattern(pattern, conditions) {
        const { time_range } = conditions;
        const { start, end } = time_range;

        const sql = `
            SELECT COUNT(*) as count, GROUP_CONCAT(id) as audit_log_ids
            FROM audit_logs 
            WHERE time(timestamp) >= time(?)
            AND time(timestamp) <= time(?)
            AND timestamp >= datetime('now', '-1 day')
        `;

        const result = await this.getAsync(sql, [start, end]);
        
        if (result.count > pattern.threshold_value) {
            const anomaly = {
                id: uuidv4(),
                pattern_id: pattern.id,
                audit_log_ids: result.audit_log_ids,
                severity: result.count > pattern.threshold_value * 2 ? 'HIGH' : 'MEDIUM',
                description: `${result.count} operations detected during unusual hours (${start}-${end})`,
                confidence_score: Math.min(result.count / pattern.threshold_value, 1.0),
                created_at: new Date().toISOString()
            };

            await this.createAnomaly(anomaly);
            return [anomaly];
        }

        return [];
    }

    async checkDataVolumePattern(pattern, conditions) {
        const { action, timeframe } = conditions;

        const sql = `
            SELECT user_id, COUNT(*) as count, GROUP_CONCAT(id) as audit_log_ids
            FROM audit_logs 
            WHERE action = ?
            AND timestamp >= datetime('now', '-${timeframe}')
            GROUP BY user_id
            HAVING count > ?
        `;

        const results = await this.queryAsync(sql, [action, pattern.threshold_value]);
        const anomalies = [];

        for (const result of results) {
            const anomaly = {
                id: uuidv4(),
                pattern_id: pattern.id,
                audit_log_ids: result.audit_log_ids,
                severity: result.count > pattern.threshold_value * 2 ? 'HIGH' : 'MEDIUM',
                description: `User ${result.user_id} exported ${result.count} items in ${timeframe}`,
                confidence_score: Math.min(result.count / pattern.threshold_value, 1.0),
                created_at: new Date().toISOString()
            };

            await this.createAnomaly(anomaly);
            anomalies.push(anomaly);
        }

        return anomalies;
    }

    async checkAccessPattern(pattern, conditions) {
        const { role_change, timeframe } = conditions;

        if (role_change) {
            const sql = `
                SELECT user_id, COUNT(*) as count, GROUP_CONCAT(id) as audit_log_ids
                FROM audit_logs 
                WHERE resource_type = 'USER'
                AND action IN ('CREATE', 'UPDATE')
                AND timestamp >= datetime('now', '-${timeframe}')
                GROUP BY user_id
                HAVING count > ?
            `;

            const results = await this.queryAsync(sql, [pattern.threshold_value]);
            const anomalies = [];

            for (const result of results) {
                const anomaly = {
                    id: uuidv4(),
                    pattern_id: pattern.id,
                    audit_log_ids: result.audit_log_ids,
                    severity: 'HIGH',
                    description: `User ${result.user_id} performed ${result.count} role changes in ${timeframe}`,
                    confidence_score: Math.min(result.count / pattern.threshold_value, 1.0),
                    created_at: new Date().toISOString()
                };

                await this.createAnomaly(anomaly);
                anomalies.push(anomaly);
            }

            return anomalies;
        }

        return [];
    }

    async createAnomaly(anomaly) {
        const sql = `
            INSERT INTO detected_anomalies (
                id, pattern_id, audit_log_ids, severity, description,
                confidence_score, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            anomaly.id,
            anomaly.pattern_id,
            anomaly.audit_log_ids,
            anomaly.severity,
            anomaly.description,
            anomaly.confidence_score,
            anomaly.created_at
        ]);
    }

    // Get compliance violations
    async getComplianceViolations(filters = {}) {
        if (!this.db) throw new Error('Database not initialized');

        let sql = `
            SELECT cv.*, al.user_id, al.action, al.resource_type, al.timestamp
            FROM compliance_violations cv
            JOIN audit_logs al ON cv.audit_log_id = al.id
            LEFT JOIN compliance_rules cr ON cv.rule_id = cr.id
            WHERE 1=1
        `;
        const params = [];

        if (filters.severity) {
            sql += ' AND cv.severity = ?';
            params.push(filters.severity);
        }

        if (filters.resolved !== undefined) {
            sql += ' AND cv.resolved = ?';
            params.push(filters.resolved ? 1 : 0);
        }

        if (filters.start_date) {
            sql += ' AND cv.created_at >= ?';
            params.push(filters.start_date);
        }

        if (filters.end_date) {
            sql += ' AND cv.created_at <= ?';
            params.push(filters.end_date);
        }

        sql += ' ORDER BY cv.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await this.queryAsync(sql, params);
    }

    // Check compliance rules
    async checkComplianceRules(auditLog) {
        if (!this.db) throw new Error('Database not initialized');

        const rules = await this.queryAsync(`
            SELECT * FROM compliance_rules WHERE is_active = 1
        `);

        const violations = [];

        for (const rule of rules) {
            try {
                const isViolation = await this.evaluateComplianceRule(rule, auditLog);
                if (isViolation) {
                    const violation = {
                        id: uuidv4(),
                        audit_log_id: auditLog.id,
                        rule_id: rule.id,
                        severity: this.calculateViolationSeverity(rule, auditLog),
                        description: `Violation of ${rule.name}: ${rule.description}`,
                        created_at: new Date().toISOString()
                    };

                    await this.createComplianceViolation(violation);
                    violations.push(violation);
                }
            } catch (error) {
                console.error(`Error evaluating compliance rule ${rule.name}:`, error);
            }
        }

        return violations;
    }

    async evaluateComplianceRule(rule, auditLog) {
        const conditions = JSON.parse(rule.conditions);

        switch (rule.rule_type) {
            case 'AUDIT':
                return this.evaluateAuditRule(conditions, auditLog);
            case 'ACCESS':
                return this.evaluateAccessRule(conditions, auditLog);
            case 'RETENTION':
                return false; // Handled by separate process
            default:
                return false;
        }
    }

    evaluateAuditRule(conditions, auditLog) {
        if (conditions.resource_type && auditLog.resource_type !== conditions.resource_type) {
            return false;
        }

        if (conditions.action && !conditions.action.includes(auditLog.action)) {
            return false;
        }

        return true;
    }

    evaluateAccessRule(conditions, auditLog) {
        if (conditions.action && auditLog.action !== conditions.action) {
            return false;
        }

        if (conditions.time) {
            const hour = new Date(auditLog.timestamp).getHours();
            if (hour < parseInt(conditions.time.start.split(':')[0]) || 
                hour > parseInt(conditions.time.end.split(':')[0])) {
                return true;
            }
        }

        if (conditions.volume) {
            // This would require checking against recent activity
            // For now, return false as it's handled by anomaly detection
            return false;
        }

        return false;
    }

    calculateViolationSeverity(rule, auditLog) {
        let severity = 'LOW';

        if (auditLog.risk_score >= 70) {
            severity = 'HIGH';
        } else if (auditLog.risk_score >= 40) {
            severity = 'MEDIUM';
        }

        // Upgrade severity for critical regulations
        if (['HIPAA', 'GDPR'].includes(rule.regulation) && severity === 'LOW') {
            severity = 'MEDIUM';
        }

        return severity;
    }

    async createComplianceViolation(violation) {
        const sql = `
            INSERT INTO compliance_violations (
                id, audit_log_id, rule_id, severity, description, created_at
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            violation.id,
            violation.audit_log_id,
            violation.rule_id,
            violation.severity,
            violation.description,
            violation.created_at
        ]);
    }

    // Generate compliance reports
    async generateComplianceReport(reportType, startDate, endDate) {
        switch (reportType) {
            case 'HIPAA':
                return await this.generateHIPAAReport(startDate, endDate);
            case 'GDPR':
                return await this.generateGDPRReport(startDate, endDate);
            case 'SECURITY':
                return await this.generateSecurityReport(startDate, endDate);
            case 'USER_ACTIVITY':
                return await this.generateUserActivityReport(startDate, endDate);
            default:
                throw new Error(`Unknown report type: ${reportType}`);
        }
    }

    async generateHIPAAReport(startDate, endDate) {
        const sql = `
            SELECT 
                COUNT(*) as total_access_events,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT resource_id) as unique_patients,
                COUNT(CASE WHEN action = 'EXPORT' THEN 1 END) as export_events,
                COUNT(CASE WHEN risk_score >= 70 THEN 1 END) as high_risk_events,
                COUNT(CASE WHEN compliance_flags LIKE '%HIPAA_PROTECTED_HEALTH_INFO%' THEN 1 END) as phi_events
            FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
            AND (resource_type = 'PATIENT' OR resource_type = 'MEDICAL_RECORD')
        `;

        const summary = await this.getAsync(sql, [startDate, endDate]);

        const violations = await this.queryAsync(`
            SELECT cv.*, cr.name as rule_name, cr.regulation
            FROM compliance_violations cv
            JOIN compliance_rules cr ON cv.rule_id = cr.id
            WHERE cv.created_at >= ? AND cv.created_at <= ?
            AND cr.regulation = 'HIPAA'
        `, [startDate, endDate]);

        return {
            report_type: 'HIPAA',
            period: { start: startDate, end: endDate },
            generated_at: new Date().toISOString(),
            summary: summary,
            violations: violations,
            recommendations: this.generateHIPAARecommendations(summary, violations)
        };
    }

    async generateGDPRReport(startDate, endDate) {
        const sql = `
            SELECT 
                COUNT(*) as total_data_operations,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(CASE WHEN action = 'DELETE' THEN 1 END) as deletion_requests,
                COUNT(CASE WHEN action = 'EXPORT' THEN 1 END) as data_exports,
                COUNT(CASE WHEN compliance_flags LIKE '%GDPR_PERSONAL_DATA%' THEN 1 END) as personal_data_events
            FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
            AND compliance_flags LIKE '%GDPR_PERSONAL_DATA%'
        `;

        const summary = await this.getAsync(sql, [startDate, endDate]);

        return {
            report_type: 'GDPR',
            period: { start: startDate, end: endDate },
            generated_at: new Date().toISOString(),
            summary: summary,
            recommendations: this.generateGDPRRecommendations(summary)
        };
    }

    async generateSecurityReport(startDate, endDate) {
        const summary = await this.getAsync(`
            SELECT 
                COUNT(*) as total_events,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_attempts,
                COUNT(CASE WHEN risk_score >= 70 THEN 1 END) as high_risk_events,
                COUNT(CASE WHEN risk_score >= 90 THEN 1 END) as critical_events,
                COUNT(DISTINCT ip_address) as unique_ips,
                AVG(risk_score) as avg_risk_score
            FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
        `, [startDate, endDate]);

        const anomalies = await this.queryAsync(`
            SELECT * FROM detected_anomalies 
            WHERE created_at >= ? AND created_at <= ?
            ORDER BY confidence_score DESC
        `, [startDate, endDate]);

        return {
            report_type: 'SECURITY',
            period: { start: startDate, end: endDate },
            generated_at: new Date().toISOString(),
            summary: summary,
            anomalies: anomalies,
            recommendations: this.generateSecurityRecommendations(summary, anomalies)
        };
    }

    async generateUserActivityReport(startDate, endDate) {
        const userActivity = await this.queryAsync(`
            SELECT 
                user_id,
                user_role,
                COUNT(*) as total_operations,
                COUNT(DISTINCT resource_type) as resource_types,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations
            FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
            GROUP BY user_id, user_role
            ORDER BY total_operations DESC
        `, [startDate, endDate]);

        return {
            report_type: 'USER_ACTIVITY',
            period: { start: startDate, end: endDate },
            generated_at: new Date().toISOString(),
            user_activity: userActivity,
            summary: {
                total_users: userActivity.length,
                total_operations: userActivity.reduce((sum, user) => sum + user.total_operations, 0),
                high_risk_users: userActivity.filter(user => user.avg_risk_score >= 50).length
            }
        };
    }

    generateHIPAARecommendations(summary, violations) {
        const recommendations = [];

        if (summary.high_risk_events > 0) {
            recommendations.push('Review and investigate all high-risk PHI access events');
        }

        if (summary.export_events > 10) {
            recommendations.push('Implement additional approval workflows for data exports');
        }

        if (violations.length > 0) {
            recommendations.push('Address compliance violations and implement corrective actions');
        }

        if (recommendations.length === 0) {
            recommendations.push('Continue monitoring for compliance adherence');
        }

        return recommendations;
    }

    generateGDPRRecommendations(summary) {
        const recommendations = [];

        if (summary.deletion_requests > 0) {
            recommendations.push('Ensure proper documentation of data deletion requests');
        }

        if (summary.data_exports > 5) {
            recommendations.push('Review data export procedures and ensure proper consent');
        }

        return recommendations;
    }

    generateSecurityRecommendations(summary, anomalies) {
        const recommendations = [];

        if (summary.failed_attempts > summary.total_events * 0.1) {
            recommendations.push('High failure rate detected - review authentication mechanisms');
        }

        if (summary.critical_events > 0) {
            recommendations.push('Immediate investigation required for critical security events');
        }

        if (anomalies.length > 0) {
            recommendations.push('Review and investigate detected security anomalies');
        }

        return recommendations;
    }
}

module.exports = new AuditService();
