// ============================================================
// SIDEBAR.JS — Standalone Sidebar Manager
// Fetch menu_groups + subjects_config, render berdasarkan
// tipe grup dan role user. Cache-first + realtime update.
// ============================================================

let _sidebarChannel = null;
let _sidebarState = { groups: [], items: [], user: null, classId: null };
let _sidebarDrag = null;
let _sidebarContextItem = null;
let _sidebarSavingOrder = false;

function sidebarCanManage(user) {
    return user && (user.role === 'super_admin' || user.role === 'class_admin');
}

function escapeSidebarHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;'
    }[ch]));
}

function toastSidebar(message, type = 'success') {
    if (typeof showToast === 'function') showToast(message, type);
}

function popupSidebar(message, type = 'error') {
    if (typeof showPopup === 'function') showPopup(message, type);
    else alert(message.replace(/<[^>]+>/g, ''));
}

// ── HELPERS ──────────────────────────────────────────────────
function getEffectiveClassId() {
    try {
        const user = JSON.parse(localStorage.getItem('user'));
        if (!user) return null;
        if (user.role === 'super_admin' || user.role === 'teacher') {
            const override = sessionStorage.getItem('class_override');
            if (override) return override;
        }
        return String(user.class_id);
    } catch(e) { return null; }
}

async function getAcademicYear(classId) {
    if (!classId) return '2025/2026';
    try {
        const { data } = await supabase.from('classes').select('academic_year').eq('id', classId).single();
        return data?.academic_year || '2025/2026';
    } catch (e) { return '2025/2026'; }
}

function getEffectiveClassName() {
    try {
        const override = sessionStorage.getItem('class_override_name');
        if (override) return override;
        const user = JSON.parse(localStorage.getItem('user'));
        return user?.class_name || `${t('class')} ${user?.class_id}` || '';
    } catch(e) { return ''; }
}

async function switchClass(classId, className) {
    const current = getEffectiveClassId();
    if (classId === current) return;
    
    sessionStorage.setItem('class_override', classId);
    sessionStorage.setItem('class_override_name', className);
    
    // Invalidate cache buat kelas lama DAN baru biar aman
    localStorage.removeItem(`sidebar_cache_${current}`);
    localStorage.removeItem(`sidebar_cache_${classId}`);
    
    window.location.reload();
}
window.switchClass = switchClass;

function toggleClassSwitcher() {
    const menu = document.getElementById('classSwitcher');
    if (!menu) return;
    const isOpen = menu.style.display === 'block';
    menu.style.display = isOpen ? 'none' : 'block';
    if (!isOpen) {
        setTimeout(() => {
            const handler = (e) => {
                if (!document.getElementById('classSwitcherWrapper')?.contains(e.target)) {
                    menu.style.display = 'none';
                    document.removeEventListener('click', handler);
                }
            };
            document.addEventListener('click', handler);
        }, 10);
    }
}
window.toggleClassSwitcher = toggleClassSwitcher;

function renderClassOptions(classes, current) {
    return classes.map(c => `
        <div onclick="switchClass('${c.id}','${c.name}')" style="
            padding:10px 14px; font-size:13px; cursor:pointer;
            color:${String(c.id)===current?'var(--accent,#00eaff)':'#ddd'};
            background:${String(c.id)===current?'rgba(0,234,255,0.08)':'transparent'};
            display:flex; align-items:center; gap:8px; transition:background 0.15s;"
            onmouseover="this.style.background='rgba(255,255,255,0.05)'"
            onmouseout="this.style.background='${String(c.id)===current?'rgba(0,234,255,0.08)':'transparent'}'">
            ${String(c.id)===current
                ? '<i class="fa-solid fa-check" style="font-size:10px;color:var(--accent,#00eaff);"></i>'
                : '<span style="width:12px;"></span>'}
            ${c.name}
        </div>`).join('');
}

