# img/ (arsip foto asli)

Foto background **udah pindah ke Supabase Storage** — bucket `terasmbun-media`,
dipakai langsung oleh `css/style.css` (blok `body::before`) lewat URL publik:

```
https://<project>.supabase.co/storage/v1/object/public/terasmbun-media/bg.jpg
```

File di folder ini cuma **arsip foto asli** (sebelum dikompres & diupload) —
gak dipakai lagi sama web. Aman dihapus kalo lo mau, tapi disimpen dulu
siapa tau butuh foto versi penuh lagi.

Cara ganti foto background: upload foto baru ke bucket (mis. lewat SQL Editor /
Storage dashboard Supabase, atau tambahin `bg-v2.jpg` terus update URL di
`css/style.css`).
