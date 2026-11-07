-- =========================================================================
-- MIGRASI 004 — form pemesanan baru (pesen)
-- Kolom tambahan di pesanan: level pedas, cara terima (cod/ambil),
-- alamat (wajib kalo cod), cara bayar (qris/tunai).
-- RPC buat_pesanan ditulis ulang (signature lama DI-drop dulu biar
-- PostgREST gak bingung ada 2 fungsi sama nama).
-- =========================================================================

alter table terasmbun.pesanan add column if not exists level_pedas smallint not null default 0;
alter table terasmbun.pesanan add column if not exists metode_ambil text;   -- 'cod' | 'ambil'
alter table terasmbun.pesanan add column if not exists alamat text;          -- wajib kalo cod
alter table terasmbun.pesanan add column if not exists metode_bayar text;    -- 'qris' | 'tunai'

-- buang signature lama (4 arg), ganti yang 8 arg
drop function if exists terasmbun.buat_pesanan(text, text, text, jsonb);

create function terasmbun.buat_pesanan(
  p_nama text, p_wa text, p_catatan text, p_items jsonb,
  p_level_pedas integer, p_ambil text, p_alamat text, p_bayar text
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
  v_nama  text;
  v_simpan jsonb := '[]'::jsonb;
  v_kode  text;
  v_id    uuid;
begin
  p_nama := nullif(trim(coalesce(p_nama, '')), '');
  if p_nama is null then raise exception 'nama_kosong'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'keranjang_kosong';
  end if;

  -- validasi form baru (semua dicek di sini, gak percaya browser)
  if coalesce(p_ambil, '') not in ('cod', 'ambil') then raise exception 'ambil_kosong'; end if;
  p_alamat := nullif(trim(coalesce(p_alamat, '')), '');
  if p_ambil = 'cod' and p_alamat is null then raise exception 'alamat_kosong'; end if;
  if coalesce(p_bayar, '') not in ('qris', 'tunai') then raise exception 'bayar_kosong'; end if;

  -- total dihitung ulang dari tabel menu (harga gak bisa dimanipulasi);
  -- item yang disimpan juga dibikin ulang di sini — nama+harga snapshot
  -- dari DB (bukan dipercaya dari browser), biar halaman dapur gak "Menu" semua
  for v_item in select * from jsonb_array_elements(p_items) loop
    select nama, harga into v_nama, v_harga from terasmbun.menu
      where id = (v_item->>'id')::bigint and tersedia;
    if v_harga is null then raise exception 'menu_tidak_tersedia'; end if;
    v_qty := least(50, greatest(1, (v_item->>'qty')::int));
    v_total := v_total + v_harga * v_qty;
    v_simpan := v_simpan || jsonb_build_array(jsonb_build_object(
      'id', v_item->>'id', 'nama', v_nama, 'harga', v_harga, 'qty', v_qty));
  end loop;

  v_kode := lpad(nextval('terasmbun.kode_seq')::text, 3, '0');
  insert into terasmbun.pesanan
    (kode, nama, wa, items, catatan, total, level_pedas, metode_ambil, alamat, metode_bayar)
  values
    (v_kode, p_nama, nullif(trim(coalesce(p_wa, '')), ''), v_simpan,
     nullif(trim(coalesce(p_catatan, '')), ''), v_total,
     least(5, greatest(0, coalesce(p_level_pedas, 0))),
     p_ambil, p_alamat, p_bayar)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'kode', v_kode, 'total', v_total);
end $$;

revoke execute on function terasmbun.buat_pesanan(text, text, text, jsonb, integer, text, text, text) from public;
grant execute on function terasmbun.buat_pesanan(text, text, text, jsonb, integer, text, text, text) to anon, authenticated;

-- muat ulang schema cache PostgREST (signature fungsi berubah)
notify pgrst, 'reload schema';
