# Akdeniz Yapı Dekorasyon — Kurumsal Web Sitesi

Akdeniz Yapı Dekorasyon firması için hazırlanmış tam kapsamlı kurumsal web sitesi ve yönetim paneli.

## 🚀 Hızlı Başlangıç

```bash
cd yunusumyunusum
npm install
npm start
```

Tarayıcıda aç:
- **Site:** http://localhost:3000
- **Admin Panel:** http://localhost:3000/admin

## 🔐 Admin Girişi

| Alan | Değer |
|------|-------|
| Kullanıcı Adı | `admin` |
| Şifre | `admin123` |

> ⚠️ İlk girişten sonra **Şifre Değiştir** sayfasından şifrenizi güncelleyin.

## 📁 Proje Yapısı

```
yunusumyunusum/
├── backend/
│   ├── server.js          # Express sunucu
│   ├── database.js        # SQLite veritabanı
│   ├── .env               # Ortam değişkenleri
│   ├── middleware/
│   │   └── auth.js        # JWT doğrulama
│   ├── routes/
│   │   ├── auth.js        # Giriş / şifre değiştir
│   │   ├── categories.js  # Kategori CRUD
│   │   ├── services.js    # Hizmet CRUD + görsel yükleme
│   │   ├── projects.js    # Referans CRUD + görsel yükleme
│   │   ├── messages.js    # İletişim mesajları
│   │   └── settings.js    # Site ayarları + istatistikler
│   └── uploads/           # Yüklenen görseller
├── frontend/
│   ├── index.html         # Ana sayfa
│   ├── hizmetler.html     # Hizmetler
│   ├── hizmet-detay.html  # Hizmet detayı
│   ├── referanslar.html   # Referanslar
│   ├── iletisim.html      # İletişim
│   ├── style.css          # Beyaz tema, mobil responsive
│   └── js/main.js         # Frontend JavaScript
└── admin/
    ├── login.html         # Admin girişi
    ├── dashboard.html     # İstatistikler
    ├── hizmetler.html     # Hizmet yönetimi
    ├── kategoriler.html   # Kategori yönetimi
    ├── referanslar.html   # Referans yönetimi
    ├── mesajlar.html      # Mesaj yönetimi
    ├── ayarlar.html       # Site ayarları
    ├── sifre.html         # Şifre değiştirme
    ├── admin.css          # Admin panel stili
    └── admin.js           # Admin ortak fonksiyonlar
```

## 🛠️ Teknolojiler

| Katman | Teknoloji |
|--------|-----------|
| Backend | Node.js + Express |
| Veritabanı | SQLite (`sqlite3`) |
| Kimlik Doğrulama | JWT + bcryptjs |
| Dosya Yükleme | Multer (5MB limit, JPG/PNG/WebP) |
| Frontend | Vanilla HTML/CSS/JS |
| Tema | Beyaz + Altın, Mobil-first |

## 🌐 API Endpoint'leri

```
POST   /api/auth/login
POST   /api/auth/change-password
GET    /api/auth/verify

GET    /api/categories
POST   /api/categories          (admin)
PUT    /api/categories/:id      (admin)
DELETE /api/categories/:id      (admin)

GET    /api/services
GET    /api/services/:slug
POST   /api/services            (admin)
PUT    /api/services/:id        (admin)
DELETE /api/services/:id        (admin)

GET    /api/projects
GET    /api/projects/:id
POST   /api/projects            (admin)
PUT    /api/projects/:id        (admin)
DELETE /api/projects/:id        (admin)

POST   /api/messages            (public - iletişim formu)
GET    /api/messages            (admin)
GET    /api/messages/stats      (admin)
PUT    /api/messages/:id/read   (admin)
DELETE /api/messages/:id        (admin)

GET    /api/settings            (public)
PUT    /api/settings            (admin)
GET    /api/settings/stats      (admin)
```

## 📞 Firma İletişim Bilgileri

| Kişi | Görev | Telefon |
|------|-------|---------|
| Yunus Demirel | Firma Yetkilisi | 0530 936 10 17 |
| Adem Demirel | Firma Yetkilisi | 0535 876 35 04 |
| Serhat Sincar | İnşaat Mühendisi | 0505 086 98 07 |

- **Instagram:** @akdeniz.yapidekorasyon
- **WhatsApp:** 905309361017

## ⚙️ Ortam Değişkenleri (`.env`)

```env
PORT=3000
JWT_SECRET=akdeniz_yapi_super_secret_key_2024
JWT_EXPIRES_IN=24h
```

## 📱 Mobil Uyumluluk

Site %80 mobil kullanım göz önünde tutularak tasarlanmıştır:
- Mobile-first CSS yaklaşımı
- Hamburger menü (768px altı)
- Touch-friendly butonlar (min 48px)
- Responsive grid (1 kolon → çoklu kolon)
- Sabit WhatsApp butonu (tüm sayfalarda)
