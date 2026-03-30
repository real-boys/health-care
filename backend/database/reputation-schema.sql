-- Reputation System Database Schema
-- Multi-faceted reputation system for providers, patients, and contributors

-- Reputation profiles for each user type
CREATE TABLE IF NOT EXISTS reputation_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('provider', 'patient', 'contributor')),
  overall_score DECIMAL(5,2) DEFAULT 0.00,
  total_ratings INTEGER DEFAULT 0,
  average_rating DECIMAL(3,2) DEFAULT 0.00,
  reputation_level TEXT DEFAULT 'new' CHECK (reputation_level IN ('new', 'bronze', 'silver', 'gold', 'platinum', 'diamond')),
  trust_score DECIMAL(5,2) DEFAULT 0.00,
  reliability_score DECIMAL(5,2) DEFAULT 0.00,
  quality_score DECIMAL(5,2) DEFAULT 0.00,
  engagement_score DECIMAL(5,2) DEFAULT 0.00,
  total_reviews INTEGER DEFAULT 0,
  positive_reviews INTEGER DEFAULT 0,
  negative_reviews INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(user_id, profile_type)
);

-- Ratings and reviews system
CREATE TABLE IF NOT EXISTS ratings_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reviewer_id INTEGER NOT NULL,
  reviewee_id INTEGER NOT NULL,
  reviewee_type TEXT NOT NULL CHECK (reviewee_type IN ('provider', 'patient', 'contributor')),
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_title TEXT,
  review_text TEXT,
  review_category TEXT CHECK (review_category IN ('service_quality', 'communication', 'timeliness', 'professionalism', 'expertise', 'bedside_manner', 'follow_up_care', 'overall_experience')),
  service_date DATE,
  appointment_id INTEGER,
  medical_record_id INTEGER,
  claim_id INTEGER,
  is_verified BOOLEAN DEFAULT FALSE,
  is_anonymous BOOLEAN DEFAULT FALSE,
  is_featured BOOLEAN DEFAULT FALSE,
  helpful_votes INTEGER DEFAULT 0,
  report_count INTEGER DEFAULT 0,
  moderation_status TEXT DEFAULT 'pending' CHECK (moderation_status IN ('pending', 'approved', 'rejected', 'flagged')),
  moderation_notes TEXT,
  moderated_by INTEGER,
  moderated_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (reviewer_id) REFERENCES users (id),
  FOREIGN KEY (reviewee_id) REFERENCES users (id),
  FOREIGN KEY (appointment_id) REFERENCES appointments (id),
  FOREIGN KEY (medical_record_id) REFERENCES medical_records (id),
  FOREIGN KEY (claim_id) REFERENCES insurance_claims (id),
  FOREIGN KEY (moderated_by) REFERENCES users (id)
);

-- Badge system
CREATE TABLE IF NOT EXISTS badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  badge_name TEXT UNIQUE NOT NULL,
  badge_description TEXT,
  badge_icon TEXT,
  badge_category TEXT CHECK (badge_category IN ('achievement', 'milestone', 'quality', 'quantity', 'special', 'seasonal')),
  badge_level TEXT CHECK (badge_level IN ('bronze', 'silver', 'gold', 'platinum', 'diamond')),
  points_value INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  is_secret BOOLEAN DEFAULT FALSE,
  unlock_criteria TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User badges earned
CREATE TABLE IF NOT EXISTS user_badges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  badge_id INTEGER NOT NULL,
  earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  progress_percentage DECIMAL(5,2) DEFAULT 0.00,
  is_displayed BOOLEAN DEFAULT TRUE,
  notification_sent BOOLEAN DEFAULT FALSE,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (badge_id) REFERENCES badges (id),
  UNIQUE(user_id, badge_id)
);

-- Reputation history tracking
CREATE TABLE IF NOT EXISTS reputation_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('rating_received', 'rating_given', 'badge_earned', 'milestone_reached', 'review_posted', 'review_moderated', 'score_change')),
  event_description TEXT,
  previous_score DECIMAL(5,2),
  new_score DECIMAL(5,2),
  score_change DECIMAL(5,2),
  related_user_id INTEGER,
  related_rating_id INTEGER,
  related_badge_id INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  FOREIGN KEY (related_user_id) REFERENCES users (id),
  FOREIGN KEY (related_rating_id) REFERENCES ratings_reviews (id),
  FOREIGN KEY (related_badge_id) REFERENCES badges (id)
);

