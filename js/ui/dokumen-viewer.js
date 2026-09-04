/**
 * PERISA AZHARIYAH — Perpustakaan Dokumen PDF Sungguhan (Fase 3)
 *
 * Mengganti kartu peraga di "Modul & Silabus PDF" dengan dokumen PDF asli
 * (tabel dokumen, diisi lewat Studio Kurikulum) begitu ada yang terbit.
 * Kalau belum ada satu pun, kartu peraga tetap tampil — pola upgrade yang
 * sama dengan silabus dan kartu mufrodat.
 *
 * Pembaca PDF: <iframe> dengan #toolbar=0&navpanes=0 (bekerja di Chrome,
 * mayoritas perangkat santri). Ini PENCEGAHAN YANG WAJAR terhadap unduhan
 * kasual lewat tombol bawaan pembaca PDF browser — bukan jaminan mutlak.
 * Santri yang benar-benar niat tetap bisa screenshot atau memakai alat
 * pihak ketiga, sama seperti keterbatasan watermark video (lihat
 * docs/fase-1-arsitektur.md dan migrasi video Fase 3).
 */

import { getSupabaseClient, SUPABASE_TERKONFIGURASI } from '../core/supabase-client.js';
import { showToast } from '../core/feedback.js';

let dokumenTerbitCache = null;

/** Muat seluruh dokumen terbit (lintas jenjang — perpustakaan ini memang dijelajah bebas, bukan dibatasi per jenjang). */
async function muatDokumenTerbit() {
  if (!SUPABASE_TERKONFIGURASI) return [];
  try {
    const client = getSupabaseClient();
    const { data, error } = await client
      .from('dokumen')
      .select('id, jenjang, judul, deskripsi, penyusun, file_url')
      .eq('status', 'terbit')
      .order('urutan', { ascending: true });
    if (error) {
      console.error('[dokumen-viewer] gagal memuat dokumen:', error.message);
      return [];
    }
    return data || [];
  } catch (e) {
    console.error('[dokumen-viewer] gagal memuat dokumen:', e.message);
    return [];
  }
}

function buatKartu(d) {
  const kartu = document.createElement('div');
  kartu.className = 'pdf-card';
  kartu.dataset.category = d.jenjang;

  const badge = document.createElement('div');
  badge.className = 'pdf-card-badge';
  badge.textContent = `Jenjang ${d.jenjang.toUpperCase()}`;

  const judul = document.createElement('div');
  judul.className = 'pdf-card-title';
  judul.textContent = d.judul;

  const meta = document.createElement('div');
  meta.className = 'pdf-card-meta';
  meta.textContent = `Format: PDF • Penyusun: ${d.penyusun}`;

  const aksi = document.createElement('div');
  aksi.className = 'pdf-card-actions';
  const tombol = document.createElement('button');
  tombol.type = 'button';
  tombol.className = 'btn-enroll-primary';
  tombol.textContent = 'Buka Dokumen';
  tombol.addEventListener('click', () => bukaDokumenAsli(d));
  aksi.appendChild(tombol);

  kartu.append(badge, judul, meta, aksi);
  kartu.addEventListener('click', (e) => {
    if (e.target === tombol) return;
    bukaDokumenAsli(d);
  });
  return kartu;
}

/** Ganti grid peraga dengan dokumen asli. Kembalikan jumlah kartu yang digambar. */
export async function muatDanRenderDokumen() {
  const grid = document.getElementById('pdfDocsGrid');
  if (!grid) return 0;

  if (dokumenTerbitCache === null) {
    dokumenTerbitCache = await muatDokumenTerbit();
  }
  if (!dokumenTerbitCache.length) return 0;

  grid.innerHTML = '';
  dokumenTerbitCache.forEach((d) => grid.appendChild(buatKartu(d)));
  return dokumenTerbitCache.length;
}

/** Buka pembaca PDF sungguhan lewat modal docReaderModal yang sudah ada. */
function bukaDokumenAsli(d) {
  const modal = document.getElementById('docReaderModal');
  const headerTitle = document.getElementById('readerHeaderDocTitle');
  const sheetTitle = document.getElementById('readerSheetTitle');
  const sheetSub = document.getElementById('readerSheetSub');
  const sheetBody = document.getElementById('readerSheetBody');

  if (headerTitle) headerTitle.textContent = d.judul;
  if (sheetTitle) sheetTitle.textContent = d.judul;
  if (sheetSub) sheetSub.textContent = `${d.deskripsi || ''} • Penyusun: ${d.penyusun}`.replace(/^ • /, '');

  if (sheetBody) {
    sheetBody.innerHTML = '';
    const iframe = document.createElement('iframe');
    iframe.src = `${d.file_url}#toolbar=0&navpanes=0`;
    iframe.title = d.judul;
    iframe.style.cssText = 'width:100%; height:70vh; border:0; border-radius:8px; background:#525659;';
    sheetBody.appendChild(iframe);
  }

  if (modal) modal.classList.add('open');
  showToast(`Membuka dokumen: "${d.judul}"`);
}
