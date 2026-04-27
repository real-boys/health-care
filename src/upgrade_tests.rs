#![cfg(test)]

use soroban_sdk::testutils::{Address as _, Ledger as _};
use soroban_sdk::{vec, Address, Env, BytesN, String};

use crate::healthcare_drips::*;
use crate::upgrade_mechanism::*;

#[test]
fn test_upgrade_mechanism_initialization() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    env.mock_all_auths();
    
    // Initialize upgrade mechanism
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Check if upgrade admin is set
    let stored_admin = env.storage().instance().get(&UPGRADE_ADMIN).unwrap();
    assert_eq!(stored_admin, admin);
    
    // Check if counters are initialized
    assert_eq!(env.storage().instance().get(&Symbol::short("next_proposal_id")).unwrap(), 1u64);
    assert_eq!(env.storage().instance().get(&Symbol::short("next_comm_id")).unwrap(), 1u64);
    
    // Check governance parameters
    assert_eq!(env.storage().instance().get(&Symbol::short("min_approval_percentage")).unwrap(), 66u32);
    assert_eq!(env.storage().instance().get(&Symbol::short("voting_period")).unwrap(), 604800u64);
    assert_eq!(env.storage().instance().get(&Symbol::short("min_stake_amount")).unwrap(), 1000i128);
}

#[test]
fn test_stakeholder_registration() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let stakeholder = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholder
    let stake_amount = 5000i128;
    UpgradeMechanism::register_stakeholder(&env, stakeholder.clone(), stake_amount, admin.clone()).unwrap();
    
    // Check stakeholder info
    let stored_stakeholder = UpgradeMechanism::get_stakeholder(&env, stakeholder.clone()).unwrap();
    assert_eq!(stored_stakeholder.address, stakeholder);
    assert_eq!(stored_stakeholder.stake_amount, stake_amount);
    assert_eq!(stored_stakeholder.voting_power, 2); // 5000 => voting power 2
    assert!(stored_stakeholder.is_active);
    
    // Check stakeholders list
    let stakeholders = UpgradeMechanism::get_all_stakeholders(&env);
    assert_eq!(stakeholders.len(), 1);
    assert_eq!(stakeholders.get(0).unwrap().address, stakeholder);
}

#[test]
fn test_stakeholder_registration_insufficient_stake() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let stakeholder = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Try to register with insufficient stake
    let result = UpgradeMechanism::register_stakeholder(&env, stakeholder, 500i128, admin);
    assert_eq!(result, Err(UpgradeError::InsufficientStake));
}

#[test]
fn test_create_proposal() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholder
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin).unwrap();
    
    // Create proposal
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Medium,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    assert_eq!(proposal_id, 1);
    
    // Check proposal details
    let proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.title, String::from_str(&env, "Test Proposal"));
    assert_eq!(proposal.proposed_by, proposer);
    assert_eq!(proposal.upgrade_type, UpgradeType::Feature);
    assert_eq!(proposal.risk_level, RiskLevel::Medium);
    assert_eq!(proposal.status, UpgradeStatus::Proposed);
    assert_eq!(proposal.required_approval_percentage, 66); // Medium risk requires 66%
}

#[test]
fn test_create_proposal_unauthorized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Try to create proposal without being a stakeholder
    let result = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        unauthorized_user,
    );
    
    assert_eq!(result, Err(UpgradeError::StakeholderNotFound));
}

#[test]
fn test_create_emergency_proposal() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholder
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin).unwrap();
    
    // Create emergency proposal
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Emergency Fix"),
        String::from_str(&env, "Critical security fix"),
        UpgradeType::Emergency,
        RiskLevel::Critical,
        BytesN::from_array(&env, &[2; 32]),
        String::from_str(&env, "Emergency implementation"),
        String::from_str(&env, "Emergency rollback"),
        String::from_str(&env, "Emergency bypass"),
        true,
        proposer.clone(),
    ).unwrap();
    
    let proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.status, UpgradeStatus::Emergency);
    assert!(proposal.emergency);
}

#[test]
fn test_voting() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholders
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, voter1.clone(), 3000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, voter2.clone(), 7000i128, admin).unwrap();
    
    // Create proposal
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    // Submit risk assessment to move to voting
    let assessment = RiskAssessment {
        proposal_id,
        security_score: 80,
        compatibility_score: 85,
        performance_impact: 10,
        breaking_changes: vec![&env],
        dependencies_affected: vec![&env],
        rollback_complexity: RiskLevel::Low,
        test_coverage: 90,
        auditor_notes: String::from_str(&env, "Good assessment"),
        assessed_by: admin,
        assessment_date: env.ledger().timestamp(),
    };
    
    UpgradeMechanism::submit_risk_assessment(&env, proposal_id, assessment, admin).unwrap();
    
    // Cast votes
    UpgradeMechanism::vote(
        &env,
        proposal_id,
        true,
        String::from_str(&env, "Good proposal"),
        voter1.clone(),
    ).unwrap();
    
    UpgradeMechanism::vote(
        &env,
        proposal_id,
        true,
        String::from_str(&env, "Support this"),
        voter2.clone(),
    ).unwrap();
    
    // Check voting results
    let proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.votes_for, 2);
    assert_eq!(proposal.votes_against, 0);
    assert_eq!(proposal.total_stake_weight, 10000i128); // 3000 + 7000
    
    // Check individual votes
    let votes = UpgradeMechanism::get_votes(&env, proposal_id);
    assert_eq!(votes.len(), 2);
}

