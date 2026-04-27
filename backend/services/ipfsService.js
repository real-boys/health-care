const { create } = require('ipfs-http-client');
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

class IPFSService {
  constructor() {
    this.client = null;
    this.nodeType = process.env.IPFS_NODE_TYPE || 'local'; // 'local' or 'infura'
    this.infuraProjectId = process.env.INFURA_PROJECT_ID;
    this.infuraProjectSecret = process.env.INFURA_PROJECT_SECRET;
    this.pinnedRecords = new Set(); // In-memory cache for pinned records
    this.contentCache = new Map(); // Content deduplication cache
  }

  async initialize() {
    try {
      if (this.nodeType === 'infura') {
        // Connect to Infura IPFS node
        const auth = 'Basic ' + Buffer.from(this.infuraProjectId + ':' + this.infuraProjectSecret).toString('base64');
        this.client = create({
          host: 'ipfs.infura.io',
          port: 5001,
          protocol: 'https',
          headers: {
            authorization: auth
          }
        });
      } else {
        // Connect to local IPFS node
        this.client = create({
          host: 'localhost',
          port: 5001,
          protocol: 'http'
        });
      }

      // Test connection
      const version = await this.client.version();
      console.log('IPFS node connected:', version);
      
      return true;
    } catch (error) {
      console.error('Failed to connect to IPFS node:', error);
      throw new Error('IPFS node connection failed');
    }
  }

  // Generate content hash for deduplication
  generateContentHash(data) {
    return crypto.createHash('sha256').update(JSON.stringify(data)).digest('hex');
  }

  // Add file to IPFS with encryption and deduplication
  async addEncryptedFile(data, encryptionKey, options = {}) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      // Generate content hash for deduplication
      const contentHash = this.generateContentHash(data);
      
      // Check if content already exists
      if (this.contentCache.has(contentHash)) {
        const existingCid = this.contentCache.get(contentHash);
        console.log('Content already exists, returning existing CID:', existingCid);
        return { cid: existingCid, contentHash, isNew: false };
      }

      // Encrypt data
      const encryptedData = this.encryptData(data, encryptionKey);
      
      // Create IPFS file object with metadata
      const fileData = {
        encryptedData,
        timestamp: new Date().toISOString(),
        contentType: options.contentType || 'application/json',
        originalSize: Buffer.byteLength(JSON.stringify(data)),
        encryptedSize: Buffer.byteLength(encryptedData),
        contentHash,
        version: options.version || 1
      };

      // Add to IPFS
      const { cid } = await this.client.add(JSON.stringify(fileData));
      
      // Cache the content hash
      this.contentCache.set(contentHash, cid.toString());
      
      // Auto-pin if specified
      if (options.pin !== false) {
        await this.pinFile(cid.toString());
      }

      return {
        cid: cid.toString(),
        contentHash,
        isNew: true,
        size: fileData.encryptedSize
      };
    } catch (error) {
      console.error('Error adding encrypted file to IPFS:', error);
      throw error;
    }
  }

  // Retrieve and decrypt file from IPFS
  async getEncryptedFile(cid, encryptionKey) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const chunks = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      
      const fileData = JSON.parse(Buffer.concat(chunks).toString());
      
      // Decrypt data
      const decryptedData = this.decryptData(fileData.encryptedData, encryptionKey);
      
      return {
        data: decryptedData,
        metadata: {
          timestamp: fileData.timestamp,
          contentType: fileData.contentType,
          originalSize: fileData.originalSize,
          encryptedSize: fileData.encryptedSize,
          contentHash: fileData.contentHash,
          version: fileData.version
        }
      };
    } catch (error) {
      console.error('Error retrieving encrypted file from IPFS:', error);
      throw error;
    }
  }

  // AES-256 encryption
  encryptData(data, key) {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-cbc', keyBuffer);
      
      let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Encryption failed');
    }
  }

  // AES-256 decryption
  decryptData(encryptedData, key) {
    try {
      const keyBuffer = Buffer.from(key, 'hex');
      const parts = encryptedData.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      
      const decipher = crypto.createDecipher('aes-256-cbc', keyBuffer);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return JSON.parse(decrypted);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Decryption failed');
    }
  }

  // Pin file to ensure persistence
  async pinFile(cid) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      await this.client.pin.add(cid);
      this.pinnedRecords.add(cid);
      
      console.log(`File pinned: ${cid}`);
      return true;
    } catch (error) {
      console.error('Error pinning file:', error);
      throw error;
    }
  }

  // Unpin file
  async unpinFile(cid) {
    try {
      if (!this.client) {
        await this.initialize();
      }

      await this.client.pin.rm(cid);
      this.pinnedRecords.delete(cid);
      
      console.log(`File unpinned: ${cid}`);
      return true;
    } catch (error) {
      console.error('Error unpinning file:', error);
      throw error;
    }
  }

  // Get pinned files list
  async getPinnedFiles() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const pins = [];
      for await (const pin of this.client.pin.ls()) {
        pins.push({
          cid: pin.cid.toString(),
          type: pin.type
        });
      }
      
      return pins;
    } catch (error) {
      console.error('Error getting pinned files:', error);
      throw error;
    }
  }

  // Create file version with backup
  async createVersion(previousCid, newData, encryptionKey, options = {}) {
    try {
      // Get previous version data
      const previousData = await this.getEncryptedFile(previousCid, encryptionKey);
      
      // Create new version
      const versionData = {
        ...newData,
        versionHistory: [
          ...(previousData.data.versionHistory || []),
          {
            version: previousData.metadata.version || 1,
            cid: previousCid,
            timestamp: previousData.metadata.timestamp
          }
        ]
      };

      // Add new version
      const result = await this.addEncryptedFile(versionData, encryptionKey, {
        ...options,
        version: (previousData.metadata.version || 1) + 1
      });

      return result;
    } catch (error) {
      console.error('Error creating version:', error);
      throw error;
    }
  }

  // Verify file integrity
  async verifyFileIntegrity(cid, expectedContentHash) {
    try {
      const chunks = [];
      for await (const chunk of this.client.cat(cid)) {
        chunks.push(chunk);
      }
      
      const fileData = JSON.parse(Buffer.concat(chunks).toString());
      
      return fileData.contentHash === expectedContentHash;
    } catch (error) {
      console.error('Error verifying file integrity:', error);
      return false;
    }
  }

  // Get node stats
  async getStats() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const stats = await this.client.repo.stat();
      const pins = await this.getPinnedFiles();
      
      return {
        storage: stats,
        pinnedCount: pins.length,
        cachedContent: this.contentCache.size,
        nodeType: this.nodeType
      };
    } catch (error) {
      console.error('Error getting IPFS stats:', error);
      throw error;
    }
  }

  // Cleanup unpinned files (garbage collection)
  async garbageCollect() {
    try {
      if (!this.client) {
        await this.initialize();
      }

      const result = await this.client.repo.gc();
      console.log('Garbage collection completed:', result);
      
      return result;
    } catch (error) {
      console.error('Error during garbage collection:', error);
      throw error;
    }
  }
}

module.exports = new IPFSService();
