#!/bin/bash

# Monitoring and Observability Setup Script
# Installs Prometheus, Grafana, Jaeger, and Loki for monitoring

set -e

NAMESPACE="monitoring"

log_info() {
    echo -e "\033[0;34m[INFO]\033[0m $1"
}

log_success() {
    echo -e "\033[0;32m[SUCCESS]\033[0m $1"
}

# Create monitoring namespace
create_monitoring_namespace() {
    log_info "Creating monitoring namespace..."
    kubectl create namespace $NAMESPACE || true
}

# Install Prometheus Operator
install_prometheus() {
    log_info "Installing Prometheus Operator..."
    
    helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
    helm repo update
    
    helm upgrade --install prometheus prometheus-community/kube-prometheus-stack \
        -n $NAMESPACE \
        --set prometheus.prometheusSpec.retention=30d \
        --set prometheus.prometheusSpec.storageSpec.volumeClaimTemplate.spec.resources.requests.storage=50Gi
    
    log_success "Prometheus installed"
}

# Install Grafana
install_grafana() {
    log_info "Installing Grafana..."
    
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    helm upgrade --install grafana grafana/grafana \
        -n $NAMESPACE \
        --set adminPassword=admin123 \
        --set persistence.enabled=true \
        --set persistence.size=10Gi
    
    log_success "Grafana installed"
}

# Install Jaeger for tracing
install_jaeger() {
    log_info "Installing Jaeger..."
    
    helm repo add jaegertracing https://jaegertracing.github.io/helm-charts
    helm repo update
    
    helm upgrade --install jaeger jaegertracing/jaeger \
        -n $NAMESPACE \
        --set storage.type=elasticsearch
    
    log_success "Jaeger installed"
}

# Install Loki for log aggregation
install_loki() {
    log_info "Installing Loki..."
    
    helm repo add grafana https://grafana.github.io/helm-charts
    helm repo update
    
    helm upgrade --install loki grafana/loki-stack \
        -n $NAMESPACE
    
    log_success "Loki installed"
}

# Create ServiceMonitor for Kubernetes services
create_service_monitors() {
    log_info "Creating ServiceMonitors..."
    
    kubectl apply -f - <<EOF
apiVersion: monitoring.coreos.com/v1
kind: ServiceMonitor
metadata:
  name: healthcare-services
  namespace: healthcare
spec:
  selector:
    matchLabels:
      monitoring: enabled
  endpoints:
  - port: metrics
    interval: 30s
EOF
    
    log_success "ServiceMonitors created"
}

# Main
main() {
    log_info "Setting up monitoring and observability..."
    
    create_monitoring_namespace
    install_prometheus
    install_grafana
    install_jaeger
    install_loki
    create_service_monitors
    
    log_success "Monitoring setup complete"
    
    log_info "Access your monitoring tools:"
    log_info "Prometheus: kubectl port-forward -n $NAMESPACE svc/prometheus-operated 9090:9090"
    log_info "Grafana: kubectl port-forward -n $NAMESPACE svc/grafana 3000:80"
    log_info "Jaeger: kubectl port-forward -n $NAMESPACE svc/jaeger-query 16686:16686"
}

main
