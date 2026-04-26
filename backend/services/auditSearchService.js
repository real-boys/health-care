const { dbConnection } = require('../database/connection');

class AuditSearchService {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize audit search service:', error);
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
     * Advanced audit log search with comprehensive filtering
     */
    async searchAuditLogs(searchParams) {
        const {
            // Basic filters
            userId,
            userRole,
            action,
            resourceType,
            resourceId,
            resourceName,
            endpoint,
            method,
            ipAddress,
            userAgent,
            statusCode,
            success,
            sessionId,
            correlationId,
            
            // Date/time filters
            startDate,
            endDate,
            startTimestamp,
            endTimestamp,
            
            // Risk and compliance filters
            minRiskScore,
            maxRiskScore,
            categories,
            complianceFlags,
            
            // Text search
            searchText,
            searchInFields = ['action', 'resource_name', 'endpoint', 'error_message'],
            
            // Pagination and sorting
            page = 1,
            limit = 100,
            sortBy = 'timestamp',
            sortOrder = 'DESC',
            
            // Advanced options
            includeMetadata = false,
            includeIntegrity = false,
            includeCategories = true,
            excludeDeleted = true
        } = searchParams;

        let sql = `
            SELECT 
                al.*,
                u.username,
                u.email,
                u.first_name,
                u.last_name
        `;

        if (includeCategories) {
            sql += `,
                GROUP_CONCAT(DISTINCT ac.name) as categories
        `;
        }

        sql += `
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
        `;

        if (includeCategories) {
            sql += `
                LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
                LEFT JOIN audit_categories ac ON alc.category_id = ac.id
            `;
        }

        sql += ' WHERE 1=1';
        const params = [];

        // Apply filters
        if (userId) {
            sql += ' AND al.user_id = ?';
            params.push(userId);
        }

        if (userRole) {
            sql += ' AND al.user_role = ?';
            params.push(userRole);
        }

        if (action) {
            if (Array.isArray(action)) {
                sql += ` AND al.action IN (${action.map(() => '?').join(',')})`;
                params.push(...action);
            } else {
                sql += ' AND al.action = ?';
                params.push(action);
            }
        }

        if (resourceType) {
            if (Array.isArray(resourceType)) {
                sql += ` AND al.resource_type IN (${resourceType.map(() => '?').join(',')})`;
                params.push(...resourceType);
            } else {
                sql += ' AND al.resource_type = ?';
                params.push(resourceType);
            }
        }

        if (resourceId) {
            sql += ' AND al.resource_id = ?';
            params.push(resourceId);
        }

        if (resourceName) {
            sql += ' AND al.resource_name LIKE ?';
            params.push(`%${resourceName}%`);
        }

        if (endpoint) {
            sql += ' AND al.endpoint LIKE ?';
            params.push(`%${endpoint}%`);
        }

        if (method) {
            sql += ' AND al.method = ?';
            params.push(method);
        }

        if (ipAddress) {
            sql += ' AND al.ip_address = ?';
            params.push(ipAddress);
        }

        if (userAgent) {
            sql += ' AND al.user_agent LIKE ?';
            params.push(`%${userAgent}%`);
        }

        if (statusCode) {
            if (Array.isArray(statusCode)) {
                sql += ` AND al.status_code IN (${statusCode.map(() => '?').join(',')})`;
                params.push(...statusCode);
            } else {
                sql += ' AND al.status_code = ?';
                params.push(statusCode);
            }
        }

        if (success !== undefined) {
            sql += ' AND al.success = ?';
            params.push(success ? 1 : 0);
        }

        if (sessionId) {
            sql += ' AND al.session_id = ?';
            params.push(sessionId);
        }

        if (correlationId) {
            sql += ' AND al.correlation_id = ?';
            params.push(correlationId);
        }

        // Date/time filters
        if (startDate) {
            sql += ' AND al.timestamp >= ?';
            params.push(startDate instanceof Date ? startDate.toISOString() : startDate);
        }

        if (endDate) {
            sql += ' AND al.timestamp <= ?';
            params.push(endDate instanceof Date ? endDate.toISOString() : endDate);
        }

        if (startTimestamp) {
            sql += ' AND al.timestamp >= ?';
            params.push(startTimestamp);
        }

        if (endTimestamp) {
            sql += ' AND al.timestamp <= ?';
            params.push(endTimestamp);
        }

        // Risk score filters
        if (minRiskScore !== undefined) {
            sql += ' AND al.risk_score >= ?';
            params.push(minRiskScore);
        }

        if (maxRiskScore !== undefined) {
            sql += ' AND al.risk_score <= ?';
            params.push(maxRiskScore);
        }

        // Category filters
        if (categories && categories.length > 0) {
            sql += ` AND EXISTS (
                SELECT 1 FROM audit_log_categories alc2
                JOIN audit_categories ac2 ON alc2.category_id = ac2.id
                WHERE alc2.audit_log_id = al.id AND ac2.name IN (${categories.map(() => '?').join(',')})
            )`;
            params.push(...categories);
        }

        // Compliance flags filter
        if (complianceFlags && complianceFlags.length > 0) {
            for (const flag of complianceFlags) {
                sql += ' AND al.compliance_flags LIKE ?';
                params.push(`%"${flag}"%`);
            }
        }

        // Text search
        if (searchText) {
            const searchConditions = searchInFields.map(field => `al.${field} LIKE ?`).join(' OR ');
            sql += ` AND (${searchConditions})`;
            const searchTerm = `%${searchText}%`;
            params.push(...searchInFields.map(() => searchTerm));
        }

        // Group by
        if (includeCategories) {
            sql += ' GROUP BY al.id';
        }

        // Sorting
        const validSortFields = [
            'timestamp', 'user_id', 'user_role', 'action', 'resource_type',
            'resource_id', 'endpoint', 'method', 'ip_address', 'status_code',
            'success', 'risk_score', 'created_at'
        ];
        const sortField = validSortFields.includes(sortBy) ? sortBy : 'timestamp';
        const sortDirection = sortOrder.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
        sql += ` ORDER BY al.${sortField} ${sortDirection}`;

        // Get total count
        const countSql = sql.replace(/SELECT.*?FROM/, 'SELECT COUNT(DISTINCT al.id) as total FROM').replace(/GROUP BY.*$/, '').replace(/ORDER BY.*$/, '');
        const countResult = await this.getAsync(countSql, params.slice(0, -2)); // Remove limit and offset for count

        // Pagination
        const offset = (page - 1) * limit;
        sql += ' LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const rows = await this.queryAsync(sql, params);

        // Process results
        const logs = rows.map(row => {
            const processedRow = {
                id: row.id,
                timestamp: row.timestamp,
                userId: row.user_id,
                userRole: row.user_role,
                action: row.action,
                resourceType: row.resource_type,
                resourceId: row.resource_id,
                resourceName: row.resource_name,
                endpoint: row.endpoint,
                method: row.method,
                ipAddress: row.ip_address,
                userAgent: row.user_agent,
                statusCode: row.status_code,
                success: Boolean(row.success),
                errorMessage: row.error_message,
                sessionId: row.session_id,
                correlationId: row.correlation_id,
                riskScore: row.risk_score,
                hash: row.hash,
                previousHash: row.previous_hash,
                createdAt: row.created_at
            };

            // Add user info if available
            if (row.username) {
                processedRow.user = {
                    username: row.username,
                    email: row.email,
                    firstName: row.first_name,
                    lastName: row.last_name
                };
            }

            // Add categories if included
            if (includeCategories && row.categories) {
                processedRow.categories = row.categories.split(',');
            }

            // Add metadata if requested
            if (includeMetadata && row.metadata) {
                try {
                    processedRow.metadata = JSON.parse(row.metadata);
                } catch (e) {
                    processedRow.metadata = {};
                }
            }

            // Add compliance flags if they exist
            if (row.compliance_flags) {
                try {
                    processedRow.complianceFlags = JSON.parse(row.compliance_flags);
                } catch (e) {
                    processedRow.complianceFlags = [];
                }
            }

            return processedRow;
        });

        return {
            logs,
            pagination: {
                page,
                limit,
                total: countResult.total,
                pages: Math.ceil(countResult.total / limit)
            },
            searchParams: {
                ...searchParams,
                totalResults: countResult.total
            }
        };
    }

