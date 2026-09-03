/**
 * PERISA AZHARIYAH — Akordeon Struktur Silabus
 *
 * Seluruh akordeon dirender dari data peran, bukan ditulis keras di HTML.
 * Sebelum perubahan ini `setRole` memakai querySelector tunggal sehingga hanya
 * bagian pertama yang ikut berganti; tiga bagian sisanya tetap menampilkan
 * materi SMP dan SMA apa pun jenjang santrinya.
 */

import { playTone, showToast } from '../core/feedback.js';

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

  return row;
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
  if (!card) return;

  card.querySelectorAll('.accordion-section').forEach((el) => el.remove());

  if (!syllabus || !syllabus.length) return;
  syllabus.forEach((section) => card.appendChild(buildSection(section)));
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
