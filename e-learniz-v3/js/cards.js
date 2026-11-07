/* ==========================================================================
   js/cards.js — Authentic E-Learniz Renderers:
   1. Daily Card Final (.daily-card-final)
   2. Course Card (.course-card) with photo-grid, task-btn, #autoNumber
   3. User Task Profile (#userTaskProfile)
   ========================================================================== */
(function () {
  const DAY_NAMES = {
    1: 'Senin',
    2: 'Selasa',
    3: 'Rabu',
    4: 'Kamis',
    5: 'Jumat',
    6: 'Sabtu',
    7: 'Minggu'
  };

  const DAY_COLORS = {
    1: '#2563eb', // Senin - Sky Blue
    2: '#0ea5e9', // Selasa - Cyan Blue
    3: '#10b981', // Rabu - Fresh Mint
    4: '#f59e0b', // Kamis - Sunny Amber
    5: '#8b5cf6'  // Jumat - Playful Violet
  };

  const DAY_SHORT = {
    1: 'Sen',
    2: 'Sel',
    3: 'Rab',
    4: 'Kam',
    5: 'Jum',
    6: 'Sab',
    7: 'Min'
  };

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Samakan variasi nama mapel di jadwal dengan nama mapel di tabel subjects.
  // Contoh: "Bahasa Inggris" == "B. Inggris", "MTK" == "Matematika".
  function normalizeSubjectKey(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/\bmtk\b/g, 'matematika')
      .replace(/\bb\s*\.?\s*(indonesia|inggris|sunda|jepang)\b/g, 'bahasa $1')
      .replace(/[^a-z0-9]+/g, '');
  }

  function findSubject(subjects, subjectId, subjectName) {
    const list = Array.isArray(subjects) ? subjects : [];
    if (subjectId) {
      const byId = list.find((s) => String(s.id) === String(subjectId));
      if (byId) return byId;
    }

    const key = normalizeSubjectKey(subjectName);
    if (!key) return null;

    return list.find((s) => {
      const subjectKey = normalizeSubjectKey(s.name);
      if (!subjectKey) return false;
      if (subjectKey === key) return true;
      // Cocokkan variasi panjang (mis. "Matematika Wajib") tanpa membuat
      // singkatan pendek seperti "PP" cocok dengan "PPK".
      const shorter = subjectKey.length <= key.length ? subjectKey : key;
      const longer = subjectKey.length > key.length ? subjectKey : key;
      return shorter.length >= 5 && longer.includes(shorter);
    }) || null;
  }

  function formatDueLabel(dueDateStr) {
    if (!dueDateStr) return '';
    const due = new Date(dueDateStr);
    if (isNaN(due.getTime())) return '';
    const now = new Date();
    const diffHours = (due.getTime() - now.getTime()) / (1000 * 60 * 60);
    const T = window.ELearnizTime;
    const formatted = T
      ? T.formatDate(due, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      : due.toLocaleDateString('id-ID', {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        });
    if (diffHours < 0) return `Terlewat · ${formatted}`;
    if (diffHours <= 36) return `Segera · ${formatted}`;
    return `Tenggat · ${formatted}`;
  }

  function computeTaskStatusClass(card, isDone) {
    if (!card.has_task) return '';
    if (isDone) return 'task-green-done';
    if (card.due_date) {
      const due = new Date(card.due_date);
      const diffHours = (due.getTime() - Date.now()) / (1000 * 60 * 60);
      if (diffHours <= 36) return 'task-red-deadline';
    }
    return 'task-yellow-pending';
  }

  /* ------------------------------------------------------------------------
     1. DAILY CARD FINAL (.daily-card-final)
     ------------------------------------------------------------------------ */
  function getSmartSchoolDay() {
    const T = window.ELearnizTime;
    const now = new Date();
    const isoDayToday = T
      ? T.isoDay(now)
      : (now.getDay() === 0 ? 7 : now.getDay());
    const hour = T ? T.getParts(now).hour : now.getHours();
    let isoDay = isoDayToday;
    let isTomorrowMode = false;

    if (isoDay === 6 || isoDay === 7) {
      isoDay = 1;
      isTomorrowMode = true;
    } else if (hour >= 15) {
      isoDay = isoDay >= 5 ? 1 : isoDay + 1;
      isTomorrowMode = true;
    }

    return { isoDay, isTomorrowMode, todayIso: isoDayToday };
  }

  function isPeriodNow(timeRangeStr, isTodayActive) {
    if (!isTodayActive || !timeRangeStr) return false;
    const parts = timeRangeStr.split('-').map((s) => s.trim());
    if (parts.length < 2) return false;
    const toMins = (str) => {
      const [h, m] = str.replace('.', ':').split(':').map(Number);
      if (isNaN(h) || isNaN(m)) return -1;
      return h * 60 + m;
    };
    const startM = toMins(parts[0]);
    const endM = toMins(parts[1]);
    if (startM < 0 || endM < 0) return false;
    const T = window.ELearnizTime;
    const curM = T ? T.minutesOfDay(new Date()) : (new Date().getHours() * 60 + new Date().getMinutes());
    return curM >= startM && curM <= endM;
  }

  function renderDailyCard(container, options) {
    if (!container) return;
    const {
      scheduleDays = [],
      selectedDayOfWeek,
      pendingTaskCount = 0,
      subjects = [],
      isAdmin = false,
      onShortcutTugas,
      onClickSubject,
      onSaveDailyCard,
      onSelectDay
    } = options || {};

    const smart = getSmartSchoolDay();
    const activeDayNum = selectedDayOfWeek || smart.isoDay;
    const dayObj = scheduleDays.find((d) => Number(d.day_of_week) === Number(activeDayNum)) || {
      day_of_week: activeDayNum,
      day_name: DAY_NAMES[activeDayNum] || 'Senin',
      uniform: 'Putih Abu-Abu Lengkap',
      activity: 'KBM Normal & Literasi Pagi',
      note: 'Jangan lupa siapkan buku catatan & alat tulis.',
      picket_members: ['Belum diatur'],
      periods: []
    };

    const todayIso = smart.todayIso;
    const isTodaySelected = Number(activeDayNum) === Number(todayIso);
    const dayDelta = ((Number(activeDayNum) - Number(todayIso) + 7) % 7);
    const isTomorrowSelected = dayDelta === 1;
    const badgeLabel = isTodaySelected
      ? 'JADWAL HARI INI'
      : (isTomorrowSelected
          ? 'JADWAL BESOK'
          : `JADWAL ${String(DAY_NAMES[activeDayNum] || 'KELAS').toUpperCase()}`);
    const badgeExtraClass = isTomorrowSelected ? 'besok' : '';
    const dcColor = DAY_COLORS[activeDayNum] || '#2563eb';

    const T = window.ELearnizTime;
    const selectedDate = T ? T.weekdayDate(activeDayNum) : new Date();
    const dateFormatted = T
      ? T.formatDate(selectedDate, { day: 'numeric', month: 'long', year: 'numeric' })
      : selectedDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const periods = Array.isArray(dayObj.periods) ? dayObj.periods : [];
    const picketList = Array.isArray(dayObj.picket_members) ? dayObj.picket_members : [];

    container.innerHTML = `
      <div class="daily-card-final" id="dailyCardFinal" style="--dc-col: ${dcColor};">
        <div class="final-header">
          <div>
            <div class="final-badge-row">
              <span class="final-badge ${badgeExtraClass}">
                <i class="fa-solid fa-calendar-day"></i> ${badgeLabel}
              </span>
            </div>
            <h2 class="final-day" id="lblDcDay">${escapeHtml(dayObj.day_name || DAY_NAMES[activeDayNum])}</h2>
            <span class="final-date">${escapeHtml(dateFormatted)}</span>
          </div>

          <div class="header-right-group">
            ${isAdmin ? `
              <div class="dc-edit-actions" id="dcEditActions" style="display:none;">
                <button type="button" class="action-btn cancel" id="dcCancelEditBtn" title="Batal Edit">
                  <i class="fa-solid fa-xmark"></i>
                </button>
                <button type="button" class="action-btn save" id="dcSaveEditBtn" title="Simpan Perubahan">
                  <i class="fa-solid fa-check"></i>
                </button>
              </div>
              <button type="button" class="action-btn edit" id="dcToggleEditBtn" title="Edit Daily Card Hari Ini">
                <i class="fa-solid fa-pen"></i>
              </button>
            ` : ''}

            <div class="task-shortcut-box" id="dcTaskShortcut" title="Lihat Daftar Tugas">
              <div class="task-badge ${pendingTaskCount === 0 ? 'zero' : ''}">${pendingTaskCount}</div>
              <i class="fa-solid fa-list-check"></i>
              <span>TUGAS</span>
            </div>
          </div>
        </div>

        <!-- Tab Hari (Sen–Min) -->
        <div class="dc-day-tabs" id="dcDayTabs" role="tablist" aria-label="Pilih hari jadwal">
          ${[1, 2, 3, 4, 5, 6, 7].map((d) => `
            <button type="button" class="dc-day-tab ${Number(d) === Number(activeDayNum) ? 'active' : ''}"
              data-dc-day="${d}" role="tab" aria-selected="${Number(d) === Number(activeDayNum) ? 'true' : 'false'}">
              ${DAY_SHORT[d]}
            </button>
          `).join('')}
        </div>

        <!-- 3 Top Info Cards: Seragam, Kegiatan, Catatan (Editable Inline) -->
        <div class="top-cards-grid">
          <div class="info-card-dynamic seragam-row">
            <div class="card-icon"><i class="fa-solid fa-shirt"></i></div>
            <div class="card-meta">
              <span class="card-label">Seragam</span>
              <div class="card-val editable-text" data-type="uniform" title="Klik untuk edit">${escapeHtml(dayObj.uniform || '-')}</div>
            </div>
          </div>

          <div class="info-card-dynamic kegiatan-row">
            <div class="card-icon"><i class="fa-solid fa-person-running"></i></div>
            <div class="card-meta">
              <span class="card-label">Kegiatan</span>
              <div class="card-val editable-text" data-type="activity" title="Klik untuk edit">${escapeHtml(dayObj.activity || '-')}</div>
            </div>
          </div>

          <div class="info-card-dynamic catatan-row">
            <div class="card-icon"><i class="fa-solid fa-bell"></i></div>
            <div class="card-meta">
              <span class="card-label">Catatan Harian</span>
              <div class="card-val small editable-text" data-type="notes" title="Klik untuk edit">${escapeHtml(dayObj.note || '-')}</div>
            </div>
          </div>
        </div>

        <!-- Jadwal Pelajaran Timeline (Editable Inline) -->
        <div class="final-section">
          <div class="final-title">
            <i class="fa-solid fa-clock"></i> JADWAL PELAJARAN
          </div>
          <div class="final-timeline" id="dcTimelineList">
            ${periods.length === 0 ? `
              <div class="dc-empty-timeline" style="font-size:0.82rem;color:var(--text-muted);padding:0.4rem 0;">Belum ada jadwal pelajaran di hari ini.</div>
            ` : periods.map((p) => {
              const timeStr = p.time_range || `${p.start_time || ''} - ${p.end_time || ''}`;
              const matchedSubject = findSubject(subjects, p.subject_id, p.subject_name);
              const nowActive = isPeriodNow(timeStr, isTodaySelected);
              return `
                <div class="tl-item-final ${nowActive ? 'is-now' : ''}">
                  <div class="tl-time-final editable-text" data-type="time" title="Waktu (contoh: 07.00 - 08.30)">${escapeHtml(timeStr)}</div>
                  <div class="tl-marker-final"></div>
                  <div class="tl-subject-final editable-text ${matchedSubject ? 'clickable' : ''}" data-type="subject" ${matchedSubject ? `data-goto-subject="${matchedSubject.id}"` : ''} title="Nama Mapel">
                    ${escapeHtml(p.subject_name || (matchedSubject && matchedSubject.name) || 'Mata Pelajaran')}
                    ${p.room ? `<span class="tl-room-tag">${escapeHtml(p.room)}</span>` : ''}
                  </div>
                  <button type="button" class="btn-del-inline" data-del="lesson" title="Hapus Baris"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `;
            }).join('')}
          </div>
          <button type="button" class="btn-add-inline" id="btnAddLesson">+ Tambah Jadwal Pelajaran</button>
        </div>

        <div class="final-spacer"></div>

        <!-- Jadwal Piket (Editable Inline) -->
        <div class="final-section">
          <div class="final-title">
            <i class="fa-solid fa-broom"></i> JADWAL PIKET
          </div>
          <div class="picket-grid-big" id="dcPicketList">
            ${picketList.length === 0
              ? `<div class="picket-pill"><span class="editable-text" data-type="picket">Belum diatur</span><button type="button" class="btn-del-inline" data-del="picket"><i class="fa-solid fa-xmark"></i></button></div>`
              : picketList.map((member) => `
                <div class="picket-pill">
                  <span class="editable-text" data-type="picket">${escapeHtml(member)}</span>
                  <button type="button" class="btn-del-inline" data-del="picket" title="Hapus Orang"><i class="fa-solid fa-xmark"></i></button>
                </div>
              `).join('')}
          </div>
          <button type="button" class="btn-add-inline" id="btnAddPicket">+ Tambah Orang Piket</button>
        </div>

        <div class="final-watermark">E-LEARNIZ DAILY SYSTEM</div>
      </div>
    `;

    // Bind Shortcut Tugas
    const shortcutBox = container.querySelector('#dcTaskShortcut');
    if (shortcutBox && onShortcutTugas) {
      shortcutBox.addEventListener('click', () => onShortcutTugas());
    }

    // Bind Subject Navigation
    const bindSubjectLinks = () => {
      container.querySelectorAll('[data-goto-subject]').forEach((el) => {
        el.onclick = () => {
          if (container.querySelector('#dailyCardFinal').classList.contains('edit-mode-on')) return;
          const sid = el.getAttribute('data-goto-subject');
          if (sid && onClickSubject) onClickSubject(sid);
        };
      });
    };
    bindSubjectLinks();

    // Inline Editing Controller
    const cardEl = container.querySelector('#dailyCardFinal');
    const toggleEditBtn = container.querySelector('#dcToggleEditBtn');
    const editActions = container.querySelector('#dcEditActions');
    const cancelEditBtn = container.querySelector('#dcCancelEditBtn');
    const saveEditBtn = container.querySelector('#dcSaveEditBtn');
    const btnAddLesson = container.querySelector('#btnAddLesson');
    const btnAddPicket = container.querySelector('#btnAddPicket');
    const timelineList = container.querySelector('#dcTimelineList');
    const picketListEl = container.querySelector('#dcPicketList');

    const setInlineEditMode = (active) => {
      cardEl.classList.toggle('edit-mode-on', active);
      if (toggleEditBtn) toggleEditBtn.style.display = active ? 'none' : 'inline-flex';
      if (editActions) editActions.style.display = active ? 'flex' : 'none';

      container.querySelectorAll('.editable-text').forEach((el) => {
        el.contentEditable = active ? 'true' : 'false';
        if (active) {
          el.onkeydown = (e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              // Focus next field
              const all = [...container.querySelectorAll('.editable-text[contenteditable="true"]')];
              const idx = all.indexOf(e.target);
              if (idx !== -1 && idx < all.length - 1) all[idx + 1].focus();
            }
          };
        } else {
          el.onkeydown = null;
        }
      });
    };

    // Navigasi tab hari pada Daily Card.
    const dayTabs = container.querySelector('#dcDayTabs');
    if (dayTabs && typeof onSelectDay === 'function') {
      dayTabs.querySelectorAll('[data-dc-day]').forEach((btn) => {
        btn.addEventListener('click', () => {
          if (cardEl.classList.contains('edit-mode-on')) return;
          onSelectDay(Number(btn.getAttribute('data-dc-day')));
        });
      });
    }

    if (toggleEditBtn) {
      toggleEditBtn.addEventListener('click', () => {
        setInlineEditMode(true);
      });
    }

    if (cancelEditBtn) {
      cancelEditBtn.addEventListener('click', () => {
        setInlineEditMode(false);
        renderDailyCard(container, options);
      });
    }

    // Add Lesson Row
    if (btnAddLesson && timelineList) {
      btnAddLesson.addEventListener('click', () => {
        const emptyMsg = timelineList.querySelector('.dc-empty-timeline');
        if (emptyMsg) emptyMsg.remove();

        const row = document.createElement('div');
        row.className = 'tl-item-final';
        row.innerHTML = `
          <div class="tl-time-final editable-text" data-type="time" contenteditable="true">07.00 - 08.30</div>
          <div class="tl-marker-final"></div>
          <div class="tl-subject-final editable-text" data-type="subject" contenteditable="true">Mata Pelajaran Baru</div>
          <button type="button" class="btn-del-inline" data-del="lesson" title="Hapus Baris"><i class="fa-solid fa-xmark"></i></button>
        `;
        timelineList.appendChild(row);
        const subjField = row.querySelector('[data-type="subject"]');
        if (subjField) subjField.focus();
      });
    }

    // Add Picket Row
    if (btnAddPicket && picketListEl) {
      btnAddPicket.addEventListener('click', () => {
        const pill = document.createElement('div');
        pill.className = 'picket-pill';
        pill.innerHTML = `
          <span class="editable-text" data-type="picket" contenteditable="true">Nama Siswa</span>
          <button type="button" class="btn-del-inline" data-del="picket" title="Hapus"><i class="fa-solid fa-xmark"></i></button>
        `;
        picketListEl.appendChild(pill);
        const span = pill.querySelector('[data-type="picket"]');
        if (span) span.focus();
      });
    }

    // Delete item listener (delegated)
    container.addEventListener('click', (e) => {
      const delBtn = e.target.closest('[data-del]');
      if (!delBtn) return;
      e.stopPropagation();
      const type = delBtn.getAttribute('data-del');
      if (type === 'lesson') {
        const row = delBtn.closest('.tl-item-final');
        if (row) row.remove();
      } else if (type === 'picket') {
        const pill = delBtn.closest('.picket-pill');
        if (pill) pill.remove();
      }
    });

    // Save Drafts
    if (saveEditBtn && onSaveDailyCard) {
      saveEditBtn.addEventListener('click', async () => {
        saveEditBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        saveEditBtn.disabled = true;

        const uniformEl = container.querySelector('[data-type="uniform"]');
        const activityEl = container.querySelector('[data-type="activity"]');
        const notesEl = container.querySelector('[data-type="notes"]');

        const clean = (el) => (el ? el.innerText.trim() : '');

        // Gather periods
        const periodRows = [];
        container.querySelectorAll('#dcTimelineList .tl-item-final').forEach((row, i) => {
          const time = clean(row.querySelector('[data-type="time"]'));
          const subjName = clean(row.querySelector('[data-type="subject"]'));
          if (time || subjName) {
            // Cocokkan nama mapel dengan toleransi alias (B. Inggris dsb).
            const matched = findSubject(subjects, null, subjName);
            periodRows.push({
              period_number: i + 1,
              time_range: time || '07.00 - 08.00',
              subject_name: subjName || 'Mata Pelajaran',
              subject_id: matched ? matched.id : null
            });
          }
        });

        // Gather pickets
        const picketMembers = [];
        container.querySelectorAll('#dcPicketList .picket-pill [data-type="picket"]').forEach((span) => {
          const name = clean(span);
          if (name && name !== 'Belum diatur') picketMembers.push(name);
        });

        const payload = {
          uniform: clean(uniformEl) || '-',
          activity: clean(activityEl) || '-',
          note: clean(notesEl) || '-',
          picket_members: picketMembers,
          periods: periodRows,
          is_school: dayObj.is_school !== undefined ? dayObj.is_school : (activeDayNum < 6)
        };

        try {
          await onSaveDailyCard(activeDayNum, payload);
          setInlineEditMode(false);
        } catch (err) {
          saveEditBtn.innerHTML = '<i class="fa-solid fa-check"></i>';
          saveEditBtn.disabled = false;
        }
      });
    }
  }

  /* ------------------------------------------------------------------------
     2. COURSE CARD (.course-card) — Pengumuman, Tugas, & Mapel
     ------------------------------------------------------------------------ */
  function buildPhotoGridHtml(images) {
    if (!Array.isArray(images) || images.length === 0) return '';
    const clean = images.filter(Boolean);
    if (clean.length === 0) return '';
    const countClass = `count-${Math.min(clean.length, 4)}`;
    const displayList = clean.slice(0, 4);
    const extraCount = clean.length - 4;
    return `
      <div class="photo-grid ${countClass}">
        ${displayList.map((url, idx) => `
          <div class="photo-item photo-wrapper" data-photo-index="${idx}" title="Klik untuk lihat foto">
            <img src="${escapeHtml(url)}" alt="Lampiran Materi" loading="lazy" decoding="async" />
            ${(idx === 3 && extraCount > 0) ? `<div class="more-overlay">+${extraCount}</div>` : ''}
          </div>
        `).join('')}
      </div>
    `;
  }

  let cardMenuListenerBound = false;
  function closeCardMenu(menuWrap) {
    if (!menuWrap || !menuWrap.classList.contains('is-open')) return;
    if (menuWrap.classList.contains('is-closing')) return;
    menuWrap.classList.add('is-closing');
    setTimeout(() => {
      menuWrap.classList.remove('is-open', 'is-closing');
    }, 180);
  }

  function closeAllCardMenus() {
    document.querySelectorAll('.card-menu-container.is-open').forEach(closeCardMenu);
  }

  function ensureCardMenuOutsideListener() {
    if (cardMenuListenerBound) return;
    cardMenuListenerBound = true;
    document.addEventListener('click', (e) => {
      if (!e.target.closest('.card-menu-container')) {
        closeAllCardMenus();
      }
    });
  }

  function renderCourseCardList(container, cards, options) {
    if (!container) return;
    const {
      completedTaskSet = new Set(),
      subjectsMap = {},
      emptyTitle = 'Belum Ada Data',
      emptySubtitle = 'Konten yang ditambahkan akan muncul di sini.',
      priorityMap = {},
      showSubjectOrigin = false,
      isAdmin = false,
      onToggleTask,
      onOpenDetail,
      onEditCard,
      onDeleteCard,
      onTogglePin
    } = options || {};

    if (!cards || cards.length === 0) {
      container.innerHTML = `
        <div class="empty-card-state">
          <i class="fa-solid fa-folder-open"></i>
          <h4>${escapeHtml(emptyTitle)}</h4>
          <p>${escapeHtml(emptySubtitle)}</p>
        </div>
      `;
      return;
    }

    container.innerHTML = cards.map((card, idx) => {
      const isDone = completedTaskSet.has(String(card.id));
      const statusClass = computeTaskStatusClass(card, isDone);
      const isPinnedClass = card.pinned ? 'is-pinned' : '';
      const subj = card.subject_id ? subjectsMap[String(card.subject_id)] : null;
      const dueLabel = formatDueLabel(card.due_date);
      const smallText = [card.small, dueLabel].filter(Boolean).join(' · ');
      const accent = (window.ELearnizUI && window.ELearnizUI.safeColor)
        ? window.ELearnizUI.safeColor(subj && subj.color)
        : ((subj && subj.color) || '#2563eb');
      const borderAccentStyle = (!statusClass && !card.pinned && subj && subj.color)
        ? `style="border-left-color: ${accent};"`
        : '';
      const priority = card.subject_id ? priorityMap[String(card.subject_id)] : null;
      const priorityLabel = priority === 'today' ? 'Jadwal Hari Ini' : (priority === 'tomorrow' ? 'Jadwal Besok' : '');
      const hasTaskClass = card.has_task ? 'has-task' : 'no-task';

      return `
        <article class="course-card ${statusClass} ${isPinnedClass} ${hasTaskClass}" data-card-id="${card.id}" ${borderAccentStyle}>
          ${isAdmin ? `
            <div class="card-menu-container" id="cardMenuContainer-${card.id}">
              <button type="button" class="card-dots-btn" data-action="toggle-menu" data-id="${card.id}" title="Opsi Kartu">
                <i class="fa-solid fa-ellipsis-vertical"></i>
              </button>
              <div class="card-dropdown-menu">
                <button type="button" class="card-menu-item" data-action="pin" data-id="${card.id}">
                  <i class="fa-solid fa-thumbtack"></i> <span>${card.pinned ? 'Lepas Pin' : 'Pin di Atas'}</span>
                </button>
                <button type="button" class="card-menu-item" data-action="edit" data-id="${card.id}">
                  <i class="fa-solid fa-pen"></i> <span>Edit Konten</span>
                </button>
                <button type="button" class="card-menu-item del" data-action="delete" data-id="${card.id}">
                  <i class="fa-solid fa-trash"></i> <span>Hapus Konten</span>
                </button>
              </div>
            </div>
          ` : ''}

          ${priorityLabel ? `
            <span class="card-priority-badge ${priority === 'today' ? 'is-today' : 'is-tomorrow'}">
              <i class="fa-solid fa-bolt"></i> ${priorityLabel}
            </span>
          ` : ''}

          ${showSubjectOrigin && subj ? `
            <div class="card-subject-origin">
              <i class="fa-solid ${escapeHtml(subj.icon || 'fa-book')}"></i>
              <span>${escapeHtml(subj.name)}</span>
            </div>
          ` : ''}

          <h3>${escapeHtml(card.big_title || card.title || 'Tanpa Judul')}</h3>
          ${card.title && card.big_title ? `<h4>${escapeHtml(card.title)}</h4>` : ''}
          ${card.content ? `<p>${escapeHtml(card.content)}</p>` : ''}

          ${buildPhotoGridHtml(card.images)}

          ${smallText ? `<small><i class="fa-regular fa-clock"></i> ${escapeHtml(smallText)}</small>` : ''}

          ${card.has_task ? `
            <button type="button" class="task-btn ${isDone ? 'completed' : ''}" data-toggle-task="${card.id}" title="${isDone ? 'Klik untuk tandai belum selesai' : 'Klik untuk tandai selesai'}">
              <i class="${isDone ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle-check'}"></i>
              <span>${isDone ? 'Selesai' : 'Tandai Selesai'}</span>
            </button>
          ` : ''}

          <span class="card-auto-number">#${idx + 1}</span>
        </article>
      `;
    }).join('');

    // Task toggle button click
    container.querySelectorAll('[data-toggle-task]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const cardId = btn.getAttribute('data-toggle-task');
        if (onToggleTask) onToggleTask(cardId);
      });
    });

    // Admin controls click
    container.querySelectorAll('[data-action]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const action = btn.getAttribute('data-action');
        const id = btn.getAttribute('data-id');

        if (action === 'toggle-menu') {
          const menuWrap = btn.closest('.card-menu-container');
          const wasOpen = menuWrap.classList.contains('is-open') && !menuWrap.classList.contains('is-closing');
          // Close all open card menus
          closeAllCardMenus();
          if (!wasOpen) {
            menuWrap.classList.remove('is-closing');
            menuWrap.classList.add('is-open');
          }
          return;
        }

        // Close menu
        const menuWrap = btn.closest('.card-menu-container');
        if (menuWrap) closeCardMenu(menuWrap);

        const cardObj = cards.find((c) => String(c.id) === String(id));
        if (!cardObj) return;
        if (action === 'edit' && onEditCard) onEditCard(cardObj);
        if (action === 'delete' && onDeleteCard) onDeleteCard(cardObj);
        if (action === 'pin' && onTogglePin) onTogglePin(cardObj);
      });
    });

    ensureCardMenuOutsideListener();

    // Open card detail modal on card click
    container.querySelectorAll('.course-card[data-card-id]').forEach((article) => {
      article.addEventListener('click', (e) => {
        if (e && e.target && e.target.closest && (e.target.closest('.card-menu-container') || e.target.closest('.task-btn'))) {
          return;
        }
        const id = article.getAttribute('data-card-id');
        const cardObj = cards.find((c) => String(c.id) === String(id));
        if (!cardObj || !onOpenDetail) return;

        const photoWrapper = e.target.closest('.photo-item, [data-photo-index]');
        const photoIdx = photoWrapper ? parseInt(photoWrapper.getAttribute('data-photo-index') || '0', 10) : 0;
        onOpenDetail(cardObj, photoIdx);
      });
    });
  }

  /* ------------------------------------------------------------------------
     3. USER TASK PROFILE CARD (#userTaskProfile on Halaman Tugas)
     ------------------------------------------------------------------------ */
  function renderUserTaskProfile(container, currentUser, totalTasks, completedTasks) {
    if (!container) return;
    const name = currentUser
      ? (currentUser.display_name || currentUser.username || 'Siswa')
      : 'Tamu Kelas';
    const initial = name.charAt(0).toUpperCase();
    const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

    let caption = 'Yuk mulai cicil tugasmu satu per satu biar makin ringan! 🚀';
    if (totalTasks === 0) {
      caption = 'Asyik! Belum ada tugas kelas yang aktif saat ini. 🎉';
    } else if (pct === 100) {
      caption = 'Luar biasa! Kamu sudah menyelesaikan semua tugas kelas! 🏆✨';
    } else if (pct >= 50) {
      caption = 'Mantap! Lebih dari separuh tugas sudah beres, semangat! 💪';
    }

    container.innerHTML = `
      <div class="user-task-profile-card">
        <div class="utp-top-row">
          <div class="utp-avatar">${escapeHtml(initial)}</div>
          <div class="utp-info">
            <div class="utp-name">${escapeHtml(name)}</div>
            <div class="utp-status-row">
              <span>Status Penyelesaian:</span>
              <strong>${completedTasks}/${totalTasks} (${pct}%)</strong>
            </div>
          </div>
        </div>

        <div class="utp-progress-track">
          <div class="utp-progress-fill" style="width: ${pct}%;"></div>
          <div class="utp-progress-text">
            Kamu sudah menyelesaikan ${completedTasks} dari ${totalTasks} tugas
          </div>
        </div>

        <small class="utp-caption">${caption}</small>
      </div>
    `;
  }

  window.ELearnizCards = {
    renderDailyCard,
    renderCourseCardList,
    renderUserTaskProfile,
    formatDueLabel,
    escapeHtml
  };
})();
