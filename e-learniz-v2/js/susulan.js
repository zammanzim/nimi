// ============================================================
// susulan.js — Materi Susulan (flexible dates)
// Hooks into SubjectApp (subject-manager.js) for admin/modal,
// but overrides renderAnnouncements with date-grouped logic.
// Tanggal fleksibel: admin bisa nambah tanggal bebas via tabel susulan_dates
// (mis. 2026-08-01 Senin, 2026-08-02 Selasa, dst, bisa nambah minggu depan).
// Urutan card ngikut jadwal utama daily card per hari dari tanggal.
// ============================================================

const SUSULAN_DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

// Kata-kata yang bukan nama pelajaran, di-skip dari jadwal
const SUSULAN_BLACKLIST = [
    'istirahat', 'upacara', 'senampagi', 'senam', 'pulang', 'sholat',
    'shalat', 'jumatan', 'makan', 'ishoma', 'ekskul', 'pembiasaan',
    'literasi', 'bersih', 'piket', 'dhuha', 'dzuhur', 'duhur', 'ashar',
    'masuk', 'apel', 'persiapkan', 'cektugas',
];

let susulanScheduleMap = {}; // { Senin: { lessons: [{norm, display}, ...] }, ... }
let SUSULAN_SUBJECTS = [];   // [{norm, display}]
let susulanFilter = 'all';   // filter pelajaran aktif
let susulanDatesList = [];   // ['2026-08-01', '2026-08-02', ...] sorted asc
let susulanCurrentClassId = null;

function _susulanNorm(str) {
    return str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
}

// ── Helpers tanggal ──────────────────────────────────────────

function _getDayNameFromDate(dateStr) {
    if (!dateStr) return '';
    const p = String(dateStr).split('-');
    if (p.length !== 3) return '';
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime())) return '';
    const names = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    return names[d.getDay()] || '';
}

function _formatSusulanDate(dateStr) {
    if (!dateStr) return t('susulan_no_date');
    const dayName = _getDayNameFromDate(dateStr);
    const p = String(dateStr).split('-');
    const d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    if (isNaN(d.getTime())) return dateStr;
    const dayNum = d.getDate();
    const monthKeys = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
    const monthName = t(monthKeys[d.getMonth()]);
    const year = d.getFullYear();
    const dayLabel = dayName ? t(dayName.toLowerCase()) : '';
    return dayLabel ? `${dayLabel}, ${dayNum} ${monthName} ${year}` : `${dayNum} ${monthName} ${year}`;
}

function _isAdmin() {
    try {
        const u = JSON.parse(localStorage.getItem('user') || '{}');
        return u.role === 'class_admin' || u.role === 'super_admin';
    } catch (e) { return false; }
}

// ── Card Controls (edit mode): pindah tanggal + pindah pelajaran ─

function _addCardControls(card, item) {
    if (card.querySelector('.susulan-date-select')) return;

    const row = document.createElement('div');
    row.style.cssText = 'display:flex; gap:8px; margin-bottom:10px; flex-wrap:wrap;';

    const dateSel = document.createElement('select');
    dateSel.className = 'susulan-date-select';
    dateSel.dataset.field = 'susulan_date';
    // build options from dates list + legacy fallback
    let opts = [`<option value="">${t('susulan_no_date')}</option>`];
    if (susulanDatesList.length > 0) {
        susulanDatesList.forEach(d => {
            const label = _formatSusulanDate(d);
            opts.push(`<option value="${d}">${label}</option>`);
        });
    } else {
        // fallback legacy days kalau belum ada tanggal terdefinisi
        SUSULAN_DAYS.forEach(d => {
            opts.push(`<option value="" disabled>──────────</option>`);
        });
        // tapi tetep kasih opsi hari biar data lama ga hilang total (disimpen di susulan_day)
        // kita render day options tersembunyi di value diawali 'day:' biar bisa di-handle
        SUSULAN_DAYS.forEach(d => {
            opts.push(`<option value="day:${d}">${t(d.toLowerCase())} (lama)</option>`);
        });
    }
    // kalau item punya tanggal yang belum ada di list (mis data lama), tetep tampilkan
    const curDate = item.susulan_date ? String(item.susulan_date).slice(0, 10) : '';
    if (curDate && !susulanDatesList.includes(curDate)) {
        opts.push(`<option value="${curDate}">${_formatSusulanDate(curDate)}</option>`);
    }
    // kalau item cuma punya susulan_day (legacy) dan belum ada tanggal list, set ke day:xxx
    const curDayLegacy = item.susulan_day || '';
    // we handle after innerHTML

    dateSel.innerHTML = opts.join('');
    if (curDate) dateSel.value = curDate;
    else if (curDayLegacy && susulanDatesList.length === 0) dateSel.value = `day:${curDayLegacy}`;
    else dateSel.value = '';

    dateSel.onchange = () => {
        const v = dateSel.value;
        if (v.startsWith('day:')) {
            const day = v.replace('day:', '');
            SubjectApp.changeSusulanDay(item.id, day);
        } else {
            SubjectApp.changeSusulanDate(item.id, v || null);
        }
    };

    const subjSel = document.createElement('select');
    subjSel.className = 'susulan-subject-select';
    subjSel.dataset.field = 'susulan_subject';
    const subjOpts = ['<option value="">-</option>'];
    SUSULAN_SUBJECTS.forEach(s => {
        const label = t(s.norm) !== s.norm ? t(s.norm) : s.display;
        subjOpts.push(`<option value="${s.display.replace(/"/g, '&quot;')}">${label}</option>`);
    });
    const itemNorm = _susulanNorm(item.susulan_subject || '');
    if (itemNorm && !SUSULAN_SUBJECTS.some(s => s.norm === itemNorm)) {
        subjOpts.push(`<option value="${item.susulan_subject.replace(/"/g, '&quot;')}">${item.susulan_subject}</option>`);
    }
    subjSel.innerHTML = subjOpts.join('');
    subjSel.value = item.susulan_subject || '';
    subjSel.onchange = () => SubjectApp.changeSusulanSubject(item.id, subjSel.value);

    [dateSel, subjSel].forEach(sel => {
        sel.style.cssText = `
            background: rgba(0,234,255,0.08); color:#fff;
            border:1px solid rgba(0,234,255,0.35); border-radius:20px;
            padding:6px 12px; font-size:12px; outline:none; cursor:pointer;
            appearance:none; -webkit-appearance:none; max-width:180px;
        `;
        row.appendChild(sel);
    });

    card.querySelector('.card-actions')?.insertAdjacentElement('beforebegin', row);
}

