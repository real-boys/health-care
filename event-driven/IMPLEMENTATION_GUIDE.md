# Event-Driven Architecture Implementation

This document provides comprehensive information about the event-driven architecture implementation with Kafka, RabbitMQ, EventStore, and CQRS pattern.

## Architecture Overview

### Components

1. **Kafka** - High-throughput distributed event streaming
2. **RabbitMQ** - Message queuing with advanced routing
3. **EventStore** - Event sourcing with MongoDB
4. **CQRS** - Command Query Responsibility Segregation pattern
5. **Projections** - Read models for optimized queries

## Kafka Configuration

### Topics

- `healthcare-events` - Generic healthcare domain events (12 partitions, RF=3)
- `patient-events` - Patient-related events (12 partitions, RF=3)
- `claims-events` - Insurance claim events (12 partitions, RF=3)
- `payments-events` - Payment transaction events (12 partitions, RF=3)
- `notifications-events` - Notification events (6 partitions, RF=3)
- `audit-events` - Audit trail events (12 partitions, RF=3)
- `error-events` - Error and exception events (6 partitions, RF=3)

### Partitioning Strategy

- High-volume events: 12 partitions for parallel processing
- Low-volume events: 6 partitions for cost optimization
- Replication factor: 3 for high availability

### Retention Policy

- Default: 7 days (168 hours)
- Audit events: 365 days
- Error events: 30 days

## RabbitMQ Configuration

### Exchanges

1. **healthcare.events** (Topic Exchange)
   - Routing pattern: `{service}.{eventType}`
   - Example: `patient.PatientCreated`

2. **healthcare.commands** (Direct Exchange)
   - Routing pattern: `{aggregateId}`
   - One-to-one command routing

3. **healthcare.notifications** (Fanout Exchange)
   - Broadcasting to all subscribers
   - Real-time notifications

### Queue Configuration

- **Durable**: All queues are persistent
- **Dead Letter Exchange**: Automatic for failed messages
- **TTL**: Messages expire after 1 hour (configurable)
- **Prefetch**: 10 messages per consumer

## EventStore Implementation

### Event Schema

```
{
  eventId: UUID,
  eventType: String,
  aggregateId: String,
  aggregateType: String,
  version: Number,
  timestamp: Date,
  correlationId: UUID,
  causationId: UUID,
  sourceName: String,
  userId: String,
  metadata: Object,
  payload: Object,
  status: 'published' | 'processed' | 'failed'
}
```

### Snapshot Strategy

- **Snapshot Interval**: Every 100 events
- **Snapshot Retention**: Indefinite
- **Replay Optimization**: Use latest snapshot + remaining events

### Dead Letter Queue

- **TTL**: 24 hours
- **Max Retries**: 3 attempts
- **Exponential Backoff**: Enabled

## CQRS Pattern

### Command Processing

1. **Command Reception**: Validate and route command
2. **Event Generation**: Apply business logic, generate events
3. **Event Persistence**: Save to EventStore
4. **Event Publishing**: Publish to Kafka and RabbitMQ
5. **Projection Update**: Update read models

### Query Processing

1. **Query Reception**: Validate query
2. **Read Model Query**: Query projections (optimized reads)
3. **Result Return**: Return cached/computed results
4. **Metrics**: Track query execution time

### Projection Types

1. **Patient Projection**: Current patient state
2. **Claim Projection**: Claim status and history
3. **Payment Projection**: Payment transactions
4. **Audit Projection**: Audit trail by actor

## Event Replay Functionality

### Use Cases

1. **Debugging**: Replay events to understand state changes
2. **Disaster Recovery**: Reconstruct state from events
3. **Migration**: Transform events during schema updates
4. **Analytics**: Replay events for historical analysis

### Implementation

```javascript
// Replay events for aggregate
const events = await eventStore.replayEvents(aggregateId, aggregateType, {
  useSnapshot: true,
  fromVersion: 0,
  toVersion: 100
});

// Apply events to reconstruct state
let state = {};
for (const event of events) {
  state = applyEvent(state, event);
}
```

## Dead Letter Queue Handling

### Flow

1. **Initial Processing**: Consumer processes message
2. **Failure**: Error occurs during processing
3. **Retry**: Message requeued with backoff
4. **Max Retries**: After 3 retries, move to DLQ
5. **DLQ Storage**: Store in dead-letter MongoDB collection
6. **Manual Resolution**: Review and retry from admin UI

### Monitoring

```javascript
// Get dead letter messages
const deadLetters = await eventStore.getDeadLetters({
  limit: 100,
  aggregateId: 'specific-aggregate'
});

// Retry failed event
await eventStore.retryFailedEvent(deadLetterId);
```

## Deployment

### Kubernetes

```bash
# Deploy Kafka and RabbitMQ
kubectl apply -f k8s/07-event-driven-kafka-rabbitmq.yaml

# Deploy event service
kubectl apply -f k8s/08-event-service-deployment.yaml

# Check status
kubectl get pods -n healthcare | grep -E "kafka|rabbitmq|event"
```

