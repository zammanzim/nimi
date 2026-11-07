-- =========================================================================
-- MIGRASI 002 — foto per menu
-- Kolom gambar: path/URL foto menu (mis. "img/menu/ayam-penyet.jpg").
-- NULL = tampil placeholder (gradient + emoji kategori).
-- =========================================================================
alter table terasmbun.menu add column if not exists gambar text;

-- Contoh ngisi foto (taruh filenya di img/menu/ dulu):
-- update terasmbun.menu set gambar = 'img/menu/ayam-penyet.jpg' where id = 1;
