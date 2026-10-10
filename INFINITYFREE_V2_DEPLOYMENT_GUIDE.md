# Teleprompter Studio Pro — InfinityFree V2 Deployment Guide
**Project Location:** `D:\Teleprompter-Studio-InfinityFree-v2`  
**Target Platform:** InfinityFree Free Hosting (Apache / Static Frontend)  
**Version:** 2.0.0 (Production Release with Full Typography Fixes)  
**Date:** October 10, 2026

---

## 1. Overview & Build Deliverables

Teleprompter Studio Pro V2 is compiled as a 100% static, client-side web application designed to run seamlessly on InfinityFree's standard LAMP/Apache free hosting infrastructure.

### Distribution Files
- **Production Directory:** `D:\Teleprompter-Studio-InfinityFree-v2\dist`
- **Pre-packaged ZIP Archive:** `D:\Teleprompter-Studio-InfinityFree-v2\teleprompter-infinityfree-v2-dist.zip` (1.25 MB)

Both include:
1. `index.html` — Main studio interface with relative assets and full Google Fonts weights.
2. `remote.html` — Companion mobile controller with BroadcastChannel & external relay support.
3. `manifest.webmanifest` — PWA manifest configured with relative scope (`./`).
4. `sw.js` — Service worker with `teleprompter-studio-v2` cache version and stale-while-revalidate strategy.
5. `assets/` — Code-split, hashed production JavaScript chunks and CSS stylesheets.
6. `.htaccess` — Apache server configuration with mod_rewrite, MIME types, and cache headers.

---

## 2. InfinityFree Upload Procedure

### Method A: Monsta FTP / File Manager (Recommended)
1. Log into your **InfinityFree Client Area** and navigate to your hosting account control panel.
2. Open the **Online File Manager** (Monsta FTP).
3. Navigate into your website's **`htdocs`** directory (e.g. `/yourdomain.com/htdocs` or `/htdocs`).
4. Delete or move any default placeholder files (e.g. default `index2.html`).
5. Click **Upload** -> **Upload Zip**.
6. Select `D:\Teleprompter-Studio-InfinityFree-v2\teleprompter-infinityfree-v2-dist.zip`.
7. Once uploaded, right-click the zip archive and choose **Extract**.
8. Ensure all files (`index.html`, `remote.html`, `.htaccess`, `assets/`, etc.) reside directly in `htdocs`, not inside a nested subfolder.
9. Delete the uploaded zip archive from `htdocs`.

### Method B: Desktop FTP Client (FileZilla / WinSCP)
1. Obtain your FTP credentials from the InfinityFree client panel (Host: `ftpupload.net`, Username, Password, Port: `21`).
2. Connect to the server and navigate into the target **`htdocs`** folder.
3. Upload all files and folders directly from `D:\Teleprompter-Studio-InfinityFree-v2\dist\`.
4. Ensure the hidden file **`.htaccess`** is uploaded.

---

## 3. HTTPS & Browser Security Requirements

> [!IMPORTANT]
> Modern browser security policies strictly require a secure origin (`https://`) for hardware access.

When hosted on InfinityFree:
- **Camera & Microphone:** Require HTTPS for user permission dialogs.
- **Web Speech API:** Voice-follow scrolling requires HTTPS on live domains.
- **Service Worker / PWA:** Offline capabilities require HTTPS.

**To enable free HTTPS on InfinityFree:**
1. In the InfinityFree Client Area, click **Free SSL Certificates**.
2. Select your domain and generate a certificate (Let's Encrypt or GoGetSSL).
3. Follow the DNS CNAME verification prompts.
4. Click **Install SSL Certificate Automatically**.

---

## 4. Script Data Migration & Backup / Restore

Because IndexedDB is scoped strictly to the origin (`http://localhost:3000` vs `https://yourdomain.epizy.com`), scripts created locally do not automatically appear on the remote domain.

### To Migrate Your Scripts:
1. In your local development studio (`http://localhost:3000`), open **Settings** -> **Data & Backups**.
2. Click **Export All Data (JSON Backup)** to download your scripts and settings.
3. On your live InfinityFree site, open **Settings** -> **Data & Backups**.
4. Click **Import Backup (JSON)** and select your exported file.
5. All scripts, custom presets, and configurations will instantly be restored.

---

## 5. Local Development & Preview Commands

For local testing inside `D:\Teleprompter-Studio-InfinityFree-v2`:

| Command | Action | URL |
|---|---|---|
| `npm run build` | Compile optimized production bundle to `dist/` | — |
| `npm run preview` | Launch strict production preview on port 3201 | `http://localhost:3201/` |
| `npm run dev` | Launch Vite development server on port 3200 | `http://localhost:3200/` |
| `npm test` | Run Vitest unit test suite (38 tests) | — |
| `node tests/test-typography-rendering-fix.js` | Run Playwright typography validation suite | — |
| `node tests/test-infinityfree-production.js` | Run full static production audit | — |
