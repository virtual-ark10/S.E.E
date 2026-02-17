/**
 * Category Mapper Utility
 * Loads hierarchy from domain config instead of hardcoded maps
 */
import { loadDomainConfig } from '../../config/loader.js';

/**
 * Get database categories for an article category with hierarchy support
 * @param {string} articleCategory - Category from article
 * @param {boolean} includeChildren - Whether to include child categories
 * @returns {Array} - Array of database category strings to search for
 */
export function getDatabaseCategories(articleCategory, includeChildren = true) {
  if (!articleCategory) return [];

  const config = loadDomainConfig();
  const categoryHierarchy = config.categoryHierarchy || {};
  const directCategoryMap = config.directCategoryMap || {};

  const normalized = articleCategory.toLowerCase().trim();
  const categories = new Set();

  // Check if it's a parent category (inclusive)
  if (categoryHierarchy[normalized]) {
    const parent = categoryHierarchy[normalized];
    (parent.direct || []).forEach(cat => categories.add(cat));
    if (includeChildren) {
      (parent.children || []).forEach(childKey => {
        if (directCategoryMap[childKey]) {
          directCategoryMap[childKey].forEach(cat => categories.add(cat));
        }
      });
    }
    return Array.from(categories);
  }

  // Check if it's a direct mapping
  if (directCategoryMap[normalized]) {
    return [...directCategoryMap[normalized]];
  }

  // Try partial matches
  const matches = [];
  for (const [key, values] of Object.entries(directCategoryMap)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      matches.push(...values);
    }
  }

  for (const [key, parent] of Object.entries(categoryHierarchy)) {
    if (key.includes(normalized) || normalized.includes(key)) {
      (parent.direct || []).forEach(cat => matches.push(cat));
      if (includeChildren) {
        (parent.children || []).forEach(childKey => {
          if (directCategoryMap[childKey]) {
            directCategoryMap[childKey].forEach(cat => matches.push(cat));
          }
        });
      }
    }
  }

  if (matches.length > 0) {
    return [...new Set(matches)];
  }

  // Fallback: return original + common variations
  return [
    articleCategory,
    articleCategory.charAt(0).toUpperCase() + articleCategory.slice(1),
    articleCategory + ' ' + (config.entityType || 'business')
  ];
}

/**
 * Build category query for entity search
 */
export function buildCategoryQuery(articleCategory, includeChildren = true) {
  if (!articleCategory) return {};

  const dbCategories = getDatabaseCategories(articleCategory, includeChildren);
  if (dbCategories.length === 0) return {};

  const categoryConditions = [];
  const categoriesConditions = [];

  for (const cat of dbCategories) {
    const escapedCat = cat.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    categoryConditions.push({ category: { $regex: escapedCat, $options: 'i' } });
    categoriesConditions.push({ categories: { $regex: escapedCat, $options: 'i' } });
  }

  return {
    $or: [...categoryConditions, ...categoriesConditions]
  };
}

export default { getDatabaseCategories, buildCategoryQuery };
