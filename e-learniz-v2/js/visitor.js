// ==========================================
// VISITOR SYSTEM — LIGHTWEIGHT
// ==========================================

const _getVisitorUser = () => {
    try {
        const data = localStorage.getItem("user");
        return data ? JSON.parse(data) : null;
    } catch (e) { return null; }
};

// ==========================================
// 1. LOG KUNJUNGAN — 1 query, debounce 2 menit
// ==========================================
let _globalPresenceChannel = null;
window._onlineUsers = new Set();

function _getDeviceInfo() {
    const ua = navigator.userAgent;
    let device_type = 'desktop';
    if (/tablet|ipad|playbook|silk|android(?!.*mobile)/i.test(ua)) device_type = 'tablet';
    else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile|wpdesktop/i.test(ua)) device_type = 'mobile';

    return {
        user_agent: ua.slice(0, 500),
        device_type,
        platform: navigator.platform || '',
        screen_resolution: `${screen.width}x${screen.height}`,
        browser_language: navigator.language || ''
    };
}

async function logVisitor() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    // --- REALTIME PRESENCE (Siapa yang Online) ---
    if (!_globalPresenceChannel) {
        _globalPresenceChannel = supabase.channel('online-users', {
            config: { presence: { key: user.id } }
        });

        _globalPresenceChannel
            .on('presence', { event: 'sync' }, () => {
                const state = _globalPresenceChannel.presenceState();
                window._onlineUsers = new Set();
                Object.values(state).forEach(users => {
                    users.forEach(u => {
                        if (u.id) window._onlineUsers.add(String(u.id));
                    });
                });
            })
            .on('presence', { event: 'join' }, ({ key, newPresences }) => {
                newPresences.forEach(u => { if (u.id) window._onlineUsers.add(String(u.id)); });
            })
            .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
                leftPresences.forEach(u => { if (u.id) window._onlineUsers.delete(String(u.id)); });
            });

        // Cek apakah ada script monitor (admin) yang mau nambahin callback
        if (typeof window._initPresenceHandlers === 'function') {
            window._initPresenceHandlers(_globalPresenceChannel);
        }

        _globalPresenceChannel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await _globalPresenceChannel.track({
                    id: user.id,
                    nickname: user.nickname || user.full_name,
                    role: user.role,
                    class_id: user.class_id,
                    avatar_url: user.avatar_url,
                    online_at: new Date().toISOString()
                });
            }
        });
    }

    const currentPage = (document.title || "Unknown Page")
        .replace(/\s*[•|·|-]\s*(E-Learning Nizam|Web Nizam).*/i, '')
        .trim() || "Unknown Page";

    // FILTER: Jangan catat judul sampah atau placeholder saat loading
    const ignoredTitles = [
        "loading", 
        "e-learning nizam", 
        "web nizam", 
        "e-learning nizam | web nizam",
        "unknown page"
    ];
    if (ignoredTitles.includes(currentPage.toLowerCase()) || !currentPage) return;

    // Ambil halaman sebelumnya dari sessionStorage
    const previousPage = sessionStorage.getItem('current_page_name') || 'Luar Web';
    sessionStorage.setItem('current_page_name', currentPage);

    // Debounce: skip kalau halaman & user sama dalam 2 menit terakhir
    const debounceKey = `visitor_log_${user.id}`;
    const last = JSON.parse(localStorage.getItem(debounceKey) || '{}');
    const now = Date.now();
    if (last.page === currentPage && (now - (last.ts || 0)) < 2 * 60 * 1000) return;

    try {
        const deviceInfo = _getDeviceInfo();

        // Upsert ke visitors tetap untuk status Online
        const { error } = await supabase.from("visitors").upsert({
            user_id: user.id,
            class_id: getEffectiveClassId() || user.class_id,
            is_visible: true,
            last_page: currentPage,
            visited_at: new Date().toISOString(),
            user_agent: deviceInfo.user_agent,
            device_type: deviceInfo.device_type,
            platform: deviceInfo.platform,
            screen_resolution: deviceInfo.screen_resolution,
            browser_language: deviceInfo.browser_language
        }, { onConflict: 'user_id' });

        if (!error) {
            localStorage.setItem(debounceKey, JSON.stringify({ page: currentPage, ts: now }));
            // Log navigasi mendetail: "Dari [Halaman A] ke [Halaman B]"
            logActivity(`Navigasi: ${previousPage} -> ${currentPage}`, "Navigation", 5, `nav_${currentPage.toLowerCase().replace(/\s+/g, '_')}`);
        }
    } catch (err) { console.error("Log Error:", err); }
}

