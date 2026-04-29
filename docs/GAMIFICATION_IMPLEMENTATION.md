# Gamification System Implementation Guide

## Overview

This comprehensive gamification system adds points, badges, leaderboards, and achievements to motivate users and increase engagement in the healthcare platform.

## Features

### 1. **Points System**
- Users earn points for various healthcare activities
- Points accumulate and contribute to level progression
- Weekly and monthly point tracking for competitive leaderboards
- Exponential level requirements (100 × level^1.5)

### 2. **Badges**
- Multiple badge categories: health, social, engagement, fitness, achievement, milestone
- Rarity levels: common, uncommon, rare, epic, legendary
- Dynamic unlock criteria based on user activities
- Visual progress indicators for locked badges

### 3. **Achievements**
- Tiered achievements: Bronze, Silver, Gold, Platinum
- Progress tracking with percentage completion
- Major milestone achievements for significant accomplishments
- Point rewards for unlocking achievements

### 4. **Leaderboards**
- Multiple leaderboard types: all_time, monthly, weekly
- Level-based leaderboards for grouped competition
- User ranking context with neighboring players
- Comprehensive leaderboard statistics

### 5. **Challenges**
- Time-limited challenges with difficulty levels
- Daily, weekly, and seasonal challenge types
- Challenge-specific leaderboards
- Progress tracking and completion rewards
- Recommended challenges based on user level

### 6. **Streaks**
- Daily activity streak tracking
- Longest streak records
- Automatic streak reset if broken
- Motivation for consistent engagement

### 7. **User Tiers**
- Progressive tier system: Bronze → Silver → Gold → Platinum → Diamond
- Tier-based benefits and exclusive features
- Tier progression percentage tracking
- Tier promotion announcements

## Database Schema

### Core Tables

#### `user_points`
- Tracks user's total points and progression
- Monthly/weekly point snapshots
- Current level and points to next level
- Achievement and badge counters
- Streak tracking

#### `points_activity_log`
- Complete transaction log of all points earned
- Activity type classification
- Metadata for contextual information
- Used for analytics and accountability

#### `badge_definitions`
- Definition of all available badges
- Unlock criteria (JSON format)
- Rarity levels and display order
- Points rewards

#### `user_badges`
- User's earned badges
- Earned dates
- Progress values for unlocked badges
- Display preferences

#### `achievement_definitions`
- Definition of all achievements
- Tier levels
- Point rewards
- Unlock criteria

#### `user_achievements`
- User's unlocked achievements
- Unlock dates
- Progress percentage
- Announcement flags

#### `leaderboard_entries`
- Cached leaderboard rankings
- Different leaderboard types and periods
- User information snapshots
- Ranking calculations

#### `challenges`
- Challenge definitions
- Difficulty levels
- Time periods
- Completion criteria
- Participant counts

#### `user_challenge_progress`
- User's challenge participation
- Progress tracking
- Completion status
- Points earned

## Backend API Endpoints

### Points Management
```
GET  /api/gamification/user/:userId/points
GET  /api/gamification/user/:userId/points-history?limit=50
POST /api/gamification/user/:userId/award-points
```

### Badges
```
GET  /api/gamification/badges
GET  /api/gamification/user/:userId/badges
POST /api/gamification/user/:userId/badges/:badgeId
```

### Achievements
```
GET  /api/gamification/achievements
GET  /api/gamification/user/:userId/achievements
POST /api/gamification/user/:userId/achievements/:achievementId
```

### Leaderboards
```
GET  /api/gamification/leaderboards/:type
GET  /api/gamification/user/:userId/rank/:type
GET  /api/gamification/user/:userId/leaderboard-context/:type
GET  /api/gamification/leaderboards/levels/all
GET  /api/gamification/leaderboards/:type/stats
POST /api/gamification/leaderboards/regenerate
```

### Challenges
```
GET  /api/gamification/challenges/active
GET  /api/gamification/challenges/upcoming?limit=10
GET  /api/gamification/user/:userId/challenges
GET  /api/gamification/user/:userId/challenges/recommended
POST /api/gamification/user/:userId/challenges/:challengeId/join
POST /api/gamification/user/:userId/challenges/:challengeId/progress
GET  /api/gamification/challenges/:challengeId/leaderboard
GET  /api/gamification/challenges/:challengeId/stats
GET  /api/gamification/user/:userId/challenges/completed
```

### Streaks
```
GET  /api/gamification/user/:userId/streaks
POST /api/gamification/user/:userId/streaks/update
```

### Top Earners
```
GET  /api/gamification/top-earners/:period
```

## Frontend Components

### GamificationDashboard
Main component that provides tabbed interface for all gamification features.

**Props:**
- `userId`: User ID (defaults to localStorage)

**Tabs:**
- Overview: Points and quick stats
- Badges: Badge showcase and progress
- Achievements: Achievement tracking
- Challenges: Challenge tracker
- Leaderboard: Competitive rankings

### PointsDisplay
Shows user's current points, level, and recent point activity.

**Props:**
- `userId`: User ID
- `showHistory`: Show points activity history (default: false)

### BadgeShowcase
Displays all badges with earned/locked states and unlock progress.

**Props:**
- `userId`: User ID

**Features:**
- Category filtering
- Rarity level badges
- Progress indicators for locked badges
- Modal detail view

### AchievementProgress
Shows achievements with progress tracking and tier levels.

**Props:**
- `userId`: User ID

**Features:**
- Tier filtering
- Progress indicators
- Large modal view
- Unlock criteria display

### ChallengeTracker
Displays active, upcoming, and user's joined challenges.

**Props:**
- `userId`: User ID

**Features:**
- Challenge joining
- Progress tracking
- Challenge-specific leaderboards
- Recommended challenges

