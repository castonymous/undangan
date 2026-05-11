// ══════════════════════════════════════════════
//  DASHBOARD — dashboard.js
//  Handles: CRUD produk, image upload/URL,
//           settings, export/import JSON
// ══════════════════════════════════════════════

const Dashboard = (() => {
  let data = null;          // full catalog data
  let selectedId = null;    // currently editing product id
  let flipInterval = null;  // preview flipbook timer
  let flipIndex = 0;

  const STORAGE_KEY = 'katalog_data';

  // ── INIT ────────────────────────────────────
  async function init() {
    data = await loadData();
    renderSidebar();
    renderWelcome();
    bindTopbar();
    bindImageUpload();
    bindModal();
  }

  async function loadData() {
    const local = localStorage.getItem(STORAGE_KEY);
    if (local) {
      try { return JSON.parse(local); } catch(e) {}
    }
    try {
      const res = await fetch('data.json');
      return await res.json();
    } catch(e) {
      return {
        settings: { siteName: 'Undangan.id', tagline: '', whatsapp: '', currency: 'Rp' },
        products: []
      };
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ── FIND/UPDATE HELPERS ──────────────────────
  function findById(id, nodes) {
    nodes = nodes || data.products;
    for (const n of nodes) {
      if (n.id === id) return n;
      if (n.children) {
        const found = findById(id, n.children);
        if (found) return found;
      }
    }
    return null;
  }

  function findParent(id, nodes, parent) {
    nodes = nodes || data.products;
    for (const n of nodes) {
      if (n.id === id) return parent;
      if (n.children) {
        const found = findParent(id, n.children, n);
        if (found !== undefined) return found;
      }
    }
    return undefined;
  }

  function deleteById(id, nodes) {
    nodes = nodes || data.products;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].id === id) { nodes.splice(i, 1); return true; }
      if (nodes[i].children && deleteById(id, nodes[i].children)) return true;
    }
    return false;
  }

  function generateId(name, parentId) {
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const base = parentId ? `${parentId}-${slug}` : slug;
    const exists = findById(base);
    return exists ? `${base}-${Date.now()}` : base;
  }

  // ── SIDEBAR TREE ────────────────────────────
  function renderSidebar() {
    const tree = document.getElementById('sidebar-tree');
    if (!tree) return;
    tree.innerHTML = renderTreeNodes(data.products, null);
    tree.querySelectorAll('.tree-item[data-id]').forEach(el => {
      el.addEventListener('click', () => selectProduct(el.dataset.id));
    });
    tree.querySelectorAll('.add-child-btn').forEach(el => {
      el.addEventListener('click', e => {
        e.stopPropagation();
        addProduct(el.dataset.parent || null);
      });
    });
    // Re-highlight selected
    if (selectedId) {
      const el = tree.querySelector(`[data-id="${selectedId}"]`);
      if (el) el.classList.add('selected');
    }
  }

  function renderTreeNodes(nodes, depth) {
    if (!nodes || nodes.length === 0) return '';
    return nodes.map(n => {
      const hasChildren = n.children && n.children.length > 0;
      const icon = hasChildren ? '📂' : '📄';
      return `
        <div class="tree-node">
          <div class="tree-item${selectedId === n.id ? ' selected' : ''}" data-id="${n.id}">
            <span class="icon">${icon}</span>
            <span class="name">${n.name}</span>
            ${hasChildren ? `<span class="count">${n.children.length}</span>` : ''}
          </div>
          ${hasChildren ? `<div class="tree-children">${renderTreeNodes(n.children, (depth||0)+1)}</div>` : ''}
          <div class="add-child-btn" data-parent="${n.id}">＋ Tambah sub-produk</div>
        </div>`;
    }).join('');
  }

  // ── SELECT & EDIT ────────────────────────────
  function selectProduct(id) {
    selectedId = id;
    const product = findById(id);
    if (!product) return;
    renderSidebar();
    renderEditor(product);
  }

  function renderEditor(product) {
    const content = document.getElementById('content-area');
    if (!content) return;

    content.innerHTML = `
      <div class="editor-panel">

        <!-- BASIC INFO -->
        <div class="editor-card">
          <h3>📝 Info Produk</h3>
          <div class="form-grid">
            <div class="form-group">
              <label class="form-label">Nama Produk *</label>
              <input class="form-input" id="ed-name" value="${esc(product.name)}" placeholder="Contoh: FADHIL">
            </div>
            <div class="form-group">
              <label class="form-label">Label / Kategori</label>
              <input class="form-input" id="ed-category" value="${esc(product.category||'')}" placeholder="Contoh: Premium Series">
            </div>
            <div class="form-group">
              <label class="form-label">Harga</label>
              <input class="form-input" id="ed-price" value="${esc(product.price||'')}" placeholder="Contoh: Rp 150.000">
            </div>
            <div class="form-group full">
              <label class="form-label">Deskripsi</label>
              <textarea class="form-textarea" id="ed-desc" placeholder="Deskripsi singkat produk...">${esc(product.description||'')}</textarea>
            </div>
          </div>
        </div>

        <!-- IMAGES -->
        <div class="editor-card">
          <h3>🖼️ Foto Produk
            <small style="font-size:0.7rem;font-weight:400;color:var(--gray);margin-left:auto">Flipbook: hover otomatis ganti foto</small>
          </h3>
          <div class="image-grid" id="image-grid">${renderImageThumbs(product)}</div>

          <!-- Upload file -->
          <div class="upload-zone" id="upload-zone">
            <div class="upload-icon">📤</div>
            <p>Klik atau drag foto ke sini</p>
            <small>JPG, PNG, WebP — Max 2MB per foto</small>
            <input type="file" id="image-file-input" accept="image/*" multiple>
          </div>

          <!-- URL input -->
          <div class="url-input-row">
            <input type="text" id="img-url-input" placeholder="Atau masukkan URL foto...">
            <button onclick="Dashboard.addImageUrl()">+ Tambah URL</button>
          </div>
        </div>

        <!-- ACTIONS -->
        <div class="editor-card">
          <h3>⚙️ Aksi</h3>
          <div class="action-strip">
            <button class="btn btn-success" onclick="Dashboard.saveProduct()">💾 Simpan Perubahan</button>
            <button class="btn btn-secondary" onclick="Dashboard.addProduct('${product.id}')">＋ Tambah Sub-Produk</button>
          </div>
          <div class="delete-zone" style="margin-top:1rem">
            <h4>⚠️ Hapus Produk</h4>
            <p>Menghapus produk ini beserta semua sub-produk di dalamnya. Tindakan tidak bisa dibatalkan.</p>
            <button class="btn btn-danger" onclick="Dashboard.confirmDelete('${product.id}')">🗑️ Hapus Produk Ini</button>
          </div>
        </div>

      </div>`;

    bindImageUpload();
    startFlipPreview(product);
  }

  function renderImageThumbs(product) {
    const imgs = product.images || [];
    if (imgs.length === 0) return '<p style="color:var(--gray);font-size:0.82rem;grid-column:1/-1">Belum ada foto. Tambah foto di bawah.</p>';
    return imgs.map((src, i) => `
      <div class="image-thumb" data-index="${i}">
        <img src="${src}" alt="foto ${i+1}" onerror="this.src='data:image/svg+xml,<svg xmlns=\\'http://www.w3.org/2000/svg\\'><rect width=\\'100%\\' height=\\'100%\\' fill=\\'%23eee\\'/></svg>'">
        <button class="img-remove" onclick="Dashboard.removeImage(${i})" title="Hapus">✕</button>
        <span class="img-order">${i+1}</span>
      </div>`).join('');
  }

  // ── IMAGE ACTIONS ────────────────────────────
  function bindImageUpload() {
    const zone = document.getElementById('upload-zone');
    const fileInput = document.getElementById('image-file-input');
    if (!zone || !fileInput) return;

    zone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', e => handleFiles(e.target.files));

    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
    zone.addEventListener('drop', e => {
      e.preventDefault();
      zone.classList.remove('dragover');
      handleFiles(e.dataTransfer.files);
    });
  }

  function handleFiles(files) {
    Array.from(files).forEach(file => {
      if (!file.type.startsWith('image/')) return;
      if (file.size > 2 * 1024 * 1024) { showToast(`${file.name} terlalu besar (max 2MB)`, 'error'); return; }
      const reader = new FileReader();
      reader.onload = e => {
        addImageToProduct(e.target.result);
      };
      reader.readAsDataURL(file);
    });
  }

  function addImageUrl() {
    const input = document.getElementById('img-url-input');
    const url = input?.value?.trim();
    if (!url) return;
    if (!url.startsWith('http')) { showToast('URL tidak valid', 'error'); return; }
    addImageToProduct(url);
    input.value = '';
  }

  function addImageToProduct(src) {
    if (!selectedId) return;
    const product = findById(selectedId);
    if (!product) return;
    product.images = product.images || [];
    product.images.push(src);
    save();
    refreshImageGrid(product);
    showToast('Foto ditambahkan ✓', 'success');
  }

  function removeImage(index) {
    if (!selectedId) return;
    const product = findById(selectedId);
    if (!product || !product.images) return;
    product.images.splice(index, 1);
    save();
    refreshImageGrid(product);
    showToast('Foto dihapus');
  }

  function refreshImageGrid(product) {
    const grid = document.getElementById('image-grid');
    if (grid) grid.innerHTML = renderImageThumbs(product);
    startFlipPreview(product);
  }

  // ── FLIPBOOK PREVIEW ─────────────────────────
  function startFlipPreview(product) {
    // no preview panel needed; flipbook is in catalog
  }

  // ── SAVE PRODUCT ─────────────────────────────
  function saveProduct() {
    if (!selectedId) return;
    const product = findById(selectedId);
    if (!product) return;

    const name = document.getElementById('ed-name')?.value?.trim();
    if (!name) { showToast('Nama produk wajib diisi', 'error'); return; }

    product.name = name;
    product.category = document.getElementById('ed-category')?.value?.trim() || '';
    product.price = document.getElementById('ed-price')?.value?.trim() || '';
    product.description = document.getElementById('ed-desc')?.value?.trim() || '';

    save();
    renderSidebar();
    showToast('Produk disimpan ✓', 'success');
  }

  // ── ADD PRODUCT ──────────────────────────────
  function addProduct(parentId) {
    const name = prompt('Nama produk baru:');
    if (!name?.trim()) return;

    const newProduct = {
      id: generateId(name.trim(), parentId),
      name: name.trim(),
      category: '',
      description: '',
      price: '',
      images: [],
      children: []
    };

    if (parentId) {
      const parent = findById(parentId);
      if (parent) {
        parent.children = parent.children || [];
        parent.children.push(newProduct);
      }
    } else {
      data.products.push(newProduct);
    }

    save();
    renderSidebar();
    selectProduct(newProduct.id);
    showToast(`"${name}" ditambahkan ✓`, 'success');
  }

  // ── DELETE ───────────────────────────────────
  function confirmDelete(id) {
    const product = findById(id);
    if (!product) return;
    openModal(
      'Hapus Produk?',
      `Yakin ingin menghapus <strong>${product.name}</strong>${product.children?.length ? ` beserta <strong>${product.children.length} sub-produk</strong>` : ''}? Tindakan ini tidak bisa dibatalkan.`,
      () => {
        deleteById(id);
        save();
        selectedId = null;
        renderSidebar();
        renderWelcome();
        showToast('Produk dihapus');
      }
    );
  }

  // ── SETTINGS ─────────────────────────────────
  function renderSettings() {
    selectedId = null;
    renderSidebar();
    const content = document.getElementById('content-area');
    if (!content) return;
    const s = data.settings || {};
    content.innerHTML = `
      <div class="editor-panel">
        <div class="editor-card">
          <h3>⚙️ Pengaturan Situs</h3>
          <div class="settings-grid">
            <div class="form-group">
              <label class="form-label">Nama Situs</label>
              <input class="form-input" id="set-name" value="${esc(s.siteName||'')}" placeholder="Undangan.id">
            </div>
            <div class="form-group">
              <label class="form-label">Nomor WhatsApp</label>
              <input class="form-input" id="set-wa" value="${esc(s.whatsapp||'')}" placeholder="628123456789">
            </div>
            <div class="form-group full">
              <label class="form-label">Tagline / Slogan</label>
              <input class="form-input" id="set-tagline" value="${esc(s.tagline||'')}" placeholder="Koleksi undangan premium...">
            </div>
          </div>
          <div style="margin-top:1.25rem">
            <button class="btn btn-success" onclick="Dashboard.saveSettings()">💾 Simpan Pengaturan</button>
          </div>
        </div>

        <div class="editor-card">
          <h3>📦 Export / Import Data</h3>
          <p style="font-size:0.85rem;color:var(--gray);margin-bottom:1rem;line-height:1.5">Export data katalog ke file JSON untuk backup atau pindah ke server lain. Import untuk restore data.</p>
          <div class="action-strip">
            <button class="btn btn-primary" onclick="Dashboard.exportData()">⬇️ Export JSON</button>
            <button class="btn btn-secondary" onclick="document.getElementById('import-input').click()">⬆️ Import JSON</button>
            <input type="file" id="import-input" accept=".json" style="display:none" onchange="Dashboard.importData(this)">
          </div>
        </div>

        <div class="editor-card">
          <h3>⚠️ Reset Data</h3>
          <p style="font-size:0.85rem;color:var(--gray);margin-bottom:1rem">Hapus semua produk dan kembali ke pengaturan default.</p>
          <button class="btn" style="background:var(--danger);color:white" onclick="Dashboard.confirmReset()">🗑️ Reset Semua Data</button>
        </div>
      </div>`;
  }

  function saveSettings() {
    data.settings = data.settings || {};
    data.settings.siteName = document.getElementById('set-name')?.value?.trim() || '';
    data.settings.tagline = document.getElementById('set-tagline')?.value?.trim() || '';
    data.settings.whatsapp = document.getElementById('set-wa')?.value?.trim() || '';
    save();
    showToast('Pengaturan disimpan ✓', 'success');
  }

  // ── EXPORT / IMPORT ──────────────────────────
  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `katalog-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Data di-export ✓', 'success');
  }

  function importData(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const imported = JSON.parse(e.target.result);
        if (!imported.products) throw new Error('Format tidak valid');
        data = imported;
        save();
        renderSidebar();
        renderWelcome();
        showToast('Data berhasil di-import ✓', 'success');
      } catch(err) {
        showToast('Gagal import: file tidak valid', 'error');
      }
    };
    reader.readAsText(file);
    input.value = '';
  }

  function confirmReset() {
    openModal(
      'Reset Semua Data?',
      'Yakin? Semua produk dan pengaturan akan dihapus permanen.',
      () => {
        localStorage.removeItem(STORAGE_KEY);
        location.reload();
      }
    );
  }

  // ── ADD ROOT PRODUCT ─────────────────────────
  function addRootProduct() { addProduct(null); }

  // ── WELCOME / EMPTY STATE ────────────────────
  function renderWelcome() {
    const content = document.getElementById('content-area');
    if (!content) return;
    const count = countAll(data.products);
    content.innerHTML = `
      <div class="welcome-state">
        <div class="big-icon">📋</div>
        <h2>Dashboard Katalog</h2>
        <p>Pilih produk di sidebar untuk mengedit, atau tambah produk baru. Saat ini terdapat <strong>${count} produk</strong> di katalog.</p>
        <button class="btn btn-primary" onclick="Dashboard.addRootProduct()" style="margin:0 auto">＋ Tambah Produk Baru</button>
      </div>`;
  }

  function countAll(nodes) {
    let c = 0;
    (nodes||[]).forEach(n => { c++; if(n.children) c += countAll(n.children); });
    return c;
  }

  // ── TOPBAR ───────────────────────────────────
  function bindTopbar() {
    document.getElementById('btn-add-root')?.addEventListener('click', addRootProduct);
    document.getElementById('btn-settings')?.addEventListener('click', renderSettings);
    document.getElementById('btn-preview')?.addEventListener('click', () => {
      window.open('index.html', '_blank');
    });
  }

  // ── MODAL ────────────────────────────────────
  let modalCallback = null;

  function openModal(title, body, onConfirm) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal-overlay').classList.add('open');
    modalCallback = onConfirm;
  }

  function bindModal() {
    document.getElementById('modal-cancel')?.addEventListener('click', closeModal);
    document.getElementById('modal-confirm')?.addEventListener('click', () => {
      const cb = modalCallback; // simpan dulu sebelum closeModal() null-kan
      closeModal();
      if (cb) cb();
    });
    document.getElementById('modal-overlay')?.addEventListener('click', e => {
      if (e.target.id === 'modal-overlay') closeModal();
    });
  }

  function closeModal() {
    document.getElementById('modal-overlay')?.classList.remove('open');
    modalCallback = null;
  }

  // ── TOAST ────────────────────────────────────
  function showToast(msg, type) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.className = `toast ${type || ''} show`;
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.remove('show'), 3000);
  }

  // ── UTIL ─────────────────────────────────────
  function esc(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // ── PUBLIC ───────────────────────────────────
  return {
    init,
    saveProduct,
    addProduct,
    addRootProduct,
    confirmDelete,
    removeImage,
    addImageUrl,
    saveSettings,
    exportData,
    importData,
    confirmReset,
    renderSettings
  };
})();

document.addEventListener('DOMContentLoaded', () => {
  // Hanya init dashboard kalau sudah terautentikasi
  // Auth check dilakukan oleh auth.js
  const sessionKey = 'dash_auth_v1';
  if (sessionStorage.getItem(sessionKey) === 'ok') {
    Dashboard.init();
  }
  // Kalau belum auth, auth.js yang akan panggil Dashboard.init() setelah login sukses
});