    /**
     * Get audit log by ID with full details
     */
    async getAuditLogById(logId, options = {}) {
        const { includeMetadata = true, includeIntegrity = false } = options;

        let sql = `
            SELECT 
                al.*,
                u.username,
                u.email,
                u.first_name,
                u.last_name,
                GROUP_CONCAT(DISTINCT ac.name) as categories
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
            LEFT JOIN audit_categories ac ON alc.category_id = ac.id
            WHERE al.id = ?
            GROUP BY al.id
        `;

        const row = await this.getAsync(sql, [logId]);

        if (!row) {
            throw new Error(`Audit log with ID ${logId} not found`);
        }

        const log = {
            id: row.id,
            timestamp: row.timestamp,
            userId: row.user_id,
            userRole: row.user_role,
            action: row.action,
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            resourceName: row.resource_name,
            endpoint: row.endpoint,
            method: row.method,
            ipAddress: row.ip_address,
            userAgent: row.user_agent,
            statusCode: row.status_code,
            success: Boolean(row.success),
            errorMessage: row.error_message,
            sessionId: row.session_id,
            correlationId: row.correlation_id,
            riskScore: row.risk_score,
            hash: row.hash,
            previousHash: row.previous_hash,
            createdAt: row.created_at
        };

        // Add user info
        if (row.username) {
            log.user = {
                username: row.username,
                email: row.email,
                firstName: row.first_name,
                lastName: row.last_name
            };
        }

        // Add categories
        if (row.categories) {
            log.categories = row.categories.split(',');
        }

        // Add metadata
        if (includeMetadata && row.metadata) {
            try {
                log.metadata = JSON.parse(row.metadata);
            } catch (e) {
                log.metadata = {};
            }
        }

        // Add compliance flags
        if (row.compliance_flags) {
            try {
                log.complianceFlags = JSON.parse(row.compliance_flags);
            } catch (e) {
                log.complianceFlags = [];
            }
        }

        // Add request/response data
        if (row.request_data) {
            try {
                log.requestData = JSON.parse(row.request_data);
            } catch (e) {
                log.requestData = null;
            }
        }

        if (row.response_data) {
            try {
                log.responseData = JSON.parse(row.response_data);
            } catch (e) {
                log.responseData = null;
            }
        }

        return log;
    }

