import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';

export default function AssetConversionDisplay({ from, to, amount, fromNetwork, toNetwork }) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const fetchConversion = async () => {
    if (!from || !to || amount == null || amount === '') return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ amount: String(amount) });
      if (fromNetwork) params.set('fromNetwork', fromNetwork);
      if (toNetwork) params.set('toNetwork', toNetwork);
      const resp = await fetch(`/api/payments/convert/${encodeURIComponent(from)}/${encodeURIComponent(to)}?${params}`);
      const json = await resp.json();
      if (!resp.ok) throw new Error(json?.error || 'Failed to convert');
      setData(json);
    } catch (e) {
      setError(e.message || String(e));
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConversion();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to, amount, fromNetwork, toNetwork]);

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50">
      <div className="flex items-center justify-between">
        <div className="text-sm font-medium text-gray-900">
          {amount || '—'} {from} → {to}
        </div>
        <button
          onClick={fetchConversion}
          disabled={loading || !amount}
          className="px-2 py-1 text-sm border border-gray-300 rounded-lg hover:bg-white disabled:opacity-50 flex items-center gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="mt-3">
        {error && <div className="text-sm text-red-700">{error}</div>}
        {!error && !data && <div className="text-sm text-gray-600">No conversion data.</div>}
        {data && (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-xs text-gray-500">Rate</div>
              <div className="font-medium text-gray-900">{data.conversionRate}</div>
            </div>
            <div>
              <div className="text-xs text-gray-500">Converted</div>
              <div className="font-medium text-gray-900">{data.convertedAmount}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

