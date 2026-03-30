const { EventEmitter } = require('events');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TransactionMonitor extends EventEmitter {
  constructor() {
    super();
    this.db = null;
    this.monitoringInterval = null;
    this.isRunning = false;
    this.checkInterval = 5000; // 5 seconds
    this.pendingTransactions = new Map(); // transactionId -> transaction data
  }

  async initialize() {
    try {
      await this.connectDatabase();
      await this.createTransactionTable();
      this.startMonitoring();
      console.log('[TransactionMonitor] Initialized successfully');
    } catch (error) {
      console.error('[TransactionMonitor] Initialization failed:', error);
      throw error;
    }
  }

  async connectDatabase() {
    return new Promise((resolve, reject) => {
      const DB_PATH = path.join(__dirname, '../../database', 'healthcare.sqlite');
      this.db = new sqlite3.Database(DB_PATH, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('[TransactionMonitor] Database connected');
          resolve();
        }
      });
    });
  }

  async createTransactionTable() {
    return new Promise((resolve, reject) => {
      const createTableSQL = `
        CREATE TABLE IF NOT EXISTS transactions (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          type TEXT NOT NULL,
          amount REAL,
          currency TEXT DEFAULT 'USD',
          status TEXT DEFAULT 'pending',
          hash TEXT,
          block_number INTEGER,
          gas_used INTEGER,
          gas_price TEXT,
          from_address TEXT,
          to_address TEXT,
          data TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          confirmed_at DATETIME,
          failed_at DATETIME,
          error_message TEXT,
          metadata TEXT
        )
      `;

      this.db.run(createTableSQL, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('[TransactionMonitor] Transactions table ready');
          resolve();
        }
      });
    });
  }

  startMonitoring() {
    if (this.isRunning) return;

    this.isRunning = true;
    this.monitoringInterval = setInterval(() => {
      this.checkPendingTransactions();
    }, this.checkInterval);

    console.log('[TransactionMonitor] Started monitoring pending transactions');
  }

  stopMonitoring() {
    if (!this.isRunning) return;

    this.isRunning = false;
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    console.log('[TransactionMonitor] Stopped monitoring');
  }

  async addTransaction(transactionData) {
    const {
      id,
      userId,
      type,
      amount,
      currency = 'USD',
      hash,
      fromAddress,
      toAddress,
      data,
      metadata
    } = transactionData;

    const transaction = {
      id,
      userId,
      type,
      amount,
      currency,
      status: 'pending',
      hash,
      fromAddress,
      toAddress,
      data: JSON.stringify(data || {}),
      metadata: JSON.stringify(metadata || {}),
      createdAt: new Date().toISOString()
    };

    // Store in memory for quick access
    this.pendingTransactions.set(id, transaction);

    // Store in database
    await this.saveTransactionToDatabase(transaction);

    // Emit event
    this.emit('transactionAdded', transaction);

    console.log(`[TransactionMonitor] Added transaction ${id} for user ${userId}`);
    return transaction;
  }

  async saveTransactionToDatabase(transaction) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT OR REPLACE INTO transactions (
          id, user_id, type, amount, currency, status, hash,
          from_address, to_address, data, metadata, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;

      this.db.run(sql, [
        transaction.id,
        transaction.userId,
        transaction.type,
        transaction.amount,
        transaction.currency,
        transaction.status,
        transaction.hash,
        transaction.fromAddress,
        transaction.toAddress,
        transaction.data,
        transaction.metadata,
        transaction.createdAt
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.lastID);
        }
      });
    });
  }

  async updateTransactionStatus(transactionId, status, additionalData = {}) {
    const transaction = this.pendingTransactions.get(transactionId);
    if (!transaction) {
      // Try to fetch from database
      const dbTransaction = await this.getTransactionFromDatabase(transactionId);
      if (dbTransaction) {
        this.pendingTransactions.set(transactionId, dbTransaction);
      } else {
        console.warn(`[TransactionMonitor] Transaction ${transactionId} not found`);
        return null;
      }
    }

    const updatedTransaction = {
      ...this.pendingTransactions.get(transactionId),
      status,
      updatedAt: new Date().toISOString(),
      ...additionalData
    };

    // Update timestamp based on status
    if (status === 'confirmed') {
      updatedTransaction.confirmedAt = new Date().toISOString();
    } else if (status === 'failed') {
      updatedTransaction.failedAt = new Date().toISOString();
    }

    // Update in memory
    this.pendingTransactions.set(transactionId, updatedTransaction);

    // Update in database
    await this.updateTransactionInDatabase(transactionId, updatedTransaction);

    // Emit status change event
    this.emit('statusChanged', {
      transactionId,
      oldStatus: transaction.status,
      newStatus: status,
      transaction: updatedTransaction
    });

    console.log(`[TransactionMonitor] Updated transaction ${transactionId} status to ${status}`);
    return updatedTransaction;
  }

  async updateTransactionInDatabase(transactionId, transaction) {
    return new Promise((resolve, reject) => {
      const sql = `
        UPDATE transactions SET
          status = ?, updated_at = ?, confirmed_at = ?, failed_at = ?,
          block_number = ?, gas_used = ?, gas_price = ?, error_message = ?,
          hash = ?, metadata = ?
        WHERE id = ?
      `;

      this.db.run(sql, [
        transaction.status,
        transaction.updatedAt,
        transaction.confirmedAt || null,
        transaction.failedAt || null,
        transaction.blockNumber || null,
        transaction.gasUsed || null,
        transaction.gasPrice || null,
        transaction.errorMessage || null,
        transaction.hash,
        transaction.metadata,
        transactionId
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes);
        }
      });
    });
  }

  async getTransactionFromDatabase(transactionId) {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM transactions WHERE id = ?';
      
      this.db.get(sql, [transactionId], (err, row) => {
        if (err) {
          reject(err);
        } else if (row) {
          // Parse JSON fields
          const transaction = {
            ...row,
            data: row.data ? JSON.parse(row.data) : {},
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          };
          resolve(transaction);
        } else {
          resolve(null);
        }
      });
    });
  }

  async checkPendingTransactions() {
    try {
      // Get all pending transactions from database
      const pendingTransactions = await this.getPendingTransactionsFromDatabase();

      for (const transaction of pendingTransactions) {
        await this.checkTransactionStatus(transaction);
      }
    } catch (error) {
      console.error('[TransactionMonitor] Error checking pending transactions:', error);
    }
  }

  async getPendingTransactionsFromDatabase() {
    return new Promise((resolve, reject) => {
      const sql = 'SELECT * FROM transactions WHERE status IN ("pending", "confirming")';
      
      this.db.all(sql, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const transactions = rows.map(row => ({
            ...row,
            data: row.data ? JSON.parse(row.data) : {},
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          }));
          resolve(transactions);
        }
      });
    });
  }

  async checkTransactionStatus(transaction) {
    try {
      // Simulate blockchain checking - in real implementation, this would
      // query the blockchain network for transaction status
      const mockStatus = await this.simulateBlockchainCheck(transaction);
      
      if (mockStatus !== transaction.status) {
        await this.updateTransactionStatus(transaction.id, mockStatus, mockStatus === 'confirmed' ? {
          blockNumber: Math.floor(Math.random() * 1000000) + 1000000,
          gasUsed: Math.floor(Math.random() * 100000) + 21000
        } : mockStatus === 'failed' ? {
          errorMessage: 'Transaction failed due to insufficient gas'
        } : {});
      }
    } catch (error) {
      console.error(`[TransactionMonitor] Error checking transaction ${transaction.id}:`, error);
      await this.updateTransactionStatus(transaction.id, 'failed', {
        errorMessage: error.message
      });
    }
  }

  async simulateBlockchainCheck(transaction) {
    // Simulate different status transitions based on time
    const now = Date.now();
    const createdAt = new Date(transaction.created_at).getTime();
    const timeDiff = now - createdAt;

    // For demo purposes: pending -> confirming (after 10s) -> confirmed (after 20s)
    if (timeDiff > 20000) {
      return 'confirmed';
    } else if (timeDiff > 10000) {
      return 'confirming';
    } else {
      return 'pending';
    }
  }

  async getUserTransactions(userId, limit = 50, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM transactions 
        WHERE user_id = ? 
        ORDER BY created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(sql, [userId, limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          const transactions = rows.map(row => ({
            ...row,
            data: row.data ? JSON.parse(row.data) : {},
            metadata: row.metadata ? JSON.parse(row.metadata) : {}
          }));
          resolve(transactions);
        }
      });
    });
  }

  async getTransaction(transactionId) {
    // Check memory first
    const memoryTransaction = this.pendingTransactions.get(transactionId);
    if (memoryTransaction) {
      return memoryTransaction;
    }

    // Check database
    return await this.getTransactionFromDatabase(transactionId);
  }

  getStats() {
    return {
      isRunning: this.isRunning,
      pendingCount: this.pendingTransactions.size,
      checkInterval: this.checkInterval
    };
  }

  async shutdown() {
    this.stopMonitoring();
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('[TransactionMonitor] Error closing database:', err);
        } else {
          console.log('[TransactionMonitor] Database closed');
        }
      });
    }
  }
}

module.exports = TransactionMonitor;
