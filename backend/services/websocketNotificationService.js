const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

class WebSocketNotificationService {
  constructor(io) {
    this.io = io;
    this.connectedUsers = new Map(); // userId -> Set of socket connections
    this.userSessions = new Map(); // socketId -> { userId, role, connectedAt, lastActivity }
    this.notificationQueue = new Map(); // userId -> Array of pending notifications
    this.initializeSocketHandlers();
  }

  initializeSocketHandlers() {
    this.io.use(this.authenticateSocket.bind(this));
    
    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.id})`);
      
      // Register user connection
      this.registerUserConnection(socket);
      
      // Handle joining notification rooms
      socket.on('join-notifications', (data) => {
        this.handleJoinNotifications(socket, data);
      });
      
      // Handle leaving notification rooms
      socket.on('leave-notifications', (data) => {
        this.handleLeaveNotifications(socket, data);
      });
      
      // Handle marking notifications as read
      socket.on('mark-notification-read', (data) => {
        this.handleMarkNotificationRead(socket, data);
      });
      
      // Handle notification preferences update
      socket.on('update-preferences', (data) => {
        this.handleUpdatePreferences(socket, data);
      });
      
      // Handle typing indicators for real-time features
      socket.on('typing-start', (data) => {
        this.handleTypingStart(socket, data);
      });
      
      socket.on('typing-stop', (data) => {
        this.handleTypingStop(socket, data);
      });
      
      // Handle real-time status updates
      socket.on('status-update', (data) => {
        this.handleStatusUpdate(socket, data);
      });
      
      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });
      
      // Handle errors
      socket.on('error', (error) => {
        console.error(`Socket error for user ${socket.userId}:`, error);
      });
      
      // Send pending notifications
      this.sendPendingNotifications(socket);
    });
  }

  async authenticateSocket(socket, next) {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      socket.deviceId = socket.handshake.query.deviceId || 'unknown';
      socket.userAgent = socket.handshake.headers['user-agent'] || 'unknown';
      
      next();
    } catch (error) {
      console.error('Socket authentication error:', error);
      next(new Error('Invalid authentication token'));
    }
  }

  registerUserConnection(socket) {
    const userId = socket.userId;
    const sessionId = uuidv4();
    
    // Store session information
    this.userSessions.set(socket.id, {
      userId,
      role: socket.userRole,
      deviceId: socket.deviceId,
      userAgent: socket.userAgent,
      connectedAt: new Date(),
      lastActivity: new Date(),
      sessionId
    });
    
    // Add to connected users
    if (!this.connectedUsers.has(userId)) {
      this.connectedUsers.set(userId, new Set());
    }
    this.connectedUsers.get(userId).add(socket.id);
    
    // Join user-specific room
    socket.join(`user:${userId}`);
    socket.join(`patient:${userId}`); // For backward compatibility
    
    // Join role-based rooms
    socket.join(`role:${socket.userRole}`);
    
    // Send connection confirmation
    socket.emit('connected', {
      sessionId,
      userId,
      connectedAt: new Date(),
      activeConnections: this.connectedUsers.get(userId).size
    });
    
    // Broadcast user online status (optional)
    this.broadcastUserStatus(userId, 'online');
    
    console.log(`User ${userId} connected with ${this.connectedUsers.get(userId).size} active connections`);
  }

  handleJoinNotifications(socket, data) {
    const { rooms = [] } = data;
    
    rooms.forEach(room => {
      socket.join(room);
      console.log(`User ${socket.userId} joined room: ${room}`);
    });
    
    socket.emit('joined-notifications', { rooms });
  }

  handleLeaveNotifications(socket, data) {
    const { rooms = [] } = data;
    
    rooms.forEach(room => {
      socket.leave(room);
      console.log(`User ${socket.userId} left room: ${room}`);
    });
    
    socket.emit('left-notifications', { rooms });
  }

  async handleMarkNotificationRead(socket, data) {
    try {
      const { notificationId } = data;
      
      if (!notificationId) {
        socket.emit('error', { message: 'Notification ID is required' });
        return;
      }
      
      // Update notification in database
      const NotificationService = require('./notificationService');
      const notificationService = new NotificationService(this.io);
      
      await notificationService.markNotificationAsRead(notificationId, socket.userId);
      
      // Send confirmation
      socket.emit('notification-marked-read', { notificationId });
      
      // Update user activity
      this.updateUserActivity(socket.id);
      
    } catch (error) {
      console.error('Error marking notification as read:', error);
      socket.emit('error', { message: 'Failed to mark notification as read' });
    }
  }

  async handleUpdatePreferences(socket, data) {
    try {
      const UserPreferenceService = require('./userPreferenceService');
      const preferenceService = new UserPreferenceService();
      
      await preferenceService.updateUserPreferences(socket.userId, data.preferences);
      
      socket.emit('preferences-updated', { preferences: data.preferences });
      this.updateUserActivity(socket.id);
      
    } catch (error) {
      console.error('Error updating preferences:', error);
      socket.emit('error', { message: 'Failed to update preferences' });
    }
  }

  handleTypingStart(socket, data) {
    const { room, context } = data;
    
    if (room) {
      socket.to(room).emit('user-typing', {
        userId: socket.userId,
        typing: true,
        context
      });
    }
  }

  handleTypingStop(socket, data) {
    const { room, context } = data;
    
    if (room) {
      socket.to(room).emit('user-typing', {
        userId: socket.userId,
        typing: false,
        context
      });
    }
  }

  handleStatusUpdate(socket, data) {
    const { status, metadata = {} } = data;
    
    // Broadcast to relevant rooms
    if (metadata.room) {
      socket.to(metadata.room).emit('user-status-update', {
        userId: socket.userId,
        status,
        timestamp: new Date(),
        metadata
      });
    }
    
    this.updateUserActivity(socket.id);
  }

  handleDisconnect(socket) {
    const session = this.userSessions.get(socket.id);
    
    if (session) {
      const userId = session.userId;
      
      // Remove from connected users
      if (this.connectedUsers.has(userId)) {
        this.connectedUsers.get(userId).delete(socket.id);
        
        if (this.connectedUsers.get(userId).size === 0) {
          this.connectedUsers.delete(userId);
          this.broadcastUserStatus(userId, 'offline');
        }
      }
      
      // Remove session
      this.userSessions.delete(socket.id);
      
      console.log(`User ${userId} disconnected. Remaining connections: ${this.connectedUsers.get(userId)?.size || 0}`);
    }
  }

  sendPendingNotifications(socket) {
    const userId = socket.userId;
    
    if (this.notificationQueue.has(userId)) {
      const pending = this.notificationQueue.get(userId);
      
      pending.forEach(notification => {
        socket.emit('notification', notification);
      });
      
      // Clear pending notifications
      this.notificationQueue.delete(userId);
      
      console.log(`Sent ${pending.length} pending notifications to user ${userId}`);
    }
  }

  async sendNotificationToUser(userId, notification) {
    const userSockets = this.connectedUsers.get(userId);
    
    if (userSockets && userSockets.size > 0) {
      // User is online, send real-time
      const notificationData = {
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        timestamp: new Date().toISOString(),
        data: notification.data || {}
      };
      
      // Send to all user connections
      this.io.to(`user:${userId}`).emit('notification', notificationData);
      
      console.log(`Real-time notification sent to user ${userId} (${userSockets.size} connections)`);
      
      return {
        success: true,
        method: 'websocket',
        connections: userSockets.size
      };
    } else {
      // User is offline, queue for later
      if (!this.notificationQueue.has(userId)) {
        this.notificationQueue.set(userId, []);
      }
      
      this.notificationQueue.get(userId).push({
        id: notification.id,
        title: notification.title,
        message: notification.message,
        type: notification.type,
        priority: notification.priority,
        timestamp: new Date().toISOString(),
        data: notification.data || {}
      });
      
      console.log(`Notification queued for offline user ${userId}`);
      
      return {
        success: true,
        method: 'queued',
        queued: true
      };
    }
  }

  async sendNotificationToRole(role, notification) {
    const notificationData = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      timestamp: new Date().toISOString(),
      data: notification.data || {},
      broadcast: true
    };
    
    // Send to all users with the specified role
    this.io.to(`role:${role}`).emit('notification', notificationData);
    
    console.log(`Role-based notification sent to role: ${role}`);
    
    return {
      success: true,
      method: 'role_broadcast',
      role
    };
  }

  async sendNotificationToRoom(room, notification) {
    const notificationData = {
      id: notification.id,
      title: notification.title,
      message: notification.message,
      type: notification.type,
      priority: notification.priority,
      timestamp: new Date().toISOString(),
      data: notification.data || {},
      room
    };
    
    // Send to all users in the room
    this.io.to(room).emit('notification', notificationData);
    
    console.log(`Room-based notification sent to room: ${room}`);
    
    return {
      success: true,
      method: 'room_broadcast',
      room
    };
  }

  broadcastUserStatus(userId, status) {
    this.io.emit('user-status', {
      userId,
      status,
      timestamp: new Date()
    });
  }

  updateUserActivity(socketId) {
    const session = this.userSessions.get(socketId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  getConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  getUserConnections(userId) {
    return this.connectedUsers.get(userId)?.size || 0;
  }

  getUserSessions(userId) {
    const sessions = [];
    
    for (const [socketId, session] of this.userSessions) {
      if (session.userId === userId) {
        sessions.push({
          socketId,
          deviceId: session.deviceId,
          userAgent: session.userAgent,
          connectedAt: session.connectedAt,
          lastActivity: session.lastActivity
        });
      }
    }
    
    return sessions;
  }

  getActiveUsersCount() {
    return this.connectedUsers.size;
  }

  getTotalConnectionsCount() {
    let total = 0;
    for (const connections of this.connectedUsers.values()) {
      total += connections.size;
    }
    return total;
  }

  async sendSystemNotification(notification) {
    const notificationData = {
      id: uuidv4(),
      title: notification.title,
      message: notification.message,
      type: 'system',
      priority: notification.priority || 'medium',
      timestamp: new Date().toISOString(),
      data: notification.data || {},
      system: true
    };
    
    // Send to all connected users
    this.io.emit('notification', notificationData);
    
    console.log('System notification sent to all users');
    
    return {
      success: true,
      method: 'system_broadcast',
      recipients: this.getTotalConnectionsCount()
    };
  }

  async cleanupInactiveSessions() {
    const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
    const now = new Date();
    
    for (const [socketId, session] of this.userSessions) {
      if (now - session.lastActivity > inactiveThreshold) {
        const socket = this.io.sockets.sockets.get(socketId);
        if (socket) {
          socket.disconnect(true);
          console.log(`Disconnected inactive user: ${session.userId}`);
        }
      }
    }
  }

  getStats() {
    return {
      activeUsers: this.getActiveUsersCount(),
      totalConnections: this.getTotalConnectionsCount(),
      queuedNotifications: Array.from(this.notificationQueue.values())
        .reduce((total, queue) => total + queue.length, 0),
      averageConnectionsPerUser: this.getActiveUsersCount() > 0 ? 
        this.getTotalConnectionsCount() / this.getActiveUsersCount() : 0
    };
  }

  // Graceful shutdown
  shutdown() {
    console.log('Shutting down WebSocket notification service...');
    
    // Notify all connected users
    this.io.emit('server-shutdown', {
      message: 'Server is shutting down for maintenance',
      timestamp: new Date()
    });
    
    // Close all connections
    this.io.close(() => {
      console.log('WebSocket notification service shutdown complete');
    });
  }
}

module.exports = WebSocketNotificationService;
