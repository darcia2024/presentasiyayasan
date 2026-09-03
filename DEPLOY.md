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
