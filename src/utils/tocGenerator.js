/**
 * Table of Contents Generator
 * Extracts headings from HTML content and generates a TOC
 * Also adds IDs to headings for anchor linking
 * Copied as-is from ZADI
 */

/**
 * Generate Table of Contents from HTML content
 * @param {string} content - HTML content string
 * @returns {Array} - Array of heading objects with text, level, and id
 */
export function generateTableOfContents(content) {
  if (!content) return [];

  const headingRegex = /<h([2-3])[^>]*>(.*?)<\/h\1>/gi;
  const toc = [];
  let match;

  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1]);
    const text = match[2].replace(/<[^>]+>/g, '').trim();

    if (text) {
      const id = text
        .toLowerCase()
        .replace(/[^\w\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/--+/g, '-')
        .trim();

      toc.push({ text, level, id });
    }
  }

  return toc;
}

/**
 * Add IDs to headings in HTML content for anchor linking
 * @param {string} content - HTML content string
 * @param {Array} toc - Array of TOC items from generateTableOfContents
 * @returns {string} - HTML content with heading IDs added
 */
export function addHeadingIds(content, toc) {
  if (!content || !toc || toc.length === 0) return content;

  let modifiedContent = content;
  const tocMap = new Map();

  toc.forEach(item => {
    tocMap.set(item.text, item.id);
  });

  modifiedContent = modifiedContent.replace(
    /<h([2-3])([^>]*)>(.*?)<\/h\1>/gi,
    (match, level, attrs, text) => {
      const cleanText = text.replace(/<[^>]+>/g, '').trim();
      const id = tocMap.get(cleanText);
      if (id && !attrs.includes('id=')) {
        return `<h${level} id="${id}"${attrs}>${text}</h${level}>`;
      }
      return match;
    }
  );

  return modifiedContent;
}

export default { generateTableOfContents, addHeadingIds };
