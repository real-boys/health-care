import React, { useState, useEffect } from 'react';
import { 
  Target, 
  TrendingUp, 
  Calendar, 
  Award, 
  Flame, 
  Star, 
  CheckCircle, 
  Clock, 
  BarChart3, 
  PieChart, 
  Activity, 
  Zap,
  Trophy,
  Users,
  Heart,
  BookOpen,
  MessageSquare
} from 'lucide-react';
import { gamificationManager } from '../../utils/gamificationManager';
import { formatPoints } from '../../utils/gamificationConfig';

const ProgressTracker = ({ 
  userId = 'current_user', 
  timeRange = 'week',
  showDetails = true 
}) => {
  const [userStats, setUserStats] = useState(null);
  const [progressData, setProgressData] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('points');
  const [weeklyGoals, setWeeklyGoals] = useState([]);
  const [achievements, setAchievements] = useState({});

  useEffect(() => {
    loadUserData();
    loadProgressData();
    loadWeeklyGoals();
    loadAchievements();
  }, [userId, timeRange]);

  const loadUserData = () => {
    const stats = gamificationManager.getUserStats(userId);
    setUserStats(stats);
  };

  const loadProgressData = () => {
    // Generate mock progress data based on time range
    const data = generateProgressData(timeRange);
    setProgressData(data);
  };

  const loadWeeklyGoals = () => {
    const goals = [
      {
        id: 'daily_login',
        name: 'Daily Login',
        description: 'Log in every day this week',
        current: 5,
        target: 7,
        icon: <Calendar className="w-5 h-5" />,
        color: 'blue',
        points: 10
      },
      {
        id: 'health_goals',
        name: 'Health Goals',
        description: 'Complete 3 health goals',
        current: 2,
        target: 3,
        icon: <Heart className="w-5 h-5" />,
        color: 'red',
        points: 100
      },
      {
        id: 'articles_read',
        name: 'Reading',
        description: 'Read 5 health articles',
        current: 4,
        target: 5,
        icon: <BookOpen className="w-5 h-5" />,
        color: 'green',
        points: 25
      },
      {
        id: 'feedback',
        name: 'Feedback',
        description: 'Submit 2 pieces of feedback',
        current: 1,
        target: 2,
        icon: <MessageSquare className="w-5 h-5" />,
        color: 'purple',
        points: 50
      }
    ];
    setWeeklyGoals(goals);
  };

  const loadAchievements = () => {
    const stats = gamificationManager.getUserStats(userId);
    const userAchievements = gamificationManager.getUserAchievements(userId);
    setAchievements(userAchievements);
  };

  const generateProgressData = (range) => {
    const now = new Date();
    const data = [];
    
    let days = 7;
    if (range === 'month') days = 30;
    if (range === 'year') days = 365;

    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      data.push({
        date: date.toISOString().split('T')[0],
        points: Math.floor(Math.random() * 100) + 10,
        activities: Math.floor(Math.random() * 10) + 1,
        level: Math.floor(Math.random() * 3) + 1,
        badges: Math.floor(Math.random() * 2),
        streak: i === 0 ? userStats?.streak?.current || 0 : Math.floor(Math.random() * 10)
      });
    }
    
    return data;
  };

  const getMetricIcon = (metric) => {
    const icons = {
      points: <Zap className="w-5 h-5" />,
      activities: <Activity className="w-5 h-5" />,
      level: <Star className="w-5 h-5" />,
      badges: <Award className="w-5 h-5" />,
      streak: <Flame className="w-5 h-5" />
    };
    return icons[metric] || <Target className="w-5 h-5" />;
  };

  const getMetricColor = (metric) => {
    const colors = {
      points: 'text-blue-600 bg-blue-100',
      activities: 'text-green-600 bg-green-100',
      level: 'text-purple-600 bg-purple-100',
      badges: 'text-yellow-600 bg-yellow-100',
      streak: 'text-orange-600 bg-orange-100'
    };
    return colors[metric] || 'text-gray-600 bg-gray-100';
  };

  const getMetricLabel = (metric) => {
    const labels = {
      points: 'Points Earned',
      activities: 'Activities Completed',
      level: 'Level Progress',
      badges: 'Badges Earned',
      streak: 'Login Streak'
    };
    return labels[metric] || 'Progress';
  };

  const calculateProgressPercentage = (current, target) => {
    return Math.min((current / target) * 100, 100);
  };

  const getProgressColor = (percentage) => {
    if (percentage >= 100) return 'bg-green-500';
    if (percentage >= 75) return 'bg-blue-500';
    if (percentage >= 50) return 'bg-yellow-500';
    if (percentage >= 25) return 'bg-orange-500';
    return 'bg-red-500';
  };

  const getWeeklyStats = () => {
    if (progressData.length === 0) return { total: 0, average: 0, trend: 0 };
    
    const weekData = progressData.slice(-7);
    const total = weekData.reduce((sum, day) => sum + day[selectedMetric], 0);
    const average = total / weekData.length;
    
    // Calculate trend (compared to previous week)
    const previousWeek = progressData.slice(-14, -7);
    const previousTotal = previousWeek.reduce((sum, day) => sum + day[selectedMetric], 0);
    const trend = previousTotal > 0 ? ((total - previousTotal) / previousTotal) * 100 : 0;
    
    return { total, average, trend };
  };

  const getAchievementProgress = (achievementId) => {
    const achievement = achievements[achievementId];
    if (!achievement) return null;

    const currentTier = achievement.tiers?.find(tier => tier.isCompleted) || achievement.tiers?.[0];
    if (!currentTier) return null;

    return {
      current: currentTier.tier,
      total: achievement.tiers.length,
      progress: (currentTier.tier / achievement.tiers.length) * 100,
      name: achievement.name,
      description: achievement.description
    };
  };

  const weeklyStats = getWeeklyStats();

  if (!userStats) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Weekly Overview */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Weekly Progress</h3>
          <div className="flex items-center space-x-2">
            <select
              value={selectedMetric}
              onChange={(e) => setSelectedMetric(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="points">Points</option>
              <option value="activities">Activities</option>
              <option value="level">Level</option>
              <option value="badges">Badges</option>
              <option value="streak">Streak</option>
            </select>
            
            <select
              value={timeRange}
              onChange={(e) => loadProgressData(e.target.value)}
              className="px-3 py-1 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="week">Week</option>
              <option value="month">Month</option>
              <option value="year">Year</option>
            </select>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Total {getMetricLabel(selectedMetric)}</span>
              {getMetricIcon(selectedMetric)}
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {selectedMetric === 'points' ? formatPoints(weeklyStats.total) : weeklyStats.total}
            </p>
            {weeklyStats.trend !== 0 && (
              <div className={`flex items-center space-x-1 text-sm ${
                weeklyStats.trend > 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                <TrendingUp className={`w-3 h-3 ${weeklyStats.trend < 0 ? 'rotate-180' : ''}`} />
                <span>{Math.abs(weeklyStats.trend).toFixed(1)}%</span>
              </div>
            )}
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Daily Average</span>
              <BarChart3 className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">
              {selectedMetric === 'points' ? formatPoints(Math.round(weeklyStats.average)) : Math.round(weeklyStats.average)}
            </p>
            <p className="text-xs text-gray-500">Per day</p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-600">Current Streak</span>
              <Flame className="w-4 h-4 text-gray-600" />
            </div>
            <p className="text-2xl font-bold text-gray-900">{userStats.streak.current}</p>
            <p className="text-xs text-gray-500">Days</p>
          </div>
        </div>

        {/* Progress Chart */}
        <div className="h-64">
          <div className="flex items-end justify-between h-full space-x-2">
            {progressData.slice(-7).map((day, index) => {
              const maxValue = Math.max(...progressData.slice(-7).map(d => d[selectedMetric]));
              const percentage = (day[selectedMetric] / maxValue) * 100;
              
              return (
                <div key={index} className="flex-1 flex flex-col items-center">
                  <div className="w-full flex-1 bg-gray-200 rounded-t relative">
                    <div 
                      className={`absolute bottom-0 w-full rounded-t transition-all duration-500 ${getMetricColor(selectedMetric)}`}
                      style={{ height: `${percentage}%` }}
                    />
                  </div>
                  <div className="mt-2 text-xs text-gray-600 text-center">
                    <div>{new Date(day.date).getDate()}</div>
                    <div className="font-medium">
                      {selectedMetric === 'points' ? formatPoints(day[selectedMetric]) : day[selectedMetric]}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Weekly Goals */}
      {showDetails && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Weekly Goals</h3>
          
          <div className="space-y-4">
            {weeklyGoals.map((goal) => {
              const percentage = calculateProgressPercentage(goal.current, goal.target);
              const isCompleted = percentage >= 100;
              
              return (
                <div key={goal.id} className="flex items-center space-x-4">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getMetricColor(goal.color)}`}>
                    {goal.icon}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                      <div>
                        <h4 className="font-medium text-gray-900">{goal.name}</h4>
                        <p className="text-sm text-gray-500">{goal.description}</p>
                      </div>
                      
                      <div className="text-right">
                        <div className="flex items-center space-x-1">
                          <span className="text-sm font-medium text-gray-900">
                            {goal.current}/{goal.target}
                          </span>
                          {isCompleted && <CheckCircle className="w-4 h-4 text-green-500" />}
                        </div>
                        <p className="text-xs text-gray-500">{goal.points} points</p>
                      </div>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${getProgressColor(percentage)}`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Achievement Progress */}
      {showDetails && Object.keys(achievements).length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Achievement Progress</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(achievements).slice(0, 4).map(([id, achievement]) => {
              const progress = getAchievementProgress(id);
              if (!progress) return null;
              
              return (
                <div key={id} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <h4 className="font-medium text-gray-900">{progress.name}</h4>
                      <p className="text-sm text-gray-500">{progress.description}</p>
                    </div>
                    <Trophy className="w-5 h-5 text-yellow-500" />
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Progress</span>
                      <span className="font-medium text-gray-900">
                        Tier {progress.current} of {progress.total}
                      </span>
                    </div>
                    
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
                        style={{ width: `${progress.progress}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Activity Breakdown */}
      {showDetails && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-6">Activity Breakdown</h3>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Calendar className="w-6 h-6 text-blue-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{userStats.activities.dailyLogins}</p>
              <p className="text-sm text-gray-600">Daily Logins</p>
            </div>
            
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <Heart className="w-6 h-6 text-green-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{userStats.activities.healthGoalsCompleted}</p>
              <p className="text-sm text-gray-600">Goals Completed</p>
            </div>
            
            <div className="text-center p-4 bg-purple-50 rounded-lg">
              <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <MessageSquare className="w-6 h-6 text-purple-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{userStats.activities.feedbackSubmitted}</p>
              <p className="text-sm text-gray-600">Feedback Given</p>
            </div>
            
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <BookOpen className="w-6 h-6 text-yellow-600" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{userStats.activities.articlesRead}</p>
              <p className="text-sm text-gray-600">Articles Read</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProgressTracker;
