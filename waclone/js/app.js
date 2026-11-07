/**
 * Main Application Controller for WhatsApp Archive Viewer
 *
 * Integrates:
 * - File import (File Picker + Drag & Drop) using browser File API
 * - WhatsApp `.txt` parsing (`parser.js`)
 * - IndexedDB persistence & deduplication (`database.js`)
 * - Virtual scrolled chat rendering (`chat-renderer.js`)
 * - Full-text search & navigation (`search.js`)
 * - 3-dots Kebab Menu in Header & Unified Custom Popup Modal (Confirm, Info, Date Picker, Owner Selector, Rename, Stats)
 */

import { parseWhatsAppChat } from './parser.js';
import {
  openDatabase,
  findExistingArchive,
  saveArchiveWithMessages,
  pushArchiveToSupabase,
  getAllArchives,
  getArchiveMessages,
  updateArchiveMeta,
  deleteArchive,
  clearAllData,
  getSetting,
  setSetting,
  syncWithCloud
} from './database.js';
import { ChatRenderer } from './chat-renderer.js';
import { ChatSearch } from './search.js';
import {
  computeFingerprint,
  debounce,
  formatShortDate,
  formatDateBadge,
  formatNumber,
  getInitials,
  getSenderColor
} from './utils.js';

// Built-in sample chat matching user specification + multi-day, multi-line, URL, media, and emoji
const SAMPLE_ARCHIVE_TEXT = `12/17/25, 8:10\u202FPM - Messages and calls are end-to-end encrypted. No one outside of this chat, not even WhatsApp, can read or listen to them.
12/17/25, 8:12\u202FPM - almira: Halo zim! Besok jadi latihan di studio? 🎶
12/17/25, 8:14\u202FPM - zim: Halo mir, jadi dong!
Kita mulai sekitar jam 11 siang ya.
12/17/25, 8:15\u202FPM - almira: <Media omitted>
12/17/25, 8:16\u202FPM - almira: Ini daftar lagu + jadwal lengkap: https://example.com/jadwal-studio:2025
12/18/25, 11:16\u202FAM - almira: jam
12/18/25, 11:16\u202FAM - almira: dmna?
12/18/25, 11:22\u202FAM - almira: distudio lain?
12/18/25, 11:22\u202FAM - zim: iyh`;

class WhatsAppArchiveApp {
  constructor() {
    this.archives = [];
    this.currentArchive = null;
    this.currentMessages = [];
    this.preferredOwnerName = 'zim';
    this.currentVisibleDate = '';

    this._cacheElements();
    this._initComponents();
    this._bindEvents();
  }

  _cacheElements() {
    this.appShell = document.getElementById('appShell');
    this.dropOverlay = document.getElementById('dropOverlay');
    this.fileInput = document.getElementById('fileInput');
    this.appendFileInput = document.getElementById('appendFileInput');
    this.targetAppendArchiveId = null;

    // Sidebar 3-dots menu
    this.btnSidebarMenu = document.getElementById('btnSidebarMenu');
    this.sidebarDropdownMenu = document.getElementById('sidebarDropdownMenu');
    this.menuNewChat = document.getElementById('menuNewChat');
    this.menuImportTxt = document.getElementById('menuImportTxt');
    this.menuLoadDemo = document.getElementById('menuLoadDemo');
    this.menuSyncAllSupabase = document.getElementById('menuSyncAllSupabase');
    this.menuClearAllData = document.getElementById('menuClearAllData');

    // Empty state actions
    this.btnEmptyImportTxt = document.getElementById('btnEmptyImportTxt');
    this.btnEmptyLoadDemo = document.getElementById('btnEmptyLoadDemo');

    // Sidebar elements
    this.sidebarSearchInput = document.getElementById('sidebarSearchInput');
    this.btnClearSidebarSearch = document.getElementById('btnClearSidebarSearch');
    this.sidebarSearchResultsSection = document.getElementById('sidebarSearchResultsSection');
    this.sidebarSearchCountBadge = document.getElementById('sidebarSearchCountBadge');
    this.sidebarSearchResultsList = document.getElementById('sidebarSearchResultsList');
    this.archiveTotalBadge = document.getElementById('archiveTotalBadge');
    this.archiveList = document.getElementById('archiveList');

    // Right panel views
    this.emptyStateView = document.getElementById('emptyStateView');
    this.activeChatView = document.getElementById('activeChatView');

    // Chat header & 3-dots menu
    this.btnMobileBack = document.getElementById('btnMobileBack');
    this.chatHeaderAvatar = document.getElementById('chatHeaderAvatar');
    this.chatHeaderTitle = document.getElementById('chatHeaderTitle');
    this.chatHeaderSubtitle = document.getElementById('chatHeaderSubtitle');
    this.btnChatMenu = document.getElementById('btnChatMenu');
    this.chatDropdownMenu = document.getElementById('chatDropdownMenu');

    this.menuToggleSearch = document.getElementById('menuToggleSearch');
    this.menuJumpDate = document.getElementById('menuJumpDate');
    this.menuChangeOwner = document.getElementById('menuChangeOwner');
    this.menuScrollFirst = document.getElementById('menuScrollFirst');
    this.menuScrollLast = document.getElementById('menuScrollLast');
    this.menuAppendTxt = document.getElementById('menuAppendTxt');
    this.menuSyncChatSupabase = document.getElementById('menuSyncChatSupabase');
    this.menuRenameArchive = document.getElementById('menuRenameArchive');
    this.menuExportTxt = document.getElementById('menuExportTxt');
    this.menuShowStats = document.getElementById('menuShowStats');
    this.menuDeleteArchive = document.getElementById('menuDeleteArchive');

    // Message Composer elements
    this.btnComposerAppendTxt = document.getElementById('btnComposerAppendTxt');
    this.composerSenderBadge = document.getElementById('composerSenderBadge');
    this.composerSenderName = document.getElementById('composerSenderName');
    this.composerInput = document.getElementById('composerInput');
    this.btnSendMessage = document.getElementById('btnSendMessage');

    // In-chat search bar & drawer
    this.inChatSearchBar = document.getElementById('inChatSearchBar');
    this.chatSearchInput = document.getElementById('chatSearchInput');
    this.chatSearchCounter = document.getElementById('chatSearchCounter');
    this.btnSearchPrev = document.getElementById('btnSearchPrev');
    this.btnSearchNext = document.getElementById('btnSearchNext');
    this.btnToggleResultsDrawer = document.getElementById('btnToggleResultsDrawer');
    this.btnCloseChatSearch = document.getElementById('btnCloseChatSearch');
    this.chatSearchResultsDrawer = document.getElementById('chatSearchResultsDrawer');
    this.chatSearchResultsList = document.getElementById('chatSearchResultsList');

    // Banner
    this.statusBanner = document.getElementById('statusBanner');
    this.statusBannerText = document.getElementById('statusBannerText');
    this.btnCloseStatusBanner = document.getElementById('btnCloseStatusBanner');

    // Chat viewport
    this.chatViewport = document.getElementById('chatViewport');
    this.floatingDateBadge = document.getElementById('floatingDateBadge');
    this.chatMessagesList = document.getElementById('chatMessagesList');

    // Unified Custom Popup Modal
    this.customPopupBackdrop = document.getElementById('customPopupBackdrop');
    this.customPopupTitle = document.getElementById('customPopupTitle');
    this.customPopupBody = document.getElementById('customPopupBody');
    this.customPopupFooter = document.getElementById('customPopupFooter');
    this.btnCloseCustomPopup = document.getElementById('btnCloseCustomPopup');

    // Bubble Action Dropdown Menu (Hover Arrow Down & Right-Click on Bubble)
    this.bubbleActionMenu = document.getElementById('bubbleActionMenu');
    this.bubbleMenuCopy = document.getElementById('bubbleMenuCopy');
    this.bubbleMenuEdit = document.getElementById('bubbleMenuEdit');
    this.bubbleMenuInfo = document.getElementById('bubbleMenuInfo');
    this.bubbleMenuDelete = document.getElementById('bubbleMenuDelete');
    this.activeBubbleContext = null;

    // Global Right-Click Context Menu
    this.globalContextMenu = document.getElementById('globalContextMenu');
  }

  _initComponents() {
    this.renderer = new ChatRenderer({
      scrollContainer: this.chatViewport,
      contentElement: this.chatMessagesList,
      floatingDateEl: this.floatingDateBadge,
      onVisibleDateChange: (isoDate) => {
        if (isoDate) {
          this.currentVisibleDate = isoDate;
        }
      },
      onBubbleMenuOpen: (msg, index, triggerBtn, bubbleEl, coords) => {
        this._openBubbleActionMenu(msg, index, triggerBtn, bubbleEl, coords);
      }
    });

    this.searchEngine = new ChatSearch({
      onSelectResult: (messageObj, msgIndex, query) => {
        if (messageObj && msgIndex >= 0) {
          this.renderer.setHighlightQuery(query, messageObj.id);
          this.renderer.scrollToIndex(msgIndex, { highlightPulse: true });
        } else {
          this.renderer.setHighlightQuery(query, null);
        }
      },
      onClearSearch: () => {
        this.renderer.setHighlightQuery('', null);
      }
    });
  }

