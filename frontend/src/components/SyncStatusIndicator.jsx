import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Wifi, WifiOff, RefreshCw, AlertCircle, CheckCircle, Database } from 'lucide-react';
import { syncManager, useNetworkStatus } from '../services/syncManager';
import { getQueueStats, getSyncStatus } from '../services/offlinePaymentDB';

const SyncStatusIndicator = () => {
  const { t } = useTranslation();
  const networkStatus = useNetworkStatus();
  const [queueStats, setQueueStats] = useState({ pending: 0, failed: 0 });
  const [syncStatus, setSyncStatus] = useState({ status: 'unknown', lastSync: null });
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const updateStats = async () => {
      const stats = await getQueueStats();
      const status = await getSyncStatus();
      setQueueStats(stats);
      setSyncStatus(status);
    };

    updateStats();
    const interval = setInterval(updateStats, 5000); // Update every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = () => {
    if (networkStatus.isSyncing) {
      return <RefreshCw size={18} className="animate-spin text-indigo-400" />;
    }
    
    if (!networkStatus.isOnline) {
      return <WifiOff size={18} className="text-amber-400" />;
    }

    if (queueStats.pending > 0) {
      return <Database size={18} className="text-blue-400" />;
    }

    return <CheckCircle size={18} className="text-emerald-400" />;
  };

  const getStatusText = () => {
    if (networkStatus.isSyncing) {
      return t('sync.syncing');
    }
    
    if (!networkStatus.isOnline) {
      return t('sync.offline');
    }

    if (queueStats.pending > 0) {
      return `${t('sync.pending')} (${queueStats.pending})`;
    }

    return t('sync.synced');
  };

  const getStatusColor = () => {
    if (networkStatus.isSyncing) return 'bg-indigo-500/20 border-indigo-500/30';
    if (!networkStatus.isOnline) return 'bg-amber-500/20 border-amber-500/30';
    if (queueStats.pending > 0) return 'bg-blue-500/20 border-blue-500/30';
    return 'bg-emerald-500/20 border-emerald-500/30';
  };

  const formatLastSync = (timestamp) => {
    if (!timestamp) return t('sync.lastSync') + ': Never';
    
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return t('sync.lastSync') + ': Just now';
    if (diffMins < 60) return t('sync.lastSync') + `: ${diffMins}m ago`;
    
    const hours = Math.floor(diffMins / 60);
    if (hours < 24) return t('sync.lastSync') + `: ${hours}h ago`;
    
    return t('sync.lastSync') + `: ${date.toLocaleDateString()}`;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDetails(!showDetails)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200 ${getStatusColor()}`}
        aria-label={t('sync.status')}
      >
        {getStatusIcon()}
        <span className="text-xs font-medium text-slate-300 hidden sm:inline">
          {getStatusText()}
        </span>
      </button>

      {showDetails && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowDetails(false)}
          />
          
          {/* Dropdown panel */}
          <div className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
            <div className="p-4 space-y-3">
              {/* Status Header */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-700">
                <div className="flex items-center gap-2">
                  {networkStatus.isOnline ? (
                    <Wifi size={16} className="text-emerald-400" />
                  ) : (
                    <WifiOff size={16} className="text-amber-400" />
                  )}
                  <span className="text-sm font-semibold text-white">
                    {networkStatus.isOnline ? t('sync.online') : t('sync.offline')}
                  </span>
                </div>
                {networkStatus.isSyncing && (
                  <RefreshCw size={16} className="animate-spin text-indigo-400" />
                )}
              </div>

              {/* Queue Stats */}
              <div className="space-y-2">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{t('payments.pending')}</span>
                  <span className="font-semibold text-blue-400">{queueStats.pending}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{t('sync.synced')}</span>
                  <span className="font-semibold text-emerald-400">{queueStats.synced}</span>
                </div>
                {queueStats.failed > 0 && (
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">{t('payments.failed')}</span>
                    <span className="font-semibold text-red-400">{queueStats.failed}</span>
                  </div>
                )}
              </div>

              {/* Last Sync Time */}
              <div className="pt-2 border-t border-slate-700">
                <p className="text-xs text-slate-400">
                  {formatLastSync(syncStatus.lastSync)}
                </p>
              </div>

              {/* Actions */}
              {networkStatus.isOnline && queueStats.pending > 0 && (
                <button
                  onClick={() => syncManager.startSync()}
                  disabled={networkStatus.isSyncing}
                  className="w-full mt-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white text-xs font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <RefreshCw size={14} className={networkStatus.isSyncing ? 'animate-spin' : ''} />
                  {networkStatus.isSyncing ? t('sync.syncing') : t('sync.retry')}
                </button>
              )}

              {!networkStatus.isOnline && (
                <div className="mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
                  <p className="text-xs text-amber-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    {t('errors.networkError')}
                  </p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SyncStatusIndicator;
