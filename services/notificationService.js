const nodemailer = require('nodemailer');
const AuditLog = require('../models/AuditLog');

// Email transporter configuration
const createEmailTransporter = () => {
  return nodemailer.createTransporter({
    host: process.env.EMAIL_HOST || 'smtp.gmail.com',
    port: process.env.EMAIL_PORT || 587,
    secure: false,
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS
    }
  });
};

// Send email notification
const sendEmail = async (emailData) => {
  try {
    const transporter = createEmailTransporter();
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text || generateEmailText(emailData),
      html: emailData.html || generateEmailHTML(emailData)
    };

    const result = await transporter.sendMail(mailOptions);
    
    return {
      success: true,
      messageId: result.messageId,
      response: result.response
    };
  } catch (error) {
    console.error('Email sending error:', error);
    throw error;
  }
};

// Send SMS notification (placeholder - would integrate with SMS service)
const sendSMS = async (smsData) => {
  try {
    // This would integrate with services like Twilio, AWS SNS, etc.
    console.log('SMS would be sent:', smsData);
    
    return {
      success: true,
      messageId: 'SMS-' + Date.now()
    };
  } catch (error) {
    console.error('SMS sending error:', error);
    throw error;
  }
};

// Generate email text content
const generateEmailText = (emailData) => {
  const { template, data } = emailData;
  
  switch (template) {
    case 'claim-update':
      return `
Dear ${data.claimantName},

Your claim ${data.claimNumber} has been ${data.status}.

Claim Details:
- Claim Number: ${data.claimNumber}
- Status: ${data.status}
- Approved Amount: $${data.approvedAmount || 'Pending'}
- Policy Number: ${data.policyNumber}

If you have any questions, please contact our support team.

Best regards,
Insurance Provider Portal
      `.trim();
      
    case 'payment-confirmation':
      return `
Dear ${data.payerName},

Your payment of $${data.amount} has been processed.

Payment Details:
- Payment ID: ${data.paymentId}
- Amount: $${data.amount}
- Date: ${new Date(data.paymentDate).toLocaleDateString()}
- Method: ${data.method}

Thank you for your payment.

Best regards,
Insurance Provider Portal
      `.trim();
      
    case 'policy-reminder':
      return `
Dear ${data.policyHolderName},

This is a reminder that your premium payment is due.

Policy Details:
- Policy Number: ${data.policyNumber}
- Due Date: ${new Date(data.dueDate).toLocaleDateString()}
- Amount: $${data.amount}
- Grace Period: ${data.gracePeriodDays} days

Please make your payment to avoid policy interruption.

Best regards,
Insurance Provider Portal
      `.trim();
      
    default:
      return 'This is an automated notification from the Insurance Provider Portal.';
  }
};

