/**
 * js/ui.js — E-Learniz Universal UI System
 * Components:
 * 1. Universal Toast (Success, Error, Warning, Info)
 * 2. Universal Popup (Alert, Confirm, Custom Modals, Scroll-Lock, Fade In/Out, Esc/Enter/Back Navigation)
 * 3. Universal Dropdown (Custom Accessible Select Replacement with Keyboard Nav)
 */

(function () {
  'use strict';

  // State
  const activePopups = [];
  const dropdownInstances = new Map();
  let toastContainer = null;
  let isBackNavigating = false;

  /* ==========================================================================
     1. SCROLL LOCK CONTROLLER (No page jump, preserves scroll position)
     ========================================================================== */
  const ScrollLock = {
    lockCount: 0,
    savedScrollY: 0,

    lock() {
      if (this.lockCount === 0) {
        this.savedScrollY = window.scrollY || document.documentElement.scrollTop || 0;
        document.body.style.position = 'fixed';
        document.body.style.top = `-${this.savedScrollY}px`;
        document.body.style.left = '0';
        document.body.style.right = '0';
        document.body.style.width = '100%';
        document.body.style.overflow = 'hidden';
      }
      this.lockCount++;
    },

    unlock() {
      this.lockCount = Math.max(0, this.lockCount - 1);
      if (this.lockCount === 0) {
        const y = this.savedScrollY;
        document.body.style.position = '';
        document.body.style.top = '';
        document.body.style.left = '';
        document.body.style.right = '';
        document.body.style.width = '';
        document.body.style.overflow = '';
        window.scrollTo(0, y);
      }
    }
  };

  /* ==========================================================================
     2. UNIVERSAL TOAST SYSTEM
     ========================================================================== */
  function ensureToastContainer() {
    if (!toastContainer || !document.body.contains(toastContainer)) {
      let existing = document.getElementById('universalToastContainer');
      if (!existing) {
        existing = document.createElement('div');
        existing.id = 'universalToastContainer';
        existing.className = 'universal-toast-container';
        existing.setAttribute('aria-live', 'polite');
        existing.setAttribute('aria-atomic', 'true');
        document.body.appendChild(existing);
      }
      toastContainer = existing;
    }
    return toastContainer;
  }

  const TOAST_ICONS = {
    success: 'fa-solid fa-circle-check',
    error: 'fa-solid fa-circle-xmark',
    warning: 'fa-solid fa-triangle-exclamation',
    info: 'fa-solid fa-circle-info'
  };

  function showToast(message, type = 'info', duration = 3200) {
    const container = ensureToastContainer();
    const cleanType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';

    const toast = document.createElement('div');
    toast.className = `u-toast u-toast-${cleanType}`;
    toast.innerHTML = `
      <div class="u-toast-icon">
        <i class="${TOAST_ICONS[cleanType]}"></i>
      </div>
      <div class="u-toast-msg">${escapeHtml(message)}</div>
      <button type="button" class="u-toast-close" title="Tutup">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;

    const closeBtn = toast.querySelector('.u-toast-close');
    let timerId = null;

    const dismiss = () => {
      if (timerId) clearTimeout(timerId);
      if (toast.classList.contains('is-closing')) return;
      toast.classList.add('is-closing');
      toast.addEventListener('animationend', () => {
        toast.remove();
      }, { once: true });
      setTimeout(() => toast.remove(), 350); // Fallback
    };

    toast.addEventListener('click', dismiss);
    if (closeBtn) {
      closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dismiss();
      });
    }

    container.appendChild(toast);

    if (duration > 0) {
      timerId = setTimeout(dismiss, duration);
    }

    return { dismiss };
  }

  /* ==========================================================================
     3. UNIVERSAL POPUP SYSTEM (Alert, Confirm, Modals, Esc, Enter, Back)
     ========================================================================== */
  function openModal(modalOrId) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal) return;

    if (modal.classList.contains('is-open')) return;

    modal.classList.remove('is-closing');
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');

    ScrollLock.lock();
    activePopups.push(modal);

    // Push history state for mobile back button
    try {
      history.pushState({ elearnizModalOpen: modal.id || 'anonymous_modal' }, '');
    } catch (_) {}

    // Focus first interactive element inside dialog
    const focusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (focusable) {
      setTimeout(() => focusable.focus(), 60);
    }
  }

  function closeModal(modalOrId, options = {}) {
    const modal = typeof modalOrId === 'string' ? document.getElementById(modalOrId) : modalOrId;
    if (!modal || !modal.classList.contains('is-open')) return;

    if (modal.classList.contains('is-closing')) return;
    modal.classList.add('is-closing');

    // Remove from active stack
    const idx = activePopups.indexOf(modal);
    if (idx !== -1) {
      activePopups.splice(idx, 1);
    }

    let hasCompleted = false;
    const onComplete = () => {
      if (hasCompleted) return;
      hasCompleted = true;
      modal.classList.remove('is-open', 'is-closing');
      modal.setAttribute('aria-hidden', 'true');
      ScrollLock.unlock();
      if (modal.dataset.dynamicPopup === 'true') {
        modal.remove();
      }
    };

    modal.addEventListener('animationend', onComplete, { once: true });
    setTimeout(onComplete, 240); // Matched with popUpFadeOut animation

    // Revert history state if closed manually and not via popstate
    if (!options.fromPopState && history.state && history.state.elearnizModalOpen) {
      isBackNavigating = true;
      history.back();
      setTimeout(() => { isBackNavigating = false; }, 100);
    }
  }

  function closeTopmostPopup() {
    // 1. Close any open custom dropdown first
    const openDropdown = document.querySelector('.u-dropdown.is-open');
    if (openDropdown) {
      closeDropdown(openDropdown);
      return true;
    }

    // 2. Close active popup
    if (activePopups.length > 0) {
      const top = activePopups[activePopups.length - 1];
      closeModal(top);
      return true;
    }
    return false;
  }

  // Handle mobile Back Button (popstate)
  window.addEventListener('popstate', (e) => {
    if (isBackNavigating) return;
    if (activePopups.length > 0) {
      const top = activePopups[activePopups.length - 1];
      closeModal(top, { fromPopState: true });
    }
  });

  // Handle Keyboard (Escape & Enter)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const closed = closeTopmostPopup();
      if (closed) {
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (e.key === 'Enter') {
      if (activePopups.length > 0) {
        const top = activePopups[activePopups.length - 1];
        // Only trigger confirm shortcut if not currently in a multiline textarea
        if (e.target && e.target.tagName === 'TEXTAREA') return;

        const confirmBtn = top.querySelector('[data-popup-confirm="true"]');
        if (confirmBtn && !confirmBtn.disabled) {
          e.preventDefault();
          confirmBtn.click();
        }
      }
    }
  });

  // Dynamic Informational Popup (Popup.alert)
  function alertPopup(options = {}) {
    const {
      title = 'Informasi',
      message = '',
      okText = 'Mengerti',
      type = 'info'
    } = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      const dialogId = `uAlert_${Date.now()}`;
      const iconClass = TOAST_ICONS[type] || TOAST_ICONS.info;

      const modalEl = document.createElement('div');
      modalEl.id = dialogId;
      modalEl.className = 'modal-backdrop u-modal-center';
      modalEl.dataset.dynamicPopup = 'true';
      modalEl.innerHTML = `
        <div class="modal-dialog u-dialog-sm" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3><i class="${iconClass}"></i> ${escapeHtml(title)}</h3>
            <button type="button" class="modal-close-btn" data-close="true">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <p style="font-size:0.92rem;line-height:1.6;color:var(--text-main);">${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer" style="justify-content:flex-end;">
            <button type="button" class="btn-primary" data-ok="true">${escapeHtml(okText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);

      const handleOk = () => {
        closeModal(modalEl);
        resolve();
      };

      modalEl.querySelector('[data-ok="true"]').addEventListener('click', handleOk);
      modalEl.querySelector('[data-close="true"]').addEventListener('click', () => {
        closeModal(modalEl);
        resolve();
      });

      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) {
          closeModal(modalEl);
          resolve();
        }
      });

      openModal(modalEl);
    });
  }

  // Dynamic Confirmation Popup (Popup.confirm)
  function confirmPopup(options = {}) {
    const {
      title = 'Konfirmasi',
      message = 'Apakah kamu yakin ingin melanjutkan?',
      confirmText = 'Ya, Lanjutkan',
      cancelText = 'Batal',
      isDanger = false,
      onConfirm,
      onCancel
    } = typeof options === 'string' ? { message: options } : options;

    return new Promise((resolve) => {
      const dialogId = `uConfirm_${Date.now()}`;

      const modalEl = document.createElement('div');
      modalEl.id = dialogId;
      modalEl.className = 'modal-backdrop u-modal-center';
      modalEl.dataset.dynamicPopup = 'true';
      modalEl.innerHTML = `
        <div class="modal-dialog u-dialog-sm" role="dialog" aria-modal="true">
          <div class="modal-header">
            <h3>${isDanger ? '<i class="fa-solid fa-triangle-exclamation" style="color:var(--coral-rose);"></i> ' : ''}${escapeHtml(title)}</h3>
            <button type="button" class="modal-close-btn" data-cancel="true">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>
          <div class="modal-body">
            <p style="font-size:0.92rem;line-height:1.6;color:var(--text-main);">${escapeHtml(message)}</p>
          </div>
          <div class="modal-footer" style="display:flex;justify-content:flex-end;gap:0.6rem;">
            <button type="button" class="btn-secondary" data-cancel="true">${escapeHtml(cancelText)}</button>
            <button type="button" class="${isDanger ? 'btn-danger' : 'btn-primary'}" data-popup-confirm="true">${escapeHtml(confirmText)}</button>
          </div>
        </div>
      `;

      document.body.appendChild(modalEl);

      const handleConfirm = () => {
        closeModal(modalEl);
        if (typeof onConfirm === 'function') onConfirm();
        resolve(true);
      };

      const handleCancel = () => {
        closeModal(modalEl);
        if (typeof onCancel === 'function') onCancel();
        resolve(false);
      };

      modalEl.querySelector('[data-popup-confirm="true"]').addEventListener('click', handleConfirm);
      modalEl.querySelectorAll('[data-cancel="true"]').forEach((b) => b.addEventListener('click', handleCancel));

      modalEl.addEventListener('click', (e) => {
        if (e.target === modalEl) handleCancel();
      });

      openModal(modalEl);
    });
  }

  // Delegated close listener for standard static modals
  document.addEventListener('click', (e) => {
    // Backdrop click
    if (e.target && e.target.classList.contains('modal-backdrop') && e.target.classList.contains('is-open')) {
      closeModal(e.target);
      return;
    }
    // Close button
    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      const targetId = closeBtn.getAttribute('data-close-modal');
      closeModal(targetId);
    }
  });

  /* ==========================================================================
     4. UNIVERSAL DROPDOWN (Accessible custom select replacement)
     ========================================================================== */
  function closeDropdown(dropdownEl) {
    if (!dropdownEl || !dropdownEl.classList.contains('is-open')) return;
    if (dropdownEl.classList.contains('is-closing')) return;
    dropdownEl.classList.add('is-closing');
    const trigger = dropdownEl.querySelector('.u-dropdown-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');
    setTimeout(() => {
      dropdownEl.classList.remove('is-open', 'is-closing');
    }, 180);
  }

  function openDropdown(dropdownEl) {
    // Close any other open dropdown first
    document.querySelectorAll('.u-dropdown.is-open').forEach((d) => {
      if (d !== dropdownEl) closeDropdown(d);
    });
    dropdownEl.classList.remove('is-closing');
    dropdownEl.classList.add('is-open');
    const trigger = dropdownEl.querySelector('.u-dropdown-trigger');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');

    // Scroll active item into view
    const activeItem = dropdownEl.querySelector('.u-dropdown-option.is-selected');
    if (activeItem) {
      activeItem.scrollIntoView({ block: 'nearest' });
    }
  }

  function enhanceSelect(nativeSelect, onChangeCallback) {
    if (!nativeSelect) return null;
    if (dropdownInstances.has(nativeSelect)) {
      // Re-sync options if already enhanced
      const existing = dropdownInstances.get(nativeSelect);
      existing.sync();
      return existing;
    }

    // Hide native select visually but keep in DOM for forms
    nativeSelect.style.position = 'absolute';
    nativeSelect.style.opacity = '0';
    nativeSelect.style.pointerEvents = 'none';
    nativeSelect.style.width = '1px';
    nativeSelect.style.height = '1px';
    nativeSelect.tabIndex = -1;

    const dropdown = document.createElement('div');
    dropdown.className = 'u-dropdown';
    if (nativeSelect.disabled) dropdown.classList.add('is-disabled');

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'u-dropdown-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');

    const triggerLabel = document.createElement('span');
    triggerLabel.className = 'u-dropdown-label';
    const triggerArrow = document.createElement('i');
    triggerArrow.className = 'fa-solid fa-chevron-down u-dropdown-arrow';

    trigger.appendChild(triggerLabel);
    trigger.appendChild(triggerArrow);
    dropdown.appendChild(trigger);

    const menu = document.createElement('div');
    menu.className = 'u-dropdown-menu';
    menu.setAttribute('role', 'listbox');
    dropdown.appendChild(menu);

    nativeSelect.parentNode.insertBefore(dropdown, nativeSelect.nextSibling);

    const syncOptions = () => {
      menu.innerHTML = '';
      const options = Array.from(nativeSelect.options);
      const selectedIndex = nativeSelect.selectedIndex;
      const selectedOpt = nativeSelect.options[selectedIndex];

      triggerLabel.textContent = selectedOpt ? selectedOpt.textContent : (nativeSelect.getAttribute('placeholder') || 'Pilih...');

      options.forEach((opt, idx) => {
        const item = document.createElement('div');
        item.className = 'u-dropdown-option';
        item.setAttribute('role', 'option');
        item.setAttribute('data-value', opt.value);
        item.setAttribute('data-index', String(idx));

        const isSelected = idx === selectedIndex;
        if (isSelected) {
          item.classList.add('is-selected');
          item.setAttribute('aria-selected', 'true');
        }

        item.innerHTML = `
          <span class="u-dropdown-opt-text">${escapeHtml(opt.textContent)}</span>
          <i class="fa-solid fa-check u-dropdown-check"></i>
        `;

        item.addEventListener('click', (e) => {
          e.stopPropagation();
          selectIndex(idx);
          closeDropdown(dropdown);
          trigger.focus();
        });

        menu.appendChild(item);
      });
    };

    const selectIndex = (idx) => {
      if (idx < 0 || idx >= nativeSelect.options.length) return;
      nativeSelect.selectedIndex = idx;
      nativeSelect.dispatchEvent(new Event('change', { bubbles: true }));
      syncOptions();
      if (typeof onChangeCallback === 'function') {
        onChangeCallback(nativeSelect.value, nativeSelect.options[idx]);
      }
    };

    trigger.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (nativeSelect.disabled) return;
      if (dropdown.classList.contains('is-open')) {
        closeDropdown(dropdown);
      } else {
        openDropdown(dropdown);
      }
    });

    // Keyboard navigation
    trigger.addEventListener('keydown', (e) => {
      if (nativeSelect.disabled) return;
      const isOpen = dropdown.classList.contains('is-open');

      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        if (!isOpen) {
          openDropdown(dropdown);
          return;
        }
        const delta = e.key === 'ArrowDown' ? 1 : -1;
        const newIndex = Math.min(Math.max(nativeSelect.selectedIndex + delta, 0), nativeSelect.options.length - 1);
        selectIndex(newIndex);
      } else if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        if (isOpen) {
          closeDropdown(dropdown);
        } else {
          openDropdown(dropdown);
        }
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        e.stopPropagation();
        closeDropdown(dropdown);
      }
    });

    // Native change listener (if changed externally via JS)
    nativeSelect.addEventListener('change', () => {
      syncOptions();
    });

    syncOptions();

    const instance = {
      dropdown,
      sync: syncOptions,
      destroy: () => {
        dropdown.remove();
        nativeSelect.style.position = '';
        nativeSelect.style.opacity = '';
        nativeSelect.style.pointerEvents = '';
        nativeSelect.style.width = '';
        nativeSelect.style.height = '';
        nativeSelect.tabIndex = 0;
        dropdownInstances.delete(nativeSelect);
      }
    };

    dropdownInstances.set(nativeSelect, instance);
    return instance;
  }

  // Global click outside to close dropdowns
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.u-dropdown')) {
      document.querySelectorAll('.u-dropdown.is-open').forEach(closeDropdown);
    }
  });

  /* ==========================================================================
     HELPERS
     ========================================================================== */
  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Warna aksen dari DB hanya boleh hex; selain itu pakai fallback.
  // Mencegah injeksi CSS lewat atribut style.
  function safeColor(value, fallback = '#2563eb') {
    const s = String(value || '').trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(s) ? s : fallback;
  }

  // Public API
  window.ELearnizUI = {
    escapeHtml,
    safeColor,
    toast: showToast,
    popup: {
      open: openModal,
      close: closeModal,
      alert: alertPopup,
      confirm: confirmPopup
    },
    dropdown: {
      enhanceSelect,
      closeAll: () => document.querySelectorAll('.u-dropdown.is-open').forEach(closeDropdown)
    },
    ScrollLock
  };

  // Helper shortcuts for compatibility
  window.showToast = (msg, type = 'info', duration) => showToast(msg, type, duration);
  window.showPopup = (msg, type = 'info') => alertPopup({ message: msg, type });
})();