// Re-apply edit mode ke card-card baru setelah render ulang
function _reapplyEditMode() {
    document.querySelectorAll(".course-card").forEach(function (card) {
        card.classList.add("editable-mode");
        card.querySelectorAll(".editable").forEach(function (f) {
            f.contentEditable = "true";
            f.style.pointerEvents = "auto";
            f.style.cursor = "text";
        });
        const deleteBtn = card.querySelector(".delete-btn");
        const colorTools = card.querySelector(".card-color-tools");
        const formatTools = card.querySelector(".card-format-tools");
        const reorderHandle = card.querySelector(".reorder-handle");
        const cameraBtn = card.querySelector(".camera-btn");
        if (deleteBtn) deleteBtn.style.display = "inline-block";
        if (colorTools) colorTools.style.display = "flex";
        if (formatTools) formatTools.style.display = "flex";
        if (reorderHandle) reorderHandle.style.display = "none";
        if (cameraBtn) cameraBtn.style.display = "flex";
    });
}

// Setelah createCardElement di edit mode, bongkar code block + link
function _unwrapForEdit(card) {
    const contentEl = card.querySelector('[data-field="content"]');
    if (contentEl) contentEl.innerHTML = revertCodeBlocks(revertCardLinks(contentEl.innerHTML));
}

// ── Urutan card ngikut jadwal harian (berdasar hari dari tanggal) ─

function _sortBySchedule(dayItems, day) {
    const dayLessons = (susulanScheduleMap[day] && susulanScheduleMap[day].lessons) || [];
    const idxOf = item => {
        const norm = _susulanNorm(item.susulan_subject || '');
        const idx = dayLessons.findIndex(e => e.norm === norm);
        return idx === -1 ? 1000 : idx;
    };
    return [...dayItems].sort((a, b) => idxOf(a) - idxOf(b));
}

function _sortByScheduleForDate(items, dateStr) {
    const day = _getDayNameFromDate(dateStr);
    return _sortBySchedule(items, day);
}

// ── Fetch tanggal dari DB ────────────────────────────────────

async function _fetchSusulanDates() {
    susulanDatesList = [];
    let classId = susulanCurrentClassId;
    if (!classId) {
        try {
            const u = JSON.parse(localStorage.getItem('user') || '{}');
            classId = (typeof getEffectiveClassId === 'function' ? getEffectiveClassId() : null) || u.class_id;
            susulanCurrentClassId = classId;
        } catch (e) { }
    }
    if (!classId) return;
    try {
        const { data, error } = await supabase
            .from('susulan_dates')
            .select('date')
            .eq('class_id', classId)
            .order('date', { ascending: true });
        if (error) throw error;
        susulanDatesList = (data || []).map(r => String(r.date).slice(0, 10));
    } catch (e) {
        // table belum ada atau error → fallback kosong (legacy mode)
        console.warn('susulan_dates fetch fallback:', e?.message || e);
        susulanDatesList = [];
    }
}

function _refreshDateUI() {
    _renderLegend();
    _renderDateManager();
    _populateDateSelect();
    _populateSubjectSelect();
}

// ── Main Render ─────────────────────────────────────────────

