import { appState } from './state/appState.js';
import { eventBus } from './state/eventBus.js';
import { db } from './modules/storage/db.js';
import { exportAllData, importData } from './modules/storage/backup.js';
import { scriptManager } from './modules/scripts/scriptManager.js';
import { calculateScriptStats, formatTimeSeconds } from './modules/scripts/analytics.js';
import { scriptEditor } from './modules/editor/editor.js';
import { prompterRenderer } from './modules/teleprompter/renderer.js';
import { scrollEngine } from './modules/scrolling/scrollEngine.js';
import { countdownManager } from './modules/scrolling/countdown.js';
import { typographyEngine } from './modules/typography/typography.js';
import { backgroundManager } from './modules/backgrounds/background.js';
import { focusSystem } from './modules/reading-focus/focusSystem.js';
import { mirrorManager } from './modules/display/mirror.js';
import { externalDisplayManager } from './modules/display/externalDisplay.js';
import { cameraManager, resolveResolutionPreset } from './modules/camera/cameraManager.js';
import { audioManager } from './modules/camera/audioManager.js';
import { studioRecorder } from './modules/recording/mediaRecorder.js';
import { recordingLibrary } from './modules/recording/recordingLibrary.js';
import { recordingDiagnostics } from './modules/recording/recordingDiagnostics.js';
import { speechEngine } from './modules/voice-tracking/speechEngine.js';
import { qrPairingManager } from './modules/remote/qrPairing.js';
import { remoteServerSync } from './modules/remote/remoteServerSync.js';
import { keyboardController } from './modules/remote/keyboardControls.js';
import { rehearsalManager } from './modules/rehearsals/rehearsalManager.js';
import { presetManager, DEFAULT_PRESETS } from './modules/presets/presetManager.js';
import { videoEditor } from './modules/video-editor/videoEditor.js';
import { captionEditor } from './modules/video-editor/captionEditor.js';
import { aiProviderManager } from './modules/ai-integrations/providerManager.js';
import { i18n } from './modules/i18n/i18n.js';
import { a11y } from './modules/accessibility/a11y.js';
import { toast } from './components/toast.js';
import { modalManager } from './components/modal.js';
import { aspectRatioManager } from './modules/display/aspectRatioManager.js';
import { settingsSync } from './modules/storage/settingsSync.js';

// DOM Element References
const appContainer = document.getElementById('app-container');
const prompterViewport = document.getElementById('prompter-viewport');
const prompterTextContainer = document.getElementById('prompter-text-container');
const prompterFrame = document.getElementById('prompter-frame');
const editorWorkspace = document.getElementById('editor-workspace');
const scriptRichEditor = document.getElementById('script-rich-editor');
const creatorWorkspace = document.getElementById('creator-workspace');
const cameraPreviewVideo = document.getElementById('camera-preview-video');
const cameraPreviewContainer = document.getElementById('camera-preview-container');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownDigits = document.getElementById('countdown-digits');
const toastContainer = document.getElementById('toast-container');

// Top Navigation Elements
const activeScriptTitleInput = document.getElementById('active-script-title-input');
const saveDot = document.getElementById('save-dot');
const saveText = document.getElementById('save-text');
const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
const btnToggleSettings = document.getElementById('btn-toggle-settings');
const btnCloseSettingsX = document.getElementById('btn-close-settings-x');
const btnTopbarCamera = document.getElementById('btn-topbar-camera');
const camStatusLabel = document.getElementById('cam-status-label');
const btnOpenRemoteModal = document.getElementById('btn-open-remote-modal');
const btnExternalPopout = document.getElementById('btn-external-popout');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnShortcutsHelp = document.getElementById('btn-shortcuts-help');

// Mode Selector Tabs
const modeTabBtns = document.querySelectorAll('.mode-tab-btn');

// Playback Bar Elements
const btnPlaybackToggle = document.getElementById('btn-playback-toggle');
const iconPlay = document.getElementById('icon-play');
const iconPause = document.getElementById('icon-pause');
const btnPlaybackStop = document.getElementById('btn-playback-stop');
const btnJumpBackward = document.getElementById('btn-jump-backward');
const btnJumpForward = document.getElementById('btn-jump-forward');
const btnSpeedMinus = document.getElementById('btn-speed-minus');
const btnSpeedPlus = document.getElementById('btn-speed-plus');
const playbackSpeedIndicator = document.getElementById('playback-speed-indicator');
const btnStudioRecord = document.getElementById('btn-studio-record');
const recordBtnLabel = document.getElementById('record-btn-label');
const timeElapsed = document.getElementById('time-elapsed');
const timeRemaining = document.getElementById('time-remaining');
const statWordsCount = document.getElementById('stat-words-count');
const statTargetWpm = document.getElementById('stat-target-wpm');
const playbackProgressTrack = document.getElementById('playback-progress-track');
const playbackProgressFill = document.getElementById('playback-progress-fill');

// Sidebar Elements
const btnNewScript = document.getElementById('btn-new-script');
const inputImportScript = document.getElementById('input-import-script');
const scriptSearchInput = document.getElementById('script-search-input');
const scriptListContainer = document.getElementById('script-list-container');
const scriptCountBadge = document.getElementById('script-count-badge');
const btnToggleFavFilter = document.getElementById('btn-toggle-fav-filter');
const btnOpenRecLibrary = document.getElementById('btn-open-rec-library');
const recCountBadge = document.getElementById('rec-count-badge');
const selectLanguage = document.getElementById('select-language');
const btnExportBackup = document.getElementById('btn-export-backup');
const inputRestoreBackup = document.getElementById('input-restore-backup');

// Settings Navigation Tabs
const settingsTabBtns = document.querySelectorAll('.settings-tab-btn');

// Modals
const qrCanvas = document.getElementById('qr-canvas');
const displayPairingToken = document.getElementById('display-pairing-token');
const inputRemoteHostIp = document.getElementById('input-remote-host-ip');
const btnUpdateQrHost = document.getElementById('btn-update-qr-host');
const modalRecPreviewVideo = document.getElementById('modal-rec-preview-video');
const modalRecDuration = document.getElementById('modal-rec-duration');
const modalRecSize = document.getElementById('modal-rec-size');
const btnModalRecDownload = document.getElementById('btn-modal-rec-download');
const btnModalRecRetake = document.getElementById('btn-modal-rec-retake');
const btnModalRecOpenEditor = document.getElementById('btn-modal-rec-open-editor');

let latestRecordingItem = null;
let favoritesOnlyFilter = false;

async function bootstrap() {
  // 1. Initialize Storage & Persisted Settings First
  await db.init();
  await settingsSync.init();

  // 2. Initialize Core Modules
  a11y.init();
  toast.mount(toastContainer);
  prompterRenderer.mount(prompterTextContainer);
  scrollEngine.mount(prompterViewport);
  scriptEditor.mount(scriptRichEditor);
  countdownManager.mount(countdownOverlay, countdownDigits);
  typographyEngine.init();
  backgroundManager.init();
  aspectRatioManager.mount({
    workspaceEl: document.getElementById('main-workspace'),
    frameEl: document.getElementById('prompter-frame') || prompterViewport,
    viewportEl: prompterViewport
  });
  await presetManager.init();
  keyboardController.init();

  mirrorManager.mount(prompterTextContainer);
  cameraManager.mount({ videoEl: cameraPreviewVideo, containerEl: cameraPreviewContainer });
  videoEditor.mount({
    videoEl: document.getElementById('editor-video-preview'),
    canvasEl: document.getElementById('editor-canvas-helper')
  });
  recordingDiagnostics.mount();

  focusSystem.mount({
    lineEl: document.getElementById('focus-line-indicator'),
    rulerEl: document.getElementById('focus-ruler-zone'),
    topFadeEl: document.getElementById('top-fade-mask'),
    bottomFadeEl: document.getElementById('bottom-fade-mask'),
    eyeGuideEl: document.getElementById('camera-eye-guide')
  });

  // 2. Load Active Script & Seed
  await scriptManager.init();

  // 3. Setup UI Bindings
  bindTopbarEvents();
  bindSidebarEvents();
  bindPlaybackEvents();
  bindSettingsEvents();
  bindEditorToolbar();
  bindCreatorEvents();
  bindRecordingLibraryEvents();

  // 4. Render Initial Scripts, Presets, and Library Badges
  await renderScriptsList();
  await renderPresetsList();
  await updateRecordingBadge();
  updateAnalytics();

  const currentScript = appState.get('activeScript');
  if (currentScript && activeScriptTitleInput) {
    activeScriptTitleInput.value = currentScript.title;
  }

  // 5. Connect WebSocket Sync
  const token = qrPairingManager.getToken();
  remoteServerSync.connect(token);

  // 6. Register Service Worker for PWA
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.register('/sw.js');
    } catch {
      // ignore
    }
  }

  // 7. Check Presenter Query Param (for popout window)
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('mode') === 'presenter') {
    appContainer.classList.add('distraction-free');
  }
}

