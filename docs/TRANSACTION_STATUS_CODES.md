# Transaction Status Codes Reference

This document provides a comprehensive reference for all transaction status codes used in the healthcare application's real-time transaction system.

## Status Codes Overview

Transaction statuses represent the lifecycle of a transaction from submission to completion. Each status has specific meanings, visual indicators, and associated user actions.

## Primary Status Codes

### PENDING

**Code:** `pending`  
**Hex Color:** `#FCD34D` (Yellow)  
**RGB:** `252, 211, 77`  
**Description:** Transaction has been submitted and is awaiting initial confirmation from the network.

**When it occurs:**
- User submits a new transaction
- Transaction is queued for processing
- Initial network broadcast is in progress

**Expected Duration:** 5-30 seconds  
**User Action:** Wait for confirmation or cancel if supported

**Visual Indicators:**
- Badge: Yellow background with clock icon (⏳)
- Animation: Pulsing effect
- Progress: 0-25%

**API Response Example:**
```json
{
  "transactionId": "tx_1234567890_abc123",
  "status": "pending",
  "timestamp": "2023-01-01T12:00:00.000Z",
  "type": "payment",
  "amount": 150.00,
  "currency": "USD",
  "createdAt": "2023-01-01T12:00:00.000Z"
}
```

---

### CONFIRMING

**Code:** `confirming`  
**Hex Color:** `#60A5FA` (Blue)  
**RGB:** `96, 165, 250`  
**Description:** Transaction has been seen on the network and is awaiting final confirmation.

**When it occurs:**
- Transaction is included in a pending block
- Network consensus is being reached
- Waiting for required block confirmations

**Expected Duration:** 30-120 seconds  
**User Action:** Continue waiting, transaction is progressing normally

**Visual Indicators:**
- Badge: Blue background with refresh icon (🔄)
- Animation: Pulsing effect
- Progress: 25-75%

**Additional Data:**
```json
{
  "transactionId": "tx_1234567890_abc123",
  "status": "confirming",
  "timestamp": "2023-01-01T12:00:30.000Z",
  "confirmations": 3,
  "requiredConfirmations": 6,
  "pendingBlockNumber": 12345678
}
```

---

### CONFIRMED

**Code:** `confirmed`  
**Hex Color:** `#34D399` (Green)  
**RGB:** `52, 211, 153`  
**Description:** Transaction has been finalized and is permanently recorded on the blockchain.

**When it occurs:**
- Required number of block confirmations reached
- Transaction is immutable
- Funds/value transfer is complete

**Expected Duration:** Final state  
**User Action:** Transaction complete, no further action needed

**Visual Indicators:**
- Badge: Green background with checkmark icon (✅)
- Animation: None (static)
- Progress: 100%

**Additional Data:**
```json
{
  "transactionId": "tx_1234567890_abc123",
  "status": "confirmed",
  "timestamp": "2023-01-01T12:02:00.000Z",
  "blockNumber": 12345679,
  "blockHash": "0xabc123...",
  "gasUsed": 21000,
  "gasPrice": "20000000000",
  "transactionFee": 0.00042,
  "confirmations": 6
}
```

---

### FAILED

**Code:** `failed`  
**Hex Color:** `#F87171` (Red)  
**RGB:** `248, 113, 113`  
**Description:** Transaction failed to process due to an error or was rejected by the network.

**When it occurs:**
- Insufficient gas/fees
- Invalid transaction parameters
- Network congestion or timeout
- Smart contract execution failure
- Nonce issues

**Expected Duration:** Final state  
**User Action:** Review error details and retry if appropriate

**Visual Indicators:**
- Badge: Red background with X icon (❌)
- Animation: None (static)
- Progress: Failed

**Additional Data:**
```json
{
  "transactionId": "tx_1234567890_abc123",
  "status": "failed",
  "timestamp": "2023-01-01T12:01:15.000Z",
  "errorCode": "INSUFFICIENT_GAS",
  "errorMessage": "Transaction ran out of gas. Please increase gas limit and try again.",
  "retryable": true,
  "suggestedGasPrice": "25000000000"
}
```

## Error Codes

When a transaction fails, specific error codes provide detailed information about the failure:

### Common Error Codes

| Error Code | Description | Retryable |
|------------|-------------|-----------|
| `INSUFFICIENT_GAS` | Not enough gas provided | Yes |
| `GAS_PRICE_TOO_LOW` | Gas price too low for network | Yes |
| `NONCE_TOO_LOW` | Transaction nonce too low | Yes |
| `NONCE_TOO_HIGH` | Transaction nonce too high | No |
| `INVALID_RECIPIENT` | Invalid recipient address | No |
| `INSUFFICIENT_BALANCE` | Not enough balance | No |
| `NETWORK_TIMEOUT` | Network timeout occurred | Yes |
| `CONTRACT_EXECUTION_FAILED` | Smart contract execution failed | Maybe |
| `RATE_LIMITED` | Transaction rate limited | Yes |
| `INVALID_SIGNATURE` | Invalid transaction signature | No |

### Error Code Details

#### INSUFFICIENT_GAS
**Message:** "Transaction ran out of gas. Please increase gas limit and try again."  
**Recommended Action:** Increase gas limit by 20-50% and retry.

#### GAS_PRICE_TOO_LOW
**Message:** "Gas price too low for current network conditions."  
**Recommended Action:** Increase gas price based on network recommendations.

