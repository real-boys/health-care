class NotificationTemplateEngine {
  constructor() {
    this.templates = {
      // Claim status notifications
      claim_submitted: {
        title: 'Claim Submitted Successfully',
        message: 'Your claim {{claimNumber}} for {{serviceDate}} has been submitted for processing.',
        email: {
          subject: 'Claim Submitted - {{claimNumber}}',
          body: `
            <h2>Claim Submitted Successfully</h2>
            <p>Dear {{patientName}},</p>
            <p>Your claim <strong>{{claimNumber}}</strong> for services rendered on {{serviceDate}} has been successfully submitted to {{insuranceProvider}}.</p>
            <p><strong>Claim Details:</strong></p>
            <ul>
              <li>Claim Number: {{claimNumber}}</li>
              <li>Service Date: {{serviceDate}}</li>
              <li>Provider: {{providerName}}</li>
              <li>Total Amount: ${{totalAmount}}</li>
            </ul>
            <p>You will receive updates as your claim progresses through the review process.</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Your claim {{claimNumber}} has been submitted. We\'ll notify you of any updates.'
      },
      
      claim_approved: {
        title: 'Claim Approved',
        message: 'Your claim {{claimNumber}} has been approved. Payment of ${{approvedAmount}} will be processed.',
        email: {
          subject: 'Good News! Your Claim Was Approved',
          body: `
            <h2>Claim Approved</h2>
            <p>Dear {{patientName}},</p>
            <p>Great news! Your claim <strong>{{claimNumber}}</strong> has been approved by {{insuranceProvider}}.</p>
            <p><strong>Payment Details:</strong></p>
            <ul>
              <li>Approved Amount: ${{approvedAmount}}</li>
              <li>Patient Responsibility: ${{patientResponsibility}}</li>
              <li>Expected Payment Date: {{paymentDate}}</li>
            </ul>
            <p>If you have any questions about this approval, please don't hesitate to contact us.</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Great news! Your claim {{claimNumber}} was approved for ${{approvedAmount}}.'
      },

      claim_denied: {
        title: 'Claim Action Required',
        message: 'Your claim {{claimNumber}} requires attention. Please review the denial reason.',
        email: {
          subject: 'Action Required - Claim Update',
          body: `
            <h2>Claim Action Required</h2>
            <p>Dear {{patientName}},</p>
            <p>We need your attention regarding claim <strong>{{claimNumber}}</strong>.</p>
            <p><strong>Denial Reason:</strong> {{denialReason}}</p>
            <p>Please review this information and contact our support team if you believe this is an error or if you need assistance with next steps.</p>
            <p>Contact Support: {{supportPhone}}</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Action needed: Your claim {{claimNumber}} requires attention. Please check your email for details.'
      },

      // Payment reminders
      payment_due: {
        title: 'Payment Reminder',
        message: 'Your payment of ${{amount}} is due on {{dueDate}}.',
        email: {
          subject: 'Payment Reminder - Due {{dueDate}}',
          body: `
            <h2>Payment Reminder</h2>
            <p>Dear {{patientName}},</p>
            <p>This is a reminder that your payment of <strong>${{amount}}</strong> is due on <strong>{{dueDate}}</strong>.</p>
            <p><strong>Payment Details:</strong></p>
            <ul>
              <li>Amount Due: ${{amount}}</li>
              <li>Due Date: {{dueDate}}</li>
              <li>Policy Number: {{policyNumber}}</li>
              <li>Payment Method: {{paymentMethod}}</li>
            </ul>
            <p>To make a payment, please log in to your account or contact our billing department.</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Reminder: Your payment of ${{amount}} is due on {{dueDate}}. Please ensure timely payment.'
      },

      payment_overdue: {
        title: 'Payment Overdue',
        message: 'Your payment of ${{amount}} is overdue. Please make payment as soon as possible.',
        email: {
          subject: 'URGENT: Payment Overdue',
          body: `
            <h2>Payment Overdue - Action Required</h2>
            <p>Dear {{patientName}},</p>
            <p>Your payment of <strong>${{amount}}</strong> was due on <strong>{{dueDate}}</strong> and is now overdue.</p>
            <p>Please make your payment as soon as possible to avoid any interruption in coverage.</p>
            <p><strong>Payment Options:</strong></p>
            <ul>
              <li>Online: Log in to your account</li>
              <li>Phone: Call {{billingPhone}}</li>
              <li>Mail: Send payment to {{billingAddress}}</li>
            </ul>
            <p>If you have already made this payment, please disregard this notice.</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'URGENT: Your payment of ${{amount}} is overdue. Please make payment immediately to avoid coverage issues.'
      },

      // Appointment notifications
      appointment_reminder: {
        title: 'Appointment Reminder',
        message: 'You have an appointment on {{appointmentDate}} at {{appointmentTime}} with {{providerName}}.',
        email: {
          subject: 'Appointment Reminder - {{appointmentDate}}',
          body: `
            <h2>Appointment Reminder</h2>
            <p>Dear {{patientName}},</p>
            <p>This is a reminder about your upcoming appointment:</p>
            <p><strong>Appointment Details:</strong></p>
            <ul>
              <li>Date: {{appointmentDate}}</li>
              <li>Time: {{appointmentTime}}</li>
              <li>Provider: {{providerName}}</li>
              <li>Type: {{appointmentType}}</li>
              <li>Location: {{location}}</li>
            </ul>
            {{#if virtualMeetingLink}}
            <p><strong>Virtual Meeting Link:</strong> <a href="{{virtualMeetingLink}}">Join Meeting</a></p>
            {{/if}}
            <p>Please arrive 15 minutes early and bring your insurance card and ID.</p>
            <p>If you need to reschedule, please call us at {{clinicPhone}}.</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Reminder: Your appointment is on {{appointmentDate}} at {{appointmentTime}} with {{providerName}}. {{#if virtualMeetingLink}}Meeting link: {{virtualMeetingLink}}{{/if}}'
      },

      appointment_confirmed: {
        title: 'Appointment Confirmed',
        message: 'Your appointment on {{appointmentDate}} has been confirmed.',
        email: {
          subject: 'Appointment Confirmed',
          body: `
            <h2>Appointment Confirmed</h2>
            <p>Dear {{patientName}},</p>
            <p>Your appointment has been confirmed:</p>
            <ul>
              <li>Date: {{appointmentDate}}</li>
              <li>Time: {{appointmentTime}}</li>
              <li>Provider: {{providerName}}</li>
              <li>Type: {{appointmentType}}</li>
            </ul>
            <p>We look forward to seeing you!</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Your appointment on {{appointmentDate}} at {{appointmentTime}} has been confirmed.'
      },

      appointment_cancelled: {
        title: 'Appointment Cancelled',
        message: 'Your appointment on {{appointmentDate}} has been cancelled.',
        email: {
          subject: 'Appointment Cancelled',
          body: `
            <h2>Appointment Cancelled</h2>
            <p>Dear {{patientName}},</p>
            <p>Your appointment scheduled for {{appointmentDate}} at {{appointmentTime}} has been cancelled.</p>
            {{#if cancellationReason}}
            <p><strong>Reason:</strong> {{cancellationReason}}</p>
            {{/if}}
            <p>If you would like to reschedule, please call us at {{clinicPhone}} or log in to your account to book a new appointment.</p>
            <p>We apologize for any inconvenience.</p>
            <p>Best regards,<br>Stellar Health Team</p>
          `
        },
        sms: 'Your appointment on {{appointmentDate}} has been cancelled. Please call to reschedule.'
      }
    };
  }

  render(templateName, data, format = 'message') {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Template ${templateName} not found`);
    }

    let content = template[format] || template.message;
    
    // Simple template variable replacement
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      content = content.replace(regex, value);
    }

    // Handle conditional blocks for email templates
    if (format === 'email' && content.includes('{{#if')) {
      content = this.handleConditionals(content, data);
    }

    return content;
  }

  handleConditionals(content, data) {
    // Simple conditional block handler
    const conditionalRegex = /{{#if\s+(\w+)}}([\s\S]*?){{\/if}}/g;
    
    return content.replace(conditionalRegex, (match, variable, blockContent) => {
      return data[variable] ? blockContent : '';
    });
  }

  addTemplate(name, template) {
    this.templates[name] = template;
  }

  getTemplate(name) {
    return this.templates[name];
  }

  listTemplates() {
    return Object.keys(this.templates);
  }
}

module.exports = NotificationTemplateEngine;
