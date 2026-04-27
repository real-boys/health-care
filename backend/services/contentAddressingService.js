const crypto = require('crypto');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class ContentAddressingService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.contentCache = new Map(); // In-memory cache for content hashes
    this.deduplicationStats = {
      totalUploads: 0,
      duplicatesFound: 0,
      spaceSaved: 0
    };
  }

  getDatabase() {
    return new sqlite3.Database(this.dbPath);
  }

  // Initialize content addressing database tables
  async initializeTables() {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS content_hashes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_hash TEXT UNIQUE NOT NULL,
            ipfs_cid TEXT NOT NULL,
            content_type TEXT NOT NULL,
            original_size INTEGER NOT NULL,
            encrypted_size INTEGER NOT NULL,
            upload_count INTEGER DEFAULT 1,
            first_uploaded TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            is_pinned BOOLEAN DEFAULT FALSE,
            metadata TEXT
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE TABLE IF NOT EXISTS content_references (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            content_hash TEXT NOT NULL,
            resource_type TEXT NOT NULL,
            resource_id TEXT NOT NULL,
            user_id INTEGER NOT NULL,
            access_granted TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (content_hash) REFERENCES content_hashes(content_hash)
          )
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_content_hash 
          ON content_hashes(content_hash)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

      await new Promise((resolve, reject) => {
        db.run(`
          CREATE INDEX IF NOT EXISTS idx_content_reference 
          ON content_references(resource_type, resource_id)
        `, (err) => {
          if (err) reject(err);
          else resolve();
        });
      });

    } catch (error) {
      console.error('Error initializing content addressing tables:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Generate content hash for deduplication
  generateContentHash(data) {
    const dataString = typeof data === 'string' ? data : JSON.stringify(data);
    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // Generate content hash for file buffer
  generateFileHash(buffer) {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  // Check if content already exists
  async contentExists(contentHash) {
    // Check in-memory cache first
    if (this.contentCache.has(contentHash)) {
      return this.contentCache.get(contentHash);
    }

    const db = this.getDatabase();
    
    try {
      const result = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM content_hashes WHERE content_hash = ?',
          [contentHash],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (result) {
        // Cache the result
        this.contentCache.set(contentHash, result);
        return result;
      }

      return null;
    } catch (error) {
      console.error('Error checking content existence:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Register new content
  async registerContent(contentHash, ipfsCid, contentType, originalSize, encryptedSize, metadata = null) {
    const db = this.getDatabase();
    
    try {
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO content_hashes 
           (content_hash, ipfs_cid, content_type, original_size, encrypted_size, metadata)
           VALUES (?, ?, ?, ?, ?, ?)`,
          [contentHash, ipfsCid, contentType, originalSize, encryptedSize, JSON.stringify(metadata)],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Update cache
      const contentRecord = {
        id: result.id,
        content_hash: contentHash,
        ipfs_cid: ipfsCid,
        content_type: contentType,
        original_size: originalSize,
        encrypted_size: encryptedSize,
        upload_count: 1,
        metadata
      };
      this.contentCache.set(contentHash, contentRecord);

      // Update statistics
      this.deduplicationStats.totalUploads++;

      return contentRecord;
    } catch (error) {
      console.error('Error registering content:', error);
      throw error;
    } finally {
      db.close();
    }
  }

  // Update content access
  async updateContentAccess(contentHash) {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          `UPDATE content_hashes 
           SET upload_count = upload_count + 1, 
               last_accessed = CURRENT_TIMESTAMP 
           WHERE content_hash = ?`,
          [contentHash],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update cache
      const cached = this.contentCache.get(contentHash);
      if (cached) {
        cached.upload_count++;
        cached.last_accessed = new Date().toISOString();
      }

      // Update statistics
      this.deduplicationStats.duplicatesFound++;

    } catch (error) {
      console.error('Error updating content access:', error);
    } finally {
      db.close();
    }
  }

  // Create content reference
  async createContentReference(contentHash, resourceType, resourceId, userId) {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO content_references 
           (content_hash, resource_type, resource_id, user_id)
           VALUES (?, ?, ?, ?)`,
          [contentHash, resourceType, resourceId, userId],
          function(err) {
            if (err) reject(err);
            else resolve(this.lastID);
          }
        );
      });

      return true;
    } catch (error) {
      console.error('Error creating content reference:', error);
      return false;
    } finally {
      db.close();
    }
  }

  // Get content by hash
  async getContent(contentHash) {
    const db = this.getDatabase();
    
    try {
      const content = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM content_hashes WHERE content_hash = ?',
          [contentHash],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (content && content.metadata) {
        content.metadata = JSON.parse(content.metadata);
      }

      return content;
    } catch (error) {
      console.error('Error getting content:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Get all references for a content hash
  async getContentReferences(contentHash) {
    const db = this.getDatabase();
    
    try {
      const references = await new Promise((resolve, reject) => {
        db.all(
          `SELECT cr.*, u.email as user_email 
           FROM content_references cr
           JOIN users u ON cr.user_id = u.id
           WHERE cr.content_hash = ?`,
          [contentHash],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      return references;
    } catch (error) {
      console.error('Error getting content references:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Get content by resource
  async getContentByResource(resourceType, resourceId) {
    const db = this.getDatabase();
    
    try {
      const content = await new Promise((resolve, reject) => {
        db.get(
          `SELECT ch.* FROM content_hashes ch
           JOIN content_references cr ON ch.content_hash = cr.content_hash
           WHERE cr.resource_type = ? AND cr.resource_id = ?
           ORDER BY cr.access_granted DESC
           LIMIT 1`,
          [resourceType, resourceId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (content && content.metadata) {
        content.metadata = JSON.parse(content.metadata);
      }

      return content;
    } catch (error) {
      console.error('Error getting content by resource:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Find duplicate content
  async findDuplicates(contentType = null, minUploadCount = 2) {
    const db = this.getDatabase();
    
    try {
      let query = `
        SELECT content_hash, ipfs_cid, content_type, original_size, 
               upload_count, first_uploaded, last_accessed
        FROM content_hashes 
        WHERE upload_count >= ?
      `;
      let params = [minUploadCount];

      if (contentType) {
        query += ' AND content_type = ?';
        params.push(contentType);
      }

      query += ' ORDER BY upload_count DESC, original_size DESC';

      const duplicates = await new Promise((resolve, reject) => {
        db.all(query, params, (err, rows) => {
          if (err) reject(err);
          else resolve(rows);
        });
      });

      return duplicates;
    } catch (error) {
      console.error('Error finding duplicates:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Calculate deduplication statistics
  async calculateDeduplicationStats() {
    const db = this.getDatabase();
    
    try {
      const stats = await new Promise((resolve, reject) => {
        db.get(`
          SELECT 
            COUNT(*) as total_files,
            SUM(original_size) as total_original_size,
            SUM(encrypted_size) as total_encrypted_size,
            SUM(upload_count) as total_uploads,
            COUNT(CASE WHEN upload_count > 1 THEN 1 END) as duplicate_files,
            SUM(CASE WHEN upload_count > 1 THEN (upload_count - 1) * original_size ELSE 0 END) as space_saved
          FROM content_hashes
        `, (err, row) => {
          if (err) reject(err);
          else resolve(row);
        });
      });

      return {
        ...stats,
        deduplicationRatio: stats.total_original_size > 0 ? 
          (stats.space_saved / stats.total_original_size * 100).toFixed(2) + '%' : '0%',
        averageCompressionRatio: stats.total_original_size > 0 ? 
          (stats.total_original_size / stats.total_encrypted_size).toFixed(2) : '0'
      };
    } catch (error) {
      console.error('Error calculating deduplication stats:', error);
      return null;
    } finally {
      db.close();
    }
  }

  // Pin content
  async pinContent(contentHash) {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE content_hashes SET is_pinned = TRUE WHERE content_hash = ?',
          [contentHash],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update cache
      const cached = this.contentCache.get(contentHash);
      if (cached) {
        cached.is_pinned = true;
      }

      return true;
    } catch (error) {
      console.error('Error pinning content:', error);
      return false;
    } finally {
      db.close();
    }
  }

  // Unpin content
  async unpinContent(contentHash) {
    const db = this.getDatabase();
    
    try {
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE content_hashes SET is_pinned = FALSE WHERE content_hash = ?',
          [contentHash],
          function(err) {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      // Update cache
      const cached = this.contentCache.get(contentHash);
      if (cached) {
        cached.is_pinned = false;
      }

      return true;
    } catch (error) {
      console.error('Error unpinning content:', error);
      return false;
    } finally {
      db.close();
    }
  }

  // Get pinned content
  async getPinnedContent() {
    const db = this.getDatabase();
    
    try {
      const pinned = await new Promise((resolve, reject) => {
        db.all(
          'SELECT * FROM content_hashes WHERE is_pinned = TRUE ORDER BY first_uploaded DESC',
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      return pinned.map(row => {
        if (row.metadata) {
          row.metadata = JSON.parse(row.metadata);
        }
        return row;
      });
    } catch (error) {
      console.error('Error getting pinned content:', error);
      return [];
    } finally {
      db.close();
    }
  }

  // Clean up old content (not pinned and not accessed recently)
  async cleanupOldContent(daysOld = 30) {
    const db = this.getDatabase();
    
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysOld);

      const result = await new Promise((resolve, reject) => {
        db.run(
          `DELETE FROM content_hashes 
           WHERE is_pinned = FALSE 
           AND last_accessed < ? 
           AND upload_count = 1`,
          [cutoffDate.toISOString()],
          function(err) {
            if (err) reject(err);
            else resolve({ deleted: this.changes });
          }
        );
      });

      // Clear cache for deleted items
      for (const [hash, content] of this.contentCache.entries()) {
        if (content.last_accessed < cutoffDate.toISOString() && !content.is_pinned) {
          this.contentCache.delete(hash);
        }
      }

      return result;
    } catch (error) {
      console.error('Error cleaning up old content:', error);
      return { deleted: 0 };
    } finally {
      db.close();
    }
  }

  // Get current statistics
  getStats() {
    return {
      ...this.deduplicationStats,
      cachedItems: this.contentCache.size,
      cacheHitRatio: this.deduplicationStats.totalUploads > 0 ? 
        ((this.deduplicationStats.duplicatesFound / this.deduplicationStats.totalUploads) * 100).toFixed(2) + '%' : '0%'
    };
  }

  // Clear cache
  clearCache() {
    this.contentCache.clear();
  }

  // Preload cache with frequently accessed content
  async preloadCache(limit = 100) {
    const db = this.getDatabase();
    
    try {
      const frequentContent = await new Promise((resolve, reject) => {
        db.all(
          `SELECT * FROM content_hashes 
           ORDER BY upload_count DESC, last_accessed DESC 
           LIMIT ?`,
          [limit],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      for (const content of frequentContent) {
        if (content.metadata) {
          content.metadata = JSON.parse(content.metadata);
        }
        this.contentCache.set(content.content_hash, content);
      }

      return frequentContent.length;
    } catch (error) {
      console.error('Error preloading cache:', error);
      return 0;
    } finally {
      db.close();
    }
  }
}

module.exports = new ContentAddressingService();
