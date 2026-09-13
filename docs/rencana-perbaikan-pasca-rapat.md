# Rencana Perbaikan Pasca-Rapat Tim PERISA

**Sumber:** rapat AIGYPT 5 × Rahmadi Prima, 12 September 2026 (demo LMS sebelum
presentasi ke Umi Elly).
**Status dokumen:** rencana kerja, belum dieksekusi.

---

## 1. Pergeseran inti yang terjadi di rapat ini

Platform ini dibangun dengan asumsi **wali-dan-santri lebih dulu** — akun milik
wali, santri belajar mandiri, gamifikasi mendorong retensi. Rapat 12 September
membalik urutannya: **fase awal hanya untuk guru.** Kelas online belum dibuka,
dashboard wali dan santri dikunci, dan yang dipakai sehari-hari adalah guru
memproyeksikan PPT di depan kelas lalu mencatat laporan pertemuan.

Ini bukan penolakan terhadap yang sudah dibangun — kelas online tetap jadi arah
jangka panjang. Tapi urutan pengerjaannya berubah, dan beberapa bagian yang
sudah jadi harus **diparkir, bukan dibuang** (lihat bagian 8).

Satu keputusan lain yang pengaruhnya paling dalam ke data: pembelajarannya
**verbal, tanpa menulis, tanpa harokat**, dan akhir kata **disukunkan** — "bukan
*Wahidun*, kita baca *Wahid*". Konten contoh yang sekarang ada di basis data
justru kebalikannya.

---

## 2. Fase A — Amankan demo sebelum Zoom dengan Umi Elly

Tujuan fase ini sempit dan spesifik: **tidak ada satu pun hal janggal yang
terlihat Umi saat demo.** Semuanya perubahan kecil, tidak ada yang menyentuh
arsitektur.

### A1. Perbaiki konten mufrodat yang melanggar filosofi — PRIORITAS TERTINGGI

Isi basis data sekarang (`tools/seed-kurikulum-sd.js`, baris 88+):

```
كِتَابٌ   | Kitaabun   | Buku
حَقِيبَةٌ  | Haqiibatun | Tas sekolah
```

Harokat penuh, tanwin di akhir, dan transliterasinya ditulis `-un`. Persis yang
dinyatakan tidak dipakai. Ada dua tingkat perbaikan, dan keduanya perlu
dipisahkan karena tingkat kepastiannya berbeda:

| | Perubahan | Dasar | Kepastian |
|---|---|---|---|
| **A1a** | Akhiran disukunkan: `Kitaabun` → `Kitaab`, `Haqiibatun` → `Haqiibah` | Dinyatakan eksplisit di rapat | **Pasti** — kerjakan sekarang |
| **A1b** | Hapus seluruh harokat dari teks Arab: `كِتَابٌ` → `كتاب` | "tulisannya tidak kita kasih harokat" | **Perlu konfirmasi Umi** (lihat 10.1) |

Kerjakan A1a lebih dulu. A1b ditahan sampai Umi mengonfirmasi, karena "tanpa
harokat" bisa berarti tanpa *tanwin/i'rab* saja atau benar-benar polos, dan
salah tebak di sini bikin seluruh konten harus diulang dua kali.

`contoh_kalimat` juga kena aturan yang sama.

**Ukuran:** kecil. **Berkas:** `tools/seed-kurikulum-sd.js` + satu skrip
pembaruan baris `mufrodat` yang sudah terlanjur masuk basis data.

### A2. Kunci jenjang SMP dan SMA

Belum ada pembelajarannya. Disembunyikan dari navigasi dan pemilih jenjang,
bukan dihapus dari skema — tinggal dibuka kalau materinya sudah ada.

**Ukuran:** kecil. **Berkas:** `js/ui/jenjang.js`, `js/ui/shell.js`.

### A3. Kunci Dashboard Wali dan Dashboard Santri

