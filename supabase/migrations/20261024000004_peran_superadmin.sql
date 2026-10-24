-- PERISA AZHARIYAH — Dua peran staff saja: superadmin & pengajar (24 Okt 2026)
--
-- KEPUTUSAN PEMILIK. Yayasan hanya punya dua lapis staff:
--   - Super Admin: Umi Elly dan Prima (2 orang).
--   - Guru/Pengajar: 3 orang, didaftarkan Super Admin dari Panel.
-- Wali diterbitkan Super Admin sesuai kebutuhan (sudah ada: daftarkan-wali-santri).
--
-- Peran ketiga, 'pengurus', berhak hampir sama dengan superadmin di seluruh
-- RLS (auth_is_admin) dan Edge Function (periksaStaffAktif). Menyimpannya
-- berarti ada peran setengah-admin yang tidak dipakai siapa pun tapi tetap
-- bisa dibuat lewat skrip — dan setiap kebijakan baru harus mengingat dua
-- nama untuk satu wewenang. Jadi dileburkan, bukan disembunyikan.
--
-- URUTAN DI BAWAH PENTING:
--   1. Akun 'pengurus' yang ada dinaikkan jadi 'superadmin' LEBIH DULU,
--      supaya check constraint baru tidak gagal pada baris lama.
--   2. Baru constraint-nya diganti.
--   3. auth_is_admin() disederhanakan ke satu nama peran.
--
-- JWT yang terbit SEBELUM migrasi masih membawa klaim staff_peran='pengurus'.
-- Itu tidak membuka atau menutup apa pun: auth_is_admin() membaca peran
-- dari TABEL staff, bukan dari klaim JWT (audit 5 Sep, migrasi
-- 20260905000002). Klaimnya ikut benar begitu akun itu login ulang.
--
-- Kode frontend & Edge Function sengaja masih MENERIMA 'pengurus' sebagai
-- admin: migrasi di proyek ini dijalankan manual, sedangkan frontend terbit
-- otomatis. Sebelum migrasi ini dijalankan, akun pengurus tidak boleh
-- tiba-tiba kehilangan akses.

begin;

-- 1. Naikkan akun pengurus — dicatat ke audit_log satu per satu, karena
--    tabel staff tidak punya trigger audit.
insert into audit_log (actor_type, actor_id, aksi, target_type, target_id, detail)
select 'system', null, 'lebur_peran_pengurus', 'staff', id,
       jsonb_build_object('dari', 'pengurus', 'ke', 'superadmin', 'nama', nama)
from staff
where peran = 'pengurus';

update staff set peran = 'superadmin' where peran = 'pengurus';

-- 2. Hanya dua peran yang sah.
alter table staff drop constraint if exists staff_peran_check;
alter table staff add constraint staff_peran_check check (peran in ('pengajar', 'superadmin'));

comment on table staff is
  'Super Admin (Umi Elly, Prima) dan Pengajar. Akses diatur lewat RLS berdasarkan kolom peran. Peran pengurus dilebur ke superadmin 24 Okt 2026.';

-- 3. Satu nama peran untuk wewenang admin. Tetap security definer dan tetap
--    membaca tabel staff (bukan JWT) — persis seperti versi 20260905000002.
create or replace function auth_is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select (auth.jwt() ->> 'akun_jenis') = 'staff'
    and exists (
      select 1 from staff
      where id = auth.uid()
        and aktif = true
        and peran = 'superadmin'
    );
$$;

comment on function auth_is_admin() is
  'Super Admin yang masih aktif, dibaca dari tabel staff (bukan klaim JWT) — penurunan peran & penonaktifan langsung berlaku.';

commit;
