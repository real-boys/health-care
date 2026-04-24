// RabbitMQ Configuration and Connection Management
const amqp = require('amqplib');
const { EventEmitter } = require('events');

class RabbitMQConfig extends EventEmitter {
  constructor(options = {}) {
    super();
    this.url = options.url || process.env.RABBITMQ_URL || 'amqp://guest:guest@localhost:5672';
    this.connection = null;
    this.channels = new Map();
    this.reconnectAttempts = options.reconnectAttempts || 5;
    this.reconnectDelay = options.reconnectDelay || 5000;
    this.prefetch = options.prefetch || 10;
    this.exchanges = [];
    this.queues = [];
  }

  /**
   * Connect to RabbitMQ
   */
  async connect() {
    try {
      this.connection = await amqp.connect(this.url);
      
      this.connection.on('error', (err) => {
        console.error('RabbitMQ connection error:', err);
        this.emit('error', err);
        this.reconnect();
      });

      this.connection.on('close', () => {
        console.log('RabbitMQ connection closed');
        this.emit('close');
      });

      console.log('RabbitMQ connected');
      this.emit('connected');
      return this.connection;
    } catch (error) {
      console.error('Failed to connect to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Reconnect to RabbitMQ
   */
  async reconnect() {
    for (let i = 0; i < this.reconnectAttempts; i++) {
      try {
        await new Promise(resolve => setTimeout(resolve, this.reconnectDelay * (i + 1)));
        await this.connect();
        return;
      } catch (error) {
        console.error(`Reconnection attempt ${i + 1} failed:`, error);
      }
    }
    console.error('Failed to reconnect to RabbitMQ after multiple attempts');
  }

  /**
   * Get or create channel
   */
  async getChannel(name = 'default') {
    if (!this.connection) {
      await this.connect();
    }

    if (!this.channels.has(name)) {
      const channel = await this.connection.createChannel();
      await channel.prefetch(this.prefetch);
      this.channels.set(name, channel);
      console.log(`Channel created: ${name}`);
    }

    return this.channels.get(name);
  }

  /**
   * Declare exchange
   */
  async declareExchange(name, type = 'topic', options = {}) {
    try {
      const channel = await this.getChannel();
      await channel.assertExchange(name, type, {
        durable: options.durable !== false,
        autoDelete: options.autoDelete === true,
        ...options,
      });
      
      if (!this.exchanges.includes(name)) {
        this.exchanges.push(name);
      }
      
      console.log(`Exchange declared: ${name} (${type})`);
    } catch (error) {
      console.error(`Error declaring exchange ${name}:`, error);
      throw error;
    }
  }

  /**
   * Declare queue
   */
  async declareQueue(name, options = {}) {
    try {
      const channel = await this.getChannel();
      const result = await channel.assertQueue(name, {
        durable: options.durable !== false,
        autoDelete: options.autoDelete === false ? false : true,
        ...options,
      });

      if (!this.queues.includes(name)) {
        this.queues.push(name);
      }

      console.log(`Queue declared: ${name}`);
      return result;
    } catch (error) {
      console.error(`Error declaring queue ${name}:`, error);
      throw error;
    }
  }

  /**
   * Bind queue to exchange
   */
  async bindQueue(queue, exchange, pattern = '#') {
    try {
      const channel = await this.getChannel();
      await channel.bindQueue(queue, exchange, pattern);
      console.log(`Queue bound: ${queue} -> ${exchange} (${pattern})`);
    } catch (error) {
      console.error(`Error binding queue ${queue}:`, error);
      throw error;
    }
  }

  /**
   * Create dead letter exchange and queue
   */
  async createDeadLetterQueue(baseName) {
    const dlx = `${baseName}.dlx`;
    const dlq = `${baseName}.dlq`;

    try {
      await this.declareExchange(dlx, 'direct', { durable: true });
      await this.declareQueue(dlq, { 
        durable: true,
        arguments: {
          'x-message-ttl': 86400000, // 24 hours
        }
      });
      await this.bindQueue(dlq, dlx);
      console.log(`Dead letter queue created: ${dlq}`);
      return { dlx, dlq };
    } catch (error) {
      console.error(`Error creating dead letter queue:`, error);
      throw error;
    }
  }

  /**
   * Close all channels and connection
   */
  async disconnect() {
    try {
      for (const channel of this.channels.values()) {
        await channel.close();
      }
      this.channels.clear();

      if (this.connection) {
        await this.connection.close();
      }
      console.log('RabbitMQ disconnected');
    } catch (error) {
      console.error('Error disconnecting from RabbitMQ:', error);
    }
  }
}

module.exports = RabbitMQConfig;
