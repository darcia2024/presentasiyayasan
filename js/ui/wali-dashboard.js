/**
 * PERISA AZHARIYAH — Dashboard Wali (Fase 6, bagian wali)
 *
 * Di jenjang SD, yang memutuskan anak membuka aplikasi atau tidak adalah
 * orang tuanya (lihat catatan konsekuensi pilot SD) — halaman ini adalah
 * gambaran progres SEMUA anak sekaligus begitu wali login, bukan langsung
 * dilempar ke konten satu anak seperti sebelum fase ini. Data XP/lencana/
 * progres di sini murni dibaca lewat RLS wali (lihat js/core/wali-client.js)
 * — tidak ada tulisan sama sekali dari halaman ini.
 *
 * Berkas ini TIDAK punya peraga statis di prototype.html seperti
 * silabus/mufrodat/kuis di fase-fase sebelumnya — dashboard ini baru,
 * jadi seluruhnya digambar dari sini, dengan skeleton dulu sebelum data
 * asli datang supaya layar tidak pernah kosong mendadak.
 */

import { bacaSesi, pilihProfilSantri } from '../core/supabase-client.js';
import { ambilRingkasanAnak } from '../core/wali-client.js';
import { playTone } from '../core/feedback.js';

const ID_KONTAINER = 'waliDashboardContainer';
const JENJANG_KE_PERAN = { sd: 'santri-sd', smp: 'santri-smp', sma: 'santri-sma' };
const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };
const WARNA_AVATAR = ['var(--teal-primary)', '#8B7FD1', '#D18B7F', '#7FA8D1', '#B58BD1'];

function el(tag, className, children) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  (children || []).forEach((c) => c && node.appendChild(c));
  return node;
}

function teks(tag, className, isi) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = isi;
  return node;
}

function bukaProfilAnak(santri) {
  pilihProfilSantri(santri.id);
  const peran = JENJANG_KE_PERAN[santri.jenjang] || 'santri-smp';
  playTone(560, 'sine', 0.1, 0.06);
  if (window.PrototypeApp?.setRole) window.PrototypeApp.setRole(peran);
  if (window.PrototypeApp?.switchMainView) window.PrototypeApp.switchMainView('kurikulum');
}

function kartuSkeleton(santri, indeks) {
  const warna = WARNA_AVATAR[indeks % WARNA_AVATAR.length];
  const avatar = teks('div', 'wali-anak-avatar', santri.inisial || '?');
  avatar.style.background = warna;

  const kartu = el('div', 'wali-anak-card', [
    el('div', 'wali-anak-head', [
      avatar,
      el('div', 'wali-anak-info', [
        teks('div', 'wali-anak-nama', santri.nama),
        teks('div', 'wali-anak-jenjang', `Jenjang ${NAMA_JENJANG[santri.jenjang] || santri.jenjang.toUpperCase()}`),
      ]),
    ]),
    el('div', 'wali-anak-metrics', [
      metrikSkeleton(),
      metrikSkeleton(),
      metrikSkeleton(),
    ]),
    teks('div', 'wali-anak-loading', 'Memuat progres…'),
  ]);
  kartu.dataset.santriId = santri.id;
  return kartu;
}

function metrikSkeleton() {
  return metrik('—', '');
}

function metrik(nilai, label) {
  return el('div', 'wali-metrik', [teks('div', 'wali-metrik-nilai', nilai), teks('div', 'wali-metrik-label', label)]);
}

