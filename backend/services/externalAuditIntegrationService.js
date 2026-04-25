const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbConnection } = require('../database/connection');

class ExternalAuditIntegrationService {
    constructor() {
        this.db = null;
        this.integrationsPath = path.join(__dirname, '../integrations');
        this.initializeDatabase();
        this.ensureIntegrationsDirectory();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize external audit integration service:', error);
        }
    }

    async ensureIntegrationsDirectory() {
        try {
            await fs.mkdir(this.integrationsPath, { recursive: true });
        } catch (error) {
            console.error('Failed to create integrations directory:', error);
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

    runAsync(sql, params = []) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }

    /**
     * Send audit logs to external SIEM system
     */
    async sendToSIEM(auditLogs, siemConfig) {
        const {
            endpoint,
            apiKey,
            format = 'CEF', // Common Event Format
            batchSize = 100,
            retryAttempts = 3
        } = siemConfig;

        const results = {
            sent: 0,
            failed: 0,
            errors: []
        };

        // Process logs in batches
        for (let i = 0; i < auditLogs.length; i += batchSize) {
            const batch = auditLogs.slice(i, i + batchSize);
            
            try {
                const formattedLogs = batch.map(log => this.formatForSIEM(log, format));
                
                await this.sendBatchToSIEM(endpoint, formattedLogs, apiKey, retryAttempts);
                results.sent += batch.length;
                
                // Log successful transmission
                await this.logExternalTransmission('SIEM', batch.length, endpoint, 'SUCCESS');
                
            } catch (error) {
                results.failed += batch.length;
                results.errors.push({
                    batch: i / batchSize + 1,
                    error: error.message,
                    logCount: batch.length
                });
                
                // Log failed transmission
                await this.logExternalTransmission('SIEM', batch.length, endpoint, 'FAILED', error.message);
            }
        }

        return results;
    }

    /**
     * Format audit log for SIEM transmission
     */
    formatForSIEM(log, format) {
        switch (format.toUpperCase()) {
            case 'CEF':
                return this.formatToCEF(log);
            case 'LEEF':
                return this.formatToLEEF(log);
            case 'JSON':
                return this.formatToJSON(log);
            case 'SYSLOG':
                return this.formatToSyslog(log);
            default:
                throw new Error(`Unsupported SIEM format: ${format}`);
        }
    }

    /**
     * Format to Common Event Format (CEF)
     */
    formatToCEF(log) {
        const severity = this.mapRiskScoreToSeverity(log.risk_score);
        const timestamp = new Date(log.timestamp).toISOString();
        
        return `CEF:0|Healthcare|AuditTrail|1.0|${log.action}|${log.resource_type}|${severity}|rt=${timestamp} src=${log.ip_address} suser=${log.user_id} suid=${log.user_role} cs1=${log.resource_id} cs2=${log.correlation_id} msg=${log.error_message || 'Success'}`;
    }

    /**
     * Format to LEEF format
     */
    formatToLEEF(log) {
        const severity = this.mapRiskScoreToSeverity(log.risk_score);
        const timestamp = new Date(log.timestamp).toISOString();
        
        return `LEEF:1.0|Healthcare|AuditTrail|1.0|${log.action}|devTime=${timestamp} src=${log.ip_address} srcUserName=${log.user_id} usrName=${log.user_role} cs2=${log.resource_id} cs3=${log.correlation_id} sev=${severity}`;
    }

    /**
     * Format to JSON for SIEM
     */
    formatToJSON(log) {
        return {
            timestamp: log.timestamp,
            source: {
                ip: log.ip_address,
                user: {
                    id: log.user_id,
                    role: log.user_role
                }
            },
            event: {
                action: log.action,
                resource: {
                    type: log.resource_type,
                    id: log.resource_id,
                    name: log.resource_name
                },
                outcome: log.success ? 'SUCCESS' : 'FAILURE',
                severity: this.mapRiskScoreToSeverity(log.risk_score),
                riskScore: log.risk_score
            },
            context: {
                endpoint: log.endpoint,
                method: log.method,
                sessionId: log.session_id,
                correlationId: log.correlation_id,
                errorMessage: log.error_message
            }
        };
    }

    /**
     * Format to Syslog format
     */
    formatToSyslog(log) {
        const severity = this.mapRiskScoreToSyslogSeverity(log.risk_score);
        const timestamp = new Date(log.timestamp).toISOString();
        const hostname = 'healthcare-audit';
        const appName = 'audit-trail';
        const message = `${log.action} on ${log.resource_type} by ${log.user_id} from ${log.ip_address}`;
        
        return `<${severity}>${timestamp} ${hostname} ${appName}: ${message}`;
    }

    /**
     * Send batch to SIEM endpoint
     */
    async sendBatchToSIEM(endpoint, logs, apiKey, retryAttempts) {
        const payload = {
            logs,
            timestamp: new Date().toISOString(),
            source: 'healthcare-audit-system'
        };

        const config = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
                'X-Integration-ID': 'healthcare-audit-v1'
            },
            timeout: 30000 // 30 seconds timeout
        };

        let lastError;
        
        for (let attempt = 1; attempt <= retryAttempts; attempt++) {
            try {
                const response = await axios.post(endpoint, payload, config);
                
                if (response.status >= 200 && response.status < 300) {
                    return response.data;
                } else {
                    throw new Error(`SIEM returned status ${response.status}`);
                }
            } catch (error) {
                lastError = error;
                
                if (attempt < retryAttempts) {
                    // Exponential backoff
                    const delay = Math.pow(2, attempt) * 1000;
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw lastError;
    }

    /**
     * Send audit logs to compliance monitoring system
     */
    async sendToComplianceSystem(auditLogs, complianceConfig) {
        const {
            endpoint,
            apiKey,
            regulations = ['HIPAA', 'GDPR'],
            format = 'JSON'
        } = complianceConfig;

        // Filter logs based on compliance requirements
        const complianceLogs = auditLogs.filter(log => 
            this.isComplianceRelevant(log, regulations)
        );

        if (complianceLogs.length === 0) {
            return { sent: 0, skipped: auditLogs.length, reason: 'No compliance-relevant logs' };
        }

        try {
            const payload = {
                complianceReport: {
                    regulations,
                    generatedAt: new Date().toISOString(),
                    logs: complianceLogs.map(log => this.formatForCompliance(log, format))
                }
            };

            const response = await axios.post(endpoint, payload, {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`,
                    'X-Compliance-System': 'healthcare-audit'
                },
                timeout: 60000 // 60 seconds timeout
            });

            await this.logExternalTransmission('COMPLIANCE', complianceLogs.length, endpoint, 'SUCCESS');

            return {
                sent: complianceLogs.length,
                skipped: auditLogs.length - complianceLogs.length,
                response: response.data
            };

        } catch (error) {
            await this.logExternalTransmission('COMPLIANCE', complianceLogs.length, endpoint, 'FAILED', error.message);
            throw error;
        }
    }

    /**
     * Check if log is relevant for compliance
     */
    isComplianceRelevant(log, regulations) {
        const complianceFlags = log.compliance_flags ? JSON.parse(log.compliance_flags) : [];
        
        return regulations.some(regulation => {
            switch (regulation) {
                case 'HIPAA':
                    return log.resource_type === 'PATIENT' || 
                           log.resource_type === 'MEDICAL_RECORD' ||
                           complianceFlags.includes('HIPAA_PROTECTED_HEALTH_INFO');
                case 'GDPR':
                    return complianceFlags.includes('GDPR_PERSONAL_DATA') ||
                           log.action === 'DELETE' || // Right to be forgotten
                           log.action === 'EXPORT';   // Data portability
                case 'SOX':
                    return log.resource_type === 'FINANCIAL' ||
                           log.user_role === 'ADMIN' ||
                           log.action === 'UPDATE';
                default:
                    return false;
            }
        });
    }

    /**
     * Format log for compliance system
     */
    formatForCompliance(log, format) {
        if (format === 'JSON') {
            return {
                timestamp: log.timestamp,
                regulation: this.determineApplicableRegulations(log),
                event: {
                    type: log.action,
                    resource: {
                        type: log.resource_type,
                        id: log.resource_id
                    },
                    user: {
                        id: log.user_id,
                        role: log.user_role
                    },
                    outcome: log.success ? 'COMPLIANT' : 'VIOLATION',
                    riskLevel: this.mapRiskScoreToRiskLevel(log.risk_score)
                },
                evidence: {
                    ipAddress: log.ip_address,
                    endpoint: log.endpoint,
                    correlationId: log.correlation_id,
                    complianceFlags: log.compliance_flags ? JSON.parse(log.compliance_flags) : []
                }
            };
        }
        
        return log;
    }

    /**
     * Determine applicable regulations for a log
     */
    determineApplicableRegulations(log) {
        const regulations = [];
        const complianceFlags = log.compliance_flags ? JSON.parse(log.compliance_flags) : [];
        
        if (log.resource_type === 'PATIENT' || log.resource_type === 'MEDICAL_RECORD') {
            regulations.push('HIPAA');
        }
        
        if (complianceFlags.includes('GDPR_PERSONAL_DATA')) {
            regulations.push('GDPR');
        }
        
        if (log.resource_type === 'FINANCIAL' || log.user_role === 'ADMIN') {
            regulations.push('SOX');
        }
        
        return regulations;
    }

    /**
     * Export audit logs for external audit
     */
    async exportForExternalAudit(auditConfig) {
        const {
            startDate,
            endDate,
            format = 'CSV',
            includeHashes = true,
            includeSignatures = false,
            encryptionKey = null
        } = auditConfig;

        const sql = `
            SELECT * FROM audit_logs 
            WHERE timestamp >= ? AND timestamp <= ?
            ORDER BY timestamp ASC
        `;

        const logs = await this.queryAsync(sql, [startDate, endDate]);

        let exportData;
        let filename;
        let mimeType;

        switch (format.toUpperCase()) {
            case 'CSV':
                exportData = this.exportToCSV(logs, includeHashes);
                filename = `audit_export_${startDate}_${endDate}.csv`;
                mimeType = 'text/csv';
                break;
            case 'JSON':
                exportData = this.exportToJSON(logs, includeHashes, includeSignatures);
                filename = `audit_export_${startDate}_${endDate}.json`;
                mimeType = 'application/json';
                break;
            case 'XML':
                exportData = this.exportToXML(logs, includeHashes);
                filename = `audit_export_${startDate}_${endDate}.xml`;
                mimeType = 'application/xml';
                break;
            case 'PARQUET':
                exportData = await this.exportToParquet(logs, includeHashes);
                filename = `audit_export_${startDate}_${endDate}.parquet`;
                mimeType = 'application/octet-stream';
                break;
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }

        // Encrypt if encryption key is provided
        if (encryptionKey) {
            exportData = this.encryptData(exportData, encryptionKey);
            filename += '.enc';
        }

        // Calculate checksum for integrity verification
        const checksum = crypto.createHash('sha256').update(exportData).digest('hex');

        // Save to file
        const filepath = path.join(this.integrationsPath, filename);
        await fs.writeFile(filepath, exportData);

        // Create export record
        const exportRecord = {
            id: uuidv4(),
            startDate,
            endDate,
            format,
            filename,
            filepath,
            size: exportData.length,
            checksum,
            encrypted: !!encryptionKey,
            logCount: logs.length,
            createdAt: new Date().toISOString()
        };

        await this.saveExportRecord(exportRecord);

        return {
            ...exportRecord,
            mimeType,
            downloadUrl: `/api/audit/external/download/${exportRecord.id}`
        };
    }

    /**
     * Export logs to CSV format
     */
    exportToCSV(logs, includeHashes) {
        const headers = [
            'id', 'timestamp', 'user_id', 'user_role', 'action', 'resource_type',
            'resource_id', 'resource_name', 'endpoint', 'method', 'ip_address',
            'status_code', 'success', 'error_message', 'session_id', 'correlation_id',
            'risk_score', 'created_at'
        ];

        if (includeHashes) {
            headers.push('hash', 'previous_hash');
        }

        let csv = headers.join(',') + '\n';

        for (const log of logs) {
            const row = [
                log.id,
                log.timestamp,
                log.user_id,
                log.user_role,
                log.action,
                log.resource_type,
                log.resource_id,
                log.resource_name,
                log.endpoint,
                log.method,
                log.ip_address,
                log.status_code,
                log.success,
                this.escapeCSVField(log.error_message),
                log.session_id,
                log.correlation_id,
                log.risk_score,
                log.created_at
            ];

            if (includeHashes) {
                row.push(log.hash, log.previous_hash);
            }

            csv += row.join(',') + '\n';
        }

        return csv;
    }

    /**
     * Export logs to JSON format
     */
    exportToJSON(logs, includeHashes, includeSignatures) {
        const exportData = {
            metadata: {
                exportedAt: new Date().toISOString(),
                totalLogs: logs.length,
                includeHashes,
                includeSignatures
            },
            logs: logs.map(log => {
                const logData = {
                    id: log.id,
                    timestamp: log.timestamp,
                    user: {
                        id: log.user_id,
                        role: log.user_role
                    },
                    action: log.action,
                    resource: {
                        type: log.resource_type,
                        id: log.resource_id,
                        name: log.resource_name
                    },
                    endpoint: log.endpoint,
                    method: log.method,
                    ipAddress: log.ip_address,
                    statusCode: log.status_code,
                    success: log.success,
                    errorMessage: log.error_message,
                    session: {
                        id: log.session_id,
                        correlationId: log.correlation_id
                    },
                    riskScore: log.risk_score,
                    createdAt: log.created_at
                };

                if (includeHashes) {
                    logData.integrity = {
                        hash: log.hash,
                        previousHash: log.previous_hash
                    };
                }

                if (log.request_data) {
                    try {
                        logData.requestData = JSON.parse(log.request_data);
                    } catch (e) {
                        logData.requestData = null;
                    }
                }

                if (log.response_data) {
                    try {
                        logData.responseData = JSON.parse(log.response_data);
                    } catch (e) {
                        logData.responseData = null;
                    }
                }

                return logData;
            })
        };

        return JSON.stringify(exportData, null, 2);
    }

    /**
     * Export logs to XML format
     */
    exportToXML(logs, includeHashes) {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
        xml += '<audit_export>\n';
        xml += `  <metadata>\n`;
        xml += `    <exported_at>${new Date().toISOString()}</exported_at>\n`;
        xml += `    <total_logs>${logs.length}</total_logs>\n`;
        xml += `    <include_hashes>${includeHashes}</include_hashes>\n`;
        xml += `  </metadata>\n`;
        xml += `  <logs>\n`;

        for (const log of logs) {
            xml += `    <log>\n`;
            xml += `      <id>${this.escapeXML(log.id)}</id>\n`;
            xml += `      <timestamp>${log.timestamp}</timestamp>\n`;
            xml += `      <user_id>${this.escapeXML(log.user_id)}</user_id>\n`;
            xml += `      <user_role>${this.escapeXML(log.user_role)}</user_role>\n`;
            xml += `      <action>${this.escapeXML(log.action)}</action>\n`;
            xml += `      <resource_type>${this.escapeXML(log.resource_type)}</resource_type>\n`;
            xml += `      <resource_id>${this.escapeXML(log.resource_id)}</resource_id>\n`;
            xml += `      <resource_name>${this.escapeXML(log.resource_name)}</resource_name>\n`;
            xml += `      <endpoint>${this.escapeXML(log.endpoint)}</endpoint>\n`;
            xml += `      <method>${log.method}</method>\n`;
            xml += `      <ip_address>${log.ip_address}</ip_address>\n`;
            xml += `      <status_code>${log.status_code}</status_code>\n`;
            xml += `      <success>${log.success}</success>\n`;
            xml += `      <error_message>${this.escapeXML(log.error_message || '')}</error_message>\n`;
            xml += `      <session_id>${this.escapeXML(log.session_id || '')}</session_id>\n`;
            xml += `      <correlation_id>${this.escapeXML(log.correlation_id)}</correlation_id>\n`;
            xml += `      <risk_score>${log.risk_score}</risk_score>\n`;
            xml += `      <created_at>${log.created_at}</created_at>\n`;
            
            if (includeHashes) {
                xml += `      <hash>${log.hash}</hash>\n`;
                xml += `      <previous_hash>${log.previous_hash}</previous_hash>\n`;
            }
            
            xml += `    </log>\n`;
        }

        xml += `  </logs>\n`;
        xml += '</audit_export>\n';

        return xml;
    }

    /**
     * Export logs to Parquet format (placeholder implementation)
     */
    async exportToParquet(logs, includeHashes) {
        // This would require a Parquet library like 'parquetjs'
        // For now, return JSON as placeholder
        return this.exportToJSON(logs, includeHashes, false);
    }

    /**
     * Encrypt data with provided key
     */
    encryptData(data, key) {
        const algorithm = 'aes-256-gcm';
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipher(algorithm, key);
        
        let encrypted = cipher.update(data, 'utf8', 'hex');
        encrypted += cipher.final('hex');
        
        const authTag = cipher.getAuthTag();
        
        return JSON.stringify({
            iv: iv.toString('hex'),
            authTag: authTag.toString('hex'),
            encrypted
        });
    }

    /**
     * Escape CSV field
     */
    escapeCSVField(field) {
        if (!field) return '';
        const str = String(field);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Escape XML characters
     */
    escapeXML(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Save export record to database
     */
    async saveExportRecord(record) {
        const sql = `
            INSERT INTO audit_exports (
                id, start_date, end_date, format, filename, filepath, size,
                checksum, encrypted, log_count, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            record.id,
            record.startDate,
            record.endDate,
            record.format,
            record.filename,
            record.filepath,
            record.size,
            record.checksum,
            record.encrypted,
            record.logCount,
            record.createdAt
        ]);
    }

    /**
     * Log external transmission
     */
    async logExternalTransmission(system, logCount, endpoint, status, error = null) {
        const sql = `
            INSERT INTO external_transmission_log (
                id, system, log_count, endpoint, status, error_message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            uuidv4(),
            system,
            logCount,
            endpoint,
            status,
            error,
            new Date().toISOString()
        ]);
    }

    /**
     * Map risk score to severity level
     */
    mapRiskScoreToSeverity(riskScore) {
        if (riskScore >= 90) return 10; // Critical
        if (riskScore >= 70) return 8;  // High
        if (riskScore >= 50) return 6;  // Medium
        if (riskScore >= 30) return 4;  // Low
        return 2; // Info
    }

    /**
     * Map risk score to syslog severity
     */
    mapRiskScoreToSyslogSeverity(riskScore) {
        if (riskScore >= 90) return 2; // Critical
        if (riskScore >= 70) return 3;  // Error
        if (riskScore >= 50) return 4;  // Warning
        if (riskScore >= 30) return 5;  // Notice
        return 6; // Informational
    }

    /**
     * Map risk score to risk level
     */
    mapRiskScoreToRiskLevel(riskScore) {
        if (riskScore >= 80) return 'CRITICAL';
        if (riskScore >= 60) return 'HIGH';
        if (riskScore >= 40) return 'MEDIUM';
        if (riskScore >= 20) return 'LOW';
        return 'INFO';
    }

    /**
     * Get integration status
     */
    async getIntegrationStatus() {
        const [siemStatus, complianceStatus, exportStatus] = await Promise.all([
            this.getSIEMStatus(),
            this.getComplianceStatus(),
            this.getExportStatus()
        ]);

        return {
            siem: siemStatus,
            compliance: complianceStatus,
            export: exportStatus,
            lastUpdated: new Date().toISOString()
        };
    }

    /**
     * Get SIEM transmission status
     */
    async getSIEMStatus() {
        const sql = `
            SELECT 
                COUNT(*) as total_transmissions,
                COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful_transmissions,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_transmissions,
                MAX(created_at) as last_transmission
            FROM external_transmission_log 
            WHERE system = 'SIEM' 
            AND created_at >= datetime('now', '-24 hours')
        `;

        return await this.getAsync(sql);
    }

    /**
     * Get compliance system status
     */
    async getComplianceStatus() {
        const sql = `
            SELECT 
                COUNT(*) as total_transmissions,
                COUNT(CASE WHEN status = 'SUCCESS' THEN 1 END) as successful_transmissions,
                COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_transmissions,
                MAX(created_at) as last_transmission
            FROM external_transmission_log 
            WHERE system = 'COMPLIANCE' 
            AND created_at >= datetime('now', '-24 hours')
        `;

        return await this.getAsync(sql);
    }

    /**
     * Get export status
     */
    async getExportStatus() {
        const sql = `
            SELECT 
                COUNT(*) as total_exports,
                SUM(size) as total_size,
                MAX(created_at) as last_export
            FROM audit_exports 
            WHERE created_at >= datetime('now', '-24 hours')
        `;

        return await this.getAsync(sql);
    }
}

module.exports = new ExternalAuditIntegrationService();
