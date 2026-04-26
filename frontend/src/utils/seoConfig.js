export const SEO_CONFIG = {
  siteName: 'AEGIS Health Systems',
  siteUrl: process.env.REACT_APP_SITE_URL || 'https://aegis-health.com',
  defaultTitle: 'AEGIS Health Systems - Advanced Healthcare Insurance Platform',
  defaultDescription: 'Comprehensive healthcare insurance platform with advanced fraud detection, secure payments, and real-time analytics for modern health systems.',
  author: 'AEGIS Health Systems',
  twitter: '@aegishealth',
  keywords: [
    'healthcare insurance',
    'fraud detection',
    'health systems',
    'medical insurance',
    'healthcare analytics',
    'secure payments',
    'patient management',
    'provider directory',
    'claims processing',
    'telemedicine'
  ],
  organization: {
    name: 'AEGIS Health Systems',
    url: 'https://aegis-health.com',
    logo: 'https://aegis-health.com/logo.png',
    description: 'Leading provider of advanced healthcare insurance solutions with cutting-edge fraud detection and analytics.'
  },
  contact: {
    phone: '+1-800-AEGIS-01',
    email: 'contact@aegis-health.com',
    address: {
      streetAddress: '123 Healthcare Plaza',
      addressLocality: 'San Francisco',
      addressRegion: 'CA',
      postalCode: '94105',
      addressCountry: 'US'
    }
  }
};

export const PAGE_SEO_CONFIG = {
  '/': {
    title: 'AEGIS Health Systems - Advanced Healthcare Insurance Platform',
    description: 'Revolutionary healthcare insurance platform with AI-powered fraud detection, secure blockchain payments, and real-time analytics.',
    keywords: ['healthcare platform', 'insurance management', 'fraud detection', 'healthcare analytics'],
    type: 'website'
  },
  '/patients': {
    title: 'Patient Records Management - AEGIS Health Systems',
    description: 'Comprehensive patient record management with secure data storage, real-time updates, and advanced privacy protection.',
    keywords: ['patient records', 'medical records', 'patient management', 'healthcare data'],
    type: 'website'
  },
  '/providers': {
    title: 'Provider Directory - AEGIS Health Systems',
    description: 'Extensive healthcare provider directory with verified credentials, specializations, and patient reviews.',
    keywords: ['healthcare providers', 'doctor directory', 'medical providers', 'provider network'],
    type: 'website'
  },
  '/payments': {
    title: 'Payment Analytics - AEGIS Health Systems',
    description: 'Advanced payment processing and analytics with blockchain security, real-time tracking, and comprehensive reporting.',
    keywords: ['healthcare payments', 'medical billing', 'payment analytics', 'blockchain payments'],
    type: 'website'
  },
  '/notifications': {
    title: 'Notification Center - AEGIS Health Systems',
    description: 'Real-time notification system for critical healthcare updates, alerts, and important patient information.',
    keywords: ['healthcare notifications', 'medical alerts', 'patient communication', 'healthcare updates'],
    type: 'website'
  },
  '/fraud': {
    title: 'Fraud Detection System - AEGIS Health Systems',
    description: 'AI-powered fraud detection and prevention system with real-time monitoring, pattern recognition, and advanced analytics.',
    keywords: ['fraud detection', 'healthcare fraud', 'AI security', 'medical fraud prevention'],
    type: 'website'
  }
};

export const generateStructuredData = (page, data = {}) => {
  const baseUrl = SEO_CONFIG.siteUrl;
  const pageConfig = PAGE_SEO_CONFIG[page] || PAGE_SEO_CONFIG['/'];

  const baseStructuredData = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SEO_CONFIG.organization.name,
    url: SEO_CONFIG.organization.url,
    logo: SEO_CONFIG.organization.logo,
    description: SEO_CONFIG.organization.description,
    contactPoint: {
      '@type': 'ContactPoint',
      telephone: SEO_CONFIG.contact.phone,
      contactType: 'customer service',
      availableLanguage: ['English', 'Spanish']
    },
    address: {
      '@type': 'PostalAddress',
      ...SEO_CONFIG.contact.address
    },
    sameAs: [
      'https://twitter.com/aegishealth',
      'https://linkedin.com/company/aegis-health-systems',
      'https://facebook.com/aegishealth'
    ]
  };

  if (page === '/') {
    return {
      ...baseStructuredData,
      mainEntity: {
        '@type': 'WebSite',
        name: pageConfig.title,
        url: baseUrl,
        description: pageConfig.description,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${baseUrl}/search?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      }
    };
  }

  if (page === '/providers') {
    return {
      ...baseStructuredData,
      mainEntity: {
        '@type': 'MedicalOrganization',
        name: 'AEGIS Provider Network',
        url: `${baseUrl}/providers`,
        description: pageConfig.description,
        hasOfferCatalog: {
          '@type': 'OfferCatalog',
          name: 'Healthcare Services',
          itemListElement: [
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Primary Care',
                description: 'Comprehensive primary healthcare services'
              }
            },
            {
              '@type': 'Offer',
              itemOffered: {
                '@type': 'Service',
                name: 'Specialty Care',
                description: 'Advanced medical specialty services'
              }
            }
          ]
        }
      }
    };
  }

  if (page === '/fraud') {
    return {
      ...baseStructuredData,
      mainEntity: {
        '@type': 'SoftwareApplication',
        name: 'AEGIS Fraud Detection System',
        url: `${baseUrl}/fraud`,
        description: pageConfig.description,
        applicationCategory: 'SecurityApplication',
        operatingSystem: 'Web Browser',
        offers: {
          '@type': 'Offer',
          price: '0',
          priceCurrency: 'USD',
          description: 'Advanced fraud detection for healthcare providers'
        }
      }
    };
  }

  return baseStructuredData;
};

export const generateBreadcrumbStructuredData = (breadcrumbs) => {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((breadcrumb, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: breadcrumb.name,
      item: `${SEO_CONFIG.siteUrl}${breadcrumb.path}`
    }))
  };
};