// ============================================================================
// TOPBAR & VIEWPORT MODES
// ============================================================================
function bindTopbarEvents() {
  const mobileDrawerBackdrop = document.getElementById('mobile-drawer-backdrop');

  const updateSidebarToggleState = () => {
    const isMobile = window.innerWidth <= 768;
    const isClosed = isMobile 
      ? !appContainer.classList.contains('mobile-sidebar-open')
      : appContainer.classList.contains('sidebar-collapsed');
    btnToggleSidebar.setAttribute('aria-expanded', isClosed ? 'false' : 'true');
    btnToggleSidebar.title = isClosed ? 'Expand Sidebar (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)';
  };

  updateSidebarToggleState();

  btnToggleSidebar.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      appContainer.classList.toggle('mobile-sidebar-open');
      appContainer.classList.remove('mobile-settings-open');
    } else {
      appContainer.classList.toggle('sidebar-collapsed');
    }
    updateSidebarToggleState();
    setTimeout(() => {
      aspectRatioManager.applyAspectRatio();
      scrollEngine.recalculateDimensions();
    }, 260);
  });

  if (mobileDrawerBackdrop) {
    mobileDrawerBackdrop.addEventListener('click', () => {
      appContainer.classList.remove('mobile-sidebar-open', 'mobile-settings-open');
      updateSidebarToggleState();
    });
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && (appContainer.classList.contains('mobile-sidebar-open') || appContainer.classList.contains('mobile-settings-open'))) {
      appContainer.classList.remove('mobile-sidebar-open', 'mobile-settings-open');
      updateSidebarToggleState();
    }
  });

  btnToggleSettings.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      appContainer.classList.toggle('mobile-settings-open');
      appContainer.classList.remove('mobile-sidebar-open');
    } else {
      appContainer.classList.toggle('settings-collapsed');
    }
    updateSidebarToggleState();
    setTimeout(() => {
      aspectRatioManager.applyAspectRatio();
      scrollEngine.recalculateDimensions();
    }, 260);
  });

  btnCloseSettingsX.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
      appContainer.classList.remove('mobile-settings-open');
    } else {
      appContainer.classList.add('settings-collapsed');
    }
    updateSidebarToggleState();
    setTimeout(() => {
      aspectRatioManager.applyAspectRatio();
      scrollEngine.recalculateDimensions();
    }, 260);
  });

  activeScriptTitleInput.addEventListener('input', (e) => {
    scriptManager.updateActiveScript({ title: e.target.value.trim() || 'Untitled Script' });
  });

  modeTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const mode = btn.dataset.mode;
      setWorkspaceMode(mode);
    });
  });

  const btnTopbarFlipCam = document.getElementById('btn-topbar-flip-cam');
  const btnSettingsFlipCam = document.getElementById('btn-settings-flip-cam');

  btnTopbarCamera.addEventListener('click', async () => {
    try {
      if (appState.get('media').cameraEnabled) {
        cameraManager.stopCamera();
        camStatusLabel.textContent = 'Camera';
        btnTopbarCamera.classList.remove('btn-primary');
        btnTopbarCamera.classList.add('btn-secondary');
        if (btnTopbarFlipCam) btnTopbarFlipCam.style.display = 'none';
      } else {
        await cameraManager.startCamera();
        camStatusLabel.textContent = 'Camera On';
        btnTopbarCamera.classList.remove('btn-secondary');
        btnTopbarCamera.classList.add('btn-primary');
        if (btnTopbarFlipCam) btnTopbarFlipCam.style.display = 'inline-flex';
        toast.show('Camera connected.', 'success');
      }
    } catch (err) {
      toast.show(err.message, 'error');
    }
  });

  const handleFlipCamera = async () => {
    try {
      await cameraManager.toggleFacingMode();
      const mode = appState.get('media')?.facingMode === 'environment' ? 'Rear' : 'Front';
      toast.show(`Switched to ${mode} Camera`, 'info');
    } catch (err) {
      toast.show('Failed to switch camera: ' + err.message, 'error');
    }
  };

  if (btnTopbarFlipCam) btnTopbarFlipCam.addEventListener('click', handleFlipCamera);
  if (btnSettingsFlipCam) btnSettingsFlipCam.addEventListener('click', handleFlipCamera);

  btnOpenRemoteModal.addEventListener('click', async () => {
    const token = qrPairingManager.getToken();
    displayPairingToken.textContent = token;

    let targetOrigin = window.location.origin || 'http://localhost:3000';
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      try {
        const port = window.location.port || '3000';
        const serverStatus = await fetch('http://localhost:8080/api/status').then(r => r.json());
        if (serverStatus && serverStatus.lanIp && serverStatus.lanIp !== 'localhost') {
          targetOrigin = `http://${serverStatus.lanIp}:${port}`;
        }
      } catch {
        // Fallback to current origin
      }
    }

    inputRemoteHostIp.value = targetOrigin;
    await qrPairingManager.renderQRCode(qrCanvas, targetOrigin);
    modalManager.open('modal-remote-pairing');
  });

  btnUpdateQrHost.addEventListener('click', async () => {
    const customHost = inputRemoteHostIp.value.trim();
    if (customHost) {
      await qrPairingManager.renderQRCode(qrCanvas, customHost);
      toast.show('QR code updated for host.', 'info');
    }
  });

  btnExternalPopout.addEventListener('click', () => {
    const res = externalDisplayManager.openPresenterWindow();
    if (!res.success) {
      toast.show(res.error, 'warn');
    } else {
      toast.show('Presenter window opened.', 'success');
    }
  });

  btnFullscreen.addEventListener('click', () => {
    keyboardController.toggleFullscreen();
  });

  btnShortcutsHelp.addEventListener('click', () => {
    modalManager.open('modal-shortcuts');
  });

  // Diagnostics HUD toggle button
  const btnTopbarDiagnostics = document.getElementById('btn-topbar-diagnostics');
  if (btnTopbarDiagnostics) {
    btnTopbarDiagnostics.addEventListener('click', () => {
      recordingDiagnostics.toggle();
    });
  }

  // Header More Overflow Dropdown (Mobile / Tablet)
  const btnHeaderMore = document.getElementById('btn-header-more');
  const headerMoreDropdown = document.getElementById('header-more-dropdown');
  if (btnHeaderMore && headerMoreDropdown) {
    btnHeaderMore.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = headerMoreDropdown.style.display !== 'none';
      headerMoreDropdown.style.display = isVisible ? 'none' : 'flex';
      btnHeaderMore.setAttribute('aria-expanded', isVisible ? 'false' : 'true');
    });

    document.addEventListener('click', (e) => {
      if (headerMoreDropdown.style.display !== 'none' && !headerMoreDropdown.contains(e.target) && e.target !== btnHeaderMore) {
        headerMoreDropdown.style.display = 'none';
        btnHeaderMore.setAttribute('aria-expanded', 'false');
      }
    });

    headerMoreDropdown.querySelectorAll('[data-action]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        headerMoreDropdown.style.display = 'none';
        btnHeaderMore.setAttribute('aria-expanded', 'false');
        const action = btn.dataset.action;
        if (action === 'mode') {
          const m = btn.dataset.mode;
          setWorkspaceMode(m);
        } else if (action === 'remote') {
          btnOpenRemoteModal.click();
        } else if (action === 'popout') {
          btnExternalPopout.click();
        } else if (action === 'diagnostics') {
          recordingDiagnostics.toggle();
        } else if (action === 'fullscreen') {
          btnFullscreen.click();
        } else if (action === 'help') {
          btnShortcutsHelp.click();
        }
      });
    });
  }

  // Autosave status listener
  eventBus.on('state:isSaved', (isSaved) => {
    if (isSaved) {
      saveDot.classList.remove('unsaved');
      saveText.textContent = 'Saved';
    } else {
      saveDot.classList.add('unsaved');
      saveText.textContent = 'Saving...';
    }
  });

  eventBus.on('script:selected', (script) => {
    activeScriptTitleInput.value = script.title;
    updateAnalytics();
  });
}

