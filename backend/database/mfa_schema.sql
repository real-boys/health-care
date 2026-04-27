-- Multi-Factor Authentication Database Schema
-- This file contains the database schema for MFA functionality

-- MFA Settings table for storing user's MFA configuration
CREATE TABLE IF NOT EXISTS mfa_settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL UNIQUE,
  totp_secret TEXT,
  totp_enabled BOOLEAN DEFAULT FALSE,
  backup_codes TEXT, -- JSON array of backup codes
  backup_codes_generated_at DATETIME,
  last_used_backup_code_index INTEGER,
  phone_number TEXT,
  sms_enabled BOOLEAN DEFAULT FALSE,
  email_enabled BOOLEAN DEFAULT FALSE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- MFA Sessions table for tracking MFA verification attempts
CREATE TABLE IF NOT EXISTS mfa_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  session_token TEXT UNIQUE NOT NULL,
  temp_token TEXT UNIQUE NOT NULL,
  mfa_verified BOOLEAN DEFAULT FALSE,
  verification_method TEXT CHECK (verification_method IN ('totp', 'backup_code', 'sms', 'email')),
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- MFA Attempts table for tracking failed attempts and rate limiting
CREATE TABLE IF NOT EXISTS mfa_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  attempt_type TEXT CHECK (attempt_type IN ('totp', 'backup_code', 'sms', 'email')),
  ip_address TEXT,
  user_agent TEXT,
  success BOOLEAN DEFAULT FALSE,
  failure_reason TEXT,
  attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Security Events table for auditing and monitoring
CREATE TABLE IF NOT EXISTS security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event_type TEXT CHECK (event_type IN (
    'mfa_enabled', 'mfa_disabled', 'mfa_verified', 'mfa_failed',
    'backup_codes_generated', 'backup_codes_used',
    'suspicious_login', 'account_locked', 'password_changed',
    'login_success', 'login_failure', 'logout'
  )),
  event_description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  session_id TEXT,
  metadata TEXT, -- JSON object for additional event data
  severity TEXT CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL
);

-- Add MFA-related columns to users table
ALTER TABLE users ADD COLUMN mfa_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN mfa_required BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN last_mfa_verification DATETIME;
ALTER TABLE users ADD COLUMN failed_mfa_attempts INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN account_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN locked_until DATETIME;

-- Create indexes for MFA tables
CREATE INDEX IF NOT EXISTS idx_mfa_settings_user_id ON mfa_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user_id ON mfa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_session_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_temp_token ON mfa_sessions(temp_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_expires_at ON mfa_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_user_id ON mfa_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_attempts_attempted_at ON mfa_attempts(attempted_at);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at);
CREATE INDEX IF NOT EXISTS idx_security_events_event_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);

-- Create triggers for updating timestamps
CREATE TRIGGER IF NOT EXISTS update_mfa_settings_timestamp 
  AFTER UPDATE ON mfa_settings
  BEGIN
    UPDATE mfa_settings SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

CREATE TRIGGER IF NOT EXISTS update_mfa_sessions_timestamp 
  AFTER UPDATE ON mfa_sessions
  BEGIN
    UPDATE mfa_sessions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
  END;

-- Create view for user MFA status
CREATE VIEW IF NOT EXISTS user_mfa_status AS
SELECT 
  u.id as user_id,
  u.email,
  u.role,
  u.mfa_enabled,
  u.mfa_required,
  u.last_mfa_verification,
  u.failed_mfa_attempts,
  u.account_locked,
  u.locked_until,
  m.totp_enabled,
  m.sms_enabled,
  m.email_enabled,
  m.backup_codes_generated_at,
  CASE 
    WHEN m.backup_codes IS NOT NULL THEN json_array_length(m.backup_codes)
    ELSE 0
  END as backup_codes_count,
  CASE 
    WHEN u.account_locked AND u.locked_until > CURRENT_TIMESTAMP THEN TRUE
    ELSE FALSE
  END as is_currently_locked
FROM users u
LEFT JOIN mfa_settings m ON u.id = m.user_id;

-- Create view for security dashboard
CREATE VIEW IF NOT EXISTS security_dashboard AS
SELECT 
  DATE(created_at) as event_date,
  event_type,
  severity,
  COUNT(*) as event_count,
  COUNT(DISTINCT user_id) as affected_users
FROM security_events
WHERE created_at >= DATE('now', '-30 days')
GROUP BY DATE(created_at), event_type, severity
ORDER BY event_date DESC, event_count DESC;
