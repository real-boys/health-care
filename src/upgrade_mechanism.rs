#![no_std]

use soroban_sdk::{
    contract, contracterror, contractimpl, contracttype, Address, Env, Symbol, Vec, Map,
    token, BytesN, String
};

use crate::healthcare_drips::*;

// ========== UPGRADE CONSTANTS ==========
const UPGRADE_PROPOSAL: Symbol = Symbol::short("UP");
const STAKEHOLDER: Symbol = Symbol::short("SH");
const UPGRADE_ADMIN: Symbol = Symbol::short("UA");

// ========== UPGRADE TYPES ==========

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum UpgradeStatus {
    Draft = 0,
    Proposed = 1,
    Voting = 2,
    Approved = 3,
    Rejected = 4,
    Executed = 5,
    Cancelled = 6,
    Emergency = 7,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum UpgradeType {
    Feature = 0,
    Security = 1,
    BugFix = 2,
    Optimization = 3,
    Emergency = 4,
    Governance = 5,
}

#[contracttype]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum RiskLevel {
    Low = 0,
    Medium = 1,
    High = 2,
    Critical = 3,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeProposal {
    pub id: u64,
    pub title: String,
    pub description: String,
    pub upgrade_type: UpgradeType,
    pub risk_level: RiskLevel,
    pub proposed_by: Address,
    pub new_contract_hash: BytesN<32>,
    pub implementation_plan: String,
    pub rollback_plan: String,
    pub test_results: String, // IPFS hash to test results
    pub voting_deadline: u64,
    pub execution_deadline: u64,
    pub status: UpgradeStatus,
    pub votes_for: u32,
    pub votes_against: u32,
    pub total_stake_weight: i128,
    pub required_approval_percentage: u32,
    pub created: u64,
    pub last_updated: u64,
    pub emergency: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Vote {
    pub voter: Address,
    pub proposal_id: u64,
    pub support: bool,
    pub stake_weight: i128,
    pub reason: String,
    pub timestamp: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Stakeholder {
    pub address: Address,
    pub stake_amount: i128,
    pub voting_power: u32,
    pub reputation: u32,
    pub joined: u64,
    pub last_activity: u64,
    pub is_active: bool,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct UpgradeExecution {
    pub proposal_id: u64,
    pub old_contract_hash: BytesN<32>,
    pub new_contract_hash: BytesN<32>,
    pub executed_by: Address,
    pub execution_timestamp: u64,
    pub success: bool,
    pub gas_used: u64,
    pub rollback_available: bool,
    pub rollback_deadline: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct RiskAssessment {
    pub proposal_id: u64,
    pub security_score: u32, // 0-100
    pub compatibility_score: u32, // 0-100
    pub performance_impact: i32, // -100 to +100
    pub breaking_changes: Vec<String>,
    pub dependencies_affected: Vec<String>,
    pub rollback_complexity: RiskLevel,
    pub test_coverage: u32, // percentage
    pub auditor_notes: String,
    pub assessed_by: Address,
    pub assessment_date: u64,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct CommunicationLog {
    pub id: u64,
    pub proposal_id: u64,
    pub sender: Address,
    pub message_type: Symbol, // ANNOUNCEMENT, WARNING, UPDATE, QUESTION
    pub subject: String,
    pub content: String,
    pub recipients: Vec<Address>,
    pub timestamp: u64,
    pub read_receipts: Vec<Address>,
}

// ========== UPGRADE ERRORS ==========
#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
pub enum UpgradeError {
    Unauthorized = 1001,
    InvalidProposalId = 1002,
    ProposalNotActive = 1003,
    VotingEnded = 1004,
    AlreadyVoted = 1005,
    InsufficientStake = 1006,
    InvalidUpgradeType = 1007,
    DeadlineExpired = 1008,
    ExecutionFailed = 1009,
    RollbackFailed = 1010,
    RiskAssessmentRequired = 1011,
    EmergencyUpgradeRequired = 1012,
    StakeholderNotFound = 1013,
    InvalidContractHash = 1014,
    InsufficientApproval = 1015,
    UpgradeAlreadyExecuted = 1016,
    StakeholderNotActive = 1017,
}

// ========== UPGRADE CONTRACT ==========
#[contract]
pub struct UpgradeMechanism;

#[contractimpl]
impl UpgradeMechanism {
    // ========== INITIALIZATION ==========
    
    pub fn initialize_upgrade(env: &Env, upgrade_admin: Address) {
        // Set upgrade admin
        env.storage().instance().set(&UPGRADE_ADMIN, &upgrade_admin);
        
        // Initialize counters
        env.storage().instance().set(&Symbol::short("next_proposal_id"), &1u64);
        env.storage().instance().set(&Symbol::short("next_vote_id"), &1u64);
        env.storage().instance().set(&Symbol::short("next_comm_id"), &1u64);
        
        // Initialize governance parameters
        env.storage().instance().set(&Symbol::short("min_approval_percentage"), &66u32); // 66% default
        env.storage().instance().set(&Symbol::short("voting_period"), &604800u64); // 7 days default
        env.storage().instance().set(&Symbol::short("emergency_voting_period"), &86400u64); // 24 hours for emergency
        env.storage().instance().set(&Symbol::short("min_stake_amount"), &1000i128); // Minimum stake to vote
        
        // Initialize stakeholders list
        env.storage().instance().set(&Symbol::short("stakeholders"), &Vec::new(env));
        
        // Initialize active proposals
        env.storage().instance().set(&Symbol::short("active_proposals"), &Vec::new(env));
    }
    
    // ========== STAKEHOLDER MANAGEMENT ==========
    
    pub fn register_stakeholder(
        env: &Env,
        stakeholder: Address,
        stake_amount: i128,
        caller: Address,
    ) -> Result<(), UpgradeError> {
        // Only upgrade admin can register stakeholders
        if env.storage().instance().get(&UPGRADE_ADMIN) != Some(caller) {
            return Err(UpgradeError::Unauthorized);
        }
        
        if stake_amount < env.storage().instance().get(&Symbol::short("min_stake_amount")).unwrap_or(1000i128) {
            return Err(UpgradeError::InsufficientStake);
        }
        
        let current_time = env.ledger().timestamp();
        
        let stakeholder_info = Stakeholder {
            address: stakeholder.clone(),
            stake_amount,
            voting_power: Self::calculate_voting_power(stake_amount),
            reputation: 0,
            joined: current_time,
            last_activity: current_time,
            is_active: true,
        };
        
        // Store stakeholder
        env.storage().instance().set(
            &Symbol::new(&env, &format!("stakeholder_{}", stakeholder)),
            &stakeholder_info
        );
        
        // Add to stakeholders list
        let mut stakeholders: Vec<Address> = env.storage().instance()
            .get(&Symbol::short("stakeholders"))
            .unwrap_or(Vec::new(env));
        stakeholders.push_back(stakeholder.clone());
        env.storage().instance().set(&Symbol::short("stakeholders"), &stakeholders);
        
        Ok(())
    }
    
    pub fn update_stake(
        env: &Env,
        stakeholder: Address,
        new_amount: i128,
        caller: Address,
    ) -> Result<(), UpgradeError> {
        if caller != stakeholder {
            return Err(UpgradeError::Unauthorized);
        }
        
        let stakeholder_key = Symbol::new(&env, &format!("stakeholder_{}", stakeholder));
        let mut stakeholder_info: Stakeholder = env.storage().instance()
            .get(&stakeholder_key)
            .ok_or(UpgradeError::StakeholderNotFound)?;
        
        if !stakeholder_info.is_active {
            return Err(UpgradeError::StakeholderNotActive);
        }
        
        stakeholder_info.stake_amount = new_amount;
        stakeholder_info.voting_power = Self::calculate_voting_power(new_amount);
        stakeholder_info.last_activity = env.ledger().timestamp();
        
        env.storage().instance().set(&stakeholder_key, &stakeholder_info);
        
        Ok(())
    }
    
    // ========== UPGRADE PROPOSALS ==========
    
    pub fn create_proposal(
        env: &Env,
        title: String,
        description: String,
        upgrade_type: UpgradeType,
        risk_level: RiskLevel,
        new_contract_hash: BytesN<32>,
        implementation_plan: String,
        rollback_plan: String,
        test_results: String,
        emergency: bool,
        caller: Address,
    ) -> Result<u64, UpgradeError> {
        // Check if caller is a registered stakeholder
        let stakeholder_key = Symbol::new(&env, &format!("stakeholder_{}", caller));
        let stakeholder_info: Stakeholder = env.storage().instance()
            .get(&stakeholder_key)
            .ok_or(UpgradeError::StakeholderNotFound)?;
        
        if !stakeholder_info.is_active {
            return Err(UpgradeError::StakeholderNotActive);
        }
        
        // High and Critical risk upgrades require risk assessment
        if risk_level == RiskLevel::High || risk_level == RiskLevel::Critical {
            return Err(UpgradeError::RiskAssessmentRequired);
        }
        
        let next_id = Self::get_next_proposal_id(env);
        let current_time = env.ledger().timestamp();
        
        let voting_period = if emergency {
            env.storage().instance().get(&Symbol::short("emergency_voting_period")).unwrap_or(86400u64)
        } else {
            env.storage().instance().get(&Symbol::short("voting_period")).unwrap_or(604800u64)
        };
        
        let required_approval = match risk_level {
            RiskLevel::Low => 51,
            RiskLevel::Medium => 66,
            RiskLevel::High => 75,
            RiskLevel::Critical => 90,
        };
        
        let proposal = UpgradeProposal {
            id: next_id,
            title: title.clone(),
            description,
            upgrade_type,
            risk_level,
            proposed_by: caller.clone(),
            new_contract_hash,
            implementation_plan,
            rollback_plan,
            test_results,
            voting_deadline: current_time + voting_period,
            execution_deadline: current_time + voting_period + 86400, // 1 day after voting
            status: if emergency { UpgradeStatus::Emergency } else { UpgradeStatus::Proposed },
            votes_for: 0,
            votes_against: 0,
            total_stake_weight: 0,
            required_approval_percentage: required_approval,
            created: current_time,
            last_updated: current_time,
            emergency,
        };
        
        // Store proposal
        env.storage().instance().set(
            &Symbol::new(&env, &format!("proposal_{}", next_id)),
            &proposal
        );
        
        // Add to active proposals
        let mut active_proposals: Vec<u64> = env.storage().instance()
            .get(&Symbol::short("active_proposals"))
            .unwrap_or(Vec::new(env));
        active_proposals.push_back(next_id);
        env.storage().instance().set(&Symbol::short("active_proposals"), &active_proposals);
        
        // Send notification to all stakeholders
        Self::send_notification(
            env,
            next_id,
            &format!("New Upgrade Proposal: {}", title),
            &format!("Proposal {} has been submitted for voting", next_id),
            caller.clone(),
        );
        
        Ok(next_id)
    }
    
    pub fn submit_risk_assessment(
        env: &Env,
        proposal_id: u64,
        assessment: RiskAssessment,
        caller: Address,
    ) -> Result<(), UpgradeError> {
        // Only upgrade admin can submit risk assessments
        if env.storage().instance().get(&UPGRADE_ADMIN) != Some(caller) {
            return Err(UpgradeError::Unauthorized);
        }
        
        let proposal_key = Symbol::new(&env, &format!("proposal_{}", proposal_id));
        let mut proposal: UpgradeProposal = env.storage().instance()
            .get(&proposal_key)
            .ok_or(UpgradeError::InvalidProposalId)?;
        
        if proposal.status != UpgradeStatus::Proposed {
            return Err(UpgradeError::ProposalNotActive);
        }
        
        // Store risk assessment
        env.storage().instance().set(
            &Symbol::new(&env, &format!("risk_assessment_{}", proposal_id)),
            &assessment
        );
        
        // Update proposal status to voting
        proposal.status = UpgradeStatus::Voting;
        proposal.last_updated = env.ledger().timestamp();
        env.storage().instance().set(&proposal_key, &proposal);
        
        Ok(())
    }
    
    // ========== VOTING SYSTEM ==========
    
    pub fn vote(
        env: &Env,
        proposal_id: u64,
        support: bool,
        reason: String,
        caller: Address,
    ) -> Result<(), UpgradeError> {
        // Check if caller is a registered stakeholder
        let stakeholder_key = Symbol::new(&env, &format!("stakeholder_{}", caller));
        let stakeholder_info: Stakeholder = env.storage().instance()
            .get(&stakeholder_key)
            .ok_or(UpgradeError::StakeholderNotFound)?;
        
        if !stakeholder_info.is_active {
            return Err(UpgradeError::StakeholderNotActive);
        }
        
        let proposal_key = Symbol::new(&env, &format!("proposal_{}", proposal_id));
        let mut proposal: UpgradeProposal = env.storage().instance()
            .get(&proposal_key)
            .ok_or(UpgradeError::InvalidProposalId)?;
        
        if proposal.status != UpgradeStatus::Voting && proposal.status != UpgradeStatus::Emergency {
            return Err(UpgradeError::ProposalNotActive);
        }
        
        if env.ledger().timestamp() > proposal.voting_deadline {
            return Err(UpgradeError::VotingEnded);
        }
        
        // Check if already voted
        let vote_key = Symbol::new(&env, &format!("vote_{}_{}", proposal_id, caller));
        if env.storage().instance().has(&vote_key) {
            return Err(UpgradeError::AlreadyVoted);
        }
        
        let current_time = env.ledger().timestamp();
        
        // Create vote
        let vote = Vote {
            voter: caller.clone(),
            proposal_id,
            support,
            stake_weight: stakeholder_info.stake_amount,
            reason,
            timestamp: current_time,
        };
        
        // Store vote
        env.storage().instance().set(&vote_key, &vote);
        
        // Update proposal vote counts
        if support {
            proposal.votes_for += 1;
        } else {
            proposal.votes_against += 1;
        }
        proposal.total_stake_weight += stakeholder_info.stake_amount;
        proposal.last_updated = current_time;
        
        // Check if voting should end early (unanimous or overwhelming support)
        let total_votes = proposal.votes_for + proposal.votes_against;
        if total_votes > 0 {
            let approval_percentage = (proposal.votes_for * 100) / total_votes;
            if approval_percentage >= 95 && total_votes >= 3 {
                // Early approval with overwhelming support
                proposal.status = UpgradeStatus::Approved;
            }
        }
        
        env.storage().instance().set(&proposal_key, &proposal);
        
        // Update stakeholder activity
        let mut updated_stakeholder = stakeholder_info;
        updated_stakeholder.last_activity = current_time;
        env.storage().instance().set(&stakeholder_key, &updated_stakeholder);
        
        Ok(())
    }
    
    pub fn execute_upgrade(
        env: &Env,
        proposal_id: u64,
        caller: Address,
    ) -> Result<(), UpgradeError> {
        // Only upgrade admin can execute upgrades
        if env.storage().instance().get(&UPGRADE_ADMIN) != Some(caller) {
            return Err(UpgradeError::Unauthorized);
        }
        
        let proposal_key = Symbol::new(&env, &format!("proposal_{}", proposal_id));
        let proposal: UpgradeProposal = env.storage().instance()
            .get(&proposal_key)
            .ok_or(UpgradeError::InvalidProposalId)?;
        
        if proposal.status != UpgradeStatus::Approved {
            return Err(UpgradeError::InsufficientApproval);
        }
        
        if env.ledger().timestamp() > proposal.execution_deadline {
            return Err(UpgradeError::DeadlineExpired);
        }
        
        // In a real implementation, this would deploy the new contract
        // For now, we'll simulate the upgrade execution
        
        let current_time = env.ledger().timestamp();
        
        // Create execution record
        let execution = UpgradeExecution {
            proposal_id,
            old_contract_hash: BytesN::from_array(&env, &[0; 32]), // Current contract hash
            new_contract_hash: proposal.new_contract_hash,
            executed_by: caller.clone(),
            execution_timestamp: current_time,
            success: true,
            gas_used: 0, // Would be actual gas used
            rollback_available: true,
            rollback_deadline: current_time + 604800, // 7 days rollback window
        };
        
        // Store execution record
        env.storage().instance().set(
            &Symbol::new(&env, &format!("execution_{}", proposal_id)),
            &execution
        );
        
        // Update proposal status
        let mut updated_proposal = proposal;
        updated_proposal.status = UpgradeStatus::Executed;
        updated_proposal.last_updated = current_time;
        env.storage().instance().set(&proposal_key, &updated_proposal);
        
        // Remove from active proposals
        let mut active_proposals: Vec<u64> = env.storage().instance()
            .get(&Symbol::short("active_proposals"))
            .unwrap_or(Vec::new(env));
        active_proposals.remove(active_proposals.iter().position(|&id| id == proposal_id).unwrap());
        env.storage().instance().set(&Symbol::short("active_proposals"), &active_proposals);
        
        // Send notification
        Self::send_notification(
            env,
            proposal_id,
            "Upgrade Executed Successfully",
            &format!("Proposal {} has been executed", proposal_id),
            caller,
        );
        
        Ok(())
    }
    
    pub fn emergency_upgrade(
        env: &Env,
        title: String,
        description: String,
        new_contract_hash: BytesN<32>,
        implementation_plan: String,
        caller: Address,
    ) -> Result<u64, UpgradeError> {
        // Only upgrade admin can initiate emergency upgrades
        if env.storage().instance().get(&UPGRADE_ADMIN) != Some(caller) {
            return Err(UpgradeError::Unauthorized);
        }
        
        let current_time = env.ledger().timestamp();
        
        // Create emergency proposal
        let proposal_id = Self::create_proposal(
            env,
            title,
            description,
            UpgradeType::Emergency,
            RiskLevel::Critical,
            new_contract_hash,
            implementation_plan,
            "Emergency rollback available".to_string(),
            "Emergency bypass".to_string(),
            true,
            caller,
        )?;
        
        // Auto-approve emergency upgrade
        let proposal_key = Symbol::new(&env, &format!("proposal_{}", proposal_id));
        let mut proposal: UpgradeProposal = env.storage().instance()
            .get(&proposal_key)
            .unwrap();
        proposal.status = UpgradeStatus::Approved;
        env.storage().instance().set(&proposal_key, &proposal);
        
        // Execute immediately
        Self::execute_upgrade(env, proposal_id, caller)?;
        
        Ok(proposal_id)
    }
    
    // ========== COMMUNICATION SYSTEM ==========
    
    pub fn send_communication(
        env: &Env,
        proposal_id: u64,
        message_type: Symbol,
        subject: String,
        content: String,
        recipients: Vec<Address>,
        caller: Address,
    ) -> Result<u64, UpgradeError> {
        // Only upgrade admin or proposal creator can send communications
        let proposal_key = Symbol::new(&env, &format!("proposal_{}", proposal_id));
        let proposal: UpgradeProposal = env.storage().instance()
            .get(&proposal_key)
            .ok_or(UpgradeError::InvalidProposalId)?;
        
        let is_admin = env.storage().instance().get(&UPGRADE_ADMIN) == Some(caller);
        let is_creator = proposal.proposed_by == caller;
        
        if !is_admin && !is_creator {
            return Err(UpgradeError::Unauthorized);
        }
        
        let next_id = Self::get_next_comm_id(env);
        let current_time = env.ledger().timestamp();
        
        let communication = CommunicationLog {
            id: next_id,
            proposal_id,
            sender: caller.clone(),
            message_type,
            subject: subject.clone(),
            content,
            recipients: recipients.clone(),
            timestamp: current_time,
            read_receipts: Vec::new(env),
        };
        
        // Store communication
        env.storage().instance().set(
            &Symbol::new(&env, &format!("comm_{}", next_id)),
            &communication
        );
        
        // Add to proposal communications
        let mut comm_list: Vec<u64> = env.storage().instance()
            .get(&Symbol::new(&env, &format!("comm_list_{}", proposal_id)))
            .unwrap_or(Vec::new(env));
        comm_list.push_back(next_id);
        env.storage().instance().set(&Symbol::new(&env, &format!("comm_list_{}", proposal_id)), &comm_list);
        
        Ok(next_id)
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    pub fn get_proposal(env: &Env, proposal_id: u64) -> Result<UpgradeProposal, UpgradeError> {
        env.storage().instance()
            .get(&Symbol::new(&env, &format!("proposal_{}", proposal_id)))
            .ok_or(UpgradeError::InvalidProposalId)
    }
    
    pub fn get_active_proposals(env: &Env) -> Vec<UpgradeProposal> {
        let active_ids: Vec<u64> = env.storage().instance()
            .get(&Symbol::short("active_proposals"))
            .unwrap_or(Vec::new(env));
        
        let mut proposals = Vec::new(env);
        for id in active_ids.iter() {
            if let Some(proposal) = env.storage().instance().get::<_, UpgradeProposal>(&Symbol::new(&env, &format!("proposal_{}", id))) {
                proposals.push_back(proposal);
            }
        }
        proposals
    }
    
    pub fn get_stakeholder(env: &Env, address: Address) -> Result<Stakeholder, UpgradeError> {
        env.storage().instance()
            .get(&Symbol::new(&env, &format!("stakeholder_{}", address)))
            .ok_or(UpgradeError::StakeholderNotFound)
    }
    
    pub fn get_all_stakeholders(env: &Env) -> Vec<Stakeholder> {
        let stakeholder_addresses: Vec<Address> = env.storage().instance()
            .get(&Symbol::short("stakeholders"))
            .unwrap_or(Vec::new(env));
        
        let mut stakeholders = Vec::new(env);
        for address in stakeholder_addresses.iter() {
            if let Some(stakeholder) = env.storage().instance().get::<_, Stakeholder>(&Symbol::new(&env, &format!("stakeholder_{}", address))) {
                stakeholders.push_back(stakeholder);
            }
        }
        stakeholders
    }
    
    pub fn get_votes(env: &Env, proposal_id: u64) -> Vec<Vote> {
        let stakeholders: Vec<Address> = env.storage().instance()
            .get(&Symbol::short("stakeholders"))
            .unwrap_or(Vec::new(env));
        
        let mut votes = Vec::new(env);
        for address in stakeholders.iter() {
            let vote_key = Symbol::new(&env, &format!("vote_{}_{}", proposal_id, address));
            if let Some(vote) = env.storage().instance().get::<_, Vote>(&vote_key) {
                votes.push_back(vote);
            }
        }
        votes
    }
    
    pub fn get_risk_assessment(env: &Env, proposal_id: u64) -> Result<RiskAssessment, UpgradeError> {
        env.storage().instance()
            .get(&Symbol::new(&env, &format!("risk_assessment_{}", proposal_id)))
            .ok_or(UpgradeError::RiskAssessmentRequired)
    }
    
    pub fn get_communications(env: &Env, proposal_id: u64) -> Vec<CommunicationLog> {
        let comm_ids: Vec<u64> = env.storage().instance()
            .get(&Symbol::new(&env, &format!("comm_list_{}", proposal_id)))
            .unwrap_or(Vec::new(env));
        
        let mut communications = Vec::new(env);
        for id in comm_ids.iter() {
            if let Some(comm) = env.storage().instance().get::<_, CommunicationLog>(&Symbol::new(&env, &format!("comm_{}", id))) {
                communications.push_back(comm);
            }
        }
        communications
    }
    
    pub fn get_execution_record(env: &Env, proposal_id: u64) -> Result<UpgradeExecution, UpgradeError> {
        env.storage().instance()
            .get(&Symbol::new(&env, &format!("execution_{}", proposal_id)))
            .ok_or(UpgradeError::UpgradeAlreadyExecuted)
    }
    
    // ========== HELPER FUNCTIONS ==========
    
    fn calculate_voting_power(stake_amount: i128) -> u32 {
        // Base voting power is 1, increases with stake
        if stake_amount < 1000 { 1 }
        else if stake_amount < 5000 { 2 }
        else if stake_amount < 10000 { 3 }
        else if stake_amount < 50000 { 5 }
        else { 10 }
    }
    
    fn get_next_proposal_id(env: &Env) -> u64 {
        let key = Symbol::short("next_proposal_id");
        let next_id = env.storage().instance().get(&key).unwrap_or(1u64);
        env.storage().instance().set(&key, &(next_id + 1));
        next_id
    }
    
    fn get_next_comm_id(env: &Env) -> u64 {
        let key = Symbol::short("next_comm_id");
        let next_id = env.storage().instance().get(&key).unwrap_or(1u64);
        env.storage().instance().set(&key, &(next_id + 1));
        next_id
    }
    
    fn send_notification(env: &Env, proposal_id: u64, subject: &str, content: &str, sender: Address) {
        // In a real implementation, this would send notifications via email, push, etc.
        // For now, we'll just log it
        let stakeholders: Vec<Address> = env.storage().instance()
            .get(&Symbol::short("stakeholders"))
            .unwrap_or(Vec::new(env));
        
        let notification = CommunicationLog {
            id: Self::get_next_comm_id(env),
            proposal_id,
            sender: sender.clone(),
            message_type: Symbol::short("ANNOUNCEMENT"),
            subject: subject.to_string(),
            content: content.to_string(),
            recipients: stakeholders,
            timestamp: env.ledger().timestamp(),
            read_receipts: Vec::new(env),
        };
        
        env.storage().instance().set(
            &Symbol::new(&env, &format!("notification_{}", proposal_id)),
            &notification
        );
    }
}
