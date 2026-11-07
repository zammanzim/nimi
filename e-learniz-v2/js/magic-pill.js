// studentsweb.js
// Taruh di halaman web siswa:
//   <script src="https://127.0.0.1:5500/js/studentsweb.js"
//           data-group="students_web"
//           data-class-id="2"
//           data-position="bottom-right"
//           data-offset-x="24"
//           data-offset-y="24"></script>

(() => {
    const HOME = 'https://e-learniz.my.id/'; // tombol kembali
    const BASE = 'https://e-learniz.my.id';                  // base untuk item URL
    const SB_URL = 'https://vttmwtlqzbbiaromohrp.supabase.co';
    const SB_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dG13dGxxemJiaWFyb21vaHJwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjUyNjg4NTMsImV4cCI6MjA4MDg0NDg1M30.16SwOEqD5ZNAgk1oWhLrL41Eqw4kkeAKTyHxkSqmpiY';

    const scriptEl = document.currentScript || documenjt.querySelector('script[src*="studentsweb"]');
    const GROUP_KEY = scriptEl?.dataset.group || 'Web Siswa';
    const CLASS_ID = scriptEl?.dataset.classId || '';
    const pos = scriptEl?.dataset.position || 'bottom-right';
    const offX = scriptEl?.dataset.offsetX || '24';
    const offY = scriptEl?.dataset.offsetY || '24';
    const isLeft = pos.includes('left');
    const isTop = pos.includes('top');

    // ── Helpers ────────────────────────────────────────────
    function getUser() {
        try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
    }
    function getToken() {
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const k = localStorage.key(i);
                if (k?.includes('auth-token') && k.includes('supabase')) {
                    const v = JSON.parse(localStorage.getItem(k) || '{}');
                    if (v?.access_token) return v.access_token;
                }
            }
        } catch { }
        return SB_ANON;
    }
    function getFolderKey() {
        const depth = parseInt(scriptEl?.dataset.folderDepth || '2');
        const parts = window.location.pathname.split('/').filter(Boolean);
        // Ambil N segmen pertama sesuai depth
        const folder = parts.slice(0, depth);
        return '/' + folder.join('/') + (folder.length ? '/' : '');
    }
    async function sb(path, opts = {}) {
        const r = await fetch(`${SB_URL}/rest/v1/${path}`, {
            ...opts,
            headers: {
                'apikey': SB_ANON,
                'Authorization': `Bearer ${getToken()}`,
                'Content-Type': 'application/json',
                'Prefer': opts.prefer || 'return=minimal',
                ...(opts.headers || {})
            }
        });
        const t = await r.text();
        return t ? JSON.parse(t) : null;
    }

    // ── Fetch students web items dari subjects_config ──────
    async function fetchStudents() {
        const user = getUser();
        const classId = CLASS_ID || user?.class_id || '';
        let query = `subjects_config?menu_group=eq.${GROUP_KEY}&order=display_order.asc&select=*`;
        if (classId) query += `&class_id=eq.${classId}`;
        return await sb(query, {
            prefer: 'return=representation',
            headers: { 'Accept': 'application/json' }
        }) || [];
    }

    // ── Visitor tracking ───────────────────────────────────
    async function recordVisit() {
        const user = getUser();
        if (!user?.id) return;

        const pageKey = getFolderKey();
        const throttleKey = `pv_${user.id}_${pageKey}`;
        const last = parseInt(localStorage.getItem(throttleKey) || '0');
        if (Date.now() - last < 5 * 60 * 1000) return; // throttle 5 menit

        try {
            await sb('page_visitors?on_conflict=user_id,page_key', {
                method: 'POST',
                prefer: 'resolution=merge-duplicates,return=minimal',
                body: JSON.stringify({
                    page_key: pageKey,
                    page_title: document.title || pageKey,
                    user_id: user.id,
                    visitor_name: user.nickname || user.full_name || user.name || 'User',
                    visitor_class: user.class_name || String(user.class_id || '-'),
                    avatar_url: user.avatar_url || null,
                    visited_at: new Date().toISOString(),
                })
            });
            localStorage.setItem(throttleKey, String(Date.now()));
        } catch (e) { }
    }
    async function fetchVisitors() {
        return await sb(
            `page_visitors?page_key=eq.${getFolderKey()}&order=visited_at.desc&limit=200`,
            { prefer: 'return=representation', headers: { 'Accept': 'application/json' } }
        ) || [];
    }
    function fmtTime(iso) {
        return new Date(iso).toLocaleString('id-ID', {
            day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });
    }

    // ── Inject Font Awesome kalau belum ada ───────────────
    function ensureFontAwesome() {
        if (document.querySelector('link[href*="font-awesome"], link[href*="fontawesome"]')) return;
        const fa = document.createElement('link');
        fa.rel = 'stylesheet';
        fa.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.0/css/all.min.css';
        document.head.appendChild(fa);
    }

    // ── CSS ────────────────────────────────────────────────
    const style = document.createElement('style');
    style.textContent = `
        @keyframes _swFadeIn  { from{opacity:0;transform:scale(.97) translateY(6px)} to{opacity:1;transform:scale(1) translateY(0)} }
        @keyframes _swFadeOut { from{opacity:1;transform:scale(1) translateY(0)} to{opacity:0;transform:scale(.97) translateY(6px)} }
        @keyframes _swSkeleton { 0%,100%{opacity:.3} 50%{opacity:.7} }
        ._sw_skel {
            height: 12px; border-radius: 6px;
            background: rgba(255,255,255,0.08);
            animation: _swSkeleton 1.2s ease infinite;
        }
        @keyframes _swOverlayIn  { from{opacity:0} to{opacity:1} }
        @keyframes _swOverlayOut { from{opacity:1} to{opacity:0} }

        #_sw_pill {
            position: fixed;
            ${isTop ? `top:${offY}px` : `bottom:${offY}px`};
            ${isLeft ? `left:${offX}px` : `right:${offX}px`};
            z-index: 9000;
            display: flex;
            align-items: center;
            gap: 0;
            background: rgba(10,15,25,0.98);
            border: 1px solid rgba(255,255,255,0.12);
            border-radius: 50px;
            box-shadow: 0 4px 24px rgba(0,0,0,0.6);
            overflow: hidden;
            transition: border-color .2s;
        }
        #_sw_pill:hover { border-color: rgba(0,234,255,0.25); }

        ._sw_pbtn {
            width: 44px; height: 40px;
            display: flex; align-items: center; justify-content: center;
            background: none; border: none; cursor: pointer;
            color: #666; transition: color .2s, background .2s;
            position: relative;
        }
        ._sw_pbtn:hover { color: #00eaff; background: rgba(0,234,255,0.07); }
        ._sw_pbtn svg { width: 16px; height: 16px; pointer-events: none; }

        ._sw_pdivider { width: 1px; height: 18px; background: rgba(255,255,255,0.07); }

        #_sw_badge {
            position: absolute; top: 5px; right: 4px;
            min-width: 14px; height: 14px; border-radius: 7px;
            background: #00eaff; color: #0a0a0c;
            font-size: 8px; font-weight: 800;
            display: none; align-items: center; justify-content: center;
            padding: 0 2px; border: 1.5px solid #0a0a0c;
        }

        /* ── Menu Popup ── */
        #_sw_mpopup_overlay {
            position: fixed; inset: 0; z-index: 9998;
            background: rgba(0,0,0,0.85);
        }
        #_sw_mpopup {
            position: fixed; z-index: 9999;
            ${isTop ? `top:calc(${offY}px + 52px)` : `bottom:calc(${offY}px + 52px)`};
            ${isLeft ? `left:${offX}px` : `right:${offX}px`};
            width: 220px;
            max-height: min(360px, 60vh);
            display: flex;
            flex-direction: column;
            background: rgba(10,15,25,0.96);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 8px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,234,255,0.06);
            animation: _swFadeIn .2s ease forwards;
        }
        #_sw_mpopup_items {
            overflow-y: auto;
            flex: 1;
            padding-bottom: 6px;
        }
        #_sw_mpopup_items::-webkit-scrollbar { width: 3px; }
        #_sw_mpopup_items::-webkit-scrollbar-track { background: transparent; }
        #_sw_mpopup_items::-webkit-scrollbar-thumb { background: rgba(0,234,255,0.2); border-radius: 3px; }

        /* Back button */
        #_sw_back_item {
            display: flex; align-items: center; gap: 10px;
            padding: 12px 14px;
            color: #00eaff; font-size: 13px; font-weight: 600;
            font-family: 'Segoe UI', sans-serif;
            text-decoration: none; cursor: pointer;
            border-bottom: 1px solid rgba(255,255,255,0.06);
            transition: background .15s;
        }
        #_sw_back_item:hover { background: rgba(0,234,255,0.08); }
        #_sw_back_item svg { width: 13px; height: 13px; flex-shrink: 0; }

        /* Section label */
        ._sw_section_label {
            padding: 8px 14px 4px;
            font-size: 9px; font-weight: 700;
            letter-spacing: 1.5px; text-transform: uppercase;
            color: #333; font-family: 'Segoe UI', sans-serif;
        }

        /* Nav items */
        ._sw_mitem {
            display: flex; align-items: center; gap: 10px;
            padding: 9px 14px;
            color: #ccc; font-size: 13px; font-weight: 500;
            font-family: 'Segoe UI', sans-serif;
            text-decoration: none;
            transition: all .15s;
            border-left: 2px solid transparent;
            cursor: pointer;
        }
        ._sw_mitem:hover:not(.locked) {
            color: #fff;
            background: rgba(255,255,255,0.04);
            border-left-color: rgba(0,234,255,0.4);
        }
        ._sw_mitem.active {
            color: #00eaff;
            background: linear-gradient(90deg, rgba(0,234,255,0.12), transparent);
            border-left-color: #00eaff;
            font-weight: 600;
            text-shadow: 0 0 10px rgba(0,234,255,0.5);
        }
        ._sw_mitem.locked {
            opacity: 0.35;
            cursor: default;
            pointer-events: none;
        }
        ._sw_mitem_icon {
            width: 26px; height: 26px; border-radius: 6px;
            background: rgba(255,255,255,0.05);
            display: flex; align-items: center; justify-content: center;
            font-size: 12px; flex-shrink: 0;
            color: #aaa;
        }
        ._sw_mitem.active ._sw_mitem_icon { color: #00eaff; }

        /* Visitor popup — centered overlay */
        #_sw_vpopup {
            position: fixed; inset: 0; z-index: 99999;
            background: rgba(0,0,0,0.85);
            display: flex; align-items: center; justify-content: center;
            padding: 16px; box-sizing: border-box;
            animation: _swFadeIn .2s ease forwards;
        }
        #_sw_vpopup.closing {
            animation: _swFadeOut .18s ease forwards;
        }

        @media (max-width: 480px) {
            #_sw_mpopup { width: 190px; }
            ._sw_pbtn { width: 38px; height: 36px; }
        }
    `;
    document.head.appendChild(style);

    // ── Menu Popup ─────────────────────────────────────────
    let menuOpen = false;

    function buildItemsHTML(items, curFolder) {
        return items.map(item => {
            const url = item.subject_id?.includes('://') || item.subject_id?.includes('?')
                ? item.subject_id
                : BASE + '/' + item.subject_id;
            let isActive = false;
            try {
                const u = new URL(url, window.location.href);
                const uF = u.pathname.split('/').filter(Boolean);
                const cF = curFolder.split('/').filter(Boolean);
                isActive = uF.length > 0 && cF.length > 0 && uF[uF.length-1] === cF[cF.length-1];
            } catch {}
            const locked = !!item.locked;
            let icon = item.icon || 'fa-globe';
            if (!icon.includes(' ')) icon = `fa-solid ${icon}`;
            return `<a href="${locked ? '#' : url}"
                class="_sw_mitem ${isActive ? 'active' : ''} ${locked ? 'locked' : ''}"
                ${locked ? 'onclick="event.preventDefault();"' : ''}>
                <div class="_sw_mitem_icon">
                    ${locked ? `<i class="fa-solid fa-lock" style="font-size:11px;"></i>` : `<i class="${icon}" style="font-size:12px;"></i>`}
                </div>
                ${item.subject_name}
            </a>`;
        }).join('');
    }

    function skeletonMenuItems(n = 5) {
        return Array.from({length: n}, (_, i) => `
            <div class="_sw_mitem" style="pointer-events:none;">
                <div class="_sw_mitem_icon" style="background:rgba(255,255,255,0.05);"></div>
                <div class="_sw_skel" style="width:${55 + (i*13)%35}%;"></div>
            </div>`).join('');
    }

    function toggleMenu() {
        if (menuOpen) return closeMenu();

        // Overlay
        const overlay = document.createElement('div');
        overlay.id = '_sw_mpopup_overlay';
        overlay.onclick = closeMenu;

        // Popup — tampil langsung dengan skeleton
        const popup = document.createElement('div');
        popup.id = '_sw_mpopup';
        popup.innerHTML = `
            <a id="_sw_back_item" href="${HOME}">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="15 18 9 12 15 6"/>
                </svg>
                kembali ke e-learniz
            </a>
            <div class="_sw_section_label">Web Siswa</div>
            <div id="_sw_mpopup_items">${skeletonMenuItems()}</div>`;

        document.body.appendChild(overlay);
        document.body.appendChild(popup);
        menuOpen = true;
        document.addEventListener('keydown', onEsc);

        // Fetch di background, update pas datang
        fetchStudents().then(items => {
            const el = document.getElementById('_sw_mpopup_items');
            if (!el) return;
            if (!items.length) {
                el.innerHTML = `<div style="padding:16px;text-align:center;color:#444;font-size:12px;">Tidak ada data</div>`;
                return;
            }
            el.innerHTML = buildItemsHTML(items, getFolderKey());
        }).catch(() => {
            const el = document.getElementById('_sw_mpopup_items');
            if (el) el.innerHTML = `<div style="padding:16px;text-align:center;color:#444;font-size:12px;">Gagal memuat</div>`;
        });
    }

    // ── Fade out helper ────────────────────────────────────
    function fadeOutRemove(el, duration = 180) {
        if (!el) return;
        el.style.animation = `_swFadeOut ${duration}ms ease forwards`;
        setTimeout(() => el.remove(), duration);
    }

    function closeMenu() {
        const overlay = document.getElementById('_sw_mpopup_overlay');
        const popup = document.getElementById('_sw_mpopup');
        fadeOutRemove(overlay, 150);
        fadeOutRemove(popup, 180);
        menuOpen = false;
        document.removeEventListener('keydown', onEsc);
    }

    function onEsc(e) { if (e.key === 'Escape') { closeMenu(); closeVisitor(); } }

    // ── Visitor Popup ──────────────────────────────────────
    function closeVisitor() {
        const el = document.getElementById('_sw_vpopup');
        if (!el) return;
        el.classList.add('closing');
        setTimeout(() => el.remove(), 180);
    }

    function skeletonVisitorRows(n = 4) {
        return Array.from({length: n}, () => `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:10px 10px;"><div class="_sw_skel" style="width:16px;height:10px;"></div></td>
                <td style="padding:10px 10px;">
                    <div style="display:flex;align-items:center;gap:8px;">
                        <div style="width:28px;height:28px;border-radius:50%;background:rgba(255,255,255,0.06);animation:_swSkeleton 1.2s ease infinite;flex-shrink:0;"></div>
                        <div class="_sw_skel" style="width:80px;"></div>
                    </div>
                </td>
                <td style="padding:10px 10px;"><div class="_sw_skel" style="width:50px;"></div></td>
                <td style="padding:10px 10px;"><div class="_sw_skel" style="width:70px;"></div></td>
            </tr>`).join('');
    }

    // Render visitor row HTML dari data
    function visitorRowsHTML(visitors) {
        if (!visitors.length)
            return `<tr><td colspan="4" style="padding:32px;text-align:center;color:#444;font-size:13px;">Belum ada yang berkunjung</td></tr>`;
        return visitors.map((v, i) => {
            const av = v.avatar_url
                ? `<img src="${v.avatar_url}" style="width:28px;height:28px;border-radius:50%;object-fit:cover;flex-shrink:0;">`
                : `<div style="width:28px;height:28px;border-radius:50%;background:rgba(0,234,255,0.1);
                    border:1px solid rgba(0,234,255,0.2);display:flex;align-items:center;justify-content:center;
                    font-size:11px;font-weight:700;color:#00eaff;flex-shrink:0;">
                    ${(v.visitor_name||'?')[0].toUpperCase()}</div>`;
            return `<tr style="border-bottom:1px solid rgba(255,255,255,0.04);">
                <td style="padding:8px 10px;color:#444;font-size:11px;">${i+1}</td>
                <td style="padding:8px 10px;"><div style="display:flex;align-items:center;gap:8px;">${av}
                    <span style="font-size:13px;font-weight:600;color:#ddd;">${v.visitor_name||'—'}</span></div></td>
                <td style="padding:8px 10px;font-size:12px;color:#777;">${v.visitor_class||'—'}</td>
                <td style="padding:8px 10px;font-size:11px;color:#555;white-space:nowrap;">${fmtTime(v.visited_at)}</td>
            </tr>`;
        }).join('');
    }

    // Update tbody + badge count setelah data datang
    function populateVisitorPopup(visitors) {
        const tbody = document.getElementById('_sw_vtbody');
        const badge = document.getElementById('_sw_vbadge');
        if (tbody) tbody.innerHTML = visitorRowsHTML(visitors);
        if (badge) badge.textContent = `${visitors ? visitors.length + "×" : "…"}`;
    }

    // Render popup langsung (visitors=null → skeleton)
    function showVisitorPopup(visitors) {
        closeVisitor();
        const pop = document.createElement('div');
        pop.id = '_sw_vpopup';
        pop.onclick = e => { if (e.target === pop) closeVisitor(); };
        const rows = visitors ? visitorRowsHTML(visitors) : skeletonVisitorRows();

        pop.innerHTML = `
            <div style="background:#0e0f16;border:1px solid rgba(0,234,255,0.15);border-radius:16px;
                width:100%;max-width:500px;max-height:82vh;display:flex;flex-direction:column;overflow:hidden;
                box-shadow:0 0 48px rgba(0,234,255,0.08),0 24px 64px rgba(0,0,0,0.7);">
                <div style="padding:16px 18px;border-bottom:1px solid rgba(255,255,255,0.06);
                    display:flex;align-items:center;gap:12px;flex-shrink:0;">
                    <div style="width:34px;height:34px;border-radius:9px;flex-shrink:0;
                        background:rgba(0,234,255,0.08);border:1px solid rgba(0,234,255,0.18);
                        display:flex;align-items:center;justify-content:center;color:#00eaff;">
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                            <circle cx="12" cy="12" r="3"/>
                        </svg>
                    </div>
                    <div style="flex:1;min-width:0;">
                        <div style="font-size:13px;font-weight:700;color:#fff;">Pengunjung</div>
                        <div style="font-size:11px;color:#444;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${document.title || window.location.pathname}</div>
                    </div>
                    <div style="font-size:12px;font-weight:700;color:#00eaff;flex-shrink:0;
                        background:rgba(0,234,255,0.08);padding:3px 12px;border-radius:20px;">
                        <span id="_sw_vbadge">${visitors ? visitors.length + "visitor" : "…"}</span>
                    </div>
                    <button id="_sw_vclose"
                        style="background:none;border:none;color:#444;cursor:pointer;font-size:18px;
                        padding:2px 6px;line-height:1;flex-shrink:0;transition:color .15s;"
                        onmouseover="this.style.color='#fff'" onmouseout="this.style.color='#444'">✕</button>
                </div>
                <div style="overflow-y:auto;flex:1;">
                    <table style="width:100%;border-collapse:collapse;">
                        <thead><tr style="position:sticky;top:0;background:#0e0f16;z-index:1;border-bottom:1px solid rgba(255,255,255,0.06);">
                            <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">#</th>
                            <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">Nama</th>
                            <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">Kelas</th>
                            <th style="padding:8px 10px;text-align:left;font-size:9px;font-weight:700;letter-spacing:1px;color:#333;text-transform:uppercase;">Waktu</th>
                        </tr></thead>
                        <tbody id="_sw_vtbody">${rows}</tbody>
                    </table>
                </div>
            </div>`;

        document.body.appendChild(pop);
        pop.querySelector('#_sw_vclose').onclick = closeVisitor;
    }


    // ── Build Pill ─────────────────────────────────────────
    const pill = document.createElement('div');
    pill.id = '_sw_pill';

    const menuBtn = document.createElement('button');
    menuBtn.className = '_sw_pbtn';
    menuBtn.title = 'Menu Web Siswa';
    menuBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
        stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="6"  x2="21" y2="6"/>
        <line x1="3" y1="12" x2="21" y2="12"/>
        <line x1="3" y1="18" x2="21" y2="18"/>
    </svg>`;
    menuBtn.onclick = toggleMenu;

    const pdiv = document.createElement('div');
    pdiv.className = '_sw_pdivider';

    const eyeBtn = document.createElement('button');
    eyeBtn.className = '_sw_pbtn';
    eyeBtn.title = 'Pengunjung';
    eyeBtn.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
        </svg>
        <span id="_sw_badge"></span>`;
    eyeBtn.onclick = () => {
        closeMenu();
        // Tampilkan popup skeleton langsung
        showVisitorPopup(null);
        // Fetch di background, update popup
        fetchVisitors().then(data => {
            sessionStorage.setItem(`_sw_vc_${getFolderKey()}`, String(data.length));
            populateVisitorPopup(data);
        }).catch(() => populateVisitorPopup([]));
    };

    pill.appendChild(menuBtn);
    pill.appendChild(pdiv);
    pill.appendChild(eyeBtn);

    // ── Mount ──────────────────────────────────────────────
    const mount = () => {
        if (document.getElementById('_sw_pill')) return;
        ensureFontAwesome();
        document.body.appendChild(pill);

        // Keyboard shortcuts
        document.addEventListener('keydown', e => {
            if (e.ctrlKey && e.key === 'q') {
                e.preventDefault();
                document.getElementById('_sw_vpopup') ? closeVisitor() : eyeBtn.click();
            }
            if (e.ctrlKey && e.key === '`') { e.preventDefault(); menuBtn.click(); }
        });

        recordVisit();

        // Badge: pakai cache kalau folder sama, fetch kalau beda
        const cacheKey = `_sw_vc_${getFolderKey()}`;
        const cached = sessionStorage.getItem(cacheKey);
        if (cached !== null) {
            const count = parseInt(cached);
            const el = document.getElementById('_sw_badge');
            if (el && count > 0) {
                el.textContent = count > 99 ? '99+' : count;
                el.style.display = 'flex';
            }
        } else {
            fetchVisitors().then(data => {
                const el = document.getElementById('_sw_badge');
                if (el && data.length) {
                    el.textContent = data.length > 99 ? '99+' : data.length;
                    el.style.display = 'flex';
                }
                sessionStorage.setItem(cacheKey, String(data.length));
            }).catch(() => { });
        }
    };

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
    else mount();
})();