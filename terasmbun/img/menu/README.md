# img/menu/ (arsip foto asli)

Foto menu **udah pindah ke Supabase Storage** — bucket `terasmbun-media`,
dipakai lewat kolom `gambar` di tabel `terasmbun.menu`.

Cara ganti foto menu sekarang (gak perlu SQL):

1. Buka `dapur`, masukin PIN.
2. Klik tombol **kamera** (atas) — panel "Foto Menu" muncul.
3. Klik **Pasang / Ganti** di menu yang mau — pilih foto dari galeri.
   Foto otomatis dikompres di browser (maks. 1200px, JPEG) sebelum diupload.

File di folder ini cuma **arsip foto asli** (sebelum dikompres & diupload) —
gak dipakai lagi sama web. Aman dihapus kalo lo mau, tapi disimpen dulu
siapa tau butuh foto versi penuh lagi.

Belum ada foto? Gak masalah — otomatis tampil placeholder
(gradient coklat + emoji kategori) di web.
