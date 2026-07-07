const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// SQLite ile aynı API'yi koruyoruz — route dosyaları değişmesin
const db = {
  // Tek satır döner
  getAsync: async (sql, params = []) => {
    const pgSql = toPostgres(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows[0] || null;
  },

  // Çok satır döner
  allAsync: async (sql, params = []) => {
    const pgSql = toPostgres(sql);
    const { rows } = await pool.query(pgSql, params);
    return rows;
  },

  // INSERT/UPDATE/DELETE — { lastID, changes } döner (SQLite compat)
  runAsync: async (sql, params = []) => {
    const pgSql = toPostgres(sql);
    const { rows, rowCount } = await pool.query(pgSql, params);
    return {
      lastID: rows[0]?.id ?? null,
      changes: rowCount,
    };
  },

  // Toplu SQL (init için)
  execAsync: async (sql) => {
    await pool.query(sql);
  },
};

// SQLite ? parametrelerini PostgreSQL $1, $2... formatına çevirir
function toPostgres(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

async function initDatabase() {
  // Kategoriler
  await pool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      slug       TEXT NOT NULL UNIQUE,
      icon       TEXT DEFAULT '🔧',
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Hizmetler
  await pool.query(`
    CREATE TABLE IF NOT EXISTS services (
      id          SERIAL PRIMARY KEY,
      category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
      title       TEXT NOT NULL,
      slug        TEXT NOT NULL UNIQUE,
      short_desc  TEXT,
      description TEXT,
      image       TEXT,
      featured    INTEGER DEFAULT 0,
      sort_order  INTEGER DEFAULT 0,
      created_at  TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Referans Projeler
  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id           SERIAL PRIMARY KEY,
      title        TEXT NOT NULL,
      slug         TEXT,
      location     TEXT,
      description  TEXT,
      detail_text  TEXT,
      image        TEXT,
      gallery      TEXT,
      year         INTEGER,
      area         TEXT,
      service_type TEXT,
      client       TEXT,
      featured     INTEGER DEFAULT 0,
      sort_order   INTEGER DEFAULT 0,
      created_at   TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // İletişim Mesajları
  await pool.query(`
    CREATE TABLE IF NOT EXISTS messages (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      phone      TEXT,
      email      TEXT,
      subject    TEXT,
      message    TEXT NOT NULL,
      is_read    INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Kampanyalar
  await pool.query(`
    CREATE TABLE IF NOT EXISTS campaigns (
      id            SERIAL PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT,
      badge_text    TEXT,
      badge_color   TEXT DEFAULT 'red',
      old_price     TEXT,
      new_price     TEXT,
      discount_text TEXT,
      days_left     INTEGER DEFAULT 30,
      image         TEXT,
      active        INTEGER DEFAULT 1,
      sort_order    INTEGER DEFAULT 0,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Admin Kullanıcıları
  await pool.query(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id            SERIAL PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at    TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Site Ayarları
  await pool.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  // Varsayılan admin
  const existingAdmin = await db.getAsync('SELECT id FROM admin_users WHERE username = $1', ['admin']);
  if (!existingAdmin) {
    const hash = await bcrypt.hash('admin123', 10);
    await pool.query('INSERT INTO admin_users (username, password_hash) VALUES ($1, $2)', ['admin', hash]);
    console.log('✅ Varsayılan admin oluşturuldu: admin / admin123');
  }

  // Varsayılan site ayarları
  const defaultSettings = [
    ['site_title',   'Akdeniz Yapı Dekorasyon'],
    ['site_slogan',  'Yapınıza Değer Katıyoruz'],
    ['phone1',       '0530 936 10 17'],
    ['phone2',       '0535 876 35 04'],
    ['phone3',       '0505 086 98 07'],
    ['whatsapp',     '905309361017'],
    ['instagram',    'akdeniz.yapidekorasyon'],
    ['address',      'Antalya, Türkiye'],
    ['email',        'info@akdenizyapi.com'],
    ['about_text',   'Firmamız ısı, su, ses, yangın yalıtımı yanı sıra iç-dış boya, alçı, kartonpiyer, asma tavan, çatı, asansör revizyon, drenaj, seramik-mermer uygulamaları ve tadilat alanlarında faaliyetlerini sürdürmektedir.'],
    ['vision',       'Tam memnuniyet için kaliteli, güvenilir, konforlu yaşatılabilecek yalıtımları sunmak; müşterilerimiz, tedarikçilerimiz, iş ortaklarımızla uyumlu ve huzur içinde ticari faaliyetlerimizi devam ettirmek.'],
    ['mission',      'Kaliteli işler çıkartmak için teknik iş gücünün gelişmesine katkıda bulunarak, sürekli yenilikçi çözümler getirmek ve daimi müşteri memnuniyeti ile sektörde zirveye ulaşmak.'],
  ];
  for (const [key, value] of defaultSettings) {
    await pool.query(
      `INSERT INTO site_settings (key, value) VALUES ($1, $2)
       ON CONFLICT (key) DO NOTHING`,
      [key, value]
    );
  }

  // Varsayılan kategoriler
  const { rows: catRows } = await pool.query('SELECT COUNT(*) AS cnt FROM categories');
  if (parseInt(catRows[0].cnt) === 0) {
    const cats = [
      ['Isı Yalıtımı',      'isi-yalitimi',    '🏠'],
      ['Su Yalıtımı',       'su-yalitimi',     '💧'],
      ['Boya & Sıva',       'boya-siva',        '🎨'],
      ['Alçı & Dekorasyon', 'alci-dekorasyon',  '✨'],
      ['Çatı',              'cati',             '🏗️'],
      ['Seramik & Mermer',  'seramik-mermer',   '🪨'],
      ['Tadilat',           'tadilat',          '🔨'],
    ];
    for (const [name, slug, icon] of cats) {
      await pool.query(
        'INSERT INTO categories (name, slug, icon) VALUES ($1, $2, $3) ON CONFLICT (slug) DO NOTHING',
        [name, slug, icon]
      );
    }
  }

  // Varsayılan hizmetler
  const { rows: svcRows } = await pool.query('SELECT COUNT(*) AS cnt FROM services');
  if (parseInt(svcRows[0].cnt) === 0) {
    const getCatId = async (slug) => {
      const row = await db.getAsync('SELECT id FROM categories WHERE slug = $1', [slug]);
      return row ? row.id : null;
    };

    const services = [
      ['Dış Cephe Isı Yalıtımı (EPS Mantolama)', 'dis-cephe-isi-yalitimi', 'isi-yalitimi',
        'Enerji tasarrufu sağlayan, ısı kaybını %50\'ye kadar azaltan EPS levha mantolama sistemi.',
        'Dış cephe ısı yalıtımı, binanın enerji verimliliğini artırmak ve ısı kayıplarını önlemek amacıyla uygulanan en etkili yöntemdir.', 1, 1],
      ['Mineral Sıva Uygulaması', 'mineral-siva', 'isi-yalitimi',
        'Yüksek nefes alabilirlik, UV dayanımı ve estetik görünüm sunan mineral bazlı dış cephe sıvası.',
        'Mineral sıva; çimento bazlı, su itici ve hava geçirgen yapısıyla dış cephelerde uzun ömürlü koruma sağlar.', 1, 2],
      ['Su Yalıtımı & Termal Kaplama', 'su-yalitimi-termal', 'su-yalitimi',
        'Çatı, teras, balkon ve bodrum katı için poliüretan ve bitümlü membran su yalıtım sistemleri.',
        'Poliüretan likit membran, bitümlü örtü ve kristalize su yalıtımı yöntemleriyle yüzey tamamen su geçirmez hale getirilir.', 1, 3],
      ['İç & Dış Cephe Boyası', 'ic-dis-cephe-boyasi', 'boya-siva',
        'Filli Boya, DYO ve Marshall markalı A+ ürünlerle profesyonel iç ve dış cephe boya uygulaması.',
        'Deneyimli ekibimiz; yüzey temizliği, macun, astar ve kat boya süreçlerini eksiksiz uygular.', 1, 4],
      ['Alçı & Kartonpiyer', 'alci-kartonpiyer', 'alci-dekorasyon',
        'Asma tavan, kartonpiyer ve alçı sıva uygulamaları ile mekanlara estetik ve modern bir görünüm kazandırıyoruz.',
        'Alçı levha, alçı sıva ve dekoratif kartonpiyer uygulamalarında geniş model yelpazemiz ile mekanınızı dönüştürüyoruz.', 0, 5],
      ['Çatı Onarım & Yenileme', 'cati-onarim', 'cati',
        'Kiremit çatı, shingle ve termoizole çatı sistemleri; sızdırmazlık garantisiyle onarım ve yenileme.',
        'Çatı muayenesi, kiremit değişimi, mahya çimento yenileme ve çatı altı yalıtımı hizmetlerimiz kapsamındadır.', 0, 6],
      ['Seramik & Mermer Döşeme', 'seramik-mermer', 'seramik-mermer',
        'Zemin ve duvar seramik, granit ve mermer kaplama uygulamaları; kesim, döşeme ve derz dahil.',
        'İç mekan zemin ve duvar kaplamalarında seramik, granit, mermer ve mozaik uygulamaları yapılmaktadır.', 0, 7],
      ['Komple Tadilat & Renovasyon', 'komple-tadilat', 'tadilat',
        'Daire, villa ve ticari alanlarda anahtar teslim komple tadilat; elektrik, sıhhi tesisat dahil.',
        'Konut ve ticari mekan tadilatlarında mimari proje desteği, malzeme tedariki ve uygulama hizmetleri sunulmaktadır.', 1, 8],
    ];

    for (const [title, slug, catSlug, short_desc, description, featured, sort_order] of services) {
      const category_id = await getCatId(catSlug);
      await pool.query(
        `INSERT INTO services (title, slug, category_id, short_desc, description, featured, sort_order)
         VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (slug) DO NOTHING`,
        [title, slug, category_id, short_desc, description, featured, sort_order]
      );
    }
    console.log('✅ Varsayılan hizmetler eklendi.');
  }

  // Varsayılan referanslar
  const { rows: projRows } = await pool.query('SELECT COUNT(*) AS cnt FROM projects');
  if (parseInt(projRows[0].cnt) === 0) {
    const projects = [
      ['Bayındır Pınarlar Sitesi', 'Antalya', 'Dış cephe mantolama ve mineral sıva uygulaması', 1],
      ['AYT Park Villa Sitesi',    'Antalya', 'Isı yalıtımı ve boya uygulaması', 1],
      ['Ergin Sitesi',             'Antalya', 'Dış cephe yenileme ve mineral sıva', 0],
      ['Özcağatay Apt.',           'Antalya', 'Tamiratlı boya ve dış cephe uygulaması', 0],
      ['Varsak Güneş Konakları',   'Antalya', 'Tam cephe yenileme projesi', 1],
      ['Bayram Yanık Apt.',        'Antalya', 'Mineral sıva ve boya', 0],
      ['Anadolu Sitesi',           'Antalya', 'Dış cephe mantolama', 0],
      ['Koza Sitesi',              'Antalya', 'Isı yalıtımı ve renklendirme', 0],
      ['Bileydı Konakları',        'Antalya', 'Kapsamlı cephe yenileme', 0],
      ['Sarı İsmail Apt.',         'Antalya', 'Boya ve onarım', 0],
      ['Huzur Apt.',               'Antalya', 'Dış cephe boya uygulaması', 0],
      ['Sarısu Klas Sitesi',       'Antalya', 'Mineral sıva ve boya sistemi', 1],
    ];
    for (const [title, location, description, featured] of projects) {
      await pool.query(
        'INSERT INTO projects (title, location, description, featured) VALUES ($1, $2, $3, $4)',
        [title, location, description, featured]
      );
    }
  }

  console.log('✅ Veritabanı hazır (PostgreSQL)');
}

initDatabase().catch((err) => {
  console.error('❌ Veritabanı başlatma hatası:', err.message);
  process.exit(1);
});

module.exports = db;
