import React, { useState, useEffect } from 'react';
import {
  Activity,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Clock,
  Wifi,
  WifiOff,
  Server,
  Database,
  Zap,
  Settings,
  Bell,
  Calendar,
  Filter
} from 'lucide-react';

const ConnectionHealthMonitoring = () => {
  const [healthData, setHealthData] = useState(null);
  const [connections, setConnections] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [metrics, setMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedTimeRange, setSelectedTimeRange] = useState('24h');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  // Sample connection data
  const sampleConnections = [
    {
      id: 1,
      name: 'Hospital EHR Integration',
      type: 'HL7',
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 45,
      uptime: 99.8,
      successRate: 99.5,
      lastSync: new Date(Date.now() - 5 * 60 * 1000),
      errorCount: 2,
      totalRequests: 1250,
      endpoint: 'mllp://ehr.hospital.local:2575',
      metrics: {
        cpu: 45,
        memory: 62,
        network: 78
      }
    },
    {
      id: 2,
      name: 'Lab System FHIR',
      type: 'FHIR',
      status: 'healthy',
      lastCheck: new Date(),
      responseTime: 125,
      uptime: 99.9,
      successRate: 99.8,
      lastSync: new Date(Date.now() - 2 * 60 * 1000),
      errorCount: 1,
      totalRequests: 890,
      endpoint: 'https://lab.hospital.local/fhir/r4',
      metrics: {
        cpu: 32,
        memory: 48,
        network: 65
      }
    },
    {
      id: 3,
      name: 'Radiology Integration',
      type: 'HL7',
      status: 'degraded',
      lastCheck: new Date(),
      responseTime: 850,
      uptime: 95.2,
      successRate: 94.1,
      lastSync: new Date(Date.now() - 15 * 60 * 1000),
      errorCount: 15,
      totalRequests: 450,
      endpoint: 'mllp://radiology.hospital.local:2576',
      metrics: {
        cpu: 78,
        memory: 85,
        network: 92
      }
    },
    {
      id: 4,
      name: 'Pharmacy System',
      type: 'Custom',
      status: 'unhealthy',
      lastCheck: new Date(Date.now() - 5 * 60 * 1000),
      responseTime: null,
      uptime: 87.3,
      successRate: 82.4,
      lastSync: new Date(Date.now() - 45 * 60 * 1000),
      errorCount: 28,
      totalRequests: 320,
      endpoint: 'https://pharmacy.hospital.local/api',
      metrics: {
        cpu: 92,
        memory: 94,
        network: 88
      }
    }
  ];

  // Sample alerts
  const sampleAlerts = [
    {
      id: 1,
      type: 'error',
      title: 'Pharmacy System Connection Failed',
      message: 'Unable to establish connection to pharmacy system endpoint',
      timestamp: new Date(Date.now() - 5 * 60 * 1000),
      connectionId: 4,
      acknowledged: false
    },
    {
      id: 2,
      type: 'warning',
      title: 'Radiology System High Response Time',
      message: 'Response time exceeded 800ms threshold',
      timestamp: new Date(Date.now() - 15 * 60 * 1000),
      connectionId: 3,
      acknowledged: false
    },
    {
      id: 3,
      type: 'info',
      title: 'Lab System Scheduled Maintenance',
      message: 'Lab system will undergo maintenance at 2:00 AM',
      timestamp: new Date(Date.now() - 30 * 60 * 1000),
      connectionId: 2,
      acknowledged: true
    }
  ];

  useEffect(() => {
    fetchHealthData();
    
    if (autoRefresh) {
      const interval = setInterval(fetchHealthData, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedTimeRange]);

  const fetchHealthData = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setConnections(sampleConnections);
      setAlerts(sampleAlerts);
      
      // Calculate overall metrics
      const healthyConnections = sampleConnections.filter(c => c.status === 'healthy').length;
      const degradedConnections = sampleConnections.filter(c => c.status === 'degraded').length;
      const unhealthyConnections = sampleConnections.filter(c => c.status === 'unhealthy').length;
      
      const avgResponseTime = sampleConnections
        .filter(c => c.responseTime !== null)
        .reduce((sum, c) => sum + c.responseTime, 0) / 
        sampleConnections.filter(c => c.responseTime !== null).length;
      
      const avgUptime = sampleConnections.reduce((sum, c) => sum + c.uptime, 0) / sampleConnections.length;
      const avgSuccessRate = sampleConnections.reduce((sum, c) => sum + c.successRate, 0) / sampleConnections.length;
      
      setHealthData({
        overallStatus: unhealthyConnections > 0 ? 'unhealthy' : degradedConnections > 0 ? 'degraded' : 'healthy',
        totalConnections: sampleConnections.length,
        healthyConnections,
        degradedConnections,
        unhealthyConnections,
        avgResponseTime: Math.round(avgResponseTime),
        avgUptime: avgUptime.toFixed(1),
        avgSuccessRate: avgSuccessRate.toFixed(1),
        lastUpdated: new Date()
      });
      
      setMetrics({
        totalRequests: sampleConnections.reduce((sum, c) => sum + c.totalRequests, 0),
        totalErrors: sampleConnections.reduce((sum, c) => sum + c.errorCount, 0),
        dataTransferred: '2.4 GB',
        activeAlerts: alerts.filter(a => !a.acknowledged).length
      });
      
    } catch (error) {
      console.error('Error fetching health data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'healthy':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'degraded':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'unhealthy':
        return <AlertCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Clock className="w-5 h-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'healthy':
        return 'bg-green-100 text-green-800';
      case 'degraded':
        return 'bg-yellow-100 text-yellow-800';
      case 'unhealthy':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-600" />;
      case 'warning':
        return <AlertTriangle className="w-4 h-4 text-yellow-600" />;
      case 'info':
        return <Activity className="w-4 h-4 text-blue-600" />;
      default:
        return <Activity className="w-4 h-4 text-gray-600" />;
    }
  };

  const handleAcknowledgeAlert = (alertId) => {
    setAlerts(alerts.map(alert => 
      alert.id === alertId ? { ...alert, acknowledged: true } : alert
    ));
  };

  const handleTestConnection = async (connectionId) => {
    try {
      // Simulate connection test
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      setConnections(connections.map(conn => 
        conn.id === connectionId 
          ? { 
              ...conn, 
              lastCheck: new Date(),
              status: Math.random() > 0.2 ? 'healthy' : 'degraded',
              responseTime: Math.floor(Math.random() * 200) + 50
            }
          : conn
      ));
    } catch (error) {
      console.error('Error testing connection:', error);
    }
  };

  const handleRefresh = () => {
    fetchHealthData();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Connection Health Monitoring</h1>
              <p className="mt-2 text-gray-600">Real-time monitoring of integration connections and system health</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowSettings(true)}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
              >
                <Settings className="w-4 h-4" />
                Settings
              </button>
              <button
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>
          </div>
        </div>

        {/* Overall Health Status */}
        {healthData && (
          <div className="bg-white rounded-lg shadow-md p-6 mb-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Overall System Health</h2>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoRefresh}
                    onChange={(e) => setAutoRefresh(e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  Auto Refresh
                </label>
                <select
                  value={selectedTimeRange}
                  onChange={(e) => setSelectedTimeRange(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center justify-center mb-2">
                  {getStatusIcon(healthData.overallStatus)}
                </div>
                <p className="text-2xl font-bold text-blue-600 capitalize">{healthData.overallStatus}</p>
                <p className="text-sm text-gray-600">System Status</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-2xl font-bold text-green-600">{healthData.avgResponseTime}ms</p>
                <p className="text-sm text-gray-600">Avg Response Time</p>
              </div>
              
              <div className="text-center p-4 bg-purple-50 rounded-lg">
                <p className="text-2xl font-bold text-purple-600">{healthData.avgUptime}%</p>
                <p className="text-sm text-gray-600">Avg Uptime</p>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <p className="text-2xl font-bold text-yellow-600">{healthData.avgSuccessRate}%</p>
                <p className="text-sm text-gray-600">Success Rate</p>
              </div>
            </div>

            <div className="flex items-center justify-between text-sm text-gray-500">
              <span>Total Connections: {healthData.totalConnections}</span>
              <span>Healthy: {healthData.healthyConnections}</span>
              <span>Degraded: {healthData.degradedConnections}</span>
              <span>Unhealthy: {healthData.unhealthyConnections}</span>
              <span>Last Updated: {healthData.lastUpdated.toLocaleTimeString()}</span>
            </div>
          </div>
        )}

        {/* Active Alerts */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5 text-red-600" />
              Active Alerts
              {alerts.filter(a => !a.acknowledged).length > 0 && (
                <span className="bg-red-100 text-red-800 text-xs font-medium px-2 py-1 rounded-full">
                  {alerts.filter(a => !a.acknowledged).length}
                </span>
              )}
            </h2>
          </div>

          <div className="space-y-3">
            {alerts.filter(alert => !alert.acknowledged).length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="w-12 h-12 mx-auto mb-3 text-green-400" />
                <p>No active alerts</p>
              </div>
            ) : (
              alerts.filter(alert => !alert.acknowledged).map(alert => (
                <div key={alert.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    {getAlertIcon(alert.type)}
                    <div>
                      <div className="font-medium text-gray-900">{alert.title}</div>
                      <div className="text-sm text-gray-600">{alert.message}</div>
                      <div className="text-xs text-gray-500">
                        {alert.timestamp.toLocaleString()} • 
                        {connections.find(c => c.id === alert.connectionId)?.name}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => handleAcknowledgeAlert(alert.id)}
                    className="px-3 py-1 bg-blue-100 text-blue-800 text-sm rounded-lg hover:bg-blue-200"
                  >
                    Acknowledge
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Connection Details */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6">Connection Details</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {connections.map(connection => (
              <div key={connection.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {connection.status === 'healthy' ? (
                      <Wifi className="w-5 h-5 text-green-600" />
                    ) : (
                      <WifiOff className="w-5 h-5 text-red-600" />
                    )}
                    <div>
                      <h3 className="font-medium text-gray-900">{connection.name}</h3>
                      <p className="text-sm text-gray-500">{connection.endpoint}</p>
                    </div>
                  </div>
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(connection.status)}`}>
                    {connection.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                  <div>
                    <span className="text-gray-500">Response Time:</span>
                    <span className="ml-2 font-medium">
                      {connection.responseTime ? `${connection.responseTime}ms` : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Uptime:</span>
                    <span className="ml-2 font-medium">{connection.uptime}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Success Rate:</span>
                    <span className="ml-2 font-medium">{connection.successRate}%</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Sync:</span>
                    <span className="ml-2 font-medium">
                      {connection.lastSync.toLocaleTimeString()}
                    </span>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="mb-4">
                  <div className="text-sm font-medium text-gray-700 mb-2">Performance Metrics</div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">CPU</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            connection.metrics.cpu > 80 ? 'bg-red-500' :
                            connection.metrics.cpu > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${connection.metrics.cpu}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-8">{connection.metrics.cpu}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">Memory</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            connection.metrics.memory > 80 ? 'bg-red-500' :
                            connection.metrics.memory > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${connection.metrics.memory}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-8">{connection.metrics.memory}%</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500 w-12">Network</span>
                      <div className="flex-1 bg-gray-200 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${
                            connection.metrics.network > 80 ? 'bg-red-500' :
                            connection.metrics.network > 60 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${connection.metrics.network}%` }}
                        ></div>
                      </div>
                      <span className="text-xs text-gray-600 w-8">{connection.metrics.network}%</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <div className="text-gray-500">
                    {connection.totalRequests} requests • {connection.errorCount} errors
                  </div>
                  <button
                    onClick={() => handleTestConnection(connection.id)}
                    className="text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" />
                    Test
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* System Metrics */}
        {metrics && (
          <div className="bg-white rounded-lg shadow-md p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-blue-600" />
              System Metrics
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="text-center p-4 bg-blue-50 rounded-lg">
                <Server className="w-8 h-8 text-blue-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-blue-600">{metrics.totalRequests.toLocaleString()}</p>
                <p className="text-sm text-gray-600">Total Requests</p>
              </div>
              
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <AlertCircle className="w-8 h-8 text-red-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-red-600">{metrics.totalErrors}</p>
                <p className="text-sm text-gray-600">Total Errors</p>
              </div>
              
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <Database className="w-8 h-8 text-green-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-green-600">{metrics.dataTransferred}</p>
                <p className="text-sm text-gray-600">Data Transferred</p>
              </div>
              
              <div className="text-center p-4 bg-yellow-50 rounded-lg">
                <Bell className="w-8 h-8 text-yellow-600 mx-auto mb-2" />
                <p className="text-2xl font-bold text-yellow-600">{metrics.activeAlerts}</p>
                <p className="text-sm text-gray-600">Active Alerts</p>
              </div>
            </div>
          </div>
        )}

        {/* Settings Modal */}
        {showSettings && (
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold">Monitoring Settings</h3>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={autoRefresh}
                        onChange={(e) => setAutoRefresh(e.target.checked)}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div>
                        <div className="font-medium text-gray-900">Auto Refresh</div>
                        <div className="text-sm text-gray-500">Automatically refresh health data every 30 seconds</div>
                      </div>
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Alert Thresholds
                    </label>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Response Time (ms)</span>
                        <input
                          type="number"
                          defaultValue="500"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">Error Rate (%)</span>
                        <input
                          type="number"
                          defaultValue="5"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-gray-600">CPU Usage (%)</span>
                        <input
                          type="number"
                          defaultValue="80"
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Notification Preferences
                    </label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
                        <span className="text-sm text-gray-700">Email notifications</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300 text-blue-600" />
                        <span className="text-sm text-gray-700">SMS alerts</span>
                      </label>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" className="rounded border-gray-300 text-blue-600" />
                        <span className="text-sm text-gray-700">Webhook notifications</span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Save Settings
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

export default ConnectionHealthMonitoring;
