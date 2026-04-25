const StellarSdk = require('stellar-sdk');
const axios = require('axios');

/**
 * Stellar Network Integration Service
 * Supports both testnet and mainnet with network switching
 */
class StellarService {
  constructor() {
    this.networks = {
      testnet: {
        horizonUrl: 'https://horizon-testnet.stellar.org',
        networkPassphrase: StellarSdk.Networks.TESTNET,
        friendbotUrl: 'https://friendbot.stellar.org'
      },
      mainnet: {
        horizonUrl: 'https://horizon-mainnet.stellar.org',
        networkPassphrase: StellarSdk.Networks.PUBLIC,
        friendbotUrl: null
      }
    };
    
    this.currentNetwork = process.env.STELLAR_NETWORK || 'testnet';
    this.server = this.getStellarServer(this.currentNetwork);
    this.keypairs = new Map(); // Store keypairs for accounts
  }

  /**
   * Get Stellar server for specified network
   */
  getStellarServer(networkName) {
    const network = this.networks[networkName];
    if (!network) {
      throw new Error(`Unknown network: ${networkName}`);
    }
    
    StellarSdk.Network.use(new StellarSdk.Network(network.networkPassphrase));
    return new StellarSdk.Horizon.Server(network.horizonUrl);
  }

  /**
   * Switch between testnet and mainnet
   */
  switchNetwork(networkName) {
    if (!this.networks[networkName]) {
      throw new Error(`Network ${networkName} not supported`);
    }
    
    this.currentNetwork = networkName;
    this.server = this.getStellarServer(networkName);
    
    return {
      success: true,
      network: networkName,
      horizonUrl: this.networks[networkName].horizonUrl,
      isTestnet: networkName === 'testnet'
    };
  }

  /**
   * Get current network info
   */
  getCurrentNetwork() {
    return {
      network: this.currentNetwork,
      horizonUrl: this.networks[this.currentNetwork].horizonUrl,
      isTestnet: this.currentNetwork === 'testnet'
    };
  }

  /**
   * Create a new Stellar account
   */
  async createAccount() {
    const keypair = StellarSdk.Keypair.random();
    const publicKey = keypair.publicKey();
    const secretKey = keypair.secret();
    
    // Store keypair securely (in production, use encrypted storage)
    this.keypairs.set(publicKey, keypair);
    
    // Fund account on testnet using Friendbot
    if (this.currentNetwork === 'testnet') {
      try {
        await axios.get(`${this.networks.testnet.friendbotUrl}?addr=${publicKey}`);
      } catch (error) {
        throw new Error(`Failed to fund account: ${error.message}`);
      }
    }
    
    return {
      publicKey,
      secretKey,
      network: this.currentNetwork,
      message: this.currentNetwork === 'testnet' 
        ? 'Account created and funded with test lumens' 
        : 'Account created - please fund with XLM'
    };
  }

  /**
   * Get account details and balance
   */
  async getAccountDetails(publicKey) {
    try {
      const account = await this.server.loadAccount(publicKey);
      
      const balances = account.balances.map(balance => ({
        assetType: balance.asset_type,
        balance: balance.balance,
        limit: balance.limit || null,
        buyingLiabilities: balance.buying_liabilities,
        sellingLiabilities: balance.selling_liabilities
      }));
      
      return {
        id: account.id,
        subentryCount: account.subentry_count,
        thresholds: account.thresholds,
        flags: account.flags,
        signers: account.signers,
        balances,
        sequence: account.sequence,
        data: account.data
      };
    } catch (error) {
      if (error.response?.status === 404) {
        throw new Error(`Account ${publicKey} not found`);
      }
      throw error;
    }
  }

  /**
   * Transfer XLM or tokens
   */
  async transfer(fromPublicKey, toPublicKey, amount, assetCode = 'XLM', memo = '') {
    try {
      const sourceKeypair = this.keypairs.get(fromPublicKey);
      if (!sourceKeypair) {
        throw new Error('Source keypair not found');
      }

      const sourceAccount = await this.server.loadAccount(fromPublicKey);
      
      // Build transaction
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        timebounds: await this.server.fetchTimebounds(100)
      })
        .addOperation(StellarSdk.Operation.payment({
          destination: toPublicKey,
          asset: assetCode === 'XLM' 
            ? StellarSdk.Asset.native() 
            : new StellarSdk.Asset(assetCode, fromPublicKey),
          amount: amount.toString()
        }))
        .addMemo(memo ? StellarSdk.Memo.text(memo) : StellarSdk.Memo.none())
        .build();

