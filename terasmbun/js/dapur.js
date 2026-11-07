// ============================================================
// dapur.js — sisi ADMIN DAPUR: masuk PIN, lihat daftar pesenan
// realtime, ceklis status (menunggu → dibuat → siap), share WA.
// PIN disimpan di sessionStorage (hilang kalau tab ditutup).
// ============================================================

const Dapur = (function () {
  "use strict";

  let pesanan = [];        // semua yang dimuat
  let tabAktif = "menunggu";
  let hariIniSaja = true;
  let waPenjual = "";
  let pin = (typeof TmDb !== "undefined" && TmDb.getPinSession ? TmDb.getPinSession() : "") || sessionStorage.getItem(TM_PIN_KEY) || "";

  const rupiah = (n) => "Rp" + Number(n || 0).toLocaleString("id-ID");
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const jam = (iso) => new Date(iso).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" });

  // jadwal kirim dari kolom kapan/waktu_teks — "" kalo "sekarang"
  // (biar kartu dapur gak keabisan tag buat pesenan normal)
  function teksJadwal(p) {
    if (p.kapan === "besok") {
      const b = new Date(p.created_at);
      b.setDate(b.getDate() + 1);
      return "Besok, " + b.toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short" });
    }
    if (p.kapan === "custom" && p.waktu_teks) return p.waktu_teks; // teks bebas user
    return "";
  }

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
      bukaDapur();
    } catch (err) {
      if (!pinOtomatis) {
        showToast(TmDb.pesanRamah(err), "error");
      }
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function bukaDapur() {
    document.getElementById("gate").hidden = true;
    document.getElementById("isi").hidden = false;
    Notice.show("live", "Live", { icon: "fa-solid fa-satellite-dish", type: "green" });
    try {
      const info = await TmDb.infoWarung();
      waPenjual = info.wa_penjual || "";
      TmDb.terapkanBg(info.bg || ""); // foto latar dari setting (kosong = gradient)
    } catch (e) { /* tombol WA tetap jalan tanpa nomor (diblokir) */ }
    await muat();
    muatPengunjung(); // pengunjung (jalan paralel, gak nahan list pesenan)
    TmDb.subscribe(() => muat(true)); // realtime: list ke-update sendiri
  }

  // ── muat + render ──
  async function muat(diam) {
    try {
      pesanan = await TmDb.muatPesanan(hariIniSaja);
      render();
    } catch (err) {
      if (!diam) showToast(TmDb.pesanRamah(err), "error");
      else Notice.show("live", "Gagal muat ulang", { icon: "fa-solid fa-triangle-exclamation", type: "red" });
    }
  }

  // ── muat + render pengunjung (visitor per device) ──
  async function muatPengunjung() {
    const box = document.getElementById("daftarPengunjung");
    const elDevice = document.getElementById("countDevice");
    const elHits = document.getElementById("countTotalHits");
    try {
      const rows = await TmDb.daftarKunjungan(pin);
      const totalDevice = Array.isArray(rows) ? rows.length : 0;
      const totalHits = Array.isArray(rows)
        ? rows.reduce((acc, v) => acc + (Number(v.jumlah) || 1), 0)
        : 0;

      if (elDevice) elDevice.textContent = `${totalDevice} device`;
      if (elHits) elHits.innerHTML = `<i class="fa-solid fa-chart-simple"></i> ${totalHits}x dibuka`;

      if (!rows.length) {
        box.innerHTML = '<p class="kosong">Belum ada kunjungan kesimpen.</p>';
        return;
      }
      box.innerHTML = rows
        .map((v, ix) => {
          const singkat = String(v.device_id || "").slice(0, 8);
          return `
        <div class="baris-foto" data-device="${esc(v.device_id)}" title="Klik buat salin device ID" style="animation-delay:${ix * 25}ms">
          <div class="thumb-foto"><i class="fa-solid fa-mobile-screen-button emoji-foto"></i></div>
          <div class="info-foto">
            <b>Device ${esc(singkat)}…</b>
            <small>${esc(v.perangkat || "Perangkat gak kebaca")} · ${esc(teksKunjungan(v.kunjungan_terakhir))}</small>
          </div>
          <div class="aksi-foto">
            <span class="tag-info"><i class="fa-solid fa-rotate-left"></i> ${esc(v.jumlah || 1)}x</span>
          </div>
        </div>`;
        })
        .join("");
    } catch (e) {
      if (elDevice) elDevice.textContent = "0 device";
      if (elHits) elHits.innerHTML = '<i class="fa-solid fa-chart-simple"></i> 0x dibuka';
      box.innerHTML = '<p class="kosong">Gagal muat pengunjung.</p>';
    }
  }

  // "terakhir kunjungan" versi singkat
  function teksKunjungan(iso) {
    if (!iso) return "—";
    return (
      "Terakhir " +
      new Date(iso).toLocaleString("id-ID", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      })
    );
  }

  function render() {
    // hitung per status buat angka tab
    ["menunggu", "dibuat", "siap"].forEach((s) => {
      document.getElementById("jml" + s.charAt(0).toUpperCase() + s.slice(1))
        .textContent = pesanan.filter((p) => p.status === s).length;
    });

    const daftar = document.getElementById("daftar");
    const tampil = pesanan.filter((p) => p.status === tabAktif);
    if (!tampil.length) {
      daftar.innerHTML = `<p class="kosong">Gak ada pesenan ${tabAktif === "menunggu" ? "baru" : "di tab ini"} 🎉</p>`;
      return;
    }
    daftar.innerHTML = tampil.map((p, ix) => kartu(p, ix)).join("");
  }

  function kartu(p, ix) {
    const items = Array.isArray(p.items) ? p.items : [];
    // level per item nempel di barisnya; baris "Pedes Level X" (level
    // tertinggi pesanan) cuma tampil kalo item-nya data lama (gak bawa level)
    const adaLevelItem = items.some((i) => i.level > 0);
    const lvl = (!adaLevelItem && p.level_pedas > 0)
      ? `<p class="catatan"><i class="fa-solid fa-pepper-hot"></i> Pedes <b>Level ${esc(p.level_pedas)}</b></p>` : "";
    const ambil = p.metode_ambil === "cod"
      ? `<span class="tag-info"><i class="fa-solid fa-motorcycle"></i> COD</span>`
      : p.metode_ambil === "ambil"
        ? `<span class="tag-info"><i class="fa-solid fa-store"></i> Ambil di toko</span>` : "";
    const bayar = p.metode_bayar
      ? `<span class="tag-info ${p.metode_bayar === "qris" ? "tag-qris" : ""}"><i class="fa-solid ${p.metode_bayar === "qris" ? "fa-qrcode" : "fa-money-bill-wave"}"></i> ${p.metode_bayar === "qris" ? "QRIS" : "Tunai"}</span>` : "";
    const alamat = p.metode_ambil === "cod" && p.alamat
      ? `<p class="catatan"><i class="fa-solid fa-location-dot"></i> ${esc(p.alamat)}</p>` : "";
    // jadwal kirim non-"sekarang" ditampilin di atas biar keliatan duluan
    const jadwal = teksJadwal(p)
      ? `<p class="catatan jadwal"><i class="fa-regular fa-calendar"></i> Diantar <b>${esc(teksJadwal(p))}</b></p>` : "";
    // tombol aksi sesuai status + tombol undo & hapus
    let aksi = "";
    if (p.status === "menunggu") {
      aksi = `
        <div class="baris-tombol-aksi">
          <button class="btn btn-kuning btn-lebar" data-mulai="${p.id}">
            <i class="fa-solid fa-fire-burner"></i> Mulai masak
          </button>
        </div>
        <div class="baris-tombol-sub">
          <button class="btn btn-kecil btn-hapus-pesan" data-hapus="${p.id}" data-kode="${esc(p.kode)}" data-nama="${esc(p.nama)}" title="Hapus pesanan">
            <i class="fa-solid fa-trash-can"></i> Hapus
          </button>
        </div>`;
    } else if (p.status === "dibuat") {
      aksi = `
        <div class="baris-tombol-aksi">
          <button class="btn btn-hijau btn-lebar" data-siap="${p.id}">
            <i class="fa-solid fa-check"></i> Beres, siap diambil
          </button>
        </div>
        <div class="baris-tombol-sub">
          <button class="btn btn-kecil btn-undo-pesan" data-undo="${p.id}" data-ke="menunggu" title="Kembalikan status ke Baru Masuk">
            <i class="fa-solid fa-rotate-left"></i> Balik ke Baru Masuk
          </button>
          <button class="btn btn-kecil btn-hapus-pesan" data-hapus="${p.id}" data-kode="${esc(p.kode)}" data-nama="${esc(p.nama)}" title="Hapus pesanan">
            <i class="fa-solid fa-trash-can"></i> Hapus
          </button>
        </div>`;
    } else if (p.status === "siap") {
      aksi = `
        <div class="baris-tombol-sub">
          <button class="btn btn-kecil btn-undo-pesan" data-undo="${p.id}" data-ke="dibuat" title="Kembalikan status ke Lagi Dibuat">
            <i class="fa-solid fa-rotate-left"></i> Balik ke Lagi Dibuat
          </button>
          <button class="btn btn-kecil btn-undo-pesan" data-undo="${p.id}" data-ke="menunggu" title="Kembalikan status ke Baru Masuk">
            <i class="fa-solid fa-arrow-rotate-left"></i> Baru Masuk
          </button>
          <button class="btn btn-kecil btn-hapus-pesan" data-hapus="${p.id}" data-kode="${esc(p.kode)}" data-nama="${esc(p.nama)}" title="Hapus pesanan">
            <i class="fa-solid fa-trash-can"></i> Hapus
          </button>
        </div>`;
    }
    return `<div class="baris-pesanan" style="animation-delay:${ix * 30}ms">
      <div class="head">
        <span class="kode">#${esc(p.kode)}</span>
        <span class="pembeli">${esc(p.nama)}</span>
        <span class="jam"><i class="fa-regular fa-clock"></i> ${jam(p.created_at)}</span>
      </div>
      ${jadwal}
      <ul class="daftar-item">
        ${items.map((i) => `<li>• ${esc(i.nama || "Menu")} <b>${esc(i.qty || 1)}x</b>${i.level > 0 ? ` <b class="lvl-item">🌶️${esc(i.level)}</b>` : ""}</li>`).join("")}
      </ul>
      ${lvl}
      ${alamat}
      ${p.catatan ? `<p class="catatan"><i class="fa-solid fa-comment-dots"></i> ${esc(p.catatan)}</p>` : ""}
      <div class="tag-wrap">${ambil}${bayar}</div>
      ${p.ongkir > 0 ? `<p class="catatan"><i class="fa-solid fa-truck"></i> Ongkir <b>${rupiah(p.ongkir)}</b> <span class="muted-kecil">(gak fix — bisa beda deket/jauh)</span></p>` : ""}
      <p class="total">${rupiah(p.total)}</p>
      <div class="aksi">${aksi}</div>
    </div>`;
  }

  // ── ubah / undo status pesanan (menunggu ⇄ dibuat ⇄ siap) ──
  async function ubah(id, status, tombol) {
    tombol.disabled = true;
    try {
      const ok = await TmDb.ubahStatus(id, status, pin);
      if (!ok) {
        showToast("PIN gak valid. Masuk ulang ya.", "error");
        keluar();
        return;
      }
      let pesan = "Status pesanan diubah.";
      if (status === "dibuat") pesan = "Oke, lagi dimasak.";
      else if (status === "siap") pesan = "Mantap, siap diambil!";
      else if (status === "menunggu") pesan = "Pesanan dikembalikan ke Baru Masuk.";
      showToast(pesan, "info");
      await muat(true);
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
      tombol.disabled = false;
    }
  }

  // ── hapus pesanan (wajib PIN bener + konfirmasi) ──
  async function hapusPesananUi(id, kode, nama, tombol) {
    const y = await showPopup(
      `Hapus pesanan #${kode || ""} (${nama || "pelanggan"})? Data pesanan ini akan dihapus permanen.`,
      "confirm",
    );
    if (!y) return;

    tombol.disabled = true;
    try {
      const ok = await TmDb.hapusPesanan(id, pin);
      if (!ok) {
        showToast("Gagal menghapus pesanan (PIN gak valid).", "error");
        tombol.disabled = false;
        return;
      }
      showToast(`Pesanan #${kode || ""} berhasil dihapus.`, "info");
      await muat(true);
    } catch (err) {
      showToast(TmDb.pesanRamah(err), "error");
      tombol.disabled = false;
    }
  }

  // ── share WA: ringkasan pesenan hari ini ──
  function shareWa() {
    if (!pesanan.length) { showToast("Belum ada pesenan.", "info"); return; }
    const baris = pesanan.map((p, ix) => {
      const itemsArr = Array.isArray(p.items) ? p.items : [];
      const adaLevelItem = itemsArr.some((i) => i.level > 0);
      const items = itemsArr
        .map((i) => `${i.nama} ${i.qty}x${i.level > 0 ? ` (Lv${i.level})` : ""}`).join(", ");
      const extra = [
        p.metode_ambil === "cod" ? "COD" : p.metode_ambil === "ambil" ? "Ambil" : "",
        p.metode_bayar ? p.metode_bayar.toUpperCase() : "",
        teksJadwal(p), // jadwal non-"sekarang"
        // Lv di extra cuma buat data lama (item blom bawa level sendiri)
        !adaLevelItem && p.level_pedas > 0 ? `Lv${p.level_pedas}` : "",
      ].filter(Boolean).join(" · ");
      return `${ix + 1}. #${p.kode} ${p.nama} — ${items} (${rupiah(p.total)}) [${p.status}]${extra ? ` {${extra}}` : ""}`;
    });
    const teks = `*PESenan TERAS MBUN*\n${hariIniSaja ? "Hari ini" : "Semua"}:\n\n` +
      baris.join("\n") + `\n\nTotal: ${rupiah(pesanan.reduce((s, p) => s + p.total, 0))}`;
    // nomor penjual dari setting; kalau belum diisi, share ke nomor kosong = popup WA biasa
    const nomor = waPenjual ? waPenjual : "";
    window.open(`https://wa.me/${nomor}?text=${encodeURIComponent(teks)}`, "_blank");
  }

  function keluar() {
    if (TmDb.clearPinSession) TmDb.clearPinSession();
    else sessionStorage.removeItem(TM_PIN_KEY);
    pin = "";
    document.getElementById("isi").hidden = true;
    document.getElementById("gate").hidden = false;
    document.getElementById("inputPin").value = "";
    Notice.hide("live");
  }

  // ── init ──
  function mulai() {
    document.getElementById("btnMasuk").addEventListener("click", () => cobaMasuk());
    document.getElementById("inputPin").addEventListener("keydown", (e) => {
      if (e.key === "Enter") cobaMasuk();
    });

    document.getElementById("tabs").addEventListener("click", (e) => {
      const b = e.target.closest("[data-tab]");
      if (!b) return;
      tabAktif = b.dataset.tab;
      document.querySelectorAll(".tab").forEach((t) => t.classList.toggle("aktif", t === b));
      render();
    });

    document.getElementById("daftar").addEventListener("click", (e) => {
      const mulai = e.target.closest("[data-mulai]");
      const siap = e.target.closest("[data-siap]");
      const undo = e.target.closest("[data-undo]");
      const hapusBtn = e.target.closest("[data-hapus]");
      if (mulai) ubah(mulai.dataset.mulai, "dibuat", mulai);
      else if (siap) ubah(siap.dataset.siap, "siap", siap);
      else if (undo) ubah(undo.dataset.undo, undo.dataset.ke, undo);
      else if (hapusBtn) {
        hapusPesananUi(
          hapusBtn.dataset.hapus,
          hapusBtn.dataset.kode,
          hapusBtn.dataset.nama,
          hapusBtn,
        );
      }
    });

    document.getElementById("btnSegarkan").addEventListener("click", () => {
      muat();
      muatPengunjung();
    });
    // klik baris pengunjung → salin device ID-nya
    document.getElementById("daftarPengunjung").addEventListener("click", (e) => {
      const baris = e.target.closest("[data-device]");
      if (!baris || !baris.dataset.device) return;
      const teks = baris.dataset.device;
      const salin = navigator.clipboard
        ? navigator.clipboard.writeText(teks)
        : Promise.reject();
      salin.then(
        () => showToast("Device ID disalin.", "info"),
        () => showToast("Gagal nyalin device ID.", "error"),
      );
    });
    document.getElementById("btnKeluar").addEventListener("click", () => {
      showPopup("Keluar dari mode dapur?", "confirm").then((y) => { if (y) keluar(); });
    });
    document.getElementById("btnHariIni").addEventListener("click", () => {
      hariIniSaja = !hariIniSaja;
      document.getElementById("subJudul").textContent = hariIniSaja ? "PESENAN HARI INI" : "SEMUA PESENAN";
      showToast(hariIniSaja ? "Filter: hari ini" : "Filter: semua pesenan", "info");
      muat();
    });
    document.getElementById("btnShareWa").addEventListener("click", shareWa);

    // udah pernah masuk PIN di sesi browser ini? langsung buka
    if (pin) cobaMasuk(pin);
  }

  document.addEventListener("DOMContentLoaded", mulai);
  return {};
})();
