// ══════════════════════════════════════════════
//  KATALOG UNDANGAN — app.js
//  v2.0 — flipbook mobile, lightbox, WA redirect,
//         Google Form embed, cache-busting sync
// ══════════════════════════════════════════════

const App = (() => {
  let catalog = null;
  let navigationStack = [];
  let currentProducts = [];
  let currentParent = null;
  let searchQuery = '';

  // ── CONFIG ──────────────────────────────────
  // Ganti dengan URL Google Form kamu (link /viewform bukan /edit)
  const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/1PTcC1kxJSKJ1cd-7Ttqabp3nu9WgLK0DEzr8FtYAx_I/viewform?embedded=true';
  // Set true = tampilkan Google Form dulu sebelum WA, false = langsung WA
  const SHOW_FORM_BEFORE_WA = true;

  // ── INIT ────────────────────────────────────
  async function init() {
    catalog = await loadData();
    applySettings();
    renderLevel(catalog.products, null);
    bindSearch();
    buildLightbox();
    buildFormModal();
  }

  // ── DATA LOADING (cache-busting) ─────────────
  async function loadData() {
    // Selalu fetch data.json terbaru dari server (cache-busting)
    // ini fix masalah HP vs PC gak sinkron
    try {
      const ts = Date.now();
      const res = await fetch(`data.json?v=${ts}`, { cache: 'no-store' });
      if (res.ok) {
        const fresh = await res.json();
        // Simpan ke localStorage biar offline tetap jalan
        localStorage.setItem('katalog_data', JSON.stringify(fresh));
        return fresh;
      }
    } catch(e) {
      // Server gagal, fallback ke localStorage
    }

    // Fallback localStorage kalau fetch gagal (offline)
    const local = localStorage.getItem('katalog_data');
    if (local) {
      try { return JSON.parse(local); } catch(e) {}
    }

    return {
      settings: { siteName: 'Katalog', tagline: '', whatsapp: '', currency: 'Rp' },
      products: []
    };
  }

  function applySettings() {
    const s = catalog.settings || {};
    document.title = s.siteName || 'Katalog Undangan';
    const logoEl = document.getElementById('site-logo');
    if (logoEl && s.siteName) {
      logoEl.innerHTML = s.siteName.includes('.')
        ? s.siteName.replace('.', '<span>.</span>') + s.siteName.split('.')[1] ? '' : ''
        : s.siteName;
      logoEl.textContent = s.siteName;
    }
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
    const backBtn = document.getElementById('back-btn');
    if (backBtn) backBtn.style.display = navigationStack.length > 0 ? 'inline-flex' : 'none';
  }

  function drillInto(product) {
    if (!product.children || product.children.length === 0) {
      handleOrder(product);
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

    if (currentParent) {
      sectionTitle.textContent = currentParent.name;
      sectionSub.textContent = currentParent.description || '';
    } else {
      sectionTitle.textContent = 'Semua Koleksi';
      sectionSub.textContent = 'Pilih kategori untuk melihat koleksi lengkap';
    }

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
          <p>${searchQuery ? `Tidak ada hasil untuk "${searchQuery}"` : 'Belum ada produk di kategori ini'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(p => renderCard(p)).join('');

    grid.querySelectorAll('.product-card').forEach(card => {
      const id = card.dataset.id;
      const product = filtered.find(p => p.id === id);
      if (!product) return;

      initFlipbook(card, product);

      // Klik area gambar → lightbox fullscreen
      card.querySelector('.card-image-wrap').addEventListener('click', e => {
        e.stopPropagation();
        const imgs = product.images || [];
        if (imgs.length > 0) {
          const flipIndex = getCurrentFlipIndex(card);
          openLightbox(imgs, flipIndex);
        }
      });

      // Klik card body → drill into / order
      card.querySelector('.card-body').addEventListener('click', () => drillInto(product));

      // Tombol CTA
      card.querySelector('.card-cta').addEventListener('click', e => {
        e.stopPropagation();
        if (product.children && product.children.length > 0) {
          drillInto(product);
        } else {
          handleOrder(product);
        }
      });
    });
  }

  function getCurrentFlipIndex(card) {
    const dots = card.querySelectorAll('.flipbook-dot');
    for (let i = 0; i < dots.length; i++) {
      if (dots[i].classList.contains('active')) return i;
    }
    return 0;
  }

  function renderCard(product) {
    const hasChildren = product.children && product.children.length > 0;
    const imageCount = (product.images || []).length;

    const imagesHTML = imageCount > 0
      ? product.images.map(src =>
          `<img class="flipbook-slide" src="${src}" alt="${product.name}" loading="lazy">`
        ).join('')
      : `<div class="flipbook-slide-placeholder">🖼️<span>Belum ada foto</span></div>`;

    const dotsHTML = imageCount > 1
      ? `<div class="flipbook-dots">${product.images.map((_, i) =>
          `<div class="flipbook-dot ${i === 0 ? 'active' : ''}"></div>`
        ).join('')}</div>`
      : '';

    const zoomIcon = imageCount > 0
      ? `<div class="zoom-hint">🔍</div>`
      : '';

    const ctaLabel = hasChildren
      ? `Lihat Koleksi <span>›</span>`
      : `Pesan <span>›</span>`;

    return `
      <div class="product-card" data-id="${product.id}">
        <div class="card-image-wrap">
          <div class="flipbook-track">${imagesHTML}</div>
          ${dotsHTML}
          ${zoomIcon}
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
    let isMobileActive = false;

    function goTo(index) {
      currentIndex = (index + images.length) % images.length;
      track.style.transform = `translateX(-${currentIndex * 100}%)`;
      dots.forEach((d, i) => d.classList.toggle('active', i === currentIndex));
    }

    function startFlip() {
      clearInterval(interval);
      interval = setInterval(() => goTo(currentIndex + 1), 1200);
    }

    function stopFlip() {
      clearInterval(interval);
      goTo(0);
    }

    const imgWrap = card.querySelector('.card-image-wrap');

    // Desktop: hover
    imgWrap.addEventListener('mouseenter', startFlip);
    imgWrap.addEventListener('mouseleave', stopFlip);

    // Mobile: tap sekali untuk aktifkan flipbook, tap lagi untuk buka lightbox
    let touchMoved = false;
    let touchStartX = 0;
    let touchStartY = 0;

    imgWrap.addEventListener('touchstart', e => {
      touchStartX = e.touches[0].clientX;
      touchStartY = e.touches[0].clientY;
      touchMoved = false;
    }, { passive: true });

    imgWrap.addEventListener('touchmove', e => {
      const dx = Math.abs(e.touches[0].clientX - touchStartX);
      const dy = Math.abs(e.touches[0].clientY - touchStartY);
      if (dx > 8 || dy > 8) touchMoved = true;
    }, { passive: true });

    imgWrap.addEventListener('touchend', e => {
      if (touchMoved) {
        // Swipe untuk ganti foto
        const diff = touchStartX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 30) {
          goTo(currentIndex + (diff > 0 ? 1 : -1));
        }
        return;
      }

      // Single tap: toggle flipbook aktif
      e.preventDefault();
      if (!isMobileActive) {
        isMobileActive = true;
        imgWrap.classList.add('flipbook-active');
        startFlip();
      }
      // lightbox di handle oleh listener di renderGrid (click pada card-image-wrap)
    }, { passive: false });

    // Kalau tap di luar card, reset
    document.addEventListener('touchstart', e => {
      if (!card.contains(e.target) && isMobileActive) {
        isMobileActive = false;
        imgWrap.classList.remove('flipbook-active');
        stopFlip();
      }
    }, { passive: true });
  }

  // ── LIGHTBOX FULLSCREEN ─────────────────────
  let lightboxImages = [];
  let lightboxIndex = 0;

  function buildLightbox() {
    if (document.getElementById('lightbox')) return;
    const lb = document.createElement('div');
    lb.id = 'lightbox';
    lb.innerHTML = `
      <div class="lb-overlay"></div>
      <div class="lb-content">
        <button class="lb-close">✕</button>
        <button class="lb-prev">‹</button>
        <button class="lb-next">›</button>
        <div class="lb-track-wrap">
          <div class="lb-track"></div>
        </div>
        <div class="lb-dots"></div>
        <div class="lb-counter"></div>
      </div>
    `;
    document.body.appendChild(lb);

    lb.querySelector('.lb-overlay').addEventListener('click', closeLightbox);
    lb.querySelector('.lb-close').addEventListener('click', closeLightbox);
    lb.querySelector('.lb-prev').addEventListener('click', () => lbGoTo(lightboxIndex - 1));
    lb.querySelector('.lb-next').addEventListener('click', () => lbGoTo(lightboxIndex + 1));

    // Keyboard
    document.addEventListener('keydown', e => {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'ArrowLeft') lbGoTo(lightboxIndex - 1);
      if (e.key === 'ArrowRight') lbGoTo(lightboxIndex + 1);
      if (e.key === 'Escape') closeLightbox();
    });

    // Touch swipe
    let lbTouchX = 0;
    lb.addEventListener('touchstart', e => { lbTouchX = e.touches[0].clientX; }, { passive: true });
    lb.addEventListener('touchend', e => {
      const diff = lbTouchX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) lbGoTo(lightboxIndex + (diff > 0 ? 1 : -1));
    });
  }

  function openLightbox(images, startIndex = 0) {
    lightboxImages = images;
    lightboxIndex = startIndex;

    const lb = document.getElementById('lightbox');
    const track = lb.querySelector('.lb-track');
    const dotsEl = lb.querySelector('.lb-dots');

    track.innerHTML = images.map(src =>
      `<div class="lb-slide"><img src="${src}" alt="foto"></div>`
    ).join('');

    dotsEl.innerHTML = images.length > 1
      ? images.map((_, i) => `<div class="lb-dot"></div>`).join('')
      : '';

    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
    lbGoTo(startIndex, false);
  }

  function lbGoTo(index, animate = true) {
    const lb = document.getElementById('lightbox');
    const track = lb.querySelector('.lb-track');
    const dots = lb.querySelectorAll('.lb-dot');
    const counter = lb.querySelector('.lb-counter');
    const prev = lb.querySelector('.lb-prev');
    const next = lb.querySelector('.lb-next');

    lightboxIndex = (index + lightboxImages.length) % lightboxImages.length;
    track.style.transition = animate ? 'transform 0.35s ease' : 'none';
    track.style.transform = `translateX(-${lightboxIndex * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === lightboxIndex));
    counter.textContent = lightboxImages.length > 1
      ? `${lightboxIndex + 1} / ${lightboxImages.length}`
      : '';

    prev.style.display = lightboxImages.length > 1 ? 'flex' : 'none';
    next.style.display = lightboxImages.length > 1 ? 'flex' : 'none';
  }

  function closeLightbox() {
    const lb = document.getElementById('lightbox');
    lb.classList.remove('open');
    document.body.style.overflow = '';
  }

  // ── ORDER / WHATSAPP + FORM ─────────────────
  function handleOrder(product) {
    if (SHOW_FORM_BEFORE_WA) {
      openFormModal(product);
    } else {
      openWhatsApp(product);
    }
  }

  function openWhatsApp(product) {
    const wa = catalog.settings?.whatsapp || '';
    if (!wa) { showToast('Nomor WhatsApp belum diatur di pengaturan'); return; }
    const path = buildPath(product);
    const msg = `Halo, saya tertarik dengan produk:\n*${path}*\n${product.price ? 'Harga: ' + product.price : ''}\n\nMohon info lebih lanjut 🙏`;
    window.open(`https://wa.me/${wa}?text=${encodeURIComponent(msg)}`, '_blank');
  }

  function buildPath(product) {
    const parts = navigationStack.map(s => s.parent?.name).filter(Boolean);
    parts.push(product.name);
    return parts.join(' › ');
  }

  // ── GOOGLE FORM MODAL ───────────────────────
  let pendingOrderProduct = null;

  function buildFormModal() {
    if (document.getElementById('form-modal')) return;
    const modal = document.createElement('div');
    modal.id = 'form-modal';
    modal.innerHTML = `
      <div class="fm-overlay"></div>
      <div class="fm-box">
        <div class="fm-header">
          <span class="fm-title">📋 Form Pemesanan</span>
          <button class="fm-close">✕</button>
        </div>
        <div class="fm-body">
          <iframe id="fm-iframe" src="" frameborder="0" marginheight="0" marginwidth="0"
            style="width:100%;height:100%;border:none">Memuat...</iframe>
        </div>
        <div class="fm-footer">
          <button class="fm-wa-btn" id="fm-wa-btn">
            💬 Lanjut ke WhatsApp
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);

    modal.querySelector('.fm-overlay').addEventListener('click', closeFormModal);
    modal.querySelector('.fm-close').addEventListener('click', closeFormModal);
    modal.querySelector('#fm-wa-btn').addEventListener('click', () => {
      closeFormModal();
      if (pendingOrderProduct) openWhatsApp(pendingOrderProduct);
    });
  }

  function openFormModal(product) {
    pendingOrderProduct = product;
    const modal = document.getElementById('form-modal');
    const iframe = document.getElementById('fm-iframe');
    const title = modal.querySelector('.fm-title');

    title.textContent = `📋 Pesan: ${product.name}`;
    iframe.src = GOOGLE_FORM_URL;
    modal.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeFormModal() {
    const modal = document.getElementById('form-modal');
    modal.classList.remove('open');
    document.body.style.overflow = '';
    // Reset iframe biar gak loading terus
    setTimeout(() => {
      const iframe = document.getElementById('fm-iframe');
      if (iframe) iframe.src = '';
    }, 300);
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
  const backBtn = document.getElementById('back-btn');
  if (backBtn) backBtn.addEventListener('click', App.goBack);
});
