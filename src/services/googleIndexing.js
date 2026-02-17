/**
 * Google Indexing Service (Optional Integration - GAP 1)
 * Based on ZADI's googleIndexing.js
 * Removed: indexRestaurantPage(), removeRestaurantFromIndex()
 * Made configurable via domain config
 */
import { loadDomainConfig } from '../../config/loader.js';
import logger from '../utils/logger.js';

let jwtClient = null;
let isConfigured = false;

/**
 * Initialize Google Indexing API client
 */
async function initClient() {
  const config = loadDomainConfig();
  const indexingConfig = config.integrations?.googleIndexing;

  if (!indexingConfig?.enabled) {
    logger.debug('Google Indexing API is disabled in config');
    return false;
  }

  try {
    const { google } = await import('googleapis');
    const { readFileSync } = await import('fs');
    const { join } = await import('path');

    const credentialsPath = indexingConfig.credentialsPath || './gsc-credentials.json';
    const credentials = JSON.parse(readFileSync(credentialsPath, 'utf-8'));

    jwtClient = new google.auth.JWT(
      credentials.client_email,
      null,
      credentials.private_key,
      ['https://www.googleapis.com/auth/indexing'],
      null
    );

    await jwtClient.authorize();
    isConfigured = true;
    logger.info('✅ Google Indexing API client initialized');
    return true;
  } catch (error) {
    logger.warn('⚠️ Google Indexing API not configured:', error.message);
    isConfigured = false;
    return false;
  }
}

/**
 * Submit a URL to Google for indexing
 */
async function submitUrlToGoogle(url, type = 'URL_UPDATED') {
  if (!isConfigured) {
    const initialized = await initClient();
    if (!initialized) {
      return { success: false, error: 'Google Indexing not configured' };
    }
  }

  try {
    const { google } = await import('googleapis');
    const indexing = google.indexing({ version: 'v3', auth: jwtClient });

    const result = await indexing.urlNotifications.publish({
      requestBody: {
        url: url,
        type: type
      }
    });

    logger.info(`📤 Submitted to Google Indexing: ${url} (${type})`);
    return { success: true, result: result.data };
  } catch (error) {
    logger.error(`❌ Google Indexing error for ${url}:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Index a blog article
 */
export async function indexArticle(slug) {
  const config = loadDomainConfig();
  if (!config.integrations?.googleIndexing?.enabled) return { success: false, error: 'Disabled' };

  const baseUrl = config.baseUrl || 'http://localhost:4000';
  const url = `${baseUrl}/blog/${slug}`;
  return submitUrlToGoogle(url, 'URL_UPDATED');
}

/**
 * Remove a blog article from index
 */
export async function removeArticleFromIndex(slug) {
  const config = loadDomainConfig();
  if (!config.integrations?.googleIndexing?.enabled) return { success: false, error: 'Disabled' };

  const baseUrl = config.baseUrl || 'http://localhost:4000';
  const url = `${baseUrl}/blog/${slug}`;
  return submitUrlToGoogle(url, 'URL_DELETED');
}

export default { indexArticle, removeArticleFromIndex, submitUrlToGoogle };
