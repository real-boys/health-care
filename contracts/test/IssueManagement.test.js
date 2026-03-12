const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("IssueManagement", function () {
  let issueManagement;
  let owner;
  let issueCreator;
  let reviewer;
  let approver;
  let contributor1;
  let contributor2;
  let patient;

  beforeEach(async function () {
    [owner, issueCreator, reviewer, approver, contributor1, contributor2, patient] = await ethers.getSigners();

    const IssueManagement = await ethers.getContractFactory("IssueManagement");
    issueManagement = await IssueManagement.deploy();
    await issueManagement.deployed();

    // Setup roles
    await issueManagement.grantRole(await issueManagement.ISSUE_CREATOR(), issueCreator.address);
    await issueManagement.grantRole(await issueManagement.REVIEWER(), reviewer.address);
    await issueManagement.grantRole(await issueManagement.APPROVER(), approver.address);
  });

  describe("Issue Creation", function () {
    it("Should create a new issue", async function () {
      const issueType = 1; // SURGERY
      const title = "Emergency Surgery";
      const description = "Patient needs immediate surgery";
      const fundingAmount = ethers.utils.parseEther("10");
      const medicalRecord = "QmHash";
      const deadline = (await time.latest()) + 86400 * 30; // 30 days
      const requiredApprovals = 3;

      await expect(issueManagement.connect(issueCreator).createIssue(
        patient.address,
        issueType,
        title,
        description,
        fundingAmount,
        medicalRecord,
        deadline,
        requiredApprovals
      ))
        .to.emit(issueManagement, "IssueCreated")
        .withArgs(1, issueCreator.address, patient.address, issueType, fundingAmount);

      const issue = await issueManagement.getIssue(1);
      expect(issue.id).to.equal(1);
      expect(issue.creator).to.equal(issueCreator.address);
      expect(issue.patient).to.equal(patient.address);
      expect(issue.issueType).to.equal(issueType);
      expect(issue.title).to.equal(title);
      expect(issue.fundingAmount).to.equal(fundingAmount);
      expect(issue.status).to.equal(0); // DRAFT
    });

    it("Should fail with invalid amount", async function () {
      await expect(issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Test",
        "Test",
        0,
        "QmHash",
        (await time.latest()) + 86400,
        2
      )).to.be.revertedWith("IssueManagement: INVALID_AMOUNT");
    });

    it("Should fail with invalid deadline", async function () {
      await expect(issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Test",
        "Test",
        ethers.utils.parseEther("1"),
        "QmHash",
        (await time.latest()) - 86400,
        2
      )).to.be.revertedWith("IssueManagement: INVALID_DEADLINE");
    });
  });

  describe("Issue Submission", function () {
    beforeEach(async function () {
      await issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Test Issue",
        "Test Description",
        ethers.utils.parseEther("5"),
        "QmHash",
        (await time.latest()) + 86400 * 30,
        3
      );
    });

    it("Should submit issue for review", async function () {
      await expect(issueManagement.connect(patient).submitIssue(1))
        .to.emit(issueManagement, "IssueSubmitted");

      const issue = await issueManagement.getIssue(1);
      expect(issue.status).to.equal(1); // SUBMITTED
    });

    it("Should fail if not creator or patient", async function () {
      await expect(issueManagement.connect(contributor1).submitIssue(1))
        .to.be.revertedWith("IssueManagement: NOT_AUTHORIZED");
    });
  });

  describe("Contributor Applications", function () {
    beforeEach(async function () {
      // Create and submit issue
      await issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Test Issue",
        "Test Description",
        ethers.utils.parseEther("5"),
        "QmHash",
        (await time.latest()) + 86400 * 30,
        3
      );
      await issueManagement.connect(patient).submitIssue(1);

      // Verify contributors
      await issueManagement.verifyContributor(contributor1.address, 0); // JUNIOR
      await issueManagement.verifyContributor(contributor2.address, 0); // JUNIOR
    });

    it("Should allow verified contributor to apply", async function () {
      const statement = "I can help with this case";
      
      await expect(issueManagement.connect(contributor1).applyToIssue(1, statement))
        .to.emit(issueManagement, "IssueSubmitted")
        .withArgs(1, contributor1.address, statement);

      const application = await issueManagement.getApplication(1, contributor1.address);
      expect(application).to.equal(statement);
    });

    it("Should fail for unverified contributor", async function () {
      const unverified = owner;
      await expect(issueManagement.connect(unverified).applyToIssue(1, "Test"))
        .to.be.revertedWith("IssueManagement: NOT_VERIFIED_CONTRIBUTOR");
    });

    it("Should fail if already applied", async function () {
      await issueManagement.connect(contributor1).applyToIssue(1, "First application");
      
      await expect(issueManagement.connect(contributor1).applyToIssue(1, "Second application"))
        .to.be.revertedWith("IssueManagement: ALREADY_APPLIED");
    });
  });

  describe("Application Review", function () {
    beforeEach(async function () {
      // Create and submit issue
      await issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Test Issue",
        "Test Description",
        ethers.utils.parseEther("5"),
        "QmHash",
        (await time.latest()) + 86400 * 30,
        3
      );
      await issueManagement.connect(patient).submitIssue(1);

      // Verify contributor and apply
      await issueManagement.verifyContributor(contributor1.address, 0);
      await issueManagement.connect(contributor1).applyToIssue(1, "I can help");
    });

    it("Should review application positively", async function () {
      const reason = "Good expertise match";
      
      await expect(issueManagement.connect(reviewer).reviewApplication(
        1,
        contributor1.address,
        true,
        reason
      ))
        .to.emit(issueManagement, "IssueReviewed")
        .withArgs(1, contributor1.address, true, reason);

      const stats = await issueManagement.getContributorStats(contributor1.address);
      expect(stats.totalIssuesReviewed).to.equal(1);
      expect(stats.totalIssuesApproved).to.equal(1);
    });

    it("Should review application negatively", async function () {
      const reason = "Not enough experience";
      
      await expect(issueManagement.connect(reviewer).reviewApplication(
        1,
        contributor1.address,
        false,
        reason
      ))
        .to.emit(issueManagement, "IssueReviewed")
        .withArgs(1, contributor1.address, false, reason);

      const stats = await issueManagement.getContributorStats(contributor1.address);
      expect(stats.totalIssuesReviewed).to.equal(1);
      expect(stats.totalIssuesApproved).to.equal(0);
    });
  });

  describe("Issue Approval", function () {
    beforeEach(async function () {
      // Create and submit issue
      await issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Test Issue",
        "Test Description",
        ethers.utils.parseEther("5"),
        "QmHash",
        (await time.latest()) + 86400 * 30,
        2 // Only need 2 approvals for this test
      );
      await issueManagement.connect(patient).submitIssue(1);

      // Verify contributors and apply
      await issueManagement.verifyContributor(contributor1.address, 0);
      await issueManagement.verifyContributor(contributor2.address, 0);
      
      await issueManagement.connect(contributor1).applyToIssue(1, "I can help 1");
      await issueManagement.connect(contributor2).applyToIssue(1, "I can help 2");
    });

    it("Should auto-approve when enough approvals", async function () {
      // Approve first application
      await issueManagement.connect(reviewer).reviewApplication(
        1,
        contributor1.address,
        true,
        "Good match"
      );

      // Approve second application - should auto-approve issue
      await expect(issueManagement.connect(reviewer).reviewApplication(
        1,
        contributor2.address,
        true,
        "Good match"
      ))
        .to.emit(issueManagement, "IssueApproved")
        .withArgs(1, 2);

      const issue = await issueManagement.getIssue(1);
      expect(issue.status).to.equal(4); // APPROVED
    });

    it("Should allow manual approval", async function () {
      await expect(issueManagement.connect(approver).approveIssue(1))
        .to.emit(issueManagement, "IssueApproved")
        .withArgs(1, 0);

      const issue = await issueManagement.getIssue(1);
      expect(issue.status).to.equal(4); // APPROVED
    });
  });

  describe("Contributor Verification", function () {
    it("Should verify contributor with level", async function () {
      const level = 2; // INTERMEDIATE
      
      await expect(issueManagement.connect(owner).verifyContributor(contributor1.address, level))
        .to.emit(issueManagement, "ContributorVerified")
        .withArgs(contributor1.address, level);

      const stats = await issueManagement.getContributorStats(contributor1.address);
      expect(stats.level).to.equal(level);
      expect(stats.reputation).to.be.gte(50);
    });

    it("Should fail for non-existent contributor", async function () {
      await expect(issueManagement.connect(owner).verifyContributor(ethers.constants.AddressZero, 0))
        .to.be.revertedWith("IssueManagement: CONTRIBUTOR_NOT_FOUND");
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      // Create multiple issues
      await issueManagement.connect(issueCreator).createIssue(
        patient.address,
        1,
        "Issue 1",
        "Description 1",
        ethers.utils.parseEther("5"),
        "QmHash1",
        (await time.latest()) + 86400 * 30,
        2
      );

      await issueManagement.connect(issueCreator).createIssue(
        patient.address,
        2,
        "Issue 2",
        "Description 2",
        ethers.utils.parseEther("3"),
        "QmHash2",
        (await time.latest()) + 86400 * 30,
        2
      );

      // Submit first issue
      await issueManagement.connect(patient).submitIssue(1);
    });

    it("Should get active issues", async function () {
      const activeIssues = await issueManagement.getActiveIssues();
      expect(activeIssues.length).to.be.gte(1);
    });

    it("Should get issues by type", async function () {
      const surgeryIssues = await issueManagement.getIssuesByType(1);
      expect(surgeryIssues.length).to.be.gte(1);
    });

    it("Should get pending issues", async function () {
      const pendingIssues = await issueManagement.getPendingIssues();
      expect(pendingIssues.length).to.be.gte(1);
    });

    it("Should get patient issues", async function () {
      const patientIssues = await issueManagement.getPatientIssues(patient.address);
      expect(patientIssues.length).to.be.gte(1);
    });
  });
});
