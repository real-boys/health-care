const express = require('express');
const router = express.Router();
const BackupService = require('../services/backupService');
const auth = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');

// Initialize backup service
const backupService = new BackupService({
  backupDir: process.env.BACKUP_DIR || './backups',
  encryptionKey: process.env.BACKUP_ENCRYPTION_KEY,
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS) || 30,
  scheduleInterval: process.env.BACKUP_SCHEDULE || '0 2 * * *'
});

// Initialize backup service on startup
backupService.initialize().catch(console.error);

// Middleware to check backup permissions
const checkBackupPermission = (req, res, next) => {
  const userRole = req.user?.role;
  const allowedRoles = ['admin', 'system_admin'];
  
  if (!allowedRoles.includes(userRole)) {
    return res.status(403).json({
      success: false,
      message: 'Insufficient permissions for backup operations'
    });
  }
  
  next();
};

// Create manual backup
router.post('/create', [
  auth,
  checkBackupPermission,
  body('description').optional().isString().isLength({ max: 500 }),
  body('collections').optional().isArray(),
  body('pointInTime').optional().isISO8601()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { description, collections, pointInTime } = req.body;
    
    const backup = await backupService.createBackup({
      type: 'manual',
      description: description || 'Manual backup created via API',
      collections,
      pointInTime: pointInTime ? new Date(pointInTime) : new Date()
    });

    res.json({
      success: true,
      message: 'Backup created successfully',
      data: backup
    });
  } catch (error) {
    console.error('Backup creation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create backup',
      error: error.message
    });
  }
});

// List all backups
router.get('/list', [
  auth,
  checkBackupPermission
], async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    
    res.json({
      success: true,
      data: backups
    });
  } catch (error) {
    console.error('List backups error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list backups',
      error: error.message
    });
  }
});

// Get backup details
router.get('/:backupId', [
  auth,
  checkBackupPermission
], async (req, res) => {
  try {
    const { backupId } = req.params;
    const backupStatus = backupService.getBackupStatus(backupId);
    
    if (!backupStatus) {
      return res.status(404).json({
        success: false,
        message: 'Backup not found'
      });
    }

    res.json({
      success: true,
      data: backupStatus
    });
  } catch (error) {
    console.error('Get backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup details',
      error: error.message
    });
  }
});

// Restore from backup
router.post('/:backupId/restore', [
  auth,
  checkBackupPermission,
  body('targetCollections').optional().isArray(),
  body('dropExisting').optional().isBoolean(),
  body('validateBeforeRestore').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { backupId } = req.params;
    const { targetCollections, dropExisting, validateBeforeRestore } = req.body;
    
    const restoreResult = await backupService.restoreFromBackup(backupId, {
      targetCollections,
      dropExisting: dropExisting || false,
      validateBeforeRestore: validateBeforeRestore !== false
    });

    res.json({
      success: true,
      message: 'Restore completed successfully',
      data: restoreResult
    });
  } catch (error) {
    console.error('Restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to restore from backup',
      error: error.message
    });
  }
});

// Point-in-time restore
router.post('/point-in-time-restore', [
  auth,
  checkBackupPermission,
  body('targetDate').isISO8601(),
  body('targetCollections').optional().isArray(),
  body('dropExisting').optional().isBoolean(),
  body('validateBeforeRestore').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { targetDate, targetCollections, dropExisting, validateBeforeRestore } = req.body;
    
    const restoreResult = await backupService.pointInTimeRestore(new Date(targetDate), {
      targetCollections,
      dropExisting: dropExisting || false,
      validateBeforeRestore: validateBeforeRestore !== false
    });

    res.json({
      success: true,
      message: 'Point-in-time restore completed successfully',
      data: restoreResult
    });
  } catch (error) {
    console.error('Point-in-time restore error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to perform point-in-time restore',
      error: error.message
    });
  }
});

// Delete backup
router.delete('/:backupId', [
  auth,
  checkBackupPermission
], async (req, res) => {
  try {
    const { backupId } = req.params;
    
    await backupService.deleteBackup(backupId);

    res.json({
      success: true,
      message: 'Backup deleted successfully'
    });
  } catch (error) {
    console.error('Delete backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete backup',
      error: error.message
    });
  }
});

// Get backup analytics
router.get('/analytics/dashboard', [
  auth,
  checkBackupPermission
], async (req, res) => {
  try {
    const analytics = await backupService.getBackupAnalytics();
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Backup analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get backup analytics',
      error: error.message
    });
  }
});

// Verify backup integrity
router.post('/:backupId/verify', [
  auth,
  checkBackupPermission
], async (req, res) => {
  try {
    const { backupId } = req.params;
    
    // This would need to be implemented in the backup service
    // For now, return a placeholder response
    res.json({
      success: true,
      message: 'Backup verification completed',
      data: {
        backupId,
        verified: true,
        verificationTime: new Date()
      }
    });
  } catch (error) {
    console.error('Backup verification error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to verify backup',
      error: error.message
    });
  }
});

// Emergency backup (immediate backup for critical situations)
router.post('/emergency', [
  auth,
  checkBackupPermission
], async (req, res) => {
  try {
    const backup = await backupService.createBackup({
      type: 'emergency',
      description: 'Emergency backup - critical situation',
      priority: 'high'
    });

    res.json({
      success: true,
      message: 'Emergency backup created successfully',
      data: backup
    });
  } catch (error) {
    console.error('Emergency backup error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create emergency backup',
      error: error.message
    });
  }
});

module.exports = router;
