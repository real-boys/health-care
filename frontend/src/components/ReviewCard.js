import React, { useState } from 'react';
import { Star, ThumbsUp, ThumbsDown, Flag, User, Calendar, MessageSquare } from 'lucide-react';
import StarRating from './StarRating';

const ReviewCard = ({
  review,
  currentUser,
  onVote,
  onReport,
  onReply,
  showActions = true,
  className = ''
}) => {
  const [isVoting, setIsVoting] = useState(false);
  const [isReporting, setIsReporting] = useState(false);
  const [showFullText, setShowFullText] = useState(false);

  const categories = {
    service_quality: 'Service Quality',
    communication: 'Communication',
    timeliness: 'Timeliness',
    professionalism: 'Professionalism',
    expertise: 'Expertise',
    bedside_manner: 'Bedside Manner',
    follow_up_care: 'Follow-up Care',
    overall_experience: 'Overall Experience'
  };

  const handleVote = async (voteType) => {
    if (isVoting) return;
    
    setIsVoting(true);
    try {
      await onVote(review.id, voteType);
    } catch (error) {
      console.error('Error voting:', error);
    } finally {
      setIsVoting(false);
    }
  };

  const handleReport = async (reason) => {
    if (isReporting) return;
    
    setIsReporting(true);
    try {
      await onReport(review.id, reason);
    } catch (error) {
      console.error('Error reporting:', error);
    } finally {
      setIsReporting(false);
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const truncateText = (text, maxLength = 200) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  const displayText = showFullText ? review.review_text : truncateText(review.review_text);

  return (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow ${className}`}>
      {/* Header */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center">
            <User className="w-5 h-5 text-gray-600" />
          </div>
          <div>
            <h4 className="font-semibold text-gray-900">
              {review.is_anonymous ? 'Anonymous' : review.reviewer_name}
            </h4>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Calendar className="w-4 h-4" />
              {formatDate(review.created_at)}
              {review.service_date && (
                <span>• Service: {formatDate(review.service_date)}</span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="px-2 py-1 bg-blue-50 text-blue-700 text-xs font-medium rounded-full">
            {categories[review.review_category]}
          </span>
          {review.is_verified && (
            <span className="px-2 py-1 bg-green-50 text-green-700 text-xs font-medium rounded-full">
              Verified
            </span>
          )}
        </div>
      </div>

      {/* Rating */}
      <div className="mb-4">
        <StarRating
          value={review.rating}
          size="sm"
          readonly
          showValue={false}
        />
      </div>

      {/* Review Title */}
      {review.review_title && (
        <h3 className="text-lg font-semibold text-gray-900 mb-2">
          {review.review_title}
        </h3>
      )}

      {/* Review Text */}
      <div className="text-gray-700 mb-4">
        <p className="leading-relaxed">
          {displayText}
        </p>
        {review.review_text.length > 200 && (
          <button
            onClick={() => setShowFullText(!showFullText)}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium mt-2"
          >
            {showFullText ? 'Show less' : 'Read more'}
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-1">
          <ThumbsUp className="w-4 h-4" />
          <span>{review.helpful_votes || 0} helpful</span>
        </div>
        {review.report_count > 0 && (
          <div className="flex items-center gap-1 text-red-500">
            <Flag className="w-4 h-4" />
            <span>{review.report_count} reports</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && currentUser && currentUser.id !== review.reviewer_id && (
        <div className="flex items-center gap-2 pt-4 border-t">
          <button
            onClick={() => handleVote('helpful')}
            disabled={isVoting}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
              isVoting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ThumbsUp className="w-4 h-4" />
            Helpful
          </button>
          
          <button
            onClick={() => handleVote('not_helpful')}
            disabled={isVoting}
            className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
              isVoting
                ? 'opacity-50 cursor-not-allowed'
                : 'hover:bg-gray-100 text-gray-700'
            }`}
          >
            <ThumbsDown className="w-4 h-4" />
            Not Helpful
          </button>

          <div className="relative">
            <button
              onClick={() => {
                const reason = prompt('Report reason (spam, fake_review, inappropriate_content, conflict_of_interest, personal_info, harassment, other):');
                if (reason) {
                  handleReport(reason);
                }
              }}
              disabled={isReporting}
              className={`flex items-center gap-2 px-3 py-1 rounded-md text-sm transition-colors ${
                isReporting
                  ? 'opacity-50 cursor-not-allowed'
                  : 'hover:bg-red-50 text-red-600'
              }`}
            >
              <Flag className="w-4 h-4" />
              Report
            </button>
          </div>

          {onReply && (
            <button
              onClick={() => onReply(review)}
              className="flex items-center gap-2 px-3 py-1 rounded-md text-sm hover:bg-gray-100 text-gray-700 transition-colors"
            >
              <MessageSquare className="w-4 h-4" />
              Reply
            </button>
          )}
        </div>
      )}

      {/* Moderation Status */}
      {review.moderation_status !== 'approved' && (
        <div className="mt-4 p-2 bg-yellow-50 border border-yellow-200 rounded-md">
          <p className="text-sm text-yellow-700">
            Status: {review.moderation_status.replace('_', ' ')}
            {review.moderation_notes && ` - ${review.moderation_notes}`}
          </p>
        </div>
      )}
    </div>
  );
};

export default ReviewCard;
