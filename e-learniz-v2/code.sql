-- ============================================================
-- code.sql — jalanin sekali di Supabase SQL Editor
-- Idempotent: aman di-run berkali-kali (DROP + CREATE)
-- ============================================================

-- ── GUARD: biar aman di-run ulang ──
DROP POLICY IF EXISTS "public_read" ON task_submissions;
DROP POLICY IF EXISTS "public_insert" ON task_submissions;
DROP POLICY IF EXISTS "public_update" ON task_submissions;
DROP POLICY IF EXISTS "public_delete" ON task_submissions;
DROP POLICY IF EXISTS "public_read" ON page_errors;
DROP POLICY IF EXISTS "public_insert" ON page_errors;
DROP POLICY IF EXISTS "public_select" ON page_errors;
DROP POLICY IF EXISTS "public_delete" ON page_errors;
DROP POLICY IF EXISTS "public_read" ON nilai_scores;
DROP POLICY IF EXISTS "public_insert" ON nilai_scores;
DROP POLICY IF EXISTS "public_update" ON nilai_scores;
DROP POLICY IF EXISTS "public_delete" ON nilai_scores;
DROP POLICY IF EXISTS "public_read" ON nilai_config;
DROP POLICY IF EXISTS "public_insert" ON nilai_config;
DROP POLICY IF EXISTS "public_update" ON nilai_config;
DROP POLICY IF EXISTS "public_delete" ON nilai_config;
DROP POLICY IF EXISTS "public_read" ON nilai_files;
DROP POLICY IF EXISTS "public_insert" ON nilai_files;
DROP POLICY IF EXISTS "public_update" ON nilai_files;
DROP POLICY IF EXISTS "public_delete" ON nilai_files;
DROP POLICY IF EXISTS "public_read" ON nilai_psat;
DROP POLICY IF EXISTS "public_insert" ON nilai_psat;
DROP POLICY IF EXISTS "public_update" ON nilai_psat;
DROP POLICY IF EXISTS "public_delete" ON nilai_psat;
DROP POLICY IF EXISTS "public_read" ON simulation_questions;
DROP POLICY IF EXISTS "public_insert" ON simulation_questions;
DROP POLICY IF EXISTS "public_update" ON simulation_questions;
DROP POLICY IF EXISTS "public_delete" ON simulation_questions;
DROP POLICY IF EXISTS "public_read" ON flashcards;
DROP POLICY IF EXISTS "public_insert" ON flashcards;
DROP POLICY IF EXISTS "public_update" ON flashcards;
DROP POLICY IF EXISTS "public_delete" ON flashcards;

-- Buang policy lama pake auth.role() kalo masih ada
DROP POLICY IF EXISTS "auth_insert" ON task_submissions;
DROP POLICY IF EXISTS "auth_update" ON task_submissions;
DROP POLICY IF EXISTS "auth_delete" ON task_submissions;
DROP POLICY IF EXISTS "auth_insert" ON nilai_scores;
DROP POLICY IF EXISTS "auth_update" ON nilai_scores;
DROP POLICY IF EXISTS "auth_delete" ON nilai_scores;
DROP POLICY IF EXISTS "auth_select" ON page_errors;
DROP POLICY IF EXISTS "auth_delete" ON page_errors;

-- ============================================================
-- classes — Daftar kelas (master)
-- ============================================================
CREATE TABLE IF NOT EXISTS classes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    name            TEXT NOT NULL,
    academic_year   TEXT DEFAULT '2025/2026',
    is_active       BOOLEAN DEFAULT true
);
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON classes FOR SELECT USING (true);
CREATE POLICY "public_insert" ON classes FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON classes FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON classes FOR DELETE USING (true);

