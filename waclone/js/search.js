/**
 * Search Engine & Search Results UI Controller for WhatsApp Archive
 *
 * Features:
 * - Case-insensitive full-text search across tens of thousands of messages
 * - Match count display & Prev / Next navigation
 * - Highlighting matching substrings using safe DOM APIs (`<mark>`)
 * - Interactive search results list with date, sender, and context snippet
 * - Click any search result to jump straight to that message in the conversation
 */

import { appendHighlightedText, formatShortDate, formatNumber } from './utils.js';

const MAX_RENDERED_RESULTS_LIST = 250; // Render up to 250 items in dropdown/drawer list at once, with "load more"

export class ChatSearch {
  /**
   * @param {object} options
   * @param {Function} options.onSelectResult - Callback `(messageObj, matchIndex, query) => void`
   * @param {Function} options.onClearSearch - Callback `() => void`
   */
  constructor({ onSelectResult, onClearSearch }) {
    this.onSelectResult = onSelectResult;
    this.onClearSearch = onClearSearch;

    this.messages = [];
    this.query = '';
    this.matches = []; // Array of { message, indexInMessages }
    this.activeMatchPointer = -1;
    this.renderedListCount = 0;
  }

  /**
   * Set the active conversation messages array
   * @param {Array<object>} messages
   */
  setMessages(messages) {
    this.messages = Array.isArray(messages) ? messages : [];
    this.clear();
  }

  /**
   * Execute case-insensitive search across all messages in current conversation
   * @param {string} rawQuery
   * @returns {{ totalMatches: number, activePointer: number, currentMatch: object|null }}
   */
  search(rawQuery) {
    const q = (rawQuery || '').trim();
    this.query = q;
    this.matches = [];
    this.activeMatchPointer = -1;
    this.renderedListCount = 0;

    if (!q || this.messages.length === 0) {
      if (this.onClearSearch) {
        this.onClearSearch();
      }
      return { totalMatches: 0, activePointer: -1, currentMatch: null };
    }

    const lowerQuery = q.toLowerCase();

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      const msgText = (msg.message || '').toLowerCase();
      const senderText = (msg.sender || '').toLowerCase();

      if (msgText.includes(lowerQuery) || senderText.includes(lowerQuery)) {
        this.matches.push({
          message: msg,
          indexInMessages: i
        });
      }
    }

    if (this.matches.length > 0) {
      // Start at the latest (most recent) match like WhatsApp Desktop, or first match
      this.activeMatchPointer = 0;
      const current = this.matches[this.activeMatchPointer];
      if (this.onSelectResult) {
        this.onSelectResult(current.message, current.indexInMessages, this.query);
      }
      return {
        totalMatches: this.matches.length,
        activePointer: this.activeMatchPointer,
        currentMatch: current
      };
    }

    if (this.onSelectResult) {
      this.onSelectResult(null, -1, this.query);
    }

