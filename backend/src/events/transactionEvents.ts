const { EventEmitter } = require('events');

class TransactionEvents extends EventEmitter {
  constructor(transactionServer, transactionMonitor) {
    super();
    this.transactionServer = transactionServer;
    this.transactionMonitor = transactionMonitor;
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Listen to transaction monitor events
    this.transactionMonitor.on('transactionAdded', (transaction) => {
      this.handleTransactionAdded(transaction);
    });

    this.transactionMonitor.on('statusChanged', (data) => {
      this.handleStatusChanged(data);
    });

    // Listen to transaction server events
    this.transactionServer.on('userSubscribed', (data) => {
      this.handleUserSubscribed(data);
    });

    this.transactionServer.on('userUnsubscribed', (data) => {
      this.handleUserUnsubscribed(data);
    });

    this.transactionServer.on('userDisconnected', (data) => {
      this.handleUserDisconnected(data);
    });

    this.transactionServer.on('statusBroadcasted', (data) => {
      this.handleStatusBroadcasted(data);
    });
  }

  handleTransactionAdded(transaction) {
    console.log(`[TransactionEvents] New transaction added: ${transaction.id}`);
    
    // Auto-subscribe user to their own transaction
    const subscribedSockets = this.transactionServer.subscribeToTransaction(
      transaction.userId, 
      transaction.id
    );

    // Broadcast initial pending status
    this.transactionServer.broadcastStatusUpdate(
      transaction.id,
      transaction.status,
      {
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        createdAt: transaction.createdAt
      }
    );

    // Emit for other services to listen
    this.emit('transactionCreated', {
      transactionId: transaction.id,
      userId: transaction.userId,
      status: transaction.status,
      autoSubscribedSockets: subscribedSockets
    });
  }

  handleStatusChanged(data) {
    const { transactionId, oldStatus, newStatus, transaction } = data;
    
    console.log(`[TransactionEvents] Status changed: ${transactionId} ${oldStatus} -> ${newStatus}`);

    // Prepare status update data
    const updateData = {
      type: transaction.type,
      amount: transaction.amount,
      currency: transaction.currency,
      oldStatus,
      newStatus,
      updatedAt: transaction.updatedAt
    };

    // Add blockchain-specific data if available
    if (transaction.blockNumber) {
      updateData.blockNumber = transaction.blockNumber;
    }
    if (transaction.gasUsed) {
      updateData.gasUsed = transaction.gasUsed;
    }
    if (transaction.errorMessage) {
      updateData.errorMessage = transaction.errorMessage;
    }

    // Broadcast to subscribed clients
    const broadcastCount = this.transactionServer.broadcastStatusUpdate(
      transactionId,
      newStatus,
      updateData
    );

    // Emit for analytics/monitoring
    this.emit('transactionStatusUpdate', {
      transactionId,
      userId: transaction.userId,
      oldStatus,
      newStatus,
      broadcastCount,
      transaction
    });

    // Handle special cases
    if (newStatus === 'confirmed') {
      this.handleTransactionConfirmed(transaction);
    } else if (newStatus === 'failed') {
      this.handleTransactionFailed(transaction);
    }
  }

  handleTransactionConfirmed(transaction) {
    console.log(`[TransactionEvents] Transaction confirmed: ${transaction.id}`);
    
    // Emit specific confirmed event
    this.emit('transactionConfirmed', {
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      confirmedAt: transaction.confirmedAt,
      blockNumber: transaction.blockNumber
    });

    // Could trigger additional business logic here:
    // - Update user balance
    // - Send confirmation email
    // - Update related records
  }

  handleTransactionFailed(transaction) {
    console.log(`[TransactionEvents] Transaction failed: ${transaction.id}`);
    
    // Emit specific failed event
    this.emit('transactionFailed', {
      transactionId: transaction.id,
      userId: transaction.userId,
      amount: transaction.amount,
      failedAt: transaction.failedAt,
      errorMessage: transaction.errorMessage
    });

    // Could trigger additional business logic here:
    // - Notify user of failure
    // - Log for investigation
    // - Auto-retry if applicable
  }

  handleUserSubscribed(data) {
    const { userId, transactionId, socketId } = data;
    
    console.log(`[TransactionEvents] User ${userId} subscribed to ${transactionId}`);
    
    // Check if transaction exists and send current status
    this.transactionMonitor.getTransaction(transactionId).then(transaction => {
      if (transaction) {
        // Send current status to newly subscribed user
        this.transactionServer.broadcastStatusUpdate(
          transactionId,
          transaction.status,
          {
            type: transaction.type,
            amount: transaction.amount,
            currency: transaction.currency,
            createdAt: transaction.createdAt,
            updatedAt: transaction.updatedAt
          }
        );
      }
    });

    this.emit('userSubscription', {
      userId,
      transactionId,
      socketId,
      action: 'subscribe'
    });
  }

  handleUserUnsubscribed(data) {
    const { userId, transactionId, socketId } = data;
    
    console.log(`[TransactionEvents] User ${userId} unsubscribed from ${transactionId}`);
    
    this.emit('userSubscription', {
      userId,
      transactionId,
      socketId,
      action: 'unsubscribe'
    });
  }

  handleUserDisconnected(data) {
    const { userId, socketId } = data;
    
    console.log(`[TransactionEvents] User ${userId} disconnected: ${socketId}`);
    
    this.emit('userDisconnection', {
      userId,
      socketId
    });
  }

  handleStatusBroadcasted(data) {
    const { transactionId, status, recipientCount, update } = data;
    
    console.log(`[TransactionEvents] Status broadcasted: ${transactionId} -> ${recipientCount} clients`);
    
    this.emit('broadcastMetrics', {
      transactionId,
      status,
      recipientCount,
      timestamp: update.timestamp
    });
  }

  // Utility methods for external services
  async createTransaction(transactionData) {
    const transaction = await this.transactionMonitor.addTransaction(transactionData);
    return transaction;
  }

  async getTransactionStatus(transactionId) {
    const transaction = await this.transactionMonitor.getTransaction(transactionId);
    return transaction ? transaction.status : null;
  }

  async getUserTransactions(userId, options = {}) {
    const { limit = 50, offset = 0 } = options;
    return await this.transactionMonitor.getUserTransactions(userId, limit, offset);
  }

  getActiveSubscriptions(transactionId) {
    return this.transactionServer.getTransactionSubscribers(transactionId);
  }

  getSystemStats() {
    return {
      transactionMonitor: this.transactionMonitor.getStats(),
      transactionServer: this.transactionServer.getStats()
    };
  }

  // Graceful shutdown
  async shutdown() {
    console.log('[TransactionEvents] Shutting down...');
    
    if (this.transactionMonitor) {
      await this.transactionMonitor.shutdown();
    }
    
    this.removeAllListeners();
    console.log('[TransactionEvents] Shutdown complete');
  }
}

module.exports = TransactionEvents;
