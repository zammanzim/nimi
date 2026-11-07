// ============================================================
// admin.js — halaman ADMIN (PIN-gated, ala dapur).
// Kelola menu penuh: tambah / edit (nama, harga, kategori,
// deskripsi, urutan, status habis) / hapus + foto per menu,
// plus foto latar & foto QRIS.
// Semua nulis lewat RPC wajib PIN (simpan_menu, hapus_menu,
// ubah_menu_gambar, ubah_media). Foto dikompres di browser
// dulu (canvas → JPEG) sebelum masuk bucket terasmbun-media.
// ============================================================

const Admin = (function () {
  "use strict";

  let pin = (typeof TmDb !== "undefined" && TmDb.getPinSession ? TmDb.getPinSession() : "") || sessionStorage.getItem(TM_PIN_KEY) || "";
  let menuDaftar = [];                // isi tabel menu
  let media = { bg: "", qris: "" };   // URL foto warung dari setting
  let target = null;                  // target ganti foto: { tipe: "bg"|"qris"|"menu", id }
  let editId = null;                  // null = form nambah; terisi = lagi edit
  let stagedFoto = null;              // foto terpilih di form (blob) — diunggah pas klik Simpan
  let formFotoUrl = "";               // URL foto tersimpan dari menu yang lagi diedit
  let fotoLokalUrl = "";              // objectURL preview sementara (dibuang pas form nutup)

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const emojiKat = (k) => ({ nasi: "🍚", minuman: "🥤", lauk: "🍗", lauk_pauk: "🍗", snack: "🍘" }[String(k || "").toLowerCase()] || "🍽️");
  const labelKat = (k) => String(k || "lain").replace(/_/g, " ");

  // ── gerbang PIN ──
  async function cobaMasuk(pinOtomatis) {
    const input = document.getElementById("inputPin");
    const btn = document.getElementById("btnMasuk");
    const nilai = (typeof pinOtomatis === "string" ? pinOtomatis : (input ? input.value : "")).trim();
    if (!nilai) {
      if (!pinOtomatis && input) input.focus();
      return;
    }
    if (btn) btn.disabled = true;
    try {
      const ok = await TmDb.cekPin(nilai);
      if (!ok) {
        if (pinOtomatis) {
          if (TmDb.clearPinSession) TmDb.clearPinSession();
          else sessionStorage.removeItem(TM_PIN_KEY);
          pin = "";
          document.getElementById("gate").hidden = false;
          document.getElementById("isi").hidden = true;
          if (input) {
            input.value = "";
            input.focus();
          }
          return;
        }
        showToast("PIN salah. Coba lagi.", "error");
        if (input) {
          input.value = "";
          input.focus();
        }
        return;
      }
      pin = nilai;
      if (TmDb.setPinSession) TmDb.setPinSession(pin);
      else sessionStorage.setItem(TM_PIN_KEY, pin);
      buka();
    } catch (err) {
      if (!pinOtomatis) {
        showToast(TmDb.pesanRamah(err), "error");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function buka() {
    document.getElementById("gate").hidden = true;
    document.getElementById("isi").hidden = false;
    await muat();
  }

  async function muat() {
    try {
      const [m, info] = await Promise.all([TmDb.muatMenuAdmin(), TmDb.infoWarung()]);
      menuDaftar = m;
      media.bg = info.bg || "";
      media.qris = info.qris || "";
      render();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  // ── render ──
  function render() {
    renderPreview("prevBg", media.bg, "Belum ada foto latar — web tampil gradient hangat.");
    renderPreview("prevQris", media.qris, "Belum ada foto QRIS — pelanggan gak liat gambar QR.");
    renderMenu();
    renderDatalistKat();
  }

  function renderPreview(id, url, teksKosong) {
    const kotak = document.getElementById(id);
    kotak.innerHTML = url
      ? `<img src="${esc(url)}" alt="preview" loading="lazy">`
      : `<span class="kosong-foto-txt">${esc(teksKosong)}</span>`;
  }

  // daftar menu dikelompokin per kategori
  function renderMenu() {
    const kotak = document.getElementById("daftarMenu");
    if (!menuDaftar.length) {
      kotak.innerHTML = '<p class="kosong">Belum ada menu. Klik "Tambah menu" ya.</p>';
      return;
    }
    const peta = new Map();
    menuDaftar.forEach((m) => {
      const k = m.kategori || "lain";
      if (!peta.has(k)) peta.set(k, []);
      peta.get(k).push(m);
    });
    kotak.innerHTML = [...peta.entries()].map(([kat, items]) => `
      <div class="kat-judul-kecil"><span>${emojiKat(kat)}</span> ${esc(labelKat(kat))}</div>
      ${items.map((m) => barisMenu(m)).join("")}`).join("");
  }

  function barisMenu(m) {
    return `<div class="baris-foto${m.tersedia ? "" : " habis"}">
      <div class="thumb-foto">${m.gambar
        ? `<img src="${esc(m.gambar)}" alt="${esc(m.nama)}" loading="lazy">`
        : `<span class="emoji-foto">${emojiKat(m.kategori)}</span>`}</div>
      <div class="info-foto">
        <b>${esc(m.nama)}${m.tersedia ? "" : ' <span class="badge-habis">HABIS</span>'}</b>
        <small>${rupiah(m.harga)}${m.deskripsi ? ` · ${esc(m.deskripsi)}` : ""}</small>
      </div>
      <div class="aksi-foto">
        <button class="btn btn-kecil btn-kaca" data-edit="${m.id}" title="Edit menu"><i class="fa-solid fa-pen"></i></button>
        <button class="btn btn-kecil btn-foto" data-menu-ganti="${m.id}" title="Ganti foto"><i class="fa-solid fa-camera"></i></button>
        <button class="btn btn-kecil btn-kaca" data-toggle="${m.id}"
          title="${m.tersedia ? "Tandai habis" : "Tandai tersedia lagi"}"><i class="fa-solid ${m.tersedia ? "fa-moon" : "fa-circle-check"}"></i></button>
        <button class="btn btn-kecil btn-kaca" data-hapus="${m.id}" title="Hapus menu"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>`;
  }

  // pilihan kategori di form: isi dari kategori yang udah ada
  // (tapi input-nya bebas — nulis nama baru = kategori baru)
  function renderDatalistKat() {
    const dl = document.getElementById("listKat");
    const unik = [...new Set(menuDaftar.map((m) => m.kategori).filter(Boolean))];
    dl.innerHTML = unik.map((k) => `<option value="${esc(k)}">`).join("");
  }

  // ── form tambah / edit menu ──
  function bukaForm(m) {
    editId = m ? m.id : null;
    // judul form + ikon (pensil pas edit, plus pas nambah)
    document.getElementById("formJudul").innerHTML = m
      ? `<i class="fa-solid fa-pen"></i> Edit: ${esc(m.nama)}`
      : `<i class="fa-solid fa-circle-plus"></i> Menu baru`;
    document.getElementById("fmNama").value = m ? m.nama : "";
    document.getElementById("fmHarga").value = m ? m.harga : "";
    document.getElementById("fmUrut").value = m ? m.urutan : "";
    document.getElementById("fmKat").value = m ? m.kategori : "";
    document.getElementById("fmDesk").value = (m && m.deskripsi) || "";
    document.getElementById("fmTersedia").checked = m ? m.tersedia !== false : true;
    // reset area foto: preview foto tersimpan (kalo edit), belum ada pilihan baru
    bersihkanStagedFoto();
    formFotoUrl = (m && m.gambar) || "";
    renderDropFoto();
    const form = document.getElementById("formMenu");
    form.hidden = false;
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("fmNama").focus();
  }

  function tutupForm() {
    document.getElementById("formMenu").hidden = true;
    editId = null;
    formFotoUrl = "";
    bersihkanStagedFoto();
  }

  // ── area foto di form: klik / drag & drop ──
  // Foto dikompres dulu di browser, tapi diunggah BARU pas klik Simpan
  // (id menu-nya belum ada kalo menu baru). Sini cuma preview + staging.
  function bersihkanStagedFoto() {
    stagedFoto = null;
    if (fotoLokalUrl) { URL.revokeObjectURL(fotoLokalUrl); fotoLokalUrl = ""; }
  }

  function renderDropFoto() {
    const isi = document.getElementById("dropIsi");
    const box = document.getElementById("dropFoto");
    const url = fotoLokalUrl || formFotoUrl; // yang baru dipilih lebih duluan
    if (url) {
      box.classList.add("ada-foto");
      isi.innerHTML = `<img src="${esc(url)}" alt="foto menu">
        <span class="drop-sku">${stagedFoto
          ? "Foto baru — otomatis kesimpen pas klik Simpan"
          : "Foto sekarang — klik atau tarik foto buat ganti"}</span>
        ${stagedFoto ? `<button type="button" class="drop-x" id="dropX" title="Buang foto terpilih"><i class="fa-solid fa-xmark"></i></button>` : ""}`;
    } else {
      box.classList.remove("ada-foto");
      isi.innerHTML = `<span class="ikon-drop"><i class="fa-solid fa-camera"></i></span>
        <b>Klik buat pilih, atau tarik fotonya ke sini</b>
        <small>Opsional — foto menu biar keliatan menggugah selera</small>`;
    }
  }

  async function prosesFotoForm(file) {
    if (!file) return;
    if (!file.type || !file.type.startsWith("image/")) {
      showToast("Itu bukan foto ya. Pilih file gambar (jpg/png).", "error");
      return;
    }
    try {
      showToast("Kompres foto…", "info");
      const blob = await TmDb.kompresFoto(file); // resize + JPEG di browser
      bersihkanStagedFoto();
      fotoLokalUrl = URL.createObjectURL(blob);  // preview langsung keliatan
      stagedFoto = { blob };
      renderDropFoto();
      showToast("Foto siap — klik Simpan ya.", "success");
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  async function simpanForm(e) {
    e.preventDefault();
    const nama = document.getElementById("fmNama").value.trim();
    const harga = document.getElementById("fmHarga").value;
    const kategori = document.getElementById("fmKat").value.trim();
    if (!nama) { showToast("Isi nama menu dulu ya.", "error"); document.getElementById("fmNama").focus(); return; }
    if (harga === "" || Number(harga) < 0) { showToast("Isi harganya dulu ya.", "error"); document.getElementById("fmHarga").focus(); return; }
    if (!kategori) { showToast("Isi kategorinya dulu.", "error"); document.getElementById("fmKat").focus(); return; }

    const btn = document.querySelector('#formMenu button[type="submit"]');
    btn.disabled = true;
    try {
      const res = await TmDb.simpanMenu({
        id: editId,
        nama,
        harga: Number(harga),
        kategori,
        deskripsi: document.getElementById("fmDesk").value.trim(),
        urutan: document.getElementById("fmUrut").value,
        tersedia: document.getElementById("fmTersedia").checked,
      }, pin);
      if (!res) return gagalPin();
      // foto dari area klik/drag: baru diunggah sekarang (id menu udah ada)
      if (stagedFoto) {
        showToast("Unggah foto…", "info");
        const urlBaru = await TmDb.uploadFoto(`menu-${res.id}`, stagedFoto.blob);
        if (!(await TmDb.ubahMenuGambar(res.id, urlBaru, pin))) return gagalPin();
        const lama = menuDaftar.find((x) => x.id === res.id);
        if (lama && lama.gambar) TmDb.hapusFotoLama(lama.gambar).catch(() => {}); // file lama dibuang
        showToast(editId ? "Menu + foto di-update ✅" : "Menu + foto disimpan 🎉", "success");
      } else {
        showToast(editId ? "Menu di-update ✅" : "Menu nambah 🎉", "success");
      }
      tutupForm();
      await muat();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    } finally {
      btn.disabled = false;
    }
  }

  // toggle status habis/tanpa buka form — data dikirim ulang apa adanya
  async function toggleTersedia(id) {
    const m = menuDaftar.find((x) => x.id === id);
    if (!m) return;
    try {
      const res = await TmDb.simpanMenu({
        id: m.id, nama: m.nama, harga: m.harga, kategori: m.kategori,
        deskripsi: m.deskripsi, urutan: m.urutan, tersedia: !m.tersedia,
      }, pin);
      if (!res) return gagalPin();
      m.tersedia = !m.tersedia;
      render();
      showToast(m.tersedia ? `"${m.nama}" tersedia lagi` : `"${m.nama}" ditandai habis`, "info");
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  async function hapusMenu(id) {
    const m = menuDaftar.find((x) => x.id === id);
    if (!m) return;
    if (!(await showPopup(`Hapus menu "${esc(m.nama)}"? Foto-nya ikut dibuang.`, "confirm"))) return;
    try {
      const ok = await TmDb.hapusMenu(id, pin);
      if (!ok) return gagalPin();
      if (m.gambar) TmDb.hapusFotoLama(m.gambar).catch(() => {}); // file di bucket dibuang
      if (editId === id) tutupForm();
      showToast(`"${m.nama}" dihapus.`);
      await muat();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  // ── ganti foto: pilih dari galeri → kompres → upload → simpan URL ──
  async function prosesFoto(file) {
    if (!file || !target) return;
    const { tipe, id } = target;
    target = null;
    try {
      showToast("Kompres & unggah foto…", "info");
      const blob = await TmDb.kompresFoto(file); // resize + JPEG di browser
      if (tipe === "menu") {
        const urlBaru = await TmDb.uploadFoto(`menu-${id}`, blob);
        const ok = await TmDb.ubahMenuGambar(id, urlBaru, pin);
        if (!ok) return gagalPin();
        const m = menuDaftar.find((x) => x.id === id);
        if (m && m.gambar) TmDb.hapusFotoLama(m.gambar).catch(() => {});
        if (m) m.gambar = urlBaru;
        showToast(`Foto "${m ? m.nama : "menu"}" disimpan ✅`);
      } else {
        const urlBaru = await TmDb.uploadFoto(tipe, blob);
        const ok = await TmDb.ubahMedia(tipe, urlBaru, pin);
        if (!ok) return gagalPin();
        if (media[tipe]) TmDb.hapusFotoLama(media[tipe]).catch(() => {});
        media[tipe] = urlBaru;
        if (tipe === "bg") TmDb.terapkanBg(urlBaru); // latar ganti langsung
        showToast(tipe === "bg" ? "Foto latar disimpan ✅" : "Foto QRIS disimpan ✅");
      }
      render();
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  // ── hapus foto (bg / qris) ──
  async function hapusMedia(tipe) {
    if (!media[tipe]) { showToast("Belum ada foto yang dihapus.", "info"); return; }
    const apa = tipe === "bg" ? "Foto latar" : "Foto QRIS";
    if (!(await showPopup(`Hapus ${apa.toLowerCase()}?`, "confirm"))) return;
    try {
      const ok = await TmDb.ubahMedia(tipe, "", pin);
      if (!ok) return gagalPin();
      TmDb.hapusFotoLama(media[tipe]).catch(() => {});
      media[tipe] = "";
      if (tipe === "bg") TmDb.terapkanBg(""); // balik ke gradient hangat
      render();
      showToast("Foto dihapus.");
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
    }
  }

  function gagalPin() {
    showToast("PIN gak valid. Masuk ulang ya.", "error");
    keluar();
  }

  function keluar() {
    if (TmDb.clearPinSession) TmDb.clearPinSession();
    else sessionStorage.removeItem(TM_PIN_KEY);
    pin = "";
    tutupForm();
    document.getElementById("isi").hidden = true;
    document.getElementById("gate").hidden = false;
    document.getElementById("inputPin").value = "";
  }

  // ── init ──
  function mulai() {
    document.getElementById("btnMasuk").addEventListener("click", () => cobaMasuk());
    document.getElementById("inputPin").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cobaMasuk();
    });
    document.getElementById("btnKeluar").addEventListener("click", () => {
      showPopup("Keluar dari mode admin?", "confirm").then((y) => { if (y) keluar(); });
    });

    // form menu
    document.getElementById("btnTambah").addEventListener("click", () => bukaForm(null));
    document.getElementById("formMenu").addEventListener("submit", simpanForm);
    document.getElementById("fmBatal").addEventListener("click", tutupForm);

    // area foto form: klik buat pilih ATAU drag & drop dari luar
    const drop = document.getElementById("dropFoto");
    const inputForm = document.getElementById("inputFotoForm");
    drop.addEventListener("click", (e) => {
      if (e.target.closest(".drop-x")) { // tombol ✕: buang foto terpilih
        bersihkanStagedFoto();
        renderDropFoto();
        return;
      }
      inputForm.click();
    });
    inputForm.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ""; // reset biar file sama bisa dipilih ulang
      prosesFotoForm(file);
    });
    ["dragenter", "dragover"].forEach((ev) =>
      drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add("siap-drag"); }));
    ["dragleave", "drop"].forEach((ev) =>
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        // dragleave kadang kena pas masuk ke dalem anaknya — jangan ilangin class-nya
        if (ev === "dragleave" && drop.contains(e.relatedTarget)) return;
        drop.classList.remove("siap-drag");
      }));
    drop.addEventListener("drop", (e) => {
      const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
      prosesFotoForm(f);
    });

    // klik di daftar menu: edit / ganti foto / toggle habis / hapus
    document.getElementById("daftarMenu").addEventListener("click", (e) => {
      const ed = e.target.closest("[data-edit]");
      const gf = e.target.closest("[data-menu-ganti]");
      const tg = e.target.closest("[data-toggle]");
      const hp = e.target.closest("[data-hapus]");
      if (ed) bukaForm(menuDaftar.find((x) => x.id === Number(ed.dataset.edit)));
      else if (gf) {
        target = { tipe: "menu", id: Number(gf.dataset.menuGanti) };
        document.getElementById("inputFoto").click();
      } else if (tg) toggleTersedia(Number(tg.dataset.toggle));
      else if (hp) hapusMenu(Number(hp.dataset.hapus));
    });

    // tombol ganti/hapus foto warung (data-media="bg:ganti")
    document.getElementById("isi").addEventListener("click", (e) => {
      const wm = e.target.closest("[data-media]");
      if (!wm) return;
      const [tipe, aksi] = wm.dataset.media.split(":");
      if (aksi === "ganti") { target = { tipe, id: null }; document.getElementById("inputFoto").click(); }
      else hapusMedia(tipe);
    });

    document.getElementById("inputFoto").addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      e.target.value = ""; // reset biar file sama bisa dipilih ulang
      prosesFoto(file);
    });

    // udah pernah masuk PIN di sesi browser ini? langsung buka
    if (pin) cobaMasuk(pin);
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
