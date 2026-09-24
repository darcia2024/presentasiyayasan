-- ===========================================================================
-- PERISA AZHARIYAH — Pemutar PPT lewat link embed OneDrive (Fase C3)
-- 24 September 2026
-- ===========================================================================
--
-- KEPUTUSAN PEMILIK, 24 Sep 2026. Berkas PPT disimpan di OneDrive yayasan.
-- Owner mengambil link "Embed / Sematkan" dari OneDrive dan menempelkannya
-- ke bab di Studio -> Materi PPT. Guru menayangkannya lewat pemutar di dalam
-- aplikasi, yang dirender mesin PowerPoint milik Microsoft sendiri — jadi
-- animasinya sama persis dengan PowerPoint, tanpa konversi apa pun.
--
-- Kenapa link, bukan unggahan otomatis ke OneDrive: unggahan otomatis
-- menuntut akun Microsoft 365 + pendaftaran aplikasi di Azure. Menempel
-- link cukup dengan akun OneDrive biasa, dan pemutarnya sama persis —
-- bisa ditingkatkan ke jalur otomatis nanti tanpa membuang apa pun.
--
-- HARGA YANG DISADARI PEMILIK: link embed OneDrive bisa dibuka siapa pun
-- yang memegangnya, termasuk di luar aplikasi. Butir 10.2 ("guru mitra hanya
-- bisa melihat") tidak lagi dijamin mutlak untuk materi yang ditayangkan
-- lewat jalur ini.
--
-- Berdampingan dengan ppt_path (berkas di bucket privat), bukan
-- menggantikannya: jalur unduh lama untuk guru internal tetap hidup.
--
-- DAFTAR DOMAIN DI CHECK CONSTRAINT BUKAN HIASAN. Kolom ini dirender
-- sebagai <iframe> di layar setiap guru. Tanpa batas ini, satu akun staff
-- (atau satu permintaan REST dari console) bisa menyematkan halaman apa pun
-- — termasuk halaman login palsu — ke dalam aplikasi yayasan. Validasi di
-- klien (js/core/onedrive.js) memberi pesan yang ramah; batas yang
-- sungguhan ada di sini. CSP frame-src di vercel.json adalah lapis ketiga.

alter table pelajaran add column ppt_embed_url text;

alter table pelajaran add constraint pelajaran_ppt_embed_url_onedrive check (
  ppt_embed_url is null
  or ppt_embed_url ~ '^https://(onedrive\.live\.com|1drv\.ms|[a-z0-9-]+\.sharepoint\.com)/'
);

comment on column pelajaran.ppt_embed_url is
  'Link embed PowerPoint dari OneDrive (pribadi: onedrive.live.com / 1drv.ms; Microsoft 365: *.sharepoint.com). Ditayangkan di pemutar PPT dalam aplikasi. Dibatasi ke domain Microsoft oleh check constraint — lihat migrasi 20260924000001.';

-- Kebijakan RLS pelajaran tidak perlu disunting: pelajaran_select sudah
-- membuka baris ke seluruh staff (termasuk guru mitra), dan
-- pelajaran_update_staff sudah membolehkan staff menyimpan link-nya —
-- persis siapa yang sekarang boleh mengunggah PPT.
