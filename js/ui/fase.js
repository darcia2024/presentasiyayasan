/**
 * PERISA AZHARIYAH — Gerbang Fase Peluncuran
 *
 * KENAPA BERKAS INI ADA (rapat tim PERISA, 12 September 2026).
 *
 * Platform ini dibangun dengan urutan wali-dan-santri lebih dulu. Rapat
 * membalik urutannya: fase awal HANYA untuk guru — kelas online belum
 * dibuka, jenjang SMP/SMA belum punya materi, dan latihan/evaluasi ternyata
 * ada di buku latihan cetak, bukan di aplikasi.
 *
 * Bagian-bagian itu sudah jadi, sudah teruji, dan akan terpakai lagi
 * begitu fasenya tiba. Jadi yang dilakukan di sini MENYEMBUNYIKAN, bukan
 * menghapus: tabel, Edge Function, dan ujinya semua dibiarkan hidup.
 * Biaya menghidupkan kembali nanti jauh lebih mahal daripada biaya
 * membiarkannya diam.
 *
 * CARA MEMBUKA KEMBALI. Hapus satu baris dari KUNCI_AKTIF di bawah. Tidak
 * ada tempat lain yang perlu disentuh — markup yang terkena sudah menandai
 * dirinya sendiri lewat atribut `data-terkunci`.
 *
 * CARA MENGUNCI SESUATU YANG BARU. Tambahkan `data-terkunci="<nama-kunci>"`
 * pada elemennya di index.html, lalu daftarkan namanya di KUNCI_AKTIF.
 * Untuk menu sidebar/drawer, atribut boleh ditaruh di `<a>`-nya — seluruh
 * `<li>` pembungkusnya ikut disembunyikan supaya tidak menyisakan bulatan
 * atau jarak kosong di daftar.
 */

/**
 * Kunci yang sedang berlaku. Kosongkan isinya dan seluruh aplikasi kembali
 * terbuka penuh seperti sebelum rapat 12 September.
 */
const KUNCI_AKTIF = new Set([
  /*
   * Kelas online belum dibuka. Yang memakai platform di fase ini hanya
   * guru: membuka materi di depan kelas. Dashboard Wali dan Dashboard
   * Santri (beserta XP, lencana, dan papan peringkat di dalamnya) menunggu
   * pembelajaran online benar-benar dirancang.
   */
  'kelas-online',

  /*
   * Belum ada pembelajaran untuk SMP dan SMA — kurikulum yang disusun Umi
   * mencakup 12 buku untuk kelas 1–6 SD. Dibuka begitu materi jenjang
   * lanjutan ada.
   */
  'jenjang-lanjut',

  /*
   * Latihan dan evaluasi ada di BUKU LATIHAN CETAK, satu paket dengan buku
   * pembelajaran. Bentuk digitalnya belum diputuskan — lihat pertanyaan
   * 10.3 di docs/rencana-perbaikan-pasca-rapat.md.
   */
  'evaluasi-digital',
]);

/** @param {string} nama */
export function fiturTerkunci(nama) {
  return KUNCI_AKTIF.has(nama);
}

const SEMUA_JENJANG = ['sd', 'smp', 'sma'];

/** Jenjang yang dicakup kunci 'jenjang-lanjut'. */
const JENJANG_LANJUT = ['smp', 'sma'];

/**
 * Jenjang yang benar-benar berlaku di fase ini.
 *
 * Dipakai untuk memilih materi apa yang dibuka sesi STAFF — staff tidak
 * punya "jenjang santri" seperti wali, jadi harus ada penentu lain. Diturunkan
 * dari kunci fase, bukan ditulis sebagai daftar tetap: begitu 'jenjang-lanjut'
 * dicabut, SMP dan SMA otomatis ikut terpilih tanpa ada yang perlu ingat
 * menyunting berkas kedua.
 *
 * @returns {string[]} selalu berisi minimal satu jenjang.
 */
export function jenjangAktif() {
  return fiturTerkunci('jenjang-lanjut')
    ? SEMUA_JENJANG.filter((j) => !JENJANG_LANJUT.includes(j))
    : SEMUA_JENJANG.slice();
}

/**
 * Sembunyikan setiap elemen bertanda `data-terkunci` yang kuncinya sedang
 * aktif.
 *
 * Dipanggil dari terapkanAturanTampilan() di js/ui/auth.js — tempat yang
 * sama dengan aturan tampilan lain — supaya ikut berjalan TANPA SYARAT saat
 * boot, termasuk ketika Supabase belum terkonfigurasi. Kalau penerapannya
 * digantungkan pada sesi, satu variabel lingkungan yang salah ketik akan
 * menampilkan menu yang seharusnya terkunci ke publik.
 */
export function terapkanKunciFase() {
  document.querySelectorAll('[data-terkunci]').forEach((el) => {
    if (!KUNCI_AKTIF.has(el.dataset.terkunci)) return;

    // Untuk butir menu, yang disembunyikan pembungkusnya — bukan tautannya
    // saja — supaya tidak tersisa baris kosong di daftar navigasi.
    const sasaran = el.closest('li') || el;

    // KELAS, bukan inline style. Tab bar bawah versi mobile memakai
    // `.bottom-nav-item { display: flex !important }`, dan aturan ber-
    // !important mengalahkan inline style tanpa !important — butir menunya
    // tetap terlihat padahal sudah disetel none. Kelasnya dideklarasikan di
    // ujung prototype-mobile.css supaya menang lewat urutan sumber.
    sasaran.classList.add('is-terkunci-fase');
    sasaran.setAttribute('aria-hidden', 'true');
  });

  rapikanLabelGrupKosong();
}

/**
 * Sembunyikan judul kelompok navigasi yang seluruh isinya sudah terkunci.
 *
 * Tanpa ini, mengunci Dashboard Wali dan Dashboard Santri menyisakan tulisan
 * "PORTAL" menggantung tanpa satu butir pun di bawahnya — terlihat seperti
 * menu yang gagal dimuat, bukan menu yang memang belum berlaku.
 *
 * Sengaja dihitung dari keadaan DOM, bukan dari daftar tetap: kelompok mana
 * yang ikut kosong berubah setiap kali isi KUNCI_AKTIF berubah, dan daftar
 * tetap akan diam-diam salah begitu ada kunci yang ditambah atau dicabut.
 */
function rapikanLabelGrupKosong() {
  document.querySelectorAll('.nav-group-label').forEach((label) => {
    // Label yang memang sudah disembunyikan pihak lain (mis. menu pengurus
    // untuk sesi non-staff) tidak perlu disentuh.
    if (label.style.display === 'none') return;

    let adaYangTerlihat = false;
    for (let n = label.nextElementSibling; n; n = n.nextElementSibling) {
      if (n.classList.contains('nav-group-label')) break; // kelompok berikutnya
      if (getComputedStyle(n).display !== 'none') {
        adaYangTerlihat = true;
        break;
      }
    }

    if (!adaYangTerlihat) {
      label.classList.add('is-terkunci-fase');
      label.setAttribute('aria-hidden', 'true');
    }
  });
}
