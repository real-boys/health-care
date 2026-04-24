const AWS = require('aws-sdk');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const { promisify } = require('util');
const winston = require('winston');
const mime = require('mime-types');
const archiver = require('archiver');

class FileStorageService {
  constructor(options = {}) {
    this.config = {
      awsRegion: options.awsRegion || process.env.AWS_REGION || 'us-east-1',
      s3Bucket: options.s3Bucket || process.env.S3_BUCKET,
      s3AccessKey: options.s3AccessKey || process.env.AWS_ACCESS_KEY_ID,
      s3SecretKey: options.s3SecretKey || process.env.AWS_SECRET_ACCESS_KEY,
      cloudFrontDistribution: options.cloudFrontDistribution || process.env.CLOUDFRONT_DISTRIBUTION_ID,
      cloudFrontDomain: options.cloudFrontDomain || process.env.CLOUDFRONT_DOMAIN,
      encryptionEnabled: options.encryptionEnabled !== false,
      compressionEnabled: options.compressionEnabled !== false,
      maxFileSize: options.maxFileSize || 100 * 1024 * 1024, // 100MB
      allowedFileTypes: options.allowedFileTypes || [
        'image/jpeg', 'image/png', 'image/gif', 'image/webp',
        'application/pdf', 'text/plain', 'application/json',
        'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ]
    };

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

    this.initializeAWS();
    this.fileMetadata = new Map();
  }

  initializeAWS() {
    AWS.config.update({
      region: this.config.awsRegion,
      accessKeyId: this.config.s3AccessKey,
      secretAccessKey: this.config.s3SecretKey
    });

    this.s3 = new AWS.S3();
    this.cloudFront = new AWS.CloudFront();

    if (this.config.encryptionEnabled) {
      this.kms = new AWS.KMS();
    }
  }

  async uploadFile(file, options = {}) {
    try {
      const {
        userId,
        accessLevel = 'private',
        folder = '',
        tags = {},
        optimizeImages = true,
        createVersions = true
      } = options;

      // Validate file
      this.validateFile(file);

      // Generate unique file key
      const fileKey = this.generateFileKey(file.originalname, folder);
      
      // Process file (optimize, compress, etc.)
      const processedFile = await this.processFile(file, {
        optimizeImages,
        compressionEnabled: this.config.compressionEnabled
      });

      // Upload to S3
      const uploadResult = await this.uploadToS3(processedFile, fileKey, {
        userId,
        accessLevel,
        tags,
        encryptionEnabled: this.config.encryptionEnabled
      });

      // Create version if enabled
      let versionInfo = null;
      if (createVersions) {
        versionInfo = await this.createFileVersion(fileKey, processedFile);
      }

      // Store metadata
      const metadata = {
        fileKey,
        originalName: file.originalname,
        mimeType: file.mimetype,
        size: processedFile.size,
        userId,
        accessLevel,
        tags,
        uploadedAt: new Date(),
        versionInfo,
        s3Url: uploadResult.Location,
        cloudFrontUrl: this.generateCloudFrontUrl(fileKey),
        metadata: uploadResult.Metadata
      };

      this.fileMetadata.set(fileKey, metadata);

      this.logger.info(`File uploaded successfully: ${fileKey}`, metadata);
      return metadata;

    } catch (error) {
      this.logger.error('File upload failed:', error);
      throw error;
    }
  }

  validateFile(file) {
    if (!file || !file.buffer) {
      throw new Error('Invalid file provided');
    }

    if (file.size > this.config.maxFileSize) {
      throw new Error(`File size exceeds maximum allowed size of ${this.config.maxFileSize} bytes`);
    }

    if (!this.config.allowedFileTypes.includes(file.mimetype)) {
      throw new Error(`File type ${file.mimetype} is not allowed`);
    }
  }

  generateFileKey(originalName, folder = '') {
    const timestamp = Date.now();
    const randomString = crypto.randomBytes(8).toString('hex');
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9]/g, '_');
    const fileKey = folder ? 
      `${folder}/${sanitizedBaseName}_${timestamp}_${randomString}${extension}` :
      `${sanitizedBaseName}_${timestamp}_${randomString}${extension}`;
    
