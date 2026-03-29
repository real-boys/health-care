# API Rate Limiting per User

This document describes the implementation of user-specific rate limiting with tiered access and quota management for the Healthcare API.

## Overview

The rate limiting system provides:
- User-specific rate limits based on subscription tiers
- Tiered access levels (Free, Basic, Premium, Enterprise)
- Real-time quota monitoring and management
- Redis-based high-performance rate limiting
- Comprehensive usage analytics and reporting
- Admin tools for quota management and overrides

## Architecture

### Components

1. **Rate Limiting Service** (`services/rateLimitService.js`)
   - Core rate limiting logic with Redis backend
   - User tier management
   - Usage tracking and analytics
   - Quota management

2. **Tier Management Service** (`services/tierManagementService.js`)
   - Subscription tier management
   - User subscription lifecycle
   - Tier upgrade/downgrade operations
   - Revenue and usage analytics

3. **Rate Limiting Middleware** (`middleware/rateLimit.js`)
   - Request rate limiting middleware
   - Multiple rate limiting strategies (user, premium, admin, webhook)
   - Rate limit header management

4. **API Endpoints** (`routes/rateLimiting.js`)
   - Quota monitoring endpoints
   - Subscription management
   - Usage analytics
   - Admin management tools

5. **Database Schema** (`database/rate_limiting_schema.sql`)
   - User tiers and subscriptions
   - API usage tracking
   - Rate limit violations
   - Quota management

## Rate Limiting Tiers

### Free Tier
- **Monthly API Calls**: 1,000
- **Daily API Calls**: 100
- **Hourly API Calls**: 20
- **Minute API Calls**: 5
- **Concurrent Requests**: 1
- **Priority Support**: No
- **Price**: $0.00

### Basic Tier
- **Monthly API Calls**: 5,000
- **Daily API Calls**: 500
- **Hourly API Calls**: 100
- **Minute API Calls**: 20
- **Concurrent Requests**: 2
- **Priority Support**: No
- **Price**: $9.99/month

### Premium Tier
- **Monthly API Calls**: 20,000
- **Daily API Calls**: 2,000
- **Hourly API Calls**: 400
- **Minute API Calls**: 80
- **Concurrent Requests**: 5
- **Priority Support**: Yes
- **Price**: $29.99/month

### Enterprise Tier
- **Monthly API Calls**: 100,000
- **Daily API Calls**: 10,000
- **Hourly API Calls**: 2,000
- **Minute API Calls**: 400
- **Concurrent Requests**: 20
- **Priority Support**: Yes
- **Price**: $99.99/month

## API Endpoints

### Quota Management

#### Get Current Quota
```http
GET /api/rate-limiting/quota
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "quotas": [
      {
        "quota_type": "minute",
        "current_usage": 3,
        "max_allowed": 20,
        "reset_date": "2024-01-01T12:00:00Z"
      }
    ],
    "subscription": {
      "tier_name": "premium",
      "display_name": "Premium Tier",
      "is_active": true
    },
    "tier": "premium"
  }
}
```

#### Get Usage Statistics
```http
GET /api/rate-limiting/usage?period=day&limit=100
Authorization: Bearer {token}
```

**Query Parameters:**
- `period` (optional): `minute`, `hour`, `day`, `month`
- `start_date` (optional): ISO8601 date
- `end_date` (optional): ISO8601 date
- `endpoint` (optional): Filter by endpoint
- `limit` (optional): Number of results (1-1000)

#### Get Rate Limit Violations
```http
GET /api/rate-limiting/violations?limit=50
Authorization: Bearer {token}
```

### Subscription Management

#### Get Available Tiers
```http
GET /api/rate-limiting/tiers
```

#### Subscribe to Tier
```http
POST /api/rate-limiting/subscribe
Authorization: Bearer {token}
Content-Type: application/json

{
  "tier_id": 3,
  "payment_method": "credit_card",
  "auto_renew": true
}
```

#### Upgrade Subscription
```http
POST /api/rate-limiting/upgrade
Authorization: Bearer {token}
Content-Type: application/json

{
  "tier_id": 4
}
```

