-- ============================================================================
-- PERISA AZHARIYAH — Asisten Bahasa Arab dihapus (keputusan pemilik,
--                     11 September 2026)
--
-- Fitur ini dibangun di Fase 5 tapi tidak pernah dinyalakan: ANTHROPIC_API_KEY
-- tidak pernah diisi, jadi Edge Function tanya-asisten-ai selalu menjawab
-- 503. Pemilik memutuskan menghapusnya seluruhnya — tampilan, Edge Function,
-- dan tabel lognya — alih-alih membiarkannya menunggu tanpa kepastian.
--
-- YANG DIBUANG DI SINI
--   - tabel ai_pertanyaan_log beserta kebijakan RLS dan indeksnya (dibuat di
--     20260904000007, diubah di 20260910000002 dan 20260910000003).
--   - parameter p_hari_ai dari bersihkan_data_kedaluwarsa() dan kunci
--     ai_pertanyaan_log dari ringkasan_umur_data() (20260910000005).
--
-- KEDUA FUNGSI ITU HARUS DIGANTI SEBELUM TABELNYA DIBUANG. Isi fungsi
-- plpgsql/sql tidak tercatat sebagai dependensi tabel, jadi DROP TABLE tetap
-- lolos — lalu fungsinya baru gagal saat dipanggil, dan workflow retensi
-- mingguan mati tanpa ada yang tahu sebabnya.
--
-- Migrasi lama SENGAJA TIDAK dihapus dari repo: riwayat migrasi produksi
-- sudah mencatatnya sebagai terapan, dan project baru (pemulihan bencana)
-- harus bisa menjalankan semua berkas berurutan sampai ke keadaan ini.
--
-- YANG TIDAK BISA DILAKUKAN MIGRASI (lihat DEPLOY.md bagian 3):
--   npx supabase functions delete tanya-asisten-ai
--   npx supabase secrets unset AI_DAILY_LIMIT_PER_SANTRI
-- ============================================================================

-- ------------------------------------------------ RETENSI: tanpa tabel AI
-- Daftar parameternya berubah (p_hari_ai hilang), dan create or replace tidak
-- bisa mengubah daftar parameter — versi lama harus dibuang dulu.
--
-- Workflow retensi-data.yml versi baru hanya mengirim p_hari_audit,
-- p_hari_otp, dan p_hari_kuis. Karena p_hari_ai di versi lama punya nilai
-- baku, workflow baru itu tetap cocok dengan fungsi lama maupun yang ini —
-- urutan menerapkan migrasi vs mendorong workflow tidak saling mengunci.
drop function if exists bersihkan_data_kedaluwarsa(int, int, int, int);

create or replace function bersihkan_data_kedaluwarsa(
  p_hari_audit   int default 0,
  p_hari_otp     int default 0,
  p_hari_kuis    int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit  int := 0;
  v_otp    int := 0;
  v_kuis   int := 0;
begin
  -- Nol/negatif = tabel ini tidak disentuh. Sengaja: menyalakan retensi
  -- harus jadi tindakan yang disengaja per tabel, bukan efek samping dari
  -- memanggil fungsi ini.
  if p_hari_audit > 0 then
    delete from audit_log
    where created_at < now() - make_interval(days => p_hari_audit);
    get diagnostics v_audit = row_count;
  end if;

  if p_hari_otp > 0 then
    -- OTP tidak punya alasan disimpan sama sekali setelah kedaluwarsa;
    -- parameternya tetap ada supaya perilakunya seragam & bisa diaudit.
    delete from otp_codes
    where created_at < now() - make_interval(days => p_hari_otp);
    get diagnostics v_otp = row_count;
  end if;

  if p_hari_kuis > 0 then
    delete from kuis_soal
    where created_at < now() - make_interval(days => p_hari_kuis);
    get diagnostics v_kuis = row_count;
  end if;

  return jsonb_build_object(
    'audit_log', v_audit,
    'otp_codes', v_otp,
    'kuis_soal', v_kuis,
    'dijalankan_at', now()
  );
end;
$$;

comment on function bersihkan_data_kedaluwarsa(int, int, int) is
  'Pembersihan retensi. Masa simpan datang dari PEMANGGIL (repository variable di .github/workflows/retensi-data.yml), bukan ditanam di sini — berapa lama data disimpan adalah keputusan pemilik, bukan keputusan teknis. Nilai 0 = tabel itu tidak disentuh.';

revoke all on function bersihkan_data_kedaluwarsa(int, int, int) from public;
revoke all on function bersihkan_data_kedaluwarsa(int, int, int) from anon;
revoke all on function bersihkan_data_kedaluwarsa(int, int, int) from authenticated;
grant execute on function bersihkan_data_kedaluwarsa(int, int, int) to service_role;


-- ------------------------------------------------------ LAPORAN UMUR DATA
-- Tanda tangannya tidak berubah, jadi cukup diganti isinya. Hak akses dan
-- komentar dari 20260910000005 ikut terbawa.
create or replace function ringkasan_umur_data()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'audit_log', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from audit_log),
    'otp_codes', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from otp_codes),
    'kuis_soal', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from kuis_soal),
    'xp_log', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from xp_log)
  );
$$;


-- ----------------------------------------------------------------- TABEL
-- Kebijakan RLS (ai_log_select_wali, ai_log_select_staff) dan ketiga
-- indeksnya ikut terbuang bersama tabelnya. SENGAJA tanpa CASCADE: kalau
-- ternyata ada objek lain yang bergantung pada tabel ini, migrasi harus
-- GAGAL dan diperiksa — bukan diam-diam ikut membuang objek itu.
drop table if exists ai_pertanyaan_log;
