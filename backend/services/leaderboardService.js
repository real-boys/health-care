class LeaderboardService {
  constructor(db) {
    this.db = db;
  }

  /**
   * Get leaderboard for different periods
   */
  async getLeaderboard(leaderboardType = 'all_time', limit = 50) {
    return new Promise((resolve, reject) => {
      const currentPeriod = this.getCurrentPeriod(leaderboardType);
      
      let query = `
        SELECT 
          le.rank,
          le.user_id,
          le.points,
          le.user_first_name,
          le.user_last_name,
          le.user_avatar_url,
          le.calculated_at
        FROM leaderboard_entries le
        WHERE le.leaderboard_type = ? AND le.is_active = TRUE
      `;

      const params = [leaderboardType];

      if (currentPeriod) {
        query += ' AND le.leaderboard_period = ?';
        params.push(currentPeriod);
      }

      query += ' ORDER BY le.rank ASC LIMIT ?';
      params.push(limit);

      this.db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else {
          if (!rows || rows.length === 0) {
            // Generate leaderboard if not cached
            this.generateLeaderboard(leaderboardType).then((result) => {
              resolve(result);
            }).catch(error => reject(error));
          } else {
            resolve(rows);
          }
        }
      });
    });
  }

  /**
   * Generate leaderboard from current data
   */
  async generateLeaderboard(leaderboardType = 'all_time') {
    return new Promise(async (resolve, reject) => {
      try {
        let pointsField = 'total_points';
        if (leaderboardType === 'monthly') {
          pointsField = 'points_this_month';
        } else if (leaderboardType === 'weekly') {
          pointsField = 'points_this_week';
        } else if (leaderboardType === 'level_based') {
          pointsField = 'level';
        }

        const currentPeriod = this.getCurrentPeriod(leaderboardType);

        // Fetch top users
        const fetchSql = `
          SELECT 
            up.user_id,
            up.${pointsField} as points,
            u.first_name,
            u.last_name
          FROM user_points up
          JOIN users u ON up.user_id = u.id
          ORDER BY points DESC
          LIMIT 100
        `;

        this.db.all(fetchSql, async (err, rows) => {
          if (err) return reject(err);

          // Clear old entries
          const clearSql = `
            DELETE FROM leaderboard_entries 
            WHERE leaderboard_type = ? AND leaderboard_period = ?
          `;
          this.db.run(clearSql, [leaderboardType, currentPeriod], async (err) => {
            if (err) return reject(err);

            // Insert new rankings
            let completed = 0;
            if (!rows || rows.length === 0) {
              return resolve([]);
            }

            rows.forEach((row, index) => {
              const rank = index + 1;
              const insertSql = `
                INSERT INTO leaderboard_entries 
                (user_id, rank, points, leaderboard_type, leaderboard_period, user_first_name, user_last_name, calculated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
              `;

              this.db.run(
                insertSql,
                [row.user_id, rank, row.points, leaderboardType, currentPeriod, row.first_name, row.last_name],
                (err) => {
                  if (err) {
                    console.error('Error inserting leaderboard entry:', err);
                  }
                  completed++;

                  if (completed === rows.length) {
                    resolve(this.getLeaderboard(leaderboardType, 50));
                  }
                }
              );
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get user's rank on leaderboard
   */
  async getUserRank(userId, leaderboardType = 'all_time') {
    return new Promise((resolve, reject) => {
      const currentPeriod = this.getCurrentPeriod(leaderboardType);
      
      let query = `
        SELECT rank, points FROM leaderboard_entries 
        WHERE user_id = ? AND leaderboard_type = ? AND is_active = TRUE
      `;

      const params = [userId, leaderboardType];

      if (currentPeriod) {
        query += ' AND leaderboard_period = ?';
        params.push(currentPeriod);
      }

      this.db.get(query, params, (err, row) => {
        if (err) reject(err);
        else resolve(row || { rank: 'N/A', points: 0 });
      });
    });
  }

  /**
   * Get leaderboard context (user's position with neighbors)
   */
  async getLeaderboardContext(userId, leaderboardType = 'all_time', contextSize = 2) {
    return new Promise(async (resolve, reject) => {
      try {
        const userRank = await this.getUserRank(userId, leaderboardType);
        
        if (userRank.rank === 'N/A') {
          return resolve({
            user: userRank,
            neighbors: [],
            totalParticipants: 0
          });
        }

        const currentPeriod = this.getCurrentPeriod(leaderboardType);
        const startRank = Math.max(1, userRank.rank - contextSize);
        const endRank = userRank.rank + contextSize;

        let query = `
          SELECT rank, user_id, points, user_first_name, user_last_name, user_avatar_url
          FROM leaderboard_entries 
          WHERE leaderboard_type = ? AND rank BETWEEN ? AND ?
        `;

        const params = [leaderboardType, startRank, endRank];

        if (currentPeriod) {
          query += ' AND leaderboard_period = ?';
          params.push(currentPeriod);
        }

        query += ' ORDER BY rank ASC';

        this.db.all(query, params, (err, neighbors) => {
          if (err) return reject(err);

          // Get total participants
          const countQuery = `
            SELECT COUNT(DISTINCT user_id) as total FROM leaderboard_entries
            WHERE leaderboard_type = ?
          `;
          
          this.db.get(countQuery, [leaderboardType], (err, countRow) => {
            if (err) return reject(err);

            resolve({
              user: userRank,
              neighbors: neighbors || [],
              totalParticipants: countRow?.total || 0
            });
          });
        });
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Get leaderboards by level groups
   */
  async getLevelBasedLeaderboards() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          up.level,
          COUNT(*) as participant_count,
          GROUP_CONCAT(
            json_object('user_id', up.user_id, 'points', up.total_points, 'name', u.first_name || ' ' || u.last_name),
            ','
          ) as top_players
        FROM user_points up
        JOIN users u ON up.user_id = u.id
        GROUP BY up.level
        ORDER BY up.level DESC
      `;

      this.db.all(query, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });
  }

  /**
   * Get current period for leaderboard type
   */
  getCurrentPeriod(leaderboardType) {
    const now = new Date();
    
    if (leaderboardType === 'monthly') {
      return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    } else if (leaderboardType === 'weekly') {
      const weekNum = Math.floor((now.getDate() - now.getDay() + 6) / 7);
      return `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    }
    
    return null;
  }

  /**
   * Get leaderboard statistics
   */
  async getLeaderboardStats(leaderboardType = 'all_time') {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT 
          COUNT(DISTINCT user_id) as total_participants,
          AVG(points) as average_points,
          MAX(points) as highest_points,
          MIN(points) as lowest_points,
          GROUP_CONCAT(DISTINCT rank) as total_ranks
        FROM leaderboard_entries
        WHERE leaderboard_type = ? AND is_active = TRUE
      `;

      this.db.get(query, [leaderboardType], (err, row) => {
        if (err) reject(err);
        else resolve(row || {
          total_participants: 0,
          average_points: 0,
          highest_points: 0,
          lowest_points: 0
        });
      });
    });
  }
}

module.exports = LeaderboardService;
