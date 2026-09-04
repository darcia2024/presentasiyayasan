/**
 * PERISA AZHARIYAH — Papan Peringkat Jenjang (Fase 4)
 *
 * Menggambar ulang tiga baris peraga di kartu "Papan Peringkat Jenjang"
 * pada Beranda dengan data XP sungguhan dari RPC papan_peringkat() —
 * pola yang sama dengan renderSyllabus()/renderMufrodatCards(): peraga
 * dulu (sudah tertulis statis di prototype.html), digantikan begitu ada
 * santri dengan XP tercatat di jenjang aktif. Kalau belum ada seorang
 * pun, peraga tetap tampil apa adanya.
 *
 * RPC papan_peringkat() adalah SECURITY DEFINER dan sengaja hanya
 * mengembalikan nama, inisial, dan total XP — tidak ada nomor telepon
 * atau data pribadi lain yang bisa bocor lintas keluarga.
 */

import { ambilPapanPeringkat } from '../core/kuis-client.js';

const ID_KONTAINER = 'papanPeringkatContainer';

const WARNA_AVATAR = ['var(--teal-primary)', '#8B7FD1', '#D18B7F', '#7FA8D1', '#B58BD1'];

function inisialDari(nama) {
  const bagian = (nama || '').trim().split(/\s+/).filter(Boolean);
  if (!bagian.length) return '?';
  return bagian
    .slice(0, 2)
    .map((b) => b[0].toUpperCase())
    .join('');
}

function buatBaris(baris, indeks) {
  const wrap = document.createElement('div');
  wrap.className = 'papan-peringkat-row';
  wrap.style.cssText = `display: flex; align-items: center; gap: 10px; padding: 8px 10px; border-radius: var(--radius-sm); ${
    indeks === 0 ? 'background: var(--gold-light);' : ''
  }`;

  const nomor = document.createElement('div');
  nomor.style.cssText = `font-size: 12px; font-weight: 800; width: 18px; color: ${
    indeks === 0 ? 'var(--gold-dark)' : 'var(--text-muted)'
  };`;
  nomor.textContent = String(baris.peringkat ?? indeks + 1);

  const avatar = document.createElement('div');
  const warna = indeks === 0 ? 'var(--teal-primary)' : WARNA_AVATAR[indeks % WARNA_AVATAR.length];
  avatar.style.cssText = `width: 28px; height: 28px; border-radius: 50%; background: ${warna}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 11px; font-weight: 700;`;
  avatar.textContent = baris.inisial || inisialDari(baris.nama);

  const nama = document.createElement('div');
  nama.style.cssText = 'flex: 1; font-size: 12.5px; font-weight: 700; color: var(--teal-dark);';
  nama.textContent = baris.nama || 'Santri';

  const xp = document.createElement('div');
  xp.style.cssText = 'font-size: 12px; font-weight: 800; color: var(--teal-dark);';
  xp.textContent = `${Number(baris.total_xp || 0).toLocaleString('id-ID')} XP`;

  wrap.append(nomor, avatar, nama, xp);
  return wrap;
}

/**
 * @param {'sd'|'smp'|'sma'} jenjang
 * @returns {Promise<boolean>} true kalau papan asli berhasil digambar (bukan peraga).
 */
export async function upgradePapanPeringkat(jenjang) {
  const kontainer = document.getElementById(ID_KONTAINER);
  if (!kontainer || !jenjang) return false;

  const daftar = await ambilPapanPeringkat(jenjang);
  if (!daftar || !daftar.length) return false; // belum ada XP tercatat — biarkan peraga tampil

  kontainer.innerHTML = '';
  daftar.forEach((baris, i) => kontainer.appendChild(buatBaris(baris, i)));
  return true;
}
