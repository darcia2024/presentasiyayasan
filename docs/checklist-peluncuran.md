# Checklist Sebelum Uji Coba Terbatas (Fase 8)

Status per 5 September 2026. Dikelompokkan: sudah beres, dan yang **perlu tindakan Anda** — bukan lagi soal kode.

## ✅ Sudah beres & teruji

- Login WhatsApp OTP (wali & staff), sesi bertahan lewat reload.
- Studio Kurikulum: modul/pelajaran/mufrodat/media/dokumen/video, alur draf→ditinjau→terbit.
- Kuis, XP, lencana, papan peringkat — dihitung di server, tidak bisa dicurangi dari peramban.
- Dashboard Wali + ringkasan mingguan otomatis ke WhatsApp.
- Panel Pengurus: pendaftaran wali/santri, kelas, infaq, laporan, sertifikat PDF+QR, verifikasi publik.
- Kepatuhan: persetujuan data wajib, log audit otomatis, hak penghapusan, kebijakan privasi publik.
- **Identitas sungguhan** (baru fase ini): sidebar/dropdown menampilkan nama santri/staff SUNGGUHAN, bukan lagi persona peraga "Ahmad Fauzan" dkk. Panel demo/simulasi disembunyikan total untuk sesi asli. Wali dengan >1 anak bisa berganti anak tanpa logout.

## ⚠️ Perlu tindakan ANDA sebelum onboarding keluarga sungguhan

1. **`git push origin main`** — commit Fase 7 & 8 masih tertahan di komputer ini (token tidak punya izin `workflow`). Jalankan dari terminal Anda sendiri.
2. **Isi 3 secret GitHub Actions** (repo → Settings → Secrets and variables → Actions): `SUPABASE_DB_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — lalu jalankan *Cadangan Basis Data PERISA* sekali manual (tab Actions → Run workflow) untuk konfirmasi cadangan harian benar-benar berjalan.
3. **Isi repository variable `SITE_URL`** (alamat situs produksi) — supaya pemantauan ketersediaan situs benar-benar memeriksa sesuatu.
4. **Baca ulang `kebijakan-privasi.html`** — belum ditinjau orang yang paham hukum. Sebelum benar-benar jadi pegangan resmi untuk keluarga sungguhan, ada baiknya diperiksa dulu.
5. **Coba pemulihan cadangan sekali sebagai latihan** (lihat `docs/pemulihan-bencana.md`) — belum pernah dijalankan sungguhan, cuma terverifikasi sebagian.
6. **Uji di HP kelas bawah & jaringan lambat** — santri SD kemungkinan besar memakai HP orang tua yang bukan model terbaru. Buka aplikasi di HP Android yang biasa dipakai di rumah, coba jaringan seluler biasa (bukan WiFi kencang kantor/rumah Anda).
7. **(Opsional) Asisten AI** — masih nonaktif menunggu `ANTHROPIC_API_KEY` dari Anda. Tidak menghalangi uji coba terbatas — bisa diaktifkan belakangan.
8. **(Opsional) Pemantauan error (Sentry)** — belum diaktifkan (butuh akun eksternal). Pemantauan ketersediaan dasar (poin 3) sudah cukup untuk tahu kalau situs jatuh; Sentry memberi detail error per-kejadian kalau nanti dirasa perlu.

## 🚀 Urutan yang disarankan untuk uji coba terbatas

1. Selesaikan poin 1–4 di atas.
2. Umi Elly menerbitkan **satu modul lengkap** (minimal beberapa mufrodat + gambar/audio) untuk SATU jenjang — cukup untuk santri pertama benar-benar belajar sesuatu.
3. Pengurus mendaftarkan **3-5 keluarga** yang sudah diberi tahu dan setuju jadi kelompok uji coba pertama (bukan seluruh santri yayasan sekaligus).
4. Dampingi keluarga pertama itu login & memakai aplikasi minimal sekali secara langsung (video call atau tatap muka) — banyak masalah kegunaan (usability) baru terlihat saat orang sungguhan mencoba, bukan dari membaca dokumen ini.
5. Kumpulkan masukan seminggu, perbaiki yang paling mengganggu, baru perluas ke lebih banyak keluarga.