-- Reputation metrics and analytics
CREATE TABLE IF NOT EXISTS reputation_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  metric_date DATE NOT NULL,
  daily_rating_average DECIMAL(3,2),
  daily_review_count INTEGER DEFAULT 0,
  daily_positive_reviews INTEGER DEFAULT 0,
  daily_negative_reviews INTEGER DEFAULT 0,
  daily_helpful_votes INTEGER DEFAULT 0,
  daily_profile_views INTEGER DEFAULT 0,
  daily_search_appearances INTEGER DEFAULT 0,
  daily_inquiries INTEGER DEFAULT 0,
  weekly_score_change DECIMAL(5,2),
  monthly_score_change DECIMAL(5,2),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id),
  UNIQUE(user_id, metric_date)
);

-- Review helpful votes
CREATE TABLE IF NOT EXISTS review_votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  voter_id INTEGER NOT NULL,
  vote_type TEXT CHECK (vote_type IN ('helpful', 'not_helpful')),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES ratings_reviews (id),
  FOREIGN KEY (voter_id) REFERENCES users (id),
  UNIQUE(review_id, voter_id)
);

-- Review reports
CREATE TABLE IF NOT EXISTS review_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  review_id INTEGER NOT NULL,
  reporter_id INTEGER NOT NULL,
  report_reason TEXT CHECK (report_reason IN ('spam', 'fake_review', 'inappropriate_content', 'conflict_of_interest', 'personal_info', 'harassment', 'other')),
  report_description TEXT,
  report_status TEXT DEFAULT 'pending' CHECK (report_status IN ('pending', 'under_review', 'resolved', 'dismissed')),
  reviewed_by INTEGER,
  reviewed_at DATETIME,
  resolution_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (review_id) REFERENCES ratings_reviews (id),
  FOREIGN KEY (reporter_id) REFERENCES users (id),
  FOREIGN KEY (reviewed_by) REFERENCES users (id)
);

-- Reputation level requirements
CREATE TABLE IF NOT EXISTS reputation_levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  level_name TEXT UNIQUE NOT NULL,
  level_order INTEGER UNIQUE NOT NULL,
  minimum_score DECIMAL(5,2) NOT NULL,
  minimum_ratings INTEGER DEFAULT 0,
  minimum_reviews INTEGER DEFAULT 0,
  level_benefits TEXT,
  level_color TEXT,
  level_icon TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Provider-specific reputation factors
CREATE TABLE IF NOT EXISTS provider_reputation_factors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  provider_id INTEGER NOT NULL,
  patient_satisfaction_score DECIMAL(5,2),
  clinical_outcome_score DECIMAL(5,2),
  wait_time_score DECIMAL(5,2),
  communication_score DECIMAL(5,2),
  availability_score DECIMAL(5,2),
  cost_effectiveness_score DECIMAL(5,2),
  technology_adoption_score DECIMAL(5,2),
  peer_recognition_score DECIMAL(5,2),
  continuing_education_score DECIMAL(5,2),
  community_contribution_score DECIMAL(5,2),
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (provider_id) REFERENCES users (id),
  UNIQUE(provider_id)
);

-- Patient-specific reputation factors
CREATE TABLE IF NOT EXISTS patient_reputation_factors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  patient_id INTEGER NOT NULL,
  appointment_attendance_rate DECIMAL(5,2),
  payment_compliance_rate DECIMAL(5,2),
  treatment_compliance_rate DECIMAL(5,2),
  communication_responsiveness_score DECIMAL(5,2),
  feedback_quality_score DECIMAL(5,2),
  preventive_care_adherence DECIMAL(5,2),
  health_improvement_score DECIMAL(5,2),
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (patient_id) REFERENCES users (id),
  UNIQUE(patient_id)
);

-- Contributor-specific reputation factors
CREATE TABLE IF NOT EXISTS contributor_reputation_factors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  contributor_id INTEGER NOT NULL,
  content_quality_score DECIMAL(5,2),
  content_frequency_score DECIMAL(5,2),
  community_engagement_score DECIMAL(5,2),
  helpfulness_score DECIMAL(5,2),
  expertise_validation_score DECIMAL(5,2),
  peer_review_score DECIMAL(5,2),
  contribution_diversity_score DECIMAL(5,2),
  mentorship_score DECIMAL(5,2),
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (contributor_id) REFERENCES users (id),
  UNIQUE(contributor_id)
);

-- Reputation comparison data
CREATE TABLE IF NOT EXISTS reputation_comparisons (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  comparison_group TEXT CHECK (comparison_group IN ('all_providers', 'specialty', 'region', 'facility', 'experience_level')),
  percentile_rank DECIMAL(5,2),
  group_average_score DECIMAL(5,2),
  group_size INTEGER,
  comparison_date DATE DEFAULT CURRENT_DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Reputation notifications
CREATE TABLE IF NOT EXISTS reputation_notifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  notification_type TEXT CHECK (notification_type IN ('new_review', 'rating_change', 'badge_earned', 'milestone_reached', 'comparison_update', 'review_moderated')),
  notification_title TEXT NOT NULL,
  notification_message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  action_required BOOLEAN DEFAULT FALSE,
  action_url TEXT,
  related_entity_id INTEGER,
  related_entity_type TEXT,
  expires_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id)
);

