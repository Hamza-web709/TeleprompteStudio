/**
 * Sanitizer & Multilingual Direction Detection Utility
 */

const ALLOWED_TAGS = new Set([
  'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'strike',
  'h1', 'h2', 'h3', 'h4', 'span', 'mark', 'div', 'ul', 'ol', 'li'
]);

export function sanitizeHTML(dirtyHtml = '') {
  if (!dirtyHtml || typeof dirtyHtml !== 'string') return '';

  const parser = new DOMParser();
  const doc = parser.parseFromString(dirtyHtml, 'text/html');

  function cleanNode(node) {
    const children = Array.from(node.childNodes);
    for (const child of children) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        const tagName = child.tagName.toLowerCase();
        if (!ALLOWED_TAGS.has(tagName)) {
          // Replace disallowed tag with its inner text
          const textNode = document.createTextNode(child.textContent);
          node.replaceChild(textNode, child);
        } else {
          // Strip dangerous attributes
          const attrs = Array.from(child.attributes);
          for (const attr of attrs) {
            const attrName = attr.name.toLowerCase();
            if (attrName === 'style' || attrName === 'class' || attrName === 'dir') {
              // preserve safe styling or direction
            } else {
              child.removeAttribute(attrName);
            }
          }
          cleanNode(child);
        }
      }
    }
  }

  cleanNode(doc.body);
  return doc.body.innerHTML;
}

/**
 * Detects RTL script (Urdu, Arabic, Persian, Hebrew)
 */
export function isRTLText(text = '') {
  const rtlRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\u0590-\u05FF]/;
  return rtlRegex.test(text);
}
