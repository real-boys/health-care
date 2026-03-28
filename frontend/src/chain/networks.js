export const NETWORK_FAMILY = {
  EVM: 'evm',
  STELLAR: 'stellar',
};

export const DEFAULT_NETWORKS = [
  {
    id: 'evm-sepolia',
    family: NETWORK_FAMILY.EVM,
    displayName: 'Sepolia',
    nativeSymbol: 'ETH',
    explorerBaseUrl: 'https://sepolia.etherscan.io',
    isTestnet: true,
    enabled: true,
  },
  {
    id: 'stellar-testnet',
    family: NETWORK_FAMILY.STELLAR,
    displayName: 'Stellar Testnet',
    nativeSymbol: 'XLM',
    explorerBaseUrl: 'https://stellar.expert/explorer/testnet',
    isTestnet: true,
    enabled: true,
  },
];

export function getNetworkById(networkId) {
  return DEFAULT_NETWORKS.find((n) => n.id === networkId) || null;
}

export function getEnabledNetworks() {
  return DEFAULT_NETWORKS.filter((n) => n.enabled);
}

export function buildExplorerTxUrl(networkId, txHash) {
  const n = getNetworkById(networkId);
  if (!n || !txHash) return null;
  if (n.family === NETWORK_FAMILY.EVM) return `${n.explorerBaseUrl}/tx/${txHash}`;
  return `${n.explorerBaseUrl}/tx/${txHash}`;
}

