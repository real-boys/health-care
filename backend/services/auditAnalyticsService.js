const { dbConnection } = require('../database/connection');

class AuditAnalyticsService {
    constructor() {
        this.db = null;
        this.initializeDatabase();
    }

    async initializeDatabase() {
        try {
            const connection = await dbConnection.connect();
            this.db = dbConnection.getDatabase();
        } catch (error) {
            console.error('Failed to initialize audit analytics service:', error);
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
     * Advanced anomaly detection using multiple ML techniques
     */
    async detectAnomalies(timeframe = '24h', options = {}) {
        const {
            useStatisticalAnalysis = true,
            usePatternAnalysis = true,
            useBehavioralAnalysis = true,
            threshold = 2.0 // Standard deviations for statistical analysis
        } = options;

        const anomalies = [];

        // Statistical anomaly detection
        if (useStatisticalAnalysis) {
            const statisticalAnomalies = await this.detectStatisticalAnomalies(timeframe, threshold);
            anomalies.push(...statisticalAnomalies);
        }

        // Pattern-based anomaly detection
        if (usePatternAnalysis) {
            const patternAnomalies = await this.detectPatternAnomalies(timeframe);
            anomalies.push(...patternAnomalies);
        }

        // Behavioral anomaly detection
        if (useBehavioralAnalysis) {
            const behavioralAnomalies = await this.detectBehavioralAnomalies(timeframe);
            anomalies.push(...behavioralAnomalies);
        }

        // Score and rank anomalies
        const scoredAnomalies = await this.scoreAnomalies(anomalies);

        return {
            timeframe,
            detectedAt: new Date().toISOString(),
            totalAnomalies: scoredAnomalies.length,
            anomalies: scoredAnomalies.sort((a, b) => b.score - a.score),
            summary: this.generateAnomalySummary(scoredAnomalies)
        };
    }

    /**
     * Statistical anomaly detection using z-score analysis
     */
    async detectStatisticalAnomalies(timeframe, threshold = 2.0) {
        const timeCondition = this.getTimeCondition(timeframe);
        const anomalies = [];

        // Detect unusual access frequency
        const frequencyAnomalies = await this.detectFrequencyAnomalies(timeCondition, threshold);
        anomalies.push(...frequencyAnomalies);

        // Detect unusual time patterns
        const timeAnomalies = await this.detectTimePatternAnomalies(timeCondition, threshold);
        anomalies.push(...timeAnomalies);

        // Detect unusual risk score patterns
        const riskAnomalies = await this.detectRiskScoreAnomalies(timeCondition, threshold);
        anomalies.push(...riskAnomalies);

        // Detect unusual response times
        const responseTimeAnomalies = await this.detectResponseTimeAnomalies(timeCondition, threshold);
        anomalies.push(...responseTimeAnomalies);

        return anomalies;
    }

    /**
     * Detect frequency anomalies using statistical analysis
     */
    async detectFrequencyAnomalies(timeCondition, threshold) {
        const sql = `
            SELECT 
                user_id,
                action,
                resource_type,
                COUNT(*) as frequency,
                AVG(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failure_rate
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id, action, resource_type
            HAVING frequency > 0
        `;

        const activities = await this.queryAsync(sql);
        const anomalies = [];

        // Calculate baseline statistics for each action/resource type combination
        const baselines = {};
        
        for (const activity of activities) {
            const key = `${activity.action}_${activity.resource_type}`;
            if (!baselines[key]) {
                baselines[key] = [];
            }
            baselines[key].push(activity.frequency);
        }

        // Calculate mean and standard deviation for each baseline
        const stats = {};
        for (const [key, frequencies] of Object.entries(baselines)) {
            const mean = frequencies.reduce((a, b) => a + b, 0) / frequencies.length;
            const variance = frequencies.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / frequencies.length;
            const stdDev = Math.sqrt(variance);
            stats[key] = { mean, stdDev };
        }

        // Detect anomalies
        for (const activity of activities) {
            const key = `${activity.action}_${activity.resource_type}`;
            const baseline = stats[key];
            
            if (baseline && baseline.stdDev > 0) {
                const zScore = Math.abs((activity.frequency - baseline.mean) / baseline.stdDev);
                
                if (zScore > threshold) {
                    anomalies.push({
                        type: 'FREQUENCY_ANOMALY',
                        userId: activity.user_id,
                        action: activity.action,
                        resourceType: activity.resource_type,
                        frequency: activity.frequency,
                        baselineMean: baseline.mean,
                        zScore,
                        severity: this.calculateSeverity(zScore, threshold),
                        description: `Unusual frequency detected: ${activity.frequency} ${activity.action} operations on ${activity.resource_type} (baseline: ${baseline.mean.toFixed(2)})`,
                        detectedAt: new Date().toISOString()
                    });
                }
            }
        }

        return anomalies;
    }

    /**
     * Detect time pattern anomalies
     */
    async detectTimePatternAnomalies(timeCondition, threshold) {
        const sql = `
            SELECT 
                user_id,
                strftime('%H', timestamp) as hour,
                COUNT(*) as activity_count,
                AVG(risk_score) as avg_risk_score
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id, strftime('%H', timestamp)
        `;

        const timeActivities = await this.queryAsync(sql);
        const anomalies = [];

        // Group by user and analyze their time patterns
        const userPatterns = {};
        
        for (const activity of timeActivities) {
            if (!userPatterns[activity.user_id]) {
                userPatterns[activity.user_id] = [];
            }
            userPatterns[activity.user_id].push({
                hour: parseInt(activity.hour),
                count: activity.activity_count,
                avgRiskScore: activity.avg_risk_score
            });
        }

        // Detect unusual time patterns for each user
        for (const [userId, patterns] of Object.entries(userPatterns)) {
            // Check for activity during unusual hours (e.g., 2 AM - 5 AM)
            const unusualHours = patterns.filter(p => p.hour >= 2 && p.hour <= 5);
            
            if (unusualHours.length > 0) {
                const totalUnusualActivity = unusualHours.reduce((sum, p) => sum + p.count, 0);
                const totalActivity = patterns.reduce((sum, p) => sum + p.count, 0);
                const unusualRatio = totalUnusualActivity / totalActivity;

                if (unusualRatio > 0.1) { // More than 10% activity during unusual hours
                    anomalies.push({
                        type: 'TIME_PATTERN_ANOMALY',
                        userId,
                        unusualHours: unusualHours.map(p => p.hour),
                        unusualActivityCount: totalUnusualActivity,
                        totalActivityCount: totalActivity,
                        unusualRatio,
                        severity: unusualRatio > 0.3 ? 'HIGH' : 'MEDIUM',
                        description: `Unusual time pattern detected: ${Math.round(unusualRatio * 100)}% of activity during unusual hours (2 AM - 5 AM)`,
                        detectedAt: new Date().toISOString()
                    });
                }
            }
        }

        return anomalies;
    }

    /**
     * Detect risk score anomalies
     */
    async detectRiskScoreAnomalies(timeCondition, threshold) {
        const sql = `
            SELECT 
                user_id,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(*) as total_operations,
                COUNT(CASE WHEN risk_score >= 70 THEN 1 END) as high_risk_operations
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id
        `;

        const riskProfiles = await this.queryAsync(sql);
        const anomalies = [];

        // Calculate baseline risk statistics
        const avgRiskScores = riskProfiles.map(p => p.avg_risk_score);
        const meanRiskScore = avgRiskScores.reduce((a, b) => a + b, 0) / avgRiskScores.length;
        const riskVariance = avgRiskScores.reduce((a, b) => a + Math.pow(b - meanRiskScore, 2), 0) / avgRiskScores.length;
        const riskStdDev = Math.sqrt(riskVariance);

        for (const profile of riskProfiles) {
            const zScore = Math.abs((profile.avg_risk_score - meanRiskScore) / riskStdDev);
            
            if (zScore > threshold && profile.avg_risk_score > 50) {
                anomalies.push({
                    type: 'RISK_SCORE_ANOMALY',
                    userId: profile.user_id,
                    avgRiskScore: profile.avg_risk_score,
                    maxRiskScore: profile.max_risk_score,
                    highRiskOperations: profile.high_risk_operations,
                    totalOperations: profile.total_operations,
                    baselineMean: meanRiskScore,
                    zScore,
                    severity: profile.avg_risk_score > 70 ? 'HIGH' : 'MEDIUM',
                    description: `Elevated risk profile detected: average risk score of ${profile.avg_risk_score.toFixed(2)} (baseline: ${meanRiskScore.toFixed(2)})`,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        return anomalies;
    }

    /**
     * Detect response time anomalies
     */
    async detectResponseTimeAnomalies(timeCondition, threshold) {
        const sql = `
            SELECT 
                endpoint,
                method,
                AVG(CAST(JSON_EXTRACT(metadata, '$.duration') AS REAL)) as avg_response_time,
                COUNT(*) as request_count
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            AND JSON_EXTRACT(metadata, '$.duration') IS NOT NULL
            GROUP BY endpoint, method
            HAVING request_count >= 5
        `;

        const responseTimes = await this.queryAsync(sql);
        const anomalies = [];

        // Calculate baseline response times
        const avgTimes = responseTimes.map(rt => rt.avg_response_time).filter(t => t > 0);
        const meanTime = avgTimes.reduce((a, b) => a + b, 0) / avgTimes.length;
        const timeVariance = avgTimes.reduce((a, b) => a + Math.pow(b - meanTime, 2), 0) / avgTimes.length;
        const timeStdDev = Math.sqrt(timeVariance);

        for (const rt of responseTimes) {
            if (rt.avg_response_time > 0) {
                const zScore = Math.abs((rt.avg_response_time - meanTime) / timeStdDev);
                
                if (zScore > threshold && rt.avg_response_time > meanTime * 2) {
                    anomalies.push({
                        type: 'RESPONSE_TIME_ANOMALY',
                        endpoint: rt.endpoint,
                        method: rt.method,
                        avgResponseTime: rt.avg_response_time,
                        requestCount: rt.request_count,
                        baselineMean: meanTime,
                        zScore,
                        severity: rt.avg_response_time > meanTime * 3 ? 'HIGH' : 'MEDIUM',
                        description: `Slow response time detected: ${rt.avg_response_time.toFixed(2)}ms average for ${rt.method} ${rt.endpoint} (baseline: ${meanTime.toFixed(2)}ms)`,
                        detectedAt: new Date().toISOString()
                    });
                }
            }
        }

        return anomalies;
    }

    /**
     * Pattern-based anomaly detection
     */
    async detectPatternAnomalies(timeframe) {
        const timeCondition = this.getTimeCondition(timeframe);
        const anomalies = [];

        // Detect sequential operations that suggest automated attacks
        const sequentialAnomalies = await this.detectSequentialAnomalies(timeCondition);
        anomalies.push(...sequentialAnomalies);

        // Detect unusual access patterns
        const accessPatternAnomalies = await this.detectAccessPatternAnomalies(timeCondition);
        anomalies.push(...accessPatternAnomalies);

        // Detect data exfiltration patterns
        const exfiltrationAnomalies = await this.detectExfiltrationPatterns(timeCondition);
        anomalies.push(...exfiltrationAnomalies);

        return anomalies;
    }

    /**
     * Detect sequential operations that may indicate automated attacks
     */
    async detectSequentialAnomalies(timeCondition) {
        const sql = `
            SELECT 
                user_id,
                ip_address,
                timestamp,
                action,
                resource_type,
                LAG(timestamp) OVER (PARTITION BY user_id, ip_address ORDER BY timestamp) as prev_timestamp
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            ORDER BY user_id, ip_address, timestamp
        `;

        const operations = await this.queryAsync(sql);
        const anomalies = [];

        // Group by user and IP to detect rapid sequential operations
        const userIPOperations = {};
        
        for (const op of operations) {
            const key = `${op.user_id}_${op.ip_address}`;
            if (!userIPOperations[key]) {
                userIPOperations[key] = [];
            }
            userIPOperations[key].push(op);
        }

        for (const [key, ops] of Object.entries(userIPOperations)) {
            // Check for very rapid operations (less than 1 second apart)
            let rapidSequenceCount = 0;
            let maxRapidSequence = 0;
            
            for (let i = 1; i < ops.length; i++) {
                const timeDiff = new Date(ops[i].timestamp) - new Date(ops[i-1].timestamp);
                
                if (timeDiff < 1000) { // Less than 1 second
                    rapidSequenceCount++;
                    maxRapidSequence = Math.max(maxRapidSequence, rapidSequenceCount);
                } else {
                    rapidSequenceCount = 0;
                }
            }

            if (maxRapidSequence > 10) { // More than 10 rapid operations in sequence
                anomalies.push({
                    type: 'SEQUENTIAL_ANOMALY',
                    userId: ops[0].user_id,
                    ipAddress: ops[0].ip_address,
                    maxRapidSequence,
                    totalOperations: ops.length,
                    severity: maxRapidSequence > 50 ? 'HIGH' : 'MEDIUM',
                    description: `Rapid sequential operations detected: ${maxRapidSequence} operations in less than 1 second intervals`,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        return anomalies;
    }

    /**
     * Detect unusual access patterns
     */
    async detectAccessPatternAnomalies(timeCondition) {
        const sql = `
            SELECT 
                user_id,
                resource_type,
                COUNT(DISTINCT resource_id) as unique_resources_accessed,
                COUNT(*) as total_access_events,
                COUNT(DISTINCT ip_address) as unique_ip_addresses
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            AND action IN ('READ', 'EXPORT', 'DOWNLOAD')
            GROUP BY user_id, resource_type
        `;

        const accessPatterns = await this.queryAsync(sql);
        const anomalies = [];

        for (const pattern of accessPatterns) {
            // Check for unusual breadth of access
            if (pattern.unique_resources_accessed > 100 && pattern.total_access_events < 200) {
                anomalies.push({
                    type: 'ACCESS_PATTERN_ANOMALY',
                    userId: pattern.user_id,
                    resourceType: pattern.resource_type,
                    uniqueResourcesAccessed: pattern.unique_resources_accessed,
                    totalAccessEvents: pattern.total_access_events,
                    uniqueIPAddresses: pattern.unique_ip_addresses,
                    severity: pattern.unique_resources_accessed > 500 ? 'HIGH' : 'MEDIUM',
                    description: `Unusual access pattern: accessing ${pattern.unique_resources_accessed} different ${pattern.resourceType} resources in only ${pattern.total_access_events} operations`,
                    detectedAt: new Date().toISOString()
                });
            }

            // Check for access from multiple IPs
            if (pattern.unique_ip_addresses > 3 && pattern.total_access_events < 50) {
                anomalies.push({
                    type: 'MULTI_IP_ACCESS_ANOMALY',
                    userId: pattern.user_id,
                    resourceType: pattern.resource_type,
                    uniqueIPAddresses: pattern.unique_ip_addresses,
                    totalAccessEvents: pattern.total_access_events,
                    severity: pattern.unique_ip_addresses > 5 ? 'HIGH' : 'MEDIUM',
                    description: `Access from ${pattern.unique_ip_addresses} different IP addresses in ${pattern.total_access_events} operations`,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        return anomalies;
    }

    /**
     * Detect potential data exfiltration patterns
     */
    async detectExfiltrationPatterns(timeCondition) {
        const sql = `
            SELECT 
                user_id,
                COUNT(CASE WHEN action = 'EXPORT' THEN 1 END) as export_operations,
                COUNT(CASE WHEN action = 'DOWNLOAD' THEN 1 END) as download_operations,
                COUNT(CASE WHEN action = 'READ' THEN 1 END) as read_operations,
                SUM(CASE WHEN action = 'EXPORT' THEN CAST(JSON_EXTRACT(metadata, '$.record_count') AS INTEGER) ELSE 0 END) as total_exported_records
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            AND resource_type IN ('PATIENT', 'MEDICAL_RECORD', 'SENSITIVE_DATA')
            GROUP BY user_id
        `;

        const exfiltrationPatterns = await this.queryAsync(sql);
        const anomalies = [];

        for (const pattern of exfiltrationPatterns) {
            // Check for high volume exports
            if (pattern.total_exported_records > 1000) {
                anomalies.push({
                    type: 'EXFILTRATION_ANOMALY',
                    userId: pattern.user_id,
                    exportOperations: pattern.export_operations,
                    downloadOperations: pattern.download_operations,
                    readOperations: pattern.read_operations,
                    totalExportedRecords: pattern.total_exported_records,
                    severity: pattern.total_exported_records > 10000 ? 'HIGH' : 'MEDIUM',
                    description: `High volume data export detected: ${pattern.total_exported_records} records exported by user`,
                    detectedAt: new Date().toISOString()
                });
            }

            // Check for export to read ratio
            const exportToReadRatio = pattern.export_operations / (pattern.read_operations || 1);
            if (exportToReadRatio > 0.5 && pattern.export_operations > 10) {
                anomalies.push({
                    type: 'EXPORT_PATTERN_ANOMALY',
                    userId: pattern.user_id,
                    exportOperations: pattern.export_operations,
                    readOperations: pattern.read_operations,
                    exportToReadRatio,
                    severity: exportToReadRatio > 0.8 ? 'HIGH' : 'MEDIUM',
                    description: `Unusual export pattern: ${pattern.export_operations} exports vs ${pattern.read_operations} reads (ratio: ${exportToReadRatio.toFixed(2)})`,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        return anomalies;
    }

    /**
     * Behavioral anomaly detection
     */
    async detectBehavioralAnomalies(timeframe) {
        const timeCondition = this.getTimeCondition(timeframe);
        const anomalies = [];

        // Detect role-based anomalies
        const roleAnomalies = await this.detectRoleBasedAnomalies(timeCondition);
        anomalies.push(...roleAnomalies);

        // Detect geographic anomalies
        const geographicAnomalies = await this.detectGeographicAnomalies(timeCondition);
        anomalies.push(...geographicAnomalies);

        // Detect device anomalies
        const deviceAnomalies = await this.detectDeviceAnomalies(timeCondition);
        anomalies.push(...deviceAnomalies);

        return anomalies;
    }

    /**
     * Detect role-based behavioral anomalies
     */
    async detectRoleBasedAnomalies(timeCondition) {
        const sql = `
            SELECT 
                user_id,
                user_role,
                action,
                resource_type,
                COUNT(*) as operation_count
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id, user_role, action, resource_type
        `;

        const roleBehaviors = await this.queryAsync(sql);
        const anomalies = [];

        // Define expected behaviors for each role
        const expectedBehaviors = {
            'ADMIN': ['CREATE', 'UPDATE', 'DELETE', 'READ'],
            'DOCTOR': ['READ', 'UPDATE'],
            'NURSE': ['READ', 'UPDATE'],
            'RECEPTIONIST': ['READ', 'CREATE'],
            'PATIENT': ['READ']
        };

        // Group by user and role
        const userRoleBehaviors = {};
        for (const behavior of roleBehaviors) {
            const key = `${behavior.user_id}_${behavior.user_role}`;
            if (!userRoleBehaviors[key]) {
                userRoleBehaviors[key] = {
                    userId: behavior.user_id,
                    userRole: behavior.user_role,
                    actions: []
                };
            }
            userRoleBehaviors[key].actions.push({
                action: behavior.action,
                resourceType: behavior.resource_type,
                count: behavior.operation_count
            });
        }

        // Check for unexpected behaviors
        for (const [key, userBehavior] of Object.entries(userRoleBehaviors)) {
            const expectedActions = expectedBehaviors[userBehavior.userRole] || [];
            
            for (const action of userBehavior.actions) {
                if (!expectedActions.includes(action.action)) {
                    anomalies.push({
                        type: 'ROLE_BEHAVIOR_ANOMALY',
                        userId: userBehavior.userId,
                        userRole: userBehavior.userRole,
                        unexpectedAction: action.action,
                        resourceType: action.resourceType,
                        operationCount: action.count,
                        severity: 'MEDIUM',
                        description: `Unexpected action '${action.action}' performed by user with role '${userBehavior.userRole}' on ${action.resourceType}`,
                        detectedAt: new Date().toISOString()
                    });
                }
            }
        }

        return anomalies;
    }

    /**
     * Detect geographic anomalies based on IP addresses
     */
    async detectGeographicAnomalies(timeCondition) {
        const sql = `
            SELECT 
                user_id,
                ip_address,
                COUNT(*) as access_count,
                MIN(timestamp) as first_access,
                MAX(timestamp) as last_access
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id, ip_address
        `;

        const geographicPatterns = await this.queryAsync(sql);
        const anomalies = [];

        // Group by user
        const userGeographicPatterns = {};
        for (const pattern of geographicPatterns) {
            if (!userGeographicPatterns[pattern.user_id]) {
                userGeographicPatterns[pattern.user_id] = [];
            }
            userGeographicPatterns[pattern.user_id].push(pattern);
        }

        // Check for simultaneous access from different locations
        for (const [userId, patterns] of Object.entries(userGeographicPatterns)) {
            if (patterns.length > 1) {
                // Check if any access patterns overlap in time from different IPs
                for (let i = 0; i < patterns.length; i++) {
                    for (let j = i + 1; j < patterns.length; j++) {
                        const pattern1 = patterns[i];
                        const pattern2 = patterns[j];
                        
                        // Simple check: if first access from one IP and last access from another IP are close
                        const timeDiff = Math.abs(new Date(pattern1.last_access) - new Date(pattern2.first_access));
                        
                        if (timeDiff < 5 * 60 * 1000) { // 5 minutes
                            anomalies.push({
                                type: 'GEOGRAPHIC_ANOMALY',
                                userId,
                                ipAddress1: pattern1.ip_address,
                                ipAddress2: pattern2.ip_address,
                                timeDifference: timeDiff,
                                severity: 'HIGH',
                                description: `Simultaneous access from different IP addresses detected: ${pattern1.ip_address} and ${pattern2.ip_address}`,
                                detectedAt: new Date().toISOString()
                            });
                        }
                    }
                }
            }
        }

        return anomalies;
    }

    /**
     * Detect device anomalies
     */
    async detectDeviceAnomalies(timeCondition) {
        const sql = `
            SELECT 
                user_id,
                user_agent,
                COUNT(*) as access_count
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            AND user_agent IS NOT NULL
            GROUP BY user_id, user_agent
        `;

        const devicePatterns = await this.queryAsync(sql);
        const anomalies = [];

        // Group by user
        const userDevicePatterns = {};
        for (const pattern of devicePatterns) {
            if (!userDevicePatterns[pattern.user_id]) {
                userDevicePatterns[pattern.user_id] = [];
            }
            userDevicePatterns[pattern.user_id].push(pattern);
        }

        // Check for users with many different devices
        for (const [userId, patterns] of Object.entries(userDevicePatterns)) {
            if (patterns.length > 5) { // More than 5 different user agents
                const totalAccess = patterns.reduce((sum, p) => sum + p.access_count, 0);
                
                anomalies.push({
                    type: 'DEVICE_ANOMALY',
                    userId,
                    deviceCount: patterns.length,
                    totalAccess,
                    severity: patterns.length > 10 ? 'HIGH' : 'MEDIUM',
                    description: `Access from ${patterns.length} different devices detected for user`,
                    detectedAt: new Date().toISOString()
                });
            }
        }

        return anomalies;
    }

    /**
     * Score and rank anomalies
     */
    async scoreAnomalies(anomalies) {
        return anomalies.map(anomaly => {
            let score = 0;

            // Base score by severity
            switch (anomaly.severity) {
                case 'CRITICAL': score += 100; break;
                case 'HIGH': score += 75; break;
                case 'MEDIUM': score += 50; break;
                case 'LOW': score += 25; break;
            }

            // Add score based on z-score if available
            if (anomaly.zScore) {
                score += Math.min(anomaly.zScore * 10, 50);
            }

            // Add score based on anomaly type
            switch (anomaly.type) {
                case 'EXFILTRATION_ANOMALY': score += 30; break;
                case 'GEOGRAPHIC_ANOMALY': score += 25; break;
                case 'SEQUENTIAL_ANOMALY': score += 20; break;
                case 'ROLE_BEHAVIOR_ANOMALY': score += 15; break;
            }

            return {
                ...anomaly,
                score: Math.min(score, 100) // Cap at 100
            };
        });
    }

    /**
     * Generate anomaly summary
     */
    generateAnomalySummary(anomalies) {
        const summary = {
            byType: {},
            bySeverity: { LOW: 0, MEDIUM: 0, HIGH: 0, CRITICAL: 0 },
            totalScore: 0,
            averageScore: 0
        };

        for (const anomaly of anomalies) {
            // Count by type
            if (!summary.byType[anomaly.type]) {
                summary.byType[anomaly.type] = 0;
            }
            summary.byType[anomaly.type]++;

            // Count by severity
            summary.bySeverity[anomaly.severity]++;

            // Sum scores
            summary.totalScore += anomaly.score;
        }

        summary.averageScore = anomalies.length > 0 ? summary.totalScore / anomalies.length : 0;

        return summary;
    }

    /**
     * Get time condition for SQL queries
     */
    getTimeCondition(timeframe) {
        const timeConditions = {
            '1h': "datetime('now', '-1 hour')",
            '24h': "datetime('now', '-1 day')",
            '7d': "datetime('now', '-7 days')",
            '30d': "datetime('now', '-30 days')",
            '90d': "datetime('now', '-90 days')"
        };

        return timeConditions[timeframe] || timeConditions['24h'];
    }

    /**
     * Calculate severity based on z-score
     */
    calculateSeverity(zScore, threshold) {
        if (zScore > threshold * 2) return 'HIGH';
        if (zScore > threshold * 1.5) return 'MEDIUM';
        return 'LOW';
    }

    /**
     * Get analytics dashboard data
     */
    async getAnalyticsDashboard(timeframe = '24h') {
        const [overview, anomalies, trends, topUsers, topResources] = await Promise.all([
            this.getOverviewStats(timeframe),
            this.detectAnomalies(timeframe),
            this.getTrends(timeframe),
            this.getTopUsers(timeframe),
            this.getTopResources(timeframe)
        ]);

        return {
            timeframe,
            generatedAt: new Date().toISOString(),
            overview,
            anomalies,
            trends,
            topUsers,
            topResources
        };
    }

    /**
     * Get overview statistics
     */
    async getOverviewStats(timeframe) {
        const timeCondition = this.getTimeCondition(timeframe);
        
        const sql = `
            SELECT 
                COUNT(*) as total_operations,
                COUNT(DISTINCT user_id) as unique_users,
                COUNT(DISTINCT resource_type) as unique_resource_types,
                AVG(risk_score) as avg_risk_score,
                MAX(risk_score) as max_risk_score,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations,
                COUNT(CASE WHEN risk_score >= 70 THEN 1 END) as high_risk_operations
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
        `;

        return await this.getAsync(sql);
    }

    /**
     * Get trends over time
     */
    async getTrends(timeframe) {
        const timeCondition = this.getTimeCondition(timeframe);
        
        const sql = `
            SELECT 
                DATE(timestamp) as date,
                COUNT(*) as operations,
                AVG(risk_score) as avg_risk_score,
                COUNT(CASE WHEN success = 0 THEN 1 END) as failed_operations
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY DATE(timestamp)
            ORDER BY date ASC
        `;

        return await this.queryAsync(sql);
    }

    /**
     * Get top users by activity
     */
    async getTopUsers(timeframe, limit = 10) {
        const timeCondition = this.getTimeCondition(timeframe);
        
        const sql = `
            SELECT 
                user_id,
                COUNT(*) as activity_count,
                AVG(risk_score) as avg_risk_score,
                COUNT(DISTINCT resource_type) as resource_types
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY user_id
            ORDER BY activity_count DESC
            LIMIT ?
        `;

        return await this.queryAsync(sql, [limit]);
    }

    /**
     * Get top resources by access
     */
    async getTopResources(timeframe, limit = 10) {
        const timeCondition = this.getTimeCondition(timeframe);
        
        const sql = `
            SELECT 
                resource_type,
                COUNT(*) as access_count,
                COUNT(DISTINCT user_id) as unique_users,
                AVG(risk_score) as avg_risk_score
            FROM audit_logs 
            WHERE timestamp >= ${timeCondition}
            GROUP BY resource_type
            ORDER BY access_count DESC
            LIMIT ?
        `;

        return await this.queryAsync(sql, [limit]);
    }
}

module.exports = new AuditAnalyticsService();
