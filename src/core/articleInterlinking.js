/**
 * Article Interlinking Service
 * Based on ZADI's articleInterlinking.js
 * ITEM 3: isDishFocusedTitle() removed entirely
 * ITEM 4: suggestClusterTopics() cleaned of deal/cuisine strings, uses config
 */
import Article from '../models/Article.js';
import { loadDomainConfig } from '../../config/loader.js';
import logger from '../utils/logger.js';

/**
 * Detect content type from title patterns (generic, works for any vertical)
 */
export function detectContentType(title) {
  if (!title) return 'general';

  const titleLower = title.toLowerCase();

  // Check for pillar content patterns
  if (titleLower.match(/^(best|top|ultimate|complete|comprehensive)\s/i)) return 'pillar';
  if (titleLower.match(/guide to/i)) return 'pillar';
  if (titleLower.match(/everything you need/i)) return 'pillar';

  // Check for cluster content patterns
  if (titleLower.match(/\d+\s+(best|top|ways|tips|reasons)/i)) return 'cluster';
  if (titleLower.match(/how to/i)) return 'cluster';
  if (titleLower.match(/vs\.?/i)) return 'cluster';
  if (titleLower.match(/review/i)) return 'cluster';

  return 'general';
}

/**
 * Find pillar article for a cluster article
 */
export async function findPillarForCluster(article) {
  try {
    if (!article) return null;

    // Direct reference
    if (article.pillarContentId) {
      const pillar = await Article.findById(article.pillarContentId)
        .select('title slug category location topicCluster');
      if (pillar) return pillar;
    }

    // Find by topic cluster
    if (article.topicCluster) {
      const pillar = await Article.findOne({
        isPillarContent: true,
        topicCluster: article.topicCluster,
        status: 'published',
        _id: { $ne: article._id }
      }).select('title slug category location topicCluster');
      if (pillar) return pillar;
    }

    // Find by category + location
    if (article.category && article.location) {
      const pillar = await Article.findOne({
        isPillarContent: true,
        category: article.category,
        location: article.location,
        status: 'published',
        _id: { $ne: article._id }
      }).select('title slug category location topicCluster');
      if (pillar) return pillar;
    }

    return null;
  } catch (error) {
    logger.error('findPillarForCluster error:', error);
    return null;
  }
}

/**
 * Find cluster articles for a pillar article
 */
export async function findClustersForPillar(article) {
  try {
    if (!article) return [];

    const query = {
      isPillarContent: false,
      status: 'published',
      _id: { $ne: article._id }
    };

    // Find by topic cluster or pillarContentId
    if (article.topicCluster) {
      query.$or = [
        { topicCluster: article.topicCluster },
        { pillarContentId: article._id }
      ];
    } else {
      query.pillarContentId = article._id;
    }

    return await Article.find(query)
      .select('title slug category location topicCluster')
      .sort({ publishedAt: -1 })
      .limit(10);
  } catch (error) {
    logger.error('findClustersForPillar error:', error);
    return [];
  }
}

/**
 * Generate internal links in content
 */
export function generateInternalLinks(content, currentArticle, relatedArticles) {
  if (!content || !relatedArticles || relatedArticles.length === 0) return content;

  let modifiedContent = content;
  const linksAdded = new Set();

  for (const related of relatedArticles) {
    if (linksAdded.size >= 5) break; // Max 5 internal links
    if (!related.title || !related.slug) continue;

    // Try to find a mention of the related article's topic in content
    const keywords = extractLinkKeywords(related.title);

    for (const keyword of keywords) {
      if (linksAdded.has(related.slug)) break;

      // Only link if keyword appears in text (not in headings or existing links)
      const regex = new RegExp(`(?<![<\/])(?<!=")\\b(${escapeRegex(keyword)})\\b(?![^<]*>)(?![^<]*<\/a>)`, 'i');
      const match = modifiedContent.match(regex);

      if (match) {
        const link = `<a href="/blog/${related.slug}">${match[1]}</a>`;
        modifiedContent = modifiedContent.replace(regex, link);
        linksAdded.add(related.slug);
        break;
      }
    }
  }

  return modifiedContent;
}

/**
 * Extract keywords from a title for internal linking
 */
function extractLinkKeywords(title) {
  if (!title) return [];

  // Remove common words
  const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'of', 'to', 'and', 'or', 'best', 'top', 'guide', 'how', 'what', 'where', 'why', 'when']);

  const words = title.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const keywords = [];

  // Multi-word phrases first (better matches)
  for (let i = 0; i < words.length - 1; i++) {
    if (!stopWords.has(words[i]) && !stopWords.has(words[i + 1])) {
      keywords.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  // Single meaningful words
  words.forEach(word => {
    if (!stopWords.has(word) && word.length > 3) {
      keywords.push(word);
    }
  });

  return keywords;
}

/**
 * Suggest cluster topics for a pillar article (ITEM 4: cleaned)
 */
export function suggestClusterTopics(pillarTitle, location) {
  const config = loadDomainConfig();
  const entityType = config.entityType || 'business';
  const suggestions = [];

  if (!pillarTitle) return suggestions;

  // Extract the main topic from title
  const titleWords = pillarTitle.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
  const stopWords = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'of', 'to', 'and', 'or', 'best', 'top', 'guide']);
  const topicWords = titleWords.filter(w => !stopWords.has(w) && w.length > 2);
  const topic = topicWords.slice(0, 2).join(' ');

  if (topic && location) {
    // Config-driven generic templates (ITEM 4)
    suggestions.push(`Best ${topic} ${entityType} in ${location}`);
    suggestions.push(`Top ${topic} Options in ${location}`);
    suggestions.push(`${topic} Guide for ${location}`);

    // Check config categoryHierarchy for related sub-topics
    const hierarchy = config.categoryHierarchy || {};
    for (const [key, parent] of Object.entries(hierarchy)) {
      if (topic.includes(key) || key.includes(topic.split(' ')[0])) {
        (parent.children || []).forEach(child => {
          suggestions.push(`Best ${child} in ${location}`);
        });
      }
    }
  }

  return suggestions;
}

/**
 * Get cluster articles in same topic
 */
export async function getClusterArticles(topicCluster, excludeId) {
  try {
    return await Article.find({
      topicCluster,
      status: 'published',
      _id: { $ne: excludeId }
    })
      .select('title slug category')
      .sort({ publishedAt: -1 })
      .limit(10);
  } catch (error) {
    logger.error('getClusterArticles error:', error);
    return [];
  }
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export default {
  detectContentType,
  findPillarForCluster,
  findClustersForPillar,
  generateInternalLinks,
  suggestClusterTopics,
  getClusterArticles
};
