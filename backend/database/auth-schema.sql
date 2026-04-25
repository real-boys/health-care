-- Authentication and Authorization System Schema for Healthcare Platform

-- Users table (extended from existing users table if needed)
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    avatar_url VARCHAR(500),
    
    -- Status fields
    is_active BOOLEAN DEFAULT true,
    is_verified BOOLEAN DEFAULT false,
    is_locked BOOLEAN DEFAULT false,
    lock_reason TEXT,
    locked_until TIMESTAMP,
    
    -- Security fields
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login_at TIMESTAMP,
    last_login_ip INET,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TIMESTAMP,
    
    -- MFA fields
    mfa_enabled BOOLEAN DEFAULT false,
    mfa_secret VARCHAR(255),
    backup_codes TEXT, -- JSON array of backup codes
    mfa_method VARCHAR(20) DEFAULT 'totp', -- 'totp', 'sms', 'email'
    
    -- OAuth fields
    oauth_provider VARCHAR(50), -- 'google', 'microsoft', 'facebook', etc.
    oauth_id VARCHAR(255),
    oauth_data JSONB,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Roles table
CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    level INTEGER DEFAULT 0, -- Higher level = more permissions
    is_system BOOLEAN DEFAULT false, -- System roles cannot be deleted
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Permissions table
CREATE TABLE IF NOT EXISTS permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    resource VARCHAR(100) NOT NULL, -- 'users', 'patients', 'invoices', etc.
    action VARCHAR(50) NOT NULL, -- 'create', 'read', 'update', 'delete', etc.
    is_system BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role permissions junction table
CREATE TABLE IF NOT EXISTS role_permissions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    permission_id INTEGER NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    UNIQUE(role_id, permission_id)
);

-- User roles junction table
CREATE TABLE IF NOT EXISTS user_roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    assigned_by INTEGER REFERENCES users(id),
    expires_at TIMESTAMP, -- For temporary role assignments
    is_active BOOLEAN DEFAULT true,
    UNIQUE(user_id, role_id)
);

-- Sessions table
CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    
    -- Session metadata
    device_info JSONB,
    user_agent TEXT,
    ip_address INET,
    location JSONB, -- {country, city, etc.}
    
    -- Session status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP NOT NULL,
    last_activity_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Security
    is_mfa_verified BOOLEAN DEFAULT false,
    mfa_verified_at TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Password reset tokens
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS email_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    verified_at TIMESTAMP,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- MFA session tokens
CREATE TABLE IF NOT EXISTS mfa_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    verification_code VARCHAR(10),
    backup_code_used BOOLEAN DEFAULT false,
    
    -- Metadata
    device_info JSONB,
    ip_address INET,
    user_agent TEXT,
    
    -- Status
    is_verified BOOLEAN DEFAULT false,
    verified_at TIMESTAMP,
    expires_at TIMESTAMP NOT NULL,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth provider configurations
CREATE TABLE IF NOT EXISTS oauth_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(50) UNIQUE NOT NULL, -- 'google', 'microsoft', 'facebook', etc.
    display_name VARCHAR(255) NOT NULL,
    client_id VARCHAR(255) NOT NULL,
    client_secret VARCHAR(255) NOT NULL,
    redirect_uri VARCHAR(500) NOT NULL,
    scopes TEXT, -- JSON array of scopes
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth user accounts
CREATE TABLE IF NOT EXISTS oauth_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider_id INTEGER NOT NULL REFERENCES oauth_providers(id),
    provider_user_id VARCHAR(255) NOT NULL,
    access_token TEXT,
    refresh_token TEXT,
    token_expires_at TIMESTAMP,
    profile_data JSONB, -- User profile from OAuth provider
    
    UNIQUE(provider_id, provider_user_id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security audit log
CREATE TABLE IF NOT EXISTS auth_audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER REFERENCES users(id),
    action VARCHAR(100) NOT NULL, -- 'login', 'logout', 'password_change', 'mfa_enabled', etc.
    resource_type VARCHAR(50), -- 'user', 'role', 'permission', etc.
    resource_id INTEGER,
    
    -- Request details
    ip_address INET,
    user_agent TEXT,
    device_info JSONB,
    
    -- Result
    success BOOLEAN NOT NULL,
    failure_reason TEXT,
    
    -- Additional data
    details JSONB, -- Additional context about the action
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Failed login attempts (for rate limiting and security monitoring)
CREATE TABLE IF NOT EXISTS failed_login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email VARCHAR(255) NOT NULL,
    ip_address INET,
    user_agent TEXT,
    failure_reason VARCHAR(255), -- 'invalid_password', 'account_locked', 'mfa_required', etc.
    attempted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password history (to prevent password reuse)
CREATE TABLE IF NOT EXISTS password_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    salt VARCHAR(255) NOT NULL,
    changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    changed_by INTEGER REFERENCES users(id)
);

