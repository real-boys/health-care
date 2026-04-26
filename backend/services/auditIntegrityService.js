const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbConnection } = require('../database/connection');

class AuditIntegrityService {
    constructor() {
        this.db = null;
        this.hashAlgorithm = 'sha256';
        this.signatureAlgorithm = 'RSA-SHA256';
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize audit integrity service:', error);
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
     * Verify integrity of a single audit log
     */
    async verifySingleLog(logId) {
        const log = await this.getAsync(
            'SELECT * FROM audit_logs WHERE id = ?',
            [logId]
        );

        if (!log) {
            throw new Error(`Audit log with ID ${logId} not found`);
        }

        // Recreate the hash based on log content and previous hash
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

        const verificationResult = {
            logId: log.id,
            timestamp: log.timestamp,
            hashValid: log.hash === expectedHash,
            expectedHash,
            actualHash: log.hash,
            previousHashValid: true, // Will be verified in chain verification
            verificationTime: new Date().toISOString()
        };

        // Store verification result
        await this.storeVerificationResult(verificationResult);

        return verificationResult;
    }

    /**
     * Verify integrity of the entire audit chain
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
        const verificationResults = [];
        let chainValid = true;
        let firstInvalidLog = null;

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
            
            const hashValid = log.hash === expectedHash;
            const previousHashValid = log.previous_hash === previousHash;
            const logValid = hashValid && previousHashValid;
            
            if (!logValid && !firstInvalidLog) {
                firstInvalidLog = log.id;
                chainValid = false;
            }

            const verificationResult = {
                logId: log.id,
                timestamp: log.timestamp,
                sequenceNumber: i + 1,
                hashValid,
                previousHashValid,
                logValid,
                expectedHash,
                actualHash: log.hash,
                expectedPreviousHash: previousHash,
                actualPreviousHash: log.previous_hash,
                verificationTime: new Date().toISOString()
            };

            verificationResults.push(verificationResult);
        }

        const chainVerification = {
            chainValid,
            totalLogs: logs.length,
            validLogs: verificationResults.filter(r => r.logValid).length,
            invalidLogs: verificationResults.filter(r => !r.logValid).length,
            firstInvalidLog,
            verificationTime: new Date().toISOString(),
            verificationResults
        };

        // Store chain verification result
        await this.storeChainVerificationResult(chainVerification);

        return chainVerification;
    }

    /**
     * Verify digital signature of an audit log
     */
    async verifySignature(logId, publicKey) {
        const log = await this.getAsync(
            'SELECT * FROM audit_logs WHERE id = ?',
            [logId]
        );

        if (!log) {
            throw new Error(`Audit log with ID ${logId} not found`);
        }

        // Recreate the data that was signed
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
        
        // Get signature from audit_signatures table if it exists
        const signatureRecord = await this.getAsync(
            'SELECT signature FROM audit_signatures WHERE audit_log_id = ?',
            [logId]
        );

        if (!signatureRecord) {
            throw new Error(`No signature found for audit log ${logId}`);
        }

        const isValid = crypto.createVerify(this.signatureAlgorithm)
            .update(hashData)
            .verify(publicKey, signatureRecord.signature, 'hex');

        return {
            logId,
            signatureValid: isValid,
            verificationTime: new Date().toISOString()
        };
    }

    /**
     * Detect tampering attempts using various heuristics
     */
    async detectTampering(timeframe = '24h') {
        const timeConditions = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-1 day')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')"
        };

        const timeCondition = timeConditions[timeframe] || timeConditions['24h'];

        // Check for gaps in sequence
        const gaps = await this.detectSequenceGaps(timeCondition);
        
        // Check for duplicate hashes
        const duplicates = await this.detectDuplicateHashes(timeCondition);
        
        // Check for broken hash chains
        const brokenChains = await this.detectBrokenChains(timeCondition);
        
        // Check for unusual timestamp patterns
        const timestampAnomalies = await this.detectTimestampAnomalies(timeCondition);

        const tamperingDetection = {
            timeframe,
            detectionTime: new Date().toISOString(),
            sequenceGaps: gaps,
            duplicateHashes: duplicates,
            brokenChains: brokenChains,
            timestampAnomalies: timestampAnomalies,
            totalSuspiciousEvents: gaps.length + duplicates.length + brokenChains.length + timestampAnomalies.length
        };

