-- Payment Receipts Database Schema
-- This schema supports receipt generation and tracking

-- Create payment_receipts table
CREATE TABLE IF NOT EXISTS payment_receipts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    payment_id INTEGER NOT NULL,
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    file_name VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    generated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    generated_by VARCHAR(100), -- User ID or 'system'
    download_count INTEGER DEFAULT 0,
    last_downloaded_at TIMESTAMP,
    receipt_type VARCHAR(20) DEFAULT 'single', -- 'single', 'batch'
    batch_payment_ids TEXT, -- JSON array of payment IDs for batch receipts
    file_size INTEGER, -- File size in bytes
    checksum VARCHAR(64), -- File checksum for integrity
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for payment_receipts
CREATE INDEX IF NOT EXISTS idx_payment_receipts_payment_id ON payment_receipts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_number ON payment_receipts(receipt_number);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_generated_at ON payment_receipts(generated_at);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_generated_by ON payment_receipts(generated_by);
CREATE INDEX IF NOT EXISTS idx_payment_receipts_receipt_type ON payment_receipts(receipt_type);

-- Add foreign key constraint if premium_payments exists
-- Note: This might fail if premium_payments doesn't exist yet
-- ALTER TABLE payment_receipts 
-- ADD CONSTRAINT fk_payment_receipts_payment 
-- FOREIGN KEY (payment_id) REFERENCES premium_payments(id);

-- Create trigger to update updated_at timestamp
CREATE TRIGGER IF NOT EXISTS update_payment_receipts_updated_at
    AFTER UPDATE ON payment_receipts
    FOR EACH ROW
BEGIN
    UPDATE payment_receipts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Create view for receipts with payment details
CREATE OR REPLACE VIEW receipts_with_payment_details AS
SELECT 
    pr.id,
    pr.payment_id,
    pr.receipt_number,
    pr.file_name,
    pr.generated_at,
    pr.generated_by,
    pr.download_count,
    pr.last_downloaded_at,
    pr.receipt_type,
    pr.file_size,
    pp.payment_amount,
    pp.payment_date,
    pp.payment_method,
    pp.payment_status,
    pp.transaction_id,
    pp.currency,
    pp.memo as payment_memo,
    p.first_name || ' ' || p.last_name as patient_name,
    p.email as patient_email,
    ip.policy_number,
    ip.insurance_provider
FROM payment_receipts pr
LEFT JOIN premium_payments pp ON pr.payment_id = pp.id
LEFT JOIN patients p ON pp.patient_id = p.id
LEFT JOIN insurance_policies ip ON pp.policy_id = ip.id;

-- Create view for batch receipts
CREATE OR REPLACE VIEW batch_receipts_details AS
SELECT 
    pr.id,
    pr.receipt_number,
    pr.file_name,
    pr.generated_at,
    pr.generated_by,
    pr.download_count,
    pr.batch_payment_ids,
    pr.file_size,
    COUNT(JSON_EACH(pr.batch_payment_ids)) as payment_count,
    SUM(pp.payment_amount) as total_amount
FROM payment_receipts pr
LEFT JOIN premium_payments pp ON 
    CAST(JSON_EXTRACT(pr.batch_payment_ids, '$') AS TEXT) LIKE '%' || pp.id || '%'
WHERE pr.receipt_type = 'batch'
GROUP BY pr.id;

-- Add validation constraints
ALTER TABLE payment_receipts 
ADD CONSTRAINT chk_payment_receipts_type 
CHECK (receipt_type IN ('single', 'batch'));

ALTER TABLE payment_receipts 
ADD CONSTRAINT chk_payment_receipts_download_count 
CHECK (download_count >= 0);

-- Create function to generate unique receipt numbers
CREATE OR REPLACE FUNCTION generate_receipt_number(payment_id INTEGER)
RETURNS TEXT AS $$
BEGIN
    RETURN 'RCP-' || 
           CASE 
               WHEN payment_id IS NOT NULL THEN CAST(payment_id AS TEXT)
               ELSE 'UNKNOWN'
           END || 
           '-' || 
           strftime('%Y%m%d%H%M%S', 'now') || 
           '-' || 
           substr(hex(randomblob(4)), 1, 4);
