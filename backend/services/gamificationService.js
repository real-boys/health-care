const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class GamificationService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Award points to a user for an activity
   */
  async awardPoints(userId, points, activityType, description = '', metadata = {}) {
    return new Promise(async (resolve, reject) => {
      try {
        // Add to activity log
        const logSql = `
          INSERT INTO points_activity_log 
          (user_id, activity_type, points_earned, activity_description, activity_metadata, earned_at)
          VALUES (?, ?, ?, ?, ?, datetime('now'))
        `;
        
        this.db.run(
          logSql,
          [userId, activityType, points, description, JSON.stringify(metadata)],
          async (err) => {
            if (err) {
              return reject(err);
            }

            // Update user points
            const updateSql = `
              UPDATE user_points
              SET 
                total_points = total_points + ?,
                points_this_month = points_this_month + ?,
                points_this_week = points_this_week + ?,
                last_activity_date = datetime('now'),
                updated_at = datetime('now')
              WHERE user_id = ?
            `;

            this.db.run(updateSql, [points, points, points, userId], async (err) => {
              if (err) {
                return reject(err);
              }

              // Check if user should level up
              try {
                const userPoints = await this.getUserPoints(userId);
                await this.checkLevelUp(userId, userPoints);
                resolve(userPoints);
              } catch (error) {
                reject(error);
              }
            });
          }
        );
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get current points for a user
   */
  async getUserPoints(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_points WHERE user_id = ?';
      this.db.get(sql, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row || this.initializeUserPoints(userId));
      });
    });
  }

  /**
   * Initialize user points record
   */
  initializeUserPoints(userId) {
    const sql = `
      INSERT INTO user_points (user_id, total_points, level, points_to_next_level)
      VALUES (?, 0, 1, 100)
    `;
    
    return new Promise((resolve, reject) => {
      this.db.run(sql, [userId], function(err) {
        if (err && !err.message.includes('UNIQUE constraint failed')) {
          reject(err);
        } else {
          resolve({
            user_id: userId,
            total_points: 0,
            level: 1,
            points_to_next_level: 100
          });
        }
      });
    });
  }

  /**
   * Check if user should level up
   */
  async checkLevelUp(userId, userPoints) {
    if (!userPoints) {
      userPoints = await this.getUserPoints(userId);
    }

    const currentLevel = userPoints.level;
    const pointsNeeded = this.calculatePointsForLevel(currentLevel);

    if (userPoints.total_points >= pointsNeeded) {
      const nextLevel = currentLevel + 1;
      const nextLevelPoints = this.calculatePointsForLevel(nextLevel);
      const pointsToNext = nextLevelPoints - userPoints.total_points;

      const sql = `
        UPDATE user_points
        SET level = ?, points_to_next_level = ?, updated_at = datetime('now')
        WHERE user_id = ?
      `;

      return new Promise((resolve, reject) => {
        this.db.run(sql, [nextLevel, pointsToNext, userId], (err) => {
          if (err) reject(err);
          else {
            // Emit level up event
            resolve({
              leveledUp: true,
              newLevel: nextLevel,
              userId: userId
            });
          }
        });
      });
    }

    return { leveledUp: false };
  }

  /**
   * Calculate points needed for a given level (exponential growth)
   */
  calculatePointsForLevel(level) {
    // Base formula: 100 * level^1.5
    return Math.floor(100 * Math.pow(level, 1.5));
  }

  /**
   * Update user streak
   */
  async updateStreak(userId, streakType = 'daily_activity') {
    return new Promise(async (resolve, reject) => {
      try {
        // Get user's streak info
        const getStreakSql = `
          SELECT * FROM user_streaks WHERE user_id = ? AND streak_type = ?
        `;

        this.db.get(getStreakSql, [userId, streakType], (err, streak) => {
          if (err) return reject(err);

          const today = new Date().toISOString().split('T')[0];

          if (!streak) {
            // Create new streak
            const insertSql = `
              INSERT INTO user_streaks 
              (user_id, streak_type, current_streak, longest_streak, last_activity_date)
              VALUES (?, ?, 1, 1, ?)
            `;
            this.db.run(insertSql, [userId, streakType, today], (err) => {
              if (err) reject(err);
              else resolve({ current_streak: 1, longest_streak: 1 });
            });
          } else {
            const lastActivityDate = streak.last_activity_date;
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

            let newStreak = streak.current_streak;
            let newLongest = streak.longest_streak;

            // Check if activity is consecutive
            if (lastActivityDate === today) {
              // Already active today, no change
              newStreak = streak.current_streak;
            } else if (lastActivityDate === yesterday) {
              // Consecutive day
              newStreak = streak.current_streak + 1;
              if (newStreak > newLongest) {
                newLongest = newStreak;
              }
            } else {
              // Streak broken, restart
              newStreak = 1;
            }

            const updateSql = `
              UPDATE user_streaks
              SET current_streak = ?, longest_streak = ?, last_activity_date = ?, last_updated = datetime('now')
              WHERE user_id = ? AND streak_type = ?
            `;
            this.db.run(updateSql, [newStreak, newLongest, today, userId, streakType], (err) => {
              if (err) reject(err);
              else resolve({ current_streak: newStreak, longest_streak: newLongest });
            });
          }
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user's points history
   */
  async getUserPointsHistory(userId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM points_activity_log 
        WHERE user_id = ? 
        ORDER BY earned_at DESC 
        LIMIT ?
      `;
      this.db.all(sql, [userId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Reset monthly and weekly points
   */
  async resetPeriodPoints() {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE user_points 
        SET 
          points_this_month = 0,
          points_this_week = 0,
          updated_at = datetime('now')
      `;
      this.db.run(sql, (err) => {
        if (err) reject(err);
        else resolve({ message: 'Period points reset successfully' });
      });
    });
  }

  /**
   * Get top earners for the period
   */
  async getTopEarners(period = 'all_time', limit = 10) {
    let pointsField = 'total_points';
    if (period === 'monthly') {
      pointsField = 'points_this_month';
    } else if (period === 'weekly') {
      pointsField = 'points_this_week';
    }

    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          up.user_id,
          up.${pointsField} as points,
          up.level,
          u.first_name,
          u.last_name
        FROM user_points up
        JOIN users u ON up.user_id = u.id
        ORDER BY points DESC
        LIMIT ?
      `;
      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get user gamification dashboard data
   */
  async getUserGamificationData(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const userPoints = await this.getUserPoints(userId);
        const badges = await this.getUserBadges(userId);
        const achievements = await this.getUserAchievements(userId);
        const tier = await this.getUserTier(userId);
        const streaks = await this.getUserStreaks(userId);

        resolve({
          points: userPoints,
          badges: badges || [],
          achievements: achievements || [],
          tier: tier,
          streaks: streaks || []
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user badges
   */
  async getUserBadges(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ub.*, 
          bd.name, 
          bd.description, 
          bd.icon_url, 
          bd.category, 
          bd.rarity_level
        FROM user_badges ub
        JOIN badge_definitions bd ON ub.badge_id = bd.id
        WHERE ub.user_id = ? AND ub.is_displayed = TRUE
        ORDER BY ub.earned_at DESC
      `;
      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get user achievements
   */
  async getUserAchievements(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ua.*, 
          ad.name, 
          ad.description, 
          ad.icon_url, 
          ad.category, 
          ad.tier_level, 
          ad.points_reward
        FROM user_achievements ua
        JOIN achievement_definitions ad ON ua.achievement_id = ad.id
        WHERE ua.user_id = ?
        ORDER BY ua.unlocked_at DESC
      `;
      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  /**
   * Get user tier information
   */
  async getUserTier(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_tiers WHERE user_id = ?';
      this.db.get(sql, [userId], async (err, row) => {
        if (err) {
          reject(err);
        } else if (!row) {
          // Initialize tier
          try {
            await this.initializeUserTier(userId);
            const newRow = await this.getUserTier(userId);
            resolve(newRow);
          } catch (error) {
            reject(error);
          }
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Initialize user tier
   */
  async initializeUserTier(userId) {
    const sql = `
      INSERT INTO user_tiers 
      (user_id, current_tier, tier_points, tier_progression_percentage, unlocked_tiers)
      VALUES (?, 'bronze', 0, 0, ?)
    `;
    
    return new Promise((resolve, reject) => {
      const tiers = JSON.stringify(['bronze']);
      this.db.run(sql, [userId, tiers], (err) => {
        if (err && !err.message.includes('UNIQUE constraint failed')) {
          reject(err);
        } else {
          resolve({
            user_id: userId,
            current_tier: 'bronze',
            tier_points: 0,
            tier_progression_percentage: 0,
            unlocked_tiers: tiers
          });
        }
      });
    });
  }

  /**
   * Get user streaks
   */
  async getUserStreaks(userId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM user_streaks WHERE user_id = ?';
      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }
}

module.exports = GamificationService;
