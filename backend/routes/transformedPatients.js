const express = require('express');
const router = express.Router();
const transformationMiddleware = require('../middleware/transformationMiddleware');
const { body, validationResult } = require('express-validator');

/**
 * Patients route with request/response transformation
 */
router.post('/', 
  transformationMiddleware.addMetadata({ endpoint: 'create_patient' }),
  transformationMiddleware.transformRequest('patient_request'),
  transformationMiddleware.validateFields('patient'),
  transformationMiddleware.normalizeData(['email', 'phone']),
  transformationMiddleware.logTransformation(),
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      // Create patient with transformed data
      const patient = {
        id: Date.now(),
        ...req.body,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Simulate saving to database
      console.log('Patient created:', patient);

      res.status(201).json(patient);
    } catch (error) {
      console.error('Error creating patient:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
);

router.get('/',
  transformationMiddleware.addMetadata({ endpoint: 'list_patients' }),
  transformationMiddleware.transformResponse('patient_response', { includeMetadata: true }),
  transformationMiddleware.formatResponse(),
  async (req, res) => {
    try {
      // Simulate fetching patients from database
      const patients = [
        {
          id: 1,
          fullName: 'John Doe',
          email: 'john@example.com',
          dateOfBirth: '1990-01-15',
          phone: '+1234567890',
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            zip: '10001'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        },
        {
          id: 2,
          fullName: 'Jane Smith',
          email: 'jane@example.com',
          dateOfBirth: '1985-05-20',
          phone: '+1987654321',
          address: {
            street: '456 Oak Ave',
            city: 'Los Angeles',
            state: 'CA',
            zip: '90001'
          },
          createdAt: new Date(),
          updatedAt: new Date()
        }
      ];

      res.json(patients);
    } catch (error) {
      console.error('Error fetching patients:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
);

router.get('/:id',
  transformationMiddleware.addMetadata({ endpoint: 'get_patient' }),
  transformationMiddleware.transformResponse('patient_response'),
  transformationMiddleware.formatResponse(),
  async (req, res) => {
    try {
      const { id } = req.params;
      
      // Simulate fetching patient from database
      const patient = {
        id: parseInt(id),
        fullName: 'John Doe',
        email: 'john@example.com',
        dateOfBirth: '1990-01-15',
        phone: '+1234567890',
        address: {
          street: '123 Main St',
          city: 'New York',
          state: 'NY',
          zip: '10001'
        },
        createdAt: new Date(),
        updatedAt: new Date(),
        password: 'secret123', // This will be excluded by transformation
        ssn: '123-45-6789' // This will be excluded by transformation
      };

      res.json(patient);
    } catch (error) {
      console.error('Error fetching patient:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
);

router.put('/:id',
  transformationMiddleware.addMetadata({ endpoint: 'update_patient' }),
  transformationMiddleware.transformRequest('patient_request'),
  transformationMiddleware.validateFields('patient'),
  transformationMiddleware.normalizeData(['email', 'phone']),
  transformationMiddleware.transformResponse('patient_response'),
  transformationMiddleware.logTransformation(),
  async (req, res) => {
    try {
      // Check validation results
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          error: 'Validation failed',
          details: errors.array()
        });
      }

      const { id } = req.params;
      
      // Simulate updating patient in database
      const patient = {
        id: parseInt(id),
        ...req.body,
        updatedAt: new Date()
      };

      console.log('Patient updated:', patient);

      res.json(patient);
    } catch (error) {
      console.error('Error updating patient:', error);
      res.status(500).json({
        error: 'Internal server error',
        details: error.message
      });
    }
  }
);

module.exports = router;
