const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const crypto = require('crypto');
const { getEvmClient } = require('../services/chain/evm');
const { getStellarClient } = require('../services/chain/stellar');

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

function nowIso() {
  return new Date().toISOString();
}

function defaultNetworks() {
  return [
    {
      id: 'evm-sepolia',
      family: 'evm',
      displayName: 'Sepolia',
      nativeSymbol: 'ETH',
      rpcUrl: process.env.EVM_SEPOLIA_RPC_URL || '',
      explorerBaseUrl: 'https://sepolia.etherscan.io',
      isTestnet: true,
      enabled: true,
    },
    {
      id: 'evm-ethereum',
      family: 'evm',
      displayName: 'Ethereum',
      nativeSymbol: 'ETH',
      rpcUrl: process.env.EVM_ETHEREUM_RPC_URL || '',
      explorerBaseUrl: 'https://etherscan.io',
      isTestnet: false,
      enabled: false,
    },
    {
      id: 'stellar-testnet',
      family: 'stellar',
      displayName: 'Stellar Testnet',
      nativeSymbol: 'XLM',
      horizonUrl: process.env.STELLAR_TESTNET_HORIZON_URL || 'https://horizon-testnet.stellar.org',
      sorobanRpcUrl: process.env.SOROBAN_TESTNET_RPC_URL || 'https://soroban-testnet.stellar.org',
      explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
      isTestnet: true,
      enabled: true,
    },
    {
      id: 'stellar-public',
      family: 'stellar',
      displayName: 'Stellar Public',
      nativeSymbol: 'XLM',
      horizonUrl: process.env.STELLAR_PUBLIC_HORIZON_URL || 'https://horizon.stellar.org',
      sorobanRpcUrl: process.env.SOROBAN_PUBLIC_RPC_URL || 'https://soroban.stellar.org',
      explorerBaseUrl: 'https://stellar.expert/explorer/public',
      isTestnet: false,
      enabled: false,
    },
  ];
}

async function ensureSchema() {
  const db = getDatabase();
  try {
    await new Promise((resolve, reject) => {
      db.run(
        `
        CREATE TABLE IF NOT EXISTS cross_chain_txs (
          id TEXT PRIMARY KEY,
          created_at TEXT NOT NULL,
          source_network_id TEXT NOT NULL,
          dest_network_id TEXT NOT NULL,
          source_tx_hash TEXT,
          dest_tx_hash TEXT,
          status TEXT NOT NULL,
          asset_in TEXT NOT NULL,
          amount_in TEXT NOT NULL,
          asset_out TEXT,
          amount_out TEXT,
          bridge_provider TEXT,
          estimated_fees_json TEXT,
          actual_fees_json TEXT,
          metadata_json TEXT
        )
      `,
        (err) => (err ? reject(err) : resolve())
      );
    });
  } finally {
    db.close();
  }
}

router.get('/networks', async (_req, res, next) => {
  try {
    res.json({ networks: defaultNetworks().filter((n) => n.enabled) });
  } catch (e) {
    next(e);
  }
});

router.get('/health', async (_req, res, next) => {
  try {
    const networks = defaultNetworks().filter((n) => n.enabled);
    const checks = await Promise.all(
      networks.map(async (n) => {
        const started = Date.now();
        try {
          if (n.family === 'evm') {
            const evm = getEvmClient({ rpcUrl: n.rpcUrl });
            const blockNumber = await evm.getBlockNumber();
            const feeData = await evm.getFeeData();
            return {
              networkId: n.id,
              ok: true,
              latencyMs: Date.now() - started,
              details: {
                blockNumber,
                feeData: {
                  gasPrice: feeData.gasPrice?.toString?.() ?? null,
                  maxFeePerGas: feeData.maxFeePerGas?.toString?.() ?? null,
                  maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString?.() ?? null,
                },
              },
            };
          }

          const stellar = getStellarClient({ horizonUrl: n.horizonUrl });
          const latest = await stellar.getLatestLedger();
          const feeStats = await stellar.getFeeStats();
          return {
            networkId: n.id,
            ok: true,
            latencyMs: Date.now() - started,
            details: {
              latestLedger: latest.sequence,
              latestLedgerClosedAt: latest.closed_at,
              feeStats,
            },
          };
        } catch (err) {
          return {
            networkId: n.id,
            ok: false,
            latencyMs: Date.now() - started,
            error: err?.message || String(err),
          };
        }
      })
    );

    res.json({
      timestamp: nowIso(),
      checks,
    });
  } catch (e) {
    next(e);
  }
});

router.get('/fees', async (_req, res, next) => {
  try {
    const networks = defaultNetworks().filter((n) => n.enabled);
    const fees = await Promise.all(
      networks.map(async (n) => {
        if (n.family === 'evm') {
          const evm = getEvmClient({ rpcUrl: n.rpcUrl });
          const feeData = await evm.getFeeData();
          return {
            networkId: n.id,
            family: n.family,
            nativeSymbol: n.nativeSymbol,
            feeData: {
              gasPrice: feeData.gasPrice?.toString?.() ?? null,
              maxFeePerGas: feeData.maxFeePerGas?.toString?.() ?? null,
              maxPriorityFeePerGas: feeData.maxPriorityFeePerGas?.toString?.() ?? null,
            },
          };
        }

        const stellar = getStellarClient({ horizonUrl: n.horizonUrl });
        const feeStats = await stellar.getFeeStats();
        return {
          networkId: n.id,
          family: n.family,
          nativeSymbol: n.nativeSymbol,
          feeData: feeStats,
        };
      })
    );

    res.json({ timestamp: nowIso(), fees });
  } catch (e) {
    next(e);
  }
});

