/**
 * PERISA AZHARIYAH — Kuis Evaluasi Pemahaman (Fase 4, dirombak audit K2)
 *
 * SOAL DATANG DARI SERVER, bukan disusun di sini.
 *
 * Sebelum 10 Sep 2026, modul inilah yang memilih mufrodat mana yang
 * ditanyakan dan mana pengecohnya, lalu mengirim id soal + id jawaban ke
 * server. Karena keduanya berasal dari klien, server tidak pernah
 * benar-benar menilai apa pun — komentar lama di berkas ini bahkan
 * menjanjikan sebaliknya, dan janji itu tidak ditegakkan satu baris pun.
 *
 * Sekarang: kuis-soal menerbitkan soal (token buram + daftar arti berkunci
 * "a".."d"), submit-jawaban menilai dengan membaca jawaban benar dari
 * barisnya sendiri. Modul ini betul-betul cuma tampilan — dan kali ini
 * pernyataan itu bisa dibuktikan: tidak ada satu pun nilai di sini yang
 * ikut menentukan benar/salah.
 *
 * Seluruh teks dari basis data ditulis lewat textContent, bukan innerHTML
 * (lihat audit S4) — arab/latin/arti diketik manusia lewat Studio.
 */

import { ambilSoal, kirimJawaban, santriAktifId } from '../core/kuis-client.js';
import { playTone, showToast } from '../core/feedback.js';

const ID_KONTAINER = 'kuisContainer';

/** @type {{pelajaranId:string, token:string|null, memuat:boolean}|null} */
let sesiKuis = null;

/* --------------------------------------------------------------- utilitas */

function el(tag, gaya, teks) {
  const n = document.createElement(tag);
  if (gaya) n.style.cssText = gaya;
  if (teks !== undefined) n.textContent = teks;
  return n;
}

function kosongkan(kontainer) {
  while (kontainer.firstChild) kontainer.removeChild(kontainer.firstChild);
}

/* ------------------------------------------------------------------ masuk */

/**
 * Mulai kuis untuk satu pelajaran.
 * @param {string} pelajaranId
 * @returns {Promise<boolean>} true kalau kuis sungguhan berhasil ditampilkan.
 */
export async function renderKuis(pelajaranId) {
  const kontainer = document.getElementById(ID_KONTAINER);
  if (!kontainer || !pelajaranId) return false;

  const santriId = santriAktifId();
  if (!santriId) return false; // sesi peraga/staff tanpa profil anak — biarkan peraga tampil

  sesiKuis = { pelajaranId, token: null, memuat: false };
  return muatSoal(kontainer);
}

/* ------------------------------------------------------------ satu putaran */

async function muatSoal(kontainer) {
  if (!sesiKuis || sesiKuis.memuat) return false;
  const santriId = santriAktifId();
  if (!santriId) return false;

  sesiKuis.memuat = true;
  tampilkanMemuat(kontainer);

  let soal;
  try {
    soal = await ambilSoal({ santriId, pelajaranId: sesiKuis.pelajaranId });
  } catch (e) {
    sesiKuis.memuat = false;
    // AUDIT 10 Sep 2026 (M12): dulu di sini `return false` dan peraga lama
    // dibiarkan tampil. Untuk sesi SUNGGUHAN itu berarti seorang anak
    // melihat soal karangan ("المَكْتَبَةُ") seolah itu pelajarannya,
    // lengkap dengan tombol yang mengaku "pemahaman telah diverifikasi".
    // Sekarang keadaan kosongnya dikatakan apa adanya.
    //   404 = pelajaran/modulnya belum terbit
    //   409 = mufrodatnya belum cukup untuk dijadikan soal
    if (e.status === 409 || e.status === 404) {
      tampilkanPesan(
        kontainer,
        'Kuis untuk pelajaran ini belum tersedia — materinya belum diterbitkan Umi Elly.',
      );
      return false;
    }
    tampilkanPesan(kontainer, e.message || 'Gagal memuat soal. Coba muat ulang halaman.');
    return false;
  }

  sesiKuis.memuat = false;
  sesiKuis.token = soal.token;
  tampilkanSoal(kontainer, soal);
  return true;
}

function tampilkanMemuat(kontainer) {
  kosongkan(kontainer);
  kontainer.appendChild(
    el('div', 'text-align:center; padding:18px 8px; font-size:12.5px; color:var(--text-muted);', 'Menyiapkan soal…'),
  );
}

function tampilkanPesan(kontainer, pesan) {
  kosongkan(kontainer);
  kontainer.appendChild(el('div', 'text-align:center; padding:18px 8px; font-size:12.5px; color:var(--text-muted);', pesan));
}

