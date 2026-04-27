# Comprehensive Notification System

A robust, scalable notification system for the healthcare application that supports multiple delivery channels, real-time messaging, comprehensive analytics, and advanced template management.

## Features

### ✅ Implemented Features

1. **Multiple Notification Channels**
   - **Email Notifications** - Integrated with SendGrid and SMTP
   - **SMS Notifications** - Powered by Twilio
   - **Push Notifications** - Firebase Cloud Messaging (FCM) for Android/iOS
   - **In-App Notifications** - Real-time WebSocket delivery

2. **Real-Time Notifications**
   - WebSocket-based instant delivery
   - User presence tracking
   - Room-based notifications
   - Typing indicators and status updates

3. **Notification Preferences Management**
   - User-specific preferences per notification type
   - Channel selection (email, SMS, push, in-app)
   - Frequency controls and quiet hours
   - Device token management

4. **Template Management System**
   - Handlebars-based template engine
   - Multi-language support
   - Version control and change tracking
   - Template validation and testing

5. **Comprehensive Analytics**
   - Real-time metrics and dashboards
   - Delivery tracking and SLA monitoring
   - User engagement analytics
   - Performance metrics by channel and type

6. **Delivery Tracking & Reliability**
   - Automatic retry mechanisms with exponential backoff
   - SLA compliance monitoring
   - Delivery event logging
   - Reliability metrics and reporting

## Architecture

### Core Services

```
┌─────────────────────────────────────────────────────────────┐
│                    Notification Integration                 │
│                     (Main Orchestrator)                    │
└─────────────────────┬───────────────────────────────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐   ┌─────────────────┐
│Notification│   │WebSocket    │   │Delivery Tracker │
│Service     │   │Service      │   │& Reliability    │
└─────────┘    └─────────────┘   └─────────────────┘
    │                 │                 │
    ▼                 ▼                 ▼
┌─────────┐    ┌─────────────┐   ┌─────────────────┐
│Template │   │Analytics    │   │Preference       │
│Manager  │   │Service      │   │Service          │
└─────────┘    └─────────────┘   └─────────────────┘
```

### Database Schema

The system uses multiple SQLite tables for comprehensive tracking:

- `notifications_enhanced` - Main notification records
- `notification_analytics_enhanced` - Detailed analytics
- `notification_delivery_tracking` - Delivery tracking
- `notification_delivery_events` - Event logging
- `notification_templates` - Template management
- `notification_preferences` - User preferences

## API Endpoints

### Notification Management

#### Send Notifications
```http
POST /api/notifications-enhanced/send
Content-Type: application/json
Authorization: Bearer <token>

{
  "userId": 123,
  "type": "appointment",
  "templateName": "appointment_reminder",
  "data": {
    "patientName": "John Doe",
    "appointmentTime": "2024-01-15T10:00:00Z",
    "doctorName": "Dr. Smith"
  },
  "priority": "high",
  "channels": ["email", "sms", "push", "in_app"]
}
```

#### Bulk Notifications
```http
POST /api/notifications-enhanced/bulk
Content-Type: application/json
Authorization: Bearer <token>

{
  "recipients": [
    {"userId": 123, "customData": {"patientName": "John"}},
    {"userId": 124, "customData": {"patientName": "Jane"}}
  ],
  "type": "system",
  "templateName": "maintenance_notice",
  "data": {"message": "System maintenance scheduled"},
  "priority": "medium"
}
```

#### Get User Notifications
```http
GET /api/notifications-enhanced/user/123?limit=20&offset=0&type=appointment&status=read
Authorization: Bearer <token>
```

#### Mark as Read
```http
PUT /api/notifications-enhanced/abc-123/read
Content-Type: application/json
Authorization: Bearer <token>

{
  "userId": 123
}
```

### Template Management

#### List Templates
```http
GET /api/notifications-enhanced/templates?type=appointment&channel=email&isActive=true
Authorization: Bearer <token>
```

#### Create Template
```http
POST /api/notifications-enhanced/templates
Content-Type: application/json
Authorization: Bearer <token>

{
  "name": "appointment_reminder",
  "type": "appointment",
  "channel": "email",
  "language": "en",
  "subjectTemplate": "Appointment Reminder - {{patientName}}",
  "bodyTemplate": "Dear {{patientName}}, your appointment with {{doctorName}} is scheduled for {{formatDate appointmentTime}}.",
  "variables": ["patientName", "doctorName", "appointmentTime"],
  "isActive": true
}
```

