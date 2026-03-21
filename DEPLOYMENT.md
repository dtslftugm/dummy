# Deployment Guide - Quick Reference

## 🎯 Ringkasan Cepat

### Backend (Google Apps Script)

✅ **SUDAH SELESAI** - Code.gs sudah di-update dengan API router

**Tinggal deploy:**
1. Buka Apps Script Editor
2. Deploy → New Deployment → Web App
3. Execute as: Me | Access: Anyone
4. **COPY DEPLOYMENT URL**

### Frontend (GitHub Pages)

**Upload folder `frontend/` ke GitHub:**

1. **Buat Repository**
   - https://github.com/new
   - Name: `komputasi-dtsl-frontend`
   - Public
   - Create

2. **Upload Files**
   - Add file → Upload files
   - Drag semua file dari `c:\github_komputasi\frontend\`
   - Commit

3. **Enable Pages**
   - Settings → Pages
   - Branch: main, Folder: / (root)
   - Save

4. **Update Config**
   Edit `js/config.js`, ganti:
   ```javascript
   API_URL: 'PASTE_DEPLOYMENT_URL_DARI_STEP_BACKEND_#4'
   ```

5. **Upload lagi file config.js yang sudah diupdate**

---

## ✅ Checklist Deployment

### Backend
- [ ] Code.gs sudah diupdate (✅ DONE)
- [ ] Deploy as Web App
- [ ] Copy deployment URL
- [ ] (Optional) Set ADMIN_PASSWORD_HASH di Config sheet

### Frontend  
- [ ] Create GitHub repository
- [ ] Upload all files dari folder `frontend/`
- [ ] Enable GitHub Pages
- [ ] Update `js/config.js` dengan deployment URL
- [ ] Upload ulang config.js
- [ ] Test website

---

## 🔗 URLs setelah Deploy

**Frontend**: `https://YOUR_USERNAME.github.io/komputasi-dtsl-frontend/`

**Backend API**: `https://script.google.com/macros/s/DEPLOYMENT_ID/exec`

---

## 🧪 Test API (Sebelum Deploy Frontend)

Buka di browser:
```
https://script.google.com/macros/s/DEPLOYMENT_ID/exec?path=initial-data
```

Harus return JSON dengan `success: true`.

---

## ⏱️ Estimasi Waktu

- Backend deploy: **5 menit**
- Upload ke GitHub: **10 menit**
- Total: **~15 menit** ✨