window.renderSusulanList = function () {
    const items = SubjectApp.state.announcements || [];
    const container = document.getElementById('announcements');
    if (!container) return;

    const header = document.createElement('h3');
    header.style.marginTop = "30px";
    header.textContent = t('susulan');

    // Filter bar
    const availableSubjects = new Set(
        items.map(i => _susulanNorm(i.susulan_subject || '')).filter(Boolean)
    );
    let optionsHTML = SUSULAN_SUBJECTS.map(s => {
        const label = t(s.norm) !== s.norm ? t(s.norm) : s.display;
        if (availableSubjects.has(s.norm)) {
            return `<option value="${s.norm}">${label}</option>`;
        }
        return `<option value="${s.norm}" disabled style="color:rgba(255,255,255,0.3);">${label} ${t('not_yet_available')}</option>`;
    }).join('');
    items.forEach(i => {
        const norm = _susulanNorm(i.susulan_subject || '');
        if (norm && !SUSULAN_SUBJECTS.some(s => s.norm === norm)) {
            optionsHTML += `<option value="${norm}">${i.susulan_subject}</option>`;
        }
    });

    const filterBar = document.createElement('div');
    filterBar.style.cssText = 'display:flex; align-items:center; gap:10px; margin-bottom:22px; flex-wrap:wrap;';
    filterBar.innerHTML = `
        <div style="display:flex; align-items:center; gap:10px; flex:1; min-width:200px;">
            <i class="fa-solid fa-filter" style="color:var(--accent, #00eaff); font-size:14px;"></i> ${t('choose_lesson')}
            <select id="susulanSubjectFilter"
                onchange="susulanFilter = this.value; renderSusulanList();"
                style="flex:1; background:rgba(255,255,255,0.08); color:white;
                    border:1px solid rgba(0, 234, 255, 0.3); padding:9px 15px;
                    border-radius:20px; font-size:13px; outline:none; cursor:pointer;
                    appearance:none; -webkit-appearance:none;">
                <option value="all">${t('all_lessons')}</option>
                ${optionsHTML}
            </select>
        </div>
    `;

    const filtered = susulanFilter === 'all'
        ? items
        : items.filter(i => _susulanNorm(i.susulan_subject || '') === susulanFilter);

    const fragment = document.createDocumentFragment();
    fragment.appendChild(header);
    fragment.appendChild(filterBar);

    // Jika tidak ada tanggal terdefinisi, fallback ke mode lama (biar data lama tetap kelihatan)
    const useLegacy = susulanDatesList.length === 0;

    if (useLegacy) {
        // Legacy grouping by susulan_day (Senin-Jumat)
        if (items.length === 0) {
            const emptyState = document.createElement("div");
            emptyState.className = "empty-state";
            emptyState.innerHTML = `
                <i class="fa-solid fa-book-open-reader"></i>
                <p>${t('no_susulan')}</p>
                ${_isAdmin() ? `<p style="font-size:12px; color:rgba(255,255,255,0.5); margin-top:8px;">${t('susulan_add_date_first')}</p>` : ''}
            `;
            fragment.appendChild(emptyState);
            container.replaceChildren(fragment);
            const sel = document.getElementById('susulanSubjectFilter');
            if (sel) sel.value = susulanFilter;
            _renderLegend();
            _renderDateManager();
            return;
        }
        const grouped = {};
        const unassigned = [];
        filtered.forEach(item => {
            const day = item.susulan_day || '';
            // juga support kalau sudah pakai susulan_date tapi belum ada list tanggal (mis fallback setelah migrasi)
            const dateFallback = item.susulan_date ? String(item.susulan_date).slice(0, 10) : '';
            if (dateFallback) {
                // tanggal sudah ada tapi list kosong → masukkan ke unassigned dengan label tanggal
                unassigned.push(item);
            } else if (SUSULAN_DAYS.includes(day)) {
                if (!grouped[day]) grouped[day] = [];
                grouped[day].push(item);
            } else {
                unassigned.push(item);
            }
        });

        SUSULAN_DAYS.forEach(function (day) {
            const dayItems = _sortBySchedule(grouped[day] || [], day);
            if (susulanFilter !== 'all' && dayItems.length === 0) return;

            const divEl = document.createElement('div');
            divEl.style.cssText = 'margin:24px 0 16px;';
            divEl.innerHTML =
                '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
                '<span style="font-size:18px; font-weight:900; letter-spacing:2px; text-transform:uppercase; white-space:nowrap; color:rgba(255,255,255,0.7);">'
                + t(day.toLowerCase()) +
                '</span>' +
                '<div style="flex:1; height:2px; border-radius:2px; background:linear-gradient(to right, rgba(255,255,255,0.2), transparent);"></div>' +
                '</div>';
            fragment.appendChild(divEl);

            if (dayItems.length === 0) {
                const emptyEl = document.createElement('p');
                emptyEl.style.cssText = 'color:rgba(255, 255, 255, 0.4); font-size:13px; margin:0 0 4px 2px; font-style:italic;';
                emptyEl.textContent = t('no_susulan');
                fragment.appendChild(emptyEl);
            } else {
                dayItems.forEach(function (item) {
                    const displayItem = { ...item, is_task: false };
                    const card = SubjectApp.createCardElement(displayItem);
                    card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
                    if (SubjectApp.state.editMode) { _unwrapForEdit(card); _addCardControls(card, item); }
                    fragment.appendChild(card);
                });
            }
        });

        if (unassigned.length > 0) {
            const uDivEl = document.createElement('div');
            uDivEl.style.cssText = 'display:flex; align-items:center; gap:12px; margin:28px 0 14px;';
            uDivEl.innerHTML =
                `<span style="font-size:13px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; color:#ffd700;">${t('other')} / ${t('susulan_no_date')}</span>` +
                '<div style="flex:1; height:1px; background:linear-gradient(to right, rgba(255,215,0,0.4), transparent);"></div>';
            fragment.appendChild(uDivEl);
            // tampilkan tanggal jika ada
            unassigned.forEach(function (item) {
                const displayItem = { ...item, is_task: false };
                const card = SubjectApp.createCardElement(displayItem);
                card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
                // tambahin badge tanggal di atas card kalau ada susulan_date
                if (item.susulan_date) {
                    const badge = document.createElement('div');
                    badge.style.cssText = 'font-size:11px; color:var(--accent,#00eaff); background:rgba(0,234,255,0.08); border:1px solid rgba(0,234,255,0.2); display:inline-block; padding:3px 8px; border-radius:20px; margin-bottom:8px;';
                    badge.textContent = _formatSusulanDate(String(item.susulan_date).slice(0, 10));
                    card.insertBefore(badge, card.firstChild);
                } else if (item.susulan_day) {
                    const badge = document.createElement('div');
                    badge.style.cssText = 'font-size:11px; color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); display:inline-block; padding:3px 8px; border-radius:20px; margin-bottom:8px;';
                    badge.textContent = t(item.susulan_day.toLowerCase());
                    card.insertBefore(badge, card.firstChild);
                }
                if (SubjectApp.state.editMode) { _unwrapForEdit(card); _addCardControls(card, item); }
                fragment.appendChild(card);
            });
        }

        container.replaceChildren(fragment);
        const sel = document.getElementById('susulanSubjectFilter');
        if (sel) sel.value = susulanFilter;
        _renderLegend();
        _renderDateManager();
        return;
    }

    // ── Mode baru: group by tanggal dinamis ──────────────────
    if (items.length === 0 && susulanDatesList.length === 0) {
        const emptyState = document.createElement("div");
        emptyState.className = "empty-state";
        emptyState.innerHTML = `
            <i class="fa-solid fa-book-open-reader"></i>
            <p>${t('no_susulan')}</p>
            ${_isAdmin() ? `<p style="font-size:12px; color:rgba(255,255,255,0.5); margin-top:8px;">${t('susulan_add_date_first')}</p>` : ''}
        `;
        fragment.appendChild(emptyState);
        container.replaceChildren(fragment);
        const sel = document.getElementById('susulanSubjectFilter');
        if (sel) sel.value = susulanFilter;
        _renderLegend();
        _renderDateManager();
        return;
    }

    // group by date string
    const groupedByDate = {};
    const unassigned = [];
    filtered.forEach(item => {
        const d = item.susulan_date ? String(item.susulan_date).slice(0, 10) : '';
        if (d && susulanDatesList.includes(d)) {
            if (!groupedByDate[d]) groupedByDate[d] = [];
            groupedByDate[d].push(item);
        } else if (d && !susulanDatesList.includes(d)) {
            // tanggal ada tapi tidak terdaftar di master list → tetap group sendiri (biar ga hilang)
            if (!groupedByDate[d]) groupedByDate[d] = [];
            groupedByDate[d].push(item);
        } else {
            unassigned.push(item);
        }
    });

    // urut tanggal sesuai susulanDatesList + extra tanggal yang cuma ada di data
    const extraDates = Object.keys(groupedByDate).filter(d => !susulanDatesList.includes(d)).sort();
    const orderedDates = [...susulanDatesList, ...extraDates];

    orderedDates.forEach(function (dateStr) {
        const dayItems = _sortByScheduleForDate(groupedByDate[dateStr] || [], dateStr);
        if (susulanFilter !== 'all' && dayItems.length === 0 && susulanDatesList.includes(dateStr)) {
            // tetap tampilkan header kosong biar keliatan ada tanggalnya, kecuali filter aktif? 
            // kalau filter aktif dan ga ada item, skip header biar ga sepi
            return;
        }
        if (dayItems.length === 0 && !susulanDatesList.includes(dateStr)) return;

        const isExtra = !susulanDatesList.includes(dateStr);
        const divEl = document.createElement('div');
        divEl.style.cssText = 'margin:24px 0 16px;';
        const label = _formatSusulanDate(dateStr);
        divEl.innerHTML =
            '<div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">' +
            '<span style="font-size:15px; font-weight:800; letter-spacing:0.5px; white-space:nowrap; color:' + (isExtra ? '#ffd700' : 'rgba(255,255,255,0.85)') + ';">'
            + label +
            (isExtra ? ' <span style="font-size:10px; opacity:0.6;">(extra)</span>' : '') +
            '</span>' +
            '<div style="flex:1; height:2px; border-radius:2px; background:linear-gradient(to right, rgba(255,255,255,0.15), transparent);"></div>' +
            '<span style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.35); background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.08);">' + dayItems.length + '</span>' +
            '</div>';
        fragment.appendChild(divEl);

        if (dayItems.length === 0) {
            const emptyEl = document.createElement('p');
            emptyEl.style.cssText = 'color:rgba(255,255,255,0.4); font-size:13px; margin:0 0 4px 2px; font-style:italic;';
            emptyEl.textContent = t('no_susulan');
            fragment.appendChild(emptyEl);
        } else {
            dayItems.forEach(function (item) {
                const displayItem = { ...item, is_task: false };
                const card = SubjectApp.createCardElement(displayItem);
                card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
                if (SubjectApp.state.editMode) { _unwrapForEdit(card); _addCardControls(card, item); }
                fragment.appendChild(card);
            });
        }
    });

    // ── Unassigned (tanpa tanggal) ──────────────────────────
    if (unassigned.length > 0) {
        const uDivEl = document.createElement('div');
        uDivEl.style.cssText = 'display:flex; align-items:center; gap:12px; margin:28px 0 14px;';
        uDivEl.innerHTML =
            `<span style="font-size:13px; font-weight:800; letter-spacing:1.5px; text-transform:uppercase; white-space:nowrap; color:#ffd700;">${t('susulan_no_date')}</span>` +
            '<div style="flex:1; height:1px; background:linear-gradient(to right, rgba(255,215,0,0.4), transparent);"></div>' +
            `<span style="font-size:11px; font-weight:800; color:rgba(255,255,255,0.35); background:rgba(255,255,255,0.06); padding:3px 8px; border-radius:20px; border:1px solid rgba(255,255,255,0.08);">${unassigned.length}</span>`;
        fragment.appendChild(uDivEl);

        unassigned.forEach(function (item) {
            const displayItem = { ...item, is_task: false };
            const card = SubjectApp.createCardElement(displayItem);
            card.querySelectorAll('.task-btn').forEach(function (btn) { btn.remove(); });
            // badge legacy day kalau ada
            if (item.susulan_day) {
                const badge = document.createElement('div');
                badge.style.cssText = 'font-size:11px; color:rgba(255,255,255,0.5); background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); display:inline-block; padding:3px 8px; border-radius:20px; margin-bottom:8px;';
                badge.textContent = t(item.susulan_day.toLowerCase());
                card.insertBefore(badge, card.firstChild);
            }
            if (SubjectApp.state.editMode) { _unwrapForEdit(card); _addCardControls(card, item); }
            fragment.appendChild(card);
        });
    } else if (orderedDates.length === 0) {
        // ga ada tanggal dan ga ada unassigned → tampil kosong sudah di atas, tapi kalau filtered habis
        if (filtered.length === 0 && items.length > 0) {
            const emptyEl = document.createElement('p');
            emptyEl.style.cssText = 'color:rgba(255,255,255,0.4); font-size:13px; margin:20px 0 4px 2px; font-style:italic; text-align:center;';
            emptyEl.textContent = t('no_susulan');
            fragment.appendChild(emptyEl);
        }
    }

    container.replaceChildren(fragment);

    const sel = document.getElementById('susulanSubjectFilter');
    if (sel) sel.value = susulanFilter;

    _renderLegend();
    _renderDateManager();
};

