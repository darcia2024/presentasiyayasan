/**
 * PERISA (YAYASAN PERADABAN ISLAM AZHARIYAH)
 * Next-Gen Interactive Working Prototype Engine
 * Asuhan Umi Elly
 */

const PrototypeApp = (() => {
  // Application State
  const state = {
    currentRole: 'santri-smp', // 'santri-sd' | 'santri-smp' | 'santri-sma' | 'admin'
    currentJenjang: 'smp',     // 'sd' | 'smp' | 'sma'
    activeModuleId: 2,
    isVideoPlaying: false,
    videoCurrentSec: 420,
    videoTotalSec: 720,
    videoSpeedIndex: 0,
    speedOptions: ['1.0x', '1.25x', '1.5x', '2.0x'],
    videoInterval: null,
    santriData: {
      name: 'Ahmad Fauzan',
      phone: '0812-8921-9921',
      levelText: 'Santri SMP (Kelas 8)',
      xp: 420,
      streak: 5
    },
    // Curriculum Data per Jenjang
    curriculum: {
      sd: {
        bannerTitle: 'Belajar Mufrodat Dasar & Percakapan Ceria (SD)',
        bannerSub: 'Mengenal kosakata benda sekolah, angka, warna, dan hiwar sederhana bersama Umi Elly.',
        modules: [
          { id: 1, num: 'Modul 01', arabic: 'الأَدَوَاتُ المَدْرَسِيَّةُ', title: 'Peralatan Sekolah & Belajar', duration: '08:45', xp: 40, desc: 'Mengenal mufrodat buku (كِتَابٌ), pena (قَلَمٌ), tas (حَقِيْبَةٌ), dan meja (مَكْتَبٌ).' },
          { id: 2, num: 'Modul 02', arabic: 'الأَلْوَانُ وَالأَرْقَامُ', title: 'Mengenal Warna & Angka Arab (1-10)', duration: '10:15', xp: 50, desc: 'Menghafal angka dan warna primer dalam bahasa Arab dengan lagu ceria.' },
          { id: 3, num: 'Modul 03', arabic: 'التَّعَارُفُ وَالتَّحِيَّاتُ', title: 'Percakapan Perkenalan Santri', duration: '12:00', xp: 50, desc: 'Praktik menyapa salam (السَّلَامُ عَلَيْكُمْ) dan menanyakan kabar sesama teman.' }
        ]
      },
      smp: {
        bannerTitle: 'Tata Bahasa Arab Dasar & Kosakata Harian (SMP)',
        bannerSub: 'Mendalami kaidah Jumlah Ismiyyah, kata ganti (Dhomir), dan percakapan tematik sekolah.',
        modules: [
          { id: 1, num: 'Modul 01', arabic: 'أَقْسَامُ الكَلَامِ : اسْمٌ وَفِعْلٌ', title: 'Pembagian Kata: Isim, Fi\'il, Huruf', duration: '11:20', xp: 50, desc: 'Membedakan kata benda dan kata kerja dalam Al-Qur\'an.' },
          { id: 2, num: 'Modul 02', arabic: 'الوَحْدَةُ الثَّانِيَةُ : فِي المَدْرَسَةِ', title: 'Jumlah Ismiyyah & Fasilitas Sekolah', duration: '12:30', xp: 50, desc: 'Menyusun kalimat mubtada khobar tentang lingkungan perpustakaan & kelas.' },
          { id: 3, num: 'Modul 03', arabic: 'الضَّمَائِرُ المُتَّصِلَةُ وَالمُنْفَصِلَةُ', title: 'Kaidah Dhomir (Kata Ganti Orang)', duration: '14:10', xp: 60, desc: 'Memahami dhomir huwa, hiya, anta, anti, ana, nahnu dalam kalimat.' }
        ]
      },
      sma: {
        bannerTitle: 'Nahwu-Shorof Lanjutan & Muhadatsah Dakwah (SMA)',
        bannerSub: 'Kaidah I\'rob mendalam, Tashrif Fi\'il, dan persiapan membaca kitab turats serta dakwah.',
        modules: [
          { id: 1, num: 'Modul 01', arabic: 'تَصْرِيْفُ الأَفْعَالِ الثُّلَاثِيَّةِ', title: 'Tashrif Fi\'il Madhi, Mudhari\', Amr', duration: '16:40', xp: 60, desc: 'Pola perubahan bentuk kata kerja lampau, sekarang, dan perintah.' },
          { id: 2, num: 'Modul 02', arabic: 'عَلَامَاتُ الإِعْرَابِ الأَصْلِيَّةُ', title: 'Tanda I\'rob Asli: Rofa\', Nashob, Jer', duration: '18:15', xp: 70, desc: 'Memahami harokat dhommah, fathah, kasroh pada struktur i\'rob kalimat.' },
          { id: 3, num: 'Modul 03', arabic: 'المُحَادَثَةُ الإِسْلَامِيَّةُ وَالدَّعْوَةُ', title: 'Muhadatsah Tematik Dakwah Islamiyah', duration: '15:50', xp: 70, desc: 'Keterampilan berpidato dan dialog bahasa Arab formal asuhan Umi Elly.' }
        ]
      }
    },
    // Game Question Banks
    games: [
      {
        level: 1,
        jenjang: 'SD - SMP',
        tag: 'Level 1: Tebak Mufrodat Fasilitas',
        question: 'Manakah arti kosakata (mufrodat) yang tepat untuk kata: <br><strong style="color: #00877A; font-size: 24px; font-family: Arial;">"المَكْتَبَةُ" (Al-Maktabatu)</strong>?',
        options: ['Laboratorium Komputer', 'Perpustakaan Sekolah', 'Ruang Guru / Kantor', 'Lapangan Olahraga'],
        correctIndex: 1,
        feedback: 'Mumtaz! "المَكْتَبَةُ" artinya Perpustakaan Sekolah. Santri berhasil menguasai kosakata fasilitas!'
      },
      {
        level: 2,
        jenjang: 'SMP - SMA',
        tag: 'Level 2: Kaidah Nahwu & Dhomir',
        question: 'Lengkapi kalimat berikut dengan Dhomir (kata ganti) yang tepat: <br><strong style="color: #00877A; font-size: 24px; font-family: Arial;">".... طَالِبٌ نَشِيْطٌ فِي الفَصْلِ"</strong>',
        options: ['هِيَ (Hiya)', 'هُوَ (Huwa)', 'هُمْ (Hum)', 'أَنْتُمْ (Antum)'],
        correctIndex: 1,
        feedback: 'Ahsanta! Karena "طَالِبٌ" adalah isim mudzakkar mufrod, maka dhomir yang tepat adalah "هُوَ" (Huwa).'
      },
      {
        level: 3,
        jenjang: 'SMA',
        tag: 'Level 3: Susun Kalimat Berfaedah',
        question: 'Manakah susunan Jumlah Ismiyyah yang paling benar dan sesuai kaidah tata bahasa?',
        options: [
          'القَلَمُ عَلَى المَكْتَبِ (Al-Qolamu \'alal maktabi)',
          'عَلَى القَلَمُ المَكْتَبِ (\'Alal qolamu al-maktabi)',
          'المَكْتَبِ فِي القَلَمُ (Al-maktabi fil qolamu)',
          'قَلَمٌ عَلَى مَكْتَبِ (Qolamun \'ala maktabi)'
        ],
        correctIndex: 0,
        feedback: 'Barakallah! "القَلَمُ عَلَى المَكْتَبِ" (Pena itu di atas meja) adalah susunan Mubtada dan Khobar yang sempurna!'
      }
    ],
    currentGameIndex: 0
  };

  // Web Audio Synthesizer
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  }

  function playTone(freq = 520, type = 'sine', duration = 0.15, gainVal = 0.1) {
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();

      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.2, audioCtx.currentTime + duration);

      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

      osc.connect(gain);
      gain.connect(audioCtx.destination);

      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
  }

  function playSuccessFanfare() {
    playTone(523.25, 'sine', 0.12, 0.1);
    setTimeout(() => playTone(659.25, 'sine', 0.14, 0.1), 70);
    setTimeout(() => playTone(783.99, 'sine', 0.18, 0.12), 140);
    setTimeout(() => playTone(1046.50, 'triangle', 0.3, 0.15), 210);
  }

  function playPronunciationAudio() {
    playTone(480, 'sine', 0.12, 0.1);
    setTimeout(() => playTone(620, 'sine', 0.16, 0.12), 80);
    setTimeout(() => playTone(540, 'sine', 0.2, 0.09), 180);
    showToast('🔊 Memutar pelafalan mufrodat resmi asuhan Umi Elly: "Al-Maktabatu"');
  }

  // Toast Notification
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('prototypeToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Switch Active Role (Santri SD / SMP / SMA / Admin)
  function setRole(roleName) {
    state.currentRole = roleName;

    // Update Topbar Buttons
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === roleName);
    });

    const santriSection = document.getElementById('santriPortalView');
    const adminSection = document.getElementById('adminPortalView');
    const navUserProfile = document.getElementById('navUserProfile');

    if (roleName.startsWith('santri')) {
      if (santriSection) santriSection.classList.add('active');
      if (adminSection) adminSection.classList.remove('active');
      if (navUserProfile) navUserProfile.style.display = 'flex';

      const jenjang = roleName.replace('santri-', '');
      setJenjang(jenjang);
      showToast(`Mode Berganti: Portal Santri Tingkat ${jenjang.toUpperCase()}`);
    } else {
      if (santriSection) santriSection.classList.remove('active');
      if (adminSection) adminSection.classList.add('active');
      if (navUserProfile) navUserProfile.style.display = 'none';
      showToast('Mode Berganti: Panel Otoritas Yayasan & Umi Elly');
    }

    playTone(600, 'triangle', 0.1, 0.08);
  }

  // Switch Jenjang (SD / SMP / SMA)
  function setJenjang(jenjang) {
    state.currentJenjang = jenjang;
    state.activeModuleId = 1;

    // Update Jenjang Buttons
    document.querySelectorAll('.jenjang-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.jenjang === jenjang);
    });

    // Update Banner Content
    const data = state.curriculum[jenjang];
    const bannerTitle = document.getElementById('bannerJenjangTitle');
    const bannerSub = document.getElementById('bannerJenjangSub');
    if (bannerTitle) bannerTitle.textContent = data.bannerTitle;
    if (bannerSub) bannerSub.textContent = data.bannerSub;

    // Update Sidebar Syllabus List
    renderSyllabusList();

    // Load First Module of Jenjang
    loadModule(1);
  }

  // Render Syllabus List in Sidebar
  function renderSyllabusList() {
    const listContainer = document.getElementById('syllabusItemsList');
    if (!listContainer) return;

    const modules = state.curriculum[state.currentJenjang].modules;
    listContainer.innerHTML = '';

    modules.forEach(mod => {
      const item = document.createElement('div');
      item.className = `syl-row ${mod.id === state.activeModuleId ? 'active' : ''}`;
      item.onclick = () => loadModule(mod.id);
      item.innerHTML = `
        <div class="syl-icon"><i class="ph ph-play-circle"></i></div>
        <div class="syl-info">
          <span class="syl-num">${mod.num}</span>
          <span class="syl-name">${mod.arabic}</span>
          <span class="syl-meta">${mod.title} • ${mod.duration}</span>
        </div>
      `;
      listContainer.appendChild(item);
    });
  }

  // Load Specific Video Module
  function loadModule(modId) {
    state.activeModuleId = modId;
    const modules = state.curriculum[state.currentJenjang].modules;
    const mod = modules.find(m => m.id === modId) || modules[0];

    // Update Video Backdrop
    const arabicTitle = document.getElementById('currentVideoArabicTitle');
    const translation = document.getElementById('currentVideoTranslation');
    const metaTitle = document.getElementById('metaModuleTitle');
    const metaDesc = document.getElementById('metaModuleDesc');

    if (arabicTitle) arabicTitle.textContent = mod.arabic;
    if (translation) translation.textContent = `${mod.num}: ${mod.title}`;
    if (metaTitle) metaTitle.textContent = `${mod.num}: ${mod.arabic} (${mod.title})`;
    if (metaDesc) metaDesc.textContent = mod.desc;

    // Re-render syllabus active class
    renderSyllabusList();

    showToast(`Membuka: ${mod.num} — ${mod.title}`);
    playTone(580, 'sine', 0.1, 0.08);
  }

  // Video Play / Pause Simulator
  function togglePlayVideo() {
    state.isVideoPlaying = !state.isVideoPlaying;
    const playBtn = document.getElementById('btnPlayCentral');
    const playIcon = document.getElementById('playPauseIcon');

    if (state.isVideoPlaying) {
      if (playBtn) playBtn.innerHTML = '<i class="ph ph-pause"></i>';
      if (playIcon) playIcon.className = 'ph ph-pause';
      showToast('Memutar materi video ber-watermark aman...');
      playTone(660, 'sine', 0.1, 0.08);

      clearInterval(state.videoInterval);
      state.videoInterval = setInterval(() => {
        if (state.videoCurrentSec < state.videoTotalSec) {
          state.videoCurrentSec += 1;
          updateVideoTimeDisplay();
        } else {
          state.isVideoPlaying = false;
          clearInterval(state.videoInterval);
          if (playBtn) playBtn.innerHTML = '<i class="ph ph-play"></i>';
          if (playIcon) playIcon.className = 'ph ph-play';
        }
      }, 1000);
    } else {
      if (playBtn) playBtn.innerHTML = '<i class="ph ph-play"></i>';
      if (playIcon) playIcon.className = 'ph ph-play';
      clearInterval(state.videoInterval);
      showToast('Video dijeda');
      playTone(400, 'sine', 0.08, 0.08);
    }
  }

  function toggleSpeed() {
    state.videoSpeedIndex = (state.videoSpeedIndex + 1) % state.speedOptions.length;
    const btn = document.getElementById('btnSpeedToggle');
    if (btn) btn.textContent = state.speedOptions[state.videoSpeedIndex];
    showToast(`Kecepatan video: ${state.speedOptions[state.videoSpeedIndex]}`);
    playTone(550, 'triangle', 0.08, 0.06);
  }

  function updateVideoTimeDisplay() {
    const timeEl = document.getElementById('videoTimeDisplay');
    const fillEl = document.getElementById('videoProgressFill');

    const curM = String(Math.floor(state.videoCurrentSec / 60)).padStart(2, '0');
    const curS = String(state.videoCurrentSec % 60).padStart(2, '0');
    const totM = String(Math.floor(state.videoTotalSec / 60)).padStart(2, '0');
    const totS = String(state.videoTotalSec % 60).padStart(2, '0');

    if (timeEl) timeEl.textContent = `${curM}:${curS} / ${totM}:${totS}`;
    if (fillEl) {
      const pct = (state.videoCurrentSec / state.videoTotalSec) * 100;
      fillEl.style.width = `${pct}%`;
    }
  }

  // Game Modal & Logic
  function openGameModal(gameIdx = 0) {
    state.currentGameIndex = gameIdx;
    renderGameContent();
    const modal = document.getElementById('gameModal');
    if (modal) modal.classList.add('open');
    playTone(600, 'sine', 0.12, 0.08);
  }

  function closeGameModal() {
    const modal = document.getElementById('gameModal');
    if (modal) modal.classList.remove('open');
  }

  function switchGameLevel(idx) {
    state.currentGameIndex = idx;
    renderGameContent();
    playTone(560, 'triangle', 0.1, 0.07);
  }

  function renderGameContent() {
    const game = state.games[state.currentGameIndex];

    // Level tabs
    document.querySelectorAll('.game-level-tab').forEach((tab, idx) => {
      tab.classList.toggle('active', idx === state.currentGameIndex);
    });

    const tagEl = document.getElementById('gameTagText');
    const questionEl = document.getElementById('gameQuestionBody');
    const feedbackBox = document.getElementById('gameFeedbackBox');
    const claimBtn = document.getElementById('btnClaimGameXp');

    if (tagEl) tagEl.textContent = game.tag;
    if (questionEl) questionEl.innerHTML = game.question;
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (claimBtn) claimBtn.style.display = 'none';

    // Render options
    const container = document.getElementById('gameOptionsContainer');
    if (container) {
      container.innerHTML = '';
      game.options.forEach((opt, idx) => {
        const btn = document.createElement('button');
        btn.className = 'game-opt-btn';
        btn.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 14px 18px; background: #FFFFFF; border: 1.5px solid #E2ECEB; border-radius: 16px; font-family: var(--font-family); font-size: 13.5px; font-weight: 600; cursor: pointer; text-align: left; transition: all 0.2s;';
        btn.innerHTML = `
          <span style="width: 28px; height: 28px; border-radius: 50%; background: #E1F5F2; color: #00877A; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 12.5px;">${String.fromCharCode(65 + idx)}</span>
          <span>${opt}</span>
        `;
        btn.onclick = () => answerGame(idx, btn);
        container.appendChild(btn);
      });
    }
  }

  function answerGame(chosenIdx, btnEl) {
    const game = state.games[state.currentGameIndex];
    const isCorrect = chosenIdx === game.correctIndex;
    const feedbackBox = document.getElementById('gameFeedbackBox');
    const feedbackDesc = document.getElementById('gameFeedbackDesc');
    const claimBtn = document.getElementById('btnClaimGameXp');

    if (isCorrect) {
      btnEl.style.background = '#E6F7F5';
      btnEl.style.borderColor = '#00A396';
      btnEl.style.color = '#006D64';

      if (feedbackBox) {
        feedbackBox.style.display = 'block';
        if (feedbackDesc) feedbackDesc.textContent = game.feedback;
      }
      if (claimBtn) claimBtn.style.display = 'inline-flex';

      playSuccessFanfare();
      showToast('Mumtaz! Jawaban Benar! +50 XP siap diklaim.');
    } else {
      btnEl.style.background = '#FEE2E2';
      btnEl.style.borderColor = '#EF4444';
      btnEl.style.color = '#991B1B';
      playTone(260, 'sawtooth', 0.2, 0.08);
      showToast('Afwan, kurang tepat! Silakan coba lagi...');
    }
  }

  function claimGameXp() {
    state.santriData.xp += 50;
    const xpNav = document.getElementById('navXpVal');
    const xpBanner = document.getElementById('bannerXpVal');
    if (xpNav) xpNav.textContent = `${state.santriData.xp} XP`;
    if (xpBanner) xpBanner.textContent = `${state.santriData.xp} XP`;

    playSuccessFanfare();
    showToast('Alhamdulillah! +50 XP berhasil dicatat ke profil santri.');

    setTimeout(() => {
      closeGameModal();
    }, 1200);
  }

  // Certificate Modal
  function openCertModal(name = 'Ahmad Fauzan') {
    const certName = document.getElementById('certStudentName');
    if (certName) certName.textContent = name;

    const modal = document.getElementById('certModal');
    if (modal) modal.classList.add('open');
    playTone(620, 'sine', 0.12, 0.08);
  }

  function closeCertModal() {
    const modal = document.getElementById('certModal');
    if (modal) modal.classList.remove('open');
  }

  // Admin Actions
  function verifySantri(rowId) {
    const badge = document.getElementById(`adminBadge-${rowId}`);
    const btn = document.getElementById(`adminBtn-${rowId}`);
    const sw = document.getElementById(`adminSwitch-${rowId}`);
    const countPending = document.getElementById('adminPendingCount');

    if (badge && btn) {
      badge.className = 'status-badge-approved';
      badge.innerHTML = '<i class="ph ph-check-circle"></i> Infaq Terverifikasi';
      btn.style.display = 'none';
      if (sw) sw.checked = true;

      if (countPending) {
        let val = parseInt(countPending.textContent, 10);
        if (val > 0) countPending.textContent = val - 1;
      }

      playSuccessFanfare();
      showToast('Infaq diverifikasi! Akses materi video otomatis terbuka untuk santri.');
    }
  }

  function verifyBeasiswa(rowId) {
    const badge = document.getElementById(`adminBadge-${rowId}`);
    const btn = document.getElementById(`adminBtn-${rowId}`);
    const sw = document.getElementById(`adminSwitch-${rowId}`);
    const countPending = document.getElementById('adminPendingCount');
    const countBeasiswa = document.getElementById('adminBeasiswaCount');

    if (badge && btn) {
      badge.className = 'status-badge-beasiswa';
      badge.innerHTML = '<i class="ph ph-hand-heart"></i> Beasiswa Resmi Umi Elly';
      btn.style.display = 'none';
      if (sw) sw.checked = true;

      if (countPending) {
        let val = parseInt(countPending.textContent, 10);
        if (val > 0) countPending.textContent = val - 1;
      }
      if (countBeasiswa) {
        let val = parseInt(countBeasiswa.textContent, 10);
        countBeasiswa.textContent = val + 1;
      }

      playSuccessFanfare();
      showToast('Alhamdulillah! Jalur Beasiswa Dhuafa disetujui Umi Elly. Akses kelas dibuka gratis berkah.');
    }
  }

  function toggleSantriAccess(rowId) {
    playTone(600, 'sine', 0.08, 0.06);
    showToast(`Hak akses santri #${rowId} diperbarui & dicatat ke audit log yayasan.`);
  }

  function filterAdminTable(filterType, btnEl) {
    document.querySelectorAll('.filter-pill').forEach(pill => pill.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');

    const rows = document.querySelectorAll('#adminTableBody tr');
    rows.forEach(row => {
      const status = row.dataset.status;
      if (filterType === 'all' || status === filterType) {
        row.style.display = '';
      } else {
        row.style.display = 'none';
      }
    });

    showToast(`Filter tabel: ${filterType.toUpperCase()}`);
    playTone(520, 'sine', 0.08, 0.05);
  }

  // Init on DOM Ready
  function init() {
    renderSyllabusList();
    updateVideoTimeDisplay();
  }

  return {
    init,
    setRole,
    setJenjang,
    loadModule,
    togglePlayVideo,
    toggleSpeed,
    playPronunciationAudio,
    openGameModal,
    closeGameModal,
    switchGameLevel,
    answerGame,
    claimGameXp,
    openCertModal,
    closeCertModal,
    verifySantri,
    verifyBeasiswa,
    toggleSantriAccess,
    filterAdminTable,
    showToast
  };
})();

// Start
document.addEventListener('DOMContentLoaded', () => {
  PrototypeApp.init();
});
