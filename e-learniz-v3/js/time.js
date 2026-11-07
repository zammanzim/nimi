/* ==========================================================================
   js/time.js — E-Learniz v3 Time Helpers (Asia/Jakarta / WIB)

   Semua logika "hari ini", "jam sekarang", dan format tanggal memakai WIB,
   bukan timezone browser. Ini penting supaya jadwal, deadline, dan Daily Card
   tetap konsisten walau perangkat siswa diset ke timezone lain.

   Catatan: Indonesia tidak memakai DST, jadi offset WIB selalu +07:00.
   ========================================================================== */
(function () {
  'use strict';

  const TZ = 'Asia/Jakarta';
  const WIB_OFFSET = '+07:00';
  const WEEKDAY_TO_ISO = {
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
    Sun: 7
  };

  const partsFormatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short'
  });

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function getParts(date) {
    const source = date instanceof Date ? date : new Date(date || Date.now());
    const parts = partsFormatter.formatToParts(source);
    const map = {};
    parts.forEach((p) => {
      if (p.type !== 'literal') map[p.type] = p.value;
    });
    return {
      year: Number(map.year),
      month: Number(map.month),
      day: Number(map.day),
      hour: Number(map.hour) % 24,
      minute: Number(map.minute),
      second: Number(map.second),
      isoDay: WEEKDAY_TO_ISO[map.weekday] || 1
    };
  }

  function dateKey(date) {
    const p = getParts(date);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
  }

  function startOfDayIso(date) {
    return new Date(`${dateKey(date)}T00:00:00${WIB_OFFSET}`).toISOString();
  }

  function isoDay(date) {
    return getParts(date).isoDay;
  }

  function minutesOfDay(date) {
    const p = getParts(date);
    return p.hour * 60 + p.minute;
  }

  // Format tanggal/jam apa pun ke teks Indonesia dengan timezone WIB.
  function formatDate(date, options) {
    if (date === null || date === undefined || date === '') return '';
    const d = date instanceof Date ? date : new Date(date);
    if (isNaN(d.getTime())) return '';
    return new Intl.DateTimeFormat('id-ID', {
      timeZone: TZ,
      ...(options || {})
    }).format(d);
  }

  // Parse nilai <input type="datetime-local"> sebagai WIB, bukan timezone browser.
  // Contoh: "2026-11-05T07:30" -> 2026-11-05T00:30:00Z
  function parseDatetimeLocal(value) {
    if (!value) return null;
    const clean = String(value).trim();
    if (!clean) return null;

    const m = clean.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/);
    if (m) {
      return new Date(
        `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] || '00'}${WIB_OFFSET}`
      );
    }

    // Kalau sudah mengandung timezone/Z, biarkan Date mem-parse apa adanya.
    const d = new Date(clean);
    return isNaN(d.getTime()) ? null : d;
  }

  // Convert ISO/timestamp DB -> string untuk <input type="datetime-local"> (WIB).
  function toDatetimeLocal(value) {
    if (!value) return '';
    const d = value instanceof Date ? value : new Date(value);
    if (isNaN(d.getTime())) return '';
    const p = getParts(d);
    return `${p.year}-${pad(p.month)}-${pad(p.day)}T${pad(p.hour)}:${pad(p.minute)}`;
  }

  // Date object yang merepresentasikan tanggal WIB untuk hari tertentu.
  // Kalau target = hari ini -> hari ini; kalau target = besok -> besok;
  // kalau target sudah lewat minggu ini -> occurrence berikutnya.
  function weekdayDate(targetIsoDay, baseDate) {
    const p = getParts(baseDate);
    const target = Number(targetIsoDay);
    const delta = ((target - p.isoDay + 7) % 7);
    // 05:00 UTC = 12:00 WIB, aman untuk format tanggal tanpa geser hari.
    return new Date(Date.UTC(p.year, p.month - 1, p.day + delta, 5, 0, 0));
  }

  window.ELearnizTime = {
    TZ,
    getParts,
    dateKey,
    startOfDayIso,
    isoDay,
    minutesOfDay,
    formatDate,
    parseDatetimeLocal,
    toDatetimeLocal,
    weekdayDate
  };
})();