async function renderClassSwitcher(retries = 0) {
    const user = JSON.parse(localStorage.getItem('user') || 'null');
    if (!user || (user.role !== 'super_admin' && user.role !== 'teacher')) return;

    const switcher = document.getElementById('classSwitcher');
    const wrapper  = document.getElementById('classSwitcherWrapper');
    const label    = document.getElementById('classSwitcherLabel');
    
    // Race condition fix: Tunggu ui-components inject HTML nya dulu
    if (!switcher || !wrapper) {
        if (retries < 10) {
            setTimeout(() => renderClassSwitcher(retries + 1), 100);
        }
        return;
    }

    try {
        // Cache-first: tampil dari cache dulu
        const cachedClasses = (() => { try { const r = localStorage.getItem('cached_classes'); return r ? JSON.parse(r) : null; } catch(e) { return null; } })();
        if (cachedClasses?.length) {
            const current = getEffectiveClassId();
            const cur = cachedClasses.find(c => String(c.id) === current);
            if (label) label.innerText = cur?.name || `${t('class')} ${current}`;
            switcher.innerHTML = renderClassOptions(cachedClasses, current);
            wrapper.style.display = 'flex';
        }

        // Fetch fresh di background
        const { data: classes } = await supabase.from('classes').select('id, name').eq('is_active', true).order('id');
        if (!classes?.length) return;

        localStorage.setItem('cached_classes', JSON.stringify(classes));

        const current = getEffectiveClassId();
        const cur = classes.find(c => String(c.id) === current);
        if (label) label.innerText = cur?.name || `${t('class')} ${current}`;
        switcher.innerHTML = renderClassOptions(classes, current);
        wrapper.style.display = 'flex';
    } catch (err) {
        console.warn('Render class switcher failed:', err);
    }
}
window.renderClassSwitcher = renderClassSwitcher;

// ── CACHE ─────────────────────────────────────────────────────
function getCacheKey(classId) { return `sidebar_cache_${classId}`; }

function readCache(classId) {
    try {
        const raw = localStorage.getItem(getCacheKey(classId));
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        // Cache format: { groups: [...], items: [...] }
        if (parsed?.groups && parsed?.items) return parsed;
        return null;
    } catch(e) {
        localStorage.removeItem(getCacheKey(classId));
        return null;
    }
}

function writeCache(classId, groups, items) {
    try {
        localStorage.setItem(getCacheKey(classId), JSON.stringify({ groups, items }));
    } catch(e) { /* storage penuh, skip */ }
}

function isCacheSame(classId, groups, items) {
    const old = readCache(classId);
    if (!old) return false;
    const sig = d => d.map(x => JSON.stringify(x, Object.keys(x).sort())).sort().join('|');
    return sig(old.groups) === sig(groups) && sig(old.items) === sig(items);
}

// ── FETCH ─────────────────────────────────────────────────────
async function fetchSidebarData(classId, retries = 0) {
    if (typeof supabase === 'undefined') {
        if (retries >= 5) { console.error('[Sidebar] Supabase tidak ready'); return null; }
        await new Promise(r => setTimeout(r, 300));
        return fetchSidebarData(classId, retries + 1);
    }
    try {
        const [{ data: groups, error: gErr }, { data: items, error: iErr }] = await Promise.all([
            supabase.from('menu_groups')
                .select('*')
                .or(`class_id.eq.${classId},class_id.eq.2`)
                .order('display_order', { ascending: true }),
            supabase.from('subjects_config')
                .select('*')
                .or(`class_id.eq.${classId},class_id.eq.2`)
                .order('display_order', { ascending: true })
        ]);
        if (iErr) throw iErr;

        // Deduplicate & Filter: Cuma 'system' yang dipaksa dari Kelas 2
        const resolvedGroups = [];
        const seenG = new Set();
        (groups || []).forEach(g => {
            const isSystem = g.group_type === 'system';
            const isFromMaster = String(g.class_id) === '2';
            const key = g.group_key;

            if (isSystem) {
                if (isFromMaster && !seenG.has(key)) {
                    resolvedGroups.push(g);
                    seenG.add(key);
                }
            } else {
                if (String(g.class_id) === String(classId) && !seenG.has(key)) {
                    resolvedGroups.push(g);
                    seenG.add(key);
                }
            }
        });

        const resolvedItems = [];
        const seenI = new Set();
        (items || []).forEach(item => {
            const isSystem = item.menu_group === 'system'; // Biasa group_key-nya sama dengan group_type
            const isFromMaster = String(item.class_id) === '2';
            const key = `${item.subject_id}_${item.menu_group}`;

            if (isSystem) {
                if (isFromMaster && !seenI.has(key)) {
                    resolvedItems.push(item);
                    seenI.add(key);
                }
            } else {
                if (String(item.class_id) === String(classId) && !seenI.has(key)) {
                    resolvedItems.push(item);
                    seenI.add(key);
                }
            }
        });

        // Fallback: kalau menu_groups belum diisi, generate otomatis dari subjects_config
        let finalGroups = resolvedGroups.length ? resolvedGroups : generateGroupsFromItems(resolvedItems, classId);

        return { groups: finalGroups, items: resolvedItems };
    } catch (err) {
        console.error('[Sidebar] Fetch error:', err);
        if (retries === 0) {
            await new Promise(r => setTimeout(r, 1000));
            return fetchSidebarData(classId, 1);
        }
        return null;
    }
}

