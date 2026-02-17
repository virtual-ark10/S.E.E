/**
 * Pillar Content Prompt Template - Comprehensive Guide
 * For broad, authoritative articles (2000-3000 words)
 * All offer/deal/coupon references removed, replaced with entity-only focus
 * Uses {{VARIABLE}} substitution from config
 */

export function generatePillarPrompt(options) {
  const {
    title,
    location,
    categoryName,
    categoryContext = '',
    userEntityCount = 0,
    articleType = 'guide',
    platformName = 'Platform',
    entityType = 'business',
    entityPlural = 'businesses',
    industryContext = ''
  } = options;

  const locationName = location || 'the area';

  return `Create a comprehensive, authoritative, SEO-optimized blog article titled "${title}" for ${platformName}'s blog.

Article Type: Pillar Content (Comprehensive Guide)
Article Focus: ${categoryName} in ${locationName}
Category: ${categoryName}
${categoryContext ? `Category Context: ${categoryContext}` : ''}

CRITICAL REQUIREMENTS - YOU MUST FOLLOW THESE:
1. TITLE REQUIREMENT (ABSOLUTE - NO EXCEPTIONS): The article title MUST be exactly: "${title}" - do NOT modify it, rephrase it, or change it in any way.
2. LOCATION CONSTRAINT (CRITICAL): This article focuses on ${locationName}. Only include ${entityPlural} located in ${locationName}. Verify location from provided data.
3. ENTITY DATA:
   - You will receive ${entityType} data from our database with ratings, locations, descriptions, etc.
   - CRITICAL: ${userEntityCount > 0 ? `You have been provided with ${userEntityCount} ${entityPlural} from the USER. These MUST all be included.` : `No user-provided ${entityPlural}.`}
4. ENTITY PRIORITIZATION:
   ${userEntityCount > 0 ? `- GROUP 1 (FIRST): User-provided ${entityPlural} - MUST appear first
   - GROUP 2 (SECOND): Database ${entityPlural} matching the category/location` : `- Include ${entityPlural} from the database, prioritizing highest-rated
   - Supplement with your knowledge of well-known ${entityPlural} in ${locationName}`}
   - MINIMUM: Include at least 5 total ${entityPlural}
5. Only mention ONE branch/location per ${entityType}.

6. For each ${entityType}:
   - Use H2 heading with the ${entityType} name
   - Create an SEO-optimized tagline (e.g., "Best ${locationName} ${categoryName} for [specialty]")
   - 1-2 paragraphs describing features, specialties, location
   - Include rating and review count if available
   - CTA placeholder after description: [ENTITY_CTA:ENTITY_NAME]

Article Structure (SEO-OPTIMIZED):
1. Introduction (100-150 words, MAX 2 paragraphs) - Engaging intro that:
   - Sets context for ${categoryName} in ${locationName}
   - Promotes ${platformName}
   - Encourages reader engagement

2. MAIN CTA PLACEHOLDER (REQUIRED): Insert [MAIN_CTA_BUTTON] right after the introduction.

3. Main Content:
   A. ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} List/Reviews:
      - Use H2: <h2>Best ${categoryName} ${entityPlural.charAt(0).toUpperCase() + entityPlural.slice(1)} in ${locationName}</h2>
      - List each ${entityType} with details and CTA
      
   B. Types/Varieties of ${categoryName} in ${locationName}:
      - Use H2 heading
      - LIST format with brief explanations
      - Create natural interlinking opportunities
      
   C. Additional Sections (AI-determined based on topic):
      - History, culture, tips, trends, etc.
      - Create depth and value

4. Conclusion (50-100 words):
   - Summary with primary keywords
   - Call-to-action for ${platformName}

5. FAQ Section (REQUIRED):
   - H2: <h2>Frequently Asked Questions About ${categoryName} in ${locationName}</h2>
   - MAX 5 Q&As targeting LSI/secondary keywords
   - H3 for questions, <p> for answers

SEO Keyword Strategy:
- Primary: "${locationName} ${categoryName}", "best ${categoryName} in ${locationName}", "${categoryName} ${entityPlural} ${locationName}"
- LSI: "${categoryName} guide ${locationName}", "top ${categoryName} ${locationName}", "${locationName} ${categoryName} recommendations"
- Integrate naturally throughout headings and content

Pillar/Cluster Interlinking:
- This is a PILLAR article (broad, comprehensive)
- Mention specific subtopics that could be cluster articles
- Use natural language for internal linking opportunities

Tone: Friendly, informative, authoritative
Length: 2000-3000 words
Format: HTML tags only (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>)
CRITICAL: Do NOT add any HTML attributes - use plain tags only`;
}
