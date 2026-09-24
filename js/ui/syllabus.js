/**
 * PERISA AZHARIYAH — Akordeon Struktur Silabus & Daftar Materi di Sidebar
 *
 * Seluruh akordeon dirender dari data peran, bukan ditulis keras di HTML.
 * Sebelum perubahan ini `setRole` memakai querySelector tunggal sehingga hanya
 * bagian pertama yang ikut berganti; tiga bagian sisanya tetap menampilkan
 * materi SMP dan SMA apa pun jenjang santrinya.
 *
 * 12 September 2026 — berkas ini juga menggambar DAFTAR MODUL DI SIDEBAR.
 * Sengaja di sini, bukan di modul navigasi tersendiri: daftar sidebar dan
 * akordeon adalah dua tampilan dari SATU sumber data yang sama, dan sumber
 * itu berganti dua kali (silabus peraga dulu, silabus terbit sungguhan
 * menyusul — lihat js/ui/role.js). Menaruh keduanya di satu fungsi berarti
 * tidak mungkin ada keadaan sidebar menampilkan modul jenjang lama sementara
 * akordeonnya sudah modul yang baru.
 */

import { playTone, showToast } from '../core/feedback.js';
import { bacaSesi } from '../core/supabase-client.js';
import { ambilUrlPpt } from '../core/curriculum-client.js';
import { bukaPemutarPpt } from './ppt-player.js';

/** Ikon dan perilaku klik untuk tiap status pelajaran. */
const LESSON_STATUS = {
  siap: {
    icon: 'ph-play-circle',
    onClick: (lesson) => showToast(`Memutar: ${lesson.name}`)
  },
  evaluasi: {
    icon: 'ph-check-circle',
    onClick: (lesson) => showToast(`Membuka: ${lesson.name}`)
  },
  terkunci: {
    icon: 'ph-lock',
    onClick: () => showToast('Pelajaran ini dibuka setelah modul sebelumnya tuntas.')
  },
  sertifikat: {
    icon: 'ph-certificate',
    gold: true,
    onClick: () => {
      // Dipanggil lewat objek global supaya pembungkus versi mobile ikut jalan.
      if (window.PrototypeApp) window.PrototypeApp.openCertificate();
    }
  }
};

function buildLessonRow(lesson) {
  const spec = LESSON_STATUS[lesson.status] || LESSON_STATUS.siap;

  const row = document.createElement('div');
  row.className = `lesson-sub-row${lesson.active ? ' active' : ''}`;
  if (lesson.status === 'terkunci') row.classList.add('is-locked');

  const left = document.createElement('div');
  left.className = 'lesson-left-title';

  const icon = document.createElement('i');
  icon.className = `ph ${spec.icon}`;
  if (spec.gold) icon.style.color = 'var(--gold-dark)';

  const label = document.createElement('span');
  label.textContent = lesson.name;

  left.append(icon, label);

  const time = document.createElement('span');
  time.className = 'lesson-time';
  time.textContent = lesson.time;
  if (spec.gold) {
    time.style.color = 'var(--teal-primary)';
    time.style.fontWeight = '700';
  }

  row.append(left, time);
  row.addEventListener('click', () => spec.onClick(lesson));

  const ppt = tombolPpt(lesson);
  if (ppt) row.insertBefore(ppt, time);

  return row;
}

/**
 * Tombol "PPT" pada satu baris bab — HANYA untuk staff.
 *
 * PPT adalah bahan yang diproyeksikan guru di depan kelas; santri memegang
 * buku cetak (rapat 12 September). Batasnya sungguhan ditegakkan server
 * (Edge Function ppt-signed-url menolak sesi non-staff), jadi pemeriksaan di
 * sini semata-mata supaya wali tidak melihat tombol yang pasti gagal —
 * bukan sebagai pengaman.
 *
 * Guru MITRA ikut mendapatkannya: gerbang internal/eksternal menjaga data
 * santri, bukan materi.
 */
