// Database Sharding Configuration and Management
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

class ShardingManager {
  constructor(options = {}) {
    this.shards = new Map();
    this.shardKey = options.shardKey || '_id';
    this.numberOfShards = options.numberOfShards || 4;
    this.shardingStrategy = options.strategy || 'range'; // 'range', 'hash', 'directory'
    this.connections = new Map();
    this.metrics = {
      shardDistribution: {},
      rebalances: 0,
      lastRebalance: null
    };
  }

  /**
   * Initialize shard connections
   */
  async initializeShards(shardConfigs) {
    try {
      console.log(`Initializing ${shardConfigs.length} shards...`);

      for (const config of shardConfigs) {
        const connection = await mongoose.createConnection(config.uri, {
          maxPoolSize: config.maxPoolSize || 100,
          minPoolSize: config.minPoolSize || 10,
        });

        this.connections.set(config.name, connection);
        this.shards.set(config.name, config);
        console.log(`Shard initialized: ${config.name}`);
      }
    } catch (error) {
      console.error('Error initializing shards:', error);
      throw error;
    }
  }

  /**
   * Determine shard for a key
   */
  getShardForKey(key) {
    let shardIndex;

    switch (this.shardingStrategy) {
      case 'hash':
        // Hash-based sharding
        shardIndex = this.hashKey(key) % this.numberOfShards;
        break;

      case 'range':
        // Range-based sharding
        shardIndex = this.getRangeIndex(key);
        break;

      case 'directory':
        // Directory-based sharding
        shardIndex = this.getDirectoryIndex(key);
        break;

      default:
        shardIndex = 0;
    }

    const shardNames = Array.from(this.shards.keys());
    return shardNames[shardIndex % shardNames.length];
  }

  /**
   * Hash function for consistent hashing
   */
  hashKey(key) {
    let hash = 0;
    const str = typeof key === 'string' ? key : JSON.stringify(key);

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }

    return Math.abs(hash);
  }

  /**
   * Range-based sharding
   */
  getRangeIndex(key) {
    if (typeof key === 'number') {
      return Math.floor(key / (100000 / this.numberOfShards));
    }
    return this.hashKey(key) % this.numberOfShards;
  }

  /**
   * Directory-based sharding
   */
  getDirectoryIndex(key) {
    // Look up in directory table
    // For now, fall back to hash
    return this.hashKey(key) % this.numberOfShards;
  }

  /**
   * Get connection for shard
   */
  getConnection(shardName) {
    if (!this.connections.has(shardName)) {
      throw new Error(`Shard not found: ${shardName}`);
    }
    return this.connections.get(shardName);
  }

  /**
   * Insert document into appropriate shard
   */
  async insertDocument(collection, key, document) {
    try {
      const shardName = this.getShardForKey(key);
      const connection = this.getConnection(shardName);
      
      const model = connection.model(collection);
      const result = await model.create({ ...document, _shard: shardName });

      // Update distribution metrics
      this.updateDistribution(shardName);

      return result;
    } catch (error) {
      console.error('Error inserting document:', error);
      throw error;
    }
  }

  /**
   * Find document across shards
   */
  async findDocument(collection, query) {
    try {
      const results = [];

      for (const [shardName, connection] of this.connections) {
        const model = connection.model(collection);
        const shardResults = await model.find({ ...query, _shard: shardName });
        results.push(...shardResults);
      }

      return results;
    } catch (error) {
      console.error('Error finding document:', error);
      throw error;
    }
  }

  /**
   * Update distribution metrics
   */
  updateDistribution(shardName) {
    if (!this.metrics.shardDistribution[shardName]) {
      this.metrics.shardDistribution[shardName] = 0;
    }
    this.metrics.shardDistribution[shardName]++;
  }

  /**
   * Rebalance shards
   */
  async rebalanceShard() {
    try {
      console.log('Starting shard rebalancing...');

      // Calculate current distribution
      const distribution = this.metrics.shardDistribution;
      const average = Object.values(distribution).reduce((a, b) => a + b, 0) / this.numberOfShards;

      // Identify over-loaded shards
      const overloaded = Object.entries(distribution)
        .filter(([_, count]) => count > average * 1.2)
        .map(([shard]) => shard);

      if (overloaded.length > 0) {
        console.log(`Rebalancing ${overloaded.length} overloaded shards`);
        // Implement rebalancing logic
        this.metrics.rebalances++;
        this.metrics.lastRebalance = new Date();
      }
    } catch (error) {
      console.error('Error rebalancing shards:', error);
      throw error;
    }
  }

  /**
   * Get shard statistics
   */
  async getShardStats() {
    try {
      const stats = {};

      for (const [shardName, connection] of this.connections) {
        const admin = connection.db.admin();
        const dbStats = await admin.serverStatus();
        stats[shardName] = {
          documents: dbStats.collections || 0,
          dataSize: dbStats.dataSize || 0,
          connections: dbStats.connections || {}
        };
      }

      return stats;
    } catch (error) {
      console.error('Error getting shard stats:', error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.metrics;
  }

  /**
   * Close all shard connections
   */
  async closeConnections() {
    for (const connection of this.connections.values()) {
      await connection.close();
    }
  }
}

module.exports = ShardingManager;
