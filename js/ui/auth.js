/**
 * PERISA AZHARIYAH — Gerbang Login (Wali + Staff)
 *
 * Alur: nomor WA -> kode OTP -> (kalau wali dengan >1 anak) pilih profil.
 * Lihat docs/fase-1-arsitektur.md untuk kenapa alurnya berbentuk begini.
 *
 * CATATAN: kurikulum sungguhan belum ada (itu Fase 2 — Studio Kurikulum).
 * Setelah login berhasil, jenjang santri yang dipilih dipetakan ke konten
 * peraga yang sudah ada di js/data/roles.js, supaya yang tampil paling
 * tidak SELEVEL dengan anak yang sedang login — bukan konten sungguhan
 * anaknya, tapi bukan acak juga.
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

const JENJANG_KE_PERAN = { sd: 'santri-sd', smp: 'santri-smp', sma: 'santri-sma' };

const $ = (id) => document.getElementById(id);

function tampilkanLangkah(langkah) {
  ['authStepNomor', 'authStepOtp', 'authStepProfil'].forEach((id) => {
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

let nomorTerkini = '';

/**
 * Ambil pesan error yang sebenarnya dari respons Edge Function.
 *
 * Klien Supabase TIDAK mengisi `data` saat status HTTP bukan 2xx (404, 429,
 * dst) — hanya mengisi `error` (objek SDK generik), padahal body respons
 * kita SENDIRI berisi `{ ok:false, error:"pesan yang jelas" }`. Tanpa fungsi
 * ini, wali cuma melihat "Gagal mengirim kode" untuk SEMUA kegagalan —
 * termasuk kasus penting seperti "nomor belum terdaftar" atau "terlalu
 * banyak percobaan" yang seharusnya memandu mereka, bukan membingungkan.
 *
 * Ditemukan lewat uji klik sungguhan di browser, bukan panggilan API
 * langsung — makanya baru ketahuan di titik ini.
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

async function ajukanOtp() {
  const input = $('authNomorInput');
  if (!input) return;
  const nomor = input.value.trim();

  setError('authNomorError', '');
  if (!nomor) {
    setError('authNomorError', 'Masukkan nomor WhatsApp wali.');
    return;
  }

  setMemuat('authNomorSubmit', true, 'Kirim Kode');
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke('auth-otp-request', {
      body: { nomor_wa: nomor },
    });

    if (error || !data?.ok) {
      setError('authNomorError', await ambilPesanError(data, error, 'Gagal mengirim kode. Coba lagi.'));
      return;
    }

    nomorTerkini = nomor;
    const target = $('authOtpTarget');
    if (target) target.textContent = nomor;

    const hint = $('authDevHint');
    if (hint) {
      if (data.modePengembangan) {
        hint.style.display = 'block';
        hint.textContent = `Mode pengembangan — kode OTP: ${data.kodeDev}`;
        const otpInput = $('authOtpInput');
        if (otpInput) otpInput.value = data.kodeDev;
      } else {
        hint.style.display = 'none';
      }
    }

    playTone(560, 'sine', 0.1, 0.06);
    showToast(`Kode dikirim ke WhatsApp ${nomor}`);
    tampilkanLangkah('authStepOtp');
    $('authOtpInput')?.focus();
  } catch (e) {
    setError('authNomorError', e.message || 'Terjadi kesalahan jaringan.');
  } finally {
    setMemuat('authNomorSubmit', false, 'Kirim Kode');
  }
}

async function verifikasiOtp() {
  const input = $('authOtpInput');
  if (!input) return;
  const kode = input.value.trim();

  setError('authOtpError', '');
  if (!kode) {
    setError('authOtpError', 'Masukkan kode OTP.');
    return;
  }

  setMemuat('authOtpSubmit', true, 'Masuk');
  try {
    const client = getSupabaseClient();
    const { data, error } = await client.functions.invoke('auth-otp-verify', {
      body: { nomor_wa: nomorTerkini, kode },
    });

    if (error || !data?.ok) {
      setError('authOtpError', await ambilPesanError(data, error, 'Kode salah atau kedaluwarsa.'));
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
    setError('authOtpError', e.message || 'Terjadi kesalahan jaringan.');
  } finally {
    setMemuat('authOtpSubmit', false, 'Masuk');
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
      <span class="auth-profil-avatar">${s.inisial}</span>
      <span class="auth-profil-info">
        <span class="auth-profil-nama">${s.nama}</span>
        <span class="auth-profil-jenjang">Jenjang ${s.jenjang.toUpperCase()}</span>
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

/** Petakan jenjang santri sungguhan ke konten peraga yang ada (Fase 2 mengganti ini). */
function terapkanProfil(santri) {
  const peran = JENJANG_KE_PERAN[santri.jenjang] || 'santri-smp';
  if (window.PrototypeApp?.setRole) {
    window.PrototypeApp.setRole(peran);
  }
}

/** Tampilkan menu "Studio Kurikulum" di sidebar hanya untuk sesi staff. */
function terapkanVisibilitasStaff() {
  const sesi = bacaSesi();
  const item = $('navStudioKurikulumItem');
  if (item) item.style.display = sesi?.akun?.akun_jenis === 'staff' ? '' : 'none';
}

function selesai() {
  const gate = $('authGate');
  if (gate) gate.style.display = 'none';
  document.body.classList.remove('auth-gate-open');
  terapkanVisibilitasStaff();
  showToast('Berhasil masuk. Ahlan wa sahlan!');
}

function gantiNomor() {
  setError('authOtpError', '');
  tampilkanLangkah('authStepNomor');
  $('authNomorInput')?.focus();
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
    terapkanVisibilitasStaff();
    return;
  }

  if (sesi && sesi.akun.akun_jenis === 'wali' && sesi.santri.length > 1) {
    renderPemilihProfil(sesi.santri);
    tampilkanLangkah('authStepProfil');
  } else {
    tampilkanLangkah('authStepNomor');
  }

  gate.style.display = 'flex';
  document.body.classList.add('auth-gate-open');

  $('authNomorSubmit')?.addEventListener('click', ajukanOtp);
  $('authNomorInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') ajukanOtp();
  });
  $('authOtpSubmit')?.addEventListener('click', verifikasiOtp);
  $('authOtpInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') verifikasiOtp();
  });
  $('authGantiNomor')?.addEventListener('click', gantiNomor);
}

/** Dipanggil dari dropdown profil — "Keluar". */
export function logout() {
  keluar();
  segarkanKlien();
  location.reload();
}
