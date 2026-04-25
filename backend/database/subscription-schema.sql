-- Subscription Management System Schema for Healthcare Platform

-- Subscription plans
CREATE TABLE IF NOT EXISTS subscription_plans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) NOT NULL, -- 'monthly', 'yearly', 'quarterly'
    setup_fee DECIMAL(10,2) DEFAULT 0.00,
    trial_days INTEGER DEFAULT 0,
    
    -- Plan configuration
    max_patients INTEGER DEFAULT 0, -- 0 = unlimited
    max_providers INTEGER DEFAULT 0,
    max_storage_gb INTEGER DEFAULT 0,
    api_calls_per_month INTEGER DEFAULT 0,
    features TEXT, -- JSON array of features
    feature_limits TEXT, -- JSON object with feature limits
    
    -- Plan hierarchy
    tier_level INTEGER DEFAULT 0, -- Higher = more features
    upgrade_from_plan_id INTEGER REFERENCES subscription_plans(id),
    downgrade_to_plan_id INTEGER REFERENCES subscription_plans(id),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    is_public BOOLEAN DEFAULT true,
    is_enterprise BOOLEAN DEFAULT false,
    
    -- Usage-based billing
    usage_based BOOLEAN DEFAULT false,
    usage_pricing TEXT, -- JSON object with usage pricing tiers
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    
    -- Subscription details
    status VARCHAR(20) NOT NULL DEFAULT 'active', -- 'active', 'canceled', 'past_due', 'unpaid', 'trialing'
    current_period_start TIMESTAMP NOT NULL,
    current_period_end TIMESTAMP NOT NULL,
    trial_start TIMESTAMP,
    trial_end TIMESTAMP,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) NOT NULL,
    
    -- Stripe integration
    stripe_subscription_id VARCHAR(255),
    stripe_customer_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    
    -- Usage tracking
    current_usage_usage TEXT, -- JSON object with current usage metrics
    usage_reset_date TIMESTAMP,
    
    -- Cancellation
    cancel_at_period_end BOOLEAN DEFAULT false,
    canceled_at TIMESTAMP,
    cancellation_reason TEXT,
    
    -- Metadata
    metadata TEXT, -- JSON object for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id),
    updated_by INTEGER REFERENCES users(id)
);