// ── Legend ringkasan jumlah materi per tanggal (left-section) ──

function _renderLegend() {
    const el = document.getElementById('susulanLegend');
    if (!el) return;
    const items = SubjectApp.state.announcements || [];
    if (susulanDatesList.length > 0) {
        if (susulanDatesList.length === 0) {
            el.innerHTML = `<p style="color:rgba(255,255,255,0.35); font-size:12px; font-style:italic; margin:0;">${t('susulan_no_dates')}</p>`;
            return;
        }
        el.innerHTML = susulanDatesList.map(dateStr => {
            const cnt = items.filter(i => String(i.susulan_date || '').slice(0, 10) === dateStr).length;
            return `
            <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,255,255,0.06); border-radius:12px; margin-bottom:6px; border:1px solid rgba(255,255,255,0.08);">
                <i class="fa-solid fa-calendar-day" style="color:var(--accent, #00eaff); font-size:12px;"></i>
                <span style="font-size:12px; color:#fff; font-weight:600; flex:1; line-height:1.3;">${_formatSusulanDate(dateStr)}</span>
                <span style="font-size:11px; font-weight:800; color:${cnt ? 'var(--accent, #00eaff)' : 'rgba(255,255,255,0.3)'}; background:${cnt ? 'rgba(0,234,255,0.12)' : 'rgba(255,255,255,0.05)'}; padding:3px 8px; border-radius:20px; min-width:22px; text-align:center;">${cnt}</span>
            </div>`;
        }).join('') + (() => {
            const unCnt = items.filter(i => !i.susulan_date || !susulanDatesList.includes(String(i.susulan_date).slice(0, 10))).length;
            if (unCnt === 0) return '';
            return `
            <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,215,0,0.08); border-radius:12px; margin-bottom:6px; border:1px solid rgba(255,215,0,0.2);">
                <i class="fa-solid fa-inbox" style="color:#ffd700; font-size:12px;"></i>
                <span style="font-size:12px; color:#ffd700; font-weight:600; flex:1;">${t('susulan_no_date')}</span>
                <span style="font-size:11px; font-weight:800; color:#ffd700; background:rgba(255,215,0,0.15); padding:3px 8px; border-radius:20px; min-width:22px; text-align:center;">${unCnt}</span>
            </div>`;
        })();
    } else {
        // legacy legend per hari
        const count = d => items.filter(i => i.susulan_day === d).length;
        const unCnt = items.filter(i => !i.susulan_day || !SUSULAN_DAYS.includes(i.susulan_day)).length;
        let html = SUSULAN_DAYS.map(day => `
            <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,255,255,0.06); border-radius:12px; margin-bottom:6px; border:1px solid rgba(255,255,255,0.08);">
                <i class="fa-solid fa-calendar-day" style="color:var(--accent, #00eaff); font-size:12px;"></i>
                <span style="font-size:13px; color:#fff; font-weight:600; flex:1;">${t(day.toLowerCase())}</span>
                <span style="font-size:11px; font-weight:800; color:${count(day) ? 'var(--accent, #00eaff)' : 'rgba(255,255,255,0.3)'};">${count(day)}</span>
            </div>`).join('');
        if (unCnt > 0) {
            html += `
            <div style="display:flex; align-items:center; gap:10px; padding:9px 12px; background:rgba(255,215,0,0.08); border-radius:12px; margin-bottom:6px; border:1px solid rgba(255,215,0,0.2);">
                <i class="fa-solid fa-inbox" style="color:#ffd700; font-size:12px;"></i>
                <span style="font-size:13px; color:#ffd700; font-weight:600; flex:1;">${t('susulan_no_date')}</span>
                <span style="font-size:11px; font-weight:800; color:#ffd700;">${unCnt}</span>
            </div>`;
        }
        el.innerHTML = html + `<p style="font-size:11px; color:rgba(255,255,255,0.3); margin:8px 0 0; font-style:italic;">Belum ada tanggal fleksibel. Tambahin di bawah biar ga fixed 5 hari.</p>`;
    }
}

