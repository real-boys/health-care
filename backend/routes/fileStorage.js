/**
 * File Storage API Routes
 * Provides endpoints for file upload, download, management, and analytics
 */

const express = require('express');
const multer = require('multer');
const { body, param, query, validationResult } = require('express-validator');
const FileStorageService = require('../services/fileStorageService');
const auth = require('../middleware/auth');

const router = express.Router();
const fileStorageService = new FileStorageService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, but you can add restrictions here
    cb(null, true);
  }
});

/**
 * POST /api/file-storage/upload
 * Upload a file to S3 with optimization
 */
router.post('/upload', auth, upload.single('file'), [
  body('isPublic').optional().isBoolean().withMessage('isPublic must be a boolean'),
  body('tags').optional().isArray().withMessage('tags must be an array'),
  body('metadata').optional().isObject().withMessage('metadata must be an object'),
  body('width').optional().isInt({ min: 1, max: 10000 }).withMessage('Invalid width'),
  body('height').optional().isInt({ min: 1, max: 10000 }).withMessage('Invalid height'),
  body('quality').optional().isInt({ min: 1, max: 100 }).withMessage('Quality must be between 1 and 100'),
  body('format').optional().isIn(['jpeg', 'png', 'webp']).withMessage('Invalid format')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const uploadOptions = {
      isPublic: req.body.isPublic === 'true',
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      metadata: req.body.metadata ? JSON.parse(req.body.metadata) : {},
      width: req.body.width ? parseInt(req.body.width) : null,
      height: req.body.height ? parseInt(req.body.height) : null,
      quality: req.body.quality ? parseInt(req.body.quality) : null,
      format: req.body.format
    };

    const result = await fileStorageService.uploadFile(req.file, req.user.id, uploadOptions);
    
    res.status(201).json({
      success: true,
      data: result,
      message: 'File uploaded successfully'
    });
  } catch (error) {
    console.error('Error uploading file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to upload file'
    });
  }
});

/**
 * GET /api/file-storage/files/:fileId
 * Get file metadata
 */
router.get('/files/:fileId', auth, [
  param('fileId').notEmpty().withMessage('File ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fileId } = req.params;
    const fileMetadata = await fileStorageService.getFileMetadata(fileId, req.user.id);
    
    res.json({
      success: true,
      data: {
        ...fileMetadata,
        tags: JSON.parse(fileMetadata.tags || '[]'),
        metadata: JSON.parse(fileMetadata.metadata || '{}'),
        is_public: Boolean(fileMetadata.is_public)
      }
    });
  } catch (error) {
    console.error('Error fetching file metadata:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch file metadata'
    });
  }
});

/**
 * GET /api/file-storage/files/:fileId/download
 * Get download URL for a file
 */
router.get('/files/:fileId/download', auth, [
  param('fileId').notEmpty().withMessage('File ID is required'),
  query('download').optional().isBoolean().withMessage('download must be a boolean'),
  query('expiresIn').optional().isInt({ min: 60, max: 86400 }).withMessage('expiresIn must be between 60 and 86400 seconds')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fileId } = req.params;
    const options = {
      download: req.query.download === 'true',
      expiresIn: req.query.expiresIn ? parseInt(req.query.expiresIn) : 3600
    };

    const downloadUrl = await fileStorageService.getDownloadUrl(fileId, req.user.id, options);
    
    res.json({
      success: true,
      data: downloadUrl
    });
  } catch (error) {
    console.error('Error generating download URL:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to generate download URL'
    });
  }
});

/**
 * POST /api/file-storage/files/:fileId/versions
 * Create a new version of a file
 */
router.post('/files/:fileId/versions', auth, upload.single('file'), [
  param('fileId').notEmpty().withMessage('File ID is required'),
  body('changeDescription').optional().isString().withMessage('Change description must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fileId } = req.params;
    const { changeDescription } = req.body;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No file provided'
      });
    }

    const version = await fileStorageService.createFileVersion(
      fileId, 
      req.file.buffer, 
      req.user.id, 
      changeDescription
    );
    
    res.status(201).json({
      success: true,
      data: version,
      message: 'File version created successfully'
    });
  } catch (error) {
    console.error('Error creating file version:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to create file version'
    });
  }
});

/**
 * GET /api/file-storage/files/:fileId/versions
 * Get all versions of a file
 */
router.get('/files/:fileId/versions', auth, [
  param('fileId').notEmpty().withMessage('File ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fileId } = req.params;
    const versions = await fileStorageService.getFileVersions(fileId, req.user.id);
    
    res.json({
      success: true,
      data: versions
    });
  } catch (error) {
    console.error('Error fetching file versions:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch file versions'
    });
  }
});

/**
 * DELETE /api/file-storage/files/:fileId
 * Delete a file
 */
