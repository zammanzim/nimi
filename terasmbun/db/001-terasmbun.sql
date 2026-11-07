-- =========================================================================
-- MIGRASI 001 — TERAS MBUN (skema terasmbun di project Supabase e-learniz-v3)
-- Schema terpisah biar gak campur tabel e-learniz-v3.
-- Jalankan via SQL Editor Supabase / MCP. Idempotent sebisa mungkin.
-- =========================================================================

create schema if not exists terasmbun;

-- ── Expose schema ke PostgREST (supabase-js baru bisa akses) ──────────────
alter role authenticator set pgrst.db_schemas = 'public,terasmbun';
notify pgrst, 'reload config';

-- pgcrypto buat hash PIN (sha256)
create extension if not exists pgcrypto;

-- ── Tabel ────────────────────────────────────────────────────────────────
create table if not exists terasmbun.menu (
  id        bigint generated always as identity primary key,
  nama      text not null,
  harga     integer not null check (harga >= 0),
  kategori  text not null default 'lain',
  tersedia  boolean not null default true,
  urutan    integer not null default 0
);

create table if not exists terasmbun.pesanan (
  id         uuid primary key default gen_random_uuid(),
  kode       text unique not null,
  nama       text not null,
  wa         text,
  items      jsonb not null,
  total      integer not null,
  catatan    text,
  status     text not null default 'menunggu' check (status in ('menunggu','dibuat','siap')),
  created_at timestamptz not null default now()
);

create table if not exists terasmbun.setting (
  key   text primary key,
  value text not null
);

create sequence if not exists terasmbun.kode_seq;

-- ── RLS ──────────────────────────────────────────────────────────────────
alter table terasmbun.menu    enable row level security;
alter table terasmbun.pesanan enable row level security;
alter table terasmbun.setting enable row level security;

-- Menu: anon cuma boleh baca yang tersedia (update lewat SQL dashboard)
drop policy if exists menu_baca on terasmbun.menu;
create policy menu_baca on terasmbun.menu
  for select to anon, authenticated using (tersedia);

-- Pesanan: anon boleh BACA (halaman dapur + realtime tanpa login).
-- Insert tidak via RLS langsung, tapi lewat RPC buat_pesanan (validasi harga server-side).
-- Ubah status lewat RPC ubah_status (dicek PIN). Risiko: siapa pun tau URL bisa lihat daftar — wajar skala warung.
drop policy if exists pesanan_baca on terasmbun.pesanan;
create policy pesanan_baca on terasmbun.pesanan
  for select to anon, authenticated using (true);

-- Setting (isi PIN hash dll): tertutup rapat, cuma RPC security definer yang baca
revoke all on terasmbun.setting from anon, authenticated;

grant usage on schema terasmbun to anon, authenticated;
grant select on terasmbun.menu, terasmbun.pesanan to anon, authenticated;

-- ── Realtime ─────────────────────────────────────────────────────────────
alter table terasmbun.pesanan replica identity full;
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'terasmbun' and tablename = 'pesanan'
  ) then
    alter publication supabase_realtime add table terasmbun.pesanan;
  end if;
end $$;

-- ── Fungsi ───────────────────────────────────────────────────────────────

-- Cek PIN dapur (dibandingkan hash sha256, PIN asli gak pernah disimpan plaintext)
create or replace function terasmbun.cek_pin(p_pin text)
returns boolean
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare v_hash text;
begin
  select value into v_hash from terasmbun.setting where key = 'pin_dapur';
  if v_hash is null then return false; end if;
  return v_hash = encode(digest(coalesce(p_pin, ''), 'sha256'), 'hex');
end $$;

-- Pesenan baru. Total DIHITUNG ULANG server-side dari tabel menu,
-- jadi harga gak bisa dimanipulasi dari browser.
-- p_items: [{"id": 1, "qty": 2}, ...]
create or replace function terasmbun.buat_pesanan(
  p_nama text, p_wa text, p_catatan text, p_items jsonb
)
returns jsonb
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_total integer := 0;
  v_item  jsonb;
  v_harga integer;
  v_qty   integer;
  v_kode  text;
  v_id    uuid;
begin
  p_nama := nullif(trim(coalesce(p_nama, '')), '');
  if p_nama is null then raise exception 'nama_kosong'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'keranjang_kosong';
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    select harga into v_harga from terasmbun.menu
      where id = (v_item->>'id')::bigint and tersedia;
    if v_harga is null then raise exception 'menu_tidak_tersedia'; end if;
    v_qty := least(50, greatest(1, (v_item->>'qty')::int));
    v_total := v_total + v_harga * v_qty;
  end loop;

  v_kode := lpad(nextval('terasmbun.kode_seq')::text, 3, '0');
  insert into terasmbun.pesanan (kode, nama, wa, items, catatan, total)
  values (v_kode, p_nama, nullif(trim(coalesce(p_wa, '')), ''), p_items,
          nullif(trim(coalesce(p_catatan, '')), ''), v_total)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'kode', v_kode, 'total', v_total);
end $$;

-- Ubah status pesanan (dipanggil halaman dapur, wajib PIN bener)
create or replace function terasmbun.ubah_status(p_id uuid, p_status text, p_pin text)
returns boolean
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
begin
  if not terasmbun.cek_pin(p_pin) then return false; end if;
  if p_status not in ('menunggu', 'dibuat', 'siap') then return false; end if;
  update terasmbun.pesanan set status = p_status where id = p_id;
  return found;
end $$;

-- Info warung buat frontend (WA penjual buat tombol share). PIN gak dibocorkan di sini.
create or replace function terasmbun.info_warung()
returns jsonb
language sql security definer
set search_path = terasmbun, extensions, public
as $$
  select jsonb_build_object('wa_penjual', coalesce(
    (select value from terasmbun.setting where key = 'wa_penjual'), ''));
$$;

grant execute on function terasmbun.cek_pin(text) to anon, authenticated;
grant execute on function terasmbun.info_warung() to anon, authenticated;
grant execute on function terasmbun.buat_pesanan(text, text, text, jsonb) to anon, authenticated;
grant execute on function terasmbun.ubah_status(uuid, text, text) to anon, authenticated;

-- ── Seed ─────────────────────────────────────────────────────────────────
-- PIN default DAPUR: 1234 (hash sha256). GANTI setelah live:
--   update terasmbun.setting set value = encode(digest('PIN_BARU','sha256'),'hex') where key = 'pin_dapur';
insert into terasmbun.setting (key, value) values
  ('pin_dapur',  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4'),
  ('wa_penjual', '6200000000000')
on conflict (key) do nothing;

-- Menu dummy — ganti sendiri lewat SQL atau Supabase dashboard
insert into terasmbun.menu (nama, harga, kategori, urutan) values
  ('Nasi Ayam Penyet',   15000, 'nasi',    1),
  ('Nasi Ayam Geprek',   14000, 'nasi',    2),
  ('Ayam Bakar',         18000, 'nasi',    3),
  ('Nasi Goreng',        13000, 'nasi',    4),
  ('Mie Goreng',         12000, 'lauk',    5),
  ('Es Teh Manis',        3000, 'minuman', 6),
  ('Es Jeruk',            4000, 'minuman', 7),
  ('Teh Tawar Hangat',    2000, 'minuman', 8)
on conflict do nothing;
