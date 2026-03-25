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

// Advanced Interactive Charts Endpoint
router.get('/charts/:chartType', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { chartType } = req.params;
    const { startDate, endDate, filters = '{}' } = req.query;
    const parsedFilters = JSON.parse(filters);
    
    const db = getDatabase();
    let chartData = {};
    
    switch (chartType) {
      case 'claims-timeline':
        chartData = await getClaimsTimelineData(db, startDate, endDate, parsedFilters);
        break;
      case 'payment-methods':
        chartData = await getPaymentMethodsData(db, startDate, endDate, parsedFilters);
        break;
      case 'provider-performance':
        chartData = await getProviderPerformanceChartData(db, startDate, endDate, parsedFilters);
        break;
      case 'patient-outcomes':
        chartData = await getPatientOutcomesChartData(db, startDate, endDate, parsedFilters);
        break;
      case 'revenue-trends':
        chartData = await getRevenueTrendsData(db, startDate, endDate, parsedFilters);
        break;
      case 'claims-status-distribution':
        chartData = await getClaimsStatusDistribution(db, startDate, endDate, parsedFilters);
        break;
      default:
        return res.status(400).json({ error: 'Invalid chart type' });
    }
    
    res.json({
      chartType,
      data: chartData,
      filters: parsedFilters,
      period: { startDate, endDate },
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    next(error);
  }
});

// Custom Report Builder Endpoint
router.post('/reports/custom', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { 
      reportName,
      dataSource,
      metrics,
      dimensions,
      filters,
      aggregations,
      sortBy,
      limit = 100
    } = req.body;
    
    if (!dataSource || !metrics || !Array.isArray(metrics)) {
      return res.status(400).json({ error: 'Data source and metrics are required' });
    }
    
    const db = getDatabase();
    const customReport = await generateCustomReport(db, {
      dataSource,
      metrics,
      dimensions,
      filters,
      aggregations,
      sortBy,
      limit
    });
    
    res.json({
      reportName,
      data: customReport,
      metadata: {
        totalRecords: customReport.length,
        dataSource,
        metrics,
        dimensions,
        generatedAt: new Date().toISOString()
      }
    });
    
  } catch (error) {
    next(error);
  }
});

// Enhanced Data Export Endpoint
router.post('/export/:format', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { format } = req.params;
    const { reportType, data, filename, options = '{}' } = req.body;
    const parsedOptions = JSON.parse(options);
    
    if (!['csv', 'pdf', 'excel', 'json'].includes(format)) {
      return res.status(400).json({ error: 'Unsupported export format' });
    }
    
    let exportBuffer;
    let contentType;
    let fileExtension = format;
    
    switch (format) {
      case 'csv':
        exportBuffer = await generateCSVExport(data, parsedOptions);
        contentType = 'text/csv';
        break;
      case 'pdf':
        exportBuffer = await generatePDFExport(reportType, data, parsedOptions);
        contentType = 'application/pdf';
        break;
      case 'excel':
        exportBuffer = await generateExcelExport(data, parsedOptions);
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
        break;
      case 'json':
        exportBuffer = JSON.stringify(data, null, 2);
        contentType = 'application/json';
        break;
    }
    
    const exportFilename = filename || `${reportType}_export_${new Date().toISOString().split('T')[0]}.${fileExtension}`;
    
    res.setHeader('Content-Disposition', `attachment; filename="${exportFilename}"`);
    res.setHeader('Content-Type', contentType);
    res.send(exportBuffer);
    
  } catch (error) {
    next(error);
  }
});

// Real-time Metrics Dashboard
router.get('/dashboard/realtime', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { timeWindow = '1h' } = req.query;
    
    const db = getDatabase();
    const realtimeMetrics = await getRealtimeMetrics(db, timeWindow);
    
    res.json({
      metrics: realtimeMetrics,
      timeWindow,
      timestamp: new Date().toISOString(),
      refreshInterval: 30000 // 30 seconds
    });
    
  } catch (error) {
    next(error);
  }
});

