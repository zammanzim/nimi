// ============================================================
// visitor.js — PENCATAT KUNJUNGAN (visitor) TERAS MBUN
// Tiap device pelanggan dikasih ID unik yang awet di localStorage
// (tm_device_id). Tiap halaman dibuka → 1 upsert ke tabel
// terasmbun.kunjungan lewat RPC catat_kunjungan():
//   device baru  = baris baru
//   device lama  = jumlah kunjungan + 1, last seen + halaman diupdate
// Daftarnya (per device) bisa diliat pemilik lewat halaman DAPUR
// (wajib PIN) — RPC daftar_kunjungan.
// Semua fire-and-forget: gagal (offline/diblokir) gak ngerusak UI.
// ============================================================

const TmVisitor = (function () {
  "use strict";

  const KEY = "tm_device_id";

  // ── ID per device ──
  // UUID dari crypto.randomUUID (browser modern, secure context);
  // fallback acak buat browser/context lama. Simpan di localStorage
  // biar awet sampe storage dibersihin user.
  function id() {
    let v = "";
    try {
      v = localStorage.getItem(KEY) || "";
    } catch (e) {
      /* private mode / storage diblokir — ID gak awet, gak masalah */
    }
    if (v) return v;
    v =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : "dev-" +
          Date.now().toString(36) +
          "-" +
          Math.random().toString(36).slice(2, 10);
    try {
      localStorage.setItem(KEY, v);
    } catch (e) {
      /* yaudah — tetep dipake buat kunjungan ini doang */
    }
    return v;
  }

  // ── ringkasan perangkat (biar "siapa" nya kebaca di dapur) ──
  // cukup browser + OS + layar — gak napak fingerprint sensitif
  function perangkat() {
    const ua = navigator.userAgent || "";
    const browser = /Edg\//.test(ua)
      ? "Edge"
      : /OPR\/|Opera/.test(ua)
        ? "Opera"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : /Chrome\//.test(ua)
            ? "Chrome"
            : /Safari\//.test(ua)
              ? "Safari"
              : "Lainnya";
    const os = /Android/.test(ua)
      ? "Android"
      : /iPhone|iPad|iPod/.test(ua)
        ? "iOS"
        : /Windows/.test(ua)
          ? "Windows"
          : /Mac OS/.test(ua)
            ? "macOS"
            : /CrOS/.test(ua)
              ? "ChromeOS"
              : /Linux/.test(ua)
                ? "Linux"
                : "";
    const layar = screen && screen.width ? `${screen.width}x${screen.height}` : "";
    return [browser, os, layar].filter(Boolean).join(" · ");
  }

  // ── catat 1 kunjungan (fire & forget) ──
  function catat() {
    // PENTING: jangan pake window.TmDb — db.js mendeklarasi
    // `const TmDb = ...` (global lexical binding, BUKAN property window),
    // jadi window.TmDb selalu undefined. Ceknya pake typeof.
    if (typeof TmDb === "undefined" || !TmDb.supa) return; // db.js belum ke-load
    try {
      TmDb.supa
        .rpc("catat_kunjungan", {
          p_device: id(),
          p_halaman: location.pathname || "/",
          p_perangkat: perangkat(),
        })
        .then(({ error }) => {
          if (error) console.debug("[visitor]", error.message);
        });
    } catch (e) {
      /* jangan ganggu halaman gara-gara tracking */
    }
  }

  // jalan sekali per halaman (DOMContentLoaded biar urutan script aman)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", catat);
  } else {
    catat();
  }

  return { id, perangkat, catat };
})();
