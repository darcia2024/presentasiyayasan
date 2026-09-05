# Pemulihan Bencana — Cadangan Basis Data PERISA

Fase 7. Dua pertanyaan yang harus bisa dijawab "ya" kapan pun: *apakah
cadangan hari ini sungguh-sungguh ada*, dan *seberapa cepat kita bisa
pulih kalau project Supabase hilang total*.

## Cara kerjanya

`.github/workflows/backup-database.yml` jalan otomatis **tiap hari jam
01.00 WIB**: `pg_dump` seluruh basis data (format custom, terkompresi)
lalu diunggah ke bucket privat `backups-db` di Supabase Storage sendiri.
Kenapa disimpan di Supabase juga (bukan cuma di tempat lain): supaya
tidak perlu akun pihak ketiga baru untuk sekadar menyimpan cadangan —
biayanya nol, dan bucket-nya dikunci total lewat RLS (aktif, **nol**
kebijakan — pola yang sama dengan tabel `otp_codes` sejak Fase 1).
Cadangan lebih dari 14 hari dihapus otomatis di langkah terakhir
workflow yang sama.

**Skema (struktur tabel, RLS, fungsi, trigger) TIDAK ikut di-dump** —
sengaja. Skema sudah 100% tercatat sebagai kode di `supabase/migrations/`
(sudah divalidasi ulang setiap kali ditambah sepanjang proyek ini
berjalan) dan dipulihkan dengan menjalankan ulang migrasi secara
berurutan. Cadangan harian di sini murni **data**-nya.

## Yang SUDAH diverifikasi (sesi ini, 5 September 2026)

Lingkungan pengembangan yang dipakai untuk membangun fase ini tidak
punya `pg_dump`/`pg_restore`/Docker terpasang, jadi eksekusi `pg_dump`
yang sesungguhnya **belum** pernah dijalankan langsung dari sini. Yang
sudah diuji nyata terhadap project produksi:

- Kebijakan penguncian bucket `backups-db`: kunci `anon` **ditolak**
  mengunggah (HTTP 400) dan mendapat daftar isi **kosong** kalau
  mencoba `list` (RLS menyaring, bukan membocorkan nama berkas apa pun)
  serta **ditolak** mengunduh langsung (HTTP 400). Kunci `service_role`
  — persis yang dipakai workflow — **berhasil** mengunggah, mendaftar
  isi, dan menghapus berkas uji. Ini membuktikan jalur unggah/hapus yang
  dipakai workflow sungguhan berfungsi.
- Struktur workflow (`pg_dump` lewat `postgresql-client` di
  `ubuntu-latest`, unggah lewat REST Storage API) memakai pola HTTP yang
  identik dengan yang baru saja diuji di atas.

### Run #1 gagal — dan itu menemukan dua bug nyata

Workflow dijalankan manual untuk pertama kalinya pada 5 September 2026 dan
**gagal dalam 11 detik**. Bagian "belum diverifikasi" di bawah ternyata
memang menyembunyikan dua kesalahan, keduanya di berkas workflow, bukan di
kredensial:

1. **Beda versi.** Server project ini Postgres **17.6** (dipastikan lewat
   Management API dan lewat `server_version` yang dilaporkan server saat
   handshake). `apt-get install postgresql-client` di `ubuntu-latest`
   memasang klien **16**, dan `pg_dump` menolak men-dump server yang lebih
   baru dari dirinya — ia berhenti sebelum menulis satu byte pun. Ini yang
   mematikan run #1. Sekarang klien 17 dipasang dari repo PGDG resmi.

2. **Mode pooler salah.** Komentar workflow menyuruh mengisi
   `SUPABASE_DB_URL` dengan connection string *transaction pooler*
   (port 6543). Mode transaksi tidak mempertahankan state sesi, sedangkan
   `pg_dump` memegang satu transaksi snapshot sepanjang proses — jadi ia
   tidak akan pernah berhasil lewat port itu, bahkan setelah versi klien
   dibetulkan. Port **5432** di host pooler yang sama adalah mode sesi dan
   menerima kredensial yang sama persis (keduanya diuji langsung lewat
   protokol wire Postgres: sama-sama lolos autentikasi, sama-sama
   melaporkan 17.6). Workflow kini menormalkan port ini sendiri, jadi
   secret yang terlanjur diisi 6543 tetap jalan.

