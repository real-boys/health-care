/**
 * Rule Engine for Automated Claim Processing
 * Implements business rules for claim validation and processing
 */

class RuleEngine {
  constructor() {
    this.rules = new Map();
    this.initializeDefaultRules();
  }

  /**
   * Initialize default claim processing rules
   */
  initializeDefaultRules() {
    // Rule: Claim amount validation
    this.addRule('claim_amount_validation', {
      condition: (claim) => {
        return claim.totalAmount > 0 && claim.totalAmount <= 100000;
      },
      action: (claim) => {
        return {
          valid: claim.totalAmount > 0 && claim.totalAmount <= 100000,
          message: claim.totalAmount > 100000 ? 
            'Claim amount exceeds maximum limit of $100,000' : 
            'Claim amount is valid',
          severity: claim.totalAmount > 100000 ? 'high' : 'low'
        };
      }
    });

    // Rule: Service date validation
    this.addRule('service_date_validation', {
      condition: (claim) => {
        const serviceDate = new Date(claim.serviceDate);
        const today = new Date();
        const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        
        return serviceDate <= today && serviceDate >= oneYearAgo;
      },
      action: (claim) => {
        const serviceDate = new Date(claim.serviceDate);
        const today = new Date();
        const oneYearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
        
        if (serviceDate > today) {
          return {
            valid: false,
            message: 'Service date cannot be in the future',
            severity: 'high'
          };
        }
        
        if (serviceDate < oneYearAgo) {
          return {
            valid: false,
            message: 'Service date is too old (older than 1 year)',
            severity: 'medium'
          };
        }
        
        return {
          valid: true,
          message: 'Service date is valid',
          severity: 'low'
        };
      }
    });

    // Rule: Required fields validation
    this.addRule('required_fields_validation', {
      condition: (claim) => {
        const requiredFields = ['patientId', 'providerName', 'diagnosisCodes', 'procedureCodes'];
        return requiredFields.every(field => claim[field] && claim[field].trim() !== '');
      },
      action: (claim) => {
        const requiredFields = ['patientId', 'providerName', 'diagnosisCodes', 'procedureCodes'];
        const missingFields = requiredFields.filter(field => !claim[field] || claim[field].trim() === '');
        
        return {
          valid: missingFields.length === 0,
          message: missingFields.length === 0 ? 
            'All required fields are present' : 
            `Missing required fields: ${missingFields.join(', ')}`,
          severity: missingFields.length > 0 ? 'high' : 'low',
          missingFields
        };
      }
    });

    // Rule: Diagnosis code validation
    this.addRule('diagnosis_code_validation', {
      condition: (claim) => {
        if (!claim.diagnosisCodes) return false;
        const codes = claim.diagnosisCodes.split(',').map(code => code.trim());
        return codes.every(code => /^[A-Z]\d{2}\.?\d*$/.test(code));
      },
      action: (claim) => {
        if (!claim.diagnosisCodes) {
          return {
            valid: false,
            message: 'Diagnosis codes are required',
            severity: 'high'
          };
        }
        
        const codes = claim.diagnosisCodes.split(',').map(code => code.trim());
        const invalidCodes = codes.filter(code => !/^[A-Z]\d{2}\.?\d*$/.test(code));
        
        return {
          valid: invalidCodes.length === 0,
          message: invalidCodes.length === 0 ? 
            'All diagnosis codes are valid' : 
            `Invalid diagnosis codes: ${invalidCodes.join(', ')}`,
          severity: invalidCodes.length > 0 ? 'medium' : 'low',
          invalidCodes
        };
      }
    });

    // Rule: Procedure code validation
    this.addRule('procedure_code_validation', {
      condition: (claim) => {
        if (!claim.procedureCodes) return false;
        const codes = claim.procedureCodes.split(',').map(code => code.trim());
        return codes.every(code => /^\d{5}$/.test(code));
      },
      action: (claim) => {
        if (!claim.procedureCodes) {
          return {
            valid: false,
            message: 'Procedure codes are required',
            severity: 'high'
          };
        }
        
        const codes = claim.procedureCodes.split(',').map(code => code.trim());
        const invalidCodes = codes.filter(code => !/^\d{5}$/.test(code));
        
        return {
          valid: invalidCodes.length === 0,
          message: invalidCodes.length === 0 ? 
            'All procedure codes are valid' : 
            `Invalid procedure codes: ${invalidCodes.join(', ')}`,
          severity: invalidCodes.length > 0 ? 'medium' : 'low',
          invalidCodes
        };
      }
    });

    // Rule: Duplicate claim check
    this.addRule('duplicate_claim_check', {
      condition: async (claim) => {
        // This would typically check against database
        // For now, we'll implement a simple check
        return true; // Placeholder
      },
      action: async (claim) => {
        // This would check for duplicate claims in the database
        return {
          valid: true, // Placeholder
          message: 'No duplicate claims found',
          severity: 'low'
        };
      }
    });

    // Rule: Coverage validation
    this.addRule('coverage_validation', {
      condition: (claim) => {
        // Simplified coverage check
        return claim.insuranceAmount >= 0 && claim.patientResponsibility >= 0;
      },
      action: (claim) => {
        const totalAllocated = (parseFloat(claim.insuranceAmount) || 0) + 
                              (parseFloat(claim.patientResponsibility) || 0);
        const totalAmount = parseFloat(claim.totalAmount) || 0;
        
        if (Math.abs(totalAllocated - totalAmount) > 0.01) {
          return {
            valid: false,
            message: `Insurance amount (${claim.insuranceAmount}) and patient responsibility (${claim.patientResponsibility}) must sum to total amount (${claim.totalAmount})`,
            severity: 'high'
          };
        }
        
        return {
          valid: true,
          message: 'Coverage allocation is valid',
          severity: 'low'
        };
      }
    });
  }

