# Menerbitkan PERISA

> **Diperbarui 10 September 2026 (audit D18).** Versi sebelumnya menuntun
> pembaca ke **Cloudflare Pages** sebagai langkah 1–4, sementara Vercel
> baru muncul di bagian bawah — padahal produksi sudah berjalan di Vercel
> sejak 7 September. Siapa pun yang mengikuti dokumen itu dari atas akan
> menyiapkan penerbitan yang salah. Dokumen ini sekarang hanya menjelaskan
> jalan yang benar-benar dipakai.
>
> Tiga berkas sisa Cloudflare — `wrangler.jsonc`, `.assetsignore`, dan
> `_headers` — sudah **dihapus** dari repo. Ketiganya tidak dibaca apa pun
> lagi, dan `_headers` bahkan berbahaya: ia memuat salinan kedua daftar
> header keamanan, jadi seseorang bisa menambahkan aturan di sana dan
> mengira aturan itu berlaku. Kalau suatu hari perlu kembali ke Cloudflare,
> ambil dari riwayat git: `git show fe98c6d:_headers`.

---

## Ringkasan

| Bagian | Di mana | Dipicu oleh |
|---|---|---|
| Situs & aplikasi | **Vercel**, proyek `presentasiyayasan` | `git push origin main` |
| Basis data & RLS | **Supabase** (`supabase db push`) | manual |
| Edge Function | **Supabase** (`supabase functions deploy`) | manual |
| Cadangan, ringkasan mingguan, retensi, CI | **GitHub Actions** | jadwal & push |

---

## 1 — Situs (Vercel)

Setiap push ke `main` memicu penerbitan otomatis. Tidak ada langkah manual.

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
> JSON tidak punya komentar — penjelasan apa pun ditulis di berkas ini.

### Environment Variables di Vercel

**Settings → Environment Variables**, untuk ketiga lingkungan (Production,
Preview, Development):

| Nama | Isi | Kalau kosong |
|---|---|---|
| `SUPABASE_URL` | `https://<ref>.supabase.co` | build tetap sukses, aplikasi diam-diam turun ke mode peraga |
| `SUPABASE_ANON_KEY` | kunci `anon` (BUKAN `service_role`) | idem |
| `APP_ENV` | `production` | dianggap `production` (gagal tertutup) — aman, tapi isi eksplisit supaya terbaca |

Ketiganya dibaca `tools/gen-config.js` saat build dan ditulis ke
`js/config.js`. Kunci `anon` memang dirancang aman dibaca browser — ia
dibatasi Row Level Security, bukan kerahasiaan.

`APP_ENV` di sini adalah gerbang keamanan sisi klien: pada build produksi,
aplikasi menolak menampilkan/mengisikan kode OTP apa pun yang dikembalikan
server. Lihat audit K1.

### Header HTTP & CSP

Seluruh header ada di **satu tempat**: `vercel.json`. (Dulu ada dua; lihat
catatan di kepala dokumen ini.)

Content-Security-Policy ditambahkan pada audit 10 September 2026. Isinya
memuat origin Supabase, dan `npm run build` akan **menolak berjalan** kalau
origin di `vercel.json` tidak lagi cocok dengan `SUPABASE_URL` — lihat
`tools/periksa-csp.js`. Alasan `'unsafe-inline'` masih ada di sana juga
dijelaskan di berkas itu.

Yang paling mudah terlewat kalau header diedit: `Service-Worker-Allowed: /`
— tanpa itu service worker tidak boleh mengendalikan seluruh situs, dan
PWA-nya berhenti bekerja di luar halaman utama.

### Apa yang benar-benar terbit

`npm run build:dist` menyusun folder `dist/` lewat `tools/build-dist.js`,
dan hanya isi folder itu yang tersaji ke publik. Polanya sengaja terbalik
dari `.assetsignore` lama: di sana setiap berkas baru otomatis ikut terbit
kecuali ada yang ingat mengecualikannya, di sini **hanya yang disebut** yang
ikut. Lupa mendaftarkan berkas baru berakibat berkas itu tidak muncul di
situs — kegagalan yang langsung kelihatan, bukan kebocoran senyap.

Yang tidak pernah ikut terbit: `.env`, seluruh `supabase/` (migrasi SQL
memuat seluruh aturan keamanan), `tools/`, `tests/`, `docs/`, `server.js`,
dan `js/package.json`.

---

## 2 — Basis data (Supabase)

```bash
npx supabase db push --db-url "$SUPABASE_DB_URL"
```

Gunakan connection string **Session pooler (port 5432)**, bukan Transaction
pooler (6543).

> **Catatan 10 September 2026.** Tabel riwayat migrasi di produksi
> sebelumnya **KOSONG** — sebelas migrasi pertama dijalankan lewat jalur
> lain dan tidak pernah tercatat. Akibatnya `supabase db push` akan mencoba
> menjalankan ULANG semuanya. Riwayatnya sudah dibereskan dengan
> `supabase migration repair --status applied <versi>`, jadi push berikutnya
> hanya menjalankan migrasi yang benar-benar baru. **Selalu jalankan
> `--dry-run` lebih dulu** dan pastikan daftarnya masuk akal.

---

## 3 — Edge Function (Supabase)

```bash
npx supabase functions deploy
```

