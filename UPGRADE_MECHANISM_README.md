# Smart Contract Upgrade Mechanism

A secure, transparent, and governance-driven upgrade system for the Healthcare Drips smart contract platform.

## 🚀 Features

### Core Functionality
- **Secure Upgrade Proposals**: Create and manage upgrade proposals with detailed metadata
- **Stakeholder Voting**: Weighted voting system based on stake amounts
- **Risk Assessment**: Comprehensive security and compatibility evaluation framework
- **Emergency Upgrades**: Bypass normal voting for critical security fixes
- **Rollback Mechanism**: 7-day rollback window for executed upgrades
- **Communication System**: Built-in notification and discussion tools

### Security Features
- **Role-based Access Control**: Admin, stakeholder, and proposal creator permissions
- **Multi-tier Approval Thresholds**: Risk-based approval requirements (51%-90%)
- **Audit Trail**: Complete on-chain logging of all actions
- **Time-based Controls**: Voting periods and execution deadlines
- **Mandatory Risk Assessments**: High and critical risk proposals require evaluation

### Frontend Components
- **Upgrade Proposal Interface**: Create and manage upgrade proposals
- **Voting Dashboard**: Stakeholder voting interface with real-time results
- **Status Tracker**: Timeline visualization of upgrade progress
- **Risk Assessment Tools**: Visual risk evaluation and scoring
- **Communication Center**: Stakeholder notifications and discussions

## 📋 Requirements

### Backend
- Rust 1.70+
- Soroban SDK 20.0.0+
- Stellar CLI tools

### Frontend
- React 18+
- Node.js 16+
- Modern web browser with Web3 support

## 🛠 Installation

### Backend Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/Great-2025/health-care.git
   cd health-care
   ```

2. **Install Rust and Soroban**
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   cargo install soroban-cli
   rustup target add wasm32-unknown-unknown
   ```

3. **Build contracts**
   ```bash
   cargo build --release --target wasm32-unknown-unknown
   ```

### Frontend Setup

1. **Install dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Configure environment**
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your configuration
   ```

3. **Start development server**
   ```bash
   npm start
   ```

## 🚀 Deployment

### Quick Deploy (Testnet)

1. **Set environment variables**
   ```bash
   export STELLAR_NETWORK=testnet
   export ADMIN_KEY=your_admin_secret_key
   export ADMIN_ADDRESS=your_admin_public_address
   ```

2. **Run deployment script**
   ```bash
   ./scripts/deploy_upgrade_mechanism.sh --build
   ```

### Manual Deployment

1. **Deploy healthcare contract**
   ```bash
   soroban contract deploy \
     --wasm target/wasm32-unknown-unknown/release/healthcare_drips.wasm \
     --source $ADMIN_KEY \
     --network testnet
   ```

2. **Deploy upgrade mechanism**
   ```bash
   soroban contract deploy \
     --wasm target/wasm32-unknown-unknown/release/upgrade_mechanism.wasm \
     --source $ADMIN_KEY \
     --network testnet
   ```

3. **Initialize system**
   ```bash
   soroban contract invoke \
     --id $UPGRADE_CONTRACT_ID \
     --source $ADMIN_KEY \
     --network testnet \
     --function initialize_upgrade \
     --arg $ADMIN_ADDRESS
   ```

## 📖 Usage Guide

### For Administrators

#### Register Stakeholders
```javascript
const stakeholderAddress = "G...";
const stakeAmount = 10000; // Minimum 1000

await contract.register_stakeholder(
  stakeholderAddress,
  stakeAmount,
  adminAddress
);
```

#### Submit Risk Assessment
```javascript
await contract.submit_risk_assessment(
  proposalId,
  {
    security_score: 85,
    compatibility_score: 90,
    performance_impact: 5,
    breaking_changes: ["API change"],
    dependencies_affected: ["payment_module"],
    rollback_complexity: "Low",
    test_coverage: 95,
    auditor_notes: "Comprehensive testing completed"
  },
  adminAddress
);
```

#### Execute Emergency Upgrade
```javascript
await contract.emergency_upgrade(
  "Critical Security Fix",
  "Patch for vulnerability CVE-2024-0001",
  newContractHash,
  "Immediate deployment required",
  adminAddress
);
```

### For Stakeholders

#### Vote on Proposals
```javascript
await contract.vote(
  proposalId,
  true, // Support the proposal
  "This upgrade improves security and performance",
  stakeholderAddress
);
```

#### View Active Proposals
```javascript
const proposals = await contract.get_active_proposals();
const proposal = await contract.get_proposal(proposalId);
const votes = await contract.get_votes(proposalId);
```

### For Proposal Creators

#### Create Upgrade Proposal
```javascript
const proposalId = await contract.create_proposal(
  "Payment System Enhancement",
  "Add support for new payment providers",
  "Feature",
  "Medium",
  newContractHash,
  "1. Deploy new contract\n2. Migrate data\n3. Update endpoints",
  "Revert to previous contract version",
  "ipfs_hash_of_test_results",
  false, // Not emergency
  creatorAddress
);
```

#### Send Communications
```javascript
await contract.send_communication(
  proposalId,
  "ANNOUNCEMENT",
  "Voting Period Extended",
  "Voting deadline extended by 3 days due to community feedback",
  allStakeholderAddresses,
  creatorAddress
);
```

## 🎯 Risk Levels & Approval Thresholds

| Risk Level | Approval Required | Use Case |
|------------|-------------------|----------|
| Low | 51% | Minor features, bug fixes |
| Medium | 66% | New features, API changes |
| High | 75% | Major architectural changes |
| Critical | 90% | Security updates, breaking changes |

## 📊 Voting Power Calculation

Voting power is determined by stake amount:

| Stake Amount | Voting Power |
|--------------|--------------|
| < 1,000 | 1 |
| 1,000 - 4,999 | 2 |
| 5,000 - 9,999 | 3 |
| 10,000 - 49,999 | 5 |
| ≥ 50,000 | 10 |

## 🔄 Upgrade Process Flow

1. **Proposal Creation**: Stakeholder creates upgrade proposal
2. **Risk Assessment**: Admin evaluates security and compatibility (for High/Critical risk)
3. **Voting Period**: Stakeholders vote based on voting power
4. **Approval Check**: Proposal meets required approval threshold
5. **Execution**: Admin executes the upgrade
6. **Rollback Window**: 7-day window to rollback if needed

## 🛡 Security Considerations

### Best Practices
- Use multi-signature wallets for admin accounts
- Conduct regular security audits
- Monitor all admin actions
- Rotate admin keys regularly
- Test all upgrades in staging environment

### Risk Mitigation
- Mandatory risk assessments for high-risk proposals
- Time-locked voting periods
- Rollback mechanisms for failed upgrades
- Emergency procedures for critical fixes
- Comprehensive audit trails

## 📈 Monitoring & Analytics

### Key Metrics
- Proposal success rate
- Stakeholder participation rate
- Voting distribution
- Execution success rate
- Rollback frequency

### Health Checks
```javascript
// Check system status
const admin = await contract.storage().instance().get(UPGRADE_ADMIN);
const activeProposals = await contract.get_active_proposals();
const stakeholders = await contract.get_all_stakeholders();

