# Gamification System Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend                              │
├─────────────────────────────────────────────────────────────┤
│                 GamificationDashboard                         │
│  ┌──────────────┬──────────────┬──────────────┐             │
│  │   Points     │    Badges    │ Achievements │             │
│  │   Display    │   Showcase   │   Progress   │             │
│  ├──────────────┼──────────────┼──────────────┤             │
│  │  Challenge   │ Leaderboard  │  GamiFied   │             │
│  │   Tracker    │    View      │   Context   │             │
│  └──────────────┴──────────────┴──────────────┘             │
└─────────────────────────────────────────────────────────────┘
                              ↓
                    GamificationContext
                    (State Management)
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   API Layer (REST)                           │
│              /api/gamification endpoints                     │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│                   Backend Services                           │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │        GamificationService                          │   │
│  │  - Award points                                     │   │
│  │  - Manage levels                                    │   │
│  │  - Track streaks                                    │   │
│  │  - Get user profile                                │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌──────────────┬──────────────┬──────────────┐            │
│  │    Badge     │  Achievement │ Leaderboard  │            │
│  │   Service    │   Service    │   Service    │            │
│  └──────────────┴──────────────┴──────────────┘            │
│                                                              │
│  ┌──────────────┐              ┌──────────────┐            │
│  │   Challenge  │              │    Reward    │            │
│  │   Service    │              │   Service    │            │
│  └──────────────┘              └──────────────┘            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│              SQLite Database                                │
├─────────────────────────────────────────────────────────────┤
│  user_points │ badge_definitions │ achievement_definitions  │
│  points_activity_log │ user_badges │ user_achievements     │
│  leaderboard_entries │ challenges  │ user_challenge_progress│
│  user_tiers │ user_streaks                                 │
└─────────────────────────────────────────────────────────────┘
```

## Data Flow

### 1. Points Award Flow
```
User Activity
    ↓
Activity Handler (appointments.js, health.js, etc.)
    ↓
gamificationService.awardPoints()
    ↓
┌─────────────────────────────┐
├─ Update points_activity_log
├─ Update user_points totals
├─ Update monthly/weekly totals
└─ Check level up
    ↓
checkLevelUp()    ├─→ Update level if qualified
    ↓
Check Badge/Achievement Criteria
    ↓
Unlock Available Badges/Achievements
    ↓
Send Notifications to User
    ↓
Update Frontend UI
```

### 2. Badge Unlock Flow
```
User Activity Tracked
    ↓
badgeService.checkBadgeUnlock()
    ↓
Evaluate Unlock Criteria (JSON)
    ↓
Criteria Met? 
├─ YES → awardBadgeToUser()
│         ├─ Insert into user_badges
│         ├─ Get badge details
│         └─ Return result
└─ NO  → Return progress info
```

### 3. Leaderboard Generation
```
Scheduled Job (Daily @ 2 AM)
    ↓
leaderboardService.generateLeaderboard()
    ↓
┌─────────────────────────┐
├─ Fetch all users
├─ Sort by points
├─ Assign rankings
├─ Clear old entries
└─ Insert new rankings
    ↓
Cache Rankings (in leaderboard_entries)
    ↓
API serves from cache
    ↓
