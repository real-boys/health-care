const TransformationEngine = require('../services/transformationEngine');

/**
 * Request/Response Transformation Middleware
 * Handles data formatting and field mapping for API requests and responses
 */
class TransformationMiddleware {
  constructor() {
    this.transformationEngine = new TransformationEngine();
    this.initialize();
  }

  async initialize() {
    await this.transformationEngine.loadTransformations();
    console.log('✅ Transformation Middleware initialized');
  }

  /**
   * Transform incoming request data
   * @param {string} transformationName - Name of transformation rule
   * @param {object} options - Transformation options
   */
  transformRequest(transformationName, options = {}) {
    return (req, res, next) => {
      try {
        if (req.body && Object.keys(req.body).length > 0) {
          const transformedData = this.transformationEngine.transform(
            'request',
            transformationName,
            req.body,
            options
          );
          
          // Replace original body with transformed data
          req.originalBody = { ...req.body };
          req.body = transformedData;
          
          // Add transformation metadata
          req.transformation = {
            type: 'request',
            name: transformationName,
            options,
            timestamp: new Date()
          };
        }
        
        next();
      } catch (error) {
        console.error('Request transformation error:', error);
        res.status(400).json({
          error: 'Request transformation failed',
          details: error.message
        });
      }
    };
  }

  /**
   * Transform outgoing response data
   * @param {string} transformationName - Name of transformation rule
   * @param {object} options - Transformation options
   */
  transformResponse(transformationName, options = {}) {
    return (req, res, next) => {
      // Store original res.json method
      const originalJson = res.json;
      
      // Override res.json to transform response data
      res.json = function(data) {
        try {
          if (data && typeof data === 'object') {
            const transformedData = this.transformationEngine.transform(
              'response',
              transformationName,
              data,
              options
            );
            
            // Add transformation metadata if requested
            if (options.includeMetadata) {
              transformedData._transformation = {
                type: 'response',
                name: transformationName,
                options,
                timestamp: new Date()
              };
            }
            
            return originalJson.call(this, transformedData);
          }
          
          return originalJson.call(this, data);
        } catch (error) {
          console.error('Response transformation error:', error);
          return originalJson.call(this, {
            error: 'Response transformation failed',
            details: error.message,
            originalData: data
          });
        }
      }.bind({ transformationEngine: this.transformationEngine });
      
      next();
    };
  }

  /**
   * Transform both request and response
   * @param {string} requestTransformation - Request transformation name
   * @param {string} responseTransformation - Response transformation name
   * @param {object} options - Transformation options
   */
  transformBoth(requestTransformation, responseTransformation, options = {}) {
    return [
      this.transformRequest(requestTransformation, options.request || {}),
      this.transformResponse(responseTransformation, options.response || {})
    ];
  }

  /**
   * Field validation middleware
   * @param {object} schema - Validation schema
   * @param {object} options - Validation options
   */
  validateFields(schema, options = {}) {
    return (req, res, next) => {
      try {
        const errors = this.transformationEngine.validate(req.body, schema, options);
        
        if (errors.length > 0) {
          return res.status(400).json({
            error: 'Validation failed',
            details: errors
          });
        }
        
        req.validation = {
          passed: true,
          schema,
          options
        };
        
        next();
      } catch (error) {
        console.error('Field validation error:', error);
        res.status(500).json({
          error: 'Validation error',
          details: error.message
        });
      }
    };
  }

  /**
   * Data normalization middleware
   * @param {string} normalizer - Normalizer name
   * @param {object} options - Normalization options
   */
  normalizeData(normalizer, options = {}) {
    return (req, res, next) => {
      try {
        if (req.body && Object.keys(req.body).length > 0) {
          const normalizedData = this.transformationEngine.normalize(
            normalizer,
            req.body,
            options
          );
          
          req.originalBody = { ...req.body };
          req.body = normalizedData;
          
          req.normalization = {
            type: normalizer,
            options,
            timestamp: new Date()
          };
        }
        
        next();
      } catch (error) {
        console.error('Data normalization error:', error);
        res.status(400).json({
          error: 'Data normalization failed',
          details: error.message
        });
      }
    };
  }

  /**
   * Format response based on accept header
   */
  formatResponse() {
    return (req, res, next) => {
      const acceptHeader = req.headers.accept || 'application/json';
      
      // Store original res methods
      const originalJson = res.json;
      const originalSend = res.send;
      
      // Override methods based on accept type
      if (acceptHeader.includes('application/xml')) {
        res.json = function(data) {
          res.type('application/xml');
          const xml = this.transformationEngine.toXML(data);
          return originalSend.call(this, xml);
        }.bind({ transformationEngine: this.transformationEngine });
      } else if (acceptHeader.includes('text/csv')) {
        res.json = function(data) {
          res.type('text/csv');
          const csv = this.transformationEngine.toCSV(data);
          return originalSend.call(this, csv);
        }.bind({ transformationEngine: this.transformationEngine });
      } else if (acceptHeader.includes('application/pdf')) {
        res.json = function(data) {
          const pdf = this.transformationEngine.toPDF(data);
          res.type('application/pdf');
          return originalSend.call(this, pdf);
        }.bind({ transformationEngine: this.transformationEngine });
      }
      
      next();
    };
  }

  /**
   * Add transformation metadata to request
   */
  addMetadata(metadata = {}) {
    return (req, res, next) => {
      req.metadata = {
        ...metadata,
        timestamp: new Date(),
        requestId: req.headers['x-request-id'] || generateRequestId(),
        userAgent: req.headers['user-agent'],
        ip: req.ip || req.connection.remoteAddress
      };
      next();
    };
  }

  /**
   * Log transformation details
   */
  logTransformation() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // Override res.end to log transformation details
      const originalEnd = res.end;
      res.end = function(...args) {
        const endTime = Date.now();
        const duration = endTime - startTime;
        
        const logData = {
          requestId: req.metadata?.requestId,
          method: req.method,
          url: req.url,
          transformation: req.transformation,
          normalization: req.normalization,
          validation: req.validation,
          statusCode: res.statusCode,
          duration,
          timestamp: new Date()
        };
        
        console.log('Transformation Log:', JSON.stringify(logData, null, 2));
        
        return originalEnd.apply(this, args);
      };
      
      next();
    };
  }
}

/**
 * Generate unique request ID
 */
function generateRequestId() {
  return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

module.exports = new TransformationMiddleware();
