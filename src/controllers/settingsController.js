/**
 * Settings Controller
 * Handles settings pages and config updates
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { loadDomainConfig, reloadConfig } from '../../config/loader.js';
import logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const configPath = join(__dirname, '../../config/default.json');

/**
 * GET /admin/settings - General settings page
 */
export const getSettings = async (req, res) => {
  try {
    const config = loadDomainConfig();
    res.render('admin/settings', {
      title: 'Settings',
      config,
      configJSON: JSON.stringify(config, null, 2)
    });
  } catch (error) {
    logger.error('Settings page error:', error);
    res.status(500).render('error', { title: 'Error', error: { message: error.message } });
  }
};

/**
 * POST /api/settings/general - Update general settings
 */
export const updateGeneralSettings = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const { platformName, baseUrl, entityType, entityPlural, defaultLocation, domain } = req.body;

    if (platformName) config.platformName = platformName;
    if (baseUrl) config.baseUrl = baseUrl;
    if (entityType) config.entityType = entityType;
    if (entityPlural) config.entityPlural = entityPlural;
    if (defaultLocation) config.defaultLocation = defaultLocation;
    if (domain) config.domain = domain;

    // Update promptVariables to match
    config.promptVariables = config.promptVariables || {};
    config.promptVariables.PLATFORM_NAME = config.platformName;
    config.promptVariables.ENTITY_TYPE = config.entityType;
    config.promptVariables.ENTITY_PLURAL = config.entityPlural;
    config.promptVariables.DEFAULT_LOCATION = config.defaultLocation;

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    reloadConfig();

    res.json({ success: true, message: 'Settings updated' });
  } catch (error) {
    logger.error('Update settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/settings/cta - Update CTA settings
 */
export const updateCTASettings = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const { enabled, mainCTA, entityCTA } = req.body;

    config.cta = config.cta || {};
    if (enabled !== undefined) config.cta.enabled = enabled === true || enabled === 'true';

    if (mainCTA) {
      config.cta.mainCTA = {
        heading: mainCTA.heading || config.cta.mainCTA?.heading || 'Explore More',
        subheading: mainCTA.subheading || config.cta.mainCTA?.subheading || '',
        buttonText: mainCTA.buttonText || config.cta.mainCTA?.buttonText || 'Browse All',
        buttonUrl: mainCTA.buttonUrl || config.cta.mainCTA?.buttonUrl || '/browse'
      };
    }

    if (entityCTA) {
      config.cta.entityCTA = {
        buttonText: entityCTA.buttonText || config.cta.entityCTA?.buttonText || 'View {{ENTITY_NAME}}',
        buttonUrl: entityCTA.buttonUrl || config.cta.entityCTA?.buttonUrl || '/entity/{{ENTITY_SLUG}}'
      };
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    reloadConfig();

    res.json({ success: true, message: 'CTA settings updated' });
  } catch (error) {
    logger.error('Update CTA settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/settings/prompts - Update prompt variables
 */
export const updatePromptSettings = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const { promptVariables, aiSystemPromptTemplate } = req.body;

    if (promptVariables && typeof promptVariables === 'object') {
      config.promptVariables = { ...config.promptVariables, ...promptVariables };
    }

    if (aiSystemPromptTemplate !== undefined) {
      config.aiSystemPromptTemplate = aiSystemPromptTemplate;
    }

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    reloadConfig();

    res.json({ success: true, message: 'Prompt settings updated' });
  } catch (error) {
    logger.error('Update prompt settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * POST /api/settings/categories - Update article categories
 */
export const updateCategorySettings = async (req, res) => {
  try {
    const config = loadDomainConfig();
    const { articleCategories, articleTypes, categoryOverrides } = req.body;

    if (articleCategories) config.articleCategories = articleCategories;
    if (articleTypes) config.articleTypes = articleTypes;
    if (categoryOverrides) config.categoryOverrides = categoryOverrides;

    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    reloadConfig();

    res.json({ success: true, message: 'Category settings updated' });
  } catch (error) {
    logger.error('Update category settings error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/settings/config - Get raw config JSON
 */
export const getConfigJSON = async (req, res) => {
  try {
    const config = loadDomainConfig();
    res.json({ success: true, config });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

export default {
  getSettings, updateGeneralSettings,
  updateCTASettings, updatePromptSettings,
  updateCategorySettings, getConfigJSON
};
