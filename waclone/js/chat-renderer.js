/**
 * High-performance Windowed Virtual Chat Renderer for WhatsApp Archive
 *
 * Handles tens of thousands of messages smoothly without freezing the browser:
 * - Maintains a sliding window of rendered messages (e.g. 140 items around current view)
 * - Preserves scroll position seamlessly when prepending older messages or appending newer ones
 * - Groups messages by date and inserts sticky/inline date separator badges
 * - Supports jumping directly to any message index, date, top, or bottom
 * - Uses safe DOM APIs (DocumentFragment, textContent, validated URLs) — never innerHTML
 */

import {
  formatDateBadge,
  getSenderColor,
  createSafeMessageFragment
} from './utils.js';

const WINDOW_SIZE = 140; // Number of messages rendered at a time
const BATCH_STEP = 60;   // Number of messages to shift window by when scrolling near edge

export class ChatRenderer {
  /**
   * @param {object} options
   * @param {HTMLElement} options.scrollContainer - Scrollable `.chat-messages-viewport`
   * @param {HTMLElement} options.contentElement - Inner `.chat-messages-list`
   * @param {HTMLElement} options.floatingDateEl - Floating sticky date badge element
   * @param {Function} [options.onVisibleDateChange] - Callback when visible date changes
   */
  constructor({ scrollContainer, contentElement, floatingDateEl, onVisibleDateChange, onBubbleMenuOpen }) {
    this.scrollContainer = scrollContainer;
    this.contentElement = contentElement;
    this.floatingDateEl = floatingDateEl;
    this.onVisibleDateChange = onVisibleDateChange || null;
    this.onBubbleMenuOpen = onBubbleMenuOpen || null;

    this.messages = [];
    this.ownerSender = '';
    this.isGroupChat = false;
    this.highlightQuery = '';
    this.activeMessageId = null;

    // Window state: [startIndex, endIndex)
    this.startIndex = 0;
    this.endIndex = 0;
    this.isAdjustingScroll = false;

    // Map of date string ("YYYY-MM-DD") -> first message index
    this.dateFirstIndexMap = new Map();
    // Map of message ID -> message index
    this.idToIndexMap = new Map();

    // Top and bottom sentinel/spacer elements
    this.topSpacer = document.createElement('div');
    this.topSpacer.className = 'virtual-spacer virtual-spacer-top';
    this.bottomSpacer = document.createElement('div');
    this.bottomSpacer.className = 'virtual-spacer virtual-spacer-bottom';

    this.avgRowHeight = 62;
    this.scrollTicking = false;

    this._bindEvents();
  }

  _bindEvents() {
    this.scrollContainer.addEventListener('scroll', () => {
      if (this.scrollTicking) return;
      this.scrollTicking = true;
      requestAnimationFrame(() => {
        this._handleScroll();
        this.scrollTicking = false;
      });
    }, { passive: true });
  }

  /**
   * Load a conversation into the renderer
   * @param {Array<object>} messages
   * @param {object} config
   * @param {string} config.ownerSender
   * @param {number} config.senderCount
   * @param {string} [config.highlightQuery='']
   * @param {'bottom'|'top'|number} [config.initialPosition='bottom']
   */
  setConversation(messages, { ownerSender = '', senderCount = 2, highlightQuery = '', initialPosition = 'bottom' } = {}) {
    this.messages = Array.isArray(messages) ? messages : [];
    this.ownerSender = (ownerSender || '').trim();
    this.isGroupChat = senderCount > 2;
    this.highlightQuery = highlightQuery || '';
    this.activeMessageId = null;

    // Index dates and message IDs for O(1) lookup
    this.dateFirstIndexMap.clear();
    this.idToIndexMap.clear();

    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      this.idToIndexMap.set(msg.id, i);
      if (msg.date && !this.dateFirstIndexMap.has(msg.date)) {
        this.dateFirstIndexMap.set(msg.date, i);
      }
    }

    const total = this.messages.length;
    if (total === 0) {
      this.startIndex = 0;
      this.endIndex = 0;
      this.contentElement.replaceChildren();
      this._updateFloatingDate(null);
      return;
    }

    if (initialPosition === 'top') {
      this.startIndex = 0;
      this.endIndex = Math.min(total, WINDOW_SIZE);
      this._renderWindow();
      this.scrollContainer.scrollTop = 0;
    } else if (typeof initialPosition === 'number') {
      this.scrollToIndex(initialPosition, { highlightPulse: false });
      return;
    } else {
      // Default to bottom (latest messages) like WhatsApp
      this.endIndex = total;
      this.startIndex = Math.max(0, total - WINDOW_SIZE);
      this._renderWindow();
      this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    }

