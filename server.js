// server.js - Node.js Backend Server for PERISA Arabic Learning Platform & 2D Game Engine
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3020;

// MIME types
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// In-Memory Live Game Leaderboard & Question Bank
const gameData = {
  leaderboard: [
    { rank: 1, name: 'M. Rizky Pratama', level: 'SMA Kelas 11', xp: 780, streak: 12 },
    { rank: 2, name: 'Siti Nurhaliza', level: 'SMP Kelas 8', xp: 540, streak: 8 },
    { rank: 3, name: 'Ahmad Fauzan', level: 'SMP Kelas 8', xp: 470, streak: 5 },
    { rank: 4, name: 'Fajar Alamsyah', level: 'SD Kelas 5', xp: 390, streak: 6 },
    { rank: 5, name: 'Aisyah Zahra', level: 'SD Kelas 6', xp: 320, streak: 4 }
  ],
  questions: {
    sd: [
      { id: 1, targetWord: 'المَكْتَبَةُ', translation: 'Perpustakaan', items: [
        { word: 'المَكْتَبَةُ', correct: true },
        { word: 'القَلَمُ', correct: false },
        { word: 'البَابُ', correct: false }
      ]},
      { id: 2, targetWord: 'الكِتَابُ', translation: 'Buku Pelajaran', items: [
        { word: 'الكِتَابُ', correct: true },
        { word: 'المِسْطَرَةُ', correct: false },
        { word: 'الكُرْسِيُّ', correct: false }
      ]}
    ],
    smp: [
      { id: 1, targetWord: 'هُوَ طَالِبٌ', translation: 'Dia (Laki-laki) Siswa', items: [
        { word: 'هُوَ', correct: true },
        { word: 'هِيَ', correct: false },
        { word: 'هُمْ', correct: false }
      ]},
      { id: 2, targetWord: 'هِيَ طَالِبَةٌ', translation: 'Dia (Perempuan) Siswi', items: [
        { word: 'هِيَ', correct: true },
        { word: 'هُوَ', correct: false },
        { word: 'أَنْتَ', correct: false }
      ]}
    ],
    sma: [
      { id: 1, targetWord: 'القَلَمُ عَلَى المَكْتَبِ', translation: 'Pena di atas meja', items: [
        { word: 'عَلَى المَكْتَبِ', correct: true },
        { word: 'فِي القَلَمِ', correct: false },
        { word: 'مِنَ البَابِ', correct: false }
      ]}
    ]
  }
};

const server = http.createServer((req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // API Routes
  if (pathname === '/api/game/leaderboard' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: gameData.leaderboard }));
    return;
  }

  if (pathname === '/api/game/questions' && req.method === 'GET') {
    const jenjang = parsedUrl.searchParams.get('jenjang') || 'smp';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true, data: gameData.questions[jenjang] || gameData.questions.smp }));
    return;
  }

  if (pathname === '/api/game/score' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const santri = gameData.leaderboard.find(s => s.name === payload.name);
        if (santri) {
          santri.xp += (payload.addedXp || 50);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, message: '+50 XP berhasil dicatat ke server Node.js', updatedScore: santri ? santri.xp : 470 }));
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Static File Serving
  let filePath = path.join(__dirname, pathname === '/' ? 'prototype.html' : pathname);

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, { 'Content-Type': contentType });
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`PERISA Arabic Learning Node.js Server & 2D Game Engine`);
  console.log(`Server aktif berjalan di: http://localhost:${PORT}`);
  console.log(`Prototype Live Demo:      http://localhost:${PORT}/prototype.html`);
  console.log(`2D Game Canvas Demo:     http://localhost:${PORT}/game2d.html`);
  console.log(`Pitch Deck Presentation:  http://localhost:${PORT}/index.html`);
  console.log(`=======================================================`);
});
