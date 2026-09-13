/**
 * PERISA AZHARIYAH — Gerbang Login (Wali + Staff)
 *
 * Alur: nomor WA + PIN -> (kalau wali punya lebih dari satu anak) pilih
 * profil santri -> masuk.
 *
 * 12 September 2026 — OTP WhatsApp DIGANTI PIN. Alasan lengkapnya di
 * supabase/migrations/20260912000001_login_pin.sql; ringkasnya: gateway
 * WhatsApp-nya tidak pernah ada, dan "mode pengembangan" yang menutupi
 * ketiadaannya membocorkan kode masuk ke siapa pun yang memintanya lewat
 * HTTP. PIN ditetapkan pengurus saat mendaftarkan keluarga, dan bisa
 * diganti sendiri oleh pemilik akun lewat menu Pengaturan Akun.
 *
 * Dua langkah OTP (minta kode -> masukkan kode) menyusut jadi satu.
 */

import {
  getSupabaseClient,
  bacaSesi,
  simpanSesi,
  pilihProfilSantri,
  keluar,
  segarkanKlien,
  SUPABASE_TERKONFIGURASI,
} from '../core/supabase-client.js';
import { playTone, showToast } from '../core/feedback.js';
import {
  terapkanSantriAktif,
  terapkanIdentitasSesiAktif,
  beriTahuPergantianSantri,
  muatKontenJenjang,
} from './jenjang.js';
import { jenjangUntukSesiStaff } from '../core/guru-client.js';
import { escapeHtml } from '../core/html.js';
import { BOLEH_MODE_PENGEMBANGAN } from '../config.js';
import { terapkanKunciFase, fiturTerkunci } from './fase.js';

const NAMA_JENJANG = { sd: 'SD', smp: 'SMP', sma: 'SMA' };

const $ = (id) => document.getElementById(id);

function tampilkanLangkah(langkah) {
  ['authStepMasuk', 'authStepProfil'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = id === langkah ? 'flex' : 'none';
  });
}

function setError(idElemen, pesan) {
  const el = $(idElemen);
  if (!el) return;
  el.textContent = pesan || '';
  el.style.display = pesan ? 'block' : 'none';
}

function setMemuat(idTombol, memuat, labelNormal) {
  const btn = $(idTombol);
  if (!btn) return;
  btn.disabled = memuat;
  btn.textContent = memuat ? 'Memproses…' : labelNormal;
}

/**
 * Ambil pesan error yang sebenarnya dari respons Edge Function.
 *
 * Klien Supabase TIDAK mengisi `data` saat status HTTP bukan 2xx (401, 429,
 * dst) — hanya mengisi `error` (objek SDK generik), padahal body respons
 * kita SENDIRI berisi `{ ok:false, error:"pesan yang jelas" }`. Tanpa fungsi
 * ini, wali cuma melihat satu pesan generik untuk SEMUA kegagalan —
 * termasuk yang penting seperti "akun dikunci 15 menit" yang seharusnya
 * memandu mereka, bukan membingungkan.
 */
async function ambilPesanError(data, error, fallback) {
  if (data?.error) return data.error;
  if (error?.context && typeof error.context.json === 'function') {
    try {
      const body = await error.context.clone().json();
      if (body?.error) return body.error;
    } catch (_) {
      /* body bukan JSON atau sudah terbaca — pakai fallback di bawah */
    }
  }
  return error?.message || fallback;
}

/**
 * Tombol mata di kolom PIN.
 *
 * Bukan hiasan: PIN diketik tertutup di ponsel dengan papan ketik angka,
 * dan wali yang salah ketik tidak punya cara membedakannya dari PIN yang
 * memang salah. Lima kali begitu, akunnya terkunci 15 menit — dan yang
 * menanggung teleponnya adalah pengurus.
 */
