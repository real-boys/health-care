import request from 'supertest';
import express from 'express';
import jwt from 'jsonwebtoken';
import paymentsExportRoutes from '../src/routes/paymentsExport';

// Mock the export service
jest.mock('../src/services/exportService', () => ({
  exportService: {
    exportPayments: jest.fn(),
    getExportHistory: jest.fn(),
    logExport: jest.fn()
  }
}));

// Mock the date validator
jest.mock('../src/utils/dateValidator', () => ({
  dateValidator: {
    validateDateRange: jest.fn(),
    getDateRangePresets: jest.fn()
  }
}));

const mockExportService = require('../src/services/exportService').exportService;
const mockDateValidator = require('../src/utils/dateValidator').dateValidator;

describe('Payments Export API', () => {
  let app: express.Application;
  let userToken: string;
  let adminToken: string;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use('/api/payments', paymentsExportRoutes);

    // Create test tokens
    userToken = jwt.sign(
      { id: 'user123', email: 'user@test.com', role: 'user' },
      'test-secret'
    );
    
    adminToken = jwt.sign(
      { id: 'admin123', email: 'admin@test.com', role: 'admin' },
      'test-secret'
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/payments/export', () => {
    test('CSV export returns correct content-type', async () => {
      const mockExportResult = {
        data: 'Date,Transaction ID,Amount\n2023-01-01,TXN001,100.00',
        contentType: 'text/csv; charset=utf-8',
        filename: 'payment_history_2023-01-01_to_2023-01-31.csv',
        recordCount: 1
      };

      mockExportService.exportPayments.mockResolvedValue(mockExportResult);
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=csv')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.headers['content-disposition']).toContain('attachment');
      expect(res.text).toContain('Date,Transaction ID,Amount');
    });

    test('PDF export returns content-type application/pdf', async () => {
      const mockExportResult = {
        data: Buffer.from('mock pdf content'),
        contentType: 'application/pdf',
        filename: 'payment_history_2023-01-01_to_2023-01-31.pdf',
        recordCount: 1
      };

      mockExportService.exportPayments.mockResolvedValue(mockExportResult);
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=pdf')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/pdf');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('JSON export returns content-type application/json', async () => {
      const mockExportResult = {
        data: '{"exportDate":"2023-01-01","payments":[]}',
        contentType: 'application/json',
        filename: 'payment_history_2023-01-01_to_2023-01-31.json',
        recordCount: 0
      };

      mockExportService.exportPayments.mockResolvedValue(mockExportResult);
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=json')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.headers['content-disposition']).toContain('attachment');
    });

    test('Date filtering limits results correctly', async () => {
      const mockExportResult = {
        data: 'Date,Transaction ID,Amount\n2023-01-15,TXN001,100.00',
        contentType: 'text/csv; charset=utf-8',
        filename: 'payment_history_2023-01-15_to_2023-01-15.csv',
        recordCount: 1
      };

      mockExportService.exportPayments.mockImplementation(async (options) => {
        expect(options.startDate).toBe('2023-01-15');
        expect(options.endDate).toBe('2023-01-15');
        return mockExportResult;
      });
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=csv&startDate=2023-01-15&endDate=2023-01-15')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(mockExportService.exportPayments).toHaveBeenCalledWith(
        expect.objectContaining({
          format: 'csv',
          startDate: '2023-01-15',
          endDate: '2023-01-15',
          userId: 'user123',
          isAdmin: false
        })
      );
    });

    test('User can only export their own payments', async () => {
      const mockExportResult = {
        data: 'Date,Transaction ID,Amount',
        contentType: 'text/csv; charset=utf-8',
        filename: 'payment_history.csv',
        recordCount: 0
      };

      mockExportService.exportPayments.mockImplementation(async (options) => {
        expect(options.userId).toBe('user123');
        expect(options.targetUserId).toBe('user123');
        expect(options.isAdmin).toBe(false);
        return mockExportResult;
      });
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=csv')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
    });

    test('Admin can export any user\'s payments', async () => {
      const mockExportResult = {
        data: 'Date,Transaction ID,Amount',
        contentType: 'text/csv; charset=utf-8',
        filename: 'payment_history.csv',
        recordCount: 0
      };

      mockExportService.exportPayments.mockImplementation(async (options) => {
        expect(options.userId).toBe('admin123');
        expect(options.targetUserId).toBe('targetUser123');
        expect(options.isAdmin).toBe(true);
        return mockExportResult;
      });
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=csv&userId=targetUser123')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
    });

    test('Invalid date range returns 400', async () => {
      mockExportService.exportPayments.mockRejectedValue(
        new Error('Start date cannot be after end date')
      );

      const res = await request(app)
        .get('/api/payments/export?format=csv&startDate=2023-02-01&endDate=2023-01-01')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Start date cannot be after end date');
    });

    test('Empty result returns empty but valid file', async () => {
      const mockExportResult = {
        data: 'Date,Transaction ID,Amount,Currency,Status,Description,Payment Method\n',
        contentType: 'text/csv; charset=utf-8',
        filename: 'payment_history_empty.csv',
        recordCount: 0
      };

      mockExportService.exportPayments.mockResolvedValue(mockExportResult);
      mockExportService.logExport.mockResolvedValue(undefined);

      const res = await request(app)
        .get('/api/payments/export?format=csv')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/csv');
      expect(res.text).toContain('Date,Transaction ID,Amount');
      expect(res.headers['x-record-count']).toBe('0');
    });

    test('Invalid format returns 400', async () => {
      const res = await request(app)
        .get('/api/payments/export?format=xml')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid format');
    });

    test('Missing token returns 401', async () => {
      const res = await request(app)
        .get('/api/payments/export?format=csv');

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Access token required');
    });

    test('Invalid token returns 403', async () => {
      const res = await request(app)
        .get('/api/payments/export?format=csv')
        .set('Authorization', 'Bearer invalid-token');

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Invalid or expired token');
    });
  });

  describe('GET /api/payments/export/history', () => {
    test('Returns export history for user', async () => {
      const mockHistory = [
        {
          id: 1,
          format: 'csv',
          filename: 'payment_history.csv',
          record_count: 10,
          created_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockExportService.getExportHistory.mockResolvedValue(mockHistory);

      const res = await request(app)
        .get('/api/payments/export/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.history).toEqual(mockHistory);
      expect(res.body.count).toBe(1);
    });

    test('Admin gets all export history', async () => {
      const mockHistory = [
        {
          id: 1,
          user_id: 'user123',
          format: 'csv',
          filename: 'payment_history.csv',
          record_count: 10,
          user_email: 'user@test.com',
          created_at: '2023-01-01T00:00:00Z'
        }
      ];

      mockExportService.getExportHistory.mockImplementation(async (userId, isAdmin) => {
        expect(userId).toBe('admin123');
        expect(isAdmin).toBe(true);
        return mockHistory;
      });

      const res = await request(app)
        .get('/api/payments/export/history')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('GET /api/payments/export/presets', () => {
    test('Returns date range presets', async () => {
      const mockPresets = {
        'last-30-days': {
          startDate: '2023-01-01',
          endDate: '2023-01-31',
          label: 'Last 30 Days'
        }
      };

      mockDateValidator.getDateRangePresets.mockReturnValue(mockPresets);

      const res = await request(app)
        .get('/api/payments/export/presets')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.presets).toEqual(mockPresets);
    });
  });

  describe('POST /api/payments/export/validate', () => {
    test('Validates export parameters successfully', async () => {
      const mockDateValidation = {
        isValid: true,
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      };

      mockDateValidator.validateDateRange.mockReturnValue(mockDateValidation);

      const res = await request(app)
        .post('/api/payments/export/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          format: 'csv',
          startDate: '2023-01-01',
          endDate: '2023-01-31'
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.validation.valid).toBe(true);
    });

    test('Returns error for invalid format', async () => {
      const res = await request(app)
        .post('/api/payments/export/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          format: 'invalid'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain('Invalid format');
    });

    test('Returns error for invalid date range', async () => {
      const mockDateValidation = {
        isValid: false,
        error: 'Start date cannot be after end date'
      };

      mockDateValidator.validateDateRange.mockReturnValue(mockDateValidation);

      const res = await request(app)
        .post('/api/payments/export/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          format: 'csv',
          startDate: '2023-02-01',
          endDate: '2023-01-01'
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Start date cannot be after end date');
    });

    test('User cannot validate export for another user', async () => {
      const mockDateValidation = {
        isValid: true,
        startDate: '2023-01-01',
        endDate: '2023-01-31'
      };

      mockDateValidator.validateDateRange.mockReturnValue(mockDateValidation);

      const res = await request(app)
        .post('/api/payments/export/validate')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          format: 'csv',
          userId: 'otherUser123'
        });

      expect(res.status).toBe(403);
      expect(res.body.error).toContain('You can only export your own payment history');
    });
  });

  describe('GET /api/payments/export/formats', () => {
    test('Returns available export formats', async () => {
      const res = await request(app)
        .get('/api/payments/export/formats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.formats).toHaveProperty('csv');
      expect(res.body.formats).toHaveProperty('pdf');
      expect(res.body.formats).toHaveProperty('json');

      expect(res.body.formats.csv).toHaveProperty('name');
      expect(res.body.formats.csv).toHaveProperty('description');
      expect(res.body.formats.csv).toHaveProperty('mimeType');
      expect(res.body.formats.csv).toHaveProperty('features');
    });
  });

  describe('GET /api/payments/export/stats (Admin Only)', () => {
    test('Admin can access export statistics', async () => {
      const res = await request(app)
        .get('/api/payments/export/stats')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.stats).toHaveProperty('totalExports');
      expect(res.body.stats).toHaveProperty('exportsByFormat');
    });

    test('User cannot access export statistics', async () => {
      const res = await request(app)
        .get('/api/payments/export/stats')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.status).toBe(403);
      expect(res.body.error).toBe('Admin access required');
    });
  });
});
