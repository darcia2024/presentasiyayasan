# Fase 1 — Arsitektur Basis Data & Login

Dokumen ini menjelaskan **kenapa**, bukan cuma **apa**. Kalau ada yang perlu
diubah di fase berikutnya, baca ini dulu sebelum menyentuh skema atau RLS.

## 1. Kenapa santri bukan pemilik akun

Santri SD belum punya WhatsApp sendiri. Login berbasis "nomor WA santri"
tidak bisa dipakai apa adanya — ini sudah dicatat sejak rancangan awal
(lihat memori proyek `perisa-konsekuensi-pilot-sd`).

Modelnya: **wali adalah pemilik akun**, satu nomor WA + OTP. Santri adalah
**profil** di bawah satu wali — tabel `santri.wali_id`, bukan sesi login
terpisah. Memilih profil anak murni state di sisi klien setelah wali login,
bukan otentikasi kedua. Ini menyederhanakan segalanya: satu sesi, satu JWT,
satu token untuk seluruh anak di keluarga itu.

## 2. Kenapa akun dibuat pengurus, bukan pendaftaran bebas

Proposal asli PERISA menyatakan "hak akses dibuka langsung oleh Umi Elly /
yayasan". Ini bukan sekadar kalimat pemanis — Fase 1 menegakkannya secara
teknis: **alur OTP hanya berfungsi untuk nomor yang sudah ada di tabel
`wali` atau `staff`.** Kalau nomornya belum terdaftar, `auth-otp-request`
menolak dengan pesan "hubungi pengurus", bukan mendaftarkan otomatis.

Konsekuensinya: tidak ada kebijakan RLS `insert` untuk tabel `wali`,
`santri`, atau `staff` dari klien sama sekali. Akun-akun ini hanya dibuat
lewat panggilan `service_role` (nanti dari panel pengurus di Fase 6), yang
sekaligus mencatat ke `audit_log`.

## 3. Kenapa JWT kustom, bukan Supabase Auth bawaan

Supabase Auth bawaan mengirim OTP lewat **SMS**, lewat penyedia seperti
Twilio — bukan WhatsApp. Yayasan sudah menganggarkan gateway WhatsApp
(Fonnte/Wablas) di rancangan biaya, dan itu jalur pengiriman yang dipilih.

Solusinya: Edge Function `auth-otp-verify` **menandatangani JWT sendiri**
memakai `APP_JWT_SECRET` milik proyek — bukan lewat
`supabase.auth.signIn*`. Selama bentuk JWT-nya sesuai yang diharapkan
PostgREST, Supabase memperlakukannya persis seperti sesi Auth bawaan: RLS,
`auth.uid()`, semuanya jalan normal. ([Didokumentasikan resmi sebagai pola
"Third-Party Auth" / custom JWT di Supabase](https://supabase.com/docs).)

### Bentuk JWT

```json
{
  "sub": "<wali.id atau staff.id>",
  "role": "authenticated",
  "aud": "authenticated",
  "akun_jenis": "wali",
  "staff_peran": "pengajar",
  "exp": 1735900000,
  "iat": 1735896400
}
```

**Klaim `role` di sini WAJIB persis `"authenticated"`.** Itu klaim baku yang
dipakai PostgREST untuk memilih peran Postgres saat menjalankan query —
bukan tempat menyimpan peran aplikasi. Peran aplikasi ("wali" vs "staff",
dan peran staff-nya apa) disimpan di klaim kustom `akun_jenis` dan
`staff_peran`, dibaca RLS lewat `auth.jwt() ->> 'akun_jenis'`.

Ini kesalahan yang mudah sekali kejadian kalau tidak didokumentasikan —
menamai klaim aplikasi `"role"` akan menimpa mekanisme baku Supabase secara
sunyi, tanpa error yang jelas, dan seluruh kebijakan RLS akan berperilaku
aneh tanpa alasan yang kelihatan.

## 4. Kenapa progres dan XP hanya bisa dibaca dari klien

Gerbang Fase 4 di rancangan sudah menyatakan: *"XP dihitung di server,
bukan ditulis langsung oleh klien."* Fase 1 menegakkan ini dari baris
pertama — tabel `xp_log` dan `progres_santri` **tidak punya kebijakan RLS
`insert` untuk peran mana pun**. Satu-satunya jalan menulis adalah lewat
Edge Function ber-`service_role` (dibangun saat mesin gamifikasi Fase 4
disusun), yang bisa memvalidasi jawaban kuis di sisi server sebelum
mencatat XP.

`xp_log` juga sengaja berbentuk **buku besar (ledger)**, bukan kolom angka
yang ditimpa. Total XP santri = `SUM(jumlah)`. Kalau server mati lalu
menyala lagi, XP tidak hilang — dan setiap kenaikan tercatat, bukan hanya
angka akhir yang mudah dipalsukan.

## 5. Yang sengaja BELUM dibangun

- **Verifikasi sertifikat publik** (Fase 6). Tabel `sertifikat` cuma
  bisa dibaca wali pemilik dan staff — belum ada akses `anon`. Menambah
  akses publik langsung ke tabel lewat RLS berisiko membocorkan seluruh
  data sertifikat lewat enumerasi ID. Fase 6 harus memakai fungsi
  `security definer` yang hanya mengembalikan kolom aman, dipanggil dengan
  `kode_verifikasi` sebagai parameter.
- **Panel admin penuh** (Fase 6). RLS `update`/`delete` untuk
  `wali`/`santri`/`staff` sengaja belum ada — itu dibangun bersamaan
  panelnya, supaya setiap aksi tercatat lewat Edge Function, bukan
  ditulis lepas dari klien.
- **Pembersihan `otp_codes` kedaluwarsa** (Fase 7, fungsi terjadwal).

## 6. Alur login, end-to-end

```
1. Wali buka aplikasi, masukkan nomor WA.
2. Klien panggil Edge Function `auth-otp-request`.
   - Cek nomor ada di tabel wali ATAU staff. Kalau tidak ada -> tolak.
   - Buat kode 6 digit, simpan HASH-nya (bukan teks polos) ke otp_codes,
     kedaluwarsa 5 menit.
   - Kirim lewat gateway WhatsApp. Kalau WA_GATEWAY_URL belum diisi
     (pengembangan lokal / belum ada akun gateway), kode dicetak ke log
     server dengan label jelas "MODE PENGEMBANGAN" — tidak pernah
     terjadi diam-diam di produksi.
3. Wali masukkan kode dari WhatsApp.
4. Klien panggil Edge Function `auth-otp-verify`.
   - Cocokkan hash, cek belum kedaluwarsa, cek belum terpakai, batasi
     percobaan (maksimal 5x per kode).
   - Tandai kode terpakai. Perbarui wali.last_login_at.
   - Terbitkan JWT kustom (bentuk di atas), berlaku 7 hari.
   - Catat ke audit_log.
5. Klien simpan JWT, pakai untuk seluruh panggilan Supabase berikutnya.
6. Kalau akun itu wali dengan >1 santri: klien tampilkan pemilih profil
   (data dari `select * from santri where wali_id = auth.uid()`, yang
   sudah otomatis dibatasi RLS ke anak sendiri).
```
