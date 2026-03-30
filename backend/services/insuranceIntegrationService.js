const axios = require('axios');

/**
 * Insurance Provider Integration Service
 * Supports multiple insurance companies with unified API interface
 */
class InsuranceIntegrationService {
  constructor() {
    this.providers = new Map();
    this.initializeProviders();
  }

  /**
   * Initialize insurance provider adapters
   */
  initializeProviders() {
    // UnitedHealthcare
    if (process.env.UHC_API_KEY) {
      this.providers.set('uhc', {
        name: 'UnitedHealthcare',
        baseUrl: process.env.UHC_BASE_URL || 'https://api.uhc.com',
        apiKey: process.env.UHC_API_KEY,
        apiSecret: process.env.UHC_API_SECRET,
        enabled: true
      });
    }

    // Aetna
    if (process.env.AETNA_API_KEY) {
      this.providers.set('aetna', {
        name: 'Aetna',
        baseUrl: process.env.AETNA_BASE_URL || 'https://api.aetna.com',
        apiKey: process.env.AETNA_API_KEY,
        apiSecret: process.env.AETNA_API_SECRET,
        enabled: true
      });
    }

    // Blue Cross Blue Shield
    if (process.env.BCBS_API_KEY) {
      this.providers.set('bcbs', {
        name: 'Blue Cross Blue Shield',
        baseUrl: process.env.BCBS_BASE_URL || 'https://api.bcbs.com',
        apiKey: process.env.BCBS_API_KEY,
        apiSecret: process.env.BCBS_API_SECRET,
        enabled: true
      });
    }

    // Cigna
    if (process.env.CIGNA_API_KEY) {
      this.providers.set('cigna', {
        name: 'Cigna',
        baseUrl: process.env.CIGNA_BASE_URL || 'https://api.cigna.com',
        apiKey: process.env.CIGNA_API_KEY,
        apiSecret: process.env.CIGNA_API_SECRET,
        enabled: true
      });
    }

    // Humana
    if (process.env.HUMANA_API_KEY) {
      this.providers.set('humana', {
        name: 'Humana',
        baseUrl: process.env.HUMANA_BASE_URL || 'https://api.humana.com',
        apiKey: process.env.HUMANA_API_KEY,
        apiSecret: process.env.HUMANA_API_SECRET,
        enabled: true
      });
    }
  }

  /**
   * Get access token for insurance provider
   */
  async getAccessToken(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    try {
      const response = await axios.post(
        `${provider.baseUrl}/oauth2/token`,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: provider.apiKey,
          client_secret: provider.apiSecret,
          scope: 'patient/Patient.read patient/Coverage.read patient/Claim.read patient/ExplanationOfBenefit.read'
        }),
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );

