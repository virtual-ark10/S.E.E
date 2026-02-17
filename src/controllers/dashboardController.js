/**
 * Dashboard Controller
 * Main admin dashboard showing stats and quick actions
 */
import Article from '../models/Article.js';
import Entity from '../models/Entity.js';
import { loadDomainConfig } from '../../config/loader.js';
import { getSchedulerStatus } from '../core/articleScheduler.js';
import logger from '../utils/logger.js';

export const getDashboard = async (req, res) => {
  try {
    const config = loadDomainConfig();

    // Get stats
    const [
      totalArticles,
      publishedArticles,
      draftArticles,
      archivedArticles,
      totalEntities,
      pillarArticles,
      aiGeneratedCount
    ] = await Promise.all([
      Article.countDocuments(),
      Article.countDocuments({ status: 'published' }),
      Article.countDocuments({ status: 'draft' }),
      Article.countDocuments({ status: 'archived' }),
      Entity.countDocuments({ isActive: true }),
      Article.countDocuments({ isPillarContent: true }),
      Article.countDocuments({ isAiGenerated: true })
    ]);

    // Recent articles
    const recentArticles = await Article.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('title slug status category createdAt isAiGenerated isPillarContent')
      .lean();

    // Recent entities
    const recentEntities = await Entity.find({ isActive: true })
      .sort({ createdAt: -1 })
      .limit(5)
      .select('name location category rating')
      .lean();

    // Top viewed articles
    const topArticles = await Article.find({ status: 'published' })
      .sort({ viewCount: -1 })
      .limit(5)
      .select('title slug viewCount')
      .lean();

    const schedulerStatus = getSchedulerStatus();

    res.render('dashboard', {
      title: 'Dashboard',
      config,
      stats: {
        totalArticles,
        publishedArticles,
        draftArticles,
        archivedArticles,
        totalEntities,
        pillarArticles,
        aiGeneratedCount
      },
      recentArticles,
      recentEntities,
      topArticles,
      schedulerStatus
    });
  } catch (error) {
    logger.error('Dashboard error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

export default { getDashboard };
