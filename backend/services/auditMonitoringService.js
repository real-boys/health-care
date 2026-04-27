const auditService = require('./auditService');
const nodemailer = require('nodemailer');

class AuditMonitoringService {
    constructor(io) {
        this.io = io;
        this.alertThresholds = {
            high_risk_score: 70,
            critical_risk_score: 90,
            failed_login_threshold: 5,
            unusual_access_threshold: 10,
            data_export_threshold: 100
        };
        
        this.monitoringIntervals = new Map();
        this.alertSubscribers = new Map();
        this.emailTransporter = null;
        
        this.initializeEmailTransporter();
        this.startRealTimeMonitoring();
    }

    initializeEmailTransporter() {
        try {
            this.emailTransporter = nodemailer.createTransporter({
                host: process.env.SMTP_HOST || 'localhost',
                port: process.env.SMTP_PORT || 587,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
        } catch (error) {
            console.warn('Email transporter initialization failed:', error.message);
        }
    }

    startRealTimeMonitoring() {
        // Monitor for high-risk operations in real-time
        this.monitoringIntervals.set('high_risk', setInterval(() => {
            this.checkHighRiskOperations();
        }, 5000)); // Every 5 seconds

        // Monitor for failed login attempts
        this.monitoringIntervals.set('failed_logins', setInterval(() => {
            this.checkFailedLogins();
        }, 30000)); // Every 30 seconds

        // Monitor for unusual access patterns
        this.monitoringIntervals.set('unusual_access', setInterval(() => {
            this.checkUnusualAccess();
        }, 60000)); // Every minute

        // Monitor for data export anomalies
        this.monitoringIntervals.set('data_exports', setInterval(() => {
            this.checkDataExports();
        }, 120000)); // Every 2 minutes

        // Run comprehensive anomaly detection
        this.monitoringIntervals.set('anomaly_detection', setInterval(() => {
            this.runAnomalyDetection();
        }, 300000)); // Every 5 minutes

        console.log('Real-time audit monitoring started');
    }

    async checkHighRiskOperations() {
        try {
            const sql = `
                SELECT * FROM audit_logs 
                WHERE risk_score >= ? 
                AND timestamp >= datetime('now', '-1 minute')
                AND timestamp >= datetime('now', '-10 seconds')
                ORDER BY timestamp DESC
            `;

            const highRiskOps = await auditService.queryAsync(sql, [this.alertThresholds.high_risk_score]);

            for (const operation of highRiskOps) {
                await this.processHighRiskOperation(operation);
            }
        } catch (error) {
            console.error('Error checking high-risk operations:', error);
        }
    }

    async processHighRiskOperation(operation) {
        const alert = {
            type: 'HIGH_RISK_OPERATION',
            severity: operation.risk_score >= this.alertThresholds.critical_risk_score ? 'CRITICAL' : 'HIGH',
            timestamp: operation.timestamp,
            data: {
                user_id: operation.user_id,
                user_role: operation.user_role,
                action: operation.action,
                resource_type: operation.resource_type,
                resource_id: operation.resource_id,
                risk_score: operation.risk_score,
                ip_address: operation.ip_address,
                endpoint: operation.endpoint,
                compliance_flags: operation.compliance_flags ? JSON.parse(operation.compliance_flags) : []
            }
        };

        // Emit real-time alert
        this.emitAlert(alert);

        // Send email for critical operations
        if (alert.severity === 'CRITICAL') {
            await this.sendEmailAlert(alert);
        }

        // Log the alert
        await this.logAlert(alert);
    }

    async checkFailedLogins() {
        try {
            const sql = `
                SELECT user_id, ip_address, COUNT(*) as failed_count, 
                       GROUP_CONCAT(id) as audit_log_ids,
                       MAX(timestamp) as last_attempt
                FROM audit_logs 
                WHERE action = 'LOGIN' 
                AND success = 0 
                AND timestamp >= datetime('now', '-10 minutes')
                GROUP BY user_id, ip_address
                HAVING failed_count >= ?
            `;

            const failedLogins = await auditService.queryAsync(sql, [this.alertThresholds.failed_login_threshold]);

            for (const loginAttempt of failedLogins) {
                await this.processFailedLogin(loginAttempt);
            }
        } catch (error) {
            console.error('Error checking failed logins:', error);
        }
    }

    async processFailedLogin(loginAttempt) {
        const alert = {
            type: 'MULTIPLE_FAILED_LOGINS',
            severity: loginAttempt.failed_count >= 10 ? 'CRITICAL' : 'HIGH',
            timestamp: loginAttempt.last_attempt,
            data: {
                user_id: loginAttempt.user_id,
                ip_address: loginAttempt.ip_address,
                failed_count: loginAttempt.failed_count,
                time_window: '10 minutes',
                audit_log_ids: loginAttempt.audit_log_ids.split(',')
            }
        };

        this.emitAlert(alert);
        await this.sendEmailAlert(alert);
        await this.logAlert(alert);
    }

    async checkUnusualAccess() {
        try {
            const sql = `
                SELECT user_id, resource_type, COUNT(*) as access_count,
                       GROUP_CONCAT(DISTINCT resource_id) as resource_ids,
                       MAX(timestamp) as last_access
                FROM audit_logs 
                WHERE action = 'READ' 
                AND success = 1 
                AND timestamp >= datetime('now', '-5 minutes')
                AND resource_type IN ('PATIENT', 'MEDICAL_RECORD')
                GROUP BY user_id, resource_type
                HAVING access_count >= ?
            `;

            const unusualAccess = await auditService.queryAsync(sql, [this.alertThresholds.unusual_access_threshold]);

            for (const access of unusualAccess) {
                await this.processUnusualAccess(access);
            }
        } catch (error) {
            console.error('Error checking unusual access:', error);
        }
    }

    async processUnusualAccess(access) {
        const alert = {
            type: 'UNUSUAL_ACCESS_PATTERN',
            severity: access.access_count >= 25 ? 'HIGH' : 'MEDIUM',
            timestamp: access.last_access,
            data: {
                user_id: access.user_id,
                resource_type: access.resource_type,
                access_count: access.access_count,
                time_window: '5 minutes',
                resource_ids: access.resource_ids.split(',')
            }
        };

        this.emitAlert(alert);
        await this.logAlert(alert);
    }

    async checkDataExports() {
        try {
            const sql = `
                SELECT user_id, COUNT(*) as export_count,
                       GROUP_CONCAT(id) as audit_log_ids,
                       MAX(timestamp) as last_export
                FROM audit_logs 
                WHERE action = 'EXPORT' 
                AND success = 1 
                AND timestamp >= datetime('now', '-1 hour')
                GROUP BY user_id
                HAVING export_count >= ?
            `;

            const dataExports = await auditService.queryAsync(sql, [this.alertThresholds.data_export_threshold]);

            for (const exportOp of dataExports) {
                await this.processDataExport(exportOp);
            }
        } catch (error) {
            console.error('Error checking data exports:', error);
        }
    }

    async processDataExport(exportOp) {
        const alert = {
            type: 'MASS_DATA_EXPORT',
            severity: exportOp.export_count >= 500 ? 'CRITICAL' : 'HIGH',
            timestamp: exportOp.last_export,
            data: {
                user_id: exportOp.user_id,
                export_count: exportOp.export_count,
                time_window: '1 hour',
                audit_log_ids: exportOp.audit_log_ids.split(',')
            }
        };

        this.emitAlert(alert);
        await this.sendEmailAlert(alert);
        await this.logAlert(alert);
    }

    async runAnomalyDetection() {
        try {
            const anomalies = await auditService.detectAnomalies();

            for (const anomaly of anomalies) {
                const alert = {
                    type: 'ANOMALY_DETECTED',
                    severity: anomaly.severity,
                    timestamp: anomaly.created_at,
                    data: {
                        anomaly_id: anomaly.id,
                        pattern_name: anomaly.pattern_name,
                        description: anomaly.description,
                        confidence_score: anomaly.confidence_score,
                        audit_log_ids: anomaly.audit_log_ids.split(',')
                    }
                };

                this.emitAlert(alert);
                
                if (alert.severity === 'HIGH' || alert.severity === 'CRITICAL') {
                    await this.sendEmailAlert(alert);
                }
                
                await this.logAlert(alert);
            }
        } catch (error) {
            console.error('Error running anomaly detection:', error);
        }
    }

    emitAlert(alert) {
        // Emit to all connected clients
        this.io.emit('audit_alert', alert);

        // Emit to specific subscribers
        const subscribers = this.alertSubscribers.get(alert.type) || [];
        subscribers.forEach(socketId => {
            this.io.to(socketId).emit('audit_alert', alert);
        });

        // Emit to severity-specific subscribers
        const severitySubscribers = this.alertSubscribers.get(alert.severity) || [];
        severitySubscribers.forEach(socketId => {
            this.io.to(socketId).emit('audit_alert', alert);
        });
    }

    async sendEmailAlert(alert) {
        if (!this.emailTransporter) {
            console.warn('Email transporter not available');
            return;
        }

        try {
            const recipients = this.getAlertRecipients(alert);
            
            if (recipients.length === 0) {
                return;
            }

            const subject = `Audit Alert: ${alert.type} - ${alert.severity}`;
            const html = this.generateAlertEmail(alert);

            const mailOptions = {
                from: process.env.ALERT_EMAIL_FROM || 'audit-system@healthcare.com',
                to: recipients.join(', '),
                subject: subject,
                html: html
            };

            await this.emailTransporter.sendMail(mailOptions);
            console.log(`Alert email sent for ${alert.type}`);
        } catch (error) {
            console.error('Failed to send alert email:', error);
        }
    }

    getAlertRecipients(alert) {
        const recipients = [];

        // Add admin recipients
        if (process.env.ADMIN_EMAILS) {
            recipients.push(...process.env.ADMIN_EMAILS.split(','));
        }

        // Add compliance officers
        if (process.env.COMPLIANCE_EMAILS) {
            recipients.push(...process.env.COMPLIANCE_EMAILS.split(','));
        }

        // Add severity-specific recipients
        if (alert.severity === 'CRITICAL' && process.env.CRITICAL_ALERT_EMAILS) {
            recipients.push(...process.env.CRITICAL_ALERT_EMAILS.split(','));
        }

        return recipients.filter(email => email && email.includes('@'));
    }

    generateAlertEmail(alert) {
        const severityColors = {
            'LOW': '#28a745',
            'MEDIUM': '#ffc107',
            'HIGH': '#fd7e14',
            'CRITICAL': '#dc3545'
        };

        const color = severityColors[alert.severity] || '#6c757d';

        return `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <div style="background-color: ${color}; color: white; padding: 20px; text-align: center;">
                    <h1>Audit System Alert</h1>
                    <h2>${alert.type}</h2>
                    <span style="background-color: white; color: ${color}; padding: 5px 10px; border-radius: 3px; font-weight: bold;">
                        ${alert.severity}
                    </span>
                </div>
                
                <div style="padding: 20px; background-color: #f8f9fa;">
                    <h3>Alert Details</h3>
                    <p><strong>Timestamp:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
                    <p><strong>Type:</strong> ${alert.type}</p>
                    <p><strong>Severity:</strong> ${alert.severity}</p>
                    
                    <h3>Event Information</h3>
                    ${this.generateAlertDataHtml(alert.data)}
                </div>
                
                <div style="padding: 20px; background-color: #e9ecef; text-align: center;">
                    <p>This is an automated alert from the Healthcare Audit System.</p>
                    <p>Please investigate this event and take appropriate action if necessary.</p>
                </div>
            </div>
        `;
    }

    generateAlertDataHtml(data) {
        let html = '<table style="width: 100%; border-collapse: collapse;">';
        
        Object.entries(data).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value = value.join(', ');
            } else if (typeof value === 'object' && value !== null) {
                value = JSON.stringify(value, null, 2);
            }
            
            html += `
                <tr>
                    <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; background-color: #f8f9fa;">
                        ${key.replace(/_/g, ' ').toUpperCase()}
                    </td>
                    <td style="padding: 8px; border: 1px solid #ddd; word-break: break-word;">
                        ${value}
                    </td>
                </tr>
            `;
        });
        
