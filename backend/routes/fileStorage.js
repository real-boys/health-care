const express = require('express');
const router = express.Router();
const multer = require('multer');
const FileStorageService = require('../services/fileStorageService');
const auth = require('../middleware/auth');
const { body, validationResult, query } = require('express-validator');

// Initialize file storage service
const fileStorageService = new FileStorageService({
  awsRegion: process.env.AWS_REGION,
  s3Bucket: process.env.S3_BUCKET,
  s3AccessKey: process.env.AWS_ACCESS_KEY_ID,
  s3SecretKey: process.env.AWS_SECRET_ACCESS_KEY,
  cloudFrontDistribution: process.env.CLOUDFRONT_DISTRIBUTION_ID,
  cloudFrontDomain: process.env.CLOUDFRONT_DOMAIN,
  encryptionEnabled: process.env.FILE_ENCRYPTION_ENABLED !== 'false',
  compressionEnabled: process.env.FILE_COMPRESSION_ENABLED !== 'false'
});

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max file size
    files: 10 // Max 10 files at once
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf', 'text/plain', 'application/json',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

// Upload single file
router.post('/upload', [
  auth,
  upload.single('file'),
  body('accessLevel').optional().isIn(['public', 'private']),
  body('folder').optional().isString().isLength({ max: 100 }),
  body('tags').optional().isObject(),
  body('optimizeImages').optional().isBoolean(),
  body('createVersions').optional().isBoolean()
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

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file provided'
      });
    }

    const {
      accessLevel = 'private',
      folder = '',
      tags = {},
      optimizeImages = true,
      createVersions = true
    } = req.body;

    const uploadedFile = await fileStorageService.uploadFile(req.file, {
      userId: req.user.id,
      accessLevel,
      folder,
      tags,
      optimizeImages,
      createVersions
    });

    res.json({
      success: true,
      message: 'File uploaded successfully',
      data: uploadedFile
    });
  } catch (error) {
    console.error('File upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload file',
      error: error.message
    });
  }
});

// Upload multiple files
router.post('/upload-multiple', [
  auth,
  upload.array('files', 10),
  body('accessLevel').optional().isIn(['public', 'private']),
  body('folder').optional().isString().isLength({ max: 100 }),
  body('tags').optional().isObject(),
  body('optimizeImages').optional().isBoolean(),
  body('createVersions').optional().isBoolean()
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

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No files provided'
      });
    }

    const {
      accessLevel = 'private',
      folder = '',
      tags = {},
      optimizeImages = true,
      createVersions = true
    } = req.body;

    const uploadPromises = req.files.map(file =>
      fileStorageService.uploadFile(file, {
        userId: req.user.id,
        accessLevel,
        folder,
        tags,
        optimizeImages,
        createVersions
      })
    );

    const uploadedFiles = await Promise.all(uploadPromises);

    res.json({
      success: true,
      message: `${uploadedFiles.length} files uploaded successfully`,
      data: uploadedFiles
    });
  } catch (error) {
    console.error('Multiple file upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload files',
      error: error.message
    });
  }
});

// Download file
router.get('/download/:fileKey', [
  auth,
  query('version').optional().isString()
], async (req, res) => {
  try {
    const { fileKey } = req.params;
    const { version } = req.query;

    const fileData = await fileStorageService.downloadFile(fileKey, {
      userId: req.user.id,
      version
    });

    const metadata = await fileStorageService.getFileMetadata(fileKey, req.user.id);

    res.setHeader('Content-Type', metadata.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${metadata.originalName}"`);
    res.setHeader('Content-Length', fileData.ContentLength);

    res.send(fileData.Body);
  } catch (error) {
    console.error('File download error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download file',
      error: error.message
    });
  }
});

// Get file URL (for streaming/viewing)
router.get('/url/:fileKey', [
  auth,
  query('expiresIn').optional().isInt({ min: 60, max: 604800 }) // 1 minute to 7 days
], async (req, res) => {
  try {
    const { fileKey } = req.params;
    const { expiresIn = 3600 } = req.query;

    const shareInfo = await fileStorageService.createFileShare(fileKey, {
      userId: req.user.id,
      expiresInSeconds: parseInt(expiresIn),
      accessLevel: 'read'
    });

    res.json({
      success: true,
      data: shareInfo
    });
  } catch (error) {
    console.error('Get file URL error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate file URL',
      error: error.message
    });
  }
});

