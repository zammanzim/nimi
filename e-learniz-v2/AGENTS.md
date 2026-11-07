# AGENTS.md

## Project

Web e-learning platform. Vanilla JS, HTML, CSS, Supabase (PostgreSQL + Auth + Storage). No build step. Static files served directly.

## Commands

**Never** run: `npm run dev`, `npm start`, `vite`, `serve`, or open browsers. User tests manually.

## Bahasa & Gaya

- Santai Indo, pake akhiran "-in" (sampaiin, ajuin, bikin, fix-in, etc)
- Campur inggris wajar
- Abis nambah / nge-fix code, kasi penjelasan biar paham

## showToast vs showPopup

- `showToast(msg, type)` → info singkat (berhasil, sukses, etc). type: `success`|`info`|`error`.
- `showPopup(msg, type)` → error, teks panjang, butuh perhatian serius. type: `info`|`confirm`|`error`. Return Promise.

## Keyboard Shortcut

- Halaman yg punya FAB → **Ctrl+Enter** buka FAB. Kayak `scores.html` pake `openAdminConfig()`.

## Script src — Wajib Konsisten

Semua halaman `/a/*.html` harus pake urutan script yg sama persis:

| # | Script | defer? |
|---|--------|--------|
| 1 | `@supabase/supabase-js@2` CDN | no |
| 2 | `supabase-clients.js` | **defer** |
| 3 | `ctx-menu.js` | no |
| 4 | `ui-components.js` | **defer** |
| 5 | `sidebar.js` | no |
| 6 | `lang.js` | no |
| 7 | `basicfeat.js` | no |
| 8 | `show-popup.js` | no |
| 9 | `auth.js` | **defer** |
| 10 | `activity.js` | **defer** |
| 11 | `visitor.js` | **defer** |
| 12 | `theme.js` | no |
| 13 | `toast.js` | no |
| 14 | `bottom-nav.js` | no |
| 15 | `system-notice.js` | no |

Tambahan kalo perlu:
- `subject-manager.js` (defer) — **cuma** kalo halaman pake card (announcements, subject, tugas, kisi-kisi, susulan)
- `daily-card.js` (defer) — di dalem `<body>`, setelah sidebar

## Layout — left-section + right-section

Desktop (`>=1024px`) pake dua kolom:
- `left-section` → konten utama (hero, tabel pribadi, dll)
- `right-section` → konten samping (leaderboard, announcements, dll)

Di mobile (default), kolom tinggal stack vertikal. Jangan lupa `flex-wrap: wrap` di `.main-content` kalo nambah elemen full-width di luar kedua section.

## Class Dropdown — Ga Boleh Hardcoded

Kalo ada dropdown/UI yg nampilin kelas, fetch dari DB:
```js
supabase.from('classes').select('id, name').order('id')
```

## SQL Table — Wajib Sertain RLS Basic

**⚠️ Penting: project ini pake localStorage custom auth, BUKAN Supabase Auth. Jangan pake `auth.role() = 'authenticated'` di RLS policy!**

Kalo bikin table baru, include RLS sederhana (sesuai kebutuhan akses):
```sql
ALTER TABLE nama_table ENABLE ROW LEVEL SECURITY;

-- Public insert (contoh: 404 log, visitor)
CREATE POLICY "public_insert" ON nama_table FOR INSERT WITH CHECK (true);
-- Atau pake anon key kalo perlu restrict
-- CREATE POLICY "anon_insert" ON nama_table FOR INSERT WITH CHECK (true);

-- Select/update/delete biasanya terbatas
CREATE POLICY "public_read" ON nama_table FOR SELECT USING (true);
CREATE POLICY "auth_delete" ON nama_table FOR DELETE USING (true);
```

## Key Architecture

| Concern | File / Pattern |
|---|---|
| Auth | `auth.js` — `getUser()` reads `localStorage.getItem("user")`, also Supabase session. Path guard at DOMContentLoaded. |
| DB client | `supabase-clients.js` — one `supabase.createClient()`, stored on `window.supabase`. |
| i18n | `lang.js` — `t('key', {vars})` or `data-i18n="key"`. Always use `t()` for user-facing text. Default lang `id`. Snake_case keys. |
| Popup | `showPopup(msg, type)` — type: `info`\|`confirm`\|`error`. Returns Promise. |
| Toast | `showToast(msg, type)` — type: `success`\|`info`\|`error`. |
| Theme | `theme.js` in `<head>` — reads `localStorage.user_theme`. Inline `<style>` override. |
| SubjectApp | `subject-manager.js` — singleton `const SubjectApp = {}` (global). Cards rendered via `createCardElement()`. ContentEditable-based editing. Format buttons must be on `window`. |
| Icons | Font Awesome 6.5 via CDN. |
| CSS | Single file `styleasli.css`. |

## Path Structure

- `/a/*.html` — user-facing pages (announcements, tugas, scores, theme, etc.)
- `/admiii/*.html` — admin-only pages
- `/login.html` — login page
- `/js/` — all JS (no imports/bundles, loaded via `<script>` tags in order)
- `/css/styleasli.css` — only stylesheet

## Editing Content Cards

- Cards use `contentEditable` with `.editable` fields (big_title, title, content, small)
- Edit mode: `SubjectApp.state.editMode` + `toggleEditMode()`
- Format functions: `formatText(size)`, `formatBold/Italic/Underline()` for modal; `cardFormat*()` for card editors
- Focus tracking: `window._lastEditor` + `focusin` listener
- Size formatting: per-line CSS classes `format-large/medium/small` (not `execCommand`)
- Link syntax: `tujuan=<url>, <label>` ↔ `<a class="inline-link">`. Stored as `<a>` in state, reverted to raw syntax in edit mode.
- Auto-list: `- ` → `• `, `1. Enter` → `2. ` (handled by `handleBulletAuto`/`handleNumberedAuto`)

