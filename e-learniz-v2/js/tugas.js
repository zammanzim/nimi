// File: js/tugas.js
document.addEventListener('DOMContentLoaded', initTugas);

let allTasks = [];
let doneIds = [];
let deadlineSubjects = [];
let currentFilter = 'pending';
let currentMapel = 'all'; // filter mapel aktif
let _isAdminUser = false;
let subjectNameMap = {}; // { subject_id → subject_name }

// ==========================================
// CACHE HELPERS
// ==========================================
const TUGAS_CACHE_TTL_TASKS = 5 * 60 * 1000; // 5 menit — list tugas
const TUGAS_CACHE_TTL_DONE = 2 * 60 * 1000; // 2 menit — progress user
const TUGAS_CACHE_TTL_SCHED = 30 * 60 * 1000; // 30 menit — jadwal deadline
const TUGAS_CACHE_TTL_RANK = 2 * 60 * 1000; // 2 menit — rank

function _tugasCacheGet(key, ttl) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const { data, ts } = JSON.parse(raw);
        if (Date.now() - ts > ttl) return null; // expired
        return data;
    } catch (e) { return null; }
}

function _tugasCacheSet(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch (e) { /* storage penuh, skip */ }
}

function _tugasCacheInvalidate(userId, classId) {
    try {
        if (userId) localStorage.removeItem(`tugas_done_${userId}`);
        if (userId) localStorage.removeItem(`tugas_rank_${userId}`);
        if (classId) localStorage.removeItem(`tugas_tasks_${classId}`);
    } catch (e) { }
}

