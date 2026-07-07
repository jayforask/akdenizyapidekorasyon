const API = '/api';

// ── XSS koruması — kullanıcı/API verisini HTML'e basmadan önce escape et ─────
function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── Kategori bazlı varsayılan görseller (modül düzeyinde paylaşımlı) ─────────
const CAT_IMAGES = {
  'yalitim'   : 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=75&fit=crop',
  'mantolama' : 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=75&fit=crop',
  'boya'      : 'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=600&q=75&fit=crop',
  'alci'      : 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=75&fit=crop',
  'seramik'   : 'https://images.unsplash.com/photo-1615971677499-5467cbab01c0?w=600&q=75&fit=crop',
  'su'        : 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75&fit=crop',
  'cati'      : 'https://images.unsplash.com/photo-1632823471565-1ecdf5c6da11?w=600&q=75&fit=crop',
  'tadilat'   : 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=75&fit=crop',
  'default'   : 'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=600&q=75&fit=crop',
};

function getCatImage(slugOrName) {
  const s = (slugOrName || '').toLowerCase()
    .replace(/ğ/g,'g').replace(/ü/g,'u').replace(/ş/g,'s')
    .replace(/ı/g,'i').replace(/ö/g,'o').replace(/ç/g,'c');
  for (const [key, url] of Object.entries(CAT_IMAGES)) {
    if (key !== 'default' && s.includes(key)) return url;
  }
  return CAT_IMAGES.default;
}

// ── Yardımcı ─────────────────────────────────────────────────────────────────
async function fetchSettings() {
  try {
    const res = await fetch(`${API}/settings`);
    return await res.json();
  } catch { return {}; }
}

// Proje/hizmet açıklamasına göre Unsplash fotoğrafı seç
const PROJECT_IMAGES = [
  'https://images.unsplash.com/photo-1486325212027-8081e485255e?w=600&q=75&fit=crop', // bina dış cephe
  'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=600&q=75&fit=crop', // apartman
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=600&q=75&fit=crop', // yalıtım/inşaat
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=600&q=75&fit=crop', // bina cephe
  'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&q=75&fit=crop', // site/apartman blok
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&q=75&fit=crop', // modern bina
  'https://images.unsplash.com/photo-1582268611958-ebfd161ef9cf?w=600&q=75&fit=crop', // dış cephe boyalı
  'https://images.unsplash.com/photo-1567496898669-ee935f5f647a?w=600&q=75&fit=crop', // konut projesi
];

function imgSrc(p, seed) {
  if (p) return p;
  // seed (başlık/id) ile tutarlı ama farklı görsel seç
  const idx = seed
    ? Math.abs(String(seed).split('').reduce((a, c) => a + c.charCodeAt(0), 0)) % PROJECT_IMAGES.length
    : 0;
  return PROJECT_IMAGES[idx];
}

// ── Navbar scroll efekti ─────────────────────────────────────────────────────
window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (nav) nav.classList.toggle('scrolled', window.scrollY > 60);
});

// ── Mobil menü ───────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.getElementById('navToggle');
  const menu = document.getElementById('navMenu');
  if (toggle && menu) {
    toggle.addEventListener('click', () => menu.classList.toggle('open'));
  }

  // Aktif link
  const links = document.querySelectorAll('.nav-menu a');
  links.forEach(link => {
    if (link.href === window.location.href) link.classList.add('active');
  });

  // Sayfaya özgü init
  const page = document.body.dataset.page;
  if (page === 'home')    initHome();
  if (page === 'hizmetler') initHizmetler();
  if (page === 'detay')   initDetay();
  if (page === 'referanslar') initReferanslar();
  if (page === 'iletisim')  initIletisim();
});

// ── ANA SAYFA ────────────────────────────────────────────────────────────────
async function initHome() {
  loadCategories();
  loadFeaturedProjects();
  loadFeaturedCampaigns();
  applySettings();
}

// Kampanya görseli için fallback listesi
const CAMP_IMAGES = [
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?w=640&q=80&fit=crop',
  'https://images.unsplash.com/photo-1581858726788-75bc0f6a952d?w=640&q=80&fit=crop',
  'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=640&q=80&fit=crop',
  'https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=640&q=80&fit=crop',
  'https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=640&q=80&fit=crop',
];

