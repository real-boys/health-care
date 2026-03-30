import React, { useEffect, useMemo, useState } from 'react';
import { ArrowRightLeft, ExternalLink, Plus, RefreshCw } from 'lucide-react';
import { getEnabledNetworks } from '../chain/networks';
import AssetConversionDisplay from './AssetConversionDisplay';

export default function BridgeManager() {
  const networks = useMemo(() => getEnabledNetworks(), []);
  const [sourceNetworkId, setSourceNetworkId] = useState(networks[0]?.id || '');
  const [destNetworkId, setDestNetworkId] = useState(networks[1]?.id || networks[0]?.id || '');
  const [assetIn, setAssetIn] = useState('USDC');
  const [amountIn, setAmountIn] = useState('100');

  const [bridgeOptions, setBridgeOptions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdId, setCreatedId] = useState(null);
  const [error, setError] = useState(null);

  const fetchOptions = async () => {
    if (!sourceNetworkId || !destNetworkId) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ sourceNetworkId, destNetworkId });
      const resp = await fetch(`/api/chain/bridge-options?${params}`);
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to load bridge options');
      setBridgeOptions(data);
    } catch (e) {
      setBridgeOptions(null);
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOptions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceNetworkId, destNetworkId]);

  const createCrossChainTx = async (bridgeProvider) => {
    setCreating(true);
    setError(null);
    setCreatedId(null);
    try {
      const resp = await fetch('/api/chain/cross-chain-tx', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceNetworkId,
          destNetworkId,
          assetIn,
          amountIn,
          bridgeProvider,
          status: 'created',
          metadata: { ui: 'BridgeManager' },
        }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.error || 'Failed to create record');
      setCreatedId(data.id);
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Bridge Management</h1>
        <p className="text-gray-600 mt-2">
          Create and track cross-chain bridge operations (manual mode) between Stellar and EVM.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Source network</label>
              <select
                value={sourceNetworkId}
                onChange={(e) => setSourceNetworkId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.displayName}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination network</label>
              <select
                value={destNetworkId}
                onChange={(e) => setDestNetworkId(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {networks.map((n) => (
                  <option key={n.id} value={n.id}>
                    {n.displayName}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Asset</label>
              <select
                value={assetIn}
                onChange={(e) => setAssetIn(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="USDC">USDC</option>
                <option value="XLM">XLM</option>
                <option value="ETH">ETH</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
              <input
                value={amountIn}
                onChange={(e) => setAmountIn(e.target.value)}
                type="number"
                min="0"
                step="any"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2 text-gray-700">
              <ArrowRightLeft className="w-5 h-5" />
              <span className="text-sm">Bridge options</span>
            </div>
            <button
              onClick={fetchOptions}
              disabled={loading}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          <div className="mt-3">
            {error && (
              <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {error}
              </div>
            )}

            {!error && !bridgeOptions && (
              <div className="p-4 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-600">
                Select networks to load bridge options.
              </div>
            )}

            {bridgeOptions && (
              <div className="space-y-3">
                {(bridgeOptions.options || []).map((opt) => (
                  <div key={opt.id} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <div className="font-medium text-gray-900">{opt.displayName}</div>
                        <div className="text-sm text-gray-600">{opt.description}</div>
                        {opt.warnings?.length ? (
                          <ul className="mt-2 text-xs text-gray-500 list-disc ml-5">
                            {opt.warnings.map((w) => (
                              <li key={w}>{w}</li>
                            ))}
                          </ul>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {opt.deepLinkUrl && (
                          <a
                            href={opt.deepLinkUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 inline-flex items-center gap-2"
                          >
                            Open <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                        <button
                          onClick={() => createCrossChainTx(opt.id)}
                          disabled={creating}
                          className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Create
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {createdId && (
                  <div className="p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
                    Cross-chain tx record created: <span className="font-mono">{createdId}</span>
                    <div className="mt-2 text-green-700">
                      Next: complete the bridge externally, then track source/destination hashes in the Tx Tracker.
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Asset conversion</h2>
          <p className="text-sm text-gray-600 mb-4">
            Display a simple conversion estimate for the selected asset amount.
          </p>
          <AssetConversionDisplay
            from={assetIn}
            to="USD"
            amount={amountIn}
            fromNetwork={sourceNetworkId}
            toNetwork={destNetworkId}
          />
        </div>
      </div>
    </div>
  );
}