## Database — Supabase Tables

### Table Reference

| Table | Fungsi |
|---|---|
| `activity_logs` | Aktivitas user (poin, page visits, dll) |
| `app_updates` | Halaman update aplikasi |
| `bookmarks` | Bookmark card (belum dipake aktif, rencana develop) |
| `classes` | Daftar kelas |
| `daily_config` | Konfigurasi daily-card (auto, forced day, badge, dll) |
| `daily_schedules` | Jadwal daily-card (pelajaran, piket, seragam) |
| `file_transfers` | File transfer — send.html & files.html |
| `forum_replies` | Komentar di forum |
| `forum_topics` | Topik forum |
| `guests` | Akun guest (sementara) |
| `menu_groups` | Grup menu sidebar |
| `nilai_config` | Konfigurasi hidden/sembunyi nilai |
| `nilai_files` | File nilai (PDF, gambar) |
| `nilai_psasi` | Data nilai PSAS 1 |
| `nilai_psat` | Data nilai PSAT |
| `nilai_pts` | Data nilai PTS |
| `page_visitor` | Visitor counter untuk studentsweb/ |

| `simulation_progress` | Progress quiz/simulation |
| `simulation_questions` | Soal quiz |
| `subject_announcements` | Data card (konten utama) |
| `subject_teachers` | Informasi guru per subject |
| `subjects_config` | Konfigurasi menu sidebar subject |
| `system_notifications` | Notifikasi sistem |
| `theme_logs` | Riwayat setting tema user |
| `user_posts` | Postingan user |
| `user_progress` | Progress user di tugas |
| `users` | Data semua user (auth, profil, avatar) |
| `visitor` | Visitor counter utama |

### Column Schema

```
activity_logs
  id              uuid
  user_id         text
  action_text     text
  page_name       text
  points          integer
  class_id        text
  created_at      timestamp with time zone
  reference_id    text

app_updates
  id              uuid
  title           text
  version         text
  items           jsonb
  created_at      timestamp with time zone

bookmarks
  id                bigint
  user_id           text
  announcement_id   bigint
  created_at        timestamp with time zone

classes
  id          bigint
  name        text
  is_active   boolean

daily_config
  class_id        text
  is_auto         boolean
  forced_day      text
  is_custom       boolean
  custom_badge    text
  custom_title    text
  custom_subtitle text
  mode            text
  kisi_days       jsonb

daily_schedules
  id          integer
  day_name    text
  uniform     text
  lessons     text
  picket      text
  notes       text
  activity    text
  class_id    text
  type        text

file_transfers
  id              bigint
  user_id         bigint
  uploader_name   text
  uploader_class  text
  file_name       text
  file_path       text
  file_size       bigint
  file_type       text
  message         text
  uploaded_at     timestamp with time zone

forum_replies
  id          bigint
  topic_id    uuid
  user_id     bigint
  content     text
  created_at  timestamp with time zone

forum_topics
  id          uuid
  user_id     bigint
  class_id    bigint
  title       text
  content     text
  created_at  timestamp with time zone

guests
  id          text
  nickname    text
  class_id    integer
  last_seen   timestamp with time zone

menu_groups
  id              bigint
  class_id        integer
  group_key       text
  group_label     text
  group_type      text
  display_order   integer
  created_at      timestamp with time zone

nilai_config
  test_id          text
  class_id         bigint
  hidden_subjects  jsonb

nilai_files
  id          bigint
  test_id     text
  class_id    bigint
  file_name   text
  file_url    text
  label       text
  created_at  timestamp with time zone

nilai_psasi
  id            bigint
  created_at    timestamp with time zone
  nama_siswa    text
  pabp          numeric
  bindo         numeric
  bing          numeric
  mtk           numeric
  sejarah       numeric
  pp            numeric

subject_announcements
  (id, class_id, subject_id, big_title, title, content, small, created_at, updated_at, card_color, is_task, task_date, display_order, susulan_day, susulan_date, susulan_subject, etc.)
  - susulan_day: (legacy) hari penempatan materi susulan (Senin..Jumat) — backward compat
  - susulan_date: tanggal penempatan materi susulan (YYYY-MM-DD) — fleksibel, bisa nambah minggu depan
  - susulan_subject: nama pelajaran (dari jadwal utama daily card, type='regular') — buat filter & urutan card ngikut jadwal

susulan_dates
  id          bigint
  class_id    bigint
  date        date  (YYYY-MM-DD, unique per class)
  created_at  timestamp with time zone

users
  (id, email, password, role, class_id, class_name, nickname, short_name, avatar_url, etc.)
```

### Storage Buckets

| Bucket | Fungsi |
|---|---|
| `subject-photos` | Foto/gambar cards |
| `avatars` | Foto profil user |
| `nilai-files` | File nilai (PDF) |
| `transfer-files` | File transfer |
| `simulation-files` | File quiz |
| `daily-files` | File daily card |

Schema definisi ada di `code.sql`. Jangan pake `sql_updates.sql` — kalo nambah SQL, tulis langsung di `code.sql`. Setiap write hapus dulu isi lama biar ga kagok.

## Style

- No TypeScript, no classes (object literals with methods), no imports
- `querySelector`, `addEventListener`, template literals
- Preserve existing naming, formatting, and architecture
- Minimal surgical edits; avoid refactoring unrelated code
