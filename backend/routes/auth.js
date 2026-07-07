const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const db      = require('../database');

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Kullanıcı adı ve şifre gerekli.' });
    }

    const user = await db.getAsync('SELECT * FROM admin_users WHERE username = ?', [username]);
    if (!user) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    // ✅ Async bcrypt.compare (blocking olmayan, timing-safe)
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Kullanıcı adı veya şifre hatalı.' });
    }

    const token = jwt.sign(
      { id: user.id, username: user.username },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({ token, username: user.username });
  } catch (err) {
    // ✅ err.message sızdırılmıyor — iç detay gizli
    console.error('[Auth] Login hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// POST /api/auth/change-password
router.post('/change-password', require('../middleware/auth'), async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Mevcut ve yeni şifre gerekli.' });
    }
    // ✅ Minimum şifre uzunluğu 8 karakter
    if (newPassword.length < 8) {
      return res.status(400).json({ error: 'Yeni şifre en az 8 karakter olmalı.' });
    }

    const user = await db.getAsync('SELECT * FROM admin_users WHERE id = ?', [req.user.id]);
    // ✅ Async bcrypt.compare
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Mevcut şifre hatalı.' });
    }

    // ✅ Async bcrypt.hash
    const newHash = await bcrypt.hash(newPassword, 12);
    await db.runAsync('UPDATE admin_users SET password_hash = ? WHERE id = ?', [newHash, req.user.id]);

    res.json({ message: 'Şifre başarıyla güncellendi.' });
  } catch (err) {
    console.error('[Auth] Şifre değiştirme hatası:', err.message);
    res.status(500).json({ error: 'Sunucu hatası.' });
  }
});

// GET /api/auth/verify
router.get('/verify', require('../middleware/auth'), (req, res) => {
  res.json({ valid: true, username: req.user.username });
});

module.exports = router;
