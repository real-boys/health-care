const express = require('express');
const multer = require('multer');
const { setCache, deleteCache } = require('../middleware/cache');

// Import IPFS services
const ipfsService = require('../services/ipfsService');
const encryptionService = require('../services/encryptionService');
const contentAddressingService = require('../services/contentAddressingService');
const versioningService = require('../services/versioningService');
const pinningService = require('../services/pinningService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB limit
  }
});

// Upload file to IPFS
router.post('/upload', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const { encryptionKey, contentType, priority = 'MEDIUM' } = req.body;
    const finalEncryptionKey = encryptionKey || encryptionService.generateKey();

    // Prepare file data
    const fileData = {
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      buffer: req.file.buffer.toString('base64'),
      uploadedAt: new Date().toISOString(),
      uploadedBy: req.user.id
    };

    // Upload to IPFS with encryption
    const result = await ipfsService.addEncryptedFile(fileData, finalEncryptionKey, {
      contentType: contentType || req.file.mimetype,
      pin: priority === 'CRITICAL' || priority === 'HIGH'
    });

    // Register for deduplication
    await contentAddressingService.registerContent(
      result.contentHash,
      result.cid,
      'file',
      req.file.size,
      result.size,
      { originalName: req.file.originalname, mimeType: req.file.mimetype }
    );

    // Auto-pin if high priority
    if (priority === 'CRITICAL' || priority === 'HIGH') {
      await pinningService.addToQueue(
        'file',
        result.cid,
        result.cid,
        priority,
        req.user.id,
        { originalName: req.file.originalname }
      );
    }

    res.status(201).json({
      message: 'File uploaded successfully',
      cid: result.cid,
      contentHash: result.contentHash,
      encryptionKey: finalEncryptionKey,
      size: result.size,
      isNew: result.isNew
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    next(error);
  }
});

// Upload JSON data to IPFS
router.post('/upload/json', async (req, res, next) => {
  try {
    const { data, encryptionKey, contentType = 'application/json', priority = 'MEDIUM' } = req.body;
    
    if (!data) {
      return res.status(400).json({ error: 'No data provided' });
    }

    const finalEncryptionKey = encryptionKey || encryptionService.generateKey();

    // Upload to IPFS with encryption
    const result = await ipfsService.addEncryptedFile(data, finalEncryptionKey, {
      contentType,
      pin: priority === 'CRITICAL' || priority === 'HIGH'
    });

    // Register for deduplication
    await contentAddressingService.registerContent(
      result.contentHash,
      result.cid,
      'json',
      JSON.stringify(data).length,
      result.size,
      { contentType }
    );

    // Auto-pin if high priority
    if (priority === 'CRITICAL' || priority === 'HIGH') {
      await pinningService.addToQueue(
        'json',
        result.cid,
        result.cid,
        priority,
        req.user.id,
        { contentType }
      );
    }

    res.status(201).json({
      message: 'Data uploaded successfully',
      cid: result.cid,
      contentHash: result.contentHash,
      encryptionKey: finalEncryptionKey,
      size: result.size,
      isNew: result.isNew
    });
  } catch (error) {
    console.error('Error uploading JSON data:', error);
    next(error);
  }
});

// Download file from IPFS
router.get('/download/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;
    const { encryptionKey } = req.query;

    if (!encryptionKey) {
      return res.status(400).json({ error: 'Encryption key required' });
    }

    // Get content from IPFS
    const { data, metadata } = await ipfsService.getEncryptedFile(cid, encryptionKey);

    // Handle file downloads
    if (metadata.contentType && metadata.contentType.startsWith('application/json') === false) {
      // It's a file
      if (data.originalName && data.buffer) {
        const buffer = Buffer.from(data.buffer, 'base64');
        res.setHeader('Content-Type', data.mimeType);
        res.setHeader('Content-Disposition', `attachment; filename="${data.originalName}"`);
        res.setHeader('Content-Length', buffer.length);
        return res.send(buffer);
      }
    }

    // Return JSON data
    res.json({
      data,
      metadata
    });
  } catch (error) {
    console.error('Error downloading from IPFS:', error);
    next(error);
  }
});

// Pin content
router.post('/pin/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;
    const { priority = 'MEDIUM' } = req.body;

    // Check if content exists
    const content = await contentAddressingService.getContentByHash(cid);
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Pin the content
    const result = await pinningService.addToQueue(
      content.content_type,
      cid,
      cid,
      priority,
      req.user.id,
      content.metadata
    );

    res.json({
      message: 'Content queued for pinning',
      result
    });
  } catch (error) {
    console.error('Error pinning content:', error);
    next(error);
  }
});

