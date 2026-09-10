# Checklist Sebelum Uji Coba Terbatas

**Status per 10 September 2026**, setelah audit menyeluruh.

> ### Kenapa checklist ini ditulis ulang
>
> Versi 5 September mencantumkan tiga hal di bawah judul **"Sudah beres &
> teruji"** yang ternyata tidak benar:
>
> - *"Login WhatsApp OTP (wali & staff)"* — login memang berjalan, tapi
>   lewat mode pengembangan yang **mengembalikan kode OTP di respons HTTP**.
>   Siapa pun yang tahu nomor WA seorang wali bisa masuk sebagai wali itu.
> - *"XP dihitung di server, tidak bisa dicurangi dari peramban"* — server
>   mencatat XP, tapi tidak menilai benar/salah sama sekali; klien mengirim
>   soal dan jawabannya sekaligus.
> - *"Ringkasan mingguan otomatis ke WhatsApp"* — fungsinya ada dan
>   ter-deploy, tapi tidak ada satu pun penjadwal yang memanggilnya.
>
> Ketiganya bukan kelalaian menulis: masing-masing lolos karena tidak ada
> yang mengujinya. Karena itu checklist ini sekarang memakai status yang
> membedakan **"kodenya jadi"** dari **"terbukti bekerja di produksi"**.

**Arti status:**

| Status | Artinya |
|---|---|
| ✅ **DONE** | Kode + uji otomatis + terbukti di produksi |
| 🧪 **NOT VERIFIED** | Kode + uji lokal lulus, **belum** terbukti di produksi |
| 🔒 **BLOCKED** | Menunggu sesuatu yang hanya Anda yang bisa berikan |
| 🤔 **NEEDS OWNER INPUT** | Menunggu keputusan Anda, bukan pekerjaan teknis |

---

## ✅ DONE — kode, uji, dan terbukti di produksi

| Hal | Bukti |
|---|---|
| Batas hak akses pengajar (nomor WA wali, sertifikat, pertanyaan AI, kelas) | 8 uji asap lulus terhadap produksi |
| Penghapusan materi TERBIT hanya oleh pengurus | uji asap: pengajar ditolak, pengurus boleh |
| Pendaftaran wali+santri atomik (gagal di tengah = tidak ada yang tersimpan) | uji asap: rollback terbukti, tanpa santri kembar |
| Persetujuan data (UU PDP) ditegakkan basis data | uji asap: wali baru tanpa persetujuan ditolak |
| Kunci jawaban kuis tidak terbaca klien mana pun | uji asap: sesi wali & staff sama-sama nol baris |
| Pencabutan akses staff nonaktif | uji asap (penjaga sejak audit 5 Sep) |
| Riwayat migrasi produksi dibereskan | `supabase db push` berikutnya aman |
| Lima migrasi baru diterapkan | terverifikasi lewat uji asap |

## ✅ DONE — kode & uji otomatis (tidak butuh produksi)

| Hal | Bukti |
|---|---|
| Gerbang lingkungan APP_ENV (gagal tertutup) | 14 uji Deno |
| Penilaian kuis di server + anti-replay + kedaluwarsa | 15 uji Deno termasuk uji eksploit |
| Penyaring XSS + penjaga pola seluruh kode peramban | 15 uji Node; penjaga terbukti menangkap pelanggaran |
| Allowlist CORS | 12 uji Deno |
| Batas hari WIB (streak, kuota, ringkasan) | 13 uji Deno |
| Pemeriksaan wewenang akun | 14 uji Deno |
| Normalisasi nomor WA konsisten di dua implementasi | korpus bersama; drift terbukti tertangkap |
| CI memeriksa rahasia, sintaks, lint, TIPE, uji, build | `.github/workflows/ci.yml` |
| Cap versi berbasis isi berkas | terbukti berubah saat berkas berubah |
| Pinch-zoom dibuka kembali di semua halaman | — |
| robots.txt + noindex halaman aplikasi | — |

---

## 🔒 BLOCKED — hanya Anda yang bisa membukanya

### 1. Gateway WhatsApp — **ini yang menahan segalanya**

**Kenapa penting:** sampai ini terisi, produksi masih memakai mode yang
mengembalikan kode OTP ke pemanggil. Uji asap sengaja dibuat **GAGAL**
selama itu masih terjadi:

```
GAGAL auth-otp-request: kode OTP TIDAK ikut di respons (regresi K1)
      — MODE PENGEMBANGAN MASIH AKTIF DI TARGET INI
```

**Yang perlu Anda lakukan:** daftar ke penyedia gateway WhatsApp (Fonnte,
Wablas, atau sejenisnya), lalu kirimkan ke saya — atau isi sendiri di
Supabase → Edge Functions → Secrets:

```
WA_GATEWAY_URL    = <endpoint kirim pesan>
WA_GATEWAY_TOKEN  = <token>
```

**PENTING — urutan:** jangan men-deploy Edge Function sebelum ini terisi.
Perbaikan keamanannya membuat login **ditolak** kalau gateway belum siap,
jadi men-deploy lebih dulu berarti tidak ada yang bisa login sama sekali.

### 2. Deploy Edge Function + push frontend

Setelah poin 1 beres, urutannya (ada di DEPLOY.md bagian 3):