END;
$$ LANGUAGE plpgsql;

-- SQLite version of receipt number generation
CREATE OR REPLACE FUNCTION generate_receipt_number_sqlite(payment_id INTEGER)
RETURNS TEXT AS $$
    SELECT 'RCP-' || 
           CASE 
               WHEN payment_id IS NOT NULL THEN CAST(payment_id AS TEXT)
               ELSE 'UNKNOWN'
           END || 
           '-' || 
           strftime('%Y%m%d%H%M%S', 'now') || 
           '-' || 
           substr(hex(randomblob(4)), 1, 4);
END;

-- Create trigger to auto-generate receipt numbers
CREATE TRIGGER IF NOT EXISTS generate_receipt_number_trigger
    BEFORE INSERT ON payment_receipts
    FOR EACH ROW
    WHEN NEW.receipt_number IS NULL OR NEW.receipt_number = ''
BEGIN
    UPDATE payment_receipts 
    SET receipt_number = (
        SELECT 'RCP-' || 
               CASE 
                   WHEN NEW.payment_id IS NOT NULL THEN CAST(NEW.payment_id AS TEXT)
                   ELSE 'UNKNOWN'
               END || 
               '-' || 
               strftime('%Y%m%d%H%M%S', 'now') || 
               '-' || 
               substr(hex(randomblob(4)), 1, 4)
    )
    WHERE id = NEW.id;
END;

-- Create function to update download count
CREATE OR REPLACE FUNCTION update_download_count(receipt_id INTEGER)
RETURNS INTEGER AS $$
BEGIN
    UPDATE payment_receipts 
    SET download_count = download_count + 1,
        last_downloaded_at = CURRENT_TIMESTAMP
    WHERE id = receipt_id;
    
    RETURN (SELECT download_count FROM payment_receipts WHERE id = receipt_id);
END;
$$ LANGUAGE plpgsql;

-- SQLite version
CREATE OR REPLACE PROCEDURE update_download_count_sqlite(receipt_id INTEGER)
BEGIN
    UPDATE payment_receipts 
    SET download_count = download_count + 1,
        last_downloaded_at = CURRENT_TIMESTAMP
    WHERE id = receipt_id;
END;

-- Create receipt statistics view
CREATE OR REPLACE VIEW receipt_statistics AS
SELECT 
    COUNT(*) as total_receipts,
    COUNT(CASE WHEN receipt_type = 'single' THEN 1 END) as single_receipts,
    COUNT(CASE WHEN receipt_type = 'batch' THEN 1 END) as batch_receipts,
    SUM(download_count) as total_downloads,
    AVG(download_count) as avg_downloads_per_receipt,
    MAX(generated_at) as last_receipt_generated,
    COUNT(CASE WHEN generated_at >= date('now', '-30 days') THEN 1 END) as receipts_last_30_days,
    SUM(file_size) as total_file_size,
    AVG(file_size) as avg_file_size
FROM payment_receipts;

-- Create receipt cleanup procedure (for old receipts)
CREATE OR REPLACE PROCEDURE cleanup_old_receipts(days_old INTEGER)
BEGIN
    DELETE FROM payment_receipts 
    WHERE generated_at < date('now', '-' || days_old || ' days')
    AND download_count = 0;
END;

-- Grant permissions (adjust based on your database user setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON payment_receipts TO healthcare_app;
-- GRANT SELECT ON receipts_with_payment_details TO healthcare_app;
-- GRANT SELECT ON batch_receipts_details TO healthcare_app;
-- GRANT SELECT ON receipt_statistics TO healthcare_app;

-- Log the migration
INSERT INTO database_migrations (migration_name, executed_at) 
VALUES ('payment_receipts_schema', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
