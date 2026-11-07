-- ============================================================
-- 014 - HAPUS PESANAN (PIN-gated)
-- Dipanggil halaman dapur untuk menghapus pesanan (dibatalkan / spam)
-- ============================================================

create or replace function terasmbun.hapus_pesanan(p_id uuid, p_pin text)
returns boolean
language plpgsql security definer
set search_path = terasmbun, extensions, public
as $$
begin
  if not terasmbun.cek_pin(p_pin) then return false; end if;
  delete from terasmbun.pesanan where id = p_id;
  return found;
end $$;

grant execute on function terasmbun.hapus_pesanan(uuid, text) to anon, authenticated;
