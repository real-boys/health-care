// Gamification configuration and utilities

export const POINT_SYSTEM = {
  // Base points for different activities
  ACTIVITIES: {
    DAILY_LOGIN: 10,
    PROFILE_COMPLETION: 50,
    FEEDBACK_SUBMISSION: 25,
    APPOINTMENT_BOOKED: 30,
    APPOINTMENT_COMPLETED: 50,
    PRESCRIPTION_REFILL: 20,
    HEALTH_GOAL_SET: 15,
    HEALTH_GOAL_ACHIEVED: 100,
    READING_ARTICLE: 5,
    WATCHING_VIDEO: 10,
    COMPLETING_QUIZ: 20,
    REFERRAL_SIGNUP: 200,
    REVIEW_WRITTEN: 30,
    FORUM_POST: 15,
    FORUM_COMMENT: 5,
    SHARING_CONTENT: 10,
    STREAK_DAY: 25,
    MILESTONE_REACHED: 75
  },

  // Multipliers for special conditions
  MULTIPLIERS: {
    STREAK_BONUS: 1.5, // 50% bonus for streaks
    WEEKEND_BONUS: 1.2, // 20% bonus on weekends
    FIRST_TIME_BONUS: 2.0, // Double points for first-time activities
    QUALITY_BONUS: 1.3, // 30% bonus for high-quality content
    SPEED_BONUS: 1.1, // 10% bonus for quick completion
    TEAM_BONUS: 1.25 // 25% bonus for team activities
  },

  // Point thresholds for levels
  LEVEL_THRESHOLDS: [
    { level: 1, name: 'Beginner', points: 0, color: '#6b7280' },
    { level: 2, name: 'Novice', points: 100, color: '#3b82f6' },
    { level: 3, name: 'Apprentice', points: 250, color: '#10b981' },
    { level: 4, name: 'Journeyman', points: 500, color: '#8b5cf6' },
    { level: 5, name: 'Expert', points: 1000, color: '#f59e0b' },
    { level: 6, name: 'Master', points: 2500, color: '#ef4444' },
    { level: 7, name: 'Grandmaster', points: 5000, color: '#ec4899' },
    { level: 8, name: 'Legend', points: 10000, color: '#14b8a6' },
    { level: 9, name: 'Mythic', points: 25000, color: '#f97316' },
    { level: 10, name: 'Transcendent', points: 50000, color: '#a855f7' }
  ],

  // Point expiration settings
  EXPIRATION: {
    POINTS_EXPIRE_AFTER_DAYS: 365, // Points expire after 1 year
    WARNING_DAYS_BEFORE_EXPIRY: 30, // Warn user 30 days before expiry
    AUTO_RENEW_STREAK_BONUS: 7 // Auto-renew if active within 7 days
  }
};

