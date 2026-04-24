const mongoose = require('mongoose');
const Claim = require('../../models/Claim');
const Policy = require('../../models/Policy');
const Payment = require('../../models/Payment');
const User = require('../../models/User');
const ML_CONFIG = require('../config');

class FeatureEngineer {
  constructor() {
    this.scalers = new Map();
    this.encoders = new Map();
    this.featureStats = new Map();
  }

  async extractFeatures(dataType, filters = {}) {
    switch (dataType) {
      case 'claims':
        return await this.extractClaimFeatures(filters);
      case 'policies':
        return await this.extractPolicyFeatures(filters);
      case 'customers':
        return await this.extractCustomerFeatures(filters);
      case 'premiums':
        return await this.extractPremiumFeatures(filters);
      default:
        throw new Error(`Unsupported data type: ${dataType}`);
    }
  }

  async extractClaimFeatures(filters = {}) {
    const claims = await Claim.find(filters)
      .populate('policy', 'policyType premium term underwriting')
      .populate('validation.coverageCheck.checkedBy', 'role')
      .lean();

    const features = claims.map(claim => {
      const policy = claim.policy;
      const today = new Date();
      
      return {
        // Basic claim features
        claimId: claim._id,
        claimAmount: claim.estimatedAmount || 0,
        approvedAmount: claim.approvedAmount || 0,
        claimType: this.encodeCategorical(claim.claimType),
        claimStatus: this.encodeCategorical(claim.status),
        priority: this.encodeCategorical(claim.priority),
        
        // Temporal features
        claimAge: Math.floor((today - new Date(claim.createdAt)) / (1000 * 60 * 60 * 24)),
        delayDays: Math.floor((new Date(claim.createdAt) - new Date(claim.incident.date)) / (1000 * 60 * 60 * 24)),
        incidentHour: new Date(claim.incident.date).getHours(),
        incidentDayOfWeek: new Date(claim.incident.date).getDay(),
        incidentMonth: new Date(claim.incident.date).getMonth(),
        
        // Policy-related features
        policyType: this.encodeCategorical(policy?.policyType || 'unknown'),
        policyAge: policy ? Math.floor((today - new Date(policy.createdAt)) / (1000 * 60 * 60 * 24)) : 0,
        coverageAmount: policy?.coverage?.amount || 0,
        deductible: claim.deductible || 0,
        premiumAmount: policy?.premium?.amount || 0,
        premiumFrequency: this.encodeCategorical(policy?.premium?.frequency || 'monthly'),
        
        // Risk assessment features
        fraudIndicators: claim.validation?.fraudIndicators?.length || 0,
        highSeverityIndicators: claim.validation?.fraudIndicators?.filter(i => i.severity === 'high')?.length || 0,
        documentsCount: claim.documents?.length || 0,
        hasMedicalReport: claim.documents?.some(d => d.type === 'medical_report') ? 1 : 0,
        hasPoliceReport: claim.documents?.some(d => d.type === 'police_report') ? 1 : 0,
        
        // Financial features
        claimToPremiumRatio: policy?.premium?.amount ? claim.estimatedAmount / policy.premium.amount : 0,
        approvedToEstimatedRatio: claim.estimatedAmount ? (claim.approvedAmount || 0) / claim.estimatedAmount : 0,
        netPayable: Math.max(0, (claim.approvedAmount || 0) - (claim.deductible || 0)),
        
        // Location features (if available)
        incidentLocation: this.encodeCategorical(claim.incident?.location || 'unknown'),
        
        // Target variables for supervised learning
        isFraud: claim.validation?.fraudIndicators?.some(i => i.severity === 'high') ? 1 : 0,
        willApprove: claim.status === 'approved' ? 1 : 0,
        processingTime: claim.decision?.approvedAt ? 
          Math.floor((new Date(claim.decision.approvedAt) - new Date(claim.createdAt)) / (1000 * 60 * 60 * 24)) : 0
      };
    });

    return features;
  }

