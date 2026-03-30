import React, { useState, useEffect } from 'react';
import { 
  LineChart, 
  Line, 
  AreaChart, 
  Area, 
  BarChart, 
  Bar, 
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
  Calendar, 
  BarChart3, 
  PieChart as PieChartIcon,
  Activity,
  Download,
  Filter,
  ChevronDown
} from 'lucide-react';

const ReputationCharts = ({ userId, profileType }) => {
  const [history, setHistory] = useState([]);
  const [metrics, setMetrics] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('30days');
  const [chartType, setChartType] = useState('line');
  const [selectedMetric, setSelectedMetric] = useState('all');

  useEffect(() => {
    fetchChartData();
  }, [userId, profileType, timeRange]);

  const fetchChartData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Calculate date range
      const endDate = new Date();
      const startDate = new Date();
      if (timeRange === '7days') {
        startDate.setDate(startDate.getDate() - 7);
      } else if (timeRange === '30days') {
        startDate.setDate(startDate.getDate() - 30);
      } else if (timeRange === '90days') {
        startDate.setDate(startDate.getDate() - 90);
      } else if (timeRange === '1year') {
        startDate.setFullYear(startDate.getFullYear() - 1);
      }

      // Fetch history data
      const historyResponse = await fetch(
        `/api/reputation/history/${userId}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        { headers }
      );
      
      if (historyResponse.ok) {
        const historyData = await historyResponse.json();
        setHistory(historyData || []);
      }

      // Fetch metrics data
      const metricsResponse = await fetch(
        `/api/reputation/metrics/${userId}?startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`,
        { headers }
      );
      
      if (metricsResponse.ok) {
        const metricsData = await metricsResponse.json();
        setMetrics(metricsData || []);
      }

      // Fetch reviews for distribution
      const reviewsResponse = await fetch(
        `/api/reputation/reviews/${userId}?revieweeType=${profileType}&limit=100`,
        { headers }
      );
      
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        setReviews(reviewsData.reviews || []);
      }

    } catch (error) {
      console.error('Error fetching chart data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Process data for charts
  const getScoreTrendData = () => {
    const scoreMap = new Map();
    
    history.forEach(item => {
      if (item.event_type === 'rating_received' && item.new_score) {
        const date = new Date(item.created_at).toLocaleDateString();
        if (!scoreMap.has(date)) {
          scoreMap.set(date, { date, score: item.new_score });
        }
      }
    });

    return Array.from(scoreMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getRatingDistribution = () => {
    const distribution = [1, 2, 3, 4, 5].map(rating => ({
      rating: `${rating} Star${rating !== 1 ? 's' : ''}`,
      count: reviews.filter(review => review.rating === rating).length,
      percentage: reviews.length > 0 ? (reviews.filter(review => review.rating === rating).length / reviews.length) * 100 : 0
    }));

    return distribution;
  };

  const getCategoryDistribution = () => {
    const categories = {};
    
    reviews.forEach(review => {
      const category = review.review_category || 'other';
      categories[category] = (categories[category] || 0) + 1;
    });

    return Object.entries(categories).map(([category, count]) => ({
      name: category.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
      value: count,
      percentage: reviews.length > 0 ? (count / reviews.length) * 100 : 0
    }));
  };

  const getDailyMetrics = () => {
    const metricsMap = new Map();
    
    metrics.forEach(metric => {
      const date = new Date(metric.metric_date).toLocaleDateString();
      metricsMap.set(date, {
        date,
        avgRating: metric.daily_rating_average || 0,
        reviewCount: metric.daily_review_count || 0,
        positiveReviews: metric.daily_positive_reviews || 0,
        helpfulVotes: metric.daily_helpful_votes || 0
      });
    });

    return Array.from(metricsMap.values()).sort((a, b) => new Date(a.date) - new Date(b.date));
  };

  const getMonthlySummary = () => {
    const monthlyMap = new Map();
    
    metrics.forEach(metric => {
      const date = new Date(metric.metric_date);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      
      if (!monthlyMap.has(monthKey)) {
        monthlyMap.set(monthKey, {
          month: monthKey,
          avgRating: 0,
          totalReviews: 0,
          totalPositive: 0,
          totalVotes: 0,
          count: 0
        });
      }
      
      const monthData = monthlyMap.get(monthKey);
      monthData.avgRating += metric.daily_rating_average || 0;
      monthData.totalReviews += metric.daily_review_count || 0;
      monthData.totalPositive += metric.daily_positive_reviews || 0;
      monthData.totalVotes += metric.daily_helpful_votes || 0;
      monthData.count += 1;
    });

    return Array.from(monthlyMap.values()).map(month => ({
      month: month.month,
      avgRating: month.count > 0 ? month.avgRating / month.count : 0,
      totalReviews: month.totalReviews,
      totalPositive: month.totalPositive,
      totalVotes: month.totalVotes
    })).sort((a, b) => a.month.localeCompare(b.month));
  };

  const scoreTrendData = getScoreTrendData();
  const ratingDistribution = getRatingDistribution();
  const categoryDistribution = getCategoryDistribution();
  const dailyMetrics = getDailyMetrics();
  const monthlySummary = getMonthlySummary();

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];

  const timeRanges = [
    { value: '7days', label: 'Last 7 Days' },
    { value: '30days', label: 'Last 30 Days' },
    { value: '90days', label: 'Last 90 Days' },
    { value: '1year', label: 'Last Year' }
  ];

  const chartTypes = [
    { value: 'line', label: 'Line Chart', icon: <TrendingUp className="w-4 h-4" /> },
    { value: 'area', label: 'Area Chart', icon: <Activity className="w-4 h-4" /> },
    { value: 'bar', label: 'Bar Chart', icon: <BarChart3 className="w-4 h-4" /> }
  ];

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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Reputation Analytics</h1>
            <p className="text-gray-600">Visualize your reputation trends and performance</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Time Range Selector */}
            <div className="relative">
              <select
                value={timeRange}
                onChange={(e) => setTimeRange(e.target.value)}
                className="appearance-none pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {timeRanges.map(range => (
                  <option key={range.value} value={range.value}>
                    {range.label}
                  </option>
                ))}
              </select>
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            <button className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Current Score</p>
              <p className="text-2xl font-bold text-gray-900">
                {scoreTrendData.length > 0 ? scoreTrendData[scoreTrendData.length - 1].score.toFixed(1) : '0.0'}
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-green-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Reviews</p>
              <p className="text-2xl font-bold text-gray-900">{reviews.length}</p>
            </div>
            <BarChart3 className="w-8 h-8 text-blue-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Avg Rating</p>
              <p className="text-2xl font-bold text-gray-900">
                {reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : '0.0'}
              </p>
            </div>
            <Activity className="w-8 h-8 text-yellow-500" />
          </div>
        </div>
        
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Positive Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {reviews.length > 0 ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100) : 0}%
              </p>
            </div>
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Score Trend Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Score Trend</h2>
          <div className="flex gap-2">
            {chartTypes.map(type => (
              <button
                key={type.value}
                onClick={() => setChartType(type.value)}
                className={`flex items-center gap-2 px-3 py-1 rounded-md transition-colors ${
                  chartType === type.value
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {type.icon}
                {type.label}
              </button>
            ))}
          </div>
        </div>
        
        <ResponsiveContainer width="100%" height={300}>
          {chartType === 'line' ? (
            <LineChart data={scoreTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="score" stroke="#3B82F6" strokeWidth={2} dot={{ fill: '#3B82F6' }} />
            </LineChart>
          ) : chartType === 'area' ? (
            <AreaChart data={scoreTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="score" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.3} />
            </AreaChart>
          ) : (
            <BarChart data={scoreTrendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="date" />
              <YAxis domain={[0, 5]} />
              <Tooltip />
              <Legend />
              <Bar dataKey="score" fill="#3B82F6" />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Rating Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Rating Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={ratingDistribution}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="rating" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="count" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Category Distribution</h2>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={({ name, percentage }) => `${name}: ${percentage.toFixed(0)}%`}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
              >
                {categoryDistribution.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Daily Metrics */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Daily Activity</h2>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={dailyMetrics}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Line yAxisId="left" type="monotone" dataKey="avgRating" stroke="#3B82F6" name="Avg Rating" />
            <Line yAxisId="right" type="monotone" dataKey="reviewCount" stroke="#10B981" name="Review Count" />
            <Line yAxisId="right" type="monotone" dataKey="helpfulVotes" stroke="#F59E0B" name="Helpful Votes" />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly Summary */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Monthly Summary</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={monthlySummary}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis yAxisId="left" />
            <YAxis yAxisId="right" orientation="right" />
            <Tooltip />
            <Legend />
            <Bar yAxisId="left" dataKey="avgRating" fill="#3B82F6" name="Avg Rating" />
            <Bar yAxisId="right" dataKey="totalReviews" fill="#10B981" name="Total Reviews" />
            <Bar yAxisId="right" dataKey="totalPositive" fill="#F59E0B" name="Positive Reviews" />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default ReputationCharts;
