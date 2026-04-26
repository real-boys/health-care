-- Invoice and Billing System Schema for Healthcare Platform

-- Invoice templates table
CREATE TABLE IF NOT EXISTS invoice_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    template_type VARCHAR(50) DEFAULT 'standard', -- 'standard', 'custom', 'insurance', 'patient'
    html_content TEXT NOT NULL,
    css_styles TEXT,
    logo_url VARCHAR(500),
    footer_text TEXT,
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tax jurisdictions table
CREATE TABLE IF NOT EXISTS tax_jurisdictions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL, -- 'US-CA', 'US-NY', 'EU-DE', etc.
    country VARCHAR(2) NOT NULL,
    state_province VARCHAR(100),
    tax_rate DECIMAL(5,4) NOT NULL, -- e.g., 0.0875 for 8.75%
    tax_type VARCHAR(50) DEFAULT 'sales', -- 'sales', 'vat', 'gst', 'hst'
    is_active BOOLEAN DEFAULT true,
    effective_date DATE DEFAULT CURRENT_DATE,
    expiry_date DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice line items table
CREATE TABLE IF NOT EXISTS invoice_line_items (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    discount_percentage DECIMAL(5,2) DEFAULT 0,
    tax_rate DECIMAL(5,4) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    line_total DECIMAL(10,2) NOT NULL,
    item_type VARCHAR(50) DEFAULT 'service', -- 'service', 'product', 'consultation', 'procedure'
    service_code VARCHAR(50), -- CPT, HCPCS codes
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Main invoices table
CREATE TABLE IF NOT EXISTS invoices (
    id SERIAL PRIMARY KEY,
    invoice_number VARCHAR(50) UNIQUE NOT NULL,
    template_id INTEGER REFERENCES invoice_templates(id),
    patient_id INTEGER REFERENCES patients(id),
    provider_id INTEGER REFERENCES healthcare_providers(id),
    billing_entity_id INTEGER, -- Could be provider, hospital, or billing company
    billing_entity_type VARCHAR(50), -- 'provider', 'hospital', 'billing_company'
    
    -- Invoice details
    issue_date DATE DEFAULT CURRENT_DATE,
    due_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'sent', 'paid', 'overdue', 'cancelled', 'refunded'
    payment_status VARCHAR(20) DEFAULT 'unpaid', -- 'unpaid', 'partially_paid', 'paid', 'refunded'
    
    -- Financial amounts
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    tax_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    paid_amount DECIMAL(10,2) DEFAULT 0,
    balance_due DECIMAL(10,2) GENERATED ALWAYS AS (total_amount - paid_amount) STORED,
    
    -- Tax information
    tax_jurisdiction_id INTEGER REFERENCES tax_jurisdictions(id),
    tax_exempt BOOLEAN DEFAULT false,
    tax_exemption_reason VARCHAR(255),
    
    -- Insurance information
    insurance_claim_id INTEGER,
    insurance_payer VARCHAR(255),
    policy_number VARCHAR(100),
    claim_status VARCHAR(20), -- 'submitted', 'approved', 'denied', 'pending'
    insurance_paid_amount DECIMAL(10,2) DEFAULT 0,
    
    -- Delivery and tracking
    delivery_method VARCHAR(50), -- 'email', 'mail', 'portal', 'electronic'
    delivery_status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed'
    delivery_attempts INTEGER DEFAULT 0,
    last_delivery_attempt TIMESTAMP,
    
    -- Metadata
    notes TEXT,
    internal_notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    sent_at TIMESTAMP,
    paid_at TIMESTAMP,
    cancelled_at TIMESTAMP
);

-- Invoice payments table
CREATE TABLE IF NOT EXISTS invoice_payments (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    payment_id INTEGER REFERENCES scheduled_payments(id),
    payment_method VARCHAR(50) NOT NULL, -- 'stripe', 'paypal', 'crypto', 'check', 'cash'
    transaction_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    gateway_response JSONB,
    processed_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice reminders table
CREATE TABLE IF NOT EXISTS invoice_reminders (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    reminder_type VARCHAR(50) NOT NULL, -- 'due_soon', 'overdue', 'final_notice', 'collection'
    scheduled_date TIMESTAMP NOT NULL,
    sent_date TIMESTAMP,
    status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled', 'sent', 'failed', 'cancelled'
    delivery_method VARCHAR(50), -- 'email', 'sms', 'mail', 'portal'
    template_used VARCHAR(255),
    recipient_email VARCHAR(255),
    recipient_phone VARCHAR(20),
    response_received BOOLEAN DEFAULT false,
    response_date TIMESTAMP,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice history/audit trail
CREATE TABLE IF NOT EXISTS invoice_history (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL, -- 'created', 'sent', 'paid', 'modified', 'cancelled', 'reminder_sent'
    old_status VARCHAR(20),
    new_status VARCHAR(20),
    amount_change DECIMAL(10,2),
    description TEXT,
    changed_by INTEGER REFERENCES users(id),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice delivery logs
CREATE TABLE IF NOT EXISTS invoice_delivery_logs (
    id SERIAL PRIMARY KEY,
    invoice_id INTEGER REFERENCES invoices(id) ON DELETE CASCADE,
    delivery_method VARCHAR(50) NOT NULL,
    recipient VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'sent', 'delivered', 'opened', 'clicked', 'bounced', 'failed'
    error_message TEXT,
    delivery_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    tracking_id VARCHAR(255),
    metadata JSONB
);

-- Billing reports table
CREATE TABLE IF NOT EXISTS billing_reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL, -- 'monthly', 'quarterly', 'annual', 'custom'
    date_range_start DATE NOT NULL,
    date_range_end DATE NOT NULL,
    parameters JSONB,
    generated_by INTEGER REFERENCES users(id),
    file_path VARCHAR(500),
    file_format VARCHAR(20) DEFAULT 'pdf', -- 'pdf', 'excel', 'csv'
    status VARCHAR(20) DEFAULT 'generating', -- 'generating', 'completed', 'failed'
    generated_at TIMESTAMP,
    download_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Invoice analytics cache table
CREATE TABLE IF NOT EXISTS invoice_analytics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    metric_period VARCHAR(20) NOT NULL, -- 'daily', 'weekly', 'monthly', 'yearly'
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    filters JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(metric_name, metric_period, period_start, period_end)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_invoices_patient ON invoices(patient_id);
CREATE INDEX IF NOT EXISTS idx_invoices_provider ON invoices(provider_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_payment_status ON invoices(payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_issue_date ON invoices(issue_date);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_total_amount ON invoices(total_amount);
CREATE INDEX IF NOT EXISTS idx_invoices_number ON invoices(invoice_number);

CREATE INDEX IF NOT EXISTS idx_line_items_invoice ON invoice_line_items(invoice_id);
CREATE INDEX IF NOT EXISTS idx_line_items_type ON invoice_line_items(item_type);

CREATE INDEX IF NOT EXISTS idx_payments_invoice ON invoice_payments(invoice_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON invoice_payments(status);
CREATE INDEX IF NOT EXISTS idx_payments_date ON invoice_payments(payment_date);

CREATE INDEX IF NOT EXISTS idx_reminders_invoice ON invoice_reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON invoice_reminders(status);
CREATE INDEX IF NOT EXISTS idx_reminders_scheduled ON invoice_reminders(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_history_invoice ON invoice_history(invoice_id);
CREATE INDEX IF NOT EXISTS idx_history_date ON invoice_history(created_at);

CREATE INDEX IF NOT EXISTS idx_delivery_logs_invoice ON invoice_delivery_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_delivery_logs_status ON invoice_delivery_logs(status);

CREATE INDEX IF NOT EXISTS idx_reports_type ON billing_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_reports_date_range ON billing_reports(date_range_start, date_range_end);

CREATE INDEX IF NOT EXISTS idx_analytics_metric ON invoice_analytics(metric_name);
CREATE INDEX IF NOT EXISTS idx_analytics_period ON invoice_analytics(metric_period, period_start);

-- Create triggers for audit trail and automatic updates
CREATE OR REPLACE FUNCTION update_invoice_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_updated_at
    BEFORE UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION update_invoice_updated_at();

-- Function to log invoice history
CREATE OR REPLACE FUNCTION log_invoice_history()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        INSERT INTO invoice_history (invoice_id, action, new_status, description, changed_by)
        VALUES (NEW.id, 'created', NEW.status, 'Invoice created', NEW.created_by);
        RETURN NEW;
    ELSIF TG_OP = 'UPDATE' THEN
        IF OLD.status != NEW.status THEN
            INSERT INTO invoice_history (invoice_id, action, old_status, new_status, description, changed_by)
            VALUES (NEW.id, 'status_changed', OLD.status, NEW.status, 
                    'Status changed from ' || OLD.status || ' to ' || NEW.status, NEW.created_by);
        END IF;
        IF OLD.total_amount != NEW.total_amount THEN
            INSERT INTO invoice_history (invoice_id, action, amount_change, description, changed_by)
            VALUES (NEW.id, 'amount_changed', NEW.total_amount - OLD.total_amount,
                    'Amount changed from ' || OLD.total_amount || ' to ' || NEW.total_amount, NEW.created_by);
        END IF;
        RETURN NEW;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_invoice_history
    AFTER INSERT OR UPDATE ON invoices
    FOR EACH ROW
    EXECUTE FUNCTION log_invoice_history();

-- Function to generate invoice numbers
CREATE OR REPLACE FUNCTION generate_invoice_number()
RETURNS TRIGGER AS $$
DECLARE
    year_part TEXT;
    month_part TEXT;
    sequence_num TEXT;
BEGIN
    year_part := to_char(CURRENT_DATE, 'YYYY');
    month_part := to_char(CURRENT_DATE, 'MM');
    
    -- Get next sequence number for this month
    SELECT COALESCE(MAX(CAST(SUBSTRING(invoice_number FROM 9 FOR 4) AS INTEGER)), 0) + 1
    INTO sequence_num
    FROM invoices
    WHERE invoice_number LIKE 'INV-' || year_part || month_part || '-%';
    
    NEW.invoice_number := 'INV-' || year_part || month_part || '-' || LPAD(sequence_num, 4, '0');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invoice_number
    BEFORE INSERT ON invoices
    FOR EACH ROW
    WHEN (NEW.invoice_number IS NULL)
    EXECUTE FUNCTION generate_invoice_number();

-- Insert default tax jurisdictions
INSERT INTO tax_jurisdictions (name, code, country, state_province, tax_rate, tax_type) VALUES
('California Sales Tax', 'US-CA', 'US', 'California', 0.0875, 'sales'),
('New York Sales Tax', 'US-NY', 'US', 'New York', 0.0800, 'sales'),
('Texas Sales Tax', 'US-TX', 'US', 'Texas', 0.0625, 'sales'),
('Florida Sales Tax', 'US-FL', 'US', 'Florida', 0.0600, 'sales'),
('Illinois Sales Tax', 'US-IL', 'US', 'Illinois', 0.0625, 'sales'),
('Ontario HST', 'CA-ON', 'CA', 'Ontario', 0.1300, 'hst'),
('British Columbia GST', 'CA-BC', 'CA', 'British Columbia', 0.0500, 'gst'),
('Germany VAT', 'EU-DE', 'DE', NULL, 0.1900, 'vat'),
('France VAT', 'EU-FR', 'FR', NULL, 0.2000, 'vat'),
('UK VAT', 'EU-GB', 'GB', NULL, 0.2000, 'vat')
ON CONFLICT (code) DO NOTHING;

-- Insert default invoice template
INSERT INTO invoice_templates (name, description, template_type, html_content, css_styles, is_default, created_by) VALUES
('Standard Healthcare Invoice', 'Default template for healthcare service invoices', 'standard', 
'<div class="invoice-container">
  <header class="invoice-header">
    <div class="logo-section">
      <img src="{{logo_url}}" alt="Healthcare Provider Logo" class="logo">
    </div>
    <div class="invoice-info">
      <h1>INVOICE</h1>
      <p><strong>Invoice #:</strong> {{invoice_number}}</p>
      <p><strong>Date:</strong> {{issue_date}}</p>
      <p><strong>Due Date:</strong> {{due_date}}</p>
    </div>
  </header>
  
  <section class="billing-info">
    <div class="bill-to">
      <h2>Bill To:</h2>
      <p>{{patient_name}}</p>
      <p>{{patient_address}}</p>
      <p>{{patient_city}}, {{patient_state}} {{patient_zip}}</p>
      <p>{{patient_phone}}</p>
    </div>
    <div class="provider-info">
      <h2>Provider:</h2>
      <p>{{provider_name}}</p>
      <p>{{provider_address}}</p>
      <p>{{provider_city}}, {{provider_state}} {{provider_zip}}</p>
      <p>{{provider_phone}}</p>
    </div>
  </section>
  
  <section class="line-items">
    <table class="items-table">
      <thead>
        <tr>
          <th>Description</th>
          <th>Quantity</th>
          <th>Unit Price</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {{#each line_items}}
        <tr>
          <td>{{description}}</td>
          <td>{{quantity}}</td>
          <td>${{unit_price}}</td>
          <td>${{line_total}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>
  </section>
  
  <section class="totals">
    <div class="totals-section">
      <p><strong>Subtotal:</strong> ${{subtotal}}</p>
      <p><strong>Tax:</strong> ${{tax_amount}}</p>
      <p><strong>Total:</strong> ${{total_amount}}</p>
    </div>
  </section>
  
  <footer class="invoice-footer">
    <p>{{footer_text}}</p>
    <p>Thank you for your business!</p>
  </footer>
</div>',
'body { font-family: Arial, sans-serif; margin: 0; padding: 20px; }
.invoice-container { max-width: 800px; margin: 0 auto; }
.invoice-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #333; padding-bottom: 20px; }
.logo { max-height: 60px; }
.invoice-info { text-align: right; }
.billing-info { display: flex; justify-content: space-between; margin: 30px 0; }
.items-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
.items-table th, .items-table td { border: 1px solid #ddd; padding: 12px; text-align: left; }
.items-table th { background-color: #f5f5f5; }
.totals { text-align: right; margin: 20px 0; }
.invoice-footer { text-align: center; margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; }',
true, 1)
ON CONFLICT DO NOTHING;
