-- Enhanced Audit Trail System Schema
-- Additional tables and indexes for comprehensive audit functionality

-- Audit signatures table for digital signatures
CREATE TABLE IF NOT EXISTS audit_signatures (
    id TEXT PRIMARY KEY,
    audit_log_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    algorithm TEXT NOT NULL DEFAULT 'RSA-SHA256',
    public_key TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
    UNIQUE(audit_log_id)
);

-- Audit verifications table
CREATE TABLE IF NOT EXISTS audit_verifications (
    id TEXT PRIMARY KEY,
    audit_log_id TEXT NOT NULL,
    hash_valid BOOLEAN NOT NULL,
    expected_hash TEXT NOT NULL,
    actual_hash TEXT NOT NULL,
    verification_time DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE
);

-- Audit chain verifications table
CREATE TABLE IF NOT EXISTS audit_chain_verifications (
    id TEXT PRIMARY KEY,
    chain_valid BOOLEAN NOT NULL,
    total_logs INTEGER NOT NULL,
    valid_logs INTEGER NOT NULL,
    invalid_logs INTEGER NOT NULL,
    first_invalid_log TEXT,
    verification_time DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit tampering alerts table
CREATE TABLE IF NOT EXISTS audit_tampering_alerts (
    id TEXT PRIMARY KEY,
    timeframe TEXT NOT NULL,
    total_suspicious_events INTEGER NOT NULL,
    detection_data TEXT NOT NULL, -- JSON data
    investigated BOOLEAN DEFAULT FALSE,
    investigated_by TEXT,
    investigated_at DATETIME,
    investigation_notes TEXT,
    false_positive BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit reports table
CREATE TABLE IF NOT EXISTS audit_reports (
    id TEXT PRIMARY KEY,
    report_type TEXT NOT NULL,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    generated_by TEXT NOT NULL,
    format TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    metadata TEXT, -- JSON metadata
    downloaded_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit exports table
CREATE TABLE IF NOT EXISTS audit_exports (
    id TEXT PRIMARY KEY,
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    format TEXT NOT NULL,
    filename TEXT NOT NULL,
    filepath TEXT NOT NULL,
    size INTEGER NOT NULL,
    checksum TEXT NOT NULL,
    encrypted BOOLEAN DEFAULT FALSE,
    log_count INTEGER NOT NULL,
    downloaded_count INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- External transmission log table
CREATE TABLE IF NOT EXISTS external_transmission_log (
    id TEXT PRIMARY KEY,
    system TEXT NOT NULL, -- SIEM, COMPLIANCE, etc.
    log_count INTEGER NOT NULL,
    endpoint TEXT NOT NULL,
    status TEXT NOT NULL, -- SUCCESS, FAILED
    error_message TEXT,
    response_data TEXT, -- JSON response data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit anomaly detections table
CREATE TABLE IF NOT EXISTS audit_anomaly_detections (
    id TEXT PRIMARY KEY,
    detection_time DATETIME NOT NULL,
    timeframe TEXT NOT NULL,
    anomaly_type TEXT NOT NULL,
    severity TEXT NOT NULL,
    score REAL NOT NULL,
    description TEXT NOT NULL,
    affected_logs TEXT, -- JSON array of log IDs
    investigated BOOLEAN DEFAULT FALSE,
    investigated_by TEXT,
    investigated_at DATETIME,
    investigation_notes TEXT,
    false_positive BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit analytics dashboard cache table
CREATE TABLE IF NOT EXISTS audit_analytics_cache (
    id TEXT PRIMARY KEY,
    cache_key TEXT NOT NULL UNIQUE,
    cache_data TEXT NOT NULL, -- JSON data
    timeframe TEXT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit retention execution log table
CREATE TABLE IF NOT EXISTS retention_execution_log (
    id TEXT PRIMARY KEY,
    policy_id INTEGER NOT NULL,
    policy_name TEXT NOT NULL,
    processed_logs INTEGER NOT NULL,
    archived_logs INTEGER NOT NULL,
    deleted_logs INTEGER NOT NULL,
    execution_time DATETIME NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (policy_id) REFERENCES retention_policies(id) ON DELETE CASCADE
);

-- Create additional indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_signatures_audit_log_id ON audit_signatures(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_signatures_created_at ON audit_signatures(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_verifications_audit_log_id ON audit_verifications(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_audit_verifications_created_at ON audit_verifications(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_chain_verifications_created_at ON audit_chain_verifications(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_tampering_alerts_created_at ON audit_tampering_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_tampering_alerts_investigated ON audit_tampering_alerts(investigated);
CREATE INDEX IF NOT EXISTS idx_audit_reports_report_type ON audit_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_audit_reports_created_at ON audit_reports(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_reports_generated_by ON audit_reports(generated_by);
CREATE INDEX IF NOT EXISTS idx_audit_exports_created_at ON audit_exports(created_at);
CREATE INDEX IF NOT EXISTS idx_external_transmission_log_system ON external_transmission_log(system);
CREATE INDEX IF NOT EXISTS idx_external_transmission_log_created_at ON external_transmission_log(created_at);
CREATE INDEX IF NOT EXISTS idx_external_transmission_log_status ON external_transmission_log(status);
CREATE INDEX IF NOT EXISTS idx_audit_anomaly_detections_detection_time ON audit_anomaly_detections(detection_time);
CREATE INDEX IF NOT EXISTS idx_audit_anomaly_detections_anomaly_type ON audit_anomaly_detections(anomaly_type);
CREATE INDEX IF NOT EXISTS idx_audit_anomaly_detections_severity ON audit_anomaly_detections(severity);
CREATE INDEX IF NOT EXISTS idx_audit_anomaly_detections_investigated ON audit_anomaly_detections(investigated);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_cache_cache_key ON audit_analytics_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_audit_analytics_cache_expires_at ON audit_analytics_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_retention_execution_log_policy_id ON retention_execution_log(policy_id);
CREATE INDEX IF NOT EXISTS idx_retention_execution_log_created_at ON retention_execution_log(created_at);

-- Create triggers for automatic cleanup
CREATE TRIGGER IF NOT EXISTS cleanup_analytics_cache
AFTER INSERT ON audit_analytics_cache
WHEN NEW.expires_at < datetime('now')
BEGIN
    DELETE FROM audit_analytics_cache WHERE expires_at < datetime('now');
END;

-- Create view for audit system overview
CREATE VIEW IF NOT EXISTS audit_system_overview AS
SELECT 
    'total_logs' as metric,
    COUNT(*) as value
FROM audit_logs
UNION ALL
SELECT 
    'logs_today' as metric,
    COUNT(*) as value
FROM audit_logs
WHERE DATE(created_at) = DATE('now')
UNION ALL
SELECT 
    'high_risk_logs' as metric,
    COUNT(*) as value
FROM audit_logs
WHERE risk_score >= 70
UNION ALL
SELECT 
    'failed_operations' as metric,
    COUNT(*) as value
FROM audit_logs
WHERE success = 0
UNION ALL
SELECT 
    'total_reports' as metric,
    COUNT(*) as value
FROM audit_reports
UNION ALL
SELECT 
    'total_exports' as metric,
    COUNT(*) as value
FROM audit_exports
UNION ALL
SELECT 
    'anomalies_detected' as metric,
    COUNT(*) as value
FROM audit_anomaly_detections
WHERE DATE(created_at) = DATE('now')
UNION ALL
SELECT 
    'tampering_alerts' as metric,
    COUNT(*) as value
FROM audit_tampering_alerts
WHERE investigated = FALSE;

-- Create view for recent audit activity
CREATE VIEW IF NOT EXISTS recent_audit_activity AS
SELECT 
    al.id,
    al.timestamp,
    al.user_id,
    al.user_role,
    al.action,
    al.resource_type,
    al.resource_name,
    al.ip_address,
    al.success,
    al.risk_score,
    u.username,
    u.email,
    GROUP_CONCAT(DISTINCT ac.name) as categories
FROM audit_logs al
LEFT JOIN users u ON al.user_id = u.id
LEFT JOIN audit_log_categories alc ON al.id = alc.audit_log_id
LEFT JOIN audit_categories ac ON alc.category_id = ac.id
WHERE al.timestamp >= datetime('now', '-24 hours')
GROUP BY al.id
ORDER BY al.timestamp DESC;

-- Create view for audit integrity status
CREATE VIEW IF NOT EXISTS audit_integrity_status AS
SELECT 
    'chain_integrity' as status_type,
    CASE 
        WHEN COUNT(CASE WHEN chain_valid = 0 THEN 1 END) = 0 THEN 'HEALTHY'
        WHEN COUNT(CASE WHEN chain_valid = 0 THEN 1 END) <= COUNT(*) * 0.05 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status_value,
    COUNT(*) as total_checks,
    COUNT(CASE WHEN chain_valid = 0 THEN 1 END) as failed_checks,
    MAX(created_at) as last_check
FROM audit_chain_verifications
WHERE created_at >= datetime('now', '-7 days')
UNION ALL
SELECT 
    'tampering_alerts' as status_type,
    CASE 
        WHEN COUNT(*) = 0 THEN 'HEALTHY'
        WHEN COUNT(*) <= 5 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status_value,
    COUNT(*) as total_alerts,
    COUNT(*) as active_alerts,
    MAX(created_at) as last_alert
FROM audit_tampering_alerts
WHERE investigated = FALSE
UNION ALL
SELECT 
    'anomaly_detections' as status_type,
    CASE 
        WHEN COUNT(*) = 0 THEN 'HEALTHY'
        WHEN COUNT(*) <= 10 THEN 'WARNING'
        ELSE 'CRITICAL'
    END as status_value,
    COUNT(*) as total_anomalies,
    COUNT(*) as unresolved_anomalies,
    MAX(created_at) as last_detection
FROM audit_anomaly_detections
WHERE DATE(created_at) = DATE('now')
AND investigated = FALSE;

-- Insert default audit categories if they don't exist
INSERT OR IGNORE INTO audit_categories (name, description, risk_level, retention_days, compliance_requirements) VALUES
('PATIENT_ACCESS', 'Patient record access and modifications', 75, 2555, '["HIPAA", "GDPR"]'),
('SYSTEM_ADMIN', 'System administration operations', 50, 3650, '["SOX", "HIPAA"]'),
('DATA_EXPORT', 'Data export operations', 85, 2555, '["HIPAA", "GDPR"]'),
('AUTHENTICATION', 'User authentication events', 25, 1095, '["SOX", "HIPAA"]'),
('API_ACCESS', 'General API access', 10, 365, '["HIPAA"]'),
('BATCH_OPERATIONS', 'Bulk data operations', 60, 2555, '["HIPAA", "GDPR"]'),
('SECURITY_EVENTS', 'Security-related events', 90, 3650, '["HIPAA", "SOX"]'),
('COMPLIANCE_REPORT', 'Compliance report generation', 30, 2555, '["HIPAA", "SOX"]'),
('INTEGRITY_CHECK', 'Audit integrity verification', 40, 1825, '["SOX", "HIPAA"]'),
('ANOMALY_DETECTION', 'Anomaly detection results', 70, 2555, '["HIPAA", "GDPR"]');

-- Insert default retention policies if they don't exist
INSERT OR IGNORE INTO retention_policies (name, description, resource_type, action_types, retention_days, archive_after_days, delete_after_days, is_active) VALUES
('HIPAA_AUDIT_LOGS', 'HIPAA compliant audit log retention', 'PATIENT', '["CREATE", "READ", "UPDATE", "DELETE"]', 2555, 1825, 2555, 1),
('SYSTEM_LOGS', 'System operation logs retention', 'SYSTEM', '["CREATE", "UPDATE", "DELETE"]', 1095, 365, 1095, 1),
('ACCESS_LOGS', 'Access control logs retention', 'USER', '["CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT"]', 1825, 730, 1825, 1),
('DATA_EXPORT_LOGS', 'Data export logs retention', 'PATIENT', '["EXPORT", "DOWNLOAD"]', 2555, 1825, 2555, 1),
('SECURITY_LOGS', 'Security event logs retention', 'SYSTEM', '["LOGIN_FAILED", "SECURITY_VIOLATION", "SUSPICIOUS_ACTIVITY"]', 3650, 2555, 3650, 1);

-- Create stored procedures for common operations
-- Procedure to get audit summary for dashboard
CREATE TRIGGER IF NOT EXISTS update_audit_metrics_daily
AFTER INSERT ON audit_logs
WHEN DATE(created_at) != DATE(COALESCE((SELECT created_at FROM audit_metrics WHERE metric_date = DATE(NEW.created_at)), '1970-01-01'))
BEGIN
    INSERT OR REPLACE INTO audit_metrics (
        metric_date,
        total_logs,
        successful_operations,
        failed_operations,
        unique_users,
        unique_resources,
        average_response_time,
        high_risk_operations,
        anomalies_detected,
        compliance_violations
    ) VALUES (
        DATE(NEW.created_at),
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(NEW.created_at)), 0) + 1,
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(NEW.created_at) AND success = TRUE), 0) + (CASE WHEN NEW.success = TRUE THEN 1 ELSE 0 END),
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(NEW.created_at) AND success = FALSE), 0) + (CASE WHEN NEW.success = FALSE THEN 1 ELSE 0 END),
        COALESCE((SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE DATE(created_at) = DATE(NEW.created_at)), 0),
        COALESCE((SELECT COUNT(DISTINCT resource_id) FROM audit_logs WHERE DATE(created_at) = DATE(NEW.created_at) AND resource_id IS NOT NULL), 0),
        0, -- Will be updated by separate process
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(NEW.created_at) AND risk_score >= 70), 0) + (CASE WHEN NEW.risk_score >= 70 THEN 1 ELSE 0 END),
        0, -- Will be updated by anomaly detection
        0  -- Will be updated by compliance checking
    );
END;

-- Create function to calculate audit integrity score
CREATE VIEW IF NOT EXISTS audit_integrity_score AS
SELECT 
    (SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE (COUNT(CASE WHEN chain_valid = TRUE THEN 1 END) * 100.0 / COUNT(*))
        END
    FROM audit_chain_verifications 
    WHERE created_at >= datetime('now', '-7 days')
    ) as chain_integrity_score,
    (SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE (100 - (COUNT(CASE WHEN investigated = FALSE THEN 1 END) * 10.0))
        END
    FROM audit_tampering_alerts 
    WHERE created_at >= datetime('now', '-7 days')
    ) as tampering_score,
    (SELECT 
        CASE 
            WHEN COUNT(*) = 0 THEN 100
            ELSE (100 - (COUNT(CASE WHEN investigated = FALSE AND severity = 'HIGH' THEN 1 END) * 5.0))
        END
    FROM audit_anomaly_detections 
    WHERE created_at >= datetime('now', '-7 days')
    ) as anomaly_score,
    datetime('now') as calculated_at;
