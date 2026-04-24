# File Storage and CDN Service

## Overview

The File Storage and CDN Service provides secure, scalable file storage with AWS S3 integration and CloudFront CDN for optimized global delivery. It includes image optimization, file access controls, versioning, backup, and comprehensive analytics.

## Features

### AWS S3 Integration
- **Secure Storage**: AES-256 encryption at rest
- **Redundant Storage**: Multiple availability zones
- **Versioning**: File version tracking and rollback
- **Lifecycle Management**: Automatic archival to Glacier
- **Backup**: Automated backup to separate bucket

### CloudFront CDN
- **Global Delivery**: Fast content delivery worldwide
- **Signed URLs**: Secure, time-limited access
- **Edge Caching**: Reduced latency and bandwidth
- **Custom Domains**: Branded CDN URLs
- **SSL/TLS**: Secure content delivery

### Image Optimization
- **Automatic Resizing**: Dimension limits and aspect ratio preservation
- **Format Optimization**: JPEG, PNG, WebP compression
- **Quality Control**: Configurable compression levels
- **Progressive Loading**: Faster image rendering
- **Thumbnail Generation**: Automatic thumbnail creation

### File Access Controls
- **User Permissions**: Owner-based access control
- **Sharing System**: Granular permission sharing
- **Role-Based Access**: Admin, provider, agent roles
- **Audit Logging**: Complete access trail
- **Time-Limited URLs**: Expiring download links

### Analytics & Monitoring
- **Storage Analytics**: Usage statistics and trends
- **Access Patterns**: Download and view tracking
- **File Metrics**: Popular files and usage patterns
- **Cost Analysis**: Storage and transfer costs
- **Performance Metrics**: CDN performance tracking

## Installation & Configuration

### Environment Variables

```bash
# AWS Configuration
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=your-healthcare-files-bucket
AWS_S3_BACKUP_BUCKET=your-healthcare-backup-bucket
AWS_S3_VERSIONING=true
AWS_S3_BACKUP_ENABLED=true

# CloudFront Configuration
AWS_CLOUDFRONT_DOMAIN=your-cloudfront-domain.cloudfront.net
AWS_CLOUDFRONT_KEY_PAIR_ID=your_key_pair_id
AWS_CLOUDFRONT_PRIVATE_KEY=-----BEGIN RSA PRIVATE KEY-----
your_private_key_content_here
-----END RSA PRIVATE KEY-----

# File Storage Settings
MAX_FILE_SIZE=104857600
ALLOWED_FILE_TYPES=image/jpeg,image/png,image/gif,image/webp,image/svg+xml,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,text/csv,text/html,text/css,text/javascript,application/zip,application/x-rar-compressed,application/x-7z-compressed

# Image Optimization
IMAGE_OPTIMIZATION_ENABLED=true
MAX_IMAGE_WIDTH=2048
MAX_IMAGE_HEIGHT=2048
JPEG_QUALITY=85
PNG_COMPRESSION=8

# Backup and Retention
FILE_RETENTION_DAYS=2555
BACKUP_RETENTION_DAYS=3650
AUTO_CLEANUP_ENABLED=true
```

### AWS S3 Setup

1. **Create S3 Buckets**:
   ```bash
   # Main storage bucket
   aws s3 mb s3://your-healthcare-files-bucket
   
   # Backup bucket
   aws s3 mb s3://your-healthcare-backup-bucket
   ```

