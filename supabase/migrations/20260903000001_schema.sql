-- ============================================================================
-- PERISA AZHARIYAH — Fase 1: Skema Basis Data
--
-- Model identitas: SANTRI SD BELUM PUNYA WHATSAPP SENDIRI.
-- Wali adalah pemilik akun (satu nomor WA + OTP). Santri adalah PROFIL di
-- bawah satu wali, bukan akun terpisah — memilih profil murni state di sisi
-- klien, bukan login kedua. Lihat docs/fase-1-arsitektur.md untuk alasan
-- lengkapnya.
--
-- Konvensi:
--   - UUID sebagai primary key (gen_random_uuid(), dari ekstensi pgcrypto
--     yang sudah aktif bawaan di Supabase).
--   - timestamptz selalu, tidak pernah timestamp naif.
--   - Status memakai text + CHECK, bukan enum bawaan Postgres — supaya nilai
--     baru bisa ditambah lewat migrasi biasa, tanpa ALTER TYPE yang rumit.
--   - updated_at diperbarui otomatis lewat trigger, bukan diandalkan dari
--     aplikasi (aplikasi bisa lupa, trigger tidak).
-- ============================================================================

create extension if not exists pgcrypto;

-- Fungsi bersama: perbarui updated_at setiap baris berubah.
create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- ----------------------------------------------------------------- WALI
-- Pemilik akun. Satu nomor WhatsApp = satu wali = bisa menaungi beberapa
-- santri (kakak-adik di yayasan yang sama cukup satu nomor).
create table wali (
  id            uuid primary key default gen_random_uuid(),
  nomor_wa      text not null unique,
  nama          text not null,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);

comment on table wali is
  'Pemilik akun (login). Nomor WA milik ORANG TUA, bukan santri, karena santri SD belum punya WhatsApp sendiri.';


-- ----------------------------------------------------------------- STAFF
-- Pengajar, pengurus, dan Umi Elly. Login dengan pola OTP yang sama seperti
-- wali, tapi tabel terpisah karena wewenangnya berbeda total.
create table staff (
  id         uuid primary key default gen_random_uuid(),
  nomor_wa   text not null unique,
  nama       text not null,
  peran      text not null check (peran in ('pengajar', 'pengurus', 'superadmin')),
  aktif      boolean not null default true,
  created_at timestamptz not null default now()
);

comment on table staff is
  'Pengajar, pengurus, dan Umi Elly (peran superadmin). Akses diatur lewat RLS berdasarkan kolom peran.';


