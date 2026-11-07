// --- GLOBAL VARIABLES ---
window.dailyDrafts = {};
window.isDailyEditing = false;
window.editingDay = null;
window.currentViewDay = null;

async function getAcademicYear(classId) {
    if (!classId) return '2025/2026';
    try {
        const { data } = await supabase.from('classes').select('academic_year').eq('id', classId).single();
        return data?.academic_year || '2025/2026';
    } catch (e) { return '2025/2026'; }
}

// ==========================================
// SKELETON LOADER
// ==========================================
(function injectSkeletonStyles() {
    if (document.getElementById('dc-skeleton-style')) return;
    const style = document.createElement('style');
    style.id = 'dc-skeleton-style';
    style.textContent = `
        .dc-skel {
            background: linear-gradient(90deg,
                rgba(255,255,255,0.05) 25%,
                rgba(255,255,255,0.12) 50%,
                rgba(255,255,255,0.05) 75%);
            background-size: 200% 100%;
            animation: dc-shimmer 1.4s infinite;
            border-radius: 8px;
        }
        @keyframes dc-shimmer {
            0%   { background-position: 200% 0; }
            100% { background-position: -200% 0; }
        }
        .dc-skel-info-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 0.5rem;
            margin-bottom: 1.4rem;
        }
        .dc-skel-info-card {
            height: 64px;
            border-radius: 0.6rem;
        }
        .dc-skel-section-title {
            height: 14px;
            width: 140px;
            margin-bottom: 12px;
        }
        .dc-skel-timeline {
            display: flex;
            flex-direction: column;
            gap: 0;
        }
        .dc-skel-tl-row {
            display: grid;
            grid-template-columns: 6.5rem 1px 1fr;
            gap: 0 0.8rem;
            min-height: 2.4rem;
            align-items: center;
            padding: 0.4rem 0;
        }
        .dc-skel-tl-time  { height: 11px; width: 48px; }
        .dc-skel-tl-marker {
            display: flex;
            justify-content: center;
        }
        .dc-skel-tl-dot   { width: 9px; height: 9px; border-radius: 50%; }
        .dc-skel-tl-subj  { height: 11px; }
        .dc-skel-pills { display: flex; gap: 8px; flex-wrap: wrap; }
        .dc-skel-pill  { height: 30px; width: 80px; border-radius: 20px; }
        .dc-skel-header-badge { height: 18px; width: 70px; border-radius: 6px; margin-bottom: 8px; }
        .dc-skel-header-day   { height: 26px; width: 120px; border-radius: 8px; margin-bottom: 6px; }
        .dc-skel-header-date  { height: 13px; width: 160px; border-radius: 6px; }

        .tl-subject-final.dc-nav-valid { cursor: pointer; transition: opacity 0.2s; }
        .tl-subject-final.dc-nav-valid:hover { opacity: 0.7; text-decoration: underline; }
        .edit-mode-on .tl-subject-final { cursor: text !important; text-decoration: none !important; opacity: 1 !important; }

        .sim-shortcut-glow {
            background: linear-gradient(45deg, #00eaff, #0084ff) !important;
            border: none !important;
            box-shadow: 0 0 15px rgba(0, 234, 255, 0.4) !important;
            animation: sim-pulse 2s infinite;
        }
        .sim-shortcut-glow i, .sim-shortcut-glow span {
            color: #000 !important;
            font-weight: 900 !important;
        }
        @keyframes sim-pulse {
            0% { box-shadow: 0 0 15px rgba(0, 234, 255, 0.4); }
            50% { box-shadow: 0 0 25px rgba(0, 234, 255, 0.7); }
            100% { box-shadow: 0 0 15px rgba(0, 234, 255, 0.4); }
        }
    `;
    document.head.appendChild(style);
})();

// Helper navigasi ke halaman subject
async function _navigateToSubject(name, classId) {
    if (!name || name === '-' || window.isDailyEditing) return;

    // Guest mode → popup login
    if (!localStorage.getItem('user')) {
        const result = await showPopup(t('login_first'), 'confirm');
        if (result) window.location.href = 'login';
        return;
    }

    // Fungsi normalize biar "Bahasa Indonesia" cocok sama "bahasaindonesia"
    const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

    try {
        if (!window._dcSubjMap) {
            const { data } = await supabase.from('subjects_config')
                .select('subject_id, subject_name')
                .eq('class_id', classId);
            window._dcSubjMap = data || [];
        }

        const search = normalize(name);
        // Cari yang paling mendekati (exact atau partial setelah di-normalize)
        const match = window._dcSubjMap.find(s => {
            const sNameNorm = normalize(s.subject_name);
            const sIdNorm = normalize(s.subject_id);
            
            // Cek Exact Match dulu
            if (sNameNorm === search || sIdNorm === search) return true;

            // Kalau Partial Match (includes), minimal length 3 biar gak typo (misal: PPK match ke PP)
            if (search.length > 3 && (sNameNorm.includes(search) || search.includes(sNameNorm))) return true;

            return false;
        });

        if (match) {
            window.location.href = `subject?id=${match.subject_id}`;
        }
    } catch (e) { console.error('DC Nav Error:', e); }
}

function _buildDailyCardSkeleton() {
    const timelineRows = [1, 2, 3, 4, 5, 6, 7].map(i => `
        <div class="dc-skel-tl-row">
            <div class="dc-skel dc-skel-tl-time"></div>
            <div class="dc-skel-tl-marker">
                <div class="dc-skel dc-skel-tl-dot"></div>
            </div>
            <div class="dc-skel dc-skel-tl-subj" style="width:${45 + Math.floor(Math.random() * 40)}%"></div>
        </div>`).join('');

    return `
        <div class="dc-skel-info-grid">
            <div class="dc-skel dc-skel-info-card"></div>
            <div class="dc-skel dc-skel-info-card"></div>
            <div class="dc-skel dc-skel-info-card"></div>
        </div>
        <div class="final-spacer"></div>
        <div class="final-section">
            <div class="dc-skel dc-skel-section-title"></div>
            <div class="dc-skel-timeline">
                ${timelineRows}
            </div>
        </div>
        <div class="final-spacer"></div>
        <div class="final-section">
            <div class="dc-skel dc-skel-section-title" style="width:110px; margin-bottom:12px;"></div>
            <div class="dc-skel-pills">
                <div class="dc-skel dc-skel-pill"></div>
                <div class="dc-skel dc-skel-pill" style="width:65px;"></div>
                <div class="dc-skel dc-skel-pill" style="width:90px;"></div>
                <div class="dc-skel dc-skel-pill" style="width:72px;"></div>
                <div class="dc-skel dc-skel-pill" style="width:58px;"></div>
            </div>
        </div>
    `;
}

