import React, { useState, useEffect } from 'react';
import { Star, ThumbsUp, ThumbsDown, MessageSquare, User, Calendar, Filter, ChevronDown, X, Flag, Edit, Trash2 } from 'lucide-react';

const ReviewSystem = ({ providerId, providerName }) => {
  const [reviews, setReviews] = useState([]);
  const [newReview, setNewReview] = useState({
    rating: 0,
    title: '',
    content: '',
    wouldRecommend: true,
    visitDate: '',
    visitType: 'in-person'
  });
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [sortBy, setSortBy] = useState('most-recent');
  const [filterBy, setFilterBy] = useState('all');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [hoveredStar, setHoveredStar] = useState(0);

  const sortOptions = [
    { value: 'most-recent', label: 'Most Recent' },
    { value: 'most-helpful', label: 'Most Helpful' },
    { value: 'highest-rated', label: 'Highest Rated' },
    { value: 'lowest-rated', label: 'Lowest Rated' }
  ];

  const filterOptions = [
    { value: 'all', label: 'All Reviews' },
    { value: '5-star', label: '5 Stars' },
    { value: '4-star', label: '4 Stars' },
    { value: '3-star', label: '3 Stars' },
    { value: '2-star', label: '2 Stars' },
    { value: '1-star', label: '1 Star' },
    { value: 'recommended', label: 'Would Recommend' },
    { value: 'not-recommended', label: 'Would Not Recommend' }
  ];

  useEffect(() => {
    loadReviews();
  }, [providerId, sortBy, filterBy]);

  const loadReviews = async () => {
    setLoading(true);
    try {
      const mockReviews = [
        {
          id: 1,
          patientName: 'Sarah Johnson',
          rating: 5,
          title: 'Excellent Cardiologist!',
          content: 'Dr. Chen is an exceptional cardiologist. She took the time to explain my condition thoroughly and answered all my questions. The office staff was also very professional and accommodating. I highly recommend her!',
          wouldRecommend: true,
          visitDate: '2024-03-15',
          visitType: 'in-person',
          helpfulCount: 24,
          notHelpfulCount: 2,
          verified: true,
          createdAt: '2024-03-16T10:30:00Z',
          response: {
            content: 'Thank you so much for your kind words, Sarah! We\'re thrilled to hear about your positive experience. Your health is our top priority.',
            createdAt: '2024-03-17T14:20:00Z'
          }
        },
        {
          id: 2,
          patientName: 'Michael Davis',
          rating: 4,
          title: 'Very professional and knowledgeable',
          content: 'Dr. Chen diagnosed my heart condition accurately and prescribed the right treatment. The only reason I\'m giving 4 stars instead of 5 is because the wait time was a bit longer than expected. Otherwise, excellent care.',
          wouldRecommend: true,
          visitDate: '2024-02-28',
          visitType: 'in-person',
          helpfulCount: 18,
          notHelpfulCount: 3,
          verified: true,
          createdAt: '2024-03-01T09:15:00Z'
        },
        {
          id: 3,
          patientName: 'Emily Rodriguez',
          rating: 5,
          title: 'Life-changing experience',
          content: 'After seeing multiple doctors for my heart palpitations, Dr. Chen was the first to properly diagnose and treat my condition. Her expertise and compassionate care made all the difference. I\'m finally feeling like myself again!',
          wouldRecommend: true,
          visitDate: '2024-01-20',
          visitType: 'video',
          helpfulCount: 31,
          notHelpfulCount: 1,
          verified: true,
          createdAt: '2024-01-22T16:45:00Z'
        },
        {
          id: 4,
          patientName: 'Robert Thompson',
          rating: 3,
          title: 'Good doctor but communication could be better',
          content: 'Dr. Chen seems very knowledgeable and I trust her medical expertise. However, I sometimes felt rushed during appointments and had to ask for clarification on treatment options. The medical care is good, but the patient experience could be improved.',
          wouldRecommend: false,
          visitDate: '2023-12-10',
          visitType: 'in-person',
          helpfulCount: 12,
          notHelpfulCount: 8,
          verified: false,
          createdAt: '2023-12-12T11:30:00Z'
        },
        {
          id: 5,
          patientName: 'Lisa Chen',
          rating: 5,
          title: 'Outstanding care and expertise',
          content: 'As a healthcare professional myself, I have high standards for doctors. Dr. Chen exceeds all expectations. Her diagnostic skills are superb, and she stays current with the latest treatments. The follow-up care is also excellent.',
          wouldRecommend: true,
          visitDate: '2023-11-15',
          visitType: 'in-person',
          helpfulCount: 28,
          notHelpfulCount: 0,
          verified: true,
          createdAt: '2023-11-17T13:20:00Z',
          response: {
            content: 'Thank you for your thoughtful review, Lisa. We appreciate your feedback and are glad you had a positive experience with our care.',
            createdAt: '2023-11-18T10:15:00Z'
          }
        }
      ];

      let filteredReviews = mockReviews;

      // Apply filters
      if (filterBy !== 'all') {
        if (filterBy.includes('star')) {
          const rating = parseInt(filterBy.split('-')[0]);
          filteredReviews = filteredReviews.filter(review => review.rating === rating);
        } else if (filterBy === 'recommended') {
          filteredReviews = filteredReviews.filter(review => review.wouldRecommend);
        } else if (filterBy === 'not-recommended') {
          filteredReviews = filteredReviews.filter(review => !review.wouldRecommend);
        }
      }

      // Apply sorting
      filteredReviews.sort((a, b) => {
        switch (sortBy) {
          case 'most-recent':
            return new Date(b.createdAt) - new Date(a.createdAt);
          case 'most-helpful':
            return (b.helpfulCount - b.notHelpfulCount) - (a.helpfulCount - a.notHelpfulCount);
          case 'highest-rated':
            return b.rating - a.rating;
          case 'lowest-rated':
            return a.rating - b.rating;
          default:
            return 0;
        }
      });

      setReviews(filteredReviews);
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async () => {
    if (newReview.rating === 0 || !newReview.title.trim() || !newReview.content.trim()) {
      return;
    }

    setSubmitting(true);
    try {
      const review = {
        id: reviews.length + 1,
        patientName: 'Anonymous Patient',
        rating: newReview.rating,
        title: newReview.title,
        content: newReview.content,
        wouldRecommend: newReview.wouldRecommend,
        visitDate: newReview.visitDate,
        visitType: newReview.visitType,
        helpfulCount: 0,
        notHelpfulCount: 0,
        verified: false,
        createdAt: new Date().toISOString()
      };

      await new Promise(resolve => setTimeout(resolve, 1000));
      setReviews([review, ...reviews]);
      setNewReview({
        rating: 0,
        title: '',
        content: '',
        wouldRecommend: true,
        visitDate: '',
        visitType: 'in-person'
      });
      setShowReviewForm(false);
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleHelpful = (reviewId, isHelpful) => {
    setReviews(reviews.map(review => {
      if (review.id === reviewId) {
        return {
          ...review,
          helpfulCount: isHelpful ? review.helpfulCount + 1 : review.helpfulCount,
          notHelpfulCount: !isHelpful ? review.notHelpfulCount + 1 : review.notHelpfulCount
        };
      }
      return review;
    }));
  };

  const renderStars = (rating, interactive = false, size = 'normal') => {
    const starSize = size === 'small' ? 'w-4 h-4' : 'w-5 h-5';
    
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${starSize} ${
              star <= rating
                ? 'text-yellow-400 fill-current'
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
            onClick={() => interactive && setNewReview({...newReview, rating: star})}
            onMouseEnter={() => interactive && setHoveredStar(star)}
            onMouseLeave={() => interactive && setHoveredStar(0)}
          />
        ))}
        {interactive && (
          <span className="ml-2 text-sm text-gray-600">
            {hoveredStar > 0 ? hoveredStar : rating}
          </span>
        )}
      </div>
    );
  };

  const calculateRatingStats = () => {
    if (reviews.length === 0) return { average: 0, distribution: [0, 0, 0, 0, 0] };
    
    const total = reviews.reduce((sum, review) => sum + review.rating, 0);
    const average = total / reviews.length;
    
    const distribution = [0, 0, 0, 0, 0];
    reviews.forEach(review => {
      distribution[5 - review.rating]++;
    });
    
    return { average, distribution };
  };

  const stats = calculateRatingStats();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Patient Reviews</h2>
        <p className="text-gray-600">Read what patients are saying about {providerName}</p>
      </div>

      {/* Rating Summary */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="text-center">
            <div className="text-5xl font-bold text-gray-900 mb-2">
              {stats.average.toFixed(1)}
            </div>
            <div className="flex justify-center mb-2">
              {renderStars(Math.round(stats.average))}
            </div>
            <div className="text-gray-600">
              Based on {reviews.length} review{reviews.length !== 1 ? 's' : ''}
            </div>
          </div>
          
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map((rating) => {
              const count = stats.distribution[5 - rating];
              const percentage = reviews.length > 0 ? (count / reviews.length) * 100 : 0;
              
              return (
                <div key={rating} className="flex items-center space-x-3">
                  <div className="flex items-center space-x-1 w-20">
                    <span className="text-sm">{rating}</span>
                    <Star className="w-4 h-4 text-yellow-400 fill-current" />
                  </div>
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-yellow-400 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <div className="text-sm text-gray-600 w-12 text-right">
                    {count}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        
        <div className="mt-6 pt-6 border-t border-gray-200">
          <button
            onClick={() => setShowReviewForm(!showReviewForm)}
            className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Write a Review
          </button>
        </div>
      </div>

      {/* Review Form */}
      {showReviewForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-semibold">Write Your Review</h3>
            <button
              onClick={() => setShowReviewForm(false)}
              className="p-1 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Overall Rating *
              </label>
              {renderStars(newReview.rating, true)}
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Review Title *
              </label>
              <input
                type="text"
                value={newReview.title}
                onChange={(e) => setNewReview({...newReview, title: e.target.value})}
                placeholder="Summarize your experience..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Review *
              </label>
              <textarea
                value={newReview.content}
                onChange={(e) => setNewReview({...newReview, content: e.target.value})}
                placeholder="Share details about your visit..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                rows={4}
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visit Date
                </label>
                <input
                  type="date"
                  value={newReview.visitDate}
                  onChange={(e) => setNewReview({...newReview, visitDate: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Visit Type
                </label>
                <select
                  value={newReview.visitType}
                  onChange={(e) => setNewReview({...newReview, visitType: e.target.value})}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  <option value="in-person">In-Person</option>
                  <option value="video">Video Consultation</option>
                  <option value="phone">Phone Call</option>
                </select>
              </div>
            </div>
            
            <div>
              <label className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  checked={newReview.wouldRecommend}
                  onChange={(e) => setNewReview({...newReview, wouldRecommend: e.target.checked})}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">
                  I would recommend this provider to friends and family
                </span>
              </label>
            </div>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowReviewForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                disabled={submitting || newReview.rating === 0 || !newReview.title.trim() || !newReview.content.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit Review'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters and Sorting */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 space-y-4 sm:space-y-0">
        <div className="flex items-center space-x-4">
          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500"
            >
              {sortOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" />
          </div>
          
          <div className="relative">
            <select
              value={filterBy}
              onChange={(e) => setFilterBy(e.target.value)}
              className="appearance-none bg-white border border-gray-300 rounded-lg px-4 py-2 pr-8 focus:ring-2 focus:ring-blue-500"
            >
              {filterOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 pointer-events-none" />
          </div>
        </div>
        
        <div className="text-sm text-gray-600">
          Showing {reviews.length} review{reviews.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Reviews List */}
      <div className="space-y-6">
        {reviews.map(review => (
          <div key={review.id} className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-semibold text-gray-900">{review.patientName}</h4>
                    {review.verified && (
                      <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full">
                        Verified Patient
                      </span>
                    )}
                  </div>
                  <div className="flex items-center space-x-4 text-sm text-gray-600 mt-1">
                    {renderStars(review.rating, false, 'small')}
                    <span>{review.visitType === 'in-person' ? 'In-Person' : review.visitType === 'video' ? 'Video' : 'Phone'}</span>
                    {review.visitDate && (
                      <span className="flex items-center space-x-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(review.visitDate).toLocaleDateString()}</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <button className="p-1 text-gray-400 hover:text-gray-600">
                  <Flag className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <h5 className="font-semibold text-gray-900 mb-2">{review.title}</h5>
              <p className="text-gray-700 leading-relaxed">{review.content}</p>
            </div>
            
            {review.wouldRecommend !== undefined && (
              <div className="mb-4">
                <div className={`inline-flex items-center space-x-1 px-3 py-1 rounded-full text-sm ${
                  review.wouldRecommend 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {review.wouldRecommend ? (
                    <>
                      <ThumbsUp className="w-3 h-3" />
                      <span>Would Recommend</span>
                    </>
                  ) : (
                    <>
                      <ThumbsDown className="w-3 h-3" />
                      <span>Would Not Recommend</span>
                    </>
                  )}
                </div>
              </div>
            )}
            
            {review.response && (
              <div className="bg-blue-50 rounded-lg p-4 mb-4">
                <div className="flex items-start space-x-2">
                  <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs font-bold">P</span>
                  </div>
                  <div className="flex-1">
                    <div className="font-semibold text-blue-900 mb-1">
                      Provider Response
                    </div>
                    <p className="text-blue-800 text-sm">{review.response.content}</p>
                    <div className="text-xs text-blue-600 mt-2">
                      {new Date(review.response.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
              <div className="flex items-center space-x-4">
                <div className="text-sm text-gray-500">
                  {new Date(review.createdAt).toLocaleDateString()}
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Was this helpful?</span>
                  <button
                    onClick={() => handleHelpful(review.id, true)}
                    className="flex items-center space-x-1 text-sm text-gray-600 hover:text-green-600"
                  >
                    <ThumbsUp className="w-3 h-3" />
                    <span>Yes ({review.helpfulCount})</span>
                  </button>
                  <button
                    onClick={() => handleHelpful(review.id, false)}
                    className="flex items-center space-x-1 text-sm text-gray-600 hover:text-red-600"
                  >
                    <ThumbsDown className="w-3 h-3" />
                    <span>No ({review.notHelpfulCount})</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {reviews.length === 0 && (
        <div className="text-center py-12">
          <MessageSquare className="w-16 h-16 mx-auto text-gray-300 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Reviews Yet</h3>
          <p className="text-gray-600">Be the first to share your experience with {providerName}</p>
        </div>
      )}
    </div>
  );
};

export default ReviewSystem;