-- ============================================================
-- task_submissions — kirim-tugas
-- ============================================================
CREATE TABLE IF NOT EXISTS task_submissions (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id     TEXT NOT NULL,
    user_name   TEXT,
    user_class  TEXT,
    teacher_name TEXT NOT NULL,
    file_url    TEXT,
    file_name   TEXT,
    link_url    TEXT,
    message     TEXT DEFAULT '',
    avatar_url  TEXT,
    tugas_id    BIGINT,
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_task_submissions_tugas_id ON task_submissions(tugas_id);
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS tugas_id BIGINT;
ALTER TABLE task_submissions ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE task_submissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON task_submissions FOR SELECT   USING (true);
CREATE POLICY "public_insert" ON task_submissions FOR INSERT   WITH CHECK (true);
CREATE POLICY "public_update" ON task_submissions FOR UPDATE   USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON task_submissions FOR DELETE   USING (true);

-- ============================================================
-- Storage: transfer-files
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('transfer-files', 'transfer-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;
DROP POLICY IF EXISTS "auth_insert_transfer" ON storage.objects;
DROP POLICY IF EXISTS "auth_select_transfer" ON storage.objects;
DROP POLICY IF EXISTS "auth_delete_transfer" ON storage.objects;
CREATE POLICY "public_insert_transfer" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'transfer-files');
CREATE POLICY "public_select_transfer" ON storage.objects FOR SELECT   USING (bucket_id = 'transfer-files');
CREATE POLICY "public_delete_transfer" ON storage.objects FOR DELETE   USING (bucket_id = 'transfer-files');

-- ============================================================
-- nilai_scores — unified nilai (psts, psasi, psat)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_scores (
    id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    user_id TEXT NOT NULL,
    class_id TEXT NOT NULL,
    scores_type TEXT NOT NULL,
    nama_siswa TEXT,
    pabp NUMERIC DEFAULT 0, pp NUMERIC DEFAULT 0,
    bindo NUMERIC DEFAULT 0, bing NUMERIC DEFAULT 0,
    mtk NUMERIC DEFAULT 0, sejarah NUMERIC DEFAULT 0,
    bjepang NUMERIC DEFAULT 0, bsunda NUMERIC DEFAULT 0,
    senibudaya NUMERIC DEFAULT 0, informatika NUMERIC DEFAULT 0,
    pjok NUMERIC DEFAULT 0, proipas NUMERIC DEFAULT 0,
    dasprog1 NUMERIC DEFAULT 0, dasprog2 NUMERIC DEFAULT 0, dasprog3 NUMERIC DEFAULT 0,
    is_private BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (user_id, scores_type)
);
ALTER TABLE nilai_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_scores FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_scores FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_scores FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_scores FOR DELETE USING (true);

-- ============================================================
-- page_errors — 404 log
-- ============================================================
CREATE TABLE IF NOT EXISTS page_errors (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    url         TEXT NOT NULL,
    referrer    TEXT DEFAULT '',
    user_agent  TEXT DEFAULT '',
    user_id     TEXT DEFAULT '',
    created_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE page_errors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert" ON page_errors FOR INSERT WITH CHECK (true);
CREATE POLICY "public_select" ON page_errors FOR SELECT   USING (true);
CREATE POLICY "public_delete" ON page_errors FOR DELETE   USING (true);

-- ============================================================
-- nilai_config — hidden subject per test/kelas
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_config (
    test_id         TEXT NOT NULL,
    class_id        BIGINT NOT NULL,
    hidden_subjects JSONB DEFAULT '[]'::jsonb,
    PRIMARY KEY (test_id, class_id)
);
ALTER TABLE nilai_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_config FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_config FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_config FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_config FOR DELETE USING (true);

-- ============================================================
-- nilai_files — file nilai asli (PDF/gambar)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_files (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    test_id         TEXT NOT NULL,
    class_id        BIGINT NOT NULL,
    file_name       TEXT,
    file_url        TEXT,
    label           TEXT,
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE nilai_files ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;
ALTER TABLE nilai_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_files FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_files FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_files FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_files FOR DELETE USING (true);

-- ============================================================
-- nilai_psat — nilai lama (masih dipake buat migrasi)
-- ============================================================
CREATE TABLE IF NOT EXISTS nilai_psat (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    nama_siswa      TEXT,
    class_id        TEXT,
    is_private      BOOLEAN DEFAULT false,
    pabp NUMERIC DEFAULT 0, pp NUMERIC DEFAULT 0,
    bindo NUMERIC DEFAULT 0, bing NUMERIC DEFAULT 0,
    mtk NUMERIC DEFAULT 0, sejarah NUMERIC DEFAULT 0,
    bjepang NUMERIC DEFAULT 0, bsunda NUMERIC DEFAULT 0,
    senibudaya NUMERIC DEFAULT 0, informatika NUMERIC DEFAULT 0,
    pjok NUMERIC DEFAULT 0, proipas NUMERIC DEFAULT 0,
    dasprog1 NUMERIC DEFAULT 0, dasprog2 NUMERIC DEFAULT 0, dasprog3 NUMERIC DEFAULT 0
);
ALTER TABLE nilai_psat ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON nilai_psat FOR SELECT USING (true);
CREATE POLICY "public_insert" ON nilai_psat FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON nilai_psat FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON nilai_psat FOR DELETE USING (true);

-- ============================================================
-- simulation_questions — soal quiz
-- ============================================================
CREATE TABLE IF NOT EXISTS simulation_questions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id      TEXT NOT NULL,
    class_id        BIGINT DEFAULT 0,
    question        TEXT NOT NULL,
    options         JSONB DEFAULT '[]'::jsonb,
    answer          INTEGER DEFAULT 0,
    explanation     TEXT DEFAULT '',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE simulation_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON simulation_questions FOR SELECT USING (true);
CREATE POLICY "public_insert" ON simulation_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON simulation_questions FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON simulation_questions FOR DELETE USING (true);

-- ============================================================
-- flashcards — kartu belajar
-- ============================================================
CREATE TABLE IF NOT EXISTS flashcards (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject_id      TEXT NOT NULL,
    class_id        BIGINT DEFAULT 0,
    front           TEXT NOT NULL,
    back            TEXT NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_read"   ON flashcards FOR SELECT USING (true);
CREATE POLICY "public_insert" ON flashcards FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON flashcards FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON flashcards FOR DELETE USING (true);


-- ============================================================
-- MIGRASI: nilai lama → nilai_scores
-- ── Jalanin kalo perlu, aman di-run ulang (ON CONFLICT DO NOTHING)
-- ============================================================

-- ============================================================
-- CEK SISWA YANG GA KEMATCH (debug)
-- ============================================================
SELECT 'psts' AS tbl, n.nama_siswa FROM nilai_psts n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL
UNION ALL
SELECT 'psasi', n.nama_siswa FROM nilai_psasi n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.nickname))
    WHERE u.id IS NULL
UNION ALL
SELECT 'psat', n.nama_siswa FROM nilai_psat n
    LEFT JOIN users u ON LOWER(TRIM(n.nama_siswa)) = LOWER(TRIM(u.full_name))
    WHERE u.id IS NULL;


-- ============================================================
-- UPDATE LOG & MENU SEED (v4.1)
-- ============================================================

-- Tambahkan menu flashcard ke kelas 2 (master/system) jika belum ada
INSERT INTO subjects_config (class_id, subject_id, subject_name, menu_group, display_order, icon)
SELECT 2, 'flashcards.html', 'Flashcard', 'main', 99, 'fa-clone'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects_config WHERE subject_id = 'flashcards.html' AND class_id = 2
);

INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Jumat, 19 June 2026, 10.30',
    'v4.1',
    '["Halaman Flashcard Belajar (flashcards.html) selesai dibuat untuk bantu siswa ngafalin materi"]'::jsonb,
    NOW()
);

