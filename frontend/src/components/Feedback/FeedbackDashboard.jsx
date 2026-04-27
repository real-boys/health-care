import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Plus, 
  Search, 
  Filter, 
  BarChart3, 
  Settings, 
  Users, 
  Star,
  TrendingUp,
  Calendar,
  Download,
  RefreshCw,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import FeedbackForm from './FeedbackForm';
import ReviewCard from './ReviewCard';
import FeedbackAnalytics from './FeedbackAnalytics';
import { FEEDBACK_TYPES, RATING_SCALE, SENTIMENT_LABELS } from '../../utils/feedbackConfig';

const FeedbackDashboard = ({ 
  feedbackData = [], 
  onSubmitFeedback,
  onReplyToReview,
  onReportReview,
  onVoteReview,
  onExportData,
  loading = false
}) => {
  const [activeTab, setActiveTab] = useState('reviews');
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterRating, setFilterRating] = useState('all');
  const [filterSentiment, setFilterSentiment] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [sortBy, setSortBy] = useState('recent');
  const [stats, setStats] = useState(null);

  // Calculate statistics
  useEffect(() => {
    if (feedbackData && feedbackData.length > 0) {
      const totalReviews = feedbackData.length;
      const averageRating = Math.round(
        (feedbackData.reduce((sum, review) => sum + review.rating, 0) / totalReviews) * 100
      ) / 100;
      
      const sentimentCounts = feedbackData.reduce((acc, review) => {
        const sentiment = review.sentiment || 'NEUTRAL';
        acc[sentiment] = (acc[sentiment] || 0) + 1;
        return acc;
      }, {});

      const positivePercentage = Math.round(
        ((sentimentCounts['POSITIVE'] + sentimentCounts['VERY_POSITIVE']) / totalReviews) * 100
      );

      const categoryCounts = feedbackData.reduce((acc, review) => {
        const category = review.category || 'general';
        acc[category] = (acc[category] || 0) + 1;
        return acc;
      }, {});

      setStats({
        totalReviews,
        averageRating,
        positivePercentage,
        categoryCounts,
        sentimentCounts
      });
    }
  }, [feedbackData]);

  // Filter and sort reviews
  const filteredAndSortedReviews = React.useMemo(() => {
    let filtered = feedbackData || [];

    // Apply search filter
    if (searchQuery) {
      filtered = filtered.filter(review => 
        review.comment?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (review.authorName && review.authorName.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (review.category && review.category.toLowerCase().includes(searchQuery.toLowerCase()))
      );
    }

    // Apply rating filter
    if (filterRating !== 'all') {
      filtered = filtered.filter(review => review.rating === parseInt(filterRating));
    }

    // Apply sentiment filter
    if (filterSentiment !== 'all') {
      filtered = filtered.filter(review => review.sentiment === filterSentiment);
    }

    // Apply category filter
    if (filterCategory !== 'all') {
      filtered = filtered.filter(review => review.category === filterCategory);
    }

    // Apply sorting
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.createdAt) - new Date(a.createdAt);
        case 'oldest':
          return new Date(a.createdAt) - new Date(b.createdAt);
        case 'highest':
          return b.rating - a.rating;
        case 'lowest':
          return a.rating - b.rating;
        case 'helpful':
          return (b.helpfulCount || 0) - (a.helpfulCount || 0);
        default:
          return new Date(b.createdAt) - new Date(a.createdAt);
      }
    });

    return filtered;
  }, [feedbackData, searchQuery, filterRating, filterSentiment, filterCategory, sortBy]);

  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      await onSubmitFeedback(feedbackData);
      setShowFeedbackForm(false);
    } catch (error) {
      console.error('Error submitting feedback:', error);
    }
  };

  const handleReply = async (reviewId, replyText) => {
    try {
      await onReplyToReview(reviewId, replyText);
    } catch (error) {
      console.error('Error replying to review:', error);
    }
  };

  const handleReport = async (reviewId, reason) => {
    try {
      await onReportReview(reviewId, reason);
    } catch (error) {
      console.error('Error reporting review:', error);
    }
  };

  const handleVote = async (reviewId, helpful) => {
    try {
      await onVoteReview(reviewId, helpful);
    } catch (error) {
      console.error('Error voting on review:', error);
    }
  };

  const handleExport = () => {
    if (onExportData) {
      onExportData(filteredAndSortedReviews);
    }
  };

  const tabs = [
    { id: 'reviews', label: 'Reviews', icon: MessageSquare, count: filteredAndSortedReviews.length },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'insights', label: 'Insights', icon: TrendingUp }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Feedback & Reviews</h1>
              <p className="text-gray-500">Manage and analyze customer feedback</p>
            </div>
            
            <div className="flex items-center space-x-4">
              <button
                onClick={handleExport}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </button>
              
              <button
                onClick={() => setShowFeedbackForm(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Feedback
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Overview */}
      {stats && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-blue-100 rounded-lg">
                  <MessageSquare className="w-6 h-6 text-blue-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Reviews</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.totalReviews}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-yellow-100 rounded-lg">
                  <Star className="w-6 h-6 text-yellow-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Average Rating</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.averageRating}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-green-100 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-green-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Positive Sentiment</p>
                  <p className="text-2xl font-bold text-gray-900">{stats.positivePercentage}%</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center">
                <div className="p-3 bg-purple-100 rounded-lg">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Engagement</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {feedbackData.reduce((sum, review) => 
                      sum + (review.helpfulCount || 0) + (review.notHelpfulCount || 0), 0
                    )}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12">
        {/* Tabs */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
          <div className="flex space-x-8 px-6 pt-6">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center space-x-2 pb-4 border-b-2 transition-colors ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="font-medium">{tab.label}</span>
                  {tab.count !== undefined && (
                    <span className="bg-gray-100 text-gray-600 px-2 py-1 rounded-full text-xs">
                      {tab.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab Content */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          {activeTab === 'reviews' && (
            <div>
              {/* Filters */}
              <div className="p-6 border-b border-gray-200">
                <div className="flex flex-wrap gap-4">
                  <div className="flex-1 min-w-64">
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <input
                        type="text"
                        placeholder="Search reviews..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      />
                    </div>
                  </div>

                  <select
                    value={filterRating}
                    onChange={(e) => setFilterRating(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Ratings</option>
                    <option value="5">5 Stars</option>
                    <option value="4">4 Stars</option>
                    <option value="3">3 Stars</option>
                    <option value="2">2 Stars</option>
                    <option value="1">1 Star</option>
                  </select>

                  <select
                    value={filterSentiment}
                    onChange={(e) => setFilterSentiment(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Sentiments</option>
                    <option value="VERY_POSITIVE">Very Positive</option>
                    <option value="POSITIVE">Positive</option>
                    <option value="NEUTRAL">Neutral</option>
                    <option value="NEGATIVE">Negative</option>
                    <option value="VERY_NEGATIVE">Very Negative</option>
                  </select>

                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="all">All Categories</option>
                    <option value="provider">Providers</option>
                    <option value="service">Services</option>
                    <option value="facility">Facilities</option>
                    <option value="billing">Billing</option>
                  </select>

                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="recent">Most Recent</option>
                    <option value="oldest">Oldest</option>
                    <option value="highest">Highest Rated</option>
                    <option value="lowest">Lowest Rated</option>
                    <option value="helpful">Most Helpful</option>
                  </select>
                </div>
              </div>

              {/* Reviews List */}
              <div className="divide-y divide-gray-200">
                {filteredAndSortedReviews.length > 0 ? (
                  filteredAndSortedReviews.map((review) => (
                    <ReviewCard
                      key={review.id}
                      review={review}
                      onHelpful={(helpful) => handleVote(review.id, helpful)}
                      onReport={handleReport}
                      onReply={handleReply}
                      className="p-6"
                    />
                  ))
                ) : (
                  <div className="p-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No reviews found</h3>
                    <p className="text-gray-500">
                      {searchQuery || filterRating !== 'all' || filterSentiment !== 'all' || filterCategory !== 'all'
                        ? 'Try adjusting your filters or search query'
                        : 'No reviews have been submitted yet'
                      }
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'analytics' && (
            <div className="p-6">
              <FeedbackAnalytics
                feedbackData={feedbackData}
                onExport={onExportData}
                onRefresh={() => console.log('Refresh analytics')}
                loading={loading}
              />
            </div>
          )}

          {activeTab === 'insights' && (
            <div className="p-6">
              <div className="text-center py-12">
                <TrendingUp className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">AI-Powered Insights</h3>
                <p className="text-gray-500 mb-6">
                  Advanced analytics and insights coming soon
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Trend Analysis</h4>
                    <p className="text-sm text-gray-600">
                      Identify patterns and trends in customer feedback over time
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Sentiment Trends</h4>
                    <p className="text-sm text-gray-600">
                      Track changes in customer sentiment and satisfaction levels
                    </p>
                  </div>
                  <div className="bg-gray-50 p-6 rounded-lg">
                    <h4 className="font-medium text-gray-900 mb-2">Predictive Analytics</h4>
                    <p className="text-sm text-gray-600">
                      Forecast customer satisfaction based on feedback patterns
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Feedback Form Modal */}
      {showFeedbackForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-gray-900">Submit Feedback</h2>
                <button
                  onClick={() => setShowFeedbackForm(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <span className="sr-only">Close</span>
                  <span className="text-2xl">&times;</span>
                </button>
              </div>
            </div>
            
            <FeedbackForm
              onSubmit={handleFeedbackSubmit}
              onCancel={() => setShowFeedbackForm(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default FeedbackDashboard;
