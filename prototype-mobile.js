/* ==========================================================================
   PERISA AZHARIYAH — NATIVE MOBILE / PWA RUNTIME
   Dimuat SETELAH prototype.js. Seluruh perilaku di berkas ini hanya aktif
   pada viewport <= 768px sehingga pengalaman desktop tidak berubah.

   Isi:
     1. Utilitas (deteksi mobile, haptik, kunci gulir)
     2. Service worker + pembaruan aplikasi
     3. Prompt pemasangan (Add to Home Screen)
     4. Status jaringan
     5. Boot splash
     6. App bar kolaps + judul besar per layar
     7. Tab bar bawah
     8. Pull-to-refresh (tersambung ke API yayasan)
     9. Drawer: geser tepi, geser tutup, tombol kembali
    10. Bottom sheet: seret untuk menutup
    11. Integrasi dengan PrototypeApp
   ========================================================================== */

(function () {
  'use strict';

  var MOBILE_QUERY = window.matchMedia('(max-width: 768px)');
  var body = document.body;

  function isMobile() { return MOBILE_QUERY.matches; }

  /* ======================================================================
     1. UTILITAS
     ====================================================================== */

  // Peramban memblokir Vibration API sebelum pengguna menyentuh halaman,
  // jadi getaran baru diaktifkan setelah interaksi pertama.
  // Hanya gestur asli (isTrusted) yang membuka izin bergetar; event sintetis
  // dari alat uji tetap ditolak peramban dan akan mengotori konsol.
  var userEngaged = false;
  ['pointerdown', 'touchstart', 'keydown'].forEach(function (evt) {
    window.addEventListener(evt, function (e) {
      if (e && e.isTrusted) userEngaged = true;
    }, { passive: true });
  });

  /** Getaran halus sebagai umpan balik sentuh (diabaikan bila tak didukung). */
  function haptic(pattern) {
    if (!userEngaged) return;
    try {
      if (navigator.vibrate) navigator.vibrate(pattern || 8);
    } catch (_) { /* perangkat tanpa vibration API */ }
  }

  var lockedScrollY = 0;

  function lockScroll() {
    if (body.classList.contains('m-locked')) return;
    lockedScrollY = window.scrollY || window.pageYOffset || 0;
    body.style.top = '-' + lockedScrollY + 'px';
    body.classList.add('m-locked');
  }

  function unlockScroll() {
    if (!body.classList.contains('m-locked')) return;
    body.classList.remove('m-locked');
    body.style.top = '';
    window.scrollTo(0, lockedScrollY);
  }

  /** Sembunyikan toast yang terlanjur dimunculkan oleh aksi non-penting. */
  function muteToast() {
    var t = document.getElementById('prototypeToast');
    if (t) t.classList.remove('show');
  }

  function $(id) { return document.getElementById(id); }


  /* ======================================================================
     2. SERVICE WORKER + PEMBARUAN APLIKASI
     ====================================================================== */
  var swRegistration = null;

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol === 'file:') return; // butuh http(s)

    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js', { scope: '/' })
        .then(function (reg) {
          swRegistration = reg;

          // Versi baru terdeteksi -> tawarkan muat ulang.
          reg.addEventListener('updatefound', function () {
            var incoming = reg.installing;
            if (!incoming) return;
            incoming.addEventListener('statechange', function () {
              if (incoming.state === 'installed' && navigator.serviceWorker.controller) {
                showAppToast('Pembaruan aplikasi tersedia. Ketuk untuk memuat ulang.', function () {
                  incoming.postMessage({ type: 'SKIP_WAITING' });
                });
              }
            });
          });
        })
        .catch(function () { /* pendaftaran gagal: aplikasi tetap jalan online */ });

      var reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', function () {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    });
  }

  /** Toast ringan milik lapisan mobile (opsional bisa diketuk). */
  var appToastTimer = null;
  function showAppToast(message, onTap) {
    var el = $('prototypeToast');
    if (!el) return;
    el.textContent = message;
    el.classList.add('show');
    el.onclick = onTap ? function () { el.classList.remove('show'); onTap(); } : null;
    clearTimeout(appToastTimer);
    appToastTimer = setTimeout(function () { el.classList.remove('show'); }, onTap ? 7000 : 3200);
  }


  /* ======================================================================
     3. PROMPT PEMASANGAN (ADD TO HOME SCREEN)
     ====================================================================== */
  var deferredInstall = null;
  var INSTALL_DISMISS_KEY = 'perisa.install.dismissed';

  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.matchMedia('(display-mode: minimal-ui)').matches ||
           window.navigator.standalone === true;
  }

  function initInstallPrompt() {
    if (isStandalone()) {
      body.classList.add('m-standalone');
      return;
    }

    window.addEventListener('beforeinstallprompt', function (e) {
      e.preventDefault();
      deferredInstall = e;
      var dismissed = false;
      try { dismissed = localStorage.getItem(INSTALL_DISMISS_KEY) === '1'; } catch (_) {}
      if (!dismissed && isMobile()) {
        setTimeout(function () {
          var card = $('mInstallCard');
          if (card) card.classList.add('show');
        }, 2600);
      }
    });

    window.addEventListener('appinstalled', function () {
      var card = $('mInstallCard');
      if (card) card.classList.remove('show');
      deferredInstall = null;
      body.classList.add('m-standalone');
      showAppToast('PERISA berhasil dipasang di layar utama perangkat.');
      haptic([12, 40, 12]);
    });
  }

  function triggerInstall() {
    var card = $('mInstallCard');
    haptic(12);

    if (deferredInstall) {
      deferredInstall.prompt();
      deferredInstall.userChoice.then(function (choice) {
        if (choice && choice.outcome === 'accepted') {
          showAppToast('Memasang aplikasi PERISA...');
        }
        deferredInstall = null;
        if (card) card.classList.remove('show');
      });
      return;
    }

    // iOS Safari tidak menyediakan beforeinstallprompt -> beri panduan manual.
    var isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
    showAppToast(isIos
      ? 'Ketuk tombol Bagikan di Safari, lalu pilih "Tambahkan ke Layar Utama".'
      : 'Buka menu peramban, lalu pilih "Pasang aplikasi" / "Tambahkan ke layar utama".');
    if (card) card.classList.remove('show');
  }

  function dismissInstall() {
    var card = $('mInstallCard');
    if (card) card.classList.remove('show');
    try { localStorage.setItem(INSTALL_DISMISS_KEY, '1'); } catch (_) {}
    haptic(6);
  }


  /* ======================================================================
     4. STATUS JARINGAN
     ====================================================================== */
  var netTimer = null;

  function showNetBanner(online) {
    var el = $('mNetBanner');
    if (!el) return;
    el.classList.toggle('is-online', online);
    el.innerHTML = online
      ? '<i class="ph ph-wifi-high"></i> Sambungan pulih'
      : '<i class="ph ph-wifi-slash"></i> Mode luring — materi tersimpan tetap terbuka';
    el.classList.add('show');
    clearTimeout(netTimer);
    netTimer = setTimeout(function () { el.classList.remove('show'); }, online ? 2200 : 4200);
  }

  function initNetworkWatcher() {
    window.addEventListener('online', function () { showNetBanner(true); haptic(8); });
    window.addEventListener('offline', function () { showNetBanner(false); haptic([10, 30, 10]); });
    if (!navigator.onLine) setTimeout(function () { showNetBanner(false); }, 1400);
  }


  /* ======================================================================
     5. BOOT SPLASH
     ====================================================================== */
  function initSplash() {
    var splash = $('mAppSplash');
    if (!splash) return;

    if (!isMobile()) {
      splash.remove();
      return;
    }

    var hide = function () {
      splash.classList.add('is-hidden');
      setTimeout(function () {
        if (splash.parentNode) splash.parentNode.removeChild(splash);
      }, 600);
    };

    // Minimal 700ms agar transisi terasa disengaja, bukan kedipan.
    var started = Date.now();
    var finish = function () {
      var elapsed = Date.now() - started;
      setTimeout(hide, Math.max(0, 700 - elapsed));
    };

    if (document.readyState === 'complete') finish();
    else window.addEventListener('load', finish);

    // Jaring pengaman bila event load tertahan aset pihak ketiga.
    setTimeout(hide, 3800);
  }


  /* ======================================================================
     6. APP BAR KOLAPS + JUDUL BESAR PER LAYAR
     ====================================================================== */
  // Aksi cepat pada baris chip disesuaikan dengan layar yang sedang dibuka.
  var CHIPS = {
    lanjut:   { icon: 'ph-play-circle',  label: 'Lanjut Belajar', act: "PrototypeApp.switchMainView('kurikulum')" },
    suara:    { icon: 'ph-microphone',   label: 'Latihan Suara',  href: 'game2d.html' },
    asisten:  { icon: 'ph-sparkle',      label: 'Tanya Asisten',  act: "PrototypeApp.switchMainView('ai-assistant')" },
    silabus:  { icon: 'ph-book-open',    label: 'Buka Silabus',   act: "PrototypeApp.openDocReader(1)" },
    evaluasi: { icon: 'ph-check-circle', label: 'Latihan Evaluasi', act: "PrototypeApp.switchSubTab('kuis')" },
    mufrodat: { icon: 'ph-speaker-high', label: 'Pelafalan Mufrodat', act: "PrototypeApp.switchSubTab('audio')" },
    piagam:   { icon: 'ph-certificate',  label: 'Piagam Sanad',   act: 'PrototypeApp.openCertificate()', gold: true },
    arsip:    { icon: 'ph-files',        label: 'Semua Dokumen',  act: "PrototypeApp.switchMainView('modul-pdf')" },
    sinkron:  { icon: 'ph-arrows-clockwise', label: 'Segarkan Data', act: 'PerisaMobile.refresh()' },
    santri:   { icon: 'ph-users-three',  label: 'Daftar Santri',  act: "PrototypeApp.switchMainView('admin')" }
  };

  var VIEW_META = {
    'beranda': {
      eyebrow: 'Portal Santri',
      title: 'Ahlan wa Sahlan!',
      sub: 'Lanjutkan pembelajaran Bahasa Arab terstruktur asuhan Umi Elly.',
      bar: 'Beranda',
      chips: ['lanjut', 'suara', 'asisten', 'piagam']
    },
    'kurikulum': {
      eyebrow: 'Kurikulum Bahasa Arab',
      title: 'Kaidah Jumlah Ismiyyah',
      sub: 'Jenjang SMP Kelas 8 • 12 Modul • Asuhan Umi Elly',
      bar: 'Kurikulum',
      chips: ['evaluasi', 'mufrodat', 'silabus', 'suara']
    },
    'modul-pdf': {
      eyebrow: 'Perpustakaan Digital',
      title: 'Modul & Silabus',
      sub: 'Dokumen resmi terverifikasi Yayasan Peradaban Islam Azhariyah.',
      bar: 'Silabus',
      chips: ['silabus', 'lanjut', 'asisten', 'piagam']
    },
    'ai-assistant': {
      eyebrow: 'Asisten Pembelajaran',
      title: 'Asisten Bahasa Arab',
      sub: 'Konsultasi kaidah Nahwu-Shorof, mufrodat, dan susunan kalimat.',
      bar: 'Asisten',
      chips: ['mufrodat', 'suara', 'lanjut', 'arsip']
    },
    'admin': {
      eyebrow: 'Otoritas Yayasan',
      title: 'Panel Pengurus',
      sub: 'Tata kelola santri, verifikasi infaq, dan sertifikat sanad.',
      bar: 'Pengurus',
      chips: ['santri', 'sinkron', 'piagam', 'arsip']
    }
  };

  var currentView = 'kurikulum';

  function paintLargeTitle(viewKey) {
    var meta = VIEW_META[viewKey] || VIEW_META.kurikulum;
    var eyebrow = $('mLtEyebrow');
    var title = $('mLtTitle');
    var sub = $('mLtSub');
    var bar = $('mAppbarTitle');

    if (eyebrow) eyebrow.innerHTML = '<i class="ph ph-circle-wavy-check"></i> ' + meta.eyebrow;
    if (title) title.textContent = meta.title;
    if (sub) sub.textContent = meta.sub;
    if (bar) bar.textContent = meta.bar;

    var row = $('mChipRow');
    if (row && meta.chips) {
      row.innerHTML = meta.chips.map(function (key) {
        var c = CHIPS[key];
        if (!c) return '';
        var cls = 'm-chip' + (c.gold ? ' is-gold' : '');
        var body = '<i class="ph ' + c.icon + '"></i> ' + c.label;
        return c.href
          ? '<a class="' + cls + '" href="' + c.href + '">' + body + '</a>'
          : '<span class="' + cls + '" onclick="' + c.act + '">' + body + '</span>';
      }).join('');
      row.scrollLeft = 0;
    }
  }

  /** Sinkronkan judul besar Beranda dengan nama santri yang sedang aktif. */
  function syncGreeting() {
    var nameEl = $('sidebarUserName');
    if (!nameEl) return;
    var first = (nameEl.textContent || '').trim().split(' ')[0] || 'Santri';
    VIEW_META.beranda.title = 'Ahlan wa Sahlan, ' + first + '!';
    if (currentView === 'beranda') paintLargeTitle('beranda');
  }

  var lastScrollY = 0;
  var scrollTicking = false;

  function onScroll() {
    if (scrollTicking) return;
    scrollTicking = true;

    requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset || 0;

      // Kolapskan judul besar ke dalam app bar.
      body.classList.toggle('m-scrolled', y > 52);

      // Sembunyikan tab bar saat menggulir turun cepat, tampilkan saat naik.
      var delta = y - lastScrollY;
      if (y > 140 && delta > 8) {
        body.classList.add('m-tabbar-hidden');
      } else if (delta < -6 || y < 90) {
        body.classList.remove('m-tabbar-hidden');
      }

      lastScrollY = y;
      scrollTicking = false;
    });
  }


  /* ======================================================================
     7. TAB BAR BAWAH
     ====================================================================== */
  function syncTabBar(viewKey) {
    var items = document.querySelectorAll('.bottom-nav-item');
    for (var i = 0; i < items.length; i++) items[i].classList.remove('active');
    var target = $('bnav-' + viewKey);
    if (target) target.classList.add('active');
  }

  function syncDrawerNav(viewKey) {
    var links = document.querySelectorAll('.mobile-drawer-menu .ref-nav-item[data-view]');
    for (var i = 0; i < links.length; i++) {
      links[i].classList.toggle('active', links[i].getAttribute('data-view') === viewKey);
    }
  }


  /* ======================================================================
     8. PULL-TO-REFRESH
     ====================================================================== */
  var PTR_TRIGGER = 74;
  var PTR_MAX = 118;
  var ptrStartY = 0;
  var ptrPulling = false;
  var ptrRefreshing = false;

  function ptrEl() { return $('mPullRefresh'); }

  function ptrSet(distance) {
    var el = ptrEl();
    if (!el) return;
    var progress = Math.min(1, distance / PTR_TRIGGER);
    el.style.opacity = String(Math.min(1, progress * 1.35));
    el.style.transform = 'translateY(' + (Math.min(distance, PTR_MAX) * 0.62 - 46) +
                         'px) scale(' + (0.6 + progress * 0.4) + ') rotate(' + (progress * 240) + 'deg)';
    el.classList.toggle('is-armed', distance >= PTR_TRIGGER);
  }

  function ptrReset() {
    var el = ptrEl();
    if (!el) return;
    el.style.transition = 'opacity 0.24s linear, transform 0.36s cubic-bezier(0.16,1,0.3,1)';
    el.style.opacity = '0';
    el.style.transform = 'translateY(-52px) scale(0.6)';
    el.classList.remove('is-armed', 'is-refreshing');
    setTimeout(function () { if (el) el.style.transition = ''; }, 380);
  }

  /** Segarkan data ringkas santri dari API yayasan (server.js). */
  function runRefresh() {
    if (ptrRefreshing) return;
    ptrRefreshing = true;

    var el = ptrEl();
    if (el) {
      el.classList.add('is-refreshing');
      el.style.transition = 'transform 0.3s cubic-bezier(0.16,1,0.3,1)';
      el.style.opacity = '1';
      el.style.transform = 'translateY(0) scale(1)';
    }
    haptic([8, 26, 8]);

    var done = function (message) {
      ptrRefreshing = false;
      ptrReset();
      showAppToast(message);
    };

    var timeout = setTimeout(function () {
      if (ptrRefreshing) done('Data lokal ditampilkan — jaringan lambat merespons.');
    }, 6000);

    fetch('api/game/leaderboard', { cache: 'no-store' })
      .then(function (r) { return r.json(); })
      .then(function (payload) {
        clearTimeout(timeout);
        var rows = (payload && payload.data) || [];
        var nameEl = $('sidebarUserName');
        var myName = nameEl ? (nameEl.textContent || '').trim() : '';
        var me = null;
        for (var i = 0; i < rows.length; i++) {
          if (rows[i].name === myName) { me = rows[i]; break; }
        }

        var xpEl = $('mXpMetric');
        var rankEl = $('mRankMetric');
        if (me && xpEl) xpEl.textContent = me.xp.toLocaleString('id-ID') + ' XP';
        if (me && rankEl) rankEl.textContent = 'Peringkat ke-' + me.rank + ' • Streak ' + me.streak + ' hari';

        done(me
          ? 'Data tersinkron: ' + me.xp + ' XP, peringkat ke-' + me.rank + '.'
          : 'Data santri berhasil disegarkan dari server yayasan.');
      })
      .catch(function () {
        clearTimeout(timeout);
        done(navigator.onLine
          ? 'Server yayasan belum merespons. Menampilkan data tersimpan.'
          : 'Mode luring — menampilkan materi yang tersimpan di perangkat.');
      });
  }

  function initPullToRefresh() {
    document.addEventListener('touchstart', function (e) {
      if (!isMobile() || ptrRefreshing) return;
      if (body.classList.contains('m-locked')) return;
      if ((window.scrollY || window.pageYOffset || 0) > 2) return;
      if (e.touches.length !== 1) return;
      ptrStartY = e.touches[0].clientY;
      ptrPulling = true;
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!ptrPulling || ptrRefreshing) return;
      var distance = e.touches[0].clientY - ptrStartY;
      if (distance <= 0) { ptrSet(0); return; }
      if ((window.scrollY || window.pageYOffset || 0) > 2) { ptrPulling = false; ptrReset(); return; }
      ptrSet(distance);
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
      if (!ptrPulling) return;
      ptrPulling = false;
      var endY = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientY : ptrStartY;
      if (endY - ptrStartY >= PTR_TRIGGER && !ptrRefreshing) runRefresh();
      else ptrReset();
    }, { passive: true });

    document.addEventListener('touchcancel', function () {
      ptrPulling = false;
      if (!ptrRefreshing) ptrReset();
    }, { passive: true });
  }


  /* ======================================================================
     9. DRAWER: GESER TEPI, GESER TUTUP, TOMBOL KEMBALI
     ====================================================================== */
  function drawerEl() { return $('mobileDrawerOverlay'); }
  function drawerPanel() {
    var d = drawerEl();
    return d ? d.querySelector('.mobile-drawer-menu') : null;
  }
  function isDrawerOpen() {
    var d = drawerEl();
    return !!(d && d.classList.contains('open'));
  }

  function setDrawer(open) {
    var d = drawerEl();
    if (!d) return;
    d.classList.toggle('open', open);
    if (open) { lockScroll(); pushOverlayState('drawer'); }
    else { unlockScroll(); popOverlayState('drawer'); }
  }

  /* --- Riwayat: tombol "kembali" perangkat menutup lapisan teratas ------ */
  var overlayStack = [];

  function pushOverlayState(name) {
    if (overlayStack.indexOf(name) !== -1) return;
    overlayStack.push(name);
    try { history.pushState({ perisaOverlay: name }, ''); } catch (_) {}
  }

  function popOverlayState(name) {
    var idx = overlayStack.indexOf(name);
    if (idx === -1) return;
    overlayStack.splice(idx, 1);
    // Bila state ini masih di riwayat, mundurkan satu langkah tanpa memicu penutupan ganda.
    if (history.state && history.state.perisaOverlay === name) {
      suppressPop = true;
      history.back();
    }
  }

  var suppressPop = false;

  function initHistoryOverlays() {
    window.addEventListener('popstate', function () {
      if (suppressPop) { suppressPop = false; return; }
      if (!overlayStack.length) return;
      var top = overlayStack[overlayStack.length - 1];
      overlayStack.pop();

      if (top === 'drawer') {
        var d = drawerEl();
        if (d) d.classList.remove('open');
        unlockScroll();
      } else if (top === 'sheet-cert') {
        closeSheet($('certModal'));
      } else if (top === 'sheet-doc') {
        closeSheet($('docReaderModal'));
      }
      haptic(6);
    });
  }

  function initDrawerGestures() {
    var EDGE = 26;
    var startX = 0, startY = 0, tracking = false, decided = false, horizontal = false;

    document.addEventListener('touchstart', function (e) {
      if (!isMobile() || e.touches.length !== 1) return;
      var t = e.touches[0];

      if (!isDrawerOpen() && t.clientX <= EDGE) {
        // Geser dari tepi kiri untuk membuka.
        startX = t.clientX; startY = t.clientY;
        tracking = true; decided = false; horizontal = false;
      } else if (isDrawerOpen()) {
        // Geser ke kiri untuk menutup.
        startX = t.clientX; startY = t.clientY;
        tracking = true; decided = false; horizontal = false;
      }
    }, { passive: true });

    document.addEventListener('touchmove', function (e) {
      if (!tracking || e.touches.length !== 1) return;
      var t = e.touches[0];
      var dx = t.clientX - startX;
      var dy = t.clientY - startY;

      if (!decided) {
        if (Math.abs(dx) < 9 && Math.abs(dy) < 9) return;
        horizontal = Math.abs(dx) > Math.abs(dy) * 1.25;
        decided = true;
        if (!horizontal) { tracking = false; return; }
      }

      var panel = drawerPanel();
      if (!panel) return;
      panel.style.transition = 'none';

      if (!isDrawerOpen()) {
        var openPct = Math.min(0, -100 + (dx / panel.offsetWidth) * 100);
        panel.style.transform = 'translateX(' + openPct + '%)';
        var overlay = drawerEl();
        if (overlay && dx > 12) {
          overlay.style.opacity = String(Math.min(1, dx / panel.offsetWidth));
          overlay.style.visibility = 'visible';
          overlay.style.pointerEvents = 'auto';
        }
      } else if (dx < 0) {
        panel.style.transform = 'translateX(' + Math.max(-100, (dx / panel.offsetWidth) * 100) + '%)';
      }
    }, { passive: true });

    var endGesture = function (e) {
      if (!tracking) return;
      tracking = false;
      if (!horizontal) return;

      var panel = drawerPanel();
      var overlay = drawerEl();
      if (!panel || !overlay) return;

      var endX = (e.changedTouches && e.changedTouches[0]) ? e.changedTouches[0].clientX : startX;
      var dx = endX - startX;

      panel.style.transition = '';
      panel.style.transform = '';
      overlay.style.opacity = '';
      overlay.style.visibility = '';
      overlay.style.pointerEvents = '';

      if (!isDrawerOpen() && dx > panel.offsetWidth * 0.32) {
        setDrawer(true); haptic(10);
      } else if (isDrawerOpen() && dx < -panel.offsetWidth * 0.28) {
        setDrawer(false); haptic(8);
      }
    };

    document.addEventListener('touchend', endGesture, { passive: true });
    document.addEventListener('touchcancel', function () {
      if (!tracking) return;
      tracking = false;
      var panel = drawerPanel();
      var overlay = drawerEl();
      if (panel) { panel.style.transition = ''; panel.style.transform = ''; }
      if (overlay) { overlay.style.opacity = ''; overlay.style.visibility = ''; overlay.style.pointerEvents = ''; }
    }, { passive: true });
  }


  /* ======================================================================
     10. BOTTOM SHEET: SERET UNTUK MENUTUP
     ====================================================================== */
  function openSheet(overlay, stateName) {
    if (!overlay) return;
    overlay.style.display = '';          // buang inline display:none bawaan markup
    // Paksa satu frame agar transisi transform benar-benar berjalan.
    void overlay.offsetHeight;
    overlay.classList.add('open');
    lockScroll();
    pushOverlayState(stateName);
    haptic(9);
  }

  function closeSheet(overlay) {
    if (!overlay) return;
    overlay.classList.remove('open');
    unlockScroll();
    var boxEl = overlay.querySelector('.modal-box, .pdf-reader-modal-box');
    if (boxEl) { boxEl.style.transition = ''; boxEl.style.transform = ''; }
  }

  function initSheetGestures(overlay, stateName) {
    if (!overlay) return;
    var box = overlay.querySelector('.modal-box, .pdf-reader-modal-box');
    var grip = overlay.querySelector('.m-sheet-grip');
    if (!box || !grip) return;

    var startY = 0, currentY = 0, dragging = false, startedAt = 0;

    grip.addEventListener('touchstart', function (e) {
      if (e.touches.length !== 1) return;
      dragging = true;
      startY = e.touches[0].clientY;
      currentY = startY;
      startedAt = Date.now();
      box.style.transition = 'none';
    }, { passive: true });

    grip.addEventListener('touchmove', function (e) {
      if (!dragging) return;
      currentY = e.touches[0].clientY;
      var dy = Math.max(0, currentY - startY);
      box.style.transform = 'translateY(' + dy + 'px)';
      overlay.style.opacity = String(Math.max(0.25, 1 - dy / 420));
    }, { passive: true });

    var release = function () {
      if (!dragging) return;
      dragging = false;
      var dy = Math.max(0, currentY - startY);
      var velocity = dy / Math.max(1, Date.now() - startedAt);

      box.style.transition = '';
      overlay.style.opacity = '';

      if (dy > 118 || velocity > 0.62) {
        box.style.transform = '';
        closeSheet(overlay);
        popOverlayState(stateName);
        haptic(8);
      } else {
        box.style.transform = '';
      }
    };

    grip.addEventListener('touchend', release, { passive: true });
    grip.addEventListener('touchcancel', release, { passive: true });

    // Ketuk area gelap di luar sheet untuk menutup.
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) {
        closeSheet(overlay);
        popOverlayState(stateName);
      }
    });
  }


  /* ======================================================================
     11. INTEGRASI DENGAN PrototypeApp
     ====================================================================== */
  function integrate() {
    if (typeof PrototypeApp === 'undefined') return;

    /* --- switchMainView: judul besar, tab bar, animasi masuk ----------- */
    var baseSwitch = PrototypeApp.switchMainView;
    PrototypeApp.switchMainView = function (viewName) {
      var key = viewName || 'kurikulum';
      baseSwitch.apply(null, arguments);
      currentView = key;

      if (isMobile()) {
        paintLargeTitle(key);
        syncTabBar(key);
        syncDrawerNav(key);
        body.classList.toggle('m-view-ai', key === 'ai-assistant');
        body.classList.remove('m-tabbar-hidden');

        var viewEl = document.querySelector(
          '#viewBerandaUtama, #viewCoursePlayer, #viewModulPdf, #viewAiAssistant, #viewAdminPanel'
        );
        var visible = [
          $('viewBerandaUtama'), $('viewCoursePlayer'), $('viewModulPdf'),
          $('viewAiAssistant'), $('viewAdminPanel')
        ].filter(function (el) { return el && el.style.display !== 'none'; })[0] || viewEl;

        if (visible) {
          visible.classList.remove('m-view-enter');
          void visible.offsetWidth;
          visible.classList.add('m-view-enter');
          // Lepas kembali setelah animasi selesai: kelas yang menempel akan
          // menyisakan transform dan merusak posisi elemen fixed di dalamnya.
          visible.addEventListener('animationend', function handler() {
            visible.classList.remove('m-view-enter');
            visible.removeEventListener('animationend', handler);
          });
        }

        window.scrollTo({ top: 0, behavior: 'auto' });
        lastScrollY = 0;
        body.classList.remove('m-scrolled');
        haptic(8);
      }

      try { history.replaceState(history.state, '', '?view=' + key); } catch (_) {}
    };

    /* --- setRole: perbarui identitas di drawer + sapaan ---------------- */
    var baseSetRole = PrototypeApp.setRole;
    PrototypeApp.setRole = function (roleName) {
      baseSetRole.apply(null, arguments);
      if (!isMobile()) return;

      var nameEl = $('sidebarUserName');
      var subEl = $('sidebarUserSub');
      var avatarEl = $('sidebarUserAvatar');

      var dName = $('mDrawerUserName');
      var dSub = $('mDrawerUserSub');
      var dAvatar = $('mDrawerAvatar');
      var topAvatar = $('mobileUserAvatarTag');

      if (dName && nameEl) dName.textContent = nameEl.textContent;
      if (dSub && subEl) dSub.textContent = subEl.textContent;
      if (dAvatar && avatarEl) dAvatar.textContent = avatarEl.textContent;
      if (topAvatar && avatarEl) topAvatar.textContent = avatarEl.textContent;

      var roleBtns = document.querySelectorAll('.mobile-drawer-menu .role-btn[data-role]');
      for (var i = 0; i < roleBtns.length; i++) {
        roleBtns[i].classList.toggle('active', roleBtns[i].getAttribute('data-role') === roleName);
      }

      currentView = (roleName === 'admin') ? 'admin' : 'kurikulum';
      body.classList.remove('m-view-ai');
      paintLargeTitle(currentView);
      syncTabBar(currentView);
      syncDrawerNav(currentView);
      syncGreeting();
      window.scrollTo({ top: 0, behavior: 'auto' });
      lastScrollY = 0;
      body.classList.remove('m-scrolled', 'm-tabbar-hidden');
      haptic(10);
    };

    /* --- toggleMobileDrawer: kunci gulir + riwayat --------------------- */
    PrototypeApp.toggleMobileDrawer = function () {
      setDrawer(!isDrawerOpen());
      haptic(8);
    };

    /* --- switchSubTab: tanpa toast berisik di mobile ------------------- */
    var baseSubTab = PrototypeApp.switchSubTab;
    PrototypeApp.switchSubTab = function (tabName) {
      baseSubTab.apply(null, arguments);
      if (!isMobile()) return;
      muteToast();
      haptic(6);

      // Geser tab aktif ke tengah segmented control.
      var btn = document.querySelector('.sub-tab-btn[data-subtab="' + tabName + '"]');
      var bar = document.querySelector('.ref-sub-tabs-bar');
      if (btn && bar && bar.scrollWidth > bar.clientWidth) {
        bar.scrollTo({
          left: btn.offsetLeft - (bar.clientWidth - btn.offsetWidth) / 2,
          behavior: 'smooth'
        });
      }
    };

    /* --- Sheet: sertifikat & pembaca dokumen --------------------------- */
    var baseOpenCert = PrototypeApp.openCertificate;
    PrototypeApp.openCertificate = function () {
      baseOpenCert.apply(null, arguments);
      if (isMobile()) openSheet($('certModal'), 'sheet-cert');
      else { var m = $('certModal'); if (m) m.style.display = 'flex'; }
    };
    PrototypeApp.openCertModal = PrototypeApp.openCertificate;

    var baseCloseCert = PrototypeApp.closeCertModal;
    PrototypeApp.closeCertModal = function () {
      baseCloseCert.apply(null, arguments);
      var m = $('certModal');
      if (isMobile()) { closeSheet(m); popOverlayState('sheet-cert'); }
      else if (m) m.style.display = 'none';
    };

    var baseOpenDoc = PrototypeApp.openDocReader;
    PrototypeApp.openDocReader = function () {
      baseOpenDoc.apply(null, arguments);
      if (isMobile()) openSheet($('docReaderModal'), 'sheet-doc');
      else { var m = $('docReaderModal'); if (m) m.style.display = 'flex'; }
    };

    var baseCloseDoc = PrototypeApp.closeDocReader;
    PrototypeApp.closeDocReader = function () {
      baseCloseDoc.apply(null, arguments);
      var m = $('docReaderModal');
      if (isMobile()) { closeSheet(m); popOverlayState('sheet-doc'); }
      else if (m) m.style.display = 'none';
    };

    /* --- Umpan balik haptik untuk aksi lain --------------------------- */
    ['speakArabic', 'togglePlayVideo', 'claimGameXp', 'toggleAccordion',
     'filterPdfLibrary', 'fillAiPrompt', 'handleAiSend'].forEach(function (fn) {
      var base = PrototypeApp[fn];
      if (typeof base !== 'function') return;
      PrototypeApp[fn] = function () {
        var out = base.apply(null, arguments);
        if (isMobile()) haptic(7);
        return out;
      };
    });
  }


  /* ======================================================================
     TITIK MASUK
     ====================================================================== */
  function boot() {
    registerServiceWorker();
    initSplash();
    initInstallPrompt();
    initNetworkWatcher();
    initHistoryOverlays();

    // Ekspos aksi yang dipanggil langsung dari markup mobile.
    window.PerisaMobile = {
      install: triggerInstall,
      dismissInstall: dismissInstall,
      haptic: haptic,
      refresh: runRefresh,
      closeDrawer: function () { setDrawer(false); }
    };

    if (!isMobile()) return;

    body.classList.add('m-mobile');
    if (isStandalone()) body.classList.add('m-standalone');

    integrate();
    initPullToRefresh();
    initDrawerGestures();
    initSheetGestures($('certModal'), 'sheet-cert');
    initSheetGestures($('docReaderModal'), 'sheet-doc');

    window.addEventListener('scroll', onScroll, { passive: true });

    // Layar awal: hormati parameter ?view= (juga dipakai shortcut manifest).
    var startView = 'kurikulum';
    try {
      var q = new URLSearchParams(location.search).get('view');
      if (q && VIEW_META[q]) startView = q;
    } catch (_) {}

    syncGreeting();
    if (typeof PrototypeApp !== 'undefined') {
      PrototypeApp.switchMainView(startView);
    } else {
      paintLargeTitle(startView);
      syncTabBar(startView);
    }

    onScroll();
  }

  // Kembalikan tampilan ke kondisi bersih saat berpindah antara mobile & desktop.
  MOBILE_QUERY.addEventListener('change', function (e) {
    if (!e.matches) {
      unlockScroll();
      body.classList.remove('m-scrolled', 'm-tabbar-hidden', 'm-view-ai', 'm-mobile');
    } else if (!body.classList.contains('m-mobile')) {
      location.reload();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