function _buildHeaderSkeleton() {
    return `
        <div>
            <div class="dc-skel dc-skel-header-badge"></div>
            <div class="dc-skel dc-skel-header-day"></div>
            <div class="dc-skel dc-skel-header-date"></div>
        </div>
        <div class="header-right-group">
            <div class="task-shortcut-box" style="opacity:0.4; pointer-events:none;">
                <div class="task-badge" style="display:none;">0</div>
                <i class="fa-solid fa-clipboard-list"></i>
                <span>...</span>
            </div>
        </div>`;
}


// Helper aman baca user dari localStorage
function _getDailyUser() {
    try {
        return JSON.parse(localStorage.getItem("user"));
    } catch (e) {
        return null;
    }
}

// ==========================================
// CACHE HELPERS
// ==========================================
const DAILY_CACHE_TTL = 30 * 60 * 1000; // 30 menit

function _dcCacheGet(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > DAILY_CACHE_TTL) return null; // expired
        return data;
    } catch (e) { return null; }
}

function _dcCacheSet(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* storage penuh, skip */ }
}

function _dcCacheInvalidate(classId) {
    try {
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu', 'CUSTOM'];
        const types = ['regular', 'exam', 'custom'];
        days.forEach(d => {
            types.forEach(t => {
                localStorage.removeItem(`dc_sched_${classId}_${d}_${t}`);
            });
        });
        localStorage.removeItem(`dc_config_${classId}`);
    } catch (e) { }
}

