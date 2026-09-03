# Platform Pembelajaran Bahasa Arab Interaktif (SD - SMP - SMA) — PERISA Azhariyah

Website pitch deck presentasi interaktif dan proposal resmi penawaran **Platform Pembelajaran Bahasa Arab Interaktif Berbasis Game (Tingkat SD, SMP, & SMA)** asuhan **Umi Elly & Yayasan Peradaban Islam Azhariyah**.

---

## 🌟 Fitur Utama Platform Bahasa Arab PERISA

1. **Kurikulum Mufrodat Berjenjang: Dari Dasar Sampai Bisa Ngomong (SD, SMP, & SMA)**:
   - **Tahap 1 — Mufrodat Dasar**: Kosakata benda & tempat yang dipakai sehari-hari (rumah, sekolah, keluarga), lengkap dengan gambar dan pelafalan.
   - **Tahap 2 — Mufrodat Perkenalan & Sapaan**: Ta'aruf, salam, menanyakan kabar, dan frasa harian yang langsung bisa dipraktikkan.
   - **Tahap 3 — Muhadatsah Harian**: Merangkai mufrodat jadi kalimat utuh dan ngobrol untuk situasi harian di rumah, sekolah, dan pasar.
   - **Tahap 4 — Muhadatsah Bebas**: Roleplay dan bercerita tentang kegiatan sehari-hari sampai santri percaya diri berbicara.
2. **Game Edukasi & Gamifikasi Mufrodat**:
   - Mini-game bertingkat mengikuti tangga belajar: tebak arti mufrodat, membalas sapaan harian, dan menyusun kalimat sehari-hari, berhadiah poin XP & lencana bintang.
   - Mengubah kesan Bahasa Arab dari *"sulit dan membosankan"* menjadi **sangat menyenangkan, mudah dipahami, dan langsung terpakai untuk ngobrol**.
3. **Sistem Akses Terproteksi Berizin Umi Elly**:
   - Materi video eksklusif dilengkapi *Dynamic Floating Watermark* nama santri dan enkripsi anti-download.
   - Hak akses dibuka langsung oleh Umi Elly / yayasan, termasuk jalur khusus beasiswa gratis bagi santri dhuafa.
4. **Login WhatsApp Ramah Santri & Wali Murid**:
   - Akses instan tanpa perlu hafalan password yang rumit.
5. **Dashboard Pengurus Yayasan & Sertifikat Digital**:
   - Panel admin untuk memantau progres belajar santri, rekapitulasi infaq, dan penerbitan sertifikat resmi ber-QR Code.

---

## 🎨 Identitas Brand PERISA

- **Desain**: Material Design 3 — Dominan Putih (*Clean Editorial Light Theme*).
- **Warna Resmi PERISA**: Islamic Turquoise (`#008E82`) & Warm Gold (`#B38415`).
- **Tipografi**: *Plus Jakarta Sans*.

---

## 📱 Aplikasi Mobile (PWA Native) — `prototype.html`

Tampilan mobile `prototype.html` dibangun sebagai **Progressive Web App** yang bisa
dipasang ke layar utama dan dibuka dalam mode luring.

### Berkas PWA

| Berkas | Fungsi |
| --- | --- |
| `manifest.webmanifest` | Identitas aplikasi: nama, ikon, warna tema, mode `standalone`, orientasi potret, dan 4 pintasan (Belajar, Suara, Asisten, Silabus). |
| `sw.js` | Service worker. App shell di-*precache*; CSS/JS memakai *stale-while-revalidate*, gambar & font CDN *cache-first*, `/api/*` *network-first*. |
| `offline.html` | Halaman cadangan saat perangkat benar-benar terputus. |
| `prototype-mobile.css` | Seluruh tampilan native mobile. Aktif hanya pada `max-width: 768px`. |
| `prototype-mobile.js` | Perilaku native: boot splash, pull-to-refresh, gestur drawer, bottom sheet, haptik, prompt pemasangan. |
| `icons/` | 13 ikon aplikasi (termasuk *maskable*) + 13 layar peluncuran iOS. |

