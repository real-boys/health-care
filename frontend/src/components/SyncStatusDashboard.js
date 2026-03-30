import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Clock,
  RefreshCw,
  Filter,
  Download,
  Eye,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Calendar,
  Search,
  X
} from 'lucide-react';

const SyncStatusDashboard = () => {
  const [syncStatus, setSyncStatus] = useState([]);
  const [filteredStatus, setFilteredStatus] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [filters, setFilters] = useState({
    status: 'all',
    dateRange: '24h',
    search: ''
  });
  const [metrics, setMetrics] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    successRate: 0
  });

  // Sample data for demonstration
  const sampleSyncData = [
    {
      id: 1,
      configName: 'Hospital EHR Integration',
      status: 'completed',
      startTime: '2024-01-15T10:30:00Z',
      endTime: '2024-01-15T10:32:15Z',
      duration: 135000,
      recordCount: 150,
      processedCount: 148,
      errorCount: 2,
      errorMessage: null,
      sourceSystem: 'Epic Systems',
      targetSystem: 'FHIR Server',
      messageType: 'ADT^A04',
      metadata: {
        version: 'v2.5',
        facility: 'Main Hospital',
        department: 'Emergency'
      }
    },
    {
      id: 2,
      configName: 'Lab System FHIR',
      status: 'in_progress',
      startTime: '2024-01-15T11:00:00Z',
      endTime: null,
      duration: null,
      recordCount: 75,
      processedCount: 45,
      errorCount: 0,
      errorMessage: null,
      sourceSystem: 'Laboratory System',
      targetSystem: 'FHIR Server',
      messageType: 'ORU^R01',
      metadata: {
        version: 'v2.5',
        facility: 'Main Hospital',
        department: 'Laboratory'
      }
    },
    {
      id: 3,
      configName: 'Radiology Integration',
      status: 'failed',
      startTime: '2024-01-15T09:15:00Z',
      endTime: '2024-01-15T09:16:30Z',
      duration: 90000,
      recordCount: 25,
      processedCount: 0,
      errorCount: 25,
      errorMessage: 'Connection timeout: Unable to connect to radiology system',
      sourceSystem: 'Radiology System',
      targetSystem: 'FHIR Server',
      messageType: 'ORM^O01',
      metadata: {
        version: 'v2.5',
        facility: 'Main Hospital',
        department: 'Radiology'
      }
    },
    {
      id: 4,
      configName: 'Pharmacy System',
      status: 'completed',
      startTime: '2024-01-15T08:45:00Z',
      endTime: '2024-01-15T08:46:45Z',
      duration: 105000,
      recordCount: 50,
      processedCount: 50,
      errorCount: 0,
      errorMessage: null,
      sourceSystem: 'Pharmacy System',
      targetSystem: 'FHIR Server',
      messageType: 'RDE^O01',
      metadata: {
        version: 'v2.5',
        facility: 'Main Hospital',
        department: 'Pharmacy'
      }
    },
    {
      id: 5,
      configName: 'Billing System',
      status: 'pending',
      startTime: null,
      endTime: null,
      duration: null,
      recordCount: 100,
      processedCount: 0,
      errorCount: 0,
      errorMessage: null,
      sourceSystem: 'Billing System',
      targetSystem: 'FHIR Server',
      messageType: 'DFT^P03',
      metadata: {
        version: 'v2.5',
        facility: 'Main Hospital',
        department: 'Billing'
      }
    }
  ];

  useEffect(() => {
    fetchSyncStatus();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [syncStatus, filters]);

  const fetchSyncStatus = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setSyncStatus(sampleSyncData);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...syncStatus];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter(item => item.status === filters.status);
    }

    // Date range filter
    const now = new Date();
    const cutoffTime = new Date();
    
    switch (filters.dateRange) {
      case '1h':
        cutoffTime.setHours(now.getHours() - 1);
        break;
      case '24h':
        cutoffTime.setDate(now.getDate() - 1);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(now.getDate() - 30);
        break;
    }

    if (filters.dateRange !== 'all') {
      filtered = filtered.filter(item => 
        item.startTime && new Date(item.startTime) >= cutoffTime
      );
    }

    // Search filter
    if (filters.search) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter(item =>
        item.configName.toLowerCase().includes(searchTerm) ||
        item.sourceSystem.toLowerCase().includes(searchTerm) ||
        item.targetSystem.toLowerCase().includes(searchTerm) ||
        item.messageType.toLowerCase().includes(searchTerm)
      );
    }

    setFilteredStatus(filtered);
    calculateMetrics(filtered);
  };

  const calculateMetrics = (data) => {
    const total = data.length;
    const completed = data.filter(item => item.status === 'completed').length;
    const failed = data.filter(item => item.status === 'failed').length;
    const inProgress = data.filter(item => item.status === 'in_progress').length;
    
    const successRate = total > 0 ? ((completed / total) * 100).toFixed(1) : 0;

    setMetrics({
      total,
      completed,
      failed,
      inProgress,
      successRate
    });
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'in_progress':
        return <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />;
      case 'failed':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-gray-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (duration) => {
    if (!duration) return '-';
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    
    if (hours > 0) {
      return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds % 60}s`;
    } else {
      return `${seconds}s`;
    }
  };

  const handleExportData = () => {
    // Export functionality
    const csvContent = [
      ['Configuration', 'Status', 'Start Time', 'End Time', 'Duration', 'Records', 'Processed', 'Errors'],
      ...filteredStatus.map(item => [
        item.configName,
        item.status,
        item.startTime,
        item.endTime || '-',
        formatDuration(item.duration),
        item.recordCount,
        item.processedCount,
        item.errorCount
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sync-status-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const handleRetrySync = async (syncId) => {
    try {
      // API call to retry sync
      console.log('Retrying sync:', syncId);
      await fetchSyncStatus();
    } catch (error) {
      console.error('Error retrying sync:', error);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Sync Status Dashboard</h1>
              <p className="mt-2 text-gray-600">Monitor and manage data synchronization activities</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={handleExportData}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
              <button
                onClick={fetchSyncStatus}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Syncs</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total}</p>
              </div>
              <Activity className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Completed</p>
                <p className="text-2xl font-bold text-green-600">{metrics.completed}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">In Progress</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.inProgress}</p>
              </div>
              <RefreshCw className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Failed</p>
                <p className="text-2xl font-bold text-red-600">{metrics.failed}</p>
              </div>
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-purple-600">{metrics.successRate}%</p>
              </div>
              <BarChart3 className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-500" />
              <span className="text-sm font-medium text-gray-700">Filters:</span>
            </div>
            
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="completed">Completed</option>
              <option value="in_progress">In Progress</option>
              <option value="failed">Failed</option>
              <option value="pending">Pending</option>
            </select>

            <select
              value={filters.dateRange}
              onChange={(e) => setFilters({ ...filters, dateRange: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="1h">Last Hour</option>
              <option value="24h">Last 24 Hours</option>
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="all">All Time</option>
            </select>

            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search configurations..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {filters.search && (
              <button
                onClick={() => setFilters({ ...filters, search: '' })}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Sync Status Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Configuration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Progress
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredStatus.map((sync) => (
                  <tr key={sync.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{sync.configName}</div>
                        <div className="text-sm text-gray-500">{sync.sourceSystem} → {sync.targetSystem}</div>
                        <div className="text-xs text-gray-400">{sync.messageType}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        {getStatusIcon(sync.status)}
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(sync.status)}`}>
                          {sync.status.replace('_', ' ')}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">
                        {sync.processedCount}/{sync.recordCount}
                      </div>
                      {sync.errorCount > 0 && (
                        <div className="text-sm text-red-600">{sync.errorCount} errors</div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatDuration(sync.duration)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.startTime ? new Date(sync.startTime).toLocaleString() : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => {
                            setSelectedStatus(sync);
                            setShowDetails(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {sync.status === 'failed' && (
                          <button
                            onClick={() => handleRetrySync(sync.id)}
                            className="text-green-600 hover:text-green-900"
                            title="Retry Sync"
                          >
                            <RefreshCw className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Details Modal */}
        {showDetails && selectedStatus && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-2xl w-full max-h-screen overflow-y-auto">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Sync Details</h3>
                  <button
                    onClick={() => setShowDetails(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-6">
                  {/* Basic Info */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Basic Information</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Configuration:</span>
                        <span className="ml-2 font-medium">{selectedStatus.configName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Status:</span>
                        <span className={`ml-2 inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedStatus.status)}`}>
                          {selectedStatus.status.replace('_', ' ')}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Message Type:</span>
                        <span className="ml-2 font-medium">{selectedStatus.messageType}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Duration:</span>
                        <span className="ml-2 font-medium">{formatDuration(selectedStatus.duration)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Progress</h4>
                    <div className="bg-gray-200 rounded-full h-4 mb-2">
                      <div
                        className="bg-blue-600 h-4 rounded-full"
                        style={{ width: `${(selectedStatus.processedCount / selectedStatus.recordCount) * 100}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span>{selectedStatus.processedCount} processed</span>
                      <span>{selectedStatus.recordCount} total</span>
                      {selectedStatus.errorCount > 0 && (
                        <span className="text-red-600">{selectedStatus.errorCount} errors</span>
                      )}
                    </div>
                  </div>

                  {/* Timing */}
                  <div>
                    <h4 className="font-medium text-gray-900 mb-3">Timing</h4>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Start Time:</span>
                        <span className="ml-2 font-medium">
                          {selectedStatus.startTime ? new Date(selectedStatus.startTime).toLocaleString() : '-'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">End Time:</span>
                        <span className="ml-2 font-medium">
                          {selectedStatus.endTime ? new Date(selectedStatus.endTime).toLocaleString() : '-'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Error Details */}
                  {selectedStatus.errorMessage && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Error Details</h4>
                      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                        <div className="flex items-start gap-2">
                          <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
                          <p className="text-sm text-red-800">{selectedStatus.errorMessage}</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Metadata */}
                  {selectedStatus.metadata && (
                    <div>
                      <h4 className="font-medium text-gray-900 mb-3">Metadata</h4>
                      <div className="bg-gray-50 rounded-lg p-4">
                        <pre className="text-sm text-gray-700">
                          {JSON.stringify(selectedStatus.metadata, null, 2)}
                        </pre>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  {selectedStatus.status === 'failed' && (
                    <button
                      onClick={() => handleRetrySync(selectedStatus.id)}
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                    >
                      Retry Sync
                    </button>
                  )}
                  <button
                    onClick={() => setShowDetails(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Close
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

export default SyncStatusDashboard;
