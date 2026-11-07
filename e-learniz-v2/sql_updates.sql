-- LAST UPDATE: Jumat, 29 May 2026, 14.00
-- VERSION: v4.0

-- 1. Unify Exam Score Pages
-- Update sidebar links to point to the new dynamic page
UPDATE subjects_config 
SET subject_id = 'test-scores?id=psts' 
WHERE subject_id = 'nilai-psts2526';

UPDATE subjects_config 
SET subject_id = 'test-scores?id=psasi' 
WHERE subject_id = 'nilai-psasi2526';

-- 2. Log Update (v4.0)
INSERT INTO app_updates (title, version, items, created_at)
VALUES (
    'Jumat, 29 May 2026, 14.00',
    'v4.0',
    '[
        "System: Penyatuan halaman nilai ujian (PSTS & PSASI) menjadi satu halaman dinamis (test-scores).",
        "System: Memungkinkan penambahan jenis nilai ujian baru hanya lewat konfigurasi tanpa bikin file HTML baru.",
        "UI: Perb   aikan minor pada tampilan leaderboard dan tabel nilai kelas."
    ]'::jsonb,
    NOW()
);