// Unpin content
router.delete('/pin/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;

    await pinningService.unpinRecord(cid, req.user.id);

    res.json({ message: 'Content unpinned successfully' });
  } catch (error) {
    console.error('Error unpinning content:', error);
    next(error);
  }
});

// Get pinned content
router.get('/pinned', async (req, res, next) => {
  try {
    const { status, priority, resourceType } = req.query;
    
    const pinnedRecords = await pinningService.getPinnedRecords(status, priority, resourceType);
    
    res.json({ pinnedRecords });
  } catch (error) {
    console.error('Error getting pinned records:', error);
    next(error);
  }
});

// Verify content integrity
router.get('/verify/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;
    const { expectedHash } = req.query;

    if (!expectedHash) {
      return res.status(400).json({ error: 'Expected hash required for verification' });
    }

    const isValid = await ipfsService.verifyFileIntegrity(cid, expectedHash);

    res.json({
      cid,
      expectedHash,
      isValid,
      verifiedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error verifying content:', error);
    next(error);
  }
});

// Get content information
router.get('/info/:cid', async (req, res, next) => {
  try {
    const { cid } = req.params;

    // Get content from addressing service
    const content = await contentAddressingService.getContent(cid);
    
    if (!content) {
      return res.status(404).json({ error: 'Content not found' });
    }

    // Get references
    const references = await contentAddressingService.getContentReferences(cid);

    // Get pinning status
    const pinnedRecord = await pinningService.getPinnedRecord(cid);

    res.json({
      content,
      references,
      pinningStatus: pinnedRecord ? pinnedRecord.pin_status : 'NOT_PINNED',
      pinnedAt: pinnedRecord ? pinnedRecord.pinned_at : null
    });
  } catch (error) {
    console.error('Error getting content info:', error);
    next(error);
  }
});

// Find duplicate content
router.get('/duplicates', async (req, res, next) => {
  try {
    const { contentType, minUploadCount = 2 } = req.query;

    const duplicates = await contentAddressingService.findDuplicates(contentType, parseInt(minUploadCount));

    res.json({ duplicates });
  } catch (error) {
    console.error('Error finding duplicates:', error);
    next(error);
  }
});

// Get deduplication statistics
router.get('/stats/deduplication', async (req, res, next) => {
  try {
    const stats = await contentAddressingService.calculateDeduplicationStats();
    const serviceStats = contentAddressingService.getStats();

    res.json({
      database: stats,
      service: serviceStats
    });
  } catch (error) {
    console.error('Error getting deduplication stats:', error);
    next(error);
  }
});

// Get IPFS node statistics
router.get('/stats/node', async (req, res, next) => {
  try {
    const stats = await ipfsService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting IPFS stats:', error);
    next(error);
  }
});

// Get pinning statistics
router.get('/stats/pinning', async (req, res, next) => {
  try {
    const stats = await pinningService.getPinningStats();
    const queueStatus = pinningService.getQueueStatus();

    res.json({
      stats,
      queue: queueStatus
    });
  } catch (error) {
    console.error('Error getting pinning stats:', error);
    next(error);
  }
});

// Get versioning statistics
router.get('/stats/versioning', async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.query;
    
    const stats = await versioningService.getVersionStats(resourceType, resourceId);
    
    res.json({ versionStats: stats });
  } catch (error) {
    console.error('Error getting versioning stats:', error);
    next(error);
  }
});

// Create version for existing content
router.post('/version/:resourceType/:resourceId', async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { data, changeDescription, encryptionKey } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Data is required for versioning' });
    }

    const finalEncryptionKey = encryptionKey || encryptionService.generateKey();

    const result = await versioningService.createVersion(
      resourceType,
      resourceId,
      data,
      req.user.id,
      changeDescription,
      finalEncryptionKey
    );

    res.json({
      message: 'Version created successfully',
      version: result
    });
  } catch (error) {
    console.error('Error creating version:', error);
    next(error);
  }
});

// Get version history
router.get('/version/:resourceType/:resourceId/history', async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;

    const history = await versioningService.getVersionHistory(resourceType, resourceId);

    res.json({ history });
  } catch (error) {
    console.error('Error getting version history:', error);
    next(error);
  }
});