// ── Date Manager (admin only) ─────────────────────────────────

function _renderDateManager() {
    const wrap = document.getElementById('susulanDateManager');
    const listEl = document.getElementById('susulanDateList');
    if (!wrap || !listEl) return;
    if (!_isAdmin()) { wrap.style.display = 'none'; return; }
    wrap.style.display = 'block';
    if (susulanDatesList.length === 0) {
        listEl.innerHTML = `<p style="font-size:12px; color:rgba(255,255,255,0.35); font-style:italic; margin:0;">${t('susulan_no_dates')}</p>`;
        return;
    }
    const items = SubjectApp.state.announcements || [];
    listEl.innerHTML = susulanDatesList.map(d => {
        const cnt = items.filter(i => String(i.susulan_date || '').slice(0, 10) === d).length;
        return `
        <div style="display:flex; align-items:center; gap:8px; padding:8px 10px; background:rgba(255,255,255,0.06); border:1px solid rgba(255,255,255,0.08); border-radius:10px;">
            <i class="fa-solid fa-calendar" style="color:var(--accent,#00eaff); font-size:11px;"></i>
            <span style="flex:1; font-size:12px; color:#fff; font-weight:600;">${_formatSusulanDate(d)}</span>
            <span style="font-size:10px; font-weight:800; color:rgba(255,255,255,0.5); background:rgba(0,0,0,0.2); padding:2px 6px; border-radius:20px;">${cnt}</span>
            <button onclick="deleteSusulanDate('${d}')" style="background:rgba(255,71,87,0.12); border:1px solid rgba(255,71,87,0.3); color:#ff4757; width:26px; height:26px; border-radius:8px; cursor:pointer; display:flex; align-items:center; justify-content:center;">
                <i class="fa-solid fa-trash" style="font-size:10px; pointer-events:none;"></i>
            </button>
        </div>`;
    }).join('');
}