export const BADGES = {
  // Achievement badges
  FIRST_STEPS: {
    id: 'first_steps',
    name: 'First Steps',
    description: 'Complete your profile',
    icon: 'user-plus',
    color: '#3b82f6',
    category: 'onboarding',
    rarity: 'common',
    points: 50,
    requirements: { profile_completion: 100 }
  },
  
  HEALTH_ENTHUSIAST: {
    id: 'health_enthusiast',
    name: 'Health Enthusiast',
    description: 'Complete 5 health goals',
    icon: 'heart',
    color: '#ef4444',
    category: 'health',
    rarity: 'common',
    points: 100,
    requirements: { health_goals_completed: 5 }
  },

  FEEDBACK_CHAMPION: {
    id: 'feedback_champion',
    name: 'Feedback Champion',
    description: 'Submit 10 pieces of feedback',
    icon: 'message-square',
    color: '#10b981',
    category: 'engagement',
    rarity: 'uncommon',
    points: 250,
    requirements: { feedback_submitted: 10 }
  },

  APPOINTMENT_MASTER: {
    id: 'appointment_master',
    name: 'Appointment Master',
    description: 'Complete 20 appointments',
    icon: 'calendar',
    color: '#8b5cf6',
    category: 'healthcare',
    rarity: 'uncommon',
    points: 300,
    requirements: { appointments_completed: 20 }
  },

  KNOWLEDAGE_SEEKER: {
    id: 'knowledge_seeker',
    name: 'Knowledge Seeker',
    description: 'Read 50 health articles',
    icon: 'book-open',
    color: '#f59e0b',
    category: 'education',
    rarity: 'common',
    points: 150,
    requirements: { articles_read: 50 }
  },

  SOCIAL_BUTTERFLY: {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Make 25 forum posts',
    icon: 'users',
    color: '#ec4899',
    category: 'social',
    rarity: 'uncommon',
    points: 200,
    requirements: { forum_posts: 25 }
  },

  STREAK_WARRIOR: {
    id: 'streak_warrior',
    name: 'Streak Warrior',
    description: 'Maintain a 30-day login streak',
    icon: 'flame',
    color: '#f97316',
    category: 'engagement',
    rarity: 'rare',
    points: 500,
    requirements: { login_streak: 30 }
  },

  EARLY_BIRD: {
    id: 'early_bird',
    name: 'Early Bird',
    description: 'Log in before 6 AM for 7 days',
    icon: 'sun',
    color: '#fbbf24',
    category: 'engagement',
    rarity: 'rare',
    points: 400,
    requirements: { early_logins: 7 }
  },

  NIGHT_OWL: {
    id: 'night_owl',
    name: 'Night Owl',
    description: 'Log in after 10 PM for 7 days',
    icon: 'moon',
    color: '#6366f1',
    category: 'engagement',
    rarity: 'rare',
    points: 400,
    requirements: { late_logins: 7 }
  },

  REFERRAL_GURU: {
    id: 'referral_guru',
    name: 'Referral Guru',
    description: 'Refer 10 new users',
    icon: 'user-plus',
    color: '#14b8a6',
    category: 'referral',
    rarity: 'epic',
    points: 1000,
    requirements: { referrals_completed: 10 }
  },

  PERFECT_MONTH: {
    id: 'perfect_month',
    name: 'Perfect Month',
    description: 'Log in every day for a month',
    icon: 'calendar-check',
    color: '#a855f7',
    category: 'engagement',
    rarity: 'epic',
    points: 750,
    requirements: { perfect_month: 1 }
  },

  CENTURION: {
    id: 'centurion',
    name: 'Centurion',
    description: 'Complete 100 activities',
    icon: 'award',
    color: '#dc2626',
    category: 'milestone',
    rarity: 'legendary',
    points: 2000,
    requirements: { total_activities: 100 }
  },

  COMMUNITY_LEADER: {
    id: 'community_leader',
    name: 'Community Leader',
    description: 'Get 50 helpful votes on your content',
    icon: 'crown',
    color: '#fbbf24',
    category: 'social',
    rarity: 'epic',
    points: 800,
    requirements: { helpful_votes_received: 50 }
  }
};

export const ACHIEVEMENTS = {
  // Milestone achievements
  POINTS_COLLECTOR: {
    id: 'points_collector',
    name: 'Points Collector',
    description: 'Earn points through activities',
    tiers: [
      { tier: 1, name: 'Bronze Collector', points: 100, reward: 50, icon: 'medal', color: '#cd7f32' },
      { tier: 2, name: 'Silver Collector', points: 500, reward: 250, icon: 'medal', color: '#c0c0c0' },
      { tier: 3, name: 'Gold Collector', points: 1000, reward: 500, icon: 'medal', color: '#ffd700' },
      { tier: 4, name: 'Platinum Collector', points: 5000, reward: 2500, icon: 'medal', color: '#e5e4e2' },
      { tier: 5, name: 'Diamond Collector', points: 10000, reward: 5000, icon: 'gem', color: '#b9f2ff' }
    ]
  },

  LEVEL_MASTER: {
    id: 'level_master',
    name: 'Level Master',
    description: 'Reach higher levels',
    tiers: [
      { tier: 1, name: 'Level 5', points: 0, reward: 100, icon: 'star', color: '#f59e0b' },
      { tier: 2, name: 'Level 10', points: 0, reward: 500, icon: 'star', color: '#ef4444' },
      { tier: 3, name: 'Level 15', points: 0, reward: 1000, icon: 'star', color: '#a855f7' },
      { tier: 4, name: 'Level 20', points: 0, reward: 2500, icon: 'star', color: '#14b8a6' }
    ]
  },

  STREAK_MASTER: {
    id: 'streak_master',
    name: 'Streak Master',
    description: 'Maintain login streaks',
    tiers: [
      { tier: 1, name: 'Week Warrior', points: 7, reward: 100, icon: 'flame', color: '#f97316' },
      { tier: 2, name: 'Month Champion', points: 30, reward: 500, icon: 'flame', color: '#dc2626' },
      { tier: 3, name: 'Quarter Master', points: 90, reward: 1500, icon: 'flame', color: '#7c3aed' },
      { tier: 4, name: 'Year Legend', points: 365, reward: 5000, icon: 'flame', color: '#0891b2' }
    ]
  }
};