Setelan `verify_jwt` per fungsi ada di `supabase/config.toml` dan ikut
terbaca perintah di atas — tidak perlu bendera manual lagi.

### Secret Edge Function yang WAJIB diisi

**Dashboard Supabase → Edge Functions → Secrets**, atau:

```bash
npx supabase secrets set APP_ENV=production
```

| Nama | Wajib? | Akibat kalau kosong |
|---|---|---|
| `APP_ENV` | ya | dianggap `production` (aman), tapi isi eksplisit |
| `APP_JWT_SECRET` | ya | seluruh penerbitan & verifikasi sesi gagal |
| `ALLOWED_ORIGINS` | ya | **seluruh panggilan dari peramban ditolak 503** |
| `WA_GATEWAY_URL`, `WA_GATEWAY_TOKEN` | ya | **login mati total (503)** — lihat di bawah |
| `CRON_SECRET` | ya | ringkasan mingguan menolak dipicu |
| `ANTHROPIC_API_KEY` | opsional | Asisten AI menjawab 503, sisanya normal |
| `AI_DAILY_LIMIT_*` | opsional | memakai batas bawaan yang konservatif |

> ### URUTAN PENERBITAN ITU PENTING
>
> Sejak audit K1, gateway WhatsApp yang belum dikonfigurasi membuat
> permintaan OTP **ditolak**, bukan jatuh ke mode yang mengembalikan kode ke
> peramban. Itu perbaikan yang disengaja — mode lama berarti siapa pun yang
> tahu nomor WA seorang wali bisa masuk sebagai wali itu.
>
> Konsekuensinya: **jangan men-deploy Edge Function sebelum
> `WA_GATEWAY_URL` terisi**, atau tidak ada seorang pun yang bisa login.
>
> Urutan yang benar:
> 1. Isi seluruh secret di tabel atas (termasuk gateway WhatsApp).
> 2. `npx supabase db push` — migrasi lebih dulu.
> 3. `npx supabase functions deploy`.
> 4. `git push origin main` — frontend menyusul.
> 5. `npm run test:smoke` — harus 0 gagal, 0 dilewati.
>
> Langkah 2 mendahului 3 karena Edge Function baru memerlukan tabel
> `kuis_soal` dan fungsi `daftarkan_wali_dan_santri`. Langkah 4 menyusul 3
> karena kontrak kuis berubah: frontend baru bicara dengan Edge Function
> baru, dan keduanya tidak saling kompatibel dengan versi lama.

---

## 4 — GitHub Actions

Empat workflow. Tiga butuh secret/variable yang diisi sekali di
**Settings → Secrets and variables → Actions**.

| Workflow | Jadwal | Butuh |
|---|---|---|
| `ci.yml` | tiap push & PR | — (opsional: variable `SUPABASE_URL_PUBLIC` agar CSP ikut diperiksa) |
| `backup-database.yml` | harian 01.00 WIB | secret `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; sangat dianjurkan `BACKUP_ENCRYPTION_PASSPHRASE` |
| `ringkasan-mingguan.yml` | Minggu 19.00 WIB | secret `SUPABASE_URL`, `CRON_SECRET` |
| `retensi-data.yml` | Minggu 01.30 WIB | secret `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`; variable `RETENSI_*_HARI` |
| `uptime-check.yml` | tiap 30 menit | variable `SITE_URL`, `SUPABASE_URL_PUBLIC` |

Yang belum diisi **dilewati dengan peringatan**, bukan gagal senyap —
kecuali `retensi-data.yml`, yang sengaja tidak menghapus apa pun sampai
masa simpannya ditetapkan.

---

## 5 — Domain sendiri (boleh ditunda)

Alamat `*.vercel.app` sudah HTTPS dan bisa dipasang sebagai aplikasi di HP.
Domain sendiri (`perisa.or.id`, dsb.) hanya soal kesan resmi.

Setelah domain aktif di **Vercel → Settings → Domains**, ada **tiga tempat**
yang harus ikut diperbarui — melewatkan salah satunya membuat aplikasi rusak
dengan cara yang sulit ditebak:

1. `ALLOWED_ORIGINS` di Edge Function secrets → tambahkan origin barunya,
   kalau tidak seluruh panggilan dari domain baru ditolak CORS.
2. `PUBLIC_BASE_URL` di Environment Variables Vercel → QR verifikasi
   sertifikat menunjuk ke alamat lama kalau terlewat.
3. Variable `SITE_URL` di GitHub Actions → pemantauan ketersediaan tetap
   memeriksa alamat lama.

---

## 6 — Uji pemasangan di HP sungguhan

1. Buka alamat produksi di **Chrome Android** atau **Safari iOS**.
2. Menu → **Tambahkan ke Layar Utama**.
3. Buka dari ikon: harus tampil tanpa bilah alamat peramban.
4. Aktifkan mode pesawat, buka lagi: halaman luring PERISA harus muncul,
   bukan dinosaurus Chrome.
5. Cicit-perbesar (pinch-zoom) harus **bisa** — sejak audit M11 penguncian
   zoom sudah dilepas. Kalau tidak bisa, ada yang salah.

---

## Catatan tentang server Node

`server.js` hanya untuk pengembangan lokal (`npm start`). Vercel menyajikan
berkas statis langsung; tidak ada proses Node yang berjalan di produksi.
Seluruh logika sisi server ada di Edge Function Supabase.