// Restore to specific version
router.post('/version/:resourceType/:resourceId/restore/:versionNumber', async (req, res, next) => {
  try {
    const { resourceType, resourceId, versionNumber } = req.params;

    const result = await versioningService.restoreVersion(
      resourceType,
      resourceId,
      parseInt(versionNumber),
      req.user.id
    );

    res.json({
      message: 'Version restored successfully',
      restoredVersion: result
    });
  } catch (error) {
    console.error('Error restoring version:', error);
    next(error);
  }
});

// Create restore point
router.post('/restore-point/:resourceType/:resourceId', async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;
    const { restorePointName, description } = req.body;

    if (!restorePointName) {
      return res.status(400).json({ error: 'Restore point name is required' });
    }

    const result = await versioningService.createRestorePoint(
      resourceType,
      resourceId,
      restorePointName,
      req.user.id,
      description
    );

    res.json({
      message: 'Restore point created successfully',
      restorePoint: result
    });
  } catch (error) {
    console.error('Error creating restore point:', error);
    next(error);
  }
});

// Get restore points
router.get('/restore-point/:resourceType/:resourceId', async (req, res, next) => {
  try {
    const { resourceType, resourceId } = req.params;

    const restorePoints = await versioningService.getRestorePoints(resourceType, resourceId);

    res.json({ restorePoints });
  } catch (error) {
    console.error('Error getting restore points:', error);
    next(error);
  }
});

// Restore from restore point
router.post('/restore-point/:restorePointId/restore', async (req, res, next) => {
  try {
    const { restorePointId } = req.params;

    const result = await versioningService.restoreFromRestorePoint(
      parseInt(restorePointId),
      req.user.id
    );

    res.json({
      message: 'Restored from restore point successfully',
      restoredVersion: result
    });
  } catch (error) {
    console.error('Error restoring from restore point:', error);
    next(error);
  }
});

// Create pinning policy
router.post('/policy/pinning', async (req, res, next) => {
  try {
    const { resourceType, autoPin, priority, retentionDays, conditions } = req.body;

    if (!resourceType) {
      return res.status(400).json({ error: 'Resource type is required' });
    }

    const result = await pinningService.createPinningPolicy(
      resourceType,
      autoPin !== false,
      priority || 'MEDIUM',
      retentionDays || 365,
      conditions
    );

    res.json({
      message: 'Pinning policy created successfully',
      policy: result
    });
  } catch (error) {
    console.error('Error creating pinning policy:', error);
    next(error);
  }
});

// Get pinning policies
router.get('/policy/pinning', async (req, res, next) => {
  try {
    const { resourceType } = req.query;
    
    // This would need to be implemented in pinningService
    // For now, return a placeholder
    res.json({ 
      message: 'Pinning policies endpoint',
      resourceType 
    });
  } catch (error) {
    console.error('Error getting pinning policies:', error);
    next(error);
  }
});

// Cleanup old content
router.post('/cleanup', async (req, res, next) => {
  try {
    const { daysOld = 30 } = req.body;

    const contentCleanup = await contentAddressingService.cleanupOldContent(daysOld);
    const pinningCleanup = await pinningService.cleanupOldRecords(daysOld);

    res.json({
      message: 'Cleanup completed',
      contentCleanup,
      pinningCleanup
    });
  } catch (error) {
    console.error('Error during cleanup:', error);
    next(error);
  }
});

// Garbage collection
router.post('/gc', async (req, res, next) => {
  try {
    const result = await ipfsService.garbageCollect();

    res.json({
      message: 'Garbage collection completed',
      result
    });
  } catch (error) {
    console.error('Error during garbage collection:', error);
    next(error);
  }
});

// Health check for IPFS services
router.get('/health', async (req, res, next) => {
  try {
    const ipfsStats = await ipfsService.getStats();
    const pinningStats = await pinningService.getPinningStats();
    const queueStatus = pinningService.getQueueStatus();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      services: {
        ipfs: {
          connected: true,
          nodeType: ipfsStats.nodeType,
          storage: ipfsStats.storage
        },
        pinning: {
          queueLength: queueStatus.queueLength,
          isProcessing: queueStatus.isProcessing,
          stats: pinningStats
        },
        contentAddressing: {
          cachedItems: contentAddressingService.getStats().cachedItems
        }
      }
    };

    res.json(health);
  } catch (error) {
    console.error('Error in health check:', error);
    res.status(500).json({
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

module.exports = router;
