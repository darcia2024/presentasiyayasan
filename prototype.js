/**
 * YAYASAN PERADABAN ISLAM AZHARIYAH (PERISA)
 * Sistem Kurikulum Pembelajaran Bahasa Arab & Panel Tata Kelola
 * Asuhan Umi Elly
 */

const PrototypeApp = (() => {
  // Data Kurikulum Per Jenjang
  const roleData = {
    'santri-sd': {
      user: { name: 'Aisyah Zahra', level: 'Santri Jenjang SD Kelas 5', phone: '0821-4455-6677' },
      breadcrumb: 'Kosakata Peralatan Pendidikan dan Angka',
      title: 'Bahasa Arab SD: Pengenalan Mufrodat dan Hiwar Dasar',
      jenjangPill: 'Jenjang SD Kelas 5',
      metaStats: '8 Modul Pembelajaran • Durasi: 1 Jam 45 Menit • Kurikulum Dasar',
      arabicTitle: 'الأَدَوَاتُ المَدْرَسِيَّةُ',
      subtitle: 'Modul 01: Kosakata Peralatan Belajar (كِتَابٌ ، قَلَمٌ ، حَقِيْبَةٌ)',
      watermark: 'Aisyah Zahra • 0821-4455-6677 • Hak Cipta PERISA Azhariyah',
      aboutDesc: 'Modul pengenalan bahasa Arab asuhan Umi Elly yang berfokus pada penguasaan kosakata dasar benda di sekitar, bilangan angka, dan sapaan santri secara komunikatif.',
      lessons: [
        { name: 'Peralatan Belajar (كِتَابٌ ، قَلَمٌ)', time: '15 Menit', active: true },
        { name: 'Pengenalan Warna dan Bilangan Angka', time: '20 Menit', active: false },
        { name: 'Percakapan Dasar Santri (التَّعَارُفُ)', time: '18 Menit', active: false },
        { name: 'Lembar Evaluasi Mandiri', time: '10 Menit', active: false }
      ]
    },
    'santri-smp': {
      user: { name: 'Ahmad Fauzan', level: 'Santri Jenjang SMP Kelas 8', phone: '0812-8921-9921' },
      breadcrumb: 'Jumlah Ismiyyah dan Fasilitas Sekolah',
      title: 'Bahasa Arab SMP: Kaidah Jumlah Ismiyyah',
      jenjangPill: 'Jenjang SMP Kelas 8',
      metaStats: '12 Modul Pembelajaran • Durasi: 2 Jam 30 Menit • Kurikulum Menengah',
      arabicTitle: 'الوَحْدَةُ الثَّانِيَةُ : فِي المَدْرَسَةِ',
      subtitle: 'Modul 02: Kosakata Fasilitas Perpustakaan (المَكْتَبَةُ)',
      watermark: 'Ahmad Fauzan • 0812-8921-9921 • Hak Cipta PERISA Azhariyah',
      aboutDesc: 'Modul tata bahasa asuhan Umi Elly untuk santri jenjang SMP dalam memahami struktur kalimat Jumlah Ismiyyah (Mubtada dan Khobar) serta penerapan kata ganti Dhomir.',
      lessons: [
        { name: 'Pengenalan Ruang dan Sarana Kelas', time: '2 Menit', active: false },
        { name: 'Fasilitas Perpustakaan (المَكْتَبَةُ)', time: '5 Menit', active: true },
        { name: 'Kaidah Jumlah Ismiyyah Dasar', time: '12 Menit', active: false },
        { name: 'Lembar Evaluasi Mandiri', time: '3 Menit', active: false }
      ]
    },
    'santri-sma': {
      user: { name: 'M. Rizky Pratama', level: 'Santri Jenjang SMA Kelas 11', phone: '0813-7788-9900' },
      breadcrumb: 'Kaidah Nahwu-Shorof Terapan dan Tashrif',
      title: 'Bahasa Arab SMA: Nahwu-Shorof Terapan & Tashrif',
      jenjangPill: 'Jenjang SMA Kelas 11',
      metaStats: '14 Modul Pembelajaran • Durasi: 3 Jam 15 Menit • Kurikulum Lanjutan',
      arabicTitle: 'تَصْرِيْفُ الأَفْعَالِ الثُّلَاثِيَّةِ',
      subtitle: 'Modul 01: Perubahan Bentuk Kata Kerja (Madhi, Mudhari\', Amr)',
      watermark: 'M. Rizky Pratama • 0813-7788-9900 • Hak Cipta PERISA Azhariyah',
      aboutDesc: 'Modul lanjutan ilmu Shorof dan kaidah I\'rob kitab turats serta latihan pidato dakwah resmi asuhan Umi Elly.',
      lessons: [
        { name: 'Pola Perubahan Kata Kerja (Tashrif)', time: '35 Menit', active: true },
        { name: 'Tanda I\'rob Asli (Rofa\', Nashob, Jer)', time: '40 Menit', active: false },
        { name: 'Muhadatsah Dakwah & Pidato Khitobah', time: '30 Menit', active: false },
        { name: 'Lembar Evaluasi Terapan', time: '15 Menit', active: false }
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

  function playTone(freq = 520, type = 'sine', duration = 0.15, gainVal = 0.08) {
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

  // Toast Notification
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('prototypeToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
  }

  // Set Role Action
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

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Yayasan PERISA';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Otoritas & Tata Kelola';
      if (breadcrumb) breadcrumb.textContent = 'Panel Pengurus Yayasan';

      showToast('Beralih ke Panel Otoritas dan Tata Kelola Yayasan');
      playTone(560, 'sine', 0.1, 0.06);
      return;
    }

    // Otherwise it's a student role (SD, SMP, SMA)
    if (courseView) courseView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';

    const data = roleData[roleName] || roleData['santri-smp'];

    // Update DOM Elements
    const userCardName = document.querySelector('.user-name-small');
    const userCardSub = document.getElementById('sidebarUserSub');
    const mainTitle = document.getElementById('courseMainTitle');
    const jenjangPill = document.getElementById('courseJenjangPill');
    const arabicTitle = document.getElementById('currentVideoArabic');
    const subtitle = document.getElementById('currentVideoSubtitle');
    const watermark = document.querySelector('.ref-video-watermark');
    const aboutDesc = document.getElementById('aboutCourseDesc');

    if (breadcrumbRoot) breadcrumbRoot.textContent = 'Kurikulum';
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

    showToast(`Beralih ke Portal Pembelajaran: ${data.jenjangPill}`);
    playTone(520, 'sine', 0.1, 0.06);
  }

  function togglePlayVideo() {
    const playIcon = document.getElementById('playIcon');
    if (playIcon) {
      const isPlaying = playIcon.classList.contains('ph-pause');
      if (isPlaying) {
        playIcon.className = 'ph ph-play';
        showToast('Video materi dijeda');
        playTone(400, 'sine', 0.08, 0.06);
      } else {
        playIcon.className = 'ph ph-pause';
        showToast('Memutar video pembelajaran terlindungi watermark...');
        playTone(600, 'sine', 0.1, 0.06);
      }
    }
  }

  function _old_playPronunciationAudio() {
    playTone(480, 'sine', 0.12, 0.08);
    setTimeout(() => playTone(620, 'sine', 0.16, 0.08), 80);
    setTimeout(() => playTone(540, 'sine', 0.2, 0.06), 180);
    showToast('Memutar audio pelafalan makhraj huruf asuhan Umi Elly: "Al-Maktabatu"');
  }

  function switchSubTab(tabName) {
    document.querySelectorAll('.sub-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.subtab === tabName);
    });

    const tabs = ['ringkasan', 'audio', 'kuis', 'pengumuman', 'ulasan'];
    tabs.forEach(t => {
      const el = document.getElementById(`subtab-${t}`);
      if (el) el.style.display = t === tabName ? 'block' : 'none';
    });

    showToast(`Membuka: ${tabName === 'ringkasan' ? 'Ringkasan Materi' : tabName === 'audio' ? 'Pelafalan Mufrodat' : tabName === 'kuis' ? 'Evaluasi Pemahaman' : tabName === 'pengumuman' ? 'Pemberitahuan Yayasan' : 'Catatan & Ulasan'}`);
    playTone(520, 'sine', 0.08, 0.05);
  }

  function claimGameXp() {
    playTone(523.25, 'sine', 0.12, 0.08);
    setTimeout(() => playTone(783.99, 'sine', 0.18, 0.08), 120);
    showToast('Jawaban tepat. Pemahaman materi modul telah diverifikasi.');
  }

  function openCertModal(name = 'Ahmad Fauzan') {
    const m = document.getElementById('certModal');
    if (m) m.classList.add('open');
    playTone(600, 'sine', 0.12, 0.06);
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
      badge.innerHTML = '<i class="ph ph-check"></i> Infaq Terverifikasi';
      btn.style.display = 'none';
      if (count) count.textContent = '1 Santri';
      playTone(659, 'sine', 0.14, 0.08);
      showToast('Administrasi infaq diverifikasi. Hak akses modul santri telah aktif.');
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
      badge.innerHTML = '<i class="ph ph-hand-heart"></i> Beasiswa Ditetapkan';
      btn.style.display = 'none';
      if (countB) countB.textContent = '43 Santri';
      if (countP) countP.textContent = '0 Santri';
      playTone(783, 'triangle', 0.16, 0.08);
      showToast('Beasiswa disetujui Umi Elly. Hak akses santri diaktifkan penuh secara berkah.');
    }
  }


  // Main View Switcher (Course Player, AI Studio Assistant, Admin Panel)
  function switchMainView(viewName) {
    const courseView = document.getElementById('viewCoursePlayer');
    const adminView = document.getElementById('viewAdminPanel');
    const aiView = document.getElementById('viewAiAssistant');
    const ws = document.getElementById('refMainWorkspace');
    if (ws) ws.scrollTop = 0;

    const breadcrumbRoot = document.getElementById('breadcrumbRoot');
    const breadcrumbCategory = document.getElementById('breadcrumbCategory');
    const breadcrumb = document.getElementById('breadcrumbActiveTitle');

    // Reset Sidebar active states
    document.querySelectorAll('.ref-nav-item').forEach(item => {
      item.classList.remove('active');
    });

    if (viewName === 'ai-assistant') {
      if (courseView) courseView.style.display = 'none';
      if (adminView) adminView.style.display = 'none';
      if (aiView) aiView.style.display = 'block';

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Asisten Pembelajaran';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Kaidah & Konsultasi';
      if (breadcrumb) breadcrumb.textContent = 'Studio Asisten Bahasa Arab (Asuhan Umi Elly)';

      showToast('Membuka Studio Asisten Pintar Bahasa Arab');
      playTone(600, 'sine', 0.1, 0.06);
      return;
    }

    if (viewName === 'admin') {
      if (courseView) courseView.style.display = 'none';
      if (adminView) adminView.style.display = 'block';
      if (aiView) aiView.style.display = 'none';

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Yayasan PERISA';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Otoritas & Tata Kelola';
      if (breadcrumb) breadcrumb.textContent = 'Panel Pengurus Yayasan';

      showToast('Beralih ke Panel Otoritas dan Tata Kelola Yayasan');
      playTone(560, 'sine', 0.1, 0.06);
      return;
    }

    // Default: Course Player
    if (courseView) courseView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';
    if (aiView) aiView.style.display = 'none';

    if (breadcrumbRoot) breadcrumbRoot.textContent = 'Kurikulum';
    if (breadcrumbCategory) breadcrumbCategory.textContent = 'Bahasa Arab Jenjang SMP';
    if (breadcrumb) breadcrumb.textContent = 'Jumlah Ismiyyah dan Fasilitas Sekolah';

    showToast('Membuka Kurikulum Pembelajaran Bahasa Arab');
    playTone(520, 'sine', 0.1, 0.06);
  }

  function askAiQuestion(query) {
    const input = document.getElementById('aiInputPrompt');
    if (input) input.value = query;
    handleAiSend();
  }

  function handleAiSend() {
    const input = document.getElementById('aiInputPrompt');
    const box = document.getElementById('aiResponseBox');
    const content = document.getElementById('aiResponseContent');
    if (!input || !box || !content) return;

    const val = input.value.trim();
    if (!val) {
      showToast('Silakan masukkan pertanyaan kaidah bahasa Arab');
      return;
    }

    showToast('Menganalisis kaidah bahasa Arab berdasarkan sanad kurikulum...');
    playTone(640, 'sine', 0.12, 0.08);

    box.style.display = 'block';
    content.innerHTML = `<strong>Pertanyaan:</strong> "${val}"<br><br><strong>Analisis Kaidah Asuhan Umi Elly:</strong><br>` +
      `<p style="margin-top: 6px; line-height: 1.6;">Alhamdulillah, berdasarkan kaidah tata bahasa Arab dasar, struktur kalimat tersebut menggunakan kaidah <strong>Jumlah Ismiyyah</strong> yang diawali oleh Isim Ma'rifat sebagai <em>Mubtada' (مُبْتَدَأٌ)</em> berharkat Rofa' (Dhammah), diikuti oleh <em>Khobar (خَبَرٌ)</em> berupa Syibhul Jumlah (Jar wa Majrur) yang menyempurnakan makna kalimat secara utuh.</p>` +
      `<div style="margin-top: 8px; padding: 10px; background: var(--teal-light); border-radius: var(--radius-sm); font-size: 12px; color: #006D63;">` +
      `<strong>Rujukan Silabus:</strong> Modul 02 Hal. 14 — Yayasan Peradaban Islam Azhariyah.</div>`;
  }


  // Real Native Arabic Speech Engine (Web Speech API ar-SA)
  let speakingQueue = [];
  let isSpeakingAll = false;

  function speakArabic(arabicText, latinText, elementId = null) {
    // Visual Highlight
    if (elementId) {
      document.querySelectorAll('.arabic-word-card').forEach(c => c.classList.remove('speaking-active'));
      const activeEl = document.getElementById(elementId);
      if (activeEl) activeEl.classList.add('speaking-active');
    }

    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // Stop ongoing speech

      const utterance = new SpeechSynthesisUtterance(arabicText);
      utterance.lang = 'ar-SA';
      utterance.rate = 0.85; // Clear pedagogical speed
      utterance.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang.startsWith('ar') || v.name.toLowerCase().includes('arabic') || v.name.toLowerCase().includes('maged') || v.name.toLowerCase().includes('tarik') || v.name.toLowerCase().includes('laila'));
      if (arVoice) {
        utterance.voice = arVoice;
      }

      utterance.onstart = () => {
        showToast(`Memutar pelafalan fasih: "${latinText}" (${arabicText})`);
      };

      utterance.onend = () => {
        if (elementId) {
          const el = document.getElementById(elementId);
          if (el) el.classList.remove('speaking-active');
        }
      };

      utterance.onerror = () => {
        // Web Audio harmonic fallback if device has no TTS pack installed
        playTone(560, 'sine', 0.2, 0.1);
        if (elementId) {
          const el = document.getElementById(elementId);
          if (el) el.classList.remove('speaking-active');
        }
      };

      window.speechSynthesis.speak(utterance);
    } else {
      playTone(560, 'sine', 0.2, 0.1);
      showToast(`Audio: "${latinText}" (${arabicText})`);
    }
  }

  function playAllMufrodatSequence() {
    const playlist = [
      { arabic: 'المَكْتَبَةُ', latin: 'Al-Maktabatu (Perpustakaan)', id: 'wordCard-1' },
      { arabic: 'الكِتَابُ', latin: 'Al-Kitabu (Buku Pelajaran)', id: 'wordCard-2' },
      { arabic: 'القَلَمُ', latin: 'Al-Qalamu (Pena Tulis)', id: 'wordCard-3' },
      { arabic: 'الفَصْلُ', latin: 'Al-Fashlu (Ruang Kelas)', id: 'wordCard-4' }
    ];

    let currentIndex = 0;

    function playNext() {
      if (currentIndex >= playlist.length) {
        showToast('Selesai memutar seluruh pelafalan mufrodat.');
        return;
      }
      const item = playlist[currentIndex];
      speakArabic(item.arabic, item.latin, item.id);
      currentIndex++;
      setTimeout(playNext, 2200);
    }

    playNext();
  }

  return {
    setRole,
    switchMainView,
    askAiQuestion,
    handleAiSend,
    togglePlayVideo,
    playPronunciationAudio: playAllMufrodatSequence,
    speakArabic,
    playAllMufrodatSequence,
    switchSubTab,
    claimGameXp,
    openCertModal,
    closeCertModal,
    verifySantri,
    verifyBeasiswa,
    showToast
  };
})();
