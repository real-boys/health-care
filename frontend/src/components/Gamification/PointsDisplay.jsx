import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Zap, 
  Award, 
  Star, 
  Plus, 
  Minus,
  Trophy,
  Flame,
  Target,
  Gift
} from 'lucide-react';
import { gamificationManager } from '../../utils/gamificationManager';
import { formatPoints, calculateLevel, getNextLevel } from '../../utils/gamificationConfig';

const PointsDisplay = ({ 
  userId = 'current_user', 
  showDetails = false, 
  compact = false,
  animate = true 
}) => {
  const [userStats, setUserStats] = useState(null);
  const [levelInfo, setLevelInfo] = useState(null);
  const [recentActivity, setRecentActivity] = useState([]);
  const [showAnimation, setShowAnimation] = useState(false);

  useEffect(() => {
    const loadUserData = () => {
      const stats = gamificationManager.getUserStats(userId);
      const level = gamificationManager.getUserLevelInfo(userId);
      
      setUserStats(stats);
      setLevelInfo(level);
      setRecentActivity(getRecentActivity(stats));
    };

    loadUserData();

    // Listen for gamification events
    const handlePointsAwarded = (data) => {
      if (data.userId === userId) {
        setShowAnimation(true);
        setTimeout(() => setShowAnimation(false), 2000);
        loadUserData();
      }
    };

    const handleLevelUp = (data) => {
      if (data.userId === userId) {
        loadUserData();
      }
    };

    gamificationManager.addListener('pointsAwarded', handlePointsAwarded);
    gamificationManager.addListener('levelUp', handleLevelUp);

    return () => {
      gamificationManager.removeListener('pointsAwarded', handlePointsAwarded);
      gamificationManager.removeListener('levelUp', handleLevelUp);
    };
  }, [userId]);

  const getRecentActivity = (stats) => {
    // This would come from actual activity logs
    // For now, return placeholder data
    return [
      { activity: 'daily_login', points: 10, time: '2 hours ago' },
      { activity: 'article_read', points: 5, time: '4 hours ago' },
      { activity: 'feedback_submission', points: 25, time: '1 day ago' }
    ];
  };

  const getActivityIcon = (activity) => {
    const icons = {
      daily_login: <Flame className="w-4 h-4" />,
      appointment_completed: <Target className="w-4 h-4" />,
      feedback_submission: <Award className="w-4 h-4" />,
      article_read: <Star className="w-4 h-4" />,
      health_goal_achieved: <Trophy className="w-4 h-4" />,
      referral_signup: <Gift className="w-4 h-4" />
    };
    return icons[activity] || <Plus className="w-4 h-4" />;
  };

  const getActivityLabel = (activity) => {
    const labels = {
      daily_login: 'Daily Login',
      appointment_completed: 'Appointment Completed',
      feedback_submission: 'Feedback Submitted',
      article_read: 'Article Read',
      health_goal_achieved: 'Health Goal Achieved',
      referral_signup: 'Referral Signup'
    };
    return labels[activity] || activity;
  };

  if (!userStats || !levelInfo) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded-lg w-32"></div>
      </div>
    );
  }

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <div className={`flex items-center space-x-1 px-3 py-1 rounded-full ${
          showAnimation && animate ? 'animate-pulse' : ''
        } bg-gradient-to-r from-blue-500 to-purple-600 text-white`}>
          <Zap className="w-4 h-4" />
          <span className="font-semibold">{formatPoints(userStats.points)}</span>
        </div>
        <div className="flex items-center space-x-1 px-2 py-1 rounded-full bg-gray-100 text-gray-700">
          <Star className="w-3 h-3" />
          <span className="text-sm font-medium">Lv {userStats.level}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Points Display */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <div className={`relative ${
            showAnimation && animate ? 'animate-bounce' : ''
          }`}>
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
              <Zap className="w-6 h-6 text-white" />
            </div>
            {showAnimation && animate && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center animate-ping">
                <Plus className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          
          <div>
            <h3 className="text-2xl font-bold text-gray-900">
              {formatPoints(userStats.points)}
            </h3>
            <p className="text-sm text-gray-500">Total Points</p>
          </div>
        </div>

        <div className="text-right">
          <div className="flex items-center space-x-2 mb-1">
            <Star className="w-4 h-4 text-yellow-500" />
            <span className="font-semibold text-gray-900">Level {userStats.level}</span>
          </div>
          <p className="text-sm text-gray-500">{levelInfo.current.name}</p>
        </div>
      </div>

      {/* Level Progress */}
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-700">Progress to Level {levelInfo.next?.level || 'MAX'}</span>
          <span className="text-sm text-gray-500">
            {levelInfo.next ? `${levelInfo.pointsToNext} points to go` : 'Max Level'}
          </span>
        </div>
        
        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${levelInfo.progress}%` }}
          >
            <div className="h-full bg-white bg-opacity-20 animate-pulse"></div>
          </div>
        </div>
        
        <div className="flex justify-between mt-1">
          <span className="text-xs text-gray-500">
            {formatPoints(levelInfo.pointsForCurrent)} / {levelInfo.next ? formatPoints(levelInfo.next.points - levelInfo.current.points) : 'MAX'}
          </span>
          <span className="text-xs text-gray-500">{Math.round(levelInfo.progress)}%</span>
        </div>
      </div>

      {/* Streak Information */}
      <div className="mb-6">
        <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center space-x-3">
            <Flame className="w-5 h-5 text-orange-500" />
            <div>
              <p className="font-medium text-gray-900">
                {userStats.streak.current} Day Streak
              </p>
              <p className="text-sm text-gray-600">
                Longest: {userStats.streak.longest} days
              </p>
            </div>
          </div>
          
          <div className="text-right">
            <p className="text-sm font-medium text-orange-600">
              {userStats.streak.current >= 7 ? '1.5x Bonus' : 'Keep it up!'}
            </p>
            <p className="text-xs text-gray-500">
              Next bonus in {7 - (userStats.streak.current % 7)} days
            </p>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      {showDetails && (
        <div>
          <h4 className="font-semibold text-gray-900 mb-3 flex items-center">
            <TrendingUp className="w-4 h-4 mr-2" />
            Recent Activity
          </h4>
          
          <div className="space-y-2">
            {recentActivity.map((activity, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    {getActivityIcon(activity.activity)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {getActivityLabel(activity.activity)}
                    </p>
                    <p className="text-xs text-gray-500">{activity.time}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-1 text-green-600">
                  <Plus className="w-3 h-3" />
                  <span className="text-sm font-medium">{activity.points}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Statistics */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-3">Statistics</h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">
                {userStats.statistics.totalPointsEarned}
              </p>
              <p className="text-xs text-gray-600">Total Earned</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">
                {userStats.statistics.totalPointsSpent}
              </p>
              <p className="text-xs text-gray-600">Points Spent</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-purple-600">
                {userStats.badges.length}
              </p>
              <p className="text-xs text-gray-600">Badges Earned</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-orange-600">
                {Object.values(userStats.achievements).filter(a => a).length}
              </p>
              <p className="text-xs text-gray-600">Achievements</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PointsDisplay;
