const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');

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

      `CREATE TABLE IF NOT EXISTS integration_configs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        type TEXT CHECK (type IN ('HL7', 'FHIR', 'CUSTOM')) NOT NULL,
        description TEXT,
        connection_config TEXT NOT NULL DEFAULT '{}',
        mapping_config TEXT NOT NULL DEFAULT '{}',
        is_active BOOLEAN DEFAULT true,
        sync_frequency TEXT CHECK (sync_frequency IN ('REAL_TIME', 'HOURLY', 'DAILY', 'WEEKLY')) DEFAULT 'DAILY',
        last_sync DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )`,

      `CREATE TABLE IF NOT EXISTS sync_status (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        integration_id INTEGER NOT NULL,
        status TEXT CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'PENDING',
        message_type TEXT NOT NULL,
        source_system TEXT NOT NULL,
        target_system TEXT NOT NULL,
        record_count INTEGER DEFAULT 0,
        processed_count INTEGER DEFAULT 0,
        error_count INTEGER DEFAULT 0,
        error_message TEXT,
        start_time DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        end_time DATETIME,
        duration INTEGER,
        metadata TEXT DEFAULT '{}',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (integration_id) REFERENCES integration_configs(id) ON DELETE CASCADE
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
      'CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs(type)',
      'CREATE INDEX IF NOT EXISTS idx_integration_configs_active ON integration_configs(is_active)',
      'CREATE INDEX IF NOT EXISTS idx_sync_status_integration_id ON sync_status(integration_id)',
      'CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status)',
      'CREATE INDEX IF NOT EXISTS idx_sync_status_start_time ON sync_status(start_time)'
    ];

    let completedTables = 0;
    let completedIndexes = 0;
    let completedProcessingTables = 0;
    let completedViews = 0;


    tables.forEach((sql) => {
      db.run(sql, (err) => {
        if (err) {
          console.error('Error creating table:', err);
          reject(err);
          return;
        }
        completedTables++;
        if (completedTables === tables.length) {

        }
      });
    });

    function createClaimProcessingTablesFunc() {
      // Create claim processing tables
      const processingTableStatements = createClaimProcessingTables.split(';').filter(stmt => stmt.trim());
      
      processingTableStatements.forEach((statement) => {
        if (statement.trim()) {
          db.run(statement, (err) => {
            if (err) {
              console.error('Error creating claim processing table:', err);
            } else {
              completedProcessingTables++;
            }
            
            if (completedProcessingTables === processingTableStatements.length) {
              // Create views
              const viewStatements = createClaimProcessingViews.split(';').filter(stmt => stmt.trim());
              
              viewStatements.forEach((viewStatement) => {
                if (viewStatement.trim()) {
                  db.run(viewStatement, (err) => {
                    if (err) {
                      console.error('Error creating view:', err);
                    } else {
                      completedViews++;
                    }
                    
                    if (completedViews === viewStatements.length) {
                      // Create indexes
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
                }
              });
            }
          });
        }
      });
    }
  });
}

module.exports = { initializeDatabase };
