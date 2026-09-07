# Menerbitkan PERISA ke Alamat HTTPS

Panduan sekali jalan untuk menaikkan aplikasi ke staging. Setelah ini selesai,
setiap pembaruan berikutnya cukup `git push`.

> **Kenapa HTTPS wajib, bukan pelengkap.** Service worker hanya berjalan di
> `localhost` atau HTTPS. Tanpa HTTPS, aplikasi tidak bisa dipasang ke layar
> utama HP santri dan tidak bisa dibuka luring — dua hal yang justru menjadi
> alasan aplikasi ini dibangun sebagai PWA.

Biaya seluruh langkah di bawah: **nol rupiah**, kecuali domain (~Rp 55.000/tahun
untuk `.or.id`, dan itu pun opsional pada tahap staging).

---

## Langkah 1 — Naikkan kode ke GitHub

Repo sudah tersambung ke `github.com/darcia2024/presentasiyayasan`.

```bash
git push -u origin fase-0-fondasi
```

Setelah ditinjau, gabungkan ke `main`:

```bash
git checkout main && git merge fase-0-fondasi && git push
```

---

## Langkah 2 — Sambungkan ke Cloudflare Pages

1. Buka [dash.cloudflare.com](https://dash.cloudflare.com) lalu buat akun gratis.
2. Pilih **Workers & Pages → Create → Pages → Connect to Git**.
3. Pilih repositori `presentasiyayasan`.
4. Isi pengaturan build **persis seperti ini**:

   | Kolom | Isi |
   | --- | --- |
   | Production branch | `main` |
   | Framework preset | `None` |
   | Build command | `npm run build` |
   | Build output directory | `/` |
   | Root directory | *(biarkan kosong)* |

5. Tekan **Save and Deploy**.

Cloudflare memberi alamat seperti `perisa-azhariyah.pages.dev`. Alamat itu sudah
HTTPS dan sudah cukup untuk memasang aplikasi ke HP.

> **Kenapa `npm run build` perlu dijalankan di sana?** Perintah itu menyusun
> ulang CSS ikon dan mengecap versi ke `?v=` serta `SW_VERSION`. Kalau
> dilewat, perangkat pengguna bisa menyajikan campuran berkas lama dan baru.

---

## Langkah 3 — Uji pemasangan di HP sungguhan

Ini gerbang Fase 0, dan tidak bisa digantikan pengujian di komputer.

1. Buka alamat `.pages.dev` di **Chrome Android**.
2. Banner "Pasang Aplikasi PERISA" muncul → pasang.
3. Buka dari layar utama — aplikasi harus tampil penuh layar, tanpa bilah alamat.
4. **Aktifkan mode pesawat, lalu buka lagi.** Aplikasi harus tetap terbuka
   lengkap dengan ikon dan tulisan Arabnya.

Langkah 4 itu yang paling penting. Kalau ikon hilang saat mode pesawat, berarti
ada berkas yang belum masuk daftar app shell — periksa `tools/stamp-version.js`.

Untuk **iPhone**: Safari tidak punya banner otomatis. Buka menu Bagikan →
"Tambah ke Layar Utama".

---

## Langkah 4 — Domain sendiri (boleh ditunda)

Alamat `.pages.dev` sudah berfungsi penuh. Domain sendiri hanya soal wibawa di
mata wali murid — dan untuk yayasan, itu bukan hal sepele.

Pilihan yang pantas: `perisa.or.id` (badan/organisasi) atau `perisa.sch.id`
(lembaga pendidikan, syaratnya lebih ketat: butuh surat dari sekolah).

Setelah domain dibeli, di Cloudflare Pages pilih **Custom domains → Set up a
domain**, lalu ikuti petunjuk DNS-nya. Sertifikat HTTPS terbit otomatis.

Terakhir, perbarui `PUBLIC_BASE_URL` di variabel lingkungan Cloudflare agar
tautan verifikasi sertifikat nanti (Fase 6) menunjuk ke domain yang benar.

---

## Variabel lingkungan di Cloudflare

Belum ada yang wajib diisi untuk Fase 0. Mulai Fase 1, isi lewat
**Settings → Environment variables**, mengikuti daftar di `.env.example`.

> **Satu aturan yang tidak boleh dilanggar:** kunci `SUPABASE_SERVICE_ROLE_KEY`
> dan `ANTHROPIC_API_KEY` tidak boleh pernah masuk ke berkas mana pun di dalam
> `js/` — seluruh isi folder itu terkirim apa adanya ke browser santri.

---

## Catatan tentang server Node

`server.js` hanya untuk pengembangan lokal. Cloudflare Pages menyajikan berkas
statis, jadi tiga endpoint `/api/game/*` tidak ikut berjalan di staging —
papan peringkat akan memakai data cadangan.

Itu wajar untuk sekarang. Mulai Fase 1, endpoint-endpoint itu digantikan
Supabase sepenuhnya, dan `server.js` tetap tinggal sebagai alat pengembangan.

---

## Penerbitan lewat Vercel

Repo ini tersambung ke proyek Vercel `presentasiyayasan` (cabang produksi
`main`). Setiap push ke `main` memicu penerbitan otomatis.

### Yang diatur di `vercel.json`, bukan di dashboard

`buildCommand` dan `outputDirectory` sengaja ditulis di `vercel.json` yang
ikut masuk git. Pengaturan lewat dashboard tidak terlihat saat orang membaca
kode, tidak masuk riwayat perubahan, dan hilang diam-diam kalau proyeknya
dibuat ulang.

Kondisi itu bukan hipotesis: **lima deployment pertama (4–5 September 2026)
semuanya gagal** justru karena pengaturan ini kosong. Vercel menjalankan
`npm run build`, lalu mencari folder bernama `public` yang memang tidak
pernah dibuat, dan berhenti dengan `No Output Directory named "public"
found`.

> **`vercel.json` tidak boleh memuat properti di luar skema resmi.**
> Percobaan menaruh blok penjelasan bernama `_catatan` di dalamnya membuat
> deployment ditolak sebelum build sempat berjalan sama sekali:
> *"schema validation failed: should NOT have additional property"*.
> JSON tidak punya komentar — penjelasan apa pun ditulis di berkas ini,
> bukan di sana.

### Environment Variables yang wajib diisi

Di **Settings → Environment Variables** proyek Vercel, untuk ketiga
lingkungan (Production, Preview, Development):

| Nama | Isi |
|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` |
| `SUPABASE_ANON_KEY` | kunci `anon` (BUKAN `service_role`) |

Keduanya dibaca `tools/gen-config.js` saat build dan ditulis ke
`js/config.js`. Kunci `anon` memang dirancang aman dibaca browser — ia
dibatasi Row Level Security, bukan kerahasiaan.

**Kalau keduanya kosong, build tetap BERHASIL** tapi aplikasinya diam-diam
turun ke mode peraga tanpa login sungguhan. Ini pernah terjadi dan tidak
menimbulkan pesan gagal apa pun — jadi kalau login tiba-tiba tidak jalan di
produksi, dua nilai ini yang pertama diperiksa.

### Apa yang benar-benar terbit

`npm run build:dist` menyusun folder `dist/` lewat `tools/build-dist.js`, dan
hanya isi folder itu yang tersaji ke publik. Pendekatannya sengaja dibalik
dari `.assetsignore` milik Cloudflare: di sana setiap berkas baru otomatis
ikut terbit kecuali ada yang ingat mengecualikannya, di sini hanya yang
disebut yang ikut. Lupa mendaftarkan berkas baru berakibat berkas itu tidak
muncul di situs — kegagalan yang langsung kelihatan, bukan kebocoran senyap.

Yang tidak pernah ikut terbit: `.env`, seluruh `supabase/` (migrasi SQL
memuat 52 kebijakan keamanan), `tools/`, `tests/`, `docs/`, dan `server.js`.

### Header HTTP ada di dua tempat

Daftar header di `vercel.json` harus tetap sama isinya dengan berkas
`_headers` (dipakai Cloudflare Pages). Kalau salah satu diubah, ubah
keduanya. Yang paling mudah terlewat: `Service-Worker-Allowed: /` — tanpa
itu service worker tidak boleh mengendalikan seluruh situs, dan PWA-nya
berhenti bekerja di luar halaman utama.
