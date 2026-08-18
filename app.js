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

  // DOM Elements
  const slides = document.querySelectorAll('.slide-card');
  const navSlideCurrent = document.getElementById('navSlideCurrent');
  const navSlideTotal = document.getElementById('navSlideTotal');
  const navSlideTitle = document.getElementById('navSlideTitle');
  const deckProgressFill = document.getElementById('deckProgressFill');
  const dockDotsStrip = document.getElementById('dockDotsStrip');
  const btnPrevSlide = document.getElementById('btnPrevSlide');
  const btnNextSlide = document.getElementById('btnNextSlide');
  const btnAudioToggle = document.getElementById('btnAudioToggle');
  const audioIcon = document.getElementById('audioIcon');
  const btnAutoplayToggle = document.getElementById('btnAutoplayToggle');
  const autoplayIcon = document.getElementById('autoplayIcon');
  const btnOverviewToggle = document.getElementById('btnOverviewToggle');
  const btnFullscreenToggle = document.getElementById('btnFullscreenToggle');
  const fullscreenIcon = document.getElementById('fullscreenIcon');
  const overviewModal = document.getElementById('overviewModal');
  const btnCloseOverview = document.getElementById('btnCloseOverview');
  const slideOverviewGrid = document.getElementById('slideOverviewGrid');
  const toastBox = document.getElementById('toastBox');
  const toastMessage = document.getElementById('toastMessage');

  // Initialize
  function init() {
    totalSlides = slides.length;
    if (navSlideTotal) navSlideTotal.textContent = String(totalSlides).padStart(2, '0');

    buildDockDots();
    buildOverviewGrid();
    bindEvents();
    bindMockupEvents();
    updateSlideView(1, false);
  }

  // Build Dots in Bottom Dock
  function buildDockDots() {
    if (!dockDotsStrip) return;
    dockDotsStrip.innerHTML = '';
    slides.forEach((slide, index) => {
      const slideNum = index + 1;
      const dot = document.createElement('div');
      dot.className = `dock-dot ${slideNum === 1 ? 'active' : ''}`;
      dot.title = `Slide ${slideNum}: ${slide.dataset.slideTitle || ''}`;
      dot.addEventListener('click', () => {
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
      thumb.className = `grid-slide-thumb ${slideNum === 1 ? 'current' : ''}`;
      thumb.dataset.slideIndex = slideNum;
      thumb.innerHTML = `
        <div class="thumb-num">Slide ${String(slideNum).padStart(2, '0')}</div>
        <div class="thumb-title">${title}</div>
      `;
      thumb.addEventListener('click', () => {
        goToSlide(slideNum);
        closeOverviewModal();
      });
      slideOverviewGrid.appendChild(thumb);
    });
  }

  // Update Slide UI
  function updateSlideView(newIndex, playSound = true) {
    if (newIndex < 1 || newIndex > totalSlides) return;

    slides.forEach((slide, idx) => {
      const slideNum = idx + 1;
      if (slideNum === newIndex) {
        slide.classList.add('active');
        slide.classList.remove('prev-out');
      } else if (slideNum < newIndex) {
        slide.classList.remove('active');
        slide.classList.add('prev-out');
      } else {
        slide.classList.remove('active');
        slide.classList.remove('prev-out');
      }
    });

    currentSlide = newIndex;

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

    // Sound
    if (playSound) {
      playSlideChime();
    }
  }

  // Navigation Methods
  function nextSlide() {
    if (currentSlide < totalSlides) {
      goToSlide(currentSlide + 1);
    } else {
      goToSlide(1); // loop back
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
    // Buttons
    if (btnPrevSlide) btnPrevSlide.addEventListener('click', prevSlide);
    if (btnNextSlide) btnNextSlide.addEventListener('click', nextSlide);

    const btnStartDeck = document.getElementById('btnStartDeck');
    if (btnStartDeck) btnStartDeck.addEventListener('click', nextSlide);

    // Audio Toggle
    if (btnAudioToggle) {
      btnAudioToggle.addEventListener('click', () => {
        isAudioEnabled = !isAudioEnabled;
        if (audioIcon) {
          audioIcon.className = isAudioEnabled ? 'ph ph-speaker-high' : 'ph ph-speaker-slash';
        }
        const tooltip = btnAudioToggle.querySelector('.btn-tooltip');
        if (tooltip) tooltip.textContent = isAudioEnabled ? 'Sound: ON' : 'Sound: OFF';
        showToast(isAudioEnabled ? 'Suara efek diaktifkan' : 'Suara efek dinonaktifkan');
        if (isAudioEnabled) playTone(600, 'sine', 0.15, 0.1);
      });
    }

    // Autoplay Toggle
    if (btnAutoplayToggle) {
      btnAutoplayToggle.addEventListener('click', toggleAutoplay);
    }

    // Overview Modal
    if (btnOverviewToggle) {
      btnOverviewToggle.addEventListener('click', toggleOverviewModal);
    }
    if (btnCloseOverview) {
      btnCloseOverview.addEventListener('click', closeOverviewModal);
    }
    if (overviewModal) {
      overviewModal.addEventListener('click', (e) => {
        if (e.target === overviewModal) closeOverviewModal();
      });
    }

    // Fullscreen Toggle
    if (btnFullscreenToggle) {
      btnFullscreenToggle.addEventListener('click', toggleFullscreen);
    }

    // Keyboard Shortcuts
    window.addEventListener('keydown', (e) => {
      // Don't trigger if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case ' ':
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
          // Direct number jumping
          if (e.key >= '1' && e.key <= '9') {
            const num = parseInt(e.key, 10);
            if (num <= totalSlides) goToSlide(num);
          }
          break;
      }
    });

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
        handleSwipe(touchStartX, touchStartY, touchEndX, touchEndY);
      }, { passive: true });
    }
  }

  function handleSwipe(x1, y1, x2, y2) {
    const diffX = x2 - x1;
    const diffY = y2 - y1;
    const minDistance = 50;

    if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > minDistance) {
      if (diffX < 0) {
        nextSlide(); // Swipe Left -> Next
      } else {
        prevSlide(); // Swipe Right -> Prev
      }
    }
  }

  // Fullscreen API
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => {
        if (fullscreenIcon) fullscreenIcon.className = 'ph ph-corners-in';
        showToast('Mode Layar Penuh Aktif');
      }).catch(err => {
        console.warn('Fullscreen error:', err);
      });
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
      showToast(`Autoplay Aktif (Pindah setiap ${autoplayIntervalSeconds} detik)`);
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
    }, 3000);
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
          btnMarkComplete.style.background = 'var(--accent-emerald)';
          btnMarkComplete.style.color = '#000';
          if (totalProgressText) totalProgressText.textContent = '75% Tuntas';
          if (sidebarProgressFill) sidebarProgressFill.style.width = '75%';
          playSuccessChime();
          showToast('Alhamdulillah! Progres santri bertambah menjadi 75%');
        } else {
          if (markDoneIcon) markDoneIcon.className = 'ph ph-check-circle';
          if (markDoneText) markDoneText.textContent = 'Tandai Selesai';
          btnMarkComplete.style.background = '';
          btnMarkComplete.style.color = '';
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

  // Public API
  return {
    init,
    goToSlide,
    nextSlide,
    prevSlide,
    verifySantri,
    verifyBeasiswa,
    toggleSantriAccess,
    showToast
  };
})();

// Start on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  DeckEngine.init();
});