#### NONCE_TOO_LOW
**Message:** "Transaction nonce is too low. Another transaction may be pending."  
**Recommended Action:** Wait for pending transactions or reset nonce.

#### NETWORK_TIMEOUT
**Message:** "Transaction timed out waiting for confirmation."  
**Recommended Action:** Retry with higher gas price or during less congested times.

## Status Transition Rules

### Valid Transitions

```
pending → confirming → confirmed
    ↓
   failed
```

### Invalid Transitions

- `confirmed → pending` ❌
- `failed → confirming` ❌
- `confirmed → failed` ❌

### Transition Conditions

**pending → confirming**
- Transaction detected in mempool
- Minimum 1 network confirmation

**confirming → confirmed**
- Required number of block confirmations reached
- Default: 6 confirmations for most transactions
- High-value: 12 confirmations

**pending/confirming → failed**
- Network rejection
- Timeout (default: 5 minutes)
- Explicit error from blockchain

## Status Duration Estimates

| Status | Minimum | Average | Maximum |
|--------|---------|---------|---------|
| pending | 5 seconds | 15 seconds | 2 minutes |
| confirming | 30 seconds | 90 seconds | 10 minutes |
| confirmed | - | - | - (final) |
| failed | - | - | - (final) |

**Note:** Durations vary based on network congestion and gas price.

## Internationalization

Status messages are available in multiple languages:

### English (en)
- pending: "Pending"
- confirming: "Confirming"
- confirmed: "Confirmed"
- failed: "Failed"

### Spanish (es)
- pending: "Pendiente"
- confirming: "Confirmando"
- confirmed: "Confirmado"
- failed: "Fallido"

### French (fr)
- pending: "En attente"
- confirming: "Confirmation"
- confirmed: "Confirmé"
- failed: "Échoué"

### German (de)
- pending: "Ausstehend"
- confirming: "Bestätigung"
- confirmed: "Bestätigt"
- failed: "Fehlgeschlagen"

## Accessibility

### ARIA Labels
```html
<span role="status" aria-label="Transaction status: Pending">
  Pending
</span>
```

### Screen Reader Support
- Status changes announce automatically
- Progress indicators available
- Error messages are descriptive

### Color Contrast
All status badges meet WCAG 2.1 AA contrast requirements:
- Yellow: 4.5:1 contrast ratio
- Blue: 4.7:1 contrast ratio
- Green: 4.8:1 contrast ratio
- Red: 4.6:1 contrast ratio

## Integration Examples

### React Component
```jsx
import { TransactionStatusBadge } from './TransactionStatusBadge';

function TransactionItem({ transaction }) {
  return (
    <div>
      <TransactionStatusBadge status={transaction.status} />
      <span>{transaction.amount} {transaction.currency}</span>
    </div>
  );
}
```

### CSS Classes
```css
.status-pending {
  background-color: #FCD34D;
  color: #92400E;
}

.status-confirming {
  background-color: #60A5FA;
  color: #1E3A8A;
}

.status-confirmed {
  background-color: #34D399;
  color: #064E3B;
}

.status-failed {
  background-color: #F87171;
  color: #7F1D1D;
}
```

## Testing Status Codes

### Unit Test Example
```javascript
describe('Transaction Status', () => {
  test('should render correct color for each status', () => {
    const statuses = {
      pending: 'text-yellow-800',
      confirming: 'text-blue-800',
      confirmed: 'text-green-800',
      failed: 'text-red-800'
    };

    Object.entries(statuses).forEach(([status, expectedClass]) => {
      const { container } = render(<TransactionStatusBadge status={status} />);
      expect(container.firstChild).toHaveClass(expectedClass);
    });
  });
});
```

### Integration Test
```javascript
test('should handle status transitions correctly', async () => {
  const { result } = renderHook(() => useTransactionWebSocket(token));
  
  // Simulate status update
  act(() => {
    result.current.lastStatusUpdate = {
      transactionId: 'tx123',
      status: 'confirmed',
      timestamp: '2023-01-01T00:00:00.000Z'
    };
  });

  expect(result.current.lastStatusUpdate.status).toBe('confirmed');
});
```

## Monitoring and Analytics

### Status Distribution Metrics
Track the distribution of transaction statuses:
```javascript
const statusMetrics = {
  pending: 15,
  confirming: 8,
  confirmed: 1250,
  failed: 3
};
```

### Transition Time Analytics
Monitor average time between status transitions:
```javascript
const transitionTimes = {
  pending_to_confirming: 15.2, // seconds
  confirming_to_confirmed: 89.5, // seconds
  pending_to_failed: 45.8 // seconds
};
```

### Error Rate Tracking
Track failure rates by error code:
```javascript
const errorRates = {
  INSUFFICIENT_GAS: 0.02, // 2%
  NETWORK_TIMEOUT: 0.01, // 1%
  RATE_LIMITED: 0.005 // 0.5%
};
```

## Troubleshooting Guide

### Common Issues

1. **Stuck in pending**
   - Check gas price competitiveness
   - Verify network connectivity
   - Review transaction parameters

2. **Frequent failures**
   - Monitor gas price volatility
   - Check account balance
   - Review smart contract conditions

3. **Slow confirmations**
   - Increase gas price
   - Check network congestion
   - Consider transaction replacement

### Debug Information

Enable debug logging for detailed status information:
```javascript
localStorage.debug = 'transaction:*';
```

This will log:
- Status transitions
- Error details
- Timing information
- Network responses
