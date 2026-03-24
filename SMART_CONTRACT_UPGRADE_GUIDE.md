# Smart Contract Upgrade Mechanism - Implementation Guide

## Overview

This document provides a comprehensive guide for implementing and managing the smart contract upgrade mechanism for the Healthcare Drips platform. The upgrade system ensures secure, transparent, and governance-driven contract updates without disrupting existing operations.

## Architecture

### Core Components

1. **Upgrade Mechanism Contract** (`upgrade_mechanism.rs`)
   - Manages upgrade proposals and voting
   - Handles stakeholder registration and voting power
   - Controls upgrade execution and rollback

2. **Data Structures**
   - `UpgradeProposal`: Proposal metadata and voting data
   - `Stakeholder`: Stakeholder information and voting power
   - `Vote`: Individual vote records
   - `RiskAssessment`: Security and compatibility evaluation
   - `UpgradeExecution`: Execution records and rollback data

3. **Frontend Components**
   - `UpgradeProposalInterface`: Create and manage proposals
   - `VotingDashboard`: Stakeholder voting interface
   - `UpgradeStatusTracker`: Timeline and status monitoring
   - `RiskAssessmentVisualization`: Risk evaluation tools
   - `CommunicationTools`: Stakeholder notifications

## Security Features

### Access Control
- **Role-based permissions**: Admin, stakeholder, proposal creator roles
- **Multi-signature requirements**: Critical upgrades need multiple approvals
- **Time-based controls**: Voting periods and execution deadlines

### Risk Management
- **Tiered approval thresholds**: Based on risk level (Low: 51%, Medium: 66%, High: 75%, Critical: 90%)
- **Mandatory risk assessments**: High and critical risk proposals require evaluation
- **Rollback mechanisms**: 7-day rollback window for executed upgrades
- **Emergency procedures**: Bypass normal voting for critical security fixes

### Audit Trail
- **Complete transaction logging**: All actions recorded on-chain
- **Communication tracking**: All stakeholder communications preserved
- **Version history**: Full upgrade history with execution details

## Deployment Guide

### Prerequisites

1. **Stellar Network Setup**
   ```bash
   # Install Stellar CLI tools
   npm install -g stellar-cli
   
   # Configure network (testnet/mainnet)
   stellar --network testnet
   ```

2. **Rust Environment**
   ```bash
   # Install Rust and Soroban SDK
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   cargo install soroban-cli
   ```

3. **Dependencies**
   ```bash
   # Clone repository
   git clone https://github.com/Great-2025/health-care.git
   cd health-care
   
   # Install dependencies
   cargo build --release
   ```

### Contract Deployment

#### 1. Deploy Base Healthcare Contract
```bash
# Deploy the main healthcare contract
soroban contract deploy healthcare_drips.wasm \
  --source admin_key \
  --network testnet
```

#### 2. Deploy Upgrade Mechanism
```bash
# Deploy upgrade mechanism contract
soroban contract deploy upgrade_mechanism.wasm \
  --source admin_key \
  --network testnet
```

#### 3. Initialize Upgrade System
```bash
# Initialize the upgrade mechanism
soroban contract invoke \
  --id upgrade_contract_id \
  --source admin_key \
  --function initialize_upgrade \
  --arg admin_address
```

#### 4. Register Initial Stakeholders
```bash
# Register stakeholders with voting power
soroban contract invoke \
  --id upgrade_contract_id \
  --source admin_key \
  --function register_stakeholder \
  --arg stakeholder_address \
  --arg 10000  # Stake amount
```

### Frontend Setup

#### 1. Install Dependencies
```bash
cd frontend
npm install
```

#### 2. Configure Environment
```javascript
// .env.local
REACT_APP_STELLAR_NETWORK=testnet
REACT_APP_CONTRACT_ID=your_contract_id
REACT_APP_UPGRADE_CONTRACT_ID=upgrade_contract_id
```

#### 3. Start Development Server
```bash
npm start
```

## Configuration

### Governance Parameters

Default governance parameters can be customized during initialization:

```rust
// Minimum approval percentage by risk level
const APPROVAL_THRESHOLDS: Map<RiskLevel, u32> = {
    RiskLevel::Low: 51,
    RiskLevel::Medium: 66,
    RiskLevel::High: 75,
    RiskLevel::Critical: 90,
};

// Voting periods (in seconds)
const VOTING_PERIOD: u64 = 604800;        // 7 days
const EMERGENCY_VOTING_PERIOD: u64 = 86400; // 24 hours

// Minimum stake to participate
const MIN_STAKE_AMOUNT: i128 = 1000;
```

### Risk Assessment Criteria

Risk assessments evaluate multiple dimensions:

1. **Security Score** (0-100): Code security and vulnerability assessment
2. **Compatibility Score** (0-100): Backward compatibility evaluation
3. **Performance Impact** (-100 to +100): Expected performance changes
4. **Test Coverage** (0-100%): Test suite completeness
5. **Rollback Complexity**: Difficulty of rolling back changes

## Usage Guide

### For Administrators

#### 1. Stakeholder Management
```javascript
// Register new stakeholder
await contract.register_stakeholder(
  stakeholder_address,
  stake_amount,
  admin_address
);

// Update stake amount
await contract.update_stake(
  stakeholder_address,
  new_amount,
  stakeholder_address
);
```

#### 2. Risk Assessment
```javascript
// Submit risk assessment
await contract.submit_risk_assessment(
  proposal_id,
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
  admin_address
);
```

#### 3. Emergency Upgrades
```javascript
// Execute emergency upgrade
await contract.emergency_upgrade(
  "Critical Security Fix",
  "Patch for vulnerability CVE-2024-0001",
  new_contract_hash,
  "Immediate deployment required",
  admin_address
);
```

