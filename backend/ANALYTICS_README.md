# Healthcare Analytics System

This comprehensive analytics system provides advanced insights for claims, payments, provider performance, and patient outcomes. The system includes data warehouse integration, machine learning predictions, and automated report generation.

## Features

### 📊 Core Analytics Capabilities

- **Claims Analytics**: Processing times, approval rates, cost analysis, denial patterns
- **Payments Analytics**: Revenue trends, payment processing, success rates, method analysis
- **Provider Performance**: Efficiency metrics, quality scores, patient satisfaction, revenue generation
- **Patient Outcomes**: Treatment effectiveness, readmission rates, compliance tracking, quality of life metrics

### 🔧 Technical Components

- **Data Warehouse Integration**: Support for BigQuery and Snowflake
- **ETL Pipelines**: Automated data aggregation and transformation
- **Machine Learning**: Predictive analytics for various healthcare scenarios
- **Report Generation**: PDF and Excel export capabilities
- **Performance Optimization**: Caching, indexing, and query optimization

## Architecture

### Database Schema

The analytics system extends the existing healthcare database with specialized tables:

#### Analytics Fact Tables
- `claims_analytics` - Enhanced claims data with analytical features
- `payments_analytics` - Payment data with categorization and metrics
- `provider_performance_analytics` - Provider performance metrics
- `patient_outcomes_analytics` - Patient outcome tracking

#### Summary Tables
- `monthly_claims_summary` - Aggregated monthly claims metrics
- `monthly_payments_summary` - Monthly payment summaries
- `provider_performance_summary` - Monthly provider performance
- `patient_outcomes_summary` - Monthly patient outcome summaries

#### System Tables
- `analytics_config` - Configuration parameters
- `etl_log` - ETL process logging
- `ml_predictions` - Machine learning predictions storage

## API Endpoints

### Analytics Overview
```
GET /api/analytics/dashboard/overview
```
Returns comprehensive dashboard metrics for the specified time range.

### Claims Analytics
```
GET /api/analytics/claims/summary
GET /api/analytics/claims/processing-times
```
Provides detailed claims analysis including approval rates and processing metrics.

### Payments Analytics
```
GET /api/analytics/payments/trends
```
Analyzes payment patterns, success rates, and revenue trends.

### Provider Performance
```
GET /api/analytics/providers/performance
```
Evaluates provider efficiency, quality metrics, and patient satisfaction.

### Patient Outcomes
```
GET /api/analytics/patients/outcomes
```
Tracks treatment effectiveness and patient health outcomes.

### ETL Operations
```
POST /api/analytics/etl/trigger
```
Triggers ETL processes for data aggregation.

### Report Generation
```
POST /api/analytics/reports/generate
```
Generates PDF or Excel reports with analytics data.

### Machine Learning Predictions
```
GET /api/analytics/ml/predictions/:type
```
Returns ML predictions for various scenarios:
- `claim_approval` - Predicts claim approval probability
- `patient_readmission` - Predicts readmission risk
- `revenue_forecast` - Forecasts revenue trends
- `provider_performance` - Predicts provider performance
- `patient_outcomes` - Predicts treatment outcomes

### Data Warehouse Integration
```
POST /api/analytics/warehouse/sync
GET /api/analytics/warehouse/query/:queryType
```
Manages data warehouse synchronization and queries.

## Configuration

### Environment Variables

Copy `.env.analytics` to `.env` and configure the following:

#### Data Warehouse Configuration
```bash
DATA_WAREHOUSE_TYPE=bigquery  # or 'snowflake'
DATA_WAREHOUSE_SYNC=true
```

#### Google Cloud BigQuery
```bash
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./config/google-cloud-key.json
```

#### Snowflake (Alternative)
```bash
SNOWFLAKE_ACCOUNT=your-account.snowflakecomputing.com
SNOWFLAKE_USERNAME=your-username
SNOWFLAKE_PASSWORD=your-password
SNOWFLAKE_WAREHOUSE=ANALYTICS_WH
```

#### Performance Settings
```bash
ANALYTICS_CACHE_TTL=3600
ANALYTICS_QUERY_TIMEOUT=60000
ETL_BATCH_SIZE=1000
```