-- ============================================================
-- MIGRASI: Tambah kolom device_info di visitors
-- ============================================================
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS user_agent TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS device_type TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS platform TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS screen_resolution TEXT DEFAULT '';
ALTER TABLE visitors ADD COLUMN IF NOT EXISTS browser_language TEXT DEFAULT '';


-- ============================================================
-- UPDATE LOG & MENU SEED (v4.2)
-- ============================================================

-- Tambahkan menu Class Profile v2 ke kelas 2 (master/system) jika belum ada
INSERT INTO subjects_config (class_id, subject_id, subject_name, menu_group, display_order, icon)
SELECT 2, 'class-profile-v2.html', 'Profil Kelas v2', 'main', 98, 'fa-users'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects_config WHERE subject_id = 'class-profile-v2.html' AND class_id = 2
);

INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Sabtu, 20 June 2026, 17.30',
    'v4.2',
    '["Halaman Profil Kelas v2 (class-profile-v2.html) selesai dibuat untuk mockup visual bento grid"]'::jsonb,
    NOW()
);


-- ============================================================
-- UPDATE LOG & MENU SEED (v4.3) — Class Profil (dynamic, student-editable)
-- ============================================================

-- Tambah kolom profile ke table users (single source of truth, ga perlu join students)
ALTER TABLE users ADD COLUMN IF NOT EXISTS quote text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS wa text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS ig text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS card_color text;

