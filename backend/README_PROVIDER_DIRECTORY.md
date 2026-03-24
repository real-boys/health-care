# Healthcare Provider Network Directory API

A comprehensive backend API for managing healthcare provider directories with advanced features including geospatial search, availability management, review moderation, and third-party directory integration.

## Features

### 🔍 Provider Search & Discovery
- **Geospatial Search**: Find providers by location with radius-based filtering using PostGIS
- **Advanced Filtering**: Filter by specialty, insurance, availability, ratings, and more
- **Full-Text Search**: Powerful search across provider profiles, specialties, and descriptions
- **Smart Sorting**: Sort by distance, rating, experience, or name

### 📅 Availability Management
- **Calendar Integration**: Sync with Google Calendar for real-time availability
- **Flexible Scheduling**: Set regular hours, breaks, and special availability
- **Time Slot Generation**: Automatically generate available appointment slots
- **Holiday Management**: Mark unavailable dates and special events

### ⭐ Review System
- **Multi-Dimensional Ratings**: Rate bedside manner, wait time, staff friendliness
- **Review Moderation**: Automated and manual review approval system
- **Helpfulness Voting**: Patients can vote on review helpfulness
- **Provider Responses**: Allow providers to respond to patient reviews

### 🔐 Verification & Credentialing
- **Document Upload**: Secure upload of licenses, certificates, and credentials
- **Admin Review**: Comprehensive verification workflow for administrators
- **Status Tracking: Track verification status from pending to approved
- **Credential Management**: Manage multiple credentials and specializations

### 🔗 Third-Party Integration
- **Directory Sync**: Sync provider data with Healthgrades, Zocdoc, WebMD, and Vitals
- **Bulk Operations**: Efficient bulk sync for multiple providers
- **Scheduled Sync**: Automated daily/weekly/monthly synchronization
- **Error Handling**: Comprehensive error tracking and retry mechanisms

## Database Architecture

### Core Tables
- **healthcare_providers**: Main provider profiles with geospatial data
- **provider_specialties**: Provider specializations and categories
- **provider_credentials**: Professional credentials and certifications
- **provider_availability**: Regular and special availability schedules
- **provider_reviews**: Patient reviews with moderation workflow
- **provider_verification_documents**: Verification document management

### Advanced Features
- **PostGIS Integration**: Geospatial queries for location-based search
- **Full-Text Search**: PostgreSQL tsvector for efficient text search
- **Database Triggers**: Automatic rating updates and search vector maintenance
- **JSONB Storage**: Flexible storage for complex data structures

## API Endpoints

### Provider Search
```
GET /api/providers/search
Query Parameters:
- latitude, longitude: Location coordinates
- radius: Search radius in miles (default: 25)
- specialty: Filter by specialty
- city, state, zip_code: Location filters
- accepting_new_patients: Boolean filter
- telehealth_available: Boolean filter
- min_rating: Minimum rating filter
- page, limit: Pagination
- sort_by: distance, rating, name, experience
```

### Provider Details
```
GET /api/providers/:id
GET /api/providers/:id/availability?start_date=2024-01-01&end_date=2024-01-31
GET /api/providers/:id/reviews?page=1&limit=10&sort_by=date
```

### Reviews
```
POST /api/providers/:id/reviews
POST /api/providers/:id/reviews/:review_id/helpful
```

### Provider Management (Providers Only)
```
GET /api/provider-availability
PUT /api/provider-availability
POST /api/provider-availability/special
GET /api/provider-availability/special
DELETE /api/provider-availability/special/:date
GET /api/provider-availability/calendar/slots?date=2024-01-01
```

### Calendar Integration
```
POST /api/provider-availability/calendar/connect
DELETE /api/provider-availability/calendar/disconnect
```

### Verification System
```
POST /api/provider-verification/submit
GET /api/provider-verification/status
POST /api/provider-verification/documents/upload
GET /api/provider-verification/documents
DELETE /api/provider-verification/documents/:id
```

### Admin Verification
```
GET /api/provider-verification/admin/pending
GET /api/provider-verification/admin/:id
POST /api/provider-verification/admin/:id/approve
POST /api/provider-verification/admin/:id/reject
```

### Review Moderation (Admin)
```
GET /api/review-moderation/pending
GET /api/review-moderation/flagged
POST /api/review-moderation/:review_id/approve
POST /api/review-moderation/:review_id/reject
POST /api/review-moderation/:review_id/flag
POST /api/review-moderation/bulk-approve
POST /api/review-moderation/bulk-reject
GET /api/review-moderation/analytics
```

### Directory Sync (Admin)
```
GET /api/directory-sync/providers
POST /api/directory-sync/sync/:directory/:provider_id
POST /api/directory-sync/bulk/:directory
GET /api/directory-sync/analytics
POST /api/directory-sync/configure/:directory
GET /api/directory-sync/configurations
```

## Setup Instructions