// Fallback: generate menu_groups dari distinct menu_group di subjects_config
function generateGroupsFromItems(items, classId) {
    const TYPE_ORDER = { system: 0, admin: 1, main: 2, lessons: 3 };
    const TYPE_LABEL = { system: t('sidebar_system'), admin: t('sidebar_admin'), main: t('sidebar_main'), lessons: t('sidebar_lessons') };
    const seen = new Set();
    const groups = [];
    items.forEach(item => {
        if (!item.menu_group || item.menu_group === 'bottomnav' || seen.has(item.menu_group)) return;
        seen.add(item.menu_group);
        const type = TYPE_ORDER.hasOwnProperty(item.menu_group) ? item.menu_group : 'custom';
        groups.push({
            id: null,
            class_id: classId,
            group_key: item.menu_group,
            group_label: TYPE_LABEL[item.menu_group] || item.menu_group.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()),
            group_type: type,
            display_order: TYPE_ORDER[item.menu_group] ?? 99
        });
    });
    return groups.sort((a,b) => a.display_order - b.display_order);
}

// ── REALTIME ──────────────────────────────────────────────────
function setupSidebarRealtime(classId, user) {
    if (_sidebarChannel) return;

    const cacheKey = getCacheKey(classId);

    _sidebarChannel = supabase
        .channel(`sidebar_${classId}`)
        .on('postgres_changes', {
            event: '*', schema: 'public',
            table: 'subjects_config',
            filter: `class_id=eq.${classId}`
        }, () => refreshSidebar(classId, user))
        .on('postgres_changes', {
            event: '*', schema: 'public',
            table: 'menu_groups',
            filter: `class_id=eq.${classId}`
        }, () => refreshSidebar(classId, user))
        .subscribe();

    window.addEventListener('pagehide', () => {
        _sidebarChannel?.unsubscribe();
        _sidebarChannel = null;
    }, { once: true });
}

async function refreshSidebar(classId, user) {
    if (_sidebarSavingOrder || _sidebarDrag) return;
    console.log('[Sidebar] Perubahan terdeteksi, memperbarui...');
    const data = await fetchSidebarData(classId);
    if (!data) return;
    writeCache(classId, data.groups, data.items);
    processAndRenderSidebar(data.groups, data.items, user);
}

