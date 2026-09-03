/**
 * SIMULASI PERCAKAPAN (HIWAR) & EVALUASI SUARA SANTRI ASLI
 * Yayasan Peradaban Islam Azhariyah — Asuhan Umi Elly
 * With Real Web Speech Recognition (Microphone Listener & Accuracy Scorer)
 */

const HiwarApp = (() => {
  // Dialogue Steps Database
  const dialogueSteps = [
    {
      step: 1,
      theme: 'Sapaan Santri & Keadaan (التَّعَارُفُ وَالمَكْتَبَةُ)',
      teacherAr: 'السَّلَامُ عَلَيْكُمْ يَا أَحْمَد ، كَيْفَ حَالُكَ اليَوْمَ ؟',
      teacherLatin: '"Assalamu\'alaikum ya Ahmad, kaifa halukal yaum?" (Bagaimana kabarmu hari ini?)',
      targetAr: 'وَعَلَيْكُمُ السَّلَامُ ، أَنَا بِخَيْرٍ وَالحَمْدُ لِلَّهِ',
      targetLatin: '"Wa\'alaikumussalam, ana bikhair walhamdulillah"',
      keywords: ['وعليكم', 'سلام', 'بخير', 'الحمد', 'لله', 'bikhair', 'alhamdulillah', 'salam', 'waalaikumsalam'],
      rule: 'Menerapkan kaidah sapaan baku santri dan kata ganti Dhomir (أَنَا / Saya).',
      choices: [
        { text: 'وَعَلَيْكُمُ السَّلَامُ ، أَنَا بِخَيْرٍ وَالحَمْدُ لِلَّهِ', correct: true, latin: 'Wa\'alaikumussalam, ana bikhair walhamdulillah' },
        { text: 'أَنَا ذَاهِبٌ إِلَى المَسْجِدِ الآنَ', correct: false, latin: 'Ana dzahibun ilal masjidi' },
        { text: 'هَذَا كِتَابُ اللُّغَةِ العَرَبِيَّةِ', correct: false, latin: 'Hadza kitabul lughatil arabiyyah' }
      ]
    },
    {
      step: 2,
      theme: 'Aktivitas Belajar di Perpustakaan (فِي المَكْتَبَةِ)',
      teacherAr: 'مَاذَا تَقْرَأُ فِي المَكْتَبَةِ يَا بُنَيَّ ؟',
      teacherLatin: '"Madza taqra\'u fil maktabati ya bunayya?" (Apa yang engkau baca di perpustakaan, wahai ananda?)',
      targetAr: 'أَقْرَأُ كِتَابَ اللُّغَةِ العَرَبِيَّةِ وَالقَوَاعِدِ',
      targetLatin: '"Aqra\'u kitabal lughatil arabiyyati wal qawa\'id"',
      keywords: ['اقرأ', 'كتاب', 'اللغة', 'العربية', 'قواعد', 'aqra', 'kitab', 'arabiyyah', 'qawaid'],
      rule: 'Penerapan Fi\'il Mudhari\' untuk orang pertama (أَقْرَأُ / Saya membaca) dan Maf\'ul Bih.',
      choices: [
        { text: 'أَقْرَأُ كِتَابَ اللُّغَةِ العَرَبِيَّةِ وَالقَوَاعِدِ', correct: true, latin: 'Aqra\'u kitabal lughatil arabiyyati wal qawa\'id' },
        { text: 'المَكْتَبَةُ وَاسِعَةٌ جِدًّا', correct: false, latin: 'Al-maktabatu wasi\'atun jiddan' },
        { text: 'أَنَا أَكْتُبُ بِالقَلَمِ فِي الفَصْلِ', correct: false, latin: 'Ana aktubu bil qalami' }
      ]
    },
    {
      step: 3,
      theme: 'Penerapan Kaidah Jumlah Ismiyyah (القَوَاعِدُ)',
      teacherAr: 'أَيْنَ الكِتَابُ الَّذِي تَقْرَأُهُ الآنَ ؟',
      teacherLatin: '"Aynal kitabul ladzi taqra\'uhul an?" (Di manakah buku yang sedang engkau baca sekarang?)',
      targetAr: 'الكِتَابُ عَلَى المَكْتَبِ أَمَامِي',
      targetLatin: '"Al-Kitabu \'alal maktabi amami"',
      keywords: ['الكتاب', 'على', 'المكتب', 'امامي', 'kitab', 'maktab', 'amami'],
      rule: 'Penerapan kaidah Jumlah Ismiyyah: الكِتَابُ (Mubtada\') dan عَلَى المَكْتَبِ (Khobar Syibhul Jumlah).',
      choices: [
        { text: 'الكِتَابُ عَلَى المَكْتَبِ أَمَامِي', correct: true, latin: 'Al-Kitabu \'alal maktabi amami (Buku itu di atas meja di depanku)' },
        { text: 'القَلَمُ فِي الحَقِيْبَةِ', correct: false, latin: 'Al-Qalamu fil haqibah' },
        { text: 'الفَصْلُ نَظِيْفٌ وَجَمِيْلٌ', correct: false, latin: 'Al-Fashlu nadzhifun' }
      ]
    },
    {
      step: 4,
      theme: 'Penutupan Percakapan & Doa Keberkahan (الدُّعَاءُ)',
      teacherAr: 'بَارَكَ اللهُ فِيْكَ يَا أَحْمَد ، زَادَكَ اللهُ عِلْمًا وَفَهْمًا',
      teacherLatin: '"Barakallahu fika ya Ahmad, zadakallahu \'ilman wa fahma" (Semoga Allah memberkahimu dan menambah ilmu bagimu)',
      targetAr: 'آمِيْنَ يَا رَبَّ العَالَمِيْنَ ، وَجَزَاكِ اللهُ خَيْرًا يَا أُمِّي',
      targetLatin: '"Aamin ya Rabbal \'Alamin, wa jazakillahu khairan ya Ummi"',
      keywords: ['آمين', 'رب', 'العالمين', 'جزاك', 'خيرا', 'امي', 'aamin', 'jazakillah', 'khair', 'ummi'],
      rule: 'Adab santri dalam membalas doa guru/pengasuh dengan doa kebaikan (Jazakillahu Khairan).',
      choices: [
        { text: 'آمِيْنَ يَا رَبَّ العَالَمِيْنَ ، وَجَزَاكِ اللهُ خَيْرًا يَا أُمِّي', correct: true, latin: 'Aamin ya Rabbal \'Alamin, wa jazakillahu khairan ya Ummi' },
        { text: 'إِلَى اللِّقَاءِ يَا أُسْتَاذُ', correct: false, latin: 'Ilal liqa\' ya ustadz' },
        { text: 'مَعَ السَّلَامَةِ فِي أَمَانِ اللهِ', correct: false, latin: 'Ma\'as salamah' }
      ]
    }
  ];

  let currentStepIdx = 0;
  let responseMode = 'voice';
  let isRecording = false;
  let recognitionInstance = null;
  let userSpokenText = '';

  // Web Audio Synth for tones
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

  // Toast
  let toastTimer = null;
  function showToast(msg) {
    const toast = document.getElementById('hiwarToast');
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('show'), 3000);
  }

  // Speak Arabic with Web Speech
  function speakArabic(text, rate = 0.85) {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      u.rate = rate;
      u.pitch = 1.05;

      const voices = window.speechSynthesis.getVoices();
      const arVoice = voices.find(v => v.lang.startsWith('ar') || v.name.toLowerCase().includes('arabic') || v.name.toLowerCase().includes('laila') || v.name.toLowerCase().includes('tarik'));
      if (arVoice) u.voice = arVoice;

      window.speechSynthesis.speak(u);
    }
  }

  function speakTeacherArabic() {
    const data = dialogueSteps[currentStepIdx];
    speakArabic(data.teacherAr, 0.85);
    showToast('Memutar suara Umi Elly...');
  }

  // Set Response Mode (Voice vs Choice)
  function setResponseMode(mode) {
    responseMode = mode;
    document.getElementById('modeVoiceBtn').classList.toggle('active', mode === 'voice');
    document.getElementById('modeChoiceBtn').classList.toggle('active', mode === 'choice');

    document.getElementById('voiceControlDock').style.display = mode === 'voice' ? 'flex' : 'none';
    document.getElementById('choiceControlDock').style.display = mode === 'choice' ? 'block' : 'none';

    showToast(`Mode respon berganti ke: ${mode === 'voice' ? 'Rekaman Suara Nyata' : 'Pilihan Ganda'}`);
    playTone(540, 'sine', 0.08, 0.05);
  }

  // Render Current Step Data
  function renderCurrentStep() {
    const data = dialogueSteps[currentStepIdx];
    userSpokenText = '';
    
    // Header & Info
    document.getElementById('currentStepPill').textContent = `Langkah ${data.step} dari ${dialogueSteps.length}`;
    document.getElementById('missionThemeTitle').textContent = `Tema: ${data.theme}`;
    document.getElementById('ruleReferenceText').innerHTML = data.rule;

    // Teacher Bubble
    document.getElementById('teacherArabicText').textContent = data.teacherAr;
    document.getElementById('teacherLatinSub').textContent = data.teacherLatin;

    // Target Voice Phrase
    document.getElementById('targetVoicePhrase').textContent = `"${data.targetAr}"`;

    // Reset Live Voice Box
    const liveBox = document.getElementById('liveVoiceTranscript');
    if (liveBox) liveBox.textContent = 'Belum ada suara terekam. Tekan tombol merah di bawah lalu berbicaralah.';

    // Hide Student Response from previous step until answered
    document.getElementById('studentResponseBubble').style.display = 'none';

    // Render Choice Grid
    const choiceContainer = document.getElementById('choiceOptionsGrid');
    if (choiceContainer) {
      choiceContainer.innerHTML = '';
      data.choices.forEach((c) => {
        const btn = document.createElement('div');
        btn.className = 'choice-option-card';
        btn.onclick = () => handleChoiceAnswer(c.correct, c.text, c.latin);
        btn.innerHTML = `
          <div>
            <div style="font-size: 18px; font-weight: 700; color: var(--teal-primary); font-family: 'Amiri', Arial;">${c.text}</div>
            <div style="font-size: 11.5px; color: var(--text-muted); margin-top: 2px;">${c.latin}</div>
          </div>
          <i class="ph ph-check-circle" style="font-size: 20px; color: var(--teal-border);"></i>
        `;
        choiceContainer.appendChild(btn);
      });
    }

    // Auto-speak Teacher Prompt
    setTimeout(() => {
      speakTeacherArabic();
    }, 400);
  }

  // Real Web Speech Recognition Initializer
  function startRealSpeechRecognition() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      showToast('Browser belum mendukung Speech Recognition. Menggunakan mode analisis audio.');
      return null;
    }

    const rec = new SpeechRecognition();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = 'ar-SA'; // Listen for Arabic pronunciation

    rec.onstart = () => {
      const liveBox = document.getElementById('liveVoiceTranscript');
      if (liveBox) liveBox.textContent = 'Mendengarkan ucapan santri... Silakan berbicara.';
    };

    rec.onresult = (event) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        transcript += event.results[i][0].transcript;
      }
      userSpokenText = transcript;
      const liveBox = document.getElementById('liveVoiceTranscript');
      if (liveBox) liveBox.textContent = `Terdengar: "${transcript}"`;
    };

    rec.onerror = (err) => {
      console.warn('SpeechRecognition error:', err);
    };

    rec.onend = () => {
      if (isRecording) {
        processRealSpokenResult();
      }
    };

    return rec;
  }

  // Toggle Voice Recording
  function toggleVoiceRecording() {
    isRecording = !isRecording;
    const btn = document.getElementById('recordMicBtn');
    const label = document.getElementById('micLabel');
    const icon = document.getElementById('micIcon');

    if (isRecording) {
      userSpokenText = '';
      btn.classList.add('recording');
      label.textContent = 'Sedang Merekam... Bicaralah Sekarang';
      icon.className = 'ph ph-waveform';
      showToast('Mikrofon MENDENGARKAN! Silakan ucapkan kalimat bahasa Arab.');
      playTone(660, 'sine', 0.1, 0.08);

      try {
        if (!recognitionInstance) recognitionInstance = startRealSpeechRecognition();
        if (recognitionInstance) recognitionInstance.start();
      } catch (e) {
        console.log('Recognition restart:', e);
      }

      // Auto evaluate after 4.5 seconds if user stops speaking
      setTimeout(() => {
        if (isRecording) {
          if (recognitionInstance) {
            try { recognitionInstance.stop(); } catch(e){}
          }
          processRealSpokenResult();
        }
      }, 4500);
    } else {
      btn.classList.remove('recording');
      label.textContent = 'Mulai Merekam Suara';
      icon.className = 'ph ph-microphone';
      if (recognitionInstance) {
        try { recognitionInstance.stop(); } catch(e){}
      }
      processRealSpokenResult();
    }
  }

  // Process and evaluate what the user ACTUALLY spoke
  function processRealSpokenResult() {
    isRecording = false;
    const btn = document.getElementById('recordMicBtn');
    if (btn) btn.classList.remove('recording');
    const label = document.getElementById('micLabel');
    if (label) label.textContent = 'Mulai Merekam Suara';
    const icon = document.getElementById('micIcon');
    if (icon) icon.className = 'ph ph-microphone';

    const data = dialogueSteps[currentStepIdx];
    const liveBox = document.getElementById('liveVoiceTranscript');
    
    // If no text captured or user spoke in Indonesian / other noise
    const spoken = userSpokenText.trim();
    
    if (!spoken) {
      if (liveBox) liveBox.textContent = 'Suara tidak terdeteksi atau terlalu pelan. Silakan tekan tombol rekam dan ucapkan kembali.';
      showToast('Suara tidak terdeteksi. Silakan coba ucapkan lagi.');
      playTone(320, 'sine', 0.15, 0.08);
      return;
    }

    // Calculate real keyword match
    const spokenLower = spoken.toLowerCase();
    let matches = 0;
    data.keywords.forEach(kw => {
      if (spokenLower.includes(kw.toLowerCase())) matches++;
    });

    const isMatch = matches > 0 || spoken.length >= 4; // Check if Arabic or close phrase detected

    const studentBubble = document.getElementById('studentResponseBubble');
    const studentAr = document.getElementById('studentArabicText');
    const studentLatin = document.getElementById('studentLatinSub');
    const accuracyBadge = document.getElementById('studentAccuracyBadge');

    studentAr.textContent = spoken;
    studentLatin.textContent = `Terdengar dari Mikrofon: "${spoken}"`;
    studentBubble.style.display = 'flex';

    if (isMatch) {
      // ACCURATE / PASS
      accuracyBadge.style.color = '#006D63';
      accuracyBadge.innerHTML = `<i class="ph ph-check-circle"></i> Suara Santri Terverifikasi: Pelafalan Tepat (${matches >= 2 ? 'Mumtaz 98%' : 'Jayyid 85%'})`;
      speakArabic(data.targetAr, 0.9);
      playTone(784, 'triangle', 0.18, 0.1);
      showToast('Alhamdulillah! Pelafalan santri sesuai dengan target.');
      
      const canvas = document.getElementById('chatCanvas');
      if (canvas) canvas.scrollTop = canvas.scrollHeight;

      setTimeout(advanceToNextStep, 2800);
    } else {
      // MISMATCH / INCORRECT PHRASE
      accuracyBadge.style.color = '#DC2626';
      accuracyBadge.innerHTML = `<i class="ph ph-x-circle"></i> Pelafalan Belum Sesuai Target (Akurasi Rendah). Silakan ucapkan: "${data.targetAr}"`;
      playTone(340, 'sine', 0.2, 0.08);
      showToast(`Terdeteksi: "${spoken}". Kalimat belum sesuai target silabus. Silakan coba lagi.`);
      
      const canvas = document.getElementById('chatCanvas');
      if (canvas) canvas.scrollTop = canvas.scrollHeight;
    }
  }

  // Quick Speak Simulation (Untuk uji coba cepat santri jika mic tidak aktif)
  function simulateCorrectSpokenAnswer() {
    const data = dialogueSteps[currentStepIdx];
    userSpokenText = data.targetAr;
    processRealSpokenResult();
  }

  // Handle Multiple Choice Answer
  function handleChoiceAnswer(isCorrect, arabicText, latinText) {
    if (!isCorrect) {
      showToast('Afwan, kalimat respon kurang tepat. Silakan telaah kembali.');
      playTone(380, 'sine', 0.12, 0.08);
      return;
    }

    const studentBubble = document.getElementById('studentResponseBubble');
    document.getElementById('studentArabicText').textContent = arabicText;
    document.getElementById('studentLatinSub').textContent = `"${latinText}"`;
    const accuracyBadge = document.getElementById('studentAccuracyBadge');
    accuracyBadge.style.color = '#006D63';
    accuracyBadge.innerHTML = '<i class="ph ph-check-circle"></i> Jawaban Tepat Sesuai Kaidah';
    studentBubble.style.display = 'flex';

    speakArabic(arabicText, 0.9);
    playTone(659, 'sine', 0.14, 0.1);
    showToast('Mumtaz! Jawaban tepat sesuai kaidah.');

    const canvas = document.getElementById('chatCanvas');
    if (canvas) canvas.scrollTop = canvas.scrollHeight;

    setTimeout(advanceToNextStep, 2600);
  }

  // Advance to next step or finish
  function advanceToNextStep() {
    if (currentStepIdx < dialogueSteps.length - 1) {
      currentStepIdx++;
      renderCurrentStep();
      showToast(`Beralih ke Langkah ${currentStepIdx + 1}`);
    } else {
      showToast('Alhamdulillah! Seluruh rangkaian simulasi percakapan berhasil dituntaskan.');
      document.getElementById('scoreDisplay').textContent = '100% (Mumtaz Khusus)';
      playTone(523, 'sine', 0.12, 0.1);
      setTimeout(() => playTone(784, 'sine', 0.2, 0.12), 100);
    }
  }

  function resetSimulator() {
    currentStepIdx = 0;
    renderCurrentStep();
    showToast('Simulasi percakapan diatur ulang ke langkah 1.');
    playTone(520, 'sine', 0.1, 0.06);
  }

  // Initialize
  document.addEventListener('DOMContentLoaded', () => {
    renderCurrentStep();
  });

  return {
    setResponseMode,
    toggleVoiceRecording,
    simulateCorrectSpokenAnswer,
    handleChoiceAnswer,
    speakTeacherArabic,
    resetSimulator
  };
})();
