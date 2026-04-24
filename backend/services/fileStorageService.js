/**
 * File Storage and CDN Service
 * Implements secure file storage with S3 and CloudFront CDN integration
 */

const AWS = require('aws-sdk');
const sharp = require('sharp');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs').promises;
const sqlite3 = require('sqlite3').verbose();
const EventEmitter = require('events');

class FileStorageService extends EventEmitter {
  constructor() {
    super();
    this.initializeAWS();
    this.initializeDatabase();
    this.fileAnalytics = {
      totalUploads: 0,
      totalDownloads: 0,
      storageUsed: 0,
      cdnHits: 0,
      lastUpdated: new Date()
    };
  }

  /**
   * Initialize AWS S3 and CloudFront
   */
  initializeAWS() {
    // Initialize S3
    this.s3 = new AWS.S3({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1',
      signatureVersion: 'v4'
    });

    // Initialize CloudFront
    this.cloudfront = new AWS.CloudFront({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      region: process.env.AWS_REGION || 'us-east-1'
    });

    // S3 bucket configuration
    this.bucketName = process.env.S3_BUCKET_NAME || 'healthcare-files';
    this.cdnDistributionId = process.env.CLOUDFRONT_DISTRIBUTION_ID;
    this.cdnDomain = process.env.CLOUDFRONT_DOMAIN;

    console.log('AWS S3 and CloudFront initialized');
  }

  /**
   * Initialize database for file metadata
   */
  initializeDatabase() {
    const dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = new sqlite3.Database(dbPath);

    const createTables = `
      -- File metadata table
      CREATE TABLE IF NOT EXISTS file_metadata (
        id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL,
        file_name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        mime_type TEXT NOT NULL,
        file_hash TEXT NOT NULL,
        uploaded_by TEXT NOT NULL,
        uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        is_public BOOLEAN DEFAULT 0,
        access_count INTEGER DEFAULT 0,
        last_accessed DATETIME,
        version INTEGER DEFAULT 1,
        parent_file_id TEXT,
        tags TEXT,
        metadata TEXT,
        FOREIGN KEY (parent_file_id) REFERENCES file_metadata(id)
      );

      -- File access logs
      CREATE TABLE IF NOT EXISTS file_access_logs (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        user_id TEXT,
        action TEXT NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (file_id) REFERENCES file_metadata(id)
      );

      -- File analytics
      CREATE TABLE IF NOT EXISTS file_analytics (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        date DATE NOT NULL,
        downloads INTEGER DEFAULT 0,
        cdn_hits INTEGER DEFAULT 0,
        bandwidth_used INTEGER DEFAULT 0,
        FOREIGN KEY (file_id) REFERENCES file_metadata(id)
      );

      -- File versions
      CREATE TABLE IF NOT EXISTS file_versions (
        id TEXT PRIMARY KEY,
        file_id TEXT NOT NULL,
        version_number INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        file_size INTEGER NOT NULL,
        file_hash TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        change_description TEXT,
        FOREIGN KEY (file_id) REFERENCES file_metadata(id)
      );
    `;

    this.db.exec(createTables, (err) => {
      if (err) {
        console.error('Error initializing file storage database:', err);
      } else {
        console.log('File storage database initialized successfully');
      }
    });
  }

