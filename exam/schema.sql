-- ============================================================
-- EXAM standalone — schema DB dari 0 (idempotent, aman di-run ulang)
-- Cara pakai: copy-paste ke Supabase dashboard → SQL Editor → Run.
-- Urutan: tabel dulu, baru seed. Migrasi data lama ada di bawah
-- (opsional — skip kalo mulai dari kosong).
-- Media: R2 WAJIB. exam_media.path = path relatif (kisi/xxx.jpg).
-- ============================================================

-- ---------- 1. TABEL ----------
CREATE TABLE IF NOT EXISTS exam_classes (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    slug            TEXT NOT NULL UNIQUE,   -- xrpl1, xrpl2, ...
    name            TEXT NOT NULL,          -- XI - RPL 1, ...
    is_active       BOOLEAN DEFAULT true,
    display_order   INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS exam_config (
    class_id    BIGINT PRIMARY KEY REFERENCES exam_classes(id) ON DELETE CASCADE,
    exam_days   JSONB DEFAULT '["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]'::jsonb,
    note        TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS exam_schedules (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id    BIGINT NOT NULL REFERENCES exam_classes(id) ON DELETE CASCADE,
    day_name    TEXT NOT NULL,              -- Senin..Minggu
    items       JSONB DEFAULT '[]'::jsonb,  -- [{jam, mapel}, ...]
    UNIQUE (class_id, day_name)
);

CREATE TABLE IF NOT EXISTS exam_kisi (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    class_id        BIGINT NOT NULL REFERENCES exam_classes(id) ON DELETE CASCADE,
    day_name        TEXT,                   -- eksplisit, boleh NULL (Umum)
    subject         TEXT NOT NULL,          -- nama mapel tampil
    content         TEXT DEFAULT '',        -- HTML sederhana
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_media (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    kisi_id         BIGINT NOT NULL REFERENCES exam_kisi(id) ON DELETE CASCADE,
    path            TEXT NOT NULL,          -- RELATIF R2 (kisi/...) / URL absolut lama (transisi)
    label           TEXT DEFAULT '',
    kind            TEXT DEFAULT 'auto',
    display_order   INTEGER DEFAULT 0,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_questions (
    id              BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    subject         TEXT NOT NULL,          -- slug global (mtk, bing, ...)
    question        TEXT NOT NULL,
    options         JSONB DEFAULT '[]'::jsonb,
    answer          INTEGER DEFAULT 0,      -- index jawaban benar
    explanation     TEXT DEFAULT '',
    display_order   INTEGER DEFAULT 0,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS exam_subjects (
    slug    TEXT PRIMARY KEY,               -- sama kayak exam_questions.subject
    name    TEXT NOT NULL,                  -- nama tampil (Matematika, ...)
    icon    TEXT DEFAULT 'fa-book'          -- fa-... Font Awesome
);

CREATE TABLE IF NOT EXISTS exam_settings (
    key     TEXT PRIMARY KEY,               -- admin_pin
    value   TEXT DEFAULT ''
);

-- ---------- 2. RLS (public, PIN admin di level app) ----------
ALTER TABLE exam_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_kisi ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE exam_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_all" ON exam_classes;
DROP POLICY IF EXISTS "public_all" ON exam_config;
DROP POLICY IF EXISTS "public_all" ON exam_schedules;
DROP POLICY IF EXISTS "public_all" ON exam_kisi;
DROP POLICY IF EXISTS "public_all" ON exam_media;
DROP POLICY IF EXISTS "public_all" ON exam_questions;
DROP POLICY IF EXISTS "public_all" ON exam_subjects;
DROP POLICY IF EXISTS "public_read" ON exam_settings;

CREATE POLICY "public_all" ON exam_classes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exam_config FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exam_schedules FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exam_kisi FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exam_media FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exam_questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_all" ON exam_subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "public_read" ON exam_settings FOR SELECT USING (true);

-- ---------- 3. SEED (kelas + PIN, ganti PIN abis run) ----------
INSERT INTO exam_classes (slug, name, display_order) VALUES
    ('xrpl1', 'XI - RPL 1', 1),
    ('xrpl2', 'XI - RPL 2', 2),
    ('xrpl3', 'XI - RPL 3', 3),
    ('xrpl4', 'XI - RPL 4', 4)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO exam_config (class_id, exam_days)
SELECT id, '["Senin", "Selasa", "Rabu", "Kamis", "Jumat"]'::jsonb FROM exam_classes
ON CONFLICT (class_id) DO NOTHING;

-- GANTI '1234' DENGAN PIN ASLI:
INSERT INTO exam_settings (key, value) VALUES ('admin_pin', '1234')
ON CONFLICT (key) DO NOTHING;

-- ---------- 4. KLAIM AKUN (index step 3: pilih akun, kunci permanen) ----------
-- Satu user_id cuma bisa diklaim sekali → akun gabisa dimasukin orang lain.
CREATE TABLE IF NOT EXISTS exam_claims (
    user_id     TEXT PRIMARY KEY,   -- users.id (string)
    class_id    TEXT NOT NULL DEFAULT '',
    claimed_at  TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE exam_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_all" ON exam_claims;
CREATE POLICY "public_all" ON exam_claims FOR ALL USING (true) WITH CHECK (true);

-- ---------- 4. CEK (harusnya 8 baris, semua c > 0 kecuali schedules) ----------
-- SELECT 'classes' t, COUNT(*) c FROM exam_classes
-- UNION ALL SELECT 'config', COUNT(*) FROM exam_config
-- UNION ALL SELECT 'schedules', COUNT(*) FROM exam_schedules
-- UNION ALL SELECT 'kisi', COUNT(*) FROM exam_kisi
-- UNION ALL SELECT 'media', COUNT(*) FROM exam_media
-- UNION ALL SELECT 'questions', COUNT(*) FROM exam_questions
-- UNION ALL SELECT 'subjects', COUNT(*) FROM exam_subjects
-- UNION ALL SELECT 'settings', COUNT(*) FROM exam_settings;
