import React, { useState, useEffect } from 'react';
import { Star, MessageSquare, Send, AlertCircle, CheckCircle, User, Calendar, Tag } from 'lucide-react';
import { FEEDBACK_TYPES, RATING_SCALE, FEEDBACK_CATEGORIES, REVIEW_GUIDELINES, validateFeedback } from '../../utils/feedbackConfig';
import { sentimentAnalyzer } from '../../utils/sentimentAnalyzer';

const FeedbackForm = ({ 
  feedbackType = FEEDBACK_TYPES.PROVIDER_REVIEW, 
  targetId, 
  targetName, 
  onSubmit, 
  onCancel,
  initialData = null 
}) => {
  const [formData, setFormData] = useState({
    type: feedbackType,
    targetId,
    rating: 0,
    comment: '',
    categoryRatings: {},
    anonymous: false,
    followUpRequested: false
  });

  const [errors, setErrors] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);
  const [sentimentAnalysis, setSentimentAnalysis] = useState(null);
  const [characterCount, setCharacterCount] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);

  useEffect(() => {
    if (initialData) {
      setFormData(initialData);
      if (initialData.comment) {
        analyzeSentiment(initialData.comment);
      }
    }
  }, [initialData]);

  useEffect(() => {
    setCharacterCount(formData.comment.length);
  }, [formData.comment]);

  const handleRatingChange = (rating) => {
    setFormData(prev => ({ ...prev, rating }));
    
    // Auto-select category ratings based on overall rating
    const categoryRatings = {};
    Object.keys(FEEDBACK_CATEGORIES).forEach(categoryId => {
      categoryRatings[categoryId] = rating;
    });
    setFormData(prev => ({ ...prev, rating, categoryRatings }));
  };

  const handleCategoryRatingChange = (categoryId, rating) => {
    setFormData(prev => ({
      ...prev,
      categoryRatings: {
        ...prev.categoryRatings,
        [categoryId]: rating
      }
    }));
  };

  const handleCommentChange = (e) => {
    const comment = e.target.value;
    setFormData(prev => ({ ...prev, comment }));
    
    if (comment.length > 0) {
      analyzeSentiment(comment);
    } else {
      setSentimentAnalysis(null);
    }
  };

  const analyzeSentiment = (text) => {
    const analysis = sentimentAnalyzer.generateSummary(text);
    setSentimentAnalysis(analysis);
  };

  const validateForm = () => {
    const validation = validateFeedback(formData);
    setErrors(validation.errors);
    return validation.isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      const submissionData = {
        ...formData,
        sentiment: sentimentAnalysis,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        sessionId: generateSessionId()
      };

      await onSubmit(submissionData);
      setSubmitStatus('success');
      
      // Reset form after successful submission
      setTimeout(() => {
        if (onCancel) onCancel();
      }, 2000);
      
    } catch (error) {
      console.error('Feedback submission error:', error);
      setSubmitStatus('error');
      setErrors(['Failed to submit feedback. Please try again.']);
    } finally {
      setIsSubmitting(false);
    }
  };

  const generateSessionId = () => {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  };

  const getRatingColor = (rating) => {
    const config = Object.values(RATING_SCALE).find(c => c.value === rating);
    return config ? config.color : '#6b7280';
  };

  const getRatingLabel = (rating) => {
    const config = Object.values(RATING_SCALE).find(c => c.value === rating);
    return config ? config.label : '';
  };

  const getCharacterCountColor = () => {
    if (characterCount < REVIEW_GUIDELINES.MIN_LENGTH) return '#ef4444';
    if (characterCount > REVIEW_GUIDELINES.MAX_LENGTH) return '#ef4444';
    return '#6b7280';
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow-lg">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Share Your Feedback
        </h2>
        <p className="text-gray-600">
          Your feedback helps us improve our services. Please rate your experience and share your thoughts.
        </p>
        {targetName && (
          <div className="mt-2 flex items-center text-sm text-gray-500">
            <Tag className="w-4 h-4 mr-1" />
            Reviewing: {targetName}
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Overall Rating */}
        <div className="bg-gray-50 p-6 rounded-lg">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Star className="w-5 h-5 mr-2 text-yellow-500" />
            Overall Rating
          </h3>
          
          <div className="flex items-center space-x-4 mb-4">
            <div className="flex space-x-2">
              {[1, 2, 3, 4, 5].map((rating) => (
                <button
                  key={rating}
                  type="button"
                  onClick={() => handleRatingChange(rating)}
                  onMouseEnter={() => setHoveredRating(rating)}
                  onMouseLeave={() => setHoveredRating(0)}
                  className="p-1 transition-transform hover:scale-110"
                  disabled={isSubmitting}
                >
                  <Star
                    size={32}
                    className={`${
                      rating <= (hoveredRating || formData.rating)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    } transition-colors`}
                  />
                </button>
              ))}
            </div>
            
            {formData.rating > 0 && (
              <div className="flex items-center space-x-2">
                <span 
                  className="text-lg font-semibold"
                  style={{ color: getRatingColor(formData.rating) }}
                >
                  {formData.rating}/5
                </span>
                <span className="text-gray-600">
                  - {getRatingLabel(formData.rating)}
                </span>
              </div>
            )}
          </div>

          {formData.rating === 0 && (
            <p className="text-sm text-gray-500">
              Please select an overall rating
            </p>
          )}
        </div>

        {/* Category Ratings */}
        {formData.rating > 0 && (
          <div className="bg-gray-50 p-6 rounded-lg">
            <h3 className="text-lg font-semibold mb-4">Rate Specific Aspects</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Object.entries(FEEDBACK_CATEGORIES).map(([categoryId, category]) => (
                <div key={categoryId} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="font-medium text-gray-700 flex items-center">
                      <category.icon className="w-4 h-4 mr-2" />
                      {category.name}
                    </label>
                    <span className="text-sm text-gray-500">
                      {formData.categoryRatings[categoryId] || 0}/5
                    </span>
                  </div>
                  <div className="flex space-x-1">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => handleCategoryRatingChange(categoryId, rating)}
                        className="p-1"
                        disabled={isSubmitting}
                      >
                        <Star
                          size={20}
                          className={`${
                            rating <= (formData.categoryRatings[categoryId] || 0)
                              ? 'fill-yellow-400 text-yellow-400'
                              : 'text-gray-300'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Comment */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center">
            <MessageSquare className="w-5 h-5 mr-2 text-blue-500" />
            Detailed Feedback
          </h3>
          
          <div>
            <textarea
              value={formData.comment}
              onChange={handleCommentChange}
              placeholder="Please share your experience in detail. What went well? What could be improved?"
              className="w-full p-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              rows={6}
              maxLength={REVIEW_GUIDELINES.MAX_LENGTH}
              disabled={isSubmitting}
            />
            
            <div className="flex justify-between items-center mt-2">
              <span 
                className="text-sm"
                style={{ color: getCharacterCountColor() }}
              >
                {characterCount} / {REVIEW_GUIDELINES.MAX_LENGTH} characters
                {characterCount < REVIEW_GUIDELINES.MIN_LENGTH && characterCount > 0 && 
                  ` (minimum ${REVIEW_GUIDELINES.MIN_LENGTH} required)`
                }
              </span>
              
              {sentimentAnalysis && (
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-500">Sentiment:</span>
                  <span 
                    className={`text-sm font-medium px-2 py-1 rounded`}
                    style={{ 
                      backgroundColor: `${sentimentAnalysis.sentiment.includes('POSITIVE') ? '#10b981' : 
                                      sentimentAnalysis.sentiment.includes('NEGATIVE') ? '#ef4444' : '#6b7280'}20`,
                      color: sentimentAnalysis.sentiment.includes('POSITIVE') ? '#10b981' : 
                             sentimentAnalysis.sentiment.includes('NEGATIVE') ? '#ef4444' : '#6b7280'
                    }}
                  >
                    {sentimentAnalysis.sentiment.replace('_', ' ')}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Options */}
        <div className="space-y-4">
          <div className="flex items-center space-x-4">
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.anonymous}
                onChange={(e) => setFormData(prev => ({ ...prev, anonymous: e.target.checked }))}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isSubmitting}
              />
              <span className="text-gray-700">Submit anonymously</span>
            </label>
            
            <label className="flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={formData.followUpRequested}
                onChange={(e) => setFormData(prev => ({ ...prev, followUpRequested: e.target.checked }))}
                className="mr-2 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                disabled={isSubmitting}
              />
              <span className="text-gray-700">Request follow-up</span>
            </label>
          </div>
        </div>

        {/* Errors */}
        {errors.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
              <div>
                <p className="font-medium text-red-800 mb-1">Please fix the following issues:</p>
                <ul className="list-disc list-inside text-red-700 space-y-1">
                  {errors.map((error, index) => (
                    <li key={index}>{error}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Success/Error Messages */}
        {submitStatus === 'success' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
              <p className="text-green-800 font-medium">
                Thank you! Your feedback has been submitted successfully.
              </p>
            </div>
          </div>
        )}

        {submitStatus === 'error' && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center">
              <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
              <p className="text-red-800 font-medium">
                There was an error submitting your feedback. Please try again.
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end space-x-4 pt-6 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
              disabled={isSubmitting}
            >
              Cancel
            </button>
          )}
          
          <button
            type="submit"
            disabled={isSubmitting || formData.rating === 0}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center"
          >
            {isSubmitting ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Submit Feedback
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default FeedbackForm;
