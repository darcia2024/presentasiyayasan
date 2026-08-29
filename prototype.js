/**
 * YAYASAN PERADABAN ISLAM AZHARIYAH (PERISA)
 * Sistem Kurikulum Pembelajaran Bahasa Arab & Panel Tata Kelola
 * Asuhan Umi Elly
 */

const PrototypeApp = (() => {
  // Data Kurikulum Per Jenjang
  const roleData = {
    'santri-sd': {
      user: { name: 'Aisyah Zahra', initials: 'AZ', level: 'Santri Jenjang SD Kelas 5', phone: '0821-4455-6677', nisn: 'NISN: PERISA-SD-0291', status: 'Terverifikasi • Infaq Aktif', bg: '#00877A' },
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
      user: { name: 'Ahmad Fauzan', initials: 'AF', level: 'Santri Jenjang SMP Kelas 8', phone: '0812-8921-9921', nisn: 'NISN: PERISA-SMP-0821', status: 'Terverifikasi • Infaq Aktif', bg: '#00877A' },
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
      user: { name: 'M. Rizky Pratama', initials: 'RP', level: 'Santri Jenjang SMA Kelas 11', phone: '0813-7788-9900', nisn: 'NISN: PERISA-SMA-1104', status: 'Terverifikasi • Infaq Aktif', bg: '#072826' },
      breadcrumb: 'Kaidah Nahwu-Shorof Terapan dan Tashrif',
      title: 'Bahasa Arab SMA: Nahwu-Shorof Terapan & Tashrif',
      jenjangPill: 'Jenjang SMA Kelas 11',
      metaStats: '14 Modul Pembelajaran • Durasi: 3 Jam 15 Menit • Kurikulum Lanjutan',
      arabicTitle: 'تَصْرِيْفُ الأَفْعَالِ الثُّلَاثِيَّةِ',
      subtitle: "Modul 01: Perubahan Bentuk Kata Kerja (Madhi, Mudhari', Amr)",
      watermark: 'M. Rizky Pratama • 0813-7788-9900 • Hak Cipta PERISA Azhariyah',
      aboutDesc: "Modul lanjutan ilmu Shorof dan kaidah I'rob kitab turats serta latihan pidato dakwah resmi asuhan Umi Elly.",
      lessons: [
        { name: 'Pola Perubahan Kata Kerja (Tashrif)', time: '35 Menit', active: true },
        { name: "Tanda I'rob Asli (Rofa', Nashob, Jer)", time: '40 Menit', active: false },
        { name: 'Muhadatsah Dakwah & Pidato Khitobah', time: '30 Menit', active: false },
        { name: 'Lembar Evaluasi Terapan', time: '15 Menit', active: false }
      ]
    },
    'admin': {
      user: { name: 'Ustadz Pengurus', initials: 'UE', level: 'Pengurus Otoritas Yayasan', phone: '0812-9900-1122', nisn: 'ID: ADM-PERISA-001', status: 'Otoritas Pusat • Administrator', bg: '#C5921B' },
      breadcrumb: 'Panel Otoritas dan Tata Kelola Yayasan',
      title: 'Panel Kendali Otoritas & Tata Kelola Yayasan',
      jenjangPill: 'Otoritas Yayasan',
      metaStats: 'Pusat Kendali Santri • Infaq • Validasi Kelulusan Sanad',
      arabicTitle: 'إِدَارَةُ المَعْهَدِ وَالمُؤَسَّسَةِ',
      subtitle: 'Tata Kelola Santri, Pengawasan Infaq, & Sanad Kelulusan',
      watermark: 'Otoritas Resmi Yayasan PERISA Azhariyah',
      aboutDesc: 'Panel administrasi dan pengawasan proses belajar seluruh santri Yayasan Peradaban Islam Azhariyah.',
      lessons: []
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

  // Set Role Action (Full Dynamic Synchronization)
  function setRole(roleName) {
    document.querySelectorAll('.role-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.role === roleName);
    });

    const data = roleData[roleName] || roleData['santri-smp'];

    // 1. Update Sidebar User Card
    const userCardAvatar = document.getElementById('sidebarUserAvatar');
    const userCardName = document.getElementById('sidebarUserName');
    const userCardSub = document.getElementById('sidebarUserSub');
    if (userCardAvatar) {
      userCardAvatar.textContent = data.user.initials;
      userCardAvatar.style.background = data.user.bg;
    }
    if (userCardName) userCardName.textContent = data.user.name;
    if (userCardSub) userCardSub.textContent = data.user.level;

    // 2. Update Profile Dropdown Menu Elements
    const dropAvatar = document.getElementById('dropdownAvatarLarge');
    const dropName = document.getElementById('dropdownUserName');
    const dropStatus = document.getElementById('dropdownUserStatus');
    const dropNisn = document.getElementById('dropdownUserNisn');
    if (dropAvatar) {
      dropAvatar.textContent = data.user.initials;
      dropAvatar.style.background = data.user.bg;
    }
    if (dropName) dropName.textContent = data.user.name;
    if (dropStatus) dropStatus.textContent = data.user.status;
    if (dropNisn) dropNisn.textContent = data.user.nisn;

    // Update checkmarks in dropdown
    ['sd', 'smp', 'sma', 'admin'].forEach(k => {
      const item = document.getElementById(`accountItem-${k}`);
      const check = document.getElementById(`check-${k}`);
      const isCurrent = (k === 'sd' && roleName === 'santri-sd') ||
                        (k === 'smp' && roleName === 'santri-smp') ||
                        (k === 'sma' && roleName === 'santri-sma') ||
                        (k === 'admin' && roleName === 'admin');
      if (item) item.classList.toggle('current', isCurrent);
      if (check) check.style.display = isCurrent ? 'block' : 'none';
    });

    // 3. View Switching
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

      showToast('Beralih ke Akun Pengurus: Panel Otoritas Yayasan');
      playTone(560, 'sine', 0.1, 0.06);
      return;
    }

    // Student Role (SD, SMP, SMA)
    if (courseView) courseView.style.display = 'block';
    if (adminView) adminView.style.display = 'none';

    // 4. Update Course Content Elements
    const mainTitle = document.getElementById('courseMainTitle');
    const jenjangText = document.getElementById('courseJenjangText');
    const arabicTitle = document.getElementById('currentVideoArabic');
    const subtitle = document.getElementById('currentVideoSubtitle');
    const watermark = document.querySelector('.ref-video-watermark');
    const aboutDesc = document.getElementById('aboutCourseDesc');

    if (breadcrumbRoot) breadcrumbRoot.textContent = 'Kurikulum';
    if (breadcrumbCategory) breadcrumbCategory.textContent = data.jenjangPill;
    if (breadcrumb) breadcrumb.textContent = data.breadcrumb;

    if (mainTitle) mainTitle.textContent = data.title;
    if (jenjangText) jenjangText.textContent = data.jenjangPill;
    if (arabicTitle) arabicTitle.textContent = data.arabicTitle;
    if (subtitle) subtitle.textContent = data.subtitle;
    if (watermark) watermark.innerHTML = `<i class="ph ph-shield-check"></i> ${data.watermark}`;
    if (aboutDesc) aboutDesc.textContent = data.aboutDesc;

    // 5. Render Lessons
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

    showToast(`Beralih ke Akun Santri: ${data.user.name} (${data.jenjangPill})`);
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

  // Main View Router (Beranda, Modul PDF, Kurikulum, Asisten AI, Admin)
  function switchMainView(viewName) {
    const berandaView = document.getElementById('viewBerandaUtama');
    const courseView = document.getElementById('viewCoursePlayer');
    const pdfView = document.getElementById('viewModulPdf');
    const aiView = document.getElementById('viewAiAssistant');
    const adminView = document.getElementById('viewAdminPanel');
    const ws = document.getElementById('refMainWorkspace');
    if (ws) ws.scrollTop = 0;

    const breadcrumbRoot = document.getElementById('breadcrumbRoot');
    const breadcrumbCategory = document.getElementById('breadcrumbCategory');
    const breadcrumb = document.getElementById('breadcrumbActiveTitle');

    // Hide all views first
    if (berandaView) berandaView.style.display = 'none';
    if (courseView) courseView.style.display = 'none';
    if (pdfView) pdfView.style.display = 'none';
    if (aiView) aiView.style.display = 'none';
    if (adminView) adminView.style.display = 'none';

    // Reset Sidebar Nav Active states
    document.querySelectorAll('.ref-nav-item').forEach(item => item.classList.remove('active'));

    if (viewName === 'beranda') {
      if (berandaView) berandaView.style.display = 'block';
      const nav = document.getElementById('nav-beranda');
      if (nav) nav.classList.add('active');

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Portal Utama';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Dashboard Santri';
      if (breadcrumb) breadcrumb.textContent = 'Beranda Informasi Pembelajaran';

      showToast('Membuka Beranda Utama Santri');
      playTone(520, 'sine', 0.1, 0.06);
      return;
    }

    if (viewName === 'modul-pdf') {
      if (pdfView) pdfView.style.display = 'block';
      const nav = document.getElementById('nav-modul-pdf');
      if (nav) nav.classList.add('active');

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Perpustakaan Digital';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Dokumen & Silabus';
      if (breadcrumb) breadcrumb.textContent = 'Arsip Modul PDF Resmi';

      showToast('Membuka Arsip Modul dan Silabus PDF');
      playTone(540, 'sine', 0.1, 0.06);
      return;
    }

    if (viewName === 'ai-assistant') {
      if (aiView) aiView.style.display = 'block';
      const nav = document.getElementById('nav-asisten-ai');
      if (nav) nav.classList.add('active');

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Asisten Pembelajaran';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Kaidah & Konsultasi';
      if (breadcrumb) breadcrumb.textContent = 'Studio Asisten Bahasa Arab (Asuhan Umi Elly)';

      showToast('Membuka Studio Asisten Pintar Bahasa Arab');
      playTone(600, 'sine', 0.1, 0.06);
      return;
    }

    if (viewName === 'admin') {
      if (adminView) adminView.style.display = 'block';
      const nav = document.getElementById('nav-admin');
      if (nav) nav.classList.add('active');

      if (breadcrumbRoot) breadcrumbRoot.textContent = 'Yayasan PERISA';
      if (breadcrumbCategory) breadcrumbCategory.textContent = 'Otoritas & Tata Kelola';
      if (breadcrumb) breadcrumb.textContent = 'Panel Pengurus Yayasan';

      showToast('Beralih ke Panel Otoritas dan Tata Kelola Yayasan');
      playTone(560, 'sine', 0.1, 0.06);
      return;
    }

    // Default: Kurikulum / Course Player
    if (courseView) courseView.style.display = 'block';
    const nav = document.getElementById('nav-kurikulum');
    if (nav) nav.classList.add('active');

    if (breadcrumbRoot) breadcrumbRoot.textContent = 'Kurikulum';
    if (breadcrumbCategory) breadcrumbCategory.textContent = 'Bahasa Arab Jenjang SMP';
    if (breadcrumb) breadcrumb.textContent = 'Jumlah Ismiyyah dan Fasilitas Sekolah';

    showToast('Membuka Kurikulum Pembelajaran Bahasa Arab');
    playTone(520, 'sine', 0.1, 0.06);
  }

  function openPdfPreview(title, author, size) {
    const modal = document.getElementById('pdfModal');
    const nameEl = document.getElementById('pdfDocName');
    const metaEl = document.getElementById('pdfDocMeta');
    if (nameEl) nameEl.textContent = title;
    if (metaEl) metaEl.textContent = `Penyusun: ${author} • ${size} • Format PDF Resmi`;
    if (modal) modal.classList.add('open');
    playTone(580, 'sine', 0.1, 0.06);
  }

  function closePdfPreview() {
    const modal = document.getElementById('pdfModal');
    if (modal) modal.classList.remove('open');
  }


  // Filter PDF Library by Category (all, sd, smp, sma)
  function filterPdfLibrary(category) {
    document.querySelectorAll('.pdf-filter-tab').forEach(tab => {
      const isMatch = tab.dataset.filter === category;
      tab.classList.toggle('active', isMatch);
      if (isMatch) {
        tab.style.background = 'var(--teal-primary)';
        tab.style.color = '#FFFFFF';
        tab.style.borderColor = 'transparent';
      } else {
        tab.style.background = 'var(--bg-subtle)';
        tab.style.color = 'var(--text-body)';
        tab.style.borderColor = 'var(--border-color)';
      }
    });

    const cards = document.querySelectorAll('.pdf-card');
    let visibleCount = 0;
    cards.forEach(card => {
      const catAttr = card.dataset.category || '';
      if (category === 'all' || catAttr.includes(category)) {
        card.style.display = 'flex';
        visibleCount++;
      } else {
        card.style.display = 'none';
      }
    });

    showToast(`Menampilkan ${visibleCount} dokumen silabus untuk filter: ${category.toUpperCase()}`);
    playTone(540, 'sine', 0.08, 0.05);
  }

  // Realistic PDF Reader Data Store
  const pdfDocsData = {
    1: {
      file: 'Silabus Resmi Bahasa Arab SMP.pdf',
      title: 'Silabus Kurikulum Bahasa Arab Jenjang SMP',
      sub: 'Modul 02: Kaidah Jumlah Ismiyyah & Mufrodat Fasilitas Sekolah',
      author: 'Umi Elly',
      bodyHtml: `
        <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">A. Kaidah Tata Bahasa (القَوَاعِدُ النَّحْوِيَّةُ)</h3>
        <p style="margin-bottom: 12px;"><strong>Jumlah Ismiyyah</strong> adalah susunan kalimat sempurna dalam bahasa Arab yang diawali oleh <em>Isim (Kata Benda)</em>. Struktur pokoknya terdiri atas dua unsur pokok:</p>
        <ol style="margin-left: 20px; margin-bottom: 16px;">
          <li><strong>Mubtada' (مُبْتَدَأٌ)</strong>: Isim pokok berharkat Rofa' (Dhammah) yang menjadi subjek di awal kalimat.</li>
          <li><strong>Khobar (خَبَرٌ)</strong>: Penjelas yang menyempurnakan makna kalimat secara utuh.</li>
        </ol>
        <div style="background: var(--bg-subtle); border-left: 3px solid var(--teal-primary); padding: 12px 16px; margin-bottom: 16px;">
          <div style="font-size: 18px; font-weight: 700; color: var(--teal-primary); font-family: 'Amiri', Arial;">الكِتَابُ عَلَى المَكْتَبِ</div>
          <div style="font-size: 11.5px; color: var(--text-body);">"Buku itu berada di atas meja." — الكِتَابُ (Mubtada'), عَلَى المَكْتَبِ (Khobar Syibhul Jumlah).</div>
        </div>
      `
    },
    2: {
      file: 'Ringkasan Mufrodat Fasilitas Sekolah.pdf',
      title: 'Daftar Kosakata Tematik Sarana & Fasilitas Sekolah',
      sub: 'Modul Pembelajaran Kosakata Terpadu SD & SMP',
      author: 'Umi Elly',
      bodyHtml: `
        <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">A. Kosakata Fasilitas Pendidikan</h3>
        <p style="margin-bottom: 12px;">Daftar 20 kosakata tematik fasilitas sekolah yang wajib dihafal santri:</p>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">المَكْتَبَةُ</strong> : Perpustakaan</div>
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">الفَصْلُ</strong> : Ruang Kelas</div>
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">المَلْعَبُ</strong> : Lapangan Olahraga</div>
          <div style="background: var(--bg-subtle); padding: 10px; border-radius: 6px;"><strong style="color:var(--teal-primary); font-size:16px; font-family:'Amiri', Arial;">المَسْجِدُ</strong> : Masjid Sekolah</div>
        </div>
      `
    },
    3: {
      file: 'Tabel Tashrif Fi\'il Tsulatsi Mujarrad.pdf',
      title: 'Matriks Tashrif Fi\'il Tsulatsi Mujarrad 6 Bab',
      sub: 'Kaidah Ilmu Shorof Lanjutan Jenjang SMA',
      author: 'Umi Elly',
      bodyHtml: `
        <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">A. Pola Wazan Bab Pertama (فَعَلَ - يَفْعُلُ)</h3>
        <p style="margin-bottom: 12px;">Contoh perubahan kata kerja dasar <strong>كَتَبَ (Menulis)</strong>:</p>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <tr style="background: var(--bg-subtle); font-weight: 700;">
            <th style="padding: 8px; border: 1px solid var(--border-color);">Fi'il Madhi</th>
            <th style="padding: 8px; border: 1px solid var(--border-color);">Fi'il Mudhari'</th>
            <th style="padding: 8px; border: 1px solid var(--border-color);">Masdar</th>
            <th style="padding: 8px; border: 1px solid var(--border-color);">Fi'il Amr</th>
          </tr>
          <tr>
            <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px; color: var(--teal-primary);">كَتَبَ</td>
            <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px;">يَكْتُبُ</td>
            <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px;">كِتَابَةً</td>
            <td style="padding: 8px; border: 1px solid var(--border-color); font-family: 'Amiri', Arial; font-size: 15px; color: #D97706;">اُكْتُبْ</td>
          </tr>
        </table>
      `
    },
    4: {
      file: 'Kumpulan Hiwar Percakapan Santri.pdf',
      title: 'Kumpulan Percakapan Tematik Sehari-Hari',
      sub: 'Hiwar Bahasa Arab Baku Santri Azhariyah',
      author: 'Umi Elly',
      bodyHtml: `
        <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">Hiwar 1: Di Lingkungan Perpustakaan</h3>
        <div style="background: var(--bg-subtle); padding: 14px; border-radius: 8px; line-height: 1.8;">
          <p><strong>أَحْمَد :</strong> السَّلَامُ عَلَيْكُمْ يَا أَخِي</p>
          <p><strong>فَوْزَان :</strong> وَعَلَيْكُمُ السَّلَامُ وَرَحْمَةُ اللهِ</p>
          <p><strong>أَحْمَد :</strong> أَيْنَ تَمْشِي الآنَ؟</p>
          <p><strong>فَوْزَان :</strong> أَنَا أَمْشِي إِلَى المَكْتَبَةِ لِقِرَاءَةِ كِتَابِ اللُّغَةِ العَرَبِيَّةِ.</p>
        </div>
      `
    },
    5: {
      file: 'Panduan Makhraj Huruf Arab.pdf',
      title: 'Buku Rujukan Tempat Keluarnya Huruf (Makharijul Huruf)',
      sub: 'Standar Bacaan Al-Qur\'an dan Fonetik Arab Berkesinambungan Sanad',
      author: 'Umi Elly',
      bodyHtml: `
        <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">5 Tempat Umum Makharijul Huruf (مَخَارِجُ الحُرُوْفِ)</h3>
        <ol style="margin-left: 20px; line-height: 1.7;">
          <li><strong>Al-Jauf (الجَوْفُ)</strong>: Rongga mulut dan tenggorokan untuk huruf mad (ا ، و ، ي).</li>
          <li><strong>Al-Halq (الحَلْقُ)</strong>: Tenggorokan (ء ، هـ ، ع ، ح ، غ ، خ).</li>
          <li><strong>Al-Lisan (اللِّسَانُ)</strong>: Lidah (18 huruf).</li>
          <li><strong>Asy-Syafatain (الشَّفَتَيْنِ)</strong>: Kedua bibir (ب ، م ، و ، ف).</li>
          <li><strong>Al-Khaisyum (Khayasyim - الخَيْشُوْمُ)</strong>: Rongga hidung untuk Ghunnah.</li>
        </ol>
      `
    },
    6: {
      file: 'Kaidah I\'rob Praktis Pemula.pdf',
      title: 'Pedoman Analisis Kaidah I\'rob untuk Pemula',
      sub: 'Pengenalan Tanda Rofa\', Nashob, Jer, dan Jazm',
      author: 'Umi Elly',
      bodyHtml: `
        <h3 style="font-size: 14px; font-weight: 700; color: var(--teal-dark); margin-bottom: 8px;">Tanda-Tanda Pokok I\'rob</h3>
        <ul style="margin-left: 20px; line-height: 1.7;">
          <li><strong>Rofa\' (الرَّفْعُ)</strong>: Tanda pokoknya Dhammah (contoh: المُسْلِمُ).</li>
          <li><strong>Nashob (النَّصْبُ)</strong>: Tanda pokoknya Fathah (contoh: رَأَيْتُ المُسْلِمَ).</li>
          <li><strong>Jer (الجَرُّ)</strong>: Tanda pokoknya Kasrah (contoh: مَرَرْتُ بِالمُسْلِمِ).</li>
          <li><strong>Jazm (الجَزْمُ)</strong>: Tanda pokoknya Sukun (contoh: لَمْ يَكْتُبْ).</li>
        </ul>
      `
    }
  };

  function openDocReader(docId) {
    const data = pdfDocsData[docId] || pdfDocsData[1];
    const modal = document.getElementById('docReaderModal');
    const headerTitle = document.getElementById('readerHeaderDocTitle');
    const sheetTitle = document.getElementById('readerSheetTitle');
    const sheetSub = document.getElementById('readerSheetSub');
    const sheetBody = document.getElementById('readerSheetBody');

    if (headerTitle) headerTitle.textContent = data.file;
    if (sheetTitle) sheetTitle.textContent = data.title;
    if (sheetSub) sheetSub.textContent = `${data.sub} • Penyusun: ${data.author}`;
    if (sheetBody) sheetBody.innerHTML = data.bodyHtml;

    if (modal) modal.classList.add('open');
    showToast(`Membuka dokumen silabus: "${data.title}"`);
    playTone(600, 'sine', 0.1, 0.06);
  }

  function closeDocReader() {
    const modal = document.getElementById('docReaderModal');
    if (modal) modal.classList.remove('open');
  }


  // Mobile Drawer Toggle
  function toggleMobileDrawer() {
    const drawer = document.getElementById('mobileDrawerOverlay');
    if (drawer) {
      drawer.classList.toggle('open');
      playTone(560, 'sine', 0.08, 0.05);
    }
  }


  // Toggle User Profile Dropdown
  function toggleProfileDropdown(e) {
    if (e) e.stopPropagation();
    const card = document.getElementById('sidebarUserCard');
    const menu = document.getElementById('profileDropdownMenu');
    if (menu) {
      const isOpen = menu.classList.toggle('show');
      if (card) card.classList.toggle('active', isOpen);
      if (isOpen) playTone(540, 'sine', 0.08, 0.05);
    }
  }

  // Close profile dropdown when clicking anywhere outside
  document.addEventListener('click', (e) => {
    const card = document.getElementById('sidebarUserCard');
    const menu = document.getElementById('profileDropdownMenu');
    if (menu && menu.classList.contains('show')) {
      if (!menu.contains(e.target) && (!card || !card.contains(e.target))) {
        menu.classList.remove('show');
        if (card) card.classList.remove('active');
      }
    }
  });


  // Update Mobile Bottom Nav Active State
  function updateBottomNav(viewKey) {
    document.querySelectorAll('.bottom-nav-item').forEach(item => {
      item.classList.remove('active');
    });
    const target = document.getElementById(`bnav-${viewKey}`);
    if (target) target.classList.add('active');
  }

  return {
    setRole,
    toggleProfileDropdown,
    updateBottomNav,
    toggleMobileDrawer,
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
