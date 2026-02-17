/**
 * Blog Routes
 * Public-facing blog listing and article pages
 * ITEM 1: Includes /sitemap.xml and /robots.txt
 */
import express from 'express';
import { getBlogList, getBlogArticle } from '../controllers/articleController.js';
import { generateSitemapXML, generateRobotsTxt } from '../utils/seo.js';
import { loadDomainConfig } from '../../config/loader.js';
import Article from '../models/Article.js';

const router = express.Router();

// Blog listing
router.get('/', getBlogList);

// Single article
router.get('/:slug', getBlogArticle);

export default router;

// ==========================================
// Sitemap & Robots (mounted at app level)
// ==========================================
export const sitemapRoute = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const articles = await Article.find({ status: 'published' })
      .select('slug publishedAt updatedAt isPillarContent')
      .lean();

    const pages = articles.map(article => ({
      url: `/blog/${article.slug}`,
      lastmod: article.updatedAt || article.publishedAt,
      changefreq: article.isPillarContent ? 'weekly' : 'monthly',
      priority: article.isPillarContent ? '0.8' : '0.6'
    }));

    const xml = generateSitemapXML(pages, config.baseUrl);
    res.set('Content-Type', 'application/xml');
    res.send(xml);
  } catch (error) {
    res.status(500).send('Error generating sitemap');
  }
};

export const robotsRoute = (req, res) => {
  const config = loadDomainConfig();
  const txt = generateRobotsTxt(config.baseUrl);
  res.set('Content-Type', 'text/plain');
  res.send(txt);
};
