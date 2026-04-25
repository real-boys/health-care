const nodemailer = require('nodemailer');
const twilio = require('twilio');
const admin = require('firebase-admin');

class NotificationDeliveryService {
  constructor() {
    this.emailTransporter = null;
    this.twilioClient = null;
    this.firebaseApp = null;
    this.initializeServices();
  }

  initializeServices() {
    // Initialize Email Service (SendGrid/Nodemailer)
    if (process.env.EMAIL_SERVICE === 'sendgrid') {
      this.emailTransporter = nodemailer.createTransport({
        service: 'SendGrid',
        auth: {
          user: process.env.SENDGRID_API_KEY,
          pass: process.env.SENDGRID_API_KEY
        }
      });
    } else {
      // Default to SMTP
      this.emailTransporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST || 'smtp.gmail.com',
        port: process.env.SMTP_PORT || 587,
        secure: false,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }

    // Initialize SMS Service (Twilio)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.twilioClient = twilio(
        process.env.TWILIO_ACCOUNT_SID,
        process.env.TWILIO_AUTH_TOKEN
      );
    }

    // Initialize Firebase Admin for FCM
    this.initializeFirebase();
  }

  initializeFirebase() {
    try {
      if (!admin.apps.length) {
        const serviceAccountPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        if (serviceAccountPath && process.env.FCM_SERVER_KEY) {
          // Initialize with service account file
          const serviceAccount = require(serviceAccountPath);
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
          });
        } else if (process.env.FCM_SERVER_KEY) {
          // Initialize with server key
          this.firebaseApp = admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FCM_PROJECT_ID,
              clientEmail: process.env.FCM_CLIENT_EMAIL,
              privateKey: process.env.FCM_PRIVATE_KEY?.replace(/\\n/g, '\n')
            })
          });
        } else {
          console.warn('Firebase Admin not configured. Push notifications will be simulated.');
        }
      } else {
        this.firebaseApp = admin.apps[0];
      }
    } catch (error) {
      console.error('Failed to initialize Firebase Admin:', error);
    }
  }

  async sendEmail(to, subject, body, attachments = []) {
    try {
      const mailOptions = {
        from: process.env.EMAIL_FROM || 'noreply@stellarhealth.com',
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: subject,
        html: body,
        attachments: attachments
      };

      const result = await this.emailTransporter.sendMail(mailOptions);
      
      console.log(`Email sent successfully to ${to}, Message ID: ${result.messageId}`);
      
      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error('Failed to send email:', error);
      
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  async sendSMS(to, message) {
    if (!this.twilioClient) {
      console.warn('Twilio client not initialized. SMS sending disabled.');
      return {
        success: false,
        error: 'SMS service not available'
      };
    }

    try {
      const result = await this.twilioClient.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      console.log(`SMS sent successfully to ${to}, SID: ${result.sid}`);
      
      return {
        success: true,
        messageId: result.sid,
        status: result.status
      };
    } catch (error) {
      console.error('Failed to send SMS:', error);
      
      return {
        success: false,
        error: error.message,
        code: error.code
      };
    }
  }

  async sendPushNotification(deviceTokens, title, message, data = {}) {
    try {
      if (!this.firebaseApp) {
        console.warn('Firebase Admin not initialized. Simulating push notification.');
        return {
          success: true,
          deviceCount: deviceTokens.length,
          message: 'Push notification simulated successfully',
          simulated: true
        };
      }

      const notification = {
        notification: {
          title,
          body: message,
          sound: 'default',
          badge: '1'
        },
        data: data || {},
        android: {
          priority: 'high',
          notification: {
            sound: 'default',
            clickAction: 'FLUTTER_NOTIFICATION_CLICK'
          }
        },
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        }
      };

      // Send to multiple devices in chunks (FCM limit is 500 tokens per request)
      const chunkSize = 500;
      const results = [];
      
      for (let i = 0; i < deviceTokens.length; i += chunkSize) {
        const chunk = deviceTokens.slice(i, i + chunkSize);
        
        try {
          const response = await admin.messaging().sendMulticast({
            tokens: chunk,
            ...notification
          });
          
          results.push({
            successCount: response.successCount,
            failureCount: response.failureCount,
            failedTokens: response.responses
              .map((resp, idx) => resp.error ? chunk[idx] : null)
              .filter(Boolean)
          });
          
        } catch (chunkError) {
          console.error(`Failed to send push notification to chunk ${i}:`, chunkError);
          results.push({
            successCount: 0,
            failureCount: chunk.length,
            error: chunkError.message
          });
        }
      }

      const totalSuccess = results.reduce((sum, r) => sum + r.successCount, 0);
      const totalFailures = results.reduce((sum, r) => sum + r.failureCount, 0);
      const allFailedTokens = results.flatMap(r => r.failedTokens || []);

      console.log(`Push notification sent to ${deviceTokens.length} devices: ${totalSuccess} success, ${totalFailures} failures`);
      
      return {
        success: totalSuccess > 0,
        deviceCount: deviceTokens.length,
        successCount: totalSuccess,
        failureCount: totalFailures,
        failedTokens: allFailedTokens,
        message: `Push notification sent to ${totalSuccess}/${deviceTokens.length} devices`
      };
    } catch (error) {
      console.error('Failed to send push notification:', error);
      
      return {
        success: false,
        error: error.message,
        deviceCount: deviceTokens.length
      };
    }
  }

  async sendInAppNotification(userId, title, message, type, priority = 'medium', data = {}) {
    // This would be handled by WebSocket real-time delivery
    // The actual delivery is handled in the notification service
    try {
      const notification = {
        userId,
        title,
        message,
        type,
        priority,
        data,
        timestamp: new Date().toISOString()
      };

      console.log(`In-app notification prepared for user ${userId}:`, notification);
      
      return {
        success: true,
        notification: notification
      };
    } catch (error) {
      console.error('Failed to prepare in-app notification:', error);
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  async validateEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  async validatePhoneNumber(phone) {
    // Basic phone validation - can be enhanced based on requirements
    const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
    return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
  }

  async testEmailService() {
    try {
      await this.emailTransporter.verify();
      console.log('Email service is working correctly');
      return true;
    } catch (error) {
      console.error('Email service test failed:', error);
      return false;
    }
  }

  async testSMSService() {
    if (!this.twilioClient) {
      console.warn('SMS service not configured');
      return false;
    }

    try {
      const account = await this.twilioClient.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      console.log('SMS service is working correctly');
      return true;
    } catch (error) {
      console.error('SMS service test failed:', error);
      return false;
    }
  }

  async getDeliveryStatus(messageId, service) {
    // This would integrate with the respective service APIs to get delivery status
    // For now, return a placeholder
    try {
      console.log(`Checking delivery status for ${service} message: ${messageId}`);
      
      // In a real implementation, you would:
      // - For email: Check SendGrid API or SMTP logs
      // - For SMS: Check Twilio API for message status
      // - For push: Check FCM/APNS delivery reports
      
      return {
        messageId,
        service,
        status: 'delivered', // delivered, pending, failed, bounced
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Failed to get delivery status:', error);
      return {
        messageId,
        service,
        status: 'unknown',
        error: error.message
      };
    }
  }
}

module.exports = NotificationDeliveryService;