### Prerequisites
- Node.js 18+
- PostgreSQL 14+ with PostGIS extension
- Redis (for caching)
- Google Calendar API credentials (optional)

### Database Setup

1. **Create PostgreSQL database with PostGIS:**
```sql
CREATE DATABASE healthcare_providers;
\c healthcare_providers
CREATE EXTENSION IF NOT EXISTS postgis;
```

2. **Run database migrations:**
```bash
# Run the main schema
psql -d healthcare_providers -f database/provider_schema.sql

# Run additional tables
psql -d healthcare_providers -f database/additional_tables.sql
```

### Environment Variables

Create `.env` file in the backend directory:
```env
# Database
DATABASE_URL=postgresql://username:password@localhost:5432/healthcare_providers

# JWT
JWT_SECRET=your-jwt-secret-key

# Email (for notifications)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
FROM_EMAIL=noreply@healthcare.com

# Google Calendar API
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:5000/api/provider-availability/calendar/callback

# Directory APIs
HEALTHGRADES_API_KEY=your-healthgrades-api-key
ZOCDOC_API_KEY=your-zocdoc-api-key
WEBMD_API_KEY=your-webmd-api-key
VITALS_API_KEY=your-vitals-api-key

# File Upload
UPLOAD_DIR=./uploads
MAX_FILE_SIZE=10485760

# Redis
REDIS_URL=redis://localhost:6379

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### Installation

1. **Install dependencies:**
```bash
cd backend
npm install
```

2. **Create uploads directory:**
```bash
mkdir -p uploads/verification
mkdir -p uploads/profiles
```

3. **Start the server:**
```bash
# Development
npm run dev

# Production
npm start
```

## API Usage Examples

### Search for Providers
```javascript
// Find cardiologists within 10 miles of New York City
const response = await fetch('/api/providers/search?' + new URLSearchParams({
  latitude: 40.7128,
  longitude: -74.0060,
  radius: 10,
  specialty: 'cardiology',
  accepting_new_patients: true,
  min_rating: 4.0,
  page: 1,
  limit: 20,
  sort_by: 'rating'
}));

const data = await response.json();
console.log(data.providers);
```

### Submit Provider Verification
```javascript
const formData = new FormData();
formData.append('first_name', 'John');
formData.append('last_name', 'Doe');
formData.append('npi_number', '1234567890');
formData.append('specialties', JSON.stringify([{id: 1, is_primary: true}]));
formData.append('credentials', JSON.stringify([{id: 1, credential_number: 'MD12345'}]));
formData.append('documents', fileInput.files[0]);

const response = await fetch('/api/provider-verification/submit', {
  method: 'POST',
  body: formData,
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Get Provider Availability
```javascript
const response = await fetch('/api/providers/123/availability?' + new URLSearchParams({
  start_date: '2024-01-01',
  end_date: '2024-01-31'
}), {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const availability = await response.json();
console.log(availability.available_slots);
```

## Performance Optimization

### Database Indexes
- Geospatial indexes on provider locations
- Full-text search indexes on provider profiles
- Composite indexes on common filter combinations
- Time-based indexes on availability and reviews

### Caching Strategy
- Redis caching for frequently accessed provider data
- Cache invalidation on profile updates
- Search result caching with TTL
- Static asset caching for profile images

### Search Optimization
- PostGIS for efficient geospatial queries
- PostgreSQL full-text search with tsvector
- Elasticsearch integration for advanced search (optional)
- Query optimization with proper indexing

## Security Features

### Authentication & Authorization
- JWT-based authentication
- Role-based access control (patient, provider, admin)
- API rate limiting
- Request validation and sanitization

### Data Protection
- Encrypted sensitive data storage
- Secure file upload handling
- SQL injection prevention
- XSS protection

### Privacy Compliance
- HIPAA-compliant data handling
- Patient data anonymization
- Audit logging for sensitive operations
- Data retention policies

## Monitoring & Analytics

### Search Analytics
- Track search queries and filters
- Monitor provider profile views
- Analyze conversion rates
- Geographic search patterns

### Review Analytics
- Review sentiment analysis
- Moderation queue efficiency
- Rating distribution analysis
- Report pattern tracking

### Sync Analytics
- Directory sync success rates
- Error pattern analysis
- API performance monitoring
- Sync frequency optimization

## Testing

### Unit Tests
```bash
npm test
```

### Integration Tests
```bash
npm run test:integration
```

### API Testing
Use the provided Postman collection or run:
```bash
npm run test:api
```

## Deployment

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["npm", "start"]
```

### Environment Configuration
- Production database configuration
- SSL/TLS setup
- Load balancer configuration
- Monitoring and logging setup

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue in the repository
- Contact the development team
- Check the documentation wiki

---

**Note**: This API is designed to be HIPAA compliant. Ensure proper security measures and data handling procedures are in place when handling protected health information (PHI).