-- Indexes for reputation system
CREATE INDEX IF NOT EXISTS idx_reputation_profiles_user_id ON reputation_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_profiles_type ON reputation_profiles(profile_type);
CREATE INDEX IF NOT EXISTS idx_reputation_profiles_score ON reputation_profiles(overall_score);
CREATE INDEX IF NOT EXISTS idx_ratings_reviews_reviewee ON ratings_reviews(reviewee_id, reviewee_type);
CREATE INDEX IF NOT EXISTS idx_ratings_reviews_reviewer ON ratings_reviews(reviewer_id);
CREATE INDEX IF NOT EXISTS idx_ratings_reviews_rating ON ratings_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_ratings_reviews_status ON ratings_reviews(moderation_status);
CREATE INDEX IF NOT EXISTS idx_ratings_reviews_date ON ratings_reviews(created_at);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned ON user_badges(earned_at);
CREATE INDEX IF NOT EXISTS idx_reputation_history_user_id ON reputation_history(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_history_date ON reputation_history(created_at);
CREATE INDEX IF NOT EXISTS idx_reputation_metrics_user_date ON reputation_metrics(user_id, metric_date);
CREATE INDEX IF NOT EXISTS idx_review_votes_review ON review_votes(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_review ON review_reports(review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_status ON review_reports(report_status);
CREATE INDEX IF NOT EXISTS idx_provider_factors_provider ON provider_reputation_factors(provider_id);
CREATE INDEX IF NOT EXISTS idx_patient_factors_patient ON patient_reputation_factors(patient_id);
CREATE INDEX IF NOT EXISTS idx_contributor_factors_contributor ON contributor_reputation_factors(contributor_id);
CREATE INDEX IF NOT EXISTS idx_reputation_comparisons_user_group ON reputation_comparisons(user_id, comparison_group);
CREATE INDEX IF NOT EXISTS idx_reputation_notifications_user ON reputation_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reputation_notifications_read ON reputation_notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_reputation_notifications_type ON reputation_notifications(notification_type);

-- Insert default reputation levels
INSERT OR IGNORE INTO reputation_levels (level_name, level_order, minimum_score, minimum_ratings, level_benefits, level_color, level_icon) VALUES
('new', 1, 0.00, 0, 'Basic profile access', '#gray', '🌟'),
('bronze', 2, 3.00, 5, 'Enhanced profile visibility', '#CD7F32', '🥉'),
('silver', 3, 3.50, 10, 'Priority in search results', '#C0C0C0', '🥈'),
('gold', 4, 4.00, 25, 'Featured provider status', '#FFD700', '🥇'),
('platinum', 5, 4.50, 50, 'Premium placement and verification badge', '#E5E4E2', '💎'),
('diamond', 6, 4.80, 100, 'Top-tier recognition and exclusive benefits', '#B9F2FF', '👑');

-- Insert default badges
INSERT OR IGNORE INTO badges (badge_name, badge_description, badge_category, badge_level, points_value, unlock_criteria) VALUES
('First Review', 'Received your first review', 'milestone', 'bronze', 10, 'Receive first positive review'),
('Five Star Provider', 'Maintained 5-star rating with 10+ reviews', 'achievement', 'gold', 50, 'Maintain 5.0 rating with 10+ reviews'),
('Helpful Contributor', 'Received 25 helpful votes on reviews', 'achievement', 'silver', 25, 'Get 25 helpful votes'),
('Quick Responder', 'Responded to 90% of reviews within 24 hours', 'quality', 'silver', 30, '90% response rate within 24 hours'),
('Trusted Reviewer', 'Posted 20 verified reviews', 'achievement', 'gold', 40, 'Post 20 verified reviews'),
('Expert Contributor', 'Contributed 100+ helpful content pieces', 'quantity', 'platinum', 100, '100+ quality contributions'),
('Patient Champion', 'Perfect attendance for 12 months', 'achievement', 'silver', 35, '100% appointment attendance for 1 year'),
('Quality Care Provider', '4.5+ rating across all categories', 'quality', 'platinum', 75, '4.5+ rating in all categories'),
('Community Leader', 'Top 10% in community engagement', 'achievement', 'gold', 60, 'Top 10% engagement score'),
('Rising Star', 'Improved score by 1.0+ points in 30 days', 'achievement', 'silver', 45, '1.0+ point improvement in 30 days');
