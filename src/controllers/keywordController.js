/**
 * Keyword Planner controller – keyword ideas API and admin page
 */
import { getKeywordIdeas, getKeywordPlannerStatus } from '../services/keywordPlanner.js';
import { loadDomainConfig } from '../../config/loader.js';
import logger from '../utils/logger.js';

/**
 * GET /admin/keywords – Keyword research page
 */
export async function getKeywordsPage(req, res) {
  try {
    const config = loadDomainConfig();
    const status = getKeywordPlannerStatus();
    res.render('admin/keywords', {
      title: 'Keyword Research',
      config,
      keywordPlannerStatus: status,
    });
  } catch (error) {
    logger.error('Keywords page error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
}

/**
 * POST /api/keywords/ideas – Get keyword ideas from Google Keyword Planner
 * Body: { seedKeywords: string[], pageSize?: number, locationId?: string, languageId?: string }
 */
export async function getKeywordIdeasAPI(req, res) {
  try {
    const config = loadDomainConfig();
    if (config.integrations?.keywordPlanner?.enabled === false) {
      return res.status(403).json({ success: false, error: 'Keyword Planner is disabled in config' });
    }

    const { seedKeywords, pageSize, locationId, languageId } = req.body;

    if (!seedKeywords) {
      return res.status(400).json({ success: false, error: 'seedKeywords (array) is required' });
    }

    const seeds = Array.isArray(seedKeywords)
      ? seedKeywords
      : [String(seedKeywords)].filter(Boolean);

    const result = await getKeywordIdeas(seeds, {
      pageSize: pageSize || 100,
      locationId: locationId || undefined,
      languageId: languageId || undefined,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error });
    }

    res.json({ success: true, keywords: result.keywords });
  } catch (error) {
    logger.error('Keyword ideas API error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
}

/**
 * GET /api/keywords/status – Keyword Planner connection status
 */
export async function getKeywordPlannerStatusAPI(req, res) {
  try {
    const status = getKeywordPlannerStatus();
    res.json({ success: true, ...status });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

export default { getKeywordsPage, getKeywordIdeasAPI, getKeywordPlannerStatusAPI };
