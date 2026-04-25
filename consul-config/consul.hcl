---
# Consul Configuration File
datacenter: "dc1"
node_name: "consul-server"
ui_config:
  enabled: true
  content_path: "/ui/"
server: true
bootstrap_expect: 3
ui: true
client_addr: "0.0.0.0"
bind_addr: "0.0.0.0"
advertise_addr: "consul"
advertise_addr_wan: "consul.healthcare.svc.cluster.local"
ports:
  http: 8500
  https: -1
  grpc: 8502
  grpc_tls: 8503
  dns: 8600
  serf_lan: 8301
  serf_wan: 8302
  server: 8300

# Encryption
encrypt: "2pPj39WKr0gm8MZrXwzvjg=="
encrypt_verify_incoming: true
encrypt_verify_outgoing: true

# TLS Configuration
verify_incoming: false
verify_outgoing: true
verify_server_hostname: false
ca_file: "/etc/consul/tls/ca-cert.pem"
cert_file: "/etc/consul/tls/server-cert.pem"
key_file: "/etc/consul/tls/server-key.pem"

# Performance
performance:
  raft_multiplier: 1

# Service Discovery
services:
- name: "api-gateway"
  id: "api-gateway-1"
  port: 5000
  check:
    http: "http://api-gateway.healthcare.svc.cluster.local:5000/health"
    interval: "10s"
    timeout: "5s"
  tags:
  - "http"
  - "gateway"

- name: "auth-service"
  id: "auth-service-1"
  port: 3001
  check:
    http: "http://auth-service.healthcare.svc.cluster.local:3001/health"
    interval: "10s"
    timeout: "5s"
  tags:
  - "http"
  - "auth"

- name: "patient-service"
  id: "patient-service-1"
  port: 3002
  check:
    http: "http://patient-service.healthcare.svc.cluster.local:3002/health"
    interval: "10s"
    timeout: "5s"
  tags:
  - "http"
  - "patient"

- name: "claims-service"
  id: "claims-service-1"
  port: 3003
  check:
    http: "http://claims-service.healthcare.svc.cluster.local:3003/health"
    interval: "10s"
    timeout: "5s"
  tags:
  - "http"
  - "claims"

- name: "payment-service"
  id: "payment-service-1"
  port: 3005
  check:
    http: "http://payment-service.healthcare.svc.cluster.local:3005/health"
    interval: "10s"
    timeout: "5s"
  tags:
  - "http"
  - "payment"

- name: "notification-service"
  id: "notification-service-1"
  port: 3004
  check:
    http: "http://notification-service.healthcare.svc.cluster.local:3004/health"
    interval: "10s"
    timeout: "5s"
  tags:
  - "http"
  - "notification"

# Retry Configuration
retry_join:
- "consul.consul.svc.cluster.local"

# Logging
log_level: "INFO"

# Snapshots
snapshots:
  interval: "30m"
  retain: 5
