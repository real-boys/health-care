# Automated Claim Processing Engine

## Overview

The Automated Claim Processing Engine is an AI-powered system designed to automatically validate and process insurance claims based on predefined rules. This comprehensive solution integrates multiple advanced technologies to streamline claim processing, reduce manual intervention, and improve accuracy.

## Features

### 🔧 Rule Engine Implementation
- **Custom Rule Engine**: JavaScript-based rule engine with configurable business rules
- **Predefined Rules**: Amount validation, service date validation, required fields validation, diagnosis/procedure code validation
- **Dynamic Rule Management**: Add, remove, and modify rules at runtime
- **Rule Statistics**: Track rule effectiveness and performance

### 🤖 Machine Learning Fraud Detection
- **Multi-Factor Analysis**: Amount anomalies, frequency patterns, provider behavior, diagnosis patterns
- **Risk Scoring**: Configurable risk thresholds with confidence levels
- **Pattern Recognition**: Identifies suspicious claim patterns
- **Batch Processing**: Analyze multiple claims simultaneously

### 🔄 Automated Validation Pipelines
- **Multi-Stage Processing**: Initial validation, document processing, rule evaluation, fraud detection, external verification
- **Pipeline Tracking**: Complete audit trail with detailed stage-by-stage results
- **Error Handling**: Robust error recovery and retry mechanisms
- **Performance Monitoring**: Real-time pipeline performance metrics

### 📄 Document OCR and Data Extraction
- **Multiple OCR Providers**: Tesseract, Google Vision API, Azure OCR
- **Document Type Support**: Medical bills, EOBs, prescriptions, lab results
- **Intelligent Parsing**: Structured data extraction from unstructured documents
- **Confidence Scoring**: Quality assessment of extracted data

### 🔗 External Verification Services
- **Eligibility Verification**: Real-time insurance eligibility checks
- **Provider Verification**: NPPES registry integration and medical board verification
- **Authorization Checks**: Treatment authorization validation
- **Caching System**: Optimized performance with intelligent caching

### 📊 Performance Monitoring and Alerting
- **Real-time Metrics**: Processing times, error rates, queue sizes
- **Multi-Channel Alerts**: Email, webhook, Slack notifications
- **Health Checks**: Continuous service health monitoring
- **Performance Analytics**: Detailed performance reports and trends

## Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Gateway  │────│  Processing      │────│   External      │
│   (Express)    │    │  Pipeline        │    │   Services      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Rule Engine   │    │  Fraud Detection │    │   OCR Service   │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   Monitoring    │    │   Verification   │    │   Database      │
│   Service       │    │   Service        │    │   (SQLite)      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
```

## Installation

### Prerequisites
- Node.js 16+ 
- SQLite 3
- Tesseract OCR (optional, for local OCR processing)

### Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/olaleyeolajide81-sketch/health-care.git
   cd health-care/backend
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Initialize database**
   ```bash
   npm run db:migrate
   ```

5. **Start the server**
   ```bash
   npm start
   ```

## API Endpoints

### Processing Endpoints

#### Process Single Claim
```http
POST /api/automated-claim-processing/process
Content-Type: application/json

{
  "claimId": 123,
  "options": {
    "documents": [...],
    "skipVerification": false
  }
}
```

#### Batch Process Claims
```http
POST /api/automated-claim-processing/batch-process
Content-Type: application/json

{
  "claimIds": [1, 2, 3],
  "options": {
    "parallel": true
  }
}
```

#### Validate Claim
```http
POST /api/automated-claim-processing/validate
Content-Type: application/json

{
  "claim": {
    "patientId": "123",
    "providerName": "General Hospital",
    "serviceDate": "2024-01-15",
    "totalAmount": 500.00,
    "diagnosisCodes": "Z00.00,R06.02",
    "procedureCodes": "99213,36415"
  }
}
```

#### Fraud Analysis
```http
POST /api/automated-claim-processing/fraud-analysis
Content-Type: application/json

{
  "claim": {...},
  "patientHistory": [...]
}
```

### Document Processing

#### OCR Processing
```http
POST /api/automated-claim-processing/ocr-process
Content-Type: multipart/form-data

documents: [files]
documentType: "medical_bill"
metadata: {...}
```

### Verification Endpoints

#### External Verification
```http
POST /api/automated-claim-processing/verify
Content-Type: application/json

