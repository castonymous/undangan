// ══════════════════════════════════════════════
//  KATALOG UNDANGAN — app.js
//  Handles: data loading, navigation, rendering,
//           flipbook effect, search
// ══════════════════════════════════════════════

const App = (() => {
  let catalog = null;
  let navigationStack = []; // stack of product arrays for back navigation
  let currentProducts = [];
  let currentParent = null;
  let searchQuery = '';

  // ── INIT ────────────────────────────────────
  async function init() {
    catalog = await loadData();
    applySettings();
    renderLevel(catalog.products, null);
    bindSearch();
  }

  async function loadData() {
    // 1. Try localStorage (dashboard saves here)
    const local = localStorage.getItem('katalog_data');
    if (local) {
      try { return JSON.parse(local); } catch(e) {}
    }
    // 2. Fallback to data.json
    try {
      const res = await fetch('data.json');
      const data = await res.json();
      return data;
    } catch(e) {
      return { settings: { siteName: 'Katalog', tagline: '', whatsapp: '', currency: 'Rp' }, products: [] };
    }
  }

  function applySettings() {
    const s = catalog.settings || {};
    document.title = s.siteName || 'Katalog Undangan';
    const logoEl = document.getElementById('site-logo');
    if (logoEl && s.siteName) logoEl.textContent = s.siteName;
    const taglineEl = document.getElementById('site-tagline');
    if (taglineEl && s.tagline) taglineEl.textContent = s.tagline;
    const waEl = document.getElementById('wa-link');
    if (waEl && s.whatsapp) waEl.href = `https://wa.me/${s.whatsapp}`;
  }

  // ── NAVIGATION ──────────────────────────────
  function renderLevel(products, parent) {
    currentProducts = products;
    currentParent = parent;
    renderGrid(products);
    renderBreadcrumb();

    // Show/hide back button
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.style.display = navigationStack.length > 0 ? 'inline-flex' : 'none';
  }

  function drillInto(product) {
    if (!product.children || product.children.length === 0) {
      openWhatsApp(product);
      return;
    }
    navigationStack.push({ products: currentProducts, parent: currentParent });
    renderLevel(product.children, product);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goBack() {
    if (navigationStack.length === 0) return;
    const prev = navigationStack.pop();
    renderLevel(prev.products, prev.parent);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToRoot() {
    navigationStack = [];
    renderLevel(catalog.products, null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function goToIndex(index) {
    // Navigate to a specific breadcrumb level
    if (index < 0) { goToRoot(); return; }
    const target = navigationStack[index];
    navigationStack = navigationStack.slice(0, index);
    renderLevel(target.products, target.parent);
  }

  // ── BREADCRUMB ──────────────────────────────
  function renderBreadcrumb() {
    const bc = document.getElementById('breadcrumb');
    if (!bc) return;

    let html = `<span class="breadcrumb-item" onclick="App.goToRoot()">🏠 Semua</span>`;

    navigationStack.forEach((item, i) => {
      html += `<span class="breadcrumb-sep">›</span>`;
      if (item.parent) {
        html += `<span class="breadcrumb-item" onclick="App.goToIndex(${i + 1})">${item.parent.name}</span>`;
      }
    });

    if (currentParent) {
      html += `<span class="breadcrumb-sep">›</span>`;
      html += `<span class="breadcrumb-current">${currentParent.name}</span>`;
    }

    bc.innerHTML = html;
  }

  // ── GRID RENDER ─────────────────────────────
  function renderGrid(products) {
    const grid = document.getElementById('product-grid');
    const sectionTitle = document.getElementById('section-title');
    const sectionSub = document.getElementById('section-sub');
    if (!grid) return;

    // Update section title
    if (currentParent) {
      sectionTitle.textContent = currentParent.name;
      sectionSub.textContent = currentParent.description || '';
    } else {
      sectionTitle.textContent = 'Semua Koleksi';
      sectionSub.textContent = 'Pilih kategori untuk melihat koleksi lengkap';
    }

    // Filter by search
    const filtered = searchQuery
      ? products.filter(p =>
          p.name.toLowerCase().includes(searchQuery) ||
          (p.description || '').toLowerCase().includes(searchQuery) ||
          (p.category || '').toLowerCase().includes(searchQuery)
        )
      : products;

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <div class="icon">📋</div>
          <h3>Belum ada produk</h3>
          <p>${searchQuery ? 'Tidak ada hasil untuk "' + searchQuery + '"' : 'Belum ada produk di kategori ini'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => renderCard(p)).join('');

    // Bind flipbook after render
    grid.querySelectorAll('.product-card').forEach(card => {
      const id = card.dataset.id;
      const product = filtered.find(p => p.id === id);
      if (product) {
        initFlipbook(card, product);
        card.addEventListener('click', () => drillInto(product));
        card.querySelector('.card-cta').addEventListener('click', e => {
          e.stopPropagation();
          if (product.children && product.children.length > 0) {
            drillInto(product);
          } else {
            openWhatsApp(product);
          }
        });
      }
    });
  }

  function renderCard(product) {
    const hasChildren = product.children && product.children.length > 0;
    const imageCount = (product.images || []).length;

    const imagesHTML = imageCount > 0
      ? product.images.map(src => `<img class="flipbook-slide" src="${src}" alt="${product.name}" loading="lazy">`).join('')
      : `<div class="flipbook-slide-placeholder">🖼️<span>Belum ada foto</span></div>`;

    const dotsHTML = imageCount > 1
      ? `<div class="flipbook-dots">${product.images.map((_, i) =>
          `<div class="flipbook-dot ${i === 0 ? 'active' : ''}"></div>`
        ).join('')}</div>`
      : '';

    const ctaLabel = hasChildren
      ? `Lihat Koleksi <span>›</span>`
      : `Pesan <span>›</span>`;

    return `
      <div class="product-card" data-id="${product.id}">
        <div class="card-image-wrap">
          <div class="flipbook-track">${imagesHTML}</div>
          ${dotsHTML}
          ${product.category ? `<div class="card-badge">${product.category}</div>` : ''}
          ${hasChildren ? `<div class="has-children-badge">📂 ${product.children.length}</div>` : ''}
        </div>
        <div class="card-body">
          <div class="card-title">${product.name}</div>
          ${product.description ? `<div class="card-desc">${product.description}</div>` : ''}
          <div class="card-footer">
            <div class="card-price">
              ${product.price ? product.price : (hasChildren ? `<small>${product.children.length} tipe</small>` : '')}
            </div>
            <button class="card-cta">${ctaLabel}</button>
          </div>
        </div>
      </div>`;
  }

  // ── FLIPBOOK ────────────────────────────────
  function initFlipbook(card, product) {
    const images = product.images || [];
    if (images.length <= 1) return;

    const track = card.querySelector('.flipbook-track');
    const dots = card.querySelectorAll('.flipbook-dot');
    let currentIndex = 0;
    let interval = null;

    function goTo(index) {
      currentIndex = (index + images.length) % images.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
    }

    function startFlip() {
      interval = setInterval(() => goTo(currentIndex + 1), 1200);
    }

    function stopFlip() {
      clearInterval(interval);
      goTo(0);
    }

    card.querySelector('.card-image-wrap').addEventListener('mouseenter', startFlip);
    card.querySelector('.card-image-wrap').addEventListener('mouseleave', stopFlip);

    // Touch support
    let touchStartX = 0;
    card.addEventListener('touchstart', e => { touchStartX = e.touches[0].clientX; }, { passive: true });
    card.addEventListener('touchend', e => {
      const diff = touchStartX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 30) goTo(currentIndex + (diff > 0 ? 1 : -1));
    });
  }

  // ── WHATSAPP ────────────────────────────────
  function openWhatsApp(product) {
    const wa = catalog.settings?.whatsapp || '';
    if (!wa) { showToast('Nomor WhatsApp belum diatur'); return; }
    const path = buildPath(product);
    const msg = `Halo, saya tertarik dengan produk:\n*${path}*\n${product.price ? 'Harga: ' + product.price : ''}\n\nMohon info lebih lanjut 🙏`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function buildPath(product) {
    const parts = navigationStack.map(s => s.parent?.name).filter(Boolean);
    parts.push(product.name);
    return parts.join(' › ');
  }

  // ── SEARCH ──────────────────────────────────
  function bindSearch() {
    const input = document.getElementById('search-input');
    if (!input) return;
    input.addEventListener('input', e => {
      searchQuery = e.target.value.toLowerCase().trim();
      renderGrid(currentProducts);
    });
  }

  // ── TOAST ───────────────────────────────────
  function showToast(msg) {
    let t = document.getElementById('toast');
    if (!t) {
      t = document.createElement('div');
      t.id = 'toast';
      t.className = 'toast';
      document.body.appendChild(t);
    }
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ── PUBLIC ──────────────────────────────────
  return { init, goBack, goToRoot, goToIndex, drillInto };
})();

document.addEventListener('DOMContentLoaded', () => {
  App.init();
  // Back button
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', App.goBack);
});
