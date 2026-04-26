-- User Profile Management Schema
-- Extends the existing auth-schema users table

-- Profile customization table
CREATE TABLE IF NOT EXISTS user_profiles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Extended personal info
    display_name VARCHAR(150),
    bio TEXT,
    tagline VARCHAR(255),
    website_url VARCHAR(500),
    linkedin_url VARCHAR(500),
    twitter_handle VARCHAR(100),
    
    -- Location
    city VARCHAR(100),
    state VARCHAR(100),
    country VARCHAR(100),
    timezone VARCHAR(100) DEFAULT 'UTC',
    
    -- Professional
    department VARCHAR(150),
    specialization VARCHAR(150),
    license_number VARCHAR(100),
    years_experience INTEGER,
    
    -- Customization
    theme VARCHAR(20) DEFAULT 'dark',
    accent_color VARCHAR(20) DEFAULT 'indigo',
    avatar_url VARCHAR(500),
    cover_image_url VARCHAR(500),
    
    -- Verification
    is_email_verified BOOLEAN DEFAULT FALSE,
    is_phone_verified BOOLEAN DEFAULT FALSE,
    is_identity_verified BOOLEAN DEFAULT FALSE,
    identity_verification_date TIMESTAMP,
    identity_verification_method VARCHAR(50),
    
    -- Profile completeness score (0-100)
    completeness_score INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Privacy settings table
CREATE TABLE IF NOT EXISTS user_privacy_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    
    -- Profile visibility
    profile_visibility VARCHAR(20) DEFAULT 'registered', -- 'private', 'registered', 'public'
    
    -- Field-level visibility
    show_email BOOLEAN DEFAULT FALSE,
    show_phone BOOLEAN DEFAULT FALSE,
    show_location BOOLEAN DEFAULT TRUE,
    show_department BOOLEAN DEFAULT TRUE,
    show_bio BOOLEAN DEFAULT TRUE,
    show_activity BOOLEAN DEFAULT TRUE,
    show_online_status BOOLEAN DEFAULT TRUE,
    
    -- Data controls
    allow_search_indexing BOOLEAN DEFAULT FALSE,
    allow_data_collection BOOLEAN DEFAULT TRUE,
    allow_analytics BOOLEAN DEFAULT TRUE,
    allow_third_party_sharing BOOLEAN DEFAULT FALSE,
    allow_marketing_emails BOOLEAN DEFAULT FALSE,
    
    -- Contact preferences
    allow_direct_messages BOOLEAN DEFAULT TRUE,
    allow_connection_requests BOOLEAN DEFAULT TRUE,
    
    -- GDPR / compliance
    gdpr_consent BOOLEAN DEFAULT FALSE,
    gdpr_consent_date TIMESTAMP,
    data_retention_preference VARCHAR(20) DEFAULT '1year', -- '30days','90days','1year','indefinite'
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profile analytics table
CREATE TABLE IF NOT EXISTS profile_analytics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- View tracking
    profile_views INTEGER DEFAULT 0,
    profile_views_this_week INTEGER DEFAULT 0,
    profile_views_this_month INTEGER DEFAULT 0,
    
    -- Activity metrics
    total_logins INTEGER DEFAULT 0,
    total_actions INTEGER DEFAULT 0,
    last_active_at TIMESTAMP,
    
    -- Engagement
    claims_submitted INTEGER DEFAULT 0,
    documents_uploaded INTEGER DEFAULT 0,
    searches_performed INTEGER DEFAULT 0,
    
    -- Computed
    engagement_score DECIMAL(5,2) DEFAULT 0.00,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Profile view log (who viewed whose profile)
CREATE TABLE IF NOT EXISTS profile_view_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    profile_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    viewer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
    viewer_ip VARCHAR(45),
    viewed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Email verification tokens
CREATE TABLE IF NOT EXISTS profile_verification_tokens (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(255) NOT NULL UNIQUE,
    type VARCHAR(30) NOT NULL, -- 'email', 'phone', 'identity'
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data export requests
CREATE TABLE IF NOT EXISTS data_export_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'processing', 'completed', 'failed'
    format VARCHAR(10) DEFAULT 'json', -- 'json', 'csv', 'pdf'
    file_url VARCHAR(500),
    requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    expires_at TIMESTAMP
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_privacy_settings_user_id ON user_privacy_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_analytics_user_id ON profile_analytics(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_log_profile_user_id ON profile_view_log(profile_user_id);
CREATE INDEX IF NOT EXISTS idx_profile_view_log_viewed_at ON profile_view_log(viewed_at);
CREATE INDEX IF NOT EXISTS idx_profile_verification_tokens_user_id ON profile_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_profile_verification_tokens_token ON profile_verification_tokens(token);
CREATE INDEX IF NOT EXISTS idx_data_export_requests_user_id ON data_export_requests(user_id);
