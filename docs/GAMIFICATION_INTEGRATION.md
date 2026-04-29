# Gamification Integration Guide

## Integration Points

This guide shows how to integrate gamification rewards into existing healthcare application features.

## 1. Appointment System Integration

### Award Points for Attended Appointments

In `backend/routes/appointments.js` or your appointment update handler:

```javascript
const GamificationService = require('../services/gamificationService');

// When appointment is marked as attended
async function markAppointmentAsAttended(appointmentId, userId) {
  try {
    // Update appointment status
    // ... existing code ...
    
    // Award points
    const gamificationService = new GamificationService(db);
    await gamificationService.awardPoints(
      userId,
      100,
      'appointment_attended',
      `Attended appointment ${appointmentId}`,
      { appointmentId, appointmentDate: new Date() }
    );

    // Update streak
    await gamificationService.updateStreak(userId, 'appointments');
  } catch (error) {
    console.error('Error in appointment attendance:', error);
  }
}
```

### Trigger Badge Checks

```javascript
const BadgeService = require('../services/badgeService');

async function checkAppointmentBadges(userId) {
  const badgeService = new BadgeService(db);
  
  // Badge IDs for appointment-related badges (adjust based on your data)
  const badgeIds = [1, 2]; // 'First Steps', 'Committed'
  
  for (const badgeId of badgeIds) {
    const result = await badgeService.checkBadgeUnlock(userId, badgeId);
    if (result.isUnlocked) {
      await badgeService.awardBadgeToUser(userId, badgeId);
    }
  }
}
```

## 2. Health Tracking Integration

### Award Points for Health Data Entry

In your health tracking routes:

```javascript
app.post('/api/health-tracking', async (req, res) => {
  try {
    const { userId, metrics } = req.body;
    
    // Save health tracking data
    // ... existing code ...
    
    // Award daily points for tracking
    const gamificationService = new GamificationService(db);
    await gamificationService.awardPoints(
      userId,
      25,
      'health_tracking',
      `Logged health metrics: ${Object.keys(metrics).join(', ')}`,
      { metrics }
    );
    
    res.json({ success: true, message: 'Health data saved and points awarded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Trigger Health Achievements

```javascript
const AchievementService = require('../services/achievementService');

