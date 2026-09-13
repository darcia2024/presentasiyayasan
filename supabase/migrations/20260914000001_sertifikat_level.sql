-- ===========================================================================
-- PERISA AZHARIYAH — Sertifikat per level (Fase F)
-- 14 September 2026
--
-- ASALNYA, rapat tim PERISA 12 September: sertifikatnya **per level**, 12
-- level, "disamakan dengan sertifikasi berjenjang seperti IELTS". Sekarang
-- sertifikat terbit sekali per santri, tanpa tingkat sama sekali.
--
--
-- KELULUSAN TIDAK DIHITUNG PLATFORM. INI YANG PALING PENTING DI SINI.
--
-- Godaannya adalah membuat syarat otomatis: XP sekian, kuis lulus sekian
-- persen, progres modul 100%. Rapat yang sama menutup jalan itu — latihan dan
-- evaluasi ada di BUKU CETAK, bukan di aplikasi, dan `evaluasi-digital`
-- justru termasuk fitur yang dikunci di Fase A.
--
-- Artinya satu-satunya pihak yang tahu seorang santri lulus level 3 adalah
-- gurunya, dari buku latihan di tangannya. Platform ini MENCATAT keputusan
-- itu, bukan membuatnya. Membangun syarat otomatis di atas data yang tidak
-- pernah diisi akan menghasilkan satu dari dua hal: tidak ada yang pernah
-- lulus, atau semua lulus karena ambangnya nol — dan keduanya terlihat
-- seperti sistem yang bekerja.
--
--
-- LEVEL SEBAGAI ANGKA, MODUL SEBAGAI PENUNJUK.
--
-- `level` (1-12) yang tercetak di dokumen dan diverifikasi publik; ia harus
-- tetap terbaca sepuluh tahun lagi. `modul_id` cuma penunjuk ke buku yang
-- dipakai saat itu — boleh hilang (on delete set null) tanpa membuat
-- sertifikat yang sudah dipegang orang jadi tidak sah. Menjadikan modul
-- sebagai sumber kebenaran berarti menghapus satu baris modul yang salah
-- ketik bisa membatalkan sertifikat yang sudah dicetak dan ditandatangani.
-- ===========================================================================

alter table sertifikat
  add column level int check (level between 1 and 12);

alter table sertifikat
  add column modul_id uuid references modul(id) on delete set null;

comment on column sertifikat.level is
  'Level 1-12, satu per buku (rapat 12 Sep: sertifikasi berjenjang seperti IELTS). Sumber kebenaran yang tercetak di dokumen. NULL = sertifikat lama sebelum 14 Sep 2026, yang memang tidak bertingkat.';

comment on column sertifikat.modul_id is
  'Buku yang dipakai saat sertifikat ini terbit. PENUNJUK, bukan sumber kebenaran — dibiarkan NULL kalau modulnya dihapus, supaya sertifikat yang sudah dipegang orang tidak ikut batal.';


-- ---------------------------------------------------------------------------
-- Satu sertifikat per santri per level
--
-- Tanpa ini, pengurus yang ragu apakah sertifikat level 3 sudah terbit akan
-- menerbitkannya lagi — dan dua dokumen resmi bernomor seri berbeda untuk
-- pencapaian yang sama adalah persis jenis kekacauan yang membuat verifikasi
-- publik kehilangan gunanya.
--
-- Baris LAMA (level NULL) tidak terganggu: di Postgres, NULL tidak pernah
-- bentrok dengan NULL di indeks unik. Jadi migrasi ini tidak bisa gagal
-- karena data yang sudah ada, dan sertifikat lama tetap sah apa adanya.
-- ---------------------------------------------------------------------------
create unique index idx_sertifikat_santri_level
  on sertifikat(santri_id, level)
  where level is not null;

comment on index idx_sertifikat_santri_level is
  'Satu sertifikat per santri per level. Parsial (where level is not null) supaya sertifikat lama tanpa level tidak saling bentrok.';

create index idx_sertifikat_level on sertifikat(level) where level is not null;
