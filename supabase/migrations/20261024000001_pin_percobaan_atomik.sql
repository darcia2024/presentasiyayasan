-- ===========================================================================
-- PERISA AZHARIYAH — Penguncian PIN yang tidak bisa disalip permintaan paralel
-- 24 Oktober 2026 (audit, temuan #2)
-- ===========================================================================
--
-- TEMUAN. auth-login-pin membaca `percobaan`, menjalankan PBKDF2 (~100 ms),
-- lalu MENULIS `percobaan + 1` dari nilai yang dibacanya tadi. Ratusan
-- permintaan yang dikirim bersamaan semuanya membaca percobaan = 0, semuanya
-- diperiksa, dan semuanya menulis 1. Batas "lima kali salah lalu dikunci" —
-- satu-satunya yang menahan penebak PIN 6 digit lewat jaringan — hanya
-- berlaku untuk penyerang yang sopan mengirim satu per satu.
--
-- PERBAIKAN. Jatah percobaan DIAMBIL lebih dulu, dalam satu UPDATE atomik,
-- SEBELUM PIN diperiksa. UPDATE mengunci barisnya, jadi permintaan paralel
-- antre di sini dan masing-masing melihat hitungan yang sudah dinaikkan
-- pendahulunya. Percobaan ke-N langsung memasang kunci; kalau PIN-nya ternyata
-- benar, Edge Function menghapusnya lagi seperti biasa.
--
-- Aturannya sama dengan setelahGagal() yang lama (dihapus dari _shared/pin.ts):
-- hitungan tidak di-nol-kan saat kunci kedaluwarsa, jadi sesudah terkunci
-- sekali, setiap salah berikutnya langsung mengunci lagi — satu tebakan per
-- 15 menit sampai ada login yang berhasil.

create or replace function pin_ambil_percobaan(
  p_jenis        text,
  p_akun         uuid,
  p_maks         int,
  p_kunci_menit  int
)
returns table (boleh boolean, percobaan int, terkunci_sampai timestamptz)
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_jenis = 'wali' then
    return query
      with u as (
      update wali_kredensial k
         set percobaan = k.percobaan + 1,
             terkunci_sampai = case
               when k.percobaan + 1 >= p_maks then now() + make_interval(mins => p_kunci_menit)
               else k.terkunci_sampai
             end
       where k.wali_id = p_akun
         and (k.terkunci_sampai is null or k.terkunci_sampai <= now())
      returning k.percobaan, k.terkunci_sampai
      )
      select true, u.percobaan, u.terkunci_sampai from u;
    if not found then
      return query
        select false, k.percobaan, k.terkunci_sampai from wali_kredensial k where k.wali_id = p_akun;
    end if;

  elsif p_jenis = 'staff' then
    return query
      with u as (
      update staff_kredensial k
         set percobaan = k.percobaan + 1,
             terkunci_sampai = case
               when k.percobaan + 1 >= p_maks then now() + make_interval(mins => p_kunci_menit)
               else k.terkunci_sampai
             end
       where k.staff_id = p_akun
         and (k.terkunci_sampai is null or k.terkunci_sampai <= now())
      returning k.percobaan, k.terkunci_sampai
      )
      select true, u.percobaan, u.terkunci_sampai from u;
    if not found then
      return query
        select false, k.percobaan, k.terkunci_sampai from staff_kredensial k where k.staff_id = p_akun;
    end if;

  else
    raise exception 'jenis akun tidak dikenal: %', p_jenis;
  end if;
end;
$$;

comment on function pin_ambil_percobaan(text, uuid, int, int) is
  'Ambil satu jatah percobaan PIN secara atomik SEBELUM PIN diperiksa. boleh=false berarti akun sedang terkunci. Hanya service_role (auth-login-pin) — lihat migrasi 20261024000001.';

revoke all on function pin_ambil_percobaan(text, uuid, int, int) from public;
revoke all on function pin_ambil_percobaan(text, uuid, int, int) from anon;
revoke all on function pin_ambil_percobaan(text, uuid, int, int) from authenticated;
grant execute on function pin_ambil_percobaan(text, uuid, int, int) to service_role;
