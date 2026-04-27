-- Comprehensive Audit Trail System Schema
-- Ensures immutable logging for regulatory compliance

-- Main audit log table - immutable records
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, -- UUID for unique identification
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    user_id TEXT NOT NULL,
    user_role TEXT NOT NULL,
    action TEXT NOT NULL, -- CREATE, READ, UPDATE, DELETE, EXPORT, LOGIN, LOGOUT
    resource_type TEXT NOT NULL, -- PATIENT, MEDICAL_RECORD, USER, SYSTEM, etc.
    resource_id TEXT, -- ID of the affected resource
    resource_name TEXT, -- Human-readable name of resource
    endpoint TEXT NOT NULL, -- API endpoint called
    method TEXT NOT NULL, -- HTTP method
    ip_address TEXT NOT NULL,
    user_agent TEXT,
    request_data TEXT, -- JSON string of request data
    response_data TEXT, -- JSON string of response data (sanitized)
    status_code INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    session_id TEXT,
    correlation_id TEXT NOT NULL, -- Links related operations
    compliance_flags TEXT, -- JSON array of compliance flags
    risk_score INTEGER DEFAULT 0, -- 0-100 risk assessment
    metadata TEXT, -- Additional context data
    hash TEXT NOT NULL, -- Cryptographic hash for integrity verification
    previous_hash TEXT, -- For blockchain-like immutability
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Audit log categories for classification
CREATE TABLE IF NOT EXISTS audit_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    risk_level INTEGER DEFAULT 0, -- 0-100
    retention_days INTEGER DEFAULT 2555, -- 7 years default
    compliance_requirements TEXT, -- JSON array of applicable regulations
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Link audit logs to categories
CREATE TABLE IF NOT EXISTS audit_log_categories (
    audit_log_id TEXT NOT NULL,
    category_id INTEGER NOT NULL,
    PRIMARY KEY (audit_log_id, category_id),
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES audit_categories(id) ON DELETE CASCADE
);

-- Compliance rule definitions
CREATE TABLE IF NOT EXISTS compliance_rules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    regulation TEXT NOT NULL, -- HIPAA, GDPR, SOX, etc.
    rule_type TEXT NOT NULL, -- RETENTION, ACCESS, ENCRYPTION, AUDIT
    conditions TEXT NOT NULL, -- JSON conditions
    actions TEXT NOT NULL, -- JSON actions to take
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Compliance violations
CREATE TABLE IF NOT EXISTS compliance_violations (
    id TEXT PRIMARY KEY,
    audit_log_id TEXT NOT NULL,
    rule_id INTEGER NOT NULL,
    severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT NOT NULL,
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by TEXT,
    resolved_at DATETIME,
    resolution_notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (audit_log_id) REFERENCES audit_logs(id) ON DELETE CASCADE,
    FOREIGN KEY (rule_id) REFERENCES compliance_rules(id) ON DELETE CASCADE
);

-- Anomaly detection patterns
CREATE TABLE IF NOT EXISTS anomaly_patterns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    pattern_type TEXT NOT NULL, -- FREQUENCY, TIME, ACCESS_PATTERN, DATA_VOLUME
    conditions TEXT NOT NULL, -- JSON conditions
    threshold_value REAL NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Detected anomalies
CREATE TABLE IF NOT EXISTS detected_anomalies (
    id TEXT PRIMARY KEY,
    pattern_id INTEGER NOT NULL,
    audit_log_ids TEXT NOT NULL, -- JSON array of related audit log IDs
    severity TEXT NOT NULL, -- LOW, MEDIUM, HIGH, CRITICAL
    description TEXT NOT NULL,
    confidence_score REAL NOT NULL, -- 0.0-1.0
    investigated BOOLEAN DEFAULT FALSE,
    investigated_by TEXT,
    investigated_at DATETIME,
    investigation_notes TEXT,
    false_positive BOOLEAN DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    FOREIGN KEY (pattern_id) REFERENCES anomaly_patterns(id) ON DELETE CASCADE
);

-- Audit log retention policies
CREATE TABLE IF NOT EXISTS retention_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    resource_type TEXT NOT NULL,
    action_types TEXT, -- JSON array of actions
    retention_days INTEGER NOT NULL,
    archive_after_days INTEGER,
    delete_after_days INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL
);

-- Audit archive table for long-term storage
CREATE TABLE IF NOT EXISTS audit_archive (
    id TEXT PRIMARY KEY,
    original_id TEXT NOT NULL, -- Reference to original audit_log.id
    archived_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    archive_reason TEXT NOT NULL,
    compressed_data TEXT, -- Compressed JSON data
    checksum TEXT NOT NULL, -- For integrity verification
    FOREIGN KEY (original_id) REFERENCES audit_logs(id) ON DELETE CASCADE
);

-- System metrics for audit performance
CREATE TABLE IF NOT EXISTS audit_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    metric_date DATE NOT NULL,
    total_logs INTEGER NOT NULL,
    successful_operations INTEGER NOT NULL,
    failed_operations INTEGER NOT NULL,
    unique_users INTEGER NOT NULL,
    unique_resources INTEGER NOT NULL,
    average_response_time REAL,
    high_risk_operations INTEGER DEFAULT 0,
    anomalies_detected INTEGER DEFAULT 0,
    compliance_violations INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP NOT NULL,
    UNIQUE(metric_date)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_type ON audit_logs(resource_type);
