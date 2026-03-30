const express = require('express');
const { body, query, param, validationResult } = require('express-validator');
const router = express.Router();

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Create a new transaction
router.post('/', [
  body('userId').notEmpty().withMessage('User ID is required'),
  body('type').isIn(['payment', 'refund', 'transfer', 'insurance_claim']).withMessage('Invalid transaction type'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be 3 characters'),
  body('fromAddress').optional().isEthereumAddress().withMessage('Invalid from address'),
  body('toAddress').optional().isEthereumAddress().withMessage('Invalid to address'),
  body('data').optional().isObject().withMessage('Data must be an object'),
  body('metadata').optional().isObject().withMessage('Metadata must be an object')
], handleValidationErrors, async (req, res) => {
  try {
    const transactionEvents = global.transactionEvents;
    if (!transactionEvents) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const transactionData = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      userId: req.body.userId,
      type: req.body.type,
      amount: req.body.amount,
      currency: req.body.currency || 'USD',
      fromAddress: req.body.fromAddress,
      toAddress: req.body.toAddress,
      data: req.body.data,
      metadata: req.body.metadata
    };

    const transaction = await transactionEvents.createTransaction(transactionData);
    
    res.status(201).json({
      success: true,
      transaction: {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        createdAt: transaction.createdAt
      }
    });
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'Failed to create transaction' });
  }
});

// Get transaction by ID
router.get('/:transactionId', [
  param('transactionId').notEmpty().withMessage('Transaction ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const transactionMonitor = global.transactionMonitor;
    if (!transactionMonitor) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const { transactionId } = req.params;
    const transaction = await transactionMonitor.getTransaction(transactionId);

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        userId: transaction.userId,
        type: transaction.type,
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        hash: transaction.hash,
        blockNumber: transaction.blockNumber,
        gasUsed: transaction.gasUsed,
        createdAt: transaction.created_at,
        updatedAt: transaction.updated_at,
        confirmedAt: transaction.confirmed_at,
        failedAt: transaction.failed_at,
        errorMessage: transaction.error_message
      }
    });
  } catch (error) {
    console.error('Error fetching transaction:', error);
    res.status(500).json({ error: 'Failed to fetch transaction' });
  }
});

// Get user transactions
router.get('/user/:userId', [
  param('userId').notEmpty().withMessage('User ID is required'),
  query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
  query('offset').optional().isInt({ min: 0 }).withMessage('Offset must be non-negative')
], handleValidationErrors, async (req, res) => {
  try {
    const transactionEvents = global.transactionEvents;
    if (!transactionEvents) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const transactions = await transactionEvents.getUserTransactions(userId, { limit, offset });

    res.json({
      success: true,
      transactions: transactions.map(tx => ({
        id: tx.id,
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        status: tx.status,
        hash: tx.hash,
        blockNumber: tx.block_number,
        createdAt: tx.created_at,
        updatedAt: tx.updated_at,
        confirmedAt: tx.confirmed_at,
        failedAt: tx.failed_at
      })),
      pagination: {
        limit,
        offset,
        count: transactions.length
      }
    });
  } catch (error) {
    console.error('Error fetching user transactions:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// Get transaction status
router.get('/:transactionId/status', [
  param('transactionId').notEmpty().withMessage('Transaction ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const transactionEvents = global.transactionEvents;
    if (!transactionEvents) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const { transactionId } = req.params;
    const status = await transactionEvents.getTransactionStatus(transactionId);

    if (!status) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transactionId,
      status
    });
  } catch (error) {
    console.error('Error fetching transaction status:', error);
    res.status(500).json({ error: 'Failed to fetch transaction status' });
  }
});

// Get transaction subscribers (admin endpoint)
router.get('/:transactionId/subscribers', [
  param('transactionId').notEmpty().withMessage('Transaction ID is required')
], handleValidationErrors, async (req, res) => {
  try {
    const transactionEvents = global.transactionEvents;
    if (!transactionEvents) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const { transactionId } = req.params;
    const subscribers = transactionEvents.getActiveSubscriptions(transactionId);

    res.json({
      success: true,
      transactionId,
      subscribers: subscribers.map(sub => ({
        socketId: sub.socketId,
        userId: sub.userId
      })),
      count: subscribers.length
    });
  } catch (error) {
    console.error('Error fetching transaction subscribers:', error);
    res.status(500).json({ error: 'Failed to fetch subscribers' });
  }
});

// Get system statistics (admin endpoint)
router.get('/system/stats', async (req, res) => {
  try {
    const transactionEvents = global.transactionEvents;
    if (!transactionEvents) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const stats = transactionEvents.getSystemStats();

    res.json({
      success: true,
      stats: {
        transactionMonitor: stats.transactionMonitor,
        transactionServer: stats.transactionServer,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error fetching system stats:', error);
    res.status(500).json({ error: 'Failed to fetch system stats' });
  }
});

// Manual status update (for testing/admin)
router.put('/:transactionId/status', [
  param('transactionId').notEmpty().withMessage('Transaction ID is required'),
  body('status').isIn(['pending', 'confirming', 'confirmed', 'failed']).withMessage('Invalid status'),
  body('errorMessage').optional().isString().withMessage('Error message must be a string'),
  body('blockNumber').optional().isInt().withMessage('Block number must be an integer'),
  body('gasUsed').optional().isInt().withMessage('Gas used must be an integer')
], handleValidationErrors, async (req, res) => {
  try {
    const transactionMonitor = global.transactionMonitor;
    if (!transactionMonitor) {
      return res.status(500).json({ error: 'Transaction service not available' });
    }

    const { transactionId } = req.params;
    const { status, errorMessage, blockNumber, gasUsed } = req.body;

    const additionalData = {};
    if (errorMessage) additionalData.errorMessage = errorMessage;
    if (blockNumber) additionalData.blockNumber = blockNumber;
    if (gasUsed) additionalData.gasUsed = gasUsed;

    const transaction = await transactionMonitor.updateTransactionStatus(
      transactionId,
      status,
      additionalData
    );

    if (!transaction) {
      return res.status(404).json({ error: 'Transaction not found' });
    }

    res.json({
      success: true,
      transaction: {
        id: transaction.id,
        status: transaction.status,
        updatedAt: transaction.updatedAt,
        errorMessage: transaction.errorMessage,
        blockNumber: transaction.blockNumber,
        gasUsed: transaction.gasUsed
      }
    });
  } catch (error) {
    console.error('Error updating transaction status:', error);
    res.status(500).json({ error: 'Failed to update transaction status' });
  }
});

module.exports = router;