async function initDailyCard(guestClassId) {
    const container = document.querySelector('.left-section');
    if (!container) return;

    let user, USER_CLASS_ID;
    if (guestClassId) {
        USER_CLASS_ID = String(guestClassId);
        user = { role: '', class_id: USER_CLASS_ID };
    } else {
        user = _getDailyUser();
        if (!user || user.class_id === undefined || user.class_id === null) return;
        USER_CLASS_ID = getEffectiveClassId() || user.class_id;
    }

    const MASTER_CLASS_ID = 2; // Class ID pusat untuk Global Exam

    // --- 1. LOGIC CONFIG & GLOBAL EXAM ---
    let config = window.currentConfig;
    let isGlobalExam = false;

    // Hanya fetch data kalau belum ada di memori ATAU lagi nggak ngedit
    if (!config || !window.isDailyEditing) {
        try {
            // A. Cek Master Config dulu buat tau apakah Global Exam lagi aktif
            const masterCacheKey = `dc_config_${MASTER_CLASS_ID}`;
            let masterConfig = _dcCacheGet(masterCacheKey);

            if (!masterConfig) {
                const { data } = await supabase.from('daily_config').select('*').eq('class_id', MASTER_CLASS_ID).single();
                masterConfig = data;
                if (data) _dcCacheSet(masterCacheKey, data);
            }

            if (masterConfig && masterConfig.mode === 'exam' && USER_CLASS_ID != MASTER_CLASS_ID) {
                // Hanya anggap 'Global' bagi orang yang BUKAN admin Class 2
                // Biar admin Class 2 tetep bisa ngontrol master config-nya sendiri
                isGlobalExam = true;
                config = masterConfig;
            } else {
                // B. Pake config kelas masing-masing
                const configCacheKey = `dc_config_${USER_CLASS_ID}`;
                const cachedConfig = _dcCacheGet(configCacheKey);
                if (cachedConfig) {
                    config = cachedConfig;
                } else {
                    const { data } = await supabase.from('daily_config').select('*').eq('class_id', USER_CLASS_ID).single();
                    config = data;
                    if (data) _dcCacheSet(configCacheKey, data);
                }
            }
        } catch (e) { console.warn("DC Config Load Error:", e); }
    }

    if (!config) {
        config = { class_id: USER_CLASS_ID, is_auto: true, mode: 'regular', forced_day: 'Senin' };
    }
    // Migration: Pastikan mode exist
    if (!config.mode) config.mode = config.is_custom ? 'custom' : 'regular';
    
    window.currentConfig = config;
    const CLASS_ID = config.class_id; 

    // --- 2. RENDER KERANGKA ---
    const cardId = 'dailyInfoCard';
    let cardEl = document.getElementById(cardId);
    
    // canEdit: Hanya admin Class 2 yang bisa edit kalo lagi Global Exam aktif (bagi siswa lain)
    const isAdmin = (user.role === 'class_admin' || user.role === 'super_admin');
    const canEditThisConfig = isGlobalExam ? false : isAdmin;

    let editActionHTML = '';
    if (canEditThisConfig) {
        if (window.isDailyEditing) {
            editActionHTML = `
                <div class="card-edit-actions">
                    <button class="action-btn save" onclick="saveAllDrafts()" title="${t('save')}"><i class="fa-solid fa-check"></i></button>
                    <button class="action-btn cancel" onclick="toggleDailyEditMode()" title="${t('cancel')}"><i class="fa-solid fa-xmark"></i></button>
                </div>`;
        } else {
            editActionHTML = `
                <button class="action-btn edit" onclick="toggleDailyEditMode()" title="${t('edit_schedule')}">
                    <i class="fa-solid fa-pen-to-square"></i>
                </button>`;
        }
    }

    if (!cardEl) {
        const cardHTML = `
            <div id="${cardId}" class="daily-card-final glass-card-effect">
                <div class="final-header animate-pop-in" id="dcHeader"></div>
                <div id="dcContentFinal" class="final-content">
                    ${_buildDailyCardSkeleton()}
                </div>
                <div id="dailyConfigPanel" class="config-panel"></div>
                <div class="final-watermark">v14 dynamic-range-system</div>
            </div>
        `;
        const welcome = document.getElementById('welcomeText');
        if (welcome) welcome.insertAdjacentHTML('afterend', cardHTML);
        else container.innerHTML += cardHTML;
        cardEl = document.getElementById(cardId);
    }

    // --- 2. UPDATE CONFIG PANEL (Always ensure latest UI structure) ---
    const configPanel = document.getElementById('dailyConfigPanel');
    if (configPanel && (!configPanel.innerHTML || !document.getElementById('kisiRangeArea'))) {
        configPanel.innerHTML = `
            <div style="margin-bottom:15px;">
                <label style="font-size:12px; display:block; margin-bottom:5px; color:#00eaff; font-weight:bold;">${t('activate_mode')}</label>
                <select id="editModeSelector" class="glass-input" style="border-color:#ff4757; color:#00eaff; font-weight:bold;">
                    <option value="regular">${t('main_sch')}</option>
                    <option value="exam">${t('exam_sch')}</option>
                    <option value="custom">${t('custom_sch')}</option>
                </select>
            </div>

            <!-- KISI-KISI RANGE SELECTOR -->
            <div id="kisiRangeArea" style="margin-bottom:15px; display:none; border-top:1px solid rgba(255,255,255,0.1); padding-top:15px;">
                <label style="font-size:12px; display:block; margin-bottom:8px; color:#00eaff; font-weight:bold;">${t('sch_kisi')}</label>
                <div id="kisiDayCheckboxes" style="display:grid; grid-template-columns: repeat(2, 1fr); gap:8px;">
                    ${['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'].map(d => `
                        <label style="display:flex; align-items:center; gap:8px; font-size:12px; cursor:pointer;">
                            <input type="checkbox" value="${d}" class="kisi-day-opt" style="accent-color:#00eaff;"> ${t(d.toLowerCase())}
                        </label>
                    `).join('')}
                </div>
            </div>

            <div id="normalConfigArea">
                <div style="margin-bottom:15px; display: flex; gap: 8px;">
                    <button class="btn-tool" onclick="importScheduleFromText()" style="flex: 1; background: rgba(0, 234, 255, 0.1); border: 1px dashed #00eaff; color: #00eaff; padding: 10px; border-radius: 8px; font-size: 11px; font-weight: bold;">
                        <i class="fa-solid fa-file-pdf"></i> IMPOR PDF JADWAL
                    </button>
                </div>
                <div style="margin-bottom:15px;">
                    <label style="font-size:12px; display:block; margin-bottom:5px; color:#00eaff; font-weight:bold;">${t('edit_day')}</label>
                    <select id="editDaySelector" class="glass-input">
                        <option value="Senin">${t('senin')}</option>
                        <option value="Selasa">${t('selasa')}</option>
                        <option value="Rabu">${t('rabu')}</option>
                        <option value="Kamis">${t('kamis')}</option>
                        <option value="Jumat">${t('jumat')}</option>
                        <option value="Sabtu">${t('sabtu')}</option>
                        <option value="Minggu">${t('minggu')}</option>
                    </select>
                </div>

                <div class="dc-toggle-area" style="margin-top:0;">
                    <span style="font-size:13px;">${t('auto_upd')}</span>
                    <label class="switch">
                        <input type="checkbox" id="editAutoToggle">
                        <span class="slider round"></span>
                    </label>
                </div>
            </div>
        `;
    }

    const headerEl = document.getElementById('dcHeader');
    headerEl.innerHTML = _buildHeaderSkeleton();

    // Kalau card sudah ada (re-render), tampilkan skeleton sementara data diambil
    const contentEl2 = document.getElementById('dcContentFinal');
    if (contentEl2 && !window.isDailyEditing) {
        contentEl2.innerHTML = _buildDailyCardSkeleton();
    }

    // --- 3. LOGIC DISPLAY ---
    try {
        const now = new Date();
        const daysInternal = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        
        let autoDay = daysInternal[now.getDay()];
        if (now.getHours() >= 15) {
            const besok = new Date(now);
            besok.setDate(now.getDate() + 1);
            autoDay = daysInternal[besok.getDay()];
        }

        let displayDay = 'Senin'; // Ini dipake buat query DB
        let labelWaktu = 'HARI INI';
        let currentType = config.mode || 'regular';
        
        // --- LOGIC TANGGAL DINAMIS (Support i18n Bulan) ---
        const monthKeyMap = [
            'january', 'february', 'march', 'april', 'may', 'june',
            'july', 'august', 'september', 'october', 'november', 'december'
        ];
        const dayNum = now.getDate();
        const monthName = t(monthKeyMap[now.getMonth()]);
        const yearNum = now.getFullYear();
        let fullDate = `${dayNum} ${monthName} ${yearNum}`;

        if (window.editingDay) {
            displayDay = window.editingDay;
            labelWaktu = (displayDay === 'CUSTOM') ? 'EDIT CUSTOM' : 'DRAFT MODE';
        } else if (config.mode === 'custom') {
            displayDay = 'CUSTOM';
            labelWaktu = `${t('special_event')}`;
            fullDate = t('custom_schedule');
        } else if (config.mode === 'exam') {
            if (config.is_auto) {
                displayDay = autoDay;
                if (now.getHours() >= 15) labelWaktu = `${t('tomorrow')} (${t('exam')})`;
                else labelWaktu = `${t('today')} (${t('exam')})`;
            } else {
                displayDay = config.forced_day;
                labelWaktu = 'EXAM MODE';
            }
            if (isGlobalExam) labelWaktu = `GLOBAL ${labelWaktu}`;
        } else if (config.is_auto) {
            displayDay = autoDay;
            if (now.getHours() >= 15) labelWaktu = `${t('today')}`;
        } else {
            displayDay = config.forced_day;
            labelWaktu = 'MANUAL';
            fullDate = '-';
        }

        window.currentViewDay = displayDay;
        const activeType = (window.isDailyEditing) ? currentType : (config.mode || 'regular');

        // Set data-day buat warna per hari via CSS var (tetep pake internal name biar CSS-nya gak ikutan pecah)
        if (cardEl) cardEl.dataset.day = displayDay;

        // Render header real (ganti skeleton)
        const isExamMode = config.mode === 'exam';
        const shortcutLink = isExamMode ? 'a/kisi-kisi' : 'a/tugas';
        const shortcutIcon = isExamMode ? 'fa-solid fa-file-signature' : 'fa-solid fa-clipboard-list';
        const shortcutLabel = isExamMode ? `${t('exam_topics')}` : `${t('task')}`;
        const badgeDisplay = isExamMode ? 'none' : 'block';

        const simShortcutHTML = isExamMode ? `
            <div class="task-shortcut-box sim-shortcut-glow" onclick="window.location.href='quiz'" style="margin-right:8px;">
                <i class="fa-solid fa-graduation-cap"></i>
                <span>${t('exam_simulation')}</span>
            </div>` : '';

        headerEl.innerHTML = `
        <div>
            <span class="final-badge" id="lblBadge">${t('loading')}</span>
            <h2 class="final-day editable-text" id="lblHari" oninput="autoSaveDraft()">...</h2>
            <small class="final-date" id="lblTanggal">...</small>
        </div>
        <div class="header-right-group">
            ${editActionHTML}
            ${simShortcutHTML}
            <div class="task-shortcut-box" onclick="window.location.href='${shortcutLink}'">
                <div id="taskBadge" class="task-badge" style="display: ${badgeDisplay}">0</div>
                <i class="${shortcutIcon}"></i>
                <span>${shortcutLabel}</span>
            </div>
        </div>`;

        // Hapus logic lama dcEditBtn di pojok bawah
        const oldEditWrap = document.getElementById('dcEditBtn');
        if (oldEditWrap) oldEditWrap.remove();

        const badgeEl = document.getElementById('lblBadge');
        badgeEl.innerText = labelWaktu;
        
        let badgeClass = 'bg-cyan';
        if (displayDay === 'CUSTOM') badgeClass = 'bg-custom';
        else if (config.mode === `${t('exam')}`) badgeClass = 'bg-orange';
        else if (labelWaktu === `${t('tomorrow')}`) badgeClass = 'bg-orange';
        
        badgeEl.className = `final-badge ${badgeClass}`;

        const dayTranslationKey = displayDay.toLowerCase();
        const dayDisplayText = (displayDay === 'CUSTOM') 
            ? (config.custom_title || 'EVENT KHUSUS') 
            : t(dayTranslationKey);

        document.getElementById('lblHari').innerText = dayDisplayText;
        document.getElementById('lblTanggal').innerText = fullDate;

        const daySel = document.getElementById('editDaySelector');
        const modeSel = document.getElementById('editModeSelector');
        const autoTog = document.getElementById('editAutoToggle');
        const normalArea = document.getElementById('normalConfigArea');
        const kisiArea = document.getElementById('kisiRangeArea');

        if (modeSel) {
            const activeMode = config.mode || 'regular';
            modeSel.value = activeMode;
            autoTog.checked = config.is_auto;
            
            // --- LOGIC VISIBILITAS ---
            if (normalArea) normalArea.style.display = (activeMode === 'custom' || window.editingDay === 'CUSTOM') ? 'none' : 'block';
            if (kisiArea) kisiArea.style.display = (activeMode === 'exam') ? 'block' : 'none';
            
            if (displayDay !== 'CUSTOM' && daySel) daySel.value = displayDay;

            // Set Checkboxes Kisi-kisi
            const savedKisiDays = config.kisi_days || ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"];
            document.querySelectorAll('.kisi-day-opt').forEach(opt => {
                opt.checked = savedKisiDays.includes(opt.value);
            });

            modeSel.onchange = async (e) => {
                const newMode = e.target.value;
                if (window.isDailyEditing) saveToDraft(window.editingDay, window.currentConfig.mode);
                
                // Update config
                window.currentConfig.mode = newMode;
                window.currentConfig.is_custom = (newMode === 'custom');

                // Recalculate autoDay for fallback
                const _now = new Date();
                const _days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
                let _autoDay = _days[_now.getDay()];
                if (_now.getHours() >= 15) {
                    const _besok = new Date(_now);
                    _besok.setDate(_now.getDate() + 1);
                    _autoDay = _days[_besok.getDay()];
                }

                // Force editingDay sync
                window.editingDay = (newMode === 'custom') ? 'CUSTOM' : (window.currentConfig.is_auto ? _autoDay : window.currentConfig.forced_day);
                
                // Update visibilitas instan
                if (kisiArea) kisiArea.style.display = (newMode === 'exam') ? 'block' : 'none';
                if (normalArea) normalArea.style.display = (newMode === 'custom') ? 'none' : 'block';

                initDailyCard();
            };
            autoTog.onchange = (e) => { window.currentConfig.is_auto = e.target.checked; };
            daySel.onchange = (e) => {
                if (window.isDailyEditing) saveToDraft(window.editingDay, window.currentConfig.mode);
                window.editingDay = e.target.value;
                initDailyCard();
            };
        }

        let scheduleData = null;
        const draftKey = `${displayDay}_${activeType}`;
        if (window.dailyDrafts[draftKey]) {
            scheduleData = window.dailyDrafts[draftKey];
        } else {
            const schedCacheKey = `dc_sched_${CLASS_ID}_${displayDay}_${activeType}`;
            const cachedSched = _dcCacheGet(schedCacheKey);

            if (cachedSched) {
                // Tampilkan cache langsung, fetch fresh di background
                scheduleData = cachedSched;
                supabase.from('daily_schedules').select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).eq('type', activeType).single()
                    .then(({ data }) => {
                        if (data) _dcCacheSet(schedCacheKey, data);
                    }).catch(() => { });
            } else {
                try {
                    const { data } = await supabase.from('daily_schedules').select('*').eq('class_id', CLASS_ID).eq('day_name', displayDay).eq('type', activeType).single();
                    scheduleData = data;
                    if (data) _dcCacheSet(schedCacheKey, data);
                } catch (err) {
                    // Fallback ke cache expired kalau network error
                    try {
                        const raw = localStorage.getItem(schedCacheKey);
                        if (raw) scheduleData = JSON.parse(raw).data;
                    } catch (e) { }
                }
            }
        }

        const contentEl = document.getElementById('dcContentFinal');
        if (!scheduleData) {
            contentEl.innerHTML = `<div class="dc-empty-state">${displayDay === 'CUSTOM' ? t('custom_active') + '.<br>' + t('click_edit') : t('data_empty') + '.'}</div>`;
            if (window.isDailyEditing) applyEditMode(true);
            return;
        }

        const dailyColors = {
            'Senin': 'linear-gradient(135deg, #ff4757, #ff6b81)',
            'Selasa': 'linear-gradient(135deg, #5f27cd, #341f97)',
            'Rabu': 'linear-gradient(135deg, #0be881, #00d2d3)',
            'Kamis': 'linear-gradient(135deg, #ffa502, #ff7f50)',
            'Jumat': 'linear-gradient(135deg, #ffffff, #dcdde1)',
            'Sabtu': 'linear-gradient(135deg, #ff9ff3, #feca57)',
            'Minggu': 'linear-gradient(135deg, #54a0ff, #00d2d3)',
            'CUSTOM': 'linear-gradient(135deg, #FFD700, #FFA500)'
        };
        const themeColor = dailyColors[displayDay] || dailyColors['Senin'];
        const textColor = (displayDay === 'Jumat' || displayDay === 'CUSTOM') ? '#333' : '#fff';

        let timelineHTML = '';
        if (scheduleData.lessons) {
            const lessonList = scheduleData.lessons.split(';').map(i => i.trim()).filter(i => i.length > 1);

            lessonList.forEach((item, idx) => {
                const dashIdx = item.lastIndexOf('-'); 
                const time = dashIdx !== -1 ? item.substring(0, dashIdx).trim() : '';
                const subject = dashIdx !== -1 ? item.substring(dashIdx + 1).trim() : item.trim();
                timelineHTML += `
                <div class="tl-item-final animate-slide-right" style="animation-delay:${idx * 0.05}s">
                    <div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div>
                    <div class="tl-time-final editable-text" data-type="time" oninput="autoSaveDraft()">${time}</div>
                    <div class="tl-marker-final"></div>
                    <div class="tl-subject-final editable-text" data-type="subject" oninput="autoSaveDraft()">${subject}</div>
                </div>`;
            });
        }

        let picketHTML = '';
        if (scheduleData.picket) {
            scheduleData.picket.split(';').map(n => n.trim()).filter(n => n.length > 0).forEach((n, i) => {
                picketHTML += `
                <div class="picket-pill animate-pop-up" style="animation-delay:${0.2 + (i * 0.05)}s">
                    <div class="btn-del-inline" onclick="deleteItem(this)"><i class="fa-solid fa-xmark"></i></div>
                    <span class="editable-text" data-type="picket" oninput="autoSaveDraft()">${n}</span>
                </div>`;
            });
        }

        const isRegularMode = (config.mode === 'regular' || !config.mode);
        const picketSectionHTML = isRegularMode ? `
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-solid fa-broom"></i>${t('cleaning_duty')}</h4>
                <div class="picket-grid-big" id="picketList">${picketHTML}</div>
                <button class="btn-add-inline" id="btnAddPicket" style="display:none;" onclick="addPicketRow()">+ ${t('add_people')}</button>
            </div>` : '';

        contentEl.innerHTML = `
            <div class="top-cards-grid">
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}">
                    <div class="card-icon"><i class="fa-solid fa-shirt"></i></div>
                    <div class="card-meta">
                        <span class="card-label" style="color:${textColor}">${t('uniform')}</span>
                        <span class="card-val editable-text" data-type="uniform" oninput="autoSaveDraft()">${scheduleData.uniform || '-'}</span>
                    </div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.1s">
                    <div class="card-icon"><i class="fa-solid fa-person-running"></i></div>
                    <div class="card-meta">
                        <span class="card-label" style="color:${textColor}">${t('activity')}</span>
                        <span class="card-val editable-text" data-type="activity" oninput="autoSaveDraft()">${scheduleData.activity || 'KBM Normal'}</span>
                    </div>
                </div>
                <div class="info-card-dynamic animate-pop-up" style="background:${themeColor}; color:${textColor}; animation-delay:0.2s">
                    <div class="card-icon"><i class="fa-solid fa-note-sticky"></i></div>
                    <div class="card-meta">
                        <span class="card-label" style="color:${textColor}">${t('notes')}</span>
                        <span class="card-val small editable-text" data-type="notes" oninput="autoSaveDraft()">${scheduleData.notes || '-'}</span>
                    </div>
                </div>
            </div>
            <div class="final-spacer"></div>
            <div class="final-section">
                <h4 class="final-title"><i class="fa-regular fa-clock"></i>${t('lesson_sch')}</h4>
                <div class="final-timeline" id="timelineList">${timelineHTML}</div>
                <button class="btn-add-inline" id="btnAddLesson" style="display:none;" onclick="addLessonRow()">+ ${t('add_row')}</button>
            </div>
            ${picketSectionHTML}
        `;

        if (cardEl) cardEl.classList.toggle('edit-mode-on', window.isDailyEditing);
        applyEditMode(window.isDailyEditing);
        updateTaskBadge(user);

        // --- Selective Navigation Logic ---
        const normalize = (str) => str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
        
        // Pastikan map mapel sudah ada
        if (!window._dcSubjMap) {
            const { data } = await supabase.from('subjects_config')
                .select('subject_id, subject_name')
                .eq('class_id', CLASS_ID);
            window._dcSubjMap = data || [];
        }

        // Attach Click Listener & Style HANYA ke Subject yang valid
        contentEl.querySelectorAll('.tl-subject-final').forEach(el => {
            const name = el.innerText.trim();
            const search = normalize(name);
            
            const isValidSubject = window._dcSubjMap.find(s => {
                const sNameNorm = normalize(s.subject_name);
                const sIdNorm = normalize(s.subject_id);
                if (sNameNorm === search || sIdNorm === search) return true;
                if (search.length > 3 && (sNameNorm.includes(search) || search.includes(sNameNorm))) return true;
                return false;
            });

            if (isValidSubject && !window.isDailyEditing) {
                el.classList.add('dc-nav-valid');
                el.onclick = () => _navigateToSubject(name, CLASS_ID);
            } else {
                el.classList.remove('dc-nav-valid');
                el.onclick = null;
            }
        });

    } catch (e) {
        console.error('Daily card error:', e);
    }
}

