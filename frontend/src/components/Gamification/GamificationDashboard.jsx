import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Star, 
  Target, 
  Flame, 
  Award, 
  ShoppingBag, 
  BarChart3, 
  Users, 
  TrendingUp, 
  Settings, 
  Bell, 
  Crown, 
  Zap, 
  Heart, 
  Calendar, 
  BookOpen, 
  MessageSquare, 
  UserPlus 
} from 'lucide-react';
import { gamificationManager } from '../../utils/gamificationManager';
import PointsDisplay from './PointsDisplay';
import BadgesDisplay from './BadgesDisplay';
import Leaderboard from './Leaderboard';
import RewardShop from './RewardShop';
import ProgressTracker from './ProgressTracker';

const GamificationDashboard = ({ 
  userId = 'current_user', 
  onRewardPurchase, 
  onBadgeEarned,
  onLevelUp,
  onAchievementUnlocked 
}) => {
  const [activeTab, setActiveTab] = useState('overview');
  const [userStats, setUserStats] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <Trophy className="w-4 h-4" /> },
    { id: 'points', label: 'Points', icon: <Star className="w-4 h-4" /> },
    { id: 'badges', label: 'Badges', icon: <Award className="w-4 h-4" /> },
    { id: 'leaderboard', label: 'Leaderboard', icon: <Crown className="w-4 h-4" /> },
    { id: 'rewards', label: 'Rewards', icon: <ShoppingBag className="w-4 h-4" /> },
    { id: 'progress', label: 'Progress', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'analytics', label: 'Analytics', icon: <TrendingUp className="w-4 h-4" /> }
  ];

  useEffect(() => {
    loadUserData();
    loadAnalytics();
    setupEventListeners();
  }, [userId]);

  const loadUserData = () => {
    const stats = gamificationManager.getUserStats(userId);
    setUserStats(stats);
  };

  const loadAnalytics = () => {
    const analyticsData = gamificationManager.getAnalytics();
    setAnalytics(analyticsData);
  };

  const setupEventListeners = () => {
    const handlePointsAwarded = (data) => {
      if (data.userId === userId) {
        loadUserData();
        addNotification({
          type: 'points',
          title: 'Points Earned!',
          message: `You earned ${data.points} points for ${data.activity}`,
          icon: <Zap className="w-5 h-5 text-yellow-500" />
        });
      }
    };

    const handleBadgeAwarded = (data) => {
      if (data.userId === userId) {
        loadUserData();
        addNotification({
          type: 'badge',
          title: 'New Badge!',
          message: `You earned the ${data.badge.name} badge`,
          icon: <Award className="w-5 h-5 text-purple-500" />
        });
        onBadgeEarned?.(data);
      }
    };

    const handleLevelUp = (data) => {
      if (data.userId === userId) {
        loadUserData();
        addNotification({
          type: 'level',
          title: 'Level Up!',
          message: `You reached level ${data.newLevel}!`,
          icon: <Star className="w-5 h-5 text-blue-500" />
        });
        onLevelUp?.(data);
      }
    };

    const handleAchievementUnlocked = (data) => {
      if (data.userId === userId) {
        loadUserData();
        addNotification({
          type: 'achievement',
          title: 'Achievement Unlocked!',
          message: `You unlocked ${data.achievement.name} tier ${data.tier}`,
          icon: <Trophy className="w-5 h-5 text-green-500" />
        });
        onAchievementUnlocked?.(data);
      }
    };

    gamificationManager.addListener('pointsAwarded', handlePointsAwarded);
    gamificationManager.addListener('badgeAwarded', handleBadgeAwarded);
    gamificationManager.addListener('levelUp', handleLevelUp);
    gamificationManager.addListener('achievementUnlocked', handleAchievementUnlocked);

    return () => {
      gamificationManager.removeListener('pointsAwarded', handlePointsAwarded);
      gamificationManager.removeListener('badgeAwarded', handleBadgeAwarded);
      gamificationManager.removeListener('levelUp', handleLevelUp);
      gamificationManager.removeListener('achievementUnlocked', handleAchievementUnlocked);
    };
  };

  const addNotification = (notification) => {
    const newNotification = {
      id: Date.now(),
      ...notification,
      timestamp: new Date().toISOString(),
      read: false
    };
    
    setNotifications(prev => [newNotification, ...prev].slice(0, 10));
  };

  const markNotificationAsRead = (id) => {
    setNotifications(prev => 
      prev.map(n => n.id === id ? { ...n, read: true } : n)
    );
  };

  const clearNotifications = () => {
    setNotifications([]);
  };

  const simulateActivity = (activity) => {
    gamificationManager.awardPoints(userId, activity);
  };

  const getQuickStats = () => {
    if (!userStats) return null;

    return {
      points: userStats.points,
      level: userStats.level,
      badges: userStats.badges.length,
      streak: userStats.streak.current,
      rank: gamificationManager.getUserLeaderboardPosition(userId, 'points')
    };
  };

  const quickStats = getQuickStats();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Gamification Center</h1>
              <p className="text-gray-500">Track your progress and earn rewards</p>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Quick Stats */}
              {quickStats && (
                <div className="hidden md:flex items-center space-x-6">
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="font-medium text-gray-900">{quickStats.points}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-purple-500" />
                    <span className="font-medium text-gray-900">Level {quickStats.level}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Award className="w-4 h-4 text-blue-500" />
                    <span className="font-medium text-gray-900">{quickStats.badges}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Flame className="w-4 h-4 text-orange-500" />
                    <span className="font-medium text-gray-900">{quickStats.streak}</span>
                  </div>
                </div>
              )}

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
                >
                  <Bell className="w-5 h-5" />
                  {notifications.filter(n => !n.read).length > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full"></span>
                  )}
                </button>

                {showNotifications && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                    <div className="p-4 border-b border-gray-200">
                      <div className="flex justify-between items-center">
                        <h3 className="font-semibold text-gray-900">Notifications</h3>
                        <button
                          onClick={clearNotifications}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          Clear All
                        </button>
                      </div>
                    </div>
                    
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">
                          No notifications
                        </div>
                      ) : (
                        notifications.map(notification => (
                          <div
                            key={notification.id}
                            className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                              !notification.read ? 'bg-blue-50' : ''
                            }`}
                            onClick={() => markNotificationAsRead(notification.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="flex-shrink-0">
                                {notification.icon}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-gray-900 text-sm">
                                  {notification.title}
                                </p>
                                <p className="text-gray-600 text-sm">
                                  {notification.message}
                                </p>
                                <p className="text-xs text-gray-500 mt-1">
                                  {new Date(notification.timestamp).toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Settings */}
              <button className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg">
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Tab Navigation */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex space-x-8 px-6 pt-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center space-x-2 pb-4 border-b-2 transition-colors whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {activeTab === 'overview' && (
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Points Overview */}
                <div className="lg:col-span-2">
                  <PointsDisplay userId={userId} showDetails={true} />
                </div>

                {/* Quick Actions */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
                  
                  <div className="space-y-3">
                    <button
                      onClick={() => simulateActivity('daily_login')}
                      className="w-full flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100"
                    >
                      <div className="flex items-center space-x-3">
                        <Calendar className="w-5 h-5 text-blue-600" />
                        <span className="font-medium text-gray-900">Daily Login</span>
                      </div>
                      <span className="text-sm text-blue-600">+10 pts</span>
                    </button>

                    <button
                      onClick={() => simulateActivity('article_read')}
                      className="w-full flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100"
                    >
                      <div className="flex items-center space-x-3">
                        <BookOpen className="w-5 h-5 text-green-600" />
                        <span className="font-medium text-gray-900">Read Article</span>
                      </div>
                      <span className="text-sm text-green-600">+5 pts</span>
                    </button>

                    <button
                      onClick={() => simulateActivity('feedback_submission')}
                      className="w-full flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100"
                    >
                      <div className="flex items-center space-x-3">
                        <MessageSquare className="w-5 h-5 text-purple-600" />
                        <span className="font-medium text-gray-900">Give Feedback</span>
                      </div>
                      <span className="text-sm text-purple-600">+25 pts</span>
                    </button>

                    <button
                      onClick={() => simulateActivity('health_goal_achieved')}
                      className="w-full flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100"
                    >
                      <div className="flex items-center space-x-3">
                        <Heart className="w-5 h-5 text-red-600" />
                        <span className="font-medium text-gray-900">Complete Goal</span>
                      </div>
                      <span className="text-sm text-red-600">+100 pts</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Recent Badges */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Badges</h3>
                <BadgesDisplay userId={userId} compact={false} maxDisplay={6} />
              </div>

              {/* Leaderboard Preview */}
              <div className="mt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Leaderboard</h3>
                <Leaderboard userId={userId} compact={true} />
              </div>
            </div>
          )}

          {activeTab === 'points' && (
            <div className="p-6">
              <PointsDisplay userId={userId} showDetails={true} />
            </div>
          )}

          {activeTab === 'badges' && (
            <div className="p-6">
              <BadgesDisplay userId={userId} showLocked={true} />
            </div>
          )}

          {activeTab === 'leaderboard' && (
            <div className="p-6">
              <Leaderboard userId={userId} />
            </div>
          )}

          {activeTab === 'rewards' && (
            <div className="p-6">
              <RewardShop userId={userId} onPurchase={onRewardPurchase} />
            </div>
          )}

          {activeTab === 'progress' && (
            <div className="p-6">
              <ProgressTracker userId={userId} />
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <div className="space-y-6">
                {/* Analytics Overview */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Analytics Overview</h3>
                  {analytics && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Total Users</span>
                          <Users className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{analytics.totalUsers}</p>
                        <p className="text-sm text-gray-500">Active participants</p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Points Awarded</span>
                          <Star className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">
                          {analytics.totalPointsAwarded.toLocaleString()}
                        </p>
                        <p className="text-sm text-gray-500">Total points earned</p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Engagement Rate</span>
                          <TrendingUp className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{analytics.engagementRate}%</p>
                        <p className="text-sm text-gray-500">7-day active users</p>
                      </div>

                      <div className="bg-gray-50 rounded-lg p-6">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm font-medium text-gray-600">Avg. Level</span>
                          <Trophy className="w-5 h-5 text-gray-400" />
                        </div>
                        <p className="text-3xl font-bold text-gray-900">{analytics.averageLevel}</p>
                        <p className="text-sm text-gray-500">User average</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Activity Heatmap */}
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Heatmap</h3>
                  <div className="bg-gray-50 rounded-lg p-6">
                    <div className="grid grid-cols-7 gap-1">
                      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                        <div key={day} className="text-center">
                          <div className="text-xs font-medium text-gray-600 mb-2">{day}</div>
                          <div className="space-y-1">
                            {Array.from({ length: 4 }).map((_, weekIndex) => (
                              <div
                                key={weekIndex}
                                className="h-4 rounded"
                                style={{
                                  backgroundColor: Math.random() > 0.7 
                                    ? '#10b981' 
                                    : Math.random() > 0.4 
                                      ? '#3b82f6' 
                                      : '#e5e7eb'
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default GamificationDashboard;