async function loadFeaturedCampaigns() {
  const grid = document.getElementById('kampanyaPreviewGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/campaigns`);
    const camps = await res.json();
    if (!camps.length) {
      grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1;text-align:center;padding:32px 0;">Aktif kampanya bulunmuyor.</p>';
      return;
    }
    const badgeClass = { red: 'kamp-badge-red', green: 'kamp-badge-green', blue: 'kamp-badge-blue', gold: 'kamp-badge-gold' };
    grid.innerHTML = camps.slice(0, 3).map((c, i) => {
      const img = c.image ? c.image : CAMP_IMAGES[i % CAMP_IMAGES.length];
      const badge = c.badge_text ? `<span class="kamp-badge ${badgeClass[c.badge_color] || 'kamp-badge-red'}">${escapeHtml(c.badge_text)}</span>` : '';
      const timer = c.days_left ? `<div class="kamp-timer-tag"><i class="fas fa-clock"></i> ${escapeHtml(String(c.days_left))} Gün Kaldı</div>` : '';
      const priceRow = (c.new_price || c.old_price) ? `
        <div class="kamp-price-row">
          ${c.old_price ? `<span class="kamp-old">${escapeHtml(c.old_price)}</span>` : ''}
          ${c.new_price ? `<span class="kamp-new">${escapeHtml(c.new_price)}</span>` : ''}
          ${c.discount_text ? `<span class="kamp-disc">${escapeHtml(c.discount_text)}</span>` : ''}
        </div>` : '';
      const waText = encodeURIComponent(`Merhaba, ${c.title} kampanyası hakkında bilgi almak istiyorum.`);
      return `
        <div class="kamp-card">
          <div class="kamp-card-img">
            <img src="${img}" alt="${escapeHtml(c.title)}" loading="lazy"
                 onerror="this.src='${CAMP_IMAGES[0]}'" />
            ${badge}
            ${timer}
          </div>
          <div class="kamp-card-body">
            <div class="kamp-title">${escapeHtml(c.title)}</div>
            ${c.description ? `<div class="kamp-desc">${escapeHtml(c.description)}</div>` : ''}
            ${priceRow}
            <div class="kamp-actions">
              <a href="https://wa.me/905309361017?text=${waText}" target="_blank" class="btn btn-wa btn-sm"><i class="fab fa-whatsapp"></i> WhatsApp</a>
              <a href="/kampanyalar.html" class="btn btn-outline btn-sm">Detay</a>
            </div>
          </div>
        </div>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p class="empty-msg" style="grid-column:1/-1;text-align:center;padding:32px 0;">Kampanyalar yüklenemedi.</p>';
  }
}

async function applySettings() {
  const s = await fetchSettings();
  const el = document.getElementById('aboutText');
  if (el && s.about_text) el.textContent = s.about_text;
}

async function loadCategories() {
  const grid = document.getElementById('categoriesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/categories`);
    const cats = await res.json();
    if (!cats.length) {
      grid.innerHTML = '<p class="empty-msg">Henüz kategori eklenmemiş.</p>';
      return;
    }
    // Her kategori için o kategoriye ait ilk hizmeti çekip açıklama ve görsel al
    const svcRes = await fetch(`${API}/services`);
    const allSvcs = await svcRes.json().catch(() => []);

    grid.className = 'cat-photo-grid';
    // API artık service_count döndürüyor (categories.js JOIN)
    grid.innerHTML = cats.map(c => {
      const img   = getCatImage(c.slug || c.name);
      const count = c.service_count || 0;
      return `
        <a href="/hizmetler.html?kategori=${escapeHtml(c.slug)}" class="cat-photo-card">
          <div class="cat-photo-img">
            <img src="${img}" alt="${escapeHtml(c.name)}" loading="lazy"
                 onerror="this.src='${CAT_IMAGES.default}'" />
            <div class="cat-photo-overlay"></div>
          </div>
          <div class="cat-photo-body">
            <span class="cat-photo-icon">${c.icon || '🔧'}</span>
            <h3 class="cat-photo-name">${escapeHtml(c.name)}</h3>
            ${count ? `<span class="cat-photo-count">${count} hizmet</span>` : ''}
            <span class="cat-photo-arrow">Keşfet <i class="fas fa-arrow-right"></i></span>
          </div>
        </a>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p class="empty-msg">Kategoriler yüklenemedi.</p>';
  }
}

async function loadFeaturedServices() {
  const grid = document.getElementById('featuredServices');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/services?featured=1`);
    const services = await res.json();
    /* API'den gerçek hizmet geldiyse statik kartları değiştir */
    if (services.length) {
      grid.innerHTML = services.slice(0, 6).map(s => `
        <div class="service-card">
          <div class="service-img">
            <img src="${imgSrc(s.image)}" alt="${escapeHtml(s.title)}" loading="lazy" />
            ${s.category_name ? `<span class="service-cat-badge">${escapeHtml(s.category_icon || '')} ${escapeHtml(s.category_name)}</span>` : ''}
          </div>
          <div class="service-body">
            <h3>${escapeHtml(s.title)}</h3>
            <p>${escapeHtml(s.short_desc || '')}</p>
            <div class="service-actions">
              <a href="/hizmet-detay.html?slug=${escapeHtml(s.slug)}" class="btn btn-sm btn-outline-gold">Detay</a>
              <a href="https://wa.me/905309361017?text=Merhaba%2C%20${encodeURIComponent(s.title)}%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" class="btn btn-sm btn-whatsapp"><i class="fab fa-whatsapp"></i></a>
            </div>
          </div>
        </div>
      `).join('');
    }
    /* API boşsa statik kartlar (svc-static) sayfada zaten görünür durumdadır, dokunma */
  } catch {
    /* Hata durumunda da statik kartlar korunur */
  }
}

async function loadFeaturedProjects() {
  const grid = document.getElementById('referencesGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/projects?featured=1`);
    const projects = await res.json();
    if (!projects.length) {
      grid.innerHTML = '<p class="empty-msg">Henüz referans eklenmemiş.</p>';
      return;
    }
    grid.innerHTML = projects.slice(0, 6).map(p => {
      const slug = p.slug || p.id;
      const url = `/referans-detay.html?slug=${encodeURIComponent(slug)}`;
      return `
      <a href="${url}" class="ref-card" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <div class="ref-img" style="position:relative;">
          <img src="${imgSrc(p.image, p.title)}" alt="${escapeHtml(p.title)}" loading="lazy" />
          <div style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);color:#fff;font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:20px;">
            <i class="fas fa-images"></i> Detay
          </div>
        </div>
        <div class="ref-body">
          <h3>${escapeHtml(p.title)}</h3>
          ${p.location ? `<p class="ref-loc"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.location)}</p>` : ''}
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
        </div>
      </a>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p class="empty-msg">Referanslar yüklenemedi.</p>';
  }
}

// ── HİZMETLER SAYFASI ────────────────────────────────────────────────────────
async function initHizmetler() {
  const params = new URLSearchParams(window.location.search);
  const kategori = params.get('kategori') || '';
  const search = params.get('q') || '';

  await loadCategoryFilters(kategori);
  await loadAllServices(kategori, search);

  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.value = search;
    searchInput.addEventListener('input', debounce(e => {
      const q = e.target.value.trim();
      updateURL({ q, kategori: getCurrentCategory() });
      loadAllServices(getCurrentCategory(), q);
    }, 400));
  }
}

async function loadCategoryFilters(active) {
  const container = document.getElementById('categoryFilters');
  if (!container) return;
  try {
    const res = await fetch(`${API}/categories`);
    const cats = await res.json();
    container.innerHTML = `
      <button class="filter-btn ${!active ? 'active' : ''}" data-slug="">Tümü</button>
      ${cats.map(c => `
        <button class="filter-btn ${c.slug === active ? 'active' : ''}" data-slug="${c.slug}">
          ${c.icon || ''} ${c.name}
        </button>
      `).join('')}
    `;
    container.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        const slug = btn.dataset.slug;
        updateURL({ kategori: slug, q: getSearchQuery() });
        loadAllServices(slug, getSearchQuery());
      });
    });
  } catch {}
}

async function loadAllServices(kategori, search) {
  const grid = document.getElementById('servicesGrid');
  if (!grid) return;

  /* Skeleton */
  grid.innerHTML = Array(6).fill(`
    <div class="hizmet-card skeleton-card">
      <div class="hizmet-img"></div>
      <div class="hizmet-body">
        <div class="skeleton-line" style="width:65%;"></div>
        <div class="skeleton-line" style="width:100%;"></div>
        <div class="skeleton-line" style="width:80%;"></div>
      </div>
    </div>`).join('');

  try {
    let url = `${API}/services`;
    if (kategori) url += `?category=${kategori}`;
    const res = await fetch(url);
    let services = await res.json();

    if (search) {
      const q = search.toLowerCase();
      services = services.filter(s =>
        s.title.toLowerCase().includes(q) ||
        (s.short_desc || '').toLowerCase().includes(q)
      );
    }

    /* Sonuç sayısı */
    const countEl = document.getElementById('resultCount');
    if (countEl) countEl.textContent = services.length ? `${services.length} hizmet listeleniyor` : '';

    if (!services.length) {
      grid.innerHTML = `
        <div class="no-result">
          <i class="fas fa-search"></i>
          <p>Aranan kriterlere uygun hizmet bulunamadı.</p>
        </div>`;
      return;
    }

    function getDefaultImg(svc) {
      if (svc.image) return imgSrc(svc.image);
      return getCatImage(svc.slug || svc.category_slug || svc.category_name || '');
    }

    grid.innerHTML = services.map(s => `
      <div class="hizmet-card">
        <div class="hizmet-img">
          <img src="${getDefaultImg(s)}" alt="${escapeHtml(s.title)}" loading="lazy"
               onerror="this.src='${CAT_IMAGES.default}'" />
          ${s.category_name ? `<span class="hizmet-cat-badge">${escapeHtml(s.category_icon || '')} ${escapeHtml(s.category_name)}</span>` : ''}
        </div>
        <div class="hizmet-body">
          <h3>${escapeHtml(s.title)}</h3>
          <p>${escapeHtml(s.short_desc || '')}</p>
          <div class="hizmet-actions">
            <a href="/hizmet-detay.html?slug=${escapeHtml(s.slug)}" class="btn-detay">Detayları Gör →</a>
            <a href="https://wa.me/905309361017?text=Merhaba%2C%20${encodeURIComponent(s.title)}%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum."
               target="_blank" class="btn-wa" aria-label="WhatsApp ile sor">
              <i class="fab fa-whatsapp"></i>
            </a>
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = `
      <div class="no-result">
        <i class="fas fa-exclamation-circle"></i>
        <p>Hizmetler yüklenemedi. Lütfen sayfayı yenileyin.</p>
      </div>`;
  }
}

// ── HİZMET DETAY ─────────────────────────────────────────────────────────────
async function initDetay() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('slug');
  if (!slug) { window.location.href = '/hizmetler.html'; return; }
  try {
    const res = await fetch(`${API}/services/${slug}`);
    if (!res.ok) { window.location.href = '/hizmetler.html'; return; }
    const s = await res.json();
    document.title = `${s.title} | Akdeniz Yapı Dekorasyon`;
    const container = document.getElementById('detayContent');
    if (!container) return;
    container.innerHTML = `
      <div class="detay-image">
        <img src="${imgSrc(s.image)}" alt="${escapeHtml(s.title)}" />
      </div>
      <div class="detay-body">
        ${s.category_name ? `<span class="service-cat-badge">${escapeHtml(s.category_icon || '')} ${escapeHtml(s.category_name)}</span>` : ''}
        <h1>${escapeHtml(s.title)}</h1>
        <p class="detay-short">${escapeHtml(s.short_desc || '')}</p>
        <div class="detay-desc">${escapeHtml(s.description || '').replace(/\n/g, '<br/>')}</div>
        <div class="detay-cta">
          <a href="tel:05309361017" class="btn btn-gold"><i class="fas fa-phone"></i> Hemen Ara</a>
          <a href="https://wa.me/905309361017?text=Merhaba%2C%20${encodeURIComponent(s.title)}%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" class="btn btn-whatsapp"><i class="fab fa-whatsapp"></i> WhatsApp'tan Sor</a>
        </div>
      </div>
    `;
  } catch {
    document.getElementById('detayContent').innerHTML = '<p class="empty-msg">Hizmet bulunamadı.</p>';
  }
}

// ── REFERANSLAR ───────────────────────────────────────────────────────────────
async function initReferanslar() {
  const grid = document.getElementById('allProjectsGrid');
  if (!grid) return;
  try {
    const res = await fetch(`${API}/projects`);
    const projects = await res.json();
    if (!projects.length) {
      grid.innerHTML = '<p class="empty-msg">Henüz referans eklenmemiş.</p>';
      return;
    }
    grid.innerHTML = projects.map(p => {
      const slug = p.slug || p.id;
      const url = `/referans-detay.html?slug=${encodeURIComponent(slug)}`;
      return `
      <a href="${url}" class="ref-card" style="text-decoration:none;color:inherit;display:block;cursor:pointer;">
        <div class="ref-img" style="position:relative;">
          <img src="${imgSrc(p.image, p.title)}" alt="${escapeHtml(p.title)}" loading="lazy" />
          <div style="position:absolute;bottom:10px;right:10px;background:rgba(0,0,0,.6);backdrop-filter:blur(4px);color:#fff;font-size:.72rem;font-weight:700;padding:4px 10px;border-radius:20px;">
            <i class="fas fa-images"></i> Detay
          </div>
        </div>
        <div class="ref-body">
          <h3>${escapeHtml(p.title)}</h3>
          ${p.location ? `<p class="ref-loc"><i class="fas fa-map-marker-alt"></i> ${escapeHtml(p.location)}</p>` : ''}
          ${p.description ? `<p>${escapeHtml(p.description)}</p>` : ''}
        </div>
      </a>`;
    }).join('');
  } catch {
    grid.innerHTML = '<p class="empty-msg">Referanslar yüklenemedi.</p>';
  }
}

// ── İLETİŞİM ─────────────────────────────────────────────────────────────────
async function initIletisim() {
  const form = document.getElementById('contactForm');
  if (!form) return;

  const s = await fetchSettings();
  if (s.phone1) {
    document.querySelectorAll('.dyn-phone1').forEach(el => {
      el.textContent = s.phone1;
      el.href = `tel:${s.phone1.replace(/\s/g, '')}`;
    });
  }
  if (s.whatsapp) {
    document.querySelectorAll('.dyn-wa').forEach(el => {
      el.href = `https://wa.me/${s.whatsapp}`;
    });
  }

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = form.querySelector('[type=submit]');
    btn.disabled = true;
    btn.textContent = 'Gönderiliyor...';
    const data = {
      name: form.name.value.trim(),
      phone: form.phone.value.trim(),
      email: form.email.value.trim(),
      subject: form.subject.value.trim(),
      message: form.message.value.trim()
    };
    try {
      const res = await fetch(`${API}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();
      if (res.ok) {
        showAlert('success', result.message || 'Mesajınız iletildi!');
        form.reset();
      } else {
        showAlert('error', result.error || 'Bir hata oluştu.');
      }
    } catch {
      showAlert('error', 'Bağlantı hatası. Lütfen tekrar deneyin.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Mesaj Gönder';
    }
  });
}

// ── Yardımcı Fonksiyonlar ────────────────────────────────────────────────────
function showAlert(type, msg) {
  const existing = document.querySelector('.alert-msg');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `alert-msg alert-${type}`;
  div.textContent = msg;
  document.querySelector('.contact-form-wrap')?.prepend(div);
  setTimeout(() => div.remove(), 5000);
}

function debounce(fn, delay) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

function updateURL(params) {
  const url = new URL(window.location);
  Object.entries(params).forEach(([k, v]) => {
    if (v) url.searchParams.set(k, v);
    else url.searchParams.delete(k);
  });
  window.history.replaceState({}, '', url);
}

function getCurrentCategory() {
  return document.querySelector('.filter-btn.active')?.dataset.slug || '';
}

function getSearchQuery() {
  return document.getElementById('searchInput')?.value.trim() || '';
}
