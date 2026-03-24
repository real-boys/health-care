import React, { useState, useEffect } from 'react';
import { Shield, AlertTriangle, TrendingUp, Users, Activity, Download, Calendar, Filter, ChevronUp, ChevronDown } from 'lucide-react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const ComplianceDashboard = () => {
  const [metrics, setMetrics] = useState(null);
  const [operations, setOperations] = useState([]);
  const [topUsers, setTopUsers] = useState([]);
  const [violations, setViolations] = useState([]);
  const [anomalies, setAnomalies] = useState([]);
  const [timeframe, setTimeframe] = useState('24h');
  const [loading, setLoading] = useState(true);
  const [expandedSection, setExpandedSection] = useState('overview');

  useEffect(() => {
    fetchDashboardData();
  }, [timeframe]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [metricsRes, violationsRes, anomaliesRes] = await Promise.all([
        axios.get(`/api/audit/metrics?timeframe=${timeframe}`),
        axios.get('/api/audit/violations', { params: { limit: 10 } }),
        axios.get('/api/audit/anomalies', { params: { limit: 10 } })
      ]);

      setMetrics(metricsRes.data.data);
      setOperations(metricsRes.data.data.operations_breakdown || []);
      setTopUsers(metricsRes.data.data.top_users || []);
      setViolations(violationsRes.data.data || []);
      setAnomalies(anomaliesRes.data.data || []);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateReport = async (reportType) => {
    try {
      const endDate = new Date().toISOString();
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

      const response = await axios.post('/api/audit/reports', {
        report_type: reportType,
        start_date: startDate,
        end_date: endDate,
        format: 'JSON'
      });

      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_compliance_report_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error generating report:', error);
    }
  };

  const getComplianceScore = () => {
    if (!metrics?.metrics) return 0;
    const { total_operations, failed_operations, high_risk_operations } = metrics.metrics;
    if (total_operations === 0) return 100;
    
    const successRate = ((total_operations - failed_operations) / total_operations) * 100;
    const riskPenalty = (high_risk_operations / total_operations) * 20;
    
    return Math.max(0, Math.min(100, successRate - riskPenalty));
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50';
      case 'HIGH': return 'text-orange-600 bg-orange-50';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50';
      case 'LOW': return 'text-green-600 bg-green-50';
      default: return 'text-gray-600 bg-gray-50';
    }
  };

  const getRiskLevelColor = (score) => {
    if (score >= 90) return 'text-red-600';
    if (score >= 70) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  if (loading) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading compliance dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Compliance Dashboard</h1>
              <p className="text-gray-600 mt-1">Real-time monitoring and compliance metrics</p>
            </div>
            <div className="flex items-center space-x-4">
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="1h">Last Hour</option>
                <option value="24h">Last 24 Hours</option>
                <option value="7d">Last 7 Days</option>
                <option value="30d">Last 30 Days</option>
              </select>
              <button
                onClick={() => fetchDashboardData()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Compliance Score</p>
                <p className={`text-2xl font-bold mt-1 ${getRiskLevelColor(getComplianceScore())}`}>
                  {getComplianceScore().toFixed(1)}%
                </p>
              </div>
              <div className="p-3 bg-blue-50 rounded-lg">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Operations</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics?.metrics?.total_operations || 0}
                </p>
              </div>
              <div className="p-3 bg-green-50 rounded-lg">
                <Activity className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">High Risk Events</p>
                <p className="text-2xl font-bold text-orange-600 mt-1">
                  {metrics?.metrics?.high_risk_operations || 0}
                </p>
              </div>
              <div className="p-3 bg-orange-50 rounded-lg">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Users</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {metrics?.metrics?.unique_users || 0}
                </p>
              </div>
              <div className="p-3 bg-purple-50 rounded-lg">
                <Users className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Charts Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Operations Breakdown Chart */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Operations Breakdown</h3>
              <button
                onClick={() => setExpandedSection(expandedSection === 'operations' ? '' : 'operations')}
                className="text-gray-400 hover:text-gray-600"
              >
                {expandedSection === 'operations' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={operations.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="action" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Risk Score Distribution */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Risk Score Distribution</h3>
              <button
                onClick={() => setExpandedSection(expandedSection === 'risk' ? '' : 'risk')}
                className="text-gray-400 hover:text-gray-600"
              >
                {expandedSection === 'risk' ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
              </button>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Low Risk (0-39)', value: 0 }, // Would calculate from actual data
                    { name: 'Medium Risk (40-69)', value: 0 },
                    { name: 'High Risk (70-89)', value: metrics?.metrics?.high_risk_operations || 0 },
                    { name: 'Critical (90-100)', value: metrics?.metrics?.critical_operations || 0 }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {COLORS.map((color, index) => (
                    <Cell key={`cell-${index}`} fill={color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Alerts and Violations */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Recent Violations */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Recent Violations</h3>
              <button
                onClick={() => generateReport('HIPAA')}
                className="text-blue-600 hover:text-blue-900"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {violations.slice(0, 5).map((violation) => (
                <div key={violation.id} className="border-l-4 border-red-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{violation.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(violation.created_at).toLocaleString()}
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(violation.severity)}`}>
                      {violation.severity}
                    </span>
                  </div>
                </div>
              ))}
              {violations.length === 0 && (
                <p className="text-gray-500 text-center py-4">No violations found</p>
              )}
            </div>
          </div>

          {/* Recent Anomalies */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Detected Anomalies</h3>
              <button
                onClick={() => generateReport('SECURITY')}
                className="text-blue-600 hover:text-blue-900"
              >
                <Download className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              {anomalies.slice(0, 5).map((anomaly) => (
                <div key={anomaly.id} className="border-l-4 border-yellow-500 pl-4 py-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-medium text-gray-900">{anomaly.description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        Confidence: {(anomaly.confidence_score * 100).toFixed(1)}%
                      </p>
                    </div>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                      {anomaly.severity}
                    </span>
                  </div>
                </div>
              ))}
              {anomalies.length === 0 && (
                <p className="text-gray-500 text-center py-4">No anomalies detected</p>
              )}
            </div>
          </div>
        </div>

        {/* Top Users Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top User Activity</h3>
            <button
              onClick={() => generateReport('USER_ACTIVITY')}
              className="text-blue-600 hover:text-blue-900"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User ID
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Operations
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Avg Risk Score
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Failed Operations
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {topUsers.slice(0, 10).map((user, index) => (
                  <tr key={user.user_id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {user.user_id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.user_role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.total_operations}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${getRiskLevelColor(user.avg_risk_score)}`}>
                        {user.avg_risk_score?.toFixed(1) || 0}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {user.failed_operations}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={() => generateReport('HIPAA')}
              className="flex items-center justify-center px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              Generate HIPAA Report
            </button>
            <button
              onClick={() => generateReport('GDPR')}
              className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              Generate GDPR Report
            </button>
            <button
              onClick={() => generateReport('SECURITY')}
              className="flex items-center justify-center px-4 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
            >
              <Download className="w-5 h-5 mr-2" />
              Generate Security Report
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ComplianceDashboard;
