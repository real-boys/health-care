export const SOCIAL_PLATFORMS = {
  facebook: {
    name: 'Facebook',
    baseUrl: 'https://www.facebook.com/sharer/sharer.php',
    icon: 'facebook',
    color: '#1877f2',
    dimensions: { width: 1200, height: 630 },
    supportedFeatures: ['text', 'image', 'url', 'hashtags']
  },
  twitter: {
    name: 'Twitter',
    baseUrl: 'https://twitter.com/intent/tweet',
    icon: 'twitter',
    color: '#1da1f2',
    dimensions: { width: 1200, height: 675 },
    supportedFeatures: ['text', 'image', 'url', 'hashtags', 'via']
  },
  linkedin: {
    name: 'LinkedIn',
    baseUrl: 'https://www.linkedin.com/sharing/share-offsite/',
    icon: 'linkedin',
    color: '#0077b5',
    dimensions: { width: 1200, height: 627 },
    supportedFeatures: ['text', 'image', 'url', 'hashtags']
  },
  whatsapp: {
    name: 'WhatsApp',
    baseUrl: 'https://wa.me/',
    icon: 'whatsapp',
    color: '#25d366',
    dimensions: { width: 1200, height: 630 },
    supportedFeatures: ['text', 'url']
  },
  telegram: {
    name: 'Telegram',
    baseUrl: 'https://t.me/share/url',
    icon: 'telegram',
    color: '#0088cc',
    dimensions: { width: 1200, height: 630 },
    supportedFeatures: ['text', 'url']
  },
  reddit: {
    name: 'Reddit',
    baseUrl: 'https://reddit.com/submit',
    icon: 'reddit',
    color: '#ff4500',
    dimensions: { width: 1200, height: 630 },
    supportedFeatures: ['text', 'url', 'hashtags']
  },
  pinterest: {
    name: 'Pinterest',
    baseUrl: 'https://pinterest.com/pin/create/button/',
    icon: 'pinterest',
    color: '#bd081c',
    dimensions: { width: 1000, height: 1500 },
    supportedFeatures: ['text', 'image', 'url', 'hashtags']
  },
  email: {
    name: 'Email',
    baseUrl: 'mailto:',
    icon: 'email',
    color: '#6b7280',
    dimensions: { width: 1200, height: 630 },
    supportedFeatures: ['text', 'url', 'subject']
  }
};

export const SHARING_TEMPLATES = {
  dashboard: {
    title: 'AEGIS Health Systems - Advanced Healthcare Dashboard',
    description: 'Revolutionary healthcare platform with AI-powered fraud detection and secure payments',
    hashtags: ['HealthTech', 'Healthcare', 'FraudDetection', 'MedicalInsurance'],
    customText: 'Check out this amazing healthcare platform that\'s transforming the industry!'
  },
  fraud: {
    title: 'AI-Powered Fraud Detection in Healthcare',
    description: 'Advanced machine learning algorithms protecting healthcare systems from fraud',
    hashtags: ['AI', 'FraudDetection', 'HealthcareSecurity', 'HealthTech'],
    customText: 'This AI system is revolutionizing healthcare fraud detection! #HealthTech #AI'
  },
  payments: {
    title: 'Secure Healthcare Payment Processing',
    description: 'Blockchain-powered payment system for healthcare with real-time analytics',
    hashtags: ['Blockchain', 'HealthcarePayments', 'FinTech', 'MedicalBilling'],
    customText: 'Secure healthcare payments with blockchain technology! #FinTech #HealthTech'
  },
  providers: {
    title: 'Healthcare Provider Directory',
    description: 'Comprehensive directory of verified healthcare providers with reviews',
    hashtags: ['Healthcare', 'Providers', 'MedicalDirectory', 'PatientCare'],
    customText: 'Find trusted healthcare providers in your area! #Healthcare #PatientCare'
  },
  patients: {
    title: 'Patient Records Management',
    description: 'Secure and comprehensive patient record management system',
    hashtags: ['PatientCare', 'MedicalRecords', 'HealthTech', 'DataSecurity'],
    customText: 'Modern patient record management that puts patients first! #HealthTech'
  }
};