function tombolPpt(lesson) {
  if (!lesson.pptAda && !lesson.pptEmbed) return null;
  if (bacaSesi()?.akun?.akun_jenis !== 'staff') return null;

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'lesson-ppt-btn';

  // Fase C3: bab yang punya link embed OneDrive DITAYANGKAN di pemutar dalam
  // aplikasi — untuk seluruh staff, termasuk guru mitra. Tanpa link embed,
  // jalur unduh lama dipakai (guru mitra tetap ditolak server di sana).
  if (lesson.pptEmbed) {
    btn.title = 'Tayangkan materi PPT bab ini';
    const ikon = document.createElement('i');
    ikon.className = 'ph ph-play-circle';
    btn.append(ikon, document.createTextNode(' PPT'));
    btn.addEventListener('click', (e) => {
      // Tanpa ini, klik tombol ikut membuka/menutup barisnya.
      e.stopPropagation();
      bukaPemutarPpt({ judul: lesson.name, url: lesson.pptEmbed });
    });
    return btn;
  }

  btn.title = lesson.pptNama ? `Buka ${lesson.pptNama}` : 'Buka materi PPT bab ini';

  const isiNormal = () => {
    btn.replaceChildren();
    const ikon = document.createElement('i');
    ikon.className = 'ph ph-projector-screen';
    btn.append(ikon, document.createTextNode(' PPT'));
  };
  isiNormal();

  btn.addEventListener('click', async (e) => {
    // Tanpa ini, klik tombol ikut membuka/menutup barisnya.
    e.stopPropagation();
    btn.disabled = true;
    btn.replaceChildren(document.createTextNode('Menyiapkan…'));
    try {
      const hasil = await ambilUrlPpt(lesson.id);
      // Tautannya berumur 15 menit dan sekali pakai — dibuka di tab baru,
      // bukan menggantikan halaman kurikulum yang sedang dipakai guru
      // mengajar.
      window.open(hasil.url, '_blank', 'noopener');
    } catch (err) {
      showToast(err.message || 'Gagal membuka materi PPT.');
    } finally {
      btn.disabled = false;
      isiNormal();
    }
  });

  return btn;
}

function buildSection(section) {
  const wrap = document.createElement('div');
  wrap.className = 'accordion-section';

  const head = document.createElement('div');
  head.className = `section-head${section.open ? ' is-open' : ''}`;

  const headLeft = document.createElement('div');
  headLeft.className = 'section-head-left';
  const badge = document.createElement('span');
  badge.className = 'section-badge-num';
  badge.textContent = `${section.code}: ${section.title}`;
  headLeft.appendChild(badge);

  const headRight = document.createElement('div');
  headRight.className = 'section-head-right';
  const dur = document.createElement('span');
  dur.className = 'section-dur-text';
  dur.textContent = section.duration;
  if (section.accent === 'emas') {
    dur.style.color = 'var(--gold-dark)';
    dur.style.fontWeight = '700';
  }
  const caret = document.createElement('i');
  caret.className = `ph toggle-caret ${section.open ? 'ph-caret-up' : 'ph-caret-down'}`;
  headRight.append(dur, caret);

  head.append(headLeft, headRight);
  head.addEventListener('click', () => toggleAccordion(head));

  const list = document.createElement('div');
  list.className = 'lesson-sub-list';
  if (!section.open) list.style.display = 'none';
  section.lessons.forEach((lesson) => list.appendChild(buildLessonRow(lesson)));

  wrap.append(head, list);
  return wrap;
}

/**
 * Gambar ulang seluruh akordeon silabus untuk satu peran.
 * Judul kartu ("Struktur Silabus Pembelajaran") dipertahankan.
 */
export function renderSyllabus(syllabus) {
  const card = document.querySelector('.course-content-accordion-card');

  if (card) {
    card.querySelectorAll('.accordion-section, .silabus-kosong').forEach((el) => el.remove());
    if (syllabus && syllabus.length) {
      syllabus.forEach((section) => card.appendChild(buildSection(section)));
    }
  }

  // Sidebar ikut digambar walau kartu akordeonnya tidak ada di halaman ini.
  renderNavModul(syllabus);
}

/* ==========================================================================
   DAFTAR MODUL DI SIDEBAR

   Satu baris per modul, di sidebar desktop DAN drawer mobile sekaligus —
   keduanya diisi dari daftar yang sama supaya tidak ada satu pun keadaan
   di mana ponsel dan desktop menampilkan daftar materi yang berbeda.
   ========================================================================== */

/** Wadah daftar modul: sidebar desktop + drawer mobile. */
const WADAH_NAV_MODUL = ['sidebarModulList', 'drawerModulList'];

function buildNavModulItem(section, index) {
  const li = document.createElement('li');

  const a = document.createElement('a');
  a.className = 'ref-nav-subitem';
  if (section.accent === 'emas') a.classList.add('is-gold');
  a.dataset.modul = String(index);
  a.title = section.title;

  const num = document.createElement('span');
  num.className = 'nav-subitem-num';
  num.textContent = section.code;

  const label = document.createElement('span');
  label.className = 'nav-subitem-label';
  label.textContent = section.title;

  a.append(num, label);
  a.addEventListener('click', () => bukaModul(index));

  li.appendChild(a);
  return li;
}

