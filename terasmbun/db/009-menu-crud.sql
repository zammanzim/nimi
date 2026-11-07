-- ============================================================
-- 009 — CRUD MENU penuh dari halaman admin (PIN-gated).
-- simpan_menu: menu baru (p_id null) ATAU edit (p_id terisi)
-- hapus_menu: buang menu (fotonya dibuang client-side)
-- RLS menu tetep ketat: anon cuma SELECT — semua nulis lewat RPC ini.
-- ============================================================

create or replace function terasmbun.simpan_menu(
  p_id bigint, p_nama text, p_harga integer, p_kategori text,
  p_deskripsi text, p_urutan integer, p_tersedia boolean, p_pin text
)
returns jsonb
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
declare
  v_id     bigint;
  v_nama   text := nullif(trim(coalesce(p_nama, '')), '');
  v_kat    text;
  v_urut   integer;
begin
  if not terasmbun.cek_pin(p_pin) then return null; end if;

  if v_nama is null then raise exception 'nama_kosong'; end if;
  if p_harga is null or p_harga < 0 or p_harga > 10000000 then raise exception 'harga_salah'; end if;
  v_kat := nullif(trim(coalesce(p_kategori, '')), '');
  if v_kat is null then raise exception 'kategori_kosong'; end if;
  -- seragamin bentuk kategori: huruf kecil, spasi jadi strip bawah
  -- (biar "Makanan Berat" dan "makanan_berat" gak jadi 2 kategori beda)
  v_kat := lower(regexp_replace(v_kat, '\s+', '_', 'g'));

  if p_id is null or p_id = 0 then
    -- menu baru: urutan kosong = paling bawah (max + 1)
    v_urut := coalesce(nullif(p_urutan, 0),
                       (select coalesce(max(urutan), 0) + 1 from terasmbun.menu));
    insert into terasmbun.menu (nama, harga, kategori, urutan, deskripsi, tersedia)
    values (v_nama, p_harga, v_kat, v_urut,
            nullif(trim(coalesce(p_deskripsi, '')), ''), coalesce(p_tersedia, true))
    returning id into v_id;
  else
    v_urut := coalesce(p_urutan,
                       (select urutan from terasmbun.menu where id = p_id));
    update terasmbun.menu set
      nama = v_nama, harga = p_harga, kategori = v_kat, urutan = v_urut,
      deskripsi = nullif(trim(coalesce(p_deskripsi, '')), ''),
      tersedia = coalesce(p_tersedia, true)
    where id = p_id
    returning id into v_id;
    if v_id is null then raise exception 'menu_tidak_ada'; end if;
  end if;

  return jsonb_build_object('id', v_id);
end $$;

create or replace function terasmbun.hapus_menu(p_id bigint, p_pin text)
returns boolean
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
begin
  if not terasmbun.cek_pin(p_pin) then return false; end if;
  delete from terasmbun.menu where id = p_id;
  return found;
end $$;

-- Daftar menu buat HALAMAN ADMIN: balikin SEMUA menu termasuk yang
-- habis (tersedia = false). RLS menu_baca nyaring menu habis dari
-- pelanggan (emang desainnya) — tapi admin perlu liat semua biar bisa
-- ngebalikin status habis → tersedia. Data menu sendiri gak rahasia,
-- jadi aman dipanggil tanpa PIN.
create or replace function terasmbun.daftar_menu()
returns table (
  id bigint, nama text, harga integer, kategori text,
  urutan integer, gambar text, deskripsi text, tersedia boolean
)
language sql security definer
set search_path = terasmbun, extensions, public
as $$
  select id, nama, harga, kategori, urutan, gambar, deskripsi, tersedia
  from terasmbun.menu
  order by urutan asc, id asc;
$$;

grant execute on function terasmbun.simpan_menu(bigint, text, integer, text, text, integer, boolean, text)
  to anon, authenticated;
grant execute on function terasmbun.hapus_menu(bigint, text)
  to anon, authenticated;
grant execute on function terasmbun.daftar_menu()
  to anon, authenticated;

notify pgrst, 'reload schema';
