/**
 * PERISA AZHARIYAH — Sumber kata untuk permainan
 *
 * Kata diambil dari MUFRODAT pelajaran yang sudah terbit untuk jenjang santri
 * (sumber yang sama dengan kartu mufrodat di Kurikulum), jadi anak bermain
 * dengan kata yang baru dipelajarinya, bukan kata karangan.
 *
 * PAKET DASAR. Kalau mufrodat terbit kurang dari MINIMAL_KATA (jenjang baru,
 * atau Umi belum mengisi), permainan tetap bisa dimainkan memakai kosakata
 * dasar di bawah — dan layar MENGATAKANNYA ("kosakata contoh"). Berbeda dari
 * data peraga yang dihapus pada 12 Sep 2026: ini bukan nama atau angka
 * karangan yang tampil seolah milik santri, melainkan daftar kata umum yang
 * diberi label jelas, dan dipakai hanya bila materi asli belum cukup.
 */

import { muatSilabusTerbit, muatMufrodatPelajaran } from '../core/content-loader.js';
import { rapikanKata } from './logika.js';

/** Mode Pasangan butuh 6 kata; di bawah ini permainan memakai paket dasar. */
export const MINIMAL_KATA = 6;
const MAKS_PELAJARAN_SEKALI_MUAT = 14;

const PAKET_DASAR = [
  ['كِتَابٌ', 'kitabun', 'buku'],
  ['قَلَمٌ', 'qalamun', 'pena'],
  ['بَابٌ', 'babun', 'pintu'],
  ['بَيْتٌ', 'baitun', 'rumah'],
  ['مَاءٌ', 'ma\'un', 'air'],
  ['شَمْسٌ', 'syamsun', 'matahari'],
  ['قَمَرٌ', 'qamarun', 'bulan'],
  ['أَسَدٌ', 'asadun', 'singa'],
  ['قِطَّةٌ', 'qittatun', 'kucing'],
  ['كَلْبٌ', 'kalbun', 'anjing'],
  ['سَمَكٌ', 'samakun', 'ikan'],
  ['تُفَّاحٌ', 'tuffahun', 'apel'],
  ['مَسْجِدٌ', 'masjidun', 'masjid'],
  ['وَلَدٌ', 'waladun', 'anak laki-laki'],
  ['بِنْتٌ', 'bintun', 'anak perempuan'],
  ['أُمٌّ', 'ummun', 'ibu'],
  ['أَبٌ', 'abun', 'ayah'],
  ['كُرْسِيٌّ', 'kursiyyun', 'kursi'],
  ['شَجَرَةٌ', 'syajaratun', 'pohon'],
  ['وَرْدَةٌ', 'wardatun', 'bunga'],
].map(([arab, latin, arti]) => ({ arab, latin, arti }));

/** @returns {Array<{id:string, arab:string, arti:string, latin:string, audioUrl:null}>} */
export function paketDasar() {
  return rapikanKata(PAKET_DASAR);
}

/**
 * Daftar pelajaran bermufrodat yang bisa dipilih anak.
 * @returns {Promise<Array<{id:string, nama:string}>>}
 */
export async function daftarPelajaranGame(jenjang) {
  const hasil = await muatSilabusTerbit(jenjang);
  if (!hasil) return [];
  return hasil.syllabus
    .flatMap((s) => s.lessons)
    .filter((l) => l.status === 'siap')
    .map((l) => ({ id: l.id, nama: l.name }));
}

/**
 * Muat kata untuk permainan.
 * @param {string[]} idPelajaran pelajaran yang dipilih (kosong = semua)
 * @param {Array<{id:string}>} semuaPelajaran daftar dari daftarPelajaranGame()
 * @returns {Promise<{kata: Array, dasar: boolean}>} dasar=true bila memakai paket contoh
 */
export async function muatKata(idPelajaran, semuaPelajaran) {
  const sasaran = (idPelajaran && idPelajaran.length ? idPelajaran : semuaPelajaran.map((p) => p.id))
    .slice(0, MAKS_PELAJARAN_SEKALI_MUAT);

  const bagian = await Promise.all(sasaran.map((id) => muatMufrodatPelajaran(id).catch(() => null)));
  const asli = rapikanKata(bagian.flat().filter(Boolean));

  if (asli.length >= MINIMAL_KATA) return { kata: asli, dasar: false };
  // Kurang dari batas: kata asli tetap dipakai, dilengkapi paket dasar.
  const lengkap = rapikanKata([...asli, ...PAKET_DASAR]);
  return { kata: lengkap, dasar: true };
}
