/* ==========================================================================
   js/db.js — E-Learniz v3 Data Layer (Supabase schema `v3.*` + Cloudflare R2)
   Accurately maps all live tables:
   - v3.classes (id, name, academic_year, is_active)
   - v3.subjects (id, class_id, slug, name, icon, color, teacher_name, teacher_contact, urutan, locked)
   - v3.cards (id, class_id, subject_id, kind, big_title, title, content, small, media, is_pinned, task_due, has_task)
   - v3.schedule_days (id, class_id, weekday, is_school, uniform, picket, activity, notes)
   - v3.schedule_periods (id, class_id, weekday, urutan, time_start, time_end, label, kind, subject_id)
   - v3.users (id, class_id, nickname, full_name, role, auth_user_id, avatar_url)
   - v3.task_progress (user_id, card_id, done, updated_at)
   - v3.visitors (user_id, class_id, last_page, is_visible, visited_at)
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

  const SUBJECT_COLORS = [
    '#2563eb', '#0ea5e9', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#14b8a6'
  ];

  let sbClient = null;
  function getClient() {
    if (sbClient) return sbClient;
    if (window.supabase && typeof V3_SUPABASE_URL !== 'undefined' && typeof V3_SUPABASE_ANON_KEY !== 'undefined') {
      sbClient = window.supabase.createClient(V3_SUPABASE_URL, V3_SUPABASE_ANON_KEY);
    }
    return sbClient;
  }

  function api() {
    const client = getClient();
    return client ? client.schema('v3') : null;
  }

  function cleanSlug(str) {
    return String(str || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /* ------------------------------------------------------------------------
     MEDIA CLOUDFLARE R2
     ------------------------------------------------------------------------ */
  function mediaUrl(path) {
    if (!path) return '';
    const s = String(path).trim();
    if (/^https?:\/\//i.test(s)) return s;
    const base = typeof V3_R2_PUBLIC_BASE !== 'undefined' ? V3_R2_PUBLIC_BASE : 'https://media-v3.e-learniz.my.id';
    return base.replace(/\/+$/, '') + '/' + s.replace(/^\/+/, '');
  }

  async function uploadMedia(file, folder) {
    if (typeof V3_R2_ENABLED !== 'undefined' && !V3_R2_ENABLED) {
      throw new Error('Upload media ke Cloudflare R2 sedang dinonaktifkan.');
    }
    const presignEndpoint = typeof V3_R2_PRESIGN_URL !== 'undefined' ? V3_R2_PRESIGN_URL : 'https://elearniz-media-presign.nizzcuy.workers.dev/presign';
    const client = getClient();
    let token = '';
    try {
      if (client && client.auth) {
        const { data } = await client.auth.getSession();
        token = (data && data.session && data.session.access_token) || '';
      }
    } catch (_) {}

    if (!token) {
      throw new Error('Upload foto ke Cloudflare R2 membutuhkan login staff/admin (Supabase Auth).');
    }

    const contentType = file.type || 'application/octet-stream';
    const cleanName = String(file.name || 'foto').replace(/[^A-Za-z0-9._-]+/g, '_').slice(-80) || 'foto';
    const key = `${String(folder || 'cards').replace(/^\/+|\/+$/g, '')}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${cleanName}`;

    // Request presigned URL from Cloudflare Worker
    const presignRes = await fetch(presignEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer ' + token
      },
      body: JSON.stringify({ op: 'put', path: key, contentType })
    });

    let presignBody = null;
    try {
      presignBody = await presignRes.json();
    } catch (_) {}

    if (!presignRes.ok || !presignBody || !presignBody.url) {
      const errDetail = presignBody && (presignBody.detail || presignBody.error);
      throw new Error(errDetail ? `Presign R2 gagal: ${errDetail}` : `Presign R2 gagal (Status ${presignRes.status})`);
    }

    // Direct PUT to Cloudflare R2 bucket
    const uploadRes = await fetch(presignBody.url, {
      method: 'PUT',
      headers: { 'Content-Type': contentType },
      body: file
    });

    if (!uploadRes.ok) {
      throw new Error(`Upload file ke R2 gagal (Status ${uploadRes.status})`);
    }

    return mediaUrl(presignBody.path || key);
  }

  /* ------------------------------------------------------------------------
     NORMALIZERS
     ------------------------------------------------------------------------ */
  function normalizeSubject(row, idx) {
    return {
      id: row.id,
      class_id: row.class_id,
      slug: row.slug || cleanSlug(row.name),
      name: row.name,
      teacher_name: row.teacher_name || 'Belum diatur',
      teacher_phone: row.teacher_contact || '',
      icon: row.icon || 'fa-book-open',
      color: row.color || SUBJECT_COLORS[idx % SUBJECT_COLORS.length],
      is_locked: Boolean(row.locked)
    };
  }

  function normalizeCard(row) {
    const rawKind = String(row.kind || '').toLowerCase();
    const kind = (rawKind === 'pengumuman' || rawKind === 'announcement') ? 'announcement' : 'subject';
    const hasTask = Boolean(row.has_task || rawKind === 'tugas');
    const rawMedia = Array.isArray(row.media)
      ? row.media
      : (Array.isArray(row.photos) ? row.photos : (Array.isArray(row.images) ? row.images : []));
    const media = rawMedia.map(mediaUrl);

    return {
      id: row.id,
      class_id: row.class_id,
      subject_id: row.subject_id || null,
      kind,
      big_title: row.big_title || row.title || 'Tanpa Judul',
      title: row.title || row.subtitle || '',
      content: row.content || row.body || '',
      small: row.small || '',
      due_date: row.task_due || row.due_date || null,
      pinned: Boolean(row.is_pinned !== undefined ? row.is_pinned : row.pinned),
      has_task: hasTask,
      images: media
    };
  }

  /* ------------------------------------------------------------------------
     CLASSES
     ------------------------------------------------------------------------ */
  async function listClasses() {
    try {
      const db = api();
      if (!db) throw new Error('No Supabase client');
      const { data, error } = await db.from('classes').select('*').eq('is_active', true).order('id');
      if (error) throw error;
      if (Array.isArray(data) && data.length > 0) {
        return data.map((c) => ({
          id: Number(c.id),
          slug: cleanSlug(c.name),
          name: c.name,
          school_year: c.academic_year || '2026/2027'
        }));
      }
    } catch (e) {
      console.warn('listClasses fallback:', e);
    }
    return [
      { id: 2, slug: 'xirpl2', name: 'XI - RPL 2', school_year: '2026/2027' },
      { id: 1, slug: 'xirpl1', name: 'XI - RPL 1', school_year: '2026/2027' },
      { id: 3, slug: 'xirpl3', name: 'XI - RPL 3', school_year: '2026/2027' },
      { id: 4, slug: 'xirpl4', name: 'XI - RPL 4', school_year: '2026/2027' }
    ];
  }

  /* ------------------------------------------------------------------------
     SUBJECTS
     ------------------------------------------------------------------------ */
  async function listSubjects(classId) {
    try {
      const db = api();
      if (!db) throw new Error('No Supabase client');
      const { data, error } = await db
        .from('subjects')
        .select('*')
        .eq('class_id', classId)
        .order('urutan')
        .order('name');
      if (error) throw error;
      if (Array.isArray(data)) {
        return data.map((s, idx) => normalizeSubject(s, idx));
      }
    } catch (e) {
      console.warn('listSubjects fallback:', e);
    }
    return [];
  }

  async function updateSubject(classId, subjectId, patch) {
    const db = api();
    if (!db) throw new Error('Koneksi Supabase tidak tersedia.');

    const dbPatch = {
      name: patch.name,
      teacher_name: patch.teacher_name,
      teacher_contact: patch.teacher_phone,
      icon: patch.icon,
      color: patch.color
    };
    const { error } = await db.from('subjects').update(dbPatch).eq('id', subjectId);
    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------------
     CARDS
     ------------------------------------------------------------------------ */
  async function listCards(classId) {
    try {
      const db = api();
      if (!db) throw new Error('No Supabase client');
      const { data, error } = await db
        .from('cards')
        .select('*')
        .eq('class_id', classId)
        .order('is_pinned', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (Array.isArray(data)) {
        return data.map(normalizeCard);
      }
    } catch (e) {
      console.warn('listCards fallback:', e);
    }
    return [];
  }

  async function saveCard(classId, cardPayload) {
    if (cardPayload.kind === 'subject' && !cardPayload.subject_id) {
      throw new Error('Mata pelajaran wajib dipilih untuk materi/tugas.');
    }

    let taskDueIso = null;
    if (cardPayload.due_date) {
      const d = new Date(cardPayload.due_date);
      if (!isNaN(d.getTime())) {
        taskDueIso = d.toISOString();
      }
    }

    const dbPayload = {
      class_id: Number(classId),
      subject_id: cardPayload.kind === 'subject' && cardPayload.subject_id ? Number(cardPayload.subject_id) : null,
      kind: cardPayload.kind === 'announcement'
        ? 'pengumuman'
        : (cardPayload.has_task ? 'tugas' : 'materi'),
      has_task: Boolean(cardPayload.has_task),
      big_title: cardPayload.big_title || '',
      title: cardPayload.title || '',
      content: cardPayload.content || '',
      small: cardPayload.small || '',
      task_due: taskDueIso,
      is_pinned: Boolean(cardPayload.pinned),
      media: Array.isArray(cardPayload.images) ? cardPayload.images : []
    };

    const db = api();
    if (!db) throw new Error('Koneksi Supabase tidak tersedia.');

    if (cardPayload.id) {
      const { error } = await db.from('cards').update(dbPayload).eq('id', cardPayload.id);
      if (error) throw error;
    } else {
      const { error } = await db.from('cards').insert(dbPayload);
      if (error) throw error;
    }
    return true;
  }

  async function deleteCard(classId, cardId) {
    const db = api();
    if (!db) throw new Error('Koneksi Supabase tidak tersedia.');

    const { error } = await db.from('cards').delete().eq('id', cardId);
    if (error) throw error;
    return true;
  }

  /* ------------------------------------------------------------------------
     SCHEDULE
     ------------------------------------------------------------------------ */
  const PERIOD_KINDS = new Set(['belajar', 'istirahat', 'kegiatan', 'pulang']);

  function parseTimeRange(timeRange) {
    const raw = String(timeRange || '').trim();
    // Dukung "07.00 - 08.30", "07:00-08:30", dan periode yang hanya punya
    // jam mulai ("06:30") agar data lama tidak hilang saat disimpan ulang.
    const m = raw.match(/^(\d{1,2})[.:](\d{2})(?:\s*[-–—]\s*(\d{1,2})[.:](\d{2}))?/);
    if (!m) return { start: '', end: '' };
    const pad = (n) => String(n).padStart(2, '0');
    return {
      start: `${pad(m[1])}:${m[2]}`,
      end: m[3] ? `${pad(m[3])}:${m[4]}` : ''
    };
  }

  function inferPeriodKind(label, fallback) {
    if (fallback && PERIOD_KINDS.has(String(fallback))) return String(fallback);
    const s = String(label || '').toLowerCase();
    if (/^pulang/.test(s)) return 'pulang';
    if (/istirahat|ishoma/.test(s)) return 'istirahat';
    if (/upacara|sholat|dhuha|senam|skj|ppk|kamsih|literasi|pembiasaan|doa/.test(s)) return 'kegiatan';
    return 'belajar';
  }

  async function getScheduleWithPeriods(classId) {
    try {
      const db = api();
      if (!db) throw new Error('No Supabase client');
      const [daysRes, periodsRes] = await Promise.all([
        db.from('schedule_days').select('*').eq('class_id', classId).order('weekday'),
        db.from('schedule_periods').select('*').eq('class_id', classId).order('weekday').order('urutan')
      ]);
      if (daysRes && daysRes.error) throw daysRes.error;
      if (periodsRes && periodsRes.error) throw periodsRes.error;

      const days = (daysRes && daysRes.data) || [];
      const periods = (periodsRes && periodsRes.data) || [];

      return [1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
        const d = days.find((r) => Number(r.weekday) === dayNum) || {};
        const isSchool = d.is_school !== undefined ? Boolean(d.is_school) : (dayNum < 6);

        const dayPeriods = periods
          .filter((p) => Number(p.weekday) === dayNum)
          .map((p) => ({
            time_range: p.time_range || [p.time_start, p.time_end].filter(Boolean).join(' - '),
            subject_name: p.label || 'Mata Pelajaran',
            subject_id: p.subject_id || null,
            kind: p.kind || 'belajar',
            room: p.room || ''
          }));

        const picketRaw = d.picket || '';
        const picketArr = String(picketRaw)
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean);

        return {
          day_of_week: dayNum,
          day_name: DAY_NAMES[dayNum] || 'Hari',
          is_school: isSchool,
          uniform: d.uniform || (isSchool ? 'Seragam Sekolah' : ''),
          activity: d.activity || (isSchool ? 'KBM Normal' : 'Libur'),
          note: d.notes || '-',
          picket_members: picketArr,
          periods: dayPeriods
        };
      });
    } catch (e) {
      console.warn('getScheduleWithPeriods fallback:', e);
    }
    return [];
  }

  async function updateScheduleDay(classId, dayNum, payload) {
    const db = api();
    if (!db) throw new Error('Koneksi Supabase tidak tersedia.');

    const body = payload || {};
    const picketStr = Array.isArray(body.picket_members)
      ? body.picket_members.join('; ')
      : (body.picket || '');
    const isSchool = body.is_school !== undefined
      ? Boolean(body.is_school)
      : (Number(dayNum) !== 6 && Number(dayNum) !== 7);

    const { error: dayError } = await db.from('schedule_days').upsert({
      class_id: Number(classId),
      weekday: Number(dayNum),
      is_school: isSchool,
      uniform: body.uniform || '',
      activity: body.activity || '',
      notes: body.note || body.notes || '',
      picket: picketStr
    }, { onConflict: 'class_id,weekday' });
    if (dayError) throw dayError;

    // Ganti periode pelajaran untuk hari tersebut.
    // Upsert dulu 1..n supaya data lama tidak hilang kalau insert gagal,
    // lalu hapus baris sisa (urutan > jumlah periode baru).
    if (Array.isArray(body.periods)) {
      const rows = body.periods.map((p, idx) => {
        const time = parseTimeRange(p.time_range || p.time || '');
        const label = String(p.subject_name || p.label || 'Mata Pelajaran').trim() || 'Mata Pelajaran';
        return {
          class_id: Number(classId),
          weekday: Number(dayNum),
          urutan: idx + 1,
          time_start: time.start,
          time_end: time.end,
          label,
          kind: inferPeriodKind(label, p.kind),
          subject_id: p.subject_id ? Number(p.subject_id) : null
        };
      });

      if (rows.length > 0) {
        const { error: periodError } = await db
          .from('schedule_periods')
          .upsert(rows, { onConflict: 'class_id,weekday,urutan' });
        if (periodError) throw periodError;
      }

      let delQuery = db
        .from('schedule_periods')
        .delete()
        .eq('class_id', Number(classId))
        .eq('weekday', Number(dayNum));
      if (rows.length > 0) delQuery = delQuery.gt('urutan', rows.length);
      const { error: deleteError } = await delQuery;
      if (deleteError) throw deleteError;
    }

    return true;
  }

  /* ------------------------------------------------------------------------
     PROGRESS & VISITORS
     ------------------------------------------------------------------------ */
  function getLocalProgressKey(classId, userId) {
    return `elearniz_v3_progress_${classId}_${userId || 'guest'}`;
  }

  async function getCompletedCardIds(classId, userId) {
    const localKey = getLocalProgressKey(classId, userId);
    let localArr = [];
    try {
      localArr = JSON.parse(localStorage.getItem(localKey) || '[]');
    } catch (_) {}
    const set = new Set(localArr.map(String));

    if (userId) {
      try {
        const db = api();
        if (db) {
          const { data } = await db.from('task_progress').select('card_id').eq('user_id', userId);
          if (Array.isArray(data)) {
            data.forEach((r) => set.add(String(r.card_id)));
          }
        }
      } catch (_) {}
    }
    return set;
  }

  async function toggleTaskCompleted(classId, cardId, userId) {
    const set = await getCompletedCardIds(classId, userId);
    const key = String(cardId);
    const nowDone = !set.has(key);
    if (nowDone) set.add(key);
    else set.delete(key);

    const localKey = getLocalProgressKey(classId, userId);
    localStorage.setItem(localKey, JSON.stringify([...set]));

    if (userId) {
      try {
        const db = api();
        if (db) {
          if (nowDone) {
            const { error } = await db.from('task_progress').upsert(
              { user_id: userId, card_id: Number(cardId), done: true },
              { onConflict: 'user_id,card_id' }
            );
            if (error) throw error;
          } else {
            const { error } = await db
              .from('task_progress')
              .delete()
              .eq('user_id', userId)
              .eq('card_id', Number(cardId));
            if (error) throw error;
          }
        }
      } catch (e) {
        // Progress lokal tetap tersimpan; server bisa disinkronkan nanti.
        console.warn('toggleTaskCompleted sync error:', e);
      }
    }

    return set;
  }

  function getVisitorStorageKey(classId) {
    const T = window.ELearnizTime;
    const day = T ? T.dateKey(new Date()) : new Date().toISOString().slice(0, 10);
    return `elearniz_v3_visitors_${classId}_${day}`;
  }

  function readLocalVisitors(classId) {
    try {
      const raw = JSON.parse(localStorage.getItem(getVisitorStorageKey(classId)) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch (_) {
      return [];
    }
  }

  function writeLocalVisitors(classId, list) {
    try {
      localStorage.setItem(getVisitorStorageKey(classId), JSON.stringify(list.slice(0, 100)));
    } catch (_) {}
  }

  async function logVisit(classId, visitorInfo) {
    const info = visitorInfo || {};
    const name = info.displayName || 'Tamu';
    const role = info.role || 'guest';
    const nowIso = new Date().toISOString();

    // Simpan juga di localStorage: fallback kalau DB/RLS sedang bermasalah,
    // dan satu-satunya sumber untuk tamu (tamu tidak punya user_id).
    const local = readLocalVisitors(classId);
    const sameUser = info.userId
      ? local.some((v) => String(v.user_id) === String(info.userId))
      : local.some((v) => String(v.display_name || '').trim().toLowerCase() === String(name).trim().toLowerCase());
    if (!sameUser) {
      local.unshift({
        user_id: info.userId || null,
        display_name: name,
        role,
        visited_at: nowIso,
        source: 'local'
      });
      writeLocalVisitors(classId, local);
    }

    if (info.userId) {
      const db = api();
      if (!db) throw new Error('Koneksi Supabase tidak tersedia.');
      const { error } = await db.from('visitors').upsert({
        user_id: Number(info.userId),
        class_id: Number(classId),
        last_page: info.lastPage || '',
        is_visible: true,
        visited_at: nowIso
      }, { onConflict: 'user_id' });
      if (error) throw error;
    }
  }

  async function listTodayVisitors(classId) {
    const local = readLocalVisitors(classId);
    let dbVisitors = [];

    try {
      const db = api();
      if (db) {
        const T = window.ELearnizTime;
        const start = T
          ? T.startOfDayIso(new Date())
          : new Date(new Date().setHours(0, 0, 0, 0)).toISOString();

        const { data, error } = await db
          .from('visitors')
          .select('user_id,last_page,visited_at,is_visible')
          .eq('class_id', Number(classId))
          .eq('is_visible', true)
          .gte('visited_at', start)
          .order('visited_at', { ascending: false });
        if (error) throw error;

        if (Array.isArray(data) && data.length > 0) {
          // Ambil semua user sekali, lalu map di memory (hindari join PostgREST
          // yang rapuh terhadap nama relasi schema v3).
          const users = await listUsers(null);
          const byId = {};
          users.forEach((u) => { byId[String(u.id)] = u; });

          dbVisitors = data.map((v) => {
            const u = byId[String(v.user_id)] || {};
            return {
              user_id: v.user_id,
              display_name: u.full_name || u.nickname || `Pengguna #${v.user_id}`,
              role: u.role || 'student',
              visited_at: v.visited_at,
              source: 'db'
            };
          });
        }
      }
    } catch (e) {
      console.warn('listTodayVisitors fallback:', e);
    }

    const merged = [];
    const seen = new Set();
    const push = (v) => {
      const name = String(v.display_name || '').trim();
      if (!name) return;
      const key = v.user_id ? `u:${v.user_id}` : `n:${name.toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);
      merged.push(v);
    };

    dbVisitors.forEach(push);
    local.forEach(push);
    merged.sort((a, b) => new Date(b.visited_at || 0) - new Date(a.visited_at || 0));
    return merged;
  }

  async function listUsers(classId) {
    try {
      const db = api();
      if (!db) return [];
      let query = db.from('users').select('*').order('full_name');
      if (classId) {
        query = query.eq('class_id', Number(classId));
      }
      const { data, error } = await query;
      if (error) throw error;
      return (data || []).map((u) => ({
        id: Number(u.id),
        class_id: Number(u.class_id),
        nickname: u.nickname || u.full_name,
        full_name: u.full_name || u.nickname,
        role: u.role || 'student',
        auth_user_id: u.auth_user_id || null,
        avatar_url: u.avatar_url || ''
      }));
    } catch (e) {
      console.warn('listUsers error:', e);
      return [];
    }
  }

  window.ELearnizDB = {
    getClient,
    api,
    mediaUrl,
    uploadMedia,
    listClasses,
    listUsers,
    listSubjects,
    updateSubject,
    listCards,
    saveCard,
    deleteCard,
    getScheduleWithPeriods,
    updateScheduleDay,
    getCompletedCardIds,
    toggleTaskCompleted,
    logVisit,
    listTodayVisitors
  };
})();
