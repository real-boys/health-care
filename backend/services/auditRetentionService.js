const fs = require('fs').promises;
const path = require('path');
const zlib = require('zlib');
const { promisify } = require('util');
const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const { v4: uuidv4 } = require('uuid');
const { dbConnection } = require('../database/connection');

class AuditRetentionService {
    constructor() {
        this.db = null;
        this.archivePath = path.join(__dirname, '../archives');
        this.defaultRetentionDays = 2555; // 7 years for HIPAA compliance
        this.initializeDatabase();
        this.ensureArchiveDirectory();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize audit retention service:', error);
        }
    }

    async ensureArchiveDirectory() {
        try {
            await fs.mkdir(this.archivePath, { recursive: true });
        } catch (error) {
            console.error('Failed to create archive directory:', error);
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
     * Apply retention policies to audit logs
     */
    async applyRetentionPolicies() {
        const policies = await this.getActiveRetentionPolicies();
        const results = [];

        for (const policy of policies) {
            try {
                const result = await this.applyPolicy(policy);
                results.push(result);
            } catch (error) {
                console.error(`Error applying retention policy ${policy.name}:`, error);
                results.push({
                    policyId: policy.id,
                    policyName: policy.name,
                    success: false,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Apply a specific retention policy
     */
    async applyPolicy(policy) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

        let sql = `
            SELECT * FROM audit_logs 
            WHERE timestamp < ? 
            AND resource_type = ?
        `;
        const params = [cutoffDate.toISOString(), policy.resource_type];

        // Filter by action types if specified
        if (policy.action_types) {
            const actionTypes = JSON.parse(policy.action_types);
            sql += ` AND action IN (${actionTypes.map(() => '?').join(',')})`;
            params.push(...actionTypes);
        }

        const logsToProcess = await this.queryAsync(sql, params);

        if (logsToProcess.length === 0) {
            return {
                policyId: policy.id,
                policyName: policy.name,
                processed: 0,
                archived: 0,
                deleted: 0,
                success: true
            };
        }

        let archivedCount = 0;
        let deletedCount = 0;

        for (const log of logsToProcess) {
            try {
                // Archive if archive_after_days is specified
                if (policy.archive_after_days) {
                    const archiveCutoffDate = new Date();
                    archiveCutoffDate.setDate(archiveCutoffDate.getDate() - policy.archive_after_days);
                    
                    if (new Date(log.timestamp) < archiveCutoffDate) {
                        await this.archiveLog(log, policy.name);
                        archivedCount++;
                        continue;
                    }
                }

                // Delete if delete_after_days is specified
                if (policy.delete_after_days) {
                    const deleteCutoffDate = new Date();
                    deleteCutoffDate.setDate(deleteCutoffDate.getDate() - policy.delete_after_days);
                    
                    if (new Date(log.timestamp) < deleteCutoffDate) {
                        await this.deleteLog(log.id);
                        deletedCount++;
                    }
                }
            } catch (error) {
                console.error(`Error processing log ${log.id}:`, error);
            }
        }

        return {
            policyId: policy.id,
            policyName: policy.name,
            processed: logsToProcess.length,
            archived: archivedCount,
            deleted: deletedCount,
            success: true
        };
    }

    /**
     * Archive a single audit log
     */
    async archiveLog(log, policyName) {
        // Check if already archived
        const existingArchive = await this.getAsync(
            'SELECT id FROM audit_archive WHERE original_id = ?',
            [log.id]
        );

        if (existingArchive) {
            return existingArchive;
        }

        // Compress log data
        const logData = {
            ...log,
            archived_at: new Date().toISOString(),
            archive_reason: policyName
        };

        const compressedData = await gzip(JSON.stringify(logData));
        const checksum = this.calculateChecksum(logData);

        // Store in archive table
        const archiveId = uuidv4();
        const sql = `
            INSERT INTO audit_archive (
                id, original_id, archived_at, archive_reason, 
                compressed_data, checksum
            ) VALUES (?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            archiveId,
            log.id,
            new Date().toISOString(),
            policyName,
            compressedData,
            checksum
        ]);

        // Also save to file system for additional backup
        await this.saveArchiveToFile(archiveId, compressedData);

        // Delete from main table after successful archiving
        await this.deleteLog(log.id);

        return { id: archiveId, originalId: log.id };
    }

    /**
     * Save archive data to file system
     */
    async saveArchiveToFile(archiveId, compressedData) {
        const filename = `${archiveId}.gz`;
        const filepath = path.join(this.archivePath, filename);
        
        await fs.writeFile(filepath, compressedData);
    }

    /**
     * Delete audit log from main table
     */
    async deleteLog(logId) {
        // Delete related records first
        await this.runAsync('DELETE FROM audit_log_categories WHERE audit_log_id = ?', [logId]);
        await this.runAsync('DELETE FROM compliance_violations WHERE audit_log_id = ?', [logId]);
        
        // Delete the main log
        await this.runAsync('DELETE FROM audit_logs WHERE id = ?', [logId]);
    }

    /**
     * Get active retention policies
     */
    async getActiveRetentionPolicies() {
        return await this.queryAsync(
            'SELECT * FROM retention_policies WHERE is_active = 1 ORDER BY resource_type'
        );
    }

    /**
     * Create or update retention policy
     */
    async createRetentionPolicy(policyData) {
        const {
            name,
            description,
            resourceType,
            actionTypes,
            retentionDays,
            archiveAfterDays,
            deleteAfterDays,
            isActive = true
        } = policyData;

        const sql = `
            INSERT OR REPLACE INTO retention_policies (
                name, description, resource_type, action_types,
                retention_days, archive_after_days, delete_after_days, is_active,
                created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            name,
            description,
            resourceType,
            actionTypes ? JSON.stringify(actionTypes) : null,
            retentionDays,
            archiveAfterDays,
            deleteAfterDays,
            isActive,
            new Date().toISOString()
        ]);

        return await this.getAsync(
            'SELECT * FROM retention_policies WHERE name = ?',
            [name]
        );
    }

    /**
     * Restore archived log
     */
    async restoreArchivedLog(archiveId) {
        const archive = await this.getAsync(
            'SELECT * FROM audit_archive WHERE id = ?',
            [archiveId]
        );

        if (!archive) {
            throw new Error(`Archive with ID ${archiveId} not found`);
        }

        // Decompress data
        const decompressedData = await gunzip(archive.compressed_data);
        const logData = JSON.parse(decompressedData.toString());

        // Verify checksum
        const expectedChecksum = this.calculateChecksum(logData);
        if (expectedChecksum !== archive.checksum) {
            throw new Error('Archive integrity check failed');
        }

        // Remove archive-specific fields
        const { archived_at, archive_reason, ...originalLog } = logData;

        // Restore to main table
        await this.restoreLogToMainTable(originalLog);

        // Delete from archive
        await this.runAsync('DELETE FROM audit_archive WHERE id = ?', [archiveId]);

        // Delete archive file
        try {
            const filename = `${archiveId}.gz`;
            const filepath = path.join(this.archivePath, filename);
            await fs.unlink(filepath);
        } catch (error) {
            console.error('Error deleting archive file:', error);
        }

        return originalLog;
    }

    /**
     * Restore log to main audit_logs table
     */
    async restoreLogToMainTable(logData) {
        const sql = `
            INSERT INTO audit_logs (
                id, timestamp, user_id, user_role, action, resource_type, resource_id,
                resource_name, endpoint, method, ip_address, user_agent, request_data,
                response_data, status_code, success, error_message, session_id,
                correlation_id, compliance_flags, risk_score, metadata, hash,
                previous_hash, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await this.runAsync(sql, [
            logData.id,
            logData.timestamp,
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
            logData.request_data,
            logData.response_data,
            logData.status_code,
            logData.success,
            logData.error_message,
            logData.session_id,
            logData.correlation_id,
            logData.compliance_flags,
            logData.risk_score,
            logData.metadata,
            logData.hash,
            logData.previous_hash,
            logData.created_at
        ]);

        // Restore categories if they exist
        if (logData.categories) {
            await this.restoreLogCategories(logData.id, logData.categories);
        }
    }

    /**
     * Restore log categories
     */
    async restoreLogCategories(logId, categories) {
        for (const categoryName of categories) {
            const category = await this.getAsync(
                'SELECT id FROM audit_categories WHERE name = ?',
                [categoryName]
            );
            
            if (category) {
                await this.runAsync(
                    'INSERT OR IGNORE INTO audit_log_categories (audit_log_id, category_id) VALUES (?, ?)',
                    [logId, category.id]
                );
            }
        }
    }

    /**
     * Get retention statistics
     */
    async getRetentionStatistics() {
        const [mainStats, archiveStats, policyStats] = await Promise.all([
            this.getMainTableStats(),
            this.getArchiveStats(),
            this.getPolicyStats()
        ]);

        return {
            mainTable: mainStats,
            archive: archiveStats,
            policies: policyStats,
            totalLogs: mainStats.totalLogs + archiveStats.totalArchived
        };
    }

    /**
     * Get main table statistics
     */
    async getMainTableStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_logs,
                MIN(timestamp) as earliest_log,
                MAX(timestamp) as latest_log,
                COUNT(DISTINCT resource_type) as resource_types
            FROM audit_logs
        `;

        return await this.getAsync(sql);
    }

    /**
     * Get archive statistics
     */
    async getArchiveStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_archived,
                MIN(archived_at) as earliest_archive,
                MAX(archived_at) as latest_archive,
                SUM(LENGTH(compressed_data)) as total_size
            FROM audit_archive
        `;

        return await this.getAsync(sql);
    }

    /**
     * Get policy statistics
     */
    async getPolicyStats() {
        const sql = `
            SELECT 
                COUNT(*) as total_policies,
                COUNT(CASE WHEN is_active = 1 THEN 1 END) as active_policies,
                AVG(retention_days) as avg_retention_days
            FROM retention_policies
        `;

        return await this.getAsync(sql);
    }

    /**
     * Calculate checksum for data integrity
     */
    calculateChecksum(data) {
        const crypto = require('crypto');
        const dataString = typeof data === 'string' ? data : JSON.stringify(data);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    /**
     * Cleanup old archive files
     */
    async cleanupArchiveFiles(olderThanDays = 365) {
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

        const oldArchives = await this.queryAsync(
            'SELECT id FROM audit_archive WHERE archived_at < ?',
            [cutoffDate.toISOString()]
        );

        let deletedCount = 0;

        for (const archive of oldArchives) {
            try {
                const filename = `${archive.id}.gz`;
                const filepath = path.join(this.archivePath, filename);
                await fs.unlink(filepath);
                deletedCount++;
            } catch (error) {
                console.error(`Error deleting archive file ${archive.id}:`, error);
            }
        }

        return {
            deletedFiles: deletedCount,
            cutoffDate: cutoffDate.toISOString()
        };
    }

    /**
     * Export retention policy configuration
     */
    async exportRetentionPolicies() {
        const policies = await this.queryAsync(
            'SELECT * FROM retention_policies ORDER BY name'
        );

        return {
            exportedAt: new Date().toISOString(),
            policies: policies
        };
    }

    /**
     * Import retention policy configuration
     */
    async importRetentionPolicies(policiesData) {
        const results = {
            imported: 0,
            skipped: 0,
            errors: []
        };

        for (const policy of policiesData.policies) {
            try {
                await this.createRetentionPolicy(policy);
                results.imported++;
            } catch (error) {
                results.errors.push({
                    policy: policy.name,
                    error: error.message
                });
            }
        }

        return results;
    }

    /**
     * Schedule automated retention tasks
     */
    async scheduleRetentionTasks() {
        // This would integrate with a job scheduler like bull or node-cron
        // For now, we'll just run the retention policies
        console.log('Running scheduled retention tasks...');
        
        try {
            const results = await this.applyRetentionPolicies();
            console.log('Retention tasks completed:', results);
            
            // Also cleanup old archive files
            const cleanupResults = await this.cleanupArchiveFiles();
            console.log('Archive cleanup completed:', cleanupResults);
            
            return {
                retentionResults: results,
                cleanupResults,
                runAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('Error in scheduled retention tasks:', error);
            throw error;
        }
    }

    /**
     * Get retention compliance status
     */
    async getRetentionComplianceStatus() {
        const policies = await this.getActiveRetentionPolicies();
        const complianceStatus = [];

        for (const policy of policies) {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - policy.retention_days);

            const violatingLogs = await this.queryAsync(
                `SELECT COUNT(*) as count FROM audit_logs 
                 WHERE timestamp < ? AND resource_type = ?`,
                [cutoffDate.toISOString(), policy.resource_type]
            );

            const isCompliant = violatingLogs[0].count === 0;

            complianceStatus.push({
                policyName: policy.name,
                resourceType: policy.resource_type,
                retentionDays: policy.retention_days,
                cutoffDate: cutoffDate.toISOString(),
                violatingLogs: violatingLogs[0].count,
                isCompliant
            });
        }

        const overallCompliance = complianceStatus.every(status => status.isCompliant);

        return {
            overallCompliance,
            policies: complianceStatus,
            checkedAt: new Date().toISOString()
        };
    }
}

module.exports = new AuditRetentionService();
