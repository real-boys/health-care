-- HL7/FHIR Integration Schema
-- Migration for integration configurations and sync status tracking

-- Integration Configurations Table
CREATE TABLE IF NOT EXISTS integration_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) CHECK (type IN ('HL7', 'FHIR', 'CUSTOM')) NOT NULL,
    description TEXT,
    connection_config JSONB NOT NULL DEFAULT '{}',
    mapping_config JSONB NOT NULL DEFAULT '{}',
    is_active BOOLEAN DEFAULT true,
    sync_frequency VARCHAR(50) CHECK (sync_frequency IN ('REAL_TIME', 'HOURLY', 'DAILY', 'WEEKLY')) DEFAULT 'DAILY',
    last_sync TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Sync Status Table
CREATE TABLE IF NOT EXISTS sync_status (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    integration_id UUID NOT NULL REFERENCES integration_configs(id) ON DELETE CASCADE,
    status VARCHAR(50) CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'CANCELLED')) DEFAULT 'PENDING',
    message_type VARCHAR(100) NOT NULL,
    source_system VARCHAR(255) NOT NULL,
    target_system VARCHAR(255) NOT NULL,
    record_count INTEGER DEFAULT 0,
    processed_count INTEGER DEFAULT 0,
    error_count INTEGER DEFAULT 0,
    error_message TEXT,
    start_time TIMESTAMP NOT NULL DEFAULT NOW(),
    end_time TIMESTAMP,
    duration INTEGER, -- in milliseconds
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_integration_configs_type ON integration_configs(type);
CREATE INDEX IF NOT EXISTS idx_integration_configs_active ON integration_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_sync_status_integration_id ON sync_status(integration_id);
CREATE INDEX IF NOT EXISTS idx_sync_status_status ON sync_status(status);
CREATE INDEX IF NOT EXISTS idx_sync_status_start_time ON sync_status(start_time);

-- Create trigger for updating updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_integration_configs_updated_at BEFORE UPDATE ON integration_configs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sync_status_updated_at BEFORE UPDATE ON sync_status
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Insert sample data for demonstration
INSERT INTO integration_configs (name, type, description, connection_config, mapping_config, sync_frequency) VALUES
(
    'Epic Systems HL7 Interface',
    'HL7',
    'Primary HL7 interface for Epic EMR system',
    '{"host": "epic.hospital.local", "port": 2575, "protocol": "MLLP", "timeout": 30000}',
    '{"patient": {"PID.5": "name", "PID.7": "birthDate", "PID.8": "gender"}}',
    'REAL_TIME'
),
(
    'FHIR Server Integration',
    'FHIR',
    'FHIR R4 server for clinical data exchange',
    '{"baseUrl": "https://fhir.hospital.local/r4", "authType": "Bearer", "timeout": 15000}',
    '{"patient": {"identifier": "id", "name": "name", "birthDate": "birthDate"}}',
    'HOURLY'
),
(
    'Lab System Interface',
    'CUSTOM',
    'Custom interface for laboratory information system',
    '{"apiEndpoint": "https://lab.hospital.local/api", "apiKey": "***", "format": "JSON"}',
    '{"observation": {"testCode": "code", "result": "value", "units": "unit"}}',
    'DAILY'
) ON CONFLICT DO NOTHING;

-- Create view for active integrations with latest sync status
CREATE OR REPLACE VIEW active_integrations_status AS
SELECT 
    ic.id,
    ic.name,
    ic.type,
    ic.is_active,
    ic.sync_frequency,
    ic.last_sync,
    ss.status as latest_sync_status,
    ss.start_time as latest_sync_start,
    ss.end_time as latest_sync_end,
    ss.processed_count,
    ss.error_count,
    CASE 
        WHEN ss.end_time IS NOT NULL THEN ss.end_time - ss.start_time
        ELSE NULL
    END as latest_sync_duration
FROM integration_configs ic
LEFT JOIN LATERAL (
    SELECT * FROM sync_status 
    WHERE integration_id = ic.id 
    ORDER BY start_time DESC 
    LIMIT 1
) ss ON true
WHERE ic.is_active = true;

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON integration_configs TO healthcare_app;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON sync_status TO healthcare_app;
-- GRANT SELECT ON active_integrations_status TO healthcare_app;