// Generate email HTML content
const generateEmailHTML = (emailData) => {
  const { template, data } = emailData;
  
  const baseHTML = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Insurance Provider Portal</title>
    <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #007bff; color: white; padding: 20px; text-align: center; }
        .content { padding: 20px; background: #f9f9f9; }
        .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
        .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; }
        .details { background: white; padding: 15px; border-radius: 5px; margin: 10px 0; }
        .label { font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Insurance Provider Portal</h1>
        </div>
        <div class="content">
            ${generateEmailBody(template, data)}
        </div>
        <div class="footer">
            <p>&copy; 2024 Insurance Provider Portal. All rights reserved.</p>
            <p>This is an automated message. Please do not reply to this email.</p>
        </div>
    </div>
</body>
</html>
  `.trim();
  
  return baseHTML;
};

// Generate email body based on template
const generateEmailBody = (template, data) => {
  switch (template) {
    case 'claim-update':
      return `
        <h2>Claim Update</h2>
        <p>Dear ${data.claimantName},</p>
        <p>Your claim <strong>${data.claimNumber}</strong> has been <strong>${data.status}</strong>.</p>
        
        <div class="details">
            <p><span class="label">Claim Number:</span> ${data.claimNumber}</p>
            <p><span class="label">Status:</span> ${data.status}</p>
            <p><span class="label">Approved Amount:</span> $${data.approvedAmount || 'Pending'}</p>
            <p><span class="label">Policy Number:</span> ${data.policyNumber}</p>
        </div>
        
        <p>If you have any questions, please contact our support team.</p>
        <p><a href="#" class="button">View Claim Details</a></p>
      `.trim();
      
    case 'payment-confirmation':
      return `
        <h2>Payment Confirmation</h2>
        <p>Dear ${data.payerName},</p>
        <p>Your payment of <strong>$${data.amount}</strong> has been processed.</p>
        
        <div class="details">
            <p><span class="label">Payment ID:</span> ${data.paymentId}</p>
            <p><span class="label">Amount:</span> $${data.amount}</p>
            <p><span class="label">Date:</span> ${new Date(data.paymentDate).toLocaleDateString()}</p>
            <p><span class="label">Method:</span> ${data.method}</p>
        </div>
        
        <p>Thank you for your payment.</p>
        <p><a href="#" class="button">View Payment History</a></p>
      `.trim();
      
    case 'policy-reminder':
      return `
        <h2>Premium Payment Reminder</h2>
        <p>Dear ${data.policyHolderName},</p>
        <p>This is a reminder that your premium payment is due.</p>
        
        <div class="details">
            <p><span class="label">Policy Number:</span> ${data.policyNumber}</p>
            <p><span class="label">Due Date:</span> ${new Date(data.dueDate).toLocaleDateString()}</p>
            <p><span class="label">Amount:</span> $${data.amount}</p>
            <p><span class="label">Grace Period:</span> ${data.gracePeriodDays} days</p>
        </div>
        
        <p>Please make your payment to avoid policy interruption.</p>
        <p><a href="#" class="button">Make Payment</a></p>
      `.trim();
      
    default:
      return '<p>This is an automated notification from the Insurance Provider Portal.</p>';
  }
};

// Send bulk notifications
const sendBulkNotifications = async (notifications) => {
  const results = [];
  
  for (const notification of notifications) {
    try {
      let result;
      
      if (notification.type === 'email') {
        result = await sendEmail(notification.data);
      } else if (notification.type === 'sms') {
        result = await sendSMS(notification.data);
      }
      
      results.push({
        id: notification.id,
        success: true,
        result
      });
    } catch (error) {
      results.push({
        id: notification.id,
        success: false,
        error: error.message
      });
    }
  }
  
  return results;
};

// Schedule notifications
const scheduleNotification = async (notificationData, scheduledDate) => {
  // This would integrate with a job scheduler like node-cron or Bull
  console.log(`Notification scheduled for ${scheduledDate}:`, notificationData);
  
  return {
    success: true,
    scheduledDate,
    notificationId: 'SCHED-' + Date.now()
  };
};

// Get notification templates
const getNotificationTemplates = () => {
  return [
    {
      id: 'claim-update',
      name: 'Claim Update',
      description: 'Notifies claimants about claim status changes',
      variables: ['claimantName', 'claimNumber', 'status', 'approvedAmount', 'policyNumber']
    },
    {
      id: 'payment-confirmation',
      name: 'Payment Confirmation',
      description: 'Confirms successful payment processing',
      variables: ['payerName', 'paymentId', 'amount', 'paymentDate', 'method']
    },
    {
      id: 'policy-reminder',
      name: 'Premium Payment Reminder',
      description: 'Reminds policyholders about upcoming premium payments',
      variables: ['policyHolderName', 'policyNumber', 'dueDate', 'amount', 'gracePeriodDays']
    },
    {
      id: 'account-activity',
      name: 'Account Activity Alert',
      description: 'Notifies users about important account activities',
      variables: ['userName', 'activity', 'timestamp', 'ipAddress']
    }
  ];
};

module.exports = {
  sendEmail,
  sendSMS,
  sendBulkNotifications,
  scheduleNotification,
  getNotificationTemplates
};