// List files
router.get('/list', [
  auth,
  query('accessLevel').optional().isIn(['public', 'private']),
  query('tags').optional().isObject(),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('offset').optional().isInt({ min: 0 }),
  query('sortBy').optional().isIn(['uploadedAt', 'size', 'originalName']),
  query('sortOrder').optional().isIn(['asc', 'desc'])
], async (req, res) => {
  try {
    const {
      accessLevel,
      tags,
      limit = 50,
      offset = 0,
      sortBy = 'uploadedAt',
      sortOrder = 'desc'
    } = req.query;

    const fileList = await fileStorageService.listFiles({
      userId: req.user.id,
      accessLevel,
      tags: tags ? JSON.parse(tags) : {},
      limit: parseInt(limit),
      offset: parseInt(offset),
      sortBy,
      sortOrder
    });

    res.json({
      success: true,
      data: fileList
    });
  } catch (error) {
    console.error('List files error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to list files',
      error: error.message
    });
  }
});

// Get file metadata
router.get('/metadata/:fileKey', [
  auth
], async (req, res) => {
  try {
    const { fileKey } = req.params;

    const metadata = await fileStorageService.getFileMetadata(fileKey, req.user.id);

    res.json({
      success: true,
      data: metadata
    });
  } catch (error) {
    console.error('Get file metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file metadata',
      error: error.message
    });
  }
});

// Update file metadata
router.patch('/metadata/:fileKey', [
  auth,
  body('accessLevel').optional().isIn(['public', 'private']),
  body('tags').optional().isObject()
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

    const { fileKey } = req.params;
    const updates = req.body;

    const updatedMetadata = await fileStorageService.updateFileMetadata(fileKey, updates, req.user.id);

    res.json({
      success: true,
      message: 'File metadata updated successfully',
      data: updatedMetadata
    });
  } catch (error) {
    console.error('Update file metadata error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update file metadata',
      error: error.message
    });
  }
});

// Delete file
router.delete('/:fileKey', [
  auth
], async (req, res) => {
  try {
    const { fileKey } = req.params;

    await fileStorageService.deleteFile(fileKey, req.user.id);

    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete file',
      error: error.message
    });
  }
});

// Create file share
router.post('/share/:fileKey', [
  auth,
  body('expiresInSeconds').optional().isInt({ min: 60, max: 604800 }),
  body('accessLevel').optional().isIn(['read', 'write'])
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

    const { fileKey } = req.params;
    const { expiresInSeconds = 3600, accessLevel = 'read' } = req.body;

    const shareInfo = await fileStorageService.createFileShare(fileKey, {
      userId: req.user.id,
      expiresInSeconds,
      accessLevel
    });

    res.json({
      success: true,
      message: 'File share created successfully',
      data: shareInfo
    });
  } catch (error) {
    console.error('Create file share error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create file share',
      error: error.message
    });
  }
});

// Create zip archive
router.post('/zip', [
  auth,
  body('fileKeys').isArray({ min: 1, max: 50 }),
  body('fileKeys.*').isString()
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

    const { fileKeys } = req.body;

    const zipResult = await fileStorageService.createFileZip(fileKeys, req.user.id);

    res.json({
      success: true,
      message: 'File archive created successfully',
      data: zipResult
    });
  } catch (error) {
    console.error('Create file zip error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create file archive',
      error: error.message
    });
  }
});

// Get file analytics
router.get('/analytics', [
  auth,
  query('period').optional().isIn(['last_7_days', 'last_30_days', 'last_90_days'])
], async (req, res) => {
  try {
    const { period = 'last_30_days' } = req.query;

    const analytics = await fileStorageService.getFileAnalytics({
      userId: req.user.id,
      period
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('File analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get file analytics',
      error: error.message
    });
  }
});

// Get storage usage (for admin users)
router.get('/usage', [
  auth
], async (req, res) => {
  try {
    // Check if user is admin
    if (!['admin', 'system_admin'].includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Insufficient permissions'
      });
    }

    const analytics = await fileStorageService.getFileAnalytics({
      period: 'last_30_days'
    });

    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Storage usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get storage usage',
      error: error.message
    });
  }
});

// Health check for file storage service
router.get('/health', async (req, res) => {
  try {
    // Check S3 connectivity
    const { Buckets } = await fileStorageService.s3.listBuckets().promise();
    
    res.json({
      success: true,
      message: 'File storage service is healthy',
      data: {
        s3Connected: true,
        bucketCount: Buckets.length,
        configuredBucket: fileStorageService.config.s3Bucket,
        cloudFrontConfigured: !!fileStorageService.config.cloudFrontDomain
      }
    });
  } catch (error) {
    console.error('File storage health check error:', error);
    res.status(500).json({
      success: false,
      message: 'File storage service health check failed',
      error: error.message
    });
  }
});

module.exports = router;
