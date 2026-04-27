-- Export History Table
CREATE TABLE IF NOT EXISTS export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('csv', 'pdf', 'json')),
    filename TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    date_range_start TEXT,
    date_range_end TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_export_history_user_id ON export_history(user_id);
CREATE INDEX IF NOT EXISTS idx_export_history_created_at ON export_history(created_at);
CREATE INDEX IF NOT EXISTS idx_export_history_format ON export_history(format);

-- Ensure premium_payments table has all required columns for export
ALTER TABLE premium_payments ADD COLUMN description TEXT DEFAULT NULL;
ALTER TABLE premium_payments ADD COLUMN currency TEXT DEFAULT 'USD';
ALTER TABLE premium_payments ADD COLUMN policy_id INTEGER DEFAULT NULL;
ALTER TABLE premium_payments ADD COLUMN insurance_provider TEXT DEFAULT NULL;
ALTER TABLE premium_payments ADD COLUMN policy_number TEXT DEFAULT NULL;

-- Create indexes for premium_payments if they don't exist
CREATE INDEX IF NOT EXISTS idx_premium_payments_patient_id ON premium_payments(patient_id);
CREATE INDEX IF NOT EXISTS idx_premium_payments_payment_date ON premium_payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_premium_payments_payment_status ON premium_payments(payment_status);
CREATE INDEX IF NOT EXISTS idx_premium_payments_payment_method ON premium_payments(payment_method);
