/**
 * Article Controller
 * Handles article CRUD, AI generation, and image upload
 * Based on ZADI's blogController.js, stripped of all coupon/offer code
 */
import Article from '../models/Article.js';
import Entity from '../models/Entity.js';
import { loadDomainConfig } from '../../config/loader.js';
import { generateArticle, injectCTAButtons } from '../core/articleGenerator.js';
import { findPillarForCluster, findClustersForPillar, generateInternalLinks, suggestClusterTopics } from '../core/articleInterlinking.js';
import { triggerManualGeneration, triggerManualArchival, getSchedulerStatus } from '../core/articleScheduler.js';
import { indexArticle, removeArticleFromIndex } from '../services/googleIndexing.js';
import { generateMetaTags, generateArticleSchema, generateBreadcrumbSchema } from '../utils/seo.js';
import { generateTableOfContents, addHeadingIds } from '../utils/tocGenerator.js';
import logger from '../utils/logger.js';

/**
 * GET /admin/articles - Article list page
 */
export const getArticleList = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const page = parseInt(req.query.page) || 1;
    const limit = 20;
    const skip = (page - 1) * limit;
    const { status, category, search } = req.query;

    const query = {};
    if (status) query.status = status;
    if (category) query.category = category;
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: 'i' } },
        { tags: { $regex: search, $options: 'i' } }
      ];
    }

    const [articles, total] = await Promise.all([
      Article.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      Article.countDocuments(query)
    ]);

    res.render('admin/articles', {
      title: 'Articles',
      articles,
      config,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: { status, category, search },
      categories: config.articleCategories || []
    });
  } catch (error) {
    logger.error('Article list error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * GET /admin/articles/new - Article editor (create)
 */
export const getNewArticleEditor = async (req, res) => {
  try {
    const config = loadDomainConfig();

    // Get pillar articles for linking
    const pillarArticles = await Article.find({ isPillarContent: true })
      .select('title _id topicCluster')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/article-editor', {
      title: 'New Article',
      article: null,
      config,
      pillarArticles,
      categories: config.articleCategories || [],
      articleTypes: config.articleTypes || ['guide', 'listicle', 'review', 'comparison'],
      isEdit: false
    });
  } catch (error) {
    logger.error('New article editor error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * GET /admin/articles/edit/:id - Article editor (edit)
 */
export const getEditArticleEditor = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const article = await Article.findById(req.params.id).lean();

    if (!article) {
      return res.status(404).render('404', { title: 'Article Not Found' });
    }

    const pillarArticles = await Article.find({ isPillarContent: true, _id: { $ne: article._id } })
      .select('title _id topicCluster')
      .sort({ createdAt: -1 })
      .lean();

    res.render('admin/article-editor', {
      title: `Edit: ${article.title}`,
      article,
      config,
      pillarArticles,
      categories: config.articleCategories || [],
      articleTypes: config.articleTypes || ['guide', 'listicle', 'review', 'comparison'],
      isEdit: true
    });
  } catch (error) {
    logger.error('Edit article editor error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * POST /api/articles - Create article
 */
export const createArticle = async (req, res) => {
  try {
    const {
      title, slug, content, excerpt, featuredImage, category, articleType,
      location, tags, seoMetaDescription, seoKeywords, status, isFeatured,
      isPillarContent, pillarContentId, topicCluster, primaryKeyword
    } = req.body;

    // Parse arrays
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : (tags || []);
    const parsedKeywords = typeof seoKeywords === 'string' ? JSON.parse(seoKeywords) : (seoKeywords || []);

    // Truncate fields
    let finalSeoMetaDescription = seoMetaDescription || excerpt || '';
    if (finalSeoMetaDescription.length > 160) finalSeoMetaDescription = finalSeoMetaDescription.substring(0, 157) + '...';
    let finalExcerpt = excerpt || '';
    if (finalExcerpt.length > 300) finalExcerpt = finalExcerpt.substring(0, 297) + '...';

    if (title && title.length > 150) {
      return res.status(400).json({ success: false, message: 'Title cannot exceed 150 characters' });
    }

    const article = new Article({
      title,
      slug: slug || undefined,
      content,
      excerpt: finalExcerpt,
      featuredImage: featuredImage || null,
      category,
      articleType: articleType || 'guide',
      location: location || loadDomainConfig().defaultLocation,
      tags: parsedTags,
      seoMetaDescription: finalSeoMetaDescription,
      seoKeywords: parsedKeywords,
      status: status || 'draft',
      isFeatured: isFeatured === 'true' || isFeatured === true,
      isAiGenerated: false,
      isPillarContent: isPillarContent === 'true' || isPillarContent === true,
      pillarContentId: pillarContentId || null,
      topicCluster: topicCluster || null,
      primaryKeyword: primaryKeyword || null
    });

    await article.save();

    // Google indexing if published
    if (article.status === 'published') {
      indexArticle(article.slug).catch(err => logger.warn('Indexing failed:', err.message));
    }

    res.status(201).json({ success: true, message: 'Article created', article: { id: article._id, slug: article.slug, title: article.title } });
  } catch (error) {
    logger.error('Create article error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'An article with this slug already exists' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/articles/:id - Update article
 */
export const updateArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    const oldStatus = article.status;
    const {
      title, slug, content, excerpt, featuredImage, category, articleType,
      location, tags, seoMetaDescription, seoKeywords, status, isFeatured,
      isPillarContent, pillarContentId, topicCluster, primaryKeyword
    } = req.body;

    // Parse arrays
    const parsedTags = typeof tags === 'string' ? JSON.parse(tags) : tags;
    const parsedKeywords = typeof seoKeywords === 'string' ? JSON.parse(seoKeywords) : seoKeywords;

    // Update fields
    if (title !== undefined) article.title = title;
    if (slug !== undefined) article.slug = slug;
    if (content !== undefined) article.content = content;
    if (excerpt !== undefined) {
      article.excerpt = excerpt.length > 300 ? excerpt.substring(0, 297) + '...' : excerpt;
    }
    if (featuredImage !== undefined) article.featuredImage = featuredImage;
    if (category !== undefined) article.category = category;
    if (articleType !== undefined) article.articleType = articleType;
    if (location !== undefined) article.location = location;
    if (parsedTags) article.tags = parsedTags;
    if (seoMetaDescription !== undefined) {
      article.seoMetaDescription = seoMetaDescription.length > 160 ? seoMetaDescription.substring(0, 157) + '...' : seoMetaDescription;
    }
    if (parsedKeywords) article.seoKeywords = parsedKeywords;
    if (status !== undefined) article.status = status;
    if (isFeatured !== undefined) article.isFeatured = isFeatured === 'true' || isFeatured === true;
    if (isPillarContent !== undefined) article.isPillarContent = isPillarContent === 'true' || isPillarContent === true;
    if (pillarContentId !== undefined) article.pillarContentId = pillarContentId || null;
    if (topicCluster !== undefined) article.topicCluster = topicCluster || null;
    if (primaryKeyword !== undefined) article.primaryKeyword = primaryKeyword || null;

    await article.save();

    // Google indexing
    if (article.status === 'published' && oldStatus !== 'published') {
      indexArticle(article.slug).catch(err => logger.warn('Indexing failed:', err.message));
    } else if (article.status === 'archived' && oldStatus === 'published') {
      removeArticleFromIndex(article.slug).catch(err => logger.warn('De-indexing failed:', err.message));
    }

    res.json({ success: true, message: 'Article updated', article: { id: article._id, slug: article.slug, title: article.title } });
  } catch (error) {
    logger.error('Update article error:', error);
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Slug already in use' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/articles/:id - Delete article
 */
export const deleteArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    if (article.status === 'published') {
      removeArticleFromIndex(article.slug).catch(err => logger.warn('De-indexing failed:', err.message));
    }

    await Article.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Article deleted' });
  } catch (error) {
    logger.error('Delete article error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/articles/:id/publish - Publish article
 */
export const publishArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    await article.publish();
    indexArticle(article.slug).catch(err => logger.warn('Indexing failed:', err.message));

    res.json({ success: true, message: 'Article published' });
  } catch (error) {
    logger.error('Publish article error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/articles/:id/archive - Archive article
 */
export const archiveArticle = async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) return res.status(404).json({ success: false, message: 'Article not found' });

    const wasPublished = article.status === 'published';
    await article.archive();

    if (wasPublished) {
      removeArticleFromIndex(article.slug).catch(err => logger.warn('De-indexing failed:', err.message));
    }

    res.json({ success: true, message: 'Article archived' });
  } catch (error) {
    logger.error('Archive article error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/articles/generate - AI article generation
 */
export const generateArticleAPI = async (req, res) => {
  try {
    const { location, category, saveToDatabase, title, articleType, entityList, isPillarContent } = req.body;

    if (!location || !category) {
      return res.status(400).json({ success: false, message: 'Location and category are required' });
    }

    const shouldSave = saveToDatabase === true || saveToDatabase === 'true';
    const isPillar = isPillarContent === true || isPillarContent === 'true';

    logger.info(`API: Generate article - location: ${location}, category: ${category}, pillar: ${isPillar}`);

    const result = await triggerManualGeneration(location, category, null, shouldSave, title, articleType, entityList, isPillar);

    if (result.success) {
      const articleResponse = shouldSave && result.article._id
        ? { id: result.article._id, slug: result.article.slug, title: result.article.title, content: result.article.content, excerpt: result.article.excerpt, seoMetaDescription: result.article.seoMetaDescription, tags: result.article.tags, seoKeywords: result.article.seoKeywords }
        : { title: result.article.title, content: result.article.content, excerpt: result.article.excerpt, seoMetaDescription: result.article.seoMetaDescription, tags: result.article.tags, seoKeywords: result.article.seoKeywords };

      res.json({ success: true, message: shouldSave ? 'Article generated and saved' : 'Article generated', article: articleResponse, usage: result.usage, entityCount: result.entityCount });
    } else {
      res.status(500).json({ success: false, message: 'Generation failed', error: result.error });
    }
  } catch (error) {
    logger.error('Generate article API error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/articles/upload-image - Upload featured image
 */
export const uploadFeaturedImage = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Return the web-accessible URL (not the disk path)
    const imageUrl = `/uploads/images/${req.file.filename}`;

    res.json({ success: true, message: 'Image uploaded', imageUrl, filename: req.file.filename });
  } catch (error) {
    logger.error('Upload image error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/articles/scheduler-status - Get scheduler status
 */
export const getSchedulerStatusAPI = async (req, res) => {
  try {
    const status = getSchedulerStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/articles/archive-old - Trigger manual archival
 */
export const triggerArchival = async (req, res) => {
  try {
    const result = await triggerManualArchival();
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// ==========================================
// PUBLIC BLOG CONTROLLERS
// ==========================================

/**
 * GET /blog - Public blog listing
 */
export const getBlogList = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const page = parseInt(req.query.page) || 1;
    const limit = 12;
    const skip = (page - 1) * limit;
    const { category, tag, location } = req.query;

    const query = { status: 'published' };
    if (category) query.category = category;
    if (tag) query.tags = tag;
    if (location) query.location = location;

    const [articles, total] = await Promise.all([
      Article.find(query).sort({ publishedAt: -1 }).skip(skip).limit(limit).lean(),
      Article.countDocuments(query)
    ]);

    const seo = generateMetaTags({
      title: `Blog - ${config.platformName}`,
      description: `Explore articles and guides on ${config.platformName}`,
      url: `${config.baseUrl}/blog`
    });

    res.render('blog/list', {
      title: `Blog - ${config.platformName}`,
      articles,
      config,
      seo,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
      filters: { category, tag, location }
    });
  } catch (error) {
    logger.error('Blog list error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * GET /blog/:slug - Single blog article
 */
export const getBlogArticle = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const article = await Article.findOne({ slug: req.params.slug, status: 'published' });

    if (!article) {
      return res.status(404).render('404', { title: 'Article Not Found' });
    }

    // Increment views
    article.incrementViews().catch(() => {});

    // Generate TOC
    const toc = generateTableOfContents(article.content);
    const contentWithIds = addHeadingIds(article.content, toc);

    // Get related articles
    let relatedArticles = [];
    if (article.isPillarContent) {
      relatedArticles = await findClustersForPillar(article);
    } else {
      const pillar = await findPillarForCluster(article);
      if (pillar) {
        relatedArticles = await findClustersForPillar(pillar);
        relatedArticles = relatedArticles.filter(a => a._id.toString() !== article._id.toString());
      }
    }

    // Internal links
    const contentWithLinks = generateInternalLinks(contentWithIds, article, relatedArticles);

    // SEO
    const seo = generateMetaTags({
      title: article.title,
      description: article.seoMetaDescription || article.excerpt,
      keywords: article.seoKeywords?.join(', '),
      image: article.featuredImage,
      url: `${config.baseUrl}/blog/${article.slug}`,
      type: 'article'
    });

    const articleSchema = generateArticleSchema({
      title: article.title,
      description: article.seoMetaDescription || article.excerpt,
      image: article.featuredImage || `${config.baseUrl}/images/og-default.jpg`,
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
      url: `${config.baseUrl}/blog/${article.slug}`
    }, config.baseUrl);

    const breadcrumbs = generateBreadcrumbSchema([
      { name: 'Home', url: '/' },
      { name: 'Blog', url: '/blog' },
      { name: article.title, url: `/blog/${article.slug}` }
    ], config.baseUrl);

    res.render('blog/article', {
      title: article.title,
      article: { ...article.toObject(), content: contentWithLinks },
      config,
      seo,
      articleSchema,
      breadcrumbs,
      toc,
      relatedArticles
    });
  } catch (error) {
    logger.error('Blog article error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

export default {
  getArticleList, getNewArticleEditor, getEditArticleEditor,
  createArticle, updateArticle, deleteArticle,
  publishArticle, archiveArticle,
  generateArticleAPI, uploadFeaturedImage,
  getSchedulerStatusAPI, triggerArchival,
  getBlogList, getBlogArticle
};
