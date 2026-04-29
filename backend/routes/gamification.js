const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const GamificationService = require('../services/gamificationService');
const BadgeService = require('../services/badgeService');
const AchievementService = require('../services/achievementService');
const LeaderboardService = require('../services/leaderboardService');
const ChallengeService = require('../services/challengeService');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

let db;
let gamificationService;
let badgeService;
let achievementService;
let leaderboardService;
let challengeService;

// Initialize database and services
function initializeServices() {
  db = new sqlite3.Database(DB_PATH);
  gamificationService = new GamificationService(db);
  badgeService = new BadgeService(db);
  achievementService = new AchievementService(db);
  leaderboardService = new LeaderboardService(db);
  challengeService = new ChallengeService(db);
}

// Initialize on first request
router.use((req, res, next) => {
  if (!gamificationService) {
    initializeServices();
  }
  next();
});

// Get user's complete gamification profile
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const gamificationData = await gamificationService.getUserGamificationData(userId);
    res.json(gamificationData);
  } catch (error) {
    next(error);
  }
});

// Get user points
router.get('/user/:userId/points', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const points = await gamificationService.getUserPoints(userId);
    res.json(points);
  } catch (error) {
    next(error);
  }
});

// Get user points history
router.get('/user/:userId/points-history', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const history = await gamificationService.getUserPointsHistory(userId, limit);
    res.json(history);
  } catch (error) {
    next(error);
  }
});

// Award points to user (admin endpoint)
router.post('/user/:userId/award-points', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { points, activityType, description, metadata } = req.body;

    if (!points || !activityType) {
      return res.status(400).json({ error: 'Points and activityType required' });
    }

    const result = await gamificationService.awardPoints(userId, points, activityType, description, metadata);
    res.json({
      message: 'Points awarded successfully',
      data: result
    });
  } catch (error) {
    next(error);
  }
});

// Get all available badges
router.get('/badges', async (req, res, next) => {
  try {
    const badges = await badgeService.getAllBadges();
    res.json(badges);
  } catch (error) {
    next(error);
  }
});

// Get user badges with progress
router.get('/user/:userId/badges', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const progress = await badgeService.getUserBadgeProgress(userId);
    res.json(progress);
  } catch (error) {
    next(error);
  }
});

// Award badge to user (admin/system endpoint)
router.post('/user/:userId/badges/:badgeId', async (req, res, next) => {
  try {
    const { userId, badgeId } = req.params;
    const result = await badgeService.awardBadgeToUser(userId, badgeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get all achievements
router.get('/achievements', async (req, res, next) => {
  try {
    const achievements = await achievementService.getAllAchievements();
    res.json(achievements);
  } catch (error) {
    next(error);
  }
});

// Get user achievements with progress
router.get('/user/:userId/achievements', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const achievements = await achievementService.getUserAchievementsWithProgress(userId);
    res.json(achievements);
  } catch (error) {
    next(error);
  }
});

// Unlock achievement for user (admin/system endpoint)
router.post('/user/:userId/achievements/:achievementId', async (req, res, next) => {
  try {
    const { userId, achievementId } = req.params;
    const result = await achievementService.unlockAchievementForUser(userId, achievementId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get leaderboard
router.get('/leaderboards/:type', async (req, res, next) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await leaderboardService.getLeaderboard(type, limit);
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

// Get user's rank on leaderboard
router.get('/user/:userId/rank/:type', async (req, res, next) => {
  try {
    const { userId, type } = req.params;
    const rank = await leaderboardService.getUserRank(userId, type);
    res.json(rank);
  } catch (error) {
    next(error);
  }
});

// Get leaderboard context (user with neighbors)
router.get('/user/:userId/leaderboard-context/:type', async (req, res, next) => {
  try {
    const { userId, type } = req.params;
    const contextSize = parseInt(req.query.contextSize) || 2;
    const context = await leaderboardService.getLeaderboardContext(userId, type, contextSize);
    res.json(context);
  } catch (error) {
    next(error);
  }
});

// Get level-based leaderboards
router.get('/leaderboards/levels/all', async (req, res, next) => {
  try {
    const leaderboards = await leaderboardService.getLevelBasedLeaderboards();
    res.json(leaderboards);
  } catch (error) {
    next(error);
  }
});

// Get leaderboard statistics
router.get('/leaderboards/:type/stats', async (req, res, next) => {
  try {
    const { type } = req.params;
    const stats = await leaderboardService.getLeaderboardStats(type);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get active challenges
router.get('/challenges/active', async (req, res, next) => {
  try {
    const challenges = await challengeService.getActiveChallenges();
    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// Get upcoming challenges
router.get('/challenges/upcoming', async (req, res, next) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const challenges = await challengeService.getUpcomingChallenges(limit);
    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// Get user's challenges
router.get('/user/:userId/challenges', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const challenges = await challengeService.getUserChallengeProgress(userId);
    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// Get recommended challenges for user
router.get('/user/:userId/challenges/recommended', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 5;
    const challenges = await challengeService.getRecommendedChallenges(userId, limit);
    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// Join challenge
router.post('/user/:userId/challenges/:challengeId/join', async (req, res, next) => {
  try {
    const { userId, challengeId } = req.params;
    const result = await challengeService.joinChallenge(userId, challengeId);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Update challenge progress
router.post('/user/:userId/challenges/:challengeId/progress', async (req, res, next) => {
  try {
    const { userId, challengeId } = req.params;
    const { progressValue } = req.body;

    if (progressValue === undefined) {
      return res.status(400).json({ error: 'progressValue required' });
    }

    const result = await challengeService.updateChallengeProgress(userId, challengeId, progressValue);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Get challenge leaderboard
router.get('/challenges/:challengeId/leaderboard', async (req, res, next) => {
  try {
    const { challengeId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const leaderboard = await challengeService.getChallengeLearderboard(challengeId, limit);
    res.json(leaderboard);
  } catch (error) {
    next(error);
  }
});

// Get challenge statistics
router.get('/challenges/:challengeId/stats', async (req, res, next) => {
  try {
    const { challengeId } = req.params;
    const stats = await challengeService.getChallengeStats(challengeId);
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// Get user's completed challenges
router.get('/user/:userId/challenges/completed', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const challenges = await challengeService.getUserCompletedChallenges(userId);
    res.json(challenges);
  } catch (error) {
    next(error);
  }
});

// Regenerate leaderboards (admin endpoint)
router.post('/leaderboards/regenerate', async (req, res, next) => {
  try {
    const types = ['all_time', 'monthly', 'weekly'];
    const results = [];

    for (const type of types) {
      const result = await leaderboardService.generateLeaderboard(type);
      results.push({ type, status: 'regenerated', count: result.length });
    }

    res.json({ message: 'Leaderboards regenerated', results });
  } catch (error) {
    next(error);
  }
});

// Get top earners
router.get('/top-earners/:period', async (req, res, next) => {
  try {
    const { period } = req.params;
    const limit = parseInt(req.query.limit) || 10;
    const topEarners = await gamificationService.getTopEarners(period, limit);
    res.json(topEarners);
  } catch (error) {
    next(error);
  }
});

// Get user streaks
router.get('/user/:userId/streaks', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const streaks = await gamificationService.getUserStreaks(userId);
    res.json(streaks);
  } catch (error) {
    next(error);
  }
});

// Update user streak
router.post('/user/:userId/streaks/update', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { streakType } = req.body;
    const result = await gamificationService.updateStreak(userId, streakType || 'daily_activity');
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// Error handling middleware
router.use((err, req, res, next) => {
  console.error('Gamification route error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal Server Error',
    status: err.status || 500
  });
});

module.exports = router;