function isiKartu(kartu, santri, ringkasan) {
  kartu.innerHTML = '';

  const indeksWarna = Array.from(kartu.parentElement?.children || []).indexOf(kartu);
  const warna = WARNA_AVATAR[(indeksWarna < 0 ? 0 : indeksWarna) % WARNA_AVATAR.length];
  const avatar = teks('div', 'wali-anak-avatar', santri.inisial || '?');
  avatar.style.background = warna;

  const tombolBuka = el('button', 'btn-enroll-primary');
  tombolBuka.type = 'button';
  tombolBuka.style.cssText = 'padding: 7px 14px; font-size: 12px;';
  tombolBuka.innerHTML = '<i class="ph ph-play"></i> Buka Materi';
  tombolBuka.addEventListener('click', () => bukaProfilAnak(santri));

  const head = el('div', 'wali-anak-head', [
    avatar,
    el('div', 'wali-anak-info', [
      teks('div', 'wali-anak-nama', santri.nama),
      teks('div', 'wali-anak-jenjang', `Jenjang ${NAMA_JENJANG[santri.jenjang] || santri.jenjang.toUpperCase()}`),
    ]),
    tombolBuka,
  ]);

  const metrics = el('div', 'wali-anak-metrics', [
    metrik(String(ringkasan.totalXp.toLocaleString('id-ID')), 'Total XP'),
    metrik(String(ringkasan.mufrodatDikuasai), 'Kosakata Dikuasai'),
    metrik(String(ringkasan.pelajaranSelesai), 'Pelajaran Selesai'),
  ]);

  kartu.append(head, metrics);

  if (ringkasan.xpPekanIni > 0) {
    const pekanIni = el('div', 'wali-anak-pekan-ini', [
      document.createTextNode(
        `📈 Pekan ini: +${ringkasan.xpPekanIni} XP dari ${ringkasan.mufrodatBaruPekanIni} kosakata baru`,
      ),
    ]);
    kartu.appendChild(pekanIni);
  } else {
    kartu.appendChild(el('div', 'wali-anak-pekan-kosong', [document.createTextNode('Belum ada aktivitas belajar minggu ini.')]));
  }

  if (ringkasan.lencana.length) {
    const chipWrap = el('div', 'wali-anak-lencana');
    ringkasan.lencana.forEach((l) => {
      const chip = el('span', 'wali-lencana-chip');
      chip.innerHTML = `<i class="ph ${l.ikon}"></i> ${l.nama}`;
      chipWrap.appendChild(chip);
    });
    kartu.appendChild(chipWrap);
  }
}

function pesanKosong(teksIsi) {
  const wrap = el('div', 'wali-dashboard-kosong');
  wrap.innerHTML = `<i class="ph ph-info" style="font-size: 22px; color: var(--text-muted);"></i><div>${teksIsi}</div>`;
  return wrap;
}

/**
 * Gambar dashboard wali: kartu skeleton dulu untuk setiap anak (langsung,
 * tanpa jeda), lalu isi angka sungguhan begitu query RLS selesai.
 */
export async function renderWaliDashboard() {
  const kontainer = document.getElementById(ID_KONTAINER);
  if (!kontainer) return;

  const sesi = bacaSesi();
  kontainer.innerHTML = '';

  if (!sesi || sesi.akun?.akun_jenis !== 'wali') {
    kontainer.appendChild(pesanKosong('Dashboard ini khusus akun wali. Masuk sebagai wali untuk melihat progres anak.'));
    return;
  }

  const daftarSantri = sesi.santri || [];
  const salamEl = document.getElementById('waliDashboardSalam');
  if (salamEl) salamEl.textContent = `Assalamu'alaikum, ${sesi.akun.nama}. Berikut progres belajar ananda pekan ini.`;

  if (!daftarSantri.length) {
    kontainer.appendChild(pesanKosong('Belum ada profil anak terdaftar pada akun ini. Hubungi pengurus yayasan untuk mendaftarkan santri.'));
    return;
  }

  daftarSantri.forEach((s, i) => kontainer.appendChild(kartuSkeleton(s, i)));

  try {
    const ringkasanMap = await ambilRingkasanAnak(daftarSantri);
    daftarSantri.forEach((s) => {
      const kartu = kontainer.querySelector(`[data-santri-id="${s.id}"]`);
      const ringkasan = ringkasanMap.get(s.id);
      if (kartu && ringkasan) isiKartu(kartu, s, ringkasan);
    });
  } catch (e) {
    console.error('[wali-dashboard] gagal memuat ringkasan:', e);
    // Skeleton (nama + tombol buka materi) tetap tampil apa adanya — cuma
    // angkanya yang tidak terisi. Wali tetap bisa membuka materi anaknya.
  }
}
