-- ===========================================================================
-- PERISA AZHARIYAH — Laporan kelas dihitung di basis data
-- 24 Oktober 2026 (audit, temuan #4)
-- ===========================================================================
--
-- TEMUAN. Laporan kelas di Panel Pengurus mengambil SELURUH baris absensi
-- (dan xp_log) satu kelas lalu menjumlahkannya di peramban. PostgREST di
-- Supabase memotong setiap respons di max_rows (bawaan 1000) TANPA galat:
-- 25 santri × 40 pertemuan sudah 1000 baris absensi — kira-kira satu
-- semester. Sesudah itu persen hadir setiap anak salah, dan tidak ada apa pun
-- di layar yang menandakannya. xp_log jauh lebih cepat menembus batas itu
-- begitu kelas online dibuka (satu baris per jawaban benar).
--
-- PERBAIKAN. Jumlahnya dihitung di sini; yang dikirim ke peramban hanya satu
-- baris per santri.
--
-- SECURITY INVOKER, disengaja. Fungsi ini berjalan dengan hak PEMANGGIL, jadi
-- kebijakan RLS absensi/pertemuan/xp_log/progres_santri berlaku persis seperti
-- query langsung sebelumnya — pengajar tetap hanya melihat kelas ampuannya,
-- guru mitra tetap nol, wali tetap nol. Tidak ada aturan wewenang baru yang
-- perlu dijaga di sini.

create or replace function laporan_kelas(p_kelas_id uuid)
returns table (
  santri_id          uuid,
  hadir              int,
  izin               int,
  sakit              int,
  alfa               int,
  total_xp           bigint,
  pelajaran_selesai  int
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    s.id,
    ab.hadir, ab.izin, ab.sakit, ab.alfa,
    xp.total,
    ps.selesai
  from santri s
  -- Hanya absensi dari pertemuan KELAS INI — sama dengan sebelumnya.
  cross join lateral (
    select
      count(*) filter (where a.status = 'hadir')::int as hadir,
      count(*) filter (where a.status = 'izin')::int  as izin,
      count(*) filter (where a.status = 'sakit')::int as sakit,
      count(*) filter (where a.status = 'alfa')::int  as alfa
    from absensi a
    join pertemuan p on p.id = a.pertemuan_id
    where a.santri_id = s.id and p.kelas_id = p_kelas_id
  ) ab
  cross join lateral (
    select coalesce(sum(x.jumlah), 0)::bigint as total from xp_log x where x.santri_id = s.id
  ) xp
  cross join lateral (
    select count(*)::int as selesai
    from progres_santri pr
    where pr.santri_id = s.id and pr.status = 'selesai'
  ) ps
  where s.kelas_id = p_kelas_id and s.status = 'aktif';
$$;

comment on function laporan_kelas(uuid) is
  'Kehadiran, XP, dan pelajaran selesai per santri aktif satu kelas — dijumlahkan di basis data supaya tidak terpotong max_rows. SECURITY INVOKER: RLS pemanggil berlaku. Lihat migrasi 20261024000003.';

revoke all on function laporan_kelas(uuid) from public;
revoke all on function laporan_kelas(uuid) from anon;
grant execute on function laporan_kelas(uuid) to authenticated;
