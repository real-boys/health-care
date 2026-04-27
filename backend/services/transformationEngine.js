const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const csv = require('csv-parser');
const { Parser } = require('json2csv');
const PDFDocument = require('pdfkit');

class TransformationEngine {
  constructor() {
    this.transformations = new Map();
    this.schemas = new Map();
    this.normalizers = new Map();
    this.transformationsPath = process.env.TRANSFORMATIONS_PATH || path.join(__dirname, '../transformations');
  }

  async loadTransformations() {
    try {
      // Ensure transformations directory exists
      await fs.mkdir(this.transformationsPath, { recursive: true });
      
      // Load transformation rules
      await this.loadTransformationRules();
      await this.loadValidationSchemas();
      await this.loadNormalizers();
      
      console.log(`✅ Loaded ${this.transformations.size} transformations, ${this.schemas.size} schemas, ${this.normalizers.size} normalizers`);
    } catch (error) {
      console.error('❌ Failed to load transformations:', error);
      throw error;
    }
  }

  /**
   * Load transformation rules from files
   */
  async loadTransformationRules() {
    const rulesFile = path.join(this.transformationsPath, 'rules.json');
    
    try {
      const rulesData = await fs.readFile(rulesFile, 'utf8');
      const rules = JSON.parse(rulesData);
      
      for (const [name, rule] of Object.entries(rules)) {
        this.transformations.set(name, rule);
      }
    } catch (error) {
      console.warn('No transformation rules file found, using defaults');
      await this.createDefaultTransformations();
    }
  }

  /**
   * Load validation schemas
   */
  async loadValidationSchemas() {
    const schemasFile = path.join(this.transformationsPath, 'schemas.json');
    
    try {
      const schemasData = await fs.readFile(schemasFile, 'utf8');
      const schemas = JSON.parse(schemasData);
      
      for (const [name, schema] of Object.entries(schemas)) {
        this.schemas.set(name, schema);
      }
    } catch (error) {
      console.warn('No validation schemas file found, using defaults');
      await this.createDefaultSchemas();
    }
  }

  /**
   * Load data normalizers
   */
  async loadNormalizers() {
    const normalizersFile = path.join(this.transformationsPath, 'normalizers.json');
    
    try {
      const normalizersData = await fs.readFile(normalizersFile, 'utf8');
      const normalizers = JSON.parse(normalizersData);
      
      for (const [name, normalizer] of Object.entries(normalizers)) {
        this.normalizers.set(name, normalizer);
      }
    } catch (error) {
      console.warn('No normalizers file found, using defaults');
      await this.createDefaultNormalizers();
    }
  }

