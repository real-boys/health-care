const AWS = require('aws-sdk');
const crypto = require('crypto');
const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const Document = require('../models/Document');
const AuditLog = require('../models/AuditLog');
const winston = require('winston');

class FileStorageService {
  constructor() {
    this.logger = winston.createLogger({
      level: 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.File({ filename: 'logs/file-storage.log' }),
        new winston.transports.Console()
      ]
    });

    // Initialize AWS S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // Initialize CloudFront
    this.cloudfront = new AWS.CloudFront({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    this.bucketName = process.env.AWS_S3_BUCKET;
    this.cloudfrontDomain = process.env.AWS_CLOUDFRONT_DOMAIN;
    this.allowedFileTypes = this.getAllowedFileTypes();
    this.maxFileSize = this.getMaxFileSize();
  }

  getAllowedFileTypes() {
    return [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain', 'text/csv', 'text/html', 'text/css', 'text/javascript',
      'application/zip', 'application/x-rar-compressed', 'application/x-7z-compressed'
    ];
  }

  getMaxFileSize() {
    return 100 * 1024 * 1024; // 100MB
  }

  async uploadFile(file, metadata = {}) {
    try {
      // Validate file
      this.validateFile(file);

      // Generate file hash and unique key
      const fileHash = await this.generateFileHash(file.buffer);
      const uniqueKey = this.generateUniqueKey(file.originalname, fileHash);

      // Optimize image if applicable
      const optimizedBuffer = await this.optimizeImage(file.buffer, file.mimetype);

      // Upload to S3
      const uploadResult = await this.uploadToS3(uniqueKey, optimizedBuffer, file.mimetype, metadata);

      // Create document record
      const document = await this.createDocumentRecord(file, uniqueKey, fileHash, uploadResult, metadata);

      // Log audit trail
      await this.logFileUpload(document, metadata);

      this.logger.info(`File uploaded successfully: ${uniqueKey}`);
      
      return {
        success: true,
        document,
        url: this.generateFileUrl(uniqueKey),
        cdnUrl: this.generateCDNUrl(uniqueKey)
      };
    } catch (error) {
      this.logger.error('File upload failed:', error);
      throw error;
    }
  }

  validateFile(file) {
    if (!file || !file.buffer || !file.originalname || !file.mimetype) {
      throw new Error('Invalid file object');
    }

    if (!this.allowedFileTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }

    if (file.size > this.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.maxFileSize / 1024 / 1024}MB`);
    }
  }

  async generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  generateUniqueKey(originalName, fileHash) {
    const ext = path.extname(originalName);
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 8);
    return `files/${timestamp}/${random}-${fileHash.substr(0, 16)}${ext}`;
  }

  async optimizeImage(buffer, mimeType) {
    if (!mimeType.startsWith('image/')) {
      return buffer;
    }

    try {
      // Skip optimization for SVG files
      if (mimeType === 'image/svg+xml') {
        return buffer;
      }

      let image = sharp(buffer);
      const metadata = await image.metadata();

      // Auto-orient based on EXIF data
      image = image.rotate();

      // Resize if too large (max 2048px on either dimension)
      if (metadata.width > 2048 || metadata.height > 2048) {
        image = image.resize(2048, 2048, {
          fit: 'inside',
          withoutEnlargement: true
        });
      }

      // Optimize based on format
      if (mimeType === 'image/jpeg') {
        image = image.jpeg({ quality: 85, progressive: true });
      } else if (mimeType === 'image/png') {
        image = image.png({ compressionLevel: 8, progressive: true });
      } else if (mimeType === 'image/webp') {
        image = image.webp({ quality: 85 });
      }

      return await image.toBuffer();
    } catch (error) {
      this.logger.warn('Image optimization failed, using original:', error);
      return buffer;
    }
  }

  async uploadToS3(key, buffer, contentType, metadata = {}) {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType,
      Metadata: {
        originalName: metadata.originalName || '',
        uploadedBy: metadata.uploadedBy || '',
        documentType: metadata.documentType || 'general',
        ...metadata
      },
      ServerSideEncryption: 'AES256',
      StorageClass: 'STANDARD_IA' // Infrequent Access for cost optimization
    };

    // Add versioning if enabled
    if (process.env.AWS_S3_VERSIONING === 'true') {
      params.VersionId = metadata.versionId;
    }

    const result = await this.s3.upload(params).promise();
    
    // Create backup if specified
    if (process.env.AWS_S3_BACKUP_ENABLED === 'true') {
      await this.createBackup(key, buffer, contentType, metadata);
    }

    return result;
  }

  async createBackup(key, buffer, contentType, metadata) {
    const backupKey = `backup/${key}`;
    const backupParams = {
      Bucket: process.env.AWS_S3_BACKUP_BUCKET || this.bucketName,
      Key: backupKey,
      Body: buffer,
      ContentType: contentType,
      Metadata: metadata,
      ServerSideEncryption: 'AES256',
      StorageClass: 'GLACIER' // Cold storage for backups
    };

    try {
      await this.s3.upload(backupParams).promise();
      this.logger.info(`Backup created: ${backupKey}`);
    } catch (error) {
      this.logger.error('Backup creation failed:', error);
    }
  }

  async createDocumentRecord(file, key, fileHash, uploadResult, metadata) {
    const documentData = {
      fileName: this.generateSafeFileName(file.originalname),
      originalFileName: file.originalname,
      fileSize: file.size,
      mimeType: file.mimetype,
      fileExtension: path.extname(file.originalname),
      filePath: key,
      storageType: 'aws-s3',
      fileHash: fileHash,
      user: metadata.userId,
      folder: metadata.folderId || null,
      relatedTo: metadata.relatedTo || 'general',
      relatedId: metadata.relatedId || null,
      documentType: metadata.documentType || 'other',
      tags: metadata.tags || [],
      description: metadata.description || '',
      isPublic: metadata.isPublic || false,
      sharedWith: metadata.sharedWith || []
    };

    return await Document.create(documentData);
  }

  generateSafeFileName(originalName) {
    const ext = path.extname(originalName);
    const name = path.basename(originalName, ext);
    // Remove special characters and replace with underscores
    return name.replace(/[^a-zA-Z0-9]/g, '_') + ext;
  }

  async logFileUpload(document, metadata) {
    const auditData = {
      action: 'upload',
      resourceType: 'document',
      resourceId: document._id,
      userId: metadata.userId,
      userRole: metadata.userRole || 'user',
      details: {
        description: `File uploaded: ${document.originalFileName}`,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        storageType: document.storageType,
        ipAddress: metadata.ipAddress,
        userAgent: metadata.userAgent,
        sessionId: metadata.sessionId
      },
      outcome: 'success',
      riskLevel: this.assessFileRisk(document),
      compliance: {
        dataAccessed: ['file'],
        piiAccessed: this.containsPII(document.fileName),
        phiAccessed: this.containsPHI(document.fileName),
        financialAccessed: this.containsFinancialData(document.fileName),
        requiresReview: document.fileSize > 10 * 1024 * 1024 // Files > 10MB require review
      }
    };

    await AuditLog.createLog(auditData);
  }

  assessFileRisk(document) {
    let riskScore = 0;

    // Risk based on file size
    if (document.fileSize > 50 * 1024 * 1024) riskScore += 2; // > 50MB
    else if (document.fileSize > 10 * 1024 * 1024) riskScore += 1; // > 10MB

    // Risk based on file type
    const highRiskTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (highRiskTypes.includes(document.mimeType)) riskScore += 1;

    // Risk based on content
    if (this.containsPII(document.fileName)) riskScore += 2;
    if (this.containsPHI(document.fileName)) riskScore += 3;
    if (this.containsFinancialData(document.fileName)) riskScore += 2;

    // Convert score to risk level
    if (riskScore >= 5) return 'critical';
    if (riskScore >= 3) return 'high';
    if (riskScore >= 1) return 'medium';
    return 'low';
  }

  containsPII(fileName) {
    const piiKeywords = ['ssn', 'social', 'security', 'driver', 'license', 'passport', 'id'];
    return piiKeywords.some(keyword => fileName.toLowerCase().includes(keyword));
  }

  containsPHI(fileName) {
    const phiKeywords = ['medical', 'health', 'patient', 'diagnosis', 'treatment', 'prescription'];
    return phiKeywords.some(keyword => fileName.toLowerCase().includes(keyword));
  }

  containsFinancialData(fileName) {
    const financialKeywords = ['invoice', 'payment', 'bank', 'statement', 'tax', 'receipt'];
    return financialKeywords.some(keyword => fileName.toLowerCase().includes(keyword));
  }

  async getFile(documentId, userId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check access permissions
      if (!await this.hasFileAccess(document, userId)) {
        throw new Error('Access denied');
      }

      // Generate signed URL for S3
      const signedUrl = await this.generateSignedUrl(document.filePath);
      
      // Log file access
      await this.logFileAccess(document, userId);

      // Update document stats
      await document.incrementDownloadCount();
      await document.addViewer(userId);

      return {
        success: true,
        document,
        url: signedUrl,
        cdnUrl: this.generateCDNUrl(document.filePath)
      };
    } catch (error) {
      this.logger.error('File retrieval failed:', error);
      throw error;
    }
  }

  async hasFileAccess(document, userId) {
    // Owner has access
    if (document.user.toString() === userId.toString()) {
      return true;
    }

    // Check if shared with user
    const sharedAccess = document.sharedWith.find(
      share => share.user.toString() === userId.toString()
    );
    
    return !!sharedAccess;
  }

  async generateSignedUrl(key, expiresIn = 3600) {
    const params = {
      Bucket: this.bucketName,
      Key: key,
      Expires: expiresIn
    };

    return this.s3.getSignedUrl('getObject', params);
  }

  generateFileUrl(key) {
    return `https://${this.bucketName}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  generateCDNUrl(key) {
    if (!this.cloudfrontDomain) {
      return this.generateFileUrl(key);
    }
    return `https://${this.cloudfrontDomain}/${key}`;
  }

  async generateCDNSignedUrl(key, expiresIn = 3600) {
    if (!this.cloudfrontDomain) {
      return this.generateSignedUrl(key, expiresIn);
    }

    const cloudfrontSign = require('aws-cloudfront-sign');
    
    const signedUrl = cloudfrontSign.getSignedUrl(
      `https://${this.cloudfrontDomain}/${key}`,
      {
        keypairId: process.env.AWS_CLOUDFRONT_KEY_PAIR_ID,
        privateKeyString: process.env.AWS_CLOUDFRONT_PRIVATE_KEY,
        expireTime: new Date(Date.now() + expiresIn * 1000)
      }
    );

    return signedUrl;
  }

  async logFileAccess(document, userId) {
    const auditData = {
      action: 'download',
      resourceType: 'document',
      resourceId: document._id,
      userId: userId,
      userRole: 'user', // Would need to fetch from user model
      details: {
        description: `File accessed: ${document.originalFileName}`,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        downloadCount: document.downloadCount + 1
      },
      outcome: 'success',
      riskLevel: 'low',
      compliance: {
        dataAccessed: ['file'],
        piiAccessed: this.containsPII(document.fileName),
        phiAccessed: this.containsPHI(document.fileName),
        financialAccessed: this.containsFinancialData(document.fileName)
      }
    };

    await AuditLog.createLog(auditData);
  }

  async deleteFile(documentId, userId) {
    try {
      const document = await Document.findById(documentId);
      if (!document) {
        throw new Error('Document not found');
      }

      // Check permissions
      if (document.user.toString() !== userId.toString()) {
        throw new Error('Access denied');
      }

      // Delete from S3
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: document.filePath
      }).promise();

      // Delete backup if exists
      if (process.env.AWS_S3_BACKUP_ENABLED === 'true') {
        try {
          await this.s3.deleteObject({
            Bucket: process.env.AWS_S3_BACKUP_BUCKET || this.bucketName,
            Key: `backup/${document.filePath}`
          }).promise();
        } catch (error) {
          this.logger.warn('Backup deletion failed:', error);
        }
      }

      // Soft delete document record
      await document.softDelete();

      // Log deletion
      await this.logFileDeletion(document, userId);

      this.logger.info(`File deleted successfully: ${document.filePath}`);
      
      return { success: true };
    } catch (error) {
      this.logger.error('File deletion failed:', error);
      throw error;
    }
  }

  async logFileDeletion(document, userId) {
    const auditData = {
      action: 'delete',
      resourceType: 'document',
      resourceId: document._id,
      userId: userId,
      userRole: 'user',
      details: {
        description: `File deleted: ${document.originalFileName}`,
        fileName: document.fileName,
        fileSize: document.fileSize,
        mimeType: document.mimeType,
        storageType: document.storageType
      },
      outcome: 'success',
      riskLevel: 'medium',
      compliance: {
        dataAccessed: ['file'],
        piiAccessed: this.containsPII(document.fileName),
        phiAccessed: this.containsPHI(document.fileName),
        financialAccessed: this.containsFinancialData(document.fileName)
      }
    };

    await AuditLog.createLog(auditData);
  }

  async getFileAnalytics(userId, filters = {}) {
    try {
      const stats = await Document.getStorageStats(userId);
      
      // Get additional analytics
      const recentFiles = await Document.getRecentlyViewed(userId, 10);
      const mostDownloaded = await Document.getMostDownloaded(userId, 10);
      const sharedWithMe = await Document.getSharedWithMe(userId);

      // Get storage usage trends
      const storageTrends = await this.getStorageTrends(userId, 30);

      return {
        storageStats: stats,
        recentFiles,
        mostDownloaded,
        sharedWithMe,
        storageTrends,
        totalFiles: stats.summary.totalFiles || 0,
        totalSize: stats.summary.totalSize || 0,
        totalDownloads: stats.summary.totalDownloads || 0
      };
    } catch (error) {
      this.logger.error('Failed to get file analytics:', error);
      throw error;
    }
  }

  async getStorageTrends(userId, days) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const trends = await Document.aggregate([
      {
        $match: {
          user: mongoose.Types.ObjectId(userId),
          createdAt: { $gte: startDate },
          status: 'active'
        }
      },
      {
        $group: {
          _id: {
            date: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
            documentType: '$documentType'
          },
          count: { $sum: 1 },
          totalSize: { $sum: '$fileSize' }
        }
      },
      {
        $project: {
          date: '$_id.date',
          documentType: '$_id.documentType',
          count: 1,
          totalSize: 1,
          _id: 0
        }
      },
      {
        $sort: { date: 1, documentType: 1 }
      }
    ]);

    return trends;
  }

  async createFileVersion(documentId, newFile, metadata = {}) {
    try {
      const originalDocument = await Document.findById(documentId);
      if (!originalDocument) {
        throw new Error('Original document not found');
      }

      // Check permissions
      if (originalDocument.user.toString() !== metadata.userId.toString()) {
        throw new Error('Access denied');
      }

      // Upload new version
      const uploadResult = await this.uploadFile(newFile, {
        ...metadata,
        relatedTo: originalDocument.relatedTo,
        relatedId: originalDocument.relatedId,
        documentType: originalDocument.documentType,
        tags: originalDocument.tags,
        description: originalDocument.description
      });

      // Link versions
      await Document.findByIdAndUpdate(documentId, {
        $push: {
          versions: {
            documentId: uploadResult.document._id,
            createdAt: new Date(),
            createdBy: metadata.userId,
            version: originalDocument.versions ? originalDocument.versions.length + 1 : 1
          }
        }
      });

      // Log version creation
      await this.logFileVersionCreation(originalDocument, uploadResult.document, metadata);

      return uploadResult;
    } catch (error) {
      this.logger.error('File version creation failed:', error);
      throw error;
    }
  }

  async logFileVersionCreation(originalDocument, newVersion, metadata) {
    const auditData = {
      action: 'create',
      resourceType: 'document',
      resourceId: newVersion._id,
      userId: metadata.userId,
      userRole: 'user',
      details: {
        description: `New version created for: ${originalDocument.originalFileName}`,
        originalDocumentId: originalDocument._id,
        newDocumentId: newVersion._id,
        version: newVersion.versions ? newVersion.versions.length : 1
      },
      outcome: 'success',
      riskLevel: 'low'
    };

    await AuditLog.createLog(auditData);
  }
}

module.exports = new FileStorageService();
