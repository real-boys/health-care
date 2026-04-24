import React, { useState, useEffect, useMemo } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  PieChart, 
  Pie, 
  Cell, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  Star, 
  MessageSquare, 
  Calendar, 
  Filter, 
  Download, 
  RefreshCw,
  ThumbsUp,
  ThumbsDown,
  AlertCircle,
  CheckCircle,
  Clock
} from 'lucide-react';
import { SENTIMENT_LABELS, getTrendIndicator } from '../../utils/feedbackConfig';
import { sentimentAnalyzer } from '../../utils/sentimentAnalyzer';

const FeedbackAnalytics = ({ 
  feedbackData = [], 
  timeRange = '30d',
  onExport,
  onRefresh,
  loading = false 
}) => {
  const [selectedTimeRange, setSelectedTimeRange] = useState(timeRange);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedSentiment, setSelectedSentiment] = useState('all');

  // Process data for analytics
  const processedData = useMemo(() => {
    if (!feedbackData || feedbackData.length === 0) {
      return {
        totalReviews: 0,
        averageRating: 0,
        sentimentDistribution: [],
        ratingDistribution: [],
        categoryPerformance: [],
        timeSeriesData: [],
        topPerformers: [],
        recentReviews: [],
        engagementMetrics: {
          helpfulVotes: 0,
          totalVotes: 0,
          replies: 0,
          shares: 0
        }
      };
    }

    // Filter data based on time range and filters
    const filteredData = feedbackData.filter(review => {
      const reviewDate = new Date(review.createdAt);
      const now = new Date();
      const daysDiff = Math.floor((now - reviewDate) / (1000 * 60 * 60 * 24));
      
      let timeFilter = true;
      if (selectedTimeRange === '7d') timeFilter = daysDiff <= 7;
      else if (selectedTimeRange === '30d') timeFilter = daysDiff <= 30;
      else if (selectedTimeRange === '90d') timeFilter = daysDiff <= 90;
      else if (selectedTimeRange === '1y') timeFilter = daysDiff <= 365;
      
      let categoryFilter = selectedCategory === 'all' || review.category === selectedCategory;
      let sentimentFilter = selectedSentiment === 'all' || review.sentiment === selectedSentiment;
      
      return timeFilter && categoryFilter && sentimentFilter;
    });

    // Calculate metrics
    const totalReviews = filteredData.length;
    const averageRating = totalReviews > 0 
      ? Math.round((filteredData.reduce((sum, review) => sum + review.rating, 0) / totalReviews) * 100) / 100 
      : 0;

    // Sentiment distribution
    const sentimentCounts = filteredData.reduce((acc, review) => {
      const sentiment = review.sentiment || 'NEUTRAL';
      acc[sentiment] = (acc[sentiment] || 0) + 1;
      return acc;
    }, {});

    const sentimentDistribution = Object.entries(sentimentCounts).map(([sentiment, count]) => ({
      name: sentiment.replace('_', ' '),
      value: count,
      percentage: Math.round((count / totalReviews) * 100),
      color: SENTIMENT_LABELS[sentiment]?.color || '#6b7280'
    }));

    // Rating distribution
    const ratingCounts = Array(5).fill(0).map((_, index) => index + 1).map(rating => 
      filteredData.filter(review => review.rating === rating).length
    );

    const ratingDistribution = ratingCounts.map((count, index) => ({
      rating: index + 1,
      count,
      percentage: Math.round((count / totalReviews) * 100)
    }));

    // Category performance
    const categoryData = {};
    filteredData.forEach(review => {
      if (review.categoryRatings) {
        Object.entries(review.categoryRatings).forEach(([category, rating]) => {
          if (!categoryData[category]) {
            categoryData[category] = { ratings: [], total: 0 };
          }
          categoryData[category].ratings.push(rating);
          categoryData[category].total++;
        });
      }
    });

    const categoryPerformance = Object.entries(categoryData).map(([category, data]) => ({
      category,
      averageRating: data.ratings.length > 0 
        ? Math.round((data.ratings.reduce((sum, rating) => sum + rating, 0) / data.ratings.length) * 100) / 100 
        : 0,
      reviewCount: data.total,
      total: data.total
    })).sort((a, b) => b.averageRating - a.averageRating);

    // Time series data
    const timeSeriesData = [];
    const groupedByDate = {};
    
    filteredData.forEach(review => {
      const date = new Date(review.createdAt).toLocaleDateString();
      if (!groupedByDate[date]) {
        groupedByDate[date] = { reviews: [], ratings: [], sentiments: [] };
      }
      groupedByDate[date].reviews.push(review);
      groupedByDate[date].ratings.push(review.rating);
      groupedByDate[date].sentiments.push(review.sentiment);
    });

    Object.entries(groupedByDate).forEach(([date, data]) => {
      const avgRating = data.ratings.length > 0 
        ? data.ratings.reduce((sum, rating) => sum + rating, 0) / data.ratings.length 
        : 0;
      
      const positiveCount = data.sentiments.filter(s => s?.includes('POSITIVE')).length;
      const sentimentRatio = data.sentiments.length > 0 ? positiveCount / data.sentiments.length : 0;

      timeSeriesData.push({
        date,
        reviews: data.reviews.length,
        averageRating: Math.round(avgRating * 100) / 100,
        sentimentRatio: Math.round(sentimentRatio * 100),
        sentimentScore: sentimentRatio * avgRating
      });
    });

    timeSeriesData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Top performers
    const topPerformers = filteredData
      .filter(review => review.rating >= 4)
      .sort((a, b) => b.helpfulCount - a.helpfulCount)
      .slice(0, 5);

    // Recent reviews
    const recentReviews = filteredData
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    // Engagement metrics
    const engagementMetrics = {
      helpfulVotes: filteredData.reduce((sum, review) => sum + (review.helpfulCount || 0), 0),
      totalVotes: filteredData.reduce((sum, review) => sum + (review.helpfulCount || 0) + (review.notHelpfulCount || 0), 0),
      replies: filteredData.reduce((sum, review) => sum + (review.replies?.length || 0), 0),
      shares: filteredData.reduce((sum, review) => sum + (review.shareCount || 0), 0)
    };

    return {
      totalReviews,
      averageRating,
      sentimentDistribution,
      ratingDistribution,
      categoryPerformance,
      timeSeriesData,
      topPerformers,
      recentReviews,
      engagementMetrics
    };
  }, [feedbackData, selectedTimeRange, selectedCategory, selectedSentiment]);

  // Calculate trends (comparing with previous period)
  const calculateTrends = () => {
    // This would compare with previous period data
    // For now, return placeholder trends
    return {
      reviewsTrend: { direction: 'up', value: 12, color: '#10b981' },
      ratingTrend: { direction: 'up', value: 5, color: '#10b981' },
      sentimentTrend: { direction: 'stable', value: 0, color: '#6b7280' }
    };
  };

  const trends = calculateTrends();

  const handleExport = () => {
    if (onExport) {
      onExport(processedData);
    }
  };

  const handleRefresh = () => {
    if (onRefresh) {
      onRefresh();
    }
  };

  const COLORS = ['#10b981', '#ef4444', '#f59e0b', '#3b82f6', '#8b5cf6'];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Feedback Analytics</h2>
          <p className="text-gray-500">Monitor and analyze customer feedback performance</p>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Filters */}
          <select
            value={selectedTimeRange}
            onChange={(e) => setSelectedTimeRange(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
            <option value="1y">Last year</option>
          </select>

          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Categories</option>
            <option value="provider">Providers</option>
            <option value="service">Services</option>
            <option value="facility">Facilities</option>
            <option value="billing">Billing</option>
          </select>

          <select
            value={selectedSentiment}
            onChange={(e) => setSelectedSentiment(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">All Sentiments</option>
            <option value="VERY_POSITIVE">Very Positive</option>
            <option value="POSITIVE">Positive</option>
            <option value="NEUTRAL">Neutral</option>
            <option value="NEGATIVE">Negative</option>
            <option value="VERY_NEGATIVE">Very Negative</option>
          </select>

          <button
            onClick={handleRefresh}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            onClick={handleExport}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Reviews</p>
              <p className="text-2xl font-bold text-gray-900">{processedData.totalReviews}</p>
            </div>
            <div className={`p-3 rounded-full ${trends.reviewsTrend.direction === 'up' ? 'bg-green-100' : 'bg-red-100'}`}>
              {trends.reviewsTrend.direction === 'up' ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {trends.reviewsTrend.direction === 'up' ? 'Increased' : 'Decreased'} by {trends.reviewsTrend.value}% from last period
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Average Rating</p>
              <p className="text-2xl font-bold text-gray-900">{processedData.averageRating}</p>
            </div>
            <div className={`p-3 rounded-full ${trends.ratingTrend.direction === 'up' ? 'bg-green-100' : 'bg-red-100'}`}>
              {trends.ratingTrend.direction === 'up' ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {trends.ratingTrend.direction === 'up' ? 'Improved' : 'Declined'} by {trends.ratingTrend.value}% from last period
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Positive Sentiment</p>
              <p className="text-2xl font-bold text-gray-900">
                {processedData.sentimentDistribution
                  .filter(s => s.name.includes('Positive'))
                  .reduce((sum, s) => sum + s.percentage, 0)}%
              </p>
            </div>
            <div className={`p-3 rounded-full ${trends.sentimentTrend.direction === 'up' ? 'bg-green-100' : 'bg-red-100'}`}>
              {trends.sentimentTrend.direction === 'up' ? (
                <TrendingUp className="w-5 h-5 text-green-600" />
              ) : (
                <TrendingDown className="w-5 h-5 text-red-600" />
              )}
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            Customer sentiment is {trends.sentimentTrend.direction === 'up' ? 'improving' : 'declining'}
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Engagement Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {processedData.engagementMetrics.totalVotes > 0 
                  ? Math.round((processedData.engagementMetrics.helpfulVotes / processedData.engagementMetrics.totalVotes) * 100) 
                  : 0}%
              </p>
            </div>
            <div className="p-3 rounded-full bg-blue-100">
              <Users className="w-5 h-5 text-blue-600" />
            </div>
          </div>
          <div className="mt-2 text-xs text-gray-500">
            {processedData.engagementMetrics.helpfulVotes} helpful votes out of {processedData.engagementMetrics.totalVotes} total
          </div>
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Rating Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={processedData.ratingDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Sentiment Analysis</h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={processedData.sentimentDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {processedData.sentimentDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Time Series */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Performance Over Time</h3>
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={processedData.timeSeriesData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="averageRating"
              stroke="#3b82f6"
              strokeWidth={2}
              name="Avg Rating"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="sentimentScore"
              stroke="#10b981"
              strokeWidth={2}
              name="Sentiment Score"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Category Performance */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Category Performance</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={processedData.categoryPerformance}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="category" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="averageRating" fill="#10b981" name="Avg Rating" />
            <Bar dataKey="reviewCount" fill="#3b82f6" name="Review Count" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Top Performers */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Reviews</h3>
        <div className="space-y-4">
          {processedData.topPerformers.map((review, index) => (
            <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={16}
                      className={star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {review.anonymous ? 'Anonymous' : review.authorName}
                  </p>
                  <p className="text-sm text-gray-500">
                    {review.comment?.slice(0, 100)}...
                  </p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-1 text-sm text-gray-600">
                  <ThumbsUp className="w-4 h-4" />
                  <span>{review.helpfulCount || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Reviews */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Reviews</h3>
        <div className="space-y-4">
          {processedData.recentReviews.map((review, index) => (
            <div key={index} className="border-l-4 border-blue-500 pl-4 py-2">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center space-x-2 mb-1">
                    <span className="font-medium text-gray-900">
                      {review.anonymous ? 'Anonymous' : review.authorName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                    {review.sentiment && (
                      <span 
                        className="px-2 py-1 rounded-full text-xs font-medium"
                        style={{ 
                          backgroundColor: `${SENTIMENT_LABELS[review.sentiment]?.color}20`,
                          color: SENTIMENT_LABELS[review.sentiment]?.color
                        }}
                      >
                        {review.sentiment.replace('_', ' ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-1 mb-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        size={14}
                        className={star <= review.rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                      />
                    ))}
                  </div>
                  <p className="text-sm text-gray-700">{review.comment}</p>
                </div>
                <div className="text-right text-sm text-gray-500">
                  <div className="flex items-center space-x-2">
                    <span>{review.helpfulCount || 0}</span>
                    <span>helpful</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default FeedbackAnalytics;
