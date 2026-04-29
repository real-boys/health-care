class BadgeService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new badge definition
   */
  async createBadge(badgeData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO badge_definitions 
        (name, description, icon_url, category, rarity_level, unlock_criteria, points_reward, display_order)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          badgeData.name,
          badgeData.description,
          badgeData.iconUrl || null,
          badgeData.category || 'engagement',
          badgeData.rarityLevel || 'common',
          JSON.stringify(badgeData.unlockCriteria),
          badgeData.pointsReward || 0,
          badgeData.displayOrder || 999
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...badgeData });
        }
      );
    });
  }

  /**
   * Award badge to user
   */
  async awardBadgeToUser(userId, badgeId) {
    return new Promise((resolve, reject) => {
      // Check if user already has badge
      const checkSql = 'SELECT * FROM user_badges WHERE user_id = ? AND badge_id = ?';
      this.db.get(checkSql, [userId, badgeId], (err, exists) => {
        if (err) return reject(err);

        if (exists) {
          return resolve({ message: 'Badge already earned', badge_id: badgeId });
        }

        // Award badge
        const insertSql = `
          INSERT INTO user_badges (user_id, badge_id, earned_at)
          VALUES (?, ?, datetime('now'))
        `;

        this.db.run(insertSql, [userId, badgeId], async (err) => {
          if (err) {
            return reject(err);
          }

          // Get badge info
          try {
            const badgeInfo = await this.getBadgeById(badgeId);
            resolve({
              message: 'Badge awarded successfully',
              badge: badgeInfo,
              userId: userId
            });
          } catch (error) {
            reject(error);
          }
        });
      });
    });
  }

  /**
   * Get badge by ID
   */
  async getBadgeById(badgeId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM badge_definitions WHERE id = ?';
      this.db.get(sql, [badgeId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  /**
   * Get all badges
   */
  async getAllBadges() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM badge_definitions 
        WHERE is_active = TRUE 
        ORDER BY display_order, name
      `;
      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Check badge unlock criteria
   */
  async checkBadgeUnlock(userId, badgeId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT unlock_criteria FROM badge_definitions WHERE id = ?
      `;

      this.db.get(sql, [badgeId], async (err, badgeRow) => {
        if (err) return reject(err);
        if (!badgeRow) return reject(new Error('Badge not found'));

        try {
          const criteria = JSON.parse(badgeRow.unlock_criteria);
          const isUnlocked = await this.evaluateCriteria(userId, criteria);
          resolve({
            badgeId: badgeId,
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
   * Evaluate badge unlock criteria
   */
  async evaluateCriteria(userId, criteria) {
    // Example criteria structure:
    // { type: 'points_threshold', value: 1000 }
    // { type: 'activity_count', activity: 'appointment', count: 5 }
    // { type: 'level_reached', level: 5 }

    if (criteria.type === 'points_threshold') {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT total_points FROM user_points WHERE user_id = ?';
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.total_points || 0) >= criteria.value);
        });
      });
    } else if (criteria.type === 'activity_count') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count FROM points_activity_log 
          WHERE user_id = ? AND activity_type = ?
        `;
        this.db.get(sql, [userId, criteria.activity], (err, row) => {
          if (err) reject(err);
          else resolve((row?.count || 0) >= criteria.count);
        });
      });
    } else if (criteria.type === 'level_reached') {
      return new Promise((resolve, reject) => {
        const sql = 'SELECT level FROM user_points WHERE user_id = ?';
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.level || 0) >= criteria.level);
        });
      });
    } else if (criteria.type === 'badge_collection') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count FROM user_badges 
          WHERE user_id = ? AND earned_at IS NOT NULL
        `;
        this.db.get(sql, [userId], (err, row) => {
          if (err) reject(err);
          else resolve((row?.count || 0) >= criteria.count);
        });
      });
    }

    resolve(false);
  }

  /**
   * Get badge progress for user
   */
  async getUserBadgeProgress(userId) {
    return new Promise(async (resolve, reject) => {
      try {
        const allBadges = await this.getAllBadges();
        const earnedBadges = await this.getEarnedBadges(userId);
        const earnedIds = new Set(earnedBadges.map(b => b.badge_id));

        const progress = [];
        for (const badge of allBadges) {
          const criteria = JSON.parse(badge.unlock_criteria);
          const isEarned = earnedIds.has(badge.id);
          const progressValue = await this.getProgressValue(userId, criteria);

          progress.push({
            badgeId: badge.id,
            name: badge.name,
            description: badge.description,
            icon_url: badge.icon_url,
            category: badge.category,
            rarity_level: badge.rarity_level,
            isEarned: isEarned,
            progressValue: progressValue,
            criteria: criteria
          });
        }

        resolve(progress);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get earned badges for user
   */
  async getEarnedBadges(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT ub.*, bd.* FROM user_badges ub
        JOIN badge_definitions bd ON ub.badge_id = bd.id
        WHERE ub.user_id = ? AND ub.earned_at IS NOT NULL
        ORDER BY ub.earned_at DESC
      `;
      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Calculate progress value towards badge criteria
   */
  async getProgressValue(userId, criteria) {
    if (criteria.type === 'points_threshold') {
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
    } else if (criteria.type === 'activity_count') {
      return new Promise((resolve, reject) => {
        const sql = `
          SELECT COUNT(*) as count FROM points_activity_log 
          WHERE user_id = ? AND activity_type = ?
        `;
        this.db.get(sql, [userId, criteria.activity], (err, row) => {
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

module.exports = BadgeService;
