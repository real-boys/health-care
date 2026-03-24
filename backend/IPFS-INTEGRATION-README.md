# IPFS Integration for Healthcare Medical Records

This document describes the comprehensive IPFS integration implementation for decentralized storage of medical records with encryption and access control.

## Overview

The IPFS integration provides:
- **Decentralized Storage**: Medical records stored on IPFS network
- **AES-256 Encryption**: End-to-end encryption of all medical data
- **Access Control**: Role-based permissions and patient-specific access
- **Content Deduplication**: Automatic detection and prevention of duplicate content
- **File Versioning**: Complete version history with restore points
- **Pinning Service**: Persistent storage for critical records
- **Audit Logging**: Comprehensive access and operation tracking

## Architecture

### Core Services

1. **IPFS Service** (`services/ipfsService.js`)
   - IPFS node integration (local or Infura)
   - File upload/download operations
   - Content addressing and CID management
   - Pinning and garbage collection

2. **Encryption Service** (`services/encryptionService.js`)
   - AES-256-GCM encryption/decryption
   - Key generation and management
   - Digital signatures and verification
   - Batch encryption operations

3. **Content Addressing Service** (`services/contentAddressingService.js`)
   - Content hash generation and tracking
   - Deduplication logic
   - Content reference management
   - Statistics and analytics

4. **Versioning Service** (`services/versioningService.js`)
   - File version creation and management
   - Restore points and rollback capabilities
   - Backup creation and scheduling
   - Version history tracking

5. **Pinning Service** (`services/pinningService.js`)
   - Automated pinning based on policies
   - Priority-based pinning queue
   - Health monitoring and verification
   - Pinning audit logging

### Access Control

**Access Control Middleware** (`middleware/accessControl.js`)
- JWT token verification
- Role-based permissions
- Patient-specific access validation
- Resource-level authorization
- Comprehensive audit logging

## API Endpoints

### Medical Records (IPFS-enabled)

#### GET `/api/medical-records-ipfs/patient/:patientId`
Retrieve patient's medical records stored in IPFS

#### GET `/api/medical-records-ipfs/:recordId`
Get specific medical record with decrypted content

#### POST `/api/medical-records-ipfs`
Create new medical record with IPFS storage

#### PUT `/api/medical-records-ipfs/:recordId`
Update medical record with versioning

#### DELETE `/api/medical-records-ipfs/:recordId`
Soft delete medical record with restore point

#### GET `/api/medical-records-ipfs/:recordId/versions`
Get version history for medical record

#### POST `/api/medical-records-ipfs/:recordId/restore/:versionNumber`
Restore medical record to specific version

#### POST `/api/medical-records-ipfs/:recordId/pin`
Pin medical record for persistent storage

#### DELETE `/api/medical-records-ipfs/:recordId/pin`
Unpin medical record

### IPFS Management

#### POST `/api/ipfs/upload`
Upload file to IPFS with encryption

#### POST `/api/ipfs/upload/json`
Upload JSON data to IPFS

#### GET `/api/ipfs/download/:cid`
Download and decrypt file from IPFS

#### POST `/api/ipfs/pin/:cid`
Pin content for persistence

#### DELETE `/api/ipfs/pin/:cid`
Unpin content

#### GET `/api/ipfs/pinned`
Get all pinned content

#### GET `/api/ipfs/verify/:cid`
Verify content integrity

#### GET `/api/ipfs/info/:cid`
Get content information and references

#### GET `/api/ipfs/duplicates`
Find duplicate content

### Versioning

#### POST `/api/ipfs/version/:resourceType/:resourceId`
Create new version for resource

#### GET `/api/ipfs/version/:resourceType/:resourceId/history`
Get version history

#### POST `/api/ipfs/version/:resourceType/:resourceId/restore/:versionNumber`
Restore to specific version

#### POST `/api/ipfs/restore-point/:resourceType/:resourceId`
Create restore point

#### GET `/api/ipfs/restore-point/:resourceType/:resourceId`
Get restore points

### Statistics and Monitoring

#### GET `/api/ipfs/stats/deduplication`
Get deduplication statistics

#### GET `/api/ipfs/stats/node`
Get IPFS node statistics

#### GET `/api/ipfs/stats/pinning`
Get pinning statistics

#### GET `/api/ipfs/stats/versioning`
Get versioning statistics

#### GET `/api/ipfs/health`
Health check for all IPFS services

## Configuration

### Environment Variables

```bash
# IPFS Configuration
IPFS_NODE_TYPE=local                    # or 'infura'
INFURA_PROJECT_ID=your_infura_project_id
INFURA_PROJECT_SECRET=your_infura_secret

# Database
DB_PATH=./database/healthcare.db

# Security
JWT_SECRET=your_jwt_secret_key
DEFAULT_ENCRYPTION_KEY=your_default_key

# Server
PORT=5000
FRONTEND_URL=http://localhost:3000
```

### Database Schema

The IPFS integration adds the following tables to the database:

- `medical_records_ipfs` - Metadata for IPFS-stored medical records
- `content_hashes` - Content addressing and deduplication
- `content_references` - Resource-to-content mapping
- `file_versions` - Version history tracking
- `pinned_records` - Pinning status and management
- `pinning_policies` - Automated pinning policies
- `access_logs` - Comprehensive audit logging
- `patient_encryption_keys` - Patient-specific encryption keys

