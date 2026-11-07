/* ==========================================================================
   js/sidebar.js — Authentic E-Learniz Sidebar, Header Dropdowns & Bottom Nav
   ========================================================================== */
(function () {
  function initNavigation(options) {
    const {
      onNavigateHome,
      onNavigateTugas,
      onNavigateSubject
    } = options || {};

    const hamburger = document.getElementById('hamburgerBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    const bnMenuBtn = document.getElementById('bnMenuBtn');
    const bnProfileBtn = document.getElementById('bnProfileBtn');

    function toggleSidebar(forceState) {
      if (!sidebar) return;
      const isOpen = typeof forceState === 'boolean'
        ? forceState
        : !sidebar.classList.contains('active');

      sidebar.classList.toggle('active', isOpen);
      if (hamburger) hamburger.classList.toggle('active', isOpen);
      if (overlay) overlay.classList.toggle('show', isOpen);
    }

    if (hamburger) {
      hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleSidebar();
      });
    }

    if (overlay) {
      overlay.addEventListener('click', () => toggleSidebar(false));
    }

    if (bnMenuBtn) {
      bnMenuBtn.addEventListener('click', (e) => {
        e.preventDefault();
        toggleSidebar();
      });
    }

    // Main Sidebar Nav (Beranda, Daftar Tugas)
    const mainNavItems = document.querySelectorAll('#sidebarMainNav li[data-nav]');
    mainNavItems.forEach((li) => {
      li.addEventListener('click', () => {
        const target = li.getAttribute('data-nav');
        toggleSidebar(false);
        if (target === 'home' && onNavigateHome) onNavigateHome();
        if (target === 'tugas' && onNavigateTugas) onNavigateTugas();
      });
    });

    // Docked Bottom Nav Items
    const bnItems = document.querySelectorAll('#bottomNav .bn-item[data-bn-nav]');
    bnItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const target = item.getAttribute('data-bn-nav');
        toggleSidebar(false);
        if (target === 'home' && onNavigateHome) onNavigateHome();
        if (target === 'tugas' && onNavigateTugas) onNavigateTugas();
        if (target === 'subject' && onNavigateSubject) onNavigateSubject(null);
      });
    });

    // Profile Dropdown in Header
    const profileTrigger = document.getElementById('profileTrigger');
    const dropdownMenu = document.getElementById('dropdownMenu');
    const caretIcon = document.getElementById('caretIcon');

    function toggleProfileDropdown(force) {
      if (!dropdownMenu) return;
      const isOpen = dropdownMenu.classList.contains('show') && !dropdownMenu.classList.contains('is-closing');
      const shouldOpen = typeof force === 'boolean' ? force : !isOpen;

      if (shouldOpen) {
        dropdownMenu.classList.remove('is-closing');
        dropdownMenu.classList.add('show');
        if (caretIcon) caretIcon.classList.add('rotate');
      } else if (isOpen) {
        dropdownMenu.classList.add('is-closing');
        if (caretIcon) caretIcon.classList.remove('rotate');
        setTimeout(() => {
          dropdownMenu.classList.remove('show', 'is-closing');
        }, 180);
      }
    }

    function closeClassDropdown() {
      const classDropdown = document.getElementById('classSwitcherDropdown');
      const classCaret = document.getElementById('classCaretIcon');
      if (classDropdown && classDropdown.classList.contains('show') && !classDropdown.classList.contains('is-closing')) {
        classDropdown.classList.add('is-closing');
        if (classCaret) classCaret.classList.remove('rotate');
        setTimeout(() => {
          classDropdown.classList.remove('show', 'is-closing');
        }, 160);
      }
    }

    window.toggleProfileDropdown = toggleProfileDropdown;
    window.closeClassDropdown = closeClassDropdown;

    if (profileTrigger) {
      profileTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleProfileDropdown();
      });
    }

    if (bnProfileBtn) {
      bnProfileBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        toggleProfileDropdown(true);
      });
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#profileTrigger') && !e.target.closest('#dropdownMenu') && !e.target.closest('#bnProfileBtn')) {
        toggleProfileDropdown(false);
      }
      if (!e.target.closest('#classSwitcherTrigger') && !e.target.closest('#classSwitcherDropdown')) {
        closeClassDropdown();
      }
    });
  }

  function renderSidebarSubjects(subjects, taskCountsBySubject, activeRoute, onSelectSubject) {
    const listEl = document.getElementById('sidebarSubjectsList');
    if (!listEl) return;

    const esc = (window.ELearnizUI && window.ELearnizUI.escapeHtml)
      ? window.ELearnizUI.escapeHtml
      : (str) => String(str === null || str === undefined ? '' : str);
    const safeColor = (window.ELearnizUI && window.ELearnizUI.safeColor)
      ? window.ELearnizUI.safeColor
      : (value) => (/^#[0-9a-fA-F]{3,8}$/.test(String(value || '')) ? value : '#2563eb');
    const safeIcon = (icon) => {
      const value = String(icon || '');
      if (/^fa-[a-z0-9-]+$/i.test(value)) return `fa-solid ${value}`;
      if (/^fa-(solid|regular|brands) fa-[a-z0-9-]+$/i.test(value)) return value;
      return 'fa-solid fa-book';
    };

    if (!subjects || subjects.length === 0) {
      listEl.innerHTML = `<li style="opacity:0.6;cursor:default;"><i class="fa-solid fa-folder-open"></i><span>Belum ada mapel</span></li>`;
      return;
    }

    listEl.innerHTML = subjects.map((subj) => {
      const iconClass = safeIcon(subj.icon);
      const pendingCount = (taskCountsBySubject && taskCountsBySubject[String(subj.id)]) || 0;
      const isActive = activeRoute && activeRoute.view === 'subject' && String(activeRoute.subjectId) === String(subj.id);
      return `
        <li class="${isActive ? 'active' : ''}" data-subject-id="${esc(subj.id)}">
          <i class="${iconClass}" style="color:${safeColor(subj.color)}"></i>
          <span>${esc(subj.name)}</span>
          ${pendingCount > 0 ? `<span class="sidebar-subj-badge">${Number(pendingCount)}</span>` : ''}
        </li>
      `;
    }).join('');

    listEl.querySelectorAll('li[data-subject-id]').forEach((li) => {
      li.addEventListener('click', () => {
        const sid = li.getAttribute('data-subject-id');
        const sidebar = document.getElementById('sidebar');
        const hamburger = document.getElementById('hamburgerBtn');
        const overlay = document.getElementById('sidebarOverlay');
        if (sidebar) sidebar.classList.remove('active');
        if (hamburger) hamburger.classList.remove('active');
        if (overlay) overlay.classList.remove('show');
        if (onSelectSubject) onSelectSubject(sid);
      });
    });
  }

  function updateActiveNavIndicators(viewName, subjectId) {
    // Sidebar Main Nav
    document.querySelectorAll('#sidebarMainNav li[data-nav]').forEach((li) => {
      const nav = li.getAttribute('data-nav');
      li.classList.toggle('active', nav === viewName);
    });

    // Sidebar Subject List
    document.querySelectorAll('#sidebarSubjectsList li[data-subject-id]').forEach((li) => {
      const sid = li.getAttribute('data-subject-id');
      li.classList.toggle('active', viewName === 'subject' && String(sid) === String(subjectId));
    });

    // Bottom Nav
    document.querySelectorAll('#bottomNav .bn-item[data-bn-nav]').forEach((item) => {
      const nav = item.getAttribute('data-bn-nav');
      item.classList.toggle('active', nav === viewName);
    });
  }

  window.ELearnizSidebar = {
    initNavigation,
    renderSidebarSubjects,
    updateActiveNavIndicators
  };
})();
