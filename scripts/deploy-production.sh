#!/bin/bash

# Healthcare Drips Production Deployment Script
# This script automates the complete deployment process

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_NAME="healthcare-drips"
ENVIRONMENT="production"
BACKUP_DIR="/tmp/backups"
LOG_FILE="/tmp/deployment.log"

# Function to print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Function to check prerequisites
check_prerequisites() {
    print_header "Checking Prerequisites"
    
    # Check if required tools are installed
    command -v aws >/dev/null 2>&1 || { print_error "AWS CLI is not installed"; exit 1; }
    command -v docker >/dev/null 2>&1 || { print_error "Docker is not installed"; exit 1; }
    command -v node >/dev/null 2>&1 || { print_error "Node.js is not installed"; exit 1; }
    command -v npm >/dev/null 2>&1 || { print_error "npm is not installed"; exit 1; }
    
    # Check if AWS credentials are configured
    aws sts get-caller-identity >/dev/null 2>&1 || { print_error "AWS credentials not configured"; exit 1; }
    
    # Check if environment variables are set
    if [ -z "$AWS_REGION" ]; then
        print_error "AWS_REGION environment variable is not set"
        exit 1
    fi
    
    if [ -z "$PROJECT_NAME" ]; then
        print_error "PROJECT_NAME environment variable is not set"
        exit 1
    fi
    
    print_status "All prerequisites satisfied"
}

# Function to create backup
create_backup() {
    print_header "Creating Backups"
    
    # Create backup directory
    mkdir -p $BACKUP_DIR
    
    # Backup database
    print_status "Creating database backup..."
    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    DB_BACKUP_FILE="$BACKUP_DIR/database_backup_$TIMESTAMP.sql"
    
    pg_dump $DATABASE_URL > $DB_BACKUP_FILE
    gzip $DB_BACKUP_FILE
    
    print_status "Database backup created: ${DB_BACKUP_FILE}.gz"
    
    # Upload backup to S3
    print_status "Uploading backup to S3..."
    aws s3 cp ${DB_BACKUP_FILE}.gz s3://$PROJECT_NAME-backups/
    
    print_status "Backup uploaded to S3"
}

# Function to run tests
run_tests() {
    print_header "Running Tests"
    
    # Frontend tests
    print_status "Running frontend tests..."
    cd frontend
    npm ci
    npm test -- --coverage --watchAll=false
    FRONTEND_TEST_EXIT_CODE=$?
    
    # Backend tests
    print_status "Running backend tests..."
    cd ../backend
    npm ci
    npm test -- --coverage
    BACKEND_TEST_EXIT_CODE=$?
    
    # Smart contract tests
    print_status "Running smart contract tests..."
    cd ../contracts
    npm ci
    npx hardhat test
    CONTRACT_TEST_EXIT_CODE=$?
    
    # Check if all tests passed
    if [ $FRONTEND_TEST_EXIT_CODE -eq 0 ] && [ $BACKEND_TEST_EXIT_CODE -eq 0 ] && [ $CONTRACT_TEST_EXIT_CODE -eq 0 ]; then
        print_status "All tests passed"
    else
        print_error "Some tests failed"
        exit 1
    fi
}

# Function to build applications
build_applications() {
    print_header "Building Applications"
    
    # Build frontend
    print_status "Building frontend..."
    cd frontend
    npm run build
    FRONTEND_BUILD_EXIT_CODE=$?
    
    # Build backend
    print_status "Building backend..."
    cd ../backend
    npm run build
    BACKEND_BUILD_EXIT_CODE=$?
    
    # Build smart contracts
    print_status "Building smart contracts..."
    cd ../contracts
    npx hardhat compile
    CONTRACT_BUILD_EXIT_CODE=$?
    
    # Check if all builds succeeded
    if [ $FRONTEND_BUILD_EXIT_CODE -eq 0 ] && [ $BACKEND_BUILD_EXIT_CODE -eq 0 ] && [ $CONTRACT_BUILD_EXIT_CODE -eq 0 ]; then
        print_status "All builds completed successfully"
    else
        print_error "Some builds failed"
        exit 1
    fi
}

# Function to deploy frontend
deploy_frontend() {
    print_header "Deploying Frontend"
    
    cd frontend
    
    # Deploy to Vercel
    print_status "Deploying frontend to Vercel..."
    vercel --prod --confirm
    
    # Verify deployment
    print_status "Verifying frontend deployment..."
    sleep 30
    curl -f https://$PROJECT_NAME.com || { print_error "Frontend deployment verification failed"; exit 1; }
    
    print_status "Frontend deployed successfully"
}