-- Tambah menu "Profil Kelas" ke kelas 2 (master/system) biar muncul di sidebar semua kelas
INSERT INTO subjects_config (class_id, subject_id, subject_name, menu_group, display_order, icon)
SELECT 2, 'class-profil', 'Profil Kelas', 'main', 97, 'fa-id-card'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects_config WHERE subject_id = 'class-profil' AND class_id = 2
);

INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Sabtu, 21 June 2026, 12.00',
    'v4.3',
    '["Halaman Profil Kelas (class-profil.html) selesai dibuat — dynamic dari table users, siswa bisa edit quote/deskripsi/foto profil sendiri"]'::jsonb,
    NOW()
);

-- ============================================================
-- MIGRASI: Tambah kolom is_pinned di subject_announcements
-- ============================================================
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;

-- ============================================================
-- MIGRASI: Tambah kolom is_lesson di subject_announcements
-- is_lesson = true untuk mapel (indo, mtk, dll), false untuk
-- pengumuman & kisi-kisi
-- ============================================================
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS is_lesson BOOLEAN DEFAULT false;

-- ============================================================
-- MIGRASI: Tambah kolom academic_year ke classes & subject_announcements
-- Untuk pisahin data antar tahun ajaran (kelas naik tingkat)
-- ============================================================
ALTER TABLE classes ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2025/2026';
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS academic_year TEXT DEFAULT '2025/2026';



-- ============================================================
-- MIGRASI: Tambah kolom foto di tabel sekbid (BPH & seksi bidang)
-- Foto orang-orang OSIS, path di bucket osis-foto/sekbid/
-- ============================================================
ALTER TABLE sekbid ADD COLUMN IF NOT EXISTS foto TEXT DEFAULT NULL;

-- ============================================================
-- MIGRASI: Materi Susulan (a/susulan.html)
-- Kolom susulan_day = hari penempatan materi (Senin..Jumat)
-- ============================================================
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS susulan_day TEXT DEFAULT NULL;

-- ============================================================
-- MIGRASI: Materi Susulan — kolom mata pelajaran
-- susulan_subject = nama pelajaran (diambil dari jadwal utama
-- daily card), dipakai buat filter & urutan card ngikut jadwal
-- ============================================================
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS susulan_subject TEXT DEFAULT NULL;

-- Seed menu "Materi Susulan" untuk kelas 2 (master/system)
INSERT INTO subjects_config (class_id, subject_id, subject_name, menu_group, display_order, icon)
SELECT 2, 'susulan', 'Materi Susulan', 'main', 96, 'fa-book-open-reader'
WHERE NOT EXISTS (
    SELECT 1 FROM subjects_config WHERE subject_id = 'susulan' AND class_id = 2
);

-- ============================================================
-- MIGRASI: Materi Susulan — tanggal fleksibel (ganti Senin-Jumat fixed)
-- Kolom susulan_date = tanggal penempatan materi (YYYY-MM-DD)
-- Tabel susulan_dates = daftar tanggal per kelas (biar bisa nambah Senin 1 Aug, 8 Aug, dst)
-- ============================================================
ALTER TABLE subject_announcements ADD COLUMN IF NOT EXISTS susulan_date DATE DEFAULT NULL;

CREATE TABLE IF NOT EXISTS susulan_dates (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id    BIGINT NOT NULL,
    date        DATE NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (class_id, date)
);
ALTER TABLE susulan_dates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_read" ON susulan_dates;
DROP POLICY IF EXISTS "public_insert" ON susulan_dates;
DROP POLICY IF EXISTS "public_update" ON susulan_dates;
DROP POLICY IF EXISTS "public_delete" ON susulan_dates;
CREATE POLICY "public_read"   ON susulan_dates FOR SELECT USING (true);
CREATE POLICY "public_insert" ON susulan_dates FOR INSERT WITH CHECK (true);
CREATE POLICY "public_update" ON susulan_dates FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "public_delete" ON susulan_dates FOR DELETE USING (true);
