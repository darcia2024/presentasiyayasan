/**
 * PERISA AZHARIYAH — Kerangka Antarmuka
 * Drawer mobile, dropdown profil, dan modal piagam kelulusan.
 *
 * CATATAN FASE 6: piagam di sini belum bisa diverifikasi. Sertifikat resmi
 * berupa PDF berkop yayasan dengan QR menuju halaman verifikasi publik.
 */

import { playTone, showToast } from '../core/feedback.js';
import { gantiPinSendiri } from '../core/pengurus-client.js';
import { bacaSesi } from '../core/supabase-client.js';

export function toggleMobileDrawer() {
  const drawer = document.getElementById('mobileDrawerOverlay');
  if (!drawer) return;
  drawer.classList.toggle('open');
  playTone(560, 'sine', 0.08, 0.05);
}

/**
 * Bentangkan / tutup daftar "Materi Saya" di sidebar.
 *
 * Pilihan santri disimpan di dataset wadahnya, bukan di variabel modul:
 * daftarnya digambar ULANG setiap kali silabus berganti (ganti jenjang,
 * konten terbit menyusul), dan penggambaran ulang itu tidak boleh
 * memaksa daftar terbuka lagi kalau santri sudah menutupnya sendiri.
 */
export function toggleMateriNav(e) {
  if (e) e.stopPropagation();

  const wadah = document.getElementById('sidebarModulList');
  if (!wadah) return;

  const terbuka = wadah.classList.toggle('is-open');
  if (terbuka) delete wadah.dataset.ditutupPengguna;
  else wadah.dataset.ditutupPengguna = '1';

  const toggle = document.getElementById('nav-materi-toggle');
  if (toggle) toggle.setAttribute('aria-expanded', String(terbuka));

  const caret = document.getElementById('navMateriCaret');
  if (caret) {
    caret.classList.remove('ph-caret-up', 'ph-caret-down');
    caret.classList.add(terbuka ? 'ph-caret-up' : 'ph-caret-down');
  }

  playTone(terbuka ? 560 : 460, 'sine', 0.07, 0.045);
}

export function toggleProfileDropdown(e) {
  if (e) e.stopPropagation();
  const card = document.getElementById('sidebarUserCard');
  const menu = document.getElementById('profileDropdownMenu');
  if (!menu) return;

  const isOpen = menu.classList.toggle('show');
  if (card) card.classList.toggle('active', isOpen);
  if (isOpen) playTone(540, 'sine', 0.08, 0.05);
}

export function openCertModal() {
  const modal = document.getElementById('certModal');
  if (modal) modal.classList.add('open');
  playTone(600, 'sine', 0.12, 0.06);
}

export function closeCertModal() {
  const modal = document.getElementById('certModal');
  if (modal) modal.classList.remove('open');
}

/** Nama resmi yang dipakai markup untuk membuka piagam. */
export function openCertificate() {
  openCertModal();
}

/** Tutup dropdown profil saat pengguna mengklik di luar area kartunya. */
export function bindOutsideClick() {
  document.addEventListener('click', (e) => {
    const card = document.getElementById('sidebarUserCard');
    const menu = document.getElementById('profileDropdownMenu');
    if (!menu || !menu.classList.contains('show')) return;

    const clickedInside = menu.contains(e.target) || (card && card.contains(e.target));
    if (clickedInside) return;

    menu.classList.remove('show');
    if (card) card.classList.remove('active');
  });
}

/* ==========================================================================
 * AUDIT 10 September 2026 (M12) — ANTARMUKA YANG BERBOHONG
 *
 * TEMUAN. Halaman aplikasi memuat 15 kontrol yang satu-satunya efeknya adalah
 * memunculkan toast. Tujuh di antaranya MENGAKU BERHASIL melakukan sesuatu
 * yang tidak pernah terjadi:
 *
 *   "Dokumen berhasil diunduh"            — tidak ada berkas apa pun
 *   "Tautan materi disalin ke clipboard"  — clipboard tidak pernah disentuh
 *   "Mengunduh berkas PDF..."             — tidak ada unduhan
 *   "Materi disimpan ke daftar arsip pribadi" — tidak ada arsip
 *
 * Audit 5 September sudah membersihkan identitas peraga (nama & nomor
 * telepon karangan), tapi hanya menyembunyikan BILAH peraga
 * (js/ui/auth.js:257). Kontrol-kontrol ini ada di dalam alur biasa —
 * sidebar, pembaca dokumen, kartu silabus — dan tetap hidup untuk sesi
 * keluarga sungguhan.
 *
 * Untuk uji coba dengan 3-5 keluarga, ini bukan soal kerapian: wali yang
 * menekan "unduh" lalu tidak menemukan berkasnya akan mengira aplikasinya
 * rusak, atau mengira dirinya yang salah. Keduanya merusak kepercayaan
 * pada hal yang justru sedang diuji.
 *
 * DUA PERLAKUAN:
 *   1. Yang jelas bisa dikerjakan sekarang -> DIKERJAKAN (salinTautanMateri).
 *   2. Sisanya -> tetap ada, tapi BERKATA JUJUR bahwa fiturnya belum ada.
 *      Nasib akhirnya (dibuat, disembunyikan, atau dibuang) keputusan
 *      pemilik — lihat laporan audit bagian NEEDS OWNER INPUT.
 * ========================================================================== */

