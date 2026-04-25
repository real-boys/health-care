-- User Rate Limiting Schema
-- Tables for tiered access and quota management

-- User subscription tiers
CREATE TABLE IF NOT EXISTS user_tiers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL CHECK (name IN ('free', 'basic', 'premium', 'enterprise')),
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_api_calls INTEGER NOT NULL DEFAULT 100,
  daily_api_calls INTEGER NOT NULL DEFAULT 50,
  hourly_api_calls INTEGER NOT NULL DEFAULT 10,
  minute_api_calls INTEGER NOT NULL DEFAULT 2,
  priority_support BOOLEAN DEFAULT FALSE,
  concurrent_requests INTEGER NOT NULL DEFAULT 1,
  features TEXT, -- JSON array of features
  price DECIMAL(10,2) DEFAULT 0.00,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User subscription mappings
CREATE TABLE IF NOT EXISTS user_subscriptions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  tier_id INTEGER NOT NULL,
  start_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  end_date DATETIME, -- NULL for lifetime subscriptions
  is_active BOOLEAN DEFAULT TRUE,
  auto_renew BOOLEAN DEFAULT FALSE,
  payment_method TEXT,
  subscription_id TEXT, -- External payment processor ID
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (tier_id) REFERENCES user_tiers (id),
  UNIQUE(user_id, tier_id)
);

-- API usage tracking
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start DATETIME NOT NULL,
  window_type TEXT NOT NULL CHECK (window_type IN ('minute', 'hour', 'day', 'month')),
  ip_address TEXT,
  user_agent TEXT,
  response_status INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Rate limit violations
CREATE TABLE IF NOT EXISTS rate_limit_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  window_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  actual_count INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  blocked_until DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
);

-- Quota management
CREATE TABLE IF NOT EXISTS user_quotas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  quota_type TEXT NOT NULL CHECK (quota_type IN ('monthly', 'daily', 'hourly', 'minute')),
  current_usage INTEGER DEFAULT 0,
  max_allowed INTEGER NOT NULL,
  reset_date DATETIME NOT NULL,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  UNIQUE(user_id, quota_type)
);

-- Rate limit overrides for specific users
CREATE TABLE IF NOT EXISTS rate_limit_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  endpoint TEXT, -- NULL for global override
  multiplier DECIMAL(3,2) DEFAULT 1.0, -- Multiply tier limits by this value
  custom_limits TEXT, -- JSON object with custom limits
  is_active BOOLEAN DEFAULT TRUE,
  expires_at DATETIME,
  created_by INTEGER, -- Admin user who created this override
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users (id)
);

-- Insert default tiers
INSERT OR IGNORE INTO user_tiers (name, display_name, description, monthly_api_calls, daily_api_calls, hourly_api_calls, minute_api_calls, priority_support, concurrent_requests, features, price) VALUES
('free', 'Free Tier', 'Basic access with limited API calls', 1000, 100, 20, 5, FALSE, 1, '["basic_endpoints", "standard_support"]', 0.00),
('basic', 'Basic Tier', 'Increased limits for regular users', 5000, 500, 100, 20, FALSE, 2, '["all_endpoints", "email_support", "extended_history"]', 9.99),
('premium', 'Premium Tier', 'High limits for power users', 20000, 2000, 400, 80, TRUE, 5, '["all_endpoints", "priority_support", "advanced_analytics", "webhooks"]', 29.99),
('enterprise', 'Enterprise Tier', 'Unlimited access for organizations', 100000, 10000, 2000, 400, TRUE, 20, '["all_endpoints", "dedicated_support", "custom_integrations", "sla_guarantee", "white_label"]', 99.99);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_user_subscriptions_active ON user_subscriptions(is_active, end_date);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_user_window ON api_usage_logs(user_id, window_type, window_start);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_endpoint ON api_usage_logs(endpoint, method);
CREATE INDEX IF NOT EXISTS idx_rate_limit_violations_user ON rate_limit_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_user_quotas_user_type ON user_quotas(user_id, quota_type);
CREATE INDEX IF NOT EXISTS idx_rate_limit_overrides_user ON rate_limit_overrides(user_id, is_active);