function setWorkspaceMode(mode) {
  modeTabBtns.forEach(b => b.classList.toggle('active', b.dataset.mode === mode));
  appState.set('activeMode', mode);

  if (mode === 'prompter') {
    editorWorkspace.style.display = 'none';
    creatorWorkspace.style.display = 'none';
    prompterViewport.style.display = 'block';
  } else if (mode === 'editor') {
    scrollEngine.pause();
    prompterViewport.style.display = 'none';
    creatorWorkspace.style.display = 'none';
    editorWorkspace.style.display = 'flex';
    scriptEditor.syncFromState();
  } else if (mode === 'rehearsal') {
    editorWorkspace.style.display = 'none';
    creatorWorkspace.style.display = 'none';
    prompterViewport.style.display = 'block';
    rehearsalManager.startRehearsal();
    scrollEngine.restart();
    toast.show('Rehearsal timer started. Speak through your script.', 'info');
  } else if (mode === 'creator') {
    scrollEngine.pause();
    prompterViewport.style.display = 'none';
    editorWorkspace.style.display = 'none';
    creatorWorkspace.style.display = 'flex';

    // Auto-load latest recording into video editor if available
    if (latestRecordingItem && !videoEditor.hasVideo()) {
      videoEditor.loadVideoBlob(latestRecordingItem.blob);
      const infoBadge = document.getElementById('creator-video-info-badge');
      if (infoBadge) infoBadge.textContent = 'Loaded: Latest Recording';
    }
  }
}

// ============================================================================
// SIDEBAR & SCRIPTS
// ============================================================================
function bindSidebarEvents() {
  btnNewScript.addEventListener('click', async () => {
    const script = await scriptManager.createNewScript();
    setWorkspaceMode('editor');
    toast.show('New script created.', 'success');
  });

  inputImportScript.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        const imported = await scriptManager.importScriptFile(file);
        setWorkspaceMode('editor');
        toast.show(`Imported "${imported.title}"`, 'success');
      } catch (err) {
        toast.show('Failed to import script file.', 'error');
      }
    }
    inputImportScript.value = '';
  });

  btnToggleFavFilter.addEventListener('click', () => {
    favoritesOnlyFilter = !favoritesOnlyFilter;
    btnToggleFavFilter.textContent = favoritesOnlyFilter ? '⭐ Favs' : '⭐ All';
    btnToggleFavFilter.style.color = favoritesOnlyFilter ? '#facc15' : 'inherit';
    renderScriptsList();
  });

  scriptSearchInput.addEventListener('input', () => {
    renderScriptsList(scriptSearchInput.value.trim().toLowerCase());
  });

  selectLanguage.addEventListener('change', (e) => {
    i18n.setLocale(e.target.value);
  });

  btnExportBackup.addEventListener('click', async () => {
    await exportAllData();
    toast.show('Backup downloaded.', 'success');
  });

  inputRestoreBackup.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (file) {
      const text = await file.text();
      try {
        const res = await importData(text);
        toast.show(`Restored ${res.count} scripts!`, 'success');
        await renderScriptsList();
      } catch (err) {
        toast.show('Invalid backup file.', 'error');
      }
    }
  });

  eventBus.on('scripts:list-updated', () => {
    renderScriptsList();
    updateAnalytics();
  });
}

