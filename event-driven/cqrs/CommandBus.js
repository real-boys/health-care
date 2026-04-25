// CQRS Pattern Implementation - Command Handler
const { v4: uuidv4 } = require('uuid');

class CommandBus {
  constructor(options = {}) {
    this.handlers = new Map();
    this.eventStore = options.eventStore;
    this.eventProducer = options.eventProducer;
    this.rabbitmqPublisher = options.rabbitmqPublisher;
    this.commandMetrics = {
      executed: 0,
      failed: 0,
      lastExecuted: null,
    };
  }

  /**
   * Register command handler
   */
  registerHandler(commandType, handler) {
    this.handlers.set(commandType, handler);
    console.log(`Command handler registered: ${commandType}`);
  }

  /**
   * Execute command
   */
  async execute(command, options = {}) {
    try {
      const commandType = command.constructor.name || command.commandType;
      const handler = this.handlers.get(commandType);

      if (!handler) {
        throw new Error(`No handler registered for command: ${commandType}`);
      }

      const commandId = options.commandId || uuidv4();

      // Execute command
      const events = await handler(command, {
        eventStore: this.eventStore,
        commandId,
        correlationId: options.correlationId || uuidv4(),
      });

      // Publish events
      if (Array.isArray(events)) {
        for (const event of events) {
          // Save to event store
          await this.eventStore.appendEvent(
            event.eventType,
            event.aggregateId,
            event.aggregateType || command.aggregateType,
            event.payload,
            {
              commandId,
              correlationId: options.correlationId,
              userId: options.userId,
            }
          );

          // Publish to Kafka
          if (this.eventProducer) {
            await this.eventProducer.publishEvent(
              event.eventType,
              event.aggregateId,
              event.payload,
              { ...options, commandId }
            );
          }

          // Publish to RabbitMQ
          if (this.rabbitmqPublisher) {
            await this.rabbitmqPublisher.publishEvent(
              event.eventType,
              event.aggregateId,
              event.payload,
              { ...options, commandId }
            );
          }
        }
      }

      this.commandMetrics.executed++;
      this.commandMetrics.lastExecuted = new Date();

      console.log(`Command executed: ${commandType}`);
      return { commandId, events };
    } catch (error) {
      this.commandMetrics.failed++;
      console.error(`Error executing command:`, error);
      throw error;
    }
  }

  /**
   * Get metrics
   */
  getMetrics() {
    return this.commandMetrics;
  }
}

module.exports = CommandBus;
