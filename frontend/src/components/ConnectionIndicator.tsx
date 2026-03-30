import React from 'react';
import { clsx } from 'clsx';

export type ConnectionStatusType = 'connected' | 'connecting' | 'disconnected' | 'error';

interface ConnectionIndicatorProps {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  connectionStatus: ConnectionStatusType;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export const ConnectionIndicator: React.FC<ConnectionIndicatorProps> = ({
  isConnected,
  isConnecting,
  connectionError,
  connectionStatus,
  showText = true,
  size = 'md',
  className = ''
}) => {
  const getStatusConfig = () => {
    if (connectionError) {
      return {
        color: 'red',
        bgColor: 'bg-red-100',
        textColor: 'text-red-800',
        dotColor: 'bg-red-500',
        label: 'Error',
        description: connectionError
      };
    }

    if (isConnecting) {
      return {
        color: 'yellow',
        bgColor: 'bg-yellow-100',
        textColor: 'text-yellow-800',
        dotColor: 'bg-yellow-500',
        label: 'Connecting',
        description: 'Establishing connection...'
      };
    }

    if (isConnected) {
      return {
        color: 'green',
        bgColor: 'bg-green-100',
        textColor: 'text-green-800',
        dotColor: 'bg-green-500',
        label: 'Connected',
        description: 'Real-time updates active'
      };
    }

    return {
      color: 'gray',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
      dotColor: 'bg-gray-500',
      label: 'Disconnected',
      description: 'Connection lost'
    };
  };

  const config = getStatusConfig();

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const textSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      {/* Connection dot */}
      <div className="relative">
        <div
          className={clsx(
            'rounded-full transition-colors duration-300',
            sizeClasses[size],
            config.dotColor,
            (isConnecting || (isConnected && !connectionError)) && 'animate-pulse'
          )}
        />
        
        {/* Success ring for connected state */}
        {isConnected && !connectionError && (
          <div
            className={clsx(
              'absolute inset-0 rounded-full',
              sizeClasses[size],
              'bg-green-200 animate-ping'
            )}
          />
        )}
      </div>

      {/* Status text */}
      {showText && (
        <div className="flex flex-col">
          <span className={clsx('font-medium', textSizeClasses[size], config.textColor)}>
            {config.label}
          </span>
          {size !== 'sm' && (
            <span className={clsx('text-xs', config.textColor, 'opacity-75')}>
              {config.description}
            </span>
          )}
        </div>
      )}

      {/* Tooltip for error state */}
      {connectionError && (
        <div className="group relative">
          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 text-xs text-white bg-red-600 rounded opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-10">
            {connectionError}
            <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-red-600" />
          </div>
        </div>
      )}
    </div>
  );
};

// Compact version for tight spaces
export const CompactConnectionIndicator: React.FC<{
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  className?: string;
}> = ({ isConnected, isConnecting, connectionError, className = '' }) => {
  const getDotColor = () => {
    if (connectionError) return 'bg-red-500';
    if (isConnecting) return 'bg-yellow-500';
    if (isConnected) return 'bg-green-500';
    return 'bg-gray-500';
  };

  return (
    <div className={clsx('flex items-center', className)}>
      <div
        className={clsx(
          'w-2 h-2 rounded-full transition-colors duration-300',
          getDotColor(),
          (isConnecting || (isConnected && !connectionError)) && 'animate-pulse'
        )}
        title={connectionError || (isConnected ? 'Connected' : isConnecting ? 'Connecting' : 'Disconnected')}
      />
    </div>
  );
};

// Status bar version for headers
export const StatusBarConnectionIndicator: React.FC<{
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  className?: string;
}> = ({ isConnected, isConnecting, connectionError, className = '' }) => {
  const getStatusText = () => {
    if (connectionError) return 'Connection Error';
    if (isConnecting) return 'Connecting...';
    if (isConnected) return 'Live';
    return 'Offline';
  };

  const getStatusColor = () => {
    if (connectionError) return 'text-red-600';
    if (isConnecting) return 'text-yellow-600';
    if (isConnected) return 'text-green-600';
    return 'text-gray-600';
  };

  return (
    <div className={clsx('flex items-center space-x-2 px-3 py-1 rounded-full bg-gray-50', className)}>
      <CompactConnectionIndicator
        isConnected={isConnected}
        isConnecting={isConnecting}
        connectionError={connectionError}
      />
      <span className={clsx('text-xs font-medium', getStatusColor())}>
        {getStatusText()}
      </span>
    </div>
  );
};