        html += '</table>';
        return html;
    }

    async logAlert(alert) {
        try {
            const sql = `
                INSERT INTO audit_alerts (
                    id, type, severity, timestamp, data, created_at
                ) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            await auditService.runAsync(sql, [
                require('uuid').v4(),
                alert.type,
                alert.severity,
                alert.timestamp,
                JSON.stringify(alert.data)
            ]);
        } catch (error) {
            console.error('Failed to log alert:', error);
        }
    }

    // WebSocket subscription management
    subscribeToAlerts(socket, alertTypes = [], severities = []) {
        const socketId = socket.id;

        // Subscribe to specific alert types
        alertTypes.forEach(type => {
            if (!this.alertSubscribers.has(type)) {
                this.alertSubscribers.set(type, new Set());
            }
            this.alertSubscribers.get(type).add(socketId);
        });

        // Subscribe to specific severities
        severities.forEach(severity => {
            if (!this.alertSubscribers.has(severity)) {
                this.alertSubscribers.set(severity, new Set());
            }
            this.alertSubscribers.get(severity).add(socketId);
        });

        socket.on('disconnect', () => {
            this.unsubscribeFromAlerts(socketId);
        });
    }

    unsubscribeFromAlerts(socketId) {
        this.alertSubscribers.forEach((subscribers, key) => {
            subscribers.delete(socketId);
            if (subscribers.size === 0) {
                this.alertSubscribers.delete(key);
            }
        });
    }

    // Get recent alerts
    async getRecentAlerts(limit = 50, filters = {}) {
        try {
            let sql = 'SELECT * FROM audit_alerts WHERE 1=1';
            const params = [];

            if (filters.type) {
                sql += ' AND type = ?';
                params.push(filters.type);
            }

            if (filters.severity) {
                sql += ' AND severity = ?';
                params.push(filters.severity);
            }

            if (filters.start_date) {
                sql += ' AND timestamp >= ?';
                params.push(filters.start_date);
            }

            if (filters.end_date) {
                sql += ' AND timestamp <= ?';
                params.push(filters.end_date);
            }

            sql += ' ORDER BY timestamp DESC LIMIT ?';
            params.push(limit);

            const alerts = await auditService.queryAsync(sql, params);

            return alerts.map(alert => ({
                ...alert,
                data: alert.data ? JSON.parse(alert.data) : {}
            }));
        } catch (error) {
            console.error('Error fetching recent alerts:', error);
            return [];
        }
    }

    // Get alert statistics
    async getAlertStats(timeframe = '24h') {
        try {
            const timeConditions = {
                '1h': "datetime('now', '-1 hour')",
                '24h': "datetime('now', '-1 day')",
                '7d': "datetime('now', '-7 days')",
                '30d': "datetime('now', '-30 days')"
            };

            const timeCondition = timeConditions[timeframe] || timeConditions['24h'];

            const sql = `
                SELECT 
                    COUNT(*) as total_alerts,
                    COUNT(CASE WHEN severity = 'CRITICAL' THEN 1 END) as critical_alerts,
                    COUNT(CASE WHEN severity = 'HIGH' THEN 1 END) as high_alerts,
                    COUNT(CASE WHEN severity = 'MEDIUM' THEN 1 END) as medium_alerts,
                    COUNT(CASE WHEN severity = 'LOW' THEN 1 END) as low_alerts,
                    COUNT(DISTINCT type) as unique_types
                FROM audit_alerts 
                WHERE timestamp >= ${timeCondition}
            `;

            return await auditService.getAsync(sql);
        } catch (error) {
            console.error('Error fetching alert stats:', error);
            return null;
        }
    }

    // Update alert thresholds
    updateThresholds(newThresholds) {
        this.alertThresholds = { ...this.alertThresholds, ...newThresholds };
        console.log('Alert thresholds updated:', this.alertThresholds);
    }

    // Stop monitoring
    stopMonitoring() {
        this.monitoringIntervals.forEach((interval, key) => {
            clearInterval(interval);
            console.log(`Stopped monitoring: ${key}`);
        });
        this.monitoringIntervals.clear();
    }
}

module.exports = AuditMonitoringService;