User sees instant leaderboard
```

## Component Hierarchy

```
App
├── GamificationProvider (Context)
│   └── GamificationDashboard
│       ├── Tabs Navigation
│       │
│       ├── Overview Tab
│       │   ├── PointsDisplay
│       │   └── QuickStats
│       │
│       ├── Badges Tab
│       │   ├── BadgeShowcase
│       │   ├── Category Filter
│       │   └── Badge Detail Modal
│       │
│       ├── Achievements Tab
│       │   ├── AchievementProgress
│       │   ├── Tier Filter
│       │   └── Achievement Detail Modal
│       │
│       ├── Challenges Tab
│       │   ├── ChallengeTracker
│       │   ├── Your Challenges
│       │   ├── Available Challenges
│       │   └── Challenge Detail Modal
│       │
│       └── Leaderboard Tab
│           ├── LeaderboardView
│           ├── Type Selector
│           ├── Statistics
│           ├── User Rank
│           └── Leaderboard List
```

## Service Architecture

```
GamificationService
├── awardPoints(userId, points, activityType, description, metadata)
├── getUserPoints(userId)
├── checkLevelUp(userId, userPoints)
├── updateStreak(userId, streakType)
├── getUserPointsHistory(userId, limit)
├── resetPeriodPoints()
├── getTopEarners(period, limit)
└── getUserGamificationData(userId)
    ├── userPoints
    ├── badges []
    ├── achievements []
    ├── tier
    └── streaks []

BadgeService
├── createBadge(badgeData)
├── awardBadgeToUser(userId, badgeId)
├── getAllBadges()
├── checkBadgeUnlock(userId, badgeId)
├── evaluateCriteria(userId, criteria)
└── getUserBadgeProgress(userId)

AchievementService
├── createAchievement(achievementData)
├── unlockAchievementForUser(userId, achievementId)
├── getAllAchievements()
├── checkAchievementUnlock(userId, achievementId)
└── getUserAchievementsWithProgress(userId)

LeaderboardService
├── getLeaderboard(type, limit)
├── generateLeaderboard(type)
├── getUserRank(userId, type)
├── getLeaderboardContext(userId, type, contextSize)
├── getLevelBasedLeaderboards()
└── getLeaderboardStats(type)

ChallengeService
├── createChallenge(challengeData)
├── getActiveChallenges()
├── getUpcomingChallenges(limit)
├── joinChallenge(userId, challengeId)
├── updateChallengeProgress(userId, challengeId, progressValue)
├── getChallengeLearderboard(challengeId, limit)
├── getChallengeStats(challengeId)
└── getRecommendedChallenges(userId, limit)
```

## Database Schema (Simplified)

```
user_points
├── user_id (FK)
├── total_points
├── points_this_month
├── points_this_week
├── level
├── points_to_next_level
└── streak_days

badge_definitions
├── id (PK)
├── name
├── description
├── rarity_level (common, uncommon, rare, epic, legendary)
├── unlock_criteria (JSON)
└── points_reward

user_badges
├── user_id (FK)
├── badge_id (FK)
├── earned_at
└── progress_value

leaderboard_entries
├── user_id (FK)
├── rank
├── points
├── leaderboard_type (all_time, monthly, weekly)
├── leaderboard_period
└── calculated_at

challenges
├── id (PK)
├── name
├── challenge_type (daily, weekly, seasonal)
├── difficulty_level (easy, medium, hard)
├── start_date
├── end_date
├── points_reward
├── completion_criteria (JSON)
└── participant_count

