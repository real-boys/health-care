const jwt = require('jsonwebtoken');
const { EventEmitter } = require('events');

class TransactionServer extends EventEmitter {
  constructor(io) {
    super();
    this.io = io;
    this.clients = new Map(); // socketId -> { userId, socket, subscriptions }
    this.transactionSubscriptions = new Map(); // transactionId -> Set of socketIds
    this.initialize();
  }

  initialize() {
    // Create namespace for transactions
    this.transactionNamespace = this.io.of('/ws/transactions');
    
    this.transactionNamespace.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.query.token;
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        socket.userId = decoded.userId;
        socket.userRole = decoded.role;
        
        next();
      } catch (error) {
        console.error('WebSocket authentication error:', error.message);
        next(new Error('Invalid authentication token'));
      }
    });

    this.transactionNamespace.on('connection', (socket) => {
      console.log(`Transaction WebSocket connected: ${socket.id} for user: ${socket.userId}`);
      
      // Store client info
      this.clients.set(socket.id, {
        userId: socket.userId,
        socket: socket,
        subscriptions: new Set()
      });

      // Handle subscription to transaction
      socket.on('subscribeTransaction', (data) => {
        this.handleSubscribeTransaction(socket, data);
      });

      // Handle unsubscribe from transaction
      socket.on('unsubscribeTransaction', (data) => {
        this.handleUnsubscribeTransaction(socket, data);
      });

      // Handle disconnect
      socket.on('disconnect', () => {
        this.handleDisconnect(socket);
      });

      // Send initial connection status
      socket.emit('connected', {
        status: 'connected',
        timestamp: new Date().toISOString(),
        userId: socket.userId
      });
    });
  }

  handleSubscribeTransaction(socket, data) {
    const { transactionId } = data;
    
    if (!transactionId) {
      socket.emit('error', { message: 'Transaction ID is required' });
      return;
    }

    const client = this.clients.get(socket.id);
    if (!client) return;

    // Add transaction to client's subscriptions
    client.subscriptions.add(transactionId);

    // Add socket to transaction subscribers
    if (!this.transactionSubscriptions.has(transactionId)) {
      this.transactionSubscriptions.set(transactionId, new Set());
    }
    this.transactionSubscriptions.get(transactionId).add(socket.id);

    console.log(`User ${socket.userId} subscribed to transaction ${transactionId}`);

    // Send confirmation
    socket.emit('subscribed', {
      transactionId,
      timestamp: new Date().toISOString()
    });

    // Emit event for monitoring
    this.emit('userSubscribed', {
      userId: socket.userId,
      transactionId,
      socketId: socket.id
    });
  }

  handleUnsubscribeTransaction(socket, data) {
    const { transactionId } = data;
    
    if (!transactionId) return;

    const client = this.clients.get(socket.id);
    if (!client) return;

    // Remove from client's subscriptions
    client.subscriptions.delete(transactionId);

    // Remove from transaction subscribers
    const subscribers = this.transactionSubscriptions.get(transactionId);
    if (subscribers) {
      subscribers.delete(socket.id);
      
      // Clean up empty transaction subscriptions
      if (subscribers.size === 0) {
        this.transactionSubscriptions.delete(transactionId);
      }
    }

    console.log(`User ${socket.userId} unsubscribed from transaction ${transactionId}`);

    // Send confirmation
    socket.emit('unsubscribed', {
      transactionId,
      timestamp: new Date().toISOString()
    });

    // Emit event for monitoring
    this.emit('userUnsubscribed', {
      userId: socket.userId,
      transactionId,
      socketId: socket.id
    });
  }

  handleDisconnect(socket) {
    const client = this.clients.get(socket.id);
    if (!client) return;

    console.log(`Transaction WebSocket disconnected: ${socket.id} for user: ${socket.userId}`);

    // Remove from all transaction subscriptions
    for (const transactionId of client.subscriptions) {
      const subscribers = this.transactionSubscriptions.get(transactionId);
      if (subscribers) {
        subscribers.delete(socket.id);
        
        // Clean up empty transaction subscriptions
        if (subscribers.size === 0) {
          this.transactionSubscriptions.delete(transactionId);
        }
      }
    }

    // Remove client
    this.clients.delete(socket.id);

    // Emit event for monitoring
    this.emit('userDisconnected', {
      userId: socket.userId,
      socketId: socket.id
    });
  }

  subscribeToTransaction(userId, transactionId) {
    // Find all sockets for this user
    const userSockets = [];
    for (const [socketId, client] of this.clients) {
      if (client.userId === userId) {
        userSockets.push(client.socket);
      }
    }

    // Subscribe each socket to the transaction
    userSockets.forEach(socket => {
      this.handleSubscribeTransaction(socket, { transactionId });
    });

    return userSockets.length;
  }

  broadcastStatusUpdate(transactionId, status, data = {}) {
    const subscribers = this.transactionSubscriptions.get(transactionId);
    
    if (!subscribers || subscribers.size === 0) {
      console.log(`No subscribers for transaction ${transactionId}`);
      return 0;
    }

    const update = {
      transactionId,
      status,
      timestamp: new Date().toISOString(),
      ...data
    };

    let sentCount = 0;
    subscribers.forEach(socketId => {
      const client = this.clients.get(socketId);
      if (client && client.socket.connected) {
        client.socket.emit('statusUpdate', update);
        sentCount++;
      }
    });

    console.log(`Broadcasted status update for transaction ${transactionId} to ${sentCount} clients`);

    // Emit event for monitoring
    this.emit('statusBroadcasted', {
      transactionId,
      status,
      recipientCount: sentCount,
      update
    });

    return sentCount;
  }

  getTransactionSubscribers(transactionId) {
    const subscribers = this.transactionSubscriptions.get(transactionId);
    if (!subscribers) return [];

    const subscriberInfo = [];
    subscribers.forEach(socketId => {
      const client = this.clients.get(socketId);
      if (client) {
        subscriberInfo.push({
          socketId,
          userId: client.userId
        });
      }
    });

    return subscriberInfo;
  }

  getConnectedClients() {
    const clients = [];
    this.clients.forEach((client, socketId) => {
      clients.push({
        socketId,
        userId: client.userId,
        subscriptions: Array.from(client.subscriptions),
        connected: client.socket.connected
      });
    });
    return clients;
  }

  // Health check method
  getStats() {
    return {
      connectedClients: this.clients.size,
      activeTransactions: this.transactionSubscriptions.size,
      totalSubscriptions: Array.from(this.transactionSubscriptions.values())
        .reduce((total, subscribers) => total + subscribers.size, 0)
    };
  }
}

module.exports = TransactionServer;
