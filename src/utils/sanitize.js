/**
 * Input Sanitization Utilities
 * Provides comprehensive input sanitization for XSS and injection prevention
 * Copied as-is from ZADI (GAP 7)
 */

/**
 * Sanitize string for safe HTML rendering
 * Removes potential XSS vectors while preserving basic formatting
 * @param {string} input - Raw input string
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum allowed string length
 * @returns {string} Sanitized string
 */
export function sanitizeForHTML(input, options = {}) {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Encode HTML entities to prevent XSS
  sanitized = sanitized
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
  
  // Truncate if needed
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize text content (allows some HTML for rich text editors)
 * @param {string} input - Raw input string
 * @param {Object} options - Sanitization options
 * @param {number} options.maxLength - Maximum allowed string length
 * @returns {string} Sanitized string
 */
export function sanitizeTextContent(input, options = {}) {
  if (!input || typeof input !== 'string') return '';
  
  let sanitized = input.trim();
  
  // Remove null bytes
  sanitized = sanitized.replace(/\0/g, '');
  
  // Remove script tags and event handlers
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*(['"])[^'"]*\1/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=\s*[^\s>]*/gi, '');
  
  // Remove javascript: URLs
  sanitized = sanitized.replace(/javascript\s*:/gi, '');
  sanitized = sanitized.replace(/data\s*:\s*text\/html/gi, '');
  
  // Remove iframes, objects, embeds
  sanitized = sanitized.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '');
  sanitized = sanitized.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, '');
  sanitized = sanitized.replace(/<embed[^>]*>/gi, '');
  
  // Truncate if needed
  if (options.maxLength && sanitized.length > options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  return sanitized;
}

/**
 * Sanitize an array of strings
 * @param {Array} arr - Array of strings to sanitize
 * @param {Object} options - Sanitization options
 * @returns {Array} Array of sanitized strings
 */
export function sanitizeArray(arr, options = {}) {
  if (!Array.isArray(arr)) return [];
  return arr
    .filter(item => item && typeof item === 'string')
    .map(item => sanitizeForHTML(item.trim(), options))
    .filter(item => item.length > 0);
}

export default { sanitizeForHTML, sanitizeTextContent, sanitizeArray };