      // Sign and submit
      transaction.sign(sourceKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        transactionHash: result.hash,
        ledger: result.ledger,
        createdAt: result.created_at,
        amount,
        asset: assetCode,
        from: fromPublicKey,
        to: toPublicKey
      };
    } catch (error) {
      throw new Error(`Transfer failed: ${error.message}`);
    }
  }

  /**
   * Create custom token (anchored asset)
   */
  async createToken(issuerPublicKey, tokenCode, domain = '') {
    try {
      const issuerKeypair = this.keypairs.get(issuerPublicKey);
      if (!issuerKeypair) {
        throw new Error('Issuer keypair not found');
      }

      const sourceAccount = await this.server.loadAccount(issuerPublicKey);
      
      // Create trustline operation (for issuing tokens)
      const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
        fee: StellarSdk.BASE_FEE,
        timebounds: await this.server.fetchTimebounds(100)
      })
        .addOperation(StellarSdk.Operation.setOptions({
          homeDomain: domain || 'stellar.org'
        }))
        .build();

      transaction.sign(issuerKeypair);
      const result = await this.server.submitTransaction(transaction);
      
      return {
        success: true,
        transactionHash: result.hash,
        tokenCode,
        issuer: issuerPublicKey,
        domain
      };
    } catch (error) {
      throw new Error(`Token creation failed: ${error.message}`);
    }
  }

  /**
   * Get transaction by hash
   */
  async getTransaction(txHash) {
    try {
      const tx = await this.server.transactions().transaction(txHash).call();
      return {
        hash: tx.hash,
        ledger: tx.ledger_attr,
        createdAt: tx.created_at,
        sourceAccount: tx.source_account,
        feeCharged: tx.fee_charged,
        operationCount: tx.operation_count,
        successful: tx.successful,
        memo: tx.memo
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  /**
   * Get latest ledger info
   */
  async getLatestLedger() {
    const response = await this.server.ledgers().order('desc').limit(1).call();
    const record = response.records[0];
    
    return {
      sequence: record.sequence,
      hash: record.hash,
      closedAt: record.closed_at,
      transactionCount: record.transaction_count,
      operationCount: record.operation_count,
      totalCoins: record.total_coins,
      feePool: record.fee_pool
    };
  }

  /**
   * Get fee statistics
   */
  async getFeeStats() {
    try {
      const stats = await this.server.feeStats();
      return {
        lastLedger: stats.last_ledger,
        p10: stats.p10_accepted_fee,
        p20: stats.p20_accepted_fee,
        p30: stats.p30_accepted_fee,
        p40: stats.p40_accepted_fee,
        p50: stats.p50_accepted_fee,
        p60: stats.p60_accepted_fee,
        p70: stats.p70_accepted_fee,
        p80: stats.p80_accepted_fee,
        p90: stats.p90_accepted_fee,
        p95: stats.p95_accepted_fee,
        p99: stats.p99_accepted_fee,
        mode: stats.mode_accepted_fee,
        min: stats.min_accepted_fee
      };
    } catch (error) {
      // Fee stats endpoint may not be available on all Horizon instances
      return null;
    }
  }

  /**
   * Listen for account transactions (streaming)
   */
  streamTransactions(publicKey, onTransaction, onError) {
    return this.server.payments()
      .forAccount(publicKey)
      .cursor('now')
      .stream({
        onmessage: (payment) => {
          onTransaction({
            type: payment.type,
            transactionHash: payment.transaction_hash,
            from: payment.from,
            to: payment.to,
            assetType: payment.asset_type,
            amount: payment.amount,
            createdAt: payment.created_at
          });
        },
        onerror: onError
      });
  }

  /**
   * Build and sign transaction (advanced)
   */
  async buildTransaction(sourcePublicKey, operations, memo = '') {
    const sourceAccount = await this.server.loadAccount(sourcePublicKey);
    
    const transaction = new StellarSdk.TransactionBuilder(sourceAccount, {
      fee: StellarSdk.BASE_FEE,
      timebounds: await this.server.fetchTimebounds(100)
    });

    // Add operations
    operations.forEach(op => {
      switch (op.type) {
        case 'payment':
          transaction.addOperation(StellarSdk.Operation.payment({
            destination: op.destination,
            asset: op.asset === 'XLM' 
              ? StellarSdk.Asset.native() 
              : new StellarSdk.Asset(op.assetCode, op.assetIssuer),
            amount: op.amount.toString()
          }));
          break;
        case 'createAccount':
          transaction.addOperation(StellarSdk.Operation.createAccount({
            destination: op.destination,
            startingBalance: op.startingBalance.toString()
          }));
          break;
        case 'changeTrust':
          transaction.addOperation(StellarSdk.Operation.changeTrust({
            asset: op.asset === 'XLM'
              ? StellarSdk.Asset.native()
              : new StellarSdk.Asset(op.assetCode, op.assetIssuer),
            limit: op.limit?.toString()
          }));
          break;
        default:
          throw new Error(`Unknown operation type: ${op.type}`);
      }
    });

    // Add memo if provided
    if (memo) {
      transaction.addMemo(StellarSdk.Memo.text(memo));
    }

    const builtTx = transaction.build();
    
    return {
      transactionXDR: builtTx.toXDR(),
      hash: builtTx.hash(),
      operations: operations.length,
      fee: operations.length * StellarSdk.BASE_FEE
    };
  }

  /**
   * Sign transaction XDR
   */
  signTransaction(transactionXDR, publicKey) {
    const keypair = this.keypairs.get(publicKey);
    if (!keypair) {
      throw new Error('Keypair not found for public key');
    }

    const transaction = StellarSdk.TransactionBuilder.fromXDR(transactionXDR, this.server.network());
    transaction.sign(keypair);
    
    return {
      signedXDR: transaction.toXDR(),
      hash: transaction.hash(),
      signatures: transaction.signatures.length
    };
  }

  /**
   * Submit signed transaction
   */
  async submitTransaction(signedXDR) {
    const transaction = StellarSdk.TransactionBuilder.fromXDR(signedXDR, this.server.network());
    const result = await this.server.submitTransaction(transaction);
    
    return {
      success: true,
      transactionHash: result.hash,
      ledger: result.ledger,
      createdAt: result.created_at
    };
  }

  /**
   * Get network health status
   */
  async getNetworkHealth() {
    try {
      const latestLedger = await this.getLatestLedger();
      const feeStats = await this.getFeeStats();
      
      return {
        status: 'healthy',
        network: this.currentNetwork,
        latestLedger: latestLedger.sequence,
        lastLedgerTime: latestLedger.closedAt,
        averageFee: feeStats?.p50 || 100,
        transactionVolume: latestLedger.transaction_count,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      return {
        status: 'degraded',
        network: this.currentNetwork,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }
}

// Export singleton instance
const stellarService = new StellarService();
module.exports = { StellarService, stellarService };
