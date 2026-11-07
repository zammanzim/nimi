// ============================================================
// nav.js — header SERAGAM (brand + hamburger) buat semua halaman
// pelanggan: index, pesen, pesenan-aku. (admin & dapur punya
// header sendiri — gak pake ini).
// Dropdown isinya: Beranda, Lihat Menu, Pesan, Pesenan Aku —
// plus Dapur + Admin kalo ada akses admin (liat cekAksesAdmin).
// Dipanggil otomatis pas DOMContentLoaded; halaman cukup nyediain
// <button id="btnNavMenu"> + <nav id="navPanel" hidden>.
// ============================================================

const TmNav = (function () {
  "use strict";

  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );

  // lagi di index? anchor (#greeting) langsung di-scroll.
  // di halaman lain → pindah ke index dulu (browser yg scroll sendiri).
  const diIndex = /\/(index(\.html)?)?$/.test(location.pathname);
  const rootPath = /(\.html)$/.test(location.pathname) ? "index.html" : "/";

  // ── daftar section di dropdown hamburger ──
  // anchor = id section di index; page = pindah halaman.
  const NAV_UTAMA = [
    { anchor: "greeting", label: "Beranda", icon: "fa-house" },
    { anchor: "daftar", label: "Lihat Menu", icon: "fa-utensils" },
    { page: "pesen", label: "Pesan", icon: "fa-cart-shopping" },
    { page: "pesenan-aku", label: "Pesenan Aku", icon: "fa-receipt" },
  ];
  const NAV_ADMIN = [
    { page: "dapur", label: "Dapur", icon: "fa-fire-burner" },
    { page: "admin", label: "Admin", icon: "fa-gear" },
  ];

  const hrefDari = (s) =>
    s.page
      ? s.page
      : diIndex
        ? "#" + s.anchor
        : s.anchor === "greeting"
          ? rootPath
          : rootPath === "/"
            ? "/#" + s.anchor
            : rootPath + "#" + s.anchor;

  // ── akses admin lewat URL: terasmbun.my.id/?password=XXXX ──
  // Kalo password-nya bener (= PIN dapur/admin, dicek server via RPC
  // cek_pin), simpen ke sesi PIN. Efeknya:
  //   1) hamburger dapet item Dapur + Admin
  //   2) halaman dapur/admin langsung kebuka — gate PIN gak nongol
  // Sekali verifikasi, berlaku selama sesi browser aktif (sampe browser ditutup).
  async function cekAksesAdmin() {
    if (typeof TmDb !== "undefined" && TmDb.getPinSession && TmDb.getPinSession()) {
      return true; // udah pernah verif di sesi browser ini
    }
    if (typeof TM_PIN_KEY !== "undefined" && sessionStorage.getItem(TM_PIN_KEY)) {
      return true;
    }
    const pw = new URLSearchParams(location.search).get("password");
    if (!pw) return false;
    try {
      if (typeof TmDb !== "undefined" && (await TmDb.cekPin(pw))) {
        if (TmDb.setPinSession) {
          TmDb.setPinSession(pw);
        } else if (typeof TM_PIN_KEY !== "undefined") {
          sessionStorage.setItem(TM_PIN_KEY, pw);
        }
        // param dibuang dari address bar: PIN gak usah nongol di
        // history / screenshot / "halaman terakhir"
        history.replaceState(null, "", location.pathname);
        return true;
      }
    } catch (e) {
      /* offline / RPC error — anggap gak punya akses */
    }
    return false;
  }

  function pasangDropdown(aksesAdmin) {
    const btn = document.getElementById("btnNavMenu");
    const panel = document.getElementById("navPanel");
    if (!btn || !panel) return;

    // render link dari NAV_UTAMA (+ Admin/Dapur kalo akses)
    const nav = aksesAdmin ? NAV_UTAMA.concat(NAV_ADMIN) : NAV_UTAMA;
    panel.innerHTML = nav
      .map(
        (s) =>
          `<a href="${esc(hrefDari(s))}"><i class="fa-solid ${esc(s.icon)}"></i> ${esc(s.label)}</a>`,
      )
      .join("");

    const tutup = () => {
      panel.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const buka = panel.hidden;
      panel.hidden = !buka;
      btn.setAttribute("aria-expanded", String(buka));
    });

    // klik link → kalo anchor di halaman ini, smooth scroll; kalo
    // pindah halaman, biarin jalan (tutup panel dulu)
    panel.addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      const href = a.getAttribute("href");
      if (href && !href.startsWith("#")) {
        tutup();
        return;
      } // pindah halaman
      e.preventDefault();
      if (href === "#greeting") {
        // Beranda: scroll ke paling atas beneran (0px).
        // scrollIntoView#greeting mentok di bawah header karena header ikut alur dokumen.
        window.scrollTo({ top: 0, behavior: "smooth" });
      } else {
        const el = document.querySelector(href);
        if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
      }
      tutup();
    });

    // klik di luar / ESC → tutup
    document.addEventListener("click", (e) => {
      if (!panel.hidden && !e.target.closest("#navDropdown")) tutup();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") tutup();
    });
  }

  async function mulai() {
    // cek akses admin (?password= / udah pernah verif di tab ini) dulu,
    // baru render dropdown — item Dapur/Admin muncul kalo akses oke
    let aksesAdmin = false;
    try {
      aksesAdmin = await cekAksesAdmin();
    } catch (e) {
      /* RPC mati — dropdown tetep jalan tanpa item admin */
    }
    pasangDropdown(aksesAdmin);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mulai);
  } else {
    mulai();
  }

  return {};
})();
