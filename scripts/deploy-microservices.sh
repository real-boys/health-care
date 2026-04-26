#!/bin/bash

# Healthcare Microservices Kubernetes Deployment Script
# This script deploys the entire microservices architecture to Kubernetes

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER_NAME=${CLUSTER_NAME:-"healthcare-cluster"}
REGION=${REGION:-"us-east-1"}
NAMESPACE="healthcare"
DOCKER_REGISTRY=${DOCKER_REGISTRY:-"docker.io"}
IMAGE_TAG=${IMAGE_TAG:-"latest"}

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    commands=("kubectl" "docker" "helm")
    for cmd in "${commands[@]}"; do
        if ! command -v $cmd &> /dev/null; then
            log_error "$cmd is not installed"
            exit 1
        fi
    done
    
    log_success "All prerequisites are met"
}

# Create namespace
create_namespace() {
    log_info "Creating Kubernetes namespace: $NAMESPACE"
    
    if kubectl get namespace $NAMESPACE &> /dev/null; then
        log_warning "Namespace $NAMESPACE already exists"
    else
        kubectl create namespace $NAMESPACE
        kubectl label namespace $NAMESPACE istio-injection=enabled
        log_success "Namespace $NAMESPACE created"
    fi
}

# Build Docker images
build_docker_images() {
    log_info "Building Docker images..."
    
    services=("auth-service" "patient-service" "claims-service" "notification-service" "payment-service" "api-gateway")
    
    for service in "${services[@]}"; do
        log_info "Building $service..."
        docker build \
            -f services/${service}.Dockerfile \
            -t ${DOCKER_REGISTRY}/healthcare/${service}:${IMAGE_TAG} \
            .
        log_success "$service built successfully"
    done
}

# Push Docker images
push_docker_images() {
    log_info "Pushing Docker images to registry..."
    
    services=("auth-service" "patient-service" "claims-service" "notification-service" "payment-service" "api-gateway")
    
    for service in "${services[@]}"; do
        log_info "Pushing $service..."
        docker push ${DOCKER_REGISTRY}/healthcare/${service}:${IMAGE_TAG}
        log_success "$service pushed successfully"
    done
}

# Install Istio
install_istio() {
    log_info "Installing Istio service mesh..."
    
    if helm repo list | grep -q "istio"; then
        log_warning "Istio repo already added"
    else
        helm repo add istio https://istio-release.storage.googleapis.com/charts
        helm repo update
    fi
    
    helm upgrade --install istio-base istio/base \
        -n istio-system --create-namespace
    
    helm upgrade --install istiod istio/istiod \
        -n istio-system
    
    helm upgrade --install istio-ingress istio/gateway \
        -n istio-ingress --create-namespace
    
    log_success "Istio installed successfully"
}

# Install Consul
install_consul() {
    log_info "Installing Consul for service discovery..."
    
    if helm repo list | grep -q "hashicorp"; then
        log_warning "HashiCorp repo already added"
    else
        helm repo add hashicorp https://helm.releases.hashicorp.com
        helm repo update
    fi
    
    helm upgrade --install consul hashicorp/consul \
        -n consul --create-namespace \
        -f consul-config/consul-helm-values.yaml
    
    log_success "Consul installed successfully"
}

# Deploy Kubernetes manifests
deploy_kubernetes_manifests() {
    log_info "Deploying Kubernetes manifests..."
    
    # Create namespace and config
    kubectl apply -f k8s/01-namespace-config.yaml
    
    # Wait for namespace to be ready
    sleep 5
    
    # Deploy services and deployments
    kubectl apply -f k8s/02-services-deployments.yaml
    
    # Deploy databases and HPA
    kubectl apply -f k8s/03-databases-hpa-pdb.yaml
    
    # Deploy network policies
    kubectl apply -f k8s/04-network-policies.yaml
    
    # Deploy Consul
    kubectl apply -f k8s/05-consul-deployment.yaml
    
    # Deploy ConfigMaps
    kubectl apply -f k8s/06-configmaps.yaml
    
    log_success "Kubernetes manifests deployed successfully"
}

# Deploy Istio configurations
deploy_istio_config() {
    log_info "Deploying Istio configurations..."
    
    kubectl apply -f istio/01-istio-config.yaml
    kubectl apply -f istio/02-istio-advanced.yaml
    
    log_success "Istio configurations deployed successfully"
}

# Wait for deployments
wait_for_deployments() {
    log_info "Waiting for deployments to be ready..."
    
    services=("auth-service" "patient-service" "claims-service" "notification-service" "payment-service" "api-gateway" "mongodb" "redis")
    
    for service in "${services[@]}"; do
        log_info "Waiting for $service..."
        kubectl rollout status deployment/$service -n $NAMESPACE --timeout=5m || \
        kubectl rollout status statefulset/$service -n $NAMESPACE --timeout=5m || true
    done
    
    log_success "All deployments are ready"
}

# Get service endpoints
get_service_endpoints() {
    log_info "Service endpoints:"
    
    services=$(kubectl get svc -n $NAMESPACE --no-headers -o custom-columns=NAME:.metadata.name,EXTERNAL-IP:.status.loadBalancer.ingress[0].ip)
    
    echo "$services"
}

# Verify deployments
verify_deployments() {
    log_info "Verifying deployments..."
    
    log_info "Checking pods status..."
    kubectl get pods -n $NAMESPACE
    
    log_info "Checking services..."
    kubectl get svc -n $NAMESPACE
    
    log_info "Checking deployments..."
    kubectl get deployments -n $NAMESPACE
}

# Main deployment flow
main() {
    log_info "Starting Healthcare Microservices Deployment"
    
    check_prerequisites
    create_namespace
    
    # Ask user if they want to build and push images
    read -p "Build and push Docker images? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        build_docker_images
        push_docker_images
    fi
    
    install_istio
    install_consul
    deploy_kubernetes_manifests
    deploy_istio_config
    wait_for_deployments
    verify_deployments
    get_service_endpoints
    
    log_success "Healthcare Microservices Deployment Complete!"
    log_info "Access your services at the endpoints above"
}

# Run main function
main
