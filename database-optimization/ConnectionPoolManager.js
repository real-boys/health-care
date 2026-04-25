// Connection Pool Management for Database Performance
const mongoose = require('mongoose');

class ConnectionPoolManager {
  constructor(options = {}) {
    this.pools = new Map();
    this.poolConfig = {
      maxPoolSize: options.maxPoolSize || 100,
      minPoolSize: options.minPoolSize || 10,
      maxIdleTimeMS: options.maxIdleTimeMS || 45000,
      waitQueueTimeoutMS: options.waitQueueTimeoutMS || 10000,
    };
    this.poolMetrics = {
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      totalRequests: 0,
      totalCheckouts: 0,
      averageWaitTime: 0
    };
  }

  /**
   * Create connection pool
   */
  async createPool(name, uri, options = {}) {
    try {
      const poolOptions = {
        ...this.poolConfig,
        ...options,
        serverSelectionTimeoutMS: options.serverSelectionTimeoutMS || 5000,
        socketTimeoutMS: options.socketTimeoutMS || 45000,
        retryWrites: options.retryWrites !== false,
        w: options.w || 'majority',
        j: options.j !== false,
        retryReads: options.retryReads !== false,
      };

      const connection = await mongoose.createConnection(uri, poolOptions);
      
      this.pools.set(name, {
        connection,
        uri,
        config: poolOptions,
        stats: {
          created: new Date(),
          checkouts: 0,
          totalWaitTime: 0,
          errors: 0
        }
      });

      console.log(`Connection pool created: ${name}`);
      return connection;
    } catch (error) {
      console.error(`Error creating connection pool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get connection from pool
   */
  async getConnection(name) {
    try {
      const pool = this.pools.get(name);
      if (!pool) {
        throw new Error(`Pool not found: ${name}`);
      }

      const startTime = Date.now();
      this.poolMetrics.waitingRequests++;
      this.poolMetrics.totalRequests++;

      const connection = pool.connection;

      const waitTime = Date.now() - startTime;
      pool.stats.checkouts++;
      pool.stats.totalWaitTime += waitTime;

      this.poolMetrics.totalCheckouts++;
      this.poolMetrics.averageWaitTime = 
        (this.poolMetrics.averageWaitTime * (this.poolMetrics.totalCheckouts - 1) + waitTime) / 
        this.poolMetrics.totalCheckouts;
      this.poolMetrics.waitingRequests--;

      return connection;
    } catch (error) {
      console.error(`Error getting connection from pool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get pool statistics
   */
  async getPoolStats(name) {
    try {
      const pool = this.pools.get(name);
      if (!pool) {
        throw new Error(`Pool not found: ${name}`);
      }

      const admin = pool.connection.db.admin();
      const stats = await admin.serverStatus();

      return {
        poolName: name,
        connected: pool.connection.readyState === 1,
        connections: {
          total: stats.connections?.current || 0,
          available: stats.connections?.available || 0,
          totalInUse: stats.connections?.totalInUse || 0
        },
        operations: {
          checkouts: pool.stats.checkouts,
          averageWaitTime: pool.stats.totalWaitTime / (pool.stats.checkouts || 1),
          errors: pool.stats.errors
        },
        config: this.poolConfig
      };
    } catch (error) {
      console.error(`Error getting pool stats for ${name}:`, error);
      throw error;
    }
  }

  /**
   * Close pool
   */
  async closePool(name) {
    try {
      const pool = this.pools.get(name);
      if (pool) {
        await pool.connection.close();
        this.pools.delete(name);
        console.log(`Connection pool closed: ${name}`);
      }
    } catch (error) {
      console.error(`Error closing pool ${name}:`, error);
      throw error;
    }
  }

  /**
   * Close all pools
   */
  async closeAllPools() {
    try {
      for (const [name] of this.pools) {
        await this.closePool(name);
      }
      console.log('All connection pools closed');
    } catch (error) {
      console.error('Error closing all pools:', error);
      throw error;
    }
  }

  /**
   * Get global metrics
   */
  getMetrics() {
    return this.poolMetrics;
  }

  /**
   * Get all pool statistics
   */
  async getAllPoolStats() {
    try {
      const allStats = [];
      for (const [name] of this.pools) {
        const stats = await this.getPoolStats(name);
        allStats.push(stats);
      }
      return allStats;
    } catch (error) {
      console.error('Error getting all pool stats:', error);
      throw error;
    }
  }
}

module.exports = ConnectionPoolManager;
