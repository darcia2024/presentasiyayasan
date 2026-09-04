-- ============================================================================
-- PERISA AZHARIYAH — Fase 3: Video Terproteksi
--
-- Bucket TERPISAH dan PRIVAT (public=false) — beda dari kurikulum-media yang
-- publik-baca untuk gambar/audio mufrodat. Video butuh URL bertanda tangan
-- berumur pendek (createSignedUrl, dipanggil dari klien yang sudah lolos
-- RLS), supaya tautan yang disalin dan dikirim ke orang lain sudah mati
-- sebelum sempat dibuka. Watermark nama+NISN santri ditumpuk di atas video
-- lewat CSS di sisi klien (js/ui/course.js), bukan dibakar ke berkas video.
--
-- CATATAN JUJUR (sudah dicatat sejak rancangan awal proyek): ini pencegahan
-- yang wajar, bukan jaminan mutlak terhadap rekam layar. DRM tingkat
-- industri (Widevine dkk.) di luar jangkauan biaya yayasan.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('kurikulum-video', 'kurikulum-video', false, 524288000, array['video/mp4', 'video/webm'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Baca: HANYA staff lewat sesi biasa. Santri/wali TIDAK PERNAH membaca bucket
-- ini langsung — mereka hanya menerima URL bertanda tangan (createSignedUrl)
-- yang staff/sistem terbitkan, bukan akses ke objectnya secara langsung.
create policy kurikulum_video_staff_read on storage.objects
  for select to authenticated
  using (bucket_id = 'kurikulum-video' and auth_is_staff());

create policy kurikulum_video_staff_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kurikulum-video' and auth_is_staff());

create policy kurikulum_video_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'kurikulum-video' and auth_is_staff())
  with check (bucket_id = 'kurikulum-video' and auth_is_staff());

create policy kurikulum_video_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kurikulum-video' and auth_is_staff());

-- ---------------------------------------------------------------- PELAJARAN
alter table pelajaran add column video_path text;

comment on column pelajaran.video_path is
  'Path OBJEK di bucket privat kurikulum-video (bukan URL publik). URL
   pemutaran dibuat sekali pakai lewat Edge Function video-signed-url —
   santri/wali tidak pernah membaca bucket videonya sendiri (lihat kebijakan
   di atas), supaya masa berlaku URL benar-benar ditegakkan server, bukan
   sekadar disembunyikan di klien.';
