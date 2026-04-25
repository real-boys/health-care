const express = require('express');
const multer = require('multer');
const auth = require('../middleware/auth');
const Document = require('../models/Document');
const DocumentFolder = require('../models/DocumentFolder');
const documentManagementService = require('../services/documentManagementService');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    // Block dangerous files
    const blockedMimes = [
      'application/x-msdownload',
      'application/x-msdos-program',
      'application/x-executable',
    ];
    if (blockedMimes.includes(file.mimetype)) {
      cb(new Error('File type not allowed'));
    } else {
      cb(null, true);
    }
  },
});

// DOCUMENT UPLOAD
router.post('/upload', auth, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ success: false, message: 'No file provided' });
    }

    const options = {
      folderId: req.body.folderId || null,
      documentType: req.body.documentType || null,
      description: req.body.description || '',
      tags: (req.body.tags && JSON.parse(req.body.tags)) || [],
      relatedTo: req.body.relatedTo || 'general',
      relatedId: req.body.relatedId || null,
    };

    const document = await documentManagementService.uploadDocument(
      req.file,
      req.user.id,
      options
    );

    res.json({ success: true, data: document });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DOCUMENT DOWNLOAD
router.get('/download/:id', auth, async (req, res) => {
  try {
    const downloadInfo = await documentManagementService.downloadDocument(
      req.params.id,
      req.user.id
    );

    res.download(downloadInfo.filePath, downloadInfo.fileName);
  } catch (error) {
    res
      .status(404)
      .json({
        success: false,
        message: error.message || 'Download failed',
      });
  }
});

// GET DOCUMENT PREVIEW
router.get('/preview/:id', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ success: false, message: 'Not found' });
    }

    if (
      !document.user.equals(req.user.id) &&
      !documentManagementService.hasShareAccess(document, req.user.id)
    ) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    await document.addViewer(req.user.id);

    res.json({
      success: true,
      data: {
        id: document._id,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        mimeType: document.mimeType,
        fileSize: document.fileSize,
        documentType: document.documentType,
        description: document.description,
        tags: document.tags,
        previewText: document.previewText,
        thumbnailPath: document.thumbnailPath,
        createdAt: document.createdAt,
        downloadCount: document.downloadCount,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// LIST DOCUMENTS (with pagination)
router.get('/list', auth, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const folderId = req.query.folderId || null;

    let query = { user: req.user.id, status: 'active' };
    if (folderId) {
      query.folder = folderId;
    }

    const documents = await Document.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    const total = await Document.countDocuments(query);

    res.json({
      success: true,
      data: documents.map(documentManagementService.formatDocument),
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SEARCH DOCUMENTS
router.get('/search', auth, async (req, res) => {
  try {
    const query = req.query.q || '';
    const filters = {
      documentType: req.query.documentType || null,
      relatedTo: req.query.relatedTo || null,
      createdAfter: req.query.createdAfter || null,
      createdBefore: req.query.createdBefore || null,
    };

    const result = await documentManagementService.searchDocuments(
      req.user.id,
      query,
      filters,
      {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 10,
      }
    );

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE DOCUMENT
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await documentManagementService.deleteDocument(
      req.params.id,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// RENAME DOCUMENT
router.put('/:id/rename', auth, async (req, res) => {
  try {
    const result = await documentManagementService.renameDocument(
      req.params.id,
      req.body.newName,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// MOVE DOCUMENT
router.put('/:id/move', auth, async (req, res) => {
  try {
    const result = await documentManagementService.moveDocument(
      req.params.id,
      req.body.targetFolderId,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// UPDATE DOCUMENT METADATA
router.put('/:id/metadata', auth, async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document || !document.user.equals(req.user.id)) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    if (req.body.description) document.description = req.body.description;
    if (req.body.tags) document.tags = req.body.tags;
    if (req.body.documentType) document.documentType = req.body.documentType;

    await document.save();

    res.json({
      success: true,
      data: documentManagementService.formatDocument(document),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// FOLDER MANAGEMENT

// CREATE FOLDER
router.post('/folder/create', auth, async (req, res) => {
  try {
    const result = await documentManagementService.createFolder(
      req.body.name,
      req.user.id,
      {
        parentFolderId: req.body.parentFolderId || null,
        color: req.body.color || '#3b82f6',
        description: req.body.description || '',
      }
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// LIST ROOT FOLDERS
router.get('/folders/root', auth, async (req, res) => {
  try {
    const folders = await documentManagementService.getRootFolders(
      req.user.id
    );

    res.json({ success: true, data: folders });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET FOLDER CONTENTS
router.get('/folder/:id/contents', auth, async (req, res) => {
  try {
    const result = await documentManagementService.getFolderContents(
      req.params.id,
      req.user.id,
      {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
      }
    );

    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE FOLDER
router.delete('/folder/:id', auth, async (req, res) => {
  try {
    const result = await documentManagementService.deleteFolder(
      req.params.id,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// RENAME FOLDER
router.put('/folder/:id/rename', auth, async (req, res) => {
  try {
    const result = await documentManagementService.renameFolder(
      req.params.id,
      req.body.newName,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// MOVE FOLDER
router.put('/folder/:id/move', auth, async (req, res) => {
  try {
    const result = await documentManagementService.moveFolderToParent(
      req.params.id,
      req.body.parentFolderId,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// SHARING

// SHARE DOCUMENT
router.post('/:id/share', auth, async (req, res) => {
  try {
    const result = await documentManagementService.shareDocument(
      req.params.id,
      req.body.targetUserId,
      req.body.permission || 'view',
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// REMOVE SHARE
router.delete('/:id/share/:userId', auth, async (req, res) => {
  try {
    const result = await documentManagementService.removeShare(
      req.params.id,
      req.params.userId,
      req.user.id
    );

    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET SHARED DOCUMENTS
router.get('/shared/documents', auth, async (req, res) => {
  try {
    const documents = await documentManagementService.getSharedDocuments(
      req.user.id
    );

    res.json({ success: true, data: documents });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// STORAGE STATS
router.get('/stats/storage', auth, async (req, res) => {
  try {
    const stats = await documentManagementService.getStorageStats(
      req.user.id
    );

    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