{
  "claim": {...},
  "verificationTypes": ["eligibility", "provider", "authorization"]
}
```

### Monitoring Endpoints

#### Get Statistics
```http
GET /api/automated-claim-processing/statistics
```

#### Health Check
```http
GET /api/automated-claim-processing/health
```

#### Get Alerts
```http
GET /api/automated-claim-processing/alerts?limit=50&severity=critical
```

## Configuration

### Environment Variables

```bash
# Database
DB_PATH=./database/healthcare.db

# OCR Services
GOOGLE_VISION_API_KEY=your_google_vision_api_key
AZURE_OCR_API_KEY=your_azure_ocr_api_key
AZURE_OCR_ENDPOINT=https://your-region.api.cognitive.microsoft.com

# Verification Services
BLUECROSS_API_KEY=your_bluecross_api_key
AETNA_API_KEY=your_aetna_api_key
UH_API_KEY=your_uh_api_key
AUTHHUB_API_KEY=your_authhub_api_key

# Alerts
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
ALERT_RECIPIENTS=admin@healthcare.com,ops@healthcare.com

SLACK_WEBHOOK_URL=https://hooks.slack.com/services/...
WEBHOOK_URL=https://your-webhook-endpoint.com
```

### Rule Engine Configuration

The rule engine can be configured with custom rules:

```javascript
// Add a custom rule
const customRule = {
  condition: (claim) => {
    // Your validation logic
    return claim.totalAmount > 1000;
  },
  action: (claim) => {
    return {
      valid: claim.totalAmount <= 5000,
      message: 'High-value claim requires review',
      severity: 'medium'
    };
  }
};

ruleEngine.addRule('high_value_check', customRule);
```

### Fraud Detection Configuration

```javascript
// Update fraud detection thresholds
fraudDetection.updateModelConfig({
  threshold: 0.8,
  features: ['amount_anomaly', 'frequency_anomaly', 'provider_anomaly']
});
```

## Database Schema

The system uses SQLite with the following key tables:

- `claim_processing_pipelines`: Pipeline execution tracking
- `pipeline_stages`: Individual stage results
- `rule_engine_results`: Rule validation results
- `fraud_detection_results`: Fraud analysis results
- `ocr_processing_results`: OCR processing results
- `verification_results`: External verification results
- `performance_metrics`: Performance tracking
- `system_alerts`: Alert history
- `processing_queue`: Claim processing queue

## Performance Optimization

### Caching Strategy
- **External Verification Results**: 5-minute cache
- **Provider Information**: 1-hour cache
- **Rule Engine Results**: Session-based caching

### Batch Processing
- **Parallel Processing**: Multiple claims processed simultaneously
- **Queue Management**: Priority-based claim processing
- **Resource Management**: Memory and CPU optimization

### Monitoring
- **Real-time Metrics**: Processing times, success rates
- **Alert Thresholds**: Configurable performance alerts
- **Health Checks**: Service availability monitoring

## Security

### Data Protection
- **Encryption**: Sensitive data encrypted at rest
- **Access Control**: Role-based API access
- **Audit Trail**: Complete processing audit logs

### API Security
- **Authentication**: JWT token-based authentication
- **Rate Limiting**: API rate limiting to prevent abuse
- **Input Validation**: Comprehensive input sanitization

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### Coverage Report
```bash
npm run test:coverage
```

## Monitoring and Alerting

### Alert Types
- **Critical**: System failures, high error rates
- **Warning**: Performance degradation, queue buildup
- **Info**: Processing milestones, system status

### Alert Channels
- **Email**: Detailed alert notifications
- **Slack**: Real-time team notifications
- **Webhooks**: Integration with external monitoring systems

## Troubleshooting

### Common Issues

1. **OCR Processing Fails**
   - Check Tesseract installation
   - Verify file format support
   - Review API key configuration

2. **External Verification Timeouts**
   - Check API key validity
   - Verify network connectivity
   - Review timeout configuration

3. **High Memory Usage**
   - Monitor batch processing size
   - Check for memory leaks
   - Review caching configuration

### Debug Mode
Enable debug logging:
```bash
DEBUG=automated-claim-processing:* npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Implement your changes
4. Add tests
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Support

For support and questions:
- Create an issue in the GitHub repository
- Contact the development team
- Review the documentation and troubleshooting guide

## Version History

### v2.0.0 (Current)
- Complete automated claim processing engine
- ML-based fraud detection
- OCR document processing
- External verification services
- Performance monitoring and alerting

### v1.0.0
- Basic claim management
- Manual processing workflows
- Simple validation rules
