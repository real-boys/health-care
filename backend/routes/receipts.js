const express = require('express');
const { receiptService } = require('../services/receiptService');
const { getDatabase } = require('../database/database');
const router = express.Router();

/**
 * Generate receipt for a specific payment
 * POST /api/receipts/generate/:paymentId
 */
router.post('/generate/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;
    const { userId } = req.body;

    // Validate payment exists and is completed
    const db = getDatabase();
    const payment = await new Promise((resolve, reject) => {
      db.get('SELECT * FROM premium_payments WHERE id = ?', [paymentId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        error: 'Payment not found'
      });
    }

    if (payment.payment_status !== 'completed') {
      return res.status(400).json({
        success: false,
        error: 'Receipt can only be generated for completed payments'
      });
    }

    // Generate receipt
    const receipt = await receiptService.generateReceipt(paymentId, { userId });

    res.json({
      success: true,
      receipt: {
        receiptId: receipt.receiptId,
        fileName: receipt.fileName,
        downloadUrl: receipt.downloadUrl,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating receipt:', error);
    next(error);
  }
});

/**
 * Generate batch receipt for multiple payments
 * POST /api/receipts/generate-batch
 */
router.post('/generate-batch', async (req, res, next) => {
  try {
    const { paymentIds, userId } = req.body;

    if (!Array.isArray(paymentIds) || paymentIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Payment IDs array is required'
      });
    }

    if (paymentIds.length > 50) {
      return res.status(400).json({
        success: false,
        error: 'Cannot generate batch receipt for more than 50 payments'
      });
    }

    // Generate batch receipt
    const batchReceipt = await receiptService.generateBatchReceipt(paymentIds, { userId });

    res.json({
      success: true,
      receipt: {
        receiptId: batchReceipt.receiptId,
        fileName: batchReceipt.fileName,
        downloadUrl: batchReceipt.downloadUrl,
        paymentCount: batchReceipt.paymentCount,
        totalAmount: batchReceipt.totalAmount,
        generatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error generating batch receipt:', error);
    next(error);
  }
});

/**
 * Download receipt file
 * GET /api/receipts/download/:fileName
 */
router.get('/download/:fileName', async (req, res, next) => {
  try {
    const { fileName } = req.params;

    // Validate file name to prevent directory traversal
    if (fileName.includes('..') || fileName.includes('/') || fileName.includes('\\')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid file name'
      });
    }

    // Get receipt file
    const fileBuffer = await receiptService.downloadReceipt(fileName);

    // Update download count
    const db = getDatabase();
    db.run(
      'UPDATE payment_receipts SET download_count = download_count + 1, last_downloaded_at = CURRENT_TIMESTAMP WHERE file_name = ?',
      [fileName]
    );

    // Set headers for file download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', fileBuffer.length);

    res.send(fileBuffer);
  } catch (error) {
    console.error('Error downloading receipt:', error);
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: 'Receipt file not found'
      });
    }
    next(error);
  }
});

/**
 * Get receipt information for a payment
 * GET /api/receipts/payment/:paymentId
 */
router.get('/payment/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const receipt = await receiptService.getReceiptByPaymentId(paymentId);

    if (!receipt) {
      return res.status(404).json({
        success: false,
        error: 'No receipt found for this payment'
      });
    }

    res.json({
      success: true,
      receipt: {
        receiptId: receipt.receipt_number,
        fileName: receipt.file_name,
        generatedAt: receipt.generated_at,
        downloadCount: receipt.download_count,
        lastDownloadedAt: receipt.last_downloaded_at,
        downloadUrl: `/api/receipts/download/${receipt.file_name}`
      }
    });
  } catch (error) {
    console.error('Error getting receipt info:', error);
    next(error);
  }
});

/**
 * Get all receipts for a user
 * GET /api/receipts/user/:userId
 */
