-- Healthcare Provider Network Directory Database Schema (SQLite Compatible)
-- Comprehensive provider directory with search, filters, ratings, and appointment booking

-- Provider specialties table
CREATE TABLE IF NOT EXISTS provider_specialties (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    description TEXT,
    category TEXT NOT NULL, -- 'medical', 'surgical', 'diagnostic', 'therapeutic'
    icon TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Provider credentials and certifications
CREATE TABLE IF NOT EXISTS provider_credentials (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    issuing_organization TEXT NOT NULL,
    credential_type TEXT NOT NULL, -- 'license', 'board_certification', 'certificate', 'diploma'
    verification_required INTEGER DEFAULT 1,
    expiry_period_years INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Healthcare providers table
CREATE TABLE IF NOT EXISTS healthcare_providers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE,
    npi_number TEXT UNIQUE, -- National Provider Identifier
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    professional_title TEXT,
    bio TEXT,
    profile_image_url TEXT,
    phone TEXT,
    email TEXT,
    website TEXT,
    
    -- Address
    address_line1 TEXT,
    address_line2 TEXT,
    city TEXT,
    state TEXT,
    zip_code TEXT,
    country TEXT DEFAULT 'USA',
    
    -- Location coordinates for geospatial search
    latitude REAL,
    longitude REAL,
    
    -- Practice information
    practice_name TEXT,
    practice_type TEXT, -- 'solo', 'group', 'hospital', 'clinic'
    years_of_experience INTEGER,
    languages_spoken TEXT, -- JSON array of languages
    gender TEXT,
    
    -- Verification status
    is_verified INTEGER DEFAULT 0,
    verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'rejected', 'suspended'
    verification_date DATETIME,
    rejection_reason TEXT,
    
    -- Availability settings
    accepts_new_patients INTEGER DEFAULT 1,
    telehealth_available INTEGER DEFAULT 0,
    
    -- Consultation info
    consultation_fee REAL,
    virtual_visit_price REAL,
    
    -- Average ratings (calculated from reviews)
    average_rating REAL DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    
    -- Insurance accepted (JSON array)
    insurance_accepted TEXT,
    
    -- Hospital affiliations (JSON array)
    hospital_affiliations TEXT,
    
    -- Education (JSON array)
    education TEXT,
    
    -- Board certifications (JSON array)
    board_certifications TEXT,
    
    -- Conditions treated (JSON array)
    conditions_treated TEXT,
    
    -- Procedures performed (JSON array)
    procedures_performed TEXT,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Provider-specialty relationship (many-to-many)
CREATE TABLE IF NOT EXISTS provider_specialties_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    specialty_id INTEGER NOT NULL,
    is_primary INTEGER DEFAULT 0,
    years_experience INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (specialty_id) REFERENCES provider_specialties(id) ON DELETE CASCADE,
    UNIQUE(provider_id, specialty_id)
);

-- Provider-credentials relationship (many-to-many)
CREATE TABLE IF NOT EXISTS provider_credentials_map (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    credential_id INTEGER NOT NULL,
    credential_number TEXT,
    issue_date DATE,
    expiry_date DATE,
    verification_status TEXT DEFAULT 'pending', -- 'pending', 'verified', 'expired', 'revoked'
    verification_document_url TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (credential_id) REFERENCES provider_credentials(id) ON DELETE CASCADE,
    UNIQUE(provider_id, credential_id)
);

-- Provider availability schedule
CREATE TABLE IF NOT EXISTS provider_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    day_of_week INTEGER CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sunday, 6=Saturday
    opening_time TEXT,
    closing_time TEXT,
    is_available INTEGER DEFAULT 1,
    appointment_duration_minutes INTEGER DEFAULT 30,
    break_start_time TEXT,
    break_end_time TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE
);

-- Provider special availability (holidays, time off, etc.)
CREATE TABLE IF NOT EXISTS provider_special_availability (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    date DATE NOT NULL,
    is_available INTEGER DEFAULT 0,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    UNIQUE(provider_id, date)
);