---

## 🧩 Struktur Kode Aplikasi Santri

Logika aplikasi dipecah menjadi modul ES. Tidak ada langkah *build* — browser
memuat modulnya langsung.

| Berkas | Isi |
| --- | --- |
| `js/app.js` | Titik masuk. Merakit modul dan memasang `window.PrototypeApp`. |
| `js/data/roles.js` | Data peran **dan silabus lengkap per jenjang** (SD, SMP, SMA, Pengurus). |
| `js/data/documents.js` | Isi dokumen perpustakaan digital. |
| `js/core/feedback.js` | Nada sintetis Web Audio dan notifikasi toast. |
| `js/core/speech.js` | Mesin pelafalan Arab (Web Speech API `ar-SA`). |
| `js/ui/syllabus.js` | Render akordeon silabus dari data. |
| `js/ui/role.js` | Pergantian peran akun. |
| `js/ui/router.js` | Router lima tampilan utama + tab bar bawah. |
| `js/ui/course.js` | Pemutar materi dan sub-tab modul. |
| `js/ui/library.js` | Filter perpustakaan dan pembaca dokumen. |
| `js/ui/assistant.js` | Studio Asisten Bahasa Arab. |
| `js/ui/shell.js` | Drawer, dropdown profil, modal piagam. |
| `tools/stamp-version.js` | Pencap versi otomatis untuk `?v=` dan `SW_VERSION`. |
| `tools/build-icons.js` | Menyusun CSS ikon hanya dari ikon yang benar-benar dipakai. |
| `tools/fetch-fonts.js` | Mengunduh font ke repo. Butuh jaringan, jarang dijalankan. |
| `tools/env.js` | Pembaca `.env` tanpa paket pihak ketiga. |

**Dua aturan yang tidak boleh dilanggar:**

1. **Struktur silabus hanya ditulis di `js/data/roles.js`**, tidak pernah
   langsung di `prototype.html`. Sebelumnya akordeon ditulis keras di HTML
   sebagai materi SMP, sehingga santri SD ikut melihat kaidah Shorof SMA di
   silabusnya sendiri.
2. **Urutan dua tag skrip di `prototype.html` jangan ditukar.**
   `prototype-mobile.js` membungkus ulang lima metode `PrototypeApp` saat boot,
   dan itu hanya bekerja bila modul ES sudah selesai dieksekusi lebih dulu.

---

## 🔌 Tanpa Ketergantungan Layanan Luar

Seluruh font dan ikon disajikan dari dalam repo (`vendor/`). Aplikasi tidak
memuat satu pun berkas dari `fonts.googleapis.com` maupun `unpkg.com`.

Sebelumnya tiga stylesheet ikon dimuat dari CDN — dua di antaranya (`fill` dan
`bold`) tidak pernah dipakai sama sekali. Kalau CDN-nya tidak terjangkau,
santri mendapat tampilan tanpa satu pun ikon, dan service worker tidak menolong
karena berkas yang belum pernah berhasil dimuat tidak akan pernah tersimpan.
Untuk santri SD dengan HP dan kuota seadanya, itu kejadian biasa.

| Berkas | Isi |
| --- | --- |
| `vendor/fonts/` | 16 berkas font Amiri & Plus Jakarta Sans + `fonts.css` (dihasilkan). |
| `vendor/phosphor/Phosphor.woff2` | Font ikon, varian reguler saja. |
| `vendor/phosphor/phosphor.css` | **Dihasilkan** — hanya ikon yang benar-benar dipakai (88 dari 1.512, 5 KB dari 76 KB). |
| `vendor/phosphor/_upstream.css` | Salinan sumber, agar build tidak pernah butuh jaringan. |

`npm run stamp` menjalankan penyusun ikon otomatis, jadi **menambah ikon baru di
markup tidak menuntut langkah manual apa pun**. Kalau nama kelas ikonnya salah
ketik, build gagal dengan pesan jelas — bukan diam-diam tampil kosong.

