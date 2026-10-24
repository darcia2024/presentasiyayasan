# Peran Akun PERISA

**Keputusan pemilik, 24 Oktober 2026.** Hanya tiga jenis akun:

| Peran | Siapa | Dibuat oleh | Layar pertama sesudah login |
|---|---|---|---|
| **Super Admin** | Umi Elly, Prima (2 orang) | Pengembang, lewat `tools/daftarkan-akun-awal.js` | Dashboard Yayasan |
| **Guru / Pengajar** | 3 guru internal (+ guru mitra TPA bila ada) | Super Admin, dari **Panel → Guru → + Daftarkan Guru** | Dashboard Guru |
| **Wali** | Sesuai kebutuhan | Super Admin, dari **Panel → Santri & Wali** | Dashboard Wali |

Peran lama **`pengurus`** dilebur ke Super Admin oleh migrasi
`20261024000004_peran_superadmin.sql`. Sesudah migrasi itu, basis data hanya
menerima `superadmin` dan `pengajar`.

Akun Super Admin **sengaja tidak bisa dibuat dari Panel**: wewenangnya
mencakup data seluruh santri, jadi pembuatannya dilakukan sadar-sadar di luar
aplikasi. Edge Function `daftarkan-guru` selalu menulis peran `pengajar` —
tidak ada pilihan peran yang dikirim dari peramban.

Guru mitra (kategori `eksternal`) tetap ada: hanya melihat materi ajar, tidak
melihat santri, absensi, atau sertifikat walau ditugaskan ke kelas.

---

## Langkah menyalakan (urut)

Kode frontend aman diterbitkan **sebelum** langkah-langkah ini: selama
migrasi belum dijalankan, akun berperan `pengurus` tetap diperlakukan sebagai
Super Admin.

1. **Jalankan migrasi** `supabase/migrations/20261024000004_peran_superadmin.sql`
   di SQL Editor Supabase. Semua akun `pengurus` naik jadi `superadmin` dan
   tercatat di `audit_log` (`aksi = 'lebur_peran_pengurus'`).

2. **Terbitkan Edge Function baru** dan fungsi yang memakai pesan izin baru:

   ```bash
   supabase functions deploy daftarkan-guru
   supabase functions deploy daftarkan-wali-santri daftarkan-santri-kelas atur-kategori-guru terbitkan-sertifikat auth-atur-pin
   ```

3. **Buat akun Super Admin** untuk Umi Elly dan Prima (dijalankan dari mesin
   yang `.env`-nya berisi `SUPABASE_SERVICE_ROLE_KEY`; nomor & PIN diisi
   sendiri, jangan dikirim lewat chat):

   ```bash
   node tools/daftarkan-akun-awal.js staff 62812XXXXXXX "Umi Elly" --pin <PIN> superadmin
   node tools/daftarkan-akun-awal.js staff 62813XXXXXXX "Prima" --pin <PIN> superadmin
   ```

4. **Daftarkan 3 guru** — masuk sebagai Umi Elly atau Prima → Panel → tab
   **Guru** → **+ Daftarkan Guru**. Lalu tab **Kelas** → pilih pengajar tiap kelas.

5. **Nonaktifkan akun uji** setelah akun asli bisa dipakai (dinonaktifkan,
   bukan dihapus — riwayat pertemuan & audit tetap utuh):

   ```sql
   update staff set aktif = false
   where nama in ('Pengurus Uji Coba', 'Tester Pengurus');
   ```

   Akun pengajar yang sudah ada (**Ustazah Afida**, **Ustaz Rahman (Guru Mitra
   TPA Gorontalo)**) diputuskan satu per satu: kalau itu akun guru sungguhan,
   biarkan aktif dan hitung sebagai bagian dari 3 guru.
