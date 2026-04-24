import React, { useState, useEffect } from 'react';
import { 
  Award, 
  Star, 
  Trophy, 
  Medal, 
  Crown, 
  Gem, 
  Shield, 
  Heart, 
  BookOpen, 
  Users, 
  Flame, 
  Sun, 
  Moon, 
  Calendar, 
  MessageSquare, 
  UserPlus, 
  Lock, 
  Unlock,
  Filter,
  Grid,
  List
} from 'lucide-react';
import { gamificationManager } from '../../utils/gamificationManager';
import { BADGES, getBadgesByCategory, getBadgesByRarity, getRarityColor } from '../../utils/gamificationConfig';

const BadgesDisplay = ({ 
  userId = 'current_user', 
  showLocked = false, 
  compact = false,
  maxDisplay = null 
}) => {
  const [userBadges, setUserBadges] = useState([]);
  const [allBadges, setAllBadges] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedRarity, setSelectedRarity] = useState('all');
  const [viewMode, setViewMode] = useState('grid');
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const loadBadges = () => {
      const badges = gamificationManager.getUserBadges(userId);
      setUserBadges(badges);
      setAllBadges(Object.values(BADGES));
    };

    loadBadges();

    const handleBadgeAwarded = (data) => {
      if (data.userId === userId) {
        loadBadges();
      }
    };

    gamificationManager.addListener('badgeAwarded', handleBadgeAwarded);

    return () => {
      gamificationManager.removeListener('badgeAwarded', handleBadgeAwarded);
    };
  }, [userId]);

  const getBadgeIcon = (iconName) => {
    const icons = {
      'user-plus': <UserPlus className="w-6 h-6" />,
      'heart': <Heart className="w-6 h-6" />,
      'message-square': <MessageSquare className="w-6 h-6" />,
      'calendar': <Calendar className="w-6 h-6" />,
      'book-open': <BookOpen className="w-6 h-6" />,
      'users': <Users className="w-6 h-6" />,
      'flame': <Flame className="w-6 h-6" />,
      'sun': <Sun className="w-6 h-6" />,
      'moon': <Moon className="w-6 h-6" />,
      'star': <Star className="w-6 h-6" />,
      'trophy': <Trophy className="w-6 h-6" />,
      'medal': <Medal className="w-6 h-6" />,
      'crown': <Crown className="w-6 h-6" />,
      'gem': <Gem className="w-6 h-6" />,
      'shield': <Shield className="w-6 h-6" />,
      'award': <Award className="w-6 h-6" />
    };
    return icons[iconName] || <Award className="w-6 h-6" />;
  };

  const getFilteredBadges = () => {
    let filtered = allBadges;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = getBadgesByCategory(selectedCategory);
    }

    // Filter by rarity
    if (selectedRarity !== 'all') {
      filtered = getBadgesByRarity(selectedRarity);
    }

    // Show only earned badges if not showing locked
    if (!showLocked) {
      filtered = filtered.filter(badge => 
        userBadges.some(userBadge => userBadge.id === badge.id)
      );
    }

    return filtered;
  };

  const isBadgeEarned = (badgeId) => {
    return userBadges.some(badge => badge.id === badgeId);
  };

  const getBadgeProgress = (badge) => {
    if (isBadgeEarned(badge.id)) {
      return 100;
    }

    // This would calculate actual progress based on user stats
    // For now, return placeholder progress
    return Math.floor(Math.random() * 80);
  };

  const displayBadges = maxDisplay ? getFilteredBadges().slice(0, maxDisplay) : getFilteredBadges();

  if (compact) {
    return (
      <div className="flex items-center space-x-2">
        <div className="flex -space-x-2">
          {userBadges.slice(0, 5).map((badge) => (
            <div
              key={badge.id}
              className="w-8 h-8 rounded-full border-2 border-white shadow-sm flex items-center justify-center"
              style={{ backgroundColor: badge.color }}
              title={badge.name}
            >
              <span className="text-white text-xs">
                {getBadgeIcon(badge.icon)}
              </span>
            </div>
          ))}
        </div>
        {userBadges.length > 5 && (
          <span className="text-sm text-gray-500 font-medium">+{userBadges.length - 5}</span>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Award className="w-5 h-5 mr-2" />
            Badges Collection
          </h3>
          <p className="text-sm text-gray-500">
            {userBadges.length} of {allBadges.length} badges earned
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('grid')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'grid' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                viewMode === 'list' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
          </div>

          <button
            onClick={() => setShowDetails(!showDetails)}
            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg"
          >
            <Filter className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showDetails && (
        <div className="mb-6 p-4 bg-gray-50 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Category Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Categories</option>
                <option value="onboarding">Onboarding</option>
                <option value="health">Health</option>
                <option value="engagement">Engagement</option>
                <option value="healthcare">Healthcare</option>
                <option value="education">Education</option>
                <option value="social">Social</option>
                <option value="referral">Referral</option>
                <option value="milestone">Milestone</option>
              </select>
            </div>

            {/* Rarity Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Rarity</label>
              <select
                value={selectedRarity}
                onChange={(e) => setSelectedRarity(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">All Rarities</option>
                <option value="common">Common</option>
                <option value="uncommon">Uncommon</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
              </select>
            </div>

            {/* Show Locked Toggle */}
            <div className="flex items-end">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={showLocked}
                  onChange={(e) => setShowLocked(e.target.checked)}
                  className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Show Locked Badges</span>
              </label>
            </div>
          </div>
        </div>
      )}

      {/* Badges Grid/List */}
      {displayBadges.length === 0 ? (
        <div className="text-center py-12">
          <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-900 mb-2">No badges found</h4>
          <p className="text-gray-500">
            {showLocked ? 'Try adjusting your filters' : 'Complete activities to earn badges'}
          </p>
        </div>
      ) : (
        <div className={viewMode === 'grid' ? 'grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4' : 'space-y-4'}>
          {displayBadges.map((badge) => {
            const earned = isBadgeEarned(badge.id);
            const progress = getBadgeProgress(badge);

            return (
              <div
                key={badge.id}
                className={`relative p-4 rounded-lg border-2 transition-all ${
                  earned 
                    ? 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-orange-50' 
                    : 'border-gray-200 bg-gray-50 opacity-75'
                } hover:shadow-md cursor-pointer`}
              >
                {/* Badge Icon */}
                <div className="flex flex-col items-center mb-3">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center ${
                      earned ? '' : 'grayscale'
                    }`}
                    style={{ backgroundColor: earned ? badge.color : '#9ca3af' }}
                  >
                    <span className={earned ? 'text-white' : 'text-gray-600'}>
                      {getBadgeIcon(badge.icon)}
                    </span>
                  </div>
                  
                  {/* Rarity Indicator */}
                  <div className="mt-2">
                    <span
                      className="px-2 py-1 rounded-full text-xs font-medium"
                      style={{ 
                        backgroundColor: `${getRarityColor(badge.rarity)}20`,
                        color: getRarityColor(badge.rarity)
                      }}
                    >
                      {badge.rarity}
                    </span>
                  </div>
                </div>

                {/* Badge Info */}
                <div className="text-center">
                  <h4 className="font-semibold text-gray-900 mb-1">{badge.name}</h4>
                  <p className="text-xs text-gray-600 mb-2">{badge.description}</p>
                  
                  {/* Points Value */}
                  <div className="flex items-center justify-center space-x-1 text-sm">
                    <Star className="w-3 h-3 text-yellow-500" />
                    <span className="font-medium">{badge.points} points</span>
                  </div>
                </div>

                {/* Progress Bar */}
                {!earned && showLocked && (
                  <div className="mt-3">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Progress</span>
                      <span className="text-xs font-medium text-gray-900">{progress}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="h-full bg-blue-500 rounded-full transition-all"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Lock/Unlock Indicator */}
                <div className="absolute top-2 right-2">
                  {earned ? (
                    <Unlock className="w-4 h-4 text-green-500" />
                  ) : (
                    <Lock className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Earned Date */}
                {earned && (
                  <div className="absolute bottom-2 right-2">
                    <span className="text-xs text-gray-500">Earned</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Statistics */}
      {showDetails && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Badge Statistics</h4>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-blue-600">{userBadges.length}</p>
              <p className="text-xs text-gray-600">Total Badges</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-green-600">
                {userBadges.filter(b => b.rarity === 'common').length}
              </p>
              <p className="text-xs text-gray-600">Common</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-purple-600">
                {userBadges.filter(b => ['rare', 'epic'].includes(b.rarity)).length}
              </p>
              <p className="text-xs text-gray-600">Rare & Epic</p>
            </div>
            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <p className="text-lg font-bold text-orange-600">
                {userBadges.filter(b => b.rarity === 'legendary').length}
              </p>
              <p className="text-xs text-gray-600">Legendary</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default BadgesDisplay;
