-- Healthcare Provider Network Directory Database Schema
-- PostgreSQL with PostGIS for geospatial search capabilities

-- Enable PostGIS extension
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;

-- Provider specialties table
CREATE TABLE IF NOT EXISTS provider_specialties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL, -- 'medical', 'surgical', 'diagnostic', 'therapeutic'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider credentials and certifications
CREATE TABLE IF NOT EXISTS provider_credentials (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    issuing_organization VARCHAR(200) NOT NULL,
    credential_type VARCHAR(50) NOT NULL, -- 'license', 'board_certification', 'certificate', 'diploma'
    verification_required BOOLEAN DEFAULT TRUE,
    expiry_period_years INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Healthcare providers table with geospatial support
CREATE TABLE IF NOT EXISTS healthcare_providers (
    id SERIAL PRIMARY KEY,
    user_id INTEGER UNIQUE REFERENCES users(id),
    npi_number VARCHAR(20) UNIQUE, -- National Provider Identifier
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    professional_title VARCHAR(50),
    bio TEXT,
    profile_image_url VARCHAR(500),
    phone VARCHAR(20),
    email VARCHAR(255),
    website VARCHAR(500),
    
    -- Address with PostGIS geometry for geospatial search
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    zip_code VARCHAR(20),
    country VARCHAR(50) DEFAULT 'USA',
    
    -- Geospatial location
    location GEOGRAPHY(POINT, 4326), -- PostGIS point for location-based search
    
    -- Practice information
    practice_name VARCHAR(255),
    practice_type VARCHAR(50), -- 'solo', 'group', 'hospital', 'clinic'
    years_of_experience INTEGER,
    languages_spoken TEXT[], -- Array of languages
    
    -- Verification status
    is_verified BOOLEAN DEFAULT FALSE,
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'suspended'
    verification_date TIMESTAMP,
    rejection_reason TEXT,
    
    -- Availability settings
    accepts_new_patients BOOLEAN DEFAULT TRUE,
    telehealth_available BOOLEAN DEFAULT FALSE,
    
    -- Average ratings (calculated from reviews)
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    
    -- Search optimization
    search_vector TSVECTOR, -- For full-text search
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider-specialty relationship (many-to-many)
CREATE TABLE IF NOT EXISTS provider_specialties_map (
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    specialty_id INTEGER REFERENCES provider_specialties(id) ON DELETE CASCADE,
    is_primary BOOLEAN DEFAULT FALSE,
    years_experience INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_id, specialty_id)
);

-- Provider-credentials relationship (many-to-many)
CREATE TABLE IF NOT EXISTS provider_credentials_map (
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    credential_id INTEGER REFERENCES provider_credentials(id) ON DELETE CASCADE,
    credential_number VARCHAR(100),
    issue_date DATE,
    expiry_date DATE,
    verification_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'verified', 'expired', 'revoked'
    verification_document_url VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (provider_id, credential_id)
);

-- Provider availability schedule
CREATE TABLE IF NOT EXISTS provider_availability (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    opening_time TIME,
    closing_time TIME,
    is_available BOOLEAN DEFAULT TRUE,
    appointment_duration_minutes INTEGER DEFAULT 30,
    break_start_time TIME,
    break_end_time TIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Provider special availability (holidays, time off, etc.)
CREATE TABLE IF NOT EXISTS provider_special_availability (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    is_available BOOLEAN DEFAULT FALSE,
    reason VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Patient reviews
CREATE TABLE IF NOT EXISTS provider_reviews (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    patient_id INTEGER REFERENCES patients(id),
    appointment_id INTEGER REFERENCES appointments(id),
    
    -- Rating scores
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    bedside_manner_rating INTEGER CHECK (bedside_manner_rating BETWEEN 1 AND 5),
    wait_time_rating INTEGER CHECK (wait_time_rating BETWEEN 1 AND 5),
    staff_friendliness_rating INTEGER CHECK (staff_friendliness_rating BETWEEN 1 AND 5),
    
    -- Review content
    title VARCHAR(200),
    review_text TEXT,
    
    -- Moderation
    is_approved BOOLEAN DEFAULT FALSE,
    moderation_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'flagged'
    moderation_reason TEXT,
    moderated_by INTEGER REFERENCES users(id),
    moderated_at TIMESTAMP,
    
    -- Response from provider
    provider_response TEXT,
    provider_response_date TIMESTAMP,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_helpfulness (
    id SERIAL PRIMARY KEY,
    review_id INTEGER REFERENCES provider_reviews(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id),
    is_helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(review_id, user_id)
);

-- Provider verification documents
CREATE TABLE IF NOT EXISTS provider_verification_documents (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    document_type VARCHAR(50) NOT NULL, -- 'license', 'diploma', 'certificate', 'background_check'
    document_name VARCHAR(255) NOT NULL,
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER,
    mime_type VARCHAR(100),
    upload_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    verification_status VARCHAR(20) DEFAULT 'pending',
    verification_notes TEXT,
    verified_by INTEGER REFERENCES users(id),
    verified_at TIMESTAMP
);

-- Search index for providers (for Elasticsearch integration)
CREATE TABLE IF NOT EXISTS provider_search_index (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    search_data JSONB, -- Structured search data for Elasticsearch
    indexed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Third-party provider directory sync
CREATE TABLE IF NOT EXISTS provider_directory_sync (
    id SERIAL PRIMARY KEY,
    provider_id INTEGER REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    directory_name VARCHAR(100) NOT NULL, -- 'healthgrades', 'zocdoc', 'webmd', etc.
    directory_provider_id VARCHAR(100),
    sync_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'synced', 'error'
    last_synced TIMESTAMP,
    sync_data JSONB,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_providers_location ON healthcare_providers USING GIST (location);
CREATE INDEX IF NOT EXISTS idx_providers_verification_status ON healthcare_providers(verification_status);
CREATE INDEX IF NOT EXISTS idx_providers_specialties ON healthcare_providers USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_providers_accepting_patients ON healthcare_providers(accepts_new_patients);
CREATE INDEX IF NOT EXISTS idx_providers_rating ON healthcare_providers(average_rating);

CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider_id ON provider_reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_status ON provider_reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_rating ON provider_reviews(overall_rating);

CREATE INDEX IF NOT EXISTS idx_availability_provider_id ON provider_availability(provider_id);
CREATE INDEX IF NOT EXISTS idx_special_availability_provider_date ON provider_special_availability(provider_id, date);

CREATE INDEX IF NOT EXISTS idx_search_index_provider_id ON provider_search_index(provider_id);
CREATE INDEX IF NOT EXISTS idx_search_index_data ON provider_search_index USING GIN (search_data);

-- Create trigger to update search_vector
CREATE OR REPLACE FUNCTION update_provider_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.first_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.last_name, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.practice_name, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.bio, '')), 'C') ||
        setweight(to_tsvector('english', COALESCE(NEW.city, '')), 'D') ||
        setweight(to_tsvector('english', COALESCE(NEW.state, '')), 'D');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_search_vector
    BEFORE INSERT OR UPDATE ON healthcare_providers
    FOR EACH ROW EXECUTE FUNCTION update_provider_search_vector();

-- Create trigger to update average rating
CREATE OR REPLACE FUNCTION update_provider_rating()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE healthcare_providers 
        SET 
            average_rating = (
                SELECT COALESCE(AVG(overall_rating), 0) 
                FROM provider_reviews 
                WHERE provider_id = NEW.provider_id 
                AND moderation_status = 'approved'
            ),
            total_reviews = (
                SELECT COUNT(*) 
                FROM provider_reviews 
                WHERE provider_id = NEW.provider_id 
                AND moderation_status = 'approved'
            )
        WHERE id = NEW.provider_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE healthcare_providers 
        SET 
            average_rating = (
                SELECT COALESCE(AVG(overall_rating), 0) 
                FROM provider_reviews 
                WHERE provider_id = OLD.provider_id 
                AND moderation_status = 'approved'
            ),
            total_reviews = (
                SELECT COUNT(*) 
                FROM provider_reviews 
                WHERE provider_id = OLD.provider_id 
                AND moderation_status = 'approved'
            )
        WHERE id = OLD.provider_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_provider_rating
    AFTER INSERT OR UPDATE OR DELETE ON provider_reviews
    FOR EACH ROW EXECUTE FUNCTION update_provider_rating();

-- Insert default specialties
INSERT INTO provider_specialties (name, description, category) VALUES
('Family Medicine', 'Primary care for all ages', 'medical'),
('Internal Medicine', 'Adult primary care', 'medical'),
('Pediatrics', 'Medical care for children', 'medical'),
('Cardiology', 'Heart and cardiovascular system', 'medical'),
('Dermatology', 'Skin, hair, and nail conditions', 'medical'),
('Emergency Medicine', 'Emergency medical care', 'medical'),
('Gastroenterology', 'Digestive system disorders', 'medical'),
('Neurology', 'Nervous system disorders', 'medical'),
('Oncology', 'Cancer treatment', 'medical'),
('Orthopedics', 'Musculoskeletal system', 'surgical'),
('Psychiatry', 'Mental health disorders', 'medical'),
('General Surgery', 'Surgical procedures', 'surgical')
ON CONFLICT (name) DO NOTHING;

-- Insert default credentials
INSERT INTO provider_credentials (name, issuing_organization, credential_type, expiry_period_years) VALUES
('Medical Doctor License', 'State Medical Board', 'license', 2),
('Doctor of Medicine', 'Medical School', 'diploma', NULL),
('Board Certification', 'American Board of Medical Specialties', 'board_certification', 10),
('DEA Registration', 'Drug Enforcement Administration', 'license', 2),
('State Controlled Substance Registration', 'State Department of Health', 'license', 2)
ON CONFLICT DO NOTHING;