#[test]
fn test_voting_unauthorized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let unauthorized_voter = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register proposer only
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
    
    // Create proposal
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    // Try to vote without being a stakeholder
    let result = UpgradeMechanism::vote(
        &env,
        proposal_id,
        true,
        String::from_str(&env, "I support this"),
        unauthorized_voter,
    );
    
    assert_eq!(result, Err(UpgradeError::StakeholderNotFound));
}

#[test]
fn test_double_voting() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholders
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, voter.clone(), 3000i128, admin).unwrap();
    
    // Create proposal
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    // Submit risk assessment
    let assessment = RiskAssessment {
        proposal_id,
        security_score: 80,
        compatibility_score: 85,
        performance_impact: 10,
        breaking_changes: vec![&env],
        dependencies_affected: vec![&env],
        rollback_complexity: RiskLevel::Low,
        test_coverage: 90,
        auditor_notes: String::from_str(&env, "Good assessment"),
        assessed_by: admin,
        assessment_date: env.ledger().timestamp(),
    };
    
    UpgradeMechanism::submit_risk_assessment(&env, proposal_id, assessment, admin).unwrap();
    
    // Cast first vote
    UpgradeMechanism::vote(
        &env,
        proposal_id,
        true,
        String::from_str(&env, "First vote"),
        voter.clone(),
    ).unwrap();
    
    // Try to vote again
    let result = UpgradeMechanism::vote(
        &env,
        proposal_id,
        false,
        String::from_str(&env, "Second vote"),
        voter,
    );
    
    assert_eq!(result, Err(UpgradeError::AlreadyVoted));
}

#[test]
fn test_execute_upgrade() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let voter1 = Address::generate(&env);
    let voter2 = Address::generate(&env);
    let voter3 = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholders
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, voter1.clone(), 3000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, voter2.clone(), 3000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, voter3.clone(), 3000i128, admin).unwrap();
    
    // Create low-risk proposal (51% approval required)
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Low Risk Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    // Submit risk assessment
    let assessment = RiskAssessment {
        proposal_id,
        security_score: 90,
        compatibility_score: 90,
        performance_impact: 5,
        breaking_changes: vec![&env],
        dependencies_affected: vec![&env],
        rollback_complexity: RiskLevel::Low,
        test_coverage: 95,
        auditor_notes: String::from_str(&env, "Excellent assessment"),
        assessed_by: admin,
        assessment_date: env.ledger().timestamp(),
    };
    
    UpgradeMechanism::submit_risk_assessment(&env, proposal_id, assessment, admin).unwrap();
    
    // Cast votes (2 for, 1 against = 66.7% approval > 51% required)
    UpgradeMechanism::vote(&env, proposal_id, true, String::from_str(&env, "Support"), voter1).unwrap();
    UpgradeMechanism::vote(&env, proposal_id, true, String::from_str(&env, "Support"), voter2).unwrap();
    UpgradeMechanism::vote(&env, proposal_id, false, String::from_str(&env, "Oppose"), voter3).unwrap();
    
    // Check if proposal is approved
    let proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.status, UpgradeStatus::Approved);
    
    // Execute upgrade
    UpgradeMechanism::execute_upgrade(&env, proposal_id, admin.clone()).unwrap();
    
    // Check execution record
    let execution = UpgradeMechanism::get_execution_record(&env, proposal_id).unwrap();
    assert_eq!(execution.proposal_id, proposal_id);
    assert_eq!(execution.executed_by, admin);
    assert!(execution.success);
    assert!(execution.rollback_available);
    
    // Check proposal status
    let updated_proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(updated_proposal.status, UpgradeStatus::Executed);
}

#[test]
fn test_execute_upgrade_unauthorized() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let unauthorized_user = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholder and create proposal
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
    
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    // Manually set proposal to approved for testing
    let mut proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    proposal.status = UpgradeStatus::Approved;
    env.storage().instance().set(&Symbol::new(&env, &format!("proposal_{}", proposal_id)), &proposal);
    
    // Try to execute upgrade without being admin
    let result = UpgradeMechanism::execute_upgrade(&env, proposal_id, unauthorized_user);
    assert_eq!(result, Err(UpgradeError::Unauthorized));
}

