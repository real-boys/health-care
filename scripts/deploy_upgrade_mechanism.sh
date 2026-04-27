#!/bin/bash

# Smart Contract Upgrade Mechanism Deployment Script
# This script deploys the upgrade mechanism and initializes the system

set -e

# Configuration
NETWORK=${STELLAR_NETWORK:-testnet}
ADMIN_KEY=${ADMIN_KEY:-}
ADMIN_ADDRESS=${ADMIN_ADDRESS:-}
CONTRACT_WASM_PATH=${CONTRACT_WASM_PATH:-./target/wasm32-unknown-unknown/release/healthcare_drips.wasm}
UPGRADE_WASM_PATH=${UPGRADE_WASM_PATH:-./target/wasm32-unknown-unknown/release/upgrade_mechanism.wasm}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    # Check if soroban-cli is installed
    if ! command -v soroban &> /dev/null; then
        log_error "soroban-cli is not installed. Please install it first."
        exit 1
    fi
    
    # Check if WASM files exist
    if [ ! -f "$CONTRACT_WASM_PATH" ]; then
        log_error "Contract WASM file not found at $CONTRACT_WASM_PATH"
        log_info "Please run: cargo build --release --target wasm32-unknown-unknown"
        exit 1
    fi
    
    if [ ! -f "$UPGRADE_WASM_PATH" ]; then
        log_error "Upgrade mechanism WASM file not found at $UPGRADE_WASM_PATH"
        log_info "Please run: cargo build --release --target wasm32-unknown-unknown"
        exit 1
    fi
    
    # Check if admin key is provided
    if [ -z "$ADMIN_KEY" ]; then
        log_error "ADMIN_KEY environment variable is required"
        exit 1
    fi
    
    # Check if admin address is provided
    if [ -z "$ADMIN_ADDRESS" ]; then
        log_error "ADMIN_ADDRESS environment variable is required"
        exit 1
    fi
    
    log_info "Prerequisites check completed"
}

# Build contracts
build_contracts() {
    log_info "Building contracts..."
    
    # Build for wasm32 target
    rustup target add wasm32-unknown-unknown
    
    # Build contracts
    cargo build --release --target wasm32-unknown-unknown
    
    log_info "Contracts built successfully"
}

# Deploy main healthcare contract
deploy_healthcare_contract() {
    log_info "Deploying main healthcare contract..."
    
    # Deploy the healthcare contract
    HEALTHCARE_CONTRACT_ID=$(soroban contract deploy \
        --wasm "$CONTRACT_WASM_PATH" \
        --source "$ADMIN_KEY" \
        --network "$NETWORK")
    
    log_info "Healthcare contract deployed with ID: $HEALTHCARE_CONTRACT_ID"
    
    # Initialize the healthcare contract
    log_info "Initializing healthcare contract..."
    soroban contract invoke \
        --id "$HEALTHCARE_CONTRACT_ID" \
        --source "$ADMIN_KEY" \
        --network "$NETWORK" \
        --function initialize \
        --arg "$ADMIN_ADDRESS"
    
    log_info "Healthcare contract initialized"
}

# Deploy upgrade mechanism contract
deploy_upgrade_mechanism() {
    log_info "Deploying upgrade mechanism contract..."
    
    # Deploy the upgrade mechanism contract
    UPGRADE_CONTRACT_ID=$(soroban contract deploy \
        --wasm "$UPGRADE_WASM_PATH" \
        --source "$ADMIN_KEY" \
        --network "$NETWORK")
    
    log_info "Upgrade mechanism contract deployed with ID: $UPGRADE_CONTRACT_ID"
    
    # Initialize the upgrade mechanism
    log_info "Initializing upgrade mechanism..."
    soroban contract invoke \
        --id "$UPGRADE_CONTRACT_ID" \
        --source "$ADMIN_KEY" \
        --network "$NETWORK" \
        --function initialize_upgrade \
        --arg "$ADMIN_ADDRESS"
    
    log_info "Upgrade mechanism initialized"
}

