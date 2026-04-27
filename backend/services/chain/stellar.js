const StellarSdk = require('stellar-sdk');

const clients = new Map();

function getStellarClient({ horizonUrl }) {
  const key = horizonUrl || 'default';
  if (clients.has(key)) return clients.get(key);

  const server = new StellarSdk.Horizon.Server(horizonUrl);

  const client = {
    async getLatestLedger() {
      const res = await server.ledgers().order('desc').limit(1).call();
      const record = res?.records?.[0];
      if (!record) throw new Error('No ledger records returned');
      return record;
    },

    async getFeeStats() {
      // Horizon fee_stats endpoint is available on Horizon.Server
      // stellar-sdk exposes it via server.feeStats()
      const stats = await server.feeStats();
      return stats;
    },

    async getTransaction(txHash) {
      try {
        const tx = await server.transactions().transaction(txHash).call();
        return tx;
      } catch (e) {
        // Horizon returns 404 for unknown tx hash; treat as not found
        if (e?.response?.status === 404) return null;
        if (e?.status === 404) return null;
        throw e;
      }
    },
  };

  clients.set(key, client);
  return client;
}

module.exports = { getStellarClient };

