/**
 * PERISA AZHARIYAH — Pergantian Peran Akun
 *
 * CATATAN FASE 1: pergantian peran lewat tombol ini adalah alat peraga.
 * Setelah autentikasi nyata aktif, peran ditentukan sesi login wali dan
 * profil anak yang dipilih — bukan tombol yang bisa ditekan siapa saja.
 */

import { roleData, DEFAULT_ROLE } from '../data/roles.js';
import { playTone, showToast } from '../core/feedback.js';
import { renderSyllabus } from './syllabus.js';
import { muatSilabusTerbit, muatMufrodatPelajaran } from '../core/content-loader.js';
import { renderMufrodatCards } from './mufrodat-cards.js';
import { tampilkanVideoPelajaran, sembunyikanVideoPelajaran } from './video-player.js';
import { renderKuis } from './kuis.js';
import { santriAktifId } from '../core/kuis-client.js';
import { upgradePapanPeringkat } from './papan-peringkat.js';
import { upgradeCertModalKeSertifikatAsli } from './sertifikat-santri.js';
import { upgradeRiwayatAsisten } from './assistant.js';
import { bacaSesi } from '../core/supabase-client.js';

/** Tampilan lain yang harus disembunyikan agar tidak bertumpuk saat berganti peran. */
const OTHER_VIEWS = ['viewBerandaUtama', 'viewModulPdf', 'viewAiAssistant'];

const PERAN_KE_JENJANG = { 'santri-sd': 'sd', 'santri-smp': 'smp', 'santri-sma': 'sma' };

/**
 * Cegah render silabus peraga (dipanggil sinkron duluan) menimpa balik
 * silabus asli yang baru saja selesai dimuat dari giliran setRole()
 * SEBELUMNYA — bisa terjadi kalau santri mengganti peran dua kali cepat
 * sebelum permintaan pertama selesai.
 */
let giliranSilabusTerakhir = 0;

/**
 * Setelah silabus peraga tampil (instan, tanpa jeda), coba muat konten yang
 * sungguhan diterbitkan Umi Elly untuk jenjang ini. Kalau ada, gantikan
 * silabus peraga. Kalau belum ada, biarkan peraga tetap tampil — aplikasi
 * tidak pernah menampilkan silabus kosong.
 */
async function upgradeKeKontenAsli(roleName) {
  const jenjang = PERAN_KE_JENJANG[roleName];
  if (!jenjang) return;

  const giliranSaya = ++giliranSilabusTerakhir;
  upgradePapanPeringkat(jenjang); // independen dari silabus — tidak perlu ditunggu
  upgradeCertModalKeSertifikatAsli(santriAktifId()); // idem — modal piagam baru dibuka kalau diklik
  upgradeRiwayatAsisten(santriAktifId()); // idem — riwayat + kuota asisten AI
  const hasil = await muatSilabusTerbit(jenjang);
  if (giliranSaya !== giliranSilabusTerakhir) return; // sudah keburu ganti peran lagi
  if (!hasil || !hasil.syllabus.length) return;

  renderSyllabus(hasil.syllabus);

  if (hasil.pelajaranAktifId) {
    const [mufrodat] = await Promise.all([
      muatMufrodatPelajaran(hasil.pelajaranAktifId),
      tampilkanVideoPelajaran(hasil.pelajaranAktifId),
    ]);
    if (giliranSaya !== giliranSilabusTerakhir) return;
    if (mufrodat && mufrodat.length) {
      renderMufrodatCards(mufrodat);
      renderKuis(mufrodat, hasil.pelajaranAktifId);
    }
  } else {
    sembunyikanVideoPelajaran();
  }
}

const setText = (id, value) => {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
};

function updateSidebarCard(user) {
  const avatar = document.getElementById('sidebarUserAvatar');
  if (avatar) {
    avatar.textContent = user.initials;
    avatar.style.background = user.bg;
  }
  setText('sidebarUserName', user.name);
  setText('sidebarUserSub', user.level);
}

function updateProfileDropdown(user, roleName) {
  const avatar = document.getElementById('dropdownAvatarLarge');
  if (avatar) {
    avatar.textContent = user.initials;
    avatar.style.background = user.bg;
  }
  setText('dropdownUserName', user.name);
  setText('dropdownUserStatus', user.status);
  setText('dropdownUserNisn', user.nisn);

  const KEY_TO_ROLE = { sd: 'santri-sd', smp: 'santri-smp', sma: 'santri-sma', admin: 'admin' };
  Object.entries(KEY_TO_ROLE).forEach(([key, role]) => {
    const isCurrent = role === roleName;
    const item = document.getElementById(`accountItem-${key}`);
    const check = document.getElementById(`check-${key}`);
    if (item) item.classList.toggle('current', isCurrent);
    if (check) check.style.display = isCurrent ? 'block' : 'none';
  });
}

/**
 * Fase 8: sebelum ini, sidebar/dropdown SELALU menampilkan nama peraga
 * ("Ahmad Fauzan" dkk. dari js/data/roles.js) walau yang login wali/staff
 * SUNGGUHAN — setRole() memang dirancang sekitar persona peraga, tidak
 * pernah tahu ada sesi asli. Dipanggil SETELAH setRole() (yang tetap
 * dipakai untuk kontennya) supaya identitas di sidebar/dropdown benar,
 * bukan demi kontennya lagi.
 *
 * @param {{nama:string, subtitel:string, inisial:string}} identitas
 */
