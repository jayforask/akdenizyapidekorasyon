// ── Admin ortak yardımcılar ──────────────────────────────────────────────────
const API = '/api';

function getToken() {
  return localStorage.getItem('admin_token');
}

function authHeaders() {
  return {
    'Authorization': 'Bearer ' + getToken(),
    'Content-Type': 'application/json'
  };
}

function authHeadersMultipart() {
  return { 'Authorization': 'Bearer ' + getToken() };
}

// Token yoksa login sayfasına yönlendir
async function requireAuth() {
  const token = getToken();
  if (!token) { window.location.href = '/admin/login.html'; return false; }
  try {
    const res = await fetch(`${API}/auth/verify`, {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    if (!res.ok) {
      localStorage.removeItem('admin_token');
      window.location.href = '/admin/login.html';
      return false;
    }
    // Kullanıcı adını navbar'a yaz
    const data = await res.json();
    const el = document.getElementById('adminUsername');
    if (el) el.textContent = data.username;
    return true;
  } catch {
    window.location.href = '/admin/login.html';
    return false;
  }
}

function logout() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_username');
  window.location.href = '/admin/login.html';
}

// Toast bildirimi
function toast(msg, type = 'success') {
  const existing = document.querySelector('.admin-toast');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.className = `admin-toast toast-${type}`;
  div.innerHTML = `<i class="fas fa-${type === 'success' ? 'check-circle' : 'exclamation-circle'}"></i> ${msg}`;
  document.body.appendChild(div);
  setTimeout(() => div.classList.add('show'), 10);
  setTimeout(() => { div.classList.remove('show'); setTimeout(() => div.remove(), 400); }, 3500);
}

// Modal aç/kapat
function openModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.add('open'); document.body.style.overflow = 'hidden'; }
}
function closeModal(id) {
  const m = document.getElementById(id);
  if (m) { m.classList.remove('open'); document.body.style.overflow = ''; }
}

// Onay dialogu — confirmText opsiyonel, varsayılan "Evet, Sil"
function confirm2(msg, confirmText = 'Evet, Sil') {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = `
      <div class="confirm-box">
        <p>${msg}</p>
        <div class="confirm-actions">
          <button class="btn-admin btn-danger" id="confirmYes">${confirmText}</button>
          <button class="btn-admin btn-secondary" id="confirmNo">İptal</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    document.getElementById('confirmYes').onclick = () => { overlay.remove(); resolve(true); };
    document.getElementById('confirmNo').onclick  = () => { overlay.remove(); resolve(false); };
  });
}

// Görsel önizleme
function previewImage(inputEl, previewEl) {
  inputEl.addEventListener('change', () => {
    const file = inputEl.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      previewEl.src = e.target.result;
      previewEl.style.display = 'block';
    };
    reader.readAsDataURL(file);
  });
}

// Aktif sidebar linki
function setActiveSidebarLink() {
  const path = window.location.pathname;
  document.querySelectorAll('.sidebar-nav a').forEach(a => {
    a.classList.toggle('active', a.getAttribute('href') === path || path.endsWith(a.getAttribute('href')));
  });
}