export const SHARING_ANALYTICS = {
  events: {
    share_initiated: 'share_initiated',
    share_completed: 'share_completed',
    share_failed: 'share_failed',
    share_cancelled: 'share_cancelled',
    card_generated: 'card_generated',
    card_downloaded: 'card_downloaded'
  },
  platforms: Object.keys(SOCIAL_PLATFORMS),
  metrics: [
    'total_shares',
    'platform_shares',
    'conversion_rate',
    'engagement_time',
    'card_generations',
    'card_downloads'
  ]
};

export const generateSharingUrl = (platform, options) => {
  const config = SOCIAL_PLATFORMS[platform];
  if (!config) return null;

  const { url, title, description, hashtags, via, customText } = options;
  const params = new URLSearchParams();

  switch (platform) {
    case 'facebook':
      params.set('u', url);
      if (customText) params.set('quote', customText);
      break;
    
    case 'twitter':
      if (customText) params.set('text', customText);
      else params.set('text', `${title} - ${description}`);
      params.set('url', url);
      if (hashtags && hashtags.length > 0) {
        params.set('hashtags', hashtags.join(','));
      }
      if (via) params.set('via', via);
      break;
    
    case 'linkedin':
      params.set('url', url);
      params.set('title', title);
      params.set('summary', description);
      break;
    
    case 'whatsapp':
      const whatsappText = customText || `${title} - ${description} ${url}`;
      params.set('phone', '');
      params.set('text', whatsappText);
      break;
    
    case 'telegram':
      params.set('url', url);
      params.set('text', customText || title);
      break;
    
    case 'reddit':
      params.set('url', url);
      params.set('title', customText || title);
      if (hashtags && hashtags.length > 0) {
        params.set('sr', hashtags[0]);
      }
      break;
    
    case 'pinterest':
      params.set('url', url);
      params.set('description', customText || description);
      if (options.media) params.set('media', options.media);
      break;
    
    case 'email':
      params.set('subject', title);
      const emailBody = customText || `${description}\n\n${url}`;
      params.set('body', emailBody);
      break;
    
    default:
      return null;
  }

  const baseUrl = platform === 'whatsapp' ? 'https://wa.me/' : config.baseUrl;
  return `${baseUrl}?${params.toString()}`;
};

export const generateSharingCard = async (template, customizations = {}) => {
  const baseTemplate = SHARING_TEMPLATES[template];
  if (!baseTemplate) return null;

  return {
    title: customizations.title || baseTemplate.title,
    description: customizations.description || baseTemplate.description,
    hashtags: customizations.hashtags || baseTemplate.hashtags,
    customText: customizations.customText || baseTemplate.customText,
    image: customizations.image || `/images/sharing/${template}-card.jpg`,
    url: customizations.url || window.location.href,
    template: template,
    customizations: Object.keys(customizations).length > 0
  };
};

export const trackSharingEvent = (event, data) => {
  // This would integrate with your analytics system
  if (window.gtag) {
    window.gtag('event', event, {
      event_category: 'social_sharing',
      event_label: data.platform,
      value: data.value || 1,
      custom_parameters: data
    });
  }

  // Also track locally for immediate feedback
  const existingData = JSON.parse(localStorage.getItem('sharing_analytics') || '{}');
  existingData[event] = (existingData[event] || 0) + 1;
  existingData.last_activity = new Date().toISOString();
  localStorage.setItem('sharing_analytics', JSON.stringify(existingData));

  return existingData;
};

export const getSharingAnalytics = () => {
  const data = JSON.parse(localStorage.getItem('sharing_analytics') || '{}');
  return {
    ...data,
    total_shares: Object.entries(data).reduce((sum, [key, value]) => 
      key.includes('share') ? sum + value : sum, 0
    ),
    most_popular_platform: Object.entries(SOCIAL_PLATFORMS)
      .map(([key, value]) => ({
        platform: key,
        shares: data[`share_completed_${key}`] || 0
      }))
      .sort((a, b) => b.shares - a.shares)[0]?.platform || 'none'
  };
};