function pasangTombolLihatPin() {
  const tombol = $('authPinLihat');
  const input = $('authPinInput');
  if (!tombol || !input) return;

  tombol.addEventListener('click', () => {
    const terlihat = input.type === 'text';
    input.type = terlihat ? 'password' : 'text';
    tombol.setAttribute('aria-label', terlihat ? 'Tampilkan PIN' : 'Sembunyikan PIN');
    const ikon = tombol.querySelector('i');
    if (ikon) ikon.className = terlihat ? 'ph ph-eye' : 'ph ph-eye-slash';
    input.focus();
  });
}

/** Satu-satunya jalan masuk: nomor WhatsApp + PIN. */
async function masuk() {
  const inputNomor = $('authNomorInput');
  const inputPin = $('authPinInput');
  if (!inputNomor || !inputPin) return;

  const nomor = inputNomor.value.trim();
  const pin = inputPin.value.trim();

  setError('authMasukError', '');
  if (!nomor) {
    setError('authMasukError', 'Masukkan nomor WhatsApp yang terdaftar.');
    inputNomor.focus();
    return;
  }
  if (!pin) {
    setError('authMasukError', 'Masukkan PIN dari pengurus yayasan.');
    inputPin.focus();
    return;
  }

  setMemuat('authMasukSubmit', true, 'Masuk');
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke('auth-login-pin', {
      body: { nomor_wa: nomor, pin },
    });

    if (error || !data?.ok) {
      setError('authMasukError', await ambilPesanError(data, error, 'Gagal masuk. Coba lagi.'));
      // Kosongkan PIN-nya saja, bukan nomornya — yang salah ketik hampir
      // selalu PIN, dan mengetik ulang nomor setiap kali gagal itu menyiksa
      // di ponsel.
      inputPin.value = '';
      inputPin.focus();
      return;
    }

    const santriAktif =
      data.akun.akun_jenis === 'wali' && data.santri?.length === 1 ? data.santri[0].id : null;

    simpanSesi({
      token: data.access_token,
      expiresAt: data.expires_at,
      akun: data.akun,
      santri: data.santri || [],
      santriAktifId: santriAktif,
    });
    segarkanKlien();

    // PIN tidak boleh tertinggal di DOM sesudah dipakai.
    inputPin.value = '';

    playTone(659, 'sine', 0.14, 0.08);

    if (data.akun.akun_jenis === 'wali' && (data.santri || []).length > 1) {
      renderPemilihProfil(data.santri);
      tampilkanLangkah('authStepProfil');
      return;
    }

    if (santriAktif) {
      terapkanProfil(data.santri[0]);
    }
    selesai();
  } catch (e) {
    setError('authMasukError', e.message || 'Terjadi kesalahan jaringan.');
  } finally {
    setMemuat('authMasukSubmit', false, 'Masuk');
  }
}

function renderPemilihProfil(daftarSantri) {
  const wrap = $('authProfilList');
  if (!wrap) return;
  wrap.innerHTML = '';

  daftarSantri.forEach((s) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'auth-profil-btn';
    btn.innerHTML = `
      <span class="auth-profil-avatar">${escapeHtml(s.inisial)}</span>
      <span class="auth-profil-info">
        <span class="auth-profil-nama">${escapeHtml(s.nama)}</span>
        <span class="auth-profil-jenjang">Jenjang ${escapeHtml(String(s.jenjang).toUpperCase())}</span>
      </span>
    `;
    btn.addEventListener('click', () => {
      pilihProfilSantri(s.id);
      terapkanProfil(s);
      playTone(560, 'sine', 0.1, 0.06);
      selesai();
    });
    wrap.appendChild(btn);
  });
}

/**
 * Terapkan santri yang dipilih: identitasnya ke sidebar/drawer, lalu muat
 * kurikulum jenjangnya dari basis data.
 *
 * Sampai 11 September 2026 fungsi ini memetakan jenjang santri ke salah
 * satu dari tiga PERSONA PERAGA ('santri-sd'/'santri-smp'/'santri-sma') —
 * jadi yang tampil bukan materi anak itu, melainkan materi karangan yang
 * kebetulan sejenjang. Sekarang jenjangnya diteruskan apa adanya dan
 * kontennya datang dari tabel modul/pelajaran/mufrodat.
 */
