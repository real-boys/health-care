const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { setCache, deleteCache } = require('../middleware/cache');

// Import IPFS services
const ipfsService = require('../services/ipfsService');
const encryptionService = require('../services/encryptionService');
const contentAddressingService = require('../services/contentAddressingService');
const versioningService = require('../services/versioningService');
const pinningService = require('../services/pinningService');

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

// Initialize IPFS services on startup
async function initializeServices() {
  try {
    await ipfsService.initialize();
    await contentAddressingService.initializeTables();
    await versioningService.initializeTables();
    await pinningService.initializeTables();
    console.log('IPFS services initialized successfully');
  } catch (error) {
    console.error('Error initializing IPFS services:', error);
  }
}

// Initialize services
initializeServices();

// Get patient encryption key
async function getPatientEncryptionKey(patientId) {
  const db = getDatabase();
  
  try {
    // In a real implementation, this would retrieve the patient's encryption key
    // from a secure key management system or derive it from patient credentials
    const result = await new Promise((resolve, reject) => {
      db.get(
        'SELECT encryption_key FROM patients WHERE id = ?',
        [patientId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    // Fallback to environment variable for demo
    return result?.encryption_key || process.env.DEFAULT_ENCRYPTION_KEY || 'default-patient-key';
  } catch (error) {
    console.error('Error getting patient encryption key:', error);
    return process.env.DEFAULT_ENCRYPTION_KEY || 'default-patient-key';
  } finally {
    db.close();
  }
}

// Store medical record metadata in database
async function storeMedicalRecordMetadata(recordData, ipfsCid, contentHash, userId) {
  const db = getDatabase();
  
  try {
    const result = await new Promise((resolve, reject) => {
      db.run(
        `INSERT INTO medical_records_ipfs (
          patient_id, provider_id, record_type, title, description,
          diagnosis_code, treatment_code, date_of_service, facility_name,
          notes, ipfs_cid, content_hash, created_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          recordData.patientId,
          recordData.providerId,
          recordData.recordType,
          recordData.title,
          recordData.description,
          recordData.diagnosisCode,
          recordData.treatmentCode,
          recordData.dateOfService,
          recordData.facilityName,
          recordData.notes,
          ipfsCid,
          contentHash,
          userId
        ],
        function(err) {
          if (err) reject(err);
          else resolve({ id: this.lastID });
        }
      );
    });

    return result.id;
  } catch (error) {
    console.error('Error storing medical record metadata:', error);
    throw error;
  } finally {
    db.close();
  }
}

// Get medical records for a patient
router.get('/patient/:patientId', async (req, res, next) => {
  const { patientId } = req.params;
  const { limit = 50, offset = 0, recordType } = req.query;
  
  const db = getDatabase();
  
  try {
    let query = `
      SELECT mri.*, u.first_name || ' ' || u.last_name as provider_name
      FROM medical_records_ipfs mri
      JOIN users u ON mri.provider_id = u.id
      WHERE mri.patient_id = ?
    `;
    
    const params = [patientId];
    
    if (recordType) {
      query += ' AND mri.record_type = ?';
      params.push(recordType);
    }
    
    query += ' ORDER BY mri.date_of_service DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));
    
    const records = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    const countQuery = recordType 
      ? 'SELECT COUNT(*) as total FROM medical_records_ipfs WHERE patient_id = ? AND record_type = ?'
      : 'SELECT COUNT(*) as total FROM medical_records_ipfs WHERE patient_id = ?';
    
    const countParams = recordType ? [patientId, recordType] : [patientId];
    
    const totalCount = await new Promise((resolve, reject) => {
      db.get(countQuery, countParams, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total);
        }
      });
    });

    const result = {
      records,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount
      }
    };

    setCache(req.originalUrl, result);
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Get specific medical record with decrypted content
router.get('/:recordId', async (req, res, next) => {
  const { recordId } = req.params;
  const { includeContent = 'true' } = req.query;
  
  const db = getDatabase();
  
  try {
    const record = await new Promise((resolve, reject) => {
      const query = `
        SELECT mri.*, u.first_name || ' ' || u.last_name as provider_name
        FROM medical_records_ipfs mri
        JOIN users u ON mri.provider_id = u.id
        WHERE mri.id = ?
      `;
      
      db.get(query, [recordId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Get decrypted content if requested
    let decryptedContent = null;
    if (includeContent === 'true') {
      try {
        const encryptionKey = await getPatientEncryptionKey(record.patient_id);
        const { data } = await ipfsService.getEncryptedFile(record.ipfs_cid, encryptionKey);
        decryptedContent = data;
      } catch (error) {
        console.error('Error decrypting medical record content:', error);
        decryptedContent = null;
      }
    }

    const result = {
      ...record,
      content: decryptedContent
    };

    setCache(req.originalUrl, result);
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Create new medical record with IPFS storage
router.post('/', async (req, res, next) => {
  const {
    patientId,
    providerId,
    recordType,
    title,
    description,
    diagnosisCode,
    treatmentCode,
    dateOfService,
    facilityName,
    notes,
    attachments,
    priority = 'MEDIUM'
  } = req.body;
  
  const db = getDatabase();
  
  try {
    // Get patient encryption key
    const encryptionKey = await getPatientEncryptionKey(patientId);
    
    // Prepare record data for IPFS storage
    const recordData = {
      patientId,
      providerId,
      recordType,
      title,
      description,
      diagnosisCode,
      treatmentCode,
      dateOfService,
      facilityName,
      notes,
      attachments,
      createdAt: new Date().toISOString(),
      version: 1
    };

    // Store in IPFS with encryption
    const ipfsResult = await ipfsService.addEncryptedFile(recordData, encryptionKey, {
      contentType: 'application/json',
      pin: true
    });

    // Register content for deduplication
    await contentAddressingService.registerContent(
      ipfsResult.contentHash,
      ipfsResult.cid,
      'medical_record',
      JSON.stringify(recordData).length,
      ipfsResult.size,
      { recordType, patientId, priority }
    );

    // Create content reference
    await contentAddressingService.createContentReference(
      ipfsResult.contentHash,
      'medical_record',
      `record-${Date.now()}`,
      req.user.id
    );

    // Store metadata in database
    const recordId = await storeMedicalRecordMetadata(
      recordData,
      ipfsResult.cid,
      ipfsResult.contentHash,
      req.user.id
    );

    // Create version
    await versioningService.createVersion(
      'medical_record',
      recordId.toString(),
      recordData,
      req.user.id,
      'Initial version',
      encryptionKey
    );

    // Auto-pin based on priority
    if (priority === 'CRITICAL' || priority === 'HIGH') {
      await pinningService.autoPin(
        'medical_record',
        recordId.toString(),
        ipfsResult.cid,
        req.user.id,
        priority
      );
    }

    // Clear cache
    deleteCache('/api/medical-records');
    deleteCache(`/api/medical-records/patient/${patientId}`);

    // Emit real-time notification
    if (req.io) {
      req.io.to(`patient-${patientId}`).emit('new-medical-record', {
        recordId,
        ipfsCid: ipfsResult.cid,
        message: 'New medical record has been added to your profile'
      });
    }
    
    res.status(201).json({
      message: 'Medical record created successfully',
      recordId,
      ipfsCid: ipfsResult.cid,
      contentHash: ipfsResult.contentHash,
      isNew: ipfsResult.isNew
    });
  } catch (error) {
    console.error('Error creating medical record:', error);
    next(error);
  } finally {
    db.close();
  }
});

// Update medical record with versioning
router.put('/:recordId', async (req, res, next) => {
  const { recordId } = req.params;
  const updateFields = req.body;
  
  const db = getDatabase();
  
  try {
    // Get current record
    const currentRecord = await new Promise((resolve, reject) => {
      db.get(
        'SELECT * FROM medical_records_ipfs WHERE id = ?',
        [recordId],
        (err, row) => {
          if (err) reject(err);
          else resolve(row);
        }
      );
    });

    if (!currentRecord) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Get current content from IPFS
    const encryptionKey = await getPatientEncryptionKey(currentRecord.patient_id);
    const { data: currentData } = await ipfsService.getEncryptedFile(currentRecord.ipfs_cid, encryptionKey);

    // Merge updates
    const updatedData = { ...currentData, ...updateFields, updatedAt: new Date().toISOString() };

    // Store updated version in IPFS
    const ipfsResult = await ipfsService.addEncryptedFile(updatedData, encryptionKey, {
      contentType: 'application/json',
      pin: true
    });

    // Create new version
    await versioningService.createVersion(
      'medical_record',
      recordId,
      updatedData,
      req.user.id,
      'Updated record',
      encryptionKey
    );

    // Update database metadata
    await new Promise((resolve, reject) => {
      db.run(
        `UPDATE medical_records_ipfs 
         SET ipfs_cid = ?, content_hash = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [ipfsResult.cid, ipfsResult.contentHash, recordId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Clear cache
    deleteCache('/api/medical-records');
    deleteCache(`/api/medical-records/${recordId}`);

    res.json({ 
      message: 'Medical record updated successfully',
      ipfsCid: ipfsResult.cid,
      contentHash: ipfsResult.contentHash,
      isNew: ipfsResult.isNew
    });
  } catch (error) {
    console.error('Error updating medical record:', error);
    next(error);
  } finally {
    db.close();
  }
});

// Delete medical record (soft delete with versioning)
router.delete('/:recordId', async (req, res, next) => {
  const { recordId } = req.params;
  const db = getDatabase();
  
  try {
    // Get record info
    const record = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM medical_records_ipfs WHERE id = ?', [recordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Create restore point before deletion
    await versioningService.createRestorePoint(
      'medical_record',
      recordId,
      `pre-delete-${Date.now()}`,
      req.user.id,
      'Restore point before record deletion'
    );

    // Soft delete (mark as deleted)
    await new Promise((resolve, reject) => {
      db.run(
        'UPDATE medical_records_ipfs SET is_deleted = TRUE, deleted_at = CURRENT_TIMESTAMP WHERE id = ?',
        [recordId],
        function(err) {
          if (err) reject(err);
          else resolve();
        }
      );
    });

    // Clear cache
    deleteCache('/api/medical-records');
    deleteCache(`/api/medical-records/patient/${record.patient_id}`);

    res.json({ message: 'Medical record deleted successfully' });
  } catch (error) {
    console.error('Error deleting medical record:', error);
    next(error);
  } finally {
    db.close();
  }
});

// Get version history for a medical record
router.get('/:recordId/versions', async (req, res, next) => {
  const { recordId } = req.params;
  
  try {
    const versions = await versioningService.getVersionHistory('medical_record', recordId);
    res.json({ versions });
  } catch (error) {
    console.error('Error getting version history:', error);
    next(error);
  }
});

// Restore medical record to specific version
router.post('/:recordId/restore/:versionNumber', async (req, res, next) => {
  const { recordId, versionNumber } = req.params;
  
  try {
    const result = await versioningService.restoreVersion(
      'medical_record',
      recordId,
      parseInt(versionNumber),
      req.user.id
    );

    res.json({
      message: 'Medical record restored successfully',
      restoredVersion: result.versionNumber,
      newVersionId: result.versionId
    });
  } catch (error) {
    console.error('Error restoring medical record:', error);
    next(error);
  }
});

// Pin medical record
router.post('/:recordId/pin', async (req, res, next) => {
  const { recordId } = req.params;
  const { priority = 'MEDIUM' } = req.body;
  
  const db = getDatabase();
  
  try {
    // Get record info
    const record = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM medical_records_ipfs WHERE id = ?', [recordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Pin the record
    const result = await pinningService.addToQueue(
      'medical_record',
      recordId,
      record.ipfs_cid,
      priority,
      req.user.id,
      { recordTitle: record.title }
    );

    res.json({
      message: 'Medical record queued for pinning',
      pinningResult: result
    });
  } catch (error) {
    console.error('Error pinning medical record:', error);
    next(error);
  } finally {
    db.close();
  }
});

// Unpin medical record
router.delete('/:recordId/pin', async (req, res, next) => {
  const { recordId } = req.params;
  
  const db = getDatabase();
  
  try {
    // Get record info
    const record = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM medical_records_ipfs WHERE id = ?', [recordId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!record) {
      return res.status(404).json({ error: 'Medical record not found' });
    }

    // Unpin the record
    await pinningService.unpinRecord(record.ipfs_cid, req.user.id);

    res.json({ message: 'Medical record unpinned successfully' });
  } catch (error) {
    console.error('Error unpinning medical record:', error);
    next(error);
  } finally {
    db.close();
  }
});

// Get IPFS statistics for medical records
router.get('/stats/ipfs', async (req, res, next) => {
  try {
    const ipfsStats = await ipfsService.getStats();
    const deduplicationStats = await contentAddressingService.calculateDeduplicationStats();
    const pinningStats = await pinningService.getPinningStats();
    const versionStats = await versioningService.getVersionStats('medical_record');

    res.json({
      ipfs: ipfsStats,
      deduplication: deduplicationStats,
      pinning: pinningStats,
      versioning: versionStats
    });
  } catch (error) {
    console.error('Error getting IPFS stats:', error);
    next(error);
  }
});

module.exports = router;
