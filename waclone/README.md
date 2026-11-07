# WhatsApp Archive — Pembaca Arsip Chat WhatsApp (`.txt`)

Aplikasi web statis untuk membaca dan menelusuri file arsip percakapan WhatsApp hasil export `.txt` dengan antarmuka modern yang menyerupai **WhatsApp Desktop (Dark Theme)**.

Pemrosesan file dan pencarian dilakukan **100% di browser Anda** (File API), sementara penyimpanan arsip memakai **Supabase (project `vtt`) sebagai penyimpanan utama** dengan **IndexedDB sebagai cadangan lokal** — jadi import TXT langsung masuk ke database Supabase, dan aplikasi tetap bisa dibuka saat offline.

---

## Fitur Utama

1. **Desain WhatsApp Desktop Modern (Dark Mode Default)**
   - **Sidebar Kiri**: Daftar percakapan yang telah diimpor, preview pesan terakhir, timestamp, jumlah pesan, dan pencarian cepat.
   - **Panel Chat Kanan**: Bubble pesan pemilik akun di kanan (`#005c4b` hijau gelap), bubble kontak di kiri (`#202c33` abu-abu gelap), pemisah tanggal harian, indikator tanggal melayang (*sticky floating date*), serta tampilan khusus untuk pesan sistem dan `<Media omitted>`.
   - **Responsif**: Mendukung layar Desktop, Tablet, dan HP (dilengkapi tombol kembali ke daftar percakapan pada layar mobile).

2. **Import File TXT & Deduplikasi Pintar**
   - Import file `.txt` melalui tombol **Import TXT** (mendukung multi-file) atau **Drag & Drop** langsung ke jendela browser.
   - Menghitung *content fingerprint* secara otomatis sehingga mengimpor file yang sama berulang kali tidak akan menggandakan arsip atau pesan.
   - Menampilkan ringkasan jumlah pesan yang berhasil diparsing serta laporan baris yang tidak dikenali (jika ada).
   - Opsi penggantian nama pengirim pemilik akun (*Anda / Kanan*, misal `"zim"`) secara dinamis melalui dropdown maupun input manual.

3. **Pencarian Cepat & Highlight Kata**
   - Pencarian kata/kalimat *case-insensitive* di seluruh percakapan (pintasan `Ctrl+F` / `Cmd+F`).
   - Highlight kata yang cocok dengan elemen `<mark>` yang aman.
   - Navigasi hasil pencarian Sebelumnya (`Shift+Enter`) / Berikutnya (`Enter`) dan daftar hasil pencarian lengkap beserta tanggal dan cuplikan pesan.

4. **Navigasi Tanggal & Virtual Scrolling Berperforma Tinggi**
   - Dilengkapi *Windowed Virtual Scrolling* sehingga sanggup menampilkan arsip dengan **puluhan ribu pesan** secara mulus tanpa membebani DOM.
   - Navigasi langsung ke pesan paling awal, pesan paling akhir, atau tanggal tertentu melalui *Date Picker* (otomatis mengarahkan ke tanggal terdekat jika tanggal yang dipilih tidak memiliki pesan).

5. **Penyimpanan Hybrid: Supabase + Cadangan Lokal (IndexedDB)**
   - Setiap import TXT **langsung disimpan ke Supabase** (tabel `wa_archives` / `wa_messages`), lalu juga dicadangkan ke IndexedDB.
   - Arsip tetap tersimpan meskipun halaman dimuat ulang (*reload*) **atau Anda sedang offline** — perubahan yang dibuat saat offline otomatis diunggah saat aplikasi dibuka kembali dengan internet.
   - Privasi per perangkat: setiap browser punya *device id* unik dan Row Level Security (RLS) memastikan hanya arsip dari device yang sama yang bisa dibaca/dihapus.
   - Mendukung ganti nama arsip, hapus satu arsip, atau hapus seluruh data lokal & cloud aplikasi.

---

## Integrasi Supabase

| Item | Nilai |
|---|---|
| Project | `vtt` (`eefdfaqcccgpfthdidzp.supabase.co`) |
| Tabel | `wa_archives` (meta arsip), `wa_messages` (pesan, di-chunk 500 pesan/baris) |
| Kunci | anon/publishable key (ditulis di `js/supabase-store.js`, aman untuk client) |
| RLS | Setiap operasi membaca `x-device-id` dari header request via fungsi `wa_device_id()`; baris hanya terlihat jika `deviceId`-nya cocok |
| Sinkronisasi | `syncWithCloud()` dijalankan saat aplikasi dibuka: unggah perubahan lokal yang lebih baru, unduh perubahan cloud yang lebih baru (`updatedAt` sebagai penentu) |
| Hapus offline | Gagal menghapus di cloud dicatat sebagai *pending delete* dan dicoba lagi saat sinkronisasi berikutnya (tidak "hidup lagi" datanya) |

