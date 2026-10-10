# Teleprompter Studio Pro - Architecture & Technical Design

## 1. Executive Overview
**Teleprompter Studio Pro** is a high-performance, studio-grade creative production tool designed for content creators, broadcasters, educators, and public speakers. Built with semantic HTML5, modern CSS3 custom properties, and modular Vanilla JavaScript (ES2022+), it provides professional teleprompter functionality, clean video/audio recording, speech-following teleprompting, multi-screen mirroring, and mobile remote control without the overhead of heavy frontend frameworks.

---

## 2. Technical Stack
- **Core Frontend**: HTML5, CSS3, Vanilla JavaScript (ES Modules, ES2022+).
- **Styling Architecture**: Pure CSS with modular design tokens, HSL color space, responsive layouts (Flexbox & CSS Grid), fluid typography, and zero third-party CSS dependencies.
- **Persistent Storage**: IndexedDB (Local-First) with automated migrations and JSON backup/restore.
- **Media Pipeline**:
  - `navigator.mediaDevices.getUserMedia` for hardware cameras and microphones.
  - `MediaRecorder` API with multi-codec fallback (`video/webm;codecs=vp9,opus`, `video/mp4`).
  - Web Audio API (`AudioContext`, `AnalyserNode`, `GainNode`) for real-time VU monitoring and gain control.
  - HTML5 Canvas for composite overlays, chroma-keying, and video frame manipulation.
- **Speech Engine**: Web Speech API (`SpeechRecognition`) paired with a custom dynamic-programming token alignment engine for word-by-word tracking.
- **Sync & Remote Pipeline**:
  - `BroadcastChannel` & `postMessage` for multi-window external monitor synchronization.
  - Lightweight WebSocket server (`server/index.js`) for local-network phone QR remote control.
- **Offline / PWA**: Service Worker caching (`sw.js`) and W3C Web App Manifest.
- **Build & Test Tooling**: Vite for fast bundling and Vitest for unit & integration testing.

---

## 3. Module Hierarchy & Directory Structure

```
d:/Teleprompter-Studio/
├── index.html                  # Main Studio Shell
├── vite.config.js              # Vite tooling configuration
├── package.json                # Dependencies and scripts
├── public/
│   ├── manifest.webmanifest   # PWA Manifest
│   ├── sw.js                  # Service Worker
│   ├── icons/                 # PWA & UI icons
│   └── audio/                 # Audio cue synth fallbacks
├── server/
│   ├── index.js               # Node.js WebSocket & remote sync server
│   └── ai-proxy.js            # Extensible server-side AI provider proxy
├── src/
│   ├── main.js                # App entrypoint & bootstrapper
│   ├── state/
│   │   ├── appState.js        # Central reactive state store
│   │   └── eventBus.js        # Publish/subscribe event bus
│   ├── styles/
│   │   ├── tokens.css         # Design tokens (colors, spacing, typography)
│   │   ├── base.css           # Global resets and root styles
│   │   ├── layout.css         # 5-panel studio layout grid
│   │   ├── components.css     # Buttons, sliders, switches, modals, toolbars
│   │   ├── responsive.css     # Tablet and mobile viewport rules
│   │   └── themes.css         # Dark studio, light reading, high contrast, chroma themes
│   ├── modules/
│   │   ├── storage/
│   │   │   ├── db.js          # IndexedDB wrapper & schema migrations
│   │   │   └── backup.js      # Full JSON backup & restoration
│   │   ├── scripts/
│   │   │   ├── scriptManager.js # CRUD, folders, favorites, tags, search
│   │   │   └── analytics.js   # Word count, WPM, reading duration estimator
│   │   ├── editor/
│   │   │   ├── editor.js      # Rich-text editor with RTL, undo/redo, search/replace
│   │   │   └── sanitizer.js   # HTML & content sanitizer
│   │   ├── teleprompter/
│   │   │   ├── renderer.js    # Teleprompter DOM rendering & token mapping
│   │   │   └── overlay.js     # Distraction-free & popout viewport
│   │   ├── scrolling/
│   │   │   ├── scrollEngine.js # rAF-based delta-time scroll engine
│   │   │   └── countdown.js   # Visual countdown & audio beep cues
│   │   ├── typography/
│   │   │   └── typography.js  # Live CSS custom properties for fonts/sizing
│   │   ├── backgrounds/
│   │   │   ├── background.js  # Solid, gradient, custom images, chroma key
│   │   │   └── contrast.js    # WCAG 2.2 AA contrast ratio validator
│   │   ├── reading-focus/
│   │   │   └── focusSystem.js # Focus line, ruler, active sentence, eye guide
│   │   ├── display/
│   │   │   ├── mirror.js      # Horizontal/Vertical mirror transforms
│   │   │   └── externalDisplay.js # BroadcastChannel secondary screen sync
│   │   ├── camera/
│   │   │   ├── cameraManager.js # Camera enumeration, stream acquisition
│   │   │   └── audioManager.js  # VU meter, gain control, noise filters
│   │   ├── recording/
│   │   │   ├── mediaRecorder.js # Clean vs Composite recording engine
│   │   │   └── recordingLibrary.js # Recorded clip management & download
│   │   ├── voice-tracking/
│   │   │   ├── speechEngine.js  # Web Speech API wrapper & recognition events
│   │   │   └── aligner.js       # Dynamic token alignment algorithm & fuzzy match
│   │   ├── remote/
│   │   │   ├── remoteServerSync.js # WebSocket & BroadcastChannel remote handler
│   │   │   ├── qrPairing.js     # QR code generator for phone pairing
│   │   │   └── keyboardControls.js # Customizable shortcut dispatcher
│   │   ├── rehearsals/
│   │   │   └── rehearsalManager.js # Practice timer, target vs actual pace, history
│   │   ├── video-editor/
│   │   │   ├── videoEditor.js   # Trim start/end, crop, filters, thumbnails
│   │   │   └── captionEditor.js # Subtitles editor, VTT/SRT export & burn-in
│   │   ├── ai-integrations/
│   │   │   ├── aiProviderBase.js # Base adapter interface for AI services
│   │   │   └── providerManager.js # Eye-contact, background segmentation status
│   │   ├── presets/
│   │   │   └── presetManager.js # 12 studio presets + custom user presets
│   │   ├── i18n/
│   │   │   ├── i18n.js        # Localization engine (English, Hindi, Urdu)
│   │   │   └── locales.js     # Translation dictionaries & RTL rules
│   │   └── accessibility/
│   │       └── a11y.js        # ARIA announcements, focus traps, shortcuts modal
│   └── components/
│       ├── modal.js           # Accessible dialog manager
│       ├── toast.js           # Non-intrusive notifications
│       └── slider.js          # Studio range sliders with live readouts
├── tests/
│   └── unit/
│       ├── aligner.test.js    # Speech alignment unit tests
│       ├── analytics.test.js  # Word count & reading calculations
│       ├── contrast.test.js   # Contrast ratio validation tests
│       └── db.test.js         # IndexedDB & storage test suites
└── docs/
    ├── ARCHITECTURE.md
    └── USER_GUIDE.md
```

