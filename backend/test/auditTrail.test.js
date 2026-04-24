const request = require('supertest');
const path = require('path');
const fs = require('fs').promises;

// Import audit services
const enhancedAuditService = require('../services/enhancedAuditService');
const auditIntegrityService = require('../services/auditIntegrityService');
const auditSearchService = require('../services/auditSearchService');
const auditReportingService = require('../services/auditReportingService');
const auditRetentionService = require('../services/auditRetentionService');
const auditAnalyticsService = require('../services/auditAnalyticsService');
const externalAuditIntegrationService = require('../services/externalAuditIntegrationService');

// Mock database connection
jest.mock('../database/connection', () => ({
    dbConnection: {
        connect: jest.fn().mockResolvedValue({
            getDatabase: jest.fn().mockReturnValue({
                all: jest.fn(),
                get: jest.fn(),
                run: jest.fn()
            })
        })
    }
}));

describe('Audit Trail System', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('Enhanced Audit Service', () => {
        describe('createAuditLog', () => {
            it('should create an audit log successfully', async () => {
                const mockLogData = {
                    userId: 'user123',
                    userRole: 'DOCTOR',
                    action: 'READ',
                    resourceType: 'PATIENT',
                    resourceId: 'patient456',
                    resourceName: 'John Doe',
                    endpoint: '/api/patients/patient456',
                    method: 'GET',
                    ipAddress: '192.168.1.100',
                    userAgent: 'Mozilla/5.0...',
                    statusCode: 200,
                    success: true,
                    riskScore: 25,
                    correlationId: 'corr-789',
                    categories: ['PATIENT_ACCESS']
                };

                const mockDb = {
                    getAsync: jest.fn().mockResolvedValue({ hash: 'prev-hash' }),
                    runAsync: jest.fn().mockResolvedValue({ lastID: 1 }),
                    queryAsync: jest.fn().mockResolvedValue([])
                };

                enhancedAuditService.db = mockDb;

                const result = await enhancedAuditService.createAuditLog(mockLogData);

                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('hash');
                expect(result).toHaveProperty('signature');
                expect(result).toHaveProperty('violations');
                expect(result).toHaveProperty('timestamp');
                expect(mockDb.runAsync).toHaveBeenCalled();
            });

            it('should handle missing required fields', async () => {
                const invalidLogData = {
                    userId: 'user123'
                    // Missing required fields
                };

                const mockDb = {
                    getAsync: jest.fn().mockResolvedValue({ hash: 'prev-hash' }),
                    runAsync: jest.fn().mockRejectedValue(new Error('NOT NULL constraint failed'))
                };

                enhancedAuditService.db = mockDb;

                await expect(enhancedAuditService.createAuditLog(invalidLogData))
                    .rejects.toThrow();
            });
        });

        describe('verifyLogIntegrity', () => {
            it('should verify log integrity successfully', async () => {
                const mockLog = {
                    id: 'log123',
                    timestamp: '2023-01-01T00:00:00Z',
                    user_id: 'user123',
                    user_role: 'DOCTOR',
                    action: 'READ',
                    resource_type: 'PATIENT',
                    resource_id: 'patient456',
                    resource_name: 'John Doe',
                    endpoint: '/api/patients/patient456',
                    method: 'GET',
                    ip_address: '192.168.1.100',
                    user_agent: 'Mozilla/5.0...',
                    status_code: 200,
                    success: 1,
                    error_message: null,
                    session_id: 'session123',
                    correlation_id: 'corr-789',
                    compliance_flags: '["HIPAA"]',
                    risk_score: 25,
                    metadata: '{}',
                    hash: 'valid-hash',
                    previous_hash: 'prev-hash'
                };

                const mockDb = {
                    getAsync: jest.fn().mockResolvedValue(mockLog)
                };

                auditIntegrityService.db = mockDb;

                const result = await auditIntegrityService.verifySingleLog('log123');

                expect(result).toHaveProperty('logId');
                expect(result).toHaveProperty('hashValid');
                expect(result).toHaveProperty('expectedHash');
                expect(result).toHaveProperty('actualHash');
                expect(result).toHaveProperty('verificationTime');
            });

            it('should handle non-existent log', async () => {
                const mockDb = {
                    getAsync: jest.fn().mockResolvedValue(null)
                };

                auditIntegrityService.db = mockDb;

                await expect(auditIntegrityService.verifySingleLog('nonexistent'))
                    .rejects.toThrow('Audit log with ID nonexistent not found');
            });
        });
    });

    describe('Audit Search Service', () => {
        describe('searchAuditLogs', () => {
            it('should search audit logs with filters', async () => {
                const mockSearchParams = {
                    userId: 'user123',
                    action: 'READ',
                    resourceType: 'PATIENT',
                    startDate: new Date('2023-01-01'),
                    endDate: new Date('2023-01-31'),
                    page: 1,
                    limit: 50
                };

                const mockLogs = [
                    {
                        id: 'log1',
                        timestamp: '2023-01-15T10:00:00Z',
                        user_id: 'user123',
                        action: 'READ',
                        resource_type: 'PATIENT',
                        success: 1,
                        risk_score: 25
                    }
                ];

                const mockDb = {
                    queryAsync: jest.fn().mockResolvedValue(mockLogs),
                    getAsync: jest.fn().mockResolvedValue({ total: 1 })
                };

                auditSearchService.db = mockDb;

                const result = await auditSearchService.searchAuditLogs(mockSearchParams);

                expect(result).toHaveProperty('logs');
                expect(result).toHaveProperty('pagination');
                expect(result).toHaveProperty('searchParams');
                expect(result.logs).toHaveLength(1);
                expect(result.pagination.total).toBe(1);
            });

            it('should handle empty search results', async () => {
                const mockSearchParams = {
                    userId: 'nonexistent',
                    page: 1,
                    limit: 50
                };

                const mockDb = {
                    queryAsync: jest.fn().mockResolvedValue([]),
                    getAsync: jest.fn().mockResolvedValue({ total: 0 })
                };

                auditSearchService.db = mockDb;

                const result = await auditSearchService.searchAuditLogs(mockSearchParams);

                expect(result.logs).toHaveLength(0);
                expect(result.pagination.total).toBe(0);
            });
        });

        describe('getSearchSuggestions', () => {
            it('should return search suggestions for valid field', async () => {
                const mockSuggestions = [
                    { value: 'READ', count: 150 },
                    { value: 'UPDATE', count: 75 },
                    { value: 'DELETE', count: 25 }
                ];

                const mockDb = {
                    queryAsync: jest.fn().mockResolvedValue(mockSuggestions)
                };

                auditSearchService.db = mockDb;

                const suggestions = await auditSearchService.getSearchSuggestions('action', 'REA', 10);

                expect(suggestions).toHaveLength(3);
                expect(suggestions[0].value).toBe('READ');
                expect(suggestions[0].count).toBe(150);
            });

            it('should handle invalid search field', async () => {
                await expect(auditSearchService.getSearchSuggestions('invalid', 'query'))
                    .rejects.toThrow('Invalid search field: invalid');
            });
        });
    });

    describe('Audit Reporting Service', () => {
        describe('generateAuditReport', () => {
            it('should generate summary report', async () => {
                const mockReportConfig = {
                    reportType: 'summary',
                    startDate: new Date('2023-01-01'),
                    endDate: new Date('2023-01-31'),
                    format: 'json'
                };

                const mockReportData = {
                    overview: {
                        total_operations: 1000,
                        successful_operations: 950,
                        failed_operations: 50
                    },
                    topUsers: [],
                    topResources: [],
                    recentActivity: []
                };

                // Mock the report generation methods
                jest.spyOn(auditReportingService, 'generateSummaryReport')
                    .mockResolvedValue(mockReportData);

                const result = await auditReportingService.generateAuditReport(mockReportConfig);

                expect(result).toHaveProperty('reportType', 'summary');
                expect(result).toHaveProperty('dateRange');
                expect(result).toHaveProperty('generatedAt');
                expect(result).toHaveProperty('data');
                expect(result.data).toEqual(mockReportData);
            });

            it('should handle unsupported report type', async () => {
                const mockReportConfig = {
                    reportType: 'unsupported',
                    startDate: new Date('2023-01-01'),
                    endDate: new Date('2023-01-31'),
                    format: 'json'
                };

                await expect(auditReportingService.generateAuditReport(mockReportConfig))
                    .rejects.toThrow('Unknown report type: unsupported');
            });
        });

        describe('exportReport', () => {
            it('should export report to JSON format', async () => {
                const mockReport = {
                    id: 'report123',
                    reportType: 'summary',
                    data: { test: 'data' }
                };

                const mockFs = {
                    writeFile: jest.fn().mockResolvedValue(),
                    stat: jest.fn().mockResolvedValue({ size: 1024 })
                };

                // Mock fs operations
                global.fs = { ...fs, ...mockFs };

                const result = await auditReportingService.exportToJSON(mockReport);

                expect(result).toHaveProperty('format', 'json');
                expect(result).toHaveProperty('filename');
                expect(result).toHaveProperty('filepath');
                expect(result).toHaveProperty('size');
                expect(result).toHaveProperty('downloadUrl');
            });
        });
    });

    describe('Audit Retention Service', () => {
        describe('createRetentionPolicy', () => {
            it('should create retention policy', async () => {
                const mockPolicyData = {
                    name: 'Test Policy',
                    description: 'Test retention policy',
                    resourceType: 'PATIENT',
                    retentionDays: 2555,
                    archiveAfterDays: 1825,
                    deleteAfterDays: 2555
                };

                const mockPolicy = {
                    id: 1,
                    ...mockPolicyData,
                    is_active: 1,
                    created_at: new Date().toISOString()
                };

                const mockDb = {
                    runAsync: jest.fn().mockResolvedValue({ lastID: 1 }),
                    getAsync: jest.fn().mockResolvedValue(mockPolicy)
                };

                auditRetentionService.db = mockDb;

                const result = await auditRetentionService.createRetentionPolicy(mockPolicyData);

                expect(result).toHaveProperty('id');
                expect(result.name).toBe(mockPolicyData.name);
                expect(result.resource_type).toBe(mockPolicyData.resourceType);
            });
        });

        describe('applyRetentionPolicies', () => {
            it('should apply active retention policies', async () => {
                const mockPolicies = [
                    {
                        id: 1,
                        name: 'Test Policy',
                        resource_type: 'PATIENT',
                        retention_days: 2555,
                        is_active: 1
                    }
                ];

                const mockDb = {
                    queryAsync: jest.fn()
                        .mockResolvedValueOnce(mockPolicies) // Get policies
                        .mockResolvedValue([]), // Get logs to process
                    getAsync: jest.fn(),
                    runAsync: jest.fn()
                };

                auditRetentionService.db = mockDb;

                const result = await auditRetentionService.applyRetentionPolicies();

                expect(result).toHaveLength(1);
                expect(result[0]).toHaveProperty('policyId');
                expect(result[0]).toHaveProperty('policyName');
                expect(result[0]).toHaveProperty('success');
            });
        });
    });

    describe('Audit Analytics Service', () => {
        describe('detectAnomalies', () => {
            it('should detect anomalies using statistical analysis', async () => {
                const mockOptions = {
                    timeframe: '24h',
                    useStatisticalAnalysis: true,
                    threshold: 2.0
                };

                const mockAnomalies = [
                    {
                        type: 'FREQUENCY_ANOMALY',
                        userId: 'user123',
                        action: 'READ',
                        resourceType: 'PATIENT',
                        score: 85,
                        severity: 'HIGH'
                    }
                ];

                const mockDb = {
                    queryAsync: jest.fn().mockResolvedValue([]),
                    getAsync: jest.fn()
                };

                auditAnalyticsService.db = mockDb;

                const result = await auditAnalyticsService.detectAnomalies('24h', mockOptions);

                expect(result).toHaveProperty('timeframe');
                expect(result).toHaveProperty('detectedAt');
                expect(result).toHaveProperty('totalAnomalies');
                expect(result).toHaveProperty('anomalies');
                expect(result).toHaveProperty('summary');
            });
        });

        describe('getAnalyticsDashboard', () => {
            it('should return analytics dashboard data', async () => {
                const mockDashboard = {
                    timeframe: '24h',
                    generatedAt: new Date().toISOString(),
                    overview: {
                        total_operations: 1000,
                        unique_users: 50
                    },
                    anomalies: { totalAnomalies: 5 },
                    trends: [],
                    topUsers: [],
                    topResources: []
                };

                const mockDb = {
                    getAsync: jest.fn().mockResolvedValue({}),
                    queryAsync: jest.fn().mockResolvedValue([])
                };

                auditAnalyticsService.db = mockDb;

                const result = await auditAnalyticsService.getAnalyticsDashboard('24h');

                expect(result).toHaveProperty('timeframe');
                expect(result).toHaveProperty('generatedAt');
                expect(result).toHaveProperty('overview');
                expect(result).toHaveProperty('anomalies');
                expect(result).toHaveProperty('trends');
            });
        });
    });

    describe('External Audit Integration Service', () => {
        describe('sendToSIEM', () => {
            it('should send audit logs to SIEM', async () => {
                const mockLogs = [
                    {
                        id: 'log1',
                        action: 'READ',
                        resource_type: 'PATIENT',
                        user_id: 'user123',
                        ip_address: '192.168.1.100',
                        risk_score: 25
                    }
                ];

                const mockSiemConfig = {
                    endpoint: 'https://siem.example.com/api/logs',
                    apiKey: 'test-api-key',
                    format: 'CEF',
                    batchSize: 100
                };

                // Mock axios post
                const mockAxios = {
                    post: jest.fn().mockResolvedValue({ status: 200, data: { success: true } })
                };

                global.axios = mockAxios;

                const result = await externalAuditIntegrationService.sendToSIEM(mockLogs, mockSiemConfig);

                expect(result).toHaveProperty('sent');
                expect(result).toHaveProperty('failed');
                expect(result).toHaveProperty('errors');
                expect(mockAxios.post).toHaveBeenCalled();
            });
        });

        describe('exportForExternalAudit', () => {
            it('should export audit logs for external audit', async () => {
                const mockAuditConfig = {
                    startDate: '2023-01-01',
                    endDate: '2023-01-31',
                    format: 'CSV',
                    includeHashes: true
                };

                const mockLogs = [
                    {
                        id: 'log1',
                        timestamp: '2023-01-15T10:00:00Z',
                        user_id: 'user123',
                        action: 'READ',
                        resource_type: 'PATIENT'
                    }
                ];

                const mockDb = {
                    queryAsync: jest.fn().mockResolvedValue(mockLogs),
                    runAsync: jest.fn()
                };

                externalAuditIntegrationService.db = mockDb;

                // Mock fs operations
                const mockFs = {
                    writeFile: jest.fn().mockResolvedValue(),
                    mkdir: jest.fn().mockResolvedValue()
                };

                global.fs = { ...fs, ...mockFs };

                const result = await externalAuditIntegrationService.exportForExternalAudit(mockAuditConfig);

                expect(result).toHaveProperty('id');
                expect(result).toHaveProperty('filename');
                expect(result).toHaveProperty('filepath');
                expect(result).toHaveProperty('size');
                expect(result).toHaveProperty('checksum');
                expect(result).toHaveProperty('downloadUrl');
            });
        });
    });

    describe('API Integration Tests', () => {
        let app;

        beforeAll(() => {
            // Initialize Express app for API testing
            app = require('../server');
        });

        describe('POST /api/audit/logs', () => {
            it('should create audit log via API', async () => {
                const logData = {
                    userId: 'user123',
                    userRole: 'DOCTOR',
                    action: 'READ',
                    resourceType: 'PATIENT',
                    resourceId: 'patient456',
                    resourceName: 'John Doe',
                    endpoint: '/api/patients/patient456',
                    method: 'GET',
                    ipAddress: '192.168.1.100',
                    statusCode: 200,
                    success: true,
                    riskScore: 25,
                    correlationId: 'corr-789'
                };

                const response = await request(app)
                    .post('/api/audit/logs')
                    .send(logData)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('id');
            });

            it('should validate required fields', async () => {
                const invalidLogData = {
                    userId: 'user123'
                    // Missing required fields
                };

                const response = await request(app)
                    .post('/api/audit/logs')
                    .send(invalidLogData)
                    .expect(400);

                expect(response.body).toHaveProperty('success', false);
                expect(response.body).toHaveProperty('errors');
            });
        });

        describe('GET /api/audit/logs', () => {
            it('should search audit logs via API', async () => {
                const response = await request(app)
                    .get('/api/audit/logs')
                    .query({
                        userId: 'user123',
                        action: 'READ',
                        page: 1,
                        limit: 50
                    })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body).toHaveProperty('pagination');
                expect(response.body).toHaveProperty('searchParams');
            });
        });

        describe('GET /api/audit/integrity/verify/:id', () => {
            it('should verify audit log integrity via API', async () => {
                const response = await request(app)
                    .get('/api/audit/integrity/verify/log123')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('logId');
                expect(response.body.data).toHaveProperty('hashValid');
            });
        });

        describe('POST /api/audit/reports/generate', () => {
            it('should generate audit report via API', async () => {
                const reportConfig = {
                    reportType: 'summary',
                    startDate: '2023-01-01T00:00:00Z',
                    endDate: '2023-01-31T23:59:59Z',
                    format: 'json'
                };

                const response = await request(app)
                    .post('/api/audit/reports/generate')
                    .send(reportConfig)
                    .expect(201);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('message');
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('reportType');
            });
        });

        describe('GET /api/audit/anomalies', () => {
            it('should detect anomalies via API', async () => {
                const response = await request(app)
                    .get('/api/audit/anomalies')
                    .query({
                        timeframe: '24h',
                        useStatisticalAnalysis: true
                    })
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('data');
                expect(response.body.data).toHaveProperty('timeframe');
                expect(response.body.data).toHaveProperty('totalAnomalies');
                expect(response.body.data).toHaveProperty('anomalies');
            });
        });

        describe('GET /api/audit/health', () => {
            it('should return health status', async () => {
                const response = await request(app)
                    .get('/api/audit/health')
                    .expect(200);

                expect(response.body).toHaveProperty('success', true);
                expect(response.body).toHaveProperty('status');
                expect(response.body).toHaveProperty('timestamp');
                expect(response.body).toHaveProperty('services');
            });
        });
    });

    describe('Performance Tests', () => {
        it('should handle large volume of audit logs', async () => {
            const startTime = Date.now();
            
            // Create 1000 audit logs
            const promises = [];
            for (let i = 0; i < 1000; i++) {
                const logData = {
                    userId: `user${i}`,
                    userRole: 'DOCTOR',
                    action: 'READ',
                    resourceType: 'PATIENT',
                    resourceId: `patient${i}`,
                    resourceName: `Patient ${i}`,
                    endpoint: '/api/patients',
                    method: 'GET',
                    ipAddress: '192.168.1.100',
                    statusCode: 200,
                    success: true,
                    riskScore: 25,
                    correlationId: `corr-${i}`
                };

                promises.push(enhancedAuditService.createAuditLog(logData));
            }

            await Promise.all(promises);
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (e.g., 10 seconds)
            expect(duration).toBeLessThan(10000);
        });

        it('should handle complex search queries efficiently', async () => {
            const complexSearchParams = {
                startDate: new Date('2023-01-01'),
                endDate: new Date('2023-12-31'),
                action: ['READ', 'UPDATE', 'DELETE'],
                resourceType: ['PATIENT', 'MEDICAL_RECORD'],
                minRiskScore: 50,
                maxRiskScore: 100,
                page: 1,
                limit: 100
            };

            const startTime = Date.now();
            
            // Mock database response
            const mockDb = {
                queryAsync: jest.fn().mockResolvedValue([]),
                getAsync: jest.fn().mockResolvedValue({ total: 0 })
            };

            auditSearchService.db = mockDb;

            await auditSearchService.searchAuditLogs(complexSearchParams);
            
            const endTime = Date.now();
            const duration = endTime - startTime;

            // Should complete within reasonable time (e.g., 2 seconds)
            expect(duration).toBeLessThan(2000);
        });
    });

    describe('Security Tests', () => {
        it('should sanitize sensitive data in audit logs', async () => {
            const sensitiveLogData = {
                userId: 'user123',
                userRole: 'DOCTOR',
                action: 'UPDATE',
                resourceType: 'PATIENT',
                resourceId: 'patient456',
                endpoint: '/api/patients/patient456',
                method: 'PUT',
                ipAddress: '192.168.1.100',
                statusCode: 200,
                success: true,
                riskScore: 25,
                requestData: {
                    password: 'secret123',
                    ssn: '123-45-6789',
                    creditCard: '4111-1111-1111-1111'
                }
            };

            // Mock database
            const mockDb = {
                getAsync: jest.fn().mockResolvedValue({ hash: 'prev-hash' }),
                runAsync: jest.fn().mockResolvedValue({ lastID: 1 }),
                queryAsync: jest.fn().mockResolvedValue([])
            };

            enhancedAuditService.db = mockDb;

            const result = await enhancedAuditService.createAuditLog(sensitiveLogData);

            // Verify that sensitive data is sanitized
            expect(mockDb.runAsync).toHaveBeenCalled();
            const callArgs = mockDb.runAsync.mock.calls[0][1];
            const requestData = JSON.parse(callArgs[12]); // request_data parameter
            
            expect(requestData.password).toBe('[REDACTED]');
            expect(requestData.ssn).toBe('[REDACTED]');
            expect(requestData.creditCard).toBe('[REDACTED]');
        });

        it('should prevent SQL injection in search queries', async () => {
            const maliciousSearchParams = {
                userId: "'; DROP TABLE audit_logs; --",
                action: 'READ'
            };

            const mockDb = {
                queryAsync: jest.fn().mockResolvedValue([]),
                getAsync: jest.fn().mockResolvedValue({ total: 0 })
            };

            auditSearchService.db = mockDb;

            await auditSearchService.searchAuditLogs(maliciousSearchParams);

            // Verify that the query is properly parameterized
            expect(mockDb.queryAsync).toHaveBeenCalled();
            const query = mockDb.queryAsync.mock.calls[0][0];
            
            // Query should contain parameter placeholders, not concatenated values
            expect(query).toContain('?');
            expect(query).not.toContain("DROP TABLE");
        });
    });
});

