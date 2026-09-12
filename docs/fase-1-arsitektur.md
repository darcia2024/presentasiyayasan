# Fase 1 — Arsitektur Basis Data & Login

Dokumen ini menjelaskan **kenapa**, bukan cuma **apa**. Kalau ada yang perlu
diubah di fase berikutnya, baca ini dulu sebelum menyentuh skema atau RLS.

## 1. Kenapa santri bukan pemilik akun

Santri SD belum punya WhatsApp sendiri. Login berbasis "nomor WA santri"
tidak bisa dipakai apa adanya — ini sudah dicatat sejak rancangan awal
(lihat memori proyek `perisa-konsekuensi-pilot-sd`).

Modelnya: **wali adalah pemilik akun**, satu nomor WA + PIN. Santri adalah
**profil** di bawah satu wali — tabel `santri.wali_id`, bukan sesi login
terpisah. Memilih profil anak murni state di sisi klien setelah wali login,
bukan otentikasi kedua. Ini menyederhanakan segalanya: satu sesi, satu JWT,
satu token untuk seluruh anak di keluarga itu.

## 2. Kenapa akun dibuat pengurus, bukan pendaftaran bebas

Proposal asli PERISA menyatakan "hak akses dibuka langsung oleh Umi Elly /
yayasan". Ini bukan sekadar kalimat pemanis — Fase 1 menegakkannya secara
teknis: **login hanya berfungsi untuk nomor yang sudah ada di tabel `wali`
atau `staff` DAN sudah punya PIN yang ditetapkan pengurus.** Nomor yang
belum terdaftar ditolak, bukan didaftarkan otomatis — dan ditolak dengan
kalimat yang sama persis dengan PIN salah, supaya halaman login tidak bisa
dipakai menguji nomor siapa yang jadi keluarga santri di yayasan ini.

Konsekuensinya: tidak ada kebijakan RLS `insert` untuk tabel `wali`,
`santri`, atau `staff` dari klien sama sekali. Akun-akun ini hanya dibuat
lewat panggilan `service_role` (nanti dari panel pengurus di Fase 6), yang
sekaligus mencatat ke `audit_log`.

## 3. Kenapa JWT kustom, bukan Supabase Auth bawaan

Supabase Auth bawaan tidak mengenal "nomor WhatsApp + PIN yang ditetapkan
pengurus" sebagai cara masuk. Yang ditawarkannya untuk identitas berbasis
nomor adalah OTP lewat **SMS** (Twilio dsb.) — bukan WhatsApp, dan bukan
PIN.

> **Perubahan 12 September 2026.** Sampai tanggal ini bagian ini
> menggambarkan alur OTP WhatsApp. Alur itu dihapus seluruhnya: gateway
> WhatsApp-nya tidak pernah disiapkan, dan "mode pengembangan" yang
> menutupi ketiadaannya ternyata AKTIF di produksi — kode masuk ikut di
> badan respons HTTP, jadi siapa pun yang tahu satu nomor terdaftar bisa
> masuk sebagai pemiliknya. Penggantinya PIN yang ditetapkan pengurus.
> Alasan lengkap dan pertukarannya ada di
> `supabase/migrations/20260912000001_login_pin.sql`.

Solusinya: Edge Function `auth-login-pin` **menandatangani JWT sendiri**
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
- Tabel kredensial (`wali_kredensial`, `staff_kredensial`) RLS-nya menyala
  **tanpa satu pun policy** — hanya `service_role` yang bisa menyentuhnya.
  Hash PIN tidak boleh terbaca klien mana pun, termasuk pengurus.

## 6. Alur login, end-to-end

```
1. Wali buka aplikasi, masukkan nomor WA + PIN (satu layar, satu langkah).
2. Klien panggil Edge Function `auth-login-pin`.
   - Cari nomor di tabel wali ATAU staff. Tidak ketemu -> tolak, TAPI
     tetap jalankan satu penurunan PBKDF2 yang dibuang hasilnya, supaya
     nomor asing tidak dijawab jauh lebih cepat daripada nomor terdaftar
     (pesannya seragam; waktunya juga harus seragam).
   - Ambil kredensial dari wali_kredensial / staff_kredensial. Belum punya
     PIN -> tolak dengan pesan yang sama.
   - Akun sedang terkunci -> tolak 429, sebutkan sisa menitnya.
   - Cocokkan PIN: PBKDF2-HMAC-SHA256, 210.000 iterasi, salt per akun.
     Salah -> percobaan+1; percobaan ke-5 mengunci akun 15 menit.
   - Benar -> reset penghitung, perbarui wali.last_login_at,
     terbitkan JWT kustom (bentuk di atas, berlaku 7 hari),
     catat `login_berhasil` ke audit_log.
3. Klien simpan JWT, pakai untuk seluruh panggilan Supabase berikutnya.
4. Kalau akun itu wali dengan >1 santri: klien tampilkan pemilih profil
   (data dari `select * from santri where wali_id = auth.uid()`, yang
   sudah otomatis dibatasi RLS ke anak sendiri).
```

**Dari mana PIN-nya datang.** Pengurus menetapkannya saat mendaftarkan
keluarga lewat Panel Otoritas (`daftarkan-wali-santri`), dan bisa
mengatur ulang kapan saja lewat tombol "Atur PIN" di kartu santri — itu
satu-satunya jalan keluar untuk keluarga yang lupa PIN, karena memang tidak
ada kanal untuk mengirimkannya otomatis. Pemilik akun bisa menggantinya
sendiri lewat menu **Ganti PIN** (`auth-atur-pin`, mode B), yang menuntut
PIN lama. Tanpa langkah terakhir itu, tidak akan pernah ada satu momen pun
di mana PIN sebuah keluarga hanya diketahui keluarga itu sendiri.
