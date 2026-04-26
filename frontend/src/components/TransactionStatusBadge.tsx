import React from 'react';
import { clsx } from 'clsx';

export type TransactionStatusType = 'pending' | 'confirming' | 'confirmed' | 'failed';

interface TransactionStatusBadgeProps {
  status: TransactionStatusType;
  className?: string;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export const TransactionStatusBadge: React.FC<TransactionStatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
  size = 'md'
}) => {
  const statusConfig = {
    pending: {
      color: 'yellow',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
      borderColor: 'border-yellow-200',
      icon: '⏳',
      label: 'Pending'
    },
    confirming: {
      color: 'blue',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
      borderColor: 'border-blue-200',
      icon: '🔄',
      label: 'Confirming'
    },
    confirmed: {
      color: 'green',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
      borderColor: 'border-green-200',
      icon: '✅',
      label: 'Confirmed'
    },
    failed: {
      color: 'red',
      bgColor: 'bg-red-100',
      textColor: 'text-red-800',
      borderColor: 'border-red-200',
      icon: '❌',
      label: 'Failed'
    }
  };

  const config = statusConfig[status];

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  const iconSizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base'
  };

  return (
    <span
      className={clsx(
        'inline-flex items-center justify-center font-medium rounded-full border',
        config.bgColor,
        config.textColor,
        config.borderColor,
        sizeClasses[size],
        className
      )}
      role="status"
      aria-label={`Transaction status: ${config.label}`}
    >
      {showIcon && (
        <span className={clsx('mr-1.5', iconSizeClasses[size])}>
          {config.icon}
        </span>
      )}
      {config.label}
    </span>
  );
};

// Animated version of the badge for real-time updates
export const AnimatedTransactionStatusBadge: React.FC<TransactionStatusBadgeProps> = ({
  status,
  className = '',
  showIcon = true,
  size = 'md'
}) => {
  return (
    <div className="relative inline-block">
      <TransactionStatusBadge
        status={status}
        className={clsx('transition-all duration-300 ease-in-out', className)}
        showIcon={showIcon}
        size={size}
      />
      {/* Pulse animation for active statuses */}
      {(status === 'pending' || status === 'confirming') && (
        <span className="absolute inset-0 rounded-full animate-ping bg-opacity-30 bg-blue-400" />
      )}
    </div>
  );
};

// Compact version for tight spaces
export const CompactTransactionStatusBadge: React.FC<{
  status: TransactionStatusType;
  className?: string;
}> = ({ status, className = '' }) => {
  const statusConfig = {
    pending: { dotColor: 'bg-yellow-400', label: 'Pending' },
    confirming: { dotColor: 'bg-blue-400', label: 'Confirming' },
    confirmed: { dotColor: 'bg-green-400', label: 'Confirmed' },
    failed: { dotColor: 'bg-red-400', label: 'Failed' }
  };

  const config = statusConfig[status];

  return (
    <div className={clsx('flex items-center space-x-2', className)}>
      <span
        className={clsx(
          'w-2 h-2 rounded-full',
          config.dotColor,
          status === 'pending' && 'animate-pulse',
          status === 'confirming' && 'animate-pulse'
        )}
      />
      <span className="text-sm text-gray-600">{config.label}</span>
    </div>
  );
};
