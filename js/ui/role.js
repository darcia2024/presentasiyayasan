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
import { upgradePapanPeringkat } from './papan-peringkat.js';

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
