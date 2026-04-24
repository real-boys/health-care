const request = require('supertest');
const mongoose = require('mongoose');
const app = require('../server');
const Document = require('../models/Document');
const User = require('../models/User');
const path = require('path');
const fs = require('fs');

describe('File Storage System', () => {
  let authToken;
  let testUser;
  let testFile;

  beforeAll(async () => {
    // Connect to test database
    await mongoose.connect(process.env.MONGODB_TEST_URI || 'mongodb://localhost:27017/insurance_portal_test');
    
    // Create test user
    testUser = new User({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      role: 'admin'
    });
    await testUser.save();
    
    // Get auth token
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'password123'
      });
    
    authToken = loginResponse.body.token;
    
    // Create test file buffer
    testFile = {
      fieldname: 'file',
      originalname: 'test-document.pdf',
      encoding: '7bit',
      mimetype: 'application/pdf',
      size: 1024,
      buffer: Buffer.from('Test PDF content')
    };
  });

  afterAll(async () => {
    // Clean up test data
    await Document.deleteMany({});
    await User.deleteMany({});
    await mongoose.connection.close();
  });

  describe('POST /api/files/upload', () => {
    it('should upload a file successfully', async () => {
      const formData = {
        documentType: 'other',
        description: 'Test document upload',
        isPublic: 'false'
      };

      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', 'tests/fixtures/test.pdf')
        .field(formData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('document');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('cdnUrl');
    });

    it('should validate file type', async () => {
      // Create a test file with invalid type
      const invalidFile = {
        fieldname: 'file',
        originalname: 'test.exe',
        encoding: '7bit',
        mimetype: 'application/x-msdownload',
        size: 1024,
        buffer: Buffer.from('Invalid file content')
      };

      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test'), 'test.exe')
        .expect(400);

      expect(response.body.error).toContain('File type');
    });

    it('should require authentication', async () => {
      await request(app)
        .post('/api/files/upload')
        .attach('file', Buffer.from('test'), 'test.pdf')
        .expect(401);
    });

    it('should validate required metadata', async () => {
      const response = await request(app)
        .post('/api/files/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .attach('file', Buffer.from('test'), 'test.pdf')
        .field({ documentType: 'invalid-type' })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('GET /api/files/:documentId', () => {
    let testDocument;

    beforeEach(async () => {
      // Create a test document
      testDocument = new Document({
        fileName: 'test-file.pdf',
        originalFileName: 'original-test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        filePath: 'test/path/test-file.pdf',
        storageType: 'aws-s3',
        fileHash: 'testhash123',
        user: testUser._id,
        documentType: 'other'
      });
      await testDocument.save();
    });

    afterEach(async () => {
      await Document.deleteMany({});
    });

    it('should retrieve a file', async () => {
      const response = await request(app)
        .get(`/api/files/${testDocument._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('document');
      expect(response.body.data).toHaveProperty('url');
      expect(response.body.data).toHaveProperty('cdnUrl');
    });

    it('should deny access to unauthorized users', async () => {
      // Create another user
      const otherUser = new User({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
        role: 'provider'
      });
      await otherUser.save();

      // Get auth token for other user
      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'password123'
        });

      const otherAuthToken = otherLoginResponse.body.token;

      await request(app)
        .get(`/api/files/${testDocument._id}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);
    });

    it('should return 404 for non-existent document', async () => {
      await request(app)
        .get(`/api/files/${new mongoose.Types.ObjectId()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('GET /api/files/:documentId/download', () => {
    let testDocument;

    beforeEach(async () => {
      testDocument = new Document({
        fileName: 'test-file.pdf',
        originalFileName: 'original-test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        filePath: 'test/path/test-file.pdf',
        storageType: 'aws-s3',
        fileHash: 'testhash123',
        user: testUser._id,
        documentType: 'other'
      });
      await testDocument.save();
    });

    afterEach(async () => {
      await Document.deleteMany({});
    });

    it('should generate download URL', async () => {
      const response = await request(app)
        .get(`/api/files/${testDocument._id}/download`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('signedUrl');
      expect(response.body.data).toHaveProperty('cdnSignedUrl');
      expect(response.body.data).toHaveProperty('expiresIn');
      expect(response.body.data).toHaveProperty('fileName');
    });

    it('should respect custom expiration time', async () => {
      const response = await request(app)
        .get(`/api/files/${testDocument._id}/download?expiresIn=7200`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.expiresIn).toBe(7200);
    });
  });

  describe('DELETE /api/files/:documentId', () => {
    let testDocument;

    beforeEach(async () => {
      testDocument = new Document({
        fileName: 'test-file.pdf',
        originalFileName: 'original-test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        filePath: 'test/path/test-file.pdf',
        storageType: 'aws-s3',
        fileHash: 'testhash123',
        user: testUser._id,
        documentType: 'other'
      });
      await testDocument.save();
    });

    afterEach(async () => {
      await Document.deleteMany({});
    });

    it('should delete a file', async () => {
      const response = await request(app)
        .delete(`/api/files/${testDocument._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      
      // Verify document is soft deleted
      const deletedDoc = await Document.findById(testDocument._id);
      expect(deletedDoc.status).toBe('deleted');
    });

    it('should deny deletion to non-owners', async () => {
      // Create another user
      const otherUser = new User({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
        role: 'provider'
      });
      await otherUser.save();

      // Get auth token for other user
      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'password123'
        });

      const otherAuthToken = otherLoginResponse.body.token;

      await request(app)
        .delete(`/api/files/${testDocument._id}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);
    });
  });

  describe('GET /api/files/user/:userId', () => {
    beforeEach(async () => {
      // Create test documents
      for (let i = 0; i < 5; i++) {
        const doc = new Document({
          fileName: `test-file-${i}.pdf`,
          originalFileName: `original-test-${i}.pdf`,
          fileSize: 1024,
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          filePath: `test/path/test-file-${i}.pdf`,
          storageType: 'aws-s3',
          fileHash: `testhash${i}`,
          user: testUser._id,
          documentType: 'other'
        });
        await doc.save();
      }
    });

    afterEach(async () => {
      await Document.deleteMany({});
    });

    it('should return user documents', async () => {
      const response = await request(app)
        .get(`/api/files/user/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('documents');
      expect(response.body.data).toHaveProperty('pagination');
      expect(response.body.data.documents).toHaveLength(5);
    });

    it('should paginate results', async () => {
      const response = await request(app)
        .get(`/api/files/user/${testUser._id}?page=1&limit=2`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.documents).toHaveLength(2);
      expect(response.body.data.pagination.page).toBe(1);
      expect(response.body.data.pagination.limit).toBe(2);
      expect(response.body.data.pagination.total).toBe(5);
    });

    it('should filter by document type', async () => {
      // Update one document to have different type
      await Document.findOneAndUpdate(
        { user: testUser._id },
        { documentType: 'invoice' }
      );

      const response = await request(app)
        .get(`/api/files/user/${testUser._id}?documentType=invoice`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.data.documents).toHaveLength(1);
      expect(response.body.data.documents[0].documentType).toBe('invoice');
    });
  });

  describe('POST /api/files/:documentId/share', () => {
    let testDocument;
    let otherUser;

    beforeEach(async () => {
      testDocument = new Document({
        fileName: 'test-file.pdf',
        originalFileName: 'original-test.pdf',
        fileSize: 1024,
        mimeType: 'application/pdf',
        fileExtension: '.pdf',
        filePath: 'test/path/test-file.pdf',
        storageType: 'aws-s3',
        fileHash: 'testhash123',
        user: testUser._id,
        documentType: 'other'
      });
      await testDocument.save();

      otherUser = new User({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
        role: 'provider'
      });
      await otherUser.save();
    });

    afterEach(async () => {
      await Document.deleteMany({});
      await User.deleteMany({ username: 'otheruser' });
    });

    it('should share file with another user', async () => {
      const shareData = {
        userId: otherUser._id,
        permission: 'view'
      };

      const response = await request(app)
        .post(`/api/files/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.sharedWith).toHaveLength(1);
      expect(response.body.data.sharedWith[0].user.toString()).toBe(otherUser._id.toString());
      expect(response.body.data.sharedWith[0].permission).toBe('view');
    });

    it('should validate permission values', async () => {
      const shareData = {
        userId: otherUser._id,
        permission: 'invalid-permission'
      };

      await request(app)
        .post(`/api/files/${testDocument._id}/share`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(shareData)
        .expect(400);
    });
  });

  describe('GET /api/files/analytics/:userId', () => {
    beforeEach(async () => {
      // Create test documents with different types
      const documentTypes = ['invoice', 'receipt', 'medical-report', 'other'];
      for (let i = 0; i < 10; i++) {
        const doc = new Document({
          fileName: `test-file-${i}.pdf`,
          originalFileName: `original-test-${i}.pdf`,
          fileSize: 1024 * (i + 1),
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          filePath: `test/path/test-file-${i}.pdf`,
          storageType: 'aws-s3',
          fileHash: `testhash${i}`,
          user: testUser._id,
          documentType: documentTypes[i % 4],
          downloadCount: i
        });
        await doc.save();
      }
    });

    afterEach(async () => {
      await Document.deleteMany({});
    });

    it('should return file analytics', async () => {
      const response = await request(app)
        .get(`/api/files/analytics/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('storageStats');
      expect(response.body.data).toHaveProperty('recentFiles');
      expect(response.body.data).toHaveProperty('mostDownloaded');
      expect(response.body.data).toHaveProperty('sharedWithMe');
      expect(response.body.data).toHaveProperty('storageTrends');
      expect(response.body.data).toHaveProperty('totalFiles');
      expect(response.body.data).toHaveProperty('totalSize');
      expect(response.body.data).toHaveProperty('totalDownloads');
    });

    it('should deny access to other users analytics', async () => {
      // Create another user
      const otherUser = new User({
        username: 'otheruser',
        email: 'other@example.com',
        password: 'password123',
        role: 'provider'
      });
      await otherUser.save();

      // Get auth token for other user
      const otherLoginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'other@example.com',
          password: 'password123'
        });

      const otherAuthToken = otherLoginResponse.body.token;

      await request(app)
        .get(`/api/files/analytics/${testUser._id}`)
        .set('Authorization', `Bearer ${otherAuthToken}`)
        .expect(403);
    });
  });

  describe('GET /api/files/storage/stats/:userId', () => {
    beforeEach(async () => {
      // Create test documents
      for (let i = 0; i < 5; i++) {
        const doc = new Document({
          fileName: `test-file-${i}.pdf`,
          originalFileName: `original-test-${i}.pdf`,
          fileSize: 1024 * (i + 1),
          mimeType: 'application/pdf',
          fileExtension: '.pdf',
          filePath: `test/path/test-file-${i}.pdf`,
          storageType: 'aws-s3',
          fileHash: `testhash${i}`,
          user: testUser._id,
          documentType: 'other'
        });
        await doc.save();
      }
    });

    afterEach(async () => {
      await Document.deleteMany({});
    });

    it('should return storage statistics', async () => {
      const response = await request(app)
        .get(`/api/files/storage/stats/${testUser._id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('byType');
      expect(response.body.data).toHaveProperty('summary');
      expect(response.body.data.summary.totalFiles).toBe(5);
    });
  });
});
