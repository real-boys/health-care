import React from 'react';
import { ChevronDown } from 'lucide-react';
import { useNetwork } from '../chain/NetworkContext';
import { getNetworkById } from '../chain/networks';

export default function NetworkSelector() {
  const { networks, selectedNetworkId, setSelectedNetworkId } = useNetwork();
  const selected = getNetworkById(selectedNetworkId);

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-600">Network</span>
      <div className="relative">
        <select
          value={selectedNetworkId || ''}
          onChange={(e) => setSelectedNetworkId(e.target.value)}
          className="appearance-none pr-9 pl-3 py-2 border border-gray-300 rounded-lg bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {networks.map((n) => (
            <option key={n.id} value={n.id}>
              {n.displayName}
            </option>
          ))}
        </select>
        <ChevronDown className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
      </div>

      {selected && (
        <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 border border-gray-200">
          {selected.family.toUpperCase()}
        </span>
      )}
    </div>
  );
}