router.delete('/files/:fileId', auth, [
  param('fileId').notEmpty().withMessage('File ID is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fileId } = req.params;
    await fileStorageService.deleteFile(fileId, req.user.id);
    
    res.json({
      success: true,
      message: 'File deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting file:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to delete file'
    });
  }
});

/**
 * GET /api/file-storage/search
 * Search files
 */
router.get('/search', auth, [
  query('fileName').optional().isString().withMessage('File name must be a string'),
  query('mimeType').optional().isString().withMessage('MIME type must be a string'),
  query('tags').optional().isString().withMessage('Tags must be a string'),
  query('dateFrom').optional().isISO8601().withMessage('Invalid date format'),
  query('dateTo').optional().isISO8601().withMessage('Invalid date format'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const query = {};
    const options = {};

    if (req.query.fileName) query.fileName = req.query.fileName;
    if (req.query.mimeType) query.mimeType = req.query.mimeType;
    if (req.query.tags) query.tags = req.query.tags;
    if (req.query.dateFrom) query.dateFrom = req.query.dateFrom;
    if (req.query.dateTo) query.dateTo = req.query.dateTo;
    if (req.query.limit) options.limit = parseInt(req.query.limit);
    if (req.query.offset) options.offset = parseInt(req.query.offset);

    const files = await fileStorageService.searchFiles(req.user.id, query, options);
    
    res.json({
      success: true,
      data: files
    });
  } catch (error) {
    console.error('Error searching files:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to search files'
    });
  }
});

/**
 * GET /api/file-storage/analytics
 * Get storage analytics
 */
router.get('/analytics', auth, [
  query('userId').optional().isString().withMessage('User ID must be a string')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const userId = req.query.userId || (req.user.role === 'admin' ? null : req.user.id);
    const analytics = await fileStorageService.getStorageAnalytics(userId);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching storage analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch storage analytics'
    });
  }
});

/**
 * GET /api/file-storage/files/:fileId/analytics
 * Get analytics for a specific file
 */
router.get('/files/:fileId/analytics', auth, [
  param('fileId').notEmpty().withMessage('File ID is required'),
  query('period').optional().isIn(['7d', '30d', '90d']).withMessage('Invalid period')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { fileId } = req.params;
    const period = req.query.period || '30d';
    
    const analytics = await fileStorageService.getFileAnalytics(fileId, req.user.id, period);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    console.error('Error fetching file analytics:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch file analytics'
    });
  }
});

/**
 * POST /api/file-storage/invalidate-cache
 * Invalidate CDN cache for specific files
 */
router.post('/invalidate-cache', auth, [
  body('filePaths').isArray({ min: 1 }).withMessage('filePaths must be a non-empty array')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    const { filePaths } = req.body;
    
    // Only allow admins to invalidate cache
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    const result = await fileStorageService.invalidateCDNCache(filePaths);
    
    res.json({
      success: true,
      data: result,
      message: 'CDN cache invalidation initiated'
    });
  } catch (error) {
    console.error('Error invalidating CDN cache:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to invalidate CDN cache'
    });
  }
});

/**
 * GET /api/file-storage/health
 * Get service health status
 */
router.get('/health', auth, async (req, res) => {
  try {
    const health = await fileStorageService.getHealthStatus();
    
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    console.error('Error checking service health:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to check service health'
    });
  }
});

/**
 * GET /api/file-storage/access-logs
 * Get file access logs (admin only)
 */
router.get('/access-logs', auth, [
  query('fileId').optional().isString().withMessage('File ID must be a string'),
  query('userId').optional().isString().withMessage('User ID must be a string'),
  query('action').optional().isString().withMessage('Action must be a string'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }

  try {
    // Only allow admins to view access logs
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Admin access required'
      });
    }

    let sql = 'SELECT * FROM file_access_logs';
    const params = [];
    const conditions = [];

    if (req.query.fileId) {
      conditions.push('file_id = ?');
      params.push(req.query.fileId);
    }

    if (req.query.userId) {
      conditions.push('user_id = ?');
      params.push(req.query.userId);
    }

    if (req.query.action) {
      conditions.push('action = ?');
      params.push(req.query.action);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY timestamp DESC';

    if (req.query.limit) {
      sql += ' LIMIT ?';
      params.push(parseInt(req.query.limit));
    }

    if (req.query.offset) {
      sql += ' OFFSET ?';
      params.push(parseInt(req.query.offset));
    }

    fileStorageService.db.all(sql, params, (err, rows) => {
      if (err) {
        console.error('Error fetching access logs:', err);
        res.status(500).json({
          success: false,
          error: 'Failed to fetch access logs'
        });
      } else {
        res.json({
          success: true,
          data: rows
        });
      }
    });
  } catch (error) {
    console.error('Error fetching access logs:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to fetch access logs'
    });
  }
});

module.exports = router;