user_challenge_progress
├── user_id (FK)
├── challenge_id (FK)
├── progress_value
├── progress_percentage
├── is_completed
└── completed_at
```

## API Endpoint Structure

```
/api/gamification
│
├── /user/:userId
│   ├── GET ...................... Get complete profile
│   ├── /points
│   │   ├── GET .................. Get current points
│   │   ├── /history ............. Get activity history
│   │   └── /award-points (POST) . Award points
│   ├── /badges
│   │   ├── GET .................. Get user badges
│   │   └── /:badgeId (POST) ..... Award badge
│   ├── /achievements
│   │   ├── GET .................. Get achievements
│   │   └── /:achievementId (POST) Unlock achievement
│   ├── /challenges
│   │   ├── GET .................. Get user challenges
│   │   ├── /recommended ......... Get recommended
│   │   ├── /completed ........... Get completed
│   │   ├── /:id/join (POST) ..... Join challenge
│   │   └── /:id/progress (POST) . Update progress
│   ├── /streaks
│   │   ├── GET .................. Get streaks
│   │   └── /update (POST) ....... Update streak
│   └── /rank/:type (GET) ........ Get leaderboard rank
│
├── /badges
│   └── GET ....................... Get all badges
│
├── /achievements
│   └── GET ....................... Get all achievements
│
├── /leaderboards
│   ├── /:type (GET) .............. Get leaderboard
│   ├── /:type/stats (GET) ........ Get statistics
│   ├── /levels/all (GET) ......... Get level-based
│   └── /regenerate (POST) ........ Regenerate cache
│
├── /challenges
│   ├── /active (GET) ............. Get active challenges
│   └── /upcoming (GET) ........... Get upcoming
│
├── /challenges/:id
│   ├── /leaderboard (GET) ........ Challenge rankings
│   └── /stats (GET) .............. Challenge stats
│
├── /leaderboards/context (GET) ... User with neighbors
│
└── /top-earners/:period (GET) .... Top earners
```

## Unlock Criteria Format (JSON)

```javascript
// Points Threshold
{
  type: 'points_threshold',
  value: 1000
}

// Activity Count
{
  type: 'activity_count',
  activity: 'appointment_attended',
  count: 10
}

// Level Reached
{
  type: 'level_reached',
  level: 5
}

// Badge Collection
{
  type: 'badge_collection',
  count: 5
}

// Health Tracking Days
{
  type: 'health_tracking_days',
  days: 100
}

// Tier Reached
{
  type: 'tier_reached',
  tier: 'gold'
}
```

## State Management

```
GamificationContext
├── gamificationData
│   ├── points: { level, total_points, ... }
│   ├── badges: [{ name, earned, ... }]
│   ├── achievements: [{ name, unlocked, ... }]
│   ├── tier: { current_tier, progression, ... }
│   ├── streaks: [{ type, current, longest, ... }]
│   ├── leaderboardRank: { rank, points }
│   ├── challenges: [{ name, progress, ... }]
│   ├── loading: boolean
│   └── error: string
│
├── Methods
│   ├── fetchGamificationData()
│   ├── awardPoints()
│   ├── joinChallenge()
│   └── updateChallengeProgress()
│
└── Hooks
    └── useGamification()
```

## Performance Optimization

```
Leaderboards
├── Cached in leaderboard_entries table
├── Regenerated daily at 2 AM
└── No real-time updates (prevents cheating)

Indexes
├── user_points (user_id, level)
├── points_activity_log (user_id, activity_type)
├── user_badges (user_id, earned_at)
├── leaderboard_entries (type, period, rank)
└── user_challenge_progress (user_id, challenge_id)

Queries
├── Most user profile fetches: single query with joins
├── Leaderboard: simple SELECT from cache
├── Points awards: batch inserts
└── Unlock checks: pre-calculated JSON evaluation
```

## Integration Points

```
Appointment System
├── Input: appointment completion
├── Process: awardPoints(100, 'appointment_attended')
├── Database: update user_points, log activity
└── Output: points updated, streak incremented

Health Tracking
├── Input: daily health metric entry
├── Process: awardPoints(25, 'health_tracking')
├── Database: update user_points
└── Output: daily streak tracked

Survey System
├── Input: survey submission
├── Process: awardPoints(75, 'survey_completed')
├── Database: log activity
└── Output: achievement check triggered

Profile System
├── Input: profile update
├── Process: awardPoints(25, 'profile_updated')
├── Database: log profile changes
└── Output: profile completion tracked

Review System
├── Input: new review posted
├── Process: awardPoints(50, 'review_posted')
├── Database: log review creation
└── Output: community engagement tracked
```

---

This architecture provides:
- ✅ Modular, maintainable code
- ✅ Clear separation of concerns
- ✅ Scalable database design
- ✅ Responsive UI components
- ✅ Flexible unlock criteria
- ✅ Performance-optimized queries
- ✅ Easy integration with existing systems