// ── ENTRY POINT ───────────────────────────────────────────────
async function renderSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    let user;
    try { user = JSON.parse(localStorage.getItem('user')); } catch(e) { user = null; }
    window._sidebarGuestMode = !user;
    if (!user) {
        user = { id: 'guest', role: '', class_id: 2 };
    }

    const classId = getEffectiveClassId() || String(user.class_id);
    const cached  = readCache(classId);

    if (cached) {
        // Render langsung dari cache (no blink)
        processAndRenderSidebar(cached.groups, cached.items, user);
        // Background refresh
        fetchSidebarData(classId).then(data => {
            if (!data) return;
            if (!isCacheSame(classId, data.groups, data.items)) {
                writeCache(classId, data.groups, data.items);
                processAndRenderSidebar(data.groups, data.items, user);
            }
        });
    } else {
        // Tidak ada cache → blocking fetch
        const data = await fetchSidebarData(classId);
        if (data) {
            writeCache(classId, data.groups, data.items);
            processAndRenderSidebar(data.groups, data.items, user);
        }
    }

    if (!window._sidebarGuestMode) {
        setupSidebarRealtime(classId, user);
    }
}

// ── RENDER ────────────────────────────────────────────────────
function processAndRenderSidebar(groups, items, user) {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const role = user.role;
    const canManageSidebar = sidebarCanManage(user);
    const classId = getEffectiveClassId() || String(user.class_id);
    const isInAdmin = window.location.pathname.includes('/admiii/');
    const isInA     = window.location.pathname.includes('/a/');
    const rootPrefix  = isInAdmin ? '../a/' : isInA ? '' : 'a/';
    const adminPrefix = isInAdmin ? '' : isInA ? '../admiii/' : 'admiii/';

    // ── Filter grup berdasarkan role ──
    const visibleGroups = groups.filter(g => {
        if (g.group_type === 'bottomnav' || g.group_key === 'bottomnav') return false;
        switch(g.group_type) {
            case 'system':  return role === 'super_admin';
            case 'admin':   return role === 'super_admin' || role === 'class_admin';
            case 'teacher': return role === 'super_admin' || role === 'class_admin' || role === 'teacher';
            default:        return true; // main, lessons, custom → semua user
        }
    });

    let html = '';

    visibleGroups.forEach(group => {
        const groupItems = items.filter(m => m.menu_group === group.group_key);
        if (!groupItems.length) return; // skip grup kosong

        // ── Warna header per tipe ──
        const COLOR = {
            system:  'var(--accent, #00eaff)',
            admin:   '#ffd700',
            teacher: '#0be881',
            main:    '',
            lessons: '',
            custom:  ''
        };
        const headerColor = COLOR[group.group_type] || '';
        const headerStyle = headerColor ? `style="color:${headerColor};"` : '';

        // Gunakan translasi buat label grup (fallback ke label asli DB)
        const translatedGroupLabel = t(`sidebar_${group.group_key}`) !== `sidebar_${group.group_key}` 
            ? t(`sidebar_${group.group_key}`) 
            : group.group_label;

        html += `<h3 ${headerStyle}>${escapeSidebarHtml(translatedGroupLabel)}</h3><ul data-sidebar-group="${escapeSidebarHtml(group.group_key)}">`;

        groupItems.forEach(item => {
            // ── Build URL berdasarkan tipe grup ──
            let url;
            switch(group.group_type) {
                case 'system':
                case 'admin':
                case 'teacher':
                    url = adminPrefix + item.subject_id;
                    break;
                case 'lessons':
                    url = `/a/?id=${item.subject_id}`;
                    break;
                case 'main':
                    url = rootPrefix + item.subject_id;
                    break;
                case 'custom':
                default:
                    if (item.subject_id?.includes('://') || item.subject_id?.includes('?')) {
                        url = item.subject_id;
                    } else if (item.subject_id?.startsWith('/')) {
                        url = item.subject_id;
                    } else {
                        url = '/' + item.subject_id;
                    }
            }

            // TRANSLASI NAMA MENU (Berdasarkan subject_id)
            const translatedName = t(item.subject_id) !== item.subject_id 
                ? t(item.subject_id) 
                : item.subject_name;

            // ── Icon ──
            let icon = item.icon || 'fa-book';
            if (!icon.includes(' ')) icon = `fa-solid ${icon}`;

            // ── Badge ──
            const badge = item.badge
                ? `<span class="sidebar-badge ${escapeSidebarHtml(item.badge_type || 'badge-new')}">${escapeSidebarHtml(item.badge)}</span>`
                : '';

            // ── Locked (guest mode atau admin lock) ──
            if (item.locked || window._sidebarGuestMode) {
                html += `
                <li class="sidebar-menu-item sidebar-locked${canManageSidebar ? ' sidebar-manageable' : ''}" data-menu-id="${item.id}" data-menu-group="${escapeSidebarHtml(item.menu_group)}" data-menu-class="${escapeSidebarHtml(item.class_id)}" data-menu-order="${item.display_order || 0}" ${canManageSidebar ? 'draggable="true"' : ''}>
                    <a href="#" onclick="event.preventDefault();" style="cursor:default;">
                        <i class="fa-solid fa-lock" style="font-size:11px;"></i>
                        <span style="text-decoration:line-through;">${escapeSidebarHtml(translatedName)}</span>
                    </a>
                    ${badge}
                </li>`;
                return;
            }

            html += `
            <li class="sidebar-menu-item${canManageSidebar ? ' sidebar-manageable' : ''}" data-menu-id="${item.id}" data-menu-group="${escapeSidebarHtml(item.menu_group)}" data-menu-class="${escapeSidebarHtml(item.class_id)}" data-menu-order="${item.display_order || 0}" ${canManageSidebar ? 'draggable="true"' : ''}>
                <a href="${url}">
                    <i class="${escapeSidebarHtml(icon)}"></i> <span>${escapeSidebarHtml(translatedName)}</span>
                </a>
                ${badge}
            </li>`;
        });

        html += '</ul>';
    });

    // Hapus active dulu biar comparison akurat (re-added via updateActiveSidebar)
    sidebar.querySelectorAll('.sidebar-menu-item.active').forEach(el => el.classList.remove('active'));

    // Skip DOM replacement kalo html sama (cegah blink)
    if (sidebar.innerHTML === html) {
        _sidebarState = { groups, items, user, classId };
        updateActiveSidebar();
        return;
    }

    sidebar.innerHTML = html;
    _sidebarState = { groups, items, user, classId };
    updateActiveSidebar();

    // Restore scroll position
    const savedScroll = sessionStorage.getItem('sidebar_scroll');
    if (savedScroll) sidebar.scrollTop = parseInt(savedScroll);

    if (!sidebar.dataset.scrollListener) {
        sidebar.dataset.scrollListener = '1';
        sidebar.addEventListener('scroll', () => {
            sessionStorage.setItem('sidebar_scroll', sidebar.scrollTop);
        }, { passive: true });
    }

    setupInlineSidebarManager(sidebar, user, classId);
}