Pembelajaran online belum dipikirkan, jadi keduanya tidak boleh muncul di demo.
Kode tetap ada, hanya tidak dapat dijangkau dari navigasi.

**Ukuran:** kecil. **Berkas:** `js/ui/router.js`, `js/ui/shell.js`.

### A4. Ubah posisi "Modul & Silabus PDF"

Tetap ditampilkan, tapi sebagai **gambaran materi yang dipelajari**, bukan
dokumen yang bisa diunduh. Hilangkan seluruh jalur unduh.

**Ukuran:** kecil. **Berkas:** `js/ui/library.js`, `js/ui/dokumen-viewer.js`.

### A5. Sembunyikan menu yang kontennya ada di buku fisik

"Latihan & Evaluasi" ternyata ada di buku latihan cetak, satu paket dengan buku
pembelajaran. Menu di LMS disembunyikan dulu sampai bentuk digitalnya diputuskan.

**Ukuran:** kecil.

---

## 3. Fase B — Fondasi guru-first — **B1 & B2 SELESAI 13 Sep 2026**

Struktur data dan hak akses supaya guru bisa jadi pengguna utama.

### B1. `santri.wali_id` dilonggarkan jadi boleh kosong — SELESAI

Sekarang `not null references wali(id)`. Di fase ini wali tidak dipakai sama
sekali, sementara guru harus memasukkan sekitar 25 anak per kelas (Ustazah Afida
saja memegang 3 kelas ≈ 75 anak). Tanpa perubahan ini, setiap anak menuntut satu
baris wali kosong lebih dulu — kerja sia-sia sekaligus data sampah yang nanti
sulit dibersihkan saat wali sungguhan mulai didaftarkan.

**Yang dikerjakan:**

- `supabase/migrations/20260913000002_santri_tanpa_wali.sql` — kolom dilonggarkan
  + fungsi `daftarkan_santri_kelas(kelas, santri[], aktor)`. Jenjang diambil **dari
  kelasnya**, bukan dari pemanggil. Satu transaksi, dan nama yang sudah ada di
  kelas itu dilaporkan `sudah_ada` alih-alih dibuat dua kali.
- `supabase/functions/daftarkan-santri-kelas/` — Edge Function, khusus
  pengurus/superadmin lewat `periksaStaffAktif()` (tabel `staff`, bukan klaim JWT).
- Panel Pengurus → tab **Kelas** → tombol **"+ Daftarkan Santri"** per kelas: satu
  kotak teks, satu nama per baris. Pengurus menempelkan daftar absen yang sudah
  ada, bukan mengisi formulir 25 kali.

**Kebijakan RLS wali tidak perlu disunting.** `santri_select_wali` memakai
`wali_id = auth.uid()`; di SQL `NULL = <uuid>` bernilai NULL (bukan true), jadi
santri tanpa wali otomatis tidak terlihat wali mana pun — persis yang diinginkan.

### B2. Kategori guru: internal vs eksternal — SELESAI

Tambah kolom pada `staff` (mis. `kategori text check in ('internal','eksternal')`).

- **Internal** — direkrut langsung, alumni Timur Tengah, saat ini 4 orang.
  Fitur penuh: data murid, laporan pertemuan, game.
- **Eksternal** — guru TPA hasil kerja sama Pemda Gorontalo (pelatihan Desember).
  **Hanya akses PPT.** Tidak melihat data murid, tidak mengisi laporan.

**Yang dikerjakan:** `supabase/migrations/20260913000003_kategori_guru.sql`.

Penjagaannya ditaruh di **satu titik** — fungsi `auth_kelas_diampu()`, yang
dipakai belasan kebijakan RLS (santri, sertifikat, xp_log, santri_lencana,
progres_santri, kuis_soal, pertemuan, absensi). Guru eksternal selalu
mengembalikan himpunan kosong, jadi semuanya ikut tertutup sekaligus.
Alternatifnya — menyunting sembilan kebijakan satu per satu — akan membuat
kebijakan kesepuluh yang ditulis bulan depan lupa ikut diperketat.

