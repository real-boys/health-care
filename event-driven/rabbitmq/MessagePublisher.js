// RabbitMQ Message Publisher
const RabbitMQConfig = require('./RabbitMQConfig');
const { v4: uuidv4 } = require('uuid');

class MessagePublisher {
  constructor(options = {}) {
    this.config = options.config || new RabbitMQConfig(options);
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'healthcare-service';
    this.publishMetrics = {
      published: 0,
      failed: 0,
      lastPublished: null,
    };
  }

  /**
   * Initialize publisher
   */
  async initialize() {
    await this.config.connect();
    
    // Declare exchanges
    await this.config.declareExchange('healthcare.events', 'topic', { durable: true });
    await this.config.declareExchange('healthcare.commands', 'direct', { durable: true });
    await this.config.declareExchange('healthcare.notifications', 'fanout', { durable: true });
    
    console.log('Message publisher initialized');
  }

  /**
   * Publish event
   */
  async publishEvent(eventType, aggregateId, payload, options = {}) {
    try {
      const channel = await this.config.getChannel();
      
      const event = {
        eventId: options.eventId || uuidv4(),
        eventType: eventType,
        aggregateId: aggregateId,
        aggregateType: options.aggregateType || this.serviceName,
        timestamp: new Date().toISOString(),
        version: options.version || 1,
        correlationId: options.correlationId || uuidv4(),
        causationId: options.causationId || uuidv4(),
        sourceName: this.serviceName,
        userId: options.userId,
        metadata: options.metadata || {},
        payload: payload,
      };

      const routingKey = options.routingKey || `${this.serviceName}.${eventType}`;
      
      const message = Buffer.from(JSON.stringify(event));

      const dlx = `${options.dlx || 'healthcare-events'}.dlx`;
      const dlq = `${options.dlx || 'healthcare-events'}.dlq`;

      // Create dead letter queue if specified
      if (options.deadLetterEnabled !== false) {
        try {
          const { dlx: createdDlx, dlq: createdDlq } = await this.config.createDeadLetterQueue(
            options.dlx || 'healthcare-events'
          );
        } catch (error) {
          // Queue might already exist
        }
      }

      const published = channel.publish(
        'healthcare.events',
        routingKey,
        message,
        {
          persistent: options.persistent !== false,
          correlationId: event.correlationId,
          contentType: 'application/json',
          timestamp: Date.now(),
          headers: {
            'x-event-type': eventType,
            'x-aggregate-id': aggregateId,
            'x-correlation-id': event.correlationId,
            'x-dead-letter-exchange': dlx,
          },
        }
      );

      if (published) {
        this.publishMetrics.published++;
        this.publishMetrics.lastPublished = new Date();
        console.log(`Event published to RabbitMQ: ${eventType} (${aggregateId})`);
      } else {
        this.publishMetrics.failed++;
        console.error(`Failed to publish event: ${eventType}`);
        throw new Error('Failed to publish message');
      }

      return event;
    } catch (error) {
      this.publishMetrics.failed++;
      console.error('Error publishing event to RabbitMQ:', error);
      throw error;
    }
  }

  /**
   * Publish command
   */
  async publishCommand(commandType, aggregateId, payload, options = {}) {
    try {
      const channel = await this.config.getChannel();

      const command = {
        commandId: options.commandId || uuidv4(),
        commandType: commandType,
        aggregateId: aggregateId,
        timestamp: new Date().toISOString(),
        correlationId: options.correlationId || uuidv4(),
        sourceName: this.serviceName,
        userId: options.userId,
        payload: payload,
      };

      const routingKey = options.routingKey || aggregateId;
      const message = Buffer.from(JSON.stringify(command));

      channel.publish(
        'healthcare.commands',
        routingKey,
        message,
        {
          persistent: true,
          contentType: 'application/json',
          correlationId: command.correlationId,
        }
      );

      console.log(`Command published: ${commandType}`);
      return command;
    } catch (error) {
      console.error('Error publishing command:', error);
      throw error;
    }
  }

  /**
   * Publish notification
   */
  async publishNotification(notificationType, payload, options = {}) {
    try {
      const channel = await this.config.getChannel();

      const notification = {
        notificationId: options.notificationId || uuidv4(),
        notificationType: notificationType,
        timestamp: new Date().toISOString(),
        correlationId: options.correlationId || uuidv4(),
        payload: payload,
      };

      const message = Buffer.from(JSON.stringify(notification));

      channel.publish(
        'healthcare.notifications',
        '',
        message,
        {
          persistent: true,
          contentType: 'application/json',
        }
      );

      console.log(`Notification published: ${notificationType}`);
      return notification;
    } catch (error) {
      console.error('Error publishing notification:', error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.publishMetrics;
  }

  /**
   * Disconnect
   */
  async disconnect() {
    await this.config.disconnect();
  }
}

module.exports = MessagePublisher;
