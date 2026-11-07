# TERAS MBUN — Web Pesenan

Web pesenan buat jualan makanan, biar gak pusing nerima pesenan lewat WA.
Customer pilih menu + kirim pesenan tanpa login; admin dapur buka `dapur`,
masuk PIN, ceklis status pesenan (`menunggu → dibuat → siap`).

Stack: **vanilla HTML/CSS/JS, tanpa framework, tanpa build step.**
Backend: **Supabase** (project e-learniz-v3, skema terpisah `terasmbun`).
Deploy: **GitHub Pages** (`terasmbun.github.io`).

## Struktur

```
index            # sisi customer: hero, showcase menu (semua menu tampil)
pesen            # halaman pesen: kartu menu per kategori + keranjang + form
pesenan-aku      # halaman pesenan ku: RIWAYAT semua pesenan (localStorage) + status live + QRIS
dapur            # sisi admin dapur: gate PIN, daftar realtime, ceklis status
admin            # sisi admin: gate PIN, kelola menu penuh + foto latar, QRIS, menu
css/style.css         # design system (palet hangat coklat-krem-hijau)
js/config.js          # URL + anon key Supabase (publik, aman)
js/db.js              # layer DB: baca langsung, nulis via RPC, upload foto
js/menu.js            # logic sisi customer (index)
js/pesen.js           # logic halaman pesen (stepper langsung masuk keranjang, level per item)
js/pesenan-aku.js     # logic riwayat pesenan aku (localStorage → kartu per pesanan, patch status live)
js/dapur.js           # logic sisi dapur
js/admin.js           # logic halaman admin (CRUD menu + foto: kompres → upload → RPC PIN)
js/toast.js           # toast bawaan (pola osistarpanone)
js/notice.js          # pill nempel (live / error)
js/show-popup.js      # modal pengganti alert()
sw.js                 # service worker PWA
manifest.webmanifest
db/001..012-*.sql     # migrasi (sudah ke-apply di Supabase; 012 = ongkir COD +3000, gak fix)
opencode.json         # config OpenCode: MCP Supabase nujuk ke project ini
```

## Jalanin lokal

Gak ada npm/build. Dari root repo:

```
python -m http.server 8000
```

buka `http://localhost:8000`.

## Hal penting soal database

Semua benda di skema `terasmbun` (project Supabase e-learniz-v3).
Migrasi lengkap ada di `db/001-…` sampai `db/009-…` (jalankan berurutan di
SQL Editor kalo bikin project baru).

- **Menu** (`terasmbun.menu`): anon cuma bisa SELECT. Ubah menu lewat SQL Editor:
  ```sql
  insert into terasmbun.menu (nama, harga, kategori, urutan)
  values ('Ayam Bakar Madu', 20000, 'nasi', 9);
  ```
- **Pesanan** (`terasmbun.pesanan`): insert **hanya lewat RPC** `buat_pesanan`
  (total dihitung server-side dari harga menu, jadi gak bisa dimanipulasi browser).
  Ubah status **hanya lewat RPC** `ubah_status` yang wajib PIN.
- **Setting** (`terasmbun.setting`): tertutup rapat buat anon. Isinya hash PIN + no WA.

### Ganti PIN dapur

PIN default: **1234**. Ganti sekarang juga di SQL Editor:

```sql
update terasmbun.setting
set value = encode(digest('PIN_BARU_LO', 'sha256'), 'hex')
where key = 'pin_dapur';
```

### Isi nomor WA penjual (buat tombol share)

```sql
update terasmbun.setting
set value = '628xxxxxxxxxx'   -- format internasional tanpa +
where key = 'wa_penjual';
```

## Admin (admin)

Halaman admin — masuk PIN (sama kayak dapur), bisa:

- **Menu penuh**: tambah menu, edit nama / harga / kategori / deskripsi /
  urutan, toggle **habis/tersedia** (ikon bulan ✓), hapus menu.
  Kategori bebas tulis baru (diketik aja di form — diformatin otomatis
  huruf kecil + strip bawah). Semua lewat RPC wajib PIN
  (`simpan_menu`, `hapus_menu` — migrasi `db/009-menu-crud.sql`).
- **Foto menu** — ganti/pasang per menu; URL-nya ke kolom `menu.gambar`.
- **Foto latar** — nongol di semua halaman. Kalo dihapus, balik ke
  gradient hangat (gak ada foto = tetep rapi).
- **Foto QRIS** — otomatis muncul di halaman pesen buat pelanggan yang
  pilih bayar QRIS (sesudah pesenan dibuat).

Akses: tombol kamera di topbar dapur, atau langsung `admin`.

Foto disimpen di bucket **`terasmbun-media`** (public) — bukan di repo.
Yang diupload otomatis dikompres dulu di browser (maks. sisi 1200px,
JPEG ~0.7), jadi biasanya turun dari beberapa MB jadi ~100KB.
Ganti/hapus foto lewat RPC wajib PIN (`ubah_menu_gambar` buat menu,
`ubah_media` buat bg/qris) — URL-nya divalidasi server, cuma boleh dari
bucket ini. Migrasi: `db/007-media-storage.sql` + `db/008-media-warung.sql`.

## Alur pemakaian

1. Customer buka `index` → pilih menu → keranjang → isi nama → kirim.
2. Dapet kode pesenan (mis. `#007`) + opsi share ke WA penjual.
3. Admin buka `dapur` → PIN → lihat daftar (realtime, ke-update sendiri).
4. Ceklis: **Mulai masak** (`menunggu → dibuat`) → **Beres** (`dibuat → siap`).
5. Customer cek status di `index` pakai kodenya (juga realtime).

## Catatan jujur

- Tanpa login, siapa pun yang tau URL bisa **lihat** daftar pesenan. Risiko
  wajar skala warung — ngubah status tetap dikunci PIN.
- Kalau nanti mau lebih ketat (nomor WA disembunyikan, dsb), tinggal tambah
  filter di policy RLS.
