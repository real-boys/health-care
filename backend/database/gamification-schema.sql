-- Gamification System Database Schema
-- Comprehensive system for points, badges, achievements, and leaderboards

-- User Points Table - Track user points and progression
CREATE TABLE IF NOT EXISTS user_points (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    total_points INTEGER DEFAULT 0,
    points_this_month INTEGER DEFAULT 0,
    points_this_week INTEGER DEFAULT 0,
    level INTEGER DEFAULT 1,
    points_to_next_level INTEGER DEFAULT 100,
    total_achievements_unlocked INTEGER DEFAULT 0,
    total_badges_earned INTEGER DEFAULT 0,
    streak_days INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    last_activity_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Points Activity Log - Track all point transactions
CREATE TABLE IF NOT EXISTS points_activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    activity_type VARCHAR(100) NOT NULL, -- 'appointment_attended', 'health_record_shared', 'survey_completed', 'profile_updated', 'review_posted', 'milestone_reached', 'bonus'
    points_earned INTEGER NOT NULL,
    activity_description TEXT,
    activity_metadata TEXT, -- JSON storing additional context
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Badges Definition - All available badges
CREATE TABLE IF NOT EXISTS badge_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon_url VARCHAR(500),
    category VARCHAR(50), -- 'health', 'social', 'fitness', 'engagement', 'milestone', 'achievement'
    rarity_level VARCHAR(20) DEFAULT 'common', -- 'common', 'uncommon', 'rare', 'epic', 'legendary'
    unlock_criteria TEXT NOT NULL, -- JSON describing how to unlock
    points_reward INTEGER DEFAULT 0,
    display_order INTEGER,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Badges - Track which badges user has earned
CREATE TABLE IF NOT EXISTS user_badges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    badge_id INTEGER NOT NULL,
    earned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_value INTEGER DEFAULT 0, -- For badges requiring multiple actions
    is_displayed BOOLEAN DEFAULT TRUE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (badge_id) REFERENCES badge_definitions(id) ON DELETE CASCADE,
    UNIQUE (user_id, badge_id)
);

-- Achievement Definitions - All available achievements
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NOT NULL,
    icon_url VARCHAR(500),
    category VARCHAR(50), -- 'health', 'wellness', 'social', 'engagement', 'learning'
    tier_level INTEGER DEFAULT 1, -- 1=Bronze, 2=Silver, 3=Gold, 4=Platinum
    points_reward INTEGER NOT NULL DEFAULT 0,
    unlock_criteria TEXT NOT NULL, -- JSON describing conditions
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Achievements - Track which achievements user has unlocked
CREATE TABLE IF NOT EXISTS user_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    achievement_id INTEGER NOT NULL,
    unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    progress_percentage INTEGER DEFAULT 100,
    is_announced BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (achievement_id) REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    UNIQUE (user_id, achievement_id)
);

-- Leaderboards - Periodic snapshots for different ranking types
CREATE TABLE IF NOT EXISTS leaderboard_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    rank INTEGER,
    points INTEGER,
    leaderboard_type VARCHAR(50) NOT NULL, -- 'all_time', 'monthly', 'weekly', 'level_based'
    leaderboard_period VARCHAR(20), -- 'current', or 'YYYY-MM' for monthly, 'YYYY-W##' for weekly
    user_first_name VARCHAR(100),
    user_last_name VARCHAR(100),
    user_avatar_url VARCHAR(500),
    is_active BOOLEAN DEFAULT TRUE,
    calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Milestones and Tiers - User progression system
CREATE TABLE IF NOT EXISTS user_tiers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    current_tier VARCHAR(50) DEFAULT 'bronze', -- 'bronze', 'silver', 'gold', 'platinum', 'diamond'
    tier_points INTEGER DEFAULT 0,
    tier_progression_percentage INTEGER DEFAULT 0,
    points_needed_for_next_tier INTEGER,
    unlocked_tiers TEXT, -- JSON array of unlocked tier names
    tier_benefits TEXT, -- JSON object with benefits
    promoted_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Streaks Tracking - For daily habit tracking
CREATE TABLE IF NOT EXISTS user_streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL UNIQUE,
    streak_type VARCHAR(50) NOT NULL, -- 'daily_activity', 'appointments', 'health_tracking'
    current_streak INT DEFAULT 0,
    longest_streak INT DEFAULT 0,
    last_activity_date DATE,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Unlocked Rewards - Redemption tracking
CREATE TABLE IF NOT EXISTS reward_definitions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    category VARCHAR(50), -- 'discount', 'premium_feature', 'exclusive_content', 'wellness_product'
    points_required INTEGER NOT NULL,
    reward_icon_url VARCHAR(500),
    reward_metadata TEXT, -- JSON with reward details
    validity_days INTEGER DEFAULT 365,
    max_redemptions INTEGER DEFAULT -1, -- -1 for unlimited
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Redeemed Rewards
CREATE TABLE IF NOT EXISTS user_redeemed_rewards (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    reward_id INTEGER NOT NULL,
    redemption_code VARCHAR(100) UNIQUE,
    redeemed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_used BOOLEAN DEFAULT FALSE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reward_id) REFERENCES reward_definitions(id) ON DELETE CASCADE
);

-- Challenges - Time-limited challenges for extra points
CREATE TABLE IF NOT EXISTS challenges (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    challenge_type VARCHAR(50), -- 'daily', 'weekly', 'seasonal'
    start_date TIMESTAMP NOT NULL,
    end_date TIMESTAMP NOT NULL,
    points_reward INTEGER NOT NULL,
    participant_count INTEGER DEFAULT 0,
    completion_criteria TEXT NOT NULL, -- JSON
    difficulty_level VARCHAR(20), -- 'easy', 'medium', 'hard'
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User Challenge Progress
CREATE TABLE IF NOT EXISTS user_challenge_progress (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    challenge_id INTEGER NOT NULL,
    progress_value INTEGER DEFAULT 0,
    progress_percentage INTEGER DEFAULT 0,
    is_completed BOOLEAN DEFAULT FALSE,
    completed_at TIMESTAMP,
    points_earned INTEGER DEFAULT 0,
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (challenge_id) REFERENCES challenges(id) ON DELETE CASCADE,
    UNIQUE (user_id, challenge_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_points_user_id ON user_points(user_id);
CREATE INDEX IF NOT EXISTS idx_user_points_level ON user_points(level);
CREATE INDEX IF NOT EXISTS idx_points_activity_user_id ON points_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_points_activity_type ON points_activity_log(activity_type);
CREATE INDEX IF NOT EXISTS idx_user_badges_user_id ON user_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_badges_earned ON user_badges(earned_at);
CREATE INDEX IF NOT EXISTS idx_user_achievements_user_id ON user_achievements(user_id);
CREATE INDEX IF NOT EXISTS idx_leaderboard_type_period ON leaderboard_entries(leaderboard_type, leaderboard_period);
CREATE INDEX IF NOT EXISTS idx_leaderboard_rank ON leaderboard_entries(rank, leaderboard_type);
CREATE INDEX IF NOT EXISTS idx_user_tiers_user_id ON user_tiers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_streaks_user_id ON user_streaks(user_id);
CREATE INDEX IF NOT EXISTS idx_user_challenge_user_id_challenge_id ON user_challenge_progress(user_id, challenge_id);