#[test]
fn test_emergency_upgrade() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Execute emergency upgrade
    let proposal_id = UpgradeMechanism::emergency_upgrade(
        &env,
        String::from_str(&env, "Emergency Security Fix"),
        String::from_str(&env, "Critical vulnerability patch"),
        BytesN::from_array(&env, &[3; 32]),
        String::from_str(&env, "Immediate deployment"),
        admin.clone(),
    ).unwrap();
    
    // Check that proposal was created and executed
    let proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
    assert_eq!(proposal.status, UpgradeStatus::Executed);
    assert_eq!(proposal.upgrade_type, UpgradeType::Emergency);
    assert_eq!(proposal.risk_level, RiskLevel::Critical);
    assert!(proposal.emergency);
    
    // Check execution record
    let execution = UpgradeMechanism::get_execution_record(&env, proposal_id).unwrap();
    assert_eq!(execution.executed_by, admin);
    assert!(execution.success);
}

#[test]
fn test_communication_system() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    let stakeholder1 = Address::generate(&env);
    let stakeholder2 = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholders
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, stakeholder1.clone(), 3000i128, admin.clone()).unwrap();
    UpgradeMechanism::register_stakeholder(&env, stakeholder2.clone(), 3000i128, admin).unwrap();
    
    // Create proposal
    let proposal_id = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "Test Proposal"),
        String::from_str(&env, "Test description"),
        UpgradeType::Feature,
        RiskLevel::Low,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer.clone(),
    ).unwrap();
    
    // Send communication
    let recipients = vec![&env, stakeholder1.clone(), stakeholder2.clone()];
    let comm_id = UpgradeMechanism::send_communication(
        &env,
        proposal_id,
        Symbol::short("ANNOUNCEMENT"),
        String::from_str(&env, "Proposal Update"),
        String::from_str(&env, "Proposal is now in voting phase"),
        recipients.clone(),
        proposer.clone(),
    ).unwrap();
    
    // Check communication
    let communications = UpgradeMechanism::get_communications(&env, proposal_id);
    assert_eq!(communications.len(), 1);
    assert_eq!(communications.get(0).unwrap().subject, String::from_str(&env, "Proposal Update"));
    assert_eq!(communications.get(0).unwrap().message_type, Symbol::short("ANNOUNCEMENT"));
}

#[test]
fn test_voting_power_calculation() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Test different stake amounts and their voting power
    let test_cases = vec![
        (500i128, 1),   // < 1000 -> 1
        (1500i128, 2),  // 1000-4999 -> 2
        (8000i128, 3),  // 5000-9999 -> 3
        (25000i128, 5), // 10000-49999 -> 5
        (100000i128, 10), // >= 50000 -> 10
    ];
    
    for (stake_amount, expected_power) in test_cases {
        let stakeholder = Address::generate(&env);
        UpgradeMechanism::register_stakeholder(&env, stakeholder, stake_amount, admin.clone()).unwrap();
        
        let stored_stakeholder = UpgradeMechanism::get_stakeholder(&env, stakeholder).unwrap();
        assert_eq!(stored_stakeholder.voting_power, expected_power);
    }
}

#[test]
fn test_risk_assessment_requirement() {
    let env = Env::default();
    let admin = Address::generate(&env);
    let proposer = Address::generate(&env);
    
    env.mock_all_auths();
    
    UpgradeMechanism::initialize_upgrade(&env, admin.clone());
    
    // Register stakeholder
    UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin).unwrap();
    
    // Try to create high-risk proposal without risk assessment
    let result = UpgradeMechanism::create_proposal(
        &env,
        String::from_str(&env, "High Risk Proposal"),
        String::from_str(&env, "High risk description"),
        UpgradeType::Feature,
        RiskLevel::High,
        BytesN::from_array(&env, &[1; 32]),
        String::from_str(&env, "Implementation plan"),
        String::from_str(&env, "Rollback plan"),
        String::from_str(&env, "QmTestHash"),
        false,
        proposer,
    );
    
    assert_eq!(result, Err(UpgradeError::RiskAssessmentRequired));
}

#[test]
fn test_approval_thresholds() {
    let env = Env::default();
    let admin = Address::generate(&env);
    
    env.mock_all_auths();
    
    // Test that different risk levels have correct approval thresholds
    let test_cases = vec![
        (RiskLevel::Low, 51),
        (RiskLevel::Medium, 66),
        (RiskLevel::High, 75),
        (RiskLevel::Critical, 90),
    ];
    
    for (risk_level, expected_threshold) in test_cases {
        let proposer = Address::generate(&env);
        UpgradeMechanism::register_stakeholder(&env, proposer.clone(), 5000i128, admin.clone()).unwrap();
        
        let proposal_id = UpgradeMechanism::create_proposal(
            &env,
            String::from_str(&env, "Test Proposal"),
            String::from_str(&env, "Test description"),
            UpgradeType::Feature,
            risk_level,
            BytesN::from_array(&env, &[1; 32]),
            String::from_str(&env, "Implementation plan"),
            String::from_str(&env, "Rollback plan"),
            String::from_str(&env, "QmTestHash"),
            false,
            proposer,
        ).unwrap();
        
        let proposal = UpgradeMechanism::get_proposal(&env, proposal_id).unwrap();
        assert_eq!(proposal.required_approval_percentage, expected_threshold);
    }
}
