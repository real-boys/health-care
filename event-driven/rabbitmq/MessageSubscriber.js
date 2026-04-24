// RabbitMQ Message Subscriber
const RabbitMQConfig = require('./RabbitMQConfig');

class MessageSubscriber {
  constructor(options = {}) {
    this.config = options.config || new RabbitMQConfig(options);
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'healthcare-service';
    this.handlers = new Map();
    this.subscriptions = new Map();
    this.consumerMetrics = {
      consumed: 0,
      processed: 0,
      failed: 0,
      lastConsumed: null,
    };
  }

  /**
   * Initialize subscriber
   */
  async initialize() {
    await this.config.connect();
    
    // Declare exchanges
    await this.config.declareExchange('healthcare.events', 'topic', { durable: true });
    await this.config.declareExchange('healthcare.commands', 'direct', { durable: true });
    await this.config.declareExchange('healthcare.notifications', 'fanout', { durable: true });
    
    console.log('Message subscriber initialized');
  }

  /**
   * Subscribe to events
   */
  async subscribeToEvents(eventTypes = [], handler, options = {}) {
    try {
      await this.config.declareQueue(
        options.queueName || `${this.serviceName}.events`,
        { durable: options.durable !== false }
      );

      const queue = options.queueName || `${this.serviceName}.events`;

      for (const eventType of eventTypes) {
        const routingKey = options.routingKey || `*.${eventType}`;
        await this.config.bindQueue(queue, 'healthcare.events', routingKey);
      }

      // Setup dead letter queue
      if (options.deadLetterEnabled !== false) {
        const { dlx, dlq } = await this.config.createDeadLetterQueue(queue);
        const channel = await this.config.getChannel();
        await channel.assertQueue(queue, {
          durable: true,
          arguments: {
            'x-dead-letter-exchange': dlx,
            'x-dead-letter-routing-key': dlq,
            'x-message-ttl': options.messageTtl || 3600000, // 1 hour
          }
        });
      }

      await this.startConsuming(queue, handler, 'events');
      console.log(`Subscribed to events: ${eventTypes.join(', ')}`);
    } catch (error) {
      console.error('Error subscribing to events:', error);
      throw error;
    }
  }

  /**
   * Subscribe to commands
   */
  async subscribeToCommands(commandTypes = [], handler, options = {}) {
    try {
      const queue = options.queueName || `${this.serviceName}.commands`;
      
      await this.config.declareQueue(queue, { durable: true });

      for (const commandType of commandTypes) {
        await this.config.bindQueue(queue, 'healthcare.commands', commandType);
      }

      await this.startConsuming(queue, handler, 'commands');
      console.log(`Subscribed to commands: ${commandTypes.join(', ')}`);
    } catch (error) {
      console.error('Error subscribing to commands:', error);
      throw error;
    }
  }

  /**
   * Subscribe to notifications
   */
  async subscribeToNotifications(handler, options = {}) {
    try {
      const queue = options.queueName || `${this.serviceName}.notifications`;
      
      await this.config.declareQueue(queue, { exclusive: options.exclusive !== false });
      await this.config.bindQueue(queue, 'healthcare.notifications', '');

      await this.startConsuming(queue, handler, 'notifications');
      console.log('Subscribed to notifications');
    } catch (error) {
      console.error('Error subscribing to notifications:', error);
      throw error;
    }
  }

  /**
   * Start consuming from queue
   */
  async startConsuming(queue, handler, messageType) {
    try {
      const channel = await this.config.getChannel(`consumer-${queue}`);

      await channel.consume(queue, async (msg) => {
        if (msg) {
          try {
            this.consumerMetrics.consumed++;
            const content = JSON.parse(msg.content.toString());
            
            await handler(content);
            
            this.consumerMetrics.processed++;
            this.consumerMetrics.lastConsumed = new Date();
            
            channel.ack(msg);
            console.log(`${messageType} message processed: ${queue}`);
          } catch (error) {
            this.consumerMetrics.failed++;
            console.error(`Error processing ${messageType}:`, error);
            
            // Nack and requeue or send to dead letter queue
            channel.nack(msg, false, false);
          }
        }
      });

      this.subscriptions.set(queue, { channel, messageType });
    } catch (error) {
      console.error(`Error starting consumer for ${queue}:`, error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.consumerMetrics;
  }

  /**
   * Unsubscribe from queue
   */
  async unsubscribe(queue) {
    try {
      if (this.subscriptions.has(queue)) {
        const { channel } = this.subscriptions.get(queue);
        await channel.cancel(queue);
        this.subscriptions.delete(queue);
        console.log(`Unsubscribed from: ${queue}`);
      }
    } catch (error) {
      console.error(`Error unsubscribing from ${queue}:`, error);
    }
  }

  /**
   * Disconnect
   */
  async disconnect() {
    for (const queue of this.subscriptions.keys()) {
      await this.unsubscribe(queue);
    }
    await this.config.disconnect();
  }
}

module.exports = MessageSubscriber;