CREATE INDEX IF NOT EXISTS idx_audit_logs_resource_id ON audit_logs(resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_correlation_id ON audit_logs(correlation_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_risk_score ON audit_logs(risk_score);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_audit_log_id ON compliance_violations(audit_log_id);
CREATE INDEX IF NOT EXISTS idx_compliance_violations_severity ON compliance_violations(severity);
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_pattern_id ON detected_anomalies(pattern_id);
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_severity ON detected_anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_detected_anomalies_created_at ON detected_anomalies(created_at);

-- Insert default audit categories
INSERT OR IGNORE INTO audit_categories (name, description, risk_level, retention_days, compliance_requirements) VALUES
('PATIENT_ACCESS', 'Patient record access and modifications', 75, 2555, '["HIPAA", "GDPR"]'),
('SYSTEM_ADMIN', 'System administration operations', 50, 3650, '["SOX", "HIPAA"]'),
('DATA_EXPORT', 'Data export operations', 85, 2555, '["HIPAA", "GDPR"]'),
('AUTHENTICATION', 'User authentication events', 25, 1095, '["SOX", "HIPAA"]'),
('API_ACCESS', 'General API access', 10, 365, '["HIPAA"]'),
('BATCH_OPERATIONS', 'Bulk data operations', 60, 2555, '["HIPAA", "GDPR"]'),
('SECURITY_EVENTS', 'Security-related events', 90, 3650, '["HIPAA", "SOX"]'),
('COMPLIANCE_REPORT', 'Compliance report generation', 30, 2555, '["HIPAA", "SOX"]');

-- Insert default compliance rules
INSERT OR IGNORE INTO compliance_rules (name, description, regulation, rule_type, conditions, actions) VALUES
('HIPAA_ACCESS_LOG', 'Log all patient data access', 'HIPAA', 'AUDIT', '{"resource_type": "PATIENT", "action": ["READ", "UPDATE", "DELETE"]}', '{"log": true, "alert_risk": true}'),
('DATA_RETENTION_7_YEARS', 'Retain audit logs for 7 years', 'HIPAA', 'RETENTION', '{"action": ["CREATE", "UPDATE", "DELETE"]}', '{"retention_days": 2555}'),
('EXPORT_AUTHORIZATION', 'Require authorization for data export', 'HIPAA', 'ACCESS', '{"action": "EXPORT"}', '{"require_admin_approval": true, "log": true}'),
('AFTER_HOURS_ACCESS', 'Monitor after-hours access', 'HIPAA', 'ACCESS', '{"time": {"start": "22:00", "end": "06:00"}}', '{"alert_risk": true, "require_2fa": true}'),
('MASS_DATA_ACCESS', 'Detect bulk data access', 'HIPAA', 'ACCESS', '{"volume": {"threshold": 100, "timeframe": "1h"}}', '{"alert_risk": true, "require_approval": true}');

-- Insert default anomaly patterns
INSERT OR IGNORE INTO anomaly_patterns (name, description, pattern_type, conditions, threshold_value) VALUES
('RAPID_PATIENT_ACCESS', 'Unusual rapid access to patient records', 'FREQUENCY', '{"resource_type": "PATIENT", "timeframe": "5m", "max_normal": 10}', 15.0),
('AFTER_HOURS_ACTIVITY', 'System activity during unusual hours', 'TIME', '{"time_range": {"start": "22:00", "end": "06:00"}}', 5.0),
('MASS_EXPORT_ATTEMPT', 'Large volume data export attempts', 'DATA_VOLUME', '{"action": "EXPORT", "timeframe": "1h"}', 1000.0),
('MULTIPLE_FAILED_LOGINS', 'Repeated authentication failures', 'FREQUENCY', '{"action": "LOGIN", "success": false, "timeframe": "10m"}', 5.0),
('PRIVILEGE_ESCALATION', 'Unusual privilege escalation attempts', 'ACCESS_PATTERN', '{"role_change": true, "timeframe": "24h"}', 1.0);

-- Create trigger for automatic metric calculation
CREATE TRIGGER IF NOT EXISTS update_audit_metrics
AFTER INSERT ON audit_logs
BEGIN
    INSERT OR REPLACE INTO audit_metrics (
        metric_date,
        total_logs,
        successful_operations,
        failed_operations,
        unique_users,
        unique_resources,
        average_response_time,
        high_risk_operations
    ) VALUES (
        DATE(CURRENT_TIMESTAMP),
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(CURRENT_TIMESTAMP)), 0) + 1,
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(CURRENT_TIMESTAMP) AND success = TRUE), 0) + (CASE WHEN NEW.success = TRUE THEN 1 ELSE 0 END),
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(CURRENT_TIMESTAMP) AND success = FALSE), 0) + (CASE WHEN NEW.success = FALSE THEN 1 ELSE 0 END),
        COALESCE((SELECT COUNT(DISTINCT user_id) FROM audit_logs WHERE DATE(created_at) = DATE(CURRENT_TIMESTAMP)), 0),
        COALESCE((SELECT COUNT(DISTINCT resource_id) FROM audit_logs WHERE DATE(created_at) = DATE(CURRENT_TIMESTAMP) AND resource_id IS NOT NULL), 0),
        0, -- Will be updated by separate process
        COALESCE((SELECT COUNT(*) FROM audit_logs WHERE DATE(created_at) = DATE(CURRENT_TIMESTAMP) AND risk_score >= 70), 0) + (CASE WHEN NEW.risk_score >= 70 THEN 1 ELSE 0 END)
    );
END;
