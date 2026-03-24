/**
 * Database schema for automated claim processing
 */

const createClaimProcessingTables = `
-- Pipeline tracking table
CREATE TABLE IF NOT EXISTS claim_processing_pipelines (
  id TEXT PRIMARY KEY,
  claim_id INTEGER NOT NULL,
  patient_id INTEGER NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('running', 'completed', 'error', 'cancelled')),
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration INTEGER,
  final_decision TEXT,
  final_reason TEXT,
  options TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES insurance_claims(id),
  FOREIGN KEY (patient_id) REFERENCES patients(id)
);

-- Pipeline stage tracking table
CREATE TABLE IF NOT EXISTS pipeline_stages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pipeline_id TEXT NOT NULL,
  stage_name TEXT NOT NULL,
  start_time DATETIME NOT NULL,
  end_time DATETIME,
  duration INTEGER,
  success BOOLEAN NOT NULL,
  error_message TEXT,
  stage_data TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (pipeline_id) REFERENCES claim_processing_pipelines(id)
);

-- Rule engine results table
CREATE TABLE IF NOT EXISTS rule_engine_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL,
  pipeline_id TEXT,
  rule_name TEXT NOT NULL,
  rule_result TEXT NOT NULL,
  is_valid BOOLEAN NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high')),
  message TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES insurance_claims(id),
  FOREIGN KEY (pipeline_id) REFERENCES claim_processing_pipelines(id)
);

-- Fraud detection results table
CREATE TABLE IF NOT EXISTS fraud_detection_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL,
  pipeline_id TEXT,
  risk_score REAL NOT NULL,
  risk_level TEXT NOT NULL CHECK (risk_level IN ('very_low', 'low', 'medium', 'high', 'very_high')),
  requires_review BOOLEAN NOT NULL,
  indicators TEXT,
  features TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES insurance_claims(id),
  FOREIGN KEY (pipeline_id) REFERENCES claim_processing_pipelines(id)
);

-- OCR processing results table
CREATE TABLE IF NOT EXISTS ocr_processing_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  document_id TEXT NOT NULL,
  claim_id INTEGER,
  pipeline_id TEXT,
  document_type TEXT NOT NULL,
  extracted_text TEXT,
  structured_data TEXT,
  confidence_score REAL,
  validation_result TEXT,
  processing_time INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES insurance_claims(id),
  FOREIGN KEY (pipeline_id) REFERENCES claim_processing_pipelines(id)
);

-- External verification results table
CREATE TABLE IF NOT EXISTS verification_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL,
  pipeline_id TEXT,
  verification_type TEXT NOT NULL CHECK (verification_type IN ('eligibility', 'provider', 'authorization')),
  is_valid BOOLEAN NOT NULL,
  verification_data TEXT,
  issues TEXT,
  provider_name TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (claim_id) REFERENCES insurance_claims(id),
  FOREIGN KEY (pipeline_id) REFERENCES claim_processing_pipelines(id)
);

-- Performance metrics table
CREATE TABLE IF NOT EXISTS performance_metrics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  metric_type TEXT NOT NULL CHECK (metric_type IN ('pipeline', 'stage', 'rule', 'fraud', 'ocr', 'verification')),
  metric_name TEXT NOT NULL,
  metric_value REAL NOT NULL,
  metric_unit TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
  additional_data TEXT
);

-- Alerts table
CREATE TABLE IF NOT EXISTS system_alerts (
  id TEXT PRIMARY KEY,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  title TEXT NOT NULL,
  alert_data TEXT,
  is_resolved BOOLEAN DEFAULT FALSE,
  resolved_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Claim processing queue table
CREATE TABLE IF NOT EXISTS processing_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  claim_id INTEGER NOT NULL,
  priority INTEGER DEFAULT 1,
  status TEXT NOT NULL CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
  queued_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  started_at DATETIME,
  completed_at DATETIME,
  error_message TEXT,
  retry_count INTEGER DEFAULT 0,
  max_retries INTEGER DEFAULT 3,
  FOREIGN KEY (claim_id) REFERENCES insurance_claims(id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipelines_claim_id ON claim_processing_pipelines(claim_id);
CREATE INDEX IF NOT EXISTS idx_pipelines_status ON claim_processing_pipelines(status);
CREATE INDEX IF NOT EXISTS idx_pipelines_start_time ON claim_processing_pipelines(start_time);
CREATE INDEX IF NOT EXISTS idx_stages_pipeline_id ON pipeline_stages(pipeline_id);
CREATE INDEX IF NOT EXISTS idx_stages_name ON pipeline_stages(stage_name);
CREATE INDEX IF NOT EXISTS idx_rule_results_claim_id ON rule_engine_results(claim_id);
CREATE INDEX IF NOT EXISTS idx_fraud_results_claim_id ON fraud_detection_results(claim_id);
CREATE INDEX IF NOT EXISTS idx_fraud_risk_score ON fraud_detection_results(risk_score);
CREATE INDEX IF NOT EXISTS idx_ocr_results_claim_id ON ocr_processing_results(claim_id);
CREATE INDEX IF NOT EXISTS idx_verification_results_claim_id ON verification_results(claim_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON performance_metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_alerts_severity ON system_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_alerts_created_at ON system_alerts(created_at);
CREATE INDEX IF NOT EXISTS idx_queue_status ON processing_queue(status);
CREATE INDEX IF NOT EXISTS idx_queue_priority ON processing_queue(priority);
CREATE INDEX IF NOT EXISTS idx_queue_queued_at ON processing_queue(queued_at);
`;