router.get('/bridge-options', async (req, res, next) => {
  try {
    const { sourceNetworkId, destNetworkId } = req.query;
    const networks = defaultNetworks().filter((n) => n.enabled);
    const src = networks.find((n) => n.id === sourceNetworkId);
    const dst = networks.find((n) => n.id === destNetworkId);

    if (!src || !dst) {
      return res.status(400).json({ error: 'Invalid or disabled networks' });
    }

    // Manual bridge options (deep links). These are placeholders meant for admin-config later.
    const options = [
      {
        id: 'manual-external-bridge',
        type: 'manual',
        displayName: 'External Bridge (manual)',
        description:
          'Opens an external bridge. You will paste/verify tx hashes to track completion.',
        warnings: [
          'Always verify destination address and any required memo/tag.',
          'Finality and timings vary by network.',
        ],
        deepLinkUrl: null,
        supported: true,
      },
    ];

    res.json({
      sourceNetworkId: src.id,
      destNetworkId: dst.id,
      options,
    });
  } catch (e) {
    next(e);
  }
});

router.post('/cross-chain-tx', async (req, res, next) => {
  try {
    await ensureSchema();
    const {
      sourceNetworkId,
      destNetworkId,
      sourceTxHash = null,
      destTxHash = null,
      status = 'created',
      assetIn,
      amountIn,
      assetOut = null,
      amountOut = null,
      bridgeProvider = 'manual-external-bridge',
      estimatedFees = null,
      actualFees = null,
      metadata = null,
    } = req.body || {};

    if (!sourceNetworkId || !destNetworkId || !assetIn || amountIn == null) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const id = crypto.randomUUID ? crypto.randomUUID() : `cctx_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
    const createdAt = nowIso();

    const db = getDatabase();
    try {
      await new Promise((resolve, reject) => {
        db.run(
          `
          INSERT INTO cross_chain_txs (
            id, created_at, source_network_id, dest_network_id,
            source_tx_hash, dest_tx_hash, status,
            asset_in, amount_in, asset_out, amount_out,
            bridge_provider, estimated_fees_json, actual_fees_json, metadata_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
          [
            id,
            createdAt,
            sourceNetworkId,
            destNetworkId,
            sourceTxHash,
            destTxHash,
            status,
            String(assetIn),
            String(amountIn),
            assetOut ? String(assetOut) : null,
            amountOut != null ? String(amountOut) : null,
            bridgeProvider,
            estimatedFees ? JSON.stringify(estimatedFees) : null,
            actualFees ? JSON.stringify(actualFees) : null,
            metadata ? JSON.stringify(metadata) : null,
          ],
          (err) => (err ? reject(err) : resolve())
        );
      });
    } finally {
      db.close();
    }

    res.status(201).json({ id, createdAt });
  } catch (e) {
    next(e);
  }
});

router.get('/cross-chain-tx/:id', async (req, res, next) => {
  try {
    await ensureSchema();
    const { id } = req.params;
    const db = getDatabase();
    try {
      const row = await new Promise((resolve, reject) => {
        db.get('SELECT * FROM cross_chain_txs WHERE id = ?', [id], (err, r) => {
          if (err) reject(err);
          else resolve(r);
        });
      });

      if (!row) return res.status(404).json({ error: 'Not found' });

      res.json({
        ...row,
        estimated_fees: row.estimated_fees_json ? JSON.parse(row.estimated_fees_json) : null,
        actual_fees: row.actual_fees_json ? JSON.parse(row.actual_fees_json) : null,
        metadata: row.metadata_json ? JSON.parse(row.metadata_json) : null,
      });
    } finally {
      db.close();
    }
  } catch (e) {
    next(e);
  }
});

router.get('/tx-status', async (req, res, next) => {
  try {
    const { networkId, txHash } = req.query;
    if (!networkId || !txHash) {
      return res.status(400).json({ error: 'networkId and txHash are required' });
    }

    const network = defaultNetworks().find((n) => n.id === networkId && n.enabled);
    if (!network) return res.status(400).json({ error: 'Unknown/disabled networkId' });

    if (network.family === 'evm') {
      const evm = getEvmClient({ rpcUrl: network.rpcUrl });
      const receipt = await evm.getTransactionReceipt(String(txHash));
      if (!receipt) {
        return res.json({
          networkId,
          txHash,
          status: 'pending',
          confirmations: 0,
          receipt: null,
        });
      }
      const latest = await evm.getBlockNumber();
      const confirmations = receipt.blockNumber ? Math.max(0, latest - receipt.blockNumber + 1) : 0;
      return res.json({
        networkId,
        txHash,
        status: receipt.status === 1 ? 'confirmed' : 'failed',
        confirmations,
        receipt: {
          blockNumber: receipt.blockNumber,
          transactionHash: receipt.hash,
          gasUsed: receipt.gasUsed?.toString?.() ?? null,
          effectiveGasPrice: receipt.effectiveGasPrice?.toString?.() ?? null,
        },
      });
    }

    const stellar = getStellarClient({ horizonUrl: network.horizonUrl });
    const tx = await stellar.getTransaction(String(txHash));
    if (!tx) {
      return res.json({
        networkId,
        txHash,
        status: 'pending',
        confirmations: 0,
        receipt: null,
      });
    }
    const latest = await stellar.getLatestLedger();
    const confirmations = tx.ledger_attr && latest?.sequence ? Math.max(0, latest.sequence - tx.ledger_attr + 1) : 0;
    return res.json({
      networkId,
      txHash,
      status: tx.successful ? 'confirmed' : 'failed',
      confirmations,
      receipt: {
        ledger: tx.ledger_attr || null,
        createdAt: tx.created_at || null,
        feeCharged: tx.fee_charged || null,
        successful: tx.successful,
      },
    });
  } catch (e) {
    next(e);
  }
});

module.exports = router;