async function renderScriptsList(filterText = '') {
  const scripts = await scriptManager.getAllScripts();
  scriptCountBadge.textContent = scripts.length;
  scriptListContainer.innerHTML = '';

  const active = appState.get('activeScript');

  const filtered = scripts.filter(s => {
    if (favoritesOnlyFilter && !s.isFavorite) return false;
    if (!filterText) return true;
    return s.title.toLowerCase().includes(filterText) || s.content.toLowerCase().includes(filterText);
  });

  filtered.forEach(script => {
    const li = document.createElement('li');
    li.className = `script-item ${active && active.id === script.id ? 'active' : ''}`;

    const info = document.createElement('div');
    info.className = 'script-item-info';

    const title = document.createElement('div');
    title.className = 'script-item-title';
    title.textContent = `${script.isFavorite ? '⭐ ' : ''}${script.title}`;

    const meta = document.createElement('div');
    meta.className = 'script-item-meta';
    const stats = calculateScriptStats(script.content, appState.get('targetWPM'));
    meta.textContent = `${stats.words} words • ${stats.formattedDuration}`;

    info.appendChild(title);
    info.appendChild(meta);

    // Action buttons: Favorite, Duplicate, Delete
    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '2px';

    const favBtn = document.createElement('button');
    favBtn.className = 'btn-icon';
    favBtn.innerHTML = script.isFavorite ? '⭐' : '✩';
    favBtn.title = script.isFavorite ? 'Remove Favorite' : 'Add Favorite';
    favBtn.onclick = async (e) => {
      e.stopPropagation();
      await scriptManager.toggleFavorite(script.id);
    };

    const dupBtn = document.createElement('button');
    dupBtn.className = 'btn-icon';
    dupBtn.innerHTML = '📋';
    dupBtn.title = 'Duplicate Script';
    dupBtn.onclick = async (e) => {
      e.stopPropagation();
      const copy = await scriptManager.duplicateScript(script.id);
      if (copy) toast.show(`Duplicated "${copy.title}"`, 'success');
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn-icon';
    delBtn.innerHTML = '🗑️';
    delBtn.title = 'Delete Script';
    delBtn.onclick = (e) => {
      e.stopPropagation();
      if (confirm(`Delete "${script.title}"?`)) {
        scriptManager.deleteScript(script.id);
      }
    };

    actions.appendChild(favBtn);
    actions.appendChild(dupBtn);
    actions.appendChild(delBtn);

    li.appendChild(info);
    li.appendChild(actions);

    li.onclick = () => {
      scriptManager.setActiveScript(script);
      renderScriptsList();
    };

    scriptListContainer.appendChild(li);
  });
}

// ============================================================================
// PLAYBACK BAR
// ============================================================================
function bindPlaybackEvents() {
  btnPlaybackToggle.addEventListener('click', () => {
    scrollEngine.togglePlayPause();
  });

  btnPlaybackStop.addEventListener('click', () => {
    scrollEngine.stop();
  });

  btnJumpBackward.addEventListener('click', () => {
    scrollEngine.jumpSeconds(-5);
  });

  btnJumpForward.addEventListener('click', () => {
    scrollEngine.jumpSeconds(5);
  });

  btnSpeedMinus.addEventListener('click', () => {
    const speed = Math.max(1, appState.get('scrollSpeed') - 1);
    appState.set('scrollSpeed', speed);
  });

  btnSpeedPlus.addEventListener('click', () => {
    const speed = Math.min(20, appState.get('scrollSpeed') + 1);
    appState.set('scrollSpeed', speed);
  });

  btnStudioRecord.addEventListener('click', () => {
    const state = appState.get('recordingState');
    if (state === 'recording') {
      studioRecorder.stopRecording();
    } else {
      studioRecorder.startRecording();
    }
  });

  playbackProgressTrack.addEventListener('click', (e) => {
    const rect = playbackProgressTrack.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    scrollEngine.jumpToProgress(ratio * 100);
  });

  // State change event listeners
  eventBus.on('state:playbackState', (state) => {
    const isPlaying = state === 'playing';
    iconPlay.style.display = isPlaying ? 'none' : 'block';
    iconPause.style.display = isPlaying ? 'block' : 'none';
  });

  eventBus.on('state:scrollSpeed', (speed) => {
    playbackSpeedIndicator.textContent = speed;
    const speedSlider = document.getElementById('slider-scroll-speed');
    const valSpeed = document.getElementById('val-scroll-speed');
    if (speedSlider) speedSlider.value = speed;
    if (valSpeed) valSpeed.textContent = speed;
  });

  // Cache calculated script stats to avoid expensive regex word parsing on every scroll frame
  let cachedScriptId = null;
  let cachedScriptContent = '';
  let cachedScriptWPM = 0;
  let cachedScriptStats = { words: 0, estimatedSeconds: 0 };

  const getCachedScriptStats = () => {
    const script = appState.get('activeScript');
    const content = script?.content || '';
    const wpm = appState.get('targetWPM') || 130;
    if (script?.id !== cachedScriptId || content !== cachedScriptContent || wpm !== cachedScriptWPM) {
      cachedScriptId = script?.id;
      cachedScriptContent = content;
      cachedScriptWPM = wpm;
      cachedScriptStats = calculateScriptStats(content, wpm);
    }
    return cachedScriptStats;
  };

  eventBus.on('scroll:progress', (data) => {
    playbackProgressFill.style.width = `${Math.round(data.progress * 100)}%`;
    timeElapsed.textContent = formatTimeSeconds(data.elapsedTime);

    const stats = getCachedScriptStats();
    const remainingSecs = Math.max(0, stats.estimatedSeconds - data.elapsedTime);
    timeRemaining.textContent = formatTimeSeconds(remainingSecs);
  });

  eventBus.on('state:recordingState', (recState) => {
    const isRecording = recState === 'recording';
    btnStudioRecord.classList.toggle('recording', isRecording);
    recordBtnLabel.textContent = isRecording ? 'STOP' : 'REC';
  });

  eventBus.on('recording:completed', async (recordingItem) => {
    latestRecordingItem = recordingItem;
    modalRecPreviewVideo.src = URL.createObjectURL(recordingItem.blob);
    modalRecDuration.textContent = `Duration: ${formatTimeSeconds(recordingItem.duration)}`;
    modalRecSize.textContent = `Size: ${(recordingItem.size / (1024 * 1024)).toFixed(2)} MB`;
    modalManager.open('modal-recording-complete');
    await updateRecordingBadge();
    toast.show('Recording completed and saved to Library!', 'success');
  });

  btnModalRecDownload.addEventListener('click', () => {
    if (latestRecordingItem) {
      recordingLibrary.downloadBlob(latestRecordingItem.blob, `recording-${latestRecordingItem.id}.webm`);
    }
  });

  btnModalRecRetake.addEventListener('click', () => {
    modalManager.close('modal-recording-complete');
    studioRecorder.startRecording();
  });

  btnModalRecOpenEditor.addEventListener('click', () => {
    if (latestRecordingItem) {
      modalManager.close('modal-recording-complete');
      videoEditor.loadVideoBlob(latestRecordingItem.blob);
      setWorkspaceMode('creator');
      const infoBadge = document.getElementById('creator-video-info-badge');
      if (infoBadge) infoBadge.textContent = 'Loaded: Latest Recording';
    }
  });
}

function updateAnalytics() {
  const script = appState.get('activeScript');
  const targetWpm = appState.get('targetWPM') || 130;
  const stats = calculateScriptStats(script?.content || '', targetWpm);

  statWordsCount.textContent = `${stats.words} words`;
  statTargetWpm.textContent = `${targetWpm} WPM`;
  timeRemaining.textContent = stats.formattedDuration;
}

// ============================================================================
// SETTINGS PANEL & CONTROLS
// ============================================================================
function bindSettingsEvents() {
  // Tabs switching
  settingsTabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      settingsTabBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const targetTab = btn.dataset.tab;
      document.querySelectorAll('.tab-pane').forEach(p => p.style.display = 'none');
      const pane = document.getElementById(`tab-pane-${targetTab}`);
      if (pane) pane.style.display = 'block';

      // Only run Web Audio VU monitor when Media settings tab is visible
      const switchMic = document.getElementById('switch-mic-monitoring');
      if (targetTab === 'media') {
        if (switchMic && switchMic.checked) {
          audioManager.enableMonitoring();
        }
      } else {
        if (!switchMic || !switchMic.checked) {
          audioManager.disableMonitoring();
        }
      }
    });
  });

  // Typography Controls
  const selectFontFamily = document.getElementById('select-font-family');
  const sliderFontSize = document.getElementById('slider-font-size');
  const valFontSize = document.getElementById('val-font-size');
  const sliderFontWeight = document.getElementById('slider-font-weight');
  const valFontWeight = document.getElementById('val-font-weight');
  const pickerTextColor = document.getElementById('picker-text-color');
  const hexTextColor = document.getElementById('hex-text-color');
  const sliderLineHeight = document.getElementById('slider-line-height');
  const valLineHeight = document.getElementById('val-line-height');
  const sliderContainerWidth = document.getElementById('slider-container-width');
  const valContainerWidth = document.getElementById('val-container-width');
  const switchTextShadow = document.getElementById('switch-text-shadow');
  const switchTextOutline = document.getElementById('switch-text-outline');
  const outlineControlsGroup = document.getElementById('outline-controls-group');
  const sliderOutlineWidth = document.getElementById('slider-outline-width');
  const valOutlineWidth = document.getElementById('val-outline-width');
  const pickerOutlineColor = document.getElementById('picker-outline-color');
  const hexOutlineColor = document.getElementById('hex-outline-color');

  // Sync initial typography state
  const initialTypo = appState.get('typography') || {};
  if (selectFontFamily) selectFontFamily.value = initialTypo.fontFamily || "'Inter', sans-serif";
  if (sliderFontSize) sliderFontSize.value = initialTypo.fontSize || 52;
  if (valFontSize) valFontSize.textContent = `${initialTypo.fontSize || 52}px`;
  if (sliderFontWeight) sliderFontWeight.value = initialTypo.fontWeight || 600;
  if (valFontWeight) valFontWeight.textContent = initialTypo.fontWeight || 600;
  if (pickerTextColor) pickerTextColor.value = initialTypo.textColor || '#ffffff';
  if (hexTextColor) hexTextColor.value = initialTypo.textColor || '#ffffff';
  if (sliderLineHeight) sliderLineHeight.value = initialTypo.lineHeight || 1.5;
  if (valLineHeight) valLineHeight.textContent = parseFloat(initialTypo.lineHeight || 1.5).toFixed(1);
  if (sliderContainerWidth) sliderContainerWidth.value = initialTypo.containerWidth || 85;
  if (valContainerWidth) valContainerWidth.textContent = `${initialTypo.containerWidth || 85}%`;
  if (switchTextShadow) switchTextShadow.checked = Boolean(initialTypo.textShadow);
  if (switchTextOutline) switchTextOutline.checked = Boolean(initialTypo.textOutline);
  if (sliderOutlineWidth) sliderOutlineWidth.value = initialTypo.outlineWidth ?? 2;
  if (valOutlineWidth) valOutlineWidth.textContent = `${initialTypo.outlineWidth ?? 2}px`;
  if (pickerOutlineColor) pickerOutlineColor.value = initialTypo.outlineColor || '#000000';
  if (hexOutlineColor) hexOutlineColor.value = initialTypo.outlineColor || '#000000';
  if (outlineControlsGroup) outlineControlsGroup.style.display = initialTypo.textOutline ? 'flex' : 'none';

  selectFontFamily?.addEventListener('change', (e) => typographyEngine.update('fontFamily', e.target.value));
  sliderFontSize?.addEventListener('input', (e) => {
    valFontSize.textContent = `${e.target.value}px`;
    typographyEngine.update('fontSize', parseInt(e.target.value, 10));
  });
  sliderFontWeight?.addEventListener('input', (e) => {
    valFontWeight.textContent = e.target.value;
    typographyEngine.update('fontWeight', parseInt(e.target.value, 10));
  });
  pickerTextColor?.addEventListener('input', (e) => {
    hexTextColor.value = e.target.value;
    typographyEngine.update('textColor', e.target.value);
  });
  hexTextColor?.addEventListener('input', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
      pickerTextColor.value = val;
      typographyEngine.update('textColor', val);
    }
  });
  hexTextColor?.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
      pickerTextColor.value = val;
      typographyEngine.update('textColor', val);
    }
  });
  sliderLineHeight?.addEventListener('input', (e) => {
    const val = parseFloat(e.target.value);
    valLineHeight.textContent = val.toFixed(1);
    typographyEngine.update('lineHeight', val);
  });
  sliderContainerWidth?.addEventListener('input', (e) => {
    valContainerWidth.textContent = `${e.target.value}%`;
    typographyEngine.update('containerWidth', parseInt(e.target.value, 10));
  });
  switchTextShadow?.addEventListener('change', (e) => typographyEngine.update('textShadow', e.target.checked));
  
  // Outline switch & controls
  switchTextOutline?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    if (outlineControlsGroup) outlineControlsGroup.style.display = isChecked ? 'flex' : 'none';
    const width = isChecked ? (parseInt(sliderOutlineWidth?.value, 10) || 2) : 0;
    typographyEngine.update('textOutline', isChecked);
    typographyEngine.update('outlineWidth', width);
  });

  sliderOutlineWidth?.addEventListener('input', (e) => {
    const w = parseInt(e.target.value, 10);
    if (valOutlineWidth) valOutlineWidth.textContent = `${w}px`;
    if (w === 0) {
      if (switchTextOutline) switchTextOutline.checked = false;
      if (outlineControlsGroup) outlineControlsGroup.style.display = 'none';
      typographyEngine.update('textOutline', false);
      typographyEngine.update('outlineWidth', 0);
    } else {
      if (switchTextOutline) switchTextOutline.checked = true;
      if (outlineControlsGroup) outlineControlsGroup.style.display = 'flex';
      typographyEngine.update('textOutline', true);
      typographyEngine.update('outlineWidth', w);
    }
  });

  pickerOutlineColor?.addEventListener('input', (e) => {
    if (hexOutlineColor) hexOutlineColor.value = e.target.value;
    typographyEngine.update('outlineColor', e.target.value);
  });

  hexOutlineColor?.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
      if (pickerOutlineColor) pickerOutlineColor.value = val;
      typographyEngine.update('outlineColor', val);
    }
  });

  document.querySelectorAll('.btn-align').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-align').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      typographyEngine.update('textAlign', btn.dataset.align);
    });
  });

  // Background Controls
  const selectBgTheme = document.getElementById('select-bg-theme');
  const pickerBgColor = document.getElementById('picker-bg-color');
  const hexBgColor = document.getElementById('hex-bg-color');

  // Sync initial background state
  const initialBg = appState.get('background') || {};
  if (selectBgTheme) selectBgTheme.value = initialBg.theme || 'studio-dark';
  if (pickerBgColor) pickerBgColor.value = initialBg.color || '#000000';
  if (hexBgColor) hexBgColor.value = initialBg.color || '#000000';

  selectBgTheme?.addEventListener('change', (e) => backgroundManager.setTheme(e.target.value));
  pickerBgColor?.addEventListener('input', (e) => {
    hexBgColor.value = e.target.value;
    if (selectBgTheme) selectBgTheme.value = 'custom';
    backgroundManager.setColor(e.target.value);
  });
  hexBgColor?.addEventListener('input', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
      pickerBgColor.value = val;
      if (selectBgTheme) selectBgTheme.value = 'custom';
      backgroundManager.setColor(val);
    }
  });
  hexBgColor?.addEventListener('change', (e) => {
    let val = e.target.value.trim();
    if (!val.startsWith('#') && /^[0-9A-Fa-f]{3,6}$/.test(val)) val = `#${val}`;
    if (/^#[0-9A-Fa-f]{6}$/i.test(val)) {
      pickerBgColor.value = val;
      if (selectBgTheme) selectBgTheme.value = 'custom';
      backgroundManager.setColor(val);
    }
  });

  eventBus.on('theme:changed', (themeData) => {
    if (selectBgTheme && themeData.theme) selectBgTheme.value = themeData.theme;
    if (pickerBgColor && themeData.color) pickerBgColor.value = themeData.color;
    if (hexBgColor && themeData.color) hexBgColor.value = themeData.color;
  });

  eventBus.on('contrast:checked', (res) => {
    const badgeContainer = document.getElementById('contrast-badge-container');
    if (!badgeContainer) return;
    if (res.acceptable) {
      badgeContainer.innerHTML = `<div style="font-size: 11px; color: #10b981; padding: 4px 0;">✓ Contrast Ratio: ${res.ratio}:1 (Optimal)</div>`;
    } else {
      badgeContainer.innerHTML = `<div class="contrast-warning">⚠️ ${res.message}</div>`;
    }
  });

  // Scrolling Controls
  const sliderScrollSpeed = document.getElementById('slider-scroll-speed');
  const selectScrollMode = document.getElementById('select-scroll-mode');
  const sliderTargetWpm = document.getElementById('slider-target-wpm');
  const valTargetWpm = document.getElementById('val-target-wpm');
  const selectCountdownSec = document.getElementById('select-countdown-sec');
  const switchReverseScroll = document.getElementById('switch-reverse-scroll');
  const switchLoopPlayback = document.getElementById('switch-loop-playback');

  sliderScrollSpeed.addEventListener('input', (e) => appState.set('scrollSpeed', parseInt(e.target.value, 10)));
  selectScrollMode.addEventListener('change', (e) => appState.set('scrollMode', e.target.value));
  sliderTargetWpm.addEventListener('input', (e) => {
    valTargetWpm.textContent = e.target.value;
    appState.set('targetWPM', parseInt(e.target.value, 10));
    updateAnalytics();
  });
  selectCountdownSec.addEventListener('change', (e) => appState.set('countdownDuration', parseInt(e.target.value, 10)));
  switchReverseScroll.addEventListener('change', (e) => appState.set('isReversed', e.target.checked));
  switchLoopPlayback.addEventListener('change', (e) => appState.set('isLooping', e.target.checked));

  // Focus System Controls
  const switchFocusEnabled = document.getElementById('switch-focus-enabled');
  const switchFocusLine = document.getElementById('switch-focus-line');
  const sliderFocusPos = document.getElementById('slider-focus-pos');
  const valFocusPos = document.getElementById('val-focus-pos');
  const switchFocusRuler = document.getElementById('switch-focus-ruler');
  const sliderRulerHeight = document.getElementById('slider-ruler-height');
  const valRulerHeight = document.getElementById('val-ruler-height');
  const switchFadeMask = document.getElementById('switch-fade-mask');
  const switchEyeGuide = document.getElementById('switch-eye-guide');

  switchFocusEnabled.addEventListener('change', (e) => focusSystem.update('enabled', e.target.checked));
  switchFocusLine.addEventListener('change', (e) => focusSystem.update('lineVisible', e.target.checked));
  sliderFocusPos.addEventListener('input', (e) => {
    valFocusPos.textContent = `${e.target.value}%`;
    focusSystem.update('linePosition', parseInt(e.target.value, 10));
  });
  switchFocusRuler.addEventListener('change', (e) => focusSystem.update('rulerVisible', e.target.checked));
  sliderRulerHeight.addEventListener('input', (e) => {
    valRulerHeight.textContent = `${e.target.value}px`;
    focusSystem.update('rulerThickness', parseInt(e.target.value, 10));
  });
  switchFadeMask.addEventListener('change', (e) => focusSystem.update('fadeMask', e.target.checked));
  switchEyeGuide.addEventListener('change', (e) => focusSystem.update('eyeGuide', e.target.checked));

  // Display & Mirror Controls
  const switchMirrorX = document.getElementById('switch-mirror-x');
  const switchMirrorY = document.getElementById('switch-mirror-y');
  const selectAspectRatio = document.getElementById('select-aspect-ratio');
  const btnToggleDistractionFree = document.getElementById('btn-toggle-distraction-free');

  // Sync initial display state
  const initialDisplay = appState.get('display') || {};
  if (switchMirrorX) switchMirrorX.checked = Boolean(initialDisplay.mirrorX);
  if (switchMirrorY) switchMirrorY.checked = Boolean(initialDisplay.mirrorY);
  if (selectAspectRatio) selectAspectRatio.value = initialDisplay.aspectRatio || 'full';

  switchMirrorX.addEventListener('change', (e) => appState.update('display', { mirrorX: e.target.checked }));
  switchMirrorY.addEventListener('change', (e) => appState.update('display', { mirrorY: e.target.checked }));
  selectAspectRatio.addEventListener('change', (e) => {
    aspectRatioManager.setRatio(e.target.value);
  });
  btnToggleDistractionFree.addEventListener('click', () => {
    appContainer.classList.toggle('distraction-free');
  });

  // Media Controls (Camera & Mic)
  const switchMirrorCam = document.getElementById('switch-mirror-cam');
  const switchCleanRecord = document.getElementById('switch-clean-record');
  const vuFill = document.getElementById('vu-fill');

  switchMirrorCam.addEventListener('change', (e) => {
    cameraPreviewVideo.classList.toggle('mirror-cam', e.target.checked);
  });
  switchCleanRecord.addEventListener('change', (e) => {
    appState.update('media', { cleanRecord: e.target.checked });
  });

  // Camera and Microphone Device Selectors
  const selectCameraDevice = document.getElementById('select-camera-device');
  const selectMicDevice = document.getElementById('select-mic-device');
  const switchMicMonitoring = document.getElementById('switch-mic-monitoring');

  const populateMediaDevices = async () => {
    if (selectCameraDevice) {
      const cameras = await cameraManager.listCameras();
      const currentCam = appState.get('media')?.cameraDeviceId || '';
      selectCameraDevice.innerHTML = '<option value="">Auto (Front Camera)</option>';
      cameras.forEach(cam => {
        const opt = document.createElement('option');
        opt.value = cam.deviceId;
        opt.textContent = cam.label || `Camera ${selectCameraDevice.children.length}`;
        if (cam.deviceId === currentCam) opt.selected = true;
        selectCameraDevice.appendChild(opt);
      });
    }
    if (selectMicDevice) {
      const mics = await audioManager.listMicrophones();
      const currentMic = appState.get('media')?.micDeviceId || '';
      selectMicDevice.innerHTML = '<option value="">Default Microphone</option>';
      mics.forEach(mic => {
        const opt = document.createElement('option');
        opt.value = mic.deviceId;
        opt.textContent = mic.label || `Microphone ${selectMicDevice.children.length}`;
        if (mic.deviceId === currentMic) opt.selected = true;
        selectMicDevice.appendChild(opt);
      });
    }
  };

  eventBus.on('camera:started', populateMediaDevices);

  if (selectCameraDevice) {
    selectCameraDevice.addEventListener('change', async (e) => {
      await cameraManager.setCameraDevice(e.target.value);
    });
  }

  if (selectMicDevice) {
    selectMicDevice.addEventListener('change', async (e) => {
      appState.update('media', { micDeviceId: e.target.value });
      if (appState.get('media')?.cameraEnabled) {
        await cameraManager.startCamera();
      }
    });
  }

  if (switchMicMonitoring) {
    switchMicMonitoring.addEventListener('change', (e) => {
      if (e.target.checked) {
        audioManager.enableMonitoring();
      } else {
        audioManager.disableMonitoring();
      }
    });
  }

  // Video Resolution Selection
  const selectResolution = document.getElementById('select-resolution');
  if (selectResolution) {
    const currentRes = appState.get('media')?.resolution || (appState.get('isMobileDevice') ? '720p' : '1080p');
    selectResolution.value = currentRes;
    selectResolution.addEventListener('change', async (e) => {
      const res = e.target.value;
      appState.update('media', { resolution: res });
      if (appState.get('media')?.cameraEnabled) {
        try {
          await cameraManager.startCamera();
          toast.show(`Preset updated to ${res.toUpperCase()}`, 'info');
        } catch (err) {
          toast.show('Failed to switch preset: ' + err.message, 'error');
        }
      }
    });
  }

  // Diagnostics HUD Controls
  const btnTopbarDiagnostics = document.getElementById('btn-topbar-diagnostics');
  const switchRecDiagnostics = document.getElementById('switch-rec-diagnostics');

  if (btnTopbarDiagnostics) {
    btnTopbarDiagnostics.addEventListener('click', () => {
      recordingDiagnostics.toggle();
    });
  }

  if (switchRecDiagnostics) {
    switchRecDiagnostics.checked = Boolean(appState.get('diagnosticsVisible'));
    switchRecDiagnostics.addEventListener('change', (e) => {
      if (e.target.checked) {
        recordingDiagnostics.show();
      } else {
        recordingDiagnostics.hide();
      }
    });
  }

  eventBus.on('state:diagnosticsVisible', (visible) => {
    if (switchRecDiagnostics) {
      switchRecDiagnostics.checked = Boolean(visible);
    }
  });

  // Voice Tracking Controls
  const btnToggleVoice = document.getElementById('btn-toggle-voice');
  const voiceStatusBadge = document.getElementById('voice-status-badge');
  const selectVoiceLang = document.getElementById('select-voice-lang');
  const switchVoiceCommands = document.getElementById('switch-voice-commands');

  btnToggleVoice.addEventListener('click', () => {
    speechEngine.toggle();
  });

  selectVoiceLang.addEventListener('change', (e) => {
    appState.update('voice', { language: e.target.value });
  });

  switchVoiceCommands.addEventListener('change', (e) => {
    appState.update('voice', { commandsEnabled: e.target.checked });
  });

  eventBus.on('state:voice', (voice) => {
    const status = voice.status || 'disabled';

    // Status Badge Display
    if (status === 'listening') {
      voiceStatusBadge.textContent = 'LISTENING';
      voiceStatusBadge.style.color = '#10b981';
    } else if (status === 'following') {
      voiceStatusBadge.textContent = 'FOLLOWING';
      voiceStatusBadge.style.color = '#10b981';
    } else if (status === 'reconnecting') {
      voiceStatusBadge.textContent = 'RECONNECTING...';
      voiceStatusBadge.style.color = '#f59e0b';
    } else if (status === 'permission-required') {
      voiceStatusBadge.textContent = 'PERMISSION REQUIRED';
      voiceStatusBadge.style.color = '#ef4444';
    } else if (status === 'error') {
      voiceStatusBadge.textContent = 'MIC ERROR';
      voiceStatusBadge.style.color = '#ef4444';
    } else if (status === 'unsupported') {
      voiceStatusBadge.textContent = 'UNSUPPORTED';
      voiceStatusBadge.style.color = '#94a3b8';
    } else {
      voiceStatusBadge.textContent = 'DISABLED';
      voiceStatusBadge.style.color = 'inherit';
    }

    // Toggle Button Display based on voice.enabled user intent
    if (voice.enabled || status === 'listening' || status === 'following' || status === 'reconnecting') {
      btnToggleVoice.textContent = 'Stop Voice Control';
      btnToggleVoice.classList.add('btn-danger');
      btnToggleVoice.classList.remove('btn-primary');
      btnToggleVoice.removeAttribute('disabled');
    } else if (status === 'permission-required') {
      btnToggleVoice.textContent = 'Grant Microphone Permission';
      btnToggleVoice.classList.remove('btn-danger');
      btnToggleVoice.classList.add('btn-primary');
      btnToggleVoice.removeAttribute('disabled');
    } else if (status === 'unsupported') {
      btnToggleVoice.textContent = 'Voice Following Unavailable';
      btnToggleVoice.classList.remove('btn-danger');
      btnToggleVoice.classList.remove('btn-primary');
      btnToggleVoice.setAttribute('disabled', 'true');
    } else {
      btnToggleVoice.textContent = 'Enable Voice Following';
      btnToggleVoice.classList.remove('btn-danger');
      btnToggleVoice.classList.add('btn-primary');
      btnToggleVoice.removeAttribute('disabled');
    }
  });

  // Presets Save Button
  const btnSaveCustomPreset = document.getElementById('btn-save-custom-preset');
  const inputNewPresetName = document.getElementById('input-new-preset-name');
  btnSaveCustomPreset.addEventListener('click', async () => {
    const name = inputNewPresetName.value.trim();
    if (name) {
      await presetManager.saveCustomPreset(name);
      inputNewPresetName.value = '';
      await renderPresetsList();
      toast.show(`Preset "${name}" saved!`, 'success');
    }
  });

  // AI Gateway Test Button
  const btnTestAiGateway = document.getElementById('btn-test-ai-gateway');
  const inputAiEndpoint = document.getElementById('input-ai-endpoint');
  const aiStatusBox = document.getElementById('ai-gateway-status-box');

  btnTestAiGateway.addEventListener('click', async () => {
    const customEndpoint = inputAiEndpoint.value.trim();
    const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    
    if (!customEndpoint) {
      aiStatusBox.style.display = 'block';
      aiStatusBox.style.background = 'var(--bg-surface)';
      aiStatusBox.style.border = '1px solid var(--border-subtle)';
      aiStatusBox.innerHTML = 'ℹ️ <b>External AI Gateway Unconfigured:</b><br><span style="color:var(--text-secondary);font-size:12px;">Enter an external HTTPS endpoint (e.g. <code>https://your-ai-gateway.example.com</code>) to enable cloud AI processing. Built-in local fallbacks (Web Speech API voice tracking, Chroma Key green screen, and in-browser video editor) are 100% active.</span>';
      return;
    }
    
    const endpoint = (customEndpoint || (isLocal ? 'http://localhost:8280' : '')).replace(/\/+$/, '');
    if (!endpoint) return;
    aiStatusBox.style.display = 'block';
    aiStatusBox.style.background = 'var(--bg-surface)';
    aiStatusBox.style.border = '1px solid var(--border-subtle)';
    aiStatusBox.innerHTML = 'Connecting to AI gateway...';

    try {
      const res = await fetch(`${endpoint}/api/ai/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'health-check' })
      });

      const data = await res.json();
      const badgeEye = document.getElementById('badge-ai-eye');
      const badgeWhisper = document.getElementById('badge-ai-whisper');

      if (res.status === 503) {
        aiStatusBox.style.background = 'rgba(245, 158, 11, 0.15)';
        aiStatusBox.style.borderColor = 'rgba(245, 158, 11, 0.4)';
        aiStatusBox.innerHTML = `⚠️ <b>Gateway Online (${res.status}):</b> ${data.error || 'Provider Unconfigured.'}<br><span style="color:var(--text-tertiary);">Set AI_PROVIDER_KEY in server/.env to enable Cloud AI. Local operations remain active.</span>`;
        if (badgeEye) { badgeEye.textContent = 'Unavailable (No Key)'; badgeEye.style.color = '#ef4444'; }
        if (badgeWhisper) { badgeWhisper.textContent = 'Unavailable (No Key)'; badgeWhisper.style.color = '#ef4444'; }
      } else if (res.ok) {
        aiStatusBox.style.background = 'rgba(16, 185, 129, 0.15)';
        aiStatusBox.style.borderColor = 'rgba(16, 185, 129, 0.4)';
        aiStatusBox.innerHTML = `✓ <b>Gateway Connected (200):</b> AI processing ready. Job: ${data.jobId}`;
        if (badgeEye) { badgeEye.textContent = 'Active / Online'; badgeEye.style.color = '#10b981'; }
        if (badgeWhisper) { badgeWhisper.textContent = 'Active / Online'; badgeWhisper.style.color = '#10b981'; }
      } else {
        aiStatusBox.innerHTML = `Error: ${data.error || res.statusText}`;
      }
    } catch (err) {
      aiStatusBox.style.background = 'rgba(239, 68, 68, 0.15)';
      aiStatusBox.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      aiStatusBox.innerHTML = `❌ Failed to connect to ${endpoint}. Verify server is running on port 8080.`;
    }
  });
}

async function renderPresetsList() {
  const container = document.getElementById('presets-list-container');
  if (!container) return;
  container.innerHTML = '';

  const presets = await presetManager.getAllPresets();
  presets.forEach(p => {
    const row = document.createElement('div');
    row.style.display = 'flex';
    row.style.alignItems = 'center';
    row.style.justifyContent = 'space-between';
    row.style.padding = '8px 10px';
    row.style.background = 'var(--bg-tertiary)';
    row.style.borderRadius = 'var(--radius-md)';
    row.style.fontSize = '12px';

    const nameSpan = document.createElement('span');
    nameSpan.textContent = p.name;
    nameSpan.style.cursor = 'pointer';
    nameSpan.style.fontWeight = '500';
    nameSpan.onclick = () => {
      presetManager.applyPreset(p);
      toast.show(`Applied "${p.name}" preset`, 'info');
    };

    const applyBtn = document.createElement('button');
    applyBtn.className = 'btn btn-secondary';
    applyBtn.style.padding = '4px 8px';
    applyBtn.style.fontSize = '11px';
    applyBtn.textContent = 'Apply';
    applyBtn.onclick = () => {
      presetManager.applyPreset(p);
      toast.show(`Applied "${p.name}" preset`, 'info');
    };

    row.appendChild(nameSpan);
    row.appendChild(applyBtn);
    container.appendChild(row);
  });
}

// ============================================================================
// EDITOR TOOLBAR & CREATOR STUDIO
// ============================================================================
function bindEditorToolbar() {
  document.querySelectorAll('[data-edit-cmd]').forEach(btn => {
    btn.addEventListener('click', () => {
      const cmd = btn.dataset.editCmd;
      const val = btn.dataset.editVal || null;
      scriptEditor.executeFormat(cmd, val);
    });
  });

  // Find & Replace Bar
  const findReplaceBar = document.getElementById('find-replace-bar');
  const btnToggleFindReplace = document.getElementById('btn-toggle-find-replace');
  const btnFindReplaceClose = document.getElementById('btn-find-replace-close');
  const btnFindReplaceExec = document.getElementById('btn-find-replace-exec');
  const findInput = document.getElementById('find-input');
  const replaceInput = document.getElementById('replace-input');

  btnToggleFindReplace.addEventListener('click', () => {
    const isHidden = findReplaceBar.style.display === 'none';
    findReplaceBar.style.display = isHidden ? 'flex' : 'none';
    if (isHidden) findInput.focus();
  });

  btnFindReplaceClose.addEventListener('click', () => {
    findReplaceBar.style.display = 'none';
  });

  btnFindReplaceExec.addEventListener('click', () => {
    const fText = findInput.value.trim();
    const rText = replaceInput.value;
    if (fText) {
      scriptEditor.findAndReplace(fText, rText);
      toast.show('Text replaced.', 'info');
    }
  });

  document.getElementById('btn-export-txt').addEventListener('click', () => {
    scriptManager.exportCurrentScript('txt');
  });

  document.getElementById('btn-export-md').addEventListener('click', () => {
    scriptManager.exportCurrentScript('md');
  });

  document.getElementById('btn-export-doc').addEventListener('click', async () => {
    try {
      await scriptManager.exportCurrentScript('docx');
      toast.show('Exported genuine Word DOCX.', 'success');
    } catch (err) {
      console.error(err);
      toast.show('Failed to export DOCX.', 'error');
    }
  });

  document.getElementById('btn-export-pdf').addEventListener('click', async () => {
    try {
      await scriptManager.exportCurrentScript('pdf');
      toast.show('Exported genuine PDF.', 'success');
    } catch (err) {
      console.error(err);
      toast.show('Failed to export PDF.', 'error');
    }
  });
}

function bindCreatorEvents() {
  document.getElementById('btn-close-creator').addEventListener('click', () => {
    setWorkspaceMode('prompter');
  });

  const inputUploadVideo = document.getElementById('input-creator-upload-video');
  inputUploadVideo.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      videoEditor.loadVideoBlob(file);
      const infoBadge = document.getElementById('creator-video-info-badge');
      if (infoBadge) infoBadge.textContent = `Loaded: ${file.name}`;
      toast.show(`Loaded ${file.name}`, 'success');
    }
  });

  const sliderTrimStart = document.getElementById('slider-trim-start');
  const sliderTrimEnd = document.getElementById('slider-trim-end');
  const trimStartDisplay = document.getElementById('trim-start-display');
  const currentPlayDisplay = document.getElementById('current-play-display');
  const trimEndDisplay = document.getElementById('trim-end-display');

  eventBus.on('editor:video-loaded', ({ duration }) => {
    sliderTrimStart.max = duration;
    sliderTrimEnd.max = duration;
    sliderTrimStart.value = 0;
    sliderTrimEnd.value = duration;
    trimStartDisplay.textContent = '0.0s';
    trimEndDisplay.textContent = `${duration.toFixed(1)}s`;
    currentPlayDisplay.textContent = '0.0s';
  });

  eventBus.on('editor:time-updated', ({ currentTime }) => {
    currentPlayDisplay.textContent = `${currentTime.toFixed(1)}s`;
  });

  sliderTrimStart.addEventListener('input', (e) => {
    const s = parseFloat(e.target.value);
    trimStartDisplay.textContent = `${s.toFixed(1)}s`;
    videoEditor.setTrim(s, parseFloat(sliderTrimEnd.value));
  });

  sliderTrimEnd.addEventListener('input', (e) => {
    const end = parseFloat(e.target.value);
    trimEndDisplay.textContent = `${end.toFixed(1)}s`;
    videoEditor.setTrim(parseFloat(sliderTrimStart.value), end);
  });

  document.getElementById('btn-preview-trim').addEventListener('click', () => {
    const video = document.getElementById('editor-video-preview');
    if (video) {
      video.currentTime = parseFloat(sliderTrimStart.value);
      video.play();
    }
  });

  document.getElementById('btn-export-edited-video').addEventListener('click', async () => {
    await videoEditor.exportEditedVideo();
  });

  // Filter sliders
  const sliderBright = document.getElementById('slider-filter-bright');
  const sliderContrast = document.getElementById('slider-filter-contrast');
  const sliderSat = document.getElementById('slider-filter-sat');

  sliderBright.addEventListener('input', (e) => {
    document.getElementById('val-bright').textContent = `${e.target.value}%`;
    videoEditor.setFilter('brightness', e.target.value);
  });
  sliderContrast.addEventListener('input', (e) => {
    document.getElementById('val-contrast').textContent = `${e.target.value}%`;
    videoEditor.setFilter('contrast', e.target.value);
  });
  sliderSat.addEventListener('input', (e) => {
    document.getElementById('val-sat').textContent = `${e.target.value}%`;
    videoEditor.setFilter('saturation', e.target.value);
  });

  document.getElementById('btn-extract-thumb').addEventListener('click', () => {
    videoEditor.downloadThumbnail();
    toast.show('Thumbnail downloaded.', 'success');
  });

  document.getElementById('btn-download-srt').addEventListener('click', () => {
    captionEditor.downloadCaptions('srt');
    toast.show('Captions (.SRT) exported.', 'success');
  });

  document.getElementById('btn-download-vtt').addEventListener('click', () => {
    captionEditor.downloadCaptions('vtt');
    toast.show('Captions (.VTT) exported.', 'success');
  });

  // Subtitle cue manager
  const btnGenCaptionsScript = document.getElementById('btn-gen-captions-script');
  const btnAddCueSubmit = document.getElementById('btn-add-cue-submit');
  const inputNewCueStart = document.getElementById('input-new-cue-start');
  const inputNewCueEnd = document.getElementById('input-new-cue-end');
  const inputNewCueText = document.getElementById('input-new-cue-text');
  const captionCuesList = document.getElementById('caption-cues-list');

  btnGenCaptionsScript.addEventListener('click', () => {
    const script = appState.get('activeScript');
    const segs = captionEditor.generateFromScript(script?.content || '', appState.get('targetWPM'));
    renderCaptionCues(segs);
    toast.show(`Calculated ${segs.length} estimated cues from script pacing.`, 'success');
  });

  const btnTranscribeAudioAi = document.getElementById('btn-transcribe-audio-ai');
  if (btnTranscribeAudioAi) {
    btnTranscribeAudioAi.addEventListener('click', async () => {
      toast.show('Requesting Speech Transcription from AI Gateway...', 'info');
      try {
        const customEp = document.getElementById('input-ai-endpoint')?.value?.trim();
        if (!customEp) {
          toast.show('External AI transcription unconfigured. Using script timing cues.', 'info');
          const script = appState.get('activeScript');
          const segs = captionEditor.generateFromScript(script?.content || '', appState.get('targetWPM'));
          renderCaptionCues(segs);
          return;
        }
        const endpoint = customEp.replace(/\/+$/, '');
        const res = await fetch(`${endpoint}/api/ai/process`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'transcription' })
        });
        const data = await res.json();
        if (res.status === 503) {
          toast.show('Cloud Whisper unconfigured. Using estimated script timing.', 'warn');
          const script = appState.get('activeScript');
          const segs = captionEditor.generateFromScript(script?.content || '', appState.get('targetWPM'));
          renderCaptionCues(segs);
        } else if (res.ok && data.segments) {
          captionEditor.setSegments(data.segments);
          renderCaptionCues(data.segments);
          toast.show(`Loaded ${data.segments.length} speech transcription cues!`, 'success');
        } else {
          toast.show('Transcription service unavailable.', 'error');
        }
      } catch (err) {
        toast.show('AI gateway connection error. Using script timing.', 'warn');
        const script = appState.get('activeScript');
        const segs = captionEditor.generateFromScript(script?.content || '', appState.get('targetWPM'));
        renderCaptionCues(segs);
      }
    });
  }

  btnAddCueSubmit.addEventListener('click', () => {
    const s = parseFloat(inputNewCueStart.value) || 0;
    const end = parseFloat(inputNewCueEnd.value) || (s + 3);
    const txt = inputNewCueText.value.trim();
    if (txt) {
      captionEditor.addSegment(s, end, txt);
      inputNewCueText.value = '';
      renderCaptionCues(captionEditor.getSegments());
      toast.show('Cue added.', 'info');
    }
  });

  function renderCaptionCues(segments) {
    captionCuesList.innerHTML = '';
    segments.forEach(seg => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.alignItems = 'center';
      row.style.justifyContent = 'space-between';
      row.style.background = 'var(--bg-tertiary)';
      row.style.padding = '4px 8px';
      row.style.borderRadius = 'var(--radius-sm)';

      const timeSpan = document.createElement('span');
      timeSpan.style.fontFamily = 'var(--font-mono)';
      timeSpan.style.color = 'var(--accent-secondary)';
      timeSpan.textContent = `[${seg.startSec.toFixed(1)}s - ${seg.endSec.toFixed(1)}s]`;

      const textSpan = document.createElement('span');
      textSpan.style.flex = '1';
      textSpan.style.margin = '0 6px';
      textSpan.style.overflow = 'hidden';
      textSpan.style.textOverflow = 'ellipsis';
      textSpan.style.whiteSpace = 'nowrap';
      textSpan.textContent = seg.text;

      const delBtn = document.createElement('button');
      delBtn.className = 'btn-icon';
      delBtn.style.padding = '2px';
      delBtn.innerHTML = '&times;';
      delBtn.onclick = () => {
        captionEditor.deleteSegment(seg.id);
        renderCaptionCues(captionEditor.getSegments());
      };

      row.appendChild(timeSpan);
      row.appendChild(textSpan);
      row.appendChild(delBtn);
      captionCuesList.appendChild(row);
    });
  }
}

// ============================================================================
// RECORDING LIBRARY MODAL
// ============================================================================
function bindRecordingLibraryEvents() {
  btnOpenRecLibrary.addEventListener('click', async () => {
    await renderRecordingLibrary();
    modalManager.open('modal-recording-library');
  });

  eventBus.on('recordings:updated', async () => {
    await updateRecordingBadge();
  });
}

async function updateRecordingBadge() {
  const recordings = await recordingLibrary.getAllRecordings();
  if (recCountBadge) {
    recCountBadge.textContent = recordings.length;
  }
}

async function renderRecordingLibrary() {
  const listEl = document.getElementById('reclib-items-list');
  const emptyEl = document.getElementById('reclib-empty-state');
  if (!listEl) return;

  listEl.innerHTML = '';
  const recordings = await recordingLibrary.getAllRecordings();

  if (recordings.length === 0) {
    if (emptyEl) emptyEl.style.display = 'block';
    return;
  }
  if (emptyEl) emptyEl.style.display = 'none';

  recordings.sort((a, b) => b.createdAt - a.createdAt);

  recordings.forEach(rec => {
    const card = document.createElement('div');
    card.style.display = 'flex';
    card.style.alignItems = 'center';
    card.style.justifyContent = 'space-between';
    card.style.background = 'var(--bg-tertiary)';
    card.style.padding = '10px 14px';
    card.style.borderRadius = 'var(--radius-md)';
    card.style.border = '1px solid var(--border-subtle)';

    const info = document.createElement('div');
    info.innerHTML = `
      <div style="font-weight:600; font-size:13px; color:var(--text-primary);">${rec.scriptTitle || 'Recording'}</div>
      <div style="font-size:11px; color:var(--text-secondary); margin-top:2px;">
        ${new Date(rec.createdAt).toLocaleString()} • ${formatTimeSeconds(rec.duration)} • ${(rec.size / (1024 * 1024)).toFixed(2)} MB
      </div>
    `;

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.gap = '6px';

    const playBtn = document.createElement('button');
    playBtn.className = 'btn btn-secondary';
    playBtn.style.fontSize = '11px';
    playBtn.style.padding = '4px 8px';
    playBtn.textContent = 'Preview';
    playBtn.onclick = () => {
      modalManager.close('modal-recording-library');
      modalRecPreviewVideo.src = URL.createObjectURL(rec.blob);
      modalRecDuration.textContent = `Duration: ${formatTimeSeconds(rec.duration)}`;
      modalRecSize.textContent = `Size: ${(rec.size / (1024 * 1024)).toFixed(2)} MB`;
      modalManager.open('modal-recording-complete');
    };

    const editBtn = document.createElement('button');
    editBtn.className = 'btn btn-secondary';
    editBtn.style.fontSize = '11px';
    editBtn.style.padding = '4px 8px';
    editBtn.textContent = 'Edit in Studio';
    editBtn.onclick = () => {
      modalManager.close('modal-recording-library');
      videoEditor.loadVideoBlob(rec.blob);
      setWorkspaceMode('creator');
      const infoBadge = document.getElementById('creator-video-info-badge');
      if (infoBadge) infoBadge.textContent = `Loaded: ${rec.scriptTitle || 'Recording'}`;
      toast.show('Loaded recording into Studio Editor', 'success');
    };

    const dlBtn = document.createElement('button');
    dlBtn.className = 'btn btn-secondary';
    dlBtn.style.fontSize = '11px';
    dlBtn.style.padding = '4px 8px';
    dlBtn.textContent = 'Download';
    dlBtn.onclick = () => {
      recordingLibrary.downloadBlob(rec.blob, `recording-${rec.id}.webm`);
    };

    const delBtn = document.createElement('button');
    delBtn.className = 'btn btn-secondary';
    delBtn.style.fontSize = '11px';
    delBtn.style.padding = '4px 8px';
    delBtn.innerHTML = '🗑️';
    delBtn.onclick = async () => {
      if (confirm('Delete this recording?')) {
        await recordingLibrary.deleteRecording(rec.id);
        await renderRecordingLibrary();
        await updateRecordingBadge();
        toast.show('Recording deleted.', 'info');
      }
    };

    actions.appendChild(playBtn);
    actions.appendChild(editBtn);
    actions.appendChild(dlBtn);
    actions.appendChild(delBtn);

    card.appendChild(info);
    card.appendChild(actions);
    listEl.appendChild(card);
  });
}

// Attach studio instance to window for automation and testing
window.teleprompterApp = {
  appState,
  eventBus,
  scrollEngine,
  scriptManager,
  studioRecorder,
  cameraManager,
  resolveResolutionPreset,
  audioManager,
  recordingDiagnostics,
  aspectRatioManager,
  settingsSync,
  typographyEngine,
  backgroundManager,
  speechEngine,
  prompterRenderer
};

// Start Application on Load
window.addEventListener('DOMContentLoaded', bootstrap);