# Register initial stakeholders
register_stakeholders() {
    log_info "Registering initial stakeholders..."
    
    # Read stakeholders from file or use environment variables
    if [ -f "./stakeholders.txt" ]; then
        while IFS=, read -r address stake_amount; do
            log_info "Registering stakeholder: $address with stake: $stake_amount"
            soroban contract invoke \
                --id "$UPGRADE_CONTRACT_ID" \
                --source "$ADMIN_KEY" \
                --network "$NETWORK" \
                --function register_stakeholder \
                --arg "$address" \
                --arg "$stake_amount"
        done < "./stakeholders.txt"
    else
        log_warn "No stakeholders.txt file found. Please register stakeholders manually."
        log_info "Example stakeholder registration:"
        log_info "soroban contract invoke --id \$UPGRADE_CONTRACT_ID --source \$ADMIN_KEY --network \$NETWORK --function register_stakeholder --arg STAKEHOLDER_ADDRESS --arg 10000"
    fi
    
    log_info "Stakeholder registration completed"
}

# Verify deployment
verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check if contracts are accessible
    log_info "Checking healthcare contract..."
    soroban contract read \
        --id "$HEALTHCARE_CONTRACT_ID" \
        --network "$NETWORK" \
        --key ISSUE_CREATOR
    
    log_info "Checking upgrade mechanism contract..."
    soroban contract read \
        --id "$UPGRADE_CONTRACT_ID" \
        --network "$NETWORK" \
        --key UPGRADE_ADMIN
    
    log_info "Deployment verification completed successfully"
}

# Save deployment configuration
save_config() {
    log_info "Saving deployment configuration..."
    
    cat > .upgrade_config << EOF
# Smart Contract Upgrade Mechanism Configuration
# Generated on $(date)

NETWORK=$NETWORK
ADMIN_KEY=$ADMIN_KEY
ADMIN_ADDRESS=$ADMIN_ADDRESS

HEALTHCARE_CONTRACT_ID=$HEALTHCARE_CONTRACT_ID
UPGRADE_CONTRACT_ID=$UPGRADE_CONTRACT_ID

# Deployment timestamp
DEPLOYMENT_TIMESTAMP=$(date +%s)
EOF

    log_info "Configuration saved to .upgrade_config"
}

# Display deployment summary
display_summary() {
    log_info "Deployment Summary"
    log_info "=================="
    log_info "Network: $NETWORK"
    log_info "Admin Address: $ADMIN_ADDRESS"
    log_info "Healthcare Contract ID: $HEALTHCARE_CONTRACT_ID"
    log_info "Upgrade Mechanism Contract ID: $UPGRADE_CONTRACT_ID"
    log_info ""
    log_info "Next Steps:"
    log_info "1. Update your frontend configuration with the contract IDs"
    log_info "2. Register additional stakeholders if needed"
    log_info "3. Test the upgrade mechanism with a test proposal"
    log_info "4. Monitor the system for proper functionality"
}

# Main deployment function
main() {
    log_info "Starting Smart Contract Upgrade Mechanism Deployment"
    log_info "=================================================="
    
    check_prerequisites
    
    if [ "$1" = "--build" ]; then
        build_contracts
    fi
    
    deploy_healthcare_contract
    deploy_upgrade_mechanism
    register_stakeholders
    verify_deployment
    save_config
    display_summary
    
    log_info "Deployment completed successfully!"
}

# Handle command line arguments
case "${1:-}" in
    --help|-h)
        echo "Usage: $0 [OPTIONS]"
        echo ""
        echo "Options:"
        echo "  --build    Build contracts before deployment"
        echo "  --help     Show this help message"
        echo ""
        echo "Environment Variables:"
        echo "  STELLAR_NETWORK    Network to deploy to (testnet|mainnet)"
        echo "  ADMIN_KEY          Admin private key for deployment"
        echo "  ADMIN_ADDRESS      Admin public address"
        echo "  CONTRACT_WASM_PATH Path to healthcare contract WASM"
        echo "  UPGRADE_WASM_PATH  Path to upgrade mechanism WASM"
        exit 0
        ;;
    *)
        main "$@"
        ;;
esac
