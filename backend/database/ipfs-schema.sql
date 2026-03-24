-- IPFS-enabled Medical Records Database Schema
-- This file contains the additional tables needed for IPFS integration

-- Medical Records IPFS Table
-- Stores metadata for medical records stored in IPFS
CREATE TABLE IF NOT EXISTS medical_records_ipfs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    record_type TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    diagnosis_code TEXT,
    treatment_code TEXT,
    date_of_service DATE NOT NULL,
    facility_name TEXT,
    notes TEXT,
    ipfs_cid TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (provider_id) REFERENCES users(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Content Hashes Table
-- For deduplication and content addressing
CREATE TABLE IF NOT EXISTS content_hashes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_hash TEXT UNIQUE NOT NULL,
    ipfs_cid TEXT NOT NULL,
    content_type TEXT NOT NULL,
    original_size INTEGER NOT NULL,
    encrypted_size INTEGER NOT NULL,
    upload_count INTEGER DEFAULT 1,
    first_uploaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_pinned BOOLEAN DEFAULT FALSE,
    metadata TEXT
);

-- Content References Table
-- Tracks which resources reference which content
CREATE TABLE IF NOT EXISTS content_references (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    content_hash TEXT NOT NULL,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    user_id INTEGER NOT NULL,
    access_granted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (content_hash) REFERENCES content_hashes(content_hash),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- File Versions Table
-- For versioning and backup systems
CREATE TABLE IF NOT EXISTS file_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    version_number INTEGER NOT NULL,
    ipfs_cid TEXT NOT NULL,
    content_hash TEXT NOT NULL,
    file_size INTEGER NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    change_description TEXT,
    is_current BOOLEAN DEFAULT FALSE,
    backup_cid TEXT,
    metadata TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id),
    UNIQUE(resource_type, resource_id, version_number)
);

-- Backup Schedules Table
-- For automated backup scheduling
CREATE TABLE IF NOT EXISTS backup_schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    backup_frequency TEXT NOT NULL,
    last_backup TIMESTAMP,
    next_backup TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    retention_days INTEGER DEFAULT 30,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restore Points Table
-- For manual restore points
CREATE TABLE IF NOT EXISTS restore_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    restore_point_name TEXT NOT NULL,
    ipfs_cid TEXT NOT NULL,
    created_by INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    description TEXT,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Pinned Records Table
-- For tracking pinned content and pinning status
CREATE TABLE IF NOT EXISTS pinned_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    ipfs_cid TEXT NOT NULL UNIQUE,
    priority TEXT DEFAULT 'MEDIUM',
    pin_status TEXT DEFAULT 'PENDING',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    pinned_at TIMESTAMP,
    last_verified TIMESTAMP,
    verification_status TEXT DEFAULT 'UNKNOWN',
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    metadata TEXT,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- Pinning Policies Table
-- For automated pinning policies
CREATE TABLE IF NOT EXISTS pinning_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_type TEXT NOT NULL,
    auto_pin BOOLEAN DEFAULT TRUE,
    priority TEXT DEFAULT 'MEDIUM',
    retention_days INTEGER DEFAULT 365,
    conditions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Pinning Audit Log Table
-- For tracking all pinning operations
CREATE TABLE IF NOT EXISTS pinning_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    cid TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    error_message TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Access Logs Table
-- For comprehensive access tracking
CREATE TABLE IF NOT EXISTS access_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    resource_type TEXT NOT NULL,
    resource_id TEXT NOT NULL,
    action TEXT NOT NULL,
    success BOOLEAN NOT NULL,
    ip_address TEXT,
    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id)
);

-- Patient Encryption Keys Table
-- For managing patient-specific encryption keys
CREATE TABLE IF NOT EXISTS patient_encryption_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL UNIQUE,
    encryption_key TEXT NOT NULL,
    key_version INTEGER DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER NOT NULL,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (created_by) REFERENCES users(id)
);

-- IPFS Node Configuration Table
-- For storing IPFS node configuration
CREATE TABLE IF NOT EXISTS ipfs_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    config_key TEXT NOT NULL UNIQUE,
    config_value TEXT NOT NULL,
    description TEXT,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_by INTEGER,
    FOREIGN KEY (updated_by) REFERENCES users(id)
);

-- Create Indexes for Performance

