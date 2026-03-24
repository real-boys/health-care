/**
 * OCR Service for Document Processing
 * Implements optical character recognition for medical documents
 */

const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

class OCRService {
  constructor() {
    this.config = {
      // Configuration for different OCR providers
      providers: {
        tesseract: {
          enabled: true,
          engine: 'tesseract'
        },
        googleVision: {
          enabled: false,
          apiKey: process.env.GOOGLE_VISION_API_KEY,
          endpoint: 'https://vision.googleapis.com/v1/images:annotate'
        },
        azureOCR: {
          enabled: false,
          apiKey: process.env.AZURE_OCR_API_KEY,
          endpoint: process.env.AZURE_OCR_ENDPOINT
        }
      },
      defaultProvider: 'tesseract',
      confidenceThreshold: 0.7
    };
    
    this.initializeOCR();
  }

  /**
   * Initialize OCR service
   */
  async initializeOCR() {
    try {
      // Check if Tesseract is available
      const { exec } = require('child_process');
      const { promisify } = require('util');
      const execAsync = promisify(exec);
      
      try {
        await execAsync('tesseract --version');
        console.log('Tesseract OCR is available');
      } catch (error) {
        console.warn('Tesseract OCR not available, falling back to mock implementation');
        this.config.providers.tesseract.enabled = false;
      }
    } catch (error) {
      console.warn('OCR initialization failed:', error.message);
    }
  }

