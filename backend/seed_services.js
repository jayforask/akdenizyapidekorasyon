/**
 * seed_services.js
 * Hizmetler tablosuna varsayılan verileri ekler.
 * Çalıştır: node seed_services.js
 */
const sqlite3 = require('sqlite3').verbose();
const path    = require('path');

const DB_PATH = path.join(__dirname, 'akdeniz_yapi.db');
const db = new sqlite3.Database(DB_PATH);

// Kategori slug → ID map
const catMap = {
  'isi-yalitimi':    1,
  'su-yalitimi':     2,
  'boya-siva':       3,
  'alci-dekorasyon': 4,
  'cati':            5,
  'seramik-mermer':  6,
  'tadilat':         7,
};

const services = [
  {
    category_id: catMap['isi-yalitimi'],
    title:       'Dış Cephe Isı Yalıtımı (EPS Mantolama)',
    slug:        'dis-cephe-isi-yalitimi',
    short_desc:  'Enerji tasarrufu sağlayan, ısı kaybını %50\'ye kadar azaltan EPS levha mantolama sistemi.',
    description: 'Dış cephe ısı yalıtımı, binanın enerji verimliliğini artırmak ve ısı kayıplarını önlemek amacıyla uygulanan en etkili yöntemdir. EPS (genleştirilmiş polistiren) levhalar yapıştırılarak mekanik dübel ile tespit edilir, ardından donatılı sıva ve mineral boya ile tamamlanır. 10 yıl garanti kapsamındadır. EKB belgesi ücretsiz verilir.',
    featured:    1,
    sort_order:  1,
  },
  {
    category_id: catMap['isi-yalitimi'],
    title:       'Mineral Sıva Uygulaması',
    slug:        'mineral-siva',
    short_desc:  'Yüksek nefes alabilirlik, UV dayanımı ve estetik görünüm sunan mineral bazlı dış cephe sıvası.',
    description: 'Mineral sıva; çimento bazlı, su itici ve hava geçirgen yapısıyla dış cephelerde uzun ömürlü koruma sağlar. Geniş renk skalası ile her mimari tarza uyum sağlar. Dona dayanıklı, çatlama direnci yüksek formülü sayesinde Antalya iklimine özel tercih edilmektedir.',
    featured:    1,
    sort_order:  2,
  },
  {
    category_id: catMap['su-yalitimi'],
    title:       'Su Yalıtımı & Termal Kaplama',
    slug:        'su-yalitimi-termal',
    short_desc:  'Çatı, teras ve balkon için poliüretan ve bitümlü membran su yalıtım sistemleri.',
    description: 'Poliüretan likit membran, bitümlü örtü ve kristalize su yalıtımı yöntemleriyle yüzey tamamen su geçirmez hale getirilir. Teras, çatı, balkon, garaj tavanı ve bodrum katlarda uygulanır. Garanti süresi 5-10 yıldır.',
    featured:    1,
    sort_order:  3,
  },
  {
    category_id: catMap['boya-siva'],
    title:       'İç & Dış Cephe Boyası',
    slug:        'ic-dis-cephe-boyasi',
    short_desc:  'Filli Boya, DYO ve Marshall markalı A+ ürünlerle profesyonel iç ve dış cephe boya uygulaması.',
    description: 'Deneyimli ekibimiz; yüzey temizliği, macun, astar ve kat boya süreçlerini eksiksiz uygular. İç mekanlarda ipek mat, saten ve antibakteriyel boya seçenekleri mevcuttur. Dış cephede su bazlı silikonlu veya akrilik boya kullanılır. Tüm işler sonrası temizlik hizmeti dahildir.',
    featured:    1,
    sort_order:  4,
  },
  {
    category_id: catMap['alci-dekorasyon'],
    title:       'Alçı & Kartonpiyer',
    slug:        'alci-kartonpiyer',
    short_desc:  'Asma tavan, kartonpiyer ve alçı sıva ile mekanlara estetik ve modern görünüm kazandırıyoruz.',
    description: 'Alçı levha, alçı sıva ve dekoratif kartonpiyer uygulamalarında geniş model yelpazemiz ile mekanınızı dönüştürüyoruz. Asma tavan sistemleri, LED aydınlatma entegrasyonu ile birlikte planlanır. Düz sıva ve alçı perdah işlemleri yüzey mükemmeliyetini garanti eder.',
    featured:    0,
    sort_order:  5,
  },
  {
    category_id: catMap['cati'],
    title:       'Çatı Onarım & Yenileme',
    slug:        'cati-onarim',
    short_desc:  'Kiremit çatı, shingle ve termoizole çatı sistemleri; sızdırmazlık garantisiyle onarım ve yenileme.',
    description: 'Çatı muayenesi, kiremit değişimi, mahya çimento yenileme ve çatı altı yalıtımı hizmetlerimiz kapsamındadır. Shingle (bitüm esaslı çatı) ve çelik profil çatı sistemleri kurulumunu da gerçekleştiriyoruz. Tüm işlemler sızdırmazlık garantisi ile teslim edilir.',
    featured:    0,
    sort_order:  6,
  },
  {
    category_id: catMap['seramik-mermer'],
    title:       'Seramik & Mermer Döşeme',
    slug:        'seramik-mermer-doseme',
    short_desc:  'Zemin ve duvar seramik, granit ve mermer kaplama uygulamaları; kesim, döşeme ve derz dahil.',
    description: 'İç mekan zemin ve duvar kaplamalarında seramik, granit, mermer ve mozaik uygulamaları yapılmaktadır. Banyo, mutfak, salon ve dış terasta her boyutta kaplama hizmeti verilir. Malzeme seçiminden döşemeye, derz dolgudan koruyucu cila uygulamasına kadar tüm süreç yönetilir.',
    featured:    0,
    sort_order:  7,
  },
  {
    category_id: catMap['tadilat'],
    title:       'Komple Tadilat & Renovasyon',
    slug:        'komple-tadilat',
    short_desc:  'Daire, villa ve ticari alanlarda anahtar teslim komple tadilat; elektrik, sıhhi tesisat dahil.',
    description: 'Konut ve ticari mekan tadilatlarında mimari proje desteği, malzeme tedariki ve uygulama hizmetleri sunulmaktadır. Boya, seramik, alçı, doğrama, elektrik ve sıhhi tesisat işleri koordineli ekip tarafından yürütülür. 3D tasarım desteği sözleşmeye dahildir.',
    featured:    1,
    sort_order:  8,
  },
];

db.serialize(() => {
  const stmt = db.prepare(
    `INSERT OR IGNORE INTO services
       (category_id, title, slug, short_desc, description, featured, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  );

  for (const s of services) {
    stmt.run(
      s.category_id, s.title, s.slug,
      s.short_desc, s.description,
      s.featured, s.sort_order,
      (err) => { if (err) console.error('Satır hatası:', s.slug, err.message); }
    );
  }

  stmt.finalize((err) => {
    if (err) { console.error('Finalize hatası:', err.message); db.close(); return; }
    db.get('SELECT COUNT(*) as cnt FROM services', (err2, row) => {
      if (err2) { console.error(err2.message); } else { console.log('Toplam hizmet:', row.cnt); }
      db.close();
    });
  });
});