Urutan tulis cloud sengaja **pesan dulu, meta belakangan** — jika simpan gagal setengah jalan, `updatedAt` cloud tidak akan pernah lebih baru dari salinan lokal, sehingga sinkronisasi selalu bisa mendeteksi dan mengulanginya.

---

## Struktur Proyek

```text
whatsapp-archive/
├── index.html          # Halaman utama aplikasi
├── css/
│   └── style.css       # Stylesheet tema gelap WhatsApp Desktop & responsif
├── js/
│   ├── app.js          # Controller utama aplikasi, event, dan state
│   ├── parser.js       # Parser RegEx untuk file export WhatsApp (.txt)
│   ├── database.js     # Lapisan penyimpanan hybrid (Supabase + fallback IndexedDB + sinkronisasi)
│   ├── supabase-store.js# Client PostgREST mentah (tanpa SDK): REST, device id, chunk pesan
│   ├── chat-renderer.js# Virtual scrolling & DOM renderer pesan yang aman
│   ├── search.js       # Mesin pencarian pesan & daftar cuplikan hasil
│   └── utils.js        # Helper tanggal, URL sanitizer, highlight, & hash
├── tests/
│   ├── parser.test.mjs # Pengujian unit parser, URL sanitizer, & performa
│   ├── supabase.test.mjs# Pengujian integrasi cloud (CRUD, chunk, isolasi RLS) — butuh internet
│   └── database.test.mjs# Pengujian lapisan hybrid (offline fallback, sync, pending delete)
└── README.md           # Dokumentasi penggunaan
```

---

## Cara Menjalankan Aplikasi

Karena aplikasi ini menggunakan **ES Modules** (`<script type="module">`) tanpa proses build atau bundler, jalankan melalui server HTTP statis lokal apa pun:

### Opsi 1: Menggunakan Node.js (`npx serve` atau `http-server`)
```bash
npx serve .
```
atau dengan Python:
```bash
python -m http.server 8080
```
Kemudian buka `http://localhost:8080` (atau port yang ditampilkan) di browser modern (Chrome, Edge, Firefox, Safari).

### Menjalankan Unit Test Parser
```bash
node tests/parser.test.mjs
```

### Menjalankan Test Integrasi Supabase (butuh internet)
```bash
node tests/supabase.test.mjs
```
Test ini menulis ke project Supabase sungguhan memakai *device id* tes sewaan lalu membersihkan dirinya sendiri — memverifikasi CRUD, chunking pesan, dan isolasi RLS antar-device.

### Menjalankan Test Lapisan Hybrid (butuh internet)
```bash
node tests/database.test.mjs
```
Test ini memakai IndexedDB palsu in-memory + penyamaran *offline* untuk memverifikasi jalur cadangan lokal, unggah saat sync, hapus yang tertunda (*pending delete*), dan pengaturan per-device. Baris `fetch failed (simulated offline)` yang muncul di console adalah bagian dari skenario yang diuji, bukan error.

---

## Format Export TXT yang Didukung

Parser dirancang untuk menangani format export standar WhatsApp seperti:

```text
12/18/25, 11:16 AM - almira: jam
12/18/25, 11:16 AM - almira: dmna?
12/18/25, 11:22 AM - almira: distudio lain?
12/18/25, 11:22 AM - zim: iyh
```

**Detail kemampuan parser:**
- Format tanggal `MM/DD/YY` dan `MM/DD/YYYY` (serta fallback otomatis ke `DD/MM/YY(YY)` apabila angka pertama > 12).
- Format waktu 12 jam (`AM`/`PM`, termasuk karakter *narrow no-break space* `\u202F` dan `\u00A0`) maupun 24 jam.
- Karakter *invisible directional marks* (`\u200E`, `\u200F`, `\uFEFF`).
- Nama pengirim dengan spasi, angka, atau simbol.
- Isi pesan yang mengandung tanda titik dua (`:`), URL (`http://` dan `https://`), emoji, serta pesan multi-baris dan baris kosong.
- Baris notifikasi sistem WhatsApp (tanpa pengirim) dan baris media (`<Media omitted>`).

### Batasan Format yang Belum Didukung
- File lampiran media asli (`.jpg`, `.mp4`, `.opus`, `.pdf`) di dalam arsip `.zip` belum ditampilkan sebagai pratinjau gambar/audio/video (aplikasi fokus pada pembacaan file `.txt`).
- Format tanggal kustom berbahasa lokal non-angka (misalnya `"18 Desember 2025 pukul 11.16"` dengan titik sebagai pemisah jam/menit pada beberapa perangkat lama).
