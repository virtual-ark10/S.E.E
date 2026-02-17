/**
 * Entity Service
 * Generic version of ZADI's restaurantService.js
 * Provides query functions for entity data
 */
import Entity from '../models/Entity.js';
import { buildCategoryQuery } from '../utils/categoryMapper.js';
import { loadDomainConfig } from '../../config/loader.js';
import logger from '../utils/logger.js';

/**
 * Find entities by category
 */
export async function findEntitiesByCategory(category, limit = 20) {
  try {
    const query = buildCategoryQuery(category);
    if (Object.keys(query).length === 0) {
      query.isActive = true;
    } else {
      query.isActive = true;
    }

    return await Entity.find(query)
      .sort({ rating: -1, reviewCount: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    logger.error('findEntitiesByCategory error:', error);
    return [];
  }
}

/**
 * Find entities by location
 */
export async function findEntitiesByLocation(location, limit = 20) {
  try {
    return await Entity.find({
      isActive: true,
      location: { $regex: location, $options: 'i' }
    })
      .sort({ rating: -1, reviewCount: -1 })
      .limit(limit)
      .lean();
  } catch (error) {
    logger.error('findEntitiesByLocation error:', error);
    return [];
  }
}

/**
 * Get entities for article generation
 * Main function called by articleGenerator
 */
export async function getEntitiesForArticle(location, category, options = {}) {
  const config = loadDomainConfig();
  const { limit = 15, isPillarContent = false } = options;

  try {
    // Build query combining location and category
    const categoryQuery = buildCategoryQuery(category);
    const locationRegex = location ? { $regex: location, $options: 'i' } : null;

    const query = { isActive: true };

    // Add category conditions
    if (categoryQuery.$or) {
      query.$or = categoryQuery.$or;
    }

    // Add location condition
    if (locationRegex) {
      if (query.$or) {
        // Wrap existing $or with $and to add location
        query.$and = [
          { $or: query.$or },
          { location: locationRegex }
        ];
        delete query.$or;
      } else {
        query.location = locationRegex;
      }
    }

    // Sort: pillar content favors top-rated, cluster favors variety
    const sort = isPillarContent
      ? { rating: -1, reviewCount: -1 }
      : { rating: -1 };

    const entities = await Entity.find(query)
      .sort(sort)
      .limit(limit)
      .lean();

    // Deduplicate by name (keep highest rated)
    const seen = new Map();
    const deduped = [];
    for (const entity of entities) {
      const key = entity.name?.toLowerCase().trim();
      if (key && !seen.has(key)) {
        seen.set(key, true);
        deduped.push(entity);
      }
    }

    logger.info(`Found ${deduped.length} entities for article (location: ${location}, category: ${category})`);
    return deduped;
  } catch (error) {
    logger.error('getEntitiesForArticle error:', error);
    return [];
  }
}

/**
 * Get entity by slug
 */
export async function getEntityBySlug(slug) {
  try {
    return await Entity.findOne({ slug, isActive: true }).lean();
  } catch (error) {
    logger.error('getEntityBySlug error:', error);
    return null;
  }
}

/**
 * Get total entity count
 */
export async function getEntityCount() {
  try {
    return await Entity.countDocuments({ isActive: true });
  } catch (error) {
    logger.error('getEntityCount error:', error);
    return 0;
  }
}

export default {
  findEntitiesByCategory,
  findEntitiesByLocation,
  getEntitiesForArticle,
  getEntityBySlug,
  getEntityCount
};
