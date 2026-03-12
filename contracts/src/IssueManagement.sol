// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title Issue Management - Healthcare Drips Contributor System
 * @dev Enables issue creation, application, and acceptance for medical funding
 */
contract IssueManagement is AccessControl, ReentrancyGuard {
    using Counters for Counters.Counter;
    
    // ========== ROLES ==========
    bytes32 public constant ISSUE_CREATOR = keccak256("ISSUE_CREATOR");
    bytes32 public constant CONTRIBUTOR = keccak256("CONTRIBUTOR");
    bytes32 public constant REVIEWER = keccak256("REVIEWER");
    bytes32 public constant APPROVER = keccak256("APPROVER");
    
    // ========== STRUCTS ==========
    
    enum IssueType {
        EMERGENCY_TREATMENT,
        SURGERY,
        PREVENTIVE_CARE,
        CHRONIC_CONDITION,
        MENTAL_HEALTH,
        REHABILITATION,
        MEDICAL_EQUIPMENT,
        RESEARCH_FUNDING
    }
    
    enum IssueStatus {
        DRAFT,
        SUBMITTED,
        UNDER_REVIEW,
        PENDING_APPROVAL,
        APPROVED,
        REJECTED,
        COMPLETED,
        CANCELLED
    }
    
    enum ContributorLevel {
        JUNIOR,      // 1-5 contributions
        INTERMEDIATE, // 6-15 contributions
        SENIOR,       // 16-30 contributions
        EXPERT,       // 31-50 contributions
        MASTER         // 51+ contributions
    }
    
    struct Issue {
        uint256 id;
        address creator;
        address patient;
        IssueType issueType;
        string title;
        string description;
        uint256 fundingAmount;
        string medicalRecord; // IPFS hash
        uint256 deadline;
        IssueStatus status;
        address[] applicants;
        mapping(address => bool) hasApplied;
        mapping(address => string) applications;
        uint256 totalApplications;
        uint256 requiredApprovals;
        uint256 currentApprovals;
        uint256 created;
        uint256 lastUpdated;
    }
    
    struct Application {
        address contributor;
        string statement;
        uint256 reputation;
        uint256 contributionAmount;
        uint256 applied;
        bool approved;
        uint256 reviewed;
    }
    
    struct ContributorStats {
        address contributor;
        uint256 totalIssuesReviewed;
        uint256 totalIssuesApproved;
        uint256 totalContributed;
        ContributorLevel level;
        uint256 reputation;
        uint256 joined;
    }
    
    // ========== STORAGE ==========
    
    mapping(uint256 => Issue) public issues;
    mapping(address => ContributorStats) public contributorStats;
    mapping(address => uint256) public issueReputation;
    uint256 public nextIssueId;
    uint256[] public activeIssues;
    address[] public verifiedContributors;
    
    // ========== EVENTS ==========
    
    event IssueCreated(uint256 indexed id, address indexed creator, address indexed patient, IssueType issueType, uint256 amount);
    event IssueSubmitted(uint256 indexed id, address indexed contributor, string statement);
    event IssueReviewed(uint256 indexed id, address indexed reviewer, bool approved, string reason);
    event IssueApproved(uint256 indexed id, uint256 approvals);
    event IssueRejected(uint256 indexed id, string reason);
    event IssueCompleted(uint256 indexed id, uint256 totalFunded);
    event ContributorVerified(address indexed contributor, ContributorLevel level);
    event ReputationUpdated(address indexed contributor, uint256 newReputation);
    
    // ========== MODIFIERS ==========
    
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "IssueManagement: INSUFFICIENT_PERMISSIONS");
        _;
    }
    
    modifier validIssue(uint256 _issueId) {
        require(_issueId > 0 && _issueId <= nextIssueId, "IssueManagement: INVALID_ISSUE_ID");
        _;
    }
    
    modifier onlyCreator(uint256 _issueId) {
        require(issues[_issueId].creator == msg.sender, "IssueManagement: NOT_CREATOR");
        _;
    }
    
    modifier onlyVerifiedContributor() {
        require(contributorStats[msg.sender].contributor != address(0), "IssueManagement: NOT_VERIFIED_CONTRIBUTOR");
        _;
    }
    
    modifier issueActive(uint256 _issueId) {
        require(issues[_issueId].status == IssueStatus.SUBMITTED, "IssueManagement: ISSUE_NOT_ACTIVE");
        _;
    }
    
    // ========== CONSTRUCTOR ==========
    
    constructor() {
        _grantRole(msg.sender, DEFAULT_ADMIN_ROLE);
        nextIssueId = 1;
    }
    
    // ========== ISSUE CREATION ==========
    
    /**
     * @dev Create a new medical funding issue
     */
    function createIssue(
        address _patient,
        IssueType _issueType,
        string memory _title,
        string memory _description,
        uint256 _fundingAmount,
        string memory _medicalRecord,
        uint256 _deadline,
        uint256 _requiredApprovals
    ) external onlyRole(ISSUE_CREATOR) returns (uint256) {
        require(_fundingAmount > 0, "IssueManagement: INVALID_AMOUNT");
        require(_deadline > block.timestamp, "IssueManagement: INVALID_DEADLINE");
        require(_requiredApprovals >= 2, "IssueManagement: INSUFFICIENT_APPROVERS");
        
        uint256 issueId = nextIssueId++;
        
        issues[issueId] = Issue({
            id: issueId,
            creator: msg.sender,
            patient: _patient,
            issueType: _issueType,
            title: _title,
            description: _description,
            fundingAmount: _fundingAmount,
            medicalRecord: _medicalRecord,
            deadline: _deadline,
            status: IssueStatus.DRAFT,
            applicants: new address[](0),
            totalApplications: 0,
            requiredApprovals: _requiredApprovals,
            currentApprovals: 0,
            created: block.timestamp,
            lastUpdated: block.timestamp
        });
        
        activeIssues.push(issueId);
        
        emit IssueCreated(issueId, msg.sender, _patient, _issueType, _fundingAmount);
        
        return issueId;
    }
    
    /**
     * @dev Submit issue for community review
     */
    function submitIssue(uint256 _issueId) external {
        Issue storage issue = issues[_issueId];
        require(issue.status == IssueStatus.DRAFT, "IssueManagement: ISSUE_NOT_DRAFT");
        require(issue.creator == msg.sender || issue.patient == msg.sender, "IssueManagement: NOT_AUTHORIZED");
        
        issue.status = IssueStatus.SUBMITTED;
        issue.lastUpdated = block.timestamp;
        
        activeIssues.push(issueId);
    }
    
    /**
     * @dev Apply to contribute to an issue
     */
    function applyToIssue(uint256 _issueId, string memory _statement) external onlyVerifiedContributor {
        Issue storage issue = issues[_issueId];
        require(issue.status == IssueStatus.SUBMITTED, "IssueManagement: ISSUE_NOT_SUBMITTED");
        require(block.timestamp < issue.deadline, "IssueManagement: DEADLINE_EXPIRED");
        require(!issue.hasApplied[msg.sender], "IssueManagement: ALREADY_APPLIED");
        
        issue.hasApplied[msg.sender] = true;
        issue.applications[msg.sender] = _statement;
        issue.totalApplications++;
        
        // Update contributor stats
        ContributorStats storage stats = contributorStats[msg.sender];
        if (stats.contributor == address(0)) {
            stats.contributor = msg.sender;
            stats.totalIssuesReviewed = 0;
            stats.totalIssuesApproved = 0;
            stats.totalContributed = 0;
            stats.level = ContributorLevel.JUNIOR;
            stats.reputation = 0;
            stats.joined = block.timestamp;
            verifiedContributors.push(msg.sender);
        }
        
        emit IssueSubmitted(_issueId, msg.sender, _statement);
    }
    
    /**
     * @dev Review an issue application
     */
    function reviewApplication(
        uint256 _issueId,
        address _contributor,
        bool _approved,
        string memory _reason
    ) external onlyRole(REVIEWER) {
        Issue storage issue = issues[_issueId];
        require(issue.status == IssueStatus.SUBMITTED, "IssueManagement: ISSUE_NOT_SUBMITTED");
        require(issue.hasApplied[_contributor], "IssueManagement: CONTRIBUTOR_NOT_APPLIED");
        
        // Update application
        issue.applications[_contributor] = _reason;
        
        // Update contributor reputation
        ContributorStats storage stats = contributorStats[_contributor];
        stats.totalIssuesReviewed++;
        
        if (_approved) {
            stats.totalIssuesApproved++;
            stats.reputation += 5; // Base reward for review
            issue.currentApprovals++;
        }
        
        // Update issue reputation
        issueReputation[_contributor] += _approved ? 10 : 2;
        
        emit IssueReviewed(_issueId, _contributor, _approved, _reason);
        
        // Check if issue should be approved
        if (issue.currentApprovals >= issue.requiredApprovals) {
            _approveIssue(_issueId);
        }
    }
    
    /**
     * @dev Approve an issue (for authorized approvers)
     */
    function approveIssue(uint256 _issueId) external onlyRole(APPROVER) {
        Issue storage issue = issues[_issueId];
        require(issue.status == IssueStatus.SUBMITTED, "IssueManagement: ISSUE_NOT_SUBMITTED");
        
        _approveIssue(_issueId);
    }
    
    /**
     * @dev Internal function to approve issue
     */
    function _approveIssue(uint256 _issueId) internal {
        Issue storage issue = issues[_issueId];
        issue.status = IssueStatus.APPROVED;
        issue.lastUpdated = block.timestamp;
        
        emit IssueApproved(_issueId, issue.currentApprovals);
    }
    
    /**
     * @dev Reject an issue
     */
    function rejectIssue(uint256 _issueId, string memory _reason) external onlyRole(APPROVER) {
        Issue storage issue = issues[_issueId];
        require(issue.status == IssueStatus.SUBMITTED, "IssueManagement: ISSUE_NOT_SUBMITTED");
        
        issue.status = IssueStatus.REJECTED;
        issue.lastUpdated = block.timestamp;
        
        emit IssueRejected(_issueId, _reason);
    }
    
    /**
     * @dev Complete an issue and distribute funds
     */
    function completeIssue(uint256 _issueId) external onlyRole(APPROVER) nonReentrant {
        Issue storage issue = issues[_issueId];
        require(issue.status == IssueStatus.APPROVED, "IssueManagement: ISSUE_NOT_APPROVED");
        
        issue.status = IssueStatus.COMPLETED;
        issue.lastUpdated = block.timestamp;
        
        // Update contributor stats
        for (uint i = 0; i < issue.applicants.length; i++) {
            address contributor = issue.applicants[i];
            if (issue.applications[contributor].length > 0) {
                ContributorStats storage stats = contributorStats[contributor];
                stats.totalContributed += issue.fundingAmount / issue.applicants.length;
                stats.reputation += 20; // Reward for contribution
                
                emit ReputationUpdated(contributor, stats.reputation);
            }
        }
        
        emit IssueCompleted(_issueId, issue.fundingAmount);
    }
    
    /**
     * @dev Verify a contributor and assign level
     */
    function verifyContributor(address _contributor, ContributorLevel _level) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(contributorStats[_contributor].contributor != address(0), "IssueManagement: CONTRIBUTOR_NOT_FOUND");
        
        contributorStats[_contributor].level = _level;
        contributorStats[_contributor].reputation += _level == ContributorLevel.EXPERT ? 100 : 50;
        
        emit ContributorVerified(_contributor, _level);
    }
    
    // ========== VIEW FUNCTIONS ==========
    
    /**
     * @dev Get issue details
     */
    function getIssue(uint256 _issueId) external view returns (Issue memory) {
        return issues[_issueId];
    }
    
    /**
     * @dev Get active issues
     */
    function getActiveIssues() external view returns (uint256[] memory) {
        return activeIssues;
    }
    
    /**
     * @dev Get issues by patient
     */
    function getPatientIssues(address _patient) external view returns (uint256[] memory) {
        uint256[] memory patientIssues = new uint256[](100);
        uint256 count = 0;
        
        for (uint i = 1; i < nextIssueId; i++) {
            if (issues[i].patient == _patient) {
                patientIssues[count] = i;
                count++;
            }
        }
        
        // Resize array
        assembly {
            mstore(patientIssues, count)
        }
        
        return patientIssues;
    }
    
    /**
     * @dev Get contributor stats
     */
    function getContributorStats(address _contributor) external view returns (ContributorStats memory) {
        return contributorStats[_contributor];
    }
    
    /**
     * @dev Get verified contributors
     */
    function getVerifiedContributors() external view returns (address[] memory) {
        return verifiedContributors;
    }
    
    /**
     * @dev Get contributor reputation
     */
    function getContributorReputation(address _contributor) external view returns (uint256) {
        return issueReputation[_contributor];
    }
    
    /**
     * @dev Check if contributor is verified
     */
    function isContributorVerified(address _contributor) external view returns (bool) {
        return contributorStats[_contributor].contributor != address(0);
    }
    
    /**
     * @dev Get issue applications
     */
    function getIssueApplications(uint256 _issueId) external view returns (address[] memory) {
        return issues[_issueId].applicants;
    }
    
    /**
     * @dev Get application details
     */
    function getApplication(uint256 _issueId, address _contributor) external view returns (string memory) {
        return issues[_issueId].applications[_contributor];
    }
    
    /**
     * @dev Get issues by type
     */
    function getIssuesByType(IssueType _issueType) external view returns (uint256[] memory) {
        uint256[] memory typeIssues = new uint256[](100);
        uint256 count = 0;
        
        for (uint i = 1; i < nextIssueId; i++) {
            if (issues[i].issueType == _issueType) {
                typeIssues[count] = i;
                count++;
            }
        }
        
        // Resize array
        assembly {
            mstore(typeIssues, count)
        }
        
        return typeIssues;
    }
    
    /**
     * @dev Get issues requiring approval
     */
    function getPendingIssues() external view returns (uint256[] memory) {
        uint256[] memory pendingIssues = new uint256[](100);
        uint256 count = 0;
        
        for (uint i = 1; i < nextIssueId; i++) {
            if (issues[i].status == IssueStatus.SUBMITTED) {
                pendingIssues[count] = i;
                count++;
            }
        }
        
        // Resize array
        assembly {
            mstore(pendingIssues, count)
        }
        
        return pendingIssues;
    }
}
