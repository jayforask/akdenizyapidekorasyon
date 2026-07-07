const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const path    = require('path');
const fs      = require('fs');
const db      = require('../database');
const auth    = require('../middleware/auth');

/* ── Upload ayarı ─────────────────────────────────────────────── */
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../uploads/projects');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `project_${Date.now()}_${Math.random().toString(36).slice(2,7)}${ext}`);
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

/* Slug üretici */
function makeSlug(text) {
  return text.toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c')
    .replace(/[^a-z0-9]/g,'-').replace(/-+/g,'-').replace(/^-|-$/g,'');
}

/* Benzersiz slug üret — PostgreSQL $1/$2 parametreleri */
async function uniqueSlug(base, excludeId = null) {
  let slug = base, i = 1;
  while (true) {
    const q = excludeId
      ? 'SELECT id FROM projects WHERE slug = $1 AND id != $2'
      : 'SELECT id FROM projects WHERE slug = $1';
    const params = excludeId ? [slug, excludeId] : [slug];
    const row = await db.getAsync(q, params);
    if (!row) return slug;
    slug = `${base}-${i++}`;
  }
}

/* Eski dosyaları sil */
function deleteFile(filePath) {
  if (!filePath) return;
  const abs = path.join(__dirname, '..', filePath);
  if (fs.existsSync(abs)) fs.unlinkSync(abs);
}

/* ── GET /api/projects — liste (public) ───────────────────────── */
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

/* ── GET /api/projects/:slugOrId — detay (public) ─────────────── */
router.get('/:slugOrId', async (req, res) => {
  try {
    const val = req.params.slugOrId;
    const isNum = /^\d+$/.test(val);
    const project = isNum
      ? await db.getAsync('SELECT * FROM projects WHERE id = ?', [val])
      : await db.getAsync('SELECT * FROM projects WHERE slug = ?', [val]);
    if (!project) return res.status(404).json({ error: 'Proje bulunamadı.' });
    res.json(project);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

/* ── POST /api/projects — ekle (admin) ────────────────────────── */
router.post('/', auth, upload.fields([
  { name: 'image',   maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), async (req, res) => {
  try {
    const {
      title, location, description, detail_text,
      year, area, service_type, client,
      featured, sort_order
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Proje başlığı gerekli.' });

    const slug = await uniqueSlug(makeSlug(title));

    /* Ana görsel */
    const image = req.files?.image?.[0]
      ? `/uploads/projects/${req.files.image[0].filename}`
      : null;

    /* Galeri görselleri — JSON array olarak sakla */
    const galleryPaths = (req.files?.gallery || []).map(f => `/uploads/projects/${f.filename}`);
    const gallery = galleryPaths.length ? JSON.stringify(galleryPaths) : null;

    const result = await db.runAsync(
      `INSERT INTO projects
         (title, slug, location, description, detail_text, image, gallery,
          year, area, service_type, client, featured, sort_order)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        title, slug,
        location || null, description || null, detail_text || null,
        image, gallery,
        year ? parseInt(year) : null,
        area || null, service_type || null, client || null,
        featured === '1' ? 1 : 0,
        parseInt(sort_order) || 0
      ]
    );

    const created = await db.getAsync('SELECT * FROM projects WHERE id = ?', [result.lastID]);
    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

/* ── PUT /api/projects/:id — güncelle (admin) ─────────────────── */
router.put('/:id', auth, upload.fields([
  { name: 'image',   maxCount: 1 },
  { name: 'gallery', maxCount: 10 }
]), async (req, res) => {
  try {
    const {
      title, location, description, detail_text,
      year, area, service_type, client,
      featured, sort_order,
      remove_gallery  /* virgülle ayrılmış silinecek galeri index'leri */
    } = req.body;

    if (!title) return res.status(400).json({ error: 'Proje başlığı gerekli.' });

    const existing = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });

    /* Slug güncelle */
    const newSlugBase = makeSlug(title);
    const slug = (existing.title === title && existing.slug)
      ? existing.slug
      : await uniqueSlug(newSlugBase, existing.id);

    /* Ana görsel */
    let image = existing.image;
    if (req.files?.image?.[0]) {
      deleteFile(existing.image);
      image = `/uploads/projects/${req.files.image[0].filename}`;
    }

    /* Galeri: mevcut listeyi oku, silinecekleri çıkar, yenileri ekle */
    let galleryArr = [];
    try { galleryArr = JSON.parse(existing.gallery || '[]'); } catch { galleryArr = []; }

    /* remove_gallery: "0,2" gibi index listesi */
    if (remove_gallery) {
      const removeIdxs = String(remove_gallery).split(',').map(Number);
      const removed = removeIdxs.map(i => galleryArr[i]).filter(Boolean);
      removed.forEach(deleteFile);
      galleryArr = galleryArr.filter((_, i) => !removeIdxs.includes(i));
    }

    /* Yeni galeri fotoğraflarını ekle */
    const newGallery = (req.files?.gallery || []).map(f => `/uploads/projects/${f.filename}`);
    galleryArr = [...galleryArr, ...newGallery];
    const gallery = galleryArr.length ? JSON.stringify(galleryArr) : null;

    await db.runAsync(
      `UPDATE projects SET
         title=?, slug=?, location=?, description=?, detail_text=?,
         image=?, gallery=?, year=?, area=?, service_type=?, client=?,
         featured=?, sort_order=?
       WHERE id=?`,
      [
        title, slug,
        location || null, description || null, detail_text || null,
        image, gallery,
        year ? parseInt(year) : null,
        area || null, service_type || null, client || null,
        featured === '1' ? 1 : 0,
        parseInt(sort_order) || 0,
        req.params.id
      ]
    );

    const updated = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

/* ── DELETE /api/projects/:id (admin) ─────────────────────────── */
router.delete('/:id', auth, async (req, res) => {
  try {
    const existing = await db.getAsync('SELECT * FROM projects WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'Proje bulunamadı.' });

    deleteFile(existing.image);
    try {
      const gallery = JSON.parse(existing.gallery || '[]');
      gallery.forEach(deleteFile);
    } catch {}

    await db.runAsync('DELETE FROM projects WHERE id = ?', [req.params.id]);
    res.json({ message: 'Proje silindi.' });
  } catch (err) {
    res.status(500).json({ error: 'Sunucu hatası: ' + err.message });
  }
});

module.exports = router;
