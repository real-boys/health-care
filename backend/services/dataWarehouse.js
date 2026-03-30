const { BigQuery } = require('@google-cloud/bigquery');
const snowflake = require('snowflake-sdk');
const path = require('path');
const fs = require('fs');

class DataWarehouseService {
    constructor() {
        this.bigquery = null;
        this.snowflakeConnection = null;
        this.warehouseType = process.env.DATA_WAREHOUSE_TYPE || 'bigquery';
        this.initializeConnection();
    }

    initializeConnection() {
        try {
            if (this.warehouseType === 'bigquery') {
                const keyPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || 
                    path.join(__dirname, '../config/google-cloud-key.json');
                
                if (fs.existsSync(keyPath)) {
                    this.bigquery = new BigQuery({
                        keyFilename: keyPath,
                        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
                    });
                } else {
                    this.bigquery = new BigQuery({
                        projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
                    });
                }
                console.log('BigQuery connection initialized');
            } else if (this.warehouseType === 'snowflake') {
                this.snowflakeConnection = snowflake.createConnection({
                    account: process.env.SNOWFLAKE_ACCOUNT,
                    username: process.env.SNOWFLAKE_USERNAME,
                    password: process.env.SNOWFLAKE_PASSWORD,
                    warehouse: process.env.SNOWFLAKE_WAREHOUSE,
                    database: process.env.SNOWFLAKE_DATABASE,
                    schema: process.env.SNOWFLAKE_SCHEMA || 'ANALYTICS'
                });
                
                this.snowflakeConnection.connect((err, conn) => {
                    if (err) {
                        console.error('Snowflake connection error:', err);
                    } else {
                        console.log('Snowflake connection established');
                    }
                });
            }
        } catch (error) {
            console.error('Data warehouse connection error:', error);
        }
    }

    async executeQuery(query, parameters = []) {
        try {
            if (this.warehouseType === 'bigquery') {
                const options = {
                    query: query,
                    location: 'US'
                };
                
                if (parameters.length > 0) {
                    options.params = parameters;
                }
                
                const [job] = await this.bigquery.createQueryJob(options);
                const [rows] = await job.getQueryResults();
                return rows;
            } else if (this.warehouseType === 'snowflake') {
                return new Promise((resolve, reject) => {
                    this.snowflakeConnection.execute({
                        sqlText: query,
                        binds: parameters,
                        complete: (err, stmt, rows) => {
                            if (err) {
                                reject(err);
                            } else {
                                resolve(rows);
                            }
                        }
                    });
                });
            }
        } catch (error) {
            console.error('Query execution error:', error);
            throw error;
        }
    }

    async insertData(tableName, data) {
        const columns = Object.keys(data[0]).join(', ');
        const values = data.map(row => 
            Object.values(row).map(val => 
                typeof val === 'string' ? `'${val.replace(/'/g, "''")}'` : val
            ).join(', ')
        ).join('), (');

        const query = `INSERT INTO ${tableName} (${columns}) VALUES (${values})`;
        return this.executeQuery(query);
    }

    async createTable(schema) {
        try {
            if (this.warehouseType === 'bigquery') {
                const [table] = await this.bigquery.dataset(schema.dataset)
                    .table(schema.tableName)
                    .create(schema.options);
                console.log(`BigQuery table ${schema.tableName} created`);
                return table;
            } else if (this.warehouseType === 'snowflake') {
                const query = this.buildSnowflakeCreateTableSQL(schema);
                await this.executeQuery(query);
                console.log(`Snowflake table ${schema.tableName} created`);
            }
        } catch (error) {
            console.error('Table creation error:', error);
            throw error;
        }
    }

    buildSnowflakeCreateTableSQL(schema) {
        let sql = `CREATE OR REPLACE TABLE ${schema.tableName} (`;
        const columns = schema.options.schema.map(field => {
            let columnDef = `${field.name} ${field.type}`;
            if (field.mode === 'REQUIRED') {
                columnDef += ' NOT NULL';
            }
            return columnDef;
        });
        sql += columns.join(', ');
        sql += ')';
        return sql;
    }

    async syncAnalyticsData(dataType, data) {
        try {
            const tableName = this.getTableName(dataType);
            await this.insertData(tableName, data);
            console.log(`Synced ${data.length} records to ${tableName}`);
            return { success: true, recordsSynced: data.length };
        } catch (error) {
            console.error('Data sync error:', error);
            throw error;
        }
    }

