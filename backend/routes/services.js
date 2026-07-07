const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/services');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `service_${Date.now()}${ext}`);
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
      cb(new Error('Sadece JPG, PNG ve WebP dosyaları kabul edilir.'));
    }
  }
});

function makeSlug(text) {
  return text.toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/services (public)
router.get('/', async (req, res) => {
  try {
    const { category, featured } = req.query;
    let query = `
      SELECT s.*, c.name as category_name, c.icon as category_icon
      FROM services s
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE 1=1
    `;
    const params = [];
    if (category) { query += ' AND c.slug = ?'; params.push(category); }
    if (featured === '1') { query += ' AND s.featured = 1'; }
    query += ' ORDER BY s.sort_order ASC, s.created_at DESC';
    const services = await db.allAsync(query, params);
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// GET /api/services/:slug (public)
router.get('/:slug', async (req, res) => {
  try {
    const service = await db.getAsync(`
      SELECT s.*, c.name as category_name, c.icon as category_icon
      FROM services s
      LEFT JOIN categories c ON s.category_id = c.id
      WHERE s.slug = ?
    `, [req.params.slug]);
    if (!service) return res.status(404).json({ error: 'Hizmet bulunamadı.' });
    res.json(service);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// POST /api/services (admin)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, category_id, short_desc, description, featured, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Hizmet başlığı gerekli.' });
    const slug = makeSlug(title);
    const image = req.file ? `/uploads/services/${req.file.filename}` : null;
    const result = await db.runAsync(
      `INSERT INTO services (title, slug, category_id, short_desc, description, image, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [title, slug, category_id || null, short_desc || null, description || null,
       image, featured === '1' ? 1 : 0, parseInt(sort_order) || 0]
    );
    const created = await db.getAsync('SELECT * FROM services WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu hizmet adı zaten mevcut.' });
    }
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// PUT /api/services/:id (admin)
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, category_id, short_desc, description, featured, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Hizmet başlığı gerekli.' });
    const existing = await db.getAsync('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Hizmet bulunamadı.' });
    // Slug sabit kalır — URL'ler kırılmasın
    const image = req.file ? `/uploads/services/${req.file.filename}` : existing.image;
    if (req.file && existing.image) {
      const oldPath = path.join(__dirname, '..', existing.image);
      if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
    }
    await db.runAsync(
      `UPDATE services SET title=?, category_id=?, short_desc=?, description=?,
       image=?, featured=?, sort_order=? WHERE id=?`,
      [title, category_id || null, short_desc || null, description || null,
       image, featured === '1' ? 1 : 0, parseInt(sort_order) || 0, req.params.id]
    );
    const updated = await db.getAsync('SELECT * FROM services WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu hizmet adı zaten mevcut.' });
    }
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// DELETE /api/services/:id (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM services WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Hizmet bulunamadı.' });
    if (existing.image) {
      const imgPath = path.join(__dirname, '..', existing.image);
      if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
    }
    await db.runAsync('DELETE FROM services WHERE id = ?', [req.params.id]);
    res.json({ message: 'Hizmet silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
