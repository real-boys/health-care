/**
 * Advanced Search Service
 * Handles search queries, filtering, sorting, and aggregation for claims and providers
 */

class AdvancedSearchService {
  constructor() {
    this.sortOptions = {
      'date-desc': { createdAt: -1 },
      'date-asc': { createdAt: 1 },
      'amount-desc': { amount: -1, approvedAmount: -1 },
      'amount-asc': { amount: 1, approvedAmount: 1 },
      'status-asc': { status: 1 },
      'recent': { updatedAt: -1 },
      'name-asc': { 'claimant.name': 1, 'profile.firstName': 1 },
      'name-desc': { 'claimant.name': -1, 'profile.firstName': -1 }
    };
  }

  /**
   * Build filter query for claims
   */
  buildClaimFilters(filters = {}) {
    const query = {};

    // Status filter
    if (filters.status && filters.status.length > 0) {
      query.status = { $in: filters.status };
    }

    // Claim type filter
    if (filters.claimType && filters.claimType.length > 0) {
      query.claimType = { $in: filters.claimType };
    }

    // Amount range filter
    if (filters.amountMin || filters.amountMax) {
      query.estimatedAmount = {};
      if (filters.amountMin) {
        query.estimatedAmount.$gte = parseFloat(filters.amountMin);
      }
      if (filters.amountMax) {
        query.estimatedAmount.$lte = parseFloat(filters.amountMax);
      }
    }

    // Approved amount range filter
    if (filters.approvedAmountMin || filters.approvedAmountMax) {
      query.approvedAmount = {};
      if (filters.approvedAmountMin) {
        query.approvedAmount.$gte = parseFloat(filters.approvedAmountMin);
      }
      if (filters.approvedAmountMax) {
        query.approvedAmount.$lte = parseFloat(filters.approvedAmountMax);
      }
    }

    // Date range filter (incident date)
    if (filters.dateFrom || filters.dateTo) {
      query['incident.date'] = {};
      if (filters.dateFrom) {
        query['incident.date'].$gte = new Date(filters.dateFrom);
      }
      if (filters.dateTo) {
        query['incident.date'].$lte = new Date(filters.dateTo);
      }
    }

    // Created date range filter
    if (filters.createdFrom || filters.createdTo) {
      query.createdAt = {};
      if (filters.createdFrom) {
        query.createdAt.$gte = new Date(filters.createdFrom);
      }
      if (filters.createdTo) {
        query.createdAt.$lte = new Date(filters.createdTo);
      }
    }

    // Claimant name search (text match)
    if (filters.claimantName) {
      query['claimant.name'] = { $regex: filters.claimantName, $options: 'i' };
    }

    // Claim number search
    if (filters.claimNumber) {
      query.claimNumber = { $regex: filters.claimNumber, $options: 'i' };
    }

    // Policy ID filter
    if (filters.policyId) {
      query.policy = filters.policyId;
    }

    // Provider filter
    if (filters.providerId) {
      query.provider = filters.providerId;
    }

    // Priority filter
    if (filters.priority && filters.priority.length > 0) {
      query.priority = { $in: filters.priority };
    }

    // Incident type filter
    if (filters.incidentType) {
      query['incident.type'] = { $regex: filters.incidentType, $options: 'i' };
    }

    // Location filter
    if (filters.location) {
      query['incident.location'] = { $regex: filters.location, $options: 'i' };
    }

    // Custom fields
    if (filters.hasPoliceReport !== undefined) {
      if (filters.hasPoliceReport) {
        query['incident.policeReportNumber'] = { $exists: true, $ne: null };
      } else {
        query['incident.policeReportNumber'] = { $exists: false };
      }
    }

    // Assigned to filter
    if (filters.assignedTo && filters.assignedTo.length > 0) {
      query.assignedTo = { $in: filters.assignedTo };
    }

    // Custom flag filters
    if (filters.isFlagged !== undefined) {
      query.flagged = filters.isFlagged;
    }

    return query;
  }

  /**
   * Build filter query for providers
   */
  buildProviderFilters(filters = {}) {
    const query = {};

    // Name search
    if (filters.name) {
      query.$or = [
        { 'profile.firstName': { $regex: filters.name, $options: 'i' } },
        { 'profile.lastName': { $regex: filters.name, $options: 'i' } },
        { 'profile.organization': { $regex: filters.name, $options: 'i' } }
      ];
    }

    // Role filter
    if (filters.role && filters.role.length > 0) {
      query.role = { $in: filters.role };
    }

    // Department filter
    if (filters.department && filters.department.length > 0) {
      query['profile.department'] = { $in: filters.department };
    }

    // Email search
    if (filters.email) {
      query.email = { $regex: filters.email, $options: 'i' };
    }

    // License number search
    if (filters.licenseNumber) {
      query['profile.licenseNumber'] = { $regex: filters.licenseNumber, $options: 'i' };
    }

    // Active status filter
    if (filters.isActive !== undefined) {
      query.isActive = filters.isActive;
    }

    // Created date range
    if (filters.createdFrom || filters.createdTo) {
      query.createdAt = {};
      if (filters.createdFrom) {
        query.createdAt.$gte = new Date(filters.createdFrom);
      }
      if (filters.createdTo) {
        query.createdAt.$lte = new Date(filters.createdTo);
      }
    }

    // Permissions filter
    if (filters.permissions && filters.permissions.length > 0) {
      query.permissions = { $in: filters.permissions };
    }

    // Organization filter
    if (filters.organization) {
      query['profile.organization'] = { $regex: filters.organization, $options: 'i' };
    }

    return query;
  }

