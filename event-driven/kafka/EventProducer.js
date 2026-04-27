// Event Producer for publishing events to Kafka
const { v4: uuidv4 } = require('uuid');
const KafkaConfig = require('./KafkaConfig');

class EventProducer {
  constructor(options = {}) {
    this.kafkaConfig = options.kafkaConfig || new KafkaConfig(options);
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'healthcare-service';
    this.producer = null;
    this.eventMetrics = {
      published: 0,
      failed: 0,
      lastPublished: null,
    };
  }

  /**
   * Initialize producer
   */
  async initialize() {
    this.producer = await this.kafkaConfig.getProducer();
    console.log(`Event producer initialized for ${this.serviceName}`);
  }

  /**
   * Publish single event
   */
  async publishEvent(eventType, aggregateId, payload, options = {}) {
    try {
      if (!this.producer) {
        await this.initialize();
      }

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

      const topic = options.topic || this.getTopicForEvent(eventType);

      const result = await this.producer.send({
        topic: topic,
        messages: [
          {
            key: aggregateId,
            value: JSON.stringify(event),
            headers: {
              'correlation-id': event.correlationId,
              'event-type': eventType,
              'aggregate-id': aggregateId,
              'timestamp': event.timestamp,
            },
          },
        ],
        timeout: 30000,
        compression: 1, // Gzip compression
      });

      this.eventMetrics.published++;
      this.eventMetrics.lastPublished = new Date();

      console.log(`Event published: ${eventType} (${aggregateId})`);
      return result;
    } catch (error) {
      this.eventMetrics.failed++;
      console.error(`Error publishing event ${eventType}:`, error);
      throw error;
    }
  }

  /**
   * Publish batch of events
   */
  async publishEvents(events) {
    try {
      if (!this.producer) {
        await this.initialize();
      }

      const messages = events.map(event => ({
        key: event.aggregateId,
        value: JSON.stringify({
          eventId: event.eventId || uuidv4(),
          eventType: event.eventType,
          aggregateId: event.aggregateId,
          aggregateType: event.aggregateType || this.serviceName,
          timestamp: new Date().toISOString(),
          version: event.version || 1,
          correlationId: event.correlationId || uuidv4(),
          sourceName: this.serviceName,
          userId: event.userId,
          metadata: event.metadata || {},
          payload: event.payload,
        }),
        headers: {
          'correlation-id': event.correlationId,
          'event-type': event.eventType,
          'aggregate-id': event.aggregateId,
        },
      }));

      const topic = events[0]?.topic || this.getTopicForEvent(events[0]?.eventType);

      const result = await this.producer.send({
        topic: topic,
        messages: messages,
        timeout: 30000,
      });

      this.eventMetrics.published += events.length;
      this.eventMetrics.lastPublished = new Date();

      console.log(`Batch published: ${events.length} events`);
      return result;
    } catch (error) {
      this.eventMetrics.failed += events.length;
      console.error('Error publishing batch events:', error);
      throw error;
    }
  }

  /**
   * Determine topic based on event type
   */
  getTopicForEvent(eventType) {
    const topicMapping = {
      'patient': 'patient-events',
      'claim': 'claims-events',
      'payment': 'payments-events',
      'notification': 'notifications-events',
      'audit': 'audit-events',
      'error': 'error-events',
    };

    for (const [key, topic] of Object.entries(topicMapping)) {
      if (eventType.toLowerCase().includes(key)) {
        return topic;
      }
    }

    return 'healthcare-events';
  }

  /**
   * Get event metrics
   */
  getMetrics() {
    return this.eventMetrics;
  }

  /**
   * Cleanup
   */
  async disconnect() {
    if (this.producer) {
      await this.kafkaConfig.disconnect();
    }
  }
}

module.exports = EventProducer;
