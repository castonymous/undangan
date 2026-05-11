# 📋 Katalog Undangan — Static Site

Katalog produk undangan dengan nested categories, flipbook effect, dan dashboard admin.
Deploy ke Vercel atau GitHub Pages tanpa backend.

---

## 📁 Struktur File

```
katalog-undangan/
├── index.html       → Halaman katalog (publik)
├── dashboard.html   → Dashboard admin (untuk upload produk)
├── style.css        → Styling katalog
├── dashboard.css    → Styling dashboard
├── app.js           → Logic katalog (navigasi, flipbook, search)
├── dashboard.js     → Logic dashboard (CRUD, upload, export)
├── data.json        → Data produk default (fallback)
└── vercel.json      → Config deploy Vercel
```

---

## 🚀 Cara Deploy

### Vercel (Recommended)
1. Upload semua file ke GitHub repository
2. Buka [vercel.com](https://vercel.com) → Import repository
3. Pilih repo → Deploy (otomatis)
4. Done! Katalog live di `https://nama-repo.vercel.app`

### GitHub Pages
1. Upload semua file ke repo GitHub
2. Settings → Pages → Source: `main branch / root`
3. Done! Live di `https://username.github.io/nama-repo`

---

## 📦 Cara Pakai Dashboard

1. Buka `dashboard.html`
2. Klik **＋ Produk Baru** untuk tambah produk utama (contoh: FADHIL)
3. Di dalam produk, klik **Tambah Sub-Produk** untuk nested (contoh: Classic, Modern)
4. Nested bisa terus ke bawah (Classic → Softcover, Hardcover, dst)
5. Upload foto via drag & drop atau URL
6. Klik **Simpan Perubahan**
7. Klik **Export JSON** untuk backup data ke file

> ⚠️ Data disimpan di `localStorage` browser. Gunakan **Export JSON** untuk backup,
> dan simpan file `data.json` di repository untuk data default.

---

## 🖼️ Flipbook Effect

- Setiap produk bisa punya **banyak foto**
- Saat mouse hover di kartu produk → foto otomatis berganti (flipbook)
- Di mobile → swipe kiri/kanan untuk ganti foto
- Urutan foto = urutan saat upload

---

## 🔗 Integrasi WhatsApp

Set nomor WA di **Dashboard → Pengaturan**.
Format: `628123456789` (tanpa + atau spasi).

Saat user klik "Pesan", otomatis buka WA dengan pesan:
```
Halo, saya tertarik dengan produk:
*FADHIL › Classic › Softcover*
Harga: Rp 150.000

Mohon info lebih lanjut 🙏
```

---

## 📊 Cara Update Produk Permanen

Karena ini static site, data di-reset kalau localStorage kosong.
Untuk data permanen di production:

1. Setelah selesai atur di dashboard, klik **Export JSON**
2. Ganti isi file `data.json` dengan file hasil export
3. Push ke GitHub / redeploy ke Vercel

---

## 🎨 Customisasi

Edit variabel warna di `style.css`:
```css
:root {
  --gold: #C9A84C;      /* Warna emas utama */
  --cream: #FAF6EF;     /* Background utama */
  --charcoal: #1A1A1A;  /* Warna gelap/teks */
}
```
