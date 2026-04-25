const BackupService = require('./services/backupService');
const EnhancedSecurityMonitoringService = require('./services/enhancedSecurityMonitoringService');
const FileStorageService = require('./services/fileStorageService');
const ComplianceMonitoringService = require('./services/complianceMonitoringService');

async function testServices() {
  console.log('Testing implemented services...\n');

  // Test Backup Service
  console.log('1. Testing Backup Service...');
  try {
    const backupService = new BackupService({
      backupDir: './test-backups',
      encryptionKey: 'test-key-for-backup-encryption',
      retentionDays: 7
    });
    
    await backupService.initialize();
    console.log('✓ Backup Service initialized successfully');
    
    const analytics = await backupService.getBackupAnalytics();
    console.log('✓ Backup analytics generated:', analytics.totalBackups, 'backups');
  } catch (error) {
    console.log('✗ Backup Service error:', error.message);
  }

  // Test Security Monitoring Service
  console.log('\n2. Testing Security Monitoring Service...');
  try {
    const securityService = new EnhancedSecurityMonitoringService({
      autoBlockIPs: false,
      autoLockAccounts: false,
      notifyAdmins: false
    });
    
    await securityService.initialize();
    console.log('✓ Security Monitoring Service initialized successfully');
    
    const metrics = securityService.getSecurityMetrics();
    console.log('✓ Security metrics retrieved:', metrics.totalEvents, 'events');
  } catch (error) {
    console.log('✗ Security Monitoring Service error:', error.message);
  }

  // Test File Storage Service
  console.log('\n3. Testing File Storage Service...');
  try {
    const fileService = new FileStorageService({
      encryptionEnabled: false,
      compressionEnabled: false
    });
    
    console.log('✓ File Storage Service initialized successfully');
    
    const analytics = await fileService.getFileAnalytics({ period: 'last_30_days' });
    console.log('✓ File analytics generated:', analytics.totalFiles, 'files');
  } catch (error) {
    console.log('✗ File Storage Service error:', error.message);
  }

  // Test Compliance Monitoring Service
  console.log('\n4. Testing Compliance Monitoring Service...');
  try {
    const complianceService = new ComplianceMonitoringService({
      monitoringInterval: null, // Disable scheduled checks for testing
      reportInterval: null
    });
    
    await complianceService.initialize();
    console.log('✓ Compliance Monitoring Service initialized successfully');
    
    const status = complianceService.getComplianceStatus();
    console.log('✓ Compliance status retrieved:', status.score + '%', 'compliance score');
    
    const rules = complianceService.getRules();
    console.log('✓ Compliance rules loaded:', rules.length, 'rules');
  } catch (error) {
    console.log('✗ Compliance Monitoring Service error:', error.message);
  }

  console.log('\nService testing completed!');
}

// Run tests if this file is executed directly
if (require.main === module) {
  testServices().catch(console.error);
}

module.exports = testServices;
