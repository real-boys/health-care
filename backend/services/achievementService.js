class AchievementService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create achievement definition
   */
  async createAchievement(achievementData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO achievement_definitions 
        (name, description, icon_url, category, tier_level, points_reward, unlock_criteria)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          achievementData.name,
          achievementData.description,
          achievementData.iconUrl || null,
          achievementData.category || 'engagement',
          achievementData.tierLevel || 1,
          achievementData.pointsReward || 0,
          JSON.stringify(achievementData.unlockCriteria)
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...achievementData });
        }
      );
    });
  }

  /**
   * Unlock achievement for user
   */
  async unlockAchievementForUser(userId, achievementId) {
    return new Promise((resolve, reject) => {
      // Check if already unlocked
      const checkSql = `
        SELECT * FROM user_achievements WHERE user_id = ? AND achievement_id = ?
      `;
      this.db.get(checkSql, [userId, achievementId], (err, exists) => {
        if (err) return reject(err);

        if (exists) {
          return resolve({ message: 'Achievement already unlocked', achievement_id: achievementId });
        }

        // Unlock achievement
        const insertSql = `
          INSERT INTO user_achievements (user_id, achievement_id, unlocked_at, progress_percentage)
          VALUES (?, ?, datetime('now'), 100)
        `;

        this.db.run(insertSql, [userId, achievementId], (err) => {
          if (err) return reject(err);

          // Get achievement info and update user points
          this.getAchievementById(achievementId).then(achievement => {
            // Could award points here if desired
            resolve({
              message: 'Achievement unlocked',
              achievement: achievement,
              userId: userId,
              pointsAwarded: achievement.points_reward
            });
          }).catch(error => reject(error));
        });
      });
    });
  }

  /**
   * Get achievement by ID
   */
  async getAchievementById(achievementId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM achievement_definitions WHERE id = ?';
      this.db.get(sql, [achievementId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get all achievements
   */
  async getAllAchievements() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM achievement_definitions 
        WHERE is_active = TRUE 
        ORDER BY tier_level, name
      `;
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Check if user should unlock achievement
   */
  async checkAchievementUnlock(userId, achievementId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT unlock_criteria FROM achievement_definitions WHERE id = ?
      `;

      this.db.get(sql, [achievementId], async (err, row) => {
        if (err) return reject(err);
        if (!row) return reject(new Error('Achievement not found'));

        try {
          const criteria = JSON.parse(row.unlock_criteria);
          const isUnlocked = await this.evaluateCriteria(userId, criteria);
          resolve({
            achievementId: achievementId,
            isUnlocked: isUnlocked,
            criteria: criteria
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Evaluate achievement unlock criteria
   */
  async evaluateCriteria(userId, criteria) {
    if (criteria.type === 'total_points') {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT total_points FROM user_points WHERE user_id = ?';
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.total_points || 0) >= criteria.value);
        });
      });
    } else if (criteria.type === 'health_tracking_days') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(DISTINCT DATE(earned_at)) as days FROM points_activity_log 
          WHERE user_id = ? AND activity_type = 'health_tracking'
        `;
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.days || 0) >= criteria.days);
        });
      });
    } else if (criteria.type === 'appointment_attended') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count FROM points_activity_log 
          WHERE user_id = ? AND activity_type = 'appointment_attended'
        `;
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.count || 0) >= criteria.count);
        });
      });
    } else if (criteria.type === 'badges_collected') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count FROM user_badges WHERE user_id = ?
        `;
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.count || 0) >= criteria.count);
        });
      });
    } else if (criteria.type === 'tier_reached') {
      return new Promise((resolve, reject) => {
        const tierOrder = { bronze: 1, silver: 2, gold: 3, platinum: 4, diamond: 5 };
        const sql = 'SELECT current_tier FROM user_tiers WHERE user_id = ?';
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else {
            const currentTierValue = tierOrder[row?.current_tier || 'bronze'] || 0;
            const requiredTierValue = tierOrder[criteria.tier] || 0;
            resolve(currentTierValue >= requiredTierValue);
          }
        });
      });
    }

    resolve(false);
  }

  /**
   * Get user achievements with progress
   */
  async getUserAchievementsWithProgress(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const allAchievements = await this.getAllAchievements();
        const unlockedAchievements = await this.getUserUnlockedAchievements(userId);
        const unlockedIds = new Set(unlockedAchievements.map(a => a.achievement_id));

        const result = [];
        for (const achievement of allAchievements) {
          const isUnlocked = unlockedIds.has(achievement.id);
          const criteria = JSON.parse(achievement.unlock_criteria);
          const progressValue = await this.getProgressValue(userId, criteria);

          result.push({
            achievementId: achievement.id,
            name: achievement.name,
            description: achievement.description,
            icon_url: achievement.icon_url,
            category: achievement.category,
            tier_level: achievement.tier_level,
            points_reward: achievement.points_reward,
            isUnlocked: isUnlocked,
            unlockedAt: isUnlocked ? unlockedAchievements.find(a => a.achievement_id === achievement.id)?.unlocked_at : null,
            progressValue: progressValue,
            criteria: criteria
          });
        }

        resolve(result);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user unlocked achievements
   */
  async getUserUnlockedAchievements(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM user_achievements WHERE user_id = ? ORDER BY unlocked_at DESC
      `;
      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Calculate progress towards achievement
   */
  async getProgressValue(userId, criteria) {
    if (criteria.type === 'total_points') {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT total_points FROM user_points WHERE user_id = ?';
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else {
            const current = row?.total_points || 0;
            resolve({
              current: current,
              target: criteria.value,
              percentage: Math.min(100, Math.floor((current / criteria.value) * 100))
            });
          }
        });
      });
    } else if (criteria.type === 'health_tracking_days') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(DISTINCT DATE(earned_at)) as days FROM points_activity_log 
          WHERE user_id = ? AND activity_type = 'health_tracking'
        `;
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else {
            const current = row?.days || 0;
            resolve({
              current: current,
              target: criteria.days,
              percentage: Math.min(100, Math.floor((current / criteria.days) * 100))
            });
          }
        });
      });
    } else if (criteria.type === 'appointment_attended') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count FROM points_activity_log 
          WHERE user_id = ? AND activity_type = 'appointment_attended'
        `;
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else {
            const current = row?.count || 0;
            resolve({
              current: current,
              target: criteria.count,
              percentage: Math.min(100, Math.floor((current / criteria.count) * 100))
            });
          }
        });
      });
    }

    return { current: 0, target: 0, percentage: 0 };
  }
}

module.exports = AchievementService;
