const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'healthcare.db');

function initializeDatabase() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(DB_PATH, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
    });

    const tables = [
      `CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('patient', 'provider', 'admin')),
        first_name TEXT NOT NULL,
        last_name TEXT NOT NULL,
        date_of_birth DATE,
        phone TEXT,
        address TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS patients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        medical_record_number TEXT UNIQUE NOT NULL,
        insurance_provider TEXT,
        insurance_policy_number TEXT,
        emergency_contact_name TEXT,
        emergency_contact_phone TEXT,
        blood_type TEXT,
        allergies TEXT,
        medications TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      `CREATE TABLE IF NOT EXISTS medical_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        record_type TEXT NOT NULL CHECK (record_type IN ('diagnosis', 'treatment', 'lab_result', 'prescription', 'imaging', 'vaccination')),
        title TEXT NOT NULL,
        description TEXT,
        diagnosis_code TEXT,
        treatment_code TEXT,
        date_of_service DATE NOT NULL,
        facility_name TEXT,
        provider_name TEXT,
        notes TEXT,
        attachments TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (provider_id) REFERENCES users (id)
      )`,

      `CREATE TABLE IF NOT EXISTS insurance_claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        claim_number TEXT UNIQUE NOT NULL,
        service_date DATE NOT NULL,
        provider_name TEXT NOT NULL,
        diagnosis_codes TEXT,
        procedure_codes TEXT,
        total_amount DECIMAL(10,2) NOT NULL,
        insurance_amount DECIMAL(10,2),
        patient_responsibility DECIMAL(10,2),
        status TEXT NOT NULL CHECK (status IN ('submitted', 'pending', 'approved', 'denied', 'partially_approved', 'paid')),
        submission_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        processing_date DATETIME,
        payment_date DATETIME,
        denial_reason TEXT,
        notes TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id)
      )`,

      `CREATE TABLE IF NOT EXISTS premium_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        payment_amount DECIMAL(10,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT CHECK (payment_method IN ('credit_card', 'bank_transfer', 'check', 'cash')),
        payment_status TEXT CHECK (payment_status IN ('pending', 'completed', 'failed', 'refunded')),
        transaction_id TEXT,
        insurance_provider TEXT,
        policy_number TEXT,
        coverage_period_start DATE,
        coverage_period_end DATE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id)
      )`,

      `CREATE TABLE IF NOT EXISTS appointments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        appointment_date DATETIME NOT NULL,
        duration_minutes INTEGER NOT NULL,
        appointment_type TEXT CHECK (appointment_type IN ('consultation', 'follow_up', 'procedure', 'lab_test', 'imaging', 'vaccination')),
        status TEXT CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
        notes TEXT,
        virtual BOOLEAN DEFAULT FALSE,
        meeting_link TEXT,
        reminder_sent BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (provider_id) REFERENCES users (id)
      )`,

      `CREATE TABLE IF NOT EXISTS notifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT CHECK (type IN ('appointment', 'claim', 'payment', 'system', 'medical_record')),
        priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
        read BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id)
      )`,

      // Analytics tables
      `CREATE TABLE IF NOT EXISTS claims_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        claim_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        provider_id INTEGER,
        claim_number TEXT NOT NULL,
        service_date DATE NOT NULL,
        submission_date DATETIME NOT NULL,
        processing_date DATETIME,
        payment_date DATETIME,
        processing_days INTEGER,
        total_amount DECIMAL(10,2) NOT NULL,
        insurance_amount DECIMAL(10,2),
        patient_responsibility DECIMAL(10,2),
        status TEXT NOT NULL,
        denial_reason TEXT,
        diagnosis_codes TEXT,
        procedure_codes TEXT,
        insurance_provider TEXT,
        claim_type TEXT,
        specialty TEXT,
        facility_type TEXT,
        is_emergency BOOLEAN DEFAULT FALSE,
        prior_auth_required BOOLEAN DEFAULT FALSE,
        prior_auth_obtained BOOLEAN DEFAULT FALSE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (claim_id) REFERENCES insurance_claims (id),
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (provider_id) REFERENCES users (id)
      )`,

      `CREATE TABLE IF NOT EXISTS payments_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        payment_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        claim_id INTEGER,
        payment_amount DECIMAL(10,2) NOT NULL,
        payment_date DATE NOT NULL,
        payment_method TEXT,
        payment_status TEXT,
        transaction_id TEXT,
        insurance_provider TEXT,
        processing_days INTEGER,
        payment_type TEXT,
        payment_category TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (payment_id) REFERENCES premium_payments (id),
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (claim_id) REFERENCES insurance_claims (id)
      )`,

      `CREATE TABLE IF NOT EXISTS provider_performance_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        patient_id INTEGER NOT NULL,
        date_of_service DATE NOT NULL,
        appointment_id INTEGER,
        medical_record_id INTEGER,
        service_type TEXT,
        procedure_category TEXT,
        diagnosis_category TEXT,
        duration_minutes INTEGER,
        patient_satisfaction_score INTEGER,
        clinical_outcome_score INTEGER,
        cost_efficiency_score DECIMAL(5,2),
        quality_metric_score DECIMAL(5,2),
        follow_up_required BOOLEAN DEFAULT FALSE,
        readmission_risk_score DECIMAL(5,2),
        complication_risk_score DECIMAL(5,2),
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES users (id),
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (appointment_id) REFERENCES appointments (id),
        FOREIGN KEY (medical_record_id) REFERENCES medical_records (id)
      )`,

      `CREATE TABLE IF NOT EXISTS patient_outcomes_analytics (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        provider_id INTEGER NOT NULL,
        medical_record_id INTEGER NOT NULL,
        service_date DATE NOT NULL,
        diagnosis_code TEXT,
        treatment_code TEXT,
        condition_category TEXT,
        severity_level TEXT,
        treatment_effectiveness_score DECIMAL(5,2),
        recovery_time_days INTEGER,
        readmission_within_30_days BOOLEAN DEFAULT FALSE,
        readmission_within_90_days BOOLEAN DEFAULT FALSE,
        complication_occurred BOOLEAN DEFAULT FALSE,
        patient_compliance_score DECIMAL(5,2),
        quality_of_life_score DECIMAL(5,2),
        functional_status_score DECIMAL(5,2),
        pain_scale_score INTEGER,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        FOREIGN KEY (provider_id) REFERENCES users (id),
        FOREIGN KEY (medical_record_id) REFERENCES medical_records (id)
      )`,

      `CREATE TABLE IF NOT EXISTS monthly_claims_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_claims INTEGER DEFAULT 0,
        submitted_claims INTEGER DEFAULT 0,
        approved_claims INTEGER DEFAULT 0,
        denied_claims INTEGER DEFAULT 0,
        partially_approved_claims INTEGER DEFAULT 0,
        paid_claims INTEGER DEFAULT 0,
        total_claim_amount DECIMAL(12,2) DEFAULT 0,
        total_paid_amount DECIMAL(12,2) DEFAULT 0,
        average_processing_days DECIMAL(8,2) DEFAULT 0,
        approval_rate DECIMAL(5,2) DEFAULT 0,
        denial_rate DECIMAL(5,2) DEFAULT 0,
        average_claim_amount DECIMAL(10,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )`,

      `CREATE TABLE IF NOT EXISTS monthly_payments_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_payments INTEGER DEFAULT 0,
        completed_payments INTEGER DEFAULT 0,
        failed_payments INTEGER DEFAULT 0,
        total_payment_amount DECIMAL(12,2) DEFAULT 0,
        average_payment_amount DECIMAL(10,2) DEFAULT 0,
        payment_success_rate DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(year, month)
      )`,

      `CREATE TABLE IF NOT EXISTS provider_performance_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        provider_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_patients INTEGER DEFAULT 0,
        total_appointments INTEGER DEFAULT 0,
        completed_appointments INTEGER DEFAULT 0,
        cancelled_appointments INTEGER DEFAULT 0,
        no_show_appointments INTEGER DEFAULT 0,
        average_patient_satisfaction DECIMAL(5,2) DEFAULT 0,
        average_clinical_outcome DECIMAL(5,2) DEFAULT 0,
        average_cost_efficiency DECIMAL(5,2) DEFAULT 0,
        average_quality_metric DECIMAL(5,2) DEFAULT 0,
        total_revenue_generated DECIMAL(12,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (provider_id) REFERENCES users (id),
        UNIQUE(provider_id, year, month)
      )`,

      `CREATE TABLE IF NOT EXISTS patient_outcomes_summary (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        patient_id INTEGER NOT NULL,
        year INTEGER NOT NULL,
        month INTEGER NOT NULL,
        total_treatments INTEGER DEFAULT 0,
        average_treatment_effectiveness DECIMAL(5,2) DEFAULT 0,
        average_recovery_time DECIMAL(8,2) DEFAULT 0,
        readmission_rate_30_day DECIMAL(5,2) DEFAULT 0,
        readmission_rate_90_day DECIMAL(5,2) DEFAULT 0,
        complication_rate DECIMAL(5,2) DEFAULT 0,
        average_compliance_score DECIMAL(5,2) DEFAULT 0,
        average_quality_of_life DECIMAL(5,2) DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (patient_id) REFERENCES patients (id),
        UNIQUE(patient_id, year, month)
      )`,

      `CREATE TABLE IF NOT EXISTS analytics_config (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        config_key TEXT UNIQUE NOT NULL,
        config_value TEXT NOT NULL,
        description TEXT,
        data_type TEXT DEFAULT 'string',
        is_active BOOLEAN DEFAULT TRUE,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS etl_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        etl_process_name TEXT NOT NULL,
        start_time DATETIME NOT NULL,
        end_time DATETIME,
        status TEXT NOT NULL,
        records_processed INTEGER DEFAULT 0,
        records_success INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        error_message TEXT,
        data_source TEXT,
        data_target TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS ml_predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        model_name TEXT NOT NULL,
        model_version TEXT NOT NULL,
        prediction_type TEXT NOT NULL,
        entity_id INTEGER NOT NULL,
        entity_type TEXT NOT NULL,
        prediction_value DECIMAL(10,4),
        confidence_score DECIMAL(5,4),
        prediction_date DATETIME NOT NULL,
        features_used TEXT,
        actual_value DECIMAL(10,4),
        actual_date DATETIME,
        is_accurate BOOLEAN,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`
    ];

    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_patients_user_id ON patients(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_medical_records_patient_id ON medical_records(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_medical_records_date ON medical_records(date_of_service)',
      'CREATE INDEX IF NOT EXISTS idx_claims_patient_id ON insurance_claims(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_claims_status ON insurance_claims(status)',
      'CREATE INDEX IF NOT EXISTS idx_payments_patient_id ON premium_payments(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_patient_id ON appointments(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date)',
      'CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id)',
      'CREATE INDEX IF NOT EXISTS idx_claims_analytics_date ON claims_analytics(service_date)',
      'CREATE INDEX IF NOT EXISTS idx_claims_analytics_status ON claims_analytics(status)',
      'CREATE INDEX IF NOT EXISTS idx_claims_analytics_patient ON claims_analytics(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_claims_analytics_provider ON claims_analytics(provider_id)',
      'CREATE INDEX IF NOT EXISTS idx_payments_analytics_date ON payments_analytics(payment_date)',
      'CREATE INDEX IF NOT EXISTS idx_payments_analytics_status ON payments_analytics(payment_status)',
      'CREATE INDEX IF NOT EXISTS idx_payments_analytics_patient ON payments_analytics(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_provider_performance_date ON provider_performance_analytics(date_of_service)',
      'CREATE INDEX IF NOT EXISTS idx_provider_performance_provider ON provider_performance_analytics(provider_id)',
      'CREATE INDEX IF NOT EXISTS idx_provider_performance_patient ON provider_performance_analytics(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_patient_outcomes_date ON patient_outcomes_analytics(service_date)',
      'CREATE INDEX IF NOT EXISTS idx_patient_outcomes_patient ON patient_outcomes_analytics(patient_id)',
      'CREATE INDEX IF NOT EXISTS idx_patient_outcomes_condition ON patient_outcomes_analytics(condition_category)',
      'CREATE INDEX IF NOT EXISTS idx_monthly_claims_summary_date ON monthly_claims_summary(year, month)',
      'CREATE INDEX IF NOT EXISTS idx_monthly_payments_summary_date ON monthly_payments_summary(year, month)',
      'CREATE INDEX IF NOT EXISTS idx_provider_performance_summary_date ON provider_performance_summary(year, month)',
      'CREATE INDEX IF NOT EXISTS idx_patient_outcomes_summary_date ON patient_outcomes_summary(year, month)',
      'CREATE INDEX IF NOT EXISTS idx_etl_log_process ON etl_log(etl_process_name)',
      'CREATE INDEX IF NOT EXISTS idx_etl_log_date ON etl_log(start_time)',
      'CREATE INDEX IF NOT EXISTS idx_ml_predictions_entity ON ml_predictions(entity_id, entity_type)',
      'CREATE INDEX IF NOT EXISTS idx_ml_predictions_date ON ml_predictions(prediction_date)'
    ];

    let completedTables = 0;
    let completedIndexes = 0;

    tables.forEach((sql) => {
      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
          return;
        }
        completedTables++;
        if (completedTables === tables.length) {
          indexes.forEach((indexSql) => {
            db.run(indexSql, (err) => {
              if (err) {
                console.error('Error creating index:', err);
              } else {
                completedIndexes++;
              }
              if (completedIndexes === indexes.length) {
                db.close((err) => {
                  if (err) {
                    console.error('Error closing database:', err);
                    reject(err);
                  } else {
                    console.log('Database initialized successfully');
                    resolve();
                  }
                });
              }
            });
          });
        }
      });
    });
  });
}

module.exports = { initializeDatabase };
