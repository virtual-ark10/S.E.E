/**
 * Article Scheduler
 * Rewritten from ZADI's articleScheduler.js
 * Uses entity-count + age-based logic instead of coupon/offer logic
 */
import cron from 'node-cron';
import { generateArticle } from './articleGenerator.js';
import { getEntityCount } from '../adapters/entityService.js';
import { loadDomainConfig } from '../../config/loader.js';
import Article from '../models/Article.js';
import logger from '../utils/logger.js';

let schedulerEnabled = false;
let generationTask = null;
let archivalTask = null;

/**
 * Initialize the article scheduler
 */
export function initializeScheduler() {
  const config = loadDomainConfig();

  // Generate articles daily at 9 AM
  generationTask = cron.schedule('0 9 * * *', async () => {
    logger.info('📅 Running scheduled article generation...');
    await generateScheduledArticles();
  }, { scheduled: true });

  // Archive old articles weekly on Sundays at midnight
  archivalTask = cron.schedule('0 0 * * 0', async () => {
    logger.info('📅 Running scheduled article archival...');
    await archiveScheduledArticles();
  }, { scheduled: true });

  schedulerEnabled = true;
  logger.info('✅ Article scheduler initialized');
}

/**
 * Generate articles based on entity count
 */
async function generateScheduledArticles() {
  const config = loadDomainConfig();
  const location = config.defaultLocation || 'the area';
  const categories = config.articleCategories || ['guides'];

  try {
    // Only generate if we have entities
    const entityCount = await getEntityCount();
    if (entityCount === 0) {
      logger.info('No entities in database. Skipping scheduled generation.');
      return { generated: 0 };
    }

    // Check how many articles we already have
    const existingCount = await Article.countDocuments({ status: { $ne: 'archived' } });
    const maxArticles = Math.min(entityCount * 3, 50); // Cap at 50 or 3x entities

    if (existingCount >= maxArticles) {
      logger.info(`Already have ${existingCount} articles (max: ${maxArticles}). Skipping.`);
      return { generated: 0 };
    }

    // Pick a random category
    const category = categories[Math.floor(Math.random() * categories.length)];

    const result = await generateArticle(location, category, true, null, 'guide', null, false);

    if (result.success) {
      logger.info(`✅ Scheduled article generated: ${result.article.title}`);
      return { generated: 1, article: result.article.title };
    } else {
      logger.error('Scheduled generation failed:', result.error);
      return { generated: 0, error: result.error };
    }
  } catch (error) {
    logger.error('Scheduled article generation error:', error);
    return { generated: 0, error: error.message };
  }
}

/**
 * Archive articles older than 90 days (age-based)
 */
async function archiveScheduledArticles() {
  try {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const result = await Article.updateMany(
      {
        status: 'published',
        publishedAt: { $lt: ninetyDaysAgo },
        viewCount: { $lt: 10 } // Only archive low-traffic articles
      },
      { status: 'archived' }
    );

    logger.info(`📦 Archived ${result.modifiedCount} old articles`);
    return { archivedCount: result.modifiedCount };
  } catch (error) {
    logger.error('Article archival error:', error);
    return { archivedCount: 0, error: error.message };
  }
}

/**
 * Manually trigger article generation
 */
export async function triggerManualGeneration(location, category, discountType, saveToDatabase, title, articleType, entityList, isPillarContent) {
  return generateArticle(location, category, saveToDatabase, title, articleType, entityList, isPillarContent);
}

/**
 * Manually trigger article archival
 */
export async function triggerManualArchival() {
  return archiveScheduledArticles();
}

/**
 * Get scheduler status
 */
export function getSchedulerStatus() {
  return {
    enabled: schedulerEnabled,
    generationSchedule: 'Daily at 9:00 AM',
    archivalSchedule: 'Weekly on Sundays at midnight'
  };
}

export default {
  initializeScheduler,
  triggerManualGeneration,
  triggerManualArchival,
  getSchedulerStatus
};
