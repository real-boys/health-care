import React, { useState, useEffect } from 'react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ScatterChart,
  Scatter
} from 'recharts';
import { 
  Users, 
  TrendingUp, 
  Target, 
  Filter,
  Search,
  ChevronDown,
  Award,
  Star,
  ArrowUp,
  ArrowDown,
  Minus,
  Globe,
  MapPin,
  Building,
  Briefcase
} from 'lucide-react';

const ComparativeAnalysis = ({ userId, profileType, currentUser }) => {
  const [comparisons, setComparisons] = useState([]);
  const [peerData, setPeerData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedGroup, setSelectedGroup] = useState('all_providers');
  const [selectedMetric, setSelectedMetric] = useState('overall_score');
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchComparisonData();
  }, [userId, profileType, selectedGroup]);

  const fetchComparisonData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch comparison data
      const comparisonResponse = await fetch(`/api/reputation/comparisons/${userId}?group=${selectedGroup}`, {
        headers
      });
      
      if (comparisonResponse.ok) {
        const comparisonData = await comparisonResponse.json();
        setComparisons(comparisonData.comparisons || []);
      }

      // Fetch peer data for detailed comparison
      const peerResponse = await fetch(`/api/reputation/peer-analysis/${userId}?group=${selectedGroup}&limit=50`, {
        headers
      });
      
      if (peerResponse.ok) {
        const peerDataResponse = await peerResponse.json();
        setPeerData(peerDataResponse.peers || []);
      }

    } catch (error) {
      console.error('Error fetching comparison data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getGroupIcon = (group) => {
    const icons = {
      all_providers: <Users className="w-4 h-4" />,
      specialty: <Briefcase className="w-4 h-4" />,
      region: <MapPin className="w-4 h-4" />,
      facility: <Building className="w-4 h-4" />,
      experience_level: <Award className="w-4 h-4" />
    };
    return icons[group] || icons.all_providers;
  };

  const getGroupLabel = (group) => {
    const labels = {
      all_providers: 'All Providers',
      specialty: 'Same Specialty',
      region: 'Same Region',
      facility: 'Same Facility',
      experience_level: 'Same Experience Level'
    };
    return labels[group] || 'All Providers';
  };

  const getMetricLabel = (metric) => {
    const labels = {
      overall_score: 'Overall Score',
      trust_score: 'Trust Score',
      reliability_score: 'Reliability',
      quality_score: 'Quality',
      engagement_score: 'Engagement',
      total_ratings: 'Total Ratings',
      total_reviews: 'Total Reviews',
      positive_reviews: 'Positive Reviews'
    };
    return labels[metric] || metric;
  };

  const getPercentileColor = (percentile) => {
    if (percentile >= 90) return 'text-green-600 bg-green-50';
    if (percentile >= 75) return 'text-blue-600 bg-blue-50';
    if (percentile >= 50) return 'text-yellow-600 bg-yellow-50';
    if (percentile >= 25) return 'text-orange-600 bg-orange-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (current, previous) => {
    if (!previous) return <Minus className="w-4 h-4 text-gray-400" />;
    
    const change = ((current - previous) / previous) * 100;
    if (change > 5) return <ArrowUp className="w-4 h-4 text-green-600" />;
    if (change < -5) return <ArrowDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getComparisonChartData = () => {
    const comparison = comparisons.find(c => c.comparison_group === selectedGroup);
    if (!comparison) return [];

    return [
      {
        metric: 'You',
        score: comparison.user_score || 0,
        average: comparison.group_average_score || 0,
        percentile: comparison.percentile_rank || 0
      },
      {
        metric: 'Group Avg',
        score: comparison.group_average_score || 0,
        average: comparison.group_average_score || 0,
        percentile: 50
      },
      {
        metric: 'Top 10%',
        score: (comparison.group_average_score || 0) * 1.2,
        average: comparison.group_average_score || 0,
        percentile: 90
      }
    ];
  };

  const getRadarChartData = () => {
    const comparison = comparisons.find(c => c.comparison_group === selectedGroup);
    if (!comparison) return [];

    return [
      { metric: 'Overall', A: comparison.user_score || 0, B: comparison.group_average_score || 0, fullMark: 5 },
      { metric: 'Trust', A: comparison.user_trust_score || 0, B: comparison.group_trust_average || 0, fullMark: 5 },
      { metric: 'Reliability', A: comparison.user_reliability_score || 0, B: comparison.group_reliability_average || 0, fullMark: 5 },
      { metric: 'Quality', A: comparison.user_quality_score || 0, B: comparison.group_quality_average || 0, fullMark: 5 },
      { metric: 'Engagement', A: comparison.user_engagement_score || 0, B: comparison.group_engagement_average || 0, fullMark: 5 }
    ];
  };

  const getPeerComparisonData = () => {
    return peerData
      .filter(peer => 
        peer.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        peer.specialty?.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .slice(0, 20)
      .map(peer => ({
        name: peer.name,
        score: peer.overall_score || 0,
        reviews: peer.total_reviews || 0,
        rating: peer.average_rating || 0,
        badges: peer.total_badges || 0
      }));
  };

  const getTopPerformers = () => {
    return peerData
      .sort((a, b) => (b.overall_score || 0) - (a.overall_score || 0))
      .slice(0, 10);
  };

  const getImprovementOpportunities = () => {
    const comparison = comparisons.find(c => c.comparison_group === selectedGroup);
    if (!comparison) return [];

    const opportunities = [];
    
    if (comparison.user_score < comparison.group_average_score) {
      opportunities.push({
        area: 'Overall Score',
        gap: (comparison.group_average_score - comparison.user_score).toFixed(1),
        priority: 'high'
      });
    }

    if (comparison.user_trust_score < comparison.group_trust_average) {
      opportunities.push({
        area: 'Trust Score',
        gap: (comparison.group_trust_average - comparison.user_trust_score).toFixed(1),
        priority: 'medium'
      });
    }

    if (comparison.user_quality_score < comparison.group_quality_average) {
      opportunities.push({
        area: 'Quality Score',
        gap: (comparison.group_quality_average - comparison.user_quality_score).toFixed(1),
        priority: 'high'
      });
    }

    return opportunities;
  };

  const comparisonChartData = getComparisonChartData();
  const radarChartData = getRadarChartData();
  const peerComparisonData = getPeerComparisonData();
  const topPerformers = getTopPerformers();
  const improvementOpportunities = getImprovementOpportunities();

  const comparisonGroups = [
    { value: 'all_providers', label: 'All Providers', icon: <Users className="w-4 h-4" /> },
    { value: 'specialty', label: 'Same Specialty', icon: <Briefcase className="w-4 h-4" /> },
    { value: 'region', label: 'Same Region', icon: <MapPin className="w-4 h-4" /> },
    { value: 'facility', label: 'Same Facility', icon: <Building className="w-4 h-4" /> },
    { value: 'experience_level', label: 'Same Experience Level', icon: <Award className="w-4 h-4" /> }
  ];

  const metrics = [
    { value: 'overall_score', label: 'Overall Score' },
    { value: 'trust_score', label: 'Trust Score' },
    { value: 'reliability_score', label: 'Reliability' },
    { value: 'quality_score', label: 'Quality' },
    { value: 'engagement_score', label: 'Engagement' },
    { value: 'total_ratings', label: 'Total Ratings' },
    { value: 'total_reviews', label: 'Total Reviews' }
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
            <h1 className="text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
              <Target className="w-6 h-6 text-blue-600" />
              Comparative Analysis
            </h1>
            <p className="text-gray-600">Compare your performance with peers and industry benchmarks</p>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Group Selector */}
            <div className="relative">
              <select
                value={selectedGroup}
                onChange={(e) => setSelectedGroup(e.target.value)}
                className="appearance-none pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              >
                {comparisonGroups.map(group => (
                  <option key={group.value} value={group.value}>
                    {group.label}
                  </option>
                ))}
              </select>
              <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metric</label>
              <select
                value={selectedMetric}
                onChange={(e) => setSelectedMetric(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              >
                {metrics.map(metric => (
                  <option key={metric.value} value={metric.value}>
                    {metric.label}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm">
                <option>Last 30 Days</option>
                <option>Last 90 Days</option>
                <option>Last Year</option>
                <option>All Time</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Search Peers</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by name or specialty..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm"
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Comparison Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {comparisons.map(comparison => (
          <div key={comparison.comparison_group} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                {getGroupIcon(comparison.comparison_group)}
                <span className="font-medium text-gray-900">{getGroupLabel(comparison.comparison_group)}</span>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${getPercentileColor(comparison.percentile_rank)}`}>
                Top {100 - (comparison.percentile_rank || 0)}%
              </span>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Your Score</span>
                <span className="font-bold text-gray-900">{(comparison.user_score || 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Group Average</span>
                <span className="font-medium text-gray-700">{(comparison.group_average_score || 0).toFixed(1)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Group Size</span>
                <span className="font-medium text-gray-700">{comparison.group_size || 0}</span>
              </div>
            </div>
            
            <div className="mt-3 pt-3 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Percentile Rank</span>
                <div className="flex items-center gap-1">
                  {getTrendIcon(comparison.user_score, comparison.previous_score)}
                  <span className="font-bold text-gray-900">{(comparison.percentile_rank || 0).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Performance Comparison Chart */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Performance Comparison</h2>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={comparisonChartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="metric" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="score" fill="#3B82F6" name="Score" />
            <Bar dataKey="average" fill="#10B981" name="Average" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Skills Radar Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Skills Comparison</h2>
          <ResponsiveContainer width="100%" height={300}>
            <RadarChart data={radarChartData}>
              <PolarGrid />
              <PolarAngleAxis dataKey="metric" />
              <PolarRadiusAxis angle={90} domain={[0, 5]} />
              <Radar name="You" dataKey="A" stroke="#3B82F6" fill="#3B82F6" fillOpacity={0.6} />
              <Radar name="Group Average" dataKey="B" stroke="#10B981" fill="#10B981" fillOpacity={0.6} />
              <Legend />
            </RadarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Improvement Opportunities</h2>
          {improvementOpportunities.length === 0 ? (
            <div className="text-center py-8">
              <Award className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600">Great job! You're performing above average in all areas.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {improvementOpportunities.map((opportunity, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div>
                    <p className="font-medium text-gray-900">{opportunity.area}</p>
                    <p className="text-sm text-gray-600">Gap: {opportunity.gap} points</p>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                    opportunity.priority === 'high' ? 'bg-red-100 text-red-800' :
                    opportunity.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-blue-100 text-blue-800'
                  }`}>
                    {opportunity.priority} priority
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Peer Comparison */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Peer Comparison</h2>
        <ResponsiveContainer width="100%" height={400}>
          <ScatterChart>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="reviews" name="Reviews" />
            <YAxis dataKey="score" name="Score" />
            <Tooltip cursor={{ strokeDasharray: '3 3' }} />
            <Scatter name="Peers" data={peerComparisonData} fill="#3B82F6" />
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Top Performers */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Top Performers</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-2">Rank</th>
                <th className="text-left py-2">Name</th>
                <th className="text-center py-2">Score</th>
                <th className="text-center py-2">Reviews</th>
                <th className="text-center py-2">Rating</th>
                <th className="text-center py-2">Badges</th>
              </tr>
            </thead>
            <tbody>
              {topPerformers.map((performer, index) => (
                <tr key={index} className="border-b">
                  <td className="py-2">
                    <div className="flex items-center gap-2">
                      {index < 3 && <Award className="w-4 h-4 text-yellow-500" />}
                      #{index + 1}
                    </div>
                  </td>
                  <td className="py-2 font-medium">{performer.name}</td>
                  <td className="text-center py-2">
                    <span className="font-bold text-blue-600">{(performer.overall_score || 0).toFixed(1)}</span>
                  </td>
                  <td className="text-center py-2">{performer.total_reviews || 0}</td>
                  <td className="text-center py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      {(performer.average_rating || 0).toFixed(1)}
                    </div>
                  </td>
                  <td className="text-center py-2">{performer.total_badges || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default ComparativeAnalysis;
