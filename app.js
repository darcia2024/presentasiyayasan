/**
 * PLATFORM KELAS ONLINE PERADABAN ISLAM AZHARIYAH
 * Interactive Presentation Engine & Motion Choreography
 * Yayasan Umi Ely
 */

const DeckEngine = (() => {
  // State
  let currentSlide = 1;
  let totalSlides = 12;
  let isAudioEnabled = true;
  let isAutoplayActive = false;
  let autoplayTimer = null;
  let autoplayIntervalSeconds = 9;
  let touchStartX = 0;
  let touchStartY = 0;
  let isVideoPlaying = false;
  let videoPlayInterval = null;
  let videoCurrentSeconds = 504; // 08:24
  let currentSpeedIndex = 1;
  const speedOptions = ['1.0x', '1.25x', '1.5x', '2.0x'];

  // Audio Context (Web Audio API Synthesizer)
  let audioCtx = null;

  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
  }

  function playTone(freq = 520, type = 'sine', duration = 0.15, gainVal = 0.1) {
    if (!isAudioEnabled) return;
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

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
    } catch (e) {
      console.warn('Audio play failed:', e);
    }
  }

  function playSlideChime() {
    playTone(440, 'triangle', 0.18, 0.08);
    setTimeout(() => playTone(660, 'sine', 0.22, 0.06), 40);
  }

  function playSuccessChime() {
    playTone(523.25, 'sine', 0.15, 0.1);
    setTimeout(() => playTone(659.25, 'sine', 0.18, 0.1), 80);
    setTimeout(() => playTone(783.99, 'sine', 0.25, 0.12), 160);
  }

  // DOM Elements (Cached on Init)
  let slides = [];
  let navSlideCurrent = null;
  let navSlideTotal = null;
  let navSlideTitle = null;
  let deckProgressFill = null;
  let dockDotsStrip = null;
  let btnPrevSlide = null;
  let btnNextSlide = null;
  let btnAudioToggle = null;
  let audioIcon = null;
  let btnAutoplayToggle = null;
  let autoplayIcon = null;
  let btnOverviewToggle = null;
  let btnFullscreenToggle = null;
  let fullscreenIcon = null;
  let overviewModal = null;
  let btnCloseOverview = null;
  let slideOverviewGrid = null;
  let toastBox = null;
  let toastMessage = null;

  // Initialize
  function init() {
    slides = document.querySelectorAll('.slide-card');
    totalSlides = slides.length;
    navSlideCurrent = document.getElementById('navSlideCurrent');
    navSlideTotal = document.getElementById('navSlideTotal');
    navSlideTitle = document.getElementById('navSlideTitle');
    deckProgressFill = document.getElementById('deckProgressFill');
    dockDotsStrip = document.getElementById('dockDotsStrip');
    btnPrevSlide = document.getElementById('btnPrevSlide');
    btnNextSlide = document.getElementById('btnNextSlide');
    btnAudioToggle = document.getElementById('btnAudioToggle');
    audioIcon = document.getElementById('audioIcon');
    btnAutoplayToggle = document.getElementById('btnAutoplayToggle');
    autoplayIcon = document.getElementById('autoplayIcon');
    btnOverviewToggle = document.getElementById('btnOverviewToggle');
    btnFullscreenToggle = document.getElementById('btnFullscreenToggle');
    fullscreenIcon = document.getElementById('fullscreenIcon');
    overviewModal = document.getElementById('overviewModal');
    btnCloseOverview = document.getElementById('btnCloseOverview');
    slideOverviewGrid = document.getElementById('slideOverviewGrid');
    toastBox = document.getElementById('toastBox');
    toastMessage = document.getElementById('toastMessage');

    if (navSlideTotal) navSlideTotal.textContent = String(totalSlides).padStart(2, '0');

    buildDockDots();
    buildOverviewGrid();
    bindEvents();
    bindMockupEvents();

    // Check URL Hash
    let initialSlide = 1;
    const hash = window.location.hash.replace('#', '');
    if (hash) {
      const parsed = parseInt(hash.replace('slide-', ''), 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= totalSlides) {
        initialSlide = parsed;
      }
    }

    updateSlideView(initialSlide, false);
  }

  // Build Dots in Bottom Dock
  function buildDockDots() {
    if (!dockDotsStrip) return;
    dockDotsStrip.innerHTML = '';
    slides.forEach((slide, index) => {
      const slideNum = index + 1;
      const dot = document.createElement('div');
      dot.className = `dock-dot ${slideNum === currentSlide ? 'active' : ''}`;
      dot.title = `Slide ${slideNum}: ${slide.dataset.slideTitle || ''}`;
      dot.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(slideNum);
      });
      dockDotsStrip.appendChild(dot);
    });
  }

  // Build Overview Grid in Modal
  function buildOverviewGrid() {
    if (!slideOverviewGrid) return;
    slideOverviewGrid.innerHTML = '';
    slides.forEach((slide, index) => {
      const slideNum = index + 1;
      const title = slide.dataset.slideTitle || `Slide ${slideNum}`;
      const thumb = document.createElement('div');
      thumb.className = `grid-slide-thumb ${slideNum === currentSlide ? 'current' : ''}`;
      thumb.dataset.slideIndex = slideNum;
      thumb.innerHTML = `
        <div class="thumb-num">Slide ${String(slideNum).padStart(2, '0')}</div>
        <div class="thumb-title">${title}</div>
      `;
      thumb.addEventListener('click', (e) => {
        e.stopPropagation();
        goToSlide(slideNum);
        closeOverviewModal();
      });
      slideOverviewGrid.appendChild(thumb);
    });
  }

  // Update Slide UI
  function updateSlideView(newIndex, playSound = true) {
    if (newIndex < 1 || newIndex > totalSlides) return;

    currentSlide = newIndex;

    slides.forEach((slide, idx) => {
      const slideNum = idx + 1;
      if (slideNum === currentSlide) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    try {
      history.replaceState(null, null, `#slide-${currentSlide}`);
    } catch(e) {}

    // Update Nav Bar
    if (navSlideCurrent) navSlideCurrent.textContent = String(currentSlide).padStart(2, '0');
    const activeSlideEl = document.querySelector(`.slide-card[data-slide-index="${currentSlide}"]`);
    if (activeSlideEl && navSlideTitle) {
      navSlideTitle.textContent = activeSlideEl.dataset.slideTitle || '';
    }

    // Update Progress Fill
    if (deckProgressFill) {
      const pct = (currentSlide / totalSlides) * 100;
      deckProgressFill.style.width = `${pct}%`;
    }

    // Update Dock Dots
    const allDots = document.querySelectorAll('.dock-dot');
    allDots.forEach((dot, idx) => {
      if (idx + 1 === currentSlide) {
        dot.classList.add('active');
      } else {
        dot.classList.remove('active');
      }
    });

    // Update Overview Modal Highlights
    const allThumbs = document.querySelectorAll('.grid-slide-thumb');
    allThumbs.forEach((thumb, idx) => {
      if (idx + 1 === currentSlide) {
        thumb.classList.add('current');
      } else {
        thumb.classList.remove('current');
      }
    });

    if (playSound) {
      playSlideChime();
    }
  }

  // Navigation Methods
  function nextSlide() {
    if (currentSlide < totalSlides) {
      goToSlide(currentSlide + 1);
    } else {
      goToSlide(1);
    }
  }

  function prevSlide() {
    if (currentSlide > 1) {
      goToSlide(currentSlide - 1);
    }
  }

  function goToSlide(slideNumber) {
    if (slideNumber >= 1 && slideNumber <= totalSlides) {
      updateSlideView(slideNumber, true);
      if (isAutoplayActive) {
        restartAutoplay();
      }
    }
  }

  // Event Listeners
  function bindEvents() {
    if (btnPrevSlide) btnPrevSlide.onclick = () => prevSlide();
    if (btnNextSlide) btnNextSlide.onclick = () => nextSlide();

    const btnStartDeck = document.getElementById('btnStartDeck');
    if (btnStartDeck) btnStartDeck.onclick = () => nextSlide();

    if (btnAudioToggle) {
      btnAudioToggle.onclick = () => {
        isAudioEnabled = !isAudioEnabled;
        if (audioIcon) {
          audioIcon.className = isAudioEnabled ? 'ph ph-speaker-high' : 'ph ph-speaker-slash';
        }
        showToast(isAudioEnabled ? 'Suara efek diaktifkan' : 'Suara efek dinonaktifkan');
        if (isAudioEnabled) playTone(600, 'sine', 0.15, 0.1);
      };
    }

    if (btnAutoplayToggle) {
      btnAutoplayToggle.onclick = () => toggleAutoplay();
    }

    if (btnOverviewToggle) {
      btnOverviewToggle.onclick = () => toggleOverviewModal();
    }
    if (btnCloseOverview) {
      btnCloseOverview.onclick = () => closeOverviewModal();
    }
    if (overviewModal) {
      overviewModal.onclick = (e) => {
        if (e.target === overviewModal) closeOverviewModal();
      };
    }

    if (btnFullscreenToggle) {
      btnFullscreenToggle.onclick = () => toggleFullscreen();
    }

    // Direct Window Keyboard Listener (Space, Arrows, Shortcuts)
    window.onkeydown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case ' ':
        case 'Spacebar':
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
          e.preventDefault();
          nextSlide();
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'Backspace':
        case 'PageUp':
          e.preventDefault();
          prevSlide();
          break;
        case 'Home':
          e.preventDefault();
          goToSlide(1);
          break;
        case 'End':
          e.preventDefault();
          goToSlide(totalSlides);
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case 'g':
        case 'G':
        case 'o':
        case 'O':
          toggleOverviewModal();
          break;
        case 'p':
        case 'P':
          toggleAutoplay();
          break;
        case 'm':
        case 'M':
          if (btnAudioToggle) btnAudioToggle.click();
          break;
        case 'Escape':
          closeOverviewModal();
          break;
        default:
          if (e.key >= '1' && e.key <= '9') {
            const num = parseInt(e.key, 10);
            if (num <= totalSlides) goToSlide(num);
          }
          break;
      }
    };

    // Touch Swipe Gestures
    const stage = document.getElementById('presentationStage');
    if (stage) {
      stage.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
        touchStartY = e.changedTouches[0].screenY;
      }, { passive: true });

      stage.addEventListener('touchend', (e) => {
        const touchEndX = e.changedTouches[0].screenX;
        const touchEndY = e.changedTouches[0].screenY;
        const diffX = touchEndX - touchStartX;
        const diffY = touchEndY - touchStartY;
        if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 40) {
          if (diffX < 0) nextSlide();
          else prevSlide();
        }
      }, { passive: true });
    }
  }

  // Fullscreen API
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        if (fullscreenIcon) fullscreenIcon.className = 'ph ph-corners-in';
        showToast('Mode Layar Penuh Aktif');
      }).catch(err => console.warn('Fullscreen error:', err));
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().then(() => {
          if (fullscreenIcon) fullscreenIcon.className = 'ph ph-corners-out';
          showToast('Keluar Layar Penuh');
        });
      }
    }
  }

  // Overview Modal
  function toggleOverviewModal() {
    if (!overviewModal) return;
    overviewModal.classList.toggle('open');
  }

  function closeOverviewModal() {
    if (!overviewModal) return;
    overviewModal.classList.remove('open');
  }

  // Autoplay Mode
  function toggleAutoplay() {
    isAutoplayActive = !isAutoplayActive;
    if (isAutoplayActive) {
      if (autoplayIcon) autoplayIcon.className = 'ph ph-pause';
      showToast(`Autoplay Aktif (${autoplayIntervalSeconds} detik)`);
      restartAutoplay();
    } else {
      if (autoplayIcon) autoplayIcon.className = 'ph ph-play';
      showToast('Autoplay Dihentikan');
      clearInterval(autoplayTimer);
    }
  }

  function restartAutoplay() {
    clearInterval(autoplayTimer);
    if (!isAutoplayActive) return;
    autoplayTimer = setInterval(() => {
      nextSlide();
    }, autoplayIntervalSeconds * 1000);
  }

  // Toast Notification
  let toastTimeout = null;
  function showToast(msg) {
    if (!toastBox || !toastMessage) return;
    toastMessage.textContent = msg;
    toastBox.classList.add('show');
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => {
      toastBox.classList.remove('show');
    }, 2800);
  }
