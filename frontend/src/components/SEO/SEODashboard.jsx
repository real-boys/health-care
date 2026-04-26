import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, AlertCircle, CheckCircle, Settings, Download, RefreshCw, Eye, BarChart3, Globe, Smartphone, Monitor, FileText, Users, DollarSign, Shield } from 'lucide-react';
import SEOMonitor from './SEOMonitor';

const SEODashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [seoData, setSeoData] = useState({
    overview: {
      totalPages: 6,
      indexedPages: 94,
      organicTraffic: 1250,
      avgPosition: 12.5,
      clickRate: 3.2,
      impressions: 8900
    },
    pages: [
      { path: '/', title: 'AEGIS Health Systems', indexed: true, issues: 0, lastCrawled: '2024-01-15' },
      { path: '/patients', title: 'Patient Records Management', indexed: true, issues: 1, lastCrawled: '2024-01-14' },
      { path: '/providers', title: 'Provider Directory', indexed: true, issues: 0, lastCrawled: '2024-01-15' },
      { path: '/payments', title: 'Payment Analytics', indexed: true, issues: 2, lastCrawled: '2024-01-13' },
      { path: '/fraud', title: 'Fraud Detection System', indexed: true, issues: 0, lastCrawled: '2024-01-15' },
      { path: '/notifications', title: 'Notification Center', indexed: false, issues: 3, lastCrawled: '2024-01-12' }
    ],
    keywords: [
      { keyword: 'healthcare insurance', position: 5, traffic: 450, trend: 'up' },
      { keyword: 'fraud detection healthcare', position: 3, traffic: 320, trend: 'up' },
      { keyword: 'patient management system', position: 8, traffic: 280, trend: 'stable' },
      { keyword: 'healthcare analytics', position: 12, traffic: 190, trend: 'down' },
      { keyword: 'medical insurance platform', position: 7, traffic: 210, trend: 'up' }
    ],
    issues: [
      { type: 'error', message: 'Missing meta description on /notifications', severity: 'high' },
      { type: 'warning', message: 'Images missing alt tags on /payments', severity: 'medium' },
      { type: 'info', message: 'Consider adding more internal links', severity: 'low' },
      { type: 'warning', message: 'Page load speed could be improved', severity: 'medium' }
    ]
  });

  const [loading, setLoading] = useState(false);

  const handleRefresh = async () => {
    setLoading(true);
    // Simulate API call
    setTimeout(() => {
      setLoading(false);
    }, 2000);
  };

  const exportReport = () => {
    const reportData = {
      timestamp: new Date().toISOString(),
      ...seoData
    };
    
    const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `seo-report-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getIssueIcon = (type) => {
    switch (type) {
      case 'error': return <AlertCircle size={16} className="text-red-400" />;
      case 'warning': return <AlertCircle size={16} className="text-yellow-400" />;
      case 'info': return <AlertCircle size={16} className="text-blue-400" />;
      default: return <AlertCircle size={16} className="text-gray-400" />;
    }
  };

  const getTrendIcon = (trend) => {
    switch (trend) {
      case 'up': return <TrendingUp size={14} className="text-green-400" />;
      case 'down': return <TrendingUp size={14} className="text-red-400 rotate-180" />;
      case 'stable': return <div className="w-3 h-0.5 bg-gray-400 rounded-full"></div>;
      default: return null;
    }
  };

  const tabs = [
    { id: 'overview', label: 'Overview', icon: <BarChart3 size={16} /> },
    { id: 'monitor', label: 'Performance Monitor', icon: <Monitor size={16} /> },
    { id: 'pages', label: 'Pages', icon: <FileText size={16} /> },
    { id: 'keywords', label: 'Keywords', icon: <Search size={16} /> },
    { id: 'issues', label: 'Issues', icon: <AlertCircle size={16} /> }
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white mb-2">SEO Dashboard</h2>
          <p className="text-gray-400">Comprehensive SEO optimization and monitoring</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={exportReport}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
          >
            <Download size={16} />
            Export Report
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-1 bg-slate-800/50 rounded-lg p-1">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-indigo-600 text-white'
                : 'text-gray-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Key Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Total Pages</span>
                <FileText size={16} className="text-gray-500" />
              </div>
              <div className="text-2xl font-bold text-white">{seoData.overview.totalPages}</div>
              <div className="text-sm text-gray-400">Active pages</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Indexed Pages</span>
                <Eye size={16} className="text-gray-500" />
              </div>
              <div className="text-2xl font-bold text-white">{seoData.overview.indexedPages}%</div>
              <div className="text-sm text-green-400">Search visibility</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Organic Traffic</span>
                <Users size={16} className="text-gray-500" />
              </div>
              <div className="text-2xl font-bold text-white">{seoData.overview.organicTraffic}</div>
              <div className="text-sm text-gray-400">Monthly visitors</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Avg Position</span>
                <TrendingUp size={16} className="text-gray-500" />
              </div>
              <div className="text-2xl font-bold text-white">{seoData.overview.avgPosition}</div>
              <div className="text-sm text-yellow-400">Search ranking</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Click Rate</span>
                <Globe size={16} className="text-gray-500" />
              </div>
              <div className="text-2xl font-bold text-white">{seoData.overview.clickRate}%</div>
              <div className="text-sm text-gray-400">Engagement rate</div>
            </div>

            <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-gray-400 text-sm">Impressions</span>
                <BarChart3 size={16} className="text-gray-500" />
              </div>
              <div className="text-2xl font-bold text-white">{seoData.overview.impressions.toLocaleString()}</div>
              <div className="text-sm text-gray-400">Total views</div>
            </div>
          </div>

          {/* Recent Issues */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-white mb-4">Recent Issues</h3>
            <div className="space-y-3">
              {seoData.issues.slice(0, 3).map((issue, index) => (
                <div key={index} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-lg">
                  {getIssueIcon(issue.type)}
                  <span className="text-gray-300 flex-1">{issue.message}</span>
                  <span className={`text-xs px-2 py-1 rounded ${
                    issue.severity === 'high' ? 'bg-red-900/50 text-red-400' :
                    issue.severity === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                    'bg-blue-900/50 text-blue-400'
                  }`}>
                    {issue.severity}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === 'monitor' && <SEOMonitor />}

      {activeTab === 'pages' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Page Analysis</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="pb-3 text-gray-400 font-medium">Page</th>
                  <th className="pb-3 text-gray-400 font-medium">Title</th>
                  <th className="pb-3 text-gray-400 font-medium">Indexed</th>
                  <th className="pb-3 text-gray-400 font-medium">Issues</th>
                  <th className="pb-3 text-gray-400 font-medium">Last Crawled</th>
                </tr>
              </thead>
              <tbody>
                {seoData.pages.map((page, index) => (
                  <tr key={index} className="border-b border-slate-700/50">
                    <td className="py-3 text-gray-300 font-mono text-sm">{page.path}</td>
                    <td className="py-3 text-gray-300">{page.title}</td>
                    <td className="py-3">
                      {page.indexed ? (
                        <CheckCircle size={16} className="text-green-400" />
                      ) : (
                        <AlertCircle size={16} className="text-red-400" />
                      )}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs ${
                        page.issues === 0 ? 'bg-green-900/50 text-green-400' :
                        page.issues <= 2 ? 'bg-yellow-900/50 text-yellow-400' :
                        'bg-red-900/50 text-red-400'
                      }`}>
                        {page.issues} issues
                      </span>
                    </td>
                    <td className="py-3 text-gray-400 text-sm">{page.lastCrawled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeTab === 'keywords' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Keyword Performance</h3>
          <div className="space-y-4">
            {seoData.keywords.map((keyword, index) => (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-900/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <Search size={16} className="text-indigo-400" />
                  <div>
                    <div className="text-white font-medium">{keyword.keyword}</div>
                    <div className="text-gray-400 text-sm">{keyword.traffic} monthly visits</div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {getTrendIcon(keyword.trend)}
                    <span className="text-white font-bold">#{keyword.position}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-gray-400 text-sm">Traffic</div>
                    <div className="text-white">{keyword.traffic}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'issues' && (
        <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">SEO Issues & Recommendations</h3>
          <div className="space-y-3">
            {seoData.issues.map((issue, index) => (
              <div key={index} className="flex items-start gap-3 p-4 bg-slate-900/50 rounded-lg">
                {getIssueIcon(issue.type)}
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-white">{issue.message}</span>
                    <span className={`text-xs px-2 py-1 rounded ${
                      issue.severity === 'high' ? 'bg-red-900/50 text-red-400' :
                      issue.severity === 'medium' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-blue-900/50 text-blue-400'
                    }`}>
                      {issue.severity}
                    </span>
                  </div>
                  <div className="text-gray-400 text-sm">
                    {issue.severity === 'high' && 'This issue should be addressed immediately as it impacts search visibility.'}
                    {issue.severity === 'medium' && 'This issue affects SEO performance and should be resolved soon.'}
                    {issue.severity === 'low' && 'This is a minor optimization opportunity.'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SEODashboard;
