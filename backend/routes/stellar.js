const express = require('express');
const { stellarService } = require('../services/stellarService');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

/**
 * @route   GET /api/stellar/network
 * @desc    Get current network configuration
 * @access  Public
 */
router.get('/network', (req, res) => {
  try {
    const networkInfo = stellarService.getCurrentNetwork();
    res.json({
      success: true,
      ...networkInfo
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/network/switch
 * @desc    Switch between testnet and mainnet
 * @access  Private (Admin only)
 */
router.post('/network/switch', authenticateToken, async (req, res) => {
  try {
    const { network } = req.body;
    
    if (!['testnet', 'mainnet'].includes(network)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid network. Must be "testnet" or "mainnet"'
      });
    }

    const result = stellarService.switchNetwork(network);
    res.json({
      success: true,
      ...result,
      message: `Successfully switched to ${network}`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stellar/network/health
 * @desc    Get network health status
 * @access  Public
 */
router.get('/network/health', async (req, res) => {
  try {
    const health = await stellarService.getNetworkHealth();
    res.json({
      success: true,
      ...health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/account/create
 * @desc    Create a new Stellar account
 * @access  Private
 */
router.post('/account/create', authenticateToken, async (req, res) => {
  try {
    const account = await stellarService.createAccount();
    res.status(201).json({
      success: true,
      ...account
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stellar/account/:publicKey
 * @desc    Get account details and balances
 * @access  Public
 */
router.get('/account/:publicKey', async (req, res) => {
  try {
    const { publicKey } = req.params;
    
    if (!publicKey || !publicKey.startsWith('G')) {
      return res.status(400).json({
        success: false,
        error: 'Invalid Stellar public key'
      });
    }

    const accountDetails = await stellarService.getAccountDetails(publicKey);
    res.json({
      success: true,
      publicKey,
      ...accountDetails
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      return res.status(404).json({
        success: false,
        error: error.message
      });
    }
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/transfer
 * @desc    Transfer XLM or tokens
 * @access  Private
 */
router.post('/transfer', authenticateToken, async (req, res) => {
  try {
    const { fromPublicKey, toPublicKey, amount, assetCode = 'XLM', memo = '' } = req.body;

    // Validation
    if (!fromPublicKey || !toPublicKey || !amount) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: fromPublicKey, toPublicKey, amount'
      });
    }

    if (amount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Amount must be greater than 0'
      });
    }

    const result = await stellarService.transfer(fromPublicKey, toPublicKey, amount, assetCode, memo);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/token/create
 * @desc    Create custom token (anchored asset)
 * @access  Private (Issuer only)
 */
router.post('/token/create', authenticateToken, async (req, res) => {
  try {
    const { issuerPublicKey, tokenCode, domain } = req.body;

    if (!issuerPublicKey || !tokenCode) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: issuerPublicKey, tokenCode'
      });
    }

    const result = await stellarService.createToken(issuerPublicKey, tokenCode, domain);
    res.status(201).json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stellar/transaction/:txHash
 * @desc    Get transaction details by hash
 * @access  Public
 */
router.get('/transaction/:txHash', async (req, res) => {
  try {
    const { txHash } = req.params;
    const transaction = await stellarService.getTransaction(txHash);
    
    if (!transaction) {
      return res.status(404).json({
        success: false,
        error: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      ...transaction
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stellar/ledger/latest
 * @desc    Get latest ledger information
 * @access  Public
 */
router.get('/ledger/latest', async (req, res) => {
  try {
    const ledger = await stellarService.getLatestLedger();
    res.json({
      success: true,
      ...ledger
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stellar/fees
 * @desc    Get current fee statistics
 * @access  Public
 */
router.get('/fees', async (req, res) => {
  try {
    const feeStats = await stellarService.getFeeStats();
    res.json({
      success: true,
      network: stellarService.getCurrentNetwork().network,
      feeStats: feeStats || { message: 'Fee stats not available' }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/transaction/build
 * @desc    Build a transaction with multiple operations
 * @access  Private
 */
router.post('/transaction/build', authenticateToken, async (req, res) => {
  try {
    const { sourcePublicKey, operations, memo = '' } = req.body;

    if (!sourcePublicKey || !operations || !Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: sourcePublicKey, operations (array)'
      });
    }

    const result = await stellarService.buildTransaction(sourcePublicKey, operations, memo);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/transaction/sign
 * @desc    Sign a transaction XDR
 * @access  Private
 */
router.post('/transaction/sign', authenticateToken, async (req, res) => {
  try {
    const { transactionXDR, publicKey } = req.body;

    if (!transactionXDR || !publicKey) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: transactionXDR, publicKey'
      });
    }

    const result = await stellarService.signTransaction(transactionXDR, publicKey);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   POST /api/stellar/transaction/submit
 * @desc    Submit a signed transaction
 * @access  Private
 */
router.post('/transaction/submit', authenticateToken, async (req, res) => {
  try {
    const { signedXDR } = req.body;

    if (!signedXDR) {
      return res.status(400).json({
        success: false,
        error: 'Missing required field: signedXDR'
      });
    }

    const result = await stellarService.submitTransaction(signedXDR);
    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @route   GET /api/stellar/account/:publicKey/stream
 * @desc    Stream transactions for an account (Server-Sent Events)
 * @access  Public
 */
router.get('/account/:publicKey/stream', (req, res) => {
  try {
    const { publicKey } = req.params;
    
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', network: stellarService.getCurrentNetwork().network })}\n\n`);

    // Start streaming
    const stream = stellarService.streamTransactions(
      publicKey,
      (payment) => {
        res.write(`data: ${JSON.stringify({ type: 'payment', ...payment })}\n\n`);
      },
      (error) => {
        res.write(`data: ${JSON.stringify({ type: 'error', error: error.message })}\n\n`);
        res.end();
      }
    );

    // Handle client disconnect
    req.on('close', () => {
      if (stream) {
        // Clean up stream if needed
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
