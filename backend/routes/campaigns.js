const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');
const auth    = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/campaigns');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `campaign_${Date.now()}${ext}`);
  }
});
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];
const ALLOWED_EXTS  = /\.(jpeg|jpg|png|webp)$/i;

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIMES.includes(file.mimetype) && ALLOWED_EXTS.test(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPG, PNG ve WebP kabul edilir.'));
    }
  }
});

// GET /api/campaigns (public) — aktif kampanyalar; ?all=1 sadece admin
router.get('/', async (req, res) => {
  try {
    const { all } = req.query;
    // ?all=1 ile pasif kampanyaları görmek admin yetkisi gerektirir
    if (all === '1') {
      const authHeader = req.headers['authorization'];
      const token = authHeader && authHeader.split(' ')[1];
      if (!token) return res.status(401).json({ error: 'Yetkisiz erişim.' });
      try {
        require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
      } catch {
        return res.status(403).json({ error: 'Token geçersiz.' });
      }
    }
    let query = 'SELECT * FROM campaigns WHERE 1=1';
    if (all !== '1') query += ' AND active = 1';
    query += ' ORDER BY sort_order ASC, created_at DESC';
    const rows = await db.allAsync(query);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// GET /api/campaigns/:id (public) — sadece aktif kampanyalar; admin tümünü görebilir
router.get('/:id', async (req, res) => {
  try {
    // Admin token varsa pasif kampanyayı da görebilir
    let isAdmin = false;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    if (token) {
      try {
        require('jsonwebtoken').verify(token, process.env.JWT_SECRET);
        isAdmin = true;
      } catch { /* geçersiz token → public erişim */ }
    }

    const query = isAdmin
      ? 'SELECT * FROM campaigns WHERE id = ?'
      : 'SELECT * FROM campaigns WHERE id = ? AND active = 1';

    const row = await db.getAsync(query, [req.params.id]);
    if (!row) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    res.json(row);
  } catch (err) {
    console.error('[Campaigns] GET /:id hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/campaigns (admin)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, badge_text, badge_color, old_price, new_price,
            discount_text, days_left, active, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Başlık gerekli.' });
    const image = req.file ? `/uploads/campaigns/${req.file.filename}` : null;
    const result = await db.runAsync(
      `INSERT INTO campaigns
       (title, description, badge_text, badge_color, old_price, new_price,
        discount_text, days_left, image, active, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, description || null, badge_text || null, badge_color || 'red',
       old_price || null, new_price || null, discount_text || null,
       parseInt(days_left) || 30, image,
       active === '0' ? 0 : 1, parseInt(sort_order) || 0]
    );
    const created = await db.getAsync('SELECT * FROM campaigns WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// PUT /api/campaigns/:id (admin)
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, description, badge_text, badge_color, old_price, new_price,
            discount_text, days_left, active, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Başlık gerekli.' });
    const existing = await db.getAsync('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    const image = req.file ? `/uploads/campaigns/${req.file.filename}` : existing.image;
    if (req.file && existing.image) {
      const old = path.join(__dirname, '..', existing.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    await db.runAsync(
      `UPDATE campaigns SET title=?, description=?, badge_text=?, badge_color=?,
       old_price=?, new_price=?, discount_text=?, days_left=?, image=?, active=?, sort_order=?
       WHERE id=?`,
      [title, description || null, badge_text || null, badge_color || 'red',
       old_price || null, new_price || null, discount_text || null,
       parseInt(days_left) || 30, image,
       active === '0' ? 0 : 1, parseInt(sort_order) || 0, req.params.id]
    );
    const updated = await db.getAsync('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// DELETE /api/campaigns/:id (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM campaigns WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Kampanya bulunamadı.' });
    if (existing.image) {
      const p = path.join(__dirname, '..', existing.image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await db.runAsync('DELETE FROM campaigns WHERE id = ?', [req.params.id]);
    res.json({ message: 'Kampanya silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
