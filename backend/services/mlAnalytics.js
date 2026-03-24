const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const moment = require('moment');
const _ = require('lodash');

class MLService {
    constructor() {
        this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
        this.models = {
            claimApproval: new ClaimApprovalModel(),
            patientReadmission: new PatientReadmissionModel(),
            revenueForecast: new RevenueForecastModel(),
            providerPerformance: new ProviderPerformanceModel()
        };
    }

    async getPredictions(predictionType, entityId, parameters = {}) {
        try {
            let predictions;
            
            switch (predictionType) {
                case 'claim_approval':
                    predictions = await this.predictClaimApproval(entityId, parameters);
                    break;
                case 'patient_readmission':
                    predictions = await this.predictPatientReadmission(entityId, parameters);
                    break;
                case 'revenue_forecast':
                    predictions = await this.predictRevenueForecast(parameters);
                    break;
                case 'provider_performance':
                    predictions = await this.predictProviderPerformance(entityId, parameters);
                    break;
                case 'patient_outcomes':
                    predictions = await this.predictPatientOutcomes(entityId, parameters);
                    break;
                case 'cost_optimization':
                    predictions = await this.predictCostOptimization(parameters);
                    break;
                default:
                    throw new Error(`Unknown prediction type: ${predictionType}`);
            }
            
            // Store predictions in database
            await this.storePredictions(predictionType, entityId, predictions);
            
            return predictions;
            
        } catch (error) {
            console.error('ML prediction error:', error);
            throw error;
        }
    }

