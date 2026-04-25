const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const geolib = require('geolib');

const router = express.Router();
const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../database/healthcare.db');

function getDatabase() {
  return new sqlite3.Database(DB_PATH);
}

// Helper function to calculate distance between two coordinates
function calculateDistance(lat1, lon1, lat2, lon2) {
  if (!lat1 || !lon1 || !lat2 || !lon2) return null;
  const distance = geolib.getDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 }
  );
  return parseFloat((distance / 1609.34).toFixed(2)); // Convert meters to miles
}

// Helper function to parse JSON fields safely
function parseJSONField(field) {
  if (!field) return [];
  try {
    return JSON.parse(field);
  } catch {
    return [];
  }
}

// GET /api/providers/search - Search providers with comprehensive filters
router.get('/search', async (req, res, next) => {
  const {
    q, // General search query
    specialty,
    city,
    state,
    zip_code,
    insurance,
    language,
    gender,
    accepting_new_patients,
    telehealth_available,
    min_rating,
    min_experience,
    max_distance,
    latitude,
    longitude,
    page = 1,
    limit = 20,
    sort_by = 'relevance'
  } = req.query;

  const db = getDatabase();

  try {
    let queryParams = [];
    let whereConditions = ['hp.verification_status = ?', 'hp.is_verified = ?'];
    queryParams.push('verified', 1);

    // General search query (name, specialty, conditions)
    if (q) {
      whereConditions.push(`(
        hp.first_name LIKE ? OR 
        hp.last_name LIKE ? OR 
        hp.practice_name LIKE ? OR
        hp.bio LIKE ? OR
        EXISTS (
          SELECT 1 FROM provider_specialties_map psm
          JOIN provider_specialties ps ON psm.specialty_id = ps.id
          WHERE psm.provider_id = hp.id AND ps.name LIKE ?
        )
      )`);
      const searchTerm = `%${q}%`;
      queryParams.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Specialty filter
    if (specialty) {
      whereConditions.push(`EXISTS (
        SELECT 1 FROM provider_specialties_map psm
        JOIN provider_specialties ps ON psm.specialty_id = ps.id
        WHERE psm.provider_id = hp.id AND ps.name LIKE ?
      )`);
      queryParams.push(`%${specialty}%`);
    }

    // Location filters
    if (city) {
      whereConditions.push('hp.city LIKE ?');
      queryParams.push(`%${city}%`);
    }
    if (state) {
      whereConditions.push('hp.state = ?');
      queryParams.push(state);
    }
    if (zip_code) {
      whereConditions.push('hp.zip_code LIKE ?');
      queryParams.push(`${zip_code}%`);
    }

    // Insurance filter
    if (insurance) {
      whereConditions.push('hp.insurance_accepted LIKE ?');
      queryParams.push(`%"${insurance}"%`);
    }

    // Language filter
    if (language) {
      whereConditions.push('hp.languages_spoken LIKE ?');
      queryParams.push(`%"${language}"%`);
    }

    // Gender filter
    if (gender) {
      whereConditions.push('hp.gender = ?');
      queryParams.push(gender);
    }

    // Boolean filters
    if (accepting_new_patients !== undefined) {
      whereConditions.push('hp.accepts_new_patients = ?');
      queryParams.push(accepting_new_patients === 'true' ? 1 : 0);
    }
    if (telehealth_available !== undefined) {
      whereConditions.push('hp.telehealth_available = ?');
      queryParams.push(telehealth_available === 'true' ? 1 : 0);
    }

    // Rating filter
    if (min_rating) {
      whereConditions.push('hp.average_rating >= ?');
      queryParams.push(parseFloat(min_rating));
    }

    // Experience filter
    if (min_experience) {
      whereConditions.push('hp.years_of_experience >= ?');
      queryParams.push(parseInt(min_experience));
    }

    const whereClause = whereConditions.join(' AND ');

    // Get total count
    const countQuery = `SELECT COUNT(DISTINCT hp.id) as total FROM healthcare_providers hp WHERE ${whereClause}`;
    const totalCount = await new Promise((resolve, reject) => {
      db.get(countQuery, queryParams, (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.total : 0);
      });
    });

    // Build main query
    let orderBy = 'hp.average_rating DESC, hp.total_reviews DESC';
    switch (sort_by) {
      case 'rating':
        orderBy = 'hp.average_rating DESC, hp.total_reviews DESC';
        break;
      case 'experience':
        orderBy = 'hp.years_of_experience DESC';
        break;
      case 'reviews':
        orderBy = 'hp.total_reviews DESC';
        break;
      case 'name':
        orderBy = 'hp.last_name ASC, hp.first_name ASC';
        break;
      case 'distance':
        if (latitude && longitude) {
          orderBy = 'distance ASC';
        }
        break;
      default:
        orderBy = 'hp.average_rating DESC, hp.total_reviews DESC';
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const mainQuery = `
      SELECT DISTINCT
        hp.id,
        hp.first_name,
        hp.last_name,
        hp.professional_title,
        hp.bio,
        hp.profile_image_url,
        hp.phone,
        hp.email,
        hp.website,
        hp.practice_name,
        hp.practice_type,
        hp.years_of_experience,
        hp.languages_spoken,
        hp.gender,
        hp.address_line1,
        hp.address_line2,
        hp.city,
        hp.state,
        hp.zip_code,
        hp.latitude,
        hp.longitude,
        hp.accepts_new_patients,
        hp.telehealth_available,
        hp.consultation_fee,
        hp.virtual_visit_price,
        hp.average_rating,
        hp.total_reviews,
        hp.insurance_accepted,
        hp.hospital_affiliations,
        hp.education,
        hp.board_certifications
      FROM healthcare_providers hp
      WHERE ${whereClause}
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    queryParams.push(parseInt(limit), offset);
    const providers = await new Promise((resolve, reject) => {
      db.all(mainQuery, queryParams, async (err, rows) => {
        if (err) reject(err);
        else {
          // Get specialties for each provider
          const providersWithDetails = await Promise.all(rows.map(async (provider) => {
            // Get specialties
            const specialtiesQuery = `
              SELECT ps.name, ps.category, psm.is_primary
              FROM provider_specialties_map psm
              JOIN provider_specialties ps ON psm.specialty_id = ps.id
              WHERE psm.provider_id = ?
              ORDER BY psm.is_primary DESC
            `;
            const specialties = await new Promise((resolve, reject) => {
              db.all(specialtiesQuery, [provider.id], (err, rows) => {
                if (err) reject(err);
                else resolve(rows || []);
              });
            });

            // Calculate distance if coordinates provided
            let distance = null;
            if (latitude && longitude && provider.latitude && provider.longitude) {
              distance = calculateDistance(
                parseFloat(latitude),
                parseFloat(longitude),
                provider.latitude,
                provider.longitude
              );

              // Filter by max_distance if specified
              if (max_distance && distance > parseFloat(max_distance)) {
                return null;
              }
            }

            return {
              ...provider,
              name: `Dr. ${provider.first_name} ${provider.last_name}`,
              specialties: specialties.map(s => s.name),
              primary_specialty: specialties.find(s => s.is_primary)?.name || specialties[0]?.name,
              specialty_category: specialties[0]?.category,
              languages_spoken: parseJSONField(provider.languages_spoken),
              insurance_accepted: parseJSONField(provider.insurance_accepted),
              hospital_affiliations: parseJSONField(provider.hospital_affiliations),
              education: parseJSONField(provider.education),
              board_certifications: parseJSONField(provider.board_certifications),
              accepts_new_patients: !!provider.accepts_new_patients,
              telehealth_available: !!provider.telehealth_available,
              distance
            };
          }));

          resolve(providersWithDetails.filter(p => p !== null));
        }
      });
    });

    // Sort by distance if needed
    if (sort_by === 'distance' && latitude && longitude) {
      providers.sort((a, b) => (a.distance || Infinity) - (b.distance || Infinity));
    }

    res.json({
      providers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      },
      filters: {
        applied: { q, specialty, city, state, zip_code, insurance, language, gender, accepting_new_patients, telehealth_available, min_rating, min_experience, max_distance }
      }
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// GET /api/providers/:id - Get provider details
router.get('/:id', async (req, res, next) => {
  const { id } = req.params;
  const { latitude, longitude } = req.query;
  const db = getDatabase();

  try {
    const providerQuery = `
      SELECT * FROM healthcare_providers WHERE id = ? AND verification_status = 'verified'
    `;

    const provider = await new Promise((resolve, reject) => {
      db.get(providerQuery, [id], async (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // Get specialties
    const specialtiesQuery = `
      SELECT ps.*, psm.is_primary, psm.years_experience as specialty_experience
      FROM provider_specialties_map psm
      JOIN provider_specialties ps ON psm.specialty_id = ps.id
      WHERE psm.provider_id = ?
      ORDER BY psm.is_primary DESC
    `;
    const specialties = await new Promise((resolve, reject) => {
      db.all(specialtiesQuery, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get credentials
    const credentialsQuery = `
      SELECT pc.*, pcm.credential_number, pcm.issue_date, pcm.expiry_date, pcm.verification_status
      FROM provider_credentials_map pcm
      JOIN provider_credentials pc ON pcm.credential_id = pc.id
      WHERE pcm.provider_id = ?
    `;
    const credentials = await new Promise((resolve, reject) => {
      db.all(credentialsQuery, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get availability
    const availabilityQuery = `
      SELECT * FROM provider_availability
      WHERE provider_id = ? AND is_available = 1
      ORDER BY day_of_week
    `;
    const availability = await new Promise((resolve, reject) => {
      db.all(availabilityQuery, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get recent reviews
    const reviewsQuery = `
      SELECT pr.*, u.first_name || ' ' || u.last_name as patient_name
      FROM provider_reviews pr
      LEFT JOIN patients pt ON pr.patient_id = pt.id
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE pr.provider_id = ? AND pr.moderation_status = 'approved'
      ORDER BY pr.created_at DESC
      LIMIT 10
    `;
    const reviews = await new Promise((resolve, reject) => {
      db.all(reviewsQuery, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Calculate distance if coordinates provided
    let distance = null;
    if (latitude && longitude && provider.latitude && provider.longitude) {
      distance = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        provider.latitude,
        provider.longitude
      );
    }

    // Format availability into weekly schedule
    const weekDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const weeklySchedule = weekDays.reduce((acc, day, index) => {
      const dayAvailability = availability.find(a => a.day_of_week === index);
      acc[day] = dayAvailability ? [{
        start: dayAvailability.opening_time,
        end: dayAvailability.closing_time,
        break_start: dayAvailability.break_start_time,
        break_end: dayAvailability.break_end_time
      }] : [];
      return acc;
    }, {});

    // Get next available slot
    const nextAvailable = await getNextAvailableSlot(db, id, availability);

    const result = {
      ...provider,
      name: `Dr. ${provider.first_name} ${provider.last_name}`,
      specialties,
      primary_specialty: specialties.find(s => s.is_primary)?.name || specialties[0]?.name,
      credentials,
      availability: weeklySchedule,
      recent_reviews: reviews,
      next_available: nextAvailable,
      languages_spoken: parseJSONField(provider.languages_spoken),
      insurance_accepted: parseJSONField(provider.insurance_accepted),
      hospital_affiliations: parseJSONField(provider.hospital_affiliations),
      education: parseJSONField(provider.education),
      board_certifications: parseJSONField(provider.board_certifications),
      conditions_treated: parseJSONField(provider.conditions_treated),
      procedures_performed: parseJSONField(provider.procedures_performed),
      accepts_new_patients: !!provider.accepts_new_patients,
      telehealth_available: !!provider.telehealth_available,
      distance,
      price: {
        consultation: provider.consultation_fee,
        virtual: provider.virtual_visit_price,
        insurance: parseJSONField(provider.insurance_accepted).length > 0
      }
    };

    res.json(result);
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Helper function to get next available slot
async function getNextAvailableSlot(db, providerId, availability) {
  if (!availability || availability.length === 0) return null;

  const today = new Date();
  const maxDays = 30; // Look up to 30 days ahead

  for (let i = 0; i < maxDays; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(today.getDate() + i);
    const dayOfWeek = checkDate.getDay();

    const dayAvailability = availability.find(a => a.day_of_week === dayOfWeek);
    if (!dayAvailability) continue;

    // Check if this date is marked as unavailable
    const specialQuery = `SELECT * FROM provider_special_availability WHERE provider_id = ? AND date = ? AND is_available = 0`;
    const specialUnavailable = await new Promise((resolve, reject) => {
      db.get(specialQuery, [providerId, checkDate.toISOString().split('T')[0]], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (specialUnavailable) continue;

    return checkDate.toISOString().split('T')[0];
  }

  return null;
}

// GET /api/providers/:id/availability - Get provider availability for date range
router.get('/:id/availability', async (req, res, next) => {
  const { id } = req.params;
  const { start_date, end_date } = req.query;
  const db = getDatabase();

  try {
    // Get regular availability
    const regularQuery = `
      SELECT * FROM provider_availability
      WHERE provider_id = ? AND is_available = 1
      ORDER BY day_of_week
    `;
    const regularAvailability = await new Promise((resolve, reject) => {
      db.all(regularQuery, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get special availability
    let specialAvailability = [];
    if (start_date && end_date) {
      const specialQuery = `
        SELECT * FROM provider_special_availability
        WHERE provider_id = ? AND date BETWEEN ? AND ?
        ORDER BY date
      `;
      specialAvailability = await new Promise((resolve, reject) => {
        db.all(specialQuery, [id, start_date, end_date], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }

    // Get existing appointments
    let appointments = [];
    if (start_date && end_date) {
      const appointmentsQuery = `
        SELECT appointment_date, duration_minutes, status
        FROM appointments
        WHERE provider_id = ? 
          AND DATE(appointment_date) BETWEEN DATE(?) AND DATE(?)
          AND status NOT IN ('cancelled', 'no_show')
        ORDER BY appointment_date
      `;
      appointments = await new Promise((resolve, reject) => {
        db.all(appointmentsQuery, [id, start_date, end_date], (err, rows) => {
          if (err) reject(err);
          else resolve(rows || []);
        });
      });
    }

    res.json({
      regular_availability: regularAvailability,
      special_availability: specialAvailability,
      existing_appointments: appointments
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// GET /api/providers/:id/slots - Get available time slots for a specific date
router.get('/:id/slots', async (req, res, next) => {
  const { id } = req.params;
  const { date } = req.query;

  if (!date) {
    return res.status(400).json({ error: 'Date parameter is required' });
  }

  const db = getDatabase();

  try {
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // Get regular availability for this day
    const availabilityQuery = `
      SELECT * FROM provider_availability
      WHERE provider_id = ? AND day_of_week = ? AND is_available = 1
    `;
    const availability = await new Promise((resolve, reject) => {
      db.get(availabilityQuery, [id, dayOfWeek], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (!availability) {
      return res.json({ available_slots: [], message: 'Provider not available on this day' });
    }

    // Check special availability
    const specialQuery = `
      SELECT * FROM provider_special_availability
      WHERE provider_id = ? AND date = ?
    `;
    const specialAvailability = await new Promise((resolve, reject) => {
      db.get(specialQuery, [id, date], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (specialAvailability && !specialAvailability.is_available) {
      return res.json({ available_slots: [], message: specialAvailability.reason || 'Provider unavailable' });
    }

    // Get existing appointments for this date
    const appointmentsQuery = `
      SELECT appointment_date, duration_minutes
      FROM appointments
      WHERE provider_id = ? AND DATE(appointment_date) = DATE(?)
      AND status NOT IN ('cancelled', 'no_show')
      ORDER BY appointment_date
    `;
    const appointments = await new Promise((resolve, reject) => {
      db.all(appointmentsQuery, [id, date], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Generate available time slots
    const slots = generateTimeSlots(availability, appointments, targetDate);

    res.json({
      date,
      slots,
      appointment_duration: availability.appointment_duration_minutes
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Helper function to generate time slots
function generateTimeSlots(availability, appointments, targetDate) {
  const slots = [];
  const { opening_time, closing_time, appointment_duration_minutes, break_start_time, break_end_time } = availability;

  const openMinutes = timeToMinutes(opening_time);
  const closeMinutes = timeToMinutes(closing_time);
  const slotDuration = appointment_duration_minutes || 30;

  let currentMinutes = openMinutes;

  while (currentMinutes + slotDuration <= closeMinutes) {
    // Skip break time
    if (break_start_time && break_end_time) {
      const breakStart = timeToMinutes(break_start_time);
      const breakEnd = timeToMinutes(break_end_time);
      if (currentMinutes >= breakStart && currentMinutes < breakEnd) {
        currentMinutes = breakEnd;
        continue;
      }
    }

    const slotStart = new Date(targetDate);
    slotStart.setHours(Math.floor(currentMinutes / 60), currentMinutes % 60, 0, 0);

    const slotEnd = new Date(slotStart.getTime() + slotDuration * 60000);

    // Check for conflicts with existing appointments
    const hasConflict = appointments.some(apt => {
      const aptStart = new Date(apt.appointment_date);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
      return slotStart < aptEnd && slotEnd > aptStart;
    });

    if (!hasConflict) {
      slots.push({
        start_time: slotStart.toISOString(),
        end_time: slotEnd.toISOString(),
        display_time: formatTime(slotStart),
        available: true
      });
    }

    currentMinutes += slotDuration;
  }

  return slots;
}

function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}

function formatTime(date) {
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

// GET /api/providers/:id/reviews - Get provider reviews with pagination
router.get('/:id/reviews', async (req, res, next) => {
  const { id } = req.params;
  const { page = 1, limit = 10, sort_by = 'date' } = req.query;
  const db = getDatabase();

  try {
    let orderBy = 'pr.created_at DESC';
    switch (sort_by) {
      case 'rating':
        orderBy = 'pr.overall_rating DESC, pr.created_at DESC';
        break;
      case 'helpful':
        orderBy = 'helpful_count DESC, pr.created_at DESC';
        break;
      default:
        orderBy = 'pr.created_at DESC';
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const reviewsQuery = `
      SELECT pr.*,
             u.first_name || ' ' || u.last_name as patient_name,
             (SELECT COUNT(*) FROM review_helpfulness rh WHERE rh.review_id = pr.id AND rh.is_helpful = 1) as helpful_count
      FROM provider_reviews pr
      LEFT JOIN patients pt ON pr.patient_id = pt.id
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE pr.provider_id = ? AND pr.moderation_status = 'approved'
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?
    `;

    const reviews = await new Promise((resolve, reject) => {
      db.all(reviewsQuery, [id, parseInt(limit), offset], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM provider_reviews
      WHERE provider_id = ? AND moderation_status = 'approved'
    `;
    const total = await new Promise((resolve, reject) => {
      db.get(countQuery, [id], (err, row) => {
        if (err) reject(err);
        else resolve(row ? row.total : 0);
      });
    });

    // Get rating distribution
    const distributionQuery = `
      SELECT overall_rating, COUNT(*) as count
      FROM provider_reviews
      WHERE provider_id = ? AND moderation_status = 'approved'
      GROUP BY overall_rating
      ORDER BY overall_rating DESC
    `;
    const distribution = await new Promise((resolve, reject) => {
      db.all(distributionQuery, [id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      rating_distribution: distribution
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// POST /api/providers/:id/reviews - Submit a review
router.post('/:id/reviews', async (req, res, next) => {
  const { id } = req.params;
  const {
    patient_id,
    overall_rating,
    bedside_manner_rating,
    wait_time_rating,
    staff_friendliness_rating,
    title,
    review_text,
    appointment_id
  } = req.body;

  const db = getDatabase();

  try {
    // Check if patient has already reviewed this provider
    const existingQuery = `SELECT id FROM provider_reviews WHERE provider_id = ? AND patient_id = ?`;
    const existing = await new Promise((resolve, reject) => {
      db.get(existingQuery, [id, patient_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) {
      return res.status(400).json({ error: 'You have already reviewed this provider' });
    }

    // Insert the review
    const insertQuery = `
      INSERT INTO provider_reviews (
        provider_id, patient_id, appointment_id,
        overall_rating, bedside_manner_rating, wait_time_rating, staff_friendliness_rating,
        title, review_text, moderation_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')
    `;

    const result = await new Promise((resolve, reject) => {
      db.run(insertQuery, [
        id, patient_id, appointment_id,
        overall_rating, bedside_manner_rating, wait_time_rating, staff_friendliness_rating,
        title, review_text
      ], function(err) {
        if (err) reject(err);
        else resolve({ id: this.lastID });
      });
    });

    // Update provider rating
    await updateProviderRating(db, id);

    res.status(201).json({
      message: 'Review submitted successfully. It will be visible after moderation.',
      review_id: result.id
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// Helper function to update provider rating
async function updateProviderRating(db, providerId) {
  const avgQuery = `
    SELECT AVG(overall_rating) as avg_rating, COUNT(*) as total
    FROM provider_reviews
    WHERE provider_id = ? AND moderation_status = 'approved'
  `;

  const stats = await new Promise((resolve, reject) => {
    db.get(avgQuery, [providerId], (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });

  if (stats) {
    const updateQuery = `
      UPDATE healthcare_providers
      SET average_rating = ?, total_reviews = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `;
    await new Promise((resolve, reject) => {
      db.run(updateQuery, [stats.avg_rating || 0, stats.total || 0, providerId], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

// POST /api/providers/:id/reviews/:review_id/helpful - Mark review as helpful
router.post('/:id/reviews/:review_id/helpful', async (req, res, next) => {
  const { review_id } = req.params;
  const { user_id } = req.body;
  const db = getDatabase();

  try {
    // Check if already voted
    const existingQuery = `SELECT id FROM review_helpfulness WHERE review_id = ? AND user_id = ?`;
    const existing = await new Promise((resolve, reject) => {
      db.get(existingQuery, [review_id, user_id], (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });

    if (existing) {
      return res.status(400).json({ error: 'You have already voted on this review' });
    }

    const insertQuery = `INSERT INTO review_helpfulness (review_id, user_id, is_helpful) VALUES (?, ?, 1)`;
    await new Promise((resolve, reject) => {
      db.run(insertQuery, [review_id, user_id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Review marked as helpful' });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// POST /api/providers/:id/reviews/:review_id/respond - Provider response to review
router.post('/:id/reviews/:review_id/respond', async (req, res, next) => {
  const { review_id } = req.params;
  const { provider_id, response } = req.body;
  const db = getDatabase();

  try {
    const updateQuery = `
      UPDATE provider_reviews
      SET provider_response = ?, provider_response_date = CURRENT_TIMESTAMP
      WHERE id = ? AND provider_id = ?
    `;

    const result = await new Promise((resolve, reject) => {
      db.run(updateQuery, [response, review_id, provider_id], function(err) {
        if (err) reject(err);
        else resolve({ changes: this.changes });
      });
    });

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    res.json({ message: 'Response added successfully' });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// POST /api/providers/:id/favorite - Add provider to favorites
router.post('/:id/favorite', async (req, res, next) => {
  const { id } = req.params;
  const { patient_id, notes } = req.body;
  const db = getDatabase();

  try {
    const insertQuery = `
      INSERT OR IGNORE INTO provider_favorites (patient_id, provider_id, notes)
      VALUES (?, ?, ?)
    `;

    await new Promise((resolve, reject) => {
      db.run(insertQuery, [patient_id, id, notes], function(err) {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Provider added to favorites' });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// DELETE /api/providers/:id/favorite - Remove provider from favorites
router.delete('/:id/favorite', async (req, res, next) => {
  const { id } = req.params;
  const { patient_id } = req.body;
  const db = getDatabase();

  try {
    const deleteQuery = `DELETE FROM provider_favorites WHERE patient_id = ? AND provider_id = ?`;
    await new Promise((resolve, reject) => {
      db.run(deleteQuery, [patient_id, id], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    res.json({ message: 'Provider removed from favorites' });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// GET /api/providers/favorites/:patient_id - Get patient's favorite providers
router.get('/favorites/:patient_id', async (req, res, next) => {
  const { patient_id } = req.params;
  const db = getDatabase();

  try {
    const query = `
      SELECT hp.*, pf.notes, pf.created_at as favorited_at
      FROM provider_favorites pf
      JOIN healthcare_providers hp ON pf.provider_id = hp.id
      WHERE pf.patient_id = ? AND hp.verification_status = 'verified'
      ORDER BY pf.created_at DESC
    `;

    const favorites = await new Promise((resolve, reject) => {
      db.all(query, [patient_id], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({ favorites });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// POST /api/providers/:id/share - Generate share link for provider
router.post('/:id/share', async (req, res, next) => {
  const { id } = req.params;
  const { shared_by, share_method, recipient_email } = req.body;
  const db = getDatabase();

  try {
    const shareToken = uuidv4();

    const insertQuery = `
      INSERT INTO provider_shares (provider_id, shared_by, share_method, recipient_email, share_token)
      VALUES (?, ?, ?, ?, ?)
    `;

    await new Promise((resolve, reject) => {
      db.run(insertQuery, [id, shared_by, share_method, recipient_email, shareToken], (err) => {
        if (err) reject(err);
        else resolve();
      });
    });

    const shareUrl = `${process.env.FRONTEND_URL || 'http://localhost:3001'}/providers/${id}?ref=${shareToken}`;

    res.json({
      message: 'Share link generated',
      share_url: shareUrl,
      share_token: shareToken
    });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// GET /api/providers/specialties/all - Get all specialties
router.get('/specialties/all', async (req, res, next) => {
  const db = getDatabase();

  try {
    const query = `SELECT * FROM provider_specialties ORDER BY category, name`;
    const specialties = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({ specialties });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// GET /api/providers/locations/all - Get all cities/states with providers
router.get('/locations/all', async (req, res, next) => {
  const { state } = req.query;
  const db = getDatabase();

  try {
    let query = `
      SELECT DISTINCT city, state, COUNT(*) as provider_count
      FROM healthcare_providers
      WHERE verification_status = 'verified' AND city IS NOT NULL
    `;
    const params = [];

    if (state) {
      query += ' AND state = ?';
      params.push(state);
    }

    query += ' GROUP BY city, state ORDER BY state, city';

    const locations = await new Promise((resolve, reject) => {
      db.all(query, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({ locations });
  } catch (error) {
    next(error);
  } finally {
    db.close();
  }
});

// GET /api/providers/insurance/all - Get all insurance providers
router.get('/insurance/all', async (req, res, next) => {
  const db = getDatabase();

  try {
    const query = `
      SELECT DISTINCT value as insurance_name
      FROM healthcare_providers, json_each(insurance_accepted)
      WHERE verification_status = 'verified' AND insurance_accepted IS NOT NULL
      ORDER BY value
    `;

    const insurance = await new Promise((resolve, reject) => {
      db.all(query, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    res.json({ insurance_providers: insurance.map(i => i.insurance_name) });
  } catch (error) {
    // Fallback if json_each is not supported
    const fallbackQuery = `
      SELECT insurance_accepted FROM healthcare_providers
      WHERE verification_status = 'verified' AND insurance_accepted IS NOT NULL
    `;
    const rows = await new Promise((resolve, reject) => {
      db.all(fallbackQuery, [], (err, rows) => {
        if (err) reject(err);
        else resolve(rows || []);
      });
    });

    const allInsurance = new Set();
    rows.forEach(row => {
      const parsed = parseJSONField(row.insurance_accepted);
      parsed.forEach(ins => allInsurance.add(ins));
    });

    res.json({ insurance_providers: Array.from(allInsurance).sort() });
  } finally {
    db.close();
  }
});

module.exports = router;