export const LEADERBOARD_TYPES = {
  POINTS: {
    id: 'points',
    name: 'Points Leaderboard',
    description: 'Users with the most points',
    icon: 'trophy',
    color: '#f59e0b'
  },
  
  LEVEL: {
    id: 'level',
    name: 'Level Leaderboard',
    description: 'Highest level users',
    icon: 'star',
    color: '#8b5cf6'
  },
  
  STREAK: {
    id: 'streak',
    name: 'Streak Leaderboard',
    description: 'Longest login streaks',
    icon: 'flame',
    color: '#f97316'
  },
  
  BADGES: {
    id: 'badges',
    name: 'Badges Leaderboard',
    description: 'Most badges collected',
    icon: 'award',
    color: '#10b981'
  },
  
  ENGAGEMENT: {
    id: 'engagement',
    name: 'Engagement Leaderboard',
    description: 'Most active users',
    icon: 'activity',
    color: '#3b82f6'
  }
};

export const REWARDS = {
  // Point-based rewards
  POINT_REWARDS: [
    {
      id: 'profile_theme',
      name: 'Custom Profile Theme',
      description: 'Unlock premium profile themes',
      cost: 500,
      type: 'cosmetic',
      icon: 'palette',
      category: 'profile'
    },
    {
      id: 'avatar_frame',
      name: 'Avatar Frame',
      description: 'Special avatar frames',
      cost: 300,
      type: 'cosmetic',
      icon: 'image',
      category: 'profile'
    },
    {
      id: 'bonus_points',
      name: 'Points Booster',
      description: '2x points for 24 hours',
      cost: 1000,
      type: 'booster',
      icon: 'zap',
      category: 'boost'
    },
    {
      id: 'streak_protect',
      name: 'Streak Protector',
      description: 'Protect your streak for 1 missed day',
      cost: 750,
      type: 'protection',
      icon: 'shield',
      category: 'protection'
    },
    {
      id: 'early_access',
      name: 'Early Access',
      description: 'Access new features early',
      cost: 2000,
      type: 'feature',
      icon: 'unlock',
      category: 'feature'
    }
  ],

  // Achievement rewards
  ACHIEVEMENT_REWARDS: {
    'first_steps': { bonus_points: 25, badge_unlock: 'starter_pack' },
    'health_enthusiast': { bonus_points: 50, feature_unlock: 'health_insights' },
    'feedback_champion': { bonus_points: 100, title_unlock: 'feedback_expert' },
    'streak_warrior': { bonus_points: 200, badge_unlock: 'streak_master' },
    'referral_guru': { bonus_points: 500, feature_unlock: 'referral_dashboard' }
  }
};