#### Downgrade Subscription
```http
POST /api/rate-limiting/downgrade
Authorization: Bearer {token}
Content-Type: application/json

{
  "tier_id": 2
}
```

#### Cancel Subscription
```http
POST /api/rate-limiting/cancel
Authorization: Bearer {token}
```

#### Get Subscription History
```http
GET /api/rate-limiting/subscription/history?limit=20
Authorization: Bearer {token}
```

### Admin Endpoints

#### Reset User Quota
```http
POST /api/rate-limiting/admin/reset-quota/{userId}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "quota_type": "minute"
}
```

#### Create Rate Limit Override
```http
POST /api/rate-limiting/admin/override/{userId}
Authorization: Bearer {admin_token}
Content-Type: application/json

{
  "endpoint": "/api/sensitive-endpoint",
  "multiplier": 2.0,
  "custom_limits": {
    "minute_api_calls": 100
  },
  "expires_at": "2024-12-31T23:59:59Z"
}
```

#### Get System Statistics
```http
GET /api/rate-limiting/admin/stats
Authorization: Bearer {admin_token}
```

## Rate Limiting Headers

All API responses include rate limiting headers:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1704067200
X-RateLimit-RetryAfter: 60
X-RateLimit-Window: minute
```

## Rate Limiting Strategies

### User Rate Limiting
Applied to all authenticated users based on their subscription tier.

```javascript
const { userRateLimit } = require('./middleware/rateLimit');
app.use('/api/protected', authenticateToken, userRateLimit(), routes);
```

### Premium Rate Limiting
For premium features requiring higher-tier subscriptions.

```javascript
const { premiumRateLimit } = require('./middleware/rateLimit');
app.use('/api/premium-feature', authenticateToken, premiumRateLimit(), routes);
```

### Admin Rate Limiting
More lenient limits for administrative endpoints.

```javascript
const { adminRateLimit } = require('./middleware/rateLimit');
app.use('/api/admin', authenticateToken, adminRateLimit(), routes);
```

### Webhook Rate Limiting
Specific limits for webhook endpoints.

```javascript
const { webhookRateLimit } = require('./middleware/rateLimit');
app.use('/api/webhooks', authenticateToken, webhookRateLimit(), routes);
```

## Rate Limit Override System

Admins can create custom rate limit overrides for specific users:

### Global Override
Applies to all endpoints for a user:
```json
{
  "user_id": 123,
  "endpoint": null,
  "multiplier": 2.0,
  "custom_limits": null
}
```

### Endpoint-Specific Override
Applies to a specific endpoint:
```json
{
  "user_id": 123,
  "endpoint": "/api/sensitive-endpoint",
  "multiplier": 1.0,
  "custom_limits": {
    "minute_api_calls": 100,
    "hourly_api_calls": 1000
  }
}
```

## Database Schema

### User Tiers
```sql
CREATE TABLE user_tiers (
  id INTEGER PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  monthly_api_calls INTEGER NOT NULL,
  daily_api_calls INTEGER NOT NULL,
  hourly_api_calls INTEGER NOT NULL,
  minute_api_calls INTEGER NOT NULL,
  priority_support BOOLEAN DEFAULT FALSE,
  concurrent_requests INTEGER NOT NULL,
  features TEXT,
  price DECIMAL(10,2) DEFAULT 0.00
);
```

### User Subscriptions
```sql
CREATE TABLE user_subscriptions (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  tier_id INTEGER NOT NULL,
  start_date DATETIME NOT NULL,
  end_date DATETIME,
  is_active BOOLEAN DEFAULT TRUE,
  auto_renew BOOLEAN DEFAULT FALSE,
  payment_method TEXT,
  subscription_id TEXT
);
```

### API Usage Logs
```sql
CREATE TABLE api_usage_logs (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  request_count INTEGER DEFAULT 1,
  window_start DATETIME NOT NULL,
  window_type TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  response_status INTEGER
);
```

### Rate Limit Violations
```sql
CREATE TABLE rate_limit_violations (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL,
  endpoint TEXT NOT NULL,
  method TEXT NOT NULL,
  window_type TEXT NOT NULL,
  limit_value INTEGER NOT NULL,
  actual_count INTEGER NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  blocked_until DATETIME
);
```

## Redis Integration

The rate limiting system uses Redis for high-performance rate limiting:

### Redis Key Structure
```
rate_limit:{userId}:{endpoint}:{method}:{windowType}
```

### Redis Operations
- **ZADD**: Add request timestamp to sorted set
- **ZREMRANGEBYSCORE**: Remove old entries outside window
- **ZCARD**: Count current requests in window
- **EXPIRE**: Set key expiration

### Fallback Mechanism
If Redis is unavailable, the system falls back to in-memory rate limiting using JavaScript Maps.

## Error Handling

### Rate Limit Exceeded (429)
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Limit: 100 per minute.",
  "retryAfter": 60,
  "window": "minute",
  "limit": 100,
  "resetTime": "2024-01-01T12:01:00Z"
}
```