# Function to deploy backend
deploy_backend() {
    print_header "Deploying Backend"
    
    # Build and push Docker image
    print_status "Building and pushing Docker image..."
    cd backend
    docker build -t $PROJECT_NAME-backend .
    docker tag $PROJECT_NAME-backend:latest $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-backend:latest
    
    # Get ECR login password
    aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    # Push image
    docker push $AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$PROJECT_NAME-backend:latest
    
    # Update ECS service
    print_status "Updating ECS service..."
    aws ecs update-service --cluster $PROJECT_NAME-cluster --service $PROJECT_NAME-backend --force-new-deployment
    
    # Wait for deployment to complete
    print_status "Waiting for deployment to complete..."
    aws ecs wait services-stable --cluster $PROJECT_NAME-cluster --services $PROJECT_NAME-backend
    
    # Verify deployment
    print_status "Verifying backend deployment..."
    sleep 60
    curl -f https://api.$PROJECT_NAME.com/health || { print_error "Backend deployment verification failed"; exit 1; }
    
    print_status "Backend deployed successfully"
}

# Function to deploy smart contracts
deploy_contracts() {
    print_header "Deploying Smart Contracts"
    
    cd contracts
    
    # Deploy to mainnet
    print_status "Deploying contracts to mainnet..."
    npx hardhat run scripts/deploy-mainnet.js --network mainnet
    
    # Verify contracts
    print_status "Verifying contracts on Etherscan..."
    # Verification is handled in the deployment script
    
    print_status "Smart contracts deployed successfully"
}

# Function to run post-deployment checks
post_deployment_checks() {
    print_header "Running Post-Deployment Checks"
    
    # Check SSL certificates
    print_status "Checking SSL certificates..."
    SSL_RESULT=$(openssl s_client -connect api.$PROJECT_NAME.com:443 -verify_return_error 2>/dev/null | grep "Verify return code: 0" || echo "failed")
    if [ "$SSL_RESULT" = "failed" ]; then
        print_warning "SSL certificate verification failed"
    else
        print_status "SSL certificates are valid"
    fi
    
    # Check security headers
    print_status "Checking security headers..."
    SECURITY_HEADERS=$(curl -s -I https://$PROJECT_NAME.com | grep -E "(X-Frame-Options|X-Content-Type-Options|Strict-Transport-Security)")
    if [ -z "$SECURITY_HEADERS" ]; then
        print_warning "Some security headers are missing"
    else
        print_status "Security headers are present"
    fi
    
    # Check API health
    print_status "Checking API health..."
    API_HEALTH=$(curl -s https://api.$PROJECT_NAME.com/health | jq -r '.status')
    if [ "$API_HEALTH" = "ok" ]; then
        print_status "API is healthy"
    else
        print_error "API health check failed"
        exit 1
    fi
    
    # Check frontend
    print_status "Checking frontend..."
    FRONTEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://$PROJECT_NAME.com)
    if [ "$FRONTEND_STATUS" = "200" ]; then
        print_status "Frontend is accessible"
    else
        print_error "Frontend is not accessible (HTTP $FRONTEND_STATUS)"
        exit 1
    fi
}

# Function to send notification
send_notification() {
    local status=$1
    local message=$2
    
    if [ "$status" = "success" ]; then
        curl -X POST "https://hooks.slack.com/services/$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"✅ Deployment successful: $message\"}"
    else
        curl -X POST "https://hooks.slack.com/services/$SLACK_WEBHOOK_URL" \
            -H 'Content-type: application/json' \
            --data "{\"text\":\"❌ Deployment failed: $message\"}"
    fi
}

# Function to cleanup
cleanup() {
    print_status "Cleaning up temporary files..."
    rm -rf $BACKUP_DIR
    print_status "Cleanup completed"
}

# Main deployment function
main() {
    print_header "Starting Production Deployment"
    
    # Log deployment start
    echo "Deployment started at $(date)" >> $LOG_FILE
    
    # Trap cleanup on exit
    trap cleanup EXIT
    
    # Run deployment steps
    check_prerequisites
    create_backup
    run_tests
    build_applications
    
    # Deploy components
    deploy_frontend
    deploy_backend
    deploy_contracts
    
    # Post-deployment verification
    post_deployment_checks
    
    # Log deployment success
    echo "Deployment completed successfully at $(date)" >> $LOG_FILE
    
    # Send notification
    send_notification "success" "Production deployment completed successfully"
    
    print_header "Deployment Completed Successfully"
    print_status "All components have been deployed and verified"
}

# Handle script interruption
trap 'print_error "Deployment interrupted"; exit 1' INT

# Run main function
main "$@"
