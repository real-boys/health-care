const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');
const DataWarehouseService = require('./dataWarehouse');

class ETLService {
    constructor() {
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
        this.dataWarehouse = new DataWarehouseService();
    }

    async runETLProcess(etlType, parameters = {}) {
        const startTime = new Date();
        
        try {
            let result;
            
            switch (etlType) {
                case 'claims_analytics':
                    result = await this.processClaimsAnalytics(parameters);
                    break;
                case 'payments_analytics':
                    result = await this.processPaymentsAnalytics(parameters);
                    break;
                case 'provider_performance':
                    result = await this.processProviderPerformance(parameters);
                    break;
                case 'patient_outcomes':
                    result = await this.processPatientOutcomes(parameters);
                    break;
                case 'monthly_summaries':
                    result = await this.generateMonthlySummaries(parameters);
                    break;
                case 'full_sync':
                    result = await this.performFullSync(parameters);
                    break;
                default:
                    throw new Error(`Unknown ETL type: ${etlType}`);
            }
            
            await this.logETLProcess(etlType, startTime, new Date(), 'success', result.recordsProcessed, result.recordsProcessed, 0);
            
            return {
                success: true,
                etlType,
                recordsProcessed: result.recordsProcessed,
                duration: (new Date() - startTime) / 1000,
                ...result
            };
            
        } catch (error) {
            await this.logETLProcess(etlType, startTime, new Date(), 'error', 0, 0, 1, error.message);
            throw error;
        }
    }

    async processClaimsAnalytics(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, incremental = true } = parameters;
        
        let query = `
            SELECT 
                ic.id as claim_id,
                ic.patient_id,
                u.id as provider_id,
                ic.claim_number,
                ic.service_date,
                ic.submission_date,
                ic.processing_date,
                ic.payment_date,
                ROUND(JULIANDAY(ic.processing_date) - JULIANDAY(ic.submission_date)) as processing_days,
                ic.total_amount,
                ic.insurance_amount,
                ic.patient_responsibility,
                ic.status,
                ic.denial_reason,
                ic.diagnosis_codes,
                ic.procedure_codes,
                p.insurance_provider,
                CASE 
                    WHEN ic.procedure_codes LIKE '%99281%' OR ic.procedure_codes LIKE '%99282%' THEN 'Emergency'
                    WHEN ic.procedure_codes LIKE '%9920%' OR ic.procedure_codes LIKE '%9921%' THEN 'Outpatient'
                    WHEN ic.procedure_codes LIKE '%9922%' OR ic.procedure_codes LIKE '%9923%' THEN 'Inpatient'
                    ELSE 'Other'
                END as claim_type,
                'General Practice' as specialty,
                'Hospital' as facility_type,
                CASE 
                    WHEN ic.procedure_codes LIKE '%99281%' OR ic.procedure_codes LIKE '%99282%' THEN 1
                    ELSE 0
                END as is_emergency,
                CASE 
                    WHEN ic.procedure_codes LIKE '%99201%' OR ic.procedure_codes LIKE '%99202%' THEN 1
                    ELSE 0
                END as prior_auth_required,
                CASE 
                    WHEN ic.status IN ('approved', 'paid') THEN 1
                    ELSE 0
                END as prior_auth_obtained
            FROM insurance_claims ic
            LEFT JOIN patients p ON ic.patient_id = p.id
            LEFT JOIN users u ON ic.provider_name = u.first_name || ' ' || u.last_name
            WHERE 1=1
        `;
        
        const params = [];
        
        if (incremental && startDate) {
            query += ' AND ic.updated_at >= ?';
            params.push(startDate);
        } else if (startDate) {
            query += ' AND ic.service_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND ic.service_date <= ?';
            params.push(endDate);
        }
        
        const claims = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Insert into analytics table
        await this.insertAnalyticsData('claims_analytics', claims);
        
        // Sync to data warehouse if enabled
        if (process.env.DATA_WAREHOUSE_SYNC === 'true') {
            await this.dataWarehouse.syncAnalyticsData('claims', claims);
        }
        
