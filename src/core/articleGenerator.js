/**
 * Article Generator
 * Core engine for generating SEO articles using AI
 * Based on ZADI's articleGenerator.js with ALL offer/deal/coupon code removed
 * ITEM 2: parseRestaurantList -> parseEntityList, extractRestaurantDetails -> extractEntityDetails
 * ITEM 6: generateSlug() kept as-is
 */
import { generateArticleWithAI } from '../ai/openrouter.js';
import { loadPrompt } from '../prompts/promptLoader.js';
import { formatEntitiesForAI, generateEntitySummary } from '../formatters/entityFormatter.js';
import { getEntitiesForArticle } from '../adapters/entityService.js';
import { loadDomainConfig } from '../../config/loader.js';
import Article from '../models/Article.js';
import logger from '../utils/logger.js';

function stripHtml(html) {
  if (!html) return '';
  return String(html)
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, ' ')
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractHeadings(html) {
  if (!html) return [];
  const headings = [];
  const re = /<(h2|h3)>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const text = stripHtml(m[2]);
    if (text) headings.push(text);
  }
  return headings;
}

function toSlugTag(input) {
  if (!input) return '';
  return String(input)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function buildSeoFromContent({ title, location, category, categoryName, htmlContent, entities = [], config }) {
  const text = `${title || ''}\n${extractHeadings(htmlContent).join('\n')}\n${stripHtml(htmlContent)}`.toLowerCase();

  // Basic English stopwords + SEO filler
  const stop = new Set([
    'the','a','an','and','or','but','if','then','else','when','while','of','to','in','on','at','for','from','by','with','as','is','are','was','were','be','been','being',
    'this','that','these','those','it','its','they','their','them','you','your','we','our','us','i','me','my',
    'best','top','ultimate','complete','comprehensive','guide','guides','review','reviews','comparison','comparisons','tips','tip','list','lists','how','what','why','where','vs',
    'also','more','most','many','some','such','can','will','just','about','into','over','under','between','within'
  ]);

  const tokens = text
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(t => t.trim())
    .filter(t => t.length >= 3 && t.length <= 32 && !stop.has(t));

  const freq = new Map();
  for (const t of tokens) freq.set(t, (freq.get(t) || 0) + 1);

  // Weight heading tokens higher
  for (const h of extractHeadings(htmlContent)) {
    const ht = h.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(t => t.length >= 3 && !stop.has(t));
    for (const t of ht) freq.set(t, (freq.get(t) || 0) + 3);
  }

  // Candidate phrases from title + headings (2-3 word ngrams)
  const phraseFreq = new Map();
  const seedTexts = [title, ...extractHeadings(htmlContent)].filter(Boolean).slice(0, 12);
  for (const s of seedTexts) {
    const w = s.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(t => t.length >= 3 && !stop.has(t));
    for (let i = 0; i < w.length; i++) {
      const bi = w[i] && w[i + 1] ? `${w[i]} ${w[i + 1]}` : null;
      const tri = w[i] && w[i + 2] ? `${w[i]} ${w[i + 1]} ${w[i + 2]}` : null;
      if (bi) phraseFreq.set(bi, (phraseFreq.get(bi) || 0) + 2);
      if (tri) phraseFreq.set(tri, (phraseFreq.get(tri) || 0) + 2);
    }
  }

  // Boost entity names if present
  const entityNames = (entities || []).map(e => e?.name || e?.entityName).filter(Boolean).slice(0, 6);

  // Build seoKeywords: top phrases, then top tokens, then fallbacks
  const topPhrases = [...phraseFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p)
    .filter(p => p.length >= 6)
    .slice(0, 8);

  const topTokens = [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
    .filter(t => !t.includes('-')) // keep keywords readable; tags can keep hyphens
    .slice(0, 10);

  const seoKeywords = Array.from(new Set([
    ...(topPhrases),
    ...(topTokens),
    ...(entityNames.length ? entityNames.slice(0, 3) : []),
    ...(location ? [`${location} ${categoryName || category || ''}`.trim()] : []),
    title ? title.toLowerCase() : null
  ].filter(Boolean)))
    .slice(0, 15);

  // Build tags: slugified, short-ish, useful for filtering
  const tags = Array.from(new Set([
    category,
    location,
    ...(topPhrases.slice(0, 4)),
    ...(topTokens.slice(0, 6)),
  ].filter(Boolean).map(toSlugTag).filter(Boolean)))
    .slice(0, 12);

  // Pick a primary keyword: best phrase if present, else title without stopwords, else `${categoryName} ${location}`
  const primaryKeyword =
    topPhrases[0] ||
    (title ? stripHtml(title).trim() : '') ||
    `${categoryName || category || ''} ${location || ''}`.trim();

  // Meta description hint: use excerpt upstream; keep here as fallback only
  const defaultMeta = config?.platformName
    ? `Learn about ${primaryKeyword} with ${config.platformName}.`
    : `Learn about ${primaryKeyword}.`;

  return { tags, seoKeywords, primaryKeyword, defaultMeta };
}

/**
 * Determine category from title/keywords
 * Config-driven, no discountType
 */
function determineCategory(title, location) {
  const config = loadDomainConfig();
  const categories = config.articleCategories || [];

  if (categories.length === 0) return 'guides';

  const titleLower = title?.toLowerCase() || '';

  // Check directCategoryMap keys for matches
  const directMap = config.directCategoryMap || {};
  for (const [key] of Object.entries(directMap)) {
    if (titleLower.includes(key)) {
      return key;
    }
  }

  // Check categoryHierarchy keys
  const hierarchy = config.categoryHierarchy || {};
  for (const [key] of Object.entries(hierarchy)) {
    if (titleLower.includes(key)) {
      return key;
    }
  }

  // Default to first article category
  return categories[0] || 'guides';
}

/**
 * Generate slug from title (ITEM 6: kept as-is)
 */
function generateSlug(title) {
  if (!title) return '';
  return String(title)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Parse user-provided entity list (ITEM 2: renamed from parseRestaurantList)
 */
function parseEntityList(content) {
  if (!content || typeof content !== 'string') return [];

  const entities = [];
  const lines = content.split('\n').filter(line => line.trim());

  let currentEntity = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Check for H2 headings
    const h2Match = trimmed.match(/^##\s+(.+)$/) || trimmed.match(/^<h2[^>]*>(.+?)<\/h2>$/i);
    if (h2Match) {
      if (currentEntity) entities.push(currentEntity);
      currentEntity = {
        entityName: h2Match[1].trim(),
        entityContent: ''
      };
      continue;
    }

    // Check for numbered list items (e.g., "1. Entity Name")
    const numberedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (numberedMatch && !currentEntity) {
      if (currentEntity) entities.push(currentEntity);
      currentEntity = {
        entityName: numberedMatch[1].trim(),
        entityContent: ''
      };
      continue;
    }

    // Check for bold entity names
    const boldMatch = trimmed.match(/^\*\*(.+?)\*\*/) || trimmed.match(/^<strong>(.+?)<\/strong>/i);
    if (boldMatch && !currentEntity) {
      if (currentEntity) entities.push(currentEntity);
      currentEntity = {
        entityName: boldMatch[1].trim(),
        entityContent: trimmed
      };
      continue;
    }

    // Accumulate content for current entity
    if (currentEntity) {
      currentEntity.entityContent += (currentEntity.entityContent ? '\n' : '') + trimmed;
    } else if (trimmed.length > 0) {
      // Treat standalone non-empty lines as entity names if no current entity
      currentEntity = {
        entityName: trimmed,
        entityContent: ''
      };
    }
  }

  if (currentEntity) entities.push(currentEntity);

  // Extract details from content
  return entities.map(entity => ({
    ...entity,
    ...extractEntityDetails(entity.entityContent)
  }));
}

/**
 * Extract entity details from content block (ITEM 2: renamed from extractRestaurantDetails)
 */
function extractEntityDetails(content) {
  if (!content) return {};

  const details = {};

  // Extract location
  const locationMatch = content.match(/(?:located?\s+(?:at|in|on)\s+)(.+?)(?:\.|,|\n|$)/i);
  if (locationMatch) details.location = locationMatch[1].trim();

  // Extract rating
  const ratingMatch = content.match(/(\d+(?:\.\d+)?)\s*(?:stars?|★|⭐)/i);
  if (ratingMatch) details.rating = parseFloat(ratingMatch[1]);

  // Extract description (first sentence if available)
  const sentences = content.split(/\.\s+/);
  if (sentences.length > 0) {
    details.description = sentences[0].trim();
  }

  return details;
}

/**
 * Inject CTA buttons into article content
 * Config-based templates, toggle on/off, no coupon codes
 */
export function injectCTAButtons(content, entities = []) {
  if (!content) return content;

  const config = loadDomainConfig();
  const ctaConfig = config.cta || {};

  // If CTA is disabled, just remove placeholders
  if (!ctaConfig.enabled) {
    return content
      .replace(/\[MAIN_CTA_BUTTON\]/g, '')
      .replace(/\[ENTITY_CTA:[^\]]*\]/g, '')
      .replace(/\[RESTAURANT_CTA_GENERIC:[^\]]*\]/g, '')
      .replace(/\[RESTAURANT_CTA:[^\]]*\]/g, '');
  }

  let result = content;

  // Replace main CTA
  if (ctaConfig.mainCTA) {
    const mainCTAHTML = `
<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 12px; padding: 24px; text-align: center; margin: 24px 0;">
  <h3 style="color: white; margin-bottom: 8px;">${ctaConfig.mainCTA.heading || 'Discover More'}</h3>
  ${ctaConfig.mainCTA.subheading ? `<p style="color: rgba(255,255,255,0.9); margin-bottom: 16px;">${ctaConfig.mainCTA.subheading}</p>` : ''}
  <a href="${ctaConfig.mainCTA.buttonUrl || '/'}" style="display: inline-block; background: white; color: #667eea; padding: 12px 32px; border-radius: 8px; text-decoration: none; font-weight: bold;">${ctaConfig.mainCTA.buttonText || 'Learn More'}</a>
</div>`;
    result = result.replace(/\[MAIN_CTA_BUTTON\]/g, mainCTAHTML);
  }

  // Replace entity CTAs
  if (ctaConfig.entityCTA) {
    // Match both new [ENTITY_CTA:NAME] and legacy [RESTAURANT_CTA_GENERIC:NAME] patterns
    result = result.replace(/\[(?:ENTITY_CTA|RESTAURANT_CTA_GENERIC|RESTAURANT_CTA):([^\]]*)\]/g, (match, entityName) => {
      const cleanName = entityName.trim();
      const entitySlug = cleanName.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');

      const buttonText = (ctaConfig.entityCTA.buttonText || 'Learn More About {{ENTITY_NAME}}')
        .replace(/\{\{ENTITY_NAME\}\}/g, cleanName)
        .replace(/\{\{ENTITY_SLUG\}\}/g, entitySlug);

      const buttonUrl = (ctaConfig.entityCTA.buttonUrl || '#')
        .replace(/\{\{ENTITY_NAME\}\}/g, encodeURIComponent(cleanName))
        .replace(/\{\{ENTITY_SLUG\}\}/g, entitySlug);

      return `
<div style="text-align: center; margin: 16px 0;">
  <a href="${buttonUrl}" style="display: inline-block; background: #667eea; color: white; padding: 10px 24px; border-radius: 8px; text-decoration: none; font-weight: bold;">${buttonText}</a>
</div>`;
    });
  }

  return result;
}

