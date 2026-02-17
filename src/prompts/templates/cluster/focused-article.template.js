/**
 * Cluster Content Prompt Template - Focused Article
 * For specific, focused articles (1200-1800 words)
 * All offer/deal/coupon references removed, entity-only focus
 * Renamed from ZADI's "deal-focused" to "focused-article"
 */

export function generateClusterPrompt(options) {
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

  return `Create a focused, SEO-optimized blog article titled "${title}" for ${platformName}'s blog.

Article Type: Cluster Content (Focused Article)
Article Focus: ${categoryName} in ${locationName}
Category: ${categoryName}
${categoryContext ? `Category Context: ${categoryContext}` : ''}

CRITICAL REQUIREMENTS:
1. TITLE: The article title MUST be exactly: "${title}" - do NOT modify it.
2. LOCATION: Only include ${entityPlural} in ${locationName}. Verify from provided data.
3. ENTITY DATA:
   - You will receive ${entityType} data from our database
   - ${userEntityCount > 0 ? `${userEntityCount} user-provided ${entityPlural} MUST be included.` : `No user-provided ${entityPlural}.`}
4. ENTITY PRIORITIZATION:
   ${userEntityCount > 0 ? `- GROUP 1: User-provided ${entityPlural} (appear FIRST)
   - GROUP 2: Database ${entityPlural}` : `- Include ${entityPlural} from database, prioritizing topic-relevant ones
   - Include variety: different areas, price ranges, specialties`}
   - MINIMUM: Include at least 5 total ${entityPlural}
5. Only mention ONE branch/location per ${entityType}.

6. For each ${entityType}:
   - H2 heading with name
   - SEO tagline targeting primary keyword
   - 1-2 paragraphs with features, specialties, location
   - Include rating/review count if available
   - CTA: [ENTITY_CTA:ENTITY_NAME]

Article Structure:
1. Introduction (100-150 words, MAX 2 paragraphs):
   - Context for ${categoryName} in ${locationName}
   - Can reference broader pillar topic
   - Promote ${platformName}

2. MAIN CTA: Insert [MAIN_CTA_BUTTON] after introduction.

3. Main Content (AI determines best format):
   
   OPTION A - ${entityType.charAt(0).toUpperCase() + entityType.slice(1)} List Format:
   - Each ${entityType} as H2 section
   - Tagline + description + CTA
   
   OPTION B - Narrative Sections:
   - Organize by location, price, or criteria
   
   OPTION C - Comparison Format:
   - Compare different options
   
   ENTITY SELECTION (CLUSTER CONTENT):
   - Prioritize TOPIC-RELEVANT, VARIED, and NICHE ${entityPlural}
   - Include specialized ${entityPlural} that excel at the specific topic
   - Include VARIETY for differentiation
   - Each cluster should feature DIFFERENT ${entityPlural}

4. Conclusion (50-100 words):
   - Brief summary with primary keywords
   - CTA for ${platformName}
   - Reference broader pillar topic if relevant

5. FAQ Section (REQUIRED):
   - H2: <h2>Frequently Asked Questions About ${categoryName} in ${locationName}</h2>
   - MAX 5 Q&As targeting LSI keywords
   - H3 for questions, <p> for answers

SEO Keywords:
- Primary: "${locationName} ${categoryName}", "best ${categoryName} in ${locationName}"
- LSI: "${categoryName} guide", "top ${categoryName} ${locationName}"
- Integrate naturally

Pillar/Cluster: This is a CLUSTER article. Reference broader pillar topic naturally.

Tone: Friendly, informative, action-oriented
Length: 1200-1800 words
Format: HTML tags only (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <em>)
CRITICAL: Do NOT add any HTML attributes - use plain tags only`;
}