Menambah bobot font baru butuh `npm run fonts` (satu-satunya perintah yang
memerlukan jaringan).

---

## ⚙️ Konfigurasi Lingkungan

```bash
cp .env.example .env
```

`.env` tidak pernah masuk repo. Seluruh variabel untuk fase berikutnya sudah
terdaftar di `.env.example` beserta keterangannya.

> Kunci `SUPABASE_SERVICE_ROLE_KEY` dan `ANTHROPIC_API_KEY` tidak boleh pernah
> masuk ke berkas mana pun di dalam `js/` — seluruh isi folder itu terkirim apa
> adanya ke browser santri.

---

## 🌐 Menerbitkan ke HTTPS

Lihat **[DEPLOY.md](DEPLOY.md)** untuk panduan lengkap Cloudflare Pages,
pemasangan di HP, dan domain yayasan.

### Fitur Native

- **Dapat dipasang** — banner "Pasang Aplikasi PERISA" (Android/Chrome), dengan panduan manual untuk Safari iOS.
- **Luring penuh** — materi yang pernah dibuka tetap bisa diakses tanpa jaringan.
- **App bar kolaps** — judul besar menyusut ke bilah atas saat digulir.
- **Tab bar bawah** dengan tombol tengah terangkat dan area aman (*safe area*) perangkat berponi.
- **Bottom sheet** untuk piagam dan pembaca dokumen, lengkap dengan gestur seret-untuk-menutup.
- **Gestur drawer** — geser dari tepi kiri untuk membuka, geser balik untuk menutup.
- **Pull-to-refresh** yang menarik data XP dan peringkat santri langsung dari `GET /api/game/leaderboard`.
- **Tombol kembali perangkat** menutup lapisan teratas (drawer / sheet) sebelum meninggalkan halaman.
- **Haptik** pada aksi penting, serta dukungan `prefers-reduced-motion`.

### Menerbitkan Perubahan

Cukup satu perintah:

```bash
npm run release:patch
```

Perintah itu menaikkan `version` di `package.json`, lalu mengecap ulang seluruh
parameter `?v=`, `SW_VERSION`, dan daftar app shell di `sw.js` secara otomatis.
Pengguna menerima pemberitahuan "Pembaruan aplikasi tersedia" dan aplikasi
memuat ulang dengan versi terbaru.

> **Jangan menyunting `?v=` atau `SW_VERSION` dengan tangan.** Satu-satunya
> sumber kebenaran adalah `version` di `package.json`. Sebelumnya setiap rilis
> menuntut lima suntingan manual, dan satu saja yang terlewat membuat service
> worker menyajikan campuran berkas lama dan baru — kondisi yang tersimpan di
> cache perangkat dan sulit dilepas pengguna sendiri.

Perintah lain:

| Perintah | Fungsi |
| --- | --- |
| `npm start` | Mengecap versi lalu menyalakan server. |
| `npm run stamp` | Mengecap ulang versi tanpa menaikkannya. |
| `npm test` | Memeriksa sintaks dan memastikan semua berkas app shell benar-benar ada. |
| `npm run release:minor` | Menaikkan versi minor lalu mengecap ulang. |

> **Catatan:** service worker hanya berjalan di `http://localhost` atau HTTPS.
> Membuka berkas lewat `file://` akan melewati seluruh fitur PWA.

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
npm start
```

Lalu buka:

- `http://localhost:3020/prototype.html` — aplikasi santri (PWA mobile + dashboard desktop)
- `http://localhost:3020/index.html` — pitch deck paparan
- `http://localhost:3020/game2d.html` — simulasi percakapan suara

> Gunakan `server.js`, bukan `python -m http.server`. Server Node menyajikan
> `manifest.webmanifest` dengan tipe MIME yang benar dan mengirim header
> `Service-Worker-Allowed` yang dibutuhkan agar PWA dapat dipasang.

---

Dibuat untuk Yayasan Peradaban Islam Azhariyah — Asuhan Umi Elly.