  /**
   * Upload file to S3 with optimization
   */
  async uploadFile(file, userId, options = {}) {
    try {
      const {
        originalname,
        buffer,
        mimetype,
        size
      } = file;

      // Generate unique file name and hash
      const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
      const fileExtension = path.extname(originalname);
      const fileName = `${Date.now()}_${crypto.randomBytes(16).toString('hex')}${fileExtension}`;
      const filePath = this.generateFilePath(userId, fileName, mimetype);

      // Process and optimize file if it's an image
      let processedBuffer = buffer;
      if (this.isImageFile(mimetype)) {
        processedBuffer = await this.optimizeImage(buffer, options);
      }

      // Upload to S3 with proper metadata
      const uploadParams = {
        Bucket: this.bucketName,
        Key: filePath,
        Body: processedBuffer,
        ContentType: mimetype,
        Metadata: {
          originalName: originalname,
          uploadedBy: userId,
          fileHash: fileHash,
          uploadTime: new Date().toISOString()
        },
        ServerSideEncryption: 'AES256',
        StorageClass: options.storageClass || 'STANDARD'
      };

      const uploadResult = await this.s3.upload(uploadParams).promise();

      // Save file metadata to database
      const fileId = `file_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      await this.saveFileMetadata({
        id: fileId,
        originalName: originalname,
        fileName: fileName,
        filePath: filePath,
        fileSize: processedBuffer.length,
        mimeType: mimetype,
        fileHash: fileHash,
        uploadedBy: userId,
        isPublic: options.isPublic || false,
        tags: JSON.stringify(options.tags || []),
        metadata: JSON.stringify(options.metadata || {})
      });

      // Update analytics
      this.fileAnalytics.totalUploads++;
      this.fileAnalytics.storageUsed += processedBuffer.length;
      this.fileAnalytics.lastUpdated = new Date();

      // Log file access
      await this.logFileAccess(fileId, userId, 'upload');

      // Generate CDN URL if CloudFront is configured
      const cdnUrl = this.cdnDomain ? `https://${this.cdnDomain}/${filePath}` : uploadResult.Location;

      this.emit('file_uploaded', {
        fileId,
        fileName: originalname,
        fileSize: processedBuffer.length,
        cdnUrl,
        uploadedBy: userId
      });

      return {
        fileId,
        fileName,
        originalName: originalname,
        fileSize: processedBuffer.length,
        mimeType: mimetype,
        cdnUrl,
        s3Url: uploadResult.Location,
        uploadedAt: new Date()
      };

    } catch (error) {
      console.error('Error uploading file:', error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }

  /**
   * Generate file path based on user and type
   */
  generateFilePath(userId, fileName, mimeType) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    let folder = 'files';
    if (this.isImageFile(mimeType)) {
      folder = 'images';
    } else if (mimetype.startsWith('video/')) {
      folder = 'videos';
    } else if (mimetype.startsWith('audio/')) {
      folder = 'audio';
    } else if (mimetype.includes('document') || mimetype.includes('pdf')) {
      folder = 'documents';
    }

    return `${folder}/${year}/${month}/${day}/${userId}/${fileName}`;
  }

  /**
   * Check if file is an image
   */
  isImageFile(mimeType) {
    return mimeType.startsWith('image/');
  }

  /**
   * Optimize image using Sharp
   */
  async optimizeImage(buffer, options = {}) {
    try {
      const image = sharp(buffer);
      const metadata = await image.metadata();

      let pipeline = image;

      // Resize if specified
      if (options.width || options.height) {
        pipeline = pipeline.resize(options.width, options.height, {
          fit: options.fit || 'inside',
          withoutEnlargement: true
        });
      }

      // Auto-orient based on EXIF
      pipeline = pipeline.rotate();

      // Convert to appropriate format
      if (options.format) {
        switch (options.format.toLowerCase()) {
          case 'jpeg':
            pipeline = pipeline.jpeg({ quality: options.quality || 80, progressive: true });
            break;
          case 'png':
            pipeline = pipeline.png({ compressionLevel: options.compressionLevel || 6 });
            break;
          case 'webp':
            pipeline = pipeline.webp({ quality: options.quality || 80 });
            break;
          default:
            // Keep original format but optimize
            if (metadata.format === 'jpeg') {
              pipeline = pipeline.jpeg({ quality: options.quality || 80, progressive: true });
            } else if (metadata.format === 'png') {
              pipeline = pipeline.png({ compressionLevel: options.compressionLevel || 6 });
            }
        }
      } else {
        // Auto-optimize based on original format
        if (metadata.format === 'jpeg') {
          pipeline = pipeline.jpeg({ quality: 80, progressive: true });
        } else if (metadata.format === 'png') {
          pipeline = pipeline.png({ compressionLevel: 6 });
        }
      }

      return await pipeline.toBuffer();
    } catch (error) {
      console.error('Error optimizing image:', error);
      return buffer; // Return original buffer if optimization fails
    }
  }

  /**
   * Save file metadata to database
   */
  async saveFileMetadata(metadata) {
    return new Promise((resolve, reject) => {
      const stmt = this.db.prepare(`
        INSERT INTO file_metadata 
        (id, original_name, file_name, file_path, file_size, mime_type, file_hash, 
         uploaded_by, is_public, tags, metadata)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        metadata.id,
        metadata.originalName,
        metadata.fileName,
        metadata.filePath,
        metadata.fileSize,
        metadata.mimeType,
        metadata.fileHash,
        metadata.uploadedBy,
        metadata.isPublic ? 1 : 0,
        metadata.tags,
        metadata.metadata
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(metadata.id);
        }
      });

      stmt.finalize();
    });
  }

  /**
   * Get file metadata
   */
  async getFileMetadata(fileId, userId) {
    return new Promise((resolve, reject) => {
      this.db.get(
        'SELECT * FROM file_metadata WHERE id = ?',
        [fileId],
        async (err, row) => {
          if (err) {
            reject(err);
          } else if (!row) {
            reject(new Error('File not found'));
          } else {
            // Check access permissions
            const hasAccess = await this.checkFileAccess(row, userId);
            if (!hasAccess) {
              reject(new Error('Access denied'));
            } else {
              // Update access count and last accessed
              await this.updateFileAccess(fileId);
              resolve(row);
            }
          }
        }
      );
    });
  }

  /**
   * Check file access permissions
   */
  async checkFileAccess(fileMetadata, userId) {
    // Public files are accessible to everyone
    if (fileMetadata.is_public) {
      return true;
    }

    // File owner has access
    if (fileMetadata.uploaded_by === userId) {
      return true;
    }

    // Check if user has explicit permission (implement role-based access here)
    // For now, return false for non-owners of private files
    return false;
  }

  /**
   * Update file access statistics
   */
  async updateFileAccess(fileId) {
    return new Promise((resolve) => {
      this.db.run(
        'UPDATE file_metadata SET access_count = access_count + 1, last_accessed = CURRENT_TIMESTAMP WHERE id = ?',
        [fileId],
        () => resolve()
      );
    });
  }

  /**
   * Log file access
   */
  async logFileAccess(fileId, userId, action, ipAddress = null, userAgent = null) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO file_access_logs 
        (id, file_id, user_id, action, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        `log_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        fileId,
        userId,
        action,
        ipAddress,
        userAgent
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Get download URL with CDN
   */
  async getDownloadUrl(fileId, userId, options = {}) {
    try {
      const fileMetadata = await this.getFileMetadata(fileId, userId);
      
      // Log download attempt
      await this.logFileAccess(fileId, userId, 'download_request');

      // Generate signed URL for S3
      const urlParams = {
        Bucket: this.bucketName,
        Key: fileMetadata.file_path,
        Expires: options.expiresIn || 3600 // 1 hour default
      };

      if (options.download) {
        urlParams.ResponseContentDisposition = `attachment; filename="${fileMetadata.original_name}"`;
      }

      const signedUrl = this.s3.getSignedUrl('getObject', urlParams);

      // Update analytics
      this.fileAnalytics.totalDownloads++;

      // Update daily analytics
      await this.updateFileAnalytics(fileId, 'downloads', 1);

      // Return CDN URL if available and file is public
      if (fileMetadata.is_public && this.cdnDomain) {
        return {
          url: `https://${this.cdnDomain}/${fileMetadata.file_path}`,
          type: 'cdn',
          expiresIn: options.expiresIn || 3600
        };
      }

      return {
        url: signedUrl,
        type: 'signed',
        expiresIn: options.expiresIn || 3600
      };

    } catch (error) {
      console.error('Error generating download URL:', error);
      throw error;
    }
  }

  /**
   * Update file analytics
   */
  async updateFileAnalytics(fileId, metric, value) {
    const today = new Date().toISOString().split('T')[0];

    return new Promise((resolve) => {
      this.db.run(`
        INSERT INTO file_analytics (id, file_id, date, ${metric})
        VALUES (?, ?, ?, ?)
        ON CONFLICT(file_id, date) DO UPDATE SET
        ${metric} = ${metric} + ?
      `, [
        `analytics_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`,
        fileId,
        today,
        value,
        value
      ], () => resolve());
    });
  }

  /**
   * Create file version
   */
  async createFileVersion(fileId, newFileBuffer, userId, changeDescription = '') {
    try {
      const originalFile = await this.getFileMetadata(fileId, userId);
      
      // Generate hash for new version
      const newFileHash = crypto.createHash('sha256').update(newFileBuffer).digest('hex');
      
      // Check if content is actually different
      if (newFileHash === originalFile.file_hash) {
        throw new Error('File content is identical to current version');
      }

      // Create new version file path
      const versionPath = originalFile.file_path.replace(/\.([^.]*)$/, `_v${originalFile.version + 1}.$1`);
      
      // Upload new version to S3
      const uploadParams = {
        Bucket: this.bucketName,
        Key: versionPath,
        Body: newFileBuffer,
        ContentType: originalFile.mime_type,
        Metadata: {
          originalName: originalFile.original_name,
          uploadedBy: userId,
          fileHash: newFileHash,
          version: (originalFile.version + 1).toString(),
          parentFileId: fileId
        },
        ServerSideEncryption: 'AES256'
      };

      await this.s3.upload(uploadParams).promise();

      // Save version metadata
      const versionId = `version_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
      await this.saveFileVersion({
        id: versionId,
        fileId: fileId,
        versionNumber: originalFile.version + 1,
        filePath: versionPath,
        fileSize: newFileBuffer.length,
        fileHash: newFileHash,
        createdBy: userId,
        changeDescription: changeDescription
      });

      // Update main file record
      await this.updateFileVersion(fileId, versionPath, newFileBuffer.length, newFileHash);

      this.emit('file_versioned', {
        fileId,
        versionId,
        versionNumber: originalFile.version + 1,
        createdBy: userId
      });

      return {
        versionId,
        versionNumber: originalFile.version + 1,
        fileSize: newFileBuffer.length,
        createdAt: new Date()
      };

    } catch (error) {
      console.error('Error creating file version:', error);
      throw error;
    }
  }

  /**
   * Save file version metadata
   */
  async saveFileVersion(versionData) {
    return new Promise((resolve) => {
      const stmt = this.db.prepare(`
        INSERT INTO file_versions 
        (id, file_id, version_number, file_path, file_size, file_hash, created_by, change_description)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run([
        versionData.id,
        versionData.fileId,
        versionData.versionNumber,
        versionData.filePath,
        versionData.fileSize,
        versionData.fileHash,
        versionData.createdBy,
        versionData.changeDescription
      ]);

      stmt.finalize(() => resolve());
    });
  }

  /**
   * Update main file version
   */
  async updateFileVersion(fileId, filePath, fileSize, fileHash) {
    return new Promise((resolve) => {
      this.db.run(`
        UPDATE file_metadata 
        SET file_path = ?, file_size = ?, file_hash = ?, version = version + 1
        WHERE id = ?
      `, [filePath, fileSize, fileHash, fileId], () => resolve());
    });
  }

  /**
   * Get file versions
   */
  async getFileVersions(fileId, userId) {
    try {
      await this.getFileMetadata(fileId, userId); // Check access
      
      return new Promise((resolve, reject) => {
        this.db.all(
          'SELECT * FROM file_versions WHERE file_id = ? ORDER BY version_number DESC',
          [fileId],
          (err, rows) => {
            if (err) {
              reject(err);
            } else {
              resolve(rows);
            }
          }
        );
      });
    } catch (error) {
      throw error;
    }
  }

  /**
   * Delete file
   */
  async deleteFile(fileId, userId) {
    try {
      const fileMetadata = await this.getFileMetadata(fileId, userId);
      
      // Only file owner can delete
      if (fileMetadata.uploaded_by !== userId) {
        throw new Error('Only file owner can delete files');
      }

      // Delete from S3
      await this.s3.deleteObject({
        Bucket: this.bucketName,
        Key: fileMetadata.file_path
      }).promise();

      // Delete all versions from S3
      const versions = await this.getFileVersions(fileId, userId);
      for (const version of versions) {
        await this.s3.deleteObject({
          Bucket: this.bucketName,
          Key: version.file_path
        }).promise();
      }

      // Delete from database
      await this.deleteFileFromDatabase(fileId);

      // Update analytics
      this.fileAnalytics.storageUsed -= fileMetadata.file_size;

      // Log deletion
      await this.logFileAccess(fileId, userId, 'delete');

      this.emit('file_deleted', {
        fileId,
        deletedBy: userId
      });

      return true;

    } catch (error) {
      console.error('Error deleting file:', error);
      throw error;
    }
  }

  /**
   * Delete file from database
   */
  async deleteFileFromDatabase(fileId) {
    return new Promise((resolve) => {
      this.db.run('DELETE FROM file_metadata WHERE id = ?', [fileId], () => {
        this.db.run('DELETE FROM file_versions WHERE file_id = ?', [fileId], () => {
          this.db.run('DELETE FROM file_access_logs WHERE file_id = ?', [fileId], () => {
            this.db.run('DELETE FROM file_analytics WHERE file_id = ?', [fileId], () => {
              resolve();
            });
          });
        });
      });
    });
  }

  /**
   * Search files
   */
  async searchFiles(userId, query = {}, options = {}) {
    try {
      let sql = 'SELECT * FROM file_metadata WHERE uploaded_by = ?';
      const params = [userId];

      // Build search conditions
      if (query.fileName) {
        sql += ' AND original_name LIKE ?';
        params.push(`%${query.fileName}%`);
      }

      if (query.mimeType) {
        sql += ' AND mime_type LIKE ?';
        params.push(`%${query.mimeType}%`);
      }

      if (query.tags) {
        sql += ' AND tags LIKE ?';
        params.push(`%${query.tags}%`);
      }

      if (query.dateFrom) {
        sql += ' AND uploaded_at >= ?';
        params.push(query.dateFrom);
      }

      if (query.dateTo) {
        sql += ' AND uploaded_at <= ?';
        params.push(query.dateTo);
      }

      // Add ordering and pagination
      sql += ' ORDER BY uploaded_at DESC';
      
      if (options.limit) {
        sql += ' LIMIT ?';
        params.push(options.limit);
      }

      if (options.offset) {
        sql += ' OFFSET ?';
        params.push(options.offset);
      }

      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows.map(row => ({
              ...row,
              tags: JSON.parse(row.tags || '[]'),
              metadata: JSON.parse(row.metadata || '{}'),
              is_public: Boolean(row.is_public)
            })));
          }
        });
      });

    } catch (error) {
      console.error('Error searching files:', error);
      throw error;
    }
  }

  /**
   * Get file analytics
   */
  async getFileAnalytics(fileId, userId, period = '30d') {
    try {
      await this.getFileMetadata(fileId, userId); // Check access
      
      const days = period === '7d' ? 7 : period === '30d' ? 30 : 90;
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      return new Promise((resolve, reject) => {
        this.db.all(`
          SELECT 
            date,
            SUM(downloads) as total_downloads,
            SUM(cdn_hits) as total_cdn_hits,
            SUM(bandwidth_used) as total_bandwidth
          FROM file_analytics 
          WHERE file_id = ? AND date >= ?
          GROUP BY date
          ORDER BY date DESC
        `, [fileId, startDate.toISOString().split('T')[0]], (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              fileId,
              period,
              data: rows,
              summary: {
                totalDownloads: rows.reduce((sum, row) => sum + row.total_downloads, 0),
                totalCdnHits: rows.reduce((sum, row) => sum + row.total_cdn_hits, 0),
                totalBandwidth: rows.reduce((sum, row) => sum + row.total_bandwidth, 0)
              }
            });
          }
        });
      });

    } catch (error) {
      throw error;
    }
  }

  /**
   * Get storage analytics
   */
  async getStorageAnalytics(userId = null) {
    try {
      let sql = 'SELECT mime_type, COUNT(*) as count, SUM(file_size) as total_size FROM file_metadata';
      const params = [];

      if (userId) {
        sql += ' WHERE uploaded_by = ?';
        params.push(userId);
      }

      sql += ' GROUP BY mime_type';

      return new Promise((resolve, reject) => {
        this.db.all(sql, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve({
              analytics: this.fileAnalytics,
              breakdown: rows,
              totalFiles: rows.reduce((sum, row) => sum + row.count, 0),
              totalStorage: rows.reduce((sum, row) => sum + row.total_size, 0)
            });
          }
        });
      });

    } catch (error) {
      console.error('Error getting storage analytics:', error);
      throw error;
    }
  }

  /**
   * Invalidate CDN cache
   */
  async invalidateCDNCache(filePaths) {
    if (!this.cdnDistributionId) {
      console.log('CloudFront distribution not configured, skipping cache invalidation');
      return;
    }

    try {
      const invalidationParams = {
        DistributionId: this.cdnDistributionId,
        InvalidationBatch: {
          Paths: {
            Quantity: filePaths.length,
            Items: filePaths.map(path => `/${path}`)
          },
          CallerReference: `invalidation_${Date.now()}`
        }
      };

      const result = await this.cloudfront.createInvalidation(invalidationParams).promise();
      console.log('CDN cache invalidation created:', result.Invalidation.Id);

      return result;
    } catch (error) {
      console.error('Error invalidating CDN cache:', error);
      throw error;
    }
  }

  /**
   * Get service health status
   */
  async getHealthStatus() {
    try {
      // Check S3 connectivity
      await this.s3.listBuckets().promise();

      return {
        status: 'healthy',
        s3: 'connected',
        cloudfront: this.cdnDistributionId ? 'configured' : 'not_configured',
        analytics: this.fileAnalytics,
        timestamp: new Date()
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date()
      };
    }
  }
}

module.exports = FileStorageService;