Dibuktikan lewat uji asap (`npm run test:smoke`), bukan diasumsikan. Seorang
pengajar yang **tetap ditugaskan kelasnya** dibalik kategorinya, lalu dibalik
lagi:

| | kelas | santri | pertemuan | absensi | sertifikat | **modul** |
|---|---|---|---|---|---|---|
| internal | 1 | 2 | ✓ | ✓ | ✓ | **1** |
| eksternal | 0 | 0 | 0 | 0 | 0 | **1** |

Kolom terakhir yang penting: materi ajar **tetap terbuka**. Itu seluruh alasan
akun guru mitra ada.

**Pengelolaannya di Panel Pengurus** (ditambahkan 13 Sep, menutup dua sisa B2):

- Tab **Guru** baru — daftar staff, dan kategori pengajar bisa diubah di sana.
  Lewat Edge Function `atur-kategori-guru`, **bukan** kebijakan RLS: RLS
  menyaring BARIS, sedangkan batas yang dibutuhkan di sini adalah batas KOLOM.
  Membuka `update staff` untuk `auth_is_admin()` akan sekaligus membuka kolom
  `peran` — cukup satu permintaan REST dari console peramban untuk seorang
  pengurus menaikkan dirinya jadi superadmin. Di fungsinya, kolomnya ditulis
  mati: hanya `kategori`, nilainya hanya dua, dan nama kolom tidak pernah
  datang dari pemanggil.
- Tab **Kelas** — tiap kelas punya pemilih pengajar. Ini **lewat RLS biasa**
  (`kelas_update_admin` sudah ada, dan `trg_audit_kelas` sudah mencatatnya
  sendiri); menambah Edge Function di sini hanya menduplikasi keduanya.
  Kategori ditulis di label pilihannya, dan guru mitra yang terpilih memunculkan
  peringatan bahwa kelas itu tetap tidak akan tampil di dashboard-nya — batas
  yang disengaja harus terbaca sebagai disengaja, bukan sebagai aplikasi rusak.

Perubahan kategori dicatat ke `audit_log` secara eksplisit, karena tabel `staff`
— tidak seperti santri/kelas/infaq — tidak punya trigger audit.

Sepuluh pemeriksaan tambahan di uji asap, semuanya tentang yang TIDAK boleh:
pengajar mengubah kategorinya sendiri (403), wali (403), tanpa sesi (401),
kategori untuk pengurus (400), nilai ngawur (400), dan kolom selundupan
(`peran`/`aktif` dikirim bersama `kategori`) yang harus diabaikan. Pencabutannya
terbukti berlaku **seketika dengan token yang sama**, bukan menunggu JWT lama
kedaluwarsa.

**Masih menganggur:** pembuatan akun staff tetap lewat
`node tools/daftarkan-akun-awal.js` — sengaja, karena membuat staff berarti
menetapkan PERAN, dan itu keputusan yang pantas dilakukan sadar-sadar, bukan
lewat formulir yang bisa terklik di sela pekerjaan lain.

### B3. Petakan ulang struktur kurikulum ke model 12 buku — BELUM

Model sekarang `jenjang → modul → pelajaran` ternyata **sudah cocok**, tinggal
diganti penamaannya dan diisi:

| Rapat | Skema sekarang |
|---|---|
| Buku 1–12 (satu per semester, kelas 1–6 SD) | `modul` (12 baris, jenjang `sd`) |
| 5 bab per buku | `pelajaran` (5 per modul) |
| 1 PPT per bab → total 60 PPT | `pelajaran.ppt_path` — **sudah ada sejak 13 Sep** |

Tidak perlu bongkar skema, cukup penyesuaian label di antarmuka dan pengisian data.

