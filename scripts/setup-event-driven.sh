#!/bin/bash

# Event-Driven Architecture Implementation Guide
# Healthcare System with Kafka, RabbitMQ, and EventStore

echo "=== Event-Driven Architecture Setup ==="

# 1. Start Docker Compose services
echo "1. Starting Kafka and RabbitMQ..."

docker-compose -f docker-compose-events.yml up -d

sleep 30

# 2. Create Kafka topics
echo "2. Creating Kafka topics..."

docker exec kafka kafka-topics --create \
  --topic healthcare-events \
  --bootstrap-server localhost:9092 \
  --partitions 12 \
  --replication-factor 3 \
  --config retention.ms=604800000 || true

docker exec kafka kafka-topics --create \
  --topic patient-events \
  --bootstrap-server localhost:9092 \
  --partitions 12 \
  --replication-factor 3 || true

docker exec kafka kafka-topics --create \
  --topic claims-events \
  --bootstrap-server localhost:9092 \
  --partitions 12 \
  --replication-factor 3 || true

docker exec kafka kafka-topics --create \
  --topic payments-events \
  --bootstrap-server localhost:9092 \
  --partitions 12 \
  --replication-factor 3 || true

docker exec kafka kafka-topics --create \
  --topic audit-events \
  --bootstrap-server localhost:9092 \
  --partitions 6 \
  --replication-factor 3 || true

echo "✓ Kafka topics created"

# 3. Configure RabbitMQ
echo "3. Configuring RabbitMQ..."

docker exec -i rabbitmq rabbitmqctl add_vhost healthcare || true
docker exec -i rabbitmq rabbitmqctl set_permissions -p healthcare guest ".*" ".*" ".*" || true

echo "✓ RabbitMQ vhost configured"

# 4. Run tests
echo "4. Running event-driven system tests..."

npm test -- --testPathPattern="event-driven" --verbose

echo "✓ Event-Driven Architecture Setup Complete"
echo ""
echo "=== Access Points ==="
echo "Kafka UI: http://localhost:8080"
echo "RabbitMQ Management: http://localhost:15672 (guest:guest)"
echo "MongoDB: mongodb://localhost:27017"
echo ""
echo "=== Usage Example ==="
echo "See event-driven/USAGE.md for detailed examples"
