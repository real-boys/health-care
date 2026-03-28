const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { setCache, deleteCache } = require('../middleware/cache');
const { appointmentValidationRules } = require('../middleware/validation');

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

// Helper function to get provider info from healthcare_providers or users table
async function getProviderInfo(db, providerId) {
  // Try healthcare_providers first
  const hpQuery = `
    SELECT id, first_name, last_name, professional_title, phone, email,
           address_line1, city, state, zip_code, profile_image_url,
           telehealth_available, consultation_fee
    FROM healthcare_providers 
    WHERE id = ? AND verification_status = 'verified'
  `;
  
  const hpProvider = await new Promise((resolve, reject) => {
    db.get(hpQuery, [providerId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (hpProvider) {
    return {
      ...hpProvider,
      name: `Dr. ${hpProvider.first_name} ${hpProvider.last_name}`,
      provider_type: 'healthcare_provider'
    };
  }
  
  // Fallback to users table
  const userQuery = `
    SELECT id, first_name, last_name, specialty, phone, email
    FROM users WHERE id = ?
  `;
  
  const userProvider = await new Promise((resolve, reject) => {
    db.get(userQuery, [providerId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
  
  if (userProvider) {
    return {
      ...userProvider,
      name: `Dr. ${userProvider.first_name} ${userProvider.last_name}`,
      provider_type: 'user'
    };
  }
  
  return null;
}

// GET /api/appointments/patient/:patientId - Get patient's appointments
router.get('/patient/:patientId', async (req, res, next) => {
  const { patientId } = req.params;
  const { limit = 50, offset = 0, status, upcoming, provider_id } = req.query;
  
  const db = getDatabase();
  
  try {
    let query = `
      SELECT a.* 
      FROM appointments a
      WHERE a.patient_id = ?
    `;
    
    const params = [patientId];

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    
    if (provider_id) {
      query += ' AND a.provider_id = ?';
      params.push(provider_id);
    }

    if (upcoming === 'true') {
      query += ' AND a.appointment_date > datetime("now") AND a.status IN ("scheduled", "confirmed")';
      query += ' ORDER BY a.appointment_date ASC';
    } else {
      query += ' ORDER BY a.appointment_date DESC';
    }

    query += ' LIMIT ? OFFSET ?';
    params.push(parseInt(limit), parseInt(offset));

    const appointments = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows || []);
        }
      });
    });
    
    // Enrich appointments with provider info
    const enrichedAppointments = await Promise.all(appointments.map(async (apt) => {
      const providerInfo = await getProviderInfo(db, apt.provider_id);
      return {
        ...apt,
        provider_name: providerInfo?.name || 'Unknown Provider',
        provider_specialty: providerInfo?.specialty || providerInfo?.professional_title,
        provider_phone: providerInfo?.phone,
        provider_email: providerInfo?.email,
        provider_address: providerInfo?.address_line1 ? 
          `${providerInfo.address_line1}, ${providerInfo.city}, ${providerInfo.state} ${providerInfo.zip_code}` : null,
        provider_image: providerInfo?.profile_image_url,
        telehealth_available: providerInfo?.telehealth_available,
        consultation_fee: providerInfo?.consultation_fee
      };
    }));

    const countQuery = status 
      ? 'SELECT COUNT(*) as total FROM appointments WHERE patient_id = ? AND status = ?'
      : upcoming === 'true'
      ? 'SELECT COUNT(*) as total FROM appointments WHERE patient_id = ? AND appointment_date > datetime("now") AND status IN ("scheduled", "confirmed")'
      : 'SELECT COUNT(*) as total FROM appointments WHERE patient_id = ?';

    const countParams = status ? [patientId, status] : [patientId];

    const totalCount = await new Promise((resolve, reject) => {
      db.get(countQuery, countParams, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row.total);
        }
      });
    });

    const result = {
      appointments: enrichedAppointments,
      pagination: {
        total: totalCount,
        limit: parseInt(limit),
        offset: parseInt(offset),
        hasMore: parseInt(offset) + parseInt(limit) < totalCount
      }
    };

    setCache(req.originalUrl, result);
    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.get('/upcoming/:patientId', async (req, res, next) => {
  const { patientId } = req.params;
  const db = getDatabase();
  
  try {
    const upcomingAppointments = await new Promise((resolve, reject) => {
      const query = `
        SELECT a.*, 
          u.first_name || ' ' || u.last_name as provider_name,
          u.specialty
        FROM appointments a
        JOIN users u ON a.provider_id = u.id
        WHERE a.patient_id = ? 
          AND a.appointment_date > datetime("now") 
          AND a.status IN ("scheduled", "confirmed")
        ORDER BY a.appointment_date ASC
        LIMIT 10
      `;
      
      db.all(query, [patientId], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });

    setCache(req.originalUrl, upcomingAppointments);
    res.json(upcomingAppointments);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.get('/:appointmentId', async (req, res, next) => {
  const { appointmentId } = req.params;
  const db = getDatabase();
  
  try {
    const appointment = await new Promise((resolve, reject) => {
      const query = `
        SELECT a.*, 
          u.first_name || ' ' || u.last_name as provider_name,
          u.specialty,
          p.first_name || ' ' || p.last_name as patient_name,
          pt.medical_record_number
        FROM appointments a
        JOIN users u ON a.provider_id = u.id
        JOIN patients pt ON a.patient_id = pt.id
        JOIN users p ON pt.user_id = p.id
        WHERE a.id = ?
      `;
      
      db.get(query, [appointmentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    setCache(req.originalUrl, appointment);
    res.json(appointment);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.post('/', appointmentValidationRules.createAppointment, async (req, res, next) => {
  const {
    patientId,
    providerId,
    appointmentDate,
    durationMinutes,
    appointmentType,
    notes,
    reason_for_visit,
    virtual,
    meetingLink
  } = req.body;
  
  const db = getDatabase();
  
  try {
    // Check for appointment conflicts
    const conflictQuery = `
      SELECT id FROM appointments
      WHERE provider_id = ? 
        AND appointment_date = ?
        AND status NOT IN ('cancelled', 'no_show')
    `;
    
    const conflict = await new Promise((resolve, reject) => {
      db.get(conflictQuery, [providerId, appointmentDate], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (conflict) {
      return res.status(409).json({ 
        error: 'This time slot is no longer available',
        code: 'SLOT_TAKEN'
      });
    }
    
    // Get provider info for confirmation
    const providerInfo = await getProviderInfo(db, providerId);
    
    const stmt = db.prepare(`
      INSERT INTO appointments (
        patient_id, provider_id, appointment_date, duration_minutes,
        appointment_type, notes, reason_for_visit, virtual, meeting_link, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `);
    
    stmt.run([
      patientId, providerId, appointmentDate, durationMinutes || 30,
      appointmentType || 'consultation', notes, reason_for_visit, virtual ? 1 : 0, meetingLink
    ], function(err) {
      if (err) {
        return next(err);
      }
      
      const appointmentId = this.lastID;
      
      deleteCache('/api/appointments');
      deleteCache(`/api/appointments/patient/${patientId}`);
      deleteCache(`/api/appointments/upcoming/${patientId}`);
      
      if (req.io) {
        req.io.to(`patient-${patientId}`).emit('new-appointment', {
          appointmentId,
          message: 'New appointment has been scheduled'
        });
      }
      
      res.status(201).json({
        message: 'Appointment created successfully',
        appointmentId,
        provider: providerInfo ? {
          name: providerInfo.name,
          phone: providerInfo.phone,
          email: providerInfo.email
        } : null,
        appointment: {
          date: appointmentDate,
          duration: durationMinutes || 30,
          type: appointmentType || 'consultation',
          virtual: !!virtual,
          meeting_link: meetingLink
        }
      });
    });
    
    stmt.finalize();
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// POST /api/appointments/book - Enhanced booking with availability check
router.post('/book', async (req, res, next) => {
  const {
    patient_id,
    provider_id,
    date,
    time,
    duration_minutes = 30,
    appointment_type = 'consultation',
    notes,
    reason_for_visit,
    virtual = false
  } = req.body;
  
  const db = getDatabase();
  
  try {
    // Combine date and time
    const appointmentDate = `${date}T${time}:00`;
    
    // Check if provider is available on this day
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();
    
    const availabilityQuery = `
      SELECT * FROM provider_availability
      WHERE provider_id = ? AND day_of_week = ? AND is_available = 1
    `;
    
    const availability = await new Promise((resolve, reject) => {
      db.get(availabilityQuery, [provider_id, dayOfWeek], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (!availability) {
      return res.status(400).json({ 
        error: 'Provider is not available on this day',
        code: 'NOT_AVAILABLE'
      });
    }
    
    // Check special availability (holidays, etc.)
    const specialQuery = `
      SELECT * FROM provider_special_availability
      WHERE provider_id = ? AND date = ? AND is_available = 0
    `;
    
    const specialUnavailable = await new Promise((resolve, reject) => {
      db.get(specialQuery, [provider_id, date], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (specialUnavailable) {
      return res.status(400).json({
        error: specialUnavailable.reason || 'Provider is unavailable on this date',
        code: 'SPECIAL_UNAVAILABLE'
      });
    }
    
    // Check for appointment conflicts
    const conflictQuery = `
      SELECT id FROM appointments
      WHERE provider_id = ? 
        AND DATE(appointment_date) = DATE(?)
        AND (
          (appointment_date <= ? AND datetime(appointment_date, '+' || duration_minutes || ' minutes') > ?)
          OR (appointment_date < datetime(?, '+' || ? || ' minutes') AND appointment_date >= ?)
        )
        AND status NOT IN ('cancelled', 'no_show')
    `;
    
    const conflict = await new Promise((resolve, reject) => {
      db.get(conflictQuery, [provider_id, date, appointmentDate, appointmentDate, appointmentDate, duration_minutes, appointmentDate], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
    
    if (conflict) {
      return res.status(409).json({ 
        error: 'This time slot is no longer available',
        code: 'SLOT_TAKEN'
      });
    }
    
    // Get provider info
    const providerInfo = await getProviderInfo(db, provider_id);
    
    // Generate meeting link for virtual appointments
    let meetingLink = null;
    if (virtual) {
      meetingLink = `https://meet.healthcare.com/${provider_id}-${Date.now()}`;
    }
    
    // Create the appointment
    const insertQuery = `
      INSERT INTO appointments (
        patient_id, provider_id, appointment_date, duration_minutes,
        appointment_type, notes, reason_for_visit, virtual, meeting_link, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed')
    `;
    
    const result = await new Promise((resolve, reject) => {
      db.run(insertQuery, [
        patient_id, provider_id, appointmentDate, duration_minutes,
        appointment_type, notes, reason_for_visit, virtual ? 1 : 0, meetingLink
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });
    
    deleteCache('/api/appointments');
    deleteCache(`/api/appointments/patient/${patient_id}`);
    deleteCache(`/api/appointments/upcoming/${patient_id}`);
    
    if (req.io) {
      req.io.to(`patient-${patient_id}`).emit('new-appointment', {
        appointmentId: result.id,
        message: 'New appointment has been scheduled'
      });
    }
    
    res.status(201).json({
      success: true,
      message: 'Appointment booked successfully',
      appointment_id: result.id,
      appointment: {
        date: appointmentDate,
        duration: duration_minutes,
        type: appointment_type,
        virtual,
        meeting_link: meetingLink
      },
      provider: providerInfo ? {
        name: providerInfo.name,
        phone: providerInfo.phone,
        email: providerInfo.email,
        address: providerInfo.address_line1 ? 
          `${providerInfo.address_line1}, ${providerInfo.city}, ${providerInfo.state} ${providerInfo.zip_code}` : null
      } : null
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.put('/:appointmentId', appointmentValidationRules.updateAppointment, async (req, res, next) => {
  const { appointmentId } = req.params;
  const updateFields = req.body;
  
  const db = getDatabase();
  
  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get('SELECT patient_id FROM appointments WHERE id = ?', [appointmentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const setClause = Object.keys(updateFields)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = Object.values(updateFields);
    values.push(appointmentId);
    
    const stmt = db.prepare(`
      UPDATE appointments 
      SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `);
    
    stmt.run(values, function(err) {
      if (err) {
        return next(err);
      }
      
      deleteCache('/api/appointments');
      deleteCache(`/api/appointments/patient/${appointment.patient_id}`);
      deleteCache(`/api/appointments/upcoming/${appointment.patient_id}`);
      
      if (req.io) {
        req.io.to(`patient-${appointment.patient_id}`).emit('appointment-updated', {
          appointmentId,
          message: 'Your appointment has been updated'
        });
      }
      
      res.json({ message: 'Appointment updated successfully' });
    });
    
    stmt.finalize();
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

router.delete('/:appointmentId', async (req, res, next) => {
  const { appointmentId } = req.params;
  const db = getDatabase();
  
  try {
    const appointment = await new Promise((resolve, reject) => {
      db.get('SELECT patient_id FROM appointments WHERE id = ?', [appointmentId], (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve(row);
        }
      });
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    db.run('DELETE FROM appointments WHERE id = ?', [appointmentId], function(err) {
      if (err) {
        return next(err);
      }
      
      deleteCache('/api/appointments');
      deleteCache(`/api/appointments/patient/${appointment.patient_id}`);
      deleteCache(`/api/appointments/upcoming/${appointment.patient_id}`);
      
      res.json({ message: 'Appointment deleted successfully' });
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

module.exports = router;
