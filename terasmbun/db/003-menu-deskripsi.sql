-- =========================================================================
-- MIGRASI 003 — deskripsi menu (buat section showcase)
-- =========================================================================
alter table terasmbun.menu add column if not exists deskripsi text;

-- isi deskripsi (contoh buat menu dummy)
update terasmbun.menu set deskripsi = 'Ayam goreng digeprek, sambal matah, lalapan segar.' where nama = 'Nasi Ayam Penyet';
update terasmbun.menu set deskripsi = 'Ayam crispy digeprek sama sambal bawang, pedas nendang.' where nama = 'Nasi Ayam Geprek';
update terasmbun.menu set deskripsi = 'Ayam dibakar bumbu kecap manis, porsi mengenyangkan.' where nama = 'Ayam Bakar';
update terasmbun.menu set deskripsi = 'Nasi goreng spesial telur, cita rasa rumahan.' where nama = 'Nasi Goreng';
update terasmbun.menu set deskripsi = 'Mie goreng gurih dengan sayur dan telur.' where nama = 'Mie Goreng';
update terasmbun.menu set deskripsi = 'Es teh manis segar, pelengkap makan siang.' where nama = 'Es Teh Manis';
update terasmbun.menu set deskripsi = 'Es jeruk peras segar, asam manis pas di lidah.' where nama = 'Es Jeruk';
update terasmbun.menu set deskripsi = 'Teh tawar hangat, menemani kapan aja.' where nama = 'Teh Tawar Hangat';