// Scheduled Report Management
router.post('/reports/schedule', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const {
      reportName,
      reportType,
      schedule,
      recipients,
      parameters,
      format = 'pdf'
    } = req.body;
    
    if (!reportName || !reportType || !schedule || !recipients) {
      return res.status(400).json({ error: 'Report name, type, schedule, and recipients are required' });
    }
    
    const scheduledReport = {
      id: `report_${Date.now()}`,
      reportName,
      reportType,
      schedule,
      recipients,
      parameters,
      format,
      isActive: true,
      createdAt: new Date().toISOString(),
      lastRun: null,
      nextRun: calculateNextRun(schedule)
    };
    
    // Save scheduled report to database
    const db = getDatabase();
    await saveScheduledReport(db, scheduledReport);
    
    res.json({
      success: true,
      message: 'Report scheduled successfully',
      scheduledReport
    });
    
  } catch (error) {
    next(error);
  }
});

// Drill-down Analysis Endpoint
router.get('/drilldown/:entityType/:entityId', requireAnalyticsPermission, async (req, res, next) => {
  try {
    const { entityType, entityId } = req.params;
    const { drillLevel = 1, startDate, endDate } = req.query;
    
    const db = getDatabase();
    const drilldownData = await getDrilldownAnalysis(db, {
      entityType,
      entityId,
      drillLevel: parseInt(drillLevel),
      startDate,
      endDate
    });
    
    res.json({
      entityType,
      entityId,
      drillLevel,
      data: drilldownData,
      availableDrillLevels: getAvailableDrillLevels(entityType)
    });
    
  } catch (error) {
    next(error);
  }
});