// ── ACTIVE STATE ──────────────────────────────────────────────
function updateActiveSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;
    const currentPath = window.location.pathname.toLowerCase();
    const currentId = new URLSearchParams(window.location.search).get('id')?.toLowerCase();
    sidebar.querySelectorAll('.sidebar-menu-item.active').forEach(el => el.classList.remove('active'));
    sidebar.querySelectorAll('.sidebar-menu-item a').forEach(a => {
        const href = a.getAttribute('href');
        if (!href) return;
        const urlLow = href.toLowerCase();
        let isMatch = false;
        if (urlLow.includes('id=')) {
            if (currentId === urlLow.split('id=')[1]) isMatch = true;
        } else {
            const itemSeg = urlLow.split('/').pop();
            const pathSeg = currentPath.split('/').pop();
            if (pathSeg === itemSeg) {
                isMatch = itemSeg || !currentId;
            }
        }
        if (isMatch) a.closest('.sidebar-menu-item')?.classList.add('active');
    });
}

// ── AUTO INIT ─────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    renderSidebar();
    renderClassSwitcher();
});

function setupInlineSidebarManager(sidebar, user, classId) {
    if (!sidebarCanManage(user)) return;
    ensureSidebarContextMenu();

    if (sidebar.dataset.inlineManagerReady === '1') return;
    sidebar.dataset.inlineManagerReady = '1';

    sidebar.addEventListener('dragstart', handleSidebarDragStart);
    sidebar.addEventListener('dragover', handleSidebarDragOver);
    sidebar.addEventListener('drop', handleSidebarDrop);
    sidebar.addEventListener('dragend', handleSidebarDragEnd);

    document.addEventListener('click', hideSidebarContextMenu);
    window.addEventListener('resize', hideSidebarContextMenu);
    window.addEventListener('scroll', hideSidebarContextMenu, true);
}

