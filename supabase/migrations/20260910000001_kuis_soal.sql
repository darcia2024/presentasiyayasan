-- ============================================================================
-- PERISA AZHARIYAH — Soal kuis diterbitkan SERVER (audit 10 September 2026, K2)
--
-- TEMUAN YANG MELAHIRKAN TABEL INI.
-- Sampai sekarang klien mengirim DUA hal ke submit-jawaban: `mufrodat_id`
-- (soalnya apa) dan `jawaban_mufrodat_id` (yang dipilih santri). Server
-- lalu menilai dengan `benar = (jawaban_mufrodat_id === mufrodat_id)`.
--
-- Artinya klien mengirim soal DAN jawabannya sekaligus, lalu server
-- memeriksa apakah dua nilai yang sama-sama dikirim klien itu kebetulan
-- sama. Satu perulangan di konsol peramban yang mengirim pasangan identik
-- untuk seluruh mufrodat memberi XP penuh, semua lencana, dan puncak papan
-- peringkat — tanpa pernah membuka satu pelajaran pun. XP memang DITULIS
-- di server, tapi penilaian benar/salahnya tidak ada sama sekali.
--
-- BENTUK BARUNYA. Server yang memilih soal, menyusun pilihan gandanya, dan
-- menyimpan jawaban benar DI SINI. Klien hanya menerima token buram + daftar
-- arti, lalu mengirim balik token + kunci pilihan. Permintaan dari klien
-- tidak lagi membawa wewenang apa pun: tidak ada santri_id, tidak ada
-- mufrodat_id, tidak ada penanda mana yang benar.
--
-- YANG INI TUTUP: memberi XP tanpa pernah diberi soal oleh server;
-- menjawab soal orang lain; menjawab soal yang sudah dijawab (replay);
-- menimbun soal untuk dijawab massal belakangan (masa berlaku pendek).
--
-- YANG INI TIDAK TUTUP, dan memang tidak bisa: santri yang membuka daftar
-- mufrodat pelajaran (yang memang boleh ia baca — itu bahan belajarnya)
-- tetap bisa mencari arti yang benar sebelum menjawab. Menyembunyikannya
-- berarti menyembunyikan materi pelajaran itu sendiri. Yang berubah:
-- kecurangan sekarang menuntut satu perjalanan bolak-balik per soal
-- terhadap soal yang SERVER pilih, bukan satu perulangan sekali jalan.
-- Klaim di checklist & kebijakan privasi diperbaiki agar sepadan dengan
-- ini, bukan dibiarkan menjanjikan lebih dari yang ditegakkan.
-- ============================================================================

create table kuis_soal (
  id            uuid primary key default gen_random_uuid(),
  santri_id     uuid not null references santri(id) on delete cascade,
  pelajaran_id  uuid not null references pelajaran(id) on delete cascade,

  -- Jawaban benar. TIDAK PERNAH dikirim ke klien saat soal diterbitkan.
  mufrodat_id   uuid not null references mufrodat(id) on delete cascade,

  -- Pilihan yang ditampilkan, urutannya sudah diacak server:
  --   [{"kunci":"a","mufrodat_id":"..."}, {"kunci":"b", ...}, ...]
  -- Klien cuma tahu kunci ("a".."d") dan teks artinya. Kunci mana yang
  -- benar hanya bisa dijawab dengan membandingkan ke kolom mufrodat_id di
  -- atas — yaitu di server.
  opsi          jsonb not null,

  expires_at    timestamptz not null,
  dijawab_at    timestamptz,
  benar         boolean,
  created_at    timestamptz not null default now(),

  constraint kuis_soal_opsi_array check (jsonb_typeof(opsi) = 'array'),
  constraint kuis_soal_opsi_cukup check (jsonb_array_length(opsi) between 2 and 6)
);

comment on table kuis_soal is
  'Soal kuis yang DITERBITKAN SERVER, berumur pendek dan sekali jawab. Satu-satunya sumber kebenaran "soal apa" dan "jawaban benarnya mana" — lihat catatan audit K2 di kepala migrasi ini.';
comment on column kuis_soal.mufrodat_id is
  'Jawaban benar. Tidak pernah ikut ke klien saat soal diterbitkan.';
comment on column kuis_soal.opsi is
  'Pilihan yang ditampilkan beserta kunci buramnya. Urutan sudah diacak server, jadi posisi tidak membocorkan jawaban.';
comment on column kuis_soal.dijawab_at is
  'Diisi sekali lewat UPDATE bersyarat (where dijawab_at is null). Itulah penjaga replay: percobaan kedua mengubah nol baris.';

-- Pembatasan laju penerbitan soal per santri (lihat KUIS_MAKS_SOAL_PER_MENIT
-- di Edge Function) dan pembersihan baris kedaluwarsa keduanya menyapu
-- lewat indeks ini.
create index kuis_soal_santri_waktu on kuis_soal (santri_id, created_at desc);
create index kuis_soal_kedaluwarsa on kuis_soal (expires_at) where dijawab_at is null;

-- --------------------------------------------------------------------- RLS
-- Pola yang sama persis dengan otp_codes: RLS menyala, NOL kebijakan.
-- Untuk peran authenticated maupun anon itu berarti TOLAK SEMUA — hanya
-- service_role (Edge Function) yang bisa menyentuh tabel ini. Kalau klien
-- bisa membaca tabel ini, seluruh gunanya hilang: kolom mufrodat_id adalah
-- kunci jawabannya.
alter table kuis_soal enable row level security;
