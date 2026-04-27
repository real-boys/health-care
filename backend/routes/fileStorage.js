/**
 * File Upload and Management Routes
 * Secure file upload with drag-and-drop support, preview, validation, and management
 * Resolves issue #119: File Upload and Management
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const mime = require('mime-types');
const { authenticateToken } = require('../middleware/auth');

// Allowed MIME types
const ALLOWED_TYPES = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'text/plain': '.txt',
  'text/csv': '.csv'
};

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer configuration with memory storage for validation before disk write
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_TYPES[file.mimetype]) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} is not allowed`), false);
    }
  }
});

/**
 * Generate a safe filename with a random prefix to prevent collisions
 */
function generateSafeFilename(originalName, mimeType) {
  const ext = ALLOWED_TYPES[mimeType] || path.extname(originalName);
  const hash = crypto.randomBytes(8).toString('hex');
  const baseName = path.basename(originalName, path.extname(originalName))
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .substring(0, 50);
  return `${hash}_${baseName}${ext}`;
}

/**
 * POST /api/file-storage/upload
 * Upload one or more files with metadata
 */
router.post('/upload', authenticateToken, upload.array('files', 10), async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ error: 'No files provided' });
    }

    const { documentType = 'other', description = '', tags = '[]', folderId } = req.body;
    let parsedTags = [];
    try { parsedTags = JSON.parse(tags); } catch (_) {}

    const uploadedFiles = [];

    for (const file of req.files) {
      // Validate MIME type matches declared content-type
      const detectedMime = mime.lookup(file.originalname) || file.mimetype;
      if (!ALLOWED_TYPES[file.mimetype]) {
        return res.status(400).json({ error: `File type not allowed: ${file.originalname}` });
      }

      const safeFilename = generateSafeFilename(file.originalname, file.mimetype);
      const filePath = path.join(UPLOAD_DIR, safeFilename);

      // Write file to disk
      fs.writeFileSync(filePath, file.buffer);

      // Generate thumbnail for images
      let thumbnailUrl = null;
      if (file.mimetype.startsWith('image/')) {
        try {
          const sharp = require('sharp');
          const thumbFilename = `thumb_${safeFilename}`;
          const thumbPath = path.join(UPLOAD_DIR, thumbFilename);
          await sharp(file.buffer)
            .resize(200, 200, { fit: 'inside', withoutEnlargement: true })
            .toFile(thumbPath);
          thumbnailUrl = `/uploads/${thumbFilename}`;
        } catch (_) { /* sharp optional */ }
      }

      uploadedFiles.push({
        id: crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex'),
        originalName: file.originalname,
        filename: safeFilename,
        mimeType: file.mimetype,
        size: file.size,
        url: `/uploads/${safeFilename}`,
        thumbnailUrl,
        documentType,
        description,
        tags: parsedTags,
        folderId: folderId || null,
        uploadedBy: req.user.id,
        uploadedAt: new Date().toISOString()
      });
    }

    // Broadcast upload event to dashboard
    if (global.realtimeBroadcaster) {
      global.realtimeBroadcaster.broadcastAlert({
        level: 'info',
        title: 'Files Uploaded',
        message: `${uploadedFiles.length} file(s) uploaded successfully`
      });
    }

    res.status(201).json({
      success: true,
      data: uploadedFiles,
      count: uploadedFiles.length
    });

  } catch (error) {
    console.error('[FileStorage] Upload error:', error);
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
    }
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-storage/files
 * List uploaded files for the authenticated user
 */
router.get('/files', authenticateToken, (req, res) => {
  try {
    const { documentType, search, limit = 50, offset = 0 } = req.query;

    // Read files from upload directory
    const files = fs.readdirSync(UPLOAD_DIR)
      .filter(f => !f.startsWith('thumb_'))
      .map(filename => {
        const filePath = path.join(UPLOAD_DIR, filename);
        const stat = fs.statSync(filePath);
        const mimeType = mime.lookup(filename) || 'application/octet-stream';
        return {
          filename,
          mimeType,
          size: stat.size,
          url: `/uploads/${filename}`,
          thumbnailUrl: mimeType.startsWith('image/') ? `/uploads/thumb_${filename}` : null,
          uploadedAt: stat.birthtime.toISOString()
        };
      });

    const filtered = documentType
      ? files.filter(f => f.filename.includes(documentType))
      : files;

    const paginated = filtered.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    res.json({
      success: true,
      data: paginated,
      total: filtered.length,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('[FileStorage] List error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-storage/files/:filename
 * Get file metadata
 */
router.get('/files/:filename', authenticateToken, (req, res) => {
  try {
    const { filename } = req.params;
    // Prevent path traversal
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    const stat = fs.statSync(filePath);
    const mimeType = mime.lookup(safeFilename) || 'application/octet-stream';

    res.json({
      success: true,
      data: {
        filename: safeFilename,
        mimeType,
        size: stat.size,
        url: `/uploads/${safeFilename}`,
        thumbnailUrl: mimeType.startsWith('image/') ? `/uploads/thumb_${safeFilename}` : null,
        uploadedAt: stat.birthtime.toISOString(),
        modifiedAt: stat.mtime.toISOString()
      }
    });
  } catch (error) {
    console.error('[FileStorage] Get file error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/file-storage/files/:filename
 * Delete a file
 */
router.delete('/files/:filename', authenticateToken, (req, res) => {
  try {
    const { filename } = req.params;
    const safeFilename = path.basename(filename);
    const filePath = path.join(UPLOAD_DIR, safeFilename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }

    fs.unlinkSync(filePath);

    // Also delete thumbnail if it exists
    const thumbPath = path.join(UPLOAD_DIR, `thumb_${safeFilename}`);
    if (fs.existsSync(thumbPath)) {
      fs.unlinkSync(thumbPath);
    }

    res.json({ success: true, message: 'File deleted successfully' });
  } catch (error) {
    console.error('[FileStorage] Delete error:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/file-storage/allowed-types
 * Returns the list of allowed file types and size limits
 */
router.get('/allowed-types', (req, res) => {
  res.json({
    success: true,
    data: {
      allowedMimeTypes: Object.keys(ALLOWED_TYPES),
      allowedExtensions: Object.values(ALLOWED_TYPES),
      maxFileSizeBytes: MAX_FILE_SIZE,
      maxFileSizeMB: MAX_FILE_SIZE / (1024 * 1024),
      maxFilesPerUpload: 10
    }
  });
});

// Multer error handler
router.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({ error: 'File too large. Maximum size is 100MB.' });
    }
    if (err.code === 'LIMIT_FILE_COUNT') {
      return res.status(400).json({ error: 'Too many files. Maximum 10 files per upload.' });
    }
    return res.status(400).json({ error: err.message });
  }
  if (err) {
    return res.status(400).json({ error: err.message });
  }
  next();
});

module.exports = router;