function getSidebarItemById(id) {
    return _sidebarState.items.find(item => String(item.id) === String(id));
}

function getSidebarElementById(id) {
    return [...document.querySelectorAll('.sidebar-menu-item[data-menu-id]')]
        .find(el => String(el.dataset.menuId) === String(id));
}

function handleSidebarDragStart(e) {
    const li = e.target.closest('.sidebar-menu-item.sidebar-manageable');
    if (!li) return;

    _sidebarDrag = { id: li.dataset.menuId, group: li.dataset.menuGroup, moved: false };
    li.classList.add('sidebar-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', li.dataset.menuId);
}

function getSidebarListFromPoint(e) {
    const under = document.elementFromPoint(e.clientX, e.clientY);
    let list = under?.closest?.('.sidebar ul[data-sidebar-group]');
    if (list) return list;

    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return null;
    return [...sidebar.querySelectorAll('ul[data-sidebar-group]')].find(ul => {
        const rect = ul.getBoundingClientRect();
        return e.clientX >= rect.left && e.clientX <= rect.right &&
            e.clientY >= rect.top && e.clientY <= rect.bottom;
    }) || null;
}

function getSidebarInsertBefore(list, y) {
    const items = [...list.querySelectorAll('.sidebar-menu-item.sidebar-manageable:not(.sidebar-dragging)')];
    return items.find(item => y < item.getBoundingClientRect().top + item.getBoundingClientRect().height / 2) || null;
}

function handleSidebarDragOver(e) {
    if (!_sidebarDrag) return;

    const targetList = getSidebarListFromPoint(e);
    if (!targetList) return;

    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const dragged = getSidebarElementById(_sidebarDrag.id);
    if (!dragged) return;

    _sidebarDrag.moved = true;
    hideSidebarContextMenu();
    document.querySelectorAll('.sidebar-drop-zone').forEach(el => {
        if (el !== targetList) el.classList.remove('sidebar-drop-zone');
    });
    targetList.classList.add('sidebar-drop-zone');

    const before = getSidebarInsertBefore(targetList, e.clientY);
    if (before === dragged) return;
    targetList.insertBefore(dragged, before);
    dragged.dataset.menuGroup = targetList.dataset.sidebarGroup;
}

async function handleSidebarDrop(e) {
    if (!_sidebarDrag) return;
    e.preventDefault();
    document.querySelectorAll('.sidebar-drop-zone').forEach(el => el.classList.remove('sidebar-drop-zone'));
    if (_sidebarDrag.moved) await saveSidebarInlineOrder();
}

function handleSidebarDragEnd() {
    document.querySelectorAll('.sidebar-dragging').forEach(el => el.classList.remove('sidebar-dragging'));
    document.querySelectorAll('.sidebar-drop-zone').forEach(el => el.classList.remove('sidebar-drop-zone'));
    _sidebarDrag = null;
}

