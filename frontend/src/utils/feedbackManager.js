import { FEEDBACK_TYPES, FEEDBACK_CATEGORIES, validateFeedback } from './feedbackConfig';
import { sentimentAnalyzer } from './sentimentAnalyzer';

export class FeedbackManager {
  constructor() {
    this.feedback = [];
    this.listeners = [];
    this.storageKey = 'healthcare_feedback';
    this.loadFeedback();
  }

  // Initialize feedback manager
  init() {
    this.loadFeedback();
    this.setupAutoSave();
  }

  // Load feedback from localStorage
  loadFeedback() {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        this.feedback = JSON.parse(stored);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
      this.feedback = [];
    }
  }

  // Save feedback to localStorage
  saveFeedback() {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.feedback));
      this.notifyListeners('dataChanged', { feedback: this.feedback });
    } catch (error) {
      console.error('Error saving feedback:', error);
    }
  }

  // Setup auto-save
  setupAutoSave() {
    // Save every 30 seconds
    setInterval(() => this.saveFeedback(), 30000);
    
    // Save on page unload
    window.addEventListener('beforeunload', () => this.saveFeedback());
  }

  // Event listeners
  addListener(event, callback) {
    this.listeners.push({ event, callback });
  }

  removeListener(event, callback) {
    this.listeners = this.listeners.filter(
      listener => !(listener.event === event && listener.callback === callback)
    );
  }

  notifyListeners(event, data) {
    this.listeners
      .filter(listener => listener.event === event)
      .forEach(listener => listener.callback(data));
  }

  // Submit new feedback
  async submitFeedback(feedbackData) {
    try {
      // Validate feedback
      const validation = validateFeedback(feedbackData);
      if (!validation.isValid) {
        throw new Error(validation.errors.join(', '));
      }

      // Analyze sentiment if not already done
      if (!feedbackData.sentiment && feedbackData.comment) {
        const sentiment = sentimentAnalyzer.generateSummary(feedbackData.comment);
        feedbackData.sentiment = sentiment.sentiment;
        feedbackData.sentimentScore = sentiment.score;
        feedbackData.keywords = sentiment.keywords;
      }

      // Create feedback object
      const feedback = {
        id: this.generateId(),
        ...feedbackData,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'published',
        helpfulCount: 0,
        notHelpfulCount: 0,
        replies: [],
        reports: [],
        shareCount: 0
      };

      // Add to feedback list
      this.feedback.unshift(feedback);
      this.saveFeedback();

      // Notify listeners
      this.notifyListeners('feedbackSubmitted', { feedback });

      return feedback;
    } catch (error) {
      console.error('Error submitting feedback:', error);
      throw error;
    }
  }

  // Update feedback
  async updateFeedback(id, updates) {
    try {
      const index = this.feedback.findIndex(f => f.id === id);
      if (index === -1) {
        throw new Error('Feedback not found');
      }

      this.feedback[index] = {
        ...this.feedback[index],
        ...updates,
        updatedAt: new Date().toISOString()
      };

      this.saveFeedback();
      this.notifyListeners('feedbackUpdated', { 
        feedback: this.feedback[index],
        updates 
      });

      return this.feedback[index];
    } catch (error) {
      console.error('Error updating feedback:', error);
      throw error;
    }
  }

  // Delete feedback
  async deleteFeedback(id) {
    try {
      const index = this.feedback.findIndex(f => f.id === id);
      if (index === -1) {
        throw new Error('Feedback not found');
      }

      const deletedFeedback = this.feedback.splice(index, 1)[0];
      this.saveFeedback();
      this.notifyListeners('feedbackDeleted', { feedback: deletedFeedback });

      return deletedFeedback;
    } catch (error) {
      console.error('Error deleting feedback:', error);
      throw error;
    }
  }

  // Reply to feedback
  async replyToFeedback(feedbackId, replyText, authorInfo = {}) {
    try {
      const feedback = this.feedback.find(f => f.id === feedbackId);
      if (!feedback) {
        throw new Error('Feedback not found');
      }

      const reply = {
        id: this.generateId(),
        message: replyText,
        author: authorInfo.name || 'Support Team',
        authorRole: authorInfo.role || 'staff',
        createdAt: new Date().toISOString(),
        helpfulCount: 0
      };

      feedback.replies = feedback.replies || [];
      feedback.replies.push(reply);
      feedback.updatedAt = new Date().toISOString();

      this.saveFeedback();
      this.notifyListeners('replyAdded', { feedbackId, reply });

      return reply;
    } catch (error) {
      console.error('Error adding reply:', error);
      throw error;
    }
  }

  // Vote on feedback
  async voteOnFeedback(feedbackId, helpful, userId = null) {
    try {
      const feedback = this.feedback.find(f => f.id === feedbackId);
      if (!feedback) {
        throw new Error('Feedback not found');
      }

      // Track user votes to prevent duplicate voting
      if (!feedback.userVotes) {
        feedback.userVotes = {};
      }

      // Remove previous vote if exists
      if (feedback.userVotes[userId]) {
        if (feedback.userVotes[userId] === 'helpful') {
          feedback.helpfulCount--;
        } else {
          feedback.notHelpfulCount--;
        }
      }

      // Add new vote
      if (helpful) {
        feedback.helpfulCount++;
        feedback.userVotes[userId] = 'helpful';
      } else {
        feedback.notHelpfulCount++;
        feedback.userVotes[userId] = 'not_helpful';
      }

      feedback.updatedAt = new Date().toISOString();
      this.saveFeedback();
      this.notifyListeners('voteAdded', { feedbackId, helpful, userId });

      return feedback;
    } catch (error) {
      console.error('Error voting on feedback:', error);
      throw error;
    }
  }

  // Report feedback
  async reportFeedback(feedbackId, reason, userId = null) {
    try {
      const feedback = this.feedback.find(f => f.id === feedbackId);
      if (!feedback) {
        throw new Error('Feedback not found');
      }

      const report = {
        id: this.generateId(),
        reason,
        userId,
        createdAt: new Date().toISOString(),
        status: 'pending'
      };

      feedback.reports = feedback.reports || [];
      feedback.reports.push(report);
      feedback.updatedAt = new Date().toISOString();

      // Auto-hide feedback if it gets too many reports
      if (feedback.reports.length >= 5) {
        feedback.status = 'flagged';
      }

      this.saveFeedback();
      this.notifyListeners('feedbackReported', { feedbackId, report });

      return report;
    } catch (error) {
      console.error('Error reporting feedback:', error);
      throw error;
    }
  }

  // Share feedback
  async shareFeedback(feedbackId) {
    try {
      const feedback = this.feedback.find(f => f.id === feedbackId);
      if (!feedback) {
        throw new Error('Feedback not found');
      }

      feedback.shareCount = (feedback.shareCount || 0) + 1;
      feedback.updatedAt = new Date().toISOString();

      this.saveFeedback();
      this.notifyListeners('feedbackShared', { feedbackId });

      return feedback;
    } catch (error) {
      console.error('Error sharing feedback:', error);
      throw error;
    }
  }

  // Get feedback by ID
  getFeedback(id) {
    return this.feedback.find(f => f.id === id);
  }

  // Get all feedback
  getAllFeedback() {
    return [...this.feedback];
  }

  // Get feedback by type
  getFeedbackByType(type) {
    return this.feedback.filter(f => f.type === type);
  }

  // Get feedback by category
  getFeedbackByCategory(category) {
    return this.feedback.filter(f => f.category === category);
  }

  // Get feedback by rating
  getFeedbackByRating(rating) {
    return this.feedback.filter(f => f.rating === rating);
  }

  // Get feedback by sentiment
  getFeedbackBySentiment(sentiment) {
    return this.feedback.filter(f => f.sentiment === sentiment);
  }

  // Search feedback
  searchFeedback(query) {
    const lowercaseQuery = query.toLowerCase();
    return this.feedback.filter(f => 
      f.comment?.toLowerCase().includes(lowercaseQuery) ||
      f.authorName?.toLowerCase().includes(lowercaseQuery) ||
      f.category?.toLowerCase().includes(lowercaseQuery) ||
      f.keywords?.some(keyword => keyword.toLowerCase().includes(lowercaseQuery))
    );
  }

  // Filter feedback
  filterFeedback(filters) {
    return this.feedback.filter(f => {
      let matches = true;

      if (filters.type && f.type !== filters.type) matches = false;
      if (filters.category && f.category !== filters.category) matches = false;
      if (filters.rating && f.rating !== filters.rating) matches = false;
      if (filters.sentiment && f.sentiment !== filters.sentiment) matches = false;
      if (filters.status && f.status !== filters.status) matches = false;
      if (filters.dateFrom && new Date(f.createdAt) < new Date(filters.dateFrom)) matches = false;
      if (filters.dateTo && new Date(f.createdAt) > new Date(filters.dateTo)) matches = false;
      if (filters.minRating && f.rating < filters.minRating) matches = false;
      if (filters.maxRating && f.rating > filters.maxRating) matches = false;

      return matches;
    });
  }

  // Sort feedback
  sortFeedback(feedback, sortBy, order = 'desc') {
    const sorted = [...feedback];

    switch (sortBy) {
      case 'date':
        sorted.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
        break;
      case 'rating':
        sorted.sort((a, b) => a.rating - b.rating);
        break;
      case 'helpful':
        sorted.sort((a, b) => (a.helpfulCount || 0) - (b.helpfulCount || 0));
        break;
      case 'sentiment':
        const sentimentOrder = { 'VERY_NEGATIVE': 0, 'NEGATIVE': 1, 'NEUTRAL': 2, 'POSITIVE': 3, 'VERY_POSITIVE': 4 };
        sorted.sort((a, b) => (sentimentOrder[a.sentiment] || 2) - (sentimentOrder[b.sentiment] || 2));
        break;
      case 'replies':
        sorted.sort((a, b) => (a.replies?.length || 0) - (b.replies?.length || 0));
        break;
      default:
        return sorted;
    }

    return order === 'desc' ? sorted.reverse() : sorted;
  }

  // Get statistics
  getStatistics() {
    const total = this.feedback.length;
    if (total === 0) {
      return {
        total: 0,
        averageRating: 0,
        ratingDistribution: {},
        sentimentDistribution: {},
        categoryDistribution: {},
        typeDistribution: {},
        engagementMetrics: {
          totalVotes: 0,
          helpfulVotes: 0,
          totalReplies: 0,
          totalShares: 0,
          totalReports: 0
        }
      };
    }

    const ratingDistribution = {};
    const sentimentDistribution = {};
    const categoryDistribution = {};
    const typeDistribution = {};

    let totalRating = 0;
    let engagementMetrics = {
      totalVotes: 0,
      helpfulVotes: 0,
      totalReplies: 0,
      totalShares: 0,
      totalReports: 0
    };

    this.feedback.forEach(f => {
      // Rating distribution
      ratingDistribution[f.rating] = (ratingDistribution[f.rating] || 0) + 1;
      totalRating += f.rating;

      // Sentiment distribution
      const sentiment = f.sentiment || 'NEUTRAL';
      sentimentDistribution[sentiment] = (sentimentDistribution[sentiment] || 0) + 1;

      // Category distribution
      const category = f.category || 'general';
      categoryDistribution[category] = (categoryDistribution[category] || 0) + 1;

      // Type distribution
      typeDistribution[f.type] = (typeDistribution[f.type] || 0) + 1;

      // Engagement metrics
      engagementMetrics.totalVotes += (f.helpfulCount || 0) + (f.notHelpfulCount || 0);
      engagementMetrics.helpfulVotes += f.helpfulCount || 0;
      engagementMetrics.totalReplies += f.replies?.length || 0;
      engagementMetrics.totalShares += f.shareCount || 0;
      engagementMetrics.totalReports += f.reports?.length || 0;
    });

    return {
      total,
      averageRating: Math.round((totalRating / total) * 100) / 100,
      ratingDistribution,
      sentimentDistribution,
      categoryDistribution,
      typeDistribution,
      engagementMetrics
    };
  }

  // Export feedback
  exportFeedback(format = 'json', filters = {}) {
    const data = filters ? this.filterFeedback(filters) : this.feedback;

    switch (format) {
      case 'json':
        return JSON.stringify(data, null, 2);
      case 'csv':
        return this.convertToCSV(data);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  // Convert to CSV
  convertToCSV(data) {
    if (data.length === 0) return '';

    const headers = [
      'id',
      'type',
      'rating',
      'comment',
      'authorName',
      'category',
      'sentiment',
      'createdAt',
      'helpfulCount',
      'notHelpfulCount',
      'repliesCount',
      'shareCount'
    ];

    const csvRows = [
      headers.join(','),
      ...data.map(item => [
        item.id,
        item.type,
        item.rating,
        `"${(item.comment || '').replace(/"/g, '""')}"`,
        `"${(item.authorName || '').replace(/"/g, '""')}"`,
        item.category || '',
        item.sentiment || '',
        item.createdAt,
        item.helpfulCount || 0,
        item.notHelpfulCount || 0,
        item.replies?.length || 0,
        item.shareCount || 0
      ].join(','))
    ];

    return csvRows.join('\n');
  }

  // Generate unique ID
  generateId() {
    return `feedback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Clear all feedback
  clearFeedback() {
    this.feedback = [];
    this.saveFeedback();
    this.notifyListeners('feedbackCleared', {});
  }

  // Import feedback
  importFeedback(data, format = 'json') {
    try {
      let importedData;

      switch (format) {
        case 'json':
          importedData = Array.isArray(data) ? data : JSON.parse(data);
          break;
        default:
          throw new Error(`Unsupported import format: ${format}`);
      }

      // Validate imported data
      const validFeedback = importedData.filter(item => {
        const validation = validateFeedback(item);
        return validation.isValid;
      });

      // Add IDs if missing
      validFeedback.forEach(item => {
        if (!item.id) {
          item.id = this.generateId();
        }
        if (!item.createdAt) {
          item.createdAt = new Date().toISOString();
        }
        if (!item.updatedAt) {
          item.updatedAt = new Date().toISOString();
        }
      });

      this.feedback = [...validFeedback, ...this.feedback];
      this.saveFeedback();
      this.notifyListeners('feedbackImported', { count: validFeedback.length });

      return validFeedback.length;
    } catch (error) {
      console.error('Error importing feedback:', error);
      throw error;
    }
  }
}

// Singleton instance
export const feedbackManager = new FeedbackManager();
