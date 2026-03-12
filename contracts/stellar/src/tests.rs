#[cfg(test)]
mod tests {
    use soroban_sdk::{
        contract, contractimpl, contracttype, Address, Env, Symbol, testutils, Vec, String,
    };

    use crate::healthcare_drips::{
        HealthcareDrips, HealthcareDripsError, ContributorLevel, IssueType, IssueStatus,
    };

    #[contract]
    struct TestContract;

    #[contractimpl]
    impl TestContract {
        pub fn test_token(env: &Env, admin: Address) {
            // Mock token for testing
        }
    }

    fn setup_contract() -> (Env, Address, Address, Address, Address, Address) {
        let env = Env::default();
        let admin = Address::random(&env);
        let patient = Address::random(&env);
        let insurer = Address::random(&env);
        let reviewer = Address::random(&env);
        let contributor = Address::random(&env);

        env.mock_all_auths();
        HealthcareDrips::initialize(&env, admin.clone());

        (env, admin, patient, insurer, reviewer, contributor)
    }

    #[test]
    fn test_initialization() {
        let (env, admin, _, _, _, _) = setup_contract();

        // Verify roles are set
        assert_eq!(
            env.storage().instance().get(&Symbol::short("IC")),
            Some(admin)
        );
        assert_eq!(
            env.storage().instance().get(&Symbol::short("RV")),
            Some(admin)
        );
        assert_eq!(
            env.storage().instance().get(&Symbol::short("AP")),
            Some(admin)
        );
    }

    #[test]
    fn test_create_premium_drip() {
        let (env, admin, patient, insurer, _, _) = setup_contract();
        let token = Address::random(&env);

        let result = HealthcareDrips::create_premium_drip(
            &env,
            patient.clone(),
            insurer.clone(),
            token,
            1000i128, // Premium amount
            86400u64,  // 1 day interval
        );

        assert_eq!(result, Ok(1));

        let drip = HealthcareDrips::get_premium_drip(&env, 1).unwrap();
        assert_eq!(drip.id, 1);
        assert_eq!(drip.patient, patient);
        assert_eq!(drip.insurer, insurer);
        assert_eq!(drip.premium_amount, 1000i128);
        assert_eq!(drip.interval, 86400u64);
        assert!(drip.active);
    }

    #[test]
    fn test_create_premium_drip_invalid_amount() {
        let (env, _, patient, insurer, _, _) = setup_contract();
        let token = Address::random(&env);

        let result = HealthcareDrips::create_premium_drip(
            &env,
            patient,
            insurer,
            token,
            0i128, // Invalid amount
            86400u64,
        );

        assert_eq!(result, Err(HealthcareDripsError::InvalidAmount));
    }

    #[test]
    fn test_process_premium_payment() {
        let (env, _, patient, insurer, _, _) = setup_contract();
        let token = Address::random(&env);

        // Create drip
        let drip_id = HealthcareDrips::create_premium_drip(
            &env,
            patient,
            insurer,
            token,
            1000i128,
            86400u64,
        ).unwrap();

        // Mock time passing
        env.ledger().set_timestamp(env.ledger().timestamp() + 86400u64 + 1);

        let result = HealthcareDrips::process_premium_payment(&env, drip_id);
        assert_eq!(result, Ok(()));

        let drip = HealthcareDrips::get_premium_drip(&env, drip_id).unwrap();
        assert_eq!(drip.total_paid, 1000i128);
    }

    #[test]
    fn test_create_issue() {
        let (env, admin, patient, _, _, _) = setup_contract();

        let result = HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::Surgery,
            String::from_str(&env, "Emergency Surgery"),
            String::from_str(&env, "Patient needs immediate surgery"),
            10000i128, // Funding amount
            String::from_str(&env, "QmHash123"),
            env.ledger().timestamp() + 86400 * 30, // 30 days deadline
            3u32, // Required approvals
            admin.clone(),
        );

        assert_eq!(result, Ok(1));

