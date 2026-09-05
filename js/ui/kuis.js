/**
 * PERISA AZHARIYAH — Kuis Evaluasi Pemahaman (Fase 4)
 *
 * Pilihan ganda dibangkitkan dari mufrodat pelajaran yang sedang aktif:
 * satu mufrodat jadi target (arab+latin ditampilkan), arti-nya sendiri
 * jadi jawaban benar, arti mufrodat LAIN di pelajaran yang sama jadi
 * pengecoh. Jawaban yang dikirim ke server adalah ID mufrodat yang
 * dipilih — lihat supabase/functions/submit-jawaban/index.ts untuk kenapa
 * bentuknya begitu (ID, bukan teks bebas, supaya "benar/salah" tidak
 * ambigu).
 *
 * SEMUA keputusan "benar atau salah" dan SEMUA penulisan XP terjadi di
 * server. Modul ini murni tampilan — coba mengubah variabel di sini lewat
 * konsol tidak memberi XP sepeser pun, karena server yang menghitung ulang
 * dari basis data, bukan percaya begitu saja apa yang dikirim klien.
 */

import { kirimJawaban, santriAktifId } from '../core/kuis-client.js';
import { playTone, showToast } from '../core/feedback.js';
import { escapeHtml } from '../core/html.js';

const ID_KONTAINER = 'kuisContainer';
const JUMLAH_PILIHAN = 4;

let sesiKuis = null; // { pelajaranId, daftar: [...], indeks: 0 }

function kocokAcak(arr) {
  const salinan = [...arr];
  for (let i = salinan.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [salinan[i], salinan[j]] = [salinan[j], salinan[i]];
  }
  return salinan;
}

function buatPilihan(target, seluruhMufrodat) {
  const lainnya = seluruhMufrodat.filter((m) => m.id !== target.id);
  const pengecoh = kocokAcak(lainnya).slice(0, JUMLAH_PILIHAN - 1);
  return kocokAcak([target, ...pengecoh]);
}

/**
 * @param {Array} daftarMufrodat mufrodat pelajaran yang sedang aktif.
 * @param {string} pelajaranId
 */
export function renderKuis(daftarMufrodat, pelajaranId) {
  const kontainer = document.getElementById(ID_KONTAINER);
  if (!kontainer) return false;

  if (!daftarMufrodat || daftarMufrodat.length < 2) {
    // Kuis pilihan ganda butuh minimal 2 mufrodat (1 target + 1 pengecoh).
    // Kalau belum cukup, biarkan peraga tetap tampil.
    return false;
  }

  sesiKuis = { pelajaranId, daftar: kocokAcak(daftarMufrodat), indeks: 0, seluruh: daftarMufrodat };
  tampilkanSoal(kontainer);
  return true;
}

function tampilkanSoal(kontainer) {
  if (!sesiKuis || sesiKuis.indeks >= sesiKuis.daftar.length) {
    kontainer.innerHTML = '';
    kontainer.appendChild(kartuSelesai());
    return;
  }

  const target = sesiKuis.daftar[sesiKuis.indeks];
  const pilihan = buatPilihan(target, sesiKuis.seluruh);
  const hurufPilihan = ['A', 'B', 'C', 'D'];

  kontainer.innerHTML = '';

  const header = document.createElement('div');
  header.style.cssText = 'display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;';
  const label = document.createElement('span');
  label.style.cssText = 'font-size:11px; font-weight:700; color:var(--teal-primary); text-transform:uppercase;';
  label.textContent = 'Evaluasi Pemahaman Mufrodat';
  const progres = document.createElement('span');
  progres.style.cssText = 'font-size:11px; color:var(--text-muted);';
  progres.textContent = `Soal ${sesiKuis.indeks + 1} dari ${sesiKuis.daftar.length}`;
  header.append(label, progres);
  kontainer.appendChild(header);

  const pertanyaan = document.createElement('div');
  pertanyaan.style.cssText = 'font-size:13.5px; font-weight:700; color:var(--teal-dark); line-height:1.5; margin-bottom:12px;';
  // Diescape sejak audit 5 Sep 2026 — arab/latin diketik staff lewat Studio.
  pertanyaan.innerHTML = `Apa arti kosakata: <strong style="color:var(--teal-primary); font-size:19px; font-family:'Amiri',Arial;">"${escapeHtml(target.arab)}"</strong> (${escapeHtml(target.latin)})?`;
  kontainer.appendChild(pertanyaan);

  const daftarTombol = document.createElement('div');
  daftarTombol.style.cssText = 'display:flex; flex-direction:column; gap:8px; margin-bottom:4px;';

  pilihan.forEach((opsi, i) => {
    const btn = document.createElement('button');
    btn.className = 'btn-enroll-primary';
    btn.style.cssText =
      'background:#FFFFFF; border:1px solid var(--border-color); color:var(--text-main); text-align:left; justify-content:flex-start; padding:10px 14px;';
    btn.textContent = `${hurufPilihan[i]}. ${opsi.arti}`;
    btn.type = 'button';
    btn.addEventListener('click', () => jawabSoal(kontainer, target, opsi, daftarTombol));
    daftarTombol.appendChild(btn);
  });

  kontainer.appendChild(daftarTombol);
}

async function jawabSoal(kontainer, target, opsiDipilih, daftarTombol) {
  const santriId = santriAktifId();
  if (!santriId) {
    showToast('Masuk sebagai santri untuk mengerjakan evaluasi.');
    return;
  }

  [...daftarTombol.children].forEach((b) => (b.disabled = true));

  try {
    const hasil = await kirimJawaban({
      santriId,
      pelajaranId: sesiKuis.pelajaranId,
      mufrodatId: target.id,
      jawabanMufrodatId: opsiDipilih.id,
    });

    if (hasil.benar) {
      playTone(659, 'sine', 0.14, 0.08);
      const pesanXp = hasil.sudahPernah ? 'Benar! (sudah pernah dijawab, tidak ada XP tambahan)' : `Benar! +${hasil.xpDidapat} XP`;
      showToast(pesanXp);
      if (hasil.lencanaBaru?.length) {
        setTimeout(() => showToast('Lencana baru diraih!'), 900);
      }
      if (hasil.pelajaranSelesai) {
        setTimeout(() => showToast('Pelajaran ini selesai — semua mufrodat sudah dikuasai!'), 1800);
      }
    } else {
      playTone(300, 'sine', 0.18, 0.08);
      showToast(`Belum tepat. Jawaban yang benar: "${target.arti}".`);
    }
  } catch (e) {
    showToast(e.message || 'Gagal mengirim jawaban. Coba lagi.');
    [...daftarTombol.children].forEach((b) => (b.disabled = false));
    return;
  }

  setTimeout(() => {
    sesiKuis.indeks++;
    tampilkanSoal(kontainer);
  }, 1400);
}

function kartuSelesai() {
  const wrap = document.createElement('div');
  wrap.style.cssText = 'text-align:center; padding:20px 8px;';
  wrap.innerHTML = `
    <div style="font-size:30px; margin-bottom:8px; color:var(--gold-dark);"><i class="ph ph-confetti"></i></div>
    <div style="font-size:14px; font-weight:700; color:var(--teal-dark); margin-bottom:4px;">Semua soal selesai dikerjakan</div>
    <div style="font-size:12px; color:var(--text-muted);">Buka pelajaran lain untuk terus menambah XP.</div>
  `;
  return wrap;
}