### Authentication Required (401)
```json
{
  "error": "Authentication required",
  "message": "Please provide a valid JWT token"
}
```

### Premium Feature Required (403)
```json
{
  "error": "Premium feature",
  "message": "This feature requires a premium subscription"
}
```

## Monitoring and Analytics

### Usage Metrics
- Request count per user
- Endpoint-specific usage
- Rate limit violations
- Tier distribution
- Revenue analytics

### Admin Dashboard
- System-wide usage statistics
- User quota management
- Rate limit override management
- Violation monitoring

## Configuration

### Environment Variables
```env
# Redis Configuration
REDIS_URL=redis://localhost:6379

# Rate Limiting Configuration
DEFAULT_RATE_LIMIT_WINDOW=900000
DEFAULT_RATE_LIMIT_MAX=100

# Database Configuration
DB_PATH=./database/healthcare.db
```

### Rate Limiting Options
```javascript
const options = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit per window
  message: 'Too many requests',
  standardHeaders: true,
  legacyHeaders: false
};
```

## Testing

### Unit Tests
- Rate limiting service tests
- Tier management tests
- Middleware tests

### Integration Tests
- API endpoint tests
- Rate limit behavior tests
- Admin endpoint tests

### Load Testing
- Concurrent request testing
- Rate limit accuracy testing
- Redis performance testing

## Security Considerations

### Rate Limit Bypass Prevention
- User authentication required for rate limiting
- IP-based rate limiting for unauthenticated requests
- Request signature validation

### Data Protection
- Usage data anonymization options
- Data retention policies
- GDPR compliance considerations

## Performance Optimization

### Redis Optimization
- Connection pooling
- Pipeline operations
- Memory management

### Database Optimization
- Indexes on usage tables
- Partitioned usage data
- Automated cleanup

### Caching Strategies
- User tier caching
- Rate limit result caching
- Usage statistics caching

## Troubleshooting

### Common Issues

1. **Redis Connection Failed**
   - Check Redis server status
   - Verify connection URL
   - System falls back to in-memory limiting

2. **Rate Limits Not Working**
   - Verify authentication middleware order
   - Check user subscription status
   - Review middleware configuration

3. **Performance Issues**
   - Monitor Redis memory usage
   - Check database query performance
   - Review connection pooling

### Debug Logging
```javascript
// Enable debug logging
DEBUG=rate-limit:* npm start
```

## Migration Guide

### From Basic Rate Limiting
1. Install Redis server
2. Update database schema
3. Deploy new middleware
4. Migrate existing users to free tier
5. Update API documentation

### Tier Migration
1. Create new tiers in database
2. Update tier configurations
3. Migrate user subscriptions
4. Update rate limiting middleware
5. Test tier-specific features

## Future Enhancements

### Planned Features
- Real-time usage notifications
- Predictive scaling based on usage patterns
- Custom tier creation
- Advanced analytics dashboard
- API key-based rate limiting

### Scalability Improvements
- Distributed Redis clustering
- Microservice architecture
- Event-driven usage tracking
- Machine learning for anomaly detection

## Support

For questions or issues regarding the rate limiting system:

1. Check the troubleshooting guide
2. Review API documentation
3. Contact the development team
4. Submit an issue in the project repository
