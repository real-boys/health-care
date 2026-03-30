import React, { useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { getEnabledNetworks } from '../chain/networks';

const EVM_GAS_PROFILES = {
  transfer: 21000,
  approve: 50000,
  swap: 180000,
  bridge: 260000,
};

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function TransactionCostComparison() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [feesData, setFeesData] = useState(null);
  const [action, setAction] = useState('transfer');
  const enabled = useMemo(() => getEnabledNetworks(), []);

  const fetchFees = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch('/api/chain/fees');
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Failed to load fees');
      setFeesData(json);
    } catch (e) {
      setError(e.message || String(e));
      setFeesData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFees();
  }, []);

  const comparisons = useMemo(() => {
    const fees = feesData?.fees || [];
    return fees.map((f) => {
      const network = enabled.find((n) => n.id === f.networkId);
      if (f.family === 'evm') {
        const gasUnits = EVM_GAS_PROFILES[action] || 21000;
        const gasPriceWei = toNumber(f.feeData?.gasPrice || f.feeData?.maxFeePerGas || 0);
        const costEth = gasPriceWei ? (gasPriceWei * gasUnits) / 1e18 : null;
        return {
          networkId: f.networkId,
          displayName: network?.displayName || f.networkId,
          nativeSymbol: network?.nativeSymbol || 'ETH',
          estimatedCost: costEth,
          estimateLabel: costEth != null ? `${costEth.toFixed(6)} ${network?.nativeSymbol || 'ETH'}` : 'N/A',
          details: `Gas profile: ${gasUnits.toLocaleString()} units`,
        };
      }

      const feeChargedMode = toNumber(f.feeData?.fee_charged?.mode) || toNumber(f.feeData?.max_fee?.mode) || null;
      const stroops = feeChargedMode;
      const xlm = stroops != null ? stroops / 1e7 : null;
      return {
        networkId: f.networkId,
        displayName: network?.displayName || f.networkId,
        nativeSymbol: network?.nativeSymbol || 'XLM',
        estimatedCost: xlm,
        estimateLabel: xlm != null ? `${xlm.toFixed(7)} ${network?.nativeSymbol || 'XLM'}` : 'N/A',
        details: 'Based on Horizon fee stats',
      };
    });
  }, [feesData, action, enabled]);

  const cheapest = useMemo(() => {
    const valid = comparisons.filter((c) => c.estimatedCost != null);
    if (!valid.length) return null;
    return valid.reduce((min, c) => (c.estimatedCost < min.estimatedCost ? c : min), valid[0]);
  }, [comparisons]);

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Transaction Cost Comparison</h1>
        <p className="text-gray-600 mt-2">Compare estimated network cost across Stellar and EVM networks.</p>
      </div>

      <div className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Action</label>
            <select
              value={action}
              onChange={(e) => setAction(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            >
              <option value="transfer">Transfer</option>
              <option value="approve">Approve</option>
              <option value="swap">Swap</option>
              <option value="bridge">Bridge</option>
            </select>
          </div>
          <button
            onClick={fetchFees}
            disabled={loading}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh fees
          </button>
        </div>

        {error && <div className="mt-4 text-sm text-red-700">{error}</div>}

        {cheapest && (
          <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200 text-sm text-green-800">
            Cheapest right now: <strong>{cheapest.displayName}</strong> ({cheapest.estimateLabel})
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          {comparisons.map((c) => (
            <div key={c.networkId} className="border border-gray-200 rounded-lg p-4">
              <div className="font-medium text-gray-900">{c.displayName}</div>
              <div className="text-sm text-gray-500 mt-1">{c.details}</div>
              <div className="mt-3 text-lg font-semibold text-gray-900">{c.estimateLabel}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

