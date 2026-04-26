// Configuration Service for centralized configuration management
const ConsulClient = require('consul');
const EventEmitter = require('events');

class ConfigurationService extends EventEmitter {
  constructor(options = {}) {
    super();
    
    this.consulHost = options.consulHost || process.env.CONSUL_HOST || 'localhost';
    this.consulPort = options.consulPort || process.env.CONSUL_PORT || 8500;
    this.serviceName = options.serviceName || 'healthcare-config';
    this.configCache = new Map();
    this.watchers = new Map();
    
    this.consul = new ConsulClient({
      host: this.consulHost,
      port: this.consulPort
    });
    
    this.initializeConfig();
  }

  /**
   * Initialize configuration from Consul and Kubernetes ConfigMaps
   */
  async initializeConfig() {
    try {
      // Load from environment variables (K8s ConfigMaps)
      this.loadFromEnvironment();
      
      // Load from Consul
      await this.loadFromConsul();
      
      // Watch for changes
      this.watchConfigChanges();
      
      this.emit('initialized', this.configCache);
      console.log('Configuration service initialized');
    } catch (error) {
      console.error('Error initializing configuration:', error);
      throw error;
    }
  }

  /**
   * Load configuration from environment variables
   */
  loadFromEnvironment() {
    const envConfig = {
      // Database
      mongodbUri: process.env.MONGODB_URI,
      mongodbHost: process.env.MONGODB_HOST,
      mongodbPort: process.env.MONGODB_PORT,
      mongodbDatabase: process.env.MONGODB_DATABASE,
      
      // Redis
      redisHost: process.env.REDIS_HOST,
      redisPort: process.env.REDIS_PORT,
      redisPassword: process.env.REDIS_PASSWORD,
      
      // Service Discovery
      consulHost: process.env.CONSUL_HOST,
      consulPort: process.env.CONSUL_PORT,
      
      // Logging
      logLevel: process.env.LOG_LEVEL || 'info',
      nodeEnv: process.env.NODE_ENV || 'production',
      
      // Ports
      servicePort: process.env.SERVICE_PORT,
      grpcPort: process.env.GRPC_PORT,
      metricsPort: process.env.METRICS_PORT || 9090,
      
      // Tracing
      jaegerAgentHost: process.env.JAEGER_AGENT_HOST,
      jaegerAgentPort: process.env.JAEGER_AGENT_PORT,
      
      // Security
      jwtSecret: process.env.JWT_SECRET,
      apiGatewaySecret: process.env.API_GATEWAY_SECRET,
      
      // Integrations
      stripeSecretKey: process.env.STRIPE_SECRET_KEY,
      paypalSecret: process.env.PAYPAL_SECRET,
    };

    Object.entries(envConfig).forEach(([key, value]) => {
      if (value !== undefined) {
        this.configCache.set(key, value);
      }
    });

    console.log(`Loaded ${Object.keys(envConfig).length} environment variables`);
  }

  /**
   * Load configuration from Consul
   */
  async loadFromConsul() {
    try {
      const keys = await this.consul.kv.keys();
      
      for (const key of keys) {
        try {
          const result = await this.consul.kv.get(key);
          if (result && result.Value) {
            const value = Buffer.from(result.Value, 'base64').toString('utf-8');
            this.configCache.set(key, value);
          }
        } catch (error) {
          console.warn(`Error loading key ${key} from Consul:`, error.message);
        }
      }
      
      console.log(`Loaded ${keys.length} configuration keys from Consul`);
    } catch (error) {
      console.warn('Error loading configuration from Consul:', error.message);
    }
  }

  /**
   * Watch for configuration changes in Consul
   */
  watchConfigChanges() {
    const watch = this.consul.watch({
      method: this.consul.kv.get,
      options: {
        key: 'healthcare/',
        recurse: true
      }
    });

    watch.on('change', (data) => {
      console.log('Configuration updated in Consul');
      if (Array.isArray(data)) {
        data.forEach(item => {
          if (item.Value) {
            const value = Buffer.from(item.Value, 'base64').toString('utf-8');
            this.configCache.set(item.Key, value);
            this.emit('configUpdated', { key: item.Key, value });
          }
        });
      }
    });

    watch.on('error', (error) => {
      console.error('Error watching Consul configuration:', error);
    }

    this.watchers.set('consul-watch', watch);
  }

  /**
   * Get configuration value
   */
  get(key, defaultValue = null) {
    return this.configCache.get(key) || defaultValue;
  }

  /**
   * Get all configuration
   */
  getAll() {
    return Object.fromEntries(this.configCache);
  }

  /**
   * Set configuration value
   */
  async set(key, value) {
    try {
      await this.consul.kv.set(key, value);
      this.configCache.set(key, value);
      this.emit('configUpdated', { key, value });
      console.log(`Configuration updated: ${key}`);
    } catch (error) {
      console.error(`Error setting configuration ${key}:`, error);
      throw error;
    }
  }

  /**
   * Delete configuration value
   */
  async delete(key) {
    try {
      await this.consul.kv.del(key);
      this.configCache.delete(key);
      this.emit('configDeleted', { key });
      console.log(`Configuration deleted: ${key}`);
    } catch (error) {
      console.error(`Error deleting configuration ${key}:`, error);
      throw error;
    }
  }

  /**
   * Get configuration with path prefix
   */
  getByPrefix(prefix) {
    const result = {};
    for (const [key, value] of this.configCache.entries()) {
      if (key.startsWith(prefix)) {
        result[key.substring(prefix.length)] = value;
      }
    }
    return result;
  }

  /**
   * Validate configuration
   */
  validate() {
    const requiredKeys = [
      'mongodbUri',
      'redisHost',
      'consulHost',
      'jwtSecret'
    ];

    const missing = requiredKeys.filter(key => !this.configCache.has(key));

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Reload configuration
   */
  async reload() {
    console.log('Reloading configuration...');
    this.configCache.clear();
    await this.initializeConfig();
  }

  /**
   * Get service configuration
   */
  getServiceConfig(serviceName) {
    const prefix = `healthcare/services/${serviceName}/`;
    return this.getByPrefix(prefix);
  }

  /**
   * Subscribe to configuration changes
   */
  subscribe(callback) {
    this.on('configUpdated', callback);
    return () => this.removeListener('configUpdated', callback);
  }

  /**
   * Cleanup resources
   */
  destroy() {
    this.watchers.forEach(watch => watch.end());
    this.watchers.clear();
    this.removeAllListeners();
  }
}

module.exports = ConfigurationService;
