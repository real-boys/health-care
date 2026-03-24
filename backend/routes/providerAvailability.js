const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Pool } = require('pg');
const { google } = require('googleapis');
const cron = require('node-cron');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/healthcare_providers'
});

// Google Calendar configuration
const calendar = google.calendar('v3');

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware to check if user is a provider
const isProvider = async (req, res, next) => {
  try {
    const query = `
      SELECT id FROM healthcare_providers
      WHERE user_id = $1 AND verification_status = 'verified'
    `;
    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0) {
      return res.status(403).json({ error: 'Only verified providers can manage availability' });
    }
    
    req.providerId = result.rows[0].id;
    next();
  } catch (error) {
    console.error('Error checking provider status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/provider-availability - Get provider's availability schedule
router.get('/', isProvider, async (req, res) => {
  try {
    const query = `
      SELECT * FROM provider_availability
      WHERE provider_id = $1
      ORDER BY day_of_week
    `;
    
    const result = await pool.query(query, [req.providerId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PUT /api/provider-availability - Update provider's availability schedule
router.put('/', [
  isProvider,
  body('schedule').isArray({ min: 1 }),
  body('schedule.*.day_of_week').isInt({ min: 0, max: 6 }),
  body('schedule.*.opening_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('schedule.*.closing_time').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('schedule.*.appointment_duration_minutes').isInt({ min: 15, max: 240 }),
  body('schedule.*.break_start_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  body('schedule.*.break_end_time').optional().matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
  validateRequest
], async (req, res) => {
  try {
    const { schedule } = req.body;

    // Validate time logic
    for (const day of schedule) {
      if (day.break_start_time && day.break_end_time) {
        if (day.break_start_time >= day.break_end_time) {
          return res.status(400).json({ error: 'Break end time must be after break start time' });
        }
      }
      if (day.opening_time >= day.closing_time) {
        return res.status(400).json({ error: 'Closing time must be after opening time' });
      }
    }

    await pool.query('BEGIN');

    // Delete existing schedule
    await pool.query('DELETE FROM provider_availability WHERE provider_id = $1', [req.providerId]);

    // Insert new schedule
    const insertQuery = `
      INSERT INTO provider_availability (
        provider_id, day_of_week, opening_time, closing_time,
        appointment_duration_minutes, break_start_time, break_end_time
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `;

    for (const day of schedule) {
      await pool.query(insertQuery, [
        req.providerId, day.day_of_week, day.opening_time, day.closing_time,
        day.appointment_duration_minutes, day.break_start_time || null, day.break_end_time || null
      ]);
    }

    await pool.query('COMMIT');

    // Sync with Google Calendar if connected
    await syncWithGoogleCalendar(req.providerId, schedule);

    res.json({ message: 'Availability schedule updated successfully' });
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('Error updating availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/provider-availability/special - Add special availability (holidays, time off)
router.post('/special', [
  isProvider,
  body('date').isDate(),
  body('is_available').isBoolean(),
  body('reason').optional().isString().isLength({ max: 255 }),
  validateRequest
], async (req, res) => {
  try {
    const { date, is_available, reason } = req.body;

    const query = `
      INSERT INTO provider_special_availability (provider_id, date, is_available, reason)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (provider_id, date) 
      DO UPDATE SET is_available = EXCLUDED.is_available, reason = EXCLUDED.reason
      RETURNING *
    `;

    const result = await pool.query(query, [req.providerId, date, is_available, reason]);

    // Sync with Google Calendar if connected
    await syncSpecialAvailabilityWithGoogle(req.providerId, { date, is_available, reason });

    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error adding special availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/provider-availability/special - Get special availability for date range
router.get('/special', [
  isProvider,
  query('start_date').isDate(),
  query('end_date').isDate(),
  validateRequest
], async (req, res) => {
  try {
    const { start_date, end_date } = req.query;

    const query = `
      SELECT * FROM provider_special_availability
      WHERE provider_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date
    `;

    const result = await pool.query(query, [req.providerId, start_date, end_date]);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting special availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/provider-availability/special/:date - Remove special availability
router.delete('/special/:date', [
  isProvider,
  validateRequest
], async (req, res) => {
  try {
    const { date } = req.params;

    const query = `
      DELETE FROM provider_special_availability
      WHERE provider_id = $1 AND date = $2
    `;

    await pool.query(query, [req.providerId, date]);

    res.json({ message: 'Special availability removed successfully' });
  } catch (error) {
    console.error('Error removing special availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/provider-availability/calendar/slots - Get available time slots for booking
router.get('/calendar/slots', [
  isProvider,
  query('date').isDate(),
  validateRequest
], async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get regular availability for this day
    const availabilityQuery = `
      SELECT * FROM provider_availability
      WHERE provider_id = $1 AND day_of_week = $2 AND is_available = true
    `;

    const availabilityResult = await pool.query(availabilityQuery, [req.providerId, dayOfWeek]);
    
    if (availabilityResult.rows.length === 0) {
      return res.json({ available_slots: [] });
    }

    const availability = availabilityResult.rows[0];

    // Check if there's special availability for this date
    const specialQuery = `
      SELECT * FROM provider_special_availability
      WHERE provider_id = $1 AND date = $2
    `;

    const specialResult = await pool.query(specialQuery, [req.providerId, date]);
    
    if (specialResult.rows.length > 0 && !specialResult.rows[0].is_available) {
      return res.json({ available_slots: [] });
    }

    // Get existing appointments for this date
    const appointmentsQuery = `
      SELECT appointment_date, duration_minutes
      FROM appointments
      WHERE provider_id = $1 AND DATE(appointment_date) = $2
      AND status NOT IN ('cancelled', 'no_show')
      ORDER BY appointment_date
    `;

    const appointmentsResult = await pool.query(appointmentsQuery, [req.providerId, date]);

    // Generate available time slots
    const availableSlots = generateTimeSlots(
      availability,
      appointmentsResult.rows,
      targetDate
    );

    res.json({ available_slots: availableSlots });
  } catch (error) {
    console.error('Error getting available slots:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/provider-availability/calendar/connect - Connect to Google Calendar
router.post('/calendar/connect', [
  isProvider,
  body('auth_code').isString(),
  validateRequest
], async (req, res) => {
  try {
    const { auth_code } = req.body;

    // Exchange auth code for tokens
    const { tokens } = await calendar.oauth2.getToken(auth_code);

    // Store tokens securely (you might want to encrypt these)
    const query = `
      INSERT INTO provider_calendar_integration (provider_id, provider, tokens, is_active)
      VALUES ($1, $2, $3, true)
      ON CONFLICT (provider_id, provider)
      DO UPDATE SET tokens = EXCLUDED.tokens, is_active = true
    `;

    await pool.query(query, [req.providerId, 'google', JSON.stringify(tokens)]);

    res.json({ message: 'Google Calendar connected successfully' });
  } catch (error) {
    console.error('Error connecting to Google Calendar:', error);
    res.status(500).json({ error: 'Failed to connect to Google Calendar' });
  }
});

// DELETE /api/provider-availability/calendar/disconnect - Disconnect from Google Calendar
router.delete('/calendar/disconnect', isProvider, async (req, res) => {
  try {
    const query = `
      UPDATE provider_calendar_integration
      SET is_active = false
      WHERE provider_id = $1 AND provider = 'google'
    `;

    await pool.query(query, [req.providerId]);

    res.json({ message: 'Google Calendar disconnected successfully' });
  } catch (error) {
    console.error('Error disconnecting from Google Calendar:', error);
    res.status(500).json({ error: 'Failed to disconnect from Google Calendar' });
  }
});

// Helper function to generate time slots
function generateTimeSlots(availability, appointments, targetDate) {
  const slots = [];
  const { opening_time, closing_time, appointment_duration_minutes, break_start_time, break_end_time } = availability;

  // Convert times to minutes since midnight
  const openingMinutes = timeToMinutes(opening_time);
  const closingMinutes = timeToMinutes(closing_time);
  const slotDuration = appointment_duration_minutes;

  let currentMinutes = openingMinutes;

  while (currentMinutes + slotDuration <= closingMinutes) {
    // Check if this slot is during break time
    if (break_start_time && break_end_time) {
      const breakStartMinutes = timeToMinutes(break_start_time);
      const breakEndMinutes = timeToMinutes(break_end_time);

      if (currentMinutes >= breakStartMinutes && currentMinutes < breakEndMinutes) {
        currentMinutes = breakEndMinutes;
        continue;
      }
    }

    // Create slot datetime
    const slotDateTime = new Date(targetDate);
    slotDateTime.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);

    // Check if this slot conflicts with existing appointments
    const hasConflict = appointments.some(appointment => {
      const appointmentStart = new Date(appointment.appointment_date);
      const appointmentEnd = new Date(appointmentStart.getTime() + appointment.duration_minutes * 60000);

      return (slotDateTime < appointmentEnd && slotDateTime.getTime() + slotDuration * 60000 > appointmentStart);
    });

    if (!hasConflict) {
      slots.push({
        start_time: slotDateTime.toISOString(),
        end_time: new Date(slotDateTime.getTime() + slotDuration * 60000).toISOString(),
        available: true
      });
    }

    currentMinutes += slotDuration;
  }

  return slots;
}

// Helper function to convert time string to minutes
function timeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

// Helper function to sync with Google Calendar
async function syncWithGoogleCalendar(providerId, schedule) {
  try {
    // Get Google Calendar tokens
    const tokensQuery = `
      SELECT tokens FROM provider_calendar_integration
      WHERE provider_id = $1 AND provider = 'google' AND is_active = true
    `;

    const tokensResult = await pool.query(tokensQuery, [providerId]);
    
    if (tokensResult.rows.length === 0) {
      return; // No Google Calendar integration
    }

    const tokens = JSON.parse(tokensResult.rows[0].tokens);
    const auth = new google.auth.OAuth2();
    auth.setCredentials(tokens);

    // Create or update calendar events for recurring availability
    // This is a simplified implementation - you'd want to handle recurring events properly
    for (const day of schedule) {
      // Create recurring calendar event
      const event = {
        summary: 'Available for Appointments',
        description: 'Regular availability for patient appointments',
        start: {
          timeZone: 'America/New_York',
          // You'd need to calculate the next occurrence of this day
        },
        end: {
          timeZone: 'America/New_York',
          // You'd need to calculate the next occurrence of this day
        },
        recurrence: [
          `RRULE:FREQ=WEEKLY;BYDAY=${getDayOfWeekAbbreviation(day.day_of_week)}`
        ]
      };

      // await calendar.events.insert({
      //   calendarId: 'primary',
      //   auth: auth,
      //   requestBody: event
      // });
    }
  } catch (error) {
    console.error('Error syncing with Google Calendar:', error);
  }
}

// Helper function to sync special availability with Google Calendar
async function syncSpecialAvailabilityWithGoogle(providerId, specialAvailability) {
  try {
    const tokensQuery = `
      SELECT tokens FROM provider_calendar_integration
      WHERE provider_id = $1 AND provider = 'google' AND is_active = true
    `;

    const tokensResult = await pool.query(tokensQuery, [providerId]);
    
    if (tokensResult.rows.length === 0) {
      return;
    }

    const tokens = JSON.parse(tokensResult.rows[0].tokens);
    const auth = new google.auth.OAuth2();
    auth.setCredentials(tokens);

    const { date, is_available, reason } = specialAvailability;

    if (!is_available) {
      // Create all-day event for unavailable day
      const event = {
        summary: reason || 'Unavailable',
        start: {
          date: date,
          timeZone: 'America/New_York'
        },
        end: {
          date: date,
          timeZone: 'America/New_York'
        },
        transparency: 'transparent' // Makes the event appear as busy
      };

      // await calendar.events.insert({
      //   calendarId: 'primary',
      //   auth: auth,
      //   requestBody: event
      // });
    }
  } catch (error) {
    console.error('Error syncing special availability with Google Calendar:', error);
  }
}

// Helper function to get day of week abbreviation for RRULE
function getDayOfWeekAbbreviation(dayOfWeek) {
  const days = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA'];
  return days[dayOfWeek];
}

// Cron job to sync availability with external calendars daily
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily calendar sync...');
  try {
    // Get all providers with active calendar integrations
    const query = `
      SELECT provider_id, provider, tokens
      FROM provider_calendar_integration
      WHERE is_active = true
    `;

    const result = await pool.query(query);
    
    for (const integration of result.rows) {
      // Sync each provider's calendar
      // This would involve checking for changes and updating accordingly
    }
    
    console.log('Daily calendar sync completed');
  } catch (error) {
    console.error('Error in daily calendar sync:', error);
  }
});

module.exports = router;