// Fungsi Normalisasi: Hapus spasi & tanda baca (biar "B. Inggris" == "binggris")
function normalize(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

async function initTugas() {
    let user;
    try {
        user = JSON.parse(localStorage.getItem("user"));
    } catch (e) { user = null; }
    if (!user) { window.location.href = 'index'; return; }

    // Reset flag admin untuk renderTasks
    _isAdminUser = (user.role === 'class_admin' || user.role === 'super_admin');

    // Reset SubjectApp state biar gak carry-over dari page sebelumnya
    SubjectApp.state.editMode = false;
    SubjectApp.state.isToggling = false;
    SubjectApp.tempFiles = [];
    SubjectApp.state.announcements = [];
    SubjectApp.state.completedTasks = [];

    // Init SubjectApp in 'tugas' mode
    SubjectApp.state.subjectId = 'tugas';
    SubjectApp.state.subjectName = t('task_list');
    SubjectApp.state.isLessonMode = true;
    SubjectApp.state.user = user;
    SubjectApp.setupAdminControls();
    SubjectApp.initAdd();
    SubjectApp.setupEventListeners();
    SubjectApp.setupShortcuts();

    // Set Profil di Card
    document.getElementById('userTaskName').innerText = user.nickname;
    document.getElementById('userTaskPP').src = user.avatar_url || '../icons/profpicture.png';

    try {
        // 1. Tentukan Hari Target Deadline (Logika jam 15:00)
        const now = new Date();
        const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        let targetDayName = days[now.getDay()];

        if (now.getHours() >= 15) {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            targetDayName = days[tomorrow.getDay()];
        }

        const classId = getEffectiveClassId();

        // ── Tentukan tipe jadwal aktif (regular/exam/custom) ─────────
        // daily_schedules bisa punya jadwal ganda per hari (mis. class 2:
        // regular + exam). Ambil mode dari daily_config biar query spesifik.
        const MASTER_CLASS_ID = 2;
        let activeType = 'regular';
        let scheduleClassId = classId;
        try {
            const { data: cfg } = await supabase.from('daily_config')
                .select('mode').eq('class_id', classId).maybeSingle();
            if (cfg?.mode) activeType = cfg.mode;
            if (String(classId) !== String(MASTER_CLASS_ID)) {
                const { data: masterCfg } = await supabase.from('daily_config')
                    .select('mode').eq('class_id', MASTER_CLASS_ID).maybeSingle();
                if (masterCfg?.mode === 'exam') {
                    scheduleClassId = String(MASTER_CLASS_ID);
                    activeType = 'exam';
                }
            }
        } catch (e) { /* fallback regular */ }

        const schedCacheKey = `tugas_sched_${scheduleClassId}_${targetDayName}_${activeType}`;
        const tasksCacheKey = `tugas_tasks_${classId}`;
        const doneCacheKey = `tugas_done_${user.id}`;
        const rankCacheKey = `tugas_rank_${user.id}`;

        // ── Fetch subject names (sekali, ringan) ─────────────────────
        if (Object.keys(subjectNameMap).length === 0) {
            supabase.from('subjects_config')
                .select('subject_id, subject_name')
                .eq('class_id', classId)
                .then(({ data }) => {
                    if (data) data.forEach(s => { subjectNameMap[s.subject_id] = s.subject_name; });
                    buildMapelFilter(); // rebuild chips dengan nama yang bener
                }).catch(() => { });
        }

        // ── 2. JADWAL DEADLINE (cache 30 menit) ──────────────────────
        const cachedSched = _tugasCacheGet(schedCacheKey, TUGAS_CACHE_TTL_SCHED);
        if (cachedSched !== null) {
            deadlineSubjects = cachedSched;
            // Refresh di background
            supabase.from('daily_schedules').select('lessons')
                .eq('class_id', scheduleClassId).eq('day_name', targetDayName).eq('type', activeType).single()
                .then(({ data }) => {
                    if (data?.lessons) {
                        const fresh = _parseDeadlineSubjects(data.lessons);
                        _tugasCacheSet(schedCacheKey, fresh);
                    }
                }).catch(() => { });
        } else {
            const { data: sched } = await supabase
                .from('daily_schedules').select('lessons')
                .eq('class_id', scheduleClassId).eq('day_name', targetDayName).eq('type', activeType).single();
            if (sched?.lessons) {
                deadlineSubjects = _parseDeadlineSubjects(sched.lessons);
                _tugasCacheSet(schedCacheKey, deadlineSubjects);
            }
        }

        // ── 3. TASKS + DONE — coba dari cache dulu, render langsung ──
        const cachedTasks = _tugasCacheGet(tasksCacheKey, TUGAS_CACHE_TTL_TASKS);
        const cachedDone = _tugasCacheGet(doneCacheKey, TUGAS_CACHE_TTL_DONE);

        if (cachedTasks !== null && cachedDone !== null) {
            // Tampilkan cache LANGSUNG biar kelihatan cepat
            allTasks = cachedTasks;
            SubjectApp.state.announcements = allTasks; // Sync with SubjectApp
            const validIds = allTasks.map(t => String(t.id));
            // Task is_done=true → otomatis selesai meski progress row sudah dihapus
            const cachedArchived = allTasks.filter(t => t.is_done).map(t => String(t.id));
            const cachedProgress = cachedDone.filter(id => validIds.includes(id));
            doneIds = [...new Set([...cachedArchived, ...cachedProgress])];
            SubjectApp.state.completedTasks = doneIds; // Sync with SubjectApp

            // Coba pakai rank dari cache juga
            const cachedRank = _tugasCacheGet(rankCacheKey, TUGAS_CACHE_TTL_RANK);
            window._taskRankPercent = cachedRank ?? 0;

            updateProgressUI();
            applyCurrentFilter();
            buildMapelFilter();

            // Fetch fresh di background (stale-while-revalidate)
            _fetchTugasFresh({ user, classId, tasksCacheKey, doneCacheKey, rankCacheKey });
        } else {
            // Tidak ada cache — fetch langsung (first load / expired)
            await _fetchTugasFresh({ user, classId, tasksCacheKey, doneCacheKey, rankCacheKey, render: true });
        }
    } catch (e) {
        console.error("Load tugas gagal:", e);
    }
}

// ── Helper: parse lessons string → deadlineSubjects array ────────
function _parseDeadlineSubjects(lessons) {
    // Format DB: "07.00-08.00 - PPK; 08.00-09.00 - PP" → split pakai ";"
    // Sama kayak daily-card.js: lastIndexOf("-") untuk ambil nama subject-nya
    return lessons.split(';')
        .map(item => {
            const trimmed = item.trim();
            if (!trimmed) return '';
            const dashIdx = trimmed.lastIndexOf('-');
            const subject = dashIdx !== -1 ? trimmed.substring(dashIdx + 1).trim() : trimmed;
            return normalize(subject);
        })
        .filter(s => s.length > 0);
}

// ── Helper: fetch fresh dari DB, update cache & UI ───────────────
async function _fetchTugasFresh({ user, classId, tasksCacheKey, doneCacheKey, rankCacheKey, render = false }) {
    try {
        const academicYear = await getAcademicYear(classId);
        const [{ data: tasks, error: err1 }, { data: progress, error: err2 }] = await Promise.all([
            supabase.from('subject_announcements')
                .select('*')
                .eq('class_id', classId)
                .eq('academic_year', academicYear)
                .or('is_lesson.eq.true,is_task.eq.true')
                .order('is_pinned', { ascending: false })
                .order('created_at', { ascending: false }),
            supabase.from('user_progress')
                .select('announcement_id')
                .eq('user_id', user.id)
        ]);

        if (err1 || err2) throw (err1 || err2);

        const freshTasks = tasks || [];
        const validIds = freshTasks.map(t => String(t.id));

        // Task yang is_done=true → otomatis selesai untuk siswa ini,
        // meskipun user_progress sudah dihapus oleh trigger DB
        const archivedIds = freshTasks.filter(t => t.is_done).map(t => String(t.id));
        const progressIds = (progress || [])
            .map(p => String(p.announcement_id))
            .filter(id => validIds.includes(id));
        const freshDone = [...new Set([...archivedIds, ...progressIds])];

        // Simpan ke cache
        _tugasCacheSet(tasksCacheKey, freshTasks);
        _tugasCacheSet(doneCacheKey, freshDone);

        // Update global state
        allTasks = freshTasks;
        SubjectApp.state.announcements = allTasks; // Sync with SubjectApp
        doneIds = freshDone;
        SubjectApp.state.completedTasks = freshDone; // Sync with SubjectApp

        // Rank
        if (validIds.length > 0) {
            const { data: rankData } = await supabase.rpc('get_task_rank', {
                p_user_id: String(user.id),
                p_task_ids: validIds
            });
            const rank = rankData ?? 0;
            window._taskRankPercent = rank;
            _tugasCacheSet(rankCacheKey, rank);
        } else {
            window._taskRankPercent = 0;
            _tugasCacheSet(rankCacheKey, 0);
        }

        // Kalau render = false (background refresh), cukup update UI kalau ada perubahan
        updateProgressUI();
        applyCurrentFilter();
        buildMapelFilter(); // rebuild chips kalau task list berubah
    } catch (e) {
        if (render) console.error("Fetch tugas gagal:", e);
        // Kalau background fetch gagal, diam saja (sudah ada cache di layar)
    }
}

function updateProgressUI() {
    const archivedTasks = allTasks.filter(t => t.is_done);
    const activeTasks = allTasks.filter(t => !t.is_done);
    const archivedCount = archivedTasks.length;
    const activeTotal = activeTasks.length;

    // Hanya hitung done dari task yang belum diarsipkan
    const activeDone = doneIds.filter(id =>
        activeTasks.some(t => String(t.id) === String(id))
    ).length;

    const percent = activeTotal > 0 ? Math.round((activeDone / activeTotal) * 100) : 0;

    const countEl = document.getElementById('userTaskCount');
    const barEl = document.getElementById('userTaskBar');
    const centerEl = document.getElementById('taskProgressCenter');
    const motivEl = document.getElementById('taskMotivation');

    let grad = '', themeColor = '';
    if (percent === 100) { grad = 'linear-gradient(90deg, var(--accent, #00eaff), #007bff)'; themeColor = 'var(--accent, #00eaff)'; }
    else if (percent >= 70) { grad = 'linear-gradient(90deg, #0be881, #05c46b)'; themeColor = '#0be881'; }
    else if (percent >= 30) { grad = 'linear-gradient(90deg, #ff8c00, #ffd700)'; themeColor = '#ff8c00'; }
    else { grad = 'linear-gradient(90deg, #ff4757, #ff6b81)'; themeColor = '#ff4757'; }

    if (countEl) {
        let txt = `${activeDone}/${activeTotal} (${percent}%)`;
        if (archivedCount > 0) txt += ` · ${archivedCount} ${t('archived')}`;
        countEl.innerText = txt;
        countEl.style.color = themeColor;
    }
    if (barEl) {
        barEl.style.width = percent + "%";
        barEl.style.background = grad;
    }
    if (centerEl) {
        let txt = t('youvedone', {
            done: activeDone,
            total: activeTotal
        });
        if (archivedCount > 0) txt += ` · ${archivedCount} ${t('archived')}`;
        centerEl.innerText = txt;
    }
}

function renderTasks(data) {
    const container = document.getElementById('taskList');
    if (!container) return;

    if (data.length === 0) {
        const isEmptyPending = currentFilter === 'pending';
        const emptyState = document.createElement("div");
        emptyState.className = isEmptyPending ? "empty-state success" : "empty-state";

        if (isEmptyPending) {
            emptyState.innerHTML = `
                <i class="fa-solid fa-circle-check"></i>
                <p>${t('all_tasks_done')}</p>
            `;
        } else {
            emptyState.innerHTML = `
                <i class="fa-solid fa-clipboard-list"></i>
                <p>${t('no_tasks')}</p>
            `;
        }

        container.replaceChildren(emptyState);
        return;
    }

    const total = allTasks.length;
    const fragment = document.createDocumentFragment();

    data.forEach((item) => {
        const isDone = doneIds.includes(String(item.id));
        const isDeadline = !isDone && deadlineSubjects.some(s => {
            const normSubject = normalize(item.subject_id);
            const normTitle = normalize(item.big_title);
            const subOk = normSubject === s ||
                (normSubject.length >= 3 && s.includes(normSubject)) ||
                (s.length >= 3 && normSubject.includes(s));
            const titleOk = (s.length >= 3 && normTitle.includes(s)) ||
                (normTitle.length >= 3 && s.includes(normTitle));
            return subOk || titleOk;
        });

        const autoNumber = total - allTasks.indexOf(item);
        let statusClass = isDone ? 'task-green-done' : (isDeadline ? 'task-red-deadline' : 'task-yellow-pending');

        const card = SubjectApp.createCardElement(item, {
            statusClass: statusClass,
            autoNumber: autoNumber
        });

        // RE-APPLY EDIT MODE JIKA SEDANG AKTIF
        if (SubjectApp.state.editMode) {
            card.classList.add("editable-mode");
            card.querySelectorAll(".editable").forEach(f => {
                f.contentEditable = "true";
                f.style.pointerEvents = "auto";
                f.style.cursor = "text";
            });
            const deleteBtn = card.querySelector(".delete-btn");
            const colorTools = card.querySelector(".card-color-tools");
            const cameraBtn = card.querySelector(".camera-btn");
            const deletePhotoBtns = card.querySelectorAll(".delete-photo-btn");

            if (deleteBtn) deleteBtn.style.display = "inline-block";
            if (colorTools) colorTools.style.display = "flex";
            if (cameraBtn) cameraBtn.style.display = "flex";
            deletePhotoBtns.forEach(b => b.style.display = "flex");
        }

        fragment.appendChild(card);
    });

    container.replaceChildren(fragment);
}

// REMOVED: toggleStatus, deleteTugas, _checkAndArchiveTask (now in SubjectApp)


// ── MAPEL FILTER ─────────────────────────────────────────────────
function buildMapelFilter() {
    const wrap = document.getElementById('mapelFilterWrap');
    const chips = document.getElementById('mapelFilterChips');
    if (!wrap || !chips) return;

    const mapels = [...new Set(allTasks.map(t => t.subject_id))].sort();

    if (mapels.length <= 1) {
        wrap.style.display = 'none';
        return;
    }

    wrap.style.display = 'block';

    chips.innerHTML = `
        <div class="mapel-chip-tugas active" data-mapel="all" onclick="filterMapel('all', this)">
            <i class="fa-solid fa-layer-group" style="font-size:10px;"></i> ${t('all')}
        </div>
        ${mapels.map(id => {
        const translatedName = t(id);
        const nama = translatedName !== id ? translatedName : (subjectNameMap[id] || id);
        const safeId = id.replace(/'/g, "\\'"); // escape single quote dalam id
        return `<div class="mapel-chip-tugas" data-mapel="${id}" onclick="filterMapel('${safeId}', this)">${nama}</div>`;
    }).join('')}
    `;

    // Restore active state kalau ada filter aktif
    if (currentMapel !== 'all') {
        const activeChip = chips.querySelector(`[data-mapel="${currentMapel}"]`);
        if (activeChip) {
            chips.querySelector('[data-mapel="all"]').classList.remove('active');
            activeChip.classList.add('active');
        } else {
            currentMapel = 'all';
        }
    }
}

function filterMapel(mapel, chip) {
    currentMapel = mapel;
    document.querySelectorAll('.mapel-chip-tugas').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    applyCurrentFilter();
}

function applyCurrentFilter() {
    // Terapkan filter mapel dulu ke pool task yang relevan
    const byMapel = currentMapel === 'all'
        ? allTasks
        : allTasks.filter(t => t.subject_id === currentMapel);

    if (currentFilter === 'pending') {
        const filtered = byMapel.filter(t => !doneIds.includes(String(t.id)));

        // Urutkan: Pinned dulu, Deadline (merah), baru Pending (kuning)
        filtered.sort((a, b) => {
            if (a.is_pinned && !b.is_pinned) return -1;
            if (!a.is_pinned && b.is_pinned) return 1;
            const aIsDeadline = deadlineSubjects.some(s => {
                const normSubject = normalize(a.subject_id);
                const normTitle = normalize(a.big_title);
                const subOk = normSubject === s ||
                    (normSubject.length >= 3 && s.includes(normSubject)) ||
                    (s.length >= 3 && normSubject.includes(s));
                const titleOk = (s.length >= 3 && normTitle.includes(s)) ||
                    (normTitle.length >= 3 && s.includes(normTitle));
                return subOk || titleOk;
            });
            const bIsDeadline = deadlineSubjects.some(s => {
                const normSubject = normalize(b.subject_id);
                const normTitle = normalize(b.big_title);
                const subOk = normSubject === s ||
                    (normSubject.length >= 3 && s.includes(normSubject)) ||
                    (s.length >= 3 && normSubject.includes(s));
                const titleOk = (s.length >= 3 && normTitle.includes(s)) ||
                    (normTitle.length >= 3 && s.includes(normTitle));
                return subOk || titleOk;
            });

            if (aIsDeadline && !bIsDeadline) return -1;
            if (!aIsDeadline && bIsDeadline) return 1;
            return 0;
        });

        renderTasks(filtered);
    } else {
        renderTasks(byMapel);
    }
}

function filterTasks(type, btn) {
    currentFilter = type;
    const wrapper = document.getElementById('taskFilters');
    const buttons = document.querySelectorAll('.filter-btn-new');
    buttons.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    if (type === 'all') wrapper.classList.add('all-active');
    else wrapper.classList.remove('all-active');

    applyCurrentFilter();
}

// ── DETAIL OVERLAY: klik area kosong → tutup ─────────────────────
document.addEventListener('DOMContentLoaded', () => {
    const detailOverlay = document.getElementById('detailOverlay');
    if (detailOverlay) {
        detailOverlay.onclick = (e) => {
            if (e.target === detailOverlay) {
                if (typeof closeDetail === 'function') closeDetail();
            }
        };
    }
});

// REMOVED: old shortcut and click-outside logic as SubjectApp handles it