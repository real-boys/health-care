import React, { useState, useEffect } from 'react';
import { 
  TrendingUp, 
  Award, 
  Star, 
  Users, 
  Calendar, 
  Target,
  Activity,
  ChevronUp,
  ChevronDown,
  BarChart3,
  PieChart
} from 'lucide-react';
import StarRating from './StarRating';
import ReviewCard from './ReviewCard';

const ReputationDashboard = ({ userId, profileType, currentUser }) => {
  const [profileData, setProfileData] = useState(null);
  const [recentReviews, setRecentReviews] = useState([]);
  const [badges, setBadges] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchReputationData();
  }, [userId, profileType]);

  const fetchReputationData = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch profile data
      const profileResponse = await fetch(`/api/reputation/profile/${userId}?profileType=${profileType}`, {
        headers
      });
      if (!profileResponse.ok) throw new Error('Failed to fetch profile');
      const profile = await profileResponse.json();
      setProfileData(profile);

      // Fetch recent reviews
      const reviewsResponse = await fetch(`/api/reputation/reviews/${userId}?revieweeType=${profileType}&limit=5`, {
        headers
      });
      if (!reviewsResponse.ok) throw new Error('Failed to fetch reviews');
      const reviewsData = await reviewsResponse.json();
      setRecentReviews(reviewsData.reviews);

      // Fetch badges
      const badgesResponse = await fetch(`/api/reputation/badges/${userId}`, {
        headers
      });
      if (!badgesResponse.ok) throw new Error('Failed to fetch badges');
      const badgesData = await badgesResponse.json();
      setBadges(badgesData);

      // Fetch metrics
      const metricsResponse = await fetch(`/api/reputation/metrics/${userId}?period=daily`, {
        headers
      });
      if (!metricsResponse.ok) throw new Error('Failed to fetch metrics');
      const metricsData = await metricsResponse.json();
      setMetrics(metricsData);

      // Fetch history
      const historyResponse = await fetch(`/api/reputation/history/${userId}?limit=10`, {
        headers
      });
      if (!historyResponse.ok) throw new Error('Failed to fetch history');
      const historyData = await historyResponse.json();
      setHistory(historyData);

    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getLevelColor = (level) => {
    const colors = {
      new: 'bg-gray-100 text-gray-800',
      bronze: 'bg-orange-100 text-orange-800',
      silver: 'bg-gray-100 text-gray-800',
      gold: 'bg-yellow-100 text-yellow-800',
      platinum: 'bg-purple-100 text-purple-800',
      diamond: 'bg-blue-100 text-blue-800'
    };
    return colors[level] || colors.new;
  };

  const getProgressPercentage = (score) => {
    return Math.min((score / 5) * 100, 100);
  };

  const getScoreChange = (current, previous) => {
    if (!previous) return null;
    const change = current - previous;
    return {
      value: change.toFixed(2),
      isPositive: change >= 0,
      percentage: previous > 0 ? ((change / previous) * 100).toFixed(1) : 0
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">Error loading reputation data: {error}</p>
      </div>
    );
  }

  if (!profileData) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <p className="text-gray-600">No reputation data available</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {profileData.first_name} {profileData.last_name}
            </h1>
            <p className="text-gray-600 mb-4">{profileType.charAt(0).toUpperCase() + profileType.slice(1)} Reputation Dashboard</p>
            
            {/* Reputation Level */}
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${getLevelColor(profileData.reputation_level)}`}>
                {profileData.level_icon} {profileData.reputation_level.charAt(0).toUpperCase() + profileData.reputation_level.slice(1)}
              </span>
              <span className="text-gray-500">
                Level {profileData.reputation_level === 'new' ? 1 : 
                      profileData.reputation_level === 'bronze' ? 2 :
                      profileData.reputation_level === 'silver' ? 3 :
                      profileData.reputation_level === 'gold' ? 4 :
                      profileData.reputation_level === 'platinum' ? 5 : 6}
              </span>
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-4xl font-bold text-gray-900 mb-1">
              {profileData.overall_score.toFixed(1)}
            </div>
            <div className="flex items-center gap-2 text-gray-600">
              <StarRating value={profileData.overall_score} readonly showValue={false} size="sm" />
              <span className="text-sm">Overall Score</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="flex border-b">
          {['overview', 'reviews', 'badges', 'analytics', 'history'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-600 border-b-2 border-blue-600'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Score Overview Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <ScoreCard
                  title="Overall Score"
                  value={profileData.overall_score}
                  icon={<Star className="w-5 h-5" />}
                  color="blue"
                />
                <ScoreCard
                  title="Trust Score"
                  value={profileData.trust_score}
                  icon={<Users className="w-5 h-5" />}
                  color="green"
                />
                <ScoreCard
                  title="Reliability"
                  value={profileData.reliability_score}
                  icon={<Target className="w-5 h-5" />}
                  color="purple"
                />
                <ScoreCard
                  title="Quality"
                  value={profileData.quality_score}
                  icon={<Award className="w-5 h-5" />}
                  color="yellow"
                />
              </div>

              {/* Progress to Next Level */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Progress to Next Level</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm text-gray-600">Current Level Progress</span>
                      <span className="text-sm font-medium text-gray-900">
                        {getProgressPercentage(profileData.overall_score).toFixed(0)}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-3">
                      <div
                        className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                        style={{ width: `${getProgressPercentage(profileData.overall_score)}%` }}
                      ></div>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{profileData.total_ratings}</div>
                      <div className="text-sm text-gray-600">Total Ratings</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{profileData.total_reviews}</div>
                      <div className="text-sm text-gray-600">Reviews</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{profileData.positive_reviews}</div>
                      <div className="text-sm text-gray-600">Positive</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-gray-900">{badges.length}</div>
                      <div className="text-sm text-gray-600">Badges</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Recent Reviews Preview */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
                <div className="space-y-4">
                  {recentReviews.slice(0, 3).map(review => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      currentUser={currentUser}
                      showActions={false}
                      className="border border-gray-200"
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">All Reviews</h3>
                <div className="flex gap-2">
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option>All Ratings</option>
                    <option>5 Stars</option>
                    <option>4 Stars</option>
                    <option>3 Stars</option>
                    <option>2 Stars</option>
                    <option>1 Star</option>
                  </select>
                  <select className="px-3 py-2 border border-gray-300 rounded-md text-sm">
                    <option>All Categories</option>
                    <option>Service Quality</option>
                    <option>Communication</option>
                    <option>Professionalism</option>
                  </select>
                </div>
              </div>
              
              <div className="space-y-4">
                {recentReviews.map(review => (
                  <ReviewCard
                    key={review.id}
                    review={review}
                    currentUser={currentUser}
                    onVote={async (reviewId, voteType) => {
                      // Handle vote
                    }}
                    onReport={async (reviewId, reason) => {
                      // Handle report
                    }}
                    className="border border-gray-200"
                  />
                ))}
              </div>
            </div>
          )}

          {activeTab === 'badges' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Earned Badges</h3>
              
              {badges.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Award className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No badges earned yet</p>
                  <p className="text-sm text-gray-500 mt-2">Complete activities to earn your first badge!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {badges.map(badge => (
                    <div key={badge.id} className="bg-gray-50 rounded-lg p-4 text-center">
                      <div className="text-4xl mb-3">{badge.badge_icon}</div>
                      <h4 className="font-semibold text-gray-900 mb-1">{badge.badge_name}</h4>
                      <p className="text-sm text-gray-600 mb-2">{badge.badge_description}</p>
                      <div className="flex justify-between items-center text-xs text-gray-500">
                        <span>Earned: {new Date(badge.earned_at).toLocaleDateString()}</span>
                        <span className="px-2 py-1 bg-white rounded-full text-gray-700">
                          {badge.badge_level}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Performance Analytics</h3>
              
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Score Trend */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <TrendingUp className="w-5 h-5" />
                    Score Trend
                  </h4>
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <BarChart3 className="w-12 h-12 mx-auto mb-2" />
                      <p>Chart visualization coming soon</p>
                    </div>
                  </div>
                </div>

                {/* Rating Distribution */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
                    <PieChart className="w-5 h-5" />
                    Rating Distribution
                  </h4>
                  <div className="h-64 flex items-center justify-center text-gray-500">
                    <div className="text-center">
                      <PieChart className="w-12 h-12 mx-auto mb-2" />
                      <p>Chart visualization coming soon</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Metrics Table */}
              <div className="bg-gray-50 rounded-lg p-6">
                <h4 className="font-medium text-gray-900 mb-4">Recent Metrics</h4>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2">Date</th>
                        <th className="text-center py-2">Avg Rating</th>
                        <th className="text-center py-2">Reviews</th>
                        <th className="text-center py-2">Positive</th>
                        <th className="text-center py-2">Helpful Votes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {metrics.slice(0, 10).map((metric, index) => (
                        <tr key={index} className="border-b">
                          <td className="py-2">{new Date(metric.metric_date).toLocaleDateString()}</td>
                          <td className="text-center py-2">
                            <StarRating value={metric.daily_rating_average || 0} readonly showValue={false} size="sm" />
                          </td>
                          <td className="text-center py-2">{metric.daily_review_count || 0}</td>
                          <td className="text-center py-2">{metric.daily_positive_reviews || 0}</td>
                          <td className="text-center py-2">{metric.daily_helpful_votes || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="space-y-6">
              <h3 className="text-lg font-semibold text-gray-900">Reputation History</h3>
              
              {history.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                  <Activity className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-600">No history available</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {history.map((event, index) => (
                    <div key={index} className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                      <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                        <Activity className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{event.event_description}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(event.created_at).toLocaleDateString()} • {event.event_type.replace('_', ' ')}
                        </p>
                      </div>
                      {event.score_change && (
                        <div className={`flex items-center gap-1 text-sm font-medium ${
                          event.score_change >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {event.score_change >= 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          {Math.abs(event.score_change)}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const ScoreCard = ({ title, value, icon, color }) => {
  const colorClasses = {
    blue: 'bg-blue-50 text-blue-600 border-blue-200',
    green: 'bg-green-50 text-green-600 border-green-200',
    purple: 'bg-purple-50 text-purple-600 border-purple-200',
    yellow: 'bg-yellow-50 text-yellow-600 border-yellow-200'
  };

  return (
    <div className={`border rounded-lg p-4 ${colorClasses[color]}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">{title}</span>
        {icon}
      </div>
      <div className="text-2xl font-bold">{value.toFixed(1)}</div>
      <div className="w-full bg-white bg-opacity-50 rounded-full h-2 mt-2">
        <div
          className="bg-current h-2 rounded-full transition-all duration-300"
          style={{ width: `${(value / 5) * 100}%` }}
        ></div>
      </div>
    </div>
  );
};

export default ReputationDashboard;
