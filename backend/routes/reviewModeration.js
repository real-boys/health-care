const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Pool } = require('pg');
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

// Middleware to check if user is admin
const isAdmin = async (req, res, next) => {
  try {
    const query = 'SELECT role FROM users WHERE id = $1';
    const result = await pool.query(query, [req.user.id]);
    
    if (result.rows.length === 0 || result.rows[0].role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin status:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// GET /api/review-moderation/pending - Get pending reviews for moderation
router.get('/pending', [
  isAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('provider_id').optional().isInt(),
  validateRequest
], async (req, res) => {
  try {
    const { page = 1, limit = 20, provider_id } = req.query;

    let query = `
      SELECT 
        pr.*,
        hp.first_name || ' ' || hp.last_name as provider_name,
        u.first_name || ' ' || u.last_name as patient_name,
        u.email as patient_email
      FROM provider_reviews pr
      LEFT JOIN healthcare_providers hp ON pr.provider_id = hp.id
      LEFT JOIN patients pt ON pr.patient_id = pt.id
      LEFT JOIN users u ON pt.user_id = u.id
      WHERE pr.moderation_status = 'pending'
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (provider_id) {
      query += ` AND pr.provider_id = $${paramIndex}`;
      queryParams.push(provider_id);
      paramIndex++;
    }

    query += ` ORDER BY pr.created_at DESC`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM provider_reviews
      WHERE moderation_status = 'pending'
    `;

    if (provider_id) {
      countQuery += ` AND provider_id = $1`;
      const countResult = await pool.query(countQuery, [provider_id]);
      var total = parseInt(countResult.rows[0].total);
    } else {
      const countResult = await pool.query(countQuery);
      var total = parseInt(countResult.rows[0].total);
    }

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
    console.error('Error getting pending reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/review-moderation/flagged - Get flagged reviews
router.get('/flagged', [
  isAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('provider_id').optional().isInt(),
  validateRequest
], async (req, res) => {
  try {
    const { page = 1, limit = 20, provider_id } = req.query;

    let query = `
      SELECT 
        pr.*,
        hp.first_name || ' ' || hp.last_name as provider_name,
        u.first_name || ' ' || u.last_name as patient_name,
        u.email as patient_email,
        COUNT(rh.id) as flag_count
      FROM provider_reviews pr
      LEFT JOIN healthcare_providers hp ON pr.provider_id = hp.id
      LEFT JOIN patients pt ON pr.patient_id = pt.id
      LEFT JOIN users u ON pt.user_id = u.id
      LEFT JOIN review_reports rr ON pr.id = rr.review_id
      WHERE pr.moderation_status = 'flagged'
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (provider_id) {
      query += ` AND pr.provider_id = $${paramIndex}`;
      queryParams.push(provider_id);
      paramIndex++;
    }

    query += `
      GROUP BY pr.id, hp.first_name, hp.last_name, u.first_name, u.last_name, u.email
      ORDER BY pr.created_at DESC
    `;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      reviews: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length,
        pages: Math.ceil(result.rows.length / limit)
      }
    });
  } catch (error) {
    console.error('Error getting flagged reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/review-moderation/:review_id/approve - Approve a review
router.post('/:review_id/approve', [
  isAdmin,
  body('moderation_notes').optional().isString().isLength({ max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { review_id } = req.params;
    const { moderation_notes } = req.body;

    const query = `
      UPDATE provider_reviews
      SET moderation_status = 'approved', moderated_by = $1, moderated_at = CURRENT_TIMESTAMP, moderation_reason = $2
      WHERE id = $3 AND moderation_status IN ('pending', 'flagged')
      RETURNING *
    `;

    const result = await pool.query(query, [req.user.id, moderation_notes, review_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found or already moderated' });
    }

    // Trigger rating update (handled by database trigger)
    res.json({
      message: 'Review approved successfully',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Error approving review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/review-moderation/:review_id/reject - Reject a review
router.post('/:review_id/reject', [
  isAdmin,
  body('reason').isString().isLength({ min: 10, max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { review_id } = req.params;
    const { reason } = req.body;

    const query = `
      UPDATE provider_reviews
      SET moderation_status = 'rejected', moderated_by = $1, moderated_at = CURRENT_TIMESTAMP, moderation_reason = $2
      WHERE id = $3 AND moderation_status IN ('pending', 'flagged')
      RETURNING *
    `;

    const result = await pool.query(query, [req.user.id, reason, review_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found or already moderated' });
    }

    // Trigger rating update (handled by database trigger)
    res.json({
      message: 'Review rejected successfully',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Error rejecting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/review-moderation/:review_id/flag - Flag a review for review
router.post('/:review_id/flag', [
  isAdmin,
  body('reason').isString().isLength({ min: 10, max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { review_id } = req.params;
    const { reason } = req.body;

    const query = `
      UPDATE provider_reviews
      SET moderation_status = 'flagged', moderation_reason = $1
      WHERE id = $2 AND moderation_status = 'approved'
      RETURNING *
    `;

    const result = await pool.query(query, [reason, review_id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found or not approved' });
    }

    res.json({
      message: 'Review flagged successfully',
      review: result.rows[0]
    });
  } catch (error) {
    console.error('Error flagging review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/reviews/:review_id/report - Report a review (public endpoint)
router.post('/reviews/:review_id/report', [
  body('reason').isString().isLength({ min: 10, max: 1000 }),
  body('report_type').isIn(['inappropriate', 'spam', 'fake', 'conflict_of_interest', 'other']),
  validateRequest
], async (req, res) => {
  try {
    const { review_id } = req.params;
    const { reason, report_type } = req.body;

    // Check if review exists and is approved
    const reviewCheckQuery = `
      SELECT id FROM provider_reviews
      WHERE id = $1 AND moderation_status = 'approved'
    `;

    const reviewResult = await pool.query(reviewCheckQuery, [review_id]);

    if (reviewResult.rows.length === 0) {
      return res.status(404).json({ error: 'Review not found' });
    }

    // Check if user has already reported this review
    const existingReportQuery = `
      SELECT id FROM review_reports
      WHERE review_id = $1 AND reported_by = $2
    `;

    const existingReportResult = await pool.query(existingReportQuery, [review_id, req.user.id]);

    if (existingReportResult.rows.length > 0) {
      return res.status(400).json({ error: 'You have already reported this review' });
    }

    // Insert report
    const insertQuery = `
      INSERT INTO review_reports (review_id, reported_by, reason, report_type)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [review_id, req.user.id, reason, report_type]);

    // Check if this review should be auto-flagged based on number of reports
    const reportCountQuery = `
      SELECT COUNT(*) as report_count
      FROM review_reports
      WHERE review_id = $1
    `;

    const reportCountResult = await pool.query(reportCountQuery, [review_id]);
    const reportCount = parseInt(reportCountResult.rows[0].report_count);

    // Auto-flag if 3 or more reports
    if (reportCount >= 3) {
      await pool.query(`
        UPDATE provider_reviews
        SET moderation_status = 'flagged', moderation_reason = 'Auto-flagged due to multiple reports'
        WHERE id = $1
      `, [review_id]);
    }

    res.status(201).json({
      message: 'Review reported successfully',
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Error reporting review:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/review-moderation/analytics - Get review moderation analytics
router.get('/analytics', isAdmin, async (req, res) => {
  try {
    const analytics = {};

    // Get review status counts
    const statusQuery = `
      SELECT moderation_status, COUNT(*) as count
      FROM provider_reviews
      GROUP BY moderation_status
    `;

    const statusResult = await pool.query(statusQuery);
    analytics.review_status = statusResult.rows;

    // Get monthly review trends
    const monthlyQuery = `
      SELECT 
        DATE_TRUNC('month', created_at) as month,
        COUNT(*) as total_reviews,
        COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END) as approved_reviews,
        COUNT(CASE WHEN moderation_status = 'rejected' THEN 1 END) as rejected_reviews
      FROM provider_reviews
      WHERE created_at >= CURRENT_DATE - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', created_at)
      ORDER BY month DESC
    `;

    const monthlyResult = await pool.query(monthlyQuery);
    analytics.monthly_trends = monthlyResult.rows;

    // Get average rating distribution
    const ratingQuery = `
      SELECT overall_rating, COUNT(*) as count
      FROM provider_reviews
      WHERE moderation_status = 'approved'
      GROUP BY overall_rating
      ORDER BY overall_rating DESC
    `;

    const ratingResult = await pool.query(ratingQuery);
    analytics.rating_distribution = ratingResult.rows;

    // Get most reported reviews
    const reportedQuery = `
      SELECT 
        pr.id,
        pr.title,
        pr.overall_rating,
        hp.first_name || ' ' || hp.last_name as provider_name,
        COUNT(rr.id) as report_count
      FROM provider_reviews pr
      LEFT JOIN healthcare_providers hp ON pr.provider_id = hp.id
      LEFT JOIN review_reports rr ON pr.id = rr.review_id
      WHERE pr.created_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY pr.id, pr.title, pr.overall_rating, hp.first_name, hp.last_name
      HAVING COUNT(rr.id) > 0
      ORDER BY report_count DESC
      LIMIT 10
    `;

    const reportedResult = await pool.query(reportedQuery);
    analytics.most_reported = reportedResult.rows;

    // Get moderation queue efficiency
    const efficiencyQuery = `
      SELECT 
        moderated_by,
        COUNT(*) as total_moderated,
        COUNT(CASE WHEN moderation_status = 'approved' THEN 1 END) as approved,
        COUNT(CASE WHEN moderation_status = 'rejected' THEN 1 END) as rejected,
        AVG(EXTRACT(EPOCH FROM (moderated_at - created_at))/3600) as avg_hours_to_moderate
      FROM provider_reviews
      WHERE moderated_at IS NOT NULL
      AND moderated_at >= CURRENT_DATE - INTERVAL '30 days'
      GROUP BY moderated_by
    `;

    const efficiencyResult = await pool.query(efficiencyQuery);
    analytics.moderation_efficiency = efficiencyResult.rows;

    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/review-moderation/bulk-approve - Bulk approve multiple reviews
router.post('/bulk-approve', [
  isAdmin,
  body('review_ids').isArray({ min: 1 }),
  body('review_ids.*').isInt(),
  body('moderation_notes').optional().isString().isLength({ max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { review_ids, moderation_notes } = req.body;

    const query = `
      UPDATE provider_reviews
      SET moderation_status = 'approved', moderated_by = $1, moderated_at = CURRENT_TIMESTAMP, moderation_reason = $2
      WHERE id = ANY($3) AND moderation_status IN ('pending', 'flagged')
      RETURNING id
    `;

    const result = await pool.query(query, [req.user.id, moderation_notes, review_ids]);

    res.json({
      message: `Successfully approved ${result.rows.length} reviews`,
      approved_count: result.rows.length,
      approved_ids: result.rows.map(row => row.id)
    });
  } catch (error) {
    console.error('Error bulk approving reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/review-moderation/bulk-reject - Bulk reject multiple reviews
router.post('/bulk-reject', [
  isAdmin,
  body('review_ids').isArray({ min: 1 }),
  body('review_ids.*').isInt(),
  body('reason').isString().isLength({ min: 10, max: 1000 }),
  validateRequest
], async (req, res) => {
  try {
    const { review_ids, reason } = req.body;

    const query = `
      UPDATE provider_reviews
      SET moderation_status = 'rejected', moderated_by = $1, moderated_at = CURRENT_TIMESTAMP, moderation_reason = $2
      WHERE id = ANY($3) AND moderation_status IN ('pending', 'flagged')
      RETURNING id
    `;

    const result = await pool.query(query, [req.user.id, reason, review_ids]);

    res.json({
      message: `Successfully rejected ${result.rows.length} reviews`,
      rejected_count: result.rows.length,
      rejected_ids: result.rows.map(row => row.id)
    });
  } catch (error) {
    console.error('Error bulk rejecting reviews:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/review-moderation/reports - Get all review reports
router.get('/reports', [
  isAdmin,
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('status').optional().isIn(['pending', 'resolved']),
  validateRequest
], async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;

    let query = `
      SELECT 
        rr.*,
        pr.title as review_title,
        pr.overall_rating,
        pr.review_text,
        hp.first_name || ' ' || hp.last_name as provider_name,
        reporter.first_name || ' ' || reporter.last_name as reporter_name,
        reporter.email as reporter_email
      FROM review_reports rr
      LEFT JOIN provider_reviews pr ON rr.review_id = pr.id
      LEFT JOIN healthcare_providers hp ON pr.provider_id = hp.id
      LEFT JOIN users reporter ON rr.reported_by = reporter.id
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (status) {
      query += ` WHERE rr.status = $${paramIndex}`;
      queryParams.push(status);
      paramIndex++;
    }

    query += ` ORDER BY rr.created_at DESC`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    res.json({
      reports: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.rows.length,
        pages: Math.ceil(result.rows.length / limit)
      }
    });
  } catch (error) {
    console.error('Error getting reports:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