// Fitur ganti hari via Context Menu (Temporary View / Switch Edit Day)
window.switchDailyDay = function(day) {
    if (window.isDailyEditing) {
        // Simpan progress hari yang lagi di-edit sekarang sebelum pindah
        saveToDraft(window.editingDay, window.currentConfig.mode);

        // Jika user lagi di mode CUSTOM tapi milih hari Senin-Minggu lewat menu,
        // kita paksa modenya balik ke Regular biar gak bingung.
        if (window.currentConfig.mode === 'custom' && day !== 'CUSTOM') {
            window.currentConfig.mode = 'regular';
            window.currentConfig.is_custom = false;
        }
    }

    window.editingDay = day; 
    initDailyCard();
    
    if (typeof showToast === 'function') {
        showToast(t('view_day', { day: t(day.toLowerCase()) }), 'info');
    }
};

// ==========================================
// TASK BADGE
// ==========================================
async function updateTaskBadge(user) {
    const isExamMode = window.currentConfig && window.currentConfig.mode === 'exam';
    const MASTER_CLASS_ID = 2;
    const USER_CLASS_ID = getEffectiveClassId() || user.class_id;
    
    // Nentuin target class ID buat badge
    let targetClassId = USER_CLASS_ID;
    if (isExamMode) {
        // Cek apakah Master Class juga lagi Mode Exam (Global)
        const masterCache = _dcCacheGet(`dc_config_${MASTER_CLASS_ID}`);
        if (masterCache && masterCache.mode === 'exam' && USER_CLASS_ID != MASTER_CLASS_ID) {
            targetClassId = MASTER_CLASS_ID;
        }
    }

    const cacheKey = isExamMode ? `kisi_badge_${targetClassId}` : `task_badge_${user.id}`;
    let cached = null;
    try { cached = JSON.parse(sessionStorage.getItem(cacheKey)); } catch (e) { }

    // Kalau ada flag dirty (admin baru arsipkan task), paksa re-fetch
    const isDirty = sessionStorage.getItem('task_badge_dirty') === '1';
    if (!isDirty && cached && (Date.now() - cached.time < 5 * 60 * 1000)) {
        renderBadgeUI(cached.count, isExamMode);
        return;
    }
    sessionStorage.removeItem('task_badge_dirty');

    try {
        const academicYear = await getAcademicYear(USER_CLASS_ID);
        if (isExamMode) {
            // COUNT MATERI KISI-KISI
            const { count } = await supabase.from('subject_announcements')
                .select('*', { count: 'exact', head: true })
                .eq('class_id', targetClassId)
                .eq('academic_year', academicYear)
                .eq('subject_id', 'kisi-kisi');
            
            const totalKisi = count || 0;
            sessionStorage.setItem(cacheKey, JSON.stringify({ count: totalKisi, time: Date.now() }));
            renderBadgeUI(totalKisi, true);
        } else {
            // COUNT TUGAS PENDING
            const [{ count: total }, { count: done }] = await Promise.all([
                supabase.from('subject_announcements')
                    .select('*', { count: 'exact', head: true })
                    .eq('class_id', USER_CLASS_ID)
                    .eq('academic_year', academicYear)
                    .neq('subject_id', 'announcements')
                    .neq('subject_id', 'kisi-kisi')
                    .neq('subject_id', 'akuhutajakus')
                    .neq('is_done', true),
                supabase.from('user_progress')
                    .select('*', { count: 'exact', head: true })
                    .eq('user_id', user.id)
            ]);
            const pending = Math.max(0, (total || 0) - (done || 0));
            sessionStorage.setItem(cacheKey, JSON.stringify({ count: pending, time: Date.now() }));
            renderBadgeUI(pending, false);
        }
    } catch (e) {
        // Badge gagal tidak perlu crash halaman
    }
}