    async predictClaimApproval(claimId, parameters) {
        const db = this.getDatabase();
        
        // Get claim data
        const claimQuery = `
            SELECT 
                ic.*,
                p.insurance_provider,
                p.blood_type,
                p.allergies,
                COUNT(mr.id) as prior_treatments
            FROM insurance_claims ic
            LEFT JOIN patients p ON ic.patient_id = p.id
            LEFT JOIN medical_records mr ON ic.patient_id = mr.patient_id AND mr.date_of_service < ic.service_date
            WHERE ic.id = ?
        `;
        
        const claim = await new Promise((resolve, reject) => {
            db.get(claimQuery, [claimId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!claim) {
            throw new Error('Claim not found');
        }
        
        // Extract features
        const features = {
            claimAmount: parseFloat(claim.total_amount || 0),
            insuranceAmount: parseFloat(claim.insurance_amount || 0),
            patientResponsibility: parseFloat(claim.patient_responsibility || 0),
            hasDiagnosisCodes: claim.diagnosis_codes && claim.diagnosis_codes.length > 0,
            hasProcedureCodes: claim.procedure_codes && claim.procedure_codes.length > 0,
            priorTreatments: claim.prior_treatments || 0,
            insuranceProvider: claim.insurance_provider,
            procedureCount: claim.procedure_codes ? claim.procedure_codes.split(',').length : 0,
            diagnosisCount: claim.diagnosis_codes ? claim.diagnosis_codes.split(',').length : 0,
            daysSinceSubmission: claim.submission_date ? 
                moment().diff(moment(claim.submission_date), 'days') : 0
        };
        
        // Use ML model to predict
        const model = this.models.claimApproval;
        const prediction = await model.predict(features);
        
        return {
            claimId,
            predictionType: 'claim_approval',
            approvalProbability: prediction.probability,
            riskScore: prediction.riskScore,
            recommendation: prediction.recommendation,
            factors: prediction.factors,
            confidence: prediction.confidence,
            features: features,
            generatedAt: new Date().toISOString()
        };
    }

    async predictPatientReadmission(patientId, parameters) {
        const db = this.getDatabase();
        const { timeHorizon = 30 } = parameters;
        
        // Get patient data
        const patientQuery = `
            SELECT 
                p.*,
                COUNT(DISTINCT mr.id) as total_treatments,
                COUNT(DISTINCT a.id) as total_appointments,
                COUNT(DISTINCT ic.id) as total_claims,
                MAX(mr.date_of_service) as last_treatment_date,
                AVG(ic.total_amount) as avg_claim_cost,
                COUNT(CASE WHEN ic.status = 'denied' THEN 1 END) as denied_claims
            FROM patients p
            LEFT JOIN medical_records mr ON p.id = mr.patient_id
            LEFT JOIN appointments a ON p.id = a.patient_id
            LEFT JOIN insurance_claims ic ON p.id = ic.patient_id
            WHERE p.id = ?
            GROUP BY p.id
        `;
        
        const patient = await new Promise((resolve, reject) => {
            db.get(patientQuery, [patientId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!patient) {
            throw new Error('Patient not found');
        }
        
        // Get recent treatments
        const recentTreatmentsQuery = `
            SELECT 
                mr.record_type,
                mr.diagnosis_code,
                mr.treatment_code,
                mr.date_of_service
            FROM medical_records mr
            WHERE mr.patient_id = ?
            AND mr.date_of_service >= DATE('now', '-90 days')
            ORDER BY mr.date_of_service DESC
        `;
        
        const recentTreatments = await new Promise((resolve, reject) => {
            db.all(recentTreatmentsQuery, [patientId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Extract features
        const features = {
            age: patient.date_of_birth ? moment().diff(moment(patient.date_of_birth), 'years') : 0,
            totalTreatments: patient.total_treatments || 0,
            totalAppointments: patient.total_appointments || 0,
            totalClaims: patient.total_claims || 0,
            avgClaimCost: parseFloat(patient.avg_claim_cost || 0),
            deniedClaimsRate: patient.total_claims > 0 ? (patient.denied_claims / patient.total_claims) : 0,
            daysSinceLastTreatment: patient.last_treatment_date ? 
                moment().diff(moment(patient.last_treatment_date), 'days') : 999,
            hasChronicConditions: recentTreatments.filter(t => t.diagnosis_code && 
                (t.diagnosis_code.startsWith('E') || t.diagnosis_code.startsWith('I'))).length > 0,
            recentTreatmentCount: recentTreatments.length,
            hasRecentProcedures: recentTreatments.filter(t => t.record_type === 'procedure').length > 0
        };
        
        const model = this.models.patientReadmission;
        const prediction = await model.predict(features);
        
        return {
            patientId,
            predictionType: 'patient_readmission',
            timeHorizon,
            readmissionProbability: prediction.probability,
            riskLevel: prediction.riskLevel,
            riskFactors: prediction.riskFactors,
            recommendations: prediction.recommendations,
            confidence: prediction.confidence,
            features: features,
            generatedAt: new Date().toISOString()
        };
    }

    async predictRevenueForecast(parameters) {
        const db = this.getDatabase();
        const { months = 12, forecastPeriods = 3 } = parameters;
        
        // Get historical revenue data
        const revenueQuery = `
            SELECT 
                DATE(payment_date, 'start of month') as month,
                SUM(CASE WHEN payment_status = 'completed' THEN payment_amount ELSE 0 END) as revenue,
                COUNT(CASE WHEN payment_status = 'completed' THEN 1 END) as completed_payments,
                COUNT(*) as total_payments,
                AVG(CASE WHEN payment_status = 'completed' THEN payment_amount ELSE NULL END) as avg_payment
            FROM premium_payments
            WHERE payment_date >= DATE('now', '-${months} months')
            GROUP BY DATE(payment_date, 'start of month')
            ORDER BY month ASC
        `;
        
        const historicalData = await new Promise((resolve, reject) => {
            db.all(revenueQuery, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (historicalData.length < 3) {
            throw new Error('Insufficient historical data for forecasting');
        }
        
        // Extract features for time series model
        const features = {
            historicalData: historicalData.map(d => ({
                month: d.month,
                revenue: parseFloat(d.revenue || 0),
                paymentCount: d.completed_payments || 0,
                avgPayment: parseFloat(d.avg_payment || 0)
            })),
            seasonality: this.detectSeasonality(historicalData),
            trend: this.calculateTrend(historicalData),
            volatility: this.calculateVolatility(historicalData)
        };
        
        const model = this.models.revenueForecast;
        const prediction = await model.predict(features);
        
        return {
            predictionType: 'revenue_forecast',
            historicalData: features.historicalData,
            forecast: prediction.forecast,
            confidence: prediction.confidence,
            accuracy: prediction.accuracy,
            trend: features.trend,
            seasonality: features.seasonality,
            recommendations: prediction.recommendations,
            generatedAt: new Date().toISOString()
        };
    }

    async predictProviderPerformance(providerId, parameters) {
        const db = this.getDatabase();
        const { timeRange = 90 } = parameters;
        
        // Get provider data
        const providerQuery = `
            SELECT 
                u.*,
                COUNT(DISTINCT a.patient_id) as total_patients,
                COUNT(a.id) as total_appointments,
                SUM(CASE WHEN a.status = 'completed' THEN 1 ELSE 0 END) as completed_appointments,
                SUM(CASE WHEN a.status = 'cancelled' THEN 1 ELSE 0 END) as cancelled_appointments,
                AVG(a.duration_minutes) as avg_duration,
                COUNT(DISTINCT mr.id) as total_medical_records,
                COALESCE(SUM(ic.total_amount), 0) as total_revenue
            FROM users u
            LEFT JOIN appointments a ON u.id = a.provider_id AND a.appointment_date >= DATE('now', '-${timeRange} days')
            LEFT JOIN medical_records mr ON u.id = mr.provider_id AND mr.date_of_service >= DATE('now', '-${timeRange} days')
            LEFT JOIN insurance_claims ic ON u.first_name || ' ' || u.last_name = ic.provider_name AND ic.service_date >= DATE('now', '-${timeRange} days')
            WHERE u.id = ? AND u.role = 'provider'
            GROUP BY u.id
        `;
        
        const provider = await new Promise((resolve, reject) => {
            db.get(providerQuery, [providerId], (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
        
        if (!provider) {
            throw new Error('Provider not found');
        }
        
        // Extract features
        const features = {
            totalPatients: provider.total_patients || 0,
            totalAppointments: provider.total_appointments || 0,
            completionRate: provider.total_appointments > 0 ? 
                (provider.completed_appointments / provider.total_appointments) : 0,
            cancellationRate: provider.total_appointments > 0 ? 
                (provider.cancelled_appointments / provider.total_appointments) : 0,
            avgDuration: parseFloat(provider.avg_duration || 0),
            medicalRecordRatio: provider.total_patients > 0 ? 
                (provider.total_medical_records / provider.total_patients) : 0,
            revenuePerPatient: provider.total_patients > 0 ? 
                (parseFloat(provider.total_revenue || 0) / provider.total_patients) : 0,
            experience: provider.created_at ? 
                moment().diff(moment(provider.created_at), 'years') : 0
        };
        
        const model = this.models.providerPerformance;
        const prediction = await model.predict(features);
        
        return {
            providerId,
            predictionType: 'provider_performance',
            performanceScore: prediction.score,
            efficiencyScore: prediction.efficiencyScore,
            qualityScore: prediction.qualityScore,
            revenuePotential: prediction.revenuePotential,
            improvementAreas: prediction.improvementAreas,
            strengths: prediction.strengths,
            confidence: prediction.confidence,
            features: features,
            generatedAt: new Date().toISOString()
        };
    }

    async predictPatientOutcomes(patientId, parameters) {
        const db = this.getDatabase();
        const { conditionType, treatmentType } = parameters;
        
        // Get patient medical history
        const historyQuery = `
            SELECT 
                mr.*,
                a.appointment_date,
                a.status as appointment_status
            FROM medical_records mr
            LEFT JOIN appointments a ON mr.patient_id = a.patient_id AND DATE(mr.date_of_service) = DATE(a.appointment_date)
            WHERE mr.patient_id = ?
            ORDER BY mr.date_of_service DESC
            LIMIT 50
        `;
        
        const medicalHistory = await new Promise((resolve, reject) => {
            db.all(historyQuery, [patientId], (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        if (medicalHistory.length === 0) {
            throw new Error('No medical history found for patient');
        }
        
        // Extract features
        const features = {
            totalRecords: medicalHistory.length,
            treatmentTypes: [...new Set(medicalHistory.map(r => r.record_type))],
            diagnosisCodes: [...new Set(medicalHistory.map(r => r.diagnosis_code).filter(Boolean))],
            treatmentCodes: [...new Set(medicalHistory.map(r => r.treatment_code).filter(Boolean))],
            lastTreatmentDate: medicalHistory[0]?.date_of_service,
            treatmentFrequency: this.calculateTreatmentFrequency(medicalHistory),
            hasChronicConditions: this.hasChronicConditions(medicalHistory),
            appointmentCompliance: this.calculateAppointmentCompliance(medicalHistory),
            treatmentComplexity: this.calculateTreatmentComplexity(medicalHistory)
        };
        
        // Simulate ML prediction (in real implementation, this would use actual ML models)
        const prediction = this.simulateOutcomePrediction(features, conditionType, treatmentType);
        
        return {
            patientId,
            predictionType: 'patient_outcomes',
            conditionType,
            treatmentType,
            effectivenessScore: prediction.effectivenessScore,
            recoveryTime: prediction.recoveryTime,
            complicationRisk: prediction.complicationRisk,
            qualityOfLifeImpact: prediction.qualityOfLifeImpact,
            recommendations: prediction.recommendations,
            confidence: prediction.confidence,
            features: features,
            generatedAt: new Date().toISOString()
        };
    }

    async predictCostOptimization(parameters) {
        const db = this.getDatabase();
        const { category, timeRange = 90 } = parameters;
        
        // Get cost data
        const costQuery = `
            SELECT 
                ic.procedure_codes,
                ic.total_amount,
                ic.insurance_amount,
                ic.patient_responsibility,
                ic.status,
                ic.provider_name,
                ic.service_date,
                COUNT(*) as frequency
            FROM insurance_claims ic
            WHERE ic.service_date >= DATE('now', '-${timeRange} days')
            GROUP BY ic.procedure_codes, ic.provider_name
            ORDER BY frequency DESC, total_amount DESC
            LIMIT 100
        `;
        
        const costData = await new Promise((resolve, reject) => {
            db.all(costQuery, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        // Analyze cost patterns
        const analysis = this.analyzeCostPatterns(costData);
        
        return {
            predictionType: 'cost_optimization',
            category,
            costAnalysis: analysis,
            optimizationOpportunities: analysis.opportunities,
            potentialSavings: analysis.potentialSavings,
            recommendations: analysis.recommendations,
            generatedAt: new Date().toISOString()
        };
    }

    async storePredictions(predictionType, entityId, predictions) {
        const db = this.getDatabase();
        
        const insertSQL = `
            INSERT INTO ml_predictions 
            (model_name, model_version, prediction_type, entity_id, entity_type, 
             prediction_value, confidence_score, prediction_date, features_used, actual_value)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        const values = [
            `${predictionType}_model`,
            '1.0',
            predictionType,
            entityId,
            this.getEntityType(predictionType),
            JSON.stringify(predictions).length, // Store as prediction_value
            predictions.confidence || 0.8,
            new Date().toISOString(),
            JSON.stringify(predictions.features || {}),
            null // Actual value to be updated later
        ];
        
        await new Promise((resolve, reject) => {
            db.run(insertSQL, values, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }

    getEntityType(predictionType) {
        const typeMapping = {
            'claim_approval': 'claim',
            'patient_readmission': 'patient',
            'revenue_forecast': 'organization',
            'provider_performance': 'provider',
            'patient_outcomes': 'patient',
            'cost_optimization': 'organization'
        };
        return typeMapping[predictionType] || 'unknown';
    }

    // Helper methods for feature extraction
    detectSeasonality(data) {
        if (data.length < 12) return 'insufficient_data';
        
        const monthlyData = _.groupBy(data, d => moment(d.month).month());
        const monthlyAverages = Object.values(monthlyData).map(monthData => 
            _.meanBy(monthData, 'revenue')
        );
        
        const variance = _.variance(monthlyAverages);
        const mean = _.mean(monthlyAverages);
        const coefficientOfVariation = variance / (mean * mean);
        
        return coefficientOfVariation > 0.1 ? 'seasonal' : 'non_seasonal';
    }

    calculateTrend(data) {
        if (data.length < 2) return 'insufficient_data';
        
        const revenues = data.map(d => parseFloat(d.revenue || 0));
        const n = revenues.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
        
        revenues.forEach((y, x) => {
            sumX += x;
            sumY += y;
            sumXY += x * y;
            sumX2 += x * x;
        });
        
        const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
        
        if (slope > 100) return 'strong_growth';
        if (slope > 0) return 'moderate_growth';
        if (slope > -100) return 'stable';
        return 'declining';
    }

    calculateVolatility(data) {
        if (data.length < 2) return 'insufficient_data';
        
        const revenues = data.map(d => parseFloat(d.revenue || 0));
        const variance = _.variance(revenues);
        const mean = _.mean(revenues);
        const coefficientOfVariation = Math.sqrt(variance) / mean;
        
        if (coefficientOfVariation > 0.3) return 'high';
        if (coefficientOfVariation > 0.15) return 'medium';
        return 'low';
    }

    calculateTreatmentFrequency(medicalHistory) {
        if (medicalHistory.length < 2) return 0;
        
        const dates = medicalHistory.map(r => moment(r.date_of_service)).sort((a, b) => b - a);
        const totalDays = moment(dates[dates.length - 1]).diff(moment(dates[0]), 'days');
        
        return totalDays > 0 ? (medicalHistory.length / totalDays) * 30 : 0; // Monthly frequency
    }

    hasChronicConditions(medicalHistory) {
        const chronicDiagnosisCodes = ['E', 'I', 'J', 'M']; // Common chronic condition prefixes
        
        return medicalHistory.some(record => 
            record.diagnosis_code && 
            chronicDiagnosisCodes.some(prefix => record.diagnosis_code.startsWith(prefix))
        );
    }

    calculateAppointmentCompliance(medicalHistory) {
        const completedAppointments = medicalHistory.filter(r => r.appointment_status === 'completed').length;
        const totalAppointments = medicalHistory.filter(r => r.appointment_status).length;
        
        return totalAppointments > 0 ? (completedAppointments / totalAppointments) : 0;
    }

    calculateTreatmentComplexity(medicalHistory) {
        const complexityScores = {
            'diagnosis': 1,
            'treatment': 2,
            'procedure': 3,
            'prescription': 1,
            'lab_result': 1,
            'imaging': 2,
            'vaccination': 1
        };
        
        const totalComplexity = medicalHistory.reduce((sum, record) => 
            sum + (complexityScores[record.record_type] || 1), 0
        );
        
        return medicalHistory.length > 0 ? totalComplexity / medicalHistory.length : 0;
    }

    simulateOutcomePrediction(features, conditionType, treatmentType) {
        // Simulate ML prediction (in real implementation, this would use actual trained models)
        const baseEffectiveness = 0.75;
        const baseRecoveryTime = 14;
        
        let effectiveness = baseEffectiveness;
        let recoveryTime = baseRecoveryTime;
        
        // Adjust based on features
        if (features.hasChronicConditions) {
            effectiveness -= 0.1;
            recoveryTime += 3;
        }
        
        if (features.appointmentCompliance > 0.8) {
            effectiveness += 0.1;
            recoveryTime -= 2;
        }
        
        if (features.treatmentComplexity > 2) {
            effectiveness -= 0.05;
            recoveryTime += 2;
        }
        
        return {
            effectivenessScore: Math.max(0, Math.min(1, effectiveness)),
            recoveryTime: Math.max(1, recoveryTime),
            complicationRisk: Math.max(0, Math.min(1, 0.1 + (1 - effectiveness) * 0.3)),
            qualityOfLifeImpact: effectiveness > 0.7 ? 'positive' : effectiveness > 0.5 ? 'neutral' : 'negative',
            recommendations: this.generateRecommendations(features, effectiveness),
            confidence: 0.75
        };
    }

    generateRecommendations(features, effectiveness) {
        const recommendations = [];
        
        if (features.appointmentCompliance < 0.7) {
            recommendations.push('Improve appointment compliance through reminders');
        }
        
        if (features.hasChronicConditions) {
            recommendations.push('Consider chronic disease management program');
        }
        
        if (features.treatmentFrequency > 4) {
            recommendations.push('Monitor for treatment overutilization');
        }
        
        if (effectiveness < 0.6) {
            recommendations.push('Consider alternative treatment approaches');
        }
        
        return recommendations;
    }

    analyzeCostPatterns(costData) {
        const analysis = {
            totalClaims: costData.length,
            totalCost: costData.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0),
            averageCost: 0,
            highCostProcedures: [],
            opportunities: [],
            potentialSavings: 0,
            recommendations: []
        };
        
        analysis.averageCost = analysis.totalCost / analysis.totalClaims;
        
        // Identify high-cost procedures
        const highCostThreshold = analysis.averageCost * 1.5;
        analysis.highCostProcedures = costData.filter(item => 
            parseFloat(item.total_amount || 0) > highCostThreshold
        );
        
        // Identify opportunities
        const deniedClaims = costData.filter(item => item.status === 'denied');
        if (deniedClaims.length > 0) {
            const deniedAmount = deniedClaims.reduce((sum, item) => sum + parseFloat(item.total_amount || 0), 0);
            analysis.opportunities.push({
                type: 'reduce_denials',
                description: 'Reduce claim denials through better documentation',
                potentialSavings: deniedAmount * 0.5
            });
        }
        
        // Calculate potential savings
        analysis.potentialSavings = analysis.opportunities.reduce((sum, opp) => sum + opp.potentialSavings, 0);
        
        // Generate recommendations
        if (analysis.highCostProcedures.length > 0) {
            analysis.recommendations.push('Review high-cost procedures for optimization opportunities');
        }
        
        if (deniedClaims.length > analysis.totalClaims * 0.1) {
            analysis.recommendations.push('Implement claim denial prevention program');
        }
        
        return analysis;
    }

    getDatabase() {
        return new sqlite3.Database(this.dbPath);
    }
}

// Mock ML model classes (in real implementation, these would be actual ML models)
class ClaimApprovalModel {
    async predict(features) {
        // Simulate ML prediction
        let probability = 0.7; // Base probability
        
        // Adjust based on features
        if (features.claimAmount > 10000) probability -= 0.1;
        if (features.hasDiagnosisCodes && features.hasProcedureCodes) probability += 0.15;
        if (features.priorTreatments > 5) probability += 0.1;
        if (features.procedureCount > 3) probability -= 0.05;
        
        probability = Math.max(0, Math.min(1, probability));
        
        return {
            probability,
            riskScore: (1 - probability) * 100,
            recommendation: probability > 0.7 ? 'Approve' : probability > 0.4 ? 'Review' : 'Investigate',
            factors: this.identifyRiskFactors(features),
            confidence: 0.8
        };
    }
    
    identifyRiskFactors(features) {
        const factors = [];
        if (features.claimAmount > 10000) factors.push('High claim amount');
        if (!features.hasDiagnosisCodes) factors.push('Missing diagnosis codes');
        if (!features.hasProcedureCodes) factors.push('Missing procedure codes');
        if (features.procedureCount > 3) factors.push('Multiple procedures');
        return factors;
    }
}

class PatientReadmissionModel {
    async predict(features) {
        let probability = 0.15; // Base readmission probability
        
        if (features.age > 65) probability += 0.1;
        if (features.hasChronicConditions) probability += 0.2;
        if (features.recentTreatmentCount > 3) probability += 0.15;
        if (features.deniedClaimsRate > 0.2) probability += 0.1;
        
        probability = Math.max(0, Math.min(1, probability));
        
        const riskLevel = probability > 0.3 ? 'high' : probability > 0.15 ? 'medium' : 'low';
        
        return {
            probability,
            riskLevel,
            riskFactors: this.identifyRiskFactors(features),
            recommendations: this.generateRecommendations(features, riskLevel),
            confidence: 0.75
        };
    }
    
    identifyRiskFactors(features) {
        const factors = [];
        if (features.age > 65) factors.push('Advanced age');
        if (features.hasChronicConditions) factors.push('Chronic conditions');
        if (features.recentTreatmentCount > 3) factors.push('High treatment frequency');
        if (features.deniedClaimsRate > 0.2) factors.push('High claim denial rate');
        return factors;
    }
    
    generateRecommendations(features, riskLevel) {
        const recommendations = [];
        if (riskLevel === 'high') {
            recommendations.push('Schedule follow-up within 7 days');
            recommendations.push('Consider care coordination');
            recommendations.push('Medication reconciliation');
        } else if (riskLevel === 'medium') {
            recommendations.push('Schedule follow-up within 14 days');
            recommendations.push('Patient education');
        }
        return recommendations;
    }
}

class RevenueForecastModel {
    async predict(features) {
        const historicalData = features.historicalData;
        const lastMonths = historicalData.slice(-3); // Last 3 months
        
        const avgRecentRevenue = _.meanBy(lastMonths, 'revenue');
        const trend = features.trend;
        
        // Simple forecasting based on trend and seasonality
        let growthRate = 0;
        if (trend === 'strong_growth') growthRate = 0.15;
        else if (trend === 'moderate_growth') growthRate = 0.08;
        else if (trend === 'stable') growthRate = 0.02;
        else growthRate = -0.05;
        
        const forecast = [];
        let lastRevenue = avgRecentRevenue;
        
        for (let i = 1; i <= 3; i++) {
            lastRevenue = lastRevenue * (1 + growthRate);
            const forecastDate = moment().add(i, 'months').format('YYYY-MM-DD');
            
            forecast.push({
                month: forecastDate,
                revenue: lastRevenue,
                lowerBound: lastRevenue * 0.8,
                upperBound: lastRevenue * 1.2,
                confidence: Math.max(0.5, 0.9 - (i * 0.1))
            });
        }
        
        return {
            forecast,
            confidence: 0.8,
            accuracy: this.calculateAccuracy(historicalData),
            recommendations: this.generateRecommendations(trend, growthRate)
        };
    }
    
    calculateAccuracy(historicalData) {
        if (historicalData.length < 6) return 0.7;
        
        // Simple accuracy calculation based on variance
        const revenues = historicalData.map(d => d.revenue);
        const variance = _.variance(revenues);
        const mean = _.mean(revenues);
        const coefficientOfVariation = Math.sqrt(variance) / mean;
        
        return Math.max(0.5, 1 - coefficientOfVariation);
    }
    
    generateRecommendations(trend, growthRate) {
        const recommendations = [];
        
        if (growthRate < 0) {
            recommendations.push('Investigate revenue decline causes');
            recommendations.push('Implement revenue recovery strategies');
        } else if (growthRate < 0.05) {
            recommendations.push('Focus on revenue growth initiatives');
        }
        
        if (trend === 'seasonal') {
            recommendations.push('Plan for seasonal variations');
        }
        
        return recommendations;
    }
}

class ProviderPerformanceModel {
    async predict(features) {
        let performanceScore = 3.0; // Base score out of 5
        
        if (features.completionRate > 0.9) performanceScore += 0.5;
        if (features.cancellationRate < 0.1) performanceScore += 0.3;
        if (features.medicalRecordRatio > 0.8) performanceScore += 0.3;
        if (features.revenuePerPatient > 1000) performanceScore += 0.2;
        
        performanceScore = Math.max(1, Math.min(5, performanceScore));
        
        return {
            score: performanceScore,
            efficiencyScore: features.completionRate * 5,
            qualityScore: features.medicalRecordRatio * 5,
            revenuePotential: features.revenuePerPatient * features.totalPatients,
            improvementAreas: this.identifyImprovementAreas(features),
            strengths: this.identifyStrengths(features),
            confidence: 0.8
        };
    }
    
    identifyImprovementAreas(features) {
        const areas = [];
        if (features.completionRate < 0.8) areas.push('Improve appointment completion rate');
        if (features.cancellationRate > 0.2) areas.push('Reduce cancellation rate');
        if (features.medicalRecordRatio < 0.7) areas.push('Improve documentation');
        if (features.revenuePerPatient < 500) areas.push('Optimize revenue per patient');
        return areas;
    }
    
    identifyStrengths(features) {
        const strengths = [];
        if (features.completionRate > 0.9) strengths.push('High appointment completion rate');
        if (features.cancellationRate < 0.1) strengths.push('Low cancellation rate');
        if (features.medicalRecordRatio > 0.8) strengths.push('Excellent documentation');
        if (features.revenuePerPatient > 1000) strengths.push('Strong revenue generation');
        return strengths;
    }
}

module.exports = MLService;