-- ----------------------------------------------------------------- KELAS
create table kelas (
  id            uuid primary key default gen_random_uuid(),
  nama          text not null,
  jenjang       text not null check (jenjang in ('sd', 'smp', 'sma')),
  tahun_ajaran  text not null,
  pengajar_id   uuid references staff(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_kelas_pengajar on kelas(pengajar_id);


-- ---------------------------------------------------------------- SANTRI
-- Profil anak di bawah satu wali. INI YANG DIPILIH SANTRI SETELAH WALI LOGIN
-- — bukan akun terpisah.
create table santri (
  id           uuid primary key default gen_random_uuid(),
  wali_id      uuid not null references wali(id) on delete restrict,
  kelas_id     uuid references kelas(id) on delete set null,
  nama         text not null,
  jenjang      text not null check (jenjang in ('sd', 'smp', 'sma')),
  nisn         text unique,
  inisial      text not null,
  tanggal_lahir date,
  status       text not null default 'aktif' check (status in ('aktif', 'nonaktif')),
  beasiswa     boolean not null default false,
  infaq_aktif  boolean not null default false,
  created_at   timestamptz not null default now()
);

create index idx_santri_wali on santri(wali_id);
create index idx_santri_kelas on santri(kelas_id);

comment on column santri.status is
  'nonaktif dipakai pengurus untuk membekukan akses TANPA menghapus riwayat belajar santri.';


-- ----------------------------------------------------------------- MODUL
-- Fondasi Studio Kurikulum (Fase 2). Tabelnya dibangun sekarang supaya
-- Fase 2 tinggal membangun antarmuka penyuntingan di atasnya.
create table modul (
  id           uuid primary key default gen_random_uuid(),
  jenjang      text not null check (jenjang in ('sd', 'smp', 'sma')),
  tahap        int not null check (tahap between 1 and 4),
  kode         text not null,
  judul        text not null,
  urutan       int not null default 0,
  status       text not null default 'draft' check (status in ('draft', 'ditinjau', 'terbit')),
  dibuat_oleh  uuid references staff(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (jenjang, kode)
);

create trigger trg_modul_updated_at
  before update on modul
  for each row execute function set_updated_at();

comment on column modul.tahap is
  'Tangga belajar proposal: 1=Mufrodat Dasar, 2=Perkenalan & Sapaan, 3=Muhadatsah Harian, 4=Muhadatsah Bebas.';

comment on column modul.status is
  'draft -> ditinjau -> terbit. Konten draft tidak pernah terlihat santri (ditegakkan lewat RLS, bukan hanya UI).';


-- -------------------------------------------------------------- PELAJARAN
create table pelajaran (
  id            uuid primary key default gen_random_uuid(),
  modul_id      uuid not null references modul(id) on delete cascade,
  judul         text not null,
  urutan        int not null default 0,
  durasi_menit  int,
  tipe          text not null default 'materi' check (tipe in ('materi', 'evaluasi', 'sertifikat')),
  created_at    timestamptz not null default now()
);

create index idx_pelajaran_modul on pelajaran(modul_id);


-- -------------------------------------------------------------- MUFRODAT
create table mufrodat (
  id               uuid primary key default gen_random_uuid(),
  pelajaran_id     uuid references pelajaran(id) on delete cascade,
  arab             text not null,
  latin            text not null,
  arti             text not null,
  contoh_kalimat   text,
  audio_url        text,
  gambar_url       text,
  urutan           int not null default 0,
  created_at       timestamptz not null default now()
);

create index idx_mufrodat_pelajaran on mufrodat(pelajaran_id);

comment on column mufrodat.gambar_url is
  'Untuk jenjang SD, gambar+audio wajib sebelum modul boleh berstatus terbit — ditegakkan di Studio Kurikulum (Fase 2), bukan constraint basis data, karena penulisan draft harus tetap bisa tanpa media dulu.';


-- ---------------------------------------------------------- PROGRES_SANTRI
create table progres_santri (
  id           uuid primary key default gen_random_uuid(),
  santri_id    uuid not null references santri(id) on delete cascade,
  pelajaran_id uuid not null references pelajaran(id) on delete cascade,
  status       text not null default 'belum' check (status in ('belum', 'sedang', 'selesai')),
  skor         int check (skor between 0 and 100),
  selesai_at   timestamptz,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (santri_id, pelajaran_id)
);

create trigger trg_progres_updated_at
  before update on progres_santri
  for each row execute function set_updated_at();

create index idx_progres_santri on progres_santri(santri_id);


-- --------------------------------------------------------------- XP_LOG
-- Buku besar (ledger), bukan kolom angka yang ditimpa. Total XP santri
-- adalah SUM(jumlah) — cara ini yang membuat XP "server dimatikan, XP tidak
-- hilang" (gerbang Fase 0) sekaligus memberi jejak audit setiap kenaikan.
create table xp_log (
  id           uuid primary key default gen_random_uuid(),
  santri_id    uuid not null references santri(id) on delete cascade,
  jumlah       int not null check (jumlah > 0),
  alasan       text not null,
  pelajaran_id uuid references pelajaran(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index idx_xp_log_santri on xp_log(santri_id, created_at desc);

comment on table xp_log is
  'Append-only. Jangan pernah UPDATE atau DELETE baris di sini dari aplikasi — hanya INSERT. Total XP dihitung dengan SUM, bukan disimpan sebagai kolom terpisah, supaya tidak ada satu titik yang bisa ditimpa/dicurangi.';


-- --------------------------------------------------------------- LENCANA
create table lencana (
  id          uuid primary key default gen_random_uuid(),
  kode        text not null unique,
  nama        text not null,
  deskripsi   text,
  ikon        text
);

create table santri_lencana (
  santri_id     uuid not null references santri(id) on delete cascade,
  lencana_id    uuid not null references lencana(id) on delete cascade,
  diberikan_at  timestamptz not null default now(),
  primary key (santri_id, lencana_id)
);


-- ------------------------------------------------------------- SERTIFIKAT
create table sertifikat (
  id               uuid primary key default gen_random_uuid(),
  santri_id        uuid not null references santri(id) on delete restrict,
  jenjang          text not null check (jenjang in ('sd', 'smp', 'sma')),
  judul            text not null,
  nomor_seri       text not null unique,
  kode_verifikasi  text not null unique,
  diterbitkan_oleh uuid references staff(id) on delete set null,
  diterbitkan_at   timestamptz not null default now(),
  pdf_url          text
);

comment on column sertifikat.kode_verifikasi is
  'Kode acak di URL verifikasi publik (Fase 6). Terpisah dari nomor_seri yang tercetak di dokumen, supaya nomor seri tidak perlu dijaga rahasia tapi kode verifikasi tetap sulit ditebak.';


-- ----------------------------------------------------------------- INFAQ
create table infaq (
  id            uuid primary key default gen_random_uuid(),
  wali_id       uuid not null references wali(id) on delete restrict,
  jumlah        numeric(12, 2) not null check (jumlah > 0),
  keterangan    text,
  status        text not null default 'pending' check (status in ('pending', 'terverifikasi')),
  dicatat_oleh  uuid references staff(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index idx_infaq_wali on infaq(wali_id);


-- -------------------------------------------------------------- OTP_CODES
-- Kode OTP login, dipakai wali maupun staff. Kode disimpan ter-hash — tidak
-- pernah teks polos, supaya kebocoran basis data tidak otomatis berarti
-- kebocoran akses.
create table otp_codes (
  id            uuid primary key default gen_random_uuid(),
  nomor_wa      text not null,
  kode_hash     text not null,
  jenis_akun    text not null check (jenis_akun in ('wali', 'staff')),
  percobaan     int not null default 0,
  terpakai      boolean not null default false,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now()
);

create index idx_otp_nomor on otp_codes(nomor_wa, created_at desc);

comment on table otp_codes is
  'Baris kedaluwarsa dibersihkan berkala oleh fungsi terjadwal (Fase 7). Percobaan dibatasi di sisi Edge Function untuk mencegah tebak-paksa OTP.';


-- ------------------------------------------------------------- AUDIT_LOG
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_type  text not null check (actor_type in ('wali', 'santri', 'staff', 'system')),
  actor_id    uuid,
  aksi        text not null,
  target_type text,
  target_id   uuid,
  detail      jsonb,
  created_at  timestamptz not null default now()
);

create index idx_audit_actor on audit_log(actor_type, actor_id, created_at desc);

comment on table audit_log is
  'Ditulis hanya lewat service_role (Edge Functions), tidak pernah langsung dari browser. Lihat kebijakan RLS di 0002_rls.sql.';