function renderBadgeUI(count, isExam = false) {
    const el = document.getElementById('taskBadge');
    if (el) {
        el.innerText = count > 99 ? '99+' : count;
        // Kalo mode EXAM, tampilkan badge meskipun 0 biar icon gak sepi
        el.style.display = (isExam || count > 0) ? 'flex' : 'none';
        
        // Ganti warna badge kalo lagi EXAM biar beda sama TUGAS
        if (isExam) {
            el.style.background = '#00eaff';
            el.style.color = '#000';
            el.style.fontWeight = '900';
        } else {
            el.style.background = ''; // Balik ke CSS default
            el.style.color = '';
            el.style.fontWeight = '';
        }
    }
}

// ==========================================
// DRAFT SYSTEM
// ==========================================
window.autoSaveDraft = function () {
    if (window.isDailyEditing && window.editingDay) {
        saveToDraft(window.editingDay, window.currentConfig.mode);
    }
};

window.saveToDraft = function (day, type = 'regular') {
    if (!day) return;
    const user = _getDailyUser();
    if (!user) return;

    // FIX BUG ENTER: strip newline yang muncul dari Enter di contenteditable
    const cleanText = (el) => (el?.innerText || '').replace(/\n+/g, ' ').trim();

    let lessonArr = [];
    document.querySelectorAll('.tl-item-final').forEach(row => {
        const timeEl = row.querySelector('[data-type="time"]');
        const subjEl = row.querySelector('[data-type="subject"]');
        
        const time = (timeEl?.innerText || '').replace(/\n+/g, ' ').trim();
        const subj = (subjEl?.innerText || '').replace(/\n+/g, ' ').trim();
        
        if (time || subj) {
            // Gabungin pake format yang konsisten: "Waktu - Mapel"
            lessonArr.push(`${time || '??.??'} - ${subj || '-'}`);
        }
    });

    let picketArr = [];
    document.querySelectorAll('.picket-pill span').forEach(el => {
        const name = cleanText(el);
        if (name) picketArr.push(name);
    });

    const draftKey = `${day}_${type}`;
    window.dailyDrafts[draftKey] = {
        day_name: day,
        type: type,
        class_id: getEffectiveClassId(),
        uniform: cleanText(document.querySelector('[data-type="uniform"]')) || '-',
        activity: cleanText(document.querySelector('[data-type="activity"]')) || '-',
        notes: cleanText(document.querySelector('[data-type="notes"]')) || '-',
        lessons: lessonArr.join('; '),
        picket: picketArr.join('; ')
    };
};

