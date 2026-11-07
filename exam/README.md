# EXAM — standalone (tanpa login)

2 halaman publik + 1 admin minimal. DB: tabel `exam_*` (fresh dari 0).
Media: **R2 WAJIB** (Supabase Storage dilarang — usage bengkak).
Kelas via `?id=` (default xrpl2), ga ada UI ganti kelas — tiap kelas
punya link sendiri. `index.html` cuma redirect ke kisi.

## Buka

- `index.html` → pilih kelas + nama (opsional)
- `kisi.html?id=xrpl1` → jadwal hari ini + kisi per hari (entry utama)
- `quiz.html?id=xrpl1&mapel=mtk` → latihan soal bernilai (`mapel` opsional)
- `nilai.html?id=asts` → nilai asli guru (pribadi + leaderboard + file)
- `admin.html` → PIN default `1234` (ganti di tabel `exam_settings`)

Static doang, langsung serve folder ini (mis. `npx serve` / hosting statis).
Ga ada relasi ke folder e-learniz.

## Struktur

```
index.html (redirect)  kisi.html  quiz.html  admin.html
js/config.js  js/db.js  js/media.js  js/kisi.js  js/quiz.js  js/admin.js
css/style.css
worker/presign.js + wrangler.toml
tools/migrate-exam-r2.mjs
schema.sql
```

## Setup R2 (wajib — tanpa ini upload mati, baca file lama tetap jalan)

1. Cloudflare R2: bikin bucket `exam` + custom domain
   (`https://media.e-learniz.my.id`, live) + CORS:
   AllowOrigin=domain exam, AllowMethods=GET,PUT,DELETE,HEAD,
   AllowHeaders=Content-Type.
2. R2 → Manage API tokens → bikin token Read & Write → catat
   Access Key + Secret + Endpoint.
3. Deploy `worker/presign.js` (wrangler + secrets, lihat header file).
4. `js/config.js`: isi `R2_PUBLIC_BASE` + `R2_PRESIGN_URL`,
   set `R2_ENABLED = true`.
5. Migrasi file lama SB → R2 (biar usage Supabase turun):
   ```
   cd C:\nimi\exam\tools
   npm init -y; npm i @aws-sdk/client-s3
   # set ENV (lihat header migrate-exam-r2.mjs), DRY_RUN=1 dulu, baru gas
   ```
6. Verifikasi semua lampiran kebuka via domain R2, abis itu hapus file
   lama di bucket Supabase `subject-photos` biar usage turun.
   (Jangan hapus sebelum verifikasi — DB lama e-learniz masih pake!)

## Tabel (exam_*)

- `exam_classes` (slug unik: xrpl1..xrpl4)
- `exam_config` (exam_days per kelas)
- `exam_schedules` (class_id, day_name, items JSONB `[{jam, mapel}]`)
- `exam_kisi` (class_id, day_name eksplisit, subject, content)
- `exam_media` (kisi_id, path relatif/URL, label, kind)
- `exam_questions` (subject slug global, question, options JSONB, answer, explanation)
- `exam_subjects` (slug, name, icon)
- `exam_settings` (admin_pin)
