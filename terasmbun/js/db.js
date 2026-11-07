// ============================================================
// DB — layer Supabase TERAS MBUN (semua via skema terasmbun)
// Client-nya disetel `db.schema = terasmbun` SEKALI di createClient,
// jadi .from("menu") / .rpc("buat_pesanan") udah otomatis ke skema
// terasmbun — JANGAN di-prefix "terasmbun." manual (malah nyari
// tabel 'terasmbun.menu' di skema public → error).
// Read menu/pesanan langsung; nulis lewat RPC (total dihitung
// server-side, ubah status wajib PIN).
// ============================================================
const TmDb = (function () {
  "use strict";

  const supa = supabase.createClient(TM_SUPABASE_URL, TM_SUPABASE_ANON_KEY, {
    db: { schema: TM_SCHEMA }, // semua query ke skema terasmbun
  });

  // pesan error ramah dari RPC
  function pesanRamah(err) {
    const m = String((err && err.message) || "");
    if (m.includes("nama_kosong")) return "Isi nama dulu ya.";
    if (m.includes("harga_salah")) return "Harga belum bener (angka 0 ke atas).";
    if (m.includes("kategori_kosong")) return "Isi kategorinya dulu.";
    if (m.includes("menu_tidak_ada")) return "Menu itu udah gak ada.";
    if (m.includes("keranjang_kosong")) return "Belum ada menu yang dipilih.";
    if (m.includes("menu_tidak_tersedia")) return "Ada menu yang lagi gak tersedia.";
    if (m.includes("ambil_kosong")) return "Pilih mau diantar atau ambil sendiri.";
    if (m.includes("alamat_kosong")) return "Isi alamatnya dulu (buat pesenan diantar).";
    if (m.includes("bayar_kosong")) return "Pilih mau bayar QRIS atau tunai.";
    if (m.includes("kapan_salah")) return "Pilih mau dikirim kapan.";
    if (m.includes("waktu_kirim_kosong")) return "Tulis jam kirimnya dulu ya.";
    if (m.includes("Failed to fetch")) return "Koneksi lagi mati. Coba lagi nanti.";
    return m ? "Gagal: " + m : "Ada yang salah nih.";
  }

  return {
    supa,
    pesanRamah,

    // ── baca ──
    async muatMenu() {
      const { data, error } = await supa
        .from("menu")
        .select("id,nama,harga,kategori,urutan,gambar,deskripsi")
        .order("urutan", { ascending: true });
      if (error) throw error;
      return data || [];
    },

    // Versi ADMIN: lewat RPC daftar_menu() (security definer) —
    // balikin SEMUA menu termasuk yang habis, plus kolom tersedia.
    // SELECT biasa ke table menu lewat RLS ngefilter menu habis
    // (emang buat pelanggan), jadi admin butuh ini biar menu habis
    // tetep keliatan & bisa dibalikin statusnya.
    async muatMenuAdmin() {
      const { data, error } = await supa.rpc("daftar_menu");
      if (error) throw error;
      return data || [];
    },

    async muatPesanan(hariIni) {
      let q = supa.from("pesanan").select("*").order("created_at", { ascending: false }).limit(100);
      if (hariIni) q = q.gte("created_at", new Date().toISOString().slice(0, 10));
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },

    // Ambil SATU pesanan lewat kode (buat halaman pesenan-aku).
    // Anon emang dibolehin baca tabel pesanan (policy pesanan_baca) —
    // kode diketik/share sama pelanggan, gak ada data rahasia di dalemnya.
    async muatPesananByKode(kode) {
      const k = String(kode || "").trim();
      if (!k) return null;
      const { data, error } = await supa
        .from("pesanan")
        .select("*")
        .eq("kode", k)
        .order("created_at", { ascending: false })
        .limit(1);
      if (error) throw error;
      return (data && data[0]) || null;
    },

    // Versi BANYAK kode (riwayat pesenan-aku: satu request buat semua kartu)
    async muatPesananByKodes(kodes) {
      const list = (Array.isArray(kodes) ? kodes : [kodes])
        .map((k) => String(k || "").trim()).filter(Boolean);
      if (!list.length) return [];
      const { data, error } = await supa
        .from("pesanan")
        .select("*")
        .in("kode", list)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },

    async infoWarung() {
      const { data, error } = await supa.rpc("info_warung");
      if (error) throw error;
      return data || { wa_penjual: "" };
    },

    // Daftar pengunjung (visitor, per device) — wajib PIN.
    // Balikin [] kalo PIN salah (dicek server-side, lihat db/013).
    async daftarKunjungan(pin) {
      const { data, error } = await supa.rpc("daftar_kunjungan", {
        p_pin: String(pin || ""),
      });
      if (error) throw error;
      return Array.isArray(data) ? data : [];
    },

    // ── nulis (RPC, wajib validasi server-side) ──
    // items: [{id, qty, level}] — level 0..5 per item (minuman dipaksa 0
    // server); 1 id boleh muncul berkali-kali dengan level beda (porsi
    // beda level = baris terpisah); total + level_pedas (tertinggi)
    // dihitung ulang oleh Postgres
    // ambil: "cod" (diantar) | "ambil" (nyamperin ke toko)
    // bayar: "qris" | "tunai" — alamat wajib kalo ambil = "cod"
    // kapan: "sekarang" | "besok" | "custom" — waktuTeks wajib kalo custom
    async kirimPesanan({ nama, wa, catatan, items, level, ambil, alamat, bayar, kapan, waktuTeks }) {
      const { data, error } = await supa.rpc("buat_pesanan", {
        p_nama: nama || "",
        p_wa: wa || "",
        p_catatan: catatan || "",
        p_items: items,
        p_level_pedas: Number(level || 0),
        p_ambil: ambil || "",
        p_alamat: alamat || "",
        p_bayar: bayar || "",
        p_kapan: kapan || "sekarang",
        p_waktu_teks: waktuTeks || null,
      });
      if (error) throw error;
      return data; // {id, kode, total, ongkir}
    },

    async cekPin(pin) {
      const { data, error } = await supa.rpc("cek_pin", { p_pin: String(pin || "") });
      if (error) throw error;
      return !!data;
    },

    // ── manajemen sesi PIN (sessionStorage + session cookie) ──
    // Berlaku selama browser buka (lintas tab/reload), hilang saat browser ditutup
    getPinSession() {
      const k = typeof TM_PIN_KEY !== "undefined" ? TM_PIN_KEY : "tm_pin";
      try {
        const s = sessionStorage.getItem(k);
        if (s) return s;
      } catch (e) {}
      try {
        const m = document.cookie.match(new RegExp("(?:^|; )" + k + "=([^;]*)"));
        if (m && m[1]) {
          const val = decodeURIComponent(m[1]);
          try { sessionStorage.setItem(k, val); } catch (e) {}
          return val;
        }
      } catch (e) {}
      return "";
    },

    setPinSession(pin) {
      if (!pin) return;
      const k = typeof TM_PIN_KEY !== "undefined" ? TM_PIN_KEY : "tm_pin";
      try { sessionStorage.setItem(k, pin); } catch (e) {}
      try {
        // Tanpa max-age/expires = session cookie (otomatis dibuang saat browser ditutup)
        document.cookie = k + "=" + encodeURIComponent(pin) + "; path=/; SameSite=Lax";
      } catch (e) {}
    },

    clearPinSession() {
      const k = typeof TM_PIN_KEY !== "undefined" ? TM_PIN_KEY : "tm_pin";
      try { sessionStorage.removeItem(k); } catch (e) {}
      try {
        document.cookie = k + "=; path=/; max-age=0; SameSite=Lax";
      } catch (e) {}
    },

    async ubahStatus(id, status, pin) {
      const { data, error } = await supa.rpc("ubah_status", {
        p_id: id, p_status: status, p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    async hapusPesanan(id, pin) {
      const { data, error } = await supa.rpc("hapus_pesanan", {
        p_id: id,
        p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    // ── foto menu (Supabase Storage, bucket terasmbun-media) ──
    // Kompres dulu di browser: sisi terpanjang dibatasi + dikirim sebagai
    // JPEG — foto dari HP biasanya 3-8MB, sesudah kompres tinggal ~100KB.
    async kompresFoto(file, sisiMaks = 1200, kualitas = 0.7) {
      const bitmap = await createImageBitmap(file); // EXIF rotasi dihormati browser
      const skala = Math.min(1, sisiMaks / Math.max(bitmap.width, bitmap.height));
      const lebar = Math.round(bitmap.width * skala);
      const tinggi = Math.round(bitmap.height * skala);
      const kanvas = document.createElement("canvas");
      kanvas.width = lebar;
      kanvas.height = tinggi;
      kanvas.getContext("2d").drawImage(bitmap, 0, 0, lebar, tinggi);
      if (bitmap.close) bitmap.close();
      const blob = await new Promise((res) => kanvas.toBlob(res, "image/jpeg", kualitas));
      if (!blob) throw new Error("gagal_kompres");
      return blob;
    },

    // Upload foto kompres ke bucket; nama file pakai stempel waktu biar
    // URL publiknya selalu baru (gak ketimpa cache browser/CDN).
    // namaDasar bebas: "menu-1", "bg", "qris", dll.
    async uploadFoto(namaDasar, blob) {
      const nama = `${namaDasar}-${Date.now()}.jpg`;
      const { error } = await supa.storage.from(TM_BUCKET).upload(nama, blob, {
        contentType: "image/jpeg",
        upsert: true,
      });
      if (error) throw error;
      return supa.storage.from(TM_BUCKET).getPublicUrl(nama).data.publicUrl;
    },

    // Simpan URL foto ke kolom menu.gambar — wajib PIN, URL divalidasi
    // server (harus dari bucket terasmbun-media).
    async ubahMenuGambar(idMenu, url, pin) {
      const { data, error } = await supa.rpc("ubah_menu_gambar", {
        p_id: idMenu, p_gambar: url || "", p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    // Simpan URL foto warung ("bg" = latar, "qris") ke tabel setting —
    // wajib PIN, URL divalidasi server juga.
    async ubahMedia(key, url, pin) {
      const { data, error } = await supa.rpc("ubah_media", {
        p_key: key, p_gambar: url || "", p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    // ── CRUD menu (admin, wajib PIN) ──
    // id kosong/null → menu baru; urutan kosong → paling bawah.
    // Balikan: {id} sukses, null = PIN salah.
    async simpanMenu({ id, nama, harga, kategori, deskripsi, urutan, tersedia }, pin) {
      const { data, error } = await supa.rpc("simpan_menu", {
        p_id: id || null,
        p_nama: nama || "",
        p_harga: harga == null || harga === "" ? null : Number(harga),
        p_kategori: kategori || "",
        p_deskripsi: deskripsi || "",
        p_urutan: urutan == null || urutan === "" ? null : Number(urutan),
        p_tersedia: tersedia !== false,
        p_pin: String(pin || ""),
      });
      if (error) throw error;
      return data; // {id} atau null (PIN salah)
    },

    async hapusMenu(id, pin) {
      const { data, error } = await supa.rpc("hapus_menu", {
        p_id: id, p_pin: String(pin || ""),
      });
      if (error) throw error;
      return !!data;
    },

    // Terapkan foto latar ke halaman (CSS var --bg-foto di :root).
    // url kosong → "none" (cuma gradient hangat, kayak belum ada foto).
    terapkanBg(url) {
      document.documentElement.style.setProperty(
        "--bg-foto", url ? `url("${url}")` : "none"
      );
    },

    // Buang file lama di bucket (best-effort) biar gak numpuk —
    // cuma nyentuh file milik bucket ini, gak bakal nyentuh file lain.
    async hapusFotoLama(url) {
      const tanda = "/storage/v1/object/public/" + TM_BUCKET + "/";
      const i = String(url || "").indexOf(tanda);
      if (i < 0) return; // URL di luar bucket kita — biarin
      const nama = decodeURIComponent(url.slice(i + tanda.length).split("?")[0]);
      await supa.storage.from(TM_BUCKET).remove([nama]);
    },

    // ── realtime (update daftar dapur / status customer) ──
    // panggil cb() tiap ada perubahan di tabel pesanan
    subscribe(cb) {
      const ch = supa.channel("tm-pesanan");
      ch.on("postgres_changes", { event: "*", schema: TM_SCHEMA, table: "pesanan" }, cb);
      ch.subscribe((st) => {
        if (st === "CHANNEL_ERROR" || st === "TIMED_OUT") {
          // biar gak sunyi: tandai offline lewat pill, list lama tetap tampil
          if (window.Notice) Notice.show("live", "Live putus — tarik ulang manual", { icon: "fa-solid fa-triangle-exclamation", type: "red" });
        }
      });
      return ch;
    },
  };
})();