  /**
   * Create default transformation rules
   */
  async createDefaultTransformations() {
    const defaultRules = {
      // Patient data transformations
      'patient_request': {
        fieldMappings: {
          'patient_id': 'id',
          'patient_name': 'fullName',
          'patient_dob': 'dateOfBirth',
          'patient_email': 'email',
          'patient_phone': 'phone',
          'patient_address': 'address'
        },
        typeConversions: {
          'dateOfBirth': 'date',
          'createdAt': 'datetime',
          'updatedAt': 'datetime'
        },
        validations: {
          'fullName': 'required|string|max:255',
          'email': 'required|email',
          'dateOfBirth': 'required|date|before:today'
        }
      },
      
      'patient_response': {
        fieldMappings: {
          'id': 'patient_id',
          'fullName': 'patient_name',
          'dateOfBirth': 'patient_dob',
          'email': 'patient_email',
          'phone': 'patient_phone',
          'address': 'patient_address'
        },
        excludeFields: ['password', 'ssn', 'internalNotes'],
        formatDates: ['dateOfBirth', 'createdAt', 'updatedAt']
      },

      // Provider data transformations
      'provider_request': {
        fieldMappings: {
          'provider_id': 'id',
          'provider_name': 'name',
          'specialty': 'specialization',
          'provider_email': 'email',
          'license_number': 'licenseNo'
        },
        typeConversions: {
          'licenseExpiry': 'date',
          'createdAt': 'datetime'
        }
      },

      'provider_response': {
        fieldMappings: {
          'id': 'provider_id',
          'name': 'provider_name',
          'specialization': 'specialty',
          'email': 'provider_email',
          'licenseNo': 'license_number'
        },
        excludeFields: ['internalId', 'adminNotes']
      },

      // Payment data transformations
      'payment_request': {
        fieldMappings: {
          'payment_amount': 'amount',
          'payment_date': 'date',
          'payment_method': 'method',
          'payment_status': 'status'
        },
        typeConversions: {
          'amount': 'decimal',
          'date': 'datetime'
        },
        validations: {
          'amount': 'required|numeric|min:0.01',
          'method': 'required|string|in:stripe,paypal,crypto',
          'status': 'required|string|in:pending,completed,failed'
        }
      },

      'payment_response': {
        fieldMappings: {
          'amount': 'payment_amount',
          'date': 'payment_date',
          'method': 'payment_method',
          'status': 'payment_status'
        },
        formatCurrency: ['amount'],
        formatDates: ['date', 'createdAt']
      },

      // Medical record transformations
      'medical_record_request': {
        fieldMappings: {
          'record_id': 'id',
          'patient_id': 'patientId',
          'record_type': 'type',
          'record_date': 'date',
          'diagnosis': 'diagnosis',
          'treatment': 'treatment'
        },
        typeConversions: {
          'date': 'datetime',
          'createdAt': 'datetime'
        }
      },

      'medical_record_response': {
        fieldMappings: {
          'id': 'record_id',
          'patientId': 'patient_id',
          'type': 'record_type',
          'date': 'record_date',
          'diagnosis': 'diagnosis',
          'treatment': 'treatment'
        },
        excludeFields: ['rawData', 'internalNotes'],
        formatDates: ['date', 'createdAt']
      }
    };

    this.transformations = new Map(Object.entries(defaultRules));
    
    // Save to file
    await fs.writeFile(
      path.join(this.transformationsPath, 'rules.json'),
      JSON.stringify(defaultRules, null, 2)
    );
  }

  /**
   * Create default validation schemas
   */
  async createDefaultSchemas() {
    const defaultSchemas = {
      'patient': {
        type: 'object',
        required: ['fullName', 'email', 'dateOfBirth'],
        properties: {
          fullName: { type: 'string', minLength: 1, maxLength: 255 },
          email: { type: 'string', format: 'email' },
          dateOfBirth: { type: 'string', format: 'date' },
          phone: { type: 'string', pattern: '^[+]?[0-9]{10,15}$' },
          address: { type: 'object' }
        }
      },
      
      'provider': {
        type: 'object',
        required: ['name', 'specialization', 'email'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 255 },
          specialization: { type: 'string' },
          email: { type: 'string', format: 'email' },
          licenseNo: { type: 'string' }
        }
      },
      
      'payment': {
        type: 'object',
        required: ['amount', 'method', 'status'],
        properties: {
          amount: { type: 'number', minimum: 0.01 },
          method: { type: 'string', enum: ['stripe', 'paypal', 'crypto'] },
          status: { type: 'string', enum: ['pending', 'completed', 'failed'] }
        }
      }
    };

    this.schemas = new Map(Object.entries(defaultSchemas));
    
