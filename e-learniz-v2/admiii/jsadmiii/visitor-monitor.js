// admiii/jsadmiii/visitor-monitor.js

let currentClassFilter = 'global';
let filterDebounceTimer;

// Presence States
let _onlineUserCache = new Map();
let _graceTimers = new Map();

// Daftarkan handler kehadiran SEBELUM visitor.js melakukan subscribe
window._initPresenceHandlers = (channel) => {
    console.log("[VisitorMonitor] Registering Presence Handlers");
    channel
        .on('presence', { event: 'sync' }, () => {
            const state = channel.presenceState();
            renderOnlineUsers(state);
        });
};

document.addEventListener("DOMContentLoaded", async () => {
    console.log("[VisitorMonitor] DOM Content Loaded. Waiting for Supabase...");
    // Tunggu sampai Supabase Client bener-bener siap (punya fungsi .from)
    const checkSupabase = setInterval(() => {
        if (window.supabase && typeof window.supabase.from === 'function') {
            clearInterval(checkSupabase);
            console.log("[VisitorMonitor] Supabase Client Ready.");
            init();
        }
    }, 100);
});

async function init() {
    const user = JSON.parse(localStorage.getItem("user"));
    if (!user || (user.role !== 'super_admin' && user.role !== 'class_admin')) {
        console.warn("[VisitorMonitor] Unauthorized or not logged in.");
        window.location.href = "../login";
        return;
    }

    // Default Filter Date = Hari Ini
    const filterDate = document.getElementById('filterDate');
    if (filterDate) filterDate.valueAsDate = new Date();

    console.log("[VisitorMonitor] Initializing Switcher...");
    await initClassSwitcher(); 
    
    console.log("[VisitorMonitor] Loading Data...");
    loadAllData();
    initRealtimeLogs();
}

async function initClassSwitcher() {
    const container = document.getElementById('classSwitcher');
    if (!container) { console.error("classSwitcher container NOT FOUND"); return; }
    
    try {
        console.log("[VisitorMonitor] Fetching classes...");
        const { data: classes, error } = await supabase
            .from('classes')
            .select('id, name')
            .order('id', { ascending: true });

        if (error) throw error;

        console.log("[VisitorMonitor] Classes fetched:", classes.length);
        let html = `<button class="class-btn active" data-id="global" onclick="switchClass('global')">${t('global_label')}</button>`;
        classes.forEach(cls => {
            html += `<button class="class-btn" data-id="${cls.id}" onclick="switchClass(${cls.id})">${cls.name}</button>`;
        });
        container.innerHTML = html;
        console.log("[VisitorMonitor] Switcher Rendered");
    } catch (e) {
        console.error("[VisitorMonitor] Error loading classes:", e);
        container.innerHTML = `<div style="color:#ff4757; font-size:12px; padding:10px;">${t('failed_load_data')}</div>`;
    }
}

async function loadAllData() {
    console.log("[VisitorMonitor] loadAllData triggered. Class:", currentClassFilter);
    // Tampilkan loading di tiap box
    const boxes = ['onlineUserList', 'lastVisitorList', 'activityList'];
    boxes.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.innerHTML = '<div style="padding:20px; text-align:center; color:#555;"><i class="fa-solid fa-circle-notch fa-spin"></i></div>';
    });

    console.log("[VisitorMonitor] Starting parallel fetch...");
    try {
        await Promise.all([
            initActivityLogs(),
            initLastVisitors()
        ]);
        console.log("[VisitorMonitor] Parallel fetch complete.");
    } catch (e) {
        console.error("[VisitorMonitor] loadAllData CRASH:", e);
    }
}

function initRealtimeLogs() {
    supabase.channel('public:activity_logs_realtime')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_logs' }, async (payload) => {
            // Hanya prepend jika sesuai filter kelas saat ini
            if (currentClassFilter !== 'global' && payload.new.class_id != currentClassFilter) return;
            
            // Cek filter user (jika ada)
            const filterUserName = document.getElementById('filterUser').value.toLowerCase();
            
            const { data: userData } = await supabase.from('users').select('nickname, avatar_url, role').eq('id', payload.new.user_id).single();
            
            if (filterUserName && !userData.nickname.toLowerCase().includes(filterUserName)) return;

            prependActivityLog({ ...payload.new, users: userData });
        })
        .subscribe();
}

