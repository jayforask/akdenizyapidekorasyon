const express = require('express');
const router = express.Router();
const db = require('../database');
const auth = require('../middleware/auth');

// POST /api/messages - iletişim formu (public)
// Rate limiting server.js'de contactLimiter ile uygulanıyor
router.post('/', async (req, res) => {
  try {
    const { name, phone, email, subject, message } = req.body;

    // ✅ Temel doğrulama
    if (!name || !message) {
      return res.status(400).json({ error: 'Ad ve mesaj alanları gerekli.' });
    }
    // ✅ Alan uzunluk sınırları
    if (String(name).length > 120 || String(message).length > 3000) {
      return res.status(400).json({ error: 'Alan uzunluğu sınırı aşıldı.' });
    }

    await db.runAsync(
      'INSERT INTO messages (name, phone, email, subject, message) VALUES (?, ?, ?, ?, ?)',
      [
        String(name).slice(0, 120),
        phone    ? String(phone).slice(0, 30)    : null,
        email    ? String(email).slice(0, 200)   : null,
        subject  ? String(subject).slice(0, 200) : null,
        String(message).slice(0, 3000),
      ]
    );
    res.status(201).json({ message: 'Mesajınız iletildi. En kısa sürede dönüş yapılacaktır.' });
  } catch (err) {
    console.error('[Messages] Kayıt hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/messages/stats - okunmamış sayısı (admin) — önce tanımlanmalı
router.get('/stats', auth, async (req, res) => {
  try {
    const total = await db.getAsync('SELECT COUNT(*) as cnt FROM messages');
    const unread = await db.getAsync('SELECT COUNT(*) as cnt FROM messages WHERE is_read = 0');
    res.json({ total: total.cnt, unread: unread.cnt });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// GET /api/messages - tüm mesajlar (admin)
router.get('/', auth, async (req, res) => {
  try {
    const { unread } = req.query;
    let query = 'SELECT * FROM messages WHERE 1=1';
    const params = [];
    if (unread === '1') { query += ' AND is_read = 0'; }
    query += ' ORDER BY created_at DESC';
    const messages = await db.allAsync(query, params);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// PUT /api/messages/:id/read - okundu işaretle (admin)
router.put('/:id/read', auth, async (req, res) => {
  try {
    const result = await db.runAsync('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    res.json({ message: 'Okundu olarak işaretlendi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// DELETE /api/messages/:id (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await db.runAsync('DELETE FROM messages WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Mesaj bulunamadı.' });
    res.json({ message: 'Mesaj silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