See `database/ipfs-schema.sql` for complete schema definition.

## Security Features

### Encryption

- **AES-256-GCM**: Industry-standard encryption with authentication
- **Patient-specific keys**: Each patient has unique encryption keys
- **Key rotation**: Support for encryption key rotation
- **Digital signatures**: Verify data integrity and authenticity

### Access Control

- **Role-based permissions**: Different access levels for different user types
- **Patient access control**: Patients can only access their own records
- **Provider validation**: Healthcare providers verified against facility assignments
- **Audit logging**: All access attempts logged with timestamps and IP addresses

### Data Integrity

- **Content hashing**: SHA-256 hashes for integrity verification
- **Version control**: Complete audit trail of all changes
- **Restore points**: Manual and automatic restore capabilities
- **Verification services**: Periodic integrity checks

## Usage Examples

### Creating a Medical Record

```javascript
const medicalRecord = {
  patientId: 123,
  providerId: 456,
  recordType: 'CONSULTATION',
  title: 'Annual Checkup',
  description: 'Routine annual health examination',
  diagnosisCode: 'Z00.00',
  treatmentCode: 'PREVENTIVE',
  dateOfService: '2024-01-15',
  facilityName: 'General Hospital',
  notes: 'Patient in good health',
  priority: 'HIGH'
};

// POST to /api/medical-records-ipfs
// Returns: recordId, ipfsCid, contentHash
```

### Retrieving and Decrypting a Record

```javascript
// GET /api/medical-records-ipfs/789?includeContent=true
// Returns: record metadata + decrypted content
```

### Version Management

```javascript
// Create new version
POST /api/ipfs/version/medical_record/789
{
  "data": updatedRecordData,
  "changeDescription": "Updated diagnosis information"
}

// Get version history
GET /api/ipfs/version/medical_record/789/history

// Restore to previous version
POST /api/ipfs/version/medical_record/789/restore/2
```

### Pinning Critical Records

```javascript
// Pin a record
POST /api/medical-records-ipfs/789/pin
{
  "priority": "CRITICAL"
}

// Check pinning status
GET /api/ipfs/pinned?status=PINNED&priority=CRITICAL
```

## Deployment

### Prerequisites

1. **IPFS Node**: Either local IPFS node or Infura account
2. **Node.js**: Version 16 or higher
3. **SQLite**: For local database storage
4. **Environment Configuration**: Proper environment variables set

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize database:
```bash
# Run the schema migration
sqlite3 database/healthcare.db < database/ipfs-schema.sql
```

4. Start IPFS node (if using local):
```bash
ipfs daemon
```

5. Start the application:
```bash
npm start
```

### Production Considerations

1. **IPFS Node**: Use dedicated IPFS node or Infura for production
2. **Key Management**: Use secure key management system for encryption keys
3. **Backup Strategy**: Regular database backups and IPFS content pinning
4. **Monitoring**: Set up monitoring for IPFS node health and storage usage
5. **Security**: Regular security audits and access log reviews

## Monitoring and Maintenance

### Health Checks

- **IPFS Node Status**: `/api/ipfs/health`
- **Service Statistics**: Various `/api/ipfs/stats/*` endpoints
- **Pinning Queue Status**: Included in pinning statistics

### Maintenance Tasks

1. **Garbage Collection**: `POST /api/ipfs/gc`
2. **Content Cleanup**: `POST /api/ipfs/cleanup`
3. **Verification**: Automated integrity checks
4. **Backup**: Regular database and content backups

### Performance Optimization

1. **Content Caching**: In-memory cache for frequently accessed content
2. **Batch Operations**: Support for bulk encryption/decryption
3. **Queue Management**: Priority-based processing for pinning
4. **Database Indexing**: Optimized indexes for common queries

## Troubleshooting

### Common Issues

1. **IPFS Connection Failed**
   - Check IPFS node is running
   - Verify network connectivity
   - Check environment variables

2. **Encryption/Decryption Errors**
   - Verify encryption key is correct
   - Check key format (hex string)
   - Ensure consistent key usage

3. **Access Denied Errors**
   - Verify user permissions
   - Check patient access validation
   - Review audit logs for details

4. **Pinning Failures**
   - Check IPFS node storage capacity
   - Verify CID exists on network
   - Review pinning queue status

### Logging

All services include comprehensive logging:
- Error logging with stack traces
- Access logging for security
- Operation logging for audit trails
- Performance metrics for monitoring

## Future Enhancements

1. **Multi-node IPFS Cluster**: High availability and load balancing
2. **Advanced Key Management**: Integration with HSM or cloud KMS
3. **Content Sharing**: Secure patient-controlled record sharing
4. **Mobile Optimization**: Mobile-friendly IPFS operations
5. **Analytics Dashboard**: Comprehensive usage and performance analytics

## Support

For issues and questions:
1. Check application logs for detailed error information
2. Review IPFS node logs for network-related issues
3. Consult the audit logs for access-related problems
4. Use health check endpoints to verify service status

## License

This IPFS integration is part of the healthcare platform and follows the same licensing terms as the main application.
