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

const db        = require('./database');

function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// ── Dinamik Sitemap (XML) ───────────────────────────────────────────────────
app.get('/sitemap.xml', async (req, res) => {
  try {
    let services = [];
    try {
      services = await db.allAsync('SELECT slug, created_at FROM services ORDER BY id DESC');
    } catch (_) { services = []; }
    
    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const staticPages = [
      { loc: 'https://antalyadiscephe.com/', priority: '1.0', changefreq: 'weekly' },
      { loc: 'https://antalyadiscephe.com/hizmetler.html', priority: '0.9', changefreq: 'monthly' },
      { loc: 'https://antalyadiscephe.com/referanslar.html', priority: '0.8', changefreq: 'monthly' },
      { loc: 'https://antalyadiscephe.com/kampanyalar.html', priority: '0.8', changefreq: 'weekly' },
      { loc: 'https://antalyadiscephe.com/iletisim.html', priority: '0.7', changefreq: 'monthly' },
      { loc: 'https://antalyadiscephe.com/kepez-isi-yalitimi.html', priority: '0.8', changefreq: 'monthly' },
      { loc: 'https://antalyadiscephe.com/konyaalti-dis-cephe.html', priority: '0.8', changefreq: 'monthly' },
      { loc: 'https://antalyadiscephe.com/lara-mantolama.html', priority: '0.8', changefreq: 'monthly' },
      { loc: 'https://antalyadiscephe.com/muratpasa-mantolama.html', priority: '0.8', changefreq: 'monthly' }
    ];

    const today = new Date().toISOString().split('T')[0];

    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${page.loc}</loc>\n`;
      xml += `    <lastmod>${today}</lastmod>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `  </url>\n`;
    }

    if (services && services.length > 0) {
      for (const s of services) {
        const date = s.created_at ? new Date(s.created_at).toISOString().split('T')[0] : today;
        xml += `  <url>\n`;
        xml += `    <loc>https://antalyadiscephe.com/hizmetler/${escapeHtml(s.slug)}</loc>\n`;
        xml += `    <lastmod>${date}</lastmod>\n`;
        xml += `    <changefreq>weekly</changefreq>\n`;
        xml += `    <priority>0.9</priority>\n`;
        xml += `  </url>\n`;
      }
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    console.error('Sitemap error:', err);
    res.status(500).send('Sitemap üretilirken hata oluştu.');
  }
});

// ── 301 Permanent Redirect (Eski query parametreli linkler için) ──────────────
app.get('/hizmet-detay.html', (req, res) => {
  const slug = req.query.slug || req.query.id;
  if (slug) {
    return res.redirect(301, `/hizmetler/${encodeURIComponent(slug)}`);
  }
  return res.redirect(301, '/hizmetler.html');
});

// ── Clean URL Route (/hizmetler/:slug) + Dynamic SEO Meta Injections ─────────
app.get('/hizmetler/:slug', async (req, res, next) => {
  try {
    const slug = req.params.slug;
    let service = null;
    try {
      service = await db.getAsync(`
        SELECT s.*, c.name as category_name, c.icon as category_icon
        FROM services s
        LEFT JOIN categories c ON s.category_id = c.id
        WHERE s.slug = ?
      `, [slug]);
    } catch (_) { service = null; }

    const filePath = path.resolve(__dirname, '../frontend/hizmet-detay.html');
    if (!fs.existsSync(filePath)) return next();

    let html = fs.readFileSync(filePath, 'utf8');

    if (service) {
      const pageTitle = `Antalya ${service.title} | Akdeniz Yapı Dekorasyon`;
      const cleanDesc = service.short_desc
        ? service.short_desc.replace(/\s+/g, ' ').trim()
        : `Antalya ${service.title} hizmeti. Akdeniz Yapı Dekorasyon güvencesiyle profesyonel uygulamalar ve kaliteli çözümler.`;
      const canonicalUrl = `https://antalyadiscephe.com/hizmetler/${service.slug}`;
      const imageUrl = service.image
        ? (service.image.startsWith('http') ? service.image : `https://antalyadiscephe.com${service.image}`)
        : 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=800&q=80';

      // HTML Title güncelle
      html = html.replace(/<title>.*?<\/title>/i, `<title>${escapeHtml(pageTitle)}</title>`);

      // Meta Description güncelle veya ekle
      if (/<meta name="description"/i.test(html)) {
        html = html.replace(/<meta name="description" content=".*?" \/>/i, `<meta name="description" content="${escapeHtml(cleanDesc)}" />`);
      } else {
        html = html.replace('</head>', `  <meta name="description" content="${escapeHtml(cleanDesc)}" />\n</head>`);
      }

      // Canonical link varsa kaldır (duplikasyon olmasın)
      html = html.replace(/<link rel="canonical".*?\/>/gi, '');

      // Dynamic SEO ve OG Meta Etiketleri
      const seoInjections = `
  <link rel="canonical" href="${canonicalUrl}" />
  <meta property="og:title" content="${escapeHtml(pageTitle)}" />
  <meta property="og:description" content="${escapeHtml(cleanDesc)}" />
  <meta property="og:image" content="${imageUrl}" />
  <meta property="og:url" content="${canonicalUrl}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Akdeniz Yapı Dekorasyon" />
  <meta property="og:locale" content="tr_TR" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}" />
  <meta name="twitter:description" content="${escapeHtml(cleanDesc)}" />
  <meta name="twitter:image" content="${imageUrl}" />
`;
      html = html.replace('</head>', `${seoInjections}\n</head>`);
    }

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(html);
  } catch (err) {
    console.error('Hizmet detay SSR hatası:', err);
    next(err);
  }
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
