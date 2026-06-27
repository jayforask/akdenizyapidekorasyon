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

// PUT /api/settings - ayarları güncelle (admin)
router.put('/', auth, async (req, res) => {
  try {
    const updates = req.body;
    if (typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ error: 'Geçersiz format.' });
    }
    for (const [key, value] of Object.entries(updates)) {
      await db.runAsync(
        `INSERT INTO site_settings (key, value, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`,
        [key, value]
      );
    }
    res.json({ message: 'Ayarlar kaydedildi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
