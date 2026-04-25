import React, { useState, useEffect } from 'react';
import { 
  Trophy, 
  Medal, 
  Award, 
  Star, 
  Users, 
  TrendingUp, 
  Crown, 
  Flame, 
  Target, 
  Zap,
  ChevronUp,
  ChevronDown,
  Search,
  Filter,
  RefreshCw,
  Globe,
  Friends
} from 'lucide-react';
import { gamificationManager } from '../../utils/gamificationManager';
import { LEADERBOARD_TYPES, formatPoints } from '../../utils/gamificationConfig';

const Leaderboard = ({ 
  userId = 'current_user', 
  type = 'points', 
  limit = 50,
  showGlobal = true,
  showFriends = false,
  compact = false 
}) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [friendsLeaderboard, setFriendsLeaderboard] = useState([]);
  const [userPosition, setUserPosition] = useState(null);
  const [selectedType, setSelectedType] = useState(type);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeRange, setTimeRange] = useState('all');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(showGlobal ? 'global' : 'friends');

  useEffect(() => {
    loadLeaderboard();
  }, [selectedType, timeRange, limit]);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const data = gamificationManager.getLeaderboard(selectedType, limit);
      setLeaderboard(data);
      
      const position = gamificationManager.getUserLeaderboardPosition(userId, selectedType);
      setUserPosition(position);

      // Load friends leaderboard if available
      if (showFriends) {
        const friendsData = gamificationManager.getLeaderboard(selectedType, limit);
        // This would filter by friends in a real implementation
        setFriendsLeaderboard(friendsData.slice(0, 10));
      }
    } catch (error) {
      console.error('Error loading leaderboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type) => {
    const icons = {
      points: <Trophy className="w-5 h-5" />,
      level: <Star className="w-5 h-5" />,
      streak: <Flame className="w-5 h-5" />,
      badges: <Award className="w-5 h-5" />,
      engagement: <Users className="w-5 h-5" />
    };
    return icons[type] || <Trophy className="w-5 h-5" />;
  };

  const getTypeColor = (type) => {
    const colors = {
      points: 'text-yellow-500',
      level: 'text-purple-500',
      streak: 'text-orange-500',
      badges: 'text-green-500',
      engagement: 'text-blue-500'
    };
    return colors[type] || 'text-gray-500';
  };

  const getRankIcon = (rank) => {
    if (rank === 1) return <Crown className="w-6 h-6 text-yellow-500" />;
    if (rank === 2) return <Medal className="w-6 h-6 text-gray-400" />;
    if (rank === 3) return <Medal className="w-6 h-6 text-orange-600" />;
    return <span className="w-6 h-6 flex items-center justify-center text-sm font-bold text-gray-600">#{rank}</span>;
  };

  const getRankColor = (rank) => {
    if (rank === 1) return 'border-yellow-400 bg-yellow-50';
    if (rank === 2) return 'border-gray-400 bg-gray-50';
    if (rank === 3) return 'border-orange-400 bg-orange-50';
    return 'border-gray-200 bg-white';
  };

  const getScoreDisplay = (user, type) => {
    switch (type) {
      case 'points':
        return formatPoints(user.points);
      case 'level':
        return `Level ${user.level}`;
      case 'streak':
        return `${user.streak.current} days`;
      case 'badges':
        return `${user.badges.length} badges`;
      case 'engagement':
        const score = Object.values(user.activities).reduce((sum, val) => sum + val, 0);
        return `${score} activities`;
      default:
        return user.score || 0;
    }
  };

  const getScoreLabel = (type) => {
    const labels = {
      points: 'Points',
      level: 'Level',
      streak: 'Streak',
      badges: 'Badges',
      engagement: 'Activities'
    };
    return labels[type] || 'Score';
  };

  const filteredLeaderboard = leaderboard.filter(user => 
    user.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const currentLeaderboard = activeTab === 'global' ? filteredLeaderboard : friendsLeaderboard;

  if (compact) {
    const topUsers = leaderboard.slice(0, 3);
    const userEntry = leaderboard.find(u => u.id === userId);

    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            {getTypeIcon(selectedType)}
            <span className="font-semibold text-gray-900">Top {getScoreLabel(selectedType)}</span>
          </div>
          <button
            onClick={loadLeaderboard}
            className="p-1 text-gray-600 hover:text-gray-900"
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="space-y-2">
          {topUsers.map((user, index) => (
            <div key={user.id} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 flex items-center justify-center">
                  {getRankIcon(index + 1)}
                </div>
                <div className="w-8 h-8 bg-gray-300 rounded-full"></div>
                <span className="text-sm font-medium text-gray-900">{user.name || 'Anonymous'}</span>
              </div>
              <span className={`text-sm font-bold ${getTypeColor(selectedType)}`}>
                {getScoreDisplay(user, selectedType)}
              </span>
            </div>
          ))}

          {userEntry && userEntry.rank > 3 && (
            <div className="pt-2 mt-2 border-t border-gray-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <span className="text-sm font-medium text-blue-600">You</span>
                  <span className="text-sm text-gray-500">#{userEntry.rank}</span>
                </div>
                <span className={`text-sm font-bold text-blue-600`}>
                  {getScoreDisplay(userEntry, selectedType)}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            {getTypeIcon(selectedType)}
            <span className="ml-2">{LEADERBOARD_TYPES[selectedType]?.name || 'Leaderboard'}</span>
          </h3>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={loadLeaderboard}
              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
              disabled={loading}
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Type Selector */}
        <div className="flex space-x-2 mb-4">
          {Object.values(LEADERBOARD_TYPES).map((type) => (
            <button
              key={type.id}
              onClick={() => setSelectedType(type.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                selectedType === type.id
                  ? 'bg-blue-100 text-blue-700 border border-blue-200'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              <div className="flex items-center space-x-2">
                {getTypeIcon(type.id)}
                <span>{type.name}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Tabs */}
        {(showGlobal && showFriends) && (
          <div className="flex space-x-4 border-b border-gray-200">
            <button
              onClick={() => setActiveTab('global')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'global'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <span>Global</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('friends')}
              className={`pb-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === 'friends'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Friends className="w-4 h-4" />
                <span>Friends</span>
              </div>
            </button>
          </div>
        )}

        {/* Search and Filters */}
        <div className="flex space-x-4 mt-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Time</option>
            <option value="month">This Month</option>
            <option value="week">This Week</option>
            <option value="today">Today</option>
          </select>
        </div>
      </div>

      {/* User Position */}
      {userPosition && userPosition > 10 && (
        <div className="px-6 py-4 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
                <span className="text-white font-bold text-sm">Y</span>
              </div>
              <div>
                <p className="font-medium text-gray-900">Your Position</p>
                <p className="text-sm text-gray-600">Rank #{userPosition}</p>
              </div>
            </div>
            <div className="text-right">
              <p className={`text-lg font-bold ${getTypeColor(selectedType)}`}>
                {getScoreDisplay(gamificationManager.getUserStats(userId), selectedType)}
              </p>
              <p className="text-xs text-gray-500">{getScoreLabel(selectedType)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Leaderboard List */}
      <div className="p-6">
        {loading ? (
          <div className="flex justify-center py-12">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : currentLeaderboard.length === 0 ? (
          <div className="text-center py-12">
            <Trophy className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No data available</h4>
            <p className="text-gray-500">
              {activeTab === 'friends' ? 'Connect with friends to see their rankings' : 'Check back later for updates'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentLeaderboard.map((user, index) => {
              const isCurrentUser = user.id === userId;
              const rankChange = index - (user.previousRank || index); // Would come from actual data

              return (
                <div
                  key={user.id}
                  className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all ${
                    isCurrentUser ? 'border-blue-400 bg-blue-50' : getRankColor(user.rank)
                  } hover:shadow-md`}
                >
                  <div className="flex items-center space-x-4">
                    {/* Rank */}
                    <div className="flex items-center justify-center w-8">
                      {getRankIcon(user.rank)}
                    </div>

                    {/* User Info */}
                    <div className="flex items-center space-x-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                        isCurrentUser ? 'bg-blue-500' : 'bg-gray-300'
                      }`}>
                        <span className="text-white font-medium">
                          {user.name?.charAt(0)?.toUpperCase() || 'A'}
                        </span>
                      </div>
                      <div>
                        <p className={`font-medium ${isCurrentUser ? 'text-blue-900' : 'text-gray-900'}`}>
                          {user.name || 'Anonymous'}
                          {isCurrentUser && <span className="ml-2 text-xs text-blue-600">(You)</span>}
                        </p>
                        <div className="flex items-center space-x-2 text-xs text-gray-500">
                          <span>Level {user.level}</span>
                          <span>·</span>
                          <span>{user.badges?.length || 0} badges</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Score and Rank Change */}
                  <div className="flex items-center space-x-4">
                    {/* Rank Change */}
                    {rankChange !== 0 && (
                      <div className={`flex items-center space-x-1 text-xs font-medium ${
                        rankChange > 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {rankChange > 0 ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                        <span>{Math.abs(rankChange)}</span>
                      </div>
                    )}

                    {/* Score */}
                    <div className="text-right">
                      <p className={`text-lg font-bold ${getTypeColor(selectedType)}`}>
                        {getScoreDisplay(user, selectedType)}
                      </p>
                      <p className="text-xs text-gray-500">{getScoreLabel(selectedType)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Load More */}
      {!loading && currentLeaderboard.length >= limit && (
        <div className="p-6 border-t border-gray-200">
          <button
            onClick={() => {
              // Load more logic
            }}
            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            Load More
          </button>
        </div>
      )}
    </div>
  );
};

export default Leaderboard;
