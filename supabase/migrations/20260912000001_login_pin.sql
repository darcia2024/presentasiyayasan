-- ===========================================================================
-- PERISA AZHARIYAH — Login dengan PIN, menggantikan OTP WhatsApp
-- 12 September 2026
--
-- KENAPA BERUBAH.
--
-- Alur lama: wali mengetik nomor WhatsApp -> server membuat kode 6 digit ->
-- kode dikirim lewat gateway WhatsApp -> wali mengetik kodenya. Alur itu
-- punya dua masalah yang saling mengunci:
--
--   1. Gateway WhatsApp-nya tidak pernah ada. WA_GATEWAY_URL kosong sejak
--      awal, jadi di lingkungan mana pun kode itu TIDAK PERNAH terkirim ke
--      siapa pun. Satu-satunya alasan login bisa jalan sama sekali adalah
--      "mode pengembangan", yang mengembalikan kodenya di badan respons HTTP.
--   2. Karena secret APP_ENV di produksi ternyata berisi 'development',
--      mode itu AKTIF di produksi (diverifikasi 12 Sep 2026 dengan curl).
--      Siapa pun yang tahu satu nomor terdaftar bisa masuk sebagai pemilik
--      nomor itu. Lubang K1 yang diaudit 10 September ternyata masih terbuka
--      — bukan karena kodenya salah, tapi karena konfigurasinya.
--
-- Menutup lubang itu tanpa mengganti alurnya berarti TIDAK ADA yang bisa
-- login sampai gateway WhatsApp berbayar disiapkan dan dibayar.
--
-- Keputusan yayasan: ganti dengan PIN yang didaftarkan pengurus. Wali masuk
-- dengan nomor WhatsApp + PIN. Tidak ada kode yang dikirim, tidak ada
-- gateway, tidak ada jendela 5 menit.
--
-- YANG HILANG, DIKATAKAN TERUS TERANG. OTP adalah faktor KEPEMILIKAN —
-- penyerang perlu menguasai HP wali. PIN adalah faktor PENGETAHUAN, dan
-- pengurus yang menetapkannya ikut mengetahuinya. Pertahanannya jadi
-- bergantung pada tiga hal yang disiapkan di sini: PIN tidak pernah
-- disimpan apa adanya, percobaan salah dibatasi lalu akun dikunci
-- sementara, dan setiap penetapan/pergantian PIN tercatat di audit_log.
--
-- Untuk yayasan yang mendaftarkan keluarga satu per satu dan menyampaikan
-- PIN-nya langsung, ini pertukaran yang wajar — dan jauh lebih aman
-- daripada keadaan hari ini, di mana kode masuk bisa diambil siapa saja
-- lewat satu permintaan HTTP.
--
-- KENAPA TABEL TERPISAH, BUKAN KOLOM DI `wali`/`staff`.
--
-- Kebijakan RLS yang ada membolehkan wali membaca barisnya sendiri
-- (wali_select_self) dan pengurus membaca SELURUH baris wali
-- (wali_select_admin). Kalau hash PIN ditaruh di sana, hash setiap keluarga
-- ikut terbaca oleh setiap pengurus — dan PIN 6 digit yang hash-nya sudah
-- di tangan bisa ditebak habis secara luring, berapa pun kuat KDF-nya.
--
-- Tabel di bawah RLS-nya menyala TANPA SATU PUN POLICY. Di Postgres itu
-- berarti: ditolak untuk semua peran klien (anon, authenticated), dan hanya
-- bisa disentuh service_role — yaitu Edge Function. Tidak ada jalan bagi
-- peramban untuk membacanya, disengaja atau tidak.
-- ===========================================================================

-- --------------------------------------------------------------------------
-- 1. Kredensial wali
-- --------------------------------------------------------------------------
create table wali_kredensial (
  wali_id          uuid primary key references wali(id) on delete cascade,

  -- PBKDF2-HMAC-SHA256. Salt acak per akun, jumlah iterasi ikut disimpan
  -- supaya bisa dinaikkan kelak tanpa membuat PIN lama tidak bisa diverifikasi.
  pin_hash         text not null,
  pin_salt         text not null,
  pin_iterasi      int  not null,

  diperbarui_at    timestamptz not null default now(),
  diperbarui_oleh  uuid references staff(id) on delete set null,

  -- Pertahanan utama PIN pendek: kunci sementara sesudah beberapa kali salah.
  percobaan        int not null default 0,
  terkunci_sampai  timestamptz
);