export const GAMIFICATION_SETTINGS = {
  // Global settings
  ENABLED_FEATURES: {
    POINTS: true,
    BADGES: true,
    ACHIEVEMENTS: true,
    LEADERBOARDS: true,
    REWARDS: true,
    STREAKS: true,
    NOTIFICATIONS: true
  },

  // Notification settings
  NOTIFICATIONS: {
    BADGE_EARNED: true,
    LEVEL_UP: true,
    ACHIEVEMENT_UNLOCKED: true,
    STREAK_MILESTONE: true,
    LEADERBOARD_RANK_CHANGE: true,
    REWARD_AVAILABLE: true,
    POINTS_MILESTONE: true
  },

  // Privacy settings
  PRIVACY: {
    SHOW_ON_LEADERBOARDS: true,
    SHOW_BADGES_PUBLICLY: true,
    SHOW_LEVEL_PUBLICLY: true,
    SHOW_POINTS_PUBLICLY: false,
    ALLOW_FRIEND_COMPARISONS: true
  },

  // Display settings
  DISPLAY: {
    ANIMATIONS_ENABLED: true,
    SOUND_EFFECTS_ENABLED: false,
    CELEBRATION_EFFECTS: true,
    PROGRESS_BAR_STYLE: 'modern',
    THEME: 'healthcare'
  }
};

// Utility functions
export const calculateLevel = (totalPoints) => {
  const thresholds = POINT_SYSTEM.LEVEL_THRESHOLDS;
  for (let i = thresholds.length - 1; i >= 0; i--) {
    if (totalPoints >= thresholds[i].points) {
      return thresholds[i];
    }
  }
  return thresholds[0];
};

export const calculateProgress = (currentPoints, targetPoints) => {
  return Math.min((currentPoints / targetPoints) * 100, 100);
};

export const getNextLevel = (currentLevel) => {
  const thresholds = POINT_SYSTEM.LEVEL_THRESHOLDS;
  const currentIndex = thresholds.findIndex(level => level.level === currentLevel);
  if (currentIndex < thresholds.length - 1) {
    return thresholds[currentIndex + 1];
  }
  return null;
};

export const calculatePointsWithMultipliers = (basePoints, multipliers = []) => {
  let finalPoints = basePoints;
  multipliers.forEach(multiplier => {
    finalPoints *= multiplier;
  });
  return Math.round(finalPoints);
};

export const getBadgesByCategory = (category) => {
  return Object.values(BADGES).filter(badge => badge.category === category);
};

export const getBadgesByRarity = (rarity) => {
  return Object.values(BADGES).filter(badge => badge.rarity === rarity);
};

export const checkBadgeRequirements = (userStats, badgeId) => {
  const badge = BADGES[badgeId];
  if (!badge) return false;

  return Object.entries(badge.requirements).every(([requirement, threshold]) => {
    return (userStats[requirement] || 0) >= threshold;
  });
};

export const calculateStreakBonus = (streakDays) => {
  if (streakDays >= 30) return 2.0;
  if (streakDays >= 14) return 1.5;
  if (streakDays >= 7) return 1.25;
  if (streakDays >= 3) return 1.1;
  return 1.0;
};

export const getLeaderboardPosition = (leaderboardData, userId, sortBy) => {
  const sorted = [...leaderboardData].sort((a, b) => b[sortBy] - a[sortBy]);
  return sorted.findIndex(user => user.id === userId) + 1;
};

export const formatPoints = (points) => {
  if (points >= 1000000) {
    return `${(points / 1000000).toFixed(1)}M`;
  }
  if (points >= 1000) {
    return `${(points / 1000).toFixed(1)}K`;
  }
  return points.toString();
};

export const getRarityColor = (rarity) => {
  const colors = {
    common: '#6b7280',
    uncommon: '#3b82f6',
    rare: '#8b5cf6',
    epic: '#a855f7',
    legendary: '#f59e0b',
    mythic: '#ef4444'
  };
  return colors[rarity] || '#6b7280';
};

export const getAchievementProgress = (userStats, achievementId) => {
  const achievement = ACHIEVEMENTS[achievementId];
  if (!achievement) return null;

  const progress = achievement.tiers.map(tier => {
    const current = userStats[achievement.id] || 0;
    const required = tier.points || 0;
    const isCompleted = current >= required;
    const progress = isCompleted ? 100 : (current / required) * 100;

    return {
      ...tier,
      progress,
      isCompleted,
      current,
      required
    };
  });

  return {
    id: achievementId,
    name: achievement.name,
    description: achievement.description,
    tiers: progress
  };
};
