/**
 * Example: Integrating Notifications into Existing Routes
 * 
 * This file demonstrates how to integrate the notification system
 * into the existing claims, appointments, and payments routes.
 */

// Example for claims.js route integration
const integrateClaimNotifications = (req, res, next) => {
  // Add notification service to request object if not already present
  if (!req.notificationService) {
    console.warn('Notification service not available');
    return next();
  }
  next();
};

// Example: Claim status update notification
const notifyClaimStatusUpdate = async (req, claimData, newStatus) => {
  if (!req.notificationService) return;

  try {
    const patientId = claimData.patient_id;
    const templateData = {
      claimNumber: claimData.claim_number,
      serviceDate: claimData.service_date,
      providerName: claimData.provider_name,
      totalAmount: claimData.total_amount,
      insuranceProvider: claimData.insurance_provider || 'Your Insurance Provider',
      patientName: `${claimData.first_name || 'Patient'}`,
      approvedAmount: claimData.insurance_amount || 0,
      patientResponsibility: claimData.patient_responsibility || 0,
      paymentDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString(),
      denialReason: claimData.denial_reason,
      supportPhone: '1-800-HEALTHCARE'
    };

    let templateName;
    let priority;

    switch (newStatus) {
      case 'submitted':
        templateName = 'claim_submitted';
        priority = 'medium';
        break;
      case 'approved':
        templateName = 'claim_approved';
        priority = 'high';
        break;
      case 'denied':
        templateName = 'claim_denied';
        priority = 'urgent';
        break;
      case 'partially_approved':
        templateName = 'claim_approved'; // Use approved template with custom data
        priority = 'high';
        break;
      default:
        return; // No notification for other statuses
    }

    await req.notificationService.createNotification(
      patientId,
      'claim',
      templateName,
      templateData,
      priority
    );

    console.log(`✅ Claim status notification sent for claim ${claimData.claim_number}`);
  } catch (error) {
    console.error('❌ Failed to send claim status notification:', error);
  }
};

// Example: Payment reminder notification
const notifyPaymentDue = async (req, paymentData) => {
  if (!req.notificationService) return;

  try {
    const patientId = paymentData.patient_id;
    const templateData = {
      amount: paymentData.payment_amount,
      dueDate: new Date(paymentData.due_date).toLocaleDateString(),
      policyNumber: paymentData.policy_number,
      paymentMethod: paymentData.payment_method || 'credit card',
      billingPhone: '1-800-BILLING',
      billingAddress: '123 Billing St, Payment City, PC 12345'
    };

    const isOverdue = new Date(paymentData.due_date) < new Date();
    const templateName = isOverdue ? 'payment_overdue' : 'payment_due';
    const priority = isOverdue ? 'urgent' : 'high';

    await req.notificationService.createNotification(
      patientId,
      'payment',
      templateName,
      templateData,
      priority
    );

    console.log(`✅ Payment notification sent for patient ${patientId}`);
  } catch (error) {
    console.error('❌ Failed to send payment notification:', error);
  }
};

