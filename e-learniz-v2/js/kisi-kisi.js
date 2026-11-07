// ============================================================
// kisi-kisi.js — Kisi-Kisi
// Hooks into SubjectApp (subject-manager.js) for admin/modal,
// but overrides renderAnnouncements with day-grouped logic.
// ============================================================

let PSTS_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat']; // Default
let kisiScheduleMap = {};  // { Senin: ['bindonesia', 'mtk', ...], ... }
let kisiFilter = 'all';    // currently selected subject filter

// Kata-kata yang bukan nama pelajaran, di-skip dari schedule (mapping kisi-kisi)
const KISI_BLACKLIST = [
    'istirahat', 'upacara', 'senampagi', 'senam', 'pulang', 'sholat', 
    'shalat', 'jumatan', 'makan', 'ishoma', 'ekskul', 'pembiasaan', 
    'literasi', 'bersih', 'piket', 'dhuha', 'dzuhur', 'duhur', 'ashar',
    'masuk', 'apel', 'persiapkan', 'cektugas',
];

function _kisiNorm(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

/**
 * "Kisi - Kisi Bahasa Indonesia"  →  "Bahasa Indonesia"
 * Falls back to the full title if no pattern matches.
 */
function _extractSubject(bigTitle) {
    if (!bigTitle) return '';
    const m = bigTitle.match(/kisi\s*[-–—]\s*kisi\s+(.+)/i);
    return m ? m[1].trim() : bigTitle.trim();
}

/**
 * Returns PSTS_DAYS reordered so today (or tomorrow if >=15:00) is first.
 * Past days are pushed to the end, weekend defaults to Senin first.
 */
function _getDayOrder() {
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const now = new Date();
    let todayName = dayNames[now.getDay()];
    if (now.getHours() >= 15) {
        const tom = new Date(now);
        tom.setDate(now.getDate() + 1);
        todayName = dayNames[tom.getDay()];
    }
    const idx = PSTS_DAYS.indexOf(todayName);
    if (idx === -1) return [...PSTS_DAYS]; // weekend -> default order
    return [...PSTS_DAYS.slice(idx), ...PSTS_DAYS.slice(0, idx)];
}

/**
 * Returns which PSTS day this kisi item belongs to,
 * by matching the extracted subject against scheduleMap.
 */
function _getDayForItem(item) {
    const subject = _kisiNorm(_extractSubject(item.big_title || ''));
    if (subject.length < 2) return null;
    for (const day of PSTS_DAYS) {
        const dayData = kisiScheduleMap[day];
        const dayLessons = (dayData && dayData.lessons) || [];
        if (dayLessons.some(s => s.norm.length > 1 && (subject.includes(s.norm) || s.norm.includes(subject)))) {
            return day;
        }
    }
    return null;
}

// ── Refresh Logic ──────────────────────────────────────────────

window.refreshKisiData = function() {
    const user = JSON.parse(localStorage.getItem('user'));
    if (user) {
        // Hapus semua cache announcements kisi-kisi (format baru: `announcements_kisi-kisi_<class>_<tahun>` + format lama)
        Object.keys(localStorage).forEach(k => {
            if (k === 'announcements_kisi-kisi' || k.startsWith('announcements_kisi-kisi_')) {
                localStorage.removeItem(k);
            }
        });
        
        // Hapus juga cache schedule biar dapet yang paling fresh
        const MASTER_CLASS_ID = 2;
        const USER_CLASS_ID = getEffectiveClassId() || user.class_id;
        
        const days = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
        days.forEach(d => {
            localStorage.removeItem(`dc_sched_${USER_CLASS_ID}_${d}_exam`);
            localStorage.removeItem(`dc_sched_${MASTER_CLASS_ID}_${d}_exam`);
        });
        localStorage.removeItem(`dc_config_${USER_CLASS_ID}`);
        localStorage.removeItem(`dc_config_${MASTER_CLASS_ID}`);
    }
    showToast(t('refreshing_cache'), "info");
    setTimeout(() => location.reload(), 500);
};

// ── Main Render ───────────────────────────────────────────────

window.renderKisiList = function () {
    const items = SubjectApp.state.announcements;
    const container = document.getElementById('announcements');
    if (!container) return;
    container.innerHTML = '';

    // ── Subject filter dropdown ──────────────────────────────
    // Subjects yang PUNYA kisi-kisi
    const availableSubjects = new Set(
        items.map(k => _kisiNorm(_extractSubject(k.big_title || ''))).filter(Boolean)
    );

    // Semua pelajaran dari jadwal, dikumpulkan unik
    const allScheduledSubjects = [];
    const seenNorm = new Set();
    PSTS_DAYS.forEach(day => {
        const dayData = kisiScheduleMap[day];
        const dayLessons = (dayData && dayData.lessons) || [];
        
        dayLessons.forEach(entry => {
            if (!seenNorm.has(entry.norm) && entry.norm.length > 1) {
                seenNorm.add(entry.norm);
                const matchedItem = items.find(k => _kisiNorm(_extractSubject(k.big_title || '')) === entry.norm);
                const displayName = matchedItem ? _extractSubject(matchedItem.big_title) : entry.display;
                allScheduledSubjects.push({ norm: entry.norm, display: displayName, hasKisi: availableSubjects.has(entry.norm) });
            }
        });
    });

    // Tambahkan pelajaran yang punya kisi-kisi tapi tidak ada di jadwal
    items.forEach(k => {
        const norm = _kisiNorm(_extractSubject(k.big_title || ''));
        if (norm && !seenNorm.has(norm)) {
            seenNorm.add(norm);
            allScheduledSubjects.push({ norm, display: _extractSubject(k.big_title), hasKisi: true });
        }
    });

    const optionsHTML = allScheduledSubjects.map(s => {
        // TRANSLASI MAPEL DI DROPDOWN
        const translatedDisplay = t(s.norm) !== s.norm ? t(s.norm) : s.display;
        if (s.hasKisi) {
            return `<option value="${s.norm}">${translatedDisplay}</option>`;
        } else {
            return `<option value="${s.norm}" disabled style="color:rgba(255,255,255,0.3);">${translatedDisplay} ${t('not_yet_available')}</option>`;
        }
    }).join('');

    const simulasiBtn = kisiFilter !== 'all' 
        ? `<button onclick="window.location.href='quiz?id=${kisiFilter}'" style="background:linear-gradient(45deg, #00eaff, #0084ff); border:none; color:black; padding:8px 18px; border-radius:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px; font-weight:bold; box-shadow:0 0 15px rgba(0,234,255,0.3);">
            <i class="fa-solid fa-graduation-cap"></i> ${t('simulation')}
           </button>`
        : '';

    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:22px; flex-wrap:wrap;';
    filterBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:200px;">
            <i class="fa-solid fa-filter" style="color:var(--accent, #00eaff); font-size:14px;"></i> ${t('choose_lesson')}
            <select id="kisiSubjectFilter"
                onchange="kisiFilter = this.value; renderKisiList();"
                style="flex:1; background:rgba(255,255,255,0.08); color:white;
                    border:1px solid rgba(0, 234, 255, 0.3); padding:9px 15px;
                    border-radius:20px; font-size:13px; outline:none; cursor:pointer;
                    appearance:none; -webkit-appearance:none;">
                <option value="all">${t('all_lessons')}</option>
                ${optionsHTML}
            </select>
        </div>
        ${simulasiBtn}
        <button onclick="window.refreshKisiData()" style="background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.2); color:white; padding:8px 15px; border-radius:20px; font-size:12px; cursor:pointer; display:flex; align-items:center; gap:6px;">
            <i class="fa-solid fa-sync"></i> ${t('refresh')}
        </button>
    `;
    container.appendChild(filterBar);

    // ── Filter items ─────────────────────────────────────────
    const filtered = kisiFilter === 'all'
        ? items
        : items.filter(k => _kisiNorm(_extractSubject(k.big_title || '')) === kisiFilter);

    // ── Group by day ─────────────────────────────────────────
    const grouped = {};
    const unassigned = [];
    filtered.forEach(item => {
        const day = _getDayForItem(item);
        if (day) {
            if (!grouped[day]) grouped[day] = [];
            grouped[day].push(item);
        } else {
            unassigned.push(item);
        }
    });

    const dayOrder = _getDayOrder();
    const todayInOrder = dayOrder[0];

    // ── Render each day section ──────────────────────────────
    let renderedCount = 0;
    dayOrder.forEach(function (day) {
        const dayItems = grouped[day] || [];
        if (kisiFilter !== 'all' && dayItems.length === 0) return;

        const isToday = day === todayInOrder;
        const isFirst = renderedCount === 0;

        const divEl = document.createElement('div');
        divEl.style.cssText = 'margin:' + (isFirst ? '4px' : '36px') + ' 0 16px;';

        const todayBadge = isToday
            ? `<span style="font-size:11px; background:rgba(0, 234, 255, 0.15); border:1px solid rgba(0, 234, 255, 0.5); border-radius:12px; padding:2px 10px; margin-left:10px; vertical-align:middle; font-weight:700; letter-spacing:1px;">${t('today')}</span>`
            : '';

        const lineColor = isToday
            ? 'linear-gradient(to right, rgba(0, 234, 255, 0.6), transparent)'
            : 'linear-gradient(to right, rgba(255,255,255,0.2), transparent)';

        const textColor = isToday ? 'var(--accent, #00eaff)' : 'rgba(255,255,255,0.7)';
        const textShadow = isToday ? 'text-shadow: 0 0 16px rgba(0, 234, 255, 0.6);' : '';
        const fontSize = isToday ? '22px' : '18px';

        divEl.innerHTML =
            '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
            '<span style="font-size:' + fontSize + '; font-weight:900; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; color:' + textColor + '; ' + textShadow + '">'
            + t(day.toLowerCase()) + todayBadge +
            '</span>' +
            '<div style="flex:1; height:2px; border-radius:2px; background:' + lineColor + ';"></div>' +
            '</div>';

        container.appendChild(divEl);

        if (dayItems.length === 0) {
            const emptyEl = document.createElement('p');
            emptyEl.style.cssText = 'color:rgba(255, 255, 255, 0.5); font-size:1rem; margin:4px 0 0; padding-left:2px; font-style:italic;';
            emptyEl.textContent = `${t('no_kisi')}`;
            container.appendChild(emptyEl);
        } else {
            dayItems.forEach(function (item) {
                // JANGAN translasi judul di sini biar pas di-save gak ngerusak data asli
                const card = SubjectApp.createCardElement(item);
                card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
                container.appendChild(card);
            });
        }
        renderedCount++;
    });

    // ── Unassigned items ────
    if (unassigned.length > 0) {
        const uDivEl = document.createElement('div');
        uDivEl.style.cssText = 'display:flex; align-items:center; gap:12px; margin:' + (renderedCount > 0 ? '28px' : '0') + ' 0 14px;';
        uDivEl.innerHTML =
            `<span style="font-size:13px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; color:#ffd700;">${t('other')}</span>` +
            '<div style="flex:1; height:1px; background:linear-gradient(to right, rgba(255,215,0,0.4), transparent);"></div>';
        container.appendChild(uDivEl);
        unassigned.forEach(function (item) {
            // CLONE ITEM untuk display translasinya
            const displayItem = { ...item };
            const rawSubject = _extractSubject(item.big_title);
            const normSubject = _kisiNorm(rawSubject);
            
            // TRANSLASI MAPEL DI CARD (UNASSIGNED)
            const translatedSubject = t(normSubject) !== normSubject ? t(normSubject) : rawSubject;
            displayItem.big_title = t('kisi_format', { subject: translatedSubject });

            const card = SubjectApp.createCardElement(displayItem);
            card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
            container.appendChild(card);
        });
    }

    const sel = document.getElementById('kisiSubjectFilter');
    if (sel) sel.value = kisiFilter;
    _renderKisiInfoList(SubjectApp.state.announcements);
};

function _renderKisiInfoList(items) {
    const infoBox = document.getElementById('kisiInfoList');
    const headerEl = document.getElementById('kisiHeader');
    if (!infoBox || !headerEl) return;

    // --- 1. LOGIC WAKTU (Ikut Daily Card) ---
    const now = new Date();
    const dayNamesInternal = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    let todayName = dayNamesInternal[now.getDay()];
    let targetDay = todayName;
    let labelWaktu = t('today');

    if (now.getHours() >= 15) {
        const tom = new Date(now);
        tom.setDate(now.getDate() + 1);
        targetDay = dayNamesInternal[tom.getDay()];
        labelWaktu = t('tomorrow');
    }

    // --- 2. LOGIC TANGGAL DINAMIS (Support i18n Bulan) ---
    const monthKeyMap = [
        'january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'
    ];
    const dayNum = now.getDate();
    const monthName = t(monthKeyMap[now.getMonth()]);
    const yearNum = now.getFullYear();
    const fullDate = `${dayNum} ${monthName} ${yearNum}`;

    // --- 3. RENDER HEADER ---
    const simShortcutHTML = `
        <div class="task-shortcut-box sim-shortcut-glow" onclick="window.location.href='quiz'" style="margin-right:8px;">
            <i class="fa-solid fa-graduation-cap"></i>
            <span>${t('exam_simulation')}</span>
        </div>`;

    headerEl.innerHTML = `
        <div>
            <span class="final-badge bg-cyan" id="lblKisiBadge">${labelWaktu}</span>
            <h2 class="final-day">${t(targetDay.toLowerCase())}</h2>
            <small class="final-date" style="font-size: 0.75rem; opacity: 0.7;">${fullDate}</small>
        </div>
        <div class="header-right-group">
            ${simShortcutHTML}
            <div class="task-shortcut-box" onclick="window.location.href='../'">
                <i class="fa-solid fa-house"></i>
                <span>${t('home')}</span>
            </div>
        </div>
    `;

    // Update Card Data-Day for automatic colors
    const cardEl = document.getElementById('kisiDailyCard');
    if (cardEl) cardEl.dataset.day = targetDay;

    // --- 4. RENDER DAY LIST ---
    const hasKisiSet = new Set(
        (items || []).map(k => _kisiNorm(_extractSubject(k.big_title || ''))).filter(Boolean)
    );

    const dayOrder = _getDayOrder();
    let listHTML = '';

    dayOrder.forEach(function (day) {
        const sched = kisiScheduleMap[day];
        if (!sched || !sched.lessons || sched.lessons.length === 0) return;

        const isTarget = (day === targetDay);
        
        listHTML += `<div style="margin-bottom: 20px; ${!isTarget ? 'opacity: 0.7;' : ''}">`;
        listHTML += `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                <div style="font-size:11px; font-weight:900; letter-spacing:1px; text-transform:uppercase; color:${isTarget ? 'var(--accent, #00eaff)' : 'rgba(255,255,255,0.5)'};">
                    ${t(day.toLowerCase())} ${isTarget ? ' <i class="fa-solid fa-star" style="font-size:9px;"></i>' : ''}
                </div>
                <div style="flex:1; height:1px; background:rgba(255,255,255,${isTarget ? '0.2' : '0.1'});"></div>
            </div>
        `;
        
        listHTML += '<div style="display:flex; flex-direction:column; gap:6px;">';

        sched.lessons.forEach(function (entry) {
            const hasKisi = hasKisiSet.has(entry.norm);
            const matchedItem = (items || []).find(k => _kisiNorm(_extractSubject(k.big_title || '')) === entry.norm);
            const subjectName = matchedItem ? _extractSubject(matchedItem.big_title) : entry.display;
            
            // TRANSLASI PELAJARAN DI SIDEBAR
            const translatedSubject = t(entry.norm) !== entry.norm ? t(entry.norm) : subjectName;

            if (hasKisi) {
                const normSubject = entry.norm;
                const activeStyle = kisiFilter === normSubject ? 'background:rgba(0, 234, 255, 0.15); border-color:rgba(0, 234, 255, 0.4);' : '';
                
                listHTML += `<div onclick="kisiFilter='${normSubject}'; renderKisiList(); document.querySelector('.right-section').scrollIntoView({behavior:'smooth'});"
                    style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,255,255,0.06); border-radius:12px; cursor:pointer; border:1px solid rgba(255,255,255,0.08); transition:all 0.2s; ${activeStyle}"
                    onmouseover="this.style.background='rgba(0, 234, 255, 0.1)'; this.style.borderColor='rgba(0, 234, 255, 0.3)'"
                    onmouseout="this.style.background='${kisiFilter === normSubject ? 'rgba(0, 234, 255, 0.15)' : 'rgba(255,255,255,0.06)'}'; this.style.borderColor='${kisiFilter === normSubject ? 'rgba(0, 234, 255, 0.4)' : 'rgba(255,255,255,0.08)'}'">
                    <i class="fa-solid fa-file-circle-check" style="color:var(--accent, #00eaff); font-size:12px;"></i>
                    <span style="font-size:13px; color:#fff; font-weight:600;">${translatedSubject}</span>
                </div>`;
            } else {
                listHTML += `<div style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,255,255,0.02); border-radius:12px; cursor:not-allowed; border:1px solid rgba(255,255,255,0.04);">
                    <i class="fa-regular fa-file" style="color:rgba(255,255,255,0.2); font-size:12px;"></i>
                    <span style="font-size:13px; color:rgba(255,255,255,0.2); font-weight:400;">${translatedSubject}</span>
                </div>`;
            }
        });

        listHTML += '</div></div>';
    });

    infoBox.innerHTML = listHTML || '<p style="color:rgba(255,255,255,0.35); font-size:12px; font-style:italic; margin:0;">' + t('no_kisi') + '</p>';
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Patch SubjectApp.renderAnnouncements BEFORE init() is called.
    SubjectApp.renderAnnouncements = window.renderKisiList;

    // 2. Override delete — fix string vs number id mismatch, then re-render + re-apply edit mode
    SubjectApp.deleteAnnouncement = async function (card) {
        if (!await showPopup(t("confirm_delete_material"), "confirm")) return;
        const id = card.dataset.id;
        await supabase.from("subject_announcements").delete().eq("id", id);
        // Fix: paksa string comparison biar item beneran ke-filter dari state
        SubjectApp.state.announcements = SubjectApp.state.announcements.filter(a => String(a.id) !== String(id));
        showToast(t("item_deleted"), "success");
        SubjectApp._syncDomToState();
        window.renderKisiList();
        // Re-apply edit mode ke card-card baru kalau masih dalam mode edit
        if (SubjectApp.state.editMode) _reapplyEditMode();
    };

    // Helper: re-apply edit mode ke semua card setelah renderKisiList
    function _reapplyEditMode() {
        document.querySelectorAll(".course-card").forEach(function (card) {
            card.classList.add("editable-mode");
            card.querySelectorAll(".editable").forEach(function (f) {
                f.contentEditable = "true";
                f.style.pointerEvents = "auto";
            });
            const deleteBtn = card.querySelector(".delete-btn");
            const colorTools = card.querySelector(".card-color-tools");
            const reorderHandle = card.querySelector(".reorder-handle");
            const placeholder = card.querySelector(".card-photo-placeholder");
            const deletePhotoBtn = card.querySelector(".delete-photo-btn");
            if (deleteBtn) deleteBtn.style.display = "inline-block";
            if (colorTools) colorTools.style.display = "flex";
            if (placeholder) placeholder.style.display = "block";
            if (deletePhotoBtn) deletePhotoBtn.style.display = "block";
        });
    }

    // 3. Fetch Exam schedule for day mapping.
    let user = null;
    try { user = JSON.parse(localStorage.getItem("user")); } catch (e) { }

    if (user && user.class_id) {
        try {
            const MASTER_CLASS_ID = 2;
            const USER_CLASS_ID = getEffectiveClassId() || user.class_id;
            
            // Cek apakah Global Exam sedang aktif di Master Class
            const { data: masterConfig } = await supabase.from('daily_config').select('mode, kisi_days').eq('class_id', MASTER_CLASS_ID).single();
            const isGlobalExam = (masterConfig && masterConfig.mode === 'exam');
            
            const TARGET_CLASS_ID = isGlobalExam ? MASTER_CLASS_ID : USER_CLASS_ID;
            const TARGET_TYPE = 'exam'; 

            // AMBIL PSTS_DAYS DARI CONFIG (Dinamis)
            if (isGlobalExam && masterConfig.kisi_days) {
                PSTS_DAYS = masterConfig.kisi_days;
            } else {
                const { data: localConfig } = await supabase.from('daily_config').select('kisi_days').eq('class_id', USER_CLASS_ID).single();
                if (localConfig && localConfig.kisi_days) PSTS_DAYS = localConfig.kisi_days;
            }

            const { data: schedules } = await supabase
                .from('daily_schedules')
                .select('day_name, lessons, uniform, activity, notes')
                .eq('class_id', TARGET_CLASS_ID)
                .eq('type', TARGET_TYPE)
                .in('day_name', PSTS_DAYS);

            kisiScheduleMap = {};
            (schedules || []).forEach(function (s) {
                // Simpan meta info juga buat di-render di sidebar
                kisiScheduleMap[s.day_name] = {
                    uniform: s.uniform || '-',
                    activity: s.activity || '-',
                    notes: s.notes || '-',
                    lessons: (s.lessons || '')
                        .split(';')
                        .map(function (raw) {
                            raw = raw.trim();
                            const dashIdx = raw.lastIndexOf('-');
                            const name = dashIdx !== -1 ? raw.substring(dashIdx + 1).trim() : raw;
                            return { norm: _kisiNorm(name), display: name };
                        })
                        .filter(function (n) { return n.norm.length > 1 && !KISI_BLACKLIST.some(b => n.norm.includes(b)); })
                };
            });
        } catch (e) {
            console.error('Gagal ambil jadwal kisi-kisi:', e);
        }
    }

    // 4. Init SubjectApp
    SubjectApp.init(
        'kisi-kisi',
        `<h3><i class="fa-solid fa-clipboard-list"></i> ${t('exam_topics')} PSAT</h3>`,
        t('exam_topics') + ' PSAT',
        false  // isLessonMode = false -> no task/selesai button
    );

    // 5. Patch toggleEditMode — setelah masuk edit mode, apply ke kisi cards
    const _origToggle = SubjectApp.toggleEditMode.bind(SubjectApp);
    SubjectApp.toggleEditMode = async function () {
        await _origToggle();
        if (SubjectApp.state.editMode) _reapplyEditMode();
    };
});