  /**
   * Get sort object from sort key
   */
  getSortObject(sortBy = 'recent') {
    return this.sortOptions[sortBy] || this.sortOptions.recent;
  }

  /**
   * Build pagination object
   */
  getPagination(page = 1, limit = 20) {
    const pageNum = Math.max(1, parseInt(page));
    const limitNum = Math.min(100, Math.max(1, parseInt(limit))); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    return { skip, limit: limitNum, page: pageNum };
  }

  /**
   * Build text search query
   */
  buildTextSearch(searchTerm, fields = []) {
    if (!searchTerm || fields.length === 0) {
      return null;
    }

    const regex = { $regex: searchTerm, $options: 'i' };
    const query = { $or: fields.map(field => ({ [field]: regex })) };
    return query;
  }

  /**
   * Validate and sanitize filters
   */
  validateFilters(filters) {
    const validated = { ...filters };

    // Validate status values
    if (validated.status) {
      const validStatuses = ['pending', 'processing', 'approved', 'denied', 'completed'];
      validated.status = Array.isArray(validated.status) ? validated.status : [validated.status];
      validated.status = validated.status.filter(s => validStatuses.includes(s));
    }

    // Validate claim types
    if (validated.claimType) {
      const validTypes = ['medical', 'property', 'liability', 'death', 'disability'];
      validated.claimType = Array.isArray(validated.claimType) ? validated.claimType : [validated.claimType];
      validated.claimType = validated.claimType.filter(t => validTypes.includes(t));
    }

    // Validate priority
    if (validated.priority) {
      const validPriorities = ['low', 'medium', 'high', 'critical'];
      validated.priority = Array.isArray(validated.priority) ? validated.priority : [validated.priority];
      validated.priority = validated.priority.filter(p => validPriorities.includes(p));
    }

    // Validate numeric ranges
    if (validated.amountMin) {
      validated.amountMin = Math.max(0, parseFloat(validated.amountMin));
    }
    if (validated.amountMax) {
      validated.amountMax = Math.max(0, parseFloat(validated.amountMax));
    }

    // Validate dates
    const validateDate = (dateStr) => {
      try {
        const date = new Date(dateStr);
        return isNaN(date.getTime()) ? null : dateStr;
      } catch {
        return null;
      }
    };

    if (validated.dateFrom) {
      validated.dateFrom = validateDate(validated.dateFrom);
    }
    if (validated.dateTo) {
      validated.dateTo = validateDate(validated.dateTo);
    }
    if (validated.createdFrom) {
      validated.createdFrom = validateDate(validated.createdFrom);
    }
    if (validated.createdTo) {
      validated.createdTo = validateDate(validated.createdTo);
    }

    return validated;
  }

  /**
   * Get aggregation pipeline for analytics
   */
  getAggregationPipeline(filters = {}, groupBy = 'status') {
    const query = this.buildClaimFilters(filters);

    const pipeline = [
      { $match: query },
      {
        $group: {
          _id: `$${groupBy}`,
          count: { $sum: 1 },
          totalAmount: { $sum: '$estimatedAmount' },
          avgAmount: { $avg: '$estimatedAmount' },
          totalApproved: { $sum: '$approvedAmount' }
        }
      },
      { $sort: { count: -1 } }
    ];

    return pipeline;
  }

  /**
   * Build search metadata
   */
  buildSearchMetadata(filters, sortBy, page, limit, totalCount, results) {
    const pagination = this.getPagination(page, limit);

    return {
      total: totalCount,
      count: results.length,
      page: pagination.page,
      limit: pagination.limit,
      pages: Math.ceil(totalCount / pagination.limit),
      sortBy,
      filters: this.sanitizeFiltersForResponse(filters),
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Remove null/empty values from filters for response
   */
  sanitizeFiltersForResponse(filters) {
    const sanitized = {};
    Object.keys(filters).forEach(key => {
      const value = filters[key];
      if (value !== null && value !== undefined && value !== '' && 
          !(Array.isArray(value) && value.length === 0)) {
        sanitized[key] = value;
      }
    });
    return sanitized;
  }

  /**
   * Get available filter options
   */
  getFilterOptions() {
    return {
      statuses: ['pending', 'processing', 'approved', 'denied', 'completed'],
      claimTypes: ['medical', 'property', 'liability', 'death', 'disability'],
      priorities: ['low', 'medium', 'high', 'critical'],
      roles: ['admin', 'provider', 'agent', 'processor'],
      sortOptions: Object.keys(this.sortOptions),
      relationships: ['self', 'spouse', 'child', 'parent', 'other']
    };
  }
}

module.exports = AdvancedSearchService;
