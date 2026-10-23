-- ===========================================================================
-- PERISA AZHARIYAH — Link embed PPT hanya terbaca staff
-- 24 Oktober 2026 (audit, temuan #3)
-- ===========================================================================
--
-- TEMUAN. Migrasi 20260924000001 menaruh link embed OneDrive sebagai kolom
-- pelajaran.ppt_embed_url, dengan alasan "pelajaran_select sudah membuka
-- baris ke seluruh staff". Benar — tapi kebijakan yang sama JUGA membuka
-- setiap pelajaran di modul TERBIT ke SEMUA akun yang login, termasuk wali.
-- RLS menyaring BARIS, bukan kolom, jadi setiap wali bisa membaca link
-- embed setiap bab terbit lewat satu permintaan REST. Link embed OneDrive
-- bisa dibuka siapa pun yang memegangnya, sedangkan keputusannya (Fase C):
-- PPT adalah bahan yang diproyeksikan guru, BUKAN untuk wali dan santri.
--
-- ppt_path tidak bermasalah dengan cara yang sama: berkasnya di bucket
-- privat, dan URL-nya hanya diterbitkan ppt-signed-url yang menolak wali.
--
-- KENAPA TABEL TERPISAH, bukan hak akses per kolom. Staff dan wali sama-sama
-- memakai peran Postgres `authenticated` (JWT kustom, lihat
-- _shared/session-jwt.ts), jadi GRANT per kolom tidak bisa membedakan
-- keduanya. Tabel sendiri dengan RLS khusus staff bisa — dan PostgREST tetap
-- bisa menyematkannya dalam query pelajaran yang sama
-- (`pelajaran(…, ppt_embed:pelajaran_ppt_embed(url))`): bagi wali hasilnya
-- null, bagi staff berisi link-nya.

create table pelajaran_ppt_embed (
  pelajaran_id     uuid primary key references pelajaran(id) on delete cascade,
  -- Batas domain yang sama persis dengan check constraint lama — kolom ini
  -- tetap dirender sebagai <iframe> di layar setiap guru.
  url              text not null check (
    url ~ '^https://(onedrive\.live\.com|1drv\.ms|[a-z0-9-]+\.sharepoint\.com)/'
  ),
  diperbarui_pada  timestamptz not null default now()
);

comment on table pelajaran_ppt_embed is
  'Link embed PowerPoint OneDrive per bab (Fase C3). Terpisah dari pelajaran supaya RLS bisa menutupnya dari wali — lihat migrasi 20261024000002. Dibatasi ke domain Microsoft oleh check constraint.';

insert into pelajaran_ppt_embed (pelajaran_id, url)
select id, ppt_embed_url from pelajaran where ppt_embed_url is not null;

alter table pelajaran drop column ppt_embed_url;

alter table pelajaran_ppt_embed enable row level security;

-- Seluruh staff, TERMASUK guru mitra: menayangkan materi adalah seluruh
-- alasan akun mereka ada. Siapa yang boleh menyimpan sama dengan siapa yang
-- dulu boleh menyunting kolomnya (pelajaran_update_staff).
create policy ppt_embed_select_staff on pelajaran_ppt_embed
  for select to authenticated using (auth_is_staff());
create policy ppt_embed_insert_staff on pelajaran_ppt_embed
  for insert to authenticated with check (auth_is_staff());
create policy ppt_embed_update_staff on pelajaran_ppt_embed
  for update to authenticated using (auth_is_staff()) with check (auth_is_staff());
create policy ppt_embed_delete_staff on pelajaran_ppt_embed
  for delete to authenticated using (auth_is_staff());

revoke all on pelajaran_ppt_embed from anon;
grant select, insert, update, delete on pelajaran_ppt_embed to authenticated;
