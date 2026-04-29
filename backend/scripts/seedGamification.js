const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

const badges = [
  {
    name: 'First Steps',
    description: 'Complete your first appointment',
    category: 'engagement',
    rarity_level: 'common',
    unlock_criteria: { type: 'activity_count', activity: 'appointment_attended', count: 1 },
    points_reward: 50,
    display_order: 1
  },
  {
    name: 'Committed',
    description: 'Attend 10 appointments',
    category: 'engagement',
    rarity_level: 'uncommon',
    unlock_criteria: { type: 'activity_count', activity: 'appointment_attended', count: 10 },
    points_reward: 100,
    display_order: 2
  },
  {
    name: 'Health Tracker',
    description: 'Share health data for 7 consecutive days',
    category: 'health',
    rarity_level: 'uncommon',
    unlock_criteria: { type: 'activity_count', activity: 'health_tracking', count: 7 },
    points_reward: 75,
    display_order: 3
  },
  {
    name: 'Wellness Warrior',
    description: 'Maintain a 30-day streak',
    category: 'health',
    rarity_level: 'rare',
    unlock_criteria: { type: 'activity_count', activity: 'health_tracking', count: 30 },
    points_reward: 200,
    display_order: 4
  },
  {
    name: 'Point Collector',
    description: 'Earn 500 points',
    category: 'achievement',
    rarity_level: 'uncommon',
    unlock_criteria: { type: 'points_threshold', value: 500 },
    points_reward: 100,
    display_order: 5
  },
  {
    name: 'Rising Star',
    description: 'Reach level 5',
    category: 'achievement',
    rarity_level: 'rare',
    unlock_criteria: { type: 'level_reached', level: 5 },
    points_reward: 150,
    display_order: 6
  },
  {
    name: 'Badge Master',
    description: 'Collect 5 badges',
    category: 'achievement',
    rarity_level: 'epic',
    unlock_criteria: { type: 'badge_collection', count: 5 },
    points_reward: 250,
    display_order: 7
  },
  {
    name: 'Profile Pro',
    description: 'Complete your health profile',
    category: 'engagement',
    rarity_level: 'common',
    unlock_criteria: { type: 'activity_count', activity: 'profile_updated', count: 1 },
    points_reward: 50,
    display_order: 8
  },
  {
    name: 'Community Member',
    description: 'Post your first review',
    category: 'social',
    rarity_level: 'common',
    unlock_criteria: { type: 'activity_count', activity: 'review_posted', count: 1 },
    points_reward: 50,
    display_order: 9
  },
  {
    name: 'Influencer',
    description: 'Post 10 reviews',
    category: 'social',
    rarity_level: 'epic',
    unlock_criteria: { type: 'activity_count', activity: 'review_posted', count: 10 },
    points_reward: 200,
    display_order: 10
  }
];

const achievements = [
  {
    name: 'Health Enthusiast',
    description: 'Complete 100 health tracking activities',
    category: 'health',
    tier_level: 3,
    points_reward: 500,
    unlock_criteria: { type: 'health_tracking_days', days: 100 }
  },
  {
    name: 'Loyal Patient',
    description: 'Attend 20 appointments',
    category: 'engagement',
    tier_level: 2,
    points_reward: 300,
    unlock_criteria: { type: 'appointment_attended', count: 20 }
  },
  {
    name: 'Wellness Master',
    description: 'Earn 5000 total points',
    category: 'wellness',
    tier_level: 4,
    points_reward: 1000,
    unlock_criteria: { type: 'total_points', value: 5000 }
  },
  {
    name: 'Bronze Tier Member',
    description: 'Reach Bronze tier',
    category: 'milestone',
    tier_level: 1,
    points_reward: 200,
    unlock_criteria: { type: 'tier_reached', tier: 'bronze' }
  },
  {
    name: 'Silver Tier Member',
    description: 'Reach Silver tier',
    category: 'milestone',
    tier_level: 2,
    points_reward: 400,
    unlock_criteria: { type: 'tier_reached', tier: 'silver' }
  },
  {
    name: 'Gold Tier Member',
    description: 'Reach Gold tier',
    category: 'milestone',
    tier_level: 3,
    points_reward: 800,
    unlock_criteria: { type: 'tier_reached', tier: 'gold' }
  },
  {
    name: 'Platinum Elite',
    description: 'Reach Platinum tier',
    category: 'milestone',
    tier_level: 4,
    points_reward: 1500,
    unlock_criteria: { type: 'tier_reached', tier: 'platinum' }
  },
  {
    name: 'Collectors Dream',
    description: 'Collect 10 badges',
    category: 'achievement',
    tier_level: 2,
    points_reward: 400,
    unlock_criteria: { type: 'badges_collected', count: 10 }
  }
];

async function seedGamificationData() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        return reject(err);
      }

      // Insert badges
      let completedBadges = 0;
      badges.forEach(badge => {
        const sql = `
          INSERT OR IGNORE INTO badge_definitions 
          (name, description, category, rarity_level, unlock_criteria, points_reward, display_order)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `;

        db.run(
          sql,
          [
            badge.name,
            badge.description,
            badge.category,
            badge.rarity_level,
            JSON.stringify(badge.unlock_criteria),
            badge.points_reward,
            badge.display_order
          ],
          (err) => {
            if (err) console.error('Error inserting badge:', err);
            completedBadges++;

            if (completedBadges === badges.length) {
              // Insert achievements
              let completedAchievements = 0;
              achievements.forEach(achievement => {
                const achSql = `
                  INSERT OR IGNORE INTO achievement_definitions 
                  (name, description, category, tier_level, points_reward, unlock_criteria)
                  VALUES (?, ?, ?, ?, ?, ?)
                `;

                db.run(
                  achSql,
                  [
                    achievement.name,
                    achievement.description,
                    achievement.category,
                    achievement.tier_level,
                    achievement.points_reward,
                    JSON.stringify(achievement.unlock_criteria)
                  ],
                  (err) => {
                    if (err) console.error('Error inserting achievement:', err);
                    completedAchievements++;

                    if (completedAchievements === achievements.length) {
                      db.close((err) => {
                        if (err) {
                          reject(err);
                        } else {
                          console.log('✓ Gamification seed data inserted successfully');
                          resolve();
                        }
                      });
                    }
                  }
                );
              });
            }
          }
        );
      });
    });
  });
}

// Run if called directly
if (require.main === module) {
  seedGamificationData()
    .then(() => process.exit(0))
    .catch(err => {
      console.error('Error seeding data:', err);
      process.exit(1);
    });
}

module.exports = seedGamificationData;