#### Update Template
```http
PUT /api/notifications-enhanced/templates/123
Content-Type: application/json
Authorization: Bearer <token>

{
  "bodyTemplate": "Updated template content",
  "changeDescription": "Improved patient greeting"
}
```

### Analytics & Monitoring

#### Get Analytics
```http
GET /api/notifications-enhanced/analytics?startDate=2024-01-01&endDate=2024-01-31&type=appointment
Authorization: Bearer <token>
```

#### Get WebSocket Stats
```http
GET /api/notifications-enhanced/websocket/stats
Authorization: Bearer <token>
```

### Preferences Management

#### Get User Preferences
```http
GET /api/notification-preferences/user/123
Authorization: Bearer <token>
```

#### Update Preferences
```http
PUT /api/notification-preferences/user/123
Content-Type: application/json
Authorization: Bearer <token>

{
  "preferences": {
    "appointment": {
      "enabled": true,
      "channels": ["email", "push"],
      "quietHours": {
        "enabled": true,
        "start": "22:00",
        "end": "08:00"
      }
    }
  }
}
```

#### Add Device Token
```http
POST /api/notification-preferences/user/123/devices
Content-Type: application/json
Authorization: Bearer <token>

{
  "deviceToken": "fcm_device_token_here",
  "deviceType": "android",
  "deviceId": "unique_device_id"
}
```

## WebSocket Events

### Client-Side Events

#### Connection
```javascript
const socket = io('ws://localhost:5000', {
  auth: {
    token: 'jwt_token_here'
  }
});

socket.on('connected', (data) => {
  console.log('Connected with session:', data.sessionId);
});
```

#### Join Notification Rooms
```javascript
socket.emit('join-notifications', {
  rooms: ['user-updates', 'appointment-123']
});
```

#### Mark Notification as Read
```javascript
socket.emit('mark-notification-read', {
  notificationId: 'abc-123'
});
```

#### Server-Sent Events
```javascript
// New notification
socket.on('notification', (notification) => {
  console.log('New notification:', notification);
});

// User status updates
socket.on('user-status', (status) => {
  console.log('User status:', status);
});

// Typing indicators
socket.on('user-typing', (data) => {
  console.log('User typing:', data);
});
```

## Configuration

### Environment Variables

Create a `.env.notification` file with the following:

```bash
# Redis Configuration
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Email Configuration (SendGrid)
EMAIL_SERVICE=sendgrid
SENDGRID_API_KEY=your_sendgrid_api_key_here
EMAIL_FROM=noreply@stellarhealth.com

# Alternative SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password_here

# SMS Configuration (Twilio)
TWILIO_ACCOUNT_SID=your_twilio_account_sid_here
TWILIO_AUTH_TOKEN=your_twilio_auth_token_here
TWILIO_PHONE_NUMBER=your_twilio_phone_number_here

# Push Notifications (Firebase)
FCM_SERVER_KEY=your_fcm_server_key_here
FCM_PROJECT_ID=your_fcm_project_id
FCM_CLIENT_EMAIL=your_fcm_client_email
FCM_PRIVATE_KEY=your_fcm_private_key

# Database Configuration
DB_PATH=./database/healthcare.db

# Server Configuration
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# Security
JWT_SECRET=your_jwt_secret_key_here
BCRYPT_ROUNDS=12
```

## Template Engine

The system uses Handlebars for template rendering with custom helpers:

### Built-in Helpers

- `{{formatDate date 'YYYY-MM-DD'}}` - Format dates
- `{{formatCurrency amount 'USD'}}` - Format currency
- `{{capitalize string}}` - Capitalize first letter
- `{{uppercase string}}` - Convert to uppercase
- `{{lowercase string}}` - Convert to lowercase
- `{{truncate string 50}}` - Truncate string
- `{{eq a b}}` - Equality check
- `{{gt a b}}` - Greater than check
- `{{lt a b}}` - Less than check

### Example Template

