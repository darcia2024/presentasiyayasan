/**
 * PERISA (YAYASAN PERADABAN ISLAM AZHARIYAH)
 * Reactive Role Switcher & Course Engine
 */

const PrototypeApp = (() => {
  // Role Curriculum Data
  const roleData = {
    'santri-sd': {
      user: { name: 'Aisyah Zahra', level: 'SD Kelas 5', phone: '0821-4455-6677' },
      breadcrumb: 'Peralatan Sekolah & Angka Warna',
      title: 'Bahasa Arab SD: Mufrodat Cilik & Hiwar',
      jenjangPill: 'Tingkat SD Kelas 5',
      metaStats: '8 Modul Video • 1j 45m • 5.0 (240 ulasan)',
      arabicTitle: 'الأَدَوَاتُ المَدْرَسِيَّةُ',
      subtitle: 'Modul 01: Peralatan Sekolah (كِتَابٌ ، قَلَمٌ ، حَقِيْبَةٌ)',
      watermark: '🛡️ Aisyah Zahra • 0821-4455-6677 • PERISA Azhariyah',
      aboutDesc: 'Modul Bahasa Arab Cilik asuhan Umi Elly yang mengajarkan kosakata benda, warna, dan sapaan santri cilik dengan lagu dan visual menarik.',
      lessons: [
        { name: 'Peralatan Sekolah (كِتَابٌ ، قَلَمٌ)', time: '15 min', active: true },
        { name: 'Mengenal Warna & Angka (1-10)', time: '20 min', active: false },
        { name: 'Percakapan Sederhana (التَّعَارُفُ)', time: '18 min', active: false },
        { name: 'Game Tebak Mufrodat (+50 XP)', time: '10 min', active: false }
      ]
    },
    'santri-smp': {
      user: { name: 'Ahmad Fauzan', level: 'SMP Kelas 8', phone: '0812-8921-9921' },
      breadcrumb: 'Jumlah Ismiyyah & Fasilitas Sekolah',
      title: 'Bahasa Arab SMP: Jumlah Ismiyyah & Dhomir',
      jenjangPill: 'Tingkat SMP Kelas 8',
      metaStats: '12 Modul Video • 2j 30m • 4.9 (128 ulasan)',
      arabicTitle: 'الوَحْدَةُ الثَّانِيَةُ : فِي المَدْرَسَةِ',
      subtitle: 'Modul 02: Benda di Perpustakaan (المَكْتَبَةُ)',
      watermark: '🛡️ Ahmad Fauzan • 0812-8921-9921 • PERISA Azhariyah',
      aboutDesc: 'Modul tata bahasa dasar asuhan Umi Elly untuk santri SMP dalam menyusun kalimat Jumlah Ismiyyah dan menguasai kata ganti Dhomir.',
      lessons: [
        { name: 'Pengenalan Ruang Kelas', time: '2 min', active: false },
        { name: 'Perpustakaan (المَكْتَبَةُ)', time: '5 min', active: true },
        { name: 'Kaidah Jumlah Ismiyyah', time: '12 min', active: false },
        { name: 'Latihan Game +50 XP', time: '3 min', active: false }
      ]
    },
    'santri-sma': {
      user: { name: 'M. Rizky Pratama', level: 'SMA Kelas 11', phone: '0813-7788-9900' },
      breadcrumb: 'Nahwu-Shorof Terapan & Tashrif',
      title: 'Bahasa Arab SMA: Nahwu-Shorof & Tashrif',
      jenjangPill: 'Tingkat SMA Kelas 11',
      metaStats: '14 Modul Video • 3j 15m • 5.0 (310 ulasan)',
      arabicTitle: 'تَصْرِيْفُ الأَفْعَالِ الثُّلَاثِيَّةِ',
      subtitle: 'Modul 01: Tashrif Fi\'il Madhi, Mudhari\', & Amr',
      watermark: '🛡️ M. Rizky Pratama • 0813-7788-9900 • PERISA Azhariyah',
      aboutDesc: 'Modul lanjutan kaidah Shorof dan I\'rob kitab turats serta latihan pidato dakwah resmi asuhan Umi Elly.',
      lessons: [
        { name: 'Pola Perubahan Kata Kerja (Tashrif)', time: '35 min', active: true },
        { name: 'Tanda I\'rob Asli (Rofa\', Nashob, Jer)', time: '40 min', active: false },
        { name: 'Muhadatsah Dakwah & Khitobah', time: '30 min', active: false },
        { name: 'Game Susun Kalimat (+50 XP)', time: '15 min', active: false }
      ]
    }
  };

  // Web Audio Synth
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
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  }

  // Toast
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('prototypeToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2800);
  }

  // Set Role Action (Instant Switching)
  function setRole(roleName) {
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === roleName);
    });

    const courseView = document.getElementById('viewCoursePlayer');
    const adminView = document.getElementById('viewAdminPanel');
    const ws = document.getElementById('refMainWorkspace');
    if (ws) ws.scrollTop = 0;

    const breadcrumbRoot = document.getElementById('breadcrumbRoot');
    const breadcrumbCategory = document.getElementById('breadcrumbCategory');
    const breadcrumb = document.getElementById('breadcrumbActiveTitle');

    if (roleName === 'admin') {
      if (courseView) courseView.style.display = 'none';
      if (adminView) adminView.style.display = 'block';

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'PERISA Yayasan';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Otoritas & Perizinan';
      if (breadcrumb) breadcrumb.textContent = 'Panel Admin Umi Elly';

      showToast('Mode Berganti: Panel Otoritas Yayasan & Umi Elly');
      playTone(600, 'triangle', 0.1, 0.08);
      return;
    }

    // Otherwise it's a student role (SD, SMP, SMA)
    if (courseView) courseView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';

    const data = roleData[roleName] || roleData['santri-smp'];

    // Update DOM Elements
    const userCardName = document.querySelector('.user-name-small');
    const userCardSub = document.querySelector('.sidebar-user-card div div:last-child');
    const mainTitle = document.getElementById('courseMainTitle');
    const jenjangPill = document.getElementById('courseJenjangPill');
    const arabicTitle = document.getElementById('currentVideoArabic');
    const subtitle = document.getElementById('currentVideoSubtitle');
    const watermark = document.querySelector('.ref-video-watermark');
    const aboutDesc = document.getElementById('aboutCourseDesc');

    if (breadcrumbRoot) breadcrumbRoot.textContent = 'Kursus';
    if (breadcrumbCategory) breadcrumbCategory.textContent = data.jenjangPill;
    if (breadcrumb) breadcrumb.textContent = data.breadcrumb;

    if (userCardName) userCardName.textContent = data.user.name;
    if (userCardSub) userCardSub.textContent = data.user.level;
    if (mainTitle) mainTitle.textContent = data.title;
    if (jenjangPill) jenjangPill.textContent = data.jenjangPill;
    if (arabicTitle) arabicTitle.textContent = data.arabicTitle;
    if (subtitle) subtitle.textContent = data.subtitle;
    if (watermark) watermark.innerHTML = `<i class="ph ph-shield-check"></i> ${data.watermark}`;
    if (aboutDesc) aboutDesc.textContent = data.aboutDesc;

    // Render lessons
    const lessonContainer = document.querySelector('.lesson-sub-list');
    if (lessonContainer) {
      lessonContainer.innerHTML = '';
      data.lessons.forEach(l => {
        const row = document.createElement('div');
        row.className = `lesson-sub-row ${l.active ? 'active' : ''}`;
        row.onclick = () => showToast(`Memutar: ${l.name}`);
        row.innerHTML = `
          <div class="lesson-left-title"><i class="ph ph-play-circle"></i><span>${l.name}</span></div>
          <span class="lesson-time">${l.time}</span>
        `;
        lessonContainer.appendChild(row);
      });
    }

    showToast(`Mode Berganti: ${data.jenjangPill}`);
    playTone(560, 'sine', 0.1, 0.08);
  }

  function togglePlayVideo() {
    const playIcon = document.getElementById('playIcon');
    if (playIcon) {
      const isPlaying = playIcon.classList.contains('ph-pause');
      if (isPlaying) {
        playIcon.className = 'ph ph-play';
        showToast('Video dijeda');
        playTone(400, 'sine', 0.08, 0.08);
      } else {
        playIcon.className = 'ph ph-pause';
        showToast('Memutar materi video ber-watermark aman...');
        playTone(660, 'sine', 0.1, 0.08);
      }
    }
  }

  function playPronunciationAudio() {
    playTone(480, 'sine', 0.12, 0.1);
    setTimeout(() => playTone(620, 'sine', 0.16, 0.12), 80);
    setTimeout(() => playTone(540, 'sine', 0.2, 0.09), 180);
    showToast('🔊 Memutar pelafalan mufrodat resmi asuhan Umi Elly: "Al-Maktabatu"');
  }

  function openGameModal(idx = 0) {
    const m = document.getElementById('gameModal');
    if (m) m.classList.add('open');
    playTone(600, 'sine', 0.1, 0.08);
  }

  function closeGameModal() {
    const m = document.getElementById('gameModal');
    if (m) m.classList.remove('open');
  }

  function claimGameXp() {
    playTone(523.25, 'sine', 0.12, 0.1);
    setTimeout(() => playTone(783.99, 'sine', 0.18, 0.12), 120);
    showToast('Mumtaz! +50 XP berhasil dicatat ke profil santri.');
    setTimeout(() => closeGameModal(), 1000);
  }

  function openCertModal(name = 'Ahmad Fauzan') {
    const m = document.getElementById('certModal');
    if (m) m.classList.add('open');
    playTone(620, 'sine', 0.12, 0.08);
  }

  function closeCertModal() {
    const m = document.getElementById('certModal');
    if (m) m.classList.remove('open');
  }

  function verifySantri(rowId) {
    const badge = document.getElementById(`adminBadge-${rowId}`);
    const btn = document.getElementById(`adminBtn-${rowId}`);
    const count = document.getElementById('adminPendingCount');
    if (badge && btn) {
      badge.style.background = '#E1F5F2';
      badge.style.color = '#006D63';
      badge.innerHTML = '<i class="ph ph-check-circle"></i> Infaq Terverifikasi';
      btn.style.display = 'none';
      if (count) count.textContent = '1 Santri';
      playTone(659, 'sine', 0.14, 0.1);
      showToast('Infaq diverifikasi! Akses video materi santri otomatis terbuka.');
    }
  }

  function verifyBeasiswa(rowId) {
    const badge = document.getElementById(`adminBadge-${rowId}`);
    const btn = document.getElementById(`adminBtn-${rowId}`);
    const countB = document.getElementById('adminBeasiswaCount');
    const countP = document.getElementById('adminPendingCount');
    if (badge && btn) {
      badge.style.background = 'var(--gold-light)';
      badge.style.color = 'var(--gold-dark)';
      badge.innerHTML = '<i class="ph ph-hand-heart"></i> Beasiswa Resmi Umi';
      btn.style.display = 'none';
      if (countB) countB.textContent = '43 Santri';
      if (countP) countP.textContent = '0 Santri';
      playTone(783, 'triangle', 0.16, 0.12);
      showToast('Alhamdulillah! Beasiswa Dhuafa disetujui Umi Elly. Akses dibuka gratis berkah.');
    }
  }


  // Horizontal Sub-Tab Switcher (Ringkasan, Audio, Kuis, Pengumuman, Ulasan)
  function switchSubTab(tabName) {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === tabName);
    });

    const tabs = ['ringkasan', 'audio', 'kuis', 'pengumuman', 'ulasan'];
    tabs.forEach(t => {
      const el = document.getElementById(`subtab-${t}`);
      if (el) el.style.display = t === tabName ? 'block' : 'none';
    });

    showToast(`Membuka: ${tabName === 'ringkasan' ? 'Ringkasan Materi' : tabName === 'audio' ? 'Pelafalan Audio (Umi)' : tabName === 'kuis' ? 'Kuis Interaktif (+50 XP)' : tabName === 'pengumuman' ? 'Pengumuman' : 'Ulasan Santri'}`);
    playTone(540, 'sine', 0.08, 0.06);
  }

  return {
    setRole,
    togglePlayVideo,
    playPronunciationAudio,
    openGameModal,
    closeGameModal,
    claimGameXp,
    openCertModal,
    closeCertModal,
    verifySantri,
    verifyBeasiswa,
    showToast,
    switchSubTab
  };
})();
