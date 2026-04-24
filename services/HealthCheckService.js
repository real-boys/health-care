// Health Check Service for all microservices
const express = require('express');
const os = require('os');

class HealthCheckService {
  constructor(serviceName, options = {}) {
    this.serviceName = serviceName;
    this.isHealthy = true;
    this.isReady = false;
    this.startTime = Date.now();
    this.dependencies = options.dependencies || {};
    this.router = express.Router();
    this.setupRoutes();
  }

  /**
   * Setup health check routes
   */
  setupRoutes() {
    // Liveness probe
    this.router.get('/live', (req, res) => {
      if (this.isHealthy) {
        res.status(200).json({
          status: 'alive',
          timestamp: new Date().toISOString(),
          service: this.serviceName
        });
      } else {
        res.status(503).json({
          status: 'not alive',
          timestamp: new Date().toISOString(),
          service: this.serviceName
        });
      }
    });

    // Readiness probe
    this.router.get('/ready', (req, res) => {
      if (this.isReady && this.isHealthy) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          uptime: process.uptime()
        });
      } else {
        res.status(503).json({
          status: 'not ready',
          timestamp: new Date().toISOString(),
          service: this.serviceName,
          reason: !this.isReady ? 'Service initializing' : 'Service unhealthy'
        });
      }
    });

    // Health check endpoint
    this.router.get('/health', (req, res) => {
      const health = {
        status: this.isHealthy && this.isReady ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        service: this.serviceName,
        uptime: process.uptime(),
        uptime_formatted: this.formatUptime(process.uptime()),
        memory: this.getMemoryUsage(),
        dependencies: {}
      };

      // Check dependencies
      for (const [name, checker] of Object.entries(this.dependencies)) {
        health.dependencies[name] = {
          status: checker.isHealthy ? 'up' : 'down',
          latency_ms: checker.latency || 0
        };
        if (!checker.isHealthy) {
          health.status = 'unhealthy';
        }
      }

      const statusCode = health.status === 'healthy' ? 200 : 503;
      res.status(statusCode).json(health);
    });

    // Detailed health check
    this.router.get('/health/details', (req, res) => {
      const details = {
        service: this.serviceName,
        status: this.isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        uptime_seconds: process.uptime(),
        environment: {
          node_version: process.version,
          platform: process.platform,
          arch: process.arch,
          cpus: os.cpus().length,
          hostname: os.hostname()
        },
        memory: this.getMemoryUsage(),
        resources: {
          cpu_usage: process.cpuUsage(),
          gc_stats: this.getGCStats()
        },
        dependencies: {}
      };

      // Add dependency details
      for (const [name, checker] of Object.entries(this.dependencies)) {
        details.dependencies[name] = {
          status: checker.isHealthy ? 'up' : 'down',
          latency_ms: checker.latency || 0,
          last_check: checker.lastCheck || null,
          error: checker.error || null
        };
      }

      res.status(this.isHealthy ? 200 : 503).json(details);
    });
  }

  /**
   * Mark service as ready
   */
  setReady() {
    this.isReady = true;
    console.log(`${this.serviceName} is ready`);
  }

  /**
   * Mark service as unhealthy
   */
  setUnhealthy(reason = 'Unknown') {
    this.isHealthy = false;
    console.error(`${this.serviceName} is unhealthy: ${reason}`);
  }

  /**
   * Mark service as healthy
   */
  setHealthy() {
    this.isHealthy = true;
  }

  /**
   * Register dependency check
   */
  registerDependency(name, checkFunction) {
    this.dependencies[name] = {
      isHealthy: false,
      latency: 0,
      lastCheck: null,
      error: null
    };

    // Run check immediately
    this.checkDependency(name, checkFunction);

    // Schedule periodic checks
    setInterval(() => {
      this.checkDependency(name, checkFunction);
    }, 30000); // Check every 30 seconds
  }

  /**
   * Check dependency health
   */
  async checkDependency(name, checkFunction) {
    try {
      const startTime = Date.now();
      await checkFunction();
      const latency = Date.now() - startTime;

      this.dependencies[name].isHealthy = true;
      this.dependencies[name].latency = latency;
      this.dependencies[name].lastCheck = new Date().toISOString();
      this.dependencies[name].error = null;
    } catch (error) {
      this.dependencies[name].isHealthy = false;
      this.dependencies[name].lastCheck = new Date().toISOString();
      this.dependencies[name].error = error.message;
    }
  }

  /**
   * Get memory usage
   */
  getMemoryUsage() {
    const mem = process.memoryUsage();
    return {
      rss_mb: Math.round(mem.rss / 1024 / 1024),
      heap_used_mb: Math.round(mem.heapUsed / 1024 / 1024),
      heap_total_mb: Math.round(mem.heapTotal / 1024 / 1024),
      external_mb: Math.round(mem.external / 1024 / 1024),
      heap_used_percent: Math.round((mem.heapUsed / mem.heapTotal) * 100)
    };
  }

  /**
   * Get garbage collection stats
   */
  getGCStats() {
    const gc = require('gc-stats');
    return {
      message: 'GC stats available when running with --expose-gc'
    };
  }

  /**
   * Format uptime
   */
  formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
  }

  /**
   * Get router
   */
  getRouter() {
    return this.router;
  }
}

module.exports = HealthCheckService;
