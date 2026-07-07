const express = require('express');
const router = express.Router();
const db = require('../database');
const auth = require('../middleware/auth');

// GET /api/settings/stats - dashboard istatistikleri (admin) — önce tanımlanmalı
router.get('/stats', auth, async (req, res) => {
  try {
    const services   = await db.getAsync('SELECT COUNT(*) as cnt FROM services');
    const categories = await db.getAsync('SELECT COUNT(*) as cnt FROM categories');
    const projects   = await db.getAsync('SELECT COUNT(*) as cnt FROM projects');
    const messages   = await db.getAsync('SELECT COUNT(*) as cnt FROM messages');
    const unread     = await db.getAsync('SELECT COUNT(*) as cnt FROM messages WHERE is_read = 0');
    res.json({
      services:        services.cnt,
      categories:      categories.cnt,
      projects:        projects.cnt,
      messages:        messages.cnt,
      unread_messages: unread.cnt
    });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// GET /api/settings - tüm ayarlar (public)
router.get('/', async (req, res) => {
  try {
    const rows = await db.allAsync('SELECT key, value FROM site_settings');
    const settings = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// ✅ İzin verilen ayar anahtarları whitelist'i — rastgele key yazılmasını önler
const ALLOWED_SETTINGS_KEYS = new Set([
  'site_title', 'site_subtitle', 'site_description',
  'phone', 'phone2', 'email', 'address',
  'facebook_url', 'instagram_url', 'whatsapp_number',
  'working_hours', 'map_embed_url',
  'meta_title', 'meta_description', 'meta_keywords',
  'hero_title', 'hero_subtitle',
  'footer_text', 'footer_copyright',
  'analytics_id', 'about_text', 'about_year_founded',
]);

// PUT /api/settings - ayarları güncelle (admin)
router.put('/', auth, async (req, res) => {
  try {
    const updates = req.body;
    if (typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Geçersiz format.' });
    }

    const invalidKeys = Object.keys(updates).filter(k => !ALLOWED_SETTINGS_KEYS.has(k));
    if (invalidKeys.length > 0) {
      return res.status(400).json({ error: `İzin verilmeyen anahtar(lar): ${invalidKeys.join(', ')}` });
    }

    for (const [key, value] of Object.entries(updates)) {
      await db.runAsync(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES (?, ?, NOW())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
        [key, String(value).slice(0, 2000)]
      );
    }
    res.json({ message: 'Ayarlar kaydedildi.' });
  } catch (err) {
    console.error('[Settings] Güncelleme hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

module.exports = router;
