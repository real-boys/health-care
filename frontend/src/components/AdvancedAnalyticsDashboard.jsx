import React, { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer, AreaChart, Area, RadarChart, Radar,
  PolarGrid, PolarAngleAxis, PolarRadiusAxis, Treemap
} from 'recharts';
import {
  TrendingUp, Download, Calendar, Filter, RefreshCw, BarChart3, PieChartIcon,
  Activity, Users, DollarSign, FileText, Clock, CheckCircle, AlertCircle,
  Settings, Save, Share2, Eye, Edit3, ChevronDown, ChevronUp, Plus, X
} from 'lucide-react';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884D8', '#82CA9D'];

const AdvancedAnalyticsDashboard = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [timeRange, setTimeRange] = useState('30d');
  const [chartData, setChartData] = useState({});
  const [realtimeMetrics, setRealtimeMetrics] = useState({});
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({});
  const [customReport, setCustomReport] = useState({
    name: '',
    dataSource: '',
    metrics: [],
    dimensions: [],
    filters: {}
  });
  const [scheduledReports, setScheduledReports] = useState([]);
  const [showReportBuilder, setShowReportBuilder] = useState(false);
  const [drilldownData, setDrilldownData] = useState(null);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchRealtimeMetrics, 30000);
    return () => clearInterval(interval);
  }, [timeRange, filters]);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [claimsData, paymentsData, providerData, patientData] = await Promise.all([
        fetchChartData('claims-timeline'),
        fetchChartData('payment-methods'),
        fetchChartData('provider-performance'),
        fetchChartData('patient-outcomes')
      ]);
      
      setChartData({
        claims: claimsData,
        payments: paymentsData,
        providers: providerData,
        patients: patientData
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchChartData = async (chartType) => {
    const response = await fetch(`/api/analytics/charts/${chartType}?startDate=${getStartDate()}&endDate=${getEndDate()}&filters=${JSON.stringify(filters)}`);
    return response.json();
  };

  const fetchRealtimeMetrics = async () => {
    try {
      const response = await fetch(`/api/analytics/dashboard/realtime?timeWindow=1h`);
      const data = await response.json();
      setRealtimeMetrics(data.metrics);
    } catch (error) {
      console.error('Error fetching realtime metrics:', error);
    }
  };

  const getStartDate = () => {
    const date = new Date();
    const value = parseInt(timeRange);
    switch (timeRange.slice(-1)) {
      case 'd': date.setDate(date.getDate() - value); break;
      case 'w': date.setDate(date.getDate() - (value * 7)); break;
      case 'm': date.setMonth(date.getMonth() - value); break;
      default: date.setDate(date.getDate() - 30);
    }
    return date.toISOString().split('T')[0];
  };

  const getEndDate = () => {
    return new Date().toISOString().split('T')[0];
  };

  const handleExport = async (format, reportType, data) => {
    try {
      const response = await fetch(`/api/analytics/export/${format}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType,
          data,
          filename: `${reportType}_export_${new Date().toISOString().split('T')[0]}.${format}`
        })
      });
      
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${reportType}_export.${format}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting data:', error);
    }
  };

  const handleCreateCustomReport = async () => {
    try {
      const response = await fetch('/api/analytics/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(customReport)
      });
      
      const data = await response.json();
      // Handle custom report data
      console.log('Custom report created:', data);
      setShowReportBuilder(false);
    } catch (error) {
      console.error('Error creating custom report:', error);
    }
  };

  const handleScheduleReport = async (reportConfig) => {
    try {
      const response = await fetch('/api/analytics/reports/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reportConfig)
      });
      
      const data = await response.json();
      setScheduledReports([...scheduledReports, data.scheduledReport]);
    } catch (error) {
      console.error('Error scheduling report:', error);
    }
  };

  const handleDrilldown = async (entityType, entityId) => {
    try {
      const response = await fetch(`/api/analytics/drilldown/${entityType}/${entityId}`);
      const data = await response.json();
      setDrilldownData(data);
    } catch (error) {
      console.error('Error fetching drilldown data:', error);
    }
  };

  const renderMetricCard = (title, value, Icon, change, color) => (
    <div className="bg-white rounded-lg shadow p-6 border border-gray-200">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {change && (
            <p className={`text-sm ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {change >= 0 ? '+' : ''}{change}%
            </p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="w-6 h-6 text-white" />
        </div>
      </div>
    </div>
  );

  const renderClaimsTimelineChart = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <FileText className="w-5 h-5 mr-2" />
        Claims Timeline
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData.claims?.data || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="claims_count" stroke="#8884d8" name="Claims Count" />
          <Line type="monotone" dataKey="total_amount" stroke="#82ca9d" name="Total Amount" />
          <Line type="monotone" dataKey="approved" stroke="#ffc658" name="Approved" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );

  const renderPaymentMethodsChart = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <DollarSign className="w-5 h-5 mr-2" />
        Payment Methods Distribution
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={chartData.payments?.data || []}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ payment_method, percent }) => `${payment_method} ${(percent * 100).toFixed(0)}%`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="total_amount"
          >
            {(chartData.payments?.data || []).map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );

  const renderProviderPerformanceChart = () => (
    <div className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4 flex items-center">
        <Users className="w-5 h-5 mr-2" />
        Provider Performance
      </h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={chartData.providers?.data || []}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="provider_name" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="completed" fill="#8884d8" name="Completed" />
          <Bar dataKey="total_appointments" fill="#82ca9d" name="Total Appointments" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );

  const renderRealtimeMetrics = () => (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      {renderMetricCard(
        'Active Claims',
        realtimeMetrics.activeClaims || 0,
        FileText,
        12,
        'bg-blue-500'
      )}
      {renderMetricCard(
        'Recent Payments',
        `$${(realtimeMetrics.recentPayments?.total || 0).toLocaleString()}`,
        DollarSign,
        8,
        'bg-green-500'
      )}
      {renderMetricCard(
        'Active Appointments',
        realtimeMetrics.activeAppointments || 0,
        Calendar,
        -3,
        'bg-purple-500'
      )}
      {renderMetricCard(
        'System Load',
        `${Math.round(realtimeMetrics.systemLoad?.cpu || 0)}%`,
        Activity,
        0,
        'bg-orange-500'
      )}
    </div>
  );

  const renderCustomReportBuilder = () => (
    <div className="bg-white p-6 rounded-lg shadow mb-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center">
          <Settings className="w-5 h-5 mr-2" />
          Custom Report Builder
        </h3>
        <button
          onClick={() => setShowReportBuilder(!showReportBuilder)}
          className="p-2 hover:bg-gray-100 rounded"
        >
          {showReportBuilder ? <ChevronUp /> : <ChevronDown />}
        </button>
      </div>
      
      {showReportBuilder && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
            <input
              type="text"
              value={customReport.name}
              onChange={(e) => setCustomReport({...customReport, name: e.target.value})}
              className="w-full p-2 border border-gray-300 rounded"
              placeholder="Enter report name"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data Source</label>
              <select
                value={customReport.dataSource}
                onChange={(e) => setCustomReport({...customReport, dataSource: e.target.value})}
                className="w-full p-2 border border-gray-300 rounded"
              >
                <option value="">Select data source</option>
                <option value="insurance_claims">Insurance Claims</option>
                <option value="premium_payments">Premium Payments</option>
                <option value="appointments">Appointments</option>
                <option value="patients">Patients</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Metrics</label>
              <div className="space-y-2">
                {['COUNT(*)', 'SUM(amount)', 'AVG(amount)'].map(metric => (
                  <label key={metric} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={customReport.metrics.includes(metric)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCustomReport({...customReport, metrics: [...customReport.metrics, metric]});
                        } else {
                          setCustomReport({...customReport, metrics: customReport.metrics.filter(m => m !== metric)});
                        }
                      }}
                      className="mr-2"
                    />
                    {metric}
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <div className="flex space-x-2">
            <button
              onClick={handleCreateCustomReport}
              className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 flex items-center"
            >
              <Save className="w-4 h-4 mr-2" />
              Generate Report
            </button>
            <button
              onClick={() => handleExport('pdf', 'custom', customReport)}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center"
            >
              <Download className="w-4 h-4 mr-2" />
              Export PDF
            </button>
          </div>
        </div>
      )}
    </div>
  );

  const renderDrilldownModal = () => {
    if (!drilldownData) return null;
    
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-4xl max-h-[80vh] overflow-y-auto w-full">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Drill-down Analysis</h3>
            <button
              onClick={() => setDrilldownData(null)}
              className="p-2 hover:bg-gray-100 rounded"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Entity Type</p>
                <p className="font-medium">{drilldownData.entityType}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Entity ID</p>
                <p className="font-medium">{drilldownData.entityId}</p>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {Object.keys(drilldownData.data[0] || {}).map(key => (
                      <th key={key} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {drilldownData.data.map((row, index) => (
                    <tr key={index}>
                      {Object.values(row).map((value, i) => (
                        <td key={i} className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {value}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Advanced Analytics Dashboard</h1>
          <div className="flex items-center space-x-4">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg"
            >
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="90d">Last 90 days</option>
              <option value="1y">Last year</option>
            </select>
            <button
              onClick={fetchDashboardData}
              className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {renderRealtimeMetrics()}
        {renderCustomReportBuilder()}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {renderClaimsTimelineChart()}
          {renderPaymentMethodsChart()}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {renderProviderPerformanceChart()}
          
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button
                onClick={() => handleExport('csv', 'claims', chartData.claims?.data || [])}
                className="w-full px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Claims Data (CSV)
              </button>
              <button
                onClick={() => handleExport('pdf', 'dashboard', chartData)}
                className="w-full px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 flex items-center justify-center"
              >
                <Download className="w-4 h-4 mr-2" />
                Export Dashboard (PDF)
              </button>
              <button
                onClick={() => handleScheduleReport({
                  reportName: 'Weekly Analytics Report',
                  reportType: 'dashboard',
                  schedule: 'weekly at 09:00',
                  recipients: ['admin@healthcare.com'],
                  parameters: { timeRange: '7d' }
                })}
                className="w-full px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600 flex items-center justify-center"
              >
                <Clock className="w-4 h-4 mr-2" />
                Schedule Weekly Report
              </button>
            </div>
          </div>
        </div>

        {renderDrilldownModal()}
      </div>
    </div>
  );
};

export default AdvancedAnalyticsDashboard;
