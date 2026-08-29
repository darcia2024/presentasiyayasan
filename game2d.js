/**
 * PERISA 2D Arabic Adventure Game Engine (HTML5 Canvas + Node.js Backend)
 * Petualangan Santri Mufrodat
 */

const CanvasGame = (() => {
  let canvas, ctx;
  let animationId = null;

  // Sound Synth
  let audioCtx = null;
  function initAudio() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) audioCtx = new AudioContext();
    }
  }

  function playTone(freq, type = 'sine', duration = 0.1, gainVal = 0.1) {
    try {
      initAudio();
      if (!audioCtx) return;
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
      gain.gain.setValueAtTime(gainVal, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + duration);
    } catch(e) {}
  }

  function playJumpSound() { playTone(340, 'triangle', 0.12, 0.08); setTimeout(() => playTone(480, 'sine', 0.1, 0.08), 40); }
  function playCoinSound() { playTone(587.33, 'sine', 0.1, 0.1); setTimeout(() => playTone(880, 'sine', 0.2, 0.12), 80); }
  function playWrongSound() { playTone(220, 'sawtooth', 0.2, 0.1); }

  // Game State
  const state = {
    xp: 420,
    lives: 3,
    level: 1,
    currentQuestIndex: 0,
    quests: [
      {
        jenjang: 'SD - Mufrodat Sekolah',
        targetArabic: 'المَكْتَبَةُ',
        targetTranslation: 'Perpustakaan Sekolah',
        words: [
          { arabic: 'المَكْتَبَةُ', translation: 'Perpustakaan', correct: true, x: 280, y: 190 },
          { arabic: 'القَلَمُ', translation: 'Pena', correct: false, x: 520, y: 220 },
          { arabic: 'البَابُ', translation: 'Pintu', correct: false, x: 680, y: 310 }
        ]
      },
      {
        jenjang: 'SMP - Kaidah Dhomir',
        targetArabic: 'هُوَ طَالِبٌ',
        targetTranslation: 'Dia (Laki-laki) Siswa',
        words: [
          { arabic: 'هُوَ', translation: 'Dia (Laki)', correct: true, x: 500, y: 190 },
          { arabic: 'هِيَ', translation: 'Dia (Pr)', correct: false, x: 260, y: 280 },
          { arabic: 'أَنْتَ', translation: 'Kamu', correct: false, x: 690, y: 310 }
        ]
      },
      {
        jenjang: 'SMA - Susun Kalimat',
        targetArabic: 'القَلَمُ عَلَى المَكْتَبِ',
        targetTranslation: 'Pena di atas meja',
        words: [
          { arabic: 'عَلَى المَكْتَبِ', translation: 'di atas meja', correct: true, x: 680, y: 200 },
          { arabic: 'فِي القَلَمِ', translation: 'di dalam pena', correct: false, x: 380, y: 290 },
          { arabic: 'مِنَ البَابِ', translation: 'dari pintu', correct: false, x: 180, y: 320 }
        ]
      }
    ]
  };

  // Player Object
  const player = {
    x: 60,
    y: 320,
    width: 36,
    height: 52,
    vx: 0,
    vy: 0,
    speed: 4.5,
    jumpStrength: -11.5,
    isGrounded: false,
    facing: 'right',
    walkCycle: 0
  };

  // Static Platforms
  const platforms = [
    { x: 0, y: 390, width: 800, height: 90, color: '#093B37' },     // Main Ground
    { x: 220, y: 260, width: 140, height: 16, color: '#0F544F' },   // Plat 1
    { x: 440, y: 270, width: 160, height: 16, color: '#0F544F' },   // Plat 2
    { x: 620, y: 260, width: 140, height: 16, color: '#0F544F' },   // Plat 3
    { x: 120, y: 180, width: 120, height: 16, color: '#0F544F' }    // Plat High
  ];

  // Particle System
  let particles = [];
  function createBurst(x, y, color = '#FBBF24') {
    for (let i = 0; i < 18; i++) {
      particles.push({
        x: x,
        y: y,
        vx: (Math.random() - 0.5) * 6,
        vy: (Math.random() - 0.5) * 6,
        size: Math.random() * 5 + 2,
        color: color,
        alpha: 1,
        life: 30
      });
    }
  }

  // Key Controllers
  const keys = { left: false, right: false, up: false };

  function init() {
    canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');

    // Input listeners
    window.addEventListener('keydown', e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = true;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = true;
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') {
        if (!keys.up) jump();
        keys.up = true;
      }
    });

    window.addEventListener('keyup', e => {
      if (e.code === 'ArrowLeft' || e.code === 'KeyA') keys.left = false;
      if (e.code === 'ArrowRight' || e.code === 'KeyD') keys.right = false;
      if (e.code === 'ArrowUp' || e.code === 'Space' || e.code === 'KeyW') keys.up = false;
    });

    // Touch controls
    setupTouchBtn('btnTouchLeft', () => keys.left = true, () => keys.left = false);
    setupTouchBtn('btnTouchRight', () => keys.right = true, () => keys.right = false);
    setupTouchBtn('btnTouchJump', () => jump(), () => {});

    updateHUD();
    gameLoop();
  }

  function setupTouchBtn(id, onPress, onRelease) {
    const btn = document.getElementById(id);
    if (!btn) return;
    btn.addEventListener('touchstart', e => { e.preventDefault(); onPress(); });
    btn.addEventListener('touchend', e => { e.preventDefault(); onRelease(); });
    btn.addEventListener('mousedown', onPress);
    btn.addEventListener('mouseup', onRelease);
  }

  function jump() {
    if (player.isGrounded) {
      player.vy = player.jumpStrength;
      player.isGrounded = false;
      playJumpSound();
    }
  }

  function update() {
    // Player Horizontal Movement
    if (keys.left) {
      player.vx = -player.speed;
      player.facing = 'left';
      player.walkCycle += 0.2;
    } else if (keys.right) {
      player.vx = player.speed;
      player.facing = 'right';
      player.walkCycle += 0.2;
    } else {
      player.vx *= 0.8;
      player.walkCycle = 0;
    }

    // Apply Gravity
    player.vy += 0.5;
    player.x += player.vx;
    player.y += player.vy;

    // Boundaries
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;

    // Platform Collisions
    player.isGrounded = false;
    platforms.forEach(plat => {
      if (
        player.x + player.width > plat.x &&
        player.x < plat.x + plat.width &&
        player.y + player.height >= plat.y &&
        player.y + player.height <= plat.y + plat.height &&
        player.vy >= 0
      ) {
        player.isGrounded = true;
        player.vy = 0;
        player.y = plat.y - player.height;
      }
    });

    // Check Collectible Collisions
    const currentQuest = state.quests[state.currentQuestIndex];
    currentQuest.words.forEach(item => {
      if (!item.collected) {
        const dist = Math.hypot((player.x + player.width/2) - item.x, (player.y + player.height/2) - item.y);
        if (dist < 36) {
          item.collected = true;
          if (item.correct) {
            // Correct word collected!
            createBurst(item.x, item.y, '#FBBF24');
            playCoinSound();
            state.xp += 50;
            syncScoreToNodeBackend(50);
            showBanner(`Mumtaz! +50 XP (${item.arabic} = ${item.translation})`);
            
            // Advance level after slight delay
            setTimeout(() => {
              state.currentQuestIndex = (state.currentQuestIndex + 1) % state.quests.length;
              state.quests[state.currentQuestIndex].words.forEach(w => w.collected = false);
              player.x = 60;
              player.y = 320;
              updateHUD();
            }, 1000);
          } else {
            // Wrong word!
            createBurst(item.x, item.y, '#EF4444');
            playWrongSound();
            state.lives = Math.max(0, state.lives - 1);
            showBanner(`Afwan, kurang tepat! Itu kata "${item.arabic}"`);
            if (state.lives === 0) {
              setTimeout(() => {
                state.lives = 3;
                showBanner('Mulai kembali dengan 3 hati!');
                updateHUD();
              }, 1200);
            }
          }
          updateHUD();
        }
      }
    });

    // Update Particles
    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.alpha -= 0.03;
    });
    particles = particles.filter(p => p.alpha > 0);
  }

  function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Background Pillars
    ctx.fillStyle = 'rgba(0, 135, 122, 0.15)';
    ctx.fillRect(80, 80, 24, 310);
    ctx.fillRect(360, 60, 24, 330);
    ctx.fillRect(660, 80, 24, 310);

    // Draw Platforms
    platforms.forEach(plat => {
      ctx.fillStyle = plat.color;
      ctx.fillRect(plat.x, plat.y, plat.width, plat.height);

      // Top Gold Rim
      ctx.fillStyle = '#C5921B';
      ctx.fillRect(plat.x, plat.y, plat.width, 3);
    });

    // Draw Collectible Arabic Word Orbs
    const currentQuest = state.quests[state.currentQuestIndex];
    currentQuest.words.forEach(item => {
      if (!item.collected) {
        // Glowing Orb Backdrop
        ctx.beginPath();
        ctx.arc(item.x, item.y, 24, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
        ctx.shadowColor = '#00D2BE';
        ctx.shadowBlur = 12;
        ctx.fill();
        ctx.shadowBlur = 0;

        ctx.strokeStyle = '#00877A';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Arabic Word Inside Orb
        ctx.fillStyle = '#082D2B';
        ctx.font = 'bold 15px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(item.arabic, item.x, item.y);
      }
    });

    // Draw Player Character (Santri Ahmad)
    drawSantri(player.x, player.y, player.facing, player.walkCycle);

    // Draw Particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    });
  }

  function drawSantri(x, y, facing, walkCycle) {
    ctx.save();
    ctx.translate(x + 18, y + 26);
    if (facing === 'left') ctx.scale(-1, 1);

    // White Koko Gamis Body
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.roundRect(-12, -8, 24, 30, [4, 4, 2, 2]);
    ctx.fill();
    ctx.strokeStyle = '#00877A';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Koko Collar
    ctx.strokeStyle = '#C5921B';
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 6);
    ctx.stroke();

    // Head
    ctx.fillStyle = '#FED7AA';
    ctx.beginPath();
    ctx.arc(0, -16, 10, 0, Math.PI * 2);
    ctx.fill();

    // Black Velvet Peci (Kopiah Santri)
    ctx.fillStyle = '#0F2624';
    ctx.beginPath();
    ctx.roundRect(-10, -26, 20, 10, [3, 3, 0, 0]);
    ctx.fill();
    ctx.fillStyle = '#C5921B';
    ctx.fillRect(-10, -17, 20, 1.5);

    // Friendly Eyes
    ctx.fillStyle = '#082D2B';
    ctx.beginPath();
    ctx.arc(4, -16, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Animated Feet
    const legOffset = Math.sin(walkCycle) * 4;
    ctx.fillStyle = '#082D2B';
    ctx.fillRect(-8 + legOffset, 22, 6, 6);
    ctx.fillRect(2 - legOffset, 22, 6, 6);

    ctx.restore();
  }

  function gameLoop() {
    update();
    render();
    animationId = requestAnimationFrame(gameLoop);
  }

  function updateHUD() {
    const quest = state.quests[state.currentQuestIndex];
    const hudXp = document.getElementById('gameHudXp');
    const hudLives = document.getElementById('gameHudLives');
    const questArabic = document.getElementById('questTargetArabic');
    const questTrans = document.getElementById('questTargetTranslation');
    const questJenjang = document.getElementById('questJenjangTag');

    if (hudXp) hudXp.textContent = `${state.xp} XP`;
    if (hudLives) hudLives.innerHTML = '❤️'.repeat(state.lives);
    if (questArabic) questArabic.textContent = quest.targetArabic;
    if (questTrans) questTrans.textContent = `(${quest.targetTranslation})`;
    if (questJenjang) questJenjang.textContent = quest.jenjang;
  }

  function showBanner(msg) {
    const banner = document.getElementById('gameActionBanner');
    if (banner) {
      banner.textContent = msg;
      banner.style.opacity = '1';
      setTimeout(() => banner.style.opacity = '0', 2000);
    }
  }

  // Node.js Backend API Call
  function syncScoreToNodeBackend(addedXp) {
    try {
      fetch('/api/game/score', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Ahmad Fauzan', addedXp: addedXp })
      })
      .then(res => res.json())
      .then(data => {
        console.log('Node.js Backend Response:', data);
      })
      .catch(err => console.log('Node offline / demo mode:', err));
    } catch(e) {}
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', () => {
  CanvasGame.init();
});