// ==========================================
// 1.5 LOG AKTIVITAS (BUAT LEADERBOARD)
// ==========================================
// 2. BADGE COUNT — via Realtime, tanpa polling
// ==========================================
let _visitorCountChannel = null;

async function initVisitorBadge() {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    // Fetch count sekali saat load
    await refreshVisitorCount(user);

    // Dengerin perubahan → update badge otomatis
    if (_visitorCountChannel) return;
    _visitorCountChannel = supabase
        .channel('visitor_badge')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'visitors',
            filter: `class_id=eq.${getEffectiveClassId() || user.class_id}`
        }, () => refreshVisitorCount(user))
        .subscribe();

    window.addEventListener('pagehide', () => {
        if (_visitorCountChannel) {
            _visitorCountChannel.unsubscribe();
            _visitorCountChannel = null;
        }
    }, { once: true });
}

async function refreshVisitorCount(user) {
    try {
        const { count, error } = await supabase
            .from('visitors')
            .select('user_id', { count: 'exact', head: true })
            .eq('class_id', getEffectiveClassId() || user.class_id)
            .eq('is_visible', true);

        if (!error) {
            const finalCount = count || 0;
            localStorage.setItem('cached_visitor_count', finalCount);
            const badge = document.getElementById("headerVisitorCount");
            if (badge) badge.innerText = finalCount;
        }
    } catch (err) { console.error("Badge Count Error:", err); }
}

// ==========================================
// 3. POPUP — fetch HANYA saat dibuka
// ==========================================
let _visitorPopupChannel = null;
let _activeVisitorClass = null;

// ── Tab classes ──
async function renderVisitorTabs() {
    const container = document.getElementById('visitorTabs');
    if (!container) return;
    const user = _getVisitorUser();
    if (!user) return;

    const { data: classes } = await supabase.from('classes').select('id, name').eq('is_active', true).order('id');
    if (!classes || !classes.length) { container.innerHTML = ''; return; }

    // Default ke kelas user kalo blom dipilih
    if (!_activeVisitorClass) {
        _activeVisitorClass = getEffectiveClassId() || user.class_id;
    }

    container.innerHTML = classes.map(c => `
        <div class="visitor-tab${c.id == _activeVisitorClass ? ' active' : ''}"
             data-class="${c.id}"
             onclick="switchVisitorTab(${c.id})">${c.name}</div>
    `).join('');
}

window.switchVisitorTab = function(classId) {
    _activeVisitorClass = classId;
    const tabs = document.querySelectorAll('.visitor-tab');
    tabs.forEach(t => t.classList.toggle('active', t.dataset.class == classId));
    renderVisitorStats();
};

