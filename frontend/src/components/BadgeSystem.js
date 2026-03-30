import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Trophy, 
  Star, 
  Target, 
  Lock, 
  Unlock,
  Calendar,
  TrendingUp,
  Filter,
  Search,
  ChevronRight,
  Sparkles,
  Crown,
  Gem,
  Medal
} from 'lucide-react';

const BadgeSystem = ({ userId, profileType, currentUser }) => {
  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBadge, setSelectedBadge] = useState(null);
  const [showAchieved, setShowAchieved] = useState(true);
  const [showLocked, setShowLocked] = useState(true);

  useEffect(() => {
    fetchBadgeData();
  }, [userId, profileType]);

  const fetchBadgeData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch all available badges
      const badgesResponse = await fetch('/api/reputation/badges', {
        headers
      });
      
      if (badgesResponse.ok) {
        const badgesData = await badgesResponse.json();
        setBadges(badgesData.badges || []);
      }

      // Fetch user's earned badges
      const userBadgesResponse = await fetch(`/api/reputation/badges/${userId}`, {
        headers
      });
      
      if (userBadgesResponse.ok) {
        const userBadgesData = await userBadgesResponse.json();
        setUserBadges(userBadgesData || []);
      }

    } catch (error) {
      console.error('Error fetching badge data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getBadgeIcon = (badgeName) => {
    const iconMap = {
      'first_review': <Star className="w-8 h-8" />,
      'five_star_provider': <Trophy className="w-8 h-8" />,
      'helpful_contributor': <Award className="w-8 h-8" />,
      'quick_responder': <TrendingUp className="w-8 h-8" />,
      'trusted_reviewer': <Target className="w-8 h-8" />,
      'expert_contributor': <Crown className="w-8 h-8" />,
      'patient_champion': <Medal className="w-8 h-8" />,
      'quality_care_provider': <Gem className="w-8 h-8" />,
      'community_leader': <Sparkles className="w-8 h-8" />,
      'rising_star': <TrendingUp className="w-8 h-8" />
    };
    
    return iconMap[badgeName.toLowerCase().replace(/[^a-z0-9]/g, '_')] || <Award className="w-8 h-8" />;
  };

  const getBadgeLevelColor = (level) => {
    const colors = {
      bronze: 'border-orange-300 bg-orange-50 text-orange-800',
      silver: 'border-gray-300 bg-gray-50 text-gray-800',
      gold: 'border-yellow-300 bg-yellow-50 text-yellow-800',
      platinum: 'border-purple-300 bg-purple-50 text-purple-800',
      diamond: 'border-blue-300 bg-blue-50 text-blue-800'
    };
    return colors[level] || colors.bronze;
  };

  const getBadgeLevelIcon = (level) => {
    const icons = {
      bronze: '🥉',
      silver: '🥈',
      gold: '🥇',
      platinum: '💎',
      diamond: '👑'
    };
    return icons[level] || '🥉';
  };

  const getUserBadgeProgress = (badgeId) => {
    const userBadge = userBadges.find(ub => ub.badge_id === badgeId);
    return userBadge ? userBadge.progress_percentage : 0;
  };

  const isBadgeEarned = (badgeId) => {
    return userBadges.some(ub => ub.badge_id === badgeId && ub.progress_percentage >= 100);
  };

  const filteredBadges = badges.filter(badge => {
    const matchesSearch = !searchTerm || 
      badge.badge_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      badge.badge_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || badge.badge_category === selectedCategory;
    
    const earned = isBadgeEarned(badge.id);
    const matchesFilter = (showAchieved && earned) || (showLocked && !earned);
    
    return matchesSearch && matchesCategory && matchesFilter;
  });

  const categories = [
    { value: 'all', label: 'All Badges', icon: <Award className="w-4 h-4" /> },
    { value: 'achievement', label: 'Achievements', icon: <Trophy className="w-4 h-4" /> },
    { value: 'milestone', label: 'Milestones', icon: <Target className="w-4 h-4" /> },
    { value: 'quality', label: 'Quality', icon: <Star className="w-4 h-4" /> },
    { value: 'quantity', label: 'Quantity', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'special', label: 'Special', icon: <Sparkles className="w-4 h-4" /> }
  ];

  const stats = {
    totalEarned: userBadges.filter(ub => ub.progress_percentage >= 100).length,
    totalBadges: badges.length,
    inProgress: userBadges.filter(ub => ub.progress_percentage > 0 && ub.progress_percentage < 100).length,
    totalPoints: userBadges.reduce((sum, ub) => {
      const badge = badges.find(b => b.id === ub.badge_id);
      return sum + (badge ? badge.points_value : 0);
    }, 0)
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Award className="w-8 h-8 text-blue-600" />
              Badge System
            </h1>
            <p className="text-gray-600">Earn badges and track your achievements</p>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-center">
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-600">{stats.totalEarned}</div>
              <div className="text-sm text-gray-600">Earned</div>
            </div>
            <div className="bg-green-50 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-600">{stats.totalPoints}</div>
              <div className="text-sm text-gray-600">Points</div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Badges</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalBadges}</p>
            </div>
            <Award className="w-8 h-8 text-gray-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Earned</p>
              <p className="text-2xl font-bold text-green-600">{stats.totalEarned}</p>
            </div>
            <Trophy className="w-8 h-8 text-green-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600">{stats.inProgress}</p>
            </div>
            <Target className="w-8 h-8 text-yellow-400" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Completion</p>
              <p className="text-2xl font-bold text-blue-600">
                {stats.totalBadges > 0 ? Math.round((stats.totalEarned / stats.totalBadges) * 100) : 0}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400" />
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search badges..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          {/* Category Filter */}
          <div className="flex gap-2 flex-wrap">
            {categories.map(category => (
              <button
                key={category.value}
                onClick={() => setSelectedCategory(category.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                  selectedCategory === category.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {category.icon}
                {category.label}
              </button>
            ))}
          </div>
        </div>
        
        {/* Toggle Filters */}
        <div className="flex gap-4 mt-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showAchieved}
              onChange={(e) => setShowAchieved(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show Earned</span>
          </label>
          
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={showLocked}
              onChange={(e) => setShowLocked(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700">Show Locked</span>
          </label>
        </div>
      </div>

      {/* Badges Grid */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Badges ({filteredBadges.length})
        </h2>
        
        {filteredBadges.length === 0 ? (
          <div className="text-center py-12">
            <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No badges found matching your criteria</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredBadges.map(badge => {
              const isEarned = isBadgeEarned(badge.id);
              const progress = getUserBadgeProgress(badge.id);
              const userBadge = userBadges.find(ub => ub.badge_id === badge.id);
              
              return (
                <div
                  key={badge.id}
                  onClick={() => setSelectedBadge(badge)}
                  className={`border rounded-lg p-4 cursor-pointer transition-all hover:shadow-md ${
                    isEarned 
                      ? 'border-green-300 bg-green-50' 
                      : progress > 0 
                        ? 'border-yellow-300 bg-yellow-50'
                        : 'border-gray-300 bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className={`p-3 rounded-full ${
                      isEarned 
                        ? 'bg-green-100 text-green-600' 
                        : progress > 0 
                          ? 'bg-yellow-100 text-yellow-600'
                          : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isEarned ? getBadgeIcon(badge.badge_name) : <Lock className="w-8 h-8" />}
                    </div>
                    
                    <div className="flex items-center gap-1">
                      <span className="text-lg">{getBadgeLevelIcon(badge.badge_level)}</span>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full ${getBadgeLevelColor(badge.badge_level)}`}>
                        {badge.badge_level}
                      </span>
                    </div>
                  </div>
                  
                  <h3 className="font-semibold text-gray-900 mb-1">{badge.badge_name}</h3>
                  <p className="text-sm text-gray-600 mb-3">{badge.badge_description}</p>
                  
                  {/* Progress Bar */}
                  <div className="mb-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Progress</span>
                      <span className="text-xs font-medium text-gray-900">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          isEarned ? 'bg-green-600' : 'bg-yellow-600'
                        }`}
                        style={{ width: `${progress}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  {/* Badge Info */}
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{badge.points_value} points</span>
                    {userBadge && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {new Date(userBadge.earned_at).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  
                  {/* Unlock Criteria */}
                  {!isEarned && badge.unlock_criteria && (
                    <div className="mt-3 p-2 bg-white rounded text-xs text-gray-600">
                      <span className="font-medium">How to unlock:</span> {badge.unlock_criteria}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Badge Detail Modal */}
      {selectedBadge && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-2xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Badge Details</h2>
                <button
                  onClick={() => setSelectedBadge(null)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  ×
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <div className="text-center mb-6">
                <div className={`inline-flex p-6 rounded-full mb-4 ${
                  isBadgeEarned(selectedBadge.id)
                    ? 'bg-green-100 text-green-600'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {isBadgeEarned(selectedBadge.id) ? getBadgeIcon(selectedBadge.badge_name) : <Lock className="w-12 h-12" />}
                </div>
                
                <h3 className="text-2xl font-bold text-gray-900 mb-2">{selectedBadge.badge_name}</h3>
                <div className="flex items-center justify-center gap-2 mb-4">
                  <span className="text-lg">{getBadgeLevelIcon(selectedBadge.badge_level)}</span>
                  <span className={`px-3 py-1 font-medium rounded-full ${getBadgeLevelColor(selectedBadge.badge_level)}`}>
                    {selectedBadge.badge_level}
                  </span>
                  <span className="px-3 py-1 bg-blue-100 text-blue-800 font-medium rounded-full">
                    {selectedBadge.points_value} points
                  </span>
                </div>
                
                <p className="text-gray-600 mb-6">{selectedBadge.badge_description}</p>
                
                {/* Progress */}
                <div className="mb-6">
                  <div className="flex justify-between items-center mb-2">
                    <span className="font-medium text-gray-900">Progress</span>
                    <span className="font-bold text-lg text-gray-900">{getUserBadgeProgress(selectedBadge.id)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`h-3 rounded-full transition-all duration-300 ${
                        isBadgeEarned(selectedBadge.id) ? 'bg-green-600' : 'bg-yellow-600'
                      }`}
                      style={{ width: `${getUserBadgeProgress(selectedBadge.id)}%` }}
                    ></div>
                  </div>
                </div>
                
                {/* Unlock Criteria */}
                <div className="bg-gray-50 rounded-lg p-4 text-left">
                  <h4 className="font-medium text-gray-900 mb-2">How to Earn This Badge</h4>
                  <p className="text-sm text-gray-600">{selectedBadge.unlock_criteria || 'Complete the required activities to unlock this badge.'}</p>
                </div>
                
                {/* Achievement Date */}
                {isBadgeEarned(selectedBadge.id) && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg">
                    <div className="flex items-center justify-center gap-2 text-green-800">
                      <Trophy className="w-5 h-5" />
                      <span className="font-medium">
                        Earned on {new Date(userBadges.find(ub => ub.badge_id === selectedBadge.id)?.earned_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="flex justify-end">
                <button
                  onClick={() => setSelectedBadge(null)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgeSystem;