// Monitor voting participation
const participationRate = votes.length / stakeholders.length;
```

## 🧪 Testing

### Run Tests
```bash
# Run all tests
cargo test

# Run upgrade mechanism tests specifically
cargo test upgrade_mechanism

# Run with output
cargo test -- --nocapture
```

### Test Coverage
The test suite covers:
- Contract initialization
- Stakeholder registration
- Proposal creation and management
- Voting mechanisms
- Upgrade execution
- Emergency procedures
- Risk assessment
- Communication system

## 📚 Documentation

- [Implementation Guide](./SMART_CONTRACT_UPGRADE_GUIDE.md) - Detailed technical documentation
- [API Reference](./docs/api.md) - Complete API documentation
- [Security Audit](./docs/security_audit.md) - Security assessment report
- [Troubleshooting](./docs/troubleshooting.md) - Common issues and solutions

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

### Development Guidelines
- Follow Rust best practices
- Maintain test coverage > 90%
- Document all public functions
- Use conventional commit messages
- Ensure all tests pass before submitting

## 📋 Configuration

### Environment Variables
```bash
# Stellar Network
STELLAR_NETWORK=testnet  # or mainnet

# Admin Configuration
ADMIN_KEY=your_admin_secret_key
ADMIN_ADDRESS=your_admin_public_address

# Contract Paths
CONTRACT_WASM_PATH=./target/wasm32-unknown-unknown/release/healthcare_drips.wasm
UPGRADE_WASM_PATH=./target/wasm32-unknown-unknown/release/upgrade_mechanism.wasm

# Frontend Configuration
REACT_APP_STELLAR_NETWORK=testnet
REACT_APP_CONTRACT_ID=your_contract_id
REACT_APP_UPGRADE_CONTRACT_ID=upgrade_contract_id
```

### Governance Parameters
```rust
// Voting periods (seconds)
VOTING_PERIOD: 604800        // 7 days
EMERGENCY_VOTING_PERIOD: 86400 // 24 hours

// Minimum stake
MIN_STAKE_AMOUNT: 1000

// Rollback window
ROLLBACK_PERIOD: 604800     // 7 days
```

## 🔧 Troubleshooting

### Common Issues

#### Proposal Creation Fails
**Error**: `StakeholderNotFound`
**Solution**: Ensure the creator is registered as an active stakeholder

#### Voting Fails
**Error**: `AlreadyVoted`
**Solution**: Each stakeholder can only vote once per proposal

#### Execution Fails
**Error**: `InsufficientApproval`
**Solution**: Check if proposal received required approval percentage

#### Emergency Upgrade Fails
**Error**: `Unauthorized`
**Solution**: Only upgrade admins can execute emergency upgrades

### Debug Commands
```bash
# View proposal details
soroban contract read --id $UPGRADE_CONTRACT_ID --key "proposal_1"

# View stakeholder info
soroban contract read --id $UPGRADE_CONTRACT_ID --key "stakeholder_address"

# Check admin status
soroban contract read --id $UPGRADE_CONTRACT_ID --key "UPGRADE_ADMIN"
```

## 📞 Support

- **GitHub Issues**: [Report bugs and request features](https://github.com/Great-2025/health-care/issues)
- **Documentation**: [Complete documentation](https://docs.healthcare-drips.com)
- **Community**: [Discord Server](https://discord.gg/healthcare-drips)
- **Email**: support@healthcare-drips.com

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Soroban team for the excellent smart contract platform
- Stellar Development Foundation for the infrastructure
- Healthcare Drips community for feedback and contributions
- Security auditors for their valuable insights

---

**Built with ❤️ for the Healthcare Drips community**
