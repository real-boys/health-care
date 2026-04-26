// CQRS Pattern Implementation - Query Handler
const { Projection } = require('../eventstore/EventStoreSchema');
const { v4: uuidv4 } = require('uuid');

class QueryBus {
  constructor(options = {}) {
    this.handlers = new Map();
    this.eventStore = options.eventStore;
    this.queryMetrics = {
      executed: 0,
      failed: 0,
      lastExecuted: null,
      averageExecutionTime: 0,
    };
  }

  /**
   * Register query handler
   */
  registerHandler(queryType, handler) {
    this.handlers.set(queryType, handler);
    console.log(`Query handler registered: ${queryType}`);
  }

  /**
   * Execute query
   */
  async execute(query, options = {}) {
    const startTime = Date.now();

    try {
      const queryType = query.constructor.name || query.queryType;
      const handler = this.handlers.get(queryType);

      if (!handler) {
        throw new Error(`No handler registered for query: ${queryType}`);
      }

      const result = await handler(query, {
        eventStore: this.eventStore,
      });

      const executionTime = Date.now() - startTime;
      this.queryMetrics.executed++;
      this.queryMetrics.lastExecuted = new Date();

      // Update average execution time
      this.queryMetrics.averageExecutionTime = 
        (this.queryMetrics.averageExecutionTime * (this.queryMetrics.executed - 1) + executionTime) / 
        this.queryMetrics.executed;

      console.log(`Query executed: ${queryType} (${executionTime}ms)`);
      return result;
    } catch (error) {
      this.queryMetrics.failed++;
      console.error(`Error executing query:`, error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.queryMetrics;
  }
}

module.exports = QueryBus;