## Setup Instructions

### 1. Install Dependencies
```bash
npm install @google-cloud/bigquery snowflake-sdk exceljs pdfkit moment-timezone lodash
```

### 2. Database Initialization
The analytics tables are automatically created when the server starts. The database schema includes all necessary indexes for optimal performance.

### 3. Configure Data Warehouse
Set up your data warehouse credentials in the environment variables and create the necessary datasets/schemas.

### 4. Run Initial ETL
Trigger a full sync to populate analytics tables:
```bash
curl -X POST http://localhost:5000/api/analytics/etl/trigger \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"etlType": "full_sync"}'
```

## Usage Examples

### Getting Dashboard Overview
```javascript
const response = await fetch('/api/analytics/dashboard/overview?timeRange=30', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const overview = await response.json();
```

### Generating Claims Report
```javascript
const response = await fetch('/api/analytics/reports/generate', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Authorization': 'Bearer ' + token 
  },
  body: JSON.stringify({
    reportType: 'claims_summary',
    parameters: { startDate: '2024-01-01', endDate: '2024-12-31' },
    format: 'pdf'
  })
});
```

### Getting ML Predictions
```javascript
const response = await fetch('/api/analytics/ml/predictions/claim_approval?entityId=123', {
  headers: { 'Authorization': 'Bearer ' + token }
});
const predictions = await response.json();
```

## Machine Learning Models

### Available Models

1. **Claim Approval Prediction**
   - Predicts probability of claim approval
   - Identifies risk factors
   - Provides recommendations

2. **Patient Readmission Risk**
   - Calculates readmission probability
   - Identifies high-risk patients
   - Suggests interventions

3. **Revenue Forecasting**
   - Time series forecasting
   - Seasonality detection
   - Trend analysis

4. **Provider Performance**
   - Performance scoring
   - Efficiency metrics
   - Improvement recommendations

5. **Patient Outcomes**
   - Treatment effectiveness prediction
   - Recovery time estimation
   - Complication risk assessment

### Model Features

Each model uses a comprehensive set of features:
- Historical performance data
- Patient demographics
- Treatment patterns
- Financial metrics
- Temporal patterns

## Performance Optimization

### Caching Strategy
- Analytics results cached for 1 hour by default
- Configurable cache TTL
- Intelligent cache invalidation

### Query Optimization
- Indexed queries for fast data retrieval
- Query result limiting for large datasets
- Asynchronous processing for complex operations

### Data Processing
- Batch processing for ETL operations
- Incremental updates for efficiency
- Parallel processing where possible

## Monitoring and Maintenance

### ETL Monitoring
- Automatic logging of all ETL processes
- Error tracking and alerting
- Performance metrics collection

### Data Quality
- Validation checks during ETL
- Anomaly detection
- Data consistency verification

### System Health
- Query performance monitoring
- Resource usage tracking
- Automated alerting for issues

## Security

### Access Control
- Role-based access to analytics endpoints
- Admin and provider roles only
- Token-based authentication

### Data Privacy
- HIPAA compliance considerations
- Data anonymization where appropriate
- Secure data transmission

## Troubleshooting

### Common Issues

1. **ETL Failures**
   - Check database connectivity
   - Verify data warehouse credentials
   - Review ETL logs

2. **Slow Queries**
   - Verify indexes are created
   - Check cache configuration
   - Monitor query performance

3. **ML Prediction Errors**
   - Ensure sufficient historical data
   - Check feature availability
   - Verify model configuration

### Logging
All analytics operations are logged:
- ETL process logs in `etl_log` table
- Application logs in console
- Error tracking with detailed messages

## Future Enhancements

### Planned Features
- Real-time analytics dashboard
- Advanced ML models
- Custom report builder
- Automated alerting system
- Integration with external data sources

### Scalability
- Horizontal scaling support
- Distributed processing
- Cloud-native deployment options
- Advanced caching strategies

## Support

For questions or issues with the analytics system:
1. Check the logs for detailed error messages
2. Verify configuration settings
3. Review the API documentation
4. Contact the development team

## License

This analytics system is part of the healthcare platform and follows the same licensing terms.
