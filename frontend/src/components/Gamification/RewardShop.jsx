import React, { useState, useEffect } from 'react';
import { 
  Gift, 
  ShoppingBag, 
  Star, 
  Zap, 
  Shield, 
  Palette, 
  Image, 
  Unlock, 
  Lock, 
  Check, 
  X, 
  Info, 
  TrendingUp, 
  Clock, 
  Award,
  Filter,
  Search
} from 'lucide-react';
import { gamificationManager } from '../../utils/gamificationManager';
import { REWARDS, formatPoints } from '../../utils/gamificationConfig';

const RewardShop = ({ 
  userId = 'current_user', 
  onPurchase, 
  compact = false 
}) => {
  const [userStats, setUserStats] = useState(null);
  const [availableRewards, setAvailableRewards] = useState([]);
  const [purchasedRewards, setPurchasedRewards] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [showDetails, setShowDetails] = useState(null);
  const [confirmingPurchase, setConfirmingPurchase] = useState(null);
  const [purchaseHistory, setPurchaseHistory] = useState([]);

  useEffect(() => {
    loadUserData();
  }, [userId]);

  const loadUserData = () => {
    const stats = gamificationManager.getUserStats(userId);
    const available = gamificationManager.getAvailableRewards(userId);
    const purchased = gamificationManager.getPurchasedRewards(userId);
    
    setUserStats(stats);
    setAvailableRewards(available);
    setPurchasedRewards(purchased);
    
    // Load purchase history (placeholder)
    setPurchaseHistory([
      {
        id: 'purchase_1',
        rewardId: 'avatar_frame',
        rewardName: 'Avatar Frame',
        cost: 300,
        purchasedAt: '2024-01-15T10:30:00Z',
        status: 'active'
      },
      {
        id: 'purchase_2',
        rewardId: 'bonus_points',
        rewardName: 'Points Booster',
        cost: 1000,
        purchasedAt: '2024-01-10T14:20:00Z',
        status: 'expired'
      }
    ]);
  };

  const getCategoryIcon = (category) => {
    const icons = {
      profile: <Image className="w-5 h-5" />,
      boost: <Zap className="w-5 h-5" />,
      protection: <Shield className="w-5 h-5" />,
      feature: <Unlock className="w-5 h-5" />
    };
    return icons[category] || <Gift className="w-5 h-5" />;
  };

  const getCategoryColor = (category) => {
    const colors = {
      profile: 'text-purple-600 bg-purple-100',
      boost: 'text-yellow-600 bg-yellow-100',
      protection: 'text-green-600 bg-green-100',
      feature: 'text-blue-600 bg-blue-100'
    };
    return colors[category] || 'text-gray-600 bg-gray-100';
  };

  const getTypeIcon = (type) => {
    const icons = {
      cosmetic: <Palette className="w-4 h-4" />,
      booster: <Zap className="w-4 h-4" />,
      protection: <Shield className="w-4 h-4" />,
      feature: <Unlock className="w-4 h-4" />
    };
    return icons[type] || <Gift className="w-4 h-4" />;
  };

  const handlePurchase = async (reward) => {
    try {
      const success = gamificationManager.purchaseReward(userId, reward.id);
      if (success) {
        loadUserData();
        onPurchase?.(reward);
        
        // Add to purchase history
        const newPurchase = {
          id: `purchase_${Date.now()}`,
          rewardId: reward.id,
          rewardName: reward.name,
          cost: reward.cost,
          purchasedAt: new Date().toISOString(),
          status: 'active'
        };
        setPurchaseHistory([newPurchase, ...purchaseHistory]);
        
        setConfirmingPurchase(null);
      }
    } catch (error) {
      console.error('Error purchasing reward:', error);
    }
  };

  const canAfford = (reward) => {
    return userStats && userStats.points >= reward.cost;
  };

  const isPurchased = (rewardId) => {
    return purchasedRewards.some(reward => reward.id === rewardId);
  };

  const getFilteredRewards = () => {
    let filtered = availableRewards;

    // Filter by category
    if (selectedCategory !== 'all') {
      filtered = filtered.filter(reward => reward.category === selectedCategory);
    }

    // Filter by search
    if (searchQuery) {
      filtered = filtered.filter(reward => 
        reward.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        reward.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    return filtered;
  };

  const displayRewards = getFilteredRewards();

  if (compact) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-blue-600" />
            <span className="font-semibold text-gray-900">Reward Shop</span>
          </div>
          <div className="flex items-center space-x-1 px-2 py-1 bg-blue-100 rounded-full">
            <Star className="w-3 h-3 text-blue-600" />
            <span className="text-sm font-medium text-blue-600">
              {formatPoints(userStats?.points || 0)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {displayRewards.slice(0, 4).map((reward) => (
            <div key={reward.id} className="p-3 border border-gray-200 rounded-lg hover:border-blue-300 transition-colors">
              <div className="flex items-center justify-between mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getCategoryColor(reward.category)}`}>
                  {getCategoryIcon(reward.category)}
                </div>
                <span className="text-sm font-bold text-gray-900">{formatPoints(reward.cost)}</span>
              </div>
              <h4 className="text-sm font-medium text-gray-900 truncate">{reward.name}</h4>
            </div>
          ))}
        </div>

        {displayRewards.length > 4 && (
          <button className="w-full mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium">
            View All Rewards
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center space-x-3">
            <ShoppingBag className="w-6 h-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Reward Shop</h3>
              <p className="text-sm text-gray-500">Spend your points on exclusive rewards</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2 px-3 py-2 bg-gradient-to-r from-blue-500 to-purple-600 rounded-full">
            <Star className="w-4 h-4 text-white" />
            <span className="font-bold text-white">{formatPoints(userStats?.points || 0)}</span>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              placeholder="Search rewards..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="profile">Profile</option>
            <option value="boost">Boosters</option>
            <option value="protection">Protection</option>
            <option value="feature">Features</option>
          </select>
        </div>
      </div>

      {/* Rewards Grid */}
      <div className="p-6">
        {displayRewards.length === 0 ? (
          <div className="text-center py-12">
            <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h4 className="text-lg font-medium text-gray-900 mb-2">No rewards available</h4>
            <p className="text-gray-500">
              {searchQuery || selectedCategory !== 'all' 
                ? 'Try adjusting your filters' 
                : 'Complete more activities to unlock rewards'
              }
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {displayRewards.map((reward) => {
              const affordable = canAfford(reward);
              const purchased = isPurchased(reward.id);

              return (
                <div
                  key={reward.id}
                  className={`border-2 rounded-lg p-6 transition-all ${
                    purchased 
                      ? 'border-green-400 bg-green-50' 
                      : affordable 
                        ? 'border-gray-200 hover:border-blue-300 hover:shadow-md cursor-pointer'
                        : 'border-gray-200 opacity-75'
                  }`}
                  onClick={() => !purchased && setShowDetails(reward)}
                >
                  {/* Reward Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getCategoryColor(reward.category)}`}>
                      {getCategoryIcon(reward.category)}
                    </div>
                    
                    <div className="text-right">
                      <div className="flex items-center space-x-1">
                        <Star className="w-4 h-4 text-yellow-500" />
                        <span className={`font-bold ${affordable ? 'text-gray-900' : 'text-gray-400'}`}>
                          {formatPoints(reward.cost)}
                        </span>
                      </div>
                      
                      {purchased && (
                        <div className="flex items-center space-x-1 text-green-600 mt-1">
                          <Check className="w-3 h-3" />
                          <span className="text-xs font-medium">Owned</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Reward Info */}
                  <div className="mb-4">
                    <h4 className="font-semibold text-gray-900 mb-2">{reward.name}</h4>
                    <p className="text-sm text-gray-600 mb-3">{reward.description}</p>
                    
                    <div className="flex items-center space-x-2 text-xs text-gray-500">
                      <div className="flex items-center space-x-1">
                        {getTypeIcon(reward.type)}
                        <span className="capitalize">{reward.type}</span>
                      </div>
                      <span>·</span>
                      <span className="capitalize">{reward.category}</span>
                    </div>
                  </div>

                  {/* Action Button */}
                  {!purchased && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (affordable) {
                          setConfirmingPurchase(reward);
                        }
                      }}
                      disabled={!affordable}
                      className={`w-full py-2 rounded-lg font-medium transition-colors ${
                        affordable
                          ? 'bg-blue-600 text-white hover:bg-blue-700'
                          : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      {affordable ? 'Purchase' : `Need ${formatPoints(reward.cost - (userStats?.points || 0))} more`}
                    </button>
                  )}

                  {purchased && (
                    <button
                      className="w-full py-2 bg-green-600 text-white rounded-lg font-medium cursor-default"
                      disabled
                    >
                      Already Owned
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Purchase History */}
      {purchaseHistory.length > 0 && (
        <div className="p-6 border-t border-gray-200">
          <h4 className="font-semibold text-gray-900 mb-4">Purchase History</h4>
          <div className="space-y-3">
            {purchaseHistory.slice(0, 5).map((purchase) => (
              <div key={purchase.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    purchase.status === 'active' ? 'bg-green-100' : 'bg-gray-200'
                  }`}>
                    {purchase.status === 'active' ? (
                      <Check className="w-4 h-4 text-green-600" />
                    ) : (
                      <Clock className="w-4 h-4 text-gray-400" />
                    )}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">{purchase.rewardName}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(purchase.purchasedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <p className="font-medium text-gray-900">-{formatPoints(purchase.cost)}</p>
                  <p className="text-xs text-gray-500 capitalize">{purchase.status}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Reward Details Modal */}
      {showDetails && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center space-x-3">
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center ${getCategoryColor(showDetails.category)}`}>
                    {getCategoryIcon(showDetails.category)}
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{showDetails.name}</h3>
                    <p className="text-sm text-gray-500">{showDetails.type} · {showDetails.category}</p>
                  </div>
                </div>
                
                <button
                  onClick={() => setShowDetails(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-gray-700">{showDetails.description}</p>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-900">Cost:</span>
                  <div className="flex items-center space-x-1">
                    <Star className="w-4 h-4 text-yellow-500" />
                    <span className="font-bold text-gray-900">{formatPoints(showDetails.cost)}</span>
                  </div>
                </div>

                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <Info className="w-4 h-4" />
                  <span>This reward will be permanently unlocked for your account.</span>
                </div>
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => setShowDetails(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setConfirmingPurchase(showDetails);
                    setShowDetails(null);
                  }}
                  disabled={!canAfford(showDetails)}
                  className={`flex-1 px-4 py-2 rounded-lg font-medium ${
                    canAfford(showDetails)
                      ? 'bg-blue-600 text-white hover:bg-blue-700'
                      : 'bg-gray-200 text-gray-400 cursor-not-allowed'
                  }`}
                >
                  Purchase
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Purchase Confirmation Modal */}
      {confirmingPurchase && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-sm w-full">
            <div className="p-6">
              <div className="flex items-center space-x-3 mb-4">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${getCategoryColor(confirmingPurchase.category)}`}>
                  {getCategoryIcon(confirmingPurchase.category)}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">Confirm Purchase</h3>
                  <p className="text-sm text-gray-500">{confirmingPurchase.name}</p>
                </div>
              </div>

              <div className="space-y-3 mb-6">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Cost:</span>
                  <span className="font-medium">{formatPoints(confirmingPurchase.cost)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Your balance:</span>
                  <span className="font-medium">{formatPoints(userStats?.points || 0)}</span>
                </div>
                <div className="flex justify-between text-sm font-medium pt-2 border-t">
                  <span className="text-gray-900">Remaining:</span>
                  <span className="text-blue-600">
                    {formatPoints((userStats?.points || 0) - confirmingPurchase.cost)}
                  </span>
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setConfirmingPurchase(null)}
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handlePurchase(confirmingPurchase)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
                >
                  Confirm
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default RewardShop;