Pelajarannya bukan soal Postgres: **cadangan yang belum pernah dijalankan
sekali pun harus dianggap tidak ada.** Dua bug ini lolos code review dan
validasi YAML, dan hanya bisa ditemukan dengan benar-benar menekan tombol
*Run workflow*.

Ditambahkan sekalian, karena cadangan yang diam-diam rusak lebih berbahaya
daripada cadangan yang gagal terang-terangan: setelah dump, workflow menolak
berkas di bawah 4 KB dan menjalankan `pg_restore --list` untuk memastikan
isinya benar-benar terbaca sebagai arsip, bukan file kosong hasil koneksi
yang putus di tengah.

## Yang BELUM diverifikasi — perlu dicoba sekali sebelum benar-benar diandalkan

1. **Jalankan workflow-nya sekali secara manual**: tab *Actions* repo
   GitHub → *Cadangan Basis Data PERISA* → *Run workflow*. Perlu tiga
   secret sudah terisi lebih dulu (lihat komentar di berkas workflow):
   `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
   Konfirmasi jalannya hijau dan satu berkas `.dump` baru muncul di
   bucket `backups-db` (bisa dicek lewat Supabase Studio → Storage).
2. **Uji pemulihan sungguhan** (simulasi "server hilang"), sekali saja
   sebagai latihan, bukan tiap hari:
   ```bash
   # Unduh satu berkas cadangan (lewat Supabase Studio, atau curl dengan
   # SUPABASE_SERVICE_ROLE_KEY seperti pola di workflow).
   # Siapkan basis data Postgres 17 KOSONG (Docker lokal, atau project
   # Supabase baru yang memang dibuat untuk latihan ini).
   pg_restore --clean --if-exists --no-owner --no-privileges \
     -d "<connection-string-target>" perisa-backup-*.dump
   ```
   Lalu jalankan ulang migrasi dari `supabase/migrations/` (urutan nama
   berkas = urutan menjalankan) kalau target belum punya skemanya, dan
   bandingkan jumlah baris beberapa tabel kunci (`santri`, `xp_log`,
   `sertifikat`) dengan project produksi.
3. Catat **berapa lama** langkah 1+2 makan waktu — itu jawaban sungguhan
   untuk "gerbang" fase ini (dipulihkan dalam kurang dari satu jam).
   Perkiraan kasar: unduh cadangan (~1 menit untuk basis data seukuran
   ini), `pg_restore` (~1-5 menit), jalan ulang migrasi kalau perlu
   (~1 menit) — jauh di bawah satu jam selama langkahnya sudah pernah
   dicoba SEKALI sebelumnya dan tidak dikerjakan pertama kali saat
   panik.

## Kalau server Supabase benar-benar hilang (bukan cuma latihan)

1. Buat project Supabase baru.
2. Jalankan seluruh `supabase/migrations/*.sql` berurutan lewat koneksi
   langsung (pola yang sama dipakai membangun fase-fase sebelumnya —
   lihat riwayat commit untuk contoh skrip Node + `pg`).
3. `pg_restore` cadangan HARIAN TERBARU dari bucket `backups-db` ke
   project baru.
4. Set ulang seluruh secret Edge Function (`APP_JWT_SECRET`,
   `WA_GATEWAY_URL`/`TOKEN`, `ANTHROPIC_API_KEY`, `CRON_SECRET`, dst. —
   lihat `.env.example` untuk daftar lengkapnya) dan deploy ulang semua
   Edge Function di `supabase/functions/`.
5. Perbarui `SUPABASE_URL`/`SUPABASE_ANON_KEY` di Environment Variables
   Cloudflare, lalu redeploy situs statis.
6. Jalankan `npm run test:smoke` terhadap project baru untuk konfirmasi
   alur inti (login → kuis → XP) hidup sebelum diumumkan ke wali.