function terapkanProfil(santri) {
  terapkanSantriAktif(santri);
}

/**
 * Identitas untuk sesi STAFF — staff tidak punya "jenjang santri".
 *
 * Sekaligus memuat materi kurikulum untuk staff. Tanpa ini halaman Kurikulum
 * tetap kosong sepanjang sesi guru: muatKontenJenjang() hanya pernah
 * dipanggil dari terapkanSantriAktif(), jalur yang tidak pernah dilewati
 * staff. Sengaja tidak ditunggu (await) — identitas di sidebar tidak boleh
 * menunggu jaringan, dan halaman materinya mengisi dirinya sendiri.
 */
function terapkanIdentitasStaff() {
  terapkanIdentitasSesiAktif();
  jenjangUntukSesiStaff()
    .then((jenjang) => muatKontenJenjang(jenjang))
    .catch(() => { /* halaman materi tetap menampilkan keadaan kosongnya */ });
}

/**
 * Fase 8: sebelum ini, dashboard demo/presentasi ("SIMULASI SISTEM" di
 * bar atas, "Ganti Perspektif Pengguna" di drawer mobile, dan "Pilih
 * Perspektif Santri" di dropdown profil yang isinya TIGA NAMA PERAGA
 * tetap) tetap tampil apa adanya ke wali/staff yang baru saja login
 * SUNGGUHAN lewat OTP asli — membingungkan sekaligus tidak pantas
 * (wali melihat nama anak ORANG LAIN di akunnya sendiri). Disembunyikan
 * total untuk sesi sungguhan; dropdown perspektif digambar ulang dengan
 * anak-anak SUNGGUHAN wali itu HANYA kalau lebih dari satu (satu anak
 * tidak butuh "berganti").
 *
 * 12 September 2026 — syaratnya diperketat satu tingkat lagi. Sebelum ini
 * alat peraga hanya bersembunyi kalau ADA sesi; artinya build produksi yang
 * karena satu dan lain hal belum punya sesi (Supabase salah konfigurasi,
 * gerbang login gagal tampil) menyajikan bar "SIMULASI SISTEM" lengkap
 * dengan tombol berpindah ke Panel Pengurus kepada siapa pun yang membuka
 * situsnya. Sekarang peraga hanya hidup kalau build-nya MEMANG build
 * pengembangan (APP_ENV development/test) DAN belum ada sesi. Di produksi
 * tidak ada keadaan apa pun yang memunculkannya.
 */
function bolehTampilkanPeraga() {
  return BOLEH_MODE_PENGEMBANGAN && !bacaSesi();
}