    return { totalMatches: 0, activePointer: -1, currentMatch: null };
  }

  /**
   * Navigate to the next search result
   * @returns {{ totalMatches: number, activePointer: number, currentMatch: object|null }}
   */
  next() {
    if (this.matches.length === 0) {
      return { totalMatches: 0, activePointer: -1, currentMatch: null };
    }
    this.activeMatchPointer = (this.activeMatchPointer + 1) % this.matches.length;
    const current = this.matches[this.activeMatchPointer];
    if (this.onSelectResult) {
      this.onSelectResult(current.message, current.indexInMessages, this.query);
    }
    return {
      totalMatches: this.matches.length,
      activePointer: this.activeMatchPointer,
      currentMatch: current
    };
  }

  /**
   * Navigate to the previous search result
   * @returns {{ totalMatches: number, activePointer: number, currentMatch: object|null }}
   */
  prev() {
    if (this.matches.length === 0) {
      return { totalMatches: 0, activePointer: -1, currentMatch: null };
    }
    this.activeMatchPointer =
      (this.activeMatchPointer - 1 + this.matches.length) % this.matches.length;
    const current = this.matches[this.activeMatchPointer];
    if (this.onSelectResult) {
      this.onSelectResult(current.message, current.indexInMessages, this.query);
    }
    return {
      totalMatches: this.matches.length,
      activePointer: this.activeMatchPointer,
      currentMatch: current
    };
  }

  /**
   * Select a specific match by its index in `this.matches`
   * @param {number} matchIdx
   */
  selectMatchAt(matchIdx) {
    if (matchIdx < 0 || matchIdx >= this.matches.length) return null;
    this.activeMatchPointer = matchIdx;
    const current = this.matches[this.activeMatchPointer];
    if (this.onSelectResult) {
      this.onSelectResult(current.message, current.indexInMessages, this.query);
    }
    return {
      totalMatches: this.matches.length,
      activePointer: this.activeMatchPointer,
      currentMatch: current
    };
  }

  /**
   * Clear current search state
   */
  clear() {
    this.query = '';
    this.matches = [];
    this.activeMatchPointer = -1;
    this.renderedListCount = 0;
    if (this.onClearSearch) {
      this.onClearSearch();
    }
  }

  /**
   * Render search results into a list container element safely using DocumentFragment
   * @param {HTMLElement} listContainer
   * @param {Function} onItemClick - `(matchIndex) => void`
   */
  renderResultsList(listContainer, onItemClick) {
    listContainer.replaceChildren();

    if (!this.query) {
      const empty = document.createElement('div');
      empty.className = 'search-results-empty';
      empty.textContent = 'Ketik kata atau kalimat untuk mencari di dalam percakapan ini.';
      listContainer.appendChild(empty);
      return;
    }

    if (this.matches.length === 0) {
      const noRes = document.createElement('div');
      noRes.className = 'search-results-empty';
      noRes.textContent = `Tidak ditemukan pesan untuk "${this.query}".`;
      listContainer.appendChild(noRes);
      return;
    }

    const fragment = document.createDocumentFragment();
    const limit = Math.min(this.matches.length, MAX_RENDERED_RESULTS_LIST);
    this.renderedListCount = limit;

    for (let i = 0; i < limit; i++) {
      fragment.appendChild(this._createResultItemNode(i, onItemClick));
    }

    if (this.matches.length > limit) {
      const moreBtn = document.createElement('button');
      moreBtn.type = 'button';
      moreBtn.className = 'btn-load-more-results';
      moreBtn.textContent = `Tampilkan semua (${formatNumber(this.matches.length - limit)} hasil lainnya)`;
      moreBtn.addEventListener('click', () => {
        moreBtn.remove();
        const extraFrag = document.createDocumentFragment();
        for (let j = limit; j < this.matches.length; j++) {
          extraFrag.appendChild(this._createResultItemNode(j, onItemClick));
        }
        listContainer.appendChild(extraFrag);
      });
      fragment.appendChild(moreBtn);
    }

    listContainer.appendChild(fragment);
  }

  /**
   * Create a single search result row node
   * @param {number} matchIndex
   * @param {Function} onItemClick
   * @returns {HTMLElement}
   */
  _createResultItemNode(matchIndex, onItemClick) {
    const { message } = this.matches[matchIndex];
    const item = document.createElement('button');
    item.type = 'button';
    item.className =
      'search-result-item' + (matchIndex === this.activeMatchPointer ? ' active' : '');
    item.setAttribute('data-match-idx', String(matchIndex));

    const header = document.createElement('div');
    header.className = 'search-result-header';

    const senderEl = document.createElement('span');
    senderEl.className = 'search-result-sender';
    senderEl.textContent = message.sender || 'Sistem';

    const dateEl = document.createElement('span');
    dateEl.className = 'search-result-date';
    dateEl.textContent = `${formatShortDate(message.date)} • ${message.time}`;

    header.appendChild(senderEl);
    header.appendChild(dateEl);

    const snippetEl = document.createElement('div');
    snippetEl.className = 'search-result-snippet';
    const snippetText = this._buildSnippet(message.message, this.query);
    appendHighlightedText(snippetEl, snippetText, this.query);

    item.appendChild(header);
    item.appendChild(snippetEl);

    item.addEventListener('click', () => {
      onItemClick(matchIndex);
    });

    return item;
  }

  /**
   * Build a concise snippet centered around the first match occurrence
   * @param {string} fullText
   * @param {string} query
   * @returns {string}
   */
  _buildSnippet(fullText, query) {
    const singleLine = (fullText || '').replace(/\s+/g, ' ').trim();
    if (singleLine.length <= 120) return singleLine;

    const lower = singleLine.toLowerCase();
    const idx = lower.indexOf(query.toLowerCase());
    if (idx === -1) return singleLine.slice(0, 120) + '…';

    const start = Math.max(0, idx - 35);
    const end = Math.min(singleLine.length, idx + query.length + 65);
    let snippet = singleLine.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < singleLine.length) snippet = snippet + '…';
    return snippet;
  }
}
