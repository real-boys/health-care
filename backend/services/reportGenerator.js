const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

class ReportService {
    constructor() {
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    }

    async generateReport(reportType, parameters = {}, format = 'pdf') {
        try {
            let data;
            
            switch (reportType) {
                case 'claims_summary':
                    data = await this.getClaimsSummaryData(parameters);
                    break;
                case 'payments_analysis':
                    data = await this.getPaymentsAnalysisData(parameters);
                    break;
                case 'provider_performance':
                    data = await this.getProviderPerformanceData(parameters);
                    break;
                case 'patient_outcomes':
                    data = await this.getPatientOutcomesData(parameters);
                    break;
                case 'revenue_forecast':
                    data = await this.getRevenueForecastData(parameters);
                    break;
                case 'cost_analysis':
                    data = await this.getCostAnalysisData(parameters);
                    break;
                case 'executive_dashboard':
                    data = await this.getExecutiveDashboardData(parameters);
                    break;
                default:
                    throw new Error(`Unknown report type: ${reportType}`);
            }
            
            if (format === 'excel') {
                return this.generateExcelReport(reportType, data, parameters);
            } else {
                return this.generatePDFReport(reportType, data, parameters);
            }
            
        } catch (error) {
            console.error('Report generation error:', error);
            throw error;
        }
    }

    async getClaimsSummaryData(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, providerId, status } = parameters;
        
