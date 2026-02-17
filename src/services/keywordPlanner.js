/**
 * Google Keyword Planner (Google Ads API) integration
 * Fetches keyword ideas and search volume for S.E.E topic research
 */
import { GoogleAdsApi, services } from 'google-ads-api';
import { loadDomainConfig } from '../../config/loader.js';
import logger from '../utils/logger.js';

let client = null;
let customer = null;

function getConfig() {
  return loadDomainConfig();
}

function isConfigured() {
  const clientId = process.env.GOOGLE_ADS_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_ADS_CLIENT_SECRET;
  const developerToken = process.env.GOOGLE_ADS_DEVELOPER_TOKEN;
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  const customerId = process.env.GOOGLE_ADS_CUSTOMER_ID;
  return !!(clientId && clientSecret && developerToken && refreshToken && customerId);
}

function getClient() {
  if (!isConfigured()) return null;
  if (client) return { client, customer };

  try {
    client = new GoogleAdsApi({
      client_id: process.env.GOOGLE_ADS_CLIENT_ID,
      client_secret: process.env.GOOGLE_ADS_CLIENT_SECRET,
      developer_token: process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
    });

    const rawCustomerId = process.env.GOOGLE_ADS_CUSTOMER_ID.replace(/-/g, '');
    customer = client.Customer({
      customer_id: rawCustomerId,
      refresh_token: process.env.GOOGLE_ADS_REFRESH_TOKEN,
    });

    return { client, customer };
  } catch (err) {
    logger.error('Keyword Planner client init error:', err);
    return null;
  }
}

/**
 * Generate keyword ideas from seed keywords (Keyword Planner–style)
 * @param {string[]} seedKeywords - One or more seed keywords/phrases
 * @param {Object} options - { pageSize, locationId, languageId }
 * @returns {Promise<{ success: boolean, keywords?: Array<{ text, avgMonthlySearches, competition }, error?: string }>}
 */
export async function getKeywordIdeas(seedKeywords, options = {}) {
  const { pageSize = 100, locationId, languageId } = options;

  if (!Array.isArray(seedKeywords) || seedKeywords.length === 0) {
    return { success: false, error: 'At least one seed keyword is required' };
  }

  const trimmed = seedKeywords.map((k) => String(k).trim()).filter(Boolean);
  if (trimmed.length === 0) {
    return { success: false, error: 'No valid seed keywords' };
  }

  const creds = getClient();
  if (!creds) {
    return {
      success: false,
      error: 'Keyword Planner not configured. Set GOOGLE_ADS_CLIENT_ID, GOOGLE_ADS_CLIENT_SECRET, GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_REFRESH_TOKEN, GOOGLE_ADS_CUSTOMER_ID in .env',
    };
  }

  const { customer: cust } = creds;

  try {
    const keywordSeed = new services.KeywordSeed({ keywords: trimmed });
    const customerId = cust.credentials.customer_id;
    const request = {
      customer_id: customerId.startsWith('customers/') ? customerId : `customers/${customerId}`,
      page_size: Math.min(Number(pageSize) || 100, 1000),
      keyword_seed: keywordSeed,
    };

    if (locationId) {
      request.geo_target_constants = [
        locationId.startsWith('geoTargetConstants/') ? locationId : `geoTargetConstants/${locationId}`,
      ];
    }
    if (languageId) {
      request.language = languageId.startsWith('languageConstants/')
        ? languageId
        : `languageConstants/${languageId}`;
    }

    const response = await cust.keywordPlanIdeas.generateKeywordIdeas(request);

    const rawResults = response.results || response.keyword_ideas || [];
    const results = rawResults.map((r) => {
      const idea = r.keyword_idea || r;
      const metrics = idea.keyword_idea_metrics || {};
      const avg = metrics.avg_monthly_searches ?? metrics.avgMonthlySearches;
      const comp = metrics.competition ?? {};
      return {
        text: idea.text || r.text || '',
        avgMonthlySearches: (typeof avg === 'object' && avg !== null ? avg.value : avg) ?? 0,
        competition: comp.name || comp || 'UNSPECIFIED',
      };
    });

    logger.info(`Keyword Planner: ${results.length} ideas for seeds [${trimmed.join(', ')}]`);
    return { success: true, keywords: results };
  } catch (err) {
    const message = err.message || JSON.stringify(err);
    logger.error('Keyword Planner API error:', { message, stack: err.stack });
    return {
      success: false,
      error: message,
    };
  }
}

export function getKeywordPlannerStatus() {
  const config = getConfig();
  const enabled = config.integrations?.keywordPlanner?.enabled !== false && isConfigured();
  return {
    enabled,
    configured: isConfigured(),
  };
}

export default { getKeywordIdeas, getKeywordPlannerStatus, isConfigured };
