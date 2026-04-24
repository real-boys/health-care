import React, { useState } from 'react';
import { 
  Star, 
  ThumbsUp, 
  ThumbsDown, 
  Flag, 
  Share2, 
  MessageSquare, 
  User, 
  Calendar, 
  ChevronDown,
  ChevronUp,
  CheckCircle,
  XCircle,
  AlertTriangle
} from 'lucide-react';
import { RATING_SCALE, SENTIMENT_LABELS, formatRatingDisplay } from '../../utils/feedbackConfig';
import { sentimentAnalyzer } from '../../utils/sentimentAnalyzer';

const ReviewCard = ({ 
  review, 
  onHelpful, 
  onReport, 
  onReply,
  showFullContent = false,
  className = ""
}) => {
  const [isExpanded, setIsExpanded] = useState(showFullContent);
  const [hasVoted, setHasVoted] = useState(review.userVote || null);
  const [isReporting, setIsReporting] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyText, setReplyText] = useState('');

  const ratingConfig = formatRatingDisplay(review.rating);
  const sentimentConfig = review.sentiment ? SENTIMENT_LABELS[review.sentiment] : null;

  const handleHelpful = (helpful) => {
    if (hasVoted) return;
    
    setHasVoted(helpful ? 'helpful' : 'not_helpful');
    onHelpful?.(review.id, helpful);
  };

  const handleReport = () => {
    if (!reportReason.trim()) return;
    
    setIsReporting(false);
    onReport?.(review.id, reportReason);
    setReportReason('');
  };

  const handleReply = () => {
    if (!replyText.trim()) return;
    
    onReply?.(review.id, replyText);
    setReplyText('');
    setShowReplyForm(false);
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: `Review by ${review.anonymous ? 'Anonymous' : review.authorName}`,
        text: review.comment,
        url: window.location.href
      });
    } else {
      // Fallback to copying to clipboard
      navigator.clipboard.writeText(
        `Review by ${review.anonymous ? 'Anonymous' : review.authorName}:\n\n${review.comment}\n\n${window.location.href}`
      );
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    if (diffDays < 365) return `${Math.floor(diffDays / 30)} months ago`;
    return `${Math.floor(diffDays / 365)} years ago`;
  };

  const truncateText = (text, maxLength = 200) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength) + '...';
  };

  const displayText = isExpanded ? review.comment : truncateText(review.comment);
  const shouldShowExpandButton = review.comment.length > 200;

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow ${className}`}>
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            {/* User Avatar */}
            <div className="flex-shrink-0">
              {review.anonymous ? (
                <div className="w-10 h-10 bg-gray-300 rounded-full flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-600" />
                </div>
              ) : review.authorAvatar ? (
                <img 
                  src={review.authorAvatar} 
                  alt={review.authorName}
                  className="w-10 h-10 rounded-full object-cover"
                />
              ) : (
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center">
                  <span className="text-white font-medium">
                    {review.authorName?.charAt(0)?.toUpperCase()}
                  </span>
                </div>
              )}
            </div>

            {/* User Info */}
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <h4 className="font-semibold text-gray-900">
                  {review.anonymous ? 'Anonymous Review' : review.authorName}
                </h4>
                {review.verified && (
                  <CheckCircle className="w-4 h-4 text-blue-500" title="Verified Review" />
                )}
              </div>
              
              <div className="flex items-center space-x-3 text-sm text-gray-500 mt-1">
                <div className="flex items-center">
                  <Calendar className="w-3 h-3 mr-1" />
                  {formatDate(review.createdAt)}
                </div>
                
                {review.category && (
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                    {review.category}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Rating */}
          <div className="flex flex-col items-end">
            <div className="flex items-center space-x-1">
              <Star 
                size={16} 
                className="fill-yellow-400 text-yellow-400" 
              />
              <span className="font-semibold text-lg" style={{ color: ratingConfig.color }}>
                {review.rating}
              </span>
            </div>
            <span className="text-sm text-gray-500">{ratingConfig.label}</span>
          </div>
        </div>

        {/* Category Ratings */}
        {review.categoryRatings && Object.keys(review.categoryRatings).length > 0 && (
          <div className="mt-4 flex flex-wrap gap-3">
            {Object.entries(review.categoryRatings).map(([categoryId, rating]) => (
              <div key={categoryId} className="flex items-center space-x-1 text-sm">
                <span className="text-gray-600">{categoryId}:</span>
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      size={12}
                      className={star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300'}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* Comment */}
        <div className="text-gray-700 leading-relaxed">
          <p>{displayText}</p>
          
          {shouldShowExpandButton && (
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
            >
              {isExpanded ? (
                <>
                  Show less <ChevronUp className="w-4 h-4 ml-1" />
                </>
              ) : (
                <>
                  Read more <ChevronDown className="w-4 h-4 ml-1" />
                </>
              )}
            </button>
          )}
        </div>

        {/* Sentiment Indicator */}
        {sentimentConfig && (
          <div className="mt-4 flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sentiment:</span>
            <div 
              className="flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium"
              style={{ 
                backgroundColor: `${sentimentConfig.color}20`,
                color: sentimentConfig.color
              }}
            >
              <span>{sentimentConfig.emoji}</span>
              <span>{sentimentConfig.label}</span>
            </div>
          </div>
        )}

        {/* Keywords */}
        {review.keywords && review.keywords.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {review.keywords.slice(0, 5).map((keyword, index) => (
              <span 
                key={index}
                className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium"
              >
                #{keyword}
              </span>
            ))}
          </div>
        )}

        {/* Replies */}
        {review.replies && review.replies.length > 0 && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center text-sm text-gray-500">
              <MessageSquare className="w-4 h-4 mr-1" />
              {review.replies.length} {review.replies.length === 1 ? 'Reply' : 'Replies'}
            </div>
            
            {review.replies.slice(0, isExpanded ? review.replies.length : 2).map((reply, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-start space-x-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-medium">S</span>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <span className="font-medium text-sm">Staff Response</span>
                      <span className="text-xs text-gray-500">{formatDate(reply.createdAt)}</span>
                    </div>
                    <p className="text-sm text-gray-700">{reply.message}</p>
                  </div>
                </div>
              </div>
            ))}
            
            {review.replies.length > 2 && !isExpanded && (
              <button
                onClick={() => setIsExpanded(true)}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                View all {review.replies.length} replies
              </button>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Helpful/Not Helpful */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleHelpful(true)}
                disabled={hasVoted !== null}
                className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  hasVoted === 'helpful'
                    ? 'bg-green-100 text-green-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${hasVoted !== null ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <ThumbsUp className="w-4 h-4" />
                <span>Helpful</span>
                {review.helpfulCount > 0 && (
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs">
                    {review.helpfulCount}
                  </span>
                )}
              </button>
              
              <button
                onClick={() => handleHelpful(false)}
                disabled={hasVoted !== null}
                className={`flex items-center space-x-1 px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                  hasVoted === 'not_helpful'
                    ? 'bg-red-100 text-red-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                } ${hasVoted !== null ? 'cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <ThumbsDown className="w-4 h-4" />
                <span>Not Helpful</span>
                {review.notHelpfulCount > 0 && (
                  <span className="bg-white px-2 py-0.5 rounded-full text-xs">
                    {review.notHelpfulCount}
                  </span>
                )}
              </button>
            </div>

            {/* Reply */}
            {onReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center space-x-1 px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium hover:bg-blue-200 transition-colors"
              >
                <MessageSquare className="w-4 h-4" />
                <span>Reply</span>
              </button>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {/* Share */}
            <button
              onClick={handleShare}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
              title="Share review"
            >
              <Share2 className="w-4 h-4" />
            </button>

            {/* Report */}
            <button
              onClick={() => setIsReporting(true)}
              className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-full transition-colors"
              title="Report review"
            >
              <Flag className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            <textarea
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="Write a response to this review..."
              className="w-full p-3 border border-gray-300 rounded-lg resize-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              rows={3}
            />
            <div className="flex justify-end space-x-2 mt-3">
              <button
                onClick={() => {
                  setShowReplyForm(false);
                  setReplyText('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReply}
                disabled={!replyText.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Post Reply
              </button>
            </div>
          </div>
        )}

        {/* Report Modal */}
        {isReporting && (
          <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
            <h4 className="font-medium text-gray-900 mb-3">Report this review</h4>
            <select
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent mb-3"
            >
              <option value="">Select a reason...</option>
              <option value="spam">Spam or fake review</option>
              <option value="inappropriate">Inappropriate content</option>
              <option value="offensive">Offensive language</option>
              <option value="irrelevant">Irrelevant content</option>
              <option value="personal_info">Contains personal information</option>
              <option value="other">Other</option>
            </select>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => {
                  setIsReporting(false);
                  setReportReason('');
                }}
                className="px-4 py-2 text-gray-600 hover:text-gray-800"
              >
                Cancel
              </button>
              <button
                onClick={handleReport}
                disabled={!reportReason}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Report Review
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReviewCard;
