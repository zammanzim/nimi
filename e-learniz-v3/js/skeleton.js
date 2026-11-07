/* ==========================================================================
   js/skeleton.js — Skeleton loading untuk semua halaman (Beranda, Tugas, Mapel)
   Dimuat SEBELUM script CDN/Supabase supaya kerangka muncul secepat mungkin.
   Tidak ada data DB yang masuk ke markup ini, jadi aman dari XSS.
   ========================================================================== */
(function () {
  const ARIA = 'role="status" aria-label="Memuat..."';

  function b(w, h, extra) {
    const style = `${w ? `width:${w};` : ''}${h ? `height:${h};` : ''}`;
    return `<span class="sk ${extra || ''}" style="${style}"></span>`;
  }

  function repeat(n, fn) {
    return Array.from({ length: n }, (_, i) => fn(i)).join('');
  }

  /* ---------- Blok per komponen ---------- */
  function dailyCard() {
    return `
      <div class="sk-card sk-daily" ${ARIA}>
        <div class="sk-row sk-between">
          <div class="sk-stack">
            ${b('96px', '20px', 'sk-pill')}
            ${b('150px', '26px')}
            ${b('120px', '12px')}
          </div>
          ${b('38px', '38px', 'sk-circle')}
        </div>
        <div class="sk-row sk-wrap sk-gap-sm">
          ${repeat(7, () => b('42px', '30px', 'sk-pill'))}
        </div>
        <div class="sk-grid-3">
          ${repeat(3, () => `
            <div class="sk-mini">
              ${b('34px', '34px', 'sk-circle')}
              <div class="sk-stack sk-grow">${b('50%', '10px')}${b('85%', '14px')}</div>
            </div>`)}
        </div>
        <div class="sk-stack sk-gap-sm">
          ${b('110px', '12px')}
          ${repeat(5, () => `
            <div class="sk-row sk-gap-sm">
              ${b('64px', '14px')}
              ${b('10px', '10px', 'sk-circle')}
              ${b('', '38px', 'sk-grow sk-rounded')}
            </div>`)}
        </div>
        <div class="sk-row sk-wrap sk-gap-sm">
          ${b('70px', '12px')}
          ${repeat(4, () => b('74px', '24px', 'sk-pill'))}
        </div>
      </div>`;
  }

  function courseCard() {
    return `
      <div class="sk-card sk-course" ${ARIA}>
        <div class="sk-row sk-gap-sm">
          ${b('44px', '44px', 'sk-rounded')}
          <div class="sk-stack sk-grow">
            ${b('40%', '11px')}
            ${b('75%', '17px')}
          </div>
          ${b('64px', '22px', 'sk-pill')}
        </div>
        <div class="sk-stack sk-gap-sm">
          ${b('100%', '12px')}
          ${b('92%', '12px')}
          ${b('55%', '12px')}
        </div>
        <div class="sk-row sk-between">
          <div class="sk-row sk-gap-sm">${b('86px', '24px', 'sk-pill')}${b('72px', '24px', 'sk-pill')}</div>
          ${b('96px', '32px', 'sk-rounded')}
        </div>
      </div>`;
  }

  function courseList(n) {
    return repeat(n, courseCard);
  }

  function userTaskProfile() {
    return `
      <div class="sk-card sk-profile" ${ARIA}>
        <div class="sk-row sk-gap-sm">
          ${b('52px', '52px', 'sk-circle')}
          <div class="sk-stack sk-grow">${b('55%', '16px')}${b('35%', '11px')}</div>
        </div>
        ${b('100%', '26px', 'sk-pill')}
        ${b('70%', '11px')}
      </div>`;
  }

  function chips() {
    return `<div class="sk-row sk-wrap sk-gap-sm sk-fx" ${ARIA}>${
      repeat(5, (i) => b(`${[110, 90, 100, 84, 96][i]}px`, '32px', 'sk-pill'))
    }</div>`;
  }

  function subjectCard() {
    return `
      <div class="sk-card sk-subject-card" ${ARIA}>
        <div class="sk-row sk-gap-sm">
          ${b('46px', '46px', 'sk-rounded')}
          <div class="sk-stack sk-grow">${b('70%', '16px')}${b('50%', '11px')}</div>
        </div>
        <div class="sk-row sk-gap-sm">
          ${b('', '44px', 'sk-grow sk-rounded')}
          ${b('', '44px', 'sk-grow sk-rounded')}
        </div>
      </div>`;
  }

  function subjectGrid(n) {
    return repeat(n, subjectCard);
  }

  function subjectInfo() {
    return `
      <div class="sk-subject-info" ${ARIA}>
        <div class="sk-row sk-gap-sm">
          ${b('56px', '56px', 'sk-rounded')}
          <div class="sk-stack sk-grow">${b('65%', '20px')}${b('45%', '12px')}</div>
        </div>
        <div class="sk-grid-3">
          ${repeat(3, () => `<div class="sk-mini sk-mini-col">${b('40%', '18px')}${b('80%', '10px')}</div>`)}
        </div>
        ${b('100%', '24px', 'sk-pill')}
        ${b('70%', '11px')}
      </div>`;
  }

  function sidebarItems(n) {
    return repeat(n, (i) => `
      <li class="sk-side-item" style="pointer-events:none;cursor:default;">
        ${b('20px', '20px', 'sk-circle')}
        ${b(`${[62, 78, 55, 70, 66, 74][i % 6]}%`, '13px')}
      </li>`);
  }

  /* ---------- API ---------- */
  function setHtml(id, html) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
    return el;
  }

  // Aktifkan view yang sesuai hash supaya skeleton yang tampil sama dengan halaman tujuan.
  function applyEarlyRoute() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').trim();
    const parts = raw.split('/').filter(Boolean);
    const route = (parts[0] || 'home').toLowerCase();
    let view = 'home';
    if (['tugas', 'task', 'tasks'].includes(route)) view = 'tugas';
    else if (['mapel', 'subject', 'subjects'].includes(route)) view = 'subject';

    const map = { home: 'viewHome', tugas: 'viewTugas', subject: 'viewSubject' };
    Object.keys(map).forEach((k) => {
      const el = document.getElementById(map[k]);
      if (el) el.classList.toggle('active', k === view);
    });

    if (view === 'subject') {
      const single = document.getElementById('singleSubjectLayout');
      const all = document.getElementById('allSubjectsOverview');
      const hasSubject = Boolean(parts[1]);
      if (single) single.style.display = hasSubject ? '' : 'none';
      if (all) all.style.display = hasSubject ? 'none' : 'block';
    }
  }

  /* Deteksi perangkat low-end: CPU <= 4 core, RAM <= 2GB, atau mode hemat data.
     Di perangkat ini sweep diganti denyut opacity yang jauh lebih ringan (lihat .sk-lite di CSS). */
  function detectLite() {
    try {
      const nav = navigator;
      const conn = nav.connection || {};
      const lowCpu = nav.hardwareConcurrency && nav.hardwareConcurrency <= 4;
      const lowMem = nav.deviceMemory && nav.deviceMemory <= 2;
      if (lowCpu || lowMem || conn.saveData) {
        document.documentElement.classList.add('sk-lite');
      }
    } catch (_) { /* abaikan */ }
  }

  function show() {
    detectLite();
    document.body.classList.add('app-loading');
    applyEarlyRoute();

    setHtml('dailyInfoCard', dailyCard());
    setHtml('announcementList', courseList(2));
    setHtml('userTaskProfile', userTaskProfile());
    setHtml('mapelFilterChips', chips());
    setHtml('taskList', courseList(3));
    setHtml('allSubjectsGrid', subjectGrid(6));
    setHtml('subjectCardList', courseList(3));
    setHtml('sidebarSubjectsList', sidebarItems(6));

    const info = document.getElementById('subjectInfoCard');
    if (info && !info.querySelector('.sk-subject-info')) {
      info.insertAdjacentHTML('afterbegin', subjectInfo());
    }
  }

  const CONTAINER_IDS = ['dailyInfoCard', 'announcementList', 'userTaskProfile', 'mapelFilterChips',
    'taskList', 'allSubjectsGrid', 'subjectCardList', 'sidebarSubjectsList'];

  // Dipanggil setelah render pertama selesai (sukses atau gagal).
  // Kerangka di halaman yang tidak aktif dibuang; render halaman itu akan mengisinya saat dibuka.
  function hide() {
    document.body.classList.remove('app-loading');
    document.querySelectorAll('.sk-subject-info').forEach((el) => el.remove());
    CONTAINER_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.querySelector('.sk, .sk-card, .sk-side-item')) el.innerHTML = '';
    });
  }

  // Dipakai kalau pemuatan gagal: kosongkan kerangka agar tidak berputar selamanya.
  function clear() {
    hide();
  }

  window.ELearnizSkeleton = {
    show, hide, clear,
    templates: { dailyCard, courseCard, courseList, userTaskProfile, chips, subjectCard, subjectGrid, subjectInfo, sidebarItems }
  };

  if (document.body) show();
  else document.addEventListener('DOMContentLoaded', show);
})();
