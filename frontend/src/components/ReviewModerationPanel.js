import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  XCircle, 
  Eye, 
  MessageSquare,
  Filter,
  Search,
  ChevronDown,
  User,
  Calendar,
  Flag,
  Download
} from 'lucide-react';
import ReviewCard from './ReviewCard';

const ReviewModerationPanel = ({ currentUser }) => {
  const [reviews, setReviews] = useState([]);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState(null);
  const [filters, setFilters] = useState({
    status: 'pending',
    rating: 'all',
    category: 'all',
    dateRange: 'all'
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [selectedReviews, setSelectedReviews] = useState([]);

  useEffect(() => {
    fetchModerationData();
  }, [filters, searchTerm]);

  const fetchModerationData = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      };

      // Fetch reviews needing moderation
      const params = new URLSearchParams({
        moderationStatus: filters.status,
        ...(filters.rating !== 'all' && { rating: filters.rating }),
        ...(filters.category !== 'all' && { category: filters.category }),
        ...(searchTerm && { search: searchTerm })
      });

      const reviewsResponse = await fetch(`/api/reputation/reviews/moderation?${params}`, {
        headers
      });
      
      if (reviewsResponse.ok) {
        const reviewsData = await reviewsResponse.json();
        setReviews(reviewsData.reviews || []);
      }

      // Fetch reports
      const reportsResponse = await fetch('/api/reputation/reports', {
        headers
      });
      
      if (reportsResponse.ok) {
        const reportsData = await reportsResponse.json();
        setReports(reportsData.reports || []);
      }

    } catch (error) {
      console.error('Error fetching moderation data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleModerationAction = async (reviewId, action, notes = '') => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/reputation/review/${reviewId}/moderate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action, notes, moderatedBy: currentUser.id })
      });

      if (response.ok) {
        fetchModerationData();
        setSelectedReview(null);
      }
    } catch (error) {
      console.error('Error moderating review:', error);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedReviews.length === 0) return;

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/reputation/reviews/bulk-moderate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          reviewIds: selectedReviews,
          action: bulkAction,
          moderatedBy: currentUser.id
        })
      });

      if (response.ok) {
        fetchModerationData();
        setSelectedReviews([]);
        setBulkAction('');
      }
    } catch (error) {
      console.error('Error performing bulk action:', error);
    }
  };

  const getStatusColor = (status) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800',
      approved: 'bg-green-100 text-green-800',
      rejected: 'bg-red-100 text-red-800',
      flagged: 'bg-orange-100 text-orange-800'
    };
    return colors[status] || colors.pending;
  };

  const getReportCount = (reviewId) => {
    return reports.filter(report => report.review_id === reviewId).length;
  };

  const getReportReasons = (reviewId) => {
    return reports
      .filter(report => report.review_id === reviewId)
      .map(report => report.report_reason);
  };

  const filteredReviews = reviews.filter(review => {
    const matchesSearch = !searchTerm || 
      review.review_title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.review_text?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      review.reviewer_name?.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesSearch;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Shield className="w-6 h-6" />
              Review Moderation
            </h1>
            <p className="text-gray-600 mt-1">Manage and moderate user reviews</p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm">
              <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
                {reviews.filter(r => r.moderation_status === 'pending').length} Pending
              </span>
              <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full">
                {reports.filter(r => r.report_status === 'pending').length} Reports
              </span>
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="mt-6 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search reviews..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="flagged">Flagged</option>
                  <option value="all">All</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rating</label>
                <select
                  value={filters.rating}
                  onChange={(e) => setFilters(prev => ({ ...prev, rating: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Ratings</option>
                  <option value="5">5 Stars</option>
                  <option value="4">4 Stars</option>
                  <option value="3">3 Stars</option>
                  <option value="2">2 Stars</option>
                  <option value="1">1 Star</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Categories</option>
                  <option value="service_quality">Service Quality</option>
                  <option value="communication">Communication</option>
                  <option value="professionalism">Professionalism</option>
                  <option value="expertise">Expertise</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date Range</label>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters(prev => ({ ...prev, dateRange: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="all">All Time</option>
                  <option value="today">Today</option>
                  <option value="week">This Week</option>
                  <option value="month">This Month</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedReviews.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex justify-between items-center">
            <span className="text-sm text-blue-800">
              {selectedReviews.length} review{selectedReviews.length !== 1 ? 's' : ''} selected
            </span>
            
            <div className="flex items-center gap-3">
              <select
                value={bulkAction}
                onChange={(e) => setBulkAction(e.target.value)}
                className="px-3 py-1 border border-blue-300 rounded-md text-sm bg-white"
              >
                <option value="">Choose action...</option>
                <option value="approve">Approve</option>
                <option value="reject">Reject</option>
                <option value="flag">Flag</option>
              </select>
              
              <button
                onClick={handleBulkAction}
                disabled={!bulkAction}
                className="px-4 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Apply Action
              </button>
              
              <button
                onClick={() => setSelectedReviews([])}
                className="text-blue-600 hover:text-blue-700 text-sm"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reviews List */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900">
              Reviews ({filteredReviews.length})
            </h2>
            
            <button className="flex items-center gap-2 px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-50">
              <Download className="w-4 h-4" />
              Export
            </button>
          </div>

          {filteredReviews.length === 0 ? (
            <div className="text-center py-12">
              <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No reviews found matching your criteria</p>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredReviews.map(review => {
                const reportCount = getReportCount(review.id);
                const reportReasons = getReportReasons(review.id);
                
                return (
                  <div key={review.id} className="border border-gray-200 rounded-lg p-4">
                    {/* Review Header */}
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <input
                          type="checkbox"
                          checked={selectedReviews.includes(review.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedReviews(prev => [...prev, review.id]);
                            } else {
                              setSelectedReviews(prev => prev.filter(id => id !== review.id));
                            }
                          }}
                          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(review.moderation_status)}`}>
                            {review.moderation_status.replace('_', ' ')}
                          </span>
                          {reportCount > 0 && (
                            <span className="flex items-center gap-1 px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                              <Flag className="w-3 h-3" />
                              {reportCount} report{reportCount !== 1 ? 's' : ''}
                            </span>
                          )}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedReview(review)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Eye className="w-4 h-4 text-gray-600" />
                        </button>
                        
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Calendar className="w-4 h-4" />
                          {new Date(review.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    {/* Review Preview */}
                    <div className="mb-3">
                      <h4 className="font-medium text-gray-900 mb-1">
                        {review.review_title}
                      </h4>
                      <p className="text-sm text-gray-600 line-clamp-2">
                        {review.review_text}
                      </p>
                    </div>

                    {/* Report Reasons */}
                    {reportReasons.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm font-medium text-gray-700 mb-1">Report Reasons:</p>
                        <div className="flex flex-wrap gap-1">
                          {reportReasons.map((reason, index) => (
                            <span key={index} className="px-2 py-1 bg-red-50 text-red-700 text-xs rounded">
                              {reason.replace('_', ' ')}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Moderation Actions */}
                    <div className="flex justify-end gap-2 pt-3 border-t">
                      <button
                        onClick={() => handleModerationAction(review.id, 'approve')}
                        className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      
                      <button
                        onClick={() => handleModerationAction(review.id, 'reject')}
                        className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                      
                      <button
                        onClick={() => handleModerationAction(review.id, 'flag')}
                        className="flex items-center gap-1 px-3 py-1 bg-orange-600 text-white text-sm rounded hover:bg-orange-700"
                      >
                        <AlertTriangle className="w-4 h-4" />
                        Flag
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Review Detail Modal */}
      {selectedReview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl max-h-[90vh] overflow-y-auto m-4">
            <div className="sticky top-0 bg-white border-b p-6">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-semibold text-gray-900">Review Details</h2>
                <button
                  onClick={() => setSelectedReview(null)}
                  className="p-2 hover:bg-gray-100 rounded"
                >
                  <XCircle className="w-5 h-5 text-gray-600" />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <ReviewCard
                review={selectedReview}
                currentUser={currentUser}
                showActions={false}
              />
              
              {/* Moderation Notes */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                <h3 className="font-medium text-gray-900 mb-3">Moderation Actions</h3>
                <div className="space-y-3">
                  <textarea
                    placeholder="Add moderation notes..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md resize-none"
                    rows={3}
                  />
                  
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => setSelectedReview(null)}
                      className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
                    >
                      Cancel
                    </button>
                    
                    <button
                      onClick={() => handleModerationAction(selectedReview.id, 'approve')}
                      className="flex items-center gap-1 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Approve
                    </button>
                    
                    <button
                      onClick={() => handleModerationAction(selectedReview.id, 'reject')}
                      className="flex items-center gap-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      <XCircle className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReviewModerationPanel;