async function renderVisitorStats(skipSkeleton) {
    const user = _getVisitorUser();
    if (!user || typeof supabase === 'undefined') return;

    // Tampilkan skeleton cuma pas awal buka, bukan pas realtime update
    const listEl = document.getElementById("visitorList");
    if (!skipSkeleton && listEl) {
        listEl.innerHTML = Array.from({ length: 4 }, () => `
            <div class="visitor-item">
                <div class="dc-skel" style="width:30px; height:30px; border-radius:50%; flex-shrink:0;"></div>
                <div style="flex:1; margin-left:10px;">
                    <div class="dc-skel" style="height:12px; width:${60 + Math.floor(Math.random() * 60)}px; margin-bottom:6px; border-radius:6px;"></div>
                    <div class="dc-skel" style="height:10px; width:${80 + Math.floor(Math.random() * 50)}px; border-radius:6px;"></div>
                </div>
            </div>`).join('');
    }

    try {
        const targetClass = _activeVisitorClass || getEffectiveClassId() || user.class_id;
        const { data, error } = await supabase
            .from('visitors')
            .select('user_id, visited_at, last_page, is_visible, user_agent, device_type, platform, screen_resolution, browser_language, user:users(full_name, avatar_url, nickname)')
            .eq('class_id', targetClass)
            .order('visited_at', { ascending: false });

        if (error) throw error;

        // Dedup — prioritaskan yg is_visible=true kalo ada duplikat user_id
        const uniqueMap = new Map();
        data.forEach(v => {
            const existing = uniqueMap.get(v.user_id);
            if (!existing || (!existing.is_visible && v.is_visible)) {
                uniqueMap.set(v.user_id, v);
            }
        });

        const visibleCount = [...uniqueMap.values()].filter(v => v.is_visible).length;
        const popupCount = document.getElementById("popupVisitorCount");
        if (popupCount) popupCount.innerText = visibleCount;

        const listEl2 = document.getElementById("visitorList");
        if (!listEl2) return;

        listEl2.innerHTML = uniqueMap.size === 0
            ? `<p style="color:#aaa; font-size:12px;">${t('no_visitors')}</p>`
            : '';

        uniqueMap.forEach(v => {
            const u = v.user || {};
            const nickname = u.nickname || u.full_name || 'User';
            const avatar = u.avatar_url || '../icons/profpicture.png';

            const ts = new Date(v.visited_at);
            const tanggal = ts.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long' });
            const jam = ts.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

            const isOnline = v.is_visible && window._onlineUsers.has(String(v.user_id));

            let deviceLabel = '';
            if (v.device_type) deviceLabel += v.device_type;
            if (v.platform) deviceLabel += deviceLabel ? ` • ${v.platform}` : v.platform;

            const hasDeviceInfo = deviceLabel || v.user_agent || v.screen_resolution || v.browser_language;

            const item = document.createElement('div');
            item.className = 'visitor-item';
            item.style.opacity = v.is_visible ? '1' : '0.45';
            item.innerHTML = `
                <div style="position:relative; width:30px; height:30px; flex-shrink:0;">
                    <img src="${avatar}" style="width:30px; height:30px; border-radius:50%; object-fit:cover; ${v.is_visible ? '' : 'filter:grayscale(0.7);'}">
                    ${isOnline ? '<div style="position:absolute; bottom:-1px; left:-1px; width:11px; height:11px; border-radius:50%; background:#22c55e; border:2px solid #0a0f19;"></div>' : ''}
                </div>
                <div style="flex:1; margin-left:10px; min-width:0;">
                    <div style="font-size:13px; font-weight:bold; ${v.is_visible ? '' : 'color:#666;'}">${nickname}</div>
                    <div style="font-size:11px; display:flex; justify-content:space-between; align-items:center; gap:8px;">
                        <span style="color:${v.is_visible ? 'var(--accent, #00eaff)' : '#555'}; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${v.last_page || 'Muter-muter'}</span>
                        <span style="color:#666; white-space:nowrap; display:flex; align-items:center; gap:4px;">
                            ${tanggal} • ${jam}
                            ${hasDeviceInfo ? '<i class="fa-solid fa-chevron-down" style="font-size:9px; transition:transform .3s;"></i>' : ''}
                        </span>
                    </div>
                    <div class="v-device-detail" style="max-height:0; opacity:0; overflow:hidden; transition:max-height .35s ease, opacity .35s ease; font-size:10px; color:#666; line-height:1.2;">
                        ${deviceLabel ? `<span style="color:#888;">${deviceLabel}</span><br>` : ''}
                        ${v.user_agent ? `<span style="color:#888;">UA:</span> ${v.user_agent}<br>` : ''}
                        ${v.screen_resolution ? `<span style="color:#888;">Resolusi:</span> ${v.screen_resolution}<br>` : ''}
                        ${v.browser_language ? `<span style="color:#888;">Bahasa:</span> ${v.browser_language}` : ''}
                    </div>
                </div>`;

            if (hasDeviceInfo) {
                const detail = item.querySelector('.v-device-detail');
                const arrow = item.querySelector('.fa-chevron-down');
                item.addEventListener('click', (e) => {
                    if (e.target.closest('.admin-actions')) return;
                    const isOpen = detail.style.maxHeight !== '0px' && detail.style.maxHeight !== '';
                    if (isOpen) {
                        detail.style.maxHeight = '0';
                        detail.style.opacity = '0';
                        if (arrow) arrow.style.transform = 'rotate(0deg)';
                    } else {
                        detail.style.maxHeight = detail.scrollHeight + 12 + 'px';
                        detail.style.opacity = '1';
                        if (arrow) arrow.style.transform = 'rotate(180deg)';
                    }
                });
            }

            listEl2.appendChild(item);
        });

        const adminActions = document.querySelector(".admin-actions");
        if (adminActions) {
            const isAdmin = user.role === 'class_admin' || user.role === 'super_admin';
            adminActions.style.display = isAdmin ? 'flex' : 'none';
        }
    } catch (err) { console.error("Stats Error:", err); }
}

