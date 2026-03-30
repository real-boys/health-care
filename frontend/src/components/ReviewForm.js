import React, { useState } from 'react';
import { Star, Send, AlertCircle, User } from 'lucide-react';
import StarRating from './StarRating';

const ReviewForm = ({
  revieweeId,
  revieweeType,
  onSubmit,
  onCancel,
  initialData = {}
}) => {
  const [formData, setFormData] = useState({
    rating: initialData.rating || 0,
    reviewTitle: initialData.reviewTitle || '',
    reviewText: initialData.reviewText || '',
    reviewCategory: initialData.reviewCategory || 'overall_experience',
    serviceDate: initialData.serviceDate || '',
    isAnonymous: initialData.isAnonymous || false,
    ...initialData
  });

  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const categories = [
    { value: 'service_quality', label: 'Service Quality' },
    { value: 'communication', label: 'Communication' },
    { value: 'timeliness', label: 'Timeliness' },
    { value: 'professionalism', label: 'Professionalism' },
    { value: 'expertise', label: 'Expertise' },
    { value: 'bedside_manner', label: 'Bedside Manner' },
    { value: 'follow_up_care', label: 'Follow-up Care' },
    { value: 'overall_experience', label: 'Overall Experience' }
  ];

  const validateForm = () => {
    const newErrors = {};

    if (!formData.rating) {
      newErrors.rating = 'Please select a rating';
    }

    if (!formData.reviewTitle.trim()) {
      newErrors.reviewTitle = 'Review title is required';
    }

    if (!formData.reviewText.trim()) {
      newErrors.reviewText = 'Review text is required';
    } else if (formData.reviewText.length < 10) {
      newErrors.reviewText = 'Review must be at least 10 characters';
    } else if (formData.reviewText.length > 1000) {
      newErrors.reviewText = 'Review must be less than 1000 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    
    try {
      await onSubmit({
        revieweeId,
        revieweeType,
        ...formData
      });
    } catch (error) {
      console.error('Error submitting review:', error);
      setErrors({ submit: 'Failed to submit review. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Write a Review</h2>
        <p className="text-gray-600">Share your experience to help others make informed decisions</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Rating <span className="text-red-500">*</span>
          </label>
          <div className="flex items-center gap-4">
            <StarRating
              value={formData.rating}
              onChange={(value) => handleInputChange('rating', value)}
              size="lg"
              color="yellow"
            />
            <span className="text-sm text-gray-600">
              {formData.rating === 0 ? 'Select a rating' : `${formData.rating} star${formData.rating !== 1 ? 's' : ''}`}
            </span>
          </div>
          {errors.rating && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.rating}
            </p>
          )}
        </div>

        {/* Review Category */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review Category
          </label>
          <select
            value={formData.reviewCategory}
            onChange={(e) => handleInputChange('reviewCategory', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {categories.map(category => (
              <option key={category.value} value={category.value}>
                {category.label}
              </option>
            ))}
          </select>
        </div>

        {/* Review Title */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.reviewTitle}
            onChange={(e) => handleInputChange('reviewTitle', e.target.value)}
            placeholder="Summarize your experience"
            maxLength={100}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
              errors.reviewTitle ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {errors.reviewTitle && (
            <p className="mt-1 text-sm text-red-600 flex items-center gap-1">
              <AlertCircle className="w-4 h-4" />
              {errors.reviewTitle}
            </p>
          )}
        </div>

        {/* Review Text */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Review Details <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.reviewText}
            onChange={(e) => handleInputChange('reviewText', e.target.value)}
            placeholder="Describe your experience in detail..."
            rows={5}
            maxLength={1000}
            className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none ${
              errors.reviewText ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          <div className="flex justify-between items-center mt-1">
            {errors.reviewText && (
              <p className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {errors.reviewText}
              </p>
            )}
            <span className="text-sm text-gray-500">
              {formData.reviewText.length}/1000 characters
            </span>
          </div>
        </div>

        {/* Service Date */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Service Date
          </label>
          <input
            type="date"
            value={formData.serviceDate}
            onChange={(e) => handleInputChange('serviceDate', e.target.value)}
            max={new Date().toISOString().split('T')[0]}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Anonymous Option */}
        <div className="flex items-center">
          <input
            type="checkbox"
            id="anonymous"
            checked={formData.isAnonymous}
            onChange={(e) => handleInputChange('isAnonymous', e.target.checked)}
            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
          />
          <label htmlFor="anonymous" className="ml-2 text-sm text-gray-700 flex items-center gap-2">
            <User className="w-4 h-4" />
            Post anonymously
          </label>
        </div>

        {/* Error Message */}
        {errors.submit && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-600">{errors.submit}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-4 border-t">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSubmitting ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Submitting...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit Review
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default ReviewForm;