comment on table wali_kredensial is
  'PIN login wali. RLS menyala tanpa policy — hanya service_role (Edge Function) yang bisa membaca/menulis. Jangan pernah menambahkan policy select di sini.';

-- --------------------------------------------------------------------------
-- 2. Kredensial staff
-- --------------------------------------------------------------------------
create table staff_kredensial (
  staff_id         uuid primary key references staff(id) on delete cascade,
  pin_hash         text not null,
  pin_salt         text not null,
  pin_iterasi      int  not null,
  diperbarui_at    timestamptz not null default now(),
  diperbarui_oleh  uuid references staff(id) on delete set null,
  percobaan        int not null default 0,
  terkunci_sampai  timestamptz
);

comment on table staff_kredensial is
  'PIN login staff. Sama seperti wali_kredensial: RLS menyala tanpa policy, hanya service_role.';

-- --------------------------------------------------------------------------
-- 3. RLS menyala, policy sengaja KOSONG
--
-- Tanpa policy apa pun, setiap SELECT/INSERT/UPDATE/DELETE dari peran klien
-- mengembalikan nol baris / ditolak. service_role melewati RLS sepenuhnya,
-- jadi Edge Function tetap bisa bekerja. Ini bukan kelalaian — ini yang
-- diinginkan, dan komentar di atas tabel menjelaskannya supaya tidak ada
-- yang "memperbaiki"-nya di kemudian hari.
-- --------------------------------------------------------------------------
alter table wali_kredensial  enable row level security;
alter table staff_kredensial enable row level security;

-- --------------------------------------------------------------------------
-- 4. Lepaskan otp_codes dari fungsi retensi SEBELUM tabelnya dibuang
--
-- bersihkan_data_kedaluwarsa() dan ringkasan_umur_data() masih menyebut
-- otp_codes (20260910000005, disunting 20260911000001). Menjatuhkan tabelnya
-- tanpa menyentuh keduanya membuat workflow "Retensi Data PERISA" gagal
-- setiap kali jalan — dan gagalnya baru ketahuan berhari-hari kemudian.
--
-- Pola persis sama dengan cara ai_pertanyaan_log dilepaskan pada
-- 20260911000001: tanda tangan lama di-drop eksplisit karena jumlah
-- parameternya berubah.
-- --------------------------------------------------------------------------
drop function if exists bersihkan_data_kedaluwarsa(int, int, int);

create or replace function bersihkan_data_kedaluwarsa(
  p_hari_audit   int default 0,
  p_hari_kuis    int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_audit  int := 0;
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

  if p_hari_kuis > 0 then
    delete from kuis_soal
    where created_at < now() - make_interval(days => p_hari_kuis);
    get diagnostics v_kuis = row_count;
  end if;

  return jsonb_build_object(
    'audit_log', v_audit,
    'kuis_soal', v_kuis,
    'dijalankan_at', now()
  );
end;
$$;

comment on function bersihkan_data_kedaluwarsa(int, int) is
  'Pembersihan retensi. Masa simpan datang dari PEMANGGIL (repository variable di .github/workflows/retensi-data.yml), bukan ditanam di sini — berapa lama data disimpan adalah keputusan pemilik, bukan keputusan teknis. Nilai 0 = tabel itu tidak disentuh.';

revoke all on function bersihkan_data_kedaluwarsa(int, int) from public;
revoke all on function bersihkan_data_kedaluwarsa(int, int) from anon;
revoke all on function bersihkan_data_kedaluwarsa(int, int) from authenticated;
grant execute on function bersihkan_data_kedaluwarsa(int, int) to service_role;

-- Tanda tangannya tidak berubah, jadi cukup diganti isinya.
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
    'kuis_soal', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from kuis_soal),
    'xp_log', (
      select jsonb_build_object('baris', count(*), 'tertua', min(created_at), 'terbaru', max(created_at))
      from xp_log)
  );
$$;


-- --------------------------------------------------------------------------
-- 5. Buang sisa alur OTP
--
-- otp_codes hanya dipakai auth-otp-request/auth-otp-verify, yang dihapus
-- bersama migrasi ini. Membiarkan tabelnya berarti menyimpan hash kode
-- masuk milik nomor-nomor wali tanpa ada yang pernah membacanya lagi.
-- --------------------------------------------------------------------------
drop index if exists idx_otp_nomor;
drop table if exists otp_codes;
