/**
 * Service Registry and Discovery Module
 * Manages service instances, health checks, and load balancing
 */

const crypto = require('crypto');

// ============================================
// Service Instance
// ============================================
class ServiceInstance {
  constructor(options) {
    this.id = options.id || crypto.randomUUID();
    this.name = options.name;
    this.url = options.url;
    this.host = options.host || 'localhost';
    this.port = options.port;
    this.protocol = options.protocol || 'http';
    this.metadata = options.metadata || {};
    this.tags = options.tags || [];
    this.weight = options.weight || 1;
    this.status = 'UP';
    this.registeredAt = new Date();
    this.lastHeartbeat = new Date();
    this.healthy = true;
    this.requestCount = 0;
    this.errorCount = 0;
  }

  get address() {
    return `${this.protocol}://${this.host}:${this.port}`;
  }

  get healthPercentage() {
    if (this.requestCount === 0) return 100;
    return ((this.requestCount - this.errorCount) / this.requestCount) * 100;
  }

  recordRequest(success) {
    this.requestCount++;
    if (!success) {
      this.errorCount++;
    }
  }

  heartbeat() {
    this.lastHeartbeat = new Date();
    this.status = 'UP';
  }

  markDown() {
    this.status = 'DOWN';
  }

  markUnhealthy() {
    this.healthy = false;
  }

  markHealthy() {
    this.healthy = true;
    this.errorCount = 0;
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      url: this.url,
      host: this.host,
      port: this.port,
      protocol: this.protocol,
      status: this.status,
      healthy: this.healthy,
      metadata: this.metadata,
      tags: this.tags,
      weight: this.weight,
      registeredAt: this.registeredAt,
      lastHeartbeat: this.lastHeartbeat,
      requestCount: this.requestCount,
      errorCount: this.errorCount,
      healthPercentage: this.healthPercentage
    };
  }
}

// ============================================
// Service Registry
// ============================================
class ServiceRegistry {
  constructor(options = {}) {
    this.services = new Map(); // serviceName -> [ServiceInstance]
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 90000; // 90 seconds
    this.healthCheckInterval = options.healthCheckInterval || 60000; // 1 minute
    this.cleanupInterval = options.cleanupInterval || 120000; // 2 minutes
    
    this.loadBalancer = new LoadBalancer(options.loadBalancerStrategy || 'round-robin');
    
    this.startHealthChecks();
    this.startCleanup();
  }

  // Register a service instance
  register(name, options) {
    const instance = new ServiceInstance({ name, ...options });
    
    if (!this.services.has(name)) {
      this.services.set(name, []);
    }
    
    this.services.get(name).push(instance);
    
    console.log(`Service registered: ${name} at ${instance.address}`);
    
    return instance;
  }

  // Deregister a service instance
  deregister(name, instanceId) {
    const instances = this.services.get(name);
    if (!instances) return false;
    
    const index = instances.findIndex(i => i.id === instanceId);
    if (index !== -1) {
      const instance = instances.splice(index, 1)[0];
      console.log(`Service deregistered: ${name} at ${instance.address}`);
      return true;
    }
    
    return false;
  }

  // Get service instances
  getInstances(name) {
    const instances = this.services.get(name) || [];
    return instances.filter(i => i.status === 'UP' && i.healthy);
  }

  // Get a single instance (load balanced)
  getInstance(name) {
    const instances = this.getInstances(name);
    if (instances.length === 0) {
      return null;
    }
    return this.loadBalancer.select(instances);
  }

  // Get all services
  getAllServices() {
    const result = {};
    for (const [name, instances] of this.services) {
      result[name] = instances.map(i => i.toJSON());
    }
    return result;
  }

  // Heartbeat from service
  heartbeat(name, instanceId) {
    const instances = this.services.get(name);
    if (!instances) return false;
    
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return false;
    
    instance.heartbeat();
    return true;
  }

  // Mark instance as down
  markDown(name, instanceId) {
    const instances = this.services.get(name);
    if (!instances) return false;
    
    const instance = instances.find(i => i.id === instanceId);
    if (!instance) return false;
    
    instance.markDown();
    return true;
  }

  // Health check
  async checkHealth(name, instance) {
    try {
      const response = await fetch(`${instance.address}/health`, {
        method: 'GET',
        timeout: 5000
      });
      
      if (response.ok) {
        instance.markHealthy();
        instance.heartbeat();
        return true;
      } else {
        instance.recordRequest(false);
        if (instance.healthPercentage < 50) {
          instance.markUnhealthy();
        }
        return false;
      }
    } catch (error) {
      instance.recordRequest(false);
      if (instance.healthPercentage < 50) {
        instance.markUnhealthy();
      }
      return false;
    }
  }

  // Start health checks
  startHealthChecks() {
    this.healthCheckTimer = setInterval(async () => {
      for (const [name, instances] of this.services) {
        for (const instance of instances) {
          await this.checkHealth(name, instance);
        }
      }
    }, this.healthCheckInterval);
  }

