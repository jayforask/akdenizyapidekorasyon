require('dotenv').config({ path: __dirname + '/.env' });
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const fs        = require('fs');
const helmet    = require('helmet');
const rateLimit = require('express-rate-limit');

// ── Başlangıç ortam değişkeni kontrolü ──────────────────────────────────────
if (!process.env.JWT_SECRET) {
  console.error('❌ HATA: JWT_SECRET ortam değişkeni tanımlı değil.');
  console.error('   backend/.env dosyasını oluşturun ve JWT_SECRET=<güvenli_dizi> ekleyin.');
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Güvenlik başlıkları (helmet) ─────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc    : ["'self'"],
      scriptSrc     : ["'self'", "'unsafe-inline'"],   // inline <script> blokları için
      scriptSrcAttr : ["'unsafe-inline'"],             // onclick, onsubmit vb. inline event handler'lar için
      styleSrc      : ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://cdnjs.cloudflare.com'],
      fontSrc       : ["'self'", 'https://fonts.gstatic.com', 'https://cdnjs.cloudflare.com'],
      imgSrc        : ["'self'", 'data:', 'blob:', 'https://www.instagram.com', '*.cdninstagram.com', '*.fbcdn.net', 'https://images.unsplash.com', 'https://placehold.co'],
      connectSrc    : ["'self'"],
      frameSrc      : ["https://www.google.com", "https://maps.google.com", "https://www.google.com/maps/"],
      objectSrc     : ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Instagram CDN görselleri için
}));

// ── CORS — sadece kendi origin'e izin ver ─────────────────────────────────────
const ALLOWED_ORIGINS = (process.env.ALLOWED_ORIGINS || `http://localhost:${PORT}`)
  .split(',')
  .map(o => o.trim());

app.use(cors({
  origin: (origin, cb) => {
    // origin yoksa (curl, Postman, same-origin) → izin ver
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error('CORS: İzin verilmeyen kaynak.'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// ── Body boyut sınırı + Parser ────────────────────────────────────────────────
app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

// ── Login brute-force koruması ───────────────────────────────────────────────
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 dakika
  max: 10,                   // pencere başına maks 10 deneme
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla giriş denemesi. 15 dakika sonra tekrar deneyin.' },
  skipSuccessfulRequests: true,
});

// ── İletişim formu spam koruması ─────────────────────────────────────────────
const contactLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 saat
  max: 5,                    // saatte maks 5 mesaj
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Çok fazla mesaj gönderdiniz. Lütfen daha sonra tekrar deneyin.' },
});

// ── Statik dosyalar ──────────────────────────────────────────────────────────
app.use('/uploads', express.static(path.join(__dirname, 'uploads'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// ── API Route'ları ───────────────────────────────────────────────────────────
app.use('/api/auth/login',       loginLimiter);
app.use('/api/messages',         contactLimiter);  // Önce rate-limit, sonra router
app.use('/api/auth',             require('./routes/auth'));
app.use('/api/categories',       require('./routes/categories'));
app.use('/api/services',         require('./routes/services'));
app.use('/api/projects',         require('./routes/projects'));
app.use('/api/messages',         require('./routes/messages'));
app.use('/api/settings',         require('./routes/settings'));
app.use('/api/campaigns',        require('./routes/campaigns'));
app.use('/api/instagram-feed',   require('./routes/instagram'));

// ── Admin panel fallback — Path Traversal korumalı ──────────────────────────
app.get('/admin', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../admin/login.html'));
});

app.get('/admin/*', (req, res) => {
  // path.resolve ile normalize et, admin klasörü dışına çıkmayı engelle
  const adminRoot = path.resolve(__dirname, '../admin');
  const requested = req.path.replace(/^\/admin\//, '');

  // Boş veya tehlikeli karakter içeriyorsa reddet
  if (!requested || /[^a-zA-Z0-9._-]/.test(requested)) {
    return res.sendFile(path.resolve(adminRoot, 'login.html'));
  }

  const filePath = path.resolve(adminRoot, requested);

  // Çözümlenmiş yol adminRoot içinde mi kontrol et (path traversal önlemi)
  if (!filePath.startsWith(adminRoot + path.sep) && filePath !== adminRoot) {
    return res.status(403).send('Forbidden');
  }

  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.resolve(adminRoot, 'login.html'));
  }
});

// ── Frontend SPA fallback ─────────────────────────────────────────────────────
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, '../frontend/index.html'));
});

// ── Genel hata yönetimi ───────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Dosya boyutu 5MB\'ı aşamaz.' });
  }
  if (err.message === 'CORS: İzin verilmeyen kaynak.') {
    return res.status(403).json({ error: err.message });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

// ── Başlat ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Akdeniz Yapı Dekorasyon sunucusu çalışıyor`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → http://localhost:${PORT}/admin\n`);
});
