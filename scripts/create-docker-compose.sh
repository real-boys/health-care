#!/bin/bash

# Docker Compose Configuration for Local Microservices Development
# This file defines all services needed for local development

cat > docker-compose-microservices.yml << 'EOF'
version: '3.9'

networks:
  healthcare:
    driver: bridge

services:
  # Consul Service Discovery
  consul:
    image: consul:latest
    container_name: consul
    ports:
      - "8500:8500"
      - "8600:8600/udp"
    environment:
      - CONSUL_BIND_INTERFACE=eth0
    command: agent -server -ui -bootstrap-expect=1 -client=0.0.0.0
    networks:
      - healthcare
    volumes:
      - consul-data:/consul/data

  # MongoDB
  mongodb:
    image: mongo:5.0
    container_name: mongodb
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password123
      MONGO_INITDB_DATABASE: healthcare
    networks:
      - healthcare
    volumes:
      - mongodb-data:/data/db
    healthcheck:
      test: echo 'db.runCommand("ping").ok' | mongosh localhost/test --quiet
      interval: 10s
      timeout: 5s
      retries: 3

  # Redis
  redis:
    image: redis:7-alpine
    container_name: redis
    ports:
      - "6379:6379"
    command: redis-server --requirepass redis123
    networks:
      - healthcare
    volumes:
      - redis-data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 3

  # Auth Service
  auth-service:
    build:
      context: .
      dockerfile: services/auth-service.Dockerfile
    container_name: auth-service
    ports:
      - "3001:3001"
      - "50051:50051"
      - "9090:9090"
    environment:
      SERVICE_NAME: auth-service
      SERVICE_PORT: 3001
      GRPC_PORT: 50051
      NODE_ENV: development
      MONGODB_URI: mongodb://admin:password123@mongodb:27017/healthcare
      REDIS_URL: redis://:redis123@redis:6379
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      LOG_LEVEL: debug
    depends_on:
      mongodb:
        condition: service_healthy
      redis:
        condition: service_healthy
      consul:
        condition: service_started
    networks:
      - healthcare
    volumes:
      - ./backend:/app

  # Patient Service
  patient-service:
    build:
      context: .
      dockerfile: services/patient-service.Dockerfile
    container_name: patient-service
    ports:
      - "3002:3002"
      - "50052:50052"
      - "9091:9090"
    environment:
      SERVICE_NAME: patient-service
      SERVICE_PORT: 3002
      GRPC_PORT: 50052
      NODE_ENV: development
      MONGODB_URI: mongodb://admin:password123@mongodb:27017/healthcare
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      LOG_LEVEL: debug
    depends_on:
      mongodb:
        condition: service_healthy
      consul:
        condition: service_started
    networks:
      - healthcare
    volumes:
      - ./backend:/app

  # Claims Service
  claims-service:
    build:
      context: .
      dockerfile: services/claims-service.Dockerfile
    container_name: claims-service
    ports:
      - "3003:3003"
      - "50053:50053"
      - "9092:9090"
    environment:
      SERVICE_NAME: claims-service
      SERVICE_PORT: 3003
      GRPC_PORT: 50053
      NODE_ENV: development
      MONGODB_URI: mongodb://admin:password123@mongodb:27017/healthcare
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      LOG_LEVEL: debug
    depends_on:
      mongodb:
        condition: service_healthy
      consul:
        condition: service_started
    networks:
      - healthcare
    volumes:
      - ./backend:/app

  # Notification Service
  notification-service:
    build:
      context: .
      dockerfile: services/notification-service.Dockerfile
    container_name: notification-service
    ports:
      - "3004:3004"
      - "50054:50054"
      - "9093:9090"
    environment:
      SERVICE_NAME: notification-service
      SERVICE_PORT: 3004
      GRPC_PORT: 50054
      NODE_ENV: development
      REDIS_URL: redis://:redis123@redis:6379
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      LOG_LEVEL: debug
    depends_on:
      redis:
        condition: service_healthy
      consul:
        condition: service_started
    networks:
      - healthcare
    volumes:
      - ./backend:/app

  # Payment Service
  payment-service:
    build:
      context: .
      dockerfile: services/payment-service.Dockerfile
    container_name: payment-service
    ports:
      - "3005:3005"
      - "50055:50055"
      - "9094:9090"
    environment:
      SERVICE_NAME: payment-service
      SERVICE_PORT: 3005
      GRPC_PORT: 50055
      NODE_ENV: development
      MONGODB_URI: mongodb://admin:password123@mongodb:27017/healthcare
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      LOG_LEVEL: debug
    depends_on:
      mongodb:
        condition: service_healthy
      consul:
        condition: service_started
    networks:
      - healthcare
    volumes:
      - ./backend:/app

  # API Gateway
  api-gateway:
    build:
      context: .
      dockerfile: services/api-gateway.Dockerfile
    container_name: api-gateway
    ports:
      - "5000:5000"
      - "9095:9090"
    environment:
      SERVICE_NAME: api-gateway
      SERVICE_PORT: 5000
      NODE_ENV: development
      REDIS_URL: redis://:redis123@redis:6379
      CONSUL_HOST: consul
      CONSUL_PORT: 8500
      LOG_LEVEL: debug
    depends_on:
      redis:
        condition: service_healthy
      consul:
        condition: service_started
      auth-service:
        condition: service_started
      patient-service:
        condition: service_started
      claims-service:
        condition: service_started
      payment-service:
        condition: service_started
      notification-service:
        condition: service_started
    networks:
      - healthcare
    volumes:
      - ./backend:/app

  # Prometheus
  prometheus:
    image: prom/prometheus:latest
    container_name: prometheus
    ports:
      - "9090:9090"
    volumes:
      - ./monitoring/prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus-data:/prometheus
    command:
      - '--config.file=/etc/prometheus/prometheus.yml'
      - '--storage.tsdb.path=/prometheus'
    networks:
      - healthcare

  # Grafana
  grafana:
    image: grafana/grafana:latest
    container_name: grafana
    ports:
      - "3000:3000"
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin123
      GF_INSTALL_PLUGINS: grafana-piechart-panel
    volumes:
      - grafana-data:/var/lib/grafana
    depends_on:
      - prometheus
    networks:
      - healthcare

  # Jaeger
  jaeger:
    image: jaegertracing/all-in-one:latest
    container_name: jaeger
    ports:
      - "6831:6831/udp"
      - "16686:16686"
    networks:
      - healthcare

volumes:
  consul-data:
  mongodb-data:
  redis-data:
  prometheus-data:
  grafana-data:
EOF

log_success "docker-compose-microservices.yml created"
