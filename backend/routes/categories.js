const express = require('express');
const router = express.Router();
const db = require('../database');
const auth = require('../middleware/auth');

function makeSlug(name) {
  return name.toLowerCase()
    .replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's')
    .replace(/ı/g, 'i').replace(/ö/g, 'o').replace(/ç/g, 'c')
    .replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

// GET /api/categories - tüm kategoriler (public), hizmet sayısı dahil
router.get('/', async (req, res) => {
  try {
    const cats = await db.allAsync(`
      SELECT c.*,
             COUNT(s.id) AS service_count
      FROM categories c
      LEFT JOIN services s ON s.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name ASC
    `);
    res.json(cats);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// POST /api/categories - yeni kategori (admin)
router.post('/', auth, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Kategori adı gerekli.' });
    const slug = makeSlug(name);
    const result = await db.runAsync(
      'INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)',
      [name, slug, icon || '🔧']
    );
    const created = await db.getAsync('SELECT * FROM categories WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(409).json({ error: 'Bu kategori adı zaten mevcut.' });
    }
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// PUT /api/categories/:id - kategori güncelle (admin)
router.put('/:id', auth, async (req, res) => {
  try {
    const { name, icon } = req.body;
    if (!name) return res.status(400).json({ error: 'Kategori adı gerekli.' });
    const slug = makeSlug(name);
    const result = await db.runAsync(
      'UPDATE categories SET name = ?, slug = ?, icon = ? WHERE id = ?',
      [name, slug, icon || '🔧', req.params.id]
    );
    if (result.changes === 0) return res.status(404).json({ error: 'Kategori bulunamadı.' });
    const updated = await db.getAsync('SELECT * FROM categories WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// DELETE /api/categories/:id - kategori sil (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const result = await db.runAsync('DELETE FROM categories WHERE id = ?', [req.params.id]);
    if (result.changes === 0) return res.status(404).json({ error: 'Kategori bulunamadı.' });
    res.json({ message: 'Kategori silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
