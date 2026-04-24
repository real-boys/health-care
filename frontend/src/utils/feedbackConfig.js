export const FEEDBACK_TYPES = {
  PROVIDER_REVIEW: 'provider_review',
  SERVICE_REVIEW: 'service_review',
  PLATFORM_REVIEW: 'platform_review',
  PATIENT_EXPERIENCE: 'patient_experience',
  CLAIM_FEEDBACK: 'claim_feedback',
  BILLING_FEEDBACK: 'billing_feedback',
  SUPPORT_TICKET: 'support_ticket',
  GENERAL_FEEDBACK: 'general_feedback'
};

export const RATING_SCALE = {
  ONE_STAR: { value: 1, label: 'Poor', color: '#ef4444', description: 'Very dissatisfied' },
  TWO_STAR: { value: 2, label: 'Fair', color: '#f97316', description: 'Dissatisfied' },
  THREE_STAR: { value: 3, label: 'Good', color: '#eab308', description: 'Neutral' },
  FOUR_STAR: { value: 4, label: 'Very Good', color: '#22c55e', description: 'Satisfied' },
  FIVE_STAR: { value: 5, label: 'Excellent', color: '#10b981', description: 'Very satisfied' }
};

export const SENTIMENT_LABELS = {
  VERY_NEGATIVE: { label: 'Very Negative', score: -1.0, color: '#dc2626', emoji: ' very dissatisfied' },
  NEGATIVE: { label: 'Negative', score: -0.5, color: '#ef4444', emoji: ' dissatisfied' },
  NEUTRAL: { label: 'Neutral', score: 0.0, color: '#6b7280', emoji: ' neutral' },
  POSITIVE: { label: 'Positive', score: 0.5, color: '#22c55e', emoji: ' satisfied' },
  VERY_POSITIVE: { label: 'Very Positive', score: 1.0, color: '#10b981', emoji: ' very satisfied' }
};

export const FEEDBACK_CATEGORIES = {
  SERVICE_QUALITY: {
    id: 'service_quality',
    name: 'Service Quality',
    icon: 'star',
    weight: 0.3,
    questions: [
      'How would you rate the overall quality of service?',
      'Was the service delivered in a timely manner?',
      'Did the service meet your expectations?'
    ]
  },
  STAFF_PROFESSIONALISM: {
    id: 'staff_professionalism',
    name: 'Staff Professionalism',
    icon: 'users',
    weight: 0.25,
    questions: [
      'How would you rate the professionalism of our staff?',
      'Were the staff knowledgeable and helpful?',
      'Did you feel respected and valued?'
    ]
  },
  FACILITY_ENVIRONMENT: {
    id: 'facility_environment',
    name: 'Facility Environment',
    icon: 'building',
    weight: 0.2,
    questions: [
      'How would you rate the cleanliness of our facility?',
      'Was the environment comfortable and welcoming?',
      'Were the facilities well-maintained?'
    ]
  },
  COMMUNICATION: {
    id: 'communication',
    name: 'Communication',
    icon: 'message-circle',
    weight: 0.15,
    questions: [
      'How would you rate the clarity of communication?',
      'Were you kept informed about your care/treatment?',
      'Were your questions answered satisfactorily?'
    ]
  },
  VALUE_FOR_MONEY: {
    id: 'value_for_money',
    name: 'Value for Money',
    icon: 'dollar-sign',
    weight: 0.1,
    questions: [
      'How would you rate the value for money?',
      'Were the costs transparent and reasonable?',
      'Do you feel you received good value for the price paid?'
    ]
  }
};

export const REVIEW_GUIDELINES = {
  MIN_LENGTH: 50,
  MAX_LENGTH: 2000,
  PROFANITY_FILTER: true,
  SPAM_DETECTION: true,
  DUPLICATE_CHECK: true,
  MODERATION_REQUIRED: false,
  AUTO_APPROVE_THRESHOLD: 4.0
};

export const ANALYTICS_CONFIG = {
  SENTIMENT_ANALYSIS: {
    ENABLED: true,
    MODEL: 'healthcare_sentiment_v2',
    CONFIDENCE_THRESHOLD: 0.7,
    LANGUAGES: ['en', 'es', 'fr', 'de', 'zh', 'ja']
  },
  KEYWORD_EXTRACTION: {
    ENABLED: true,
    MAX_KEYWORDS: 10,
    MIN_FREQUENCY: 2
  },
  TOPIC_MODELING: {
    ENABLED: true,
    TOPICS: ['care_quality', 'staff_attitude', 'wait_times', 'billing', 'facilities', 'communication'],
    CONFIDENCE_THRESHOLD: 0.6
  },
  TREND_ANALYSIS: {
    WINDOW_SIZE: 30, // days
    MIN_SAMPLES: 10,
    SIGNIFICANCE_THRESHOLD: 0.05
  }
};

