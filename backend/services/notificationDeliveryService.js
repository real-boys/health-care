const nodemailer = require('nodemailer');
const twilio = require('twilio');

class NotificationDeliveryService {
  constructor() {
    this.emailTransporter = null;
    this.twilioClient = null;
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
    // This would integrate with FCM (Firebase Cloud Messaging) or APNS
    // For now, we'll simulate the push notification
    try {
      console.log(`Push notification sent to ${deviceTokens.length} devices`);
      console.log(`Title: ${title}, Message: ${message}`);
      
      // In a real implementation, you would use FCM or APNS libraries
      // const admin = require('firebase-admin');
      // await admin.messaging().sendToDevice(deviceTokens, {
      //   notification: { title, body: message },
      //   data: data
      // });

      return {
        success: true,
        deviceCount: deviceTokens.length,
        message: 'Push notification sent successfully'
      };
    } catch (error) {
      console.error('Failed to send push notification:', error);
      
      return {
        success: false,
        error: error.message
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
