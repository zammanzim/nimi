-- ============================================================
-- 007 — MEDIA FOTO pindah ke Supabase Storage (bucket
-- `terasmbun-media`, public). Gak pake R2 — foto dikit & ringan.
-- + RPC ubah_menu_gambar (wajib PIN) buat nyimpen URL foto ke
--   kolom menu.gambar — server nge-VALIDATE URL-nya masuk bucket
--   ini, biar kolom gak bisa diisi URL sembarangan.
-- ============================================================

-- ── bucket public (baca tanpa login; upload anon dibatesin ke
--    bucket ini doang lewat policy di bawah) ──
insert into storage.buckets (id, name, public)
values ('terasmbun-media', 'terasmbun-media', true)
on conflict (id) do nothing;

-- ── policy storage.objects (skema storage bukan milik terasmbun,
--    tapi policy-nya spesifik ke bucket kita doang) ──
drop policy if exists media_baca on storage.objects;
create policy media_baca on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'terasmbun-media');

drop policy if exists media_upload on storage.objects;
create policy media_upload on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'terasmbun-media');

drop policy if exists media_ubah on storage.objects;
create policy media_ubah on storage.objects
  for update to anon, authenticated
  using (bucket_id = 'terasmbun-media')
  with check (bucket_id = 'terasmbun-media');

drop policy if exists media_hapus on storage.objects;
create policy media_hapus on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'terasmbun-media');

-- ── set URL foto menu (PIN-gated, ala ubah_status) ──
-- p_gambar: URL publik bucket ini, atau '' / null buat hapus foto.
create or replace function terasmbun.ubah_menu_gambar(
  p_id bigint, p_gambar text, p_pin text
)
returns boolean
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_url text := nullif(trim(coalesce(p_gambar, '')), '');
begin
  if not terasmbun.cek_pin(p_pin) then return false; end if;

  -- URL wajib dari bucket kita (biar gak nyimpan link sembarangan)
  if v_url is not null and v_url not like
     'https://%.supabase.co/storage/v1/object/public/terasmbun-media/%'
  then
    raise exception 'url_gambar_salah';
  end if;

  update terasmbun.menu set gambar = v_url where id = p_id;
  return true;
end $$;

grant execute on function terasmbun.ubah_menu_gambar(bigint, text, text)
  to anon, authenticated;

notify pgrst, 'reload schema';
