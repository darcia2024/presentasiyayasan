/**
 * Mode 1 — TAMBANG PASANGAN
 *
 * Gali blok batu, temukan pasangan: kata Arab dan artinya. Terinspirasi
 * permainan kartu-ingat (Quizlet Match, memory card). Tidak ada nyawa —
 * anak kecil tidak perlu "kalah" di sini; hanya jumlah langkah yang menentukan
 * bintang.
 */

import { siapkanPasangan, cocok, bintangPasangan } from './logika.js';
import { elemen, bilahMode } from './umum.js';
import { urlTekstur, kanvasSprite } from './sprite.js';

const JUMLAH_PASANGAN = 6;
const JEDA_SALAH_MS = 900;

export function mulaiPasangan({ kata, wadah, karakter, suara, selesai, keluar }) {
  const kartu = siapkanPasangan(kata, JUMLAH_PASANGAN);
  const jumlahPasang = kartu.length / 2;
  let terbuka = null;
  let kunci = false;
  let langkah = 0;
  let cocokSekarang = 0;
  const awal = Date.now();
  let timer = null;
  let berhenti = false;
  const salah = new Set();

  const { bilah, info } = bilahMode({ judul: 'Tambang Pasangan', onKeluar: keluar, denganNyawa: false });
  const waktu = elemen('span', { kelas: 'pg-info', teks: '0:00' });
  bilah.appendChild(waktu);

  const kolom = elemen('div', { kelas: 'pg-pasangan-grid' });
  kolom.style.setProperty('--tekstur-batu', `url(${urlTekstur('batu')})`);
  kolom.style.setProperty('--tekstur-bijih', `url(${urlTekstur('bijih')})`);

  const tombol = new Map();
  kartu.forEach((k, i) => {
    const b = elemen('button', {
      kelas: `pg-blok pg-blok--${k.jenis}`,
      atribut: { type: 'button', 'aria-label': `Blok tertutup nomor ${i + 1}` },
    });
    b.appendChild(elemen('span', { kelas: 'pg-blok-teks', teks: k.teks, atribut: k.jenis === 'arab' ? { lang: 'ar', dir: 'rtl' } : {} }));
    b.addEventListener('click', () => gali(k, b));
    tombol.set(k.id, b);
    kolom.appendChild(b);
  });

  const sapa = elemen('div', { kelas: 'pg-sapa' }, [
    kanvasSprite(karakter, 4, 'pg-tokoh'),
    elemen('p', { kelas: 'pg-gelembung', teks: 'Gali blok, cocokkan kata Arab dengan artinya!' }),
  ]);
  const gelembung = sapa.querySelector('.pg-gelembung');

  wadah.replaceChildren(bilah, sapa, kolom);

  function perbaruiInfo() {
    info.textContent = `${cocokSekarang}/${jumlahPasang} pasang · ${langkah} langkah`;
  }
  perbaruiInfo();
  timer = setInterval(() => {
    const d = Math.floor((Date.now() - awal) / 1000);
    waktu.textContent = `${Math.floor(d / 60)}:${String(d % 60).padStart(2, '0')}`;
  }, 500);

  function buka(b, k) {
    b.classList.add('terbuka');
    b.setAttribute('aria-label', `${k.jenis === 'arab' ? 'Kata Arab' : 'Arti'}: ${k.teks}`);
  }
  function tutup(b, i) {
    b.classList.remove('terbuka');
    b.setAttribute('aria-label', `Blok tertutup nomor ${i + 1}`);
  }

  function gali(k, b) {
    if (kunci || berhenti || b.classList.contains('cocok') || b.classList.contains('terbuka')) return;
    buka(b, k);
    suara.nada(520 + Math.random() * 60, 0.07, 0.05);
    if (k.jenis === 'arab') suara.ucap(k.kata);

    if (!terbuka) {
      terbuka = { k, b };
      return;
    }
    langkah++;
    const pertama = terbuka;
    terbuka = null;

    if (cocok(pertama.k, k)) {
      pertama.b.classList.add('cocok');
      b.classList.add('cocok');
      cocokSekarang++;
      suara.nada(784, 0.16, 0.07);
      gelembung.textContent = `${k.kata.arab} = ${k.kata.arti}. Bagus!`;
      perbaruiInfo();
      if (cocokSekarang === jumlahPasang) akhir();
      return;
    }
    salah.add(pertama.k.pasang);
    salah.add(k.pasang);
    kunci = true;
    suara.nada(280, 0.14, 0.05);
    perbaruiInfo();
    setTimeout(() => {
      if (berhenti) return;
      tutup(pertama.b, kartu.indexOf(pertama.k));
      tutup(b, kartu.indexOf(k));
      kunci = false;
    }, JEDA_SALAH_MS);
  }

  function akhir() {
    clearInterval(timer);
    const bintang = bintangPasangan(langkah, jumlahPasang);
    const ringkas = kartu
      .filter((k) => k.jenis === 'arab')
      .map((k) => ({ kata: k.kata, benar: !salah.has(k.pasang) }));
    suara.nada(988, 0.25, 0.08);
    setTimeout(() => {
      if (!berhenti) selesai({ bintang, ringkas, catatan: `${langkah} langkah untuk ${jumlahPasang} pasang.` });
    }, 700);
  }

  return {
    hentikan() {
      berhenti = true;
      clearInterval(timer);
    },
  };
}