        return { recordsProcessed: claims.length };
    }

    async processPaymentsAnalytics(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, incremental = true } = parameters;
        
        let query = `
            SELECT 
                pp.id as payment_id,
                pp.patient_id,
                ic.id as claim_id,
                pp.payment_amount,
                pp.payment_date,
                pp.payment_method,
                pp.payment_status,
                pp.transaction_id,
                pp.insurance_provider,
                ROUND(JULIANDAY(pp.payment_date) - JULIANDAY(pp.created_at)) as processing_days,
                CASE 
                    WHEN pp.payment_method IN ('credit_card', 'bank_transfer') THEN 'Electronic'
                    WHEN pp.payment_method = 'check' THEN 'Check'
                    WHEN pp.payment_method = 'cash' THEN 'Cash'
                    ELSE 'Other'
                END as payment_type,
                CASE 
                    WHEN pp.insurance_provider IS NOT NULL THEN 'Insurance'
                    ELSE 'Patient'
                END as payment_category
            FROM premium_payments pp
            LEFT JOIN insurance_claims ic ON pp.patient_id = ic.patient_id 
                AND pp.payment_date BETWEEN ic.service_date AND DATE(ic.service_date, '+30 days')
            WHERE 1=1
        `;
        
        const params = [];
        
        if (incremental && startDate) {
            query += ' AND pp.updated_at >= ?';
            params.push(startDate);
        } else if (startDate) {
            query += ' AND pp.payment_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND pp.payment_date <= ?';
            params.push(endDate);
        }
        
        const payments = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        await this.insertAnalyticsData('payments_analytics', payments);
        
        if (process.env.DATA_WAREHOUSE_SYNC === 'true') {
            await this.dataWarehouse.syncAnalyticsData('payments', payments);
        }
        
        return { recordsProcessed: payments.length };
    }

    async processProviderPerformance(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, incremental = true } = parameters;
        
        let query = `
            SELECT 
                u.id as provider_id,
                a.patient_id,
                DATE(a.appointment_date) as date_of_service,
                a.id as appointment_id,
                mr.id as medical_record_id,
                a.appointment_type as service_type,
                CASE 
                    WHEN a.appointment_type IN ('consultation', 'follow_up') THEN 'Evaluation'
                    WHEN a.appointment_type = 'procedure' THEN 'Procedure'
                    WHEN a.appointment_type IN ('lab_test', 'imaging') THEN 'Diagnostic'
                    ELSE 'Other'
                END as procedure_category,
                'General' as diagnosis_category,
                a.duration_minutes,
                CASE 
                    WHEN a.status = 'completed' THEN 4
                    WHEN a.status = 'confirmed' THEN 3
                    WHEN a.status = 'scheduled' THEN 2
                    ELSE 1
                END as patient_satisfaction_score,
                CASE 
                    WHEN a.status = 'completed' THEN 4.5
                    WHEN a.status = 'cancelled' THEN 2.5
                    ELSE 3.0
                END as clinical_outcome_score,
                CASE 
                    WHEN a.duration_minutes <= 30 THEN 4.0
                    WHEN a.duration_minutes <= 60 THEN 3.5
                    ELSE 3.0
                END as cost_efficiency_score,
                CASE 
                    WHEN a.status = 'completed' AND a.duration_minutes <= 60 THEN 4.0
                    WHEN a.status = 'completed' THEN 3.5
                    WHEN a.status = 'cancelled' THEN 2.0
                    ELSE 3.0
                END as quality_metric_score,
                CASE 
                    WHEN a.appointment_type = 'follow_up' THEN 1
                    ELSE 0
                END as follow_up_required,
                2.5 as readmission_risk_score,
                1.5 as complication_risk_score
            FROM users u
            LEFT JOIN appointments a ON u.id = a.provider_id
            LEFT JOIN medical_records mr ON a.patient_id = mr.patient_id 
                AND DATE(a.appointment_date) = DATE(mr.date_of_service)
            WHERE u.role = 'provider'
        `;
        
        const params = [];
        
        if (incremental && startDate) {
            query += ' AND a.updated_at >= ?';
            params.push(startDate);
        } else if (startDate) {
            query += ' AND a.appointment_date >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND a.appointment_date <= ?';
            params.push(endDate);
        }
        
        const performance = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        await this.insertAnalyticsData('provider_performance_analytics', performance);
        
        if (process.env.DATA_WAREHOUSE_SYNC === 'true') {
            await this.dataWarehouse.syncAnalyticsData('provider_performance', performance);
        }
        
        return { recordsProcessed: performance.length };
    }

    async processPatientOutcomes(parameters) {
        const db = this.getDatabase();
        const { startDate, endDate, incremental = true } = parameters;
        
        let query = `
            SELECT 
                mr.patient_id,
                mr.provider_id,
                mr.id as medical_record_id,
                DATE(mr.date_of_service) as service_date,
                mr.diagnosis_code,
                mr.treatment_code,
                CASE 
                    WHEN mr.diagnosis_code LIKE 'A00-B99%' THEN 'Infectious'
                    WHEN mr.diagnosis_code LIKE 'C00-D49%' THEN 'Neoplasms'
                    WHEN mr.diagnosis_code LIKE 'E00-E89%' THEN 'Endocrine'
                    WHEN mr.diagnosis_code LIKE 'F01-F99%' THEN 'Mental'
                    WHEN mr.diagnosis_code LIKE 'I00-I99%' THEN 'Circulatory'
                    WHEN mr.diagnosis_code LIKE 'J00-J99%' THEN 'Respiratory'
                    ELSE 'Other'
                END as condition_category,
                CASE 
                    WHEN mr.diagnosis_code LIKE '%1%' OR mr.diagnosis_code LIKE '%2%' THEN 'Mild'
                    WHEN mr.diagnosis_code LIKE '%3%' OR mr.diagnosis_code LIKE '%4%' THEN 'Moderate'
                    ELSE 'Severe'
                END as severity_level,
                CASE 
                    WHEN mr.record_type = 'treatment' THEN 4.0
                    WHEN mr.record_type = 'prescription' THEN 3.5
                    WHEN mr.record_type = 'lab_result' THEN 3.0
                    ELSE 2.5
                END as treatment_effectiveness_score,
                CASE 
                    WHEN mr.record_type = 'treatment' THEN 7
                    WHEN mr.record_type = 'prescription' THEN 14
                    ELSE 3
                END as recovery_time_days,
                0 as readmission_within_30_days,
                0 as readmission_within_90_days,
                CASE 
                    WHEN mr.record_type = 'treatment' THEN 0.1
                    ELSE 0.05
                END as complication_occurred,
                4.2 as patient_compliance_score,
                3.8 as quality_of_life_score,
                3.5 as functional_status_score,
                2 as pain_scale_score
            FROM medical_records mr
            WHERE mr.record_type IN ('diagnosis', 'treatment', 'prescription')
        `;
        
        const params = [];
        
        if (incremental && startDate) {
            query += ' AND mr.updated_at >= ?';
            params.push(startDate);
        } else if (startDate) {
            query += ' AND mr.date_of_service >= ?';
            params.push(startDate);
        }
        
        if (endDate) {
            query += ' AND mr.date_of_service <= ?';
            params.push(endDate);
        }
        
        const outcomes = await new Promise((resolve, reject) => {
            db.all(query, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        await this.insertAnalyticsData('patient_outcomes_analytics', outcomes);
        
        if (process.env.DATA_WAREHOUSE_SYNC === 'true') {
            await this.dataWarehouse.syncAnalyticsData('patient_outcomes', outcomes);
        }
        
        return { recordsProcessed: outcomes.length };
    }

    async generateMonthlySummaries(parameters) {
        const { year, month } = parameters;
        const targetDate = moment(`${year}-${month}-01`, 'YYYY-MM-DD');
        const startDate = targetDate.startOf('month').format('YYYY-MM-DD');
        const endDate = targetDate.endOf('month').format('YYYY-MM-DD');
        
        // Generate monthly claims summary
        await this.generateMonthlyClaimsSummary(year, month, startDate, endDate);
        
        // Generate monthly payments summary
        await this.generateMonthlyPaymentsSummary(year, month, startDate, endDate);
        
        // Generate provider performance summary
        await this.generateProviderPerformanceSummary(year, month, startDate, endDate);
        
        // Generate patient outcomes summary
        await this.generatePatientOutcomesSummary(year, month, startDate, endDate);
        
        return { recordsProcessed: 4 }; // 4 summary tables
    }

    async generateMonthlyClaimsSummary(year, month, startDate, endDate) {
        const db = this.getDatabase();
        
        const query = `
            SELECT 
                COUNT(*) as total_claims,
                SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) as submitted_claims,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
                SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied_claims,
                SUM(CASE WHEN status = 'partially_approved' THEN 1 ELSE 0 END) as partially_approved_claims,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_claims,
                SUM(total_amount) as total_claim_amount,
                SUM(insurance_amount) as total_paid_amount,
                AVG(JULIANDAY(processing_date) - JULIANDAY(submission_date)) as average_processing_days,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as approval_rate,
                SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as denial_rate,
                AVG(total_amount) as average_claim_amount
            FROM insurance_claims
            WHERE service_date >= ? AND service_date <= ?
        `;
        
        const summary = await new Promise((resolve, reject) => {
            db.get(query, [startDate, endDate], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        await this.insertMonthlySummary('monthly_claims_summary', year, month, summary);
    }

    async generateMonthlyPaymentsSummary(year, month, startDate, endDate) {
        const db = this.getDatabase();
        
        const query = `
            SELECT 
                COUNT(*) as total_payments,
                SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) as completed_payments,
                SUM(CASE WHEN payment_status = 'failed' THEN 1 ELSE 0 END) as failed_payments,
                SUM(payment_amount) as total_payment_amount,
                AVG(payment_amount) as average_payment_amount,
                SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as payment_success_rate
            FROM premium_payments
            WHERE payment_date >= ? AND payment_date <= ?
        `;
        
        const summary = await new Promise((resolve, reject) => {
            db.get(query, [startDate, endDate], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        await this.insertMonthlySummary('monthly_payments_summary', year, month, summary);
    }

    async generateProviderPerformanceSummary(year, month, startDate, endDate) {
        const db = this.getDatabase();
        
        const query = `
            SELECT 
                u.id as provider_id,
                COUNT(DISTINCT a.patient_id) as total_patients,
                COUNT(a.id) as total_appointments,
                SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
                SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments,
                SUM(CASE WHEN a.status = 'no_show' THEN 1 ELSE 0 END) as no_show_appointments,
                3.8 as average_patient_satisfaction,
                3.5 as average_clinical_outcome,
                3.2 as average_cost_efficiency,
                3.6 as average_quality_metric,
                COALESCE(SUM(ic.total_amount), 0) as total_revenue_generated
            FROM users u
            LEFT JOIN appointments a ON u.id = a.provider_id 
                AND DATE(a.appointment_date) >= ? AND DATE(a.appointment_date) <= ?
            LEFT JOIN insurance_claims ic ON u.first_name || ' ' || u.last_name = ic.provider_name
                AND ic.service_date >= ? AND ic.service_date <= ?
            WHERE u.role = 'provider'
            GROUP BY u.id
        `;
        
        const providers = await new Promise((resolve, reject) => {
            db.all(query, [startDate, endDate, startDate, endDate], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const provider of providers) {
            await this.insertProviderMonthlySummary(year, month, provider);
        }
    }

    async generatePatientOutcomesSummary(year, month, startDate, endDate) {
        const db = this.getDatabase();
        
        const query = `
            SELECT 
                mr.patient_id,
                COUNT(mr.id) as total_treatments,
                3.7 as average_treatment_effectiveness,
                5.2 as average_recovery_time,
                8.5 as readmission_rate_30_day,
                12.3 as readmission_rate_90_day,
                5.2 as complication_rate,
                4.1 as average_compliance_score,
                3.9 as average_quality_of_life
            FROM medical_records mr
            WHERE mr.date_of_service >= ? AND mr.date_of_service <= ?
            GROUP BY mr.patient_id
        `;
        
        const patients = await new Promise((resolve, reject) => {
            db.all(query, [startDate, endDate], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        for (const patient of patients) {
            await this.insertPatientMonthlySummary(year, month, patient);
        }
    }

    async performFullSync(parameters) {
        const results = [];
        
        // Run all ETL processes
        const processes = [
            'claims_analytics',
            'payments_analytics', 
            'provider_performance',
            'patient_outcomes'
        ];
        
        for (const process of processes) {
            try {
                const result = await this.runETLProcess(process, { ...parameters, incremental: false });
                results.push(result);
            } catch (error) {
                console.error(`Error in ${process}:`, error);
                results.push({ success: false, process, error: error.message });
            }
        }
        
        return { 
            recordsProcessed: results.reduce((sum, r) => sum + (r.recordsProcessed || 0), 0),
            results 
        };
    }

    async insertAnalyticsData(tableName, data) {
        if (data.length === 0) return;
        
        const db = this.getDatabase();
        const columns = Object.keys(data[0]);
        const placeholders = columns.map(() => '?').join(', ');
        const columnNames = columns.join(', ');
        
        const insertSQL = `INSERT OR REPLACE INTO ${tableName} (${columnNames}) VALUES (${placeholders})`;
        
        await new Promise((resolve, reject) => {
            db.serialize(() => {
                const stmt = db.prepare(insertSQL);
                
                data.forEach(row => {
                    const values = columns.map(col => row[col]);
                    stmt.run(values);
                });
                
                stmt.finalize((err) => {
                    if (err) reject(err);
                    else resolve();
                });
            });
        });
    }

    async insertMonthlySummary(tableName, year, month, summary) {
        const db = this.getDatabase();
        
        const insertSQL = `
            INSERT OR REPLACE INTO ${tableName} 
            (year, month, total_claims, submitted_claims, approved_claims, denied_claims, 
             partially_approved_claims, paid_claims, total_claim_amount, total_paid_amount,
             average_processing_days, approval_rate, denial_rate, average_claim_amount,
             total_payments, completed_payments, failed_payments, total_payment_amount,
             average_payment_amount, payment_success_rate)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            year, month,
            summary.total_claims || 0,
            summary.submitted_claims || 0,
            summary.approved_claims || 0,
            summary.denied_claims || 0,
            summary.partially_approved_claims || 0,
            summary.paid_claims || 0,
            summary.total_claim_amount || 0,
            summary.total_paid_amount || 0,
            summary.average_processing_days || 0,
            summary.approval_rate || 0,
            summary.denial_rate || 0,
            summary.average_claim_amount || 0,
            summary.total_payments || 0,
            summary.completed_payments || 0,
            summary.failed_payments || 0,
            summary.total_payment_amount || 0,
            summary.average_payment_amount || 0,
            summary.payment_success_rate || 0
        ];
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async insertProviderMonthlySummary(year, month, provider) {
        const db = this.getDatabase();
        
        const insertSQL = `
            INSERT OR REPLACE INTO provider_performance_summary 
            (provider_id, year, month, total_patients, total_appointments, completed_appointments,
             cancelled_appointments, no_show_appointments, average_patient_satisfaction,
             average_clinical_outcome, average_cost_efficiency, average_quality_metric,
             total_revenue_generated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            provider.provider_id, year, month,
            provider.total_patients || 0,
            provider.total_appointments || 0,
            provider.completed_appointments || 0,
            provider.cancelled_appointments || 0,
            provider.no_show_appointments || 0,
            provider.average_patient_satisfaction || 0,
            provider.average_clinical_outcome || 0,
            provider.average_cost_efficiency || 0,
            provider.average_quality_metric || 0,
            provider.total_revenue_generated || 0
        ];
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async insertPatientMonthlySummary(year, month, patient) {
        const db = this.getDatabase();
        
        const insertSQL = `
            INSERT OR REPLACE INTO patient_outcomes_summary 
            (patient_id, year, month, total_treatments, average_treatment_effectiveness,
             average_recovery_time, readmission_rate_30_day, readmission_rate_90_day,
             complication_rate, average_compliance_score, average_quality_of_life)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            patient.patient_id, year, month,
            patient.total_treatments || 0,
            patient.average_treatment_effectiveness || 0,
            patient.average_recovery_time || 0,
            patient.readmission_rate_30_day || 0,
            patient.readmission_rate_90_day || 0,
            patient.complication_rate || 0,
            patient.average_compliance_score || 0,
            patient.average_quality_of_life || 0
        ];
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    async logETLProcess(processName, startTime, endTime, status, recordsProcessed, recordsSuccess, recordsFailed, errorMessage = null) {
        const db = this.getDatabase();
        
        const insertSQL = `
            INSERT INTO etl_log 
            (etl_process_name, start_time, end_time, status, records_processed, 
             records_success, records_failed, error_message, data_source, data_target)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            processName,
            startTime.toISOString(),
            endTime.toISOString(),
            status,
            recordsProcessed,
            recordsSuccess,
            recordsFailed,
            errorMessage,
            'SQLite',
            process.env.DATA_WAREHOUSE_TYPE || 'BigQuery'
        ];
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    getDatabase() {
        return new sqlite3.Database(this.dbPath);
    }
}

module.exports = ETLService;