router.get('/user/:userId', async (req, res, next) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const db = getDatabase();

    // Get receipts with payment details
    const receiptsQuery = `
      SELECT 
        pr.receipt_number,
        pr.file_name,
        pr.generated_at,
        pr.download_count,
        pr.last_downloaded_at,
        pr.receipt_type,
        pr.file_size,
        pp.payment_amount,
        pp.payment_date,
        pp.payment_method,
        pp.transaction_id,
        p.first_name || ' ' || p.last_name as patient_name
      FROM payment_receipts pr
      LEFT JOIN premium_payments pp ON pr.payment_id = pp.id
      LEFT JOIN patients p ON pp.patient_id = p.id
      WHERE pr.generated_by = ?
      ORDER BY pr.generated_at DESC
      LIMIT ? OFFSET ?
    `;

    const receipts = await new Promise((resolve, reject) => {
      db.all(receiptsQuery, [userId, parseInt(limit), parseInt(offset)], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get total count
    const countQuery = 'SELECT COUNT(*) as total FROM payment_receipts WHERE generated_by = ?';
    const countResult = await new Promise((resolve, reject) => {
      db.get(countQuery, [userId], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      success: true,
      receipts: receipts.map(receipt => ({
        receiptId: receipt.receipt_number,
        fileName: receipt.file_name,
        generatedAt: receipt.generated_at,
        downloadCount: receipt.download_count,
        lastDownloadedAt: receipt.last_downloaded_at,
        receiptType: receipt.receipt_type,
        fileSize: receipt.file_size,
        paymentAmount: receipt.payment_amount,
        paymentDate: receipt.payment_date,
        paymentMethod: receipt.payment_method,
        transactionId: receipt.transaction_id,
        patientName: receipt.patient_name,
        downloadUrl: `/api/receipts/download/${receipt.file_name}`
      })),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: countResult.total,
        pages: Math.ceil(countResult.total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting user receipts:', error);
    next(error);
  }
});

/**
 * Get receipt statistics
 * GET /api/receipts/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const { userId } = req.query;
    const db = getDatabase();

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (userId) {
      whereClause += ' AND generated_by = ?';
      params.push(userId);
    }

    const statsQuery = `
      SELECT 
        COUNT(*) as total_receipts,
        COUNT(CASE WHEN receipt_type = 'single' THEN 1 END) as single_receipts,
        COUNT(CASE WHEN receipt_type = 'batch' THEN 1 END) as batch_receipts,
        SUM(download_count) as total_downloads,
        AVG(download_count) as avg_downloads_per_receipt,
        MAX(generated_at) as last_receipt_generated,
        COUNT(CASE WHEN generated_at >= date('now', '-30 days') THEN 1 END) as receipts_last_30_days,
        SUM(file_size) as total_file_size,
        AVG(file_size) as avg_file_size
      FROM payment_receipts
      ${whereClause}
    `;

    const stats = await new Promise((resolve, reject) => {
      db.get(statsQuery, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    res.json({
      success: true,
      statistics: {
        totalReceipts: stats.total_receipts || 0,
        singleReceipts: stats.single_receipts || 0,
        batchReceipts: stats.batch_receipts || 0,
        totalDownloads: stats.total_downloads || 0,
        avgDownloadsPerReceipt: stats.avg_downloads_per_receipt || 0,
        lastReceiptGenerated: stats.last_receipt_generated,
        receiptsLast30Days: stats.receipts_last_30_days || 0,
        totalFileSize: stats.total_file_size || 0,
        avgFileSize: stats.avg_file_size || 0
      }
    });
  } catch (error) {
    console.error('Error getting receipt stats:', error);
    next(error);
  }
});

/**
 * Delete old receipts (cleanup)
 * DELETE /api/receipts/cleanup
 */
router.delete('/cleanup', async (req, res, next) => {
  try {
    const { daysOld = 90 } = req.query;

    if (daysOld < 30) {
      return res.status(400).json({
        success: false,
        error: 'Cannot delete receipts newer than 30 days'
      });
    }

    const db = getDatabase();

    // Delete old receipts with no downloads
    const deleteQuery = `
      DELETE FROM payment_receipts 
      WHERE generated_at < date('now', '-' || ? || ' days')
      AND download_count = 0
    `;

    const result = await new Promise((resolve, reject) => {
      db.run(deleteQuery, [parseInt(daysOld)], function(err) {
        if (err) reject(err);
        else resolve({ deletedCount: this.changes });
      });
    });

    res.json({
      success: true,
      deletedCount: result.deletedCount,
      message: `Deleted ${result.deletedCount} old receipts older than ${daysOld} days`
    });
  } catch (error) {
    console.error('Error cleaning up receipts:', error);
    next(error);
  }
});

/**
 * Check if receipt exists for payment
 * GET /api/receipts/check/:paymentId
 */
router.get('/check/:paymentId', async (req, res, next) => {
  try {
    const { paymentId } = req.params;

    const receipt = await receiptService.getReceiptByPaymentId(paymentId);

    res.json({
      success: true,
      hasReceipt: !!receipt,
      receipt: receipt ? {
        receiptId: receipt.receipt_number,
        fileName: receipt.file_name,
        generatedAt: receipt.generated_at,
        downloadCount: receipt.download_count,
        downloadUrl: `/api/receipts/download/${receipt.file_name}`
      } : null
    });
  } catch (error) {
    console.error('Error checking receipt:', error);
    next(error);
  }
});

module.exports = router;