### Local Development

```bash
# Start all services
./scripts/setup-event-driven.sh

# Access UIs
# Kafka UI: http://localhost:8080
# RabbitMQ: http://localhost:15672
```

## Usage Examples

### Publish Event (Kafka)

```javascript
const eventProducer = new EventProducer();
await eventProducer.initialize();

await eventProducer.publishEvent(
  'PatientCreated',
  'patient-123',
  {
    name: 'John Doe',
    email: 'john@example.com'
  },
  {
    userId: 'admin-1',
    correlationId: 'correlation-id'
  }
);
```

### Consume Event (Kafka)

```javascript
const eventConsumer = new EventConsumer();
await eventConsumer.registerHandler('PatientCreated', async (event) => {
  console.log('Patient created:', event.payload);
});

await eventConsumer.subscribe(['patient-events']);
```

### Publish Message (RabbitMQ)

```javascript
const publisher = new MessagePublisher();
await publisher.initialize();

await publisher.publishEvent(
  'PatientUpdated',
  'patient-123',
  { status: 'active' },
  { deadLetterEnabled: true }
);
```

### Subscribe to Messages (RabbitMQ)

```javascript
const subscriber = new MessageSubscriber();
await subscriber.initialize();

await subscriber.subscribeToEvents(
  ['PatientCreated', 'PatientUpdated'],
  async (event) => {
    console.log('Event:', event);
  }
);
```

### CQRS Command

```javascript
const commandBus = new CommandBus({
  eventStore,
  eventProducer,
  rabbitmqPublisher
});

// Register handler
commandBus.registerHandler('CreatePatientCommand', async (command) => {
  return [{
    eventType: 'PatientCreated',
    aggregateId: command.aggregateId,
    payload: command.payload
  }];
});

// Execute command
const result = await commandBus.execute({
  aggregateId: 'patient-123',
  aggregateType: 'Patient',
  payload: { name: 'Jane Doe' }
});
```

### CQRS Query

```javascript
const queryBus = new QueryBus({ eventStore });

// Register handler
queryBus.registerHandler('GetPatientQuery', async (query) => {
  const projection = await Projection.findOne({
    aggregateId: query.patientId
  });
  return projection?.state;
});

// Execute query
const patient = await queryBus.execute({
  patientId: 'patient-123'
});
```

### Event Replay

```javascript
// Rebuild projection from events
await projectionManager.rebuildProjection('PatientProjection', 'patient-123');

// Rebuild all projections
await projectionManager.rebuildAllProjections();
```

## Monitoring

### Kafka Metrics

- Consumer lag per topic/partition
- Producer throughput (events/sec)
- Error rates
- Replication status

### RabbitMQ Metrics

- Queue length
- Consumer count
- Message rate (in/out)
- Connection count

### EventStore Metrics

- Event write latency
- Snapshot creation frequency
- Replay time
- Dead letter queue size

## Performance Tuning

### Kafka

- **Batch Size**: 16KB default, increase for throughput
- **Compression**: Enable Gzip or Snappy
- **Partitions**: 1 per consumer for optimal throughput
- **Replication**: Balance between durability and performance

### RabbitMQ

- **Prefetch**: Set to number of workers × 2
- **Channel Pooling**: Reuse channels
- **Connection Pooling**: Limit connections per host
- **Manual Ack**: Only after processing complete

### EventStore

- **Indexing**: Compound indexes on aggregateId + version
- **Sharding**: Shard by aggregateId if >1TB
- **Archival**: Move old events to cold storage
- **Caching**: Redis cache for frequent aggregates

## Troubleshooting

### High Consumer Lag

1. Increase consumer parallelism
2. Increase partition count
3. Optimize handler performance
4. Check for slow handlers

### Dead Letter Queue Growing

1. Review error logs
2. Check downstream system health
3. Increase handler retry window
4. Implement exponential backoff

### EventStore Performance Degradation

1. Check MongoDB indexes
2. Monitor disk I/O
3. Archive old events
4. Increase snapshot frequency

## Security Considerations

1. **Authentication**: SASL/SSL for Kafka and RabbitMQ
2. **Authorization**: ACLs per topic/queue
3. **Encryption**: TLS for all connections
4. **Audit**: Log all configuration changes
5. **Secrets**: Store credentials in secure vaults

## Scalability

- **Horizontal**: Add Kafka brokers/RabbitMQ nodes
- **Vertical**: Increase memory/CPU for consumers
- **Partitioning**: Increase topic partitions
- **Sharding**: Distribute load by aggregateId

## References

- Kafka Documentation: https://kafka.apache.org/docs/
- RabbitMQ Documentation: https://www.rabbitmq.com/documentation.html
- Event Sourcing Pattern: https://martinfowler.com/eaaDev/EventSourcing.html
- CQRS Pattern: https://martinfowler.com/bliki/CQRS.html
