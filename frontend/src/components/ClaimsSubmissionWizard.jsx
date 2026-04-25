import React, { useState, useRef, useCallback } from 'react';
import {
  FileText,
  User,
  MapPin,
  Calendar,
  DollarSign,
  Upload,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  File,
  Trash2,
  Clock,
  Shield,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import './ClaimsSubmissionWizard.css';

const STEPS = [
  { id: 1, title: 'Claimant Info', icon: User },
  { id: 2, title: 'Incident Details', icon: MapPin },
  { id: 3, title: 'Claim Details', icon: DollarSign },
  { id: 4, title: 'Documents', icon: FileText },
  { id: 5, title: 'Review & Submit', icon: CheckCircle }
];

const CLAIM_TYPES = [
  { value: 'medical', label: 'Medical' },
  { value: 'property', label: 'Property' },
  { value: 'liability', label: 'Liability' },
  { value: 'death', label: 'Death' },
  { value: 'disability', label: 'Disability' }
];

const PRIORITIES = [
  { value: 'low', label: 'Low', color: '#10b981' },
  { value: 'medium', label: 'Medium', color: '#f59e0b' },
  { value: 'high', label: 'High', color: '#ef4444' },
  { value: 'urgent', label: 'Urgent', color: '#dc2626' }
];

const INCIDENT_TYPES = [
  'Accident',
  'Theft',
  'Fire',
  'Water Damage',
  'Medical Emergency',
  'Natural Disaster',
  'Vandalism',
  'Other'
];

const RELATIONSHIPS = [
  { value: 'self', label: 'Self' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'child', label: 'Child' },
  { value: 'parent', label: 'Parent' },
  { value: 'other', label: 'Other' }
];

const ClaimsSubmissionWizard = ({ onSubmit, onCancel, policies = [] }) => {
  const [currentStep, setCurrentStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const fileInputRef = useRef(null);
  
  const [formData, setFormData] = useState({
    policy: '',
    claimant: {
      name: '',
      relationship: 'self',
      contact: {
        phone: '',
        email: ''
      }
    },
    incident: {
      date: '',
      type: '',
      description: '',
      location: ''
    },
    claimType: 'medical',
    estimatedAmount: '',
    priority: 'medium'
  });

  const [documents, setDocuments] = useState([]);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [dragActive, setDragActive] = useState(false);

  const [errors, setErrors] = useState({});

  const validateStep = (step) => {
    const newErrors = {};

    if (step === 1) {
      if (!formData.policy) newErrors.policy = 'Please select a policy';
      if (!formData.claimant.name.trim()) newErrors['claimant.name'] = 'Name is required';
      if (!formData.claimant.contact.phone.trim()) {
        newErrors['claimant.contact.phone'] = 'Phone is required';
      } else if (!/^\+?[\d\s-]{10,}$/.test(formData.claimant.contact.phone)) {
        newErrors['claimant.contact.phone'] = 'Invalid phone format';
      }
      if (!formData.claimant.contact.email.trim()) {
        newErrors['claimant.contact.email'] = 'Email is required';
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.claimant.contact.email)) {
        newErrors['claimant.contact.email'] = 'Invalid email format';
      }
    }

    if (step === 2) {
      if (!formData.incident.date) {
        newErrors['incident.date'] = 'Incident date is required';
      } else {
        const incidentDate = new Date(formData.incident.date);
        const today = new Date();
        if (incidentDate > today) {
          newErrors['incident.date'] = 'Incident date cannot be in the future';
        }
      }
      if (!formData.incident.type) newErrors['incident.type'] = 'Incident type is required';
      if (!formData.incident.description.trim()) {
        newErrors['incident.description'] = 'Description is required';
      } else if (formData.incident.description.length < 20) {
        newErrors['incident.description'] = 'Description must be at least 20 characters';
      }
    }

    if (step === 3) {
      if (!formData.estimatedAmount || parseFloat(formData.estimatedAmount) <= 0) {
        newErrors.estimatedAmount = 'Valid estimated amount is required';
      } else if (parseFloat(formData.estimatedAmount) > 1000000) {
        newErrors.estimatedAmount = 'Amount exceeds maximum limit';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
    }
  };

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  };

  const handleInputChange = (path, value) => {
    const keys = path.split('.');
    setFormData(prev => {
      const updated = { ...prev };
      let current = updated;
      for (let i = 0; i < keys.length - 1; i++) {
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
      return updated;
    });
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[path];
      return newErrors;
    });
  };

  const handleFileSelect = useCallback((e) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      addFiles(files);
    }
  }, []);

  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files) {
      const files = Array.from(e.dataTransfer.files);
      addFiles(files);
    }
  }, []);

  const addFiles = (files) => {
    const newDocs = files.map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: getDocumentType(file.name),
      description: '',
      uploadProgress: 0
    }));
    setDocuments(prev => [...prev, ...newDocs]);
  };

  const getDocumentType = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    const typeMap = {
      pdf: 'medical_report',
      doc: 'medical_report',
      docx: 'medical_report',
      jpg: 'photo',
      jpeg: 'photo',
      png: 'photo',
      gif: 'photo',
      heic: 'photo'
    };
    return typeMap[ext] || 'other';
  };

  const removeDocument = (id) => {
    setDocuments(prev => prev.filter(doc => doc.id !== id));
  };

  const updateDocumentMeta = (id, field, value) => {
    setDocuments(prev => prev.map(doc => 
      doc.id === id ? { ...doc, [field]: value } : doc
    ));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSubmit = async () => {
    if (!validateStep(3)) {
      setCurrentStep(3);
      return;
    }

    setLoading(true);
    setSubmitError(null);

    try {
      const claimData = {
        ...formData,
        estimatedAmount: parseFloat(formData.estimatedAmount),
        documents: documents.map(doc => ({
          type: doc.type,
          name: doc.name,
          description: doc.description
        }))
      };

      if (onSubmit) {
        await onSubmit(claimData);
      }

      setSubmitSuccess(true);
    } catch (error) {
      setSubmitError(error.message || 'Failed to submit claim. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderProgressBar = () => (
    <div className="wizard-progress">
      <div className="progress-steps">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isActive = step.id === currentStep;
          const isCompleted = step.id < currentStep;
          return (
            <div
              key={step.id}
              className={`progress-step ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
            >
              <div className="step-indicator">
                {isCompleted ? <CheckCircle className="w-5 h-5" /> : <Icon className="w-5 h-5" />}
              </div>
              <span className="step-title">{step.title}</span>
            </div>
          );
        })}
      </div>
      <div className="progress-bar-container">
        <div 
          className="progress-bar-fill" 
          style={{ width: `${((currentStep - 1) / (STEPS.length - 1)) * 100}%` }}
        />
      </div>
    </div>
  );

  const renderStep1 = () => (
    <motion.div
      key="step1"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="step-content"
    >
      <div className="step-header">
        <User className="w-6 h-6 text-blue-600" />
        <div>
          <h3>Claimant Information</h3>
          <p>Enter the details of the person filing this claim</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group full-width">
          <label>Select Policy *</label>
          <select
            value={formData.policy}
            onChange={(e) => handleInputChange('policy', e.target.value)}
            className={errors.policy ? 'error' : ''}
          >
            <option value="">Choose a policy...</option>
            {policies.map(p => (
              <option key={p._id || p.id} value={p._id || p.id}>
                {p.policyNumber || p.name} - {p.coverageType}
              </option>
            ))}
          </select>
          {errors.policy && <span className="error-text">{errors.policy}</span>}
        </div>

        <div className="form-group full-width">
          <label>Full Name *</label>
          <input
            type="text"
            placeholder="Enter claimant's full name"
            value={formData.claimant.name}
            onChange={(e) => handleInputChange('claimant.name', e.target.value)}
            className={errors['claimant.name'] ? 'error' : ''}
          />
          {errors['claimant.name'] && <span className="error-text">{errors['claimant.name']}</span>}
        </div>

        <div className="form-group">
          <label>Relationship to Insured</label>
          <select
            value={formData.claimant.relationship}
            onChange={(e) => handleInputChange('claimant.relationship', e.target.value)}
          >
            {RELATIONSHIPS.map(r => (
              <option key={r.value} value={r.value}>{r.label}</option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <label>Phone Number *</label>
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={formData.claimant.contact.phone}
            onChange={(e) => handleInputChange('claimant.contact.phone', e.target.value)}
            className={errors['claimant.contact.phone'] ? 'error' : ''}
          />
          {errors['claimant.contact.phone'] && <span className="error-text">{errors['claimant.contact.phone']}</span>}
        </div>

        <div className="form-group full-width">
          <label>Email Address *</label>
          <input
            type="email"
            placeholder="email@example.com"
            value={formData.claimant.contact.email}
            onChange={(e) => handleInputChange('claimant.contact.email', e.target.value)}
            className={errors['claimant.contact.email'] ? 'error' : ''}
          />
          {errors['claimant.contact.email'] && <span className="error-text">{errors['claimant.contact.email']}</span>}
        </div>
      </div>
    </motion.div>
  );

  const renderStep2 = () => (
    <motion.div
      key="step2"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="step-content"
    >
      <div className="step-header">
        <Calendar className="w-6 h-6 text-blue-600" />
        <div>
          <h3>Incident Details</h3>
          <p>Describe what happened and when it occurred</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group">
          <label>Incident Date *</label>
          <input
            type="date"
            value={formData.incident.date}
            onChange={(e) => handleInputChange('incident.date', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className={errors['incident.date'] ? 'error' : ''}
          />
          {errors['incident.date'] && <span className="error-text">{errors['incident.date']}</span>}
        </div>

        <div className="form-group">
          <label>Incident Type *</label>
          <select
            value={formData.incident.type}
            onChange={(e) => handleInputChange('incident.type', e.target.value)}
            className={errors['incident.type'] ? 'error' : ''}
          >
            <option value="">Select incident type...</option>
            {INCIDENT_TYPES.map(type => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
          {errors['incident.type'] && <span className="error-text">{errors['incident.type']}</span>}
        </div>

        <div className="form-group full-width">
          <label>Incident Location</label>
          <input
            type="text"
            placeholder="Where did the incident occur?"
            value={formData.incident.location}
            onChange={(e) => handleInputChange('incident.location', e.target.value)}
          />
        </div>

        <div className="form-group full-width">
          <label>Description *</label>
          <textarea
            rows={4}
            placeholder="Provide a detailed description of the incident (minimum 20 characters)..."
            value={formData.incident.description}
            onChange={(e) => handleInputChange('incident.description', e.target.value)}
            className={errors['incident.description'] ? 'error' : ''}
          />
          <div className="input-hint">
            <span className={formData.incident.description.length >= 20 ? 'valid' : ''}>
              {formData.incident.description.length}/20 characters minimum
            </span>
          </div>
          {errors['incident.description'] && <span className="error-text">{errors['incident.description']}</span>}
        </div>
      </div>
    </motion.div>
  );

  const renderStep3 = () => (
    <motion.div
      key="step3"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="step-content"
    >
      <div className="step-header">
        <DollarSign className="w-6 h-6 text-blue-600" />
        <div>
          <h3>Claim Details</h3>
          <p>Specify the claim type and estimated amount</p>
        </div>
      </div>

      <div className="form-grid">
        <div className="form-group full-width">
          <label>Claim Type *</label>
          <div className="claim-type-grid">
            {CLAIM_TYPES.map(type => (
              <button
                key={type.value}
                type="button"
                className={`claim-type-btn ${formData.claimType === type.value ? 'selected' : ''}`}
                onClick={() => handleInputChange('claimType', type.value)}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="form-group">
          <label>Estimated Amount ($) *</label>
          <div className="input-with-icon">
            <DollarSign className="w-5 h-5 text-gray-400" />
            <input
              type="number"
              placeholder="0.00"
              min="0"
              max="1000000"
              step="0.01"
              value={formData.estimatedAmount}
              onChange={(e) => handleInputChange('estimatedAmount', e.target.value)}
              className={errors.estimatedAmount ? 'error' : ''}
            />
          </div>
          {errors.estimatedAmount && <span className="error-text">{errors.estimatedAmount}</span>}
        </div>

        <div className="form-group">
          <label>Priority Level</label>
          <div className="priority-grid">
            {PRIORITIES.map(p => (
              <button
                key={p.value}
                type="button"
                className={`priority-btn ${formData.priority === p.value ? 'selected' : ''}`}
                style={{ '--priority-color': p.color }}
                onClick={() => handleInputChange('priority', p.value)}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="claim-summary-card">
        <h4>Claim Summary</h4>
        <div className="summary-grid">
          <div className="summary-item">
            <span className="summary-label">Claim Type</span>
            <span className="summary-value">{CLAIM_TYPES.find(t => t.value === formData.claimType)?.label}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Estimated Amount</span>
            <span className="summary-value">${parseFloat(formData.estimatedAmount || 0).toLocaleString()}</span>
          </div>
          <div className="summary-item">
            <span className="summary-label">Priority</span>
            <span 
              className="summary-value priority-badge"
              style={{ color: PRIORITIES.find(p => p.value === formData.priority)?.color }}
            >
              {PRIORITIES.find(p => p.value === formData.priority)?.label}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );

  const renderStep4 = () => (
    <motion.div
      key="step4"
      initial={{ x: 20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: -20, opacity: 0 }}
      className="step-content"
    >
      <div className="step-header">
        <Upload className="w-6 h-6 text-blue-600" />
        <div>
          <h3>Document Attachment</h3>
          <p>Upload supporting documents for your claim</p>
        </div>
      </div>

      <div
        className={`upload-dropzone ${dragActive ? 'active' : ''}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileSelect}
          accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.heic"
          className="hidden-input"
        />
        <Upload className="w-12 h-12 text-gray-400 mb-3" />
        <h4>Drag and drop files here</h4>
        <p>or click to browse</p>
        <span className="file-hint">PDF, DOC, JPG, PNG up to 100MB</span>
      </div>

      {documents.length > 0 && (
        <div className="documents-list">
          <h4>Attached Documents ({documents.length})</h4>
          {documents.map((doc) => (
            <div key={doc.id} className="document-item">
              <div className="doc-icon">
                <File className="w-5 h-5" />
              </div>
              <div className="doc-info">
                <span className="doc-name">{doc.name}</span>
                <span className="doc-size">{formatFileSize(doc.size)}</span>
              </div>
              <select
                value={doc.type}
                onChange={(e) => updateDocumentMeta(doc.id, 'type', e.target.value)}
                className="doc-type-select"
              >
                <option value="medical_report">Medical Report</option>
                <option value="invoice">Invoice</option>
                <option value="receipt">Receipt</option>
                <option value="photo">Photo</option>
                <option value="police_report">Police Report</option>
                <option value="other">Other</option>
              </select>
              <button
                type="button"
                className="doc-remove-btn"
                onClick={() => removeDocument(doc.id)}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="document-tips">
        <h4>Recommended Documents</h4>
        <ul>
          <li>Medical reports and bills (for medical claims)</li>
          <li>Police reports (for theft or accident claims)</li>
          <li>Photos of damage</li>
          <li>Receipts and invoices</li>
          <li>Witness statements (if available)</li>
        </ul>
      </div>
    </motion.div>
  );

  const renderStep5 = () => (
    <motion.div
      key="step5"
      initial={{ scale: 0.95, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0.95, opacity: 0 }}
      className="step-content"
    >
      <div className="step-header">
        <CheckCircle className="w-6 h-6 text-green-600" />
        <div>
          <h3>Review & Submit</h3>
          <p>Please review your claim before submitting</p>
        </div>
      </div>

      <div className="review-sections">
        <div className="review-section">
          <h4>Claimant Information</h4>
          <div className="review-grid">
            <div className="review-item">
              <span className="review-label">Name</span>
              <span className="review-value">{formData.claimant.name}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Relationship</span>
              <span className="review-value">{RELATIONSHIPS.find(r => r.value === formData.claimant.relationship)?.label}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Phone</span>
              <span className="review-value">{formData.claimant.contact.phone}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Email</span>
              <span className="review-value">{formData.claimant.contact.email}</span>
            </div>
          </div>
        </div>

        <div className="review-section">
          <h4>Incident Details</h4>
          <div className="review-grid">
            <div className="review-item">
              <span className="review-label">Date</span>
              <span className="review-value">{new Date(formData.incident.date).toLocaleDateString()}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Type</span>
              <span className="review-value">{formData.incident.type}</span>
            </div>
            {formData.incident.location && (
              <div className="review-item full-width">
                <span className="review-label">Location</span>
                <span className="review-value">{formData.incident.location}</span>
              </div>
            )}
            <div className="review-item full-width">
              <span className="review-label">Description</span>
              <span className="review-value">{formData.incident.description}</span>
            </div>
          </div>
        </div>

        <div className="review-section">
          <h4>Claim Information</h4>
          <div className="review-grid">
            <div className="review-item">
              <span className="review-label">Claim Type</span>
              <span className="review-value">{CLAIM_TYPES.find(t => t.value === formData.claimType)?.label}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Estimated Amount</span>
              <span className="review-value highlight">${parseFloat(formData.estimatedAmount).toLocaleString()}</span>
            </div>
            <div className="review-item">
              <span className="review-label">Priority</span>
              <span 
                className="review-value"
                style={{ color: PRIORITIES.find(p => p.value === formData.priority)?.color }}
              >
                {PRIORITIES.find(p => p.value === formData.priority)?.label}
              </span>
            </div>
          </div>
        </div>

        <div className="review-section">
          <h4>Documents ({documents.length})</h4>
          {documents.length === 0 ? (
            <p className="no-docs">No documents attached</p>
          ) : (
            <div className="review-docs">
              {documents.map(doc => (
                <span key={doc.id} className="review-doc-badge">
                  <File className="w-4 h-4" />
                  {doc.name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="terms-notice">
        <Shield className="w-5 h-5 text-blue-500" />
        <p>By submitting this claim, I confirm that all information provided is accurate and complete to the best of my knowledge.</p>
      </div>
    </motion.div>
  );

  const renderSuccess = () => (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className="success-screen"
    >
      <div className="success-icon">
        <CheckCircle className="w-16 h-16 text-green-500" />
      </div>
      <h2>Claim Submitted Successfully!</h2>
      <p>Your claim has been received and is now being processed.</p>
      <div className="success-details">
        <div className="detail-item">
          <Clock className="w-5 h-5" />
          <span>Reference Number: <strong>CLM-{new Date().toISOString().slice(0,10).replace(/-/g,'')}-{Math.random().toString(36).substr(2, 4).toUpperCase()}</strong></span>
        </div>
        <div className="detail-item">
          <AlertCircle className="w-5 h-5" />
          <span>You will receive updates via email at <strong>{formData.claimant.contact.email}</strong></span>
        </div>
      </div>
      <button onClick={onCancel} className="btn-primary">
        Close
      </button>
    </motion.div>
  );

  if (submitSuccess) {
    return (
      <div className="claims-wizard-overlay">
        <div className="claims-wizard-container">
          {renderSuccess()}
        </div>
      </div>
    );
  }

  return (
    <div className="claims-wizard-overlay">
      <div className="claims-wizard-container">
        <div className="wizard-header">
          <div className="header-content">
            <FileText className="w-6 h-6 text-blue-600" />
            <div>
              <h2>Claims Submission</h2>
              <p>Step {currentStep} of {STEPS.length}</p>
            </div>
          </div>
          <button className="close-btn" onClick={onCancel}>
            <X className="w-5 h-5" />
          </button>
        </div>

        {renderProgressBar()}

        <div className="wizard-body">
          <AnimatePresence mode="wait">
            {currentStep === 1 && renderStep1()}
            {currentStep === 2 && renderStep2()}
            {currentStep === 3 && renderStep3()}
            {currentStep === 4 && renderStep4()}
            {currentStep === 5 && renderStep5()}
          </AnimatePresence>
        </div>

        {submitError && (
          <div className="submit-error">
            <AlertCircle className="w-5 h-5" />
            <span>{submitError}</span>
          </div>
        )}

        <div className="wizard-footer">
          {currentStep > 1 && (
            <button className="btn-secondary" onClick={handleBack} disabled={loading}>
              <ChevronLeft className="w-5 h-5" />
              Back
            </button>
          )}
          <div className="footer-spacer" />
          {currentStep < STEPS.length ? (
            <button className="btn-primary" onClick={handleNext}>
              Continue
              <ChevronRight className="w-5 h-5" />
            </button>
          ) : (
            <button className="btn-submit" onClick={handleSubmit} disabled={loading}>
              {loading ? (
                <>
                  <div className="spinner" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="w-5 h-5" />
                  Submit Claim
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ClaimsSubmissionWizard;