```
npx supabase secrets set APP_ENV=production
npx supabase secrets set ALLOWED_ORIGINS=https://presentasiyayasan.vercel.app
npx supabase functions deploy
git push origin main
npm run test:smoke     # harus 0 gagal, 0 dilewati
```

Saya belum menjalankan ini karena langkah pertama memutus login sampai
poin 1 selesai.

### 3. Secret & variable GitHub Actions

| Nama | Jenis | Untuk |
|---|---|---|
| `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | secret | cadangan harian |
| `CRON_SECRET` | secret | ringkasan mingguan (nilai sama dengan di Edge Function) |
| `BACKUP_ENCRYPTION_PASSPHRASE` | secret | cadangan terenkripsi di luar Supabase |
| `SITE_URL`, `SUPABASE_URL_PUBLIC`, `SUPABASE_ANON_KEY_PUBLIC` | variable | pemantauan & CI |

**Cabut token lama** di https://github.com/settings/tokens sekalian —
beberapa PAT sempat dipakai/terekspos saat push 5 September.

`BACKUP_ENCRYPTION_PASSPHRASE`: **simpan juga di luar GitHub.** Tanpa frasa
itu, cadangan terenkripsinya tidak bisa dibuka lagi selamanya.

---

## 🤔 NEEDS OWNER INPUT — keputusan, bukan pekerjaan teknis

Ringkasnya di sini; alasan lengkap tiap butir ada di laporan audit.

| # | Keputusan | Rekomendasi saya |
|---|---|---|
| 1 | **Berapa lama** pertanyaan Asisten AI & log audit disimpan | Jalankan workflow "Retensi Data PERISA" mode `laporan` dulu untuk melihat angka nyata |
| 2 | **Batas biaya AI** per santri / staff / yayasan per hari | Bawaan 20/30/500 konservatif; sesuaikan setelah tahu tagihan sepekan pertama |
| 3 | Bolehkah **pengajar menerbitkan modul** sendiri? | Naikkan ke pengurus saja — alur "draf → ditinjau → terbit" baru berarti kalau peninjaunya orang lain |
| 4 | Bolehkah **papan peringkat menampilkan nama lengkap** santri ke seluruh wali sejenjang? | Ganti ke nama depan + inisial |
| 5 | Nasib **11 tombol** yang fiturnya belum ada | Sembunyikan untuk uji coba; sekarang sudah berkata jujur "belum tersedia" |
| 6 | Halaman apa yang seharusnya di **alamat root `/`** | Alihkan ke aplikasi; dek penawaran pindah ke `/proposal.html` |
| 7 | **Tujuan cadangan eksternal** (kalau mau lebih dari artefak GitHub) | Artefak GitHub sudah cukup untuk uji coba terbatas |
| 8 | Peninjauan **kebijakan privasi** oleh yang paham hukum | Sebelum keluarga sungguhan menyetujuinya |

---

## 🧪 NOT VERIFIED — perlu dicoba sungguhan

| Hal | Kenapa belum |
|---|---|
| Alur kuis K2 ujung-ke-ujung di produksi | Edge Function-nya belum di-deploy (BLOCKED #2) |
| Ringkasan mingguan benar-benar terkirim | Butuh gateway WA + secret Actions |
| Cadangan harian & pemulihannya | Belum pernah dijalankan sungguhan; lihat `docs/pemulihan-bencana.md` |
| Aplikasi di HP kelas bawah & jaringan seluler biasa | Belum pernah diuji di perangkat nyata |
| Studio Kurikulum & Panel Pengurus setelah pengetatan RLS | Uji asap memeriksa lapisan basis datanya; layarnya sendiri belum dibuka manual |

**Uji di HP sungguhan** tetap poin yang paling saya sarankan: santri SD
kemungkinan besar memakai HP orang tua yang bukan model terbaru. Buka
aplikasi di HP Android yang biasa dipakai di rumah, dengan jaringan seluler
biasa — bukan WiFi kencang. Pinch-zoom sekarang sudah bisa; pastikan teks
Arab berharakat benar-benar terbaca.

---

## 🚀 Urutan yang disarankan untuk uji coba terbatas

1. **Gateway WhatsApp** (BLOCKED #1) — semuanya menunggu ini.
2. Deploy Edge Function + push frontend (BLOCKED #2), lalu `npm run test:smoke`
   sampai **0 gagal, 0 dilewati**.
3. Isi secret & variable GitHub Actions (BLOCKED #3), jalankan cadangan
   sekali manual untuk memastikan berjalan.
4. Putuskan NEEDS OWNER INPUT #1–#5 (retensi, batas AI, hak terbit, papan
   peringkat, tombol) — empat pertama cukup lewat pesan, saya yang kerjakan.
5. Umi Elly menerbitkan **satu modul lengkap** (minimal beberapa mufrodat +
   gambar/audio) untuk SATU jenjang.
6. Pengurus mendaftarkan **3–5 keluarga** yang sudah diberi tahu dan setuju
   jadi kelompok uji coba pertama — bukan seluruh santri sekaligus.
7. Dampingi keluarga pertama login & memakai aplikasi minimal sekali secara
   langsung (video call atau tatap muka). Banyak masalah kegunaan baru
   terlihat saat orang sungguhan mencoba, bukan dari membaca dokumen ini.
8. Kumpulkan masukan seminggu, perbaiki yang paling mengganggu, baru
   perluas.
