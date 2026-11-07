// ============================================================
// menu.js — sisi CUSTOMER (index): showcase menu
// Pesenan PINDAH ke pesen (js/pesen.js).
// ============================================================

const Menu = (function () {
  "use strict";

  let daftar = []; // isi tabel menu

  // ── util ──
  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
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

  // ── render ──
  // grouping: menu dikelompokin per kategori — SEMUA tampil
  // (gak ada lagi tombol "lihat menu lain")
  function kelompokkan() {
    const peta = new Map();
    daftar.forEach((m) => {
      const k = m.kategori || "lain";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(m);
    });
    return [...peta.entries()].map(([kat, items]) => ({ kat, items }));
  }

  const labelKat = (k) => String(k || "lain").replace(/_/g, " ");

  // showcase: foto di atas, judul+deskripsi di bawahnya — per kategori
  function renderTampil() {
    const box = document.getElementById("menuTampil");
    if (!daftar.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    box.innerHTML = kelompokkan()
      .map(
        (g) => `
      <div class="menu-grup">
        <div class="kat-judul"><span class="ikon">${emojiKategori(g.kat)}</span><span class="label">${esc(labelKat(g.kat))}</span></div>
        ${g.items.map((m, ix) => blokTampil(m, ix)).join("")}
      </div>`,
      )
      .join("");
  }

  function blokTampil(m, ix) {
    const adaFoto = !!m.gambar;
    return `<div class="tampil-blok" style="animation-delay:${ix * 40}ms">
      <div class="tampil-foto ${adaFoto ? "" : "kosong-foto"}">
        ${
          adaFoto
            ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy"
                  onerror="this.closest('.tampil-foto').classList.add('kosong-foto'); this.remove();">`
            : ""
        }
        <span class="foto-emoji">${emojiKategori(m.kategori)}</span>
      </div>
      <div class="tampil-info">
        <div class="baris-atas">
          <span class="nama">${esc(m.nama)}</span>
          <span class="harga">${rupiah(m.harga)}</span>
        </div>
        ${m.deskripsi ? `<p class="deskripsi">${esc(m.deskripsi)}</p>` : ""}
      </div>
    </div>`;
  }

  // emoji placeholder kalo foto menu belum ada
  function emojiKategori(kat) {
    const peta = {
      nasi: "🍚",
      minuman: "🥤",
      lauk: "🍗",
      lauk_pauk: "🍗",
      snack: "🍘",
    };
    return peta[String(kat || "").toLowerCase()] || "🍽️";
  }

  // ── daftar section di dropdown hamburger ──
  // (pindah ke js/nav.js — header seragam di semua halaman)

  // ── floating button pesan sekarang (muncul pas scroll menu, hilang di paling atas / bawah) ──
  function pasangFloatingPesan() {
    const floatBtn = document.getElementById("floatPesan");
    const greeting = document.getElementById("greeting");
    const ctaBawah = document.getElementById("ctaBawah");
    if (!floatBtn) return null;

    let ticking = false;

    function atur() {
      ticking = false;
      const scrollY = window.scrollY || window.pageYOffset || 0;
      const innerH = window.innerHeight;
      const scrollH = document.documentElement.scrollHeight;

      // 1. Paling atas: greeting masih menempati area layar utama
      let diAtas = scrollY < 180;
      if (greeting) {
        const gRect = greeting.getBoundingClientRect();
        if (gRect.bottom > innerH * 0.35) diAtas = true;
      }

      // 2. Paling bawah: ctaBawah sudah terlihat atau sudah mentok scroll
      let diBawah = false;
      if (scrollY + innerH >= scrollH - 60) {
        diBawah = true;
      }
      if (ctaBawah) {
        const cRect = ctaBawah.getBoundingClientRect();
        if (cRect.top < innerH - 70) {
          diBawah = true;
        }
      }

      const harusMuncul = !diAtas && !diBawah;
      floatBtn.classList.toggle("muncul", harusMuncul);
      floatBtn.setAttribute("aria-hidden", String(!harusMuncul));
    }

    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(atur);
          ticking = true;
        }
      },
      { passive: true },
    );
    window.addEventListener("resize", atur, { passive: true });
    atur();
    return atur;
  }

  // ── init ──
  async function mulai() {
    renderTampil();
    const aturFloat = pasangFloatingPesan();
    // (dropdown hamburger diurus js/nav.js — header seragam)

    // tombol scroll ke daerah menu
    ["btnLihatMenu", "btnScrollMenu"].forEach((id) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.preventDefault();
          const el = document.getElementById("daftar");
          if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });

    // muat menu
    try {
      daftar = await TmDb.muatMenu();
      renderTampil();
      if (aturFloat) aturFloat();
    } catch (err) {
      document.getElementById("menuTampil").innerHTML =
        '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';
      showToast(TmDb.pesanRamah(err), "error");
    }

    // foto latar dari setting (kosong = gradient hangat)
    try {
      TmDb.terapkanBg((await TmDb.infoWarung()).bg || "");
    } catch (e) {
      /* latar default tetep jalan */
    }
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