/**
 * Generate a location-category article
 * Main entry point for article generation
 */
export async function generateArticle(location, category, saveToDatabase = false, userTitle = null, articleType = 'guide', userEntityList = null, isPillarContent = false) {
  const config = loadDomainConfig();
  const vars = config.promptVariables || {};

  try {
    logger.info(`\n📝 === Generating Article ===`);
    logger.info(`   Location: ${location}`);
    logger.info(`   Category: ${category}`);
    logger.info(`   Type: ${isPillarContent ? 'PILLAR' : 'CLUSTER'}`);
    logger.info(`   User title: ${userTitle || 'auto'}`);
    logger.info(`   User entity list: ${userEntityList ? 'provided' : 'none'}`);

    // Determine category if not provided
    const finalCategory = category || determineCategory(userTitle, location);

    // Get entities - from user list or database
    let entities = [];
    let userEntityCount = 0;
    let entitySummary = '';

    if (userEntityList && userEntityList.trim()) {
      // Parse user-provided entity list
      const parsedEntities = parseEntityList(userEntityList);
      userEntityCount = parsedEntities.length;
      entitySummary = `USER-PROVIDED ${config.entityPlural?.toUpperCase() || 'ENTITIES'} (${userEntityCount} total):\n`;
      parsedEntities.forEach((entity, i) => {
        entitySummary += `${i + 1}. ${entity.entityName}`;
        if (entity.location) entitySummary += ` - ${entity.location}`;
        if (entity.description) entitySummary += ` - ${entity.description}`;
        entitySummary += '\n';
        if (entity.entityContent) {
          entitySummary += `   Details: ${entity.entityContent.substring(0, 200)}\n`;
        }
      });
    } else {
      // Get entities from database
      entities = await getEntitiesForArticle(location, finalCategory, {
        isPillarContent,
        limit: isPillarContent ? 15 : 10
      });

      if (entities.length > 0) {
        const formatted = formatEntitiesForAI(entities);
        entitySummary = generateEntitySummary(formatted);
      }
    }

    // Build prompt
    const promptType = isPillarContent ? 'pillar' : 'cluster';
    const categoryName = finalCategory.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    const prompt = loadPrompt(promptType, finalCategory, {
      title: userTitle || `Best ${categoryName} in ${location}`,
      location: location || vars.DEFAULT_LOCATION || config.defaultLocation,
      categoryName,
      userEntityCount,
      articleType
    });

    // Add entity data to prompt
    const fullPrompt = `${prompt}\n\n--- ENTITY DATA ---\n${entitySummary || `No ${config.entityPlural || 'entities'} available from database. Use your knowledge to recommend well-known ${config.entityPlural || 'options'} in ${location}.`}`;

    // Generate with AI
    const aiResult = await generateArticleWithAI(fullPrompt);

    if (!aiResult || !aiResult.content) {
      throw new Error('AI returned empty content');
    }

    // Inject CTA buttons
    let finalContent = injectCTAButtons(aiResult.content, entities);

    // Generate article metadata
    const title = userTitle || `Best ${categoryName} in ${location}`;
    const slug = generateSlug(title);

    // Extract excerpt (first paragraph text)
    const excerptMatch = finalContent.match(/<p>(.*?)<\/p>/);
    let excerpt = excerptMatch ? excerptMatch[1].replace(/<[^>]+>/g, '') : '';
    if (excerpt.length > 300) excerpt = excerpt.substring(0, 297) + '...';

    // Generate SEO meta description
    let seoMetaDescription = excerpt || `Discover the best ${categoryName} in ${location}. ${config.platformName} guide.`;
    if (seoMetaDescription.length > 160) seoMetaDescription = seoMetaDescription.substring(0, 157) + '...';

    // Generate tags/keywords from content (more specific than templates)
    const derivedSeo = buildSeoFromContent({
      title,
      location,
      category: finalCategory,
      categoryName,
      htmlContent: finalContent,
      entities,
      config
    });

    const tags = derivedSeo.tags;
    const seoKeywords = derivedSeo.seoKeywords;

    const articleData = {
      title,
      slug,
      content: finalContent,
      excerpt,
      category: finalCategory,
      articleType: articleType || 'guide',
      location: location || config.defaultLocation,
      tags,
      seoMetaDescription,
      seoKeywords,
      primaryKeyword: derivedSeo.primaryKeyword,
      isPillarContent,
      isAiGenerated: true,
      aiModel: aiResult.model,
      aiPromptTokens: aiResult.usage?.promptTokens,
      aiCompletionTokens: aiResult.usage?.completionTokens,
      status: 'draft'
    };

    // Save to database if requested
    if (saveToDatabase) {
      const article = new Article(articleData);
      await article.save();
      logger.info(`✅ Article saved: ${article.title} (${article.slug})`);
      return {
        success: true,
        article,
        usage: aiResult.usage,
        entityCount: entities.length || userEntityCount
      };
    }

    // Return without saving (dry-run)
    return {
      success: true,
      article: articleData,
      usage: aiResult.usage,
      entityCount: entities.length || userEntityCount
    };

  } catch (error) {
    logger.error('Article generation error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

export default { generateArticle, injectCTAButtons };
