const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbConnection } = require('../database/connection');

class EnhancedAuditService {
    constructor() {
        this.db = null;
        this.hashAlgorithm = 'sha256';
        this.signatureAlgorithm = 'RSA-SHA256';
        this.initializeDatabase();
        this.initializeCryptoKeys();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize enhanced audit service:', error);
        }
    }

    async initializeCryptoKeys() {
        // Generate or load signing keys for tamper-proof verification
        if (!process.env.AUDIT_PRIVATE_KEY) {
            const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
                modulusLength: 2048,
                publicKeyEncoding: { type: 'spki', format: 'pem' },
                privateKeyEncoding: { type: 'pkcs8', format: 'pem' }
            });
            this.privateKey = privateKey;
            this.publicKey = publicKey;
        } else {
            this.privateKey = process.env.AUDIT_PRIVATE_KEY;
            this.publicKey = process.env.AUDIT_PUBLIC_KEY;
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

    /**
     * Create tamper-proof audit log entry
     */
    async createAuditLog(logData) {
        if (!this.db) throw new Error('Database not initialized');

        const auditLogId = uuidv4();
        const timestamp = new Date().toISOString();
        
        // Get the previous log's hash for chaining
        const previousHash = await this.getPreviousLogHash();
        
        // Prepare log data for hashing
        const logContent = {
            id: auditLogId,
            timestamp,
            user_id: logData.user_id,
            user_role: logData.user_role,
            action: logData.action,
            resource_type: logData.resource_type,
            resource_id: logData.resource_id,
            resource_name: logData.resource_name,
            endpoint: logData.endpoint,
            method: logData.method,
            ip_address: logData.ip_address,
            user_agent: logData.user_agent,
            status_code: logData.status_code,
            success: logData.success,
            error_message: logData.error_message,
            session_id: logData.session_id,
            correlation_id: logData.correlation_id,
            compliance_flags: logData.compliance_flags || [],
            risk_score: logData.risk_score || 0,
            metadata: logData.metadata || {}
        };

        // Sanitize sensitive data for storage
        const sanitizedRequestData = this.sanitizeData(logData.request_data);
        const sanitizedResponseData = this.sanitizeData(logData.response_data);

        // Create hash chain
        const hashData = JSON.stringify(logContent) + previousHash;
        const currentHash = crypto.createHash(this.hashAlgorithm).update(hashData).digest('hex');
        
        // Create digital signature
        const signature = crypto.createSign(this.signatureAlgorithm)
            .update(hashData)
            .sign(this.privateKey, 'hex');

        // Store the audit log
        const sql = `
            INSERT INTO audit_logs (
                id, timestamp, user_id, user_role, action, resource_type, resource_id,
                resource_name, endpoint, method, ip_address, user_agent, request_data,
                response_data, status_code, success, error_message, session_id,
                correlation_id, compliance_flags, risk_score, metadata, hash,
                previous_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const params = [
            auditLogId,
            timestamp,
            logData.user_id,
            logData.user_role,
            logData.action,
            logData.resource_type,
            logData.resource_id,
            logData.resource_name,
            logData.endpoint,
            logData.method,
            logData.ip_address,
            logData.user_agent,
            JSON.stringify(sanitizedRequestData),
            JSON.stringify(sanitizedResponseData),
            logData.status_code,
            logData.success,
            logData.error_message,
            logData.session_id,
            logData.correlation_id,
            JSON.stringify(logData.compliance_flags || []),
            logData.risk_score || 0,
            JSON.stringify(logData.metadata || {}),
            currentHash,
            previousHash,
            timestamp
        ];

        await this.runAsync(sql, params);

        // Link categories if provided
        if (logData.categories && logData.categories.length > 0) {
            await this.linkAuditCategories(auditLogId, logData.categories);
        }

        // Check compliance rules
        const violations = await this.checkComplianceRules({
            id: auditLogId,
            ...logContent
        });

        // Detect anomalies
        await this.detectAnomaliesForLog(auditLogId);

        return {
            id: auditLogId,
            hash: currentHash,
            signature,
            violations: violations,
            timestamp: timestamp
        };
    }

    /**
     * Get previous log hash for chaining
     */
    async getPreviousLogHash() {
        const sql = 'SELECT hash FROM audit_logs ORDER BY timestamp DESC, id DESC LIMIT 1';
        const result = await this.getAsync(sql);
        return result ? result.hash : 'GENESIS_HASH';
    }

    /**
     * Sanitize sensitive data for audit storage
     */
    sanitizeData(data) {
        if (!data) return null;
        
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'ssn', 'credit_card',
            'bank_account', 'medical_record', 'phi', 'protected_health_info'
        ];

        const sanitized = { ...data };
        
        const sanitizeObject = (obj) => {
            if (typeof obj !== 'object' || obj === null) return obj;
            
            if (Array.isArray(obj)) {
                return obj.map(sanitizeObject);
            }
            
            const result = {};
            for (const [key, value] of Object.entries(obj)) {
                const lowerKey = key.toLowerCase();
                if (sensitiveFields.some(field => lowerKey.includes(field))) {
                    result[key] = '[REDACTED]';
                } else if (typeof value === 'object') {
                    result[key] = sanitizeObject(value);
                } else {
                    result[key] = value;
                }
            }
            return result;
        };

        return sanitizeObject(sanitized);
    }

    /**
     * Link audit log to categories
     */
    async linkAuditCategories(auditLogId, categories) {
        for (const categoryName of categories) {
            const category = await this.getAsync(
                'SELECT id FROM audit_categories WHERE name = ?',
                [categoryName]
            );
            
            if (category) {
                await this.runAsync(
                    'INSERT OR IGNORE INTO audit_log_categories (audit_log_id, category_id) VALUES (?, ?)',
                    [auditLogId, category.id]
                );
            }
        }
    }

    /**
     * Verify audit log integrity
     */
    async verifyLogIntegrity(auditLogId) {
        const log = await this.getAsync(
            'SELECT * FROM audit_logs WHERE id = ?',
            [auditLogId]
        );

        if (!log) {
            throw new Error('Audit log not found');
        }

        // Recreate hash
        const logContent = {
            id: log.id,
            timestamp: log.timestamp,
            user_id: log.user_id,
            user_role: log.user_role,
            action: log.action,
            resource_type: log.resource_type,
            resource_id: log.resource_id,
            resource_name: log.resource_name,
            endpoint: log.endpoint,
            method: log.method,
            ip_address: log.ip_address,
            user_agent: log.user_agent,
            status_code: log.status_code,
            success: log.success,
            error_message: log.error_message,
            session_id: log.session_id,
            correlation_id: log.correlation_id,
            compliance_flags: JSON.parse(log.compliance_flags || '[]'),
            risk_score: log.risk_score,
            metadata: JSON.parse(log.metadata || '{}')
        };

        const hashData = JSON.stringify(logContent) + log.previous_hash;
        const expectedHash = crypto.createHash(this.hashAlgorithm).update(hashData).digest('hex');

        return {
            isValid: log.hash === expectedHash,
            expectedHash,
            actualHash: log.hash,
            timestamp: log.timestamp
        };
    }

    /**
     * Verify entire audit chain integrity
     */
    async verifyAuditChain(fromDate = null, toDate = null) {
        let sql = 'SELECT * FROM audit_logs ORDER BY timestamp ASC, id ASC';
        const params = [];

        if (fromDate) {
            sql += ' WHERE timestamp >= ?';
            params.push(fromDate.toISOString());
        }

        if (toDate) {
            sql += params.length > 0 ? ' AND timestamp <= ?' : ' WHERE timestamp <= ?';
            params.push(toDate.toISOString());
        }

        const logs = await this.queryAsync(sql, params);
        const results = [];
        let chainValid = true;

        for (let i = 0; i < logs.length; i++) {
            const log = logs[i];
            const previousHash = i === 0 ? 'GENESIS_HASH' : logs[i - 1].hash;
            
            // Recreate hash
            const logContent = {
                id: log.id,
                timestamp: log.timestamp,
                user_id: log.user_id,
                user_role: log.user_role,
                action: log.action,
                resource_type: log.resource_type,
                resource_id: log.resource_id,
                resource_name: log.resource_name,
                endpoint: log.endpoint,
                method: log.method,
                ip_address: log.ip_address,
                user_agent: log.user_agent,
                status_code: log.status_code,
                success: log.success,
                error_message: log.error_message,
                session_id: log.session_id,
                correlation_id: log.correlation_id,
                compliance_flags: JSON.parse(log.compliance_flags || '[]'),
                risk_score: log.risk_score,
                metadata: JSON.parse(log.metadata || '{}')
            };

            const hashData = JSON.stringify(logContent) + previousHash;
            const expectedHash = crypto.createHash(this.hashAlgorithm).update(hashData).digest('hex');
            
            const isValid = log.hash === expectedHash && log.previous_hash === previousHash;
            
            if (!isValid) {
                chainValid = false;
            }

            results.push({
                logId: log.id,
                timestamp: log.timestamp,
                isValid,
                expectedHash,
                actualHash: log.hash,
                expectedPreviousHash: previousHash,
                actualPreviousHash: log.previous_hash
            });
        }

        return {
            chainValid,
            totalLogs: logs.length,
            validLogs: results.filter(r => r.isValid).length,
            invalidLogs: results.filter(r => !r.isValid),
            verificationDetails: results
        };
    }

    /**
     * Enhanced search with tamper-proof verification
     */
    async searchAuditLogs(filters = {}, options = {}) {
        const { verifyIntegrity = true } = options;
        
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

        // Apply filters (same as original service)
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
        const logs = rows.map(row => ({
            ...row,
            compliance_flags: row.compliance_flags ? JSON.parse(row.compliance_flags) : [],
            metadata: row.metadata ? JSON.parse(row.metadata) : {},
            categories: row.categories ? row.categories.split(',') : []
        }));

        // Verify integrity if requested
        if (verifyIntegrity) {
            for (const log of logs) {
                log.integrityVerified = await this.verifyLogIntegrity(log.id);
            }
        }

        return logs;
    }

    /**
     * Get tamper-proof audit metrics
     */
    async getAuditMetrics(timeframe = '24h') {
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
                MAX(risk_score) as max_risk_score,
                COUNT(DISTINCT hash) as unique_hashes  -- For integrity monitoring
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
        `;

        const metrics = await this.getAsync(sql);
        
        // Verify chain integrity for the timeframe
        const now = new Date();
        const fromDate = timeframe === '1h' ? new Date(now.getTime() - 60 * 60 * 1000) :
                        timeframe === '24h' ? new Date(now.getTime() - 24 * 60 * 60 * 1000) :
                        timeframe === '7d' ? new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000) :
                        timeframe === '30d' ? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) :
                        new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

        const chainVerification = await this.verifyAuditChain(fromDate, now);

        return {
            ...metrics,
            integrity: {
                chainValid: chainVerification.chainValid,
                totalLogs: chainVerification.totalLogs,
                validLogs: chainVerification.validLogs,
                invalidLogs: chainVerification.invalidLogs
            }
        };
    }

    // Include methods from original audit service for compliance and anomaly detection
    async checkComplianceRules(auditLog) {
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

        return false;
    }

    calculateViolationSeverity(rule, auditLog) {
        let severity = 'LOW';

        if (auditLog.risk_score >= 70) {
            severity = 'HIGH';
        } else if (auditLog.risk_score >= 40) {
            severity = 'MEDIUM';
        }

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

    async detectAnomaliesForLog(auditLogId) {
        // This would integrate with the existing anomaly detection system
        // For now, we'll just log that detection was triggered
        console.log(`Anomaly detection triggered for audit log: ${auditLogId}`);
    }
}

module.exports = new EnhancedAuditService();
