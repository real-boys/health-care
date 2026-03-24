const request = require('supertest');
const { Pool } = require('pg');
const app = require('../server');
const fs = require('fs');
const path = require('path');

// Test database setup
const testDb = new Pool({
  connectionString: process.env.TEST_DATABASE_URL || 'postgresql://localhost:5432/healthcare_providers_test'
});

describe('Healthcare Provider Network Directory API', () => {
  let authToken;
  let adminToken;
  let providerId;
  let patientId;
  let testProvider;

  beforeAll(async () => {
    // Setup test database
    await setupTestDatabase();
    
    // Create test users and get tokens
    authToken = await getTestToken('patient');
    adminToken = await getTestToken('admin');
    
    // Create test provider
    providerId = await createTestProvider();
    
    // Create test patient
    patientId = await createTestPatient();
  });

  afterAll(async () => {
    // Cleanup test database
    await cleanupTestDatabase();
    await testDb.end();
  });

  describe('Provider Search API', () => {
    test('should search providers by location', async () => {
      const response = await request(app)
        .get('/api/providers/search')
        .query({
          latitude: 40.7128,
          longitude: -74.0060,
          radius: 25,
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('providers');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.providers)).toBe(true);
      expect(response.body.pagination.page).toBe(1);
      expect(response.body.pagination.limit).toBe(10);
    });

    test('should filter providers by specialty', async () => {
      const response = await request(app)
        .get('/api/providers/search')
        .query({
          specialty: 'cardiology',
          page: 1,
          limit: 5
        })
        .expect(200);

      expect(response.body.providers).toBeDefined();
      // Verify all results have cardiology specialty
      response.body.providers.forEach(provider => {
        expect(provider.specialties).toContain('Cardiology');
      });
    });

    test('should filter providers accepting new patients', async () => {
      const response = await request(app)
        .get('/api/providers/search')
        .query({
          accepting_new_patients: true,
          page: 1,
          limit: 5
        })
        .expect(200);

      response.body.providers.forEach(provider => {
        expect(provider.accepts_new_patients).toBe(true);
      });
    });

    test('should sort providers by rating', async () => {
      const response = await request(app)
        .get('/api/providers/search')
        .query({
          sort_by: 'rating',
          page: 1,
          limit: 5
        })
        .expect(200);

      const providers = response.body.providers;
      for (let i = 1; i < providers.length; i++) {
        expect(providers[i-1].average_rating).toBeGreaterThanOrEqual(providers[i].average_rating);
      }
    });

    test('should validate search parameters', async () => {
      const response = await request(app)
        .get('/api/providers/search')
        .query({
          latitude: 'invalid',
          longitude: 'invalid'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Provider Details API', () => {
    test('should get provider details', async () => {
      const response = await request(app)
        .get(`/api/providers/${providerId}`)
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('first_name');
      expect(response.body).toHaveProperty('last_name');
      expect(response.body).toHaveProperty('specialties');
      expect(response.body).toHaveProperty('credentials');
      expect(response.body).toHaveProperty('availability');
      expect(response.body).toHaveProperty('recent_reviews');
    });

    test('should return 404 for non-existent provider', async () => {
      const response = await request(app)
        .get('/api/providers/99999')
        .expect(404);

      expect(response.body.error).toBe('Provider not found');
    });
  });

  describe('Provider Availability API', () => {
    test('should get provider availability for date range', async () => {
      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + 7);

      const response = await request(app)
        .get(`/api/providers/${providerId}/availability`)
        .query({
          start_date: startDate.toISOString().split('T')[0],
          end_date: endDate.toISOString().split('T')[0]
        })
        .expect(200);

      expect(response.body).toHaveProperty('regular_availability');
      expect(response.body).toHaveProperty('special_availability');
      expect(response.body).toHaveProperty('existing_appointments');
    });

    test('should validate date parameters', async () => {
      const response = await request(app)
        .get(`/api/providers/${providerId}/availability`)
        .query({
          start_date: 'invalid-date',
          end_date: 'invalid-date'
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });
  });

  describe('Provider Reviews API', () => {
    test('should get provider reviews with pagination', async () => {
      const response = await request(app)
        .get(`/api/providers/${providerId}/reviews`)
        .query({
          page: 1,
          limit: 10,
          sort_by: 'date'
        })
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('pagination');
      expect(Array.isArray(response.body.reviews)).toBe(true);
    });

    test('should submit a review as patient', async () => {
      const reviewData = {
        overall_rating: 5,
        bedside_manner_rating: 5,
        wait_time_rating: 4,
        staff_friendliness_rating: 5,
        title: 'Excellent Doctor',
        review_text: 'Very professional and caring doctor.'
      };

      const response = await request(app)
        .post(`/api/providers/${providerId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(reviewData)
        .expect(201);

      expect(response.body.message).toBe('Review submitted successfully. It will be visible after moderation.');
      expect(response.body.review).toBeDefined();
    });

    test('should validate review submission', async () => {
      const response = await request(app)
        .post(`/api/providers/${providerId}/reviews`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          overall_rating: 6, // Invalid rating
          review_text: ''
        })
        .expect(400);

      expect(response.body.errors).toBeDefined();
    });

    test('should mark review as helpful', async () => {
      // First create a review
      const reviewResponse = await createTestReview(providerId, patientId);
      const reviewId = reviewResponse.id;

      const response = await request(app)
        .post(`/api/providers/${providerId}/reviews/${reviewId}/helpful`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.message).toBe('Review marked as helpful');
    });
  });

  describe('Provider Verification API', () => {
    test('should submit verification application', async () => {
      const verificationData = {
        first_name: 'John',
        last_name: 'Doe',
        npi_number: '1234567890',
        professional_title: 'MD',
        bio: 'Experienced physician specializing in internal medicine.',
        practice_name: 'Medical Clinic',
        practice_type: 'solo',
        years_of_experience: 10,
        languages_spoken: ['English', 'Spanish'],
        specialties: [{ id: 1, is_primary: true }],
        credentials: [{ id: 1, credential_number: 'MD12345' }],
        address_line1: '123 Main St',
        city: 'New York',
        state: 'NY',
        zip_code: '10001',
        phone: '+1-555-123-4567',
        email: 'john.doe@example.com'
      };

      const response = await request(app)
        .post('/api/provider-verification/submit')
        .set('Authorization', `Bearer ${authToken}`)
        .send(verificationData)
        .expect(201);

      expect(response.body.message).toBe('Verification application submitted successfully');
      expect(response.body.provider).toBeDefined();
    });

    test('should get verification status', async () => {
      const response = await request(app)
        .get('/api/provider-verification/status')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('verification_status');
    });

    test('should upload verification document', async () => {
      const testFilePath = path.join(__dirname, 'fixtures', 'test-document.pdf');
      
      // Create test file if it doesn't exist
      if (!fs.existsSync(testFilePath)) {
        fs.writeFileSync(testFilePath, 'test content');
      }

      const response = await request(app)
        .post('/api/provider-verification/documents/upload')
        .set('Authorization', `Bearer ${authToken}`)
        .field('document_type', 'license')
        .attach('document', testFilePath)
        .expect(201);

      expect(response.body.document_type).toBe('license');
      expect(response.body.provider_id).toBeDefined();
    });
  });

  describe('Review Moderation API (Admin)', () => {
    let reviewId;

    beforeAll(async () => {
      // Create a test review for moderation
      const review = await createTestReview(providerId, patientId);
      reviewId = review.id;
    });

    test('should get pending reviews for moderation', async () => {
      const response = await request(app)
        .get('/api/review-moderation/pending')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('reviews');
      expect(response.body).toHaveProperty('pagination');
    });

    test('should approve a review', async () => {
      const response = await request(app)
        .post(`/api/review-moderation/${reviewId}/approve`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          moderation_notes: 'Review approved - meets all guidelines'
        })
        .expect(200);

      expect(response.body.message).toBe('Review approved successfully');
    });

    test('should reject a review', async () => {
      // Create another review to reject
      const review = await createTestReview(providerId, patientId);
      
      const response = await request(app)
        .post(`/api/review-moderation/${review.id}/reject`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          reason: 'Review contains inappropriate content'
        })
        .expect(200);

      expect(response.body.message).toBe('Review rejected successfully');
    });

    test('should get moderation analytics', async () => {
      const response = await request(app)
        .get('/api/review-moderation/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('review_status');
      expect(response.body).toHaveProperty('monthly_trends');
      expect(response.body).toHaveProperty('rating_distribution');
    });
  });

  describe('Directory Sync API (Admin)', () => {
    test('should get providers ready for sync', async () => {
      const response = await request(app)
        .get('/api/directory-sync/providers')
        .set('Authorization', `Bearer ${adminToken}`)
        .query({
          directory: 'all',
          sync_status: 'pending',
          page: 1,
          limit: 10
        })
        .expect(200);

      expect(response.body).toHaveProperty('providers');
      expect(response.body).toHaveProperty('pagination');
    });

    test('should configure directory API settings', async () => {
      const configData = {
        api_key: 'test-api-key',
        webhook_url: 'https://example.com/webhook',
        sync_frequency: 'daily'
      };

      const response = await request(app)
        .post('/api/directory-sync/configure/healthgrades')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(configData)
        .expect(200);

      expect(response.body.message).toContain('configuration updated');
    });

    test('should get sync analytics', async () => {
      const response = await request(app)
        .get('/api/directory-sync/analytics')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('sync_status_by_directory');
      expect(response.body).toHaveProperty('success_rates');
    });
  });

  describe('Error Handling', () => {
    test('should handle 404 errors gracefully', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);
    });

    test('should handle unauthorized access', async () => {
      const response = await request(app)
        .get('/api/review-moderation/pending')
        .expect(401);

      expect(response.body.error).toBeDefined();
    });

    test('should handle forbidden access', async () => {
      const response = await request(app)
        .get('/api/review-moderation/pending')
        .set('Authorization', `Bearer ${authToken}`) // Patient token, not admin
        .expect(403);

      expect(response.body.error).toBe('Admin access required');
    });
  });

  // Helper functions
  async function setupTestDatabase() {
    // Create test tables if they don't exist
    await testDb.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        first_name TEXT,
        last_name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testDb.query(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await testDb.query(`
      CREATE TABLE IF NOT EXISTS healthcare_providers (
        id SERIAL PRIMARY KEY,
        user_id INTEGER REFERENCES users(id),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        verification_status TEXT DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }

  async function cleanupTestDatabase() {
    await testDb.query('TRUNCATE TABLE review_reports CASCADE');
    await testDb.query('TRUNCATE TABLE provider_reviews CASCADE');
    await testDb.query('TRUNCATE TABLE provider_verification_documents CASCADE');
    await testDb.query('TRUNCATE TABLE provider_directory_sync CASCADE');
    await testDb.query('TRUNCATE TABLE patients CASCADE');
    await testDb.query('TRUNCATE TABLE healthcare_providers CASCADE');
    await testDb.query('TRUNCATE TABLE users CASCADE');
  }

  async function getTestToken(role) {
    // Create test user
    const email = `test-${role}-${Date.now()}@example.com`;
    const password = 'testpassword123';
    
    await testDb.query(`
      INSERT INTO users (email, password, role, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, [email, password, role, 'Test', 'User']);

    // Generate JWT token (simplified for testing)
    const token = `test-token-${role}-${Date.now()}`;
    return token;
  }

  async function createTestProvider() {
    const result = await testDb.query(`
      INSERT INTO healthcare_providers (first_name, last_name, verification_status)
      VALUES ('Test', 'Provider', 'verified')
      RETURNING id
    `);
    return result.rows[0].id;
  }

  async function createTestPatient() {
    const userResult = await testDb.query(`
      INSERT INTO users (email, password, role, first_name, last_name)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id
    `, ['test-patient@example.com', 'password123', 'patient', 'Test', 'Patient']);

    const patientResult = await testDb.query(`
      INSERT INTO patients (user_id)
      VALUES ($1)
      RETURNING id
    `, [userResult.rows[0].id]);

    return patientResult.rows[0].id;
  }

  async function createTestReview(providerId, patientId) {
    const result = await testDb.query(`
      INSERT INTO provider_reviews (
        provider_id, patient_id, overall_rating,
        bedside_manner_rating, wait_time_rating, staff_friendliness_rating,
        title, review_text, moderation_status
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `, [
      providerId, patientId, 5, 5, 4, 5,
      'Test Review', 'This is a test review', 'pending'
    ]);

    return result.rows[0];
  }
});

// Integration tests for geospatial functionality
describe('Geospatial Search Integration', () => {
  test('should perform distance-based search', async () => {
    // This test requires actual PostGIS setup
    const response = await request(app)
      .get('/api/providers/search')
      .query({
        latitude: 40.7128,
        longitude: -74.0060,
        radius: 10,
        sort_by: 'distance'
      })
      .expect(200);

    if (response.body.providers.length > 0) {
      expect(response.body.providers[0]).toHaveProperty('distance_miles');
      expect(typeof response.body.providers[0].distance_miles).toBe('number');
    }
  });
});

// Performance tests
describe('Performance Tests', () => {
  test('should handle concurrent search requests', async () => {
    const requests = Array(10).fill().map(() =>
      request(app)
        .get('/api/providers/search')
        .query({ page: 1, limit: 20 })
    );

    const responses = await Promise.all(requests);
    responses.forEach(response => {
      expect(response.status).toBe(200);
    });
  }, 10000); // 10 second timeout
});