-- Security policies
CREATE TABLE IF NOT EXISTS security_policies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    
    -- Password policies
    min_password_length INTEGER DEFAULT 8,
    require_uppercase BOOLEAN DEFAULT true,
    require_lowercase BOOLEAN DEFAULT true,
    require_numbers BOOLEAN DEFAULT true,
    require_special_chars BOOLEAN DEFAULT true,
    prevent_password_reuse INTEGER DEFAULT 5, -- Number of previous passwords to check
    password_expiry_days INTEGER DEFAULT 90,
    
    -- Session policies
    max_session_duration_hours INTEGER DEFAULT 24,
    max_concurrent_sessions INTEGER DEFAULT 5,
    require_mfa_for_admin BOOLEAN DEFAULT true,
    
    -- Lockout policies
    max_failed_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 30,
    
    -- MFA policies
    mfa_required_for_roles TEXT, -- JSON array of role names
    backup_codes_count INTEGER DEFAULT 10,
    
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API keys for service authentication
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    key_prefix VARCHAR(20) NOT NULL, -- First few characters for identification
    
    -- Permissions
    permissions TEXT, -- JSON array of permission names
    
    -- Rate limiting
    rate_limit_per_minute INTEGER DEFAULT 100,
    rate_limit_per_hour INTEGER DEFAULT 1000,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP,
    
    -- Metadata
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active);
CREATE INDEX IF NOT EXISTS idx_users_oauth ON users(oauth_provider, oauth_id);
CREATE INDEX IF NOT EXISTS idx_users_last_login ON users(last_login_at);

CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_roles_active ON roles(is_active);

CREATE INDEX IF NOT EXISTS idx_permissions_resource ON permissions(resource, action);

CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission ON role_permissions(permission_id);

CREATE INDEX IF NOT EXISTS idx_user_roles_user ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_expires ON user_roles(expires_at);

CREATE INDEX IF NOT EXISTS idx_sessions_token ON user_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_sessions_refresh ON user_sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON user_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_active ON user_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_sessions_expires ON user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_user ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_password_reset_expires ON password_reset_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_email_verification_token ON email_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_email_verification_user ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_expires ON email_verification_tokens(expires_at);

CREATE INDEX IF NOT EXISTS idx_mfa_sessions_token ON mfa_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_user ON mfa_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_mfa_sessions_expires ON mfa_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_oauth_accounts_user ON oauth_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_oauth_accounts_provider ON oauth_accounts(provider_id, provider_user_id);