  /**
   * Process a document and extract text
   */
  async processDocument(document) {
    const { filePath, type, metadata = {} } = document;
    
    try {
      // Validate document
      await this.validateDocument(filePath);
      
      // Extract text using appropriate OCR provider
      const extractedText = await this.extractText(filePath, type);
      
      // Parse and structure the extracted data
      const structuredData = await this.parseExtractedData(extractedText, type, metadata);
      
      // Validate extracted data
      const validation = await this.validateExtractedData(structuredData);
      
      return {
        documentId: document.id || this.generateDocumentId(),
        type,
        extractedText,
        structuredData,
        validation,
        processedAt: new Date().toISOString(),
        confidence: this.calculateConfidence(extractedText, structuredData)
      };
      
    } catch (error) {
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Extract text from document using OCR
   */
  async extractText(filePath, documentType) {
    const provider = this.selectOCRProvider();
    
    switch (provider) {
      case 'tesseract':
        return await this.extractWithTesseract(filePath);
      case 'googleVision':
        return await this.extractWithGoogleVision(filePath);
      case 'azureOCR':
        return await this.extractWithAzureOCR(filePath);
      default:
        return await this.mockExtraction(filePath, documentType);
    }
  }

  /**
   * Extract text using Tesseract OCR
   */
  async extractWithTesseract(filePath) {
    const { exec } = require('child_process');
    const { promisify } = require('util');
    const execAsync = promisify(exec);
    
    try {
      const { stdout } = await execAsync(`tesseract "${filePath}" stdout -l eng`);
      return stdout.trim();
    } catch (error) {
      throw new Error(`Tesseract OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract text using Google Vision API
   */
  async extractWithGoogleVision(filePath) {
    try {
      const imageBuffer = await fs.readFile(filePath);
      const imageBase64 = imageBuffer.toString('base64');
      
      const response = await axios.post(
        this.config.providers.googleVision.endpoint,
        {
          requests: [{
            image: {
              content: imageBase64
            },
            features: [{
              type: 'TEXT_DETECTION',
              maxResults: 10
            }]
          }]
        },
        {
          headers: {
            'Authorization': `Bearer ${this.config.providers.googleVision.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      const annotations = response.data.responses[0].textAnnotations;
      return annotations[0].description;
      
    } catch (error) {
      throw new Error(`Google Vision OCR failed: ${error.message}`);
    }
  }

  /**
   * Extract text using Azure OCR
   */
  async extractWithAzureOCR(filePath) {
    try {
      const imageBuffer = await fs.readFile(filePath);
      
      const response = await axios.post(
        `${this.config.providers.azureOCR.endpoint}/vision/v3.2/ocr`,
        imageBuffer,
        {
          headers: {
            'Ocp-Apim-Subscription-Key': this.config.providers.azureOCR.apiKey,
            'Content-Type': 'application/octet-stream'
          },
          params: {
            language: 'en',
            detectOrientation: true
          }
        }
      );
      
      const regions = response.data.regions;
      let extractedText = '';
      
      regions.forEach(region => {
        region.lines.forEach(line => {
          extractedText += line.words.map(word => word.text).join(' ') + '\n';
        });
      });
      
      return extractedText.trim();
      
    } catch (error) {
      throw new Error(`Azure OCR failed: ${error.message}`);
    }
  }

  /**
   * Mock extraction for testing/demo purposes
   */
  async mockExtraction(filePath, documentType) {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const mockTexts = {
      'medical_bill': `
        MEDICAL BILL
        ============
        Patient Name: John Doe
        Patient ID: 123456
        Date of Service: 2024-01-15
        
        Provider: General Hospital
        Address: 123 Medical St, Healthcare City, ST 12345
        
        Services Rendered:
        - Office Visit (CPT: 99213) - $150.00
        - Blood Test (CPT: 36415) - $25.00
        - X-Ray (CPT: 71045) - $200.00
        
        Diagnosis Codes:
        - ICD-10: Z00.00 (Encounter for general adult medical exam)
        - ICD-10: R06.02 (Shortness of breath)
        
        Total Amount: $375.00
        Insurance Amount: $300.00
        Patient Responsibility: $75.00
      `,
      'explanation_of_benefits': `
        EXPLANATION OF BENEFITS
        =====================
        Claim Number: CLM-2024-001234
        Patient: John Doe
        Member ID: INS-789012
        
        Provider: General Hospital
        Service Date: 2024-01-15
        
        Billed Amount: $375.00
        Allowed Amount: $300.00
        Paid Amount: $240.00
        Patient Responsibility: $60.00
        
        Status: APPROVED
        Payment Date: 2024-02-01
      `,
      'prescription': `
        PRESCRIPTION
        ===========
        Patient: John Doe
        DOB: 1980-01-01
        Prescriber: Dr. Jane Smith
        
        Medication: Amoxicillin 500mg
        Dosage: 1 tablet 3 times daily
        Quantity: 30 tablets
        Refills: 0
        
        Date Prescribed: 2024-01-15
      `,
      'lab_result': `
        LABORATORY RESULTS
        ==================
        Patient: John Doe
        ID: 123456
        Collection Date: 2024-01-15
        Reporting Date: 2024-01-16
        
        Complete Blood Count:
        WBC: 7.5 x10^9/L (Normal: 4.5-11.0)
        RBC: 4.8 x10^12/L (Normal: 4.2-5.4)
        Hemoglobin: 14.5 g/dL (Normal: 13.5-17.5)
        Hematocrit: 43.2% (Normal: 41.0-50.0)
        Platelets: 250 x10^9/L (Normal: 150-450)
        
        All results within normal limits.
      `
    };
    
    return mockTexts[documentType] || mockTexts['medical_bill'];
  }

  /**
   * Parse extracted text into structured data
   */
  async parseExtractedData(extractedText, documentType, metadata) {
    const parser = this.getParser(documentType);
    return await parser.parse(extractedText, metadata);
  }

  /**
   * Get appropriate parser for document type
   */
  getParser(documentType) {
    const parsers = {
      'medical_bill': new MedicalBillParser(),
      'explanation_of_benefits': new EOBParser(),
      'prescription': new PrescriptionParser(),
      'lab_result': new LabResultParser(),
      'default': new GenericDocumentParser()
    };
    
    return parsers[documentType] || parsers['default'];
  }

  /**
   * Validate extracted data
   */
  async validateExtractedData(structuredData) {
    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
      missingFields: []
    };
    
    // Check required fields
    const requiredFields = ['patientName', 'serviceDate', 'totalAmount'];
    for (const field of requiredFields) {
      if (!structuredData[field]) {
        validation.missingFields.push(field);
        validation.isValid = false;
      }
    }
    
    // Validate data formats
    if (structuredData.serviceDate && !this.isValidDate(structuredData.serviceDate)) {
      validation.errors.push('Invalid service date format');
      validation.isValid = false;
    }
    
    if (structuredData.totalAmount && !this.isValidAmount(structuredData.totalAmount)) {
      validation.errors.push('Invalid total amount format');
      validation.isValid = false;
    }
    
    return validation;
  }

  /**
   * Select OCR provider based on configuration and availability
   */
  selectOCRProvider() {
    for (const [provider, config] of Object.entries(this.config.providers)) {
      if (config.enabled) {
        return provider;
      }
    }
    
    return 'mock'; // Fallback to mock
  }

  /**
   * Validate document file
   */
  async validateDocument(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const maxSize = 10 * 1024 * 1024; // 10MB
      
      if (stats.size > maxSize) {
        throw new Error('File size exceeds maximum limit (10MB)');
      }
      
      const ext = path.extname(filePath).toLowerCase();
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf', '.tiff', '.bmp'];
      
      if (!allowedExtensions.includes(ext)) {
        throw new Error(`Unsupported file type: ${ext}`);
      }
      
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error('File not found');
      }
      throw error;
    }
  }

  /**
   * Calculate confidence score for extraction
   */
  calculateConfidence(extractedText, structuredData) {
    let confidence = 0.5; // Base confidence
    
    // Increase confidence based on text quality
    if (extractedText.length > 100) confidence += 0.1;
    if (extractedText.includes('Patient') && extractedText.includes('Date')) confidence += 0.1;
    
    // Increase confidence based on structured data quality
    if (structuredData.patientName) confidence += 0.1;
    if (structuredData.serviceDate) confidence += 0.1;
    if (structuredData.totalAmount) confidence += 0.1;
    
    return Math.min(confidence, 1.0);
  }

  /**
   * Validation helpers
   */
  isValidDate(dateString) {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  }

  isValidAmount(amountString) {
    const amount = parseFloat(amountString.replace(/[^0-9.-]/g, ''));
    return !isNaN(amount) && amount >= 0;
  }

  /**
   * Generate document ID
   */
  generateDocumentId() {
    return `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Batch process multiple documents
   */
  async batchProcessDocuments(documents) {
    const results = [];
    
    for (const document of documents) {
      try {
        const result = await this.processDocument(document);
        results.push(result);
      } catch (error) {
        results.push({
          documentId: document.id || 'unknown',
          error: error.message,
          processedAt: new Date().toISOString()
        });
      }
    }
    
    return results;
  }

  /**
   * Get OCR service statistics
   */
  getStatistics() {
    return {
      config: this.config,
      supportedProviders: Object.keys(this.config.providers),
      defaultProvider: this.config.defaultProvider,
      confidenceThreshold: this.config.confidenceThreshold
    };
  }
}

/**
 * Document Parsers
 */

class MedicalBillParser {
  async parse(text, metadata) {
    const data = {};
    
    // Extract patient information
    const patientMatch = text.match(/Patient Name:\s*(.+?)(?:\n|$)/);
    if (patientMatch) data.patientName = patientMatch[1].trim();
    
    const patientIdMatch = text.match(/Patient ID:\s*(.+?)(?:\n|$)/);
    if (patientIdMatch) data.patientId = patientIdMatch[1].trim();
    
    // Extract service date
    const dateMatch = text.match(/Date of Service:\s*(.+?)(?:\n|$)/);
    if (dateMatch) data.serviceDate = dateMatch[1].trim();
    
    // Extract provider information
    const providerMatch = text.match(/Provider:\s*(.+?)(?:\n|$)/);
    if (providerMatch) data.providerName = providerMatch[1].trim();
    
    // Extract total amount
    const totalMatch = text.match(/Total Amount:\s*\$?([\d,]+\.?\d*)/);
    if (totalMatch) data.totalAmount = totalMatch[1].replace(',', '');
    
    // Extract insurance amount
    const insuranceMatch = text.match(/Insurance Amount:\s*\$?([\d,]+\.?\d*)/);
    if (insuranceMatch) data.insuranceAmount = insuranceMatch[1].replace(',', '');
    
    // Extract patient responsibility
    const patientRespMatch = text.match(/Patient Responsibility:\s*\$?([\d,]+\.?\d*)/);
    if (patientRespMatch) data.patientResponsibility = patientRespMatch[1].replace(',', '');
    
    // Extract diagnosis codes
    const diagnosisMatch = text.match(/Diagnosis Codes:\s*([\s\S]*?)(?:\n\n|\n[A-Z]|\n$)/);
    if (diagnosisMatch) {
      data.diagnosisCodes = diagnosisMatch[1]
        .split('\n')
        .map(line => line.replace(/.*ICD-10:\s*([A-Z]\d{2}\.?\d*).*/, '$1'))
        .filter(code => /^[A-Z]\d{2}/.test(code))
        .join(', ');
    }
    
    // Extract procedure codes
    const procedureMatch = text.match(/Services Rendered:([\s\S]*?)(?:\n\n|\n[A-Z]|\n$)/);
    if (procedureMatch) {
      data.procedureCodes = procedureMatch[1]
        .split('\n')
        .map(line => line.match(/CPT:\s*(\d{5})/))
        .filter(match => match)
        .map(match => match[1])
        .join(', ');
    }
    
    return data;
  }
}

class EOBParser {
  async parse(text, metadata) {
    const data = {};
    
    // Extract claim number
    const claimMatch = text.match(/Claim Number:\s*(.+?)(?:\n|$)/);
    if (claimMatch) data.claimNumber = claimMatch[1].trim();
    
    // Extract patient information
    const patientMatch = text.match(/Patient:\s*(.+?)(?:\n|$)/);
    if (patientMatch) data.patientName = patientMatch[1].trim();
    
    // Extract service date
    const dateMatch = text.match(/Service Date:\s*(.+?)(?:\n|$)/);
    if (dateMatch) data.serviceDate = dateMatch[1].trim();
    
    // Extract amounts
    const billedMatch = text.match(/Billed Amount:\s*\$?([\d,]+\.?\d*)/);
    if (billedMatch) data.billedAmount = billedMatch[1].replace(',', '');
    
    const paidMatch = text.match(/Paid Amount:\s*\$?([\d,]+\.?\d*)/);
    if (paidMatch) data.paidAmount = paidMatch[1].replace(',', '');
    
    // Extract status
    const statusMatch = text.match(/Status:\s*(.+?)(?:\n|$)/);
    if (statusMatch) data.status = statusMatch[1].trim();
    
    return data;
  }
}

class PrescriptionParser {
  async parse(text, metadata) {
    const data = {};
    
    // Extract patient information
    const patientMatch = text.match(/Patient:\s*(.+?)(?:\n|$)/);
    if (patientMatch) data.patientName = patientMatch[1].trim();
    
    // Extract medication
    const medicationMatch = text.match(/Medication:\s*(.+?)(?:\n|$)/);
    if (medicationMatch) data.medication = medicationMatch[1].trim();
    
    // Extract dosage
    const dosageMatch = text.match(/Dosage:\s*(.+?)(?:\n|$)/);
    if (dosageMatch) data.dosage = dosageMatch[1].trim();
    
    // Extract prescribed date
    const dateMatch = text.match(/Date Prescribed:\s*(.+?)(?:\n|$)/);
    if (dateMatch) data.prescribedDate = dateMatch[1].trim();
    
    return data;
  }
}

class LabResultParser {
  async parse(text, metadata) {
    const data = {};
    
    // Extract patient information
    const patientMatch = text.match(/Patient:\s*(.+?)(?:\n|$)/);
    if (patientMatch) data.patientName = patientMatch[1].trim();
    
    // Extract collection date
    const dateMatch = text.match(/Collection Date:\s*(.+?)(?:\n|$)/);
    if (dateMatch) data.collectionDate = dateMatch[1].trim();
    
    // Extract test results (simplified)
    const results = [];
    const lines = text.split('\n');
    for (const line of lines) {
      const testMatch = line.match(/(\w+):\s*([\d.]+)\s*(.+?)(?:\s*\(|$)/);
      if (testMatch) {
        results.push({
          testName: testMatch[1],
          value: testMatch[2],
          unit: testMatch[3].trim()
        });
      }
    }
    data.testResults = results;
    
    return data;
  }
}

class GenericDocumentParser {
  async parse(text, metadata) {
    // Basic text extraction and cleanup
    return {
      rawText: text.trim(),
      wordCount: text.split(/\s+/).length,
      lineCount: text.split('\n').length
    };
  }
}

module.exports = OCRService;
