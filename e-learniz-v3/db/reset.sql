-- ============================================================
-- E-Learniz v3 — RESET TOTAL (DESTRUKTIF!)
-- ============================================================
-- Menghapus schema v3 beserta SELURUH data di dalamnya:
-- kelas, users, subjects, cards, task_progress, visitors, jadwal.
--
-- Jangan jalankan file ini kalau tidak berniat menghapus data.
-- Setelah reset, jalankan:
--   1) db/schema.sql
--   2) db/seed.sql (kalau mau migrasi data lama)
-- ============================================================

drop schema if exists v3 cascade;

-- Schema akan dibuat ulang oleh db/schema.sql.