  /**
   * Add a new rule to the engine
   */
  addRule(name, rule) {
    this.rules.set(name, rule);
  }

  /**
   * Remove a rule from the engine
   */
  removeRule(name) {
    this.rules.delete(name);
  }

  /**
   * Evaluate a claim against all applicable rules
   */
  async evaluateClaim(claim) {
    const results = [];
    let overallValid = true;
    let highestSeverity = 'low';

    for (const [ruleName, rule] of this.rules) {
      try {
        const conditionMet = await rule.condition(claim);
        
        if (conditionMet) {
          const result = await rule.action(claim);
          results.push({
            rule: ruleName,
            ...result
          });

          if (!result.valid) {
            overallValid = false;
          }

          // Update highest severity
          const severityLevels = { low: 1, medium: 2, high: 3 };
          if (severityLevels[result.severity] > severityLevels[highestSeverity]) {
            highestSeverity = result.severity;
          }
        }
      } catch (error) {
        results.push({
          rule: ruleName,
          valid: false,
          message: `Rule evaluation error: ${error.message}`,
          severity: 'high'
        });
        overallValid = false;
        highestSeverity = 'high';
      }
    }

    return {
      claimId: claim.id || claim.claimNumber,
      valid: overallValid,
      severity: highestSeverity,
      results,
      evaluatedAt: new Date().toISOString()
    };
  }

  /**
   * Get rule statistics
   */
  getRuleStatistics() {
    return {
      totalRules: this.rules.size,
      ruleNames: Array.from(this.rules.keys())
    };
  }

  /**
   * Validate rule configuration
   */
  validateRule(rule) {
    const requiredProperties = ['condition', 'action'];
    const missingProperties = requiredProperties.filter(prop => !(prop in rule));
    
    if (missingProperties.length > 0) {
      throw new Error(`Rule missing required properties: ${missingProperties.join(', ')}`);
    }

    if (typeof rule.condition !== 'function') {
      throw new Error('Rule condition must be a function');
    }

    if (typeof rule.action !== 'function') {
      throw new Error('Rule action must be a function');
    }

    return true;
  }
}

module.exports = RuleEngine;
