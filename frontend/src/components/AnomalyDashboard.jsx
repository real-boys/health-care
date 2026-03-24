import React, { useState, useEffect } from 'react';
import { AlertTriangle, Brain, TrendingUp, Clock, User, Search, Filter, Download, CheckCircle, XCircle, Eye } from 'lucide-react';
import axios from 'axios';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const AnomalyDashboard = () => {
  const [anomalies, setAnomalies] = useState([]);
  const [patterns, setPatterns] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    severity: '',
    investigated: '',
    false_positive: '',
    start_date: '',
    end_date: ''
  });
  const [selectedAnomaly, setSelectedAnomaly] = useState(null);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchAnomalies();
    fetchAnomalyStats();
  }, []);

  const fetchAnomalies = async () => {
    setLoading(true);
    try {
      const params = { ...filters };
      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const response = await axios.get('/api/audit/anomalies', { params });
      setAnomalies(response.data.data);
    } catch (error) {
      console.error('Error fetching anomalies:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnomalyStats = async () => {
    try {
      // This would be a new endpoint for anomaly statistics
      // For now, we'll calculate from the anomalies we have
      const response = await axios.get('/api/audit/anomalies', { params: { limit: 1000 } });
      const allAnomalies = response.data.data;
      
      const stats = {
        total: allAnomalies.length,
        critical: allAnomalies.filter(a => a.severity === 'CRITICAL').length,
        high: allAnomalies.filter(a => a.severity === 'HIGH').length,
        medium: allAnomalies.filter(a => a.severity === 'MEDIUM').length,
        low: allAnomalies.filter(a => a.severity === 'LOW').length,
        investigated: allAnomalies.filter(a => a.investigated).length,
        false_positives: allAnomalies.filter(a => a.false_positive).length,
        avg_confidence: allAnomalies.reduce((sum, a) => sum + a.confidence_score, 0) / allAnomalies.length || 0
      };
      
      setStats(stats);
    } catch (error) {
      console.error('Error fetching anomaly stats:', error);
    }
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const applyFilters = () => {
    fetchAnomalies();
  };

  const resetFilters = () => {
    setFilters({
      severity: '',
      investigated: '',
      false_positive: '',
      start_date: '',
      end_date: ''
    });
    fetchAnomalies();
  };

  const updateAnomalyInvestigation = async (anomalyId, investigated, investigationNotes, falsePositive) => {
    try {
      await axios.put(`/api/audit/anomalies/${anomalyId}/investigate`, {
        investigated,
        investigation_notes: investigationNotes,
        false_positive: falsePositive
      });
      
      fetchAnomalies();
      fetchAnomalyStats();
      setSelectedAnomaly(null);
    } catch (error) {
      console.error('Error updating anomaly investigation:', error);
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'LOW': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getConfidenceColor = (score) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    if (score >= 0.4) return 'text-orange-600';
    return 'text-red-600';
  };

  const formatDate = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  const exportAnomalies = async (format = 'CSV') => {
    try {
      const params = {
        ...filters,
        format,
        start_date: filters.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        end_date: filters.end_date || new Date().toISOString()
      };

      Object.keys(params).forEach(key => {
        if (params[key] === '' || params[key] === null) {
          delete params[key];
        }
      });

      const response = await axios.post('/api/audit/export', params, {
        responseType: format === 'CSV' ? 'blob' : 'json'
      });

      if (format === 'CSV') {
        const blob = new Blob([response.data], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `anomalies_${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting anomalies:', error);
    }
  };

  const COLORS = ['#EF4444', '#F59E0B', '#10B981', '#3B82F6'];

  if (loading && anomalies.length === 0) {
    return (
      <div className="p-6 bg-gray-50 min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading anomaly detection dashboard...</p>
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
              <h1 className="text-2xl font-bold text-gray-900">Anomaly Detection Dashboard</h1>
              <p className="text-gray-600 mt-1">AI-powered anomaly detection and investigation</p>
            </div>
            <div className="flex space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Filter className="w-4 h-4 mr-2" />
                Filters
              </button>
              <button
                onClick={() => exportAnomalies('CSV')}
                className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </button>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-6">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Total Anomalies</p>
                  <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <Brain className="w-6 h-6 text-blue-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Critical/High</p>
                  <p className="text-2xl font-bold text-red-600 mt-1">{stats.critical + stats.high}</p>
                </div>
                <div className="p-3 bg-red-50 rounded-lg">
                  <AlertTriangle className="w-6 h-6 text-red-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Investigated</p>
                  <p className="text-2xl font-bold text-green-600 mt-1">{stats.investigated}</p>
                </div>
                <div className="p-3 bg-green-50 rounded-lg">
                  <Eye className="w-6 h-6 text-green-600" />
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-sm p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600">Avg Confidence</p>
                  <p className={`text-2xl font-bold mt-1 ${getConfidenceColor(stats.avg_confidence)}`}>
                    {(stats.avg_confidence * 100).toFixed(1)}%
                  </p>
                </div>
                <div className="p-3 bg-purple-50 rounded-lg">
                  <TrendingUp className="w-6 h-6 text-purple-600" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold mb-4">Anomaly Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => handleFilterChange('severity', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="HIGH">High</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="LOW">Low</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Investigation Status</label>
                <select
                  value={filters.investigated}
                  onChange={(e) => handleFilterChange('investigated', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Status</option>
                  <option value="true">Investigated</option>
                  <option value="false">Not Investigated</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">False Positive</label>
                <select
                  value={filters.false_positive}
                  onChange={(e) => handleFilterChange('false_positive', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All</option>
                  <option value="true">False Positive</option>
                  <option value="false">Valid Anomaly</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                <input
                  type="datetime-local"
                  value={filters.start_date}
                  onChange={(e) => handleFilterChange('start_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                <input
                  type="datetime-local"
                  value={filters.end_date}
                  onChange={(e) => handleFilterChange('end_date', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={resetFilters}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Reset
              </button>
              <button
                onClick={applyFilters}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply Filters
              </button>
            </div>
          </div>
        )}

        {/* Severity Distribution Chart */}
        {stats && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Severity Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Critical', value: stats.critical },
                    { name: 'High', value: stats.high },
                    { name: 'Medium', value: stats.medium },
                    { name: 'Low', value: stats.low }
                  ]}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
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
        )}

        {/* Anomalies List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Detected Anomalies</h3>
              <span className="text-sm text-gray-500">
                {anomalies.length} anomalies found
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Pattern
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Description
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Confidence
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {anomalies.map((anomaly) => (
                  <tr key={anomaly.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {formatDate(anomaly.created_at)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{anomaly.pattern_name}</div>
                        <div className="text-sm text-gray-500">{anomaly.pattern_description}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-gray-900 max-w-xs truncate">
                        {anomaly.description}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getSeverityColor(anomaly.severity)}`}>
                        {anomaly.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="text-sm font-medium text-gray-900">
                          {(anomaly.confidence_score * 100).toFixed(1)}%
                        </div>
                        <div className={`ml-2 w-2 h-2 rounded-full ${getConfidenceColor(anomaly.confidence_score).replace('text-', 'bg-')}`}></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex space-x-2">
                        {anomaly.investigated && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Investigated
                          </span>
                        )}
                        {anomaly.false_positive && (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            <XCircle className="w-3 h-3 mr-1" />
                            False Positive
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <button
                        onClick={() => setSelectedAnomaly(anomaly)}
                        className="text-blue-600 hover:text-blue-900"
                      >
                        Investigate
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {anomalies.length === 0 && (
            <div className="px-6 py-12 text-center text-gray-500">
              No anomalies found matching your criteria
            </div>
          )}
        </div>

        {/* Investigation Modal */}
        {selectedAnomaly && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-xl font-semibold">Investigate Anomaly</h3>
                  <button
                    onClick={() => setSelectedAnomaly(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <XCircle className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className={`p-4 border rounded-lg ${getSeverityColor(selectedAnomaly.severity)}`}>
                    <h4 className="font-semibold mb-2">{selectedAnomaly.pattern_name}</h4>
                    <p className="text-sm mb-2">{selectedAnomaly.description}</p>
                    <div className="flex justify-between text-sm">
                      <span>Severity: {selectedAnomaly.severity}</span>
                      <span>Confidence: {(selectedAnomaly.confidence_score * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Investigation Notes</label>
                    <textarea
                      id="investigation-notes"
                      rows={4}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter investigation notes..."
                    />
                  </div>

                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="false-positive"
                      className="mr-2"
                    />
                    <label htmlFor="false-positive" className="text-sm text-gray-700">
                      Mark as false positive
                    </label>
                  </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                  <button
                    onClick={() => setSelectedAnomaly(null)}
                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const notes = document.getElementById('investigation-notes').value;
                      const falsePositive = document.getElementById('false-positive').checked;
                      updateAnomalyInvestigation(selectedAnomaly.id, true, notes, falsePositive);
                    }}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Save Investigation
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyDashboard;
