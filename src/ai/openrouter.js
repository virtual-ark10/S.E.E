/**
 * OpenRouter AI Integration
 * Template-based system prompt from config
 * Based on ZADI's openrouter.js, stripped of all offer/deal references
 */
import axios from 'axios';
import logger from '../utils/logger.js';
import { loadDomainConfig } from '../../config/loader.js';

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';

/**
 * Build the system prompt using config template variables
 */
function buildSystemPrompt() {
  const config = loadDomainConfig();
  const vars = config.promptVariables || {};

  return `You are an expert SEO content writer for ${vars.PLATFORM_NAME || 'our platform'}.

Your expertise covers ${vars.INDUSTRY_CONTEXT || 'various industries'}. You write comprehensive, SEO-optimized articles that rank well on search engines.

WRITING GUIDELINES:
1. Write in HTML format using tags: <h2>, <h3>, <p>, <ul>, <li>, <ol>, <strong>, <em>
2. Do NOT add any HTML attributes (no class, id, href, style, etc.) - use plain tags only
3. Be comprehensive and authoritative in your content
4. Naturally integrate keywords throughout the content
5. Write for humans first, search engines second
6. Include actionable information and specific details
7. Use data, statistics, and specific examples where possible
8. Create engaging, readable content with proper formatting

ENTITY CONTEXT:
- Entity type: ${vars.ENTITY_TYPE || 'business'}
- Entity plural: ${vars.ENTITY_PLURAL || 'businesses'}
- Default location: ${vars.DEFAULT_LOCATION || 'the area'}
- Platform: ${vars.PLATFORM_NAME || 'our platform'}

CONTENT STRUCTURE:
- Use H2 for main sections
- Use H3 for subsections
- Keep paragraphs concise (2-4 sentences)
- Include bulleted or numbered lists where appropriate
- Include FAQ sections when asked

CTA PLACEHOLDERS:
- Insert [MAIN_CTA_BUTTON] after the introduction
- Insert [ENTITY_CTA:ENTITY_NAME] after each entity description
- These placeholders will be replaced with actual CTA buttons after generation

CRITICAL: Always return ONLY the HTML content. No markdown, no explanation, no wrapping.`;
}

/**
 * Generate article content with Claude via OpenRouter
 */
export async function generateArticleWithAI(userPrompt, options = {}) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  // NOTE: These defaults are computed at call-time (not import-time) so `.env`
  // changes apply after a restart even in ESM import order scenarios.
  const envModel = (process.env.OPENROUTER_MODEL || '').trim();
  const envMaxTokens = Number.parseInt(process.env.OPENROUTER_MAX_TOKENS || '', 10);
  const envTemperature = Number.parseFloat(process.env.OPENROUTER_TEMPERATURE || '');

  const defaultModel = envModel || 'anthropic/claude-sonnet-4-20250514';
  const defaultMaxTokens = Number.isFinite(envMaxTokens) && envMaxTokens > 0 ? envMaxTokens : 8000;
  const defaultTemperature = Number.isFinite(envTemperature) ? envTemperature : 0.7;

  const {
    model = defaultModel,
    maxTokens = defaultMaxTokens,
    temperature = defaultTemperature
  } = options;

  const systemPrompt = buildSystemPrompt();

  try {
    logger.info(`🤖 Calling OpenRouter AI (model: ${model})`);

    const response = await axios.post(OPENROUTER_API_URL, {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      max_tokens: maxTokens,
      temperature
    }, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': loadDomainConfig().baseUrl || 'http://localhost:4000',
        'X-Title': loadDomainConfig().platformName || 'S.E.E'
      },
      timeout: 120000
    });

    const data = response.data;

    if (!data.choices || data.choices.length === 0) {
      throw new Error('No response from AI');
    }

    const content = data.choices[0].message.content;
    const usage = data.usage || {};

    logger.info(`✅ AI response received (${usage.total_tokens || 'N/A'} tokens)`);

    return {
      content,
      usage: {
        promptTokens: usage.prompt_tokens || 0,
        completionTokens: usage.completion_tokens || 0,
        totalTokens: usage.total_tokens || 0
      },
      model: data.model || model
    };
  } catch (error) {
    if (error.response) {
      logger.error('OpenRouter API error:', {
        status: error.response.status,
        data: error.response.data
      });
      throw new Error(`AI API error: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
    }
    logger.error('OpenRouter request error:', error.message);
    throw error;
  }
}

export default { generateArticleWithAI };