        let query = `
            SELECT 
                ic.claim_number,
                ic.service_date,
                ic.submission_date,
                ic.processing_date,
                ic.payment_date,
                ic.provider_name,
                ic.total_amount,
                ic.insurance_amount,
                ic.patient_responsibility,
                ic.status,
                ic.denial_reason,
                p.first_name || ' ' || p.last_name as patient_name,
                p.insurance_provider,
                ROUND(JULIANDAY(ic.processing_date) - JULIANDAY(ic.submission_date)) as processing_days
            FROM insurance_claims ic
            LEFT JOIN patients pt ON ic.patient_id = pt.id
            LEFT JOIN users p ON pt.user_id = p.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate) {
            query += ' AND ic.service_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND ic.service_date <= ?';
            params.push(endDate);
        }
        
        if (providerId) {
            query += ' AND ic.provider_name LIKE ?';
            params.push(`%${providerId}%`);
        }
        
        if (status) {
            query += ' AND ic.status = ?';
            params.push(status);
        }
        
        query += ' ORDER BY ic.service_date DESC';
        
        const claims = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Calculate summary statistics
        const summary = {
            totalClaims: claims.length,
            totalAmount: claims.reduce((sum, claim) => sum + parseFloat(claim.total_amount || 0), 0),
            approvedClaims: claims.filter(c => c.status === 'approved').length,
            deniedClaims: claims.filter(c => c.status === 'denied').length,
            paidClaims: claims.filter(c => c.status === 'paid').length,
            averageProcessingDays: claims.length > 0 
                ? claims.reduce((sum, claim) => sum + (claim.processing_days || 0), 0) / claims.length 
                : 0,
            approvalRate: claims.length > 0 
                ? (claims.filter(c => c.status === 'approved').length / claims.length) * 100 
                : 0
        };
        
        return { claims, summary, parameters };
    }

    async getPaymentsAnalysisData(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, paymentMethod } = parameters;
        
        let query = `
            SELECT 
                pp.payment_date,
                pp.payment_amount,
                pp.payment_method,
                pp.payment_status,
                pp.transaction_id,
                pp.insurance_provider,
                p.first_name || ' ' || p.last_name as patient_name,
                ic.claim_number
            FROM premium_payments pp
            LEFT JOIN patients pt ON pp.patient_id = pt.id
            LEFT JOIN users p ON pt.user_id = p.id
            LEFT JOIN insurance_claims ic ON pp.patient_id = ic.patient_id 
                AND pp.payment_date BETWEEN ic.service_date AND DATE(ic.service_date, '+30 days')
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate) {
            query += ' AND pp.payment_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND pp.payment_date <= ?';
            params.push(endDate);
        }
        
        if (paymentMethod) {
            query += ' AND pp.payment_method = ?';
            params.push(paymentMethod);
        }
        
        query += ' ORDER BY pp.payment_date DESC';
        
        const payments = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const summary = {
            totalPayments: payments.length,
            totalAmount: payments.reduce((sum, payment) => sum + parseFloat(payment.payment_amount || 0), 0),
            completedPayments: payments.filter(p => p.payment_status === 'completed').length,
            failedPayments: payments.filter(p => p.payment_status === 'failed').length,
            successRate: payments.length > 0 
                ? (payments.filter(p => p.payment_status === 'completed').length / payments.length) * 100 
                : 0,
            averagePaymentAmount: payments.length > 0 
                ? payments.reduce((sum, payment) => sum + parseFloat(payment.payment_amount || 0), 0) / payments.length 
                : 0
        };
        
        return { payments, summary, parameters };
    }

    async getProviderPerformanceData(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, providerId } = parameters;
        
        let query = `
            SELECT 
                u.id as provider_id,
                u.first_name || ' ' || u.last_name as provider_name,
                COUNT(DISTINCT a.patient_id) as total_patients,
                COUNT(a.id) as total_appointments,
                SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
                SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments,
                SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) as no_show_appointments,
                AVG(a.duration_minutes) as avg_appointment_duration,
                COUNT(DISTINCT mr.id) as total_medical_records,
                COALESCE(SUM(ic.total_amount), 0) as total_revenue
            FROM users u
            LEFT JOIN appointments a ON u.id = a.provider_id
            LEFT JOIN medical_records mr ON u.id = mr.provider_id
            LEFT JOIN insurance_claims ic ON u.first_name || ' ' || u.last_name = ic.provider_name
            WHERE u.role = 'provider'
        `;
        
        const params = [];
        
        if (startDate) {
            query += ' AND (a.appointment_date >= ? OR mr.date_of_service >= ? OR ic.service_date >= ?)';
            params.push(startDate, startDate, startDate);
        }
        
        if (endDate) {
            query += ' AND (a.appointment_date <= ? OR mr.date_of_service <= ? OR ic.service_date <= ?)';
            params.push(endDate, endDate, endDate);
        }
        
        if (providerId) {
            query += ' AND u.id = ?';
            params.push(providerId);
        }
        
        query += ' GROUP BY u.id ORDER BY total_revenue DESC';
        
        const providers = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        const enhancedProviders = providers.map(provider => ({
            ...provider,
            completion_rate: provider.total_appointments > 0 
                ? (provider.completed_appointments / provider.total_appointments) * 100 
                : 0,
            cancellation_rate: provider.total_appointments > 0 
                ? (provider.cancelled_appointments / provider.total_appointments) * 100 
                : 0,
            no_show_rate: provider.total_appointments > 0 
                ? (provider.no_show_appointments / provider.total_appointments) * 100 
                : 0
        }));
        
        return { providers: enhancedProviders, parameters };
    }

    async getPatientOutcomesData(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, conditionCategory } = parameters;
        
        let query = `
            SELECT 
                p.id as patient_id,
                p.first_name || ' ' || p.last_name as patient_name,
                COUNT(DISTINCT mr.id) as total_treatments,
                COUNT(DISTINCT a.id) as total_appointments,
                COUNT(DISTINCT ic.id) as total_claims,
                SUM(ic.total_amount) as total_cost,
                MAX(mr.date_of_service) as last_treatment_date,
                GROUP_CONCAT(DISTINCT mr.record_type) as treatment_types
            FROM patients p
            LEFT JOIN users u ON p.user_id = u.id
            LEFT JOIN medical_records mr ON p.id = mr.patient_id
            LEFT JOIN appointments a ON p.id = a.patient_id
            LEFT JOIN insurance_claims ic ON p.id = ic.patient_id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate) {
            query += ' AND (mr.date_of_service >= ? OR a.appointment_date >= ? OR ic.service_date >= ?)';
            params.push(startDate, startDate, startDate);
        }
        
        if (endDate) {
            query += ' AND (mr.date_of_service <= ? OR a.appointment_date <= ? OR ic.service_date <= ?)';
            params.push(endDate, endDate, endDate);
        }
        
        query += ' GROUP BY p.id ORDER BY total_treatments DESC';
        
        const patients = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        return { patients, parameters };
    }

    async getRevenueForecastData(parameters) {
        const db = this.getDatabase();
        const { months = 12 } = parameters;
        
        const query = `
            SELECT 
                DATE(payment_date, 'start of month') as month,
                SUM(payment_amount) as revenue,
                COUNT(*) as payment_count,
                AVG(payment_amount) as avg_payment
            FROM premium_payments
            WHERE payment_status = 'completed'
            AND payment_date >= DATE('now', '-${months} months')
            GROUP BY DATE(payment_date, 'start of month')
            ORDER BY month ASC
        `;
        
        const revenue = await new Promise((resolve, reject) => {
            db.all(query, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Simple linear regression for forecasting
        const forecast = this.calculateLinearForecast(revenue, 3);
        
        return { historical: revenue, forecast, parameters };
    }

    async getCostAnalysisData(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, procedureCategory } = parameters;
        
        let query = `
            SELECT 
                ic.procedure_codes,
                ic.total_amount,
                ic.insurance_amount,
                ic.patient_responsibility,
                ic.status,
                ic.provider_name,
                ic.service_date,
                p.first_name || ' ' || p.last_name as patient_name
            FROM insurance_claims ic
            LEFT JOIN patients pt ON ic.patient_id = pt.id
            LEFT JOIN users p ON pt.user_id = p.id
            WHERE 1=1
        `;
        
        const params = [];
        
        if (startDate) {
            query += ' AND ic.service_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND ic.service_date <= ?';
            params.push(endDate);
        }
        
        query += ' ORDER BY ic.total_amount DESC';
        
        const costs = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Group by procedure categories
        const categoryAnalysis = _.groupBy(costs, 'procedure_codes');
        const categorySummary = Object.keys(categoryAnalysis).map(category => ({
            category,
            count: categoryAnalysis[category].length,
            totalCost: categoryAnalysis[category].reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0),
            averageCost: categoryAnalysis[category].reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0) / categoryAnalysis[category].length,
            denialRate: (categoryAnalysis[category].filter(item => item.status === 'denied').length / categoryAnalysis[category].length) * 100
        }));
        
        return { costs, categorySummary, parameters };
    }

    async getExecutiveDashboardData(parameters) {
        const db = this.getDatabase();
        const { timeRange = '30' } = parameters;
        const daysBack = parseInt(timeRange);
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysBack);
        
        // Get all key metrics
        const [
            claimsMetrics,
            paymentsMetrics,
            appointmentsMetrics,
            patientsMetrics
        ] = await Promise.all([
            // Claims metrics
            new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        COUNT(*) as total_claims,
                        SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
                        SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied_claims,
                        SUM(total_amount) as total_amount,
                        AVG(total_amount) as avg_amount
                    FROM insurance_claims
                    WHERE submission_date >= ?
                `;
                db.all(query, [startDate.toISOString().split('T')[0]], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0] || {});
                });
            }),
            
            // Payments metrics
            new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        COUNT(*) as total_payments,
                        SUM(payment_amount) as total_amount,
                        AVG(payment_amount) as avg_amount,
                        SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments
                    FROM premium_payments
                    WHERE payment_date >= ?
                `;
                db.all(query, [startDate.toISOString().split('T')[0]], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0] || {});
                });
            }),
            
            // Appointments metrics
            new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        COUNT(*) as total_appointments,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
                        SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments,
                        COUNT(DISTINCT patient_id) as unique_patients
                    FROM appointments
                    WHERE appointment_date >= ?
                `;
                db.all(query, [startDate.toISOString()], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0] || {});
                });
            }),
            
            // Patients metrics
            new Promise((resolve, reject) => {
                const query = `
                    SELECT 
                        COUNT(*) as total_patients,
                        COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_patients
                    FROM patients
                `;
                db.all(query, [startDate.toISOString()], (err, rows) => {
                    if (err) reject(err);
                    else resolve(rows[0] || {});
                });
            })
        ]);
        
        return {
            claims: claimsMetrics,
            payments: paymentsMetrics,
            appointments: appointmentsMetrics,
            patients: patientsMetrics,
            period: {
                days: timeRange,
                startDate: startDate.toISOString().split('T')[0],
                endDate: new Date().toISOString().split('T')[0]
            },
            parameters
        };
    }

    async generatePDFReport(reportType, data, parameters) {
        return new Promise((resolve, reject) => {
            const doc = new PDFDocument();
            const chunks = [];
            
            doc.on('data', chunk => chunks.push(chunk));
            doc.on('end', () => resolve(Buffer.concat(chunks)));
            doc.on('error', reject);
            
            // Add content to PDF
            this.addPDFContent(doc, reportType, data, parameters);
            doc.end();
        });
    }

    async generateExcelReport(reportType, data, parameters) {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet(reportType.replace(/_/g, ' ').toUpperCase());
        
        // Add content to Excel
        this.addExcelContent(worksheet, reportType, data, parameters);
        
        return workbook.xlsx.writeBuffer();
    }

    addPDFContent(doc, reportType, data, parameters) {
        // Header
        doc.fontSize(20).text(`${reportType.replace(/_/g, ' ').toUpperCase()} REPORT`, { align: 'center' });
        doc.moveDown();
        
        // Date range
        if (parameters.startDate || parameters.endDate) {
            doc.fontSize(12).text(`Period: ${parameters.startDate || 'Beginning'} to ${parameters.endDate || 'Present'}`);
            doc.moveDown();
        }
        
        // Generated date
        doc.fontSize(10).text(`Generated: ${moment().format('YYYY-MM-DD HH:mm:ss')}`);
        doc.moveDown();
        
        // Summary section
        if (data.summary) {
            doc.fontSize(14).text('SUMMARY', { underline: true });
            doc.moveDown();
            
            Object.entries(data.summary).forEach(([key, value]) => {
                const label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
                doc.fontSize(11).text(`${label}: ${typeof value === 'number' ? value.toFixed(2) : value}`);
            });
            doc.moveDown();
        }
        
        // Data section
        if (data.claims || data.payments || data.providers || data.patients || data.historical) {
            doc.fontSize(14).text('DETAILED DATA', { underline: true });
            doc.moveDown();
            
            const dataArray = data.claims || data.payments || data.providers || data.patients || data.historical;
            
            if (dataArray && dataArray.length > 0) {
                // Table headers
                const headers = Object.keys(dataArray[0]);
                doc.fontSize(10);
                
                headers.forEach((header, index) => {
                    const x = 50 + (index * 100);
                    const y = doc.y;
                    doc.text(header.replace(/_/g, ' ').toUpperCase(), x, y);
                });
                
                doc.moveDown();
                
                // Table rows
                dataArray.slice(0, 20).forEach(row => {
                    headers.forEach((header, index) => {
                        const x = 50 + (index * 100);
                        const y = doc.y;
                        const value = row[header];
                        doc.text(value ? value.toString() : '', x, y);
                    });
                    doc.moveDown();
                });
                
                if (dataArray.length > 20) {
                    doc.text(`... and ${dataArray.length - 20} more records`);
                }
            }
        }
    }

    addExcelContent(worksheet, reportType, data, parameters) {
        // Title
        worksheet.mergeCells('A1:D1');
        worksheet.getCell('A1').value = `${reportType.replace(/_/g, ' ').toUpperCase()} REPORT`;
        worksheet.getCell('A1').font = { bold: true, size: 16 };
        
        // Parameters
        let row = 3;
        worksheet.getCell(`A${row}`).value = 'Parameters:';
        worksheet.getCell(`A${row}`).font = { bold: true };
        row++;
        
        Object.entries(parameters).forEach(([key, value]) => {
            worksheet.getCell(`A${row}`).value = key.replace(/_/g, ' ').toUpperCase();
            worksheet.getCell(`B${row}`).value = value;
            row++;
        });
        
        row++;
        
        // Summary
        if (data.summary) {
            worksheet.getCell(`A${row}`).value = 'Summary:';
            worksheet.getCell(`A${row}`).font = { bold: true };
            row++;
            
            Object.entries(data.summary).forEach(([key, value]) => {
                worksheet.getCell(`A${row}`).value = key.replace(/_/g, ' ').toUpperCase();
                worksheet.getCell(`B${row}`).value = typeof value === 'number' ? value.toFixed(2) : value;
                row++;
            });
            
            row++;
        }
        
        // Data table
        const dataArray = data.claims || data.payments || data.providers || data.patients || data.historical;
        
        if (dataArray && dataArray.length > 0) {
            worksheet.getCell(`A${row}`).value = 'Data:';
            worksheet.getCell(`A${row}`).font = { bold: true };
            row++;
            
            // Headers
            const headers = Object.keys(dataArray[0]);
            headers.forEach((header, index) => {
                const cell = worksheet.getCell(row, index + 1);
                cell.value = header.replace(/_/g, ' ').toUpperCase();
                cell.font = { bold: true };
                cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
            });
            row++;
            
            // Data rows
            dataArray.forEach(item => {
                headers.forEach((header, index) => {
                    worksheet.getCell(row, index + 1).value = item[header] || '';
                });
                row++;
            });
            
            // Auto-fit columns
            worksheet.columns.forEach(column => {
                column.width = 15;
            });
        }
    }

    calculateLinearForecast(data, periods) {
        if (data.length < 2) return [];
        
        const n = data.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        data.forEach((point, index) => {
            const x = index;
            const y = parseFloat(point.revenue || 0);
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        const intercept = (sumY - slope * sumX) / n;
        
        const forecast = [];
        const lastDate = moment(data[data.length - 1].month);
        
        for (let i = 1; i <= periods; i++) {
            const x = n + i - 1;
            const predictedRevenue = slope * x + intercept;
            const forecastDate = lastDate.clone().add(i, 'months');
            
            forecast.push({
                month: forecastDate.format('YYYY-MM-DD'),
                revenue: Math.max(0, predictedRevenue),
                is_forecast: true
            });
        }
        
        return forecast;
    }

    getDatabase() {
        return new sqlite3.Database(this.dbPath);
    }
}

module.exports = ReportService;