-- Appointments table
CREATE TABLE IF NOT EXISTS appointments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    appointment_date DATETIME NOT NULL,
    duration_minutes INTEGER DEFAULT 30,
    appointment_type TEXT, -- 'consultation', 'follow_up', 'procedure', 'telemedicine'
    status TEXT DEFAULT 'scheduled', -- 'scheduled', 'confirmed', 'completed', 'cancelled', 'no_show'
    notes TEXT,
    reason_for_visit TEXT,
    virtual INTEGER DEFAULT 0,
    meeting_link TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE
);

-- Patient reviews
CREATE TABLE IF NOT EXISTS provider_reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    patient_id INTEGER,
    appointment_id INTEGER,
    
    -- Rating scores
    overall_rating INTEGER CHECK (overall_rating BETWEEN 1 AND 5),
    bedside_manner_rating INTEGER CHECK (bedside_manner_rating BETWEEN 1 AND 5),
    wait_time_rating INTEGER CHECK (wait_time_rating BETWEEN 1 AND 5),
    staff_friendliness_rating INTEGER CHECK (staff_friendliness_rating BETWEEN 1 AND 5),
    
    -- Review content
    title TEXT,
    review_text TEXT,
    
    -- Moderation
    is_approved INTEGER DEFAULT 0,
    moderation_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'flagged'
    moderation_reason TEXT,
    moderated_by INTEGER,
    moderated_at DATETIME,
    
    -- Response from provider
    provider_response TEXT,
    provider_response_date DATETIME,
    
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    FOREIGN KEY (patient_id) REFERENCES patients(id),
    FOREIGN KEY (appointment_id) REFERENCES appointments(id)
);

-- Review helpfulness votes
CREATE TABLE IF NOT EXISTS review_helpfulness (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    is_helpful INTEGER NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES provider_reviews(id) ON DELETE CASCADE,
    UNIQUE(review_id, user_id)
);

-- Review reports
CREATE TABLE IF NOT EXISTS review_reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    review_id INTEGER NOT NULL,
    reported_by INTEGER NOT NULL,
    reason TEXT NOT NULL,
    report_type TEXT, -- 'inappropriate', 'spam', 'fake', 'conflict_of_interest', 'other'
    status TEXT DEFAULT 'pending', -- 'pending', 'resolved'
    resolved_by INTEGER,
    resolved_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (review_id) REFERENCES provider_reviews(id) ON DELETE CASCADE
);

-- Provider verification documents
CREATE TABLE IF NOT EXISTS provider_verification_documents (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    document_type TEXT NOT NULL, -- 'license', 'diploma', 'certificate', 'background_check'
    document_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_size INTEGER,
    mime_type TEXT,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    verification_status TEXT DEFAULT 'pending',
    verification_notes TEXT,
    verified_by INTEGER,
    verified_at DATETIME,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE
);

-- Provider favorites (saved providers for patients)
CREATE TABLE IF NOT EXISTS provider_favorites (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    patient_id INTEGER NOT NULL,
    provider_id INTEGER NOT NULL,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (patient_id) REFERENCES patients(id) ON DELETE CASCADE,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE,
    UNIQUE(patient_id, provider_id)
);

-- Provider profile shares
CREATE TABLE IF NOT EXISTS provider_shares (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider_id INTEGER NOT NULL,
    shared_by INTEGER NOT NULL,
    share_method TEXT, -- 'email', 'sms', 'link', 'social'
    recipient_email TEXT,
    share_token TEXT UNIQUE,
    viewed INTEGER DEFAULT 0,
    viewed_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (provider_id) REFERENCES healthcare_providers(id) ON DELETE CASCADE
);

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_providers_city ON healthcare_providers(city);
CREATE INDEX IF NOT EXISTS idx_providers_state ON healthcare_providers(state);
CREATE INDEX IF NOT EXISTS idx_providers_zip ON healthcare_providers(zip_code);
CREATE INDEX IF NOT EXISTS idx_providers_verification_status ON healthcare_providers(verification_status);
CREATE INDEX IF NOT EXISTS idx_providers_accepting_patients ON healthcare_providers(accepts_new_patients);
CREATE INDEX IF NOT EXISTS idx_providers_rating ON healthcare_providers(average_rating);
CREATE INDEX IF NOT EXISTS idx_providers_telehealth ON healthcare_providers(telehealth_available);
CREATE INDEX IF NOT EXISTS idx_providers_location ON healthcare_providers(latitude, longitude);