  async extractPolicyFeatures(filters = {}) {
    const policies = await Policy.find(filters)
      .populate('provider', 'role email')
      .lean();

    return policies.map(policy => {
      const today = new Date();
      
      return {
        policyId: policy._id,
        policyType: this.encodeCategorical(policy.policyType),
        policyAge: Math.floor((today - new Date(policy.createdAt)) / (1000 * 60 * 60 * 24)),
        premiumAmount: policy.premium.amount,
        premiumFrequency: this.encodeCategorical(policy.premium.frequency),
        coverageAmount: policy.coverage?.amount || 0,
        riskScore: policy.underwriting?.riskScore || 0,
        
        // Policyholder demographics
        holderAge: this.calculateAge(policy.policyHolder.dateOfBirth),
        holderGender: this.encodeCategorical(policy.policyHolder.gender || 'unknown'),
        
        // Temporal features
        termLength: Math.floor((new Date(policy.term.endDate) - new Date(policy.term.startDate)) / (1000 * 60 * 60 * 24)),
        daysToExpiry: Math.floor((new Date(policy.term.endDate) - today) / (1000 * 60 * 60 * 24)),
        isInGracePeriod: policy.isInGracePeriod ? 1 : 0,
        isExpired: policy.isExpired ? 1 : 0,
        
        // Features based on beneficiaries
        beneficiariesCount: policy.beneficiaries?.length || 0,
        
        // Payment history features
        paymentsCount: policy.payments?.length || 0,
        successfulPayments: policy.payments?.filter(p => p.status === 'completed')?.length || 0,
        paymentSuccessRate: policy.payments?.length ? 
          policy.payments.filter(p => p.status === 'completed').length / policy.payments.length : 0,
        
        // Target variables
        isActive: policy.status === 'active' ? 1 : 0,
        willRenew: policy.term.autoRenewal ? 1 : 0
      };
    });
  }

  async extractCustomerFeatures(filters = {}) {
    const users = await User.find(filters).lean();
    const features = [];

    for (const user of users) {
      const userPolicies = await Policy.find({ provider: user._id }).lean();
      const userClaims = await Claim.find({ 'policy': { $in: userPolicies.map(p => p._id) } }).lean();
      
      const customerFeature = {
        userId: user._id,
        role: this.encodeCategorical(user.role),
        accountAge: Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24)),
        
        // Policy-related features
        policiesCount: userPolicies.length,
        activePolicies: userPolicies.filter(p => p.status === 'active').length,
        totalPremium: userPolicies.reduce((sum, p) => sum + (p.premium?.amount || 0), 0),
        averagePremium: userPolicies.length ? 
          userPolicies.reduce((sum, p) => sum + (p.premium?.amount || 0), 0) / userPolicies.length : 0,
        
        // Claims-related features
        claimsCount: userClaims.length,
        approvedClaims: userClaims.filter(c => c.status === 'approved').length,
        rejectedClaims: userClaims.filter(c => c.status === 'rejected').length,
        totalClaimAmount: userClaims.reduce((sum, c) => sum + (c.estimatedAmount || 0), 0),
        averageClaimAmount: userClaims.length ? 
          userClaims.reduce((sum, c) => sum + (c.estimatedAmount || 0), 0) / userClaims.length : 0,
        claimApprovalRate: userClaims.length ? 
          userClaims.filter(c => c.status === 'approved').length / userClaims.length : 0,
        
        // Risk indicators
        highValueClaims: userClaims.filter(c => c.estimatedAmount > 10000).length,
        fraudIndicators: userClaims.reduce((sum, c) => 
          sum + (c.validation?.fraudIndicators?.length || 0), 0),
        
        // Target variables
        isHighRisk: this.calculateRiskScore(user, userPolicies, userClaims) > 0.7 ? 1 : 0,
        willChurn: this.calculateChurnProbability(user, userPolicies, userClaims) > 0.5 ? 1 : 0
      };