```handlebars
Subject: Appointment Reminder - {{patientName}}

Dear {{capitalize patientName}},

This is a reminder that your appointment with Dr. {{doctorName}} is scheduled for:

{{formatDate appointmentTime 'MMMM Do, YYYY [at] h:mm A'}}

Location: {{location}}
Duration: {{duration}} minutes

Please arrive 15 minutes early. If you need to reschedule, call us at {{phoneNumber}}.

Best regards,
{{clinicName}} Healthcare Team
```

## Analytics & Monitoring

### Real-Time Metrics

- **Delivery Rates** - Success/failure rates by channel
- **Engagement Metrics** - Read rates, click-through rates
- **Performance Metrics** - Delivery times, processing times
- **User Activity** - Active users, connection counts

### SLA Monitoring

- **Delivery Time SLAs** - Target delivery times by priority
- **Compliance Rates** - Percentage meeting SLA targets
- **Reliability Metrics** - Success rates, retry patterns

### Available Reports

1. **Delivery Analytics** - Comprehensive delivery statistics
2. **User Engagement** - User interaction patterns
3. **Performance Reports** - System performance metrics
4. **SLA Compliance** - Service level agreement adherence
5. **Template Performance** - Template usage and effectiveness

## Reliability Features

### Automatic Retry Logic

- **Exponential Backoff** - 5s, 15s, 30s retry intervals
- **Max Retry Attempts** - Configurable retry limits
- **Selective Retries** - Different strategies per channel
- **Failure Classification** - Bounce, reject, temporary failures

### Error Handling

- **Graceful Degradation** - Fallback channels on failure
- **Circuit Breaker Pattern** - Prevent cascade failures
- **Dead Letter Queue** - Handle permanently failed notifications
- **Error Classification** - Categorize and handle different error types

## Security Considerations

1. **Authentication** - JWT-based authentication for all API endpoints
2. **Authorization** - Role-based access control (admin/user)
3. **Data Privacy** - HIPAA compliance for healthcare data
4. **Rate Limiting** - Prevent abuse and spam
5. **Input Validation** - Comprehensive validation for all inputs
6. **Secure Templates** - Prevent template injection attacks

## Performance Optimization

1. **Caching** - Template caching and user preference caching
2. **Batch Processing** - Bulk notification processing
3. **Connection Pooling** - Database and external service connections
4. **Async Processing** - Non-blocking notification delivery
5. **Queue Management** - Redis-based queuing system

## Monitoring & Alerting

### Health Checks

```http
GET /api/health
```

Returns system health status including:
- Service availability
- Database connectivity
- External service status
- WebSocket connection counts

### Metrics Endpoints

```http
GET /api/notifications-enhanced/analytics
GET /api/notifications-enhanced/websocket/stats
```

## Deployment

### Production Setup

1. **Environment Configuration** - Set all required environment variables
2. **Database Setup** - Initialize SQLite database with proper permissions
3. **External Services** - Configure SendGrid, Twilio, and Firebase
4. **SSL/TLS** - Enable HTTPS for production
5. **Load Balancing** - Configure for high availability

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

## Testing

### Unit Tests

```bash
npm test -- --testPathPattern=notification
```

### Integration Tests

```bash
npm run test:integration
```

### Load Testing

```bash
npm run test:load
```

## Troubleshooting

### Common Issues

1. **Notifications Not Sending**
   - Check external service credentials
   - Verify database connectivity
   - Review service logs

2. **WebSocket Connection Issues**
   - Check JWT token validity
   - Verify CORS configuration
   - Review firewall settings

3. **Template Rendering Errors**
   - Validate Handlebars syntax
   - Check variable availability
   - Review template validation logs

### Debug Mode

Enable debug logging:

```bash
DEBUG=notifications:* npm start
```

## Future Enhancements

1. **Multi-tenant Support** - Support for multiple healthcare providers
2. **Advanced Segmentation** - User segmentation for targeted notifications
3. **A/B Testing** - Template and delivery method testing
4. **Machine Learning** - Intelligent delivery optimization
5. **Mobile App Integration** - Enhanced mobile notification features
6. **Compliance Reporting** - Automated compliance report generation

## Support

For technical support or questions about the notification system:

1. Check the logs in the application console
2. Review the analytics dashboard for delivery issues
3. Verify external service configurations
4. Check the health endpoints for system status

---

**Note**: This notification system is designed to be HIPAA compliant and handles sensitive healthcare data with appropriate security measures.