// ==========================================
// 3.5 AUTO RESET — 15:00 setiap hari
// ==========================================
async function _checkAutoResetVisitor(user) {
    try {
        const lastDate = localStorage.getItem('auto_reset_visitor_date');
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        // Skip kalo udah di-reset hari ini
        if (lastDate === today) return;

        const now = new Date();
        const hour = now.getHours();
        const minute = now.getMinutes();
        // 15:00 = 3 PM
        if (hour < 15 || (hour === 15 && minute === 0)) {
            // Belum waktunya — cek sekali lagi nanti pas jam 15:00 lewat
            const msUntil15 = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 15, 1, 0, 0) - now;
            if (msUntil15 > 0) {
                setTimeout(() => _checkAutoResetVisitor(user), msUntil15);
            }
            return;
        }

        // Waktunya reset (semua kelas)
        const { error } = await supabase
            .from('visitors')
            .update({ is_visible: false })
            .neq('id', '00000000-0000-0000-0000-000000000000');

        if (error) throw error;

        localStorage.setItem('auto_reset_visitor_date', today);
        console.log('🔄 Visitor auto-reset at', new Date().toLocaleString('id-ID'));
    } catch (err) {
        console.error('Auto reset visitor error:', err);
    }
}

// ==========================================
// 4. EVENT LISTENERS
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    const user = _getVisitorUser();
    if (!user) return;

    const trigger = document.getElementById("visitorTrigger");
    const overlay = document.getElementById("visitorOverlay");
    const closeBtn = document.getElementById("closeVisitorPopup");
    const resetBtn = document.getElementById("resetVisitorBtn");

    // Jalankan log + badge saat halaman load
    logVisitor();
    initVisitorBadge();

    // Buka popup → baru fetch list
    if (trigger) {
        trigger.onclick = () => {
            overlay?.classList.add("show");
            if (typeof lockScroll === 'function') lockScroll(); // Lock background scroll
            renderVisitorTabs().then(() => renderVisitorStats());

            // Realtime di dalam popup (hanya admin)
            const isAdmin = user.role === 'super_admin' || user.role === 'class_admin';
            if (isAdmin && !_visitorPopupChannel) {
                _visitorPopupChannel = supabase
                    .channel('visitor_popup')
                    .on('postgres_changes', {
                        event: '*',
                        schema: 'public',
                        table: 'visitors',
                        filter: `class_id=eq.${_activeVisitorClass || getEffectiveClassId() || user.class_id}`
                    }, () => renderVisitorStats(true))
                    .subscribe();
            }
        };
    }

    // Tutup popup → matiin realtime popup
    const closeAction = () => {
        if (overlay?.classList.contains('show')) {
            overlay.classList.remove("show");
            if (typeof unlockScroll === 'function') unlockScroll(); // Unlock background scroll
            if (_visitorPopupChannel) {
                _visitorPopupChannel.unsubscribe();
                _visitorPopupChannel = null;
            }
        }
    };

    if (closeBtn) closeBtn.onclick = closeAction;
    if (overlay) overlay.onclick = (e) => { if (e.target === overlay) closeAction(); };

    // Shortcut Ctrl+Q → buka/tutup visitor popup, Esc -> Close
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.key === 'q') {
            e.preventDefault();
            if (overlay?.classList.contains('show')) {
                closeAction();
            } else {
                trigger?.click();
            }
        } else if (e.key === 'Escape') {
            if (overlay?.classList.contains('show')) {
                closeAction();
            }
        }
    });

    // Auto Reset toggle
    const autoResetChk = document.getElementById("autoResetVisitor");
    if (autoResetChk) {
        const saved = localStorage.getItem('auto_reset_visitor');
        autoResetChk.checked = saved === 'true';
        autoResetChk.addEventListener('change', () => {
            localStorage.setItem('auto_reset_visitor', autoResetChk.checked);
            if (autoResetChk.checked) _checkAutoResetVisitor(user);
        });
        if (autoResetChk.checked) _checkAutoResetVisitor(user);
    }

    // Reset (admin only)
    if (resetBtn) {
        resetBtn.onclick = async () => {
            if (user.role !== 'class_admin' && user.role !== 'super_admin') return;

            const yakin = await showPopup("Bersihkan list pengunjung hari ini?", "confirm");
            if (!yakin) return;

            resetBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Resetting...';
            try {
                const { error } = await supabase
                    .from('visitors')
                    .update({ is_visible: false })
                    .neq('id', '00000000-0000-0000-0000-000000000000'); // semua kelas

                if (error) throw error;
                showToast("List pengunjung telah di-reset!", "success");
            } catch (err) {
                console.error("Reset Error:", err);
                showPopup("Gagal reset data", "error");
            } finally {
                resetBtn.innerHTML = '<i class="fa-solid fa-rotate-right"></i> ' + t('resetvist');
            }
        };
    }

    // --- GLOBAL CLICK CAPTURE FOR ACTIVITY LOGS ---
    document.addEventListener('click', (e) => {
        // 1. Klik Kartu Materi (Buka Detail)
        const card = e.target.closest('.course-card');
        if (card && card.classList.contains('clickable-card')) {
            // Jangan catat kalau yang diklik tombol action (delete/bookmark)
            if (!e.target.closest('button') && !e.target.closest('input')) {
                const title = card.querySelector('h3')?.innerText || t('materi_title');
                const id = card.dataset.id || "";
                logActivity(`Membaca Materi: ${title}`, "Subject", 5, id);
            }
        }

        // 2. Klik Tombol Selesai Tugas
        const taskBtn = e.target.closest('.task-btn');
        if (taskBtn && !taskBtn.hasAttribute('disabled')) {
            const isDone = taskBtn.classList.contains('done');
            if (!isDone) { // Hanya catat saat mencentang SELESAI
                const cardTugas = taskBtn.closest('.course-card');
                const titleTugas = cardTugas?.querySelector('h3')?.innerText || 'Tugas';
                const idTugas = cardTugas?.dataset.id || "";
                logActivity(`Menyelesaikan Tugas: ${titleTugas}`, "Tugas", 10, idTugas);
            }
        }
    });
});