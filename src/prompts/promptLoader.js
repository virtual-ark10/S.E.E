/**
 * Prompt Loader Utility
 * Template-aware, loads category overrides from config JSON (GAP 4)
 * No restaurant-specific category file imports
 */
import { generatePillarPrompt } from './templates/pillar/comprehensive-guide.template.js';
import { generateClusterPrompt } from './templates/cluster/focused-article.template.js';
import { loadDomainConfig } from '../../config/loader.js';

/**
 * Get category overrides from config instead of JS files
 */
function getCategoryOverrides(category) {
  const config = loadDomainConfig();
  return config.categoryOverrides?.[category] || null;
}

/**
 * Load and merge prompts based on type and category
 * @param {string} type - 'pillar' or 'cluster'
 * @param {string} category - Article category
 * @param {Object} options - Prompt options
 * @returns {string} - Final merged prompt
 */
export function loadPrompt(type, category, options) {
  if (type !== 'pillar' && type !== 'cluster') {
    throw new Error(`Invalid prompt type: ${type}. Must be 'pillar' or 'cluster'`);
  }

  const config = loadDomainConfig();
  const vars = config.promptVariables || {};

  // Merge config variables into options
  const enrichedOptions = {
    ...options,
    platformName: vars.PLATFORM_NAME || config.platformName || 'Platform',
    entityType: vars.ENTITY_TYPE || config.entityType || 'business',
    entityPlural: vars.ENTITY_PLURAL || config.entityPlural || 'businesses',
    industryContext: vars.INDUSTRY_CONTEXT || '',
    location: options.location || vars.DEFAULT_LOCATION || config.defaultLocation || ''
  };

  // Load base prompt
  let basePrompt = '';
  if (type === 'pillar') {
    basePrompt = generatePillarPrompt(enrichedOptions);
  } else {
    basePrompt = generateClusterPrompt(enrichedOptions);
  }

  // Check for category-specific overrides from config
  const overrides = getCategoryOverrides(category);
  if (overrides) {
    // Inject category-specific instructions
    if (overrides.categorySpecificInstructions) {
      const seoSectionIndex = basePrompt.indexOf('SEO Keyword Strategy');
      if (seoSectionIndex !== -1) {
        basePrompt = basePrompt.slice(0, seoSectionIndex) +
          `\n\nCategory-Specific Instructions (${category}):\n${overrides.categorySpecificInstructions}\n\n` +
          basePrompt.slice(seoSectionIndex);
      } else {
        basePrompt += `\n\nCategory-Specific Instructions (${category}):\n${overrides.categorySpecificInstructions}`;
      }
    }

    // Add suggested sections
    if (overrides.suggestedSections && overrides.suggestedSections.length > 0) {
      const suggestedText = `\n- Suggested sections for this category: ${overrides.suggestedSections.join(', ')}`;
      const structureIndex = basePrompt.indexOf('Article Structure');
      if (structureIndex !== -1) {
        basePrompt = basePrompt.slice(0, structureIndex) +
          suggestedText + '\n\n' +
          basePrompt.slice(structureIndex);
      }
    }

    // Add full article structure override if provided
    if (overrides.fullArticleStructure) {
      const structureStart = basePrompt.indexOf('Article Structure');
      const structureEnd = basePrompt.indexOf('\n\nSEO') || basePrompt.length;
      if (structureStart !== -1) {
        basePrompt = basePrompt.slice(0, structureStart) +
          overrides.fullArticleStructure +
          basePrompt.slice(structureEnd);
      }
    }

    // Add category focus
    if (overrides.categoryFocus) {
      const criticalEnd = basePrompt.indexOf('CRITICAL REQUIREMENTS');
      if (criticalEnd !== -1) {
        const nextSection = basePrompt.indexOf('\n\n', criticalEnd + 50);
        if (nextSection !== -1) {
          basePrompt = basePrompt.slice(0, nextSection) +
            `\n\nCATEGORY FOCUS (${category}):\n${overrides.categoryFocus}\n` +
            basePrompt.slice(nextSection);
        }
      }
    }
  }

  return basePrompt;
}

/**
 * Get available prompt types
 */
export function getAvailableTypes() {
  return ['pillar', 'cluster'];
}

/**
 * Get available categories from config
 */
export function getAvailableCategories() {
  const config = loadDomainConfig();
  return config.articleCategories || [];
}

export default { loadPrompt, getAvailableTypes, getAvailableCategories };