    /**
     * Search by correlation ID to find related operations
     */
    async searchByCorrelationId(correlationId, options = {}) {
        const { includeDetails = false } = options;

        let sql = `
            SELECT 
                al.*,
                u.username,
                u.email,
                GROUP_CONCAT(DISTINCT ac.name) as categories
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
            LEFT JOIN audit_categories ac ON alc.category_id = ac.id
            WHERE al.correlation_id = ?
            GROUP BY al.id
            ORDER BY al.timestamp ASC
        `;

        const rows = await this.queryAsync(sql, [correlationId]);

        return rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            userId: row.user_id,
            userRole: row.user_role,
            action: row.action,
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            resourceName: row.resource_name,
            endpoint: row.endpoint,
            method: row.method,
            ipAddress: row.ip_address,
            statusCode: row.status_code,
            success: Boolean(row.success),
            errorMessage: row.error_message,
            sessionId: row.session_id,
            correlationId: row.correlation_id,
            riskScore: row.risk_score,
            categories: row.categories ? row.categories.split(',') : [],
            user: row.username ? {
                username: row.username,
                email: row.email
            } : null
        }));
    }

    /**
     * Get audit logs for a specific user
     */
    async getUserAuditLogs(userId, options = {}) {
        const {
            startDate,
            endDate,
            action,
            resourceType,
            limit = 100,
            offset = 0
        } = options;

        let sql = `
            SELECT 
                al.*,
                GROUP_CONCAT(DISTINCT ac.name) as categories
            FROM audit_logs al
            LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
            LEFT JOIN audit_categories ac ON alc.category_id = ac.id
            WHERE al.user_id = ?
        `;
        const params = [userId];

        if (startDate) {
            sql += ' AND al.timestamp >= ?';
            params.push(startDate instanceof Date ? startDate.toISOString() : startDate);
        }

        if (endDate) {
            sql += ' AND al.timestamp <= ?';
            params.push(endDate instanceof Date ? endDate.toISOString() : endDate);
        }

        if (action) {
            sql += ' AND al.action = ?';
            params.push(action);
        }

        if (resourceType) {
            sql += ' AND al.resource_type = ?';
            params.push(resourceType);
        }

        sql += ' GROUP BY al.id ORDER BY al.timestamp DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        if (offset) {
            sql += ' OFFSET ?';
            params.push(offset);
        }

        const rows = await this.queryAsync(sql, params);

        return rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            action: row.action,
            resourceType: row.resource_type,
            resourceId: row.resource_id,
            resourceName: row.resource_name,
            endpoint: row.endpoint,
            method: row.method,
            ipAddress: row.ip_address,
            statusCode: row.status_code,
            success: Boolean(row.success),
            errorMessage: row.error_message,
            riskScore: row.risk_score,
            categories: row.categories ? row.categories.split(',') : []
        }));
    }

    /**
     * Get audit logs for a specific resource
     */
    async getResourceAuditLogs(resourceType, resourceId, options = {}) {
        const {
            startDate,
            endDate,
            action,
            userId,
            limit = 100,
            offset = 0
        } = options;

        let sql = `
            SELECT 
                al.*,
                u.username,
                u.email,
                GROUP_CONCAT(DISTINCT ac.name) as categories
            FROM audit_logs al
            LEFT JOIN users u ON al.user_id = u.id
            LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
            LEFT JOIN audit_categories ac ON alc.category_id = ac.id
            WHERE al.resource_type = ? AND al.resource_id = ?
        `;
        const params = [resourceType, resourceId];

        if (startDate) {
            sql += ' AND al.timestamp >= ?';
            params.push(startDate instanceof Date ? startDate.toISOString() : startDate);
        }

        if (endDate) {
            sql += ' AND al.timestamp <= ?';
            params.push(endDate instanceof Date ? endDate.toISOString() : endDate);
        }

        if (action) {
            sql += ' AND al.action = ?';
            params.push(action);
        }

        if (userId) {
            sql += ' AND al.user_id = ?';
            params.push(userId);
        }

        sql += ' GROUP BY al.id ORDER BY al.timestamp DESC';

        if (limit) {
            sql += ' LIMIT ?';
            params.push(limit);
        }

        if (offset) {
            sql += ' OFFSET ?';
            params.push(offset);
        }

        const rows = await this.queryAsync(sql, params);

        return rows.map(row => ({
            id: row.id,
            timestamp: row.timestamp,
            userId: row.user_id,
            userRole: row.user_role,
            action: row.action,
            endpoint: row.endpoint,
            method: row.method,
            ipAddress: row.ip_address,
            statusCode: row.status_code,
            success: Boolean(row.success),
            errorMessage: row.error_message,
            riskScore: row.risk_score,
            categories: row.categories ? row.categories.split(',') : [],
            user: row.username ? {
                username: row.username,
                email: row.email
            } : null
        }));
    }

    /**
     * Get search suggestions for autocomplete
     */
    async getSearchSuggestions(field, query, limit = 10) {
        let sql;
        let params;

        switch (field) {
            case 'action':
                sql = 'SELECT DISTINCT action as value, COUNT(*) as count FROM audit_logs WHERE action LIKE ? GROUP BY action ORDER BY count DESC LIMIT ?';
                params = [`%${query}%`, limit];
                break;
            case 'resourceType':
                sql = 'SELECT DISTINCT resource_type as value, COUNT(*) as count FROM audit_logs WHERE resource_type LIKE ? GROUP BY resource_type ORDER BY count DESC LIMIT ?';
                params = [`%${query}%`, limit];
                break;
            case 'userRole':
                sql = 'SELECT DISTINCT user_role as value, COUNT(*) as count FROM audit_logs WHERE user_role LIKE ? GROUP BY user_role ORDER BY count DESC LIMIT ?';
                params = [`%${query}%`, limit];
                break;
            case 'endpoint':
                sql = 'SELECT DISTINCT endpoint as value, COUNT(*) as count FROM audit_logs WHERE endpoint LIKE ? GROUP BY endpoint ORDER BY count DESC LIMIT ?';
                params = [`%${query}%`, limit];
                break;
            case 'ipAddress':
                sql = 'SELECT DISTINCT ip_address as value, COUNT(*) as count FROM audit_logs WHERE ip_address LIKE ? GROUP BY ip_address ORDER BY count DESC LIMIT ?';
                params = [`%${query}%`, limit];
                break;
            default:
                throw new Error(`Invalid search field: ${field}`);
        }

        return await this.queryAsync(sql, params);
    }

    /**
     * Get search statistics
     */
    async getSearchStatistics(timeframe = '24h') {
        const timeConditions = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-1 day')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')"
        };

        const timeCondition = timeConditions[timeframe] || timeConditions['24h'];

        const sql = `
            SELECT 
                COUNT(*) as total_logs,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT resource_type) as unique_resource_types,
                COUNT(DISTINCT action) as unique_actions,
                COUNT(DISTINCT ip_address) as unique_ip_addresses,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(CASE WHEN success = 1 THEN 1 END) as successful_operations,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
        `;

        return await this.getAsync(sql);
    }
}

module.exports = new AuditSearchService();
