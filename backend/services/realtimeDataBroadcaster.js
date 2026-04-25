/**
 * Real-time Data Broadcaster Service
 * Manages WebSocket connections and broadcasts real-time updates
 * for claims, payments, and system status
 */

class RealtimeDataBroadcaster {
  constructor(io) {
    this.io = io;
    this.dashboardRoom = 'dashboard';
    this.userConnections = new Map();
    this.systemMetrics = this.initializeMetrics();
    this.initialize();
  }

  initialize() {
    this.io.on('connection', (socket) => {
      console.log(`[WebSocket] User connected: ${socket.id}`);
      
      // Store user connection
      this.userConnections.set(socket.id, {
        id: socket.id,
        connectedAt: new Date(),
        rooms: []
      });

      // Handle joining dashboard room
      socket.on('join-dashboard', (userId) => {
        socket.join(this.dashboardRoom);
        const connection = this.userConnections.get(socket.id);
        if (connection) {
          connection.userId = userId;
          connection.rooms.push(this.dashboardRoom);
        }
        console.log(`[WebSocket] User ${userId} joined dashboard`);
        
        // Send initial state
        socket.emit('dashboard-state', this.getInitialState());
      });

      // Handle joining user-specific room
      socket.on('join-user-room', (userId) => {
        const userRoom = `user-${userId}`;
        socket.join(userRoom);
        const connection = this.userConnections.get(socket.id);
        if (connection) {
          connection.rooms.push(userRoom);
        }
      });

      // Handle disconnection
      socket.on('disconnect', () => {
        console.log(`[WebSocket] User disconnected: ${socket.id}`);
        this.userConnections.delete(socket.id);
      });

      // Handle ping for connection health check
      socket.on('ping', (callback) => {
        if (typeof callback === 'function') {
          callback('pong');
        }
      });
    });

    // Periodic system metrics broadcast
    this.startMetricsHeartbeat();
  }

  initializeMetrics() {
    return {
      activeClaims: 0,
      processedToday: 0,
      pendingPayments: 0,
      systemHealth: 100,
      lastUpdated: new Date(),
      activeConnections: 0,
      averageResponseTime: 0,
      apiCallsPerMinute: 0
    };
  }

  /**
   * Broadcast claim update to all connected dashboard clients
   */
  broadcastClaimUpdate(claim, action = 'update') {
    this.io.to(this.dashboardRoom).emit('claim-update', {
      action,
      claim,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId()
    });
  }

  /**
   * Broadcast payment update to all connected dashboard clients
   */
  broadcastPaymentUpdate(payment, action = 'update') {
    this.io.to(this.dashboardRoom).emit('payment-update', {
      action,
      payment,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId()
    });
  }

  /**
   * Broadcast system status update
   */
  broadcastSystemStatus(status) {
    this.systemMetrics = {
      ...this.systemMetrics,
      ...status,
      lastUpdated: new Date()
    };

    this.io.to(this.dashboardRoom).emit('system-status', {
      ...this.systemMetrics,
      eventId: this.generateEventId()
    });
  }

  /**
   * Broadcast batch of claims
   */
  broadcastClaimsBatch(claims) {
    this.io.to(this.dashboardRoom).emit('claims-batch', {
      claims,
      count: claims.length,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId()
    });
  }

  /**
   * Broadcast batch of payments
   */
  broadcastPaymentsBatch(payments) {
    this.io.to(this.dashboardRoom).emit('payments-batch', {
      payments,
      count: payments.length,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId()
    });
  }

  /**
   * Broadcast analytics update
   */
  broadcastAnalytics(analytics) {
    this.io.to(this.dashboardRoom).emit('analytics-update', {
      ...analytics,
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId()
    });
  }

  /**
   * Broadcast alert message
   */
  broadcastAlert(alert) {
    this.io.to(this.dashboardRoom).emit('alert', {
      id: this.generateEventId(),
      level: alert.level || 'info', // 'info', 'warning', 'error', 'critical'
      message: alert.message,
      title: alert.title,
      timestamp: new Date().toISOString(),
      actionType: alert.actionType,
      data: alert.data
    });
  }

  /**
   * Send notification to specific user
   */
  notifyUser(userId, notification) {
    const userRoom = `user-${userId}`;
    this.io.to(userRoom).emit('user-notification', {
      id: this.generateEventId(),
      ...notification,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get current connection count
   */
  getConnectionCount() {
    return this.userConnections.size;
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return {
      ...this.systemMetrics,
      activeConnections: this.userConnections.size
    };
  }

  /**
   * Get initial dashboard state
   */
  getInitialState() {
    return {
      metrics: this.getMetrics(),
      serverTime: new Date().toISOString()
    };
  }

  /**
   * Generate unique event ID
   */
  generateEventId() {
    return `evt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Update metrics periodically
   */
  startMetricsHeartbeat() {
    setInterval(() => {
      this.broadcastSystemStatus({
        activeConnections: this.userConnections.size,
        lastUpdated: new Date()
      });
    }, 30000); // Every 30 seconds
  }

  /**
   * Handle connection errors
   */
  handleError(socket, error) {
    console.error(`[WebSocket Error] ${socket.id}: ${error.message}`);
    socket.emit('connection-error', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get connection details
   */
  getConnectionDetails(socketId) {
    return this.userConnections.get(socketId);
  }

  /**
   * Get all active connections
   */
  getAllConnections() {
    return Array.from(this.userConnections.values());
  }
}

module.exports = RealtimeDataBroadcaster;