async function checkHealthAchievements(userId) {
  const achievementService = new AchievementService(db);
  
  // Achievement IDs for health-related achievements
  const achievementIds = [1, 2, 3]; // Wellness-related achievements
  
  for (const achievementId of achievementIds) {
    const result = await achievementService.checkAchievementUnlock(userId, achievementId);
    if (result.isUnlocked) {
      await achievementService.unlockAchievementForUser(userId, achievementId);
    }
  }
}
```

## 3. Survey & Questionnaire Integration

### Award Points for Survey Completion

```javascript
app.post('/api/surveys/:surveyId/submit', async (req, res) => {
  try {
    const { userId } = req.body;
    const { surveyId } = req.params;
    
    // Save survey responses
    // ... existing code ...
    
    // Award points for survey completion
    const gamificationService = new GamificationService(db);
    await gamificationService.awardPoints(
      userId,
      75,
      'survey_completed',
      `Completed survey: ${surveyId}`,
      { surveyId, completedAt: new Date() }
    );
    
    res.json({ success: true, message: 'Survey submitted and points awarded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 4. Profile Completion Integration

### Award Points for Profile Updates

```javascript
app.put('/api/users/:userId/profile', async (req, res) => {
  try {
    const { userId } = req.params;
    const updates = req.body;
    
    // Update user profile
    // ... existing code ...
    
    // Award points for profile updates
    const gamificationService = new GamificationService(db);
    const fieldsUpdated = Object.keys(updates).join(', ');
    
    await gamificationService.awardPoints(
      userId,
      25,
      'profile_updated',
      `Updated profile fields: ${fieldsUpdated}`,
      { fieldsUpdated, timestamp: new Date() }
    );
    
    res.json({ success: true, message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 5. Review & Rating Integration

### Award Points for Reviews

```javascript
app.post('/api/reviews', async (req, res) => {
  try {
    const { userId, providerId, rating, comment } = req.body;
    
    // Save review
    // ... existing code ...
    
    // Award points for posting review
    const gamificationService = new GamificationService(db);
    const pointsForReview = Math.min(50 + (rating * 10), 100); // Extra points for higher ratings
    
    await gamificationService.awardPoints(
      userId,
      pointsForReview,
      'review_posted',
      `Posted review for provider ${providerId}`,
      { providerId, rating, commentLength: comment?.length || 0 }
    );
    
    res.json({ success: true, message: 'Review posted and points awarded' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 6. Article & Content Engagement

### Award Points for Content Interaction

```javascript
app.post('/api/articles/:articleId/track-read', async (req, res) => {
  try {
    const { userId } = req.body;
    const { articleId } = req.params;
    
    // Track article read
    // ... existing code ...
    
    // Award small points for reading
    const gamificationService = new GamificationService(db);
    await gamificationService.awardPoints(
      userId,
      10,
      'article_read',
      `Read article ${articleId}`,
      { articleId, readAt: new Date() }
    );
    
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

## 7. Frontend Component Integration

### Display Points Progress in Dashboard

```javascript
// src/pages/Dashboard.js
import React from 'react';
import PointsDisplay from '../components/PointsDisplay';
import GamificationDashboard from '../components/GamificationDashboard';

function Dashboard() {
  const userId = localStorage.getItem('userId');
  
  return (
    <div className="dashboard">
      <h1>Your Healthcare Dashboard</h1>
      
      {/* Show points widget in main dashboard */}
      <div className="dashboard-grid">
        <PointsDisplay userId={userId} showHistory={true} />
        {/* other dashboard components */}
      </div>
      
      {/* Dedicated gamification page */}
      <GamificationDashboard userId={userId} />
    </div>
  );
}

export default Dashboard;
```

### Show Points on Appointment Completion

```javascript
// In appointment confirmation component
import React from 'react';
import { useGamification } from '../context/GamificationContext';

function AppointmentConfirmation({ appointment }) {
  const { awardPoints } = useGamification();
  
  React.useEffect(() => {
    // Award points when component mounts
    awardPoints(100, 'appointment_attended', `Attended appointment with ${appointment.provider}`);
  }, [appointment]);
  
  return (
    <div className="confirmation">
      <h2>Appointment Completed!</h2>
      <p>You earned 100 points 🎉</p>
      {/* rest of component */}
    </div>
  );
}

export default AppointmentConfirmation;
```

### Challenge Widget in Dashboard

```javascript
// src/components/ChallengeWidget.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function ChallengeWidget({ userId }) {
  const [activeChallenges, setActiveChallenges] = useState([]);
  
  useEffect(() => {
    const fetchChallenges = async () => {
      try {
        const res = await axios.get(`/api/gamification/user/${userId}/challenges`);
        setActiveChallenges(res.data.slice(0, 3)); // Show top 3
      } catch (error) {
        console.error('Error fetching challenges:', error);
      }
    };
    
    fetchChallenges();
  }, [userId]);
  
  return (
    <div className="challenge-widget">
      <h3>Active Challenges</h3>
      {activeChallenges.map(challenge => (
        <div key={challenge.challenge_id} className="challenge-card">
          <h4>{challenge.name}</h4>
          <div className="progress-bar">
            <div 
              className="progress"
              style={{ width: `${challenge.progress_percentage}%` }}
            ></div>
          </div>
          <span>{challenge.progress_percentage}% Complete</span>
        </div>
      ))}
    </div>
  );
}

export default ChallengeWidget;
```

## 8. Notification Integration

### Notify Users of Achievements

```javascript
// services/notificationService.js
const NotificationService = require('../services/notificationService');

async function notifyAchievementUnlock(userId, achievement) {
  const notificationService = new NotificationService();
  
  await notificationService.sendNotification(userId, {
    title: '🎉 Achievement Unlocked!',
    message: `You've unlocked "${achievement.name}"! +${achievement.points_reward} points`,
    type: 'achievement',
    payload: { achievementId: achievement.id }
  });
}

// In achievement service
async function unlockAchievementForUser(userId, achievementId) {
  // ... existing code ...
  
  // Notify user
  try {
    await notifyAchievementUnlock(userId, achievement);
  } catch (error) {
    console.error('Error sending notification:', error);
  }
}
```

## 9. Daily Bonus Integration

### Award Daily Bonus Points

Create a scheduled job:

```javascript
// services/dailyBonusService.js
const schedule = require('node-schedule');
const GamificationService = require('./gamificationService');

class DailyBonusService {
  constructor(db) {
    this.db = db;
    this.gamificationService = new GamificationService(db);
  }

  scheduleDaily() {
    // Run at 2 AM every day
    schedule.scheduleJob('0 2 * * *', async () => {
      await this.awardDailyBonus();
    });
  }

  async awardDailyBonus() {
    try {
      // Get all active users
      const sql = 'SELECT id FROM users WHERE is_active = TRUE';
      
      this.db.all(sql, async (err, users) => {
        if (err) {
          console.error('Error fetching users for daily bonus:', err);
          return;
        }

        // Award bonus to each user
        for (const user of users) {
          try {
            await this.gamificationService.awardPoints(
              user.id,
              25,
              'daily_activity',
              'Daily login bonus',
              { bonusType: 'daily' }
            );
          } catch (error) {
            console.error(`Error awarding daily bonus to user ${user.id}:`, error);
          }
        }

        console.log(`Daily bonus awarded to ${users.length} users`);
      });
    } catch (error) {
      console.error('Error in daily bonus service:', error);
    }
  }
}

module.exports = DailyBonusService;
```

Register in server.js:

```javascript
const DailyBonusService = require('./services/dailyBonusService');

const dailyBonusService = new DailyBonusService(db);
dailyBonusService.scheduleDaily();
```

## 10. Leaderboard Display Integration

### Add Leaderboard to Navigation

```javascript
// src/components/Navigation.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Navigation() {
  const [userRank, setUserRank] = useState(null);
  const userId = localStorage.getItem('userId');
  
  useEffect(() => {
    const fetchRank = async () => {
      try {
        const res = await axios.get(
          `/api/gamification/user/${userId}/rank/all_time`
        );
        setUserRank(res.data.rank);
      } catch (error) {
        console.error('Error fetching rank:', error);
      }
    };
    
    fetchRank();
  }, [userId]);
  
  return (
    <nav className="navbar">
      {/* other nav items */}
      {userRank && <span className="rank-badge">#{userRank}</span>}
    </nav>
  );
}

export default Navigation;
```

## Event Flow Example

Here's a complete example of points award flow:

```
1. User completes appointment
   ↓
2. appointmentUpdate() triggered
   ↓
3. awardPoints() called with 100 points
   ↓
4. Points added to user_points
   ↓
5. Activity logged to points_activity_log
   ↓
6. checkLevelUp() checks if user qualifies for promotion
   ↓
7. If level up → update user_points.level
   ↓
8. checkAppointmentBadges() checks if badges unlocked
   ↓
9. If badge criteria met → awardBadgeToUser()
   ↓
10. Frontend notified via WebSocket/Polling
    ↓
11. UI updated with new points, badges, level
```

## Testing Gamification Features

```javascript
// test/gamification.test.js
const GamificationService = require('../services/gamificationService');
const BadgeService = require('../services/badgeService');

describe('Gamification System', () => {
  let gamificationService;
  let badgeService;
  
  beforeEach(() => {
    gamificationService = new GamificationService(db);
    badgeService = new BadgeService(db);
  });
  
  test('should award points successfully', async () => {
    const result = await gamificationService.awardPoints(
      1,
      100,
      'appointment_attended',
      'Test appointment'
    );
    expect(result.total_points).toBe(100);
  });
  
  test('should unlock badge when criteria met', async () => {
    await gamificationService.awardPoints(1, 500, 'activity');
    const result = await badgeService.checkBadgeUnlock(1, 1);
    expect(result.isUnlocked).toBe(true);
  });
});
```

## Performance Monitoring

Monitor these metrics:

```javascript
// Dashboard queries to monitor
- Average points per user
- Badge unlock rates
- Challenge completion rates
- Leaderboard churn
- Daily new achievements
```

## Troubleshooting Integration

Common issues and solutions:

1. **Points not awarding**: Check if database transaction is committing
2. **Badges not unlocking**: Verify criteria JSON format and conditions
3. **Leaderboards empty**: Run leaderboard regeneration endpoint
4. **Notification not showing**: Check notification service configuration
5. **Performance slow**: Verify database indexes are created
