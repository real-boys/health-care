#!/bin/bash

# Healthcare Microservices Local Development Deployment
# This script sets up local Docker Compose environment for microservices

set -e

# Configuration
DOCKER_COMPOSE_FILE="docker-compose-microservices.yml"
NETWORK_NAME="healthcare-network"

# Color codes
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m'

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Start services
start_services() {
    log_info "Starting microservices..."
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" up -d
    
    log_success "Services started successfully"
}

# Stop services
stop_services() {
    log_info "Stopping microservices..."
    
    docker-compose -f "$DOCKER_COMPOSE_FILE" down
    
    log_success "Services stopped"
}

# View logs
view_logs() {
    local service=$1
    if [ -z "$service" ]; then
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f
    else
        docker-compose -f "$DOCKER_COMPOSE_FILE" logs -f "$service"
    fi
}

# Get service status
get_status() {
    log_info "Service Status:"
    docker-compose -f "$DOCKER_COMPOSE_FILE" ps
}

# Run health checks
health_check() {
    log_info "Running health checks..."
    
    services=("auth-service" "patient-service" "claims-service" "payment-service" "notification-service" "api-gateway")
    
    for service in "${services[@]}"; do
        url=$(docker-compose -f "$DOCKER_COMPOSE_FILE" exec -T "$service" echo '$SERVICE_PORT' 2>/dev/null || echo "")
        if [ -n "$url" ]; then
            log_info "Checking $service..."
            # Add health check logic here
        fi
    done
}

# Show help
show_help() {
    cat << EOF
Healthcare Microservices Local Development

Usage: ./deploy-local.sh [command]

Commands:
    start               Start all microservices
    stop                Stop all microservices
    restart             Restart all microservices
    logs [service]      View logs (optionally for specific service)
    status              Show service status
    health              Run health checks
    clean               Remove all containers and volumes
    help                Show this help message

Examples:
    ./deploy-local.sh start
    ./deploy-local.sh logs auth-service
    ./deploy-local.sh status
EOF
}

# Main logic
case "${1:-help}" in
    start)
        start_services
        get_status
        ;;
    stop)
        stop_services
        ;;
    restart)
        stop_services
        sleep 2
        start_services
        get_status
        ;;
    logs)
        view_logs "$2"
        ;;
    status)
        get_status
        ;;
    health)
        health_check
        ;;
    clean)
        log_info "Cleaning up..."
        docker-compose -f "$DOCKER_COMPOSE_FILE" down -v
        log_success "Cleanup complete"
        ;;
    help|*)
        show_help
        ;;
esac