const createClaimProcessingViews = `
-- Pipeline performance view
CREATE VIEW IF NOT EXISTS pipeline_performance AS
SELECT 
  p.id,
  p.claim_id,
  p.status,
  p.duration,
  p.final_decision,
  COUNT(s.id) as stage_count,
  COUNT(CASE WHEN s.success = FALSE THEN 1 END) as failed_stages,
  p.start_time,
  p.created_at
FROM claim_processing_pipelines p
LEFT JOIN pipeline_stages s ON p.id = s.pipeline_id
GROUP BY p.id;

-- Daily processing summary view
CREATE VIEW IF NOT EXISTS daily_processing_summary AS
SELECT 
  DATE(p.start_time) as processing_date,
  COUNT(*) as total_pipelines,
  COUNT(CASE WHEN p.status = 'completed' THEN 1 END) as completed_pipelines,
  COUNT(CASE WHEN p.status = 'error' THEN 1 END) as failed_pipelines,
  AVG(p.duration) as avg_duration,
  MAX(p.duration) as max_duration,
  MIN(p.duration) as min_duration
FROM claim_processing_pipelines p
GROUP BY DATE(p.start_time);

-- Fraud risk summary view
CREATE VIEW IF NOT EXISTS fraud_risk_summary AS
SELECT 
  DATE(f.created_at) as analysis_date,
  COUNT(*) as total_analyses,
  COUNT(CASE WHEN f.requires_review = TRUE THEN 1 END) as requires_review,
  AVG(f.risk_score) as avg_risk_score,
  COUNT(CASE WHEN f.risk_level = 'high' THEN 1 END) as high_risk_count,
  COUNT(CASE WHEN f.risk_level = 'very_high' THEN 1 END) as very_high_risk_count
FROM fraud_detection_results f
GROUP BY DATE(f.created_at);

-- Rule effectiveness view
CREATE VIEW IF NOT EXISTS rule_effectiveness AS
SELECT 
  r.rule_name,
  COUNT(*) as total_executions,
  COUNT(CASE WHEN r.is_valid = TRUE THEN 1 END) as passed_count,
  COUNT(CASE WHEN r.is_valid = FALSE THEN 1 END) as failed_count,
  COUNT(CASE WHEN r.severity = 'high' THEN 1 END) as high_severity_count,
  AVG(CASE WHEN r.is_valid = FALSE THEN 1 ELSE 0 END) as failure_rate
FROM rule_engine_results r
GROUP BY r.rule_name;
`;

module.exports = {
  createClaimProcessingTables,
  createClaimProcessingViews
};