// =========================================================================
  // INTERACTIVE MOCKUP LOGIC
  // =========================================================================
  function bindMockupEvents() {
    // 1. Student Mockup Video Player Interactivity (Slide 6)
    const btnCenterPlay = document.getElementById('btnPlayerCenterPlay');
    const btnBarPlay = document.getElementById('btnPlayerPlayToggle');
    const centerPlayIcon = document.getElementById('centerPlayIcon');
    const barPlayIcon = document.getElementById('barPlayIcon');
    const playerTimer = document.getElementById('playerTimer');
    const playerScrubFill = document.getElementById('playerScrubFill');
    const btnSpeedToggle = document.getElementById('btnSpeedToggle');
    const btnMarkComplete = document.getElementById('btnMarkComplete');
    const markDoneIcon = document.getElementById('markDoneIcon');
    const markDoneText = document.getElementById('markDoneText');
    const totalProgressText = document.getElementById('totalProgressText');
    const sidebarProgressFill = document.getElementById('sidebarProgressFill');

    function togglePlayState() {
      isVideoPlaying = !isVideoPlaying;
      if (isVideoPlaying) {
        if (centerPlayIcon) centerPlayIcon.className = 'ph ph-pause-fill';
        if (barPlayIcon) barPlayIcon.className = 'ph ph-pause-fill';
        showToast('Video diputar: Sesi 2 - Baitul Hikmah Baghdad');
        playTone(550, 'sine', 0.1, 0.08);

        videoPlayInterval = setInterval(() => {
          videoCurrentSeconds += 1;
          const mins = Math.floor(videoCurrentSeconds / 60);
          const secs = videoCurrentSeconds % 60;
          if (playerTimer) {
            playerTimer.textContent = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')} / 45:10`;
          }
          if (playerScrubFill) {
            const scrubPct = (videoCurrentSeconds / 2710) * 100;
            playerScrubFill.style.width = `${Math.min(scrubPct, 100)}%`;
          }
        }, 1000);
      } else {
        if (centerPlayIcon) centerPlayIcon.className = 'ph ph-play-fill';
        if (barPlayIcon) barPlayIcon.className = 'ph ph-play-fill';
        clearInterval(videoPlayInterval);
        showToast('Video dijeda');
      }
    }

    if (btnCenterPlay) btnCenterPlay.addEventListener('click', togglePlayState);
    if (btnBarPlay) btnBarPlay.addEventListener('click', togglePlayState);

    // Speed Pill
    if (btnSpeedToggle) {
      btnSpeedToggle.addEventListener('click', () => {
        currentSpeedIndex = (currentSpeedIndex + 1) % speedOptions.length;
        btnSpeedToggle.textContent = speedOptions[currentSpeedIndex];
        showToast(`Kecepatan putar: ${speedOptions[currentSpeedIndex]}`);
        playTone(700, 'sine', 0.08, 0.06);
      });
    }

    // Mark Complete Button
    if (btnMarkComplete) {
      btnMarkComplete.addEventListener('click', () => {
        const isDone = btnMarkComplete.classList.toggle('completed');
        if (isDone) {
          if (markDoneIcon) markDoneIcon.className = 'ph ph-check-fat-fill';
          if (markDoneText) markDoneText.textContent = 'Tuntas Dipelajari ✔';
          if (totalProgressText) totalProgressText.textContent = '75% Tuntas';
          if (sidebarProgressFill) sidebarProgressFill.style.width = '75%';
          playSuccessChime();
          showToast('Alhamdulillah! Progres santri bertambah menjadi 75%');
        } else {
          if (markDoneIcon) markDoneIcon.className = 'ph ph-check-circle';
          if (markDoneText) markDoneText.textContent = 'Tandai Selesai';
          if (totalProgressText) totalProgressText.textContent = '62% Tuntas';
          if (sidebarProgressFill) sidebarProgressFill.style.width = '62%';
        }
      });
    }

    // Interactive Syllabus Click
    const syllabusItems = document.querySelectorAll('.syllabus-item:not(.locked)');
    const activeModuleTitle = document.getElementById('activeModuleTitle');
    const playerHudTitle = document.getElementById('playerHudTitle');

    syllabusItems.forEach((item) => {
      item.addEventListener('click', () => {
        syllabusItems.forEach(i => i.classList.remove('active-syl'));
        item.classList.add('active-syl');
        const title = item.dataset.title || 'Modul Pembelajaran';
        if (activeModuleTitle) activeModuleTitle.textContent = title;
        if (playerHudTitle) playerHudTitle.textContent = title;
        showToast(`Membuka materi: ${title}`);
        playTone(600, 'triangle', 0.12, 0.08);
      });
    });

    // 2. Admin Mockup Tab Filters (Slide 8)
    const adminTabs = document.querySelectorAll('.admin-tab');
    const tableRows = document.querySelectorAll('#santriTableBody tr');

    adminTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        adminTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const filter = tab.dataset.filter;

        tableRows.forEach(row => {
          const status = row.dataset.status;
          if (filter === 'all' || status === filter) {
            row.style.display = '';
          } else {
            row.style.display = 'none';
          }
        });

        showToast(`Filter tabel: ${tab.textContent}`);
        playTone(500, 'sine', 0.08, 0.05);
      });
    });
  }

  // Admin Verification Action Handler
  function verifySantri(id) {
    const row = document.getElementById(`row-${id}`);
    const badge = document.getElementById(`statusBadge-${id}`);
    const btnVerify = document.getElementById(`btnVerify-${id}`);
    const switchAccess = document.getElementById(`switchAccess-${id}`);
    const progText = document.getElementById(`progText-${id}`);
    const pendingCount = document.getElementById(`pendingCount`);

    if (row && badge && btnVerify) {
      row.classList.remove('row-pending-highlight');
      row.dataset.status = 'active';

      badge.className = 'badge-status-lunas';
      badge.innerHTML = '<i class="ph ph-check"></i> Lunas Rp 150rb';

      if (switchAccess) switchAccess.checked = true;
      if (progText) progText.innerHTML = '<span class="green-text">Akses Terbuka (0%)</span>';

      btnVerify.style.display = 'none';

      // Update pending badge count
      if (pendingCount) {
        let count = parseInt(pendingCount.textContent, 10);
        if (count > 0) count -= 1;
        pendingCount.textContent = count;
      }

      playSuccessChime();
      showToast('Pembayaran diverifikasi! Akses kelas otomatis dibuka untuk santri.');
    }
  }

  // Admin Switch Toggle Handler
  function toggleSantriAccess(id) {
    playTone(620, 'sine', 0.08, 0.07);
    showToast(`Hak akses video santri #${id} diperbarui & dicatat ke sistem audit log`);
  }

  // Admin Beasiswa Handler
  function verifyBeasiswa(id) {
    const row = document.getElementById(`row-${id}`);
    const badge = document.getElementById(`statusBadge-${id}`);
    const btnVerify = document.getElementById(`btnVerify-${id}`);
    const switchAccess = document.getElementById(`switchAccess-${id}`);
    const progText = document.getElementById(`progText-${id}`);
    const pendingCount = document.getElementById(`pendingCount`);

    if (row && badge && btnVerify) {
      row.classList.remove('row-pending-highlight');
      row.dataset.status = 'active';

      badge.className = 'badge-status-lunas';
      badge.style.backgroundColor = 'var(--md-sys-color-primary-container)';
      badge.style.color = 'var(--md-sys-color-primary)';
      badge.innerHTML = '<i class="ph ph-check"></i> Beasiswa Resmi Umi Elly';

      if (switchAccess) switchAccess.checked = true;
      if (progText) progText.innerHTML = '<span class="green-text">Akses Gratis Berkah (0%)</span>';

      btnVerify.style.display = 'none';

      if (pendingCount) {
        let count = parseInt(pendingCount.textContent, 10);
        if (count > 0) count -= 1;
        pendingCount.textContent = count;
      }

      playSuccessChime();
      showToast('Alhamdulillah! Beasiswa santri dhuafa disetujui Umi Elly. Akses kelas otomatis dibuka gratis.');
    }
  }

  // Game Modal Logic
  const gameModal = document.getElementById('gameModal');
  const certModal = document.getElementById('certModal');
  const gameScoreDisplay = document.getElementById('gameScoreDisplay');
  const gameFeedbackBox = document.getElementById('gameFeedbackBox');
  const btnClaimGameXp = document.getElementById('btnClaimGameXp');
  const certStudentName = document.getElementById('certStudentName');

  function openGameModal() {
    if (gameModal) gameModal.classList.add('open');
    playTone(580, 'sine', 0.1, 0.08);
  }

  function closeGameModal() {
    if (gameModal) gameModal.classList.remove('open');
  }

  function answerGame(qIndex, isCorrect, btnEl) {
    const allBtns = document.querySelectorAll('.game-opt-btn');
    if (isCorrect) {
      btnEl.style.backgroundColor = 'var(--md-sys-color-primary-container)';
      btnEl.style.borderColor = 'var(--md-sys-color-primary)';
      btnEl.style.color = 'var(--md-sys-color-primary)';
      if (gameFeedbackBox) gameFeedbackBox.style.display = 'block';
      if (btnClaimGameXp) btnClaimGameXp.style.display = 'inline-flex';
      playSuccessChime();
      showToast('Mumtaz! Jawaban Benar! +50 XP siap diklaim!');
    } else {
      btnEl.style.backgroundColor = 'var(--md-sys-color-error-container)';
      btnEl.style.borderColor = 'var(--md-sys-color-error)';
      btnEl.style.color = 'var(--md-sys-color-error)';
      playTone(280, 'sawtooth', 0.18, 0.08);
      showToast('Afwan, kurang tepat! Coba ingat kembali kosakata fasilitas sekolah...');
    }
  }

  function claimGameXp() {
    if (gameScoreDisplay) gameScoreDisplay.innerHTML = '<strong>470 XP (Level 3 • Naik Rank 3 🏆)</strong>';
    playSuccessChime();
    showToast('Alhamdulillah! +50 XP berhasil dicatat ke profil santri.');
    setTimeout(() => {
      closeGameModal();
    }, 1200);
  }

  // Game Question Bank - jenjang mufrodat dasar sampai muhadatsah harian
  const gameQuestions = {
    1: {
      tag: 'Game 1: Mufrodat Dasar Sehari-hari',
      question: `"Manakah arti kosakata (mufrodat) yang tepat untuk kata: <span style='color: var(--md-sys-color-primary); font-size: 20px; font-family: Arial, sans-serif;'>'المَكْتَبَةُ' (Al-Maktabatu)</span>?"`,
      options: [
        'Laboratorium Komputer',
        'Perpustakaan Sekolah (Ruang Baca)',
        'Ruang Guru / Kantor',
        'Lapangan Olahraga'
      ],
      correctIndex: 1,
      feedbackTitle: 'Mumtaz! Jawaban Benar (+50 XP Bertambah)',
      feedbackDesc: "Kata 'المَكْتَبَةُ' (Al-Maktabatu) berarti Perpustakaan. Santri sudah menguasai mufrodat dasar tempat sehari-hari!"
    },
    2: {
      tag: 'Game 2: Percakapan Harian (Muhadatsah)',
      question: `"Temanmu menyapa kamu: <span style='color: var(--md-sys-color-primary); font-size: 20px; font-family: Arial, sans-serif;'>'كَيْفَ حَالُكَ؟' (Kaifa haaluka?)</span> — apa jawaban yang paling tepat?"`,
      options: [
        "مَعَ السَّلَامَةِ (Ma'as-salaamah) — selamat jalan",
        "الحَمْدُ لِلَّهِ، بِخَيْرٍ (Alhamdulillah, bikhairin) — baik, segala puji bagi Allah",
        "تُصْبِحُ عَلَى خَيْرٍ (Tushbihu 'ala khairin) — selamat malam",
        "إِلَى اللِّقَاءِ (Ilal-liqaa') — sampai jumpa"
      ],
      correctIndex: 1,
      feedbackTitle: 'Mumtaz! Jawaban Benar (+50 XP Bertambah)',
      feedbackDesc: "'كَيْفَ حَالُكَ؟' artinya 'Apa kabar?'. Jawaban yang paling sering dipakai sehari-hari adalah 'الحَمْدُ لِلَّهِ، بِخَيْرٍ'. Santri sudah bisa membalas sapaan harian!"
    },
    3: {
      tag: 'Game 3: Susun Kalimat Harian',
      question: `"Bagaimana cara mengatakan <strong>'Saya pergi ke sekolah'</strong> dalam Bahasa Arab? <span style='color: var(--md-sys-color-primary); font-size: 20px; font-family: Arial, sans-serif;'>(الجُمْلَةُ اليَوْمِيَّةُ)</span>"`,
      options: [
        'أَذْهَبُ إِلَى المَدْرَسَةِ (Adzhabu ilal-madrasati)',
        'أَذْهَبُ إِلَى السُّوقِ (Adzhabu ilas-suuqi) — pergi ke pasar',
        'آكُلُ فِي البَيْتِ (Aakulu fil-baiti) — makan di rumah',
        'أَقْرَأُ الكِتَابَ (Aqra-ul kitaaba) — membaca buku'
      ],
      correctIndex: 0,
      feedbackTitle: 'Mumtaz! Jawaban Benar (+50 XP Bertambah)',
      feedbackDesc: "'أَذْهَبُ' berarti 'saya pergi' dan 'المَدْرَسَةُ' berarti 'sekolah'. Santri sudah bisa merangkai kalimat harian sendiri - selangkah lagi menuju lancar ngobrol!"
    }
  };

  // Switch Game Level / Question
  function switchGameQuestion(level) {
    const data = gameQuestions[level];
    if (!data) return;

    // Sync level selector chips
    document.querySelectorAll('[id^="btnLevel"]').forEach((chip) => {
      chip.classList.toggle('active', chip.id === `btnLevel${level}`);
    });

    // Swap question copy
    const tagEl = document.getElementById('gameCategoryTag');
    const questionEl = document.getElementById('gameQuestionText');
    if (tagEl) tagEl.textContent = data.tag;
    if (questionEl) questionEl.innerHTML = data.question;

    // Rebuild answer options (text + correct-answer handler + reset styling)
    const optionBtns = document.querySelectorAll('#gameOptionsContainer .game-opt-btn');
    optionBtns.forEach((btn, idx) => {
      const isCorrect = idx === data.correctIndex;
      const label = data.options[idx] || '';
      const textEl = document.getElementById(`optText${idx}`);
      if (textEl) textEl.innerHTML = isCorrect ? `<strong>${label}</strong>` : label;

      btn.setAttribute('onclick', `DeckEngine.answerGame(${idx}, ${isCorrect}, this)`);

      btn.style.backgroundColor = '#FFFFFF';
      btn.style.borderColor = 'var(--md-sys-color-outline-variant)';
      btn.style.color = 'var(--md-sys-color-on-surface)';
    });

    // Reset feedback & claim button
    const feedbackBox = document.getElementById('gameFeedbackBox');
    const feedbackTitle = document.getElementById('gameFeedbackTitle');
    const feedbackDesc = document.getElementById('gameFeedbackDesc');
    const claimBtn = document.getElementById('btnClaimGameXp');
    if (feedbackTitle) feedbackTitle.textContent = data.feedbackTitle;
    if (feedbackDesc) feedbackDesc.textContent = data.feedbackDesc;
    if (feedbackBox) feedbackBox.style.display = 'none';
    if (claimBtn) claimBtn.style.display = 'none';

    playTone(600, 'triangle', 0.12, 0.07);
    showToast(`Tantangan dibuka: ${data.tag}`);
  }

  // Certificate Modal Logic
  function openCertModal(name = 'Ahmad Fauzan') {
    if (certStudentName) certStudentName.textContent = name;
    if (certModal) certModal.classList.add('open');
    playTone(620, 'sine', 0.12, 0.08);
  }

  function closeCertModal() {
    if (certModal) certModal.classList.remove('open');
  }

  // Public API
  return {
    init,
    goToSlide,
    nextSlide,
    prevSlide,
    verifySantri,
    verifyBeasiswa,
    toggleSantriAccess,
    openGameModal,
    closeGameModal,
    switchGameQuestion,
    answerGame,
    claimGameXp,
    openCertModal,
    closeCertModal,
    showToast
  };
})();

// Start on DOM Ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => DeckEngine.init());
} else {
  DeckEngine.init();
}
  
