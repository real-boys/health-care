import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { toast } from 'react-toastify';
import { TransactionStatus } from '../components/TransactionStatus';
import { WebSocketProvider } from '../context/WebSocketContext';
import { useTransactionWebSocket } from '../hooks/useTransactionWebSocket';

// Mock the WebSocket hook
jest.mock('../hooks/useTransactionWebSocket');
jest.mock('react-toastify', () => ({
  toast: {
    INFO: 'info',
    SUCCESS: 'success',
    ERROR: 'error'
  }
}));

// Mock fetch
global.fetch = jest.fn();

const mockUseTransactionWebSocket = useTransactionWebSocket as jest.MockedFunction<typeof useTransactionWebSocket>;

describe('TransactionStatus Component', () => {
  const defaultProps = {
    transactionId: 'test-tx-123',
    token: 'test-token'
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementation
    mockUseTransactionWebSocket.mockReturnValue({
      isConnected: true,
      isConnecting: false,
      connectionError: null,
      subscribeToTransaction: jest.fn(),
      unsubscribeFromTransaction: jest.fn(),
      lastStatusUpdate: null,
      subscribedTransactions: new Set(),
      connectionStatus: 'connected'
    });

    // Mock fetch to resolve successfully
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ success: true, status: 'pending' })
    });
  });

  const renderComponent = (props = {}) => {
    const mergedProps = { ...defaultProps, ...props };
    
    return render(
      <WebSocketProvider>
        <TransactionStatus {...mergedProps} />
      </WebSocketProvider>
    );
  };

  describe('Initial Rendering', () => {
    test('renders transaction status badge', () => {
      renderComponent();
      
      expect(screen.getByRole('status')).toBeInTheDocument();
      expect(screen.getByText('Pending')).toBeInTheDocument();
    });

    test('shows connection indicator when enabled', () => {
      renderComponent({ showConnectionIndicator: true });
      
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    test('hides connection indicator when disabled', () => {
      renderComponent({ showConnectionIndicator: false });
      
      expect(screen.queryByText('Connected')).not.toBeInTheDocument();
    });

    test('displays connection error when present', () => {
      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        connectionError: 'Connection failed',
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: null,
        subscribedTransactions: new Set(),
        connectionStatus: 'error'
      });

      renderComponent();
      
      expect(screen.getByText('Connection error: Connection failed')).toBeInTheDocument();
    });
  });

  describe('WebSocket Connection', () => {
    test('subscribes to transaction when connected', () => {
      const mockSubscribe = jest.fn();
      
      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: mockSubscribe,
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: null,
        subscribedTransactions: new Set(),
        connectionStatus: 'connected'
      });

      renderComponent();
      
      expect(mockSubscribe).toHaveBeenCalledWith('test-tx-123');
    });

    test('does not subscribe when not connected', () => {
      const mockSubscribe = jest.fn();
      
      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: false,
        isConnecting: true,
        connectionError: null,
        subscribeToTransaction: mockSubscribe,
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: null,
        subscribedTransactions: new Set(),
        connectionStatus: 'connecting'
      });

      renderComponent();
      
      expect(mockSubscribe).not.toHaveBeenCalled();
    });

    test('unsubscribes on unmount', () => {
      const mockUnsubscribe = jest.fn();
      
      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: mockUnsubscribe,
        lastStatusUpdate: null,
        subscribedTransactions: new Set(['test-tx-123']),
        connectionStatus: 'connected'
      });

      const { unmount } = renderComponent();
      
      unmount();
      
      expect(mockUnsubscribe).toHaveBeenCalledWith('test-tx-123');
    });
  });

  describe('Status Updates', () => {
    test('updates status when receiving status update', () => {
      const statusUpdate = {
        transactionId: 'test-tx-123',
        status: 'confirmed' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'payment',
        amount: 100,
        currency: 'USD'
      };

      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: statusUpdate,
        subscribedTransactions: new Set(),
        connectionStatus: 'connected'
      });

      renderComponent();
      
      expect(screen.getByText('Confirmed')).toBeInTheDocument();
    });

    test('calls onStatusChange callback when status updates', () => {
      const mockOnStatusChange = jest.fn();
      const statusUpdate = {
        transactionId: 'test-tx-123',
        status: 'confirmed' as const,
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: statusUpdate,
        subscribedTransactions: new Set(),
        connectionStatus: 'connected'
      });

      renderComponent({ onStatusChange: mockOnStatusChange });
      
      expect(mockOnStatusChange).toHaveBeenCalledWith(statusUpdate);
    });

    test('displays transaction details when status update includes data', () => {
      const statusUpdate = {
        transactionId: 'test-tx-123',
        status: 'confirmed' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        type: 'payment',
        amount: 100,
        currency: 'USD',
        blockNumber: 12345,
        gasUsed: 21000
      };

      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: statusUpdate,
        subscribedTransactions: new Set(),
        connectionStatus: 'connected'
      });

      renderComponent();
      
      expect(screen.getByText('Type: payment')).toBeInTheDocument();
      expect(screen.getByText('Amount: 100 USD')).toBeInTheDocument();
      expect(screen.getByText('Block: 12345')).toBeInTheDocument();
      expect(screen.getByText('Gas Used: 21000')).toBeInTheDocument();
    });

    test('displays error message when transaction fails', () => {
      const statusUpdate = {
        transactionId: 'test-tx-123',
        status: 'failed' as const,
        timestamp: '2023-01-01T00:00:00.000Z',
        errorMessage: 'Insufficient gas'
      };

      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: statusUpdate,
        subscribedTransactions: new Set(),
        connectionStatus: 'connected'
      });

      renderComponent();
      
      expect(screen.getByText('Error: Insufficient gas')).toBeInTheDocument();
    });
  });

  describe('Fallback Behavior', () => {
    test('fetches initial status when not connected', async () => {
      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: null,
        subscribedTransactions: new Set(),
        connectionStatus: 'disconnected'
      });

      renderComponent();
      
      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalledWith(
          '/api/transactions/test-tx-123/status',
          expect.objectContaining({
            headers: {
              'Authorization': 'Bearer test-token'
            }
          })
        );
      });
    });

    test('handles fetch error gracefully', async () => {
      (global.fetch as jest.Mock).mockRejectedValue(new Error('Network error'));

      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: false,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: null,
        subscribedTransactions: new Set(),
        connectionStatus: 'disconnected'
      });

      renderComponent();
      
      // Should not crash and should still render the component
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      renderComponent();
      
      const statusBadge = screen.getByRole('status');
      expect(statusBadge).toHaveAttribute('aria-label', 'Transaction status: Pending');
    });

    test('updates ARIA label when status changes', () => {
      const statusUpdate = {
        transactionId: 'test-tx-123',
        status: 'confirmed' as const,
        timestamp: '2023-01-01T00:00:00.000Z'
      };

      mockUseTransactionWebSocket.mockReturnValue({
        isConnected: true,
        isConnecting: false,
        connectionError: null,
        subscribeToTransaction: jest.fn(),
        unsubscribeFromTransaction: jest.fn(),
        lastStatusUpdate: statusUpdate,
        subscribedTransactions: new Set(),
        connectionStatus: 'connected'
      });

      renderComponent();
      
      const statusBadge = screen.getByRole('status');
      expect(statusBadge).toHaveAttribute('aria-label', 'Transaction status: Confirmed');
    });
  });

  describe('Component Variations', () => {
    test('applies custom className', () => {
      renderComponent({ className: 'custom-class' });
      
      const container = screen.getByRole('status').closest('.transaction-status');
      expect(container).toHaveClass('custom-class');
    });

    test('renders without token', () => {
      renderComponent({ token: null });
      
      // Should still render the component
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    test('handles different transaction IDs', () => {
      renderComponent({ transactionId: 'different-tx-456' });
      
      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });
});

describe('TransactionStatusBadge Component', () => {
  // Import the badge component for testing
  const TransactionStatusBadge = require('../components/TransactionStatusBadge').TransactionStatusBadge;

  test('renders correct colors for each status', () => {
    const statuses = [
      { status: 'pending', expectedColor: 'text-yellow-800' },
      { status: 'confirming', expectedColor: 'text-blue-800' },
      { status: 'confirmed', expectedColor: 'text-green-800' },
      { status: 'failed', expectedColor: 'text-red-800' }
    ];

    statuses.forEach(({ status, expectedColor }) => {
      const { container } = render(
        <WebSocketProvider>
          <TransactionStatusBadge status={status as any} />
        </WebSocketProvider>
      );
      
      expect(container.firstChild).toHaveClass(expectedColor);
    });
  });

  test('shows icon when enabled', () => {
    const { container } = render(
      <WebSocketProvider>
        <TransactionStatusBadge status="pending" showIcon={true} />
      </WebSocketProvider>
    );
    
    expect(container.textContent).toContain('⏳');
  });

  test('hides icon when disabled', () => {
    const { container } = render(
      <WebSocketProvider>
        <TransactionStatusBadge status="pending" showIcon={false} />
      </WebSocketProvider>
    );
    
    expect(container.textContent).not.toContain('⏳');
    expect(container.textContent).toContain('Pending');
  });
});
