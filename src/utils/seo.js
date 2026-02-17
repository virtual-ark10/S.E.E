/**
 * SEO Utilities
 * Selective copy from ZADI's seo.js (GAP 8)
 * Only article-relevant functions, config-aware
 */
import { loadDomainConfig } from '../../config/loader.js';

/**
 * Generate meta tags for a page
 */
export function generateMetaTags(options = {}) {
  const config = loadDomainConfig();
  const {
    title = config.platformName,
    description = `${config.platformName} - ${config.promptVariables?.INDUSTRY_CONTEXT || 'Content Platform'}`,
    keywords = '',
    image = '',
    url = config.baseUrl,
    type = 'website'
  } = options;

  const cleanDesc = cleanMetaDescription(description);
  return {
    title,
    description: cleanDesc,
    keywords,
    image,
    url,
    type,
    canonical: url,
    og: {
      title,
      description: cleanDesc,
      image,
      url,
      type,
      site_name: config.platformName
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: cleanDesc,
      image
    }
  };
}

/**
 * Generate Article structured data schema
 */
export function generateArticleSchema(article, baseUrl, options = {}) {
  const config = loadDomainConfig();
  const schema = {
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": article.title,
    "description": article.description || article.excerpt || '',
    "author": {
      "@type": "Organization",
      "name": config.platformName
    },
    "publisher": {
      "@type": "Organization",
      "name": config.platformName,
      "logo": {
        "@type": "ImageObject",
        "url": `${baseUrl}/images/logo.png`
      }
    },
    "datePublished": article.datePublished,
    "dateModified": article.dateModified || article.datePublished,
    "image": article.image || `${baseUrl}/images/default.jpg`,
    "mainEntityOfPage": {
      "@type": "WebPage",
      "@id": article.url || `${baseUrl}/blog/${article.slug || ''}`
    }
  };

  // Add breadcrumb if pillar article exists
  if (options.pillarArticle) {
    schema.isPartOf = {
      "@type": "Article",
      "headline": options.pillarArticle.title,
      "url": `${baseUrl}/blog/${options.pillarArticle.slug}`
    };
  }

  return schema;
}

/**
 * Generate Breadcrumb structured data schema
 */
export function generateBreadcrumbSchema(breadcrumbs, baseUrl) {
  if (!breadcrumbs || breadcrumbs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": breadcrumbs.map((crumb, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": crumb.name,
      "item": `${baseUrl}${crumb.url}`
    }))
  };
}

/**
 * Generate FAQ structured data schema
 */
export function generateFAQSchema(faqs) {
  if (!faqs || faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer
      }
    }))
  };
}

/**
 * Generate Website structured data schema
 */
export function generateWebsiteSchema(baseUrl) {
  const config = loadDomainConfig();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": config.platformName,
    "url": baseUrl,
    "potentialAction": {
      "@type": "SearchAction",
      "target": `${baseUrl}/blog?q={search_term_string}`,
      "query-input": "required name=search_term_string"
    }
  };
}

/**
 * Generate sitemap XML for blog articles
 */
export function generateSitemapXML(pages, baseUrl) {
  const defaultPages = [
    { url: '/', priority: '1.0', changefreq: 'daily' },
    { url: '/blog', priority: '0.9', changefreq: 'daily' }
  ];

  const allPages = [...defaultPages, ...pages];

  let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
  xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

  allPages.forEach(page => {
    xml += '  <url>\n';
    xml += `    <loc>${baseUrl}${page.url}</loc>\n`;
    if (page.lastmod) {
      const dateStr = page.lastmod instanceof Date
        ? page.lastmod.toISOString().split('T')[0]
        : page.lastmod;
      xml += `    <lastmod>${dateStr}</lastmod>\n`;
    }
    xml += `    <changefreq>${page.changefreq || 'weekly'}</changefreq>\n`;
    xml += `    <priority>${page.priority || '0.5'}</priority>\n`;
    xml += '  </url>\n';
  });

  xml += '</urlset>';
  return xml;
}

/**
 * Generate robots.txt content
 */
export function generateRobotsTxt(baseUrl) {
  return `User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /settings/

Sitemap: ${baseUrl}/sitemap.xml
`;
}

/**
 * Clean meta description - remove HTML tags and truncate
 */
export function cleanMetaDescription(description) {
  if (!description) return '';
  let clean = description
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (clean.length > 160) {
    clean = clean.substring(0, 157) + '...';
  }
  return clean;
}

export default {
  generateMetaTags,
  generateArticleSchema,
  generateBreadcrumbSchema,
  generateFAQSchema,
  generateWebsiteSchema,
  generateSitemapXML,
  generateRobotsTxt,
  cleanMetaDescription
};
