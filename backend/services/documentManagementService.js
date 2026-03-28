const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const pdfParse = require('pdf-parse');
const Document = require('../models/Document');
const DocumentFolder = require('../models/DocumentFolder');

class DocumentManagementService {
  // File Upload & Storage
  async uploadDocument(file, userId, options = {}) {
    try {
      const fileHash = this.generateFileHash(file.buffer);
      const existingFile = await Document.findOne({ fileHash });

      if (existingFile) {
        throw new Error('This file already exists in your documents');
      }

      const fileName = this.generateFileName(file.originalname);
      const fileExtension = path.extname(file.originalname).toLowerCase();
      const uploadsDir = path.join(__dirname, '../uploads', userId);

      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      const filePath = path.join(uploadsDir, fileName);
      fs.writeFileSync(filePath, file.buffer);

      // Generate thumbnail for images
      let thumbnailPath = null;
      if (this.isImage(file.mimetype)) {
        thumbnailPath = await this.generateThumbnail(filePath, fileName, userId);
      }

      // Extract preview text
      let previewText = '';
      if (this.isTextFile(file.mimetype)) {
        previewText = this.extractPreviewText(file.buffer, file.mimetype);
      } else if (this.isPDF(file.mimetype)) {
        previewText = await this.extractPDFText(file.buffer);
      }

      const documentData = {
        fileName,
        originalFileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileExtension,
        filePath: path.relative(uploadsDir, filePath),
        fileHash,
        user: userId,
        folder: options.folderId || null,
        relatedTo: options.relatedTo || 'general',
        relatedId: options.relatedId || null,
        documentType: options.documentType || this.guessDocumentType(file.originalname),
        tags: options.tags || [],
        description: options.description || '',
        thumbnailPath,
        previewText,
        isIndexed: true,
      };

      const document = new Document(documentData);
      await document.save();

      // Update folder document count
      if (options.folderId) {
        await this.updateFolderStats(options.folderId);
      }

      return {
        id: document._id,
        fileName: document.fileName,
        originalFileName: document.originalFileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        documentType: document.documentType,
        createdAt: document.createdAt,
      };
    } catch (error) {
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  async downloadDocument(documentId, userId) {
    try {
      const document = await Document.findById(documentId);

      if (!document) {
        throw new Error('Document not found');
      }

      if (
        !document.user.equals(userId) &&
        !this.hasShareAccess(document, userId)
      ) {
        throw new Error('Access denied');
      }

      const filePath = path.join(
        __dirname,
        '../uploads',
        document.user.toString(),
        document.filePath
      );

      if (!fs.existsSync(filePath)) {
        throw new Error('File not found on disk');
      }

      await document.incrementDownloadCount();

      return {
        filePath,
        fileName: document.originalFileName,
        mimeType: document.mimeType,
      };
    } catch (error) {
      throw new Error(`Download failed: ${error.message}`);
    }
  }

  // File Management
  async deleteDocument(documentId, userId) {
    try {
      const document = await Document.findById(documentId);

      if (!document || !document.user.equals(userId)) {
        throw new Error('Document not found or access denied');
      }

      const filePath = path.join(
        __dirname,
        '../uploads',
        userId.toString(),
        document.filePath
      );

      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (document.thumbnailPath) {
        const thumbPath = path.join(
          __dirname,
          '../uploads',
          userId.toString(),
          document.thumbnailPath
        );
        if (fs.existsSync(thumbPath)) {
          fs.unlinkSync(thumbPath);
        }
      }

      await Document.findByIdAndDelete(documentId);

      // Update folder stats
      if (document.folder) {
        await this.updateFolderStats(document.folder);
      }

      return { success: true, message: 'Document deleted' };
    } catch (error) {
      throw new Error(`Deletion failed: ${error.message}`);
    }
  }

  async renameDocument(documentId, newName, userId) {
    try {
      const document = await Document.findById(documentId);

      if (!document || !document.user.equals(userId)) {
        throw new Error('Document not found or access denied');
      }

      document.originalFileName = newName;
      await document.save();

      return { id: document._id, originalFileName: document.originalFileName };
    } catch (error) {
      throw new Error(`Rename failed: ${error.message}`);
    }
  }

  async moveDocument(documentId, targetFolderId, userId) {
    try {
      const document = await Document.findById(documentId);

      if (!document || !document.user.equals(userId)) {
        throw new Error('Document not found or access denied');
      }

      const oldFolderId = document.folder;
      document.folder = targetFolderId;
      await document.save();

      // Update folder stats
      if (oldFolderId) {
        await this.updateFolderStats(oldFolderId);
      }
      if (targetFolderId) {
        await this.updateFolderStats(targetFolderId);
      }

      return { id: document._id, folder: document.folder };
    } catch (error) {
      throw new Error(`Move failed: ${error.message}`);
    }
  }

  // Folder Management
  async createFolder(name, userId, options = {}) {
    try {
      const folder = new DocumentFolder({
        name,
        user: userId,
        parentFolder: options.parentFolderId || null,
        color: options.color || '#3b82f6',
        description: options.description || '',
      });

      await folder.save();

      return {
        id: folder._id,
        name: folder.name,
        color: folder.color,
        parentFolder: folder.parentFolder,
        createdAt: folder.createdAt,
      };
    } catch (error) {
      throw new Error(`Folder creation failed: ${error.message}`);
    }
  }

  async deleteFolder(folderId, userId) {
    try {
      const folder = await DocumentFolder.findById(folderId);

      if (!folder || !folder.user.equals(userId)) {
        throw new Error('Folder not found or access denied');
      }

      // Delete all documents in folder
      const documents = await Document.find({
        folder: folderId,
        user: userId,
      });

      for (const doc of documents) {
        await this.deleteDocument(doc._id, userId);
      }

      // Delete subfolders recursively
      const subfolders = await DocumentFolder.find({
        parentFolder: folderId,
      });

      for (const subfolder of subfolders) {
        await this.deleteFolder(subfolder._id, userId);
      }

      await DocumentFolder.findByIdAndDelete(folderId);

      // Update parent folder stats
      if (folder.parentFolder) {
        await this.updateFolderStats(folder.parentFolder);
      }

      return { success: true, message: 'Folder deleted' };
    } catch (error) {
      throw new Error(`Folder deletion failed: ${error.message}`);
    }
  }

  async renameFolder(folderId, newName, userId) {
    try {
      const folder = await DocumentFolder.findById(folderId);

      if (!folder || !folder.user.equals(userId)) {
        throw new Error('Folder not found or access denied');
      }

      folder.name = newName;
      await folder.save();

      return { id: folder._id, name: folder.name };
    } catch (error) {
      throw new Error(`Rename failed: ${error.message}`);
    }
  }

  async moveFolderToParent(folderId, parentFolderId, userId) {
    try {
      const folder = await DocumentFolder.findById(folderId);

      if (!folder || !folder.user.equals(userId)) {
        throw new Error('Folder not found or access denied');
      }

      // Check for circular reference
      if (parentFolderId) {
        let parent = await DocumentFolder.findById(parentFolderId);
        while (parent) {
          if (parent._id.equals(folderId)) {
            throw new Error('Cannot move folder to its own child');
          }
          parent = parent.parentFolder
            ? await DocumentFolder.findById(parent.parentFolder)
            : null;
        }
      }

      folder.parentFolder = parentFolderId;
      await folder.save();

      return { id: folder._id, parentFolder: folder.parentFolder };
    } catch (error) {
      throw new Error(`Move failed: ${error.message}`);
    }
  }

  // Search & Retrieval
  async searchDocuments(userId, query, filters = {}, pagination = {}) {
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 10;
      const skip = (page - 1) * limit;

      const documents = await Document.searchDocuments(userId, query, filters)
        .skip(skip)
        .limit(limit);

      const total = await Document.countDocuments({
        user: userId,
        status: 'active',
        $or: [
          { fileName: new RegExp(query, 'i') },
          { originalFileName: new RegExp(query, 'i') },
          { description: new RegExp(query, 'i') },
        ],
      });

      return {
        documents: documents.map(this.formatDocument),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Search failed: ${error.message}`);
    }
  }

  async getFolderContents(folderId, userId, pagination = {}) {
    try {
      const page = pagination.page || 1;
      const limit = pagination.limit || 20;
      const skip = (page - 1) * limit;

      const folder = await DocumentFolder.findById(folderId);
      if (folder && !folder.user.equals(userId)) {
        throw new Error('Access denied');
      }

      const documents = await Document.find({
        user: userId,
        folder: folderId,
        status: 'active',
      })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);

      const subfolders = await DocumentFolder.find({
        parentFolder: folderId,
        user: userId,
        status: 'active',
      }).sort({ name: 1 });

      const total = await Document.countDocuments({
        user: userId,
        folder: folderId,
        status: 'active',
      });

      return {
        documents: documents.map(this.formatDocument),
        subfolders: subfolders.map((f) => ({
          id: f._id,
          name: f.name,
          color: f.color,
          icon: f.icon,
          documentCount: f.documentCount,
          totalSize: f.totalSize,
        })),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
        },
      };
    } catch (error) {
      throw new Error(`Failed to get folder contents: ${error.message}`);
    }
  }

  async getRootFolders(userId) {
    try {
      const folders = await DocumentFolder.find({
        user: userId,
        parentFolder: null,
        status: 'active',
      }).sort({ name: 1 });

      return folders.map((f) => ({
        id: f._id,
        name: f.name,
        color: f.color,
        icon: f.icon,
        documentCount: f.documentCount,
        totalSize: f.totalSize,
        isDefault: f.isDefault,
      }));
    } catch (error) {
      throw new Error(`Failed to get root folders: ${error.message}`);
    }
  }

  async getStorageStats(userId) {
    try {
      const stats = await Document.getStorageStats(userId);
      return stats;
    } catch (error) {
      throw new Error(`Failed to get storage stats: ${error.message}`);
    }
  }

  // Sharing
  async shareDocument(documentId, targetUserId, permission, userId) {
    try {
      const document = await Document.findById(documentId);

      if (!document || !document.user.equals(userId)) {
        throw new Error('Document not found or access denied');
      }

      await document.shareWith(targetUserId, permission);

      return { id: document._id, sharedWith: document.sharedWith };
    } catch (error) {
      throw new Error(`Share failed: ${error.message}`);
    }
  }

  async removeShare(documentId, targetUserId, userId) {
    try {
      const document = await Document.findById(documentId);

      if (!document || !document.user.equals(userId)) {
        throw new Error('Document not found or access denied');
      }

      await document.removeShare(targetUserId);

      return { id: document._id, sharedWith: document.sharedWith };
    } catch (error) {
      throw new Error(`Remove share failed: ${error.message}`);
    }
  }

  async getSharedDocuments(userId) {
    try {
      const documents = await Document.getSharedWithMe(userId);
      return documents.map(this.formatDocument);
    } catch (error) {
      throw new Error(`Failed to get shared documents: ${error.message}`);
    }
  }

  // Helper Methods
  generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  generateFileName(originalName) {
    const timestamp = Date.now();
    const randomStr = Math.random().toString(36).substring(7);
    const ext = path.extname(originalName);
    return `${timestamp}-${randomStr}${ext}`;
  }

  async generateThumbnail(filePath, fileName, userId) {
    try {
      const thumbDir = path.join(
        path.dirname(filePath),
        'thumbnails'
      );

      if (!fs.existsSync(thumbDir)) {
        fs.mkdirSync(thumbDir, { recursive: true });
      }

      const thumbFileName = `thumb-${fileName}`;
      const thumbPath = path.join(thumbDir, thumbFileName);

      await sharp(filePath).resize(200, 200, { fit: 'cover' }).toFile(thumbPath);

      return path.join('thumbnails', thumbFileName);
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      return null;
    }
  }

  isImage(mimeType) {
    return mimeType.startsWith('image/');
  }

  isPDF(mimeType) {
    return mimeType === 'application/pdf';
  }

  isTextFile(mimeType) {
    return (
      mimeType.includes('text') ||
      mimeType === 'application/json' ||
      mimeType === 'application/xml'
    );
  }

  extractPreviewText(buffer, mimeType) {
    try {
      const text = buffer.toString('utf-8');
      return text.substring(0, 500);
    } catch (error) {
      return '';
    }
  }

  async extractPDFText(buffer) {
    try {
      const pdf = await pdfParse(buffer);
      return pdf.text.substring(0, 500);
    } catch (error) {
      return '';
    }
  }

  guessDocumentType(fileName) {
    const name = fileName.toLowerCase();
    if (
      name.includes('invoice') ||
      name.includes('receipt') ||
      name.includes('bill')
    ) {
      return 'invoice';
    }
    if (name.includes('medical') || name.includes('health')) {
      return 'medical-report';
    }
    if (name.includes('prescription')) {
      return 'prescription';
    }
    if (
      name.includes('id') ||
      name.includes('passport') ||
      name.includes('license')
    ) {
      return 'id-proof';
    }
    if (name.includes('insurance')) {
      return 'insurance-card';
    }
    if (name.includes('tax') || name.includes('1040')) {
      return 'tax-document';
    }
    if (name.includes('contract') || name.includes('agreement')) {
      return 'contract';
    }
    return 'other';
  }

  formatDocument(doc) {
    return {
      id: doc._id,
      fileName: doc.fileName,
      originalFileName: doc.originalFileName,
      fileSize: doc.fileSize,
      mimeType: doc.mimeType,
      documentType: doc.documentType,
      tags: doc.tags,
      description: doc.description,
      downloadCount: doc.downloadCount,
      thumbnailPath: doc.thumbnailPath,
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
      lastAccessedAt: doc.lastAccessedAt,
    };
  }

  hasShareAccess(document, userId) {
    return document.sharedWith.some((s) => s.user.equals(userId));
  }

  async updateFolderStats(folderId) {
    try {
      const folder = await DocumentFolder.findById(folderId);
      if (!folder) return;

      const stats = await Document.aggregate([
        { $match: { folder: new mongoose.Types.ObjectId(folderId) } },
        {
          $group: {
            _id: null,
            count: { $sum: 1 },
            totalSize: { $sum: '$fileSize' },
          },
        },
      ]);

      folder.documentCount = stats[0]?.count || 0;
      folder.totalSize = stats[0]?.totalSize || 0;
      await folder.save();
    } catch (error) {
      console.error('Error updating folder stats:', error);
    }
  }
}

module.exports = new DocumentManagementService();
