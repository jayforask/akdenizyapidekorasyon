require('dotenv').config({ path: __dirname + '/.env' });
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Statik dosyalar
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(path.join(__dirname, '../frontend')));
app.use('/admin', express.static(path.join(__dirname, '../admin')));

// ── API Route'ları ───────────────────────────────────────────────────────────
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/services',   require('./routes/services'));
app.use('/api/projects',   require('./routes/projects'));
app.use('/api/messages',   require('./routes/messages'));
app.use('/api/settings',   require('./routes/settings'));

// ── SPA Fallback'leri ────────────────────────────────────────────────────────
// Admin panel — tüm /admin/* istekleri admin/index.html'e değil, admin/*.html'e gitsin
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, '../admin/login.html'));
});
app.get('/admin/*', (req, res) => {
  const page = req.path.replace('/admin/', '');
  const filePath = path.join(__dirname, '../admin', page);
  const fs = require('fs');
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.sendFile(path.join(__dirname, '../admin/login.html'));
  }
});

// Frontend sayfaları
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// ── Hata Yönetimi ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Dosya boyutu 5MB\'ı aşamaz.' });
  }
  console.error(err.stack);
  res.status(500).json({ error: 'Sunucu hatası.' });
});

// ── Başlat ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Akdeniz Yapı Dekorasyon sunucusu çalışıyor`);
  console.log(`   → http://localhost:${PORT}`);
  console.log(`   → http://localhost:${PORT}/admin`);
  console.log(`   Admin: admin / admin123\n`);
});