// ── CLASS SWITCHER ───────────────────────────────────────────
function switchClass(classId) {
    console.log("[VisitorMonitor] Switching to class:", classId);
    currentClassFilter = classId;
    
    // Update UI Active Class pake data-id biar akurat
    document.querySelectorAll('.class-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.id == classId);
    });

    // Refresh Data
    loadAllData();
}

// ── ONLINE USERS (Presence) ──────────────────────────────────
function renderOnlineUsers(state) {
    const list = document.getElementById('onlineUserList');
    const countLabel = document.getElementById('onlineCount');
    if (!list || !countLabel) return;
    
    const currentOnlineFromState = new Map();
    for (const key in state) {
        const userData = state[key][0];
        if (userData && userData.id) {
            // Filter by Class
            if (currentClassFilter !== 'global' && userData.class_id != currentClassFilter) continue;
            currentOnlineFromState.set(userData.id, userData);
        }
    }

    currentOnlineFromState.forEach((userData, id) => {
        if (_graceTimers.has(id)) {
            clearTimeout(_graceTimers.get(id));
            _graceTimers.delete(id);
        }
        _onlineUserCache.set(id, userData);
    });

    _onlineUserCache.forEach((userData, id) => {
        if (!currentOnlineFromState.has(id)) {
            if (!_graceTimers.has(id)) {
                const timer = setTimeout(() => {
                    _onlineUserCache.delete(id);
                    _graceTimers.delete(id);
                    actualRenderPresence(list, countLabel);
                }, 5000);
                _graceTimers.set(id, timer);
            }
        }
    });

    actualRenderPresence(list, countLabel);
}

function actualRenderPresence(list, countLabel) {
    const displayUsers = Array.from(_onlineUserCache.values())
        .filter(u => currentClassFilter === 'global' || u.class_id == currentClassFilter);

    displayUsers.sort((a, b) => {
        if (a.role === 'super_admin' && b.role !== 'super_admin') return -1;
        return (a.nickname || '').localeCompare(b.nickname || '');
    });

    countLabel.innerText = t('online_count', { n: displayUsers.length });
    if (displayUsers.length === 0) {
        list.innerHTML = `<div style="padding:20px; text-align:center; color:#555;">${t('no_one_online')}</div>`;
        return;
    }

    list.innerHTML = displayUsers.map(u => `
        <li class="item-card" style="opacity: ${_graceTimers.has(u.id) ? '0.5' : '1'};">
            <img src="${u.avatar_url || '../icons/profpicture.png'}" class="avatar">
            <div class="info">
                <div class="name">${u.nickname || t('unknown')}</div>
                <div class="meta">
                    <span class="badge role-${u.role}">${(u.role || '').replace('_',' ')}</span>
                    <span class="class-tag">${t('class')} ${u.class_id || '?'}</span>
                </div>
            </div>
            <div class="time" style="color:${_graceTimers.has(u.id) ? '#888' : '#2ed573'};">
                ${_graceTimers.has(u.id) ? t('leaving') : t('active')}
            </div>
        </li>
    `).join('');
}

