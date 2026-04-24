import React from 'react';
import { Helmet } from 'react-helmet-async';
import { SEO_CONFIG, PAGE_SEO_CONFIG, generateStructuredData, generateBreadcrumbStructuredData } from '../../utils/seoConfig';

const SEOHead = ({ 
  page = '/', 
  title, 
  description, 
  keywords, 
  imageUrl, 
  noIndex = false,
  breadcrumbs = [],
  additionalStructuredData = {}
}) => {
  const pageConfig = PAGE_SEO_CONFIG[page] || PAGE_SEO_CONFIG['/'];
  const baseUrl = SEO_CONFIG.siteUrl;
  
  const pageTitle = title || pageConfig.title;
  const pageDescription = description || pageConfig.description;
  const pageKeywords = keywords ? keywords.join(', ') : pageConfig.keywords.join(', ');
  const pageImageUrl = imageUrl || `${baseUrl}/images/og-default.jpg`;
  const pageUrl = `${baseUrl}${page}`;

  const structuredData = {
    ...generateStructuredData(page),
    ...additionalStructuredData
  };

  const breadcrumbData = breadcrumbs.length > 0 ? generateBreadcrumbStructuredData(breadcrumbs) : null;

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{pageTitle}</title>
      <meta name="description" content={pageDescription} />
      <meta name="keywords" content={pageKeywords} />
      <meta name="author" content={SEO_CONFIG.author} />
      <link rel="canonical" href={pageUrl} />
      
      {/* Robots Meta */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}
      {!noIndex && <meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1" />}
      
      {/* Open Graph Tags */}
      <meta property="og:type" content={pageConfig.type} />
      <meta property="og:title" content={pageTitle} />
      <meta property="og:description" content={pageDescription} />
      <meta property="og:url" content={pageUrl} />
      <meta property="og:site_name" content={SEO_CONFIG.siteName} />
      <meta property="og:image" content={pageImageUrl} />
      <meta property="og:image:width" content="1200" />
      <meta property="og:image:height" content="630" />
      <meta property="og:image:alt" content={pageTitle} />
      <meta property="og:locale" content="en_US" />
      
      {/* Twitter Card Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={pageTitle} />
      <meta name="twitter:description" content={pageDescription} />
      <meta name="twitter:image" content={pageImageUrl} />
      <meta name="twitter:site" content={SEO_CONFIG.twitter} />
      <meta name="twitter:creator" content={SEO_CONFIG.twitter} />
      
      {/* Additional Meta Tags */}
      <meta name="theme-color" content="#6366f1" />
      <meta name="msapplication-TileColor" content="#6366f1" />
      <meta name="application-name" content={SEO_CONFIG.siteName} />
      <meta name="apple-mobile-web-app-title" content={SEO_CONFIG.siteName} />
      <meta name="apple-mobile-web-app-capable" content="yes" />
      <meta name="apple-mobile-web-app-status-bar-style" content="default" />
      
      {/* Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData, null, 2)}
      </script>
      
      {/* Breadcrumb Structured Data */}
      {breadcrumbData && (
        <script type="application/ld+json">
          {JSON.stringify(breadcrumbData, null, 2)}
        </script>
      )}
      
      {/* DNS Prefetch for Performance */}
      <link rel="dns-prefetch" href="//fonts.googleapis.com" />
      <link rel="dns-prefetch" href="//cdnjs.cloudflare.com" />
      <link rel="dns-prefetch" href="//api.aegis-health.com" />
      
      {/* Preconnect for Critical Resources */}
      <link rel="preconnect" href="https://fonts.googleapis.com" crossOrigin="anonymous" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      
      {/* Favicon */}
      <link rel="icon" href="/favicon.ico" />
      <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
      <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
      <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      
      {/* Manifest */}
      <link rel="manifest" href="/site.webmanifest" />
    </Helmet>
  );
};

export default SEOHead;