    return fileKey;
  }

  async processFile(file, options = {}) {
    const { optimizeImages, compressionEnabled } = options;
    let processedBuffer = file.buffer;
    let processedSize = file.size;

    // Image optimization
    if (optimizeImages && this.isImageFile(file.mimetype)) {
      processedBuffer = await this.optimizeImage(file.buffer, file.mimetype);
      processedSize = processedBuffer.length;
    }

    // Compression for text files
    if (compressionEnabled && this.isTextFile(file.mimetype)) {
      processedBuffer = await this.compressTextFile(processedBuffer);
      processedSize = processedBuffer.length;
    }

    return {
      buffer: processedBuffer,
      size: processedSize,
      mimetype: file.mimetype
    };
  }

  async optimizeImage(buffer, mimeType) {
    try {
      let image = sharp(buffer);
      
      // Basic optimization based on image type
      if (mimeType === 'image/jpeg') {
        image = image.jpeg({ quality: 85, progressive: true });
      } else if (mimeType === 'image/png') {
        image = image.png({ compressionLevel: 8, progressive: true });
      } else if (mimeType === 'image/webp') {
        image = image.webp({ quality: 85 });
      }

      // Auto-orient based on EXIF data
      image = image.rotate();

      const optimizedBuffer = await image.toBuffer();
      return optimizedBuffer;
    } catch (error) {
      this.logger.warn('Image optimization failed, using original:', error);
      return buffer;
    }
  }

  async compressTextFile(buffer) {
    const zlib = require('zlib');
    const gzip = promisify(zlib.gzip);
    
    try {
      return await gzip(buffer);
    } catch (error) {
      this.logger.warn('Text compression failed, using original:', error);
      return buffer;
    }
  }

  isImageFile(mimeType) {
    return mimeType.startsWith('image/');
  }

  isTextFile(mimeType) {
    const textTypes = ['text/', 'application/json', 'application/xml'];
    return textTypes.some(type => mimeType.startsWith(type));
  }

  async uploadToS3(file, fileKey, options = {}) {
    const { userId, accessLevel, tags, encryptionEnabled } = options;
    
    const uploadParams = {
      Bucket: this.config.s3Bucket,
      Key: fileKey,
      Body: file.buffer,
      ContentType: file.mimetype,
      Metadata: {
        originalName: path.basename(fileKey),
        uploadedBy: userId || 'anonymous',
        accessLevel,
        tags: JSON.stringify(tags || {}),
        uploadedAt: new Date().toISOString()
      }
    };

    // Set ACL based on access level
    if (accessLevel === 'public') {
      uploadParams.ACL = 'public-read';
    }

    // Enable server-side encryption
    if (encryptionEnabled) {
      uploadParams.ServerSideEncryption = 'AES256';
    }

    // Add storage class for cost optimization
    if (file.size > 10 * 1024 * 1024) { // Files larger than 10MB
      uploadParams.StorageClass = 'STANDARD_IA'; // Infrequent Access
    }

    const result = await this.s3.upload(uploadParams).promise();
    return result;
  }

  async createFileVersion(fileKey, file) {
    const versionKey = `${fileKey}.version_${Date.now()}`;
    
    try {
      await this.uploadToS3(file, versionKey, {
        accessLevel: 'private',
        tags: { version: 'backup', original: fileKey }
      });

      return {
        versionKey,
        createdAt: new Date(),
        size: file.size
      };
    } catch (error) {
      this.logger.warn('Failed to create file version:', error);
      return null;
    }
  }

  async downloadFile(fileKey, options = {}) {
    try {
      const { userId, version = null } = options;
      
      // Check access permissions
      await this.checkFileAccess(fileKey, userId);

      const keyToDownload = version || fileKey;
      
      const downloadParams = {
        Bucket: this.config.s3Bucket,
        Key: keyToDownload
      };

      const result = await this.s3.getObject(downloadParams).promise();
      
      this.logger.info(`File downloaded: ${keyToDownload}`, { userId });
      return result;

    } catch (error) {
      this.logger.error('File download failed:', error);
      throw error;
    }
  }

  async checkFileAccess(fileKey, userId) {
    const metadata = this.fileMetadata.get(fileKey);
    
    if (!metadata) {
      throw new Error('File not found');
    }

    // Public files can be accessed by anyone
    if (metadata.accessLevel === 'public') {
      return true;
    }

    // Private files require user authentication
    if (!userId) {
      throw new Error('Authentication required for private files');
    }

    // File owner can access their own files
    if (metadata.userId === userId) {
      return true;
    }

    // Additional access control logic can be implemented here
    throw new Error('Access denied');
  }

  async deleteFile(fileKey, userId) {
    try {
      const metadata = this.fileMetadata.get(fileKey);
      
      if (!metadata) {
        throw new Error('File not found');
      }

      // Check if user can delete the file
      if (metadata.userId !== userId) {
        throw new Error('Access denied: Only file owner can delete files');
      }

      // Delete from S3
      await this.s3.deleteObject({
        Bucket: this.config.s3Bucket,
        Key: fileKey
      }).promise();

      // Delete versions if they exist
      if (metadata.versionInfo) {
        await this.s3.deleteObject({
          Bucket: this.config.s3Bucket,
          Key: metadata.versionInfo.versionKey
        }).promise();
      }

      // Remove from metadata
      this.fileMetadata.delete(fileKey);

      // Invalidate CloudFront cache
      if (this.config.cloudFrontDistribution) {
        await this.invalidateCloudFrontCache([fileKey]);
      }

      this.logger.info(`File deleted: ${fileKey}`, { userId });
      return true;

    } catch (error) {
      this.logger.error('File deletion failed:', error);
      throw error;
    }
  }

  async listFiles(options = {}) {
    try {
      const {
        userId,
        accessLevel,
        tags,
        limit = 50,
        offset = 0,
        sortBy = 'uploadedAt',
        sortOrder = 'desc'
      } = options;

      let files = Array.from(this.fileMetadata.values());

      // Apply filters
      if (userId) {
        files = files.filter(file => file.userId === userId);
      }

      if (accessLevel) {
        files = files.filter(file => file.accessLevel === accessLevel);
      }

      if (tags && Object.keys(tags).length > 0) {
        files = files.filter(file => {
          const fileTags = file.tags || {};
          return Object.entries(tags).every(([key, value]) => fileTags[key] === value);
        });
      }

      // Sort files
      files.sort((a, b) => {
        const aValue = a[sortBy];
        const bValue = b[sortBy];
        const order = sortOrder === 'desc' ? -1 : 1;
        
        if (aValue < bValue) return -1 * order;
        if (aValue > bValue) return 1 * order;
        return 0;
      });

      // Apply pagination
      const paginatedFiles = files.slice(offset, offset + limit);

      return {
        files: paginatedFiles,
        total: files.length,
        limit,
        offset
      };

    } catch (error) {
      this.logger.error('File listing failed:', error);
      throw error;
    }
  }

  async getFileMetadata(fileKey, userId) {
    try {
      await this.checkFileAccess(fileKey, userId);
      
      const metadata = this.fileMetadata.get(fileKey);
      
      if (!metadata) {
        throw new Error('File metadata not found');
      }

      // Add additional S3 metadata
      const s3Metadata = await this.s3.headObject({
        Bucket: this.config.s3Bucket,
        Key: fileKey
      }).promise();

      return {
        ...metadata,
        s3Metadata: {
          lastModified: s3Metadata.LastModified,
          etag: s3Metadata.ETag,
          storageClass: s3Metadata.StorageClass
        }
      };

    } catch (error) {
      this.logger.error('Get file metadata failed:', error);
      throw error;
    }
  }

  async updateFileMetadata(fileKey, updates, userId) {
    try {
      const metadata = this.fileMetadata.get(fileKey);
      
      if (!metadata) {
        throw new Error('File not found');
      }

      if (metadata.userId !== userId) {
        throw new Error('Access denied: Only file owner can update metadata');
      }

      // Update allowed fields
      const allowedUpdates = ['accessLevel', 'tags'];
      const filteredUpdates = {};
      
      allowedUpdates.forEach(field => {
        if (updates[field] !== undefined) {
          filteredUpdates[field] = updates[field];
        }
      });

      // Update metadata
      const updatedMetadata = {
        ...metadata,
        ...filteredUpdates,
        updatedAt: new Date()
      };

      this.fileMetadata.set(fileKey, updatedMetadata);

      // Update S3 metadata if needed
      if (Object.keys(filteredUpdates).length > 0) {
        await this.s3.copyObject({
          Bucket: this.config.s3Bucket,
          Key: fileKey,
          CopySource: `${this.config.s3Bucket}/${fileKey}`,
          Metadata: {
            ...updatedMetadata.metadata,
            ...filteredUpdates,
            updatedAt: updatedMetadata.updatedAt.toISOString()
          },
          MetadataDirective: 'REPLACE'
        }).promise();
      }

      this.logger.info(`File metadata updated: ${fileKey}`, filteredUpdates);
      return updatedMetadata;

    } catch (error) {
      this.logger.error('Update file metadata failed:', error);
      throw error;
    }
  }

  async createFileShare(fileKey, options = {}) {
    try {
      const {
        userId,
        expiresInSeconds = 3600, // 1 hour default
        accessLevel = 'read'
      } = options;

      await this.checkFileAccess(fileKey, userId);

      const signedUrlParams = {
        Bucket: this.config.s3Bucket,
        Key: fileKey,
        Expires: expiresInSeconds
      };

      if (accessLevel === 'write') {
        signedUrlParams.ContentType = 'application/octet-stream';
      }

      const signedUrl = await this.s3.getSignedUrl(
        accessLevel === 'write' ? 'putObject' : 'getObject',
        signedUrlParams
      );

      const shareInfo = {
        fileKey,
        signedUrl,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
        accessLevel,
        createdBy: userId
      };

      this.logger.info(`File share created: ${fileKey}`, shareInfo);
      return shareInfo;

    } catch (error) {
      this.logger.error('Create file share failed:', error);
      throw error;
    }
  }

  async getFileAnalytics(options = {}) {
    try {
      const { userId, period = 'last_30_days' } = options;
      
      let files = Array.from(this.fileMetadata.values());
      
      if (userId) {
        files = files.filter(file => file.userId === userId);
      }

      const analytics = {
        period,
        totalFiles: files.length,
        totalStorage: files.reduce((sum, file) => sum + file.size, 0),
        averageFileSize: files.length > 0 ? files.reduce((sum, file) => sum + file.size, 0) / files.length : 0,
        filesByType: this.groupFilesByType(files),
        filesByAccessLevel: this.groupFilesByAccessLevel(files),
        uploadTrends: this.calculateUploadTrends(files, period),
        storageCost: this.calculateStorageCost(files),
        topUsers: this.getTopUsers(files)
      };

      return analytics;

    } catch (error) {
      this.logger.error('File analytics generation failed:', error);
      throw error;
    }
  }

  groupFilesByType(files) {
    const types = {};
    
    files.forEach(file => {
      const type = file.mimeType.split('/')[0] || 'unknown';
      types[type] = (types[type] || 0) + 1;
    });

    return types;
  }

  groupFilesByAccessLevel(files) {
    const levels = {};
    
    files.forEach(file => {
      levels[file.accessLevel] = (levels[file.accessLevel] || 0) + 1;
    });

    return levels;
  }

  calculateUploadTrends(files, period) {
    const now = Date.now();
    let periodMs;

    switch (period) {
      case 'last_7_days':
        periodMs = 7 * 24 * 60 * 60 * 1000;
        break;
      case 'last_30_days':
        periodMs = 30 * 24 * 60 * 60 * 1000;
        break;
      default:
        periodMs = 30 * 24 * 60 * 60 * 1000;
    }

    const periodFiles = files.filter(file => 
      (now - new Date(file.uploadedAt).getTime()) <= periodMs
    );

    const dailyUploads = {};
    
    periodFiles.forEach(file => {
      const day = new Date(file.uploadedAt).toISOString().split('T')[0];
      dailyUploads[day] = (dailyUploads[day] || 0) + 1;
    });

    return dailyUploads;
  }

  calculateStorageCost(files) {
    // Simplified cost calculation (would need actual AWS pricing)
    const totalGB = files.reduce((sum, file) => sum + file.size, 0) / (1024 * 1024 * 1024);
    const storageCostPerGB = 0.023; // S3 Standard price
    const requestCost = files.length * 0.0004; // PUT request cost
    
    return {
      storageGB: totalGB.toFixed(2),
      storageCost: (totalGB * storageCostPerGB).toFixed(2),
      requestCost: requestCost.toFixed(2),
      totalCost: (totalGB * storageCostPerGB + requestCost).toFixed(2)
    };
  }

  getTopUsers(files) {
    const userCounts = {};
    
    files.forEach(file => {
      if (file.userId) {
        userCounts[file.userId] = (userCounts[file.userId] || 0) + 1;
      }
    });

    return Object.entries(userCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([userId, count]) => ({ userId, count }));
  }

  generateCloudFrontUrl(fileKey) {
    if (!this.config.cloudFrontDomain) {
      return null;
    }

    return `https://${this.config.cloudFrontDomain}/${fileKey}`;
  }

  async invalidateCloudFrontCache(fileKeys) {
    if (!this.config.cloudFrontDistribution) {
      return;
    }

    try {
      const invalidationParams = {
        DistributionId: this.config.cloudFrontDistribution,
        InvalidationBatch: {
          Paths: {
            Quantity: fileKeys.length,
            Items: fileKeys.map(key => `/${key}`)
          },
          CallerReference: `invalidate-${Date.now()}`
        }
      };

      await this.cloudFront.createInvalidation(invalidationParams).promise();
      this.logger.info(`CloudFront cache invalidated for ${fileKeys.length} files`);
    } catch (error) {
      this.logger.error('CloudFront cache invalidation failed:', error);
    }
  }

  async createFileZip(fileKeys, userId) {
    try {
      // Verify access to all files
      for (const fileKey of fileKeys) {
        await this.checkFileAccess(fileKey, userId);
      }

      // Create zip file in memory
      const archive = archiver('zip');
      const buffers = [];

      archive.on('data', (data) => {
        buffers.push(data);
      });

      // Add files to archive
      for (const fileKey of fileKeys) {
        const fileData = await this.downloadFile(fileKey, { userId });
        const metadata = this.fileMetadata.get(fileKey);
        
        archive.append(fileData.Body, {
          name: metadata.originalName
        });
      }

      await archive.finalize();

      const zipBuffer = Buffer.concat(buffers);
      const zipKey = `zips/${userId}/archive_${Date.now()}.zip`;

      // Upload zip file
      const zipUploadResult = await this.uploadToS3({
        buffer: zipBuffer,
        mimetype: 'application/zip',
        size: zipBuffer.length
      }, zipKey, {
        userId,
        accessLevel: 'private',
        tags: { type: 'archive', sourceFiles: fileKeys.length.toString() }
      });

      return {
        zipKey,
        zipUrl: zipUploadResult.Location,
        cloudFrontUrl: this.generateCloudFrontUrl(zipKey),
        size: zipBuffer.length,
        fileCount: fileKeys.length
      };

    } catch (error) {
      this.logger.error('Create file zip failed:', error);
      throw error;
    }
  }
}

module.exports = FileStorageService;