// ── LAST VISITORS (Daily) ─────────────────────────────────────
async function initLastVisitors() {
    console.log("[VisitorMonitor] initLastVisitors start");
    const list = document.getElementById('lastVisitorList');
    const countLabel = document.getElementById('visitorCount');
    if (!list) { console.warn("lastVisitorList NOT FOUND"); return; }

    try {
        let query = supabase
            .from('visitors')
            .select('*, users(nickname, avatar_url, role)')
            .eq('is_visible', true)
            .order('visited_at', { ascending: false })
            .limit(30);

        if (currentClassFilter !== 'global') {
            query = query.eq('class_id', currentClassFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        console.log("[VisitorMonitor] Last visitors fetched:", data?.length);
        if (countLabel) countLabel.innerText = t('visitors_today', { n: data.length });
        if (data.length === 0) {
            list.innerHTML = `<div style="padding:20px; text-align:center; color:#555;">${t('no_visitors')}</div>`;
            return;
        }

        list.innerHTML = data.map(v => {
            const u = v.users || {};
            const time = new Date(v.visited_at).toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit' });
            return `
            <li class="item-card">
                <img src="${u.avatar_url || '../icons/profpicture.png'}" class="avatar">
                <div class="info">
                    <div class="name">${u.nickname || t('guest')}</div>
                    <div class="meta">
                        <span class="accent-text">${v.last_page || t('browsing')}</span>
                        <span class="class-tag">${t('class')} ${v.class_id}</span>
                    </div>
                </div>
                <div class="time">${time}</div>
            </li>`;
        }).join('');
        console.log("[VisitorMonitor] initLastVisitors RENDERED");
    } catch (e) {
        console.error("[VisitorMonitor] initLastVisitors ERROR:", e);
        list.innerHTML = '<div style="color:red; padding:10px;">Error loading visitors.</div>';
    }
}

// ── ACTIVITY LOGS with FILTERS ────────────────────────────────
async function initActivityLogs() {
    console.log("[VisitorMonitor] initActivityLogs start");
    const list = document.getElementById('activityList');
    const countLabel = document.getElementById('activityCount');
    if (!list) { console.warn("activityList NOT FOUND"); return; }
    
    try {
        const userSearch = document.getElementById('filterUser')?.value.toLowerCase() || '';
        const dateVal = document.getElementById('filterDate')?.value || '';
        const limitVal = parseInt(document.getElementById('filterLimit')?.value || '50');

        let query = supabase.from('activity_logs').select('*');

        if (currentClassFilter !== 'global') query = query.eq('class_id', currentClassFilter);
        if (dateVal) {
            query = query.gte('created_at', `${dateVal}T00:00:00`).lte('created_at', `${dateVal}T23:59:59`);
        }

        const { data: logs, error } = await query.order('created_at', { ascending: false }).limit(limitVal);
        if (error) throw error;

        console.log("[VisitorMonitor] Logs fetched:", logs?.length);
        const userIds = [...new Set(logs.map(l => l.user_id))];
        const { data: userData } = await supabase.from('users').select('id, nickname, avatar_url, role').in('id', userIds);
        const userMap = Object.fromEntries((userData || []).map(u => [u.id, u]));

        let enrichedLogs = logs.map(l => ({ ...l, users: userMap[l.user_id] }));

        if (userSearch) {
            enrichedLogs = enrichedLogs.filter(l => l.users?.nickname?.toLowerCase().includes(userSearch));
        }

        if (countLabel) countLabel.innerText = t('logs_found', { n: enrichedLogs.length });
        if (enrichedLogs.length === 0) {
            list.innerHTML = `<div style="padding:40px; text-align:center; color:#555;">${t('no_logs_match_filter')}</div>`;
            return;
        }

        list.innerHTML = enrichedLogs.map(log => createActivityItemHTML(log)).join('');
        console.log("[VisitorMonitor] initActivityLogs RENDERED");
    } catch (e) {
        console.error("[VisitorMonitor] initActivityLogs ERROR:", e);
        list.innerHTML = '<div style="color:red; padding:10px;">Error loading logs.</div>';
    }
}

function createActivityItemHTML(log) {
    const u = log.users || { nickname: t('unknown'), avatar_url: '../icons/profpicture.png', role: 'guest' };
    const time = new Date(log.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    return `
        <li class="item-card">
            <img src="${u.avatar_url || '../icons/profpicture.png'}" class="avatar">
            <div class="info">
                <div class="name">${u.nickname} <span style="font-weight:400; font-size:12px; color:#888;">${log.action_text}</span></div>
                <div class="meta">
                    <span class="class-tag">${t('class')} ${log.class_id}</span>
                    <span class="accent-text">@ ${log.page_name}</span>
                </div>
            </div>
            <div class="time">${time}</div>
        </li>`;
}

function prependActivityLog(log) {
    const list = document.getElementById('activityList');
    if (!list) return;
    if (list.innerHTML.includes(t('no_logs_match_filter'))) list.innerHTML = '';
    list.insertAdjacentHTML('afterbegin', createActivityItemHTML(log));
    const limitInput = document.getElementById('filterLimit');
    const limit = limitInput ? parseInt(limitInput.value) : 50;
    if (list.children.length > limit) list.removeChild(list.lastElementChild);
}

// ── HELPER FILTERS ────────────────────────────────────────────
function debounceFilter() {
    clearTimeout(filterDebounceTimer);
    filterDebounceTimer = setTimeout(() => applyFilters(), 500);
}

function applyFilters() {
    initActivityLogs();
}

function resetFilters() {
    const fUser = document.getElementById('filterUser');
    const fDate = document.getElementById('filterDate');
    const fLimit = document.getElementById('filterLimit');
    
    if (fUser) fUser.value = '';
    if (fDate) fDate.valueAsDate = new Date();
    if (fLimit) fLimit.value = '50';
    applyFilters();
}
