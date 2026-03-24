const express = require('express');
const { body, validationResult } = require('express-validator');
const { Pool } = require('pg');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/healthcare_providers'
});

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/verification');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = crypto.randomBytes(16).toString('hex');
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'application/pdf', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only JPEG, PNG, and PDF files are allowed.'));
    }
  }
});

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const query = 'SELECT role FROM users WHERE id = $1';
    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Middleware to check if user is a provider
const isProvider = async (req, res, next) => {
  try {
    const query = `
      SELECT id, verification_status FROM healthcare_providers
      WHERE user_id = $1
    `;
    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Provider profile not found' });
    }
    
    req.providerId = result.rows[0].id;
    req.verificationStatus = result.rows[0].verification_status;
    next();
  } catch (error) {
    console.error('Error checking provider status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// POST /api/provider-verification/submit - Submit verification application
router.post('/submit', [
  isProvider,
  upload.array('documents', 10),
  body('npi_number').optional().matches(/^\d{10}$/),
  body('first_name').isString().isLength({ min: 1, max: 100 }),
  body('last_name').isString().isLength({ min: 1, max: 100 }),
  body('professional_title').optional().isString().isLength({ max: 50 }),
  body('bio').optional().isString().isLength({ max: 2000 }),
  body('practice_name').optional().isString().isLength({ max: 255 }),
  body('practice_type').optional().isIn(['solo', 'group', 'hospital', 'clinic']),
  body('years_of_experience').optional().isInt({ min: 0, max: 70 }),
  body('languages_spoken').optional().isArray(),
  body('specialties').isArray({ min: 1 }),
  body('credentials').isArray({ min: 1 }),
  body('address_line1').isString().isLength({ min: 1, max: 255 }),
  body('address_line2').optional().isString().isLength({ max: 255 }),
  body('city').isString().isLength({ min: 1, max: 100 }),
  body('state').isString().isLength({ min: 2, max: 50 }),
  body('zip_code').isString().matches(/^\d{5}(-\d{4})?$/),
  body('phone').optional().matches(/^\+?[\d\s\-\(\)]+$/),
  body('email').optional().isEmail(),
  body('website').optional().isURL(),
  validateRequest
], async (req, res) => {
  try {
    if (req.verificationStatus === 'verified') {
      return res.status(400).json({ error: 'Provider is already verified' });
    }

    const {
      npi_number, first_name, last_name, professional_title, bio,
      practice_name, practice_type, years_of_experience, languages_spoken,
      specialties, credentials, address_line1, address_line2, city, state,
      zip_code, phone, email, website
    } = req.body;

    await pool.query('BEGIN');

    // Update provider profile
    const updateProviderQuery = `
      UPDATE healthcare_providers SET
        npi_number = $1, first_name = $2, last_name = $3, professional_title = $4,
        bio = $5, practice_name = $6, practice_type = $7, years_of_experience = $8,
        languages_spoken = $9, address_line1 = $10, address_line2 = $11,
        city = $12, state = $13, zip_code = $14, phone = $15, email = $16,
        website = $17, verification_status = 'pending', updated_at = CURRENT_TIMESTAMP
      WHERE id = $18
      RETURNING *
    `;

    const providerResult = await pool.query(updateProviderQuery, [
      npi_number, first_name, last_name, professional_title, bio,
      practice_name, practice_type, years_of_experience, languages_spoken,
      address_line1, address_line2, city, state, zip_code, phone, email, website,
      req.providerId
    ]);

    // Update location for geospatial search (you'd want to use a geocoding service)
    // For now, we'll set a placeholder location
    await pool.query(`
      UPDATE healthcare_providers 
      SET location = ST_MakePoint(-74.0060, 40.7128) 
      WHERE id = $1
    `, [req.providerId]);

    // Update specialties
    await pool.query('DELETE FROM provider_specialties_map WHERE provider_id = $1', [req.providerId]);
    
    for (const specialty of specialties) {
      await pool.query(`
        INSERT INTO provider_specialties_map (provider_id, specialty_id, is_primary)
        VALUES ($1, $2, $3)
      `, [req.providerId, specialty.id, specialty.is_primary || false]);
    }

    // Update credentials
    await pool.query('DELETE FROM provider_credentials_map WHERE provider_id = $1', [req.providerId]);
    
    for (const credential of credentials) {
      await pool.query(`
        INSERT INTO provider_credentials_map (provider_id, credential_id, credential_number, issue_date, expiry_date)
        VALUES ($1, $2, $3, $4, $5)
      `, [req.providerId, credential.id, credential.credential_number, credential.issue_date, credential.expiry_date]);
    }

    // Upload documents
    if (req.files && req.files.length > 0) {
      for (const file of req.files) {
        await pool.query(`
          INSERT INTO provider_verification_documents (provider_id, document_type, document_name, file_url, file_size, mime_type)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [req.providerId, 'verification_document', file.originalname, file.path, file.size, file.mimetype]);
      }
    }

    await pool.query('COMMIT');

    // Notify admins of new verification request
    await notifyAdminsOfNewRequest(req.providerId, first_name, last_name);

    res.status(201).json({
      message: 'Verification application submitted successfully',
      provider: providerResult.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error submitting verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/provider-verification/status - Get verification status
router.get('/status', isProvider, async (req, res) => {
  try {
    const query = `
      SELECT 
        hp.*,
        array_agg(DISTINCT ps.name) as specialties,
        array_agg(DISTINCT pc.name) as credentials,
        (SELECT COUNT(*) FROM provider_verification_documents WHERE provider_id = hp.id) as document_count
      FROM healthcare_providers hp
      LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      LEFT JOIN provider_credentials_map pcm ON hp.id = pcm.provider_id
      LEFT JOIN provider_credentials pc ON pcm.credential_id = pc.id
      WHERE hp.id = $1
      GROUP BY hp.id
    `;

    const result = await pool.query(query, [req.providerId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error getting verification status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/provider-verification/admin/pending - Get pending verification requests (admin only)
router.get('/admin/pending', isAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        hp.*,
        u.email as user_email,
        array_agg(DISTINCT ps.name) as specialties,
        (SELECT COUNT(*) FROM provider_verification_documents WHERE provider_id = hp.id) as document_count
      FROM healthcare_providers hp
      LEFT JOIN users u ON hp.user_id = u.id
      LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      WHERE hp.verification_status = 'pending'
      GROUP BY hp.id, u.email
      ORDER BY hp.created_at DESC
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting pending requests:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/provider-verification/admin/:id - Get detailed verification request (admin only)
router.get('/admin/:id', isAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Get provider details
    const providerQuery = `
      SELECT 
        hp.*,
        u.email as user_email,
        u.created_at as user_created_at
      FROM healthcare_providers hp
      LEFT JOIN users u ON hp.user_id = u.id
      WHERE hp.id = $1
    `;

    const providerResult = await pool.query(providerQuery, [id]);

    if (providerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const provider = providerResult.rows[0];

    // Get specialties
    const specialtiesQuery = `
      SELECT ps.*, psm.is_primary, psm.years_experience
      FROM provider_specialties_map psm
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      WHERE psm.provider_id = $1
    `;

    const specialtiesResult = await pool.query(specialtiesQuery, [id]);
    provider.specialties = specialtiesResult.rows;

    // Get credentials
    const credentialsQuery = `
      SELECT pc.*, pcm.credential_number, pcm.issue_date, pcm.expiry_date, pcm.verification_status
      FROM provider_credentials_map pcm
      LEFT JOIN provider_credentials pc ON pcm.credential_id = pc.id
      WHERE pcm.provider_id = $1
    `;

    const credentialsResult = await pool.query(credentialsQuery, [id]);
    provider.credentials = credentialsResult.rows;

    // Get documents
    const documentsQuery = `
      SELECT * FROM provider_verification_documents
      WHERE provider_id = $1
      ORDER BY upload_date DESC
    `;

    const documentsResult = await pool.query(documentsQuery, [id]);
    provider.documents = documentsResult.rows;

    res.json(provider);
  } catch (error) {
    console.error('Error getting verification request:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/provider-verification/admin/:id/approve - Approve verification (admin only)
router.post('/admin/:id/approve', [
  isAdmin,
  body('notes').optional().isString().isLength({ max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    await pool.query('BEGIN');

    // Update provider verification status
    const updateQuery = `
      UPDATE healthcare_providers 
      SET verification_status = 'verified', verification_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [id]);

    if (result.rows.length === 0) {
      await pool.query('ROLLBACK');
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Mark all documents as verified
    await pool.query(`
      UPDATE provider_verification_documents
      SET verification_status = 'verified', verified_by = $1, verified_at = CURRENT_TIMESTAMP
      WHERE provider_id = $2
    `, [req.user.id, id]);

    await pool.query('COMMIT');

    // Send notification to provider
    await sendVerificationNotification(id, 'approved', notes);

    res.json({
      message: 'Provider verification approved successfully',
      provider: result.rows[0]
    });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error approving verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/provider-verification/admin/:id/reject - Reject verification (admin only)
router.post('/admin/:id/reject', [
  isAdmin,
  body('reason').isString().isLength({ min: 10, max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const updateQuery = `
      UPDATE healthcare_providers 
      SET verification_status = 'rejected', rejection_reason = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [reason, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Send notification to provider
    await sendVerificationNotification(id, 'rejected', reason);

    res.json({
      message: 'Provider verification rejected',
      provider: result.rows[0]
    });
  } catch (error) {
    console.error('Error rejecting verification:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/provider-verification/documents/upload - Upload verification document
router.post('/documents/upload', [
  isProvider,
  upload.single('document'),
  body('document_type').isIn(['license', 'diploma', 'certificate', 'background_check']),
  validateRequest
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { document_type } = req.body;

    const query = `
      INSERT INTO provider_verification_documents 
      (provider_id, document_type, document_name, file_url, file_size, mime_type)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;

    const result = await pool.query(query, [
      req.providerId, document_type, req.file.originalname,
      req.file.path, req.file.size, req.file.mimetype
    ]);

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/provider-verification/documents - Get provider's verification documents
router.get('/documents', isProvider, async (req, res) => {
  try {
    const query = `
      SELECT * FROM provider_verification_documents
      WHERE provider_id = $1
      ORDER BY upload_date DESC
    `;

    const result = await pool.query(query, [req.providerId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting documents:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/provider-verification/documents/:id - Delete verification document
router.delete('/documents/:id', [
  isProvider,
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;

    // Get document info to delete file
    const docQuery = `
      SELECT file_url FROM provider_verification_documents
      WHERE id = $1 AND provider_id = $2
    `;

    const docResult = await pool.query(docQuery, [id, req.providerId]);

    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Delete file from filesystem
    const filePath = docResult.rows[0].file_url;
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Delete from database
    await pool.query('DELETE FROM provider_verification_documents WHERE id = $1', [id]);

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to notify admins of new verification request
async function notifyAdminsOfNewRequest(providerId, firstName, lastName) {
  try {
    const query = `
      SELECT email FROM users WHERE role = 'admin'
    `;

    const result = await pool.query(query);
    const adminEmails = result.rows.map(row => row.email);

    if (adminEmails.length === 0) {
      return;
    }

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: adminEmails.join(','),
      subject: 'New Provider Verification Request',
      html: `
        <h2>New Provider Verification Request</h2>
        <p>A new verification request has been submitted by:</p>
        <ul>
          <li>Name: ${firstName} ${lastName}</li>
          <li>Provider ID: ${providerId}</li>
          <li>Submitted: ${new Date().toLocaleString()}</li>
        </ul>
        <p>Please review the application in the admin dashboard.</p>
      `
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error notifying admins:', error);
  }
}

// Helper function to send verification notification to provider
async function sendVerificationNotification(providerId, status, notes) {
  try {
    const query = `
      SELECT u.email, hp.first_name, hp.last_name
      FROM healthcare_providers hp
      LEFT JOIN users u ON hp.user_id = u.id
      WHERE hp.id = $1
    `;

    const result = await pool.query(query, [providerId]);

    if (result.rows.length === 0) {
      return;
    }

    const { email, first_name, last_name } = result.rows[0];

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const subject = status === 'approved' ? 'Verification Approved' : 'Verification Request Update';
    const html = status === 'approved' ? `
      <h2>Congratulations! Your Verification Has Been Approved</h2>
      <p>Dear ${first_name} ${last_name},</p>
      <p>Your provider verification has been approved. You can now appear in the provider directory and accept patient appointments.</p>
      ${notes ? `<p>Notes: ${notes}</p>` : ''}
      <p>Thank you for joining our healthcare network!</p>
    ` : `
      <h2>Verification Request Update</h2>
      <p>Dear ${first_name} ${last_name},</p>
      <p>There has been an update to your verification request:</p>
      <p>${notes}</p>
      <p>Please log in to your dashboard for more details.</p>
    `;

    const mailOptions = {
      from: process.env.FROM_EMAIL,
      to: email,
      subject,
      html
    };

    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Error sending verification notification:', error);
  }
}

module.exports = router;
