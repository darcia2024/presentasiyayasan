-- ============================================================================
-- PERISA AZHARIYAH — Fase 3: Dokumen PDF Sungguhan
--
-- Sebelumnya "Perpustakaan Digital" (viewModulPdf) isinya string HTML yang
-- ditulis keras di js/data/documents.js — bukan berkas PDF sungguhan.
-- Tabel ini menggantikannya dengan berkas PDF asli yang diunggah lewat
-- Studio Kurikulum, disajikan lewat pembaca yang tombol unduhnya dimatikan.
--
-- CATATAN JUJUR (sudah dicatat sejak rancangan awal): ini pencegahan yang
-- wajar, bukan jaminan mutlak — santri yang benar-benar niat masih bisa
-- screenshot atau memakai alat pihak ketiga. Sama seperti watermark video.
-- ============================================================================

create table dokumen (
  id             uuid primary key default gen_random_uuid(),
  jenjang        text not null check (jenjang in ('sd', 'smp', 'sma')),
  judul          text not null,
  deskripsi      text,
  penyusun       text not null default 'Umi Elly',
  file_url       text not null,
  ukuran_bytes   bigint,
  status         text not null default 'draft' check (status in ('draft', 'terbit')),
  urutan         int not null default 0,
  diunggah_oleh  uuid references staff(id) on delete set null,
  created_at     timestamptz not null default now()
);

create index idx_dokumen_jenjang on dokumen(jenjang, status);

comment on table dokumen is
  'PDF silabus/ringkasan resmi. file_url menunjuk ke bucket kurikulum-media (subfolder dokumen/), sama seperti gambar dan audio mufrodat.';

alter table dokumen enable row level security;

create policy dokumen_select_terbit on dokumen
  for select to authenticated
  using (status = 'terbit' or auth_is_staff());

create policy dokumen_write_staff on dokumen
  for all to authenticated
  using (auth_is_staff())
  with check (auth_is_staff());

-- ------------------------------------------------------- BUCKET: TAMBAH PDF
-- Bucket kurikulum-media dari migrasi sebelumnya dipakai ulang untuk PDF —
-- kebijakan akses (publik-baca, tulis staff) sudah pas untuk dokumen juga,
-- tidak perlu bucket atau kebijakan baru.
update storage.buckets
set allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav', 'application/pdf']
where id = 'kurikulum-media';
