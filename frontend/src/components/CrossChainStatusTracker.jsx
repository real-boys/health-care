import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw, ExternalLink, Search } from 'lucide-react';
import { buildExplorerTxUrl, getEnabledNetworks } from '../chain/networks';

export default function CrossChainStatusTracker() {
  const networks = useMemo(() => getEnabledNetworks(), []);
  const [networkId, setNetworkId] = useState(networks[0]?.id || '');
  const [txHash, setTxHash] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const explorerUrl = useMemo(() => {
    if (!networkId || !txHash) return null;
    return buildExplorerTxUrl(networkId, txHash);
  }, [networkId, txHash]);

  const fetchStatus = async () => {
    if (!networkId || !txHash) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ networkId, txHash });
      const resp = await fetch(`/api/chain/tx-status?${params}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to fetch status');
      setResult(data);
    } catch (e) {
      setError(e.message || String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setResult(null);
    setError(null);
  }, [networkId]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Cross-chain Transaction Status</h1>
        <p className="text-gray-600 mt-2">
          Paste a tx hash from Stellar or EVM to track confirmation/finality status.
        </p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Network</label>
            <select
              value={networkId}
              onChange={(e) => setNetworkId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {networks.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.displayName}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Transaction hash</label>
            <div className="flex gap-2">
              <input
                value={txHash}
                onChange={(e) => setTxHash(e.target.value.trim())}
                placeholder="0x… (EVM) or Stellar tx hash"
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={fetchStatus}
                disabled={loading || !txHash}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Track
              </button>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-gray-500">
            {explorerUrl ? (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
              >
                View in explorer <ExternalLink className="w-4 h-4" />
              </a>
            ) : (
              <span>Explorer link will appear once a hash is entered.</span>
            )}
          </div>
          <button
            onClick={fetchStatus}
            disabled={loading || !txHash}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="mt-6">
          {error && (
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {error}
            </div>
          )}

          {!error && !result && (
            <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
              Enter a tx hash and click Track.
            </div>
          )}

          {result && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border border-gray-200 bg-white">
                <div className="text-xs text-gray-500">Status</div>
                <div className="text-lg font-semibold text-gray-900">{result.status}</div>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 bg-white">
                <div className="text-xs text-gray-500">Confirmations</div>
                <div className="text-lg font-semibold text-gray-900">{result.confirmations}</div>
              </div>
              <div className="p-4 rounded-lg border border-gray-200 bg-white">
                <div className="text-xs text-gray-500">Network</div>
                <div className="text-lg font-semibold text-gray-900">{result.networkId}</div>
              </div>

              <div className="md:col-span-3 p-4 rounded-lg border border-gray-200 bg-gray-50">
                <div className="text-xs text-gray-500 mb-2">Receipt (normalized)</div>
                <pre className="text-xs text-gray-800 overflow-x-auto">
                  {JSON.stringify(result.receipt, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

