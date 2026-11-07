// ============================================================
// pwa-refresh.js — registrasi service worker + auto-refresh versi baru.
// Alurnya: deploy (CACHE versi naik) → SW baru install & ambil alih →
// SW ngirim pesan "versi-baru" ke tab yang kebuka → sini nampilin
// TOAST dulu ("Ada update baru…") → abis itu halaman di-RELOAD otomatis.
// Biar user gak nyangkut di kode lama (dan visitor/tracking ikut jalan).
// Registrasi SW pindah ke sini juga (dulu inline di tiap halaman).
// ============================================================

(function () {
  "use strict";

  if (!("serviceWorker" in navigator)) return;

  // daftarin service worker
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((reg) => {
        // Cek update saat user balik ke tab (layar nyala / ganti tab)
        document.addEventListener("visibilitychange", () => {
          if (document.visibilityState === "visible") reg.update().catch(() => {});
        });
        // Cek update berkala (tiap 10 menit) biar misal layar dapur nyala terus tetap dapet update
        setInterval(() => reg.update().catch(() => {}), 10 * 60 * 1000);
      })
      .catch(() => {
        /* offline / diblokir — halaman tetep jalan tanpa PWA */
      });
  });

  let refreshing = false;

  // pesan dari SW: ada versi baru → toast dulu, baru refresh
  navigator.serviceWorker.addEventListener("message", (e) => {
    if (!e.data || e.data.tipe !== "versi-baru") return;
    if (refreshing) return;
    refreshing = true;
    toastVersiBaru();
  });

  // fallback: deteksi pergantian service worker (hanya jika sebelumnya sudah aktif)
  let hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (refreshing) return;
    refreshing = true;
    toastVersiBaru();
  });

  function toastVersiBaru() {
    const pesan =
      "🔄 Ada update baru dari Teras Mbun — halaman dimuat ulang…";
    // pake toast bawaan (toast.js ke-load duluan di semua halaman);
    // fallback banner mini kalo toast.js gak ada
    if (typeof window.showToast === "function") {
      window.showToast(pesan, "info");
    } else {
      banner(pesan);
    }
    // jeda dikit biar toast sempet kebaca — reload = dapet kode terbaru
    setTimeout(() => location.reload(), 2200);
  }

  function banner(teks) {
    if (!document.body) return;
    const d = document.createElement("div");
    d.textContent = teks;
    d.style.cssText =
      "position:fixed;left:50%;top:14px;transform:translateX(-50%);" +
      "z-index:9999;background:rgba(28,17,10,.95);color:#fffaf2;" +
      "font:600 14px/1.4 Outfit,system-ui,sans-serif;padding:11px 18px;" +
      "border-radius:999px;box-shadow:0 8px 24px rgba(0,0,0,.35);" +
      "max-width:92vw;text-align:center";
    document.body.appendChild(d);
  }
})();