      return {
        accessToken: response.data.access_token,
        expiresIn: response.data.expires_in,
        expiresAt: new Date(Date.now() + (response.data.expires_in * 1000))
      };
    } catch (error) {
      throw new Error(`${provider.name} token retrieval failed: ${error.message}`);
    }
  }

  /**
   * Verify patient eligibility and coverage
   */
  async verifyEligibility(providerId, patientInfo, serviceDate) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    try {
      const token = await this.getAccessToken(providerId);
      
      const eligibilityRequest = {
        patient: {
          memberId: patientInfo.memberId,
          firstName: patientInfo.firstName,
          lastName: patientInfo.lastName,
          dateOfBirth: patientInfo.dateOfBirth,
          gender: patientInfo.gender
        },
        serviceDate,
        requestedInformation: [
          'coverage',
          'benefits',
          'eligibility',
          'copay',
          'deductible',
          'coinsurance'
        ]
      };

      const response = await axios.post(
        `${provider.baseUrl}/fhir/r4/CoverageEligibilityRequest`,
        eligibilityRequest,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          }
        }
      );

      return this.transformEligibilityResponse(response.data, provider);
    } catch (error) {
      throw new Error(`${provider.name} eligibility verification failed: ${error.message}`);
    }
  }

  /**
   * Submit insurance claim
   */
  async submitClaim(providerId, claimData) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    try {
      const token = await this.getAccessToken(providerId);
      
      const claim = {
        resourceType: 'Claim',
        status: 'active',
        type: {
          coding: [{
            system: 'http://terminology.hl7.org/CodeSystem/claim-type',
            code: claimData.claimType || 'professional'
          }]
        },
        use: 'claim',
        patient: {
          identifier: {
            system: `${provider.baseUrl}/member-id`,
            value: claimData.memberId
          }
        },
        created: new Date().toISOString(),
        insurer: {
          identifier: {
            value: providerId
          }
        },
        provider: {
          identifier: {
            value: claimData.providerNPI
          }
        },
        priority: {
          coding: [{
            code: claimData.priority || 'normal'
          }]
        },
        payee: {
          type: {
            coding: [{
              code: '1' // Provider
            }]
          },
          party: {
            reference: `Practitioner/${claimData.providerNPI}`
          }
        },
        careTeam: claimData.careTeam?.map((member, index) => ({
          sequence: index + 1,
          provider: {
            identifier: {
              value: member.npi
            }
          },
          role: {
            coding: [{
              code: member.role || 'primary'
            }]
          }
        })),
        diagnosis: claimData.diagnoses?.map((diag, index) => ({
          sequence: index + 1,
          diagnosisCodeableConcept: {
            coding: [{
              system: 'http://hl7.org/fhir/sid/icd-10',
              code: diag.code
            }]
          },
          type: diag.type ? [{
            coding: [{
              code: diag.type
            }]
          }] : []
        })),
        procedure: claimData.procedures?.map((proc, index) => ({
          sequence: index + 1,
          procedureCodeableConcept: {
            coding: [{
              system: 'http://www.ama-assn.org/go/cpt',
              code: proc.code
            }]
          },
          date: proc.date
        })),
        item: claimData.lineItems?.map((item, index) => ({
          sequence: index + 1,
          category: {
            coding: [{
              code: item.category || '1'
            }]
          },
          productOrService: {
            coding: [{
              system: 'http://www.ama-assn.org/go/cpt',
              code: item.code
            }]
          },
          quantity: {
            value: item.quantity || 1
          },
          unitPrice: {
            value: item.unitPrice,
            currency: 'USD'
          },
          total: {
            value: item.unitPrice * (item.quantity || 1),
            currency: 'USD'
          },
          diagnosisSequence: item.diagnosisPointers || [1],
          procedureSequence: item.procedurePointers || [],
          servicingInformation: item.servicingInfo ? [{
            category: {
              coding: item.servicingInfo
            }
          }] : []
        })),
        total: [{
          category: {
            coding: [{
              code: 'submitted'
            }]
          },
          amount: {
            value: claimData.totalAmount,
            currency: 'USD'
          }
        }],
        supportingInfo: claimData.supportingInfo?.map((info, index) => ({
          sequence: index + 1,
          category: {
            coding: [{
              code: info.category
            }]
          },
          valueString: info.value
        }))
      };

      const response = await axios.post(
        `${provider.baseUrl}/fhir/r4/Claim`,
        claim,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Content-Type': 'application/fhir+json',
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        success: true,
        claimId: response.data.id,
        claimNumber: response.data.identifier?.[0]?.value,
        status: response.data.status,
        submitted: response.data.created,
        provider: provider.name,
        totalAmount: claimData.totalAmount,
        acknowledgment: response.data
      };
    } catch (error) {
      throw new Error(`${provider.name} claim submission failed: ${error.message}`);
    }
  }

  /**
   * Get claim status
   */
  async getClaimStatus(providerId, claimId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    try {
      const token = await this.getAccessToken(providerId);
      
      const response = await axios.get(
        `${provider.baseUrl}/fhir/r4/Claim/${claimId}`,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        success: true,
        claimId: response.data.id,
        status: response.data.status,
        created: response.data.created,
        provider: provider.name,
        totalAmount: response.data.total?.[0]?.amount?.value,
        details: response.data
      };
    } catch (error) {
      throw new Error(`${provider.name} claim status retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get Explanation of Benefits (EOB)
   */
  async getExplanationOfBenefits(providerId, claimId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    try {
      const token = await this.getAccessToken(providerId);
      
      const response = await axios.get(
        `${provider.baseUrl}/fhir/r4/ExplanationOfBenefit?claim=${claimId}`,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      if (!response.data.entry || response.data.entry.length === 0) {
        return {
          success: false,
          error: 'EOB not found for this claim'
        };
      }

      const eob = response.data.entry[0].resource;
      return this.transformEOB(eob, provider);
    } catch (error) {
      throw new Error(`${provider.name} EOB retrieval failed: ${error.message}`);
    }
  }

  /**
   * Get patient coverage information
   */
  async getCoverage(providerId, patientId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      throw new Error(`Insurance provider ${providerId} not found`);
    }

    try {
      const token = await this.getAccessToken(providerId);
      
      const response = await axios.get(
        `${provider.baseUrl}/fhir/r4/Coverage?patient=${patientId}`,
        {
          headers: {
            'Authorization': `Bearer ${token.accessToken}`,
            'Accept': 'application/fhir+json'
          }
        }
      );

      return {
        success: true,
        coverages: response.data.entry?.map(entry => this.transformCoverage(entry.resource, provider)) || [],
        total: response.data.total
      };
    } catch (error) {
      throw new Error(`${provider.name} coverage retrieval failed: ${error.message}`);
    }
  }

  /**
   * Transform eligibility response
   */
  transformEligibilityResponse(eligibilityResponse, provider) {
    return {
      success: true,
      provider: provider.name,
      requestId: eligibilityResponse.id,
      status: eligibilityResponse.disposition,
      patient: {
        firstName: eligibilityResponse.patient?.given?.[0],
        lastName: eligibilityResponse.patient?.family,
        memberId: eligibilityResponse.patient?.identifier?.[0]?.value
      },
      coverage: {
        active: eligibilityResponse.insurance?.[0]?.focal,
        planName: eligibilityResponse.insurance?.[0]?.businessArrangement,
        payer: eligibilityResponse.insurer?.display
      },
      benefits: eligibilityResponse.item?.map(item => ({
        category: item.category?.text,
        covered: item.adjudication?.some(adj => adj.category?.coding?.[0]?.code === 'covered'),
        copay: item.adjudication?.find(adj => adj.category?.coding?.[0]?.code === 'copay')?.amount?.value,
        deductible: item.adjudication?.find(adj => adj.category?.coding?.[0]?.code === 'deductible')?.amount?.value,
        coinsurance: item.adjudication?.find(adj => adj.category?.coding?.[0]?.code === 'coinsurance')?.amount?.value
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Transform EOB
   */
  transformEOB(eob, provider) {
    return {
      success: true,
      provider: provider.name,
      eobId: eob.id,
      claimId: eob.claim?.reference?.split('/')[1],
      status: eob.status,
      type: eob.type?.coding?.[0]?.display,
      use: eob.use,
      patient: {
        id: eob.patient?.reference?.split('/')[1],
        name: eob.patient?.display
      },
      created: eob.created,
      insurer: {
        id: eob.insurer?.reference?.split('/')[1],
        name: eob.insurer?.display
      },
      provider: {
        id: eob.provider?.reference?.split('/')[1],
        name: eob.provider?.display
      },
      outcome: eob.outcome,
      payment: {
        type: eob.payment?.type?.coding?.[0]?.display,
        date: eob.payment?.date,
        amount: eob.payment?.amount?.value,
        currency: eob.payment?.amount?.currency
      },
      total: eob.total?.map(total => ({
        category: total.category?.coding?.[0]?.code,
        amount: total.amount?.value,
        currency: total.amount?.currency
      })),
      items: eob.item?.map(item => ({
        sequence: item.sequence,
        productOrService: item.productOrService?.coding?.[0]?.display,
        servicedDate: item.servicedDate,
        adjudication: item.adjudication?.map(adj => ({
          category: adj.category?.coding?.[0]?.display,
          amount: adj.amount?.value,
          reason: adj.reason?.coding?.[0]?.display
        }))
      })),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Transform coverage
   */
  transformCoverage(coverage, provider) {
    return {
      id: coverage.id,
      status: coverage.status,
      type: coverage.type?.text,
      policyHolder: coverage.policyHolder?.reference,
      subscriber: coverage.subscriber?.reference,
      subscriberId: coverage.subscriberId,
      beneficiary: coverage.beneficiary?.reference,
      dependent: coverage.dependent,
      relationship: coverage.relationship?.text,
      period: coverage.period,
      payor: coverage.payor?.map(p => p.reference),
      class: coverage.class?.map(c => ({
        type: c.type?.text,
        value: c.value,
        name: c.name
      })),
      order: coverage.order,
      network: coverage.network
    };
  }

  /**
   * Get all available providers
   */
  getAvailableProviders() {
    return Array.from(this.providers.entries()).map(([id, config]) => ({
      id,
      name: config.name,
      enabled: config.enabled,
      baseUrl: config.baseUrl
    }));
  }

  /**
   * Test connection to insurance provider
   */
  async testProviderConnection(providerId) {
    const provider = this.providers.get(providerId);
    if (!provider) {
      return {
        success: false,
        error: `Provider ${providerId} not found`
      };
    }

    try {
      const startTime = Date.now();
      await this.getAccessToken(providerId);
      const responseTime = Date.now() - startTime;

      return {
        success: true,
        provider: provider.name,
        status: 'connected',
        responseTime: `${responseTime}ms`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        success: false,
        provider: provider.name,
        status: 'disconnected',
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Test all provider connections
   */
  async testAllConnections() {
    const results = [];
    
    for (const [providerId] of this.providers) {
      const result = await this.testProviderConnection(providerId);
      results.push(result);
    }

    return results;
  }

  /**
   * Get integration health status
   */
  async getIntegrationHealth() {
    const connections = await this.testAllConnections();
    const healthyCount = connections.filter(c => c.success).length;
    const totalCount = connections.length;

    return {
      status: healthyCount === totalCount ? 'healthy' : 
              healthyCount > 0 ? 'degraded' : 'unhealthy',
      totalProviders: totalCount,
      healthyProviders: healthyCount,
      connections,
      timestamp: new Date().toISOString()
    };
  }
}

// Export singleton instance
const insuranceIntegrationService = new InsuranceIntegrationService();
module.exports = { InsuranceIntegrationService, insuranceIntegrationService };
