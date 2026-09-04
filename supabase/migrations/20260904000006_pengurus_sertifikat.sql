-- ============================================================================
-- PERISA AZHARIYAH — Fase 6 (bagian pengurus): panel admin & sertifikat
--
-- Tiga potongan:
-- 1. Bucket penyimpanan PDF sertifikat (publik-baca, tulis dibatasi admin)
--    — pola sama persis dengan kurikulum-media di Fase 2.
-- 2. Kebijakan RLS tambahan untuk operasi admin yang sebelumnya belum ada
--    jalan sama sekali dari klien: mencatat infaq, membuat kelas, dan
--    memverifikasi/menonaktifkan santri (beasiswa, status, kelas).
--    Pendaftaran wali/santri BARU sengaja TIDAK lewat sini — itu
--    menyentuh identitas, jadi lewat Edge Function service_role
--    (daftarkan-wali-santri), mengikuti prinsip yang sudah ditulis di
--    komentar pembuka 20260903000002_rls.sql.
-- 3. Fungsi SECURITY DEFINER verifikasi_sertifikat() — persis seperti
--    yang sudah diantisipasi komentar di RLS Fase 1: pembaca publik
--    (anon) lewat kode_verifikasi, TANPA membuka tabel sertifikat mentah
--    yang bisa dienumerasi untuk membocorkan seluruh data santri.
-- ============================================================================

-- ------------------------------------------------------------------- BUCKET
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sertifikat', 'sertifikat', true, 5242880, array['application/pdf'])
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy sertifikat_bucket_public_read on storage.objects
  for select
  using (bucket_id = 'sertifikat');

create policy sertifikat_bucket_admin_write on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sertifikat' and auth_is_admin());

create policy sertifikat_bucket_admin_update on storage.objects
  for update to authenticated
  using (bucket_id = 'sertifikat' and auth_is_admin())
  with check (bucket_id = 'sertifikat' and auth_is_admin());

-- --------------------------------------------------------- KEBIJAKAN ADMIN
create policy infaq_insert_admin on infaq
  for insert to authenticated
  with check (auth_is_admin());

create policy kelas_insert_admin on kelas
  for insert to authenticated
  with check (auth_is_admin());

-- Verifikasi/nonaktifkan santri, tandai beasiswa, pindah kelas. Pendaftaran
-- BARU (insert) tetap lewat Edge Function — lihat catatan di atas.
create policy santri_update_admin on santri
  for update to authenticated
  using (auth_is_admin())
  with check (auth_is_admin());

-- --------------------------------------------------- VERIFIKASI SERTIFIKAT
create or replace function verifikasi_sertifikat(p_kode text)
returns table (
  nama            text,
  jenjang         text,
  judul           text,
  nomor_seri      text,
  diterbitkan_at  timestamptz
)
language sql
security definer
set search_path = public
stable
as $$
  select s.nama, c.jenjang, c.judul, c.nomor_seri, c.diterbitkan_at
  from sertifikat c
  join santri s on s.id = c.santri_id
  where c.kode_verifikasi = p_kode;
$$;

revoke all on function verifikasi_sertifikat(text) from public;
grant execute on function verifikasi_sertifikat(text) to anon, authenticated;

comment on function verifikasi_sertifikat(text) is
  'Satu-satunya jalan baca publik ke data sertifikat — lookup persis satu baris lewat kode unik, bukan tabel mentah yang bisa dienumerasi. Dipanggil dari verifikasi.html tanpa login.';