// ==========================================
// EDIT MODE
// ==========================================
window.toggleDailyEditMode = function () {
    window.isDailyEditing = !window.isDailyEditing;
    const card = document.getElementById('dailyInfoCard');
    if (window.isDailyEditing) {
        window.editingDay = window.currentViewDay;
        card.classList.add('edit-mode-on');
    } else {
        window.dailyDrafts = {};
        window.editingDay = null;
        card.classList.remove('edit-mode-on');
    }
    initDailyCard();
};

function applyEditMode(isActive) {
    // Cek apakah sekarang sedang melihat mode CUSTOM
    const isCustomMode = (window.currentViewDay === 'CUSTOM');

    document.querySelectorAll('.editable-text').forEach(el => {
        let canEditElement = isActive;

        // Logika tambahan: Jika elemen adalah ID lblHari, 
        // dia cuma boleh edit kalau isActive DAN sedang mode CUSTOM
        if (el.id === 'lblHari' && !isCustomMode) {
            canEditElement = false;
        }

        el.contentEditable = canEditElement;
        el.classList.toggle('editable-active', canEditElement);

        // Pasang listener Enter hanya jika elemen memang boleh di-edit
        if (canEditElement) {
            el.addEventListener('keydown', _blockEnterKey);
        } else {
            el.removeEventListener('keydown', _blockEnterKey);
        }
    });

    // Elemen kontrol lainnya (tombol tambah baris & config panel) 
    // tetap muncul selama mode edit aktif
    const btnLesson = document.getElementById('btnAddLesson');
    const btnPicket = document.getElementById('btnAddPicket');
    const configPanel = document.getElementById('dailyConfigPanel');

    if (btnLesson) btnLesson.style.display = isActive ? 'block' : 'none';
    if (btnPicket) btnPicket.style.display = isActive ? 'block' : 'none';
    if (configPanel) configPanel.style.display = isActive ? 'block' : 'none';

    // Set draggable buat drag & drop reorder
    document.querySelectorAll('#timelineList .tl-item-final, #picketList .picket-pill').forEach(el => {
        el.draggable = isActive;
    });
}

// Fungsi terpisah agar removeEventListener bisa tracking referensi yang sama
function _blockEnterKey(e) {
    if (e.key !== 'Enter') return;
    e.preventDefault();
    // Pindah fokus ke field berikutnya supaya UX tetap enak
    const allEditable = [...document.querySelectorAll('.editable-text[contenteditable="true"]')];
    const idx = allEditable.indexOf(e.target);
    if (idx !== -1 && idx < allEditable.length - 1) {
        allEditable[idx + 1].focus();
    }
}

