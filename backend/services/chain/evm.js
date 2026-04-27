const { JsonRpcProvider } = require('ethers');

const clients = new Map();

function getEvmClient({ rpcUrl }) {
  const key = rpcUrl || 'default';
  if (!clients.has(key)) {
    if (!rpcUrl) {
      // Provider can still be constructed, but requests will fail with a clear error.
      clients.set(key, new JsonRpcProvider());
    } else {
      clients.set(key, new JsonRpcProvider(rpcUrl));
    }
  }
  return clients.get(key);
}

module.exports = { getEvmClient };

