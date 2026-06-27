const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'akdeniz_yapi.db');

const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Veritabanı açılamadı:', err.message);
    process.exit(1);
  }
});

// Promise yardımcıları
db.getAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)))
  );

db.allAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)))
  );

db.runAsync = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve({ lastID: this.lastID, changes: this.changes });
    })
  );

db.execAsync = (sql) =>
  new Promise((resolve, reject) =>
    db.exec(sql, (err) => (err ? reject(err) : resolve()))
  );

async function initDatabase() {
  // WAL modu
  await db.runAsync('PRAGMA journal_mode = WAL');
  await db.runAsync('PRAGMA foreign_keys = ON');

  // Kategoriler
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      icon TEXT DEFAULT '🔧',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Hizmetler
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS services (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      short_desc TEXT,
      description TEXT,
      image TEXT,
      featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    )
  `);

  // Referans Projeler
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      location TEXT,
      description TEXT,
      image TEXT,
      featured INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // İletişim Mesajları
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT,
      email TEXT,
      subject TEXT,
      message TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Admin Kullanıcıları
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Site Ayarları (key-value)
  await db.runAsync(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Varsayılan admin kullanıcısı
  const existingAdmin = await db.getAsync('SELECT id FROM admin_users WHERE username = ?', ['admin']);
  if (!existingAdmin) {
    const hash = bcrypt.hashSync('admin123', 10);
    await db.runAsync('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)', ['admin', hash]);
    console.log('✅ Varsayılan admin oluşturuldu: admin / admin123');
  }

  // Varsayılan site ayarları
  const defaultSettings = [
    ['site_title', 'Akdeniz Yapı Dekorasyon'],
    ['site_slogan', 'Yapınıza Değer Katıyoruz'],
    ['phone1', '0530 936 10 17'],
    ['phone2', '0535 876 35 04'],
    ['phone3', '0505 086 98 07'],
    ['whatsapp', '905309361017'],
    ['instagram', 'akdeniz.yapidekorasyon'],
    ['address', 'Antalya, Türkiye'],
    ['email', 'info@akdenizyapi.com'],
    ['about_text', 'Firmamız ısı, su, ses, yangın yalıtımı yanı sıra iç-dış boya, alçı, kartonpiyer, asma tavan, çatı, asansör revizyon, drenaj, seramik-mermer uygulamaları ve tadilat alanlarında faaliyetlerini sürdürmektedir.'],
    ['vision', 'Tam memnuniyet için kaliteli, güvenilir, konforlu yaşatılabilecek yalıtımları sunmak; müşterilerimiz, tedarikçilerimiz, iş ortaklarımızla uyumlu ve huzur içinde ticari faaliyetlerimizi devam ettirmek.'],
    ['mission', 'Kaliteli işler çıkartmak için teknik iş gücünün gelişmesine katkıda bulunarak, sürekli yenilikçi çözümler getirmek ve daimi müşteri memnuniyeti ile sektörde zirveye ulaşmak.'],
  ];

  for (const [key, value] of defaultSettings) {
    await db.runAsync('INSERT OR IGNORE INTO site_settings (key, value) VALUES (?, ?)', [key, value]);
  }

  // Varsayılan kategoriler
  const catRow = await db.getAsync('SELECT COUNT(*) as cnt FROM categories');
  if (!catRow || catRow.cnt === 0) {
    const cats = [
      ['Isı Yalıtımı', 'isi-yalitimi', '🏠'],
      ['Su Yalıtımı', 'su-yalitimi', '💧'],
      ['Boya & Sıva', 'boya-siva', '🎨'],
      ['Alçı & Dekorasyon', 'alci-dekorasyon', '✨'],
      ['Çatı', 'cati', '🏗️'],
      ['Seramik & Mermer', 'seramik-mermer', '🪨'],
      ['Tadilat', 'tadilat', '🔨'],
    ];
    for (const [name, slug, icon] of cats) {
      await db.runAsync('INSERT INTO categories (name, slug, icon) VALUES (?, ?, ?)', [name, slug, icon]);
    }
  }

  // Varsayılan referanslar
  const projRow = await db.getAsync('SELECT COUNT(*) as cnt FROM projects');
  if (!projRow || projRow.cnt === 0) {
    const projects = [
      ['Bayındır Pınarlar Sitesi', 'Antalya', 'Dış cephe mantolama ve mineral sıva uygulaması', 1],
      ['AYT Park Villa Sitesi', 'Antalya', 'Isı yalıtımı ve boya uygulaması', 1],
      ['Ergin Sitesi', 'Antalya', 'Dış cephe yenileme ve mineral sıva', 0],
      ['Özcağatay Apt.', 'Antalya', 'Tamiratlı boya ve dış cephe uygulaması', 0],
      ['Varsak Güneş Konakları', 'Antalya', 'Tam cephe yenileme projesi', 1],
      ['Bayram Yanık Apt.', 'Antalya', 'Mineral sıva ve boya', 0],
      ['Anadolu Sitesi', 'Antalya', 'Dış cephe mantolama', 0],
      ['Koza Sitesi', 'Antalya', 'Isı yalıtımı ve renklendirme', 0],
      ['Bileydı Konakları', 'Antalya', 'Kapsamlı cephe yenileme', 0],
      ['Sarı İsmail Apt.', 'Antalya', 'Boya ve onarım', 0],
      ['Huzur Apt.', 'Antalya', 'Dış cephe boya uygulaması', 0],
      ['Sarısu Klas Sitesi', 'Antalya', 'Mineral sıva ve boya sistemi', 1],
    ];
    for (const [title, location, description, featured] of projects) {
      await db.runAsync(
        'INSERT INTO projects (title, location, description, featured) VALUES (?, ?, ?, ?)',
        [title, location, description, featured]
      );
    }
  }

  console.log('✅ Veritabanı hazır:', DB_PATH);
}

// initDatabase'i başlat, hata varsa logla
initDatabase().catch((err) => {
  console.error('❌ Veritabanı başlatma hatası:', err.message);
  process.exit(1);
});

module.exports = db;
