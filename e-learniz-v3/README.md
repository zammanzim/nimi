# E-Learniz V3 — Bright Playful Classroom ✨

Portal belajar kelas statis tanpa build step: **HTML + CSS + vanilla JS + Supabase (`v3` schema) + Cloudflare R2**. Tema cerah & ceria dengan aksen *Sky Blue, Sunny Amber, Fresh Mint, dan Crisp White*.

## Fokus 3 Halaman Utama (`index.html`)

1. **Beranda (`#/`) — Daily Card + Pengumuman**
   - Sapaan otomatis sesuai jam **WIB** (pagi/siang/sore/malam), profil siswa/staff, dan pemilih kelas untuk `super_admin`.
   - **Daily Card Interaktif**:
     - Tab hari `Sen`–`Min`.
     - Otomatis menampilkan jadwal besok setelah **15:00 WIB** (Sabtu/Minggu → Senin).
     - 3 kartu info harian: seragam, kegiatan, catatan.
     - Timeline pelajaran dengan penanda `SEKARANG` dan nama mapel yang bisa diklik.
     - Piket kelas sebagai pill nama.
     - Editor jadwal khusus staff (info harian + periode pelajaran) yang menyimpan `subject_id` asli.
   - **Feed Pengumuman Kelas**: kartu dengan PIN, lampiran gambar R2, dan lightbox.

2. **Daftar Tugas (`#/tugas`)**
   - Kartu progres siswa: total, selesai, persentase, dan pesan motivasi.
   - **3 filter status**: `Belum`, `Selesai`, `Semua` (slider 3 kolom).
   - **Chip mapel dengan jumlah tugas** dan filter pencarian judul/bab/catatan/mapel.
   - **Prioritas pintar**: tugas dari mapel yang ada di jadwal **hari ini/besok** diberi badge `⚡ Jadwal Hari Ini/Besok` dan diurutkan setelah kartu PIN.
   - Centang selesai tersimpan di `v3.task_progress` + cache lokal.

3. **Mata Pelajaran (`#/mapel` & `#/mapel/<slug>`)**
   - **Katalog mapel**: grid semua mapel, pencarian nama mapel/guru, jumlah konten, dan jumlah tugas aktif.
   - **Detail mapel**: kartu info guru + tombol Chat WhatsApp, statistik konten/tugas, progress bar, filter `Semua/Tugas/Materi/Dipin`, dan pencarian.
   - Edit info mapel (nama, guru, kontak, icon, warna) khusus staff.

## Autentikasi & Keamanan

- **Siswa**: login “pilih nama” dari `v3.users` tanpa password (model kelas, bukan akun rahasia).
- **Staff/guru**: **wajib Supabase Auth** (email + password). Tidak ada lagi fallback `admin`/`guru` dari localStorage.
- Alias username staf diatur di `js/config.js` (`V3_STAFF_EMAIL_ALIASES`).
- `verifyStaffSession()` memverifikasi sesi Supabase + role staff di `v3.users` setiap halaman dimuat; localStorage palsu dibersihkan.
- RLS tetap menjadi pengaman utama: tulis konten hanya untuk staff terautentikasi; siswa hanya boleh menulis `task_progress` & `visitors`.
- Semua teks dari database di-escape sebelum dirender; warna divalidasi agar tidak bisa injeksi CSS.

## Waktu & Zona WIB

Semua logika tanggal/jam memakai `Asia/Jakarta` melalui `js/time.js`:

- tanggal hari ini, nama hari, dan key pengunjung harian;
- parsing `<input type="datetime-local">` sebagai WIB (bukan timezone perangkat);
- format deadline dan jam pengunjung;
- penentuan jadwal hari ini/besok dan penanda jam pelajaran.

## Struktur File

```text
index.html                 Shell SPA (#/, #/tugas, #/mapel, #/mapel/<slug>)
login.html                 Pilih nama siswa + login Supabase Auth staff
subject.html               Redirect lama -> index.html#/mapel/<id>
subjects.html              Redirect lama -> index.html#/mapel
tugas.html                 Redirect lama -> index.html#/tugas
css/style.css              Design system + komponen SPA
js/config.js               Konfigurasi Supabase, R2, alias staf, timezone
js/time.js                 Helper tanggal/jam WIB
js/db.js                   Data layer PostgREST schema v3 + upload R2
js/auth.js                 Sesi siswa + verifikasi staff Supabase Auth
js/ui.js                   Toast, popup/modal, dropdown, escapeHtml, safeColor
js/cards.js                Daily Card, course card, profil progres tugas
js/app.js                  Router SPA, filter tugas, prioritas, halaman mapel
js/sidebar.js              Sidebar, bottom nav, dropdown profil/kelas
js/visitor.js              Pencatat & daftar pengunjung (DB + fallback lokal)
db/schema.sql              Schema idempotent (aman dijalankan ulang)
db/reset.sql               Reset total schema v3 (DESTRUKTIF, manual)
db/seed.sql                Migrasi data awal dari schema public lama
db/migrations/             Migration incremental untuk database live
worker/                    Cloudflare Worker presign upload R2
```

## Setup Database

1. Jalankan `db/schema.sql` di SQL Editor Supabase. File ini **tidak menghapus data** dan aman diulang.
2. (Opsional) Jalankan `db/seed.sql` untuk migrasi data dari schema `public` lama.
3. Untuk database yang sudah berjalan, jalankan file di `db/migrations/` (idempotent).
4. Pastikan schema `v3` ada di **Project Settings → API → Exposed schemas**.
5. Staff login memakai user Supabase Auth yang `auth_user_id`-nya terhubung ke baris `v3.users` dengan role `teacher`, `class_admin`, atau `super_admin`.

> **Reset total** hanya jika benar-benar diperlukan: `db/reset.sql` akan menghapus seluruh schema `v3` dan isinya. Setelah itu jalankan `db/schema.sql` lagi.

## Catatan Pengembangan

- Tidak ada bundler/build step; buka lewat static server (bukan `file://`) agar Supabase & modul berjalan normal.
- Upload gambar membutuhkan sesi staff karena worker presign memverifikasi Bearer token Supabase.
- Jika `V3_R2_ENABLED = false`, UI upload dinonaktifkan tetapi gambar lama tetap tampil.
