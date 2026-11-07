// ============================================================
// pesen.js — halaman PESAN (form).
// Alur: pilih menu (per kartu: foto + stepper − qty + yang LANGSUNG
// masuk keranjang; baris "Pedas" → sheet atur porsi, tiap porsi bisa
// beda level) → nama & WA
// → diantar (cod) atau ambil di toko → QRIS/tunai → kirim.
// Validasi berat ada di server (RPC), sini cuma ngecek cepet.
// ============================================================

const Pesen = (function () {
  "use strict";

  let daftar = []; // isi tabel menu
  let lvlDraf = new Map(); // level AKTIF per kartu (id → 0..5) — buat tombol +
  let keranjang = []; // committed: [{id, nama, harga, qty, level}]
  // 1 menu boleh punya LEBIH dari satu baris (id sama, level beda):
  // tiap baris = porsi pada SATU level, jadi porsi beda level = beda baris.
  let renderPertama = true; // animasi entrance cuma sekali

  const LEVEL = [
    { v: 0, label: "Gak pedas" },
    { v: 1, label: "Level 1" },
    { v: 2, label: "Level 2" },
    { v: 3, label: "Level 3" },
    { v: 4, label: "Level 4" },
    { v: 5, label: "Level 5" },
  ];

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

  // ── normalisasi nomor WA ──
  // +62812… / 62812… / 812… → 0812…, terus diformat 08XX-XXXX-XXXX.
  // Server (RPC _norm_wa) juga ngelakuin hal yang sama — ini biar user
  // liat hasilnya langsung pas ngetik.
  const normWa = (raw) => {
    let d = String(raw || "").replace(/\D/g, "");
    if (/^62\d{9,}$/.test(d))
      d = "0" + d.slice(2); // +62/62 → 0
    else if (/^8\d{8,}$/.test(d)) d = "0" + d; // 812… → 0812…
    return d;
  };
  const formatWa = (d) =>
    /^08\d{8,}$/.test(d) ? d.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3") : d;

  // ── akses keranjang (banyak baris per menu) ──
  // key baris = id + level; 1 menu bisa muncul berkali-kali dengan level beda
  const baris = (id, level) =>
    keranjang.find((i) => i.id === id && i.level === level);
  const barisDari = (id) => keranjang.filter((i) => i.id === id);
  const qtyKartu = (id) => barisDari(id).reduce((s, i) => s + i.qty, 0);
  const qtyLevel = (id, lv) => {
    const b = baris(id, lv);
    return b ? b.qty : 0;
  };
  const total = () => keranjang.reduce((s, i) => s + i.qty * i.harga, 0);
  const jml = () => keranjang.reduce((s, i) => s + i.qty, 0);

  // ── ongkir COD ──
  // angka AWAL aja — server (RPC buat_pesanan) yang nentuin final,
  // UI cuma nampilin + keterangan "gak fix" (bisa beda deket/jauh).
  // KALAU NGUBAH ANGKA INI: samain sama db/012-ongkir-cod.sql (3000).
  const ONGKIR_COD = 3000;
  const ongkir = () => (nilai("ambil") === "cod" ? ONGKIR_COD : 0);
  const totalBayar = () => total() + ongkir();

  // level pedas terpilih — default MID (2) kalo belum pernah disentuh
  const LVL_AWAL = 2;
  const lvlAt = (id) => (lvlDraf.has(id) ? lvlDraf.get(id) : LVL_AWAL);

  // makanan = kategori bukan minuman — level pedas cuma nongol di kartu ini
  const isMakanan = (id) => {
    const m = daftar.find((x) => x.id === id);
    return !!m && String(m.kategori || "").toLowerCase() !== "minuman";
  };

  // emoji placeholder kalo foto menu belum ada
  const emojiKat = (k) =>
    ({ nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" })[
      String(k || "").toLowerCase()
    ] || "🍽️";

  // ── render kartu menu ──
  // 1 kartu = 1 menu: foto, nama+harga, stepper − qty + (LANGSUNG masuk
  // keranjang), level pedas (khusus makanan, selalu tampil).
  // Kartu dikelompokin per kategori, gaya sama kaya halaman utama.
  const labelKat = (k) => String(k || "lain").replace(/_/g, " ");

  // chip ringkas di baris "Pedas" kartu: level yang ADA di keranjang
  // (lengkap dengan jumlah porsinya) + level AKTIF — level aktif itu yang
  // dipakai tombol + di kartu, biar keliatan nambah porsi ke level mana.
  function isiChips(id) {
    const aktif = lvlAt(id);
    const peta = new Map();
    barisDari(id).forEach((i) =>
      peta.set(i.level, (peta.get(i.level) || 0) + i.qty),
    );
    if (!peta.has(aktif)) peta.set(aktif, 0); // level aktif selalu keliatan
    return [...peta.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(
        ([lv, n]) =>
          `<b class="lvl-chip lv-${lv}${lv === aktif ? " aktif" : ""}" title="Level ${lv}${n ? ` · ${n} porsi` : ""}">${lv}${n ? `<span>×${n}</span>` : ""}</b>`,
      )
      .join("");
  }

  function renderPilih() {
    const grid = document.getElementById("gridPilih");
    if (!daftar.length) {
      grid.innerHTML = '<p class="kosong">Belum ada menu nih.</p>';
      return;
    }
    // kelompokin per kategori
    const peta = new Map();
    daftar.forEach((m) => {
      const k = m.kategori || "lain";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(m);
    });
    let ix = 0; // nomor urut global (buat jeda animasi antar kartu)
    grid.innerHTML = [...peta.entries()]
      .map(
        ([kat, items]) => `
      <div class="kat-seksi">
        <div class="kat-judul"><span class="ikon">${emojiKat(kat)}</span><span class="label">${esc(labelKat(kat))}</span></div>
        <div class="pilih-grid">
          ${items.map((m) => kartuPilih(m, ix++)).join("")}
        </div>
      </div>`,
      )
      .join("");
    if (daftar.length) renderPertama = false;
  }

  function kartuPilih(m, ix) {
    const anim = renderPertama; // entrance animasi cuma pas load pertama
    const q = qtyKartu(m.id);
    const adaFoto = !!m.gambar;
    // level pedas per kartu — khusus makanan, SELALU tampil.
    // Barisnya = TOMBOL yang buka sheet atur porsi (stepper per level,
    // bebas beda-beda tiap porsi); chip-nya cuma ringkasan, bukan tombol.
    const levelBaris = isMakanan(m.id)
      ? `
      <button type="button" class="level-baris${q ? "" : " mati"}"
              data-porsi="${m.id}" title="Atur porsi & level pedas"
              aria-label="Atur porsi dan level pedas ${esc(m.nama)}">
        <span class="lvl-label"><i class="fa-solid fa-pepper-hot"></i> Pedas <i class="fa-solid fa-chevron-right lvl-more"></i></span>
        <span class="lvl-chips">${isiChips(m.id)}</span>
      </button>`
      : "";
    return `<div class="kartu-menu${q ? " di-keranjang" : ""}${anim ? " anim" : ""}"
            data-kartu="${m.id}"
            ${anim ? `style="animation-delay:${ix * 30}ms"` : ""}>
      <div class="foto ${adaFoto ? "" : "kosong-foto"}">
        ${
          adaFoto
            ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy"
                  onerror="this.closest('.foto').classList.add('kosong-foto'); this.remove();">`
            : ""
        }
        <span class="foto-emoji">${emojiKat(m.kategori)}</span>
      </div>
      <div class="info">
        <span class="nama">${esc(m.nama)}</span>
        <span class="harga">${rupiah(m.harga)}</span>
      </div>
      <div class="aksi">
        <button type="button" class="qty-btn" data-kurang="${m.id}" ${q ? "" : "disabled"} aria-label="Kurangi ${esc(m.nama)}">−</button>
        <span class="qty-num">${q}</span>
        <button type="button" class="qty-btn" data-tambah="${m.id}" aria-label="Tambah ${esc(m.nama)}">+</button>
      </div>
      ${levelBaris}
    </div>`;
  }

  // ── aksi kartu ──
  // Stepper − / + LANGSUNG nulis ke keranjang (gak ada tombol "masuk
  // keranjang" lagi). Patch SATU kartu doang tanpa render ulang grid —
  // kalo grid di-innerHTMl ulang, SEMUA <img> dilepas+di-decode lagi
  // tiap klik → foto pada kedip.
  function patchKartu(id) {
    const kartu = document.querySelector(`[data-kartu="${id}"]`);
    if (!kartu) return; // grid belum ke-render (atau menu gagal muat)
    const q = qtyKartu(id);

    kartu.classList.toggle("di-keranjang", q > 0);
    kartu.querySelector(".qty-num").textContent = q;
    kartu.querySelector("[data-kurang]").disabled = !q;

    const barisEl = kartu.querySelector(".level-baris");
    if (barisEl) {
      barisEl.classList.toggle("mati", !q);
      barisEl.querySelector(".lvl-chips").innerHTML = isiChips(id);
    }
  }

  function ubahQty(id, delta) {
    const m = daftar.find((x) => x.id === id);
    if (!m) return;
    const sekarang = qtyKartu(id);
    const q = Math.max(0, Math.min(50, sekarang + delta));
    if (!q) {
      keranjang = keranjang.filter((i) => i.id !== id); // 0 = keluar keranjang
    } else if (delta > 0 && q > sekarang) {
      // nambah: masuk ke baris level AKTIF (yang disorot di baris Pedas);
      // minuman gak bawa level (server juga maksa 0)
      const lv = isMakanan(id) ? lvlAt(id) : 0;
      const b = baris(id, lv);
      if (b) b.qty += q - sekarang;
      else
        keranjang.push({
          id: m.id,
          nama: m.nama,
          harga: m.harga,
          qty: q - sekarang,
          level: lv,
        });
    } else if (delta < 0 && q < sekarang) {
      // ngurangi: baris level aktif dulu, sisanya baris level lain
      const aktif = isMakanan(id) ? lvlAt(id) : 0;
      const urut = barisDari(id).sort(
        (a, b) => (b.level === aktif) - (a.level === aktif),
      );
      let sisa = sekarang - q;
      urut.forEach((b) => {
        const ambil = Math.min(b.qty, sisa);
        b.qty -= ambil;
        sisa -= ambil;
      });
      keranjang = keranjang.filter((i) => i.qty > 0);
    }
    patchKartu(id);
    renderRingkas();
  }

  // ── sheet ATUR PORSI: stepper per level (0..5) ──
  // Dibuka dari baris "Pedas" di kartu. Semua aksi nulis LANGSUNG ke
  // keranjang (gak ada tombol simpan) — konsisten sama stepper di kartu.
  let porsiId = null; // menu yang lagi diatur di sheet

  function porsiTerbuka() {
    return document
      .getElementById("sheetPorsi")
      .classList.contains("terbuka");
  }

  function bukaPorsi(id) {
    if (!isMakanan(id)) return; // minuman gak bawa level
    porsiId = id;
    renderPorsi();
    document.getElementById("sheetPorsi").classList.add("terbuka");
    document.getElementById("tiraiPorsi").classList.add("terbuka");
    document.getElementById("sheetPorsi").setAttribute("aria-hidden", "false");
    document.getElementById("tiraiPorsi").setAttribute("aria-hidden", "false");
  }

  function tutupPorsi() {
    porsiId = null;
    document.getElementById("sheetPorsi").classList.remove("terbuka");
    document.getElementById("tiraiPorsi").classList.remove("terbuka");
    document.getElementById("sheetPorsi").setAttribute("aria-hidden", "true");
    document.getElementById("tiraiPorsi").setAttribute("aria-hidden", "true");
  }

  function renderPorsi() {
    if (porsiId == null) return;
    const m = daftar.find((x) => x.id === porsiId);
    if (!m) return tutupPorsi();
    const aktif = lvlAt(m.id);
    const q = qtyKartu(m.id);

    document.getElementById("porsiJudul").textContent = m.nama;
    document.getElementById("porsiHarga").textContent =
      rupiah(m.harga) + "/porsi";
    document.getElementById("porsiLevel").innerHTML = LEVEL.map((l) => {
      const n = qtyLevel(m.id, l.v);
      return `<li class="porsi-baris">
        <span class="porsi-nama">
          <b class="lvl-chip lv-${l.v}${l.v === aktif ? " aktif" : ""}">${l.v}</b>
          ${esc(l.label)}
        </span>
        <span class="porsi-stepper">
          <button type="button" class="qty-btn" data-kurang-lv="${l.v}"
            ${n ? "" : "disabled"} aria-label="Kurangi ${esc(l.label)}">−</button>
          <b class="qty-num">${n}</b>
          <button type="button" class="qty-btn" data-tambah-lv="${l.v}"
            aria-label="Tambah ${esc(l.label)}">+</button>
        </span>
      </li>`;
    }).join("");
    document.getElementById("porsiRingkas").textContent = q + " porsi";
    document.getElementById("porsiTotal").textContent = rupiah(q * m.harga);
    document.getElementById("btnKosongPorsi").hidden = !q;
  }

  function ubahPorsi(lv, delta) {
    const id = porsiId;
    const m = daftar.find((x) => x.id === id);
    if (!m) return;
    // level yang disentuh jadi "aktif" — tombol + di kartu nambah ke sini
    lvlDraf.set(id, lv);
    const totalKini = qtyKartu(id);
    const lama = qtyLevel(id, lv);
    // batas: 0..50 per level, total per menu juga maks 50 (sama kaya server)
    const n = Math.max(0, Math.min(lama + delta, 50, 50 - (totalKini - lama)));
    if (n !== lama) {
      if (n === 0) {
        keranjang = keranjang.filter(
          (i) => !(i.id === id && i.level === lv),
        );
      } else {
        const b = baris(id, lv);
        if (b) b.qty = n;
        else
          keranjang.push({
            id: m.id,
            nama: m.nama,
            harga: m.harga,
            qty: n,
            level: lv,
          });
      }
    }
    patchKartu(id); // qty + chip aktif di kartu ikut sync
    renderRingkas(); // ringkasan + bar total + draf kesimpen
    renderPorsi(); // angka di sheet (jalan walau kepentok batas)
  }

  // daftar item buat ringkasan / sheet keranjang: 1 menu digabung jadi
  // SATU baris (qty total + rincian tiap level) biar gak keliatan dobel
  function barisKeranjang() {
    const peta = new Map();
    keranjang.forEach((i) => {
      let g = peta.get(i.id);
      if (!g) {
        g = { nama: i.nama, harga: i.harga, qty: 0, lvl: [] };
        peta.set(i.id, g);
      }
      g.qty += i.qty;
      g.lvl.push({ v: i.level || 0, n: i.qty });
    });
    return [...peta.values()]
      .map((g) => {
        const rame = g.lvl.length > 1; // beda level → tiap porsi dikasih tanda
        const tanda = g.lvl
          .filter((l) => rame || l.v > 0)
          .map(
            (l) =>
              ` <b class="lvl-item">🌶️Lv${l.v}${l.n > 1 ? "×" + l.n : ""}</b>`,
          )
          .join("");
        return `<li><span>${esc(g.nama)} ${g.qty}x${tanda}</span><b>${rupiah(g.qty * g.harga)}</b></li>`;
      })
      .join("");
  }

  function renderRingkas() {
    const box = document.getElementById("ringkas");
    if (!keranjang.length) {
      box.innerHTML = '<p class="kosong">Belum ada menu yang dipilih.</p>';
    } else {
      box.innerHTML = `
        <h2><i class="fa-solid fa-receipt"></i> Ringkasan</h2>
        <ul class="daftar-item">
          ${barisKeranjang()}
          ${ongkir() ? `<li class="rincian-ongkir"><span>Ongkir COD <i class="fa-solid fa-circle-info" title="gak fix"></i></span><b>+${rupiah(ongkir())}</b></li>` : ""}
          <li class="rincian-total"><span>Total</span><b>${rupiah(totalBayar())}</b></li>
        </ul>
        ${ongkir() ? '<p class="catatan-ongkir kecil"><i class="fa-solid fa-info-circle"></i><span>Ongkir +Rp3.000 cuma perkiraan awal, bisa berubah tergantung deket / jauh. Konfirmasi lagi yaa.</span></p>' : ""}`;
    }
    document.getElementById("barJml").textContent = jml() + " item";
    document.getElementById("barTotal").textContent = rupiah(totalBayar());
    if (sheetTerbuka()) renderSheet(); // sheet ikut ke-update
    simpanDraf(); // aksi pilih menu / ganti level = ke-save
  }

  function renderSemua() {
    renderPilih();
    renderRingkas();
  }

  // ── wizard: 1 kartu tampil per langkah ──
  // langkah 1..5 = form, 6 = konfirmasi (tombol kirim ada di dalem kartu,
  // bar bawah sengaja disembunyiin di langkah 6 — ilang + gak ganggu).
  // Khusus kalo user pilih "Ambil di toko", langkah 5 (kapan diantar)
  // dilewati otomatis (total jadi 5 langkah).
  const MAKS_LANGKAH = 6;
  let langkah = 1;

  const nilai = (nama) =>
    (document.querySelector(`input[name="${nama}"]:checked`) || {}).value || "";

  const cumaAmbil = () => nilai("ambil") === "ambil";

  function langkahBerikutnya(dari) {
    if (cumaAmbil() && dari === 4) return 6; // lewati langkah 5 (kapan diantar)
    return Math.min(MAKS_LANGKAH, dari + 1);
  }

  function langkahSebelumnya(dari) {
    if (cumaAmbil() && dari === 6) return 4; // balik langsung ke langkah 4
    return Math.max(1, dari - 1);
  }

  function perbaruiIndikator() {
    const ambilDiToko = cumaAmbil();
    const total = ambilDiToko ? 5 : 6;
    // nomor langkah visual: kalo ambil di toko, langkah 6 (konfirmasi) tampil sebagai langkah 5
    const langkahVisual = ambilDiToko && langkah === 6 ? 5 : langkah;
    const ixVisual = langkahVisual - 1;

    document.querySelectorAll("#stepDots i").forEach((dot, ix) => {
      if (ix >= total) {
        dot.hidden = true;
      } else {
        dot.hidden = false;
        dot.classList.toggle("aktif", ix < ixVisual);
        dot.classList.toggle("kini", ix === ixVisual);
      }
    });
    document.getElementById("stepCap").textContent =
      `Langkah ${langkahVisual} dari ${total}`;
  }

  function tampilLangkah(n, gulir = true) {
    if (cumaAmbil() && n === 5) n = 6;
    langkah = Math.max(1, Math.min(MAKS_LANGKAH, n));
    document.querySelectorAll("[data-langkah]").forEach((el) => {
      el.hidden = Number(el.dataset.langkah) !== langkah;
    });

    perbaruiIndikator();

    // bar bawah: ilang di langkah konfirmasi, tombol ← ilang di langkah 1
    document.getElementById("barKirim").hidden = langkah === MAKS_LANGKAH;
    document.getElementById("btnBack").hidden = langkah === 1;

    if (langkah === MAKS_LANGKAH) renderKonfirmasi(); // snapshot isi form

    simpanDraf(); // posisi langkah ikut kesimpen
    if (gulir) window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function lanjut() {
    if (!validLangkah(langkah)) return;
    tampilLangkah(langkahBerikutnya(langkah));
  }
  function mundur() {
    tampilLangkah(langkahSebelumnya(langkah));
  }

  // validasi isi SATU langkah; false = ada yang kurang
  // (toast + fokus elemennya udah diurus di dalem)
  function validLangkah(n) {
    if (n === 1) {
      if (!keranjang.length) {
        showToast("Pilih menu dulu ya.", "info");
        return false;
      }
      return true;
    }
    if (n === 2) {
      const nama = document.getElementById("inNama").value.trim();
      const wa = formatWa(normWa(document.getElementById("inWa").value));
      if (!nama) {
        showToast("Isi nama dulu ya.", "error");
        document.getElementById("inNama").focus();
        return false;
      }
      if (!wa) {
        showToast("Isi nomor WA dulu ya.", "error");
        document.getElementById("inWa").focus();
        return false;
      }
      if (!/^08\d{9,12}$/.test(wa.replace(/\D/g, ""))) {
        showToast("Nomor WA kayaknya belum bener (harus 08…).", "error");
        document.getElementById("inWa").focus();
        return false;
      }
      return true;
    }
    if (n === 3) {
      const ambil = nilai("ambil");
      if (!ambil) {
        showToast("Pilih mau diantar atau ambil sendiri.", "info");
        document
          .getElementById("opsiAmbil")
          .scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      }
      if (
        ambil === "cod" &&
        !document.getElementById("inAlamat").value.trim()
      ) {
        showToast("Isi alamat buat diantar.", "error");
        document.getElementById("inAlamat").focus();
        return false;
      }
      return true;
    }
    if (n === 4) {
      if (!nilai("bayar")) {
        showToast("Pilih mau bayar QRIS atau tunai.", "info");
        document
          .getElementById("opsiBayar")
          .scrollIntoView({ behavior: "smooth", block: "center" });
        return false;
      }
      return true;
    }
    if (n === 5) {
      if (cumaAmbil()) return true; // langkah 5 gak dipake kalo ambil di toko
      if (
        nilai("kapan") === "custom" &&
        !document.getElementById("inWaktu").value.trim()
      ) {
        showToast("Tulis jam kirimnya dulu ya.", "error");
        document.getElementById("inWaktu").focus();
        return false;
      }
      return true;
    }
    return true;
  }

  // teks jadwal kirim yang enak dibaca (kartu konfirmasi)
  function teksKapan(kapan, waktuTeks) {
    if (kapan === "besok") {
      const b = new Date(Date.now() + 864e5);
      return (
        "Besok (" +
        b.toLocaleDateString("id-ID", {
          weekday: "short",
          day: "numeric",
          month: "short",
        }) +
        ")"
      );
    }
    if (kapan === "custom" && waktuTeks) return waktuTeks; // teks bebas user ("jam 5 sore")
    return "Sekarang";
  }

  // isi kartu konfirmasi: ringkasan (#ringkas) udah ke-render sendiri,
  // sini cuma nambah baris info (nama, terima, bayar, jadwal)
  function renderKonfirmasi() {
    const nama = document.getElementById("inNama").value.trim();
    const wa = formatWa(normWa(document.getElementById("inWa").value));
    const ambil = nilai("ambil");
    const bayar = nilai("bayar");
    const kapan = nilai("kapan") || "sekarang";
    const alamat = document.getElementById("inAlamat").value.trim();
    const waktuTeks = document.getElementById("inWaktu").value.trim();

    const baris = [];
    if (nama) baris.push(["fa-solid fa-user", "Nama", nama]);
    if (wa) baris.push(["fa-brands fa-whatsapp", "No. WA", wa]);
    baris.push([
      ambil === "cod" ? "fa-solid fa-motorcycle" : "fa-solid fa-store",
      "Terima",
      ambil === "cod" ? "Diantar (COD)" : "Ambil di toko",
    ]);
    if (ambil === "cod" && alamat)
      baris.push(["fa-solid fa-location-dot", "Alamat", alamat]);
    if (ambil === "cod")
      baris.push(["fa-solid fa-truck", "Ongkir*", "+Rp3.000 (gak fix)"]);
    if (bayar)
      baris.push([
        bayar === "qris" ? "fa-solid fa-qrcode" : "fa-solid fa-money-bill-wave",
        "Bayar",
        bayar === "qris" ? "QRIS" : "Tunai",
      ]);
    if (ambil === "cod") {
      baris.push([
        "fa-regular fa-calendar",
        "Diantar kapan",
        teksKapan(kapan, waktuTeks),
      ]);
    }

    document.getElementById("konfInfo").innerHTML = baris
      .map(
        ([ikon, label, nilaiTeks]) => `
      <div class="aku-baris"><i class="${ikon}"></i>
        <span class="lbl">${esc(label)}</span>
        <span class="val">${esc(nilaiTeks)}</span>
      </div>`,
      )
      .join("");
  }

  // ── draf pesenan (sessionStorage) ──
  // Tiap aksi (pilih menu, isi form, ganti langkah) langsung disimpen.
  // Kalo halaman di-refresh / user balik ke beranda trus masuk lagi,
  // isi form + keranjangnya balik persis — gak ngulang dari nol.
  const DRAF_KEY = "tm_draf_pesen";
  let drafSiap = false; // true = draf udah kebaca, boleh mulai nulis

  const nilaiInput = (id) => (document.getElementById(id) || {}).value || "";

  function simpanDraf() {
    if (!drafSiap) return; // jangan nimpa draf lama sebelum sempat dibaca
    try {
      sessionStorage.setItem(
        DRAF_KEY,
        JSON.stringify({
          keranjang,
          lvl: [...lvlDraf.entries()],
          nama: nilaiInput("inNama"),
          wa: nilaiInput("inWa"),
          alamat: nilaiInput("inAlamat"),
          waktu: nilaiInput("inWaktu"),
          ambil: nilai("ambil"),
          bayar: nilai("bayar"),
          kapan: nilai("kapan"),
          langkah,
        }),
      );
    } catch (e) {
      /* private mode dll — draf mati, form tetep jalan */
    }
  }

  function bacaDraf() {
    try {
      return JSON.parse(sessionStorage.getItem(DRAF_KEY) || "null");
    } catch (e) {
      return null;
    }
  }

  function hapusDraf() {
    try {
      sessionStorage.removeItem(DRAF_KEY);
    } catch (e) {
      /* abaikan */
    }
  }

  // isi ulang form + keranjang dari draf (dipanggil abis menu ke-load)
  function pulihkanDraf(d) {
    if (!d) return;

    // keranjang: buang item yang id-nya udah gak ada / gak tersedia lagi
    const idAda = new Set(daftar.map((m) => m.id));
    keranjang = (Array.isArray(d.keranjang) ? d.keranjang : [])
      .filter((i) => i && idAda.has(Number(i.id)))
      .map((i) => ({
        id: Number(i.id),
        nama: i.nama,
        harga: Number(i.harga) || 0,
        qty: Number(i.qty) || 1,
        level: Number(i.level) || 0,
      }));
    lvlDraf = new Map(Array.isArray(d.lvl) ? d.lvl : []);

    const isi = {
      inNama: d.nama,
      inWa: d.wa,
      inAlamat: d.alamat,
      inWaktu: d.waktu,
    };
    Object.keys(isi).forEach((id) => {
      const el = document.getElementById(id);
      if (el && isi[id]) el.value = isi[id];
    });

    // radio pilihan + state tampilnya (alamat / peta / jam custom / ongkir)
    [
      ["ambil", d.ambil],
      ["bayar", d.bayar],
      ["kapan", d.kapan || "sekarang"],
    ].forEach(([nama, v]) => {
      if (!v) return;
      const inp = document.querySelector(`input[name="${nama}"][value="${v}"]`);
      if (!inp) return;
      inp.checked = true;
      const lbl = inp.closest(".opsi");
      lbl.parentElement
        .querySelectorAll(".opsi")
        .forEach((o) => o.classList.toggle("pilih", o === lbl));
    });
    const ambilKini = nilai("ambil");
    document.getElementById("fieldAlamat").hidden = ambilKini !== "cod";
    document.getElementById("catatanOngkir").hidden = ambilKini !== "cod";
    document.getElementById("petaToko").hidden = ambilKini !== "ambil";
    document.getElementById("fieldWaktu").hidden = nilai("kapan") !== "custom";

    daftar.forEach((m) => patchKartu(m.id)); // stepper qty + chip level balik
    renderRingkas();
    let langkahAwal = Math.min(Number(d.langkah) || 1, MAKS_LANGKAH);
    if (ambilKini === "ambil" && langkahAwal === 5) langkahAwal = 4;
    tampilLangkah(langkahAwal, false);

    if (keranjang.length || d.nama) {
      showToast("Lanjut ya — pilihan tadi masih ke-save 😉", "info");
    }
  }

  // ── panel slide-up: daftar menu yang dipilih (klik total di bar bawah) ──
  function sheetTerbuka() {
    return document
      .getElementById("sheetKeranjang")
      .classList.contains("terbuka");
  }
  function toggleSheet(buka) {
    const s = document.getElementById("sheetKeranjang");
    const t = document.getElementById("tiraiSheet");
    const mau = buka === undefined ? !sheetTerbuka() : buka;

    // isi panel DULU sebelum apa pun — biar kalo ada yang error di
    // bawah, panel tetep keisi (bukan kebuka kosong)
    if (mau) renderSheet();

    s.classList.toggle("terbuka", mau);
    t.classList.toggle("terbuka", mau);
    s.setAttribute("aria-hidden", String(!mau));
    t.setAttribute("aria-hidden", String(!mau));

    // chevron: Font Awesome udah nukar <i> → <svg>, dan className
    // di <svg> itu read-only (nulisnya bikin TypeError) — pake classList
    const chev = document.getElementById("totalChevron");
    if (chev && chev.classList) {
      chev.classList.toggle("fa-chevron-down", mau);
      chev.classList.toggle("fa-chevron-up", !mau);
    }
  }
  function renderSheet() {
    const box = document.getElementById("sheetItems");
    const totalBox = document.querySelector("#sheetKeranjang .rincian-total");
    const kosong = !keranjang.length;
    if (box) box.hidden = kosong;
    if (totalBox) totalBox.hidden = kosong;
    const kosongEl = document.getElementById("sheetKosong");
    if (kosongEl) kosongEl.hidden = !kosong;
    if (!box) return;
    box.innerHTML =
      barisKeranjang() +
      (ongkir()
        ? `<li><span>Ongkir COD <b class="lvl-item">gak fix</b></span><b>+${rupiah(ongkir())}</b></li>`
        : "");
    const tot = document.getElementById("sheetTotal");
    if (tot) tot.textContent = rupiah(totalBayar());
    const badge = document.getElementById("sheetJml");
    if (badge) badge.textContent = jml() + " item"; // jumlah item di judul
  }

  // ── pilihan opsi (level / ambil / bayar) + input WA ──
  function pasangOpsi() {
    // input WA: format otomatis 08XX-XXXX-XXXX pas ngetik.
    // kursor dipertahanin: diitung berapa digit sebelum kursor,
    // abis diformat kursor ditaruh lagi setelah jumlah digit yang sama.
    const inpWa = document.getElementById("inWa");
    inpWa.addEventListener("input", () => {
      const pos = inpWa.selectionStart;
      const digitSebelum = inpWa.value.slice(0, pos).replace(/\D/g, "").length;
      const baru = formatWa(normWa(inpWa.value));
      if (inpWa.value !== baru) {
        inpWa.value = baru;
        let hitung = 0,
          i = 0;
        for (; i < baru.length && hitung < digitSebelum; i++) {
          if (/\d/.test(baru[i])) hitung++;
        }
        inpWa.setSelectionRange(i, i);
      }
    });

    // ganti state pilih di kartu opsi mana pun (CSS ngikutin class .pilih)
    ["opsiAmbil", "opsiBayar", "opsiKapan"].forEach((id) => {
      document.getElementById(id).addEventListener("change", (e) => {
        const lbl = e.target.closest(".opsi");
        if (!lbl) return;
        lbl.parentElement
          .querySelectorAll(".opsi")
          .forEach((o) => o.classList.toggle("pilih", o === lbl));
        // alamat cuma muncul kalo COD; peta ilustrasi cuma muncul kalo ambil di toko
        if (e.target.name === "ambil") {
          const cod = e.target.value === "cod";
          document.getElementById("fieldAlamat").hidden = !cod;
          if (!cod) document.getElementById("inAlamat").value = "";
          document.getElementById("petaToko").hidden =
            e.target.value !== "ambil";
          document.getElementById("catatanOngkir").hidden = !cod; // keterangan ongkir
          renderRingkas(); // total bar + ringkasan ikut +ongkir
          perbaruiIndikator(); // sesuaikan total & posisi langkah (5 vs 6)
        }
        // isian jam kirim cuma muncul kalo pilih "Pilih waktu"
        if (e.target.name === "kapan") {
          const custom = e.target.value === "custom";
          document.getElementById("fieldWaktu").hidden = !custom;
          if (!custom) document.getElementById("inWaktu").value = "";
        }
        simpanDraf(); // pilihan opsi apa pun ikut kesimpen
      });
    });

    // isian teks (nama / WA / alamat / jam custom) — tiap ketikan kesimpen
    ["inNama", "inWa", "inAlamat", "inWaktu"].forEach((id) => {
      document.getElementById(id).addEventListener("input", simpanDraf);
    });

    // tanggal besok buat label opsi "Besok" ("Min, 1 Nov")
    document.getElementById("capBesok").textContent = new Date(
      Date.now() + 864e5,
    ).toLocaleDateString("id-ID", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  }

  // ── kirim ──
  async function kirim(e) {
    e.preventDefault();
    // safety net: kirim cuma boleh jalan kalo SEMUA langkah lolos.
    // (kirim tombolnya cuma ada di langkah konfirmasi, tapi jaga-jaga
    //  misal user ngelewatin lewat devtools dll)
    for (let n = 1; n < MAKS_LANGKAH; n++) {
      if (cumaAmbil() && n === 5) continue; // langkah 5 dilewati kalo ambil di toko
      if (!validLangkah(n)) {
        tampilLangkah(n);
        return;
      }
    }

    const nama = document.getElementById("inNama").value.trim();
    const wa = formatWa(normWa(document.getElementById("inWa").value)); // biar konsisten sama tampilan
    const ambil = nilai("ambil");
    const bayar = nilai("bayar");
    const alamat = ambil === "cod" ? document.getElementById("inAlamat").value.trim() : "";
    const kapan = ambil === "ambil" ? "sekarang" : (nilai("kapan") || "sekarang");
    const waktuTeks =
      ambil !== "ambil" && kapan === "custom"
        ? document.getElementById("inWaktu").value.trim()
        : null;

    const btn = document.getElementById("btnKirim");
    btn.disabled = true;

    try {
      const res = await TmDb.kirimPesanan({
        nama,
        wa,
        catatan: "",
        items: keranjang.map((i) => ({
          id: i.id,
          qty: i.qty,
          level: i.level || 0,
        })),
        // level_pedas kolom = level tertinggi (buat ringkasan dapur/lama);
        // detail per item ada di dalam items
        level: keranjang.reduce((mx, i) => Math.max(mx, i.level || 0), 0),
        ambil,
        alamat,
        bayar,
        kapan,
        waktuTeks,
      });
      // gak ada popup di sini — langsung lempar ke halaman "Pesenan Aku"
      // (snapshot disimpen dulu biar halaman barunya bisa gambar detail
      //  tanpa nunggu jaringan, terus diganti data asli dari DB)
      simpanLaluPergi(res, {
        nama,
        ambil,
        alamat,
        bayar,
        kapan,
        waktuTeks,
        items: keranjang.map((i) => ({
          nama: i.nama,
          qty: i.qty,
          level: i.level || 0,
          harga: i.harga,
        })),
      });
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  // ── abis pesenan masuk: simpen snapshot + pindah halaman ──
  // bentuk snapshot SAMA kaya baris tabel pesanan (render di halaman baru
  // gak perlu tau bedanya data snapshot / data asli).
  function simpanLaluPergi(res, f) {
    const snap = {
      kode: res.kode,
      nama: f.nama,
      status: "menunggu",
      items: f.items,
      total: res.total,
      ongkir: res.ongkir || 0, // ongkir COD dari server (0 kalo ambil di toko)
      metode_ambil: f.ambil,
      alamat: f.alamat,
      metode_bayar: f.bayar,
      kapan: f.kapan,
      waktu_teks: f.waktuTeks || null,
      created_at: new Date().toISOString(),
      _snapshot: true, // tanda: ini data sementara, nanti ditimpa data DB
    };
    // masukin ke RIWAYAT (localStorage) — halaman Pesenan Aku baca dari situ,
    // gak pake ?kode= lagi, jadi semua pesenan lama tetep kebuka
    simpanKeRiwayat(snap);

    // form + keranjang dibersihin dulu: kalo pelanggan tombol "back",
    // halaman gak nunjukin keranjang basi (bisa kekirim dobel)
    if (porsiTerbuka()) tutupPorsi();
    keranjang = [];
    lvlDraf.clear();
    document.getElementById("formPesen").reset();
    document.getElementById("fieldAlamat").hidden = true;
    document.getElementById("petaToko").hidden = true;
    document.getElementById("fieldWaktu").hidden = true;
    document.getElementById("catatanOngkir").hidden = true; // gak ada pilihan COD lagi
    document
      .querySelectorAll("#opsiAmbil .opsi, #opsiBayar .opsi")
      .forEach((o) => o.classList.remove("pilih"));
    // reset() balikin radio "sekarang" ke checked — class .pilih-nya ikut dipasang lagi
    document
      .querySelector('#opsiKapan .opsi input[value="sekarang"]')
      .closest(".opsi")
      .classList.add("pilih");
    daftar.forEach((m) => patchKartu(m.id)); // patch per kartu — foto gak dilepas, gak kedip
    renderRingkas();
    tampilLangkah(1, false); // balik ke langkah 1 (kalo redirect kepentok)
    hapusDraf(); // pesenan udah masuk — draf form gak usah disimpen lagi

    location.href = "pesenan-aku";
  }

  // ── riwayat pesenan (localStorage) ──
  // bentuk barisnya SAMA kaya tabel pesanan, paling baru di atas,
  // disimpen paling banyak 20 biar storage gak numpuk.
  function simpanKeRiwayat(snap) {
    try {
      const KEY = "tm_history_pesenan";
      const arr = JSON.parse(localStorage.getItem(KEY) || "[]");
      const list = Array.isArray(arr) ? arr.filter((p) => p && p.kode) : [];
      const lama = list.findIndex((p) => p.kode === snap.kode);
      if (lama >= 0) list.splice(lama, 1);
      list.unshift(snap);
      localStorage.setItem(KEY, JSON.stringify(list.slice(0, 20)));
    } catch (e) {
      /* storage mati — halaman baru tinggal fetch sendiri */
    }
  }

  // ── init ──
  async function mulai() {
    const draf = bacaDraf(); // dibaca DULU sebelum render apa pun
    renderSemua();
    pasangOpsi();

    // link "Lihat Google Maps" di peta ilustrasi (kata kunci dari config)
    document.getElementById("btnGmaps").href =
      "https://maps.app.goo.gl/4pnqfbtSeEEeg9NC9";

    // klik di kartu menu: stepper − qty + / baris Pedas (buka atur porsi)
    document.getElementById("gridPilih").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tambah]");
      const k = e.target.closest("[data-kurang]");
      const p = e.target.closest("[data-porsi]");
      if (t) ubahQty(Number(t.dataset.tambah), 1);
      else if (k) ubahQty(Number(k.dataset.kurang), -1);
      else if (p) bukaPorsi(Number(p.dataset.porsi));
    });

    // sheet atur porsi: stepper per level pedas (nulis langsung ke keranjang)
    document.getElementById("porsiLevel").addEventListener("click", (e) => {
      const t = e.target.closest("[data-tambah-lv]");
      const k = e.target.closest("[data-kurang-lv]");
      if (t) ubahPorsi(Number(t.dataset.tambahLv), 1);
      else if (k) ubahPorsi(Number(k.dataset.kurangLv), -1);
    });
    document
      .getElementById("btnTutupPorsi")
      .addEventListener("click", tutupPorsi);
    document
      .getElementById("tiraiPorsi")
      .addEventListener("click", tutupPorsi);
    document.getElementById("btnKosongPorsi").addEventListener("click", () => {
      if (porsiId == null) return;
      keranjang = keranjang.filter((i) => i.id !== porsiId);
      patchKartu(porsiId);
      renderRingkas();
      renderPorsi();
    });

    document.getElementById("formPesen").addEventListener("submit", kirim);

    // navigasi wizard: Lanjutkan / ← balik / "Ubah lagi" di kartu konfirmasi
    document.getElementById("btnLanjut").addEventListener("click", lanjut);
    document.getElementById("btnBack").addEventListener("click", mundur);
    document.getElementById("btnBalik").addEventListener("click", mundur);

    // panel slide-up: klik total di bar bawah buat liat menu yang dipilih
    document
      .getElementById("btnTotal")
      .addEventListener("click", () => toggleSheet());
    document
      .getElementById("btnTutupSheet")
      .addEventListener("click", () => toggleSheet(false));
    document
      .getElementById("tiraiSheet")
      .addEventListener("click", () => toggleSheet(false));

    // mulai dari langkah 1 (gulir=false: halaman baru jangan langsung nge-scroll)
    tampilLangkah(1, false);

    // muat menu
    try {
      daftar = await TmDb.muatMenu();
      renderSemua();
      drafSiap = true; // draf udah kebaca — mulai dari sini boleh nulis
      pulihkanDraf(draf); // isi ulang keranjang + form + langkah tadi
    } catch (err) {
      document.getElementById("gridPilih").innerHTML =
        '<p class="kosong">Menu gagal dimuat. Coba refresh.</p>';
      showToast(TmDb.pesanRamah(err), "error");
    }
    try {
      const info = await TmDb.infoWarung();
      TmDb.terapkanBg(info.bg || ""); // foto latar dari setting (kosong = gradient)
    } catch (e) {
      /* latar tetep gradient hangat kalo gagal */
    }
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
