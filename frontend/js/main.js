const API = '/api';

// ── Yardımcı ─────────────────────────────────────────────────────────────────
async function fetchSettings() {
  try {
    const res = await fetch(`${API}/settings`);
    return await res.json();
  } catch { return {}; }
}

function imgSrc(path) {
  return path ? path : 'https://placehold.co/600x400/1a1a1a/c9a227?text=Akdeniz+Yapı';
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
  loadFeaturedServices();
  loadFeaturedProjects();
  applySettings();
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
    grid.innerHTML = cats.map(c => `
      <a href="/hizmetler.html?kategori=${c.slug}" class="cat-card">
        <span class="cat-icon">${c.icon || '🔧'}</span>
        <span class="cat-name">${c.name}</span>
      </a>
    `).join('');
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
    if (!services.length) {
      grid.innerHTML = '<p class="empty-msg">Henüz hizmet eklenmemiş.</p>';
      return;
    }
    grid.innerHTML = services.slice(0, 6).map(s => `
      <div class="service-card">
        <div class="service-img">
          <img src="${imgSrc(s.image)}" alt="${s.title}" loading="lazy" />
          ${s.category_name ? `<span class="service-cat-badge">${s.category_icon || ''} ${s.category_name}</span>` : ''}
        </div>
        <div class="service-body">
          <h3>${s.title}</h3>
          <p>${s.short_desc || ''}</p>
          <div class="service-actions">
            <a href="/hizmet-detay.html?slug=${s.slug}" class="btn btn-sm btn-outline-gold">Detay</a>
            <a href="https://wa.me/905309361017?text=Merhaba%2C%20${encodeURIComponent(s.title)}%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" class="btn btn-sm btn-whatsapp"><i class="fab fa-whatsapp"></i></a>
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '<p class="empty-msg">Hizmetler yüklenemedi.</p>';
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
    grid.innerHTML = projects.slice(0, 6).map(p => `
      <div class="ref-card">
        <div class="ref-img">
          <img src="${imgSrc(p.image)}" alt="${p.title}" loading="lazy" />
        </div>
        <div class="ref-body">
          <h3>${p.title}</h3>
          ${p.location ? `<p class="ref-loc"><i class="fas fa-map-marker-alt"></i> ${p.location}</p>` : ''}
          ${p.description ? `<p>${p.description}</p>` : ''}
        </div>
      </div>
    `).join('');
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
  grid.innerHTML = '<div class="service-card skeleton"></div>'.repeat(6);
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
    if (!services.length) {
      grid.innerHTML = '<p class="empty-msg">Aranan kriterlere uygun hizmet bulunamadı.</p>';
      return;
    }
    grid.innerHTML = services.map(s => `
      <div class="service-card">
        <div class="service-img">
          <img src="${imgSrc(s.image)}" alt="${s.title}" loading="lazy" />
          ${s.category_name ? `<span class="service-cat-badge">${s.category_icon || ''} ${s.category_name}</span>` : ''}
        </div>
        <div class="service-body">
          <h3>${s.title}</h3>
          <p>${s.short_desc || ''}</p>
          <div class="service-actions">
            <a href="/hizmet-detay.html?slug=${s.slug}" class="btn btn-sm btn-outline-gold">Detay</a>
            <a href="tel:05309361017" class="btn btn-sm btn-call"><i class="fas fa-phone"></i> Ara</a>
            <a href="https://wa.me/905309361017?text=Merhaba%2C%20${encodeURIComponent(s.title)}%20hakk%C4%B1nda%20bilgi%20almak%20istiyorum." target="_blank" class="btn btn-sm btn-whatsapp"><i class="fab fa-whatsapp"></i></a>
          </div>
        </div>
      </div>
    `).join('');
  } catch {
    grid.innerHTML = '<p class="empty-msg">Hizmetler yüklenemedi.</p>';
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
        <img src="${imgSrc(s.image)}" alt="${s.title}" />
      </div>
      <div class="detay-body">
        ${s.category_name ? `<span class="service-cat-badge">${s.category_icon || ''} ${s.category_name}</span>` : ''}
        <h1>${s.title}</h1>
        <p class="detay-short">${s.short_desc || ''}</p>
        <div class="detay-desc">${(s.description || '').replace(/\n/g, '<br/>')}</div>
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
    grid.innerHTML = projects.map(p => `
      <div class="ref-card">
        <div class="ref-img">
          <img src="${imgSrc(p.image)}" alt="${p.title}" loading="lazy" />
        </div>
        <div class="ref-body">
          <h3>${p.title}</h3>
          ${p.location ? `<p class="ref-loc"><i class="fas fa-map-marker-alt"></i> ${p.location}</p>` : ''}
          ${p.description ? `<p>${p.description}</p>` : ''}
        </div>
      </div>
    `).join('');
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
