/**
 * Entity Formatter Utilities
 * Generic version of ZADI's restaurantFormatter.js
 * Uses config fieldMappings for field access
 */
import { loadDomainConfig } from '../../config/loader.js';

/**
 * Get field value using config fieldMappings
 */
function getField(entity, fieldName) {
  const config = loadDomainConfig();
  const mapping = config.fieldMappings || {};
  const mappedField = mapping[fieldName] || fieldName;
  return entity[mappedField] ?? entity[fieldName] ?? '';
}

/**
 * Format entities for AI consumption
 * @param {Array} entities - Array of entity documents
 * @returns {Array} - Formatted entity data
 */
export function formatEntitiesForAI(entities) {
  if (!Array.isArray(entities) || entities.length === 0) return [];

  return entities.map(entity => {
    const formatted = {
      entityName: getField(entity, 'name') || entity.name || '',
      category: entity.category || '',
      categories: Array.isArray(entity.categories) ? entity.categories : [],
      location: getField(entity, 'location') || entity.location || '',
      address: entity.address || '',
      phone: entity.phone || '',
      website: entity.website || '',
      rating: entity.rating || 0,
      reviewCount: entity.reviewCount || 0,
      description: getField(entity, 'description') || entity.description || '',
      thumbnail: entity.thumbnail || '',
      source: 'database'
    };

    // Add tags
    if (Array.isArray(entity.tags) && entity.tags.length > 0) {
      formatted.tags = entity.tags;
    }

    // Add any metadata as additional fields
    if (entity.metadata && typeof entity.metadata === 'object') {
      Object.entries(entity.metadata).forEach(([key, value]) => {
        if (value && !formatted[key]) {
          formatted[key] = value;
        }
      });
    }

    return formatted;
  });
}

/**
 * Generate summary text of entities for AI prompts
 * @param {Array} entities - Array of formatted entity data
 * @returns {string} - Summary text
 */
export function generateEntitySummary(entities) {
  const config = loadDomainConfig();
  const entityPlural = config.entityPlural || 'entities';

  if (!Array.isArray(entities) || entities.length === 0) {
    return `No ${entityPlural} available.`;
  }

  const summaries = entities.map((e, index) => {
    let summary = `${index + 1}. ${e.entityName}`;
    if (e.rating > 0) {
      summary += ` (${Number(e.rating).toFixed(1)}★, ${e.reviewCount} reviews)`;
    }
    if (e.location) {
      summary += ` - ${e.location}`;
    }
    if (e.description) {
      summary += ` - ${e.description.substring(0, 100)}`;
    }
    return summary;
  });

  return `${entityPlural.toUpperCase()} FROM DATABASE (${entities.length} total):\n${summaries.join('\n')}`;
}

/**
 * Extract unique categories from entities
 * @param {Array} entities - Array of entity documents
 * @returns {Array} - Unique category strings
 */
export function extractEntityCategories(entities) {
  if (!Array.isArray(entities)) return [];

  const categories = new Set();
  entities.forEach(entity => {
    if (entity.category) categories.add(entity.category.toLowerCase());
    if (Array.isArray(entity.categories)) {
      entity.categories.forEach(cat => {
        if (cat) categories.add(cat.toLowerCase());
      });
    }
  });

  return Array.from(categories).sort();
}

/**
 * Format entity for article inclusion
 * @param {Object} entity - Entity document
 * @returns {string} - Formatted description
 */
export function formatEntityForArticle(entity) {
  const parts = [];

  parts.push(entity.name || 'Entity');
  if (entity.location) parts.push(`located in ${entity.location}`);
  if (entity.rating > 0) {
    parts.push(`rated ${Number(entity.rating).toFixed(1)} stars`);
    if (entity.reviewCount > 0) parts.push(`with ${entity.reviewCount} reviews`);
  }
  if (entity.description) parts.push(`- ${entity.description}`);
  if (Array.isArray(entity.tags) && entity.tags.length > 0) {
    parts.push(`Known for: ${entity.tags.slice(0, 3).join(', ')}`);
  }

  return parts.join('. ') + '.';
}

export default {
  formatEntitiesForAI,
  generateEntitySummary,
  extractEntityCategories,
  formatEntityForArticle
};