CREATE INDEX IF NOT EXISTS idx_provider_specialties_provider ON provider_specialties_map(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_specialties_specialty ON provider_specialties_map(specialty_id);

CREATE INDEX IF NOT EXISTS idx_provider_reviews_provider ON provider_reviews(provider_id);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_status ON provider_reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_provider_reviews_rating ON provider_reviews(overall_rating);

CREATE INDEX IF NOT EXISTS idx_appointments_provider ON appointments(provider_id);
CREATE INDEX IF NOT EXISTS idx_appointments_patient ON appointments(patient_id);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments(status);

CREATE INDEX IF NOT EXISTS idx_availability_provider ON provider_availability(provider_id);
CREATE INDEX IF NOT EXISTS idx_special_availability_provider_date ON provider_special_availability(provider_id, date);

CREATE INDEX IF NOT EXISTS idx_favorites_patient ON provider_favorites(patient_id);
CREATE INDEX IF NOT EXISTS idx_favorites_provider ON provider_favorites(provider_id);

-- Insert default specialties
INSERT OR IGNORE INTO provider_specialties (name, description, category, icon) VALUES
('Family Medicine', 'Primary care for all ages', 'medical', 'users'),
('Internal Medicine', 'Adult primary care', 'medical', 'heart'),
('Pediatrics', 'Medical care for children', 'medical', 'baby'),
('Cardiology', 'Heart and cardiovascular system', 'medical', 'heart'),
('Dermatology', 'Skin, hair, and nail conditions', 'medical', 'shield'),
('Emergency Medicine', 'Emergency medical care', 'medical', 'alert-triangle'),
('Gastroenterology', 'Digestive system disorders', 'medical', 'activity'),
('Neurology', 'Nervous system disorders', 'medical', 'brain'),
('Oncology', 'Cancer treatment', 'medical', 'cross'),
('Orthopedics', 'Musculoskeletal system', 'surgical', 'bone'),
('Psychiatry', 'Mental health disorders', 'medical', 'brain'),
('General Surgery', 'Surgical procedures', 'surgical', 'scissors'),
('OB/GYN', 'Obstetrics and Gynecology', 'medical', 'heart'),
('Ophthalmology', 'Eye care and surgery', 'medical', 'eye'),
('ENT', 'Ear, Nose, and Throat', 'medical', 'headphones'),
('Urology', 'Urinary tract and male reproductive system', 'surgical', 'droplet'),
('Plastic Surgery', 'Cosmetic and reconstructive surgery', 'surgical', 'scissors'),
('Radiology', 'Medical imaging', 'diagnostic', 'image'),
('Anesthesiology', 'Pain management and anesthesia', 'medical', 'activity'),
('Physical Medicine', 'Physical therapy and rehabilitation', 'therapeutic', 'activity');

-- Insert default credentials
INSERT OR IGNORE INTO provider_credentials (name, issuing_organization, credential_type, expiry_period_years) VALUES
('Medical Doctor License', 'State Medical Board', 'license', 2),
('Doctor of Medicine', 'Medical School', 'diploma', NULL),
('Doctor of Osteopathic Medicine', 'Medical School', 'diploma', NULL),
('Board Certification', 'American Board of Medical Specialties', 'board_certification', 10),
('DEA Registration', 'Drug Enforcement Administration', 'license', 2),
('State Controlled Substance Registration', 'State Department of Health', 'license', 2),
('Advanced Cardiac Life Support (ACLS)', 'American Heart Association', 'certificate', 2),
('Basic Life Support (BLS)', 'American Heart Association', 'certificate', 2);