// Example: Appointment notification
const notifyAppointmentUpdate = async (req, appointmentData, action) => {
  if (!req.notificationService) return;

  try {
    const patientId = appointmentData.patient_id;
    const templateData = {
      appointmentDate: new Date(appointmentData.appointment_date).toLocaleDateString(),
      appointmentTime: new Date(appointmentData.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      providerName: appointmentData.provider_name || 'Your Healthcare Provider',
      appointmentType: appointmentData.appointment_type || 'consultation',
      location: appointmentData.location || 'Main Clinic',
      virtualMeetingLink: appointmentData.meeting_link,
      clinicPhone: '1-800-CLINIC',
      cancellationReason: appointmentData.cancellation_reason
    };

    let templateName;
    let priority;

    switch (action) {
      case 'scheduled':
        templateName = 'appointment_confirmed';
        priority = 'medium';
        break;
      case 'reminder':
        templateName = 'appointment_reminder';
        priority = 'high';
        break;
      case 'cancelled':
        templateName = 'appointment_cancelled';
        priority = 'high';
        break;
      default:
        return;
    }

    await req.notificationService.createNotification(
      patientId,
      'appointment',
      templateName,
      templateData,
      priority
    );

    console.log(`✅ Appointment notification sent for patient ${patientId}`);
  } catch (error) {
    console.error('❌ Failed to send appointment notification:', error);
  }
};

// Example: Modified claims route with notifications
const enhancedClaimsRoute = {
  // PUT /api/claims/:id/status - Update claim status
  updateClaimStatus: async (req, res) => {
    const { id } = req.params;
    const { status } = req.body;
    const db = getDatabase();

    try {
      // Get current claim data
      const claim = await new Promise((resolve, reject) => {
        db.get(
          'SELECT ic.*, u.first_name, u.last_name, u.email FROM insurance_claims ic JOIN users u ON ic.patient_id = u.id WHERE ic.id = ?',
          [id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!claim) {
        return res.status(404).json({ error: 'Claim not found' });
      }

      // Update claim status
      await new Promise((resolve, reject) => {
        db.run(
          'UPDATE insurance_claims SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
          [status, id],
          function(err) {
            if (err) reject(err);
            else resolve({ changes: this.changes });
          }
        );
      });

      // Send notification
      await notifyClaimStatusUpdate(req, claim, status);

      // Clear cache
      deleteCache(`claims:patient:${claim.patient_id}`);

      res.json({
        success: true,
        message: `Claim status updated to ${status}`,
        claimId: id
      });
    } catch (error) {
      console.error('Error updating claim status:', error);
      res.status(500).json({ error: 'Failed to update claim status' });
    }
  }
};

// Example: Modified appointments route with notifications
const enhancedAppointmentsRoute = {
  // POST /api/appointments - Create new appointment
  createAppointment: async (req, res) => {
    const db = getDatabase();
    const {
      patient_id,
      provider_id,
      appointment_date,
      duration_minutes,
      appointment_type,
      notes,
      virtual,
      meeting_link
    } = req.body;

    try {
      // Get patient info for notification
      const patient = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM users WHERE id = ?',
          [patient_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Get provider info
      const provider = await new Promise((resolve, reject) => {
        db.get(
          'SELECT * FROM users WHERE id = ?',
          [provider_id],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      // Create appointment
      const result = await new Promise((resolve, reject) => {
        db.run(
          `INSERT INTO appointments 
           (patient_id, provider_id, appointment_date, duration_minutes, appointment_type, notes, virtual, meeting_link)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [patient_id, provider_id, appointment_date, duration_minutes, appointment_type, notes, virtual || false, meeting_link],
          function(err) {
            if (err) reject(err);
            else resolve({ id: this.lastID });
          }
        );
      });

      // Prepare appointment data for notification
      const appointmentData = {
        patient_id,
        appointment_date,
        appointment_type,
        provider_name: `${provider.first_name} ${provider.last_name}`,
        meeting_link,
        location: virtual ? 'Virtual' : 'Main Clinic'
      };

      // Send confirmation notification
      await notifyAppointmentUpdate(req, appointmentData, 'scheduled');

      // Clear cache
      deleteCache(`appointments:patient:${patient_id}`);

      res.status(201).json({
        success: true,
        message: 'Appointment created successfully',
        appointmentId: result.id
      });
    } catch (error) {
      console.error('Error creating appointment:', error);
      res.status(500).json({ error: 'Failed to create appointment' });
    }
  }
};

// Example: Payment reminder scheduler
const schedulePaymentReminders = (notificationService) => {
  // This would run daily to check for upcoming/overdue payments
  const checkPayments = async () => {
    try {
      const db = getDatabase();
      
      // Get payments due in next 3 days
      const upcomingPayments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT pp.*, u.first_name, u.last_name, u.email 
           FROM premium_payments pp 
           JOIN patients p ON pp.patient_id = p.id 
           JOIN users u ON p.user_id = u.id 
           WHERE pp.payment_status = 'pending' 
           AND DATE(pp.payment_date) BETWEEN DATE('now') AND DATE('now', '+3 days')`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Send reminders for upcoming payments
      for (const payment of upcomingPayments) {
        await notificationService.createNotification(
          payment.patient_id,
          'payment',
          'payment_due',
          {
            amount: payment.payment_amount,
            dueDate: new Date(payment.payment_date).toLocaleDateString(),
            policyNumber: payment.policy_number,
            patientName: `${payment.first_name} ${payment.last_name}`
          },
          'high'
        );
      }

      // Get overdue payments
      const overduePayments = await new Promise((resolve, reject) => {
        db.all(
          `SELECT pp.*, u.first_name, u.last_name, u.email 
           FROM premium_payments pp 
           JOIN patients p ON pp.patient_id = p.id 
           JOIN users u ON p.user_id = u.id 
           WHERE pp.payment_status = 'pending' 
           AND DATE(pp.payment_date) < DATE('now')`,
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows);
          }
        );
      });

      // Send overdue notifications
      for (const payment of overduePayments) {
        await notificationService.createNotification(
          payment.patient_id,
          'payment',
          'payment_overdue',
          {
            amount: payment.payment_amount,
            dueDate: new Date(payment.payment_date).toLocaleDateString(),
            policyNumber: payment.policy_number,
            patientName: `${payment.first_name} ${payment.last_name}`
          },
          'urgent'
        );
      }

      console.log(`✅ Processed ${upcomingPayments.length} upcoming and ${overduePayments.length} overdue payments`);
    } catch (error) {
      console.error('❌ Error in payment reminder scheduler:', error);
    }
  };

  // Run daily at 9 AM
  setInterval(checkPayments, 24 * 60 * 60 * 1000);
  
  // Also run once at startup
  checkPayments();
};

module.exports = {
  integrateClaimNotifications,
  notifyClaimStatusUpdate,
  notifyPaymentDue,
  notifyAppointmentUpdate,
  enhancedClaimsRoute,
  enhancedAppointmentsRoute,
  schedulePaymentReminders
};
