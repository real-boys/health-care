class ChallengeService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Create a new challenge
   */
  async createChallenge(challengeData) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO challenges 
        (name, description, challenge_type, start_date, end_date, points_reward, completion_criteria, difficulty_level)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(
        sql,
        [
          challengeData.name,
          challengeData.description,
          challengeData.challengeType || 'daily',
          challengeData.startDate,
          challengeData.endDate,
          challengeData.pointsReward || 100,
          JSON.stringify(challengeData.completionCriteria),
          challengeData.difficultyLevel || 'medium'
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID, ...challengeData });
        }
      );
    });
  }

  /**
   * Get active challenges
   */
  async getActiveChallenges() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM challenges 
        WHERE is_active = TRUE 
        AND datetime(start_date) <= datetime('now')
        AND datetime(end_date) > datetime('now')
        ORDER BY difficulty_level, start_date
      `;

      this.db.all(sql, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get upcoming challenges
   */
  async getUpcomingChallenges(limit = 10) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM challenges 
        WHERE is_active = TRUE 
        AND datetime(start_date) > datetime('now')
        ORDER BY start_date ASC
        LIMIT ?
      `;

      this.db.all(sql, [limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Join challenge
   */
  async joinChallenge(userId, challengeId) {
    return new Promise((resolve, reject) => {
      // Check if already joined
      const checkSql = `
        SELECT * FROM user_challenge_progress WHERE user_id = ? AND challenge_id = ?
      `;

      this.db.get(checkSql, [userId, challengeId], (err, exists) => {
        if (err) return reject(err);

        if (exists) {
          return resolve({ message: 'Already joined', challenge_id: challengeId });
        }

        // Join challenge
        const joinSql = `
          INSERT INTO user_challenge_progress 
          (user_id, challenge_id, progress_value, progress_percentage, joined_at)
          VALUES (?, ?, 0, 0, datetime('now'))
        `;

        this.db.run(joinSql, [userId, challengeId], (err) => {
          if (err) return reject(err);

          // Increment participant count
          const updateSql = 'UPDATE challenges SET participant_count = participant_count + 1 WHERE id = ?';
          this.db.run(updateSql, [challengeId], (err) => {
            if (err) return reject(err);
            resolve({ message: 'Successfully joined challenge', userId: userId, challengeId: challengeId });
          });
        });
      });
    });
  }

  /**
   * Update challenge progress
   */
  async updateChallengeProgress(userId, challengeId, progressValue) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get challenge completion criteria
        const challengeSql = 'SELECT completion_criteria FROM challenges WHERE id = ?';
        
        this.db.get(challengeSql, [challengeId], async (err, challengeRow) => {
          if (err) return reject(err);
          if (!challengeRow) return reject(new Error('Challenge not found'));

          const criteria = JSON.parse(challengeRow.completion_criteria);
          const progressPercentage = Math.floor((progressValue / criteria.target) * 100);
          const isCompleted = progressValue >= criteria.target;

          const updateSql = `
            UPDATE user_challenge_progress
            SET 
              progress_value = ?,
              progress_percentage = ?,
              is_completed = ?,
              completed_at = ${isCompleted ? "datetime('now')" : 'NULL'}
            WHERE user_id = ? AND challenge_id = ?
          `;

          this.db.run(
            updateSql,
            [progressValue, Math.min(100, progressPercentage), isCompleted ? 1 : 0, userId, challengeId],
            async (err) => {
              if (err) return reject(err);

              // If completed, award points
              if (isCompleted) {
                const pointsSql = 'SELECT points_reward FROM challenges WHERE id = ?';
                this.db.get(pointsSql, [challengeId], (err, row) => {
                  if (err) console.error('Error getting points:', err);
                  resolve({
                    message: 'Challenge completed!',
                    progress: progressPercentage,
                    pointsAwarded: row?.points_reward || 0,
                    isCompleted: true
                  });
                });
              } else {
                resolve({
                  message: 'Progress updated',
                  progress: progressPercentage,
                  isCompleted: false
                });
              }
            }
          );
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user's challenge progress
   */
  async getUserChallengeProgress(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ucp.*,
          c.name,
          c.description,
          c.points_reward,
          c.difficulty_level,
          c.completion_criteria,
          CASE WHEN datetime(c.end_date) <= datetime('now') THEN 'expired'
               WHEN datetime(c.start_date) > datetime('now') THEN 'upcoming'
               ELSE 'active' END as status
        FROM user_challenge_progress ucp
        JOIN challenges c ON ucp.challenge_id = c.id
        ORDER BY c.end_date ASC
      `;

      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else {
          const challenges = (rows || []).map(row => ({
            ...row,
            completion_criteria: JSON.parse(row.completion_criteria)
          }));
          resolve(challenges);
        }
      });
    });
  }

  /**
   * Get challenge leaderboard for a specific challenge
   */
  async getChallengeLearderboard(challengeId, limit = 50) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          ucp.user_id,
          ucp.progress_value,
          ucp.progress_percentage,
          ucp.is_completed,
          ucp.completed_at,
          u.first_name,
          u.last_name
        FROM user_challenge_progress ucp
        JOIN users u ON ucp.user_id = u.id
        WHERE ucp.challenge_id = ?
        ORDER BY ucp.is_completed DESC, ucp.progress_percentage DESC, ucp.completed_at ASC
        LIMIT ?
      `;

      this.db.all(sql, [challengeId, limit], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get challenge statistics
   */
  async getChallengeStats(challengeId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          c.name,
          c.participant_count,
          COUNT(DISTINCT ucp.user_id) as joined_count,
          COUNT(DISTINCT CASE WHEN ucp.is_completed = TRUE THEN ucp.user_id END) as completed_count,
          AVG(ucp.progress_percentage) as average_progress,
          MAX(ucp.progress_percentage) as highest_progress
        FROM challenges c
        LEFT JOIN user_challenge_progress ucp ON c.id = ucp.challenge_id
        WHERE c.id = ?
        GROUP BY c.id
      `;

      this.db.get(sql, [challengeId], (err, row) => {
        if (err) reject(err);
        else resolve(row || {});
      });
    });
  }

  /**
   * Get user's completed challenges
   */
  async getUserCompletedChallenges(userId) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          c.*,
          ucp.completed_at,
          ucp.points_earned
        FROM user_challenge_progress ucp
        JOIN challenges c ON ucp.challenge_id = c.id
        WHERE ucp.user_id = ? AND ucp.is_completed = TRUE
        ORDER BY ucp.completed_at DESC
      `;

      this.db.all(sql, [userId], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get recommended challenges for user
   */
  async getRecommendedChallenges(userId, limit = 5) {
    return new Promise(async (resolve, reject) => {
      try {
        // Get user's level/tier
        const userPointsSql = 'SELECT level FROM user_points WHERE user_id = ?';
        this.db.get(userPointsSql, [userId], async (err, userRow) => {
          if (err) return reject(err);

          const userLevel = userRow?.level || 1;
          let recommendedDifficulty = 'easy';
          if (userLevel > 10) recommendedDifficulty = 'hard';
          else if (userLevel > 5) recommendedDifficulty = 'medium';

          // Get active challenges not yet joined
          const sql = `
            SELECT c.* FROM challenges c
            WHERE c.is_active = TRUE
            AND datetime(c.start_date) <= datetime('now')
            AND datetime(c.end_date) > datetime('now')
            AND c.id NOT IN (
              SELECT challenge_id FROM user_challenge_progress WHERE user_id = ?
            )
            ORDER BY c.difficulty_level = ? DESC, c.points_reward DESC
            LIMIT ?
          `;

          this.db.all(sql, [userId, recommendedDifficulty, limit], (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}

module.exports = ChallengeService;
