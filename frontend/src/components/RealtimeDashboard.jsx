import React, { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { AlertCircle, TrendingUp, Activity, Clock, AlertTriangle, Zap, Check, XCircle, RefreshCw } from 'lucide-react';
import { useWebSocket } from './hooks/useWebSocket';
import './RealtimeDashboard.css';

/**
 * Real-time Dashboard Component
 * Displays live updates for claims, payments, and system status
 */
const RealtimeDashboard = () => {
  const { socket, isConnected } = useWebSocket();
  
  const [dashboardData, setDashboardData] = useState({
    activeClaims: 0,
    processedToday: 0,
    pendingPayments: 0,
    systemHealth: 100,
    activeConnections: 0,
    avgResponseTime: 0,
    errorRate: 0
  });

  const [claims, setClaims] = useState([]);
  const [payments, setPayments] = useState([]);
  const [systemAlerts, setSystemAlerts] = useState([]);
  const [chartData, setChartData] = useState([]);
  const [claimsTimeline, setClaimsTimeline] = useState([]);
  const [paymentsTimeline, setPaymentsTimeline] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Handle system status updates
  useEffect(() => {
    if (!socket) return;

    const handleSystemStatus = (status) => {
      setDashboardData(prev => ({
        ...prev,
        ...status
      }));
      
      // Add chart data point
      setChartData(prev => {
        const newData = [...prev, {
          time: new Date(status.lastUpdated).toLocaleTimeString(),
          health: status.systemHealth,
          activeClaims: status.activeClaims,
          responseTime: status.avgResponseTime,
          connections: status.activeConnections
        }];
        return newData.slice(-30); // Keep last 30 data points
      });
    };

    socket.on('system-status', handleSystemStatus);

    return () => {
      socket.off('system-status', handleSystemStatus);
    };
  }, [socket]);

  // Handle claim updates
  useEffect(() => {
    if (!socket) return;

    const handleClaimUpdate = (update) => {
      const { action, claim } = update;
      
      setClaims(prev => {
        if (action === 'update') {
          return [claim, ...prev].slice(0, 10);
        } else if (action === 'delete') {
          return prev.filter(c => c.id !== claim.id);
        }
        return prev;
      });

      // Add to timeline
      setClaimsTimeline(prev => [{
        id: claim.id,
        status: claim.status,
        amount: claim.amount,
        timestamp: new Date(),
        action
      }, ...prev].slice(0, 20));
    };

    const handleBatch = (data) => {
      setClaims(prev => [...data.claims, ...prev].slice(0, 10));
    };

    socket.on('claim-update', handleClaimUpdate);
    socket.on('claims-batch', handleBatch);

    return () => {
      socket.off('claim-update', handleClaimUpdate);
      socket.off('claims-batch', handleBatch);
    };
  }, [socket]);

  // Handle payment updates
  useEffect(() => {
    if (!socket) return;

    const handlePaymentUpdate = (update) => {
      const { action, payment } = update;
      
      setPayments(prev => {
        if (action === 'update') {
          return [payment, ...prev].slice(0, 10);
        } else if (action === 'delete') {
          return prev.filter(p => p.id !== payment.id);
        }
        return prev;
      });

      // Add to timeline
      setPaymentsTimeline(prev => [{
        id: payment.id,
        status: payment.status,
        amount: payment.amount,
        timestamp: new Date(),
        action
      }, ...prev].slice(0, 20));
    };

    const handleBatch = (data) => {
      setPayments(prev => [...data.payments, ...prev].slice(0, 10));
    };

    socket.on('payment-update', handlePaymentUpdate);
    socket.on('payments-batch', handleBatch);

    return () => {
      socket.off('payment-update', handlePaymentUpdate);
      socket.off('payments-batch', handleBatch);
    };
  }, [socket]);

  // Handle system alerts
  useEffect(() => {
    if (!socket) return;

    const handleAlert = (alert) => {
      setSystemAlerts(prev => [alert, ...prev].slice(0, 10));
      
      // Auto-remove non-critical alerts after 10 seconds
      if (alert.level !== 'critical') {
        setTimeout(() => {
          setSystemAlerts(prev => prev.filter(a => a.id !== alert.id));
        }, 10000);
      }
    };

    socket.on('alert', handleAlert);

    return () => {
      socket.off('alert', handleAlert);
    };
  }, [socket]);

  // Handle manual refresh
  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    if (socket) {
      socket.emit('request-dashboard-refresh', {}, () => {
        setRefreshing(false);
      });
    }
  }, [socket]);

  // Status badge color mapping
  const getStatusColor = (status) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'processing': 'bg-blue-100 text-blue-800',
      'approved': 'bg-green-100 text-green-800',
      'completed': 'bg-green-100 text-green-800',
      'denied': 'bg-red-100 text-red-800',
      'failed': 'bg-red-100 text-red-800',
      'successful': 'bg-green-100 text-green-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  // Alert level color mapping
  const getAlertColor = (level) => {
    const colors = {
      'info': 'border-blue-400 bg-blue-50',
      'warning': 'border-yellow-400 bg-yellow-50',
      'error': 'border-red-400 bg-red-50',
      'critical': 'border-red-600 bg-red-50'
    };
    return colors[level] || 'border-gray-400 bg-gray-50';
  };

  return (
    <div className="realtime-dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <div className="header-title-section">
          <h1 className="dashboard-title">Real-Time Dashboard</h1>
          <div className="connection-status">
            <span className={`status-indicator ${isConnected ? 'connected' : 'disconnected'}`}></span>
            <span className="status-text">{isConnected ? 'Connected' : 'Disconnected'}</span>
          </div>
        </div>
        <button 
          className="refresh-button"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw size={20} className={refreshing ? 'spinning' : ''} />
          Refresh
        </button>
      </div>

      {/* Key Metrics */}
      <div className="metrics-grid">
        <MetricCard
          title="System Health"
          value={`${dashboardData.systemHealth}%`}
          icon={<Activity size={24} />}
          trend={dashboardData.systemHealth >= 95 ? 'up' : 'down'}
          color="blue"
        />
        <MetricCard
          title="Active Claims"
          value={dashboardData.activeClaims}
          icon={<TrendingUp size={24} />}
          color="purple"
        />
        <MetricCard
          title="Processed Today"
          value={dashboardData.processedToday}
          icon={<Check size={24} />}
          color="green"
        />
        <MetricCard
          title="Pending Payments"
          value={dashboardData.pendingPayments}
          icon={<Clock size={24} />}
          color="orange"
        />
        <MetricCard
          title="Avg Response Time"
          value={`${dashboardData.avgResponseTime}ms`}
          icon={<Zap size={24} />}
          color="indigo"
        />
        <MetricCard
          title="Error Rate"
          value={`${dashboardData.errorRate}%`}
          icon={<AlertTriangle size={24} />}
          trend={dashboardData.errorRate > 2 ? 'down' : 'up'}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="charts-container">
        <ChartCard title="System Health Trend">
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorHealth" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area type="monotone" dataKey="health" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHealth)" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Active Claims Over Time">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="activeClaims" stroke="#a855f7" />
              <Line type="monotone" dataKey="connections" stroke="#06b6d4" />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Alerts Section */}
      {systemAlerts.length > 0 && (
        <div className="alerts-section">
          <h2 className="section-title">System Alerts</h2>
          <div className="alerts-container">
            {systemAlerts.map(alert => (
              <div key={alert.id} className={`alert-item ${getAlertColor(alert.level)}`}>
                <div className="alert-header">
                  <AlertCircle size={18} />
                  <span className="alert-title">{alert.title}</span>
                </div>
                <p className="alert-message">{alert.message}</p>
                <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="activity-container">
        <div className="activity-section">
          <h2 className="section-title">Recent Claims</h2>
          <div className="activity-list">
            {claims.length === 0 ? (
              <p className="no-data">No claims yet</p>
            ) : (
              claims.map(claim => (
                <div key={claim.id} className="activity-item">
                  <div className="activity-content">
                    <div className="activity-main">
                      <span className="activity-id">Claim #{claim.id?.toString().slice(0, 8)}</span>
                      <span className={`status-badge ${getStatusColor(claim.status)}`}>
                        {claim.status}
                      </span>
                    </div>
                    <p className="activity-amount">${claim.amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <span className="activity-time">
                    {claim.createdAt ? new Date(claim.createdAt).toLocaleTimeString() : 'just now'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="activity-section">
          <h2 className="section-title">Recent Payments</h2>
          <div className="activity-list">
            {payments.length === 0 ? (
              <p className="no-data">No payments yet</p>
            ) : (
              payments.map(payment => (
                <div key={payment.id} className="activity-item">
                  <div className="activity-content">
                    <div className="activity-main">
                      <span className="activity-id">Payment #{payment.id?.toString().slice(0, 8)}</span>
                      <span className={`status-badge ${getStatusColor(payment.status)}`}>
                        {payment.status}
                      </span>
                    </div>
                    <p className="activity-amount">${payment.amount?.toFixed(2) || '0.00'}</p>
                  </div>
                  <span className="activity-time">
                    {payment.createdAt ? new Date(payment.createdAt).toLocaleTimeString() : 'just now'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Metric Card Component
 */
const MetricCard = ({ title, value, icon, trend, color }) => {
  return (
    <div className={`metric-card metric-${color}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-content">
        <p className="metric-title">{title}</p>
        <h3 className="metric-value">{value}</h3>
        {trend && (
          <p className={`metric-trend trend-${trend}`}>
            {trend === 'up' ? '↑' : '↓'} Trending {trend}
          </p>
        )}
      </div>
    </div>
  );
};

/**
 * Chart Card Component
 */
const ChartCard = ({ title, children }) => {
  return (
    <div className="chart-card">
      <h2 className="chart-title">{title}</h2>
      <div className="chart-content">
        {children}
      </div>
    </div>
  );
};

export default RealtimeDashboard;
