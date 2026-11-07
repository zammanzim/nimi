-- ============================================================
-- 008 — FOTO WARUNG (background + QRIS) disimpen di tabel setting,
-- diganti lewat halaman foto (PIN-gated), fotonya di bucket
-- terasmbun-media (lihat 007).
-- + info_warung sekarang ikut ngasih URL bg & qris ke frontend.
-- ============================================================

-- info_warung: wa_penjual + url foto bg + url foto qris
-- (setting key lain — pin_dapur — tetep gak dibocorkan)
create or replace function terasmbun.info_warung()
returns jsonb
language sql security definer
set search_path = terasmbun, extensions, public
as $$
  select jsonb_build_object(
    'wa_penjual', coalesce((select value from terasmbun.setting where key = 'wa_penjual'), ''),
    'bg',         coalesce((select value from terasmbun.setting where key = 'bg'), ''),
    'qris',       coalesce((select value from terasmbun.setting where key = 'qris'), ''));
$$;

-- ganti foto bg / qris (wajib PIN; URL divalidasi server — cuma boleh
-- dari bucket terasmbun-media; '' = hapus foto)
create or replace function terasmbun.ubah_media(
  p_key text, p_gambar text, p_pin text
)
returns boolean
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_url text := nullif(trim(coalesce(p_gambar, '')), '');
begin
  if coalesce(p_key, '') not in ('bg', 'qris') then raise exception 'media_key_salah'; end if;
  if not terasmbun.cek_pin(p_pin) then return false; end if;

  if v_url is not null and v_url not like
     'https://%.supabase.co/storage/v1/object/public/terasmbun-media/%'
  then
    raise exception 'url_gambar_salah';
  end if;

  insert into terasmbun.setting (key, value) values (p_key, coalesce(v_url, ''))
    on conflict (key) do update set value = excluded.value;
  return true;
end $$;

grant execute on function terasmbun.ubah_media(text, text, text)
  to anon, authenticated;

-- seed key media (kosong = belum ada foto → tampil default)
insert into terasmbun.setting (key, value) values
  ('bg',   ''),
  ('qris', '')
on conflict (key) do nothing;

notify pgrst, 'reload schema';