// Integration test for complete audit trail workflow
describe('Audit Trail Integration Test', () => {
    it('should demonstrate complete audit trail workflow', async () => {
        // 1. Create audit log
        const logData = {
            userId: 'user123',
            userRole: 'DOCTOR',
            action: 'READ',
            resourceType: 'PATIENT',
            resourceId: 'patient456',
            resourceName: 'John Doe',
            endpoint: '/api/patients/patient456',
            method: 'GET',
            ipAddress: '192.168.1.100',
            statusCode: 200,
            success: true,
            riskScore: 25,
            correlationId: 'corr-789'
        };

        // Mock database operations
        const mockDb = {
            getAsync: jest.fn()
                .mockResolvedValueOnce({ hash: 'prev-hash' }) // For createAuditLog
                .mockResolvedValueOnce({ // For getAuditLogById
                    id: 'log123',
                    timestamp: '2023-01-15T10:00:00Z',
                    user_id: 'user123',
                    action: 'READ',
                    resource_type: 'PATIENT',
                    success: 1,
                    risk_score: 25
                }),
            runAsync: jest.fn().mockResolvedValue({ lastID: 1 }),
            queryAsync: jest.fn()
                .mockResolvedValueOnce([{ // For searchAuditLogs
                    id: 'log123',
                    timestamp: '2023-01-15T10:00:00Z',
                    user_id: 'user123',
                    action: 'READ',
                    resource_type: 'PATIENT',
                    success: 1,
                    risk_score: 25
                }])
                .mockResolvedValue([]) // For other queries
        };

        // Set up all services with mock database
        enhancedAuditService.db = mockDb;
        auditSearchService.db = mockDb;
        auditIntegrityService.db = mockDb;

        // 2. Create audit log
        const auditLog = await enhancedAuditService.createAuditLog(logData);
        expect(auditLog).toHaveProperty('id');
        expect(auditLog).toHaveProperty('hash');

        // 3. Search for audit logs
        const searchResult = await auditSearchService.searchAuditLogs({
            userId: 'user123',
            action: 'READ',
            page: 1,
            limit: 10
        });
        expect(searchResult.logs).toHaveLength(1);

        // 4. Get specific audit log
        const specificLog = await auditSearchService.getAuditLogById('log123');
        expect(specificLog).toHaveProperty('id', 'log123');

        // 5. Verify integrity
        const integrityResult = await auditIntegrityService.verifySingleLog('log123');
        expect(integrityResult).toHaveProperty('hashValid');

        // 6. Generate report
        const reportData = {
            reportType: 'summary',
            startDate: new Date('2023-01-01'),
            endDate: new Date('2023-01-31'),
            format: 'json'
        };

        // Mock report generation
        jest.spyOn(auditReportingService, 'generateSummaryReport')
            .mockResolvedValue({
                overview: { total_operations: 1 },
                topUsers: [],
                topResources: [],
                recentActivity: []
            });

        const report = await auditReportingService.generateAuditReport(reportData);
        expect(report).toHaveProperty('reportType', 'summary');

        // 7. Detect anomalies
        jest.spyOn(auditAnalyticsService, 'detectAnomalies')
            .mockResolvedValue({
                timeframe: '24h',
                totalAnomalies: 0,
                anomalies: [],
                summary: {}
            });

        const anomalies = await auditAnalyticsService.detectAnomalies('24h');
        expect(anomalies).toHaveProperty('totalAnomalies', 0);

        // Workflow completed successfully
        expect(true).toBe(true);
    });
});
