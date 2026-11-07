// ============================================================
// BOTTOM NAV — js/bottom-nav.js
// Dynamic dari DB (subjects_config, menu_group='bottomnav')
// Cache-first kayak sidebar — no blink, no flash
// ============================================================
(function () {
    'use strict';

    // Jangan render di halaman admin
    if (window.location.pathname.includes('/admiii/')) return;

    // ── FALLBACK default kalau cache kosong & DB belum load ──
    const DEFAULT_ITEMS = [
        { id: 'announcements', icon: 'fa-solid fa-table-columns', label: t('home'), href: '/' },
        { id: 'tugas', icon: 'fa-solid fa-list-check', label: t('nav_tugas'), href: 'tugas' },
        { id: 'feed', icon: 'fa-solid fa-newspaper', label: t('feed'), href: 'feed' },
        { id: 'user', icon: 'fa-solid fa-circle-user', label: t('nav_profile'), href: 'user' },
    ];

    // ── HELPERS ──────────────────────────────────────────────
    function getUser() {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    }

    function getClassId() {
        try {
            const u = getUser();
            if (!u) return '2';
            if (u.role === 'super_admin') {
                const ov = sessionStorage.getItem('class_override');
                if (ov) return ov;
            }
            return String(u.class_id);
        } catch { return null; }
    }

    function getUserId() {
        try { return getUser()?.id || null; } catch { return null; }
    }

    function cacheKey(classId) { return `bottomnav_cache_${classId}`; }

    function getCache(classId) {
        try {
            const raw = localStorage.getItem(cacheKey(classId));
            if (!raw) return null;
            const rows = JSON.parse(raw);
            return Array.isArray(rows) && rows.length ? rows : null;
        } catch { return null; }
    }

    function setCache(classId, rows) {
        try { localStorage.setItem(cacheKey(classId), JSON.stringify(rows)); } catch { }
    }

    // Konversi baris DB ke format item nav
    function rowsToItems(rows) {
        return rows.slice(0, 4).map(r => {
            let icon = (r.icon || 'fa-circle').trim();
            if (!icon.includes(' ')) icon = `fa-solid ${icon}`;
            const raw = r.subject_id || '';
            const id = raw.replace('.html', '').split('?')[0].split('/').pop() || String(r.id);
            return { id, icon, label: r.subject_name, href: raw };
        });
    }

    // ── CSS ──────────────────────────────────────────────────
    const style = document.createElement('style');
    style.id = 'bottom-nav-css';
    style.textContent = `
        #bottomNav {
            position: fixed;
            bottom: 0; left: 0; right: 0;
            height: 60px;
            background: rgba(6, 8, 16, 0.98);
            border-top: 1px solid rgba(255,255,255,0.1);
            display: flex;
            align-items: stretch;
            z-index: 999;
            padding-bottom: env(safe-area-inset-bottom, 0px);
        }
        @media (min-width: 1024px) { #bottomNav { display: none !important; } }

        .bn-item {
            flex: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            gap: 4px;
            text-decoration: none;
            color: rgba(255,255,255,0.28);
            font-size: 9.5px;
            font-weight: 700;
            letter-spacing: 0.3px;
            transition: color .2s ease;
            position: relative;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
            touch-action: manipulation;
        }
        .bn-item i {
            font-size: 19px;
            transition: transform .22s cubic-bezier(.175,.885,.32,1.275), color .2s;
        }
        .bn-item span {
            transition: opacity .2s;
        }
        .bn-item.active {
            color: var(--accent, #00eaff);
        }
        .bn-item.active i {
            transform: translateY(-2px) scale(1.15);
            filter: drop-shadow(0 0 6px rgba(0,234,255,0.5));
        }
        .bn-item:active i {
            transform: scale(0.82);
        }

        /* active indicator dot */
        .bn-item.active::before {
            content: '';
            position: absolute;
            bottom: 7px;
            left: 50%;
            transform: translateX(-50%);
            width: 4px; height: 4px;
            border-radius: 50%;
            background: var(--accent, #00eaff);
            box-shadow: 0 0 6px rgba(0,234,255,0.8);
            opacity: 0;
            pointer-events: none;
        }

        /* ── CENTER FAB ── */
        #bottomNav .bn-center-wrap {
            flex: 0 0 70px;
            display: flex;
            align-items: flex-start;
            justify-content: center;
            position: relative;
        }
        #bottomNav .bn-center-btn {
            position: absolute;
            top: -20px;
            width: 54px;
            height: 54px;
            border-radius: 18px;
            background: linear-gradient(145deg, #00eaff 0%, #007bb5 100%);
            border: none;
            box-shadow:
                0 6px 24px rgba(0,234,255,0.3),
                0 2px 8px rgba(0,0,0,0.6),
                inset 0 1px 0 rgba(255,255,255,0.25);
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: #fff;
            font-size: 19px;
            transition:
                transform .22s cubic-bezier(.175,.885,.32,1.275),
                box-shadow .2s ease,
                border-radius .25s ease;
            -webkit-tap-highlight-color: transparent;
            user-select: none;
            outline: none;
        }
        #bottomNav .bn-center-btn i {
            transition: transform .28s cubic-bezier(.175,.885,.32,1.275);
        }
        #bottomNav .bn-center-btn:active {
            transform: scale(0.9) translateY(1px);
            box-shadow: 0 3px 12px rgba(0,234,255,0.2), 0 1px 4px rgba(0,0,0,0.5);
        }
        #bottomNav .bn-center-btn.rotated {
            border-radius: 50%;
            background: linear-gradient(145deg, #1a1a2e 0%, #16213e 100%);
            box-shadow:
                0 6px 24px rgba(0,0,0,0.5),
                0 2px 8px rgba(0,0,0,0.6),
                inset 0 1px 0 rgba(255,255,255,0.08),
                0 0 0 2px rgba(0,234,255,0.3);
        }
        #bottomNav .bn-center-btn.rotated i {
            transform: rotate(90deg);
            color: var(--accent, #00eaff);
        }

        /* ── BADGE ── */
        .bn-badge {
            position: absolute;
            top: 6px;
            right: calc(50% - 14px);
            min-width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #ff3b30;
            border: 2px solid rgba(6,8,16,0.88);
            pointer-events: none;
            animation: bnBadgePop .3s cubic-bezier(.175,.885,.32,1.275);
        }
        .bn-badge.has-count {
            min-width: 16px; height: 16px;
            border-radius: 8px;
            top: 4px; right: calc(50% - 18px);
            font-size: 8.5px; font-weight: 800;
            color: #fff;
            display: flex; align-items: center; justify-content: center;
            padding: 0 3px;
        }
        @keyframes bnBadgePop {
            from { transform: scale(0); opacity: 0; }
            to   { transform: scale(1); opacity: 1; }
        }

        /* ── BODY OFFSET ── */
        @media (max-width: 1023px) {
            body { padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px)) !important; }
            .admin-fab-container  { bottom: calc(1.25rem + 60px + env(safe-area-inset-bottom, 0px)) !important; }
            .daily-fab-container  { bottom: calc(1rem + 60px + env(safe-area-inset-bottom, 0px)) !important; }
            #fabNewPost            { bottom: calc(24px + 60px + env(safe-area-inset-bottom, 0px)) !important; }
            #toast-container       { bottom: calc(1.5rem + 60px + env(safe-area-inset-bottom, 0px)) !important; }
        }
    `;
    document.head.appendChild(style);

    // ── STATE ─────────────────────────────────────────────────
    const classId = getClassId();
    const activeId = window.location.pathname.split('/').pop().replace('.html', '') || 'announcements';
    const VISIT_PREFIX = 'bn_visit_';
    const ONE_DAY = 24 * 60 * 60 * 1000;

    // ── BADGE HELPERS ─────────────────────────────────────────
    function markVisited(pageId) {
        localStorage.setItem(VISIT_PREFIX + pageId, Date.now().toString());
    }
    function shouldShowDot(pageId) {
        const last = parseInt(localStorage.getItem(VISIT_PREFIX + pageId) || '0');
        return (Date.now() - last) > ONE_DAY;
    }
    function getPendingTaskCount() {
        try {
            const uid = getUserId();
            if (!uid) return 0;
            const raw = sessionStorage.getItem(`task_badge_${uid}`);
            if (!raw) return 0;
            const { count, time } = JSON.parse(raw);
            if (Date.now() - time > 10 * 60 * 1000) return 0;
            return count || 0;
        } catch { return 0; }
    }
    function makeBadge(count = 0) {
        const b = document.createElement('span');
        if (count > 0) {
            b.className = 'bn-badge has-count';
            b.textContent = count > 99 ? '99+' : count;
        } else {
            b.className = 'bn-badge';
        }
        return b;
    }

    // ── RENDER ────────────────────────────────────────────────
    function buildNav(items) {
        const nav = document.createElement('nav');
        nav.id = 'bottomNav';
        nav.setAttribute('aria-label', t('main_navigation'));

        markVisited(activeId);

        // Split items: half before center, half after
        const half = Math.floor(items.length / 2);
        const leftItems = items.slice(0, half);
        const rightItems = items.slice(half);

        function itemHTML({ id, icon, label, href }) {
            const isActive = id === activeId || (activeId === '' && id === 'announcements');
            return `<a class="bn-item${isActive ? ' active' : ''}" href="${href}" aria-label="${label}" data-nav-id="${id}">
                <i class="${icon}"></i>
                <span>${label}</span>
            </a>`;
        }

        nav.innerHTML =
            leftItems.map(itemHTML).join('') +
            `<div class="bn-center-wrap">
                <button class="bn-center-btn" id="bnCenterBtn" aria-label="${t('sidebar_main')}" type="button">
                    <i class="fa-solid fa-bars"></i>
                </button>
            </div>` +
            rightItems.map(itemHTML).join('');

        // Center button → toggle sidebar
        const centerBtn = nav.querySelector('#bnCenterBtn');
        const centerIcon = centerBtn.querySelector('i');
        centerBtn.addEventListener('click', function () {
            const isOpen = this.classList.toggle('rotated');
            centerIcon.className = isOpen ? 'fa-solid fa-xmark' : 'fa-solid fa-bars';
            if (typeof toggleMenu === 'function') toggleMenu();
        });
        // Sync icon saat sidebar ditutup dari luar (overlay click dll)
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#sidebar') && !e.target.closest('#bnCenterBtn')) {
                centerBtn.classList.remove('rotated');
                centerIcon.className = 'fa-solid fa-bars';
            }
        });

        // Tap feedback pada bn-item
        nav.querySelectorAll('.bn-item').forEach(a => {
            a.addEventListener('click', function (e) {
                if (this.classList.contains('active')) { e.preventDefault(); return; }
                const icon = this.querySelector('i');
                icon.style.transform = 'scale(0.8)';
                setTimeout(() => { icon.style.transform = ''; }, 140);
            });
        });

        return nav;
    }

    function attachBadges(nav) {
        const pending = getPendingTaskCount();
        nav.querySelectorAll('.bn-item').forEach(a => {
            const id = a.dataset.navId;
            a.querySelector('.bn-badge')?.remove();
            if (id === 'tugas') {
                if (pending > 0) a.appendChild(makeBadge(pending));
            } else {
                if (id !== activeId && shouldShowDot(id)) a.appendChild(makeBadge(0));
            }
        });
    }

    function injectNav(items) {
        // Hapus nav lama kalau ada
        document.getElementById('bottomNav')?.remove();
        const nav = buildNav(items);
        document.body.appendChild(nav);
        attachBadges(nav);
    }

    // ── INIT (cache-first) ────────────────────────────────────
    function init() {
        let initItems;
        if (classId) {
            const cached = getCache(classId);
            initItems = cached ? rowsToItems(cached) : DEFAULT_ITEMS;
        } else {
            initItems = DEFAULT_ITEMS;
        }
        injectNav(initItems);
    }

    if (document.body) { init(); }
    else { document.addEventListener('DOMContentLoaded', init); }

    // ── POLL TUGAS BADGE ─────────────────────────────────────
    function pollTugasBadge() {
        const nav = document.getElementById('bottomNav');
        if (!nav) return;
        const tugasItem = nav.querySelector('[data-nav-id="tugas"]');
        if (!tugasItem || !getUserId()) return;
        let tries = 0;
        const poll = setInterval(() => {
            tries++;
            const count = getPendingTaskCount();
            if (count > 0 || tries > 20) {
                clearInterval(poll);
                tugasItem.querySelector('.bn-badge')?.remove();
                if (count > 0) tugasItem.appendChild(makeBadge(count));
            }
        }, 500);
    }
    document.addEventListener('DOMContentLoaded', pollTugasBadge);

    // ── PARASIT KE CACHE SIDEBAR — zero query tambahan ──────
    // Sidebar udah fetch SEMUA subjects_config per page load.
    // Bottom nav tinggal filter menu_group='bottomnav' dari cache itu.
    // Kalau sidebar cache belum ada, poll sampai ready (max ~6 detik).
    function syncFromSidebarCache() {
        if (!classId) return;

        const sidebarKey = `sidebar_cache_${classId}`;
        let tries = 0;
        const poll = setInterval(() => {
            tries++;
            const raw = localStorage.getItem(sidebarKey);
            if (raw) {
                clearInterval(poll);
                applyFromRaw(raw);
            }
            if (tries > 20) clearInterval(poll); // max ~6 detik, give up
        }, 300);

        // Juga listen storage event — kalau sidebar update cache di tab lain
        window.addEventListener('storage', (e) => {
            if (e.key === sidebarKey && e.newValue) applyFromRaw(e.newValue);
        });
    }

    // Parse raw sidebar cache, filter bottomnav, update nav kalau berubah
    function applyFromRaw(raw) {
        try {
            const parsed = JSON.parse(raw);

            // Support format baru { groups, items } maupun format lama (array langsung)
            const all = Array.isArray(parsed) ? parsed : (parsed?.items || []);
            if (!all.length) return;

            const bnRows = all
                .filter(r => r.menu_group === 'bottomnav')
                .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
            if (bnRows.length === 0) return;

            // Bandingkan sama cache bn sendiri biar ga re-render percuma
            const oldSig = (getCache(classId) || [])
                .map(x => `${x.id}-${x.display_order}-${x.subject_name}-${x.icon}`).sort().join(',');
            const newSig = bnRows
                .map(x => `${x.id}-${x.display_order}-${x.subject_name}-${x.icon}`).sort().join(',');

            if (newSig !== oldSig) {
                setCache(classId, bnRows);
                injectNav(rowsToItems(bnRows));
                pollTugasBadge();
            }
        } catch (e) {
            console.warn('[BottomNav] Parse sidebar cache error:', e);
        }
    }

    document.addEventListener('DOMContentLoaded', syncFromSidebarCache);

})();