    getTableName(dataType) {
        const tableMapping = {
            'claims': 'claims_analytics',
            'payments': 'payments_analytics',
            'provider_performance': 'provider_performance_analytics',
            'patient_outcomes': 'patient_outcomes_analytics',
            'monthly_claims': 'monthly_claims_summary',
            'monthly_payments': 'monthly_payments_summary',
            'provider_summary': 'provider_performance_summary',
            'patient_summary': 'patient_outcomes_summary'
        };
        return tableMapping[dataType] || dataType;
    }

    async getAnalyticsData(queryType, parameters = {}) {
        const queries = {
            'claims_summary': this.getClaimsSummaryQuery(),
            'payments_trends': this.getPaymentsTrendsQuery(),
            'provider_performance': this.getProviderPerformanceQuery(),
            'patient_outcomes': this.getPatientOutcomesQuery(),
            'cost_analysis': this.getCostAnalysisQuery(),
            'revenue_forecast': this.getRevenueForecastQuery()
        };

        const query = queries[queryType];
        if (!query) {
            throw new Error(`Unknown query type: ${queryType}`);
        }

        return this.executeQuery(query, Object.values(parameters));
    }

    getClaimsSummaryQuery() {
        return `
            SELECT 
                DATE_TRUNC(service_date, MONTH) as month,
                COUNT(*) as total_claims,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_claims,
                SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) as denied_claims,
                SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) as paid_claims,
                SUM(total_amount) as total_amount,
                SUM(insurance_amount) as total_insurance_amount,
                AVG(processing_days) as avg_processing_days,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as approval_rate
            FROM claims_analytics
            WHERE service_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_TRUNC(service_date, MONTH)
            ORDER BY month DESC
        `;
    }

    getPaymentsTrendsQuery() {
        return `
            SELECT 
                DATE_TRUNC(payment_date, MONTH) as month,
                COUNT(*) as total_payments,
                SUM(payment_amount) as total_amount,
                AVG(payment_amount) as avg_payment_amount,
                SUM(CASE WHEN payment_status = 'completed' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as success_rate
            FROM payments_analytics
            WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
            GROUP BY DATE_TRUNC(payment_date, MONTH)
            ORDER BY month DESC
        `;
    }

    getProviderPerformanceQuery() {
        return `
            SELECT 
                provider_id,
                COUNT(DISTINCT patient_id) as total_patients,
                COUNT(*) as total_services,
                AVG(patient_satisfaction_score) as avg_satisfaction,
                AVG(clinical_outcome_score) as avg_clinical_outcome,
                AVG(cost_efficiency_score) as avg_cost_efficiency,
                AVG(quality_metric_score) as avg_quality_score
            FROM provider_performance_analytics
            WHERE date_of_service >= DATE_SUB(CURRENT_DATE(), INTERVAL 6 MONTH)
            GROUP BY provider_id
            ORDER BY avg_quality_score DESC
            LIMIT 50
        `;
    }

    getPatientOutcomesQuery() {
        return `
            SELECT 
                condition_category,
                COUNT(*) as total_cases,
                AVG(treatment_effectiveness_score) as avg_effectiveness,
                AVG(recovery_time_days) as avg_recovery_time,
                SUM(CASE WHEN readmission_within_30_days = TRUE THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as readmission_rate_30d,
                AVG(patient_compliance_score) as avg_compliance
            FROM patient_outcomes_analytics
            WHERE service_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
            GROUP BY condition_category
            ORDER BY avg_effectiveness DESC
        `;
    }

    getCostAnalysisQuery() {
        return `
            SELECT 
                procedure_category,
                COUNT(*) as procedure_count,
                AVG(total_amount) as avg_cost,
                SUM(total_amount) as total_cost,
                AVG(processing_days) as avg_processing_time,
                SUM(CASE WHEN status = 'denied' THEN 1 ELSE 0 END) * 100.0 / COUNT(*) as denial_rate
            FROM claims_analytics
            WHERE service_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 12 MONTH)
            GROUP BY procedure_category
            ORDER BY total_cost DESC
        `;
    }

    getRevenueForecastQuery() {
        return `
            SELECT 
                DATE_TRUNC(payment_date, MONTH) as month,
                SUM(payment_amount) as revenue,
                AVG(payment_amount) as avg_payment,
                COUNT(*) as payment_count
            FROM payments_analytics
            WHERE payment_date >= DATE_SUB(CURRENT_DATE(), INTERVAL 18 MONTH)
            GROUP BY DATE_TRUNC(payment_date, MONTH)
            ORDER BY month ASC
        `;
    }

    async closeConnection() {
        try {
            if (this.snowflakeConnection) {
                await new Promise((resolve, reject) => {
                    this.snowflakeConnection.destroy((err) => {
                        if (err) reject(err);
                        else resolve();
                    });
                });
            }
        } catch (error) {
            console.error('Connection close error:', error);
        }
    }
}

module.exports = DataWarehouseService;
