// Query Optimization and Slow Query Analysis
const { promisify } = require('util');

class QueryOptimizer {
  constructor(options = {}) {
    this.slowQueryThreshold = options.slowQueryThreshold || 100; // milliseconds
    this.queryCache = new Map();
    this.queryMetrics = {
      totalQueries: 0,
      slowQueries: 0,
      cachedQueries: 0,
      averageExecutionTime: 0,
      slowQueryLog: []
    };
  }

  /**
   * Analyze query plan
   */
  async analyzeQuery(collection, query, options = {}) {
    try {
      const startTime = Date.now();
      
      // Run explain to get query plan
      const explain = await collection.find(query).explain('executionStats');
      
      const executionTime = Date.now() - startTime;

      return {
        executionTime,
        executionStats: explain.executionStats,
        isSlow: executionTime > this.slowQueryThreshold,
        recommendedIndexes: this.getIndexRecommendations(explain),
        optimization: this.analyzeExecutionStats(explain.executionStats)
      };
    } catch (error) {
      console.error('Error analyzing query:', error);
      throw error;
    }
  }

  /**
   * Analyze execution statistics
   */
  analyzeExecutionStats(stats) {
    return {
      documentsExamined: stats.totalDocsExamined || 0,
      documentsReturned: stats.nReturned || 0,
      executionStages: stats.executionStages?.stage,
      indexUsed: stats.executionStages?.stage !== 'COLLSCAN',
      efficiency: stats.nReturned && stats.totalDocsExamined ? 
        (stats.nReturned / stats.totalDocsExamined).toFixed(2) : 0,
      recommendations: this.getRecommendations(stats)
    };
  }

  /**
   * Get optimization recommendations
   */
  getRecommendations(stats) {
    const recommendations = [];

    // Check if collection scan occurred
    if (stats.executionStages?.stage === 'COLLSCAN') {
      recommendations.push('Create index to avoid collection scan');
    }

    // Check efficiency
    if (stats.nReturned && stats.totalDocsExamined) {
      const efficiency = stats.nReturned / stats.totalDocsExamined;
      if (efficiency < 0.1) {
        recommendations.push('Query efficiency is low, add more specific index');
      }
    }

    // Check sort
    if (stats.executionStages?.stage === 'SORT') {
      recommendations.push('Add index to avoid in-memory sort');
    }

    return recommendations;
  }

  /**
   * Get index recommendations based on query plan
   */
  getIndexRecommendations(explain) {
    const recommendations = [];
    const stats = explain.executionStats;

    if (stats.executionStages?.stage === 'COLLSCAN') {
      recommendations.push({
        type: 'CREATE_INDEX',
        priority: 'HIGH',
        reason: 'Collection scan detected'
      });
    }

    return recommendations;
  }

  /**
   * Profile slow queries
   */
  async profileSlowQueries(connection, db, options = {}) {
    try {
      const threshold = options.threshold || this.slowQueryThreshold;
      
      // Enable profiling
      await connection.db.setProfilingLevel('all');
      
      // Get slow queries from system.profile
      const slowQueries = await connection.db.collection('system.profile')
        .find({ millis: { $gt: threshold } })
        .sort({ millis: -1 })
        .limit(options.limit || 100)
        .toArray();

      // Disable profiling
      await connection.db.setProfilingLevel('off');

      return slowQueries.map(q => ({
        namespace: q.ns,
        operation: q.op,
        duration: q.millis,
        docsExamined: q.docsExamined,
        docsReturned: q.nReturned,
        query: q.command?.find || q.command?.update || q.command?.delete,
        timestamp: q.ts,
        recommendation: this.getSlowQueryRecommendation(q)
      }));
    } catch (error) {
      console.error('Error profiling slow queries:', error);
      throw error;
    }
  }

  /**
   * Get recommendation for slow query
   */
  getSlowQueryRecommendation(query) {
    const recommendations = [];

    if (query.docsExamined > query.nReturned * 10) {
      recommendations.push('Add index to reduce docs examined');
    }

    if (query.millis > 1000) {
      recommendations.push('Query takes >1 second, optimize or add caching');
    }

    return recommendations;
  }

  /**
   * Optimize aggregation pipeline
   */
  optimizeAggregation(pipeline) {
    const optimizations = [];

    // Move $match early
    let matchStage = null;
    let matchIndex = -1;
    
    for (let i = 0; i < pipeline.length; i++) {
      if (pipeline[i].$match) {
        matchStage = pipeline[i];
        matchIndex = i;
        break;
      }
    }

    if (matchIndex > 0) {
      optimizations.push('Move $match stage to beginning for better performance');
      pipeline.unshift(pipeline.splice(matchIndex, 1)[0]);
    }

    // Look for optimization opportunities
    for (let i = 0; i < pipeline.length; i++) {
      if (pipeline[i].$project) {
        optimizations.push('Use $project early to reduce document size');
      }
      if (pipeline[i].$sort) {
        optimizations.push('Consider adding index for $sort stage');
      }
    }

    return {
      optimizedPipeline: pipeline,
      suggestions: optimizations
    };
  }

  /**
   * Track query execution
   */
  trackQuery(operation, duration, query) {
    this.queryMetrics.totalQueries++;
    this.queryMetrics.averageExecutionTime = 
      (this.queryMetrics.averageExecutionTime * (this.queryMetrics.totalQueries - 1) + duration) /
      this.queryMetrics.totalQueries;

    if (duration > this.slowQueryThreshold) {
      this.queryMetrics.slowQueries++;
      this.queryMetrics.slowQueryLog.push({
        operation,
        duration,
        query,
        timestamp: new Date()
      });

      // Keep last 1000 slow queries
      if (this.queryMetrics.slowQueryLog.length > 1000) {
        this.queryMetrics.slowQueryLog.shift();
      }

      console.warn(`[SLOW QUERY] ${operation}: ${duration}ms`, query);
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.queryMetrics;
  }

  /**
   * Get slow query log
   */
  getSlowQueryLog(limit = 100) {
    return this.queryMetrics.slowQueryLog.slice(-limit);
  }

  /**
   * Clear slow query log
   */
  clearSlowQueryLog() {
    this.queryMetrics.slowQueryLog = [];
  }
}

module.exports = QueryOptimizer;
