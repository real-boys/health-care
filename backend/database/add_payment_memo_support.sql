-- Add memo support to payment tables
-- This migration adds memo fields to support transaction identification

-- Add memo column to premium_payments table
ALTER TABLE premium_payments 
ADD COLUMN memo TEXT DEFAULT NULL,
ADD COLUMN memo_type VARCHAR(20) DEFAULT 'custom'; -- 'custom', 'auto_generated', 'system'

-- Add memo column to subscription_payments table  
ALTER TABLE subscription_payments
ADD COLUMN memo TEXT DEFAULT NULL,
ADD COLUMN memo_type VARCHAR(20) DEFAULT 'custom';

-- Add memo column to scheduled_payments table (if exists)
-- Note: This table might be created by the payment service dynamically
-- The payment service should include memo field in its table creation

-- Create indexes for memo fields
CREATE INDEX IF NOT EXISTS idx_premium_payments_memo ON premium_payments(memo);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_memo ON subscription_payments(memo);

-- Add memo column to payments_analytics table
ALTER TABLE payments_analytics
ADD COLUMN memo TEXT DEFAULT NULL,
ADD COLUMN memo_type VARCHAR(20) DEFAULT 'custom';

-- Create index for analytics memo
CREATE INDEX IF NOT EXISTS idx_payments_analytics_memo ON payments_analytics(memo);

-- Update existing payment records with default memos based on context
UPDATE premium_payments 
SET memo = 'Premium payment for policy ' || COALESCE(policy_number, 'Unknown')
WHERE memo IS NULL AND policy_number IS NOT NULL;

UPDATE subscription_payments 
SET memo = 'Subscription payment #' || id
WHERE memo IS NULL;

-- Add trigger to automatically generate memos for new payments if not provided
CREATE OR REPLACE FUNCTION generate_payment_memo()
RETURNS TRIGGER AS $$
BEGIN
    -- For premium_payments
    IF TG_TABLE_NAME = 'premium_payments' THEN
        IF NEW.memo IS NULL OR NEW.memo = '' THEN
            NEW.memo := 'Premium payment #' || NEW.id;
            NEW.memo_type := 'auto_generated';
        END IF;
    END IF;
    
    -- For subscription_payments  
    IF TG_TABLE_NAME = 'subscription_payments' THEN
        IF NEW.memo IS NULL OR NEW.memo = '' THEN
            NEW.memo := 'Subscription payment #' || NEW.id;
            NEW.memo_type := 'auto_generated';
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for automatic memo generation
-- Note: These triggers should be created only if the tables exist and don't have triggers already
-- DROP TRIGGER IF EXISTS tr_premium_payments_memo ON premium_payments;
-- CREATE TRIGGER tr_premium_payments_memo
--     BEFORE INSERT ON premium_payments
--     FOR EACH ROW
--     EXECUTE FUNCTION generate_payment_memo();

-- DROP TRIGGER IF EXISTS tr_subscription_payments_memo ON subscription_payments;
-- CREATE TRIGGER tr_subscription_payments_memo
--     BEFORE INSERT ON subscription_payments
--     FOR EACH ROW
--     EXECUTE FUNCTION generate_payment_memo();

-- Add validation constraints for memo length
ALTER TABLE premium_payments 
ADD CONSTRAINT chk_premium_payments_memo_length 
CHECK (memo IS NULL OR LENGTH(memo) <= 500);

ALTER TABLE subscription_payments
ADD CONSTRAINT chk_subscription_payments_memo_length 
CHECK (memo IS NULL OR LENGTH(memo) <= 500);

-- Add validation for memo_type
ALTER TABLE premium_payments 
ADD CONSTRAINT chk_premium_payments_memo_type 
CHECK (memo_type IN ('custom', 'auto_generated', 'system', NULL));

ALTER TABLE subscription_payments
ADD CONSTRAINT chk_subscription_payments_memo_type 
CHECK (memo_type IN ('custom', 'auto_generated', 'system', NULL));

-- Create view for payments with memos
CREATE OR REPLACE VIEW payments_with_memos AS
SELECT 
    pp.id,
    pp.patient_id,
    pp.payment_amount,
    pp.payment_date,
    pp.payment_method,
    pp.payment_status,
    pp.transaction_id,
    pp.memo,
    pp.memo_type,
    pp.currency,
    pp.policy_number,
    pp.insurance_provider,
    pp.created_at,
    p.first_name || ' ' || p.last_name as patient_name,
    p.email as patient_email
FROM premium_payments pp
LEFT JOIN patients p ON pp.patient_id = p.id
WHERE pp.memo IS NOT NULL;

-- Create view for subscription payments with memos
CREATE OR REPLACE VIEW subscription_payments_with_memos AS
SELECT 
    sp.id,
    sp.subscription_id,
    sp.customer_id,
    sp.amount,
    sp.currency,
    sp.status,
    sp.payment_method,
    sp.memo,
    sp.memo_type,
    sp.stripe_payment_intent_id,
    sp.created_at,
    c.name as customer_name,
    c.email as customer_email
FROM subscription_payments sp
LEFT JOIN customers c ON sp.customer_id = c.id
WHERE sp.memo IS NOT NULL;

-- Grant permissions (adjust based on your database user setup)
-- GRANT SELECT, UPDATE ON payments_with_memos TO healthcare_app;
-- GRANT SELECT, UPDATE ON subscription_payments_with_memos TO healthcare_app;

-- Log the migration completion
INSERT INTO database_migrations (migration_name, executed_at) 
VALUES ('add_payment_memo_support', CURRENT_TIMESTAMP)
ON CONFLICT DO NOTHING;