-- Subscription items (for multi-product subscriptions)
CREATE TABLE IF NOT EXISTS subscription_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
    plan_id INTEGER NOT NULL REFERENCES subscription_plans(id),
    
    -- Item details
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Stripe integration
    stripe_subscription_item_id VARCHAR(255),
    stripe_price_id VARCHAR(255),
    
    -- Usage tracking
    usage_quantity INTEGER DEFAULT 0,
    usage_unit VARCHAR(50), -- 'patient', 'api_call', 'storage_gb', etc.
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoices for subscriptions
CREATE TABLE IF NOT EXISTS subscription_invoices (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    
    -- Invoice details
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'draft', -- 'draft', 'open', 'paid', 'void', 'uncollectible'
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Amounts
    subtotal DECIMAL(10,2) NOT NULL,
    tax_amount DECIMAL(10,2) DEFAULT 0.00,
    total_amount DECIMAL(10,2) NOT NULL,
    amount_paid DECIMAL(10,2) DEFAULT 0.00,
    amount_due DECIMAL(10,2) NOT NULL,
    
    -- Dates
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    due_date TIMESTAMP NOT NULL,
    paid_at TIMESTAMP,
    
    -- Stripe integration
    stripe_invoice_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    
    -- Line items
    line_items TEXT, -- JSON array of line items
    
    -- Metadata
    metadata TEXT, -- JSON object for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription payments
CREATE TABLE IF NOT EXISTS subscription_payments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER REFERENCES subscription_invoices(id),
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    
    -- Payment details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL, -- 'pending', 'succeeded', 'failed', 'canceled', 'refunded'
    payment_method VARCHAR(50), -- 'card', 'bank_transfer', 'check', etc.
    
    -- Stripe integration
    stripe_payment_intent_id VARCHAR(255),
    stripe_charge_id VARCHAR(255),
    stripe_refund_id VARCHAR(255),
    
    -- Dates
    created_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP,
    
    -- Failure handling
    failure_code VARCHAR(50),
    failure_message TEXT,
    next_retry_at TIMESTAMP,
    retry_count INTEGER DEFAULT 0,
    
    -- Metadata
    metadata TEXT, -- JSON object for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Usage records
CREATE TABLE IF NOT EXISTS usage_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    
    -- Usage details
    usage_type VARCHAR(50) NOT NULL, -- 'patients', 'api_calls', 'storage_gb', etc.
    quantity INTEGER NOT NULL DEFAULT 1,
    unit VARCHAR(50) NOT NULL, -- 'count', 'mb', 'gb', 'call', etc.
    
    -- Pricing
    unit_price DECIMAL(10,2),
    total_price DECIMAL(10,2),
    
    -- Time period
    period_start TIMESTAMP NOT NULL,
    period_end TIMESTAMP NOT NULL,
    recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Source
    source VARCHAR(50), -- 'system', 'manual', 'api', etc.
    source_id INTEGER, -- ID of the source record
    
    -- Metadata
    metadata TEXT, -- JSON object for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Dunning management
CREATE TABLE IF NOT EXISTS dunning_campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Campaign configuration
    plan_id INTEGER REFERENCES subscription_plans(id),
    trigger_conditions TEXT, -- JSON object with trigger conditions
    steps TEXT, -- JSON array of dunning steps
    
    -- Timing
    delay_hours INTEGER DEFAULT 72, -- Hours after payment failure to start
    max_attempts INTEGER DEFAULT 3,
    retry_interval_hours INTEGER DEFAULT 24,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Dunning instances
CREATE TABLE IF NOT EXISTS dunning_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL REFERENCES dunning_campaigns(id),
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    payment_id INTEGER REFERENCES subscription_payments(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    
    -- Instance details
    status VARCHAR(20) NOT NULL DEFAULT 'pending', -- 'pending', 'in_progress', 'completed', 'failed', 'cancelled'
    current_step INTEGER DEFAULT 0,
    total_steps INTEGER DEFAULT 0,
    
    -- Timing
    started_at TIMESTAMP,
    next_action_at TIMESTAMP,
    completed_at TIMESTAMP,
    
    -- Results
    payment_collected BOOLEAN DEFAULT false,
    collected_amount DECIMAL(10,2),
    subscription_cancelled BOOLEAN DEFAULT false,
    
    -- Communication
    emails_sent INTEGER DEFAULT 0,
    sms_sent INTEGER DEFAULT 0,
    calls_made INTEGER DEFAULT 0,
    
    -- Metadata
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription events (webhook events and internal events)
CREATE TABLE IF NOT EXISTS subscription_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER REFERENCES subscriptions(id),
    customer_id INTEGER REFERENCES customers(id),
    
    -- Event details
    event_type VARCHAR(50) NOT NULL, -- 'created', 'updated', 'canceled', 'payment_failed', etc.
    event_source VARCHAR(50) NOT NULL, -- 'stripe', 'system', 'user', 'api'
    event_data TEXT, -- JSON object with event data
    
    -- Status
    processed BOOLEAN DEFAULT false,
    processed_at TIMESTAMP,
    processing_error TEXT,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription metrics and analytics
CREATE TABLE IF NOT EXISTS subscription_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    
    -- Time period
    metric_date DATE NOT NULL,
    period_type VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly'
    
    -- Counts
    total_subscriptions INTEGER DEFAULT 0,
    active_subscriptions INTEGER DEFAULT 0,
    trial_subscriptions INTEGER DEFAULT 0,
    canceled_subscriptions INTEGER DEFAULT 0,
    new_subscriptions INTEGER DEFAULT 0,
    churned_subscriptions INTEGER DEFAULT 0,
    
    -- Revenue
    total_revenue DECIMAL(12,2) DEFAULT 0.00,
    mrr DECIMAL(12,2) DEFAULT 0.00, -- Monthly Recurring Revenue
    arr DECIMAL(12,2) DEFAULT 0.00, -- Annual Recurring Revenue
    
    -- Metrics
    churn_rate DECIMAL(5,4) DEFAULT 0.0000,
    ltv DECIMAL(10,2) DEFAULT 0.00, -- Lifetime Value
    arpu DECIMAL(10,2) DEFAULT 0.00, -- Average Revenue Per User
    
    -- Plan breakdown
    plan_breakdown TEXT, -- JSON object with metrics by plan
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customer table (if not exists)
CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER UNIQUE REFERENCES users(id),
    
    -- Customer details
    email VARCHAR(255) NOT NULL,
    name VARCHAR(255),
    phone VARCHAR(50),
    company VARCHAR(255),
    
    -- Address
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    city VARCHAR(100),
    state VARCHAR(50),
    postal_code VARCHAR(20),
    country VARCHAR(2),
    
    -- Tax information
    tax_id VARCHAR(50),
    tax_exempt BOOLEAN DEFAULT false,
    
    -- Billing
    billing_email VARCHAR(255),
    payment_method_default VARCHAR(255),
    
    -- Stripe integration
    stripe_customer_id VARCHAR(255) UNIQUE,
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Metadata
    metadata TEXT, -- JSON object for additional data
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payment methods
CREATE TABLE IF NOT EXISTS payment_methods (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    
    -- Payment method details
    type VARCHAR(50) NOT NULL, -- 'card', 'bank_account', 'sepa_debit', etc.
    is_default BOOLEAN DEFAULT false,
    
    -- Card details (encrypted or tokenized)
    card_last4 VARCHAR(4),
    card_brand VARCHAR(50),
    card_exp_month INTEGER,
    card_exp_year INTEGER,
    
    -- Bank details
    bank_last4 VARCHAR(4),
    bank_name VARCHAR(255),
    
    -- Stripe integration
    stripe_payment_method_id VARCHAR(255),
    
    -- Status
    status VARCHAR(20) DEFAULT 'active',
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription add-ons and extras
CREATE TABLE IF NOT EXISTS subscription_add_ons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100) NOT NULL,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Pricing
    price DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    billing_cycle VARCHAR(20) NOT NULL,
    
    -- Configuration
    is_active BOOLEAN DEFAULT true,
    applies_to_plans TEXT, -- JSON array of plan IDs this applies to
    max_quantity INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription add-on instances
CREATE TABLE IF NOT EXISTS subscription_add_on_instances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    subscription_id INTEGER NOT NULL REFERENCES subscriptions(id),
    add_on_id INTEGER NOT NULL REFERENCES subscription_add_ons(id),
    
    quantity INTEGER DEFAULT 1,
    price DECIMAL(10,2) NOT NULL,
    
    -- Stripe integration
    stripe_subscription_item_id VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Dates
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    ended_at TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Discount codes and coupons
CREATE TABLE IF NOT EXISTS discount_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code VARCHAR(50) UNIQUE NOT NULL,
    name VARCHAR(255),
    description TEXT,
    
    -- Discount details
    discount_type VARCHAR(20) NOT NULL, -- 'percentage', 'fixed_amount', 'free_trial'
    discount_value DECIMAL(10,2) NOT NULL,
    discount_duration VARCHAR(20), -- 'once', 'repeating', 'forever'
    discount_duration_months INTEGER,
    
    -- Applicability
    applies_to_plans TEXT, -- JSON array of plan IDs
    applies_to_add_ons TEXT, -- JSON array of add-on IDs
    minimum_amount DECIMAL(10,2),
    
    -- Limits
    max_uses INTEGER,
    current_uses INTEGER DEFAULT 0,
    max_uses_per_customer INTEGER DEFAULT 1,
    
    -- Timing
    starts_at TIMESTAMP,
    expires_at TIMESTAMP,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by INTEGER REFERENCES users(id)
);

-- Discount code redemptions
CREATE TABLE IF NOT EXISTS discount_redemptions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    discount_code_id INTEGER NOT NULL REFERENCES discount_codes(id),
    subscription_id INTEGER REFERENCES subscriptions(id),
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    
    -- Redemption details
    discount_amount DECIMAL(10,2) NOT NULL,
    applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_subscription_plans_active ON subscription_plans(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_tier ON subscription_plans(tier_level);
CREATE INDEX IF NOT EXISTS idx_subscription_plans_billing ON subscription_plans(billing_cycle);

CREATE INDEX IF NOT EXISTS idx_subscriptions_customer ON subscriptions(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_plan ON subscriptions(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_period ON subscriptions(current_period_start, current_period_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

CREATE INDEX IF NOT EXISTS idx_subscription_items_subscription ON subscription_items(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_plan ON subscription_items(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscription_items_active ON subscription_items(is_active);

CREATE INDEX IF NOT EXISTS idx_subscription_invoices_subscription ON subscription_invoices(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_customer ON subscription_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_status ON subscription_invoices(status);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_period ON subscription_invoices(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_subscription_invoices_stripe ON subscription_invoices(stripe_invoice_id);

CREATE INDEX IF NOT EXISTS idx_subscription_payments_subscription ON subscription_payments(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_invoice ON subscription_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_status ON subscription_payments(status);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_created ON subscription_payments(created_at);
CREATE INDEX IF NOT EXISTS idx_subscription_payments_stripe ON subscription_payments(stripe_payment_intent_id);

CREATE INDEX IF NOT EXISTS idx_usage_records_subscription ON usage_records(subscription_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_customer ON usage_records(customer_id);
CREATE INDEX IF NOT EXISTS idx_usage_records_type ON usage_records(usage_type);
CREATE INDEX IF NOT EXISTS idx_usage_records_period ON usage_records(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_usage_records_recorded ON usage_records(recorded_at);

CREATE INDEX IF NOT EXISTS idx_dunning_campaigns_active ON dunning_campaigns(is_active);
CREATE INDEX IF NOT EXISTS idx_dunning_instances_subscription ON dunning_instances(subscription_id);
CREATE INDEX IF NOT EXISTS idx_dunning_instances_status ON dunning_instances(status);
CREATE INDEX IF NOT EXISTS idx_dunning_instances_next_action ON dunning_instances(next_action_at);

CREATE INDEX IF NOT EXISTS idx_subscription_events_subscription ON subscription_events(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_events_type ON subscription_events(event_type);
CREATE INDEX IF NOT EXISTS idx_subscription_events_processed ON subscription_events(processed);
CREATE INDEX IF NOT EXISTS idx_subscription_events_created ON subscription_events(created_at);

CREATE INDEX IF NOT EXISTS idx_subscription_metrics_date ON subscription_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_subscription_metrics_period ON subscription_metrics(period_type);

CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
CREATE INDEX IF NOT EXISTS idx_customers_stripe ON customers(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_customers_user ON customers(user_id);

CREATE INDEX IF NOT EXISTS idx_payment_methods_customer ON payment_methods(customer_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_default ON payment_methods(is_default);
CREATE INDEX IF NOT EXISTS idx_payment_methods_stripe ON payment_methods(stripe_payment_method_id);

CREATE INDEX IF NOT EXISTS idx_subscription_add_ons_active ON subscription_add_ons(is_active);
CREATE INDEX IF NOT EXISTS idx_subscription_add_on_instances_subscription ON subscription_add_on_instances(subscription_id);
CREATE INDEX IF NOT EXISTS idx_subscription_add_on_instances_active ON subscription_add_on_instances(is_active);

CREATE INDEX IF NOT EXISTS idx_discount_codes_active ON discount_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_discount_codes_code ON discount_codes(code);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_code ON discount_redemptions(discount_code_id);
CREATE INDEX IF NOT EXISTS idx_discount_redemptions_customer ON discount_redemptions(customer_id);

-- Create triggers for automatic updates
CREATE TRIGGER IF NOT EXISTS update_subscription_plans_updated_at
    AFTER UPDATE ON subscription_plans
    FOR EACH ROW
BEGIN
    UPDATE subscription_plans SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscriptions_updated_at
    AFTER UPDATE ON subscriptions
    FOR EACH ROW
BEGIN
    UPDATE subscriptions SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscription_items_updated_at
    AFTER UPDATE ON subscription_items
    FOR EACH ROW
BEGIN
    UPDATE subscription_items SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscription_invoices_updated_at
    AFTER UPDATE ON subscription_invoices
    FOR EACH ROW
BEGIN
    UPDATE subscription_invoices SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscription_payments_updated_at
    AFTER UPDATE ON subscription_payments
    FOR EACH ROW
BEGIN
    UPDATE subscription_payments SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dunning_campaigns_updated_at
    AFTER UPDATE ON dunning_campaigns
    FOR EACH ROW
BEGIN
    UPDATE dunning_campaigns SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_dunning_instances_updated_at
    AFTER UPDATE ON dunning_instances
    FOR EACH ROW
BEGIN
    UPDATE dunning_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscription_metrics_updated_at
    AFTER UPDATE ON subscription_metrics
    FOR EACH ROW
BEGIN
    UPDATE subscription_metrics SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_customers_updated_at
    AFTER UPDATE ON customers
    FOR EACH ROW
BEGIN
    UPDATE customers SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_payment_methods_updated_at
    AFTER UPDATE ON payment_methods
    FOR EACH ROW
BEGIN
    UPDATE payment_methods SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscription_add_ons_updated_at
    AFTER UPDATE ON subscription_add_ons
    FOR EACH ROW
BEGIN
    UPDATE subscription_add_ons SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_subscription_add_on_instances_updated_at
    AFTER UPDATE ON subscription_add_on_instances
    FOR EACH ROW
BEGIN
    UPDATE subscription_add_on_instances SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_discount_codes_updated_at
    AFTER UPDATE ON discount_codes
    FOR EACH ROW
BEGIN
    UPDATE discount_codes SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Insert default subscription plans
INSERT INTO subscription_plans (name, display_name, description, price, billing_cycle, max_patients, max_providers, max_storage_gb, api_calls_per_month, features, tier_level, is_active, is_public) VALUES
('basic', 'Basic Plan', 'Perfect for small practices', 99.00, 'monthly', 50, 5, 10, 1000, '["Patient Management", "Appointment Scheduling", "Basic Reporting", "Email Support"]', 1, true, true),
('professional', 'Professional Plan', 'Ideal for growing practices', 299.00, 'monthly', 200, 15, 50, 5000, '["Patient Management", "Appointment Scheduling", "Advanced Reporting", "Priority Support", "API Access", "Custom Forms"]', 2, true, true),
('enterprise', 'Enterprise Plan', 'Complete solution for large organizations', 799.00, 'monthly', 0, 0, 500, 50000, '["Patient Management", "Appointment Scheduling", "Advanced Analytics", "Dedicated Support", "Full API Access", "Custom Integrations", "White-label Options"]', 3, true, true),
('starter', 'Starter Plan', 'Get started with essential features', 49.00, 'monthly', 10, 2, 5, 500, '["Patient Management", "Basic Scheduling", "Email Support"]', 0, true, true)
ON CONFLICT (name) DO NOTHING;

-- Add yearly pricing variants
INSERT INTO subscription_plans (name, display_name, description, price, billing_cycle, max_patients, max_providers, max_storage_gb, api_calls_per_month, features, tier_level, is_active, is_public) VALUES
('basic_yearly', 'Basic Plan (Yearly)', 'Basic plan with 20% discount', 950.40, 'yearly', 50, 5, 10, 1000, '["Patient Management", "Appointment Scheduling", "Basic Reporting", "Email Support"]', 1, true, true),
('professional_yearly', 'Professional Plan (Yearly)', 'Professional plan with 20% discount', 2870.40, 'yearly', 200, 15, 50, 5000, '["Patient Management", "Appointment Scheduling", "Advanced Reporting", "Priority Support", "API Access", "Custom Forms"]', 2, true, true),
('enterprise_yearly', 'Enterprise Plan (Yearly)', 'Enterprise plan with 20% discount', 7670.40, 'yearly', 0, 0, 500, 50000, '["Patient Management", "Appointment Scheduling", "Advanced Analytics", "Dedicated Support", "Full API Access", "Custom Integrations", "White-label Options"]', 3, true, true),
('starter_yearly', 'Starter Plan (Yearly)', 'Starter plan with 20% discount', 470.40, 'yearly', 10, 2, 5, 500, '["Patient Management", "Basic Scheduling", "Email Support"]', 0, true, true)
ON CONFLICT (name) DO NOTHING;

-- Insert default add-ons
INSERT INTO subscription_add_ons (name, display_name, description, price, billing_cycle, is_active) VALUES
('extra_storage', 'Extra Storage', 'Additional 100GB of storage space', 20.00, 'monthly', true),
('extra_patients', 'Extra Patient Slots', 'Additional 50 patient slots', 25.00, 'monthly', true),
('priority_support', 'Priority Support', '24/7 priority support with dedicated account manager', 100.00, 'monthly', true),
('advanced_analytics', 'Advanced Analytics', 'Advanced reporting and analytics dashboard', 50.00, 'monthly', true),
('api_plus', 'API Plus', 'Extended API limits and advanced API features', 75.00, 'monthly', true)
ON CONFLICT (name) DO NOTHING;

-- Insert default discount codes
INSERT INTO discount_codes (code, name, description, discount_type, discount_value, discount_duration, max_uses, is_active) VALUES
('WELCOME20', 'Welcome Discount', '20% off first month for new customers', 'percentage', 20.00, 'once', 1000, true),
('ANNUAL20', 'Annual Discount', '20% off annual plans', 'percentage', 20.00, 'forever', 0, true),
('TRIAL30', '30-Day Free Trial', '30 days free trial', 'free_trial', 0.00, 'once', 500, true),
('NONPROFIT50', 'Non-Profit Discount', '50% discount for qualified non-profit organizations', 'percentage', 50.00, 'forever', 100, true)
ON CONFLICT (code) DO NOTHING;

-- Create default dunning campaign
INSERT INTO dunning_campaigns (name, description, trigger_conditions, steps, delay_hours, max_attempts, retry_interval_hours, is_active) VALUES
('Standard Dunning', 'Standard dunning process for failed payments', 
'{"payment_failed": true, "days_overdue": 1}',
'[
  {"step": 1, "action": "email", "template": "payment_failed_day_1", "delay_hours": 0},
  {"step": 2, "action": "email", "template": "payment_failed_day_3", "delay_hours": 48},
  {"step": 3, "action": "email", "template": "payment_failed_day_7", "delay_hours": 96},
  {"step": 4, "action": "email", "template": "subscription_cancellation_warning", "delay_hours": 168}
]',
72, 4, 24, true)
ON CONFLICT (name) DO NOTHING;

-- Create function to calculate subscription metrics
CREATE OR REPLACE FUNCTION calculate_subscription_metrics(target_date DATE, period_type VARCHAR(20))
RETURNS VOID AS $$
BEGIN
    INSERT INTO subscription_metrics (
        metric_date, period_type, total_subscriptions, active_subscriptions, 
        trial_subscriptions, new_subscriptions, churned_subscriptions,
        total_revenue, mrr, arr
    )
    SELECT 
        target_date,
        period_type,
        COUNT(*) as total_subscriptions,
        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_subscriptions,
        SUM(CASE WHEN status = 'trialing' THEN 1 ELSE 0 END) as trial_subscriptions,
        SUM(CASE WHEN DATE(created_at) = target_date THEN 1 ELSE 0 END) as new_subscriptions,
        SUM(CASE WHEN status = 'canceled' AND DATE(updated_at) = target_date THEN 1 ELSE 0 END) as churned_subscriptions,
        COALESCE(SUM(price), 0) as total_revenue,
        COALESCE(SUM(CASE WHEN billing_cycle = 'monthly' THEN price ELSE price/12 END), 0) as mrr,
        COALESCE(SUM(CASE WHEN billing_cycle = 'yearly' THEN price ELSE price*12 END), 0) as arr
    FROM subscriptions
    WHERE current_period_start <= target_date AND target_date <= current_period_end
    ON CONFLICT (metric_date, period_type) DO UPDATE SET
        total_subscriptions = EXCLUDED.total_subscriptions,
        active_subscriptions = EXCLUDED.active_subscriptions,
        trial_subscriptions = EXCLUDED.trial_subscriptions,
        new_subscriptions = EXCLUDED.new_subscriptions,
        churned_subscriptions = EXCLUDED.churned_subscriptions,
        total_revenue = EXCLUDED.total_revenue,
        mrr = EXCLUDED.mrr,
        arr = EXCLUDED.arr,
        updated_at = CURRENT_TIMESTAMP;
END;
$$ LANGUAGE plpgsql;

-- Create view for subscription summary
CREATE OR REPLACE VIEW subscription_summary AS
SELECT 
    sp.name as plan_name,
    sp.display_name as plan_display_name,
    sp.billing_cycle,
    sp.price,
    COUNT(s.id) as subscription_count,
    SUM(CASE WHEN s.status = 'active' THEN 1 ELSE 0 END) as active_count,
    SUM(CASE WHEN s.status = 'trialing' THEN 1 ELSE 0 END) as trial_count,
    SUM(CASE WHEN s.status = 'canceled' THEN 1 ELSE 0 END) as canceled_count,
    SUM(s.price) as total_revenue,
    AVG(s.price) as avg_revenue
FROM subscription_plans sp
LEFT JOIN subscriptions s ON sp.id = s.plan_id
WHERE sp.is_active = true
GROUP BY sp.id, sp.name, sp.display_name, sp.billing_cycle, sp.price
ORDER BY sp.tier_level, sp.price;

-- Create view for customer subscription status
CREATE OR REPLACE VIEW customer_subscription_status AS
SELECT 
    c.id as customer_id,
    c.email,
    c.name,
    s.id as subscription_id,
    s.status as subscription_status,
    sp.display_name as plan_name,
    s.current_period_start,
    s.current_period_end,
    s.trial_end,
    s.cancel_at_period_end,
    s.price,
    s.billing_cycle,
    CASE 
        WHEN s.trial_end > CURRENT_TIMESTAMP THEN 'trial'
        WHEN s.status = 'active' THEN 'active'
        WHEN s.status = 'past_due' THEN 'past_due'
        WHEN s.status = 'canceled' THEN 'canceled'
        ELSE s.status
    END as effective_status
FROM customers c
LEFT JOIN subscriptions s ON c.id = s.customer_id
LEFT JOIN subscription_plans sp ON s.plan_id = sp.id
ORDER BY c.email;
