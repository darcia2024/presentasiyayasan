-- ============================================================================
-- PERISA AZHARIYAH — Fase 6 (bagian wali): log ringkasan mingguan
--
-- Wali adalah pengguna utama untuk pilot SD (lihat catatan arsitektur) —
-- yang memutuskan anak membuka aplikasi atau tidak adalah orang tuanya.
-- Tabel ini murni buku catatan pengiriman: mencegah ringkasan minggu yang
-- sama terkirim dua kali kalau pemicu (cron eksternal) berjalan lebih dari
-- sekali di jendela yang sama, dan memberi jejak audit kapan wali mana
-- terakhir menerima ringkasan anak mana.
--
-- SENGAJA tidak ada kebijakan RLS insert/select untuk klien mana pun —
-- hanya Edge Function kirim-ringkasan-mingguan (service_role) yang menulis,
-- pola yang sama persis dengan xp_log/progres_santri/santri_lencana di
-- Fase 4.
-- ============================================================================

create table ringkasan_mingguan_log (
  id            uuid primary key default gen_random_uuid(),
  santri_id     uuid not null references santri(id) on delete cascade,
  minggu_mulai  date not null, -- Senin awal pekan yang diringkas (Asia/Jakarta)
  xp_pekan      int not null default 0,
  mufrodat_baru int not null default 0,
  terkirim_at   timestamptz not null default now(),
  unique (santri_id, minggu_mulai)
);

create index idx_ringkasan_santri on ringkasan_mingguan_log(santri_id);

alter table ringkasan_mingguan_log enable row level security;

comment on table ringkasan_mingguan_log is
  'Buku catatan idempoten kirim-ringkasan-mingguan — bukan sumber data ringkasan, hanya jejak "sudah terkirim minggu ini atau belum".';
