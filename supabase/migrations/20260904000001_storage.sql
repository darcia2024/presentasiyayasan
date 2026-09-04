-- ============================================================================
-- PERISA AZHARIYAH — Fase 2: Bucket Penyimpanan Media Kurikulum
--
-- Gambar dan audio mufrodat. Bucket publik-baca: santri mengakses gambar/
-- audio tanpa perlu token khusus per-file (URL langsung, ramah cache
-- browser & service worker). Yang dibatasi RLS adalah PENULISANNYA —
-- hanya staff yang boleh unggah/ubah/hapus.
--
-- Batas ukuran 10 MB per berkas (file_size_limit, dalam byte) — cukup
-- longgar untuk audio pendek/gambar, tapi mencegah satu unggahan salah
-- menghabiskan kuota penyimpanan.
-- ============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'kurikulum-media',
  'kurikulum-media',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'audio/mpeg', 'audio/mp4', 'audio/ogg', 'audio/wav']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------- KEBIJAKAN AKSES
-- storage.objects sudah RLS-enabled bawaan Supabase. auth_is_staff() dari
-- migrasi Fase 1 dipakai ulang di sini — fungsi itu murni membaca klaim JWT,
-- jadi berlaku sama di skema public maupun storage.

create policy kurikulum_media_public_read on storage.objects
  for select
  using (bucket_id = 'kurikulum-media');

create policy kurikulum_media_staff_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'kurikulum-media' and auth_is_staff());

create policy kurikulum_media_staff_update on storage.objects
  for update to authenticated
  using (bucket_id = 'kurikulum-media' and auth_is_staff())
  with check (bucket_id = 'kurikulum-media' and auth_is_staff());

create policy kurikulum_media_staff_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'kurikulum-media' and auth_is_staff());