async function saveSidebarInlineOrder() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar || !_sidebarState.user) return;

    const updates = [];
    sidebar.querySelectorAll('ul[data-sidebar-group]').forEach(ul => {
        const group = ul.dataset.sidebarGroup;
        [...ul.querySelectorAll('.sidebar-menu-item[data-menu-id]')].forEach((li, index) => {
            const item = getSidebarItemById(li.dataset.menuId);
            if (!item) return;
            const displayOrder = index + 1;
            if (item.menu_group !== group || Number(item.display_order) !== displayOrder) {
                updates.push({ id: item.id, menu_group: group, display_order: displayOrder });
            }
            li.dataset.menuGroup = group;
            li.dataset.menuOrder = displayOrder;
        });
    });

    if (!updates.length) return;

    let failed = null;
    _sidebarSavingOrder = true;
    try {
        for (const update of updates) {
            const { error } = await supabase
                .from('subjects_config')
                .update({ menu_group: update.menu_group, display_order: update.display_order })
                .eq('id', update.id);
            if (error) { failed = error; break; }
        }
    } finally {
        _sidebarSavingOrder = false;
    }

    if (failed) {
        popupSidebar('Gagal simpan urutan sidebar: ' + failed.message, 'error');
        refreshSidebar(_sidebarState.classId, _sidebarState.user);
        return;
    }

    updates.forEach(update => {
        const item = getSidebarItemById(update.id);
        if (item) {
            item.menu_group = update.menu_group;
            item.display_order = update.display_order;
        }
    });
    localStorage.removeItem(getCacheKey(_sidebarState.classId));
    toastSidebar('Urutan sidebar disimpan', 'success');
}

function ensureSidebarContextMenu() {
    if (typeof ContextMenu === 'undefined') return;
    ContextMenu.init();
    ContextMenu.registerProvider('sidebar', (e) => provideSidebarContextMenu(e), 50);

    if (window._sidebarContextActionsReady) return;
    window._sidebarContextActionsReady = true;
    document.addEventListener('click', async (e) => {
        const actionEl = e.target.closest('[data-sidebar-action]');
        if (!actionEl) return;
        
        const action = actionEl.dataset.sidebarAction;
        const item = _sidebarContextItem;
        hideSidebarContextMenu();

        if (action === 'add-new') await addSidebarItem(item);
        if (item) {
            if (action === 'rename') await renameSidebarItem(item);
            if (action === 'toggle-lock') await toggleSidebarItemLock(item);
            if (action === 'delete') await deleteSidebarItem(item);
        }
    });
}

function provideSidebarContextMenu(e) {
    if (!sidebarCanManage(_sidebarState.user)) return null;
    
    const sidebar = e.target.closest('#sidebar');
    if (!sidebar) return null;

    const li = e.target.closest('.sidebar-menu-item.sidebar-manageable');
    
    if (li) {
        const item = getSidebarItemById(li.dataset.menuId);
        if (!item) return null;
        _sidebarContextItem = item;

        const lockIcon = item.locked ? 'fa-lock-open' : 'fa-lock';
        const lockText = item.locked ? 'Buka kunci' : 'Kunci';
        return {
            html: `
                <ul>
                    <li data-sidebar-action="add-new"><i class="fa-solid fa-plus"></i><span>${t('add_menu')}</span></li>
                    <div class="divider"></div>
                    <li data-sidebar-action="rename"><i class="fa-solid fa-pen"></i><span>${t('edit_menu')}</span></li>
                    <li data-sidebar-action="toggle-lock"><i class="fa-solid ${lockIcon}"></i><span>${lockText}</span></li>
                    <div class="divider"></div>
                    <li data-sidebar-action="delete" class="danger"><i class="fa-solid fa-trash"></i><span>${t('delete')}</span></li>
                </ul>
            `
        };
    } else {
        // Klik di area kosong sidebar
        _sidebarContextItem = null;
        return {
            html: `
                <ul>
                    <li data-sidebar-action="add-new"><i class="fa-solid fa-plus"></i><span>${t('add_menu')}</span></li>
                </ul>
            `
        };
    }
}

function hideSidebarContextMenu() {
    if (typeof ContextMenu !== 'undefined') ContextMenu.hide();
}

async function renameSidebarItem(item) {
    const nextName = await showPopup('Ganti nama menu', 'form', {
        value: item.subject_name || '',
        placeholder: 'Nama menu...'
    });
    if (nextName === null) return;
    const subjectName = nextName.trim();
    if (!subjectName) {
        popupSidebar('Nama menu tidak boleh kosong', 'error');
        return;
    }

    const { error } = await supabase
        .from('subjects_config')
        .update({ subject_name: subjectName })
        .eq('id', item.id);

    if (error) {
        popupSidebar('Gagal edit nama: ' + error.message, 'error');
        return;
    }

    item.subject_name = subjectName;
    localStorage.removeItem(getCacheKey(_sidebarState.classId));
    refreshSidebar(_sidebarState.classId, _sidebarState.user);
    toastSidebar('Nama menu diupdate', 'success');
}