    this._updateVisibleDateFromViewport();
  }

  /**
   * Update owner sender name and re-render current window in place
   * @param {string} ownerSender
   */
  setOwnerSender(ownerSender) {
    this.ownerSender = (ownerSender || '').trim();
    const prevScrollTop = this.scrollContainer.scrollTop;
    this._renderWindow();
    this.scrollContainer.scrollTop = prevScrollTop;
  }

  /**
   * Re-render the currently visible message window while preserving scroll position
   * and clamping startIndex/endIndex after messages are added or deleted.
   */
  refreshCurrentWindow() {
    const prevScrollTop = this.scrollContainer.scrollTop;

    // Rebuild lookup maps
    this.dateFirstIndexMap.clear();
    this.idToIndexMap.clear();
    for (let i = 0; i < this.messages.length; i++) {
      const msg = this.messages[i];
      this.idToIndexMap.set(msg.id, i);
      if (msg.date && !this.dateFirstIndexMap.has(msg.date)) {
        this.dateFirstIndexMap.set(msg.date, i);
      }
    }

    const total = this.messages.length;
    if (total === 0) {
      this.startIndex = 0;
      this.endIndex = 0;
      this.contentElement.replaceChildren();
      this._updateFloatingDate(null);
      return;
    }

    if (this.endIndex > total) {
      this.endIndex = total;
    }
    if (this.endIndex - this.startIndex < WINDOW_SIZE) {
      this.startIndex = Math.max(0, this.endIndex - WINDOW_SIZE);
    }

    this._renderWindow();
    this.scrollContainer.scrollTop = prevScrollTop;
    this._updateVisibleDateFromViewport();
  }

  /**
   * Update search highlight query and re-render current window
   * @param {string} query
   * @param {string|null} [activeMessageId=null]
   */
  setHighlightQuery(query, activeMessageId = null) {
    this.highlightQuery = (query || '').trim();
    this.activeMessageId = activeMessageId;
    const prevScrollTop = this.scrollContainer.scrollTop;
    this._renderWindow();
    this.scrollContainer.scrollTop = prevScrollTop;
  }

  /**
   * Scroll to the very first message in the archive
   */
  scrollToTop() {
    if (this.messages.length === 0) return;
    this.startIndex = 0;
    this.endIndex = Math.min(this.messages.length, WINDOW_SIZE);
    this._renderWindow();
    this.scrollContainer.scrollTop = 0;
    this._updateVisibleDateFromViewport();
  }

  /**
   * Scroll to the very last message in the archive
   */
  scrollToBottom() {
    const total = this.messages.length;
    if (total === 0) return;
    this.endIndex = total;
    this.startIndex = Math.max(0, total - WINDOW_SIZE);
    this._renderWindow();
    this.scrollContainer.scrollTop = this.scrollContainer.scrollHeight;
    this._updateVisibleDateFromViewport();
  }

  /**
   * Scroll to a specific message by its ID
   * @param {string} messageId
   * @param {object} [options]
   */
  scrollToMessageId(messageId, options = { highlightPulse: true }) {
    const index = this.idToIndexMap.get(messageId);
    if (index === undefined) return false;
    this.activeMessageId = messageId;
    return this.scrollToIndex(index, options);
  }

  /**
   * Scroll to a specific message index in `this.messages`
   * @param {number} targetIndex
   * @param {object} [options]
   * @returns {boolean}
   */
  scrollToIndex(targetIndex, { highlightPulse = true, align = 'center' } = {}) {
    const total = this.messages.length;
    if (total === 0 || targetIndex < 0 || targetIndex >= total) return false;

    const halfWindow = Math.floor(WINDOW_SIZE / 2);
    this.startIndex = Math.max(0, targetIndex - halfWindow);
    this.endIndex = Math.min(total, this.startIndex + WINDOW_SIZE);
    if (this.endIndex - this.startIndex < WINDOW_SIZE) {
      this.startIndex = Math.max(0, this.endIndex - WINDOW_SIZE);
    }

    const targetMsg = this.messages[targetIndex];
    if (highlightPulse && targetMsg) {
      this.activeMessageId = targetMsg.id;
    }

    this._renderWindow();

    const targetEl = this.contentElement.querySelector(`[data-msg-index="${targetIndex}"]`);
    if (targetEl) {
      const containerRect = this.scrollContainer.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();
      const offsetWithinContainer = targetRect.top - containerRect.top + this.scrollContainer.scrollTop;

      if (align === 'top') {
        this.scrollContainer.scrollTop = Math.max(0, offsetWithinContainer - 48);
      } else {
        this.scrollContainer.scrollTop = Math.max(
          0,
          offsetWithinContainer - containerRect.height / 2 + targetRect.height / 2
        );
      }

      if (highlightPulse) {
        targetEl.classList.remove('message-row-pulse');
        // Force reflow to restart animation
        void targetEl.offsetWidth;
        targetEl.classList.add('message-row-pulse');
      }
    }

    this._updateVisibleDateFromViewport();
    return true;
  }

  /**
   * Navigate to a given ISO date ("YYYY-MM-DD") or the closest available date
   * @param {string} targetIsoDate
   * @returns {{ foundDate: string|null, exact: boolean }}
   */
  scrollToDate(targetIsoDate) {
    if (!targetIsoDate || this.messages.length === 0) {
      return { foundDate: null, exact: false };
    }

    if (this.dateFirstIndexMap.has(targetIsoDate)) {
      const idx = this.dateFirstIndexMap.get(targetIsoDate);
      this.scrollToIndex(idx, { highlightPulse: true, align: 'top' });
      return { foundDate: targetIsoDate, exact: true };
    }

    // Find closest available date (prefer first date >= targetIsoDate, or last date if after all)
    const availableDates = Array.from(this.dateFirstIndexMap.keys()).sort();
    let bestDate = availableDates.find((d) => d >= targetIsoDate);
    if (!bestDate) {
      bestDate = availableDates[availableDates.length - 1];
    }

    const idx = this.dateFirstIndexMap.get(bestDate);
    this.scrollToIndex(idx, { highlightPulse: true, align: 'top' });
    return { foundDate: bestDate, exact: false };
  }

  /**
   * Handle scroll events for virtual window shifting & sticky date update
   */
  _handleScroll() {
    if (this.isAdjustingScroll || this.messages.length === 0) return;

    const scrollTop = this.scrollContainer.scrollTop;
    const scrollHeight = this.scrollContainer.scrollHeight;
    const clientHeight = this.scrollContainer.clientHeight;

    const topSpacerHeight = this.topSpacer.offsetHeight || 0;
    const bottomSpacerHeight = this.bottomSpacer.offsetHeight || 0;

    // Distance from rendered content top & bottom
    const distFromRenderedTop = scrollTop - topSpacerHeight;
    const renderedBottom = scrollHeight - bottomSpacerHeight;
    const distToRenderedBottom = renderedBottom - (scrollTop + clientHeight);

    // Load older messages when scrolling near top of rendered window
    if (distFromRenderedTop < 350 && this.startIndex > 0) {
      this._shiftWindowUp();
    } else if (distToRenderedBottom < 350 && this.endIndex < this.messages.length) {
      this._shiftWindowDown();
    }

    this._updateVisibleDateFromViewport();
  }

  /**
   * Shift the rendered window upward (prepend older messages) while keeping exact visual scroll position
   */
  _shiftWindowUp() {
    const firstVisibleEl = this.contentElement.querySelector('[data-msg-index]');
    const anchorIndex = firstVisibleEl ? firstVisibleEl.getAttribute('data-msg-index') : null;
    const anchorPrevOffset = firstVisibleEl
      ? firstVisibleEl.getBoundingClientRect().top - this.scrollContainer.getBoundingClientRect().top
      : 0;

    const newStart = Math.max(0, this.startIndex - BATCH_STEP);
    const newEnd = Math.min(this.messages.length, newStart + WINDOW_SIZE);

    if (newStart === this.startIndex) return;

    this.isAdjustingScroll = true;
    this.startIndex = newStart;
    this.endIndex = newEnd;
    this._renderWindow();

    if (anchorIndex !== null) {
      const newAnchorEl = this.contentElement.querySelector(`[data-msg-index="${anchorIndex}"]`);
      if (newAnchorEl) {
        const newOffset =
          newAnchorEl.getBoundingClientRect().top - this.scrollContainer.getBoundingClientRect().top;
        this.scrollContainer.scrollTop += newOffset - anchorPrevOffset;
      }
    }
    this.isAdjustingScroll = false;
  }

  /**
   * Shift the rendered window downward (append newer messages) while keeping exact visual scroll position
   */
  _shiftWindowDown() {
    const renderedItems = this.contentElement.querySelectorAll('[data-msg-index]');
    const lastVisibleEl = renderedItems.length ? renderedItems[renderedItems.length - 1] : null;
    const anchorIndex = lastVisibleEl ? lastVisibleEl.getAttribute('data-msg-index') : null;
    const anchorPrevOffset = lastVisibleEl
      ? lastVisibleEl.getBoundingClientRect().top - this.scrollContainer.getBoundingClientRect().top
      : 0;

    const newEnd = Math.min(this.messages.length, this.endIndex + BATCH_STEP);
    const newStart = Math.max(0, newEnd - WINDOW_SIZE);

    if (newEnd === this.endIndex) return;

    this.isAdjustingScroll = true;
    this.startIndex = newStart;
    this.endIndex = newEnd;
    this._renderWindow();

    if (anchorIndex !== null) {
      const newAnchorEl = this.contentElement.querySelector(`[data-msg-index="${anchorIndex}"]`);
      if (newAnchorEl) {
        const newOffset =
          newAnchorEl.getBoundingClientRect().top - this.scrollContainer.getBoundingClientRect().top;
        this.scrollContainer.scrollTop += newOffset - anchorPrevOffset;
      }
    }
    this.isAdjustingScroll = false;
  }

  /**
   * Render messages in range `[this.startIndex, this.endIndex)` using DocumentFragment
   */
  _renderWindow() {
    const fragment = document.createDocumentFragment();

    const topCount = this.startIndex;
    const bottomCount = Math.max(0, this.messages.length - this.endIndex);

    this.topSpacer.style.height = `${topCount * this.avgRowHeight}px`;
    this.bottomSpacer.style.height = `${bottomCount * this.avgRowHeight}px`;

    fragment.appendChild(this.topSpacer);

    const ownerLower = this.ownerSender.toLowerCase();

    for (let i = this.startIndex; i < this.endIndex; i++) {
      const msg = this.messages[i];
      const prevMsg = i > 0 ? this.messages[i - 1] : null;

      // Insert date separator whenever the date changes from previous message
      if (!prevMsg || prevMsg.date !== msg.date) {
        fragment.appendChild(this._createDateSeparatorNode(msg.date));
      }

      const isSameSenderAsPrev =
        prevMsg &&
        prevMsg.date === msg.date &&
        prevMsg.type !== 'system' &&
        msg.type !== 'system' &&
        prevMsg.sender === msg.sender;

      fragment.appendChild(this._createMessageNode(msg, i, ownerLower, isSameSenderAsPrev));
    }

    fragment.appendChild(this.bottomSpacer);
    this.contentElement.replaceChildren(fragment);
  }

  /**
   * Create a date separator DOM node
   * @param {string} isoDate
   * @returns {HTMLElement}
   */
  _createDateSeparatorNode(isoDate) {
    const wrapper = document.createElement('div');
    wrapper.className = 'date-separator';
    wrapper.setAttribute('data-date-badge', isoDate);

    const pill = document.createElement('span');
    pill.className = 'date-separator-pill';
    pill.textContent = formatDateBadge(isoDate);

    wrapper.appendChild(pill);
    return wrapper;
  }

  /**
   * Create a single message row DOM node (Safe DOM APIs only)
   * @param {object} msg
   * @param {number} index
   * @param {string} ownerLower
   * @param {boolean} isConsecutive
   * @returns {HTMLElement}
   */
  _createMessageNode(msg, index, ownerLower, isConsecutive) {
    const row = document.createElement('div');
    row.setAttribute('data-msg-index', String(index));
    row.setAttribute('data-msg-id', msg.id);
    row.setAttribute('data-msg-date', msg.date);

    if (msg.type === 'system' || !msg.sender) {
      row.className = 'message-row message-row-system';
      const sysBubble = document.createElement('div');
      sysBubble.className = 'system-bubble';
      sysBubble.appendChild(createSafeMessageFragment(msg.message, this.highlightQuery));
      row.appendChild(sysBubble);
      return row;
    }

    const isOutgoing = ownerLower.length > 0 && msg.sender.toLowerCase() === ownerLower;
    row.className = [
      'message-row',
      isOutgoing ? 'message-row-outgoing' : 'message-row-incoming',
      isConsecutive ? 'message-row-consecutive' : 'message-row-first',
      this.activeMessageId === msg.id ? 'message-row-active' : ''
    ]
      .filter(Boolean)
      .join(' ');

    const bubble = document.createElement('div');
    bubble.className = [
      'message-bubble',
      isOutgoing ? 'bubble-outgoing' : 'bubble-incoming',
      msg.type === 'media' ? 'bubble-media' : ''
    ]
      .filter(Boolean)
      .join(' ');

    // Display sender name inside bubble if group chat (> 2 senders) and incoming and first in group
    // Or also show subtle sender label if not outgoing and user enabled/group chat
    if (this.isGroupChat && !isOutgoing && !isConsecutive) {
      const senderEl = document.createElement('div');
      senderEl.className = 'message-sender-name';
      senderEl.style.color = getSenderColor(msg.sender);
      senderEl.textContent = msg.sender;
      bubble.appendChild(senderEl);
    }

    const bodyEl = document.createElement('div');
    bodyEl.className = 'message-body';

    if (msg.type === 'media') {
      const mediaBadge = document.createElement('span');
      mediaBadge.className = 'media-omitted-badge';

      const iconSpan = document.createElement('span');
      iconSpan.className = 'media-icon';
      iconSpan.setAttribute('aria-hidden', 'true');
      iconSpan.textContent = '📷';

      const textSpan = document.createElement('span');
      textSpan.appendChild(createSafeMessageFragment(msg.message, this.highlightQuery));

      mediaBadge.appendChild(iconSpan);
      mediaBadge.appendChild(textSpan);
      bodyEl.appendChild(mediaBadge);
    } else {
      const textSpan = document.createElement('span');
      textSpan.className = 'message-text';
      textSpan.appendChild(createSafeMessageFragment(msg.message, this.highlightQuery));
      bodyEl.appendChild(textSpan);
    }

    // Metadata footer (timestamp + edited label + subtle read checkmark for outgoing)
    const metaEl = document.createElement('span');
    metaEl.className = 'message-meta';

    if (msg.edited) {
      const editedEl = document.createElement('span');
      editedEl.className = 'message-edited-label';
      editedEl.textContent = 'Diedit';
      metaEl.appendChild(editedEl);
    }

    const timeEl = document.createElement('time');
    timeEl.className = 'message-time';
    timeEl.textContent = msg.time;
    metaEl.appendChild(timeEl);

    if (isOutgoing) {
      const ticksEl = document.createElement('span');
      ticksEl.className = 'message-ticks';
      ticksEl.setAttribute('aria-hidden', 'true');
      ticksEl.textContent = '✓✓';
      metaEl.appendChild(ticksEl);
    }

    // Hover Arrow Down Button (WhatsApp Desktop style)
    const arrowBtn = document.createElement('button');
    arrowBtn.type = 'button';
    arrowBtn.className = 'bubble-menu-trigger';
    arrowBtn.title = 'Menu Pesan';
    arrowBtn.setAttribute('aria-label', 'Menu Pesan');

    const svgNS = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', '0 0 18 18');
    svg.setAttribute('width', '18');
    svg.setAttribute('height', '18');
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('d', 'M3.3 4.6L9 10.3l5.7-5.7 1.6 1.6L9 13.4 1.7 6.2l1.6-1.6z');
    svg.appendChild(path);
    arrowBtn.appendChild(svg);

    arrowBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (this.onBubbleMenuOpen) {
        this.onBubbleMenuOpen(msg, index, arrowBtn, bubble);
      }
    });

    bubble.appendChild(arrowBtn);
    bodyEl.appendChild(metaEl);
    bubble.appendChild(bodyEl);

    // Also allow right-click directly on the bubble to open its message context menu
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (this.onBubbleMenuOpen) {
        this.onBubbleMenuOpen(msg, index, arrowBtn, bubble, {
          clientX: e.clientX,
          clientY: e.clientY
        });
      }
    });

    row.appendChild(bubble);

    return row;
  }

  /**
   * Inspect topmost visible message in viewport to update floating sticky date pill
   */
  _updateVisibleDateFromViewport() {
    if (!this.floatingDateEl) return;
    if (this.messages.length === 0) {
      this._updateFloatingDate(null);
      return;
    }

    const containerTop = this.scrollContainer.getBoundingClientRect().top;
    const rows = this.contentElement.querySelectorAll('[data-msg-date]');
    let currentVisibleDate = null;

    for (let i = 0; i < rows.length; i++) {
      const rect = rows[i].getBoundingClientRect();
      if (rect.bottom >= containerTop + 16) {
        currentVisibleDate = rows[i].getAttribute('data-msg-date');
        break;
      }
    }

    if (!currentVisibleDate && rows.length > 0) {
      currentVisibleDate = rows[rows.length - 1].getAttribute('data-msg-date');
    }

    this._updateFloatingDate(currentVisibleDate);
  }

  /**
   * Update floating date indicator text & notify listener
   * @param {string|null} isoDate
   */
  _updateFloatingDate(isoDate) {
    if (!this.floatingDateEl) return;
    if (!isoDate) {
      this.floatingDateEl.hidden = true;
      this.floatingDateEl.textContent = '';
      return;
    }
    this.floatingDateEl.hidden = false;
    this.floatingDateEl.textContent = formatDateBadge(isoDate);

    if (this.onVisibleDateChange) {
      this.onVisibleDateChange(isoDate);
    }
  }
}
