# Checklist Sebelum Uji Coba Terbatas

**Status per 10 September 2026**, setelah audit menyeluruh.

> ### Kenapa checklist ini ditulis ulang
>
> Versi 5 September mencantumkan tiga hal di bawah judul **"Sudah beres &
> teruji"** yang ternyata tidak benar:
>
> - *"Login WhatsApp OTP (wali & staff)"* — **diganti 12 Sep 2026** dengan
>   login nomor WhatsApp + PIN. Alur OTP-nya sendiri tidak pernah benar-benar
>   berjalan: yang bekerja adalah mode pengembangan yang **mengembalikan kode
>   OTP di respons HTTP**.
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
| Batas hak akses pengajar (nomor WA wali, sertifikat, kelas) | 7 uji asap lulus terhadap produksi |
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

### 1. ~~Gateway WhatsApp~~ — **sudah tidak menahan apa pun**

**Selesai 12 September 2026.** Login diganti dari OTP WhatsApp menjadi
**nomor WhatsApp + PIN** yang ditetapkan pengurus. Tidak ada kode yang
dikirim ke mana pun, jadi gateway berbayar tidak lagi menjadi syarat
peluncuran.

Yang mendorong perubahan ini bukan cuma biaya: verifikasi 12 September
menunjukkan produksi **masih mengembalikan kode OTP di badan respons HTTP**
(`{"ok":true,"modePengembangan":true,"kodeDev":"..."}`) karena secret
`APP_ENV` di Edge Function berisi `development`. Menutup lubang itu tanpa
mengganti alurnya berarti login mati total sampai gateway dibayar. Dengan
PIN, lubangnya hilang DAN login tetap hidup.

Gateway WhatsApp tetap berguna untuk **ringkasan mingguan ke wali** — tapi
itu fitur tambahan, bukan penghalang peluncuran. Kalau suatu saat mau
diisi:

```
WA_GATEWAY_URL    = <endpoint kirim pesan>
WA_GATEWAY_TOKEN  = <token>
```

**MASIH PERLU DILAKUKAN:** setel `APP_ENV=production` di secret Edge
Function. Itu tidak lagi mematikan login, tapi tetap gerbang yang menjaga
keluaran rahasia lain:

```bash
npx supabase secrets set APP_ENV=production
```

---

## 🤔 NEEDS OWNER INPUT — keputusan, bukan pekerjaan teknis

Ringkasnya di sini; alasan lengkap tiap butir ada di laporan audit.

| # | Keputusan | Rekomendasi saya |
|---|---|---|
| 1 | **Berapa lama** log audit disimpan | Jalankan workflow "Retensi Data PERISA" mode `laporan` dulu untuk melihat angka nyata |
| 2 | ~~Batas biaya AI per santri / staff / yayasan per hari~~ | Gugur — Asisten AI dihapus 11 September 2026 |
| 3 | Bolehkah **pengajar menerbitkan modul** sendiri? | Naikkan ke pengurus saja — alur "draf → ditinjau → terbit" baru berarti kalau peninjaunya orang lain |
| 4 | Bolehkah **papan peringkat menampilkan nama lengkap** santri ke seluruh wali sejenjang? | Ganti ke nama depan + inisial |
| 5 | Nasib **11 tombol** yang fiturnya belum ada | Sembunyikan untuk uji coba; sekarang sudah berkata jujur "belum tersedia" |
| 6 | ~~Halaman apa yang seharusnya di **alamat root `/`**~~ | **Selesai 12 Sep 2026** — `/` sekarang aplikasinya; dek penawaran jadi `proposal.html` dan tidak ikut terbit |
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
