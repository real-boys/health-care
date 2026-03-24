/**
 * External Verification Service
 * Integrates with external APIs to verify claim information
 */

const axios = require('axios');
const crypto = require('crypto');

class VerificationService {
  constructor() {
    this.config = {
      // Insurance provider APIs
      insuranceProviders: {
        bluecross: {
          enabled: true,
          apiKey: process.env.BLUECROSS_API_KEY,
          baseUrl: 'https://api.bluecross.com/v1',
          timeout: 10000
        },
        aetna: {
          enabled: true,
          apiKey: process.env.AETNA_API_KEY,
          baseUrl: 'https://api.aetna.com/v1',
          timeout: 10000
        },
        unitedhealth: {
          enabled: true,
          apiKey: process.env.UH_API_KEY,
          baseUrl: 'https://api.uhc.com/v1',
          timeout: 10000
        }
      },
      
      // Provider verification services
      providerVerification: {
        nppes: {
          enabled: true,
          baseUrl: 'https://npiregistry.cms.hhs.gov/api',
          timeout: 15000
        },
        stateMedicalBoards: {
          enabled: false,
          baseUrl: 'https://api.stateboards.org',
          timeout: 10000
        }
      },
      
      // Authorization services
      authorization: {
        authHub: {
          enabled: true,
          apiKey: process.env.AUTHHUB_API_KEY,
          baseUrl: 'https://api.authhub.com/v1',
          timeout: 8000
        }
      },
      
      // General settings
      retryAttempts: 3,
      retryDelay: 1000,
      cacheTimeout: 300000 // 5 minutes
    };
    
    this.cache = new Map();
    this.initializeService();
  }

  /**
   * Initialize verification service
   */
  initializeService() {
    // Set up axios defaults
    axios.defaults.timeout = this.config.retryAttempts * this.config.retryDelay;
    
    // Clean up cache periodically
    setInterval(() => {
      this.cleanCache();
    }, this.config.cacheTimeout);
  }

