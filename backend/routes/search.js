/**
 * Advanced Search Routes
 * API endpoints for searching claims, providers, and managing saved searches
 */

const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const AdvancedSearchService = require('../services/advancedSearchService');
const SavedSearch = require('../models/SavedSearch');
const Claim = require('../models/Claim');
const User = require('../models/User');

const searchService = new AdvancedSearchService();

/**
 * GET /api/search/claims
 * Search claims with filters and sorting
 */
router.get('/claims', authenticateToken, async (req, res) => {
  try {
    const {
      // Filters
      status, claimType, amountMin, amountMax, approvedAmountMin, approvedAmountMax,
      dateFrom, dateTo, createdFrom, createdTo, claimantName, claimNumber,
      policyId, providerId, priority, incidentType, location, assignedTo,
      hasPoliceReport, isFlagged,
      // Pagination & Sorting
      page = 1, limit = 20, sortBy = 'recent',
      // Search
      search
    } = req.query;

    // Build filters
    const filters = searchService.validateFilters({
      status: status ? (Array.isArray(status) ? status : [status]) : [],
      claimType: claimType ? (Array.isArray(claimType) ? claimType : [claimType]) : [],
      amountMin, amountMax, approvedAmountMin, approvedAmountMax,
      dateFrom, dateTo, createdFrom, createdTo,
      claimantName, claimNumber, policyId, providerId,
      priority: priority ? (Array.isArray(priority) ? priority : [priority]) : [],
      incidentType, location,
      assignedTo: assignedTo ? (Array.isArray(assignedTo) ? assignedTo : [assignedTo]) : [],
      hasPoliceReport: hasPoliceReport === 'true',
      isFlagged: isFlagged === 'true'
    });

    // Build query
    let query = searchService.buildClaimFilters(filters);

    // Text search
    if (search) {
      const textQuery = searchService.buildTextSearch(search, [
        'claimNumber',
        'claimant.name',
        'incident.type',
        'incident.description'
      ]);
      if (textQuery) {
        query = { $and: [query, textQuery] };
      }
    }

    // Get pagination
    const pagination = searchService.getPagination(page, limit);

    // Get sort
    const sortObj = searchService.getSortObject(sortBy);

    // Execute query
    const [results, totalCount] = await Promise.all([
      Claim.find(query)
        .sort(sortObj)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .populate('policy', 'policyNumber holder')
        .populate('assignedTo', 'username profile.firstName profile.lastName')
        .lean(),
      Claim.countDocuments(query)
    ]);

    // Build response metadata
    const metadata = searchService.buildSearchMetadata(
      filters, sortBy, page, limit, totalCount, results
    );

    res.json({
      success: true,
      data: results,
      metadata
    });

  } catch (error) {
    console.error('[Search] Error searching claims:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/providers
 * Search providers with filters and sorting
 */
router.get('/providers', authenticateToken, async (req, res) => {
  try {
    const {
      name, role, department, email, licenseNumber, organization,
      isActive = true, createdFrom, createdTo, permissions,
      page = 1, limit = 20, sortBy = 'name-asc',
      search
    } = req.query;

    // Build filters
    const filters = searchService.validateFilters({
      name, role: role ? (Array.isArray(role) ? role : [role]) : [],
      department: department ? (Array.isArray(department) ? department : [department]) : [],
      email, licenseNumber, organization, isActive,
      createdFrom, createdTo,
      permissions: permissions ? (Array.isArray(permissions) ? permissions : [permissions]) : []
    });

    // Build query
    let query = searchService.buildProviderFilters(filters);

    // Text search
    if (search) {
      const textQuery = searchService.buildTextSearch(search, [
        'username',
        'email',
        'profile.firstName',
        'profile.lastName',
        'profile.organization'
      ]);
      if (textQuery) {
        query = { $and: [query, textQuery] };
      }
    }

    // Get pagination
    const pagination = searchService.getPagination(page, limit);

    // Get sort
    const sortObj = searchService.getSortObject(sortBy);

    // Execute query
    const [results, totalCount] = await Promise.all([
      User.find(query)
        .select('-password')
        .sort(sortObj)
        .skip(pagination.skip)
        .limit(pagination.limit)
        .lean(),
      User.countDocuments(query)
    ]);

    // Build response metadata
    const metadata = searchService.buildSearchMetadata(
      filters, sortBy, page, limit, totalCount, results
    );

    res.json({
      success: true,
      data: results,
      metadata
    });

  } catch (error) {
    console.error('[Search] Error searching providers:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/filter-options
 * Get available filter options
 */
router.get('/filter-options', authenticateToken, (req, res) => {
  try {
    const options = searchService.getFilterOptions();
    res.json({
      success: true,
      options
    });
  } catch (error) {
    console.error('[Search] Error getting filter options:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/saved
 * Create a saved search
 */
router.post('/saved', authenticateToken, async (req, res) => {
  try {
    const { name, description, searchType, filters, sortBy, tags, settings } = req.body;

    if (!name || !searchType) {
      return res.status(400).json({ error: 'Name and searchType are required' });
    }

    const savedSearch = new SavedSearch({
      user: req.user.id,
      name,
      description,
      searchType,
      filters: filters || {},
      sortBy: sortBy || 'recent',
      tags: tags || [],
      settings: settings || {}
    });

    await savedSearch.save();

    res.status(201).json({
      success: true,
      data: savedSearch
    });

  } catch (error) {
    console.error('[Search] Error creating saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/saved
 * Get user's saved searches
 */
router.get('/saved', authenticateToken, async (req, res) => {
  try {
    const { searchType, includeDeleted = false } = req.query;

    let query = SavedSearch.findOne({ user: req.user.id });

    if (!includeDeleted) {
      query = query.active();
    }

    if (searchType) {
      query = query.where({ searchType });
    }

    const savedSearches = await query
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();

    res.json({
      success: true,
      data: savedSearches
    });

  } catch (error) {
    console.error('[Search] Error fetching saved searches:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/saved/:id
 * Get a specific saved search and execute it
 */
router.get('/saved/:id', authenticateToken, async (req, res) => {
  try {
    const savedSearch = await SavedSearch.findById(req.params.id);

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Check authorization
    if (savedSearch.user.toString() !== req.user.id && !savedSearch.shareSettings.isPublic) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Increment usage count
    if (savedSearch.user.toString() === req.user.id) {
      savedSearch.incrementUsage();
    }

    res.json({
      success: true,
      data: savedSearch
    });

  } catch (error) {
    console.error('[Search] Error fetching saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/search/saved/:id
 * Update a saved search
 */
router.put('/saved/:id', authenticateToken, async (req, res) => {
  try {
    const savedSearch = await SavedSearch.findById(req.params.id);

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Check authorization
    if (savedSearch.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Update allowed fields
    const allowedFields = ['name', 'description', 'filters', 'sortBy', 'tags', 'settings', 'isPinned', 'isDefault'];
    allowedFields.forEach(field => {
      if (field in req.body) {
        savedSearch[field] = req.body[field];
      }
    });

    await savedSearch.save();

    res.json({
      success: true,
      data: savedSearch
    });

  } catch (error) {
    console.error('[Search] Error updating saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/search/saved/:id
 * Delete a saved search (soft delete)
 */
router.delete('/saved/:id', authenticateToken, async (req, res) => {
  try {
    const savedSearch = await SavedSearch.findById(req.params.id);

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Check authorization
    if (savedSearch.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await savedSearch.softDelete();

    res.json({
      success: true,
      message: 'Saved search deleted'
    });

  } catch (error) {
    console.error('[Search] Error deleting saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/saved/:id/restore
 * Restore a deleted saved search
 */
router.post('/saved/:id/restore', authenticateToken, async (req, res) => {
  try {
    const savedSearch = await SavedSearch.findById(req.params.id);

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Check authorization
    if (savedSearch.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await savedSearch.restore();

    res.json({
      success: true,
      data: savedSearch
    });

  } catch (error) {
    console.error('[Search] Error restoring saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/search/saved/:id/pin
 * Pin/unpin a saved search
 */
router.post('/saved/:id/pin', authenticateToken, async (req, res) => {
  try {
    const savedSearch = await SavedSearch.findById(req.params.id);

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Check authorization
    if (savedSearch.user.toString() !== req.user.id) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    savedSearch.isPinned = !savedSearch.isPinned;
    await savedSearch.save();

    res.json({
      success: true,
      data: savedSearch
    });

  } catch (error) {
    console.error('[Search] Error pinning saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/search/saved/:id/results
 * Execute a saved search and get results
 */
router.get('/saved/:id/results', authenticateToken, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const savedSearch = await SavedSearch.findById(req.params.id);

    if (!savedSearch) {
      return res.status(404).json({ error: 'Saved search not found' });
    }

    // Check authorization
    if (savedSearch.user.toString() !== req.user.id && !savedSearch.shareSettings.isPublic) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    // Build query based on saved search
    let query, results, totalCount;

    if (savedSearch.searchType === 'claims') {
      query = searchService.buildClaimFilters(savedSearch.filters);
      const pagination = searchService.getPagination(page, limit);
      const sort = searchService.getSortObject(savedSearch.sortBy);

      [results, totalCount] = await Promise.all([
        Claim.find(query).sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
        Claim.countDocuments(query)
      ]);
    } else if (savedSearch.searchType === 'providers') {
      query = searchService.buildProviderFilters(savedSearch.filters);
      const pagination = searchService.getPagination(page, limit);
      const sort = searchService.getSortObject(savedSearch.sortBy);

      [results, totalCount] = await Promise.all([
        User.find(query).select('-password').sort(sort).skip(pagination.skip).limit(pagination.limit).lean(),
        User.countDocuments(query)
      ]);
    }

    // Update usage
    if (savedSearch.user.toString() === req.user.id) {
      savedSearch.incrementUsage();
    }

    const metadata = searchService.buildSearchMetadata(
      savedSearch.filters, savedSearch.sortBy, page, limit, totalCount, results
    );

    res.json({
      success: true,
      data: results,
      metadata,
      searchName: savedSearch.name
    });

  } catch (error) {
    console.error('[Search] Error executing saved search:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
