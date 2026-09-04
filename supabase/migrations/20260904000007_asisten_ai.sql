-- ============================================================================
-- PERISA AZHARIYAH — Fase 5: Asisten Bahasa Arab (log & batas pemakaian)
--
-- Satu tabel: catatan setiap pertanyaan yang diajukan ke asisten AI, dipakai
-- untuk DUA hal sekaligus — (1) menegakkan batas harian per santri
-- (AI_DAILY_LIMIT_PER_SANTRI di .env, ditegakkan Edge Function
-- tanya-asisten-ai, BUKAN di sini — index di bawah cuma bikin hitungannya
-- cepat), dan (2) riwayat konsultasi yang ditampilkan lagi ke wali.
--
-- SENGAJA tidak ada kebijakan RLS insert/update/delete untuk klien mana
-- pun — hanya Edge Function (service_role) yang menulis, pola yang sama
-- persis dengan xp_log (Fase 4) dan ringkasan_mingguan_log (Fase 6).
-- ============================================================================

create table ai_pertanyaan_log (
  id          uuid primary key default gen_random_uuid(),
  santri_id   uuid not null references santri(id) on delete cascade,
  wali_id     uuid not null references wali(id) on delete cascade,
  pertanyaan  text not null,
  jawaban     text,
  berhasil    boolean not null default true,
  created_at  timestamptz not null default now()
);

-- Query yang paling sering jalan: "berapa pertanyaan BERHASIL santri X
-- sejak tengah malam WIB hari ini" — index ini yang membuatnya cepat
-- begitu tabelnya sudah berisi ribuan baris, bukan cuma puluhan.
create index idx_ai_log_santri_waktu on ai_pertanyaan_log(santri_id, created_at);

alter table ai_pertanyaan_log enable row level security;

create policy ai_log_select_wali on ai_pertanyaan_log
  for select to authenticated
  using (
    auth_akun_jenis() = 'wali'
    and wali_id = auth.uid()
  );

create policy ai_log_select_staff on ai_pertanyaan_log
  for select to authenticated
  using (auth_is_staff());

comment on table ai_pertanyaan_log is
  'Ditulis HANYA oleh Edge Function tanya-asisten-ai (service_role). berhasil=false dicatat untuk audit tapi TIDAK dihitung ke batas harian — kegagalan panggilan model tidak boleh menghabiskan kuota santri.';
