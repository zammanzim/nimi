/**
 * Utility helpers for WhatsApp Archive Viewer
 */

/**
 * Generate a deterministic fingerprint (hash) for a text content + file name
 * to identify duplicate imports without storing duplicate archives.
 * Uses FNV-1a 64-bit approximation via two 32-bit hashes + length.
 * @param {string} content
 * @returns {string}
 */
export function computeFingerprint(content) {
  const str = String(content || '');
  let h1 = 0xdeadbeef ^ str.length;
  let h2 = 0x41c6ce57 ^ str.length;

  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }

  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

  const hex1 = (h1 >>> 0).toString(16).padStart(8, '0');
  const hex2 = (h2 >>> 0).toString(16).padStart(8, '0');
  return `${str.length}-${hex1}${hex2}`;
}

/**
 * Debounce function execution
 * @param {Function} fn
 * @param {number} delayMs
 * @returns {Function}
 */
export function debounce(fn, delayMs = 200) {
  let timer = null;
  return function (...args) {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      fn.apply(this, args);
    }, delayMs);
  };
}

/**
 * Format an ISO date string ("YYYY-MM-DD") to a friendly display string
 * @param {string} isoDate - "YYYY-MM-DD"
 * @returns {string}
 */
export function formatDateBadge(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  const year = Number(parts[0]);
  const month = Number(parts[1]) - 1;
  const day = Number(parts[2]);
  const dateObj = new Date(year, month, day);
  if (Number.isNaN(dateObj.getTime())) return isoDate;

  return dateObj.toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  });
}

/**
 * Format an ISO date string ("YYYY-MM-DD") to compact sidebar date ("DD/MM/YYYY")
 * @param {string} isoDate
 * @returns {string}
 */
export function formatShortDate(isoDate) {
  if (!isoDate) return '';
  const parts = isoDate.split('-');
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

/**
 * Format number with thousand separators
 * @param {number} num
 * @returns {string}
 */
export function formatNumber(num) {
  return Number(num || 0).toLocaleString('id-ID');
}

/**
 * Deterministic avatar color palette from sender name
 * @param {string} name
 * @returns {string} CSS color hex
 */
export function getSenderColor(name) {
  const palette = [
    '#53bdeb',
    '#ff7f50',
    '#e56b6f',
    '#b56576',
    '#06cf9c',
    '#f7b801',
    '#a78bfa',
    '#f472b6',
    '#38bdf8',
    '#fb923c'
  ];
  if (!name) return palette[0];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return palette[Math.abs(hash) % palette.length];
}

/**
 * Get initials from contact/archive name
 * @param {string} name
 * @returns {string}
 */
export function getInitials(name) {
  if (!name) return 'WA';
  const cleaned = name.trim();
  if (!cleaned) return 'WA';
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

/**
 * Safely parse and split text into segments of plain text and validated HTTP/HTTPS URLs.
 * Never uses innerHTML. Returns array of { type: 'text' | 'url', value: string, href?: string }
 * @param {string} text
 * @returns {Array<{type: 'text'|'url', value: string, href?: string}>}
 */
export function tokenizeUrls(text) {
  if (!text) return [{ type: 'text', value: '' }];
  const urlRegex = /https?:\/\/[^\s<>"'`]+/gi;
  const result = [];
  let lastIndex = 0;
  let match;

  while ((match = urlRegex.exec(text)) !== null) {
    let rawUrl = match[0];
    let trailingPunctuation = '';

    // Strip common trailing punctuation from URL match
    while (/[.,;:!?)]$/.test(rawUrl)) {
      trailingPunctuation = rawUrl.slice(-1) + trailingPunctuation;
      rawUrl = rawUrl.slice(0, -1);
    }

    if (match.index > lastIndex) {
      result.push({
        type: 'text',
        value: text.slice(lastIndex, match.index)
      });
    }

    let validHref = null;
    try {
      const parsed = new URL(rawUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        validHref = parsed.href;
      }
    } catch {
      validHref = null;
    }

    if (validHref) {
      result.push({
        type: 'url',
        value: rawUrl,
        href: validHref
      });
    } else {
      result.push({
        type: 'text',
        value: rawUrl
      });
    }

    if (trailingPunctuation) {
      result.push({
        type: 'text',
        value: trailingPunctuation
      });
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push({
      type: 'text',
      value: text.slice(lastIndex)
    });
  }

  return result.length ? result : [{ type: 'text', value: text }];
}

/**
 * Create a DOM DocumentFragment with highlighted search term and clickable safe URLs.
 * Completely safe against XSS (uses createTextNode and validated <a> elements).
 * @param {string} text
 * @param {string} highlightQuery
 * @returns {DocumentFragment}
 */
export function createSafeMessageFragment(text, highlightQuery = '') {
  const fragment = document.createDocumentFragment();
  const segments = tokenizeUrls(text);
  const query = (highlightQuery || '').trim();

  for (const seg of segments) {
    if (seg.type === 'url') {
      const a = document.createElement('a');
      a.href = seg.href;
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.className = 'chat-link';
      appendHighlightedText(a, seg.value, query);
      fragment.appendChild(a);
    } else {
      appendHighlightedText(fragment, seg.value, query);
    }
  }

  return fragment;
}

/**
 * Append text with optional case-insensitive highlight `<mark>` elements using safe DOM APIs.
 * @param {Node} parent
 * @param {string} text
 * @param {string} query
 */
export function appendHighlightedText(parent, text, query) {
  if (!query) {
    parent.appendChild(document.createTextNode(text));
    return;
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const qLen = lowerQuery.length;

  if (qLen === 0) {
    parent.appendChild(document.createTextNode(text));
    return;
  }

  let startIndex = 0;
  let matchIndex = lowerText.indexOf(lowerQuery, startIndex);

  if (matchIndex === -1) {
    parent.appendChild(document.createTextNode(text));
    return;
  }

  while (matchIndex !== -1) {
    if (matchIndex > startIndex) {
      parent.appendChild(document.createTextNode(text.slice(startIndex, matchIndex)));
    }
    const mark = document.createElement('mark');
    mark.className = 'search-highlight';
    mark.textContent = text.slice(matchIndex, matchIndex + qLen);
    parent.appendChild(mark);

    startIndex = matchIndex + qLen;
    matchIndex = lowerText.indexOf(lowerQuery, startIndex);
  }

  if (startIndex < text.length) {
    parent.appendChild(document.createTextNode(text.slice(startIndex)));
  }
}
