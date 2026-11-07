-- ============================================================
-- 013 — KUNJUNGAN (visitor tracking)
-- Tiap device pelanggan punya ID unik (localStorage browser).
-- Tiap buka halaman, frontend manggil catat_kunjungan() → upsert
-- 1 baris: device_id, halaman terakhir, perangkat, jumlah kunjungan.
-- Ngeliat daftarnya lewat halaman dapur (wajib PIN).
-- Tabelnya gak bisa dibaca/ditulis langsung (RLS tanpa policy) —
-- semua lewat function security definer.
-- ============================================================

create table if not exists terasmbun.kunjungan (
  device_id         text primary key,
  halaman_terakhir  text        default '',
  perangkat         text        default '',
  jumlah            integer     not null default 1,
  kunjungan_pertama timestamptz not null default now(),
  kunjungan_terakhir timestamptz not null default now()
);

-- RLS ketat: gak ada policy sama sekali → anon gak bisa SELECT/INSERT
-- langsung; nulis + baca cuma lewat function di bawah.
alter table terasmbun.kunjungan enable row level security;

-- catat kunjungan (dipanggil frontend tiap buka halaman) — upsert:
-- device baru = baris baru; device lama = jumlah + 1 & update last seen.
create or replace function terasmbun.catat_kunjungan(
  p_device text, p_halaman text default '', p_perangkat text default ''
)
returns void
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_device text := left(trim(coalesce(p_device, '')), 64);
begin
  if v_device = '' then return; end if;

  insert into terasmbun.kunjungan (device_id, halaman_terakhir, perangkat)
  values (v_device,
          left(coalesce(p_halaman, ''), 200),
          left(coalesce(p_perangkat, ''), 300))
  on conflict (device_id) do update
    set halaman_terakhir  = excluded.halaman_terakhir,
        perangkat         = excluded.perangkat,
        jumlah            = terasmbun.kunjungan.jumlah + 1,
        kunjungan_terakhir = now();
end $$;

grant execute on function terasmbun.catat_kunjungan(text, text, text)
  to anon, authenticated;

-- daftar kunjungan buat dapur (wajib PIN; balikin [] kalo PIN salah)
create or replace function terasmbun.daftar_kunjungan(p_pin text)
returns jsonb
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_hasil jsonb := '[]'::jsonb;
begin
  if not terasmbun.cek_pin(p_pin) then return v_hasil; end if;

  select coalesce(jsonb_agg(x order by x->>'kunjungan_terakhir' desc), '[]'::jsonb)
  into v_hasil
  from (
    select jsonb_build_object(
      'device_id',          k.device_id,
      'halaman_terakhir',   k.halaman_terakhir,
      'perangkat',          k.perangkat,
      'jumlah',             k.jumlah,
      'kunjungan_pertama',  k.kunjungan_pertama,
      'kunjungan_terakhir', k.kunjungan_terakhir
    ) as x
    from terasmbun.kunjungan k
    order by k.kunjungan_terakhir desc
    limit 500
  ) s;

  return v_hasil;
end $$;

grant execute on function terasmbun.daftar_kunjungan(text)
  to anon, authenticated;

notify pgrst, 'reload schema';
