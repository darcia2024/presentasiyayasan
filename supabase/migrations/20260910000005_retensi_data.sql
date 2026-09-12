-- ============================================================================
-- PERISA AZHARIYAH — Mekanisme retensi data (audit 10 September 2026, D22)
--
-- TEMUAN. Kebijakan Privasi bagian 6 hanya bicara tentang "data santri"
-- (progres belajar). Empat kumpulan data lain tumbuh tanpa batas waktu dan
-- tanpa disebut sama sekali:
--
--   ai_pertanyaan_log   PERTANYAAN BEBAS yang diketik anak-anak, beserta
--                       jawabannya. Paling sensitif di antara semuanya:
--                       isinya bisa apa saja yang terlintas di kepala
--                       seorang anak, dan tersimpan selamanya.
--   audit_log           Jejak tindakan. Kolom `detail` ikut memuat nomor
--                       WhatsApp pada peristiwa login — padahal actor_id
--                       sudah menunjuk akunnya.
--   otp_codes           Sudah disapu oportunistik tiap permintaan OTP baru,
--                       tapi kalau tidak ada yang login berhari-hari,
--                       baris kedaluwarsanya menetap.
--   kuis_soal           Idem (disapu saat soal baru diterbitkan).
--
-- YANG DIPUTUSKAN DI SINI (teknis):
--   - Ada satu fungsi yang bisa membersihkan keempatnya.
--   - Fungsi itu MENERIMA masa simpan sebagai parameter.
--   - Nol atau negatif berarti "jangan hapus apa pun dari tabel ini",
--     supaya menyalakannya bisa satu tabel dulu.
--
-- YANG TIDAK DIPUTUSKAN DI SINI (bukan keputusan teknis):
--   BERAPA LAMA masing-masing disimpan. Itu keputusan pemilik data, harus
--   sejalan dengan Kebijakan Privasi yang dipegang wali, dan angkanya
--   punya konsekuensi dua arah:
--     terlalu PANJANG  -> menyimpan data anak lebih lama dari yang perlu,
--                         memperbesar kerugian kalau suatu saat bocor.
--     terlalu PENDEK   -> jejak audit hilang justru saat dibutuhkan untuk
--                         menyelidiki sesuatu, dan riwayat belajar yang
--                         dijanjikan ke wali ikut terpotong.
--   Angkanya diisi lewat repository variable di
--   .github/workflows/retensi-data.yml. Selama belum diisi, TIDAK ADA yang
--   dihapus — bukan diam-diam memakai angka bawaan.
--
-- MINIMISASI SEJAK AWAL. Selain menghapus yang lama, migrasi ini juga
-- berhenti MENULIS nomor WhatsApp ke audit_log untuk peristiwa login (lihat
-- perubahan di auth-otp-verify). Data yang tidak pernah ditulis tidak perlu
-- kebijakan retensi.
-- ============================================================================

create or replace function bersihkan_data_kedaluwarsa(
  p_hari_ai      int default 0,
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
  v_ai     int := 0;
  v_audit  int := 0;
  v_otp    int := 0;
  v_kuis   int := 0;
begin
  -- Nol/negatif = tabel ini tidak disentuh. Sengaja: menyalakan retensi
  -- harus jadi tindakan yang disengaja per tabel, bukan efek samping dari
  -- memanggil fungsi ini.
  if p_hari_ai > 0 then
    delete from ai_pertanyaan_log
    where created_at < now() - make_interval(days => p_hari_ai);
    get diagnostics v_ai = row_count;
  end if;

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
    'ai_pertanyaan_log', v_ai,
    'audit_log', v_audit,
    'otp_codes', v_otp,
    'kuis_soal', v_kuis,
    'dijalankan_at', now()
  );
end;
$$;

comment on function bersihkan_data_kedaluwarsa(int, int, int, int) is
  'Pembersihan retensi. Masa simpan datang dari PEMANGGIL (repository variable di .github/workflows/retensi-data.yml), bukan ditanam di sini — berapa lama data anak disimpan adalah keputusan pemilik, bukan keputusan teknis. Nilai 0 = tabel itu tidak disentuh.';

revoke all on function bersihkan_data_kedaluwarsa(int, int, int, int) from public;
revoke all on function bersihkan_data_kedaluwarsa(int, int, int, int) from anon;
revoke all on function bersihkan_data_kedaluwarsa(int, int, int, int) from authenticated;
grant execute on function bersihkan_data_kedaluwarsa(int, int, int, int) to service_role;


-- ------------------------------------------------------ LAPORAN UMUR DATA
-- Supaya pemilik bisa MELIHAT dulu apa yang akan terhapus sebelum
-- memutuskan angkanya. Tanpa ini, menetapkan masa retensi berarti menebak.
create or replace function ringkasan_umur_data()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'ai_pertanyaan_log', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from ai_pertanyaan_log),
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

comment on function ringkasan_umur_data() is
  'Berapa banyak baris dan setua apa, per tabel yang tumbuh terus. Dipakai pemilik untuk memutuskan masa retensi berdasarkan angka nyata, bukan tebakan.';

revoke all on function ringkasan_umur_data() from public;
revoke all on function ringkasan_umur_data() from anon;
revoke all on function ringkasan_umur_data() from authenticated;
grant execute on function ringkasan_umur_data() to service_role;
