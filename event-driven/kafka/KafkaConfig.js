// Kafka Configuration and Producer/Consumer Factory
const { Kafka, logLevel } = require('kafkajs');
const { v4: uuidv4 } = require('uuid');

class KafkaConfig {
  constructor(options = {}) {
    this.brokers = options.brokers || [
      process.env.KAFKA_BROKERS || 'localhost:9092'
    ].join(',').split(',');
    
    this.clientId = options.clientId || `${process.env.SERVICE_NAME || 'service'}-${uuidv4()}`;
    this.groupId = options.groupId || process.env.SERVICE_NAME || 'healthcare-service-group';
    this.logLevel = options.logLevel || logLevel.ERROR;
    this.connectionTimeout = options.connectionTimeout || 10000;
    this.requestTimeout = options.requestTimeout || 30000;
    
    this.kafka = new Kafka({
      clientId: this.clientId,
      brokers: this.brokers,
      logLevel: this.logLevel,
      connectionTimeout: this.connectionTimeout,
      requestTimeout: this.requestTimeout,
      retry: {
        initialRetryTime: 100,
        retries: 8,
        maxRetryTime: 30000,
        multiplier: 2,
        randomizationFactor: 0.2,
      },
      ssl: process.env.KAFKA_SSL === 'true',
      sasl: process.env.KAFKA_SASL_MECHANISM ? {
        mechanism: process.env.KAFKA_SASL_MECHANISM,
        username: process.env.KAFKA_USERNAME,
        password: process.env.KAFKA_PASSWORD,
      } : undefined,
    });

    this.admin = null;
    this.producer = null;
    this.consumers = new Map();
  }

  /**
   * Initialize admin client
   */
  async initAdmin() {
    if (!this.admin) {
      this.admin = this.kafka.admin();
      await this.admin.connect();
      console.log('Kafka admin connected');
    }
    return this.admin;
  }

  /**
   * Create topics
   */
  async createTopics(topics = []) {
    try {
      const admin = await this.initAdmin();
      
      const defaultTopics = [
        { name: 'healthcare-events', partitions: 12, replicationFactor: 3 },
        { name: 'patient-events', partitions: 12, replicationFactor: 3 },
        { name: 'claims-events', partitions: 12, replicationFactor: 3 },
        { name: 'payments-events', partitions: 12, replicationFactor: 3 },
        { name: 'notifications-events', partitions: 6, replicationFactor: 3 },
        { name: 'audit-events', partitions: 12, replicationFactor: 3 },
        { name: 'error-events', partitions: 6, replicationFactor: 3 },
      ];

      const topicsToCreate = [...defaultTopics, ...topics];

      await admin.createTopics({
        topics: topicsToCreate,
        validateOnly: false,
        timeout: 30000,
      });

      console.log(`Created ${topicsToCreate.length} Kafka topics`);
    } catch (error) {
      if (!error.message.includes('already exists')) {
        console.error('Error creating Kafka topics:', error);
      }
    }
  }

  /**
   * Get or create producer
   */
  async getProducer() {
    if (!this.producer) {
      this.producer = this.kafka.producer({
        allowAutoTopicCreation: false,
        transactionTimeout: 30000,
        retry: {
          initialRetryTime: 100,
          retries: 8,
          maxRetryTime: 30000,
        },
      });
      await this.producer.connect();
      console.log('Kafka producer connected');
    }
    return this.producer;
  }

  /**
   * Get or create consumer
   */
  async getConsumer(groupId = this.groupId) {
    const key = `consumer-${groupId}`;
    
    if (!this.consumers.has(key)) {
      const consumer = this.kafka.consumer({
        groupId: groupId,
        sessionTimeout: 30000,
        rebalanceTimeout: 60000,
        heartbeatInterval: 10000,
        retry: {
          initialRetryTime: 100,
          retries: 8,
          maxRetryTime: 30000,
        },
      });
      
      await consumer.connect();
      this.consumers.set(key, consumer);
      console.log(`Kafka consumer connected: ${groupId}`);
    }
    
    return this.consumers.get(key);
  }

  /**
   * Cleanup resources
   */
  async disconnect() {
    if (this.producer) {
      await this.producer.disconnect();
    }
    for (const consumer of this.consumers.values()) {
      await consumer.disconnect();
    }
    if (this.admin) {
      await this.admin.disconnect();
    }
    console.log('Kafka disconnected');
  }
}

module.exports = KafkaConfig;