**KEPUTUSAN 13 Sep — isinya bukan pekerjaan kita.** Umi Elly mengunggah materinya
sendiri; yang disiapkan adalah platformnya. Konsekuensinya untuk B3: **tidak ada
kerangka 12 modul × 5 bab yang dibuat lebih dulu.** Kerangka berisi judul tebakan
adalah data sampah yang harus dibongkar begitu buku aslinya masuk, dan selama
belum dibongkar ia tidak bisa dibedakan dari materi sungguhan. Modul dan bab
dibuat Umi lewat Studio Kurikulum, satu per satu, seiring materinya siap.

Yang tersisa untuk B3 karena itu tinggal **penamaan di antarmuka** (Modul → Buku,
Pelajaran → Bab), dan itu baru layak dikerjakan setelah terlihat bagaimana Umi
sungguhan menamai bukunya.

**Ukuran:** kecil.

---

## 4. Fase C — Pipeline PPT (menggantikan PDF)

> **Tahap 1 SELESAI 13 Sep 2026 — jalur unggahnya hidup.**
>
> `supabase/migrations/20260913000004_ppt_pelajaran.sql` + Edge Function
> `ppt-signed-url` + bidang unggah di Studio Kurikulum + tombol **PPT** di
> silabus. Umi sudah bisa mengunggah, guru sudah bisa membuka.
>
> **Bucket PRIVAT, bukan publik — dan itu keputusan pentingnya.** Butir 10.2
> (guru eksternal boleh mengunduh atau tidak?) belum dijawab. Bucket privat
> membuat kedua jawaban tetap terbuka: kalau boleh, URL bertanda tangan itu
> sendiri sudah jadi tautan unduhnya; kalau tidak boleh, penyimpanan privat
> adalah syarat untuk pemutar sisi-server mana pun, dan pemutarnya ditambahkan
> tanpa memindahkan satu berkas pun. Kalau PPT ditaruh di bucket publik seperti
> PDF, jawaban "tidak boleh" berarti memindahkan 60 berkas sekaligus mengubah
> setiap URL yang sudah tersimpan.
>
> **Siapa yang boleh:** seluruh staff, **termasuk guru mitra** — itu seluruh
> alasan akun mereka ada. Wali dan santri **tidak**: PPT adalah bahan yang
> diproyeksikan guru, santri memegang buku cetak. Dibuktikan di uji asap, bukan
> diasumsikan (sembilan pemeriksaan; 59 → 68 lulus).
>
> Yang **belum** dikerjakan dari Fase C: konversi/pemutar dalam aplikasi. Itu
> baru bisa dirancang setelah 10.2 dijawab dan setelah PPT asli buku 1 bab 1
> diterima (penghalang #1 di bagian 9).

Bagian paling berisiko di seluruh rencana ini, karena ada dua permintaan yang
saling menarik:

1. **Animasi PPT harus hidup** — "tik-tik-tik muncul, fading keluar, itu penting
   banget buat pembelajaran kita". PDF ditolak justru karena tidak bisa ini.
2. **Guru eksternal hanya boleh memakai, tidak memegang** — Umi ketat soal berkas
   PPT, dan hanya super admin yang boleh mengganti.

Artinya guru harus bisa **menjalankan** PPT tanpa pernah **memiliki** berkasnya.

### Pilihan yang tersedia

| Pendekatan | Animasi | Berkas aman dari guru | Catatan |
|---|---|---|---|
| **Render server-side jadi bingkai per langkah animasi** (LibreOffice headless) | Jadi "next-next" diskrit | Ya | Paling cocok dengan semua batasan. **Kesetiaannya wajib diuji dengan PPT asli** |
| Sematkan Office Online / Google Slides | Hidup penuh | Tidak — berkas menumpang layanan luar | Kontrol lepas dari yayasan; sulit diterima kalau Umi ketat |
| Konversi ke PDF biasa | Mati | Ya | **Ditolak eksplisit di rapat** |
| Guru mengunduh, buka di PowerPoint | Sempurna | Tidak | Berkas menyebar |

**Rekomendasi:** tempuh pendekatan pertama, tapi **jangan bangun apa pun sebelum
menguji konversi memakai PPT buku 1 bab 1 yang asli.** Permintaan berkas itu di
rapat disebut untuk "menyesuaikan tampilan" — sebenarnya taruhannya lebih besar:
kalau animasi Umi tidak selamat melewati konversi, seluruh pendekatan ini gugur
dan arsitekturnya harus dipilih ulang. Uji ini murah dan harus dilakukan duluan.

### Pekerjaan setelah uji lolos

- **C1 — SELESAI 13 Sep.** Materi PPT menempel ke `pelajaran`
  (`ppt_path`/`ppt_nama`/`ppt_ukuran_bytes`/`ppt_diunggah_pada`), bukan lagi ke
  tabel `dokumen` yang berorientasi PDF. Tabel lamanya belum dibuang — itu C4.
- **C2 — SELESAI 14 Sep.** Layar **Materi PPT** di Studio Kurikulum: seluruh
  bab satu jenjang dalam satu daftar, satu baris per bab, berkas bisa
  **diseret langsung ke barisnya**. Kepala layar menghitung "x dari y bab sudah
  ada materinya" — satu-satunya pertanyaan yang Umi punya tiap kali membukanya.

  Jalur unggah sebelumnya menuntut lima langkah untuk SATU bab dan tidak pernah
  menjawab "yang mana yang belum". Dikali 60 bab, itu bukan ketidaknyamanan —
  itu alasan pengisian materi berhenti di tengah jalan.

  **Progres unggahan ditampilkan.** supabase-js tidak menyediakan callback
  progres sama sekali, jadi unggahannya dikirim lewat XMLHttpRequest. Berkas
  200 MB di jaringan sekolah bisa lima menit tanpa tanda kehidupan, dan layar
  yang diam lima menit dibaca sebagai "hang" lalu ditutup.
- **C3 — BELUM. Kini WAJIB, bukan pilihan.** Pemutar PPT dalam aplikasi
  (maju-mundur per langkah, layar penuh). Butir 10.2 dijawab 14 Sep — *"guru
  mitra hanya bisa melihat"* — dan itu menghapus satu-satunya jalan murah:
  membiarkan guru mengunduh dan membukanya di PowerPoint.

  Sejak 14 Sep, guru mitra **ditolak** mengunduh berkas (`MITRA_TANPA_UNDUH`),
  jadi sampai pemutar ini ada mereka tidak punya akses materi sama sekali.

  Sisa penghalangnya tinggal satu: **PPT asli buku 1 bab 1**. Pertanyaannya
  bukan lagi "boleh unduh atau tidak", melainkan "apakah animasi Umi selamat
  melewati konversi" — kalau tidak, seluruh pendekatan render server-side gugur
  dan arsitekturnya harus dipilih ulang. Uji itu murah dan harus duluan.
- **C4 — BELUM.** Hapus jalur input dan tampilan PDF lama (tabel `dokumen`,
  menu "Modul & Silabus PDF"). Ditunda sampai terlihat Umi benar-benar memakai
  jalur PPT; membuang jalur lama sebelum penggantinya terbukti dipakai berarti
  tidak ada tempat kembali kalau ada yang tidak cocok.

**Ukuran sisa:** C3 besar dan terhalang; C4 kecil.

---

## 5. Fase D — Dashboard guru & laporan pertemuan

> **Status: SELESAI, 13 September 2026.** Migrasi
> `20260913000001_pertemuan_guru.sql`, `js/core/guru-client.js`, dan
> `js/ui/guru-dashboard.js`. Bentuk formulirnya disusun dari gambaran di
> rapat karena salinan catatan manual belum diterima — begitu contohnya
> datang, kolomnya tinggal disesuaikan (lihat catatan di bawah).

Ini **bangunan paling besar yang benar-benar baru** — sekarang tidak ada
sama sekali (`js/ui/` tidak punya modul guru).

Alur yang diminta: guru mengisi per pertemuan, per kelas.

- **D1** — Daftar kelas yang diampu guru. Skema sudah mendukung lewat
  `kelas.pengajar_id`, jadi tinggal dipakai.
- **D2** — Absensi per pertemuan.
- **D3** — Formulir laporan pertemuan, menggantikan catatan manual yang dipakai
  sekarang. Isinya: evaluasi hari itu, cakupan pembelajaran (dari mana sampai
  mana), dan catatan bebas per anak (opsional — "si A sudah lancar, si B masih
  kendala, si C berantem sama temannya").

Bentuk formulirnya **menunggu salinan catatan manual** dari Prima supaya
strukturnya mengikuti kebiasaan guru yang sudah berjalan, bukan tebakan.

**Ukuran:** besar. **Terhalang sebagian** — rancangan formulir menunggu contoh.

---

## 6. Fase E — Game interaktif kelas

Bukan game individual untuk belajar mandiri. Yang diminta: **dimainkan bersama
di depan kelas, dipandu guru.**

- **3 tema**, isinya tinggal diisi nama-nama/kosakata dari materi.
- Dipakai sebagai selingan, sekitar 2–3 kali sebulan.
- Kelas bawah (1–2) butuh porsi game lebih banyak dibanding materi.

Materinya menunggu foto buku dan halaman dari Prima.

**Ukuran:** sedang. **Terhalang** foto buku.

---

## 7. Fase F — Sertifikat per level

Sekarang sertifikat terbit sekali per santri. Yang diminta: **per level**, 12
level, disamakan dengan sertifikasi berjenjang seperti IELTS.

Perlu penyesuaian `sertifikat` supaya menyimpan level, dan kondisi kelulusan per
level. Baru relevan setelah pembelajaran berjalan dan ada yang menyelesaikan
satu buku penuh — jadi **paling akhir**.

**Ukuran:** sedang.

---

## 8. Yang diparkir — jangan dihapus

Semua ini sudah jadi, teruji, dan aman. Tidak dipakai di fase guru-first, tapi
akan langsung terpakai begitu kelas online dibuka:

- Mesin gamifikasi: XP, lencana, papan peringkat
- Kuis otoritatif server (`kuis-soal` + `submit-jawaban`) — termasuk perbaikan
  kecurangan K2 yang baru dipasang
- Dashboard wali, ringkasan mingguan WhatsApp ke wali
- Dashboard santri

**Cara memarkir:** sembunyikan dari navigasi dan kunci jalurnya. Jangan hapus
tabel, Edge Function, maupun ujinya — biaya menghidupkan kembali nanti jauh
lebih mahal daripada biaya membiarkannya diam.

---

## 9. Yang ditunggu dari tim PERISA (penghalang nyata)

Tanpa keempat ini, fase C, D, dan E tidak bisa jalan:

| # | Yang dibutuhkan | Menghalangi | Kenapa mendesak |
|---|---|---|---|
| 1 | **PPT asli buku 1 bab 1** | Fase C3 — dan kini juga AKSES GURU MITRA | Satu-satunya penghalang C3 yang tersisa sejak 10.2 dijawab. Tanpa ini, guru mitra tidak punya akses materi sama sekali |
| 2 | **Salinan catatan/absen manual guru** | Penyesuaian Fase D | Fase D sudah dibangun dari gambaran di rapat; contohnya dipakai untuk mencocokkan kolom, bukan lagi penghalang mulai |
| 3 | **Foto buku + halaman materi** | Fase E, dan pengisian gambaran materi | Sumber isi game dan daftar materi |
| ~~4~~ | ~~Jawaban soal unduh PPT guru eksternal~~ | — | **TERJAWAB 14 Sep: hanya boleh melihat.** Lihat 10.2 |

---

## 10. Keputusan yang butuh jawaban Umi / Prima

### 10.1 Seberapa jauh "tanpa harokat"?

Teks Arab dibiarkan polos (`كتاب`), atau harokat dalam kata tetap ada dan yang
dibuang hanya tanwin/akhiran (`كِتَاب`)? Menentukan seluruh 60 PPT dan seluruh
data mufrodat. Salah tebak = kerja ulang total.

### 10.2 Guru eksternal boleh mengunduh PPT atau tidak? — **TERJAWAB 14 Sep 2026**

> **"Guru mitra hanya bisa melihat."**

Artinya jalur mahal yang diambil: harus ada pemutar dalam aplikasi, dan
animasinya bergantung pada kesetiaan konversi.

**Sudah ditegakkan (14 Sep).** `ppt-signed-url` menolak sesi berkategori
`eksternal` dengan kode `MITRA_TANPA_UNDUH`. Endpoint itu gunanya menyerahkan
BERKAS, jadi bagi mitra jawabannya tidak — titik. Menghilangkan `download` dari
signed URL tidak cukup: peramban tetap mengunduh `.pptx` karena tidak bisa
merendernya inline, jadi "inline" di situ hanyalah unduhan dengan nama yang
lebih jelek. Dijaga uji asap (69 → 70), dan tesnya sengaja merupakan
PEMBALIKAN dari tes sebelumnya supaya pelonggaran diam-diam ketahuan.

Ditutup sekarang, bukan nanti, karena belum ada satu pun guru mitra sungguhan —
alasan yang sama dengan migrasi 20260913000003. Membuka dulu lalu menutup
setelah 60 berkas tersebar bukan langkah yang bisa diambil kembali.

**KONSEKUENSI YANG HARUS DISADARI:** sampai pemutar C3 ada, guru mitra **tidak
punya akses materi sama sekali**. Itu harga langsung dari aturan ini. Kalau
yayasan ingin mereka bisa mulai lebih awal, jalan tercepat adalah Umi mengunggah
ekspor PDF di samping PPT-nya — repo sudah punya pembaca PDF tanpa tombol unduh
(`js/ui/dokumen-viewer.js`, iframe `#toolbar=0&navpanes=0`; pencegahan wajar,
bukan jaminan mutlak).

**Yang masih menghalangi C3:** PPT asli buku 1 bab 1 (penghalang #1 di bagian 9).
Pertanyaannya bukan lagi "boleh unduh atau tidak", melainkan "apakah animasi Umi
selamat melewati konversi" — dan itu hanya bisa dijawab dengan berkas aslinya.

### 10.3 Ujian akhir semester masuk LMS atau tetap di buku?

Rapat menyebut 5 bulan belajar + 1 bulan ujian, tapi latihan dan evaluasi ada di
buku cetak. Perlu kepastian apakah ujian dicatat di LMS (untuk mengisi laporan
dan syarat sertifikat per level) atau tidak disentuh sama sekali.

### 10.4 Rekaman suara siapa untuk pelafalan?

Sudah didukung teknis (`mufrodat.audio_url`, dengan TTS sebagai cadangan). Yang
belum: siapa yang merekam dan kapan.

---

## 11. Urutan pengerjaan yang disarankan

1. **Fase A** — sekarang, sebelum Zoom. Kecil semua, tapi menghilangkan seluruh
   hal janggal yang akan terlihat Umi.
2. **Ajukan pertanyaan 10.1 dan 10.2 di Zoom yang sama**, sekalian minta keempat
   berkas di bagian 9.
3. **Uji konversi PPT** begitu berkas buku 1 datang — sebelum membangun apa pun
   di Fase C.
4. **Fase B** — bisa jalan paralel, tidak bergantung pada siapa pun.
5. **Fase D** — mulai setelah contoh catatan guru diterima.
6. **Fase C penuh**, lalu **E**, lalu **F**.
