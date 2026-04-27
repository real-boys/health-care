const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class TaxCalculationService {
  constructor() {
    this.dbPath = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');
    this.db = null;
    this.initialize();
  }

  async initialize() {
    try {
      await this.initializeDatabase();
      console.log('✅ Tax Calculation Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Tax Calculation Service:', error);
      throw error;
    }
  }

  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(this.dbPath, (err) => {
        if (err) {
          reject(err);
        } else {
          console.log('Connected to SQLite database for tax calculations');
          resolve();
        }
      });
    });
  }

  /**
   * Calculate tax for an invoice based on jurisdiction and line items
   * @param {object} taxData - Tax calculation data
   * @param {string} taxData.jurisdictionCode - Tax jurisdiction code
   * @param {Array} taxData.lineItems - Array of line items
   * @param {boolean} taxData.taxExempt - Whether the invoice is tax exempt
   * @param {string} taxData.exemptionReason - Reason for tax exemption
   * @param {Date} taxData.invoiceDate - Date of invoice
   */
  async calculateTax(taxData) {
    const { jurisdictionCode, lineItems, taxExempt, exemptionReason, invoiceDate = new Date() } = taxData;
    
    try {
      // If tax exempt, return zero tax
      if (taxExempt) {
        return {
          taxAmount: 0,
          taxRate: 0,
          jurisdiction: null,
          exemptionReason,
          lineItemTaxes: lineItems.map(item => ({
            ...item,
            taxAmount: 0,
            taxRate: 0
          }))
        };
      }

      // Get tax jurisdiction
      const jurisdiction = await this.getTaxJurisdiction(jurisdictionCode, invoiceDate);
      if (!jurisdiction) {
        throw new Error(`Tax jurisdiction not found for code: ${jurisdictionCode}`);
      }

      // Calculate tax for each line item
      const lineItemTaxes = await Promise.all(
        lineItems.map(item => this.calculateLineItemTax(item, jurisdiction))
      );

      // Calculate total tax
      const totalTax = lineItemTaxes.reduce((sum, item) => sum + item.taxAmount, 0);

      return {
        taxAmount: totalTax,
        taxRate: jurisdiction.tax_rate,
        jurisdiction: {
          id: jurisdiction.id,
          name: jurisdiction.name,
          code: jurisdiction.code,
          taxRate: jurisdiction.tax_rate,
          taxType: jurisdiction.tax_type
        },
        exemptionReason: null,
        lineItemTaxes
      };
    } catch (error) {
      console.error('Error calculating tax:', error);
      throw error;
    }
  }

  /**
   * Calculate tax for a single line item
   * @param {object} lineItem - Line item data
   * @param {object} jurisdiction - Tax jurisdiction
   */
  async calculateLineItemTax(lineItem, jurisdiction) {
    const { quantity, unitPrice, discountPercentage = 0, taxRate: itemTaxRate } = lineItem;
    
    // Calculate line total after discount
    const lineSubtotal = quantity * unitPrice;
    const discountAmount = lineSubtotal * (discountPercentage / 100);
    const taxableAmount = lineSubtotal - discountAmount;
    
    // Use item-specific tax rate if provided, otherwise use jurisdiction rate
    const effectiveTaxRate = itemTaxRate !== undefined ? itemTaxRate : jurisdiction.tax_rate;
    const taxAmount = taxableAmount * effectiveTaxRate;
    
    return {
      ...lineItem,
      taxableAmount,
      taxAmount,
      taxRate: effectiveTaxRate,
      lineTotal: taxableAmount + taxAmount
    };
  }

  /**
   * Get tax jurisdiction by code and date
   * @param {string} code - Jurisdiction code
   * @param {Date} date - Effective date
   */
  async getTaxJurisdiction(code, date = new Date()) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM tax_jurisdictions 
        WHERE code = ? 
        AND is_active = true 
        AND effective_date <= ?
        AND (expiry_date IS NULL OR expiry_date >= ?)
      `;
      
      this.db.get(query, [code, date.toISOString().split('T')[0], date.toISOString().split('T')[0]], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Get all active tax jurisdictions
   */
  async getAllTaxJurisdictions() {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT * FROM tax_jurisdictions 
        WHERE is_active = true 
        ORDER BY country, state_province, name
      `;
      
      this.db.all(query, [], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
  }

  /**
   * Add or update tax jurisdiction
   * @param {object} jurisdictionData - Jurisdiction data
   */
  async upsertTaxJurisdiction(jurisdictionData) {
    const { id, name, code, country, stateProvince, taxRate, taxType, effectiveDate, expiryDate } = jurisdictionData;
    
    try {
      if (id) {
        // Update existing jurisdiction
        return new Promise((resolve, reject) => {
          const query = `
            UPDATE tax_jurisdictions 
            SET name = ?, country = ?, state_province = ?, tax_rate = ?, 
                tax_type = ?, effective_date = ?, expiry_date = ?, updated_at = datetime('now')
            WHERE id = ?
          `;
          
          this.db.run(query, [name, country, stateProvince, taxRate, taxType, effectiveDate, expiryDate, id], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id, changes: this.changes });
            }
          });
        });
      } else {
        // Insert new jurisdiction
        return new Promise((resolve, reject) => {
          const query = `
            INSERT INTO tax_jurisdictions 
            (name, code, country, state_province, tax_rate, tax_type, effective_date, expiry_date)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `;
          
          this.db.run(query, [name, code, country, stateProvince, taxRate, taxType, effectiveDate, expiryDate], function(err) {
            if (err) {
              reject(err);
            } else {
              resolve({ id: this.lastID, changes: this.changes });
            }
          });
        });
      }
    } catch (error) {
      console.error('Error upserting tax jurisdiction:', error);
      throw error;
    }
  }

  /**
   * Determine tax jurisdiction based on address
   * @param {object} address - Address object
   */
  async determineJurisdictionFromAddress(address) {
    const { country, stateProvince, city } = address;
    
    try {
      // Try to find exact match first
      let jurisdiction = await this.getTaxJurisdictionByLocation(country, stateProvince, city);
      
      // If no exact match, try state/province level
      if (!jurisdiction && stateProvince) {
        jurisdiction = await this.getTaxJurisdictionByLocation(country, stateProvince);
      }
      
      // If still no match, try country level
      if (!jurisdiction && country) {
        jurisdiction = await this.getTaxJurisdictionByLocation(country);
      }
      
      return jurisdiction;
    } catch (error) {
      console.error('Error determining jurisdiction from address:', error);
      return null;
    }
  }

  /**
   * Get tax jurisdiction by location
   * @param {string} country - Country code
   * @param {string} stateProvince - State or province
   * @param {string} city - City
   */
  async getTaxJurisdictionByLocation(country, stateProvince = null, city = null) {
    return new Promise((resolve, reject) => {
      let query = `
        SELECT * FROM tax_jurisdictions 
        WHERE country = ? AND is_active = true
      `;
      let params = [country];
      
      if (stateProvince) {
        query += ` AND state_province = ?`;
        params.push(stateProvince);
      }
      
      if (city) {
        query += ` AND (name LIKE ? OR code LIKE ?)`;
        params.push(`%${city}%`, `%${city}%`);
      }
      
      query += ` ORDER BY 
        CASE 
          WHEN state_province IS NOT NULL THEN 1 
          ELSE 2 
        END
        LIMIT 1`;
      
      this.db.get(query, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });
  }

  /**
   * Validate tax calculation for compliance
   * @param {object} calculationResult - Tax calculation result
   */
  async validateTaxCalculation(calculationResult) {
    const { taxAmount, lineItemTaxes, jurisdiction } = calculationResult;
    
    try {
      // Validate that total tax equals sum of line item taxes
      const calculatedTotalTax = lineItemTaxes.reduce((sum, item) => sum + item.taxAmount, 0);
      
      if (Math.abs(taxAmount - calculatedTotalTax) > 0.01) {
        return {
          valid: false,
          errors: [`Total tax amount (${taxAmount}) does not match sum of line item taxes (${calculatedTotalTax})`]
        };
      }
      
      // Validate tax rates
      for (const item of lineItemTaxes) {
        if (item.taxRate < 0 || item.taxRate > 1) {
          return {
            valid: false,
            errors: [`Invalid tax rate (${item.taxRate}) for line item: ${item.description}`]
          };
        }
      }
      
      // Validate jurisdiction
      if (jurisdiction && (jurisdiction.taxRate < 0 || jurisdiction.taxRate > 1)) {
        return {
          valid: false,
          errors: [`Invalid jurisdiction tax rate (${jurisdiction.taxRate}) for ${jurisdiction.name}`]
        };
      }
      
      return { valid: true, errors: [] };
    } catch (error) {
      console.error('Error validating tax calculation:', error);
      return {
        valid: false,
        errors: ['Validation error: ' + error.message]
      };
    }
  }

  /**
   * Get tax summary for reporting
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @param {string} jurisdictionCode - Optional jurisdiction filter
   */
  async getTaxSummary(startDate, endDate, jurisdictionCode = null) {
    try {
      let query = `
        SELECT 
          tj.name as jurisdiction_name,
          tj.code as jurisdiction_code,
          tj.tax_rate,
          SUM(i.tax_amount) as total_tax_collected,
          COUNT(i.id) as invoice_count,
          SUM(i.total_amount) as total_invoice_amount
        FROM invoices i
        JOIN tax_jurisdictions tj ON i.tax_jurisdiction_id = tj.id
        WHERE i.issue_date >= ? AND i.issue_date <= ?
        AND i.status NOT IN ('draft', 'cancelled')
      `;
      
      const params = [startDate.toISOString().split('T')[0], endDate.toISOString().split('T')[0]];
      
      if (jurisdictionCode) {
        query += ` AND tj.code = ?`;
        params.push(jurisdictionCode);
      }
      
      query += ` GROUP BY tj.id, tj.name, tj.code, tj.tax_rate ORDER BY total_tax_collected DESC`;
      
      return new Promise((resolve, reject) => {
        this.db.all(query, params, (err, rows) => {
          if (err) {
            reject(err);
          } else {
            resolve(rows || []);
          }
        });
      });
    } catch (error) {
      console.error('Error getting tax summary:', error);
      throw error;
    }
  }

  /**
   * Check if a customer is tax exempt
   * @param {string} customerId - Customer ID
   * @param {string} jurisdictionCode - Jurisdiction code
   */
  async checkTaxExemption(customerId, jurisdictionCode) {
    try {
      // This would typically integrate with a customer management system
      // For now, we'll implement a basic check based on customer type
      
      // Check if customer is a non-profit organization
      const isNonProfit = await this.checkNonProfitStatus(customerId);
      if (isNonProfit) {
        return {
          exempt: true,
          reason: 'Non-profit organization',
          exemptionCertificate: null
        };
      }
      
      // Check if customer has a valid exemption certificate
      const exemptionCertificate = await this.getExemptionCertificate(customerId, jurisdictionCode);
      if (exemptionCertificate && this.isExemptionCertificateValid(exemptionCertificate)) {
        return {
          exempt: true,
          reason: exemptionCertificate.reason,
          exemptionCertificate: exemptionCertificate.id
        };
      }
      
      return {
        exempt: false,
        reason: null,
        exemptionCertificate: null
      };
    } catch (error) {
      console.error('Error checking tax exemption:', error);
      return {
        exempt: false,
        reason: null,
        exemptionCertificate: null
      };
    }
  }

  /**
   * Check if customer is a non-profit organization
   * @param {string} customerId - Customer ID
   */
  async checkNonProfitStatus(customerId) {
    // This would integrate with customer database
    // For now, return false as default
    return false;
  }

  /**
   * Get exemption certificate for customer
   * @param {string} customerId - Customer ID
   * @param {string} jurisdictionCode - Jurisdiction code
   */
  async getExemptionCertificate(customerId, jurisdictionCode) {
    // This would integrate with exemption certificate database
    // For now, return null as default
    return null;
  }

  /**
   * Check if exemption certificate is valid
   * @param {object} certificate - Exemption certificate
   */
  isExemptionCertificateValid(certificate) {
    if (!certificate) return false;
    
    const now = new Date();
    const expiryDate = new Date(certificate.expiryDate);
    
    return certificate.isActive && now <= expiryDate;
  }

  /**
   * Calculate tax with multiple jurisdictions (for complex scenarios)
   * @param {object} taxData - Tax calculation data with multiple jurisdictions
   */
  async calculateMultiJurisdictionTax(taxData) {
    const { jurisdictions, lineItems, taxExempt } = taxData;
    
    try {
      if (taxExempt) {
        return {
          taxAmount: 0,
          jurisdictions: [],
          lineItemTaxes: lineItems.map(item => ({
            ...item,
            taxAmount: 0,
            taxRate: 0
          }))
        };
      }

      const results = [];
      
      for (const jurisdictionData of jurisdictions) {
        const jurisdiction = await this.getTaxJurisdiction(jurisdictionData.code);
        if (!jurisdiction) continue;
        
        const jurisdictionResult = await this.calculateTax({
          jurisdictionCode: jurisdictionData.code,
          lineItems: lineItems.filter(item => 
            jurisdictionData.itemIds ? jurisdictionData.itemIds.includes(item.id) : true
          ),
          taxExempt: false
        });
        
        results.push(jurisdictionResult);
      }
      
      // Combine results
      const totalTax = results.reduce((sum, result) => sum + result.taxAmount, 0);
      
      return {
        taxAmount: totalTax,
        jurisdictions: results.map(r => r.jurisdiction),
        lineItemTaxes: lineItems.map(item => {
          const itemResults = results.filter(r => 
            r.lineItemTaxes.some(li => li.id === item.id)
          );
          const totalItemTax = itemResults.reduce((sum, r) => {
            const itemTax = r.lineItemTaxes.find(li => li.id === item.id);
            return sum + (itemTax ? itemTax.taxAmount : 0);
          }, 0);
          
          return {
            ...item,
            taxAmount: totalItemTax,
            lineTotal: item.lineTotal + totalItemTax
          };
        })
      };
    } catch (error) {
      console.error('Error calculating multi-jurisdiction tax:', error);
      throw error;
    }
  }
}

module.exports = new TaxCalculationService();