CREATE INDEX IF NOT EXISTS idx_audit_log_user ON auth_audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON auth_audit_log(action);
CREATE INDEX IF NOT EXISTS idx_audit_log_created ON auth_audit_log(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_ip ON auth_audit_log(ip_address);

CREATE INDEX IF NOT EXISTS idx_failed_login_email ON failed_login_attempts(email);
CREATE INDEX IF NOT EXISTS idx_failed_login_ip ON failed_login_attempts(ip_address);
CREATE INDEX IF NOT EXISTS idx_failed_login_attempted ON failed_login_attempts(attempted_at);

CREATE INDEX IF NOT EXISTS idx_password_history_user ON password_history(user_id);
CREATE INDEX IF NOT EXISTS idx_password_history_changed ON password_history(changed_at);

CREATE INDEX IF NOT EXISTS idx_api_keys_hash ON api_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_api_keys_active ON api_keys(is_active);
CREATE INDEX IF NOT EXISTS idx_api_keys_expires ON api_keys(expires_at);

-- Create triggers for automatic updates
CREATE OR REPLACE FUNCTION update_user_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_user_updated_at();

CREATE TRIGGER trigger_role_updated_at
    BEFORE UPDATE ON roles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_updated_at();

CREATE OR REPLACE FUNCTION log_auth_event()
RETURNS TRIGGER AS $$
BEGIN
    -- Log significant user events
    IF TG_OP = 'INSERT' THEN
        INSERT INTO auth_audit_log (user_id, action, success, details)
        VALUES (NEW.id, 'user_created', true, json_object('username', NEW.username, 'email', NEW.email));
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.password_hash != NEW.password_hash THEN
            INSERT INTO auth_audit_log (user_id, action, success, details)
            VALUES (NEW.id, 'password_changed', true, json_object('changed_by', NEW.updated_by));
        ELSIF OLD.is_active != NEW.is_active THEN
            INSERT INTO auth_audit_log (user_id, action, success, details)
            VALUES (NEW.id, 'account_status_changed', true, json_object('old_status', OLD.is_active, 'new_status', NEW.is_active));
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_user_auth_log
    AFTER INSERT OR UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION log_auth_event();

-- Function to check password strength
CREATE OR REPLACE FUNCTION check_password_strength(password TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    min_length INTEGER;
    has_upper BOOLEAN;
    has_lower BOOLEAN;
    has_number BOOLEAN;
    has_special BOOLEAN;
BEGIN
    -- Get password policy
    SELECT min_password_length, require_uppercase, require_lowercase, require_numbers, require_special_chars
    INTO min_length, has_upper, has_lower, has_number, has_special
    FROM security_policies WHERE is_active = true LIMIT 1;
    
    -- Check length
    IF LENGTH(password) < min_length THEN
        RETURN FALSE;
    END IF;
    
    -- Check character requirements
    IF has_upper AND password !~ '[A-Z]' THEN
        RETURN FALSE;
    END IF;
    
    IF has_lower AND password !~ '[a-z]' THEN
        RETURN FALSE;
    END IF;
    
    IF has_number AND password !~ '[0-9]' THEN
        RETURN FALSE;
    END IF;
    
    IF has_special AND password !~ '[!@#$%^&*(),.?":{}|<>]' THEN
        RETURN FALSE;
    END IF;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Insert default roles
INSERT INTO roles (name, display_name, description, level, is_system) VALUES
('super_admin', 'Super Administrator', 'Full system access with all permissions', 100, true),
('admin', 'Administrator', 'Administrative access to most system features', 80, true),
('provider', 'Healthcare Provider', 'Access to patient records and billing', 60, true),
('staff', 'Staff Member', 'Limited access to specific functions', 40, true),
('patient', 'Patient', 'Access to own medical records and billing', 20, true),
('guest', 'Guest', 'Read-only access to public information', 10, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default permissions
INSERT INTO permissions (name, display_name, description, resource, action, is_system) VALUES
-- User management
('users.create', 'Create Users', 'Create new user accounts', 'users', 'create', true),
('users.read', 'Read Users', 'View user information', 'users', 'read', true),
('users.update', 'Update Users', 'Modify user accounts', 'users', 'update', true),
('users.delete', 'Delete Users', 'Delete user accounts', 'users', 'delete', true),
('users.manage_roles', 'Manage User Roles', 'Assign and remove user roles', 'users', 'manage_roles', true),

-- Role management
('roles.create', 'Create Roles', 'Create new roles', 'roles', 'create', true),
('roles.read', 'Read Roles', 'View role information', 'roles', 'read', true),
('roles.update', 'Update Roles', 'Modify role definitions', 'roles', 'update', true),
('roles.delete', 'Delete Roles', 'Delete role definitions', 'roles', 'delete', true),
('roles.assign_permissions', 'Assign Permissions', 'Assign permissions to roles', 'roles', 'assign_permissions', true),

-- Patient management
('patients.create', 'Create Patients', 'Create new patient records', 'patients', 'create', true),
('patients.read', 'Read Patients', 'View patient information', 'patients', 'read', true),
('patients.update', 'Update Patients', 'Modify patient records', 'patients', 'update', true),
('patients.delete', 'Delete Patients', 'Delete patient records', 'patients', 'delete', true),

-- Invoice management
('invoices.create', 'Create Invoices', 'Generate new invoices', 'invoices', 'create', true),
('invoices.read', 'Read Invoices', 'View invoice information', 'invoices', 'read', true),
('invoices.update', 'Update Invoices', 'Modify invoice details', 'invoices', 'update', true),
('invoices.delete', 'Delete Invoices', 'Cancel/delete invoices', 'invoices', 'delete', true),
('invoices.pay', 'Process Payments', 'Process invoice payments', 'invoices', 'pay', true),

-- System management
('system.audit', 'View Audit Logs', 'Access system audit logs', 'system', 'audit', true),
('system.config', 'System Configuration', 'Modify system settings', 'system', 'config', true),
('system.monitor', 'System Monitoring', 'Access system monitoring tools', 'system', 'monitor', true),

-- Authentication management
('auth.mfa_manage', 'Manage MFA', 'Configure multi-factor authentication', 'auth', 'mfa_manage', true),
('auth.oauth_manage', 'Manage OAuth', 'Configure OAuth providers', 'auth', 'oauth_manage', true),
('auth.api_keys', 'Manage API Keys', 'Create and manage API keys', 'auth', 'api_keys', true)
ON CONFLICT (name) DO NOTHING;

-- Assign permissions to roles
-- Super Admin gets all permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p WHERE r.name = 'super_admin'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Admin gets most permissions (except system-level)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin' AND p.name NOT LIKE 'system.%'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Provider gets patient and invoice permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'provider' AND p.resource IN ('patients', 'invoices')
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Patient gets limited permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'patient' AND (
    (p.resource = 'patients' AND p.action = 'read') OR
    (p.resource = 'invoices' AND p.action = 'read')
)
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Guest gets very limited read permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'guest' AND p.action = 'read'
ON CONFLICT (role_id, permission_id) DO NOTHING;

-- Insert default security policy
INSERT INTO security_policies (
    name, description, min_password_length, require_uppercase, require_lowercase,
    require_numbers, require_special_chars, prevent_password_reuse, password_expiry_days,
    max_session_duration_hours, max_concurrent_sessions, require_mfa_for_admin,
    max_failed_attempts, lockout_duration_minutes, mfa_required_for_roles,
    backup_codes_count
) VALUES (
    'Default Security Policy',
    'Default security settings for the healthcare platform',
    12, true, true, true, true, 5, 90, 24, 3, true, 5, 30,
    '["admin", "super_admin"]', 10
)
ON CONFLICT (name) DO NOTHING;

-- Insert default OAuth providers (configuration would be done via admin interface)
INSERT INTO oauth_providers (name, display_name, client_id, client_secret, redirect_uri, scopes)
VALUES 
('google', 'Google', 'your-google-client-id', 'your-google-client-secret', 'http://localhost:3000/auth/google/callback', '["openid", "profile", "email"]'),
('microsoft', 'Microsoft', 'your-microsoft-client-id', 'your-microsoft-client-secret', 'http://localhost:3000/auth/microsoft/callback', '["openid", "profile", "email"]'),
('facebook', 'Facebook', 'your-facebook-app-id', 'your-facebook-app-secret', 'http://localhost:3000/auth/facebook/callback', '["email", "public_profile"]')
ON CONFLICT (name) DO NOTHING;

-- Create a function to clean up expired sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM user_sessions 
    WHERE expires_at < CURRENT_TIMESTAMP OR (is_active = false AND last_activity_at < CURRENT_TIMESTAMP - INTERVAL '7 days');
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Clean up expired tokens
    DELETE FROM password_reset_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM email_verification_tokens WHERE expires_at < CURRENT_TIMESTAMP;
    DELETE FROM mfa_sessions WHERE expires_at < CURRENT_TIMESTAMP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to check account lockout
CREATE OR REPLACE FUNCTION check_account_lockout(user_email VARCHAR(255))
RETURNS BOOLEAN AS $$
DECLARE
    user_locked BOOLEAN;
    lock_until TIMESTAMP;
    failed_attempts INTEGER;
    max_attempts INTEGER;
    lockout_duration INTEGER;
BEGIN
    -- Check if user is locked
    SELECT is_locked, locked_until, failed_login_attempts
    INTO user_locked, lock_until, failed_attempts
    FROM users WHERE email = user_email;
    
    -- If user is locked and lockout period hasn't expired
    IF user_locked AND lock_until > CURRENT_TIMESTAMP THEN
        RETURN TRUE;
    END IF;
    
    -- Check if user should be locked due to failed attempts
    SELECT max_failed_attempts, lockout_duration_minutes
    INTO max_attempts, lockout_duration
    FROM security_policies WHERE is_active = true LIMIT 1;
    
    IF failed_attempts >= max_attempts THEN
        -- Lock the account
        UPDATE users 
        SET is_locked = true, 
            locked_until = CURRENT_TIMESTAMP + INTERVAL '1 minute' * lockout_duration,
            lock_reason = 'Too many failed login attempts'
        WHERE email = user_email;
        
        RETURN TRUE;
    END IF;
    
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql;