// ==========================================
// SAVE TO DATABASE
// ==========================================
async function saveAllDrafts() {
    const btn = document.querySelector('.action-btn.save');
    if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

    const user = _getDailyUser();
    if (!user) return;
    
    // Pastikan CLASS_ID jadi angka biar gak ribet di DB
    const CLASS_ID = parseInt(getEffectiveClassId() || user.class_id);

    const modeSel = document.getElementById('editModeSelector');
    const activeMode = modeSel ? modeSel.value : (window.currentConfig.mode || 'regular');
    const newTitle = document.getElementById('lblHari').innerText.trim();

    // Simpan draft terakhir sebelum push ke DB
    saveToDraft(window.editingDay, activeMode);
    
    // Ambil semua draft yang ada di memori
    const draftsArray = Object.values(window.dailyDrafts).map(d => ({
        ...d,
        class_id: CLASS_ID
        // JANGAN PAKSA 'type: activeMode' di sini biar gak bentrok kalo user
        // sempet pindah-pindah mode pas lagi edit.
    }));

    const isAuto = document.getElementById('editAutoToggle').checked;
    const currentForced = window.currentConfig.forced_day;
    const newForced = (activeMode === 'custom') ? currentForced : (window.editingDay || currentForced);

    // Ambil pilihan hari kisi-kisi
    const selectedKisiDays = Array.from(document.querySelectorAll('.kisi-day-opt:checked')).map(el => el.value);

    try {
        // 1. Update Config (is_custom tetep diupdate buat fallback/compat)
        const { error: cfgError } = await supabase.from('daily_config').upsert({
            class_id: CLASS_ID,
            is_auto: isAuto,
            is_custom: (activeMode === 'custom'),
            mode: activeMode,
            forced_day: newForced,
            custom_title: (activeMode === 'custom') ? newTitle : (window.currentConfig.custom_title || ''),
            kisi_days: (selectedKisiDays.length > 0) ? selectedKisiDays : ["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]
        });
        if (cfgError) throw cfgError;

        // 2. Upsert Schedules dengan onConflict yang baru (wajib ada type)
        if (draftsArray.length > 0) {
            const { error: upsertError } = await supabase
                .from('daily_schedules')
                .upsert(draftsArray, { onConflict: 'class_id, day_name, type' });
            
            if (upsertError) {
                // Kalo error di sini, kemungkinan besar constraint DB belum diupdate
                if (upsertError.code === '42P10') {
                    throw new Error("SQL_CONSTRAINT_MISSING");
                }
                throw upsertError;
            }
        }

        // 3. Clear Cache & State
        _dcCacheInvalidate(CLASS_ID);
        if (CLASS_ID === 2) _dcCacheInvalidate(2);
        
        window.dailyDrafts = {};
        window.isDailyEditing = false;
        window.editingDay = null;
        window.currentConfig = null; 

        if (typeof showToast === 'function') showToast(`${t('data_saved')}`, 'success');
        
        setTimeout(() => { initDailyCard(); }, 300);

    } catch (err) {
        console.error('Save error:', err);
        let msg = `${t('failed_save')}`;
        if (err.message === "SQL_CONSTRAINT_MISSING") {
            msg =  err;
        }
        if (typeof showPopup === 'function') showPopup(msg, 'error');
        if (btn) btn.innerHTML = '<i class="fa-solid fa-check"></i>';
    }
}

// ==========================================
// ADD / DELETE ROW
// ==========================================
window.deleteItem = function (el) {
    el.parentElement.remove();
    autoSaveDraft();
};

window.addLessonRow = function () {
    const div = document.createElement('div');
    div.className = 'tl-item-final';
    div.innerHTML = `
        <div class="btn-del-inline" style="display:flex;">
            <i class="fa-solid fa-xmark"></i>
        </div>
        <div class="tl-time-final editable-text editable-active"
             contenteditable="true" data-type="time"
             data-placeholder="00.00" oninput="autoSaveDraft()"></div>
        <div class="tl-marker-final"></div>
        <div class="tl-subject-final editable-text editable-active"
             contenteditable="true" data-type="subject"
             data-placeholder="Subject" oninput="autoSaveDraft()"></div>`;

    div.querySelector('.btn-del-inline').onclick = function () { div.remove(); autoSaveDraft(); };
    div.querySelectorAll('.editable-text').forEach(el => el.addEventListener('keydown', _blockEnterKey));
    div.draggable = true;

    document.getElementById('timelineList').appendChild(div);
    autoSaveDraft();
};

window.addPicketRow = function () {
    const div = document.createElement('div');
    div.className = 'picket-pill';
    div.innerHTML = `
        <div class="btn-del-inline" style="display:flex;">
            <i class="fa-solid fa-xmark"></i>
        </div>
        <span class="editable-text editable-active"
              contenteditable="true" data-type="picket"
              data-placeholder="Name" oninput="autoSaveDraft()"></span>`;

    div.querySelector('.btn-del-inline').onclick = function () { div.remove(); autoSaveDraft(); };
    div.querySelector('span').addEventListener('keydown', _blockEnterKey);
    div.draggable = true;

    document.getElementById('picketList').appendChild(div);
    autoSaveDraft();
};

// ── DRAG & DROP REORDER (EDIT MODE) ──
window._dcDragState = null;

function handleDcDragStart(e) {
    const item = e.target.closest('.tl-item-final, .picket-pill');
    if (!item || !window.isDailyEditing) return;
    if (e.target.closest('.btn-del-inline')) return;

    window._dcDragState = { element: item, moved: false };
    item.classList.add('dc-dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
}

function handleDcDragOver(e) {
    if (!window._dcDragState) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';

    const target = e.target.closest('.tl-item-final, .picket-pill');
    if (!target || target === window._dcDragState.element) return;

    window._dcDragState.moved = true;

    const rect = target.getBoundingClientRect();
    const midY = rect.top + rect.height / 2;
    const parent = target.parentElement;

    if (e.clientY < midY) {
        parent.insertBefore(window._dcDragState.element, target);
    } else {
        parent.insertBefore(window._dcDragState.element, target.nextSibling);
    }
}

function handleDcDrop(e) {
    if (!window._dcDragState) return;
    e.preventDefault();
    if (window._dcDragState.moved) autoSaveDraft();
}

function handleDcDragEnd() {
    document.querySelectorAll('.dc-dragging').forEach(el => el.classList.remove('dc-dragging'));
    window._dcDragState = null;
}

// Init drag events sekali (delegation via document)
document.addEventListener('dragstart', handleDcDragStart);
document.addEventListener('dragover', handleDcDragOver);
document.addEventListener('drop', handleDcDrop);
document.addEventListener('dragend', handleDcDragEnd);

// ==========================================
// INIT — Skeleton langsung render, data di-fetch setelahnya
// ==========================================
(function() {
    const container = document.querySelector('.left-section');
    if (!container) return;
    const user = _getDailyUser();
    if (!user || user.class_id === undefined || user.class_id === null) return;
    if (document.getElementById('dailyInfoCard')) return;

    const cardHTML = `
        <div id="dailyInfoCard" class="daily-card-final glass-card-effect">
            <div class="final-header animate-pop-in" id="dcHeader">${_buildHeaderSkeleton()}</div>
            <div id="dcContentFinal" class="final-content">
                ${_buildDailyCardSkeleton()}
            </div>
            <div id="dailyConfigPanel" class="config-panel"></div>
            <div class="final-watermark">v14 dynamic-range-system</div>
        </div>
    `;
    const welcome = document.getElementById('welcomeText');
    if (welcome) welcome.insertAdjacentHTML('afterend', cardHTML);
    else container.innerHTML += cardHTML;
})();

// Data fetching — jalan setelah DOM siap + dikit delay biar ga clash
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(initDailyCard, 300));
} else {
    setTimeout(initDailyCard, 300);
}