        // Store tampering detection results
        if (tamperingDetection.totalSuspiciousEvents > 0) {
            await this.storeTamperingDetection(tamperingDetection);
        }

        return tamperingDetection;
    }

    /**
     * Detect gaps in audit log sequence
     */
    async detectSequenceGaps(timeCondition) {
        const sql = `
            SELECT 
                id,
                timestamp,
                LAG(id) OVER (ORDER BY timestamp, id) as previous_id,
                LAG(timestamp) OVER (ORDER BY timestamp, id) as previous_timestamp
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            ORDER BY timestamp, id
        `;

        const logs = await this.queryAsync(sql);
        const gaps = [];

        for (let i = 1; i < logs.length; i++) {
            const current = logs[i];
            const previous = logs[i - 1];
            
            // Check for unusual time gaps (more than 5 minutes between logs in active periods)
            const timeDiff = new Date(current.timestamp) - new Date(previous.timestamp);
            if (timeDiff > 5 * 60 * 1000) { // 5 minutes
                gaps.push({
                    type: 'TIME_GAP',
                    currentLogId: current.id,
                    previousLogId: previous.id,
                    gapDuration: timeDiff,
                    description: `Unusual time gap of ${Math.round(timeDiff / 1000)} seconds detected`
                });
            }
        }

        return gaps;
    }

    /**
     * Detect duplicate hashes which may indicate tampering
     */
    async detectDuplicateHashes(timeCondition) {
        const sql = `
            SELECT hash, COUNT(*) as count, GROUP_CONCAT(id) as log_ids
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY hash
            HAVING count > 1
        `;

        const duplicates = await this.queryAsync(sql);
        
        return duplicates.map(dup => ({
            type: 'DUPLICATE_HASH',
            hash: dup.hash,
            count: dup.count,
            logIds: dup.log_ids.split(','),
            description: `Hash ${dup.hash} appears ${dup.count} times`
        }));
    }

    /**
     * Detect broken hash chains
     */
    async detectBrokenChains(timeCondition) {
        const sql = `
            SELECT 
                id,
                hash,
                previous_hash,
                LAG(hash) OVER (ORDER BY timestamp, id) as expected_previous_hash
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            ORDER BY timestamp, id
        `;

        const logs = await this.queryAsync(sql);
        const brokenChains = [];

        for (let i = 1; i < logs.length; i++) {
            const current = logs[i];
            const expectedPreviousHash = logs[i - 1].hash;
            
            if (current.previous_hash !== expectedPreviousHash) {
                brokenChains.push({
                    type: 'BROKEN_CHAIN',
                    logId: current.id,
                    expectedPreviousHash,
                    actualPreviousHash: current.previous_hash,
                    description: `Hash chain broken at log ${current.id}`
                });
            }
        }

        return brokenChains;
    }

    /**
     * Detect timestamp anomalies
     */
    async detectTimestampAnomalies(timeCondition) {
        const sql = `
            SELECT id, timestamp
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            ORDER BY timestamp
        `;

        const logs = await this.queryAsync(sql);
        const anomalies = [];

        for (let i = 1; i < logs.length; i++) {
            const current = logs[i];
            const previous = logs[i - 1];
            
            // Check for timestamps in the past
            const currentTime = new Date(current.timestamp);
            const previousTime = new Date(previous.timestamp);
            
            if (currentTime < previousTime) {
                anomalies.push({
                    type: 'BACKWARD_TIMESTAMP',
                    logId: current.id,
                    timestamp: current.timestamp,
                    previousTimestamp: previous.timestamp,
                    description: `Timestamp goes backward at log ${current.id}`
                });
            }
            
            // Check for future timestamps
            if (currentTime > new Date()) {
                anomalies.push({
                    type: 'FUTURE_TIMESTAMP',
                    logId: current.id,
                    timestamp: current.timestamp,
                    description: `Future timestamp detected at log ${current.id}`
                });
            }
        }

        return anomalies;
    }

    /**
     * Store verification result
     */
    async storeVerificationResult(result) {
        const sql = `
            INSERT INTO audit_verifications (
                id, audit_log_id, hash_valid, expected_hash, actual_hash,
                verification_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            uuidv4(),
            result.logId,
            result.hashValid,
            result.expectedHash,
            result.actualHash,
            result.verificationTime,
            new Date().toISOString()
        ]);
    }

    /**
     * Store chain verification result
     */
    async storeChainVerificationResult(result) {
        const sql = `
            INSERT INTO audit_chain_verifications (
                id, chain_valid, total_logs, valid_logs, invalid_logs,
                first_invalid_log, verification_time, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            uuidv4(),
            result.chainValid,
            result.totalLogs,
            result.validLogs,
            result.invalidLogs,
            result.firstInvalidLog,
            result.verificationTime,
            new Date().toISOString()
        ]);
    }

    /**
     * Store tampering detection results
     */
    async storeTamperingDetection(detection) {
        const sql = `
            INSERT INTO audit_tampering_alerts (
                id, timeframe, total_suspicious_events, detection_data,
                created_at
            ) VALUES (?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            uuidv4(),
            detection.timeframe,
            detection.totalSuspiciousEvents,
            JSON.stringify(detection),
            new Date().toISOString()
        ]);
    }

    /**
     * Get verification history
     */
    async getVerificationHistory(limit = 100) {
        const sql = `
            SELECT * FROM audit_chain_verifications 
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        return await this.queryAsync(sql, [limit]);
    }

    /**
     * Get tampering alerts
     */
    async getTamperingAlerts(limit = 100) {
        const sql = `
            SELECT * FROM audit_tampering_alerts 
            ORDER BY created_at DESC 
            LIMIT ?
        `;

        const alerts = await this.queryAsync(sql, [limit]);
        
        return alerts.map(alert => ({
            ...alert,
            detectionData: JSON.parse(alert.detection_data)
        }));
    }

    /**
     * Generate integrity report
     */
    async generateIntegrityReport(timeframe = '7d') {
        const chainVerification = await this.verifyAuditChain(
            new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
            new Date()
        );

        const tamperingDetection = await this.detectTampering(timeframe);
        const verificationHistory = await this.getVerificationHistory(10);
        const tamperingAlerts = await this.getTamperingAlerts(10);

        return {
            reportType: 'INTEGRITY',
            timeframe,
            generatedAt: new Date().toISOString(),
            chainVerification,
            tamperingDetection,
            verificationHistory,
            tamperingAlerts,
            summary: {
                chainValid: chainVerification.chainValid,
                totalLogs: chainVerification.totalLogs,
                suspiciousEvents: tamperingDetection.totalSuspiciousEvents,
                recentVerifications: verificationHistory.length,
                recentAlerts: tamperingAlerts.length
            },
            recommendations: this.generateIntegrityRecommendations(chainVerification, tamperingDetection)
        };
    }

    /**
     * Generate integrity recommendations
     */
    generateIntegrityRecommendations(chainVerification, tamperingDetection) {
        const recommendations = [];

        if (!chainVerification.chainValid) {
            recommendations.push({
                priority: 'CRITICAL',
                title: 'Audit Chain Integrity Compromised',
                description: 'The audit log chain has been broken. Immediate investigation required.',
                action: 'Review invalid logs and restore from backup if necessary'
            });
        }

        if (tamperingDetection.totalSuspiciousEvents > 0) {
            recommendations.push({
                priority: 'HIGH',
                title: 'Suspicious Activity Detected',
                description: `${tamperingDetection.totalSuspiciousEvents} suspicious events detected.`,
                action: 'Investigate tampering alerts and review system access logs'
            });
        }

        if (chainVerification.invalidLogs > 0) {
            recommendations.push({
                priority: 'MEDIUM',
                title: 'Invalid Audit Logs Found',
                description: `${chainVerification.invalidLogs} audit logs failed integrity verification.`,
                action: 'Review and re-validate affected audit logs'
            });
        }

        if (recommendations.length === 0) {
            recommendations.push({
                priority: 'INFO',
                title: 'System Integrity Maintained',
                description: 'No integrity issues detected in the audit trail.',
                action: 'Continue regular monitoring and verification'
            });
        }

        return recommendations;
    }
}

module.exports = new AuditIntegrityService();