// Helper functions for chart data generation
async function getClaimsTimelineData(db, startDate, endDate, filters) {
  let query = `
    SELECT 
      DATE(ic.submission_date) as date,
      COUNT(*) as claims_count,
      SUM(ic.total_amount) as total_amount,
      SUM(CASE WHEN ic.status = 'approved' THEN 1 ELSE 0 END) as approved,
      SUM(CASE WHEN ic.status = 'denied' THEN 1 ELSE 0 END) as denied,
      SUM(CASE WHEN ic.status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM insurance_claims ic
    WHERE 1=1
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
  
  if (filters.providerId) {
    query += ' AND ic.provider_id = ?';
    params.push(filters.providerId);
  }
  
  query += ' GROUP BY DATE(ic.submission_date) ORDER BY date';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getPaymentMethodsData(db, startDate, endDate, filters) {
  let query = `
    SELECT 
      payment_method,
      COUNT(*) as transaction_count,
      SUM(payment_amount) as total_amount,
      AVG(payment_amount) as avg_amount,
      SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as successful,
      SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM premium_payments
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND payment_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND payment_date <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY payment_method';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getProviderPerformanceChartData(db, startDate, endDate, filters) {
  let query = `
    SELECT 
      u.first_name || ' ' || u.last_name as provider_name,
      COUNT(DISTINCT a.patient_id) as unique_patients,
      COUNT(a.id) as total_appointments,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
      AVG(a.duration_minutes) as avg_duration
    FROM users u
    LEFT JOIN appointments a ON u.id = a.provider_id
    WHERE u.role = 'provider'
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND a.appointment_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND a.appointment_date <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY u.id, u.first_name, u.last_name ORDER BY completed DESC LIMIT 20';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getPatientOutcomesChartData(db, startDate, endDate, filters) {
  let query = `
    SELECT 
      p.id as patient_id,
      p.first_name || ' ' || p.last_name as patient_name,
      COUNT(DISTINCT mr.id) as treatments,
      COUNT(DISTINCT a.id) as appointments,
      SUM(ic.total_amount) as total_claims_cost
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
  
  query += ' GROUP BY p.id, p.first_name, p.last_name ORDER BY treatments DESC LIMIT 50';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getRevenueTrendsData(db, startDate, endDate, filters) {
  let query = `
    SELECT 
      DATE(payment_date) as date,
      SUM(payment_amount) as daily_revenue,
      COUNT(*) as transaction_count,
      payment_method
    FROM premium_payments
    WHERE payment_status = 'completed'
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND payment_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND payment_date <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY DATE(payment_date), payment_method ORDER BY date';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getClaimsStatusDistribution(db, startDate, endDate, filters) {
  let query = `
    SELECT 
      status,
      COUNT(*) as count,
      SUM(total_amount) as total_amount,
      AVG(total_amount) as avg_amount
    FROM insurance_claims
    WHERE 1=1
  `;
  
  const params = [];
  
  if (startDate) {
    query += ' AND submission_date >= ?';
    params.push(startDate);
  }
  
  if (endDate) {
    query += ' AND submission_date <= ?';
    params.push(endDate);
  }
  
  query += ' GROUP BY status';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper functions for custom report generation
async function generateCustomReport(db, config) {
  const { dataSource, metrics, dimensions, filters, aggregations, sortBy, limit } = config;
  
  let query = 'SELECT ';
  
  // Add dimensions
  if (dimensions && dimensions.length > 0) {
    query += dimensions.map(dim => `${dim}`).join(', ') + ', ';
  }
  
  // Add metrics with aggregations
  if (metrics && metrics.length > 0) {
    query += metrics.map(metric => {
      const aggregation = aggregations && aggregations[metric] ? aggregations[metric] : 'SUM';
      return `${aggregation}(${metric}) as ${metric}`;
    }).join(', ');
  }
  
  query += ` FROM ${dataSource} WHERE 1=1`;
  
  const params = [];
  
  // Add filters
  if (filters) {
    Object.keys(filters).forEach(key => {
      if (filters[key]) {
        query += ` AND ${key} = ?`;
        params.push(filters[key]);
      }
    });
  }
  
  // Add group by for dimensions
  if (dimensions && dimensions.length > 0) {
    query += ` GROUP BY ${dimensions.join(', ')}`;
  }
  
  // Add sorting
  if (sortBy) {
    query += ` ORDER BY ${sortBy.field} ${sortBy.direction || 'ASC'}`;
  }
  
  // Add limit
  if (limit) {
    query += ` LIMIT ${limit}`;
  }
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

// Helper functions for data export
async function generateCSVExport(data, options) {
  const { includeHeaders = true, delimiter = ',' } = options;
  
  if (!data || data.length === 0) {
    return '';
  }
  
  let csv = '';
  
  if (includeHeaders) {
    csv += Object.keys(data[0]).join(delimiter) + '\n';
  }
  
  data.forEach(row => {
    csv += Object.values(row).map(value => {
      if (typeof value === 'string' && (value.includes(delimiter) || value.includes('"') || value.includes('\n'))) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return value;
    }).join(delimiter) + '\n';
  });
  
  return csv;
}

async function generatePDFExport(reportType, data, options) {
  const PDFDocument = require('pdfkit');
  
  return new Promise((resolve) => {
    const doc = new PDFDocument();
    const buffers = [];
    
    doc.on('data', buffers.push.bind(buffers));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    
    // Add title
    doc.fontSize(20).text(`${reportType} Report`, { align: 'center' });
    doc.moveDown();
    
    // Add timestamp
    doc.fontSize(12).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown();
    
    // Add data table
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      
      // Table headers
      doc.fontSize(10).font('Helvetica-Bold');
      headers.forEach((header, i) => {
        doc.text(header, 50 + (i * 100), 150, { width: 90 });
      });
      
      // Table data
      doc.font('Helvetica');
      data.forEach((row, rowIndex) => {
        const y = 170 + (rowIndex * 20);
        headers.forEach((header, colIndex) => {
          doc.text(String(row[header] || ''), 50 + (colIndex * 100), y, { width: 90 });
        });
      });
    }
    
    doc.end();
  });
}

async function generateExcelExport(data, options) {
  const excel = require('excel4node');
  
  return new Promise((resolve) => {
    const workbook = new excel.Workbook();
    const worksheet = workbook.addWorksheet('Report');
    
    if (data && data.length > 0) {
      const headers = Object.keys(data[0]);
      
      // Add headers
      headers.forEach((header, index) => {
        worksheet.cell(1, index + 1).string(header);
      });
      
      // Add data
      data.forEach((row, rowIndex) => {
        headers.forEach((header, colIndex) => {
          const value = row[header];
          if (typeof value === 'number') {
            worksheet.cell(rowIndex + 2, colIndex + 1).number(value);
          } else {
            worksheet.cell(rowIndex + 2, colIndex + 1).string(String(value || ''));
          }
        });
      });
    }
    
    workbook.writeToBuffer().then(resolve);
  });
}

// Helper functions for real-time metrics
async function getRealtimeMetrics(db, timeWindow) {
  const timeAgo = getTimeAgo(timeWindow);
  
  const [activeClaims, recentPayments, activeAppointments, systemLoad] = await Promise.all([
    // Active claims in time window
    new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM insurance_claims WHERE submission_date >= ?',
        [timeAgo],
        (err, row) => err ? reject(err) : resolve(row.count)
      );
    }),
    
    // Recent payments
    new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count, SUM(payment_amount) as total FROM premium_payments WHERE payment_date >= ? AND payment_status = "completed"',
        [timeAgo],
        (err, row) => err ? reject(err) : resolve({ count: row.count, total: row.total })
      );
    }),
    
    // Active appointments
    new Promise((resolve, reject) => {
      db.get(
        'SELECT COUNT(*) as count FROM appointments WHERE appointment_date >= ? AND status IN ("scheduled", "in_progress")',
        [timeAgo],
        (err, row) => err ? reject(err) : resolve(row.count)
      );
    }),
    
    // System load (simulated)
    Promise.resolve({ cpu: Math.random() * 100, memory: Math.random() * 100 })
  ]);
  
  return {
    activeClaims,
    recentPayments,
    activeAppointments,
    systemLoad,
    timestamp: new Date().toISOString()
  };
}

function getTimeAgo(timeWindow) {
  const now = new Date();
  const value = parseInt(timeWindow);
  const unit = timeWindow.slice(-1);
  
  switch (unit) {
    case 'h': now.setHours(now.getHours() - value); break;
    case 'd': now.setDate(now.getDate() - value); break;
    case 'w': now.setDate(now.getDate() - (value * 7)); break;
    case 'm': now.setMonth(now.getMonth() - value); break;
    default: now.setHours(now.getHours() - 1);
  }
  
  return now.toISOString();
}

// Helper functions for scheduled reports
function calculateNextRun(schedule) {
  const now = new Date();
  const [frequency, time] = schedule.split(' at ');
  
  switch (frequency) {
    case 'daily':
      const [hours, minutes] = time.split(':').map(Number);
      now.setHours(hours, minutes, 0, 0);
      if (now <= new Date()) {
        now.setDate(now.getDate() + 1);
      }
      break;
    case 'weekly':
      // Add 7 days for weekly
      now.setDate(now.getDate() + 7);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      break;
    default:
      now.setDate(now.getDate() + 1);
  }
  
  return now.toISOString();
}

async function saveScheduledReport(db, scheduledReport) {
  return new Promise((resolve, reject) => {
    const query = `
      INSERT INTO scheduled_reports (id, report_name, report_type, schedule, recipients, parameters, format, is_active, created_at, next_run)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    db.run(query, [
      scheduledReport.id,
      scheduledReport.reportName,
      scheduledReport.reportType,
      scheduledReport.schedule,
      JSON.stringify(scheduledReport.recipients),
      JSON.stringify(scheduledReport.parameters),
      scheduledReport.format,
      scheduledReport.isActive ? 1 : 0,
      scheduledReport.createdAt,
      scheduledReport.nextRun
    ], function(err) {
      if (err) reject(err);
      else resolve(this.lastID);
    });
  });
}

