// ══════════════════════════════════════════════
//  AUTH GATE — auth.js
//  Client-side password protection untuk dashboard.
//
//  CARA GANTI PASSWORD:
//  1. Buka: https://emn178.github.io/online-tools/sha256.html
//  2. Ketik password baru → copy hash yang muncul
//  3. Ganti nilai PASS_HASH di bawah dengan hash baru
// ══════════════════════════════════════════════

const AUTH_CONFIG = {
  // SHA-256 hash dari password "admin123"
  // ⚠️ GANTI INI dengan hash password kamu sendiri!
  PASS_HASH: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9',
  SESSION_KEY: 'dash_auth_v1',
  MAX_ATTEMPTS: 5,
  LOCKOUT_KEY: 'dash_lockout',
  LOCKOUT_MS: 15 * 60 * 1000, // 15 menit
};

// Hash password pakai Web Crypto API (built-in browser, gak butuh library)
async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function getLockout() {
  try {
    return JSON.parse(sessionStorage.getItem(AUTH_CONFIG.LOCKOUT_KEY) || 'null');
  } catch { return null; }
}

function setLockout(data) {
  sessionStorage.setItem(AUTH_CONFIG.LOCKOUT_KEY, JSON.stringify(data));
}

function isAuthenticated() {
  return sessionStorage.getItem(AUTH_CONFIG.SESSION_KEY) === 'ok';
}

function grantAccess() {
  sessionStorage.setItem(AUTH_CONFIG.SESSION_KEY, 'ok');
  document.getElementById('auth-gate').classList.add('hidden');
  document.getElementById('dash-layout').style.display = 'flex';
  // Trigger dashboard init (dashboard.js checks window.__dashboardReady)
  if (typeof Dashboard !== 'undefined' && typeof Dashboard.init === 'function') {
    Dashboard.init();
  }
}

async function attemptLogin() {
  const btn    = document.getElementById('auth-submit');
  const input  = document.getElementById('auth-password');
  const errEl  = document.getElementById('auth-error');
  const attEl  = document.getElementById('auth-attempts');

  // Cek lockout aktif
  const lockout = getLockout();
  if (lockout && lockout.until > Date.now()) {
    const mins = Math.ceil((lockout.until - Date.now()) / 60000);
    errEl.textContent = `Terlalu banyak percobaan. Coba lagi dalam ${mins} menit.`;
    return;
  }

  const pass = input.value.trim();
  if (!pass) { input.focus(); return; }

  btn.disabled = true;
  btn.textContent = 'Memeriksa...';

  const hash = await sha256(pass);

  if (hash === AUTH_CONFIG.PASS_HASH) {
    // ✅ Sukses
    sessionStorage.removeItem(AUTH_CONFIG.LOCKOUT_KEY);
    errEl.textContent = '';
    attEl.textContent = '';
    grantAccess();
  } else {
    // ❌ Salah
    const prev = getLockout() || { count: 0, until: 0 };
    prev.count = (prev.count || 0) + 1;
    const remaining = AUTH_CONFIG.MAX_ATTEMPTS - prev.count;

    if (prev.count >= AUTH_CONFIG.MAX_ATTEMPTS) {
      prev.until = Date.now() + AUTH_CONFIG.LOCKOUT_MS;
      setLockout(prev);
      errEl.textContent = 'Terlalu banyak percobaan. Akses terkunci 15 menit.';
      attEl.textContent = '';
      input.disabled = true;
      btn.disabled = true;
      btn.textContent = 'Terkunci';
    } else {
      setLockout(prev);
      errEl.textContent = 'Password salah.';
      attEl.textContent = `Sisa percobaan: ${remaining} dari ${AUTH_CONFIG.MAX_ATTEMPTS}`;
      input.classList.add('shake');
      input.value = '';
      setTimeout(() => input.classList.remove('shake'), 450);
      btn.disabled = false;
      btn.textContent = 'Masuk Dashboard';
      input.focus();
    }
  }
}

// Bind events setelah DOM ready
document.addEventListener('DOMContentLoaded', () => {
  // Kalau udah login di session ini, langsung masuk
  if (isAuthenticated()) {
    document.getElementById('auth-gate').classList.add('hidden');
    document.getElementById('dash-layout').style.display = 'flex';
    return; // Dashboard.init() dipanggil oleh DOMContentLoaded di dashboard.js
  }

  // Tampilkan login gate, blokir dashboard
  document.getElementById('auth-password').focus();

  document.getElementById('auth-submit').addEventListener('click', attemptLogin);
  document.getElementById('auth-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') attemptLogin();
    // Clear error saat user mulai ngetik lagi
    document.getElementById('auth-error').textContent = '';
  });
}, { once: true });
