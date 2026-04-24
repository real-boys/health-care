import { SEO_CONFIG, PAGE_SEO_CONFIG } from './seoConfig';

class SitemapGenerator {
  constructor() {
    this.baseUrl = SEO_CONFIG.siteUrl;
    this.pages = Object.keys(PAGE_SEO_CONFIG);
  }

  generateSitemapIndex() {
    const currentDate = new Date().toISOString();
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${this.baseUrl}/sitemap-pages.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
  <sitemap>
    <loc>${this.baseUrl}/sitemap-images.xml</loc>
    <lastmod>${currentDate}</lastmod>
  </sitemap>
</sitemapindex>`;
  }

  generatePagesSitemap() {
    const currentDate = new Date().toISOString();
    
    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    this.pages.forEach(page => {
      const pageConfig = PAGE_SEO_CONFIG[page];
      const url = `${this.baseUrl}${page}`;
      
      sitemap += `
  <url>
    <loc>${url}</loc>
    <lastmod>${currentDate}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${this.getPriority(page)}</priority>
    <image:image>
      <image:loc>${this.baseUrl}/images/og-${page.replace('/', 'home')}.jpg</image:loc>
      <image:title>${pageConfig.title}</image:title>
      <image:caption>${pageConfig.description}</image:caption>
    </image:image>
  </url>`;
    });

    sitemap += `
</urlset>`;
    
    return sitemap;
  }

  generateImagesSitemap() {
    const images = [
      {
        loc: `${this.baseUrl}/images/og-default.jpg`,
        title: 'AEGIS Health Systems - Default',
        caption: 'Advanced Healthcare Insurance Platform'
      },
      {
        loc: `${this.baseUrl}/images/og-home.jpg`,
        title: 'AEGIS Health Systems Dashboard',
        caption: 'Main dashboard for healthcare management'
      },
      {
        loc: `${this.baseUrl}/images/og-patients.jpg`,
        title: 'Patient Records Management',
        caption: 'Secure patient record management system'
      },
      {
        loc: `${this.baseUrl}/images/og-providers.jpg`,
        title: 'Healthcare Provider Directory',
        caption: 'Comprehensive provider network directory'
      },
      {
        loc: `${this.baseUrl}/images/og-payments.jpg`,
        title: 'Payment Analytics Dashboard',
        caption: 'Advanced payment processing and analytics'
      },
      {
        loc: `${this.baseUrl}/images/og-fraud.jpg`,
        title: 'Fraud Detection System',
        caption: 'AI-powered fraud detection and prevention'
      }
    ];

    let sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">`;

    images.forEach(image => {
      sitemap += `
  <url>
    <loc>${this.baseUrl}</loc>
    <image:image>
      <image:loc>${image.loc}</image:loc>
      <image:title>${image.title}</image:title>
      <image:caption>${image.caption}</image:caption>
    </image:image>
  </url>`;
    });

    sitemap += `
</urlset>`;
    
    return sitemap;
  }

  generateRobotsTxt() {
    return `User-agent: *
Allow: /

# Sitemaps
Sitemap: ${this.baseUrl}/sitemap.xml
Sitemap: ${this.baseUrl}/sitemap-pages.xml
Sitemap: ${this.baseUrl}/sitemap-images.xml

# Block common non-content paths
Disallow: /api/
Disallow: /admin/
Disallow: /private/
Disallow: /*.json$
Disallow: /_next/
Disallow: /static/

# Allow specific important paths
Allow: /api/providers/
Allow: /api/search/

Crawl-delay: 1`;
  }

  getPriority(page) {
    const priorities = {
      '/': '1.0',
      '/patients': '0.9',
      '/providers': '0.9',
      '/payments': '0.8',
      '/fraud': '0.8',
      '/notifications': '0.7'
    };
    return priorities[page] || '0.5';
  }

  async generateAllSitemaps() {
    const sitemaps = {
      'sitemap.xml': this.generateSitemapIndex(),
      'sitemap-pages.xml': this.generatePagesSitemap(),
      'sitemap-images.xml': this.generateImagesSitemap(),
      'robots.txt': this.generateRobotsTxt()
    };

    return sitemaps;
  }

  // Method to save sitemaps (would be used in a build script or API endpoint)
  async saveSitemaps(outputDir = './public') {
    const sitemaps = await this.generateAllSitemaps();
    
    // In a real implementation, you would save these files
    // For now, we'll return the content for use in API endpoints
    return sitemaps;
  }
}

export default SitemapGenerator;
