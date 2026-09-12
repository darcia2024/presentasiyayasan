-- ============================================================================
-- PERISA AZHARIYAH — Pagar biaya Asisten AI (audit 10 September 2026, S8)
--
-- TEMUAN. Kuota harian asisten AI HANYA ditegakkan untuk sesi wali:
--
--     if (sesi.akunJenis === 'wali') { ...periksa kuota... }
--
-- Sesi staff — pengajar mana pun, bukan cuma pengurus — tidak dibatasi sama
-- sekali. Satu akun staff yang bocor atau satu skrip yang salah berarti
-- tagihan Anthropic tanpa batas atas, dan yayasan baru mengetahuinya dari
-- tagihan. Tidak ada pula plafon untuk SELURUH yayasan: 50 santri yang
-- masing-masing memakai jatah penuh tetap lolos tanpa peringatan apa pun.
--
-- Dua hal yang ditambahkan di sini:
--   1. staff_id di ai_pertanyaan_log — supaya pemakaian staff bisa dihitung
--      SEBAGAI PEMAKAIAN STAFF. Sebelumnya baris yang ditulis sesi staff
--      tidak bisa dibedakan dari baris yang ditulis walinya sendiri, jadi
--      kuota per staff mustahil dihitung, dan pemakaian staff diam-diam
--      memakan jatah harian santri yang bersangkutan.
--   2. Indeks untuk dua hitungan baru (per staff per hari, dan total per
--      hari untuk plafon yayasan).
--
-- ANGKA BATASNYA sendiri ADA DI VARIABEL LINGKUNGAN, bukan di sini dan
-- bukan di kode — karena itu keputusan anggaran pemilik, bukan keputusan
-- teknis. Lihat AI_DAILY_LIMIT_* di .env.example. Nilai baku yang dipakai
-- kalau variabelnya kosong sengaja konservatif: lebih baik seorang pengajar
-- mengeluh kehabisan jatah daripada yayasan menerima tagihan kejutan.
-- ============================================================================

alter table ai_pertanyaan_log
  add column staff_id uuid references staff(id) on delete set null;

comment on column ai_pertanyaan_log.staff_id is
  'Diisi HANYA kalau pertanyaan diajukan lewat sesi staff (pengajar/pengurus menjajal fitur). NULL berarti pertanyaan sungguhan dari sesi wali. Dipakai menghitung kuota harian per staff — lihat AI_DAILY_LIMIT_PER_STAFF.';

-- Hitungan "berapa pertanyaan berhasil staff X hari ini".
create index idx_ai_log_staff_waktu
  on ai_pertanyaan_log (staff_id, created_at)
  where staff_id is not null;

-- Hitungan plafon seluruh yayasan per hari. Indeks parsial: hanya baris
-- berhasil yang dihitung (panggilan gagal tidak memotong kuota siapa pun,
-- sesuai perilaku yang sudah ada sejak Fase 5).
create index idx_ai_log_berhasil_waktu
  on ai_pertanyaan_log (created_at)
  where berhasil = true;
