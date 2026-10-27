/**
 * Mode 3 — HUJAN BLOK
 *
 * Blok bertuliskan kata Arab jatuh dari langit ke arah kampung. Pilih arti
 * yang benar sebelum blok mendarat; jawaban benar membuat tokoh menembakkan
 * panah dan blok pecah jadi bintang. Terinspirasi Quizlet Gravity, dengan
 * satu blok sekali jatuh dan pilihan ganda (bukan mengetik) supaya cocok
 * untuk anak SD. Kecepatan naik pelan-pelan; blok yang mendarat mengurangi
 * satu nyawa.
 */

import { kocok, siapkanPilihan, kecepatanJatuh, bintangDariNyawa } from './logika.js';
import { elemen, bilahMode, gambarNyawa, tombolDengar } from './umum.js';
import { gambarSprite, gambarBlok, ukuranSprite } from './sprite.js';

const LEBAR = 360;
const TINGGI = 460;
const TANAH = 64; // tinggi lajur tanah di bawah
const UKURAN_BLOK = 86;
const NYAWA_AWAL = 3;
const JUMLAH_SOAL = 10;

export function mulaiHujan({ kata, wadah, karakter, suara, selesai, keluar }) {
  const urutan = kocok(kata).slice(0, JUMLAH_SOAL);
  let nomor = -1;
  let nyawa = NYAWA_AWAL;
  let berhenti = false;
  let soal = null;
  let blok = null;
  let panah = null;
  let serpih = [];
  let retak = 0;
  let terakhir = 0;
  let rAF = 0;
  const ringkas = [];
  /** Hasil pertama sebuah kata yang dihitung: salah lalu benar tetap tercatat salah. */
  const catat = (k, benar) => { if (!ringkas.some((r) => r.kata === k)) ringkas.push({ kata: k, benar }); };

  const { bilah, info, nyawa: wadahNyawa } = bilahMode({ judul: 'Hujan Blok', onKeluar: keluar });
  const kanvas = elemen('canvas', { kelas: 'pg-hujan-kanvas', atribut: { width: String(LEBAR), height: String(TINGGI), 'aria-label': 'Blok kata yang sedang jatuh' } });
  const ctx = kanvas.getContext('2d');
  const pilihan = elemen('div', { kelas: 'pg-pilihan', atribut: { role: 'group', 'aria-label': 'Pilih arti yang benar' } });
  const dengar = tombolDengar(() => soal && suara.ucap(soal.kata), 'Dengarkan kata');
  wadah.replaceChildren(bilah, kanvas, dengar, pilihan);

  const awan = Array.from({ length: 4 }, (_, i) => ({ x: i * 110 + 20, y: 30 + (i % 2) * 42, v: 4 + i }));

  function perbaruiAtas() {
    info.textContent = `Kata ${Math.min(nomor + 1, urutan.length)}/${urutan.length}`;
    gambarNyawa(wadahNyawa, nyawa, NYAWA_AWAL);
  }

  function soalBaru() {
    nomor++;
    if (nomor >= urutan.length) {
      akhir();
      return;
    }
    soal = siapkanPilihan(urutan[nomor], kata, 3);
    blok = {
      x: 30 + Math.random() * (LEBAR - UKURAN_BLOK - 60),
      y: -20,
      v: kecepatanJatuh(nomor),
      kata: soal.kata,
    };
    pilihan.replaceChildren();
    soal.pilihan.forEach((teks) => {
      const b = elemen('button', { kelas: 'pg-pilih', teks, atribut: { type: 'button' } });
      b.addEventListener('click', () => jawab(teks, b));
      pilihan.appendChild(b);
    });
    perbaruiAtas();
  }

  function pecah(x, y, warna) {
    for (let i = 0; i < 14; i++) {
      serpih.push({
        x, y,
        vx: (Math.random() - 0.5) * 220,
        vy: -Math.random() * 200 - 40,
        t: 0.7 + Math.random() * 0.4,
        w: 6 + Math.random() * 8,
        warna,
      });
    }
  }

  function jawab(teks, tombol) {
    if (!blok || berhenti || panah) return;
    if (teks === soal.benar) {
      pilihan.querySelectorAll('button').forEach((b) => { b.disabled = true; });
      tombol.classList.add('benar');
      panah = { x: 56, y: TINGGI - TANAH - 40, tujuanX: blok.x + UKURAN_BLOK / 2, tujuanY: blok.y + UKURAN_BLOK / 2 };
      suara.nada(660, 0.1, 0.07);
      catat(soal.kata, true);
      return;
    }
    tombol.disabled = true;
    tombol.classList.add('salah');
    suara.nada(250, 0.18, 0.06);
    catat(soal.kata, false);
    kehilanganNyawa();
  }

  function kehilanganNyawa() {
    nyawa--;
    perbaruiAtas();
    if (nyawa <= 0) setTimeout(akhir, 500);
  }

  function mendarat() {
    suara.nada(180, 0.25, 0.07);
    retak = 0.5;
    catat(soal.kata, false);
    pecah(blok.x + UKURAN_BLOK / 2, TINGGI - TANAH, '#8a8f94');
    blok = null;
    nyawa--;
    perbaruiAtas();
    if (nyawa <= 0) {
      setTimeout(akhir, 500);
      return;
    }
    setTimeout(() => !berhenti && soalBaru(), 700);
  }

  function perbarui(dt) {
    awan.forEach((a) => { a.x = (a.x + a.v * dt) % (LEBAR + 80); });
    serpih = serpih.filter((s) => (s.t -= dt) > 0);
    serpih.forEach((s) => { s.x += s.vx * dt; s.y += s.vy * dt; s.vy += 520 * dt; });
    if (retak > 0) retak -= dt;

    if (panah) {
      const dx = panah.tujuanX - panah.x;
      const dy = panah.tujuanY - panah.y;
      const jarak = Math.hypot(dx, dy);
      const langkah = 900 * dt;
      if (jarak <= langkah) {
        pecah(panah.tujuanX, panah.tujuanY, '#ffd23f');
        suara.nada(880, 0.18, 0.08);
        suara.ucap(blok.kata);
        panah = null;
        blok = null;
        setTimeout(() => !berhenti && soalBaru(), 900);
        return;
      }
      panah.x += (dx / jarak) * langkah;
      panah.y += (dy / jarak) * langkah;
      if (blok) blok.y += blok.v * dt * 0.2;
      return;
    }

    if (blok && nyawa > 0) {
      blok.y += blok.v * dt;
      if (blok.y + UKURAN_BLOK >= TINGGI - TANAH) mendarat();
    }
  }

  function gambar() {
    const langit = ctx.createLinearGradient(0, 0, 0, TINGGI);
    langit.addColorStop(0, '#7ec8ff');
    langit.addColorStop(1, '#d6f0ff');
    ctx.fillStyle = langit;
    ctx.fillRect(0, 0, LEBAR, TINGGI);

    ctx.fillStyle = 'rgba(255,255,255,.9)';
    awan.forEach((a) => {
      const x = a.x - 80;
      ctx.fillRect(x, a.y, 64, 16);
      ctx.fillRect(x + 12, a.y - 10, 36, 12);
    });

    // Tanah: dua baris blok bertekstur.
    for (let x = 0; x < LEBAR; x += 32) {
      gambarBlok(ctx, 'rumput', x, TINGGI - TANAH, 32);
      gambarBlok(ctx, 'tanah', x, TINGGI - TANAH + 32, 32);
    }

    const t = ukuranSprite(karakter);
    gambarSprite(ctx, karakter, 14, TINGGI - TANAH - t.tinggi * 3, 3);

    if (blok) {
      gambarBlok(ctx, 'kayu', blok.x, blok.y, UKURAN_BLOK);
      ctx.fillStyle = '#fff8e6';
      ctx.fillRect(blok.x + 8, blok.y + 8, UKURAN_BLOK - 16, UKURAN_BLOK - 16);
      ctx.fillStyle = '#2b1d10';
      ctx.font = '700 28px Amiri, "Traditional Arabic", serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.direction = 'rtl';
      ctx.fillText(blok.kata.arab, blok.x + UKURAN_BLOK / 2, blok.y + UKURAN_BLOK / 2 + 4, UKURAN_BLOK - 22);
      ctx.direction = 'ltr';
    }
    if (panah) {
      ctx.fillStyle = '#5b3a1b';
      ctx.fillRect(panah.x - 12, panah.y - 2, 24, 4);
      ctx.fillStyle = '#e8e8e8';
      ctx.fillRect(panah.x + 10, panah.y - 4, 6, 8);
    }
    serpih.forEach((s) => {
      ctx.fillStyle = s.warna;
      ctx.fillRect(s.x, s.y, s.w, s.w);
    });
    if (retak > 0) {
      ctx.fillStyle = `rgba(239,75,75,${retak})`;
      ctx.fillRect(0, 0, LEBAR, TINGGI);
    }
  }

  function putaran(waktu) {
    if (berhenti) return;
    const dt = Math.min(0.05, (waktu - terakhir) / 1000 || 0);
    terakhir = waktu;
    perbarui(dt);
    gambar();
    rAF = requestAnimationFrame(putaran);
  }

  function akhir() {
    if (berhenti) return;
    berhenti = true;
    cancelAnimationFrame(rAF);
    const bintang = bintangDariNyawa(nyawa, NYAWA_AWAL);
    // Kata yang belum sempat muncul tidak dihitung sebagai salah.
    selesai({
      bintang,
      ringkas,
      catatan: nyawa <= 0 ? 'Nyawa habis. Coba lagi, ya!' : `Sisa nyawa ${nyawa} dari ${NYAWA_AWAL}.`,
    });
  }

  (document.fonts?.load ? document.fonts.load('700 30px Amiri').catch(() => {}) : Promise.resolve()).then(() => {
    if (berhenti) return;
    soalBaru();
    rAF = requestAnimationFrame(putaran);
  });

  return {
    hentikan() {
      berhenti = true;
      cancelAnimationFrame(rAF);
    },
  };
}
