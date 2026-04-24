import { 
  POINT_SYSTEM, 
  BADGES, 
  ACHIEVEMENTS, 
  LEADERBOARD_TYPES, 
  REWARDS,
  GAMIFICATION_SETTINGS,
  calculateLevel,
  calculateProgress,
  getNextLevel,
  calculatePointsWithMultipliers,
  checkBadgeRequirements,
  calculateStreakBonus,
  getLeaderboardPosition,
  getAchievementProgress
} from './gamificationConfig';

export class GamificationManager {
  constructor() {
    this.userStats = {};
    this.leaderboards = {};
    this.listeners = [];
    this.storageKey = 'healthcare_gamification';
    this.loadUserData();
    this.init();
  }

  // Initialize gamification system
  init() {
    this.loadUserData();
    this.setupDailyReset();
    this.checkStreaks();
  }

  // Load user data from localStorage
  loadUserData() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const data = JSON.parse(stored);
        this.userStats = data.userStats || {};
        this.leaderboards = data.leaderboards || {};
      }
    } catch (error) {
      console.error('Error loading gamification data:', error);
      this.initializeDefaultData();
    }
  }

  // Save user data to localStorage
  saveUserData() {
    try {
      const data = {
        userStats: this.userStats,
        leaderboards: this.leaderboards,
        lastSaved: new Date().toISOString()
      };
      localStorage.setItem(this.storageKey, JSON.stringify(data));
      this.notifyListeners('dataChanged', { userStats: this.userStats });
    } catch (error) {
      console.error('Error saving gamification data:', error);
    }
  }

  // Initialize default user data
  initializeDefaultData(userId = 'current_user') {
    if (!this.userStats[userId]) {
      this.userStats[userId] = {
        id: userId,
        points: 0,
        level: 1,
        badges: [],
        achievements: {},
        streak: {
          current: 0,
          longest: 0,
          lastLogin: null,
          history: []
        },
        activities: {
          dailyLogins: 0,
          totalLogins: 0,
          appointmentsCompleted: 0,
          feedbackSubmitted: 0,
          articlesRead: 0,
          forumPosts: 0,
          healthGoalsCompleted: 0,
          referralsCompleted: 0
        },
        rewards: {
          unlocked: [],
          purchased: []
        },
        statistics: {
          totalPointsEarned: 0,
          totalPointsSpent: 0,
          averageDailyPoints: 0,
          mostActiveDay: null,
          favoriteActivity: null
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
    }
  }

  // Setup daily reset for streaks
  setupDailyReset() {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    
    const msUntilMidnight = tomorrow - now;
    
    setTimeout(() => {
      this.checkDailyReset();
      setInterval(() => this.checkDailyReset(), 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  // Check daily reset for streaks
  checkDailyReset() {
    Object.keys(this.userStats).forEach(userId => {
      const user = this.userStats[userId];
      const lastLogin = user.streak.lastLogin ? new Date(user.streak.lastLogin) : null;
      const today = new Date();
      
      if (!lastLogin || this.isDifferentDay(lastLogin, today)) {
        // User didn't log in today, check if streak is broken
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        
        if (!lastLogin || this.isDifferentDay(lastLogin, yesterday)) {
          // Streak is broken
          user.streak.current = 0;
          this.notifyListeners('streakBroken', { userId, streak: user.streak });
        }
      }
    });
    
    this.saveUserData();
  }

  // Check if two dates are different days
  isDifferentDay(date1, date2) {
    return date1.getFullYear() !== date2.getFullYear() ||
           date1.getMonth() !== date2.getMonth() ||
           date1.getDate() !== date2.getDate();
  }

  // Check and update streaks
  checkStreaks(userId = 'current_user') {
    const user = this.getUserStats(userId);
    if (!user) return;

    const now = new Date();
    const lastLogin = user.streak.lastLogin ? new Date(user.streak.lastLogin) : null;

    if (!lastLogin) {
      // First login
      user.streak.current = 1;
      user.streak.longest = 1;
    } else if (this.isDifferentDay(lastLogin, now)) {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);

      if (!this.isDifferentDay(lastLogin, yesterday)) {
        // Consecutive day
        user.streak.current++;
        user.streak.longest = Math.max(user.streak.longest, user.streak.current);
      } else {
        // Streak broken
        user.streak.current = 1;
      }
    }

    user.streak.lastLogin = now.toISOString();
    user.streak.history.push({
      date: now.toISOString(),
      streak: user.streak.current
    });

    // Keep only last 365 days of history
    if (user.streak.history.length > 365) {
      user.streak.history = user.streak.history.slice(-365);
    }

    this.saveUserData();
    this.notifyListeners('streakUpdated', { userId, streak: user.streak });
  }

  // Award points to user
  awardPoints(userId, activity, multipliers = []) {
    const user = this.getUserStats(userId);
    if (!user) return 0;

    const basePoints = POINT_SYSTEM.ACTIVITIES[activity] || 0;
    
    // Add streak bonus
    if (user.streak.current > 0) {
      multipliers.push(calculateStreakBonus(user.streak.current));
    }

    // Add weekend bonus
    const now = new Date();
    const isWeekend = now.getDay() === 0 || now.getDay() === 6;
    if (isWeekend) {
      multipliers.push(POINT_SYSTEM.MULTIPLIERS.WEEKEND_BONUS);
    }

    const finalPoints = calculatePointsWithMultipliers(basePoints, multipliers);
    
    user.points += finalPoints;
    user.statistics.totalPointsEarned += finalPoints;
    
    // Update level
    const newLevel = calculateLevel(user.points);
    if (newLevel.level > user.level) {
      this.handleLevelUp(userId, user.level, newLevel.level);
      user.level = newLevel.level;
    }

    // Update activity count
    this.updateActivityCount(userId, activity);

    user.updatedAt = new Date().toISOString();
    this.saveUserData();

    this.notifyListeners('pointsAwarded', { 
      userId, 
      activity, 
      points: finalPoints, 
      totalPoints: user.points 
    });

    return finalPoints;
  }

  // Update activity count
  updateActivityCount(userId, activity) {
    const user = this.getUserStats(userId);
    if (!user) return;

    const activityMap = {
      'daily_login': 'dailyLogins',
      'appointment_completed': 'appointmentsCompleted',
      'feedback_submission': 'feedbackSubmitted',
      'article_read': 'articlesRead',
      'forum_post': 'forumPosts',
      'health_goal_achieved': 'healthGoalsCompleted',
      'referral_signup': 'referralsCompleted'
    };

    const activityKey = activityMap[activity];
    if (activityKey) {
      user.activities[activityKey] = (user.activities[activityKey] || 0) + 1;
    }

    // Check for new badges
    this.checkForNewBadges(userId);
    
    // Check for new achievements
    this.checkForNewAchievements(userId);
  }

  // Handle level up
  handleLevelUp(userId, oldLevel, newLevel) {
    const user = this.getUserStats(userId);
    if (!user) return;

    // Award bonus points for level up
    const bonusPoints = newLevel * 50;
    user.points += bonusPoints;

    this.notifyListeners('levelUp', { 
      userId, 
      oldLevel, 
      newLevel, 
      bonusPoints 
    });
  }

  // Check for new badges
  checkForNewBadges(userId) {
    const user = this.getUserStats(userId);
    if (!user) return;

    Object.values(BADGES).forEach(badge => {
      if (user.badges.includes(badge.id)) return;

      if (checkBadgeRequirements(user.activities, badge.id)) {
        this.awardBadge(userId, badge.id);
      }
    });
  }

  // Award badge to user
  awardBadge(userId, badgeId) {
    const user = this.getUserStats(userId);
    if (!user) return;

    const badge = BADGES[badgeId];
    if (!badge || user.badges.includes(badgeId)) return;

    user.badges.push(badgeId);
    
    // Award badge points
    this.awardPoints(userId, 'milestone_reached');

    // Check for reward
    const reward = REWARDS.ACHIEVEMENT_REWARDS[badgeId];
    if (reward) {
      if (reward.bonus_points) {
        this.awardPoints(userId, 'milestone_reached', [reward.bonus_points / 25]);
      }
    }

    user.updatedAt = new Date().toISOString();
    this.saveUserData();

    this.notifyListeners('badgeAwarded', { 
      userId, 
      badgeId, 
      badge,
      totalBadges: user.badges.length 
    });

    return badge;
  }

  // Check for new achievements
  checkForNewAchievements(userId) {
    const user = this.getUserStats(userId);
    if (!user) return;

    Object.values(ACHIEVEMENTS).forEach(achievement => {
      const progress = getAchievementProgress(user.activities, achievement.id);
      if (!progress) return;

      progress.tiers.forEach(tier => {
        if (tier.isCompleted && !user.achievements[achievement.id]) {
          user.achievements[achievement.id] = user.achievements[achievement.id] || {};
          user.achievements[achievement.id][tier.tier] = {
            completed: true,
            completedAt: new Date().toISOString(),
            reward: tier.reward
          };

          // Award achievement reward
          this.awardPoints(userId, 'milestone_reached', [tier.reward / 25]);

          this.notifyListeners('achievementUnlocked', {
            userId,
            achievementId: achievement.id,
            tier: tier.tier,
            achievement: achievement,
            reward: tier.reward
          });
        }
      });
    });

    user.updatedAt = new Date().toISOString();
    this.saveUserData();
  }

  // Purchase reward
  purchaseReward(userId, rewardId) {
    const user = this.getUserStats(userId);
    if (!user) return false;

    const reward = REWARDS.POINT_REWARDS.find(r => r.id === rewardId);
    if (!reward) return false;

    if (user.points < reward.cost) return false;
    if (user.rewards.purchased.includes(rewardId)) return false;

    user.points -= reward.cost;
    user.statistics.totalPointsSpent += reward.cost;
    user.rewards.purchased.push(rewardId);
    user.rewards.unlocked.push(rewardId);

    user.updatedAt = new Date().toISOString();
    this.saveUserData();

    this.notifyListeners('rewardPurchased', {
      userId,
      rewardId,
      reward,
      remainingPoints: user.points
    });

    return true;
  }

  // Get user statistics
  getUserStats(userId = 'current_user') {
    this.initializeDefaultData(userId);
    return this.userStats[userId];
  }

  // Get user level info
  getUserLevelInfo(userId = 'current_user') {
    const user = this.getUserStats(userId);
    const currentLevel = calculateLevel(user.points);
    const nextLevel = getNextLevel(currentLevel.level);
    
    return {
      current: currentLevel,
      next: nextLevel,
      progress: nextLevel ? calculateProgress(
        user.points - currentLevel.points,
        nextLevel.points - currentLevel.points
      ) : 100,
      pointsToNext: nextLevel ? nextLevel.points - user.points : 0,
      pointsForCurrent: user.points - currentLevel.points
    };
  }

  // Get user badges
  getUserBadges(userId = 'current_user') {
    const user = this.getUserStats(userId);
    return user.badges.map(badgeId => BADGES[badgeId]).filter(Boolean);
  }

  // Get user achievements
  getUserAchievements(userId = 'current_user') {
    const user = this.getUserStats(userId);
    const achievements = {};

    Object.entries(ACHIEVEMENTS).forEach(([id, achievement]) => {
      const progress = getAchievementProgress(user.activities, id);
      if (progress) {
        achievements[id] = progress;
      }
    });

    return achievements;
  }

  // Get leaderboard data
  getLeaderboard(type = 'points', limit = 100) {
    const leaderboardType = LEADERBOARD_TYPES[type];
    if (!leaderboardType) return [];

    const users = Object.values(this.userStats);
    
    let sorted = users.sort((a, b) => {
      switch (type) {
        case 'points':
          return b.points - a.points;
        case 'level':
          return b.level - a.level;
        case 'streak':
          return b.streak.current - a.streak.current;
        case 'badges':
          return b.badges.length - a.badges.length;
        case 'engagement':
          const aScore = Object.values(a.activities).reduce((sum, val) => sum + val, 0);
          const bScore = Object.values(b.activities).reduce((sum, val) => sum + val, 0);
          return bScore - aScore;
        default:
          return 0;
      }
    });

    return sorted.slice(0, limit).map((user, index) => ({
      ...user,
      rank: index + 1,
      score: this.getLeaderboardScore(user, type)
    }));
  }

  // Get leaderboard score for user
  getLeaderboardScore(user, type) {
    switch (type) {
      case 'points':
        return user.points;
      case 'level':
        return user.level;
      case 'streak':
        return user.streak.current;
      case 'badges':
        return user.badges.length;
      case 'engagement':
        return Object.values(user.activities).reduce((sum, val) => sum + val, 0);
      default:
        return 0;
    }
  }

  // Get user's position in leaderboard
  getUserLeaderboardPosition(userId = 'current_user', type = 'points') {
    const leaderboard = this.getLeaderboard(type);
    return getLeaderboardPosition(leaderboard, userId, 'score');
  }

  // Get available rewards
  getAvailableRewards(userId = 'current_user') {
    const user = this.getUserStats(userId);
    return REWARDS.POINT_REWARDS.filter(reward => 
      !user.rewards.purchased.includes(reward.id) && user.points >= reward.cost
    );
  }

  // Get purchased rewards
  getPurchasedRewards(userId = 'current_user') {
    const user = this.getUserStats(userId);
    return REWARDS.POINT_REWARDS.filter(reward => 
      user.rewards.purchased.includes(reward.id)
    );
  }

  // Get gamification analytics
  getAnalytics() {
    const users = Object.values(this.userStats);
    const totalUsers = users.length;
    
    if (totalUsers === 0) {
      return {
        totalUsers: 0,
        totalPointsAwarded: 0,
        averagePoints: 0,
        totalBadgesEarned: 0,
        averageLevel: 1,
        averageStreak: 0,
        mostPopularBadge: null,
        mostActiveDay: null,
        engagementRate: 0
      };
    }

    const totalPoints = users.reduce((sum, user) => sum + user.points, 0);
    const totalBadges = users.reduce((sum, user) => sum + user.badges.length, 0);
    const totalLevels = users.reduce((sum, user) => sum + user.level, 0);
    const totalStreaks = users.reduce((sum, user) => sum + user.streak.current, 0);
    
    // Find most popular badge
    const badgeCounts = {};
    users.forEach(user => {
      user.badges.forEach(badgeId => {
        badgeCounts[badgeId] = (badgeCounts[badgeId] || 0) + 1;
      });
    });
    
    const mostPopularBadge = Object.entries(badgeCounts)
      .sort(([,a], [,b]) => b - a)[0]?.[0];

    // Calculate engagement rate (users with activity in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const activeUsers = users.filter(user => {
      const lastActivity = new Date(user.updatedAt);
      return lastActivity > sevenDaysAgo;
    }).length;

    return {
      totalUsers,
      totalPointsAwarded: totalPoints,
      averagePoints: Math.round(totalPoints / totalUsers),
      totalBadgesEarned: totalBadges,
      averageLevel: Math.round(totalLevels / totalUsers * 10) / 10,
      averageStreak: Math.round(totalStreaks / totalUsers * 10) / 10,
      mostPopularBadge,
      mostActiveDay: this.calculateMostActiveDay(),
      engagementRate: Math.round((activeUsers / totalUsers) * 100)
    };
  }

  // Calculate most active day
  calculateMostActiveDay() {
    const dayCounts = {
      0: 0, // Sunday
      1: 0, // Monday
      2: 0, // Tuesday
      3: 0, // Wednesday
      4: 0, // Thursday
      5: 0, // Friday
      6: 0  // Saturday
    };

    Object.values(this.userStats).forEach(user => {
      if (user.streak.history) {
        user.streak.history.forEach(entry => {
          const day = new Date(entry.date).getDay();
          dayCounts[day]++;
        });
      }
    });

    const maxDay = Object.entries(dayCounts).sort(([,a], [,b]) => b - a)[0];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    return maxDay ? dayNames[maxDay[0]] : null;
  }

  // Event listeners
  addListener(event, callback) {
    this.listeners.push({ event, callback });
  }

  removeListener(event, callback) {
    this.listeners = this.listeners.filter(
      listener => !(listener.event === event && listener.callback === callback)
    );
  }

  notifyListeners(event, data) {
    this.listeners
      .filter(listener => listener.event === event)
      .forEach(listener => listener.callback(data));
  }

  // Reset user data
  resetUserData(userId = 'current_user') {
    delete this.userStats[userId];
    this.saveUserData();
    this.notifyListeners('dataReset', { userId });
  }

  // Export user data
  exportUserData(userId = 'current_user') {
    const user = this.getUserStats(userId);
    return JSON.stringify(user, null, 2);
  }

  // Import user data
  importUserData(userId, data) {
    try {
      const userData = typeof data === 'string' ? JSON.parse(data) : data;
      this.userStats[userId] = userData;
      this.saveUserData();
      this.notifyListeners('dataImported', { userId });
      return true;
    } catch (error) {
      console.error('Error importing user data:', error);
      return false;
    }
  }
}

// Singleton instance
export const gamificationManager = new GamificationManager();
