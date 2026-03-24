import React, { useState, useEffect } from 'react';
import {
  Database,
  Activity,
  CheckCircle,
  AlertCircle,
  Settings,
  Play,
  RefreshCw,
  Eye,
  Map,
  BarChart3,
  Plug,
  Clock,
  FileText,
  User,
  AlertTriangle,
  TrendingUp
} from 'lucide-react';

const HL7FHIRIntegration = () => {
  const [activeTab, setActiveTab] = useState('configs');
  const [configs, setConfigs] = useState([]);
  const [syncStatus, setSyncStatus] = useState([]);
  const [healthStatus, setHealthStatus] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedConfig, setSelectedConfig] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const [previewData, setPreviewData] = useState(null);

  useEffect(() => {
    fetchConfigs();
    fetchSyncStatus();
    fetchHealthStatus();
  }, []);

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/hl7-fhir/configs', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setConfigs(data);
    } catch (error) {
      console.error('Error fetching configs:', error);
    }
  };

  const fetchSyncStatus = async () => {
    try {
      const response = await fetch('/api/hl7-fhir/sync-status', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setSyncStatus(data);
    } catch (error) {
      console.error('Error fetching sync status:', error);
    }
  };

  const fetchHealthStatus = async () => {
    try {
      const response = await fetch('/api/hl7-fhir/health', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      const data = await response.json();
      setHealthStatus(data);
    } catch (error) {
      console.error('Error fetching health status:', error);
    }
  };

  const testConnection = async (config) => {
    setLoading(true);
    try {
      const response = await fetch('/api/hl7-fhir/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({ config })
      });
      const data = await response.json();
      setTestResult(data);
    } catch (error) {
      setTestResult({ success: false, message: error.message });
    }
    setLoading(false);
  };

  const renderConfigs = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Integration Configurations</h2>
        <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2">
          <Settings className="w-4 h-4" />
          New Configuration
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {configs.map(config => (
          <div key={config.id} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{config.name}</h3>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  config.type === 'HL7' ? 'bg-blue-100 text-blue-800' : 'bg-green-100 text-green-800'
                }`}>
                  {config.type}
                </span>
              </div>
              <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                config.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {config.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>

            <p className="text-gray-600 text-sm mb-4">{config.description}</p>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Sync Frequency:</span>
                <span className="font-medium">{config.syncFrequency}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Last Sync:</span>
                <span className="font-medium">
                  {config.lastSync ? new Date(config.lastSync).toLocaleString() : 'Never'}
                </span>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => testConnection(config)}
                className="flex-1 bg-blue-50 text-blue-600 px-3 py-2 rounded hover:bg-blue-100 flex items-center justify-center gap-1"
              >
                <Plug className="w-4 h-4" />
                Test
              </button>
              <button
                onClick={() => setSelectedConfig(config)}
                className="flex-1 bg-gray-50 text-gray-600 px-3 py-2 rounded hover:bg-gray-100 flex items-center justify-center gap-1"
              >
                <Settings className="w-4 h-4" />
                Configure
              </button>
            </div>
          </div>
        ))}
      </div>

      {testResult && (
        <div className={`mt-4 p-4 rounded-lg ${
          testResult.success ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {testResult.success ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-600" />
            )}
            <span className={`font-medium ${
              testResult.success ? 'text-green-800' : 'text-red-800'
            }`}>
              {testResult.message}
            </span>
          </div>
          {testResult.responseTime && (
            <p className="text-sm text-gray-600 mt-1">Response time: {testResult.responseTime}</p>
          )}
        </div>
      )}
    </div>
  );

  const renderDataMapping = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Data Mapping Interface</h2>
        <button className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2">
          <Map className="w-4 h-4" />
          Create New Mapping
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Map className="w-5 h-5 text-blue-600" />
          Visual Field Mapping
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div>
            <h4 className="font-medium text-gray-900 mb-3">HL7 Fields</h4>
            <div className="space-y-2">
              {['PID.5 (Patient Name)', 'PID.7 (Birth Date)', 'PID.8 (Gender)', 'PID.11 (Address)'].map(field => (
                <div key={field} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{field}</span>
                  <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="font-medium text-gray-900 mb-3">FHIR Fields</h4>
            <div className="space-y-2">
              {['Patient.name', 'Patient.birthDate', 'Patient.gender', 'Patient.address'].map(field => (
                <div key={field} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium">{field}</span>
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h4 className="font-medium text-gray-900 mb-3">Mapping Rules</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">PID.5 → Patient.name.family + Patient.name.given</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">PID.7 → Patient.birthDate (YYYY-MM-DD format)</span>
            </div>
            <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="text-sm">PID.8 → Patient.gender (M→male, F→female)</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderSyncStatus = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Sync Status Dashboard</h2>
        <button 
          onClick={fetchSyncStatus}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Syncs</p>
              <p className="text-2xl font-bold text-gray-900">{syncStatus.length}</p>
            </div>
            <Activity className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Completed</p>
              <p className="text-2xl font-bold text-green-600">
                {syncStatus.filter(s => s.status === 'COMPLETED').length}
              </p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">In Progress</p>
              <p className="text-2xl font-bold text-yellow-600">
                {syncStatus.filter(s => s.status === 'IN_PROGRESS').length}
              </p>
            </div>
            <Clock className="w-8 h-8 text-yellow-600" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-md border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Failed</p>
              <p className="text-2xl font-bold text-red-600">
                {syncStatus.filter(s => s.status === 'FAILED').length}
              </p>
            </div>
            <AlertTriangle className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md border border-gray-200">
        <div className="p-6">
          <h3 className="text-lg font-semibold mb-4">Recent Sync Activities</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Integration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Records
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {syncStatus.slice(0, 10).map(sync => (
                  <tr key={sync.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {sync.sourceSystem} → {sync.targetSystem}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        sync.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                        sync.status === 'IN_PROGRESS' ? 'bg-yellow-100 text-yellow-800' :
                        sync.status === 'FAILED' ? 'bg-red-100 text-red-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {sync.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.processedCount}/{sync.recordCount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {sync.duration ? `${sync.duration}ms` : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(sync.startTime).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTestingTools = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Integration Testing Tools</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-blue-600" />
            HL7 Message Tester
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                HL7 Message
              </label>
              <textarea
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows={8}
                placeholder="MSH|^~\&|EPIC|HOSPITAL|LAB|LAB|202312011200||ORM^O01|123456|P|2.5&#10;PID|1||12345^^^HOSPITAL^MR||DOE^JOHN^A||19700101|M||..."
              />
            </div>
            
            <button className="w-full bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2">
              <Play className="w-4 h-4" />
              Parse HL7
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Eye className="w-5 h-5 text-green-600" />
            Data Transformation Preview
          </h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target FHIR Resource
              </label>
              <select className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent">
                <option value="patient">Patient</option>
                <option value="encounter">Encounter</option>
                <option value="observation">Observation</option>
                <option value="diagnosticreport">DiagnosticReport</option>
              </select>
            </div>
            
            <button className="w-full bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center justify-center gap-2">
              <Eye className="w-4 h-4" />
              Preview Transformation
            </button>
          </div>
        </div>
      </div>

      {previewData && (
        <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Transformation Preview</h3>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Original Data</h4>
              <pre className="bg-gray-50 p-4 rounded-lg text-sm overflow-x-auto">
                {JSON.stringify(previewData.originalData, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-medium text-gray-900 mb-2">Transformed Data</h4>
              <pre className="bg-green-50 p-4 rounded-lg text-sm overflow-x-auto">
                {JSON.stringify(previewData.transformedData, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderHealthMonitoring = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Connection Health Monitoring</h2>
        <button 
          onClick={fetchHealthStatus}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh Status
        </button>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold">Overall System Health</h3>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
            healthStatus.status === 'healthy' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
          }`}>
            <div className={`w-2 h-2 rounded-full mr-2 ${
              healthStatus.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'
            }`}></div>
            {healthStatus.status}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {healthStatus.connections?.map((connection, index) => (
            <div key={index} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-medium text-gray-900">{connection.name}</h4>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                  connection.status === 'connected' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                  {connection.status}
                </span>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Last Sync:</span>
                  <span>{new Date(connection.lastSync).toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Response Time:</span>
                  <span className="font-medium">{connection.responseTime}</span>
                </div>
              </div>

              <div className="mt-3 pt-3 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-500">Connection Quality</span>
                  <div className="flex items-center gap-1">
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                    <div className="w-2 h-2 bg-gray-300 rounded-full"></div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-blue-600" />
          Performance Metrics
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl font-bold text-blue-600">98.5%</p>
            <p className="text-sm text-gray-600">Uptime</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-2xl font-bold text-green-600">42ms</p>
            <p className="text-sm text-gray-600">Avg Response</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl font-bold text-yellow-600">1,247</p>
            <p className="text-sm text-gray-600">Messages/Day</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl font-bold text-purple-600">99.9%</p>
            <p className="text-sm text-gray-600">Success Rate</p>
          </div>
        </div>
      </div>
    </div>
  );

  const tabs = [
    { id: 'configs', label: 'Configurations', icon: Settings },
    { id: 'mapping', label: 'Data Mapping', icon: Map },
    { id: 'sync', label: 'Sync Status', icon: Activity },
    { id: 'testing', label: 'Testing Tools', icon: Play },
    { id: 'health', label: 'Health Monitor', icon: BarChart3 }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto py-6 px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Database className="w-8 h-8 text-blue-600" />
            HL7/FHIR Integration Layer
          </h1>
          <p className="mt-2 text-gray-600">
            Manage healthcare data integration with standard formats and real-time monitoring
          </p>
        </div>

        <div className="border-b border-gray-200 mb-6">
          <nav className="-mb-px flex space-x-8">
            {tabs.map(tab => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }`}
                >
                  <Icon className="w-5 h-5 mr-2" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {activeTab === 'configs' && renderConfigs()}
        {activeTab === 'mapping' && renderDataMapping()}
        {activeTab === 'sync' && renderSyncStatus()}
        {activeTab === 'testing' && renderTestingTools()}
        {activeTab === 'health' && renderHealthMonitoring()}
      </div>
    </div>
  );
};

export default HL7FHIRIntegration;