/**
 * Katakan apa adanya bahwa sebuah fitur belum tersedia, alih-alih mengaku
 * berhasil melakukannya. Sekali dipanggil, kontrolnya juga ditandai secara
 * visual supaya tidak ditekan berulang kali.
 *
 * @param {string} namaFitur nama yang dikenali pengguna, mis. 'Unduh dokumen'
 * @param {Event} [ev]
 */
export function belumTersedia(namaFitur, ev) {
  showToast(`${namaFitur} belum tersedia.`);
  playTone(320, 'sine', 0.1, 0.05);

  const el = ev?.currentTarget || ev?.target;
  if (el && el.setAttribute) {
    el.setAttribute('aria-disabled', 'true');
    el.style.opacity = '0.55';
    el.style.cursor = 'not-allowed';
    if (!el.title) el.title = `${namaFitur} belum tersedia`;
  }
}

/**
 * Salin tautan halaman materi yang sedang dibuka. Ini SUNGGUHAN — dulu
 * dua tombol "Salin tautan" cuma memunculkan toast tanpa menyentuh
 * clipboard sama sekali.
 *
 * navigator.clipboard butuh konteks aman (HTTPS) dan bisa ditolak
 * pengguna; kalau gagal, katakan gagal — jangan mengaku berhasil.
 */
export async function salinTautanMateri() {
  const tautan = window.location.href;
  try {
    if (!navigator.clipboard?.writeText) throw new Error('clipboard tidak tersedia');
    await navigator.clipboard.writeText(tautan);
    showToast('Tautan materi disalin.');
    playTone(560, 'sine', 0.1, 0.06);
  } catch (_) {
    showToast('Peramban ini tidak mengizinkan menyalin otomatis. Salin dari kolom alamat, ya.');
    playTone(320, 'sine', 0.1, 0.05);
  }
}


/* ==========================================================================
   GANTI PIN SENDIRI (12 September 2026)

   Pengurus yang menetapkan PIN sebuah keluarga ikut mengetahuinya. Selama
   wali tidak punya cara menggantinya, tidak pernah ada satu momen pun di
   mana PIN sebuah keluarga hanya diketahui keluarga itu sendiri. Ini yang
   menutup celah itu — dan sepenuhnya opsional, tidak menambah langkah bagi
   yang tidak memakainya.
   ========================================================================== */

const $pin = (id) => document.getElementById(id);

function setGantiPinError(pesan) {
  const el = $pin('gantiPinError');
  if (!el) return;
  el.textContent = pesan || '';
  el.style.display = pesan ? 'block' : 'none';
}

function tutupGantiPin() {
  const modal = $pin('gantiPinModal');
  if (modal) modal.classList.remove('open');
  ['pinLamaInput', 'pinBaruInput', 'pinUlangInput'].forEach((id) => {
    const el = $pin(id);
    if (el) el.value = '';
  });
  setGantiPinError('');
}

async function simpanPinBaru() {
  const lama = $pin('pinLamaInput')?.value.trim() || '';
  const baru = $pin('pinBaruInput')?.value.trim() || '';
  const ulang = $pin('pinUlangInput')?.value.trim() || '';
  const tombol = $pin('gantiPinSubmit');

  setGantiPinError('');
  if (!lama || !baru || !ulang) {
    setGantiPinError('Ketiga kolom wajib diisi.');
    return;
  }
  // Diperiksa di sini, bukan cuma di server: salah ketik ulangan adalah
  // kekeliruan paling sering, dan tidak ada gunanya menempuh jaringan
  // untuk mengetahuinya.
  if (baru !== ulang) {
    setGantiPinError('PIN baru dan ulangannya belum sama.');
    return;
  }

  if (tombol) {
    tombol.disabled = true;
    tombol.textContent = 'Menyimpan…';
  }
  try {
    await gantiPinSendiri(lama, baru);
    playTone(659, 'sine', 0.14, 0.08);
    showToast('PIN berhasil diganti. Pakai PIN baru saat masuk berikutnya.');
    tutupGantiPin();
  } catch (e) {
    setGantiPinError(e.message || 'Gagal mengganti PIN. Coba lagi.');
  } finally {
    if (tombol) {
      tombol.disabled = false;
      tombol.textContent = 'Simpan PIN Baru';
    }
  }
}

/** Buka dialog ganti PIN. Dipanggil dari menu "Ganti PIN" di sidebar. */
export function bukaGantiPin() {
  // Mode peraga (belum ada sesi) tidak punya PIN untuk diganti — katakan
  // apa adanya, jangan buka formulir yang pasti gagal.
  if (!bacaSesi()) {
    showToast('Masuk dulu untuk mengganti PIN.');
    return;
  }

  const modal = $pin('gantiPinModal');
  if (!modal) return;

  setGantiPinError('');
  modal.classList.add('open');
  $pin('pinLamaInput')?.focus();

  // Dipasang sekali saja — modal ini dibuka berkali-kali selama satu sesi.
  if (!modal.dataset.terpasang) {
    modal.dataset.terpasang = '1';
    $pin('gantiPinSubmit')?.addEventListener('click', simpanPinBaru);
    $pin('gantiPinBatal')?.addEventListener('click', tutupGantiPin);
    $pin('pinUlangInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') simpanPinBaru();
    });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) tutupGantiPin();
    });
  }

  playTone(560, 'sine', 0.08, 0.05);
}