/** Gambar ulang daftar modul di sidebar & drawer dari silabus yang aktif. */
export function renderNavModul(syllabus) {
  WADAH_NAV_MODUL.forEach((id) => {
    const wadah = document.getElementById(id);
    if (!wadah) return;

    wadah.replaceChildren();

    if (!syllabus || !syllabus.length) {
      const kosong = document.createElement('li');
      kosong.className = 'ref-nav-sub-empty';
      kosong.textContent = 'Belum ada modul untuk jenjang ini.';
      wadah.appendChild(kosong);
    } else {
      syllabus.forEach((section, i) => wadah.appendChild(buildNavModulItem(section, i)));
    }

    // Terbuka secara bawaan. Kalau santri menutupnya sendiri lewat
    // toggleMateriNav (js/ui/shell.js), kelas ini yang dilepas — dan
    // penggambaran ulang di sini menghormatinya, tidak memaksa buka lagi.
    if (!wadah.dataset.ditutupPengguna) wadah.classList.add('is-open');
  });

  sorotModulAktif(-1);
}

/** Sorot satu modul di daftar sidebar; -1 untuk membersihkan sorotan. */
export function sorotModulAktif(index) {
  document.querySelectorAll('.ref-nav-subitem').forEach((el) => {
    el.classList.toggle('active', Number(el.dataset.modul) === index);
  });
}

/**
 * Buka satu modul dari sidebar: pindah ke tampilan kurikulum, bentangkan
 * akordeon modul itu, lalu gulirkan ke posisinya.
 *
 * Penundaan singkat sebelum menggulir memang disengaja: switchMainView
 * mengembalikan posisi gulir ke atas (dan runtime mobile memanggil
 * window.scrollTo sendiri sesudahnya). Menggulir tanpa jeda berarti
 * gulirannya langsung ditimpa balik dan modulnya tidak pernah terlihat.
 */
export function bukaModul(index) {
  if (window.PrototypeApp?.switchMainView) window.PrototypeApp.switchMainView('kurikulum');
  sorotModulAktif(index);

  setTimeout(() => {
    const seksi = document.querySelectorAll('.course-content-accordion-card .accordion-section')[index];
    if (!seksi) return;

    const head = seksi.querySelector('.section-head');
    const list = seksi.querySelector('.lesson-sub-list');
    if (list && list.style.display === 'none') toggleAccordion(head);

    seksi.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 90);
}

/** Buka atau tutup satu bagian silabus. */
export function toggleAccordion(headEl) {
  if (!headEl) return;
  const list = headEl.parentElement ? headEl.parentElement.querySelector('.lesson-sub-list') : null;
  const caret = headEl.querySelector('.toggle-caret');
  if (!list) return;

  const isOpen = list.style.display !== 'none';
  list.style.display = isOpen ? 'none' : 'block';
  headEl.classList.toggle('is-open', !isOpen);

  if (caret) {
    caret.classList.remove('ph-caret-up', 'ph-caret-down');
    caret.classList.add(isOpen ? 'ph-caret-down' : 'ph-caret-up');
  }
  playTone(isOpen ? 460 : 560, 'sine', 0.07, 0.045);
}

/**
 * Keadaan kosong akordeon silabus — dipakai saat jenjang santri belum punya
 * satu pun modul berstatus terbit.
 *
 * Sampai 11 September 2026 keadaan ini tidak pernah terlihat: kalau konten
 * asli belum ada, silabus PERAGA dari js/data/roles.js yang tampil. Santri
 * jadi melihat empat modul lengkap dengan durasi dan kunci gembok — untuk
 * materi yang belum pernah ditulis siapa pun.
 */
export function tampilkanSilabusKosong(
  pesan = 'Belum ada modul terbit untuk jenjang ini.',
) {
  const card = document.querySelector('.course-content-accordion-card');
  if (card) {
    card.querySelectorAll('.accordion-section, .silabus-kosong').forEach((el) => el.remove());

    const kosong = document.createElement('div');
    kosong.className = 'silabus-kosong';

    const judul = document.createElement('div');
    judul.className = 'kosong-judul';
    judul.textContent = pesan;

    const sub = document.createElement('div');
    sub.className = 'kosong-sub';
    sub.textContent = 'Modul yang diterbitkan pengurus lewat Studio Kurikulum akan muncul di sini.';

    kosong.append(judul, sub);
    card.appendChild(kosong);
  }

  renderNavModul([]);
}
