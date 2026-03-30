const express = require('express');
const router = express.Router();
const sqlite3 = require('sqlite3').verbose();
const { body, validationResult, query } = require('express-validator');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '..', 'database', 'healthcare.db');

// Helper function to get database connection
function getDB() {
  return new sqlite3.Database(DB_PATH);
}

// Middleware to check if user is authenticated
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Verify token (simplified - in production, use proper JWT verification)
  try {
    const decoded = JSON.parse(Buffer.from(token, 'base64').toString());
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid token' });
  }
};

// Get reputation profile for a user
router.get('/profile/:userId', authenticateToken, [
  query('profileType').optional().isIn(['provider', 'patient', 'contributor'])
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { profileType } = req.query;
    
    const db = getDB();
    
    let query = `
      SELECT rp.*, u.first_name, u.last_name, u.email, u.role,
             rl.level_name, rl.level_color, rl.level_icon
      FROM reputation_profiles rp
      JOIN users u ON rp.user_id = u.id
      LEFT JOIN reputation_levels rl ON rp.reputation_level = rl.level_name
      WHERE rp.user_id = ?
    `;
    let params = [userId];
    
    if (profileType) {
      query += ' AND rp.profile_type = ?';
      params.push(profileType);
    }
    
    db.get(query, params, (err, profile) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      if (!profile) {
        db.close();
        return res.status(404).json({ error: 'Reputation profile not found' });
      }
      
      // Get user badges
      const badgeQuery = `
        SELECT b.*, ub.earned_at, ub.progress_percentage, ub.is_displayed
        FROM user_badges ub
        JOIN badges b ON ub.badge_id = b.id
        WHERE ub.user_id = ? AND ub.is_displayed = TRUE
        ORDER BY ub.earned_at DESC
      `;
      
      db.all(badgeQuery, [userId], (err, badges) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        profile.badges = badges;
        db.close();
        res.json(profile);
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Create or update reputation profile
router.post('/profile', authenticateToken, [
  body('userId').isInt(),
  body('profileType').isIn(['provider', 'patient', 'contributor']),
  body('overallScore').optional().isFloat({ min: 0, max: 5 }),
  body('trustScore').optional().isFloat({ min: 0, max: 5 }),
  body('reliabilityScore').optional().isFloat({ min: 0, max: 5 }),
  body('qualityScore').optional().isFloat({ min: 0, max: 5 }),
  body('engagementScore').optional().isFloat({ min: 0, max: 5 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      userId,
      profileType,
      overallScore,
      trustScore,
      reliabilityScore,
      qualityScore,
      engagementScore
    } = req.body;
    
    const db = getDB();
    
    // Check if profile exists
    db.get(
      'SELECT id FROM reputation_profiles WHERE user_id = ? AND profile_type = ?',
      [userId, profileType],
      (err, existing) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          // Update existing profile
          const updateQuery = `
            UPDATE reputation_profiles 
            SET overall_score = COALESCE(?, overall_score),
                trust_score = COALESCE(?, trust_score),
                reliability_score = COALESCE(?, reliability_score),
                quality_score = COALESCE(?, quality_score),
                engagement_score = COALESCE(?, engagement_score),
                updated_at = CURRENT_TIMESTAMP
            WHERE user_id = ? AND profile_type = ?
          `;
          
          db.run(updateQuery, [overallScore, trustScore, reliabilityScore, qualityScore, engagementScore, userId, profileType], function(err) {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Update reputation level based on score
            updateReputationLevel(db, userId, profileType, () => {
              db.close();
              res.json({ message: 'Reputation profile updated successfully', changes: this.changes });
            });
          });
        } else {
          // Create new profile
          const insertQuery = `
            INSERT INTO reputation_profiles 
            (user_id, profile_type, overall_score, trust_score, reliability_score, quality_score, engagement_score)
            VALUES (?, ?, COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0), COALESCE(?, 0))
          `;
          
          db.run(insertQuery, [userId, profileType, overallScore, trustScore, reliabilityScore, qualityScore, engagementScore], function(err) {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Update reputation level
            updateReputationLevel(db, userId, profileType, () => {
              db.close();
              res.json({ message: 'Reputation profile created successfully', id: this.lastID });
            });
          });
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Submit a rating and review
router.post('/review', authenticateToken, [
  body('revieweeId').isInt(),
  body('revieweeType').isIn(['provider', 'patient', 'contributor']),
  body('rating').isInt({ min: 1, max: 5 }),
  body('reviewTitle').optional().isLength({ max: 100 }),
  body('reviewText').optional().isLength({ max: 1000 }),
  body('reviewCategory').isIn(['service_quality', 'communication', 'timeliness', 'professionalism', 'expertise', 'bedside_manner', 'follow_up_care', 'overall_experience']),
  body('serviceDate').optional().isDate(),
  body('appointmentId').optional().isInt(),
  body('medicalRecordId').optional().isInt(),
  body('claimId').optional().isInt(),
  body('isAnonymous').optional().isBoolean()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const {
      revieweeId,
      revieweeType,
      rating,
      reviewTitle,
      reviewText,
      reviewCategory,
      serviceDate,
      appointmentId,
      medicalRecordId,
      claimId,
      isAnonymous
    } = req.body;
    
    const reviewerId = req.user.id;
    
    // Check if reviewer is not reviewing themselves
    if (reviewerId === revieweeId) {
      return res.status(400).json({ error: 'Cannot review yourself' });
    }
    
    const db = getDB();
    
    // Check if user has already reviewed this entity
    db.get(
      'SELECT id FROM ratings_reviews WHERE reviewer_id = ? AND reviewee_id = ? AND reviewee_type = ?',
      [reviewerId, revieweeId, revieweeType],
      (err, existing) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          db.close();
          return res.status(400).json({ error: 'You have already reviewed this user' });
        }
        
        // Insert the review
        const insertQuery = `
          INSERT INTO ratings_reviews 
          (reviewer_id, reviewee_id, reviewee_type, rating, review_title, review_text, review_category, 
           service_date, appointment_id, medical_record_id, claim_id, is_anonymous)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        
        db.run(insertQuery, [
          reviewerId, revieweeId, revieweeType, rating, reviewTitle, reviewText, reviewCategory,
          serviceDate, appointmentId, medicalRecordId, claimId, isAnonymous
        ], function(err) {
          if (err) {
            db.close();
            return res.status(500).json({ error: 'Database error' });
          }
          
          // Update reputation profile
          updateReputationFromReview(db, revieweeId, revieweeType, () => {
            // Add to reputation history
            addReputationHistory(db, revieweeId, 'rating_received', `Received ${rating}-star review`, null, null, null, reviewerId, this.lastID, null, () => {
              db.close();
              res.json({ message: 'Review submitted successfully', reviewId: this.lastID });
            });
          });
        });
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reviews for a user
router.get('/reviews/:userId', authenticateToken, [
  query('revieweeType').optional().isIn(['provider', 'patient', 'contributor']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('rating').optional().isInt({ min: 1, max: 5 }),
  query('category').optional().isIn(['service_quality', 'communication', 'timeliness', 'professionalism', 'expertise', 'bedside_manner', 'follow_up_care', 'overall_experience'])
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { revieweeType, page = 1, limit = 20, rating, category } = req.query;
    const offset = (page - 1) * limit;
    
    const db = getDB();
    
    let query = `
      SELECT rr.*, 
             u.first_name as reviewer_first_name, u.last_name as reviewer_last_name,
             CASE WHEN rr.is_anonymous = 1 THEN 'Anonymous' ELSE u.first_name || ' ' || u.last_name END as reviewer_name
      FROM ratings_reviews rr
      JOIN users u ON rr.reviewer_id = u.id
      WHERE rr.reviewee_id = ? AND rr.moderation_status = 'approved'
    `;
    let params = [userId];
    
    if (revieweeType) {
      query += ' AND rr.reviewee_type = ?';
      params.push(revieweeType);
    }
    
    if (rating) {
      query += ' AND rr.rating = ?';
      params.push(rating);
    }
    
    if (category) {
      query += ' AND rr.review_category = ?';
      params.push(category);
    }
    
    query += ' ORDER BY rr.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    db.all(query, params, (err, reviews) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      // Get total count for pagination
      const countQuery = `
        SELECT COUNT(*) as total
        FROM ratings_reviews
        WHERE reviewee_id = ? AND moderation_status = 'approved'
      `;
      let countParams = [userId];
      
      if (revieweeType) {
        countQuery += ' AND reviewee_type = ?';
        countParams.push(revieweeType);
      }
      
      if (rating) {
        countQuery += ' AND rating = ?';
        countParams.push(rating);
      }
      
      if (category) {
        countQuery += ' AND review_category = ?';
        countParams.push(category);
      }
      
      db.get(countQuery, countParams, (err, countResult) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        db.close();
        res.json({
          reviews,
          pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total: countResult.total,
            totalPages: Math.ceil(countResult.total / limit)
          }
        });
      });
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user badges
router.get('/badges/:userId', authenticateToken, async (req, res) => {
  try {
    const { userId } = req.params;
    
    const db = getDB();
    
    const query = `
      SELECT b.*, ub.earned_at, ub.progress_percentage, ub.is_displayed
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
    `;
    
    db.all(query, [userId], (err, badges) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.close();
      res.json(badges);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Award badge to user
router.post('/badge/award', authenticateToken, [
  body('userId').isInt(),
  body('badgeId').isInt(),
  body('progressPercentage').optional().isFloat({ min: 0, max: 100 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { userId, badgeId, progressPercentage = 100 } = req.body;
    
    const db = getDB();
    
    // Check if badge already exists for user
    db.get(
      'SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?',
      [userId, badgeId],
      (err, existing) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          // Update progress
          db.run(
            'UPDATE user_badges SET progress_percentage = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
            [progressPercentage, existing.id],
            function(err) {
              if (err) {
                db.close();
                return res.status(500).json({ error: 'Database error' });
              }
              
              db.close();
              res.json({ message: 'Badge progress updated successfully' });
            }
          );
        } else {
          // Award new badge
          db.run(
            'INSERT INTO user_badges (user_id, badge_id, progress_percentage) VALUES (?, ?, ?)',
            [userId, badgeId, progressPercentage],
            function(err) {
              if (err) {
                db.close();
                return res.status(500).json({ error: 'Database error' });
              }
              
              // Add to reputation history
              addReputationHistory(db, userId, 'badge_earned', 'Earned a new badge', null, null, null, null, null, badgeId, () => {
                db.close();
                res.json({ message: 'Badge awarded successfully', badgeId: this.lastID });
              });
            }
          );
        }
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reputation history
router.get('/history/:userId', authenticateToken, [
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  query('eventType').optional().isIn(['rating_received', 'rating_given', 'badge_earned', 'milestone_reached', 'review_posted', 'review_moderated', 'score_change'])
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { page = 1, limit = 50, eventType } = req.query;
    const offset = (page - 1) * limit;
    
    const db = getDB();
    
    let query = `
      SELECT rh.*, 
             u.first_name, u.last_name,
             b.badge_name,
             rr.rating
      FROM reputation_history rh
      LEFT JOIN users u ON rh.related_user_id = u.id
      LEFT JOIN badges b ON rh.related_badge_id = b.id
      LEFT JOIN ratings_reviews rr ON rh.related_rating_id = rr.id
      WHERE rh.user_id = ?
    `;
    let params = [userId];
    
    if (eventType) {
      query += ' AND rh.event_type = ?';
      params.push(eventType);
    }
    
    query += ' ORDER BY rh.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);
    
    db.all(query, params, (err, history) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.close();
      res.json(history);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Vote on review helpfulness
router.post('/review/:reviewId/vote', authenticateToken, [
  body('voteType').isIn(['helpful', 'not_helpful'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { reviewId } = req.params;
    const { voteType } = req.body;
    const voterId = req.user.id;
    
    const db = getDB();
    
    // Check if user has already voted
    db.get(
      'SELECT id FROM review_votes WHERE review_id = ? AND voter_id = ?',
      [reviewId, voterId],
      (err, existing) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          db.close();
          return res.status(400).json({ error: 'You have already voted on this review' });
        }
        
        // Add vote
        db.run(
          'INSERT INTO review_votes (review_id, voter_id, vote_type) VALUES (?, ?, ?)',
          [reviewId, voterId, voteType],
          function(err) {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Update helpful votes count
            const updateQuery = voteType === 'helpful' 
              ? 'UPDATE ratings_reviews SET helpful_votes = helpful_votes + 1 WHERE id = ?'
              : 'UPDATE ratings_reviews SET helpful_votes = helpful_votes - 1 WHERE id = ?';
            
            db.run(updateQuery, [reviewId], (err) => {
              if (err) {
                db.close();
                return res.status(500).json({ error: 'Database error' });
              }
              
              db.close();
              res.json({ message: 'Vote recorded successfully' });
            });
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Report a review
router.post('/review/:reviewId/report', authenticateToken, [
  body('reportReason').isIn(['spam', 'fake_review', 'inappropriate_content', 'conflict_of_interest', 'personal_info', 'harassment', 'other']),
  body('reportDescription').optional().isLength({ max: 500 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }
    
    const { reviewId } = req.params;
    const { reportReason, reportDescription } = req.body;
    const reporterId = req.user.id;
    
    const db = getDB();
    
    // Check if user has already reported this review
    db.get(
      'SELECT id FROM review_reports WHERE review_id = ? AND reporter_id = ?',
      [reviewId, reporterId],
      (err, existing) => {
        if (err) {
          db.close();
          return res.status(500).json({ error: 'Database error' });
        }
        
        if (existing) {
          db.close();
          return res.status(400).json({ error: 'You have already reported this review' });
        }
        
        // Add report
        db.run(
          'INSERT INTO review_reports (review_id, reporter_id, report_reason, report_description) VALUES (?, ?, ?, ?)',
          [reviewId, reporterId, reportReason, reportDescription],
          function(err) {
            if (err) {
              db.close();
              return res.status(500).json({ error: 'Database error' });
            }
            
            // Update report count
            db.run(
              'UPDATE ratings_reviews SET report_count = report_count + 1 WHERE id = ?',
              [reviewId],
              (err) => {
                if (err) {
                  db.close();
                  return res.status(500).json({ error: 'Database error' });
                }
                
                db.close();
                res.json({ message: 'Review reported successfully' });
              }
            );
          }
        );
      }
    );
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Get reputation metrics
router.get('/metrics/:userId', authenticateToken, [
  query('period').optional().isIn(['daily', 'weekly', 'monthly']),
  query('startDate').optional().isDate(),
  query('endDate').optional().isDate()
], async (req, res) => {
  try {
    const { userId } = req.params;
    const { period = 'daily', startDate, endDate } = req.query;
    
    const db = getDB();
    
    let query = `
      SELECT * FROM reputation_metrics 
      WHERE user_id = ?
    `;
    let params = [userId];
    
    if (startDate) {
      query += ' AND metric_date >= ?';
      params.push(startDate);
    }
    
    if (endDate) {
      query += ' AND metric_date <= ?';
      params.push(endDate);
    }
    
    query += ' ORDER BY metric_date DESC';
    
    if (period === 'daily') {
      query += ' LIMIT 30';
    } else if (period === 'weekly') {
      query += ' LIMIT 12';
    } else {
      query += ' LIMIT 12';
    }
    
    db.all(query, params, (err, metrics) => {
      if (err) {
        db.close();
        return res.status(500).json({ error: 'Database error' });
      }
      
      db.close();
      res.json(metrics);
    });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Helper functions
function updateReputationLevel(db, userId, profileType, callback) {
  db.get(
    'SELECT overall_score, total_ratings FROM reputation_profiles WHERE user_id = ? AND profile_type = ?',
    [userId, profileType],
    (err, profile) => {
      if (err || !profile) {
        return callback();
      }
      
      db.get(
        'SELECT level_name FROM reputation_levels WHERE minimum_score <= ? ORDER BY minimum_score DESC LIMIT 1',
        [profile.overall_score],
        (err, level) => {
          if (err) {
            return callback();
          }
          
          const newLevel = level ? level.level_name : 'new';
          
          db.run(
            'UPDATE reputation_profiles SET reputation_level = ? WHERE user_id = ? AND profile_type = ?',
            [newLevel, userId, profileType],
            callback
          );
        }
      );
    }
  );
}

function updateReputationFromReview(db, userId, profileType, callback) {
  db.get(
    'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM ratings_reviews WHERE reviewee_id = ? AND reviewee_type = ? AND moderation_status = "approved"',
    [userId, profileType],
    (err, result) => {
      if (err) {
        return callback();
      }
      
      const avgRating = result.avg_rating || 0;
      const count = result.count || 0;
      
      db.run(
        'UPDATE reputation_profiles SET average_rating = ?, total_ratings = ?, overall_score = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND profile_type = ?',
        [avgRating, count, avgRating, userId, profileType],
        function(err) {
          if (err) {
            return callback();
          }
          
          updateReputationLevel(db, userId, profileType, callback);
        }
      );
    }
  );
}

function addReputationHistory(db, userId, eventType, description, previousScore, newScore, scoreChange, relatedUserId, relatedRatingId, relatedBadgeId, callback) {
  db.run(
    'INSERT INTO reputation_history (user_id, event_type, event_description, previous_score, new_score, score_change, related_user_id, related_rating_id, related_badge_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [userId, eventType, description, previousScore, newScore, scoreChange, relatedUserId, relatedRatingId, relatedBadgeId],
    callback
  );
}

module.exports = router;
