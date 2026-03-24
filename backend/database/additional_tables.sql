-- Additional tables for Healthcare Provider Network Directory

-- Provider calendar integration table
CREATE TABLE IF NOT EXISTS provider_calendar_integration (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL, -- 'google', 'outlook', 'apple'
    tokens JSONB NOT NULL,
    calendar_id VARCHAR(255),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, provider)
);

-- Review reports table
CREATE TABLE IF NOT EXISTS review_reports (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES provider_reviews(id) ON DELETE CASCADE,
    reported_by INTEGER REFERENCES users(id),
    reason TEXT NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'inappropriate', 'spam', 'fake', 'conflict_of_interest', 'other'
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'resolved', 'dismissed'
    resolved_by INTEGER REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Directory configurations table
CREATE TABLE IF NOT EXISTS directory_configurations (
    id SERIAL PRIMARY KEY,
    directory_name VARCHAR(100) UNIQUE NOT NULL,
    api_key TEXT NOT NULL,
    api_secret TEXT,
    webhook_url VARCHAR(500),
    sync_frequency VARCHAR(20) DEFAULT 'weekly', -- 'daily', 'weekly', 'monthly'
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider search analytics
CREATE TABLE IF NOT EXISTS provider_search_analytics (
    id SERIAL PRIMARY KEY,
    search_date DATE NOT NULL,
    search_query TEXT,
    filters_used JSONB,
    results_count INTEGER,
    clicked_providers INTEGER[],
    user_location GEOGRAPHY(POINT, 4326),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider profile views
CREATE TABLE IF NOT EXISTS provider_profile_views (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    viewer_id INTEGER REFERENCES users(id),
    view_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    source VARCHAR(50), -- 'search', 'direct', 'referral'
    session_id VARCHAR(255)
);

-- Provider contact requests
CREATE TABLE IF NOT EXISTS provider_contact_requests (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES patients(id),
    request_type VARCHAR(50) NOT NULL, -- 'appointment', 'information', 'consultation'
    message TEXT,
    contact_info JSONB, -- phone, email, preferred_contact_method
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'responded', 'closed'
    provider_response TEXT,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider insurance accepted
CREATE TABLE IF NOT EXISTS provider_insurance_accepted (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    insurance_provider VARCHAR(255) NOT NULL,
    insurance_type VARCHAR(100), -- 'PPO', 'HMO', 'EPO', 'POS', 'Medicare', 'Medicaid'
    in_network BOOLEAN DEFAULT true,
    verification_status VARCHAR(20) DEFAULT 'self_reported', -- 'self_reported', 'verified', 'expired'
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(provider_id, insurance_provider, insurance_type)
);

-- Provider hospital affiliations
CREATE TABLE IF NOT EXISTS provider_hospital_affiliations (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    hospital_name VARCHAR(255) NOT NULL,
    hospital_address TEXT,
    affiliation_type VARCHAR(50), -- 'attending', 'consulting', 'privileges'
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider education and training
CREATE TABLE IF NOT EXISTS provider_education (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    institution_name VARCHAR(255) NOT NULL,
    degree VARCHAR(100) NOT NULL,
    field_of_study VARCHAR(100),
    start_date DATE,
    end_date DATE,
    graduation_year INTEGER,
    is_current BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider awards and recognition
CREATE TABLE IF NOT EXISTS provider_awards (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    award_name VARCHAR(255) NOT NULL,
    awarding_organization VARCHAR(255),
    award_date DATE,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for additional tables
CREATE INDEX IF NOT EXISTS idx_calendar_integration_provider ON provider_calendar_integration(provider_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_review_id ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(status);
CREATE INDEX IF NOT EXISTS idx_search_analytics_date ON provider_search_analytics(search_date);
CREATE INDEX IF NOT EXISTS idx_profile_views_provider ON provider_profile_views(provider_id);
CREATE INDEX IF NOT EXISTS idx_profile_views_date ON provider_profile_views(view_date);
CREATE INDEX IF NOT EXISTS idx_contact_requests_provider ON provider_contact_requests(provider_id);
CREATE INDEX IF NOT EXISTS idx_contact_requests_status ON provider_contact_requests(status);
CREATE INDEX IF NOT EXISTS idx_insurance_accepted_provider ON provider_insurance_accepted(provider_id);
CREATE INDEX IF NOT EXISTS idx_hospital_affiliations_provider ON provider_hospital_affiliations(provider_id);
CREATE INDEX IF NOT EXISTS idx_education_provider ON provider_education(provider_id);
CREATE INDEX IF NOT EXISTS idx_awards_provider ON provider_awards(provider_id);

-- Add columns to existing healthcare_providers table if they don't exist
ALTER TABLE healthcare_providers 
ADD COLUMN IF NOT EXISTS gender VARCHAR(20),
ADD COLUMN IF NOT EXISTS consultation_fee DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS virtual_visit_price DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS insurance_accepted TEXT[],
ADD COLUMN IF NOT EXISTS hospital_affiliations JSONB,
ADD COLUMN IF NOT EXISTS education JSONB,
ADD COLUMN IF NOT EXISTS awards JSONB,
ADD COLUMN IF NOT EXISTS medical_school VARCHAR(255),
ADD COLUMN IF NOT EXISTS residency VARCHAR(255),
ADD COLUMN IF NOT EXISTS fellowship VARCHAR(255),
ADD COLUMN IF NOT EXISTS board_certifications JSONB,
ADD COLUMN IF NOT EXISTS conditions_treated TEXT[],
ADD COLUMN IF NOT EXISTS procedures_performed TEXT[];

-- Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_providers_gender ON healthcare_providers(gender);
CREATE INDEX IF NOT EXISTS idx_providers_insurance ON healthcare_providers USING GIN (insurance_accepted);

-- Create trigger to track profile views
CREATE OR REPLACE FUNCTION track_provider_profile_view()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'SELECT' THEN
        INSERT INTO provider_profile_views (provider_id, viewer_id, source, session_id)
        VALUES (NEW.id, NULL, 'search', NULL)
        ON CONFLICT DO NOTHING;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Note: This trigger would need to be implemented carefully to avoid performance issues
-- CREATE TRIGGER trigger_track_profile_view
--     AFTER SELECT ON healthcare_providers
--     FOR EACH ROW EXECUTE FUNCTION track_provider_profile_view();
