const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/projects');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `project_${Date.now()}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/jpeg|jpg|png|webp/.test(path.extname(file.originalname).toLowerCase())) {
      cb(null, true);
    } else {
      cb(new Error('Sadece JPG, PNG ve WebP kabul edilir.'));
    }
  }
});

// GET /api/projects (public)
router.get('/', async (req, res) => {
  try {
    const { featured } = req.query;
    let query = 'SELECT * FROM projects WHERE 1=1';
    const params = [];
    if (featured === '1') { query += ' AND featured = 1'; }
    query += ' ORDER BY sort_order ASC, created_at DESC';
    const projects = await db.allAsync(query, params);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// GET /api/projects/:id (public)
router.get('/:id', async (req, res) => {
  try {
    const project = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// POST /api/projects (admin)
router.post('/', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, location, description, featured, sort_order } = req.body;
    if (!title) return res.status(400).json({ error: 'Proje başlığı gerekli.' });
    const image = req.file ? `/uploads/projects/${req.file.filename}` : null;
    const result = await db.runAsync(
      'INSERT INTO projects (title, location, description, image, featured, sort_order) VALUES (?, ?, ?, ?, ?, ?)',
      [title, location || null, description || null, image, featured === '1' ? 1 : 0, parseInt(sort_order) || 0]
    );
    const created = await db.getAsync('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// PUT /api/projects/:id (admin)
router.put('/:id', auth, upload.single('image'), async (req, res) => {
  try {
    const { title, location, description, featured, sort_order } = req.body;
    const existing = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });
    const image = req.file ? `/uploads/projects/${req.file.filename}` : existing.image;
    if (req.file && existing.image) {
      const old = path.join(__dirname, '..', existing.image);
      if (fs.existsSync(old)) fs.unlinkSync(old);
    }
    await db.runAsync(
      'UPDATE projects SET title=?, location=?, description=?, image=?, featured=?, sort_order=? WHERE id=?',
      [title, location || null, description || null, image,
       featured === '1' ? 1 : 0, parseInt(sort_order) || 0, req.params.id]
    );
    const updated = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

// DELETE /api/projects/:id (admin)
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });
    if (existing.image) {
      const p = path.join(__dirname, '..', existing.image);
      if (fs.existsSync(p)) fs.unlinkSync(p);
    }
    await db.runAsync('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Proje silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
