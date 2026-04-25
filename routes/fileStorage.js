const express = require('express');
const router = express.Router();
const multer = require('multer');
const Document = require('../models/Document');
const fileStorageService = require('../services/fileStorageService');
const auth = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

// Upload file
router.post('/upload', auth, upload.single('file'), [
  body('documentType').optional().isIn([
    'invoice', 'receipt', 'medical-report', 'prescription', 'claim-form', 
    'id-proof', 'insurance-card', 'bank-statement', 'tax-document', 
    'correspondence', 'contract', 'other'
  ]),
  body('relatedTo').optional().isIn(['claim', 'payment', 'user', 'provider', 'general']),
  body('description').optional().isLength({ max: 500 }),
  body('tags').optional().isArray(),
  body('isPublic').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = {
      userId: req.user.id,
      userRole: req.user.role,
      folderId: req.body.folderId || null,
      relatedTo: req.body.relatedTo || 'general',
      relatedId: req.body.relatedId || null,
      documentType: req.body.documentType || 'other',
      tags: req.body.tags ? JSON.parse(req.body.tags) : [],
      description: req.body.description || '',
      isPublic: req.body.isPublic === 'true',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    const result = await fileStorageService.uploadFile(req.file, metadata);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get file
router.get('/:documentId', auth, async (req, res) => {
  try {
    const result = await fileStorageService.getFile(req.params.documentId, req.user.id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Document not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get file download URL
router.get('/:documentId/download', auth, async (req, res) => {
  try {
    const { expiresIn = 3600 } = req.query;
    
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check access permissions
    if (!await fileStorageService.hasFileAccess(document, req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const signedUrl = await fileStorageService.generateSignedUrl(document.filePath, parseInt(expiresIn));
    const cdnSignedUrl = await fileStorageService.generateCDNSignedUrl(document.filePath, parseInt(expiresIn));
    
    // Log access
    await fileStorageService.logFileAccess(document, req.user.id);
    await document.incrementDownloadCount();
    await document.addViewer(req.user.id);
    
    res.json({
      success: true,
      data: {
        signedUrl,
        cdnSignedUrl,
        expiresIn: parseInt(expiresIn),
        fileName: document.originalFileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete file
router.delete('/:documentId', auth, async (req, res) => {
  try {
    const result = await fileStorageService.deleteFile(req.params.documentId, req.user.id);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Document not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Create file version
router.post('/:documentId/version', auth, upload.single('file'), [
  body('documentType').optional().isIn([
    'invoice', 'receipt', 'medical-report', 'prescription', 'claim-form', 
    'id-proof', 'insurance-card', 'bank-statement', 'tax-document', 
    'correspondence', 'contract', 'other'
  ]),
  body('description').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const metadata = {
      userId: req.user.id,
      userRole: req.user.role,
      description: req.body.description || '',
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
      sessionId: req.sessionID
    };

    const result = await fileStorageService.createFileVersion(req.params.documentId, req.file, metadata);
    
    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    if (error.message === 'Access denied') {
      return res.status(403).json({ error: error.message });
    }
    if (error.message === 'Original document not found') {
      return res.status(404).json({ error: error.message });
    }
    res.status(500).json({ error: error.message });
  }
});

// Get file analytics
router.get('/analytics/:userId', auth, async (req, res) => {
  try {
    // Only allow users to access their own analytics or admins to access any
    if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { startDate, endDate } = req.query;
    const filters = {};
    
    if (startDate) filters.startDate = new Date(startDate);
    if (endDate) filters.endDate = new Date(endDate);
    
    const analytics = await fileStorageService.getFileAnalytics(req.params.userId, filters);
    
    res.json({
      success: true,
      data: analytics
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Search documents
router.get('/search/:userId', auth, async (req, res) => {
  try {
    // Only allow users to search their own documents or admins to search any
    if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { q: query, documentType, relatedTo, createdAfter, createdBefore } = req.query;
    
    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const filters = {};
    if (documentType) filters.documentType = documentType;
    if (relatedTo) filters.relatedTo = relatedTo;
    if (createdAfter) filters.createdAfter = new Date(createdAfter);
    if (createdBefore) filters.createdBefore = new Date(createdBefore);
    
    const documents = await Document.searchDocuments(req.params.userId, query, filters);
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get user's documents
router.get('/user/:userId', auth, async (req, res) => {
  try {
    // Only allow users to access their own documents or admins to access any
    if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const { 
      page = 1, 
      limit = 20, 
      documentType, 
      status = 'active', 
      folderId,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    const query = { user: req.params.userId, status };
    
    if (documentType) query.documentType = documentType;
    if (folderId) query.folder = folderId;

    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    const documents = await Document.find(query)
      .populate('folder', 'name')
      .sort(sort)
      .limit(parseInt(limit))
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await Document.countDocuments(query);

    res.json({
      success: true,
      data: {
        documents,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Share file with other users
router.post('/:documentId/share', auth, [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('permission').isIn(['view', 'edit', 'delete']).withMessage('Invalid permission')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user is owner
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only document owner can share files' });
    }

    await document.shareWith(req.body.userId, req.body.permission);
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove file sharing
router.delete('/:documentId/share/:userId', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user is owner
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only document owner can remove sharing' });
    }

    await document.removeShare(req.params.userId);
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update file permissions
router.put('/:documentId/share/:userId', auth, [
  body('permission').isIn(['view', 'edit', 'delete']).withMessage('Invalid permission')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user is owner
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only document owner can update permissions' });
    }

    await document.updatePermission(req.params.userId, req.body.permission);
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get shared files
router.get('/shared/with-me', auth, async (req, res) => {
  try {
    const documents = await Document.getSharedWithMe(req.user.id);
    
    res.json({
      success: true,
      data: documents
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Archive file
router.post('/:documentId/archive', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user is owner
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only document owner can archive files' });
    }

    await document.archive();
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Restore file
router.post('/:documentId/restore', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Check if user is owner
    if (document.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Only document owner can restore files' });
    }

    await document.restore();
    
    res.json({
      success: true,
      data: document
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get storage statistics
router.get('/storage/stats/:userId', auth, async (req, res) => {
  try {
    // Only allow users to access their own stats or admins to access any
    if (req.params.userId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' });
    }

    const stats = await Document.getStorageStats(req.params.userId);
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
