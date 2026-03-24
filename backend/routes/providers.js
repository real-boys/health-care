const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Pool } = require('pg');
const geolib = require('geolib');
const router = express.Router();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://localhost:5432/healthcare_providers'
});

// Middleware to validate request
const validateRequest = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/providers/search - Search providers with geospatial capabilities
router.get('/search', [
  query('latitude').optional().isFloat({ min: -90, max: 90 }),
  query('longitude').optional().isFloat({ min: -180, max: 180 }),
  query('radius').optional().isInt({ min: 1, max: 500 }),
  query('specialty').optional().isString(),
  query('city').optional().isString(),
  query('state').optional().isString(),
  query('zip_code').optional().isString(),
  query('accepting_new_patients').optional().isBoolean(),
  query('telehealth_available').optional().isBoolean(),
  query('min_rating').optional().isFloat({ min: 0, max: 5 }),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('sort_by').optional().isIn(['distance', 'rating', 'name', 'experience']),
  validateRequest
], async (req, res) => {
  try {
    const {
      latitude, longitude, radius = 25, specialty, city, state, zip_code,
      accepting_new_patients, telehealth_available, min_rating,
      page = 1, limit = 20, sort_by = 'distance'
    } = req.query;

    let query = `
      SELECT DISTINCT 
        hp.id, hp.first_name, hp.last_name, hp.professional_title,
        hp.bio, hp.profile_image_url, hp.phone, hp.email, hp.website,
        hp.practice_name, hp.practice_type, hp.years_of_experience,
        hp.languages_spoken, hp.is_verified, hp.accepts_new_patients,
        hp.telehealth_available, hp.average_rating, hp.total_reviews,
        hp.address_line1, hp.city, hp.state, hp.zip_code,
        array_agg(ps.name) as specialties
    `;
    
    // Add distance calculation if coordinates provided
    if (latitude && longitude) {
      query += `,
        ST_Distance(hp.location::geography, ST_MakePoint($1, $2)::geography) as distance_meters
      `;
    }

    query += `
      FROM healthcare_providers hp
      LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      WHERE hp.verification_status = 'verified'
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (latitude && longitude) {
      queryParams.push(parseFloat(longitude), parseFloat(latitude));
      paramIndex += 2;
    }

    // Add filters
    if (specialty) {
      query += ` AND ps.name ILIKE $${paramIndex}`;
      queryParams.push(`%${specialty}%`);
      paramIndex++;
    }

    if (city) {
      query += ` AND hp.city ILIKE $${paramIndex}`;
      queryParams.push(`%${city}%`);
      paramIndex++;
    }

    if (state) {
      query += ` AND hp.state = $${paramIndex}`;
      queryParams.push(state);
      paramIndex++;
    }

    if (zip_code) {
      query += ` AND hp.zip_code = $${paramIndex}`;
      queryParams.push(zip_code);
      paramIndex++;
    }

    if (accepting_new_patients !== undefined) {
      query += ` AND hp.accepts_new_patients = $${paramIndex}`;
      queryParams.push(accepting_new_patients === 'true');
      paramIndex++;
    }

    if (telehealth_available !== undefined) {
      query += ` AND hp.telehealth_available = $${paramIndex}`;
      queryParams.push(telehealth_available === 'true');
      paramIndex++;
    }

    if (min_rating) {
      query += ` AND hp.average_rating >= $${paramIndex}`;
      queryParams.push(parseFloat(min_rating));
      paramIndex++;
    }

    // Add geospatial filter if coordinates provided
    if (latitude && longitude) {
      query += ` AND ST_DWithin(hp.location::geography, ST_MakePoint($1, $2)::geography, $${paramIndex} * 1609.34)`;
      queryParams.push(parseInt(radius));
      paramIndex++;
    }

    query += ` GROUP BY hp.id`;

    // Add sorting
    switch (sort_by) {
      case 'distance':
        if (latitude && longitude) {
          query += ` ORDER BY distance_meters ASC`;
        } else {
          query += ` ORDER BY hp.last_name ASC`;
        }
        break;
      case 'rating':
        query += ` ORDER BY hp.average_rating DESC, hp.total_reviews DESC`;
        break;
      case 'name':
        query += ` ORDER BY hp.last_name ASC, hp.first_name ASC`;
        break;
      case 'experience':
        query += ` ORDER BY hp.years_of_experience DESC`;
        break;
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(parseInt(limit), offset);

    const result = await pool.query(query, queryParams);

    // Convert distance from meters to miles if coordinates provided
    const providers = result.rows.map(provider => {
      if (provider.distance_meters) {
        provider.distance_miles = parseFloat((provider.distance_meters / 1609.34).toFixed(2));
        delete provider.distance_meters;
      }
      return provider;
    });

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(DISTINCT hp.id) as total
      FROM healthcare_providers hp
      LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      WHERE hp.verification_status = 'verified'
    `;

    const countResult = await pool.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].total);

    res.json({
      providers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error searching providers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/providers/:id - Get provider details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        hp.*,
        array_agg(DISTINCT ps.name) as specialties,
        array_agg(DISTINCT pc.name) as credentials
      FROM healthcare_providers hp
      LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      LEFT JOIN provider_credentials_map pcm ON hp.id = pcm.provider_id
      LEFT JOIN provider_credentials pc ON pcm.credential_id = pc.id
      WHERE hp.id = $1 AND hp.verification_status = 'verified'
      GROUP BY hp.id
    `;

    const result = await pool.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    const provider = result.rows[0];

    // Get provider availability
    const availabilityQuery = `
      SELECT day_of_week, opening_time, closing_time, is_available, 
             appointment_duration_minutes, break_start_time, break_end_time
      FROM provider_availability
      WHERE provider_id = $1 AND is_available = true
      ORDER BY day_of_week
    `;

    const availabilityResult = await pool.query(availabilityQuery, [id]);
    provider.availability = availabilityResult.rows;

    // Get recent approved reviews
    const reviewsQuery = `
      SELECT pr.*, p.first_name || ' ' || p.last_name as patient_name
      FROM provider_reviews pr
      LEFT JOIN patients pt ON pr.patient_id = pt.id
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE pr.provider_id = $1 AND pr.moderation_status = 'approved'
      ORDER BY pr.created_at DESC
      LIMIT 10
    `;

    const reviewsResult = await pool.query(reviewsQuery, [id]);
    provider.recent_reviews = reviewsResult.rows;

    res.json(provider);
  } catch (error) {
    console.error('Error getting provider details:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/providers/:id/availability - Get provider availability for date range
router.get('/:id/availability', [
  query('start_date').isDate(),
  query('end_date').isDate(),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;
    const { start_date, end_date } = req.query;

    // Get regular availability
    const regularAvailabilityQuery = `
      SELECT day_of_week, opening_time, closing_time, appointment_duration_minutes,
             break_start_time, break_end_time
      FROM provider_availability
      WHERE provider_id = $1 AND is_available = true
      ORDER BY day_of_week
    `;

    const regularAvailability = await pool.query(regularAvailabilityQuery, [id]);

    // Get special availability (holidays, time off)
    const specialAvailabilityQuery = `
      SELECT date, is_available, reason
      FROM provider_special_availability
      WHERE provider_id = $1 AND date BETWEEN $2 AND $3
      ORDER BY date
    `;

    const specialAvailability = await pool.query(specialAvailabilityQuery, [id, start_date, end_date]);

    // Get existing appointments
    const appointmentsQuery = `
      SELECT appointment_date, duration_minutes
      FROM appointments
      WHERE provider_id = $1 AND appointment_date BETWEEN $2 AND $3
      AND status NOT IN ('cancelled', 'no_show')
      ORDER BY appointment_date
    `;

    const appointments = await pool.query(appointmentsQuery, [id, start_date, end_date]);

    res.json({
      regular_availability: regularAvailability.rows,
      special_availability: specialAvailability.rows,
      existing_appointments: appointments.rows
    });
  } catch (error) {
    console.error('Error getting provider availability:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/providers/:id/reviews - Get provider reviews with pagination
router.get('/:id/reviews', [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 50 }),
  query('sort_by').optional().isIn(['date', 'rating', 'helpful']),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;
    const { page = 1, limit = 10, sort_by = 'date' } = req.query;

    let query = `
      SELECT pr.*, 
             COUNT(rh.id) as helpful_count,
             u.first_name || ' ' || u.last_name as patient_name
      FROM provider_reviews pr
      LEFT JOIN patients pt ON pr.patient_id = pt.id
      LEFT JOIN users u ON pt.user_id = u.id
      LEFT JOIN review_helpfulness rh ON pr.id = rh.review_id AND rh.is_helpful = true
      WHERE pr.provider_id = $1 AND pr.moderation_status = 'approved'
      GROUP BY pr.id, u.first_name, u.last_name
    `;

    // Add sorting
    switch (sort_by) {
      case 'rating':
        query += ` ORDER BY pr.overall_rating DESC, pr.created_at DESC`;
        break;
      case 'helpful':
        query += ` ORDER BY helpful_count DESC, pr.created_at DESC`;
        break;
      default:
        query += ` ORDER BY pr.created_at DESC`;
    }

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $2 OFFSET $3`;

    const result = await pool.query(query, [id, limit, offset]);

    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total
      FROM provider_reviews
      WHERE provider_id = $1 AND moderation_status = 'approved'
    `;

    const countResult = await pool.query(countQuery, [id]);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      reviews: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting provider reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/providers/:id/reviews - Submit a review (patients only)
router.post('/:id/reviews', [
  body('overall_rating').isInt({ min: 1, max: 5 }),
  body('bedside_manner_rating').isInt({ min: 1, max: 5 }),
  body('wait_time_rating').isInt({ min: 1, max: 5 }),
  body('staff_friendliness_rating').isInt({ min: 1, max: 5 }),
  body('title').optional().isString().isLength({ max: 200 }),
  body('review_text').optional().isString().isLength({ max: 2000 }),
  body('appointment_id').optional().isInt(),
  validateRequest
], async (req, res) => {
  try {
    const { id } = req.params;
    const {
      overall_rating, bedside_manner_rating, wait_time_rating,
      staff_friendliness_rating, title, review_text, appointment_id
    } = req.body;

    // Check if user is a patient and has had an appointment with this provider
    const patientCheckQuery = `
      SELECT pt.id as patient_id
      FROM patients pt
      WHERE pt.user_id = $1
    `;

    const patientResult = await pool.query(patientCheckQuery, [req.user.id]);
    if (patientResult.rows.length === 0) {
      return res.status(403).json({ error: 'Only patients can submit reviews' });
    }

    const patientId = patientResult.rows[0].patient_id;

    // Check if patient has had an appointment with this provider
    if (appointment_id) {
      const appointmentCheckQuery = `
        SELECT id FROM appointments
        WHERE id = $1 AND patient_id = $2 AND provider_id = $3
        AND status = 'completed'
      `;

      const appointmentResult = await pool.query(appointmentCheckQuery, [appointment_id, patientId, id]);
      if (appointmentResult.rows.length === 0) {
        return res.status(403).json({ error: 'Invalid appointment reference' });
      }
    }

    // Check if patient has already reviewed this provider
    const existingReviewQuery = `
      SELECT id FROM provider_reviews
      WHERE provider_id = $1 AND patient_id = $2
    `;

    const existingReviewResult = await pool.query(existingReviewQuery, [id, patientId]);
    if (existingReviewResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reviewed this provider' });
    }

    // Insert the review
    const insertQuery = `
      INSERT INTO provider_reviews (
        provider_id, patient_id, appointment_id, overall_rating,
        bedside_manner_rating, wait_time_rating, staff_friendliness_rating,
        title, review_text
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      id, patientId, appointment_id, overall_rating,
      bedside_manner_rating, wait_time_rating,
      staff_friendliness_rating, title, review_text
    ]);

    res.status(201).json({
      message: 'Review submitted successfully. It will be visible after moderation.',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Error submitting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/providers/:id/reviews/:review_id/helpful - Mark review as helpful
router.post('/:id/reviews/:review_id/helpful', async (req, res) => {
  try {
    const { id, review_id } = req.params;

    // Check if user has already voted
    const existingVoteQuery = `
      SELECT id FROM review_helpfulness
      WHERE review_id = $1 AND user_id = $2
    `;

    const existingVoteResult = await pool.query(existingVoteQuery, [review_id, req.user.id]);
    if (existingVoteResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already voted on this review' });
    }

    // Insert helpful vote
    const insertQuery = `
      INSERT INTO review_helpfulness (review_id, user_id, is_helpful)
      VALUES ($1, $2, true)
    `;

    await pool.query(insertQuery, [review_id, req.user.id]);

    res.json({ message: 'Review marked as helpful' });
  } catch (error) {
    console.error('Error marking review as helpful:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/providers/specialties - Get all available specialties
router.get('/specialties', async (req, res) => {
  try {
    const query = `
      SELECT * FROM provider_specialties
      ORDER BY category, name
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting specialties:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/providers/cities - Get cities with verified providers
router.get('/cities', [
  query('state').optional().isString(),
  validateRequest
], async (req, res) => {
  try {
    const { state } = req.query;

    let query = `
      SELECT DISTINCT city, state, COUNT(*) as provider_count
      FROM healthcare_providers
      WHERE verification_status = 'verified' AND city IS NOT NULL
    `;

    const queryParams = [];
    if (state) {
      query += ` AND state = $1`;
      queryParams.push(state);
    }

    query += ` GROUP BY city, state ORDER BY city`;

    const result = await pool.query(query, queryParams);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting cities:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