### For Stakeholders

#### 1. Voting on Proposals
```javascript
// Cast vote
await contract.vote(
  proposal_id,
  true,  // Support
  "This upgrade improves security and performance",
  stakeholder_address
);
```

#### 2. Viewing Proposals
```javascript
// Get active proposals
const proposals = await contract.get_active_proposals();

// Get specific proposal
const proposal = await contract.get_proposal(proposal_id);

// Get voting history
const votes = await contract.get_votes(proposal_id);
```

### For Proposal Creators

#### 1. Creating Proposals
```javascript
// Create new upgrade proposal
const proposal_id = await contract.create_proposal(
  "Payment System Enhancement",
  "Add support for new payment providers",
  "Feature",
  "Medium",
  new_contract_hash,
  "1. Deploy new contract\n2. Migrate data\n3. Update endpoints",
  "Revert to previous contract version",
  "ipfs_hash_of_test_results",
  false, // Not emergency
  creator_address
);
```

#### 2. Communications
```javascript
// Send update to stakeholders
await contract.send_communication(
  proposal_id,
  "ANNOUNCEMENT",
  "Voting Period Extended",
  "Voting deadline extended by 3 days due to community feedback",
  all_stakeholder_addresses,
  creator_address
);
```

## Monitoring and Maintenance

### Health Checks

#### 1. Contract Status
```javascript
// Check upgrade mechanism status
const admin = await contract.storage().instance().get(UPGRADE_ADMIN);
const active_proposals = await contract.get_active_proposals();
const stakeholders = await contract.get_all_stakeholders();
```

#### 2. Voting Participation
```javascript
// Monitor voting rates
const proposals = await contract.get_active_proposals();
for (const proposal of proposals) {
  const votes = await contract.get_votes(proposal.id);
  const participation_rate = votes.length / stakeholders.length;
  console.log(`Proposal ${proposal.id}: ${participation_rate * 100}% participation`);
}
```

#### 3. Execution Monitoring
```javascript
// Check executed upgrades
for (const proposal of proposals) {
  if (proposal.status === 'Executed') {
    const execution = await contract.get_execution_record(proposal.id);
    console.log(`Upgrade ${proposal.id} executed by ${execution.executed_by}`);
    
    // Check rollback window
    if (execution.rollback_available) {
      const time_to_rollback = execution.rollback_deadline - current_time;
      console.log(`Rollback available for ${time_to_rollback} seconds`);
    }
  }
}
```

### Backup and Recovery

#### 1. State Backup
```bash
# Export contract state
soroban contract read \
  --id upgrade_contract_id \
  --all-keys \
  --output backup.json
```

#### 2. Emergency Rollback
```javascript
// Check if rollback is available
const execution = await contract.get_execution_record(proposal_id);
if (execution.rollback_available && 
    execution.rollback_deadline > current_time) {
  // Initiate rollback (admin only)
  await contract.initiate_rollback(proposal_id, admin_address);
}
```

## Best Practices

### Security

1. **Multi-signature wallets**: Use multi-sig for admin accounts
2. **Regular audits**: Conduct security audits of upgrade mechanism
3. **Access logging**: Monitor all admin actions
4. **Key rotation**: Regularly rotate admin and stakeholder keys

### Governance

1. **Transparent communication**: Keep stakeholders informed
2. **Adequate voting periods**: Allow sufficient time for review
3. **Documentation**: Maintain comprehensive upgrade documentation
4. **Testing**: Thoroughly test all upgrades in staging environment

### Risk Management

1. **Gradual rollouts**: Use feature flags when possible
2. **Monitoring**: Implement real-time monitoring of deployed upgrades
3. **Rollback planning**: Always have clear rollback procedures
4. **Stakeholder education**: Ensure stakeholders understand upgrade process

## Troubleshooting

### Common Issues

#### 1. Proposal Creation Fails
**Problem**: `StakeholderNotFound` error
**Solution**: Ensure the creator is registered as an active stakeholder

#### 2. Voting Fails
**Problem**: `AlreadyVoted` error
**Solution**: Each stakeholder can only vote once per proposal

#### 3. Execution Fails
**Problem**: `InsufficientApproval` error
**Solution**: Check if proposal received required approval percentage

#### 4. Emergency Upgrade Fails
**Problem**: `Unauthorized` error
**Solution**: Only upgrade admins can execute emergency upgrades

### Debugging Tools

#### 1. Contract State Inspection
```bash
# View specific proposal
soroban contract read \
  --id upgrade_contract_id \
  --key "proposal_1"

# View stakeholder info
soroban contract read \
  --id upgrade_contract_id \
  --key "stakeholder_address"
```

#### 2. Event Monitoring
```javascript
// Listen for upgrade events
contract.events().on('ProposalCreated', (event) => {
  console.log('New proposal:', event);
});

contract.events().on('VoteCast', (event) => {
  console.log('Vote cast:', event);
});

contract.events().on('UpgradeExecuted', (event) => {
  console.log('Upgrade executed:', event);
});
```

## Version History

### v1.0.0 (Current)
- Initial implementation of upgrade mechanism
- Stakeholder voting system
- Risk assessment framework
- Emergency upgrade procedures
- Comprehensive frontend components

### Future Enhancements
- Automated testing integration
- Advanced analytics dashboard
- Cross-chain upgrade support
- DAO integration for governance

## Support

For technical support and questions:
- GitHub Issues: https://github.com/Great-2025/health-care/issues
- Documentation: https://docs.healthcare-drips.com
- Community Discord: https://discord.gg/healthcare-drips

## License

This upgrade mechanism is licensed under the MIT License. See LICENSE file for details.
