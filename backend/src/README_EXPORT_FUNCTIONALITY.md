# Payment History Export Functionality

This document describes the payment history export functionality implemented for the healthcare system.

## Overview

The payment history export functionality allows users to export their payment data in three formats:
- CSV (Comma Separated Values)
- PDF (Portable Document Format)  
- JSON (JavaScript Object Notation)

## Features

### Export Formats

#### CSV Export
- Compatible with Excel and spreadsheet applications
- UTF-8 encoding with BOM for proper character display
- Headers: Date, Transaction ID, Amount, Currency, Status, Description, Payment Method, Insurance Provider, Policy Number
- Date format: ISO 8601 (YYYY-MM-DD)
- Amount format: Decimal with 2 places

#### PDF Export
- Branded header with healthcare system logo
- Patient name and ID
- Date range of report
- Table with all transactions
- Summary statistics (total amount, count, status breakdown)
- Footer with generation date and page numbers

#### JSON Export
- Complete payment data structure
- Pretty-printed with 2-space indentation
- Includes metadata and timestamps
- API-friendly format for developers

### Date Range Filtering
- Default: Last 30 days if no dates provided
- Maximum range: 1 year per export
- Preset options: Last 7 days, Last 30 days, Last 90 days, This month, Last month, This year
- Validation: Start date must be before end date
- Future dates are not allowed

### Authentication & Authorization
- JWT token required for all export endpoints
- Users can only export their own payment data
- Admin users can export any user's payment data
- Export history is tracked for audit purposes

### Rate Limiting & Security
- Maximum 1000 records per export
- Export requests are logged
- Circuit breaker protection for large requests
- Input validation and sanitization

## API Endpoints

### Main Export Endpoint
```
GET /api/payments/export
```

**Query Parameters:**
- `format` (required): `csv|pdf|json`
- `startDate` (optional): ISO date string (YYYY-MM-DD)
- `endDate` (optional): ISO date string (YYYY-MM-DD)
- `userId` (optional, admin only): Target user ID

**Headers:**
- `Authorization`: Bearer token

**Response:**
- Content-Type varies by format
- Content-Disposition: attachment with filename
- X-Record-Count: Number of records exported

### Export History
```
GET /api/payments/export/history
```

**Response:**
```json
{
  "success": true,
  "history": [
    {
      "id": 1,
      "format": "csv",
      "filename": "payment_history_2023-01-01_to_2023-01-31.csv",
      "record_count": 25,
      "created_at": "2023-01-15T10:30:00Z"
    }
  ],
  "count": 1
}
```

### Export Presets
```
GET /api/payments/export/presets
```

**Response:**
```json
{
  "success": true,
  "presets": {
    "last-30-days": {
      "startDate": "2023-01-01",
      "endDate": "2023-01-31",
      "label": "Last 30 Days"
    }
  }
}
```

### Export Validation
```
POST /api/payments/export/validate
```

**Request Body:**
```json
{
  "format": "csv",
  "startDate": "2023-01-01",
  "endDate": "2023-01-31"
}
```

### Available Formats
```
GET /api/payments/export/formats
```

**Response:**
```json
{
  "success": true,
  "formats": {
    "csv": {
      "name": "CSV (Comma Separated Values)",
      "description": "Export payment data as a CSV file compatible with Excel",
      "mimeType": "text/csv",
      "fileExtension": ".csv",
      "features": ["Compatible with Excel", "Easy data analysis"]
    }
  }
}
```

### Export Statistics (Admin Only)
```
GET /api/payments/export/stats
```

## File Structure

```
src/
├── services/
│   └── exportService.ts          # Main export logic
├── utils/
│   ├── csvGenerator.ts           # CSV generation utilities
│   ├── pdfGenerator.ts           # PDF generation utilities
│   └── dateValidator.ts          # Date validation utilities
├── routes/
│   └── paymentsExport.ts         # Export API routes
└── README_EXPORT_FUNCTIONALITY.md
```

## Database Schema

### Export History Table
```sql
CREATE TABLE export_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT NOT NULL,
    format TEXT NOT NULL CHECK (format IN ('csv', 'pdf', 'json')),
    filename TEXT NOT NULL,
    record_count INTEGER NOT NULL DEFAULT 0,
    date_range_start TEXT,
    date_range_end TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Usage Examples

### JavaScript/TypeScript Client
```javascript
// Export CSV for last 30 days
const response = await fetch('/api/payments/export?format=csv', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const blob = await response.blob();
const url = window.URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = 'payment_history.csv';
a.click();
```

### cURL Examples
```bash
# Export CSV
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/payments/export?format=csv&startDate=2023-01-01&endDate=2023-01-31"

# Export PDF
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/payments/export?format=pdf" -o payments.pdf

# Export JSON
curl -H "Authorization: Bearer TOKEN" \
  "http://localhost:3000/api/payments/export?format=json" -o payments.json
```

## Testing

Run the test suite:
```bash
npm test -- paymentsExport.test.ts
```

Run with coverage:
```bash
npm run test:coverage -- paymentsExport.test.ts
```

## Dependencies

- `pdfkit`: PDF generation
- `typescript`: TypeScript support
- `@types/pdfkit`: TypeScript definitions for PDFKit
- `@types/node`: TypeScript definitions for Node.js

## Security Considerations

1. **Authentication**: All endpoints require valid JWT tokens
2. **Authorization**: Users can only access their own data unless they're admins
3. **Input Validation**: All parameters are validated before processing
4. **Rate Limiting**: Built-in rate limiting prevents abuse
5. **Audit Trail**: All export activities are logged
6. **Data Privacy**: Sensitive data is handled securely

## Performance Considerations

1. **Record Limits**: Maximum 1000 records per export
2. **Caching**: Export results can be cached for repeated requests
3. **Async Processing**: Large exports are processed asynchronously
4. **Memory Management**: Streaming is used for large files
5. **Database Optimization**: Indexed queries for efficient data retrieval

## Error Handling

The API returns appropriate HTTP status codes:
- `200`: Success
- `400`: Bad request (invalid parameters)
- `401`: Unauthorized (missing/invalid token)
- `403`: Forbidden (insufficient permissions)
- `500`: Internal server error

Error responses include descriptive messages:
```json
{
  "error": "Start date cannot be after end date"
}
```

## Future Enhancements

1. **Async Export**: Background processing for large datasets
2. **Email Delivery**: Send exports via email
3. **Scheduled Exports**: Automated recurring exports
4. **Additional Formats**: Excel, XML, etc.
5. **Custom Templates**: User-defined export templates
6. **Data Compression**: Compressed exports for large datasets