      features.push(customerFeature);
    }

    return features;
  }

  async extractPremiumFeatures(filters = {}) {
    const policies = await Policy.find(filters).lean();
    const claims = await Claim.find({
      'policy': { $in: policies.map(p => p._id) }
    }).populate('policy').lean();

    return policies.map(policy => {
      const policyClaims = claims.filter(c => c.policy._id.toString() === policy._id.toString());
      
      return {
        policyId: policy._id,
        currentPremium: policy.premium.amount,
        policyType: this.encodeCategorical(policy.policyType),
        coverageAmount: policy.coverage?.amount || 0,
        riskScore: policy.underwriting?.riskScore || 0,
        
        // Claims history
        claimsCount: policyClaims.length,
        totalClaimsAmount: policyClaims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0),
        claimsToPremiumRatio: policy.premium.amount ? 
          policyClaims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0) / policy.premium.amount : 0,
        
        // Policyholder characteristics
        holderAge: this.calculateAge(policy.policyHolder.dateOfBirth),
        
        // Target: optimal premium
        optimalPremium: this.calculateOptimalPremium(policy, policyClaims)
      };
    });
  }

  // Feature transformation methods
  normalizeFeatures(features, columns) {
    const normalized = [...features];
    
    columns.forEach(column => {
      const values = features.map(f => f[column] || 0);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const std = Math.sqrt(values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length);
      
      this.featureStats.set(column, { mean, std });
      
      normalized.forEach(feature => {
        feature[column] = std !== 0 ? (feature[column] - mean) / std : 0;
      });
    });
    
    return normalized;
  }

  encodeCategorical(value) {
    if (!value) return 0;
    
    if (!this.encoders.has(value)) {
      this.encoders.set(value, this.encoders.size);
    }
    
    return this.encoders.get(value);
  }

  createInteractionFeatures(features, interactions) {
    return features.map(feature => {
      const newFeature = { ...feature };
      
      interactions.forEach(([col1, col2, newName]) => {
        if (feature[col1] !== undefined && feature[col2] !== undefined) {
          newFeature[newName] = feature[col1] * feature[col2];
        }
      });
      
      return newFeature;
    });
  }

  createPolynomialFeatures(features, columns, degree = 2) {
    return features.map(feature => {
      const newFeature = { ...feature };
      
      columns.forEach(column => {
        if (feature[column] !== undefined) {
          for (let d = 2; d <= degree; d++) {
            newFeature[`${column}_pow_${d}`] = Math.pow(feature[column], d);
          }
        }
      });
      
      return newFeature;
    });
  }

  // Helper methods
  calculateAge(dateOfBirth) {
    if (!dateOfBirth) return 0;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  calculateRiskScore(user, policies, claims) {
    let riskScore = 0;
    
    // Claims history impact
    if (claims.length > 0) {
      const rejectionRate = claims.filter(c => c.status === 'rejected').length / claims.length;
      riskScore += rejectionRate * 0.3;
      
      const highValueClaims = claims.filter(c => c.estimatedAmount > 10000).length;
      riskScore += (highValueClaims / claims.length) * 0.2;
    }
    
    // Policy status impact
    const inactivePolicies = policies.filter(p => p.status !== 'active').length;
    if (policies.length > 0) {
      riskScore += (inactivePolicies / policies.length) * 0.2;
    }
    
    // Account age impact (newer accounts are slightly riskier)
    const accountAge = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    if (accountAge < 30) riskScore += 0.1;
    
    return Math.min(riskScore, 1);
  }

  calculateChurnProbability(user, policies, claims) {
    let churnProb = 0.1; // Base probability
    
    // Account age impact
    const accountAge = Math.floor((new Date() - new Date(user.createdAt)) / (1000 * 60 * 60 * 24));
    if (accountAge > 365) churnProb += 0.1;
    
    // Claims experience impact
    if (claims.length > 0) {
      const rejectionRate = claims.filter(c => c.status === 'rejected').length / claims.length;
      churnProb += rejectionRate * 0.3;
    }
    
    // Policy activity impact
    const activePolicies = policies.filter(p => p.status === 'active').length;
    if (policies.length > 0 && activePolicies / policies.length < 0.5) {
      churnProb += 0.2;
    }
    
    return Math.min(churnProb, 1);
  }

  calculateOptimalPremium(policy, claims) {
    let basePremium = policy.premium.amount;
    
    // Adjust based on claims history
    if (claims.length > 0) {
      const totalClaims = claims.reduce((sum, c) => sum + (c.approvedAmount || 0), 0);
      const claimsRatio = totalClaims / (basePremium * 12); // Annual comparison
      basePremium *= (1 + claimsRatio * 0.1);
    }
    
    // Adjust based on risk score
    const riskScore = policy.underwriting?.riskScore || 0.5;
    basePremium *= (1 + (riskScore - 0.5) * 0.2);
    
    // Adjust based on policyholder age
    const holderAge = this.calculateAge(policy.policyHolder.dateOfBirth);
    if (holderAge > 65) basePremium *= 1.1;
    if (holderAge < 25) basePremium *= 1.05;
    
    return Math.round(basePremium * 100) / 100;
  }

  async saveFeatureStats(filePath) {
    const stats = {
      scalers: Object.fromEntries(this.scalers),
      encoders: Object.fromEntries(this.encoders),
      featureStats: Object.fromEntries(this.featureStats)
    };
    
    require('fs').writeFileSync(filePath, JSON.stringify(stats, null, 2));
  }

  async loadFeatureStats(filePath) {
    try {
      const stats = JSON.parse(require('fs').readFileSync(filePath, 'utf8'));
      this.scalers = new Map(Object.entries(stats.scalers));
      this.encoders = new Map(Object.entries(stats.encoders));
      this.featureStats = new Map(Object.entries(stats.featureStats));
    } catch (error) {
      console.warn('Could not load feature stats:', error.message);
    }
  }
}

module.exports = FeatureEngineer;