-- Medical Records IPFS Indexes
CREATE INDEX IF NOT EXISTS idx_medical_records_ipfs_patient 
ON medical_records_ipfs(patient_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_ipfs_provider 
ON medical_records_ipfs(provider_id);

CREATE INDEX IF NOT EXISTS idx_medical_records_ipfs_date 
ON medical_records_ipfs(date_of_service);

CREATE INDEX IF NOT EXISTS idx_medical_records_ipfs_cid 
ON medical_records_ipfs(ipfs_cid);

CREATE INDEX IF NOT EXISTS idx_medical_records_ipfs_content_hash 
ON medical_records_ipfs(content_hash);

-- Content Hashes Indexes
CREATE INDEX IF NOT EXISTS idx_content_hashes_hash 
ON content_hashes(content_hash);

CREATE INDEX IF NOT EXISTS idx_content_hashes_cid 
ON content_hashes(ipfs_cid);

CREATE INDEX IF NOT EXISTS idx_content_hashes_type 
ON content_hashes(content_type);

CREATE INDEX IF NOT EXISTS idx_content_hashes_pinned 
ON content_hashes(is_pinned);

-- Content References Indexes
CREATE INDEX IF NOT EXISTS idx_content_references_hash 
ON content_references(content_hash);

CREATE INDEX IF NOT EXISTS idx_content_references_resource 
ON content_references(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_content_references_user 
ON content_references(user_id);

-- File Versions Indexes
CREATE INDEX IF NOT EXISTS idx_file_versions_resource 
ON file_versions(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_file_versions_current 
ON file_versions(resource_type, resource_id, is_current);

CREATE INDEX IF NOT EXISTS idx_file_versions_cid 
ON file_versions(ipfs_cid);

-- Pinned Records Indexes
CREATE INDEX IF NOT EXISTS idx_pinned_records_cid 
ON pinned_records(ipfs_cid);

CREATE INDEX IF NOT EXISTS idx_pinned_records_status 
ON pinned_records(pin_status);

CREATE INDEX IF NOT EXISTS idx_pinned_records_priority 
ON pinned_records(priority);

CREATE INDEX IF NOT EXISTS idx_pinned_records_resource 
ON pinned_records(resource_type, resource_id);

-- Access Logs Indexes
CREATE INDEX IF NOT EXISTS idx_access_logs_user 
ON access_logs(user_id);

CREATE INDEX IF NOT EXISTS idx_access_logs_resource 
ON access_logs(resource_type, resource_id);

CREATE INDEX IF NOT EXISTS idx_access_logs_timestamp 
ON access_logs(timestamp);

CREATE INDEX IF NOT EXISTS idx_access_logs_action 
ON access_logs(action);

-- Insert Default IPFS Configuration
INSERT OR IGNORE INTO ipfs_config (config_key, config_value, description) VALUES
('ipfs_node_type', 'local', 'Type of IPFS node: local or infura'),
('max_versions', '10', 'Maximum number of versions to keep per resource'),
('auto_backup', 'true', 'Enable automatic backup creation'),
('backup_retention_days', '30', 'Number of days to keep automatic backups'),
('pinning_max_retries', '3', 'Maximum number of retry attempts for pinning'),
('pinning_retry_delay', '5000', 'Delay between pinning retry attempts in milliseconds'),
('health_check_interval', '60000', 'Health check interval in milliseconds'),
('cleanup_days', '30', 'Number of days after which to clean up old records');

-- Insert Default Pinning Policies
INSERT OR IGNORE INTO pinning_policies (resource_type, auto_pin, priority, retention_days) VALUES
('medical_record', true, 'HIGH', 365),
('patient_record', true, 'CRITICAL', 730),
('file', false, 'MEDIUM', 180),
('json', false, 'LOW', 90);

-- Create Triggers for Automatic Timestamp Updates

-- Update updated_at timestamp for medical_records_ipfs
CREATE TRIGGER IF NOT EXISTS update_medical_records_ipfs_timestamp
AFTER UPDATE ON medical_records_ipfs
BEGIN
    UPDATE medical_records_ipfs 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Update updated_at timestamp for pinning_policies
CREATE TRIGGER IF NOT EXISTS update_pinning_policies_timestamp
AFTER UPDATE ON pinning_policies
BEGIN
    UPDATE pinning_policies 
    SET updated_at = CURRENT_TIMESTAMP 
    WHERE id = NEW.id;
END;

-- Update last_accessed timestamp for content_hashes
CREATE TRIGGER IF NOT EXISTS update_content_hash_access
AFTER SELECT ON content_hashes
BEGIN
    UPDATE content_hashes 
    SET last_accessed = CURRENT_TIMESTAMP 
    WHERE content_hash = NEW.content_hash;
END;
