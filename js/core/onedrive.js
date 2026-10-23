/**
 * PERISA AZHARIYAH — Normalisasi link embed PPT dari OneDrive (Fase C3).
 *
 * Owner menyalin link dari OneDrive -> Embed (Sematkan). Yang tersalin bisa
 * berupa URL-nya saja, atau seluruh kode <iframe src="…" …></iframe>. Dua-
 * duanya diterima; yang disimpan selalu URL-nya saja.
 *
 * Domain yang boleh HARUS sama dengan check constraint di migrasi
 * 20261024000002_ppt_embed_khusus_staff.sql dan frame-src di vercel.json.
 * Link ini dirender sebagai <iframe> di layar setiap guru — lihat alasan
 * lengkapnya di migrasi itu.
 *
 * Tanpa DOM dan tanpa jaringan, supaya teruji di Node
 * (tests/unit/onedrive.test.mjs).
 */

/**
 * Sematan PostgREST untuk link embed satu bab. Link-nya tinggal di tabel
 * sendiri yang RLS-nya khusus staff (migrasi 20261024000002) — bagi wali
 * sematan ini selalu null.
 */
export const SEMATAN_EMBED = 'ppt_embed:pelajaran_ppt_embed(url)';

/**
 * true kalau galat PostgREST berarti tabel pelajaran_ppt_embed BELUM ADA di
 * basis data — migrasi 20261024000002 belum dijalankan.
 *
 * Migrasi di proyek ini dijalankan manual, sedangkan frontend terbit otomatis
 * begitu masuk main. Tanpa jalan mundur ini, urutan yang terbalik membuat
 * query silabus gagal dan SELURUH kurikulum tampil kosong di depan guru —
 * demi satu sematan yang belum dipakai siapa pun.
 */
export function embedBelumTersedia(error) {
  if (!error) return false;
  return ['PGRST200', 'PGRST205', '42P01'].includes(error.code)
    || /pelajaran_ppt_embed/.test(String(error.message || ''));
}

/** Host OneDrive pribadi. Microsoft 365 (*.sharepoint.com) diperiksa terpisah. */
const HOST_PRIBADI = ['onedrive.live.com', '1drv.ms'];

function hostDiizinkan(host) {
  return HOST_PRIBADI.includes(host) || /^[a-z0-9-]+\.sharepoint\.com$/.test(host);
}

/** Ambil src dari kode <iframe …>, atau kembalikan teksnya apa adanya. */
function ambilSrc(teks) {
  const cocok = /<iframe[^>]*\ssrc\s*=\s*(["'])(.*?)\1/i.exec(teks);
  return cocok ? cocok[2] : teks;
}

/**
 * @param {string} masukan URL atau kode <iframe> hasil salinan dari OneDrive.
 * @returns {{ok: true, url: string, peringatan: string|null} | {ok: false, error: string}}
 *   `peringatan` diisi kalau link-nya sah tapi tampaknya link BERBAGI biasa,
 *   bukan link EMBED — tetap disimpan, tapi owner diberi tahu cara yang benar.
 */
export function normalkanLinkEmbed(masukan) {
  const teks = String(masukan || '').trim();
  if (!teks) return { ok: false, error: 'Link embed masih kosong.' };

  // Kode embed menyimpan & sebagai &amp; di dalam atribut src.
  const mentah = ambilSrc(teks).trim().replace(/&amp;/g, '&');

  let url;
  try {
    url = new URL(mentah);
  } catch (_) {
    return {
      ok: false,
      error: 'Itu bukan link yang lengkap. Salin dari OneDrive → Embed (Sematkan), lalu tempel utuh di sini.',
    };
  }

  if (url.protocol !== 'https:') {
    return { ok: false, error: 'Link harus diawali https://.' };
  }

  url.hostname = url.hostname.toLowerCase();
  if (!hostDiizinkan(url.hostname)) {
    return {
      ok: false,
      error: `Hanya link dari OneDrive yang bisa ditayangkan (bukan ${url.hostname}). `
        + 'Buka PPT-nya di OneDrive → Embed (Sematkan), lalu salin link-nya.',
    };
  }

  const penandaEmbed = url.pathname.startsWith('/embed')
    || url.searchParams.get('action') === 'embedview'
    || url.searchParams.has('embed')
    || url.searchParams.has('em');

  // Link BERBAGI membawa token `?e=…`; link EMBED tidak. Format embed
  // OneDrive yang baru (1drv.ms/p/c/<cid>/IQR…, dari PowerPoint web →
  // File → Bagikan → Sematkan) tidak punya penanda embed apa pun, jadi yang
  // dicari adalah ciri link berbagi — bukan ketiadaan ciri embed. Dipastikan
  // dengan sepasang link sungguhan dari akun yang sama, 24 Sep 2026.
  const bentukBerbagi = url.searchParams.has('e') && !penandaEmbed;

  return {
    ok: true,
    url: url.toString(),
    peringatan: bentukBerbagi
      ? 'Link ini tampaknya link berbagi biasa, bukan link embed — kemungkinan tidak mau tampil '
        + 'di pemutar. Kalau pratinjaunya kosong, ambil ulang lewat OneDrive → Embed (Sematkan).'
      : null,
  };
}
