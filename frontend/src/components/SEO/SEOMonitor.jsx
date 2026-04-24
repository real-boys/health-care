import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, AlertCircle, CheckCircle, Clock, Globe, Smartphone, Monitor } from 'lucide-react';

const SEOMonitor = () => {
  const [metrics, setMetrics] = useState({
    pageLoadTime: 0,
    metaTagsScore: 0,
    structuredDataScore: 0,
    mobileFriendly: true,
    coreWebVitals: {
      lcp: 0,
      fid: 0,
      cls: 0
    },
    indexedPages: 0,
    crawlErrors: 0,
    searchRankings: {}
  });

  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  useEffect(() => {
    const fetchSEOMetrics = async () => {
      // Simulate API call to fetch SEO metrics
      setTimeout(() => {
        setMetrics({
          pageLoadTime: Math.random() * 2 + 0.5, // 0.5-2.5 seconds
          metaTagsScore: Math.floor(Math.random() * 20 + 80), // 80-100%
          structuredDataScore: Math.floor(Math.random() * 15 + 85), // 85-100%
          mobileFriendly: true,
          coreWebVitals: {
            lcp: Math.random() * 1.5 + 1.5, // 1.5-3.0s
            fid: Math.random() * 50 + 50, // 50-100ms
            cls: Math.random() * 0.1 + 0.05 // 0.05-0.15
          },
          indexedPages: Math.floor(Math.random() * 10 + 90), // 90-100 pages
          crawlErrors: Math.floor(Math.random() * 3), // 0-2 errors
          searchRankings: {
            'healthcare insurance': Math.floor(Math.random() * 5 + 3), // 3-7
            'fraud detection': Math.floor(Math.random() * 3 + 1), // 1-3
            'patient management': Math.floor(Math.random() * 10 + 5), // 5-14
            'healthcare analytics': Math.floor(Math.random() * 8 + 4) // 4-11
          }
        });
        setLoading(false);
        setLastUpdated(new Date());
      }, 1000);
    };

    fetchSEOMetrics();
    const interval = setInterval(fetchSEOMetrics, 30000); // Update every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getScoreColor = (score) => {
    if (score >= 90) return 'text-green-400';
    if (score >= 75) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getVitalStatus = (value, threshold, type) => {
    if (type === 'cls') {
      return value <= threshold ? 'good' : value <= threshold * 2 ? 'needs-improvement' : 'poor';
    }
    return value <= threshold ? 'good' : value <= threshold * 2 ? 'needs-improvement' : 'poor';
  };

  const getVitalColor = (status) => {
    switch (status) {
      case 'good': return 'text-green-400';
      case 'needs-improvement': return 'text-yellow-400';
      case 'poor': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">SEO Performance Monitor</h2>
          <p className="text-gray-400">Real-time SEO metrics and optimization insights</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-400">
          <Clock size={16} />
          Last updated: {lastUpdated.toLocaleTimeString()}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Page Load Time</span>
            <Monitor size={16} className="text-gray-500" />
          </div>
          <div className="text-2xl font-bold text-white mb-1">
            {metrics.pageLoadTime.toFixed(2)}s
          </div>
          <div className={`text-sm ${metrics.pageLoadTime < 2 ? 'text-green-400' : 'text-yellow-400'}`}>
            {metrics.pageLoadTime < 2 ? 'Good' : 'Needs Improvement'}
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Meta Tags Score</span>
            <Globe size={16} className="text-gray-500" />
          </div>
          <div className={`text-2xl font-bold mb-1 ${getScoreColor(metrics.metaTagsScore)}`}>
            {metrics.metaTagsScore}%
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
              style={{ width: `${metrics.metaTagsScore}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Structured Data</span>
            <Search size={16} className="text-gray-500" />
          </div>
          <div className={`text-2xl font-bold mb-1 ${getScoreColor(metrics.structuredDataScore)}`}>
            {metrics.structuredDataScore}%
          </div>
          <div className="w-full bg-slate-700 rounded-full h-2">
            <div 
              className="bg-gradient-to-r from-green-500 to-emerald-500 h-2 rounded-full"
              style={{ width: `${metrics.structuredDataScore}%` }}
            ></div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-gray-400 text-sm">Mobile Friendly</span>
            <Smartphone size={16} className="text-gray-500" />
          </div>
          <div className="flex items-center gap-2">
            {metrics.mobileFriendly ? (
              <>
                <CheckCircle size={20} className="text-green-400" />
                <span className="text-green-400 font-semibold">Optimized</span>
              </>
            ) : (
              <>
                <AlertCircle size={20} className="text-red-400" />
                <span className="text-red-400 font-semibold">Issues Found</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Core Web Vitals */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Core Web Vitals</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Largest Contentful Paint (LCP)</span>
              <span className={`text-sm font-semibold ${getVitalColor(getVitalStatus(metrics.coreWebVitals.lcp, 2.5, 'lcp'))}`}>
                {getVitalStatus(metrics.coreWebVitals.lcp, 2.5, 'lcp').replace('-', ' ')}
              </span>
            </div>
            <div className="text-xl font-bold text-white mb-2">
              {metrics.coreWebVitals.lcp.toFixed(2)}s
            </div>
            <div className="text-xs text-gray-500">Target: &lt;2.5s</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">First Input Delay (FID)</span>
              <span className={`text-sm font-semibold ${getVitalColor(getVitalStatus(metrics.coreWebVitals.fid, 100, 'fid'))}`}>
                {getVitalStatus(metrics.coreWebVitals.fid, 100, 'fid').replace('-', ' ')}
              </span>
            </div>
            <div className="text-xl font-bold text-white mb-2">
              {metrics.coreWebVitals.fid.toFixed(0)}ms
            </div>
            <div className="text-xs text-gray-500">Target: &lt;100ms</div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-gray-400 text-sm">Cumulative Layout Shift (CLS)</span>
              <span className={`text-sm font-semibold ${getVitalColor(getVitalStatus(metrics.coreWebVitals.cls, 0.1, 'cls'))}`}>
                {getVitalStatus(metrics.coreWebVitals.cls, 0.1, 'cls').replace('-', ' ')}
              </span>
            </div>
            <div className="text-xl font-bold text-white mb-2">
              {metrics.coreWebVitals.cls.toFixed(3)}
            </div>
            <div className="text-xs text-gray-500">Target: &lt;0.1</div>
          </div>
        </div>
      </div>

      {/* Search Rankings */}
      <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-white mb-4">Search Rankings</h3>
        <div className="space-y-3">
          {Object.entries(metrics.searchRankings).map(([keyword, rank]) => (
            <div key={keyword} className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TrendingUp size={16} className="text-indigo-400" />
                <span className="text-gray-300">{keyword}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className={`font-bold ${rank <= 3 ? 'text-green-400' : rank <= 10 ? 'text-yellow-400' : 'text-gray-400'}`}>
                  #{rank}
                </span>
                <span className="text-xs text-gray-500">
                  {rank <= 3 ? 'Top 3' : rank <= 10 ? 'Top 10' : 'Top 100'}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Index Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Index Status</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Indexed Pages</span>
              <span className="text-green-400 font-bold">{metrics.indexedPages}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Crawl Errors</span>
              <span className={`${metrics.crawlErrors > 0 ? 'text-red-400' : 'text-green-400'} font-bold`}>
                {metrics.crawlErrors}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="space-y-2">
            <button className="w-full px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors">
              Generate Sitemap
            </button>
            <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              Validate Structured Data
            </button>
            <button className="w-full px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors">
              Check Meta Tags
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SEOMonitor;
