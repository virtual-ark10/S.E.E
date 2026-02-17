/**
 * Domain Configuration Loader
 * Loads and caches the domain config from config/default.json
 */
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
let cachedConfig = null;

/**
 * Load and cache domain configuration
 * @returns {Object} The domain configuration object
 */
export function loadDomainConfig() {
  if (cachedConfig) return cachedConfig;
  const configPath = join(__dirname, 'default.json');
  cachedConfig = JSON.parse(readFileSync(configPath, 'utf-8'));
  return cachedConfig;
}

/**
 * Clear cached config and reload from disk
 * Called from Settings controller when user saves config changes
 * @returns {Object} The fresh domain configuration object
 */
export function reloadConfig() {
  cachedConfig = null;
  return loadDomainConfig();
}

/**
 * Save updated config to disk and reload cache
 * @param {Object} newConfig - The updated configuration object
 */
export function saveConfig(newConfig) {
  const configPath = join(__dirname, 'default.json');
  writeFileSync(configPath, JSON.stringify(newConfig, null, 2), 'utf-8');
  cachedConfig = null;
  return loadDomainConfig();
}
