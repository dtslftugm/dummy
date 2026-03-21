# Layanan Komputasi DTSL - Frontend

Frontend application untuk sistem manajemen layanan komputasi DTSL FT UGM.

## 📂 Project Structure

```
frontend/
├── index.html          # Main form (student submission)
├── admin.html          # Admin dashboard
├── css/
│   └── styles.css      # Shared styles
├── js/
│   ├── config.js       # Configuration (API URL)
│   └── api-client.js   # API wrapper functions
├── assets/             # Images (logo, etc)
└── README.md           # This file
```

## 🚀 Deployment ke GitHub Pages

### Step 1: Create Repository di GitHub

1. Login ke https://github.com
2. Klik tombol **"New"** (hijau di pojok kanan atas)
3. Repository name: `komputasi-dtsl-frontend`
4. Public
5. ✅ Check "Add a README file"
6. Klik **"Create repository"**

### Step 2: Upload Files

1. Di halaman repository, klik **"Add file"** → **"Upload files"**
2. Drag & drop semua file dari folder `frontend/` ini
3. Commit message: "Initial deployment"
4. Klik **"Commit changes"**

### Step 3: Enable GitHub Pages

1. Klik tab **"Settings"**
2. Scroll ke bawah, klik **"Pages"** (di sidebar kiri)
3. Source: **Deploy from a branch**
4. Branch: pilih **main**
5. Folder: pilih **/ (root)**
6. Klik **"Save"**
7. Tunggu 1-2 menit

### Step 4: Update Configuration

**PENTING:** Setelah deploy backend (Google Apps Script), update `js/config.js`:

```javascript
const CONFIG = {
  API_URL: 'https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec',
  // ... rest of config
};
```

Ganti `YOUR_DEPLOYMENT_ID` dengan deployment ID actual dari GAS.

### Step 5: Test

Website akan tersedia di:
```
https://YOUR_USERNAME.github.io/komputasi-dtsl-frontend/
```

## 🔧 Backend Setup (Google Apps Script)

### Deploy GAS sebagai Web App:

1. Buka Google Apps Script project yang sudah di-update
2. Klik **"Deploy"** → **"New deployment"**
3. Type: **Web app**
4. Execute as: **Me**
5. Who has access: **Anyone**
6. Klik **"Deploy"**
7. **Copy deployment URL** → Paste ke `js/config.js`

### Set Admin Password (Optional):

Di Google Sheet, sheet "Config", tambah row baru:

| Key | Value |
|-----|-------|
| ADMIN_PASSWORD_HASH | [hash from password] |

Untuk generate hash, run function `generatePasswordHash()` di GAS:

```javascript
function generatePasswordHash() {
  const password = 'your_admin_password_here';
  const hash = Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, password)
  );
  Logger.log(hash);
  return hash;
}
```

Copy hash ke Config sheet.

## 🧪 Testing Locally

### Option 1: Live Server (VS Code)

1. Install extension "Live Server" di VS Code
2. Right-click `index.html` → "Open with Live Server"
3. Browser akan terbuka di `http://localhost:5500`

### Option 2: Python HTTP Server

```bash
cd frontend
python -m http.server 8000
```

Buka `http://localhost:8000`

## 📝 Update Workflow

Setelah deployment pertama, untuk update:

1. Edit file lokal
2. Upload via GitHub web interface **atau**
3. Use Git:
   ```bash
   git add .
   git commit -m "Update form design"
   git push
   ```

GitHub Pages akan auto-rebuild (tunggu 1-2 menit).

## 🆘 Troubleshooting

### API calls gagal (CORS error)

- Pastikan `config.js` sudah diupdate dengan deployment URL yang benar
- Pastikan GAS di-deploy sebagai "Anyone can access"
- Cek console browser untuk error details

### Page tidak muncul setelah deploy

- Tunggu 2-3 menit (GitHub Pages perlu waktu build)
- Cek Settings → Pages untuk konfirmasi deployments aktif

### Form submit tidak working

- Buka browser console (F12) untuk lihat error
- Test backend API langsung dengan Postman
- Pastikan `Code.gs` sudah di-save dan di-deploy ulang

## 📚 Documentation

Untuk dokumentasi lengkap architecture & API, lihat:
- `codebase_analysis.md`
- `migration_plan.md`
- `implementation_plan.md`

## 📧 Support

Jika ada masalah, cek execution logs di Google Apps Script:
- View → Executions
- Lihat error messages

---

**Version**: 17.0  
**Last Updated**: 2026-02-09