window.addSusulanDate = async function () {
    const input = document.getElementById('susulanNewDate');
    if (!input) return;
    const val = input.value; // YYYY-MM-DD
    if (!val) { showToast(t('susulan_invalid_date'), 'error'); return; }
    if (susulanDatesList.includes(val)) { showToast(t('susulan_date_exists'), 'error'); return; }
    const classId = susulanCurrentClassId || (typeof getEffectiveClassId === 'function' ? getEffectiveClassId() : null) || JSON.parse(localStorage.getItem('user') || '{}').class_id;
    if (!classId) { showPopup(t('failed_save_data'), 'error'); return; }
    try {
        const { error } = await supabase.from('susulan_dates').insert({ class_id: classId, date: val });
        if (error) throw error;
        susulanDatesList.push(val);
        susulanDatesList.sort();
        input.value = '';
        showToast(t('susulan_date_added'), 'success');
        _refreshDateUI();
        window.renderSusulanList();
        if (SubjectApp.state.editMode) _reapplyEditMode();
    } catch (e) {
        console.error('add date failed', e);
        showPopup(e.message || t('failed_save_data'), 'error');
    }
};

window.deleteSusulanDate = async function (dateStr) {
    const label = _formatSusulanDate(dateStr);
    const ok = await showPopup(t('susulan_confirm_delete_date', { date: label }), 'confirm');
    if (!ok) return;
    try {
        const classId = susulanCurrentClassId;
        const { error } = await supabase.from('susulan_dates').delete().eq('class_id', classId).eq('date', dateStr);
        if (error) throw error;
        // null-kan materi yang pakai tanggal ini
        const { error: updErr } = await supabase.from('subject_announcements').update({ susulan_date: null }).eq('class_id', classId).eq('susulan_date', dateStr);
        if (updErr) console.warn('nullify susulan_date failed', updErr);
        // update local state
        SubjectApp.state.announcements.forEach(a => {
            if (String(a.susulan_date || '').slice(0, 10) === dateStr) a.susulan_date = null;
        });
        susulanDatesList = susulanDatesList.filter(d => d !== dateStr);
        showToast(t('susulan_date_deleted'), 'success');
        _refreshDateUI();
        window.renderSusulanList();
        if (SubjectApp.state.editMode) _reapplyEditMode();
    } catch (e) {
        console.error('delete date failed', e);
        showPopup(e.message || t('failed_save_data'), 'error');
    }
};

