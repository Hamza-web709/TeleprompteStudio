# Teleprompter Studio Pro

A production-ready, studio-grade creative teleprompter, video recording platform, script management tool, and creator presentation suite built with **modern Vanilla JavaScript (ES2022+)**, **CSS3**, and **HTML5**.

Designed for both traditional development environments and static-first hosting platforms such as InfinityFree, GitHub Pages, and Netlify.

---

## Key Features

1. **Camera Overlay & Multi-Layer Stacking**:
   - Live camera preview with front/rear device switching.
   - 4-layer deterministic stacking hierarchy:
     - **Layer 1:** Background canvas / Raw camera video (z-index: 1)
     - **Layer 2:** High-contrast readability dimming backdrop (35% opacity overlay)
     - **Layer 3:** Teleprompter script viewport and rendered typography (z-index: 2)
     - **Layer 4:** Focus ruler guides and presenter eye-contact indicator (z-index: 30)
   - Transparent prompter frame when camera is active; solid background cleanly restored upon camera stop.

2. **Full Typography & Workspace Customization**:
   - Granular **Font Weight** scaling from Light (300) to Ultra-Bold (900).
   - Continuous **Line Spacing** control from Compact (1.0) to Spacious (3.0).
   - Dynamic font families (System Sans, Inter, Roboto, Playfair Display, Monospace, Urdu Nastaliq RTL, Hindi Devanagari).
   - Text color, text outline/glow, adjustable reading column width, and custom backdrop themes.
   - Preset management with instant saving and one-click recall.

3. **Intelligent Continuous Voice Recognition**:
   - Web Speech API integration with dynamic-programming speech-to-text token alignment.
   - Paces script scrolling to the presenter's natural speaking cadence.
   - Full suite of hands-free voice commands:
     - **Play** / **Resume** — Starts or resumes script scrolling.
     - **Pause** — Halts scrolling at current position.
     - **Stop** — Pauses and rewinds script to top.
     - **Faster** / **Slower** — Dynamically adjusts scroll speed.
   - Decoupled user intent state, debounced auto-reconnection on browser onend events, non-destructive silence recovery, and duplicate-command debouncing (800ms).
   - Operates 100% client-side in the browser—zero server-side voice processing required.

4. **Dual Recording Pipeline**:
   - **Clean Recording (Creator Mode):** Directly captures raw camera video and microphone audio via MediaRecorder. Presenter reads the scrolling script on-screen, but the exported video file is completely free of teleprompter text.
   - **Composite Recording:** Optionally records the canvas composition including text overlay for video tutorials and social clips.

5. **Local-First Architecture & Offline PWA**:
   - Complete IndexedDB persistence (scripts, olders, presets, ehearsals, ecordings).
   - Full JSON script library backup export & restore.
   - Service worker caching (sw.js) and Web App Manifest (manifest.webmanifest) for offline installation.

6. **Multi-Window & Remote Control**:
   - Presenter popout window synchronized in real time via BroadcastChannel.
   - Touch-first phone remote controller interface (emote.html) with instant QR pairing.
   - Same-origin BroadcastChannel synchronization for multi-tab setups.

---

## Technology Stack

- **Core:** HTML5, Modern Vanilla JavaScript (ES2022+ modules)
- **Styling:** CSS3 custom properties (design tokens), responsive flexbox and CSS grid
- **Build Tool:** Vite
- **Unit Testing:** Vitest
- **APIs:** MediaDevices, MediaRecorder, SpeechRecognition, IndexedDB, BroadcastChannel, ServiceWorker

---

## Quick Start & Development

### 1. Prerequisites
- Node.js (v18 or higher recommended)
- Modern web browser (Google Chrome, Microsoft Edge, Brave, or Safari)

### 2. Installation
`ash
npm install
`

### 3. Development Server
Start the local Vite development server:
`ash
npm run dev
`

### 4. Running Unit Tests
Execute the Vitest test suite:
`ash
npm test
`

### 5. Production Build
Compile the optimized production bundle:
`ash
npm run build
`
Production assets are generated into dist/ with relative asset links (ase: './'), ready for direct deployment.

### 6. Preview Production Build
Preview the compiled static bundle locally:
`ash
npm run preview
`

---

## InfinityFree & Static Hosting Deployment

This project is tailored for static-first hosting providers like InfinityFree:

1. **Static Output:** Run 
pm run build. The generated dist/ directory contains all assets, HTML entry points, and an Apache .htaccess file.
2. **Apache Configuration:** The included .htaccess automatically configures:
   - MIME types for .js, .mjs, .webmanifest, and .json.
   - Long-term caching for immutable assets (/assets/*).
   - Single-Page Application (SPA) fallback to index.html.
3. **Relative Paths:** Configured with relative asset resolution (ase: './'), allowing hosting at domain roots or within subdirectories.
4. **Zero Backend Required for Core App:** All core features (teleprompter, camera overlay, clean video recording, voice tracking, typography, local storage) execute entirely inside the client's web browser.

---

## HTTPS & Hardware Requirements

- **Camera & Microphone Access:** Modern browsers strictly require a **Secure Context (HTTPS or localhost)** to access 
avigator.mediaDevices.getUserMedia().
- **Speech Recognition:** The Web Speech API also requires HTTPS when served over a network.
- **Hosting Tip:** Ensure your InfinityFree domain has a free SSL certificate installed (or is routed through Cloudflare SSL) before accessing camera and microphone features.

---

## Browser Compatibility & Limitations

- **Chromium Browsers (Chrome, Edge, Brave, Samsung Internet):** Full support for all features including SpeechRecognition, MediaRecorder, and Camera Overlay.
- **Safari / iOS:** Camera and MediaRecorder are supported. SpeechRecognition requires explicit user activation per session due to WebKit privacy policies.
- **Firefox:** Full support for teleprompter, typography, camera, and recording. Speech recognition is disabled by default in Firefox unless enabled in experimental flags (media.webspeech.recognition.enable).
- **Graceful Fallbacks:** On browsers where Speech Recognition is unavailable, voice controls display a clear fallback notice while manual controls, keyboard shortcuts, and speed adjustments continue functioning normally.

---

## Cross-Device Remote Control Architecture

- **Same-Device Multi-Tab Sync:** Works immediately out of the box using the browser's native BroadcastChannel API (e.g., dual monitor setup on the same laptop).
- **Cross-Device Remote Control (e.g., Mobile Phone to Laptop):** Free static hosting platforms such as InfinityFree do not host persistent Node.js or WebSocket server processes. To pair a separate physical mobile device with a desktop over the internet, configure an external WebSocket relay service (WSS) or cloud relay in .env (VITE_REMOTE_WS_URL). If no external server is present, the remote controller operates in standby mode.

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| Space | Play / Pause teleprompter scrolling |
| Up / Down | Increase / Decrease scrolling speed |
| Left / Right | Jump backward / forward 5 seconds |
| Home | Restart script from top |
| M | Toggle horizontal mirror flip |
| F | Toggle fullscreen reading mode |
| Esc | Close open modals or exit fullscreen |

---

## License

MIT License. Designed and built for creators and presenters.