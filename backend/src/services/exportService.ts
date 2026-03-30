import { Database } from 'sqlite3';
import { csvGenerator } from '../utils/csvGenerator';
import { pdfGenerator } from '../utils/pdfGenerator';
import { dateValidator } from '../utils/dateValidator';
import path from 'path';

interface PaymentRecord {
  id: number;
  patient_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method: string;
  payment_status: string;
  transaction_id?: string;
  description?: string;
  currency?: string;
  insurance_provider?: string;
  policy_number?: string;
}

interface ExportOptions {
  format: 'csv' | 'pdf' | 'json';
  startDate?: string;
  endDate?: string;
  userId?: string;
  isAdmin?: boolean;
  targetUserId?: string;
}

interface ExportResult {
  data: string | Buffer;
  contentType: string;
  filename: string;
  recordCount: number;
}

class ExportService {
  private dbPath: string;

  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../../database/healthcare.db');
  }

  async exportPayments(options: ExportOptions): Promise<ExportResult> {
    const { format, startDate, endDate, userId, isAdmin, targetUserId } = options;
    
    // Validate date range
    const dateValidation = dateValidator.validateDateRange(startDate, endDate);
    if (!dateValidation.isValid) {
      throw new Error(dateValidation.error);
    }

    // Determine which user's payments to export
    const exportUserId = isAdmin && targetUserId ? targetUserId : userId;
    if (!exportUserId) {
      throw new Error('User ID is required');
    }

    // Get payment records
    const payments = await this.getPaymentRecords(exportUserId, dateValidation.startDate, dateValidation.endDate);
    
    // Generate export based on format
    switch (format) {
      case 'csv':
        return this.generateCSVExport(payments, dateValidation.startDate, dateValidation.endDate);
      case 'pdf':
        return this.generatePDFExport(payments, exportUserId, dateValidation.startDate, dateValidation.endDate);
      case 'json':
        return this.generateJSONExport(payments, dateValidation.startDate, dateValidation.endDate);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  private async getPaymentRecords(userId: string, startDate?: string, endDate?: string): Promise<PaymentRecord[]> {
    return new Promise((resolve, reject) => {
      const db = new Database(this.dbPath);
      
      let query = `
        SELECT 
          pp.id,
          pp.patient_id,
          pp.payment_amount,
          pp.payment_date,
          pp.payment_method,
          pp.payment_status,
          pp.transaction_id,
          pp.description,
          COALESCE(pp.currency, 'USD') as currency,
          ip.insurance_provider,
          ip.policy_number
        FROM premium_payments pp
        LEFT JOIN insurance_policies ip ON pp.policy_id = ip.id
        WHERE pp.patient_id = ?
      `;
      
      const params: any[] = [userId];
      
      if (startDate) {
        query += ' AND pp.payment_date >= ?';
        params.push(startDate);
      }
      
      if (endDate) {
        query += ' AND pp.payment_date <= ?';
        params.push(endDate);
      }
      
      query += ' ORDER BY pp.payment_date DESC LIMIT 1000';
      
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as PaymentRecord[]);
        }
      });
      
      db.close();
    });
  }

  private generateCSVExport(payments: PaymentRecord[], startDate?: string, endDate?: string): ExportResult {
    const csvData = csvGenerator.generatePaymentCSV(payments);
    const dateRange = this.getDateRangeString(startDate, endDate);
    const filename = `payment_history_${dateRange}.csv`;
    
    return {
      data: csvData,
      contentType: 'text/csv; charset=utf-8',
      filename,
      recordCount: payments.length
    };
  }

  private generatePDFExport(payments: PaymentRecord[], userId: string, startDate?: string, endDate?: string): ExportResult {
    const pdfBuffer = pdfGenerator.generatePaymentPDF(payments, userId, startDate, endDate);
    const dateRange = this.getDateRangeString(startDate, endDate);
    const filename = `payment_history_${dateRange}.pdf`;
    
    return {
      data: pdfBuffer,
      contentType: 'application/pdf',
      filename,
      recordCount: payments.length
    };
  }

  private generateJSONExport(payments: PaymentRecord[], startDate?: string, endDate?: string): ExportResult {
    const jsonData = JSON.stringify({
      exportDate: new Date().toISOString(),
      dateRange: {
        startDate,
        endDate
      },
      recordCount: payments.length,
      payments: payments
    }, null, 2);
    
    const dateRange = this.getDateRangeString(startDate, endDate);
    const filename = `payment_history_${dateRange}.json`;
    
    return {
      data: jsonData,
      contentType: 'application/json',
      filename,
      recordCount: payments.length
    };
  }

  private getDateRangeString(startDate?: string, endDate?: string): string {
    if (startDate && endDate) {
      return `${startDate}_to_${endDate}`;
    }
    const today = new Date().toISOString().split('T')[0];
    return `${today}`;
  }

  async getExportHistory(userId: string, isAdmin: boolean = false): Promise<any[]> {
    return new Promise((resolve, reject) => {
      const db = new Database(this.dbPath);
      
      let query = `
        SELECT 
          id,
          user_id,
          format,
          filename,
          record_count,
          date_range_start,
          date_range_end,
          created_at
        FROM export_history
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `;
      
      const params = [userId];
      
      if (isAdmin) {
        query = `
          SELECT 
            eh.id,
            eh.user_id,
            eh.format,
            eh.filename,
            eh.record_count,
            eh.date_range_start,
            eh.date_range_end,
            eh.created_at,
            u.email as user_email
          FROM export_history eh
          LEFT JOIN users u ON eh.user_id = u.id
          ORDER BY eh.created_at DESC
          LIMIT 100
        `;
        params.length = 0;
      }
      
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
      
      db.close();
    });
  }

  async logExport(userId: string, format: string, filename: string, recordCount: number, startDate?: string, endDate?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const db = new Database(this.dbPath);
      
      const query = `
        INSERT INTO export_history (
          user_id, format, filename, record_count, date_range_start, date_range_end, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
      `;
      
      db.run(query, [userId, format, filename, recordCount, startDate, endDate], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
      
      db.close();
    });
  }
}

export const exportService = new ExportService();