function tampilkanSoal(kontainer, soal) {
  kosongkan(kontainer);

  /* --- kepala: label + progres penguasaan --- */
  const header = el('div', 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; gap:8px;');
  header.appendChild(
    el('span', 'font-size:11px; font-weight:700; color:var(--teal-primary); text-transform:uppercase;', 'Evaluasi Pemahaman Mufrodat'),
  );
  header.appendChild(
    el(
      'span',
      'font-size:11px; color:var(--text-muted); white-space:nowrap;',
      `Dikuasai ${soal.sudahDikuasai} dari ${soal.totalMufrodat}`,
    ),
  );
  kontainer.appendChild(header);

  /* --- pertanyaan --- */
  const pertanyaan = el('div', 'font-size:13.5px; font-weight:700; color:var(--teal-dark); line-height:1.5; margin-bottom:12px;');
  pertanyaan.appendChild(document.createTextNode('Apa arti kosakata: '));
  const arab = el(
    'strong',
    "color:var(--teal-primary); font-size:19px; font-family:'Amiri',Arial;",
    `"${soal.arab}"`,
  );
  pertanyaan.appendChild(arab);
  pertanyaan.appendChild(document.createTextNode(` (${soal.latin})?`));
  kontainer.appendChild(pertanyaan);

  /* --- pilihan --- */
  const hurufTampil = ['A', 'B', 'C', 'D', 'E', 'F'];
  const daftarTombol = el('div', 'display:flex; flex-direction:column; gap:8px; margin-bottom:4px;');

  soal.opsi.forEach((opsi, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn-enroll-primary';
    btn.dataset.kunci = opsi.kunci;
    btn.style.cssText =
      'background:#FFFFFF; border:1px solid var(--border-color); color:var(--text-main); text-align:left; justify-content:flex-start; padding:10px 14px;';
    btn.textContent = `${hurufTampil[i]}. ${opsi.arti}`;
    btn.addEventListener('click', () => jawabSoal(kontainer, opsi.kunci, daftarTombol));
    daftarTombol.appendChild(btn);
  });

  kontainer.appendChild(daftarTombol);
}

/* ---------------------------------------------------------------- menjawab */

async function jawabSoal(kontainer, kunci, daftarTombol) {
  if (!sesiKuis?.token) return;

  const tombol = [...daftarTombol.children];
  tombol.forEach((b) => (b.disabled = true));
  const tokenDipakai = sesiKuis.token;
  sesiKuis.token = null; // cegah klik ganda mengirim dua kali

  let hasil;
  try {
    hasil = await kirimJawaban({ soalToken: tokenDipakai, pilihan: kunci });
  } catch (e) {
    // 409 (sudah dijawab) & 410 (kedaluwarsa) bukan kesalahan anak —
    // ambil soal baru, jangan tampilkan error teknis.
    if (e.status === 409 || e.status === 410) {
      showToast('Soalnya kedaluwarsa. Menyiapkan soal baru…');
      muatSoal(kontainer);
      return;
    }
    showToast(e.message || 'Gagal mengirim jawaban. Coba lagi.');
    sesiKuis.token = tokenDipakai;
    tombol.forEach((b) => (b.disabled = false));
    return;
  }

  tandaiPilihan(tombol, kunci, hasil);

  if (hasil.benar) {
    playTone(659, 'sine', 0.14, 0.08);
    showToast(
      hasil.sudahPernah ? 'Benar! (sudah pernah dijawab, tidak ada XP tambahan)' : `Benar! +${hasil.xpDidapat} XP`,
    );
    if (hasil.lencanaBaru?.length) setTimeout(() => showToast('Lencana baru diraih!'), 900);
  } else {
    playTone(300, 'sine', 0.18, 0.08);
    showToast(`Belum tepat. Jawaban yang benar: "${hasil.artiBenar}".`);
  }

  if (hasil.pelajaranSelesai) {
    setTimeout(() => {
      showToast('Pelajaran ini selesai — semua mufrodat sudah dikuasai!');
      tampilkanSelesai(kontainer);
    }, 1400);
    return;
  }

  setTimeout(() => muatSoal(kontainer), 1400);
}

/** Warnai pilihan yang dipilih & yang benar, supaya anak melihat koreksinya. */
function tandaiPilihan(tombol, kunciDipilih, hasil) {
  for (const b of tombol) {
    const k = b.dataset.kunci;
    if (k === hasil.kunciBenar) {
      b.style.borderColor = 'var(--teal-primary)';
      b.style.background = 'var(--teal-light, #E8F4F2)';
    } else if (k === kunciDipilih && !hasil.benar) {
      b.style.borderColor = '#B4232A';
      b.style.background = '#FCEDED';
    }
  }
}

function tampilkanSelesai(kontainer) {
  kosongkan(kontainer);
  const wrap = el('div', 'text-align:center; padding:20px 8px;');

  const ikon = el('div', 'font-size:30px; margin-bottom:8px; color:var(--gold-dark);');
  const i = document.createElement('i');
  i.className = 'ph ph-confetti';
  ikon.appendChild(i);

  wrap.appendChild(ikon);
  wrap.appendChild(
    el('div', 'font-size:14px; font-weight:700; color:var(--teal-dark); margin-bottom:4px;', 'Semua mufrodat pelajaran ini sudah dikuasai'),
  );
  wrap.appendChild(el('div', 'font-size:12px; color:var(--text-muted);', 'Buka pelajaran lain untuk terus menambah XP.'));
  kontainer.appendChild(wrap);
}
