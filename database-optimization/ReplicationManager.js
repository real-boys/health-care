// Read Replica Management and Replication Configuration
const mongoose = require('mongoose');

class ReplicationManager {
  constructor(options = {}) {
    this.primaryConnection = null;
    this.readReplicas = new Map();
    this.replicationMetrics = {
      syncErrors: 0,
      replicaLag: {},
      failovers: 0,
      lastSync: null
    };
  }

  /**
   * Initialize primary connection
   */
  async initializePrimary(uri, options = {}) {
    try {
      this.primaryConnection = await mongoose.createConnection(uri, {
        maxPoolSize: options.maxPoolSize || 50,
        minPoolSize: options.minPoolSize || 10,
        replicaSet: options.replicaSet,
        ...options
      });

      console.log('Primary connection initialized');
      return this.primaryConnection;
    } catch (error) {
      console.error('Error initializing primary:', error);
      throw error;
    }
  }

  /**
   * Add read replica
   */
  async addReadReplica(name, uri, options = {}) {
    try {
      const replicaConn = await mongoose.createConnection(uri, {
        maxPoolSize: options.maxPoolSize || 30,
        minPoolSize: options.minPoolSize || 5,
        readPreference: 'secondary',
        ...options
      });

      this.readReplicas.set(name, {
        connection: replicaConn,
        uri,
        status: 'active',
        lag: 0,
        lastSync: new Date()
      });

      console.log(`Read replica added: ${name}`);
      return replicaConn;
    } catch (error) {
      console.error(`Error adding read replica ${name}:`, error);
      throw error;
    }
  }

  /**
   * Get optimal read replica (least lag)
   */
  getOptimalReadReplica() {
    let optimalReplica = null;
    let minLag = Infinity;

    for (const [name, replica] of this.readReplicas) {
      if (replica.status === 'active' && replica.lag < minLag) {
        optimalReplica = name;
        minLag = replica.lag;
      }
    }

    return optimalReplica || 'primary';
  }

  /**
   * Execute write (always on primary)
   */
  async executeWrite(collection, operation, args) {
    try {
      if (!this.primaryConnection) {
        throw new Error('Primary connection not initialized');
      }

      const model = this.primaryConnection.model(collection);
      return await model[operation](...args);
    } catch (error) {
      console.error('Error executing write:', error);
      throw error;
    }
  }

  /**
   * Execute read (on optimal replica or primary)
   */
  async executeRead(collection, operation, args, options = {}) {
    try {
      const replicaName = options.useReplica ? this.getOptimalReadReplica() : 'primary';
      
      let connection;
      if (replicaName === 'primary') {
        connection = this.primaryConnection;
      } else {
        connection = this.readReplicas.get(replicaName).connection;
      }

      const model = connection.model(collection);
      return await model[operation](...args);
    } catch (error) {
      console.error('Error executing read:', error);
      throw error;
    }
  }

  /**
   * Monitor replication lag
   */
  async monitorReplicationLag() {
    try {
      for (const [name, replica] of this.readReplicas) {
        try {
          // Get serverStatus to check replication lag
          const admin = replica.connection.db.admin();
          const status = await admin.serverStatus();

          if (status.repl) {
            const lag = this.calculateReplicationLag(status.repl);
            replica.lag = lag;
            this.replicationMetrics.replicaLag[name] = lag;

            if (lag > 1000) { // More than 1 second lag
              console.warn(`[REPLICATION LAG] ${name}: ${lag}ms`);
            }
          }

          replica.status = 'active';
        } catch (error) {
          replica.status = 'error';
          this.replicationMetrics.syncErrors++;
          console.error(`Error monitoring replica ${name}:`, error);
        }
      }

      this.replicationMetrics.lastSync = new Date();
    } catch (error) {
      console.error('Error monitoring replication lag:', error);
      throw error;
    }
  }

  /**
   * Calculate replication lag
   */
  calculateReplicationLag(replStatus) {
    // Simplified calculation - in production use optime timestamps
    return replStatus.syncingTo ? 0 : 100;
  }

  /**
   * Perform replica election (failover)
   */
  async performFailover(failedReplica) {
    try {
      console.log(`Initiating failover for: ${failedReplica}`);

      const replica = this.readReplicas.get(failedReplica);
      if (replica) {
        replica.status = 'failed';
        this.replicationMetrics.failovers++;

        // Promote new primary if needed
        const optimalReplica = this.getOptimalReadReplica();
        if (optimalReplica && optimalReplica !== 'primary') {
          console.log(`Promoting replica: ${optimalReplica}`);
          // Implement promotion logic
        }
      }

      return true;
    } catch (error) {
      console.error('Error performing failover:', error);
      throw error;
    }
  }

  /**
   * Get replication status
   */
  async getReplicationStatus() {
    try {
      const status = {
        primary: this.primaryConnection ? 'active' : 'inactive',
        replicas: {},
        metrics: this.replicationMetrics
      };

      for (const [name, replica] of this.readReplicas) {
        status.replicas[name] = {
          status: replica.status,
          lag: replica.lag,
          lastSync: replica.lastSync
        };
      }

      return status;
    } catch (error) {
      console.error('Error getting replication status:', error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.replicationMetrics;
  }

  /**
   * Close all connections
   */
  async closeConnections() {
    try {
      if (this.primaryConnection) {
        await this.primaryConnection.close();
      }

      for (const [_, replica] of this.readReplicas) {
        await replica.connection.close();
      }

      this.readReplicas.clear();
      console.log('All replication connections closed');
    } catch (error) {
      console.error('Error closing connections:', error);
      throw error;
    }
  }
}

module.exports = ReplicationManager;