// Helper functions for drill-down analysis
async function getDrilldownAnalysis(db, config) {
  const { entityType, entityId, drillLevel, startDate, endDate } = config;
  
  let drilldownData = {};
  
  switch (entityType) {
    case 'claim':
      drilldownData = await getClaimDrilldown(db, entityId, drillLevel, startDate, endDate);
      break;
    case 'provider':
      drilldownData = await getProviderDrilldown(db, entityId, drillLevel, startDate, endDate);
      break;
    case 'patient':
      drilldownData = await getPatientDrilldown(db, entityId, drillLevel, startDate, endDate);
      break;
    default:
      throw new Error('Invalid entity type for drill-down analysis');
  }
  
  return drilldownData;
}

async function getClaimDrilldown(db, claimId, drillLevel, startDate, endDate) {
  const baseQuery = `
    SELECT 
      ic.*,
      p.first_name || ' ' || p.last_name as patient_name,
      u.first_name || ' ' || u.last_name as provider_name,
      mr.record_type,
      mr.description as treatment_description
    FROM insurance_claims ic
    LEFT JOIN patients p ON ic.patient_id = p.id
    LEFT JOIN users u ON ic.provider_id = u.id
    LEFT JOIN medical_records mr ON ic.patient_id = mr.patient_id
    WHERE ic.id = ?
  `;
  
  return new Promise((resolve, reject) => {
    db.all(baseQuery, [claimId], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getProviderDrilldown(db, providerId, drillLevel, startDate, endDate) {
  let query = `
    SELECT 
      u.first_name || ' ' || u.last_name as provider_name,
      COUNT(DISTINCT a.patient_id) as unique_patients,
      COUNT(a.id) as total_appointments,
      SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed,
      AVG(a.duration_minutes) as avg_duration,
      COUNT(DISTINCT ic.id) as total_claims,
      SUM(ic.total_amount) as total_claim_amount
    FROM users u
    LEFT JOIN appointments a ON u.id = a.provider_id
    LEFT JOIN insurance_claims ic ON u.id = ic.provider_id
    WHERE u.id = ?
  `;
  
  const params = [providerId];
  
  if (startDate) {
    query += ' AND (a.appointment_date >= ? OR ic.submission_date >= ?)';
    params.push(startDate, startDate);
  }
  
  if (endDate) {
    query += ' AND (a.appointment_date <= ? OR ic.submission_date <= ?)';
    params.push(endDate, endDate);
  }
  
  query += ' GROUP BY u.id, u.first_name, u.last_name';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

async function getPatientDrilldown(db, patientId, drillLevel, startDate, endDate) {
  let query = `
    SELECT 
      p.first_name || ' ' || p.last_name as patient_name,
      COUNT(DISTINCT mr.id) as total_treatments,
      COUNT(DISTINCT a.id) as total_appointments,
      COUNT(DISTINCT ic.id) as total_claims,
      SUM(ic.total_amount) as total_claim_amount,
      MAX(mr.date_of_service) as last_treatment_date
    FROM patients p
    LEFT JOIN medical_records mr ON p.id = mr.patient_id
    LEFT JOIN appointments a ON p.id = a.patient_id
    LEFT JOIN insurance_claims ic ON p.id = ic.patient_id
    WHERE p.id = ?
  `;
  
  const params = [patientId];
  
  if (startDate) {
    query += ' AND (mr.date_of_service >= ? OR a.appointment_date >= ? OR ic.service_date >= ?)';
    params.push(startDate, startDate, startDate);
  }
  
  if (endDate) {
    query += ' AND (mr.date_of_service <= ? OR a.appointment_date <= ? OR ic.service_date <= ?)';
    params.push(endDate, endDate, endDate);
  }
  
  query += ' GROUP BY p.id, p.first_name, p.last_name';
  
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function getAvailableDrillLevels(entityType) {
  const drillLevels = {
    claim: [1, 2, 3],
    provider: [1, 2],
    patient: [1, 2]
  };
  
  return drillLevels[entityType] || [1];
}

module.exports = router;