// ── Pindah tanggal / pelajaran (edit mode) ────────────────────

SubjectApp.changeSusulanDate = async function (id, date) {
    try {
        const { error } = await supabase.from('subject_announcements').update({ susulan_date: date || null }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Gagal simpan tanggal susulan:', err);
        showPopup(t('failed_save_data'), 'error');
        return;
    }
    const ann = this.state.announcements.find(a => String(a.id) === String(id));
    if (ann) ann.susulan_date = date || null;
    showToast(t('data_saved'), 'success');
    window.renderSusulanList();
    if (SubjectApp.state.editMode) _reapplyEditMode();
};

// backward compat
SubjectApp.changeSusulanDay = async function (id, day) {
    try {
        const { error } = await supabase.from('subject_announcements').update({ susulan_day: day, susulan_date: null }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Gagal simpan hari susulan:', err);
        showPopup(t('failed_save_data'), 'error');
        return;
    }
    const ann = this.state.announcements.find(a => String(a.id) === String(id));
    if (ann) { ann.susulan_day = day; ann.susulan_date = null; }
    showToast(t('data_saved'), 'success');
    window.renderSusulanList();
    if (SubjectApp.state.editMode) _reapplyEditMode();
};

SubjectApp.changeSusulanSubject = async function (id, subject) {
    try {
        const { error } = await supabase.from('subject_announcements').update({ susulan_subject: subject || null }).eq('id', id);
        if (error) throw error;
    } catch (err) {
        console.error('Gagal simpan mapel susulan:', err);
        showPopup(t('failed_save_data'), 'error');
        return;
    }
    const ann = this.state.announcements.find(a => String(a.id) === String(id));
    if (ann) ann.susulan_subject = subject || null;
    showToast(t('data_saved'), 'success');
    window.renderSusulanList();
    if (SubjectApp.state.editMode) _reapplyEditMode();
};

// ── Toggle visibilitas pilihan susulan di modal ─────────────

function _populateSubjectSelect() {
    const sel = document.getElementById('susulanSubjectSelect');
    if (!sel) return;
    // selalu rebuild biar update kalau jadwal berubah
    const html = ['<option value="">-</option>'].concat(
        SUSULAN_SUBJECTS.map(s => {
            const label = t(s.norm) !== s.norm ? t(s.norm) : s.display;
            return `<option value="${s.display.replace(/"/g, '&quot;')}">${label}</option>`;
        })
    ).join('');
    // preserve value kalau ada
    const cur = sel.value;
    sel.innerHTML = html;
    if (cur) sel.value = cur;
}

function _populateDateSelect() {
    const sel = document.getElementById('susulanDateSelect');
    if (!sel) return;
    const cur = sel.value;
    let html = `<option value="">${t('susulan_no_date')}</option>`;
    if (susulanDatesList.length > 0) {
        susulanDatesList.forEach(d => {
            html += `<option value="${d}">${_formatSusulanDate(d)}</option>`;
        });
    } else {
        html += `<option value="" disabled>────────── ${t('susulan_no_dates')} ──────────</option>`;
    }
    sel.innerHTML = html;
    if (cur && [...sel.options].some(o => o.value === cur)) sel.value = cur;
    else if (cur) sel.value = '';
}

function _updateSusulanWrap() {
    const dayWrap = document.getElementById('susulanDayWrap');
    const subjWrap = document.getElementById('susulanSubjectWrap');
    const dest = document.getElementById('addDestPage');
    if (!dayWrap || !dest) return;
    _populateSubjectSelect();
    _populateDateSelect();
    const isSusulanPage = SubjectApp.state.subjectId === 'susulan';
    const show = isSusulanPage || dest.value === 'susulan';
    dayWrap.style.display = show ? 'block' : 'none';
    if (subjWrap) subjWrap.style.display = show ? 'block' : 'none';
}

// ── Init ─────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', async function () {
    // 1. Patch renderer BEFORE init() dipanggil
    SubjectApp.renderAnnouncements = window.renderSusulanList;

    // 2. Ambil jadwal utama + daftar tanggal
    let user = null;
    try { user = JSON.parse(localStorage.getItem("user")); } catch (e) { }

    if (user) {
        try {
            const classId = (typeof getEffectiveClassId === 'function' ? getEffectiveClassId() : null) || user.class_id;
            susulanCurrentClassId = classId;

            // jadwal & tanggal parallel
            const [schedRes] = await Promise.all([
                supabase.from('daily_schedules').select('day_name, lessons').eq('class_id', classId).eq('type', 'regular').in('day_name', SUSULAN_DAYS),
                _fetchSusulanDates()
            ]);

            const schedules = schedRes?.data || [];

            susulanScheduleMap = {};
            (schedules || []).forEach(function (s) {
                susulanScheduleMap[s.day_name] = {
                    lessons: (s.lessons || '')
                        .split(';')
                        .map(function (raw) {
                            raw = raw.trim();
                            const dashIdx = raw.lastIndexOf('-');
                            const name = dashIdx !== -1 ? raw.substring(dashIdx + 1).trim() : raw;
                            return { norm: _susulanNorm(name), display: name };
                        })
                        .filter(function (n) { return n.norm.length > 1 && !SUSULAN_BLACKLIST.some(b => n.norm.includes(b)); })
                };
            });

            SUSULAN_SUBJECTS = [];
            const seen = new Set();
            SUSULAN_DAYS.forEach(day => {
                (susulanScheduleMap[day]?.lessons || []).forEach(e => {
                    if (!seen.has(e.norm)) {
                        seen.add(e.norm);
                        SUSULAN_SUBJECTS.push(e);
                    }
                });
            });
        } catch (e) {
            console.error('Gagal ambil jadwal susulan:', e);
        }
    }

    // 3. Init SubjectApp
    SubjectApp.init(
        'susulan',
        `<h3><i class="fa-solid fa-book-open-reader"></i> ${t('susulan')}</h3>`,
        t('susulan'),
        false
    );

    // 4. Posting dari modal — bawa tanggal + pelajaran yang dipilih
    const _origUpload = SubjectApp.uploadAndSave.bind(SubjectApp);
    SubjectApp.uploadAndSave = async function (d) {
        // kalau masih pakai dropdown lama (day) → convert ke null tanggal, simpan day lama buat kompatibilitas
        const dateVal = document.getElementById('susulanDateSelect')?.value || null;
        const dayVal = document.getElementById('susulanDaySelect')?.value || null;
        d.susulanDate = dateVal || null;
        // simpan day legacy juga kalau date kosong tapi day ada (fallback)
        d.susulanDay = dateVal ? null : (dayVal || null);
        d.susulanSubject = document.getElementById('susulanSubjectSelect')?.value || null;
        // validasi: kalau sudah ada tanggal terdaftar tapi user milih tanpa tanggal, kasih warning?
        return _origUpload(d);
    };

    // 5. Reset pilihan abis posting
    const _origClear = SubjectApp.clearForm.bind(SubjectApp);
    SubjectApp.clearForm = function () {
        _origClear();
        const dateSel = document.getElementById('susulanDateSelect');
        if (dateSel) dateSel.value = '';
        const daySel = document.getElementById('susulanDaySelect');
        if (daySel) daySel.value = 'Senin';
        const subjSel = document.getElementById('susulanSubjectSelect');
        if (subjSel) subjSel.value = '';
        _updateSusulanWrap();
    };

    // 6. Toggle edit mode — render ulang biar control muncul/hilang
    const _origToggle = SubjectApp.toggleEditMode.bind(SubjectApp);
    SubjectApp.toggleEditMode = async function () {
        await _origToggle();
        window.renderSusulanList();
        if (SubjectApp.state.editMode) _reapplyEditMode();
    };

    // 7. Wrap di modal
    document.addEventListener('click', (e) => {
        if (e.target.closest('#addAnnouncementBtn')) setTimeout(_updateSusulanWrap, 80);
    });
    document.addEventListener('change', (e) => {
        if (e.target.id === 'addDestPage') _updateSusulanWrap();
    });

    // 8. Render awal legend/manager setelah data ke-load (biar ga skeleton terus)
    // ditungguin di _fetch, tapi kalau SubjectApp.loadAnnouncements async, legend akan ke-refresh pas renderSusulanList pertama
    setTimeout(() => { _refreshDateUI(); }, 600);
});
