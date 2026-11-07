// ============================================================
// pesenan-aku.js — halaman PESENAN AKU (riwayat pelanggan).
// Sumbernya LOCAL STORAGE (bukan ?kode=): tiap pesenan yang pernah
// dikirim kesimpen di situ sebagai baris mirip DB, halaman ini gambar
// SEMUA kartu riwayat, terus ditimpa data asli dari DB (status live).
// QRIS digabung di dalem kartu pesenannya — gak kartu terpisah.
// ============================================================

const PesenanAku = (function () {
  "use strict";

  const KEY = "tm_history_pesenan"; // localStorage: array baris pesanan
  const KEY_LAMA = "tm_pesenan_aku"; // snapshot lama (sekali pindahan)
  const MAKS = 20; // riwayat disimpen paling banyak 20

  let daftarPsn = []; // riwayat, paling baru di atas
  let riwayatBuka = false; // false = riwayat lama disembunyiin (baru tampil 1)
  let waPenjual = "";
  let fotoQris = "";

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) =>
    String(s == null ? "" : s).replace(
      /[&<>\"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  const tanggal = (iso) =>
    new Date(iso).toLocaleString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  // label status → ikon + teks + warna
  const STATUS = {
    menunggu: {
      ikon: "fa-solid fa-hourglass-half",
      teks: "Menunggu dapur",
      kelas: "s-menunggu",
    },
    dibuat: {
      ikon: "fa-solid fa-fire-burner",
      teks: "Lagi dibuat",
      kelas: "s-dibuat",
    },
    siap: { ikon: "fa-solid fa-check", teks: "Siap!", kelas: "s-siap" },
  };

  // ── baca / simpan riwayat di localStorage ──
  function bacaRiwayat() {
    try {
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      return Array.isArray(arr) ? arr.filter((p) => p && p.kode) : [];
    } catch (e) {
      return [];
    }
  }
  function simpanRiwayat() {
    try {
      localStorage.setItem(KEY, JSON.stringify(daftarPsn.slice(0, MAKS)));
    } catch (e) {
      /* storage penuh / private mode — tampilan tetep jalan */
    }
  }

  // teks jadwal kirim yang enak dibaca
  function teksJadwal(p) {
    if (p.kapan === "besok") {
      const b = new Date(p.created_at);
      b.setDate(b.getDate() + 1);
      return (
        "Besok, " +
        b.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        })
      );
    }
    if (p.kapan === "custom" && p.waktu_teks) return p.waktu_teks; // teks bebas user
    return "Sekarang";
  }

  // ── 1 kartu riwayat (rincian + info + QRIS jadi satu) ──
  function kartuHtml(p, ix) {
    const items = Array.isArray(p.items) ? p.items : [];
    const s = STATUS[p.status] || STATUS.menunggu;
    const urut = ["menunggu", "dibuat", "siap"];
    const kini = urut.indexOf(p.status);
    const qris = p.metode_bayar === "qris"; // dipake blok WA + blok QRIS

    // langkah progress Menunggu → Dibuat → Siap
    const langkah = [
      ["menunggu", "fa-solid fa-receipt", "Menunggu"],
      ["dibuat", "fa-solid fa-fire-burner", "Dibuat"],
      ["siap", "fa-solid fa-check", "Siap"],
    ]
      .map(
        ([v, ikon, teks], ixL) => `
      <li class="${ixL < kini ? "lewat" : ""}${ixL === kini ? " aktif" : ""}">
        <i class="${ikon}"></i><span>${teks}</span>
      </li>`,
      )
      .join("");

    // rincian item + ongkir (kalo COD)
    const ongkirBaris =
      Number(p.ongkir || 0) > 0
        ? `<li><span>Ongkir COD </span><b>+${rupiah(p.ongkir)}</b></li>`
        : "";
    const daftarItem =
      items
        .map(
          (i) =>
            `<li><span>${esc(i.nama || "Menu")} ${esc(i.qty || 1)}x${i.level > 0 ? ` <b class="lvl-item">🌶️${esc(i.level)}</b>` : ""}</span><b>${rupiah((i.harga || 0) * (i.qty || 1))}</b></li>`,
        )
        .join("") + ongkirBaris;

    // baris info
    const baris = [];
    baris.push(["fa-regular fa-clock", "Dibuat", tanggal(p.created_at)]);
    if (p.metode_ambil === "cod") {
      baris.push(["fa-regular fa-calendar", "Diantar kapan", teksJadwal(p)]);
    }
    baris.push([
      p.metode_ambil === "cod" ? "fa-solid fa-motorcycle" : "fa-solid fa-store",
      p.metode_ambil === "cod" ? "Diantar" : "Ambil di toko",
      p.metode_ambil === "cod" ? p.alamat || "—" : "Teras Mbun",
    ]);
    if (p.metode_bayar) {
      baris.push([
        p.metode_bayar === "qris"
          ? "fa-solid fa-qrcode"
          : "fa-solid fa-money-bill-wave",
        "Bayar",
        p.metode_bayar === "qris" ? "QRIS" : "Tunai",
      ]);
    }
    const ongkirAda = Number(p.ongkir || 0) > 0;
    if (ongkirAda)
      baris.push(["fa-solid fa-truck", "Ongkir*", `+${rupiah(p.ongkir)}`]);
    const infoHtml =
      baris
        .map(
          ([ikon, label, nilai]) => `
      <div class="aku-baris"><i class="${ikon}"></i>
        <span class="lbl">${esc(label)}</span>
        <span class="val">${esc(nilai)}</span>
      </div>`,
        )
        .join("") +
      (ongkirAda
        ? `<p class="catatan-ongkir kecil"><i class="fa-solid fa-circle-info"></i>
             <span>*Ongkir — Rp${Number(p.ongkir).toLocaleString("id-ID")} cuma awal,
             bisa berubah tergantung makin deket / makin jauh.</span></p>`
        : "");

    // QRIS: di dalem kartu yang sama (gak kartu terpisah lagi)
    const qrisHtml = `
      <div class="qris-bayar aku-qris" data-kode="${esc(p.kode)}" ${qris ? "" : "hidden"}>
        <h3 class="aku-judul"><i class="fa-solid fa-qrcode"></i> Bayar QRIS</h3>
        <p class="qris-total">Total bayar: ${rupiah(p.total)}</p>
        <div class="qris-foto" data-foto="${esc(p.kode)}"></div>
        <p class="catatan-qris" data-catatan="${esc(p.kode)}"></p>
      </div>`;

    return `<section class="kartu-form aku-detail" data-kode="${esc(p.kode)}" style="animation-delay:${ix * 40}ms">
      <div class="aku-head">
        <span class="aku-kode">Pesanan #${esc(p.kode)}</span>
        <span class="aku-status ${s.kelas}"><i class="${s.ikon}"></i> ${s.teks}</span>
      </div>
      <p class="aku-sapa">${
        p._snapshot
          ? "Lagi nunggu konfirmasi dari dapur…"
          : `Makasih udah pesen, ${esc(p.nama || "Kak")}!`
      }</p>

      <ol class="aku-langkah">${langkah}</ol>

      <!-- aksi utama: WA full-width + keterangan di bawahnya.
           Tombol WA lama di .aku-baris-aksi ikut dipindah ke sini
           (biar gak dobel) -->
      <div class="aku-wa">
        <button class="btn btn-hijau btn-lebar" data-wa="${esc(p.kode)}">
          <i class="fa-brands fa-whatsapp"></i> Hubungi Penjual
        </button>
        <p class="aku-wa-note">
          <i class="fa-solid fa-comment-dots"></i>
          <span>
            <b>Hubungi penjual</b> — langsung hubungi penjual biar pesanan
            segera diproses.
            ${qris ? "<br>Konfirmasi juga kalo kamu udah bayar lewat QRIS." : ""}
          </span>
        </p>
      </div>

      <!-- QRIS (kalo bayarnya qris): paling atas, tepat di bawah
           tombol Hubungi Penjual — biar user tinggal scan -->
      ${qrisHtml}

      <h3 class="aku-judul"><i class="fa-solid fa-receipt"></i> Rincian</h3>
      <ul class="daftar-item">${daftarItem || "<li>Belum ada rincian.</li>"}</ul>
      <p class="rincian-total"><span>Total: </span><b>${rupiah(p.total)}</b></p>

      <h3 class="aku-judul"><i class="fa-solid fa-circle-info"></i> Info</h3>
      <div class="aku-info">${infoHtml}</div>

      <div class="aku-baris-aksi">
        <a class="btn btn-kecil btn-kaca" href="pesen"><i class="fa-solid fa-plus"></i> Pesan lagi</a>
      </div>
    </section>`;
  }

  function render() {
    const box = document.getElementById("daftarAku");
    document.getElementById("akuMuat").hidden = true;
    const kosong = daftarPsn.length === 0;
    document.getElementById("akuKosong").hidden = !kosong;
    box.innerHTML = daftarPsn.map(kartuHtml).join("");
    terapkanRiwayat(); // pesenan baru tampil; lama nunggu dibuka lewat tombol
    isiFotoQris(); // foto QRIS dari setting (kalo udah ke-load)
  }

  // ── sembunyiin/bukain riwayat lama ──
  // Default: cuma pesenan paling baru (ix 0) yang keliatan — sisanya
  // numpuk di bawah tombol "Lihat semua riwayat". Kalo user buka,
  // semua kartu tampil & tombolnya jadi "Tutup riwayat".
  function terapkanRiwayat() {
    const kartu = document.querySelectorAll("#daftarAku .aku-detail");
    const btn = document.getElementById("btnRiwayat");
    const adaLama = kartu.length > 1;
    if (!adaLama) riwayatBuka = false; // 0–1 pesenan: gak ada yg disembunyiin
    btn.hidden = !adaLama;
    kartu.forEach((k, ix) => {
      k.hidden = ix > 0 && !riwayatBuka;
    });
    btn.setAttribute("aria-expanded", String(riwayatBuka));
    btn.innerHTML = riwayatBuka
      ? '<i class="fa-solid fa-chevron-up"></i> Tutup riwayat pesanan'
      : `<i class="fa-solid fa-chevron-down"></i> Lihat semua riwayat pesanan kamu (${kartu.length})`;
  }

  // patch status SATU kartu (pill + langkah) — gak render ulang detail
  function patchStatus(p) {
    const kartu = document.querySelector(
      `#daftarAku [data-kode="${CSS.escape(String(p.kode))}"]`,
    );
    if (!kartu) return;
    const s = STATUS[p.status] || STATUS.menunggu;
    const pill = kartu.querySelector(".aku-status");
    pill.className = "aku-status " + s.kelas;
    pill.innerHTML = `<i class="${s.ikon}"></i> ${s.teks}`;
    const kini = ["menunggu", "dibuat", "siap"].indexOf(p.status);
    kartu.querySelectorAll(".aku-langkah li").forEach((li, ix) => {
      li.classList.toggle("lewat", ix < kini);
      li.classList.toggle("aktif", ix === kini);
    });
  }

  // isi foto QRIS ke semua kartu qris (panggil lagi abis info warung sampai)
  function isiFotoQris() {
    document.querySelectorAll(".aku-qris").forEach((q) => {
      if (q.hidden) return;
      const kotak = q.querySelector(".qris-foto");
      const cat = q.querySelector(".catatan-qris");
      if (fotoQris) {
        kotak.innerHTML = `<img src="${esc(fotoQris)}" alt="QRIS Teras Mbun" loading="lazy">`;
        cat.textContent =
          "Scan pakai aplikasi apa aja, nominal sesuai total. Abis bayar, kabari penjual ya.";
      } else {
        kotak.innerHTML = "";
        cat.textContent =
          "QRIS-nya lagi disiapin — kabari penjual langsung ya.";
      }
    });
  }

  // ── share WA ──
  function teksWa(p) {
    const items = (Array.isArray(p.items) ? p.items : [])
      .map(
        (i) =>
          `• ${i.nama} ${i.qty}x${i.level > 0 ? ` (Pedas Lv${i.level})` : ""}`,
      )
      .join("%0A");
    const ambilTeks =
      p.metode_ambil === "cod" ? "Diantar (COD)" : "Ambil di toko";
    const bayarTeks = p.metode_bayar === "qris" ? "QRIS" : "Tunai";
    return (
      `Halo, mau pesen di Teras Mbun.%0A` +
      `Kode: *${p.kode}*%0A${items}%0ATotal: ${rupiah(p.total)}` +
      `%0ATerima: ${ambilTeks}` +
      (p.alamat ? `%0AAlamat: ${p.alamat}` : "") +
      `%0ADiantar: ${teksJadwal(p)}%0ABayar: ${bayarTeks}`
    );
  }
  function cari(kode) {
    return daftarPsn.find((p) => p.kode === kode);
  }

  // ── tarik data asli dari DB buat semua kode (1 request) ──
  async function segarkan(diam) {
    try {
      const rows = await TmDb.muatPesananByKodes(daftarPsn.map((p) => p.kode));
      if (!rows.length) return;
      rows.forEach((r) => {
        const ix = daftarPsn.findIndex((p) => p.kode === r.kode);
        if (ix < 0) return;
        r._snapshot = false; // data asli dari DB — bukan snapshot lagi
        daftarPsn[ix] = Object.assign({}, daftarPsn[ix], r);
      });
      simpanRiwayat();
      daftarPsn.forEach(patchStatus); // patch pill/langkah doang, gak render ulang
    } catch (e) {
      if (!diam) showToast(TmDb.pesanRamah(e), "error");
    }
  }

  // ── tombol per kartu (event delegate) ──
  function pasangAksi() {
    document.getElementById("daftarAku").addEventListener("click", (e) => {
      const wa = e.target.closest("[data-wa]");
      if (wa) {
        const p = cari(wa.dataset.wa);
        if (!p) return;
        if (!waPenjual) {
          showToast("Nomor penjual belum diisi.", "info");
          return;
        }
        window.open(`https://wa.me/${waPenjual}?text=${teksWa(p)}`, "_blank");
      }
    });

    // buka/tutup riwayat lama (semua kecuali pesenan paling baru)
    const btnRiwayat = document.getElementById("btnRiwayat");
    btnRiwayat.addEventListener("click", () => {
      riwayatBuka = !riwayatBuka;
      terapkanRiwayat();
      // pas dibuka: scroll ke kartu riwayat pertama biar langsung keliatan
      if (riwayatBuka) {
        const semua = document.querySelectorAll("#daftarAku .aku-detail");
        const kartuLama = semua[1]; // ix 0 = pesenan baru, ix 1 = paling baru di antara lama
        if (kartuLama)
          kartuLama.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    });
  }

  async function mulai() {
    daftarPsn = bacaRiwayat();

    // pindahan dari snapshot lama (masa transisi, biar gak ilang)
    if (!daftarPsn.length) {
      try {
        const lama =
          JSON.parse(localStorage.getItem(KEY_LAMA) || "null") ||
          JSON.parse(sessionStorage.getItem(KEY_LAMA) || "null");
        if (lama && lama.kode) {
          daftarPsn = [lama];
          simpanRiwayat();
        }
      } catch (e) {
        /* snap rusak — abaikan */
      }
    }

    // link lama berbentuk ?kode=XXX: masukin ke riwayat biar gak ilang
    const urlKode = new URLSearchParams(location.search).get("kode");
    if (urlKode && !daftarPsn.some((p) => p.kode === urlKode)) {
      try {
        const p = await TmDb.muatPesananByKode(urlKode);
        if (p) daftarPsn.unshift(p);
      } catch (e) {
        /* offline — link lama diabaikan */
      }
    }

    if (!daftarPsn.length) {
      document.getElementById("akuMuat").hidden = true;
      document.getElementById("akuKosong").hidden = false;
      return;
    }

    simpanRiwayat();
    render(); // gambar dari lokal dulu (langsung keliatan, offline pun jalan)
    pasangAksi();
    await segarkan(); // abis itu tarik status terbaru dari DB (kartu gak dirender ulang)

    // info warung: latar + foto QRIS + nomor WA
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
      fotoQris = info.qris || "";
      TmDb.terapkanBg(info.bg || "");
      isiFotoQris();
    } catch (e) {
      /* QRIS/WA jadi teks fallback */
    }

    // live: apapun berubah di dapur → refresh semua kode, patch pill doang
    TmDb.subscribe(() => segarkan(true));
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