// ==========================================
// KEYBOARD SHORTCUTS (ADMIN)
// ==========================================
document.addEventListener('keydown', function (e) {
    // CTRL + / : Buka/Tutup Edit Mode
    if (e.ctrlKey && e.key === '/') {
        e.preventDefault();
        toggleDailyEditMode();
    }

    if (!window.isDailyEditing) return;

    // CTRL + ENTER : Simpan
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        saveAllDrafts();
    }

    // ESC : Batal
    if (e.key === 'Escape') {
        e.preventDefault();
        toggleDailyEditMode();
    }

    // CTRL + . : Tambah Baris Pelajaran
    if (e.ctrlKey && e.key === '.') {
        e.preventDefault();
        addLessonRow();
    }

    // CTRL + , : Tambah Nama Piket
    if (e.ctrlKey && e.key === ',') {
        e.preventDefault();
        addPicketRow();
    }
});

// ==========================================
// PDF / OCR IMPORTER
// ==========================================
window.importScheduleFromText = async function() {
    // Buka file picker langsung buat PDF
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.pdf';
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        showToast(t('reading_pdf'), 'info');

        try {
            if (!window.pdfjsLib) {
                const script = document.createElement('script');
                script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
                document.head.appendChild(script);
                await new Promise(r => script.onload = r);
                pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            }

            const typedarray = new Uint8Array(await file.arrayBuffer());
            const pdf = await pdfjsLib.getDocument(typedarray).promise;
            let fullText = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                let lastY = -1;
                let pageText = '';
                textContent.items.forEach(item => {
                    if (lastY !== -1 && Math.abs(item.transform[5] - lastY) > 5) {
                        pageText += '\n';
                    }
                    pageText += item.str + ' ';
                    lastY = item.transform[5];
                });
                fullText += pageText + '\n';
            }

            window.processScheduleText(fullText);
        } catch (err) {
            console.error('PDF Error:', err);
            showPopup(t('failed_load_data'), 'error');
        }
    };
    input.click();
};

window.processScheduleText = async function(rawText) {
    const classOptions = [
        { label: 'X RPL 1', id: 1, idx: 5 },
        { label: 'X RPL 2', id: 2, idx: 6 },
        { label: 'X RPL 3', id: 3, idx: 7 },
        { label: 'X RPL 4', id: 4, idx: 8 }
    ];

    // Auto-detect kelas user, skip popup kalo cocok
    const userId = getEffectiveClassId ? getEffectiveClassId() : null;
    let target = classOptions.find(c => c.id == userId);

    if (!target) {
        const choice = await showPopup(t('select_class'), 'choice', {
            options: classOptions
        });
        if (!choice) return;
        target = classOptions.find(c => c.label === choice);
    }
    
    const lines = rawText.split('\n');
    let currentDay = 'Senin';
    const dayKeywords = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT'];
    const skipDays = ['SABTU', 'MINGGU'];
    const result = {};

    lines.forEach((line, lineIdx) => {
        const upper = line.toUpperCase().trim();
        if (!upper) return;
        
        // Skip kalo baris Sabtu/Minggu
        if (skipDays.some(d => upper.includes(d))) {
            currentDay = null;
            return;
        }

        const foundDay = dayKeywords.find(d => upper.includes(d));
        if (foundDay) {
            currentDay = foundDay.charAt(0) + foundDay.slice(1).toLowerCase();
            return;
        }

        if (!currentDay) return;

        const timeMatch = line.match(/(\d{2}\.\d{2}[- ]+\d{2}\.\d{2})/);
        if (timeMatch) {
            const parts = line.split(/\s+/).filter(p => p.length > 0);
            const time = timeMatch[0].split(/[- ]+/)[0];
            let subject = parts[target.idx] || '-';
            
            // Ilangin nomor guru di depan (misal "21Jepang" → "Jepang")
            subject = subject.replace(/^\d+/, '').trim();
            
            if (!result[currentDay]) result[currentDay] = [];
            if (subject && subject !== '-' && !subject.includes('ISTIRAHAT')) {
                result[currentDay].push(`${time} - ${subject}`);
            }
        }
    });

    Object.keys(result).forEach(day => {
        const draftKey = `${day}_regular`;
        window.dailyDrafts[draftKey] = {
            day_name: day,
            type: 'regular',
            class_id: target.id,
            uniform: '-', activity: 'KBM Normal', notes: '-',
            lessons: result[day].join('; '),
            picket: ''
        };
    });

    // Kalo ada hari Senin-Jumat yang kosong, isi dummy biar muncul di edit mode
    const allWeekdays = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];
    allWeekdays.forEach(day => {
        const key = `${day}_regular`;
        if (!window.dailyDrafts[key]) {
            window.dailyDrafts[key] = {
                day_name: day,
                type: 'regular',
                class_id: target.id,
                uniform: '-', activity: 'KBM Normal', notes: '-',
                lessons: '',
                picket: ''
            };
        }
    });

    if (typeof showToast === 'function') showToast(t('import_success'), 'success');

    // Auto masuk edit mode & tampilkan hari pertama yang terisi
    const firstDay = Object.keys(result)[0];
    if (firstDay) {
        window.isDailyEditing = true;
        window.editingDay = firstDay;
        document.getElementById('dailyInfoCard')?.classList.add('edit-mode-on');
    }
    initDailyCard();
};