  // Cleanup dead instances
  startCleanup() {
    this.cleanupTimer = setInterval(() => {
      const now = Date.now();
      
      for (const [name, instances] of this.services) {
        const toRemove = [];
        
        for (const instance of instances) {
          const timeSinceHeartbeat = now - instance.lastHeartbeat.getTime();
          
          if (timeSinceHeartbeat > this.heartbeatTimeout) {
            toRemove.push(instance.id);
          }
        }
        
        for (const id of toRemove) {
          this.deregister(name, id);
        }
      }
    }, this.cleanupInterval);
  }

  // Stop all timers
  stop() {
    if (this.healthCheckTimer) clearInterval(this.healthCheckTimer);
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
  }
}

// ============================================
// Load Balancer
// ============================================
class LoadBalancer {
  constructor(strategy = 'round-robin') {
    this.strategy = strategy;
    this.counters = new Map();
  }

  select(instances) {
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(instances);
      case 'weighted':
        return this.weighted(instances);
      case 'least-connections':
        return this.leastConnections(instances);
      case 'random':
        return this.random(instances);
      default:
        return this.roundRobin(instances);
    }
  }

  roundRobin(instances) {
    const key = instances[0]?.name || 'default';
    const counter = this.counters.get(key) || 0;
    const index = counter % instances.length;
    this.counters.set(key, counter + 1);
    return instances[index];
  }

  weighted(instances) {
    const totalWeight = instances.reduce((sum, i) => sum + i.weight, 0);
    let random = Math.random() * totalWeight;
    
    for (const instance of instances) {
      random -= instance.weight;
      if (random <= 0) {
        return instance;
      }
    }
    
    return instances[instances.length - 1];
  }

  leastConnections(instances) {
    return instances.reduce((min, instance) => 
      instance.requestCount < min.requestCount ? instance : min
    );
  }

  random(instances) {
    return instances[Math.floor(Math.random() * instances.length)];
  }
}

// ============================================
// Service Client
// ============================================
class ServiceClient {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.timeout = options.timeout || 30000;
    this.retries = options.retries || 3;
    this.circuitBreaker = options.circuitBreaker;
  }

  async call(serviceName, path, options = {}) {
    const { method = 'GET', body, headers = {} } = options;
    let lastError;
    
    for (let attempt = 0; attempt < this.retries; attempt++) {
      const instance = this.registry.getInstance(serviceName);
      
      if (!instance) {
        throw new Error(`No available instances for service: ${serviceName}`);
      }
      
      try {
        const response = await fetch(`${instance.address}${path}`, {
          method,
          headers: {
            'Content-Type': 'application/json',
            ...headers
          },
          body: body ? JSON.stringify(body) : undefined,
          timeout: options.timeout || this.timeout
        });
        
        instance.recordRequest(response.ok);
        
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(error.error || `HTTP ${response.status}`);
        }
        
        return await response.json();
      } catch (error) {
        lastError = error;
        instance.recordRequest(false);
        
        // Mark instance as unhealthy if too many errors
        if (instance.healthPercentage < 50) {
          instance.markUnhealthy();
        }
        
        // Wait before retry
        if (attempt < this.retries - 1) {
          await new Promise(resolve => setTimeout(resolve, 100 * (attempt + 1)));
        }
      }
    }
    
    throw lastError;
  }
}

// ============================================
// API Gateway Proxy
// ============================================
class GatewayProxy {
  constructor(registry, options = {}) {
    this.registry = registry;
    this.timeout = options.timeout || 30000;
    this.routes = new Map(); // path pattern -> service name
  }

  // Add route mapping
  addRoute(pattern, serviceName) {
    this.routes.set(pattern, serviceName);
  }

  // Match route
  matchRoute(path) {
    for (const [pattern, serviceName] of this.routes) {
      if (path.startsWith(pattern)) {
        return {
          serviceName,
          remainingPath: path.slice(pattern.length)
        };
      }
    }
    return null;
  }

  // Proxy middleware
  middleware() {
    return async (req, res, next) => {
      const match = this.matchRoute(req.path);
      
      if (!match) {
        return next();
      }
      
      const { serviceName, remainingPath } = match;
      const instance = this.registry.getInstance(serviceName);
      
      if (!instance) {
        return res.status(503).json({
          error: 'Service unavailable',
          code: 'NO_AVAILABLE_INSTANCES',
          service: serviceName
        });
      }
      
      try {
        const response = await fetch(`${instance.address}${remainingPath}`, {
          method: req.method,
          headers: {
            'Content-Type': 'application/json',
            ...req.headers,
            'X-Forwarded-For': req.ip,
            'X-Forwarded-Host': req.get('host')
          },
          body: ['GET', 'HEAD'].includes(req.method) ? undefined : JSON.stringify(req.body)
        });
        
        instance.recordRequest(response.ok);
        
        const data = await response.json();
        return res.status(response.status).json(data);
      } catch (error) {
        instance.recordRequest(false);
        return res.status(502).json({
          error: 'Bad gateway',
          code: 'SERVICE_ERROR',
          service: serviceName,
          message: error.message
        });
      }
    };
  }
}

// ============================================
// Exports
// ============================================
module.exports = {
  ServiceRegistry,
  ServiceInstance,
  LoadBalancer,
  ServiceClient,
  GatewayProxy
};
