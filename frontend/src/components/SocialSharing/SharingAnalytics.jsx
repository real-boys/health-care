import React, { useState, useEffect } from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Clock, 
  Share2, 
  Download, 
  Eye, 
  Heart,
  MessageCircle,
  Calendar,
  Filter,
  RefreshCw
} from 'lucide-react';
import { getSharingAnalytics } from '../../utils/socialSharingConfig';

const SharingAnalytics = ({ realTime = false, refreshInterval = 30000 }) => {
  const [analytics, setAnalytics] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPeriod, setSelectedPeriod] = useState('24h');
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    loadAnalytics();
    
    let interval;
    if (realTime) {
      interval = setInterval(loadAnalytics, refreshInterval);
    }
    
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [selectedPeriod, selectedPlatform, realTime, refreshInterval]);

  const loadAnalytics = async () => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const baseAnalytics = getSharingAnalytics();
      
      // Enhanced analytics with more detailed metrics
      const enhancedAnalytics = {
        ...baseAnalytics,
        performance_metrics: {
          avg_share_time: 2.3, // seconds
          conversion_rate: 0.68, // 68%
          bounce_rate: 0.12, // 12%
          engagement_rate: 0.45 // 45%
        },
        platform_performance: {
          facebook: { shares: 145, engagement: 89, clicks: 234, conversion: 0.72 },
          twitter: { shares: 98, engagement: 67, clicks: 156, conversion: 0.65 },
          linkedin: { shares: 76, engagement: 45, clicks: 98, conversion: 0.58 },
          whatsapp: { shares: 234, engagement: 156, clicks: 345, conversion: 0.78 },
          telegram: { shares: 45, engagement: 23, clicks: 67, conversion: 0.51 },
          reddit: { shares: 34, engagement: 12, clicks: 45, conversion: 0.38 },
          pinterest: { shares: 56, engagement: 34, clicks: 78, conversion: 0.61 },
          email: { shares: 123, engagement: 89, clicks: 234, conversion: 0.82 }
        },
        time_series_data: generateTimeSeriesData(),
        top_content: [
          { title: 'AI Fraud Detection Dashboard', shares: 234, engagement: 156 },
          { title: 'Secure Payment Processing', shares: 189, engagement: 123 },
          { title: 'Provider Directory', shares: 145, engagement: 98 },
          { title: 'Patient Records Management', shares: 98, engagement: 67 }
        ],
        user_demographics: {
          age_groups: { '18-24': 12, '25-34': 34, '35-44': 28, '45-54': 18, '55+': 8 },
          devices: { mobile: 58, desktop: 32, tablet: 10 },
          locations: { 'US': 45, 'UK': 12, 'Canada': 8, 'Australia': 6, 'Other': 29 }
        }
      };
      
      setAnalytics(enhancedAnalytics);
    } catch (error) {
      console.error('Error loading analytics:', error);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const generateTimeSeriesData = () => {
    const hours = selectedPeriod === '24h' ? 24 : selectedPeriod === '7d' ? 168 : 720;
    const data = [];
    
    for (let i = 0; i < hours; i += (selectedPeriod === '24h' ? 1 : 24)) {
      data.push({
        time: new Date(Date.now() - (hours - i) * 3600000).toISOString(),
        shares: Math.floor(Math.random() * 50) + 10,
        engagements: Math.floor(Math.random() * 100) + 20,
        clicks: Math.floor(Math.random() * 200) + 50
      });
    }
    
    return data;
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    loadAnalytics();
  };

  const getPlatformIcon = (platform) => {
    const icons = {
      facebook: 'f',
      twitter: 't',
      linkedin: 'in',
      whatsapp: 'w',
      telegram: 't',
      reddit: 'r',
      pinterest: 'p',
      email: '@'
    };
    return icons[platform] || platform[0];
  };

  const getPlatformColor = (platform) => {
    const colors = {
      facebook: '#1877f2',
      twitter: '#1da1f2',
      linkedin: '#0077b5',
      whatsapp: '#25d366',
      telegram: '#0088cc',
      reddit: '#ff4500',
      pinterest: '#bd081c',
      email: '#6b7280'
    };
    return colors[platform] || '#6b7280';
  };

  if (isLoading) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-700 rounded mb-4"></div>
          <div className="grid grid-cols-4 gap-4 mb-6">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-20 bg-slate-700 rounded"></div>
            ))}
          </div>
          <div className="h-40 bg-slate-700 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">Sharing Analytics</h3>
          <p className="text-gray-400 text-sm">Real-time social sharing performance metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="24h">Last 24 Hours</option>
            <option value="7d">Last 7 Days</option>
            <option value="30d">Last 30 Days</option>
          </select>
          
          <select
            value={selectedPlatform}
            onChange={(e) => setSelectedPlatform(e.target.value)}
            className="px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white text-sm"
          >
            <option value="all">All Platforms</option>
            <option value="facebook">Facebook</option>
            <option value="twitter">Twitter</option>
            <option value="linkedin">LinkedIn</option>
            <option value="whatsapp">WhatsApp</option>
          </select>
          
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="p-2 text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Share2 className="text-indigo-400" size={20} />
            <span className="text-green-400 text-xs">+12%</span>
          </div>
          <div className="text-2xl font-bold text-white">{analytics?.total_shares || 0}</div>
          <div className="text-gray-400 text-sm">Total Shares</div>
        </div>
        
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="text-green-400" size={20} />
            <span className="text-green-400 text-xs">+8%</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {analytics?.performance_metrics?.engagement_rate ? 
              `${Math.round(analytics.performance_metrics.engagement_rate * 100)}%` : '45%'
            }
          </div>
          <div className="text-gray-400 text-sm">Engagement Rate</div>
        </div>
        
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <TrendingUp className="text-blue-400" size={20} />
            <span className="text-green-400 text-xs">+15%</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {analytics?.performance_metrics?.conversion_rate ? 
              `${Math.round(analytics.performance_metrics.conversion_rate * 100)}%` : '68%'
            }
          </div>
          <div className="text-gray-400 text-sm">Conversion Rate</div>
        </div>
        
        <div className="bg-slate-900/50 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Clock className="text-purple-400" size={20} />
            <span className="text-red-400 text-xs">-5%</span>
          </div>
          <div className="text-2xl font-bold text-white">
            {analytics?.performance_metrics?.avg_share_time || '2.3'}s
          </div>
          <div className="text-gray-400 text-sm">Avg. Share Time</div>
        </div>
      </div>

      {/* Platform Performance */}
      <div className="mb-6">
        <h4 className="text-white font-semibold mb-4">Platform Performance</h4>
        <div className="space-y-3">
          {Object.entries(analytics?.platform_performance || {}).map(([platform, data]) => (
            <div key={platform} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{ backgroundColor: getPlatformColor(platform) }}
                >
                  {getPlatformIcon(platform)}
                </div>
                <div>
                  <div className="text-white capitalize">{platform}</div>
                  <div className="text-gray-400 text-xs">{data.shares} shares</div>
                </div>
              </div>
              
              <div className="flex items-center gap-6">
                <div className="text-center">
                  <div className="text-white text-sm">{data.engagement}</div>
                  <div className="text-gray-400 text-xs">Engaged</div>
                </div>
                <div className="text-center">
                  <div className="text-white text-sm">{data.clicks}</div>
                  <div className="text-gray-400 text-xs">Clicks</div>
                </div>
                <div className="text-center">
                  <div className="text-green-400 text-sm">{Math.round(data.conversion * 100)}%</div>
                  <div className="text-gray-400 text-xs">Conversion</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Top Content */}
      <div className="mb-6">
        <h4 className="text-white font-semibold mb-4">Most Shared Content</h4>
        <div className="space-y-3">
          {analytics?.top_content?.map((content, index) => (
            <div key={index} className="flex items-center justify-between p-3 bg-slate-900/30 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
                  {index + 1}
                </div>
                <div>
                  <div className="text-white">{content.title}</div>
                  <div className="text-gray-400 text-xs">{content.shares} shares</div>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1 text-gray-400">
                  <Heart size={14} />
                  <span className="text-sm">{content.engagement}</span>
                </div>
                <div className="flex items-center gap-1 text-gray-400">
                  <Eye size={14} />
                  <span className="text-sm">{Math.round(content.engagement * 2.5)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* User Demographics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <h4 className="text-white font-semibold mb-3">Age Groups</h4>
          <div className="space-y-2">
            {Object.entries(analytics?.user_demographics?.age_groups || {}).map(([age, percentage]) => (
              <div key={age} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{age}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-indigo-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-white text-sm w-8">{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-white font-semibold mb-3">Devices</h4>
          <div className="space-y-2">
            {Object.entries(analytics?.user_demographics?.devices || {}).map(([device, percentage]) => (
              <div key={device} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm capitalize">{device}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-white text-sm w-8">{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="text-white font-semibold mb-3">Top Locations</h4>
          <div className="space-y-2">
            {Object.entries(analytics?.user_demographics?.locations || {}).map(([location, percentage]) => (
              <div key={location} className="flex items-center justify-between">
                <span className="text-gray-300 text-sm">{location}</span>
                <div className="flex items-center gap-2">
                  <div className="w-20 bg-slate-700 rounded-full h-2">
                    <div 
                      className="bg-purple-500 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    ></div>
                  </div>
                  <span className="text-white text-sm w-8">{percentage}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SharingAnalytics;
