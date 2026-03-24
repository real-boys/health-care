const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { setCache, deleteCache } = require('../middleware/cache');
const DataWarehouseService = require('../services/dataWarehouse');
const ETLService = require('../services/etl');
const ReportService = require('../services/reportGenerator');
const MLService = require('../services/mlAnalytics');

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

const dataWarehouse = new DataWarehouseService();
const etlService = new ETLService();
const reportService = new ReportService();
const mlService = new MLService();

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

// Middleware to check if user has analytics permissions
function requireAnalyticsPermission(req, res, next) {
  const userRole = req.user?.role;
  if (!['admin', 'provider'].includes(userRole)) {
    return res.status(403).json({ error: 'Insufficient permissions for analytics access' });
  }
  next();
}

// Claims Analytics Endpoints
router.get('/claims/summary', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { startDate, endDate, providerId, status } = req.query;
    const cacheKey = `analytics_claims_summary_${JSON.stringify(req.query)}`;
    
    const db = getDatabase();
    let query = `
      SELECT 
        DATE(ic.service_date) as service_date,
        COUNT(*) as total_claims,
        SUM(CASE WHEN ic.status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
        SUM(CASE WHEN ic.status = 'denied' THEN 1 ELSE 0 END) as denied_claims,
        SUM(CASE WHEN ic.status = 'paid' THEN 1 ELSE 0 END) as paid_claims,
        SUM(ic.total_amount) as total_amount,
        SUM(ic.insurance_amount) as total_insurance_amount,
        AVG(ic.total_amount) as avg_claim_amount,
        SUM(CASE WHEN ic.status = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as approval_rate
      FROM insurance_claims ic
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
    
    query += ' GROUP BY DATE(ic.service_date) ORDER BY service_date DESC LIMIT 365';
    
    const claimsSummary = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate overall metrics
    const overallMetrics = {
      totalClaims: claimsSummary.reduce((sum, day) => sum + day.total_claims, 0),
      totalAmount: claimsSummary.reduce((sum, day) => sum + parseFloat(day.total_amount || 0), 0),
      overallApprovalRate: claimsSummary.length > 0 
        ? claimsSummary.reduce((sum, day) => sum + parseFloat(day.approval_rate || 0), 0) / claimsSummary.length 
        : 0,
      averageClaimAmount: claimsSummary.length > 0
        ? claimsSummary.reduce((sum, day) => sum + parseFloat(day.avg_claim_amount || 0), 0) / claimsSummary.length
        : 0
    };
    
    res.json({
      dailyData: claimsSummary,
      overallMetrics,
      period: { startDate, endDate }
    });
    
  } catch (error) {
    next(error);
  }
});

router.get('/claims/processing-times', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { startDate, endDate, providerId } = req.query;
    
    const db = getDatabase();
    let query = `
      SELECT 
        ic.provider_name,
        COUNT(*) as total_claims,
        AVG(JULIANDAY(ic.processing_date) - JULIANDAY(ic.submission_date)) as avg_processing_days,
        MIN(JULIANDAY(ic.processing_date) - JULIANDAY(ic.submission_date)) as min_processing_days,
        MAX(JULIANDAY(ic.processing_date) - JULIANDAY(ic.submission_date)) as max_processing_days,
        SUM(CASE WHEN ic.status = 'denied' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as denial_rate
      FROM insurance_claims ic
      WHERE ic.processing_date IS NOT NULL
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND ic.submission_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND ic.submission_date <= ?';
      params.push(endDate);
    }
    
    if (providerId) {
      query += ' AND ic.provider_name LIKE ?';
      params.push(`%${providerId}%`);
    }
    
    query += ' GROUP BY ic.provider_name ORDER BY avg_processing_days ASC';
    
    const processingTimes = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    res.json({
      providerPerformance: processingTimes,
      overallAverage: processingTimes.length > 0 
        ? processingTimes.reduce((sum, p) => sum + parseFloat(p.avg_processing_days || 0), 0) / processingTimes.length 
        : 0
    });
    
  } catch (error) {
    next(error);
  }
});