export const generateFeedbackId = () => {
  return `fb_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

export const calculateOverallRating = (ratings) => {
  if (!ratings || ratings.length === 0) return 0;
  
  const sum = ratings.reduce((acc, rating) => acc + rating.value, 0);
  return Math.round((sum / ratings.length) * 100) / 100;
};

export const calculateWeightedScore = (categoryScores) => {
  let totalScore = 0;
  let totalWeight = 0;
  
  Object.entries(categoryScores).forEach(([categoryId, score]) => {
    const category = FEEDBACK_CATEGORIES[categoryId];
    if (category) {
      totalScore += score * category.weight;
      totalWeight += category.weight;
    }
  });
  
  return totalWeight > 0 ? Math.round((totalScore / totalWeight) * 100) / 100 : 0;
};

export const determineSentiment = (score) => {
  if (score <= -0.75) return SENTIMENT_LABELS.VERY_NEGATIVE;
  if (score <= -0.25) return SENTIMENT_LABELS.NEGATIVE;
  if (score <= 0.25) return SENTIMENT_LABELS.NEUTRAL;
  if (score <= 0.75) return SENTIMENT_LABELS.POSITIVE;
  return SENTIMENT_LABELS.VERY_POSITIVE;
};

export const validateFeedback = (feedback) => {
  const errors = [];
  
  if (!feedback.type) {
    errors.push('Feedback type is required');
  }
  
  if (!feedback.rating || feedback.rating < 1 || feedback.rating > 5) {
    errors.push('Valid rating (1-5) is required');
  }
  
  if (feedback.comment) {
    if (feedback.comment.length < REVIEW_GUIDELINES.MIN_LENGTH) {
      errors.push(`Comment must be at least ${REVIEW_GUIDELINES.MIN_LENGTH} characters`);
    }
    
    if (feedback.comment.length > REVIEW_GUIDELINES.MAX_LENGTH) {
      errors.push(`Comment must not exceed ${REVIEW_GUIDELINES.MAX_LENGTH} characters`);
    }
  }
  
  if (!feedback.userId) {
    errors.push('User ID is required');
  }
  
  if (!feedback.targetId) {
    errors.push('Target ID (provider/service) is required');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export const formatRatingDisplay = (rating) => {
  const config = Object.values(RATING_SCALE).find(c => c.value === Math.round(rating));
  return config || RATING_SCALE.THREE_STAR;
};

export const getTrendIndicator = (current, previous) => {
  if (!previous || previous === 0) return 'stable';
  
  const change = ((current - previous) / previous) * 100;
  
  if (change > 5) return { direction: 'up', value: Math.round(change), color: '#22c55e' };
  if (change < -5) return { direction: 'down', value: Math.round(Math.abs(change)), color: '#ef4444' };
  
  return { direction: 'stable', value: 0, color: '#6b7280' };
};

export const exportFeedbackData = (feedbackData, format = 'json') => {
  const exportData = {
    metadata: {
      exportDate: new Date().toISOString(),
      totalRecords: feedbackData.length,
      format: format
    },
    data: feedbackData.map(feedback => ({
      id: feedback.id,
      type: feedback.type,
      rating: feedback.rating,
      sentiment: feedback.sentiment?.label,
      comment: feedback.comment,
      userId: feedback.userId,
      targetId: feedback.targetId,
      createdAt: feedback.createdAt,
      verified: feedback.verified,
      helpful: feedback.helpfulCount
    }))
  };
  
  switch (format) {
    case 'csv':
      return convertToCSV(exportData.data);
    case 'xlsx':
      return convertToXLSX(exportData.data);
    default:
      return JSON.stringify(exportData, null, 2);
  }
};

const convertToCSV = (data) => {
  if (data.length === 0) return '';
  
  const headers = Object.keys(data[0]);
  const csvHeaders = headers.join(',');
  
  const csvRows = data.map(row => 
    headers.map(header => {
      const value = row[header];
      return typeof value === 'string' && value.includes(',') 
        ? `"${value.replace(/"/g, '""')}"` 
        : value;
    }).join(',')
  );
  
  return [csvHeaders, ...csvRows].join('\n');
};

const convertToXLSX = (data) => {
  // This would integrate with a library like xlsx
  // For now, return JSON as placeholder
  return JSON.stringify(data, null, 2);
};