---

## 4. State Management Architecture
A centralized `appState` provides predictable transitions across modular sub-states:

```
appState:
├── activeScript: { id, title, content, notes, folder, tags, isFavorite, updatedAt }
├── playbackState: 'idle' | 'ready' | 'countdown' | 'playing' | 'paused' | 'stopped'
├── recordingState: 'inactive' | 'countdown' | 'recording' | 'paused' | 'processing'
├── voiceState: 'disabled' | 'listening' | 'following' | 'paused' | 'unsupported'
├── scrollSettings: { speed, mode, wpm, reverse, loop }
├── typographySettings: { font, size, weight, color, align, lineSpacing, letterSpacing, containerWidth }
├── backgroundSettings: { type, color, gradient, image, blur, brightness, opacity }
├── focusSettings: { enabled, linePosition, rulerThickness, activeHighlight, eyeGuide, fadeMask }
├── displaySettings: { mirrorX, mirrorY, aspectRatio, fullscreen, cleanReading }
├── mediaSettings: { cameraDeviceId, micDeviceId, resolution, fps, cleanRecord }
└── remoteSession: { paired, token, wsConnected }
```

State changes emit events through `eventBus`, decoupling UI controls from media capture, rendering loops, and network synchronization.

---

## 5. Clean Recording Architecture vs Composite Recording
To satisfy the strict requirement:
> "By default, recorded video must contain the camera footage and selected audio. Teleprompter text must NOT be visible in the exported recording."

- **Clean Recording Pipeline (Default)**:
  - Video stream is captured directly from `navigator.mediaDevices.getUserMedia({ video, audio })`.
  - The live video stream is piped to the background `<video id="camera-preview">`.
  - The teleprompter overlay sits above the video preview with high-contrast text and focus ruler.
  - The `MediaRecorder` records **strictly the raw camera stream**. The text overlay is completely invisible in the saved file.
- **Composite Recording Pipeline (Creator Shorts Mode)**:
  - When enabled by user toggle ("Record with Text Overlay"), a hidden high-performance `OffscreenCanvas` / `canvas.captureStream(30)` composites the video frame and rendered text, feeding that stream to `MediaRecorder`.

---

## 6. Voice Tracking & Dynamic Alignment Algorithm
1. The script text is tokenized into clean phonetic tokens (lowercased, punctuation stripped, normalized Unicode for Latin, Roman Urdu, Devanagari, and Arabic/Urdu scripts).
2. The browser `SpeechRecognition` emits continuous partial and final transcripts.
3. Transcripts are window-matched against script tokens starting from the last confirmed read position.
4. Levenshtein distance with threshold $\ge 0.70$ accommodates minor accent variations.
5. Once a sequence matches, the active reading position shifts smoothly, updating word highlighting and automatically pacing the scroll engine to match the speaker's natural cadence.
6. When silence occurs or speech pauses, scrolling pauses smoothly, preventing the prompter from running ahead of the speaker.
