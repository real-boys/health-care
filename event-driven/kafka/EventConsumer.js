// Event Consumer for consuming events from Kafka
const KafkaConfig = require('./KafkaConfig');

class EventConsumer {
  constructor(options = {}) {
    this.kafkaConfig = options.kafkaConfig || new KafkaConfig(options);
    this.serviceName = options.serviceName || process.env.SERVICE_NAME || 'healthcare-service';
    this.groupId = options.groupId || this.serviceName;
    this.consumer = null;
    this.handlers = new Map();
    this.isRunning = false;
    this.consumerMetrics = {
      consumed: 0,
      processed: 0,
      failed: 0,
      lastConsumed: null,
    };
  }

  /**
   * Initialize consumer
   */
  async initialize() {
    this.consumer = await this.kafkaConfig.getConsumer(this.groupId);
    console.log(`Event consumer initialized: ${this.serviceName}`);
  }

  /**
   * Register event handler
   */
  registerHandler(eventType, handler) {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType).push(handler);
    console.log(`Handler registered for ${eventType}`);
  }

  /**
   * Subscribe to topics and consume events
   */
  async subscribe(topics = []) {
    try {
      if (!this.consumer) {
        await this.initialize();
      }

      const defaultTopics = [
        'healthcare-events',
        'patient-events',
        'claims-events',
        'payments-events',
        'notifications-events',
        'audit-events',
      ];

      const topicsToSubscribe = topics.length > 0 ? topics : defaultTopics;

      await this.consumer.subscribe({
        topics: topicsToSubscribe,
        fromBeginning: false,
      });

      console.log(`Subscribed to topics: ${topicsToSubscribe.join(', ')}`);

      this.isRunning = true;
      await this.startConsuming();
    } catch (error) {
      console.error('Error subscribing to topics:', error);
      throw error;
    }
  }

  /**
   * Start consuming events
   */
  async startConsuming() {
    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          await this.handleMessage(message);
        },
        eachBatchAutoResolve: false,
        autoCommit: false,
      });
    } catch (error) {
      console.error('Error in consumer run:', error);
      this.isRunning = false;
    }
  }

  /**
   * Handle incoming message
   */
  async handleMessage(message) {
    try {
      this.consumerMetrics.consumed++;

      const event = JSON.parse(message.value.toString());
      const eventType = event.eventType;

      if (!this.handlers.has(eventType)) {
        console.warn(`No handler registered for event type: ${eventType}`);
        return;
      }

      const handlers = this.handlers.get(eventType);

      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (error) {
          console.error(`Error handling event ${eventType}:`, error);
          this.consumerMetrics.failed++;
          throw error;
        }
      }

      this.consumerMetrics.processed++;
      this.consumerMetrics.lastConsumed = new Date();

      console.log(`Event processed: ${eventType} (${event.aggregateId})`);
    } catch (error) {
      console.error('Error processing message:', error);
      this.consumerMetrics.failed++;
      throw error;
    }
  }

  /**
   * Stop consuming events
   */
  async stop() {
    if (this.consumer) {
      await this.consumer.disconnect();
      this.isRunning = false;
      console.log('Event consumer stopped');
    }
  }

  /**
   * Get consumer metrics
   */
  getMetrics() {
    return this.consumerMetrics;
  }

  /**
   * Resume from offset
   */
  async seekToOffset(partition, offset) {
    if (this.consumer) {
      await this.consumer.seek({ partition, offset });
    }
  }

  /**
   * Get committed offsets
   */
  async getCommittedOffsets(topics) {
    if (this.consumer) {
      const offsets = await this.consumer.committed(topics);
      return offsets;
    }
  }
}

module.exports = EventConsumer;