  /**
   * Verify patient eligibility
   */
  async verifyEligibility(claim) {
    const cacheKey = this.generateCacheKey('eligibility', claim.patient_id, claim.insurance_provider);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const provider = this.getInsuranceProvider(claim.insurance_provider);
      if (!provider) {
        return this.createVerificationResult('eligibility', false, 'Unknown insurance provider');
      }
      
      const eligibilityData = await this.queryEligibility(provider, claim);
      const result = this.processEligibilityResponse(eligibilityData, claim);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
      
    } catch (error) {
      return this.createVerificationResult('eligibility', false, `Eligibility verification failed: ${error.message}`);
    }
  }

  /**
   * Verify provider credentials
   */
  async verifyProvider(claim) {
    const cacheKey = this.generateCacheKey('provider', claim.provider_name, claim.provider_npi);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      // Verify with NPPES registry
      const nppesResult = await this.verifyWithNPPES(claim.provider_npi);
      
      // Additional verification if enabled
      let additionalVerification = null;
      if (this.config.providerVerification.stateMedicalBoards.enabled) {
        additionalVerification = await this.verifyWithStateBoard(claim.provider_npi);
      }
      
      const result = this.processProviderVerification(nppesResult, additionalVerification, claim);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
      
    } catch (error) {
      return this.createVerificationResult('provider', false, `Provider verification failed: ${error.message}`);
    }
  }

  /**
   * Verify treatment authorization
   */
  async verifyAuthorization(claim) {
    const cacheKey = this.generateCacheKey('authorization', claim.patient_id, claim.procedure_codes);
    
    // Check cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return cached;
    }
    
    try {
      const authService = this.config.authorization.authHub;
      if (!authService.enabled) {
        return this.createVerificationResult('authorization', true, 'Authorization service not configured, auto-approved');
      }
      
      const authData = await this.queryAuthorization(authService, claim);
      const result = this.processAuthorizationResponse(authData, claim);
      
      // Cache the result
      this.setCache(cacheKey, result);
      
      return result;
      
    } catch (error) {
      return this.createVerificationResult('authorization', false, `Authorization verification failed: ${error.message}`);
    }
  }

  /**
   * Query eligibility from insurance provider
   */
  async queryEligibility(provider, claim) {
    const payload = {
      memberId: claim.insurance_policy_number,
      patient: {
        firstName: claim.patient_first_name,
        lastName: claim.patient_last_name,
        dateOfBirth: claim.patient_date_of_birth
      },
      serviceDate: claim.service_date,
      provider: {
        npi: claim.provider_npi,
        name: claim.provider_name
      }
    };
    
    const response = await this.makeRequest('POST', `${provider.baseUrl}/eligibility`, payload, {
      'Authorization': `Bearer ${provider.apiKey}`,
      'Content-Type': 'application/json'
    });
    
    return response.data;
  }

  /**
   * Verify provider with NPPES
   */
  async verifyWithNPPES(npi) {
    if (!npi) {
      throw new Error('Provider NPI is required for verification');
    }
    
    const url = `${this.config.providerVerification.nppes.baseUrl}?version=2.1&number=${npi}`;
    
    const response = await this.makeRequest('GET', url);
    
    if (response.data.results && response.data.results.length > 0) {
      return response.data.results[0];
    } else {
      throw new Error('Provider not found in NPPES registry');
    }
  }

  /**
   * Verify provider with state medical board
   */
  async verifyWithStateBoard(npi) {
    // Implementation would depend on specific state board API
    // For now, return a mock result
    return {
      licenseStatus: 'active',
      licenseExpiry: '2025-12-31',
      disciplinaryActions: []
    };
  }

  /**
   * Query authorization from auth service
   */
  async queryAuthorization(authService, claim) {
    const payload = {
      memberId: claim.insurance_policy_number,
      provider: {
        npi: claim.provider_npi,
        name: claim.provider_name
      },
      procedures: claim.procedure_codes.split(',').map(code => code.trim()),
      diagnosis: claim.diagnosis_codes.split(',').map(code => code.trim()),
      serviceDate: claim.service_date
    };
    
    const response = await this.makeRequest('POST', `${authService.baseUrl}/authorization`, payload, {
      'Authorization': `Bearer ${authService.apiKey}`,
      'Content-Type': 'application/json'
    });
    
    return response.data;
  }

  /**
   * Process eligibility verification response
   */
  processEligibilityResponse(data, claim) {
    const isActive = data.status === 'active';
    const hasCoverage = data.coverage && data.coverage.some(c => 
      c.coverageType === 'medical' && c.isActive
    );
    
    const issues = [];
    if (!isActive) issues.push('Policy not active');
    if (!hasCoverage) issues.push('No medical coverage found');
    if (data.deductible && data.deductible.remaining > 0) {
      issues.push(`Deductible remaining: $${data.deductible.remaining}`);
    }
    
    return {
      type: 'eligibility',
      valid: isActive && hasCoverage,
      data: {
        policyStatus: data.status,
        coverage: data.coverage,
        deductible: data.deductible,
        copay: data.copay,
        coinsurance: data.coinsurance
      },
      issues,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Process provider verification response
   */
  processProviderVerification(nppesResult, additionalResult, claim) {
    const isActive = nppesResult.basic?.status === 'A'; // Active status
    
    const issues = [];
    if (!isActive) issues.push('Provider not active in NPPES');
    
    if (nppesResult.basic?.name !== claim.provider_name) {
      issues.push('Provider name mismatch');
    }
    
    let additionalInfo = null;
    if (additionalResult) {
      if (additionalResult.licenseStatus !== 'active') {
        issues.push('Medical license not active');
      }
      if (additionalResult.disciplinaryActions && additionalResult.disciplinaryActions.length > 0) {
        issues.push('Provider has disciplinary actions');
      }
      additionalInfo = additionalResult;
    }
    
    return {
      type: 'provider',
      valid: isActive && issues.length === 0,
      data: {
        nppesData: nppesResult,
        additionalVerification: additionalInfo
      },
      issues,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Process authorization verification response
   */
  processAuthorizationResponse(data, claim) {
    const isAuthorized = data.status === 'approved' || data.status === 'auto-approved';
    
    const issues = [];
    if (!isAuthorized) {
      issues.push(`Authorization status: ${data.status}`);
      if (data.reason) issues.push(data.reason);
    }
    
    if (data.procedures) {
      const unauthorizedProcedures = data.procedures
        .filter(p => p.status !== 'approved')
        .map(p => p.code);
      
      if (unauthorizedProcedures.length > 0) {
        issues.push(`Unauthorized procedures: ${unauthorizedProcedures.join(', ')}`);
      }
    }
    
    return {
      type: 'authorization',
      valid: isAuthorized,
      data: {
        authorizationNumber: data.authorizationNumber,
        status: data.status,
        procedures: data.procedures,
        limitations: data.limitations,
        expiryDate: data.expiryDate
      },
      issues,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Make HTTP request with retry logic
   */
  async makeRequest(method, url, data = null, headers = {}) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.config.retryAttempts; attempt++) {
      try {
        const config = {
          method,
          url,
          headers: {
            'User-Agent': 'HealthCare-ClaimProcessor/1.0',
            ...headers
          },
          timeout: this.config.retryAttempts * this.config.retryDelay
        };
        
        if (data && (method === 'POST' || method === 'PUT')) {
          config.data = data;
        }
        
        const response = await axios(config);
        return response;
        
      } catch (error) {
        lastError = error;
        
        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }

  /**
   * Get insurance provider configuration
   */
  getInsuranceProvider(providerName) {
    const normalized = providerName.toLowerCase().replace(/\s+/g, '');
    return this.config.insuranceProviders[normalized];
  }

  /**
   * Create verification result
   */
  createVerificationResult(type, valid, message, data = null) {
    return {
      type,
      valid,
      message,
      data,
      verifiedAt: new Date().toISOString()
    };
  }

  /**
   * Cache management
   */
  generateCacheKey(...parts) {
    return crypto.createHash('md5').update(parts.join(':')).digest('hex');
  }

  getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.config.cacheTimeout) {
      return cached.data;
    }
    
    if (cached) {
      this.cache.delete(key);
    }
    
    return null;
  }

  setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  cleanCache() {
    const now = Date.now();
    for (const [key, value] of this.cache.entries()) {
      if (now - value.timestamp >= this.config.cacheTimeout) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Batch verification
   */
  async batchVerify(claims) {
    const results = [];
    
    for (const claim of claims) {
      try {
        const [eligibility, provider, authorization] = await Promise.all([
          this.verifyEligibility(claim),
          this.verifyProvider(claim),
          this.verifyAuthorization(claim)
        ]);
        
        results.push({
          claimId: claim.id,
          eligibility,
          provider,
          authorization,
          overallValid: eligibility.valid && provider.valid && authorization.valid
        });
        
      } catch (error) {
        results.push({
          claimId: claim.id,
          error: error.message,
          overallValid: false
        });
      }
    }
    
    return results;
  }

  /**
   * Health check for external services
   */
  async healthCheck() {
    const health = {
      overall: 'healthy',
      services: {}
    };
    
    // Check insurance providers
    for (const [name, provider] of Object.entries(this.config.insuranceProviders)) {
      if (provider.enabled) {
        try {
          const response = await this.makeRequest('GET', `${provider.baseUrl}/health`);
          health.services[name] = {
            status: 'healthy',
            responseTime: response.headers['x-response-time'] || 'unknown'
          };
        } catch (error) {
          health.services[name] = {
            status: 'unhealthy',
            error: error.message
          };
          health.overall = 'degraded';
        }
      }
    }
    
    // Check NPPES
    try {
      const response = await this.makeRequest('GET', `${this.config.providerVerification.nppes.baseUrl}?version=2.1`);
      health.services.nppes = {
        status: 'healthy',
        responseTime: response.headers['x-response-time'] || 'unknown'
      };
    } catch (error) {
      health.services.nppes = {
        status: 'unhealthy',
        error: error.message
      };
      health.overall = 'degraded';
    }
    
    return health;
  }

  /**
   * Get service statistics
   */
  getStatistics() {
    return {
      config: this.config,
      cacheSize: this.cache.size,
      enabledServices: {
        insuranceProviders: Object.keys(this.config.insuranceProviders).filter(k => 
          this.config.insuranceProviders[k].enabled
        ),
        providerVerification: Object.keys(this.config.providerVerification).filter(k => 
          this.config.providerVerification[k].enabled
        ),
        authorization: Object.keys(this.config.authorization).filter(k => 
          this.config.authorization[k].enabled
        )
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
  }
}

module.exports = VerificationService;