2. **Configure Bucket Policies**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Sid": "PublicReadGetObject",
         "Effect": "Allow",
         "Principal": "*",
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-healthcare-files-bucket/public/*"
       }
     ]
   }
   ```

3. **Enable Versioning**:
   ```bash
   aws s3api put-bucket-versioning --bucket your-healthcare-files-bucket --versioning-configuration Status=Enabled
   ```

4. **Configure Lifecycle Rules**:
   ```json
   {
     "Rules": [
       {
         "ID": "BackupRule",
         "Status": "Enabled",
         "Filter": { "Prefix": "" },
         "Transitions": [
           {
             "Days": 30,
             "StorageClass": "STANDARD_IA"
           },
           {
             "Days": 90,
             "StorageClass": "GLACIER"
           }
         ]
       }
     ]
   }
   ```

### CloudFront Setup

1. **Create Distribution**:
   ```bash
   aws cloudfront create-distribution --distribution-config file://cloudfront-config.json
   ```

2. **Configure Origin Access Identity**:
   ```bash
   aws cloudfront create-cloud-front-origin-access-identity --cloud-front-origin-access-identity-config file://oai-config.json
   ```

3. **Update S3 Bucket Policy**:
   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Principal": {
           "AWS": "arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity XXXXX"
         },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::your-healthcare-files-bucket/*"
       }
     ]
   }
   ```

## API Endpoints

### File Upload
```
POST /api/files/upload
Content-Type: multipart/form-data
```

**Request Body**:
- `file`: File data (multipart)
- `documentType`: Document type classification
- `relatedTo`: Related entity type
- `description`: File description
- `tags`: File tags (JSON array)
- `isPublic`: Public access flag

**Response**:
```json
{
  "success": true,
  "data": {
    "document": { ... },
    "url": "https://s3.amazonaws.com/...",
    "cdnUrl": "https://cdn.example.com/..."
  }
}
```

### File Download
```
GET /api/files/:documentId/download
```

**Query Parameters**:
- `expiresIn`: URL expiration time (seconds)

**Response**:
```json
{
  "success": true,
  "data": {
    "signedUrl": "https://s3.amazonaws.com/...",
    "cdnSignedUrl": "https://cdn.example.com/...",
    "expiresIn": 3600,
    "fileName": "document.pdf",
    "fileSize": 1024000,
    "mimeType": "application/pdf"
  }
}
```

### File Management
```
GET /api/files/:documentId              # Get file info
DELETE /api/files/:documentId           # Delete file
POST /api/files/:documentId/version     # Create version
POST /api/files/:documentId/archive     # Archive file
POST /api/files/:documentId/restore     # Restore file
```

### File Sharing
```
POST /api/files/:documentId/share           # Share file
DELETE /api/files/:documentId/share/:userId  # Remove sharing
PUT /api/files/:documentId/share/:userId     # Update permissions
GET /api/files/shared/with-me                # Get shared files
```

### Analytics & Search
```
GET /api/files/analytics/:userId       # Get file analytics
GET /api/files/search/:userId          # Search files
GET /api/files/user/:userId             # Get user files
GET /api/files/storage/stats/:userId   # Get storage stats
```

## File Types & Validation

### Supported File Types

#### Images
- JPEG (.jpg, .jpeg)
- PNG (.png)
- GIF (.gif)
- WebP (.webp)
- SVG (.svg)

#### Documents
- PDF (.pdf)
- Microsoft Word (.doc, .docx)
- Microsoft Excel (.xls, .xlsx)

#### Text & Code
- Plain Text (.txt)
- CSV (.csv)
- HTML (.html)
- CSS (.css)
- JavaScript (.js)

#### Archives
- ZIP (.zip)
- RAR (.rar)
- 7-Zip (.7z)

### File Validation

#### Size Limits
- Maximum file size: 100MB (configurable)
- Image optimization reduces size automatically
- Large files trigger compliance review

#### Type Validation
- MIME type verification
- File extension validation
- Content-based type detection

#### Security Scanning
- Malware scanning (integration available)
- Content validation for sensitive data
- Automatic quarantine for suspicious files

## Image Optimization Pipeline

### Processing Steps

1. **Format Detection**: Identify image type and characteristics
2. **Auto-Orientation**: Correct image orientation using EXIF data
3. **Size Optimization**: Resize if dimensions exceed limits
4. **Quality Optimization**: Apply compression based on format
5. **Progressive Loading**: Enable progressive rendering
6. **Thumbnail Generation**: Create thumbnail versions

### Optimization Settings

#### JPEG Images
- Quality: 85% (configurable)
- Progressive: Enabled
- Optimization: True

#### PNG Images
- Compression Level: 8 (configurable)
- Progressive: Enabled
- Color Optimization: True

#### WebP Images
- Quality: 85% (configurable)
- Lossless: Auto-detect
- Alpha Channel: Preserve

### Performance Benefits

- **Reduced Bandwidth**: 30-70% size reduction
- **Faster Loading**: Progressive image rendering
- **Better UX**: Improved page load times
- **Cost Savings**: Reduced CDN transfer costs

## Access Control System

### Permission Model

#### Owner Permissions
- Full control over owned files
- Can share with other users
- Can delete and modify files
- Can manage file versions

#### Shared Permissions
- **View**: Download and view file
- **Edit**: Modify file metadata and upload new versions
- **Delete**: Remove file (owner only)

#### Role-Based Access
- **Admin**: Full system access
- **Provider**: Access to patient-related files
- **Agent**: Limited access to assigned files
- **User**: Access to own files only

### Access Control Implementation

#### Database Schema
```javascript
{
  "user": ObjectId,
  "sharedWith": [
    {
      "user": ObjectId,
      "permission": "view|edit|delete",
      "sharedAt": Date
    }
  ],
  "isPublic": Boolean,
  "viewedBy": [
    {
      "user": ObjectId,
      "viewedAt": Date
    }
  ]
}
```

#### Permission Checks
1. **Owner Check**: User owns the file
2. **Shared Check**: User has explicit permission
3. **Role Check**: User role grants access
4. **Public Check**: File is publicly accessible

### Audit Trail

#### Access Logging
- File access attempts
- Download actions
- Permission changes
- Sharing activities

#### Security Events
- Unauthorized access attempts
- Permission escalation
- Suspicious download patterns
- File access violations

## Version Management

### Version Control Features

#### Automatic Versioning
- Every upload creates new version
- Version history tracking
- Rollback capability
- Version comparison

#### Version Metadata
```javascript
{
  "versions": [
    {
      "documentId": ObjectId,
      "createdAt": Date,
      "createdBy": ObjectId,
      "version": 1
    }
  ]
}
```

#### Version Operations
- **Create Version**: Upload new version of existing file
- **List Versions**: View version history
- **Restore Version**: Rollback to previous version
- **Compare Versions**: Compare version differences

### Storage Optimization

#### Version Storage
- Delta compression for similar files
- Automatic cleanup of old versions
- Configurable retention policies
- Archive old versions to Glacier

#### Cost Management
- Lifecycle policies for version storage
- Automatic transition to cheaper storage
- Monitoring of storage costs
- Usage analytics and reporting

## Backup & Disaster Recovery

### Backup Strategy

#### Primary Backup
- Real-time replication to backup bucket
- Cross-region replication (configurable)
- Point-in-time recovery capability
- Automated backup verification

#### Backup Types
- **Full Backup**: Complete bucket backup
- **Incremental Backup**: Changes since last backup
- **Differential Backup**: Changes since full backup
- **Continuous Backup**: Real-time replication

### Disaster Recovery

#### Recovery Procedures
1. **Assessment**: Determine scope of data loss
2. **Restoration**: Restore from backup bucket
3. **Verification**: Validate restored data
4. **Testing**: Confirm system functionality

#### Recovery Time Objectives
- **RTO**: 4 hours for critical files
- **RPO**: 1 hour for recent changes
- **Availability**: 99.9% uptime target
- **Data Integrity**: 100% accuracy requirement

### Backup Monitoring

#### Health Checks
- Daily backup verification
- Cross-region replication status
- Storage capacity monitoring
- Backup success rate tracking

#### Alerting
- Backup failure notifications
- Storage capacity warnings
- Replication lag alerts
- Recovery time monitoring

## Analytics & Monitoring

### Storage Analytics

#### Usage Metrics
- Total storage usage by user
- File type distribution
- Growth trends over time
- Cost analysis by category

#### Performance Metrics
- Upload/download speeds
- CDN hit ratios
- Geographic distribution
- Peak usage patterns

### Access Analytics

#### User Behavior
- Most accessed files
- Download patterns
- Sharing frequency
- Search queries

#### Security Analytics
- Failed access attempts
- Unusual access patterns
- Permission violations
- Geographic anomalies

### Reporting

#### Standard Reports
- Daily usage summary
- Weekly trend analysis
- Monthly cost report
- Quarterly compliance review

#### Custom Reports
- User-specific analytics
- Department-level usage
- Project-based storage
- Regulatory compliance reports

## Security Considerations

### Data Protection

#### Encryption
- AES-256 encryption at rest
- TLS 1.3 in transit
- Customer-managed keys (optional)
- Key rotation policies

#### Access Security
- IAM role-based access
- Temporary credentials
- Multi-factor authentication
- Network security groups

### Compliance

#### HIPAA Compliance
- PHI data protection
- Audit trail requirements
- Access control verification
- Business associate agreements

#### GDPR Compliance
- Data residency requirements
- Right to be forgotten
- Data portability
- Consent management

#### SOC 2 Compliance
- Security controls
- Availability monitoring
- Processing integrity
- Confidentiality protection

## Performance Optimization

### CDN Optimization

#### Caching Strategies
- Edge location caching
- Cache invalidation policies
- Dynamic content optimization
- Geographic distribution

#### Performance Tuning
- TTL configuration
- Compression settings
- HTTP/2 optimization
- Brotli compression

### Database Optimization

#### Indexing Strategy
- User-based queries
- File type searches
- Date-based filtering
- Geographic queries

#### Query Optimization
- Pagination for large result sets
- Aggregation pipelines
- Connection pooling
- Read replicas for analytics

## Troubleshooting

### Common Issues

#### Upload Failures
- Check file size limits
- Verify file type support
- Review S3 permissions
- Check network connectivity

#### Download Issues
- Verify signed URL expiration
- Check CDN configuration
- Review access permissions
- Validate file existence

#### Performance Problems
- Monitor CDN performance
- Check S3 throughput limits
- Review database query performance
- Analyze network latency

### Debug Tools

#### Logging
- Application logs
- S3 access logs
- CloudFront logs
- Performance metrics

#### Monitoring
- AWS CloudWatch metrics
- Application performance monitoring
- Error rate tracking
- User experience monitoring

## Best Practices

### File Management
- Use descriptive file names
- Organize files with proper metadata
- Implement retention policies
- Regular cleanup of unused files

### Security
- Principle of least privilege
- Regular access reviews
- Encryption for sensitive data
- Comprehensive audit logging

### Performance
- Optimize file sizes before upload
- Use appropriate file formats
- Implement caching strategies
- Monitor CDN performance

### Cost Management
- Use appropriate storage classes
- Implement lifecycle policies
- Monitor usage patterns
- Optimize CDN configuration

## Testing

### Unit Tests
```bash
npm test -- tests/fileStorage.test.js
```

### Integration Tests
- S3 connectivity testing
- CDN functionality verification
- Upload/download workflows
- Permission system validation

### Load Testing
- Concurrent upload testing
- High-volume download testing
- CDN performance testing
- Database load testing

## Maintenance

### Regular Tasks
- Review storage usage and costs
- Update backup configurations
- Monitor CDN performance
- Review access permissions

### System Updates
- AWS SDK updates
- Security patch application
- Configuration updates
- Performance tuning

### Monitoring
- Storage capacity monitoring
- Performance metric tracking
- Error rate monitoring
- Cost analysis and optimization