    await fs.writeFile(
      path.join(this.transformationsPath, 'schemas.json'),
      JSON.stringify(defaultSchemas, null, 2)
    );
  }

  /**
   * Create default normalizers
   */
  async createDefaultNormalizers() {
    const defaultNormalizers = {
      'phone': {
        type: 'string',
        pattern: '^[+]?[0-9]{10,15}$',
        normalize: (value) => {
          // Remove all non-numeric characters
          const cleaned = value.replace(/[^0-9+]/g, '');
          // Add +1 if US number without country code
          if (cleaned.length === 10 && !cleaned.startsWith('+')) {
            return `+1${cleaned}`;
          }
          return cleaned;
        }
      },
      
      'email': {
        type: 'string',
        format: 'email',
        normalize: (value) => value.toLowerCase().trim()
      },
      
      'name': {
        type: 'string',
        normalize: (value) => {
          return value.trim().replace(/\s+/g, ' ');
        }
      },
      
      'currency': {
        type: 'number',
        normalize: (value) => {
          if (typeof value === 'string') {
            return parseFloat(value.replace(/[^0-9.-]/g, ''));
          }
          return value;
        }
      },
      
      'date': {
        type: 'string',
        format: 'date',
        normalize: (value) => {
          if (value instanceof Date) {
            return value.toISOString().split('T')[0];
          }
          return value;
        }
      },
      
      'datetime': {
        type: 'string',
        format: 'date-time',
        normalize: (value) => {
          if (value instanceof Date) {
            return value.toISOString();
          }
          return value;
        }
      }
    };

    this.normalizers = new Map(Object.entries(defaultNormalizers));
    
    await fs.writeFile(
      path.join(this.transformationsPath, 'normalizers.json'),
      JSON.stringify(defaultNormalizers, null, 2)
    );
  }

  /**
   * Transform data
   * @param {string} type - Transformation type (request/response)
   * @param {string} name - Transformation name
   * @param {object} data - Data to transform
   * @param {object} options - Transformation options
   */
  transform(type, name, data, options = {}) {
    const transformationKey = `${type}_${name}`;
    const transformation = this.transformations.get(transformationKey);
    
    if (!transformation) {
      console.warn(`Transformation ${transformationKey} not found, returning original data`);
      return data;
    }

    let transformedData = { ...data };

    // Apply field mappings
    if (transformation.fieldMappings) {
      transformedData = this.applyFieldMappings(transformedData, transformation.fieldMappings);
    }

    // Apply type conversions
    if (transformation.typeConversions) {
      transformedData = this.applyTypeConversions(transformedData, transformation.typeConversions);
    }

    // Apply validations
    if (transformation.validations) {
      const validationErrors = this.validateFields(transformedData, transformation.validations);
      if (validationErrors.length > 0 && !options.skipValidation) {
        throw new Error(`Validation failed: ${validationErrors.join(', ')}`);
      }
    }

    // Exclude fields
    if (transformation.excludeFields) {
      transformedData = this.excludeFields(transformedData, transformation.excludeFields);
    }

    // Format dates
    if (transformation.formatDates) {
      transformedData = this.formatDates(transformedData, transformation.formatDates);
    }

    // Format currency
    if (transformation.formatCurrency) {
      transformedData = this.formatCurrency(transformedData, transformation.formatCurrency);
    }

    return transformedData;
  }

  /**
   * Apply field mappings
   */
  applyFieldMappings(data, mappings) {
    const result = {};
    
    for (const [sourceField, targetField] of Object.entries(mappings)) {
      if (data.hasOwnProperty(sourceField)) {
        result[targetField] = data[sourceField];
      }
    }
    
    // Include fields not in mapping
    for (const [key, value] of Object.entries(data)) {
      if (!mappings.hasOwnProperty(key)) {
        result[key] = value;
      }
    }
    
    return result;
  }

  /**
   * Apply type conversions
   */
  applyTypeConversions(data, conversions) {
    const result = { ...data };
    
    for (const [field, type] of Object.entries(conversions)) {
      if (result.hasOwnProperty(field)) {
        result[field] = this.convertType(result[field], type);
      }
    }
    
    return result;
  }

  /**
   * Convert data type
   */
  convertType(value, type) {
    switch (type) {
      case 'string':
        return String(value);
      case 'number':
      case 'decimal':
        return Number(value);
      case 'integer':
        return parseInt(value, 10);
      case 'boolean':
        return Boolean(value);
      case 'date':
        return new Date(value).toISOString().split('T')[0];
      case 'datetime':
        return new Date(value).toISOString();
      default:
        return value;
    }
  }

  /**
   * Validate fields
   */
  validateFields(data, validations) {
    const errors = [];
    
    for (const [field, rules] of Object.entries(validations)) {
      const value = data[field];
      const ruleList = rules.split('|');
      
      for (const rule of ruleList) {
        const [ruleName, ...ruleParams] = rule.split(':');
        
        if (!this.validateRule(value, ruleName, ruleParams)) {
          errors.push(`${field} failed ${ruleName} validation`);
        }
      }
    }
    
    return errors;
  }

  /**
   * Validate individual rule
   */
  validateRule(value, rule, params) {
    switch (rule) {
      case 'required':
        return value !== undefined && value !== null && value !== '';
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'string':
        return typeof value === 'string';
      case 'numeric':
        return !isNaN(value);
      case 'min':
        return Number(value) >= Number(params[0]);
      case 'max':
        if (typeof value === 'string') {
          return value.length <= Number(params[0]);
        }
        return Number(value) <= Number(params[0]);
      case 'in':
        return params.includes(value);
      case 'before':
        return new Date(value) < new Date();
      default:
        return true;
    }
  }

  /**
   * Exclude fields from data
   */
  excludeFields(data, excludeFields) {
    const result = { ...data };
    
    for (const field of excludeFields) {
      delete result[field];
    }
    
    return result;
  }

  /**
   * Format dates
   */
  formatDates(data, dateFields) {
    const result = { ...data };
    
    for (const field of dateFields) {
      if (result[field]) {
        result[field] = new Date(result[field]).toLocaleDateString();
      }
    }
    
    return result;
  }

  /**
   * Format currency fields
   */
  formatCurrency(data, currencyFields) {
    const result = { ...data };
    
    for (const field of currencyFields) {
      if (result[field]) {
        result[field] = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD'
        }).format(result[field]);
      }
    }
    
    return result;
  }

  /**
   * Normalize data
   */
  normalize(normalizerName, data, options = {}) {
    const normalizer = this.normalizers.get(normalizerName);
    
    if (!normalizer) {
      console.warn(`Normalizer ${normalizerName} not found`);
      return data;
    }

    const result = { ...data };
    
    for (const [field, value] of Object.entries(result)) {
      if (value !== undefined && value !== null) {
        result[field] = normalizer.normalize(value);
      }
    }
    
    return result;
  }

  /**
   * Validate data against schema
   */
  validate(data, schema, options = {}) {
    const errors = [];
    
    if (schema.required) {
      for (const field of schema.required) {
        if (!data.hasOwnProperty(field) || data[field] === undefined || data[field] === null) {
          errors.push(`${field} is required`);
        }
      }
    }
    
    if (schema.properties) {
      for (const [field, fieldSchema] of Object.entries(schema.properties)) {
        if (data.hasOwnProperty(field)) {
          const value = data[field];
          
          // Type validation
          if (fieldSchema.type && !this.validateType(value, fieldSchema.type)) {
            errors.push(`${field} must be of type ${fieldSchema.type}`);
          }
          
          // Format validation
          if (fieldSchema.format && !this.validateFormat(value, fieldSchema.format)) {
            errors.push(`${field} has invalid format`);
          }
          
          // Enum validation
          if (fieldSchema.enum && !fieldSchema.enum.includes(value)) {
            errors.push(`${field} must be one of: ${fieldSchema.enum.join(', ')}`);
          }
          
          // Length validation
          if (fieldSchema.minLength && value.length < fieldSchema.minLength) {
            errors.push(`${field} must be at least ${fieldSchema.minLength} characters`);
          }
          
          if (fieldSchema.maxLength && value.length > fieldSchema.maxLength) {
            errors.push(`${field} must be at most ${fieldSchema.maxLength} characters`);
          }
          
          // Pattern validation
          if (fieldSchema.pattern && !new RegExp(fieldSchema.pattern).test(value)) {
            errors.push(`${field} has invalid format`);
          }
        }
      }
    }
    
    return errors;
  }

  /**
   * Validate data type
   */
  validateType(value, type) {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }

  /**
   * Validate format
   */
  validateFormat(value, format) {
    switch (format) {
      case 'email':
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      case 'date':
        return !isNaN(Date.parse(value));
      case 'date-time':
        return !isNaN(Date.parse(value));
      default:
        return true;
    }
  }

  /**
   * Convert data to XML
   */
  toXML(data) {
    const builder = new xml2js.Builder({ rootName: 'response' });
    return builder.buildObject(data);
  }

  /**
   * Convert data to CSV
   */
  toCSV(data) {
    if (Array.isArray(data) && data.length > 0) {
      const parser = new Parser();
      return parser.parse(data);
    }
    return '';
  }

  /**
   * Convert data to PDF
   */
  toPDF(data) {
    const doc = new PDFDocument();
    const chunks = [];
    
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => Buffer.concat(chunks));
    
    doc.fontSize(12).text(JSON.stringify(data, null, 2));
    doc.end();
    
    return Buffer.concat(chunks);
  }
}

module.exports = TransformationEngine;