// Payments Analytics Endpoints
router.get('/payments/trends', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { startDate, endDate, paymentMethod } = req.query;
    
    const db = getDatabase();
    let query = `
      SELECT 
        DATE(pp.payment_date) as payment_date,
        COUNT(*) as total_payments,
        SUM(pp.payment_amount) as total_amount,
        AVG(pp.payment_amount) as avg_payment_amount,
        SUM(CASE WHEN pp.payment_status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate,
        pp.payment_method
      FROM premium_payments pp
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
    
    query += ' GROUP BY DATE(pp.payment_date), pp.payment_method ORDER BY payment_date DESC LIMIT 365';
    
    const paymentTrends = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Aggregate by payment method
    const methodSummary = {};
    paymentTrends.forEach(trend => {
      if (!methodSummary[trend.payment_method]) {
        methodSummary[trend.payment_method] = {
          totalAmount: 0,
          totalPayments: 0,
          avgSuccessRate: 0,
          count: 0
        };
      }
      methodSummary[trend.payment_method].totalAmount += parseFloat(trend.total_amount || 0);
      methodSummary[trend.payment_method].totalPayments += trend.total_payments;
      methodSummary[trend.payment_method].avgSuccessRate += parseFloat(trend.success_rate || 0);
      methodSummary[trend.payment_method].count += 1;
    });
    
    // Calculate averages
    Object.keys(methodSummary).forEach(method => {
      const summary = methodSummary[method];
      summary.avgSuccessRate = summary.avgSuccessRate / summary.count;
    });
    
    res.json({
      dailyTrends: paymentTrends,
      methodSummary,
      totalRevenue: Object.values(methodSummary).reduce((sum, m) => sum + m.totalAmount, 0)
    });
    
  } catch (error) {
    next(error);
  }
});

// Provider Performance Analytics
router.get('/providers/performance', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { startDate, endDate, specialty } = req.query;
    
    const db = getDatabase();
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
        COUNT(DISTINCT mr.patient_id) as patients_with_records,
        COUNT(mr.id) as total_medical_records
      FROM users u
      LEFT JOIN appointments a ON u.id = a.provider_id
      LEFT JOIN medical_records mr ON u.id = mr.provider_id
      WHERE u.role = 'provider'
    `;
    
    const params = [];
    
    if (startDate) {
      query += ' AND (a.appointment_date >= ? OR mr.date_of_service >= ?)';
      params.push(startDate, startDate);
    }
    
    if (endDate) {
      query += ' AND (a.appointment_date <= ? OR mr.date_of_service <= ?)';
      params.push(endDate, endDate);
    }
    
    query += ' GROUP BY u.id, u.first_name, u.last_name ORDER BY completed_appointments DESC';
    
    const providerPerformance = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate performance metrics
    const enhancedPerformance = providerPerformance.map(provider => ({
      ...provider,
      completion_rate: provider.total_appointments > 0 
        ? (provider.completed_appointments / provider.total_appointments) * 100 
        : 0,
      cancellation_rate: provider.total_appointments > 0 
        ? (provider.cancelled_appointments / provider.total_appointments) * 100 
        : 0,
      no_show_rate: provider.total_appointments > 0 
        ? (provider.no_show_appointments / provider.total_appointments) * 100 
        : 0,
      patient_engagement: provider.total_patients > 0 
        ? (provider.patients_with_records / provider.total_patients) * 100 
        : 0
    }));
    
    res.json({
      providers: enhancedPerformance,
      summary: {
        totalProviders: enhancedPerformance.length,
        averageCompletionRate: enhancedPerformance.length > 0 
          ? enhancedPerformance.reduce((sum, p) => sum + p.completion_rate, 0) / enhancedPerformance.length 
          : 0,
        averagePatientEngagement: enhancedPerformance.length > 0 
          ? enhancedPerformance.reduce((sum, p) => sum + p.patient_engagement, 0) / enhancedPerformance.length 
          : 0
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Patient Outcomes Analytics
router.get('/patients/outcomes', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { startDate, endDate, conditionCategory } = req.query;
    
    const db = getDatabase();
    let query = `
      SELECT 
        p.id as patient_id,
        p.first_name || ' ' || p.last_name as patient_name,
        COUNT(DISTINCT mr.id) as total_treatments,
        COUNT(DISTINCT a.id) as total_appointments,
        COUNT(DISTINCT ic.id) as total_claims,
        SUM(ic.total_amount) as total_claim_amount,
        MAX(mr.date_of_service) as last_service_date,
        COUNT(DISTINCT CASE WHEN mr.record_type = 'diagnosis' THEN mr.id END) as diagnosis_count,
        COUNT(DISTINCT CASE WHEN mr.record_type = 'treatment' THEN mr.id END) as treatment_count,
        COUNT(DISTINCT CASE WHEN mr.record_type = 'prescription' THEN mr.id END) as prescription_count
      FROM patients p
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
    
    query += ' GROUP BY p.id, p.first_name, p.last_name ORDER BY total_treatments DESC LIMIT 100';
    
    const patientOutcomes = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
    
    // Calculate outcome metrics
    const enhancedOutcomes = patientOutcomes.map(patient => ({
      ...patient,
      treatment_frequency: patient.total_treatments > 0 ? patient.total_treatments / 12 : 0, // Monthly average
      appointment_frequency: patient.total_appointments > 0 ? patient.total_appointments / 12 : 0,
      average_claim_cost: patient.total_claims > 0 ? patient.total_claim_amount / patient.total_claims : 0,
      treatment_complexity: patient.diagnosis_count + patient.treatment_count + patient.prescription_count
    }));
    
    res.json({
      patients: enhancedOutcomes,
      summary: {
        totalPatients: enhancedOutcomes.length,
        averageTreatmentsPerPatient: enhancedOutcomes.length > 0 
          ? enhancedOutcomes.reduce((sum, p) => sum + p.total_treatments, 0) / enhancedOutcomes.length 
          : 0,
        averageCostPerPatient: enhancedOutcomes.length > 0 
          ? enhancedOutcomes.reduce((sum, p) => sum + parseFloat(p.total_claim_amount || 0), 0) / enhancedOutcomes.length 
          : 0
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Dashboard Overview
router.get('/dashboard/overview', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { timeRange = '30' } = req.query; // Default to last 30 days
    const daysBack = parseInt(timeRange);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysBack);
    
    const db = getDatabase();
    
    // Get all overview metrics in parallel
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
    
    // Calculate derived metrics
    const overview = {
      claims: {
        ...claimsMetrics,
        approval_rate: claimsMetrics.total_claims > 0 
          ? (claimsMetrics.approved_claims / claimsMetrics.total_claims) * 100 
          : 0,
        denial_rate: claimsMetrics.total_claims > 0 
          ? (claimsMetrics.denied_claims / claimsMetrics.total_claims) * 100 
          : 0
      },
      payments: {
        ...paymentsMetrics,
        success_rate: paymentsMetrics.total_payments > 0 
          ? (paymentsMetrics.completed_payments / paymentsMetrics.total_payments) * 100 
          : 0
      },
      appointments: {
        ...appointmentsMetrics,
        completion_rate: appointmentsMetrics.total_appointments > 0 
          ? (appointmentsMetrics.completed_appointments / appointmentsMetrics.total_appointments) * 100 
          : 0,
        cancellation_rate: appointmentsMetrics.total_appointments > 0 
          ? (appointmentsMetrics.cancelled_appointments / appointmentsMetrics.total_appointments) * 100 
          : 0
      },
      patients: patientsMetrics,
      period: {
        days: timeRange,
        startDate: startDate.toISOString().split('T')[0],
        endDate: new Date().toISOString().split('T')[0]
      }
    };
    
    res.json(overview);
    
  } catch (error) {
    next(error);
  }
});

// ETL Trigger Endpoint
router.post('/etl/trigger', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { etlType, parameters } = req.body;
    
    if (!etlType) {
      return res.status(400).json({ error: 'ETL type is required' });
    }
    
    const result = await etlService.runETLProcess(etlType, parameters);
    
    res.json({
      success: true,
      message: 'ETL process triggered successfully',
      result
    });
    
  } catch (error) {
    next(error);
  }
});

// Report Generation Endpoint
router.post('/reports/generate', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { reportType, parameters, format = 'pdf' } = req.body;
    
    if (!reportType) {
      return res.status(400).json({ error: 'Report type is required' });
    }
    
    const reportBuffer = await reportService.generateReport(reportType, parameters, format);
    
    const filename = `${reportType}_report_${new Date().toISOString().split('T')[0]}.${format}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Type', format === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    
    res.send(reportBuffer);
    
  } catch (error) {
    next(error);
  }
});

// ML Predictions Endpoint
router.get('/ml/predictions/:type', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { type } = req.params;
    const { entityId, parameters } = req.query;
    
    if (!type) {
      return res.status(400).json({ error: 'Prediction type is required' });
    }
    
    const predictions = await mlService.getPredictions(type, entityId, parameters);
    
    res.json({
      predictionType: type,
      predictions,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    next(error);
  }
});

// Data Warehouse Sync Endpoint
router.post('/warehouse/sync', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { dataType, data } = req.body;
    
    if (!dataType || !data) {
      return res.status(400).json({ error: 'Data type and data are required' });
    }
    
    const result = await dataWarehouse.syncAnalyticsData(dataType, data);
    
    res.json({
      success: true,
      message: 'Data synced to warehouse successfully',
      result
    });
    
  } catch (error) {
    next(error);
  }
});

// Warehouse Analytics Query Endpoint
router.get('/warehouse/query/:queryType', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { queryType } = req.params;
    const parameters = req.query;
    
    if (!queryType) {
      return res.status(400).json({ error: 'Query type is required' });
    }
    
    const results = await dataWarehouse.getAnalyticsData(queryType, parameters);
    
    res.json({
      queryType,
      results,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    next(error);
  }
});

module.exports = router;