        let issue = HealthcareDrips::get_issue(&env, 1).unwrap();
        assert_eq!(issue.id, 1);
        assert_eq!(issue.creator, admin);
        assert_eq!(issue.patient, patient);
        assert_eq!(issue.issue_type, IssueType::Surgery);
        assert_eq!(issue.status, IssueStatus::Draft);
        assert_eq!(issue.required_approvals, 3u32);
    }

    #[test]
    fn test_create_issue_unauthorized() {
        let (env, _, patient, _, _, contributor) = setup_contract();

        let result = HealthcareDrips::create_issue(
            &env,
            patient,
            IssueType::Surgery,
            String::from_str(&env, "Emergency Surgery"),
            String::from_str(&env, "Patient needs immediate surgery"),
            10000i128,
            String::from_str(&env, "QmHash123"),
            env.ledger().timestamp() + 86400 * 30,
            3u32,
            contributor, // Not authorized
        );

        assert_eq!(result, Err(HealthcareDripsError::Unauthorized));
    }

    #[test]
    fn test_submit_issue() {
        let (env, admin, patient, _, _, _) = setup_contract();

        // Create issue
        let issue_id = HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::Surgery,
            String::from_str(&env, "Emergency Surgery"),
            String::from_str(&env, "Patient needs immediate surgery"),
            10000i128,
            String::from_str(&env, "QmHash123"),
            env.ledger().timestamp() + 86400 * 30,
            3u32,
            admin.clone(),
        ).unwrap();

        // Submit issue
        let result = HealthcareDrips::submit_issue(&env, issue_id, patient);
        assert_eq!(result, Ok(()));

        let issue = HealthcareDrips::get_issue(&env, issue_id).unwrap();
        assert_eq!(issue.status, IssueStatus::Submitted);
    }

    #[test]
    fn test_verify_contributor() {
        let (env, admin, _, _, _, contributor) = setup_contract();

        // First, the contributor needs to have some stats (created through application)
        // For this test, we'll manually create the stats first
        let stats = crate::healthcare_drips::ContributorStats {
            contributor: contributor.clone(),
            total_issues_reviewed: 0,
            total_issues_approved: 0,
            total_contributed: 0,
            level: ContributorLevel::Junior,
            reputation: 0,
            joined: env.ledger().timestamp(),
        };
        env.storage().instance().set(
            &Symbol::new(&env, &format!("stats_{}", contributor)),
            &stats,
        );

        let result = HealthcareDrips::verify_contributor(
            &env,
            contributor.clone(),
            ContributorLevel::Expert,
            admin,
        );

        assert_eq!(result, Ok(()));

        let updated_stats = HealthcareDrips::get_contributor_stats(&env, contributor).unwrap();
        assert_eq!(updated_stats.level, ContributorLevel::Expert);
        assert!(updated_stats.reputation >= 100);
    }

    #[test]
    fn test_apply_to_issue() {
        let (env, admin, patient, _, _, contributor) = setup_contract();

        // Create and submit issue
        let issue_id = HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::Surgery,
            String::from_str(&env, "Emergency Surgery"),
            String::from_str(&env, "Patient needs immediate surgery"),
            10000i128,
            String::from_str(&env, "QmHash123"),
            env.ledger().timestamp() + 86400 * 30,
            3u32,
            admin.clone(),
        ).unwrap();

        HealthcareDrips::submit_issue(&env, issue_id, patient).unwrap();

        // Verify contributor
        let stats = crate::healthcare_drips::ContributorStats {
            contributor: contributor.clone(),
            total_issues_reviewed: 0,
            total_issues_approved: 0,
            total_contributed: 0,
            level: ContributorLevel::Junior,
            reputation: 0,
            joined: env.ledger().timestamp(),
        };
        env.storage().instance().set(
            &Symbol::new(&env, &format!("stats_{}", contributor)),
            &stats,
        );

        // Apply to issue
        let result = HealthcareDrips::apply_to_issue(
            &env,
            issue_id,
            String::from_str(&env, "I can help with this surgery case"),
            contributor.clone(),
        );

        assert_eq!(result, Ok(()));

        let application = HealthcareDrips::get_application(&env, issue_id, contributor).unwrap();
        assert_eq!(application.contributor, contributor);
        assert_eq!(application.statement, String::from_str(&env, "I can help with this surgery case"));
        assert!(!application.approved);
    }

    #[test]
    fn test_review_application() {
        let (env, admin, patient, _, reviewer, contributor) = setup_contract();

        // Create and submit issue
        let issue_id = HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::Surgery,
            String::from_str(&env, "Emergency Surgery"),
            String::from_str(&env, "Patient needs immediate surgery"),
            10000i128,
            String::from_str(&env, "QmHash123"),
            env.ledger().timestamp() + 86400 * 30,
            2u32, // Only need 2 approvals for this test
            admin.clone(),
        ).unwrap();

        HealthcareDrips::submit_issue(&env, issue_id, patient).unwrap();

        // Verify contributor and apply
        let stats = crate::healthcare_drips::ContributorStats {
            contributor: contributor.clone(),
            total_issues_reviewed: 0,
            total_issues_approved: 0,
            total_contributed: 0,
            level: ContributorLevel::Junior,
            reputation: 0,
            joined: env.ledger().timestamp(),
        };
        env.storage().instance().set(
            &Symbol::new(&env, &format!("stats_{}", contributor)),
            &stats,
        );

        HealthcareDrips::apply_to_issue(
            &env,
            issue_id,
            String::from_str(&env, "I can help with this surgery case"),
            contributor.clone(),
        ).unwrap();

        // Review application positively
        let result = HealthcareDrips::review_application(
            &env,
            issue_id,
            contributor.clone(),
            true,
            String::from_str(&env, "Good expertise match"),
            reviewer.clone(),
        );

        assert_eq!(result, Ok(()));

        let application = HealthcareDrips::get_application(&env, issue_id, contributor).unwrap();
        assert!(application.approved);

        let updated_stats = HealthcareDrips::get_contributor_stats(&env, contributor).unwrap();
        assert_eq!(updated_stats.total_issues_reviewed, 1);
        assert_eq!(updated_stats.total_issues_approved, 1);
    }

    #[test]
    fn test_get_patient_issues() {
        let (env, admin, patient, _, _, _) = setup_contract();

        // Create multiple issues
        HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::Surgery,
            String::from_str(&env, "Surgery 1"),
            String::from_str(&env, "Description 1"),
            5000i128,
            String::from_str(&env, "QmHash1"),
            env.ledger().timestamp() + 86400 * 30,
            3u32,
            admin.clone(),
        ).unwrap();

        HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::EmergencyTreatment,
            String::from_str(&env, "Emergency 1"),
            String::from_str(&env, "Description 2"),
            3000i128,
            String::from_str(&env, "QmHash2"),
            env.ledger().timestamp() + 86400 * 30,
            3u32,
            admin.clone(),
        ).unwrap();

        let patient_issues = HealthcareDrips::get_patient_issues(&env, patient);
        assert_eq!(patient_issues.len(), 2);
        assert!(patient_issues.contains(&1));
        assert!(patient_issues.contains(&2));
    }

    #[test]
    fn test_get_active_issues() {
        let (env, admin, patient, _, _, _) = setup_contract();

        // Create and submit issue
        let issue_id = HealthcareDrips::create_issue(
            &env,
            patient.clone(),
            IssueType::Surgery,
            String::from_str(&env, "Emergency Surgery"),
            String::from_str(&env, "Patient needs immediate surgery"),
            10000i128,
            String::from_str(&env, "QmHash123"),
            env.ledger().timestamp() + 86400 * 30,
            3u32,
            admin.clone(),
        ).unwrap();

        HealthcareDrips::submit_issue(&env, issue_id, patient).unwrap();

        let active_issues = HealthcareDrips::get_active_issues(&env);
        assert_eq!(active_issues.len(), 1);
        assert!(active_issues.contains(&1));
    }
}