  _bindEvents() {
    // Dropdown 3-dots toggle logic
    this.btnSidebarMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown(this.sidebarDropdownMenu, this.btnSidebarMenu);
    });

    this.btnChatMenu.addEventListener('click', (e) => {
      e.stopPropagation();
      this._toggleDropdown(this.chatDropdownMenu, this.btnChatMenu);
    });

    // Close dropdowns when clicking anywhere outside
    document.addEventListener('click', () => {
      this._closeAllDropdowns();
    });

    // Sidebar Menu Items
    this.menuNewChat.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.openNewChatPopup();
    });

    this.menuImportTxt.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.fileInput.click();
    });

    this.btnEmptyImportTxt.addEventListener('click', () => {
      this.fileInput.click();
    });

    this.menuLoadDemo.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.loadSampleArchive();
    });

    this.btnEmptyLoadDemo.addEventListener('click', () => {
      this.loadSampleArchive();
    });

    this.menuSyncAllSupabase.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.syncAllArchivesToSupabase();
    });

    this.menuClearAllData.addEventListener('click', () => {
      this._closeAllDropdowns();
      this._promptClearAllData();
    });

    // File Input (New Archive Import)
    this.fileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      if (files.length > 0) {
        await this.importFiles(files);
        this.fileInput.value = '';
      }
    });

    // Append File Input (Add/Merge TXT messages into an existing chat archive)
    this.appendFileInput.addEventListener('change', async (e) => {
      const files = Array.from(e.target.files || []);
      const targetId = this.targetAppendArchiveId || (this.currentArchive && this.currentArchive.id);
      this.targetAppendArchiveId = null;
      if (files.length > 0 && targetId) {
        await this.appendFilesToArchive(targetId, files);
      }
      this.appendFileInput.value = '';
    });

    // Drag & Drop across entire window
    let dragDepth = 0;
    window.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragDepth++;
      this.dropOverlay.hidden = false;
    });
    window.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    window.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragDepth = Math.max(0, dragDepth - 1);
      if (dragDepth === 0) {
        this.dropOverlay.hidden = true;
      }
    });
    window.addEventListener('drop', async (e) => {
      e.preventDefault();
      dragDepth = 0;
      this.dropOverlay.hidden = true;
      const files = Array.from(e.dataTransfer?.files || []);
      if (files.length === 0) return;

      if (this.currentArchive && !this.activeChatView.hidden) {
        const activeChat = this.currentArchive;
        const p = document.createElement('p');
        p.className = 'popup-description';
        p.textContent = `Anda sedang membuka percakapan "${activeChat.name}". Apakah file TXT ini ingin digabungkan ke percakapan "${activeChat.name}" atau diimpor sebagai arsip percakapan baru?`;

        this.openCustomPopup({
          title: 'Tambah ke Chat Ini atau Buat Baru?',
          bodyNode: p,
          buttons: [
            { label: 'Batal', variant: 'cancel' },
            {
              label: 'Buat Arsip Baru',
              variant: 'cancel',
              onClick: async () => {
                this.closeCustomPopup();
                await this.importFiles(files);
              }
            },
            {
              label: `Tambah ke "${activeChat.name}"`,
              variant: 'primary',
              onClick: async () => {
                this.closeCustomPopup();
                await this.appendFilesToArchive(activeChat.id, files);
              }
            }
          ]
        });
      } else {
        await this.importFiles(files);
      }
    });

    // Back Button in Chat Header -> Close active chat & return to initial empty state
    this.btnMobileBack.addEventListener('click', () => {
      this.closeActiveChat();
    });

    // Chat 3-dots Menu Items
    this.menuToggleSearch.addEventListener('click', () => {
      this._closeAllDropdowns();
      if (this.inChatSearchBar.hidden) {
        this.openChatSearchBar();
      } else {
        this.closeChatSearchBar();
      }
    });

    this.menuJumpDate.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.openDateJumpPopup();
    });

    this.menuChangeOwner.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.openOwnerSelectorPopup();
    });

    this.menuScrollFirst.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.renderer.scrollToTop();
    });

    this.menuScrollLast.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.renderer.scrollToBottom();
    });

    this.menuAppendTxt.addEventListener('click', () => {
      this._closeAllDropdowns();
      if (this.currentArchive) {
        this.triggerAppendTxtForArchive(this.currentArchive.id);
      }
    });

    this.menuSyncChatSupabase.addEventListener('click', () => {
      this._closeAllDropdowns();
      if (this.currentArchive) {
        this.uploadSpecificArchiveToSupabase(this.currentArchive);
      }
    });

    this.menuRenameArchive.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.openRenameArchivePopup();
    });

    this.menuExportTxt.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.exportCurrentArchiveToTxt();
    });

    this.menuShowStats.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.openStatsPopup();
    });

    this.menuDeleteArchive.addEventListener('click', () => {
      this._closeAllDropdowns();
      this.openDeleteArchivePopup();
    });

    // Composer Events (Append TXT, Send Message, Auto-resize Textarea, Switch Active Sender)
    this.btnComposerAppendTxt.addEventListener('click', () => {
      if (this.currentArchive) {
        this.triggerAppendTxtForArchive(this.currentArchive.id);
      }
    });

    this.btnSendMessage.addEventListener('click', () => {
      this.sendMessageFromComposer();
    });

    this.composerInput.addEventListener('input', () => {
      this.composerInput.style.height = 'auto';
      this.composerInput.style.height = `${Math.min(this.composerInput.scrollHeight, 120)}px`;
    });

    this.composerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessageFromComposer();
      }
    });

    this.composerSenderBadge.addEventListener('click', () => {
      this.openComposerSenderPopup();
    });

    // Global Right-Click Context Menu anywhere in the app
    document.addEventListener('contextmenu', (e) => {
      // Allow native context menu inside text inputs / textareas so user can copy/paste normally
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea') return;

      e.preventDefault();
      this._handleGlobalRightClick(e);
    });

    // In-Chat Search Controls
    this.btnCloseChatSearch.addEventListener('click', () => this.closeChatSearchBar());
    this.btnToggleResultsDrawer.addEventListener('click', () => {
      this.chatSearchResultsDrawer.hidden = !this.chatSearchResultsDrawer.hidden;
    });

    const debouncedChatSearch = debounce(() => {
      this._runInChatSearch(this.chatSearchInput.value);
    }, 180);

    this.chatSearchInput.addEventListener('input', debouncedChatSearch);
    this.chatSearchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        if (e.shiftKey) {
          this._navigateSearch('prev');
        } else {
          this._navigateSearch('next');
        }
      } else if (e.key === 'Escape') {
        this.closeChatSearchBar();
      }
    });

    this.btnSearchNext.addEventListener('click', () => this._navigateSearch('next'));
    this.btnSearchPrev.addEventListener('click', () => this._navigateSearch('prev'));

    // Sidebar Search Input
    const debouncedSidebarSearch = debounce(() => {
      this._handleSidebarSearch(this.sidebarSearchInput.value);
    }, 180);

    this.sidebarSearchInput.addEventListener('input', () => {
      this.btnClearSidebarSearch.hidden = !this.sidebarSearchInput.value;
      debouncedSidebarSearch();
    });

    this.btnClearSidebarSearch.addEventListener('click', () => {
      this.sidebarSearchInput.value = '';
      this.btnClearSidebarSearch.hidden = true;
      this._handleSidebarSearch('');
    });

    // Global Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && this.currentArchive) {
        e.preventDefault();
        this.openChatSearchBar();
      } else if (e.key === 'Escape') {
        const hadOpenDropdown =
          !this.sidebarDropdownMenu.hidden ||
          (this.chatDropdownMenu && !this.chatDropdownMenu.hidden) ||
          (this.globalContextMenu && !this.globalContextMenu.hidden) ||
          (this.bubbleActionMenu && !this.bubbleActionMenu.hidden);

        this._closeAllDropdowns();

        if (!this.customPopupBackdrop.hidden) {
          this.closeCustomPopup();
        } else if (!this.inChatSearchBar.hidden) {
          this.closeChatSearchBar();
        } else if (!hadOpenDropdown && this.currentArchive) {
          this.closeActiveChat();
        }
      }
    });

    // Banner close
    this.btnCloseStatusBanner.addEventListener('click', () => {
      this.statusBanner.hidden = true;
    });

    // Custom Popup Close Events
    this.btnCloseCustomPopup.addEventListener('click', () => this.closeCustomPopup());
    this.customPopupBackdrop.addEventListener('click', (e) => {
      if (e.target === this.customPopupBackdrop) {
        this.closeCustomPopup();
      }
    });

    // Close bubble menu on scroll inside chat viewport
    this.chatViewport.addEventListener(
      'scroll',
      () => {
        if (this.bubbleActionMenu && !this.bubbleActionMenu.hidden) {
          this._closeBubbleActionMenu();
        }
      },
      { passive: true }
    );

    // Bubble Action Menu Item Clicks
    this.bubbleMenuCopy.addEventListener('click', async () => {
      const ctx = this.activeBubbleContext;
      this._closeAllDropdowns();
      if (!ctx) return;
      try {
        await navigator.clipboard.writeText(ctx.msg.message || '');
        this.showBanner('Teks pesan berhasil disalin ke clipboard.');
      } catch {
        this.showInfoPopup('Salin Teks', ctx.msg.message || '');
      }
    });

    this.bubbleMenuEdit.addEventListener('click', () => {
      const ctx = this.activeBubbleContext;
      this._closeAllDropdowns();
      if (!ctx) return;
      this.openEditMessagePopup(ctx.msg, ctx.index);
    });

    this.bubbleMenuInfo.addEventListener('click', () => {
      const ctx = this.activeBubbleContext;
      this._closeAllDropdowns();
      if (!ctx) return;
      this.openMessageInfoPopup(ctx.msg);
    });

    this.bubbleMenuDelete.addEventListener('click', () => {
      const ctx = this.activeBubbleContext;
      this._closeAllDropdowns();
      if (!ctx) return;
      this.openDeleteMessagePopup(ctx.msg, ctx.index);
    });
  }

  /**
   * Toggle a dropdown menu and close any other open dropdown
   * @param {HTMLElement} menuEl
   * @param {HTMLElement} buttonEl
   */
  _toggleDropdown(menuEl, buttonEl) {
    const isOpening = menuEl.hidden;
    this._closeAllDropdowns();
    if (isOpening) {
      menuEl.hidden = false;
      buttonEl.classList.add('active');
      buttonEl.setAttribute('aria-expanded', 'true');
    }
  }

  _closeAllDropdowns() {
    this.sidebarDropdownMenu.hidden = true;
    this.btnSidebarMenu.classList.remove('active');
    this.btnSidebarMenu.setAttribute('aria-expanded', 'false');

    if (this.chatDropdownMenu) {
      this.chatDropdownMenu.hidden = true;
      this.btnChatMenu.classList.remove('active');
      this.btnChatMenu.setAttribute('aria-expanded', 'false');
    }

    if (this.globalContextMenu) {
      this.globalContextMenu.hidden = true;
    }

    this._closeBubbleActionMenu();
  }

  /**
   * Handle right-click (`contextmenu`) anywhere in the application
   * @param {MouseEvent} e
   */
  _handleGlobalRightClick(e) {
    this._closeAllDropdowns();

    // 1. Check if right-clicked on a sidebar archive item
    const archiveItemEl = e.target.closest('[data-archive-id]');
    if (archiveItemEl) {
      const archId = archiveItemEl.getAttribute('data-archive-id');
      const arch = this.archives.find((a) => a.id === archId);
      if (arch) {
        this._openCustomContextMenuAt(e.clientX, e.clientY, [
          {
            icon: '💬',
            label: 'Buka Percakapan',
            onClick: () => this.openArchive(arch.id, { showMobileChat: true })
          },
          {
            icon: '➕',
            label: 'Tambah Chat dari File TXT...',
            onClick: () => this.triggerAppendTxtForArchive(arch.id)
          },
          {
            icon: '☁️',
            label: arch.cloudSynced ? 'Update ke Supabase' : 'Simpan ke Supabase',
            onClick: () => this.uploadSpecificArchiveToSupabase(arch)
          },
          {
            icon: '✏️',
            label: 'Ubah Nama Arsip...',
            onClick: () => this.openRenameSpecificArchivePopup(arch)
          },
          { divider: true },
          {
            icon: '🗑️',
            label: 'Hapus Arsip Ini',
            danger: true,
            onClick: () => this.openDeleteSpecificArchivePopup(arch)
          }
        ]);
        return;
      }
    }

    // 2. Check if right-clicked inside the active chat area (when a conversation is open)
    if (this.currentArchive && !this.activeChatView.hidden && e.target.closest('#activeChatView')) {
      this._openCustomContextMenuAt(e.clientX, e.clientY, [
        {
          icon: '🔍',
          label: 'Cari di Percakapan',
          onClick: () => this.openChatSearchBar()
        },
        {
          icon: '📅',
          label: 'Lompat ke Tanggal...',
          onClick: () => this.openDateJumpPopup()
        },
        {
          icon: '👤',
          label: 'Atur Pengirim Anda (Kanan)...',
          onClick: () => this.openOwnerSelectorPopup()
        },
        { divider: true },
        {
          icon: '⇈',
          label: 'Ke Pesan Paling Awal',
          onClick: () => this.renderer.scrollToTop()
        },
        {
          icon: '⇊',
          label: 'Ke Pesan Paling Akhir',
          onClick: () => this.renderer.scrollToBottom()
        },
        { divider: true },
        {
          icon: '➕',
          label: 'Tambah Chat dari File TXT...',
          onClick: () => this.triggerAppendTxtForArchive(this.currentArchive.id)
        },
        {
          icon: '☁️',
          label: this.currentArchive.cloudSynced ? 'Update ke Supabase' : 'Simpan ke Supabase',
          onClick: () => this.uploadSpecificArchiveToSupabase(this.currentArchive)
        },
        {
          icon: '✏️',
          label: 'Ubah Nama Arsip...',
          onClick: () => this.openRenameArchivePopup()
        },
        {
          icon: '📥',
          label: 'Export ke File TXT',
          onClick: () => this.exportCurrentArchiveToTxt()
        },
        {
          icon: 'ℹ️',
          label: 'Info & Ringkasan Arsip',
          onClick: () => this.openStatsPopup()
        },
        { divider: true },
        {
          icon: '✕',
          label: 'Tutup Percakapan',
          onClick: () => {
            this.currentArchive = null;
            this.currentMessages = [];
            this.showEmptyState();
            this.renderSidebarArchiveList(this.sidebarSearchInput.value);
          }
        },
        {
          icon: '🗑️',
          label: 'Hapus Arsip Ini',
          danger: true,
          onClick: () => this.openDeleteArchivePopup()
        }
      ]);
      return;
    }

    // 3. Otherwise (sidebar empty area, welcome screen, header), show global app menu
    this._openCustomContextMenuAt(e.clientX, e.clientY, [
      {
        icon: '💬',
        label: 'Buat Percakapan Baru',
        onClick: () => this.openNewChatPopup()
      },
      {
        icon: '📂',
        label: 'Import File TXT',
        onClick: () => this.fileInput.click()
      },
      {
        icon: '✨',
        label: 'Muat Contoh Percakapan',
        onClick: () => this.loadSampleArchive()
      },
      { divider: true },
      {
        icon: '☁️',
        label: 'Sinkronkan Semua ke Supabase',
        onClick: () => this.syncAllArchivesToSupabase()
      },
      { divider: true },
      {
        icon: '🗑️',
        label: 'Hapus Seluruh Data Lokal',
        danger: true,
        onClick: () => this._promptClearAllData()
      }
    ]);
  }

  /**
   * Render and position `#globalContextMenu` at `(clientX, clientY)`
   */
  _openCustomContextMenuAt(clientX, clientY, items) {
    this.globalContextMenu.replaceChildren();

    for (const item of items) {
      if (item.divider) {
        const div = document.createElement('div');
        div.className = 'dropdown-divider';
        this.globalContextMenu.appendChild(div);
        continue;
      }

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'dropdown-item' + (item.danger ? ' dropdown-item-danger' : '');
      btn.setAttribute('role', 'menuitem');

      const iconSpan = document.createElement('span');
      iconSpan.className = 'dropdown-item-icon';
      iconSpan.textContent = item.icon || '';

      const labelSpan = document.createElement('span');
      labelSpan.textContent = item.label;

      btn.appendChild(iconSpan);
      btn.appendChild(labelSpan);

      btn.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this._closeAllDropdowns();
        if (item.onClick) item.onClick();
      });

      this.globalContextMenu.appendChild(btn);
    }

    this.globalContextMenu.hidden = false;
    const menuWidth = this.globalContextMenu.offsetWidth || 235;
    const menuHeight = this.globalContextMenu.offsetHeight || 220;

    let left = clientX;
    if (left + menuWidth > window.innerWidth - 12) {
      left = Math.max(12, window.innerWidth - menuWidth - 12);
    }

    let top = clientY;
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - menuHeight - 12);
    }

    this.globalContextMenu.style.left = `${left}px`;
    this.globalContextMenu.style.top = `${top}px`;
  }

  /**
   * Open the floating context menu anchored to the hovered bubble's down-arrow button or right-click coords
   */
  _openBubbleActionMenu(msg, index, triggerBtn, bubbleEl, coords = null) {
    // If clicking the same trigger button (not right-click) while already open, close it
    if (
      !coords &&
      !this.bubbleActionMenu.hidden &&
      this.activeBubbleContext &&
      this.activeBubbleContext.msg.id === msg.id
    ) {
      this._closeBubbleActionMenu();
      return;
    }

    this._closeAllDropdowns();

    this.activeBubbleContext = { msg, index, bubbleEl };
    bubbleEl.classList.add('menu-open');
    this.bubbleActionMenu.hidden = false;

    const menuWidth = this.bubbleActionMenu.offsetWidth || 195;
    const menuHeight = this.bubbleActionMenu.offsetHeight || 175;

    let left;
    let top;

    if (coords && typeof coords.clientX === 'number') {
      left = coords.clientX;
      top = coords.clientY;
    } else {
      const btnRect = triggerBtn.getBoundingClientRect();
      left = btnRect.right - menuWidth;
      top = btnRect.bottom + 4;
      if (top + menuHeight > window.innerHeight - 16) {
        top = Math.max(12, btnRect.top - menuHeight - 4);
      }
    }

    if (left < 12) left = 12;
    if (left + menuWidth > window.innerWidth - 12) {
      left = window.innerWidth - menuWidth - 12;
    }
    if (top + menuHeight > window.innerHeight - 12) {
      top = Math.max(12, window.innerHeight - menuHeight - 12);
    }

    this.bubbleActionMenu.style.left = `${left}px`;
    this.bubbleActionMenu.style.top = `${top}px`;
  }

  _closeBubbleActionMenu() {
    if (!this.bubbleActionMenu) return;
    this.bubbleActionMenu.hidden = true;
    if (this.activeBubbleContext && this.activeBubbleContext.bubbleEl) {
      this.activeBubbleContext.bubbleEl.classList.remove('menu-open');
    }
    this.activeBubbleContext = null;
  }

  /**
   * Open Custom Popup to Edit a Message's Content, Sender, or Time
   */
  openEditMessagePopup(msg, index) {
    if (!this.currentArchive || !msg) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const senderGroup = document.createElement('div');
    senderGroup.className = 'popup-field-group';
    const senderLabel = document.createElement('label');
    senderLabel.className = 'popup-field-label';
    senderLabel.textContent = 'Pengirim Pesan';
    const senderInput = document.createElement('input');
    senderInput.type = 'text';
    senderInput.className = 'popup-input';
    senderInput.value = msg.sender || '';
    senderGroup.appendChild(senderLabel);
    senderGroup.appendChild(senderInput);

    const textGroup = document.createElement('div');
    textGroup.className = 'popup-field-group';
    const textLabel = document.createElement('label');
    textLabel.className = 'popup-field-label';
    textLabel.textContent = 'Isi Pesan';
    const textarea = document.createElement('textarea');
    textarea.className = 'popup-input';
    textarea.rows = 4;
    textarea.style.resize = 'vertical';
    textarea.value = msg.message || '';
    textGroup.appendChild(textLabel);
    textGroup.appendChild(textarea);

    container.appendChild(senderGroup);
    container.appendChild(textGroup);

    const saveEdit = async () => {
      const newText = textarea.value.replace(/\r\n?/g, '\n').trimEnd();
      const newSender = senderInput.value.trim() || msg.sender;
      if (!newText) return;

      this.closeCustomPopup();

      const targetMsg = this.currentMessages[index];
      if (!targetMsg || targetMsg.id !== msg.id) return;

      targetMsg.message = newText;
      targetMsg.sender = newSender;
      targetMsg.edited = true;
      if (targetMsg.type === 'media' && !/<media omitted>/i.test(newText)) {
        targetMsg.type = 'text';
      }

      await this._recalculateAndSaveCurrentArchive();
      this.renderer.refreshCurrentWindow();
    };

    this.openCustomPopup({
      title: 'Edit Pesan',
      bodyNode: container,
      buttons: [
        { label: 'Batal', variant: 'cancel' },
        { label: 'Simpan Perubahan', variant: 'primary', onClick: saveEdit }
      ]
    });

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }, 30);
  }

  /**
   * Open Custom Popup showing detailed info for a single message
   */
  openMessageInfoPopup(msg) {
    const container = document.createElement('div');
    container.className = 'stats-grid';

    const details = [
      { label: 'Pengirim', value: msg.sender || 'Sistem' },
      { label: 'Tanggal', value: formatDateBadge(msg.date) },
      { label: 'Waktu', value: msg.time || '-' },
      { label: 'Status', value: msg.edited ? 'Telah Diedit' : 'Asli' }
    ];

    for (const d of details) {
      const box = document.createElement('div');
      box.className = 'stat-box';
      const lbl = document.createElement('div');
      lbl.className = 'stat-label';
      lbl.textContent = d.label;
      const val = document.createElement('div');
      val.className = 'stat-value';
      val.style.fontSize = '14.5px';
      val.textContent = d.value;
      box.appendChild(lbl);
      box.appendChild(val);
      container.appendChild(box);
    }

    this.openCustomPopup({
      title: 'Info Detail Pesan',
      bodyNode: container,
      buttons: [{ label: 'Tutup', variant: 'primary' }]
    });
  }

  /**
   * Open Custom Confirmation Popup to Delete a Single Message
   */
  openDeleteMessagePopup(msg, index) {
    if (!this.currentArchive || !msg) return;
    const preview = (msg.message || '').replace(/\s+/g, ' ').slice(0, 80);

    this.showConfirmPopup({
      title: 'Hapus Pesan?',
      message: `Apakah Anda yakin ingin menghapus pesan dari "${msg.sender || 'Sistem'}": "${preview}"?`,
      confirmLabel: 'Hapus Pesan',
      confirmVariant: 'danger',
      onConfirm: async () => {
        if (this.currentMessages[index] && this.currentMessages[index].id === msg.id) {
          this.currentMessages.splice(index, 1);
        } else {
          const foundIdx = this.currentMessages.findIndex((m) => m.id === msg.id);
          if (foundIdx !== -1) this.currentMessages.splice(foundIdx, 1);
        }

        await this._recalculateAndSaveCurrentArchive();
        this.searchEngine.setMessages(this.currentMessages);
        this.renderer.refreshCurrentWindow();
      }
    });
  }

  /**
   * Recalculate sender counts, dates, and last message preview after editing or deleting a message
   */
  async _recalculateAndSaveCurrentArchive() {
    if (!this.currentArchive) return;

    const senderCounts = new Map();
    const dateSet = new Set();

    for (const m of this.currentMessages) {
      if (m.sender) {
        senderCounts.set(m.sender, (senderCounts.get(m.sender) || 0) + 1);
      }
      if (m.date) {
        dateSet.add(m.date);
      }
    }

    const senders = Array.from(senderCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const dates = Array.from(dateSet).sort();
    const lastMsg = this.currentMessages[this.currentMessages.length - 1] || null;

    const updatedMeta = {
      ...this.currentArchive,
      messageCount: this.currentMessages.length,
      senders,
      dates,
      firstDate: dates[0] || this.currentArchive.firstDate,
      lastDate: dates[dates.length - 1] || this.currentArchive.lastDate,
      lastMessage: lastMsg ? lastMsg.message.replace(/\s+/g, ' ').slice(0, 120) : '',
      lastSender: lastMsg ? lastMsg.sender : '',
      lastTimestamp: lastMsg ? lastMsg.timestamp : this.currentArchive.lastTimestamp,
      lastTime: lastMsg ? lastMsg.time : '',
      updatedAt: Date.now()
    };

    await saveArchiveWithMessages(updatedMeta, this.currentMessages);
    this.currentArchive = updatedMeta;

    const archIdx = this.archives.findIndex((a) => a.id === updatedMeta.id);
    if (archIdx !== -1) {
      this.archives[archIdx] = updatedMeta;
    }

    this._updateChatHeader();
    this.renderSidebarArchiveList(this.sidebarSearchInput.value);
  }

  /* ==========================================================================
     Unified Custom Popup System (Info, Confirm, Date Picker, Owner, Rename, Stats)
     ========================================================================== */

  /**
   * Open the custom popup modal with given title, body node/builder, and footer buttons
   * @param {object} config
   * @param {string} config.title
   * @param {HTMLElement|DocumentFragment} config.bodyNode
   * @param {Array<{ label: string, variant?: 'primary'|'danger'|'cancel', onClick?: Function }>} config.buttons
   */
  openCustomPopup({ title, bodyNode, buttons = [] }) {
    this.customPopupTitle.textContent = title || 'Informasi';
    this.customPopupBody.replaceChildren(bodyNode);
    this.customPopupFooter.replaceChildren();

    for (const btnCfg of buttons) {
      const btn = document.createElement('button');
      btn.type = 'button';
      const variantClass =
        btnCfg.variant === 'danger'
          ? 'btn-modal-danger'
          : btnCfg.variant === 'primary'
            ? 'btn-modal-primary'
            : 'btn-modal-cancel';
      btn.className = `btn-modal ${variantClass}`;
      btn.textContent = btnCfg.label;
      btn.addEventListener('click', () => {
        if (btnCfg.onClick) {
          btnCfg.onClick();
        } else {
          this.closeCustomPopup();
        }
      });
      this.customPopupFooter.appendChild(btn);
    }

    this.customPopupBackdrop.hidden = false;
  }

  closeCustomPopup() {
    this.customPopupBackdrop.hidden = true;
    this.customPopupBody.replaceChildren();
    this.customPopupFooter.replaceChildren();
  }

  /**
   * Show a custom Info Popup (replaces native `alert`)
   * @param {string} title
   * @param {string} message
   */
  showInfoPopup(title, message) {
    const p = document.createElement('p');
    p.className = 'popup-description';
    p.textContent = message;

    this.openCustomPopup({
      title,
      bodyNode: p,
      buttons: [
        {
          label: 'Mengerti',
          variant: 'primary',
          onClick: () => this.closeCustomPopup()
        }
      ]
    });
  }

  /**
   * Show a custom Confirmation Popup (replaces native `confirm`)
   * @param {object} options
   * @param {string} options.title
   * @param {string} options.message
   * @param {string} [options.confirmLabel='Ya, Lanjutkan']
   * @param {'primary'|'danger'} [options.confirmVariant='danger']
   * @param {Function} options.onConfirm
   */
  showConfirmPopup({ title, message, confirmLabel = 'Hapus', confirmVariant = 'danger', onConfirm }) {
    const p = document.createElement('p');
    p.className = 'popup-description';
    p.textContent = message;

    this.openCustomPopup({
      title,
      bodyNode: p,
      buttons: [
        {
          label: 'Batal',
          variant: 'cancel',
          onClick: () => this.closeCustomPopup()
        },
        {
          label: confirmLabel,
          variant: confirmVariant,
          onClick: async () => {
            this.closeCustomPopup();
            if (onConfirm) await onConfirm();
          }
        }
      ]
    });
  }

  /**
   * Open Custom Popup for Date Navigation ("Lompat ke Tanggal")
   */
  openDateJumpPopup() {
    if (!this.currentArchive) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const first = this.currentArchive.firstDate || '';
    const last = this.currentArchive.lastDate || '';

    const desc = document.createElement('p');
    desc.className = 'popup-description';
    desc.textContent = `Pilih tanggal percakapan antara ${formatDateBadge(first)} hingga ${formatDateBadge(last)}. Jika tanggal yang dipilih tidak memiliki pesan, tampilan otomatis diarahkan ke tanggal terdekat.`;
    container.appendChild(desc);

    const fieldGroup = document.createElement('div');
    fieldGroup.className = 'popup-field-group';

    const label = document.createElement('label');
    label.className = 'popup-field-label';
    label.textContent = 'Tanggal Tujuan';

    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'popup-input';
    dateInput.min = first;
    dateInput.max = last;
    dateInput.value = this.currentVisibleDate || last;

    fieldGroup.appendChild(label);
    fieldGroup.appendChild(dateInput);
    container.appendChild(fieldGroup);

    // Also provide quick select of available dates if helpful
    const dates = this.currentArchive.dates || [];
    if (dates.length > 0) {
      const selectGroup = document.createElement('div');
      selectGroup.className = 'popup-field-group';

      const selectLabel = document.createElement('label');
      selectLabel.className = 'popup-field-label';
      selectLabel.textContent = `Atau Pilih dari Tanggal yang Memiliki Pesan (${formatNumber(dates.length)} hari)`;

      const dateSelect = document.createElement('select');
      dateSelect.className = 'popup-select';
      for (const d of dates) {
        const opt = document.createElement('option');
        opt.value = d;
        opt.textContent = `${formatShortDate(d)} — ${formatDateBadge(d)}`;
        if (d === dateInput.value) opt.selected = true;
        dateSelect.appendChild(opt);
      }

      dateSelect.addEventListener('change', () => {
        dateInput.value = dateSelect.value;
      });
      dateInput.addEventListener('change', () => {
        if (dates.includes(dateInput.value)) {
          dateSelect.value = dateInput.value;
        }
      });

      selectGroup.appendChild(selectLabel);
      selectGroup.appendChild(dateSelect);
      container.appendChild(selectGroup);
    }

    const applyJump = () => {
      const targetDate = dateInput.value;
      this.closeCustomPopup();
      if (!targetDate) return;
      const res = this.renderer.scrollToDate(targetDate);
      if (res.foundDate && !res.exact) {
        this.showBanner(
          `Tanggal ${formatShortDate(targetDate)} tidak memiliki pesan. Menampilkan tanggal terdekat: ${formatDateBadge(res.foundDate)}.`
        );
      }
    };

    this.openCustomPopup({
      title: 'Lompat ke Tanggal Percakapan',
      bodyNode: container,
      buttons: [
        { label: 'Batal', variant: 'cancel' },
        { label: 'Lompat ke Tanggal', variant: 'primary', onClick: applyJump }
      ]
    });
  }

  /**
   * Open Custom Popup for Owner Sender Configuration ("Atur Pengirim Anda / Kanan")
   */
  openOwnerSelectorPopup() {
    if (!this.currentArchive) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const desc = document.createElement('p');
    desc.className = 'popup-description';
    desc.textContent =
      'Pilih nama pengirim yang mewakili pemilik akun Anda. Pesan dari pengirim ini akan ditampilkan di sebelah kanan dengan bubble hijau gelap.';
    container.appendChild(desc);

    const senders = this.currentArchive.senders || [];
    let selectedValue = this.currentArchive.ownerSender || '';

    const radioList = document.createElement('div');
    radioList.className = 'popup-radio-list';

    const customInputGroup = document.createElement('div');
    customInputGroup.className = 'popup-field-group';
    const customLabel = document.createElement('label');
    customLabel.className = 'popup-field-label';
    customLabel.textContent = 'Nama Pengirim (Bisa dipilih di atas atau diketik manual):';
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'popup-input';
    customInput.placeholder = 'Contoh: zim';
    customInput.value = selectedValue;

    const updateSelectionUI = (val) => {
      selectedValue = val;
      customInput.value = val;
      const options = radioList.querySelectorAll('.popup-radio-option');
      options.forEach((el) => {
        const optVal = el.getAttribute('data-sender-val') || '';
        el.classList.toggle('selected', optVal.toLowerCase() === val.toLowerCase());
      });
    };

    // Add each detected sender option
    for (const s of senders) {
      const optRow = document.createElement('div');
      optRow.className =
        'popup-radio-option' +
        (s.name.toLowerCase() === selectedValue.toLowerCase() ? ' selected' : '');
      optRow.setAttribute('data-sender-val', s.name);

      const left = document.createElement('div');
      left.className = 'popup-radio-left';
      left.textContent = `👤 ${s.name}`;

      const right = document.createElement('span');
      right.className = 'popup-radio-count';
      right.textContent = `${formatNumber(s.count)} pesan`;

      optRow.appendChild(left);
      optRow.appendChild(right);
      optRow.addEventListener('click', () => updateSelectionUI(s.name));
      radioList.appendChild(optRow);
    }

    // Add option for "Semua di Kiri" (empty owner)
    const noneRow = document.createElement('div');
    noneRow.className = 'popup-radio-option' + (selectedValue === '' ? ' selected' : '');
    noneRow.setAttribute('data-sender-val', '');
    const noneLeft = document.createElement('div');
    noneLeft.className = 'popup-radio-left';
    noneLeft.textContent = 'Tampilkan Semua Pengirim di Sebelah Kiri';
    noneRow.appendChild(noneLeft);
    noneRow.addEventListener('click', () => updateSelectionUI(''));
    radioList.appendChild(noneRow);

    container.appendChild(radioList);

    customInputGroup.appendChild(customLabel);
    customInputGroup.appendChild(customInput);
    container.appendChild(customInputGroup);

    const saveOwner = async () => {
      const finalOwner = customInput.value.trim();
      this.closeCustomPopup();
      await this._applyOwnerSender(finalOwner);
      this.showBanner(
        finalOwner
          ? `Pengirim pemilik akun diatur ke "${finalOwner}" (ditampilkan di kanan).`
          : 'Semua pesan kini ditampilkan di sebelah kiri.'
      );
    };

    this.openCustomPopup({
      title: 'Atur Pengirim Anda (Bubble Kanan)',
      bodyNode: container,
      buttons: [
        { label: 'Batal', variant: 'cancel' },
        { label: 'Simpan Pengaturan', variant: 'primary', onClick: saveOwner }
      ]
    });
  }

  /**
   * Open Custom Popup to Rename Current Archive
   */
  openRenameArchivePopup() {
    if (!this.currentArchive) return;
    this.openRenameSpecificArchivePopup(this.currentArchive);
  }

  /**
   * Open Custom Popup to Rename a Specific Archive
   */
  openRenameSpecificArchivePopup(targetArchive) {
    if (!targetArchive) return;

    const container = document.createElement('div');
    container.className = 'popup-field-group';

    const label = document.createElement('label');
    label.className = 'popup-field-label';
    label.textContent = 'Nama Arsip / Kontak';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'popup-input';
    input.value = targetArchive.name || '';

    container.appendChild(label);
    container.appendChild(input);

    const saveRename = async () => {
      const trimmed = input.value.trim();
      if (!trimmed) return;
      this.closeCustomPopup();

      const updated = await updateArchiveMeta(targetArchive.id, { name: trimmed });
      if (updated) {
        if (this.currentArchive && this.currentArchive.id === updated.id) {
          this.currentArchive = updated;
          this._updateChatHeader();
        }
        const idx = this.archives.findIndex((a) => a.id === updated.id);
        if (idx !== -1) this.archives[idx] = updated;
        this.renderSidebarArchiveList(this.sidebarSearchInput.value);
      }
    };

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        saveRename();
      }
    });

    this.openCustomPopup({
      title: 'Ubah Nama Arsip',
      bodyNode: container,
      buttons: [
        { label: 'Batal', variant: 'cancel' },
        { label: 'Simpan Nama', variant: 'primary', onClick: saveRename }
      ]
    });

    setTimeout(() => {
      input.focus();
      input.select();
    }, 30);
  }

  /**
   * Open Custom Popup for Deleting Current Archive
   */
  openDeleteArchivePopup() {
    if (!this.currentArchive) return;
    this.openDeleteSpecificArchivePopup(this.currentArchive);
  }

  /**
   * Open Custom Popup for Deleting a Specific Archive
   */
  openDeleteSpecificArchivePopup(targetArchive) {
    if (!targetArchive) return;

    this.showConfirmPopup({
      title: 'Hapus Arsip Percakapan',
      message: `Apakah Anda yakin ingin menghapus arsip "${targetArchive.name}" (${formatNumber(targetArchive.messageCount)} pesan) dari Supabase dan penyimpanan lokal browser?`,
      confirmLabel: 'Hapus Arsip',
      confirmVariant: 'danger',
      onConfirm: async () => {
        await deleteArchive(targetArchive.id);
        this.archives = this.archives.filter((a) => a.id !== targetArchive.id);

        if (this.currentArchive && this.currentArchive.id === targetArchive.id) {
          this.currentArchive = null;
          this.currentMessages = [];
          this.showEmptyState();
        }

        this.renderSidebarArchiveList(this.sidebarSearchInput.value);
      }
    });
  }

  /**
   * Open Custom Popup for Clearing All Local Data
   */
  _promptClearAllData() {
    if (this.archives.length === 0) {
      this.showInfoPopup('Data Lokal Kosong', 'Belum ada arsip percakapan yang tersimpan di browser Anda.');
      return;
    }

    this.showConfirmPopup({
      title: 'Hapus Seluruh Data Lokal',
      message: `Tindakan ini akan menghapus seluruh ${formatNumber(this.archives.length)} arsip percakapan dan pengaturan dari Supabase (perangkat ini) maupun penyimpanan lokal browser Anda. Tindakan ini tidak dapat dibatalkan.`,
      confirmLabel: 'Hapus Semua Data',
      confirmVariant: 'danger',
      onConfirm: async () => {
        await clearAllData();
        this.archives = [];
        this.currentArchive = null;
        this.currentMessages = [];
        this.renderSidebarArchiveList();
        this.showEmptyState();
      }
    });
  }

  /**
   * Open Custom Popup displaying Archive Parsing Summary & Unrecognized Lines
   */
  openStatsPopup() {
    if (!this.currentArchive) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const stats = this.currentArchive.stats || {};
    const grid = document.createElement('div');
    grid.className = 'stats-grid';

    const items = [
      { label: 'Nama File Asli', value: this.currentArchive.fileName || '-' },
      { label: 'Pengirim Anda (Kanan)', value: this.currentArchive.ownerSender || '(Semua di Kiri)' },
      { label: 'Total Pesan Terbaca', value: formatNumber(this.currentArchive.messageCount) },
      { label: 'Total Baris File TXT', value: formatNumber(stats.totalLines || 0) },
      { label: 'Pesan Multi-Baris', value: formatNumber(stats.multilineCount || 0) },
      { label: 'Pesan Media (<Media omitted>)', value: formatNumber(stats.mediaMessages || 0) }
    ];

    for (const item of items) {
      const box = document.createElement('div');
      box.className = 'stat-box';

      const lbl = document.createElement('div');
      lbl.className = 'stat-label';
      lbl.textContent = item.label;

      const val = document.createElement('div');
      val.className = 'stat-value';
      val.textContent = item.value;

      box.appendChild(lbl);
      box.appendChild(val);
      grid.appendChild(box);
    }

    container.appendChild(grid);

    const badLines = stats.unrecognizedLines || [];
    const badSection = document.createElement('div');
    const badTitle = document.createElement('p');
    badTitle.style.marginBottom = '6px';
    badTitle.style.color = 'var(--text-secondary)';
    badTitle.textContent =
      badLines.length === 0
        ? '✓ Semua baris dalam file TXT ini berhasil dikenali dengan sempurna.'
        : `⚠ Terdapat ${formatNumber(badLines.length)} baris di awal file yang tidak memiliki format header WhatsApp:`;
    badSection.appendChild(badTitle);

    if (badLines.length > 0) {
      const list = document.createElement('div');
      list.className = 'unrecognized-list';
      for (const b of badLines.slice(0, 50)) {
        const lineEl = document.createElement('div');
        lineEl.textContent = `Baris ${b.lineNumber}: ${b.content}`;
        list.appendChild(lineEl);
      }
      badSection.appendChild(list);
    }

    container.appendChild(badSection);

    this.openCustomPopup({
      title: 'Info & Ringkasan Parsing Arsip',
      bodyNode: container,
      buttons: [{ label: 'Tutup', variant: 'primary' }]
    });
  }

  /* ==========================================================================
     Core App Lifecycle, File Import, & Rendering
     ========================================================================== */

  async init() {
    try {
      await openDatabase();

      const savedOwner = await getSetting('preferredOwnerSender', 'zim');
      if (savedOwner) {
        this.preferredOwnerName = savedOwner;
      }

      this.archives = await getAllArchives();
      this.renderSidebarArchiveList();

      // Always start on the initial welcome/empty state until user clicks a chat
      this.showEmptyState();
    } catch (err) {
      console.error('Initialization error:', err);
      this.showEmptyState();
    }
  }

  /**
   * Explicitly upload a single archive and its messages to Supabase when triggered by user from menu
   * @param {object} targetArchive
   */
  async uploadSpecificArchiveToSupabase(targetArchive) {
    if (!targetArchive) return;
    this.showBanner(`☁️ Mengunggah arsip "${targetArchive.name}" ke Supabase...`);

    const res = await pushArchiveToSupabase(targetArchive.id);
    if (res.ok) {
      this.archives = await getAllArchives();
      if (this.currentArchive && this.currentArchive.id === targetArchive.id) {
        this.currentArchive =
          this.archives.find((a) => a.id === targetArchive.id) || res.meta || this.currentArchive;
        this._updateChatHeader();
      }
      this.renderSidebarArchiveList(this.sidebarSearchInput.value);
      this.showBanner(`☁️ Arsip "${targetArchive.name}" berhasil disimpan ke Supabase!`);
    } else {
      this.showInfoPopup(
        'Gagal Menyimpan ke Supabase',
        `Tidak dapat mengunggah "${targetArchive.name}" ke Supabase: ${res.error?.message || 'Koneksi gagal'}. Data Anda tetap aman tersimpan di lokal browser.`
      );
    }
  }

  /**
   * Explicitly synchronize all local archives with Supabase when triggered from Sidebar / Global menu
   */
  async syncAllArchivesToSupabase() {
    if (!this.emptyStateView.hidden) {
      this.showInfoPopup('Sinkronisasi Supabase', 'Sedang menyinkronkan seluruh arsip dengan Supabase...');
    } else {
      this.showBanner('☁️ Menyinkronkan seluruh arsip dengan Supabase...');
    }

    const syncResult = await syncWithCloud();
    this.archives = await getAllArchives();
    if (this.currentArchive) {
      this.currentArchive =
        this.archives.find((a) => a.id === this.currentArchive.id) || this.currentArchive;
      this._updateChatHeader();
    }
    this.renderSidebarArchiveList(this.sidebarSearchInput.value);

    if (syncResult.ok) {
      this.showInfoPopup(
        'Sinkronisasi Supabase Selesai',
        `Berhasil menyinkronkan data dengan Supabase:\n• ${formatNumber(syncResult.pushed)} arsip diunggah ke Supabase\n• ${formatNumber(syncResult.pulled)} arsip diunduh dari Supabase\n• ${formatNumber(syncResult.deleted)} penghapusan disinkronkan.`
      );
    } else {
      this.showInfoPopup(
        'Gagal Terhubung ke Supabase',
        'Tidak dapat terhubung ke server Supabase saat ini. Seluruh arsip tetap tersimpan aman di lokal browser Anda.'
      );
    }
  }

  async importFiles(files) {
    let lastImportedId = null;
    let lastSummaryMsg = '';

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.txt') && file.type && file.type !== 'text/plain') {
        this.showInfoPopup(
          'Format File Tidak Didukung',
          `File "${file.name}" dilewati karena bukan file teks (.txt).`
        );
        continue;
      }

      try {
        const text = await this._readFileAsText(file);
        if (!text || text.trim().length === 0) {
          this.showInfoPopup(
            'File Kosong',
            `File "${file.name}" kosong dan tidak mengandung pesan percakapan.`
          );
          continue;
        }

        const result = await this._processAndStoreRawChat(text, file.name);
        if (result) {
          lastImportedId = result.archive.id;
          lastSummaryMsg = result.summaryText;
        }
      } catch (err) {
        console.error(`Failed reading file ${file.name}:`, err);
        this.showInfoPopup('Gagal Membaca File', `Gagal membaca file "${file.name}": ${err.message}`);
      }
    }

    this.archives = await getAllArchives();
    this.renderSidebarArchiveList();

    if (lastImportedId) {
      await this.openArchive(lastImportedId, { showMobileChat: true });
      if (lastSummaryMsg) {
        this.showBanner(lastSummaryMsg);
      }
    }
  }

  /**
   * Open file picker to append/merge one or more `.txt` files into a specific existing archive
   * @param {string} archiveId
   */
  triggerAppendTxtForArchive(archiveId) {
    if (!archiveId) return;
    this.targetAppendArchiveId = archiveId;
    this.appendFileInput.click();
  }

  /**
   * Parse and merge `.txt` files into an existing archive (`targetArchiveId`)
   * Deduplicates identical messages and sorts chronologically while preserving stable sequence.
   * @param {string} targetArchiveId
   * @param {Array<File>} files
   */
  async appendFilesToArchive(targetArchiveId, files) {
    const targetMeta = this.archives.find((a) => a.id === targetArchiveId);
    if (!targetMeta) return;

    const existingMessages =
      this.currentArchive && this.currentArchive.id === targetArchiveId
        ? [...this.currentMessages]
        : await getArchiveMessages(targetArchiveId);

    // Build deduplication set based on (date, time, sender, message)
    const makeSig = (m) => `${m.date}|${m.time}|${m.sender || ''}|${m.message || ''}`;
    const existingSigs = new Set(existingMessages.map(makeSig));

    let addedCount = 0;
    let skippedDuplicates = 0;
    let totalNewLines = 0;
    let newSystemCount = 0;
    let newMediaCount = 0;
    let newMultilineCount = 0;
    const allNewUnrecognized = [];

    for (const file of files) {
      if (!file.name.toLowerCase().endsWith('.txt') && file.type && file.type !== 'text/plain') {
        this.showInfoPopup(
          'Format File Tidak Didukung',
          `File "${file.name}" dilewati karena bukan file teks (.txt).`
        );
        continue;
      }

      try {
        const text = await this._readFileAsText(file);
        if (!text || text.trim().length === 0) {
          this.showInfoPopup(
            'File Kosong',
            `File "${file.name}" kosong dan tidak mengandung pesan percakapan.`
          );
          continue;
        }

        const batchPrefix = `${targetArchiveId}-add-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
        const parsed = parseWhatsAppChat(text, { idPrefix: batchPrefix });

        if (parsed.messages.length === 0) {
          const badCount = parsed.stats.unrecognizedLines.length;
          this.showInfoPopup(
            'Format Tidak Dikenali',
            `Tidak ada pesan WhatsApp yang dapat diparsing dari "${file.name}" (${badCount} baris tidak sesuai format export WhatsApp).`
          );
          continue;
        }

        totalNewLines += parsed.stats.totalLines || 0;
        newSystemCount += parsed.stats.systemMessages || 0;
        newMediaCount += parsed.stats.mediaMessages || 0;
        newMultilineCount += parsed.stats.multilineCount || 0;
        if (parsed.stats.unrecognizedLines?.length) {
          allNewUnrecognized.push(...parsed.stats.unrecognizedLines);
        }

        for (const msg of parsed.messages) {
          const sig = makeSig(msg);
          if (existingSigs.has(sig)) {
            skippedDuplicates++;
          } else {
            existingSigs.add(sig);
            existingMessages.push(msg);
            addedCount++;
          }
        }
      } catch (err) {
        console.error(`Failed reading file ${file.name} for append:`, err);
        this.showInfoPopup('Gagal Membaca File', `Gagal membaca file "${file.name}": ${err.message}`);
      }
    }

    if (addedCount === 0 && skippedDuplicates === 0) {
      return;
    }

    // Sort merged messages chronologically while preserving relative order for identical timestamps
    const withOrder = existingMessages.map((item, idx) => ({ item, idx }));
    withOrder.sort((a, b) => {
      const diff = (a.item.timestamp || 0) - (b.item.timestamp || 0);
      return diff !== 0 ? diff : a.idx - b.idx;
    });
    const mergedMessages = withOrder.map((entry) => entry.item);

    // Recalculate senders & dates
    const senderCounts = new Map();
    const dateSet = new Set();
    for (const m of mergedMessages) {
      if (m.sender) {
        senderCounts.set(m.sender, (senderCounts.get(m.sender) || 0) + 1);
      }
      if (m.date) {
        dateSet.add(m.date);
      }
    }

    const senders = Array.from(senderCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const dates = Array.from(dateSet).sort();
    const lastMsg = mergedMessages[mergedMessages.length - 1] || null;
    const prevStats = targetMeta.stats || {
      totalLines: 0,
      parsedMessages: 0,
      systemMessages: 0,
      mediaMessages: 0,
      multilineCount: 0,
      unrecognizedLines: []
    };

    const updatedMeta = {
      ...targetMeta,
      messageCount: mergedMessages.length,
      senders,
      dates,
      firstDate: dates[0] || targetMeta.firstDate,
      lastDate: dates[dates.length - 1] || targetMeta.lastDate,
      lastMessage: lastMsg ? lastMsg.message.replace(/\s+/g, ' ').slice(0, 120) : '',
      lastSender: lastMsg ? lastMsg.sender : '',
      lastTimestamp: lastMsg ? lastMsg.timestamp : targetMeta.lastTimestamp,
      lastTime: lastMsg ? lastMsg.time : '',
      stats: {
        totalLines: (prevStats.totalLines || 0) + totalNewLines,
        parsedMessages: mergedMessages.length,
        systemMessages: (prevStats.systemMessages || 0) + newSystemCount,
        mediaMessages: (prevStats.mediaMessages || 0) + newMediaCount,
        multilineCount: (prevStats.multilineCount || 0) + newMultilineCount,
        unrecognizedLines: [...(prevStats.unrecognizedLines || []), ...allNewUnrecognized].slice(0, 100)
      },
      updatedAt: Date.now()
    };

    await saveArchiveWithMessages(updatedMeta, mergedMessages);
    this.archives = await getAllArchives();
    this.renderSidebarArchiveList(this.sidebarSearchInput.value);

    await this.openArchive(targetArchiveId, { showMobileChat: true });

    const dupInfo =
      skippedDuplicates > 0 ? ` (${formatNumber(skippedDuplicates)} pesan duplikat dilewati)` : '';
    this.showBanner(
      `Berhasil menambahkan ${formatNumber(addedCount)} pesan baru ke "${updatedMeta.name}"${dupInfo}. Total kini: ${formatNumber(mergedMessages.length)} pesan.`
    );
  }

  _readFileAsText(file) {
    if (typeof file.text === 'function') {
      return file.text();
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('FileReader gagal membaca file.'));
      reader.readAsText(file, 'utf-8');
    });
  }

  async _processAndStoreRawChat(rawText, fileName) {
    const fingerprint = computeFingerprint(rawText);
    const existing = await findExistingArchive(fingerprint, fileName);

    const archiveId = existing ? existing.id : `arch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const parsed = parseWhatsAppChat(rawText, { idPrefix: archiveId });

    if (parsed.messages.length === 0) {
      const badCount = parsed.stats.unrecognizedLines.length;
      this.showInfoPopup(
        'Format Tidak Dikenali',
        `Tidak ada pesan WhatsApp yang dapat diparsing dari "${fileName}" (${badCount} baris tidak sesuai format export WhatsApp).`
      );
      return null;
    }

    let ownerSender = existing ? existing.ownerSender : '';
    if (!ownerSender) {
      const prefLower = (this.preferredOwnerName || 'zim').toLowerCase();
      const matchedSender = parsed.senders.find((s) => s.name.toLowerCase() === prefLower);
      if (matchedSender) {
        ownerSender = matchedSender.name;
      } else if (parsed.senders.length >= 2) {
        ownerSender = parsed.senders[1].name;
      } else if (parsed.senders.length === 1) {
        ownerSender = parsed.senders[0].name;
      }
    }

    const archiveName = existing
      ? existing.name
      : this._inferArchiveName(fileName, parsed.senders, ownerSender);

    const lastMsg = parsed.messages[parsed.messages.length - 1];
    const firstDate = parsed.dates[0] || lastMsg.date;
    const lastDate = parsed.dates[parsed.dates.length - 1] || lastMsg.date;

    const archiveMeta = {
      id: archiveId,
      name: archiveName,
      fileName,
      fingerprint,
      ownerSender,
      messageCount: parsed.messages.length,
      senders: parsed.senders,
      dates: parsed.dates,
      firstDate,
      lastDate,
      lastMessage: lastMsg.message.replace(/\s+/g, ' ').slice(0, 120),
      lastSender: lastMsg.sender,
      lastTimestamp: lastMsg.timestamp,
      lastTime: lastMsg.time,
      stats: parsed.stats,
      updatedAt: Date.now()
    };

    await saveArchiveWithMessages(archiveMeta, parsed.messages, { syncToCloud: false });

    const unrecognizedCount = parsed.stats.unrecognizedLines.length;
    const actionLabel = existing
      ? `Arsip "${archiveName}" diperbarui tanpa duplikasi`
      : `Arsip "${archiveName}" berhasil diimpor`;
    const unrecognizedInfo =
      unrecognizedCount > 0
        ? ` • ${formatNumber(unrecognizedCount)} baris tidak dikenali (buka menu ⋮ > Info & Ringkasan)`
        : ' • 100% baris terbaca bersih';
    const storageInfo = ' • 💾 Tersimpan di lokal (pilih menu ⋮ > Simpan ke Supabase jika ingin mengunggah ke cloud)';

    const summaryText = `${actionLabel}: ${formatNumber(parsed.messages.length)} pesan (${parsed.senders.length} pengirim)${unrecognizedInfo}${storageInfo}.`;

    return { archive: archiveMeta, summaryText };
  }

  _inferArchiveName(fileName, senders, ownerSender) {
    const cleanedFile = fileName
      .replace(/\.txt$/i, '')
      .replace(/^WhatsApp Chat with\s+/i, '')
      .replace(/^Chat WhatsApp dengan\s+/i, '')
      .trim();

    if (senders.length === 2 && ownerSender) {
      const other = senders.find((s) => s.name.toLowerCase() !== ownerSender.toLowerCase());
      if (
        other &&
        (!cleanedFile || /^(chat|export|whatsapp|arsip|sample|contoh)$/i.test(cleanedFile))
      ) {
        return other.name;
      }
    }

    return cleanedFile || (senders[0] ? senders[0].name : 'Arsip WhatsApp');
  }

  async loadSampleArchive() {
    const res = await this._processAndStoreRawChat(
      SAMPLE_ARCHIVE_TEXT,
      'WhatsApp Chat with almira.txt'
    );
    this.archives = await getAllArchives();
    this.renderSidebarArchiveList();

    if (res) {
      await this.openArchive(res.archive.id, { showMobileChat: true });
      this.showBanner(res.summaryText);
    }
  }

  async openArchive(archiveId, { showMobileChat = true } = {}) {
    const meta = this.archives.find((a) => a.id === archiveId);
    if (!meta) return;

    const messages = await getArchiveMessages(archiveId);
    this.currentArchive = meta;
    this.currentMessages = messages;
    this.currentVisibleDate = meta.lastDate || '';
    this.activeComposerSender =
      meta.ownerSender || this.preferredOwnerName || (meta.senders?.[0]?.name ?? 'zim');

    await setSetting('lastActiveArchiveId', archiveId);

    this.emptyStateView.hidden = true;
    this.activeChatView.hidden = false;

    if (showMobileChat) {
      this.appShell.classList.add('mobile-chat-active');
    }

    this._updateChatHeader();
    this._updateComposerSenderUI();
    this.closeChatSearchBar();

    this.searchEngine.setMessages(this.currentMessages);
    this.renderer.setConversation(this.currentMessages, {
      ownerSender: this.currentArchive.ownerSender,
      senderCount: (this.currentArchive.senders || []).length,
      highlightQuery: '',
      initialPosition: 'bottom'
    });

    this.renderSidebarArchiveList();
  }

  _updateChatHeader() {
    if (!this.currentArchive) return;
    const name = this.currentArchive.name;
    this.chatHeaderTitle.textContent = name;
    this.chatHeaderAvatar.textContent = getInitials(name);
    this.chatHeaderAvatar.style.backgroundColor = getSenderColor(name);

    const senderNames = (this.currentArchive.senders || []).map((s) => s.name).join(', ');
    const ownerInfo = this.currentArchive.ownerSender
      ? ` • Anda: ${this.currentArchive.ownerSender}`
      : '';
    const syncInfo = this.currentArchive.cloudSynced ? ' • ☁️ Supabase' : ' • 💾 Lokal';
    const countText = `${formatNumber(this.currentArchive.messageCount)} pesan`;
    this.chatHeaderSubtitle.textContent = senderNames
      ? `${countText} • Pengirim: ${senderNames}${ownerInfo}${syncInfo}`
      : `${countText}${syncInfo}`;
  }

  async _applyOwnerSender(newOwner) {
    if (!this.currentArchive) return;
    const updated = await updateArchiveMeta(this.currentArchive.id, {
      ownerSender: newOwner
    });
    if (updated) {
      this.currentArchive = updated;
      const idx = this.archives.findIndex((a) => a.id === updated.id);
      if (idx !== -1) this.archives[idx] = updated;
    }

    if (newOwner) {
      this.preferredOwnerName = newOwner;
      this.activeComposerSender = newOwner;
      await setSetting('preferredOwnerSender', newOwner);
    }

    this._updateChatHeader();
    this._updateComposerSenderUI();
    this.renderer.setOwnerSender(newOwner);
  }

  _updateComposerSenderUI() {
    if (!this.composerSenderName) return;
    const sender =
      this.activeComposerSender ||
      this.currentArchive?.ownerSender ||
      this.preferredOwnerName ||
      'zim';
    this.composerSenderName.textContent = sender;
  }

  /**
   * Send a new message from the bottom composer input, append to active conversation,
   * persist to IndexedDB, and scroll to bottom.
   */
  async sendMessageFromComposer() {
    if (!this.currentArchive) return;
    const rawText = this.composerInput.value;
    if (!rawText || rawText.trim().length === 0) return;

    const messageText = rawText.replace(/\r\n?/g, '\n').trimEnd();
    const senderName =
      (this.activeComposerSender || this.currentArchive.ownerSender || this.preferredOwnerName || 'zim').trim();

    const now = new Date();
    const yyyy = String(now.getFullYear()).padStart(4, '0');
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    const isoDate = `${yyyy}-${mm}-${dd}`;
    const hh = String(now.getHours()).padStart(2, '0');
    const min = String(now.getMinutes()).padStart(2, '0');
    const timeStr = `${hh}:${min}`;

    const newMsg = {
      id: `${this.currentArchive.id}-${this.currentMessages.length + 1}-${Date.now()}`,
      date: isoDate,
      timestamp: now.getTime(),
      time: timeStr,
      sender: senderName,
      message: messageText,
      type: 'text'
    };

    this.currentMessages.push(newMsg);

    // Update archive metadata (messageCount, senders, dates, lastMessage, etc.)
    const sendersList = Array.isArray(this.currentArchive.senders)
      ? [...this.currentArchive.senders]
      : [];
    const existingSenderIdx = sendersList.findIndex(
      (s) => s.name.toLowerCase() === senderName.toLowerCase()
    );
    if (existingSenderIdx !== -1) {
      sendersList[existingSenderIdx] = {
        ...sendersList[existingSenderIdx],
        count: sendersList[existingSenderIdx].count + 1
      };
    } else {
      sendersList.push({ name: senderName, count: 1 });
    }
    sendersList.sort((a, b) => b.count - a.count);

    const datesSet = new Set(this.currentArchive.dates || []);
    datesSet.add(isoDate);
    const updatedDates = Array.from(datesSet).sort();

    const prevStats = this.currentArchive.stats || {
      totalLines: 0,
      parsedMessages: 0,
      systemMessages: 0,
      mediaMessages: 0,
      multilineCount: 0,
      unrecognizedLines: []
    };
    const addedLines = messageText.split('\n').length;

    const updatedMeta = {
      ...this.currentArchive,
      messageCount: this.currentMessages.length,
      senders: sendersList,
      dates: updatedDates,
      firstDate: updatedDates[0] || isoDate,
      lastDate: updatedDates[updatedDates.length - 1] || isoDate,
      lastMessage: messageText.replace(/\s+/g, ' ').slice(0, 120),
      lastSender: senderName,
      lastTimestamp: now.getTime(),
      lastTime: timeStr,
      stats: {
        ...prevStats,
        totalLines: (prevStats.totalLines || 0) + addedLines,
        parsedMessages: this.currentMessages.length,
        multilineCount: (prevStats.multilineCount || 0) + (addedLines > 1 ? 1 : 0)
      },
      updatedAt: Date.now()
    };

    await saveArchiveWithMessages(updatedMeta, this.currentMessages);
    this.currentArchive = updatedMeta;

    const archIdx = this.archives.findIndex((a) => a.id === updatedMeta.id);
    if (archIdx !== -1) {
      this.archives[archIdx] = updatedMeta;
      this.archives.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    }

    // Clear composer input
    this.composerInput.value = '';
    this.composerInput.style.height = 'auto';

    // Update UI & scroll to bottom
    this._updateChatHeader();
    this.renderSidebarArchiveList(this.sidebarSearchInput.value);
    this.searchEngine.setMessages(this.currentMessages);
    this.renderer.setConversation(this.currentMessages, {
      ownerSender: this.currentArchive.ownerSender,
      senderCount: (this.currentArchive.senders || []).length,
      highlightQuery: this.chatSearchInput.value || '',
      initialPosition: 'bottom'
    });
  }

  /**
   * Open Popup to switch which sender you are currently typing as in the composer
   * (Allows sending messages as yourself on the right, or simulating replies from the contact on the left)
   */
  openComposerSenderPopup() {
    if (!this.currentArchive) return;

    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const desc = document.createElement('p');
    desc.className = 'popup-description';
    desc.textContent =
      'Pilih nama pengirim saat Anda mengirim pesan baru di kolom bawah. Jika sama dengan Pengirim Anda (Kanan), pesan muncul di kanan (hijau). Jika memilih nama kontak lain, pesan muncul di kiri.';
    container.appendChild(desc);

    const senders = this.currentArchive.senders || [];
    let selectedVal =
      this.activeComposerSender || this.currentArchive.ownerSender || this.preferredOwnerName || 'zim';

    const radioList = document.createElement('div');
    radioList.className = 'popup-radio-list';

    const inputGroup = document.createElement('div');
    inputGroup.className = 'popup-field-group';
    const inputLabel = document.createElement('label');
    inputLabel.className = 'popup-field-label';
    inputLabel.textContent = 'Kirim Pesan Sebagai:';
    const customInput = document.createElement('input');
    customInput.type = 'text';
    customInput.className = 'popup-input';
    customInput.value = selectedVal;

    const updateSelection = (val) => {
      selectedVal = val;
      customInput.value = val;
      radioList.querySelectorAll('.popup-radio-option').forEach((el) => {
        const v = el.getAttribute('data-sender-val') || '';
        el.classList.toggle('selected', v.toLowerCase() === val.toLowerCase());
      });
    };

    for (const s of senders) {
      const row = document.createElement('div');
      row.className =
        'popup-radio-option' +
        (s.name.toLowerCase() === selectedVal.toLowerCase() ? ' selected' : '');
      row.setAttribute('data-sender-val', s.name);

      const left = document.createElement('div');
      left.className = 'popup-radio-left';
      const isOwner =
        this.currentArchive.ownerSender &&
        s.name.toLowerCase() === this.currentArchive.ownerSender.toLowerCase();
      left.textContent = `👤 ${s.name}${isOwner ? ' (Anda - Kanan)' : ' (Kontak - Kiri)'}`;

      const right = document.createElement('span');
      right.className = 'popup-radio-count';
      right.textContent = `${formatNumber(s.count)} pesan`;

      row.appendChild(left);
      row.appendChild(right);
      row.addEventListener('click', () => updateSelection(s.name));
      radioList.appendChild(row);
    }

    container.appendChild(radioList);
    inputGroup.appendChild(inputLabel);
    inputGroup.appendChild(customInput);
    container.appendChild(inputGroup);

    const applySender = () => {
      const val = customInput.value.trim();
      if (!val) return;
      this.activeComposerSender = val;
      this._updateComposerSenderUI();
      this.closeCustomPopup();
      this.composerInput.focus();
    };

    this.openCustomPopup({
      title: 'Kirim Pesan Sebagai',
      bodyNode: container,
      buttons: [
        { label: 'Batal', variant: 'cancel' },
        { label: 'Pilih Pengirim', variant: 'primary', onClick: applySender }
      ]
    });
  }

  /**
   * Open Custom Popup to create a brand new conversation from scratch
   */
  openNewChatPopup() {
    const container = document.createElement('div');
    container.style.display = 'flex';
    container.style.flexDirection = 'column';
    container.style.gap = '12px';

    const contactGroup = document.createElement('div');
    contactGroup.className = 'popup-field-group';
    const contactLabel = document.createElement('label');
    contactLabel.className = 'popup-field-label';
    contactLabel.textContent = 'Nama Kontak / Nama Percakapan';
    const contactInput = document.createElement('input');
    contactInput.type = 'text';
    contactInput.className = 'popup-input';
    contactInput.placeholder = 'Contoh: almira';
    contactGroup.appendChild(contactLabel);
    contactGroup.appendChild(contactInput);

    const ownerGroup = document.createElement('div');
    ownerGroup.className = 'popup-field-group';
    const ownerLabel = document.createElement('label');
    ownerLabel.className = 'popup-field-label';
    ownerLabel.textContent = 'Nama Anda (Bubble Kanan)';
    const ownerInput = document.createElement('input');
    ownerInput.type = 'text';
    ownerInput.className = 'popup-input';
    ownerInput.value = this.preferredOwnerName || 'zim';
    ownerGroup.appendChild(ownerLabel);
    ownerGroup.appendChild(ownerInput);

    container.appendChild(contactGroup);
    container.appendChild(ownerGroup);

    const createChat = async () => {
      const contactName = contactInput.value.trim() || 'Percakapan Baru';
      const ownerName = ownerInput.value.trim() || 'zim';
      this.closeCustomPopup();

      const now = new Date();
      const yyyy = String(now.getFullYear()).padStart(4, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const isoDate = `${yyyy}-${mm}-${dd}`;
      const hh = String(now.getHours()).padStart(2, '0');
      const min = String(now.getMinutes()).padStart(2, '0');
      const timeStr = `${hh}:${min}`;

      const archiveId = `arch-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const archiveMeta = {
        id: archiveId,
        name: contactName,
        fileName: `WhatsApp Chat with ${contactName}.txt`,
        fingerprint: `custom-${archiveId}`,
        ownerSender: ownerName,
        messageCount: 0,
        senders: [
          { name: ownerName, count: 0 },
          { name: contactName, count: 0 }
        ],
        dates: [isoDate],
        firstDate: isoDate,
        lastDate: isoDate,
        lastMessage: 'Percakapan baru dibuat',
        lastSender: '',
        lastTimestamp: now.getTime(),
        lastTime: timeStr,
        stats: {
          totalLines: 0,
          parsedMessages: 0,
          systemMessages: 0,
          mediaMessages: 0,
          multilineCount: 0,
          unrecognizedLines: []
        },
        updatedAt: Date.now()
      };

      await saveArchiveWithMessages(archiveMeta, []);
      this.archives = await getAllArchives();
      this.renderSidebarArchiveList();
      await this.openArchive(archiveId, { showMobileChat: true });
      this.composerInput.focus();
    };

    this.openCustomPopup({
      title: 'Buat Percakapan Baru',
      bodyNode: container,
      buttons: [
        { label: 'Batal', variant: 'cancel' },
        { label: 'Buat Percakapan', variant: 'primary', onClick: createChat }
      ]
    });

    setTimeout(() => contactInput.focus(), 30);
  }

  /**
   * Export current conversation (including newly sent messages) back to standard WhatsApp `.txt` format
   */
  exportCurrentArchiveToTxt() {
    if (!this.currentArchive || this.currentMessages.length === 0) {
      this.showInfoPopup('Arsip Kosong', 'Tidak ada pesan untuk diekspor.');
      return;
    }

    const lines = this.currentMessages.map((msg) => {
      // Format date YYYY-MM-DD -> M/D/YY
      const parts = (msg.date || '').split('-');
      let dateFormatted = msg.date;
      if (parts.length === 3) {
        const m = Number(parts[1]);
        const d = Number(parts[2]);
        const yy = parts[0].slice(-2);
        dateFormatted = `${m}/${d}/${yy}`;
      }

      // Format 24h time HH:mm -> 12h h:mm AM/PM
      const timeParts = (msg.time || '00:00').split(':');
      let hr = Number(timeParts[0] || 0);
      const mn = String(timeParts[1] || '00').padStart(2, '0');
      const ampm = hr >= 12 ? 'PM' : 'AM';
      hr = hr % 12;
      if (hr === 0) hr = 12;
      const timeFormatted = `${hr}:${mn}\u202F${ampm}`;

      if (msg.type === 'system' || !msg.sender) {
        return `${dateFormatted}, ${timeFormatted} - ${msg.message}`;
      }
      return `${dateFormatted}, ${timeFormatted} - ${msg.sender}: ${msg.message}`;
    });

    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WhatsApp Chat with ${this.currentArchive.name}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  renderSidebarArchiveList(filterQuery = '') {
    this.archiveList.replaceChildren();
    this.archiveTotalBadge.textContent = formatNumber(this.archives.length);

    const q = (filterQuery || '').trim().toLowerCase();
    const filtered = q
      ? this.archives.filter(
          (a) =>
            a.name.toLowerCase().includes(q) ||
            (a.lastMessage || '').toLowerCase().includes(q)
        )
      : this.archives;

    if (filtered.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'archive-empty-hint';
      empty.textContent =
        this.archives.length === 0
          ? 'Belum ada arsip percakapan. Klik menu titik tiga (⋮) di atas untuk Import TXT atau memuat Contoh.'
          : 'Tidak ada nama arsip yang cocok.';
      this.archiveList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();

    for (const arch of filtered) {
      const item = document.createElement('div');
      item.className =
        'archive-item' +
        (this.currentArchive && this.currentArchive.id === arch.id ? ' active' : '');
      item.setAttribute('data-archive-id', arch.id);
      item.setAttribute('role', 'option');
      item.setAttribute(
        'aria-selected',
        this.currentArchive && this.currentArchive.id === arch.id ? 'true' : 'false'
      );

      const avatar = document.createElement('div');
      avatar.className = 'contact-avatar';
      avatar.style.backgroundColor = getSenderColor(arch.name);
      avatar.textContent = getInitials(arch.name);

      const body = document.createElement('div');
      body.className = 'archive-item-body';

      const topRow = document.createElement('div');
      topRow.className = 'archive-item-top';

      const nameEl = document.createElement('span');
      nameEl.className = 'archive-item-name';
      nameEl.textContent = arch.name;

      const timeEl = document.createElement('span');
      timeEl.className = 'archive-item-time';
      timeEl.textContent = arch.lastDate
        ? `${formatShortDate(arch.lastDate)} ${arch.lastTime || ''}`
        : '';

      topRow.appendChild(nameEl);
      topRow.appendChild(timeEl);

      const bottomRow = document.createElement('div');
      bottomRow.className = 'archive-item-bottom';

      const previewEl = document.createElement('span');
      previewEl.className = 'archive-item-preview';
      const senderPrefix = arch.lastSender ? `${arch.lastSender}: ` : '';
      previewEl.textContent = `${senderPrefix}${arch.lastMessage || ''}`;

      const countBadge = document.createElement('span');
      countBadge.className = 'archive-item-count';
      const syncStatusIcon = arch.cloudSynced ? '☁️' : '💾';
      countBadge.title = `${formatNumber(arch.messageCount)} pesan (${arch.cloudSynced ? 'Tersimpan di Supabase' : 'Tersimpan di Lokal saja'})`;
      countBadge.textContent = `${syncStatusIcon} ${formatNumber(arch.messageCount)}`;

      bottomRow.appendChild(previewEl);
      bottomRow.appendChild(countBadge);

      body.appendChild(topRow);
      body.appendChild(bottomRow);

      item.appendChild(avatar);
      item.appendChild(body);

      item.addEventListener('click', () => {
        this.openArchive(arch.id, { showMobileChat: true });
      });

      fragment.appendChild(item);
    }

    this.archiveList.appendChild(fragment);
  }

  _handleSidebarSearch(rawQuery) {
    const q = (rawQuery || '').trim();
    this.renderSidebarArchiveList(q);

    if (!q || !this.currentArchive) {
      this.sidebarSearchResultsSection.hidden = true;
      this.sidebarSearchResultsList.replaceChildren();
      if (this.inChatSearchBar.hidden) {
        this.searchEngine.clear();
      }
      return;
    }

    const res = this.searchEngine.search(q);
    this.sidebarSearchResultsSection.hidden = false;
    this.sidebarSearchCountBadge.textContent = formatNumber(res.totalMatches);

    this.searchEngine.renderResultsList(this.sidebarSearchResultsList, (matchIdx) => {
      this.searchEngine.selectMatchAt(matchIdx);
      this.appShell.classList.add('mobile-chat-active');
      this._highlightActiveResultItem(this.sidebarSearchResultsList, matchIdx);
    });
  }

  openChatSearchBar() {
    if (!this.currentArchive) return;
    this.inChatSearchBar.hidden = false;
    this.chatSearchInput.focus();
    this.chatSearchInput.select();
  }

  closeChatSearchBar() {
    this.inChatSearchBar.hidden = true;
    this.chatSearchResultsDrawer.hidden = true;
    this.chatSearchInput.value = '';
    this.chatSearchCounter.textContent = '0 / 0';
    this.searchEngine.clear();
  }

  _runInChatSearch(rawQuery) {
    const q = (rawQuery || '').trim();
    if (!q) {
      this.searchEngine.clear();
      this.chatSearchCounter.textContent = '0 / 0';
      this.chatSearchResultsDrawer.hidden = true;
      return;
    }

    const res = this.searchEngine.search(q);
    this._updateSearchCounterUI(res);
    this.chatSearchResultsDrawer.hidden = false;

    this.searchEngine.renderResultsList(this.chatSearchResultsList, (matchIdx) => {
      const navRes = this.searchEngine.selectMatchAt(matchIdx);
      if (navRes) {
        this._updateSearchCounterUI(navRes);
        this._highlightActiveResultItem(this.chatSearchResultsList, matchIdx);
      }
    });
  }

  _navigateSearch(direction) {
    const res = direction === 'prev' ? this.searchEngine.prev() : this.searchEngine.next();
    this._updateSearchCounterUI(res);
    this._highlightActiveResultItem(this.chatSearchResultsList, res.activePointer);
  }

  _updateSearchCounterUI({ totalMatches, activePointer }) {
    if (totalMatches === 0) {
      this.chatSearchCounter.textContent = '0 / 0';
    } else {
      this.chatSearchCounter.textContent = `${formatNumber(activePointer + 1)} / ${formatNumber(totalMatches)}`;
    }
  }

  _highlightActiveResultItem(container, activeIdx) {
    const prev = container.querySelector('.search-result-item.active');
    if (prev) prev.classList.remove('active');
    const next = container.querySelector(`[data-match-idx="${activeIdx}"]`);
    if (next) {
      next.classList.add('active');
      next.scrollIntoView({ block: 'nearest' });
    }
  }

  /**
   * Close the currently open conversation and return to the initial welcome/empty state
   */
  closeActiveChat() {
    this._closeAllDropdowns();
    this.closeChatSearchBar();
    this.currentArchive = null;
    this.currentMessages = [];
    this.showEmptyState();
    this.renderSidebarArchiveList(this.sidebarSearchInput.value);
  }

  showEmptyState() {
    this.activeChatView.hidden = true;
    this.emptyStateView.hidden = false;
    this.appShell.classList.remove('mobile-chat-active');
  }

  showBanner(message) {
    if (this.emptyStateView && !this.emptyStateView.hidden) {
      this.showInfoPopup('Informasi', message);
      return;
    }
    this.statusBannerText.textContent = message;
    this.statusBanner.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new WhatsAppArchiveApp();
  app.init();
});
