// ============================================================
// sw.js — Service Worker TERAS MBUN (PWA ringan)
// Cache-first buat aset statis; Supabase selalu network.
// Ingat: tiap ubah file yang di-precache, BUMP versi cache di bawah.
// ============================================================
const CACHE = "terasmbun-v75";
const PRECACHE = [
  "./",
  "pesen",
  "pesenan-aku",
  "dapur",
  "admin",
  "css/style.css",
  "js/config.js",
  "js/db.js",
  "js/visitor.js",
  "js/nav.js",
  "js/toast.js",
  "js/notice.js",
  "js/show-popup.js",
  "js/menu.js",
  "js/pesen.js",
  "js/pesenan-aku.js",
  "js/dapur.js",
  "js/admin.js",
  "js/pwa-refresh.js",
  "manifest.webmanifest",
];

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(PRECACHE)));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      const oldKeys = keys.filter((k) => k !== CACHE);
      await Promise.all(oldKeys.map((k) => caches.delete(k)));
      await self.clients.claim();
      // Kalo ada cache versi lama yang baru dibersihkan (artinya ini update/bump versi),
      // kabari semua tab yang lagi kebuka biar nampilin toast lalu auto-refresh.
      if (oldKeys.length > 0) {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          try {
            client.postMessage({ tipe: "versi-baru", cache: CACHE });
          } catch (_) {}
        }
      }
    })(),
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  // API Supabase & font eksternal: network first (data harus fresh)
  if (url.origin !== location.origin) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }
  // navigasi (buka halaman): NETWORK FIRST — HTML selalu versi terbaru.
  // Cache-first di sini = shell basi nyangkut: kode baru (mis. visitor.js)
  // gak pernah kebuka karena cache lama duluan yang diservis.
  if (e.request.mode === "navigate") {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => caches.match(e.request)),
    );
    return;
  }
  // aset same-origin (js/css/gambar): cache dulu, update di belakang
  e.respondWith(
    caches.match(e.request).then((cached) => {
      const jaring = fetch(e.request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || jaring;
    }),
  );
});