async function toggleSidebarItemLock(item) {
    const locked = !item.locked;
    const { error } = await supabase
        .from('subjects_config')
        .update({ locked })
        .eq('id', item.id);

    if (error) {
        popupSidebar('Gagal update kunci: ' + error.message, 'error');
        return;
    }

    item.locked = locked;
    localStorage.removeItem(getCacheKey(_sidebarState.classId));
    refreshSidebar(_sidebarState.classId, _sidebarState.user);
    toastSidebar(locked ? 'Menu dikunci' : 'Kunci menu dibuka', 'success');
}

async function deleteSidebarItem(item) {
    const ok = typeof showPopup === 'function'
        ? await showPopup(`Hapus <b>${escapeSidebarHtml(item.subject_name)}</b>?<br>`, 'confirm')
        : confirm(`Hapus ${item.subject_name}?`);
    if (!ok) return;

    const { error } = await supabase
        .from('subjects_config')
        .delete()
        .eq('id', item.id);

    if (error) {
        popupSidebar('Gagal hapus menu: ' + error.message, 'error');
        return;
    }

    localStorage.removeItem(getCacheKey(_sidebarState.classId));
    refreshSidebar(_sidebarState.classId, _sidebarState.user);
    toastSidebar(t('menu_deleted'), 'success');
}

async function addSidebarItem(relativeToItem) {
    const classId = _sidebarState.classId;
    const groups = _sidebarState.groups;
    if (!groups.length) return;

    // Filter grup yang bisa diisi (kecuali bottomnav yang biasanya otomatis)
    const validGroups = groups.filter(g => g.group_key !== 'bottomnav');
    const groupOptions = validGroups.map(g => ({ label: g.group_label, value: g.group_key }));
    
    const defaultGroup = relativeToItem ? relativeToItem.menu_group : (validGroups[0]?.group_key || 'main');

    const data = await showPopup(t('add_menu'), 'form', {
        title: 'Detail Menu Baru',
        fields: [
            { name: 'name', label: t('menu_name'), type: 'text', placeholder: 'Contoh: Matematika' },
            { name: 'subject_id', label: 'URL / Path', type: 'text', placeholder: 'Contoh: math' },
            { name: 'icon', label: 'Icon (FontAwesome)', type: 'text', placeholder: 'fa-book', value: 'fa-book' },
            { name: 'group', label: t('menu_group'), type: 'select', options: groupOptions, value: defaultGroup }
        ]
    });

    if (!data) return;

    const { name, subject_id, icon, group } = data;
    if (!name?.trim() || !subject_id?.trim()) {
        popupSidebar('Nama dan URL wajib diisi', 'error');
        return;
    }

    // Ambil order terakhir di grup tersebut
    const { data: orderData } = await supabase
        .from('subjects_config')
        .select('display_order')
        .eq('class_id', classId)
        .eq('menu_group', group)
        .order('display_order', { ascending: false })
        .limit(1);

    const displayOrder = (orderData && orderData.length > 0) ? orderData[0].display_order + 1 : 1;

    const payload = {
        class_id: classId,
        subject_name: name.trim(),
        subject_id: subject_id.trim(),
        icon: icon.trim() || 'fa-book',
        menu_group: group,
        display_order: displayOrder,
        locked: false
    };

    const { error } = await supabase.from('subjects_config').insert([payload]);

    if (error) {
        popupSidebar('Gagal tambah menu: ' + error.message, 'error');
        return;
    }

    localStorage.removeItem(getCacheKey(classId));
    refreshSidebar(classId, _sidebarState.user);
    toastSidebar('Menu baru ditambahkan', 'success');
}
