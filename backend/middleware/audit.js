const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const { dbConnection } = require('../database/connection');

class AuditMiddleware {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            const { dbConnection } = require('../database/connection');
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
            
            // Load audit schema
            const fs = require('fs');
            const path = require('path');
            const schemaPath = path.join(__dirname, '..', 'database', 'audit-schema.sql');
            const schema = fs.readFileSync(schemaPath, 'utf8');
            
            // Execute schema in batches
            const statements = schema.split(';').filter(stmt => stmt.trim());
            for (const statement of statements) {
                if (statement.trim()) {
                    await this.execAsync(statement);
                }
            }
            
            console.log('Audit database initialized successfully');
        } catch (error) {
            console.error('Failed to initialize audit database:', error);
        }
    }

    execAsync(sql) {
        return new Promise((resolve, reject) => {
            this.db.run(sql, function(err) {
                if (err) reject(err);
                else resolve(this);
            });
        });
    }

    // Calculate risk score based on various factors
    calculateRiskScore(req, action, resourceType) {
        let score = 0;

        // Base scores by action type
        const actionScores = {
            'CREATE': 20,
            'READ': 10,
            'UPDATE': 30,
            'DELETE': 80,
            'EXPORT': 90,
            'LOGIN': 5,
            'LOGOUT': 5,
            'ADMIN': 70
        };

        // Base scores by resource type
        const resourceScores = {
            'PATIENT': 75,
            'MEDICAL_RECORD': 85,
            'USER': 50,
            'SYSTEM': 30,
            'CONFIGURATION': 60,
            'SENSITIVE_DATA': 95
        };

        score += actionScores[action] || 20;
        score += resourceScores[resourceType] || 10;

        // Time-based risk (after hours)
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) {
            score += 25;
        }

        // IP-based risk (if from external network)
        const clientIP = this.getClientIP(req);
        if (this.isExternalIP(clientIP)) {
            score += 15;
        }

        // Volume-based risk (bulk operations)
        if (req.body && Object.keys(req.body).length > 50) {
            score += 20;
        }

        return Math.min(score, 100);
    }

    getClientIP(req) {
        return req.ip || 
               req.connection.remoteAddress || 
               req.socket.remoteAddress ||
               (req.connection.socket ? req.connection.socket.remoteAddress : null) ||
               'unknown';
    }

    isExternalIP(ip) {
        // Simple check for external IPs
        return ip !== 'unknown' && 
               !ip.startsWith('127.') && 
               !ip.startsWith('192.168.') && 
               !ip.startsWith('10.') &&
               !ip.startsWith('172.');
    }

    // Sanitize data for logging (remove sensitive information)
    sanitizeData(data) {
        if (!data) return null;
        
        const sensitiveFields = [
            'password', 'token', 'secret', 'key', 'ssn', 
            'credit_card', 'bank_account', 'medical_record_number'
        ];

        const sanitized = JSON.parse(JSON.stringify(data));
        
        const removeSensitive = (obj) => {
            for (const key in obj) {
                if (typeof obj[key] === 'object' && obj[key] !== null) {
                    removeSensitive(obj[key]);
                } else if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
                    obj[key] = '[REDACTED]';
                }
            }
        };

        removeSensitive(sanitized);
        return JSON.stringify(sanitized);
    }

    // Get previous hash for blockchain-like immutability
    async getPreviousHash() {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT hash FROM audit_logs ORDER BY created_at DESC LIMIT 1',
                (err, row) => {
                    if (err) reject(err);
                    else resolve(row ? row.hash : null);
                }
            );
        });
    }

    // Create cryptographic hash for integrity verification
    async createHash(logData) {
        const dataString = JSON.stringify(logData);
        return crypto.createHash('sha256').update(dataString).digest('hex');
    }

    // Determine compliance flags
    getComplianceFlags(req, action, resourceType) {
        const flags = [];

        // HIPAA flags
        if (['PATIENT', 'MEDICAL_RECORD'].includes(resourceType)) {
            flags.push('HIPAA_PROTECTED_HEALTH_INFO');
        }

        // GDPR flags
        if (resourceType === 'PATIENT' && ['CREATE', 'UPDATE', 'DELETE', 'EXPORT'].includes(action)) {
            flags.push('GDPR_PERSONAL_DATA');
        }

        // SOX flags
        if (['USER', 'SYSTEM', 'CONFIGURATION'].includes(resourceType)) {
            flags.push('SOX_FINANCIAL_SYSTEM');
        }

        // After hours flag
        const hour = new Date().getHours();
        if (hour < 6 || hour > 22) {
            flags.push('AFTER_HOURS_ACCESS');
        }

        // High volume flag
        if (req.body && Object.keys(req.body).length > 100) {
            flags.push('HIGH_VOLUME_OPERATION');
        }

        return flags;
    }

    // Main audit logging middleware
    audit() {
        return async (req, res, next) => {
            const startTime = Date.now();
            const correlationId = req.headers['x-correlation-id'] || uuidv4();
            
            // Store original res.json to intercept response
            const originalJson = res.json;
            const originalSend = res.send;
            let responseData = null;
            let statusCode = 200;

            res.json = function(data) {
                responseData = data;
                statusCode = res.statusCode;
                return originalJson.call(this, data);
            };

            res.send = function(data) {
                responseData = data;
                statusCode = res.statusCode;
                return originalSend.call(this, data);
            };

            // Continue with the request
            res.on('finish', async () => {
                try {
                    await this.logAuditEvent(req, res, startTime, correlationId, responseData, statusCode);
                } catch (error) {
                    console.error('Failed to log audit event:', error);
                }
            });

            next();
        };
    }

    // Log the audit event
    async logAuditEvent(req, res, startTime, correlationId, responseData, statusCode) {
        if (!this.db) return;

        try {
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Extract relevant information
            const user = req.user || { id: 'anonymous', role: 'anonymous' };
            const action = this.determineAction(req.method, req.path);
            const resourceType = this.determineResourceType(req.path);
            const resourceId = this.extractResourceId(req);
            const resourceName = this.extractResourceName(req, resourceId);

            // Calculate metrics
            const riskScore = this.calculateRiskScore(req, action, resourceType);
            const complianceFlags = this.getComplianceFlags(req, action, resourceType);
            const success = statusCode >= 200 && statusCode < 400;

            // Get previous hash for immutability
            const previousHash = await this.getPreviousHash();

            // Create audit log entry
            const auditData = {
                id: uuidv4(),
                timestamp: new Date().toISOString(),
                user_id: user.id,
                user_role: user.role || 'unknown',
                action,
                resource_type: resourceType,
                resource_id: resourceId,
                resource_name: resourceName,
                endpoint: req.path,
                method: req.method,
                ip_address: this.getClientIP(req),
                user_agent: req.get('User-Agent') || 'unknown',
                request_data: this.sanitizeData(req.body),
                response_data: this.sanitizeData(responseData),
                status_code: statusCode,
                success,
                error_message: success ? null : (responseData?.message || 'Request failed'),
                session_id: req.sessionID || null,
                correlation_id: correlationId,
                compliance_flags: JSON.stringify(complianceFlags),
                risk_score: riskScore,
                metadata: JSON.stringify({
                    duration,
                    request_size: JSON.stringify(req.body).length,
                    response_size: JSON.stringify(responseData).length,
                    headers: this.sanitizeHeaders(req.headers)
                }),
                previous_hash: previousHash
            };

            // Create cryptographic hash
            auditData.hash = await this.createHash(auditData);

            // Insert into database
            await this.insertAuditLog(auditData);

            // Check for real-time alerts
            if (riskScore >= 70 || !success) {
                this.triggerRealTimeAlert(auditData);
            }

            // Emit to WebSocket for real-time monitoring
            if (req.io) {
                req.io.emit('audit_event', {
                    type: riskScore >= 70 ? 'high_risk' : 'normal',
                    data: auditData
                });
            }

        } catch (error) {
            console.error('Audit logging error:', error);
        }
    }

    async insertAuditLog(auditData) {
        return new Promise((resolve, reject) => {
            const sql = `
                INSERT INTO audit_logs (
                    id, timestamp, user_id, user_role, action, resource_type,
                    resource_id, resource_name, endpoint, method, ip_address,
                    user_agent, request_data, response_data, status_code, success,
                    error_message, session_id, correlation_id, compliance_flags,
                    risk_score, metadata, hash, previous_hash, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            `;

            const values = [
                auditData.id, auditData.timestamp, auditData.user_id, auditData.user_role,
                auditData.action, auditData.resource_type, auditData.resource_id,
                auditData.resource_name, auditData.endpoint, auditData.method,
                auditData.ip_address, auditData.user_agent, auditData.request_data,
                auditData.response_data, auditData.status_code, auditData.success,
                auditData.error_message, auditData.session_id, auditData.correlation_id,
                auditData.compliance_flags, auditData.risk_score, auditData.metadata,
                auditData.hash, auditData.previous_hash
            ];

            this.db.run(sql, values, function(err) {
                if (err) reject(err);
                else resolve(this.lastID);
            });
        });
    }

    triggerRealTimeAlert(auditData) {
        // Emit alert for real-time monitoring
        if (auditData.io) {
            auditData.io.emit('security_alert', {
                type: 'HIGH_RISK_OPERATION',
                severity: auditData.risk_score >= 90 ? 'CRITICAL' : 'HIGH',
                data: {
                    user_id: auditData.user_id,
                    action: auditData.action,
                    resource_type: auditData.resource_type,
                    risk_score: auditData.risk_score,
                    timestamp: auditData.timestamp,
                    ip_address: auditData.ip_address
                }
            });
        }

        console.warn(`HIGH RISK AUDIT EVENT: User ${auditData.user_id} performed ${auditData.action} on ${auditData.resource_type} with risk score ${auditData.risk_score}`);
    }

    determineAction(method, path) {
        if (path.includes('/auth/login')) return 'LOGIN';
        if (path.includes('/auth/logout')) return 'LOGOUT';
        if (path.includes('/export')) return 'EXPORT';
        if (path.includes('/admin')) return 'ADMIN';

        const actionMap = {
            'GET': 'READ',
            'POST': 'CREATE',
            'PUT': 'UPDATE',
            'PATCH': 'UPDATE',
            'DELETE': 'DELETE'
        };

        return actionMap[method] || 'UNKNOWN';
    }

    determineResourceType(path) {
        if (path.includes('/patients')) return 'PATIENT';
        if (path.includes('/medical-records')) return 'MEDICAL_RECORD';
        if (path.includes('/users')) return 'USER';
        if (path.includes('/auth')) return 'AUTHENTICATION';
        if (path.includes('/admin')) return 'SYSTEM';
        if (path.includes('/config')) return 'CONFIGURATION';
        if (path.includes('/hl7-fhir')) return 'HEALTH_DATA';
        
        return 'UNKNOWN';
    }

    extractResourceId(req) {
        // Extract ID from URL parameters or request body
        if (req.params && req.params.id) return req.params.id;
        if (req.body && req.body.id) return req.body.id;
        if (req.query && req.query.id) return req.query.id;
        
        // For patient records
        if (req.params && req.params.patientId) return req.params.patientId;
        if (req.body && req.body.patientId) return req.body.patientId;
        
        return null;
    }

    extractResourceName(req, resourceId) {
        // Try to get a human-readable name
        if (req.body && req.body.name) return req.body.name;
        if (req.body && req.body.firstName && req.body.lastName) {
            return `${req.body.firstName} ${req.body.lastName}`;
        }
        
        return resourceId || 'Unknown';
    }

    sanitizeHeaders(headers) {
        const sanitized = {};
        const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key'];
        
        for (const [key, value] of Object.entries(headers)) {
            if (sensitiveHeaders.includes(key.toLowerCase())) {
                sanitized[key] = '[REDACTED]';
            } else {
                sanitized[key] = value;
            }
        }
        
        return sanitized;
    }
}

// Create singleton instance
const auditMiddleware = new AuditMiddleware();

module.exports = { auditMiddleware };