### LeaderboardView
Shows competitive rankings with context.

**Props:**
- `userId`: User ID

**Features:**
- Multiple leaderboard types (all_time, monthly, weekly)
- User ranking context
- Statistics view
- Medal animations

### GamificationContext
React context for managing gamification state across the app.

**Methods:**
- `awardPoints(points, activityType, description, metadata)`
- `joinChallenge(challengeId)`
- `updateChallengeProgress(challengeId, progressValue)`

## Installation & Setup

### 1. Database Setup

```bash
# Create gamification schema
sqlite3 healthcare.db < backend/database/gamification-schema.sql

# Seed badge and achievement data
node backend/scripts/seedGamification.js
```

### 2. Backend Integration

Add to `backend/server.js`:

```javascript
const gamificationRoutes = require('./routes/gamification');

// Register gamification routes
app.use('/api/gamification', gamificationRoutes);
```

### 3. Frontend Integration

Add to `frontend/src/App.js`:

```javascript
import { GamificationProvider } from './context/GamificationContext';
import GamificationDashboard from './components/GamificationDashboard';

function App() {
  return (
    <GamificationProvider>
      {/* Your app components */}
      <GamificationDashboard />
    </GamificationProvider>
  );
}
```

## Activity Types for Points

Common activity types that award points:

```
- appointment_attended: 100 points
- health_record_shared: 50 points
- survey_completed: 75 points
- profile_updated: 25 points
- review_posted: 50 points
- article_read: 10 points
- challenge_completed: varies by challenge
- milestone_reached: 200 points
- daily_activity: 25 points (daily bonus)
```

## Points Activity Integration

Integrate point awards in your application:

```javascript
import axios from 'axios';

// Award points for activity
async function awardPointsForActivity(userId, activity) {
  try {
    await axios.post(
      `/api/gamification/user/${userId}/award-points`,
      {
        points: activity.points,
        activityType: activity.type,
        description: activity.description,
        metadata: activity.data
      }
    );
  } catch (error) {
    console.error('Error awarding points:', error);
  }
}

// Example: Award points for appointment attendance
awardPointsForActivity(userId, {
  points: 100,
  type: 'appointment_attended',
  description: 'Attended appointment with Dr. Smith',
  data: { appointmentId: 123, providerId: 456 }
});
```

## Customization

### Add New Badges

```javascript
const BadgeService = require('./services/badgeService');

const badge = await badgeService.createBadge({
  name: 'Speed Runner',
  description: 'Complete health tasks in under 5 minutes',
  category: 'engagement',
  rarityLevel: 'epic',
  pointsReward: 150,
  unlockCriteria: {
    type: 'activity_count',
    activity: 'quick_task',
    count: 10
  }
});
```

### Add New Achievements

```javascript
const AchievementService = require('./services/achievementService');

const achievement = await achievementService.createAchievement({
  name: 'Time Master',
  description: 'Complete 50 health tasks quickly',
  category: 'achievement',
  tierLevel: 3,
  pointsReward: 750,
  unlockCriteria: {
    type: 'activity_count',
    activity: 'quick_task',
    count: 50
  }
});
```

### Create Challenges

```javascript
const ChallengeService = require('./services/challengeService');

const challenge = await challengeService.createChallenge({
  name: 'February Health Challenge',
  description: 'Track your health for 28 days',
  challengeType: 'monthly',
  startDate: '2024-02-01',
  endDate: '2024-02-29',
  pointsReward: 500,
  difficultyLevel: 'hard',
  completionCriteria: {
    type: 'activity_count',
    activity: 'health_tracking',
    target: 28
  }
});
```

## Maintenance

### Regenerate Leaderboards

Leaderboards are cached and should be regenerated periodically:

```bash
# Manually regenerate
curl -X POST http://localhost:3000/api/gamification/leaderboards/regenerate

# Schedule with cron (Unix)
0 2 * * * curl -X POST http://localhost:3000/api/gamification/leaderboards/regenerate
```

### Monitor Points Distribution

Track points metrics:

```javascript
// Get top earners for a period
GET /api/gamification/top-earners/monthly?limit=10

// Get leaderboard statistics
GET /api/gamification/leaderboards/all_time/stats
```

## Analytics & Reporting

Track engagement metrics:

- User points distribution
- Achievement unlock rates
- Challenge completion rates
- Leaderboard participation
- Badge rarity statistics
- Activity type breakdown

## Performance Optimization

- Leaderboards are cached and regenerated daily
- Activity logs are indexed by user_id and activity_type
- Badge/Achievement progress calculations are optimized
- Consider denormalization for frequently accessed metrics

## Security Considerations

1. **Points Validation**: Verify activity eligibility before awarding points
2. **Leaderboard Caching**: Prevent real-time manipulation
3. **Admin Endpoints**: Secure point awards and challenge creation
4. **Data Privacy**: Don't expose sensitive user data in leaderboards
5. **Rate Limiting**: Apply rate limits to prevent abuse

## Troubleshooting

### Points Not Updating

1. Check if gamification schema is initialized
2. Verify user exists in database
3. Check for database connection errors

### Badges Not Unlocking

1. Verify badge unlock criteria JSON format
2. Check if activities are being logged correctly
3. Ensure badge_id exists in badge_definitions table

### Leaderboard Empty

1. Run `/api/gamification/leaderboards/regenerate`
2. Verify users have points in database
3. Check leaderboard table for entries

## Future Enhancements

- [ ] Social features (comparing with friends)
- [ ] Reward redemption system
- [ ] Mobile notifications for achievements
- [ ] Custom tier names per organization
- [ ] Time-weighted point calculations
- [ ] Team/group challenges
- [ ] Seasonal leaderboards with rewards
