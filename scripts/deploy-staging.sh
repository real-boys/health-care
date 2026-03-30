#!/bin/bash

# Healthcare Drips Staging Deployment Script
# This script automates deployment to staging environment

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
PROJECT_NAME="healthcare-drips"
ENVIRONMENT="staging"
DOMAIN="staging.$PROJECT_NAME.com"

print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_header() {
    echo -e "${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}"
}

# Deploy to staging environment
deploy_staging() {
    print_header "Deploying to Staging Environment"
    
    # Deploy frontend to Vercel preview
    print_status "Deploying frontend to staging..."
    cd frontend
    vercel --confirm
    
    # Deploy backend to staging
    print_status "Deploying backend to staging..."
    cd ../backend
    heroku git:remote -a $PROJECT_NAME-staging-api
    git subtree push --prefix backend heroku main
    
    # Deploy contracts to testnet
    print_status "Deploying contracts to testnet..."
    cd ../contracts
    npx hardhat run scripts/deploy-testnet.js --network goerli
    
    print_status "Staging deployment completed"
    print_status "Frontend: https://$DOMAIN"
    print_status "Backend API: https://api.$DOMAIN"
}

deploy_staging
