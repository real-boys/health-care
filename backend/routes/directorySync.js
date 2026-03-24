const express = require('express');
const { body, query, validationResult } = require('express-validator');
const { Pool } = require('pg');
const axios = require('axios');
const cron = require('node-cron');
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

// GET /api/directory-sync/providers - Get providers ready for directory sync
router.get('/providers', [
  isAdmin,
  query('directory').optional().isIn(['healthgrades', 'zocdoc', 'webmd', 'vitals', 'all']),
  query('sync_status').optional().isIn(['pending', 'synced', 'error', 'all']),
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  validateRequest
], async (req, res) => {
  try {
    const { directory = 'all', sync_status = 'all', page = 1, limit = 20 } = req.query;

    let query = `
      SELECT 
        hp.*,
        array_agg(DISTINCT ps.name) as specialties,
        array_agg(DISTINCT pc.name) as credentials,
        COALESCE(pds.sync_status, 'pending') as sync_status,
        COALESCE(pds.last_synced, NULL) as last_synced,
        COALESCE(pds.error_message, NULL) as error_message
      FROM healthcare_providers hp
      LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
      LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
      LEFT JOIN provider_credentials_map pcm ON hp.id = pcm.provider_id
      LEFT JOIN provider_credentials pc ON pcm.credential_id = pc.id
      LEFT JOIN provider_directory_sync pds ON hp.id = pds.provider_id
      WHERE hp.verification_status = 'verified'
    `;

    const queryParams = [];
    let paramIndex = 1;

    if (directory !== 'all') {
      query += ` AND (pds.directory_name = $${paramIndex} OR pds.directory_name IS NULL)`;
      queryParams.push(directory);
      paramIndex++;
    }

    if (sync_status !== 'all') {
      query += ` AND COALESCE(pds.sync_status, 'pending') = $${paramIndex}`;
      queryParams.push(sync_status);
      paramIndex++;
    }

    query += ` GROUP BY hp.id, pds.sync_status, pds.last_synced, pds.error_message`;

    // Add pagination
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    queryParams.push(limit, offset);

    const result = await pool.query(query, queryParams);

    // Get total count
    let countQuery = `
      SELECT COUNT(DISTINCT hp.id) as total
      FROM healthcare_providers hp
      LEFT JOIN provider_directory_sync pds ON hp.id = pds.provider_id
      WHERE hp.verification_status = 'verified'
    `;

    if (directory !== 'all') {
      countQuery += ` AND (pds.directory_name = $1 OR pds.directory_name IS NULL)`;
      const countResult = await pool.query(countQuery, [directory]);
      var total = parseInt(countResult.rows[0].total);
    } else if (sync_status !== 'all') {
      countQuery += ` AND COALESCE(pds.sync_status, 'pending') = $1`;
      const countResult = await pool.query(countQuery, [sync_status]);
      var total = parseInt(countResult.rows[0].total);
    } else {
      const countResult = await pool.query(countQuery);
      var total = parseInt(countResult.rows[0].total);
    }

    res.json({
      providers: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error getting providers for sync:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/directory-sync/sync/:directory/:provider_id - Sync provider to specific directory
router.post('/sync/:directory/:provider_id', [
  isAdmin,
  validateRequest
], async (req, res) => {
  try {
    const { directory, provider_id } = req.params;

    // Validate directory
    const validDirectories = ['healthgrades', 'zocdoc', 'webmd', 'vitals'];
    if (!validDirectories.includes(directory)) {
      return res.status(400).json({ error: 'Invalid directory' });
    }

    // Get provider data
    const providerQuery = `
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

    const providerResult = await pool.query(providerQuery, [provider_id]);

    if (providerResult.rows.length === 0) {
      return res.status(404).json({ error: 'Verified provider not found' });
    }

    const provider = providerResult.rows[0];

    // Sync to directory
    const syncResult = await syncToDirectory(directory, provider);

    // Update sync status
    await updateSyncStatus(provider_id, directory, syncResult);

    res.json({
      message: `Provider synced to ${directory}`,
      sync_result: syncResult
    });
  } catch (error) {
    console.error('Error syncing provider:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/directory-sync/bulk/:directory - Bulk sync providers to directory
router.post('/bulk/:directory', [
  isAdmin,
  body('provider_ids').isArray({ min: 1, max: 50 }),
  body('provider_ids.*').isInt(),
  validateRequest
], async (req, res) => {
  try {
    const { directory } = req.params;
    const { provider_ids } = req.body;

    const validDirectories = ['healthgrades', 'zocdoc', 'webmd', 'vitals'];
    if (!validDirectories.includes(directory)) {
      return res.status(400).json({ error: 'Invalid directory' });
    }

    const results = [];
    let successCount = 0;
    let errorCount = 0;

    for (const provider_id of provider_ids) {
      try {
        // Get provider data
        const providerQuery = `
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

        const providerResult = await pool.query(providerQuery, [provider_id]);

        if (providerResult.rows.length === 0) {
          results.push({
            provider_id,
            status: 'error',
            message: 'Verified provider not found'
          });
          errorCount++;
          continue;
        }

        const provider = providerResult.rows[0];

        // Sync to directory
        const syncResult = await syncToDirectory(directory, provider);

        // Update sync status
        await updateSyncStatus(provider_id, directory, syncResult);

        results.push({
          provider_id,
          status: syncResult.success ? 'success' : 'error',
          message: syncResult.message,
          directory_provider_id: syncResult.directory_provider_id
        });

        if (syncResult.success) {
          successCount++;
        } else {
          errorCount++;
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));

      } catch (error) {
        console.error(`Error syncing provider ${provider_id}:`, error);
        results.push({
          provider_id,
          status: 'error',
          message: error.message
        });
        errorCount++;
      }
    }

    res.json({
      message: `Bulk sync completed. Success: ${successCount}, Errors: ${errorCount}`,
      results,
      summary: {
        total: provider_ids.length,
        success: successCount,
        errors: errorCount
      }
    });
  } catch (error) {
    console.error('Error in bulk sync:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/directory-sync/analytics - Get directory sync analytics
router.get('/analytics', isAdmin, async (req, res) => {
  try {
    const analytics = {};

    // Get sync status by directory
    const statusQuery = `
      SELECT 
        directory_name,
        sync_status,
        COUNT(*) as count
      FROM provider_directory_sync
      GROUP BY directory_name, sync_status
      ORDER BY directory_name, sync_status
    `;

    const statusResult = await pool.query(statusQuery);
    analytics.sync_status_by_directory = statusResult.rows;

    // Get recent sync activity
    const recentQuery = `
      SELECT 
        pds.directory_name,
        pds.sync_status,
        pds.last_synced,
        hp.first_name || ' ' || hp.last_name as provider_name
      FROM provider_directory_sync pds
      LEFT JOIN healthcare_providers hp ON pds.provider_id = hp.id
      ORDER BY pds.last_synced DESC
      LIMIT 20
    `;

    const recentResult = await pool.query(recentQuery);
    analytics.recent_activity = recentResult.rows;

    // Get sync success rates
    const successRateQuery = `
      SELECT 
        directory_name,
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) as successful_syncs,
        ROUND(
          (COUNT(CASE WHEN sync_status = 'synced' THEN 1 END) * 100.0 / COUNT(*)), 2
        ) as success_rate
      FROM provider_directory_sync
      GROUP BY directory_name
    `;

    const successRateResult = await pool.query(successRateQuery);
    analytics.success_rates = successRateResult.rows;

    // Get error breakdown
    const errorQuery = `
      SELECT 
        directory_name,
        error_message,
        COUNT(*) as error_count
      FROM provider_directory_sync
      WHERE sync_status = 'error'
      GROUP BY directory_name, error_message
      ORDER BY error_count DESC
      LIMIT 10
    `;

    const errorResult = await pool.query(errorQuery);
    analytics.common_errors = errorResult.rows;

    res.json(analytics);
  } catch (error) {
    console.error('Error getting analytics:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/directory-sync/configure/:directory - Configure directory API settings
router.post('/configure/:directory', [
  isAdmin,
  body('api_key').isString(),
  body('api_secret').optional().isString(),
  body('webhook_url').optional().isURL(),
  body('sync_frequency').optional().isIn(['daily', 'weekly', 'monthly']),
  validateRequest
], async (req, res) => {
  try {
    const { directory } = req.params;
    const { api_key, api_secret, webhook_url, sync_frequency } = req.body;

    const validDirectories = ['healthgrades', 'zocdoc', 'webmd', 'vitals'];
    if (!validDirectories.includes(directory)) {
      return res.status(400).json({ error: 'Invalid directory' });
    }

    // Store configuration securely (you might want to encrypt these)
    const configQuery = `
      INSERT INTO directory_configurations (directory_name, api_key, api_secret, webhook_url, sync_frequency, is_active)
      VALUES ($1, $2, $3, $4, $5, true)
      ON CONFLICT (directory_name)
      DO UPDATE SET 
        api_key = EXCLUDED.api_key,
        api_secret = EXCLUDED.api_secret,
        webhook_url = EXCLUDED.webhook_url,
        sync_frequency = EXCLUDED.sync_frequency,
        is_active = true,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const result = await pool.query(configQuery, [directory, api_key, api_secret, webhook_url, sync_frequency]);

    res.json({
      message: `${directory} configuration updated successfully`,
      config: {
        directory_name: result.rows[0].directory_name,
        webhook_url: result.rows[0].webhook_url,
        sync_frequency: result.rows[0].sync_frequency,
        is_active: result.rows[0].is_active
      }
    });
  } catch (error) {
    console.error('Error configuring directory:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/directory-sync/configurations - Get all directory configurations
router.get('/configurations', isAdmin, async (req, res) => {
  try {
    const query = `
      SELECT 
        directory_name,
        webhook_url,
        sync_frequency,
        is_active,
        created_at,
        updated_at
      FROM directory_configurations
      ORDER BY directory_name
    `;

    const result = await pool.query(query);
    res.json(result.rows);
  } catch (error) {
    console.error('Error getting configurations:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to sync provider to directory
async function syncToDirectory(directory, provider) {
  try {
    const configQuery = `
      SELECT api_key, api_secret FROM directory_configurations
      WHERE directory_name = $1 AND is_active = true
    `;

    const configResult = await pool.query(configQuery, [directory]);

    if (configResult.rows.length === 0) {
      return {
        success: false,
        message: `${directory} not configured or inactive`
      };
    }

    const config = configResult.rows[0];

    // Format provider data for directory
    const providerData = formatProviderForDirectory(directory, provider);

    // Make API call to directory
    const response = await makeDirectoryAPI(directory, providerData, config);

    return {
      success: true,
      message: 'Successfully synced to directory',
      directory_provider_id: response.provider_id || response.id,
      response_data: response
    };

  } catch (error) {
    console.error(`Error syncing to ${directory}:`, error);
    return {
      success: false,
      message: error.message,
      error_details: error.response?.data || error
    };
  }
}

// Helper function to format provider data for specific directory
function formatProviderForDirectory(directory, provider) {
  const baseData = {
    first_name: provider.first_name,
    last_name: provider.last_name,
    professional_title: provider.professional_title,
    bio: provider.bio,
    phone: provider.phone,
    email: provider.email,
    website: provider.website,
    practice_name: provider.practice_name,
    practice_type: provider.practice_type,
    years_of_experience: provider.years_of_experience,
    languages_spoken: provider.languages_spoken,
    specialties: provider.specialties,
    credentials: provider.credentials,
    address: {
      line1: provider.address_line1,
      line2: provider.address_line2,
      city: provider.city,
      state: provider.state,
      zip_code: provider.zip_code,
      country: provider.country
    },
    accepts_new_patients: provider.accepts_new_patients,
    telehealth_available: provider.telehealth_available,
    average_rating: provider.average_rating,
    total_reviews: provider.total_reviews
  };

  // Directory-specific formatting
  switch (directory) {
    case 'healthgrades':
      return {
        ...baseData,
        npi_number: provider.npi_number,
        gender: provider.gender || 'not_specified',
        hospital_affiliations: provider.hospital_affiliations || [],
        education: provider.education || [],
        awards: provider.awards || []
      };

    case 'zocdoc':
      return {
        ...baseData,
        profile_photo_url: provider.profile_image_url,
        insurance_accepted: provider.insurance_accepted || [],
        consultation_fee: provider.consultation_fee,
        virtual_visit_price: provider.virtual_visit_price
      };

    case 'webmd':
      return {
        ...baseData,
        medical_school: provider.medical_school,
        residency: provider.residency,
        fellowship: provider.fellowship,
        board_certifications: provider.board_certifications || []
      };

    case 'vitals':
      return {
        ...baseData,
        specialties: provider.specialties.join(', '),
        conditions_treated: provider.conditions_treated || [],
        procedures_performed: provider.procedures_performed || []
      };

    default:
      return baseData;
  }
}

// Helper function to make API call to directory
async function makeDirectoryAPI(directory, providerData, config) {
  const endpoints = {
    healthgrades: 'https://api.healthgrades.com/v1/providers',
    zocdoc: 'https://api.zocdoc.com/v1/providers',
    webmd: 'https://api.webmd.com/v1/providers',
    vitals: 'https://api.vitals.com/v1/providers'
  };

  const headers = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${config.api_key}`
  };

  if (config.api_secret) {
    headers['X-API-Secret'] = config.api_secret;
  }

  const response = await axios.post(endpoints[directory], providerData, {
    headers,
    timeout: 30000
  });

  return response.data;
}

// Helper function to update sync status
async function updateSyncStatus(providerId, directory, syncResult) {
  const query = `
    INSERT INTO provider_directory_sync (
      provider_id, directory_name, sync_status, last_synced,
      sync_data, error_message
    ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, $4, $5)
    ON CONFLICT (provider_id, directory_name)
    DO UPDATE SET
      sync_status = EXCLUDED.sync_status,
      last_synced = EXCLUDED.last_synced,
      sync_data = EXCLUDED.sync_data,
      error_message = EXCLUDED.error_message,
      updated_at = CURRENT_TIMESTAMP
  `;

  await pool.query(query, [
    providerId,
    directory,
    syncResult.success ? 'synced' : 'error',
    syncResult.success ? JSON.stringify(syncResult.response_data) : null,
    syncResult.success ? null : syncResult.message
  ]);
}

// Scheduled sync jobs
cron.schedule('0 2 * * *', async () => {
  console.log('Running daily directory sync...');
  try {
    // Get all active configurations
    const configQuery = `
      SELECT directory_name, sync_frequency
      FROM directory_configurations
      WHERE is_active = true AND sync_frequency = 'daily'
    `;

    const configResult = await pool.query(configQuery);

    for (const config of configResult.rows) {
      await runScheduledSync(config.directory_name);
    }

    console.log('Daily directory sync completed');
  } catch (error) {
    console.error('Error in daily directory sync:', error);
  }
});

cron.schedule('0 3 * * 1', async () => {
  console.log('Running weekly directory sync...');
  try {
    const configQuery = `
      SELECT directory_name
      FROM directory_configurations
      WHERE is_active = true AND sync_frequency = 'weekly'
    `;

    const configResult = await pool.query(configQuery);

    for (const config of configResult.rows) {
      await runScheduledSync(config.directory_name);
    }

    console.log('Weekly directory sync completed');
  } catch (error) {
    console.error('Error in weekly directory sync:', error);
  }
});

// Helper function for scheduled sync
async function runScheduledSync(directory) {
  try {
    // Get providers that need syncing
    const query = `
      SELECT DISTINCT hp.id
      FROM healthcare_providers hp
      LEFT JOIN provider_directory_sync pds ON hp.id = pds.provider_id AND pds.directory_name = $1
      WHERE hp.verification_status = 'verified'
      AND (pds.sync_status != 'synced' OR pds.last_synced < CURRENT_DATE - INTERVAL '7 days' OR pds.last_synced IS NULL)
      LIMIT 50
    `;

    const result = await pool.query(query, [directory]);

    for (const row of result.rows) {
      // Get provider data and sync
      const providerQuery = `
        SELECT 
          hp.*,
          array_agg(DISTINCT ps.name) as specialties,
          array_agg(DISTINCT pc.name) as credentials
        FROM healthcare_providers hp
        LEFT JOIN provider_specialties_map psm ON hp.id = psm.provider_id
        LEFT JOIN provider_specialties ps ON psm.specialty_id = ps.id
        LEFT JOIN provider_credentials_map pcm ON hp.id = pcm.provider_id
        LEFT JOIN provider_credentials pc ON pcm.credential_id = pc.id
        WHERE hp.id = $1
        GROUP BY hp.id
      `;

      const providerResult = await pool.query(providerQuery, [row.id]);
      
      if (providerResult.rows.length > 0) {
        const provider = providerResult.rows[0];
        const syncResult = await syncToDirectory(directory, provider);
        await updateSyncStatus(row.id, directory, syncResult);
      }

      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    console.log(`Scheduled sync for ${directory} completed. Processed ${result.rows.length} providers.`);
  } catch (error) {
    console.error(`Error in scheduled sync for ${directory}:`, error);
  }
}

module.exports = router;
