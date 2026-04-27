const request = require('supertest');
const { app } = require('../server');
const ipfsService = require('../services/ipfsService');
const encryptionService = require('../services/encryptionService');
const contentAddressingService = require('../services/contentAddressingService');

describe('IPFS Integration Tests', () => {
  let testEncryptionKey;
  let testCid;
  let testContentHash;

  beforeAll(async () => {
    // Initialize services
    await ipfsService.initialize();
    await contentAddressingService.initializeTables();
    
    // Generate test encryption key
    testEncryptionKey = encryptionService.generateKey();
  });

  describe('Encryption Service', () => {
    test('should generate secure encryption key', () => {
      const key = encryptionService.generateKey();
      expect(key).toBeDefined();
      expect(key.length).toBe(64); // 32 bytes * 2 (hex)
    });

    test('should encrypt and decrypt data correctly', () => {
      const testData = {
        patientId: 123,
        recordType: 'TEST',
        content: 'Sensitive medical information'
      };

      const encrypted = encryptionService.encryptMedicalRecord(testData, testEncryptionKey);
      expect(encrypted).toBeDefined();
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();

      const decrypted = encryptionService.decryptMedicalRecord(encrypted, testEncryptionKey);
      expect(decrypted).toEqual(testData);
    });

    test('should fail decryption with wrong key', () => {
      const testData = { test: 'data' };
      const wrongKey = encryptionService.generateKey();
      
      const encrypted = encryptionService.encryptMedicalRecord(testData, testEncryptionKey);
      
      expect(() => {
        encryptionService.decryptMedicalRecord(encrypted, wrongKey);
      }).toThrow();
    });
  });

  describe('IPFS Service', () => {
    test('should add and retrieve encrypted file', async () => {
      const testData = {
        type: 'medical_record',
        patientId: 123,
        content: 'Test medical record content',
        timestamp: new Date().toISOString()
      };

      const result = await ipfsService.addEncryptedFile(testData, testEncryptionKey);
      expect(result).toBeDefined();
      expect(result.cid).toBeDefined();
      expect(result.contentHash).toBeDefined();
      expect(result.isNew).toBe(true);

      testCid = result.cid;
      testContentHash = result.contentHash;

      // Retrieve and verify
      const retrieved = await ipfsService.getEncryptedFile(result.cid, testEncryptionKey);
      expect(retrieved.data).toEqual(testData);
      expect(retrieved.metadata).toBeDefined();
    });

    test('should detect duplicate content', async () => {
      const testData = {
        type: 'medical_record',
        patientId: 123,
        content: 'Test medical record content',
        timestamp: new Date().toISOString()
      };

      const result = await ipfsService.addEncryptedFile(testData, testEncryptionKey);
      expect(result.isNew).toBe(false); // Should be detected as duplicate
      expect(result.cid).toBe(testCid); // Should return same CID
    });

    test('should pin and unpin files', async () => {
      await ipfsService.pinFile(testCid);
      
      const pinnedFiles = await ipfsService.getPinnedFiles();
      const pinned = pinnedFiles.find(file => file.cid === testCid);
      expect(pinned).toBeDefined();

      await ipfsService.unpinFile(testCid);
      
      const unpinnedFiles = await ipfsService.getPinnedFiles();
      const stillPinned = unpinnedFiles.find(file => file.cid === testCid);
      expect(stillPinned).toBeUndefined();
    });
  });

  describe('Content Addressing Service', () => {
    test('should register and retrieve content', async () => {
      const contentType = 'test_record';
      const originalSize = JSON.stringify({ test: 'data' }).length;
      const encryptedSize = 150;

      const content = await contentAddressingService.registerContent(
        testContentHash,
        testCid,
        contentType,
        originalSize,
        encryptedSize,
        { test: true }
      );

      expect(content).toBeDefined();
      expect(content.content_hash).toBe(testContentHash);
      expect(content.ipfs_cid).toBe(testCid);

      const retrieved = await contentAddressingService.getContent(testContentHash);
      expect(retrieved).toBeDefined();
      expect(retrieved.content_hash).toBe(testContentHash);
    });

    test('should create content references', async () => {
      const result = await contentAddressingService.createContentReference(
        testContentHash,
        'medical_record',
        'test-record-123',
        1
      );

      expect(result).toBe(true);

      const references = await contentAddressingService.getContentReferences(testContentHash);
      expect(references.length).toBeGreaterThan(0);
      expect(references[0].resource_type).toBe('medical_record');
    });

    test('should calculate deduplication statistics', async () => {
      const stats = await contentAddressingService.calculateDeduplicationStats();
      expect(stats).toBeDefined();
      expect(stats.total_files).toBeGreaterThan(0);
      expect(stats.duplicate_files).toBeDefined();
      expect(stats.space_saved).toBeDefined();
    });
  });

  describe('API Endpoints', () => {
    let authToken;

    beforeAll(async () => {
      // Create a test user and get auth token
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com',
          password: 'testpassword'
        });

      if (loginResponse.status === 200) {
        authToken = loginResponse.body.token;
      }
    });

    test('should upload JSON data to IPFS', async () => {
      const testData = {
        type: 'test_medical_record',
        patientId: 123,
        content: 'Test content for IPFS upload'
      };

      const response = await request(app)
        .post('/api/ipfs/upload/json')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          data: testData,
          encryptionKey: testEncryptionKey
        });

      expect(response.status).toBe(201);
      expect(response.body.cid).toBeDefined();
      expect(response.body.contentHash).toBeDefined();
      expect(response.body.encryptionKey).toBeDefined();
    });

    test('should download and decrypt data from IPFS', async () => {
      const response = await request(app)
        .get(`/api/ipfs/download/${testCid}`)
        .set('Authorization', `Bearer ${authToken}`)
        .query({ encryptionKey: testEncryptionKey });

      expect(response.status).toBe(200);
      expect(response.body.data).toBeDefined();
      expect(response.body.metadata).toBeDefined();
    });

    test('should get IPFS statistics', async () => {
      const response = await request(app)
        .get('/api/ipfs/stats/node')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.storage).toBeDefined();
      expect(response.body.nodeType).toBeDefined();
    });

    test('should get deduplication statistics', async () => {
      const response = await request(app)
        .get('/api/ipfs/stats/deduplication')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.database).toBeDefined();
      expect(response.body.service).toBeDefined();
    });

    test('should perform health check', async () => {
      const response = await request(app)
        .get('/api/ipfs/health')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.services).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle invalid CID gracefully', async () => {
      const response = await request(app)
        .get('/api/ipfs/download/invalid-cid')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ encryptionKey: testEncryptionKey });

      expect(response.status).toBe(500);
    });

    test('should handle missing encryption key', async () => {
      const response = await request(app)
        .get(`/api/ipfs/download/${testCid}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Encryption key required');
    });

    test('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/ipfs/stats/node');

      expect(response.status).toBe(401);
    });
  });

  afterAll(async () => {
    // Cleanup test data
    if (testCid) {
      try {
        await ipfsService.unpinFile(testCid);
      } catch (error) {
        console.log('Cleanup error:', error.message);
      }
    }
  });
});