export function terapkanIdentitasAsli(identitas) {
  const avatar = document.getElementById('sidebarUserAvatar');
  if (avatar) {
    avatar.textContent = identitas.inisial;
    avatar.style.background = 'var(--teal-primary)';
  }
  setText('sidebarUserName', identitas.nama);
  setText('sidebarUserSub', identitas.subtitel);

  const avatarBesar = document.getElementById('dropdownAvatarLarge');
  if (avatarBesar) {
    avatarBesar.textContent = identitas.inisial;
    avatarBesar.style.background = 'var(--teal-primary)';
  }
  setText('dropdownUserName', identitas.nama);
  setText('dropdownUserStatus', identitas.subtitel);
  setText('dropdownUserNisn', ''); // NISN peraga tidak relevan untuk sesi asli
}

const NAMA_JENJANG_LOKAL = { sd: 'SD', smp: 'SMP', sma: 'SMA' };
const NAMA_PERAN_STAFF_LOKAL = { pengajar: 'Pengajar', pengurus: 'Pengurus Yayasan', superadmin: 'Pengurus Yayasan' };

/**
 * Fase 8: dipanggil di UJUNG setiap setRole() — SATU tempat yang dilalui
 * semua tombol ganti-peran (bar demo atas, drawer mobile, dropdown
 * profil, kartu "Pilihan Jenjang Lainnya" di Beranda, dst). Kalau ada
 * sesi sungguhan aktif, timpa balik identitas peraga yang baru saja
 * ditulis updateSidebarCard/updateProfileDropdown dengan identitas
 * ASLI — jauh lebih tahan lama daripada menambal satu-satu tiap tombol
 * yang memanggil setRole(), termasuk yang belum ditulis sampai sekarang.
 */
function terapkanIdentitasSesiAktif() {
  const sesi = bacaSesi();
  if (!sesi) return;

  if (sesi.akun.akun_jenis === 'wali') {
    const santriAktif = sesi.santri?.find((s) => s.id === sesi.santriAktifId);
    if (!santriAktif) return;
    terapkanIdentitasAsli({
      nama: santriAktif.nama,
      subtitel: `Santri Jenjang ${NAMA_JENJANG_LOKAL[santriAktif.jenjang] || santriAktif.jenjang.toUpperCase()}`,
      inisial: santriAktif.inisial,
    });
  } else if (sesi.akun.akun_jenis === 'staff') {
    const inisial = (sesi.akun.nama || '?').trim().split(/\s+/).slice(0, 2).map((b) => b[0]?.toUpperCase()).join('');
    terapkanIdentitasAsli({
      nama: sesi.akun.nama,
      subtitel: NAMA_PERAN_STAFF_LOKAL[sesi.akun.staff_peran] || 'Staff Yayasan',
      inisial: inisial || '?',
    });
  }
}

function setBreadcrumb(root, category, active) {
  setText('breadcrumbRoot', root);
  setText('breadcrumbCategory', category);
  setText('breadcrumbActiveTitle', active);
}

export function setRole(roleName) {
  document.querySelectorAll('.role-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.role === roleName);
  });

  const data = roleData[roleName] || roleData[DEFAULT_ROLE];

  updateSidebarCard(data.user);
  updateProfileDropdown(data.user, roleName);
  terapkanIdentitasSesiAktif(); // Fase 8 — lihat komentar di fungsinya

  const courseView = document.getElementById('viewCoursePlayer');
  const adminView = document.getElementById('viewAdminPanel');
  const workspace = document.getElementById('refMainWorkspace');
  if (workspace) workspace.scrollTop = 0;

  // Tanpa langkah ini, berpindah peran saat Beranda / Silabus / Asisten AI
  // sedang terbuka membuat dua tampilan tampil bertumpuk.
  OTHER_VIEWS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });

  if (roleName === 'admin') {
    if (courseView) courseView.style.display = 'none';
    if (adminView) adminView.style.display = 'block';
    setBreadcrumb('Yayasan PERISA', 'Otoritas & Tata Kelola', 'Panel Pengurus Yayasan');
    showToast('Beralih ke Akun Pengurus: Panel Otoritas Yayasan');
    playTone(560, 'sine', 0.1, 0.06);
    return;
  }

  if (courseView) courseView.style.display = 'block';
  if (adminView) adminView.style.display = 'none';

  setBreadcrumb('Kurikulum', data.jenjangPill, data.breadcrumb);
  setText('courseMainTitle', data.title);
  setText('courseJenjangText', data.jenjangPill);
  setText('currentVideoArabic', data.arabicTitle);
  setText('currentVideoSubtitle', data.subtitle);
  setText('aboutCourseDesc', data.aboutDesc);

  const watermark = document.querySelector('.ref-video-watermark');
  if (watermark) watermark.innerHTML = `<i class="ph ph-shield-check"></i> ${data.watermark}`;

  renderSyllabus(data.syllabus);
  // Reset ke peraga dulu, SINKRON, sebelum upgrade async dicoba — tanpa ini,
  // video sungguhan dari peran SEBELUMNYA bisa nyangkut kalau jenjang yang
  // baru ternyata belum punya konten terbit sama sekali.
  sembunyikanVideoPelajaran();
  upgradeKeKontenAsli(roleName);

  showToast(`Beralih ke Akun Santri: ${data.user.name} (${data.jenjangPill})`);
  playTone(520, 'sine', 0.1, 0.06);
}
