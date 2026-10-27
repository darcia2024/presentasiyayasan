/**
 * Mode 2 — SUSUN MENARA KATA
 *
 * Arti dalam bahasa Indonesia tampil; anak menyusun kata Arabnya huruf demi
 * huruf dari blok huruf yang diacak. Terinspirasi latihan "ketuk huruf" ala
 * Duolingo dan permainan susun-kata. Salah menekan = kehilangan satu nyawa;
 * kata yang sudah tersusun diucapkan lengkap dengan harakatnya.
 */

import { kocok, bisaDisusun, siapkanSusun, hurufBenar, bintangDariNyawa } from './logika.js';
import { elemen, bilahMode, gambarNyawa, tombolDengar } from './umum.js';
import { kanvasSprite } from './sprite.js';

const NYAWA_AWAL = 3;
const JUMLAH_SOAL = 5;
export const MINIMAL_SUSUN = 3;

/** Berapa kata yang layak disusun — dipakai menu untuk mematikan mode bila terlalu sedikit. */
export function jumlahKataSusun(kata) {
  return kata.filter((k) => bisaDisusun(k)).length;
}

export function mulaiSusun({ kata, wadah, karakter, suara, selesai, keluar }) {
  const layak = kocok(kata.filter((k) => bisaDisusun(k)));
  const soalSemua = layak.slice(0, JUMLAH_SOAL).map((k) => siapkanSusun(k));
  let nomor = 0;
  let nyawa = NYAWA_AWAL;
  let tersusun = 0;
  let berhenti = false;
  let kunci = false;
  const ringkas = [];
  let salahDiKata = false;

  const { bilah, info, nyawa: wadahNyawa } = bilahMode({ judul: 'Susun Menara Kata', onKeluar: keluar });
  const arti = elemen('p', { kelas: 'pg-arti' });
  const latin = elemen('p', { kelas: 'pg-latin-petunjuk' });
  const tombolLatin = elemen('button', { kelas: 'pg-btn pg-btn--kecil', atribut: { type: 'button' } }, ['Lihat cara baca']);
  const kolomAtas = elemen('div', { kelas: 'pg-susun-atas' }, [
    kanvasSprite(karakter, 4, 'pg-tokoh'),
    elemen('div', {}, [elemen('p', { kelas: 'pg-petunjuk', teks: 'Susun kata Arab untuk arti ini:' }), arti, latin]),
  ]);
  const menara = elemen('div', { kelas: 'pg-menara', atribut: { dir: 'rtl', 'aria-label': 'Kata yang sedang disusun' } });
  const hasilKata = elemen('p', { kelas: 'pg-hasil-kata', atribut: { lang: 'ar', dir: 'rtl' } });
  const ubinWadah = elemen('div', { kelas: 'pg-ubin-wadah', atribut: { dir: 'ltr' } });
  const lanjut = elemen('button', { kelas: 'pg-btn pg-btn--utama', atribut: { type: 'button' } }, ['Lanjut']);
  lanjut.hidden = true;
  const aksi = elemen('div', { kelas: 'pg-aksi' });
  const dengar = tombolDengar(() => suara.ucap(soalSemua[nomor].kata), 'Dengarkan kata');
  aksi.append(dengar, tombolLatin);

  wadah.replaceChildren(bilah, kolomAtas, aksi, menara, hasilKata, ubinWadah, lanjut);

  tombolLatin.addEventListener('click', () => {
    latin.textContent = soalSemua[nomor].kata.latin || 'Belum ada cara baca untuk kata ini.';
    tombolLatin.disabled = true;
  });

  function perbaruiAtas() {
    info.textContent = `Kata ${nomor + 1}/${soalSemua.length}`;
    gambarNyawa(wadahNyawa, nyawa, NYAWA_AWAL);
  }

  function muatSoal() {
    const s = soalSemua[nomor];
    tersusun = 0;
    kunci = false;
    salahDiKata = false;
    arti.textContent = s.kata.arti;
    latin.textContent = '';
    tombolLatin.disabled = false;
    hasilKata.textContent = '';
    lanjut.hidden = true;

    menara.replaceChildren();
    s.huruf.forEach((_, i) => {
      menara.appendChild(elemen('span', { kelas: 'pg-slot', atribut: { 'data-i': String(i) } }));
    });
    ubinWadah.replaceChildren();
    s.ubin.forEach((u) => {
      const b = elemen('button', { kelas: 'pg-ubin', teks: u.huruf, atribut: { type: 'button', lang: 'ar', 'aria-label': `Huruf ${u.huruf}` } });
      b.addEventListener('click', () => tekan(u, b));
      ubinWadah.appendChild(b);
    });
    perbaruiAtas();
  }

  function tekan(u, b) {
    if (kunci || berhenti || b.disabled) return;
    const s = soalSemua[nomor];
    if (hurufBenar(s, tersusun, u)) {
      b.disabled = true;
      b.classList.add('terpakai');
      const slot = menara.querySelector(`[data-i="${tersusun}"]`);
      slot.textContent = u.huruf;
      slot.classList.add('isi');
      tersusun++;
      suara.nada(520 + tersusun * 70, 0.1, 0.06);
      if (tersusun === s.huruf.length) kataSelesai();
      return;
    }
    b.classList.add('salah');
    setTimeout(() => b.classList.remove('salah'), 400);
    salahDiKata = true;
    nyawa--;
    suara.nada(250, 0.18, 0.06);
    perbaruiAtas();
    if (nyawa <= 0) {
      kunci = true;
      setTimeout(() => akhir(), 600);
    }
  }

  function kataSelesai() {
    kunci = true;
    const s = soalSemua[nomor];
    ringkas.push({ kata: s.kata, benar: !salahDiKata });
    hasilKata.textContent = s.kata.arab;
    menara.classList.add('selesai');
    suara.nada(880, 0.2, 0.08);
    suara.ucap(s.kata);
    lanjut.textContent = nomor === soalSemua.length - 1 ? 'Selesai' : 'Lanjut';
    lanjut.hidden = false;
    lanjut.focus({ preventScroll: true });
  }

  lanjut.addEventListener('click', () => {
    if (berhenti) return;
    menara.classList.remove('selesai');
    if (nomor >= soalSemua.length - 1) {
      akhir();
      return;
    }
    nomor++;
    muatSoal();
  });

  function akhir() {
    if (berhenti) return;
    // Nyawa habis di tengah kata: kata itu dicatat belum bisa.
    if (nyawa <= 0 && ringkas.length <= nomor) ringkas.push({ kata: soalSemua[nomor].kata, benar: false });
    const bintang = bintangDariNyawa(nyawa, NYAWA_AWAL);
    selesai({
      bintang,
      ringkas,
      catatan: nyawa <= 0 ? 'Nyawa habis. Coba lagi, ya!' : `Sisa nyawa ${nyawa} dari ${NYAWA_AWAL}.`,
    });
  }

  muatSoal();
  return { hentikan() { berhenti = true; } };
}
