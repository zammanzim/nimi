-- ============================================================
-- 012 — ongkir COD: +Rp3.000.
-- INI BUKAN TARIF FINAL: penjual masih bisa ngubah (deket/jauh,
-- nego). Pelanggan dikasih keterangan lewat UI — "gak fix".
-- total tetep dihitung server-side (harga gak bisa dimanipulasi),
-- ongkir masuk kolom sendiri biar dapur + halaman pesenan-aku
-- bisa nampilin rinciannya (bukan cuma nempel di total).
-- ============================================================

alter table terasmbun.pesanan
  add column if not exists ongkir integer not null default 0;

create or replace function terasmbun.buat_pesanan(
  p_nama text, p_wa text, p_catatan text, p_items jsonb,
  p_level_pedas integer, p_ambil text, p_alamat text, p_bayar text,
  p_kapan text default 'sekarang',
  p_waktu_teks text default null
)
returns jsonb
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_total integer := 0;
  v_ongkir integer := 0;
  v_max_lvl integer := 0;
  v_item  jsonb;
  v_harga integer;
  v_qty   integer;
  v_nama  text;
  v_kat   text;
  v_level integer;
  v_simpan jsonb := '[]'::jsonb;
  v_kode  text;
  v_id    uuid;
begin
  p_nama := nullif(trim(coalesce(p_nama, '')), '');
  if p_nama is null then raise exception 'nama_kosong'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'keranjang_kosong';
  end if;

  if coalesce(p_ambil, '') not in ('cod', 'ambil') then raise exception 'ambil_kosong'; end if;
  p_alamat := nullif(trim(coalesce(p_alamat, '')), '');
  if p_ambil = 'cod' and p_alamat is null then raise exception 'alamat_kosong'; end if;
  if coalesce(p_bayar, '') not in ('qris', 'tunai') then raise exception 'bayar_kosong'; end if;

  -- jadwal kirim: teks bebas buat "custom", wajib keisi
  p_kapan := coalesce(nullif(trim(coalesce(p_kapan, '')), ''), 'sekarang');
  if p_kapan not in ('sekarang', 'besok', 'custom') then raise exception 'kapan_salah'; end if;
  if p_kapan = 'custom' then
    p_waktu_teks := nullif(trim(coalesce(p_waktu_teks, '')), '');
    if p_waktu_teks is null then raise exception 'waktu_kirim_kosong'; end if;
    if length(p_waktu_teks) > 80 then p_waktu_teks := left(p_waktu_teks, 80); end if;
  else
    p_waktu_teks := null; -- sekarang/besok gak bawa keterangan jam
  end if;

  -- total dihitung ulang dari tabel menu (harga gak bisa dimanipulasi);
  -- item yang disimpan juga dibikin ulang di sini — nama+harga snapshot
  -- dari DB, level per item di-clamp 0..5 (minuman dipaksa 0)
  for v_item in select * from jsonb_array_elements(p_items) loop
    select nama, harga, kategori into v_nama, v_harga, v_kat from terasmbun.menu
      where id = (v_item->>'id')::bigint and tersedia;
    if v_harga is null then raise exception 'menu_tidak_tersedia'; end if;
    v_qty := least(50, greatest(1, (v_item->>'qty')::int));
    v_level := least(5, greatest(0, coalesce((v_item->>'level')::int, 0)));
    if lower(coalesce(v_kat, '')) = 'minuman' then v_level := 0; end if;
    v_max_lvl := greatest(v_max_lvl, v_level);
    v_total := v_total + v_harga * v_qty;
    v_simpan := v_simpan || jsonb_build_array(jsonb_build_object(
      'id', v_item->>'id', 'nama', v_nama, 'harga', v_harga,
      'qty', v_qty, 'level', v_level));
  end loop;

  -- ongkir COD: biaya awal Rp3.000, ambil di toko = 0.
  -- Angka ini bisa penjual ganti nanti (kalo jauh lebih, deket kurang) —
  -- pelanggan udah dikasih keterangan "gak fix" di UI.
  v_ongkir := case when p_ambil = 'cod' then 3000 else 0 end;
  v_total := v_total + v_ongkir;

  v_kode := lpad(nextval('terasmbun.kode_seq')::text, 3, '0');
  insert into terasmbun.pesanan
    (kode, nama, wa, items, catatan, total, ongkir, level_pedas,
     metode_ambil, alamat, metode_bayar, kapan, waktu_teks)
  values
    (v_kode, p_nama, terasmbun._norm_wa(p_wa), v_simpan,
     nullif(trim(coalesce(p_catatan, '')), ''), v_total, v_ongkir,
     v_max_lvl,                 -- level tertinggi (p_level_pedas diabaikan)
     p_ambil, p_alamat, p_bayar, p_kapan, p_waktu_teks)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'kode', v_kode, 'total', v_total, 'ongkir', v_ongkir);
end $$;

revoke execute on function terasmbun.buat_pesanan(text, text, text, jsonb, integer, text, text, text, text, text) from public;
grant execute on function terasmbun.buat_pesanan(text, text, text, jsonb, integer, text, text, text, text, text) to anon, authenticated;

notify pgrst, 'reload schema';