function terapkanVisibilitasDemo() {
  const sesi = bacaSesi();
  const peraga = bolehTampilkanPeraga();

  const demoBar = $('demoControlBar');
  if (demoBar) demoBar.style.display = peraga ? '' : 'none';
  // Kerangka desktop dihitung calc(100vh - 46px) untuk memberi ruang bar
  // demo. Begitu barnya disembunyikan, ruang itu harus dikembalikan —
  // kalau tidak, sidebar berhenti 46px sebelum dasar layar dan garis
  // pemisahnya terputus (temuan audit desain 5 Sep 2026).
  document.body.classList.toggle('tanpa-bar-demo', !peraga);
  const drawerPerspektif = $('mDrawerPerspektif');
  if (drawerPerspektif) drawerPerspektif.style.display = peraga ? '' : 'none';
  const berandaJenjang = $('berandaPilihanJenjang');
  if (berandaJenjang) berandaJenjang.style.display = peraga ? '' : 'none';

  const wrap = $('dropdownPerspektifWrap');
  if (!wrap) return;

  // Mode peraga: biarkan daftar tiga persona bawaan HTML apa adanya.
  if (peraga) {
    wrap.style.display = '';
    return;
  }

  const daftarSantri = sesi?.akun?.akun_jenis === 'wali' ? sesi.santri || [] : [];
  if (daftarSantri.length < 2) {
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = '';
  const list = $('dropdownAccountList');
  if (!list) return;
  list.innerHTML = '';
  daftarSantri.forEach((s) => {
    const item = document.createElement('div');
    item.className = `dropdown-account-item${s.id === sesi.santriAktifId ? ' current' : ''}`;
    item.innerHTML = `
      <div class="dropdown-account-left">
        <div class="dropdown-mini-avatar">${escapeHtml(s.inisial)}</div>
        <div>
          <div style="font-size: 12px; font-weight: 700;">${escapeHtml(s.nama)}</div>
          <div style="font-size: 10px; color: var(--text-muted);">Santri Jenjang ${escapeHtml(NAMA_JENJANG[s.jenjang] || String(s.jenjang).toUpperCase())}</div>
        </div>
      </div>
      <i class="ph ph-check" style="font-size: 14px; color: var(--teal-primary); display: ${s.id === sesi.santriAktifId ? 'block' : 'none'};"></i>
    `;
    item.addEventListener('click', () => {
      gantiProfilSantri(s.id);
      window.PrototypeApp?.toggleProfileDropdown?.();
    });
    list.appendChild(item);
  });
}

/** Berganti antar-anak TANPA logout — dipanggil dari dropdown profil (Fase 8). */
function gantiProfilSantri(santriId) {
  const sesi = bacaSesi();
  const santri = sesi?.santri?.find((s) => s.id === santriId);
  if (!santri) return;
  pilihProfilSantri(santriId);
  terapkanProfil(santri);
  terapkanVisibilitasDemo();
  playTone(560, 'sine', 0.1, 0.06);
  beriTahuPergantianSantri(santri.nama);
}

/**
 * Kelompok menu "Pengurus Yayasan" — Panel Otoritas & Studio Kurikulum.
 *
 * 12 September 2026: sebelum ini hanya Studio yang dijaga, sementara
 * "Panel Otoritas Yayasan" duduk di sidebar SEMUA orang termasuk santri
 * kelas 5 SD. Datanya memang selalu ditolak (panelnya sendiri memeriksa
 * peran, lihat js/ui/pengurus-panel.js), jadi ini bukan lubang keamanan —
 * tapi menu yang tidak akan pernah bisa dipakai tidak punya urusan berada
 * di layar santri, apalagi menu bernama "Otoritas Yayasan".
 *
 * Tetap terlihat saat mode peraga di build pengembangan, supaya panel ini
 * masih bisa ditunjukkan waktu presentasi lokal.
 */
function terapkanVisibilitasStaff() {
  const sesi = bacaSesi();
  const staff = sesi?.akun?.akun_jenis === 'staff';
  const peraga = bolehTampilkanPeraga();
  const peran = sesi?.akun?.staff_peran;

  /*
   * Dipisah per peran, bukan satu saklar "staff atau bukan".
   *
   * Sebelum Fase D, seluruh menu staff muncul untuk SETIAP staff — termasuk
   * pengajar, yang kalau menekan "Panel Otoritas Yayasan" hanya disambut
   * kalimat "panel ini khusus pengurus/superadmin". Selama satu-satunya
   * akun staff yang dipakai adalah pengurus, itu tidak pernah kelihatan.
   * Di fase ini pengajar justru pengguna utamanya, jadi menu yang menjanjikan
   * sesuatu lalu menolaknya sendiri akan ditemui setiap hari — persis jenis
   * antarmuka yang dibersihkan audit M12.
   */
  const guru = staff || peraga ? '' : 'none';
  const admin = (staff && (peran === 'pengurus' || peran === 'superadmin')) || peraga ? '' : 'none';

  const pasang = (ids, nilai) => ids.forEach((id) => {
    const el = $(id);
    if (el) el.style.display = nilai;
  });

  pasang(['navGroupGuru', 'navGuruDashboardItem',
          'navGroupGuruMobile', 'navGuruDashboardItemMobile'], guru);

  pasang(['navGroupPengurus', 'navAdminPanelItem', 'navStudioKurikulumItem',
          'navGroupPengurusMobile', 'navAdminPanelItemMobile', 'navStudioKurikulumItemMobile'], admin);
}

/**
 * Tombol "Keluar" (sidebar desktop + drawer mobile). Hanya berguna kalau
 * memang ada sesi — di mode peraga tidak ada yang bisa dikeluarkan, dan
 * tombol yang tidak berbuat apa-apa persis jenis antarmuka yang dibersihkan
 * audit M12.
 */
function terapkanVisibilitasSesi() {
  const ada = Boolean(bacaSesi());
  ['sidebarLogout', 'drawerLogout'].forEach((id) => {
    const el = $(id);
    if (el) el.style.display = ada ? '' : 'none';
  });
}

/**
 * Layar pendaratan sesudah login — inti alur LMS: masuk, lihat posisi,
 * baru pilih materi.
 *
 *   wali   → Dashboard Wali (ringkasan seluruh anaknya)
 *   staff  → Panel Otoritas Yayasan (dashboard kerja mereka)
 *   sisanya→ Dashboard Santri
 *
 * Dipanggil dari DUA jalan: login baru (selesai) dan sesi yang bertahan
 * lewat muat ulang halaman (initAuthGate). Keduanya harus mendarat di
 * tempat yang sama — kalau tidak, layar pertama yang dilihat wali berbeda
 * tergantung apakah dia baru login atau sekadar menyegarkan halaman.
 */
function arahkanKeDashboard() {
  const sesi = bacaSesi();
  if (!sesi || !window.PrototypeApp?.switchMainView) return;

  const jenis = sesi.akun?.akun_jenis;

  // 12 September 2026 — Dashboard Wali dan Dashboard Santri terkunci selama
  // kelas online belum dibuka (lihat js/ui/fase.js). Mengarahkan ke sana
  // berarti mendaratkan orang di layar kosong, jadi selama kunci itu aktif
  // semua yang bukan staff mendarat di materi kurikulum — layar yang memang
  // dipakai guru di kelas.
  // Pengajar mendarat di Dashboard Guru, bukan Panel Pengurus — panel itu
  // memang digerbang ke pengurus/superadmin, jadi mengarahkan pengajar ke
  // sana berarti mendaratkannya di layar yang menolaknya sendiri.
  if (jenis === 'staff') {
    const peran = sesi.akun?.staff_peran;
    window.PrototypeApp.switchMainView(peran === 'pengajar' ? 'guru-dashboard' : 'admin');
  }
  else if (fiturTerkunci('kelas-online')) window.PrototypeApp.switchMainView('kurikulum');
  else if (jenis === 'wali') window.PrototypeApp.switchMainView('wali-dashboard');
  else window.PrototypeApp.switchMainView('beranda');
}

/**
 * Dipanggil sekali saat boot dari js/app.js, SEBELUM initAuthGate dan tanpa
 * syarat apa pun.
 *
 * Alasannya: initAuthGate berhenti lebih awal kalau Supabase belum
 * terkonfigurasi, dan dulu itu berarti seluruh penyembunyian alat peraga
 * ikut tidak berjalan. Build produksi yang variabel lingkungannya salah
 * ketik akan menyajikan bar "SIMULASI SISTEM" ke publik — kegagalan
 * konfigurasi berubah jadi kebocoran antarmuka. Sekarang aturan tampilan
 * dijalankan lebih dulu, terlepas dari status Supabase.
 */
export function terapkanAturanTampilan() {
  // Gerbang fase lebih dulu: sebagian menu memang tidak berlaku di fase ini
  // untuk SIAPA PUN, jadi tidak perlu diputuskan ulang per jenis akun.
  terapkanKunciFase();
  terapkanVisibilitasStaff();
  terapkanVisibilitasWali();
  terapkanVisibilitasDemo();
  terapkanVisibilitasSesi();
}

/** Tampilkan menu "Dashboard Wali" (sidebar + drawer mobile) hanya untuk sesi wali. */
function terapkanVisibilitasWali() {
  const sesi = bacaSesi();
  const terlihat = sesi?.akun?.akun_jenis === 'wali' ? '' : 'none';
  const item = $('navWaliDashboardItem');
  if (item) item.style.display = terlihat;
  const itemMobile = $('navWaliDashboardItemMobile');
  if (itemMobile) itemMobile.style.display = terlihat;
}

function selesai() {
  const gate = $('authGate');
  if (gate) gate.style.display = 'none';
  document.body.classList.remove('auth-gate-open');
  terapkanAturanTampilan();
  if (bacaSesi()?.akun?.akun_jenis === 'staff') terapkanIdentitasStaff();
  arahkanKeDashboard();
  showToast('Berhasil masuk. Ahlan wa sahlan!');
}

/**
 * Jalankan sekali saat boot. Menampilkan gerbang login kalau perlu,
 * atau langsung menembus ke aplikasi kalau sesi masih berlaku.
 */
export function initAuthGate() {
  const gate = $('authGate');
  if (!gate) return;

  if (!SUPABASE_TERKONFIGURASI) {
    // Supabase belum disiapkan (mis. pengembangan lokal tanpa .env terisi).
    // Jangan kunci aplikasi — biarkan mode peraga tombol ganti akun tetap
    // bisa dipakai seperti sebelum Fase 1 ada.
    //
    // Catatan: aturan tampilan sudah dijalankan js/app.js sebelum fungsi ini
    // dipanggil, jadi di BUILD PRODUKSI yang keadaannya begini alat peraga
    // tetap tersembunyi — aplikasi tampil apa adanya tanpa panel simulasi.
    gate.style.display = 'none';
    return;
  }

  const sesi = bacaSesi();
  if (sesi && (sesi.akun.akun_jenis === 'staff' || sesi.santriAktifId || sesi.santri.length <= 1)) {
    if (sesi.santri.length === 1 && !sesi.santriAktifId) {
      pilihProfilSantri(sesi.santri[0].id);
    }
    if (sesi.akun.akun_jenis === 'wali' && sesi.santri.length >= 1) {
      const aktif = sesi.santri.find((s) => s.id === (sesi.santriAktifId || sesi.santri[0].id));
      if (aktif) terapkanProfil(aktif);
    }
    gate.style.display = 'none';
    terapkanAturanTampilan();
    if (sesi.akun.akun_jenis === 'staff') terapkanIdentitasStaff();
    // Sesi yang bertahan lewat muat ulang halaman mendarat di layar yang
    // sama dengan login baru — lihat arahkanKeDashboard().
    arahkanKeDashboard();
    return;
  }

  if (sesi && sesi.akun.akun_jenis === 'wali' && sesi.santri.length > 1) {
    renderPemilihProfil(sesi.santri);
    tampilkanLangkah('authStepProfil');
  } else {
    tampilkanLangkah('authStepMasuk');
  }

  gate.style.display = 'flex';
  document.body.classList.add('auth-gate-open');

  $('authMasukSubmit')?.addEventListener('click', masuk);
  pasangTombolLihatPin();
  $('authNomorInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('authPinInput')?.focus();
  });
  $('authPinInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') masuk();
  });
}

/** Dipanggil dari dropdown profil — "Keluar". */
export function logout() {
  keluar();
  segarkanKlien();
  location.reload();
}
