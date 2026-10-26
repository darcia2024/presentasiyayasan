# Rancangan Desain Ulang Aplikasi LMS PERISA

**Dibuat:** 26 Oktober 2026. **Status:** rancangan, menunggu persetujuan. Belum ada kode yang diubah.
**Acuan visual:** halaman [/pitch](https://presentasiyayasan.vercel.app/pitch) (commit `b8f4a93`).

---

## 1. Tujuan

Membawa bahasa visual /pitch ke aplikasi yang dipakai setiap hari oleh Super Admin, guru, dan wali, supaya aplikasinya terasa dirancang dengan sengaja, bukan template.

Aplikasi berbeda dari halaman presentasi: aplikasi adalah **alat kerja**. Guru mengisi absensi 25 anak, dan Umi menyusun 60 bab materi. Karena itu:

- Yang dibawa dari /pitch adalah **suasananya**: kertas gading, tinta hijau hutan, teal hanya sebagai aksen, serif untuk judul halaman, garis tipis, dan kartu lembut.
- Yang **tidak** dibawa: butir kertas, animasi muncul saat scroll, dan judul serif raksasa. Di layar kerja, ketiganya hanya mengganggu.
- **Keterbacaan dan kepadatan informasi menang** di setiap layar yang berisi data (tabel santri, lembar absensi, daftar bab).

## 2. Kondisi sekarang (diukur 26 Okt 2026)

| Hal | Angka | Artinya |
|---|---|---|
| Berkas CSS aplikasi | 4 (`prototype.css` 2.574 baris, `prototype-mobile.css` 1.945, `studio.css` 1.240, `auth.css` 235) | Gaya tersebar, banyak aturan saling menimpa |
| `!important` | ±1.150 (360 + 792 di dua berkas utama) | Versi mobile menimpa desktop dengan kekerasan; mengubah satu warna bisa butuh mengubah puluhan aturan |
| Warna ditulis langsung (hex) | ±190 | Warna tidak lewat token, sehingga palet tidak bisa diganti dari satu tempat |
| Token di `:root` | 25 | Terlalu sedikit untuk menjadi sumber kebenaran |
| `style="…"` sebaris di `index.html` | 121 | Banyak tampilan diputuskan di markup, bukan di CSS |
| `.style` / `cssText` di JS | 127 | Sebagian layar (Panel, Studio, Guru) menulis gaya langsung dari kode |

**Konsekuensinya:** mengganti tampilan layar per layar tanpa membereskan token dulu akan menghasilkan dua gaya yang bercampur. Jadi urutannya: **token dulu, kerangka, baru layar.**

## 3. Bahasa visual (token baru)

| Token | /pitch | Aplikasi | Catatan |
|---|---|---|---|
| Kertas (latar halaman) | gading `oklch(96% .012 85)` | sama | Mengganti putih bersih sekarang |
| Kartu / permukaan kerja | `oklch(98.4% .006 85)` | sama | Tabel, formulir, dan lembar absensi tetap di permukaan terang |
| Tinta utama | hijau hutan `oklch(23% .025 170)` | sama | Mengganti `#08201E` |
| Aksen | teal PERISA | sama, **hanya** tombol utama, tautan, dan status terpilih | Sekarang teal dipakai di hampir semua elemen |
| Emas | nomor & angka | lencana level, sertifikat, angka ringkasan | |
| Hijau hutan gelap | bab Fondasi | sidebar? (lihat keputusan 8.2) | |
| Status | merah mendesak, kuning perlu, teal info | **dipertahankan**, hanya diselaraskan nadanya | Warna status adalah informasi, bukan hiasan |
| Judul halaman | Instrument Serif | Instrument Serif, **hanya** judul halaman & angka besar | Label, tombol, dan tabel tetap sans |
| Teks & kontrol | Plus Jakarta Sans | sama | |
| Teks Arab | Amiri | Amiri (tidak berubah) | |
| Sudut | panggung 28px, kartu 22px | kartu 16px, kontrol 10px, tombol pil | Lebih rapat dari /pitch karena layar lebih padat |
| Bayangan | lembut | sangat tipis atau tidak ada; batas pakai garis 1px | |

## 4. Pendekatan teknis, bertahap

Setiap fase bisa dirilis sendiri dan diuji sebelum fase berikutnya.

| Fase | Isi | Ukuran | Risiko |
|---|---|---|---|
| **0. Fondasi token** | Satu berkas `tokens.css` berisi semua warna, jarak, sudut, dan font. Hex lama di empat berkas CSS diganti dengan token. Tampilan **belum** berubah; ini murni pindah tempat | Sedang | Rendah: diuji dengan membandingkan tangkapan layar sebelum dan sesudah, harus identik |
| **1. Ganti palet & tipografi** | Nilai token diganti ke palet /pitch, serif masuk untuk judul halaman | Kecil | Sedang: kontras perlu dicek di setiap layar |
| **2. Kerangka** | Sidebar, kepala atas, remah roti, drawer & tab bar mobile, toast, modal | Sedang | Sedang: dipakai semua layar |
| **3. Layar per layar** | Lihat bagian 5, satu layar satu commit | Besar | Rendah per layar |
| **4. Bersih-bersih** | Memindahkan `style="…"` sebaris dan `.style` di JS ke kelas CSS, mengurangi `!important` | Besar | Sedang |

Alat uji yang sudah ada: skrip tangkapan layar dengan **data contoh fiktif** yang dipakai untuk /pitch. Skrip ini bisa memotret semua layar di desktop dan HP sebelum dan sesudah setiap fase, jadi perubahannya bisa dibandingkan berdampingan tanpa menyentuh data produksi.

## 5. Daftar layar dan apa yang berubah

### Kerangka (semua layar)

| Bagian | Sekarang | Sesudah |
|---|---|---|
| Latar halaman | Putih | Kertas gading; permukaan kerja tetap terang |
| Sidebar desktop | Putih, menu teal, label grup huruf kapital renggang | Kertas gading, label grup sentence case kecil, menu aktif berupa latar lembut dengan tinta hutan (bukan blok teal) |
| Kepala atas & remah roti | Garis bawah abu, ikon bundar | Lebih tipis; remah roti satu baris kecil, judul halaman pindah ke isi sebagai judul serif |
| Kartu profil di sidebar | Kotak bergaris | Baris sederhana: inisial, nama, peran |
| App bar mobile & judul besar | Latar gradasi teal gelap, chip pil | Latar hutan polos, judul serif, chip garis tipis |
| Tab bar bawah mobile | Putih, tombol tengah teal bulat | Kertas gading, ikon tinta, tombol tengah hutan |
| Drawer mobile | Seperti sidebar | Mengikuti sidebar baru |
| Toast | Kotak gelap | Pil hutan, lebih kecil |
| Modal (Ganti PIN, sertifikat) | Kotak putih berbayang | Kartu terang bersudut 16px, judul serif |

### Layar

| Layar | Siapa | Yang berubah |
|---|---|---|
| **Masuk** (gerbang login) | Semua | Latar kertas gading (bukan gradasi hijau gelap), kartu terang, judul serif "Masuk ke PERISA", tombol pil teal. Isian tetap besar untuk HP |
| **Dashboard Yayasan** | Super Admin | Judul serif sapaan. Blok Perlu Perhatian: kartu terang dengan garis status tipis di kiri (bukan latar merah/kuning penuh) supaya tidak terasa seperti peringatan bertubi-tubi. Ringkasan fitur: angka besar serif, kartu tanpa bayangan |
| **Panel Super Admin** | Super Admin | Tab jadi garis bawah tipis. Daftar santri/guru/infaq jadi **tabel bergaris** (bukan kartu bertumpuk) di desktop, dan kartu ringkas di HP. Formulir: label di atas, isian bersudut 10px, satu tombol utama |
| **Studio Kurikulum** | Super Admin | Daftar modul dan layar Materi PPT jadi baris bergaris. Status "terpasang/belum" jadi lencana kecil. **Sekalian memperbaiki** label "Belum ada materi" pada bab yang sudah punya link OneDrive |
| **Kurikulum (pemutar materi)** | Semua | Kotak video/materi tetap gelap (bagus untuk proyektor). Silabus di samping jadi daftar bergaris dengan nomor bab emas. Sub-tab jadi garis bawah. Profil Umi jadi kartu terang dengan judul serif |
| **Kartu mufrodat** | Semua | Kartu terang lebih besar, huruf Arab Amiri lebih besar, tombol suara lingkaran garis |
| **Pemutar PPT** | Guru | Bingkai layar penuh gelap tetap. Hanya kontrol di atasnya diselaraskan |
| **Perpustakaan / Modul & Silabus PDF** | Semua | Kartu dokumen jadi baris bergaris dengan ikon kecil |
| **Dashboard Guru** | Guru | Sama dengan Dashboard Yayasan. Kartu kelas jadi baris lebar dengan tombol "Catat Hari Ini" yang menonjol. **Sekalian memperbaiki** sapaan "Ustazah!" agar memakai nama |
| **Lembar pertemuan & absensi** | Guru | Absensi jadi tabel rapat: satu baris per anak, pilihan Hadir/Izin/Sakit/Alfa sebagai tombol segmen (bukan dropdown), supaya 25 anak bisa diisi tanpa membuka menu 25 kali. Ini perubahan tampilan **dan** interaksi kecil; datanya sama |
| **Dashboard Wali** | Wali | Kabar Terbaru jadi kartu emas lembut, kartu anak lebih lapang, judul serif |
| **Piagam / sertifikat** | Wali | Modal mengikuti modal baru |
| **Simulasi Percakapan Suara** | Semua | Kepala gelap jadi hutan polos, kartu dialog terang, teks Arab tetap besar |
| **Verifikasi sertifikat** (publik) | Siapa pun | Latar gading, kartu terang, status "Asli" tetap teal. Halaman pertama yang dilihat orang luar, jadi diprioritaskan |
| **Offline** dan **Kebijakan privasi** | Semua | Mengikuti token baru, tanpa perubahan isi |

## 6. Yang tidak berubah

- Alur, fitur, data, hak akses, dan teks layar (kecuali dua perbaikan kecil yang disebut di atas).
- Warna status sebagai penanda (merah, kuning, teal). Hanya nadanya yang diselaraskan.
- Font Arab Amiri dan ukuran besarnya.
- Logo dan nama PERISA.
- Kepatuhan CSP: tidak ada skrip atau font dari luar.

## 7. Risiko dan cara mengujinya

| Risiko | Cara menangkapnya |
|---|---|
| Layar yang terlewat masih memakai warna lama | Fase 0 menghapus hex dari CSS, dan sloplint/grep menolak hex di luar berkas token |
| Aturan `!important` mobile menimpa gaya baru | Setiap fase dicek di HP 390 px dengan skrip tangkapan layar |
| Kontras teks turun di atas kertas gading | Setiap pasangan warna teks/latar diukur, minimal 4.5:1 |
| Tampilan di proyektor kelas (layar terang, ruangan terang) | Kotak materi tetap gelap; satu sesi uji di proyektor sungguhan sebelum Fase 3 dianggap selesai |
| Perubahan interaksi absensi (dropdown jadi tombol segmen) | Dirilis sendiri, dengan uji isi-simpan di lokal memakai data contoh |

## 8. Keputusan yang dibutuhkan dari Anda

1. **Serif di aplikasi:** hanya untuk judul halaman dan angka besar (saran saya), atau tidak sama sekali?
2. **Sidebar desktop:** kertas gading terang (saran saya, lebih tenang untuk dipakai lama) atau hijau hutan gelap seperti bab Fondasi di /pitch?
3. **Urutan layar** di Fase 3. Saran saya:
   1. Masuk
   2. Verifikasi sertifikat
   3. Dashboard Yayasan
   4. Dashboard Guru dan lembar absensi
   5. Kurikulum
   6. Studio
   7. Panel
   8. Dashboard Wali
   9. Sisanya
4. **Cara rilis:** bertahap per fase (saran saya: setiap fase bisa dicek dan dibatalkan sendiri), atau satu rilis besar di akhir?
5. **Absensi tombol segmen** (bagian 5): setuju diubah, atau tetap dropdown?
